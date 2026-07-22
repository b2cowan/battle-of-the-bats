/**
 * public/sw.js — FieldLogicHQ Service Worker
 *
 * Static file served at /sw.js by Next.js (must live in public/ for full-origin
 * registration). Handles Web Push, notification routing, AND a conservative
 * offline shell (J6-044).
 *
 * Offline-shell design — this SW is shared by BOTH installed apps (the anonymous
 * fan app and the authed staff app), so the cache is a strict ALLOWLIST of
 * anonymous, public content only. Sensitive/authed/mutation traffic is never
 * cached or offline-served. Caches are per-device (Cache API is origin+browser
 * scoped), so there is no cross-user leakage. Bump CACHE_VERSION to force a clean
 * refresh — activate() deletes any cache not in CURRENT_CACHES.
 */

/* ── Cache config ──────────────────────────────────────────────────────────── */

// v8: Tournament Seam P3 (P3-1) — signed-in (authed) navigations now fall back to the branded
//     offline shell instead of the browser's raw error page. Authed HTML is STILL never cached
//     (offline.html is a fixed generic page — no per-user data), so the shared-device PII rule is
//     intact; only the offline *fallback* is new. Bump forces a clean SW refresh.
// v7: Tournament Seam P1 (WI-2) — notificationclick now NAVIGATES an already-open tab to the
//     full deep-link target (?room= / ?gameId=) instead of only focusing it by pathname, so a
//     chat/score push lands in the right room/game even when the app is already open. Bump forces
//     the updated SW to activate.
// v6: Unified Home IA · Phase 5 (nav merge) — public tournament pages now render the
//     persistent global bar (Home·Scores·Chat·Account) + a top-tab row, and the
//     tournament bottom bar is retired. Bump forces a clean refresh so no old cached
//     tournament HTML serves the pre-merge nav. Identity stays CLIENT-resolved, so the
//     cached HTML is still anonymous (shared-device replay re-verified on this bump).
// v5: Unified Home IA — new /chat top-level route added to NEVER_CACHE_PREFIXES;
//     bump forces a clean refresh so no old shell serves a pre-/chat nav.
// v4: purge DATA_CACHE copies of /api/public/tournament-viewer — per-user identity
//     had been cached in the shared data cache (/review 2026-07-15).
// v3: unified-app Phase 0 — clean refresh of pages that referenced old
//     per-tournament/scorekeeper manifests.
const CACHE_VERSION = 'v8';
const SHELL_CACHE = 'flhq-shell-' + CACHE_VERSION; // precache + content-hashed static
const PAGES_CACHE = 'flhq-pages-' + CACHE_VERSION; // last-good public tournament pages
const DATA_CACHE  = 'flhq-data-'  + CACHE_VERSION; // last-good anonymous public API JSON
const CURRENT_CACHES = [SHELL_CACHE, PAGES_CACHE, DATA_CACHE];

const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [OFFLINE_URL, '/icons/pwa-192.png', '/icons/badge-72.png'];

/* ── Path classification ───────────────────────────────────────────────────── */

// Prefixes that must NEVER be cached/offline-served — authed, mutating, sensitive.
// Enumerated against the full app/ route tree (top-level segments that auth-gate):
// coaches, team, start, home, my, auth, platform-admin, api. ⚠ If you add a NEW
// authed top-level route, add it here — the page cache would otherwise store its
// HTML and serve it offline to the next person on a shared device.
// `/account` reflects sign-in state; `/following` is device-personal — both stay
// off the shared cache (unified-app Phase 1 consumer shell). `/discover` and
// `/scores` are anonymous/public and may be cached normally. `/chat` is a NEW
// authed-capable top-level route (Unified Home) — its member inbox lands next
// phase, but the route is denylisted from the shared cache from day one so a
// signed-in inbox can never be served offline to the next person on a device.
const NEVER_CACHE_PREFIXES = [
  '/api/', '/auth', '/platform-admin', '/home', '/dashboard', '/my',
  '/coaches', '/team', '/start', '/account', '/following', '/chat',
];
// Org sub-sections that are operator/authed surfaces (/{org}/{section}/...).
const PRIVATE_ORG_SECTIONS = ['admin', 'coaches', 'scorekeeper', 'check-in', 'official', 'league'];

