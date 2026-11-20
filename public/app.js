/**
 * RAHMA — Standalone SaaS KPI Monitoring Frontend Controller
 * PT Global Service Indonesia (GSI)
 */

const state = {
  currentUser: null,
  role: null,
  departmentId: null,
  year: 2026,
  month: 11,
  mode: 'MONTHLY', // 'MONTHLY' | 'YTD'
  redSpotlightOnly: false,
  activeTab: 'dashboard',
  hasUnsavedInputChanges: false,
  pendingNavTab: null,
  departments: [],
  attributes: [],
  dashboard: null,
  dashDeptFilter: 'ALL',
  dashAttrFilter: 'ALL',
  inputDeptFilter: 'ALL',
  dictDeptFilter: 'ALL',
  attrGroupFilter: 'ALL'
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const PHOSPHOR_OUTLINE_ICONS = {
  gauge: `<path d="M24,184V161.13C24,103.65,70.15,56.2,127.63,56A104,104,0,0,1,232,160v24a8,8,0,0,1-8,8H32A8,8,0,0,1,24,184Z"/><line x1="128" y1="56" x2="128" y2="88"/><line x1="54.46" y1="86.46" x2="77.09" y2="109.09"/><line x1="201.54" y1="86.46" x2="178.91" y2="109.09"/><line x1="128" y1="192" x2="176" y2="104"/>`,
  table: `<path d="M32,56H224V192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V56Z"/><line x1="32" y1="104" x2="224" y2="104"/><line x1="32" y1="152" x2="224" y2="152"/><line x1="88" y1="104" x2="88" y2="200"/>`,
  books: `<rect x="40" y="40" width="48" height="176" rx="8"/><line x1="40" y1="80" x2="88" y2="80"/><rect x="88" y="40" width="48" height="176" rx="8"/><line x1="88" y1="176" x2="136" y2="176"/><rect x="158" y="38.6" width="48" height="176" rx="8" transform="translate(-21.6 37.4) rotate(-12)"/><line x1="171.2" y1="179.2" x2="217.6" y2="169.3"/>`,
  palette: `<path d="M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89Z"/><circle cx="128" cy="76" r="10"/><circle cx="84" cy="100" r="10"/><circle cx="84" cy="148" r="10"/><circle cx="172" cy="100" r="10"/>`,
  'magnifying-glass': `<circle cx="112" cy="112" r="80"/><line x1="168.57" y1="168.57" x2="224" y2="224"/>`,
  'pencil-simple': `<path d="M92.69,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31L98.34,213.66A8,8,0,0,1,92.69,216Z"/><line x1="136" y1="64" x2="192" y2="120"/>`,
  trash: `<line x1="216" y1="56" x2="40" y2="56"/><line x1="104" y1="104" x2="104" y2="168"/><line x1="152" y1="104" x2="152" y2="168"/><path d="M200,56V208a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V56"/><path d="M168,56V40a16,16,0,0,0-16-16H104A16,16,0,0,0,88,40V56"/>`,
  plus: `<line x1="40" y1="128" x2="216" y2="128"/><line x1="128" y1="40" x2="128" y2="216"/>`,
  check: `<polyline points="40 144 96 200 224 72"/>`,
  'check-circle': `<circle cx="128" cy="128" r="96"/><polyline points="88 136 112 160 168 104"/>`,
  warning: `<path d="M114.15,39.8l-88,152A16,16,0,0,0,40,216H216a16,16,0,0,0,13.85-24.2l-88-152A16,16,0,0,0,114.15,39.8Z"/><line x1="128" y1="104" x2="128" y2="144"/><circle cx="128" cy="180" r="4"/>`,
  'warning-circle': `<circle cx="128" cy="128" r="96"/><line x1="128" y1="80" x2="128" y2="136"/><circle cx="128" cy="172" r="4"/>`,
  'warning-octagon': `<path d="M164.45,32H91.55a8,8,0,0,0-5.66,2.34L34.34,85.89A8,8,0,0,0,32,91.55v72.9a8,8,0,0,0,2.34,5.66l51.55,51.55A8,8,0,0,0,91.55,224h72.9a8,8,0,0,0,5.66-2.34l51.55-51.55a8,8,0,0,0,2.34-5.66V91.55a8,8,0,0,0-2.34-5.66L170.11,34.34A8,8,0,0,0,164.45,32Z"/><line x1="128" y1="80" x2="128" y2="136"/><circle cx="128" cy="172" r="4"/>`,
  'shield-warning': `<path d="M40,112V56a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8v56c0,96-88,120-88,120S40,208,40,112Z"/><line x1="128" y1="88" x2="128" y2="136"/><circle cx="128" cy="168" r="4"/>`,
  'shield-check': `<path d="M40,112V56a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8v56c0,96-88,120-88,120S40,208,40,112Z"/><polyline points="88 136 112 160 168 104"/>`,
  lifebuoy: `<circle cx="128" cy="128" r="96"/><circle cx="128" cy="128" r="40"/><line x1="99.72" y1="99.72" x2="60.12" y2="60.12"/><line x1="156.28" y1="99.72" x2="195.88" y2="60.12"/><line x1="156.28" y1="156.28" x2="195.88" y2="195.88"/><line x1="99.72" y1="156.28" x2="60.12" y2="195.88"/>`,
  'floppy-disk': `<path d="M216,91.31V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8H164.69a8,8,0,0,1,5.65,2.34l43.32,43.32A8,8,0,0,1,216,91.31Z"/><path d="M80,216V152a8,8,0,0,1,8-8h80a8,8,0,0,1,8,8v64"/><line x1="152" y1="72" x2="96" y2="72"/>`,
  'note-pencil': `<polyline points="128 160 96 160 96 128 192 32 224 64 128 160"/><line x1="168" y1="56" x2="200" y2="88"/><path d="M216,120v88a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8h88"/>`,
  clock: `<circle cx="128" cy="128" r="96"/><polyline points="128 72 128 128 184 128"/>`,
  copy: `<polyline points="168 168 216 168 216 40 88 40 88 88"/><rect x="40" y="88" width="128" height="128" rx="8"/>`,
  'lock-key': `<rect x="40" y="88" width="176" height="128" rx="8"/><path d="M88,88V56a40,40,0,0,1,80,0V88"/><circle cx="128" cy="140" r="16"/><line x1="128" y1="156" x2="128" y2="180"/>`,
  'lock-key-open': `<rect x="40" y="88" width="176" height="128" rx="8"/><path d="M88,88V56a40,40,0,0,1,78.78-9.78"/><circle cx="128" cy="140" r="16"/><line x1="128" y1="156" x2="128" y2="180"/>`,
  buildings: `<path d="M144,216V40a8,8,0,0,0-8-8H40a8,8,0,0,0-8,8V216"/><path d="M224,216V104a8,8,0,0,0-8-8H144"/><line x1="16" y1="216" x2="240" y2="216"/><line x1="64" y1="72" x2="80" y2="72"/><line x1="96" y1="72" x2="112" y2="72"/><line x1="64" y1="112" x2="80" y2="112"/><line x1="96" y1="112" x2="112" y2="112"/><line x1="64" y1="152" x2="80" y2="152"/><line x1="96" y1="152" x2="112" y2="152"/><line x1="176" y1="136" x2="192" y2="136"/><line x1="176" y1="176" x2="192" y2="176"/>`,
  'chart-line-up': `<polyline points="224 208 32 208 32 48"/><polyline points="200 72 128 144 96 112 32 176"/><polyline points="200 112 200 72 160 72"/>`,
  'chart-bar-horizontal': `<line x1="48" y1="40" x2="48" y2="216"/><rect x="48" y="56" width="128" height="32" rx="4"/><rect x="48" y="112" width="168" height="32" rx="4"/><rect x="48" y="168" width="96" height="32" rx="4"/>`,
  'squares-four': `<rect x="48" y="48" width="64" height="64" rx="8"/><rect x="144" y="48" width="64" height="64" rx="8"/><rect x="48" y="144" width="64" height="64" rx="8"/><rect x="144" y="144" width="64" height="64" rx="8"/>`,
  'sliders-horizontal': `<line x1="148" y1="172" x2="40" y2="172"/><line x1="216" y1="172" x2="188" y2="172"/><circle cx="168" cy="172" r="20"/><line x1="84" y1="84" x2="40" y2="84"/><line x1="216" y1="84" x2="124" y2="84"/><circle cx="104" cy="84" r="20"/>`,
  tag: `<path d="M40,126.63V48a8,8,0,0,1,8-8h78.63a8,8,0,0,1,5.65,2.34l90.51,90.51a8,8,0,0,1,0,11.32l-78.63,78.63a8,8,0,0,1-11.32,0L42.34,132.28A8,8,0,0,1,40,126.63Z"/><circle cx="84" cy="84" r="10"/>`,
  'trend-up': `<polyline points="232 56 136 152 96 112 24 184"/><polyline points="232 120 232 56 168 56"/>`,
  'trend-down': `<polyline points="232 200 136 104 96 144 24 72"/><polyline points="232 136 232 200 168 200"/>`,
  minus: `<line x1="40" y1="128" x2="216" y2="128"/>`,
  'arrows-clockwise': `<polyline points="176 104 224 104 224 56"/><path d="M188.4,188.4A88,88,0,0,1,65.77,188.4"/><polyline points="80 152 32 152 32 200"/><path d="M67.6,67.6A88,88,0,0,1,190.23,67.6L224,104"/><line x1="32" y1="152" x2="67.6" y2="188.4"/>`,
  'download-simple': `<line x1="128" y1="144" x2="128" y2="32"/><polyline points="216 144 216 208 40 208 40 144"/><polyline points="168 104 128 144 88 104"/>`,
  printer: `<polyline points="64 80 64 40 192 40 192 80"/><rect x="64" y="152" width="128" height="68"/><path d="M64,176H28a8,8,0,0,1-8-8V96c0-8.84,7.76-16,17.33-16H218.67C228.24,80,236,87.16,236,96v72a8,8,0,0,1-8,8H192"/><circle cx="188" cy="116" r="10"/>`
};

function phIcon(name, extraClass = '') {
  const inner = PHOSPHOR_OUTLINE_ICONS[name] || PHOSPHOR_OUTLINE_ICONS.gauge;
  return `<svg class="ph-icon ${extraClass}" viewBox="0 0 256 256" aria-hidden="true">${inner}</svg>`;
}

function showToast(message, isError = false) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${isError ? 'error' : ''}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 4200);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function computeClientHexAccent(hexInput) {
  let cleaned = String(hexInput || '#2563EB').trim().toUpperCase();
  if (!cleaned.startsWith('#')) cleaned = '#' + cleaned;
  const isValid = /^#([A-Fa-f0-9]{6})$/.test(cleaned);
  const hex = isValid ? cleaned : '#2563EB';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    isValid,
    hex,
    textOnSolid: lum > 0.62 ? '#0F172A' : '#FFFFFF',
    softBg: `rgba(${r}, ${g}, ${b}, 0.14)`,
    borderRgba: `rgba(${r}, ${g}, ${b}, 0.45)`
  };
}

function renderHexBadgesHtml(attributes = []) {
  if (!attributes || attributes.length === 0) {
    return `<span class="hex-badge" style="background:rgba(241,245,249,0.55);color:#64748b;border-color:rgba(255,255,255,0.7)">Tanpa Atribut</span>`;
  }
  return `<div class="attr-badges-wrap">${attributes
    .map((attr) => {
      const acc = attr.accent || computeClientHexAccent(attr.hex_color);
      return `<span class="hex-badge" style="background:${acc.softBg};color:#0f172a;border-color:${acc.borderRgba};box-shadow:0 4px 14px ${acc.hex}2e, inset 0 1px 0 rgba(255,255,255,0.78)" title="${escapeHtml(attr.attribute_group)}: ${escapeHtml(attr.name)} (${acc.hex})">
        <span class="hex-dot" style="background:${acc.hex};box-shadow:0 0 8px ${acc.hex}99"></span>
        ${escapeHtml(attr.name)}
      </span>`;
    })
    .join('')}</div>`;
}

function renderProblemIdentificationHtml(
  rawProblemText,
  mitigationTagObjects = [],
  fallbackText = 'Belum dilengkapi'
) {
  const str = String(rawProblemText || '').trim();
  const extractedTagNames = [];
  const tagRegex = /\[([^\]]+)\]/g;
  let match;
  while ((match = tagRegex.exec(str)) !== null) {
    const tName = match[1].trim();
    if (tName && !extractedTagNames.includes(tName)) {
      extractedTagNames.push(tName);
    }
  }

  if (extractedTagNames.length === 0 && Array.isArray(mitigationTagObjects)) {
    mitigationTagObjects.forEach((t) => {
      if (t && t.name && !extractedTagNames.includes(t.name)) {
        extractedTagNames.push(t.name);
      }
    });
  }

  const cleanInputText = str.replace(/\[[^\]]+\]\s*/g, '').trim();

  const pillsHtml =
    extractedTagNames.length > 0
      ? `<div class="prob-quick-tags-wrap">
          ${extractedTagNames
            .map((tagName) => {
              const matchedAttr =
                (mitigationTagObjects || []).find(
                  (a) => a && a.name && a.name.toLowerCase() === tagName.toLowerCase()
                ) ||
                (state.attributes || []).find(
                  (a) => a && a.name && a.name.toLowerCase() === tagName.toLowerCase()
                );
              const acc = matchedAttr
                ? matchedAttr.accent || computeClientHexAccent(matchedAttr.hex_color)
                : computeClientHexAccent('#DC2626');
              return `<span class="prob-quick-tag-pill" style="background:${acc.softBg};border-color:${acc.borderRgba};color:#0f172a">
                <span class="prob-tag-dot" style="background:${acc.hex}"></span>
                ${escapeHtml(tagName)}
              </span>`;
            })
            .join('')}
        </div>`
      : '';

  const displayBody =
    cleanInputText || (extractedTagNames.length > 0 ? '-' : fallbackText);

  return `${pillsHtml}<div class="prob-input-text">${escapeHtml(displayBody)}</div>`;
}

