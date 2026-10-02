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
docker-compose.yml   MongoDB + RustFS untuk pengembangan lokal
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

## Status

Selesai: autentikasi & onboarding (Fase 2), sesi baca dengan timer + catatan wajib yang
divalidasi, katalog buku bersama, dan unggah foto (Fase 3), sistem poin berbasis ledger dengan
streak & level (Fase 4), feed sosial dengan reaksi, komentar berantai, mention, bookmark, kartu
berbagi, dan diskusi per buku (Fase 5), leaderboard lima kategori dengan periode mingguan/
bulanan/sepanjang masa (Fase 6), Authenticity Index, badge, weekly quest, Book of the Month,
Reading Buddy, dan Reading Room live via WebSocket (Fase 7), notifikasi Web Push & lonceng in-app
dengan preferensi, jam tenang, batching, dan pengingat terjadwal (Fase 8), Admin dashboard
(heatmap per fungsi, daftar Observer, export Excel/PDF) dan Admin Config data-driven — fungsi
bertingkat, matriks role/permission, aturan poin, badge/quest/level, katalog, jadwal & template
notifikasi, pengaturan, kode undangan, moderasi laporan, dan audit log (Fase 9). Berikutnya:
Fase 10 — PWA polish, hardening, deployment.

## Dokumentasi

- [Spesifikasi lengkap](docs/SPEC.md)
- [Arsitektur](docs/ARCHITECTURE.md)
- [Skema database](docs/DATABASE.md)
- [Konteks & aturan kerja](CLAUDE.md)
