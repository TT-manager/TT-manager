// Programma di servizio di PongFu. Non tiene copie delle pagine (i dati devono essere sempre aggiornati):
// rende il sito installabile, riceve le notifiche push e, senza rete, mostra una pagina «Nessuna connessione».
const OFFLINE_CACHE = "pongfu-offline-v2";
const OFFLINE_FILES = ["/offline.html", "/logo-scuro.svg"];

self.addEventListener("install", (event) => {
  // Si tengono in memoria solo la pagina senza connessione e il suo logo; se non riesce, l'installazione procede lo stesso.
  event.waitUntil(caches.open(OFFLINE_CACHE).then((c) => c.addAll(OFFLINE_FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()),
));

// Aprendo una pagina senza rete: al posto dell'errore del telefono, la pagina di PongFu (con il suo logo).
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || Response.error()));
  } else if (request.method === "GET" && OFFLINE_FILES.includes(new URL(request.url).pathname)) {
    // Il logo: prima dalla memoria (serve anche quando la rete non c'è), altrimenti dalla rete.
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});

// Arriva una notifica dal server: si mostra con titolo, testo e la pagina da aprire.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "PongFu", {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag,
    data: { url: data.url || "/" },
  }));
});

// Tocco sulla notifica: si apre (o si porta davanti) l'app sulla pagina giusta.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { await c.focus(); if ("navigate" in c) await c.navigate(url).catch(() => {}); return; }
    }
    await self.clients.openWindow(url);
  })());
});
