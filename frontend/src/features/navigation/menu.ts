import type { Feature, Menu, UiConfig } from "@/features/ui-config/store";
import type { TextKey } from "@/lib/texts";

export type MenuItem = { menu: Menu; href: string; icon: string; label: TextKey; feature?: Feature };

export const MENU_ITEMS: Record<Menu, MenuItem> = {
  dashboard: { menu: "dashboard", href: "/", icon: "📊", label: "nav.dashboard" },
  feed: { menu: "feed", href: "/feed", icon: "💬", label: "nav.feed", feature: "feed" },
  read: { menu: "read", href: "/read", icon: "⏱️", label: "nav.read" },
  books: { menu: "books", href: "/books", icon: "📚", label: "nav.books", feature: "books" },
  leaderboard: { menu: "leaderboard", href: "/leaderboard", icon: "🏆", label: "nav.leaderboard", feature: "leaderboard" },
  quests: { menu: "quests", href: "/quests", icon: "🎯", label: "nav.quests", feature: "quests" },
  buddy: { menu: "buddy", href: "/buddy", icon: "🤝", label: "nav.buddy", feature: "buddy" },
  room: { menu: "room", href: "/room", icon: "🛋️", label: "nav.room", feature: "room" },
  notifications: { menu: "notifications", href: "/notifications", icon: "🔔", label: "nav.notifications" },
  profile: { menu: "profile", href: "/profile", icon: "🙂", label: "nav.profile" },
};

/** Menu yang tampil: urutan dari Admin, fitur yang dimatikan disembunyikan. */
export function visibleMenus(features: UiConfig["features"]): MenuItem[] {
  return features.menu_order
    .map((m) => MENU_ITEMS[m])
    .filter((item) => item && (!item.feature || features.enabled[item.feature]));
}

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/feed") return pathname.startsWith("/feed") || pathname.startsWith("/posts");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Jumlah slot bottom nav HP (sisanya masuk "Lainnya"). */
export const MOBILE_SLOTS = 4;

/** Bottom nav HP: menu teratas kecuali Notifikasi (sudah ada lonceng di header). */
export function splitMobileMenus(items: MenuItem[]): { primary: MenuItem[]; more: MenuItem[] } {
  const candidates = items.filter((i) => i.menu !== "notifications");
  const primary = candidates.slice(0, MOBILE_SLOTS);
  return { primary, more: items.filter((i) => !primary.includes(i)) };
}
