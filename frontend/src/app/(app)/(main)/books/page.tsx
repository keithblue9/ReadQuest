"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AddBookForm } from "@/features/books/AddBookForm";
import { BookSearch } from "@/features/books/BookSearch";
import { useCategories } from "@/features/books/useCategories";

export default function BooksPage() {
  return (
    <Suspense fallback={null}>
      <Catalog />
    </Suspense>
  );
}

function Catalog() {
  const router = useRouter();
  const initialQuery = useSearchParams().get("q") ?? "";
  const categories = useCategories();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  if (adding !== null) {
    return (
      <div className="pt-2">
        <AddBookForm
          initialTitle={adding}
          onCreated={(book) => router.push(`/books/${book.id}`)}
          onCancel={() => setAdding(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-2xl font-bold">Katalog Buku</h1>
        <p className="mt-1 text-muted">Satu buku, satu ruang diskusi bersama tim.</p>
      </div>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Kategori">
        <button
          type="button"
          aria-pressed={categoryId === null}
          onClick={() => setCategoryId(null)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
            categoryId === null ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"
          }`}
        >
          Semua
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            aria-pressed={categoryId === cat.id}
            onClick={() => setCategoryId(cat.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              categoryId === cat.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface"
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>
      <BookSearch
        categoryId={categoryId}
        onSelect={(book) => router.push(`/books/${book.id}`)}
        onCreateNew={(title) => setAdding(title)}
        catalog
        initialQuery={initialQuery}
        key={initialQuery}
      />
    </div>
  );
}
