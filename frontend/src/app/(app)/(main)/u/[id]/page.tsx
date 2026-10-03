"use client";

import { PenLine } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { AuthorPosts } from "@/features/profile/AuthorPosts";
import { ProfileHeader } from "@/features/profile/ProfileHeader";
import { ShelfView } from "@/features/profile/ShelfView";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { PublicProfile } from "@/lib/types";

type Tab = "posts" | "shelf" | "badges";

export default function PublicProfilePage({ params }: PageProps<"/u/[id]">) {
  const { id } = use(params);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("posts");

  useEffect(() => {
    api<PublicProfile>(`/users/${id}`)
      .then(setProfile)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (error) return <p className="card p-6 text-sm text-muted">{error}</p>;
  if (!profile) return <div className="card h-72 animate-pulse" aria-busy="true" />;

  return (
    <div className="flex flex-col gap-3">
      <ProfileHeader
        name={profile.name}
        avatarUrl={profile.avatar_url}
        headline={profile.headline}
        fn={profile.function}
        role={profile.role}
        joinedAt={profile.joined_at}
        levelTitle={profile.level ? `Lv. ${profile.level.level} · ${profile.level.title}` : null}
        stats={{
          minutes: profile.stats.reading_minutes,
          books: profile.stats.books_finished,
          streak: profile.stats.current_streak,
          points: profile.stats.points_total,
        }}
        actions={
          profile.is_me && (
            <Link href="/profile" className="flex h-9 items-center gap-2 rounded-lg bg-surface-muted px-3 text-sm font-semibold">
              <PenLine className="size-4" aria-hidden /> Edit profil
            </Link>
          )
        }
      />

      {(profile.currently_reading.length > 0 || profile.favorite_books.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "Sedang dibaca", books: profile.currently_reading },
            { title: "Buku favorit", books: profile.favorite_books },
          ]
            .filter((g) => g.books.length)
            .map((group) => (
              <section key={group.title} className="card p-4">
                <h2 className="mb-3 text-[15px] font-semibold text-muted">{group.title}</h2>
                <ul className="flex flex-col gap-2">
                  {group.books.map((b) => (
                    <li key={b.id}>
                      <Link href={`/books/${b.id}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-surface-muted">
                        <BookCover url={b.cover_url} title={b.title} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{b.title}</span>
                          <span className="block truncate text-sm text-muted">{b.authors.join(", ")}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      <div className="card flex gap-1 p-1.5" role="tablist">
        {(
          [
            ["posts", "Postingan"],
            ["shelf", "Rak buku"],
            ["badges", `Badge (${profile.badges.length})`],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`h-9 flex-1 rounded-md text-sm font-semibold ${tab === value ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "posts" && <AuthorPosts authorId={profile.id} />}
      {tab === "shelf" && <ShelfView userId={profile.id} />}
      {tab === "badges" &&
        (profile.badges.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">Belum ada badge.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {profile.badges.map((b) => (
              <li key={b.id} className="card flex items-center gap-3 p-3">
                <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-2xl" aria-hidden>
                  {b.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{b.name}</span>
                  <span className="block text-xs text-muted">{b.description}</span>
                  <span className="block text-xs text-muted">
                    {new Date(b.awarded_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
