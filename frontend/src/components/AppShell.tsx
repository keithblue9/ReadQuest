"use client";

import { CalendarPlus, Ellipsis, FileChartColumn, Plus, Search, Settings, Shield, Timer, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/features/auth/AuthProvider";
import { allowedSections } from "@/features/admin/sections";
import { CalendarDialog } from "@/features/calendar/CalendarDialog";
import { isActive, type MenuItem, splitMobileMenus, visibleMenus } from "@/features/navigation/menu";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import {
  BookOfMonthCard,
  CalendarCard,
  TargetCard,
  TeamTodayCard,
  TopReadersCard,
} from "@/features/shell/widgets";
import { HomeExtras } from "@/features/home/HomeExtras";
import { FeatureGate } from "@/features/ui-config/FeatureGate";
import { useT, useUiConfig } from "@/features/ui-config/store";

import { Avatar } from "./Avatar";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./ui";

/** Halaman lebar (tabel/grafik/grid) tanpa panel kanan. */
function isWide(pathname: string) {
  return ["/stats", "/leaderboard", "/shelf", "/team"].some((p) => pathname.startsWith(p)) || pathname === "/books";
}

function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const t = useT();
  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        router.push(q ? `/books?q=${encodeURIComponent(q)}` : "/books");
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        name="q"
        type="search"
        aria-label={t("nav.search_placeholder")}
        placeholder={t("nav.search_placeholder")}
        className="h-10 w-full rounded-full bg-surface-muted pr-4 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
    </form>
  );
}

function NavLink({ item, active }: { item: MenuItem; active: boolean }) {
  const t = useT();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-2 py-2 text-[15px] font-medium transition ${
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-muted"
      }`}
    >
      <span
        className={`grid size-9 place-items-center rounded-full ${active ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground"}`}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      {t(item.label)}
    </Link>
  );
}

