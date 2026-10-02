# ReadQuest — Frontend

PWA Next.js 16 (App Router, TypeScript) yang mobile-first dengan dark mode.
Arsitektur: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

> Next.js 16 punya perubahan besar dibanding versi lama (mis. `middleware` → `proxy`).
> Lihat `AGENTS.md` dan dokumentasi di `node_modules/next/dist/docs/`.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · next-themes · Vitest

## Menjalankan

```bash
cd frontend
cp .env.example .env.local    # API_PROXY_TARGET=http://localhost:8000
npm install
npm run dev                   # http://localhost:3000 (backend harus jalan di :8000)
```

Browser hanya memanggil `/api/*` di origin Next.js; `next.config.ts` meneruskannya ke FastAPI.

## Cek Kualitas

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Struktur Folder

| Folder | Isi |
|--------|-----|
| `src/app/(auth)/` | `/login`, `/register` (hanya untuk tamu) |
| `src/app/(app)/` | halaman yang butuh login: `/` (beranda), `/onboarding`; guard di `layout.tsx` |
| `src/app/manifest.ts` | Web App Manifest (PWA) |
| `src/components/` | komponen UI generik (`ui.tsx`, `ThemeToggle`, `ThemeProvider`) |
| `src/features/` | modul per fitur (`auth/AuthProvider`, `onboarding/`) |
| `src/lib/` | klien API (`api.ts`), tipe, helper error & platform |
| `src/hooks/`, `src/styles/` | disiapkan untuk fase berikutnya |
| `public/icons/` | ikon PWA & apple-touch-icon |

## Konvensi

- Panggilan backend hanya lewat `src/lib/api.ts` (otomatis refresh token saat 401).
- Access token hanya di memori; refresh token di cookie httpOnly (dikelola browser).
- Warna memakai token tema (`bg-surface`, `text-muted`, `bg-primary`, …) dari `globals.css`
  agar dark mode konsisten.
- Tidak ada secret di frontend; hanya variabel `NEXT_PUBLIC_*` yang terlihat di browser.
