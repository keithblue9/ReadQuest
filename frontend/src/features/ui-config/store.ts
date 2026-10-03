"use client";

import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_TEXTS, formatText, type TextKey, type TextVars } from "@/lib/texts";

export const FEATURES = ["feed", "books", "leaderboard", "quests", "buddy", "room", "book_of_month", "push"] as const;
export type Feature = (typeof FEATURES)[number];

export const MENUS = [
  "dashboard",
  "feed",
  "read",
  "books",
  "leaderboard",
  "quests",
  "buddy",
  "room",
  "notifications",
  "profile",
] as const;
export type Menu = (typeof MENUS)[number];

export type UiConfig = {
  branding: {
    app_name: string;
    tagline: string;
    logo_emoji: string;
    logo_key: string | null;
    logo_url: string | null;
  };
  login: { interval_seconds: number; backgrounds: { key: string; url: string }[] };
  features: { enabled: Record<Feature, boolean>; menu_order: Menu[] };
  texts: Record<string, string>;
  updated_at: string | null;
};

export const DEFAULT_UI_CONFIG: UiConfig = {
  branding: {
    app_name: "ReadQuest",
    tagline: "Baca 15 menit sehari, tumbuh bersama",
    logo_emoji: "📚",
    logo_key: null,
    logo_url: null,
  },
  login: { interval_seconds: 6, backgrounds: [] },
  features: {
    enabled: Object.fromEntries(FEATURES.map((f) => [f, true])) as Record<Feature, boolean>,
    menu_order: [...MENUS],
  },
  texts: {},
  updated_at: null,
};

const CACHE_KEY = "rq-ui-config";

/** Lengkapi data dari server/cache dengan default agar field baru tidak membuat UI rusak. */
export function normalizeUiConfig(raw: Partial<UiConfig> | null | undefined): UiConfig {
  const d = DEFAULT_UI_CONFIG;
  if (!raw || typeof raw !== "object") return d;
  const enabled = { ...d.features.enabled, ...(raw.features?.enabled ?? {}) };
  const order = (raw.features?.menu_order ?? []).filter((m): m is Menu => (MENUS as readonly string[]).includes(m));
  return {
    branding: { ...d.branding, ...(raw.branding ?? {}) },
    login: { ...d.login, ...(raw.login ?? {}) },
    features: { enabled, menu_order: [...new Set([...order, ...MENUS])] },
    texts: { ...(raw.texts ?? {}) },
    updated_at: raw.updated_at ?? null,
  };
}

// Store modul: snapshot server selalu default (hidrasi cocok), lalu React memakai cache
// localStorage di render berikutnya dan memperbaruinya dari API.
let state: UiConfig = DEFAULT_UI_CONFIG;
let cacheRead = false;
let fetched = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readCache() {
  cacheRead = true;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) state = normalizeUiConfig(JSON.parse(raw));
  } catch {
    // cache rusak/diblokir: pakai default
  }
}

export function setUiConfig(next: Partial<UiConfig>) {
  state = normalizeUiConfig(next);
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    // penyimpanan penuh/diblokir: tetap jalan tanpa cache
  }
  emit();
}

export async function refreshUiConfig() {
  try {
    const response = await fetch("/api/v1/ui-config", { cache: "no-store" });
    if (response.ok) setUiConfig(await response.json());
  } catch {
    // offline: tetap memakai cache/default
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!fetched) {
    fetched = true;
    void refreshUiConfig();
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  if (!cacheRead) readCache();
  return state;
}

function getServerSnapshot() {
  return DEFAULT_UI_CONFIG;
}

export function useUiConfig(): UiConfig {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type Translate = (key: TextKey, vars?: TextVars) => string;

/** `t("auth.login.title")` → teks dari Admin bila ada, selain itu default. */
export function useT(): Translate {
  const { texts, branding } = useUiConfig();
  return useCallback(
    (key, vars) =>
      formatText(texts[key] ?? DEFAULT_TEXTS[key], {
        app: branding.app_name,
        tagline: branding.tagline,
        year: new Date().getFullYear(),
        ...vars,
      }),
    [texts, branding.app_name, branding.tagline],
  );
}

export function useFeature(feature: Feature): boolean {
  return useUiConfig().features.enabled[feature];
}
