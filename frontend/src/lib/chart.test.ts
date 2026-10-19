import { describe, expect, it } from "vitest";

import { niceMax } from "./chart";

describe("niceMax", () => {
  it("membulatkan ke atas ke 1/2/5 × 10^n", () => {
    expect(niceMax(201)).toBe(250);
    expect(niceMax(87)).toBe(100);
    expect(niceMax(14)).toBe(15);
    expect(niceMax(5)).toBe(5);
    expect(niceMax(1)).toBe(1);
  });

  it("nilai nol/negatif memberi skala minimum 1", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-3)).toBe(1);
  });
});
