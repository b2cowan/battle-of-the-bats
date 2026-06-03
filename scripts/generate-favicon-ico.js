/**
 * scripts/generate-favicon-ico.js
 *
 * Generates a branded multi-resolution app/favicon.ico from the chevron
 * "logic mark" in public/favicon.svg.
 *
 * WHY THIS EXISTS: Next.js App Router auto-injects any app/favicon.ico as a
 * site favicon. The project was scaffolded with create-next-app's stock 'N'
 * icon, which leaked into browser tabs and Chromium PWA/install surfaces that
 * prefer .ico over our branded SVG. This replaces it with the brand chevron.
 *
 * SOURCE: public/favicon.svg — pure geometry (no font/text), so it renders
 * cleanly at favicon sizes. The detailed public/brand/logo-C.svg (grid + "HQ"
 * label) is NOT used here; its fine detail turns to noise at 16px.
 *
 * OUTPUT: app/favicon.ico containing 16, 32, and 48px PNG-encoded entries.
 * PNG-in-ICO is supported by all modern browsers (Vista+ / Chrome / Firefox).
 *
 * Run: node scripts/generate-favicon-ico.js
 * Requires: sharp (devDependency)
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const ROOT  = path.join(__dirname, '..');
const SRC   = path.join(ROOT, 'public', 'favicon.svg');
const OUT   = path.join(ROOT, 'app', 'favicon.ico');
const SIZES = [16, 32, 48];

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`ERROR: Source not found: ${SRC}`);
    process.exit(1);
  }

  const svg = fs.readFileSync(SRC);

  // Render each size to a PNG buffer.
  const images = [];
  for (const size of SIZES) {
    const buf = await sharp(svg)
      .resize(size, size, { fit: 'fill' })
      .png()
      .toBuffer();
    images.push({ size, buf });
  }

  // ── Build the ICO container ──────────────────────────────────────────────
  // ICONDIR header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved, must be 0
  header.writeUInt16LE(1, 2);              // image type, 1 = icon
  header.writeUInt16LE(images.length, 4); // number of images

  // One ICONDIRENTRY (16 bytes) per image, then the PNG blobs.
  let offset = header.length + images.length * 16;
  const entries = images.map(({ size, buf }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width  (0 means 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 means 256)
    e.writeUInt8(0, 2);                      // palette color count (0 = none)
    e.writeUInt8(0, 3);                      // reserved
    e.writeUInt16LE(1, 4);                   // color planes
    e.writeUInt16LE(32, 6);                  // bits per pixel
    e.writeUInt32LE(buf.length, 8);          // size of PNG data
    e.writeUInt32LE(offset, 12);             // offset of PNG data
    offset += buf.length;
    return e;
  });

  const ico = Buffer.concat([header, ...entries, ...images.map(i => i.buf)]);
  fs.writeFileSync(OUT, ico);

  console.log(`✓ ${OUT} (${ico.length} bytes) — sizes: ${SIZES.join(', ')}px`);
  console.log(`  Source: ${SRC}`);
}

main().catch(err => {
  console.error('favicon.ico generation failed:', err);
  process.exit(1);
});
