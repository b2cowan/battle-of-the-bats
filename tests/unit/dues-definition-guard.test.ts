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
  // The settlement's two write doors. Both quote money figures (what a row is owed, what may be
  // held back, what is left to forgive) and both must take them from the shared assembly — the
  // list has to grow with the surface it describes, or it quietly stops describing it.
  'app/api/coaches/[orgSlug]/teams/[teamId]/season-surplus/adjustments/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/season-surplus/payouts/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/upcoming-payables/route.ts',
  /* The register (money redesign P3): its scheduled overlay quotes what each instalment still owes,
     beside the payments that have already arrived. Same figure as the payment schedule, and it must
     come from the same place — the two screens sit one tab apart.
     ⚠ THE ENTRY MOVED, IT DID NOT LAPSE (2026-08-25). The book's assembly left the route for
     `lib/coach-register-book.ts` when `Start next season` became a second caller (mig 262), and this
     guard fired on the empty route — which was it WORKING. Renaming the entry is the whole edit;
     loosening the pattern so the old path still "passes" is the failure this list exists to
     prevent, and it would have left the dues arithmetic unguarded in its new home. */
  'lib/coach-register-book.ts',
  /* ⚠ The `/ask` route is GONE from this list because the route is gone (reports portal P1,
     2026-08-18): the "Ask about your team" bar was retired, and its two dues questions — what each
     family still owes, and who has not paid anything yet — are answered on the Money hub's Player
     Dues screen, which is already listed above via its own route. No dues-quoting surface lost its
     guard; one stopped existing. */
  /* ⚠ `lib/insights-digest.ts` is GONE from this list because the digest stopped quoting dues at
     all (owner decision 2026-08-28, reversing 2026-08-19's "money stays in the push"): the Sunday
     job no longer fetches or shapes a single dues figure — the fetch is the gate, pinned in
     tests/unit/coach-insights-portal.test.ts. No dues-quoting surface lost its guard; one stopped
     quoting. If money ever returns to the push, this entry returns with it. */
  'lib/insight-findings.ts',
  // The season settlement's assembly — every figure the sheet quotes starts in the shared model.
  'lib/coach-season-settlement.ts',
];

/** The only modules allowed to define the arithmetic. */
const DEFINITION_HOMES = new Set([
  'lib/dues-status.ts',
  'lib/dues-payments.ts',
  'lib/dues-credits.ts',
  // Pass 3: the season pot and the even-share solver. It derives no credit figure of its own —
  // it is handed the three-state position — but it IS where "what cash does the team hold"
  // lives, and the settlement assembly beside it is the one place the sheet is built.
  'lib/season-settlement.ts',
  'lib/coach-season-settlement.ts',
  /**
   * Money redesign P3: "what does this instalment still owe?" — the per-player assembly around
   * `deriveDuesPosition` (group the instalments, group the payments, hand both to the model with
   * that player's credits and payouts). It derives no arithmetic of its own; it is the one place
   * the ASSEMBLY lives, which is the part two screens were writing out by hand.
   *
   * ⚠ It became a home the moment it had two callers. The payment schedule quoted this figure with
   * its own copy of the loop, and the register needed the identical answer one tab away — the exact
   * shape that shipped "quote the face value" the first time, when a $300 instalment a family was
   * $200 into was advertised at $300.
   */
  'lib/coach-dues-remaining.ts',
]);

/** CLUB-MONEY surfaces — a DIFFERENT money domain (`rep_allocation_installments`). A club
 *  instalment has no payment record; its paid stamp IS the input, so a stamp-sum there is correct
 *  today. If club instalments ever gain a payment record, delete this list and let the test fail.
 *
 *  ⚠ THE PATH MOVED, THE EXEMPTION DID NOT WIDEN (money redesign P4, 2026-08-17). This named
 *  `accounting/allocations/panel.tsx`; Allocations and Payments merged into one Club tab, so the
 *  same code is at `accounting/club/panel.tsx`. Renaming the entry is the whole edit — the guard
 *  firing on the new path was it working, and the temptation to "fix" it by loosening the pattern
 *  is what the list exists to avoid. */
const ALLOCATION_DOMAIN = new Set([
  'app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx',
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
        // `coach-season-settlement` counts because it is itself a definition home that reads the
        // credit model — the season-surplus route quotes only what that assembly hands it, which
        // is the whole point of Pass 3 (the route it replaced hand-built its own breakdown, and
        // was twice the place the money went wrong).
        /from '@?\.?\.?\/?.*(dues-(status|payments|credits|remaining)|coach-season-settlement)/.test(src),
        `${f} quotes a dues figure but imports none of lib/dues-status, lib/dues-payments, lib/dues-credits, lib/coach-dues-remaining, lib/coach-season-settlement`,
      );
    }
  });

  /**
   * The typed season pot is DEAD (mig 235). `rep_season_surplus.total_surplus` survives as
   * history and must stay unread: it was a number a human typed, it double-subtracted
   * fundraising rebates, and nothing on screen could see that it was wrong. The pot derives now.
   *
   * ⚠ A live column that nothing reads is a drift smell in its own right — this rule is what
   * stops a future session "restoring" it because it looked like a convenient total.
   */
  it('nothing reads the legacy typed pot', () => {
    const files = [
      ...walk(join(ROOT, 'app')),
      ...walk(join(ROOT, 'lib')),
    ];
    const offenders: string[] = [];
    for (const p of files) {
      const src = readFileSync(p, 'utf8');
      if (/total_surplus|totalSurplus/.test(src)) offenders.push(rel(p));
    }
    assert.deepEqual(
      offenders,
      [],
      'the hand-typed season pot (rep_season_surplus.total_surplus) is legacy and read by nothing '
      + 'since Pass 3 — the pot DERIVES (lib/season-settlement.ts):\n  ' + offenders.join('\n  '),
    );
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
