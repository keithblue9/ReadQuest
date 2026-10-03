"use client";

import { Inbox, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { api } from "@/lib/api";
import type { OnboardingOptions, Post, PostPage } from "@/lib/types";

type Filter = "all" | "function" | "quote" | "discussion" | "saved";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "function", label: "Fungsiku" },
  { value: "quote", label: "Kutipan" },
  { value: "discussion", label: "Diskusi" },
  { value: "saved", label: "Tersimpan" },
];

/** Feed tim dengan tab filter (dipakai Beranda & /feed). `prepend` menyisipkan posting baru. */
export function FeedView({ basePath, prepend }: { basePath: string; prepend?: Post | null }) {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const topic = params.get("topic");
  const filter = (params.get("filter") as Filter | null) ?? "all";
  const functionParam = params.get("function_id");

  const [functions, setFunctions] = useState<OnboardingOptions["functions"]>([]);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const query = new URLSearchParams({ limit: "10" });
  if (topic) query.set("topic", topic);
  if (filter === "saved") query.set("bookmarked", "true");
  if (filter === "discussion" || filter === "quote") query.set("type", filter);
  const functionId = functionParam ?? (filter === "function" ? user?.function_id : null);
  if (functionId) query.set("function_id", functionId);
  const queryKey = query.toString();

  useEffect(() => {
    api<OnboardingOptions>("/me/onboarding/options")
      .then((o) => setFunctions(o.functions))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<PostPage>(`/feed?${queryKey}`)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.items);
        setCursor(page.next_cursor);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  function setParam(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${basePath}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api<PostPage>(`/feed?${queryKey}&cursor=${cursor}`);
      setPosts((current) => [...(current ?? []), ...page.items]);
      setCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  const shown = posts && prepend && !posts.some((p) => p.id === prepend.id) ? [prepend, ...posts] : posts;

  return (
    <section className="flex flex-col gap-3" aria-label="Feed tim">
      <div className="card flex flex-wrap items-center gap-1 p-1.5" role="tablist" aria-label="Filter feed">
        {FILTERS.map((f) => {
          const active = filter === f.value && !functionParam;
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParam({ filter: f.value === "all" ? null : f.value, function_id: null })}
              className={`h-9 shrink-0 rounded-md px-3 text-sm font-semibold transition ${
                active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-muted"
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <span className="hidden flex-1 sm:block" />
        <label className="shrink-0">
          <span className="sr-only">Filter per fungsi</span>
          <select
            value={functionParam ?? ""}
            onChange={(e) => setParam({ function_id: e.target.value || null, filter: null })}
            className={`h-9 max-w-36 rounded-md border-0 px-2 text-sm font-semibold outline-none ${
              functionParam ? "bg-primary/10 text-primary" : "bg-surface-muted text-muted"
            }`}
          >
            <option value="">Per fungsi</option>
            {functions.map((fn) => (
              <option key={fn.id} value={fn.id}>
                {fn.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {topic && (
        <p className="flex items-center gap-2 text-sm font-semibold">
          Topik
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">#{topic}</span>
          <button type="button" onClick={() => setParam({ topic: null })} className="flex items-center gap-1 text-muted">
            <X className="size-4" aria-hidden /> hapus
          </button>
        </p>
      )}

      {shown === null ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Memuat feed">
          {[0, 1].map((i) => (
            <div key={i} className="card h-48 animate-pulse" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="card p-8 text-center">
          <Inbox className="mx-auto size-10 text-muted" aria-hidden />
          <p className="mt-2 font-semibold">Belum ada posting di sini.</p>
          <Link href="/read" className="mt-3 inline-block font-semibold text-primary">
            Mulai sesi baca & bagikan catatanmu →
          </Link>
        </div>
      ) : (
        shown.map((post) => <PostCard key={post.id} post={post} />)
      )}

      {cursor && (
        <Button variant="ghost" loading={loadingMore} onClick={loadMore}>
          Muat lebih banyak
        </Button>
      )}
    </section>
  );
}
