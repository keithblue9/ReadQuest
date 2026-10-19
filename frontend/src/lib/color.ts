/** Utilitas warna kecil untuk menjaga warna merek dari Admin tetap terbaca (WCAG AA). */

const HEX = /^#[0-9a-f]{6}$/i;
const FALLBACK = "#1b2340";

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rasio kontras WCAG 2.x antara dua warna hex 6 digit. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Warna aksen merek yang aman dipakai sebagai teks/ikon di atas `surface`: digelapkan
 * (latar terang) atau dicerahkan (latar gelap) bertahap sampai kontras ≥ 4.5:1.
 */
export function brandAccent(hex: string, surface: string, min = 4.5): string {
  if (!HEX.test(hex) || !HEX.test(surface)) return FALLBACK;
  const target: Rgb = luminance(surface) > 0.4 ? [0, 0, 0] : [255, 255, 255];
  const base = toRgb(hex);
  for (let step = 0; step <= 20; step++) {
    const t = step / 20;
    const mixed = toHex(base.map((v, i) => v + (target[i] - v) * t) as Rgb);
    if (contrastRatio(mixed, surface) >= min) return mixed;
  }
  return toHex(target);
}
