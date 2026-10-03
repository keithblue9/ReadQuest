"use client";

import { useEffect, useSyncExternalStore } from "react";

import { api } from "@/lib/api";
import type { PointsSummary, Progress, TeamDashboard } from "@/lib/types";

/**
 * Data ringkas yang dipakai panel kanan (desktop) dan kartu progres (HP): target, streak, dan
 * statistik tim. Disimpan di store modul agar tidak diambil ulang di setiap halaman.
 */
type ShellData = {
  progress: Progress | null;
  points: PointsSummary | null;
  team: TeamDashboard | null;
};

let state: ShellData = { progress: null, points: null, team: null };
let lastLoad = 0;
const listeners = new Set<() => void>();
const STALE_MS = 60_000;
const EMPTY: ShellData = { progress: null, points: null, team: null };

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<ShellData>) {
  state = { ...state, ...patch };
  emit();
}

/** Muat ulang (mis. setelah sesi baca selesai). */
export function refreshShellData(force = false) {
  if (!force && Date.now() - lastLoad < STALE_MS) return;
  lastLoad = Date.now();
  api<Progress>("/me/progress").then((progress) => set({ progress })).catch(() => undefined);
  api<PointsSummary>("/me/points").then((points) => set({ points })).catch(() => undefined);
  api<TeamDashboard>("/dashboard").then((team) => set({ team })).catch(() => undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useShellData(): ShellData {
  const data = useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
  useEffect(() => {
    refreshShellData();
    const onFocus = () => document.visibilityState === "visible" && refreshShellData();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, []);
  return data;
}
