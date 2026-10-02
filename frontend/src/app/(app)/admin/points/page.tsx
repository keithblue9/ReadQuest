"use client";

import { ResourceManager } from "@/features/admin/ResourceManager";

export default function AdminPointsPage() {
  return (
    <ResourceManager
      resource="point-rules"
      title="Aturan Poin & Batas Harian"
      description="Nilai poin tiap aktivitas dan batas anti-spam per hari. Perubahan berlaku untuk aktivitas berikutnya; entri ledger lama tidak berubah."
      fields={[
        { name: "name", label: "Nama aktivitas" },
        { name: "points", label: "Poin", type: "number" },
        {
          name: "daily_cap_count",
          label: "Batas jumlah / hari",
          type: "number",
          nullable: true,
          hint: "Kosongkan bila tanpa batas",
        },
        {
          name: "daily_cap_points",
          label: "Batas poin / hari",
          type: "number",
          nullable: true,
          hint: "Kosongkan bila tanpa batas",
        },
        { name: "is_active", label: "Aktif", type: "toggle" },
      ]}
      defaults={{}}
      summary={(item) => {
        const caps = [
          item.daily_cap_count ? `maks ${item.daily_cap_count}×/hari` : null,
          item.daily_cap_points ? `maks ${item.daily_cap_points} poin/hari` : null,
        ].filter(Boolean);
        return (
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 rounded-xl bg-primary/10 py-1 text-center font-extrabold text-primary tabular-nums">
              +{String(item.points)}
            </span>
            <div className="min-w-0">
              <p className="font-bold">
                {String(item.name)}
                {!item.is_active && <span className="ml-2 text-xs font-semibold text-muted">(nonaktif)</span>}
              </p>
              <p className="text-xs text-muted">
                <code>{String(item.code)}</code>
                {caps.length ? ` · ${caps.join(" · ")}` : " · tanpa batas harian"}
              </p>
            </div>
          </div>
        );
      }}
    />
  );
}
