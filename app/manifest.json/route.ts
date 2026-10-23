import type { NextRequest } from 'next/server';
import { SITE_DESCRIPTION } from '@/lib/marketing-metadata';
import { THEME_COLORS } from '@/lib/user-theme';

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
      // The site's one description (words doc item 1), shared with the root layout so the two cannot drift.
      description: SITE_DESCRIPTION,
      id: '/',
      start_url: '/?source=pwa',
      scope: '/',
      display: 'standalone',
      // The launch screen and the bar are the paper (S4 Part B: off the old near-black). Dev gets a distinct
      // address-bar / splash tint so it's obvious which app you're in.
      background_color: THEME_COLORS.warm,
      theme_color: isDev ? '#3a0f2f' : THEME_COLORS.warm,
      // The new mark (lib/brand-mark.ts, drawn by scripts/generate-brand-icons.mjs). "any" and maskable are separate
      // files: the maskable one keeps the glyph inside the safe circle.
      icons: [
        { src: '/icons/fl-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/fl-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/fl-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