/**
 * Desktop: top bar + navigasi kiri + konten + panel kanan (gaya media sosial).
 * HP: top bar ringkas + bottom nav (4 menu + "Lainnya") + tombol cepat "Baca".
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const { user } = useAuth();
  const { features } = useUiConfig();
  const [moreOpen, setMoreOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const items = visibleMenus(features);
  const { primary, more } = splitMobileMenus(items);
  const adminHome = user ? allowedSections(user.permissions)[0]?.href : undefined;
  const canReport = user?.permissions.includes("reports.view");
  const wide = isWide(pathname);
  const moreActive = more.some((i) => isActive(pathname, i.href));

  return (
    <div className="min-h-dvh overflow-x-clip">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/" aria-label={t("nav.dashboard")} className="min-w-0 flex-1 md:flex-none">
            <Logo tagline />
          </Link>
          <SearchBox className="ml-2 hidden w-72 md:block" />
          <span className="hidden flex-1 md:block" />
          <Link
            href="/read"
            className="hidden h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 lg:flex"
          >
            <Timer className="size-4" aria-hidden /> {t("nav.start_reading")}
          </Link>
          <NotificationBell />
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
          {user && (
            <Link href="/profile" aria-label={t("nav.profile")} className="rounded-full">
              <Avatar name={user.name} url={user.avatar_url} size="md" />
            </Link>
          )}
        </div>
      </header>

      <div
        className={`mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-6 px-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-4 ${
          wide ? "" : "xl:grid-cols-[280px_minmax(0,1fr)_320px]"
        }`}
      >
        {/* Navigasi kiri (desktop) */}
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto py-4 lg:block">
          {user && (
            <Link href="/profile" className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted">
              <Avatar name={user.name} url={user.avatar_url} size="md" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{user.name}</span>
                <span className="block truncate text-xs text-muted">{user.role.name}</span>
              </span>
            </Link>
          )}
          <nav aria-label={t("nav.main_label")} className="flex flex-col gap-0.5">
            {items.map((item) => (
              <NavLink key={item.menu} item={item} active={isActive(pathname, item.href)} />
            ))}
          </nav>
          <div className="my-3 border-t border-border" />
          <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">Pintasan</p>
          <div className="flex flex-col gap-0.5 text-[15px] font-medium">
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-muted"
            >
              <span className="grid size-9 place-items-center rounded-full bg-surface-muted">
                <CalendarPlus className="size-[18px]" aria-hidden />
              </span>
              Kalender baca
            </button>
            <Link href="/settings/notifications" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted">
              <span className="grid size-9 place-items-center rounded-full bg-surface-muted">
                <Settings className="size-[18px]" aria-hidden />
              </span>
              Pengingat & notifikasi
            </Link>
            {canReport && (
              <Link href="/admin/reports" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted">
                <span className="grid size-9 place-items-center rounded-full bg-surface-muted">
                  <FileChartColumn className="size-[18px]" aria-hidden />
                </span>
                {t("nav.reports")}
              </Link>
            )}
            {adminHome && (
              <Link href={adminHome} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted">
                <span className="grid size-9 place-items-center rounded-full bg-surface-muted">
                  <Shield className="size-[18px]" aria-hidden />
                </span>
                {t("nav.admin")}
              </Link>
            )}
          </div>
        </aside>

        {/* Konten */}
        <main className="min-w-0 px-3 pt-4 pb-28 sm:px-4 lg:px-0 lg:pb-12">
          <div className={`mx-auto w-full ${wide ? "max-w-5xl" : "max-w-[680px]"}`}>
            <FeatureGate>{children}</FeatureGate>
          </div>
        </main>

        {/* Panel kanan (desktop lebar) */}
        {!wide && (
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] flex-col gap-4 overflow-y-auto py-4 xl:flex">
            <TargetCard />
            <TeamTodayCard />
            <TopReadersCard />
            <BookOfMonthCard />
            <HomeExtras bookOfMonth={false} />
            <CalendarCard />
          </aside>
        )}
      </div>

      {/* Tombol cepat HP */}
      {!pathname.startsWith("/read") && (
        <Link
          href="/read"
          aria-label={t("nav.start_reading")}
          className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 transition active:scale-95 lg:hidden"
        >
          <Plus className="size-7" aria-hidden />
        </Link>
      )}

      {/* Bottom nav HP */}
      <nav
        aria-label={t("nav.main_label")}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.menu} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold ${
                    active ? "text-primary" : "text-muted"
                  }`}
                >
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                  <span className="max-w-full truncate px-1">{t(item.label)}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex w-full flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold ${
                moreActive || moreOpen ? "text-primary" : "text-muted"
              }`}
            >
              <Ellipsis className="size-6" aria-hidden />
              {t("nav.more")}
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            role="menu"
            className="animate-pop-in card absolute inset-x-0 bottom-0 rounded-b-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">{t("nav.more")}</p>
              <button type="button" aria-label="Tutup" onClick={() => setMoreOpen(false)} className="grid size-9 place-items-center rounded-full bg-surface-muted">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {more.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.menu}
                    role="menuitem"
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold"
                  >
                    <Icon className="size-6 text-primary" aria-hidden />
                    {t(item.label)}
                  </Link>
                );
              })}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false);
                  setCalendarOpen(true);
                }}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold"
              >
                <CalendarPlus className="size-6 text-primary" aria-hidden />
                Kalender baca
              </button>
              <div className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold">
                <ThemeToggle />
                Tema
              </div>
              {canReport && (
                <Link role="menuitem" href="/admin/reports" onClick={() => setMoreOpen(false)} className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold">
                  <FileChartColumn className="size-6 text-primary" aria-hidden />
                  {t("nav.reports")}
                </Link>
              )}
              {adminHome && (
                <Link role="menuitem" href={adminHome} onClick={() => setMoreOpen(false)} className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold">
                  <Shield className="size-6 text-primary" aria-hidden />
                  {t("nav.admin")}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      {calendarOpen && <CalendarDialog onClose={() => setCalendarOpen(false)} />}
    </div>
  );
}
