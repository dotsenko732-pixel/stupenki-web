// Офлайн-режим при запуске через сервер (server.bat) и на сайте (телефон). По file:// браузер его не запускает.
// Сначала сеть: после обновления сразу видна новая версия. Нет сети — отдаём из кэша.
// Сеть есть, но не тянет (мобильный интернет за городом): ждём не дольше 4 секунд и открываем
// из кэша, а свежий файл докачивается в кэш и будет виден при следующем открытии.
// Новое имя кэша при каждом изменении этого файла не нужно: кэш обновляется при каждом открытии.
const CACHE = 'stupenki-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const WAIT_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// Старые кэши (в том числе stupenki-v1 от прежней версии, где файлы не обновлялись) — удаляем
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const fresh = fetch(e.request).then(r => {
    if (!r.ok) return r;
    const copy = r.clone();
    return caches.open(CACHE).then(c => c.put(e.request, copy)).then(() => r);
  });
  const cached = () => caches.match(e.request, { ignoreSearch: true })
    .then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
  // Медленно — из кэша; в кэше нет — ждём сеть дальше
  const slow = new Promise(done => setTimeout(done, WAIT_MS)).then(cached).then(r => r || fresh);
  e.respondWith(Promise.race([fresh.catch(cached), slow]).then(r => r || Response.error()));
  e.waitUntil(fresh.catch(() => {}));      // свежий файл дописывается в кэш, даже если уже ответили из кэша
});
