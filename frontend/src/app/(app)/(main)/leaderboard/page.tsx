"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Avatar } from "@/components/PostCard";
import { FullScreenSpinner } from "@/components/ui";
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
const MEDALS = ["🥇", "🥈", "🥉"];

function Podium({ entries, unit }: { entries: LeaderboardEntry[]; unit: string }) {
  const order = [entries[1], entries[0], entries[2]];
  const heights = ["h-20", "h-28", "h-16"];
  return (
    <div className="grid grid-cols-3 items-end gap-2 pt-4" aria-label="Tiga teratas">
      {order.map((entry, i) =>
        entry ? (
          <div
            key={entryKey(entry)}
            className="animate-pop-in flex flex-col items-center text-center"
            style={{ animationDelay: `${[120, 0, 240][i]}ms` }}
          >
            <span className="text-3xl" aria-hidden>
              {MEDALS[entry.rank - 1] ?? "🏅"}
            </span>
            {entry.user ? (
              <Avatar name={entry.user.name} url={entry.user.avatar_url} />
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-primary/15 text-lg" aria-hidden>
                🏢
              </span>
            )}
            <p className="mt-1 line-clamp-2 text-sm font-bold">{entryName(entry)}</p>
            <p className="text-xs text-muted">
              {formatScore(entry.score)} {unit}
            </p>
            <div
              className={`mt-2 w-full rounded-t-2xl ${heights[i]} ${
                i === 1 ? "bg-primary" : "bg-primary/40"
              } grid place-items-center text-2xl font-bold text-primary-foreground`}
            >
              {entry.rank}
            </div>
          </div>
        ) : (
          <div key={`empty-${i}`} />
        ),
      )}
    </div>
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

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-2xl font-bold">Papan Peringkat 🏆</h1>
        <p className="mt-1 text-muted">{info.description}</p>
      </div>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Kategori">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="tab"
            aria-selected={category === c.value}
            onClick={() => go({ category: c.value })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              category === c.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface"
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 rounded-2xl bg-surface-muted p-1" role="group" aria-label="Periode">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={period === p.value}
            onClick={() => go({ period: p.value, key: null })}
            className={`rounded-xl py-2 text-sm font-bold transition ${
              period === p.value ? "bg-surface shadow-sm" : "text-muted"
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
            className="grid size-9 place-items-center rounded-full border border-border disabled:invisible"
          >
            ←
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
            className="grid size-9 place-items-center rounded-full border border-border disabled:invisible"
          >
            →
          </button>
        </div>
      )}

      {!data ? (
        <p className="py-8 text-center text-sm text-muted">Memuat peringkat…</p>
      ) : data.entries.length === 0 ? (
        <div className="rounded-3xl bg-surface-muted p-6 text-center">
          <p className="text-3xl" aria-hidden>
            🌱
          </p>
          <p className="mt-2 font-semibold">Belum ada peringkat di periode ini.</p>
          <p className="text-sm text-muted">Jadilah yang pertama!</p>
        </div>
      ) : (
        <>
          <Podium entries={data.entries.slice(0, 3)} unit={info.unit} />
          <ol className="flex flex-col gap-2">
            {data.entries.slice(3).map((entry) => (
              <li
                key={entryKey(entry)}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${
                  isMine(entry) ? "border-primary bg-primary/10" : "border-border bg-surface"
                }`}
              >
                <span className="w-7 text-center font-bold text-muted">{entry.rank}</span>
                {entry.user ? (
                  <Avatar name={entry.user.name} url={entry.user.avatar_url} />
                ) : (
                  <span className="grid size-10 place-items-center rounded-full bg-primary/15" aria-hidden>
                    🏢
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
        <div className="sticky bottom-24 rounded-3xl bg-foreground p-4 text-background shadow-xl">
          {data.me ? (
            <p className="flex items-center justify-between font-bold">
              <span>
                {category === "function_battle" ? "Fungsimu" : "Posisimu"}: #{data.me.rank}{" "}
                <span className="text-sm font-semibold opacity-70">dari {data.me.total_participants}</span>
              </span>
              <span>
                {formatScore(data.me.score)} {info.unit}
              </span>
            </p>
          ) : (
            <p className="text-sm font-semibold">
              Kamu belum masuk peringkat periode ini — selesaikan sesi baca untuk ikut bersaing! 💪
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
