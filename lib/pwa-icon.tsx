/**
 * lib/pwa-icon.tsx
 *
 * Shared helpers for the per-tournament PWA / home-screen icons. Two routes
 * consume these so the branding + fallback rules stay identical:
 *   - app/[orgSlug]/[tournamentSlug]/apple-icon.tsx  → iOS apple-touch-icon (180²)
 *   - app/[orgSlug]/[tournamentSlug]/icon-maskable/route.tsx → Android maskable (512²)
 *
 * The branded logo (tournament → org) is inlined as a raster data URL so satori
 * never does its own (flakier) remote fetch during streaming. SVG / non-raster
 * sources are rejected (satori's <img> SVG support is unreliable) — callers fall
 * back to the platform icon.
 */
import sharp from 'sharp';
import { headers } from 'next/headers';
import { getPublicTournamentBySlug } from '@/lib/db';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import type { Organization } from '@/lib/types';

/** Dark backing square behind composited logos. Used only as the fallback when a
 *  logo's own background colour can't be sampled (e.g. a transparent wordmark). */
export const ICON_DARK = '#0A0A12';

export async function originFromHeaders(): Promise<string> {
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

/** Fetch a RASTER image and inline it as a data URL. Returns null on any failure,
 *  or for SVG/non-raster sources (satori's SVG <img> support is unreliable and
 *  would throw mid-stream, which a try/catch around ImageResponse cannot catch). */
export async function fetchAsDataUrl(url: string): Promise<string | null> {
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

/** Matches a `#rrggbb` colour (the only form we store / honour for an icon tile). */
export const ICON_HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Sample a raster logo's own background colour from its edge pixels (works on a raw
 * image Buffer — e.g. freshly-uploaded bytes), so the icon tile can be painted that
 * colour and the logo reads as one seamless field (no white-card-on-dark "postage
 * stamp"). Returns a `#rrggbb` string, or null when the border is mostly transparent
 * (a wordmark meant to sit on a dark backing) or decoding fails — callers then fall
 * back to ICON_DARK (prior behaviour, so the icon never regresses if sampling is
 * unavailable, e.g. sharp missing at runtime).
 */
export async function sampleBackgroundHex(input: Buffer): Promise<string | null> {
  try {
    // Downscale before reading raw RGBA — averages noise and keeps the buffer small.
    const { data, info } = await sharp(input)
      .resize(64, 64, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels: ch } = info;
    if (!w || !h || ch < 4) return null;

    let rs = 0, gs = 0, bs = 0, opaque = 0, transparent = 0, total = 0;
    const sample = (x: number, y: number) => {
      const i = (y * w + x) * ch;
      total++;
      if (data[i + 3] < 128) { transparent++; return; }
      opaque++;
      rs += data[i]; gs += data[i + 1]; bs += data[i + 2];
    };
    for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
    for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }

    // A mostly-transparent border means the logo expects a dark tile → defer to it.
    if (total === 0 || transparent / total > 0.5 || opaque === 0) return null;
    const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
    return `#${hex(rs / opaque)}${hex(gs / opaque)}${hex(bs / opaque)}`;
  } catch {
    return null;
  }
}

/** Sample a logo's background colour from an inlined data URL (see sampleBackgroundHex). */
export async function detectBackgroundHex(dataUrl: string): Promise<string | null> {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  return sampleBackgroundHex(Buffer.from(dataUrl.slice(comma + 1), 'base64'));
}

/**
 * Resolve the branded logo (tournament → org) as an inlined raster data URL plus
 * its sampled background colour, but only when the org's plan allows advanced
 * branding. Returns null for free tier, a missing logo, SVG/non-raster sources, or
 * any fetch failure — every caller degrades to the platform icon. `origin` is
 * required to fetch root-relative stock logos (e.g. `/stock-logos/foo.svg`, which
 * is then rejected as non-raster). `bg` is the organizer's saved icon-background
 * override when set (a valid `#rrggbb`), else the colour auto-sampled from the logo,
 * else null (callers then use ICON_DARK).
 */
export async function resolveBrandedLogo(
  org: Pick<Organization, 'id' | 'planId' | 'logoUrl'>,
  tournamentSlug: string,
  origin: string,
): Promise<{ src: string; bg: string | null } | null> {
  if (!canUseAdvancedTournamentBranding(org)) return null;
  try {
    const t = await getPublicTournamentBySlug(org.id, tournamentSlug);
    const raw = t?.logoUrl ?? org.logoUrl ?? null;
    if (!raw) return null;
    let src: string | null = null;
    if (raw.startsWith('http')) src = await fetchAsDataUrl(raw);
    else if (origin) src = await fetchAsDataUrl(`${origin}${raw.startsWith('/') ? '' : '/'}${raw}`);
    if (!src) return null;
    // Organizer override wins (Public Site → App Icon); else auto-sample the logo.
    const override = t?.iconBgColor && ICON_HEX_RE.test(t.iconBgColor) ? t.iconBgColor : null;
    return { src, bg: override ?? await detectBackgroundHex(src) };
  } catch {
    return null;
  }
}
