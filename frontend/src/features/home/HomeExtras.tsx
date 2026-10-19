"use client";

import { ChevronRight, Handshake, Sofa, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { ProgressBar } from "@/components/ProgressBar";
import { Skeleton } from "@/components/ui";
import { useUiConfig } from "@/features/ui-config/store";
import { api } from "@/lib/api";
import type { BookOfMonth, Buddies, Quest } from "@/lib/types";

/** Kartu ringkas gamifikasi: Book of the Month, quest, Reading Buddy, Reading Room. */
export function HomeExtras({ bookOfMonth = true }: { bookOfMonth?: boolean }) {
  const on = useUiConfig().features.enabled;
  const [bom, setBom] = useState<BookOfMonth | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [buddies, setBuddies] = useState<Buddies | null>(null);

  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    // Tampilkan sekaligus setelah semua data datang (dengan placeholder setinggi kartu) agar
    // feed di bawahnya tidak terdorong berkali-kali (CLS).
    Promise.allSettled([
      api<BookOfMonth>("/book-of-the-month").then(setBom),
      api<Quest[]>("/quests").then(setQuests),
      api<Buddies>("/buddies").then(setBuddies),
    ]).then(() => setLoaded(true));
  }, []);

  const done = quests.filter((q) => q.completed).length;
  const next = quests.find((q) => !q.completed);
  const buddy = buddies?.buddy;
  const row = "card flex min-h-[80px] items-center gap-3 p-3 transition hover:bg-surface-muted";
  const icon = "grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-ink";

  if (!loaded) {
    const slots = [bookOfMonth && on.book_of_month, on.quests, on.buddy, on.room].filter(Boolean).length;
    return (
      <>
        {Array.from({ length: slots }, (_, i) => (
          <Skeleton key={i} className="min-h-[84px] w-full rounded-2xl" />
        ))}
      </>
    );
  }
  return (
    <>
      {bookOfMonth && on.book_of_month && bom?.book && (
        <Link href={`/books/${bom.book.id}`} className={row}>
          <BookCover url={bom.book.cover_url} title={bom.book.title} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-muted">Buku bulan ini</span>
            <span className="block truncate font-semibold">{bom.book.title}</span>
            <span className="block text-xs text-muted">{bom.readers_this_month} pembaca bulan ini</span>
          </span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
      )}

      {on.quests && quests.length > 0 && (
        <Link href="/quests" className={row}>
          <span className={`${icon}`}>
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
              <span className="block text-xs font-semibold text-leaf">Semua quest selesai</span>
            )}
          </span>
        </Link>
      )}

      {on.buddy && (
        <Link href="/buddy" className={row}>
          <span className={`${icon}`}>
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
          <span className={`${icon}`}>
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
