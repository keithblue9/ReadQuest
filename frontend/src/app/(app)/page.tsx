"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Logo } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";

// Beranda sementara (Fase 2). Feed, sesi baca, dan leaderboard menyusul di fase berikutnya.
export default function HomePage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const firstName = user.name.split(" ")[0];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <header className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>

      <section className="animate-pop-in mt-10 rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/25">
        <p className="text-sm font-semibold opacity-80">{user.role.name}</p>
        <h1 className="mt-1 text-3xl font-extrabold">Halo, {firstName}! 👋</h1>
        <p className="mt-3 opacity-90">
          Target harianmu <strong>{user.daily_target_minutes} menit</strong>. Siap memulai
          petualangan baca?
        </p>
      </section>

      <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          ["Poin", user.stats.points_total],
          ["Streak", `${user.stats.current_streak}🔥`],
          ["Buku", user.stats.books_finished],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4">
            <dt className="text-xs font-semibold text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 rounded-2xl bg-surface-muted p-4 text-sm text-muted">
        Sesi baca, feed, dan leaderboard segera hadir. ✨
      </p>

      <div className="mt-auto pt-10">
        <Button variant="ghost" onClick={() => logout()}>
          Keluar
        </Button>
      </div>
    </main>
  );
}
