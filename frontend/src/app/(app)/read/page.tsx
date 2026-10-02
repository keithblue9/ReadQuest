"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { BookCover } from "@/components/BookCover";
import { Alert, Button, FullScreenSpinner } from "@/components/ui";
import { AddBookForm } from "@/features/books/AddBookForm";
import { BookSearch } from "@/features/books/BookSearch";
import { FinishCelebration } from "@/features/reading/FinishCelebration";
import { FinishForm } from "@/features/reading/FinishForm";
import { ReadingTimer } from "@/features/reading/ReadingTimer";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Book, FinishResult, ReadingSession, SessionConfig, Today } from "@/lib/types";

type View =
  | { kind: "pick" }
  | { kind: "add"; title: string }
  | { kind: "confirm"; book: Book }
  | { kind: "timer"; session: ReadingSession; notice?: string }
  | { kind: "finish"; session: ReadingSession }
  | { kind: "done"; result: FinishResult };

function ReadFlow() {
  const params = useSearchParams();
  const bookParam = params.get("book");

  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    Promise.all([api<SessionConfig>("/sessions/config"), api<Today>("/sessions/today")])
      .then(async ([cfg, td]) => {
        setConfig(cfg);
        setToday(td);
        if (td.active_session) {
          setView({ kind: "timer", session: td.active_session });
        } else if (bookParam) {
          const book = await api<Book>(`/books/${bookParam}`).catch(() => null);
          setView(book ? { kind: "confirm", book } : { kind: "pick" });
        } else {
          setView({ kind: "pick" });
        }
      })
      .catch((err) => setError(errorMessage(err)));
  }, [bookParam]);

  async function start(book: Book) {
    setPending(true);
    setError(null);
    try {
      const session = await api<ReadingSession>("/sessions", {
        method: "POST",
        json: { book_id: book.id },
      });
      setView({ kind: "timer", session });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function abandon(session: ReadingSession) {
    await api(`/sessions/${session.id}/abandon`, { method: "POST" }).catch(() => undefined);
    setView({ kind: "pick" });
  }

  async function backToTimer(session: ReadingSession, tooShort: boolean) {
    const latest = await api<Today>("/sessions/today").catch(() => null);
    const current = latest?.active_session ?? session;
    setView({
      kind: "timer",
      session: current,
      notice: tooShort ? "Waktu baca belum mencapai 15 menit. Lanjutkan sebentar lagi!" : undefined,
    });
  }

  if (error && !view) {
    return (
      <div className="pt-6">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!config || !view) return <FullScreenSpinner />;

  return (
    <>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {view.kind === "pick" && (
        <div className="animate-pop-in flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">Mau baca buku apa? 📚</h1>
            <p className="mt-1 text-muted">
              {today?.full_points_done
                ? "Sesi poin penuh hari ini sudah tercapai — membaca lagi tetap tercatat!"
                : `Baca minimal ${config.min_seconds / 60} menit untuk sesi poin penuh hari ini.`}
            </p>
          </div>
          <BookSearch
            onSelect={(book) => setView({ kind: "confirm", book })}
            onCreateNew={(title) => setView({ kind: "add", title })}
          />
        </div>
      )}

      {view.kind === "add" && (
        <AddBookForm
          initialTitle={view.title}
          onCreated={(book) => setView({ kind: "confirm", book })}
          onCancel={() => setView({ kind: "pick" })}
        />
      )}

      {view.kind === "confirm" && (
        <div className="animate-pop-in flex flex-col items-center gap-4 pt-4 text-center">
          <BookCover url={view.book.cover_url} title={view.book.title} size="lg" />
          <div>
            <h1 className="text-2xl font-extrabold">{view.book.title}</h1>
            <p className="text-muted">{view.book.authors.join(", ")}</p>
          </div>
          <p className="text-sm text-muted">
            Siapkan bukumu, cari tempat nyaman, lalu mulai timer. Minimal{" "}
            {config.min_seconds / 60} menit ya!
          </p>
          <Button onClick={() => start(view.book)} loading={pending}>
            ▶️ Mulai membaca
          </Button>
          <button
            type="button"
            onClick={() => setView({ kind: "pick" })}
            className="text-sm font-semibold text-muted"
          >
            Ganti buku
          </button>
        </div>
      )}

      {view.kind === "timer" && (
        <ReadingTimer
          key={view.session.id + (view.notice ?? "")}
          initial={view.session}
          config={config}
          notice={view.notice}
          onFinish={(session) => setView({ kind: "finish", session })}
          onAbandon={() => abandon(view.session)}
        />
      )}

      {view.kind === "finish" && (
        <FinishForm
          session={view.session}
          config={config}
          onDone={(result) => setView({ kind: "done", result })}
          onBack={(tooShort) => backToTimer(view.session, tooShort)}
        />
      )}

      {view.kind === "done" && <FinishCelebration result={view.result} />}
    </>
  );
}

export default function ReadPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          aria-label="Kembali ke beranda"
          className="grid size-10 place-items-center rounded-full border border-border bg-surface"
        >
          ←
        </Link>
        <span className="font-extrabold">Sesi Baca</span>
      </header>
      <Suspense fallback={<FullScreenSpinner />}>
        <ReadFlow />
      </Suspense>
    </div>
  );
}
