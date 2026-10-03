"use client";

import { useCallback, useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { Alert, Button } from "@/components/ui";
import { ResourceManager } from "@/features/admin/ResourceManager";
import { useLookups } from "@/features/admin/lookups";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/errors";
import type { Book, BookOfMonth } from "@/lib/types";

type BookForm = {
  id: string;
  title: string;
  authors: string;
  category_id: string;
  publisher: string;
  year: string;
  total_pages: string;
  isbn: string;
};

const toForm = (b: Book): BookForm => ({
  id: b.id,
  title: b.title,
  authors: b.authors.join(", "),
  category_id: b.category?.id ?? "",
  publisher: b.publisher ?? "",
  year: b.year ? String(b.year) : "",
  total_pages: b.total_pages ? String(b.total_pages) : "",
  isbn: b.isbn ?? "",
});

const input = "w-full rounded-xl border bg-surface px-3 py-2 outline-none focus:border-primary";

export default function AdminCatalogPage() {
  const { lookups, reload } = useLookups();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<Book[] | null>(null);
  const [bom, setBom] = useState<BookOfMonth | null>(null);
  const [form, setForm] = useState<BookForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const search = useCallback((q: string) => {
    const params = new URLSearchParams({ limit: "20" });
    if (q.trim()) params.set("q", q.trim());
    return api<Book[]>(`/books?${params}`)
      .then(setBooks)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    api<BookOfMonth>("/book-of-the-month")
      .then(setBom)
      .catch(() => undefined);
  }, []);

  async function saveBook() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      await api(`/admin/books/${form.id}`, {
        method: "PUT",
        json: {
          title: form.title,
          authors: form.authors.split(",").map((a) => a.trim()).filter(Boolean),
          category_id: form.category_id,
          publisher: form.publisher || null,
          year: form.year ? Number(form.year) : null,
          total_pages: form.total_pages ? Number(form.total_pages) : null,
          isbn: form.isbn || null,
        },
      });
      setForm(null);
      await search(query);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function pickBookOfMonth(book: Book) {
    if (!window.confirm(`Jadikan "${book.title}" Book of the Month?`)) return;
    setError(null);
    try {
      setBom(await api<BookOfMonth>(`/book-of-the-month/${book.id}`, { method: "PUT" }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const textField = (key: keyof Omit<BookForm, "id" | "category_id">, label: string, type = "text") => (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      <input
        type={type}
        className={`${input} ${errors[key] ? "border-danger" : "border-border"}`}
        value={form?.[key] ?? ""}
        onChange={(e) => form && setForm({ ...form, [key]: e.target.value })}
      />
      {errors[key] && <span className="text-xs text-danger">{errors[key]}</span>}
    </label>
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold">Book of the Month</h2>
          <p className="text-sm text-muted">
            Default dipilih otomatis (buku dengan pembaca terbanyak bulan ini). Pilih manual dari daftar buku di bawah.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          {bom?.book ? (
            <>
              <BookCover url={bom.book.cover_url} title={bom.book.title} size="sm" />
              <div className="min-w-0">
                <p className="font-bold">{bom.book.title}</p>
                <p className="text-xs text-muted">
                  {bom.month} · {bom.auto ? "dipilih otomatis" : "dipilih Admin"} · {bom.readers_this_month} pembaca bulan ini
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Belum ada Book of the Month.</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold">Katalog Buku</h2>
          <p className="text-sm text-muted">Perbaiki judul/pengarang/kategori. Info buku di posting ikut diperbarui.</p>
        </div>
        <input
          type="search"
          className={`${input} border-border`}
          placeholder="Cari judul atau pengarang…"
          aria-label="Cari buku"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {error && <Alert>{error}</Alert>}

        {form && lookups && (
          <div className="animate-pop-in grid gap-3 rounded-2xl border-2 border-primary/40 bg-surface p-4 sm:grid-cols-2">
            {textField("title", "Judul")}
            {textField("authors", "Pengarang (pisahkan dengan koma)")}
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Kategori
              <select
                className={`${input} ${errors.category_id ? "border-danger" : "border-border"}`}
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                {lookups.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
            {textField("publisher", "Penerbit")}
            {textField("year", "Tahun terbit", "number")}
            {textField("total_pages", "Total halaman", "number")}
            {textField("isbn", "ISBN")}
            <div className="flex gap-2 sm:col-span-2">
              <Button variant="ghost" className="h-10 w-auto px-4" onClick={() => setForm(null)}>
                Batal
              </Button>
              <Button className="h-10 w-auto px-6" loading={saving} onClick={saveBook}>
                Simpan
              </Button>
            </div>
          </div>
        )}

        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {books === null && <li className="px-4 py-6 text-sm text-muted">Memuat…</li>}
          {books?.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Buku tidak ditemukan.</li>}
          {books?.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <BookCover url={b.cover_url} title={b.title} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{b.title}</p>
                <p className="truncate text-xs text-muted">
                  {b.authors.join(", ")} · {b.category?.name ?? "Tanpa kategori"} · {b.stats.readers_count} pembaca
                </p>
              </div>
              {bom?.book?.id !== b.id && (
                <button type="button" className="shrink-0 text-sm font-bold text-muted hover:text-primary" title="Jadikan Book of the Month" onClick={() => pickBookOfMonth(b)}>
                  ⭐ BotM
                </button>
              )}
              <button
                type="button"
                className="text-sm font-bold text-primary"
                onClick={() => {
                  setErrors({});
                  setForm(toForm(b));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Ubah
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ResourceManager
        resource="book-categories"
        title="Kategori Buku"
        description="Kategori yang dipakai saat menambah buku dan memilih minat baca. Kategori yang masih dipakai tidak bisa dihapus."
        fields={[
          { name: "name", label: "Nama" },
          { name: "code", label: "Kode", lockedOnEdit: true },
          { name: "icon", label: "Ikon (emoji)" },
          { name: "sort_order", label: "Urutan", type: "number" },
          { name: "is_active", label: "Aktif", type: "toggle" },
        ]}
        defaults={{ name: "", code: "", icon: "📘", sort_order: 0, is_active: true }}
        onChanged={reload}
        summary={(item) => (
          <p className="font-bold">
            <span aria-hidden className="mr-2">
              {String(item.icon ?? "📘")}
            </span>
            {String(item.name)}
            {item.is_active === false && <span className="ml-2 text-xs font-semibold text-muted">(nonaktif)</span>}
          </p>
        )}
      />
    </div>
  );
}
