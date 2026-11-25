# RAHMA — Platform Governance KPI & Mitigasi Risiko Korporasi

**RAHMA** (*Real-time Analytical Hub for Management & Accountability*) adalah sistem manajemen dan pemantauan *Key Performance Indicator* (KPI) korporasi berbasis web yang dirancang mandiri (*standalone*) dengan fokus pada **akurasi skoring otomatis**, **gerbang mitigasi risiko wajib**, **tata kelola akses berbasis peran (RBAC)** yang ketat, serta **kenyamanan visual (*Light & Night-Comfort Dark Mode*)**.

Dikembangkan untuk kebutuhan tata kelola **PT Global Service Indonesia (GSI)** — khususnya tim *Corporate Planning & Management Development* (CPMD), pimpinan departemen (*Division Leader*), dan jajaran Direksi (*Executive / BOD*) — RAHMA menggantikan pelaporan spreadsheet dan kompilasi slide kuartalan manual menjadi satu platform real-time berbasis **PostgreSQL** yang siap dijalankan secara *on-premise* maupun *cloud*.

---

## Keunggulan Utama RAHMA

1. **Mesin Kalkulasi Polaritas & YTD Terstandarisasi:** Mendukung indikator bertipe **Maximize** maupun **Minimize**, batas atas skor otomatis (**Cap Score 120%**), perubahan *Month-over-Month* (**MoM Delta**), serta agregasi **Year-to-Date (YTD)** dengan mode `SUM`, `AVG`, dan `LAST_VALUE`.
2. **Gerbang Logika Mitigasi Wajib (`< 85%`):** Indikator dengan capaian di bawah ambang merah otomatis membuka panel mitigasi dengan **Quick-Tag Chips** dan memblokir penyimpanan final di sisi server (*hard validation* HTTP `422`) apabila **Problem Identification**, **Corrective Action**, dan **Need Support BOD** belum dilengkapi minimal 10 karakter.
3. **Backend Relasional PostgreSQL Bebas Experimental Warning:** Berjalan di atas `pg.Pool` (**PostgreSQL 18**, database `rahma_kpi`) untuk stabilitas rilis produksi, dilengkapi pencadangan otomatis saat koneksi offline (*Offline Auto-Backup*) dan ekspor snapshot `.json`.
4. **RBAC Sungguhan & Isolasi Departemen:** Autentikasi sesi berbasis cookie `HttpOnly` bertanda tangan `HMAC-SHA256` dan hashing kata sandi `scryptSync` dengan isolasi hak tulis antar-departemen di level API.
5. **Night-Comfort Dark Mode & Standar Teks 2-Tier:** Mendukung peralihan instan antara **Mode Terang** dan **Mode Malam (Dark Mode)** yang tersinkronisasi di seluruh halaman (`/`, `/login`, `/signup`, `/app`), menggunakan hierarki warna teks 2-tier kontras tinggi serta popup notifikasi standar (Hitam `#0A0A0A` teks putih & Merah `#DC2626` teks putih).
6. **Visualisasi Eksekutif Terkalibrasi & Cetak PDF 1-Klik:** Dilengkapi *Speedometer Semicircle Arc* dan *Gauge Bar Horizontal* yang terkalibrasi sejajar (`0%–85%` Merah, `85%–100%` Kuning, `100%–120%` Hijau), *12-Month Performance Heatmap Matrix*, filter **Fokus Merah**, *Drawer Perincian Individu 12 Bulan*, serta cetak **One-Click Executive PDF** (*A4 Landscape 16:9*).

---

## Arsitektur & Struktur Proyek

