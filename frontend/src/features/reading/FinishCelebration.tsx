import Link from "next/link";

import { CountUp } from "@/components/CountUp";
import { LevelProgress } from "@/components/LevelProgress";
import { PostCard } from "@/components/PostCard";
import type { FinishResult } from "@/lib/types";
import { formatDuration } from "@/lib/words";

const CONFETTI = ["🎉", "📚", "✨", "⭐", "🎊", "💜", "🧡", "🎈"];

export function FinishCelebration({ result }: { result: FinishResult }) {
  const { session, post, points } = result;
  return (
    <div className="relative flex flex-col gap-5 pb-6">
      <div className="pointer-events-none absolute inset-x-0 -top-4 h-40 overflow-hidden" aria-hidden>
        {CONFETTI.map((emoji, i) => (
          <span
            key={i}
            className="confetti-piece absolute text-2xl"
            style={{ left: `${8 + i * 11}%`, animationDelay: `${i * 70}ms` }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="animate-pop-in pt-8 text-center">
        <p className="text-5xl" aria-hidden>
          🏆
        </p>
        <h1 className="mt-3 text-3xl font-extrabold">Sesi selesai!</h1>
        <p className="mt-2 text-muted">
          Kamu membaca{" "}
          <strong className="text-foreground">{formatDuration(session.active_seconds)}</strong>{" "}
          hari ini.
        </p>
      </div>

      <section className="animate-pop-in rounded-3xl bg-primary p-5 text-primary-foreground shadow-xl shadow-primary/25">
        <p className="text-sm font-semibold opacity-80">Poin didapat</p>
        <p className="text-5xl font-extrabold tabular-nums" aria-live="polite">
          +<CountUp to={points.total_awarded} />
        </p>
        {points.awarded.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {points.awarded.map((a) => (
              <li key={a.rule_code} className="flex justify-between">
                <span>{a.name}</span>
                <span className="font-bold">+{a.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm opacity-90">
            Batas poin harian sudah tercapai — catatanmu tetap tersimpan. 💜
          </p>
        )}
        {!session.is_full_points && points.awarded.length > 0 && (
          <p className="mt-3 text-xs opacity-80">Sesi poin penuh hari ini sudah didapat sebelumnya.</p>
        )}
      </section>

      {result.badges.length > 0 && (
        <section className="animate-pop-in rounded-3xl border-2 border-accent bg-accent/10 p-4">
          <p className="font-extrabold">Badge baru! 🏅</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {result.badges.map((b) => (
              <li key={b.id} className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-bold">
                <span className="text-xl" aria-hidden>
                  {b.icon}
                </span>
                {b.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.quests_completed.length > 0 && (
        <section className="animate-pop-in rounded-3xl border-2 border-success/50 bg-success/10 p-4">
          <p className="font-extrabold">Quest selesai! 🎯</p>
          <ul className="mt-1 text-sm">
            {result.quests_completed.map((q) => (
              <li key={q.id}>
                ✅ {q.title} <span className="font-bold text-success">+{q.reward_points}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {points.level_up && points.level && (
        <div className="animate-pop-in rounded-3xl border-2 border-accent bg-accent/10 p-4 text-center">
          <p className="text-3xl" aria-hidden>
            🆙
          </p>
          <p className="mt-1 font-extrabold">Naik level!</p>
          <p className="text-sm text-muted">
            Sekarang kamu <strong className="text-foreground">{points.level.title}</strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-border bg-surface p-4 text-center">
          <p className="streak-flame text-3xl" aria-hidden>
            🔥
          </p>
          <p className="mt-1 text-2xl font-extrabold">{points.streak.current} hari</p>
          <p className="text-xs text-muted">
            {points.streak.milestone
              ? `Bonus streak ${points.streak.milestone} hari!`
              : "Streak baca"}
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-4 text-center">
          <p className="text-3xl" aria-hidden>
            💎
          </p>
          <p className="mt-1 text-2xl font-extrabold">{points.points_total}</p>
          <p className="text-xs text-muted">Total poin</p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-4">
        <LevelProgress level={points.level} points={points.points_total} />
      </div>

      <PostCard post={post} />

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/books/${post.book.id}`}
          className="grid h-12 place-items-center rounded-2xl border border-border bg-surface font-bold"
        >
          Lihat diskusi buku
        </Link>
        <Link
          href="/"
          className="grid h-12 place-items-center rounded-2xl bg-primary font-bold text-primary-foreground"
        >
          Ke beranda
        </Link>
      </div>
    </div>
  );
}
