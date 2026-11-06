# Sistem Arsip Surat Masuk & Surat Keluar

Aplikasi arsip digital internal — **Hono + React + Bun + MySQL 8.4 LTS**, monorepo, Docker-ready untuk VPS 1–2 GB.

## Tech Stack

| Layer | Teknologi |
|--------|-----------|
| Runtime | **Bun** |
| Backend | **Hono** + Zod |
| Frontend | **React 19** + Vite + Tailwind CSS 4 |
| Database | **MySQL 8.4 LTS** + Prisma |
| Shared | `@arsip/shared` (labels, permissions, types) |
| Auth | Session cookie `httpOnly` + SHA-256 token hash |
| RBAC | Role–Permission |
| Export | ExcelJS + pdf-lib |
| Notifikasi | In-app (semua role) + Telegram bot (hanya Admin Bidang) |
| Deploy | **Docker Compose** |

## Dokumentasi

| Dokumen | Isi |
|---------|-----|
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Arsitektur sistem lengkap (topology, domain, auth, storage, Docker, keamanan) |
| README (file ini) | Setup, struktur, best practice, backup/import DB, running, deploy, Telegram/ngrok |

## Daftar isi

1. [Prasyarat](#prasyarat)
2. [Struktur monorepo](#struktur-monorepo)
3. [Best practice kode](#best-practice-kode)
4. [Klasifikasi arsip (hirarki)](#klasifikasi-arsip-hirarki)
5. [Populate DB dan backup (`backups/`)](#populate-db-dan-backup-backups)
6. [A. Deploy Docker](#a-deploy-docker-recommended)
7. [B. Dev lokal](#b-dev-lokal-api--web-di-host)
8. [C. Cara pakai aplikasi](#c-cara-pakai-aplikasi)
9. [D. Ngrok / Telegram](#d-cara-running-ngrok-telegram-dev-lokal)
10. [E. Docker best practices](#e-docker-best-practices)
11. [F. OCR Service (LayoutLMv3)](#f-ocr-service-layoutlmv3-opsional)
12. [Arsitektur sistem](docs/ARCHITECTURE.md)

## Struktur monorepo

```
arsip-surat/
├── apps/
│   ├── api/                      # Backend Hono + Bun + Prisma  → :3001
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   ├── seed.ts
│   │   │   └── data/klasifikasi_arsip.sql   # sumber seed klasifikasi
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/           # 1 file ≈ 1 domain API
│   │       ├── services/         # bisnis + side-effect
│   │       ├── middleware/
│   │       ├── validators/
│   │       └── lib/              # db, env, klasifikasi helpers
│   └── web/                      # Frontend React + Vite       → :5173
│       └── src/
│           ├── App.tsx           # routing
│           ├── pages/            # 1 page route (shell tipis)
│           │   └── master/       # Master Data (split by tab)
│           ├── components/       # UI shared + layout
│           └── lib/              # api client, auth, toast
├── packages/shared/              # @arsip/shared (labels, permissions, roles)
├── docker/                       # mysql init, nginx conf
├── ocr/                          # OCR service Python (service di docker-compose.sips.yml)
├── layoutlmv3-bio-model/         # model ML (~481 MB, tidak di-git)
├── db_docs/                      # SQL referensi klasifikasi (sumber update)
├── backups/                      # SQL dump: backup & import DB
├── docs/ARCHITECTURE.md
├── storage/                      # uploads + temp (gitkeep)
├── docker-compose.sips.yml       # stack: mysql :3307 (localhost) + api + web + ocr
├── Makefile
└── package.json                  # workspaces + scripts root
```

### Frontend Master Data (`apps/web/src/pages/master/`)

```
pages/
  MasterPage.tsx              # re-export (import App tetap ./pages/MasterPage)
  master/
    MasterPage.tsx            # shell: auth + tab navigation
    types.ts                  # Bidang, Kategori, Kode, Indeks
    constants.ts              # empty form defaults
    validation.ts             # prefix kategori, 1 titik / 2+ titik
    components/
      MasterTabs.tsx
    tabs/
      BidangTab.tsx           # CRUD bidang
      IndeksTab.tsx           # list indeks + sub indeks (opsi surat)
      StrukturTab.tsx         # kategori & kelompok (Super Admin)
```

**Prinsip:** 1 tab = 1 file + state sendiri. Shell tidak menumpuk business logic.

### Backend API (`apps/api/src/`)

| Folder | Isi |
|--------|-----|
| `routes/` | HTTP handlers (auth, surat, master, …) |
| `services/` | audit, export, file, notifikasi, telegram |
| `validators/` | Zod schema request |
| `lib/klasifikasi.ts` | level kode, validasi prefix & kind (kelompok/indeks) |
| `middleware/` | auth, CSRF, rate-limit, security |

---

## Best practice kode

### Umum monorepo

| Praktik | Cara di project ini |
|---------|---------------------|
| Package manager | **Bun only** (`workspace:*`). Jangan `npm install` di sub-app |
| Shared constants | `@arsip/shared` — labels/permissions/roles FE=BE |
| Env | Secrets di **root** `.env` saja (Docker + API lokal). Jangan commit |
| DB schema | Prisma migrate; seed terpisah (`db:seed`) |
| Validasi | Zod di API; FE boleh pre-check UX, API tetap source of truth |
| Permission | Middleware `requirePermission` / Super Admin untuk write master |

### Frontend

1. **Page tipis** — routing + layout; domain besar dipecah folder (`pages/master/`).
2. **Tab self-contained** — load data, form, modal di dalam tab (tidak 1 state raksasa).
3. **UI shared** — `components/ui.tsx` (Button, Table, Modal, …).
4. **API client** — `lib/api.ts` (`api.get/post/put/del` + `formatApiError`).
5. **Jangan** taruh business rule hanya di UI; mirror di API.

### Backend

1. **Route tipis** — parse → validate → service/db → JSON.
2. **Helper domain** — mis. `lib/klasifikasi.ts` untuk aturan kode (bukan duplikasi di tiap route).
3. **Audit** — write penting lewat `writeAudit`.
4. **Upload** — magic bytes + rename UUID; metadata di DB, file di volume.

### Klasifikasi (tanpa table baru untuk “kelompok”)

- **Kategori** → table `master_kategori` (`kode_awal` 3 digit).
- **Kelompok** → baris `master_kode` dengan **1 titik** (`000.1`) — bukan opsi surat.
- **Indeks** → baris `master_kode` dengan **2+ titik** (`000.1.2`) — opsi surat.
- **Sub indeks** → table `master_indeks` di bawah indeks.
- Level dihitung dari **pola string kode** (`getKodeLevel` / `kind=kelompok|indeks` di list API).
- Parent kelompok di list indeks di-resolve otomatis: `000.1.2` → kelompok `000.1` (jika ada di DB).

### Git / Docker

- Jangan `docker compose down -v` di production (hapus volume = data hilang).
- Backup/restore: lihat [Populate DB dan backup](#populate-db-dan-backup-backups).
- Image pinned; secrets hanya di env.

---

## Klasifikasi arsip (hirarki)

```text
Kategori     000 · UMUM              → master_kategori
  Kelompok   000.1 · Ketatausahaan…  → master_kode (1 titik)  · bukan opsi surat
    Indeks   000.1.2 · Perjalanan…   → master_kode (2+ titik) · opsi surat
      Sub    1. …                    → master_indeks
```

| Level | Contoh | Di form surat? | UI kelola |
|-------|--------|----------------|-----------|
| Kategori | `000` | Tidak | Master → **Kategori & Kelompok** (Super Admin) |
| Kelompok | `000.1` | **Tidak** | sama |
| Indeks | `000.1.2` | **Ya** | Master → **Kode Klasifikasi** |
| Sub indeks | nama | Opsional | expand baris / Tambah Sub Indeks |

**Validasi:** kode harus diawali `kode_awal` kategori (mis. kategori `200` → hanya `200.*`).  
**Seed:** `apps/api/prisma/data/klasifikasi_arsip.sql` (update dari `db_docs/` lalu seed ulang master).

### Master Data — tab UI

| Tab | Role | Fungsi |
|-----|------|--------|
| Bidang | master.manage (write: Super Admin) | unit kerja |
| Kode Klasifikasi | master.manage | list indeks + sub indeks |
| Kategori & Kelompok | **Super Admin** | CRUD kategori & kelompok |

### Stack SIPS (`docker-compose.sips.yml`)

Stack **`arsip-sips`** — full stack dengan **OCR aktif**:

| Container | Port host | Peran |
|-----------|-----------|-------|
| `sips-mysql` | 3307 (localhost) | DB `sips_db` (volume `sips_mysql_data`) |
| `sips-api` | — (internal) | API, `OCR_SERVICE_URL=http://ocr:8000` |
| `sips-web` | `WEB_PORT` (default 80) | Nginx + SPA |
| `arsip-ocr` | `OCR_PORT` (default 8000, localhost) | OCR PaddleOCR + LayoutLMv3 |

```bash
# Stack penuh (mysql + api + web + ocr)
docker compose -f docker-compose.sips.yml up -d --build

# Hanya MySQL untuk dev (API/Web di host)
bun run docker:db
```

Env: `SIPS_MYSQL_*` (`SIPS_MYSQL_ROOT_PASSWORD` & `SIPS_MYSQL_PASSWORD` **wajib**), `SIPS_APP_URL` / `SIPS_WEB_URL`, `WEB_PORT`, `OCR_PORT` (lihat `.env.example`).  
Root `.env` contoh (API dev di host): `DATABASE_URL="mysql://arsip:arsip_secret@127.0.0.1:3307/sips_db"`.

---

## Populate DB dan backup (`backups/`)

Kalau bawa dump SQL dari mesin lain, taruh file-nya di folder `backups/` (contoh: `backups/sips_db.sql`), lalu import ke MySQL.

### 1. Taruh file dump

```text
backups/
  └── sips_db.sql   # atau nama file .sql lain yang kamu bawa
```

### 2. Nyalakan MySQL

```bash
# sips-mysql (:3307, bind localhost)
bun run docker:db
# atau: docker compose -f docker-compose.sips.yml up -d mysql-sips
```

Tunggu status container **healthy**.

### 3. Import (populate)

Ganti nama file jika dump-mu beda.

**PowerShell:**

```powershell
# → sips_db (port 3307)
Get-Content "backups/sips_db.sql" -Raw | docker compose -f docker-compose.sips.yml exec -T mysql-sips mysql -u root -p"$env:SIPS_MYSQL_ROOT_PASSWORD" sips_db
```

**bash / Git Bash:**

```bash
docker compose -f docker-compose.sips.yml exec -T mysql-sips mysql -u root -p"$SIPS_MYSQL_ROOT_PASSWORD" sips_db < backups/sips_db.sql
```

### 4. Arahkan API ke DB yang di-import

Di root `.env`:

```env
DATABASE_URL="mysql://arsip:arsip_secret@127.0.0.1:3307/sips_db"
```

Lalu:

```bash
bun run db:generate
bun run dev:api
bun run dev:web
```

Login pakai user yang ada di dump (bukan seed kosong).

**Catatan:** import menimpa tabel; lampiran di `storage/` tidak ikut dump; jangan `docker compose down -v` setelah import.

### 5. Backup rutin (mysqldump)

Dump timestamped disimpan di `backups/` (folder yang sama dengan import di atas):

**Make (Linux/macOS / Git Bash):**

```bash
make backup
```

**PowerShell (tanpa make):**

```powershell
docker compose -f docker-compose.sips.yml exec -T mysql-sips mysqldump -u root -p"$env:SIPS_MYSQL_ROOT_PASSWORD" --single-transaction --routines sips_db > "backups/sips_$(Get-Date -Format yyyyMMdd_HHmmss).sql"
```

Restore = ulangi langkah **3. Import** di atas dengan file backup-nya.

---

## Prasyarat

- [Bun](https://bun.sh) ≥ 1.2
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (untuk MySQL / full stack)
- Opsional: [ngrok](https://ngrok.com/download) (webhook Telegram di lokal)
- Opsional: bot Telegram via [@BotFather](https://t.me/BotFather)

---

## A. Deploy Docker (recommended)

```bash
cp .env.example .env          # ganti password & SESSION_SECRET (SIPS_MYSQL_* wajib)
docker compose -f docker-compose.sips.yml up -d --build
docker compose -f docker-compose.sips.yml exec api bun run prisma/seed.ts
# Buka http://localhost
```

### Akun default (ganti segera)

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `Admin@12345` |
| Admin Bidang | `admin.keuangan` | `Bidang@12345` |

```bash
docker compose -f docker-compose.sips.yml ps
docker compose -f docker-compose.sips.yml logs -f api
docker compose -f docker-compose.sips.yml exec api bun run prisma/seed.ts
docker compose -f docker-compose.sips.yml down
```

---

## B. Dev lokal (API + Web di host)

### 1. MySQL

```bash
# dari root project
bun run docker:db
# atau: docker compose -f docker-compose.sips.yml up -d mysql-sips
```

### 2. Install & env

```bash
bun install

cp .env.example .env
# sesuaikan DATABASE_URL, SESSION_SECRET, WEB_URL, dll.
```

Contoh root `.env` (cuplikan API lokal):

```env
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3001
WEB_URL=http://localhost:5173
DATABASE_URL="mysql://arsip:arsip_secret@127.0.0.1:3307/sips_db"
COOKIE_SECURE=false
UPLOAD_DIR=../../storage/uploads
TEMP_DIR=../../storage/temp
```

### 3. Database

```bash
# dari root, atau di apps/api
bun run db:generate
bun run db:migrate          # atau: bunx prisma migrate deploy (di apps/api)
bun run db:seed
```

### 4. Jalankan

**Terminal 1 — API**

```bash
bun run dev:api
# http://localhost:3001
```

**Terminal 2 — Web**

```bash
bun run dev:web
# http://localhost:5173
```

Login di browser: **http://localhost:5173** dengan akun seed di atas.

### Perintah root yang berguna

| Perintah | Fungsi |
|----------|--------|
| `bun run dev:api` | API hot-reload |
| `bun run dev:web` | Vite web |
| `bun run db:seed` | Seed role/user |
| `bun run db:studio` | Prisma Studio |
| `bun run docker:db` | MySQL dev only |
| `bun run docker:up` | Full stack Docker |

---

## C. Cara pakai aplikasi

1. **Login** dengan Super Admin atau Admin Bidang.
2. **Dashboard** — ringkasan arsip.
3. **Surat Masuk / Surat Keluar** — pilih **indeks** (`000.1.2`), bukan kelompok (`000.1`); sub indeks opsional.
   Pilih file scan JPG/PNG → tombol **✨ Isi otomatis dari scan** mengisi field (asal, no surat, perihal, tanggal) via OCR — butuh service OCR aktif (lihat [F](#f-ocr-service-layoutlmv3-opsional)).
4. **Master Data** (`/master`):
   - **Bidang** — unit kerja.
   - **Kode Klasifikasi** — indeks + sub indeks (opsi di form surat).
   - **Kategori & Kelompok** (Super Admin) — struktur klasifikasi; kelompok tidak muncul di form surat.
5. **Pengguna** — kelola user & role (Super Admin).
6. **Notifikasi** (halaman `/notifications`, lonceng di header) — in-app untuk semua role:
   - **Super Admin** — surat masuk/keluar baru & perubahan disposisi dari **semua bidang** (in-app saja, tanpa Telegram).
   - **Admin Bidang** — surat bidang sendiri; opsional **taut Telegram** di halaman Notifikasi.

---

## D. Cara running ngrok (Telegram, dev lokal)

> **Butuh tunnel?** Telegram tidak bisa hit `localhost`. Pakai ngrok supaya bot bisa kirim webhook ke API di laptopmu.

> **Catatan:** fitur Telegram hanya untuk akun **Admin Bidang**. Super Admin menerima notifikasi in-app saja — endpoint `/api/notifications/telegram/*` dan bot command `/link` diblokir untuk role itu.

### TL;DR — 4 perintah

```bash
# 1) API harus sudah jalan di port 3001
bun run dev:api

# 2) Terminal lain: buka tunnel ke API (bukan ke :5173)
ngrok http 3001

# 3) Salin URL HTTPS dari ngrok, lalu set webhook (ganti nilai di bawah)
#    PowerShell contoh di subsection 5

# 4) Di app: Notifikasi → Buat kode taut → di bot Telegram: /link KODE
```

### 1. Siapkan bot + env

1. Chat [@BotFather](https://t.me/BotFather) → `/newbot` → simpan **token**.
2. Isi di **root `.env`**:

```env
TELEGRAM_BOT_TOKEN=123456:ABC-token-dari-BotFather
TELEGRAM_BOT_USERNAME=nama_bot_tanpa_at
TELEGRAM_WEBHOOK_SECRET=string-rahasia-panjang-acak
```

Generate secret:

```bash
# PowerShell
[Convert]::ToBase64String((1..36 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# bash
openssl rand -base64 32
```

**Restart API** setelah ubah `.env`.

### 2. Install & login ngrok (sekali saja)

1. Download: https://ngrok.com/download  
2. Daftar akun gratis → copy **authtoken** dari dashboard.  
3. Di terminal:

```bash
ngrok config add-authtoken <TOKEN_DARI_DASHBOARD>
```

Cek terpasang:

```bash
ngrok version
```

### 3. Jalankan API dulu

```bash
# dari root project
bun run dev:api
# harus listen di http://localhost:3001
```

### 4. Running ngrok (tunnel)

Buka **terminal baru** (biarkan API tetap jalan), lalu:

```bash
ngrok http 3001
```

Tunggu sampai muncul baris seperti:

```text
Forwarding    https://abcd-12-34-56-78.ngrok-free.app -> http://localhost:3001
```

- Salin URL `https://....ngrok-free.app`
- **Wajib** tunnel ke **3001 (API)**, jangan ke **5173 (web)**
- Biarkan jendela ngrok **tetap terbuka** selama testing
- Akun gratis: URL berubah tiap restart ngrok → ulangi **setWebhook** (langkah 5)

Opsional: buka UI ngrok di browser → http://127.0.0.1:4040 (lihat request masuk).

### 5. Daftarkan webhook ke Telegram

Ganti `https://xxxx.ngrok-free.app`, token bot, dan secret.

**PowerShell (Windows):**

```powershell
$NGROK = "https://xxxx.ngrok-free.app"
$TOKEN = "TOKEN_BOT_DARI_BOTFATHER"
$SECRET = "ISI_SAMA_DENGAN_TELEGRAM_WEBHOOK_SECRET_DI_ENV"

Invoke-RestMethod -Method Post `
  -Uri "https://api.telegram.org/bot$TOKEN/setWebhook" `
  -ContentType "application/json" `
  -Body (@{
    url = "$NGROK/api/telegram/webhook"
    secret_token = $SECRET
  } | ConvertTo-Json)
```

**bash / Git Bash:**

```bash
NGROK="https://xxxx.ngrok-free.app"
TOKEN="TOKEN_BOT_DARI_BOTFATHER"
SECRET="ISI_SAMA_DENGAN_TELEGRAM_WEBHOOK_SECRET_DI_ENV"

curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${NGROK}/api/telegram/webhook\",\"secret_token\":\"${SECRET}\"}"
```

Cek webhook aktif:

```bash
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"
```

Endpoint di app: **`POST /api/telegram/webhook`**.

### 6. Tautkan akun di aplikasi

1. Login web → **Notifikasi** (lonceng → Lihat semua, atau `/notifications`).
2. **Buat kode taut** → salin kode.
3. Buka bot di Telegram → kirim:

```text
/link KODE_DARI_APLIKASI
```

4. Status jadi **Terhubung** → notif surat juga masuk ke Telegram.

Lepas: tombol **Lepas tautan** di halaman Notifikasi.

### Checklist kalau gagal

| Gejala | Cek |
|--------|-----|
| `ngrok` tidak dikenali | Install ulang, PATH, buka terminal baru |
| Webhook error / 401 | `TELEGRAM_WEBHOOK_SECRET` harus sama dengan `secret_token` di setWebhook |
| Bot tidak respons `/link` | API + ngrok masih jalan? URL setWebhook masih URL ngrok terbaru? |
| Tunnel ke web | Harus `ngrok http 3001`, bukan 5173 |
| getWebhookInfo last_error | Buka http://127.0.0.1:4040 / log API |

### Alur

```text
Telegram → https://xxx.ngrok-free.app/api/telegram/webhook
        → ngrok → http://localhost:3001 (API)
```

| # | Perintah / aksi |
|---|-----------------|
| 1 | `bun run dev:api` |
| 2 | `ngrok http 3001` |
| 3 | setWebhook → `{ngrok}/api/telegram/webhook` |
| 4 | App: buat kode → bot: `/link KODE` |

### Production (tanpa ngrok)

Pakai domain HTTPS publik (Nginx/Docker), set:

```env
APP_URL=https://domain-anda
WEB_URL=https://domain-anda
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...
TELEGRAM_WEBHOOK_SECRET=...
```

Lalu setWebhook ke:

```text
https://domain-anda/api/telegram/webhook
```

(pastikan reverse proxy meneruskan `/api/*` ke service API).

---

## E. Docker best practices

| Praktik | Implementasi |
|---------|----------------|
| Image pinned | `mysql:8.4`, `nginx:1.27-alpine`, `oven/bun:1.2-alpine` |
| Multi-stage | API & Web |
| Non-root | API |
| Healthcheck | Semua service |
| Entry publik | Nginx :80 |
| Volume | sips_mysql_data, sips_upload_data |
| Model ML | bind-mount `:ro` (opsi symlink versi); tidak ikut image |
| Secrets | `.env` (jangan commit) |

### Topology

```text
Internet → [web:80 Nginx] → /api/* → [api:3001] ─→ [mysql:3306]
                                  └→ [ocr:8000] (internal, bind localhost)
```

### Production checklist

1. Ganti `SIPS_MYSQL_*` password & `SESSION_SECRET`
2. `COOKIE_SECURE=true` + HTTPS
3. Jangan expose MySQL ke publik
4. Firewall: hanya 80/443
5. Backup volume MySQL + uploads
6. Set `WEB_URL` / `APP_URL` ke domain final
7. Set Telegram webhook ke domain HTTPS (bukan ngrok)

---

## F. OCR Service (LayoutLMv3, opsional)

Service Python terpisah (`ocr/`) untuk ekstraksi field surat dari gambar scan: PaddleOCR (baca teks + posisi) → LayoutLMv3 BIO (klasifikasi field: `asal_surat`, `nomor`, `tanggal_surat`, `kepada`, `perihal`). Internal only — tidak di-expose ke publik.

### Integrasi app (auto-fill form)

- Endpoint proxy: **`POST /api/ocr/predict`** (`apps/api/src/routes/ocr.ts`) — auth + permission create surat + rate limit upload + validasi magic bytes (hanya **JPG/PNG**), forward ke `OCR_SERVICE_URL` (timeout 60 s).
- Form surat masuk/keluar: pilih file scan → tombol **✨ Isi otomatis dari scan** → field terisi otomatis; tanggal di-parse ke format input date (`lib/ocr-date.ts`).
- `OCR_SERVICE_URL` kosong (mis. API dev tanpa OCR) = fitur mati → endpoint balas **503** "Fitur OCR tidak diaktifkan".

### Dev lokal

```powershell
# CLI langsung (venv ocr/):
ocr\.venv\Scripts\python.exe ocr\predict.py ocr\samples\image.png

# Atau sebagai service HTTP (container ocr, model di-mount dari folder repo):
docker compose -f docker-compose.sips.yml up -d --build ocr
curl http://localhost:8000/health
curl -X POST http://localhost:8000/predict -F "file=@ocr/samples/image.png"
```

API dev di host: set `OCR_SERVICE_URL=http://localhost:8000` di root `.env` (default `.env.example`), lalu restart `bun run dev:api`.

### Deploy VPS (stack SIPS)

OCR berjalan sebagai bagian stack `arsip-sips` — API-nya sudah di-wire `OCR_SERVICE_URL=http://ocr:8000`:

```bash
docker compose -f docker-compose.sips.yml up -d --build
```

Model (~481 MB) **tidak ikut image** — di-bind-mount read-only: default `./layoutlmv3-bio-model` → `/models` (`MODEL_DIR=/models`).

> RAM: LayoutLMv3 + PaddleOCR di CPU butuh ~1,5–2 GB — VPS 1–2 GB tidak cukup untuk full stack + OCR (minimal 4 GB).

### Update model di VPS (tanpa rebuild)

**Opsi A — ganti isi folder model** (default compose):

```bash
scp -r layoutlmv3-bio-model/. user@vps:<repo>/layoutlmv3-bio-model/
docker compose -f docker-compose.sips.yml restart ocr
```

**Opsi B — versi + symlink** (rollback gampang): ubah bind-mount compose ke folder induk model (mis. `/opt/arsip/models:/models:ro`) + `MODEL_DIR=/models/current` (default `ocr/Dockerfile`), lalu:

```bash
# 1. Upload model baru (folder lama tidak disentuh)
scp -r layoutlmv3-bio-model user@vps:/opt/arsip/models/layoutlmv3-v2

# 2. Flip symlink + restart (proses baca ulang model saat startup)
ssh user@vps 'ln -sfn /opt/arsip/models/layoutlmv3-v2 /opt/arsip/models/current'
docker compose -f docker-compose.sips.yml restart ocr

# Rollback: flip symlink balik ke versi lama, restart lagi
```

> Catatan: model baru bisa mengubah entity type di `label_map.json` → cek dulu output `/predict` di sampel sebelum flip symlink permanen.

---

## Shared package (`@arsip/shared`)

```ts
import { LABELS, PERMISSIONS, ROLES } from "@arsip/shared";
```

- `LABELS` → form, tabel, Excel, PDF identik  
- `PERMISSIONS` → RBAC  
- `ROLES` → Super Admin / Admin Bidang  

---

## Keamanan

1. Session cookie `httpOnly` + `SameSite=Lax` (+ `Secure` production)
2. Password bcrypt (`Bun.password`)
3. Token session SHA-256 di DB
4. RBAC + scope `bidang_id`
5. Validasi Zod
6. Upload: magic bytes + UUID rename
7. Rate limit login/upload
8. Origin check + security headers
9. Webhook Telegram: header `X-Telegram-Bot-Api-Secret-Token`
10. OCR: proxy via API (auth + permission + rate limit); hanya JPG/PNG (magic bytes); service internal

## Hak akses

- **Super Admin:** semua permission — CRUD surat masuk/keluar, master data (bidang, kategori & kelompok, kode, indeks), manajemen pengguna, export. Notifikasi in-app untuk **semua bidang** (tanpa Telegram).
- **Admin Bidang:** CRUD surat masuk/keluar + export; data bisa dilihat **semua bidang** (filter bidang opsional). Tidak bisa: manajemen pengguna & write master data (API menegakkan `requireSuperAdmin`). Notifikasi in-app untuk bidang sendiri; Telegram opsional.

## API ringkas

| Method | Path | Ket |
|--------|------|-----|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Profil + permissions |
| GET | `/api/dashboard/stats` | Statistik |
| CRUD | `/api/surat-masuk` | Surat masuk |
| GET | `/api/surat-masuk/export/excel` | Export |
| CRUD | `/api/surat-keluar` | Surat keluar |
| POST | `/api/ocr/predict` | Auto-fill form dari gambar scan (proxy ke service OCR; JPG/PNG) |
| CRUD | `/api/master/bidang` | Bidang |
| CRUD | `/api/master/kategori` | Kategori (write: Super Admin) |
| GET | `/api/master/kode?kind=indeks\|kelompok\|all` | List kode (default: indeks) |
| GET | `/api/master/kode/search?forSurat=1` | Search opsi surat (hide kelompok) |
| POST/PUT | `/api/master/kode` | body `kind`: `kelompok` \| `indeks` |
| CRUD | `/api/master/indeks` | Sub indeks |
| * | `/api/master/users` | Users (Super Admin) |
| GET | `/api/notifications` | Daftar notifikasi |
| GET | `/api/notifications/unread-count` | Jumlah belum dibaca |
| POST | `/api/notifications/read-all` | Tandai semua dibaca |
| POST | `/api/notifications/telegram/link` | Buat kode taut (Admin Bidang) |
| POST | `/api/notifications/telegram/unlink` | Lepas tautan Telegram |
| POST | `/api/telegram/webhook` | Webhook bot Telegram |

## Arsitektur (ringkas)

Lihat dokumentasi lengkap: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

```text
Internet → [Nginx web :80] → SPA + /api/* → [API Bun :3001] → [MySQL]
                                              └→ volume uploads (file surat)
```

- Monorepo: `apps/api`, `apps/web`, `packages/shared`
- Auth: session cookie + RBAC
- File: disk/Docker volume (metadata di DB)
- Deploy VPS: Docker Compose (mysql + api + web + ocr) — lihat [F](#f-ocr-service-layoutlmv3-opsional)
- Master FE: pecah per tab di `pages/master/` (lihat [Struktur monorepo](#struktur-monorepo))

## Kontribusi / menambah fitur Master

1. Domain UI baru → file di `apps/web/src/pages/master/tabs/` (jangan gembungkan ke shell).
2. Aturan kode klasifikasi → `apps/api/src/lib/klasifikasi.ts` + mirror UX di `pages/master/validation.ts`.
3. Schema DB → Prisma migration di `apps/api/prisma/migrations/`.
4. Update seed SQL klasifikasi dari `db_docs/` → `apps/api/prisma/data/klasifikasi_arsip.sql`.
5. Labels/permissions baru → `packages/shared` dulu, baru FE/BE.

## Lisensi

Internal / proprietary — sesuaikan kebijakan instansi.
