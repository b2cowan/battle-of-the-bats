/**
 * scripts/outline-svg-text.js
 *
 * Converts the text elements in logo-B.svg to outlined SVG paths so the file
 * is font-independent. Uses opentype.js to trace Barlow Condensed 900 glyphs.
 *
 * Steps:
 *   1. Download Barlow Condensed Black (900) TTF from Google Fonts
 *   2. Trace the "F" and "L" glyphs at the exact position/size used in logo-B.svg
 *   3. Replace <text> elements with <path> elements in logo-B.svg
 *   4. Write logo-B-outlined.svg alongside the original (so the original is preserved)
 *      — pass --apply to overwrite logo-B.svg in place
 *
 * Usage:
 *   node scripts/outline-svg-text.js            # writes logo-B-outlined.svg
 *   node scripts/outline-svg-text.js --apply    # overwrites logo-B.svg
 */

const opentype = require('opentype.js');
const https    = require('https');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');

const ROOT        = path.join(__dirname, '..');
const BRAND_DIR   = path.join(ROOT, 'public', 'brand');
const FONT_CACHE  = path.join(ROOT, 'node_modules', '.cache', 'barlow-condensed-900.ttf');
const SRC_SVG     = path.join(BRAND_DIR, 'logo-B.svg');
const OUT_SVG     = path.join(BRAND_DIR, 'logo-B-outlined.svg');

const APPLY = process.argv.includes('--apply');

// ── Font download ─────────────────────────────────────────────────────────────
//
// Ask Google Fonts for the CSS with a UA that returns a TTF src line, then
// pull the font URL from the src declaration.

const GOOGLE_FONTS_CSS =
  'https://fonts.googleapis.com/css?family=Barlow+Condensed:900&subset=latin';
const TTF_UA =
  'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko';

function fetchUrl(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': TTF_UA, ...extraHeaders } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location, extraHeaders).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function getFontBuffer() {
  // Use cached copy if available
  if (fs.existsSync(FONT_CACHE)) {
    console.log('  Using cached font:', FONT_CACHE);
    return fs.readFileSync(FONT_CACHE);
  }

  console.log('  Fetching Google Fonts CSS...');
  const css = (await fetchUrl(GOOGLE_FONTS_CSS)).toString('utf8');

  // Extract the TTF/WOFF src URL
  const match = css.match(/src:\s*url\(([^)]+\.(?:ttf|woff))\)/i);
  if (!match) {
    // Fallback: try to find any url() in the CSS
    const anyUrl = css.match(/url\((https:\/\/fonts\.gstatic[^)]+)\)/i);
    if (!anyUrl) throw new Error('Could not find font URL in Google Fonts CSS response.\nCSS:\n' + css);
    match[1] = anyUrl[1];
  }

  const fontUrl = match[1].replace(/['"]/g, '');
  console.log('  Downloading font:', fontUrl);
  const fontBuf = await fetchUrl(fontUrl);

  fs.mkdirSync(path.dirname(FONT_CACHE), { recursive: true });
  fs.writeFileSync(FONT_CACHE, fontBuf);
  console.log('  Font cached to:', FONT_CACHE);
  return fontBuf;
}

// ── Glyph path extraction ─────────────────────────────────────────────────────
//
// logo-B.svg places letters as:
//   F  → x=192 y=230  font-size=190  text-anchor=middle  fill=#D9F99D
//   L  → x=192 y=418  font-size=190  text-anchor=middle  fill=#D9F99D
//
// opentype.js getPath(str, x, y, size) places x at the LEFT edge (no anchor).
// We measure each glyph's advance width and shift x by -width/2 to honour
// text-anchor=middle.

function glyphPathData(font, char, anchorX, baselineY, fontSize) {
  const glyph = font.charToGlyph(char);
  const glyphWidth = (glyph.advanceWidth / font.unitsPerEm) * fontSize;
  const x = anchorX - glyphWidth / 2;
  const otPath = font.getPath(char, x, baselineY, fontSize);
  return otPath.toSVG(3); // 3 decimal places
}

// ── SVG rewrite ───────────────────────────────────────────────────────────────
//
// The source SVG has exactly two <text> elements (F and L).
// We replace each with the path data from opentype.js, preserving the fill.
//
// We use a simple string-replace strategy — no full XML parse needed because
// the SVG is machine-generated and the text blocks are well-known.

function buildPathElement(pathSvgStr, fill) {
  // otPath.toSVG() may or may not include a fill attribute depending on version.
  // Normalise: ensure fill is set to our colour.
  if (pathSvgStr.includes('fill=')) {
    return pathSvgStr.replace(/fill="[^"]*"/, `fill="${fill}"`);
  }
  // No fill attribute present — insert it into the opening <path> tag
  return pathSvgStr.replace('<path ', `<path fill="${fill}" `);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('outline-svg-text — converting logo-B.svg text to paths\n');

  // 1. Load font
  console.log('[1/4] Loading font...');
  const fontBuf = await getFontBuffer();
  const font = opentype.parse(fontBuf.buffer);
  console.log(`      Loaded: ${font.names.fullName?.en ?? 'Barlow Condensed'} (${font.unitsPerEm} UPM)`);

  // 2. Generate path SVG strings for F and L
  console.log('[2/4] Tracing glyphs...');
  const fPathSvg = glyphPathData(font, 'F', 192, 230, 190);
  const lPathSvg = glyphPathData(font, 'L', 192, 418, 190);
  console.log('      F path generated');
  console.log('      L path generated');

  // 3. Build replacement elements with correct fill
  const FILL = '#D9F99D';
  const fPathEl = buildPathElement(fPathSvg, FILL);
  const lPathEl = buildPathElement(lPathSvg, FILL);

  // 4. Read the source SVG and replace text blocks
  console.log('[3/4] Rewriting SVG...');
  let svg = fs.readFileSync(SRC_SVG, 'utf8');

  // Remove the Google Fonts @import — just strip the <style> block inside <defs>.
  // [^<]* matches any attribute chars including newlines; avoids touching clipPath.
  svg = svg.replace(/<style>[^<]*<\/style>\s*/s, '');

  // Replace the F <text> element.
  // Match: <text (multiline attrs, no < inside) >F</text>
  // [^<]* matches any char except < — this covers multiline attribute blocks because
  // JS character classes match \n by default.
  const fTextRe = /<text\b[^<]*>F<\/text>/;
  if (!fTextRe.test(svg)) throw new Error('Could not find <text> element for "F" in logo-B.svg');
  svg = svg.replace(fTextRe, fPathEl);

  // Replace the L <text> element similarly.
  const lTextRe = /<text\b[^<]*>L<\/text>/;
  if (!lTextRe.test(svg)) throw new Error('Could not find <text> element for "L" in logo-B.svg');
  svg = svg.replace(lTextRe, lPathEl);

  // 5. Write output
  const dest = APPLY ? SRC_SVG : OUT_SVG;
  fs.writeFileSync(dest, svg, 'utf8');
  console.log(`[4/4] Written → ${dest}`);

  if (!APPLY) {
    console.log('\n  Preview the outlined version, then run with --apply to replace logo-B.svg:');
    console.log('  node scripts/outline-svg-text.js --apply');
  } else {
    console.log('\n  logo-B.svg is now font-independent.');
    console.log('  Regenerate PNG icons: node scripts/generate-pwa-icons.js');
  }
}

main().catch((err) => {
  console.error('\nFailed:', err.message || err);
  process.exit(1);
});
