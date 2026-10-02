"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

type Entry = {
  id: string;
  actor_id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string;
  user_agent: string;
  created_at: string;
};

const ENTITY_TYPES: Record<string, string> = {
  functions: "Fungsi",
  roles: "Role",
  point_rules: "Aturan poin",
  badges: "Badge",
  quests: "Quest",
  levels: "Level",
  book_categories: "Kategori buku",
  books: "Buku",
  book_of_month: "Book of the Month",
  notification_templates: "Template notifikasi",
  invite_codes: "Kode undangan",
  app_settings: "Pengaturan",
  users: "Pengguna",
  posts: "Posting",
  comments: "Komentar",
  report: "Laporan/export",
};

const IGNORED = new Set(["updated_at", "created_at", "id", "_id"]);

const show = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v));

/** Field yang berubah antara before dan after (level atas). */
function changes(entry: Entry): { key: string; before: unknown; after: unknown }[] {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !IGNORED.has(k));
  return keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ key: k, before: before[k], after: after[k] }));
}

function EntryRow({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false);
  const diff = changes(entry);
  return (
    <li className="px-4 py-3">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-start gap-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-bold">{entry.actor_name ?? "?"}</span>{" "}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{entry.action}</code>
          </p>
          <p className="truncate text-xs text-muted">
            {ENTITY_TYPES[entry.entity_type] ?? entry.entity_type}
            {entry.entity_id ? ` · ${entry.entity_id}` : ""} · {diff.length} perubahan
          </p>
        </div>
        <time className="shrink-0 text-xs text-muted tabular-nums" dateTime={entry.created_at}>
          {new Date(entry.created_at).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {diff.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 pr-2 font-bold">Field</th>
                    <th className="py-1 pr-2 font-bold">Sebelum</th>
                    <th className="py-1 font-bold">Sesudah</th>
                  </tr>
                </thead>
                <tbody className="align-top font-mono">
                  {diff.map((d) => {
                    const lists = Array.isArray(d.before) && Array.isArray(d.after);
                    const removed = lists ? (d.before as unknown[]).filter((x) => !(d.after as unknown[]).includes(x)) : [];
                    const added = lists ? (d.after as unknown[]).filter((x) => !(d.before as unknown[]).includes(x)) : [];
                    return (
                      <tr key={d.key} className="border-t border-border">
                        <td className="py-1 pr-2 font-sans font-semibold">{d.key}</td>
                        <td className="max-w-[16rem] py-1 pr-2 break-all whitespace-pre-line text-danger">
                          {lists ? removed.map((x) => `− ${show(x)}`).join("\n") || "—" : show(d.before)}
                        </td>
                        <td className="max-w-[16rem] py-1 break-all whitespace-pre-line text-success">
                          {lists ? added.map((x) => `+ ${show(x)}`).join("\n") || "—" : show(d.after)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted">Tidak ada perubahan field.</p>
          )}
          <p className="truncate text-xs text-muted">
            IP {entry.ip || "—"} · {entry.user_agent || "—"}
          </p>
        </div>
      )}
    </li>
  );
}

export default function AdminAuditPage() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [items, setItems] = useState<Entry[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    (after: string | null) => {
      const params = new URLSearchParams({ limit: "50" });
      if (entityType) params.set("entity_type", entityType);
      if (action.trim()) params.set("action", action.trim());
      if (after) params.set("cursor", after);
      return api<{ items: Entry[]; next_cursor: string | null }>(`/admin/audit?${params}`);
    },
    [entityType, action],
  );

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      fetchPage(null)
        .then((r) => {
          if (!alive) return;
          setItems(r.items);
          setCursor(r.next_cursor);
        })
        .catch((err) => alive && setError(errorMessage(err)));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [fetchPage]);

  async function more() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const r = await fetchPage(cursor);
      setItems((prev) => [...(prev ?? []), ...r.items]);
      setCursor(r.next_cursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-extrabold">Audit Log</h1>
        <p className="text-sm text-muted">Jejak setiap perubahan konfigurasi, pengguna, moderasi, dan export. Tidak bisa diubah.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filter jenis data"
          className="rounded-xl border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-primary"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">Semua data</option>
          {Object.entries(ENTITY_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Filter aksi"
          placeholder="Awalan aksi, mis. badges. atau moderation."
          className="min-w-48 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
      </div>
      {error && <Alert>{error}</Alert>}
      {!items ? (
        <p className="text-sm text-muted">Memuat…</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {items.map((e) => (
            <EntryRow key={e.id} entry={e} />
          ))}
          {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Belum ada catatan.</li>}
        </ul>
      )}
      {cursor && (
        <Button variant="ghost" className="h-10 w-auto self-center px-6" loading={loadingMore} onClick={more}>
          Muat lebih banyak
        </Button>
      )}
    </section>
  );
}
