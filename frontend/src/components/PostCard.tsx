import Link from "next/link";

import { PostActions } from "@/features/feed/PostActions";
import { RichText } from "@/features/feed/RichText";
import type { Post } from "@/lib/types";
import { NOTE_TYPES } from "@/lib/words";

const TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(NOTE_TYPES.map((t) => [t.value, `${t.emoji} ${t.label}`])),
  discussion: "💬 Diskusi",
};

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt="" className="size-10 rounded-full object-cover" />;
  return (
    <span
      aria-hidden
      className="grid size-10 place-items-center rounded-full bg-accent/20 font-extrabold text-accent"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

type PostCardProps = {
  post: Post;
  showBook?: boolean;
  /** false di halaman detail (komentar sudah tampil di bawahnya). */
  linkComments?: boolean;
  actions?: boolean;
  commentCount?: number;
};

export function PostCard({
  post,
  showBook = true,
  linkComments = true,
  actions = true,
  commentCount,
}: PostCardProps) {
  return (
    <article className="animate-pop-in rounded-3xl border border-border bg-surface p-4">
      <header className="flex items-center gap-3">
        <Avatar name={post.author.name} url={post.author.avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{post.author.name}</p>
          <p className="text-xs text-muted">
            {TYPE_LABEL[post.type] ?? post.type} · {timeAgo(post.created_at)}
          </p>
        </div>
        {post.rating ? (
          <span className="text-sm font-bold text-accent" aria-label={`Rating ${post.rating}`}>
            {"★".repeat(post.rating)}
          </span>
        ) : null}
      </header>

      {showBook && (
        <Link
          href={`/books/${post.book.id}`}
          className="mt-3 block rounded-2xl bg-surface-muted px-3 py-2 text-sm"
        >
          <span className="font-bold">{post.book.title}</span>
          <span className="text-muted"> · {post.book.authors.join(", ")}</span>
        </Link>
      )}

      <p className="mt-3 leading-relaxed whitespace-pre-line">
        <RichText text={post.content} mentions={post.mentions} />
      </p>

      {post.image_urls.length > 0 && (
        <div className={`mt-3 grid gap-2 ${post.image_urls.length > 1 ? "grid-cols-2" : ""}`}>
          {post.image_urls.map((url) => (
            <img
              key={url}
              src={url}
              alt={`Foto buku ${post.book.title}`}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
        {post.is_book_finished && (
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-success">🎉 Buku selesai</span>
        )}
        {post.page_progress?.current_page != null && (
          <span className="rounded-full bg-surface-muted px-2.5 py-1">
            Hal. {post.page_progress.current_page}
            {post.page_progress.total_pages ? `/${post.page_progress.total_pages}` : ""}
          </span>
        )}
        {post.topics.map((topic) => (
          <Link
            key={topic}
            href={`/feed?topic=${encodeURIComponent(topic)}`}
            className="rounded-full bg-primary/10 px-2.5 py-1 text-primary"
          >
            #{topic}
          </Link>
        ))}
      </footer>
      {actions && (
        <PostActions post={post} linkComments={linkComments} commentCount={commentCount} />
      )}
    </article>
  );
}
