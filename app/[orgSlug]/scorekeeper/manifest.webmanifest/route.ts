/**
 * GET /{orgSlug}/scorekeeper/manifest.webmanifest
 *
 * LEGACY SHIM (unified-app Phase 0). The scorekeeper surface no longer installs as
 * its own PWA identity — there is ONE FieldLogicHQ app (id/scope '/', see
 * public/manifest.json). The scorekeeper layout now points <link rel="manifest">
 * at /manifest.json directly; this route is only hit by older scorekeeper installs
 * re-fetching their original manifest URL, so we redirect them to the unified manifest.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return Response.redirect(new URL('/manifest.json', req.url), 308);
}
