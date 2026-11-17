// Programma di servizio di PongFu. Per ora non tiene copie delle pagine (i dati devono essere sempre aggiornati):
// serve a rendere il sito installabile e, più avanti, a ricevere le notifiche.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
