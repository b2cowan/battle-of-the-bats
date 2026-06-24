/**
 * GET /{orgSlug}/{tournamentSlug}/manifest.webmanifest
 *
 * Per-tournament PWA manifest. Makes an installed home-screen app open straight
 * to THIS tournament (scoped start_url + unique id so each tournament installs as
 * its own icon) and branded with the org's name/logo when the plan allows. The
 * tournament layout points <link rel="manifest"> here via generateMetadata.
 *
 * Falls back to the platform name/icons for free-tier (no advanced branding).
 */
import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';

export const dynamic = 'force-dynamic';

// Any-purpose platform PNGs — kept as installability fallbacks under every event.
const PLATFORM_ICONS_ANY = [
  { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
];
// Free-tier set: the any-purpose PNGs + the platform MASKABLE icon (Android's
// adaptive launcher icon). Branded events deliberately omit the platform maskable
// (see below) so it can't win the launcher slot over the tournament logo.
const PLATFORM_ICONS = [
  ...PLATFORM_ICONS_ANY,
  { src: '/icons/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> },
) {
  const { orgSlug, tournamentSlug } = await params;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.subscriptionStatus === 'canceled') {
    return new Response('Not found', { status: 404 });
  }
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) {
    return new Response('Not found', { status: 404 });
  }

  const base = `/${orgSlug}/${tournamentSlug}`;
  const advanced = canUseAdvancedTournamentBranding(org);
  const logo = advanced ? tournament.logoUrl ?? org.logoUrl ?? null : null;

  // Branded events: serve the composited per-tournament icon (logo on a tile
  // painted the logo's own background colour) as a single `any maskable` entry —
  // Android uses it as the maskable adaptive launcher icon, other contexts use it
  // un-masked, and the one entry avoids a duplicate fetch of the (DB + compositing)
  // route. We must declare a BRANDED maskable here and NOT include the platform
  // maskable — Android prefers a maskable icon for the installed home-screen
  // launcher, so leaving the FLHQ maskable in the set made every branded install
  // revert to the FieldLogicHQ logo. The any-purpose platform PNGs remain only as
  // installability fallbacks. Free-tier keeps the full platform set (incl. maskable).
  const icons = logo
    ? [
        { src: `${base}/icon-maskable`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ...PLATFORM_ICONS_ANY,
      ]
    : PLATFORM_ICONS;

  // Launcher label under the icon: the organizer's custom app name if set, else the
  // tournament name truncated to ~12 chars (manifest short_name convention). The full
  // `name` below stays the tournament name (install prompt / app switcher / splash).
  // Plus-gated like the logo/theme — a downgraded org reverts to the derived label.
  const customAppName = advanced ? tournament.appName?.trim() || null : null;
  const shortName = customAppName
    ?? (tournament.name.length > 12 ? tournament.name.slice(0, 12).trim() : tournament.name);

  const manifest = {
    name: tournament.name,
    short_name: shortName,
    description: `Live schedule, scores, and standings for ${tournament.name}, hosted by ${org.name}.`,
    // Unique id + scoped start_url so each tournament installs as its own icon and
    // launches straight into that tournament — never mixed with other events.
    id: base,
    start_url: `${base}?pwa=1`,
    scope: base,
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    orientation: 'any',
    icons,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      // Names/logos change rarely; let browsers/CDN cache briefly.
      'Cache-Control': 'public, max-age=600, must-revalidate',
    },
  });
}
