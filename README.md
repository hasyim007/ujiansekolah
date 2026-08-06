# Sistem Ujian Sekolah — Cloudflare Worker + D1 + GitHub

Versi ini terhubung ke **Cloudflare D1** (database SQL sungguhan) lewat satu
**Cloudflare Worker** (format terbaru "Connect to Git" — `wrangler deploy`,
bukan lagi Pages `functions/` + `wrangler pages deploy`), dan dideploy dari
repo **GitHub**. Tidak ada lagi localStorage — semua data (bank soal, sesi
ujian, peserta, hasil, pengaturan) tersimpan di D1.

> **Kenapa struktur ini berubah dari versi sebelumnya?** Cloudflare sekarang
> menyatukan Workers & Pages jadi satu sistem. Halaman "Connect to Git" selalu
> membuat Worker (`wrangler deploy`); opsi Pages klasik (`wrangler pages
> deploy` + folder `functions/`) sudah tidak muncul lagi di alur itu. Semua
> route yang dulu ada di `functions/api/*.js` sekarang digabung jadi satu
> router di `src/index.js` (lewat modul-modul kecil di `src/routes/`), dan
> halaman HTML dilayani lewat **Workers Static Assets** (binding `ASSETS`).
> Logic tiap endpoint (auth admin, rate limit, hentikan sesi paksa, dll)
> **tidak berubah** — hanya bentuknya yang dipindah dari `onRequestGet/Post/...`
> jadi fungsi handler biasa yang dipanggil dari tabel rute.

## Struktur proyek
```
├── public/                 12 halaman HTML (peserta + admin + livescore) + api.js
│                            → dilayani sebagai static assets (binding ASSETS)
├── src/
│   ├── index.js             Worker utama: tabel rute /api/*, gate sesi admin
│   │                          untuk halaman admin-*.html, fallback ke ASSETS
│   ├── utils.js              helper bersama (dulu functions/api/_utils.js)
│   └── routes/                satu file per grup endpoint, logic sama persis
│       ├── auth.js             login/logout/me admin
│       ├── pengaturan.js        pengaturan (admin) + pengaturan/publik
│       ├── soal.js              CRUD bank soal
│       ├── sesi.js              CRUD sesi ujian + regen-token + hentikan
│       ├── peserta.js           roster peserta + reset-pin
│       ├── hasil.js             data pengerjaan peserta + reset
│       └── ujian.js             alur login → mulai → jawaban → submit
├── schema.sql               struktur tabel D1 (tidak berubah)
├── seed.sql                 data contoh awal (tidak berubah)
└── wrangler.toml            konfigurasi Worker: main, assets, binding D1
```

Kenapa `public/admin-*.html` dan `/api/*` tetap bisa dijaga sesi admin padahal
dilayani lewat static assets? `wrangler.toml` men-set:
```toml
[assets]
run_worker_first = ["/admin-*", "/api/*"]
```
Artinya dua kelompok path itu SELALU lewat `src/index.js` dulu (Worker cek
sesi admin / jalankan route API), baru kalau lolos, Worker sendiri yang
memanggil `env.ASSETS.fetch(request)` untuk ambil file HTML-nya. Halaman lain
(`login-peserta.html`, `livescore.html`, `api.js`, dst) dilayani langsung dari
assets tanpa invoke Worker sama sekali — lebih cepat & hemat.

## Langkah setup (sekali di awal)

### 1. Push ke GitHub
```bash
git init
git add .
git commit -m "Sistem ujian sekolah — Cloudflare Worker + D1"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

### 2. Buat database D1
```bash
npm install
npx wrangler login
npx wrangler d1 create ujian_sekolah_db
```
Perintah di atas akan menampilkan `database_id`. **Salin ID itu ke `wrangler.toml`**,
ganti `GANTI_DENGAN_ID_D1_KAMU`.

### 3. Jalankan migrasi & seed ke D1 remote (database sungguhan di Cloudflare)
```bash
npm run db:migrate:remote
npm run db:seed:remote
```
(`seed.sql` berisi data contoh — hapus/ubah isinya kapan saja lewat halaman admin,
atau jalankan query manual lewat `npx wrangler d1 execute ujian_sekolah_db --remote --command "..."`.)

### 4. Hubungkan repo GitHub ke Cloudflare Workers
1. Buka dashboard Cloudflare → **Workers & Pages** → **Create** → **Connect to Git**.
2. Pilih repo GitHub kamu. Cloudflare akan otomatis mendeteksi `wrangler.toml`
   dan mem-build sebagai Worker (bukan lagi opsi "Pages").
3. Build settings default biasanya sudah cocok (Cloudflare baca `main` dan
   `[assets]` langsung dari `wrangler.toml`); tidak perlu isi build command.
4. Setelah project dibuat, buka **Settings → Bindings** → tambahkan **D1
   database binding**: **Variable name: `DB`**, pilih database `ujian_sekolah_db`.
   (Kalau `database_id` di `wrangler.toml` sudah benar sebelum push pertama,
   binding ini biasanya sudah otomatis terpasang dari config — tetap cek di sini.)
5. Deploy. Cloudflare otomatis build ulang setiap kamu `git push` ke GitHub.

### 5. Coba lokal sebelum push (opsional tapi disarankan)
```bash
npm run db:migrate:local
npm run db:seed:local
npm run dev
```
Buka `http://localhost:8787` (port default `wrangler dev`).

