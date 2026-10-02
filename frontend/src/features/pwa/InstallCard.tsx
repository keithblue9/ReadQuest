"use client";

import { useState, useSyncExternalStore } from "react";

import { IOSInstallGuide } from "@/features/onboarding/IOSInstallGuide";
import { needsIOSInstallGuide } from "@/lib/platform";

import { promptInstall, useCanInstall } from "./installPrompt";

const noopSubscribe = () => () => {};

/** Ajakan memasang PWA: tombol (Android/desktop) atau panduan Add to Home Screen (iOS). */
export function InstallCard() {
  const canInstall = useCanInstall();
  const ios = useSyncExternalStore(noopSubscribe, needsIOSInstallGuide, () => false);
  const [showGuide, setShowGuide] = useState(false);

  if (!canInstall && !ios) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-primary/40 p-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Pasang ReadQuest</p>
          <p className="text-sm text-muted">Buka lebih cepat dari layar utama dan terima pengingat baca.</p>
        </div>
        {canInstall ? (
          <button
            type="button"
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            onClick={() => promptInstall()}
          >
            Pasang
          </button>
        ) : (
          <button
            type="button"
            aria-expanded={showGuide}
            className="shrink-0 text-sm font-bold text-primary"
            onClick={() => setShowGuide((v) => !v)}
          >
            {showGuide ? "Tutup" : "Caranya"}
          </button>
        )}
      </div>
      {ios && showGuide && <IOSInstallGuide compact />}
    </section>
  );
}
