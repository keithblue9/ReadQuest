# ReadQuest — Frontend

PWA Next.js (App Router, TypeScript) yang mobile-first, mendukung dark mode, dan memakai
mikro-animasi. Arsitektur lengkap: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

> **Status:** kerangka folder saja (Fase 1). Proyek Next.js di-scaffold di awal Fase 2.

## Rencana Stack

Next.js (App Router) · TypeScript · Tailwind CSS · next-themes · Framer Motion ·
canvas-confetti · Serwist (service worker / PWA) · klien API dari OpenAPI backend

## Struktur Folder

| Folder | Isi |
|--------|-----|
| `public/` | aset statis: ikon PWA, `manifest.webmanifest`, gambar |
| `src/app/` | route App Router (`(auth)`, `(main)/feed`, `session`, `leaderboard`, `books/[id]`, `admin`, …) + layout |
| `src/components/` | komponen UI generik yang dapat dipakai ulang (Button, Card, Modal, …) |
| `src/features/` | modul per fitur (`auth`, `session`, `feed`, `leaderboard`, `books`, `notifications`, `admin`): komponen + hooks + panggilan API khusus fitur |
| `src/lib/` | utilitas: klien API, klien WebSocket, kompresi & strip EXIF foto, helper auth |
| `src/hooks/` | hooks lintas fitur (idle detection, online status, theme) |
| `src/styles/` | CSS global & token tema Tailwind |

## Konvensi

- Komponen dalam PascalCase; hooks diawali `use`.
- Panggilan ke backend hanya lewat `src/lib/` (tidak memanggil `fetch` langsung dari komponen).
- Tidak ada secret di frontend. Hanya variabel `NEXT_PUBLIC_*` (lihat `.env.example`).

## Konfigurasi

Salin `.env.example` → `.env.local`, lalu isi nilainya.
