"use client";

import { useRef, useState } from "react";

import { Alert } from "@/components/ui";
import { Logo } from "@/components/Logo";
import type { UiConfig } from "@/features/ui-config/store";
import { errorMessage } from "@/lib/errors";

import { Card, inputClass, SaveBar, saveSection, uploadUiImage } from "./shared";

const EMOJI_CHOICES = ["📚", "📖", "📘", "🔖", "🦉", "🚀", "⭐", "✨", "🌱", "🏆"];
// Pilihan warna merek yang kontrasnya aman untuk teks putih di tombol.
const COLOR_CHOICES = ["#2563eb", "#1877f2", "#0f766e", "#4f46e5", "#be123c", "#b45309", "#334155"];

type Draft = UiConfig["branding"];

export function BrandingCard({ config, onSaved }: { config: UiConfig; onSaved: (c: UiConfig) => void }) {
  const [draft, setDraft] = useState<Draft>(config.branding);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(config.branding);
  const set = (patch: Partial<Draft>) => {
    setMessage(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { app_name, tagline, logo_emoji, logo_key, primary_color } = draft;
      const next = await saveSection("branding", { app_name, tagline, logo_emoji, logo_key, primary_color });
      setDraft(next.branding);
      onSaved(next);
      setMessage("Tersimpan ✓");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const image = await uploadUiImage(file, "logo");
      set({ logo_key: image.key, logo_url: image.url });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card title="Branding" description="Nama aplikasi, slogan di bawah nama, dan ikon/logo. Tampil di semua halaman.">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Nama aplikasi
            <input
              className={inputClass}
              value={draft.app_name}
              maxLength={40}
              onChange={(e) => set({ app_name: e.target.value })}
            />
            <span className="text-xs font-normal text-muted">
              Kata terakhir (atau bagian berhuruf kapital, mis. Read<b>Quest</b>) diberi warna aksen.
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Slogan / jargon
            <input
              className={inputClass}
              value={draft.tagline}
              maxLength={120}
              placeholder="mis. Baca 15 menit sehari, tumbuh bersama"
              onChange={(e) => set({ tagline: e.target.value })}
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Ikon (emoji)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Ikon emoji"
                className={`${inputClass} w-20 text-center text-xl`}
                value={draft.logo_emoji}
                maxLength={16}
                onChange={(e) => set({ logo_emoji: e.target.value })}
              />
              {EMOJI_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Pakai ${emoji}`}
                  onClick={() => set({ logo_emoji: emoji })}
                  className={`grid size-10 place-items-center rounded-xl border text-xl transition ${
                    draft.logo_emoji === emoji ? "border-primary bg-primary/10" : "border-border hover:bg-surface-muted"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Warna merek</span>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_CHOICES.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Pakai warna ${color}`}
                  aria-pressed={draft.primary_color === color}
                  onClick={() => set({ primary_color: color })}
                  className={`size-9 rounded-full border-2 transition ${
                    draft.primary_color === color ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ background: color }}
                />
              ))}
              <input
                type="color"
                aria-label="Warna merek kustom"
                value={draft.primary_color}
                onChange={(e) => set({ primary_color: e.target.value })}
                className="size-9 cursor-pointer rounded-full border border-border bg-surface"
              />
              <code className="text-xs text-muted">{draft.primary_color}</code>
            </div>
            <span className="text-xs font-normal text-muted">
              Dipakai untuk tombol, menu aktif, dan tautan. Pilih warna gelap agar teks putih tetap terbaca.
            </span>
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Logo gambar (opsional, menggantikan emoji)</span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onLogo(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="h-10 rounded-xl border border-border px-4 font-bold hover:bg-surface-muted disabled:opacity-60"
              >
                {uploading ? "Mengunggah…" : draft.logo_key ? "Ganti logo" : "Unggah logo"}
              </button>
              {draft.logo_key && (
                <button
                  type="button"
                  onClick={() => set({ logo_key: null, logo_url: null })}
                  className="text-sm font-bold text-danger"
                >
                  Hapus logo
                </button>
              )}
            </div>
            <span className="text-xs font-normal text-muted">PNG transparan atau JPG persegi, idealnya 512×512 px.</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Pratinjau</p>
          <div className="rounded-2xl border border-border bg-background p-4">
            <Logo tagline preview={draft} />
          </div>
          <div className="dark rounded-2xl border border-border bg-background p-4 text-foreground">
            <Logo tagline preview={draft} />
          </div>
        </div>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onReset={() => setDraft(config.branding)}
        message={message}
      />
    </Card>
  );
}
