/**
 * A STOCK LOGO IS MADE IN THE CLUB'S COLOUR (owner, 2026-10-18; lib/stock-logo-render.ts).
 *
 * The stock art is a white mark on nothing, so saved as-is it vanished on every light surface and
 * every export. A pick is now drawn onto a circle of the club's main colour, in dark ink when that
 * colour is too light for white. These pin the three things that make it work: every logo renders,
 * the ink follows the colour, and the stored file name reads back as the record of what was made.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { STOCK_LOGOS } from '../../lib/stock-logos.ts';
import { renderStockLogoPng, parseStockLogoUrl } from '../../lib/stock-logo-render.ts';
import { STOCK_LOGO_ART } from '../../lib/stock-logo-art.ts';
import { resolveTheme } from '../../lib/themes.ts';

async function pixels(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4));
  let white = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 250 && data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) white++;
  }
  return { info, at, white };
}

describe('stock logos are made on the club colour', () => {
  it('every stock logo renders as a 512px circle of the colour, transparent outside it', async () => {
    for (const logo of STOCK_LOGOS) {
      const { info, at } = await pixels(await renderStockLogoPng(logo, { primary: '#1E3A8A', onPrimary: '#FFFFFF' }));
      assert.equal(info.width, 512, logo.id);
      assert.equal(info.height, 512, logo.id);
      assert.equal(at(4, 4)[3], 0, `${logo.id}: the corner is outside the circle`);
      // Just inside the top edge, above where any mark reaches: the club's colour.
      assert.deepEqual(at(256, 24), [0x1e, 0x3a, 0x8a, 255], `${logo.id}: the circle wears the colour`);
    }
  });

  it('a dark colour takes a white mark; a light one takes dark ink, never white', async () => {
    const dark = resolveTheme('platform', '#1E3A8A', null);
    const light = resolveTheme('platform', '#FDE68A', null);
    for (const logo of STOCK_LOGOS) {
      const onDark = await pixels(await renderStockLogoPng(logo, dark));
      const onLight = await pixels(await renderStockLogoPng(logo, light));
      assert.ok(onDark.white > 200, `${logo.id}: white mark on the dark colour`);
      assert.equal(onLight.white, 0, `${logo.id}: no white on the light colour`);
    }
  });

  it('the stored file name reads back as the logo and the colour it was made in', () => {
    const org = '0b6f2a8e-1111-4222-8333-944455556666';
    const base = `https://example.supabase.co/storage/v1/object/public/org-logos/${org}`;
    for (const logo of STOCK_LOGOS) {
      const parsed = parseStockLogoUrl(`${base}/stock-${logo.id}-1e3a8a-1760000000000.png`, org);
      assert.equal(parsed?.logo.id, logo.id);
      assert.equal(parsed?.hex, '#1e3a8a');
      assert.equal(parsed?.objectPath, `${org}/stock-${logo.id}-1e3a8a-1760000000000.png`);
    }
    // An uploaded logo, an old art path, an unknown logo and no logo are not stock picks.
    assert.equal(parseStockLogoUrl(`${base}/logo.png?v=1`, org), null);
    assert.equal(parseStockLogoUrl('/stock-logos/crown.svg', org), null);
    assert.equal(parseStockLogoUrl(`${base}/stock-unicorn-1e3a8a-1.png`, org), null);
    assert.equal(parseStockLogoUrl(null, org), null);
  });

  it('a stored URL never names another org’s file — the path drives a service-role delete', () => {
    const org = '0b6f2a8e-1111-4222-8333-944455556666';
    const other = 'ffffffff-2222-4333-8444-955566667777';
    const file = 'stock-crown-1e3a8a-1760000000000.png';
    const storage = 'https://example.supabase.co/storage/v1/object/public/org-logos';
    assert.equal(parseStockLogoUrl(`${storage}/${other}/${file}`, org), null, 'another org’s folder');
    assert.equal(parseStockLogoUrl(`${storage}/${org}/x/${file}`, org), null, 'a deeper path');
    assert.equal(parseStockLogoUrl(`${storage}/${file}`, org), null, 'no folder');
    assert.equal(parseStockLogoUrl(`${storage}/${org}/../${other}/${file}`, org), null, 'a climb out');
    assert.ok(parseStockLogoUrl(`${storage}/${org}/${file}`, org), 'its own folder');
  });

  it('the server’s copy of the art is the picker’s files, byte for byte', async () => {
    const { readFile } = await import('node:fs/promises');
    for (const logo of STOCK_LOGOS) {
      const file = (await readFile(`public${logo.file}`, 'utf8')).replace(/\r\n/g, '\n').trimEnd();
      assert.equal(STOCK_LOGO_ART[logo.id], file, `${logo.id}: lib/stock-logo-art.ts must match ${logo.file}`);
    }
    assert.equal(Object.keys(STOCK_LOGO_ART).length, STOCK_LOGOS.length, 'no art without a logo');
  });
});
