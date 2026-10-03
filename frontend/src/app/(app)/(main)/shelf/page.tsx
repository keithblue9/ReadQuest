"use client";

import { ShelfView } from "@/features/profile/ShelfView";

export default function ShelfPage() {
  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="text-2xl font-bold">Rak Buku</h1>
        <p className="text-sm text-muted">
          Terisi otomatis saat kamu membaca atau menandai “Mau baca juga”. Rakmu terlihat oleh rekan setim.
        </p>
      </header>
      <ShelfView editable />
    </div>
  );
}
