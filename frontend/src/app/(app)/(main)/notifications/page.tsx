"use client";

import {
  AtSign,
  Award,
  Bell,
  BellOff,
  BookOpen,
  CheckCircle2,
  Flame,
  Handshake,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Reply,
  Settings,
  Sparkles,
  Sprout,
  Target,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { timeAgo } from "@/components/PostCard";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { notifyNotificationsChanged } from "@/features/notifications/NotificationBell";
import { api } from "@/lib/api";
import type { AppNotification, NotificationPage } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  reading_reminder: BookOpen,
  streak_at_risk: Flame,
  reaction: Sparkles,
  comment: MessageCircle,
  reply: Reply,
  mention: AtSign,
  weekly_leaderboard: Trophy,
  new_quest: Target,
  quest_completed: CheckCircle2,
  observer_nudge: Sprout,
  badge_awarded: Award,
  buddy_request: Handshake,
  buddy_accepted: Handshake,
  buddy_cheer: Megaphone,
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
          <h1 className="text-[26px] leading-tight">Notifikasi</h1>
          <p className="mt-1 text-sm text-muted">{unread} belum dibaca</p>
        </div>
        <div className="flex items-center gap-1 text-sm font-semibold">
          {unread > 0 && (
            <button type="button" onClick={markAll} className="min-h-11 rounded-xl px-3 text-ink underline underline-offset-2 hover:bg-surface">
              Tandai semua dibaca
            </button>
          )}
          <Link
            href="/settings/notifications"
            aria-label="Pengaturan notifikasi"
            className="grid size-11 place-items-center rounded-full border border-line bg-surface hover:bg-surface-muted"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
        </div>
      </div>

      {items === null ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Memuat notifikasi">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff className="size-6" />}
          title="Belum ada notifikasi"
          body="Reaksi, komentar, dan pengingat baca akan muncul di sini."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                  n.read ? "border-line bg-surface" : "border-line border-l-highlight bg-surface border-l-[6px] pl-2.5 shadow-[var(--shadow-card)]"
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-ink" aria-hidden>
                  {(() => {
                    const Icon = ICONS[n.type] ?? Bell;
                    return <Icon className="size-5" strokeWidth={1.8} />;
                  })()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</span>
                  {n.body && <span className="line-clamp-2 block text-sm text-muted">{n.body}</span>}
                  <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.updated_at)}</span>
                </span>
                {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-ink dark:bg-highlight" role="img" aria-label="Belum dibaca" />}
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
