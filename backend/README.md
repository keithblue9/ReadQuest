# ReadQuest — Backend

API FastAPI (REST `/api/v1` + WebSocket `/ws`) dengan MongoDB.
Arsitektur: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) ·
Skema: [`../docs/DATABASE.md`](../docs/DATABASE.md).

> **Status:** kerangka folder saja (Fase 1). Proyek Python (`pyproject.toml`, `main.py`)
> di-scaffold di awal Fase 2.

## Rencana Stack

Python 3.12 · FastAPI · Uvicorn · Motor (MongoDB async) · Pydantic v2 + pydantic-settings ·
PyJWT · argon2-cffi · boto3 (S3-compatible) · pywebpush · APScheduler · pytest

## Struktur Folder

| Folder | Isi |
|--------|-----|
| `app/api/` | router FastAPI per domain (`auth`, `sessions`, `posts`, `books`, `leaderboard`, `admin`, …) + dependency auth/permission |
| `app/core/` | konfigurasi dari `.env`, keamanan (JWT, hashing), koneksi MongoDB, logging |
| `app/models/` | model dokumen MongoDB (Pydantic), sesuai `docs/DATABASE.md` |
| `app/schemas/` | DTO request/response API |
| `app/services/` | logika bisnis: validasi catatan, poin/ledger, streak, leaderboard, notifikasi, authenticity |
| `app/repositories/` | akses data MongoDB (query + pembuatan index), tanpa logika bisnis |
| `app/ws/` | handler WebSocket (Reading Room, notifikasi realtime) |
| `app/jobs/` | job terjadwal APScheduler (pengingat, streak, snapshot leaderboard, authenticity) |
| `tests/` | pytest (unit untuk services, integrasi untuk API) |

## Konvensi

- Alur dependensi: `api` / `ws` / `jobs` → `services` → `repositories`.
- Nilai bisnis (poin, batas, threshold) dibaca dari database, bukan konstanta di kode.
- Poin hanya ditulis lewat service ledger (append-only).
- Setiap endpoint memakai dependency permission (RBAC).

## Konfigurasi

Salin `.env.example` → `.env`, lalu isi nilainya. Layanan pendukung (MongoDB, MinIO)
dijalankan dari root repo dengan `docker compose up -d`.
