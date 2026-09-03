const CACHE = "present";

const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./selection.js",
  "./pieces.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Stale-while-revalidate: instant and offline-capable, but a change to the site
// lands on the next open without any cache-busting.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || cache.match("./index.html");
    })()
  );
});

self.addEventListener("push", (event) => {
  let body = "";
  try {
    body = event.data ? event.data.json().body : "";
  } catch {
    body = event.data ? event.data.text() : "";
  }
  if (!body) return;
  event.waitUntil(
    self.registration.showNotification("Present", {
      body,
      icon: "./icons/apple-touch-icon.png",
      badge: "./icons/apple-touch-icon.png",
      tag: "present",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL("./", self.location.origin + self.location.pathname).href;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "notification-click" });
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});
