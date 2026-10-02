"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./ui";

const NAV = [
  { href: "/", label: "Beranda", icon: "🏠" },
  { href: "/feed", label: "Feed", icon: "💬" },
  { href: "/read", label: "Baca", icon: "⏱️" },
  { href: "/books", label: "Buku", icon: "📚" },
  { href: "/profile", label: "Profil", icon: "🙂" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background/85 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <Link href="/" aria-label="Beranda">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 px-5 pb-28">{children}</main>
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
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
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
