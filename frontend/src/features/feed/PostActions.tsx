"use client";

import Link from "next/link";
import { useState } from "react";

import { api } from "@/lib/api";
import type { Post, PostCounts, ReactionType } from "@/lib/types";

import { ShareSheet } from "./ShareSheet";

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "insightful", emoji: "💡", label: "Insightful" },
  { type: "inspiring", emoji: "✨", label: "Inspiring" },
];

type Props = { post: Post; linkComments?: boolean; commentCount?: number };

export function PostActions({ post, linkComments = true, commentCount }: Props) {
  const [reaction, setReaction] = useState<ReactionType | null>(post.viewer.reaction);
  const [counts, setCounts] = useState<PostCounts>(post.counts);
  const [bookmarked, setBookmarked] = useState(post.viewer.bookmarked);
  const [sharing, setSharing] = useState(false);
  const [popping, setPopping] = useState<ReactionType | null>(null);

  async function toggleReaction(type: ReactionType) {
    const previous = { reaction, counts };
    const next = reaction === type ? null : type;
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
      const state = await api<{ bookmarked: boolean; bookmarks: number }>(
        `/posts/${post.id}/bookmark`,
        { method: next ? "PUT" : "DELETE" },
      );
      setBookmarked(state.bookmarked);
      setCounts((c) => ({ ...c, bookmarks: state.bookmarks }));
    } catch {
      setBookmarked(!next);
    }
  }

  const comments = commentCount ?? counts.comments;
  const commentLabel = `${comments} komentar`;

  return (
    <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3">
      {REACTIONS.map((r) => {
        const active = reaction === r.type;
        return (
          <button
            key={r.type}
            type="button"
            aria-pressed={active}
            aria-label={`${r.label} (${counts[r.type]})`}
            onClick={() => toggleReaction(r.type)}
            onAnimationEnd={() => setPopping(null)}
            className={`flex h-9 items-center gap-1 rounded-full border px-2.5 text-sm font-bold transition active:scale-90 ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted hover:text-foreground"
            } ${popping === r.type ? "reaction-pop" : ""}`}
          >
            <span aria-hidden>{r.emoji}</span>
            <span className="tabular-nums">{counts[r.type]}</span>
          </button>
        );
      })}
      <span className="flex-1" />
      {linkComments ? (
        <Link
          href={`/posts/${post.id}`}
          aria-label={commentLabel}
          className="flex h-9 items-center gap-1 rounded-full px-2 text-sm font-bold text-muted hover:text-foreground"
        >
          <span aria-hidden>💬</span>
          <span className="tabular-nums">{comments}</span>
        </Link>
      ) : (
        <span className="flex h-9 items-center gap-1 px-2 text-sm font-bold text-muted" aria-label={commentLabel}>
          <span aria-hidden>💬</span>
          {comments}
        </span>
      )}
      <button
        type="button"
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "Hapus dari tersimpan" : "Simpan"}
        onClick={toggleBookmark}
        className={`grid size-9 place-items-center rounded-full text-lg transition active:scale-90 ${
          bookmarked ? "text-accent" : "text-muted"
        }`}
      >
        {bookmarked ? "🔖" : "📑"}
      </button>
      <button
        type="button"
        aria-label="Bagikan"
        onClick={() => setSharing(true)}
        className="grid size-9 place-items-center rounded-full text-lg text-muted transition active:scale-90"
      >
        📤
      </button>
      {sharing && <ShareSheet post={post} onClose={() => setSharing(false)} />}
    </div>
  );
}
