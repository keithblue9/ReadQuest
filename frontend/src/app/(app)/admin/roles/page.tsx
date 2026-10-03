"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/errors";

type Role = {
  id: string;
  code: string;
  name: string;
  description: string;
  permission_codes: string[];
  is_system?: boolean;
};
type Permission = { code: string; group: string; description: string };
type RoleForm = { id: string | null; code: string; name: string; description: string };

const GROUP_LABEL: Record<string, string> = {
  reading: "Membaca",
  feed: "Feed",
  books: "Buku",
  leaderboard: "Leaderboard",
  authenticity: "Authenticity Index",
  moderation: "Moderasi",
  admin: "Admin",
  config: "Konfigurasi",
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState<RoleForm | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([api<{ items: Role[] }>("/admin/resources/roles"), api<Permission[]>("/admin/permissions")])
        .then(([r, p]) => {
          setRoles(r.items);
          setPerms(p);
          setDraft(Object.fromEntries(r.items.map((role) => [role.id, role.permission_codes])));
        })
        .catch((err) => setError(errorMessage(err))),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const out = new Map<string, Permission[]>();
    for (const p of perms) out.set(p.group, [...(out.get(p.group) ?? []), p]);
    return [...out.entries()];
  }, [perms]);

  const dirty = (roles ?? []).filter((r) => draft[r.id] && !sameSet(draft[r.id], r.permission_codes));

  function toggle(roleId: string, code: string) {
    setNotice(null);
    setDraft((d) => {
      const current = d[roleId] ?? [];
      return { ...d, [roleId]: current.includes(code) ? current.filter((c) => c !== code) : [...current, code] };
    });
  }

  async function saveMatrix() {
    setSaving(true);
    setError(null);
    try {
      for (const role of dirty) {
        await api(`/admin/resources/roles/${role.id}`, {
          method: "PUT",
          json: { code: role.code, name: role.name, description: role.description, permission_codes: draft[role.id] },
        });
      }
      setNotice(`${dirty.length} role disimpan. Perubahan langsung berlaku.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveForm() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setFormErrors({});
    const existing = roles?.find((r) => r.id === form.id);
    try {
      await api(`/admin/resources/roles${form.id ? `/${form.id}` : ""}`, {
        method: form.id ? "PUT" : "POST",
        json: {
          code: form.code,
          name: form.name,
          description: form.description,
          permission_codes: existing ? (draft[existing.id] ?? existing.permission_codes) : [],
        },
      });
      setForm(null);
      await load();
    } catch (err) {
      setFormErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: Role) {
    if (!window.confirm(`Hapus role "${role.name}"? Tindakan tercatat di audit log.`)) return;
    setError(null);
    try {
      await api(`/admin/resources/roles/${role.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!roles) return <p className="text-sm text-muted">{error ?? "Memuat…"}</p>;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Role & Akses</h1>
          <p className="text-sm text-muted">Matriks permission (RBAC). Centang untuk memberi akses, lalu simpan.</p>
        </div>
        {!form && (
          <Button
            className="h-10 w-auto px-4 text-sm"
            onClick={() => setForm({ id: null, code: "", name: "", description: "" })}
          >
            + Role baru
          </Button>
        )}
      </header>

      {error && <Alert>{error}</Alert>}
      {notice && (
        <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {notice}
        </p>
      )}

      {form && (
        <div className="animate-pop-in grid gap-3 rounded-2xl border-2 border-primary/40 bg-surface p-4 sm:grid-cols-2">
          {(["name", "code", "description"] as const).map((key) => {
            const locked = key === "code" && Boolean(roles.find((r) => r.id === form.id)?.is_system);
            return (
              <label
                key={key}
                className={`flex flex-col gap-1.5 text-sm font-semibold ${key === "description" ? "sm:col-span-2" : ""}`}
              >
                {{ name: "Nama", code: "Kode", description: "Deskripsi" }[key]}
                <input
                  className={`rounded-xl border bg-surface px-3 py-2 outline-none focus:border-primary disabled:opacity-60 ${
                    formErrors[key] ? "border-danger" : "border-border"
                  }`}
                  value={form[key]}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
                {formErrors[key] && <span className="text-xs text-danger">{formErrors[key]}</span>}
              </label>
            );
          })}
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="ghost" className="h-10 w-auto px-4" onClick={() => setForm(null)}>
              Batal
            </Button>
            <Button className="h-10 w-auto px-6" loading={saving} onClick={saveForm}>
              Simpan
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-3 text-left text-xs font-bold text-muted">
                Permission
              </th>
              {roles.map((role) => (
                <th key={role.id} scope="col" className="px-3 py-3 text-center align-bottom">
                  <span className="block font-bold">{role.name}</span>
                  <span className="mt-1 flex justify-center gap-2 text-xs font-bold">
                    <button
                      type="button"
                      className="text-primary"
                      onClick={() => setForm({ id: role.id, code: role.code, name: role.name, description: role.description })}
                    >
                      Ubah
                    </button>
                    {!role.is_system && (
                      <button type="button" className="text-muted hover:text-danger" onClick={() => remove(role)}>
                        Hapus
                      </button>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, items]) => (
              <GroupRows
                key={group}
                group={group}
                items={items}
                roles={roles}
                draft={draft}
                onToggle={toggle}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {dirty.length > 0 && (
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted shadow">
            {dirty.length} role berubah
          </span>
        )}
        <Button
          variant="ghost"
          className="h-10 w-auto px-4"
          disabled={!dirty.length}
          onClick={() => setDraft(Object.fromEntries(roles.map((r) => [r.id, r.permission_codes])))}
        >
          Reset
        </Button>
        <Button className="h-10 w-auto px-6" disabled={!dirty.length} loading={saving} onClick={saveMatrix}>
          Simpan matriks
        </Button>
      </div>
    </section>
  );
}

function GroupRows({
  group,
  items,
  roles,
  draft,
  onToggle,
}: {
  group: string;
  items: Permission[];
  roles: Role[];
  draft: Record<string, string[]>;
  onToggle: (roleId: string, code: string) => void;
}) {
  return (
    <>
      <tr className="bg-surface-muted">
        <th
          scope="colgroup"
          colSpan={roles.length + 1}
          className="sticky left-0 px-4 py-1.5 text-left text-xs font-bold tracking-wide text-muted uppercase"
        >
          {GROUP_LABEL[group] ?? group}
        </th>
      </tr>
      {items.map((p) => (
        <tr key={p.code} className="border-b border-border last:border-0">
          <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal">
            <span className="block font-semibold">{p.description}</span>
            <code className="text-xs text-muted">{p.code}</code>
          </th>
          {roles.map((role) => {
            const checked = (draft[role.id] ?? []).includes(p.code);
            return (
              <td key={role.id} className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--primary)]"
                  checked={checked}
                  aria-label={`${role.name}: ${p.description}`}
                  onChange={() => onToggle(role.id, p.code)}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
