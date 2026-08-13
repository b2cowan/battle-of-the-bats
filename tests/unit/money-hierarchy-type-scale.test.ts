import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * ONE TYPE SCALE FOR A MONEY HIERARCHY, WHATEVER DRAWS IT.
 *
 * ⚠ WHY THIS TEST EXISTS, and it is not hypothetical. The Money hub draws the same
 * category → line → total structure two ways: as an OUTLINE (`.ledger*`, used by Budget Plan's
 * List view and Budget vs. Actual's Categories view) and as a GRID (`.moneyGrid*`, used by Budget
 * Plan's By-period view and Budget vs. Actual's Months view). On Budget Plan the two are ONE TOGGLE
 * APART on ONE screen.
 *
 * They drifted apart twice in a single day, and both times the fix was applied only to the half
 * being looked at:
 *   1. The grids' bodies were left alone when their heading rows were unified — owner: *"these
 *      still look like 2 differently formatted tables."*
 *   2. The grid adopted the ruling that a category is the LARGEST name in its group, and the
 *      outline kept small caps — owner: *"shouldn't we also be consistent between list and by
 *      period?"* One toggle turned "Tournaments" into "TOURNAMENTS" and inverted the hierarchy back.
 *
 * A comment asking the next contributor to change both has now failed twice, so this parses the
 * real stylesheet and fails the build instead. It asserts EQUALITY between the two treatments, not
 * specific values — the scale can be re-ratified freely, it just cannot fork.
 *
 * ⚠ It reads the stylesheet rather than restating the numbers, for the same reason the warm-palette
 * contrast test does: a copy of the values is a second source that goes stale on its own.
 */

const CSS = readFileSync(
  path.join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'coaches.module.css'),
  'utf8',
);

/** The declaration block of a rule whose selector list contains `selector` exactly. */
function block(selector: string): string {
  // Match a rule whose selector list includes this exact class (not a longer one sharing a prefix),
  // and take the FIRST such block — later overrides live in media queries, which are scoped and are
  // not what this test is about.
  const re = new RegExp(
    `(^|[,{}])\\s*${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*(,[^{]*)?\\{([^}]*)\\}`,
    'm',
  );
  const m = CSS.match(re);
  assert.ok(m, `No rule found for "${selector}" — the class was renamed or removed. Update this test WITH the rename; do not delete it.`);
  return m![3];
}

function prop(selector: string, name: string): string {
  const b = block(selector);
  const m = b.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`));
  assert.ok(m, `"${selector}" no longer declares ${name} — if it moved, move this assertion with it.`);
  return m![1].trim();
}

/**
 * Resolve a declaration to a number of rem, following ONE level of `var(--x)` indirection.
 *
 * Both families now read the scale from custom properties, so `prop()` legitimately returns
 * `var(--money-cat-size)` rather than a length. The equality assertions below still work on the raw
 * string (and are stronger for it — they now prove both sides reference the SAME variable, which
 * also catches someone hard-coding one side back to a literal). Only the RELATIONAL assertion needs
 * a real number, so only it resolves.
 */
function rem(value: string): number {
  const varRef = value.match(/^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/);
  if (varRef) {
    const decl = CSS.match(new RegExp(`${varRef[1]}\\s*:\\s*([^;]+)`));
    assert.ok(decl, `${varRef[1]} is referenced but never declared — the money type scale lost its source.`);
    value = decl![1].trim();
  }
  const n = parseFloat(value);
  assert.ok(Number.isFinite(n), `Could not read a length from "${value}".`);
  return n;
}

test('money hierarchy — the outline and the grid share ONE type scale', async (t) => {
  await t.test('a CATEGORY measures the same in both', () => {
    assert.equal(
      prop('.ledgerName', 'font-size'),
      prop('.moneyGrid tbody tr.moneyGridCat th', 'font-size'),
      'The outline\'s category name and the grid\'s category row disagree on size. They are one toggle apart on Budget Plan.',
    );
    assert.equal(
      prop('.ledgerName', 'font-weight'),
      prop('.moneyGrid tbody tr.moneyGridCat th', 'font-weight'),
      'The outline\'s category name and the grid\'s category row disagree on weight.',
    );
  });

  await t.test('a LINE measures the same in both', () => {
    assert.equal(
      prop('.ledgerDesc', 'font-size'),
      prop('.moneyGrid tbody th', 'font-size'),
      'The outline\'s line name and the grid\'s line name disagree on size.',
    );
    assert.equal(
      prop('.ledgerDesc', 'font-weight'),
      prop('.moneyGrid tbody th', 'font-weight'),
      'The outline\'s line name and the grid\'s line name disagree on weight.',
    );
  });

  await t.test('the CLOSING TOTAL measures the same in both', () => {
    assert.equal(
      prop('.ledgerTotal', 'font-size'),
      prop('.moneyGrid tbody tr.moneyGridTotal th', 'font-size'),
      'The outline\'s total row and the grid\'s total row disagree on size.',
    );
    assert.equal(
      prop('.ledgerTotal', 'font-weight'),
      prop('.moneyGrid tbody tr.moneyGridTotal th', 'font-weight'),
      'The outline\'s total row and the grid\'s total row disagree on weight.',
    );
  });

  await t.test('a CATEGORY outranks its own lines — the hierarchy never inverts again', () => {
    const cat = rem(prop('.ledgerName', 'font-size'));
    const line = rem(prop('.ledgerDesc', 'font-size'));
    assert.ok(
      cat > line,
      `A category (${cat}rem) must read LARGER than the lines it groups (${line}rem). `
      + 'Owner ruling 2026-08-13: a parent row is the largest name in its group. '
      + 'Small caps do not count as "louder" — uppercase has no ascenders or descenders, so it '
      + 'measures a SHORTER cap-height at the same nominal size.',
    );
  });

  await t.test('a CATEGORY is never set in small caps', () => {
    // The whole defect in one assertion: the category used to be an uppercase eyebrow.
    const b = block('.ledgerName');
    assert.ok(
      !/text-transform\s*:\s*uppercase/.test(b),
      'The category name is back in small caps. A category is a NAME at the top of its group, not '
      + 'an eyebrow above it (owner ruling 2026-08-13).',
    );
    const g = block('.moneyGrid tbody tr.moneyGridCat th');
    assert.ok(
      !/text-transform\s*:\s*uppercase/.test(g),
      'The grid\'s category row is back in small caps — same ruling.',
    );
  });
});
