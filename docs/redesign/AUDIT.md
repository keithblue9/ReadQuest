# ReadQuest — Audit UI/UX & Kualitas (19 Okt 2026)

## Ringkasan

1. Fondasi kode sehat: lint, typecheck, 27 tes frontend, dan build (35 rute) lolos.
2. Keamanan dasar baik: CSP + security headers, access token hanya di memori, refresh token httpOnly SameSite=Strict, CORS satu origin, rate limit di endpoint sensitif.
3. Masalah terbesar ada di UX/UI: identitas visual generik, aksi utama (baca 15 menit) tidak dominan, FAB menutupi konten di HP, nama profil terpotong.
4. Aksesibilitas: 94 node gagal kontras (axe *serious*), `<select>` di dalam `role="tablist"` (*critical*), banyak halaman tanpa `<h1>`.
5. Performa cepat (LCP lokal < 750ms), tetapi CLS buruk di Beranda HP (0.226), Profil HP (0.144), Admin Gamifikasi (0.352).

## Metode

- Live app (`read-quest-ecru.vercel.app`) tidak bisa dimuat dari lingkungan audit, jadi audit memakai **build produksi dari `main` (7570fbe)** yang dijalankan lokal dengan backend asli dan data demo (8 anggota, 6 buku, 45 sesi baca, reaksi & komentar). Database: mongomock in-memory (khusus audit, tidak masuk repo).
- 30 rute × 2 viewport (desktop 1440×900, HP 390×844 @2x), mode terang, `prefers-reduced-motion: reduce`.
- Per rute: screenshot full-page, error console + HTTP ≥400, LCP & CLS (PerformanceObserver), axe-core 4.11 (WCAG 2.0/2.1 A/AA + best-practice).
- Statis: lint, typecheck, Vitest, `next build`, grep pola UI/a11y, review konfigurasi keamanan.

## Temuan

Status: **open** / **fixed** / **deferred** (dengan alasan). Diperbarui di akhir redesign.

| # | Area | Masalah | Dampak | Keparahan | Solusi | Usaha | Status |
|---|---|---|---|---|---|---|---|
| 1 | UX/UI | Identitas visual generik (palet "ala Facebook", font sistem, emoji di judul) | App tidak punya karakter, terasa template | High | Sistem desain Stabilo: token tunggal, Literata + Plus Jakarta Sans, aksen stabilo | L | fixed — sistem desain Stabilo (DESIGN-SYSTEM.md) |
| 2 | UX | Beranda HP: composer di atas, target harian tertimbun; CTA "baca" bersaing dengan 3 tombol | Aksi inti tidak terlihat dalam 3 detik | High | Today hero: sisa menit + progres + satu CTA "Lanjut baca <buku>" | M | fixed — Today hero + CTA lanjut baca |
| 3 | UX/Bug | FAB "+" menutupi progres quest, bar "Posisimu", grafik di HP | Konten penting tertutup | High | Hapus FAB; tombol "Baca" di tengah bottom nav | S | fixed — FAB dihapus, Sesi baca di tengah bottom nav |
| 4 | Bug | Header profil HP: nama terpotong jadi 1 huruf karena berbagi baris dengan tombol | Nama pengguna tidak terbaca | High | Nama baris penuh di HP, aksi di bawah | S | fixed |
| 5 | A11y | 94 node gagal kontras: bintang rating amber di putih (2.14:1), tab aktif (4.48:1), badge terkunci ber-opacity (3:1), pill sukses (4.09:1) | Sulit dibaca, gagal WCAG AA | High | Token warna diverifikasi ≥4.5:1; badge terkunci tanpa opacity | M | fixed — axe serious/critical 141 → 2 node (terang) |
| 6 | A11y | `<select>` di dalam `role="tablist"` (Beranda/feed) | Pembaca layar salah membaca struktur (axe critical) | High | Select dipindah keluar tablist; komponen `Tabs` bersama | S | fixed |
| 7 | Performa | CLS: Beranda HP 0.226, Profil HP 0.144, Stats desktop 0.192, Admin Gamifikasi 0.352, Katalog 0.16 | Konten melompat saat data masuk | High | Skeleton dengan tinggi tetap, rasio gambar tetap | M | fixed — 0 rute dengan CLS > 0.1 |
| 8 | UX/Bug | `/team` bisa dibuka member → error 403 mentah | Membingungkan | Medium | Cek permission di klien, tampilkan state "khusus Team Lead/Admin" | S | fixed |
| 9 | A11y | 30 halaman tanpa `<h1>`, 19 konten di luar landmark, landmark duplikat | Navigasi pembaca layar buruk | Medium | Satu `<h1>` per halaman, label landmark unik | S | fixed |
| 10 | A11y | 28 `outline-none` vs 11 `focus-visible`; fokus keyboard hilang di input/tombol | Pengguna keyboard tersesat | Medium | Ring fokus global dari token | S | fixed — ring fokus global + `@layer components` |
| 11 | A11y | Teks 10–11px (label bottom nav, statistik profil, label grafik) | Sulit dibaca di HP | Medium | Minimal 12px | S | fixed |
| 12 | Navigasi | 11 menu; bottom nav 4 slot + "Lainnya"; Sesi Baca memakan slot | Fitur sosial (Peringkat, Quest) tersembunyi | Medium | Baca di tengah, 4 slot untuk Beranda/Statistik/Peringkat/Profil sesuai urutan Admin | S | fixed |
| 13 | Informasi | Grafik tanpa sumbu/nilai; nama badge terpotong ("Langkah …"); heatmap tanpa legenda nilai | Data sulit dibaca | Medium | Label sumbu, nilai saat hover/fokus, nama badge 2 baris | M | fixed — sumbu, gridline, tooltip, tabel |
| 14 | Konsistensi | Admin pakai emoji sebagai ikon, app pakai lucide; sidebar admin tidak setinggi layar | Terasa dua aplikasi | Medium | Ikon lucide + layout admin dari sistem yang sama | S | fixed |
| 15 | Performa | 8 `<img>` mentah tanpa dimensi (avatar, sampul, foto post) | Kontributor CLS | Medium | Dimensi/aspect-ratio eksplisit; `loading="lazy"` + `decoding="async"` | S | fixed |
| 16 | UX | Loading state: `Suspense fallback={null}`, spinner layar penuh | Layar kosong sesaat | Medium | Skeleton per kartu | M | fixed |
| 17 | Keamanan | CSP `script-src 'unsafe-inline'` (didokumentasikan sebagai trade-off halaman statis) | Proteksi XSS berkurang | Low | Nonce CSP bila rendering dinamis diterima | M | deferred — butuh keputusan arsitektur (static vs dynamic) |
| 18 | Keamanan | `_DEV_JWT_SECRET` default di `config.py` | Berisiko bila lolos ke produksi | Low | Sudah ditolak di production oleh validator (`config.py`); tidak ada perubahan | — | no change needed |
| 19 | Lingkungan | Live app tidak bisa dimuat dari browser pane / proxy | Baseline memakai build lokal | Info | — | — | — |

