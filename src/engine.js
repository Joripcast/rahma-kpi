/**
 * RAHMA Dynamic KPI Calculation Engine & Mandatory Mitigation Gate
 * PT Global Service Indonesia (GSI)
 */

const HEX_REGEX = /^#([A-Fa-f0-9]{6})$/;

/**
 * Validate and normalize a 6-digit HEX color string (#RRGGBB)
 */
function normalizeHexColor(input) {
  if (!input || typeof input !== 'string') return null;
  let cleaned = input.trim().toUpperCase();
  if (!cleaned.startsWith('#')) {
    cleaned = '#' + cleaned;
  }
  if (!HEX_REGEX.test(cleaned)) {
    return null;
  }
  return cleaned;
}

/**
 * Compute accessible foreground/background/border accents from any #RRGGBB HEX code
 */
function computeHexAccentMeta(hexColor) {
  const validHex = normalizeHexColor(hexColor) || '#2563EB';
  const r = parseInt(validHex.slice(1, 3), 16);
  const g = parseInt(validHex.slice(3, 5), 16);
  const b = parseInt(validHex.slice(5, 7), 16);

  // Relative luminance (WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textOnSolid = luminance > 0.62 ? '#0F172A' : '#FFFFFF';
  const softBg = `rgba(${r}, ${g}, ${b}, 0.14)`;
  const borderRgba = `rgba(${r}, ${g}, ${b}, 0.42)`;

  return {
    hex: validHex,
    rgb: { r, g, b },
    luminance: Number(luminance.toFixed(3)),
    textOnSolid,
    softBg,
    borderRgba
  };
}

/**
 * Calculate single-period or YTD achievement percentage based on polarity & score cap
 * @param {number} target
 * @param {number} actual
 * @param {'MAXIMIZE'|'MINIMIZE'} polarity
 * @param {number} capScore - maximum capped achievement % (default 120)
 */
function calculateAchievementPct(target, actual, polarity = 'MAXIMIZE', capScore = 120) {
  if (actual === null || actual === undefined || actual === '' || Number.isNaN(Number(actual))) {
    return null;
  }
  const numTarget = Number(target);
  const numActual = Number(actual);
  const maxCap = Number(capScore) > 0 ? Number(capScore) : 120;

  let rawPct = 0;
  if (polarity === 'MINIMIZE') {
    // Lower is better (e.g., Downtime, Cost, Incident Rate)
    if (numTarget === 0) {
      rawPct = numActual <= 0 ? 100 : 0;
    } else {
      rawPct = (2 - numActual / numTarget) * 100;
    }
  } else {
    // MAXIMIZE: Higher is better (e.g., Revenue, SLA, Project Delivery)
    if (numTarget === 0) {
      rawPct = numActual >= 0 ? 100 : 0;
    } else {
      rawPct = (numActual / numTarget) * 100;
    }
  }

  const clamped = Math.max(0, Math.min(maxCap, rawPct));
  return Number(clamped.toFixed(2));
}

/**
 * Calculate weighted score = Achievement (%) * (Weight / 100)
 */
function calculateWeightedScore(achievementPct, weight) {
  if (achievementPct === null || achievementPct === undefined) return null;
  const numWeight = Number(weight) || 0;
  return Number(((Number(achievementPct) * numWeight) / 100).toFixed(2));
}

/**
 * Determine traffic light status color based on configurable thresholds
 * Default: GREEN >= 100%, YELLOW >= redThreshold (default 85%), RED < redThreshold
 */
function classifyStatusColor(achievementPct, redThreshold = 85, yellowThreshold = 100) {
  if (achievementPct === null || achievementPct === undefined) {
    return 'UNREPORTED';
  }
  const pct = Number(achievementPct);
  const redLimit = Number(redThreshold ?? 85);
  const yellowLimit = Number(yellowThreshold ?? 100);

  if (pct >= yellowLimit) return 'GREEN';
  if (pct >= redLimit) return 'YELLOW';
  return 'RED';
}

/**
 * Calculate Year-To-Date (YTD) nominal & percentage accumulation (Jan .. targetMonth)
 * @param {Array<{month: number, target: number, actual: number|null}>} monthlySeries
 * @param {number} upToMonth - 1..12
 * @param {object} kpiConfig - { ytd_method: 'SUM'|'AVG'|'LAST_VALUE', polarity, weight, cap_score, red_threshold, yellow_threshold }
 */
