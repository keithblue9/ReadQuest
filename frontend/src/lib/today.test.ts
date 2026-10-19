import { describe, expect, it } from "vitest";

import { firstName, todayHeadline } from "./today";

describe("firstName", () => {
  it("mengambil kata pertama nama", () => {
    expect(firstName("Dewi Lestari Putri")).toBe("Dewi");
    expect(firstName("  Rina  ")).toBe("Rina");
    expect(firstName("")).toBe("");
  });
});

describe("todayHeadline", () => {
  it("belum mulai", () => {
    expect(todayHeadline({ minutes: 0, target: 15, name: "Rina Pratiwi" })).toBe(
      "Mulai 15 menit pertamamu hari ini, Rina",
    );
  });

  it("sedang berjalan", () => {
    expect(todayHeadline({ minutes: 6, target: 15, name: "Rina Pratiwi" })).toBe(
      "9 menit lagi untuk target hari ini, Rina",
    );
  });

  it("tercapai atau lebih", () => {
    expect(todayHeadline({ minutes: 15, target: 15, name: "Rina" })).toBe("Target hari ini tercapai, Rina");
    expect(todayHeadline({ minutes: 40, target: 15, name: "Rina" })).toBe("Target hari ini tercapai, Rina");
  });

  it("mode mingguan", () => {
    expect(todayHeadline({ minutes: 30, target: 75, name: "Rina", weekly: true })).toBe(
      "45 menit lagi untuk target minggu ini, Rina",
    );
  });

  it("tanpa nama tidak menyisakan koma", () => {
    expect(todayHeadline({ minutes: 6, target: 15, name: "" })).toBe("9 menit lagi untuk target hari ini");
  });
});
