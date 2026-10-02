# ReadQuest — Spesifikasi Aplikasi

> Dokumen ini adalah sumber kebenaran (source of truth) untuk fitur dan kebutuhan ReadQuest.
> Perubahan cakupan harus diperbarui di sini terlebih dahulu.

## 1. Ringkasan Produk

**ReadQuest** adalah aplikasi web responsif (PWA) berupa komunitas baca buku
bergamifikasi untuk satu tim/organisasi. Konsepnya terinspirasi program
**ReadSG** di Singapura: setiap anggota didorong membaca **minimal 15 menit per
hari** dan mendapatkan poin atas aktivitas membaca serta kontribusinya ke
komunitas.

**Peran pengembang:** Senior Full-Stack Developer.

**Tujuan utama:**
- Membangun kebiasaan membaca harian yang konsisten.
- Mendorong berbagi insight bacaan (catatan, cerita bab, ulasan) ke komunitas.
- Memberikan apresiasi yang adil melalui sistem poin, level, badge, dan leaderboard.
- Membedakan pembaca yang benar-benar aktif dari yang sekadar mengamati.

## 2. Peran & Akses

| Role | Deskripsi singkat |
|------|-------------------|
| **Member** | Membaca, mencatat, berinteraksi di feed, melihat status Authenticity Index miliknya sendiri. |
| **Team Lead** | Semua hak Member + melihat status Authenticity Index anggota timnya. |
| **Admin** | Akses penuh: dashboard, konfigurasi, moderasi, export, audit log. |

Role dan permission dikelola secara **data-driven** (RBAC) melalui Admin Config
(lihat §3.11), bukan di-hardcode.

## 3. Fitur

### 3.1 Autentikasi & Onboarding

- Login **email/password**, plus **SSO opsional**.
- Bergabung ke tim menggunakan **kode undangan tim**.
- Role: Member, Team Lead, Admin.
- **Onboarding** pengguna baru:
  - Pilih **fungsi/bagian** (unit kerja).
  - Pilih **minat baca** (kategori/topik).
  - Tentukan **target harian** (menit baca).
  - Panduan **"Add to Home Screen"** untuk iOS (agar PWA & Web Push berfungsi).

### 3.2 Reading Session

- **Timer baca** dengan durasi minimal **15 menit**.
- Timer **auto-pause saat idle** (tidak ada aktivitas).
- Setelah sesi selesai, pengguna **wajib** mengisi salah satu catatan:

| Jenis catatan | Minimal kata |
|---------------|--------------|
| Quick Note | ≥ 30 kata |
| Chapter Story | ≥ 80 kata |
| Book Review | ≥ 200 kata |

- **Validasi kualitas catatan:**
  - Tolak **copy-paste massal**.
  - Tolak teks dengan **jumlah kata unik terlalu sedikit** (repetitif).
- **Maksimal 1 sesi poin penuh per hari.**

### 3.3 Info Buku & Katalog

- Setiap posting **wajib** memuat:
  - Judul
  - Pengarang
  - Kategori
  - Foto buku (upload dari kamera/galeri)
- **Pemrosesan foto:**
  - Kompres di sisi klien, maksimal **~1 MB**.
  - **Strip metadata EXIF** (privasi).
  - Simpan di **object storage**.
- **Field opsional:** penerbit, tahun terbit, total halaman, progres halaman, rating.
- **Katalog buku bersama:** 1 buku = 1 halaman diskusi.
- **Foto progres baca** memberi **+5 poin** (maksimal 1x per hari).

### 3.4 Sistem Poin (Ledger)

Semua perubahan poin dicatat sebagai entri **ledger** (append-only) sehingga dapat
diaudit dan dihitung ulang.

| Aktivitas | Poin |
|-----------|------|
| Sesi baca valid | +20 |
| Chapter Story | +40 |
| Buku selesai | +150 |
| Posting ke feed | +10 |
| Like diterima | +2 |
| Komentar bermakna diterima | +5 |
| Memberi komentar bermakna | +3 |
| Foto progres baca (maks 1x/hari) | +5 |
| Bonus streak | pada hari ke-7, 14, 30, dan 100 |

- Terapkan **batas harian anti-spam** per jenis aktivitas.
- Nilai poin dan batas harian **dapat dikonfigurasi** oleh Admin (§3.11).

### 3.5 Feed Sosial

- **Kartu catatan** (note card) berisi info buku dan catatan pembaca.
- **Reaksi:** Like, Insightful, Inspiring.
- **Komentar berantai** (threaded).
- **Mention** pengguna lain.
- **Bookmark** posting.
- **Filter** per fungsi, buku, atau topik.
- **Share card** ke WhatsApp dan LinkedIn.
- **Thread diskusi per buku** (terhubung dengan katalog buku).

### 3.6 Leaderboard

