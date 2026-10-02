# ReadQuest

Aplikasi komunitas baca buku bergamifikasi (PWA) untuk satu tim, terinspirasi
program **ReadSG** Singapura: baca minimal 15 menit per hari, tulis catatan,
berbagi insight, dan kumpulkan poin.

## Fitur Utama

- Reading session dengan timer (min. 15 menit) dan catatan wajib
  (Quick Note, Chapter Story, Book Review)
- Sistem poin berbasis ledger, streak, level, badge, dan weekly quest
- Feed sosial: reaksi, komentar, mention, bookmark, diskusi per buku
- Leaderboard individu & Battle Antar-Fungsi
- Reading Authenticity Index
- Notifikasi Web Push & in-app
- Admin dashboard & konfigurasi data-driven (RBAC, aturan poin, audit log)

## Tech Stack

Next.js (PWA) · FastAPI · MongoDB · JWT · WebSocket

## Struktur Repo

```
frontend/            Next.js PWA
backend/             FastAPI
docs/                spesifikasi, arsitektur, skema database
docker-compose.yml   MongoDB + MinIO untuk pengembangan lokal
```

## Menjalankan Secara Lokal

```bash
cp .env.example .env                 # kredensial MinIO
docker compose up -d                 # MongoDB (replica set) + MinIO

cd backend && cp .env.example .env   # isi ADMIN_EMAIL, ADMIN_PASSWORD, SEED_INVITE_CODE
uv sync && uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000

cd ../frontend && cp .env.example .env.local
npm install && npm run dev           # buka http://localhost:3000
```

Daftar di `/register` memakai kode undangan dari `SEED_INVITE_CODE` (atau kode yang dicetak
oleh seed). Detail: [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md).

## Status

Fase 2 selesai: autentikasi (daftar dengan kode undangan, login, refresh token), onboarding
(fungsi, minat, target harian, panduan Add to Home Screen iOS), seed data, dan CI.
Berikutnya: Fase 3 — sesi baca & katalog buku.

## Dokumentasi

- [Spesifikasi lengkap](docs/SPEC.md)
- [Arsitektur](docs/ARCHITECTURE.md)
- [Skema database](docs/DATABASE.md)
- [Konteks & aturan kerja](CLAUDE.md)
