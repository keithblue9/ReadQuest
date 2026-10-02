import Link from "next/link";

import { PostCard } from "@/components/PostCard";
import type { FinishResult } from "@/lib/types";
import { formatDuration } from "@/lib/words";

const CONFETTI = ["🎉", "📚", "✨", "⭐", "🎊", "💜", "🧡", "🎈"];

export function FinishCelebration({ result }: { result: FinishResult }) {
  const { session, post } = result;
  return (
    <div className="relative flex flex-col gap-5 pb-6">
      <div className="pointer-events-none absolute inset-x-0 -top-4 h-40 overflow-hidden" aria-hidden>
        {CONFETTI.map((emoji, i) => (
          <span
            key={i}
            className="confetti-piece absolute text-2xl"
            style={{ left: `${8 + i * 11}%`, animationDelay: `${i * 70}ms` }}
          >
            {emoji}
          </span>
        ))}
      </div>
      <div className="animate-pop-in pt-8 text-center">
        <p className="text-5xl" aria-hidden>
          🏆
        </p>
        <h1 className="mt-3 text-3xl font-extrabold">Sesi selesai!</h1>
        <p className="mt-2 text-muted">
          Kamu membaca <strong className="text-foreground">{formatDuration(session.active_seconds)}</strong>{" "}
          hari ini.
        </p>
        <p
          className={`mx-auto mt-4 inline-block rounded-full px-4 py-2 text-sm font-bold ${
            session.is_full_points ? "bg-success/15 text-success" : "bg-surface-muted text-muted"
          }`}
        >
          {session.is_full_points
            ? "✅ Sesi poin penuh hari ini tercapai"
            : "Sesi tercatat — poin penuh hari ini sudah didapat"}
        </p>
      </div>
      <PostCard post={post} />
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/books/${post.book.id}`}
          className="grid h-12 place-items-center rounded-2xl border border-border bg-surface font-bold"
        >
          Lihat diskusi buku
        </Link>
        <Link
          href="/"
          className="grid h-12 place-items-center rounded-2xl bg-primary font-bold text-primary-foreground"
        >
          Ke beranda
        </Link>
      </div>
    </div>
  );
}
