/**
 * **THE ONE ROW ON THE BUDGET LADDER WHOSE LABEL DOES NOT CARRY ITS DIRECTION.**
 *
 * The Budget plan panel has its own money formatter, and it is deliberately ABSOLUTE:
 *
 *     function fmt(n: number) { return `$${Math.abs(n).toLocaleString(...)}`; }
 *
 * That is right for almost every figure on the ladder, because their LABELS say which way the
 * money goes — *Planned buffer* is a buffer, *Over your estimate* is over, *Short of covering the
 * plan* is short. Printing a minus beside a word that already means "negative" made readers
 * re-check arithmetic (owner, 2026-08-13), so the sign was dropped and the label kept.
 *
 * ⚠⚠ **`Costs less funding` IS THE EXCEPTION, AND IT IS THE REASON THIS FILE EXISTS.** Its label
 * states an arithmetic result and nothing else. It used to print `fundedByPlayers` — floored at
 * zero — so a season whose funding covered the whole plan read **$0.00** while the By-period grid
 * read a bracketed negative: one name, two numbers, on two views of one screen. Unflooring it
 * (owner ruling 2026-09-09) fixed that and immediately created a worse hazard one level down:
 * rendered through the panel's absolute formatter, an over-funded plan would read
 * **"Costs less funding  $2,000.00"** — stating the exact opposite of the truth, with nothing on
 * the row to hint at it. A wrong number that looks right is worse than a floored one that is
 * merely incomplete.
 *
 * So that row — and only that row — takes the portal's SHARED formatter, which brackets a negative
 * the way every other money string a coach reads does.
 *
 * ⚠ WHY A SOURCE GUARD AND NOT AN ASSERTION ON A NUMBER. The arithmetic is already pinned in
 * `coach-budget-totals.test.ts`; what cannot be pinned by running the module is **which formatter
 * the JSX reaches for**. Both spellings compile, both produce a plausible-looking dollar figure,
 * and only one of them is true in the state that matters. The /review of 2026-09-08 flagged this
 * exact spot once before, in a comment; the comment did not survive contact with the next edit.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const PANEL = path.join(
  process.cwd(),
  'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx',
);

describe('the Costs less funding row keeps its sign', () => {
  const src = fs.readFileSync(PANEL, 'utf8');

  it('renders through the bracket formatter, never the panel\'s absolute one', () => {
    assert.ok(
      src.includes('fmtSigned(totals.costsLessFunding)'),
      'the Costs less funding row must render `costsLessFunding` through the shared bracket '
      + 'formatter (imported as `fmtSigned`) — see this file\'s header for why',
    );
    assert.ok(
      !/\bfmt\(totals\.costsLessFunding\)/.test(src),
      'the Costs less funding row must NOT use the panel\'s local `fmt`, which is Math.abs() and '
      + 'would print an over-funded plan as a positive figure — the opposite of the truth',
    );
  });

  it('still imports the shared formatter under a name that says what it does', () => {
    assert.ok(
      /import \{[^}]*fmt as fmtSigned[^}]*\} from '@\/lib\/coach-money-summary'/.test(src),
      'the shared formatter is imported as `fmtSigned` so the two formatters in this file cannot '
      + 'be confused for one another at the call site',
    );
  });

  it('leaves the ladder\'s label-carries-direction rows on the absolute formatter', () => {
    // The rows whose WORDS say the direction keep the unsigned figure — this guard must not be
    // read as "sign everything". If these ever move to the bracket formatter it is a separate
    // owner ruling, not a tidy-up.
    assert.ok(src.includes('fmt(leftToFund)'), 'Planned buffer / Short of covering the plan stays absolute');
    assert.ok(src.includes('fmt(tableTotals.difference)'), 'Still to itemize / Over your estimate stays absolute');
  });
});
