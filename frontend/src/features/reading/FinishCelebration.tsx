import { ArrowUpCircle, Award, Coins, Flame, Target } from "lucide-react";
import Link from "next/link";

import { CountUp } from "@/components/CountUp";
import { LevelProgress } from "@/components/LevelProgress";
import { PostCard } from "@/components/PostCard";
import { BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS } from "@/components/ui";
import type { FinishResult } from "@/lib/types";
import { formatDuration } from "@/lib/words";

/** Potongan kertas stabilo/tinta: satu-satunya animasi orkestrasi di app (mati saat reduced motion). */
const CONFETTI = ["var(--highlight)", "var(--ink)", "var(--leaf)", "var(--highlight)", "var(--rating)", "var(--ink)", "var(--highlight)", "var(--leaf)", "var(--highlight)"];

export function FinishCelebration({ result }: { result: FinishResult }) {
  const { session, post, points } = result;
  return (
    <div className="relative flex flex-col gap-4 pb-6">
      <div className="pointer-events-none absolute inset-x-0 -top-4 h-44 overflow-hidden" aria-hidden>
        {CONFETTI.map((color, i) => (
          <span
            key={i}
            className="confetti-piece absolute top-0 h-4 w-2 rounded-[1px]"
            style={{ left: `${6 + i * 10.5}%`, background: color, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      <div className="pt-10 text-center">
        <h1 className="text-[32px] leading-tight">Sesi selesai</h1>
        <p className="mt-2 text-muted">
          Kamu membaca <mark className="font-semibold text-ink">{formatDuration(session.active_seconds)}</mark> hari ini.
        </p>
      </div>

      <section className="rounded-2xl bg-highlight p-5 text-on-highlight" aria-label="Poin">
        <p className="text-sm font-semibold">Poin didapat</p>
        <p className="font-display text-6xl font-semibold tabular-nums" aria-live="polite">
          +<CountUp to={points.total_awarded} />
        </p>
        {points.awarded.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1 border-t border-on-highlight/20 pt-3 text-sm">
            {points.awarded.map((a) => (
              <li key={a.rule_code} className="flex justify-between gap-3">
                <span>{a.name}</span>
                <span className="font-semibold tabular-nums">+{a.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm">Batas poin harian sudah tercapai. Catatanmu tetap tersimpan.</p>
        )}
        {!session.is_full_points && points.awarded.length > 0 && (
          <p className="mt-3 text-xs">Sesi poin penuh hari ini sudah didapat sebelumnya.</p>
        )}
      </section>

      {result.badges.length > 0 && (
        <section className="card p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Award className="size-5 text-rating" aria-hidden /> Badge baru
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {result.badges.map((b) => (
              <li key={b.id} className="flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5 text-sm font-semibold">
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
        <section className="card p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Target className="size-5 text-leaf" aria-hidden /> Quest selesai
          </p>
          <ul className="mt-1 text-sm">
            {result.quests_completed.map((q) => (
              <li key={q.id} className="flex justify-between gap-3 py-0.5">
                {q.title} <span className="font-semibold text-leaf tabular-nums">+{q.reward_points}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {points.level_up && points.level && (
        <div className="card flex items-center gap-3 p-4">
          <ArrowUpCircle className="size-8 shrink-0 text-leaf" aria-hidden />
          <p>
            <span className="block font-semibold">Naik level</span>
            <span className="text-sm text-muted">
              Sekarang kamu <strong className="text-ink">{points.level.title}</strong>
            </span>
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col-reverse p-4 text-center">
          <dt className="text-xs text-muted">
            {points.streak.milestone ? `Bonus streak ${points.streak.milestone} hari` : "Streak baca"}
          </dt>
          <dd className="flex items-center justify-center gap-1.5 font-display text-2xl font-semibold">
            <Flame className="size-5 text-rating" aria-hidden /> {points.streak.current} hari
          </dd>
        </div>
        <div className="card flex flex-col-reverse p-4 text-center">
          <dt className="text-xs text-muted">Total poin</dt>
          <dd className="flex items-center justify-center gap-1.5 font-display text-2xl font-semibold tabular-nums">
            <Coins className="size-5 text-rating" aria-hidden /> {points.points_total}
          </dd>
        </div>
      </dl>

      <div className="card p-4">
        <LevelProgress level={points.level} points={points.points_total} />
      </div>

      <PostCard post={post} />

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/books/${post.book.id}`} className={`${BUTTON_BASE} ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.ghost}`}>
          Diskusi buku
        </Link>
        <Link href="/" className={`${BUTTON_BASE} ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary}`}>
          Ke beranda
        </Link>
      </div>
    </div>
  );
}
