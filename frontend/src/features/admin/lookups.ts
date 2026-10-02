"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

export type Lookups = {
  roles: { id: string; code: string; name: string }[];
  functions: { id: string; code: string; name: string; parent_id: string | null; ancestors: string[]; is_active: boolean }[];
  categories: { id: string; code: string; name: string; icon: string | null }[];
  users: { id: string; name: string; email: string }[];
};

/** Pilihan role/fungsi/kategori/pengguna untuk form Admin. `reload` dipanggil setelah data berubah. */
export function useLookups() {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const reload = useCallback(() => {
    api<Lookups>("/admin/lookups")
      .then(setLookups)
      .catch(() => setLookups({ roles: [], functions: [], categories: [], users: [] }));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { lookups, reload };
}

/** Nama fungsi dengan indentasi sesuai kedalaman hierarki. */
export function functionLabel(fn: Lookups["functions"][number]) {
  return `${"— ".repeat(fn.ancestors.length)}${fn.name}`;
}

/** Urutkan fungsi sebagai pohon (induk diikuti sub-fungsinya). */
export function treeOrder<T extends { id: string; parent_id: string | null }>(items: T[]): T[] {
  const ids = new Set(items.map((i) => i.id));
  const children = new Map<string | null, T[]>();
  for (const item of items) {
    const parent = item.parent_id && ids.has(item.parent_id) ? item.parent_id : null;
    children.set(parent, [...(children.get(parent) ?? []), item]);
  }
  const out: T[] = [];
  const walk = (parent: string | null) => {
    for (const item of children.get(parent) ?? []) {
      out.push(item);
      walk(item.id);
    }
  };
  walk(null);
  return out;
}
