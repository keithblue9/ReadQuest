"use client";

import { useMemo } from "react";

import { BookCover } from "@/components/BookCover";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { CheerToasts } from "@/features/room/CheerToasts";
import { useReadingRoom } from "@/features/room/useReadingRoom";
import type { ReadingSession, SessionConfig } from "@/lib/types";

import { TimerRing } from "./TimerRing";
import { useReadingTimer } from "./useReadingTimer";

const PAUSE_MESSAGES = {
  manual: "Sesi dijeda.",
  idle: "Sesi dijeda otomatis karena tidak ada aktivitas.",
  hidden: "Sesi dijeda karena aplikasi ditutup atau layar mati.",
};

type Props = {
  initial: ReadingSession;
  config: SessionConfig;
  onFinish: (session: ReadingSession) => void;
  onAbandon: () => void;
  notice?: string | null;
};

export function ReadingTimer({ initial, config, onFinish, onAbandon, notice }: Props) {
  const timer = useReadingTimer(initial, config);
  const { user } = useAuth();
  const reached = timer.elapsedSeconds >= config.min_seconds;
  // Presence di Reading Room (dibulatkan per menit agar tidak mengirim pesan tiap detik).
  const elapsedMinute = Math.floor(timer.elapsedSeconds / 60) * 60;
  const roomStatus = useMemo(
    () => ({
      reading: timer.running,
      book_title: timer.session.book.title,
      elapsed_seconds: elapsedMinute,
    }),
    [timer.running, timer.session.book.title, elapsedMinute],
  );
  const room = useReadingRoom("global", roomStatus);
  const othersReading = room.members.filter((m) => m.reading && m.user_id !== user?.id).length;

  async function finish() {
    await timer.pause("manual");
    onFinish(timer.session);
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex items-center gap-3 rounded-3xl border border-border bg-surface p-3">
        <BookCover url={timer.session.book.cover_url} title={timer.session.book.title} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-bold">{timer.session.book.title}</p>
          <p className="truncate text-sm text-muted">{timer.session.book.authors.join(", ")}</p>
        </div>
      </div>

      <CheerToasts cheers={room.cheers} myId={user?.id} />
      {othersReading > 0 && (
        <a
          href="/room"
          className="flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-2 text-sm font-semibold text-success"
        >
          <span className="size-2 animate-pulse rounded-full bg-success" aria-hidden />
          {othersReading} rekan sedang membaca bersamamu
        </a>
      )}

      {notice && (
        <p className="rounded-2xl bg-accent/15 px-4 py-3 text-sm font-semibold text-accent">
          {notice}
        </p>
      )}

      <TimerRing
        elapsed={timer.elapsedSeconds}
        target={config.min_seconds}
        running={timer.running}
      />

      {timer.pauseReason && (
        <p className="text-center text-sm font-semibold text-muted" role="status">
          {PAUSE_MESSAGES[timer.pauseReason]}
        </p>
      )}
      {timer.syncError && (
        <p className="text-center text-sm text-danger" role="status">
          Koneksi terputus — waktu baca belum tersimpan. Mencoba lagi…
        </p>
      )}

      <div className="flex flex-col gap-3">
        {timer.running ? (
          <Button variant="ghost" onClick={() => timer.pause("manual")}>
            ⏸️ Jeda
          </Button>
        ) : (
          <Button onClick={() => timer.resume()}>▶️ Lanjutkan membaca</Button>
        )}
        <Button onClick={finish} disabled={!reached} variant={reached ? "primary" : "ghost"}>
          {reached ? "✅ Selesai & tulis catatan" : "Selesai (minimal 15 menit)"}
        </Button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Batalkan sesi ini? Waktu baca tidak akan dihitung.")) onAbandon();
          }}
          className="text-sm font-semibold text-muted underline-offset-4 hover:underline"
        >
          Batalkan sesi
        </button>
      </div>

      <p className="text-center text-xs text-muted">
        Biarkan layar tetap menyala. Timer berhenti otomatis saat aplikasi ditutup.
      </p>

      {timer.presencePromptSeconds !== null && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="presence-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
        >
          <div className="animate-pop-in w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-2xl">
            <p className="text-4xl" aria-hidden>
              📖
            </p>
            <h2 id="presence-title" className="mt-2 text-xl font-extrabold">
              Masih membaca?
            </h2>
            <p className="mt-1 text-sm text-muted">
              Timer dijeda otomatis dalam {timer.presencePromptSeconds} detik.
            </p>
            <Button className="mt-5" onClick={timer.confirmPresence} autoFocus>
              Ya, masih membaca
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
