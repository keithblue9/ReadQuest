"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BadgeGrid } from "@/components/BadgeGrid";
import { LevelProgress } from "@/components/LevelProgress";
import { Avatar } from "@/components/PostCard";
import { Button } from "@/components/ui";
import { allowedSections } from "@/features/admin/sections";
import { useAuth } from "@/features/auth/AuthProvider";
import { STATUS_STYLE, StatusBadge } from "@/features/authenticity/StatusBadge";
import { api } from "@/lib/api";
import type { Authenticity, Badge, LedgerEntry, LedgerPage, PointsSummary } from "@/lib/types";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authenticity, setAuthenticity] = useState<Authenticity | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    api<PointsSummary>("/me/points").then(setSummary).catch(() => undefined);
    api<Authenticity>("/me/authenticity").then(setAuthenticity).catch(() => undefined);
    api<Badge[]>("/me/badges").then(setBadges).catch(() => undefined);
    api<LedgerPage>("/me/points/history?limit=15")
      .then((page) => {
        setEntries(page.items);
        setCursor(page.next_cursor);
      })
      .catch(() => undefined);
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api<LedgerPage>(`/me/points/history?limit=15&cursor=${cursor}`);
      setEntries((current) => [...current, ...page.items]);
      setCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  if (!user) return null;
  const adminHome = allowedSections(user.permissions)[0]?.href;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <section className="animate-pop-in flex items-center gap-4">
        <div className="scale-150 pl-2">
          <Avatar name={user.name} url={user.avatar_url} />
        </div>
        <div className="min-w-0 pl-2">
          <h1 className="truncate text-2xl font-extrabold">{user.name}</h1>
          <p className="text-sm text-muted">
            {user.role.name} · {user.email}
          </p>
        </div>
      </section>

      {summary && (
        <>
          <div className="rounded-3xl border border-border bg-surface p-4">
            <LevelProgress level={summary.level} points={summary.points_total} />
          </div>

          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-border bg-surface p-3">
              <dt className="text-xs font-semibold text-muted">Total poin</dt>
              <dd className="mt-1 text-xl font-extrabold">{summary.points_total}</dd>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-3">
              <dt className="text-xs font-semibold text-muted">Hari ini</dt>
              <dd className="mt-1 text-xl font-extrabold">+{summary.points_today}</dd>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-3">
              <dt className="text-xs font-semibold text-muted">Buku selesai</dt>
              <dd className="mt-1 text-xl font-extrabold">{user.stats.books_finished}</dd>
            </div>
          </dl>

          <section className="flex items-center gap-4 rounded-3xl bg-accent/10 p-4">
            <span className={`text-4xl ${summary.streak.current ? "streak-flame" : ""}`} aria-hidden>
              🔥
            </span>
            <div>
              <p className="text-xl font-extrabold">Streak {summary.streak.current} hari</p>
              <p className="text-sm text-muted">
                Terpanjang {summary.streak.longest} hari
                {summary.streak.next_milestone
                  ? ` · bonus berikutnya di hari ke-${summary.streak.next_milestone}`
                  : ""}
              </p>
              {!summary.streak.read_today && summary.streak.current > 0 && (
                <p className="mt-1 text-sm font-semibold text-accent">
                  Baca hari ini agar streak tidak putus!
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {authenticity && (
        <section className="rounded-3xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-extrabold">Reading Authenticity</h2>
            <StatusBadge status={authenticity.status} label={authenticity.status_label} />
          </div>
          <p className="mt-2 text-sm text-muted">{STATUS_STYLE[authenticity.status].hint}</p>
          <p className="mt-2 text-xs text-muted">
            30 hari: {authenticity.own_notes} catatan · {authenticity.comments_given} komentar ·{" "}
            {authenticity.likes_given} reaksi. 🔒 Hanya terlihat olehmu, Team Lead, dan Admin.
          </p>
        </section>
      )}

      <nav className="grid grid-cols-3 gap-2 text-center text-sm font-bold" aria-label="Gamifikasi">
        <Link href="/quests" className="rounded-2xl border border-border bg-surface p-3">
          <span className="block text-2xl" aria-hidden>
            🎯
          </span>
          Quest
        </Link>
        <Link href="/buddy" className="rounded-2xl border border-border bg-surface p-3">
          <span className="block text-2xl" aria-hidden>
            🤝
          </span>
          Buddy
        </Link>
        <Link href="/room" className="rounded-2xl border border-border bg-surface p-3">
          <span className="block text-2xl" aria-hidden>
            🛋️
          </span>
          Reading Room
        </Link>
      </nav>
      {(user.permissions.includes("authenticity.view_team") ||
        user.permissions.includes("authenticity.view_all")) && (
        <Link
          href="/team"
          className="rounded-2xl border-2 border-dashed border-primary/40 p-3 text-center font-bold text-primary"
        >
          🧭 Lihat Authenticity Index tim
        </Link>
      )}

      {badges.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-extrabold">
            Badge ({badges.filter((b) => b.earned).length}/{badges.length})
          </h2>
          <BadgeGrid badges={badges} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">Riwayat poin</h2>
        {entries.length === 0 ? (
          <p className="rounded-2xl bg-surface-muted p-4 text-sm text-muted">
            Belum ada poin. Selesaikan sesi baca pertamamu! 📖
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{entry.name}</p>
                  <p className="text-xs text-muted">
                    {new Date(entry.created_at).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                </div>
                <span
                  className={`font-extrabold tabular-nums ${
                    entry.points >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {entry.points >= 0 ? "+" : ""}
                  {entry.points}
                </span>
              </li>
            ))}
          </ul>
        )}
        {cursor && (
          <Button variant="ghost" loading={loadingMore} onClick={loadMore}>
            Muat lebih banyak
          </Button>
        )}
      </section>

      {adminHome && (
        <Link
          href={adminHome}
          className="rounded-2xl bg-foreground p-3 text-center font-bold text-background"
        >
          🛠️ Panel Admin
        </Link>
      )}
      <Link
        href="/settings/notifications"
        className="rounded-2xl border border-border bg-surface p-3 text-center font-bold"
      >
        ⚙️ Pengaturan notifikasi
      </Link>
      <Button variant="ghost" onClick={() => logout()}>
        Keluar
      </Button>
    </div>
  );
}
