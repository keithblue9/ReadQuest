"use client";

import { useEffect, useMemo, useState } from "react";

import { Avatar, timeAgo } from "@/components/PostCard";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Comment, CommentCreated, UserMini } from "@/lib/types";

import { MentionTextarea } from "./MentionTextarea";
import { ReportButton } from "./ReportButton";
import { RichText } from "./RichText";

type Props = { postId: string; onCountChange?: (delta: number) => void };

export function CommentThread({ postId, onCountChange }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<UserMini[]>([]);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<string | null>(null);

  useEffect(() => {
    api<Comment[]>(`/posts/${postId}/comments`)
      .then(setComments)
      .catch((err) => setError(errorMessage(err)));
  }, [postId]);

  const threads = useMemo(() => {
    const list = comments ?? [];
    const roots = list.filter((c) => !c.root_id);
    return roots.map((root) => ({
      root,
      replies: list.filter((c) => c.root_id === root.id),
    }));
  }, [comments]);
  const byId = useMemo(() => new Map((comments ?? []).map((c) => [c.id, c])), [comments]);

  async function submit() {
    if (!text.trim()) return;
    setPending(true);
    setError(null);
    try {
      const created = await api<CommentCreated>(`/posts/${postId}/comments`, {
        method: "POST",
        json: {
          content: text,
          parent_id: replyTo?.id ?? null,
          mention_ids: mentions.filter((m) => text.includes(`@${m.name}`)).map((m) => m.id),
        },
      });
      setComments((current) => [...(current ?? []), created.comment]);
      onCountChange?.(1);
      setText("");
      setMentions([]);
      setReplyTo(null);
      const points = created.points.reduce((sum, p) => sum + p.points, 0);
      setReward(points ? `+${points} poin komentar bermakna ✨` : null);
      if (points) setTimeout(() => setReward(null), 3500);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function remove(comment: Comment) {
    if (!window.confirm("Hapus komentar ini?")) return;
    try {
      await api(`/posts/${postId}/comments/${comment.id}`, { method: "DELETE" });
      setComments((current) =>
        (current ?? []).map((c) => (c.id === comment.id ? { ...c, deleted: true, content: "" } : c)),
      );
      onCountChange?.(-1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function startReply(comment: Comment) {
    setReplyTo(comment);
    const tag = `@${comment.author.name} `;
    if (!text.startsWith(tag) && comment.author.id !== user?.id) {
      setText(tag + text);
      if (!mentions.some((m) => m.id === comment.author.id)) {
        setMentions([...mentions, comment.author]);
      }
    }
    document.getElementById(`comment-input-${postId}`)?.focus();
  }

  function renderComment(comment: Comment, isReply: boolean) {
    const parent = comment.parent_id ? byId.get(comment.parent_id) : null;
    return (
      <li key={comment.id} className={`flex gap-3 ${isReply ? "ml-10" : ""}`}>
        <Avatar name={comment.author.name || "?"} url={comment.author.avatar_url} size="sm" userId={comment.deleted ? undefined : comment.author.id} />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-surface-muted px-3 py-2">
            <p className="text-sm font-bold">
              {comment.deleted ? "—" : comment.author.name}
              {comment.is_meaningful && !comment.deleted && (
                <span className="ml-1 text-xs text-success" title="Komentar bermakna">
                  ✓
                </span>
              )}
            </p>
            {comment.deleted ? (
              <p className="text-sm text-muted italic">Komentar dihapus</p>
            ) : (
              <p className="text-sm whitespace-pre-line">
                {isReply && parent && parent.id !== comment.root_id && (
                  <span className="text-muted">↪ {parent.author.name} · </span>
                )}
                <RichText text={comment.content} mentions={comment.mentions} />
              </p>
            )}
          </div>
          <div className="mt-1 flex gap-3 px-2 text-xs font-semibold text-muted">
            <span>{timeAgo(comment.created_at)}</span>
            {!comment.deleted && (
              <button type="button" onClick={() => startReply(comment)} className="hover:text-primary">
                Balas
              </button>
            )}
            {!comment.deleted && comment.author.id === user?.id && (
              <button type="button" onClick={() => remove(comment)} className="hover:text-danger">
                Hapus
              </button>
            )}
            {!comment.deleted && comment.author.id !== user?.id && (
              <ReportButton path={`/posts/${postId}/comments/${comment.id}/report`} what="komentar" />
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Komentar">
      <h2 className="text-[15px] font-semibold">Komentar</h2>
      {comments === null ? (
        <p className="text-sm text-muted">Memuat komentar…</p>
      ) : threads.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-4 text-sm text-muted">
          Belum ada komentar. Mulai diskusinya! 💬
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {threads.map(({ root, replies }) => [
            renderComment(root, false),
            ...replies.map((reply) => renderComment(reply, true)),
          ])}
        </ul>
      )}

      <div className="sticky bottom-24 z-10 flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-lg lg:bottom-4">
        {replyTo && (
          <p className="flex items-center justify-between text-xs font-semibold text-muted">
            Membalas {replyTo.author.name}
            <button type="button" onClick={() => setReplyTo(null)} className="text-primary">
              Batal
            </button>
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {reward && (
          <p className="animate-pop-in text-sm font-bold text-success" role="status">
            {reward}
          </p>
        )}
        <MentionTextarea
          id={`comment-input-${postId}`}
          label="Tulis komentar"
          value={text}
          onChange={setText}
          mentions={mentions}
          onMentionsChange={setMentions}
          rows={2}
          placeholder="Tulis komentar yang bermakna… ketik @ untuk mention"
        />
        <Button onClick={submit} loading={pending} disabled={!text.trim()} className="h-10">
          Kirim
        </Button>
      </div>
    </section>
  );
}
