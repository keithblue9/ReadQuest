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
- PWA: bisa dipasang ke layar utama, layar offline, pembaruan versi dengan satu ketukan

## Tech Stack

Next.js (PWA) · FastAPI · MongoDB · JWT · WebSocket

## Struktur Repo

```
frontend/            Next.js PWA
backend/             FastAPI
docs/                spesifikasi, arsitektur, skema database, deployment
docker-compose.yml   MongoDB + RustFS untuk pengembangan lokal
deploy/              stack production (Docker Compose + Caddy HTTPS)
```

## Menjalankan Secara Lokal

```bash
cp .env.example .env                 # kredensial object storage
docker compose up -d                 # MongoDB (replica set) + RustFS

cd backend && cp .env.example .env   # isi ADMIN_EMAIL, ADMIN_PASSWORD, SEED_INVITE_CODE
uv sync && uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000

cd ../frontend && cp .env.example .env.local
npm install && npm run dev           # buka http://localhost:3000
```

Daftar di `/register` memakai kode undangan dari `SEED_INVITE_CODE` (atau kode yang dicetak
oleh seed). Detail: [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md).

## Deployment Production

```bash
cd deploy && cp .env.example .env    # DOMAIN, JWT_SECRET, kredensial S3, admin pertama
docker compose up -d --build
docker compose --profile tools run --rm seed
```

Panduan lengkap (HTTPS, backup, update, checklist keamanan): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Status

Semua fase (0–10) dalam [`docs/SPEC.md`](docs/SPEC.md) sudah selesai:
- Autentikasi & onboarding.
- Sesi baca dengan timer + catatan wajib yang divalidasi.
- Katalog buku & unggah foto.
- Poin berbasis ledger dengan streak & level.
- Feed sosial.
- Leaderboard lima kategori.
- Authenticity Index & gamifikasi (badge, quest, Book of the Month, Reading Buddy, Reading Room live).
- Notifikasi Web Push & in-app.
- Admin dashboard & Admin Config data-driven dengan audit log.
- PWA polish (offline, instal, pembaruan versi).
- Hardening keamanan & deployment Docker.

SSO (OIDC) masih opsional dan belum diimplementasikan; login memakai email/password.

## Dokumentasi

- [Spesifikasi lengkap](docs/SPEC.md)
- [Arsitektur](docs/ARCHITECTURE.md)
- [Skema database](docs/DATABASE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Konteks & aturan kerja](CLAUDE.md)
