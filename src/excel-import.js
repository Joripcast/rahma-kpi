/**
 * RAHMA Smart Excel Import (.xlsx) & Dry-Run Validation Engine
 * Validates data types, polarity alignment, RBAC isolation, and < 85% Mitigation Gate
 * before committing any rows into PostgreSQL.
 */

const { buildXlsxBuffer } = require('./xlsx');
const {
  calculateAchievementPct,
  calculateWeightedScore,
  classifyStatusColor,
  validateMitigationGate
} = require('./engine');

const TEMPLATE_HEADERS = [
  'Kode KPI',
  'Nama Indikator',
  'Divisi',
  'Satuan',
  'Bobot (%)',
  'Polaritas',
  'Target',
  'Actual',
  'Problem Identification',
  'Corrective Action',
  'Need Support BOD'
];

const TEMPLATE_COL_WIDTHS = [16, 40, 12, 12, 12, 14, 14, 14, 34, 34, 34];

function buildKpiExcelTemplateBuffer({ kpis = [], year = 2026, month = 11, departmentLabel = 'Semua Divisi' }) {
  const rows = [TEMPLATE_HEADERS];

  for (const k of kpis) {
    rows.push([
      k.code,
      k.title,
      k.department_code,
      k.unit,
      Number(k.weight || 0),
      k.polarity || 'MAXIMIZE',
      Number(k.current?.target_value ?? k.baseline_target ?? 0),
      k.current?.actual_value !== null && k.current?.actual_value !== undefined
        ? Number(k.current.actual_value)
        : '',
      k.current?.problem_identification || '',
      k.current?.corrective_action || '',
      k.current?.need_support || ''
    ]);
  }

  const guideRows = [
    ['PANDUAN PENGISIAN TEMPLATE EXCEL RAHMA KPI'],
    ['Periode Laporan', `${year}-${String(month).padStart(2, '0')}`],
    ['Cakupan Divisi', departmentLabel],
    [''],
    ['Kolom', 'Aturan Validasi Dry-Run RAHMA'],
    ['Kode KPI', 'Wajib sesuai Kode KPI pada Kamus KPI RAHMA (contoh: KPI-OPS-01).'],
    ['Polaritas', 'Wajib sesuai Kamus KPI: MAXIMIZE (lebih besar lebih baik) atau MINIMIZE (lebih kecil lebih baik).'],
    ['Target & Actual', 'Wajib berupa angka numerik yang valid (tanpa teks atau simbol satuan).'],
    ['Gerbang Mitigasi (< 85%)', 'Jika hasil kalkulasi capaian < 85% (Merah), kolom Problem Identification, Corrective Action, dan Need Support BOD wajib diisi minimal 10 karakter.'],
    ['Baris Kosong', 'Jika kolom Actual dikosongkan, baris akan dilewati (SKIPPED) saat impor ke PostgreSQL.']
  ];

  return buildXlsxBuffer([
    { name: 'Input KPI', rows, colWidths: TEMPLATE_COL_WIDTHS },
    { name: 'Panduan Pengisian', rows: guideRows, colWidths: [28, 76] }
  ]);
}

function normalizeHeaderName(val) {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveColumnMap(headerRow = []) {
  const aliases = {
    code: ['kode kpi', 'code', 'kpi code'],
    title: ['nama indikator', 'indikator', 'title', 'nama kpi'],
    departmentCode: ['divisi', 'departemen', 'department'],
    polarity: ['polaritas', 'polarity'],
    weight: ['bobot', 'weight'],
    target: ['target', 'target value', 'target bulan ini'],
    actual: ['actual', 'actual value', 'realisasi', 'achievement'],
    problemIdentification: ['problem identification', 'akar masalah', 'problem'],
    correctiveAction: ['corrective action', 'tindakan perbaikan', 'corrective'],
    needSupport: ['need support bod', 'need support', 'bod support', 'dukungan bod']
  };

  const map = {};
  headerRow.forEach((cell, idx) => {
    const norm = normalizeHeaderName(cell);
    for (const [key, list] of Object.entries(aliases)) {
      if (map[key] === undefined && list.includes(norm)) {
        map[key] = idx;
      }
    }
  });
  return map;
}

function parseStrictNumericCell(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { empty: true, valid: true, value: null };
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw)
      ? { empty: false, valid: true, value: raw }
      : { empty: false, valid: false, value: null };
  }
  const str = String(raw).trim();
  if (str === '') return { empty: true, valid: true, value: null };
  const num = Number(str);
  if (!Number.isFinite(num)) {
    return { empty: false, valid: false, value: null };
  }
  return { empty: false, valid: true, value: num };
}

