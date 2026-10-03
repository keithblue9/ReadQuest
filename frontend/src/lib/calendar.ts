/**
 * Blok "Waktu Baca" berulang di kalender kerja (Google Calendar, Outlook, Apple Calendar).
 * Dibuat sepenuhnya di perangkat: tautan Google Calendar + berkas .ics standar (RFC 5545).
 */

export const WEEKDAYS = [
  { code: "MO", label: "Sen" },
  { code: "TU", label: "Sel" },
  { code: "WE", label: "Rab" },
  { code: "TH", label: "Kam" },
  { code: "FR", label: "Jum" },
  { code: "SA", label: "Sab" },
  { code: "SU", label: "Min" },
] as const;

export type DayCode = (typeof WEEKDAYS)[number]["code"];

export type ReadingBlock = {
  title: string;
  description: string;
  time: string; // HH:MM waktu lokal
  minutes: number;
  days: DayCode[];
  url?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Tanggal pertama (mulai hari ini) yang jatuh di salah satu hari terpilih. */
export function firstOccurrence(from: Date, days: DayCode[]): Date {
  const order: DayCode[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 7; i++) {
    if (days.includes(order[d.getDay()])) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function stamp(date: Date, time: string, addMinutes = 0): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m + addMinutes);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/** Escape teks sesuai RFC 5545. */
function esc(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function buildIcs(block: ReadingBlock, now = new Date(), uid = `${now.getTime()}@readquest`): string {
  const start = firstOccurrence(now, block.days);
  const utc = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ReadQuest//Waktu Baca//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utc}`,
    // Waktu "mengambang" (tanpa zona): mengikuti zona waktu perangkat/kalender pengguna.
    `DTSTART:${stamp(start, block.time)}`,
    `DTEND:${stamp(start, block.time, block.minutes)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${block.days.join(",")}`,
    `SUMMARY:${esc(block.title)}`,
    `DESCRIPTION:${esc(block.description + (block.url ? `\n${block.url}` : ""))}`,
    ...(block.url ? [`URL:${block.url}`] : []),
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(block.title)}`,
    "TRIGGER:-PT5M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

export function googleCalendarUrl(block: ReadingBlock, timezone: string, now = new Date()): string {
  const start = firstOccurrence(now, block.days);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: block.title,
    details: block.description + (block.url ? `\n${block.url}` : ""),
    dates: `${stamp(start, block.time)}/${stamp(start, block.time, block.minutes)}`,
    ctz: timezone,
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${block.days.join(",")}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
