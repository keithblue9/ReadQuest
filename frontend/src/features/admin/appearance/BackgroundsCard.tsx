"use client";

import { useRef, useState } from "react";

import { Alert } from "@/components/ui";
import { Slideshow } from "@/features/ui-config/LoginBackdrop";
import type { UiConfig } from "@/features/ui-config/store";
import { errorMessage } from "@/lib/errors";

import { Card, inputClass, SaveBar, saveSection, uploadUiImage } from "./shared";

const MAX_BACKGROUNDS = 12;

type Draft = UiConfig["login"];

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function BackgroundsCard({ config, onSaved }: { config: UiConfig; onSaved: (c: UiConfig) => void }) {
  const [draft, setDraft] = useState<Draft>(config.login);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const intervalValid = Number.isInteger(draft.interval_seconds) && draft.interval_seconds >= 3 && draft.interval_seconds <= 60;
  const dirty = JSON.stringify(draft) !== JSON.stringify(config.login);
  const update = (fn: (d: Draft) => Draft) => {
    setMessage(null);
    setDraft(fn);
  };

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_BACKGROUNDS - draft.backgrounds.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    setError(room < files.length ? `Maksimal ${MAX_BACKGROUNDS} gambar; sebagian file tidak diunggah.` : null);
    try {
      for (const [i, file] of list.entries()) {
        setProgress(`Mengunggah ${i + 1}/${list.length}…`);
        const image = await uploadUiImage(file, "background");
        update((d) => ({ ...d, backgrounds: [...d.backgrounds, { key: image.key, url: image.url }] }));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = await saveSection("login", {
        background_keys: draft.backgrounds.map((b) => b.key),
        interval_seconds: draft.interval_seconds,
      });
      setDraft(next.login);
      onSaved(next);
      setMessage("Tersimpan ✓");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Background halaman login (desktop)"
      description="Gambar tampil penuh di belakang kotak login pada layar lebar. Lebih dari satu gambar menjadi slideshow. Di HP, halaman login tetap sederhana tanpa background."
    >
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {draft.backgrounds.map((bg, i) => (
              <li key={bg.key} className="group relative overflow-hidden rounded-2xl border border-border bg-surface-muted">
                <img src={bg.url} alt={`Background ${i + 1}`} className="aspect-video w-full object-cover" />
                <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={`Geser gambar ${i + 1} ke kiri`}
                      disabled={i === 0}
                      onClick={() => update((d) => ({ ...d, backgrounds: move(d.backgrounds, i, i - 1) }))}
                      className="grid size-8 place-items-center rounded-lg font-bold hover:bg-surface disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label={`Geser gambar ${i + 1} ke kanan`}
                      disabled={i === draft.backgrounds.length - 1}
                      onClick={() => update((d) => ({ ...d, backgrounds: move(d.backgrounds, i, i + 1) }))}
                      className="grid size-8 place-items-center rounded-lg font-bold hover:bg-surface disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Hapus gambar ${i + 1}`}
                    onClick={() => update((d) => ({ ...d, backgrounds: d.backgrounds.filter((_, j) => j !== i) }))}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-danger hover:bg-danger/10"
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
            {draft.backgrounds.length < MAX_BACKGROUNDS && (
              <li>
                <button
                  type="button"
                  disabled={progress !== null}
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-primary/40 text-sm font-bold text-primary hover:bg-primary/5 disabled:opacity-60"
                >
                  <span className="text-2xl" aria-hidden>
                    ＋
                  </span>
                  {progress ?? "Tambah gambar"}
                </button>
              </li>
            )}
          </ol>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <p className="text-xs text-muted">
            Gunakan gambar landscape (mis. 1920×1080). Gambar diperkecil otomatis dan metadata lokasi dibuang. Maksimal{" "}
            {MAX_BACKGROUNDS} gambar.
          </p>

          <label className="flex max-w-xs flex-col gap-1.5 text-sm font-semibold">
            Durasi per gambar (detik)
            <input
              type="number"
              inputMode="numeric"
              min={3}
              max={60}
              className={`${inputClass} tabular-nums ${intervalValid ? "" : "border-danger"}`}
              value={Number.isNaN(draft.interval_seconds) ? "" : draft.interval_seconds}
              onChange={(e) => update((d) => ({ ...d, interval_seconds: e.target.valueAsNumber }))}
            />
            <span className={`text-xs font-normal ${intervalValid ? "text-muted" : "text-danger"}`}>
              Antara 3 dan 60 detik. Berlaku bila ada lebih dari satu gambar.
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Pratinjau desktop</p>
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border">
            <Slideshow
              slides={draft.backgrounds}
              intervalSeconds={intervalValid ? draft.interval_seconds : 6}
              emoji={config.branding.logo_emoji}
            />
            <div className="absolute inset-y-[6%] left-[3%] flex w-[32%] flex-col gap-1.5 rounded-xl bg-background/95 p-2 shadow-xl">
              <div className="h-2 w-2/3 rounded bg-primary/70" />
              <div className="mt-auto h-1.5 w-full rounded bg-border" />
              <div className="h-1.5 w-full rounded bg-border" />
              <div className="mb-auto h-2.5 w-full rounded bg-primary" />
            </div>
          </div>
          <p className="text-xs text-muted">Kotak login berada di sisi kiri agar gambar tetap terlihat.</p>
        </div>
      </div>

      <SaveBar
        dirty={dirty && intervalValid}
        saving={saving}
        onSave={save}
        onReset={() => setDraft(config.login)}
        message={message}
      />
    </Card>
  );
}
