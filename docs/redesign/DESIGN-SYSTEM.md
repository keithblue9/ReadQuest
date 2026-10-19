# ReadQuest Design System — "Stabilo"

Jurnal baca yang tenang dan dewasa. Satu elemen berani: **stabilo kuning** — dipakai untuk progres, item navigasi aktif, dan kutipan yang ditandai. Semua elemen lain tenang: tinta biru tua di atas kertas abu terang.

Sumber tunggal: `frontend/src/app/globals.css` (CSS variables → Tailwind v4 `@theme inline`).

## Warna

| Token | Terang | Gelap | Pemakaian | Kontras vs surface (terang / gelap), dihitung WCAG |
|---|---|---|---|---|
| `--paper` | `#F6F7F9` | `#121830` | Latar halaman | — |
| `--surface` | `#FFFFFF` | `#1A2140` | Kartu, panel | — |
| `--surface-muted` | `#EEF0F4` | `#232B4D` | Input, chip, hover | — |
| `--ink` | `#1B2340` | `#ECEEF6` | Teks utama, tombol utama (terang) | 15.4 / 13.6 |
| `--muted` | `#555C72` | `#A9AFC6` | Teks sekunder | 6.6 / 7.2 |
| `--line` | `#E1E4EB` | `#2A3256` | Garis, border | — |
| `--highlight` | `#FFE066` | `#F5D547` | Stabilo: progres, aktif, `<mark>` | (latar) |
| `--on-highlight` | `#1B2340` | `#121830` | Teks di atas stabilo | 11.8 / 12.1 |
| `--leaf` | `#2A6E50` | `#6CCB9C` | Sukses, target tercapai | 6.1 / 8.0 |
| `--danger` | `#B42318` | `#F59A8E` | Error, hapus | 6.6 / 7.4 |
| `--rating` | `#946200` | `#F5C84C` | Bintang rating, streak | 5.2 / 9.9 |
| `--brand-accent` | dari Admin, dikunci ≥4.5:1 | sama, versi gelap | Tile logo, tautan | ≥4.5 |

Tombol utama: terang = `ink` dengan teks `paper`; gelap = `highlight` dengan teks `on-highlight`.

Nama lama (`--primary`, `--foreground`, `--border`, `--background`, `--accent`, `--success`, `--warning`) tetap ada sebagai alias agar halaman yang belum disentuh tetap konsisten.

## Tipografi

- **Literata** (serif untuk layar baca): judul halaman, headline Today hero, isi catatan baca, kutipan. `font-display`.
- **Plus Jakarta Sans** (dibuat di Jakarta): seluruh UI. `font-sans`.
- Self-hosted lewat `next/font/local` (woff2 variable, lisensi OFL di `src/fonts/OFL.txt`). Tidak ada request ke Google; CSP tidak berubah.

| Peran | Ukuran / tinggi baris | Berat | Font |
|---|---|---|---|
| Display (hero) | 28/34 (HP), 32/38 (desktop) | 600 | Literata |
| H1 halaman | 24/30 | 600 | Literata |
| H2 kartu | 17/24 | 700 | Jakarta |
| Body | 15/24 | 400 | Jakarta |
| Catatan baca | 16/27 | 400 | Literata |
| Small / meta | 13/18 | 500 | Jakarta |
| Minimum | 12px | — | — |

## Bentuk, ruang, bayangan

- Radius: `sm 8px` (chip, input kecil), `md 12px` (tombol, input), `lg 16px` (kartu), `full` (avatar, pill). Hierarki: makin besar wadah, makin besar radius — bukan satu radius untuk semua.
- Spacing dasar 4px; kartu padding 16px (HP) / 20px (desktop); jarak antar kartu 12–16px.
- Bayangan: hanya kartu di atas foto/sticky header (`0 1px 2px rgb(27 35 64 / .06)`); mode gelap tanpa bayangan, pakai border.

## Motion

- Durasi: 120ms (hover/press), 220ms (masuk elemen), 600ms (isi stabilo progres).
- Kurva: `cubic-bezier(.2,.7,.2,1)`.
- Hanya satu momen orkestrasi: stabilo progres "digoreskan" saat Today hero tampil, dan perayaan setelah sesi selesai.
- Semua animasi di dalam `@media (prefers-reduced-motion: no-preference)`.

## Komponen inti (`components/`)

| Komponen | State | Catatan |
|---|---|---|
| `Button` (`primary`, `secondary`, `ghost`, `danger`; `md`, `sm`) | hover, focus-visible, active (scale .98), disabled, loading (spinner + `aria-busy`) | Tinggi ≥44px (md) |
| `Field` / `PinField` | focus, error (`aria-invalid` + pesan), hint, disabled | Label selalu terlihat |
| `Tabs` | aktif (stabilo bawah), hover, focus-visible; panah kiri/kanan | `role="tablist"` berisi tab saja |
| `Marker` | 0–100%, tercapai (warna leaf di label) | `role="progressbar"` + `aria-valuenow` |
| `Skeleton` | — | Tinggi tetap → CLS ≈ 0 |
| `EmptyState` | ikon, judul, penjelasan, aksi | Selalu mengarahkan ke aksi |
| `Avatar` | gambar / inisial | Dimensi eksplisit |
| `BookCover` | gambar / sampul generatif (warna dari judul) | Rasio 2:3 tetap |

## Pemakaian

- Teks di atas `highlight` selalu `on-highlight`.
- Satu stabilo per layar sebagai fokus utama; jangan menandai semuanya.
- Warna rating/streak pakai `rating`, bukan amber Tailwind.
- Halaman punya tepat satu `<h1>` (Literata).
- Jangan pakai emoji di judul/navigasi; pakai ikon lucide berlabel.