Kategori:
- **Top Storyteller**
- **Streak Master**
- **Book Finisher**
- **Most Inspiring**
- **Battle Antar-Fungsi** — poin fungsi **dinormalisasi per jumlah anggota**.

Periode: **mingguan**, **bulanan**, **all-time**.

### 3.7 Reading Authenticity Index

Mengukur seberapa aktif seseorang berkontribusi dibanding hanya mengamati.

**Contribution Ratio** (jendela 30 hari):

```
Contribution Ratio = catatan_sendiri / (catatan_sendiri + komentar + like)
```

**Status:**
- Active Reader
- Warming Up
- Observer
- Silent

Ketentuan:
- Threshold tiap status **dapat dikonfigurasi** Admin (§3.11).
- Status **hanya terlihat** oleh pengguna yang bersangkutan, Team Lead, dan Admin.
- Kirim **nudge lembut** ke pengguna berstatus Observer.

### 3.8 Gamifikasi

- **Level & title**.
- **Badge**.
- **Weekly quest**.
- **Book of the Month**.
- **Reading Buddy** (pasangan baca).
- **Reading Room live** (via WebSocket) — membaca bersama secara real-time.
- **Animasi** konfeti & streak.

### 3.9 Notifikasi

- **PWA Web Push** (service worker + VAPID) untuk:
  - Pengingat baca
  - Streak terancam putus
  - Reaksi
  - Komentar / mention
  - Leaderboard mingguan
  - Quest baru
  - Nudge untuk Observer
- **Preferensi per pengguna:** jenis notifikasi, jam tenang (quiet hours), frekuensi.
- **Batching reaksi** (digabung agar tidak spam).
- **Lonceng notifikasi in-app**.
- Onboarding memandu **"Add to Home Screen"** untuk iOS.

### 3.10 Admin Dashboard

- Jumlah pembaca aktif.
- Rata-rata menit baca.
- Heatmap aktivitas per fungsi.
- Daftar Observer.
- Kelola fungsi, badge, dan quest.
- Moderasi konten.
- Export laporan ke **Excel** dan **PDF**.

### 3.11 Admin Config (Data-Driven)

Semua konfigurasi disimpan di database, **bukan hardcode**:

- CRUD **Fungsi/Bagian** (mendukung hierarki).
- CRUD **Role** + **matriks Permission** (RBAC).
- **Aturan poin** & **batas harian**.
- **Threshold status** Authenticity Index.
- **Badge**, **quest**, dan **level**.
- **Katalog** & **kategori buku**.
- **Jadwal** & **template notifikasi**.
- **Moderasi**.
- **Audit log** untuk setiap perubahan konfigurasi.

## 4. Tech Stack & Kebutuhan Non-Fungsional

### 4.1 Tech Stack

| Lapisan | Teknologi |
|---------|-----------|
| Frontend | Next.js (PWA) |
| Backend | FastAPI |
| Database | MongoDB |
| Autentikasi | JWT (+ SSO opsional) |
| Real-time | WebSocket |
| Notifikasi | Web Push (service worker + VAPID) |
| Penyimpanan file | Object storage |

### 4.2 UI/UX

- Modern dan ceria.
- **Mobile-first**, responsif.
- **Dark mode**.
- **Mikro-animasi** (konfeti, streak, transisi).

### 4.3 Keamanan & Privasi

- Jangan commit secret; gunakan `.env` + `.gitignore` (commit hanya `.env.example`).
- Strip EXIF dari foto yang diunggah.
- Visibilitas Authenticity Index dibatasi sesuai §3.7.
- Perubahan konfigurasi tercatat di audit log.

## 5. Deliverable Awal

Urutan pengerjaan awal:

1. **(a) Arsitektur & skema database.**
2. **(b) Struktur folder** proyek.
3. **(c) Implementasi MVP:** auth, reading session, poin, feed, leaderboard.

Setiap fase diawali penjelasan singkat **keputusan desain** sebelum menulis kode.

## 6. Fase Pengembangan

Setiap fase dikerjakan pada **branch terpisah** dan diajukan lewat **PR terpisah**.

| Fase | Cakupan |
|------|---------|
| 0 | Fondasi dokumentasi (SPEC, CLAUDE.md, .gitignore, README) |
| 1 | Arsitektur, skema database, struktur folder |
| 2 | MVP: Auth & onboarding |
| 3 | MVP: Reading session + info buku/katalog |
| 4 | MVP: Sistem poin (ledger) |
| 5 | MVP: Feed sosial |
| 6 | MVP: Leaderboard |
| 7 | Authenticity Index & gamifikasi lanjutan (level, badge, quest, Reading Room WebSocket) |
| 8 | Notifikasi (Web Push & in-app) |
| 9 | Admin dashboard & Admin Config (RBAC, audit log, export) |
| 10 | PWA polish, hardening, deployment |
