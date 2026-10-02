"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { Button, FullScreenSpinner } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { api } from "@/lib/api";
import type { OnboardingOptions, Post, PostPage } from "@/lib/types";

type Filter = "all" | "function" | "saved" | "discussion";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "function", label: "Fungsiku" },
  { value: "discussion", label: "Diskusi" },
  { value: "saved", label: "🔖 Tersimpan" },
];

function FeedView() {
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
  if (filter === "discussion") query.set("type", "discussion");
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
    router.replace(`/feed${next.toString() ? `?${next}` : ""}`, { scroll: false });
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

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-2xl font-extrabold">Feed Tim 💬</h1>
        <p className="mt-1 text-muted">Insight bacaan dari rekan-rekanmu.</p>
      </div>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Filter feed">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value && !functionParam}
            onClick={() => setParam({ filter: f.value === "all" ? null : f.value, function_id: null })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              filter === f.value && !functionParam
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface"
            }`}
          >
            {f.label}
          </button>
        ))}
        <label className="shrink-0">
          <span className="sr-only">Filter per fungsi</span>
          <select
            value={functionParam ?? ""}
            onChange={(e) => setParam({ function_id: e.target.value || null, filter: null })}
            className={`h-[34px] rounded-full border px-3 text-sm font-semibold ${
              functionParam ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"
            }`}
          >
            <option value="">Per fungsi…</option>
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
          Topik:
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">#{topic}</span>
          <button type="button" onClick={() => setParam({ topic: null })} className="text-muted">
            ✕ hapus
          </button>
        </p>
      )}

      {posts === null ? (
        <p className="py-8 text-center text-sm text-muted">Memuat feed…</p>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl bg-surface-muted p-6 text-center">
          <p className="text-3xl" aria-hidden>
            📭
          </p>
          <p className="mt-2 font-semibold">Belum ada posting di sini.</p>
          <Link href="/read" className="mt-3 inline-block font-bold text-primary">
            Mulai sesi baca & bagikan catatanmu →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {cursor && (
        <Button variant="ghost" loading={loadingMore} onClick={loadMore}>
          Muat lebih banyak
        </Button>
      )}
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <FeedView />
    </Suspense>
  );
}
