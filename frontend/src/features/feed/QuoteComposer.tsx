"use client";

import { Quote, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Book, Post } from "@/lib/types";

/** Dialog berbagi kutipan favorit: pilih buku → tulis kutipan (+ halaman & refleksi). */
export function QuoteComposer({ onClose, onCreated, book: initialBook }: { onClose: () => void; onCreated: (post: Post) => void; book?: Book }) {
  const [book, setBook] = useState<Book | null>(initialBook ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [text, setText] = useState("");
  const [page, setPage] = useState("");
  const [reflection, setReflection] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (book) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ limit: "6" });
      if (query.trim()) q.set("q", query.trim());
      api<Book[]>(`/books?${q}`, { signal: controller.signal }).then(setResults).catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, book]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!book) return;
    setPending(true);
    setError(null);
    try {
      const post = await api<Post>(`/books/${book.id}/quotes`, {
        method: "POST",
        json: { text, page: page ? Number(page) : null, reflection },
      });
      onCreated(post);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 sm:place-items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-title"
        className="animate-pop-in card flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="quote-title" className="flex items-center gap-2 text-lg font-bold">
            <Quote className="size-5 text-primary" aria-hidden /> Bagikan kutipan
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center rounded-full bg-surface-muted">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          {error && <Alert>{error}</Alert>}
          {!book ? (
            <>
              <label className="relative block">
                <span className="sr-only">Cari buku</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Kutipan dari buku apa?"
                  className="h-11 w-full rounded-lg bg-surface-muted pr-3 pl-9 outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <ul className="flex flex-col gap-1">
                {results.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => setBook(b)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-surface-muted">
                      <BookCover url={b.cover_url} title={b.title} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{b.title}</span>
                        <span className="block truncate text-sm text-muted">{b.authors.join(", ")}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && <li className="p-3 text-sm text-muted">Buku tidak ditemukan. Tambahkan dulu di Katalog Buku.</li>}
              </ul>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-2">
                <BookCover url={book.cover_url} title={book.title} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{book.title}</span>
                  <span className="block truncate text-sm text-muted">{book.authors.join(", ")}</span>
                </span>
                {!initialBook && (
                  <button type="button" onClick={() => setBook(null)} className="text-sm font-semibold text-primary">
                    Ganti
                  </button>
                )}
              </div>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Kutipan
                <textarea
                  autoFocus
                  value={text}
                  maxLength={600}
                  rows={4}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Tulis kalimat dari buku yang paling mengena…"
                  className="rounded-lg border border-border bg-surface p-3 font-serif text-lg font-normal italic outline-none focus:border-primary"
                />
              </label>
              <div className="grid grid-cols-[7rem_1fr] gap-3">
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Halaman
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={page}
                    onChange={(e) => setPage(e.target.value)}
                    className="h-11 rounded-lg border border-border bg-surface px-3 font-normal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Refleksimu (opsional)
                  <input
                    value={reflection}
                    maxLength={1000}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="Kenapa kalimat ini penting?"
                    className="h-11 rounded-lg border border-border bg-surface px-3 font-normal"
                  />
                </label>
              </div>
            </>
          )}
        </div>
        {book && (
          <footer className="border-t border-border p-4">
            <Button onClick={submit} loading={pending} disabled={text.trim().length < 5}>
              Bagikan ke tim
            </Button>
          </footer>
        )}
      </div>
    </div>
  );
}
