import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ReadQuest",
    short_name: "ReadQuest",
    description: "Komunitas baca buku bergamifikasi untuk tim.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff8f0",
    theme_color: "#6c4df6",
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
