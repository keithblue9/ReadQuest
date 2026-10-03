"use client";

import { useEffect, useState } from "react";

import { PhotoPicker } from "@/components/PhotoPicker";
import { Alert, Button } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type {
  FinishResult,
  NoteType,
  ReadingSession,
  SessionConfig,
  TakeawayKind,
  UploadedPhoto,
} from "@/lib/types";
import { NOTE_TYPES, noteStats, TAKEAWAY_TEMPLATES } from "@/lib/words";

type Draft = {
  noteType: NoteType;
  takeawayKind: TakeawayKind;
  content: string;
  pastedChars: number;
  photos: UploadedPhoto[];
  currentPage: string;
  totalPages: string;
  rating: number | null;
  finished: boolean;
};

const draftKey = (sessionId: string) => `rq-note-draft-${sessionId}`;

function loadDraft(sessionId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(sessionId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

type Props = {
  session: ReadingSession;
  config: SessionConfig;
  onDone: (result: FinishResult) => void;
  onBack: (tooShort: boolean) => void;
};

export function FinishForm({ session, config, onDone, onBack }: Props) {
  const [draft, setDraft] = useState<Draft>(
    () =>
      loadDraft(session.id) ?? {
        // Sesi kilat → Takeaway 1 menit (satu kalimat), sesi standar → Quick Note.
        noteType: session.mode === "micro" ? "takeaway" : "quick_note",
        takeawayKind: "insight",
        content: "",
        pastedChars: 0,
        photos: [],
        currentPage: "",
        totalPages: "",
        rating: null,
        finished: false,
      },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(session.id), JSON.stringify(draft));
    } catch {
      // penyimpanan penuh/diblokir: draf hanya di memori
    }
  }, [draft, session.id]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const minWords = config.note_min_words[draft.noteType] ?? 8;
  const isTakeaway = draft.noteType === "takeaway";
  const photoOk = isTakeaway || draft.photos.length > 0;
  const { wordCount, uniqueRatio } = noteStats(draft.content);
  const pasteRatio = draft.content.trim() ? draft.pastedChars / draft.content.trim().length : 0;
  const lowUnique = wordCount >= 10 && uniqueRatio < config.note_min_unique_ratio;
  const tooMuchPaste = pasteRatio > config.note_max_paste_ratio;
  const ready = wordCount >= minWords && !lowUnique && !tooMuchPaste && photoOk;

  async function submit() {
    setPending(true);
    setError(null);
    const num = (v: string) => (v.trim() ? Number(v) : null);
    try {
      const result = await api<FinishResult>(`/sessions/${session.id}/finish`, {
        method: "POST",
        json: {
          note_type: draft.noteType,
          takeaway_kind: isTakeaway ? draft.takeawayKind : null,
          content: draft.content,
          image_keys: draft.photos.map((p) => p.key),
          rating: draft.rating,
          current_page: num(draft.currentPage),
          total_pages: num(draft.totalPages),
          is_book_finished: draft.finished,
          pasted_chars: draft.pastedChars,
        },
      });
      try {
        localStorage.removeItem(draftKey(session.id));
      } catch {
        // abaikan
      }
      onDone(result);
    } catch (err) {
      if (err instanceof ApiError && err.code === "session_too_short") {
        onBack(true);
        return;
      }
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="animate-pop-in flex flex-col gap-5 pb-6">
      <div>
        <h1 className="text-2xl font-bold">{isTakeaway ? "Takeaway 1 menit" : "Tulis catatan bacamu"}</h1>
        <p className="mt-1 text-muted">
          <span className="font-semibold text-foreground">{session.book.title}</span> — ceritakan
          dengan kata-katamu sendiri.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Jenis catatan</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NOTE_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              aria-pressed={draft.noteType === type.value}
              onClick={() => update({ noteType: type.value })}
              className={`rounded-2xl border p-2.5 text-center transition active:scale-95 ${
                draft.noteType === type.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface"
              }`}
            >
              <span className="block text-lg" aria-hidden>
                {type.emoji}
              </span>
              <span className="block text-xs font-bold">{type.label}</span>
              <span className="block text-[11px] opacity-80">
                ≥{config.note_min_words[type.value] ?? 8} kata
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {isTakeaway && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Template takeaway">
          {TAKEAWAY_TEMPLATES.map((tpl) => (
            <button
              key={tpl.kind}
              type="button"
              aria-pressed={draft.takeawayKind === tpl.kind}
              onClick={() => {
                const others = TAKEAWAY_TEMPLATES.map((x) => x.prefix);
                const body = others.reduce((text, prefix) => (text.startsWith(prefix) ? text.slice(prefix.length) : text), draft.content);
                update({ takeawayKind: tpl.kind, content: tpl.prefix + body });
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                draft.takeawayKind === tpl.kind ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted"
              }`}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note-content" className="text-sm font-semibold">
          {isTakeaway ? "Satu kalimat inti" : "Catatan"}
        </label>
        <textarea
          id="note-content"
          value={draft.content}
          onChange={(e) => update({ content: e.target.value })}
          onPaste={(e) =>
            update({ pastedChars: draft.pastedChars + e.clipboardData.getData("text").length })
          }
          rows={isTakeaway ? 3 : 8}
          placeholder={
            isTakeaway
              ? TAKEAWAY_TEMPLATES.find((x) => x.kind === draft.takeawayKind)?.placeholder
              : "Apa ide paling menarik dari bacaan hari ini? Gunakan #tag untuk topik."
          }
          className="rounded-2xl border border-border bg-surface p-4 leading-relaxed outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
        <div className="flex items-center justify-between text-sm">
          <span
            className={`font-bold ${wordCount >= minWords ? "text-success" : "text-muted"}`}
            aria-live="polite"
          >
            {wordCount}/{minWords} kata
          </span>
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-border" aria-hidden>
            <span
              className={`block h-full rounded-full transition-all ${
                wordCount >= minWords ? "bg-success" : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, (wordCount / minWords) * 100)}%` }}
            />
          </span>
        </div>
        {lowUnique && (
          <p className="text-sm text-danger">Terlalu banyak kata yang diulang. Variasikan ceritamu.</p>
        )}
        {tooMuchPaste && (
          <p className="text-sm text-danger">
            Sebagian besar teks ditempel dari tempat lain. Tulis dengan kata-katamu sendiri.
          </p>
        )}
      </div>

      <PhotoPicker
        photos={draft.photos}
        onChange={(photos) => update({ photos })}
        label={isTakeaway ? "Foto buku / halaman (opsional)" : "Foto buku / halaman (wajib)"}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Halaman sekarang
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={draft.currentPage}
            onChange={(e) => update({ currentPage: e.target.value })}
            className="h-12 rounded-2xl border border-border bg-surface px-4 font-normal outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Total halaman
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.totalPages}
            onChange={(e) => update({ totalPages: e.target.value })}
            className="h-12 rounded-2xl border border-border bg-surface px-4 font-normal outline-none focus:border-primary"
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Rating (opsional)</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} bintang`}
              aria-pressed={draft.rating === star}
              onClick={() => update({ rating: draft.rating === star ? null : star })}
              className={`text-3xl transition active:scale-90 ${
                draft.rating && star <= draft.rating ? "text-accent" : "text-border"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 font-semibold">
        <input
          type="checkbox"
          checked={draft.finished}
          onChange={(e) => update({ finished: e.target.checked })}
          className="size-5 accent-[var(--primary)]"
        />
        Saya sudah menyelesaikan buku ini 🎉
      </label>

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Button variant="ghost" onClick={() => onBack(false)}>
          Lanjut baca
        </Button>
        <Button onClick={submit} loading={pending} disabled={!ready}>
          Kirim catatan
        </Button>
      </div>
      {!ready && !pending && (
        <p className="-mt-2 text-center text-xs text-muted">
          {!photoOk
            ? "Tambahkan minimal 1 foto buku."
            : `Lengkapi catatan minimal ${minWords} kata.`}
        </p>
      )}
    </div>
  );
}
