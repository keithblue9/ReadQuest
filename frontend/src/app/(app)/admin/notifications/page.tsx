"use client";

import { useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { ResourceManager } from "@/features/admin/ResourceManager";
import { useAuth } from "@/features/auth/AuthProvider";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

const TEMPLATE_INFO: Record<string, { label: string; vars: string[] }> = {
  reading_reminder: { label: "Pengingat baca", vars: ["minutes"] },
  streak_at_risk: { label: "Streak terancam putus", vars: ["streak"] },
  reaction: { label: "Reaksi (digabung)", vars: ["actors", "excerpt"] },
  comment: { label: "Komentar", vars: ["actor", "excerpt"] },
  reply: { label: "Balasan komentar", vars: ["actor", "excerpt"] },
  mention: { label: "Mention", vars: ["actor", "excerpt"] },
  weekly_leaderboard: { label: "Leaderboard mingguan", vars: ["summary"] },
  new_quest: { label: "Quest baru", vars: ["count"] },
  observer_nudge: { label: "Nudge Observer", vars: [] },
  badge_awarded: { label: "Badge baru", vars: ["name", "icon", "description"] },
  quest_completed: { label: "Quest selesai", vars: ["title", "reward"] },
  buddy_request: { label: "Ajakan Reading Buddy", vars: ["actor"] },
  buddy_accepted: { label: "Reading Buddy diterima", vars: ["actor"] },
  buddy_cheer: { label: "Semangat dari buddy", vars: ["actor"] },
};

const WEEKDAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

type Schedule = {
  streak_risk_time: string;
  authenticity_time: string;
  weekly_leaderboard: { weekday: number; time: string };
  new_quest: { weekday: number; time: string };
};

const input = "rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-primary";

function ScheduleForm() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ key: string; value: unknown }[]>("/admin/settings")
      .then((rows) => setSchedule(rows.find((r) => r.key === "notifications.schedule")?.value as Schedule))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api("/admin/settings/notifications.schedule", { method: "PUT", json: { value: schedule } });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!schedule) return error ? <Alert>{error}</Alert> : <p className="text-sm text-muted">Memuat…</p>;

  const weekly = (key: "weekly_leaderboard" | "new_quest", label: string) => (
    <fieldset className="flex flex-col gap-1.5 text-sm font-semibold">
      <legend className="mb-1.5">{label}</legend>
      <div className="flex gap-2">
        <select
          className={`${input} flex-1`}
          aria-label={`${label} — hari`}
          value={schedule[key].weekday}
          onChange={(e) => setSchedule({ ...schedule, [key]: { ...schedule[key], weekday: Number(e.target.value) } })}
        >
          {WEEKDAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="time"
          className={input}
          aria-label={`${label} — jam`}
          value={schedule[key].time}
          onChange={(e) => setSchedule({ ...schedule, [key]: { ...schedule[key], time: e.target.value } })}
        />
      </div>
    </fieldset>
  );

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Peringatan streak terancam (harian)
        <input
          type="time"
          className={input}
          value={schedule.streak_risk_time}
          onChange={(e) => setSchedule({ ...schedule, streak_risk_time: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Hitung Authenticity Index & nudge Observer (harian)
        <input
          type="time"
          className={input}
          value={schedule.authenticity_time}
          onChange={(e) => setSchedule({ ...schedule, authenticity_time: e.target.value })}
        />
      </label>
      {weekly("weekly_leaderboard", "Ringkasan leaderboard mingguan")}
      {weekly("new_quest", "Pengumuman quest baru")}
      <p className="text-xs text-muted sm:col-span-2">
        Jam mengikuti zona waktu tim. Pengingat baca harian memakai jam pilihan tiap pengguna di Pengaturan notifikasi.
      </p>
      {error && (
        <div className="sm:col-span-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button className="h-10 w-auto px-6" loading={saving} onClick={save}>
          Simpan jadwal
        </Button>
        {saved && (
          <span role="status" className="text-sm font-semibold text-success">
            Tersimpan ✓
          </span>
        )}
      </div>
    </div>
  );
}

export default function AdminNotificationsPage() {
  const { user } = useAuth();
  const canSchedule = user?.permissions.includes("config.settings.manage");

  return (
    <div className="flex flex-col gap-10">
      {canSchedule && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-bold">Jadwal Notifikasi</h2>
            <p className="text-sm text-muted">Kapan notifikasi terjadwal dikirim ke seluruh anggota.</p>
          </div>
          <ScheduleForm />
        </section>
      )}

      <ResourceManager
        resource="notification-templates"
        title="Template Notifikasi"
        description="Teks push & lonceng in-app. Variabel dalam {kurung kurawal} diisi otomatis; jangan dihapus bila dibutuhkan."
        fields={[
          { name: "title", label: "Judul" },
          { name: "body", label: "Isi", type: "textarea" },
        ]}
        defaults={{}}
        summary={(item) => {
          const info = TEMPLATE_INFO[String(item.type)];
          return (
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted">{info?.label ?? String(item.type)}</p>
              <p className="truncate font-bold">{String(item.title)}</p>
              <p className="truncate text-sm text-muted">{String(item.body)}</p>
              {info && info.vars.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {info.vars.map((v) => (
                    <code key={v} className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
                      {`{${v}}`}
                    </code>
                  ))}
                </p>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
