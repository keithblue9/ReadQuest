"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NotificationBell } from "@/features/notifications/NotificationBell";
import { FeatureGate } from "@/features/ui-config/FeatureGate";
import { type Feature, type Menu, useT, useUiConfig } from "@/features/ui-config/store";
import type { TextKey } from "@/lib/texts";

import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./ui";

const NAV: { menu: Menu; href: string; label: TextKey; icon: string; feature?: Feature }[] = [
  { menu: "dashboard", href: "/", label: "nav.dashboard", icon: "🏠" },
  { menu: "feed", href: "/feed", label: "nav.feed", icon: "💬", feature: "feed" },
  { menu: "read", href: "/read", label: "nav.read", icon: "⏱️" },
  { menu: "leaderboard", href: "/leaderboard", label: "nav.leaderboard", icon: "🏆", feature: "leaderboard" },
  { menu: "profile", href: "/profile", label: "nav.profile", icon: "🙂" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const { enabled, menu_order } = useUiConfig().features;
  const nav = NAV.filter((item) => !item.feature || enabled[item.feature]).sort(
    (a, b) => menu_order.indexOf(a.menu) - menu_order.indexOf(b.menu),
  );
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background/85 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <Link href="/" aria-label={t("nav.dashboard")}>
          <Logo tagline />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 px-5 pb-28">
        <FeatureGate>{children}</FeatureGate>
      </main>
      <nav
        aria-label={t("nav.main_label")}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-md">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition ${
                    active ? "text-primary" : "text-muted hover:text-foreground"
                  }`}
                >
                  <span
                    className={`text-xl transition-transform ${active ? "scale-110" : ""}`}
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
