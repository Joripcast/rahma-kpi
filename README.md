# RAHMA — Platform Governance KPI & Mitigasi Risiko Korporasi

![Logo RAHMA](public/images/rahma-logo.png)

**RAHMA** (*Real-time Analytical Hub for Management & Accountability*) adalah sistem manajemen dan pemantauan *Key Performance Indicator* (KPI) korporasi berbasis web yang dirancang mandiri (*standalone*) dengan fokus pada **akurasi skoring otomatis**, **gerbang mitigasi risiko wajib**, **tata kelola akses berbasis peran (RBAC)** yang ketat, **keamanan *defense-in-depth***, serta **kenyamanan visual (*Light & Night-Comfort Dark Mode*)**.

Dikembangkan untuk kebutuhan tata kelola **PT Global Service Indonesia (GSI)** — khususnya tim *Corporate Planning & Management Development* (CPMD), pimpinan departemen (*Division Leader*), dan jajaran Direksi (*Executive / BOD*) — RAHMA menggantikan pelaporan spreadsheet dan kompilasi slide kuartalan manual menjadi satu platform real-time berbasis **PostgreSQL** yang siap dijalankan secara *on-premise* maupun *cloud*.

---

## Keunggulan Utama RAHMA

1. **Mesin Kalkulasi Polaritas & YTD Terstandarisasi:** Mendukung indikator bertipe **Maximize** maupun **Minimize**, batas atas skor otomatis (**Cap Score 120%**), perubahan *Month-over-Month* (**MoM Delta**), serta agregasi **Year-to-Date (YTD)** dengan mode `SUM`, `AVG`, dan `LAST_VALUE`.
2. **Gerbang Logika Mitigasi Wajib (`< 85%`):** Indikator dengan capaian di bawah ambang merah otomatis membuka panel mitigasi dengan **Quick-Tag Chips** dan memblokir penyimpanan final di sisi server (*hard validation* HTTP `422`) apabila **Problem Identification**, **Corrective Action**, dan **Need Support BOD** belum dilengkapi minimal 10 karakter.
3. **Backend Relasional PostgreSQL Bebas Experimental Warning:** Berjalan di atas `pg.Pool` (**PostgreSQL 18**, database `rahma_kpi`) untuk stabilitas rilis produksi, dilengkapi pencadangan otomatis saat koneksi offline (*Offline Auto-Backup*) dan ekspor snapshot `.json`.
4. **RBAC Sungguhan, Isolasi Departemen & Hardening Keamanan:** Autentikasi sesi berbasis cookie `HttpOnly` bertanda tangan `HMAC-SHA256` dengan kunci kriptografis 256-bit (`data/.session_secret`), revokasi sesi instan (`jti` & `pwdSig`), hashing kata sandi `scryptSync`, *sliding-window rate limiter*, proteksi CSRF `Origin`, serta isolasi hak tulis antar-departemen di level API.
5. **Night-Comfort Dark Mode & Standar Teks 2-Tier:** Mendukung peralihan instan antara **Mode Terang** dan **Mode Malam (Dark Mode)** yang tersinkronisasi di seluruh halaman (`/`, `/login`, `/signup`, `/app`), menggunakan hierarki warna teks 2-tier kontras tinggi serta popup notifikasi standar (Hitam `#0A0A0A` teks putih & Merah `#DC2626` teks putih).
6. **Visualisasi Eksekutif Terkalibrasi & Cetak PDF 1-Klik:** Dilengkapi *Speedometer Semicircle Arc* dan *Gauge Bar Horizontal* yang terkalibrasi sejajar (`0%–85%` Merah, `85%–100%` Kuning, `100%–120%` Hijau), *12-Month Performance Heatmap Matrix*, filter **Fokus Merah**, *Drawer Perincian Individu 12 Bulan*, serta cetak **One-Click Executive PDF** (*A4 Landscape 16:9*).

---

## Arsitektur Keamanan & Hardening (*Defense-in-Depth*)

