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
 * The branded composited icon (icon-maskable/route.tsx) is intentionally KEPT and
 * repurposed for in-app hero / QR / share surfaces in later phases.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return Response.redirect(new URL('/manifest.json', req.url), 308);
}
