/**
 * RAHMA Relational Database Layer (PostgreSQL via node-postgres `pg`)
 * PT Global Service Indonesia (GSI)
 */

const crypto = require('node:crypto');
const { Pool, Client, types } = require('pg');
const {
  normalizeHexColor,
  computeHexAccentMeta,
  calculateAchievementPct,
  calculateWeightedScore,
  classifyStatusColor,
  calculateYtdMetrics
} = require('./engine');

// Parse PostgreSQL BIGINT (COUNT(*), OID 20) and NUMERIC (OID 1700) into native JS Numbers
types.setTypeParser(20, (val) => (val === null ? null : Number(val)));
types.setTypeParser(1700, (val) => (val === null ? null : Number(val)));

const PG_CONFIG = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || '127.0.0.1',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password:
        process.env.PGPASSWORD && process.env.PGPASSWORD !== 'NULL'
          ? process.env.PGPASSWORD
          : undefined,
      database: process.env.PGDATABASE || 'rahma_kpi',
      max: 15,
      idleTimeoutMillis: 30000
    };

const pool = new Pool(PG_CONFIG);

function normalizeSqlForPg(sql) {
  let index = 0;
  let converted = sql.replace(
    /INSERT\s+OR\s+IGNORE\s+INTO\s+kpi_attribute_assignments\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi,
    'INSERT INTO kpi_attribute_assignments ($1) VALUES ($2) ON CONFLICT (kpi_id, attribute_id) DO NOTHING'
  );
  converted = converted.replace(/\?/g, () => `$${++index}`);
  return converted;
}