// Cap the offline page cache so it can't grow unbounded within a cache version.
const MAX_PAGES = 30;

// Match a prefix on a segment boundary: trailing-slash prefixes (e.g. '/api/')
// match by prefix; bare prefixes match the exact path or a '/'-delimited descendant
// (so '/home' matches '/home' and '/home/x' but not an org slug like '/homewood').
function matchesPrefix(pathname, prefix) {
  if (prefix.charAt(prefix.length - 1) === '/') return pathname.indexOf(prefix) === 0;
  return pathname === prefix || pathname.indexOf(prefix + '/') === 0;
}

function isNeverCache(pathname) {
  for (var i = 0; i < NEVER_CACHE_PREFIXES.length; i++) {
    if (matchesPrefix(pathname, NEVER_CACHE_PREFIXES[i])) return true;
  }
  var seg = pathname.split('/').filter(Boolean);
  if (seg.length >= 2 && PRIVATE_ORG_SECTIONS.indexOf(seg[1]) !== -1) return true;
  return false;
}

// Anonymous public API JSON — the only /api/ path we cache (last-good scores).
// ⚠ tournament-viewer is carved OUT: it lives under /api/public/ for routing but
// returns PER-USER identity (the account chip's hats). Cached in the shared
// DATA_CACHE it would replay one user's identity to the next person on a shared
// device offline (/review 2026-07-15) — excluded here it falls through to the
// '/api/' never-cache rule and goes straight to network.
function isPublicApi(pathname) {
  if (pathname.indexOf('/api/public/tournament-viewer') === 0) return false;
  return pathname.indexOf('/api/public/') === 0;
}

// Content-hashed static + icons + favicon — universally safe to cache-first.
function isStaticAsset(pathname) {
  return pathname.indexOf('/_next/static/') === 0 ||
    pathname.indexOf('/icons/') === 0 ||
    pathname === '/favicon.svg' || pathname === '/favicon.ico';
}

// A public tournament page worth keeping for offline "last scores": /{org}/{tournament}[/...].
function isPublicTournamentPage(pathname) {
  if (isNeverCache(pathname)) return false;
  return pathname.split('/').filter(Boolean).length >= 2;
}

/* ── Cache strategies ──────────────────────────────────────────────────────── */

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (res) {
        if (res && res.ok && !res.redirected) cache.put(request, res.clone());
        return res;
      });
    });
  });
}

// Network-first for live public JSON: fresh scores when online (so polling never
// lags a cycle), last-good cached copy only when the network fails (offline).
function networkFirstData(request) {
  return caches.open(DATA_CACHE).then(function (cache) {
    return fetch(request).then(function (res) {
      if (res && res.ok && !res.redirected) cache.put(request, res.clone());
      return res;
    }).catch(function () {
      return cache.match(request).then(function (cached) {
        // No cached copy → behave exactly like a normal offline fetch (reject) so
        // callers' existing try/catch handles it, instead of feeding them a fake
        // 200/503 JSON body they might parse as real data.
        return cached || Response.error();
      });
    });
  });
}

// The branded offline shell (or a plain 503 if it somehow isn't cached) — the shared tail of
// every navigation's offline path.
function offlineFallback() {
  return caches.match(OFFLINE_URL).then(function (offline) {
    return offline || new Response('You are offline.', {
      status: 503, headers: { 'Content-Type': 'text/plain' },
    });
  });
}

function navigationHandler(request, pathname) {
  return fetch(request).then(function (res) {
    // Keep a copy of good, non-redirected public tournament pages for offline use.
    if (res && res.ok && !res.redirected && isPublicTournamentPage(pathname)) {
      var copy = res.clone();
      caches.open(PAGES_CACHE).then(function (cache) {
        return cache.put(request, copy).then(function () {
          // FIFO trim — Cache.keys() returns insertion order, so the front is oldest.
          return cache.keys().then(function (keys) {
            if (keys.length > MAX_PAGES) {
              return Promise.all(
                keys.slice(0, keys.length - MAX_PAGES).map(function (k) { return cache.delete(k); })
              );
            }
          });
        });
      });
    }
    return res;
  }).catch(function () {
    // Offline: prefer the last-good copy of this exact page (last scores), then
    // the branded offline fallback.
    return caches.open(PAGES_CACHE).then(function (cache) {
      return cache.match(request, { ignoreVary: true }).then(function (cachedPage) {
        return cachedPage || offlineFallback();
      });
    });
  });
}

