// public/sw.js
const CACHE_NAME = 'ichute-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Mantém as requisições fluindo normalmente online
  e.respondWith(fetch(e.request));
});