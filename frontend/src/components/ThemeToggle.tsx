"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Tema baru diketahui di klien; hindari mismatch saat hydration.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="grid size-10 place-items-center rounded-full border border-border bg-surface text-lg transition hover:scale-105 active:scale-95"
      aria-label={isDark ? "Gunakan tema terang" : "Gunakan tema gelap"}
    >
      <span aria-hidden>{mounted ? (isDark ? "🌙" : "☀️") : "◐"}</span>
    </button>
  );
}
