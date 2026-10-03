"use client";

import { CalendarPlus, ChevronRight, Flame, Snowflake, Timer, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { BookCover } from "@/components/BookCover";
import { useAuth } from "@/features/auth/AuthProvider";
import { CalendarDialog } from "@/features/calendar/CalendarDialog";
import { useFeature, useT } from "@/features/ui-config/store";
import { api } from "@/lib/api";
import type { BookOfMonth } from "@/lib/types";

import { useShellData } from "./useShellData";

export function RailCard({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      {title && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-muted">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Cincin progres satu nilai (target harian/mingguan). */
export function ProgressRing({ value, max, size = 76 }: { value: number; max: number; size?: number }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = pct >= 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-muted" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className={`transition-[stroke-dashoffset] duration-700 ${done ? "stroke-success" : "stroke-primary"}`}
      />
    </svg>
  );
}

/** Target hari ini / minggu ini + streak & freeze + tombol cepat. */
export function TargetCard({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { progress, points } = useShellData();
  if (!progress) {
    return (
      <RailCard>
        <div className="h-20 animate-pulse rounded-lg bg-surface-muted" />
      </RailCard>
    );
  }
  const weekly = progress.target_mode === "weekly";
  const value = weekly ? progress.week_minutes : progress.today_minutes;
  const target = weekly ? progress.weekly_target_minutes : progress.daily_target_minutes;
  const left = Math.max(0, target - value);
  const streak = points?.streak;

  return (
    <RailCard>
      <div className="flex items-center gap-4">
        <div className="relative">
          <ProgressRing value={value} max={target} />
          <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">
            {Math.round(Math.min(1, value / Math.max(1, target)) * 100)}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {weekly ? "Target minggu ini" : "Target hari ini"}
          </p>
          <p className="text-xl font-bold tabular-nums">
            {value}
            <span className="text-sm font-semibold text-muted"> / {target} menit</span>
          </p>
          <p className={`text-sm ${left ? "text-muted" : "font-semibold text-success"}`}>
            {left ? `${left} menit lagi` : "Target tercapai ✓"}
          </p>
        </div>
      </div>

      {streak && (
        <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-sm">
          <span className="flex items-center gap-1.5 font-semibold">
            <Flame className={`size-4 ${streak.current ? "text-orange-500" : "text-muted"}`} aria-hidden />
            {streak.current} hari beruntun
          </span>
          {streak.freezes_per_month > 0 && (
            <span
              className="flex items-center gap-1.5 text-muted"
              title="Jatah libur streak bulan ini: hari terlewat otomatis dibekukan"
            >
              <Snowflake className="size-4 text-sky-500" aria-hidden />
              {streak.freezes_left} freeze
            </span>
          )}
        </div>
      )}

      {!compact && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/read?mode=micro"
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-surface-muted text-sm font-semibold hover:brightness-95"
          >
            <Zap className="size-4 text-amber-500" aria-hidden /> {t("nav.micro_reading")}
          </Link>
          <Link
            href="/read"
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            <Timer className="size-4" aria-hidden /> {t("home.composer_read")}
          </Link>
        </div>
      )}
    </RailCard>
  );
}

export function TeamTodayCard() {
  const { team } = useShellData();
  if (!team) return null;
  const { members, readers_today, reading_now, participation_week } = team.team;
  return (
    <RailCard
      title="Tim hari ini"
      action={
        <Link href="/stats" className="flex items-center text-sm font-semibold text-primary">
          Statistik <ChevronRight className="size-4" aria-hidden />
        </Link>
      }
    >
      <p className="text-2xl font-bold tabular-nums">
        {readers_today}
        <span className="text-sm font-semibold text-muted"> dari {members} sudah membaca</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${members ? Math.max(2, (readers_today / members) * 100) : 0}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {reading_now > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-2 animate-pulse rounded-full bg-success" aria-hidden />
            {reading_now} sedang membaca
          </span>
        )}
        <span>Partisipasi 7 hari {Math.round(participation_week * 100)}%</span>
      </div>
    </RailCard>
  );
}

export function TopReadersCard() {
  const { team } = useShellData();
  const board = useFeature("leaderboard");
  if (!team || team.top_readers.length === 0) return null;
  return (
    <RailCard
      title="Teratas minggu ini"
      action={
        board && (
          <Link href="/leaderboard" className="text-sm font-semibold text-primary">
            Lihat semua
          </Link>
        )
      }
    >
      <ol className="flex flex-col gap-2.5">
        {team.top_readers.slice(0, 5).map((r, i) => (
          <li key={r.user_id} className="flex items-center gap-3">
            <span className="w-4 text-center text-sm font-bold text-muted tabular-nums">{i + 1}</span>
            <Avatar name={r.name} url={r.avatar_url} size="sm" userId={r.user_id} />
            <Link href={`/u/${r.user_id}`} className="min-w-0 flex-1 hover:underline">
              <span className="block truncate text-sm font-semibold">{r.name}</span>
              {r.function && <span className="block truncate text-xs text-muted">{r.function}</span>}
            </Link>
            <span className="text-sm font-semibold tabular-nums text-muted">{r.minutes} mnt</span>
          </li>
        ))}
      </ol>
    </RailCard>
  );
}

export function BookOfMonthCard() {
  const on = useFeature("book_of_month");
  const [bom, setBom] = useState<BookOfMonth | null>(null);
  useEffect(() => {
    if (!on) return;
    api<BookOfMonth>("/book-of-the-month").then(setBom).catch(() => undefined);
  }, [on]);
  if (!on || !bom?.book) return null;
  return (
    <RailCard title="Book of the Month">
      <Link href={`/books/${bom.book.id}`} className="flex items-center gap-3">
        <BookCover url={bom.book.cover_url} title={bom.book.title} size="sm" />
        <span className="min-w-0">
          <span className="line-clamp-2 font-semibold">{bom.book.title}</span>
          <span className="block truncate text-sm text-muted">{bom.book.authors.join(", ")}</span>
          <span className="text-xs text-muted">{bom.readers_this_month} pembaca bulan ini</span>
        </span>
      </Link>
    </RailCard>
  );
}

export function CalendarCard() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card flex w-full items-center gap-3 p-4 text-left transition hover:brightness-[0.98]"
      >
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <CalendarPlus className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Blok waktu baca</span>
          <span className="block text-sm text-muted">Tambahkan ke Google/Outlook Calendar</span>
        </span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </button>
      {open && user && <CalendarDialog onClose={() => setOpen(false)} />}
    </>
  );
}
