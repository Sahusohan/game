const CACHE_NAME = "our-little-world-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/firebase.js",
  "./js/multiplayer.js",
  "./js/chat.js",
  "./js/world.js",
  "./js/ui.js",
  "./js/game.js",
  "./manifest.webmanifest",
  "./assets/images/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => caches.match("./index.html"))
      );
    })
  );
});