function calculateYtdMetrics(monthlySeries, upToMonth, kpiConfig) {
  const method = kpiConfig.ytd_method || 'SUM';
  const polarity = kpiConfig.polarity || 'MAXIMIZE';
  const capScore = kpiConfig.cap_score ?? 120;
  const weight = kpiConfig.weight ?? 0;

  const relevant = (monthlySeries || [])
    .filter((item) => item.month >= 1 && item.month <= upToMonth)
    .sort((a, b) => a.month - b.month);

  const filled = relevant.filter(
    (item) => item.actual !== null && item.actual !== undefined && item.actual !== ''
  );

  if (filled.length === 0) {
    return {
      ytdTargetNominal: 0,
      ytdActualNominal: null,
      ytdAchievementPct: null,
      ytdWeightedScore: null,
      ytdStatusColor: 'UNREPORTED'
    };
  }

  let ytdTargetNominal = 0;
  let ytdActualNominal = 0;

  if (method === 'AVG') {
    const sumTarget = filled.reduce((acc, r) => acc + Number(r.target || 0), 0);
    const sumActual = filled.reduce((acc, r) => acc + Number(r.actual || 0), 0);
    ytdTargetNominal = Number((sumTarget / filled.length).toFixed(2));
    ytdActualNominal = Number((sumActual / filled.length).toFixed(2));
  } else if (method === 'LAST_VALUE') {
    const latest = filled[filled.length - 1];
    ytdTargetNominal = Number(Number(latest.target || 0).toFixed(2));
    ytdActualNominal = Number(Number(latest.actual || 0).toFixed(2));
  } else {
    // Default: SUM
    ytdTargetNominal = Number(
      filled.reduce((acc, r) => acc + Number(r.target || 0), 0).toFixed(2)
    );
    ytdActualNominal = Number(
      filled.reduce((acc, r) => acc + Number(r.actual || 0), 0).toFixed(2)
    );
  }

  const ytdAchievementPct = calculateAchievementPct(
    ytdTargetNominal,
    ytdActualNominal,
    polarity,
    capScore
  );
  const ytdWeightedScore = calculateWeightedScore(ytdAchievementPct, weight);
  const ytdStatusColor = classifyStatusColor(
    ytdAchievementPct,
    kpiConfig.red_threshold,
    kpiConfig.yellow_threshold
  );

  return {
    ytdTargetNominal,
    ytdActualNominal,
    ytdAchievementPct,
    ytdWeightedScore,
    ytdStatusColor
  };
}

/**
 * Mandatory Risk Mitigation Logic Gate
 * When statusColor === 'RED' and mode === 'submit', Problem ID, Corrective Action, and Need Support
 * MUST all be filled with meaningful text (>= 10 characters).
 */
function validateMitigationGate({
  statusColor,
  problemIdentification,
  correctiveAction,
  needSupport,
  isDraft = false
}) {
  if (isDraft || statusColor !== 'RED') {
    return {
      valid: true,
      requiresMitigation: statusColor === 'RED',
      errors: []
    };
  }

  const errors = [];
  const minLen = 10;

  const prob = (problemIdentification || '').trim();
  const corr = (correctiveAction || '').trim();
  const supp = (needSupport || '').trim();

  if (prob.length < minLen) {
    errors.push(
      'Problem Identification (Deteksi Akar Masalah) wajib diisi minimal 10 karakter karena status KPI Merah.'
    );
  }
  if (corr.length < minLen) {
    errors.push(
      'Corrective Action (Tindakan Perbaikan) wajib diisi minimal 10 karakter karena status KPI Merah.'
    );
  }
  if (supp.length < minLen) {
    errors.push(
      'Need Support (Bantuan Manajemen) wajib diisi minimal 10 karakter karena status KPI Merah.'
    );
  }

  return {
    valid: errors.length === 0,
    requiresMitigation: true,
    errors
  };
}

module.exports = {
  normalizeHexColor,
  computeHexAccentMeta,
  calculateAchievementPct,
  calculateWeightedScore,
  classifyStatusColor,
  calculateYtdMetrics,
  validateMitigationGate
};
