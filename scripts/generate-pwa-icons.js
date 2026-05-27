/**
 * scripts/generate-pwa-icons.js
 *
 * One-time script to generate PWA icons from public/logo.png.
 * Letterboxes the logo onto a #0a0a0f background.
 *
 * Run: node scripts/generate-pwa-icons.js
 * Requires: sharp (devDependency)
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const ROOT      = path.join(__dirname, '..');
// Accept an optional source file argument: node generate-pwa-icons.js public/brand/logo-C.svg
const SRC       = process.argv[2]
  ? path.resolve(ROOT, process.argv[2])
  : path.join(ROOT, 'public', 'logo.png');
const ICONS_DIR = path.join(ROOT, 'public', 'icons');

// Background colour matching the app's --bg-base token
const BG = { r: 10, g: 10, b: 15, alpha: 1 };

// Maskable safe zone: logo must fit inside the inner 80% circle.
// At 512px that means the drawable area is ~410px, so we need 51px padding each side.
// We use 110px padding (leaving ~292px logo area) to be comfortably inside the safe zone.
const SIZES = [
  { name: 'pwa-192.png',          size: 192, padding: 32  },
  { name: 'pwa-512.png',          size: 512, padding: 88  },
  { name: 'pwa-512-maskable.png', size: 512, padding: 110 }, // extra padding for maskable safe zone
  { name: 'badge-72.png',         size: 72,  padding: 10, mono: true },
];

async function generate() {
  if (!fs.existsSync(SRC)) {
    console.error('ERROR: public/logo.png not found. Ensure the source logo exists before running this script.');
    process.exit(1);
  }

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  for (const spec of SIZES) {
    const logoSize = spec.size - spec.padding * 2;

    // Resize logo to fit within the letterbox area
    let logoBuffer = await sharp(SRC)
      .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();

    // For the monochrome badge, convert to white silhouette
    if (spec.mono) {
      logoBuffer = await sharp(logoBuffer)
        .greyscale()
        .threshold(128)
        .png()
        .toBuffer();
    }

    const { width: lw, height: lh } = await sharp(logoBuffer).metadata();
    const left = Math.round((spec.size - lw) / 2);
    const top  = Math.round((spec.size - lh) / 2);

    const outPath = path.join(ICONS_DIR, spec.name);

    await sharp({
      create: {
        width:      spec.size,
        height:     spec.size,
        channels:   4,
        background: BG,
      },
    })
      .composite([{ input: logoBuffer, left, top }])
      .png()
      .toFile(outPath);

    console.log(`✓ ${spec.name} (${spec.size}×${spec.size}) → ${outPath}`);
  }

  console.log('\nAll PWA icons generated successfully.');
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
