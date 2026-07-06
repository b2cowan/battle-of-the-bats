/**
 * scripts/generate-pwa-icons.js
 *
 * Four-mark PWA icon system:
 *   PRIMARY  mark — FL monogram (Concept B) — used where letterforms are legible (192px+)
 *   ICON     mark — chevron ">" (Concept C) — favicon-style, opaque tile
 *   BADGE    mark — transparent white chevron silhouette — Android status-bar push badge.
 *                   Android renders the small notification icon by ALPHA ONLY (opaque →
 *                   solid white), so the badge MUST be a background-less silhouette or it
 *                   flattens to a white square. See public/brand/logo-badge.svg.
 *   MASKABLE mark — borderless, corner-clean, centered FL — Android adaptive (circle-crop).
 *                   logo-B's border + corner "HQ" get clipped by the ~80% circle mask.
 *
 * Defaults:
 *   primary  = public/brand/logo-B.svg
 *   icon     = public/brand/logo-C.svg
 *   badge    = public/brand/logo-badge.svg
 *   maskable = public/brand/logo-B-maskable.svg
 *
 * Override via CLI args:
 *   node scripts/generate-pwa-icons.js [--primary <path>] [--icon <path>] [--badge <path>] [--maskable <path>]
 *   node scripts/generate-pwa-icons.js public/brand/logo-A.svg   (shorthand: sets primary only)
 *
 * Run: node scripts/generate-pwa-icons.js
 * Requires: sharp (devDependency)
 *
 * NOTE ON FONTS: logo-B.svg uses Barlow Condensed 900 for the "FL" lettermark.
 * If Barlow Condensed is not installed as a system font, the PNG will fall back to
 * Arial Narrow or Impact. For production-quality output with the correct font, either:
 *   (a) Install Barlow Condensed as a system font (free from Google Fonts)
 *   (b) Export the SVG text to paths in Inkscape/Figma first
 *   (c) Use logo-C.svg (chevron) as the primary — it is fully font-independent
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const ROOT      = path.join(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'public', 'icons');

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let primary  = path.join(ROOT, 'public', 'brand', 'logo-B.svg');
  let icon     = path.join(ROOT, 'public', 'brand', 'logo-C.svg');
  let badge    = path.join(ROOT, 'public', 'brand', 'logo-badge.svg');
  let maskable = path.join(ROOT, 'public', 'brand', 'logo-B-maskable.svg');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--primary' && args[i + 1]) {
      primary = path.resolve(ROOT, args[++i]);
    } else if (args[i] === '--icon' && args[i + 1]) {
      icon = path.resolve(ROOT, args[++i]);
    } else if (args[i] === '--badge' && args[i + 1]) {
      badge = path.resolve(ROOT, args[++i]);
    } else if (args[i] === '--maskable' && args[i + 1]) {
      maskable = path.resolve(ROOT, args[++i]);
    } else if (!args[i].startsWith('--')) {
      // Positional arg: shorthand for primary
      primary = path.resolve(ROOT, args[i]);
    }
  }
  return { primary, icon, badge, maskable };
}

// ── Size specs ────────────────────────────────────────────────────────────────
//
//  srcKey: 'primary'  = FL monogram (Concept B)  — large, has letterforms
//          'icon'     = chevron mark (Concept C)  — small, pure geometry, opaque tile
//          'badge'    = transparent chevron silhouette — Android status-bar push badge
//          'maskable' = borderless centered FL       — Android adaptive circle-crop
//
//  maskablePadding: extra canvas padding (px) for the maskable safe zone.
//    Android clips to the inner 80% circle; content must stay within that.
//    At 512px the safe zone diameter is ~410px, so minimum 51px padding.
//    We use 56px (comfortable margin) for the maskable variant.

const SIZES = [
  {
    name:    'pwa-192.png',
    size:    192,
    srcKey:  'primary',   // FL mark — still readable at 192px
  },
  {
    name:    'pwa-512.png',
    size:    512,
    srcKey:  'primary',
  },
  {
    name:            'pwa-512-maskable.png',
    size:            512,
    srcKey:          'maskable',  // borderless, corner-clean source (no clipped border/HQ)
    maskablePadding: 56,          // render at 400px and composite on 512px background
  },
  {
    name:    'badge-72.png',
    size:    72,
    srcKey:  'badge',     // TRANSPARENT white chevron silhouette (alpha-only on Android)
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const BG = { r: 10, g: 10, b: 15, alpha: 1 }; // #0a0a0f

async function renderSvgToBuffer(svgPath, size) {
  const buf = fs.readFileSync(svgPath);
  return sharp(buf)
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer();
}

async function renderPngToBuffer(pngPath, logoSize) {
  return sharp(pngPath)
    .resize(logoSize, logoSize, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
}

async function compositeOnBackground(logoBuffer, canvasSize, logoSize) {
  const { width: lw, height: lh } = await sharp(logoBuffer).metadata();
  const left = Math.round((canvasSize - (lw ?? logoSize)) / 2);
  const top  = Math.round((canvasSize - (lh ?? logoSize)) / 2);

  return sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: BG },
  })
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toBuffer();
}

function isSvg(filePath) {
  return filePath.toLowerCase().endsWith('.svg');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function generate() {
  const { primary, icon, badge, maskable } = parseArgs();

  for (const src of [primary, icon, badge, maskable]) {
    if (!fs.existsSync(src)) {
      console.error(`ERROR: Source file not found: ${src}`);
      process.exit(1);
    }
  }

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const sources = { primary, icon, badge, maskable };

  for (const spec of SIZES) {
    const srcPath = sources[spec.srcKey];

    let outputBuffer;

    if (spec.maskablePadding) {
      // Maskable: render the logo smaller, then composite on a full-size background
      const innerSize = spec.size - spec.maskablePadding * 2;
      const logoBuffer = isSvg(srcPath)
        ? await renderSvgToBuffer(srcPath, innerSize)
        : await renderPngToBuffer(srcPath, innerSize);
      outputBuffer = await compositeOnBackground(logoBuffer, spec.size, innerSize);

    } else if (isSvg(srcPath)) {
      // SVG input: render directly to target size (SVG already has background baked in)
      outputBuffer = await renderSvgToBuffer(srcPath, spec.size);

    } else {
      // PNG input: legacy letterbox behaviour
      const logoBuffer = await renderPngToBuffer(srcPath, spec.size);
      outputBuffer = await compositeOnBackground(logoBuffer, spec.size, spec.size);
    }

    const outPath = path.join(ICONS_DIR, spec.name);
    await sharp(outputBuffer).png().toFile(outPath);

    console.log(`✓ ${spec.name} (${spec.size}×${spec.size}) [${spec.srcKey} mark] → ${outPath}`);
  }

  console.log('\n✓ All PWA icons generated.');
  console.log('  Primary mark :', primary);
  console.log('  Icon mark    :', icon);
  console.log('  Badge mark   :', badge);
  console.log('  Maskable mark:', maskable);
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