function validateExcelImportRows({
  rows = [],
  kpis = [],
  existingRecordsByKpiId = new Map(),
  authUser = { role: 'CPMD_ADMIN' }
}) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return {
      fatalError: 'Berkas Excel tidak memiliki baris data. Pastikan menggunakan Template KPI RAHMA yang valid.'
    };
  }

  const colMap = resolveColumnMap(rows[0]);
  if (colMap.code === undefined || colMap.target === undefined || colMap.actual === undefined) {
    return {
      fatalError:
        'Header kolom wajib tidak ditemukan. Pastikan terdapat kolom "Kode KPI", "Target", dan "Actual".'
    };
  }

  const kpiByCode = new Map(
    kpis.map((k) => [String(k.code || '').trim().toUpperCase(), k])
  );

  const seenCodes = new Set();
  const results = [];
  let validCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const hasAnyValue = row.some((c) => String(c ?? '').trim() !== '');
    if (!hasAnyValue) continue;

    const rowNumber = i + 1;
    const rawCode = String(row[colMap.code] ?? '').trim();
    const normCode = rawCode.toUpperCase();
    const kpi = kpiByCode.get(normCode);

    const errors = [];
    const warnings = [];

    if (!rawCode) {
      errors.push('Kolom "Kode KPI" kosong.');
    } else if (!kpi) {
      errors.push(`Kode KPI "${rawCode}" tidak terdaftar di Kamus KPI aktif.`);
    } else {
      if (seenCodes.has(normCode)) {
        errors.push(`Duplikasi Kode KPI "${rawCode}" pada baris lain di berkas Excel.`);
      }
      seenCodes.add(normCode);

      if (authUser.role === 'DIV_LEADER' && kpi.department_id !== authUser.department_id) {
        errors.push(
          `Akses ditolak (RBAC): KPI "${rawCode}" milik divisi ${kpi.department_code}, bukan divisi Anda.`
        );
      }

      const existingRec = existingRecordsByKpiId.get(kpi.id);
      if (existingRec && existingRec.is_locked) {
        errors.push(`Periode pelaporan KPI "${rawCode}" telah dikunci oleh CPMD.`);
      }
    }

    // Polarity check
    const rawPolarity =
      colMap.polarity !== undefined ? String(row[colMap.polarity] ?? '').trim().toUpperCase() : '';
    if (rawPolarity) {
      if (!['MAXIMIZE', 'MINIMIZE'].includes(rawPolarity)) {
        errors.push(`Polaritas "${rawPolarity}" tidak valid (harus MAXIMIZE atau MINIMIZE).`);
      } else if (kpi && rawPolarity !== kpi.polarity) {
        errors.push(
          `Polaritas "${rawPolarity}" tidak sesuai dengan Kamus KPI (terdaftar: ${kpi.polarity}).`
        );
      }
    }

    // Data type check for Target & Actual
    const targetParsed = parseStrictNumericCell(row[colMap.target]);
    const actualParsed = parseStrictNumericCell(row[colMap.actual]);

    if (!targetParsed.valid) {
      errors.push(`Nilai Target ("${row[colMap.target]}") harus berupa angka valid.`);
    } else if (targetParsed.empty && kpi) {
      warnings.push(`Target kosong; menggunakan baseline_target (${kpi.baseline_target}).`);
    }

    if (!actualParsed.valid) {
      errors.push(`Nilai Actual ("${row[colMap.actual]}") harus berupa angka valid.`);
    }

    const problemIdentification =
      colMap.problemIdentification !== undefined
        ? String(row[colMap.problemIdentification] ?? '').trim()
        : '';
    const correctiveAction =
      colMap.correctiveAction !== undefined
        ? String(row[colMap.correctiveAction] ?? '').trim()
        : '';
    const needSupport =
      colMap.needSupport !== undefined
        ? String(row[colMap.needSupport] ?? '').trim()
        : '';

    const effectiveTarget =
      !targetParsed.empty && targetParsed.valid
        ? targetParsed.value
        : kpi
          ? Number(kpi.baseline_target)
          : null;

    // If Actual is empty and no structural errors, mark SKIPPED
    if (actualParsed.empty && errors.length === 0) {
      skippedCount++;
      results.push({
        rowNumber,
        kpiId: kpi?.id || null,
        code: rawCode || '-',
        title: kpi?.title || String(row[colMap.title] ?? '-'),
        departmentCode: kpi?.department_code || '-',
        unit: kpi?.unit || '',
        polarity: kpi?.polarity || rawPolarity || '-',
        weight: kpi ? Number(kpi.weight) : null,
        targetValue: effectiveTarget,
        actualValue: null,
        achievementPct: null,
        weightedScore: null,
        statusColor: 'UNREPORTED',
        problemIdentification,
        correctiveAction,
        needSupport,
        status: 'SKIPPED',
        errors: [],
        warnings: ['Actual kosong — baris dilewati saat impor.']
      });
      continue;
    }

    let achievementPct = null;
    let weightedScore = null;
    let statusColor = 'UNREPORTED';

    if (kpi && targetParsed.valid && actualParsed.valid && !actualParsed.empty) {
      achievementPct = calculateAchievementPct(
        effectiveTarget,
        actualParsed.value,
        kpi.polarity,
        kpi.cap_score
      );
      weightedScore = calculateWeightedScore(achievementPct, kpi.weight);
      statusColor = classifyStatusColor(
        achievementPct,
        kpi.red_threshold,
        kpi.yellow_threshold
      );

      // Mandatory Mitigation Gate (< 85% / RED)
      const gateResult = validateMitigationGate({
        statusColor,
        problemIdentification,
        correctiveAction,
        needSupport,
        isDraft: false
      });
      if (!gateResult.valid) {
        errors.push(...gateResult.errors);
      }
    }

    const rowStatus = errors.length > 0 ? 'ERROR' : 'VALID';
    if (rowStatus === 'ERROR') {
      errorCount++;
    } else {
      validCount++;
      if (statusColor === 'RED') redCount++;
      else if (statusColor === 'YELLOW') yellowCount++;
      else if (statusColor === 'GREEN') greenCount++;
    }

    results.push({
      rowNumber,
      kpiId: kpi?.id || null,
      code: rawCode || '-',
      title: kpi?.title || String(row[colMap.title] ?? '-'),
      departmentCode: kpi?.department_code || '-',
      unit: kpi?.unit || '',
      polarity: kpi?.polarity || rawPolarity || '-',
      weight: kpi ? Number(kpi.weight) : null,
      targetValue: effectiveTarget,
      actualValue: actualParsed.valid ? actualParsed.value : row[colMap.actual],
      achievementPct,
      weightedScore,
      statusColor,
      problemIdentification,
      correctiveAction,
      needSupport,
      status: rowStatus,
      errors,
      warnings
    });
  }

  return {
    summary: {
      totalRows: results.length,
      validCount,
      errorCount,
      skippedCount,
      redCount,
      yellowCount,
      greenCount,
      canCommit: validCount > 0 && errorCount === 0
    },
    rows: results
  };
}

module.exports = {
  TEMPLATE_HEADERS,
  buildKpiExcelTemplateBuffer,
  validateExcelImportRows
};
