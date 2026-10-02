"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { ProgressBar } from "@/components/ProgressBar";
import { api } from "@/lib/api";
import type { BookOfMonth, Buddies, Quest } from "@/lib/types";

/** Kartu gamifikasi di beranda: Book of the Month, quest, Reading Buddy, Reading Room. */
export function HomeExtras() {
  const [bom, setBom] = useState<BookOfMonth | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [buddies, setBuddies] = useState<Buddies | null>(null);

  useEffect(() => {
    api<BookOfMonth>("/book-of-the-month").then(setBom).catch(() => undefined);
    api<Quest[]>("/quests").then(setQuests).catch(() => undefined);
    api<Buddies>("/buddies").then(setBuddies).catch(() => undefined);
  }, []);

  const done = quests.filter((q) => q.completed).length;
  const next = quests.find((q) => !q.completed);
  const buddy = buddies?.buddy;

  return (
    <>
      {bom?.book && (
        <Link
          href={`/books/${bom.book.id}`}
          className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-accent/20 to-primary/15 p-4"
        >
          <BookCover url={bom.book.cover_url} title={bom.book.title} size="md" />
          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-wide text-accent uppercase">
              📌 Book of the Month
            </p>
            <p className="mt-1 line-clamp-2 text-lg leading-tight font-extrabold">{bom.book.title}</p>
            <p className="truncate text-sm text-muted">{bom.book.authors.join(", ")}</p>
            <p className="mt-1 text-xs font-semibold text-muted">
              {bom.readers_this_month} pembaca bulan ini
            </p>
          </div>
        </Link>
      )}

      {quests.length > 0 && (
        <Link href="/quests" className="rounded-3xl border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <p className="font-extrabold">🎯 Quest minggu ini</p>
            <span className="text-sm font-bold text-muted">
              {done}/{quests.length}
            </span>
          </div>
          {next ? (
            <div className="mt-2">
              <p className="text-sm font-semibold">{next.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1">
                  <ProgressBar value={next.progress} max={next.target} label={next.title} />
                </div>
                <span className="text-xs font-bold tabular-nums">
                  {next.progress}/{next.target}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm font-semibold text-success">Semua quest selesai! 🎉</p>
          )}
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/buddy" className="rounded-3xl border border-border bg-surface p-4">
          <p className="text-2xl" aria-hidden>
            🤝
          </p>
          <p className="mt-1 font-extrabold">Reading Buddy</p>
          <p className="truncate text-xs text-muted">
            {buddy
              ? `${buddy.user.name} ${buddy.read_today ? "sudah baca ✅" : "belum baca ⏳"}`
              : buddies?.incoming.length
                ? `${buddies.incoming.length} ajakan masuk`
                : "Ajak rekan berpasangan"}
          </p>
        </Link>
        <Link href="/room" className="rounded-3xl border border-border bg-surface p-4">
          <p className="text-2xl" aria-hidden>
            🛋️
          </p>
          <p className="mt-1 font-extrabold">Reading Room</p>
          <p className="text-xs text-muted">Baca bersama secara live</p>
        </Link>
      </div>
    </>
  );
}
