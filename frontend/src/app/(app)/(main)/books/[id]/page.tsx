"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { PostCard } from "@/components/PostCard";
import { Alert, Button, FullScreenSpinner } from "@/components/ui";
import { DiscussionComposer } from "@/features/feed/DiscussionComposer";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Book, Post, PostPage } from "@/lib/types";

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    fetchPosts(null)
      .then((page) => {
        setPosts(page.items);
        setCursor(page.next_cursor);
      })
      .catch(() => undefined);
  }, [id, fetchPosts]);

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
    <div className="flex flex-col gap-5 pt-2">
      <section className="animate-pop-in flex gap-4">
        <BookCover url={book.cover_url} title={book.title} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-primary">
            {book.category?.icon} {book.category?.name}
          </p>
          <h1 className="mt-1 text-2xl leading-tight font-extrabold">{book.title}</h1>
          <p className="mt-1 text-muted">{book.authors.join(", ")}</p>
          <p className="mt-2 text-xs text-muted">
            {[book.publisher, book.year, book.total_pages && `${book.total_pages} hal.`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </section>

      <dl className="grid grid-cols-4 gap-2 text-center">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface px-1 py-3">
            <dt className="text-[11px] font-semibold text-muted">{label}</dt>
            <dd className="mt-0.5 font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      <Link
        href={`/read?book=${book.id}`}
        className="flex h-12 items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/25"
      >
        ▶️ Baca buku ini
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold">Diskusi & catatan</h2>
        <DiscussionComposer
          bookId={book.id}
          onCreated={(post) => setPosts((current) => [post, ...current])}
        />
        {posts.length === 0 ? (
          <p className="rounded-2xl bg-surface-muted p-4 text-sm text-muted">
            Belum ada catatan. Jadilah yang pertama berbagi insight! ✨
          </p>
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
