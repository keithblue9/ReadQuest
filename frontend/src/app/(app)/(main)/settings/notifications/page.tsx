"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { needsIOSInstallGuide } from "@/lib/platform";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";
import type { NotificationPreferences } from "@/lib/types";

const TYPE_LABELS: [string, string][] = [
  ["reading_reminder", "📖 Pengingat baca"],
  ["streak_at_risk", "🔥 Streak terancam"],
  ["reaction", "✨ Reaksi di catatanmu"],
  ["comment", "💬 Komentar & balasan"],
  ["mention", "📣 Mention"],
  ["weekly_leaderboard", "🏆 Leaderboard mingguan"],
  ["new_quest", "🎯 Quest baru"],
  ["quest_completed", "✅ Quest selesai"],
  ["badge_awarded", "🏅 Badge baru"],
  ["buddy", "🤝 Reading Buddy"],
  ["observer_nudge", "🌱 Ajakan berbagi"],
];

const PUSH_TEXT: Record<PushState, string> = {
  on: "Push aktif di perangkat ini.",
  off: "Push belum aktif di perangkat ini.",
  denied: "Izin notifikasi diblokir. Aktifkan lewat pengaturan browser.",
  unsupported: "Browser ini tidak mendukung notifikasi push.",
  "ios-install": "Di iPhone, pasang ReadQuest ke Layar Utama dulu agar push bisa aktif.",
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-primary" : "bg-border"}`}
    >
      <span
        className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`}
      />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [pushState, setPushState] = useState<PushState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<NotificationPreferences>("/me/notification-preferences").then(setPrefs).catch(() => undefined);
    getPushState(needsIOSInstallGuide()).then(setPushState).catch(() => setPushState("unsupported"));
  }, []);

  async function togglePush() {
    setError(null);
    try {
      setPushState(pushState === "on" ? await disablePush() : await enablePush());
    } catch (err) {
      if (err instanceof DOMException) {
        setError(
          err.name === "NotAllowedError"
            ? "Browser menolak pendaftaran push. Periksa izin notifikasi di pengaturan browser."
            : "Browser gagal mengaktifkan push. Coba lagi nanti.",
        );
      } else {
        setError(err instanceof Error ? err.message : errorMessage(err));
      }
    }
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      setPrefs(await api<NotificationPreferences>("/me/notification-preferences", { method: "PUT", json: prefs }));
      setMessage("Pengaturan tersimpan ✅");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const setType = (key: string, channel: "push" | "in_app", value: boolean) =>
    setPrefs((p) => p && { ...p, types: { ...p.types, [key]: { ...p.types[key], [channel]: value } } });

  return (
    <div className="flex flex-col gap-5 pt-2 pb-6">
      <div>
        <Link href="/notifications" className="text-sm font-bold text-primary">
          ← Notifikasi
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold">Pengaturan Notifikasi ⚙️</h1>
      </div>
      {error && <Alert>{error}</Alert>}

      <section className="rounded-3xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-extrabold">Notifikasi push</p>
            <p className="text-sm text-muted">{pushState ? PUSH_TEXT[pushState] : "Memeriksa…"}</p>
          </div>
          {(pushState === "on" || pushState === "off") && (
            <Toggle checked={pushState === "on"} onChange={togglePush} label="Notifikasi push" />
          )}
        </div>
        {pushState === "on" && (
          <button
            type="button"
            className="mt-3 text-sm font-bold text-primary"
            onClick={() =>
              api<{ delivered: number }>("/push/test", { method: "POST" })
                .then((r) => setMessage(r.delivered ? "Notifikasi tes terkirim 🔔" : "Tidak ada perangkat yang menerima."))
                .catch((err) => setError(errorMessage(err)))
            }
          >
            Kirim notifikasi tes
          </button>
        )}
      </section>

      {prefs && (
        <>
          <section className="rounded-3xl border border-border bg-surface">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-border px-4 py-2 text-xs font-bold text-muted">
              <span>Jenis</span>
              <span>Push</span>
              <span>Lonceng</span>
            </div>
            {TYPE_LABELS.map(([key, label]) => (
              <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-2.5">
                <span className="text-sm font-semibold">{label}</span>
                <Toggle checked={prefs.types[key]?.push ?? true} onChange={(v) => setType(key, "push", v)} label={`${label} push`} />
                <Toggle checked={prefs.types[key]?.in_app ?? true} onChange={(v) => setType(key, "in_app", v)} label={`${label} lonceng`} />
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="font-extrabold">🌙 Jam tenang</p>
              <Toggle
                checked={prefs.quiet_hours.enabled}
                onChange={(v) => setPrefs({ ...prefs, quiet_hours: { ...prefs.quiet_hours, enabled: v } })}
                label="Jam tenang"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["start", "end"] as const).map((field) => (
                <label key={field} className="flex flex-col gap-1 text-sm font-semibold">
                  {field === "start" ? "Mulai" : "Selesai"}
                  <input
                    type="time"
                    value={prefs.quiet_hours[field]}
                    onChange={(e) => setPrefs({ ...prefs, quiet_hours: { ...prefs.quiet_hours, [field]: e.target.value } })}
                    className="h-11 rounded-xl border border-border bg-surface px-3 font-normal"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">Push ditahan selama jam tenang dan dikirim setelahnya.</p>
          </section>

          <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              ⏰ Jam pengingat baca
              <input
                type="time"
                value={prefs.reminder_time}
                onChange={(e) => setPrefs({ ...prefs, reminder_time: e.target.value })}
                className="h-11 rounded-xl border border-border bg-surface px-3 font-normal"
              />
            </label>
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">Frekuensi push</legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["realtime", "Langsung"],
                    ["batched", "Per jam"],
                    ["daily_digest", "Ringkasan harian"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={prefs.frequency === value}
                    onClick={() => setPrefs({ ...prefs, frequency: value })}
                    className={`rounded-xl border px-2 py-2 text-sm font-bold ${
                      prefs.frequency === value ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {prefs.frequency === "daily_digest" && (
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Jam ringkasan harian
                <input
                  type="time"
                  value={prefs.digest_time}
                  onChange={(e) => setPrefs({ ...prefs, digest_time: e.target.value })}
                  className="h-11 rounded-xl border border-border bg-surface px-3 font-normal"
                />
              </label>
            )}
          </section>

          {message && (
            <p className="animate-pop-in text-center text-sm font-bold text-success" role="status">
              {message}
            </p>
          )}
          <Button onClick={save} loading={saving}>
            Simpan pengaturan
          </Button>
        </>
      )}
    </div>
  );
}
