import { PartyPopper } from "lucide-react";
import Link from "next/link";

import { PostActions } from "@/features/feed/PostActions";
import { RichText } from "@/features/feed/RichText";
import type { Post } from "@/lib/types";
import { POST_TYPE_LABEL } from "@/lib/words";

import { Avatar } from "./Avatar";
import { BookCover } from "./BookCover";

export { Avatar } from "./Avatar";

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} j`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} h`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const TAKEAWAY_LABEL = { insight: "Insight", action: "Aksi", quote: "Kutipan" } as const;

/** Kalimat aktivitas di bawah nama, seperti "menulis Chapter Story". */
function activity(post: Post): string {
  if (post.type === "quote") return "membagikan kutipan";
  if (post.type === "discussion") return "memulai diskusi";
  if (post.is_book_finished) return "menyelesaikan buku";
  return `menulis ${POST_TYPE_LABEL[post.type] ?? "catatan"}`;
}

type PostCardProps = {
  post: Post;
  showBook?: boolean;
  /** false di halaman detail (komentar sudah tampil di bawahnya). */
  linkComments?: boolean;
  actions?: boolean;
  commentCount?: number;
  menu?: React.ReactNode;
};

export function PostCard({
  post,
  showBook = true,
  linkComments = true,
  actions = true,
  commentCount,
  menu,
}: PostCardProps) {
  const progress = post.page_progress;
  const pct =
    progress?.current_page && progress.total_pages
      ? Math.min(100, Math.round((progress.current_page / progress.total_pages) * 100))
      : null;

  return (
    <article className="card overflow-hidden">
      <header className="flex items-start gap-3 px-4 pt-4">
        <Avatar name={post.author.name} url={post.author.avatar_url} userId={post.author.id} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug">
            <Link href={`/u/${post.author.id}`} className="font-semibold hover:underline">
              {post.author.name}
            </Link>{" "}
            <span className="text-muted">{activity(post)}</span>
          </p>
          <p className="text-[13px] text-muted">
            <Link href={`/posts/${post.id}`} className="hover:underline">
              <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
            </Link>
            {post.type === "takeaway" && post.takeaway_kind && <> · {TAKEAWAY_LABEL[post.takeaway_kind]}</>}
            {post.rating ? (
              <span className="ml-1 text-rating" role="img" aria-label={`Rating ${post.rating} dari 5`}>
                · {"★".repeat(post.rating)}
                <span className="text-line">{"★".repeat(5 - post.rating)}</span>
              </span>
            ) : null}
          </p>
        </div>
        {menu}
      </header>

      <div className="px-4 pt-3">
        {post.type === "quote" && post.quote ? (
          <figure className="my-1 border-l-[6px] border-highlight py-1 pr-3 pl-4">
            <blockquote className="font-display text-xl leading-relaxed">“{post.quote.text}”</blockquote>
            <figcaption className="mt-1.5 text-sm text-muted">
              — {post.book.title}
              {post.quote.page ? `, hlm. ${post.quote.page}` : ""}
            </figcaption>
          </figure>
        ) : null}
        {(post.type !== "quote" || post.content !== post.quote?.text) && (
          <p className={`prose-note whitespace-pre-line ${post.type === "takeaway" ? "text-lg" : ""} ${post.type === "quote" ? "mt-2 font-sans text-[15px]" : ""}`}>
            <RichText text={post.content} mentions={post.mentions} />
          </p>
        )}
        {post.topics.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-x-2 text-sm">
            {post.topics.map((topic) => (
              <Link key={topic} href={`/feed?topic=${encodeURIComponent(topic)}`} className="font-semibold text-brand underline-offset-2 hover:underline">
                #{topic}
              </Link>
            ))}
          </p>
        )}
      </div>

      {post.image_urls.length > 0 && (
        <div className={`mx-4 mt-3 grid gap-1 overflow-hidden rounded-xl ${post.image_urls.length > 1 ? "grid-cols-2" : ""}`}>
          {post.image_urls.map((url) => (
            <img
              key={url}
              src={url}
              alt={`Foto buku ${post.book.title}`}
              loading="lazy"
              decoding="async"
              width={640}
              height={400}
              className="aspect-[16/10] w-full bg-surface-muted object-cover"
            />
          ))}
        </div>
      )}

      {showBook && (
        <Link
          href={`/books/${post.book.id}`}
          className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-line p-2.5 transition hover:bg-surface-muted"
        >
          <BookCover url={null} title={post.book.title} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{post.book.title}</span>
            <span className="block truncate text-xs text-muted">{post.book.authors.join(", ")}</span>
          </span>
          {post.is_book_finished ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-leaf/15 px-2 py-0.5 text-xs font-semibold text-leaf">
              <PartyPopper className="size-3.5" aria-hidden /> Selesai
            </span>
          ) : pct !== null ? (
            <span className="w-24 shrink-0 text-right text-xs text-muted">
              <span className="block tabular-nums">
                hal. <span className="font-semibold text-ink">{progress?.current_page}</span>/{progress?.total_pages}
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-[2px] bg-line">
                <span className="block h-full rounded-[2px] bg-highlight" style={{ width: `${pct}%` }} />
              </span>
            </span>
          ) : null}
        </Link>
      )}

      {actions ? (
        <PostActions post={post} linkComments={linkComments} commentCount={commentCount} />
      ) : (
        <div className="h-3" />
      )}
    </article>
  );
}

