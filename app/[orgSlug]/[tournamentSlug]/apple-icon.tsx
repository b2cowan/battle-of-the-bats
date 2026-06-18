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
import { headers } from 'next/headers';
import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';

export const dynamic = 'force-dynamic';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const DARK = '#0A0A12';

async function originFromHeaders(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('host');
    // x-forwarded-proto can be a comma-separated hop list — take the outermost.
    const proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0].trim() || 'https';
    return host ? `${proto}://${host}` : '';
  } catch {
    return '';
  }
}

/** Fetch a RASTER image and inline it as a data URL so satori never does its own
 *  (flakier) remote fetch. Returns null on any failure, or for SVG/non-raster
 *  sources — satori's <img> SVG support is unreliable and would otherwise throw
 *  during streaming (which a try/catch around ImageResponse cannot catch). A null
 *  return makes the caller fall back to the platform default. */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const ctype = resp.headers.get('content-type') ?? 'image/png';
    if (!/^image\/(png|jpe?g|webp|gif)/i.test(ctype)) return null;
    const buf = await resp.arrayBuffer();
    return `data:${ctype};base64,${Buffer.from(buf).toString('base64')}`;
  } catch {
    return null;
  }
}

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

  // Resolve the branded logo only when the plan allows advanced branding.
  let logoSrc: string | null = null;
  try {
    if (canUseAdvancedTournamentBranding(org)) {
      const t = await getPublicTournamentBySlug(org.id, tournamentSlug);
      const raw = t?.logoUrl ?? org.logoUrl ?? null;
      if (raw && raw.startsWith('http')) {
        logoSrc = await fetchAsDataUrl(raw);
      } else if (raw && origin) {
        // Root-relative stock logo — needs an origin to fetch. Without one (rare:
        // missing host header) we fall through to the platform default.
        logoSrc = await fetchAsDataUrl(`${origin}${raw.startsWith('/') ? '' : '/'}${raw}`);
      }
    }
  } catch {
    /* fall back to the platform default */
  }

  if (logoSrc) {
    // Branded: logo inset on a dark square (handles transparent wordmarks cleanly).
    // logoSrc is guaranteed raster (fetchAsDataUrl rejects SVG/non-raster), so satori
    // renders it reliably — no try/catch needed (one wouldn't catch streaming errors).
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
          <img src={logoSrc} width={138} height={138} style={{ objectFit: 'contain' }} alt="" />
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
