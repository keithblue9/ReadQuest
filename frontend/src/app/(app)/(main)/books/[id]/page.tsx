"use client";

import { BookBookmark, Quote, Timer, Zap } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { PostCard } from "@/components/PostCard";
import { Alert, Button, FullScreenSpinner } from "@/components/ui";
import { DiscussionComposer } from "@/features/feed/DiscussionComposer";
import { QuoteComposer } from "@/features/feed/QuoteComposer";
import { SHELF_LABEL } from "@/features/profile/ShelfView";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Book, Post, PostPage, Shelf, ShelfStatus } from "@/lib/types";

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shelfStatus, setShelfStatus] = useState<ShelfStatus | null>(null);
  const [quoting, setQuoting] = useState(false);

  const fetchPosts = useCallback(
    (after: string | null) => {
      const params = new URLSearchParams({ limit: "10" });
      if (after) params.set("cursor", after);
      return api<PostPage>(`/books/${id}/posts?${params}`);
    },
    [id],
  );

  useEffect(() => {
    api<Book>(`/books/${id}`)
      .then(setBook)
      .catch((err) => setError(errorMessage(err)));
    api<Shelf>("/me/shelf")
      .then((s) => setShelfStatus(s.items.find((i) => i.book.id === id)?.status ?? null))
      .catch(() => undefined);
    fetchPosts(null)
      .then((page) => {
        setPosts(page.items);
        setCursor(page.next_cursor);
      })
      .catch(() => undefined);
  }, [id, fetchPosts]);

  async function setShelf(next: ShelfStatus | null) {
    const previous = shelfStatus;
    setShelfStatus(next);
    try {
      await api(`/me/shelf/${id}`, next ? { method: "PUT", json: { status: next } } : { method: "DELETE" });
    } catch (err) {
      setShelfStatus(previous);
      setError(errorMessage(err));
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchPosts(cursor);
      setPosts((current) => [...current, ...page.items]);
      setCursor(page.next_cursor);
    } catch {
      // biarkan tombol tetap ada untuk dicoba lagi
    } finally {
      setLoadingMore(false);
    }
  }

  if (error) {
    return (
      <div className="pt-4">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!book) return <FullScreenSpinner />;

  const stats = [
    ["Pembaca", book.stats.readers_count],
    ["Posting", book.stats.posts_count],
    ["Selesai", book.stats.finished_count],
    ["Rating", book.stats.avg_rating ? `★ ${book.stats.avg_rating.toFixed(1)}` : "—"],
  ];

  return (
    <div className="flex flex-col gap-3">
      <section className="card animate-pop-in flex gap-4 p-4">
        <BookCover url={book.cover_url} title={book.title} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-primary">
            {book.category?.icon} {book.category?.name}
          </p>
          <h1 className="mt-1 text-2xl leading-tight font-bold">{book.title}</h1>
          <p className="mt-1 text-muted">{book.authors.join(", ")}</p>
          <p className="mt-2 text-xs text-muted">
            {[book.publisher, book.year, book.total_pages && `${book.total_pages} hal.`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </section>

      <dl className="card grid grid-cols-4 divide-x divide-border text-center">
        {stats.map(([label, value]) => (
          <div key={label} className="px-1 py-3">
            <dt className="text-[11px] font-semibold text-muted">{label}</dt>
            <dd className="mt-0.5 font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/read?book=${book.id}`}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground hover:brightness-110"
        >
          <Timer className="size-5" aria-hidden /> Baca buku ini
        </Link>
        <Link
          href={`/read?book=${book.id}&mode=micro`}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-surface-muted font-semibold hover:brightness-95"
        >
          <Zap className="size-5 text-amber-500" aria-hidden /> Baca 5 menit
        </Link>
        <label className="relative flex h-11 items-center gap-2 rounded-lg bg-surface-muted px-3 font-semibold">
          <BookBookmark className="size-5 text-primary" aria-hidden />
          <span className="sr-only">Status di rak buku</span>
          <select
            value={shelfStatus ?? ""}
            onChange={(e) => setShelf((e.target.value || null) as ShelfStatus | null)}
            className="h-full flex-1 bg-transparent text-sm outline-none"
          >
            <option value="">Tambah ke rak…</option>
            {(Object.keys(SHELF_LABEL) as ShelfStatus[]).map((s) => (
              <option key={s} value={s}>
                {SHELF_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setQuoting(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-surface-muted font-semibold hover:brightness-95"
        >
          <Quote className="size-5 text-teal-600" aria-hidden /> Bagikan kutipan
        </button>
      </div>
      {quoting && (
        <QuoteComposer
          book={book}
          onClose={() => setQuoting(false)}
          onCreated={(post) => {
            setQuoting(false);
            setPosts((current) => [post, ...current]);
          }}
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Diskusi & catatan</h2>
        <DiscussionComposer
          bookId={book.id}
          onCreated={(post) => setPosts((current) => [post, ...current])}
        />
        {posts.length === 0 ? (
          <p className="card p-4 text-sm text-muted">Belum ada catatan. Jadilah yang pertama berbagi insight.</p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} showBook={false} />)
        )}
        {cursor && (
          <Button variant="ghost" loading={loadingMore} onClick={loadMore}>
            Muat lebih banyak
          </Button>
        )}
      </section>
    </div>
  );
}