function renderSparklineSvg(sparkline = []) {
  const validPts = sparkline.filter((p) => p.achievement_pct !== null);
  if (validPts.length < 2) {
    return `<span style="font-size:11px;color:#94a3b8">Histori &lt;2 bln</span>`;
  }
  const width = 94;
  const height = 28;
  const minVal = Math.min(60, ...validPts.map((p) => p.achievement_pct));
  const maxVal = Math.max(115, ...validPts.map((p) => p.achievement_pct));
  const range = Math.max(10, maxVal - minVal);

  const coords = validPts.map((pt, idx) => {
    const x = Math.round((idx / (validPts.length - 1)) * (width - 12) + 6);
    const y = Math.round(height - 5 - ((pt.achievement_pct - minVal) / range) * (height - 10));
    return { x, y, pct: pt.achievement_pct, status: pt.status_color };
  });

  const pointsAttr = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const last = coords[coords.length - 1];
  const strokeColor =
    last.status === 'RED' ? '#DC2626' : last.status === 'YELLOW' ? '#F68400' : '#16A34A';

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible">
      <polyline fill="none" stroke="${strokeColor}" stroke-width="2" points="${pointsAttr}" />
      ${coords
        .map(
          (c, i) =>
            `<circle cx="${c.x}" cy="${c.y}" r="${i === coords.length - 1 ? 3.5 : 2}" fill="${
              c.status === 'RED' ? '#DC2626' : c.status === 'YELLOW' ? '#F68400' : '#16A34A'
            }" />`
        )
        .join('')}
    </svg>
  `;
}

function renderSpeedometerSvg(score = 0) {
  const clamped = Math.max(0, Math.min(120, Number(score || 0)));
  // Map 0..120 to angle -90..+90 degrees (matches Login page interactive gauge)
  const angleDeg = -90 + (clamped / 120) * 180;
  const barMarkerX = Math.round(20 + (clamped / 120) * 280);

  return `
    <svg width="320" height="148" viewBox="0 0 320 148" style="max-width:100%;height:auto;" aria-hidden="true">
      <!-- Red Zone Arc (0 - 85%) -->
      <path d="M 46 132 A 114 114 0 0 1 177 19" fill="none" stroke="#fca5a5" stroke-width="18" stroke-linecap="round"/>
      <!-- Yellow/Orange Zone Arc (85 - 100%) -->
      <path d="M 177 19 A 114 114 0 0 1 241 51" fill="none" stroke="#fde68a" stroke-width="18" />
      <!-- Green Zone Arc (100 - 120%) -->
      <path d="M 241 51 A 114 114 0 0 1 274 132" fill="none" stroke="#86efac" stroke-width="18" stroke-linecap="round"/>

      <!-- Active Needle (Rounded Line + Pivot Hub matching Login Gauge) -->
      <g class="speedometer-needle" style="transform: rotate(${angleDeg}deg); transform-origin: 160px 132px; transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);">
        <line x1="160" y1="132" x2="160" y2="42" stroke="#0F172A" stroke-width="5" stroke-linecap="round" />
        <circle cx="160" cy="132" r="8.5" fill="#0F172A" />
      </g>
    </svg>
    <div class="gauge-score-callout">${Number(score).toFixed(1)}%</div>
    <svg width="320" height="44" viewBox="0 0 320 44" style="max-width:100%;height:auto;" aria-hidden="true">
      <rect x="20" y="6" width="188" height="10" rx="5" fill="#fca5a5" />
      <rect x="212" y="6" width="44" height="10" rx="5" fill="#fde68a" />
      <rect x="260" y="6" width="40" height="10" rx="5" fill="#86efac" />
      <rect class="speedometer-marker" x="${barMarkerX - 4}" y="2" width="8" height="18" rx="4" fill="#0F172A" />
      <text x="20" y="34" font-size="11" font-weight="600" fill="#DC2626">0% (&lt;85%)</text>
      <text x="196" y="34" font-size="11" font-weight="600" fill="#92400E">85%</text>
      <text x="252" y="34" font-size="11" font-weight="600" fill="#065F46">100–120%</text>
    </svg>
  `;
}

// ============================================================================
// API FETCH & STATE SYNC
// ============================================================================
async function loadBootstrapAndDashboard() {
  try {
    const bootRes = await fetch('/api/bootstrap');
    if (bootRes.status === 401) {
      showLoginOverlay();
      return;
    }
    const bootData = await bootRes.json();
    if (bootData.currentUser) {
      setAuthenticatedUser(bootData.currentUser);
    }
    state.departments = bootData.departments || [];
    state.attributes = bootData.attributes || [];

    populateDepartmentSelects();
    populateAttributeSelects();
    await refreshDashboardData();
    await syncOfflineQueue(true);
  } catch (err) {
    if (!navigator.onLine || err instanceof TypeError) {
      if (restoreFromOfflineSnapshot()) {
        showToast('Koneksi terputus: menampilkan cadangan snapshot offline terakhir.');
        return;
      }
    }
    throw err;
  }
}

async function refreshDashboardData() {
  try {
    const url = `/api/dashboard?year=${state.year}&month=${state.month}&mode=${state.mode}`;
    const res = await fetch(url);
    if (res.status === 401) {
      showLoginOverlay();
      return;
    }
    state.dashboard = await res.json();
    if (Array.isArray(state.dashboard.departments)) {
      state.departments = state.dashboard.departments;
      populateDepartmentSelects();
    }

    const attrRes = await fetch('/api/attributes');
    if (attrRes.status === 401) {
      showLoginOverlay();
      return;
    }
    const attrData = await attrRes.json();
    state.attributes = attrData.attributes || [];

    populateAttributeSelects();
    saveOfflineSnapshot();
    updateOfflineStatusUi();
    state.hasUnsavedInputChanges = false;
    renderAllViews();
  } catch (err) {
    if (!navigator.onLine || err instanceof TypeError) {
      if (restoreFromOfflineSnapshot()) {
        showToast('Mode Offline aktif: data dimuat dari cadangan otomatis lokal.');
        return;
      }
    }
    throw err;
  }
}

function populateDepartmentSelects() {
  const dashSel = document.getElementById('dashDeptFilter');
  const inputSel = document.getElementById('inputDeptSelect');
  const dictSel = document.getElementById('dictDeptFilter');
  const formDept = document.getElementById('kpiFormDept');

  const deptOptions = state.departments
    .map((d) => `<option value="${d.id}">${escapeHtml(d.code)} — ${escapeHtml(d.name)}</option>`)
    .join('');

  dashSel.innerHTML = `<option value="ALL">Semua Departemen (${state.departments.length})</option>` + deptOptions;
  inputSel.innerHTML = `<option value="ALL">Semua Departemen (${state.departments.length})</option>` + deptOptions;
  dictSel.innerHTML = `<option value="ALL">Semua Departemen (${state.departments.length})</option>` + deptOptions;
  formDept.innerHTML = deptOptions;

  dashSel.value = state.dashDeptFilter;
  inputSel.value = state.inputDeptFilter;
  dictSel.value = state.dictDeptFilter;
}

function populateAttributeSelects() {
  const dashAttr = document.getElementById('dashAttrFilter');
  const currentVal = state.dashAttrFilter;
  dashAttr.innerHTML =
    `<option value="ALL">Semua Atribut Warna HEX (${state.attributes.length})</option>` +
    state.attributes
      .map(
        (a) =>
          `<option value="${a.id}">${escapeHtml(a.name)} (${a.hex_color})</option>`
      )
      .join('');
  dashAttr.value = currentVal;

  renderKpiFormAttributePicker();
}

// ============================================================================
// RENDER ALL VIEWS
// ============================================================================
function renderAllViews() {
  if (!state.dashboard) return;
  const d = state.dashboard;

  // Update Top & Print Meta
  const monthName = MONTH_NAMES[state.month - 1];
  document.getElementById('printReportMeta').textContent =
    `Periode: ${monthName} ${state.year} | Mode Evaluasi: ${
      state.mode === 'YTD' ? 'Akumulasi Year-to-Date (YTD)' : 'Bulan Berjalan (Monthly)'
    }`;

  // Update Red counters
  const redTotal = d.corporate.redCount;
  document.getElementById('navRedBadge').textContent = `${redTotal} Merah`;
  document.getElementById('spotlightCountBadge').textContent = `(${redTotal})`;

  renderExecutiveDashboard();
  renderSpreadsheetInputView();
  renderCpmdHubView();
  renderAttributesStudioView();
}

// ============================================================================
// VIEW 1: EXECUTIVE DASHBOARD
// ============================================================================
function renderExecutiveDashboard() {
  const d = state.dashboard;
  const corp = d.corporate;

  // 1. Corporate Speedometer (Section 9 Row 1 Left Card)
  document.getElementById('corporateGaugeContainer').innerHTML = renderSpeedometerSvg(
    corp.activeScore
  );
  document.getElementById('corpMonthlyVal').textContent = `Bulan Ini: ${corp.monthlyScore}%`;
  document.getElementById('corpYtdVal').textContent = `YTD: ${corp.ytdScore}%`;

  const corpPill = document.getElementById('corpStatusPill');
  corpPill.className = `status-pill status-${corp.statusColor}`;
  corpPill.textContent =
    corp.statusColor === 'GREEN'
      ? `On Track • ${corp.activeScore}%`
      : corp.statusColor === 'YELLOW'
      ? `Warning • ${corp.activeScore}%`
      : `Critical • ${corp.activeScore}%`;

  document.getElementById('activeModeLabel').textContent =
    state.mode === 'YTD'
      ? `Mode: Akumulasi YTD (Jan–${SHORT_MONTHS[state.month - 1]})`
      : `Mode: Bulan ${MONTH_NAMES[state.month - 1]} ${state.year}`;

  // Traffic Light Stats (Section 9 Row 1 Right Card Top)
  document.getElementById('statGreenCount').textContent = `${corp.greenCount} Indikator`;
  document.getElementById('statYellowCount').textContent = `${corp.yellowCount} Indikator`;
  document.getElementById('statRedCount').textContent = `${corp.redCount} Indikator`;

  // Dept Mini Gauges (Section 9 Row 1 Right Card Bottom: "Divisi FIN — 101.2%" + Bar)
  const miniContainer = document.getElementById('deptMiniGauges');
  miniContainer.innerHTML = d.departments
    .map((dept) => {
      const color =
        dept.statusColor === 'GREEN'
          ? '#16A34A'
          : dept.statusColor === 'YELLOW'
          ? '#F68400'
          : '#DC2626';
      const pctWidth = Math.min(100, Math.max(8, dept.activeScore));
      const badgeLabel =
        dept.counts.red > 0
          ? `${dept.counts.red} Merah`
          : dept.counts.yellow > 0
          ? `${dept.counts.yellow} Warning`
          : 'Aman';
      return `
        <div class="mini-dept-card">
          <div class="mini-dept-top">
            <span style="color:${color}">Divisi ${escapeHtml(dept.code)} — ${dept.activeScore}%</span>
            <span class="status-pill status-${dept.statusColor}" style="min-height:24px;padding:2px 8px;font-size:10.5px">
              ${badgeLabel}
            </span>
          </div>
          <div class="mini-progress-track">
            <div class="mini-progress-fill" style="width:${pctWidth}%;background:${color}"></div>
          </div>
          <div style="font-size:11px;font-weight:600;color:#475569">
            Monthly: ${dept.monthlyScore}% | YTD: ${dept.ytdScore}%
          </div>
        </div>
      `;
    })
    .join('');

  // 2. Bar Chart Comparison (Section 9 Row 2 Full-Width Memanjang)
  const barContainer = document.getElementById('deptBarChartContainer');
  barContainer.innerHTML = d.departments
    .map((dept) => {
      const mWidth = Math.min(100, Math.max(10, (dept.monthlyScore / 115) * 100));
      const yWidth = Math.min(100, Math.max(10, (dept.ytdScore / 115) * 100));
      const mColor =
        dept.monthlyScore >= 100 ? '#16A34A' : dept.monthlyScore >= 85 ? '#F68400' : '#DC2626';
      return `
        <div class="bar-row">
          <div class="bar-row-label">
            <span>${escapeHtml(dept.code)} — ${escapeHtml(dept.name)} (Bulan Ini: ${dept.monthlyScore}% | YTD: ${dept.ytdScore}%)</span>
          </div>
          <div class="bar-dual-tracks">
            <div class="bar-track" title="Skor Bulan Ini: ${dept.monthlyScore}%">
              <div class="bar-fill" style="width:${mWidth}%;background:${mColor}">
                Bulan Ini: ${dept.monthlyScore}%
              </div>
            </div>
            <div class="bar-track" title="Skor Akumulasi YTD: ${dept.ytdScore}%">
              <div class="bar-fill" style="width:${yWidth}%;background:#2563EB">
                Akumulasi YTD: ${dept.ytdScore}%
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  // 3. 12-Month Performance Heatmap Matrix (Section 9 Row 3 Full-Width)
  const heatmapEl = document.getElementById('heatmapContainer');
  heatmapEl.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Divisi</th>
          ${SHORT_MONTHS.map(
            (mName, idx) =>
              `<th style="text-align:center;${
                idx + 1 === state.month ? 'background:#dbeafe;color:#1e40af' : ''
              }">${mName}</th>`
          ).join('')}
          <th style="text-align:center">YTD</th>
        </tr>
      </thead>
      <tbody>
        ${d.departments
          .map(
            (dept) => `
          <tr>
            <td><strong>Divisi ${escapeHtml(dept.code)}</strong></td>
            ${dept.monthlyHeatmap
              .map(
                (cell) => `
              <td>
                <div class="heat-cell heat-${cell.status_color}">
                  ${cell.score !== null ? `${cell.score}%` : '-'}
                </div>
              </td>
            `
              )
              .join('')}
            <td>
              <div class="heat-cell heat-${classifyClientStatus(dept.ytdScore)}">
                ${dept.ytdScore}%
              </div>
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  // 4. Escalation & Need Support Board (Red KPIs — Essential Headline Summary + Drill-Down Button)
  const escBoard = document.getElementById('escalationBoardContainer');
  document.getElementById('escalationCountBadge').textContent =
    `${d.redEscalations.length} Indikator Kritis (Merah)`;

  if (d.redEscalations.length === 0) {
    escBoard.innerHTML = `<div style="padding:16px;background:#ecfdf5;color:#065f46;border-radius:15px;font-weight:700;display:flex;align-items:center;gap:8px">
      ${phIcon('check-circle')} Seluruh KPI Pada Periode Ini Berada Di Atas Ambang Batas Merah. Tidak Ada Eskalasi Kritis.
    </div>`;
  } else {
    escBoard.innerHTML = `
      <div class="escalation-grid">
        ${d.redEscalations
          .map(
            (k) => `
          <div class="escalation-item">
            <div class="kpi-left-accent-bar" style="background:#DC2626"></div>
            <div class="esc-header">
              <div>
                <span style="font-size:12px;font-weight:700;color:#64748b">${escapeHtml(
                  k.department_code
                )} • ${escapeHtml(k.code)}</span>
                <h4 style="font-size:15px;font-weight:700;color:#0f172a;margin:2px 0">${escapeHtml(
                  k.title
                )}</h4>
                ${renderHexBadgesHtml(k.attributes)}
              </div>
              <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:8px">
                <span class="status-pill status-RED">
                  ${phIcon('warning-octagon', 'ph-icon-sm')} Critical • ${k.current.achievement_pct ?? 0}%
                </span>
                <button type="button" class="btn-detail-trigger" data-detail-kpi="${k.id}">
                  ${phIcon('magnifying-glass')} Rincian &amp; Histori 12 Bln
                </button>
              </div>
            </div>
            <div class="esc-boxes">
              <div class="esc-box">
                <strong>${phIcon('warning-circle', 'ph-icon-sm')} Problem Identification (Deteksi Akar Masalah)</strong>
                ${renderProblemIdentificationHtml(
                  k.current.problem_identification,
                  k.current.mitigationTagObjects,
                  'Belum dilengkapi'
                )}
              </div>
              <div class="esc-box support-box">
                <strong>${phIcon('lifebuoy', 'ph-icon-sm')} Need Support BOD (Keputusan / Dukungan Manajemen)</strong>
                ${escapeHtml(k.current.need_support || 'Belum dilengkapi')}
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  // 5. Standar Kartu Indikator KPI (Penpot Section 8: Progressive Disclosure Summary Cards)
  let filteredKpis = d.kpis.slice();
  if (state.dashDeptFilter !== 'ALL') {
    filteredKpis = filteredKpis.filter((k) => k.department_id === state.dashDeptFilter);
  }
  if (state.dashAttrFilter !== 'ALL') {
    filteredKpis = filteredKpis.filter(
      (k) =>
        k.attributes.some((a) => a.id === state.dashAttrFilter) ||
        (k.current.mitigationTagIds || []).includes(state.dashAttrFilter)
    );
  }
  if (state.redSpotlightOnly) {
    filteredKpis = filteredKpis.filter((k) => {
      const st = state.mode === 'YTD' ? k.ytd.ytdStatusColor : k.current.status_color;
      return st === 'RED' || k.current.status_color === 'RED';
    });
  }

  const tableContainer = document.getElementById('execKpiTableContainer');
  tableContainer.innerHTML = `
    <div class="kpi-cards-stack">
      ${filteredKpis
        .map((k) => {
          const isYtd = state.mode === 'YTD';
          const activeStatus = isYtd ? k.ytd.ytdStatusColor : k.current.status_color;
          const activeAchPct = isYtd ? k.ytd.ytdAchievementPct : k.current.achievement_pct;
          const activeWeighted = isYtd ? k.ytd.ytdWeightedScore : k.current.weighted_score;
          const isRedCard = activeStatus === 'RED';

          const mom = k.momDeltaPct;
          const momHtml =
            mom === null
              ? `<span class="mom-badge mom-flat">${phIcon('minus', 'ph-icon-sm')} 0.0% MoM</span>`
              : mom > 0
              ? `<span class="mom-badge mom-up">${phIcon('trend-up', 'ph-icon-sm')} +${mom}% MoM</span>`
              : mom < 0
              ? `<span class="mom-badge mom-down">${phIcon('trend-down', 'ph-icon-sm')} ${mom}% MoM</span>`
              : `<span class="mom-badge mom-flat">${phIcon('minus', 'ph-icon-sm')} 0.0% MoM</span>`;

          const statusText =
            activeStatus === 'GREEN'
              ? 'On Track • Green'
              : activeStatus === 'YELLOW'
              ? 'Warning • Yellow'
              : activeStatus === 'RED'
              ? 'Red • Mitigasi'
              : 'Belum Input';

          return `
            <div class="kpi-standard-card ${isRedCard ? 'is-red-card' : ''}" data-detail-kpi="${k.id}" title="Klik untuk melihat perincian penuh indikator ${escapeHtml(k.code)}">
              <div class="kpi-left-accent-bar" style="background:${k.primaryAccent.hex}"></div>

              <div>
                <div class="kpi-card-title">
                  ${escapeHtml(k.code)} — ${escapeHtml(k.title)}
                </div>
                ${renderHexBadgesHtml(k.attributes)}
              </div>

              <div style="font-size:13px;font-weight:700;color:#334155">
                Divisi: ${escapeHtml(k.department_code)}
              </div>

              <div>
                <strong style="font-size:16px;font-weight:700;color:${isRedCard ? '#991B1B' : '#0F172A'}">
                  ${activeAchPct !== null ? `${activeAchPct}%` : '-'}
                </strong>
                <span style="font-size:13px;font-weight:600;color:#475569">
                  (Skor Bobot: ${activeWeighted ?? '-'})
                </span>
              </div>

              <div>${momHtml}</div>

              <div>
                <span class="status-pill status-${activeStatus}">
                  ${statusText}
                </span>
                ${k.current.is_draft ? `<div style="font-size:11px;color:#F68400;font-weight:700;margin-top:4px;text-align:center">Draft</div>` : ''}
              </div>

              <div style="text-align:right">
                <button type="button" class="${isRedCard ? 'btn-primary' : 'btn-outline'}" data-detail-kpi="${k.id}">
                  ${phIcon('magnifying-glass')} Lihat Rincian
                </button>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  bindDetailTriggerButtons(document.getElementById('tab-dashboard'));
}

function classifyClientStatus(score, red = 85, yellow = 100) {
  if (score === null || score === undefined) return 'UNREPORTED';
  if (score >= yellow) return 'GREEN';
  if (score >= red) return 'YELLOW';
  return 'RED';
}

// ============================================================================
// VIEW 2: INLINE SPREADSHEET INPUT & MANDATORY MITIGATION LOGIC GATE
// ============================================================================
function renderSpreadsheetInputView() {
  const d = state.dashboard;
  const container = document.getElementById('spreadsheetInputContainer');

  let kpis = d.kpis.slice();
  if (state.inputDeptFilter !== 'ALL') {
    kpis = kpis.filter((k) => k.department_id === state.inputDeptFilter);
  }
  if (state.redSpotlightOnly) {
    kpis = kpis.filter((k) => k.current.status_color === 'RED');
  }

  const mitigationQuickTags = state.attributes.filter(
    (a) => a.attribute_group === 'MITIGATION_TAG'
  );

  const isReadOnlyRole = state.role === 'EXECUTIVE';

  container.innerHTML = kpis
    .map((k, index) => {
      const isRed = k.current.status_color === 'RED';
      const isWrongDept = state.role === 'DIV_LEADER' && state.departmentId && k.department_id !== state.departmentId;
      const locked = k.current.is_locked || isReadOnlyRole || isWrongDept;
      const selectedTagIds = k.current.mitigationTagIds || [];

      return `
        <div class="kpi-input-row-card ${isRed ? 'gate-red-active' : ''}" id="row-card-${k.id}">
          <div class="kpi-left-accent-bar" style="background:${k.primaryAccent.hex}"></div>
          <div class="kpi-row-main">
            <!-- Col 1: KPI Identity & Multi-Badges (Clean Summary) -->
            <div>
              <div style="font-size:12px;font-weight:700;color:#64748b">
                ${escapeHtml(k.department_code)} • ${escapeHtml(k.code)}
              </div>
              <div style="font-size:15px;font-weight:700;color:#0f172a;margin:2px 0">
                ${escapeHtml(k.title)}
              </div>
              ${renderHexBadgesHtml(k.attributes)}
            </div>

            <!-- Col 2: Target Bulan Ini -->
            <div>
              <span class="micro-label">Target (${escapeHtml(k.unit)})</span>
              <input
                type="number"
                step="any"
                class="input-control target-input"
                data-kpi-id="${k.id}"
                value="${k.current.target_value}"
                ${locked ? 'disabled' : ''}
              />
            </div>

            <!-- Col 3: Actual Spreadsheet Input -->
            <div>
              <span class="micro-label">Actual (${escapeHtml(k.unit)}) *</span>
              <input
                type="number"
                step="any"
                class="kpi-input-number actual-input"
                data-kpi-id="${k.id}"
                data-row-index="${index}"
                placeholder="Masukkan Angka..."
                value="${k.current.actual_value !== null && k.current.actual_value !== undefined ? k.current.actual_value : ''}"
                ${locked ? 'disabled' : ''}
              />
            </div>

            <!-- Col 4: Live Achievement & Weighted Score -->
            <div id="live-calc-${k.id}">
              <span class="micro-label">Capaian &amp; Skor Bobot</span>
              <div style="font-size:18px;font-weight:700;color:#0f172a" class="live-ach-text">
                ${k.current.achievement_pct !== null ? `${k.current.achievement_pct}%` : '-'}
              </div>
              <div style="font-size:12px;color:#475569" class="live-weight-text">
                Skor Terbobot: <strong>${k.current.weighted_score ?? '-'}</strong>
              </div>
            </div>

            <!-- Col 5: Status Traffic Light & Perincian Trigger -->
            <div class="kpi-status-col">
              <span class="micro-label">Status &amp; Perincian</span>
              <div class="kpi-status-top">
                <span class="status-pill status-${k.current.status_color}" id="live-status-${k.id}">
                  ${k.current.status_color}
                </span>
                ${k.current.is_draft ? `<span style="font-size:11px;color:#F68400;font-weight:700;margin-left:4px">Draft</span>` : ''}
              </div>
              <button type="button" class="btn-outline" data-detail-kpi="${k.id}">
                ${phIcon('magnifying-glass')} Lihat Rincian
              </button>
            </div>

            <!-- Col 6: Actions -->
            <div class="kpi-actions-col">
              <span class="micro-label">Aksi Simpan</span>
              <button
                type="button"
                class="btn-primary btn-submit-kpi"
                data-kpi-id="${k.id}"
                ${locked ? 'disabled' : ''}
              >
                ${phIcon('floppy-disk')} Simpan Data
              </button>
              <button
                type="button"
                class="btn-secondary btn-draft-kpi"
                data-kpi-id="${k.id}"
                ${locked ? 'disabled' : ''}
              >
                ${phIcon('note-pencil')} Simpan Draft
              </button>
            </div>
          </div>

          <!-- MANDATORY RISK MITIGATION LOGIC GATE DRAWER -->
          <div
            class="mitigation-gate-drawer"
            id="gate-drawer-${k.id}"
            style="display:${isRed ? 'block' : 'none'}"
          >
            <div class="gate-banner-header">
              <div class="gate-warning-title">
                ${phIcon('shield-warning')} Gerbang Logika Mitigasi Wajib Isi (Capaian &lt; Ambang Batas Merah ${k.red_threshold}%)
              </div>
              <span style="font-size:12px;color:#991b1b;font-weight:600">
                Tombol Simpan Data Akan Menolak Penyimpanan Jika Ke-3 Kolom Di Bawah Ini Kosong!
              </span>
            </div>

            <!-- Quick-Tag Mitigation Chips (HEX Color-Coded) -->
            <div class="quick-tags-bar" data-kpi-id="${k.id}">
              <span style="font-size:12px;font-weight:700;color:#7f1d1d;display:inline-flex;align-items:center;gap:6px">${phIcon('tag', 'ph-icon-sm')} Quick-Tag Akar Masalah (Klik Untuk Sisipkan):</span>
              ${mitigationQuickTags
                .map((tag) => {
                  const isSel =
                    selectedTagIds.includes(tag.id) ||
                    (k.current.problem_identification || '').includes(`[${tag.name}]`);
                  return `<button
                    type="button"
                    class="quick-tag-chip ${isSel ? 'selected' : ''}"
                    data-kpi-id="${k.id}"
                    data-tag-id="${tag.id}"
                    data-tag-name="${escapeHtml(tag.name)}"
                    style="--tag-hex:${tag.accent.hex}e6;--tag-soft:${tag.accent.softBg};--tag-border:${tag.accent.borderRgba};--tag-text:${tag.accent.textOnSolid};--tag-glow:${tag.accent.hex}66"
                  >
                    <span class="hex-dot" style="background:${tag.accent.hex}"></span>
                    <span class="tag-check-icon">${phIcon('check', 'ph-icon-sm')}</span>
                    <span>${escapeHtml(tag.name)}</span>
                  </button>`;
                })
                .join('')}
            </div>

            <div class="mitigation-fields-grid">
              <div>
                <label>1. Problem Identification (Deteksi Akar Masalah) *</label>
                <textarea
                  rows="3"
                  id="prob-${k.id}"
                  placeholder="Jelaskan Akar Penyebab Utama Mengapa Target Tidak Tercapai (Min. 10 Karakter)..."
                  ${locked ? 'disabled' : ''}
                >${escapeHtml(k.current.problem_identification || '')}</textarea>
                <span class="input-error-helper" id="err-prob-${k.id}" style="display:none">
                  ${phIcon('warning-circle', 'ph-icon-sm')} Kolom Wajib Diisi Sesuai Format Standar Sebelum Submit.
                </span>
              </div>
              <div>
                <label>2. Corrective Action (Tindakan Perbaikan + Timeline + PIC) *</label>
                <textarea
                  rows="3"
                  id="corr-${k.id}"
                  placeholder="Contoh: [Tindakan Perbaikan Konkret] Sebelum [Tanggal Target] (PIC: Kepala Divisi)..."
                  ${locked ? 'disabled' : ''}
                >${escapeHtml(k.current.corrective_action || '')}</textarea>
                <span class="input-error-helper" id="err-corr-${k.id}" style="display:none">
                  ${phIcon('warning-circle', 'ph-icon-sm')} Kolom Wajib Diisi Sesuai Format Standar Sebelum Submit.
                </span>
              </div>
              <div>
                <label>3. Need Support (Bantuan / Keputusan Manajemen BOD) *</label>
                <textarea
                  rows="3"
                  id="supp-${k.id}"
                  placeholder="Dukungan Lintas Divisi Atau Persetujuan Direksi Yang Dibutuhkan..."
                  ${locked ? 'disabled' : ''}
                >${escapeHtml(k.current.need_support || '')}</textarea>
                <span class="input-error-helper" id="err-supp-${k.id}" style="display:none">
                  ${phIcon('warning-circle', 'ph-icon-sm')} Kolom Wajib Diisi Sesuai Format Standar Sebelum Submit.
                </span>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  bindSpreadsheetInputEvents();
}

function bindSpreadsheetInputEvents() {
  const kpiMap = new Map(state.dashboard.kpis.map((k) => [k.id, k]));

  // Live calculation preview on typing Actual or Target
  document.querySelectorAll('.actual-input, .target-input').forEach((inputEl) => {
    inputEl.addEventListener('input', () => {
      state.hasUnsavedInputChanges = true;
      const kpiId = inputEl.dataset.kpiId;
      const kpi = kpiMap.get(kpiId);
      if (!kpi) return;

      const card = document.getElementById(`row-card-${kpiId}`);
      const targetVal = Number(card.querySelector('.target-input').value || kpi.baseline_target);
      const actualRaw = card.querySelector('.actual-input').value;

      if (actualRaw === '' || actualRaw === null) return;
      const actualVal = Number(actualRaw);

      let rawPct = 0;
      if (kpi.polarity === 'MINIMIZE') {
        rawPct = targetVal === 0 ? (actualVal <= 0 ? 100 : 0) : (2 - actualVal / targetVal) * 100;
      } else {
        rawPct = targetVal === 0 ? 100 : (actualVal / targetVal) * 100;
      }
      const achPct = Number(Math.max(0, Math.min(kpi.cap_score || 120, rawPct)).toFixed(2));
      const wScore = Number(((achPct * kpi.weight) / 100).toFixed(2));
      const status = classifyClientStatus(achPct, kpi.red_threshold, kpi.yellow_threshold);

      // Update live DOM
      const calcBox = document.getElementById(`live-calc-${kpiId}`);
      calcBox.querySelector('.live-ach-text').textContent = `${achPct}%`;
      calcBox.querySelector('.live-weight-text').innerHTML =
        `Skor Terbobot: <strong>${wScore}</strong> / ${kpi.weight}`;

      const statusBadge = document.getElementById(`live-status-${kpiId}`);
      statusBadge.className = `status-pill status-${status}`;
      statusBadge.textContent = status;

      // Toggle Mandatory Mitigation Logic Gate Drawer
      const drawer = document.getElementById(`gate-drawer-${kpiId}`);
      if (status === 'RED') {
        drawer.style.display = 'block';
        card.classList.add('gate-red-active');
      } else {
        drawer.style.display = 'none';
        card.classList.remove('gate-red-active');
      }
    });

    // Enter key jumps to next row's Actual input like Excel
    if (inputEl.classList.contains('actual-input')) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const nextIdx = Number(inputEl.dataset.rowIndex) + 1;
          const nextInput = document.querySelector(`.actual-input[data-row-index="${nextIdx}"]`);
          if (nextInput) nextInput.focus();
        }
      });
    }
  });

  // Quick-Tag Mitigation Chip click -> toggles selection & adds/removes tag in Problem Identification
  document.querySelectorAll('.quick-tag-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.hasUnsavedInputChanges = true;
      const isNowSelected = chip.classList.toggle('selected');
      const kpiId = chip.dataset.kpiId;
      const tagName = chip.dataset.tagName;
      const probArea = document.getElementById(`prob-${kpiId}`);
      const tagPrefix = `[${tagName}]`;
      if (isNowSelected) {
        if (!probArea.value.includes(tagPrefix)) {
          probArea.value = `${tagPrefix} ` + probArea.value.trim();
        }
      } else {
        probArea.value = probArea.value.replace(tagPrefix, '').replace(/^\s+/, '');
      }
    });
  });

  // Save Draft & Submit Final Buttons
  document.querySelectorAll('.btn-submit-kpi').forEach((btn) => {
    btn.addEventListener('click', () => saveKpiRecord(btn.dataset.kpiId, false));
  });
  document.querySelectorAll('.btn-draft-kpi').forEach((btn) => {
    btn.addEventListener('click', () => saveKpiRecord(btn.dataset.kpiId, true));
  });

  bindDetailTriggerButtons(document.getElementById('tab-input'));

  document.querySelectorAll('#tab-input .escalation-grid textarea').forEach((ta) => {
    ta.addEventListener('input', () => {
      state.hasUnsavedInputChanges = true;
    });
  });
}