// Authed/sensitive navigations (coaches/admin/scorekeeper/…): network-only, but on an offline
// failure serve the branded offline shell instead of the browser's raw error page. The response
// is NEVER cached (offline.html is a fixed generic page — no per-user data), so a signed-in
// screen can never be replayed to the next person on a shared device (P3-1).
function navigationOfflineOnly(request) {
  return fetch(request).then(function (res) {
    return res; // pass through live (incl. redirects) — never cached
  }).catch(offlineFallback);
}

/* ── Install / activate ────────────────────────────────────────────────────── */

self.addEventListener('install', function (event) {
  // No skipWaiting: a new SW (with this fetch handler) waits until all old-version
  // tabs are gone before activating, so it never takes over a live session and
  // serves chunk URLs that don't match the page's build. First-ever install (no
  // prior SW) still activates immediately. Bumping CACHE_VERSION + closing the app
  // once is the update path.
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) { return cache.addAll(PRECACHE_URLS); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (CURRENT_CACHES.indexOf(key) === -1) return caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* ── Fetch ─────────────────────────────────────────────────────────────────── */

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // same-origin only

  var pathname = url.pathname;

  // 1. Anonymous public API → network-first (fresh live scores; last-good offline).
  if (isPublicApi(pathname)) {
    event.respondWith(networkFirstData(request));
    return;
  }

  // 2. Content-hashed static + icons → cache-first (safe regardless of auth).
  if (isStaticAsset(pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 3. Page navigations → branded offline fallback for EVERY in-app screen.
  //    Authed/sensitive routes get the offline shell too (P3-1) but are NEVER cached (no PII
  //    stored); only public tournament pages keep a last-good copy for offline "last scores".
  if (request.mode === 'navigate') {
    event.respondWith(
      isNeverCache(pathname)
        ? navigationOfflineOnly(request)
        : navigationHandler(request, pathname),
    );
    return;
  }

  // 4. Sensitive/authed/mutation NON-navigation traffic (subresources, API) → never intercept.
  if (isNeverCache(pathname)) return;

  // 5. Everything else → default (network).
});

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
    // Branded icon from the push payload (e.g. tournament/org logo) when present,
    // else the platform icon (J6-051).
    icon:  payload.icon  || '/icons/pwa-192.png',
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
      // Normalize to a pathname so the focus branch actually fires. The old
      // strict compare pitted an absolute client.url against a path-only target,
      // so it never matched and every tap opened a duplicate window (J6-051).
      var targetPath;
      try { targetPath = new URL(targetUrl, self.location.origin).pathname; }
      catch (e) { targetPath = targetUrl; }

      // Full target href (incl. query) so a deep link (?room=, ?gameId=) can be told apart from a
      // tab already sitting on the same page but pointing elsewhere.
      var targetHref;
      try { targetHref = new URL(targetUrl, self.location.origin).href; } catch (e) { targetHref = null; }

      // A window already on this page → reuse it. If the deep-link target differs from what that
      // tab currently shows (different room/game), NAVIGATE it there first so the notification
      // actually lands where it points; otherwise just focus (no reload). Falls back to focus if
      // navigate() isn't available (uncontrolled client).
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        var clientPath;
        try { clientPath = new URL(client.url).pathname; } catch (e) { clientPath = null; }
        if (clientPath === targetPath && 'focus' in client) {
          if ('navigate' in client && targetHref && client.url !== targetHref) {
            return client.navigate(targetUrl)
              .then(function (navigated) { return (navigated || client).focus(); })
              .catch(function () { return client.focus(); });
          }
          return client.focus();
        }
      }
      // Otherwise open a new window at the deep-linked game.
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
