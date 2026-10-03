"use client";

import Link from "next/link";

import { Avatar } from "@/components/PostCard";
import { useAuth } from "@/features/auth/AuthProvider";
import { CheerToasts } from "@/features/room/CheerToasts";
import { CHEER_EMOJIS, useReadingRoom } from "@/features/room/useReadingRoom";

export default function RoomPage() {
  const { user } = useAuth();
  const { members, cheers, connected, cheer } = useReadingRoom("global");
  const readers = members.filter((m) => m.reading);
  const others = members.filter((m) => !m.reading);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <CheerToasts cheers={cheers} myId={user?.id} />
      <div>
        <h1 className="text-2xl font-bold">Reading Room 🛋️</h1>
        <p className="mt-1 text-muted">Membaca bersama secara live. Semangati rekan yang sedang membaca!</p>
      </div>

      <p className="flex items-center gap-2 text-sm font-semibold" role="status">
        <span
          className={`size-2.5 rounded-full ${connected ? "animate-pulse bg-success" : "bg-border"}`}
          aria-hidden
        />
        {connected ? `${readers.length} sedang membaca · ${members.length} di ruangan` : "Menyambungkan…"}
      </p>

      <Link
        href="/read"
        className="flex h-12 items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/25"
      >
        ▶️ Ikut membaca sekarang
      </Link>

      <ul className="flex flex-col gap-2">
        {readers.map((m) => (
          <li key={m.user_id} className="animate-pop-in rounded-2xl border-2 border-success/40 bg-success/5 p-3">
            <div className="flex items-center gap-3">
              <Avatar name={m.name} url={m.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {m.name}
                  {m.user_id === user?.id && <span className="text-muted"> (kamu)</span>}
                </p>
                <p className="truncate text-sm text-muted">📖 {m.book_title ?? "Sedang membaca"}</p>
              </div>
            </div>
            {m.user_id !== user?.id && (
              <div className="mt-2 flex gap-1.5" role="group" aria-label={`Semangati ${m.name}`}>
                {CHEER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => cheer(emoji, m.user_id)}
                    className="grid size-9 place-items-center rounded-full bg-surface text-lg transition active:scale-90"
                    aria-label={`Kirim ${emoji} ke ${m.name}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
        {others.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
            <Avatar name={m.name} url={m.avatar_url} />
            <p className="flex-1 truncate font-semibold">
              {m.name}
              {m.user_id === user?.id && <span className="text-muted"> (kamu)</span>}
            </p>
            <span className="text-xs text-muted">menonton</span>
          </li>
        ))}
      </ul>
      {connected && readers.length === 0 && (
        <p className="rounded-2xl bg-surface-muted p-4 text-center text-sm text-muted">
          Belum ada yang membaca. Mulai sesi dan ajak rekanmu! 📚
        </p>
      )}
    </div>
  );
}
