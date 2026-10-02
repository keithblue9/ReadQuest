import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-6xl" aria-hidden>
        📕
      </span>
      <h1 className="text-2xl font-extrabold">Halaman tidak ditemukan</h1>
      <p className="text-muted">Sepertinya halaman ini sudah dipindah atau belum pernah ditulis.</p>
      <Link
        href="/"
        className="inline-flex h-12 items-center rounded-2xl bg-primary px-8 font-bold text-primary-foreground shadow-lg shadow-primary/25"
      >
        Kembali ke beranda
      </Link>
    </main>
  );
}
