"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { functionLabel, treeOrder, useLookups } from "@/features/admin/lookups";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

type AdminUser = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  locked: boolean;
  role: string | null;
  role_id: string | null;
  function: string | null;
  function_id: string | null;
  status: "active" | "suspended";
  points_total: number;
  last_active_at: string | null;
  created_at: string;
};

const PAGE = 50;
const select = "rounded-xl border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary";

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const { lookups } = useLookups();
  const [q, setQ] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; items: AdminUser[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
    if (q.trim()) params.set("q", q.trim());
    if (roleId) params.set("role_id", roleId);
    if (status) params.set("status", status);
    return api<{ total: number; items: AdminUser[] }>(`/admin/users?${params}`)
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [q, roleId, status, offset]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function update(target: AdminUser, patch: Partial<Pick<AdminUser, "role_id" | "function_id" | "status">>) {
    if (patch.status === "suspended" && !window.confirm(`Nonaktifkan ${target.name}? Semua sesi login-nya akan dicabut.`)) return;
    setBusy(target.id);
    setError(null);
    try {
      const updated = await api<AdminUser>(`/admin/users/${target.id}`, { method: "PUT", json: patch });
      setData((d) => d && { ...d, items: d.items.map((u) => (u.id === updated.id ? updated : u)) });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function resetPin(target: AdminUser) {
    const pin = window.prompt(`PIN baru untuk ${target.name} (6 angka). Sampaikan ke pengguna secara langsung.`);
    if (pin === null) return;
    setBusy(target.id);
    setError(null);
    setNotice(null);
    try {
      await api(`/admin/users/${target.id}/pin`, { method: "PUT", json: { pin: pin.trim() } });
      setData((d) => d && { ...d, items: d.items.map((u) => (u.id === target.id ? { ...u, locked: false } : u)) });
      setNotice(`PIN ${target.name} sudah di-reset. Semua sesi login-nya dicabut.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const functions = lookups ? treeOrder(lookups.functions) : [];

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Pengguna</h1>
        <p className="text-sm text-muted">
          Ubah role, fungsi, reset PIN, atau nonaktifkan akun. Semua perubahan tercatat di audit log.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Cari nama atau nomor HP…"
          aria-label="Cari pengguna"
          className="min-w-48 flex-1 rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          value={q}
          onChange={(e) => {
            setOffset(0);
            setQ(e.target.value);
          }}
        />
        <select
          aria-label="Filter role"
          className={select}
          value={roleId}
          onChange={(e) => {
            setOffset(0);
            setRoleId(e.target.value);
          }}
        >
          <option value="">Semua role</option>
          {lookups?.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          className={select}
          value={status}
          onChange={(e) => {
            setOffset(0);
            setStatus(e.target.value);
          }}
        >
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="suspended">Nonaktif</option>
        </select>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && (
        <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {notice}
        </p>
      )}

      {!data ? (
        <p className="text-sm text-muted">Memuat…</p>
      ) : (
        <>
          <p className="text-xs text-muted">{data.total} pengguna</p>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {data.items.map((u) => {
              const self = u.id === me?.id;
              return (
                <li key={u.id} className={`flex flex-col gap-2 px-4 py-3 ${u.status === "suspended" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {u.name}
                        {self && <span className="ml-2 text-xs font-semibold text-muted">(kamu)</span>}
                        {u.locked && (
                          <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
                            Terkunci
                          </span>
                        )}
                        {u.status === "suspended" && (
                          <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">
                            Nonaktif
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {u.phone ?? u.email ?? "—"} · {u.points_total} poin
                      </p>
                    </div>
                    {!self && (
                      <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        disabled={busy === u.id}
                        className="text-sm font-bold text-primary"
                        onClick={() => resetPin(u)}
                      >
                        Reset PIN
                      </button>
                      <button
                        type="button"
                        disabled={busy === u.id}
                        className={`shrink-0 text-sm font-bold ${u.status === "active" ? "text-muted hover:text-danger" : "text-primary"}`}
                        onClick={() => update(u, { status: u.status === "active" ? "suspended" : "active" })}
                      >
                        {u.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      aria-label={`Role ${u.name}`}
                      className={select}
                      value={u.role_id ?? ""}
                      disabled={self || busy === u.id}
                      onChange={(e) => update(u, { role_id: e.target.value })}
                    >
                      {lookups?.roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Fungsi ${u.name}`}
                      className={`${select} min-w-0 flex-1`}
                      value={u.function_id ?? ""}
                      disabled={busy === u.id}
                      onChange={(e) => update(u, { function_id: e.target.value })}
                    >
                      {!u.function_id && <option value="">— belum memilih —</option>}
                      {functions.map((f) => (
                        <option key={f.id} value={f.id}>
                          {functionLabel(f)}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
            {data.items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Tidak ada pengguna.</li>}
          </ul>
          {data.total > PAGE && (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                className="h-10 w-auto px-4"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE))}
              >
                ← Sebelumnya
              </Button>
              <span className="text-xs text-muted">
                {offset + 1}–{Math.min(offset + PAGE, data.total)} dari {data.total}
              </span>
              <Button
                variant="ghost"
                className="h-10 w-auto px-4"
                disabled={offset + PAGE >= data.total}
                onClick={() => setOffset(offset + PAGE)}
              >
                Berikutnya →
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
