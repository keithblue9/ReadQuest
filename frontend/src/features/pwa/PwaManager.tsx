"use client";

import { useEffect, useRef, useState } from "react";

import { initInstallPrompt } from "./installPrompt";

/** Daftarkan service worker, tawarkan pembaruan versi, dan tangkap prompt instal. */
export function PwaManager() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const updating = useRef(false);

  useEffect(() => {
    initInstallPrompt();
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;

    const onControllerChange = () => {
      // Hanya muat ulang bila pengguna yang meminta (bukan saat instal pertama kali).
      if (updating.current) window.location.reload();
    };
    sw.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | undefined;
    const track = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && sw.controller) setWaiting(worker);
      });
    };
    sw.register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;
        if (reg.waiting && sw.controller) setWaiting(reg.waiting);
        track(reg.installing);
        reg.addEventListener("updatefound", () => track(reg.installing));
      })
      .catch(() => undefined);

    // Cek versi baru saat aplikasi kembali dibuka.
    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div
      role="status"
      className="animate-pop-in fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full bg-foreground py-2 pr-2 pl-4 text-sm font-bold text-background shadow-xl"
    >
      ✨ Versi baru ReadQuest tersedia
      <button
        type="button"
        className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground"
        onClick={() => {
          updating.current = true;
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        Muat ulang
      </button>
    </div>
  );
}
