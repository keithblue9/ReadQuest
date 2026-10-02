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
cp .env.example .env          # isi JWT_SECRET, ADMIN_EMAIL/ADMIN_PASSWORD, SEED_INVITE_CODE
uv sync
uv run python -m app.seed     # index + data awal (aman dijalankan berulang)
uv run uvicorn app.main:app --reload --port 8000
```

Dokumentasi API interaktif: http://localhost:8000/docs (non-production).

## Test & Lint

```bash
uv run pytest -q              # butuh MongoDB lokal; memakai database test sementara
uv run ruff check . && uv run ruff format --check .
```

## Endpoint

| Method | Path | Keterangan |
|--------|------|------------|
| POST | `/api/v1/auth/register` | Daftar dengan kode undangan |
| POST | `/api/v1/auth/login` | Login email/password |
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
| GET | `/api/v1/me/points` | Total & poin hari ini, level, streak (efektif) |
| GET | `/api/v1/me/points/history?cursor=` | Riwayat ledger poin |
| GET | `/health` | Health check (termasuk ping MongoDB) |

Error selalu berbentuk `{"error": {"code", "message", "fields?"}}`.

## Struktur Folder

| Folder | Isi |
|--------|-----|
| `app/api/` | `deps.py` (auth & `require_permission`) + router per versi (`v1/`) |
| `app/core/` | konfigurasi `.env`, koneksi MongoDB, keamanan (JWT, argon2), error, rate limit, `clock` (waktu, mudah di-mock), `storage` (S3/lokal), `media` (URL bertanda tangan), `images` (Pillow) |
| `app/schemas/` | DTO request/response (Pydantic) |
| `app/services/` | logika bisnis (auth, onboarding, buku, sesi baca, validasi catatan, posting, upload) |
| `app/repositories/` | akses MongoDB + definisi index semua koleksi (`indexes.py`) |
| `app/seed/` | data awal & script seed (`python -m app.seed`) |
| `app/models/`, `app/ws/`, `app/jobs/` | disiapkan untuk fase berikutnya |
| `tests/` | pytest (integrasi API terhadap MongoDB sungguhan) |

## Konvensi

- Alur dependensi: `api` / `ws` / `jobs` → `services` → `repositories`.
- Nilai bisnis (poin, batas, threshold) dibaca dari database (`app_settings`, `point_rules`),
  bukan konstanta di kode. `app/seed/data.py` hanya berisi nilai awal.
- Poin hanya ditulis lewat service ledger (append-only).
- Endpoint yang butuh izin khusus memakai `Depends(require_permission("<kode>"))`.
