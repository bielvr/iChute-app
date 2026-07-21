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
// --- RECEBE A NOTIFICAÇÃO E EXIBE NA BARRA ---
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png', // Ícone pequeno na barra de status
      vibrate: [100, 50, 100],
      data: {
        url: '/' // Ou a página de palpites que tu quiser abrir
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (err) {
    console.error('Erro ao renderizar Push:', err);
  }
});

// --- CLIQUE NA NOTIFICAÇÃO (Abre o app) ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se o app já estiver aberto em uma aba, foca nela
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Se tiver fechado, abre a aba no app
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});
