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

const PLATFORM_ICONS = [
  { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
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

  // Branded logo (when present) is preferred; platform icons stay for installability
  // (Android requires a 192 + 512 + maskable, which the logo alone may not satisfy).
  const icons = logo
    ? [{ src: logo, sizes: 'any', purpose: 'any' }, ...PLATFORM_ICONS]
    : PLATFORM_ICONS;

  const shortName = tournament.name.length > 12 ? tournament.name.slice(0, 12).trim() : tournament.name;

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
