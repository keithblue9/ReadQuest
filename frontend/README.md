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
`API_PROXY_TARGET` dibaca saat `next build` (rewrites ikut tersimpan di hasil build).
Di Vercel, WebSocket tidak diteruskan rewrite: isi `NEXT_PUBLIC_WS_URL` (mis.
`wss://readquest-api.onrender.com`) agar Reading Room terhubung langsung ke backend.

Produksi lokal: `npm run build && npm start`. Image Docker (`Dockerfile`, output `standalone`):
`docker build -t readquest-frontend --build-arg API_PROXY_TARGET=http://backend:8000 frontend`.
Lihat [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Cek Kualitas

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Struktur Folder

| Folder | Isi |
|--------|-----|
| `src/app/(auth)/` | `/login`, `/register` (hanya untuk tamu) |
| `src/app/(app)/` | halaman yang butuh login (guard di `layout.tsx`): `/onboarding`, `/read` (sesi baca layar penuh) |
| `src/app/(app)/(main)/` | halaman dengan navigasi bawah (`AppShell`): `/` (beranda), `/feed`, `/posts/[id]`, `/leaderboard`, `/books`, `/books/[id]`, `/profile`, `/quests`, `/buddy`, `/room`, `/team`, `/notifications`, `/settings/notifications` |
| `src/app/(app)/admin/` | panel Admin (sidebar sesuai permission): dashboard, pengguna, fungsi, role & akses, aturan poin, gamifikasi, katalog, notifikasi, pengaturan, moderasi, audit log |
| `src/app/manifest.ts` | Web App Manifest (PWA) |
| `src/components/` | komponen UI generik (`ui.tsx`, `AppShell`, `BookCover`, `PostCard`, `PhotoPicker`, tema) |
| `src/features/` | modul per fitur: `auth/`, `onboarding/`, `books/`, `reading/` (timer, catatan, perayaan), `feed/` (reaksi, komentar, @mention, share sheet, diskusi), `room/` (WebSocket Reading Room), `quests/`, `authenticity/`, `home/`, `admin/` (`ResourceManager` CRUD generik, grafik dashboard, lookups), `pwa/` (registrasi & pembaruan service worker, prompt instal) |
| `src/lib/` | klien API (`api.ts`), tipe, kompresi foto (`image.ts`), hitung kata (`words.ts`), helper error & platform |
| `src/hooks/` | hook umum (`useOnline`) |
| `src/app/offline/`, `not-found.tsx`, `error.tsx`, `global-error.tsx` | halaman offline (fallback service worker) & halaman error |
| `src/app/fonts/` | Nunito variable font (subset latin, OFL) via `next/font/local` |
| `public/icons/` | ikon PWA & apple-touch-icon |
| `public/sw.js` | service worker ditulis manual: cache aset + fallback offline, Web Push, klik notifikasi. Naikkan `VERSION` setiap kali diubah |

## Konvensi

- Panggilan backend hanya lewat `src/lib/api.ts` (otomatis refresh token saat 401).
- Access token hanya di memori; refresh token di cookie httpOnly (dikelola browser).
- Warna memakai token tema (`bg-surface`, `text-muted`, `bg-primary`, …) dari `globals.css`
  agar dark mode konsisten.
- Tidak ada secret di frontend; hanya variabel `NEXT_PUBLIC_*` yang terlihat di browser.