async function saveKpiRecord(kpiId, isDraft = false) {
  const card = document.getElementById(`row-card-${kpiId}`);
  const targetValue = card.querySelector('.target-input').value;
  const actualValue = card.querySelector('.actual-input').value;
  const probEl = document.getElementById(`prob-${kpiId}`);
  const corrEl = document.getElementById(`corr-${kpiId}`);
  const suppEl = document.getElementById(`supp-${kpiId}`);

  const problemIdentification = probEl?.value || '';
  const correctiveAction = corrEl?.value || '';
  const needSupport = suppEl?.value || '';

  // Reset inline error indicators
  [
    { el: probEl, errId: `err-prob-${kpiId}` },
    { el: corrEl, errId: `err-corr-${kpiId}` },
    { el: suppEl, errId: `err-supp-${kpiId}` }
  ].forEach(({ el, errId }) => {
    if (el) el.classList.remove('input-error');
    const errSpan = document.getElementById(errId);
    if (errSpan) errSpan.style.display = 'none';
  });

  const selectedChips = Array.from(
    card.querySelectorAll('.quick-tag-chip.selected')
  ).map((el) => el.dataset.tagId);

  const payload = {
    kpiId,
    year: state.year,
    month: state.month,
    targetValue,
    actualValue,
    problemIdentification,
    correctiveAction,
    needSupport,
    mitigationTagIds: selectedChips,
    isDraft,
    updatedBy: state.role
  };

  if (!navigator.onLine) {
    queueOfflineKpiSave(payload);
    state.hasUnsavedInputChanges = false;
    showToast('Offline: perubahan KPI dicadangkan otomatis & siap disinkronkan saat online.');
    return;
  }

  let res;
  try {
    res = await fetch('/api/records/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    queueOfflineKpiSave(payload);
    state.hasUnsavedInputChanges = false;
    showToast('Server tidak terjangkau: perubahan KPI dicadangkan otomatis di browser.');
    return;
  }

  const data = await res.json();
  if (!res.ok) {
    // Highlight specific missing mitigation fields per Design System Section 4 (Input Error)
    if (data.gateBlocked) {
      if (problemIdentification.trim().length < 10 && probEl) {
        probEl.classList.add('input-error');
        const s = document.getElementById(`err-prob-${kpiId}`);
        if (s) s.style.display = 'block';
      }
      if (correctiveAction.trim().length < 10 && corrEl) {
        corrEl.classList.add('input-error');
        const s = document.getElementById(`err-corr-${kpiId}`);
        if (s) s.style.display = 'block';
      }
      if (needSupport.trim().length < 10 && suppEl) {
        suppEl.classList.add('input-error');
        const s = document.getElementById(`err-supp-${kpiId}`);
        if (s) s.style.display = 'block';
      }
    }

    const errMsg = data.validationErrors
      ? `${data.error}\n• ${data.validationErrors.join('\n• ')}`
      : data.error;
    showToast(errMsg, true);
    return;
  }

  showToast(data.message, false);
  await refreshDashboardData();
}

// ============================================================================
// VIEW 3: CPMD HUB (SUBMISSION TRACKER & KAMUS KPI CRUD)
// ============================================================================
function renderCpmdHubView() {
  const d = state.dashboard;
  const tracker = d.submissionTracker;

  document.getElementById('trackerProgressBadge').textContent =
    `${tracker.submittedCount}/${tracker.totalDepartments} Divisi Selesai Submit Final`;

  const grid = document.getElementById('submissionTrackerGrid');
  grid.innerHTML = d.departments
    .map((dept) => {
      const stColor =
        dept.submissionStatus === 'SUBMITTED'
          ? 'GREEN'
          : dept.submissionStatus === 'DRAFT'
          ? 'YELLOW'
          : 'RED';
      const stText =
        dept.submissionStatus === 'SUBMITTED'
          ? `${phIcon('check-circle', 'ph-icon-sm')} SUBMITTED FINAL`
          : dept.submissionStatus === 'DRAFT'
          ? `${phIcon('note-pencil', 'ph-icon-sm')} MASIH DRAFT`
          : `${phIcon('clock', 'ph-icon-sm')} BELUM INPUT`;
      return `
        <div class="tracker-dept-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <strong>${escapeHtml(dept.code)}</strong>
            <span class="status-pill status-${stColor}">${stText}</span>
          </div>
          <div style="font-size:12.5px;font-weight:700;color:#0f172a">${escapeHtml(dept.name)}</div>
          <div style="font-size:11px;color:#64748b;margin:4px 0">${escapeHtml(dept.leader_name)}</div>
          <div style="font-size:11.5px;font-weight:800;color:#1e293b">
            Kelengkapan: ${dept.submittedFinalCount}/${dept.kpiCount} KPI Final
          </div>
        </div>
      `;
    })
    .join('');

  // Departments Master Table (CPMD Admin)
  const deptsContainer = document.getElementById('departmentsTableContainer');
  if (deptsContainer) {
    const isReadOnlyRole = state.role === 'EXECUTIVE' || state.role === 'DIV_LEADER';
    deptsContainer.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama Departemen &amp; Deskripsi</th>
            <th>Division Leader / PIC</th>
            <th>Jumlah KPI</th>
            <th>Aksi CRUD</th>
          </tr>
        </thead>
        <tbody>
          ${d.departments
            .map(
              (dept) => `
            <tr>
              <td><code>${escapeHtml(dept.code)}</code></td>
              <td>
                <strong>${escapeHtml(dept.name)}</strong>
                <div style="font-size:11.5px;color:#64748b">${escapeHtml(dept.description || '-')}</div>
              </td>
              <td>${escapeHtml(dept.leader_name)}</td>
              <td><strong>${dept.kpiCount} KPI</strong></td>
              <td>
                <div style="display:flex;gap:8px;align-items:center">
                  <button type="button" class="btn-ghost btn-edit-dept" data-dept-id="${dept.id}" style="min-height:36px;height:auto;padding:6px 14px;font-size:12px" ${isReadOnlyRole ? 'disabled' : ''}>
                    ${phIcon('pencil-simple', 'ph-icon-sm')} Ubah
                  </button>
                  <button type="button" class="btn-ghost btn-delete-dept" data-dept-id="${dept.id}" style="min-height:36px;height:auto;padding:6px 14px;font-size:12px;color:#dc2626" ${isReadOnlyRole ? 'disabled' : ''}>
                    ${phIcon('trash', 'ph-icon-sm')} Hapus
                  </button>
                </div>
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;

    deptsContainer.querySelectorAll('.btn-edit-dept').forEach((btn) => {
      btn.addEventListener('click', () => populateDeptFormForEdit(btn.dataset.deptId));
    });
    deptsContainer.querySelectorAll('.btn-delete-dept').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteDept(btn.dataset.deptId));
    });
  }

  // Weight Validation Banner
  const weightBanner = document.getElementById('weightValidationBanner');
  weightBanner.innerHTML = d.departments
    .map((dept) => {
      const ok = dept.isWeightValid;
      return `
        <span class="status-pill ${ok ? 'status-GREEN' : 'status-RED'}">
          ${ok ? phIcon('check-circle', 'ph-icon-sm') : phIcon('warning-circle', 'ph-icon-sm')} ${escapeHtml(dept.code)}: Total Bobot ${dept.totalWeight}% ${ok ? '(Valid 100%)' : '(Harus 100%)'}
        </span>
      `;
    })
    .join('');

  // Dictionary Table
  let dictKpis = d.kpis.slice();
  if (state.dictDeptFilter !== 'ALL') {
    dictKpis = dictKpis.filter((k) => k.department_id === state.dictDeptFilter);
  }

  const dictContainer = document.getElementById('dictionaryTableContainer');
  dictContainer.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Kode &amp; Nama KPI</th>
          <th>Divisi</th>
          <th>Bobot</th>
          <th>Multi-Atribut Warna HEX</th>
          <th>Aksi &amp; Perincian</th>
        </tr>
      </thead>
      <tbody>
        ${dictKpis
          .map(
            (k) => `
          <tr class="kpi-clickable-row" data-detail-kpi="${k.id}" style="border-left:4px solid ${k.primaryAccent.hex}">
            <td>
              <strong>${escapeHtml(k.code)}</strong> — ${escapeHtml(k.title)}
            </td>
            <td><strong>${escapeHtml(k.department_code)}</strong></td>
            <td><strong>${k.weight}%</strong></td>
            <td>${renderHexBadgesHtml(k.attributes)}</td>
            <td>
              <div style="display:flex;gap:8px;align-items:center">
                <button type="button" class="btn-detail-trigger" data-detail-kpi="${k.id}" style="min-height:36px;height:auto;padding:6px 14px;font-size:12px">${phIcon('magnifying-glass', 'ph-icon-sm')} Rincian</button>
                <button type="button" class="btn-ghost btn-edit-kpi" data-kpi-id="${k.id}" style="min-height:36px;height:auto;padding:6px 14px;font-size:12px">${phIcon('pencil-simple', 'ph-icon-sm')} Edit</button>
                <button type="button" class="btn-ghost btn-delete-kpi" data-kpi-id="${k.id}" style="min-height:36px;height:auto;padding:6px 14px;font-size:12px;color:#dc2626">${phIcon('trash', 'ph-icon-sm')} Hapus</button>
              </div>
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;

  document.querySelectorAll('.btn-edit-kpi').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      populateKpiFormForEdit(btn.dataset.kpiId);
    });
  });
  document.querySelectorAll('.btn-delete-kpi').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteKpi(btn.dataset.kpiId);
    });
  });

  bindDetailTriggerButtons(document.getElementById('tab-cpmd'));
}

