"use client";

import { Inbox, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS, Button, EmptyState, Skeleton, Tabs } from "@/components/ui";
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
      <div className="flex flex-wrap items-end gap-x-2 border-b border-line">
        <Tabs
          label="Filter feed"
          className="min-w-0 basis-full border-b-0 sm:basis-auto sm:flex-1"
          items={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={functionParam ? ("__fn" as Filter) : filter}
          onChange={(v) => setParam({ filter: v === "all" ? null : v, function_id: null })}
        />
        <label className="mb-1.5 ml-auto shrink-0">
          <span className="sr-only">Filter per fungsi</span>
          <select
            value={functionParam ?? ""}
            onChange={(e) => setParam({ function_id: e.target.value || null, filter: null })}
            className={`h-9 max-w-36 rounded-lg border px-2 text-sm font-semibold ${
              functionParam ? "border-ink bg-highlight/60 text-on-highlight" : "border-line bg-surface text-muted"
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
          <span className="hl px-1">#{topic}</span>
          <button type="button" onClick={() => setParam({ topic: null })} className="flex min-h-11 items-center gap-1 px-2 text-muted hover:text-ink">
            <X className="size-4" aria-hidden /> hapus
          </button>
        </p>
      )}

      {shown === null ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Memuat feed">
          {[0, 1].map((i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" />}
          title="Belum ada catatan di sini"
          body="Catatan muncul setelah seseorang menyelesaikan sesi baca. Jadilah yang pertama hari ini."
          action={
            <Link href="/read" className={`${BUTTON_BASE} ${BUTTON_SIZES.sm} ${BUTTON_VARIANTS.primary}`}>
              Mulai sesi baca
            </Link>
          }
        />
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
