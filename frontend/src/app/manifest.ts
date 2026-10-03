import type { MetadataRoute } from "next";

// Nama aplikasi diatur Admin; manifest dibangun ulang paling lama tiap 5 menit.
export const revalidate = 300;

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

async function branding(): Promise<{ app_name: string; tagline: string } | null> {
  try {
    const response = await fetch(`${apiTarget}/api/v1/ui-config`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate },
    });
    return response.ok ? (await response.json()).branding : null;
  } catch {
    return null; // backend belum siap (mis. saat build): pakai nama bawaan
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await branding();
  const name = brand?.app_name || "ReadQuest";
  return {
    id: "/",
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: brand?.tagline || "Komunitas baca buku bergamifikasi untuk tim.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f0f2f5",
    theme_color: "#2563eb",
    lang: "id",
    dir: "ltr",
    categories: ["books", "education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Konten ikon berada di zona aman 80% sehingga bisa dipakai sebagai maskable.
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mulai membaca", short_name: "Baca", url: "/read", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Feed tim", short_name: "Feed", url: "/feed", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Peringkat", short_name: "Peringkat", url: "/leaderboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