function renderKpiFormAttributePicker(selectedIds = []) {
  const picker = document.getElementById('kpiFormAttributesPicker');
  if (!picker) return;
  const nonMitigationAttrs = state.attributes.filter(
    (a) => a.attribute_group !== 'MITIGATION_TAG'
  );
  picker.innerHTML = nonMitigationAttrs
    .map((a) => {
      const checked = selectedIds.includes(a.id) ? 'checked' : '';
      return `
        <label class="attr-check-pill" style="background:${a.accent.softBg};border:1px solid ${a.accent.borderRgba};color:#0f172a">
          <input type="checkbox" name="kpiAttrCheckbox" value="${a.id}" ${checked} />
          <span class="hex-dot" style="background:${a.hex_color}"></span>
          <span>${escapeHtml(a.name)}</span>
          <code>${a.hex_color}</code>
        </label>
      `;
    })
    .join('');
}

function populateKpiFormForEdit(kpiId) {
  const kpi = state.dashboard.kpis.find((item) => item.id === kpiId);
  if (!kpi) return;

  document.getElementById('kpiFormTitle').innerHTML = `${phIcon('pencil-simple')} Edit Kamus KPI: ${escapeHtml(kpi.code)}`;
  document.getElementById('kpiFormId').value = kpi.id;
  document.getElementById('kpiFormDept').value = kpi.department_id;
  document.getElementById('kpiFormCode').value = kpi.code;
  document.getElementById('kpiFormTitleInput').value = kpi.title;
  document.getElementById('kpiFormUnit').value = kpi.unit;
  document.getElementById('kpiFormWeight').value = kpi.weight;
  document.getElementById('kpiFormTarget').value = kpi.baseline_target;
  document.getElementById('kpiFormPolarity').value = kpi.polarity;
  document.getElementById('kpiFormYtdMethod').value = kpi.ytd_method;
  document.getElementById('kpiFormRedThreshold').value = kpi.red_threshold;

  renderKpiFormAttributePicker(kpi.attributes.map((a) => a.id));
  openModalById('kpiCrudModalOverlay');
}

async function handleDeleteKpi(kpiId) {
  const res = await fetch(`/api/kpis/${kpiId}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || 'Gagal menghapus KPI', true);
    return;
  }
  showToast(data.message);
  await refreshDashboardData();
}

// ============================================================================
// VIEW 4: CRUD NAMA ATRIBUT KPI & WARNA AKSEN TINGKAT HEX (#RRGGBB)
// ============================================================================
function renderAttributesStudioView() {
  const catalog = document.getElementById('attributesCatalogContainer');
  let attrs = state.attributes.slice();
  if (state.attrGroupFilter !== 'ALL') {
    attrs = attrs.filter((a) => a.attribute_group === state.attrGroupFilter);
  }

  catalog.innerHTML = attrs
    .map((a) => {
      const acc = a.accent || computeClientHexAccent(a.hex_color);
      return `
        <div class="attr-catalog-card" style="border-left:6px solid ${acc.hex}">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
              <span style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase">${escapeHtml(
                a.attribute_group
              )}</span>
              <code style="font-weight:800;font-size:11.5px;background:#f1f5f9;padding:2px 6px;border-radius:4px">${
                acc.hex
              }</code>
            </div>

            <div style="margin:8px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="attr-badge-solid" style="background:${acc.hex};color:${acc.textOnSolid}">
                ${escapeHtml(a.name)}
              </span>
              <span class="hex-badge" style="background:${acc.softBg};border-color:${acc.borderRgba};color:#0f172a">
                <span class="hex-dot" style="background:${acc.hex}"></span>
                Soft Badge
              </span>
            </div>

            <p style="font-size:11.5px;color:#475569">${escapeHtml(
              a.description || 'Tidak ada deskripsi tambahan.'
            )}</p>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;padding-top:8px">
            <span style="font-size:11px;color:#64748b;font-weight:600">
              Digunakan: <strong>${a.usage_count || 0} KPI</strong>
            </span>
            <div style="display:flex;gap:8px;align-items:center">
              <button type="button" class="btn-ghost btn-edit-attr" data-attr-id="${a.id}" style="min-height:36px;height:auto;padding:6px 14px;font-size:12px">
                ${phIcon('pencil-simple', 'ph-icon-sm')} Ubah Nama / HEX
              </button>
              <button type="button" class="btn-ghost btn-delete-attr" data-attr-id="${a.id}" style="min-height:36px;height:auto;padding:6px 14px;font-size:12px;color:#dc2626">
                ${phIcon('trash', 'ph-icon-sm')} Hapus
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  document.querySelectorAll('.btn-edit-attr').forEach((btn) => {
    btn.addEventListener('click', () => populateAttrFormForEdit(btn.dataset.attrId));
  });
  document.querySelectorAll('.btn-delete-attr').forEach((btn) => {
    btn.addEventListener('click', () => handleDeleteAttr(btn.dataset.attrId));
  });

  updateHexLivePreview();
}

function updateHexLivePreview() {
  const nameVal = document.getElementById('attrFormName').value.trim() || 'Contoh Atribut KPI';
  const hexInput = document.getElementById('attrFormHexInput').value;
  const meta = computeClientHexAccent(hexInput);

  const statusEl = document.getElementById('hexValidStatus');
  if (meta.isValid) {
    statusEl.innerHTML = `${phIcon('check-circle', 'ph-icon-sm')} Valid HEX (${meta.hex})`;
    statusEl.style.background = '#ecfdf5';
    statusEl.style.color = '#065f46';
    document.getElementById('attrFormColorPicker').value = meta.hex;
  } else {
    statusEl.innerHTML = `${phIcon('warning-circle', 'ph-icon-sm')} Gunakan #RRGGBB`;
    statusEl.style.background = '#fef2f2';
    statusEl.style.color = '#991b1b';
  }

  const solidBadge = document.getElementById('previewSolidBadge');
  solidBadge.textContent = `${nameVal} (${meta.hex})`;
  solidBadge.style.background = meta.hex;
  solidBadge.style.color = meta.textOnSolid;

  const tintBadge = document.getElementById('previewTintBadge');
  tintBadge.textContent = `${nameVal} (Soft Accent)`;
  tintBadge.style.background = meta.softBg;
  tintBadge.style.border = `1px solid ${meta.borderRgba}`;
  tintBadge.style.color = '#0f172a';

  const rowBar = document.getElementById('previewRowAccent');
  rowBar.style.borderLeftColor = meta.hex;
  document.getElementById('previewContrastMeta').textContent =
    `HEX: ${meta.hex} | Teks Solid: ${meta.textOnSolid}`;
}

function populateAttrFormForEdit(attrId) {
  const attr = state.attributes.find((a) => a.id === attrId);
  if (!attr) return;
  document.getElementById('attrFormHeading').innerHTML = `${phIcon('pencil-simple')} Edit Atribut &amp; Warna HEX: ${escapeHtml(attr.name)}`;
  document.getElementById('attrFormId').value = attr.id;
  document.getElementById('attrFormName').value = attr.name;
  document.getElementById('attrFormGroup').value = attr.attribute_group;
  document.getElementById('attrFormHexInput').value = attr.hex_color;
  document.getElementById('attrFormColorPicker').value = attr.hex_color;
  document.getElementById('attrFormDesc').value = attr.description || '';
  updateHexLivePreview();
  openModalById('attrCrudModalOverlay');
}

