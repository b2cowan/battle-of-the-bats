/**
 * OUR MARK ON A DOCUMENT — the two things about it that can silently stop being true.
 *
 * The footer's logo is fetched from a static file at export time rather than inlined, which keeps
 * it out of the bundle and lets it fail soft. The cost of that choice is a path that nothing else
 * in the codebase holds: rename or delete the icon and the mark quietly stops appearing, on a
 * surface nobody looks at twice.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BRAND_MARK_SRC, loadBrandMark } from '../../lib/export/brand-mark.ts';

describe('the brand mark a document draws', () => {
  test('the path points at a real PNG that ships in public/', () => {
    const onDisk = new URL(`../../public${BRAND_MARK_SRC}`, import.meta.url);
    assert.ok(fs.existsSync(onDisk), `${BRAND_MARK_SRC} is not in public/ — the footer would lose its mark`);
    const bytes = fs.readFileSync(onDisk);
    /* A real PNG, not an SVG someone swapped in behind the same name: a spreadsheet can only
       embed a raster, and the magic number is the only thing that actually proves it. */
    assert.deepEqual(
      [...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      'the brand mark must be a PNG — a spreadsheet cannot embed a vector');
    /* Small enough to fetch on every branded export. 512 is eight times this and is drawn at 26px;
       if this ever grows past a few KB, something has been swapped for the wrong icon. */
    assert.ok(bytes.length < 20_000, `brand mark is ${bytes.length} bytes — too heavy to fetch per export`);
  });

  test('it fails soft off the browser rather than throwing into a download', () => {
    /* The last step before a treasurer gets their file is the worst place to throw. Server-side —
       and in any environment without the browser APIs it reaches for — it must resolve, not
       reject. Node has `fetch` but no `FileReader`, which is exactly the half-available case. */
    return loadBrandMark().then(
      value => assert.ok(value === null || typeof value === 'string'),
      err => assert.fail(`loadBrandMark rejected instead of returning null: ${err}`));
  });
});
