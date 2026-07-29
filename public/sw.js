/*
 * Service Worker — Offlinebetrieb (F22).
 *
 * Bewusst von Hand geschrieben statt über eine Generator-Bibliothek: Die Regeln
 * sind hier in dreißig Zeilen lesbar, und bei einem Werkzeug, das mit Geld
 * umgeht, ist "eine alte Fassung wird stillschweigend weitergeliefert" der
 * teuerste denkbare Fehler. Das muss man selbst im Griff haben.
 *
 * Zwei Strategien, aus zwei verschiedenen Gründen:
 *
 *  - **Seiten (Navigation): erst Netz, dann Ablage.** So bekommt jeder Start die
 *    aktuelle Fassung, sobald Netz da ist. Ist keins da, kommt die letzte
 *    bekannte — das ist der Ferienhaus-ohne-Empfang-Fall.
 *
 *  - **Bauteile mit Prüfsumme im Namen: erst Ablage, dann Netz.** Diese Dateien
 *    ändern sich nie unter demselben Namen; sie dürfen also dauerhaft liegen
 *    bleiben. Eine neue Fassung bringt neue Namen und wird automatisch geholt.
 *
 * Der Anker der Adresse spielt hier keine Rolle: Er wird ohnehin nie an einen
 * Server geschickt, taucht also in keiner Anfrage auf.
 */

const SHELL = 'cc-shell-v1';
const ASSETS = 'cc-assets-v1';
const KEEP = [SHELL, ASSETS];

const SHELL_FILES = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(SHELL).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit ?? caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        // Nur vollständige, eigene Antworten ablegen.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          void caches.open(ASSETS).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
