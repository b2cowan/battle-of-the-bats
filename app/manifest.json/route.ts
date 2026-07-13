import type { NextRequest } from 'next/server';

/**
 * app/manifest.json/route.ts — dynamic PWA web-app manifest.
 *
 * Served at /manifest.json (replaces the old static public/manifest.json) so the
 * installed app's NAME can vary per environment: dev.fieldlogichq.ca installs as
 * "FieldLogicHQ (Dev)" and fieldlogichq.ca as "FieldLogicHQ".
 *
 * Why this is needed: Android keys PWA identity on (origin + manifest `id`), so
 * the two hosts are ALREADY separate installable apps — installing one never
 * overwrites the other. But both used to serve the identical name/icon, so they
 * were indistinguishable on the home screen. Varying the name (and address-bar
 * tint) by host makes them tell-apart-able while keeping one app per origin.
 *
 * There is still ONE FieldLogicHQ app per origin (id/scope '/', unified-app
 * Phase 0). Reading the Host header makes this route dynamic, which is correct —
 * the manifest must reflect the origin it was fetched from and never be cached
 * across hosts.
 */
export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const isDev = host.startsWith('dev.') || host.startsWith('localhost');

  return Response.json(
    {
      name: isDev ? 'FieldLogicHQ (Dev)' : 'FieldLogicHQ',
      short_name: isDev ? 'FLHQ Dev' : 'FieldLogicHQ',
      description:
        'The all-in-one platform for Canadian sports organizations — tournaments, house leagues, rep teams, and accounting in one place.',
      id: '/',
      start_url: '/?source=pwa',
      scope: '/',
      display: 'standalone',
      background_color: '#0a0a0f',
      // Dev gets a distinct address-bar / splash tint so it's obvious which app
      // you're in; prod keeps the near-black brand tint.
      theme_color: isDev ? '#3a0f2f' : '#0a0a0f',
      icons: [
        { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
