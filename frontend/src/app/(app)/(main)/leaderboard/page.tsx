"use client";

import { Building2, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Avatar } from "@/components/PostCard";
import { BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS, EmptyState, FullScreenSpinner, Tabs } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  CATEGORIES,
  categoryInfo,
  entryKey,
  entryName,
  formatScore,
} from "@/features/leaderboard/categories";
import { api } from "@/lib/api";
import type { Leaderboard, LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod } from "@/lib/types";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "all_time", label: "Sepanjang masa" },
];

function Podium({ entries, unit }: { entries: LeaderboardEntry[]; unit: string }) {
  // Tiga teratas sebagai punggung buku di rak: tinggi mengikuti peringkat, juara 1 ditandai stabilo.
  // DOM berurutan 1-2-3 (dibacakan benar oleh pembaca layar); tampilan 2-1-3 lewat `order`.
  const order = [entries[0], entries[1], entries[2]];
  const heights = ["h-32", "h-24", "h-20"];
  const visual = ["order-2", "order-1", "order-3"];
  return (
    <ol className="grid grid-cols-3 items-end gap-2 border-b-4 border-ink pt-2 dark:border-line" aria-label="Tiga teratas">
      {order.map((entry, i) =>
        entry ? (
          <li key={entryKey(entry)} className={`flex min-w-0 flex-col items-center text-center ${visual[i]}`}>
            {entry.user ? (
              <Avatar name={entry.user.name} url={entry.user.avatar_url} userId={entry.user.id} />
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-surface-muted" aria-hidden>
                <Building2 className="size-5" />
              </span>
            )}
            <p className="mt-1.5 line-clamp-2 text-sm leading-tight font-semibold">{entryName(entry)}</p>
            <p className="text-xs text-muted tabular-nums">
              {formatScore(entry.score)} {unit}
            </p>
            <div
              className={`relative mt-2 flex w-[78%] items-start justify-center rounded-t-[4px] pt-2 ${heights[i]} ${
                i === 0 ? "bg-highlight text-on-highlight" : "bg-ink text-paper dark:bg-surface-muted dark:text-ink"
              }`}
            >
              <span aria-hidden className="absolute inset-x-0 top-5 h-px bg-current opacity-30" />
              <span aria-hidden className="absolute inset-x-0 bottom-5 h-px bg-current opacity-30" />
              <span className="font-display text-2xl font-semibold">
                <span className="sr-only">Peringkat </span>
                {entry.rank}
              </span>
            </div>
          </li>
        ) : (
          <li key={`empty-${i}`} className={visual[i]} aria-hidden />
        ),
      )}
    </ol>
  );
}

