"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { LevelProgress } from "@/components/LevelProgress";
import { Avatar } from "@/components/PostCard";
import { DailyBars } from "@/features/admin/charts";
import { useAuth } from "@/features/auth/AuthProvider";
import { Donut, FunctionBars, Panel, StatTile, WeekSpark } from "@/features/dashboard/widgets";
import { HomeExtras } from "@/features/home/HomeExtras";
import { categoryInfo } from "@/features/leaderboard/categories";
import { useFeature, useT } from "@/features/ui-config/store";
import { api } from "@/lib/api";
import type { LeaderboardSummaryItem, PointsSummary, TeamDashboard, Today } from "@/lib/types";
import { formatDuration } from "@/lib/words";

const NOTE_LABEL: Record<string, string> = {
  quick_note: "Quick Note",
  chapter_story: "Chapter Story",
  book_review: "Book Review",
  discussion: "Diskusi",
};

const WHEN = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function DashboardPage() {
  const t = useT();
  const { user, refreshUser } = useAuth();
  const feedOn = useFeature("feed");
  const booksOn = useFeature("books");
  const boardOn = useFeature("leaderboard");
  const [today, setToday] = useState<Today | null>(null);
  const [points, setPoints] = useState<PointsSummary | null>(null);
  const [ranks, setRanks] = useState<LeaderboardSummaryItem[]>([]);
  const [data, setData] = useState<TeamDashboard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<Today>("/sessions/today").then(setToday).catch(() => undefined);
    api<PointsSummary>("/me/points").then(setPoints).catch(() => undefined);
    api<LeaderboardSummaryItem[]>("/leaderboard/me?period=weekly").then(setRanks).catch(() => undefined);
    api<TeamDashboard>("/dashboard").then(setData).catch(() => setFailed(true));
    refreshUser();
  }, [refreshUser]);

  if (!user) return null;
  const firstName = user.name.split(" ")[0];
  const active = today?.active_session;
  const team = data?.team;
  const doneToday = today?.full_points_done;

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Sapaan + progres pribadi */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="animate-pop-in flex flex-col justify-between rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/25">
          <div>
            <p className="text-sm font-semibold opacity-80">{user.role.name}</p>
            <h1 className="mt-1 text-3xl font-extrabold">Halo, {firstName}! 👋</h1>
            <p className="mt-3 opacity-90">
              {doneToday
                ? "Target baca hari ini sudah tercapai. Keren! 🎯"
                : `Target harianmu ${user.daily_target_minutes} menit. Yuk mulai!`}
            </p>
          </div>
          <Link
            href="/read"
            className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-white/95 font-extrabold text-[#6c4df6] shadow-lg transition active:scale-[0.98] lg:w-64"
          >
            {active ? `⏱️ Lanjutkan sesi baca` : `▶️ ${t("nav.start_reading")}`}
          </Link>
        </section>

        <Panel title="Progresmu" action={<span className="text-xs font-semibold text-muted">7 hari terakhir</span>}>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Poin", points?.points_total ?? user.stats.points_total],
              ["Streak", `${points?.streak.current ?? user.stats.current_streak}🔥`],
              ["Buku", user.stats.books_finished],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-surface-muted p-2.5">
                <p className="text-[11px] font-semibold text-muted">{label}</p>
                <p className="text-lg font-extrabold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          {data && <WeekSpark data={data.me.daily} target={user.daily_target_minutes} />}
          {data && (
            <p className="text-xs text-muted">
              {data.me.minutes_week} menit minggu ini
              {data.me.rank_week ? ` · peringkat #${data.me.rank_week} dari ${data.me.readers_week} pembaca` : " · belum ada sesi minggu ini"}
            </p>
          )}
          {points?.level && (
            <Link href="/profile">
              <LevelProgress level={points.level} points={points.points_total} />
            </Link>
          )}
          {points && points.streak.current > 0 && !points.streak.read_today && (
            <p className="text-sm font-semibold text-accent">
              ⚠️ Baca hari ini agar streak {points.streak.current} hari tidak putus!
            </p>
          )}
        </Panel>
      </div>

      {active && (
        <Link href="/read" className="flex items-center gap-3 rounded-3xl border-2 border-accent/50 bg-accent/10 p-3">
          <BookCover url={active.book.cover_url} title={active.book.title} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-accent">SESI BERJALAN</p>
            <p className="truncate font-bold">{active.book.title}</p>
            <p className="text-sm text-muted">{formatDuration(active.active_seconds)} terbaca</p>
          </div>
        </Link>
      )}

      {/* Infografis tim */}
      <h2 className="-mb-2 text-xl font-extrabold">Tim kita 📊</h2>
      {failed && !data && (
        <p className="rounded-2xl bg-surface-muted p-4 text-sm text-muted">Statistik tim belum bisa dimuat. Coba muat ulang.</p>
      )}
      {!data && !failed && <p className="text-sm text-muted">Memuat statistik tim…</p>}
      {data && team && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile icon="👥" label="Anggota terdaftar" value={team.members} hint={team.new_members_week ? `+${team.new_members_week} minggu ini` : undefined} />
            <StatTile icon="📖" label="Sudah baca hari ini" value={team.readers_today} suffix={`/ ${team.members}`} hint={team.reading_now ? `${team.reading_now} sedang membaca` : undefined} />
            <StatTile icon="🗓️" label="Pembaca 7 hari" value={team.readers_week} suffix={`/ ${team.members}`} />
            <StatTile icon="⏱️" label="Menit baca 7 hari" value={team.minutes_week} hint={`${team.minutes_today} menit hari ini`} />
            <StatTile icon="📝" label="Catatan 7 hari" value={team.notes_week} />
            <StatTile icon="✅" label="Buku selesai 7 hari" value={team.books_finished_week} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <Panel title="Menit baca tim · 14 hari" className="lg:col-span-1">
              <DailyBars data={data.daily} />
            </Panel>
            <Panel title="Partisipasi 7 hari" className="items-center justify-center">
              <Donut value={team.participation_week} label={`${team.readers_week} dari ${team.members} anggota membaca`} />
            </Panel>
            <Panel title="Partisipasi per fungsi">
              <FunctionBars rows={data.by_function} />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="🏆 Pembaca teratas minggu ini"
              action={
                boardOn && (
                  <Link href="/leaderboard" className="text-sm font-bold text-primary">
                    Lihat semua →
                  </Link>
                )
              }
            >
              {data.top_readers.length === 0 ? (
                <p className="text-sm text-muted">Belum ada yang membaca minggu ini. Jadilah yang pertama!</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {data.top_readers.map((r, i) => (
                    <li key={r.user_id} className="flex items-center gap-3">
                      <span className="w-5 text-center text-sm font-extrabold text-muted tabular-nums">{i + 1}</span>
                      <Avatar name={r.name} url={r.avatar_url} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{r.name}</span>
                        {r.function && <span className="block truncate text-xs text-muted">{r.function}</span>}
                      </span>
                      <span className="text-sm font-extrabold tabular-nums">{r.minutes} mnt</span>
                    </li>
                  ))}
                </ol>
              )}
              {boardOn && ranks.length > 0 && (
                <div className="mt-1 flex gap-2 overflow-x-auto border-t border-border pt-3">
                  {ranks.map((r) => {
                    const info = categoryInfo(r.category);
                    return (
                      <Link
                        key={r.category}
                        href={`/leaderboard?category=${r.category}`}
                        className="w-24 shrink-0 rounded-2xl bg-surface-muted p-2 text-center"
                      >
                        <p aria-hidden>{info.emoji}</p>
                        <p className="truncate text-[11px] font-semibold text-muted">{info.label}</p>
                        <p className="font-extrabold">{r.rank ? `#${r.rank}` : "—"}</p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel
              title="📚 Buku terpopuler"
              action={
                booksOn && (
                  <Link href="/books" className="text-sm font-bold text-primary">
                    Katalog →
                  </Link>
                )
              }
            >
              {data.popular_books.length === 0 ? (
                <p className="text-sm text-muted">Belum ada buku yang dibaca.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.popular_books.map((b) => (
                    <li key={b.book_id}>
                      <Link
                        href={booksOn ? `/books/${b.book_id}` : "/"}
                        className="flex items-center gap-3 rounded-2xl p-1 transition hover:bg-surface-muted"
                      >
                        <BookCover url={b.cover_url} title={b.title} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{b.title}</span>
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

            <Panel
              title="💬 Aktivitas terbaru"
              action={
                feedOn && (
                  <Link href="/feed" className="text-sm font-bold text-primary">
                    Feed →
                  </Link>
                )
              }
            >
              {data.recent_posts.length === 0 ? (
                <p className="text-sm text-muted">Belum ada aktivitas.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {data.recent_posts.map((p) => (
                    <li key={p.post_id} className="text-sm">
                      <Link href={feedOn ? `/posts/${p.post_id}` : "/"} className="block rounded-xl p-1 transition hover:bg-surface-muted">
                        <span className="font-bold">{p.author}</span> menulis{" "}
                        <span className="font-semibold">{NOTE_LABEL[p.type] ?? "catatan"}</span>
                        {p.book_title && (
                          <>
                            {" "}
                            tentang <span className="italic">“{p.book_title}”</span>
                          </>
                        )}
                        <span className="block text-xs text-muted">{WHEN.format(new Date(p.created_at))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 [&>*]:h-fit">
        <HomeExtras />
      </div>
    </div>
  );
}