async function handleDeleteAttr(attrId) {
  const res = await fetch(`/api/attributes/${attrId}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || 'Gagal menghapus atribut', true);
    return;
  }
  showToast(data.message);
  await refreshDashboardData();
}

// ============================================================================
// GLOBAL EVENT LISTENERS & INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar Tab Switching (with Unsaved Changes Guard)
  function switchToTab(tab) {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    state.activeTab = tab;
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) panel.classList.add('active');
  }

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      if (
        state.activeTab === 'input' &&
        state.hasUnsavedInputChanges &&
        targetTab !== 'input' &&
        getAccountPrefs().confirmUnsaved !== false
      ) {
        state.pendingNavTab = targetTab;
        openModalById('unsavedNavModalOverlay');
        return;
      }
      switchToTab(targetTab);
    });
  });

  const btnCancelNavLeave = document.getElementById('btnCancelNavLeave');
  const btnConfirmNavLeave = document.getElementById('btnConfirmNavLeave');
  if (btnCancelNavLeave) {
    btnCancelNavLeave.addEventListener('click', () => {
      state.pendingNavTab = null;
      closeModalById('unsavedNavModalOverlay');
    });
  }
  if (btnConfirmNavLeave) {
    btnConfirmNavLeave.addEventListener('click', () => {
      const nextTab = state.pendingNavTab;
      state.pendingNavTab = null;
      state.hasUnsavedInputChanges = false;
      closeModalById('unsavedNavModalOverlay');
      if (nextTab) {
        switchToTab(nextTab);
      }
    });
  }

  // Logout -> clear session and redirect to dedicated Login page
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login.html?reason=logged_out');
  });

  // Month Selector
  document.getElementById('monthSelect').addEventListener('change', async (e) => {
    state.month = Number(e.target.value);
    await refreshDashboardData();
  });

  // Monthly vs YTD Mode Toggle
  document.querySelectorAll('#calcModeToggle .seg-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('#calcModeToggle .seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      await refreshDashboardData();
    });
  });

  // Red-Only Spotlight Toggle
  document.getElementById('btnRedSpotlight').addEventListener('click', (e) => {
    state.redSpotlightOnly = !state.redSpotlightOnly;
    e.currentTarget.classList.toggle('active', state.redSpotlightOnly);
    renderAllViews();
    showToast(
      state.redSpotlightOnly
        ? '🔴 Mode Fokus Indikator Merah aktif: hanya menampilkan KPI berstatus Merah.'
        : 'Menampilkan kembali seluruh indikator KPI (Hijau, Kuning, Merah).'
    );
  });

  // One-Click Executive PDF Report
  document.getElementById('btnExportPdf').addEventListener('click', () => {
    window.print();
  });

  // Backup JSON Export (supports offline local snapshot download)
  document.getElementById('btnExportBackup').addEventListener('click', () => {
    if (!navigator.onLine) {
      downloadOfflineSnapshotFile();
      return;
    }
    window.open('/api/export/backup', '_blank');
  });

  // Offline Auto-Backup & Sync Listeners
  initOfflineAutoBackup();

  // Filters
  document.getElementById('dashDeptFilter').addEventListener('change', (e) => {
    state.dashDeptFilter = e.target.value;
    renderExecutiveDashboard();
  });
  document.getElementById('dashAttrFilter').addEventListener('change', (e) => {
    state.dashAttrFilter = e.target.value;
    renderExecutiveDashboard();
  });
  document.getElementById('inputDeptSelect').addEventListener('change', (e) => {
    state.inputDeptFilter = e.target.value;
    renderSpreadsheetInputView();
  });
  document.getElementById('dictDeptFilter').addEventListener('change', (e) => {
    state.dictDeptFilter = e.target.value;
    renderCpmdHubView();
  });
  document.getElementById('attrGroupFilter').addEventListener('change', (e) => {
    state.attrGroupFilter = e.target.value;
    renderAttributesStudioView();
  });

  // 1-Click Copy Follow-Up Reminder (Anti-Debt-Collector for CPMD)
  document.getElementById('btnCopyFollowUp').addEventListener('click', async () => {
    const pending = state.dashboard?.submissionTracker?.pendingDepartments || [];
    const monthName = MONTH_NAMES[state.month - 1];
    let text = '';
    if (pending.length === 0) {
      text = `[RAHMA KPI PT GSI] Seluruh departemen telah menyelesaikan Submit Final laporan KPI periode ${monthName} ${state.year}. Terima kasih.`;
    } else {
      text =
        `📢 *[REMINDER PELAPORAN KPI RAHMA — PT GLOBAL SERVICE INDONESIA]*\n` +
        `Periode: *${monthName} ${state.year}*\n\n` +
        `Yth. Bapak/Ibu Division Leader, mohon kesediaannya untuk menyelesaikan Submit Final realisasi KPI beserta rencana mitigasi (jika ada indikator Merah) pada sistem RAHMA untuk divisi berikut:\n` +
        pending
          .map(
            (p, idx) =>
              `${idx + 1}. *${p.code} (${p.name})* — PIC: ${p.leader_name} [Status: ${p.status} | ${p.progress}]`
          )
          .join('\n') +
        `\n\nTerima kasih atas kerja samanya.\n— *Divisi CPMD PT GSI*`;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Teks pengingat WhatsApp/Email berhasil disalin ke Clipboard!');
    } catch {
      showToast(text);
    }
  });

  // Lock Period Toggle
  let periodLocked = false;
  document.getElementById('btnLockPeriod').addEventListener('click', async (e) => {
    periodLocked = !periodLocked;
    const res = await fetch('/api/records/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: state.year,
        month: state.month,
        locked: periodLocked
      })
    });
    const data = await res.json();
    e.currentTarget.innerHTML = periodLocked
      ? `${phIcon('lock-key-open')} Buka Kunci Periode Pelaporan`
      : `${phIcon('lock-key')} Kunci Periode Pelaporan`;
    showToast(data.message);
    await refreshDashboardData();
  });

  // CRUD Kamus KPI Form Submit
  document.getElementById('kpiCrudForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('kpiFormId').value;
    const selectedAttrIds = Array.from(
      document.querySelectorAll('input[name="kpiAttrCheckbox"]:checked')
    ).map((cb) => cb.value);

    const payload = {
      department_id: document.getElementById('kpiFormDept').value,
      code: document.getElementById('kpiFormCode').value,
      title: document.getElementById('kpiFormTitleInput').value,
      unit: document.getElementById('kpiFormUnit').value,
      weight: Number(document.getElementById('kpiFormWeight').value),
      baseline_target: Number(document.getElementById('kpiFormTarget').value),
      polarity: document.getElementById('kpiFormPolarity').value,
      ytd_method: document.getElementById('kpiFormYtdMethod').value,
      red_threshold: Number(document.getElementById('kpiFormRedThreshold').value),
      attributeIds: selectedAttrIds
    };

    const url = editId ? `/api/kpis/${editId}` : '/api/kpis';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Gagal menyimpan Kamus KPI', true);
      return;
    }

    showToast(data.message);
    resetKpiCrudForm();
    closeModalById('kpiCrudModalOverlay');
    await refreshDashboardData();
  });

  document.getElementById('btnResetKpiForm').addEventListener('click', () => {
    resetKpiCrudForm();
    closeModalById('kpiCrudModalOverlay');
  });

  // HEX Studio Live Sync
  const colorPicker = document.getElementById('attrFormColorPicker');
  const hexInput = document.getElementById('attrFormHexInput');
  const attrNameInput = document.getElementById('attrFormName');

  colorPicker.addEventListener('input', (e) => {
    hexInput.value = e.target.value.toUpperCase();
    updateHexLivePreview();
  });

  hexInput.addEventListener('input', () => {
    updateHexLivePreview();
  });

  attrNameInput.addEventListener('input', () => {
    updateHexLivePreview();
  });

  document.querySelectorAll('#hexPresetSwatches .swatch-btn').forEach((sw) => {
    sw.addEventListener('click', () => {
      const hex = sw.dataset.hex;
      hexInput.value = hex;
      colorPicker.value = hex;
      updateHexLivePreview();
    });
  });

  // CRUD Attribute Form Submit
  document.getElementById('attributeCrudForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('attrFormId').value;
    const payload = {
      name: document.getElementById('attrFormName').value,
      attribute_group: document.getElementById('attrFormGroup').value,
      hex_color: document.getElementById('attrFormHexInput').value,
      description: document.getElementById('attrFormDesc').value
    };

    const url = editId ? `/api/attributes/${editId}` : '/api/attributes';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Gagal menyimpan atribut KPI', true);
      return;
    }

    showToast(data.message);
    resetAttrCrudForm();
    closeModalById('attrCrudModalOverlay');
    await refreshDashboardData();
  });

  document.getElementById('btnResetAttrForm').addEventListener('click', () => {
    resetAttrCrudForm();
    closeModalById('attrCrudModalOverlay');
  });

  // CRUD Master Departemen Form Submit (CPMD Admin)
  const deptForm = document.getElementById('deptCrudForm');
  if (deptForm) {
    deptForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.role !== 'CPMD_ADMIN') {
        showToast('Hanya role CPMD Admin yang dapat mengubah Master Departemen.', true);
        return;
      }
      const editId = document.getElementById('deptFormId').value;
      const payload = {
        code: document.getElementById('deptFormCode').value,
        name: document.getElementById('deptFormName').value,
        leader_name: document.getElementById('deptFormLeader').value,
        description: document.getElementById('deptFormDesc').value
      };

      const url = editId ? `/api/departments/${editId}` : '/api/departments';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan departemen', true);
        return;
      }

      showToast(data.message);
      resetDeptCrudForm();
      closeModalById('deptCrudModalOverlay');
      await refreshDashboardData();
    });
  }
  const btnResetDept = document.getElementById('btnResetDeptForm');
  if (btnResetDept) {
    btnResetDept.addEventListener('click', () => {
      resetDeptCrudForm();
      closeModalById('deptCrudModalOverlay');
    });
  }

  // Modal Open Triggers (+ Tambah Departemen / + Tambah KPI / + Tambah Atribut HEX)
  const btnNewDept = document.getElementById('btnOpenNewDeptModal');
  if (btnNewDept) {
    btnNewDept.addEventListener('click', () => {
      resetDeptCrudForm();
      openModalById('deptCrudModalOverlay');
    });
  }
  const btnNewKpi = document.getElementById('btnOpenNewKpiModal');
  if (btnNewKpi) {
    btnNewKpi.addEventListener('click', () => {
      resetKpiCrudForm();
      openModalById('kpiCrudModalOverlay');
    });
  }
  const btnNewAttr = document.getElementById('btnOpenNewAttrModal');
  if (btnNewAttr) {
    btnNewAttr.addEventListener('click', () => {
      resetAttrCrudForm();
      openModalById('attrCrudModalOverlay');
    });
  }

  // Unified Modal Close Listeners (Close button, Overlay Backdrop click, Esc key)
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModalById(btn.dataset.closeModal));
  });
  document.getElementById('btnCloseKpiModal').addEventListener('click', closeKpiDetailModal);
  document.querySelectorAll('.kpi-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModalById(overlay.id);
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // Retractable Sidebar Toggle (Persisted in localStorage)
  const sidebarToggleBtn = document.getElementById('btnToggleSidebar');
  if (sidebarToggleBtn) {
    const savedCollapsed = localStorage.getItem('rahma_sidebar_collapsed') === '1';
    if (savedCollapsed) {
      document.body.classList.add('sidebar-collapsed');
      sidebarToggleBtn.setAttribute('aria-expanded', 'false');
    }
    sidebarToggleBtn.addEventListener('click', () => {
      const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
      sidebarToggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
      localStorage.setItem('rahma_sidebar_collapsed', isCollapsed ? '1' : '0');
    });
  }

  initWallpaperStudio();
  initAccountSettingsModal();
  checkAuthAndBoot();
});

// ============================================================================
// REAL AUTHENTICATION & STRICT RBAC UI ENFORCEMENT
// ============================================================================
function showLoginOverlay(reason = '') {
  const qs = reason === 'logged_out' ? '?reason=logged_out' : '';
  window.location.replace(`/login.html${qs}`);
}

function hideLoginOverlay() {
  // No-op: login is a standalone page (/login.html)
}

function getUserInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] || '?').slice(0, 2).toUpperCase();
}

function getAvatarStorageKey() {
  const userKey = state.currentUser?.id || state.currentUser?.email || 'guest';
  return `rahma_avatar_${userKey}`;
}

function renderUserAvatar() {
  const miniEl = document.getElementById('userAvatarMini');
  const modalEl = document.getElementById('accountModalAvatarPreview');
  const resetBtn = document.getElementById('btnResetAvatar');
  const savedAvatar = localStorage.getItem(getAvatarStorageKey());
  const initials = getUserInitials(state.currentUser?.name);

  [miniEl, modalEl].forEach((el) => {
    if (!el) return;
    if (savedAvatar) {
      el.style.backgroundImage = `url("${savedAvatar}")`;
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = initials;
    }
  });

  if (resetBtn) {
    resetBtn.style.display = savedAvatar ? '' : 'none';
  }
}

function compressAvatarImage(dataUrl, size = 256, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const minDim = Math.min(img.width, img.height);
      const sx = Math.round((img.width - minDim) / 2);
      const sy = Math.round((img.height - minDim) / 2);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function getAccountPrefsKey() {
  const userKey = state.currentUser?.id || state.currentUser?.email || 'guest';
  return `rahma_prefs_${userKey}`;
}

function getAccountPrefs() {
  try {
    return {
      defaultMode: 'MONTHLY',
      confirmUnsaved: true,
      ...JSON.parse(localStorage.getItem(getAccountPrefsKey()) || '{}')
    };
  } catch {
    return { defaultMode: 'MONTHLY', confirmUnsaved: true };
  }
}

function saveAccountPrefs(nextPrefs) {
  try {
    localStorage.setItem(getAccountPrefsKey(), JSON.stringify(nextPrefs));
  } catch {
    // Ignore storage quota errors
  }
}

function initAccountSettingsModal() {
  const profileCard = document.getElementById('userProfileCard');
  const uploadBtn = document.getElementById('btnUploadAvatar');
  const resetBtn = document.getElementById('btnResetAvatar');
  const fileInput = document.getElementById('avatarFileInput');

  // Branch tab switching inside modal
  document.querySelectorAll('.settings-branch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.branch;
      document.querySelectorAll('.settings-branch-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.settings-branch-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(`branch-${target}`);
      if (panel) panel.classList.add('active');
    });
  });

  if (profileCard) {
    profileCard.addEventListener('click', () => {
      renderUserAvatar();
      const prefs = getAccountPrefs();
      const defModeEl = document.getElementById('prefDefaultMode');
      const confirmUnsavedEl = document.getElementById('prefConfirmUnsaved');
      if (defModeEl) defModeEl.value = prefs.defaultMode || 'MONTHLY';
      if (confirmUnsavedEl) confirmUnsavedEl.checked = prefs.confirmUnsaved !== false;
      openModalById('accountSettingsModalOverlay');
    });
  }

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const avatarUrl = await compressAvatarImage(reader.result);
        try {
          localStorage.setItem(getAvatarStorageKey(), avatarUrl);
          renderUserAvatar();
          showToast('Foto avatar akun berhasil diperbarui.');
        } catch {
          showToast('Ukuran foto avatar terlalu besar untuk disimpan di browser.', true);
        }
        fileInput.value = '';
      };
      reader.readAsDataURL(file);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(getAvatarStorageKey());
      renderUserAvatar();
      showToast('Avatar dikembalikan ke inisial nama akun.');
    });
  }

  // Branch 1: Profile Name & Title Edit
  const profileEditForm = document.getElementById('profileEditForm');
  if (profileEditForm) {
    profileEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('editProfileName').value.trim();
      const title = document.getElementById('editProfileTitle').value.trim();
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, title })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal memperbarui profil.', true);
        return;
      }
      setAuthenticatedUser(data.user);
      showToast(data.message);
    });
  }

  // Branch 2: Email Change with Email OTP
  const btnRequestEmailOtp = document.getElementById('btnRequestEmailOtp');
  const emailOtpBanner = document.getElementById('emailOtpBanner');
  if (btnRequestEmailOtp) {
    btnRequestEmailOtp.addEventListener('click', async () => {
      const targetEmail = document.getElementById('secNewEmail').value.trim();
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'email', targetEmail })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal mengirim OTP.', true);
        return;
      }
      emailOtpBanner.innerHTML = `${escapeHtml(data.message)}<br><strong>Kode OTP (Mode Lokal):</strong> <code>${escapeHtml(data.devOtpPreview)}</code>`;
      emailOtpBanner.style.display = 'block';
      showToast(`Kode OTP dikirim ke ${data.targetEmail}`);
    });
  }

  const changeEmailForm = document.getElementById('changeEmailForm');
  if (changeEmailForm) {
    changeEmailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newEmail = document.getElementById('secNewEmail').value.trim();
      const currentPassword = document.getElementById('secEmailCurrentPass').value;
      const otpCode = document.getElementById('secEmailOtpInput').value.trim();
      const res = await fetch('/api/auth/email/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, currentPassword, otpCode })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal mengubah email.', true);
        return;
      }
      setAuthenticatedUser(data.user);
      changeEmailForm.reset();
      emailOtpBanner.style.display = 'none';
      showToast(data.message);
    });
  }

  // Branch 2: Password Change with Email OTP
  const btnRequestPassOtp = document.getElementById('btnRequestPassOtp');
  const passOtpBanner = document.getElementById('passOtpBanner');
  if (btnRequestPassOtp) {
    btnRequestPassOtp.addEventListener('click', async () => {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'password' })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal mengirim OTP.', true);
        return;
      }
      passOtpBanner.innerHTML = `${escapeHtml(data.message)}<br><strong>Kode OTP (Mode Lokal):</strong> <code>${escapeHtml(data.devOtpPreview)}</code>`;
      passOtpBanner.style.display = 'block';
      showToast(`Kode OTP dikirim ke ${data.targetEmail}`);
    });
  }

  const changePasswordForm = document.getElementById('changePasswordForm');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('secOldPassword').value;
      const newPassword = document.getElementById('secNewPassword').value;
      const otpCode = document.getElementById('secPassOtpInput').value.trim();
      const res = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, otpCode })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal mengubah kata sandi.', true);
        return;
      }
      changePasswordForm.reset();
      passOtpBanner.style.display = 'none';
      showToast(data.message);
    });
  }

  // Branch 4: Functional Preferences & Offline Data Actions
  const defModeEl = document.getElementById('prefDefaultMode');
  const confirmUnsavedEl = document.getElementById('prefConfirmUnsaved');
  if (defModeEl) {
    defModeEl.addEventListener('change', () => {
      const prefs = getAccountPrefs();
      prefs.defaultMode = defModeEl.value;
      saveAccountPrefs(prefs);
      showToast(`Mode default disimpan: ${defModeEl.value === 'YTD' ? 'Akumulasi YTD' : 'Bulan Berjalan'}.`);
    });
  }
  if (confirmUnsavedEl) {
    confirmUnsavedEl.addEventListener('change', () => {
      const prefs = getAccountPrefs();
      prefs.confirmUnsaved = confirmUnsavedEl.checked;
      saveAccountPrefs(prefs);
      showToast(
        confirmUnsavedEl.checked
          ? 'Konfirmasi perubahan belum disimpan diaktifkan.'
          : 'Konfirmasi pindah menu dinonaktifkan.'
      );
    });
  }

  const btnSettingsSyncOffline = document.getElementById('btnSettingsSyncOffline');
  const btnSettingsDownloadSnapshot = document.getElementById('btnSettingsDownloadSnapshot');
  if (btnSettingsSyncOffline) {
    btnSettingsSyncOffline.addEventListener('click', () => syncOfflineQueue(false));
  }
  if (btnSettingsDownloadSnapshot) {
    btnSettingsDownloadSnapshot.addEventListener('click', () => downloadOfflineSnapshotFile());
  }
}

function setAuthenticatedUser(user) {
  state.currentUser = user;
  state.role = user.role;
  state.departmentId = user.department_id || null;

  document.getElementById('userProfileName').textContent = user.name;
  const modalName = document.getElementById('accountModalName');
  const modalMeta = document.getElementById('accountModalMeta');
  const modalEmail = document.getElementById('accountModalEmail');
  const editName = document.getElementById('editProfileName');
  const editTitle = document.getElementById('editProfileTitle');
  if (modalName) modalName.textContent = user.name;
  if (modalMeta) modalMeta.textContent = user.title || user.email;
  if (modalEmail) modalEmail.textContent = user.email;
  if (editName) editName.value = user.name || '';
  if (editTitle) editTitle.value = user.title || '';

  const prefs = getAccountPrefs();
  if (prefs.defaultMode === 'YTD' || prefs.defaultMode === 'MONTHLY') {
    state.mode = prefs.defaultMode;
    document.querySelectorAll('#calcModeToggle .seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === state.mode);
    });
  }

  const rolePill = document.getElementById('userProfileRolePill');
  const modalRolePill = document.getElementById('accountModalRolePill');
  const hint = document.getElementById('roleHintText');

  let pillText = 'EXECUTIVE';
  let pillClass = 'pill-badge neutral user-role-pill';
  let hintText = 'Mode Direksi (BOD): Read-Only Executive Dashboard & PDF Report.';

  if (user.role === 'CPMD_ADMIN') {
    pillText = 'CPMD ADMIN';
    pillClass = 'pill-badge green user-role-pill';
    hintText = 'Akses penuh: Kamus KPI, Departemen, Atribut HEX, Lock Periode & Backup.';
  } else if (user.role === 'DIV_LEADER') {
    pillText = 'DIV LEADER';
    pillClass = 'pill-badge yellow user-role-pill';
    hintText = 'Akses departemen sendiri: Input Actual & Mitigasi Wajib.';
    if (state.departmentId) {
      state.inputDeptFilter = state.departmentId;
    }
  }

  if (rolePill) {
    rolePill.textContent = pillText;
    rolePill.className = pillClass;
  }
  if (modalRolePill) {
    modalRolePill.textContent = pillText;
    modalRolePill.className = pillClass;
  }
  if (hint) {
    hint.textContent = hintText;
  }

  applyRbacUiVisibility();
  loadWallpaperForCurrentUser();
  renderUserAvatar();
}

function applyRbacUiVisibility() {
  const role = state.role;
  const isCpmd = role === 'CPMD_ADMIN';
  const isExec = role === 'EXECUTIVE';

  const navInput = document.querySelector('.nav-btn[data-tab="input"]');
  const navCpmd = document.querySelector('.nav-btn[data-tab="cpmd"]');
  const navAttrs = document.querySelector('.nav-btn[data-tab="attributes"]');
  const btnBackup = document.getElementById('btnExportBackup');
  const inputDeptSel = document.getElementById('inputDeptSelect');

  if (navInput) navInput.style.display = isExec ? 'none' : '';
  if (navCpmd) navCpmd.style.display = isCpmd ? '' : 'none';
  if (navAttrs) navAttrs.style.display = isCpmd ? '' : 'none';
  if (btnBackup) btnBackup.style.display = isCpmd ? '' : 'none';

  if (inputDeptSel) {
    if (role === 'DIV_LEADER' && state.departmentId) {
      inputDeptSel.value = state.departmentId;
      inputDeptSel.disabled = true;
    } else {
      inputDeptSel.disabled = false;
    }
  }

  // If current active tab is not permitted for the user's role, redirect to dashboard
  const activeNav = document.querySelector(`.nav-btn[data-tab="${state.activeTab}"]`);
  if (activeNav && activeNav.style.display === 'none') {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    const dashBtn = document.querySelector('.nav-btn[data-tab="dashboard"]');
    if (dashBtn) dashBtn.classList.add('active');
    state.activeTab = 'dashboard';
    document.getElementById('tab-dashboard').classList.add('active');
  }
}

async function checkAuthAndBoot() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      showLoginOverlay();
      return;
    }
    const data = await res.json();
    if (!data.user) {
      showLoginOverlay();
      return;
    }
    setAuthenticatedUser(data.user);
    hideLoginOverlay();
    await loadBootstrapAndDashboard();
  } catch (_err) {
    showLoginOverlay('Tidak dapat memeriksa sesi aktif. Silakan masuk.');
  }
}

// ============================================================================
// WALLPAPER & BEVELED FROSTED GLASS STUDIO (PERSISTED IN LOCALSTORAGE)
// ============================================================================
function compressWallpaperImage(dataUrl, maxWidth = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

let loadWallpaperForCurrentUser = () => {};

function getWallpaperStoragePrefix() {
  const userKey = state.currentUser?.id || state.currentUser?.email || 'guest';
  return `rahma_wp_${userKey}_`;
}

function initWallpaperStudio() {
  const backdrop = document.getElementById('wallpaperBackdrop');
  const presets = document.querySelectorAll('#wallpaperPresets .wp-preset-card');
  const densityBtns = document.querySelectorAll('#glassDensityGroup .glass-density-btn');
  const openModalBtn = document.getElementById('btnOpenWallpaperModal');
  const triggerSwatch = document.getElementById('wpTriggerSwatch');
  const uploadBtn = document.getElementById('btnUploadWallpaper');
  const applySavedBtn = document.getElementById('btnApplySavedPcWallpaper');
  const clearSavedBtn = document.getElementById('btnClearSavedPcWallpaper');
  const fileInput = document.getElementById('wallpaperFileInput');
  const savedThumb = document.getElementById('savedPcThumb');
  const savedNameEl = document.getElementById('savedPcName');
  const savedMetaEl = document.getElementById('savedPcMeta');
  if (!backdrop) return;

  const PRESET_SWATCHES = {
    nordic: 'linear-gradient(135deg,#dbeafe,#eff6ff,#cbd5e1)',
    sand: 'linear-gradient(135deg,#fef3c7,#f1f5f9,#e2e8f0)',
    emerald: 'linear-gradient(135deg,#d1fae5,#e0f2fe,#cbd5e1)',
    slate: 'linear-gradient(135deg,#0f172a,#1e3a5f,#334155)',
    ocean: 'linear-gradient(135deg,#0c4a6e,#0284c7,#0f172a)'
  };

  function applyGlassDensity(density) {
    const prefix = getWallpaperStoragePrefix();
    const root = document.documentElement;
    if (density === 'clear') {
      root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.34)');
      root.style.setProperty('--glass-bg-strong', 'rgba(255, 255, 255, 0.44)');
      root.style.setProperty('--glass-sidebar', 'rgba(248, 250, 252, 0.40)');
      root.style.setProperty('--glass-blur', 'blur(20px) saturate(175%)');
    } else if (density === 'solid') {
      root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.74)');
      root.style.setProperty('--glass-bg-strong', 'rgba(255, 255, 255, 0.84)');
      root.style.setProperty('--glass-sidebar', 'rgba(248, 250, 252, 0.78)');
      root.style.setProperty('--glass-blur', 'blur(34px) saturate(200%)');
    } else {
      root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.48)');
      root.style.setProperty('--glass-bg-strong', 'rgba(255, 255, 255, 0.56)');
      root.style.setProperty('--glass-sidebar', 'rgba(248, 250, 252, 0.54)');
      root.style.setProperty('--glass-blur', 'blur(28px) saturate(190%)');
    }
    densityBtns.forEach((b) => b.classList.toggle('active', b.dataset.density === density));
    localStorage.setItem(`${prefix}glass_density`, density);
  }

  function refreshSavedPcCard() {
    const prefix = getWallpaperStoragePrefix();
    const savedCustom = localStorage.getItem(`${prefix}custom_url`);
    const savedName = localStorage.getItem(`${prefix}custom_name`) || 'Wallpaper PC Tersimpan';
    const savedAt = localStorage.getItem(`${prefix}custom_saved_at`);
    if (savedCustom && savedThumb && savedNameEl && savedMetaEl) {
      savedThumb.style.backgroundImage = `url("${savedCustom}")`;
      savedThumb.textContent = '';
      savedNameEl.textContent = savedName;
      savedMetaEl.textContent = savedAt
        ? `Tersimpan untuk akun ini: ${savedAt}`
        : 'Tersimpan di browser untuk akun ini dan siap diterapkan kapan saja.';
      if (applySavedBtn) applySavedBtn.style.display = '';
      if (clearSavedBtn) clearSavedBtn.style.display = '';
    } else if (savedThumb && savedNameEl && savedMetaEl) {
      savedThumb.style.backgroundImage = '';
      savedThumb.textContent = 'Belum ada foto';
      savedNameEl.textContent = 'Belum ada foto komputer tersimpan';
      savedMetaEl.textContent =
        'Pilih foto (.jpg/.png/.webp) untuk disimpan khusus bagi akun Anda tanpa memengaruhi pengguna lain.';
      if (applySavedBtn) applySavedBtn.style.display = 'none';
      if (clearSavedBtn) clearSavedBtn.style.display = 'none';
    }
  }

  function applyWallpaperPreset(wpKey) {
    const prefix = getWallpaperStoragePrefix();
    const key = wpKey || 'nordic';
    backdrop.className = 'wallpaper-backdrop';
    backdrop.style.backgroundImage = '';
    if (key !== 'nordic') {
      backdrop.classList.add(`wp-${key}`);
    }
    presets.forEach((btn) => btn.classList.toggle('active', btn.dataset.wp === key));
    if (triggerSwatch) {
      triggerSwatch.style.background = PRESET_SWATCHES[key] || PRESET_SWATCHES.nordic;
    }
    localStorage.setItem(`${prefix}mode`, 'preset');
    localStorage.setItem(`${prefix}preset`, key);
  }

  function applyCustomWallpaper(dataUrl, fileName = null) {
    const prefix = getWallpaperStoragePrefix();
    backdrop.className = 'wallpaper-backdrop';
    backdrop.style.backgroundImage = `url("${dataUrl}")`;
    presets.forEach((btn) => btn.classList.remove('active'));
    if (triggerSwatch) {
      triggerSwatch.style.background = `url("${dataUrl}") center/cover no-repeat`;
    }
    localStorage.setItem(`${prefix}mode`, 'custom');
    try {
      localStorage.setItem(`${prefix}custom_url`, dataUrl);
      if (fileName) {
        localStorage.setItem(`${prefix}custom_name`, fileName);
        localStorage.setItem(
          `${prefix}custom_saved_at`,
          new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
        );
      }
      refreshSavedPcCard();
    } catch {
      showToast('Gambar wallpaper terlalu besar untuk disimpan permanen di browser, namun aktif di sesi ini.', true);
    }
  }

  loadWallpaperForCurrentUser = () => {
    const prefix = getWallpaperStoragePrefix();
    const savedDensity = localStorage.getItem(`${prefix}glass_density`) || 'balanced';
    applyGlassDensity(savedDensity);

    const savedMode = localStorage.getItem(`${prefix}mode`);
    const savedCustom = localStorage.getItem(`${prefix}custom_url`);
    const savedPreset = localStorage.getItem(`${prefix}preset`) || 'nordic';
    if (savedMode === 'custom' && savedCustom) {
      applyCustomWallpaper(savedCustom);
    } else {
      applyWallpaperPreset(savedPreset);
    }
    refreshSavedPcCard();
  };

  loadWallpaperForCurrentUser();

  if (openModalBtn) {
    openModalBtn.addEventListener('click', () => {
      refreshSavedPcCard();
      openModalById('wallpaperModalOverlay');
    });
  }

  presets.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyWallpaperPreset(btn.dataset.wp);
      showToast(`Tema latar "${btn.querySelector('strong')?.textContent || btn.dataset.wp}" diterapkan untuk akun Anda.`);
    });
  });

  densityBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyGlassDensity(btn.dataset.density);
    });
  });

  if (applySavedBtn) {
    applySavedBtn.addEventListener('click', () => {
      const prefix = getWallpaperStoragePrefix();
      const url = localStorage.getItem(`${prefix}custom_url`);
      if (url) {
        applyCustomWallpaper(url);
        showToast('Foto wallpaper komputer terakhir Anda kembali diterapkan.');
      }
    });
  }

  if (clearSavedBtn) {
    clearSavedBtn.addEventListener('click', () => {
      const prefix = getWallpaperStoragePrefix();
      localStorage.removeItem(`${prefix}custom_url`);
      localStorage.removeItem(`${prefix}custom_name`);
      localStorage.removeItem(`${prefix}custom_saved_at`);
      if (localStorage.getItem(`${prefix}mode`) === 'custom') {
        applyWallpaperPreset(localStorage.getItem(`${prefix}preset`) || 'nordic');
      }
      refreshSavedPcCard();
      showToast('Foto komputer tersimpan untuk akun Anda telah dihapus.');
    });
  }

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const compressedUrl = await compressWallpaperImage(reader.result);
        applyCustomWallpaper(compressedUrl, file.name);
        showToast(`Wallpaper "${file.name}" disimpan khusus untuk akun Anda!`);
        fileInput.value = '';
      };
      reader.readAsDataURL(file);
    });
  }
}

// ============================================================================
// INDIVIDUAL KPI DEEP-DIVE MODAL / DRAWER (PROGRESSIVE DISCLOSURE)
// ============================================================================
function bindDetailTriggerButtons(rootEl = document) {
  rootEl.querySelectorAll('[data-detail-kpi]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const kpiId = el.dataset.detailKpi;
      openKpiDetailModal(kpiId);
    });
  });
}

function render12MonthChartSvg(kpi) {
  const history = kpi.monthlyHistory || [];
  const width = 780;
  const height = 185;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 22;
  const padBottom = 30;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const maxScale = 120;

  const yForPct = (pct) =>
    Math.round(padTop + chartH - (Math.min(maxScale, Math.max(0, pct)) / maxScale) * chartH);

  const redY = yForPct(kpi.red_threshold || 85);
  const targetY = yForPct(kpi.yellow_threshold || 100);

  const barsHtml = SHORT_MONTHS.map((mLabel, idx) => {
    const m = idx + 1;
    const rec = history.find((h) => h.month === m);
    const pct = rec && rec.achievement_pct !== null ? Number(rec.achievement_pct) : null;
    const colW = chartW / 12;
    const xCenter = Math.round(padLeft + idx * colW + colW / 2);
    const barW = 28;
    const isSelectedMonth = m === state.month;

    if (pct === null) {
      return `
        <g>
          <rect x="${xCenter - barW / 2}" y="${padTop}" width="${barW}" height="${chartH}" fill="#f8fafc" rx="4"/>
          <text x="${xCenter}" y="${height - 10}" text-anchor="middle" font-size="11" font-weight="${isSelectedMonth ? '900' : '600'}" fill="#94a3b8">${mLabel}</text>
        </g>
      `;
    }

    const barTop = yForPct(pct);
    const barH = Math.max(4, padTop + chartH - barTop);
    const fill =
      rec.status_color === 'RED'
        ? '#ef4444'
        : rec.status_color === 'YELLOW'
        ? '#f59e0b'
        : '#10b981';

    return `
      <g>
        ${isSelectedMonth ? `<rect x="${xCenter - barW / 2 - 5}" y="${padTop - 6}" width="${barW + 10}" height="${chartH + 10}" fill="rgba(37,99,235,0.08)" rx="6"/>` : ''}
        <rect class="chart-bar-anim" x="${xCenter - barW / 2}" y="${barTop}" width="${barW}" height="${barH}" fill="${fill}" rx="5"/>
        <text x="${xCenter}" y="${barTop - 6}" text-anchor="middle" font-size="10" font-weight="800" fill="#0f172a">${pct}%</text>
        <text x="${xCenter}" y="${height - 10}" text-anchor="middle" font-size="11" font-weight="${isSelectedMonth ? '900' : '600'}" fill="${isSelectedMonth ? '#1d4ed8' : '#475569'}">${mLabel}</text>
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" style="display:block">
      <!-- Target 100% Dashed Line -->
      <line x1="${padLeft}" y1="${targetY}" x2="${width - padRight}" y2="${targetY}" stroke="#10b981" stroke-dasharray="4,4" stroke-width="1.5"/>
      <text x="${padLeft - 6}" y="${targetY + 4}" text-anchor="end" font-size="9.5" font-weight="700" fill="#059669">${kpi.yellow_threshold}%</text>

      <!-- Red Threshold Dashed Line -->
      <line x1="${padLeft}" y1="${redY}" x2="${width - padRight}" y2="${redY}" stroke="#ef4444" stroke-dasharray="4,4" stroke-width="1.5"/>
      <text x="${padLeft - 6}" y="${redY + 4}" text-anchor="end" font-size="9.5" font-weight="700" fill="#dc2626">${kpi.red_threshold}%</text>

      <!-- Baseline 0% -->
      <line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" stroke="#cbd5e1" stroke-width="1"/>
      ${barsHtml}
    </svg>
  `;
}

function openKpiDetailModal(kpiId) {
  const kpi = state.dashboard?.kpis?.find((item) => item.id === kpiId);
  if (!kpi) return;

  const overlay = document.getElementById('kpiDetailModalOverlay');
  const headerBar = document.getElementById('kpiModalHeaderBar');
  headerBar.style.borderTopColor = kpi.primaryAccent.hex;

  document.getElementById('modalKpiEyebrow').textContent =
    `${kpi.department_code} — ${kpi.department_name} • Kode Indikator: ${kpi.code}`;
  document.getElementById('modalKpiTitle').textContent = kpi.title;
  document.getElementById('modalKpiLeader').textContent =
    `Penanggung Jawab (PIC): ${kpi.leader_name} | Periode Evaluasi: ${MONTH_NAMES[state.month - 1]} ${state.year}`;

  const activeStatus =
    state.mode === 'YTD' ? kpi.ytd.ytdStatusColor : kpi.current.status_color;
  const statusPill = document.getElementById('modalKpiStatusPill');
  statusPill.className = `status-pill status-${activeStatus}`;
  statusPill.textContent = `${activeStatus} (${state.mode})`;

  // Jump to Input button handler
  const jumpBtn = document.getElementById('btnModalJumpInput');
  jumpBtn.onclick = () => {
    closeKpiDetailModal();
    // Switch to input tab and focus this KPI's actual input
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    document.querySelector('.nav-btn[data-tab="input"]').classList.add('active');
    document.getElementById('tab-input').classList.add('active');
    state.inputDeptFilter = kpi.department_id;
    document.getElementById('inputDeptSelect').value = kpi.department_id;
    renderSpreadsheetInputView();
    setTimeout(() => {
      const card = document.getElementById(`row-card-${kpi.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inputEl = card.querySelector('.actual-input');
        if (inputEl && !inputEl.disabled) inputEl.focus();
      }
    }, 100);
  };

  const momText =
    kpi.momDeltaPct === null
      ? 'Belum ada pembanding bulan lalu'
      : kpi.momDeltaPct > 0
      ? `▲ Naik +${kpi.momDeltaPct}% vs Bulan Lalu`
      : kpi.momDeltaPct < 0
      ? `▼ Turun ${kpi.momDeltaPct}% vs Bulan Lalu`
      : 'Stabil (0.0% vs Bulan Lalu)';

  const bodyEl = document.getElementById('kpiModalBodyContent');
  bodyEl.innerHTML = `
    <!-- 1. 4 CORE METRIC SUMMARY BOXES -->
    <div class="detail-metrics-grid">
      <div class="detail-stat-box" style="border-top:3px solid ${kpi.primaryAccent.hex}">
        <div class="ds-label">Performa Bulan ${SHORT_MONTHS[state.month - 1]} ${state.year}</div>
        <div class="ds-val">${kpi.current.achievement_pct !== null ? `${kpi.current.achievement_pct}%` : 'Belum Input'}</div>
        <div class="ds-sub">
          Actual: <strong>${kpi.current.actual_value ?? '-'}</strong> / Target: <strong>${kpi.current.target_value}</strong> ${escapeHtml(kpi.unit)}
        </div>
      </div>

      <div class="detail-stat-box" style="border-top:3px solid #2563eb">
        <div class="ds-label">Skor Terbobot Bulan Ini</div>
        <div class="ds-val">${kpi.current.weighted_score ?? '-'} <span style="font-size:13px;color:#64748b">/ ${kpi.weight}</span></div>
        <div class="ds-sub">Bobot Indikator: <strong>${kpi.weight}%</strong> dari Divisi ${escapeHtml(kpi.department_code)}</div>
      </div>

      <div class="detail-stat-box" style="border-top:3px solid #0d9488">
        <div class="ds-label">Akumulasi Year-to-Date (YTD)</div>
        <div class="ds-val">${kpi.ytd.ytdAchievementPct !== null ? `${kpi.ytd.ytdAchievementPct}%` : '-'}</div>
        <div class="ds-sub">
          ${kpi.ytd_method}: <strong>${kpi.ytd.ytdActualNominal ?? '-'}</strong> / <strong>${kpi.ytd.ytdTargetNominal}</strong> ${escapeHtml(kpi.unit)} (Skor YTD: ${kpi.ytd.ytdWeightedScore ?? '-'})
        </div>
      </div>

      <div class="detail-stat-box" style="border-top:3px solid #7c3aed">
        <div class="ds-label">Dinamika Tren Bulanan (MoM)</div>
        <div class="ds-val" style="font-size:15px;margin-top:7px">${momText}</div>
        <div class="ds-sub">Status Saat Ini: <strong>${kpi.current.status_color}</strong> ${kpi.current.is_draft ? '(Masih Draft)' : '(Final)'}</div>
      </div>
    </div>

    <!-- 2. 12-MONTH PERFORMANCE TREND VISUALIZATION & LOG TABLE -->
    <div class="detail-section-card">
      <h4>
        <span style="display:inline-flex;align-items:center;gap:6px">${phIcon('chart-line-up')} Grafik Tren Performa 12 Bulan (Januari &ndash; Desember ${state.year})</span>
        <span style="font-size:11px;font-weight:600;color:#64748b">Garis Hijau = Target (${kpi.yellow_threshold}%) | Garis Merah = Batas Mitigasi (${kpi.red_threshold}%)</span>
      </h4>
      ${render12MonthChartSvg(kpi)}

      <div class="table-responsive" style="margin-top:12px">
        <table class="data-table">
          <thead>
            <tr>
              <th>Parameter</th>
              ${SHORT_MONTHS.map(
                (m, i) =>
                  `<th style="text-align:center;${i + 1 === state.month ? 'background:#dbeafe;color:#1e40af' : ''}">${m}</th>`
              ).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Target (${escapeHtml(kpi.unit)})</strong></td>
              ${kpi.monthlyHistory
                .map((h) => `<td style="text-align:center">${h.target_value}</td>`)
                .join('')}
            </tr>
            <tr>
              <td><strong>Actual (${escapeHtml(kpi.unit)})</strong></td>
              ${kpi.monthlyHistory
                .map(
                  (h) =>
                    `<td style="text-align:center;font-weight:800">${
                      h.actual_value !== null && h.actual_value !== undefined ? h.actual_value : '-'
                    }</td>`
                )
                .join('')}
            </tr>
            <tr>
              <td><strong>Capaian (%)</strong></td>
              ${kpi.monthlyHistory
                .map(
                  (h) => `
                  <td style="text-align:center">
                    <span class="heat-cell heat-${h.status_color}" style="min-width:62px;min-height:32px;padding:4px 10px">
                      ${h.achievement_pct !== null ? `${h.achievement_pct}%` : '-'}
                    </span>
                  </td>`
                )
                .join('')}
            </tr>
            <tr>
              <td><strong>Skor Terbobot</strong></td>
              ${kpi.monthlyHistory
                .map(
                  (h) =>
                    `<td style="text-align:center;font-size:11.5px;color:#475569">${
                      h.weighted_score !== null ? h.weighted_score : '-'
                    }</td>`
                )
                .join('')}
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. MITIGATION & ESCALATION DEEP-DIVE -->
    <div class="detail-section-card" style="border-left:5px solid ${
      kpi.current.status_color === 'RED' ? '#ef4444' : '#10b981'
    }">
      <h4>
        <span style="display:inline-flex;align-items:center;gap:6px">${phIcon(kpi.current.status_color === 'RED' ? 'shield-warning' : 'shield-check')} Dokumen Mitigasi Risiko &amp; Eskalasi Manajemen (Periode ${MONTH_NAMES[state.month - 1]} ${state.year})</span>
        <span class="status-pill status-${kpi.current.status_color}">
          ${kpi.current.status_color === 'RED' ? 'WAJIB MITIGASI AKTIF' : 'OPSIONAL / AMAN'}
        </span>
      </h4>

      <div class="esc-boxes">
        <div class="esc-box">
          <strong>${phIcon('warning-circle', 'ph-icon-sm')} 1. Problem Identification (Deteksi Akar Masalah)</strong>
          ${renderProblemIdentificationHtml(
            kpi.current.problem_identification,
            kpi.current.mitigationTagObjects,
            'Tidak ada catatan akar masalah pada periode ini (Performa di atas ambang batas merah).'
          )}
        </div>
        <div class="esc-box">
          <strong>${phIcon('check-circle', 'ph-icon-sm')} 2. Corrective Action (Tindakan Perbaikan Konkret)</strong>
          ${escapeHtml(
            kpi.current.corrective_action || 'Tidak ada tindakan korektif khusus yang tercatat.'
          )}
        </div>
        <div class="esc-box support-box">
          <strong>${phIcon('lifebuoy', 'ph-icon-sm')} 3. Need Support (Dukungan / Keputusan Manajemen BOD)</strong>
          ${escapeHtml(
            kpi.current.need_support || 'Tidak memerlukan eskalasi dukungan khusus dari Direksi.'
          )}
        </div>
      </div>
    </div>

    <!-- 4. TECHNICAL FORMULA PARAMETERS & MULTI-ATTRIBUTE HEX DETAILS (NON-ESSENTIAL ON MAIN TABLE) -->
    <div class="detail-section-card">
      <h4 style="display:flex;align-items:center;gap:6px">${phIcon('sliders-horizontal')} Parameter Teknis Kalkulasi &amp; Spesifikasi Atribut Warna HEX</h4>
      <div class="tech-specs-grid">
        <div class="tech-spec-item">
          <span>Kode Indikator</span>
          <strong>${escapeHtml(kpi.code)}</strong>
        </div>
        <div class="tech-spec-item">
          <span>Polaritas Formula</span>
          <strong>${kpi.polarity === 'MINIMIZE' ? `${phIcon('trend-down', 'ph-icon-sm')} Minimize (Semakin Rendah Semakin Baik)` : `${phIcon('trend-up', 'ph-icon-sm')} Maximize (Semakin Tinggi Semakin Baik)`}</strong>
        </div>
        <div class="tech-spec-item">
          <span>Metode Agregasi YTD</span>
          <strong>${kpi.ytd_method} (${kpi.ytd_method === 'SUM' ? 'Akumulasi Total' : kpi.ytd_method === 'AVG' ? 'Rata-Rata Bulanan' : 'Nilai Posisi Akhir'})</strong>
        </div>
        <div class="tech-spec-item">
          <span>Ambang Batas Warna</span>
          <strong>Merah &lt; ${kpi.red_threshold}% | Hijau &ge; ${kpi.yellow_threshold}%</strong>
        </div>
        <div class="tech-spec-item">
          <span>Plafon Skor Maksimum (Cap)</span>
          <strong>Maks. ${kpi.cap_score}%</strong>
        </div>
        <div class="tech-spec-item">
          <span>Status Kunci &amp; Audit</span>
          <strong>${kpi.current.is_locked ? `${phIcon('lock-key', 'ph-icon-sm')} Terkunci CPMD` : `${phIcon('lock-key-open', 'ph-icon-sm')} Terbuka`} • Oleh: ${escapeHtml(kpi.current.updated_by || 'System')}</strong>
        </div>
      </div>

      <div style="margin-top:14px">
        <span class="micro-label">RINCIAN MULTI-ATRIBUT KPI &amp; KODE WARNA AKSEN HEX (#RRGGBB)</span>
        <div class="attr-detail-list">
          ${kpi.attributes
            .map(
              (attr) => `
            <div class="attr-detail-item" style="border-left:5px solid ${attr.hex_color}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <strong style="font-size:12.5px;color:#0f172a">${escapeHtml(attr.name)}</strong>
                <code style="font-size:11px;font-weight:800;background:#f1f5f9;padding:2px 6px;border-radius:4px">${attr.hex_color}</code>
              </div>
              <div style="font-size:10px;font-weight:800;color:#64748b;margin-bottom:4px">${escapeHtml(attr.attribute_group)}</div>
              <p style="font-size:11.5px;color:#475569">${escapeHtml(attr.description || '-')}</p>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

