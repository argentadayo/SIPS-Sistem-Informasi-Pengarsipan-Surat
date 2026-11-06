# Arsitektur Sistem — Arsip Surat

Dokumentasi arsitektur **Sistem Arsip Surat Masuk & Surat Keluar**: monorepo, alur request, domain model, auth/RBAC, storage file, Docker, keamanan, dan batasan production VPS.

> Sumber kebenaran implementasi: kode di repositori ini.  
> Panduan running/deploy: lihat [README.md](../README.md).

---

## Daftar isi

1. [Ringkasan](#1-ringkasan)
2. [Tujuan sistem](#2-tujuan-sistem)
3. [Tech stack](#3-tech-stack)
4. [Struktur monorepo](#4-struktur-monorepo)
5. [Topology & alur request](#5-topology--alur-request)
6. [Arsitektur frontend](#6-arsitektur-frontend)
7. [Arsitektur backend (API)](#7-arsitektur-backend-api)
8. [Shared package `@arsip/shared`](#8-shared-package-arsipshared)
9. [Domain model & database](#9-domain-model--database)
10. [Auth, session & RBAC](#10-auth-session--rbac)
11. [Storage file (foto/PDF surat)](#11-storage-file-fotopdf-surat)
12. [Notifikasi & Telegram](#12-notifikasi--telegram)
13. [Export & filter](#13-export--filter)
14. [Docker & volume](#14-docker--volume)
15. [Keamanan](#15-keamanan)
16. [Environment variables](#16-environment-variables)
17. [Keputusan arsitektur](#17-keputusan-arsitektur)
18. [Batasan & residual](#18-batasan--residual)
19. [Diagram ringkas](#19-diagram-ringkas)

---

## 1. Ringkasan

| Aspek | Pilihan |
|--------|---------|
| Gaya | Monorepo Bun workspaces |
| FE | SPA React (Vite) di belakang Nginx |
| BE | API monolit Hono di Bun |
| DB | MySQL 8.4 LTS + Prisma ORM |
| Auth | Session server-side (cookie `httpOnly`) + CSRF + lockout |
| Otorisasi | RBAC role–permission; master write Super Admin only |
| File arsip | Disk / Docker volume (bukan BLOB DB) |
| Export | Excel/PDF, hard cap **1000** baris, scope page/all/range |
| Deploy | Docker Compose (1 VPS) |
| Notifikasi | In-app + opsional Telegram bot |

Sistem dirancang untuk **arsip internal instansi** pada **satu VPS kecil (1–2 GB RAM)**: sederhana dioperasikan, stateful (DB + file), tanpa microservices berlebih.

> ⚠️ Jika service OCR diaktifkan (stack SIPS), budget RAM naik: LayoutLMv3 + PaddleOCR CPU butuh ~1,5–2 GB sendiri. VPS 1–2 GB tidak cukup untuk full stack + OCR — minimal 4 GB, atau jalankan OCR di host/service terpisah.

---

## 2. Tujuan sistem

- Mencatat **surat masuk** (asal, disposisi ke bidang, klasifikasi, file bukti).
- Mencatat **surat keluar** (tujuan, pembuat bidang, klasifikasi, file bukti).
- Master data: **bidang**, **kode klasifikasi** (kategori → kode → sub indeks).
- **Filter**, **export Excel/PDF**, **audit** aktivitas.
- **Notifikasi** ke admin bidang (in-app ± Telegram).
- **RBAC**: Super Admin vs Admin Bidang.

Bukan: email server, workflow multi-approval kompleks. OCR opsional — service terpisah untuk auto-fill form surat (lihat §5.4).

---

## 3. Tech stack

| Layer | Teknologi | Catatan |
|--------|-----------|---------|
| Runtime / PM | **Bun** | API runtime + monorepo scripts |
| Backend | **Hono** + **Zod** | HTTP API, validasi |
| ORM | **Prisma 6** | Schema & migrate MySQL |
| Frontend | **React 19**, **Vite 6**, **Tailwind CSS 4** | SPA |
| Router FE | **react-router-dom 7** | Client routes |
| Database | **MySQL 8.4 LTS** | utf8mb4 |
| Shared | **`@arsip/shared`** | Labels, permissions, types |
| Export | **ExcelJS**, **pdf-lib** | Excel + HTML/PDF print |
| Notifikasi | Tabel `notifications` + Bot API Telegram | Opsional |
| OCR (opsional) | PaddleOCR + LayoutLMv3 (Python, `ocr/`) | Auto-fill form surat via `POST /api/ocr/predict` |
| Proxy/static | **Nginx** | Entry publik Docker |
| Deploy | **Docker Compose** | mysql + api + web |

---

## 4. Struktur monorepo

```text
arsip-surat/
├── apps/
│   ├── api/                 # Hono + Bun + Prisma          → :3001 (internal)
│   │   ├── prisma/          # schema, migrations, seed
│   │   ├── src/
│   │   │   ├── index.ts     # bootstrap app + middleware
│   │   │   ├── routes/      # HTTP handlers per domain
│   │   │   ├── services/    # business logic
│   │   │   ├── middleware/  # auth, rate-limit, security
│   │   │   ├── validators/  # Zod schemas
│   │   │   ├── lib/         # env, db, crypto, logger
│   │   │   └── types/
│   │   └── Dockerfile
│   └── web/                 # React + Vite                 → :5173 (dev) / Nginx :80 (prod)
│       ├── src/
│       │   ├── pages/       # halaman per route
│       │   ├── components/  # layout, filter, UI
│       │   └── lib/         # api client, auth, toast
│       └── Dockerfile
├── packages/
│   └── shared/              # @arsip/shared
├── ocr/                     # OCR service (Python, opsional — stack SIPS)
│   ├── predict.py           # CLI prediksi + logika OCR/decode BIO
│   ├── serve.py             # HTTP service (FastAPI) untuk Docker
│   ├── requirements.txt
│   └── Dockerfile           # torch CPU build; model TIDAK ikut image
├── layoutlmv3-bio-model/    # model ML (~481 MB, tidak di-git; di VPS: /opt/arsip/models)
├── docker/
│   ├── mysql/               # init SQL, my.cnf
│   └── nginx/               # default.conf (SPA + /api proxy)
├── storage/
│   ├── uploads/             # file surat (dev host)
│   └── temp/
├── docs/
│   └── ARCHITECTURE.md      # dokumen ini
├── docker-compose.sips.yml  # stack: mysql-sips + api + web + ocr
├── .env.example
└── package.json             # workspaces + scripts
```

**Workspaces** (root `package.json`): `apps/*`, `packages/*`.

**OCR**: service terpisah `ocr/` (Python, PaddleOCR + LayoutLMv3) — diintegrasikan ke app lewat proxy `POST /api/ocr/predict` (`routes/ocr.ts`) + tombol "Isi otomatis dari scan" di form surat. Service `ocr` didefinisikan di `docker-compose.sips.yml`; jika `OCR_SERVICE_URL` kosong (mis. API dev tanpa OCR) → endpoint balas 503. Model di-bind-mount dari host, tidak ikut image.

---

## 5. Topology & alur request

### 5.1 Production (Docker Compose)

```text
Internet
    │
    ▼
[ web :80 Nginx ]
    │  /            → static React (SPA)
    │  /api/*       → proxy_pass http://api:3001
    │  /health      → proxy ke API
    ▼
[ api :3001 Bun/Hono ] ──► [ mysql-sips :3306 ]
      │   └─(OCR_SERVICE_URL)──► [ ocr :8000 Python ]
      ├── volume upload_data  → /app/storage/uploads
      └── volume temp_data    → /app/storage/temp

[ ocr :8000 Python ] (internal; model di-bind-mount host → /models:ro, ~481 MB, tidak ikut image)
```

- **Hanya Nginx** yang dipublikasikan ke host (`WEB_PORT`, default 80).
- API **tidak** di-expose ke host (port di-comment di compose).
- MySQL di-map ke `127.0.0.1:3307` (hanya untuk tools di host, tidak expose ke publik).

### 5.2 Development (host)

```text
Browser → Vite :5173  (proxy /api → localhost:3001)
                ↓
         API Bun :3001 → MySQL (Docker dev / local)
                ↓
         storage/uploads (path relatif monorepo)
```

### 5.3 Alur unggah file surat

1. Browser: `multipart/form-data` → `POST /api/surat-masuk` atau `POST /api/surat-keluar`.
2. Nginx: `client_max_body_size` (~12m).
3. API: `processUpload()` (`apps/api/src/services/file.service.ts`):
   - cek ukuran, ekstensi, **magic bytes**;
   - rename ke **UUID + ekstensi aman**;
   - tulis ke `UPLOAD_DIR`;
   - PDF: kompresi ringan via pdf-lib (best-effort).
4. DB: simpan `file_path`, `file_original_name`, `file_mime`, `file_size` (bukan isi file).
5. Unduh/pratinjau: `GET /api/surat-masuk/:id/file` atau `/api/surat-keluar/:id/file` (butuh auth + permission view).

### 5.4 Alur OCR auto-fill (opsional)

1. Browser: form surat masuk/keluar → pilih file JPG/PNG → tombol **✨ Isi otomatis dari scan**.
2. API: `POST /api/ocr/predict` (`routes/ocr.ts`) — auth + permission create surat + rate limit upload + magic bytes (JPG/PNG), forward multipart ke `OCR_SERVICE_URL/predict` (timeout 60 s). `OCR_SERVICE_URL` kosong → **503** (fitur mati).
3. Service OCR (`ocr/serve.py`): PaddleOCR baca teks + posisi → LayoutLMv3 BIO → `fields` (`asal_surat`, `nomor`, `tanggal_surat`, `kepada`, `perihal`).
4. FE mengisi field yang dikenali (tidak menimpa yang sudah terisi); tanggal bebas di-parse `lib/ocr-date.ts` → `YYYY-MM-DD` (null kalau tidak valid — field tanggal tidak diisi).

---

## 6. Arsitektur frontend

| Path | File | Keterangan |
|------|------|------------|
| `/login` | `LoginPage.tsx` | Publik |
| `/` | `DashboardPage.tsx` | Ringkasan arsip |
| `/surat-masuk` | `SuratMasukPage.tsx` | CRUD + filter + export/print + upload |
| `/surat-keluar` | `SuratKeluarPage.tsx` | Sama pola |
| `/master` | `MasterPage.tsx` | Bidang, kode, sub indeks (write: Super Admin) |
| `/users` | `UsersPage.tsx` | User + cabut sesi |
| `/notifications` | `NotificationsPage.tsx` | Notif + taut Telegram |
| `*` | redirect `/` | |

**Komponen penting:**

| Komponen | Fungsi |
|----------|--------|
| `Layout.tsx` | Sidebar, navigasi, logout (+ logout-all Super Admin) |
| `AdvancedFilters.tsx` | Search, rentang tanggal, kode/indeks/bidang |
| `NotificationBell.tsx` | Badge unread |
| `PrintConfigModal.tsx` | Scope cetak (halaman / semua / range no urut) |
| `ExportConfigModal.tsx` | Scope ekspor Excel (sama pola print) |
| `ui.tsx` | Input, Button, FileDropzone, Select, dll. |

**State auth FE:** `lib/auth.tsx` (user + permissions dari `GET /api/auth/me`; `logout` / `logoutAll`).  
**HTTP client:** `lib/api.ts` — `credentials: "include"`, CSRF header, base `/api` (atau `VITE_API_URL`).

Router: `apps/web/src/App.tsx`.

---

## 7. Arsitektur backend (API)

### 7.1 Bootstrap

`apps/api/src/index.ts`:

1. Middleware global: `requestId`, security headers, CORS (`WEB_URL`), rate limit, origin check, session.
2. Route groups di-mount.
3. `ensureDirs()` untuk upload/temp.
4. Interval purge session expired (~30 menit).

### 7.2 Lapisan

```text
routes/        → HTTP, permission, validasi Zod, mapping response
services/      → logika bisnis, side-effect (file, notif, telegram, audit, export)
middleware/    → auth, csrf, rate-limit, security
validators/    → schema Zod bersama (pagination, surat, export, dates)
lib/           → env, db, crypto, logger, session-cache, login-lockout
```

### 7.3 Services

| Service | Peran |
|---------|--------|
| `auth.service.ts` | Login/logout, lockout, buat session, `revokeAllSessions`, purge expired |
| `file.service.ts` | Validasi & simpan upload, path aman |
| `export.service.ts` | Excel + HTML PDF export (label dari shared) |
| `notification.service.ts` | Buat notif in-app + push Telegram |
| `telegram.service.ts` | Bot API, link code, webhook commands |
| `audit.service.ts` | Tulis `audit_logs` |

### 7.4 Route groups

| Prefix | File | Endpoint utama |
|--------|------|----------------|
| `GET /health` | `index.ts` | Health (tanpa auth) |
| `/api/auth` | `auth.ts` | `GET /csrf`, `POST /login`, `POST /logout`, `POST /logout-all`, `GET /me` |
| `/api/dashboard` | `dashboard.ts` | `GET /stats` |
| `/api/surat-masuk` | `surat-masuk.ts` | CRUD, export excel/pdf (scope), `GET /:id/file` |
| `/api/surat-keluar` | `surat-keluar.ts` | Pola sama |
| `/api/master` | `master.ts` | Bidang, kategori, kode, indeks, users, roles, revoke-sessions |
| `/api/notifications` | `notifications.ts` | List, read, telegram status/link/unlink |
| `/api/telegram` | `telegram.ts` | `POST /webhook` (tanpa session cookie; exempt CSRF) |
| `/api/ocr` | `ocr.ts` | `POST /predict` — proxy ke service OCR (auth + permission surat; `OCR_SERVICE_URL` kosong → 503) |

**Urutan route penting:** export (`/export/*`) didefinisikan **sebelum** `/:id` agar tidak tertangkap param.

---

## 8. Shared package `@arsip/shared`

Path: `packages/shared/src/`.

| Modul | Isi |
|-------|-----|
| `labels.ts` | Label UI/Excel/PDF (`LABELS.suratMasuk` / `suratKeluar`) — **sumber tunggal** |
| `permissions.ts` | `PERMISSIONS`, `ROLES` |
| `types.ts` | `AuthUserPublic`, envelope API, pagination meta |
| `index.ts` | Re-export |

**Prinsip:** mengubah label kolom cukup di shared agar form, tabel, Excel, dan PDF konsisten.

---

## 9. Domain model & database

Schema: `apps/api/prisma/schema.prisma`.

### 9.1 ER ringkas

```text
Role 1──* User *──1 Bidang (opsional)
Role *──* Permission  (role_has_permissions)

MasterKategori 1──* MasterKode 1──* MasterIndeks

MasterKode 1──* SuratMasuk / SuratKeluar
MasterIndeks 0..1──* SuratMasuk / SuratKeluar
Bidang 1──* SuratMasuk / SuratKeluar

User 1──* Session
User 1──* Notification
User 1──* AuditLog
```

### 9.2 Tabel utama

| Model | Tabel | Fungsi |
|-------|--------|--------|
| `Role` / `Permission` / `RolePermission` | `roles`, `permissions`, `role_has_permissions` | RBAC |
| `Bidang` | `bidang` | Unit organisasi / disposisi / pembuat |
| `User` | `users` | Akun + role + bidang + field Telegram |
| `Session` | `sessions` | Session cookie |
| `Notification` | `notifications` | Notif in-app |
| `MasterKategori` | `master_kategori` | Kelompok kode awal |
| `MasterKode` | `master_kode` | **Kode klasifikasi** (`kode` + `namaKelompok`) |
| `MasterIndeks` | `master_indeks` | **Sub indeks** di bawah kode |
| `SuratMasuk` | `surat_masuk` | Arsip masuk + meta file |
| `SuratKeluar` | `surat_keluar` | Arsip keluar + meta file |
| `AuditLog` | `audit_logs` | Jejak aksi |

### 9.3 Hierarki klasifikasi

```text
Kategori (master_kategori)
  └── Kode Klasifikasi (master_kode)     ← wajib di surat
        └── Sub Indeks (master_indeks)  ← opsional di surat
```

- Surat menyimpan `kode_id` (wajib) dan `indeks_id` (nullable).
- Label UI: **Kode Klasifikasi** / **Sub Indeks** (`LABELS`).

### 9.4 Surat masuk vs keluar

| | Surat Masuk | Surat Keluar |
|--|-------------|--------------|
| Pihak | `asalSurat` | `ditujukanKepada` |
| Bidang | Disposisi | Pembuat surat |
| Tanggal khusus | `tanggalMasukSurat`, `tanggalDisposisi?` | `tanggalSurat` |
| No urut | `noUrut` unik per tabel | sama |

---

## 10. Auth, session & RBAC

### 10.1 Login & session

| Aspek | Perilaku |
|--------|----------|
| Cookie | `COOKIE_NAME` (default `arsip_session`), `httpOnly`, `SameSite=Lax`, `Secure` jika `COOKIE_SECURE` |
| Token | Random; **hanya hash SHA-256** disimpan di DB |
| Password | bcrypt (`Bun.password`, cost 12) |
| TTL | `SESSION_TTL_HOURS` (default 8) |
| Login | Anti user-enumeration (dummy hash jika user tidak ada) |
| CSRF | Cookie `{COOKIE_NAME}_csrf` (bisa dibaca JS) + header `X-CSRF-Token` pada POST/PUT/DELETE |
| Session cache | In-memory ~**45s** (`lib/session-cache.ts`) — kurangi query user+role+permission tiap request |
| Login lockout | **7 gagal dalam 1 menit** per username → kunci **1 menit** (`lib/login-lockout.ts`); HTTP 429 + `Retry-After` |
| Rate limit login | Per IP (terpisah dari lockout akun) — `loginRateLimit` |

File: `middleware/auth.ts`, `middleware/csrf.ts`, `services/auth.service.ts`, `lib/crypto.ts`, `lib/session-cache.ts`, `lib/login-lockout.ts`.

**Alur CSRF (double-submit):**

1. `GET /api/auth/csrf` atau middleware memastikan cookie CSRF.
2. FE menyimpan token di memori (`api.ts`) dan mengirim header `X-CSRF-Token` pada request mutating.
3. API membandingkan header dengan cookie (timing-safe); mismatch → 403.
4. Login/logout merotasi token CSRF.
5. Exempt: `/api/telegram/*` (webhook eksternal).

**Logout / revoke session:**

| Endpoint | Siapa | Efek |
|----------|--------|------|
| `POST /api/auth/logout` | User login | Hapus session perangkat ini + invalidate cache |
| `POST /api/auth/logout-all` | **Super Admin** saja | Hapus **semua** session akun sendiri |
| `POST /api/master/users/:id/revoke-sessions` | `user.manage` | Cabut semua session user target (UI: tombol di halaman Pengguna) |

Otomatis cabut session user jika admin: ganti password, nonaktifkan user, atau ubah role.

### 10.2 Middleware otorisasi

| Helper | Fungsi |
|--------|--------|
| `sessionMiddleware` | Global: load user dari cookie (cache dulu, fallback DB) |
| `requireAuth` | Wajib login |
| `requirePermission(...perms)` | Cek permission; **Super Admin bypass** |
| `requireSuperAdmin` | CRUD bidang, kategori, kode, sub indeks |
| `bidangScope()` | Filter data per `bidangId` (jika dipakai) |

### 10.3 Role & permission

**Roles** (`ROLES`):

| Role | Cakupan (seed) |
|------|----------------|
| **Super Admin** | Semua permission + write master + logout-all header |
| **Admin Bidang** | Semua kecuali `user.manage`; **master data read-only** (API write diblok `requireSuperAdmin`) |

**Permissions** (`PERMISSIONS`):

```text
surat-masuk.view | create | update | delete | export
surat-keluar.view | create | update | delete | export
master.manage          # akses halaman master (lihat); write tetap Super Admin
user.manage
dashboard.view
```

| Resource master | Lihat | Tambah / ubah / hapus |
|-----------------|-------|------------------------|
| Bidang | Semua role ber-auth + perm | Super Admin |
| Kode klasifikasi / sub indeks / kategori | Semua role ber-auth + perm | Super Admin |

Seed default akun (ganti segera di production): lihat README.

---

## 11. Storage file (foto/PDF surat)

### 11.1 Prinsip

| Simpan di | Isi |
|-----------|-----|
| **Disk / Docker volume** | Binary file (PDF, JPG, PNG, DOC, DOCX) |
| **MySQL** | Metadata path + nama asli + mime + size |

**Bukan best practice di sini:** menyimpan BLOB file di MySQL.

### 11.2 Path

| Konteks | Lokasi |
|---------|--------|
| Dev monorepo | `storage/uploads`, `storage/temp` |
| API env dev | `UPLOAD_DIR=../../storage/uploads` |
| Docker | `/app/storage/uploads` ← volume `arsip_upload_data` |
| Nama di disk | `{uuid}.{ext}` (bukan nama user) |
| Di DB | `file_path` = nama file tersimpan |

### 11.3 Validasi upload

- Ekstensi allowlist + **magic bytes**.
- Max size: `MAX_FILE_SIZE_MB` (default 10).
- Path traversal dicegah di `getUploadAbsolutePath()`.
- Akses file **hanya** lewat API ber-auth (bukan static public URL).

### 11.4 Production VPS

Untuk **satu VPS**, Docker volume `upload_data` adalah **best practice yang tepat**:

- Persist lewat rebuild container.
- Backup: volume MySQL **dan** volume uploads.
- Naik ke S3/MinIO hanya jika multi-server / skala sangat besar.

---

## 12. Notifikasi & Telegram

### 12.1 In-app

- Tabel `notifications` per user.
- Trigger: surat masuk/keluar baru, perubahan disposisi (lihat `notification.service.ts`).
- UI: lonceng + halaman `/notifications`.

### 12.2 Telegram (opsional)

| Komponen | Fungsi |
|----------|--------|
| Env | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` |
| Link akun | User buat kode di app → bot `/link KODE` |
| Webhook | `POST /api/telegram/webhook` (secret header opsional) |
| Commands | `/start`, `/link`, `/unlink` (`telegram.service.ts`) |

Dev lokal butuh tunnel (ngrok) ke API — panduan di README.  
Production: webhook ke `https://domain/api/telegram/webhook`.

---

## 13. Export & filter

### 13.1 Filter surat

`AdvancedFilters` + query API:

- `search` (nomor, perihal, asal/tujuan)
- Rentang tanggal: `dari`, `sampai`, `dateField` (masuk: tanggal masuk / surat / disposisi)
- Preset: hari ini, minggu ini (Senin–Minggu), bulan ini (1–akhir bulan), custom
- `kodeId`, `indeksId`, `bidangId`, party (`asalSurat` / `ditujukanKepada`)

Backend: filter tanggal inklusif (`gte` start + `lt` hari setelah `sampai`).

### 13.2 Export (Excel & Print)

Pola **sama** untuk Excel dan print PDF (query `exportPrintQuery`):

| Scope | Arti |
|-------|------|
| `page` | Hanya baris di halaman tabel saat ini |
| `all` | Semua hasil filter aktif, **maks `EXPORT_MAX_ROWS` (1000)** |
| `range` | Filter + rentang `noUrutFrom` / `noUrutTo` |

- Excel: `GET .../export/excel?...` — UI: `ExportConfigModal`
- Print/PDF HTML: `GET .../export/pdf?...` — UI: `PrintConfigModal`
- Hard cap: `EXPORT_MAX_ROWS = 1000` (`validators/common.ts`) — aman untuk VPS kecil
- Filter advanced (tanggal, kode, bidang, search) **tetap** diterapkan
- Label kolom dari `@arsip/shared` `LABELS`

---

## 14. Docker & volume

### 14.1 Services (`docker-compose.sips.yml`, project `arsip-sips`)

| Service | Image/build | Port host | Peran |
|---------|-------------|-----------|--------|
| `mysql-sips` | `mysql:8.4` | `127.0.0.1:3307` | DB `sips_db` (volume `sips_mysql_data`) |
| `api` | `apps/api/Dockerfile` | — | API Bun (`OCR_SERVICE_URL=http://ocr:8000`) |
| `web` | `apps/web/Dockerfile` | `WEB_PORT` (default 80) | Nginx + SPA |
| `ocr` | `ocr/Dockerfile` | `127.0.0.1:8000` | PaddleOCR + LayoutLMv3 (model bind-mount `./layoutlmv3-bio-model` → `/models:ro`) |

Network: default `arsip-sips_default` (bridge). API di-wire `OCR_SERVICE_URL=http://ocr:8000` → fitur auto-fill aktif. Volume: `sips_mysql_data`, `sips_upload_data`, `sips_temp_data`.

### 14.2 Volumes

| Volume | Mount | Isi |
|--------|--------|-----|
| `sips_mysql_data` | MySQL data dir | Database |
| `sips_upload_data` | `/app/storage/uploads` | **File surat** |
| `sips_temp_data` | `/app/storage/temp` | Temp |

### 14.3 Lifecycle API container

Entrypoint tipikal: migrate Prisma (`migrate deploy` / fallback) lalu jalankan bundle API.

### 14.4 Perintah umum

```bash
docker compose -f docker-compose.sips.yml up -d --build
docker compose -f docker-compose.sips.yml exec api bun run prisma/seed.ts
docker compose -f docker-compose.sips.yml logs -f api
docker compose -f docker-compose.sips.yml down
```

---

## 15. Keamanan

| Kontrol | Implementasi |
|---------|----------------|
| Session | Cookie `httpOnly` + hash token di DB |
| Password | bcrypt |
| RBAC | Permission per endpoint |
| Validasi input | Zod |
| Upload | Magic bytes, UUID rename, path strip |
| OCR | Proxy via API (auth + permission + rate limit); hanya JPG/PNG (magic bytes); service internal |
| Rate limit | Global, login, upload (in-memory) |
| CORS | Hanya `WEB_URL` |
| Origin check | Method mutating (production ketat) |
| CSRF | Double-submit: cookie `*_csrf` + header `X-CSRF-Token` |
| Session cache | In-memory TTL ~45s (user + permissions) |
| Login lockout | 7 gagal / 1 menit per username → kunci 1 menit |
| Logout all | Super Admin sendiri: `POST /api/auth/logout-all`; Admin cabut user: `POST /api/master/users/:id/revoke-sessions` |
| Headers | Security headers API + CSP Nginx SPA |
| Telegram webhook | Optional secret token header |
| Container | Non-root API, `no-new-privileges` |
| Error | Pesan generik di production |

**Checklist harden VPS:**

1. Password MySQL & `SESSION_SECRET` kuat  
2. `COOKIE_SECURE=true` + HTTPS  
3. Jangan expose MySQL ke internet  
4. Firewall: 22 (SSH), 80/443  
5. Backup `mysql_data` + `upload_data`  
6. Ganti akun seed default  

---

## 16. Environment variables

### 16.1 Satu file: root `.env` (dari `.env.example`)

Dipakai **Docker Compose** dan **API/Prisma lokal** (`bun --env-file=../../.env`). Tidak ada `apps/api/.env`.

| Variabel | Peran |
|----------|--------|
| `SIPS_MYSQL_ROOT_PASSWORD` (wajib), `SIPS_MYSQL_PASSWORD` (wajib), `SIPS_MYSQL_USER`, `SIPS_MYSQL_DATABASE` | Bootstrap MySQL (Compose) |
| `DATABASE_URL` | Prisma + API dev (host). Docker: override di compose |
| `SESSION_SECRET` | Wajib ≥ 32 karakter |
| `SESSION_TTL_HOURS`, `COOKIE_NAME`, `COOKIE_SECURE` | Session/cookie |
| `WEB_URL`, `APP_URL`, `PORT` | CORS, origin, port API |
| `NODE_ENV` | `production` / `development` |
| `MAX_FILE_SIZE_MB`, `UPLOAD_DIR`, `TEMP_DIR` | Upload (dev path relatif `apps/api`) |
| `RATE_LIMIT_*` | Rate limiting |
| `TELEGRAM_*` | Bot opsional |
| `OCR_SERVICE_URL` | Proxy OCR API (`http://ocr:8000` di stack SIPS; kosong = fitur OCR mati → 503) |
| `OCR_PORT`, `OCR_LANG`, `OCR_MAX_IMAGE_BYTES` | Service OCR (stack SIPS) |
| `SIPS_APP_URL`, `SIPS_WEB_URL` | URL publik APP/WEB (stack SIPS) |
| `WEB_PORT`, `SIPS_MYSQL_PORT`, `OCR_PORT` | Port host (mysql/ocr bind localhost) |

### 16.2 Validasi API (`apps/api/src/lib/env.ts`)

Divalidasi Zod saat start. Compose mengisi `DATABASE_URL` dari kredensial MySQL internal:

```text
mysql://USER:PASSWORD@mysql-sips:3306/DATABASE
```

Docker: `UPLOAD_DIR=/app/storage/uploads`, `TEMP_DIR=/app/storage/temp` (hardcode di compose, bukan dari root path dev).

---

## 17. Keputusan arsitektur

| Keputusan | Alasan |
|-----------|--------|
| Monorepo + shared labels/permissions | Konsistensi FE/BE/export |
| SPA + API monolit | Operasi VPS sederhana |
| Session cookie (bukan JWT murni FE) | Revoke server-side, cocok internal app |
| Session cache + lockout in-memory | Performa & brute-force pada single VPS |
| Master write Super Admin only | Cegah Admin Bidang mengubah klasifikasi/bidang |
| Export max 1000 + scope UI | Lindungi RAM VPS; user pilih data mana |
| File di volume, meta di DB | Performa DB & backup terpisah |
| Docker Compose 4 service (mysql, api, web, ocr) | Cukup untuk 1 VPS tanpa orchestrator |
| Prisma + MySQL 8.4 | Relasional, mature, LTS |
| OCR via proxy API (503 jika `OCR_SERVICE_URL` kosong) | Auto-fill aman: auth + rate limit lewat API |
| Telegram opsional | Notifikasi mobile tanpa push native |

---

## 18. Batasan & residual

| Item | Status |
|------|--------|
| OCR service / auto-fill | Ter-wire: `POST /api/ocr/predict` + auto-fill form surat; aktif hanya jika `OCR_SERVICE_URL` di-set (stack utama default: mati/503) |
| Kolom DB `ocr_text` | **Masih ada** (nullable, tidak diisi) — residual schema |
| Multi-instance API | Rate limit, lockout, session cache **in-memory** — tidak ter-share antar replica |
| HTTPS di compose | Belum built-in; pakai reverse proxy host / Cloudflare |
| Object storage (S3) | Belum; volume lokal cukup 1 VPS |
| Real-time WebSocket | Tidak; notif poll/refresh UI |
| 2FA | Belum |
| Export > 1000 baris | Tidak didukung (sengaja); filter dulu lalu export bertahap |

---

## 19. Diagram ringkas

### 19.1 Komponen

```text
┌─────────────┐     HTTPS      ┌──────────────┐
│   Browser   │ ──────────────►│ Nginx (web)  │
└─────────────┘                └──────┬───────┘
                                      │ /api/*
                               ┌──────▼───────┐
                               │  API (Hono)  │
                               └───┬──────┬───┘
                     ┌─────────────┘      └─────────────┐
                     ▼                                  ▼
              ┌────────────┐                    ┌──────────────┐
              │   MySQL    │                    │ upload volume│
              │  metadata  │                    │  file binary │
              └────────────┘                    └──────────────┘
                     │
              optional Telegram Bot API
```

### 19.2 Alur login

```text
POST /api/auth/login
  → verify password
  → create session row (hash)
  → Set-Cookie httpOnly
GET /api/auth/me
  → sessionMiddleware → user + permissions
FE menyimpan context user; setiap request membawa cookie
```

### 19.3 Alur simpan surat + file

```text
Form FE → multipart POST /api/surat-*
  → requirePermission(create)
  → processUpload → disk volume
  → INSERT surat (path file di kolom)
  → audit_log
  → notify bidang (in-app ± Telegram)
```

---

## Referensi file kunci

| Topik | Path |
|-------|------|
| Entry API | `apps/api/src/index.ts` |
| Schema DB | `apps/api/prisma/schema.prisma` |
| Upload | `apps/api/src/services/file.service.ts` |
| Auth / logout-all | `apps/api/src/services/auth.service.ts`, `routes/auth.ts` |
| Session cache | `apps/api/src/lib/session-cache.ts` |
| Login lockout | `apps/api/src/lib/login-lockout.ts` |
| CSRF | `apps/api/src/middleware/csrf.ts` |
| Export max / query | `apps/api/src/validators/common.ts` (`EXPORT_MAX_ROWS`) |
| Env schema | `apps/api/src/lib/env.ts` |
| Permissions | `packages/shared/src/permissions.ts` |
| Labels | `packages/shared/src/labels.ts` |
| Router FE | `apps/web/src/App.tsx` |
| Export/Print modal | `apps/web/src/components/ExportConfigModal.tsx`, `PrintConfigModal.tsx` |
| Compose | `docker-compose.sips.yml` |
| Nginx | `docker/nginx/default.conf` |
| Running/deploy | `README.md` |

---

*Dokumen ini menggambarkan arsitektur sesuai kode saat ditulis (termasuk CSRF, lockout, session cache, export max 1000, master Super Admin-only write). Jika implementasi berubah, perbarui dokumen bersama PR terkait.*
