"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/ui";
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
      <main className="mx-auto max-w-md p-6 text-center">
        <p className="text-4xl" aria-hidden>
          🔒
        </p>
        <p className="mt-2 font-bold">Halaman ini khusus Admin.</p>
        <Link href="/" className="mt-4 inline-block font-bold text-primary">
          ← Kembali ke beranda
        </Link>
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col md:flex-row">
      <aside className="border-border bg-surface md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:overflow-y-auto md:border-r">
        <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
          <Link href="/" aria-label="Kembali ke aplikasi">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <p className="px-4 text-xs font-bold tracking-wide text-muted uppercase">Admin</p>
        <nav aria-label="Menu admin" className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-visible">
          {sections.map((s) => {
            const active = current?.href === s.href;
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                  active ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <span aria-hidden>{s.icon}</span>
                {s.label}
              </Link>
            );
          })}
          <Link href="/" className="hidden px-3 py-2 text-sm font-bold text-muted md:block">
            ← Kembali ke aplikasi
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 pt-4 pb-16 md:px-8 md:pt-8">
        {forbidden ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            🔒 Role kamu tidak punya akses ke halaman ini.
          </p>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
