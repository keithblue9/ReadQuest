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

## Menjalankan Layanan Lokal

```bash
cp .env.example .env     # isi kredensial MinIO
docker compose up -d     # MongoDB (replica set) + MinIO
```

## Status

Fase 1 selesai: arsitektur, skema database, dan kerangka folder. Kode aplikasi dimulai
di Fase 2.

## Dokumentasi

- [Spesifikasi lengkap](docs/SPEC.md)
- [Arsitektur](docs/ARCHITECTURE.md)
- [Skema database](docs/DATABASE.md)
- [Konteks & aturan kerja](CLAUDE.md)
