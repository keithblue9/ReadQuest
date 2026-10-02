# ReadQuest — Panduan Deployment

Dokumen ini menjelaskan cara menjalankan ReadQuest di production. Jalur yang direkomendasikan
adalah **satu server (VPS) dengan Docker Compose**: `deploy/docker-compose.yml` menjalankan
seluruh stack, dengan HTTPS otomatis dari Caddy. Alternatif memakai layanan terkelola ada di
bagian akhir.

## 1. Arsitektur Deployment

```mermaid
flowchart LR
  U[Browser / PWA] -- HTTPS 443 --> C[Caddy<br/>TLS otomatis, HSTS, gzip/zstd]
  C --> F[frontend<br/>Next.js standalone]
  F -- "/api/*, /ws/* (rewrites)" --> B[backend<br/>FastAPI + scheduler + WebSocket]
  B --> M[(mongo<br/>replica set rs0)]
  B --> S[(storage<br/>RustFS S3)]
  B -- Web Push --> P[Push service browser]
  subgraph "jaringan internal 'data' (tanpa internet & port publik)"
    M
    S
  end
```

| Layanan | Image | Port publik | Catatan |
|---------|-------|-------------|---------|
| `caddy` | `caddy:2-alpine` | 80, 443 (TCP+UDP) | Sertifikat Let's Encrypt otomatis, HTTP → HTTPS, HSTS, batas body 12 MB |
| `frontend` | `frontend/Dockerfile` | — | Next.js `output: "standalone"`, user non-root, header keamanan & CSP |
| `backend` | `backend/Dockerfile` | — | Uvicorn, user non-root, `APP_ENV=production` (wajib secret kuat, cookie `Secure`, HTTPS) |
| `mongo` | `mongo:7` | — | Replica set satu node (transaksi multi-dokumen) |
| `storage` | `rustfs/rustfs:1.0.0` | — | Object storage S3-compatible untuk foto; bucket dibuat otomatis oleh backend |
| `seed` | image backend | — | Profil `tools`, dijalankan manual sekali (idempoten) |

## 2. Prasyarat

- Server Linux (min. 2 vCPU, 2–4 GB RAM, 20 GB disk) dengan **Docker Engine 24+** dan Compose v2.
- **Domain** dengan record DNS A/AAAA yang mengarah ke IP server, misalnya `baca.perusahaan.co.id`.
- Port **80 dan 443** terbuka di firewall. Port 80 dipakai validasi ACME dan redirect ke HTTPS.
- HTTPS wajib, karena Service Worker, Web Push, dan cookie `Secure` hanya bekerja di HTTPS.

## 3. Instalasi Pertama

```bash
git clone https://github.com/keithblue9/ReadQuest.git
cd ReadQuest/deploy
cp .env.example .env
```

Isi `deploy/.env` (file ini **tidak di-commit**, sudah tercakup di `.gitignore`):

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `DOMAIN` | ✅ | Domain publik, tanpa `https://` |
| `ACME_EMAIL` | ✅ | Email untuk notifikasi Let's Encrypt |
| `JWT_SECRET` | ✅ | Min. 32 karakter: `openssl rand -base64 48` |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | ✅ | Kredensial RustFS (secret min. 8 karakter): `openssl rand -base64 24` |
| `S3_BUCKET` | — | Default `readquest-photos` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | — | Web Push. Kosong = push nonaktif, lonceng in-app tetap jalan |
| `ADMIN_PHONE`, `ADMIN_PIN`, `ADMIN_NAME` | seed | Admin pertama: login dengan nomor HP + PIN 6 angka |
| `MONGODB_DB`, `TAG` | — | Nama database (default `readquest`) dan tag image |

Build, jalankan, lalu seed data awal:

```bash
docker compose build
# (opsional) buat kunci VAPID lalu salin ke .env:
docker run --rm readquest-backend python -m app.scripts.generate_vapid

docker compose up -d
docker compose ps                                  # semua layanan harus "healthy"/"running"
docker compose --profile tools run --rm seed       # role, aturan poin, badge, admin pertama
```

Buka `https://DOMAIN`, masuk sebagai admin (nomor HP + PIN), selesaikan onboarding, lalu bagikan
alamat `https://DOMAIN/register` ke tim. Anggota cukup mengisi nama, fungsi, nomor HP, dan PIN.
Pengguna yang lupa PIN di-reset lewat **Panel Admin → Pengguna → Reset PIN**.

> Seed hanya menambah data yang belum ada, jadi aman dijalankan ulang. Setelah admin pertama
> dibuat, `ADMIN_PIN` boleh dihapus dari `.env`.

### Build di balik proxy TLS korporat

Bila `npm ci` atau `uv sync` gagal karena sertifikat proxy, berikan CA lewat BuildKit secret.
CA ini tidak ikut tersimpan di image:

```bash
docker build --secret id=ca,src=/path/ca.crt -t readquest-backend ../backend
docker build --secret id=ca,src=/path/ca.crt --build-arg API_PROXY_TARGET=http://backend:8000 \
  -t readquest-frontend ../frontend
```

