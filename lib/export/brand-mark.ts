/**
 * OUR OWN MARK, for a document that has room to draw one.
 *
 * ## Why this is three lines and not an asset pipeline
 *
 * The Excel footer shipped as text on 2026-09-05 with a note saying a mark would need a raster and
 * ours was an SVG. That was half true: `public/favicon.svg` is a vector, but the PWA icons beside
 * it have been real PNGs since July, and one of them is exactly the mark a footer wants. Nothing
 * needed storing — it needed finding. If you are ever tempted to rasterise the SVG at download
 * time to solve this, read that sentence again first.
 *
 * ## Why 192 and not 512
 *
 * The mark is drawn at ~26px in a spreadsheet footer and ~7mm on paper. 192 is already several
 * times the drawn size (so it stays crisp on a retina screen and in print) at an eighth of 512's
 * weight — and this is fetched on every branded export, so the smaller file is the whole point.
 * ⚠ NOT `badge-72.png`: that one is the monochrome notification badge, not the logo.
 *
 * ## Fails soft, always
 *
 * A missing or unreadable mark costs a picture and never the download. The footer's text is the
 * part that carries the meaning; the logo is decoration on top of it, and the last step before a
 * treasurer gets their file is the worst possible place to throw.
 */

/** The mark's public path. Same origin, so the browser caches it after the first export. */
export const BRAND_MARK_SRC = '/icons/pwa-192.png';

/** Cached for the life of the page — the bytes cannot change under a running session, and a
 *  treasurer exporting four views in a row should pay for this once. */
let cached: string | null | undefined;

/**
 * Our mark as a `data:` URL, or null if it could not be read.
 *
 * Browser-only: it reaches for `fetch` and `FileReader`, both of which the export path already
 * depends on. Server-side callers get null rather than a crash.
 */
export async function loadBrandMark(): Promise<string | null> {
  if (cached !== undefined) return cached;
  cached = null;
  if (typeof fetch !== 'function' || typeof FileReader === 'undefined') return cached;
  try {
    const res = await fetch(BRAND_MARK_SRC);
    if (!res.ok) return cached;
    const blob = await res.blob();
    cached = await new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    cached = null;
  }
  return cached;
}
