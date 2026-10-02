"use client";

import { useState } from "react";

import { PhotoPicker } from "@/components/PhotoPicker";
import { Alert, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/errors";
import type { Book, UploadedPhoto } from "@/lib/types";

import { useCategories } from "./useCategories";

type Props = {
  initialTitle?: string;
  onCreated: (book: Book) => void;
  onCancel: () => void;
};

export function AddBookForm({ initialTitle = "", onCreated, onCancel }: Props) {
  const categories = useCategories();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cover, setCover] = useState<UploadedPhoto[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value ? Number(value) : null;
    };
    if (!categoryId) {
      setErrors({ category_id: "Pilih kategori" });
      return;
    }
    setPending(true);
    setError(null);
    setErrors({});
    try {
      const book = await api<Book>("/books", {
        method: "POST",
        json: {
          title: String(form.get("title")),
          authors: String(form.get("authors"))
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          category_id: categoryId,
          publisher: String(form.get("publisher") ?? "") || null,
          year: optionalNumber("year"),
          total_pages: optionalNumber("total_pages"),
          cover_image_key: cover[0]?.key ?? null,
        },
      });
      onCreated(book);
    } catch (err) {
      const perField = fieldErrors(err);
      setErrors(perField);
      setError(Object.keys(perField).length ? "Periksa kembali isian buku." : errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="animate-pop-in flex flex-col gap-4" noValidate>
      <h2 className="text-xl font-extrabold">Tambah buku ke katalog</h2>
      {error && <Alert>{error}</Alert>}
      <Field label="Judul" name="title" defaultValue={initialTitle} error={errors.title} required />
      <Field
        label="Pengarang"
        name="authors"
        hint="Pisahkan dengan koma bila lebih dari satu"
        error={errors.authors}
        required
      />
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Kategori</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              aria-pressed={categoryId === cat.id}
              onClick={() => setCategoryId(cat.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                categoryId === cat.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface"
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
        {errors.category_id && <p className="mt-1 text-sm text-danger">{errors.category_id}</p>}
      </fieldset>

      <PhotoPicker photos={cover} onChange={setCover} max={1} label="Foto sampul (opsional)" />

      {showMore ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Penerbit" name="publisher" error={errors.publisher} />
          </div>
          <Field label="Tahun" name="year" type="number" inputMode="numeric" error={errors.year} />
          <Field
            label="Total halaman"
            name="total_pages"
            type="number"
            inputMode="numeric"
            error={errors.total_pages}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="self-start text-sm font-bold text-primary"
        >
          + Penerbit, tahun, total halaman (opsional)
        </button>
      )}

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" loading={pending}>
          Simpan buku
        </Button>
      </div>
    </form>
  );
}
