"use client";

import { useRef, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

/** Tombol + dialog untuk melaporkan konten ke antrean moderasi Admin. */
export function ReportButton({ path, what, className = "" }: { path: string; what: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    try {
      await api(path, { method: "POST", json: { reason: reason.trim() } });
      setState("done");
      dialog.current?.close();
    } catch (err) {
      setError(errorMessage(err));
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span role="status" className={className}>
        Dilaporkan ✓
      </span>
    );
  }

  return (
    <>
      <button type="button" className={`hover:text-danger ${className}`} onClick={() => dialog.current?.showModal()}>
        🚩 Laporkan
      </button>
      <dialog
        ref={dialog}
        aria-label={`Laporkan ${what}`}
        className="m-auto w-[min(92vw,24rem)] rounded-3xl border border-border bg-surface p-5 text-foreground backdrop:bg-black/50"
      >
        <form onSubmit={submit} className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold">Laporkan {what}</h2>
          <p className="text-sm text-muted">
            Admin akan meninjau laporanmu. Namamu tidak ditampilkan kepada penulis.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Alasan
            <textarea
              required
              minLength={3}
              maxLength={300}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mis. spam, tidak pantas, bukan catatan bacaan"
              className="rounded-xl border border-border bg-surface px-3 py-2 font-normal outline-none focus:border-primary"
            />
          </label>
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" className="h-10 w-auto px-4" onClick={() => dialog.current?.close()}>
              Batal
            </Button>
            <Button type="submit" className="h-10 w-auto px-5" loading={state === "sending"} disabled={reason.trim().length < 3}>
              Kirim laporan
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
