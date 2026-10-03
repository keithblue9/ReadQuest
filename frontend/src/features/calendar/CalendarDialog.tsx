"use client";

import { CalendarPlus, Download, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/AuthProvider";
import { useUiConfig } from "@/features/ui-config/store";
import { buildIcs, type DayCode, googleCalendarUrl, WEEKDAYS } from "@/lib/calendar";

/** Atur blok "Waktu Baca" berulang di kalender kerja (Google / Outlook / Apple). */
export function CalendarDialog({ onClose, defaultTime = "12:30" }: { onClose: () => void; defaultTime?: string }) {
  const { user } = useAuth();
  const appName = useUiConfig().branding.app_name;
  const [time, setTime] = useState(defaultTime);
  const [minutes, setMinutes] = useState(user?.daily_target_minutes ?? 15);
  const [days, setDays] = useState<DayCode[]>(["MO", "TU", "WE", "TH", "FR"]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const block = {
    title: `Waktu Baca · ${appName}`,
    description: `Blok ${minutes} menit untuk membaca. Buka ${appName} lalu mulai sesi baca.`,
    time,
    minutes,
    days,
    url: typeof window === "undefined" ? undefined : `${window.location.origin}/read`,
  };
  const valid = days.length > 0 && /^\d{2}:\d{2}$/.test(time) && minutes >= 5;

  function downloadIcs() {
    const blob = new Blob([buildIcs(block)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "waktu-baca.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-title"
        className="animate-pop-in card w-full max-w-md rounded-b-none p-5 sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="calendar-title" className="text-lg font-bold">
              Blok waktu baca di kalender
            </h2>
            <p className="text-sm text-muted">Jadwal berulang agar rapat tidak menimpa waktu bacamu.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center rounded-full hover:bg-surface-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Jam mulai
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-11 rounded-lg border border-border bg-surface px-3 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Durasi (menit)
            <input
              type="number"
              inputMode="numeric"
              min={5}
              max={120}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="h-11 rounded-lg border border-border bg-surface px-3 font-normal tabular-nums"
            />
          </label>
        </div>

        <fieldset className="mt-3">
          <legend className="mb-1.5 text-sm font-semibold">Hari</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = days.includes(d.code);
              return (
                <button
                  key={d.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays((cur) => (on ? cur.filter((c) => c !== d.code) : [...cur, d.code]))}
                  className={`h-9 min-w-11 rounded-full px-3 text-sm font-semibold ${
                    on ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-2">
          <a
            href={valid ? googleCalendarUrl(block, user?.timezone ?? "Asia/Jakarta") : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!valid}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground ${
              valid ? "hover:brightness-110" : "pointer-events-none opacity-50"
            }`}
          >
            <CalendarPlus className="size-5" aria-hidden /> Tambah ke Google Calendar
          </a>
          <button
            type="button"
            disabled={!valid}
            onClick={downloadIcs}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-surface-muted font-semibold hover:brightness-95 disabled:opacity-50"
          >
            <Download className="size-5" aria-hidden /> Outlook / Apple Calendar (.ics)
          </button>
        </div>
      </div>
    </div>
  );
}
