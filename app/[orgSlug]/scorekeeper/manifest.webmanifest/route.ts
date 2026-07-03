/**
 * GET /{orgSlug}/scorekeeper/manifest.webmanifest
 *
 * Per-org PWA manifest for the scorekeeper field surface (J8-004). The shell promoted
 * "Install FieldLogicHQ" but the ROOT manifest's start_url is /home — so the installed icon
 * opened the generic context-card hub, not the scoring screen. This scopes start_url to the
 * scorekeeper path so a volunteer's installed icon launches straight into scoring.
 *
 * Falls back to platform icons; org name (when present) labels the installed app.
 */
import { getOrganizationBySlug } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PLATFORM_ICONS = [
  { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return new Response('Not found', { status: 404 });

  const base = `/${orgSlug}/scorekeeper`;
  const label = `${org.name} Scorekeeper`;

  const manifest = {
    name: label,
    short_name: 'Scorekeeper',
    description: `Submit game scores for ${org.name}.`,
    // Scoped id + start_url so the installed icon opens the scoring screen, not /home.
    id: base,
    start_url: `${base}?pwa=1`,
    scope: base,
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: PLATFORM_ICONS,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=600, must-revalidate',
    },
  });
}
