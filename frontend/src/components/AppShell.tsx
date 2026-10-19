"use client";

import { BookOpen, CalendarPlus, Ellipsis, FileChartColumn, Search, Settings, Shield, Timer, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
        className="h-10 w-full rounded-full border border-transparent bg-surface-muted pr-4 pl-9 text-sm placeholder:text-muted focus:border-ink focus:bg-surface focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-highlight/50"
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
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${
        active ? "bg-surface font-semibold text-ink shadow-[var(--shadow-card)]" : "font-medium text-muted hover:bg-surface hover:text-ink"
      }`}
    >
      <Icon className={`size-5 ${active ? "text-ink" : ""}`} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
      <span className="relative">
        {active && <span aria-hidden className="marker-fill absolute inset-x-[-3px] bottom-0.5 h-2 rounded-[2px] bg-highlight/80 dark:bottom-[-3px] dark:h-0.5" />}
        <span className="relative">{t(item.label)}</span>
      </span>
    </Link>
  );
}

const SHORTCUT = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-muted transition hover:bg-surface hover:text-ink";

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
  const moreRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = moreRef.current;
    if (!dialog) return;
    if (moreOpen && !dialog.open) dialog.showModal();
    if (!moreOpen && dialog.open) dialog.close();
  }, [moreOpen]);

  const items = visibleMenus(features);
  const { primary, more } = splitMobileMenus(items);
  const adminHome = user ? allowedSections(user.permissions)[0]?.href : undefined;
  const canReport = user?.permissions.includes("reports.view");
  const wide = isWide(pathname);
  const moreActive = more.some((i) => isActive(pathname, i.href));

  return (
    <div className="min-h-dvh overflow-x-clip">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/" aria-label={t("nav.dashboard")} className="min-w-0 flex-1 md:flex-none">
            <Logo tagline />
          </Link>
          <SearchBox className="ml-2 hidden w-72 md:block" />
          <span className="hidden flex-1 md:block" />
          <Link
            href="/read"
            className="hidden h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--paper))] lg:flex"
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
        <aside aria-label="Navigasi" className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto py-4 lg:block">
          {user && (
            <Link href="/profile" className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface">
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
          <div className="my-3 border-t border-line" />
          <p className="px-3 pb-1 text-sm font-semibold text-muted">Pintasan</p>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className={SHORTCUT}
            >
              <CalendarPlus className="size-5" strokeWidth={1.8} aria-hidden />
              Kalender baca
            </button>
            <Link href="/settings/notifications" className={SHORTCUT}>
              <Settings className="size-5" strokeWidth={1.8} aria-hidden />
              Pengingat & notifikasi
            </Link>
            {canReport && (
              <Link href="/admin/reports" className={SHORTCUT}>
                <FileChartColumn className="size-5" strokeWidth={1.8} aria-hidden />
                {t("nav.reports")}
              </Link>
            )}
            {adminHome && (
              <Link href={adminHome} className={SHORTCUT}>
                <Shield className="size-5" strokeWidth={1.8} aria-hidden />
                {t("nav.admin")}
              </Link>
            )}
          </div>
        </aside>

        {/* Konten */}
        <main id="main" className="min-w-0 px-4 pt-4 pb-32 lg:px-0 lg:pb-12">
          <div className={`mx-auto w-full ${wide ? "max-w-5xl" : "max-w-[680px]"}`}>
            <FeatureGate>{children}</FeatureGate>
          </div>
        </main>

        {/* Panel kanan (desktop lebar) */}
        {!wide && (
          <aside aria-label="Ringkasan" className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] flex-col gap-4 overflow-y-auto py-4 xl:flex">
            {pathname !== "/" && <TargetCard />}
            <TeamTodayCard />
            <TopReadersCard />
            <BookOfMonthCard />
            <HomeExtras bookOfMonth={false} />
            <CalendarCard />
          </aside>
        )}
      </div>

      {/* Bottom nav HP: [menu][menu][Baca][menu][Lainnya] */}
      <nav
        aria-label={t("nav.main_label")}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-end">
          {[...primary.slice(0, 2), null, ...primary.slice(2)].map((item) => {
            if (!item) {
              const active = pathname.startsWith("/read");
              return (
                <li key="read" className="flex-1">
                  <Link
                    href="/read"
                    aria-current={active ? "page" : undefined}
                    className="flex flex-col items-center gap-1 pb-1.5 text-xs font-semibold text-ink"
                  >
                    <span className="-mt-5 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_6px_16px_rgb(27_35_64/0.28)] ring-4 ring-paper transition active:scale-95">
                      <BookOpen className="size-6" aria-hidden />
                    </span>
                    {t("nav.read")}
                  </Link>
                </li>
              );
            }
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.menu} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-end gap-1 pt-2 pb-1.5 text-xs font-semibold ${
                    active ? "text-ink" : "text-muted"
                  }`}
                >
                  <Icon className="size-6" strokeWidth={active ? 2.3 : 1.8} aria-hidden />
                  <span className={`max-w-full truncate rounded-[2px] px-1 ${active ? "bg-highlight/70 text-on-highlight" : ""}`}>{t(item.label)}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex min-h-14 w-full flex-col items-center justify-end gap-1 pt-2 pb-1.5 text-xs font-semibold ${
                moreActive || moreOpen ? "text-ink" : "text-muted"
              }`}
            >
              <Ellipsis className="size-6" aria-hidden />
              <span className={`rounded-[2px] px-1 ${moreActive ? "bg-highlight/70 text-on-highlight" : ""}`}>{t("nav.more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Sheet "Lainnya": <dialog> native → fokus terkurung, Escape, fokus kembali ke pemicu. */}
      <dialog
        ref={moreRef}
        aria-label={t("nav.more")}
        onClose={() => setMoreOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMoreOpen(false);
        }}
        className="card m-0 mt-auto w-full max-w-none rounded-b-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-ink backdrop:bg-black/40 lg:hidden"
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-lg font-semibold">{t("nav.more")}</p>
          <button type="button" aria-label="Tutup" onClick={() => setMoreOpen(false)} className="grid size-11 place-items-center rounded-full bg-surface-muted">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {more.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.menu}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold"
              >
                <Icon className="size-6" strokeWidth={1.8} aria-hidden />
                {t(item.label)}
              </Link>
            );
          })}
          <button
            type="button"
                            onClick={() => {
              setMoreOpen(false);
              setCalendarOpen(true);
            }}
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold"
          >
            <CalendarPlus className="size-6" strokeWidth={1.8} aria-hidden />
            Kalender baca
          </button>
          <div className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold">
            <ThemeToggle />
            Tema
          </div>
          {canReport && (
            <Link href="/admin/reports" onClick={() => setMoreOpen(false)} className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold">
              <FileChartColumn className="size-6" strokeWidth={1.8} aria-hidden />
              {t("nav.reports")}
            </Link>
          )}
          {adminHome && (
            <Link href={adminHome} onClick={() => setMoreOpen(false)} className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-muted p-3 text-center text-xs font-semibold">
              <Shield className="size-6" strokeWidth={1.8} aria-hidden />
              {t("nav.admin")}
            </Link>
          )}
        </div>
      </dialog>
      {calendarOpen && <CalendarDialog onClose={() => setCalendarOpen(false)} />}
    </div>
  );
}
