"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { ReadingSession, SessionConfig } from "@/lib/types";

export type PauseReason = "manual" | "idle" | "hidden" | null;

const PRESENCE_GRACE_MS = 60_000;

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Timer sesi baca. Server adalah sumber kebenaran `active_seconds`; klien hanya
 * memproyeksikan waktu di antara heartbeat agar tampilan berjalan mulus.
 */
export function useReadingTimer(initial: ReadingSession, config: SessionConfig) {
  const [session, setSession] = useState(initial);
  const [running, setRunning] = useState(initial.status === "active");
  const [pauseReason, setPauseReason] = useState<PauseReason>(
    initial.status === "paused" ? "manual" : null,
  );
  const [anchor, setAnchor] = useState(() => ({
    seconds: initial.active_seconds,
    at: Date.now(),
  }));
  const [now, setNow] = useState(() => Date.now());
  const [presenceDeadline, setPresenceDeadline] = useState<number | null>(null);
  const [syncError, setSyncError] = useState(false);
  const lastInteraction = useRef(0);
  const runningRef = useRef(running);
  const sessionId = initial.id;

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  // Keluar dari halaman timer → jeda di server agar waktu tidak terus berjalan.
  useEffect(
    () => () => {
      if (runningRef.current) {
        api(`/sessions/${sessionId}/heartbeat`, {
          method: "POST",
          json: { state: "paused" },
          keepalive: true,
        }).catch(() => undefined);
      }
    },
    [sessionId],
  );

  const sync = useCallback(
    async (state: "active" | "paused") => {
      try {
        const updated = await api<ReadingSession>(`/sessions/${sessionId}/heartbeat`, {
          method: "POST",
          json: { state },
        });
        setSession(updated);
        setAnchor({ seconds: updated.active_seconds, at: Date.now() });
        setSyncError(false);
        return updated;
      } catch {
        setSyncError(true);
        return null;
      }
    },
    [sessionId],
  );

  const pause = useCallback(
    async (reason: Exclude<PauseReason, null>) => {
      setRunning(false);
      setPauseReason(reason);
      setPresenceDeadline(null);
      await sync("paused");
    },
    [sync],
  );

  const resume = useCallback(async () => {
    lastInteraction.current = Date.now();
    setPresenceDeadline(null);
    const updated = await sync("active");
    if (updated) {
      setRunning(true);
      setPauseReason(null);
    }
  }, [sync]);

  const confirmPresence = useCallback(() => {
    lastInteraction.current = Date.now();
    setPresenceDeadline(null);
  }, []);

  // Detak tampilan + cek kehadiran.
  useEffect(() => {
    lastInteraction.current = Date.now();
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (!running) return;
      setPresenceDeadline((deadline) => {
        if (deadline === null && t - lastInteraction.current > config.idle_timeout_seconds * 1000) {
          return t + PRESENCE_GRACE_MS;
        }
        return deadline;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, config.idle_timeout_seconds]);

  // Tidak ada jawaban "Masih membaca?" → jeda otomatis.
  useEffect(() => {
    if (presenceDeadline === null) return;
    const timeout = setTimeout(() => pause("idle"), Math.max(0, presenceDeadline - Date.now()));
    return () => clearTimeout(timeout);
  }, [presenceDeadline, pause]);

  // Heartbeat berkala saat aktif.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => sync("active"), config.heartbeat_interval_seconds * 1000);
    return () => clearInterval(timer);
  }, [running, sync, config.heartbeat_interval_seconds]);

  // Interaksi pengguna menunda cek kehadiran.
  useEffect(() => {
    const mark = () => {
      lastInteraction.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, mark));
  }, []);

  // Aplikasi ditutup/disembunyikan → jeda.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && running) pause("hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [running, pause]);

  // Jaga layar tetap menyala selama membaca (bila didukung browser).
  useEffect(() => {
    if (!running) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((sentinel) => {
        if (cancelled) sentinel.release().catch(() => undefined);
        else lock = sentinel;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      lock?.release().catch(() => undefined);
    };
  }, [running]);

  const elapsed = running ? anchor.seconds + Math.max(0, (now - anchor.at) / 1000) : anchor.seconds;

  return {
    session,
    running,
    pauseReason,
    elapsedSeconds: Math.floor(elapsed),
    presencePromptSeconds:
      presenceDeadline === null ? null : Math.max(0, Math.ceil((presenceDeadline - now) / 1000)),
    syncError,
    pause,
    resume,
    confirmPresence,
    sync,
  };
}
