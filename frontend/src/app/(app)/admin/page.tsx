"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { DailyBars, FunctionHeatmap } from "@/features/admin/charts";
import { downloadFile } from "@/features/admin/download";
import { useAuth } from "@/features/auth/AuthProvider";
import { STATUS_STYLE } from "@/features/authenticity/StatusBadge";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { AuthenticityStatus } from "@/lib/types";

type Dashboard = {
  days: number;
  start: string;
  end: string;
  members: number;
  active_readers: number;
  participation_rate: number;
  total_minutes: number;
  avg_minutes_per_reader: number;
  avg_daily_minutes_per_reader: number;
  sessions: number;
  notes: number;
  books_finished: number;
  daily: { date: string; minutes: number; readers: number }[];
  weekdays: string[];
  heatmap: { function_id: string; function: string; members: number; values: number[] }[];
  authenticity_counts: Record<AuthenticityStatus, number>;
  observers: {
    user_id: string;
    name: string;
    function: string | null;
    own_notes: number;
    comments_given: number;
    likes_given: number;
    contribution_ratio: number;
  }[];
  top_books: { book_id: string; title: string; readers: number; minutes: number }[];
};

const PERIODS = [7, 30, 90];
const STATUS_ORDER: AuthenticityStatus[] = ["active_reader", "warming_up", "observer", "silent"];
const STATUS_LABEL: Record<AuthenticityStatus, string> = {
  active_reader: "Active Reader",
  warming_up: "Warming Up",
  observer: "Observer",
  silent: "Silent",
};
const fmt = new Intl.NumberFormat("id-ID");

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-extrabold">{title}</h2>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const canExport = user?.permissions.includes("admin.export");

  useEffect(() => {
    let alive = true;
    api<Dashboard>(`/admin/dashboard?days=${days}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(errorMessage(err)));
    return () => {
      alive = false;
    };
  }, [days]);

  async function exportReport(kind: "xlsx" | "pdf") {
    setExporting(kind);
    setError(null);
    try {
      await downloadFile(`/admin/export.${kind}?days=${days}`, `readquest-laporan-${days}hari.${kind}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  const totalStatus = data ? STATUS_ORDER.reduce((sum, s) => sum + data.authenticity_counts[s], 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard</h1>
          <p className="text-sm text-muted">
            {data ? `${data.start} s/d ${data.end}` : "Ringkasan aktivitas membaca tim"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Periode" className="flex rounded-xl border border-border bg-surface p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={days === p}
                onClick={() => {
                  setData(null);
                  setDays(p);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                  days === p ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {p} hari
              </button>
            ))}
          </div>
          {canExport && (
            <>
              <Button
                variant="ghost"
                className="h-10 w-auto px-3 text-sm"
                loading={exporting === "xlsx"}
                onClick={() => exportReport("xlsx")}
              >
                ⬇ Excel
              </Button>
              <Button
                variant="ghost"
                className="h-10 w-auto px-3 text-sm"
                loading={exporting === "pdf"}
                onClick={() => exportReport("pdf")}
              >
                ⬇ PDF
              </Button>
            </>
          )}
        </div>
      </header>

      {error && <Alert>{error}</Alert>}

      {!data ? (
        <p className="text-sm text-muted" aria-busy="true">
          Memuat dashboard…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Pembaca aktif"
              value={fmt.format(data.active_readers)}
              sub={`${Math.round(data.participation_rate * 100)}% dari ${data.members} anggota`}
            />
            <Stat
              label="Rata-rata menit / hari"
              value={fmt.format(data.avg_daily_minutes_per_reader)}
              sub={`per pembaca aktif · total ${fmt.format(data.avg_minutes_per_reader)} mnt`}
            />
            <Stat label="Total menit baca" value={fmt.format(data.total_minutes)} sub={`${fmt.format(data.sessions)} sesi`} />
            <Stat
              label="Catatan dibagikan"
              value={fmt.format(data.notes)}
              sub={`${fmt.format(data.books_finished)} buku selesai`}
            />
          </div>

          <Card title="Menit baca harian" sub="Total menit sesi valid seluruh anggota per hari">
            <DailyBars data={data.daily} />
          </Card>

          <Card title="Heatmap aktivitas per fungsi" sub="Rata-rata menit baca per anggota, menurut hari dalam seminggu">
            {data.heatmap.length ? (
              <FunctionHeatmap rows={data.heatmap} weekdays={data.weekdays} />
            ) : (
              <p className="text-sm text-muted">Belum ada fungsi aktif.</p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Reading Authenticity Index" sub="Status anggota aktif, jendela 30 hari">
              <ul className="grid grid-cols-2 gap-2">
                {STATUS_ORDER.map((s) => {
                  const count = data.authenticity_counts[s];
                  return (
                    <li key={s} className="rounded-xl bg-surface-muted p-3">
                      <p className="flex items-center gap-1.5 text-sm font-bold">
                        <span aria-hidden>{STATUS_STYLE[s].emoji}</span>
                        {STATUS_LABEL[s]}
                      </p>
                      <p className="mt-1 text-2xl font-extrabold tabular-nums">
                        {count}
                        <span className="ml-1 text-xs font-semibold text-muted">
                          {totalStatus ? `${Math.round((count / totalStatus) * 100)}%` : "0%"}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Buku paling banyak dibaca" sub={`${data.days} hari terakhir`}>
              {data.top_books.length ? (
                <ol className="flex flex-col gap-2">
                  {data.top_books.map((b, i) => (
                    <li key={b.book_id} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-right font-extrabold text-muted tabular-nums">{i + 1}</span>
                      <Link href={`/books/${b.book_id}`} className="min-w-0 flex-1 truncate font-bold hover:text-primary">
                        {b.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {b.readers} pembaca · {fmt.format(b.minutes)} mnt
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">Belum ada sesi baca.</p>
              )}
            </Card>
          </div>

          <Card
            title={`Daftar Observer (${data.observers.length})`}
            sub="Aktif bereaksi/berkomentar tetapi jarang menulis catatan sendiri — menerima nudge lembut otomatis"
          >
            {data.observers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-bold">Nama</th>
                      <th className="py-2 pr-3 font-bold">Fungsi</th>
                      <th className="py-2 pr-3 text-right font-bold">Catatan</th>
                      <th className="py-2 pr-3 text-right font-bold">Komentar</th>
                      <th className="py-2 pr-3 text-right font-bold">Like</th>
                      <th className="py-2 text-right font-bold">Rasio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.observers.map((o) => (
                      <tr key={o.user_id}>
                        <td className="py-2 pr-3 font-semibold">{o.name}</td>
                        <td className="py-2 pr-3 text-muted">{o.function ?? "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{o.own_notes}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{o.comments_given}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{o.likes_given}</td>
                        <td className="py-2 text-right tabular-nums">{Math.round(o.contribution_ratio * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">Tidak ada Observer saat ini 🎉</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
