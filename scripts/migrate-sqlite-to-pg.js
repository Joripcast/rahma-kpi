/**
 * One-time / On-demand Migration Script: SQLite (data/rahma.sqlite) -> PostgreSQL (rahma_kpi)
 * PT Global Service Indonesia (GSI)
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Client } = require('pg');

const SQLITE_PATH = path.join(__dirname, '..', 'data', 'rahma.sqlite');

const PG_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password:
    process.env.PGPASSWORD && process.env.PGPASSWORD !== 'NULL'
      ? process.env.PGPASSWORD
      : undefined,
  database: process.env.PGDATABASE || 'rahma_kpi'
};

async function ensureDatabaseExists() {
  const adminClient = new Client({
    ...PG_CONFIG,
    database: 'postgres'
  });
  await adminClient.connect();
  const res = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [PG_CONFIG.database]
  );
  if (res.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${PG_CONFIG.database}"`);
    console.log(`✅ Created PostgreSQL database: ${PG_CONFIG.database}`);
  }
  await adminClient.end();
}

async function migrate() {
  await ensureDatabaseExists();

  const pgClient = new Client(PG_CONFIG);
  await pgClient.connect();

  await pgClient.query(`
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

  if (!fs.existsSync(SQLITE_PATH)) {
    console.log('ℹ️ No SQLite file found at data/rahma.sqlite; schema initialized in PostgreSQL.');
    await pgClient.end();
    return;
  }

  const sqlite = new DatabaseSync(SQLITE_PATH);

  const departments = sqlite.prepare(`SELECT * FROM departments`).all();
  for (const d of departments) {
    await pgClient.query(
      `INSERT INTO departments (id, code, name, leader_name, description, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         code = EXCLUDED.code,
         name = EXCLUDED.name,
         leader_name = EXCLUDED.leader_name,
         description = EXCLUDED.description,
         is_active = EXCLUDED.is_active`,
      [d.id, d.code, d.name, d.leader_name, d.description, d.is_active ?? 1, d.created_at || new Date().toISOString()]
    );
  }

  const users = sqlite.prepare(`SELECT * FROM users`).all();
  for (const u of users) {
    await pgClient.query(
      `INSERT INTO users (id, department_id, name, email, role, title, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         department_id = EXCLUDED.department_id,
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         title = EXCLUDED.title,
         password_hash = EXCLUDED.password_hash`,
      [u.id, u.department_id, u.name, u.email, u.role, u.title, u.password_hash]
    );
  }

  const attributes = sqlite.prepare(`SELECT * FROM kpi_attributes`).all();
  for (const a of attributes) {
    await pgClient.query(
      `INSERT INTO kpi_attributes (id, attribute_group, name, hex_color, description, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         attribute_group = EXCLUDED.attribute_group,
         name = EXCLUDED.name,
         hex_color = EXCLUDED.hex_color,
         description = EXCLUDED.description,
         is_active = EXCLUDED.is_active`,
      [a.id, a.attribute_group, a.name, a.hex_color, a.description, a.is_active ?? 1, a.created_at || new Date().toISOString()]
    );
  }

  const kpis = sqlite.prepare(`SELECT * FROM kpi_dictionary`).all();
  for (const k of kpis) {
    await pgClient.query(
      `INSERT INTO kpi_dictionary (
         id, department_id, code, title, unit, weight, polarity, ytd_method,
         red_threshold, yellow_threshold, cap_score, baseline_target, fiscal_year, is_active, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         department_id = EXCLUDED.department_id,
         code = EXCLUDED.code,
         title = EXCLUDED.title,
         unit = EXCLUDED.unit,
         weight = EXCLUDED.weight,
         polarity = EXCLUDED.polarity,
         ytd_method = EXCLUDED.ytd_method,
         red_threshold = EXCLUDED.red_threshold,
         yellow_threshold = EXCLUDED.yellow_threshold,
         cap_score = EXCLUDED.cap_score,
         baseline_target = EXCLUDED.baseline_target,
         fiscal_year = EXCLUDED.fiscal_year,
         is_active = EXCLUDED.is_active`,
      [
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
        k.baseline_target,
        k.fiscal_year ?? 2026,
        k.is_active ?? 1,
        k.created_at || new Date().toISOString()
      ]
    );
  }

  const assignments = sqlite.prepare(`SELECT * FROM kpi_attribute_assignments`).all();
  for (const asg of assignments) {
    await pgClient.query(
      `INSERT INTO kpi_attribute_assignments (kpi_id, attribute_id)
       VALUES ($1, $2)
       ON CONFLICT (kpi_id, attribute_id) DO NOTHING`,
      [asg.kpi_id, asg.attribute_id]
    );
  }

  const records = sqlite.prepare(`SELECT * FROM kpi_monthly_records`).all();
  for (const r of records) {
    await pgClient.query(
      `INSERT INTO kpi_monthly_records (
         id, kpi_id, period_year, period_month, target_value, actual_value,
         achievement_pct, weighted_score, status_color,
         problem_identification, corrective_action, need_support, mitigation_tags,
         is_draft, is_locked, updated_by, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO UPDATE SET
         target_value = EXCLUDED.target_value,
         actual_value = EXCLUDED.actual_value,
         achievement_pct = EXCLUDED.achievement_pct,
         weighted_score = EXCLUDED.weighted_score,
         status_color = EXCLUDED.status_color,
         problem_identification = EXCLUDED.problem_identification,
         corrective_action = EXCLUDED.corrective_action,
         need_support = EXCLUDED.need_support,
         mitigation_tags = EXCLUDED.mitigation_tags,
         is_draft = EXCLUDED.is_draft,
         is_locked = EXCLUDED.is_locked,
         updated_by = EXCLUDED.updated_by,
         updated_at = EXCLUDED.updated_at`,
      [
        r.id,
        r.kpi_id,
        r.period_year,
        r.period_month,
        r.target_value,
        r.actual_value,
        r.achievement_pct,
        r.weighted_score,
        r.status_color,
        r.problem_identification || '',
        r.corrective_action || '',
        r.need_support || '',
        r.mitigation_tags || '[]',
        r.is_draft ?? 0,
        r.is_locked ?? 0,
        r.updated_by || 'System Seed',
        r.updated_at || new Date().toISOString()
      ]
    );
  }

  sqlite.close();
  await pgClient.end();

  console.log(`✅ Migrated to PostgreSQL (${PG_CONFIG.database}):`);
  console.log(`   - Departments : ${departments.length}`);
  console.log(`   - Users       : ${users.length}`);
  console.log(`   - Attributes  : ${attributes.length}`);
  console.log(`   - KPIs        : ${kpis.length}`);
  console.log(`   - Assignments : ${assignments.length}`);
  console.log(`   - Records     : ${records.length}`);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
