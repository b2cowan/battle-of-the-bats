/**
 * PROMOTIONS ARE A RECORD, NOT A DISCOUNT (owner ruling 2026-11-03, Plans & pricing Stage 1 Part 1, option A).
 *
 * A promotion is a row in `platform_catalog_campaigns`, written and read only by the staff Plans & pricing
 * screen. No checkout reads it: setting one to Active gives no customer a discount, and the screen says so.
 * The owner kept it that way on purpose. Enforcing promotions needs a stacking rule against operator free
 * time, Founding Season comps and the Club trial that nobody has ruled, then an `/accounting` review.
 *
 * This guard fails when that decision is crossed without being revisited:
 *   1. any source file other than the two below starts reading the table;
 *   2. any source file starts handing Stripe a discount (coupons, promotion codes, `discounts:`).
 *
 * If one fails, the change is not necessarily wrong, it is just not decided. Take it to `/strategy`
 * (the stacking rule) and `/accounting`, plan it as its own stage (STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md,
 * "Promotions: record vs enforce", option C), and edit this file in the same commit. Then the staff
 * screen's "not linked to checkout" wording and the two help articles that quote it must change too.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'lib', 'components'];

/** The only files allowed to touch the table: the staff screen's read and its own save route. */
const ALLOWED_READERS = new Set([
  'app/api/platform-admin/product-catalog/campaigns/route.ts',
  'app/platform-admin/plans-pricing/page.tsx',
]);

/** Ways a Stripe checkout or subscription would be handed a discount. */
const STRIPE_DISCOUNT = /allow_promotion_codes|\bdiscounts\s*:|promotion_code|\bcoupons\.(create|retrieve|list)|promotionCodes\./;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap(d => sourceFiles(join(ROOT, d))).map(full => ({
  path: relative(ROOT, full).split(sep).join('/'),
  text: readFileSync(full, 'utf8'),
}));

describe('promotions are a record, not a discount', () => {
  it('scans a real tree (the guard is not blind)', () => {
    assert.ok(files.length > 500, `expected to scan the source tree, found ${files.length} files`);
    for (const allowed of ALLOWED_READERS) {
      const file = files.find(f => f.path === allowed);
      assert.ok(file, `${allowed} is no longer where this guard expects it; update ALLOWED_READERS`);
      assert.match(file.text, /platform_catalog_campaigns/, `${allowed} no longer reads the table; update ALLOWED_READERS`);
    }
  });

  it('only the staff screen and its save route read platform_catalog_campaigns', () => {
    const readers = files
      .filter(f => f.text.includes('platform_catalog_campaigns') && !ALLOWED_READERS.has(f.path))
      .map(f => f.path);
    assert.deepEqual(
      readers,
      [],
      `Promotions are record-only (owner ruling 2026-11-03). These files now read them: ${readers.join(', ')}. ` +
        'If a checkout is meant to honour promotions, that is a new stage: /strategy for the stacking rule, then /accounting.',
    );
  });

  it('nothing hands Stripe a coupon, promotion code or discount', () => {
    const offenders = files.filter(f => STRIPE_DISCOUNT.test(f.text)).map(f => f.path);
    assert.deepEqual(
      offenders,
      [],
      `Promotions are record-only (owner ruling 2026-11-03), so no checkout applies a discount. Found in: ${offenders.join(', ')}. ` +
        'Revisit the ruling (/strategy, then /accounting) before shipping a discount.',
    );
  });
});
