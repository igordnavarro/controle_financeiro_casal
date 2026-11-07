// Service worker: deixa o app abrir offline e instalável no celular/tablet.
// Os dados offline ficam no cache do próprio Firestore; aqui guardamos só os arquivos do app.
const VERSAO = "fc-v3";
const ARQUIVOS = [
  "./", "index.html", "css/styles.css", "js/app.js", "js/store.js", "js/config.js", "js/importer.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"
];
const CDNS = ["www.gstatic.com", "cdn.jsdelivr.net", "cdn.sheetjs.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // rede primeiro (pega atualizações do GitHub), cache se offline
    e.respondWith(fetch(req).then((r) => { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); return r; }).catch(() => caches.match(req).then((r) => r || caches.match("index.html"))));
  } else if (CDNS.includes(url.hostname) && /\.js$/.test(url.pathname)) {
    // bibliotecas versionadas: cache primeiro
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((resp) => { const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); return resp; })));
  }
});
