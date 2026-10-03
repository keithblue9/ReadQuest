export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Dashboard", icon: "📊", permission: "admin.dashboard.view" },
  { href: "/admin/reports", label: "Laporan Divisi", icon: "📈", permission: "reports.view" },
  { href: "/admin/users", label: "Pengguna", icon: "👥", permission: "users.manage" },
  { href: "/admin/functions", label: "Fungsi", icon: "🏢", permission: "config.functions.manage" },
  { href: "/admin/roles", label: "Role & Akses", icon: "🔐", permission: "config.roles.manage" },
  { href: "/admin/points", label: "Aturan Poin", icon: "💎", permission: "config.points.manage" },
  { href: "/admin/gamification", label: "Gamifikasi", icon: "🏅", permission: "config.gamification.manage" },
  { href: "/admin/catalog", label: "Katalog", icon: "📚", permission: "config.books.manage" },
  { href: "/admin/notifications", label: "Notifikasi", icon: "🔔", permission: "config.notifications.manage" },
  { href: "/admin/settings", label: "Pengaturan", icon: "⚙️", permission: "config.settings.manage" },
  { href: "/admin/appearance", label: "Tampilan & Teks", icon: "🎨", permission: "config.appearance.manage" },
  { href: "/admin/moderation", label: "Moderasi", icon: "🛡️", permission: "post.moderate" },
  { href: "/admin/audit", label: "Audit Log", icon: "🧾", permission: "audit.view" },
] as const;

export function allowedSections(permissions: string[]) {
  return ADMIN_SECTIONS.filter((s) => permissions.includes(s.permission));
}
