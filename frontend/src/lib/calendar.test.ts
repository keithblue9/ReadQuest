import { describe, expect, it } from "vitest";

import { buildIcs, firstOccurrence, googleCalendarUrl } from "./calendar";

const block = {
  title: "Waktu Baca, ReadQuest",
  description: "Baca 15 menit; catat insight",
  time: "12:30",
  minutes: 15,
  days: ["MO", "WE", "FR"] as ("MO" | "WE" | "FR")[],
  url: "https://contoh.app/read",
};

describe("firstOccurrence", () => {
  it("mencari hari terpilih berikutnya", () => {
    // 2026-10-03 = Sabtu → Senin 5 Oktober
    const d = firstOccurrence(new Date(2026, 9, 3, 10), ["MO"]);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 5]);
  });
});

describe("buildIcs", () => {
  it("membuat event berulang mingguan dengan pengingat", () => {
    const ics = buildIcs(block, new Date(2026, 9, 3, 10), "uid-1");
    expect(ics).toContain("DTSTART:20261005T123000\r\n");
    expect(ics).toContain("DTEND:20261005T124500\r\n");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\n");
    expect(ics).toContain("SUMMARY:Waktu Baca\\, ReadQuest");
    expect(ics).toContain("DESCRIPTION:Baca 15 menit\; catat insight\\nhttps://contoh.app/read");
    expect(ics).toContain("TRIGGER:-PT5M");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});

describe("googleCalendarUrl", () => {
  it("menyertakan zona waktu & aturan berulang", () => {
    const url = new URL(googleCalendarUrl(block, "Asia/Jakarta", new Date(2026, 9, 3, 10)));
    expect(url.searchParams.get("ctz")).toBe("Asia/Jakarta");
    expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(url.searchParams.get("dates")).toBe("20261005T123000/20261005T124500");
  });
});
