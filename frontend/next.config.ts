import type { NextConfig } from "next";

// Browser hanya berbicara ke origin Next.js; /api/* diteruskan ke FastAPI.
// Dengan begitu cookie refresh token (SameSite=Strict, httpOnly) bekerja tanpa CORS.
// Catatan: nilai ini dibaca saat `next build` (rewrites ikut tersimpan di hasil build).
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";
const isDev = process.env.NODE_ENV === "development";

// CSP tanpa nonce (panduan resmi Next.js) agar halaman tetap statis. 'unsafe-inline' untuk script
// dibutuhkan oleh payload RSC & skrip tema; semua sumber lain dibatasi ke origin sendiri.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kamera dipakai lewat <input capture> (tidak butuh izin); API sensor lain dimatikan.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Bundel server mandiri hanya untuk image Docker (NEXT_OUTPUT=standalone di frontend/Dockerfile);
  // pengembangan lokal tetap memakai `next start`.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Service worker selalu diambil versi terbaru.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiTarget}/api/:path*` },
      // Reading Room (WebSocket) juga lewat origin yang sama.
      { source: "/ws/:path*", destination: `${apiTarget}/ws/:path*` },
    ];
  },
};

export default nextConfig;