### Deploy manual dari command line (alternatif langkah 4)
```bash
npm run deploy
```
(`wrangler deploy` — bukan lagi `wrangler pages deploy`.)

## Akun contoh (dari seed.sql)
- **Peserta**: Nomor `25-05A-01` s/d `25-05B-02`, PIN `1234`
- **Admin**: buka `login-admin.html` — default `admin` / `admin123` (dari `schema.sql`,
  ubah lewat halaman Pengaturan setelah login pertama). Semua halaman `admin-*.html`
  dan endpoint tulis (`POST`/`PUT`/`DELETE` pada `/api/soal`, `/api/sesi`, `/api/peserta`,
  `/api/hasil`, `/api/pengaturan`) tetap butuh sesi login admin — sekarang dijaga
  langsung di `src/index.js`. Sesi berlaku 8 jam lewat cookie httpOnly.
- **Token sesi Matematika**: cek/atur di `admin-dashboard.html` setelah deploy.

## Kalau upgrade dari versi lama (sudah ada database D1 sebelumnya)
Skema database tidak berubah sama sekali di konversi ini. Kalau sebelumnya kamu
sudah menjalankan migrasi versi Pages Functions, tidak perlu migrasi ulang —
tinggal deploy struktur Worker baru ini ke database D1 yang sama.

## Alur data (ringkas)
Semua 12 halaman HTML memanggil `window.DB.xxx()` dari `public/api.js` (tidak
berubah sama sekali), yang meneruskan ke `fetch('/api/...')`. Sekarang semua
request itu ditangani oleh satu Worker (`src/index.js`), yang mencocokkan
method + path ke tabel `ROUTES`, lalu memanggil handler terkait di
`src/routes/`. Handler baca/tulis ke D1 lewat `env.DB` (binding yang kamu set
di langkah 4).

Kalau nanti mau ubah logika backend (misalnya tambah validasi, ubah cara
hitung nilai), edit langsung file terkait di `src/routes/` — tidak perlu
sentuh HTML sama sekali. Kalau mau menambah endpoint baru, tambahkan satu
baris di tabel `ROUTES` pada `src/index.js` plus handler-nya di
`src/routes/`.

## Catatan keamanan (tidak berubah dari versi sebelumnya)
Sudah diperbaiki:
- ✅ Halaman `admin-*.html` dan endpoint tulis butuh login admin (`login-admin.html`),
  dijaga sesi cookie httpOnly (lihat di atas).
- ✅ `GET /api/pengaturan` (berisi username/password) admin-only; halaman peserta
  pakai `/api/pengaturan/publik` yang hanya berisi pengaturan non-sensitif.
- ✅ Percobaan login peserta (`verifikasi-identitas`) & token (`verifikasi-token`)
  dibatasi di server (bukan cuma di frontend), pakai batas dari halaman Pengaturan.
- ✅ Menutup sesi ujian yang sedang berlangsung (status → Selesai) otomatis
  submit & nilai peserta yang masih mengerjakan (lewat `hentikan sesi`), tidak nyangkut lagi.
- ✅ Ada UI tambah & hapus peserta di `admin-kelola-peserta.html`.

Masih perlu diperhatikan:
- Password admin di `pengaturan` masih disimpan polos (bukan hash) — untuk skala sekolah kecil
  dengan akses terbatas ini mungkin cukup, tapi idealnya di-hash (misal pakai Web Crypto `SubtleCrypto`).
- `GET /api/soal` (dipakai `pengerjaan-ujian.html` untuk memuat soal) masih mengirim `kunci`
  (kunci jawaban) ke browser peserta — secara teknis bisa dibaca lewat DevTools. Untuk sekolah
  kecil dengan pengawasan langsung risikonya rendah, tapi kalau mau lebih aman, endpoint ini perlu
  dipisah: versi tanpa kunci untuk peserta, penilaian tetap dihitung di server (`gradingHasil` sudah
  begitu, tinggal soal itu sendiri yang perlu disaring).
- Rate limit login admin & peserta memakai tabel D1 sederhana (window tetap 15 menit) — cukup untuk
  skala sekolah, tapi bukan pengganti Cloudflare Rate Limiting di level edge kalau mau lapisan ekstra.
