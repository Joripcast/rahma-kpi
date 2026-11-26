/**
 * RAHMA User Manual Screenshot Capture & PDF Generator (Playwright)
 * PT Global Service Indonesia (GSI)
 *
 * Langkah:
 * 1. Mengambil 10 screenshot resolusi tinggi (1440x900 @2x) dari aplikasi lokal http://localhost:3456
 *    ke dalam direktori docs-manual/screenshots/.
 * 2. Merender docs-manual/manual.html menjadi docs-manual/User-Manual.pdf berukuran A4
 *    lengkap dengan header, footer, dan nomor halaman otomatis.
 */

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');

const BASE_URL = process.env.RAHMA_URL || 'http://localhost:3456';
const DOCS_DIR = __dirname;
const SCREENSHOTS_DIR = path.join(DOCS_DIR, 'screenshots');
const MANUAL_HTML_PATH = path.join(DOCS_DIR, 'manual.html');
const OUTPUT_PDF_PATH = path.join(DOCS_DIR, 'User-Manual.pdf');

function resolveBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Tidak ditemukan instalasi Google Chrome atau Microsoft Edge untuk Playwright.');
}

async function captureApplicationScreenshots(browser) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log('📸 [1/10] Mengambil screenshot Landing Page (/)...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-landing-home.png') });

  console.log('📸 [2/10] Mengambil screenshot Halaman Registrasi (/signup)...');
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-signup-account.png') });

  console.log('📸 [3/10] Mengambil screenshot Halaman Login RBAC (/login)...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-login-rbac.png') });

  // Login menggunakan tombol cepat CPMD Admin
  await page.click('.uat-cred-btn[data-role="CPMD_ADMIN"]');
  await page.waitForURL('**/app**', { timeout: 15000 });
  await page.waitForSelector('#corporateGaugeContainer svg', { timeout: 15000 });
  await page.waitForTimeout(600);

  // Pastikan Mode Terang aktif terlebih dahulu
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('rahma_theme', 'light');
    document.querySelectorAll('.toast').forEach((t) => t.remove());
  });
  await page.waitForTimeout(350);

  console.log('📸 [4/10] Mengambil screenshot Executive Dashboard (Mode Terang)...');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-executive-dashboard-light.png') });

  console.log('📸 [5/10] Mengambil screenshot Executive Dashboard (Night-Comfort Dark Mode)...');
  await page.click('#btnThemeToggle');
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-executive-dashboard-dark.png') });

  // Kembalikan ke Mode Terang untuk tangkapan layar modal & form berikutnya
  await page.click('#btnThemeToggle');
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
  });

  console.log('📸 [6/11] Mengambil screenshot Modal Perincian Divisi & Grafik Bulanan Interaktif...');
  const firstDeptBtn = await page.$('.mini-dept-card[data-detail-dept]');
  if (firstDeptBtn) {
    await firstDeptBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06b-dept-detail-modal.png') });
    await page.click('[data-close-modal="deptDetailModalOverlay"]');
    await page.waitForTimeout(300);
  }

  console.log('📸 [7/11] Mengambil screenshot Drawer Perincian Individu KPI (12 Bulan)...');
  const firstKpiBtn = await page.$('[data-detail-kpi]');
  if (firstKpiBtn) {
    await firstKpiBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-kpi-detail-modal.png') });
    await page.click('#btnCloseKpiModal');
    await page.waitForTimeout(300);
  }

  console.log('📸 [7/10] Mengambil screenshot Menu Input KPI & Gerbang Logika Mitigasi...');
  await page.click('.nav-btn[data-tab="input"]');
  await page.waitForTimeout(500);
  const redGateCard = await page.$('.kpi-input-row-card.gate-red-active');
  if (redGateCard) {
    await redGateCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-input-kpi-mitigation.png') });

  console.log('📸 [8/10] Mengambil screenshot Menu CPMD Hub, Tracker & Kamus KPI...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.nav-btn[data-tab="cpmd"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-cpmd-hub-kamus.png') });

  console.log('📸 [9/10] Mengambil screenshot Menu Atribut KPI & Studio Warna HEX...');
  await page.click('.nav-btn[data-tab="attributes"]');
  await page.waitForTimeout(450);
  await page.click('#btnOpenNewAttrModal');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-attributes-hex-studio.png') });
  await page.click('[data-close-modal="attrCrudModalOverlay"]');
  await page.waitForTimeout(300);

  console.log('📸 [10/10] Mengambil screenshot Modal Pengaturan Akun & Keamanan OTP...');
  await page.click('#userProfileCard');
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-account-settings-otp.png') });

  await context.close();
}

async function renderManualPdf(browser) {
  console.log('🖨️  Merender docs-manual/manual.html ke docs-manual/User-Manual.pdf...');
  const context = await browser.newContext({
    viewport: { width: 1240, height: 1754 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  const fileUrl = pathToFileURL(MANUAL_HTML_PATH).href;
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(500);

  await page.pdf({
    path: OUTPUT_PDF_PATH,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    },
    headerTemplate: `
      <div style="width:100%;font-family:'Segoe UI',Arial,sans-serif;font-size:8pt;color:#475569;padding:0 15mm;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #E2E8F0;padding-bottom:4px;">
        <span style="font-weight:700;color:#0F172A;">RAHMA &mdash; Buku Panduan Pengguna (User Manual)</span>
        <span>PT Global Service Indonesia (GSI) &bull; Divisi CPMD</span>
      </div>
    `,
    footerTemplate: `
      <div style="width:100%;font-family:'Segoe UI',Arial,sans-serif;font-size:8pt;color:#475569;padding:0 15mm;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E2E8F0;padding-top:4px;">
        <span>Dokumen Operasional Internal &bull; Rilis PostgreSQL v1.0</span>
        <span style="font-weight:700;color:#0F172A;">Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span>
      </div>
    `
  });

  await context.close();
  const stat = fs.statSync(OUTPUT_PDF_PATH);
  console.log(`✅ Selesai! Berkas PDF tersimpan di: ${OUTPUT_PDF_PATH} (${(stat.size / 1024).toFixed(1)} KB)`);
}

(async () => {
  const executablePath = resolveBrowserExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true
  });

  try {
    await captureApplicationScreenshots(browser);
    await renderManualPdf(browser);
  } finally {
    await browser.close();
  }
})();
