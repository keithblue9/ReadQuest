"use client";

import { ChevronRight, Handshake, Sofa, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { ProgressBar } from "@/components/ProgressBar";
import { useUiConfig } from "@/features/ui-config/store";
import { api } from "@/lib/api";
import type { BookOfMonth, Buddies, Quest } from "@/lib/types";

/** Kartu ringkas gamifikasi: Book of the Month, quest, Reading Buddy, Reading Room. */
export function HomeExtras({ bookOfMonth = true }: { bookOfMonth?: boolean }) {
  const on = useUiConfig().features.enabled;
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
  const row = "card flex items-center gap-3 p-3 transition hover:brightness-[0.98]";
  const icon = "grid size-10 shrink-0 place-items-center rounded-full";

  return (
    <>
      {bookOfMonth && on.book_of_month && bom?.book && (
        <Link href={`/books/${bom.book.id}`} className={row}>
          <BookCover url={bom.book.cover_url} title={bom.book.title} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="text-xs font-semibold tracking-wide text-primary uppercase">Book of the Month</span>
            <span className="block truncate font-semibold">{bom.book.title}</span>
            <span className="block text-xs text-muted">{bom.readers_this_month} pembaca bulan ini</span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}

      {on.quests && quests.length > 0 && (
        <Link href="/quests" className={row}>
          <span className={`${icon} bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200`}>
            <Target className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">Quest minggu ini</span>
              <span className="text-xs font-semibold text-muted tabular-nums">
                {done}/{quests.length}
              </span>
            </span>
            {next ? (
              <span className="mt-1 block">
                <span className="block truncate text-xs text-muted">{next.title}</span>
                <span className="mt-1 block">
                  <ProgressBar value={next.progress} max={next.target} label={next.title} />
                </span>
              </span>
            ) : (
              <span className="block text-xs font-semibold text-success">Semua quest selesai</span>
            )}
          </span>
        </Link>
      )}

      {on.buddy && (
        <Link href="/buddy" className={row}>
          <span className={`${icon} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200`}>
            <Handshake className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Reading Buddy</span>
            <span className="block truncate text-xs text-muted">
              {buddy
                ? `${buddy.user.name} ${buddy.read_today ? "sudah baca hari ini" : "belum baca hari ini"}`
                : buddies?.incoming.length
                  ? `${buddies.incoming.length} ajakan masuk`
                  : "Ajak rekan saling mengingatkan"}
            </span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}

      {on.room && (
        <Link href="/room" className={row}>
          <span className={`${icon} bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200`}>
            <Sofa className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Reading Room</span>
            <span className="block text-xs text-muted">Baca bersama secara live</span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}
    </>
  );
}
