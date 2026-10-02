# ReadQuest — Backend

API FastAPI (REST `/api/v1`) dengan MongoDB.
Arsitektur: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) ·
Skema: [`../docs/DATABASE.md`](../docs/DATABASE.md).

## Stack

Python 3.11+ · FastAPI · Uvicorn · PyMongo async (`AsyncMongoClient`) · Pydantic v2 +
pydantic-settings · PyJWT · argon2-cffi · boto3 (S3) · Pillow · pytest · ruff ·
[uv](https://docs.astral.sh/uv/)

## Menjalankan

```bash
# dari root repo: MongoDB (replica set) + RustFS
docker compose up -d

cd backend
cp .env.example .env          # isi JWT_SECRET, ADMIN_PHONE/ADMIN_PIN
uv sync
uv run python -m app.seed     # index + data awal (aman dijalankan berulang)
uv run uvicorn app.main:app --reload --port 8000
```

Dokumentasi API interaktif: http://localhost:8000/docs (non-production).

**Web Push**: buat kunci VAPID sekali lalu salin ke `.env` (jangan commit private key):

```bash
uv run python -m app.scripts.generate_vapid
```

Scheduler notifikasi berjalan di dalam proses API (`SCHEDULER_ENABLED=true`, default).

**Docker**: `docker build -t readquest-backend backend` (dari root repo) menghasilkan image
production (user non-root, `APP_ENV=production`, health check `/health`). Di container, API
dijalankan dengan `python -m app.serve`, yang membuka soket dual-stack IPv4+IPv6 di `$PORT`
(default 8000). Stack lengkap ada di
[`../deploy/`](../deploy) dan [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Test & Lint

```bash
uv run pytest -q              # butuh MongoDB lokal; memakai database test sementara
uv run ruff check . && uv run ruff format --check .
```

## Endpoint

| Method | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v1/auth/register-options` | Daftar fungsi untuk form daftar (publik) |
| POST | `/api/v1/auth/register` | Daftar: `{name, function_id, phone, pin}` → Member |
| POST | `/api/v1/auth/login` | Login `{phone, pin}`; akun terkunci sementara setelah PIN salah berulang |
| PUT | `/api/v1/me/pin` | Ganti PIN sendiri `{current_pin, new_pin}` |
| POST | `/api/v1/auth/refresh` | Tukar refresh cookie → access token baru (rotasi) |
| POST | `/api/v1/auth/logout` | Cabut sesi & hapus cookie |
| GET / PATCH | `/api/v1/me` | Profil user saat ini |
| GET | `/api/v1/me/onboarding/options` | Pilihan fungsi, kategori, batas target harian |
| PUT | `/api/v1/me/onboarding` | Simpan fungsi, minat, target harian, zona waktu |
| GET | `/api/v1/books?q=&category_id=` | Cari katalog buku (judul/pengarang) |
| POST | `/api/v1/books` | Tambah buku (200 + buku lama bila judul & pengarang sama) |
| GET | `/api/v1/books/{id}` · `/api/v1/books/{id}/posts?cursor=` | Detail buku & diskusinya |
| POST | `/api/v1/uploads/photos` | Unggah foto (multipart, ≤ `upload.max_bytes`, EXIF dibuang) |
| GET | `/api/v1/media/{key}?exp=&sig=` | Foto privat lewat URL bertanda tangan |
| GET | `/api/v1/sessions/config` · `/api/v1/sessions/today` · `/api/v1/sessions` | Aturan sesi, status hari ini, riwayat |
| POST | `/api/v1/sessions` | Mulai sesi baca (maks. 1 sesi terbuka) |
| POST | `/api/v1/sessions/{id}/heartbeat` | `{state: active\|paused}` tiap 15 detik |
| POST | `/api/v1/sessions/{id}/finish` | Selesai + catatan wajib (divalidasi) → posting |
| POST | `/api/v1/sessions/{id}/abandon` | Batalkan sesi |
| GET | `/api/v1/feed?function_id=&book_id=&author_id=&topic=&type=&bookmarked=&cursor=` | Feed tim dengan filter |
| GET | `/api/v1/posts/{id}` | Detail posting (+ status reaksi & bookmark milik viewer) |
| PUT / DELETE | `/api/v1/posts/{id}/reaction` | `{type: like\|insightful\|inspiring}` |
| PUT / DELETE | `/api/v1/posts/{id}/bookmark` | Simpan / hapus dari tersimpan |
| GET / POST | `/api/v1/posts/{id}/comments` | Komentar berantai (`parent_id`), `mention_ids` |
| DELETE | `/api/v1/posts/{id}/comments/{cid}` | Hapus komentar sendiri (atau moderator) |
| GET | `/api/v1/posts/{id}/share-card.png` | Kartu berbagi 1080×1350 |
| POST | `/api/v1/books/{id}/discussions` | Thread diskusi buku (tanpa poin) |
| GET | `/api/v1/users?q=` | Autocomplete @mention |
| GET | `/api/v1/leaderboard?category=&period=&period_key=` | Peringkat (top 50 + posisimu, navigasi periode) |
| GET | `/api/v1/leaderboard/me?period=` | Ringkasan peringkatmu di semua kategori |
| GET | `/api/v1/me/authenticity` · `/api/v1/authenticity/users/{id}` · `/api/v1/authenticity/team` | Authenticity Index (diri sendiri / Team Lead / Admin) |
| GET | `/api/v1/me/badges` · `/api/v1/quests` | Badge dengan progres, quest aktif (hadiah otomatis) |
| GET / PUT | `/api/v1/book-of-the-month[/{book_id}]` | Book of the Month (PUT: `config.books.manage`) |
| GET / POST / DELETE | `/api/v1/buddies` · `/buddies/{id}/accept` · `/buddies/{id}/cheer` | Reading Buddy |
| WS | `/ws/rooms/{room}` | Reading Room live: pesan pertama `{type: auth, token}`, lalu presence & cheer |
| GET | `/api/v1/notifications?cursor=` · `/notifications/unread-count` | Inbox lonceng |
| POST | `/api/v1/notifications/read` | `{ids}` atau `{all: true}` |
| GET / PUT | `/api/v1/me/notification-preferences` | Jenis (push/lonceng), jam tenang, jam pengingat, frekuensi |
| GET | `/api/v1/push/config` | Kunci publik VAPID |
| POST | `/api/v1/push/subscriptions` · `/push/unsubscribe` · `/push/test` | Langganan Web Push |
| GET | `/api/v1/me/points` | Total & poin hari ini, level, streak (efektif) |
| GET | `/api/v1/me/points/history?cursor=` | Riwayat ledger poin |
| POST | `/api/v1/posts/{id}/report` · `/posts/{id}/comments/{cid}/report` | Laporkan konten ke moderasi (`{reason}`) |
| GET | `/api/v1/admin/dashboard?days=` | Dashboard admin (`admin.dashboard.view`) |
| GET | `/api/v1/admin/export.xlsx?days=` · `/admin/export.pdf?days=` | Export laporan (`admin.export`) |
| GET | `/api/v1/admin/lookups` | Daftar ringkas role/fungsi/kategori/pengguna untuk form admin |
| GET / POST | `/api/v1/admin/resources/{name}` | CRUD konfigurasi: `functions`, `roles`, `point-rules`, `badges`, `quests`, `levels`, `book-categories`, `notification-templates` |
| PUT / DELETE | `/api/v1/admin/resources/{name}/{id}` | Ubah / hapus (data terpakai ditolak — nonaktifkan saja) |
| GET | `/api/v1/admin/permissions` | Katalog permission untuk matriks RBAC |
| GET / PUT | `/api/v1/admin/settings[/{key}]` | Pengaturan aplikasi tervalidasi (`{value}`) |
| GET / PUT | `/api/v1/admin/users[/{id}]` | Daftar pengguna, ubah role/fungsi/status |
| PUT | `/api/v1/admin/users/{id}/pin` | Reset PIN pengguna (buka kunci, cabut semua sesi) |
| PUT | `/api/v1/admin/books/{id}` | Koreksi info buku (posting ikut diperbarui) |
| GET | `/api/v1/admin/moderation?status=flagged\|hidden` | Antrean moderasi |
| POST | `/api/v1/admin/moderation/{posts\|comments}/{id}` | `{action: hide\|restore\|dismiss, reason, reverse_points}` |
| GET | `/api/v1/admin/audit?entity_type=&action=&cursor=` | Audit log |
| GET | `/health` | Health check (termasuk ping MongoDB) |

Error selalu berbentuk `{"error": {"code", "message", "fields?"}}`.

## Struktur Folder

| Folder | Isi |
|--------|-----|
| `app/api/` | `deps.py` (auth & `require_permission`) + router per versi (`v1/`) |
| `app/core/` | konfigurasi `.env`, koneksi MongoDB, keamanan (JWT, argon2), error, rate limit, `middleware` (header keamanan, batas ukuran body), `clock` (waktu, mudah di-mock), `storage` (S3/lokal), `media` (URL bertanda tangan), `images` (Pillow) |
| `app/schemas/` | DTO request/response (Pydantic) |
| `app/services/` | logika bisnis (auth, onboarding, buku, sesi baca, validasi catatan, posting, upload) |
| `app/repositories/` | akses MongoDB + definisi index semua koleksi (`indexes.py`) |
| `app/seed/` | data awal & script seed (`python -m app.seed`) |
| `app/ws/` | WebSocket Reading Room |
| `app/jobs/` | scheduler (tick per menit + lease) dan job notifikasi terjadwal |
| `app/scripts/` | utilitas CLI (mis. `generate_vapid`) |
| `app/assets/` | font Nunito (OFL) untuk kartu berbagi & export PDF |
| `tests/` | pytest (integrasi API terhadap MongoDB sungguhan) |

## Konvensi

- Alur dependensi: `api` / `ws` / `jobs` → `services` → `repositories`.
- Nilai bisnis (poin, batas, threshold) dibaca dari database (`app_settings`, `point_rules`),
  bukan konstanta di kode. `app/seed/data.py` hanya berisi nilai awal.
- Poin hanya ditulis lewat service ledger (append-only).
- Endpoint yang butuh izin khusus memakai `Depends(require_permission("<kode>"))`.
