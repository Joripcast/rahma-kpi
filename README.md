# Rahma — Platform Governance KPI & Mitigasi Risiko Korporasi

**Rahma** adalah sistem manajemen dan pemantauan *Key Performance Indicator* (KPI) korporasi berbasis web yang dirancang mandiri (*standalone*) dengan fokus pada **akurasi skoring otomatis**, **gerbang mitigasi risiko wajib**, dan **tata kelola akses berbasis peran (RBAC)** yang ketat.

Dikembangkan untuk kebutuhan tata kelola **PT Global Service Indonesia (GSI)** — khususnya tim *Corporate Planning & Management Development* (CPMD), pimpinan departemen (*Division Leader*), dan jajaran Direksi (*Executive / BOD*) — Rahma menggantikan pelaporan spreadsheet terpisah menjadi satu platform terintegrasi yang dapat dijalankan secara *on-premise* maupun komersial (*SaaS*).

---

## Mengapa Rahma?

1. **Perhitungan Polaritas & YTD Terstandarisasi:** Mendukung indikator bertipe **Maximize** maupun **Minimize**, batas atas skor otomatis (**Cap Score 120%**), serta agregasi **Year-to-Date (YTD)** dengan mode `SUM`, `AVG`, dan `LAST_VALUE`.
2. **Gerbang Logika Mitigasi Wajib (`< 85%`):** Indikator dengan capaian di bawah ambang merah otomatis memblokir penyimpanan di sisi server (*hard validation*) apabila **Problem Identification**, **Corrective Action**, dan **Need Support BOD** belum dilengkapi.
3. **RBAC Sungguhan & Isolasi Departemen:** Autentikasi sesi berbasis cookie `HttpOnly` bertanda tangan HMAC-SHA256 dengan isolasi data antar-departemen di level API.
4. **Arsitektur Mandiri & Auto-Backup Offline:** Berjalan di atas Node.js dan SQLite (`node:sqlite`) tanpa ketergantungan database eksternal, dilengkapi pencadangan otomatis saat koneksi offline dan ekspor snapshot `.json`.
5. **Siap Presentasi Direksi:** Menyediakan *Executive Scorecard* dengan SVG Gauge, Heatmap 12 bulan, filter **Fokus Merah**, sidebar yang dapat disembunyikan, dan cetak **Executive PDF** 1-klik.

---

## Arsitektur & Struktur Proyek

| Komponen | Lokasi | Fungsi Utama |
|---|---|---|
| **Server & RBAC Middleware** | `server.js` | HTTP server, autentikasi sesi HMAC-SHA256, OTP email, penjaga RBAC (`401`/`403`), API KPI/Departemen/Atribut, & static hosting |
| **Database & Engine Skoring** | `src/db.js` | Skema SQLite (`data/rahma.sqlite`), hashing kata sandi `scryptSync`, kalkulasi polaritas, YTD, & validasi kontras WCAG |
| **Aplikasi Dashboard** | `public/index.html`, `public/app.js`, `public/styles.css` | Executive Dashboard, Input KPI & Mitigasi (dengan konfirmasi pindah menu), CPMD Hub, Studio Atribut HEX, Pengaturan Bercabang, & Offline Auto-Backup |
| **Autentikasi Terpisah** | `public/login.html`, `public/signup.html` | Halaman Login & Daftar Akun mandiri dengan pratinjau peran RBAC interaktif dan meteran kekuatan sandi |
| **Homepage Komersial** | `public/home.html` | Halaman promosi produk dengan simulator interaktif Gauge YTD, Gerbang Mitigasi `< 85%`, Matriks RBAC, dan paket lisensi |
| **Aset Brand & Tipografi** | `public/images/rahma-logo.png`, `public/images/gsi-logo.png`, `public/fonts/` | Logo resmi **Rahma** (`#007BC8`) dan **PT Global Service Indonesia (GSI)**, font `Commissioner` (Title), `Sarabun` (Body/UI), & `IBM Plex Mono` (`<kbd>`/Monospace) |
| **Pengujian Engine** | `tests/engine.test.js` | Unit test polaritas, gerbang mitigasi, agregasi YTD, validasi HEX/WCAG, dan uji stres 10.000 agregasi |

---

## Peran & Hak Akses (RBAC)

| Peran (`role`) | Hak Akses Utama | Pembatasan Server |
|---|---|---|
| `CPMD_ADMIN` | Akses penuh: Kamus KPI, Manajemen Departemen, Studio Atribut HEX, Input Realisasi seluruh departemen, Kunci/Buka Periode, dan Backup `.JSON` | Tidak ada (Administrator penuh) |
| `DIV_LEADER` | Melihat Executive Dashboard serta mengisi Target, Actual, dan Mitigasi Risiko | Terbatas hanya pada `department_id` miliknya (`403` jika mencoba menyimpan departemen lain atau rute admin) |
| `EXECUTIVE` | Melihat Executive Dashboard, Heatmap 12 bulan, rincian KPI, dan ekspor PDF | *Read-only* total (`403` untuk seluruh endpoint tulis) |

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

## Fitur Utama Antarmuka

- **Halaman Login & Sign Up Terpisah (`/login`, `/signup`):** Autentikasi berbasis cookie sesi `HttpOnly` bertanda tangan HMAC-SHA256 dan kata sandi ter-hash (`scryptSync`), lengkap dengan eksplorasi peran interaktif serta pendaftaran akun baru (`DIV_LEADER` / `EXECUTIVE`).
- **Menu Pengaturan Akun Bercabang (`#accountSettingsModalOverlay`):**
  - **Profil & Avatar:** Unggah foto avatar persegi (`256×256px` tersimpan per akun), ubah nama & jabatan (`PUT /api/auth/profile`), serta tombol Logout.
  - **Keamanan & OTP:** Ubah email dan kata sandi dengan verifikasi kode OTP 6-digit ke email.
  - **Tampilan & Kaca:** Personalisasi tema atmosferik, foto komputer terakhir, dan intensitas *frosted glass* per akun.
  - **Preferensi & Data:** Atur mode default (**Monthly / YTD**), konfirmasi perubahan belum disimpan saat pindah menu, dan sinkronisasi/ekspor snapshot offline.
  - **Tentang Rahma:** Informasi versi (`Versi 1.0.0`) dan identitas sistem.
- **Pencadangan Otomatis Offline (*Offline Auto-Backup*):**
  - Snapshot data dashboard terakhir disimpan otomatis di browser per akun.
  - Input KPI saat koneksi terputus otomatis masuk ke antrean lokal dan tersinkronkan otomatis begitu koneksi kembali online.
  - Ekspor `.json` tetap berjalan dari snapshot lokal saat offline.
- **Tampilan Fokus Data & Cetak PDF Flat:** Sidebar dapat disembunyikan (`☰`) dan topbar otomatis beralih menampilkan *co-branding* **Rahma | GSI**; tombol **One-Click Executive PDF** menghasilkan laporan A4 Landscape berdesain flat putih dengan warna aksen sebagai *outline* kartu serta tabel Heatmap 12 bulan penuh.

---

## Cara Menjalankan & Menguji

```bash
# 1. Jalankan server aplikasi
npm start

# 2. Jalankan unit & stress test engine KPI
npm test
```

Setelah server berjalan pada port default `3456`:
- **Dashboard Utama:** `http://localhost:3456/`
- **Halaman Login:** `http://localhost:3456/login`
- **Halaman Sign Up:** `http://localhost:3456/signup`
- **Homepage Promosi Produk:** `http://localhost:3456/home` (atau `/home.html`, `/promo`)
