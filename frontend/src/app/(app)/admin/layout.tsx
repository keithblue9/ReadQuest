"use client";

import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";
import { BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS, EmptyState, Logo } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { ADMIN_SECTIONS, allowedSections } from "@/features/admin/sections";

export default function AdminLayout({ children }: LayoutProps<"/">) {
  const { user } = useAuth();
  const pathname = usePathname();
  const sections = allowedSections(user?.permissions ?? []);
  const match = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const current = sections.find((s) => match(s.href));
  // Halaman admin yang ada tetapi tidak diizinkan untuk role ini.
  const forbidden = !current && ADMIN_SECTIONS.some((s) => match(s.href));

  if (!sections.length) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="sr-only">Admin</h1>
        <EmptyState
          icon={<Lock className="size-6" />}
          title="Halaman ini khusus Admin"
          body="Akunmu tidak punya akses ke menu admin. Hubungi Admin tim bila kamu memerlukannya."
          action={
            <Link href="/" className={`${BUTTON_BASE} ${BUTTON_SIZES.sm} ${BUTTON_VARIANTS.primary}`}>
              Kembali ke beranda
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-paper md:flex-row">
      <aside aria-label="Menu admin" className="border-b border-line bg-paper md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
          <Link href="/" aria-label="Kembali ke aplikasi">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <p className="px-5 text-sm font-semibold text-muted">Admin</p>
        <nav aria-label="Menu admin" className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] md:flex-col md:overflow-visible">
          {sections.map((s) => {
            const active = current?.href === s.href;
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm transition ${
                  active ? "bg-surface font-semibold text-ink shadow-[var(--shadow-card)]" : "font-medium text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                <s.icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                <span className="relative">
                  {active && <span aria-hidden className="absolute inset-x-[-3px] bottom-0.5 h-2 rounded-[2px] bg-highlight/80 dark:bottom-[-3px] dark:h-0.5" />}
                  <span className="relative">{s.label}</span>
                </span>
              </Link>
            );
          })}
          <Link href="/" className="mt-2 hidden min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface hover:text-ink md:flex">
            <ArrowLeft className="size-[18px]" aria-hidden /> Kembali ke aplikasi
          </Link>
        </nav>
      </aside>
      <main id="main" className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-4 pb-16 md:px-8 md:pt-8">
        {forbidden ? (
          <EmptyState
            icon={<Lock className="size-6" />}
            title="Role kamu tidak punya akses ke halaman ini"
            body="Pilih menu lain di samping, atau minta Admin menambahkan izin untuk role-mu."
          />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
