"use client";

import { useEffect, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import type { Post, PostPage } from "@/lib/types";

export function AuthorPosts({ authorId }: { authorId: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<PostPage>(`/feed?author_id=${authorId}&limit=10`)
      .then((page) => {
        setPosts(page.items);
        setCursor(page.next_cursor);
      })
      .catch(() => setPosts([]));
  }, [authorId]);

  async function more() {
    if (!cursor) return;
    setLoading(true);
    try {
      const page = await api<PostPage>(`/feed?author_id=${authorId}&limit=10&cursor=${cursor}`);
      setPosts((p) => [...(p ?? []), ...page.items]);
      setCursor(page.next_cursor);
    } finally {
      setLoading(false);
    }
  }

  if (posts === null) return <div className="card h-40 animate-pulse" />;
  if (posts.length === 0) return <p className="card p-6 text-center text-sm text-muted">Belum ada posting.</p>;
  return (
    <div className="flex flex-col gap-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {cursor && (
        <Button variant="ghost" loading={loading} onClick={more}>
          Muat lebih banyak
        </Button>
      )}
    </div>
  );
}
