"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { api } from "@/lib/api";
import type { ReadingSession, Today } from "@/lib/types";
import { formatDuration } from "@/lib/words";

export default function HomePage() {
  const { user, logout } = useAuth();
  const [today, setToday] = useState<Today | null>(null);
  const [recent, setRecent] = useState<ReadingSession[]>([]);

  useEffect(() => {
    api<Today>("/sessions/today").then(setToday).catch(() => undefined);
    api<ReadingSession[]>("/sessions?limit=5").then(setRecent).catch(() => undefined);
  }, []);

  if (!user) return null;
  const firstName = user.name.split(" ")[0];
  const active = today?.active_session;
  const completed = recent.filter((s) => s.status === "completed");

  return (
    <div className="flex flex-col gap-6 pt-2">
      <section className="animate-pop-in rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/25">
        <p className="text-sm font-semibold opacity-80">{user.role.name}</p>
        <h1 className="mt-1 text-3xl font-extrabold">Halo, {firstName}! 👋</h1>
        <p className="mt-3 opacity-90">
          {today?.full_points_done
            ? "Target baca hari ini sudah tercapai. Keren! 🎯"
            : `Target harianmu ${user.daily_target_minutes} menit. Yuk mulai!`}
        </p>
        <Link
          href="/read"
          className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-white/95 font-extrabold text-[#6c4df6] shadow-lg transition active:scale-[0.98]"
        >
          {active ? "⏱️ Lanjutkan sesi baca" : "▶️ Mulai sesi baca"}
        </Link>
      </section>

      {active && (
        <Link
          href="/read"
          className="flex items-center gap-3 rounded-3xl border-2 border-accent/50 bg-accent/10 p-3"
        >
          <BookCover url={active.book.cover_url} title={active.book.title} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-accent">SESI BERJALAN</p>
            <p className="truncate font-bold">{active.book.title}</p>
            <p className="text-sm text-muted">{formatDuration(active.active_seconds)} terbaca</p>
          </div>
        </Link>
      )}

      <dl className="grid grid-cols-3 gap-3 text-center">
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

      <section>
        <h2 className="mb-3 text-lg font-extrabold">Sesi terakhir</h2>
        {completed.length === 0 ? (
          <p className="rounded-2xl bg-surface-muted p-4 text-sm text-muted">
            Belum ada sesi. Sesi pertamamu tinggal satu ketukan lagi! 📖
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {completed.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/books/${s.book.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
                >
                  <BookCover url={s.book.cover_url} title={s.book.title} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.book.title}</p>
                    <p className="text-sm text-muted">
                      {formatDuration(s.active_seconds)} ·{" "}
                      {new Date(s.started_at).toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  {s.is_full_points && (
                    <span className="text-xs font-bold text-success" aria-label="Poin penuh">
                      ✅
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button variant="ghost" onClick={() => logout()}>
        Keluar
      </Button>
    </div>
  );
}
