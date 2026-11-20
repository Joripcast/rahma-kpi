/**
 * RAHMA Standalone SaaS Server (Zero External Framework Dependencies)
 * PT Global Service Indonesia (GSI)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const {
  db,
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

const PORT = Number(process.env.PORT || 3456);
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_SECRET =
  process.env.RAHMA_SESSION_SECRET ||
  crypto.createHash('sha256').update(__dirname + ':rahma-gsi-2026').digest('hex');
const SESSION_COOKIE = 'rahma_session';
const otpStore = new Map(); // key: `${userId}:${purpose}` -> { code, targetEmail, expiresAt }

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const map = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      map[k] = decodeURIComponent(v);
    }
  }
  return map;
}

function createSessionToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      role: user.role,
      department_id: user.department_id,
      exp: Date.now() + 8 * 60 * 60 * 1000 // 8 hours
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function getAuthenticatedUser(req) {
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
    const dbUser = db
      .prepare(
        `SELECT u.id, u.department_id, u.name, u.email, u.role, u.title,
                d.code as department_code, d.name as department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.id = ?`
      )
      .get(parsed.id);
    return dbUser || null;
  } catch {
    return null;
  }
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
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
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // =========================================================================
    // 0. REAL AUTHENTICATION & SESSION ENDPOINTS (/api/auth/*)
    // =========================================================================
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const user = authenticateUser(body.email, body.password);
      if (!user) {
        return sendJson(res, 401, {
          error: 'Email atau kata sandi tidak valid. Silakan periksa kembali kredensial Anda.'
        });
      }
      const token = createSessionToken(user);
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
      const currentUser = getAuthenticatedUser(req);
      if (!currentUser) {
        return sendJson(res, 200, { authenticated: false, user: null });
      }
      return sendJson(res, 200, { authenticated: true, user: currentUser });
    }

    if (pathname === '/api/auth/departments' && method === 'GET') {
      const departments = db
        .prepare(`SELECT id, code, name FROM departments WHERE is_active = 1 ORDER BY code ASC`)
        .all();
      return sendJson(res, 200, { departments });
    }

    if (pathname === '/api/auth/signup' && method === 'POST') {
      const body = await parseJsonBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const title = String(body.title || '').trim();
      const role = body.role === 'EXECUTIVE' ? 'EXECUTIVE' : 'DIV_LEADER';
      const departmentId = role === 'DIV_LEADER' ? String(body.departmentId || '').trim() : null;

      if (name.length < 2) {
        return sendJson(res, 400, { error: 'Nama lengkap minimal 2 karakter.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return sendJson(res, 400, { error: 'Format email korporasi tidak valid.' });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: 'Kata sandi minimal 6 karakter.' });
      }
      if (role === 'DIV_LEADER') {
        const dept = db
          .prepare(`SELECT id FROM departments WHERE id = ? AND is_active = 1`)
          .get(departmentId);
        if (!dept) {
          return sendJson(res, 400, { error: 'Silakan pilih departemen yang valid untuk Division Leader.' });
        }
      }

      const existing = db
        .prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`)
        .get(email);
      if (existing) {
        return sendJson(res, 409, { error: `Email "${email}" sudah terdaftar. Silakan masuk.` });
      }

      const userId = `user-${Date.now()}`;
      db.prepare(
        `INSERT INTO users (id, department_id, name, email, role, title, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        departmentId,
        name,
        email,
        role,
        title || (role === 'EXECUTIVE' ? 'Executive / BOD' : 'Division Leader'),
        hashPassword(password)
      );

      const newUser = db
        .prepare(
          `SELECT u.id, u.department_id, u.name, u.email, u.role, u.title,
                  d.code as department_code, d.name as department_name
           FROM users u
           LEFT JOIN departments d ON d.id = u.department_id
           WHERE u.id = ?`
        )
        .get(userId);
      const token = createSessionToken(newUser);

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
      authUser = getAuthenticatedUser(req);
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
      db.prepare(`UPDATE users SET name = ?, title = ? WHERE id = ?`).run(
        nextName,
        nextTitle || authUser.title || '',
        authUser.id
      );
      const updatedUser = getAuthenticatedUser(req);
      return sendJson(res, 200, {
        message: 'Profil akun berhasil diperbarui.',
        user: updatedUser
      });
    }

    if (pathname === '/api/auth/otp/request' && method === 'POST') {
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
        const conflict = db
          .prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?`)
          .get(targetEmail, authUser.id);
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
        expiresAt: Date.now() + 5 * 60 * 1000
      });

      console.log(`[RAHMA Email OTP] To: ${targetEmail} | Purpose: ${purpose} | Code: ${code}`);
      return sendJson(res, 200, {
        message: `Kode OTP 6-digit telah dikirim ke ${targetEmail} (berlaku 5 menit).`,
        targetEmail,
        expiresInSeconds: 300,
        devOtpPreview: code
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

      const dbRow = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(authUser.id);
      if (!dbRow || !verifyPassword(currentPassword, dbRow.password_hash)) {
        return sendJson(res, 401, { error: 'Kata sandi saat ini salah.' });
      }

      const record = otpStore.get(`${authUser.id}:email`);
      if (!record || Date.now() > record.expiresAt) {
        return sendJson(res, 400, { error: 'Kode OTP tidak ditemukan atau sudah kedaluwarsa.' });
      }
      if (record.code !== otpCode || record.targetEmail !== newEmail) {
        return sendJson(res, 400, { error: 'Kode OTP tidak cocok dengan email baru.' });
      }

      const conflict = db
        .prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?`)
        .get(newEmail, authUser.id);
      if (conflict) {
        return sendJson(res, 409, { error: `Email "${newEmail}" sudah terdaftar.` });
      }

      db.prepare(`UPDATE users SET email = ? WHERE id = ?`).run(newEmail, authUser.id);
      otpStore.delete(`${authUser.id}:email`);
      const updatedUser = getAuthenticatedUser(req);
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

      const dbRow = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(authUser.id);
      if (!dbRow || !verifyPassword(currentPassword, dbRow.password_hash)) {
        return sendJson(res, 401, { error: 'Kata sandi saat ini tidak sesuai.' });
      }

      if (newPassword.length < 6) {
        return sendJson(res, 400, { error: 'Kata sandi baru minimal 6 karakter.' });
      }

      const record = otpStore.get(`${authUser.id}:password`);
      if (!record || Date.now() > record.expiresAt) {
        return sendJson(res, 400, { error: 'Kode OTP tidak ditemukan atau sudah kedaluwarsa.' });
      }
      if (record.code !== otpCode) {
        return sendJson(res, 400, { error: 'Kode OTP salah.' });
      }

      db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
        hashPassword(newPassword),
        authUser.id
      );
      otpStore.delete(`${authUser.id}:password`);
      return sendJson(res, 200, {
        message: 'Kata sandi berhasil diperbarui. Gunakan kata sandi baru pada login berikutnya.'
      });
    }

    // =========================================================================
    // 1. GET /api/bootstrap
    // =========================================================================
    if (pathname === '/api/bootstrap' && method === 'GET') {
      const departments = db
        .prepare(`SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`)
        .all();
      const attributes = getAllAttributes();

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
      const summary = getDashboardSummary({ year, month, mode });
      return sendJson(res, 200, summary);
    }

    // =========================================================================
    // 3. GET /api/kpis
    // =========================================================================
    if (pathname === '/api/kpis' && method === 'GET') {
      const departmentId = parsedUrl.searchParams.get('departmentId') || 'ALL';
      const year = Number(parsedUrl.searchParams.get('year') || 2026);
      const month = Number(parsedUrl.searchParams.get('month') || 11);
      const kpis = getEnrichedKpis({ departmentId, year, month });
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
        mitigationTagIds = [],
        isDraft = false
      } = body;
      const updatedBy = authUser.name;

      const kpi = db.prepare(`SELECT * FROM kpi_dictionary WHERE id = ?`).get(kpiId);
      if (!kpi) {
        return sendJson(res, 404, { error: 'KPI tidak ditemukan di dalam Kamus KPI.' });
      }

      if (authUser.role === 'DIV_LEADER' && kpi.department_id !== authUser.department_id) {
        return sendJson(res, 403, {
          error: `Akses ditolak (RBAC 403): Anda hanya diizinkan menginput KPI milik departemen Anda sendiri (${authUser.department_code || 'Divisi Anda'}).`
        });
      }

      const existing = db
        .prepare(
          `SELECT * FROM kpi_monthly_records WHERE kpi_id = ? AND period_year = ? AND period_month = ?`
        )
        .get(kpiId, Number(year), Number(month));

      if (existing && existing.is_locked) {
        return sendJson(res, 423, {
          error: 'Periode pelaporan untuk KPI ini telah dikunci oleh Divisi CPMD.'
        });
      }

      const effectiveTarget =
        targetValue !== undefined && targetValue !== null && targetValue !== ''
          ? Number(targetValue)
          : existing
            ? Number(existing.target_value)
            : Number(kpi.baseline_target);

      const hasActual =
        actualValue !== undefined && actualValue !== null && actualValue !== '';
      const numericActual = hasActual ? Number(actualValue) : null;

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

      // MANDATORY MITIGATION LOGIC GATE
      const gateResult = validateMitigationGate({
        statusColor,
        problemIdentification,
        correctiveAction,
        needSupport,
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
        db.prepare(
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
               is_draft = ?,
               updated_by = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(
          effectiveTarget,
          numericActual,
          achievementPct,
          weightedScore,
          statusColor,
          problemIdentification.trim(),
          correctiveAction.trim(),
          needSupport.trim(),
          tagsJson,
          isDraft ? 1 : 0,
          updatedBy,
          existing.id
        );
      } else {
        const recId = `rec-${kpiId}-${year}-${month}`;
        db.prepare(
          `INSERT INTO kpi_monthly_records (
            id, kpi_id, period_year, period_month, target_value, actual_value,
            achievement_pct, weighted_score, status_color,
            problem_identification, corrective_action, need_support, mitigation_tags,
            is_draft, is_locked, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
        ).run(
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
          isDraft ? 1 : 0,
          updatedBy
        );
      }

      const updatedKpi = getEnrichedKpis({
        departmentId: kpi.department_id,
        year: Number(year),
        month: Number(month)
      }).find((item) => item.id === kpiId);

      return sendJson(res, 200, {
        message: isDraft
          ? 'Draft realisasi KPI berhasil disimpan otomatis.'
          : 'Laporan realisasi KPI berhasil disubmit.',
        kpi: updatedKpi
      });
    }

    // =========================================================================
    // 5. POST /api/records/lock (CPMD Lock / Unlock Period)
    // =========================================================================
    if (pathname === '/api/records/lock' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { departmentId = 'ALL', year = 2026, month = 11, locked = true } = body;

      if (departmentId === 'ALL') {
        db.prepare(
          `UPDATE kpi_monthly_records SET is_locked = ? WHERE period_year = ? AND period_month = ?`
        ).run(locked ? 1 : 0, Number(year), Number(month));
      } else {
        db.prepare(
          `UPDATE kpi_monthly_records
           SET is_locked = ?
           WHERE period_year = ? AND period_month = ?
             AND kpi_id IN (SELECT id FROM kpi_dictionary WHERE department_id = ?)`
        ).run(locked ? 1 : 0, Number(year), Number(month), departmentId);
      }

      return sendJson(res, 200, {
        message: locked
          ? 'Periode pelaporan berhasil dikunci oleh CPMD.'
          : 'Kunci periode pelaporan berhasil dibuka kembali.'
      });
    }

    // =========================================================================
    // 6. CRUD KPI ATTRIBUTES & HEX COLOR-CODED ACCENTS (/api/attributes)
    // =========================================================================
    if (pathname === '/api/attributes' && method === 'GET') {
      return sendJson(res, 200, { attributes: getAllAttributes() });
    }

    if (pathname === '/api/attributes' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { name, attribute_group = 'CATEGORY', hex_color, description = '' } = body;

      if (!name || !name.trim()) {
        return sendJson(res, 400, { error: 'Nama atribut KPI wajib diisi.' });
      }

      const validHex = normalizeHexColor(hex_color);
      if (!validHex) {
        return sendJson(res, 400, {
          error: 'Format warna aksen tidak valid. Gunakan format kode HEX 6-digit (#RRGGBB), contoh: #2563EB.'
        });
      }

      const duplicate = db
        .prepare(`SELECT id FROM kpi_attributes WHERE LOWER(name) = LOWER(?)`)
        .get(name.trim());
      if (duplicate) {
        return sendJson(res, 409, { error: `Atribut dengan nama "${name.trim()}" sudah terdaftar.` });
      }

      const id = `attr-${Date.now()}`;
      db.prepare(
        `INSERT INTO kpi_attributes (id, attribute_group, name, hex_color, description)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, attribute_group, name.trim(), validHex, description.trim());

      return sendJson(res, 201, {
        message: `Atribut "${name.trim()}" (${validHex}) berhasil ditambahkan.`,
        attributes: getAllAttributes()
      });
    }

    if (pathname.startsWith('/api/attributes/') && method === 'PUT') {
      const attrId = pathname.replace('/api/attributes/', '');
      const body = await parseJsonBody(req);
      const { name, attribute_group, hex_color, description } = body;

      const existing = db.prepare(`SELECT * FROM kpi_attributes WHERE id = ?`).get(attrId);
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
      const duplicate = db
        .prepare(`SELECT id FROM kpi_attributes WHERE LOWER(name) = LOWER(?) AND id != ?`)
        .get(nextName, attrId);
      if (duplicate) {
        return sendJson(res, 409, { error: `Nama atribut "${nextName}" sudah digunakan atribut lain.` });
      }

      db.prepare(
        `UPDATE kpi_attributes
         SET name = ?,
             attribute_group = ?,
             hex_color = ?,
             description = ?
         WHERE id = ?`
      ).run(
        nextName,
        attribute_group || existing.attribute_group,
        validHex,
        description !== undefined ? description.trim() : existing.description,
        attrId
      );

      return sendJson(res, 200, {
        message: `Atribut "${nextName}" (${validHex}) berhasil diperbarui di seluruh sistem.`,
        attributes: getAllAttributes()
      });
    }

    if (pathname.startsWith('/api/attributes/') && method === 'DELETE') {
      const attrId = pathname.replace('/api/attributes/', '');
      const existing = db.prepare(`SELECT * FROM kpi_attributes WHERE id = ?`).get(attrId);
      if (!existing) {
        return sendJson(res, 404, { error: 'Atribut KPI tidak ditemukan.' });
      }

      db.prepare(`DELETE FROM kpi_attribute_assignments WHERE attribute_id = ?`).run(attrId);
      db.prepare(`DELETE FROM kpi_attributes WHERE id = ?`).run(attrId);

      return sendJson(res, 200, {
        message: `Atribut "${existing.name}" berhasil dihapus.`,
        attributes: getAllAttributes()
      });
    }

    // =========================================================================
    // 6B. CRUD MASTER DEPARTEMEN (/api/departments — CPMD Admin)
    // =========================================================================
    if (pathname === '/api/departments' && method === 'GET') {
      const departments = db
        .prepare(`SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`)
        .all();
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
      const dup = db
        .prepare(`SELECT id FROM departments WHERE UPPER(code) = UPPER(?)`)
        .get(normCode);
      if (dup) {
        return sendJson(res, 409, { error: `Kode departemen "${normCode}" sudah terdaftar.` });
      }

      const deptId = `dept-${Date.now()}`;
      db.prepare(
        `INSERT INTO departments (id, code, name, leader_name, description, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`
      ).run(deptId, normCode, name.trim(), leader_name.trim(), description.trim());

      const departments = db
        .prepare(`SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`)
        .all();

      return sendJson(res, 201, {
        message: `Departemen "${normCode} — ${name.trim()}" berhasil ditambahkan.`,
        departments
      });
    }

    if (pathname.startsWith('/api/departments/') && method === 'PUT') {
      const deptId = pathname.replace('/api/departments/', '');
      const existing = db.prepare(`SELECT * FROM departments WHERE id = ?`).get(deptId);
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

      const dup = db
        .prepare(`SELECT id FROM departments WHERE UPPER(code) = UPPER(?) AND id != ?`)
        .get(nextCode, deptId);
      if (dup) {
        return sendJson(res, 409, {
          error: `Kode departemen "${nextCode}" sudah digunakan departemen lain.`
        });
      }

      db.prepare(
        `UPDATE departments
         SET code = ?, name = ?, leader_name = ?, description = ?
         WHERE id = ?`
      ).run(nextCode, nextName, nextLeader, nextDesc, deptId);

      const departments = db
        .prepare(`SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`)
        .all();

      return sendJson(res, 200, {
        message: `Departemen "${nextCode} — ${nextName}" berhasil diperbarui di seluruh sistem.`,
        departments
      });
    }

    if (pathname.startsWith('/api/departments/') && method === 'DELETE') {
      const deptId = pathname.replace('/api/departments/', '');
      const existing = db.prepare(`SELECT * FROM departments WHERE id = ?`).get(deptId);
      if (!existing) {
        return sendJson(res, 404, { error: 'Departemen tidak ditemukan.' });
      }

      const kpiCount = db
        .prepare(`SELECT COUNT(*) as cnt FROM kpi_dictionary WHERE department_id = ?`)
        .get(deptId);
      if (kpiCount && kpiCount.cnt > 0) {
        return sendJson(res, 409, {
          error: `Departemen "${existing.code}" masih memiliki ${kpiCount.cnt} KPI aktif. Pindahkan atau hapus KPI tersebut terlebih dahulu.`
        });
      }

      db.prepare(`DELETE FROM departments WHERE id = ?`).run(deptId);
      const departments = db
        .prepare(`SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`)
        .all();

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

      const dup = db
        .prepare(`SELECT id FROM kpi_dictionary WHERE UPPER(code) = UPPER(?)`)
        .get(code.trim());
      if (dup) {
        return sendJson(res, 409, { error: `Kode KPI "${code.trim()}" sudah terdaftar.` });
      }

      const kpiId = `kpi-${Date.now()}`;
      db.prepare(
        `INSERT INTO kpi_dictionary (
          id, department_id, code, title, unit, weight, polarity, ytd_method,
          red_threshold, yellow_threshold, cap_score, baseline_target, fiscal_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2026)`
      ).run(
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

      const insertAssign = db.prepare(
        `INSERT OR IGNORE INTO kpi_attribute_assignments (kpi_id, attribute_id) VALUES (?, ?)`
      );
      for (const attrId of attributeIds) {
        insertAssign.run(kpiId, attrId);
      }

      // Initialize 12 monthly target records for 2026
      const insertRec = db.prepare(
        `INSERT INTO kpi_monthly_records (
          id, kpi_id, period_year, period_month, target_value, actual_value, status_color
        ) VALUES (?, ?, 2026, ?, ?, NULL, 'UNREPORTED')`
      );
      for (let m = 1; m <= 12; m++) {
        insertRec.run(`rec-${kpiId}-2026-${m}`, kpiId, m, Number(baseline_target));
      }

      return sendJson(res, 201, {
        message: `KPI "${code.trim().toUpperCase()} - ${title.trim()}" berhasil ditambahkan ke Kamus KPI.`
      });
    }

    if (pathname.startsWith('/api/kpis/') && method === 'PUT') {
      const kpiId = pathname.replace('/api/kpis/', '');
      const body = await parseJsonBody(req);
      const existing = db.prepare(`SELECT * FROM kpi_dictionary WHERE id = ?`).get(kpiId);
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

      db.prepare(
        `UPDATE kpi_dictionary
         SET code = ?, title = ?, unit = ?, weight = ?, polarity = ?, ytd_method = ?,
             red_threshold = ?, yellow_threshold = ?, cap_score = ?, baseline_target = ?
         WHERE id = ?`
      ).run(
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
        db.prepare(`DELETE FROM kpi_attribute_assignments WHERE kpi_id = ?`).run(kpiId);
        const insertAssign = db.prepare(
          `INSERT OR IGNORE INTO kpi_attribute_assignments (kpi_id, attribute_id) VALUES (?, ?)`
        );
        for (const attrId of attributeIds) {
          insertAssign.run(kpiId, attrId);
        }
      }

      // Recalculate existing monthly records with updated weight/polarity/thresholds
      const records = db
        .prepare(`SELECT * FROM kpi_monthly_records WHERE kpi_id = ?`)
        .all(kpiId);
      const updateRec = db.prepare(
        `UPDATE kpi_monthly_records
         SET achievement_pct = ?, weighted_score = ?, status_color = ?
         WHERE id = ?`
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
          updateRec.run(ach, wScore, st, r.id);
        }
      }

      return sendJson(res, 200, {
        message: `Konfigurasi KPI "${code}" berhasil diperbarui dan skor histori telah direkalkulasi.`
      });
    }

    if (pathname.startsWith('/api/kpis/') && method === 'DELETE') {
      const kpiId = pathname.replace('/api/kpis/', '');
      const existing = db.prepare(`SELECT * FROM kpi_dictionary WHERE id = ?`).get(kpiId);
      if (!existing) {
        return sendJson(res, 404, { error: 'KPI tidak ditemukan.' });
      }
      db.prepare(`DELETE FROM kpi_dictionary WHERE id = ?`).run(kpiId);
      return sendJson(res, 200, {
        message: `KPI "${existing.code}" berhasil dihapus dari Kamus KPI.`
      });
    }

    // =========================================================================
    // 8. GET /api/export/backup (Standalone Database Snapshot Export)
    // =========================================================================
    if (pathname === '/api/export/backup' && method === 'GET') {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        system: 'RAHMA Standalone KPI System - PT Global Service Indonesia',
        departments: db.prepare(`SELECT * FROM departments`).all(),
        attributes: getAllAttributes(),
        kpis: getEnrichedKpis({ year: 2026, month: 11 })
      };
      return sendJson(res, 200, snapshot);
    }

    // =========================================================================
    // STATIC FILES (PUBLIC FRONTEND)
    // =========================================================================
    let filePath = pathname === '/' ? '/index.html' : pathname;
    if (pathname === '/home' || pathname === '/promo') {
      filePath = '/home.html';
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

    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      const ext = path.extname(resolvedPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      return fs.createReadStream(resolvedPath).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    console.error('[RAHMA Server Error]', err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`====================================================================`);
    console.log(`🚀 RAHMA Standalone KPI System (PT Global Service Indonesia) Active`);
    console.log(`🔗 URL Aplikasi : http://localhost:${PORT}`);
    console.log(`🗄️  Database     : Standalone SQLite (data/rahma.sqlite)`);
    console.log(`====================================================================`);
  });
}

module.exports = { server };
