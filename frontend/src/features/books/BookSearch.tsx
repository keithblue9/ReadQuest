"use client";

import { useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { api } from "@/lib/api";
import type { Book } from "@/lib/types";

type Props = {
  onSelect: (book: Book) => void;
  onCreateNew: (title: string) => void;
  categoryId?: string | null;
};

export function BookSearch({ onSelect, onCreateNew, categoryId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Book[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: "20" });
      if (query.trim()) params.set("q", query.trim());
      if (categoryId) params.set("category_id", categoryId);
      api<Book[]>(`/books?${params}`, { signal: controller.signal })
        .then(setResults)
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, categoryId]);

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Cari judul atau pengarang</span>
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2" aria-hidden>
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari judul atau pengarang…"
          className="h-12 w-full rounded-2xl border border-border bg-surface pr-4 pl-11 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
      </label>

      {results === null ? (
        <p className="py-6 text-center text-sm text-muted">Memuat katalog…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                onClick={() => onSelect(book)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left transition hover:border-primary active:scale-[0.99]"
              >
                <BookCover url={book.cover_url} title={book.title} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{book.title}</span>
                  <span className="block truncate text-sm text-muted">
                    {book.authors.join(", ")}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {book.category?.icon} {book.category?.name} · {book.stats.posts_count} catatan
                  </span>
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="py-4 text-center text-sm text-muted">
              {query ? "Buku belum ada di katalog." : "Katalog masih kosong."}
            </li>
          )}
        </ul>
      )}

      <button
        type="button"
        onClick={() => onCreateNew(query.trim())}
        className="rounded-2xl border-2 border-dashed border-primary/40 p-3 font-bold text-primary transition hover:bg-primary/5"
      >
        ➕ Tambah buku baru{query.trim() ? ` “${query.trim()}”` : ""}
      </button>
    </div>
  );
}
