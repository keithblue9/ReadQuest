"use client";

import { Bell, Camera, ChevronRight, Compass, Eye, LogOut, Shield, Snowflake } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BadgeGrid } from "@/components/BadgeGrid";
import { LevelProgress } from "@/components/LevelProgress";
import { Alert, Button } from "@/components/ui";
import { allowedSections } from "@/features/admin/sections";
import { useAuth } from "@/features/auth/AuthProvider";
import { ChangePinCard } from "@/features/auth/ChangePinCard";
import { STATUS_STYLE, StatusBadge } from "@/features/authenticity/StatusBadge";
import { AuthorPosts } from "@/features/profile/AuthorPosts";
import { ProfileHeader } from "@/features/profile/ProfileHeader";
import { ShelfView } from "@/features/profile/ShelfView";
import { InstallCard } from "@/features/pwa/InstallCard";
import { refreshShellData } from "@/features/shell/useShellData";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { compressImage } from "@/lib/image";
import type {
  Authenticity,
  Badge,
  LedgerEntry,
  LedgerPage,
  Me,
  PointsSummary,
  PublicProfile,
  Shelf,
  TargetMode,
} from "@/lib/types";

type Tab = "summary" | "posts" | "shelf" | "points" | "account";

const TABS: [Tab, string][] = [
  ["summary", "Ringkasan"],
  ["posts", "Postingan"],
  ["shelf", "Rak buku"],
  ["points", "Poin"],
  ["account", "Akun"],
];