| Komponen | Lokasi | Fungsi Utama |
|---|---|---|
| **Server & RBAC Middleware** | [server.js](file:///c:/Users/Legion/rahma-kpi/server.js) | HTTP server, rute halaman (`/`, `/app`, `/login`, `/signup`), autentikasi sesi `HMAC-SHA256`, OTP email 6-digit, penjaga RBAC (`401`/`403`), & REST API |
| **Layer Database PostgreSQL** | [src/db.js](file:///c:/Users/Legion/rahma-kpi/src/db.js) | Koneksi `pg.Pool` ke PostgreSQL (`rahma_kpi`), inisialisasi skema & data awal 5 divisi PT GSI, hashing `scryptSync`, serta kueri agregasi dashboard |
| **Mesin Kalkulasi & Mitigasi** | [src/engine.js](file:///c:/Users/Legion/rahma-kpi/src/engine.js) | Kalkulasi capaian (`MAXIMIZE`/`MINIMIZE`), skor terbobot, klasifikasi warna, agregasi YTD, validasi gerbang mitigasi, & kontras warna HEX (WCAG) |
| **Migrasi SQLite ke PostgreSQL** | [scripts/migrate-sqlite-to-pg.js](file:///c:/Users/Legion/rahma-kpi/scripts/migrate-sqlite-to-pg.js) | Utilitas migrasi satu perintah (`npm run migrate:pg`) dari berkas SQLite lokal ke database PostgreSQL `rahma_kpi` |
| **Landing Page Utama (`/`)** | [public/home.html](file:///c:/Users/Legion/rahma-kpi/public/home.html) | Halaman utama produk dengan simulator interaktif Gauge 5 Divisi, demonstrasi Gerbang Mitigasi `< 85%`, matriks RBAC, & sakelar Mode Malam |
| **Workspace Utama (`/app`)** | [public/index.html](file:///c:/Users/Legion/rahma-kpi/public/index.html), [public/app.js](file:///c:/Users/Legion/rahma-kpi/public/app.js), [public/styles.css](file:///c:/Users/Legion/rahma-kpi/public/styles.css) | 4 Menu Inti: Executive Dashboard, Input KPI Spreadsheet & Mitigasi, CPMD Hub & Kamus KPI (Validasi Bobot 100%), serta Studio Atribut HEX (`#RRGGBB`) |
| **Autentikasi (`/login`, `/signup`)** | [public/login.html](file:///c:/Users/Legion/rahma-kpi/public/login.html), [public/signup.html](file:///c:/Users/Legion/rahma-kpi/public/signup.html) | Halaman Login & Registrasi mandiri dengan tombol masuk cepat akun demo, simulator peran interaktif, dan galeri lanskap *Magnifik 2400p* |
| **Buku Panduan Pengguna (PDF)** | [docs-manual/User-Manual.pdf](file:///c:/Users/Legion/rahma-kpi/docs-manual/User-Manual.pdf), [docs-manual/manual.html](file:///c:/Users/Legion/rahma-kpi/docs-manual/manual.html), [docs-manual/generate-pdf.js](file:///c:/Users/Legion/rahma-kpi/docs-manual/generate-pdf.js) | Buku Panduan Pengguna resmi berbahasa Indonesia (A4 PDF), lengkap dengan 10 screenshot resolusi tinggi di `docs-manual/screenshots/` |
| **Pengujian Engine & Stress Test** | [tests/engine.test.js](file:///c:/Users/Legion/rahma-kpi/tests/engine.test.js) | Unit test polaritas, gerbang mitigasi, agregasi YTD, validasi HEX/WCAG, integrasi PostgreSQL, dan uji stres 10.000 agregasi YTD |

---

## Peta Rute & Halaman Aplikasi

| Rute URL | Berkas | Keterangan |
|---|---|---|
| `http://localhost:3456/` (atau `/home`) | `public/home.html` | **Landing Page Utama**: Pengenalan fitur RAHMA, simulator skor divisi, & navigasi masuk |
| `http://localhost:3456/login` | `public/login.html` | **Halaman Login RBAC**: Masuk dengan akun korporasi atau 1-klik akun demo |
| `http://localhost:3456/signup` | `public/signup.html` | **Halaman Registrasi**: Pendaftaran akun baru untuk *Division Leader* atau *Executive* |
| `http://localhost:3456/app` (atau `/dashboard`) | `public/index.html` | **Workspace Utama**: Executive Dashboard, Input KPI, CPMD Hub, & Katalog Atribut HEX |

---

## Peran & Hak Akses (RBAC)

| Peran (`role`) | Hak Akses Utama | Pembatasan Server |
|---|---|---|
| `CPMD_ADMIN` | Akses penuh ke seluruh 4 menu: Kamus KPI, Master Departemen, Studio Atribut HEX, Input Realisasi seluruh departemen, Kunci/Buka Periode, dan Backup `.JSON` | Tidak ada (Administrator penuh) |
| `DIV_LEADER` | Melihat Executive Dashboard serta mengisi Target, Actual, dan Mitigasi Risiko | Terbatas hanya pada `department_id` miliknya (`403` jika mencoba menyimpan departemen lain atau rute admin) |
| `EXECUTIVE` | Melihat Executive Dashboard, Fokus Indikator Merah, Heatmap 12 bulan, rincian KPI, dan ekspor PDF | *Read-only* total (`403` untuk seluruh endpoint tulis) |

### Akun Demo Bawaan
Seluruh akun demo menggunakan kata sandi default **`rahma2026`**:
- **CPMD Admin:** `nadia.cpmd@gsi.co.id`
- **Division Leader (OPS):** `budi.ops@gsi.co.id`
- **Division Leader (COM):** `ratna.com@gsi.co.id`
- **Division Leader (FIN):** `hendra.fin@gsi.co.id`
- **Division Leader (HC):** `siti.hc@gsi.co.id`
- **Division Leader (IT):** `arif.it@gsi.co.id`
- **Executive / BOD:** `darmawan.bod@gsi.co.id`

---

## Persyaratan & Cara Menjalankan

### 1. Prasyarat Sistem
- **Node.js** `>= 22.5.0`
- **PostgreSQL** (disarankan PostgreSQL 16–18) berjalan di `127.0.0.1:5432` dengan database bernama `rahma_kpi`.

Konfigurasi default PostgreSQL pada `src/db.js` menggunakan parameter berikut (dapat disesuaikan melalui variabel lingkungan):

| Variabel Lingkungan | Nilai Default | Keterangan |
|---|---|---|
| `PGHOST` | `127.0.0.1` | Host server PostgreSQL |
| `PGPORT` | `5432` | Port server PostgreSQL |
| `PGUSER` | `postgres` | Username PostgreSQL |
| `PGPASSWORD` | *(kosong / NULL)* | Kata sandi PostgreSQL |
| `PGDATABASE` | `rahma_kpi` | Nama database PostgreSQL |
| `PORT` | `3456` | Port HTTP server RAHMA |

### 2. Instalasi & Menjalankan Server

```bash
# 1. Instal dependensi
npm install

# 2. (Opsional) Migrasikan data dari SQLite lokal ke PostgreSQL
npm run migrate:pg

# 3. Jalankan pengujian unit & stress test (10.000 agregasi YTD)
npm test

# 4. Jalankan server produksi RAHMA
npm start
```

### 3. Memperbarui Buku Panduan Pengguna (`User-Manual.pdf`)
Jika terdapat pembaruan antarmuka dan Anda ingin mengambil ulang seluruh screenshot resolusi tinggi sekaligus memperbarui PDF buku panduan pengguna:

```bash
# Pastikan server RAHMA sedang berjalan di http://localhost:3456, lalu jalankan:
node docs-manual/generate-pdf.js
```
Berkas hasil ekspor akan tersimpan otomatis di `docs-manual/User-Manual.pdf` beserta tangkapan layar terbaru di `docs-manual/screenshots/`.
