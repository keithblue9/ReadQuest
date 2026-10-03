"use client";

import { Bookmark, MessageCircle, Share2, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { api } from "@/lib/api";
import type { Post, PostCounts, ReactionType } from "@/lib/types";

import { ShareSheet } from "./ShareSheet";

/** Reaksi bermakna untuk konteks kerja. "Mau baca juga" sekaligus menaruh buku di rak. */
export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "like", emoji: "👍", label: "Setuju" },
  { type: "insightful", emoji: "💡", label: "Insightful" },
  { type: "inspiring", emoji: "🙌", label: "Menginspirasi" },
  { type: "want_to_read", emoji: "📚", label: "Mau baca juga" },
];

const LONG_PRESS_MS = 450;

type Props = { post: Post; linkComments?: boolean; commentCount?: number };

export function PostActions({ post, linkComments = true, commentCount }: Props) {
  const [reaction, setReaction] = useState<ReactionType | null>(post.viewer.reaction);
  const [counts, setCounts] = useState<PostCounts>({ ...post.counts, want_to_read: post.counts.want_to_read ?? 0 });
  const [bookmarked, setBookmarked] = useState(post.viewer.bookmarked);
  const [sharing, setSharing] = useState(false);
  const [tray, setTray] = useState(false);
  const [popping, setPopping] = useState<ReactionType | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  async function react(type: ReactionType | null) {
    setTray(false);
    const previous = { reaction, counts };
    const next = type === reaction ? null : type;
    // Optimistis: perbarui UI dulu, sinkronkan dengan respons server.
    const optimistic = { ...counts };
    if (reaction) optimistic[reaction] -= 1;
    if (next) optimistic[next] += 1;
    setReaction(next);
    setCounts(optimistic);
    if (next) setPopping(next);
    try {
      const state = await api<{ reaction: ReactionType | null; counts: PostCounts }>(
        `/posts/${post.id}/reaction`,
        next ? { method: "PUT", json: { type: next } } : { method: "DELETE" },
      );
      setReaction(state.reaction);
      setCounts(state.counts);
    } catch {
      setReaction(previous.reaction);
      setCounts(previous.counts);
    }
  }

  async function toggleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const state = await api<{ bookmarked: boolean; bookmarks: number }>(`/posts/${post.id}/bookmark`, {
        method: next ? "PUT" : "DELETE",
      });
      setBookmarked(state.bookmarked);
      setCounts((c) => ({ ...c, bookmarks: state.bookmarks }));
    } catch {
      setBookmarked(!next);
    }
  }

  const comments = commentCount ?? counts.comments;
  const totalReactions = REACTIONS.reduce((sum, r) => sum + (counts[r.type] ?? 0), 0);
  const topReactions = REACTIONS.filter((r) => counts[r.type] > 0)
    .sort((a, b) => counts[b.type] - counts[a.type])
    .slice(0, 3);
  const current = REACTIONS.find((r) => r.type === reaction);

  /** Tahan (HP) atau arahkan kursor (desktop) untuk memunculkan pilihan reaksi. */
  const startPress = (touch: boolean) => {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      if (touch) longPressed.current = true; // jangan anggap sebagai ketukan biasa
      setTray(true);
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };

  const actionClass =
    "flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-muted transition hover:bg-surface-muted active:scale-[0.98]";

  return (
    <div className="mt-2 px-3 pb-1">
      {(totalReactions > 0 || comments > 0) && (
        <div className="flex items-center justify-between px-1 py-1.5 text-sm text-muted">
          <span className="flex items-center gap-1.5" aria-label={`${totalReactions} reaksi`}>
            {topReactions.length > 0 && (
              <span className="flex -space-x-1" aria-hidden>
                {topReactions.map((r) => (
                  <span key={r.type} className="grid size-5 place-items-center rounded-full bg-surface text-xs ring-2 ring-surface">
                    {r.emoji}
                  </span>
                ))}
              </span>
            )}
            {totalReactions > 0 && <span className="tabular-nums">{totalReactions}</span>}
          </span>
          {comments > 0 &&
            (linkComments ? (
              <Link href={`/posts/${post.id}`} className="hover:underline">
                {comments} komentar
              </Link>
            ) : (
              <span>{comments} komentar</span>
            ))}
        </div>
      )}

      <div className="relative flex items-center gap-1 border-t border-border pt-1">
        {tray && (
          <div
            role="menu"
            aria-label="Pilih reaksi"
            className="animate-pop-in absolute -top-14 left-0 z-10 flex gap-1 rounded-full border border-border bg-surface p-1.5 shadow-lg"
            onMouseLeave={() => setTray(false)}
          >
            {REACTIONS.map((r) => (
              <button
                key={r.type}
                type="button"
                role="menuitemradio"
                aria-checked={reaction === r.type}
                aria-label={r.label}
                title={r.label}
                onClick={() => react(r.type)}
                className={`grid size-10 place-items-center rounded-full text-2xl transition hover:-translate-y-1 hover:scale-125 ${
                  reaction === r.type ? "bg-primary/10" : ""
                }`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-pressed={reaction !== null}
          aria-label={current ? `${current.label} (batalkan)` : "Setuju"}
          onClick={() => {
            if (longPressed.current) return;
            react(reaction ? reaction : "like");
          }}
          onMouseEnter={() => {
            if (window.matchMedia("(hover: hover)").matches) startPress(false);
          }}
          onMouseLeave={endPress}
          onTouchStart={() => startPress(true)}
          onTouchEnd={endPress}
          onContextMenu={(e) => e.preventDefault()}
          onAnimationEnd={() => setPopping(null)}
          className={`${actionClass} ${current ? "text-primary" : ""} ${popping ? "reaction-pop" : ""}`}
        >
          {current ? <span aria-hidden className="text-lg">{current.emoji}</span> : <ThumbsUp className="size-5" aria-hidden />}
          {current ? current.label : "Setuju"}
        </button>
        <button
          type="button"
          aria-label="Pilih reaksi lain"
          aria-expanded={tray}
          onClick={() => setTray((v) => !v)}
          className="grid h-10 w-8 place-items-center rounded-lg text-xs text-muted hover:bg-surface-muted"
        >
          ▾
        </button>
        {linkComments ? (
          <Link href={`/posts/${post.id}#komentar`} className={actionClass}>
            <MessageCircle className="size-5" aria-hidden /> Komentar
          </Link>
        ) : (
          <a href="#komentar" className={actionClass}>
            <MessageCircle className="size-5" aria-hidden /> Komentar
          </a>
        )}
        <button
          type="button"
          aria-pressed={bookmarked}
          aria-label={bookmarked ? "Hapus dari tersimpan" : "Simpan"}
          onClick={toggleBookmark}
          className={`${actionClass} ${bookmarked ? "text-primary" : ""}`}
        >
          <Bookmark className="size-5" fill={bookmarked ? "currentColor" : "none"} aria-hidden />
          <span className="hidden sm:inline">{bookmarked ? "Tersimpan" : "Simpan"}</span>
        </button>
        <button type="button" aria-label="Bagikan" onClick={() => setSharing(true)} className={actionClass}>
          <Share2 className="size-5" aria-hidden />
          <span className="hidden sm:inline">Bagikan</span>
        </button>
      </div>
      {sharing && <ShareSheet post={post} onClose={() => setSharing(false)} />}
    </div>
  );
}
