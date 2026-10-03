"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { api } from "@/lib/api";
import type { Shelf, ShelfStatus } from "@/lib/types";

export const SHELF_LABEL: Record<ShelfStatus, string> = {
  reading: "Sedang dibaca",
  want: "Ingin dibaca",
  finished: "Selesai",
};

/** Rak buku (milik sendiri atau rekan) dengan tab per status. */
export function ShelfView({ userId, editable = false }: { userId?: string; editable?: boolean }) {
  const [status, setStatus] = useState<ShelfStatus>("reading");
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const base = userId ? `/users/${userId}/shelf` : "/me/shelf";

  useEffect(() => {
    api<Shelf>(`${base}?status=${status}`).then(setShelf).catch(() => undefined);
  }, [base, status]);

  async function move(bookId: string, next: ShelfStatus | null) {
    await api(`/me/shelf/${bookId}`, next ? { method: "PUT", json: { status: next } } : { method: "DELETE" });
    setShelf(await api<Shelf>(`${base}?status=${status}`));
  }

  return (
    <section className="card p-4" aria-label="Rak buku">
      <div className="flex gap-1 overflow-x-auto" role="tablist">
        {(Object.keys(SHELF_LABEL) as ShelfStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`h-9 shrink-0 rounded-md px-3 text-sm font-semibold ${
              status === s ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-muted"
            }`}
          >
            {SHELF_LABEL[s]}
            {shelf && <span className="ml-1.5 text-xs tabular-nums opacity-80">{shelf.counts[s]}</span>}
          </button>
        ))}
      </div>
      {!shelf ? (
        <div className="mt-4 h-40 animate-pulse rounded-lg bg-surface-muted" />
      ) : shelf.items.length === 0 ? (
        <p className="mt-4 rounded-lg bg-surface-muted p-4 text-sm text-muted">
          Belum ada buku di rak ini.
          {editable && status === "want" && " Tekan reaksi “📚 Mau baca juga” di feed untuk menambahkan."}
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {shelf.items.map(({ book }) => (
            <li key={book.id} className="flex flex-col gap-1.5">
              <Link href={`/books/${book.id}`} className="group">
                <span className="block [&>*]:!h-auto [&>*]:!w-full [&>*]:aspect-[3/4]">
                  <BookCover url={book.cover_url} title={book.title} size="md" />
                </span>
                <span className="mt-1 line-clamp-2 block text-xs font-semibold group-hover:underline">{book.title}</span>
              </Link>
              {editable && (
                <select
                  aria-label={`Pindahkan ${book.title}`}
                  value={status}
                  onChange={(e) => move(book.id, e.target.value === "remove" ? null : (e.target.value as ShelfStatus))}
                  className="h-8 rounded-md bg-surface-muted px-1 text-xs"
                >
                  {(Object.keys(SHELF_LABEL) as ShelfStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {SHELF_LABEL[s]}
                    </option>
                  ))}
                  <option value="remove">Hapus dari rak</option>
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