RAHMA menerapkan 8 lapisan perlindungan keamanan di sisi server ([server.js](file:///c:/Users/Legion/rahma-kpi/server.js) dan [src/db.js](file:///c:/Users/Legion/rahma-kpi/src/db.js)) maupun klien ([public/app.js](file:///c:/Users/Legion/rahma-kpi/public/app.js)):

1. **Kunci Sesi Kriptografis 256-Bit & Revokasi Sesi (`jti` + `pwdSig`):**
   - Kunci penandatanganan `HMAC-SHA256` dibangkitkan secara acak menggunakan `crypto.randomBytes(32)` dan disimpan secara persisten di `data/.session_secret` (diabaikan oleh Git di [.gitignore](file:///c:/Users/Legion/rahma-kpi/.gitignore)) atau melalui variabel lingkungan `RAHMA_SESSION_SECRET`.
   - Setiap token memiliki *unique token ID* (`jti`) yang langsung masuk daftar blokir server saat `POST /api/auth/logout`, serta *password fingerprint* (`pwdSig`) yang otomatis menggugurkan seluruh sesi lama saat kata sandi pengguna diganti.
2. **Sliding-Window Rate Limiter (Anti Brute-Force):**
   - `/api/auth/login`: Maksimal **10 percobaan gagal per 15 menit** per kombinasi IP + email (reset otomatis saat login berhasil).
   - `/api/auth/signup`: Maksimal **10 pendaftaran per 15 menit** per IP.
   - `/api/auth/otp/request`: Maksimal **5 permintaan OTP per 10 menit** per pengguna + IP.
   - Pelanggaran batas mengembalikan respons HTTP `429 Too Many Requests` beserta header `Retry-After`.
3. **Proteksi OTP 6-Digit (`timingSafeEqual` & Batas 5 Percobaan):**
   - Verifikasi kode OTP menggunakan `crypto.timingSafeEqual` untuk mencegah *timing side-channel attack*.
   - Kode OTP otomatis hangus dan dihapus setelah **5 kali salah tebak** berturut-turut.
   - `devOtpPreview` otomatis disembunyikan dari payload respons apabila server dijalankan dengan `NODE_ENV=production`.
4. **HTTP Security Headers & Content-Security-Policy (CSP):**
   - Setiap respons HTTP dilengkapi header `Content-Security-Policy` (`default-src 'self'`, `frame-ancestors 'self'`, `object-src 'none'`), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Permissions-Policy`.
5. **Proteksi CSRF (`Origin` & `Content-Type: application/json` Guard):**
   - Seluruh request mutasi (`POST`, `PUT`, `DELETE`) ke `/api/*` memvalidasi kesesuaian header `Origin` terhadap `Host` server dan mewajibkan header `Content-Type: application/json`.
6. **Proteksi Integritas Relasi Atribut KPI Aktif:**
   - Endpoint `DELETE /api/attributes/:id` memeriksa keterkaitan atribut pada KPI yang masih aktif (`is_active = 1`) dan menolak penghapusan dengan HTTP `409 Conflict` jika atribut masih digunakan.
7. **Validasi Input Numerik/Enum Ketat & Sanitasi Error `500`:**
   - Validasi `Number.isFinite` pada `year`, `month`, `weight`, `target_value`, dan `actual_value`, serta *whitelist* enum untuk `polarity` (`MAXIMIZE`/`MINIMIZE`), `ytd_mode` (`SUM`/`AVG`/`LAST_VALUE`), dan `attribute_group`.
   - Error tak terduga (`500`) dicatat di log server namun hanya mengembalikan pesan generik yang aman ke klien tanpa membocorkan detail skema database.
8. **Validasi Identifier PostgreSQL & Sanitasi DOM XSS (`escapeHtml`):**
   - Nama database `PGDATABASE` divalidasi dengan regex ketat `/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/` sebelum menjalankan `CREATE DATABASE`.
   - Fungsi `escapeHtml()` di frontend men-sanitasi `&`, `<`, `>`, `"`, dan tanda kutip tunggal `'` (`&#39;`).

---

## Arsitektur & Struktur Proyek

| Komponen | Lokasi | Fungsi Utama |
|---|---|---|
| **Server, RBAC & Security Middleware** | [server.js](file:///c:/Users/Legion/rahma-kpi/server.js) | HTTP server, rute halaman (`/`, `/app`, `/login`, `/signup`), sesi `HMAC-SHA256` + revokasi `jti`/`pwdSig`, rate limiter, CSRF/CSP guard, OTP 6-digit, penjaga RBAC (`401`/`403`), & REST API |
| **Layer Database PostgreSQL** | [src/db.js](file:///c:/Users/Legion/rahma-kpi/src/db.js) | Koneksi `pg.Pool` ke PostgreSQL (`rahma_kpi`), inisialisasi skema & data awal 5 divisi PT GSI, hashing `scryptSync`, proteksi integritas relasi atribut, serta kueri agregasi dashboard |
| **Mesin Kalkulasi & Mitigasi** | [src/engine.js](file:///c:/Users/Legion/rahma-kpi/src/engine.js) | Kalkulasi capaian (`MAXIMIZE`/`MINIMIZE`), skor terbobot, klasifikasi warna, agregasi YTD, validasi gerbang mitigasi, & kontras warna HEX (WCAG) |
| **Migrasi SQLite ke PostgreSQL** | [scripts/migrate-sqlite-to-pg.js](file:///c:/Users/Legion/rahma-kpi/scripts/migrate-sqlite-to-pg.js) | Utilitas migrasi satu perintah (`npm run migrate:pg`) dari berkas SQLite lokal ke database PostgreSQL `rahma_kpi` |
| **Landing Page Utama (`/`)** | [public/home.html](file:///c:/Users/Legion/rahma-kpi/public/home.html) | Halaman utama produk dengan Hero 2-kolom presisi, 6 kartu kapabilitas & simulator interaktif (Gauge 5 Divisi, Gerbang Mitigasi `< 85%`, RBAC, CPMD Tracker, Drawer 12 Bulan + HEX, Mode Malam + PDF), & sakelar tema |
| **Workspace Utama (`/app`)** | [public/index.html](file:///c:/Users/Legion/rahma-kpi/public/index.html), [public/app.js](file:///c:/Users/Legion/rahma-kpi/public/app.js), [public/styles.css](file:///c:/Users/Legion/rahma-kpi/public/styles.css) | 4 Menu Inti: Executive Dashboard, Input KPI Spreadsheet & Mitigasi, CPMD Hub & Kamus KPI (Validasi Bobot 100%), serta Studio Atribut HEX (`#RRGGBB`) |
| **Autentikasi (`/login`, `/signup`)** | [public/login.html](file:///c:/Users/Legion/rahma-kpi/public/login.html), [public/signup.html](file:///c:/Users/Legion/rahma-kpi/public/signup.html) | Halaman Login & Registrasi mandiri dengan tombol masuk cepat akun demo, simulator peran interaktif, dan galeri lanskap *Magnifik 2400p* |
| **Aset Branding Resmi** | [public/images/rahma-logo.png](file:///c:/Users/Legion/rahma-kpi/public/images/rahma-logo.png) | Logo wordmark resmi **Rahma** yang digunakan secara konsisten di seluruh halaman aplikasi dan buku panduan PDF |
| **Buku Panduan Pengguna (PDF)** | [docs-manual/User-Manual.pdf](file:///c:/Users/Legion/rahma-kpi/docs-manual/User-Manual.pdf), [docs-manual/manual.html](file:///c:/Users/Legion/rahma-kpi/docs-manual/manual.html), [docs-manual/generate-pdf.js](file:///c:/Users/Legion/rahma-kpi/docs-manual/generate-pdf.js) | Buku Panduan Pengguna resmi berbahasa Indonesia (A4 PDF), lengkap dengan 10 screenshot resolusi tinggi di `docs-manual/screenshots/` |
| **Pengujian Engine & Stress Test** | [tests/engine.test.js](file:///c:/Users/Legion/rahma-kpi/tests/engine.test.js) | Unit test polaritas, gerbang mitigasi, agregasi YTD, validasi HEX/WCAG, integrasi PostgreSQL, dan uji stres 10.000 agregasi YTD |

---

## Peta Rute & Halaman Aplikasi

| Rute URL | Berkas | Keterangan |
|---|---|---|
| `http://localhost:3456/` (atau `/home`) | `public/home.html` | **Landing Page Utama**: Hero 2-kolom, 6 kartu fitur & simulator interaktif, alur kerja 4 langkah, & navigasi masuk |
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

Konfigurasi server dan PostgreSQL dapat disesuaikan melalui variabel lingkungan berikut:

| Variabel Lingkungan | Nilai Default | Keterangan |
|---|---|---|
| `PGHOST` | `127.0.0.1` | Host server PostgreSQL |
| `PGPORT` | `5432` | Port server PostgreSQL |
| `PGUSER` | `postgres` | Username PostgreSQL |
| `PGPASSWORD` | *(kosong / NULL)* | Kata sandi PostgreSQL |
| `PGDATABASE` | `rahma_kpi` | Nama database PostgreSQL (divalidasi dengan regex identifier aman) |
| `PORT` | `3456` | Port HTTP server RAHMA |
| `RAHMA_SESSION_SECRET` | *(Otomatis di `data/.session_secret`)* | Kunci kriptografis 256-bit untuk tanda tangan sesi `HMAC-SHA256` |
| `NODE_ENV` | `development` | Setel ke `production` untuk menonaktifkan `devOtpPreview` pada respons API OTP |

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
