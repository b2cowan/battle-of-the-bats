/**
 * lib/sponsor-logo-image.ts — OPEN A SPONSOR'S LOGO AND RE-SAVE IT; NEVER TRUST WHAT IT SAYS IT IS (Club Tier Stage 4d).
 *
 * The club logo route checks only the declared type and byte size. A sponsor's logo is shown to the public and the upload
 * is a file from the browser, so this decodes it, accepts only a real JPEG, PNG or WebP, refuses a picture too large to
 * decode safely (a small file that expands to hundreds of megabytes), and writes back a fresh PNG no larger than the box
 * families see. What is stored is therefore always our own encoding, and a mislabelled file, an SVG with a script in it
 * or an image with hidden metadata never reaches the bucket. Words: CLUB_TIER_STAGE4D_COPY.md §B.
 * Server only (sharp is native, loaded when a logo is actually made). Tested in tests/unit/club-stage4d.test.ts.
 */
import { ORG_IMAGE_TYPES, ORG_LOGO_MAX_BYTES } from './org-image-limits';
import { PUBLIC_SITE_WORDS as W } from './public-site-words';
import { SPONSOR_LOGO_MAX_HEIGHT, SPONSOR_LOGO_MAX_WIDTH } from './sponsor-logo';

/** The largest picture we will decode, in pixels (a 4096-square photo). The same ceiling the PDF logo reader uses. */
const MAX_INPUT_PIXELS = 4096 * 4096;
const REAL_FORMATS: readonly string[] = ['jpeg', 'png', 'webp'];

export type PreparedLogo = { ok: true; png: Buffer } | { ok: false; error: string };

export async function prepareSponsorLogo(bytes: Buffer, declaredType: string): Promise<PreparedLogo> {
  if (!(ORG_IMAGE_TYPES as readonly string[]).includes(declaredType)) return { ok: false, error: W.logoWrongType };
  if (bytes.length > ORG_LOGO_MAX_BYTES) return { ok: false, error: W.logoTooBig };
  try {
    const { default: sharp } = await import('sharp');
    const input = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
    const meta = await input.metadata();
    // What the bytes ARE decides, not what the browser said: a TIFF, GIF, SVG or PDF called "image/png" is the wrong type.
    if (!meta.format || !REAL_FORMATS.includes(meta.format)) return { ok: false, error: W.logoWrongType };
    if (!meta.width || !meta.height || meta.width * meta.height > MAX_INPUT_PIXELS) return { ok: false, error: W.logoUnreadable };
    const png = await input
      .rotate() // honour a phone photo's orientation, then drop the metadata with it
      .resize(SPONSOR_LOGO_MAX_WIDTH, SPONSOR_LOGO_MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { ok: true, png };
  } catch {
    return { ok: false, error: W.logoUnreadable };
  }
}
