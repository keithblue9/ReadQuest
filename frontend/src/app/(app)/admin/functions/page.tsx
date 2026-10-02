"use client";

import { ResourceManager, type Item } from "@/features/admin/ResourceManager";
import { functionLabel, treeOrder, useLookups } from "@/features/admin/lookups";

export default function AdminFunctionsPage() {
  const { lookups, reload } = useLookups();
  if (!lookups) return <p className="text-sm text-muted">Memuat…</p>;
  const functions = treeOrder(lookups.functions);
  const userName = new Map(lookups.users.map((u) => [u.id, u.name]));

  return (
    <ResourceManager
      resource="functions"
      title="Fungsi / Bagian"
      description="Unit kerja bertingkat. Team Lead sebuah fungsi dapat melihat status Authenticity Index anggotanya (termasuk sub-fungsi)."
      orderItems={(items) => treeOrder(items as (Item & { parent_id: string | null })[])}
      fields={[
        { name: "name", label: "Nama" },
        { name: "code", label: "Kode", hint: "huruf kecil & tanda hubung, mis. sales-jakarta" },
        {
          name: "parent_id",
          label: "Induk",
          type: "select",
          nullable: true,
          options: functions.map((f) => ({ value: f.id, label: functionLabel(f) })),
        },
        { name: "sort_order", label: "Urutan", type: "number" },
        {
          name: "lead_user_ids",
          label: "Team Lead",
          type: "multiselect",
          options: lookups.users.map((u) => ({ value: u.id, label: u.name })),
        },
        { name: "is_active", label: "Aktif", type: "toggle" },
      ]}
      defaults={{ name: "", code: "", parent_id: null, lead_user_ids: [], is_active: true, sort_order: 0 }}
      onChanged={reload}
      summary={(item) => {
        const depth = (item.ancestors as string[] | undefined)?.length ?? 0;
        const leads = ((item.lead_user_ids as string[]) ?? []).map((id) => userName.get(id) ?? "?");
        return (
          <div style={{ paddingLeft: depth * 16 }}>
            <p className="font-bold">
              {depth > 0 && <span className="text-muted">└ </span>}
              {String(item.name)}
              {!item.is_active && <span className="ml-2 text-xs font-semibold text-muted">(nonaktif)</span>}
            </p>
            <p className="text-xs text-muted">
              {String(item.code)}
              {leads.length > 0 && ` · Lead: ${leads.join(", ")}`}
            </p>
          </div>
        );
      }}
    />
  );
}
