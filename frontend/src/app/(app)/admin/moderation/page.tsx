"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Post } from "@/lib/types";

type Moderation = { status: string; reason?: string | null; at?: string | null };
type QueuePost = Post & { reports: Report[]; moderation: Moderation };
type Report = { reason: string; at: string };
type QueueComment = {
  id: string;
  post_id: string;
  author: string;
  content: string;
  reports: Report[];
  moderation: Moderation;
  created_at: string;
};
type Queue = { posts: QueuePost[]; comments: QueueComment[] };
type Kind = "posts" | "comments";

const NOTE_LABEL: Record<string, string> = {
  quick_note: "Quick Note",
  chapter_story: "Chapter Story",
  book_review: "Book Review",
  progress_photo: "Foto progres",
  discussion: "Diskusi",
};

const date = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Reports({ reports }: { reports: Report[] }) {
  if (!reports.length) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-xl bg-danger/5 p-3 text-sm">
      {reports.map((r, i) => (
        <li key={i}>
          🚩 <span className="font-semibold">{r.reason}</span>
          <span className="ml-2 text-xs text-muted">{date(r.at)}</span>
        </li>
      ))}
    </ul>
  );
}

function Actions({
  kind,
  id,
  status,
  onDone,
}: {
  kind: Kind;
  id: string;
  status: "flagged" | "hidden";
  onDone: (message: string) => void;
}) {
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const [reverse, setReverse] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "hide" | "restore" | "dismiss") {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ status: string; reversed_entries: number }>(`/admin/moderation/${kind}/${id}`, {
        method: "POST",
        json: { action, reason, reverse_points: action === "hide" && reverse },
      });
      onDone(
        action === "hide"
          ? `Konten disembunyikan${res.reversed_entries ? `, ${res.reversed_entries} entri poin dibatalkan` : ""}.`
          : action === "restore"
            ? "Konten dipulihkan."
            : "Laporan diabaikan.",
      );
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (status === "hidden") {
    return (
      <div className="flex flex-col gap-2">
        {error && <Alert>{error}</Alert>}
        <Button variant="ghost" className="h-9 w-auto self-start px-4 text-sm" loading={busy} onClick={() => act("restore")}>
          Pulihkan
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <Alert>{error}</Alert>}
      {hiding ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Alasan (tercatat di audit log)
            <input
              className="rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={reverse}
              onChange={(e) => setReverse(e.target.checked)}
            />
            Batalkan poin yang diperoleh dari konten ini
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" className="h-9 w-auto px-4 text-sm" onClick={() => setHiding(false)}>
              Batal
            </Button>
            <Button variant="danger" className="h-9 w-auto px-4 text-sm" loading={busy} onClick={() => act("hide")}>
              Sembunyikan
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="danger" className="h-9 w-auto px-4 text-sm" onClick={() => setHiding(true)}>
            Sembunyikan…
          </Button>
          <Button variant="ghost" className="h-9 w-auto px-4 text-sm" loading={busy} onClick={() => act("dismiss")}>
            Abaikan laporan
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminModerationPage() {
  const [status, setStatus] = useState<"flagged" | "hidden">("flagged");
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<Queue>(`/admin/moderation?status=${status}`)
        .then(setQueue)
        .catch((err) => setError(errorMessage(err))),
    [status],
  );

  useEffect(() => {
    load();
  }, [load]);

  const done = (message: string) => {
    setNotice(message);
    load();
  };

  const empty = queue && !queue.posts.length && !queue.comments.length;

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Moderasi</h1>
        <p className="text-sm text-muted">Konten yang dilaporkan anggota atau sudah disembunyikan.</p>
      </header>

      <div role="tablist" aria-label="Status moderasi" className="flex gap-1 self-start rounded-xl border border-border bg-surface p-1">
        {(
          [
            ["flagged", "🚩 Dilaporkan"],
            ["hidden", "🙈 Disembunyikan"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => {
              setQueue(null);
              setNotice(null);
              setStatus(value);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              status === value ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && (
        <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {notice}
        </p>
      )}

      {!queue ? (
        <p className="text-sm text-muted">Memuat…</p>
      ) : empty ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          {status === "flagged" ? "Tidak ada laporan baru 🎉" : "Belum ada konten yang disembunyikan."}
        </p>
      ) : (
        <>
          {queue.posts.map((p) => (
            <article key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">
                  {p.author.name}
                  <span className="ml-2 text-xs font-semibold text-muted">
                    {NOTE_LABEL[p.type] ?? p.type} · {p.book.title} · {date(p.created_at)}
                  </span>
                </p>
                {status === "flagged" && (
                  <Link href={`/posts/${p.id}`} className="text-xs font-bold text-primary">
                    Buka posting →
                  </Link>
                )}
              </div>
              <p className="line-clamp-4 text-sm whitespace-pre-line">{p.content}</p>
              <Reports reports={p.reports} />
              {status === "hidden" && p.moderation.reason && (
                <p className="text-xs text-muted">Alasan disembunyikan: {p.moderation.reason}</p>
              )}
              <Actions kind="posts" id={p.id} status={status} onDone={done} />
            </article>
          ))}
          {queue.comments.map((c) => (
            <article key={c.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">
                  💬 {c.author}
                  <span className="ml-2 text-xs font-semibold text-muted">Komentar · {date(c.created_at)}</span>
                </p>
                <Link href={`/posts/${c.post_id}`} className="text-xs font-bold text-primary">
                  Buka posting →
                </Link>
              </div>
              <p className="text-sm whitespace-pre-line">{c.content}</p>
              <Reports reports={c.reports} />
              {status === "hidden" && c.moderation.reason && (
                <p className="text-xs text-muted">Alasan disembunyikan: {c.moderation.reason}</p>
              )}
              <Actions kind="comments" id={c.id} status={status} onDone={done} />
            </article>
          ))}
        </>
      )}
    </section>
  );
}
