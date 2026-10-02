"use client";

import { useState } from "react";

import { ResourceManager } from "@/features/admin/ResourceManager";
import { functionLabel, treeOrder, useLookups } from "@/features/admin/lookups";

function CopyLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="shrink-0 text-sm font-bold text-muted hover:text-primary"
      onClick={async () => {
        const link = `${window.location.origin}/register?code=${encodeURIComponent(code)}`;
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Salin tautan undangan:", link);
        }
      }}
    >
      {copied ? "Tersalin ✓" : "🔗 Salin tautan"}
    </button>
  );
}

export default function AdminInvitesPage() {
  const { lookups } = useLookups();
  if (!lookups) return <p className="text-sm text-muted">Memuat…</p>;
  const roleName = new Map(lookups.roles.map((r) => [r.id, r.name]));
  const fnName = new Map(lookups.functions.map((f) => [f.id, f.name]));
  const memberRole = lookups.roles.find((r) => r.code === "member")?.id ?? lookups.roles[0]?.id ?? null;

  return (
    <ResourceManager
      resource="invite-codes"
      title="Kode Undangan"
      description="Anggota baru bergabung dengan kode ini dan otomatis mendapat role (dan fungsi) default. Nonaktifkan kode yang bocor."
      fields={[
        { name: "code", label: "Kode", hint: "Kosongkan untuk dibuat otomatis", lockedOnEdit: true },
        {
          name: "default_role_id",
          label: "Role default",
          type: "select",
          options: lookups.roles.map((r) => ({ value: r.id, label: r.name })),
        },
        {
          name: "default_function_id",
          label: "Fungsi default",
          type: "select",
          nullable: true,
          hint: "Kosong = pengguna memilih saat onboarding",
          options: treeOrder(lookups.functions).map((f) => ({ value: f.id, label: functionLabel(f) })),
        },
        { name: "max_uses", label: "Maks. pemakaian", type: "number", nullable: true, hint: "Kosong = tanpa batas" },
        { name: "expires_at", label: "Kedaluwarsa", type: "datetime", nullable: true },
        { name: "is_active", label: "Aktif", type: "toggle" },
      ]}
      defaults={{
        code: "",
        default_role_id: memberRole,
        default_function_id: null,
        max_uses: null,
        expires_at: null,
        is_active: true,
      }}
      canDelete={() => false}
      actions={(item) => (item.is_active ? <CopyLink code={String(item.code)} /> : null)}
      summary={(item) => {
        const expired = Boolean(item.expires_at) && new Date(String(item.expires_at)) < new Date();
        return (
          <div className="min-w-0">
            <p className="font-mono text-lg font-extrabold tracking-widest">
              {String(item.code)}
              {(!item.is_active || expired) && (
                <span className="ml-2 font-sans text-xs font-semibold tracking-normal text-muted">
                  ({expired ? "kedaluwarsa" : "nonaktif"})
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted">
              {roleName.get(String(item.default_role_id)) ?? "?"}
              {item.default_function_id ? ` · ${fnName.get(String(item.default_function_id)) ?? "?"}` : ""} · dipakai{" "}
              {String(item.used_count ?? 0)}
              {item.max_uses ? `/${String(item.max_uses)}` : ""}×
              {item.expires_at ? ` · s/d ${new Date(String(item.expires_at)).toLocaleDateString("id-ID")}` : ""}
            </p>
          </div>
        );
      }}
    />
  );
}
