// Service Worker rescue script.
//
// Users instalados con next-pwa@5.6 tenían un SW que hace
// importScripts('/workbox-aef7c3da.js'). Tras migrar a @ducanh2912/next-pwa
// el archivo cambió a workbox-c2d14ba5.js y el viejo devolvía 404, dejando
// la PWA atrapada (browser reporta "Código de error: 5"). Este archivo
// recibe el control en el contexto del SW viejo y lo desregistra para que
// la próxima carga obtenga el SW nuevo o ninguno.

try {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => self.clients.claim());
} catch (_) {}

self.registration
  .unregister()
  .then(() => self.clients.matchAll({ type: 'window' }))
  .then((clients) => {
    clients.forEach((client) => {
      try {
        client.navigate(client.url);
      } catch (_) {}
    });
  })
  .catch(() => {});
