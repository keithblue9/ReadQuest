"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { LevelProgress } from "@/components/LevelProgress";
import { useAuth } from "@/features/auth/AuthProvider";
import { HomeExtras } from "@/features/home/HomeExtras";
import { api } from "@/lib/api";
import { categoryInfo } from "@/features/leaderboard/categories";
import type {
  LeaderboardSummaryItem,
  PointsSummary,
  ReadingSession,
  Today,
} from "@/lib/types";
import { formatDuration } from "@/lib/words";

export default function HomePage() {
  const { user, refreshUser } = useAuth();
  const [today, setToday] = useState<Today | null>(null);
  const [recent, setRecent] = useState<ReadingSession[]>([]);
  const [points, setPoints] = useState<PointsSummary | null>(null);
  const [ranks, setRanks] = useState<LeaderboardSummaryItem[]>([]);

  useEffect(() => {
    api<Today>("/sessions/today").then(setToday).catch(() => undefined);
    api<ReadingSession[]>("/sessions?limit=5").then(setRecent).catch(() => undefined);
    api<PointsSummary>("/me/points").then(setPoints).catch(() => undefined);
    api<LeaderboardSummaryItem[]>("/leaderboard/me?period=weekly")
      .then(setRanks)
      .catch(() => undefined);
    refreshUser();
  }, [refreshUser]);

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
          ["Poin", points?.points_total ?? user.stats.points_total],
          ["Streak", `${points?.streak.current ?? user.stats.current_streak}🔥`],
          ["Buku", user.stats.books_finished],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4">
            <dt className="text-xs font-semibold text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      {points?.level && (
        <Link href="/profile" className="rounded-3xl border border-border bg-surface p-4">
          <LevelProgress level={points.level} points={points.points_total} />
          {points.streak.current > 0 && !points.streak.read_today && (
            <p className="mt-3 text-sm font-semibold text-accent">
              ⚠️ Baca hari ini agar streak {points.streak.current} hari tidak putus!
            </p>
          )}
        </Link>
      )}

      <HomeExtras />

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold">Peringkat minggu ini</h2>
          <Link href="/leaderboard" className="text-sm font-bold text-primary">
            Lihat semua →
          </Link>
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {ranks.map((r) => {
            const info = categoryInfo(r.category);
            return (
              <Link
                key={r.category}
                href={`/leaderboard?category=${r.category}`}
                className="w-32 shrink-0 rounded-2xl border border-border bg-surface p-3"
              >
                <p className="text-xl" aria-hidden>
                  {info.emoji}
                </p>
                <p className="mt-1 truncate text-xs font-semibold text-muted">{info.label}</p>
                <p className="text-lg font-extrabold">{r.rank ? `#${r.rank}` : "—"}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <Link
        href="/books"
        className="flex items-center gap-3 rounded-3xl border border-border bg-surface p-4"
      >
        <span className="text-3xl" aria-hidden>
          📚
        </span>
        <span className="flex-1">
          <span className="block font-extrabold">Katalog Buku</span>
          <span className="text-sm text-muted">Cari buku & ikuti diskusinya</span>
        </span>
        <span aria-hidden>→</span>
      </Link>

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
    </div>
  );
}
