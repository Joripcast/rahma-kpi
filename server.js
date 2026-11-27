/**
 * RAHMA Standalone SaaS Server (PostgreSQL Relational Backend)
 * PT Global Service Indonesia (GSI)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { URL } = require('node:url');

const {
  db,
  initDatabase,
  getAllAttributes,
  getEnrichedKpis,
  getDashboardSummary,
  normalizeHexColor,
  computeHexAccentMeta,
  authenticateUser,
  hashPassword,
  verifyPassword
} = require('./src/db');

const {
  calculateAchievementPct,
  calculateWeightedScore,
  classifyStatusColor,
  validateMitigationGate
} = require('./src/engine');

const { parseXlsxBuffer } = require('./src/xlsx');
const {
  buildKpiExcelTemplateBuffer,
  validateExcelImportRows
} = require('./src/excel-import');

const PORT = Number(process.env.PORT || 3456);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

function loadOrCreateSessionSecret() {
  if (process.env.RAHMA_SESSION_SECRET && process.env.RAHMA_SESSION_SECRET.length >= 32) {
    return process.env.RAHMA_SESSION_SECRET;
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const secretFile = path.join(DATA_DIR, '.session_secret');
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing.length >= 64) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = loadOrCreateSessionSecret();
const SESSION_COOKIE = 'rahma_session';
const otpStore = new Map(); // key: `${userId}:${purpose}` -> { code, targetEmail, expiresAt, attempts }
const revokedSessionJtis = new Map(); // jti -> exp timestamp
const rateLimitStore = new Map(); // key -> { count, resetAt }

const ALLOWED_POLARITIES = new Set(['MAXIMIZE', 'MINIMIZE']);
const ALLOWED_YTD_METHODS = new Set(['SUM', 'AVG', 'LAST_VALUE']);
const ALLOWED_ATTR_GROUPS = new Set(['PERSPECTIVE', 'CATEGORY', 'PRIORITY', 'MITIGATION_TAG']);
const ALLOWED_ACTION_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'CLOSED']);

function getClientIp(req) {
  return req.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function resetRateLimit(key) {
  rateLimitStore.delete(key);
}

function verifyOtpTimingSafe(inputOtp, expectedOtp) {
  const a = Buffer.from(String(inputOtp || ''));
  const b = Buffer.from(String(expectedOtp || ''));
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function computePasswordFingerprint(passwordHash) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(String(passwordHash || ''))
    .digest('hex')
    .slice(0, 16);
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
  );
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const map = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      try {
        map[k] = decodeURIComponent(v);
      } catch {
        map[k] = v;
      }
    }
  }
  return map;
}

function createSessionToken(user, passwordHash = '') {
  const payload = Buffer.from(
    JSON.stringify({
      jti: crypto.randomUUID(),
      id: user.id,
      role: user.role,
      department_id: user.department_id,
      pwdSig: passwordHash ? computePasswordFingerprint(passwordHash) : undefined,
      exp: Date.now() + 8 * 60 * 60 * 1000 // 8 hours
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function revokeSessionTokenFromReq(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token || !token.includes('.')) return;
  try {
    const [payloadB64] = token.split('.');
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (parsed && parsed.jti && parsed.exp) {
      revokedSessionJtis.set(parsed.jti, Number(parsed.exp));
    }
  } catch {
    // Ignore malformed token on logout
  }
}

async function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed.id || Date.now() > Number(parsed.exp)) return null;
    if (parsed.jti && revokedSessionJtis.has(parsed.jti)) return null;

    const dbUser = await db.get(
      `SELECT u.id, u.department_id, u.name, u.email, u.role, u.title, u.password_hash,
              d.code as department_code, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ?`,
      parsed.id
    );
    if (!dbUser) return null;

    // Invalidate token immediately if password has been changed since token issuance
    if (parsed.pwdSig && dbUser.password_hash) {
      const currentPwdSig = computePasswordFingerprint(dbUser.password_hash);
      if (parsed.pwdSig !== currentPwdSig) return null;
    }

    const { password_hash: _omitted, ...safeUser } = dbUser;
    return safeUser;
  } catch {
    return null;
  }
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  applySecurityHeaders(res);
  const body = JSON.stringify(payload);
  const reqAcceptEncoding = String(res.req?.headers?.['accept-encoding'] || '');
  if (body.length > 1024 && reqAcceptEncoding.includes('gzip')) {
    const gzBody = zlib.gzipSync(body);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Vary': 'Accept-Encoding',
      'Cache-Control': 'no-store',
      ...extraHeaders
    });
    return res.end(gzBody);
  }
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const COMPRESSIBLE_EXTS = new Set(['.html', '.css', '.js', '.json', '.svg']);
const IMMUTABLE_ASSET_EXTS = new Set(['.ttf', '.woff', '.woff2', '.webp', '.png', '.jpg', '.jpeg', '.ico']);

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    await initDatabase();

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // =========================================================================
    // CSRF & CONTENT-TYPE GUARD FOR STATE-MUTATING API REQUESTS
    // =========================================================================
    if (pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE'].includes(method)) {
      const origin = req.headers.origin;
      const host = req.headers.host;
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return sendJson(res, 403, {
              error: 'Akses ditolak (CSRF Guard): Origin permintaan tidak cocok dengan host server.'
            });
          }
        } catch {
          return sendJson(res, 403, { error: 'Akses ditolak: Header Origin tidak valid.' });
        }
      }

      if ((method === 'POST' || method === 'PUT') && pathname !== '/api/auth/logout') {
        const ct = String(req.headers['content-type'] || '').toLowerCase();
        if (!ct.includes('application/json')) {
          return sendJson(res, 415, {
            error: 'Content-Type wajib menggunakan application/json.'
          });
        }
      }
    }

    // =========================================================================
    // 0. REAL AUTHENTICATION & SESSION ENDPOINTS (/api/auth/*)
    // =========================================================================
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const clientIp = getClientIp(req);
      const emailKey = String(body.email || '').trim().toLowerCase();
      const limitKey = `login:${clientIp}:${emailKey}`;
      const rl = checkRateLimit(limitKey, 10, 15 * 60 * 1000);
      if (!rl.allowed) {
        return sendJson(
          res,
          429,
          {
            error: `Terlalu banyak percobaan login gagal. Silakan coba kembali dalam ${rl.retryAfterSec} detik.`
          },
          { 'Retry-After': String(rl.retryAfterSec) }
        );
      }

      const user = await authenticateUser(body.email, body.password);
      if (!user) {
        return sendJson(res, 401, {
          error: 'Email atau kata sandi tidak valid. Silakan periksa kembali kredensial Anda.'
        });
      }
      resetRateLimit(limitKey);
      const pwdRow = await db.get(`SELECT password_hash FROM users WHERE id = ?`, user.id);
      const token = createSessionToken(user, pwdRow ? pwdRow.password_hash : '');
      return sendJson(
        res,
        200,
        { message: `Selamat datang, ${user.name}`, user },
        {
          'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(
            token
          )}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`
        }
      );
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      revokeSessionTokenFromReq(req);
      return sendJson(
        res,
        200,
        { message: 'Anda telah keluar dari sesi RAHMA.' },
        {
          'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
        }
      );
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const currentUser = await getAuthenticatedUser(req);
      if (!currentUser) {
        return sendJson(res, 200, { authenticated: false, user: null });
      }
      return sendJson(res, 200, { authenticated: true, user: currentUser });
    }

    if (pathname === '/api/auth/departments' && method === 'GET') {
      const departments = await db.all(
        `SELECT id, code, name FROM departments WHERE is_active = 1 ORDER BY code ASC`
      );
      return sendJson(res, 200, { departments });
    }

    if (pathname === '/api/auth/signup' && method === 'POST') {
      const rl = checkRateLimit(`signup:${getClientIp(req)}`, 10, 15 * 60 * 1000);
      if (!rl.allowed) {
        return sendJson(
          res,
          429,
          { error: `Terlalu banyak permintaan pendaftaran. Coba lagi dalam ${rl.retryAfterSec} detik.` },
          { 'Retry-After': String(rl.retryAfterSec) }
        );
      }
      const body = await parseJsonBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const title = String(body.title || '').trim();
      const role = body.role === 'EXECUTIVE' ? 'EXECUTIVE' : 'DIV_LEADER';
      const departmentId = role === 'DIV_LEADER' ? String(body.departmentId || '').trim() : null;

      if (name.length < 2 || name.length > 120) {
        return sendJson(res, 400, { error: 'Nama lengkap harus 2 hingga 120 karakter.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
        return sendJson(res, 400, { error: 'Format email korporasi tidak valid.' });
      }
      if (password.length < 6 || password.length > 128) {
        return sendJson(res, 400, { error: 'Kata sandi harus antara 6 hingga 128 karakter.' });
      }
      if (role === 'DIV_LEADER') {
        const dept = await db.get(
          `SELECT id FROM departments WHERE id = ? AND is_active = 1`,
          departmentId
        );
        if (!dept) {
          return sendJson(res, 400, { error: 'Silakan pilih departemen yang valid untuk Division Leader.' });
        }
      }

      const existing = await db.get(
        `SELECT id FROM users WHERE LOWER(email) = LOWER(?)`,
        email
      );
      if (existing) {
        return sendJson(res, 409, { error: `Email "${email}" sudah terdaftar. Silakan masuk.` });
      }

      const userId = `user-${Date.now()}`;
      const pwdHash = hashPassword(password);
      await db.run(
        `INSERT INTO users (id, department_id, name, email, role, title, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        userId,
        departmentId,
        name,
        email,
        role,
        title || (role === 'EXECUTIVE' ? 'Executive / BOD' : 'Division Leader'),
        pwdHash
      );

      const newUser = await db.get(
        `SELECT u.id, u.department_id, u.name, u.email, u.role, u.title,
                d.code as department_code, d.name as department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.id = ?`,
        userId
      );
      const token = createSessionToken(newUser, pwdHash);

      return sendJson(
        res,
        201,
        { message: `Akun ${newUser.name} berhasil dibuat.`, user: newUser },
        {
          'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(
            token
          )}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`
        }
      );
    }

    // =========================================================================
    // GLOBAL API RBAC GUARD (All /api/* routes below require valid session)
    // =========================================================================
    let authUser = null;
    if (pathname.startsWith('/api/')) {
      authUser = await getAuthenticatedUser(req);
      if (!authUser) {
        return sendJson(res, 401, {
          error: 'Akses ditolak: Anda harus login terlebih dahulu.'
        });
      }

      // Admin-only routes (CPMD_ADMIN)
      const isCpmdWriteRoute =
        (pathname.startsWith('/api/departments') && method !== 'GET') ||
        (pathname.startsWith('/api/kpis') && method !== 'GET') ||
        (pathname.startsWith('/api/attributes') && method !== 'GET') ||
        pathname === '/api/records/lock' ||
        pathname === '/api/export/backup';

      if (isCpmdWriteRoute && authUser.role !== 'CPMD_ADMIN') {
        return sendJson(res, 403, {
          error: `Akses ditolak (RBAC 403): Role "${authUser.role}" tidak memiliki izin melakukan aksi administratif CPMD ini.`
        });
      }
    }

    // =========================================================================
    // 0b. SELF-SERVICE ACCOUNT SETTINGS & EMAIL OTP (/api/auth/profile, otp, email, password)
    // =========================================================================
    if (pathname === '/api/auth/profile' && method === 'PUT') {
      const body = await parseJsonBody(req);
      const nextName = String(body.name || '').trim();
      const nextTitle = String(body.title || '').trim();
      if (nextName.length < 2) {
        return sendJson(res, 400, { error: 'Nama lengkap minimal 2 karakter.' });
      }
      await db.run(
        `UPDATE users SET name = ?, title = ? WHERE id = ?`,
        nextName,
        nextTitle || authUser.title || '',
        authUser.id
      );
      const updatedUser = await getAuthenticatedUser(req);
      return sendJson(res, 200, {
        message: 'Profil akun berhasil diperbarui.',
        user: updatedUser
      });
    }

    if (pathname === '/api/auth/otp/request' && method === 'POST') {
      const rl = checkRateLimit(`otp:${authUser.id}:${getClientIp(req)}`, 5, 10 * 60 * 1000);
      if (!rl.allowed) {
        return sendJson(
          res,
          429,
          { error: `Terlalu banyak permintaan OTP. Silakan tunggu ${rl.retryAfterSec} detik.` },
          { 'Retry-After': String(rl.retryAfterSec) }
        );
      }

      const body = await parseJsonBody(req);
      const purpose = body.purpose === 'email' ? 'email' : 'password';
      const targetEmail =
        purpose === 'email' && body.targetEmail
          ? String(body.targetEmail).trim().toLowerCase()
          : authUser.email;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        return sendJson(res, 400, { error: 'Format email tujuan OTP tidak valid.' });
      }

      if (purpose === 'email') {
        const conflict = await db.get(
          `SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?`,
          targetEmail,
          authUser.id
        );
        if (conflict) {
          return sendJson(res, 409, {
            error: `Email "${targetEmail}" sudah digunakan oleh akun lain.`
          });
        }
      }

      const code = String(crypto.randomInt(100000, 999999));
      otpStore.set(`${authUser.id}:${purpose}`, {
        code,
        targetEmail,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
      });

      console.log(`[RAHMA Email OTP] To: ${targetEmail} | Purpose: ${purpose} | Code: ${code}`);
      const isProd = process.env.NODE_ENV === 'production';
      return sendJson(res, 200, {
        message: `Kode OTP 6-digit telah dikirim ke ${targetEmail} (berlaku 5 menit).`,
        targetEmail,
        expiresInSeconds: 300,
        ...(isProd ? {} : { devOtpPreview: code })
      });
    }

    if (pathname === '/api/auth/email/change' && method === 'POST') {
      const body = await parseJsonBody(req);
      const newEmail = String(body.newEmail || '').trim().toLowerCase();
      const otpCode = String(body.otpCode || '').trim();
      const currentPassword = String(body.currentPassword || '');

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return sendJson(res, 400, { error: 'Format email baru tidak valid.' });
      }

      const recordKey = `${authUser.id}:email`;
      const record = otpStore.get(recordKey);
      if (!record || Date.now() > record.expiresAt) {
        otpStore.delete(recordKey);
        return sendJson(res, 400, { error: 'Kode OTP tidak ditemukan atau sudah kedaluwarsa.' });
      }

      if (!verifyOtpTimingSafe(otpCode, record.code) || record.targetEmail !== newEmail) {
        record.attempts = (record.attempts || 0) + 1;
        if (record.attempts >= 5) {
          otpStore.delete(recordKey);
          return sendJson(res, 429, {
            error: 'Kode OTP telah dibatalkan karena terlalu banyak percobaan salah (maks 5x). Silakan minta OTP baru.'
          });
        }
        return sendJson(res, 400, { error: 'Kode OTP tidak cocok dengan email baru.' });
      }

      const dbRow = await db.get(`SELECT password_hash FROM users WHERE id = ?`, authUser.id);
      if (!dbRow || !verifyPassword(currentPassword, dbRow.password_hash)) {
        return sendJson(res, 401, { error: 'Kata sandi saat ini salah.' });
      }

      const conflict = await db.get(
        `SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?`,
        newEmail,
        authUser.id
      );
      if (conflict) {
        return sendJson(res, 409, { error: `Email "${newEmail}" sudah terdaftar.` });
      }

      await db.run(`UPDATE users SET email = ? WHERE id = ?`, newEmail, authUser.id);
      otpStore.delete(recordKey);
      const updatedUser = await getAuthenticatedUser(req);
      return sendJson(res, 200, {
        message: `Email akun berhasil diubah menjadi ${newEmail}.`,
        user: updatedUser
      });
    }

    if (pathname === '/api/auth/password/change' && method === 'POST') {
      const body = await parseJsonBody(req);
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      const otpCode = String(body.otpCode || '').trim();

      const recordKey = `${authUser.id}:password`;
      const record = otpStore.get(recordKey);
      if (!record || Date.now() > record.expiresAt) {
        otpStore.delete(recordKey);
        return sendJson(res, 400, { error: 'Kode OTP tidak ditemukan atau sudah kedaluwarsa.' });
      }

      if (!verifyOtpTimingSafe(otpCode, record.code)) {
        record.attempts = (record.attempts || 0) + 1;
        if (record.attempts >= 5) {
          otpStore.delete(recordKey);
          return sendJson(res, 429, {
            error: 'Kode OTP telah dibatalkan karena terlalu banyak percobaan salah (maks 5x). Silakan minta OTP baru.'
          });
        }
        return sendJson(res, 400, { error: 'Kode OTP salah.' });
      }

      const dbRow = await db.get(`SELECT password_hash FROM users WHERE id = ?`, authUser.id);
      if (!dbRow || !verifyPassword(currentPassword, dbRow.password_hash)) {
        return sendJson(res, 401, { error: 'Kata sandi saat ini tidak sesuai.' });
      }

      if (newPassword.length < 6 || newPassword.length > 128) {
        return sendJson(res, 400, { error: 'Kata sandi baru harus antara 6 hingga 128 karakter.' });
      }

      const nextHash = hashPassword(newPassword);
      await db.run(
        `UPDATE users SET password_hash = ? WHERE id = ?`,
        nextHash,
        authUser.id
      );
      otpStore.delete(recordKey);
      revokeSessionTokenFromReq(req);
      const refreshedToken = createSessionToken(authUser, nextHash);
      return sendJson(
        res,
        200,
        {
          message: 'Kata sandi berhasil diperbarui. Seluruh sesi lama telah dicabut secara otomatis.'
        },
        {
          'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(
            refreshedToken
          )}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`
        }
      );
    }

    // =========================================================================
    // 1. GET /api/bootstrap
    // =========================================================================
    if (pathname === '/api/bootstrap' && method === 'GET') {
      const [departments, attributes] = await Promise.all([
        db.all(`SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`),
        getAllAttributes()
      ]);

      return sendJson(res, 200, {
        organization: 'PT Global Service Indonesia (GSI)',
        systemName: 'RAHMA — Real-time Analytical Hub for Management & Accountability',
        defaultYear: 2026,
        defaultMonth: 11,
        currentUser: authUser,
        departments,
        attributes
      });
    }

    // =========================================================================
    // 2. GET /api/dashboard
    // =========================================================================
    if (pathname === '/api/dashboard' && method === 'GET') {
      const year = Number(parsedUrl.searchParams.get('year') || 2026);
      const month = Number(parsedUrl.searchParams.get('month') || 11);
      const mode = (parsedUrl.searchParams.get('mode') || 'MONTHLY').toUpperCase();
      const summary = await getDashboardSummary({ year, month, mode });
      return sendJson(res, 200, summary);
    }

    // =========================================================================
    // 3. GET /api/kpis
    // =========================================================================
    if (pathname === '/api/kpis' && method === 'GET') {
      const departmentId = parsedUrl.searchParams.get('departmentId') || 'ALL';
      const year = Number(parsedUrl.searchParams.get('year') || 2026);
      const month = Number(parsedUrl.searchParams.get('month') || 11);
      const kpis = await getEnrichedKpis({ departmentId, year, month });
      return sendJson(res, 200, { kpis });
    }

    // =========================================================================
    // 4. POST /api/records/save (Inline KPI Input + Mandatory Mitigation Gate + RBAC)
    // =========================================================================
    if (pathname === '/api/records/save' && method === 'POST') {
      if (authUser.role === 'EXECUTIVE') {
        return sendJson(res, 403, {
          error: 'Akses ditolak (RBAC 403): Role Executive (BOD) hanya memiliki akses Read-Only.'
        });
      }

      const body = await parseJsonBody(req);
      const {
        kpiId,
        year = 2026,
        month = 11,
        targetValue,
        actualValue,
        problemIdentification = '',
        correctiveAction = '',
        needSupport = '',
        actionPic = '',
        actionDueDate = '',
        actionStatus = 'OPEN',
        mitigationTagIds = [],
        isDraft = false
      } = body;
      const updatedBy = authUser.name;

      const kpi = await db.get(`SELECT * FROM kpi_dictionary WHERE id = ?`, kpiId);
      if (!kpi) {
        return sendJson(res, 404, { error: 'KPI tidak ditemukan di dalam Kamus KPI.' });
      }

      if (authUser.role === 'DIV_LEADER' && kpi.department_id !== authUser.department_id) {
        return sendJson(res, 403, {
          error: `Akses ditolak (RBAC 403): Anda hanya diizinkan menginput KPI milik departemen Anda sendiri (${authUser.department_code || 'Divisi Anda'}).`
        });
      }

      const existing = await db.get(
        `SELECT * FROM kpi_monthly_records WHERE kpi_id = ? AND period_year = ? AND period_month = ?`,
        kpiId,
        Number(year),
        Number(month)
      );

      if (existing && existing.is_locked) {
        return sendJson(res, 423, {
          error: 'Periode pelaporan untuk KPI ini telah dikunci oleh Divisi CPMD.'
        });
      }

      const numYear = Number(year);
      const numMonth = Number(month);
      if (!Number.isInteger(numYear) || numYear < 2020 || numYear > 2100 || !Number.isInteger(numMonth) || numMonth < 1 || numMonth > 12) {
        return sendJson(res, 400, { error: 'Periode tahun atau bulan tidak valid.' });
      }

      const effectiveTarget =
        targetValue !== undefined && targetValue !== null && targetValue !== ''
          ? Number(targetValue)
          : existing
            ? Number(existing.target_value)
            : Number(kpi.baseline_target);

      if (!Number.isFinite(effectiveTarget)) {
        return sendJson(res, 400, { error: 'Nilai Target KPI harus berupa angka yang valid.' });
      }

      const hasActual =
        actualValue !== undefined && actualValue !== null && actualValue !== '';
      const numericActual = hasActual ? Number(actualValue) : null;
      if (hasActual && !Number.isFinite(numericActual)) {
        return sendJson(res, 400, { error: 'Nilai Actual KPI harus berupa angka yang valid.' });
      }

      const achievementPct = hasActual
        ? calculateAchievementPct(
            effectiveTarget,
            numericActual,
            kpi.polarity,
            kpi.cap_score
          )
        : null;
      const weightedScore = hasActual
        ? calculateWeightedScore(achievementPct, kpi.weight)
        : null;
      const statusColor = hasActual
        ? classifyStatusColor(achievementPct, kpi.red_threshold, kpi.yellow_threshold)
        : 'UNREPORTED';

      const normalizedActionStatus = String(actionStatus || 'OPEN').trim().toUpperCase();
      if (!ALLOWED_ACTION_STATUSES.has(normalizedActionStatus)) {
        return sendJson(res, 400, {
          error: 'Status tiket tindak lanjut harus OPEN, IN_PROGRESS, atau CLOSED.'
        });
      }

      // MANDATORY MITIGATION LOGIC GATE
      const gateResult = validateMitigationGate({
        statusColor,
        problemIdentification,
        correctiveAction,
        needSupport,
        actionPic,
        actionDueDate,
        actionStatus: normalizedActionStatus,
        requireTicketFields: true,
        isDraft: Boolean(isDraft)
      });

      if (!gateResult.valid) {
        return sendJson(res, 422, {
          error: 'GERBANG LOGIKA MITIGASI AKTIF: Status performa MERAH wajib melengkapi data mitigasi.',
          gateBlocked: true,
          statusColor,
          achievementPct,
          validationErrors: gateResult.errors
        });
      }

      const tagsJson = JSON.stringify(Array.isArray(mitigationTagIds) ? mitigationTagIds : []);

      if (existing) {
        await db.run(
          `UPDATE kpi_monthly_records
           SET target_value = ?,
               actual_value = ?,
               achievement_pct = ?,
               weighted_score = ?,
               status_color = ?,
               problem_identification = ?,
               corrective_action = ?,
               need_support = ?,
               mitigation_tags = ?,
               action_pic = ?,
               action_due_date = ?,
               action_status = ?,
               is_draft = ?,
               updated_by = ?,
               updated_at = CURRENT_TIMESTAMP::TEXT
           WHERE id = ?`,
          effectiveTarget,
          numericActual,
          achievementPct,
          weightedScore,
          statusColor,
          problemIdentification.trim(),
          correctiveAction.trim(),
          needSupport.trim(),
          tagsJson,
          String(actionPic || '').trim(),
          String(actionDueDate || '').trim(),
          normalizedActionStatus,
          isDraft ? 1 : 0,
          updatedBy,
          existing.id
        );
      } else {
        const recId = `rec-${kpiId}-${year}-${month}`;
        await db.run(
          `INSERT INTO kpi_monthly_records (
            id, kpi_id, period_year, period_month, target_value, actual_value,
            achievement_pct, weighted_score, status_color,
            problem_identification, corrective_action, need_support, mitigation_tags,
            action_pic, action_due_date, action_status,
            is_draft, is_locked, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          recId,
          kpiId,
          Number(year),
          Number(month),
          effectiveTarget,
          numericActual,
          achievementPct,
          weightedScore,
          statusColor,
          problemIdentification.trim(),
          correctiveAction.trim(),
          needSupport.trim(),
          tagsJson,
          String(actionPic || '').trim(),
          String(actionDueDate || '').trim(),
          normalizedActionStatus,
          isDraft ? 1 : 0,
          updatedBy
        );
      }

      const deptKpis = await getEnrichedKpis({
        departmentId: kpi.department_id,
        year: Number(year),
        month: Number(month)
      });
      const updatedKpi = deptKpis.find((item) => item.id === kpiId);

      return sendJson(res, 200, {
        message: isDraft
          ? 'Draft realisasi KPI berhasil disimpan otomatis.'
          : 'Laporan realisasi KPI berhasil disubmit.',
        kpi: updatedKpi
      });
    }

    // =========================================================================
    // 4B. POST /api/records/action-status (Update Mitigation Ticket / Carry-Over)
    // =========================================================================
    if (pathname === '/api/records/action-status' && method === 'POST') {
      if (authUser.role === 'EXECUTIVE') {
        return sendJson(res, 403, {
          error: 'Akses ditolak (RBAC 403): Role Executive (BOD) hanya memiliki akses Read-Only.'
        });
      }

      const body = await parseJsonBody(req);
      const { recordId, actionStatus, actionPic, actionDueDate } = body;
      if (!recordId) {
        return sendJson(res, 400, { error: 'ID record mitigasi wajib disertakan.' });
      }

      const nextStatus = String(actionStatus || '').trim().toUpperCase();
      if (!ALLOWED_ACTION_STATUSES.has(nextStatus)) {
        return sendJson(res, 400, {
          error: 'Status tiket tindak lanjut harus OPEN, IN_PROGRESS, atau CLOSED.'
        });
      }

      const existingRec = await db.get(
        `SELECT r.*, k.department_id, k.code as kpi_code
         FROM kpi_monthly_records r
         JOIN kpi_dictionary k ON k.id = r.kpi_id
         WHERE r.id = ?`,
        recordId
      );
      if (!existingRec) {
        return sendJson(res, 404, { error: 'Tiket tindak lanjut mitigasi tidak ditemukan.' });
      }

      if (authUser.role === 'DIV_LEADER' && existingRec.department_id !== authUser.department_id) {
        return sendJson(res, 403, {
          error: 'Akses ditolak (RBAC 403): Anda tidak dapat mengubah tiket mitigasi divisi lain.'
        });
      }

      await db.run(
        `UPDATE kpi_monthly_records
         SET action_status = ?,
             action_pic = ?,
             action_due_date = ?,
             updated_by = ?,
             updated_at = CURRENT_TIMESTAMP::TEXT
         WHERE id = ?`,
        nextStatus,
        actionPic !== undefined ? String(actionPic).trim() : existingRec.action_pic || '',
        actionDueDate !== undefined ? String(actionDueDate).trim() : existingRec.action_due_date || '',
        authUser.name,
        recordId
      );

      return sendJson(res, 200, {
        message: `Status tiket mitigasi ${existingRec.kpi_code} (Bulan ${existingRec.period_month}) diperbarui menjadi ${nextStatus}.`
      });
    }

    // =========================================================================
    // 5. POST /api/records/lock (CPMD Lock / Unlock Period)
    // =========================================================================
    if (pathname === '/api/records/lock' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { departmentId = 'ALL', year = 2026, month = 11, locked = true } = body;

      if (departmentId === 'ALL') {
        await db.run(
          `UPDATE kpi_monthly_records SET is_locked = ? WHERE period_year = ? AND period_month = ?`,
          locked ? 1 : 0,
          Number(year),
          Number(month)
        );
      } else {
        await db.run(
          `UPDATE kpi_monthly_records
           SET is_locked = ?
           WHERE period_year = ? AND period_month = ?
             AND kpi_id IN (SELECT id FROM kpi_dictionary WHERE department_id = ?)`,
          locked ? 1 : 0,
          Number(year),
          Number(month),
          departmentId
        );
      }

      return sendJson(res, 200, {
        message: locked
          ? 'Periode pelaporan berhasil dikunci oleh CPMD.'
          : 'Kunci periode pelaporan berhasil dibuka kembali.'
      });
    }

    // =========================================================================
    // 5B. SMART EXCEL IMPORT (.xlsx) TEMPLATE, DRY-RUN & TRANSACTIONAL COMMIT
    // =========================================================================
    if (pathname === '/api/excel/template' && method === 'GET') {
      if (authUser.role === 'EXECUTIVE') {
        return sendJson(res, 403, {
          error: 'Akses ditolak (RBAC 403): Role Executive (BOD) hanya memiliki akses Read-Only.'
        });
      }

      const year = Number(parsedUrl.searchParams.get('year') || 2026);
      const month = Number(parsedUrl.searchParams.get('month') || 11);
      if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
        return sendJson(res, 400, { error: 'Periode tahun atau bulan tidak valid.' });
      }

      const requestedDept = parsedUrl.searchParams.get('departmentId') || 'ALL';
      const departmentId =
        authUser.role === 'DIV_LEADER' && authUser.department_id
          ? authUser.department_id
          : requestedDept;

      const kpis = await getEnrichedKpis({ departmentId, year, month });
      let departmentLabel = 'Semua Divisi';
      if (departmentId !== 'ALL') {
        const deptRow = await db.get(`SELECT code, name FROM departments WHERE id = ?`, departmentId);
        if (deptRow) departmentLabel = `${deptRow.code} — ${deptRow.name}`;
      }

      const xlsxBuf = buildKpiExcelTemplateBuffer({
        kpis,
        year,
        month,
        departmentLabel
      });

      const fileTag =
        departmentId !== 'ALL' && kpis[0]?.department_code
          ? kpis[0].department_code
          : 'ALL';
      const fileName = `RAHMA-Template-KPI-${fileTag}-${year}-${String(month).padStart(2, '0')}.xlsx`;

      applySecurityHeaders(res);
      res.writeHead(200, {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': xlsxBuf.length,
        'Cache-Control': 'no-store'
      });
      return res.end(xlsxBuf);
    }

    if (
      (pathname === '/api/excel/dry-run' || pathname === '/api/excel/commit') &&
      method === 'POST'
    ) {
      if (authUser.role === 'EXECUTIVE') {
        return sendJson(res, 403, {
          error: 'Akses ditolak (RBAC 403): Role Executive (BOD) hanya memiliki akses Read-Only.'
        });
      }

      const body = await parseJsonBody(req);
      const numYear = Number(body.year || 2026);
      const numMonth = Number(body.month || 11);
      if (
        !Number.isInteger(numYear) ||
        numYear < 2020 ||
        numYear > 2100 ||
        !Number.isInteger(numMonth) ||
        numMonth < 1 ||
        numMonth > 12
      ) {
        return sendJson(res, 400, { error: 'Periode tahun atau bulan tidak valid.' });
      }

      const fileBase64 = String(body.fileBase64 || '').trim();
      if (!fileBase64) {
        return sendJson(res, 400, { error: 'Berkas Excel (.xlsx) wajib diunggah.' });
      }

      let parsedSheet;
      try {
        const cleanB64 = fileBase64.includes(',') ? fileBase64.split(',').pop() : fileBase64;
        const buffer = Buffer.from(cleanB64, 'base64');
        parsedSheet = parseXlsxBuffer(buffer);
      } catch (parseErr) {
        return sendJson(res, 400, {
          error: `Gagal membaca berkas .xlsx: ${parseErr.message || 'Format berkas tidak valid.'}`
        });
      }

      const [kpis, existingRows] = await Promise.all([
        db.all(
          `SELECT k.*, d.code as department_code
           FROM kpi_dictionary k
           JOIN departments d ON d.id = k.department_id
           WHERE k.is_active = 1`
        ),
        db.all(
          `SELECT * FROM kpi_monthly_records WHERE period_year = ? AND period_month = ?`,
          numYear,
          numMonth
        )
      ]);
      const existingByKpi = new Map(existingRows.map((r) => [r.kpi_id, r]));

      const validation = validateExcelImportRows({
        rows: parsedSheet.rows,
        kpis,
        existingRecordsByKpiId: existingByKpi,
        authUser
      });

      if (validation.fatalError) {
        return sendJson(res, 400, { error: validation.fatalError });
      }

      if (pathname === '/api/excel/dry-run') {
        return sendJson(res, 200, {
          message: validation.summary.canCommit
            ? `Dry-Run berhasil: ${validation.summary.validCount} baris KPI valid dan siap disimpan ke PostgreSQL.`
            : `Dry-Run mendeteksi ${validation.summary.errorCount} baris bermasalah. Perbaiki berkas Excel sebelum commit.`,
          sheetName: parsedSheet.sheetName,
          ...validation
        });
      }

      // POST /api/excel/commit
      if (!validation.summary.canCommit) {
        return sendJson(res, 422, {
          error:
            validation.summary.errorCount > 0
              ? `Commit ditolak: terdapat ${validation.summary.errorCount} baris yang gagal validasi Dry-Run.`
              : 'Commit ditolak: tidak ada baris KPI yang memiliki nilai Actual untuk diimpor.',
          ...validation
        });
      }

      const validRows = validation.rows.filter((r) => r.status === 'VALID');
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        for (const r of validRows) {
          const existing = existingByKpi.get(r.kpiId);
          if (existing) {
            await client.query(
              `UPDATE kpi_monthly_records
               SET target_value = $1,
                   actual_value = $2,
                   achievement_pct = $3,
                   weighted_score = $4,
                   status_color = $5,
                   problem_identification = $6,
                   corrective_action = $7,
                   need_support = $8,
                   is_draft = 0,
                   updated_by = $9,
                   updated_at = CURRENT_TIMESTAMP::TEXT
               WHERE id = $10`,
              [
                r.targetValue,
                r.actualValue,
                r.achievementPct,
                r.weightedScore,
                r.statusColor,
                r.problemIdentification,
                r.correctiveAction,
                r.needSupport,
                authUser.name,
                existing.id
              ]
            );
          } else {
            const recId = `rec-${r.kpiId}-${numYear}-${numMonth}`;
            await client.query(
              `INSERT INTO kpi_monthly_records (
                id, kpi_id, period_year, period_month, target_value, actual_value,
                achievement_pct, weighted_score, status_color,
                problem_identification, corrective_action, need_support, mitigation_tags,
                is_draft, is_locked, updated_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '[]', 0, 0, $13)`,
              [
                recId,
                r.kpiId,
                numYear,
                numMonth,
                r.targetValue,
                r.actualValue,
                r.achievementPct,
                r.weightedScore,
                r.statusColor,
                r.problemIdentification,
                r.correctiveAction,
                r.needSupport,
                authUser.name
              ]
            );
          }
        }
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }

      return sendJson(res, 200, {
        message: `Smart Excel Import berhasil: ${validRows.length} indikator KPI telah disimpan ke PostgreSQL.`,
        importedCount: validRows.length
      });
    }

    // =========================================================================
    // 6. CRUD KPI ATTRIBUTES & HEX COLOR-CODED ACCENTS (/api/attributes)
    // =========================================================================
    if (pathname === '/api/attributes' && method === 'GET') {
      return sendJson(res, 200, { attributes: await getAllAttributes() });
    }

    if (pathname === '/api/attributes' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { name, attribute_group = 'CATEGORY', hex_color, description = '' } = body;

      if (!name || !name.trim()) {
        return sendJson(res, 400, { error: 'Nama atribut KPI wajib diisi.' });
      }
      if (!ALLOWED_ATTR_GROUPS.has(attribute_group)) {
        return sendJson(res, 400, { error: 'Kelompok atribut KPI tidak valid.' });
      }

      const validHex = normalizeHexColor(hex_color);
      if (!validHex) {
        return sendJson(res, 400, {
          error: 'Format warna aksen tidak valid. Gunakan format kode HEX 6-digit (#RRGGBB), contoh: #2563EB.'
        });
      }

      const duplicate = await db.get(
        `SELECT id FROM kpi_attributes WHERE LOWER(name) = LOWER(?)`,
        name.trim()
      );
      if (duplicate) {
        return sendJson(res, 409, { error: `Atribut dengan nama "${name.trim()}" sudah terdaftar.` });
      }

      const id = `attr-${Date.now()}`;
      await db.run(
        `INSERT INTO kpi_attributes (id, attribute_group, name, hex_color, description)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        attribute_group,
        name.trim(),
        validHex,
        description.trim()
      );

      return sendJson(res, 201, {
        message: `Atribut "${name.trim()}" (${validHex}) berhasil ditambahkan.`,
        attributes: await getAllAttributes()
      });
    }

    if (pathname.startsWith('/api/attributes/') && method === 'PUT') {
      const attrId = pathname.replace('/api/attributes/', '');
      const body = await parseJsonBody(req);
      const { name, attribute_group, hex_color, description } = body;

      const existing = await db.get(`SELECT * FROM kpi_attributes WHERE id = ?`, attrId);
      if (!existing) {
        return sendJson(res, 404, { error: 'Atribut KPI tidak ditemukan.' });
      }

      const validHex = hex_color ? normalizeHexColor(hex_color) : existing.hex_color;
      if (!validHex) {
        return sendJson(res, 400, {
          error: 'Format kode HEX tidak valid. Gunakan #RRGGBB (contoh: #10B981).'
        });
      }

      const nextName = name && name.trim() ? name.trim() : existing.name;
      const duplicate = await db.get(
        `SELECT id FROM kpi_attributes WHERE LOWER(name) = LOWER(?) AND id != ?`,
        nextName,
        attrId
      );
      if (duplicate) {
        return sendJson(res, 409, { error: `Nama atribut "${nextName}" sudah digunakan atribut lain.` });
      }

      await db.run(
        `UPDATE kpi_attributes
         SET name = ?,
             attribute_group = ?,
             hex_color = ?,
             description = ?
         WHERE id = ?`,
        nextName,
        attribute_group || existing.attribute_group,
        validHex,
        description !== undefined ? description.trim() : existing.description,
        attrId
      );

      return sendJson(res, 200, {
        message: `Atribut "${nextName}" (${validHex}) berhasil diperbarui di seluruh sistem.`,
        attributes: await getAllAttributes()
      });
    }

    if (pathname.startsWith('/api/attributes/') && method === 'DELETE') {
      const attrId = pathname.replace('/api/attributes/', '');
      const existing = await db.get(`SELECT * FROM kpi_attributes WHERE id = ?`, attrId);
      if (!existing) {
        return sendJson(res, 404, { error: 'Atribut KPI tidak ditemukan.' });
      }

      const usedRow = await db.get(
        `SELECT COUNT(*) as cnt FROM kpi_attribute_assignments WHERE attribute_id = ?`,
        attrId
      );
      if (usedRow && Number(usedRow.cnt) > 0) {
        return sendJson(res, 409, {
          error: `Atribut "${existing.name}" sedang digunakan oleh ${usedRow.cnt} KPI aktif. Lepaskan atribut dari KPI terkait terlebih dahulu sebelum menghapus.`
        });
      }

      await db.run(`DELETE FROM kpi_attributes WHERE id = ?`, attrId);

      return sendJson(res, 200, {
        message: `Atribut "${existing.name}" berhasil dihapus.`,
        attributes: await getAllAttributes()
      });
    }

    // =========================================================================
    // 6B. CRUD MASTER DEPARTEMEN (/api/departments — CPMD Admin)
    // =========================================================================
    if (pathname === '/api/departments' && method === 'GET') {
      const departments = await db.all(
        `SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`
      );
      return sendJson(res, 200, { departments });
    }

    if (pathname === '/api/departments' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { code, name, leader_name, description = '' } = body;

      if (!code || !code.trim() || !name || !name.trim() || !leader_name || !leader_name.trim()) {
        return sendJson(res, 400, {
          error: 'Kode Divisi, Nama Departemen, dan Nama Division Leader wajib diisi.'
        });
      }

      const normCode = code.trim().toUpperCase();
      const dup = await db.get(
        `SELECT id FROM departments WHERE UPPER(code) = UPPER(?)`,
        normCode
      );
      if (dup) {
        return sendJson(res, 409, { error: `Kode departemen "${normCode}" sudah terdaftar.` });
      }

      const deptId = `dept-${Date.now()}`;
      await db.run(
        `INSERT INTO departments (id, code, name, leader_name, description, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        deptId,
        normCode,
        name.trim(),
        leader_name.trim(),
        description.trim()
      );

      const departments = await db.all(
        `SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`
      );

      return sendJson(res, 201, {
        message: `Departemen "${normCode} — ${name.trim()}" berhasil ditambahkan.`,
        departments
      });
    }

    if (pathname.startsWith('/api/departments/') && method === 'PUT') {
      const deptId = pathname.replace('/api/departments/', '');
      const existing = await db.get(`SELECT * FROM departments WHERE id = ?`, deptId);
      if (!existing) {
        return sendJson(res, 404, { error: 'Departemen tidak ditemukan.' });
      }

      const body = await parseJsonBody(req);
      const nextCode = body.code && body.code.trim() ? body.code.trim().toUpperCase() : existing.code;
      const nextName = body.name && body.name.trim() ? body.name.trim() : existing.name;
      const nextLeader =
        body.leader_name && body.leader_name.trim()
          ? body.leader_name.trim()
          : existing.leader_name;
      const nextDesc =
        body.description !== undefined ? body.description.trim() : existing.description || '';

      const dup = await db.get(
        `SELECT id FROM departments WHERE UPPER(code) = UPPER(?) AND id != ?`,
        nextCode,
        deptId
      );
      if (dup) {
        return sendJson(res, 409, {
          error: `Kode departemen "${nextCode}" sudah digunakan departemen lain.`
        });
      }

      await db.run(
        `UPDATE departments
         SET code = ?, name = ?, leader_name = ?, description = ?
         WHERE id = ?`,
        nextCode,
        nextName,
        nextLeader,
        nextDesc,
        deptId
      );

      const departments = await db.all(
        `SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`
      );

      return sendJson(res, 200, {
        message: `Departemen "${nextCode} — ${nextName}" berhasil diperbarui di seluruh sistem.`,
        departments
      });
    }

    if (pathname.startsWith('/api/departments/') && method === 'DELETE') {
      const deptId = pathname.replace('/api/departments/', '');
      const existing = await db.get(`SELECT * FROM departments WHERE id = ?`, deptId);
      if (!existing) {
        return sendJson(res, 404, { error: 'Departemen tidak ditemukan.' });
      }

      const kpiCount = await db.get(
        `SELECT COUNT(*) as cnt FROM kpi_dictionary WHERE department_id = ?`,
        deptId
      );
      if (kpiCount && Number(kpiCount.cnt) > 0) {
        return sendJson(res, 409, {
          error: `Departemen "${existing.code}" masih memiliki ${kpiCount.cnt} KPI aktif. Pindahkan atau hapus KPI tersebut terlebih dahulu.`
        });
      }

      await db.run(`DELETE FROM departments WHERE id = ?`, deptId);
      const departments = await db.all(
        `SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`
      );

      return sendJson(res, 200, {
        message: `Departemen "${existing.code} — ${existing.name}" berhasil dihapus.`,
        departments
      });
    }

    // =========================================================================
    // 7. CRUD KAMUS KPI (/api/kpis)
    // =========================================================================
    if (pathname === '/api/kpis' && method === 'POST') {
      const body = await parseJsonBody(req);
      const {
        department_id,
        code,
        title,
        unit = '%',
        weight = 20,
        polarity = 'MAXIMIZE',
        ytd_method = 'SUM',
        red_threshold = 85,
        yellow_threshold = 100,
        cap_score = 120,
        baseline_target = 100,
        attributeIds = []
      } = body;

      if (!department_id || !code || !title) {
        return sendJson(res, 400, {
          error: 'Departemen, Kode KPI, dan Nama KPI wajib diisi.'
        });
      }
      if (!ALLOWED_POLARITIES.has(polarity) || !ALLOWED_YTD_METHODS.has(ytd_method)) {
        return sendJson(res, 400, {
          error: 'Nilai Polaritas atau Metode YTD tidak valid.'
        });
      }
      if (!Number.isFinite(Number(weight)) || Number(weight) <= 0 || Number(weight) > 100) {
        return sendJson(res, 400, {
          error: 'Bobot KPI harus berupa angka antara 0.5% hingga 100%.'
        });
      }

      const dup = await db.get(
        `SELECT id FROM kpi_dictionary WHERE UPPER(code) = UPPER(?)`,
        code.trim()
      );
      if (dup) {
        return sendJson(res, 409, { error: `Kode KPI "${code.trim()}" sudah terdaftar.` });
      }

      const kpiId = `kpi-${Date.now()}`;
      await db.run(
        `INSERT INTO kpi_dictionary (
          id, department_id, code, title, unit, weight, polarity, ytd_method,
          red_threshold, yellow_threshold, cap_score, baseline_target, fiscal_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2026)`,
        kpiId,
        department_id,
        code.trim().toUpperCase(),
        title.trim(),
        unit.trim(),
        Number(weight),
        polarity,
        ytd_method,
        Number(red_threshold),
        Number(yellow_threshold),
        Number(cap_score),
        Number(baseline_target)
      );

      for (const attrId of attributeIds) {
        await db.run(
          `INSERT OR IGNORE INTO kpi_attribute_assignments (kpi_id, attribute_id) VALUES (?, ?)`,
          kpiId,
          attrId
        );
      }

      // Initialize 12 monthly target records for 2026
      for (let m = 1; m <= 12; m++) {
        await db.run(
          `INSERT INTO kpi_monthly_records (
            id, kpi_id, period_year, period_month, target_value, actual_value, status_color
          ) VALUES (?, ?, 2026, ?, ?, NULL, 'UNREPORTED')`,
          `rec-${kpiId}-2026-${m}`,
          kpiId,
          m,
          Number(baseline_target)
        );
      }

      return sendJson(res, 201, {
        message: `KPI "${code.trim().toUpperCase()} - ${title.trim()}" berhasil ditambahkan ke Kamus KPI.`
      });
    }

    if (pathname.startsWith('/api/kpis/') && method === 'PUT') {
      const kpiId = pathname.replace('/api/kpis/', '');
      const body = await parseJsonBody(req);
      const existing = await db.get(`SELECT * FROM kpi_dictionary WHERE id = ?`, kpiId);
      if (!existing) {
        return sendJson(res, 404, { error: 'KPI tidak ditemukan.' });
      }

      const {
        code = existing.code,
        title = existing.title,
        unit = existing.unit,
        weight = existing.weight,
        polarity = existing.polarity,
        ytd_method = existing.ytd_method,
        red_threshold = existing.red_threshold,
        yellow_threshold = existing.yellow_threshold,
        cap_score = existing.cap_score,
        baseline_target = existing.baseline_target,
        attributeIds
      } = body;

      await db.run(
        `UPDATE kpi_dictionary
         SET code = ?, title = ?, unit = ?, weight = ?, polarity = ?, ytd_method = ?,
             red_threshold = ?, yellow_threshold = ?, cap_score = ?, baseline_target = ?
         WHERE id = ?`,
        code.trim().toUpperCase(),
        title.trim(),
        unit.trim(),
        Number(weight),
        polarity,
        ytd_method,
        Number(red_threshold),
        Number(yellow_threshold),
        Number(cap_score),
        Number(baseline_target),
        kpiId
      );

      if (Array.isArray(attributeIds)) {
        await db.run(`DELETE FROM kpi_attribute_assignments WHERE kpi_id = ?`, kpiId);
        for (const attrId of attributeIds) {
          await db.run(
            `INSERT OR IGNORE INTO kpi_attribute_assignments (kpi_id, attribute_id) VALUES (?, ?)`,
            kpiId,
            attrId
          );
        }
      }

      // Recalculate existing monthly records with updated weight/polarity/thresholds
      const records = await db.all(
        `SELECT * FROM kpi_monthly_records WHERE kpi_id = ?`,
        kpiId
      );
      for (const r of records) {
        if (r.actual_value !== null && r.actual_value !== undefined) {
          const ach = calculateAchievementPct(
            r.target_value,
            r.actual_value,
            polarity,
            Number(cap_score)
          );
          const wScore = calculateWeightedScore(ach, Number(weight));
          const st = classifyStatusColor(ach, Number(red_threshold), Number(yellow_threshold));
          await db.run(
            `UPDATE kpi_monthly_records
             SET achievement_pct = ?, weighted_score = ?, status_color = ?
             WHERE id = ?`,
            ach,
            wScore,
            st,
            r.id
          );
        }
      }

      return sendJson(res, 200, {
        message: `Konfigurasi KPI "${code}" berhasil diperbarui dan skor histori telah direkalkulasi.`
      });
    }

    if (pathname.startsWith('/api/kpis/') && method === 'DELETE') {
      const kpiId = pathname.replace('/api/kpis/', '');
      const existing = await db.get(`SELECT * FROM kpi_dictionary WHERE id = ?`, kpiId);
      if (!existing) {
        return sendJson(res, 404, { error: 'KPI tidak ditemukan.' });
      }
      await db.run(`DELETE FROM kpi_dictionary WHERE id = ?`, kpiId);
      return sendJson(res, 200, {
        message: `KPI "${existing.code}" berhasil dihapus dari Kamus KPI.`
      });
    }

    // =========================================================================
    // 8. GET /api/export/backup (Standalone Database Snapshot Export)
    // =========================================================================
    if (pathname === '/api/export/backup' && method === 'GET') {
      const [departments, attributes, kpis] = await Promise.all([
        db.all(`SELECT * FROM departments`),
        getAllAttributes(),
        getEnrichedKpis({ year: 2026, month: 11 })
      ]);
      const snapshot = {
        exportedAt: new Date().toISOString(),
        system: 'RAHMA Standalone KPI System - PT Global Service Indonesia',
        departments,
        attributes,
        kpis
      };
      return sendJson(res, 200, snapshot);
    }

    // =========================================================================
    // STATIC FILES (PUBLIC FRONTEND)
    // =========================================================================
    let filePath = pathname;
    if (pathname === '/' || pathname === '/home' || pathname === '/promo') {
      filePath = '/home.html';
    } else if (pathname === '/app' || pathname === '/dashboard') {
      filePath = '/index.html';
    } else if (pathname === '/login') {
      filePath = '/login.html';
    } else if (pathname === '/signup' || pathname === '/register') {
      filePath = '/signup.html';
    }
    const resolvedPath = path.normalize(path.join(PUBLIC_DIR, filePath));
    if (!resolvedPath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(resolvedPath)) {
      const stat = fs.statSync(resolvedPath);
      if (stat.isFile()) {
        const ext = path.extname(resolvedPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
        const cacheControl = IMMUTABLE_ASSET_EXTS.has(ext)
          ? 'public, max-age=86400'
          : 'public, max-age=0, must-revalidate';

        applySecurityHeaders(res);

        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl });
          return res.end();
        }

        const acceptEncoding = String(req.headers['accept-encoding'] || '');
        const shouldGzip =
          COMPRESSIBLE_EXTS.has(ext) && stat.size > 1024 && acceptEncoding.includes('gzip');

        if (shouldGzip) {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Encoding': 'gzip',
            'Vary': 'Accept-Encoding',
            'Cache-Control': cacheControl,
            ETag: etag
          });
          return fs.createReadStream(resolvedPath).pipe(zlib.createGzip()).pipe(res);
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Cache-Control': cacheControl,
          ETag: etag
        });
        return fs.createReadStream(resolvedPath).pipe(res);
      }
    }

    applySecurityHeaders(res);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    if (err && err.message === 'Payload too large') {
      return sendJson(res, 413, { error: 'Ukuran payload melebihi batas maksimum (2 MB).' });
    }
    if (err && err.message === 'Invalid JSON payload') {
      return sendJson(res, 400, { error: 'Format payload JSON tidak valid.' });
    }
    console.error('[RAHMA Server Error]', err);
    sendJson(res, 500, {
      error: 'Terjadi kesalahan internal pada server. Silakan coba beberapa saat lagi.'
    });
  }
});

if (require.main === module) {
  initDatabase()
    .then(() => {
      server.listen(PORT, () => {
        const pgHost = db.pgConfig.host || '127.0.0.1';
        const pgPort = db.pgConfig.port || 5432;
        const pgDb = db.pgConfig.database || 'rahma_kpi';
        console.log(`====================================================================`);
        console.log(`🚀 RAHMA Standalone KPI System (PT Global Service Indonesia) Active`);
        console.log(`🔗 URL Aplikasi : http://localhost:${PORT}`);
        console.log(`🐘 Database     : PostgreSQL (${pgHost}:${pgPort}/${pgDb})`);
        console.log(`====================================================================`);
      });
    })
    .catch((err) => {
      console.error('❌ Failed to initialize PostgreSQL database:', err);
      process.exit(1);
    });
}

module.exports = { server };
