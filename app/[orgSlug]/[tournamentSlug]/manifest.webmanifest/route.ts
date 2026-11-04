/**
 * GET /{orgSlug}/{tournamentSlug}/manifest.webmanifest
 *
 * LEGACY SHIM (unified-app Phase 0). Tournaments no longer install as their own
 * PWA identity — there is ONE FieldLogicHQ app (id/scope '/', see public/manifest.json).
 * The tournament layout now points <link rel="manifest"> at /manifest.json directly,
 * so this route is only hit by older installs re-fetching their original manifest
 * URL; we redirect them to the unified manifest. (An id change never migrates an
 * existing install in place, so those old icons stay frozen either way — this just
 * stops serving a distinct per-event id/scope.)
 *
 * The per-tournament branded icons (apple-icon.tsx, icon-maskable/route.tsx) are gone:
 * the home-screen icon is always FieldLogicHQ's (Public tournament pages Stage 8 Part 1,
 * owner ruling 2026-11-03).
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return Response.redirect(new URL('/manifest.json', req.url), 308);
}
