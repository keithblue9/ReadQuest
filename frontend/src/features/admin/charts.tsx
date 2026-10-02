"use client";

import { useState } from "react";

type Daily = { date: string; minutes: number; readers: number };

const SHORT = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });

/** Kolom menit baca per hari (satu seri → tanpa legenda; judul menamai seri). */
export function DailyBars({ data }: { data: Daily[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.minutes));
  const slot = 100 / data.length;
  const peak = data.reduce((best, d, i) => (d.minutes > data[best].minutes ? i : best), 0);

  const center = active === null ? 0 : (active + 0.5) * slot;
  // Tooltip tetap di dalam kartu: rata kiri/kanan di tepi grafik.
  const align = center < 15 ? "translate-x-0" : center > 85 ? "-translate-x-full" : "-translate-x-1/2";

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative">
        <div
          role="group"
          aria-label={`Menit baca per hari, puncak ${data[peak]?.minutes ?? 0} menit`}
          className="flex h-40 items-end border-b border-border"
          onPointerLeave={() => setActive(null)}
        >
          {data.map((d, i) => (
            <button
              key={d.date}
              type="button"
              aria-label={`${SHORT.format(new Date(d.date))}: ${d.minutes} menit, ${d.readers} pembaca`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="flex h-full min-w-0 flex-1 items-end justify-center rounded-t-md outline-none focus-visible:bg-primary/10"
            >
              {d.minutes > 0 && (
                // Satu seri: batang ≤24px, ujung data membulat 4px, celah antar batang dari lebar slot.
                <span
                  className={`block w-[62%] max-w-6 rounded-t-[4px] transition-colors ${
                    active === i ? "bg-primary" : "bg-primary/70"
                  }`}
                  style={{ height: `${Math.max(2, (d.minutes / max) * 100 * 0.94)}%` }}
                />
              )}
            </button>
          ))}
        </div>
        {active !== null && data[active] && (
          <div
            role="tooltip"
            className={`pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-xl bg-foreground px-3 py-2 text-xs text-background shadow-lg ${align}`}
            style={{ left: `${center}%` }}
          >
            <strong className="block text-sm">{data[active].minutes} menit</strong>
            {data[active].readers} pembaca · {SHORT.format(new Date(data[active].date))}
          </div>
        )}
      </div>
      <figcaption className="flex items-center justify-between text-xs text-muted">
        <span>
          {SHORT.format(new Date(data[0].date))} – {SHORT.format(new Date(data[data.length - 1].date))} · puncak{" "}
          <strong className="text-foreground">{data[peak].minutes} menit</strong>
        </span>
        <button type="button" className="font-bold text-primary" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Sembunyikan tabel" : "Lihat tabel"}
        </button>
      </figcaption>
      {showTable && (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-muted text-left text-xs text-muted">
              <tr>
                <th className="px-3 py-1.5">Tanggal</th>
                <th className="px-3 py-1.5 text-right">Menit</th>
                <th className="px-3 py-1.5 text-right">Pembaca</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="px-3 py-1">{SHORT.format(new Date(d.date))}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{d.minutes}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{d.readers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

type HeatRow = { function_id: string; function: string; members: number; values: number[] };

// Satu hue (primary), terang → gelap. Teks memakai tinta teks, bukan warna data.
const STEPS = [0.08, 0.22, 0.4, 0.6, 0.85];

/** Heatmap rata-rata menit per anggota per hari, per fungsi × hari dalam seminggu. */
export function FunctionHeatmap({ rows, weekdays }: { rows: HeatRow[]; weekdays: string[] }) {
  const max = Math.max(0, ...rows.flatMap((r) => r.values));
  const step = (v: number) => (v <= 0 || max <= 0 ? -1 : Math.min(STEPS.length - 1, Math.floor((v / max) * STEPS.length)));
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th className="text-left font-semibold text-muted">Fungsi</th>
              {weekdays.map((d) => (
                <th key={d} className="w-12 font-semibold text-muted">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.function_id}>
                <th scope="row" className="pr-2 text-left font-semibold whitespace-nowrap">
                  {row.function} <span className="font-normal text-muted">({row.members})</span>
                </th>
                {row.values.map((v, i) => {
                  const s = step(v);
                  return (
                    <td
                      key={i}
                      title={`${row.function} · ${weekdays[i]}: ${v} menit/anggota/hari`}
                      tabIndex={0}
                      className={`h-9 rounded-md text-center font-bold tabular-nums ${
                        s >= 3 ? "text-primary-foreground" : "text-foreground"
                      } ${s < 0 ? "bg-surface-muted text-muted" : ""}`}
                      style={s >= 0 ? { background: `color-mix(in oklab, var(--primary) ${STEPS[s] * 100}%, var(--surface))` } : undefined}
                    >
                      {v > 0 ? v : "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="flex items-center gap-2 text-xs text-muted">
        Rata-rata menit/anggota/hari
        <span className="flex items-center gap-[2px]" aria-hidden>
          {STEPS.map((s) => (
            <span
              key={s}
              className="h-3 w-5 rounded-sm"
              style={{ background: `color-mix(in oklab, var(--primary) ${s * 100}%, var(--surface))` }}
            />
          ))}
        </span>
        <span>0 → {max}</span>
      </figcaption>
    </figure>
  );
}
