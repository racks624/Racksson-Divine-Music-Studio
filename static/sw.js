// static/sw.js — Racksson PWA service worker (cache app shell + audio samples and manifest)
const CACHE_NAME = 'racksson-cache-v1';
const PRECACHE = [
   '/',
   '/index.html',
   '/studio_pro',
   '/static/css/style.css',
   '/static/css/themes.css',
   '/static/js/main.js',
   '/static/js/studio.js',
   '/manifest.webmanifest'
   // add more assets as needed
];

// lightweight install/caching
self.addEventListener('install', (evt) => {
   self.skipWaiting();
   evt.waitUntil(
      caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
   );
});

self.addEventListener('activate', (evt) => {
   evt.waitUntil(
      caches.keys().then(keys => Promise.all(
         keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
   );
   self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
   // always try network first for API endpoints, else cache-first
   const url = new URL(evt.request.url);
   if (url.pathname.startsWith('/api/')) {
      evt.respondWith(fetch(evt.request).catch(() => caches.match('/')));
      return;
   }
   evt.respondWith(caches.match(evt.request).then(resp => resp || fetch(evt.request).then(r => {
      // optionally cache new resources
      if (evt.request.method === 'GET' && r && r.type === 'basic') {
         caches.open(CACHE_NAME).then(cache => cache.put(evt.request, r.clone()));
      }
      return r;
   }).catch(() => caches.match('/'))));
});