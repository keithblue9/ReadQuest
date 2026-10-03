"use client";

import { useMemo, useState } from "react";

import { Alert } from "@/components/ui";
import type { UiConfig } from "@/features/ui-config/store";
import { errorMessage } from "@/lib/errors";
import { DEFAULT_TEXTS, TEXT_GROUP_LABELS, textGroup } from "@/lib/texts";

import { Card, inputClass, SaveBar, saveSection } from "./shared";

const ENTRIES = Object.entries(DEFAULT_TEXTS) as [string, string][];
const GROUPS = [...new Set(ENTRIES.map(([key]) => textGroup(key)))];

export function TextsCard({ config, onSaved }: { config: UiConfig; onSaved: (c: UiConfig) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(config.texts);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(config.texts);
  const changedCount = ENTRIES.filter(([key]) => key in draft).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ENTRIES.filter(([key, fallback]) => {
      if (group && textGroup(key) !== group) return false;
      if (onlyChanged && !(key in draft)) return false;
      if (!q) return true;
      return [key, fallback, draft[key] ?? ""].some((s) => s.toLowerCase().includes(q));
    });
  }, [query, group, onlyChanged, draft]);

  function setText(key: string, value: string) {
    setMessage(null);
    setDraft((d) => {
      const next = { ...d };
      // Sama dengan default = tidak perlu disimpan sebagai override.
      if (value === DEFAULT_TEXTS[key as keyof typeof DEFAULT_TEXTS]) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function reset(key: string) {
    setMessage(null);
    setDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = await saveSection("texts", draft);
      setDraft(next.texts);
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
      title="Teks & label"
      description="Ganti judul, label, tombol, dan pesan yang tampil di aplikasi. Kosongkan pencarian untuk melihat semuanya."
    >
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-col gap-3">
        <input
          type="search"
          placeholder="Cari teks atau kunci…"
          aria-label="Cari teks"
          className={inputClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {[null, ...GROUPS].map((g) => (
            <button
              key={g ?? "all"}
              type="button"
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                group === g ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted hover:text-foreground"
              }`}
            >
              {g ? (TEXT_GROUP_LABELS[g] ?? g) : "Semua"}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
            Hanya yang diubah ({changedCount})
          </label>
        </div>
        <p className="text-xs text-muted">
          Placeholder seperti <code>{"{app}"}</code> (nama aplikasi), <code>{"{tagline}"}</code>, dan{" "}
          <code>{"{year}"}</code> diisi otomatis.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
        {visible.map(([key, fallback]) => {
          const changed = key in draft;
          const value = draft[key] ?? fallback;
          const long = fallback.length > 60;
          return (
            <li key={key} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex items-center gap-2">
                <code className="truncate text-xs text-muted">{key}</code>
                {changed && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">Diubah</span>
                )}
                {changed && (
                  <button
                    type="button"
                    onClick={() => reset(key)}
                    className="ml-auto text-xs font-bold text-primary"
                  >
                    Kembalikan default
                  </button>
                )}
              </div>
              {long ? (
                <textarea
                  aria-label={key}
                  rows={2}
                  maxLength={500}
                  className={inputClass}
                  value={value}
                  onChange={(e) => setText(key, e.target.value)}
                />
              ) : (
                <input
                  aria-label={key}
                  maxLength={500}
                  className={inputClass}
                  value={value}
                  onChange={(e) => setText(key, e.target.value)}
                />
              )}
              {changed && <p className="text-xs text-muted">Default: {fallback}</p>}
            </li>
          );
        })}
        {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Tidak ada teks yang cocok.</li>}
      </ul>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => setDraft(config.texts)} message={message} />
    </Card>
  );
}
