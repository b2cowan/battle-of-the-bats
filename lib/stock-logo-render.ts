/**
 * A stock logo, made the club's own (owner, 2026-10-18).
 *
 * The art in public/stock-logos/ is a white mark on nothing — drawn when the product was dark.
 * Saved as that path it vanished on every light surface: the picker's own tiles, the warm admin,
 * the coach's papers, and every PDF and Excel export (white paper). The phone app icon and push
 * icon refused it outright (they take raster only). So a pick is no longer saved as the art's
 * path: the mark is drawn onto a filled circle in the club's main colour — in dark ink instead of
 * white when that colour is too light for white, the theme's own `onPrimary` — rasterized to a PNG
 * and stored beside an uploaded logo. From there it is an ordinary logo everywhere one is read.
 * The picker's tiles draw the same circle from the same scale and ink, so the club sees what it gets.
 * The art comes from lib/stock-logo-art.ts, never from disk (see why there).
 *
 * ⚠ THE FILE NAME IS THE RECORD. `<orgId>/stock-<logoId>-<rrggbb>-<made at>.png` — nothing else
 * marks a logo as stock, and a colour save reads the name to remake it in the new colour (an
 * uploaded logo is never touched). `stockFileName` and `STOCK_FILE_RE` are its one spelling.
 * The made-at stamp makes every make its own file: two overlapping requests never share a path,
 * so one's clean-up can never delete the file the other just pointed the org at.
 */
import { supabaseAdmin } from './supabase-admin';
import { STOCK_LOGOS, STOCK_MARK_SCALE, type StockLogo } from './stock-logos';
import { STOCK_LOGO_ART } from './stock-logo-art';
import { ORG_LOGO_BUCKET, ensureOrgLogoBucket } from './org-logo-storage';

/** The circle's diameter in pixels — big enough for the app icon, which wants 512. */
const SIZE_PX = 512;

/** The colours a logo is made in — `resolveTheme(...)`'s main colour and the ink legible on it. */
export interface StockLogoColours {
  primary: string;
  onPrimary: string;
}

const STOCK_FILE_RE = /^stock-([a-z0-9-]+)-([0-9a-f]{6})-(\d+)\.png$/;
const stockFileName = (logo: StockLogo, primary: string) =>
  `stock-${logo.id}-${primary.slice(1).toLowerCase()}-${Date.now()}.png`;

/** The stock logo `orgId`'s stored logo URL was made from, the colour it was made in and its storage
 *  path — or null for an uploaded logo, no logo, or anything outside the org's own folder: the path
 *  drives a service-role delete, so it must never name another org's file. */
export function parseStockLogoUrl(url: string | null | undefined, orgId: string): { logo: StockLogo; hex: string; objectPath: string } | null {
  const objectPath = url?.split('?')[0].split(`/${ORG_LOGO_BUCKET}/`)[1];
  const [folder, file, ...rest] = objectPath?.split('/') ?? [];
  const m = folder === orgId && file && !rest.length ? STOCK_FILE_RE.exec(file) : null;
  const logo = m ? STOCK_LOGOS.find(l => l.id === m[1]) : undefined;
  return objectPath && m && logo ? { logo, hex: `#${m[2]}`, objectPath } : null;
}

/** The made logo: `logo`'s mark in `onPrimary` on a `primary` circle, as a 512px PNG on transparent. */
export async function renderStockLogoPng(logo: StockLogo, { primary, onPrimary }: StockLogoColours): Promise<Buffer> {
  const art = STOCK_LOGO_ART[logo.id] ?? '';
  const open = /<svg\b[^>]*>/.exec(art);
  const close = art.lastIndexOf('</svg>');
  if (!open || close < 0) throw new Error(`No art for stock logo ${logo.id}`);
  // The root's fill (most say "none") is inherited by the mark, so it moves onto the group.
  const rootFill = /\bfill="([^"]*)"/.exec(open[0])?.[1];
  const mark = art.slice(open.index + open[0].length, close).replaceAll('"white"', `"${onPrimary}"`);
  const inset = (64 * (1 - STOCK_MARK_SCALE)) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE_PX}" height="${SIZE_PX}" viewBox="0 0 64 64">`
    + `<circle cx="32" cy="32" r="32" fill="${primary}"/>`
    + `<g transform="translate(${inset} ${inset}) scale(${STOCK_MARK_SCALE})"${rootFill ? ` fill="${rootFill}"` : ''}>${mark}</g>`
    + '</svg>';
  // Lazy: sharp is a native module — loaded only when a logo is actually being made.
  const { default: sharp } = await import('sharp');
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Best-effort: delete the made stock logo `url` points at, if it is one of `orgId`'s — so a new
 *  pick, an upload or a removal leaves no orphan behind. */
export async function removeStockLogoFile(url: string | null | undefined, orgId: string) {
  const stock = parseStockLogoUrl(url, orgId);
  if (!stock) return;
  try {
    await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).remove([stock.objectPath]);
  } catch {
    // Housekeeping only — the logo the org points at is already saved; an orphan file is harmless.
  }
}

/** Make `logo` in `colours`, store it, point the org at it, and delete the made logo it replaces
 *  (`previousUrl`). Returns the new logo URL — or null when `onlyOverPrevious` is set and the org's
 *  logo had already changed from `previousUrl` (the new file is deleted again; nothing is written). */
export async function applyStockLogo(
  orgId: string,
  logo: StockLogo,
  colours: StockLogoColours,
  previousUrl: string | null | undefined,
  { onlyOverPrevious = false }: { onlyOverPrevious?: boolean } = {},
): Promise<string | null> {
  const objectPath = `${orgId}/${stockFileName(logo, colours.primary)}`;
  const [png] = await Promise.all([renderStockLogoPng(logo, colours), ensureOrgLogoBucket()]);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(ORG_LOGO_BUCKET)
    .upload(objectPath, png, { contentType: 'image/png', upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const logoUrl = supabaseAdmin.storage.from(ORG_LOGO_BUCKET).getPublicUrl(objectPath).data.publicUrl;

  let write = supabaseAdmin.from('organizations').update({ logo_url: logoUrl }).eq('id', orgId);
  if (onlyOverPrevious) write = previousUrl ? write.eq('logo_url', previousUrl) : write.is('logo_url', null);
  const { data: written, error: dbError } = await write.select('id');
  if (dbError) throw new Error(dbError.message);
  if (!written?.length) {
    // Someone changed the logo while this one was being made: theirs stands.
    await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).remove([objectPath]).catch(() => undefined);
    return null;
  }

  // Only once the org points at the new file — a failed write must not leave it pointing at nothing.
  await removeStockLogoFile(previousUrl, orgId);
  return logoUrl;
}

/** After the org's colours are saved: a stock logo made in another colour is made again in the
 *  new one. Returns the org's logo URL as it now stands (unchanged for an upload or no logo). */
export async function remakeStockLogoForTheme(orgId: string, logoUrl: string | null, colours: StockLogoColours): Promise<string | null> {
  const stock = parseStockLogoUrl(logoUrl, orgId);
  if (!stock || colours.primary.toLowerCase() === stock.hex) return logoUrl;
  const remade = await applyStockLogo(orgId, stock.logo, colours, logoUrl, { onlyOverPrevious: true });
  if (remade) return remade;
  // The logo changed under the save (an upload, a pick, a removal): report what is there now.
  const { data } = await supabaseAdmin.from('organizations').select('logo_url').eq('id', orgId).single();
  return data?.logo_url ?? null;
}
