import type { NextConfig } from "next";

// Browser hanya berbicara ke origin Next.js; /api/* diteruskan ke FastAPI.
// Dengan begitu cookie refresh token (SameSite=Strict, httpOnly) bekerja tanpa CORS.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async headers() {
    return [
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
