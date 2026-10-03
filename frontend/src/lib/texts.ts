/**
 * Teks UI default. Admin bisa mengganti setiap teks lewat Admin → Tampilan & Teks; yang disimpan
 * di server hanya teks yang diubah (override), sisanya memakai nilai di sini.
 *
 * Kunci: `<grup>.<nama>` (huruf kecil, angka, garis bawah). Placeholder `{nama}` diisi saat
 * dipakai; `{app}` (nama aplikasi) dan `{tagline}` (slogan) selalu tersedia.
 */
export const DEFAULT_TEXTS = {
  // Login & daftar
  "auth.login.title": "Selamat datang kembali 👋",
  "auth.login.subtitle": "Masuk dengan nomor HP dan PIN-mu.",
  "auth.login.submit": "Masuk",
  "auth.login.forgot_pin": "Lupa PIN? Hubungi Admin tim untuk reset.",
  "auth.login.no_account": "Belum punya akun?",
  "auth.login.register_link": "Daftar di sini",
  "auth.register.title": "Gabung tim baca 📖",
  "auth.register.subtitle": "Cukup nama, fungsi, nomor HP, dan PIN.",
  "auth.register.name": "Nama",
  "auth.register.function": "Fungsi / bagian",
  "auth.register.function_placeholder": "Pilih fungsi…",
  "auth.register.function_error": "Pilih fungsi/bagianmu",
  "auth.register.pin_hint": "Hindari PIN mudah ditebak seperti 123456 atau 111111",
  "auth.register.submit": "Daftar",
  "auth.register.check_fields": "Periksa kembali isian Anda.",
  "auth.register.has_account": "Sudah punya akun?",
  "auth.register.login_link": "Masuk",
  "auth.field.phone": "Nomor HP",
  "auth.field.phone_placeholder": "08123456789",
  "auth.field.pin": "PIN (6 angka)",
  "auth.field.pin_show": "Tampilkan PIN",
  "auth.field.pin_hide": "Sembunyikan PIN",
  "auth.footer": "© {year} {app}",

  // Menu navigasi
  "nav.dashboard": "Beranda",
  "nav.read": "Sesi Baca",
  "nav.feed": "Feed",
  "nav.stats": "Statistik Tim",
  "nav.books": "Katalog Buku",
  "nav.shelf": "Rak Buku",
  "nav.leaderboard": "Peringkat",
  "nav.quests": "Quest",
  "nav.buddy": "Reading Buddy",
  "nav.room": "Reading Room",
  "nav.notifications": "Notifikasi",
  "nav.profile": "Profil",
  "nav.admin": "Admin",
  "nav.main_label": "Navigasi utama",
  "nav.more": "Lainnya",
  "nav.start_reading": "Mulai membaca",
  "nav.micro_reading": "Baca 5 menit",
  "nav.reports": "Laporan Divisi",
  "nav.search_placeholder": "Cari buku…",

  // Beranda (feed)
  "home.composer_prompt": "Apa yang kamu baca hari ini, {name}?",
  "home.composer_read": "Sesi baca",
  "home.composer_micro": "Baca 5 menit",
  "home.composer_quote": "Bagikan kutipan",
  "home.feed_empty": "Belum ada posting. Mulai sesi baca dan bagikan catatanmu!",

  // Umum
  "common.feature_off_title": "Fitur ini sedang dimatikan",
  "common.feature_off_body": "Admin tim menonaktifkan fitur ini untuk sementara.",
  "common.back_home": "← Kembali ke beranda",
} as const;

export type TextKey = keyof typeof DEFAULT_TEXTS;
export type TextVars = Record<string, string | number>;

export const TEXT_GROUP_LABELS: Record<string, string> = {
  auth: "Login & Daftar",
  nav: "Menu navigasi",
  home: "Beranda",
  common: "Umum",
};

export function textGroup(key: string): string {
  return key.split(".")[0];
}

/** Ganti `{nama}` dengan nilai di `vars`; placeholder yang tidak dikenal dibiarkan apa adanya. */
export function formatText(template: string, vars: TextVars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Pisahkan nama aplikasi untuk logo dua warna: "ReadQuest" → ["Read", "Quest"],
 * "Baca Bareng Yuk" → ["Baca Bareng ", "Yuk"], satu kata biasa → [nama, ""].
 */
export function splitBrandName(name: string): [string, string] {
  const trimmed = name.trim();
  const space = trimmed.lastIndexOf(" ");
  if (space > 0) return [trimmed.slice(0, space + 1), trimmed.slice(space + 1)];
  const camel = /^(.*[a-z0-9])([A-Z][^A-Z]*)$/.exec(trimmed);
  if (camel) return [camel[1], camel[2]];
  return [trimmed, ""];
}
