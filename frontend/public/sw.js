/* ReadQuest service worker: cache aset & fallback offline, Web Push, klik notifikasi.
 * Ditulis manual (tanpa build step). Naikkan VERSION setiap kali file ini berubah. */

const VERSION = "v2";
const STATIC_CACHE = `rq-static-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

// Precache halaman offline beserta aset JS/CSS yang dirujuknya agar bisa tampil tanpa jaringan.
async function precache() {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(PRECACHE);
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!response.ok) return;
  const html = await response.clone().text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
  await cache.put(OFFLINE_URL, response);
  await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  // Tidak langsung skipWaiting: versi baru menunggu sampai pengguna memilih "Muat ulang"
  // (lihat ServiceWorkerRegister), kecuali belum ada versi lama yang aktif.
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("rq-") && k !== STATIC_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    // Halaman berisi data pribadi tidak di-cache; saat offline tampilkan halaman offline.
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Data API (pribadi & selalu terbaru) dan WebSocket tidak pernah di-cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  // Aset build Next.js ber-hash (immutable) & ikon: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ReadQuest", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "ReadQuest";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.focus();
          return client.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
