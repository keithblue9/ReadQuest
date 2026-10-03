"use client";

import { Moon, Sun } from "lucide-react";
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
      className="grid size-10 place-items-center rounded-full bg-surface-muted text-foreground transition hover:brightness-95 active:scale-95"
      aria-label={isDark ? "Gunakan tema terang" : "Gunakan tema gelap"}
    >
      {isDark ? <Moon className="size-5" aria-hidden /> : <Sun className="size-5" aria-hidden />}
    </button>
  );
}
