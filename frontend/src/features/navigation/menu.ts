import {
  Bell,
  BookBookmark,
  ChartColumn,
  Handshake,
  House,
  Library,
  type LucideIcon,
  Sofa,
  Target,
  Timer,
  Trophy,
  UserRound,
} from "lucide-react";

import type { Feature, Menu, UiConfig } from "@/features/ui-config/store";
import type { TextKey } from "@/lib/texts";

export type MenuItem = { menu: Menu; href: string; icon: LucideIcon; label: TextKey; feature?: Feature };

export const MENU_ITEMS: Record<Menu, MenuItem> = {
  dashboard: { menu: "dashboard", href: "/", icon: House, label: "nav.dashboard" },
  read: { menu: "read", href: "/read", icon: Timer, label: "nav.read" },
  stats: { menu: "stats", href: "/stats", icon: ChartColumn, label: "nav.stats" },
  books: { menu: "books", href: "/books", icon: Library, label: "nav.books", feature: "books" },
  shelf: { menu: "shelf", href: "/shelf", icon: BookBookmark, label: "nav.shelf" },
  leaderboard: { menu: "leaderboard", href: "/leaderboard", icon: Trophy, label: "nav.leaderboard", feature: "leaderboard" },
  quests: { menu: "quests", href: "/quests", icon: Target, label: "nav.quests", feature: "quests" },
  buddy: { menu: "buddy", href: "/buddy", icon: Handshake, label: "nav.buddy", feature: "buddy" },
  room: { menu: "room", href: "/room", icon: Sofa, label: "nav.room", feature: "room" },
  notifications: { menu: "notifications", href: "/notifications", icon: Bell, label: "nav.notifications" },
  profile: { menu: "profile", href: "/profile", icon: UserRound, label: "nav.profile" },
};

/** Menu yang tampil: urutan dari Admin, fitur yang dimatikan disembunyikan. */
export function visibleMenus(features: UiConfig["features"]): MenuItem[] {
  return features.menu_order
    .map((m) => MENU_ITEMS[m])
    .filter((item) => item && (!item.feature || features.enabled[item.feature]));
}

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/feed") || pathname.startsWith("/posts");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Jumlah slot bottom nav HP (sisanya masuk "Lainnya"). */
export const MOBILE_SLOTS = 4;

/** Bottom nav HP: menu teratas kecuali Notifikasi & Profil (sudah ada di header). */
export function splitMobileMenus(items: MenuItem[]): { primary: MenuItem[]; more: MenuItem[] } {
  const candidates = items.filter((i) => i.menu !== "notifications" && i.menu !== "profile");
  const primary = candidates.slice(0, MOBILE_SLOTS);
  return { primary, more: items.filter((i) => !primary.includes(i)) };
}