## 4. Verifikasi Setelah Deploy

```bash
curl -I https://DOMAIN/login            # 200 + strict-transport-security + content-security-policy
curl -I http://DOMAIN/                  # 308 → https
docker compose logs -f backend          # tidak ada error startup; scheduler aktif
```

Cek manual:
- Daftar di `/register`, mulai sesi baca, unggah foto, lalu posting muncul di feed.
- **Reading Room** menampilkan "… di ruangan" (WebSocket lewat Caddy → Next.js → FastAPI).
- **Pengaturan notifikasi → Kirim tes** (bila VAPID diisi; di iOS hanya setelah dipasang ke Layar Utama).
- **Panel Admin → Dashboard → ⬇ PDF/Excel**.

## 5. Operasional

### Update versi

```bash
cd ReadQuest && git pull
cd deploy && docker compose build && docker compose up -d
docker compose --profile tools run --rm seed      # bila rilis menambah permission/pengaturan baru
```

Index MongoDB disinkronkan otomatis saat backend start (`ensure_indexes`). Pengguna yang sedang
membuka PWA akan melihat toast **"Versi baru ReadQuest tersedia · Muat ulang"**.

### Backup & restore

```bash
# MongoDB (harian, simpan di luar server)
docker compose exec -T mongo mongodump --archive --gzip --db readquest > readquest-$(date +%F).archive.gz
docker compose exec -T mongo mongorestore --archive --gzip --drop < readquest-YYYY-MM-DD.archive.gz

# Foto (volume RustFS)
docker run --rm -v readquest-prod_storage-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/storage-$(date +%F).tar.gz -C /data .
```

Volume penting: `readquest-prod_mongo-data`, `readquest-prod_storage-data`, dan
`readquest-prod_caddy-data` (sertifikat).

### Log & pemantauan

- `docker compose logs -f backend frontend caddy`. Access log backend mencatat IP klien asli
  (dari `X-Forwarded-For` yang diisi Caddy).
- Health check: backend `GET /health` (termasuk ping MongoDB), frontend `GET /offline`. Docker
  menandai container `unhealthy` bila gagal.
- Audit perubahan konfigurasi tersedia di **Panel Admin → Audit Log**.

### Rotasi secret

- **JWT_SECRET**: ganti lalu `docker compose up -d backend`. Semua sesi login berakhir (pengguna login ulang).
- **VAPID**: kunci baru membuat langganan push lama tidak valid; pengguna perlu mengaktifkan push lagi.
- **S3**: ganti di `.env`, lalu restart `storage` dan `backend` bersamaan.

## 6. Keamanan Production (checklist)

- [x] `APP_ENV=production` menolak start bila `JWT_SECRET` lemah, `COOKIE_SECURE` mati,
      `FRONTEND_ORIGIN` bukan HTTPS, atau kredensial S3 kosong.
- [x] Hanya Caddy yang membuka port. MongoDB & storage berada di jaringan `internal` tanpa internet.
- [x] HTTPS + HSTS (Caddy), CSP & header keamanan (Next.js), `nosniff`/`DENY`/`no-store` (FastAPI).
- [x] Dokumentasi OpenAPI (`/docs`, `/openapi.json`) dimatikan di production.
- [x] Batas ukuran request 12 MB (Caddy & FastAPI). Upload foto dibatasi lagi oleh `upload.max_bytes`.
- [x] Rate limit per IP/user. Token WebSocket dikirim sebagai pesan, bukan di URL, sehingga tidak tercatat di log.
- [x] Container berjalan sebagai user non-root. Secret hanya ada di `deploy/.env`, tidak di image.
- [ ] Backup terjadwal & uji restore berkala (tanggung jawab operator).
- [ ] Untuk data sangat sensitif, aktifkan autentikasi MongoDB atau gunakan MongoDB Atlas.

## 7. Batasan Skala

Backend dirancang untuk **satu instance**:
- Scheduler sudah aman bila berjalan di beberapa instance (lease di koleksi `job_locks`).
- Presence **Reading Room** dan **rate limit** disimpan di memori proses. Untuk scale horizontal,
  pindahkan keduanya ke Redis (pub/sub untuk broadcast, counter untuk rate limit).

Untuk satu tim/organisasi (ratusan hingga beberapa ribu anggota), satu instance backend sudah
cukup.

## 8. Alternatif: Layanan Terkelola (Railway + MongoDB Atlas + Cloudflare R2)

Tanpa server sendiri dan tanpa domain: Railway memberi alamat HTTPS gratis
`https://<nama>.up.railway.app` (cukup untuk PWA & Web Push). Domain sendiri bisa ditambahkan
kapan saja.

```mermaid
flowchart LR
  U[Browser / PWA] -- HTTPS --> F[Railway: frontend<br/>*.up.railway.app]
  F -- "jaringan privat<br/>backend.railway.internal:8000" --> B[Railway: backend<br/>tanpa domain publik]
  B --> M[(MongoDB Atlas M0)]
  B --> R[(Cloudflare R2)]
```

