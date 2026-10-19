import {
  Bell,
  Building2,
  FileChartColumn,
  Gem,
  KeyRound,
  LayoutDashboard,
  Library,
  Medal,
  Palette,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "admin.dashboard.view" },
  { href: "/admin/reports", label: "Laporan Divisi", icon: FileChartColumn, permission: "reports.view" },
  { href: "/admin/users", label: "Pengguna", icon: Users, permission: "users.manage" },
  { href: "/admin/functions", label: "Fungsi", icon: Building2, permission: "config.functions.manage" },
  { href: "/admin/roles", label: "Role & Akses", icon: KeyRound, permission: "config.roles.manage" },
  { href: "/admin/points", label: "Aturan Poin", icon: Gem, permission: "config.points.manage" },
  { href: "/admin/gamification", label: "Gamifikasi", icon: Medal, permission: "config.gamification.manage" },
  { href: "/admin/catalog", label: "Katalog", icon: Library, permission: "config.books.manage" },
  { href: "/admin/notifications", label: "Notifikasi", icon: Bell, permission: "config.notifications.manage" },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings, permission: "config.settings.manage" },
  { href: "/admin/appearance", label: "Tampilan & Teks", icon: Palette, permission: "config.appearance.manage" },
  { href: "/admin/moderation", label: "Moderasi", icon: ShieldCheck, permission: "post.moderate" },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText, permission: "audit.view" },
] as const;

export function allowedSections(permissions: string[]) {
  return ADMIN_SECTIONS.filter((s) => permissions.includes(s.permission));
}
