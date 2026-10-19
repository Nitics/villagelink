// Offline support. Pages and data load fresh when there is signal; the saved copy is used only offline.
const CACHE = "villagelink-v2";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const networkFirst = (req) =>
  fetch(req).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Only this site's own files. The database (Supabase) and fonts are never cached here.
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (e.request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
    e.respondWith(networkFirst(e.request));
    return;
  }
  // Icons and the manifest rarely change: saved copy first, saves data.
  e.respondWith(caches.match(e.request).then((hit) => hit || networkFirst(e.request)));
});
