/**
 * public/sw.js — FieldLogicHQ Service Worker
 *
 * Static file served at /sw.js by Next.js.
 * Handles Web Push notifications and notification click routing.
 *
 * Do NOT move this file into app/ — it must live in public/ so Next.js
 * serves it at the root scope (/sw.js), giving it full-origin registration.
 */

/* ── Push event ────────────────────────────────────────────────────────────── */

self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Fallback for plain-text payloads
    payload = { title: event.data.text() };
  }

  const title   = payload.title   || 'FieldLogicHQ';
  const options = {
    body:  payload.body  || '',
    icon:  '/icons/pwa-192.png',
    badge: '/icons/badge-72.png',
    data:  { url: payload.link || '/' },
    // Show notification even if the app tab is focused
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ── Notification click ─────────────────────────────────────────────────────── */

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      // If a window with this URL is already open, focus it
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

/* ── Activation ──────────────────────────────────────────────────────────────
   Claim all clients immediately so the SW is active without a page reload.
*/

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});
