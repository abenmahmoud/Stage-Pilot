const CACHE_NAME = "blaise-cendrars-connect-v9";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/lycee-blaise-logo.png",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("blaise-cendrars-connect-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  const cacheableDestination = url.pathname.startsWith("/assets/") && ["script", "style", "font"].includes(event.request.destination);
  if (!cacheableDestination && !APP_SHELL.includes(url.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
            await cache.put(event.request, copy);
            const keys = await cache.keys();
            if (keys.length > 100) await Promise.all(keys.filter(key => !APP_SHELL.includes(new URL(key.url).pathname)).slice(0, keys.length - 100).map(key => cache.delete(key)));
          }));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("push", event => {
  let notice;
  try { notice = event.data?.json(); } catch { notice = null; }
  const agent = notice?.destination === "/?view=agent";
  event.waitUntil(self.registration.showNotification("Lycée Blaise Cendrars", {
    body: agent ? "Une demande attend votre attention dans votre espace service." : "Une réponse ou une mise à jour est disponible dans Mes demandes.",
    icon: "/pwa-icon-192.png", badge: "/pwa-icon-192.png",
    tag: agent ? "lycee-service" : "lycee-demandes", renotify: false,
    data: { destination: agent ? "/?view=agent" : "/?view=requests" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = event.notification.data?.destination === "/?view=agent" ? "/?view=agent" : "/?view=requests";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.navigate(destination);
        return existing.focus();
      }
      return self.clients.openWindow(destination);
    })
  );
});
