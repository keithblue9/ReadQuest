"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { timeAgo } from "@/components/PostCard";
import { Button } from "@/components/ui";
import { notifyNotificationsChanged } from "@/features/notifications/NotificationBell";
import { api } from "@/lib/api";
import type { AppNotification, NotificationPage } from "@/lib/types";

const ICONS: Record<string, string> = {
  reading_reminder: "📖",
  streak_at_risk: "🔥",
  reaction: "✨",
  comment: "💬",
  reply: "↩️",
  mention: "📣",
  weekly_leaderboard: "🏆",
  new_quest: "🎯",
  quest_completed: "🎯",
  observer_nudge: "🌱",
  badge_awarded: "🏅",
  buddy_request: "🤝",
  buddy_accepted: "🤝",
  buddy_cheer: "📣",
};

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api<NotificationPage>("/notifications?limit=20")
      .then((page) => {
        setItems(page.items);
        setUnread(page.unread_count);
        setCursor(page.next_cursor);
      })
      .catch(() => setItems([]));
  }, []);

  async function markAll() {
    const result = await api<{ unread_count: number }>("/notifications/read", {
      method: "POST",
      json: { all: true },
    });
    setUnread(result.unread_count);
    setItems((current) => (current ?? []).map((n) => ({ ...n, read: true })));
    notifyNotificationsChanged();
  }

  async function open(n: AppNotification) {
    if (!n.read) {
      api("/notifications/read", { method: "POST", json: { ids: [n.id] } })
        .then(notifyNotificationsChanged)
        .catch(() => undefined);
    }
    router.push(n.url ?? "/");
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api<NotificationPage>(`/notifications?limit=20&cursor=${cursor}`);
      setItems((current) => [...(current ?? []), ...page.items]);
      setCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifikasi 🔔</h1>
          <p className="mt-1 text-sm text-muted">{unread} belum dibaca</p>
        </div>
        <div className="flex items-center gap-3 text-sm font-bold">
          {unread > 0 && (
            <button type="button" onClick={markAll} className="text-primary">
              Tandai semua dibaca
            </button>
          )}
          <Link href="/settings/notifications" aria-label="Pengaturan notifikasi" className="text-xl">
            ⚙️
          </Link>
        </div>
      </div>

      {items === null ? (
        <p className="text-sm text-muted">Memuat…</p>
      ) : items.length === 0 ? (
        <div className="rounded-3xl bg-surface-muted p-6 text-center">
          <p className="text-3xl" aria-hidden>
            📭
          </p>
          <p className="mt-2 font-semibold">Belum ada notifikasi.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                  n.read ? "border-border bg-surface" : "border-primary/40 bg-primary/5"
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-xl" aria-hidden>
                  {ICONS[n.type] ?? "🔔"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{n.title}</span>
                  {n.body && <span className="line-clamp-2 block text-sm text-muted">{n.body}</span>}
                  <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.updated_at)}</span>
                </span>
                {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Belum dibaca" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <Button variant="ghost" loading={loadingMore} onClick={loadMore}>
          Muat lebih banyak
        </Button>
      )}
    </div>
  );
}
