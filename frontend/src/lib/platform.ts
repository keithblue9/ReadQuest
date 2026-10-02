/** iPhone/iPad Safari (termasuk iPadOS yang mengaku sebagai Mac). */
export function isIOS(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** Sudah dibuka dari Home Screen (mode standalone)? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

/** Perlu panduan "Add to Home Screen": iOS dan belum terpasang sebagai PWA. */
export function needsIOSInstallGuide(): boolean {
  if (typeof window === "undefined") return false;
  return isIOS(navigator.userAgent, navigator.maxTouchPoints) && !isStandalone();
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
  } catch {
    return "Asia/Jakarta";
  }
}
