"use client";

import { BookCheck, Clock, NotebookPen, UserCheck, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { BookCover } from "@/components/BookCover";
import { DailyBars } from "@/features/admin/charts";
import { Donut, FunctionBars, Panel, StatTile, WeekSpark } from "@/features/dashboard/widgets";
import { useAuth } from "@/features/auth/AuthProvider";
import { useFeature } from "@/features/ui-config/store";
import { api } from "@/lib/api";
import type { TeamDashboard } from "@/lib/types";
import { POST_TYPE_LABEL } from "@/lib/words";

const WHEN = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Infografis tim untuk semua anggota (agregat; status Authenticity individu tetap privat). */
export default function StatsPage() {
  const { user } = useAuth();
  const feedOn = useFeature("feed");
  const booksOn = useFeature("books");
  const boardOn = useFeature("leaderboard");
  const [data, setData] = useState<TeamDashboard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<TeamDashboard>("/dashboard").then(setData).catch(() => setFailed(true));
  }, []);

  if (failed && !data) return <p className="card p-6 text-sm text-muted">Statistik tim belum bisa dimuat. Coba muat ulang.</p>;
  if (!data || !user) return <div className="card h-64 animate-pulse" aria-busy="true" aria-label="Memuat statistik" />;
  const team = data.team;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Statistik Tim</h1>
        <p className="text-sm text-muted">Gambaran kebiasaan membaca tim, 14 hari terakhir.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Users} label="Anggota terdaftar" value={team.members} hint={team.new_members_week ? `+${team.new_members_week} minggu ini` : undefined} />
        <StatTile icon={UserCheck} label="Sudah baca hari ini" value={team.readers_today} suffix={`/ ${team.members}`} hint={team.reading_now ? `${team.reading_now} sedang membaca` : undefined} />
        <StatTile icon={UsersRound} label="Pembaca 7 hari" value={team.readers_week} suffix={`/ ${team.members}`} />
        <StatTile icon={Clock} label="Menit baca 7 hari" value={team.minutes_week} hint={`${team.minutes_today} menit hari ini`} />
        <StatTile icon={NotebookPen} label="Catatan 7 hari" value={team.notes_week} />
        <StatTile icon={BookCheck} label="Buku selesai 7 hari" value={team.books_finished_week} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Menit baca tim per hari">
          <DailyBars data={data.daily} />
        </Panel>
        <Panel title="Partisipasi 7 hari">
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Donut value={team.participation_week} label={`${team.readers_week} dari ${team.members} anggota membaca`} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Partisipasi per fungsi (7 hari)">
          <FunctionBars rows={data.by_function} />
        </Panel>
        <Panel title="Progresmu minggu ini" action={<span className="text-xs text-muted">{data.me.minutes_week} menit</span>}>
          <WeekSpark data={data.me.daily} target={user.daily_target_minutes} />
          <p className="text-sm text-muted">
            {data.me.rank_week
              ? `Peringkat #${data.me.rank_week} dari ${data.me.readers_week} pembaca minggu ini.`
              : "Belum ada sesi minggu ini — mulai 5 menit saja."}
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Pembaca teratas minggu ini"
          action={boardOn && <Link href="/leaderboard" className="text-sm font-semibold text-primary">Peringkat</Link>}
        >
          {data.top_readers.length === 0 ? (
            <p className="text-sm text-muted">Belum ada yang membaca minggu ini.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {data.top_readers.map((r, i) => (
                <li key={r.user_id} className="flex items-center gap-3">
                  <span className="w-4 text-center text-sm font-bold text-muted tabular-nums">{i + 1}</span>
                  <Avatar name={r.name} url={r.avatar_url} size="sm" userId={r.user_id} />
                  <Link href={`/u/${r.user_id}`} className="min-w-0 flex-1 hover:underline">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    {r.function && <span className="block truncate text-xs text-muted">{r.function}</span>}
                  </Link>
                  <span className="text-sm font-semibold tabular-nums">{r.minutes} mnt</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Buku terpopuler" action={booksOn && <Link href="/books" className="text-sm font-semibold text-primary">Katalog</Link>}>
          {data.popular_books.length === 0 ? (
            <p className="text-sm text-muted">Belum ada buku yang dibaca.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.popular_books.map((b) => (
                <li key={b.book_id}>
                  <Link href={booksOn ? `/books/${b.book_id}` : "/stats"} className="flex items-center gap-3 rounded-lg p-1 hover:bg-surface-muted">
                    <BookCover url={b.cover_url} title={b.title} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{b.title}</span>
                      <span className="block truncate text-xs text-muted">{b.authors.join(", ")}</span>
                    </span>
                    <span className="text-right text-xs text-muted">
                      <strong className="block text-sm text-foreground">{b.readers} pembaca</strong>
                      {b.minutes} mnt
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Aktivitas terbaru" action={feedOn && <Link href="/" className="text-sm font-semibold text-primary">Beranda</Link>}>
          {data.recent_posts.length === 0 ? (
            <p className="text-sm text-muted">Belum ada aktivitas.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.recent_posts.map((p) => (
                <li key={p.post_id} className="text-sm">
                  <Link href={feedOn ? `/posts/${p.post_id}` : "/stats"} className="block rounded-lg p-1 hover:bg-surface-muted">
                    <span className="font-semibold">{p.author}</span> menulis{" "}
                    <span className="font-medium">{POST_TYPE_LABEL[p.type] ?? "catatan"}</span>
                    {p.book_title && <> tentang <span className="italic">“{p.book_title}”</span></>}
                    <span className="block text-xs text-muted">{WHEN.format(new Date(p.created_at))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
