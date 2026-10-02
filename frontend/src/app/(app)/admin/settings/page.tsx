"use client";

import { useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

type Setting = { key: string; value: unknown; description: string };

const GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "Sesi baca",
    keys: ["session.min_minutes", "session.idle_timeout_seconds", "session.heartbeat_max_gap_seconds"],
  },
  {
    title: "Kualitas catatan & komentar",
    keys: ["note.min_words", "note.min_unique_word_ratio", "note.max_paste_ratio", "comment.meaningful_min_words"],
  },
  { title: "Reading Authenticity Index", keys: ["authenticity.thresholds"] },
  {
    title: "Umum",
    keys: ["team.timezone", "onboarding.default_daily_target_minutes", "leaderboard.cache_seconds", "upload.max_bytes"],
  },
];

const LABELS: Record<string, string> = {
  "session.min_minutes": "Durasi minimal sesi valid (menit)",
  "session.idle_timeout_seconds": "Auto-pause saat idle (detik)",
  "session.heartbeat_max_gap_seconds": "Jeda heartbeat maksimum (detik)",
  "note.min_words": "Minimal kata per jenis catatan",
  "note.min_unique_word_ratio": "Rasio kata unik minimal (0–1)",
  "note.max_paste_ratio": "Rasio teks tempel maksimum (0–1)",
  "comment.meaningful_min_words": "Minimal kata komentar bermakna",
  "authenticity.thresholds": "Threshold Contribution Ratio (0–1)",
  "team.timezone": "Zona waktu tim (IANA)",
  "onboarding.default_daily_target_minutes": "Target harian default (menit)",
  "leaderboard.cache_seconds": "Cache leaderboard (detik)",
  "upload.max_bytes": "Ukuran foto maksimum (byte)",
};

const SUB_LABELS: Record<string, string> = {
  quick_note: "Quick Note",
  chapter_story: "Chapter Story",
  book_review: "Book Review",
  active_reader: "Active Reader ≥",
  warming_up: "Warming Up ≥",
  observer: "Observer ≥",
};

const RATIO_KEYS = new Set(["note.min_unique_word_ratio", "note.max_paste_ratio", "authenticity.thresholds"]);

const input =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 tabular-nums outline-none focus:border-primary";

function SettingRow({ setting, onSaved }: { setting: Setting; onSaved: (s: Setting) => void }) {
  const [value, setValue] = useState<unknown>(setting.value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(setting.value);
  const step = RATIO_KEYS.has(setting.key) ? 0.05 : 1;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Setting>(`/admin/settings/${setting.key}`, { method: "PUT", json: { value } });
      onSaved({ ...setting, value: updated.value });
      setValue(updated.value);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const numberInput = (v: unknown, onChange: (n: number) => void, label: string) => (
    <input
      type="number"
      step={step}
      aria-label={label}
      className={input}
      value={typeof v === "number" ? v : ""}
      onChange={(e) => {
        setSaved(false);
        onChange(e.target.value === "" ? NaN : Number(e.target.value));
      }}
    />
  );

  let editor: React.ReactNode;
  if (typeof setting.value === "number") {
    editor = numberInput(value, setValue, LABELS[setting.key] ?? setting.key);
  } else if (typeof setting.value === "string") {
    editor = (
      <input
        className={input}
        aria-label={LABELS[setting.key] ?? setting.key}
        value={String(value ?? "")}
        onChange={(e) => {
          setSaved(false);
          setValue(e.target.value);
        }}
      />
    );
  } else {
    const obj = (value ?? {}) as Record<string, number>;
    editor = (
      <div className="grid gap-2 sm:grid-cols-3">
        {Object.keys(setting.value as Record<string, number>).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-muted">
            {SUB_LABELS[k] ?? k}
            {numberInput(obj[k], (n) => setValue({ ...obj, [k]: n }), `${LABELS[setting.key]}: ${SUB_LABELS[k] ?? k}`)}
          </label>
        ))}
      </div>
    );
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-4">
      <div>
        <p className="font-bold">{LABELS[setting.key] ?? setting.key}</p>
        {setting.description && <p className="text-xs text-muted">{setting.description}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">{editor}</div>
        <Button className="h-10 w-auto shrink-0 px-5 text-sm" disabled={!dirty} loading={saving} onClick={save}>
          Simpan
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
      {saved && !dirty && (
        <p role="status" className="text-xs font-semibold text-success">
          Tersimpan ✓ — tercatat di audit log
        </p>
      )}
    </li>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Setting[]>("/admin/settings")
      .then(setSettings)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (!settings) return error ? <Alert>{error}</Alert> : <p className="text-sm text-muted">Memuat…</p>;
  const byKey = new Map(settings.map((s) => [s.key, s]));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold">Pengaturan</h1>
        <p className="text-sm text-muted">Aturan bisnis yang tersimpan di database. Perubahan langsung berlaku.</p>
      </header>
      {GROUPS.map((group) => {
        const rows = group.keys.map((k) => byKey.get(k)).filter((s): s is Setting => Boolean(s));
        if (!rows.length) return null;
        return (
          <section key={group.title} className="flex flex-col gap-2">
            <h2 className="text-lg font-extrabold">{group.title}</h2>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {rows.map((s) => (
                <SettingRow
                  key={s.key}
                  setting={s}
                  onSaved={(next) => setSettings((all) => all?.map((x) => (x.key === next.key ? next : x)) ?? null)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
