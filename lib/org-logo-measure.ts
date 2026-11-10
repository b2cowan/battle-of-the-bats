/**
 * Read a logo's pixel size from its bytes — server only (sharp is a native module, loaded only when an image has to be read).
 * ONE home for the arithmetic: EXIF orientations 5–8 lay a picture on its side, and every surface that shows it shows it
 * turned, so the size is the turned one. Null on any failure (never a guess). Read by the family email's logo size
 * (`lib/club-email-context.ts`), by the upload route (`measureLogoAspect`, stored as `organizations.logo_aspect`, mig 458),
 * and repeated by the one-time pass over logos uploaded before the column (scripts/backfill-org-logo-aspect.mjs, an .mjs
 * that cannot import this).
 */
// No pixel limit: this reads the picture's HEADER only (`metadata()` never decodes pixels), so a large but valid logo (a
// 5000 x 5000 print file well under the upload's size cap) is measured, not silently turned into "unknown" and initials.

export async function readImageSize(bytes: ArrayBuffer | Uint8Array): Promise<{ width: number; height: number } | null> {
  try {
    const { default: sharp } = await import('sharp');
    const meta = await sharp(bytes, { limitInputPixels: false }).metadata();
    if (!meta.width || !meta.height) return null;
    const sideways = (meta.orientation ?? 1) >= 5;
    return sideways ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/** The logo's width / height, or null when it cannot be read — the tile then shows initials. */
export async function measureLogoAspect(bytes: ArrayBuffer | Uint8Array): Promise<number | null> {
  const size = await readImageSize(bytes);
  return size ? size.width / size.height : null;
}
