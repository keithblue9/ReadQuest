import { describe, expect, it } from "vitest";

import { DEFAULT_TEXTS, formatText, splitBrandName, textGroup } from "./texts";

describe("formatText", () => {
  it("mengisi placeholder yang dikenal dan membiarkan sisanya", () => {
    expect(formatText("© {year} {app}", { year: 2026, app: "BacaYuk" })).toBe("© 2026 BacaYuk");
    expect(formatText("Halo {nama}", {})).toBe("Halo {nama}");
  });
});

describe("splitBrandName", () => {
  it("memisahkan nama untuk logo dua warna", () => {
    expect(splitBrandName("ReadQuest")).toEqual(["Read", "Quest"]);
    expect(splitBrandName("Baca Bareng Yuk")).toEqual(["Baca Bareng ", "Yuk"]);
    expect(splitBrandName("pustaka")).toEqual(["pustaka", ""]);
    expect(splitBrandName("ABC")).toEqual(["ABC", ""]);
  });
});

describe("DEFAULT_TEXTS", () => {
  it("memakai format kunci yang diterima server", () => {
    for (const [key, value] of Object.entries(DEFAULT_TEXTS)) {
      expect(key).toMatch(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/);
      expect(key.length).toBeLessThanOrEqual(80);
      expect(value.length).toBeLessThanOrEqual(500);
      expect(textGroup(key)).not.toBe("");
    }
  });
});
