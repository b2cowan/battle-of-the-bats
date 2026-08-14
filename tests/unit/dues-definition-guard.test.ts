/**
 * ONE definition of "paid" — enforced over the source tree, not promised in comments.
 *
 * The dues figures drifted twice before this project: three hand-copies of "outstanding" (each
 * with a comment promising parity), then a fourth in season-surplus, an inline never-paid MIRROR
 * in money-summary (which had quietly diverged — it subtracted credits where the real predicate
 * doesn't), and stamp-sum arithmetic in five readers. Pass 2 consolidated all of them onto
 * lib/dues-status.ts + lib/dues-payments.ts. This test is what stops copy number five.
 *
 * Two rules:
 *  1. Every file that quotes a coach dues figure imports the shared definitions.
 *  2. Nowhere outside those two modules may a file re-derive "paid" by summing paid-stamped
 *     installments — since mig 232 the stamps are a coverage PROJECTION, and a stamp-sum reads
 *     a part-paid family as having paid nothing (the defect this whole project exists to fix).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

/** Files that quote a dues figure and MUST read the shared definitions. */
const REQUIRED_IMPORTERS = [
  'app/api/coaches/[orgSlug]/teams/[teamId]/dues/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/dues/[scheduleId]/installments/[installId]/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/money-summary/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/season-surplus/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/upcoming-payables/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/ask/route.ts',
  'lib/insights-digest.ts',
  'lib/insight-findings.ts',
];

/** The only modules allowed to define the arithmetic. */
const DEFINITION_HOMES = new Set(['lib/dues-status.ts', 'lib/dues-payments.ts', 'lib/dues-credits.ts']);

/** ORG-ALLOCATION surfaces — a DIFFERENT money domain (rep_allocation_installments). Allocations
 *  have no payment record; their paid stamp is still the input, so a stamp-sum there is correct
 *  today. If allocations ever gain a payment record, delete this list and let the test fail. */
const ALLOCATION_DOMAIN = new Set([
  'app/[orgSlug]/coaches/teams/[teamId]/accounting/allocations/panel.tsx',
]);

/** A positive filter on the paid stamp followed by a sum — the classic inline paid-derivation.
 *  (Negated filters like `!i.paidAt` are fine: "which installments are open" is a plan question,
 *  and the projection answers it; it is DERIVING DOLLARS PAID from stamps that is banned.) */
const STAMP_SUM = /\.filter\(\s*(\w+)\s*=>\s*\1\.(paidAt|paid_at)\s*\)[\s\S]{0,120}?\.reduce\(/;

/** A comment claiming to mirror the shared predicate instead of importing it. */
const MIRROR_COMMENT = /Mirror lib\/dues-status/;

/** A hand-rolled credit sum — a reduce-accumulate or map-accumulate over a credit-named
 *  collection's amounts. Summing rep_dues_credits was re-implemented independently FIVE times
 *  (four routes + the dues panel) before lib/dues-credits.ts existed, with zero tests on any of
 *  them; this is the same treatment that stopped stamp-sum copy five. Listing rows, inserting,
 *  or deleting credits is fine — it is DERIVING A CREDIT TOTAL outside the module that is
 *  banned. */
const CREDIT_SUM = /\b\w*[Cc]redit\w*\.reduce\(\s*\(\s*\w+\s*,\s*\w+(?:\s*:\s*\w+)?\s*\)\s*=>\s*\w+\s*\+/;
const CREDIT_MAP_ACCUM = /\b\w*[Cc]redit\w*\.set\(\s*[^,]+,\s*\(\s*\w*[Cc]redit\w*\.get\([^)]*\)\s*\?\?\s*0\s*\)\s*\+/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => p.slice(ROOT.length + 1).replaceAll('\\', '/');

describe('dues definitions have one home', () => {
  it('every dues-quoting surface imports the shared definitions', () => {
    for (const f of REQUIRED_IMPORTERS) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      assert.ok(
        /from '@?\.?\.?\/?.*dues-(status|payments|credits)/.test(src),
        `${f} quotes a dues figure but imports none of lib/dues-status, lib/dues-payments, lib/dues-credits`,
      );
    }
  });

  it('no unsanctioned file WRITES the paid stamp directly (it is a projection, not an input)', () => {
    // The one High of the 2026-08-13 review: the Basic→Premium upgrade migration still stamped
    // paid_at with no payment row behind it — the family showed as owing everything while both
    // reminder paths skipped them. Stamp writes are sanctioned only where they travel WITH the
    // payment facts: the projection itself, the mark-paid claim (reverted on failure), the
    // upgrade migration's stamp+payment pair, and the demo re-anchor (which shifts payments too).
    const SANCTIONED_STAMP_WRITERS = new Set([
      'lib/db.ts',
      'lib/demo-coach-reconcile-core.ts',
      'lib/coach-upgrade-migration.ts',
      'app/api/coaches/[orgSlug]/teams/[teamId]/dues/[scheduleId]/installments/[installId]/route.ts',
    ]);
    const files = [
      ...walk(join(ROOT, 'app')),
      ...walk(join(ROOT, 'lib')),
    ];
    const offenders: string[] = [];
    for (const p of files) {
      const r = rel(p);
      if (SANCTIONED_STAMP_WRITERS.has(r)) continue;
      const src = readFileSync(p, 'utf8');
      if (src.includes('rep_player_dues_installments') && /\.update\(\s*\{\s*paid_at/.test(src)) {
        offenders.push(r);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `direct paid_at write on rep_player_dues_installments outside the sanctioned writers — route the money through recordRepDuesPayment (or pair the stamp with its payment):\n  ${offenders.join('\n  ')}`,
    );
  });

  it('no file outside the definition homes sums credits by hand', () => {
    const files = [
      ...walk(join(ROOT, 'app', 'api', 'coaches')),
      ...walk(join(ROOT, 'app', '[orgSlug]', 'coaches')),
      ...walk(join(ROOT, 'lib')),
    ];
    const offenders: string[] = [];
    for (const p of files) {
      const r = rel(p);
      if (DEFINITION_HOMES.has(r)) continue;
      const src = readFileSync(p, 'utf8');
      if (CREDIT_SUM.test(src) || CREDIT_MAP_ACCUM.test(src)) offenders.push(r);
    }
    assert.deepEqual(
      offenders,
      [],
      `hand-rolled credit sum found outside lib/dues-credits — use creditsTotal / totalsByPlayer instead:\n  ${offenders.join('\n  ')}`,
    );
  });

  it('no file outside the definition homes derives paid dollars from installment stamps', () => {
    const files = [
      ...walk(join(ROOT, 'app', 'api', 'coaches')),
      ...walk(join(ROOT, 'app', '[orgSlug]', 'coaches')),
      ...walk(join(ROOT, 'lib')),
    ];
    const offenders: string[] = [];
    for (const p of files) {
      const r = rel(p);
      if (DEFINITION_HOMES.has(r) || ALLOCATION_DOMAIN.has(r)) continue;
      const src = readFileSync(p, 'utf8');
      if (STAMP_SUM.test(src) || MIRROR_COMMENT.test(src)) offenders.push(r);
    }
    assert.deepEqual(
      offenders,
      [],
      `stamp-sum "paid" derivation (or a mirror-comment) found outside lib/dues-status + lib/dues-payments — import the shared definitions instead:\n  ${offenders.join('\n  ')}`,
    );
  });
});
