"use client";

import { OfflineScreen } from "@/components/OfflineScreen";

/** Fallback service worker untuk navigasi saat offline (di-precache oleh `public/sw.js`). */
export default function OfflinePage() {
  return <OfflineScreen onRetry={() => window.location.reload()} />;
}
