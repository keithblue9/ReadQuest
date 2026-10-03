"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/features/auth/AuthProvider";
import { allowedSections } from "@/features/admin/sections";
import { isActive, splitMobileMenus, visibleMenus } from "@/features/navigation/menu";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { FeatureGate } from "@/features/ui-config/FeatureGate";
import { useT, useUiConfig } from "@/features/ui-config/store";

import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./ui";

// Halaman satu kolom (feed, sesi baca, profil…) dibatasi lebarnya agar nyaman dibaca di desktop.
const NARROW = ["/feed", "/posts", "/read", "/profile", "/notifications", "/settings", "/buddy", "/quests", "/room", "/leaderboard", "/team"];

/**
 * Desktop (lg+): sidebar kiri berisi logo, menu, dan tombol "Mulai membaca"; konten di kanan.
 * HP: header atas + bottom nav (4 menu utama + "Lainnya").
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const { user } = useAuth();
  const { features } = useUiConfig();
  const [moreOpen, setMoreOpen] = useState(false);

  const items = visibleMenus(features);
  const { primary, more } = splitMobileMenus(items);
  const adminHome = user ? allowedSections(user.permissions)[0]?.href : undefined;
  const moreActive = more.some((i) => isActive(pathname, i.href));

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
      active ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "text-muted hover:bg-surface-muted hover:text-foreground"
    }`;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-4 lg:overflow-y-auto lg:p-4">
        <Link href="/" aria-label={t("nav.dashboard")} className="px-1 pt-1">
          <Logo tagline />
        </Link>
        <Link
          href="/read"
          className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent font-extrabold text-[#1f1b2e] shadow-lg shadow-accent/25 transition hover:brightness-105 active:scale-[0.98]"
        >
          ▶️ {t("nav.start_reading")}
        </Link>
        <nav aria-label={t("nav.main_label")} className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.menu} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
                <span className="w-6 text-center text-lg" aria-hidden>
                  {item.icon}
                </span>
                {t(item.label)}
              </Link>
            );
          })}
          {adminHome && (
            <Link href={adminHome} className={`${linkClass(false)} mt-2 border-t border-border pt-3`}>
              <span className="w-6 text-center text-lg" aria-hidden>
                🛠️
              </span>
              {t("nav.admin")}
            </Link>
          )}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="min-w-0 truncate text-sm font-bold">{user?.name}</p>
          <ThemeToggle />
        </div>
      </aside>

      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col lg:max-w-none">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-background/85 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 backdrop-blur lg:px-8 lg:pt-4">
          <Link href="/" aria-label={t("nav.dashboard")} className="min-w-0 lg:hidden">
            <Logo tagline />
          </Link>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <span className="lg:hidden">
              <ThemeToggle />
            </span>
          </div>
        </header>
        <main className="flex-1 px-5 pb-28 lg:px-8 lg:pb-12">
          <div className={`mx-auto w-full ${NARROW.some((p) => pathname.startsWith(p)) ? "lg:max-w-2xl" : "lg:max-w-6xl"}`}>
            <FeatureGate>{children}</FeatureGate>
          </div>
        </main>
      </div>

      <nav
        aria-label={t("nav.main_label")}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.menu} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition ${
                    active ? "text-primary" : "text-muted hover:text-foreground"
                  }`}
                >
                  <span className={`text-xl transition-transform ${active ? "scale-110" : ""}`} aria-hidden>
                    {item.icon}
                  </span>
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition ${
                moreActive || moreOpen ? "text-primary" : "text-muted hover:text-foreground"
              }`}
            >
              <span className="text-xl" aria-hidden>
                ⋯
              </span>
              {t("nav.more")}
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <ul
            role="menu"
            className="animate-pop-in absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] grid grid-cols-3 gap-2 rounded-3xl border border-border bg-surface p-3 shadow-2xl"
          >
            {[...more, ...(adminHome ? [{ menu: "admin", href: adminHome, icon: "🛠️", label: "nav.admin" as const }] : [])].map(
              (item) => (
                <li key={item.menu} role="none">
                  <Link
                    role="menuitem"
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1 rounded-2xl p-3 text-center text-xs font-bold hover:bg-surface-muted"
                  >
                    <span className="text-2xl" aria-hidden>
                      {item.icon}
                    </span>
                    {t(item.label)}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
