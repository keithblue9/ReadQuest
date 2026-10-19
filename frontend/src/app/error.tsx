"use client";

import { CircleAlert } from "lucide-react";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-surface-muted text-ink" aria-hidden>
        <CircleAlert className="size-8" strokeWidth={1.6} />
      </span>
      <h1 className="text-[26px] leading-tight">Ups, ada yang tidak beres</h1>
      <p className="text-muted">Halaman ini gagal dimuat. Coba lagi, atau kembali ke beranda.</p>
      {error.digest && <p className="text-xs text-muted">Kode: {error.digest}</p>}
      <div className="flex gap-2">
        <Button className="w-auto px-6" onClick={() => retry()}>
          Coba lagi
        </Button>
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-2xl border border-border bg-surface px-6 font-bold"
        >
          Beranda
        </Link>
      </div>
    </main>
  );
}
