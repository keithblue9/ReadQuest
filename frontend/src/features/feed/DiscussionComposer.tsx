"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Post, UserMini } from "@/lib/types";

import { MentionTextarea } from "./MentionTextarea";

export function DiscussionComposer({
  bookId,
  onCreated,
}: {
  bookId: string;
  onCreated: (post: Post) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<UserMini[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border-2 border-dashed border-primary/40 p-3 text-left font-semibold text-primary"
      >
        💬 Mulai diskusi tentang buku ini…
      </button>
    );
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const post = await api<Post>(`/books/${bookId}/discussions`, {
        method: "POST",
        json: {
          content: text,
          mention_ids: mentions.filter((m) => text.includes(`@${m.name}`)).map((m) => m.id),
        },
      });
      onCreated(post);
      setText("");
      setMentions([]);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="animate-pop-in flex flex-col gap-2 rounded-3xl border border-border bg-surface p-3">
      <MentionTextarea
        id={`discussion-${bookId}`}
        label="Tulis diskusi"
        value={text}
        onChange={setText}
        mentions={mentions}
        onMentionsChange={setMentions}
        rows={3}
        placeholder="Pertanyaan atau pendapatmu tentang buku ini… (@ untuk mention)"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" className="h-10" onClick={() => setOpen(false)}>
          Batal
        </Button>
        <Button className="h-10" loading={pending} disabled={!text.trim()} onClick={submit}>
          Kirim diskusi
        </Button>
      </div>
    </div>
  );
}
