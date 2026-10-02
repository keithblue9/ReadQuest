"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { Alert, FullScreenSpinner } from "@/components/ui";
import { CommentThread } from "@/features/feed/CommentThread";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Post } from "@/lib/types";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [commentDelta, setCommentDelta] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Post>(`/posts/${id}`)
      .then(setPost)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (error) {
    return (
      <div className="pt-4">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!post) return <FullScreenSpinner />;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <PostCard
        post={post}
        linkComments={false}
        commentCount={post.counts.comments + commentDelta}
      />
      <CommentThread postId={post.id} onCountChange={(d) => setCommentDelta((c) => c + d)} />
    </div>
  );
}
