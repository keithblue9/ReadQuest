"use client";

import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { CountUp } from "@/components/CountUp";

/** Kartu angka utama: satu angka besar + konteks. */
export function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-2 text-xs font-semibold text-muted">
        <span className="grid size-7 place-items-center rounded-md bg-surface-muted text-ink">
          <Icon className="size-4" aria-hidden />
        </span>
        {label}
      </p>
      <p className="mt-2 font-display text-[28px] leading-none font-semibold tabular-nums">
        <CountUp to={value} />
        {suffix && <span className="ml-1 font-sans text-base font-semibold text-muted">{suffix}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Donat satu nilai (persentase), satu hue; angka di tengah memakai tinta teks. */
export function Donut({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 128 128" className="size-36" role="img" aria-label={`${label}: ${pct}%`}>
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" className="stroke-line" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="butt"
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 64 64)"
        />
        <text x="64" y="73" textAnchor="middle" className="fill-ink font-display text-[30px] font-semibold">
          {pct}%
        </text>
      </svg>
      <figcaption className="text-center text-xs font-semibold text-muted">{label}</figcaption>
    </figure>
  );
}

type FnRow = { function: string; members: number; readers: number; rate: number };

/** Batang horizontal partisipasi per fungsi (satu seri, tooltip lewat hover/fokus + label nilai). */
export function FunctionBars({ rows }: { rows: FnRow[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (!rows.length) return <p className="text-sm text-muted">Belum ada data fungsi.</p>;
  return (
    <ul className="flex flex-col gap-2.5" onPointerLeave={() => setActive(null)}>
      {rows.map((r, i) => (
        <li key={r.function}>
          <button
            type="button"
            className="block w-full rounded-lg text-left"
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            aria-label={`${r.function}: ${r.readers} dari ${r.members} anggota membaca minggu ini (${Math.round(r.rate * 100)}%)`}
          >
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-semibold">{r.function}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {r.readers}/{r.members} · <strong className="text-ink">{Math.round(r.rate * 100)}%</strong>
              </span>
            </span>
            <span className="mt-1 block h-2.5 overflow-hidden rounded-[3px] bg-line">
              <span
                className={`block h-full rounded-[3px] transition-all duration-700 ${
                  active === null || active === i ? "bg-primary" : "bg-primary/45"
                }`}
                style={{ width: `${r.rate > 0 ? Math.max(3, r.rate * 100) : 0}%` }}
              />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Mini batang 7 hari untuk kartu pribadi. */
export function WeekSpark({ data, target }: { data: { date: string; minutes: number }[]; target: number }) {
  const max = Math.max(target, ...data.map((d) => d.minutes), 1);
  const day = new Intl.DateTimeFormat("id-ID", { weekday: "short" });
  return (
    <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`Menit baca 7 hari terakhir: ${data.map((d) => `${day.format(new Date(d.date))} ${d.minutes}`).join(", ")}`}>
      {data.map((d) => (
        <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span
            title={`${d.minutes} menit`}
            className={`block w-full max-w-7 rounded-t-[4px] ${d.minutes >= target ? "bg-leaf" : d.minutes > 0 ? "bg-primary" : "bg-line"}`}
            style={{ height: `${Math.max(4, (d.minutes / max) * 100 * 0.8)}%` }}
          />
          <span className="text-xs font-semibold text-muted" aria-hidden>{day.format(new Date(d.date)).slice(0, 3)}</span>
        </div>
      ))}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card flex flex-col gap-3 p-4 md:p-5 ${className}`}>
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