## Baseline metrik (sebelum)

Ringkasan dari `shots/before/report.json` (30 rute × 2 viewport):

| Metrik | Desktop | HP |
|---|---|---|
| LCP terburuk | 728ms (/login) | 508ms (/) |
| CLS terburuk | 0.352 (/admin/gamification) | 0.226 (/) |
| Rute dengan CLS > 0.1 | 3 | 5 |
| Pelanggaran axe (total node) | 157 di semua rute & viewport | |
| Error console (selain 401 refresh di halaman publik) | /team 403 | /team 403 |


## Sesudah redesign (median 3 run, build `redesign/stabilo`)

Metode sama dengan baseline; baseline juga diulang 3× agar perbandingan memakai median, bukan satu run.

| Metrik | Desktop sebelum → sesudah | HP sebelum → sesudah |
|---|---|---|
| Rute dengan CLS > 0.1 | 3 → **0** | 5 → **0** |
| CLS terburuk | 0.352 → **0.085** | 0.389 → **0.051** |
| LCP median semua rute | 228 → **214 ms** | 178 → 184 ms |
| LCP terburuk | 968 → **716 ms** | 416 → **388 ms** |
| Node axe (semua rute, mode terang) | 184 → **2** | |
| Node axe serious/critical (terang) | 141 → **2** | |
| Node axe (mode gelap) | 233 → **3** | |
| Error console (selain 401 refresh di halaman publik) | /team 403 → **0** | /team 403 → **0** |

Catatan jujur:
- Sisa 2 node axe ada di `/admin/reports` (tabel gulir tanpa fokus, sudah ada sejak baseline) dan sudah diperbaiki di commit terakhir; satu node gelap sisanya juga di halaman itu.
- LCP Beranda HP naik dari median ±304 ms ke ±424 ms karena elemen LCP-nya berubah: sebelumnya placeholder composer kecil (272 ms), sekarang headline Today hero yang menunggu data progres. Konten bermakna di baseline ("5 dari 9 sudah membaca") tampil di ±420 ms, jadi waktu tampil konten setara. Tetap jauh di bawah ambang "good" 2.5 s.
- LCP `/admin/notifications` HP naik ±110 ms karena elemen LCP berganti ke paragraf kartu jadwal; request API dan waktu tampil kontennya tidak berubah.
- `/feed` desktop sempat +100 ms karena foto post pertama di-lazy-load; diperbaiki (foto pertama dimuat eager dengan `fetchPriority="high"`), sekarang median 448 vs 452 ms baseline.
- Semua pengukuran memakai backend asli dengan database in-memory (mongomock) dan data demo, karena situs Vercel tidak bisa dimuat dari lingkungan kerja. Angka absolut akan berbeda di produksi; yang dibandingkan adalah selisih pada kondisi identik.