function LeaderboardView() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const category = (params.get("category") as LeaderboardCategory | null) ?? "top_storyteller";
  const period = (params.get("period") as LeaderboardPeriod | null) ?? "weekly";
  const periodKey = params.get("key");
  const [data, setData] = useState<Leaderboard | null>(null);

  useEffect(() => {
    const query = new URLSearchParams({ category, period });
    if (periodKey) query.set("period_key", periodKey);
    let cancelled = false;
    api<Leaderboard>(`/leaderboard?${query}`)
      .then((d) => !cancelled && setData(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [category, period, periodKey]);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`/leaderboard?${next}`, { scroll: false });
  }

  const info = categoryInfo(category);
  const isMine = (entry: LeaderboardEntry) =>
    entry.user ? entry.user.id === user?.id : entry.function?.id === user?.function_id;

  const ahead = data?.me ? data.entries.find((e) => e.rank === data.me!.rank - 1) : undefined;
  const gapToNext = data?.me && ahead ? ahead.score - data.me.score : null;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-[26px] leading-tight">Papan peringkat</h1>
        <p className="mt-1 text-muted">{info.description}</p>
      </div>

      <Tabs
        label="Kategori"
        variant="pill"
        className="-mx-4 px-4 pb-1 sm:mx-0 sm:px-0"
        items={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
        value={category}
        onChange={(v) => go({ category: v })}
      />

      <div className="grid grid-cols-3 rounded-xl border border-line bg-surface p-1" role="group" aria-label="Periode">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={period === p.value}
            onClick={() => go({ period: p.value, key: null })}
            className={`min-h-10 rounded-lg text-sm font-semibold transition ${
              period === p.value ? "bg-ink text-paper dark:bg-highlight dark:text-on-highlight" : "text-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm font-semibold">
          <button
            type="button"
            disabled={!data.prev_key}
            onClick={() => go({ key: data.prev_key })}
            aria-label="Periode sebelumnya"
            className="grid size-11 place-items-center rounded-full border border-line hover:bg-surface-muted disabled:invisible"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <span>
            {data.label}
            {data.is_final && <span className="ml-2 text-xs text-muted">(final)</span>}
          </span>
          <button
            type="button"
            disabled={!data.next_key}
            onClick={() => go({ key: data.next_key })}
            aria-label="Periode berikutnya"
            className="grid size-11 place-items-center rounded-full border border-line hover:bg-surface-muted disabled:invisible"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      )}

      {!data ? (
        <p className="py-8 text-center text-sm text-muted">Memuat peringkat…</p>
      ) : data.entries.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-6" />}
          title="Belum ada peringkat di periode ini"
          body="Peringkat muncul setelah ada sesi baca yang selesai pada periode ini."
          action={
            <Link href="/read" className={`${BUTTON_BASE} ${BUTTON_SIZES.sm} ${BUTTON_VARIANTS.primary}`}>
              Mulai sesi baca
            </Link>
          }
        />
      ) : (
        <>
          <Podium entries={data.entries.slice(0, 3)} unit={info.unit} />
          <ol className="flex flex-col gap-2">
            {data.entries.slice(3).map((entry) => (
              <li
                key={entryKey(entry)}
                aria-current={isMine(entry) ? "true" : undefined}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 ${
                  isMine(entry) ? "border-ink bg-highlight/35 dark:border-highlight dark:bg-highlight/10" : "border-line bg-surface"
                }`}
              >
                <span className="w-7 text-center font-display text-lg font-semibold text-muted">{entry.rank}</span>
                {entry.user ? (
                  <Avatar name={entry.user.name} url={entry.user.avatar_url} />
                ) : (
                  <span className="grid size-10 place-items-center rounded-full bg-surface-muted" aria-hidden>
                    <Building2 className="size-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-semibold">{entryName(entry)}</span>
                <span className="font-bold tabular-nums">
                  {formatScore(entry.score)}
                  <span className="ml-1 text-xs font-semibold text-muted">{info.unit}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      {data && (
        <div className="sticky bottom-28 z-10 rounded-2xl bg-ink p-4 text-paper shadow-[0_8px_24px_rgb(27_35_64/0.25)] lg:bottom-6 dark:bg-highlight dark:text-on-highlight">
          {data.me ? (
            <>
              <p className="flex items-baseline justify-between gap-3 font-semibold">
                <span>
                  {category === "function_battle" ? "Fungsimu" : "Posisimu"}{" "}
                  <span className="font-display text-2xl">#{data.me.rank}</span>{" "}
                  <span className="text-sm font-medium opacity-75">dari {data.me.total_participants}</span>
                </span>
                <span className="tabular-nums">
                  {formatScore(data.me.score)} {info.unit}
                </span>
              </p>
              {gapToNext !== null && gapToNext > 0 && (
                <p className="mt-1 text-sm opacity-80">
                  {formatScore(gapToNext)} {info.unit} lagi untuk naik ke #{data.me.rank - 1}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm font-semibold">
              Kamu belum masuk peringkat periode ini. Selesaikan satu sesi baca untuk ikut.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <LeaderboardView />
    </Suspense>
  );
}
