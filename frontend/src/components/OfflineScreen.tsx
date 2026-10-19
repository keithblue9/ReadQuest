"use client";

import { WifiOff } from "lucide-react";

import { useUiConfig } from "@/features/ui-config/store";

import { Button } from "./ui";

/** Layar penuh saat aplikasi dibuka tanpa koneksi (sesi belum bisa dipulihkan). */
export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  const appName = useUiConfig().branding.app_name;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-surface-muted" aria-hidden>
        <WifiOff className="size-8" />
      </span>
      <h1 className="text-[26px] leading-tight">Kamu sedang offline</h1>
      <p className="text-muted">
        {appName} butuh koneksi untuk memuat feed dan mencatat sesi baca. Kami akan mencoba lagi
        otomatis begitu koneksi kembali.
      </p>
      <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm">
        Sambil menunggu, lanjutkan membaca buku fisikmu
      </p>
      <Button className="w-auto px-8" onClick={onRetry}>
        Coba lagi
      </Button>
    </main>
  );
}

/** Penanda kecil saat koneksi putus di tengah pemakaian. */
export function OfflineBanner() {
  return (
    <div
      role="status"
      className="animate-pop-in fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-50 mx-auto w-fit max-w-[92vw] flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-center text-sm font-semibold text-paper shadow-lg"
    >
      <WifiOff className="size-4" aria-hidden /> Offline — perubahan belum tersimpan sampai koneksi kembali
    </div>
  );
}