/** Target harian atau mingguan (target fleksibel untuk jadwal kerja yang padat). */
function TargetSettings({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const [mode, setMode] = useState<TargetMode>(me.target_mode);
  const [daily, setDaily] = useState(me.daily_target_minutes);
  const [weekly, setWeekly] = useState(me.weekly_target_minutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = mode !== me.target_mode || daily !== me.daily_target_minutes || weekly !== me.weekly_target_minutes;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = await api<Me>("/me", {
        method: "PATCH",
        json: { target_mode: mode, daily_target_minutes: daily, weekly_target_minutes: weekly },
      });
      onSaved(next);
      refreshShellData(true);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-4">
      <h2 className="font-semibold">Target membaca</h2>
      <p className="text-sm text-muted">Jadwal padat? Pilih target mingguan, kumpulkan menitnya di hari mana pun.</p>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis target">
        {(
          [
            ["daily", "Harian", `${daily} menit/hari`],
            ["weekly", "Mingguan", `${weekly} menit/minggu`],
          ] as [TargetMode, string, string][]
        ).map(([value, label, detail]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => {
              setMode(value);
              setSaved(false);
            }}
            className={`rounded-lg border p-3 text-left ${mode === value ? "border-primary bg-primary/10" : "border-border"}`}
          >
            <span className="block font-semibold">{label}</span>
            <span className="block text-xs text-muted">{detail}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Menit per hari
          <input
            type="number"
            inputMode="numeric"
            min={15}
            max={480}
            value={daily}
            onChange={(e) => {
              setDaily(Number(e.target.value));
              setSaved(false);
            }}
            className="h-10 rounded-lg border border-border bg-surface px-3 font-normal tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Menit per minggu
          <input
            type="number"
            inputMode="numeric"
            min={30}
            max={1200}
            value={weekly}
            onChange={(e) => {
              setWeekly(Number(e.target.value));
              setSaved(false);
            }}
            className="h-10 rounded-lg border border-border bg-surface px-3 font-normal tabular-nums"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button className="h-10 w-auto px-5" onClick={save} loading={saving} disabled={!dirty}>
          Simpan target
        </Button>
        {saved && !dirty && <span className="text-sm font-semibold text-success">Tersimpan ✓</span>}
      </div>
    </section>
  );
}

/** Headline & buku favorit (tampil di profil publik). */
function ProfileDetails({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const [headline, setHeadline] = useState(me.headline);
  const [favorites, setFavorites] = useState<string[]>(me.favorite_book_ids);
  const [books, setBooks] = useState<Shelf["items"]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<Shelf>("/me/shelf").then((s) => setBooks(s.items)).catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      onSaved(await api<Me>("/me", { method: "PATCH", json: { headline, favorite_book_ids: favorites } }));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card flex flex-col gap-3 p-4">
      <h2 className="font-semibold">Profil publik</h2>
      {error && <Alert>{error}</Alert>}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Headline
        <input
          value={headline}
          maxLength={120}
          onChange={(e) => {
            setHeadline(e.target.value);
            setSaved(false);
          }}
          placeholder="mis. Analis Keuangan · suka buku bisnis & biografi"
          className="h-10 rounded-lg border border-border bg-surface px-3 font-normal"
        />
      </label>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Buku favorit (maks. 3, dari rak bukumu)</legend>
        {books.length === 0 ? (
          <p className="text-sm text-muted">Rakmu masih kosong.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {books.map(({ book }) => {
              const on = favorites.includes(book.id);
              return (
                <li key={book.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!on && favorites.length >= 3}
                    onClick={() => {
                      setFavorites((f) => (on ? f.filter((x) => x !== book.id) : [...f, book.id]));
                      setSaved(false);
                    }}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                      on ? "bg-primary text-primary-foreground" : "bg-surface-muted"
                    }`}
                  >
                    {book.title}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>
      <div className="flex items-center gap-3">
        <Button className="h-10 w-auto px-5" onClick={save} loading={saving}>
          Simpan profil
        </Button>
        {saved && <span className="text-sm font-semibold text-success">Tersimpan ✓</span>}
      </div>
    </section>
  );
}

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("summary");
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [authenticity, setAuthenticity] = useState<Authenticity | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    api<PointsSummary>("/me/points").then(setSummary).catch(() => undefined);
    api<PublicProfile>(`/users/${userId}`).then(setProfile).catch(() => undefined);
    api<Authenticity>("/me/authenticity").then(setAuthenticity).catch(() => undefined);
    api<Badge[]>("/me/badges").then(setBadges).catch(() => undefined);
    api<LedgerPage>("/me/points/history?limit=15")
      .then((page) => {
        setEntries(page.items);
        setCursor(page.next_cursor);
      })
      .catch(() => undefined);
  }, [userId]);

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

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const form = new FormData();
      form.append("file", await compressImage(file, { maxDimension: 1024 }), "avatar.jpg");
      setUser(await api<Me>("/me/avatar", { method: "POST", body: form }));
    } catch (err) {
      setAvatarError(errorMessage(err));
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!user) return null;
  const adminHome = allowedSections(user.permissions)[0]?.href;
  const streak = summary?.streak;

  return (
    <div className="flex flex-col gap-3">
      <ProfileHeader
        name={user.name}
        avatarUrl={user.avatar_url}
        headline={user.headline}
        fn={profile?.function ?? null}
        role={user.role.name}
        joinedAt={profile?.joined_at ?? null}
        levelTitle={user.level ? `Lv. ${user.level.level} · ${user.level.title}` : null}
        stats={{
          minutes: profile?.stats.reading_minutes ?? 0,
          books: user.stats.books_finished,
          streak: streak?.current ?? user.stats.current_streak,
          points: summary?.points_total ?? user.stats.points_total,
        }}
        avatarSlot={
          <>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            <button
              type="button"
              aria-label="Ganti foto profil"
              disabled={avatarBusy}
              onClick={() => fileRef.current?.click()}
              className="absolute right-1 bottom-1 grid size-9 place-items-center rounded-full bg-surface-muted ring-2 ring-surface hover:brightness-95 disabled:opacity-60"
            >
              <Camera className="size-5" aria-hidden />
            </button>
          </>
        }
        actions={
          <Link href={`/u/${user.id}`} className="flex h-9 items-center gap-2 rounded-lg bg-surface-muted px-3 text-sm font-semibold">
            <Eye className="size-4" aria-hidden /> Lihat sebagai rekan
          </Link>
        }
      />
      {avatarError && <Alert>{avatarError}</Alert>}

      <div className="card grid grid-cols-3 gap-1 p-1.5 sm:grid-cols-5" role="tablist">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`h-9 rounded-md px-2 text-sm font-semibold ${
              tab === value ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <>
          {summary && (
            <section className="card flex flex-col gap-3 p-4">
              <LevelProgress level={summary.level} points={summary.points_total} />
              {streak && (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
                  <span>
                    <strong>{streak.current}</strong> hari beruntun · terpanjang {streak.longest}
                    {streak.next_milestone ? ` · bonus di hari ke-${streak.next_milestone}` : ""}
                  </span>
                  {streak.freezes_per_month > 0 && (
                    <span className="flex items-center gap-1.5 text-muted">
                      <Snowflake className="size-4 text-sky-500" aria-hidden />
                      {streak.freezes_left}/{streak.freezes_per_month} freeze tersisa bulan ini
                    </span>
                  )}
                </p>
              )}
            </section>
          )}
          <TargetSettings me={user} onSaved={setUser} />
          {authenticity && (
            <section className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Reading Authenticity</h2>
                <StatusBadge status={authenticity.status} label={authenticity.status_label} />
              </div>
              <p className="mt-2 text-sm text-muted">{STATUS_STYLE[authenticity.status].hint}</p>
              <p className="mt-2 text-xs text-muted">
                30 hari: {authenticity.own_notes} catatan · {authenticity.comments_given} komentar · {authenticity.likes_given}{" "}
                reaksi. Hanya terlihat olehmu, Team Lead, dan Admin.
              </p>
            </section>
          )}
          {(user.permissions.includes("authenticity.view_team") || user.permissions.includes("authenticity.view_all")) && (
            <Link href="/team" className="card flex items-center gap-3 p-4">
              <Compass className="size-5 text-primary" aria-hidden />
              <span className="flex-1 font-semibold">Authenticity Index tim</span>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </Link>
          )}
          {badges.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-1 font-semibold">
                Pencapaian ({badges.filter((b) => b.earned).length}/{badges.length})
              </h2>
              <p className="mb-3 text-sm text-muted">
                Ketuk badge yang sudah didapat untuk membagikan sertifikat atau menambahkannya ke LinkedIn.
              </p>
              <BadgeGrid badges={badges} shareable />
            </section>
          )}
        </>
      )}

      {tab === "posts" && <AuthorPosts authorId={user.id} />}
      {tab === "shelf" && <ShelfView editable />}

      {tab === "points" && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-border px-4 py-3 font-semibold">Riwayat poin</h2>
          {entries.length === 0 ? (
            <p className="p-4 text-sm text-muted">Belum ada poin. Selesaikan sesi baca pertamamu.</p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.name}</p>
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
                  <span className={`font-semibold tabular-nums ${entry.points >= 0 ? "text-success" : "text-danger"}`}>
                    {entry.points >= 0 ? "+" : ""}
                    {entry.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cursor && (
            <div className="p-3">
              <Button variant="ghost" loading={loadingMore} onClick={loadMore}>
                Muat lebih banyak
              </Button>
            </div>
          )}
        </section>
      )}

      {tab === "account" && (
        <>
          <ProfileDetails me={user} onSaved={setUser} />
          <nav className="card divide-y divide-border" aria-label="Pengaturan">
            <Link href="/settings/notifications" className="flex items-center gap-3 p-4">
              <Bell className="size-5 text-primary" aria-hidden />
              <span className="flex-1 font-medium">Pengingat & notifikasi</span>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </Link>
            {adminHome && (
              <Link href={adminHome} className="flex items-center gap-3 p-4">
                <Shield className="size-5 text-primary" aria-hidden />
                <span className="flex-1 font-medium">Panel Admin</span>
                <ChevronRight className="size-5 text-muted" aria-hidden />
              </Link>
            )}
          </nav>
          <ChangePinCard />
          <InstallCard />
          <Button variant="ghost" onClick={() => logout()}>
            <LogOut className="size-4" aria-hidden /> Keluar
          </Button>
        </>
      )}
    </div>
  );
}
