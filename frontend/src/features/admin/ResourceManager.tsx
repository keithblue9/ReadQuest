"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { errorMessage, fieldErrors } from "@/lib/errors";

export type Item = Record<string, unknown> & { id: string };

export type FieldDef = {
  name: string; // boleh bertingkat, mis. "criteria.type"
  label: string;
  type?: "text" | "textarea" | "number" | "toggle" | "select" | "multiselect" | "datetime";
  options?: { value: string; label: string }[];
  nullable?: boolean;
  hint?: string;
  lockedOnEdit?: boolean;
};

export function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath((obj[head] as Record<string, unknown>) ?? {}, rest.join("."), value) };
}

function toLocalInput(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FieldInput({
  field,
  value,
  onChange,
  locked,
  error,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  locked: boolean;
  error?: string;
}) {
  const base =
    "w-full rounded-xl border bg-surface px-3 py-2 outline-none focus:border-primary disabled:opacity-60 " +
    (error ? "border-danger" : "border-border");
  let control: React.ReactNode;
  switch (field.type) {
    case "textarea":
      control = (
        <textarea className={base} rows={3} value={String(value ?? "")} disabled={locked} onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case "number":
      control = (
        <input
          type="number"
          className={base}
          value={value === null || value === undefined ? "" : String(value)}
          disabled={locked}
          onChange={(e) => onChange(e.target.value === "" ? (field.nullable ? null : 0) : Number(e.target.value))}
        />
      );
      break;
    case "toggle":
      control = (
        <input
          type="checkbox"
          className="size-5 accent-[var(--primary)]"
          checked={Boolean(value)}
          disabled={locked}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
      break;
    case "select":
      control = (
        <select
          className={base}
          value={value === null || value === undefined ? "" : String(value)}
          disabled={locked}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        >
          {field.nullable && <option value="">—</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "multiselect": {
      const selected = new Set((value as string[] | undefined) ?? []);
      control = (
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border p-2">
          {field.options?.map((o) => (
            <label
              key={o.value}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold ${
                selected.has(o.value) ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected.has(o.value)}
                disabled={locked}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(o.value);
                  else next.delete(o.value);
                  onChange([...next]);
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
      break;
    }
    case "datetime":
      control = (
        <input
          type="datetime-local"
          className={base}
          value={toLocalInput(value)}
          disabled={locked}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      );
      break;
    default:
      control = (
        <input className={base} value={String(value ?? "")} disabled={locked} onChange={(e) => onChange(e.target.value)} />
      );
  }
  return (
    <label className={`flex gap-1.5 text-sm font-semibold ${field.type === "toggle" ? "flex-row items-center" : "flex-col"}`}>
      {field.type === "toggle" ? (
        <>
          {control}
          {field.label}
        </>
      ) : (
        <>
          {field.label}
          {control}
        </>
      )}
      {error ? <span className="text-xs text-danger">{error}</span> : field.hint && <span className="text-xs font-normal text-muted">{field.hint}</span>}
    </label>
  );
}

type Props = {
  resource: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  summary: (item: Item) => React.ReactNode;
  onChanged?: () => void;
  /** Urutan tampilan (mis. pohon fungsi); default urutan dari server. */
  orderItems?: (items: Item[]) => Item[];
  /** Sembunyikan tombol Hapus untuk item tertentu (mis. role bawaan). */
  canDelete?: (item: Item) => boolean;
  /** Tombol tambahan per item. */
  actions?: (item: Item) => React.ReactNode;
};

/** CRUD generik untuk `/admin/resources/{resource}` (semua perubahan tercatat di audit log). */
export function ResourceManager({
  resource,
  title,
  description,
  fields,
  defaults,
  summary,
  onChanged,
  orderItems,
  canDelete,
  actions,
}: Props) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [creatable, setCreatable] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; data: Record<string, unknown> } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  function startEdit(id: string | null, data: Record<string, unknown>) {
    setErrors({});
    setEditing({ id, data });
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const load = useCallback(
    () =>
      api<{ items: Item[]; creatable: boolean }>(`/admin/resources/${resource}`)
        .then((r) => {
          setItems(r.items);
          setCreatable(r.creatable);
        })
        .catch((err) => setError(errorMessage(err))),
    [resource],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    setErrors({});
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const top = f.name.split(".")[0];
      payload[top] = editing.data[top];
    }
    try {
      await api(`/admin/resources/${resource}${editing.id ? `/${editing.id}` : ""}`, {
        method: editing.id ? "PUT" : "POST",
        json: payload,
      });
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Item) {
    if (!window.confirm("Hapus data ini? Tindakan tercatat di audit log.")) return;
    setError(null);
    try {
      await api(`/admin/resources/${resource}/${item.id}`, { method: "DELETE" });
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {creatable && !editing && (
          <Button className="h-10 w-auto px-4 text-sm" onClick={() => startEdit(null, { ...defaults })}>
            + Tambah
          </Button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}

      {editing && (
        <div
          ref={formRef}
          className="animate-pop-in grid scroll-mt-4 gap-3 rounded-2xl border-2 border-primary/40 bg-surface p-4 sm:grid-cols-2"
        >
          {fields.map((f) => (
            <div key={f.name} className={f.type === "textarea" || f.type === "multiselect" ? "sm:col-span-2" : ""}>
              <FieldInput
                field={f}
                value={getPath(editing.data, f.name)}
                locked={Boolean(f.lockedOnEdit && editing.id)}
                error={errors[f.name.split(".").pop() ?? f.name]}
                onChange={(v) => setEditing({ ...editing, data: setPath(editing.data, f.name, v) })}
              />
            </div>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="ghost" className="h-10 w-auto px-4" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button className="h-10 w-auto px-6" loading={saving} onClick={save}>
              Simpan
            </Button>
          </div>
        </div>
      )}

      {items === null ? (
        <p className="text-sm text-muted">Memuat…</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {(orderItems ? orderItems(items) : items).map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">{summary(item)}</div>
              {actions?.(item)}
              <button
                type="button"
                className="text-sm font-bold text-primary"
                onClick={() => startEdit(item.id, { ...item })}
              >
                Ubah
              </button>
              {creatable && (canDelete?.(item) ?? true) && (
                <button type="button" className="text-sm font-bold text-muted hover:text-danger" onClick={() => remove(item)}>
                  Hapus
                </button>
              )}
            </li>
          ))}
          {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Belum ada data.</li>}
        </ul>
      )}
    </section>
  );
}
