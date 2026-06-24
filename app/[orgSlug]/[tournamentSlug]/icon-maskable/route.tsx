/**
 * GET /{orgSlug}/{tournamentSlug}/icon-maskable
 *
 * Per-tournament MASKABLE PWA icon (512²) for Android's adaptive home-screen
 * launcher icon. Android picks a `maskable` manifest icon for the installed
 * launcher icon and crops ~10% off every edge into a circle/squircle — so the
 * branded logo is composited on a dark square WITH safe-zone padding (logo kept
 * inside the central ~56%, well within the maskable safe circle) instead of
 * full-bleed, which would clip a wordmark like "Battle of the Bats".
 *
 * The tournament manifest references this only for branded (Tournament Plus+)
 * events with a logo; every failure path degrades to the platform maskable icon
 * or a clean dark square — never a broken icon or an unhandled 500.
 */
import { ImageResponse } from 'next/og';
import { getOrganizationBySlug } from '@/lib/db';
import {
  ICON_DARK,
  originFromHeaders,
  fetchAsDataUrl,
  resolveBrandedLogo,
} from '@/lib/pwa-icon';

export const dynamic = 'force-dynamic';

const SIZE = 512;
// Logo box ≈ 55% of the canvas. A centred 280² box has its corners ~198px from
// centre — comfortably inside the maskable safe circle (radius 0.4×512 ≈ 205px),
// so even a square logo's corner artwork survives Android's circular mask. The
// tile is painted the logo's own background colour, so the surrounding padding is
// invisible regardless.
const LOGO_BOX = 280;
const ICON_HEADERS = { 'Cache-Control': 'public, max-age=600, must-revalidate' } as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> },
) {
  const { orgSlug, tournamentSlug } = await params;

  // Match manifest.webmanifest / apple-icon: unknown/canceled org → 404 (don't let
  // a CDN cache a stale icon for a dead org).
  const org = await getOrganizationBySlug(orgSlug).catch(() => null);
  if (!org || org.subscriptionStatus === 'canceled') {
    return new Response('Not found', { status: 404 });
  }

  const origin = await originFromHeaders();
  const branded = await resolveBrandedLogo(org, tournamentSlug, origin);

  if (branded) {
    // Branded: logo kept inside the maskable safe zone, on a tile painted the
    // logo's own sampled background colour. Matching the tile to the logo makes the
    // safe-zone padding invisible AND means Android's circular crop only eats the
    // matched background — never a visible frame. Falls back to the dark square for
    // transparent wordmarks.
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: branded.bg ?? ICON_DARK,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branded.src} width={LOGO_BOX} height={LOGO_BOX} style={{ objectFit: 'contain' }} alt="" />
        </div>
      ),
      { width: SIZE, height: SIZE, headers: ICON_HEADERS },
    );
  }

  // Fallback: re-serve the platform maskable icon full-bleed (it is already
  // designed with its own safe-zone padding, so no extra inset). Last resort if
  // even that can't be fetched: a plain dark square (a valid maskable surface).
  const platform = origin ? await fetchAsDataUrl(`${origin}/icons/pwa-512-maskable.png`) : null;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ICON_DARK,
        }}
      >
        {platform && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={platform} width={SIZE} height={SIZE} style={{ objectFit: 'cover' }} alt="" />
        )}
      </div>
    ),
    { width: SIZE, height: SIZE, headers: ICON_HEADERS },
  );
}
