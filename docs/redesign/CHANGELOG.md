# Changelog — Redesign "Stabilo" (branch `redesign/stabilo`)

Tanpa perubahan API, skema database, atau backend. Semua perubahan di `frontend/` dan `docs/`.

## Sistem desain
- Token tunggal di `src/app/globals.css`: kertas `#F6F7F9`, tinta `#1B2340`, stabilo `#FFE066`, daun `#2A6E50`; mode gelap tersendiri (bukan inversi), semua teks ≥4.5:1 (lihat `DESIGN-SYSTEM.md`).
- Nama token lama tetap ada sebagai alias, di-resolve ulang per kontainer bertema.
- Font Literata (judul, catatan baca) + Plus Jakarta Sans (UI), dihosting sendiri lewat `next/font/local` (lisensi OFL). Tanpa request ke pihak ketiga; CSP tidak berubah.
- Warna merek dari Admin hanya mewarnai aksen dan otomatis dikoreksi ke ≥4.5:1 (`lib/color.ts`).
- Komponen inti: `Button` (4 varian, 2 ukuran, semua state), `Field`, `Tabs` (roving tabindex), `Skeleton`, `EmptyState`, `ProgressBar` gaya goresan stabilo, sampul buku generatif, ring fokus global.

## UX
- Beranda: **Today hero** — sisa menit hari ini, progres, streak, satu CTA "Lanjut baca <buku terakhir>" yang langsung ke konfirmasi buku (satu langkah lebih sedikit). Strip rekan yang sudah membaca. Feed bergaya jurnal (catatan dalam serif).
- Bottom nav HP: tombol **Sesi Baca** di tengah; FAB dihapus (tidak lagi menutupi konten).
- Peringkat: podium bergaya punggung buku; bar "Posisimu" menampilkan selisih ke peringkat di atas.
- Grafik: sumbu Y + gridline samar, label tanggal, tooltip, tampilan tabel; heatmap satu hue.
- Keadaan kosong & loading: `EmptyState` yang mengarahkan ke aksi, skeleton setinggi konten.
- Emoji dekoratif dihapus dari judul/copy; emoji-sebagai-ikon diganti ikon lucide berlabel. Emoji reaksi, ikon badge/kategori (data Admin) dipertahankan.
- Admin: ikon lucide, sidebar setinggi layar, judul halaman konsisten.

## Perbaikan bug & aksesibilitas
- Nama di header profil HP tidak lagi terpotong jadi satu huruf.
- `/team`: member melihat penjelasan, bukan error 403 mentah.
- `<select>` dikeluarkan dari `role="tablist"` (axe critical).
- Kontras: bintang rating, tab aktif, badge terkunci, pill sukses kini ≥4.5:1.
- Target sentuh ≥44px pada kontrol kecil; teks minimum 12px; satu `<h1>` per halaman; area gulir bisa difokus keyboard.
- CLS: placeholder dengan tinggi terukur di Beranda, Statistik, Profil, daftar Admin.

## Tes
- Baru: `lib/color.test.ts`, `lib/today.test.ts`, `lib/chart.test.ts`; diperbarui: `features/navigation/menu.test.ts`. Total 42 tes (sebelumnya 27).
