# CLAUDE.md — Konteks Proyek ReadQuest

## Tujuan Aplikasi

ReadQuest adalah PWA komunitas baca buku bergamifikasi untuk satu tim, terinspirasi
program ReadSG Singapura: anggota membaca minimal 15 menit/hari, menulis catatan,
berinteraksi di feed, dan mendapatkan poin, badge, serta peringkat.

Spesifikasi lengkap: [`docs/SPEC.md`](docs/SPEC.md) — **sumber kebenaran**. Baca sebelum
mengerjakan fitur apa pun.

## Tech Stack

- **Frontend:** Next.js (PWA, mobile-first, dark mode)
- **Backend:** FastAPI (JWT auth, WebSocket)
- **Database:** MongoDB
- **Lainnya:** Web Push (VAPID), object storage untuk foto buku

## Aturan Kerja

1. **Kerja per fase** sesuai daftar di bawah; jangan melompat ke fase berikutnya
   tanpa persetujuan.
2. **Satu branch + satu PR per fitur/fase.**
3. **Jangan commit secret** (API key, password, VAPID private key, kredensial DB).
4. **Gunakan `.env`** untuk konfigurasi; commit hanya `.env.example` berisi placeholder.
5. Konfigurasi bisnis (aturan poin, batas harian, role/permission, threshold
   Authenticity Index, badge/quest/level) bersifat **data-driven**, bukan hardcode.
6. Poin selalu lewat **ledger** (append-only), jangan mengubah saldo secara langsung.
7. Jelaskan **keputusan desain** secara singkat sebelum menulis kode.

## Daftar Fase

| Fase | Cakupan |
|------|---------|
| 0 | Fondasi dokumentasi (SPEC, CLAUDE.md, .gitignore, README) |
| 1 | Arsitektur, skema database, struktur folder |
| 2 | MVP: Auth & onboarding |
| 3 | MVP: Reading session + info buku/katalog |
| 4 | MVP: Sistem poin (ledger) |
| 5 | MVP: Feed sosial |
| 6 | MVP: Leaderboard |
| 7 | Authenticity Index & gamifikasi lanjutan (level, badge, quest, Reading Room) |
| 8 | Notifikasi (Web Push & in-app) |
| 9 | Admin dashboard & Admin Config (RBAC, audit log, export) |
| 10 | PWA polish, hardening, deployment |
