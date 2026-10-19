import { describe, expect, it } from "vitest";

import { brandAccent, contrastRatio } from "./color";

describe("contrastRatio", () => {
  it("menghitung rasio WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#1B2340", "#FFFFFF")).toBeGreaterThan(14);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("token Stabilo (harus sama dengan globals.css)", () => {
  const LIGHT = { surface: "#ffffff", paper: "#f6f7f9", ink: "#1b2340", muted: "#555c72", line: "#e1e4eb", highlight: "#ffe066", rating: "#946200", leaf: "#2a6e50" };
  const DARK = { surface: "#1a2140", paper: "#121830", ink: "#eceef6", muted: "#a9afc6", line: "#2a3256", highlight: "#f5d547", rating: "#f5c84c", leaf: "#6ccb9c" };

  it("teks ≥4.5:1 di permukaan dan kertas, kedua tema", () => {
    for (const t of [LIGHT, DARK]) {
      for (const fg of [t.ink, t.muted, t.rating, t.leaf]) {
        expect(contrastRatio(fg, t.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(fg, t.paper)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("penanda progres ≥3:1 terhadap track (WCAG 1.4.11)", () => {
    // Terang: stabilo terlalu pucat di atas track, jadi ujung isian bertinta yang menandai posisi.
    expect(contrastRatio(LIGHT.highlight, LIGHT.line)).toBeLessThan(3);
    expect(contrastRatio(LIGHT.ink, LIGHT.line)).toBeGreaterThanOrEqual(3);
    // Gelap: stabilo sendiri sudah cukup kontras.
    expect(contrastRatio(DARK.highlight, DARK.line)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(LIGHT.leaf, LIGHT.line)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(DARK.leaf, DARK.line)).toBeGreaterThanOrEqual(3);
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
