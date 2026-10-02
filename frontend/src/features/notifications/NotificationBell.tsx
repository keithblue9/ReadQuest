"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

const POLL_MS = 60_000;
export const NOTIFICATIONS_CHANGED = "rq:notifications-changed";

/** Beri tahu lonceng bahwa status baca berubah (mis. setelah "tandai dibaca"). */
export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

export function NotificationBell() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api<{ unread_count: number }>("/notifications/unread-count")
        .then((r) => !cancelled && setCount(r.unread_count))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
    };
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      aria-label={count ? `Notifikasi, ${count} belum dibaca` : "Notifikasi"}
      className="relative grid size-10 place-items-center rounded-full border border-border bg-surface text-lg transition hover:scale-105"
    >
      <span aria-hidden>🔔</span>
      {count > 0 && (
        <span className="animate-pop-in absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-extrabold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
