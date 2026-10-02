import { describe, expect, it } from "vitest";

import { formatDuration, noteStats, tokenize } from "./words";

describe("tokenize", () => {
  it("sejalan dengan aturan backend", () => {
    expect(tokenize("Don't stop—baca 15 menit, ya!")).toEqual([
      "don't",
      "stop",
      "baca",
      "15",
      "menit",
      "ya",
    ]);
  });
});

describe("noteStats", () => {
  it("menghitung kata & rasio unik", () => {
    expect(noteStats("bagus bagus sekali")).toEqual({ wordCount: 3, uniqueRatio: 2 / 3 });
    expect(noteStats("   ")).toEqual({ wordCount: 0, uniqueRatio: 0 });
  });
});

describe("formatDuration", () => {
  it("memformat menit:detik dan jam", () => {
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});