function openModalById(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
}

function closeModalById(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function closeAllModals() {
  document.querySelectorAll('.kpi-modal-overlay.open').forEach((overlay) => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  });
}

function closeKpiDetailModal() {
  closeModalById('kpiDetailModalOverlay');
}

function populateDeptFormForEdit(deptId) {
  const dept = state.dashboard?.departments?.find((item) => item.id === deptId);
  if (!dept) return;
  document.getElementById('deptFormHeading').innerHTML = `${phIcon('pencil-simple')} Ubah Departemen: ${escapeHtml(dept.code)}`;
  document.getElementById('deptFormId').value = dept.id;
  document.getElementById('deptFormCode').value = dept.code;
  document.getElementById('deptFormName').value = dept.name;
  document.getElementById('deptFormLeader').value = dept.leader_name;
  document.getElementById('deptFormDesc').value = dept.description || '';
  openModalById('deptCrudModalOverlay');
  document.getElementById('deptFormName').focus();
}

async function handleDeleteDept(deptId) {
  if (state.role !== 'CPMD_ADMIN') {
    showToast('Hanya role CPMD Admin yang dapat menghapus departemen.', true);
    return;
  }
  const res = await fetch(`/api/departments/${deptId}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || 'Gagal menghapus departemen', true);
    return;
  }
  showToast(data.message);
  resetDeptCrudForm();
  await refreshDashboardData();
}

function resetDeptCrudForm() {
  document.getElementById('deptFormHeading').innerHTML =
    `${phIcon('buildings')} Manajemen Master Departemen (CPMD)`;
  document.getElementById('deptFormId').value = '';
  document.getElementById('deptFormCode').value = '';
  document.getElementById('deptFormName').value = '';
  document.getElementById('deptFormLeader').value = '';
  document.getElementById('deptFormDesc').value = '';
}

function resetKpiCrudForm() {
  document.getElementById('kpiFormTitle').innerHTML = `${phIcon('plus')} Tambah / Konfigurasi Kamus KPI`;
  document.getElementById('kpiFormId').value = '';
  document.getElementById('kpiFormCode').value = '';
  document.getElementById('kpiFormTitleInput').value = '';
  document.getElementById('kpiFormUnit').value = '%';
  document.getElementById('kpiFormWeight').value = '20';
  document.getElementById('kpiFormTarget').value = '95';
  renderKpiFormAttributePicker([]);
}

function resetAttrCrudForm() {
  document.getElementById('attrFormHeading').innerHTML =
    `${phIcon('palette')} Studio CRUD Atribut KPI &amp; Warna Aksen HEX`;
  document.getElementById('attrFormId').value = '';
  document.getElementById('attrFormName').value = '';
  document.getElementById('attrFormHexInput').value = '#2563EB';
  document.getElementById('attrFormColorPicker').value = '#2563EB';
  document.getElementById('attrFormDesc').value = '';
  updateHexLivePreview();
}

// ============================================================================
// OFFLINE AUTO-BACKUP & QUEUE SYNCHRONIZATION ENGINE
// ============================================================================
function getOfflineStorageKey(suffix) {
  const userKey = state.currentUser?.id || state.currentUser?.email || 'guest';
  return `rahma_offline_${userKey}_${suffix}`;
}

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(getOfflineStorageKey('queue')) || '[]');
  } catch {
    return [];
  }
}

function setOfflineQueue(queue) {
  try {
    localStorage.setItem(getOfflineStorageKey('queue'), JSON.stringify(queue));
  } catch {
    // Ignore storage quota errors cleanly
  }
  updateOfflineStatusUi();
}

function saveOfflineSnapshot() {
  if (!state.dashboard) return;
  const snapshot = {
    savedAt: new Date().toISOString(),
    user: state.currentUser,
    year: state.year,
    month: state.month,
    mode: state.mode,
    departments: state.departments,
    attributes: state.attributes,
    dashboard: state.dashboard
  };
  try {
    localStorage.setItem(getOfflineStorageKey('snapshot'), JSON.stringify(snapshot));
    if (state.currentUser) {
      localStorage.setItem('rahma_last_offline_user', JSON.stringify(state.currentUser));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function restoreFromOfflineSnapshot() {
  try {
    const raw = localStorage.getItem(getOfflineStorageKey('snapshot'));
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    if (!snapshot || !snapshot.dashboard) return false;
    state.departments = snapshot.departments || [];
    state.attributes = snapshot.attributes || [];
    state.dashboard = snapshot.dashboard;
    populateDepartmentSelects();
    populateAttributeSelects();
    renderAllViews();
    updateOfflineStatusUi();
    return true;
  } catch {
    return false;
  }
}

function queueOfflineKpiSave(payload) {
  const queue = getOfflineQueue();
  const idx = queue.findIndex(
    (item) =>
      item.kpiId === payload.kpiId &&
      Number(item.year) === Number(payload.year) &&
      Number(item.month) === Number(payload.month)
  );
  const entry = { ...payload, queuedAt: new Date().toISOString() };
  if (idx >= 0) {
    queue[idx] = entry;
  } else {
    queue.push(entry);
  }
  setOfflineQueue(queue);

  // Also reflect the offline change in the local dashboard snapshot immediately
  if (state.dashboard?.kpis) {
    const kpi = state.dashboard.kpis.find((k) => k.id === payload.kpiId);
    if (kpi && kpi.current) {
      kpi.current.target_value = Number(payload.targetValue);
      kpi.current.actual_value = Number(payload.actualValue);
      kpi.current.problem_identification = payload.problemIdentification;
      kpi.current.corrective_action = payload.correctiveAction;
      kpi.current.need_support = payload.needSupport;
      kpi.current.mitigationTagIds = payload.mitigationTagIds || [];
      saveOfflineSnapshot();
    }
  }
}

async function syncOfflineQueue(silent = false) {
  if (!navigator.onLine) {
    updateOfflineStatusUi();
    return;
  }
  const queue = getOfflineQueue();
  if (!queue.length) {
    updateOfflineStatusUi();
    return;
  }

  const remaining = [];
  let syncedCount = 0;

  for (const item of queue) {
    try {
      const res = await fetch('/api/records/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        syncedCount += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  setOfflineQueue(remaining);
  if (syncedCount > 0) {
    showToast(`${syncedCount} perubahan offline berhasil disinkronkan ke SQLite server!`);
    await refreshDashboardData();
  } else if (!silent && remaining.length > 0) {
    showToast('Sebagian antrean offline belum dapat disinkronkan (cek validasi atau koneksi).', true);
  }
}

function downloadOfflineSnapshotFile() {
  const raw = localStorage.getItem(getOfflineStorageKey('snapshot'));
  const queue = getOfflineQueue();
  const payload = raw
    ? { ...JSON.parse(raw), pendingOfflineQueue: queue }
    : {
        exportedAt: new Date().toISOString(),
        offlineMode: true,
        user: state.currentUser,
        pendingOfflineQueue: queue,
        departments: state.departments,
        attributes: state.attributes,
        dashboard: state.dashboard
      };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rahma-offline-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Snapshot cadangan offline (.JSON) berhasil diunduh!');
}

function updateOfflineStatusUi() {
  const dot = document.getElementById('archStatusDot');
  const text = document.getElementById('archStatusText');
  const syncBtn = document.getElementById('btnSyncOfflineQueue');
  const countSpan = document.getElementById('offlineQueueCount');
  const queue = getOfflineQueue();

  if (dot && text) {
    if (navigator.onLine) {
      dot.className = 'status-dot-online';
      text.textContent =
        queue.length > 0
          ? `Online • ${queue.length} Antrean Menunggu Sync`
          : 'SQLite & Auto-Backup Offline Aktif';
    } else {
      dot.className = 'status-dot-offline';
      text.textContent = 'Mode Offline • Cadangan Lokal Aktif';
    }
  }

  if (syncBtn && countSpan) {
    countSpan.textContent = String(queue.length);
    syncBtn.style.display = queue.length > 0 ? '' : 'none';
  }
}

function initOfflineAutoBackup() {
  const syncBtn = document.getElementById('btnSyncOfflineQueue');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => syncOfflineQueue(false));
  }

  window.addEventListener('online', () => {
    updateOfflineStatusUi();
    showToast('Koneksi internet kembali aktif. Menyinkronkan cadangan offline...');
    syncOfflineQueue(false);
  });

  window.addEventListener('offline', () => {
    saveOfflineSnapshot();
    updateOfflineStatusUi();
    showToast('Mode Offline: perubahan akan dicadangkan otomatis di browser.');
  });

  updateOfflineStatusUi();
}

let rahTapCount = 0;
let rahTapTimer = null;
let rahTypewriterTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  const aboutLogo = document.getElementById('aboutRahmaLogo');
  const aboutVersion = document.getElementById('aboutVersionBadge');

  function handleAboutSecretTap() {
    if (document.getElementById('rah-blackout-stage')) return;
    rahTapCount += 1;
    clearTimeout(rahTapTimer);
    rahTapTimer = setTimeout(() => {
      rahTapCount = 0;
    }, 1500);

    if (rahTapCount >= 3) {
      rahTapCount = 0;
      clearTimeout(rahTapTimer);
      closeModalById('accountSettingsModalOverlay');
      initRAHProtocol();
    }
  }

  if (aboutLogo) aboutLogo.addEventListener('click', handleAboutSecretTap);
  if (aboutVersion) aboutVersion.addEventListener('click', handleAboutSecretTap);
});

function initRAHProtocol() {
  if (document.getElementById('rah-blackout-stage')) return;

  console.log(
    '%cRAHMA Engine v1.0 | Authorized by R.A.H (Est. 2006). Operation P. Secured.',
    'color: #007BC8; font-weight: 700; font-size: 13px;'
  );

  // Inject CSS for Pitch-Black CLI Booting + 16:9 CRT Monitor + Reset Button
  if (!document.getElementById('rah-protocol-style')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'rah-protocol-style';
    styleEl.textContent = `
      @keyframes rahCursorBlink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
      @keyframes rahCrtPop {
        0% { opacity: 0; transform: scale(0.95); }
        100% { opacity: 1; transform: scale(1); }
      }
      #rah-blackout-stage {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: #000000;
        color: #00FF00;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 28px;
        opacity: 1;
        transition: opacity 0.35s ease;
      }
      #rah-blackout-stage.is-closing {
        opacity: 0;
      }
      .rah-cli-boot {
        position: fixed;
        top: 28px;
        left: 32px;
        right: 32px;
        font-family: 'IBM Plex Mono', 'Courier New', Consolas, monospace;
        font-size: 15px;
        line-height: 1.75;
        color: #00FF00;
        text-shadow: 0 0 8px rgba(0, 255, 0, 0.55);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .rah-crt-cursor {
        display: inline-block;
        width: 9px;
        height: 16px;
        background: #00FF00;
        vertical-align: -2px;
        margin-left: 3px;
        animation: rahCursorBlink 0.85s steps(1) infinite;
      }
      .rah-esc-btn {
        position: fixed;
        top: 22px;
        right: 26px;
        z-index: 10001;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(0, 255, 0, 0.42);
        color: #00FF00;
        font-family: 'IBM Plex Mono', 'Courier New', Consolas, monospace;
        font-size: 12.5px;
        font-weight: 700;
        padding: 8px 14px;
        border-radius: 6px;
        cursor: pointer;
        letter-spacing: 0.4px;
        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      }
      .rah-esc-btn:hover {
        background: rgba(0, 255, 0, 0.16);
        border-color: #00FF00;
        color: #ffffff;
      }
      /* 16:9 CRT Monitor Container */
      .rah-crt-shell {
        width: min(80vw, 960px);
        display: flex;
        flex-direction: column;
        align-items: center;
        animation: rahCrtPop 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .rah-crt-monitor {
        width: 100%;
        background: linear-gradient(160deg, #d6d0c4 0%, #b5ad9c 100%);
        border-radius: 22px 22px 16px 16px;
        padding: 20px 22px 16px;
        border: 2px solid #8c8476;
        box-shadow:
          inset 0 2px 0 rgba(255, 255, 255, 0.7),
          inset 0 -6px 0 rgba(0, 0, 0, 0.28),
          0 28px 80px rgba(0, 0, 0, 0.9);
      }
      .rah-crt-bezel {
        background: #1c1e21;
        border-radius: 14px;
        padding: 12px;
        box-shadow: inset 0 4px 14px rgba(0, 0, 0, 0.92);
      }
      .rah-crt-screen-16x9 {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #020903;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: inset 0 0 28px rgba(0, 0, 0, 0.9);
      }
      .rah-crt-screen-16x9 iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
      }
      .rah-crt-screen-16x9::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          rgba(0, 0, 0, 0.14) 0px,
          rgba(0, 0, 0, 0.14) 1px,
          transparent 1px,
          transparent 3px
        );
        pointer-events: none;
      }
      .rah-crt-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 10px;
        padding: 0 6px;
      }
      .rah-crt-badge {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.5px;
        color: #4a453c;
      }
      .rah-crt-led-group {
        display: flex;
        align-items: center;
        gap: 7px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 10px;
        color: #5a5449;
      }
      .rah-crt-led {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 8px #22c55e;
      }
      .rah-crt-stand {
        width: 220px;
        height: 20px;
        background: linear-gradient(180deg, #9d9586 0%, #7d7668 100%);
        border-radius: 0 0 12px 12px;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.7);
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Fase 2: Pitch-Black Overlay (#000; z-index: 9999) + Top-Left CLI Booting Typewriter
  const stage = document.createElement('div');
  stage.id = 'rah-blackout-stage';
  stage.innerHTML = `
    <button type="button" class="rah-esc-btn" id="rahEscResetBtn">[ ESC ] Return to System</button>
    <div class="rah-cli-boot" id="rahCliBootBox"><span id="rahCliTypedText"></span><span class="rah-crt-cursor"></span></div>
  `;
  document.body.appendChild(stage);

  let videoDelayTimer = null;

  const cleanup = () => {
    clearInterval(rahTypewriterTimer);
    rahTypewriterTimer = null;
    clearTimeout(videoDelayTimer);
    rahTapCount = 0;
    clearTimeout(rahTapTimer);
    document.removeEventListener('keydown', onEscKey);
    stage.classList.add('is-closing');
    setTimeout(() => stage.remove(), 350);
  };

  const onEscKey = (ev) => {
    if (ev.key === 'Escape') cleanup();
  };

  stage.querySelector('#rahEscResetBtn').addEventListener('click', cleanup);
  document.addEventListener('keydown', onEscKey);

  const bootLines = [
    '> System Override Initiated...',
    '> Bypassing RAHMA Security Protocols... [OK]',
    "> Decrypting The Developer's Message...",
    '> Loading Video Payload...'
  ];
  const fullBootText = bootLines.join('\n');
  const typedEl = stage.querySelector('#rahCliTypedText');
  let charPos = 0;

  clearInterval(rahTypewriterTimer);
  rahTypewriterTimer = setInterval(() => {
    charPos += 1;
    typedEl.textContent = fullBootText.slice(0, charPos);
    if (charPos >= fullBootText.length) {
      clearInterval(rahTypewriterTimer);
      rahTypewriterTimer = null;

      // Fase 3: Jeda 1 detik -> hilangkan teks CLI -> tampilkan CRT 16:9 memutar YouTube autoplay
      videoDelayTimer = setTimeout(() => {
        const cliBox = stage.querySelector('#rahCliBootBox');
        if (cliBox) cliBox.remove();

        const crtShell = document.createElement('div');
        crtShell.className = 'rah-crt-shell';
        crtShell.innerHTML = `
          <div class="rah-crt-monitor">
            <div class="rah-crt-bezel">
              <div class="rah-crt-screen-16x9">
                <iframe
                  src="https://www.youtube.com/embed/rT62tHlAiGQ?autoplay=1&rel=0"
                  title="RAHMA Secret Developer Message"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
            </div>
            <div class="rah-crt-footer">
              <span class="rah-crt-badge">RAHMA-CRT // 16:9 WIDE</span>
              <span class="rah-crt-led-group"><span class="rah-crt-led"></span>SIGNAL LOCKED</span>
            </div>
          </div>
          <div class="rah-crt-stand"></div>
        `;
        stage.appendChild(crtShell);
      }, 1000);
    }
  }, 26);
}
