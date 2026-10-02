"use client";

import { ResourceManager } from "@/features/admin/ResourceManager";
import { METRIC_OPTIONS, metricLabel } from "@/features/admin/metrics";

const PERIOD_LABEL: Record<string, string> = { weekly: "Mingguan", monthly: "Bulanan", once: "Sekali" };

const Inactive = ({ active }: { active: unknown }) =>
  active === false ? <span className="ml-2 text-xs font-semibold text-muted">(nonaktif)</span> : null;

export default function AdminGamificationPage() {
  return (
    <div className="flex flex-col gap-10">
      <ResourceManager
        resource="levels"
        title="Level & Title"
        description="Level ditentukan dari total poin. Pastikan ambang poin naik seiring level."
        fields={[
          { name: "level", label: "Level", type: "number" },
          { name: "title", label: "Title" },
          { name: "min_points", label: "Poin minimal", type: "number" },
          { name: "icon", label: "Ikon (emoji)" },
        ]}
        defaults={{ level: 1, title: "", min_points: 0, icon: "⭐" }}
        summary={(item) => (
          <p className="font-bold">
            <span aria-hidden className="mr-2">
              {String(item.icon ?? "⭐")}
            </span>
            Lv {String(item.level)} · {String(item.title)}
            <span className="ml-2 text-xs font-semibold text-muted">≥ {String(item.min_points)} poin</span>
          </p>
        )}
      />

      <ResourceManager
        resource="badges"
        title="Badge"
        description="Badge diberikan otomatis saat metrik pengguna mencapai ambang. Badge yang sudah dimiliki tidak bisa dihapus — nonaktifkan saja."
        fields={[
          { name: "name", label: "Nama" },
          { name: "code", label: "Kode", lockedOnEdit: true },
          { name: "icon", label: "Ikon (emoji)" },
          { name: "order", label: "Urutan", type: "number" },
          { name: "description", label: "Deskripsi", type: "textarea" },
          { name: "criteria.type", label: "Metrik", type: "select", options: METRIC_OPTIONS },
          { name: "criteria.gte", label: "Ambang (≥)", type: "number" },
          { name: "is_active", label: "Aktif", type: "toggle" },
        ]}
        defaults={{
          name: "",
          code: "",
          icon: "🏅",
          order: 0,
          description: "",
          criteria: { type: "sessions_count", gte: 1 },
          is_active: true,
        }}
        summary={(item) => {
          const c = item.criteria as { type: string; gte: number };
          return (
            <div className="flex items-center gap-3">
              <span aria-hidden className="text-2xl">
                {String(item.icon)}
              </span>
              <div className="min-w-0">
                <p className="font-bold">
                  {String(item.name)}
                  <Inactive active={item.is_active} />
                </p>
                <p className="text-xs text-muted">
                  {metricLabel(c?.type)} ≥ {c?.gte}
                </p>
              </div>
            </div>
          );
        }}
      />

      <ResourceManager
        resource="quests"
        title="Quest"
        description="Quest berulang otomatis tiap periode (Senin–Minggu untuk mingguan). Quest sekali butuh tanggal mulai & selesai."
        fields={[
          { name: "title", label: "Judul" },
          { name: "code", label: "Kode", lockedOnEdit: true },
          { name: "description", label: "Deskripsi", type: "textarea" },
          {
            name: "period",
            label: "Periode",
            type: "select",
            options: Object.entries(PERIOD_LABEL).map(([value, label]) => ({ value, label })),
          },
          { name: "order", label: "Urutan", type: "number" },
          { name: "goal.type", label: "Metrik target", type: "select", options: METRIC_OPTIONS },
          { name: "goal.target", label: "Target", type: "number" },
          { name: "reward.points", label: "Hadiah poin", type: "number" },
          { name: "recurring", label: "Berulang", type: "toggle" },
          { name: "starts_at", label: "Mulai", type: "datetime", nullable: true, hint: "Untuk quest tidak berulang" },
          { name: "ends_at", label: "Selesai", type: "datetime", nullable: true },
          { name: "is_active", label: "Aktif", type: "toggle" },
        ]}
        defaults={{
          title: "",
          code: "",
          description: "",
          period: "weekly",
          order: 0,
          goal: { type: "reading_days", target: 5 },
          reward: { points: 30 },
          recurring: true,
          starts_at: null,
          ends_at: null,
          is_active: true,
        }}
        summary={(item) => {
          const goal = item.goal as { type: string; target: number };
          const reward = item.reward as { points: number } | undefined;
          return (
            <div>
              <p className="font-bold">
                🎯 {String(item.title)}
                <Inactive active={item.is_active} />
              </p>
              <p className="text-xs text-muted">
                {PERIOD_LABEL[String(item.period)] ?? String(item.period)}
                {item.recurring ? " · berulang" : ""} · {metricLabel(goal?.type)} {goal?.target}
                {reward?.points ? ` · +${reward.points} poin` : ""}
              </p>
            </div>
          );
        }}
      />
    </div>
  );
}
