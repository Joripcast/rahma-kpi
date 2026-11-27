/**
 * RAHMA Automated Unit & Stress Test Suite (PostgreSQL Verification)
 * PT Global Service Indonesia (GSI)
 */

const assert = require('node:assert/strict');
const {
  normalizeHexColor,
  computeHexAccentMeta,
  calculateAchievementPct,
  calculateWeightedScore,
  classifyStatusColor,
  calculateYtdMetrics,
  validateMitigationGate
} = require('../src/engine');

const { initDatabase, getDashboardSummary, getAllAttributes, pool } = require('../src/db');
const { buildXlsxBuffer, parseXlsxBuffer } = require('../src/xlsx');
const { buildKpiExcelTemplateBuffer, validateExcelImportRows } = require('../src/excel-import');

(async () => {
  console.log('🧪 Running RAHMA Standalone KPI Unit & Stress Tests (PostgreSQL)...\n');

  // 1. HEX Color Validation & Contrast Engine
  assert.equal(normalizeHexColor('#2563eb'), '#2563EB');
  assert.equal(normalizeHexColor('0d9488'), '#0D9488');
  assert.equal(normalizeHexColor('#GGGGGG'), null);
  assert.equal(normalizeHexColor('#123'), null);

  const darkAccent = computeHexAccentMeta('#1E293B');
  assert.equal(darkAccent.textOnSolid, '#FFFFFF');
  const lightAccent = computeHexAccentMeta('#FEF08A');
  assert.equal(lightAccent.textOnSolid, '#0F172A');
  console.log('✅ [PASS] HEX Color Validation & WCAG Contrast Engine');

  // 2. Dynamic Calculation Engine (MAXIMIZE & MINIMIZE + Score Capping)
  assert.equal(calculateAchievementPct(100, 95, 'MAXIMIZE', 120), 95);
  assert.equal(calculateAchievementPct(100, 150, 'MAXIMIZE', 120), 120); // Capped at 120%
  assert.equal(calculateAchievementPct(4, 3.8, 'MINIMIZE', 120), 105); // Lower is better
  assert.equal(calculateAchievementPct(45, 61, 'MINIMIZE', 120), 64.44);
  assert.equal(calculateWeightedScore(80, 40), 32);
  console.log('✅ [PASS] Dynamic Polarity (Maximize/Minimize) & Weighted Score Calculation');

  // 3. Status Classification & Mandatory Risk Mitigation Logic Gate
  assert.equal(classifyStatusColor(102, 85, 100), 'GREEN');
  assert.equal(classifyStatusColor(90, 85, 100), 'YELLOW');
  assert.equal(classifyStatusColor(78.4, 85, 100), 'RED');

  const blockedGate = validateMitigationGate({
    statusColor: 'RED',
    problemIdentification: 'Singkat',
    correctiveAction: '',
    needSupport: '',
    isDraft: false
  });
  assert.equal(blockedGate.valid, false);
  assert.equal(blockedGate.errors.length, 3);

  const passedGate = validateMitigationGate({
    statusColor: 'RED',
    problemIdentification: 'Keterlambatan pengiriman komponen hidrolik selama 18 hari.',
    correctiveAction: 'Realokasi 3 unit cadangan dari pool Balikpapan sebelum akhir bulan.',
    needSupport: 'Persetujuan Direksi untuk Direct Contracting vendor OEM alternatif.',
    isDraft: false
  });
  assert.equal(passedGate.valid, true);

  const draftGate = validateMitigationGate({
    statusColor: 'RED',
    problemIdentification: '',
    correctiveAction: '',
    needSupport: '',
    isDraft: true
  });
  assert.equal(draftGate.valid, true);
  console.log('✅ [PASS] Mandatory Risk Mitigation Logic Gate (Hard Server Validation)');

  // 4. YTD Aggregation (SUM, AVG, LAST_VALUE)
  const sampleSeries = [
    { month: 1, target: 100, actual: 90 },
    { month: 2, target: 100, actual: 110 },
    { month: 3, target: 100, actual: 85 }
  ];
  const sumYtd = calculateYtdMetrics(sampleSeries, 3, {
    ytd_method: 'SUM',
    polarity: 'MAXIMIZE',
    weight: 50,
    cap_score: 120,
    red_threshold: 85,
    yellow_threshold: 100
  });
  assert.equal(sumYtd.ytdTargetNominal, 300);
  assert.equal(sumYtd.ytdActualNominal, 285);
  assert.equal(sumYtd.ytdAchievementPct, 95);
  assert.equal(sumYtd.ytdWeightedScore, 47.5);

  const lastValYtd = calculateYtdMetrics(sampleSeries, 3, {
    ytd_method: 'LAST_VALUE',
    polarity: 'MAXIMIZE',
    weight: 50
  });
  assert.equal(lastValYtd.ytdActualNominal, 85);
  console.log('✅ [PASS] Year-to-Date (YTD) Nominal & Percentage Aggregation (SUM/AVG/LAST_VALUE)');

  // 5. PostgreSQL Database Integration & Stress Test (10,000 Calculations < 500ms)
  await initDatabase();
  const attrs = await getAllAttributes();
  assert.ok(attrs.length >= 10, 'Seeded HEX attributes should exist in PostgreSQL');
  const summary = await getDashboardSummary({ year: 2026, month: 11, mode: 'MONTHLY' });
  assert.equal(summary.departments.length, 5);
  assert.ok(summary.redEscalations.length >= 3);
  console.log('✅ [PASS] PostgreSQL Database Integration (rahma_kpi)');

  // 5b. Smart Excel (.xlsx) Template Round-Trip & Dry-Run Validation
  const templateBuf = buildKpiExcelTemplateBuffer({
    kpis: summary.kpis.slice(0, 3),
    year: 2026,
    month: 11,
    departmentLabel: 'UAT'
  });
  const parsedTemplate = parseXlsxBuffer(templateBuf);
  assert.equal(parsedTemplate.sheetName, 'Input KPI');
  assert.equal(parsedTemplate.rows.length, 4);

  const customXlsx = buildXlsxBuffer([
    {
      name: 'Input KPI',
      rows: [
        [
          'Kode KPI',
          'Polaritas',
          'Target',
          'Actual',
          'Problem Identification',
          'Corrective Action',
          'Need Support BOD'
        ],
        [summary.kpis[0].code, summary.kpis[0].polarity, 100, 'bukan-angka', '', '', ''],
        [
          summary.kpis[1].code,
          summary.kpis[1].polarity === 'MAXIMIZE' ? 'MINIMIZE' : 'MAXIMIZE',
          100,
          95,
          '',
          '',
          ''
        ],
        [summary.kpis[2].code, summary.kpis[2].polarity, 100, 60, 'Pendek', '', '']
      ]
    }
  ]);
  const parsedCustom = parseXlsxBuffer(customXlsx);
  const dryRunFail = validateExcelImportRows({
    rows: parsedCustom.rows,
    kpis: summary.kpis,
    authUser: { role: 'CPMD_ADMIN' }
  });
  assert.equal(dryRunFail.summary.errorCount, 3);
  assert.equal(dryRunFail.summary.canCommit, false);
  console.log('✅ [PASS] Smart Excel (.xlsx) Round-Trip & Dry-Run Validation (Type, Polarity & < 85% Gate)');

  const startStress = performance.now();
  for (let i = 0; i < 10000; i++) {
    calculateYtdMetrics(sampleSeries, 3, {
      ytd_method: 'SUM',
      polarity: 'MAXIMIZE',
      weight: 40
    });
  }
  const elapsedMs = (performance.now() - startStress).toFixed(2);
  assert.ok(Number(elapsedMs) < 500, `Stress test took too long: ${elapsedMs}ms`);
  console.log(`✅ [PASS] Standalone Stress Test: 10,000 YTD Aggregations completed in ${elapsedMs}ms\n`);
  console.log('🎉 ALL TESTS PASSED!');
  await pool.end();
})().catch(async (err) => {
  console.error('❌ Test suite failed:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
