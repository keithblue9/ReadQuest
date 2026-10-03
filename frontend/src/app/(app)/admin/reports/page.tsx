"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui";
import { downloadFile } from "@/features/admin/download";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { ParticipationPoint, ParticipationReport } from "@/lib/types";

const RANGES = [4, 8, 12, 26];

// Satu hue (primary), terang → gelap untuk tingkat partisipasi; teks tetap tinta teks.
function shade(rate: number): string {
  if (rate <= 0) return "transparent";
  const pct = Math.round(12 + rate * 68);
  return `color-mix(in oklab, var(--primary) ${pct}%, transparent)`;
}

function weekLabel(week: string) {
  return `M${week.split("-W")[1]}`;
}

/** Kolom partisipasi keseluruhan per minggu (satu seri, tooltip + label nilai terakhir). */
function OverallBars({ data }: { data: ParticipationPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const last = data[data.length - 1];
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative">
        <div className="flex h-40 items-end gap-1 border-b border-border" onPointerLeave={() => setActive(null)}>
          {data.map((p, i) => (
            <button
              key={p.week}
              type="button"
              aria-label={`${p.week}: partisipasi ${Math.round(p.rate * 100)}%, ${p.readers} dari ${p.members} anggota, ${p.minutes} menit`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="flex h-full flex-1 items-end justify-center outline-none focus-visible:bg-primary/10"
            >
              <span
                className={`block w-[70%] max-w-8 rounded-t-[4px] ${active === i ? "bg-primary" : "bg-primary/70"}`}
                style={{ height: `${Math.max(p.rate > 0 ? 3 : 0, p.rate * 94)}%` }}
              />
            </button>
          ))}
        </div>
        {active !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-foreground px-3 py-2 text-xs text-background shadow-lg"
            style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
          >
            <strong className="block text-sm">{Math.round(data[active].rate * 100)}% partisipasi</strong>
            {data[active].readers}/{data[active].members} anggota · {data[active].minutes} menit · {data[active].week}
          </div>
        )}
      </div>
      <figcaption className="flex justify-between text-xs text-muted">
        <span>{weekLabel(data[0].week)}</span>
        <span>
          Minggu ini: <strong className="text-foreground">{Math.round(last.rate * 100)}%</strong> ({last.readers}/{last.members})
        </span>
      </figcaption>
    </figure>
  );
}

export default function ReportsPage() {
  const [weeks, setWeeks] = useState(12);
  const [report, setReport] = useState<ParticipationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [metric, setMetric] = useState<"rate" | "avg">("rate");

  useEffect(() => {
    let cancelled = false;
    api<ParticipationReport>(`/reports/participation?weeks=${weeks}`)
      .then((r) => !cancelled && setReport(r))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [weeks]);

  async function exportAs(kind: "csv" | "xlsx") {
    setExporting(kind);
    try {
      await downloadFile(`/reports/participation.${kind}?weeks=${weeks}`, `partisipasi-divisi-${weeks}minggu.${kind}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Laporan Divisi</h1>
          <p className="text-sm text-muted">
            Tren partisipasi membaca per fungsi. Hanya angka agregat; fungsi dengan anggota kurang dari{" "}
            {report?.min_group_size ?? 3} orang digabung agar tidak bisa ditelusuri ke individu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Rentang minggu"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
          >
            {RANGES.map((w) => (
              <option key={w} value={w}>
                {w} minggu terakhir
              </option>
            ))}
          </select>
          {(["xlsx", "csv"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => exportAs(kind)}
              disabled={exporting !== null}
              className="flex h-10 items-center gap-2 rounded-lg bg-surface-muted px-3 text-sm font-semibold disabled:opacity-60"
            >
              <Download className="size-4" aria-hidden /> {exporting === kind ? "Menyiapkan…" : kind.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {error && <Alert>{error}</Alert>}
      {!report ? (
        <div className="card h-64 animate-pulse" aria-busy="true" />
      ) : (
        <>
          <div className="card p-4">
            <h2 className="mb-3 text-[15px] font-semibold">Partisipasi seluruh tim per minggu</h2>
            <OverallBars data={report.overall} />
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
              <h2 className="text-[15px] font-semibold">Per fungsi</h2>
              <div className="flex gap-1 rounded-lg bg-surface-muted p-1" role="group" aria-label="Metrik">
                {(
                  [
                    ["rate", "Partisipasi %"],
                    ["avg", "Menit/anggota"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={metric === value}
                    onClick={() => setMetric(value)}
                    className={`h-8 rounded-md px-3 text-xs font-semibold ${metric === value ? "bg-surface shadow-sm" : "text-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-[2px] text-sm">
                <thead>
                  <tr className="text-xs text-muted">
                    <th className="sticky left-0 bg-surface px-3 py-2 text-left font-semibold">Fungsi</th>
                    <th className="px-2 py-2 text-right font-semibold">Anggota</th>
                    {report.weeks.map((w) => (
                      <th key={w} className="min-w-12 px-1 py-2 font-semibold" title={w}>
                        {weekLabel(w)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.functions.map((row) => {
                    const maxAvg = Math.max(1, ...row.series.map((p) => p.avg_minutes_per_member));
                    return (
                      <tr key={row.function}>
                        <th scope="row" className="sticky left-0 bg-surface px-3 py-1.5 text-left font-medium whitespace-nowrap">
                          {row.function}
                        </th>
                        <td className="px-2 text-right text-muted tabular-nums">{row.members}</td>
                        {row.series.map((p) => {
                          const value = metric === "rate" ? p.rate : p.avg_minutes_per_member / maxAvg;
                          return (
                            <td
                              key={p.week}
                              className="rounded px-1 py-1.5 text-center text-xs tabular-nums"
                              style={{ background: shade(value) }}
                              title={`${row.function} · ${p.week}: ${p.readers}/${p.members} anggota, ${p.minutes} menit`}
                            >
                              {metric === "rate" ? `${Math.round(p.rate * 100)}` : p.avg_minutes_per_member}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-4 py-2 text-xs text-muted">
              {metric === "rate" ? "Angka = % anggota yang membaca minimal sekali pada minggu itu." : "Angka = rata-rata menit baca per anggota."}{" "}
              Warna lebih gelap = lebih tinggi.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