const db = {
  pool,
  pgConfig: PG_CONFIG,
  async query(sql, params = []) {
    return pool.query(normalizeSqlForPg(sql), params);
  },
  async all(sql, ...params) {
    const flatParams =
      params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const res = await pool.query(normalizeSqlForPg(sql), flatParams);
    return res.rows;
  },
  async get(sql, ...params) {
    const flatParams =
      params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const res = await pool.query(normalizeSqlForPg(sql), flatParams);
    return res.rows[0] || null;
  },
  async run(sql, ...params) {
    const flatParams =
      params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const res = await pool.query(normalizeSqlForPg(sql), flatParams);
    return { rowCount: res.rowCount, rows: res.rows };
  }
};

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plainPassword), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(String(plainPassword), salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

async function ensureDatabaseExists() {
  if (process.env.DATABASE_URL) return;
  const adminClient = new Client({
    ...PG_CONFIG,
    database: 'postgres'
  });
  try {
    await adminClient.connect();
    const res = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [PG_CONFIG.database]
    );
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${PG_CONFIG.database}"`);
    }
  } finally {
    await adminClient.end().catch(() => {});
  }
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      leader_name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP::TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      title TEXT,
      password_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS kpi_attributes (
      id TEXT PRIMARY KEY,
      attribute_group TEXT NOT NULL,
      name TEXT UNIQUE NOT NULL,
      hex_color TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP::TEXT
    );

    CREATE TABLE IF NOT EXISTS kpi_dictionary (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      unit TEXT NOT NULL,
      weight DOUBLE PRECISION NOT NULL,
      polarity TEXT NOT NULL DEFAULT 'MAXIMIZE',
      ytd_method TEXT NOT NULL DEFAULT 'SUM',
      red_threshold DOUBLE PRECISION NOT NULL DEFAULT 85,
      yellow_threshold DOUBLE PRECISION NOT NULL DEFAULT 100,
      cap_score DOUBLE PRECISION NOT NULL DEFAULT 120,
      baseline_target DOUBLE PRECISION NOT NULL DEFAULT 100,
      fiscal_year INTEGER NOT NULL DEFAULT 2026,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP::TEXT
    );

    CREATE TABLE IF NOT EXISTS kpi_attribute_assignments (
      kpi_id TEXT NOT NULL REFERENCES kpi_dictionary(id) ON DELETE CASCADE,
      attribute_id TEXT NOT NULL REFERENCES kpi_attributes(id) ON DELETE CASCADE,
      PRIMARY KEY (kpi_id, attribute_id)
    );

    CREATE TABLE IF NOT EXISTS kpi_monthly_records (
      id TEXT PRIMARY KEY,
      kpi_id TEXT NOT NULL REFERENCES kpi_dictionary(id) ON DELETE CASCADE,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL,
      target_value DOUBLE PRECISION NOT NULL,
      actual_value DOUBLE PRECISION,
      achievement_pct DOUBLE PRECISION,
      weighted_score DOUBLE PRECISION,
      status_color TEXT DEFAULT 'UNREPORTED',
      problem_identification TEXT DEFAULT '',
      corrective_action TEXT DEFAULT '',
      need_support TEXT DEFAULT '',
      mitigation_tags TEXT DEFAULT '[]',
      is_draft INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      updated_by TEXT DEFAULT 'System Seed',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP::TEXT,
      UNIQUE(kpi_id, period_year, period_month)
    );

    CREATE INDEX IF NOT EXISTS idx_records_period ON kpi_monthly_records(period_year, period_month);
    CREATE INDEX IF NOT EXISTS idx_kpi_dept ON kpi_dictionary(department_id, fiscal_year);
  `);
}

async function ensureUserPasswordColumn() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
  const usersWithoutPwd = await db.all(
    `SELECT id FROM users WHERE password_hash IS NULL OR password_hash = ''`
  );
  if (usersWithoutPwd.length > 0) {
    const defaultHash = hashPassword('rahma2026');
    for (const u of usersWithoutPwd) {
      await db.run(`UPDATE users SET password_hash = $1 WHERE id = $2`, defaultHash, u.id);
    }
  }
}

async function seedInitialDataIfEmpty() {
  const countRow = await db.get(`SELECT COUNT(*) as cnt FROM departments`);
  if (countRow && Number(countRow.cnt) > 0) return;

  const departments = [
    {
      id: 'dept-ops',
      code: 'OPS',
      name: 'Operations & Heavy Fleet Service',
      leader_name: 'Budi Santoso (VP Operations)',
      description: 'Operasional pemeliharaan alat berat, utilitas armada, dan SLA lapangan PT GSI.'
    },
    {
      id: 'dept-com',
      code: 'COM',
      name: 'Commercial & B2B Solution',
      leader_name: 'Ratna Dewi (GM Commercial)',
      description: 'Akuisisi kontrak B2B, retensi klien korporasi, dan pertumbuhan pendapatan jasa.'
    },
    {
      id: 'dept-fin',
      code: 'FIN',
      name: 'Finance, Accounting & Cost Control',
      leader_name: 'Hendra Wijaya (GM Finance)',
      description: 'Kolektibilitas piutang (AR), efisiensi OPEX, dan ketepatan laporan keuangan.'
    },
    {
      id: 'dept-hc',
      code: 'HCGA',
      name: 'Human Capital, HSE & General Affairs',
      leader_name: 'Siti Rahmawati (GM HC & HSE)',
      description: 'Keselamatan kerja (Zero Accident), pemenuhan kompetensi teknisi, dan produktivitas SDM.'
    },
    {
      id: 'dept-it',
      code: 'ITDT',
      name: 'IT & Digital Transformation',
      leader_name: 'Arif Pratama (Head of IT)',
      description: 'Ketersediaan infrastruktur sistem internal, keamanan siber, dan otomasi proses.'
    }
  ];

  for (const d of departments) {
    await db.run(
      `INSERT INTO departments (id, code, name, leader_name, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      d.id,
      d.code,
      d.name,
      d.leader_name,
      d.description
    );
  }

  const defaultHash = hashPassword('rahma2026');
  const users = [
    {
      id: 'usr-cpmd',
      department_id: null,
      name: 'Nadia Putri (CPMD Lead Analyst)',
      email: 'nadia.cpmd@gsi.co.id',
      role: 'CPMD_ADMIN',
      title: 'Corporate Planning & Management Development'
    },
    {
      id: 'usr-bod',
      department_id: null,
      name: 'Ir. Darmawan Putra (Direktur Utama PT GSI)',
      email: 'darmawan.bod@gsi.co.id',
      role: 'EXECUTIVE',
      title: 'Board of Directors (BOD)'
    },
    {
      id: 'usr-ops',
      department_id: 'dept-ops',
      name: 'Budi Santoso (Leader Divisi OPS)',
      email: 'budi.ops@gsi.co.id',
      role: 'DIV_LEADER',
      title: 'VP Operations & Heavy Fleet'
    },
    {
      id: 'usr-com',
      department_id: 'dept-com',
      name: 'Ratna Dewi (Leader Divisi COM)',
      email: 'ratna.com@gsi.co.id',
      role: 'DIV_LEADER',
      title: 'GM Commercial & B2B'
    },
    {
      id: 'usr-fin',
      department_id: 'dept-fin',
      name: 'Hendra Wijaya (Leader Divisi FIN)',
      email: 'hendra.fin@gsi.co.id',
      role: 'DIV_LEADER',
      title: 'GM Finance & Cost Control'
    },
    {
      id: 'usr-hc',
      department_id: 'dept-hc',
      name: 'Siti Rahmawati (Leader Divisi HCGA)',
      email: 'siti.hc@gsi.co.id',
      role: 'DIV_LEADER',
      title: 'GM HC, HSE & GA'
    },
    {
      id: 'usr-it',
      department_id: 'dept-it',
      name: 'Arif Pratama (Leader Divisi ITDT)',
      email: 'arif.it@gsi.co.id',
      role: 'DIV_LEADER',
      title: 'Head of IT & Digital'
    }
  ];

  for (const u of users) {
    await db.run(
      `INSERT INTO users (id, department_id, name, email, role, title, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      u.id,
      u.department_id,
      u.name,
      u.email,
      u.role,
      u.title,
      defaultHash
    );
  }

  const attributes = [
    {
      id: 'attr-fin',
      attribute_group: 'PERSPECTIVE',
      name: 'Financial Perspective',
      hex_color: '#0D9488',
      description: 'Metrik pertumbuhan pendapatan, arus kas, dan efisiensi biaya PT GSI.'
    },
    {
      id: 'attr-cust',
      attribute_group: 'PERSPECTIVE',
      name: 'Customer & SLA',
      hex_color: '#2563EB',
      description: 'Kepuasan pelanggan B2B, ketepatan waktu layanan, dan retensi kontrak.'
    },
    {
      id: 'attr-ops',
      attribute_group: 'PERSPECTIVE',
      name: 'Internal Process & Ops',
      hex_color: '#7C3AED',
      description: 'Kesiapan alat/armada, keandalan sistem, dan produktivitas proses internal.'
    },
    {
      id: 'attr-hse',
      attribute_group: 'CATEGORY',
      name: 'HSE & Zero Accident',
      hex_color: '#F68400',
      description: 'Kepatuhan K3LH, keselamatan kerja lapangan, dan standar lingkungan.'
    },
    {
      id: 'attr-strat',
      attribute_group: 'PRIORITY',
      name: 'Strategic Key Priority',
      hex_color: '#DB2777',
      description: 'Inisiatif prioritas utama yang dipantau langsung oleh Direksi PT GSI.'
    },
    {
      id: 'attr-core',
      attribute_group: 'CATEGORY',
      name: 'Core Routine SLA',
      hex_color: '#4F46E5',
      description: 'Indikator operasional rutin bulanan berfrekuensi tinggi.'
    },
    {
      id: 'attr-tag-vendor',
      attribute_group: 'MITIGATION_TAG',
      name: 'Kendala Vendor / Sparepart',
      hex_color: '#DC2626',
      description: 'Keterlambatan pengiriman suku cadang atau performa sub-kontraktor.'
    },
    {
      id: 'attr-tag-sdm',
      attribute_group: 'MITIGATION_TAG',
      name: 'Keterbatasan Man-Power',
      hex_color: '#F68400',
      description: 'Kekurangan teknisi bersertifikasi atau perputaran personel lapangan.'
    },
    {
      id: 'attr-tag-bod',
      attribute_group: 'MITIGATION_TAG',
      name: 'Butuh Keputusan / Capex BOD',
      hex_color: '#9333EA',
      description: 'Memerlukan persetujuan anggaran khusus atau eskalasi kontrak lintas divisi.'
    },
    {
      id: 'attr-tag-client',
      attribute_group: 'MITIGATION_TAG',
      name: 'Revisi Jadwal Klien / Cuaca',
      hex_color: '#0284C7',
      description: 'Penundaan akses site oleh klien atau faktor cuaca ekstrem di lokasi proyek.'
    }
  ];

  for (const a of attributes) {
    await db.run(
      `INSERT INTO kpi_attributes (id, attribute_group, name, hex_color, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      a.id,
      a.attribute_group,
      a.name,
      a.hex_color,
      a.description
    );
  }

  const kpis = [
    {
      id: 'kpi-ops-1',
      department_id: 'dept-ops',
      code: 'KPI-OPS-01',
      title: 'Physical Availability (PA) Unit Alat Berat',
      unit: '%',
      weight: 40,
      polarity: 'MAXIMIZE',
      ytd_method: 'AVG',
      red_threshold: 88,
      yellow_threshold: 95,
      cap_score: 115,
      baseline_target: 95,
      attrs: ['attr-ops', 'attr-strat'],
      monthlyTargets: [95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95],
      monthlyActuals: [94.5, 95.2, 93.0, 91.2, 89.5, 87.0, 86.2, 84.5, 83.0, 81.5, 78.4, null],
      novMitigation: {
        problem: '[Kendala Vendor / Sparepart] Lead-time impor komponen hidrolik utama mundur 18 hari akibat antrean kargo pelabuhan, menyebabkan 6 unit excavator standby di site Kalimantan.',
        action: 'Realokasi 3 unit cadangan dari pool Balikpapan & pengadaan kontrak konsinyasi suku cadang fast-moving sebelum 28 Nov 2026 (PIC: VP Ops).',
        support: 'Persetujuan Direksi untuk mekanisme Direct Contracting vendor suku cadang OEM alternatif senilai Rp 480 Juta.',
        tags: ['attr-tag-vendor', 'attr-tag-bod']
      }
    },
    {
      id: 'kpi-ops-2',
      department_id: 'dept-ops',
      code: 'KPI-OPS-02',
      title: 'Mean Time To Repair (MTTR) Gangguan Kritis',
      unit: 'Jam',
      weight: 35,
      polarity: 'MINIMIZE',
      ytd_method: 'AVG',
      red_threshold: 85,
      yellow_threshold: 100,
      cap_score: 120,
      baseline_target: 4.0,
      attrs: ['attr-ops', 'attr-core'],
      monthlyTargets: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      monthlyActuals: [3.8, 3.9, 4.0, 4.1, 3.9, 3.8, 4.0, 4.2, 4.1, 3.9, 3.8, null]
    },
    {
      id: 'kpi-ops-3',
      department_id: 'dept-ops',
      code: 'KPI-OPS-03',
      title: 'Penyelesaian Preventive Maintenance Terjadwal',
      unit: 'Unit',
      weight: 25,
      polarity: 'MAXIMIZE',
      ytd_method: 'SUM',
      red_threshold: 85,
      yellow_threshold: 100,
      cap_score: 120,
      baseline_target: 120,
      attrs: ['attr-ops', 'attr-hse'],
      monthlyTargets: [120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120, 120],
      monthlyActuals: [122, 118, 121, 120, 124, 119, 121, 120, 118, 122, 121, null]
    },
    {
      id: 'kpi-com-1',
      department_id: 'dept-com',
      code: 'KPI-COM-01',
      title: 'Realisasi Pendapatan Kontrak Baru B2B',
      unit: 'Miliar Rp',
      weight: 45,
      polarity: 'MAXIMIZE',
      ytd_method: 'SUM',
      red_threshold: 85,
      yellow_threshold: 100,
      cap_score: 120,
      baseline_target: 12.5,
      attrs: ['attr-fin', 'attr-strat'],
      monthlyTargets: [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5],
      monthlyActuals: [12.8, 12.1, 13.0, 11.9, 12.4, 11.2, 10.8, 10.2, 9.8, 9.5, 8.9, null],
      novMitigation: {
        problem: '[Revisi Jadwal Klien / Cuaca] Penandatanganan perpanjangan 2 tender jasa penunjang tambang senilai Rp 3,6 Miliar ditunda oleh komite pengadaan klien ke awal Desember.',
        action: 'Mengakselerasi closing 4 kontrak proyek jasa maintenance jangka pendek (spot contract) pada minggu ke-4 November (PIC: GM Commercial).',
        support: 'Dukungan Direksi untuk menghadiri Executive Alignment Meeting bersama Direksi Klien Utama pada tanggal 24 November 2026.',
        tags: ['attr-tag-client', 'attr-tag-bod']
      }
    },
    {
      id: 'kpi-com-2',
      department_id: 'dept-com',
      code: 'KPI-COM-02',
      title: 'Customer Satisfaction Index (CSI) Korporasi',
      unit: 'Skor %',
      weight: 30,
      polarity: 'MAXIMIZE',
      ytd_method: 'AVG',
      red_threshold: 85,
      yellow_threshold: 100,
      cap_score: 115,
      baseline_target: 92,
      attrs: ['attr-cust', 'attr-core'],
      monthlyTargets: [92, 92, 92, 92, 92, 92, 92, 92, 92, 92, 92, 92],
      monthlyActuals: [91.5, 92.4, 93.0, 92.2, 91.8, 92.5, 93.1, 92.8, 92.0, 92.6, 93.2, null]
    },
    {
      id: 'kpi-com-3',
      department_id: 'dept-com',
      code: 'KPI-COM-03',
      title: 'Tingkat Retensi Kontrak Tahunan Eksisting',
      unit: '%',
      weight: 25,
      polarity: 'MAXIMIZE',
      ytd_method: 'LAST_VALUE',
      red_threshold: 85,
      yellow_threshold: 100,
      cap_score: 110,
      baseline_target: 95,
      attrs: ['attr-cust', 'attr-fin'],
      monthlyTargets: [95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95],
      monthlyActuals: [96, 96, 95, 95, 95, 96, 96, 95, 95, 96, 96, null]
    },
    {
      id: 'kpi-fin-1',
      department_id: 'dept-fin',
      code: 'KPI-FIN-01',
      title: 'Collection Days / Rata-Rata Umur Piutang (AR Days)',
      unit: 'Hari',
      weight: 40,
      polarity: 'MINIMIZE',
      ytd_method: 'AVG',
      red_threshold: 85,
      yellow_threshold: 100,
      cap_score: 120,
      baseline_target: 45,
      attrs: ['attr-fin', 'attr-strat'],
      monthlyTargets: [45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45],
      monthlyActuals: [44, 46, 45, 48, 49, 51, 52, 54, 56, 58, 61, null],
      novMitigation: {
        problem: '[Kendala Vendor / Sparepart] Proses verifikasi berita acara serah terima pekerjaan (BAST) dari lapangan terlambat rata-rata 14 hari sehingga penagihan invoice ikut mundur.',
        action: 'Menerapkan digitalisasi persetujuan BAST mingguan bersama tim Operations dan menerbitkan surat peringatan jatuh tempo piutang >45 hari (PIC: GM Finance).',
        support: 'Instruksi lintas divisi dari BOD agar penandatanganan BAST proyek wajib diselesaikan maksimal H+3 setelah pekerjaan selesai.',
        tags: ['attr-tag-bod', 'attr-tag-client']
      }
    },
    {
      id: 'kpi-fin-2',
      department_id: 'dept-fin',
      code: 'KPI-FIN-02',
      title: 'Rasio Realisasi Biaya Operasional (OPEX) terhadap Anggaran',
      unit: '%',
      weight: 35,
      polarity: 'MINIMIZE',
      ytd_method: 'AVG',
      red_threshold: 85,
      yellow_threshold: 100,
      cap_score: 115,
      baseline_target: 98,
      attrs: ['attr-fin', 'attr-core'],
      monthlyTargets: [98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98],
      monthlyActuals: [96.5, 97.2, 98.0, 97.5, 96.8, 97.1, 97.9, 98.2, 97.4, 96.9, 97.0, null]
    },
    {
      id: 'kpi-fin-3',
      department_id: 'dept-fin',
      code: 'KPI-FIN-03',
      title: 'Ketepatan Waktu Tutup Buku & Pelaporan Pajak Bulanan',
      unit: '%',
      weight: 25,
      polarity: 'MAXIMIZE',
      ytd_method: 'AVG',
      red_threshold: 90,
      yellow_threshold: 100,
      cap_score: 105,
      baseline_target: 100,
      attrs: ['attr-fin', 'attr-core'],
      monthlyTargets: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      monthlyActuals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, null]
    },
    {
      id: 'kpi-hc-1',
      department_id: 'dept-hc',
      code: 'KPI-HC-01',
      title: 'Pemenuhan Sertifikasi & Jam Pelatihan Teknisi Lapangan',
      unit: 'Jam-Orang',
      weight: 55,
      polarity: 'MAXIMIZE',
      ytd_method: 'SUM',
      red_threshold: 85,
      yellow_threshold: 100,
      cap_score: 120,
      baseline_target: 320,
      attrs: ['attr-hse', 'attr-ops'],
      monthlyTargets: [320, 320, 320, 320, 320, 320, 320, 320, 320, 320, 320, 320],
      monthlyActuals: [330, 315, 325, 340, 318, 322, 310, 305, 312, 298, 250, null],
      novMitigation: {
        problem: '[Keterbatasan Man-Power] 24 teknisi senior tidak dapat mengikuti batch sertifikasi K3 bulan November karena ditarik untuk penanganan overhaul darurat di site proyek.',
        action: 'Menyelenggarakan In-House Training & Sertifikasi Gelombang Susulan secara hybrid di site proyek pada tanggal 5-7 Desember 2026 (PIC: GM HC & HSE).',
        support: 'Persetujuan dispensasi jadwal kerja bergilir dari VP Operations selama 2 hari pelaksanaan ujian sertifikasi di site.',
        tags: ['attr-tag-sdm']
      }
    },
    {
      id: 'kpi-hc-2',
      department_id: 'dept-hc',
      code: 'KPI-HC-02',
      title: 'Kepatuhan Inspeksi Keselamatan Kerja (HSE Audit Score)',
      unit: '%',
      weight: 45,
      polarity: 'MAXIMIZE',
      ytd_method: 'AVG',
      red_threshold: 90,
      yellow_threshold: 100,
      cap_score: 110,
      baseline_target: 98,
      attrs: ['attr-hse', 'attr-strat'],
      monthlyTargets: [98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98, 98],
      monthlyActuals: [98.5, 99.0, 98.2, 98.8, 99.1, 98.4, 98.0, 98.6, 99.2, 98.9, 99.0, null]
    },
    {
      id: 'kpi-it-1',
      department_id: 'dept-it',
      code: 'KPI-IT-01',
      title: 'Uptime Infrastruktur & Aplikasi Inti Perusahaan',
      unit: '%',
      weight: 50,
      polarity: 'MAXIMIZE',
      ytd_method: 'AVG',
      red_threshold: 95,
      yellow_threshold: 99.5,
      cap_score: 105,
      baseline_target: 99.5,
      attrs: ['attr-ops', 'attr-core'],
      monthlyTargets: [99.5, 99.5, 99.5, 99.5, 99.5, 99.5, 99.5, 99.5, 99.5, 99.5, 99.5, 99.5],
      monthlyActuals: [99.8, 99.7, 99.6, 99.9, 99.5, 99.7, 99.8, 99.6, 99.7, 99.8, 99.7, null],
      novDraft: true
    },
    {
      id: 'kpi-it-2',
      department_id: 'dept-it',
      code: 'KPI-IT-02',
      title: 'Penyelesaian Tiket Helpdesk & Otomasi Internal SLA',
      unit: '%',
      weight: 50,
      polarity: 'MAXIMIZE',
      ytd_method: 'AVG',
      red_threshold: 85,
      yellow_threshold: 95,
      cap_score: 115,
      baseline_target: 95,
      attrs: ['attr-ops', 'attr-cust'],
      monthlyTargets: [95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95],
      monthlyActuals: [96, 95, 97, 94, 96, 95, 97, 96, 95, 96, null, null],
      novDraft: true
    }
  ];

  for (const k of kpis) {
    await db.run(
      `INSERT INTO kpi_dictionary (
         id, department_id, code, title, unit, weight, polarity, ytd_method,
         red_threshold, yellow_threshold, cap_score, baseline_target, fiscal_year
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 2026)
       ON CONFLICT (id) DO NOTHING`,
      k.id,
      k.department_id,
      k.code,
      k.title,
      k.unit,
      k.weight,
      k.polarity,
      k.ytd_method,
      k.red_threshold,
      k.yellow_threshold,
      k.cap_score,
      k.baseline_target
    );

    for (const attrId of k.attrs) {
      await db.run(
        `INSERT INTO kpi_attribute_assignments (kpi_id, attribute_id)
         VALUES ($1, $2)
         ON CONFLICT (kpi_id, attribute_id) DO NOTHING`,
        k.id,
        attrId
      );
    }

    for (let m = 1; m <= 12; m++) {
      const targetVal = k.monthlyTargets[m - 1];
      const actualVal = k.monthlyActuals[m - 1];
      const hasActual = actualVal !== null && actualVal !== undefined;
      const achPct = hasActual
        ? calculateAchievementPct(targetVal, actualVal, k.polarity, k.cap_score)
        : null;
      const wScore = hasActual ? calculateWeightedScore(achPct, k.weight) : null;
      const statusColor = hasActual
        ? classifyStatusColor(achPct, k.red_threshold, k.yellow_threshold)
        : 'UNREPORTED';

      let prob = '';
      let corr = '';
      let supp = '';
      let tagsJson = '[]';

      if (m === 11 && k.novMitigation) {
        prob = k.novMitigation.problem;
        corr = k.novMitigation.action;
        supp = k.novMitigation.support;
        tagsJson = JSON.stringify(k.novMitigation.tags || []);
      } else if (statusColor === 'RED') {
        prob = `Deviasi capaian bulan ke-${m} di bawah ambang batas (${achPct}%) akibat fluktuasi beban operasional lapangan.`;
        corr = `Penyesuaian alokasi sumber daya mingguan dan evaluasi vendor oleh kepala divisi pada bulan ke-${m}.`;
        supp = `Koordinasi percepatan persetujuan operasional lintas departemen.`;
      }

      const isDraft = m === 11 && k.novDraft ? 1 : 0;
      const isLocked = m < 11 ? 1 : 0;

      await db.run(
        `INSERT INTO kpi_monthly_records (
           id, kpi_id, period_year, period_month, target_value, actual_value,
           achievement_pct, weighted_score, status_color,
           problem_identification, corrective_action, need_support, mitigation_tags,
           is_draft, is_locked
         ) VALUES ($1, $2, 2026, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        `rec-${k.id}-2026-${m}`,
        k.id,
        m,
        targetVal,
        actualVal,
        achPct,
        wScore,
        statusColor,
        prob,
        corr,
        supp,
        tagsJson,
        isDraft,
        isLocked
      );
    }
  }
}

let initPromise = null;
async function initDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureDatabaseExists();
      await initSchema();
      await seedInitialDataIfEmpty();
      await ensureUserPasswordColumn();
    })();
  }
  return initPromise;
}

async function authenticateUser(email, password) {
  if (!email || !password) return null;
  const user = await db.get(
    `SELECT u.id, u.department_id, u.name, u.email, u.role, u.title, u.password_hash,
            d.code as department_code, d.name as department_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE LOWER(u.email) = LOWER($1)`,
    email.trim()
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

async function getAllAttributes() {
  const rows = await db.all(
    `SELECT a.*,
      (SELECT COUNT(*) FROM kpi_attribute_assignments ka WHERE ka.attribute_id = a.id) as usage_count
     FROM kpi_attributes a
     ORDER BY a.attribute_group ASC, a.name ASC`
  );

  return rows.map((r) => ({
    ...r,
    usage_count: Number(r.usage_count || 0),
    is_active: Boolean(r.is_active),
    accent: computeHexAccentMeta(r.hex_color)
  }));
}

async function getEnrichedKpis({ departmentId = null, year = 2026, month = 11 } = {}) {
  const allAttrs = await getAllAttributes();
  const attrMap = new Map(allAttrs.map((a) => [a.id, a]));

  let sql = `
    SELECT k.*, d.code as department_code, d.name as department_name, d.leader_name
    FROM kpi_dictionary k
    JOIN departments d ON d.id = k.department_id
    WHERE k.fiscal_year = $1 AND k.is_active = 1
  `;
  const params = [Number(year)];
  if (departmentId && departmentId !== 'ALL') {
    sql += ` AND k.department_id = $2`;
    params.push(departmentId);
  }
  sql += ` ORDER BY d.code ASC, k.code ASC`;

  const [kpis, assignRows, recordRows] = await Promise.all([
    db.all(sql, params),
    db.all(`SELECT kpi_id, attribute_id FROM kpi_attribute_assignments`),
    db.all(
      `SELECT * FROM kpi_monthly_records WHERE period_year = $1 ORDER BY period_month ASC`,
      Number(year)
    )
  ]);

  const assignByKpi = new Map();
  for (const row of assignRows) {
    if (!assignByKpi.has(row.kpi_id)) assignByKpi.set(row.kpi_id, []);
    const attr = attrMap.get(row.attribute_id);
    if (attr) assignByKpi.get(row.kpi_id).push(attr);
  }

  const recordsByKpi = new Map();
  for (const rec of recordRows) {
    if (!recordsByKpi.has(rec.kpi_id)) recordsByKpi.set(rec.kpi_id, []);
    recordsByKpi.get(rec.kpi_id).push(rec);
  }

  return kpis.map((kpi) => {
    const attributes = assignByKpi.get(kpi.id) || [];
    const primaryAccent = attributes[0]?.accent || computeHexAccentMeta('#2563EB');
    const monthlyRecords = recordsByKpi.get(kpi.id) || [];

    const currentRecord = monthlyRecords.find((r) => Number(r.period_month) === Number(month)) || {
      kpi_id: kpi.id,
      period_year: Number(year),
      period_month: Number(month),
      target_value: kpi.baseline_target,
      actual_value: null,
      achievement_pct: null,
      weighted_score: null,
      status_color: 'UNREPORTED',
      problem_identification: '',
      corrective_action: '',
      need_support: '',
      mitigation_tags: '[]',
      is_draft: 0,
      is_locked: 0
    };

    const prevRecord =
      Number(month) > 1
        ? monthlyRecords.find((r) => Number(r.period_month) === Number(month) - 1)
        : null;

    const seriesForYtd = monthlyRecords.map((r) => ({
      month: Number(r.period_month),
      target: r.target_value,
      actual: r.actual_value
    }));
    const ytd = calculateYtdMetrics(seriesForYtd, Number(month), kpi);

    let momDeltaPct = null;
    if (
      currentRecord.achievement_pct !== null &&
      currentRecord.achievement_pct !== undefined &&
      prevRecord &&
      prevRecord.achievement_pct !== null &&
      prevRecord.achievement_pct !== undefined
    ) {
      momDeltaPct = Number(
        (Number(currentRecord.achievement_pct) - Number(prevRecord.achievement_pct)).toFixed(2)
      );
    }

    const startSpark = Math.max(1, Number(month) - 5);
    const sparkline = [];
    for (let m = startSpark; m <= Number(month); m++) {
      const r = monthlyRecords.find((item) => Number(item.period_month) === m);
      sparkline.push({
        month: m,
        achievement_pct: r && r.achievement_pct !== null ? Number(r.achievement_pct) : null,
        status_color: r ? r.status_color : 'UNREPORTED'
      });
    }

    let parsedMitigationTags = [];
    try {
      parsedMitigationTags = JSON.parse(currentRecord.mitigation_tags || '[]');
    } catch {
      parsedMitigationTags = [];
    }
    const mitigationTagObjects = parsedMitigationTags
      .map((id) => attrMap.get(id))
      .filter(Boolean);

    return {
      ...kpi,
      attributes,
      primaryAccent,
      current: {
        ...currentRecord,
        is_draft: Boolean(currentRecord.is_draft),
        is_locked: Boolean(currentRecord.is_locked),
        mitigationTagIds: parsedMitigationTags,
        mitigationTagObjects
      },
      ytd,
      momDeltaPct,
      sparkline,
      monthlyHistory: monthlyRecords.map((r) => ({
        month: Number(r.period_month),
        target_value: r.target_value,
        actual_value: r.actual_value,
        achievement_pct: r.achievement_pct,
        weighted_score: r.weighted_score,
        status_color: r.status_color,
        is_draft: Boolean(r.is_draft)
      }))
    };
  });
}

async function getDashboardSummary({ year = 2026, month = 11, mode = 'MONTHLY' } = {}) {
  const [departments, kpis] = await Promise.all([
    db.all(`SELECT * FROM departments WHERE is_active = 1 ORDER BY code ASC`),
    getEnrichedKpis({ year, month })
  ]);

  const departmentSummaries = departments.map((dept) => {
    const deptKpis = kpis.filter((k) => k.department_id === dept.id);
    const totalWeight = Number(
      deptKpis.reduce((acc, k) => acc + Number(k.weight || 0), 0).toFixed(2)
    );

    let monthlyWeightedSum = 0;
    let ytdWeightedSum = 0;
    let reportedCount = 0;
    let submittedFinalCount = 0;
    let redCount = 0;
    let yellowCount = 0;
    let greenCount = 0;

    for (const k of deptKpis) {
      const hasActual =
        k.current.actual_value !== null && k.current.actual_value !== undefined;
      if (hasActual) {
        reportedCount++;
        if (!k.current.is_draft) {
          submittedFinalCount++;
        }
      }

      const activeStatus =
        mode === 'YTD' ? k.ytd.ytdStatusColor : k.current.status_color;
      if (activeStatus === 'RED') redCount++;
      else if (activeStatus === 'YELLOW') yellowCount++;
      else if (activeStatus === 'GREEN') greenCount++;

      monthlyWeightedSum += Number(k.current.weighted_score || 0);
      ytdWeightedSum += Number(k.ytd.ytdWeightedScore || 0);
    }

    const monthlyScore = Number(monthlyWeightedSum.toFixed(2));
    const ytdScore = Number(ytdWeightedSum.toFixed(2));
    const activeScore = mode === 'YTD' ? ytdScore : monthlyScore;
    const statusColor = classifyStatusColor(activeScore, 85, 100);

    let submissionStatus = 'NOT_STARTED';
    if (deptKpis.length > 0 && submittedFinalCount === deptKpis.length) {
      submissionStatus = 'SUBMITTED';
    } else if (reportedCount > 0) {
      submissionStatus = 'DRAFT';
    }

    const monthlyHeatmap = [];
    for (let m = 1; m <= 12; m++) {
      let mScore = 0;
      let mReported = 0;
      for (const k of deptKpis) {
        const h = k.monthlyHistory.find((item) => item.month === m);
        if (h && h.actual_value !== null && h.actual_value !== undefined) {
          mReported++;
          mScore += Number(h.weighted_score || 0);
        }
      }
      const roundedScore = mReported > 0 ? Number(mScore.toFixed(1)) : null;
      monthlyHeatmap.push({
        month: m,
        score: roundedScore,
        status_color:
          roundedScore !== null ? classifyStatusColor(roundedScore, 85, 100) : 'UNREPORTED'
      });
    }

    return {
      ...dept,
      kpiCount: deptKpis.length,
      totalWeight,
      isWeightValid: Math.abs(totalWeight - 100) < 0.01,
      reportedCount,
      submittedFinalCount,
      submissionStatus,
      monthlyScore,
      ytdScore,
      activeScore,
      statusColor,
      counts: {
        green: greenCount,
        yellow: yellowCount,
        red: redCount
      },
      monthlyHeatmap
    };
  });

  const activeDepts = departmentSummaries.filter((d) => d.kpiCount > 0);
  const corporateMonthlyScore =
    activeDepts.length > 0
      ? Number(
          (
            activeDepts.reduce((acc, d) => acc + d.monthlyScore, 0) / activeDepts.length
          ).toFixed(2)
        )
      : 0;
  const corporateYtdScore =
    activeDepts.length > 0
      ? Number(
          (
            activeDepts.reduce((acc, d) => acc + d.ytdScore, 0) / activeDepts.length
          ).toFixed(2)
        )
      : 0;
  const corporateActiveScore = mode === 'YTD' ? corporateYtdScore : corporateMonthlyScore;

  const redEscalations = kpis.filter((k) => {
    const st = mode === 'YTD' ? k.ytd.ytdStatusColor : k.current.status_color;
    return st === 'RED' || k.current.status_color === 'RED';
  });

  const submittedDepts = departmentSummaries.filter((d) => d.submissionStatus === 'SUBMITTED');
  const pendingDepts = departmentSummaries.filter((d) => d.submissionStatus !== 'SUBMITTED');

  return {
    period: {
      year: Number(year),
      month: Number(month),
      mode
    },
    corporate: {
      monthlyScore: corporateMonthlyScore,
      ytdScore: corporateYtdScore,
      activeScore: corporateActiveScore,
      statusColor: classifyStatusColor(corporateActiveScore, 85, 100),
      totalKpis: kpis.length,
      greenCount: kpis.filter(
        (k) =>
          (mode === 'YTD' ? k.ytd.ytdStatusColor : k.current.status_color) === 'GREEN'
      ).length,
      yellowCount: kpis.filter(
        (k) =>
          (mode === 'YTD' ? k.ytd.ytdStatusColor : k.current.status_color) === 'YELLOW'
      ).length,
      redCount: kpis.filter(
        (k) =>
          (mode === 'YTD' ? k.ytd.ytdStatusColor : k.current.status_color) === 'RED'
      ).length
    },
    submissionTracker: {
      totalDepartments: departmentSummaries.length,
      submittedCount: submittedDepts.length,
      pendingCount: pendingDepts.length,
      pendingDepartments: pendingDepts.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        leader_name: d.leader_name,
        status: d.submissionStatus,
        progress: `${d.submittedFinalCount}/${d.kpiCount} KPI`
      }))
    },
    departments: departmentSummaries,
    redEscalations,
    kpis
  };
}

module.exports = {
  db,
  pool,
  initDatabase,
  getAllAttributes,
  getEnrichedKpis,
  getDashboardSummary,
  normalizeHexColor,
  computeHexAccentMeta,
  hashPassword,
  verifyPassword,
  authenticateUser
};
