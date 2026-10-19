"use client";

import { BookOpen, Flame, Snowflake, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { ProgressBar } from "@/components/ProgressBar";
import { BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS, Skeleton } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { useShellData } from "@/features/shell/useShellData";
import { useT } from "@/features/ui-config/store";
import { api } from "@/lib/api";
import { todayHeadline } from "@/lib/today";
import type { ReadingSession } from "@/lib/types";

const DATE = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" });

/**
 * Hal pertama di Beranda: sisa menit hari ini, progres stabilo, streak, dan satu CTA yang
 * langsung melanjutkan buku terakhir (`/read?book=…` membuka layar konfirmasi buku).
 */
export function TodayHero() {
  const t = useT();
  const { user } = useAuth();
  const { progress, points } = useShellData();
  const [last, setLast] = useState<ReadingSession["book"] | null | undefined>(undefined);

  useEffect(() => {
    api<ReadingSession[]>("/sessions?limit=1")
      .then((rows) => setLast(rows[0]?.book ?? null))
      .catch(() => setLast(null));
  }, []);

  if (!progress || !user) {
    return (
      <section className="card min-h-[348px] p-5 sm:min-h-[268px] sm:p-6" aria-busy="true" aria-label="Memuat target hari ini">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-3 h-8 w-4/5" />
        <Skeleton className="mt-2 h-8 w-1/2" />
        <Skeleton className="mt-5 h-4 w-full" />
        <Skeleton className="mt-6 h-12 w-full rounded-xl" />
      </section>
    );
  }

  const weekly = progress.target_mode === "weekly";
  const value = weekly ? progress.week_minutes : progress.today_minutes;
  const target = weekly ? progress.weekly_target_minutes : progress.daily_target_minutes;
  const done = value >= target;
  const streak = points?.streak;
  const ctaHref = last ? `/read?book=${last.id}` : "/read";
  const ctaLabel = last ? `Lanjut baca ${last.title}` : t("nav.start_reading");

  return (
    <section className="card relative min-h-[348px] overflow-hidden p-5 sm:min-h-[268px] sm:p-6" aria-labelledby="today-title">
      <p className="text-sm font-medium text-muted first-letter:uppercase">{DATE.format(new Date())}</p>
      <h1 id="today-title" className="mt-1 max-w-[24ch] text-[28px] leading-[1.18] text-balance sm:text-[32px]">
        {todayHeadline({ minutes: value, target, name: user.name, weekly })}
      </h1>

      <div className="mt-5">
        <ProgressBar value={value} max={target} size="lg" label={weekly ? "Progres target minggu ini" : "Progres target hari ini"} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <span className={done ? "font-semibold text-leaf" : "text-muted"}>
            <span className="font-semibold text-ink tabular-nums">{value}</span> dari {target} menit
            {weekly ? " minggu ini" : ""}
          </span>
          {streak && (
            <span className="flex items-center gap-3 text-muted">
              <span className="flex items-center gap-1 font-semibold text-ink">
                <Flame className={`size-4 ${streak.current ? "text-rating" : "text-muted"}`} aria-hidden />
                {streak.current} hari beruntun
              </span>
              {streak.freezes_per_month > 0 && (
                <span className="flex items-center gap-1" title="Jatah libur streak bulan ini">
                  <Snowflake className="size-4" aria-hidden />
                  {streak.freezes_left} freeze
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href={ctaHref}
          className={`${BUTTON_BASE} ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary} min-w-0 sm:flex-1`}
        >
          <BookOpen className="size-5 shrink-0" aria-hidden />
          <span className="truncate">{last === undefined ? t("nav.start_reading") : ctaLabel}</span>
        </Link>
        <Link href="/read?mode=micro" className={`${BUTTON_BASE} ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.ghost} sm:w-auto`}>
          <Zap className="size-4 text-rating" aria-hidden />
          {t("nav.micro_reading")}
        </Link>
      </div>
    </section>
  );
}

/** Strip ringkas "rekan yang sudah membaca" untuk HP/tablet (desktop lebar: panel kanan). */
export function TeamStrip() {
  const { team } = useShellData();
  if (!team) return <Skeleton className="h-[66px] w-full rounded-2xl sm:h-[60px] xl:hidden" />;
  const { members, readers_today } = team.team;
  const faces = team.top_readers.slice(0, 4);
  return (
    <Link
      href="/stats"
      className="card flex min-h-[66px] items-center sm:min-h-[60px] gap-3 px-4 py-3 transition hover:bg-surface-muted xl:hidden"
    >
      <span className="flex shrink-0">
        {faces.map((f, i) => (
          <span key={f.user_id} className={`rounded-full ring-2 ring-surface ${i ? "-ml-1.5" : ""}`}>
            <Avatar name={f.name} url={f.avatar_url} size="sm" />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1 text-sm text-muted">
        <span className="font-semibold text-ink tabular-nums">{readers_today}</span> dari {members} rekan sudah membaca
        hari ini
      </span>
    </Link>
  );
}
