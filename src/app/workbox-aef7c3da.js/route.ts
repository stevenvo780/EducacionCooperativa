import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

// Rescue script para SWs viejos de next-pwa@5.6 que hacen
// importScripts('/workbox-aef7c3da.js'). Tras la migración a
// @ducanh2912/next-pwa el archivo cambió de hash y los browsers ya con la
// PWA instalada quedaron atrapados (browser reporta "Código de error 5").
// Servimos un script que se ejecuta dentro del SW viejo y lo desregistra.

const RESCUE_SCRIPT = `try {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => self.clients.claim());
} catch (_) {}

self.registration
  .unregister()
  .then(() => self.clients.matchAll({ type: 'window' }))
  .then((clients) => {
    clients.forEach((client) => {
      try { client.navigate(client.url); } catch (_) {}
    });
  })
  .catch(() => {});
`;

export async function GET() {
  return new NextResponse(RESCUE_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, must-revalidate'
    }
  });
}