Perkiraan biaya awal: Atlas M0 & R2 (≤ 10 GB) gratis; Railway paket Hobby ± US$5/bulan
(mencakup pemakaian kecil dua service).

### 8.1 MongoDB Atlas

1. Daftar di <https://cloud.mongodb.com> → **Create** cluster **M0 (Free)**. Pilih region terdekat
   dengan region Railway, mis. Singapura (`ap-southeast-1`).
2. **Database Access** → tambah user (mis. `readquest`) dengan password acak, role
   *Read and write to any database*.
3. **Network Access** → **Allow access from anywhere** (`0.0.0.0/0`). Railway Hobby tidak punya IP
   statis, dan akses tetap dilindungi user + password.
4. **Connect → Drivers** → salin connection string, lalu ganti `<password>`:
   `mongodb+srv://readquest:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### 8.2 Cloudflare R2

1. Daftar di <https://dash.cloudflare.com> → **R2** → aktifkan (paket gratis tetap minta data
   pembayaran) → **Create bucket** `readquest-photos` (lokasi *Asia-Pacific*). Bucket **tidak perlu
   publik**: foto disajikan backend lewat URL bertanda tangan.
2. **R2 → Manage API Tokens → Create API token**: izin *Object Read & Write*, dibatasi ke bucket
   tersebut. Catat **Access Key ID**, **Secret Access Key**, dan endpoint
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

### 8.3 Railway

1. Daftar di <https://railway.com> dengan akun GitHub → **New Project → Deploy from GitHub repo**
   → pilih `ReadQuest`. Ubah nama service pertama menjadi **`backend`** (nama ini dipakai sebagai
   hostname privat `backend.railway.internal`).
2. Service **backend** → *Settings*:
   - **Root Directory**: `backend`. `backend/railway.toml` otomatis dipakai: build Dockerfile,
     seed tiap deploy, health check `/health`, 1 instance.
   - Jangan buat domain publik. Backend hanya diakses frontend lewat jaringan privat.
3. Service **backend** → *Variables* (gunakan *Raw Editor*):

   ```env
   PORT=8000
   APP_ENV=production
   FRONTEND_ORIGIN=https://<domain-frontend>.up.railway.app
   COOKIE_SECURE=true
   FORWARDED_ALLOW_IPS=*
   MONGODB_URI=mongodb+srv://readquest:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=readquest
   JWT_SECRET=<openssl rand -base64 48>
   STORAGE_BACKEND=s3
   S3_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=readquest-photos
   S3_ACCESS_KEY=<Access Key ID R2>
   S3_SECRET_KEY=<Secret Access Key R2>
   ADMIN_PHONE=<nomor HP admin, mis. 0812xxxxxxxx>
   ADMIN_PIN=<6 angka, bukan 123456/111111>
   ADMIN_NAME=<nama admin>
   VAPID_PUBLIC_KEY=
   VAPID_PRIVATE_KEY=
   VAPID_SUBJECT=mailto:<email admin>
   ```

   `FRONTEND_ORIGIN` diisi setelah langkah 5. Backend boleh gagal start sebelum itu.
   `FORWARDED_ALLOW_IPS=*` aman karena backend tidak punya domain publik.
4. Tambah service kedua: **New → GitHub Repo → ReadQuest**, beri nama **`frontend`**:
   - **Root Directory**: `frontend` (memakai `frontend/railway.toml`).
   - *Variables*: `API_PROXY_TARGET=http://backend.railway.internal:8000`. Nilai ini dibaca saat
     build; setelah mengubahnya, lakukan *Redeploy*.
5. Service **frontend** → *Settings → Networking → Generate Domain*. Salin alamatnya
   (mis. `https://readquest-production.up.railway.app`) ke `FRONTEND_ORIGIN` di backend, lalu
   **Redeploy** backend.
6. Buka alamat frontend → login dengan `ADMIN_PHONE` + `ADMIN_PIN` → selesaikan onboarding →
   bagikan `https://<domain-frontend>/register` ke tim.

**Web Push (opsional)**: buat kunci VAPID dari mesin yang punya `uv` (`cd backend && uv run python
-m app.scripts.generate_vapid`) atau Docker, isi `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` di backend,
lalu redeploy.

### 8.4 Catatan

- Backend mendengarkan IPv4 **dan** IPv6 sekaligus (`python -m app.serve`), karena jaringan privat
  Railway memakai IPv6.
- Setiap push ke `main` otomatis di-deploy ulang oleh Railway. Atur di *Settings → Source* bila
  ingin deploy manual.
- **Domain sendiri** nanti: *Settings → Networking → Custom Domain* di service frontend, tambahkan
  record CNAME di DNS, lalu ubah `FRONTEND_ORIGIN`.
- **Backup**: Atlas M0 tidak punya backup otomatis. Jalankan `mongodump --uri "<MONGODB_URI>"`
  secara berkala dari komputer lain, atau naik ke tier berbayar yang punya snapshot.
- Backend tetap satu instance (`numReplicas = 1`). Lihat §7.
