/**
 * app/[orgSlug]/[tournamentSlug]/apple-icon.tsx
 *
 * Per-tournament Apple touch icon (J6-047). iOS ignores the web manifest's icons
 * and reads only <link rel="apple-touch-icon"> — which the root layout hard-codes
 * to the platform PNG, so until now every iPhone home-screen install of a branded
 * Plus event got the generic FieldLogicHQ icon while Android got the logo.
 *
 * This Next.js metadata file-convention route emits a sized <link rel="apple-touch-icon"
 * sizes="180x180"> for tournament pages, which iOS prefers over the root's
 * size-less default. On Tournament Plus+ (advanced branding) it composites the
 * tournament/org logo on a dark square; otherwise it re-serves the clean platform
 * icon. Every failure path degrades to the platform/lettermark default — never a
 * broken icon or an unhandled 500.
 */
import { ImageResponse } from 'next/og';
import { getOrganizationBySlug } from '@/lib/db';
import {
  ICON_DARK as DARK,
  originFromHeaders,
  fetchAsDataUrl,
  resolveBrandedLogo,
} from '@/lib/pwa-icon';

export const dynamic = 'force-dynamic';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

function letterMark() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: DARK,
          color: '#fff',
          fontSize: 96,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        F
      </div>
    ),
    { ...size },
  );
}

export default async function AppleIcon({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;

  // Match manifest.webmanifest: unknown/canceled org → 404 (don't let a CDN cache a
  // stale icon for a dead org).
  const org = await getOrganizationBySlug(orgSlug).catch(() => null);
  if (!org || org.subscriptionStatus === 'canceled') {
    return new Response('Not found', { status: 404 });
  }

  const origin = await originFromHeaders();

  // Resolve the branded logo only when the plan allows advanced branding (shared
  // with the Android maskable icon route so both pick the same source + fallbacks).
  const branded = await resolveBrandedLogo(org, tournamentSlug, origin);

  if (branded) {
    // Branded: tile painted the logo's own sampled background colour so the logo
    // reads as one seamless field (no white-card-on-dark look); falls back to the
    // dark square for transparent wordmarks. iOS only rounds the corners (no
    // circular crop), so the logo runs near edge-to-edge (156 of 180 ≈ 87%).
    // branded.src is guaranteed raster (fetchAsDataUrl rejects SVG/non-raster), so
    // satori renders it reliably — no try/catch needed (one wouldn't catch
    // streaming errors).
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: branded.bg ?? DARK,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branded.src} width={156} height={156} style={{ objectFit: 'contain' }} alt="" />
        </div>
      ),
      { ...size },
    );
  }

  // Default: re-serve the clean platform icon (identical look to non-tournament
  // pages); a typographic mark is the last-resort fallback if it can't be fetched.
  const platform = origin ? await fetchAsDataUrl(`${origin}/icons/pwa-512.png`) : null;
  if (!platform) return letterMark();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: DARK,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={platform} width={180} height={180} style={{ objectFit: 'cover' }} alt="" />
      </div>
    ),
    { ...size },
  );
}
