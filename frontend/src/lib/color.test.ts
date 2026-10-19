import { describe, expect, it } from "vitest";

import { brandAccent, contrastRatio } from "./color";

describe("contrastRatio", () => {
  it("menghitung rasio WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#1B2340", "#FFFFFF")).toBeGreaterThan(14);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("brandAccent", () => {
  it("membiarkan warna yang sudah cukup kontras", () => {
    expect(brandAccent("#1B2340", "#FFFFFF")).toBe("#1b2340");
  });

  it("menggelapkan warna terang di latar terang sampai ≥4.5:1", () => {
    const out = brandAccent("#FFE600", "#FFFFFF");
    expect(contrastRatio(out, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("mencerahkan warna gelap di latar gelap sampai ≥4.5:1", () => {
    const out = brandAccent("#1B2340", "#1A2140");
    expect(contrastRatio(out, "#1A2140")).toBeGreaterThanOrEqual(4.5);
  });

  it("memakai fallback untuk hex tidak valid", () => {
    expect(brandAccent("merah", "#FFFFFF")).toBe("#1b2340");
    expect(brandAccent("#abc", "#FFFFFF")).toBe("#1b2340");
  });
});
