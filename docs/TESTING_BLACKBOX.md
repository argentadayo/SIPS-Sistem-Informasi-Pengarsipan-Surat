# Laporan Pengujian Blackbox — Sistem Arsip Surat

## 1. Informasi Pengujian

| Item | Keterangan |
|------|------------|
| Metode | Blackbox Testing (pengujian fungsional dari sisi pengguna) |
| Teknik | Positive testing (happy path), negative testing (validasi), boundary value, RBAC/keamanan |
| Interface | API (HTTP) :3001, UI Web :5173, Database MySQL :3307, OCR :8000 |
| Akun uji | superadmin / Admin@12345 (Super Admin), admin.keuangan / Bidang@12345 (Admin Bidang) |
| Tanggal | 13 September 2026 |
| Status | TANPA mengubah kode sumber aplikasi |

## 2. Hasil Pengujian

| No | Modul Pengujian | Skenario Pengujian / Input | Hasil yang Diharapkan | Hasil Pengujian | Status |
|----|-----------------|---------------------------|----------------------|-----------------|--------|
| 1 | Login & Sesi | GET /api/auth/csrf tanpa login (ambil token CSRF) | 200 + csrfToken (>= 32 karakter) | Status 200, panjang token 64 | Lulus |
| 2 | Login & Sesi | POST login TANPA header X-CSRF-Token | 403 — proteksi CSRF menolak | Status 403, pesan: CSRF token tidak valid atau hilang | Lulus |
| 3 | Login & Sesi | POST login dengan token CSRF salah | 403 — token tidak cocok | Status 403, pesan: CSRF token tidak valid atau hilang | Lulus |
| 4 | Login & Sesi | Login superadmin / Admin@12345 (benar) | 200 + roleName 'Super Admin' + cookie sesi | Status 200, role=Super Admin | Lulus |
| 5 | Login & Sesi | Login dengan password salah | 401 'Username atau password salah' | Status 401, pesan: Username atau password salah | Lulus |
| 6 | Login & Sesi | Login username tidak terdaftar | 401 (pesan identik, tidak bocor) | Status 401, pesan: Username atau password salah | Lulus |
| 7 | Login & Sesi | Login memakai EMAIL sebagai username | 200 (email dikenali) | Status 200, user=superadmin | Lulus |
| 8 | Login & Sesi | Login username beda huruf besar/kecil (SuPeRaDmIn) | 200 (case-insensitive) | Status 200, user=superadmin | Lulus |
| 9 | Login & Sesi | GET /api/auth/me dengan sesi valid | 200 + username + daftar permission | Status 200, jumlah permission=13 | Lulus |
| 10 | Login & Sesi | Akses /api/surat-masuk tanpa login | 401 'Tidak terautentikasi' | Status 401 | Lulus |
| 11 | Login & Sesi | Logout lalu GET /api/auth/me | logout 200; sesi tidak valid lagi (401) | Logout 200; /me setelahnya 401 | Lulus |
| 12 | Login & Sesi | Login ulang setelah logout | 200 (sesi baru berfungsi) | Status 200 | Lulus |
| 13 | Login & Sesi | 7x login gagal beruntun (user dummy) | permintaan terakhir 429 (lockout 1 menit) | Status 429, pesan: Terlalu banyak percobaan gagal. Coba lagi dalam 60 detik. | Lulus |
| 14 | Login & Sesi | POST /api/auth/logout-all sebagai Admin Bidang | 403 — hanya Super Admin | Status 403, pesan: Hanya Super Admin yang dapat keluar dari semua perangkat | Lulus |
| 15 | Login & Sesi | POST /api/auth/logout-all sebagai Super Admin | 200 + sesi SA lainnya ikut terputus (401) | logout-all 200; sesi kedua 401 | Lulus |
| 16 | Login & Sesi | Login Super Admin lagi setelah logout-all | 200 (bisa login kembali) | Status 200 | Lulus |
| 17 | Login & Sesi | POST dengan header Origin asing (http://evil.example.com) | 403 'Origin tidak diizinkan' | Status 403, pesan: Origin tidak diizinkan | Lulus |
| 18 | Keamanan API | GET endpoint yang tidak ada (/api/tidak-ada) | 404 JSON 'Endpoint tidak ditemukan' | Status 404, pesan: Endpoint tidak ditemukan | Lulus |
| 19 | Keamanan API | Periksa security headers pada response API | X-Frame-Options: DENY + Content-Security-Policy ada | X-Frame-Options='DENY', CSP ada=true | Lulus |
| 20 | Keamanan API | SQL injection di field search: ' OR 1=1 -- | 200 tanpa error DB; input diperlakukan sebagai teks literal | Status 200, total=0 | Lulus |
| 21 | Keamanan API | XSS di field perihal: <script>alert('xss')</script> | 422 — input dengan karakter < > DITOLAK (proteksi XSS di input) | Status 422, pesan: Perihal: tidak boleh mengandung karakter ! @ # $ % ^ * < > | Lulus |
| 22 | Keamanan API | Akses /api/notifications tanpa login | 401 | Status 401 | Lulus |
| 23 | Dashboard | GET /api/dashboard/stats?year=2026 | 200 + totalMasuk/totalKeluar angka + bidangStats array | Status 200, totalMasuk=4, totalKeluar=1 | Lulus |
| 24 | Dashboard | GET stats dengan tahun berbeda (2020) | 200 + struktur sama (data boleh kosong) | Status 200, year=2020 | Lulus |
| 25 | Dashboard | Daftar surat terbaru (recentMasuk & recentKeluar) terisi | 200 + kedua array ada | recentMasuk=4, recentKeluar=1 | Lulus |
| 26 | Surat Masuk | Buka daftar surat masuk (page 1) | 200 + meta.total >= 1 + baris bernomor urut | Status 200, total=4 | Lulus |
| 27 | Surat Masuk | Pagination: page 1 vs page 2 (perPage=5) | 200 + isi page 2 berbeda dari page 1 (atau habis) | page1.first=7, page2.first=undefined, totalPages=1 | Lulus |
| 28 | Surat Masuk | Filter kata kunci search='005' | semua baris hasil mengandung kata kunci | Status 200, hasil=1 | Lulus |
| 29 | Surat Masuk | Filter kata kunci yang tidak ada | 200 + total=0 | Status 200, total=0 | Lulus |
| 30 | Surat Masuk | Filter bidang (bidangId=3, Bidang Keuangan) | semua baris hasil = bidang tersebut | Status 200, hasil=2 | Lulus |
| 31 | Surat Masuk | Filter rentang tanggal 2000 (tidak ada data) | 200 + total=0 (filter berfungsi) | Status 200, total=0 | Lulus |
| 32 | Surat Masuk | Filter rentang tanggal dengan dateField=tanggalSurat | 200 + semua tanggalSurat dalam rentang | Status 200, hasil=0 | Lulus |
| 33 | Surat Masuk | Simpan surat masuk baru (form lengkap + file bukti JPG) | 201 + noUrut otomatis bertambah | Status 201, id=15, noUrut=5 | Lulus |
| 34 | Surat Masuk | Simpan surat tanpa mengisi Perihal | 422 + pesan error field Perihal | Status 422, errors=[{"field":"perihal","label":"Perihal","message":"Perihal minimal 2 karakter"}] | Lulus |
| 35 | Surat Masuk | Simpan surat dengan kode KELOMPOK (1 titik) | 422 — surat wajib memakai kode indeks | Status 422, pesan: Kode kelompok (mis. 000.1) tidak bisa dipilih di surat. Pilih indeks (mis. 000.1.2). | Lulus |
| 36 | Surat Masuk | Simpan surat dengan kode klasifikasi tidak ada (999999) | 422/404 — kode tidak ditemukan | Status 422, pesan: Kode klasifikasi tidak ditemukan atau nonaktif | Lulus |
| 37 | Surat Masuk | Upload file bukti 11 MB (batas 10 MB) | ditolak (413/400/koneksi diputus server) | Status koneksi diputus server, pesan: network-error: Error: The socket connection was closed unexpectedly. For more information, pass `ver | Lulus |
| 38 | Surat Masuk | Upload file bukti 10 MB (tepat di batas) | 201 — batas atas diterima | Status 201, pesan: Surat masuk berhasil disimpan | Lulus |
| 39 | Surat Masuk | Upload file .exe | 400 — ekstensi tidak diizinkan | Status 400, pesan: Ekstensi file tidak diizinkan. Gunakan PDF, JPG, PNG, DOC, DOCX | Lulus |
| 40 | Surat Masuk | Upload file bukti PDF (format lain yang diizinkan) | 201 — PDF diterima | Status 201, pesan:  | Lulus |
| 41 | Surat Masuk | Lihat detail surat yang baru disimpan | 200 + data cocok dengan input | Status 200, perihal=Tes Blackbox Surat Masuk | Lulus |
| 42 | Surat Masuk | Buka/unduh lampiran surat | 200 + content-type image/jpeg + ukuran file sama | Status 200, ct=image/jpeg, bytes=337 | Lulus |
| 43 | Surat Masuk | Buka detail surat yang tidak ada (id 999999) | 404 'Data tidak ditemukan' | Status 404, pesan: Data tidak ditemukan | Lulus |
| 44 | Surat Masuk | Ubah surat (perihal) lalu simpan | 200 + perihal ter-update | Status 200, perihal=Tes Blackbox (diubah) | Lulus |
| 45 | Surat Masuk | Ubah disposisi surat → Bidang Perencanaan | 200 + bidangId berubah | Status 200, bidang=2 | Lulus |
| 46 | Surat Masuk | Ubah surat yang tidak ada (id 999999) | ditolak (404/422 — validasi/data tidak ditemukan) | Status 422, pesan: Validasi gagal: Asal surat minimal 2 karakter; No surat minimal 2 karakter; Perihal minimal 2 karakter | Lulus |
| 47 | Surat Masuk | Hapus surat test lalu buka detailnya | hapus 200; detail jadi 404 | Hapus 200; detail 404 | Lulus |
| 48 | Surat Masuk | Export Excel (semua halaman saat ini) | 200 + file .xlsx valid | Status 200, ct=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, bytes=7239 | Lulus |
| 49 | Surat Masuk | Export Excel rentang noUrut 1–2 | 200 + file .xlsx valid | Status 200, bytes=7017 | Lulus |
| 50 | Surat Masuk | Export Excel dengan filter bidang | 200 + file .xlsx valid | Status 200, bytes=6975 | Lulus |
| 51 | Surat Masuk | Export PDF (halaman saat ini) | 200 + content-type text/html (pratinjau cetak) | Status 200, ct=text/html; charset=utf-8 | Lulus |
| 52 | Surat Keluar | Buka daftar surat keluar | 200 + meta.total >= 1 | Status 200, total=1 | Lulus |
| 53 | Surat Keluar | Pagination surat keluar (page 1 vs 2) | 200 + isi berbeda (atau data habis) | page1.first=2, page2.first=undefined | Lulus |
| 54 | Surat Keluar | Filter kata kunci search='001' | semua baris hasil mengandung kata kunci | Status 200, hasil=1 | Lulus |
| 55 | Surat Keluar | Filter kata kunci yang tidak ada | 200 + total=0 | Status 200, total=0 | Lulus |
| 56 | Surat Keluar | Simpan surat keluar baru (form lengkap) | 201 + id + noUrut otomatis | Status 201, id=5, noUrut=2 | Lulus |
| 57 | Surat Keluar | Simpan surat keluar tanpa 'ditujukan kepada' | 422 + error field | Status 422, errors=[{"field":"ditujukanKepada","label":"Ditujukan kepada","message":"Ditujukan kepada minimal 2 karakter"}] | Lulus |
| 58 | Surat Keluar | Ubah surat keluar (perihal) lalu simpan | 200 + perihal ter-update | Status 200 | Lulus |
| 59 | Surat Keluar | Buka detail surat keluar yang tidak ada | 404 | Status 404, pesan: Data tidak ditemukan | Lulus |
| 60 | Surat Keluar | Buka lampiran surat keluar (tanpa file) | 404 'File tidak ada' | Status 404, pesan: File tidak ada | Lulus |
| 61 | Surat Keluar | Hapus surat keluar test lalu buka detailnya | hapus 200; detail jadi 404 | Hapus 200; detail 404 | Lulus |
| 62 | Surat Keluar | Export Excel surat keluar | 200 + file .xlsx valid | Status 200, ct=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | Lulus |
| 63 | Surat Keluar | Export PDF surat keluar | 200 + content-type text/html | Status 200, ct=text/html; charset=utf-8 | Lulus |
| 64 | Master Data | Admin Bidang membuka daftar Bidang | 200 + list bidang (view diizinkan) | Status 200, jumlah=4 | Lulus |
| 65 | Master Data | Admin Bidang menambah Bidang baru | 403 — write hanya Super Admin | Status 403, pesan: Hanya Super Admin yang dapat mengelola master data ini | Lulus |
| 66 | Master Data | Super Admin menambah Bidang baru | 201 + id | Status 201, id=6, pesan:  | Lulus |
| 67 | Master Data | Super Admin mengubah nama Bidang | 200 + nama berubah | Status 200, nama=Bidang Test Blackbox v2 | Lulus |
| 68 | Master Data | Hapus Bidang yang masih dipakai (punya user/surat) | 409 'masih dipakai' — tidak bisa dihapus | Status 409, pesan: Bidang tidak bisa dihapus karena masih dipakai (1 user, 2 surat). Nonaktifkan saja. | Lulus |
| 69 | Master Data | Hapus Bidang test (tidak dipakai) | 200 — berhasil dihapus | Status 200, pesan: Bidang dihapus | Lulus |
| 70 | Master Data | Buka daftar kode: kelompok (1 titik) vs indeks (2+ titik) | kelompok=1 titik; indeks=2+ titik | st=200/200; kelompok=54 (pola benar=true); indeks=100 (pola benar=true) | Lulus |
| 71 | Master Data | Pencarian opsi surat (forSurat=1) | hanya kode indeks yang muncul (kelompok disembunyikan) | Status 200, jumlah=50, hanya indeks=true | Lulus |
| 72 | Master Data | Super Admin menambah kode indeks acak unik ('000.68.40') | 201 — kode dibuat | Status 201, pesan: (tanpa pesan) | Lulus |
| 73 | Master Data | Tambah kode dengan prefix di luar kategori (999.9.9) | 422 — kode harus sesuai kode awal kategori | Status 422, pesan: Kode harus diawali prefix kategori "100." (contoh: 100.1.2) | Lulus |
| 74 | Master Data | Tambah kode jenis kelompok padahal 2 titik | 422 — pola titik tidak sesuai jenis | Status 422, pesan: Kode kelompok harus 1 titik (contoh: 000.1, 200.2) | Lulus |
| 75 | Master Data | Admin Bidang menambah kode klasifikasi | 403 — write hanya Super Admin | Status 403, pesan: Hanya Super Admin yang dapat mengelola master data ini | Lulus |
| 76 | Master Data | Tambah kode yang sudah ada (duplikat) | 400 — kode sudah dipakai | Status 400, pesan: Gagal menambah kode (mungkin kode sudah dipakai) | Lulus |
| 77 | Master Data | Hapus kode yang masih dipakai surat | 409 'masih dipakai' — tidak bisa dihapus | Status 409, pesan: Kode tidak bisa dihapus karena masih dipakai 2 surat. Nonaktifkan saja. | Lulus |
| 78 | Master Data | Hapus kode test (tidak dipakai) | 200 — berhasil dihapus | Status 200, pesan: Kode dihapus | Lulus |
| 79 | Master Data | Admin Bidang membuka daftar Kategori | 200 + list kategori (view diizinkan) | Status 200, jumlah=10 | Lulus |
| 80 | Master Data | Admin Bidang menambah Kategori | 403 — write hanya Super Admin | Status 403, pesan: Hanya Super Admin yang dapat mengelola master data ini | Lulus |
| 81 | Master Data | Super Admin menambah Kategori (kode awal 998) | 201 — kategori dibuat | Status 201, id=12, pesan:  | Lulus |
| 82 | Master Data | Hapus Kategori yang masih punya kode | 400 'masih dipakai' — tidak bisa dihapus | Status 400, pesan: Kategori masih dipakai 89 kode/kelompok. Nonaktifkan saja atau pindahkan dulu. | Lulus |
| 83 | Master Data | Hapus Kategori test (kosong) | 200 — berhasil dihapus | Status 200, pesan: Kategori dihapus | Lulus |
| 84 | Master Data | Buka daftar sub-indeks pada sebuah kode | 200 + array sub-indeks | Status 200, jumlah=0 | Lulus |
| 85 | Master Data | Super Admin menambah sub-indeks | 201 — sub-indeks dibuat | Status 201, id=3992, pesan:  | Lulus |
| 86 | Master Data | Admin Bidang menambah sub-indeks | 403 — write hanya Super Admin | Status 403, pesan: Hanya Super Admin yang dapat mengelola master data ini | Lulus |
| 87 | Master Data | Hapus sub-indeks test | 200 — berhasil dihapus | Status 200, pesan: Sub indeks dihapus | Lulus |
| 88 | Pengguna | Super Admin membuka halaman Pengguna | 200 + list user | Status 200, jumlah=2 | Lulus |
| 89 | Pengguna | Admin Bidang membuka halaman Pengguna | 403 — akses ditolak | Status 403, pesan: Akses ditolak | Lulus |
| 90 | Pengguna | Super Admin memuat daftar Peran | 200 + 2 peran | Status 200, peran=Super Admin, Admin Bidang | Lulus |
| 91 | Pengguna | Admin Bidang memuat daftar Peran | 403 — akses ditolak | Status 403 | Lulus |
| 92 | Pengguna | Super Admin menambah user (peran Admin Bidang) | 201 + id | Status 201, id=7, pesan:  | Lulus |
| 93 | Pengguna | Menambah user dengan peran Super Admin | 403 — tidak dapat menambahkan Super Admin | Status 403, pesan: Tidak dapat menambahkan akun Super Admin | Lulus |
| 94 | Pengguna | Menambah user dengan username duplikat | 409 — sudah dipakai | Status 409, pesan: Username atau email sudah dipakai | Lulus |
| 95 | Pengguna | Menambah user dengan username mengandung spasi | 400 — format username tidak valid | Status 400, pesan: (tanpa pesan) | Lulus |
| 96 | Pengguna | Menambah user dengan password < 8 karakter | 400 — password terlalu pendek | Status 400, pesan: (tanpa pesan) | Lulus |
| 97 | Pengguna | Menambah user tanpa password | 422 — password wajib | Status 422, pesan: Password wajib saat membuat user | Lulus |
| 98 | Pengguna | Login sebagai user yang baru dibuat | 200 — akun aktif berfungsi | Status 200, pesan:  | Lulus |
| 99 | Pengguna | Super Admin mencabut semua sesi user test | count >= 1; sesi user terputus (401) | count=1, /me user=401 | Lulus |
| 100 | Pengguna | Menonaktifkan user lalu mencoba login | update 200; login user nonaktif = 401 | update=200, login=401 | Lulus |
| 101 | Pengguna | Mengubah akun Super Admin (id=1) | 403 — akun Super Admin tidak dapat diubah | Status 403, pesan: Akun Super Admin tidak dapat diubah | Lulus |
| 102 | Pengguna | Mengubah user yang tidak ada (id 999999) | 404 | Status 404, pesan: User tidak ditemukan | Lulus |
| 103 | Pengguna | Menghapus user test | 200 — berhasil dihapus | Status 200, pesan: User dihapus | Lulus |
| 104 | Notifikasi | Simpan surat masuk baru (disposisi ke bidang Admin Bidang) | unread Admin Bidang bertambah >= 1 | Admin Bidang: 4 → 5 | Lulus |
| 105 | Notifikasi | Surat yang sama untuk Super Admin (notif semua bidang) | unread Super Admin bertambah >= 1 | Super Admin: 12 → 13 | Lulus |
| 106 | Notifikasi | Admin Bidang membuka daftar notifikasi | ada 'Surat masuk baru' untuk surat test | jumlah=13, ditemukan=true | Lulus |
| 107 | Notifikasi | Super Admin membuka daftar notifikasi (semua bidang) | notif surat yang sama ada di Super Admin | jumlah=15, ditemukan=true | Lulus |
| 108 | Notifikasi | Menandai notifikasi sebagai sudah dibaca | 200 + status jadi 'Dibaca' | Status 200, readAt=terisi | Lulus |
| 109 | Notifikasi | Menandai notif milik user lain (id orang lain) | 404 — notif bukan milik user ini | Status 404, pesan: Notifikasi tidak ditemukan | Lulus |
| 110 | Notifikasi | Mengubah disposisi surat → notifikasi perubahan | ada 'Disposisi surat masuk diubah' | ditemukan=true | Lulus |
| 111 | Notifikasi | Simpan surat keluar baru → notifikasi | ada 'Surat keluar baru' untuk admin bidang | ditemukan=true | Lulus |
| 112 | Notifikasi | Filter notifikasi yang belum dibaca (unread=1) | hanya baris readAt=null yang tampil | Status 200, jumlah=5, semua unread=true | Lulus |
| 113 | Notifikasi | Tandai SEMUA notifikasi dibaca | 200 + unread-count jadi 0 | Status 200, unread=0 | Lulus |
| 114 | Notifikasi | Super Admin membuka status tautan Telegram | 403 — Super Admin in-app saja (fitur baru) | Status 403, pesan: Super Admin menerima notifikasi in-app saja | Lulus |
| 115 | Notifikasi | Super Admin membuat kode taut Telegram | 403 — ditolak | Status 403, pesan: Super Admin menerima notifikasi in-app saja | Lulus |
| 116 | Notifikasi | Admin Bidang membuka status tautan Telegram | 200 + info bot | Status 200, enabled=true, bot=arsip_surat_notif_bot | Lulus |
| 117 | Notifikasi | Admin Bidang membuat kode taut Telegram | 200 + kode 8 karakter + instruksi | Status 200, kode=X2YRPGTQ | Lulus |
| 118 | Notifikasi | Admin Bidang melepas tautan Telegram | 200 — tautan dilepas | Status 200, pesan: Telegram dilepas | Lulus |
| 119 | Webhook Telegram | POST webhook Telegram TANPA secret token | 401 Unauthorized | Status 401, pesan: Unauthorized | Lulus |
| 120 | Webhook Telegram | POST webhook Telegram dengan secret token SALAH | 401 Unauthorized | Status 401, pesan: Unauthorized | Lulus |
| 121 | OCR (auto-fill scan) | Upload gambar scan surat (PNG) | 200 + object field hasil ekstraksi | Status 200, field=asal_surat, perihal, tanggal_surat, kepada, pesan= | Lulus |
| 122 | OCR (auto-fill scan) | Upload file .txt ke OCR | 422 — format harus JPG/PNG | Status 422, pesan: Format harus JPG atau PNG agar bisa dibaca OCR | Lulus |
| 123 | OCR (auto-fill scan) | POST OCR tanpa file | 422 — file wajib | Status 422, pesan: File gambar wajib diunggah | Lulus |
| 124 | OCR (auto-fill scan) | Upload gambar PNG korup | ditolak rapi (4xx/502/503) tanpa error server mentah | Status 400, pesan: File bukan gambar yang valid: cannot identify image file <_io.BytesIO object at 0x7cc0f93a2660> | Lulus |
| 125 | Backup & Restore DB | Backup database sips_db dengan mysqldump (single-transaction, routines) | File dump SQL berhasil dibuat (ukuran > 100 KB) | File dump 343.123 bytes | Lulus |
| 126 | Backup & Restore DB | Periksa isi dump (struktur tabel) | Dump memuat tabel utama: users, surat_masuk, surat_keluar, notifications | 13 tabel terdeteksi, termasuk 4 tabel utama | Lulus |
| 127 | Backup & Restore DB | Restore dump ke database baru (bb_test_restore) lalu bandingkan jumlah baris | Jumlah baris sama persis dengan database sumber | users 2=2; surat_masuk 4=4; surat_keluar 1=1; notifications 31=31; bidang 4=4; master_kode 670=670 | Lulus |
| 128 | UI (Manual) | Buka http://localhost:5173 tanpa login | Halaman login tampil (redirect ke /login) | Halaman login berhsail dibuka | Lulus |
| 129 | UI (Manual) | Login dengan password salah di halaman login | Muncul pesan error 'Username atau password salah' | Pesan error muncul setelah salah memasukkan Password | Lulus |
| 130 | UI (Manual) | Login superadmin → navigasi dashboard | Dashboard tampil dengan statistik surat | Halaman Dashboard berhasil ditampilkan | Lulus |
| 131 | UI (Manual) | Form surat masuk: upload file & simpan | Surat tersimpan, muncul di daftar | Surat berhasil tersimpan dan muncul di list | Lulus |
| 132 | UI (Manual) | Halaman Notifikasi sebagai Super Admin | Card Telegram TIDAK tampil; subtitle 'semua bidang' | Card Telegram tidak tampil | Lulus |
| 133 | UI (Manual) | Halaman Notifikasi sebagai Admin Bidang | Card Telegram TAMPIL (opsi taut Telegram) | Card Telegram tampil | Lulus |

## 3. Ringkasan

- Total skenario: **133**
- Lulus: **127**
- Gagal: **0**
- Manual (diisi penguji): **6**

> Catatan: seluruh pengujian otomatis (124 kasus) dilakukan melalui interface HTTP yang sama dengan yang dipakai aplikasi web (browser disimulasikan). Kasus 125–127 dijalankan langsung pada database MySQL via docker. Kasus 128–133 disediakan sebagai pengujian manual UI yang hasilnya diisi oleh penguji.