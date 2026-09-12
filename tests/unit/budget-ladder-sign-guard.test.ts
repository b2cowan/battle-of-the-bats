/**
 * **THE ROWS ON THE BUDGET PLAN WHOSE LABEL DOES NOT CARRY THEIR DIRECTION.**
 *
 * The Budget plan panel has its own money formatter, and it is deliberately ABSOLUTE:
 *
 *     function fmt(n: number) { return `$${Math.abs(n).toLocaleString(...)}`; }
 *
 * That is right for almost every figure on the plan, because their LABELS say which way the
 * money goes — *Over your estimate* is over, *Still to itemize* is still to come. Printing a minus
 * beside a word that already means "negative" made readers re-check arithmetic (owner,
 * 2026-08-13), so the sign was dropped and the label kept.
 *
 * ⚠⚠ **THE BALANCE ROWS ARE THE EXCEPTION, AND THEY ARE THE REASON THIS FILE EXISTS.** Opening
 * balance, Net (for the month, for the quarter, for the season) and Closing balance state an
 * arithmetic result and nothing else. Rendered through the panel's absolute formatter, a season
 * $2,000 in the hole would read **"Closing balance  $2,000.00"** — stating the exact opposite of
 * the truth, with nothing on the row to hint at it. A wrong number that looks right is worse than
 * a missing one.
 *
 * So those rows — and only those rows — take the portal's SHARED formatter, which brackets a
 * negative the way every other money string a coach reads does, and paint the bracket RED (a
 * balance below zero is Budget vs. Actual's warning, never the deleted plan-close's green).
 *
 * **History.** Until 2026-09-12 this guard pinned *Costs less funding*, the one row of the old
 * closing ladder with the same property; that ladder (Costs less funding → Player installments →
 * Shortfall (Buffer)) was replaced by the balance rows under owner decisions A–D (revenue-first
 * project), and the guard was REVISED to pin the rows that inherited the hazard rather than
 * deleted to make the gate pass (plan §8's own rule). The §164 `/review` had flagged the original
 * spot twice — once in a comment that did not survive the next edit — which is why this is a
 * build-enforced guard and not a comment.
 *
 * ⚠ WHY A SOURCE GUARD AND NOT AN ASSERTION ON A NUMBER. The arithmetic is already pinned in
 * `coach-budget-periods-view.test.ts`; what cannot be pinned by running the module is **which
 * formatter the JSX reaches for**. Both spellings compile, both produce a plausible-looking dollar
 * figure, and only one of them is true in the state that matters.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const PANEL = path.join(
  process.cwd(),
  'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx',
);

/** The file with its comments stripped — the explanations above contain the strings forbidden below. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
}

describe('the balance rows keep their sign', () => {
  const src = codeOnly(fs.readFileSync(PANEL, 'utf8'));

  it('renders every balance figure through one signed helper built on the bracket formatter', () => {
    // The helper is the one place a balance cell is drawn; it must read the SHARED formatter.
    assert.match(
      src,
      /function balanceFigure\([\s\S]*?fmtSigned\(n\)/,
      '`balanceFigure` must draw a full-width balance through the shared bracket formatter '
      + '(imported as `fmtSigned`) — see this file\'s header for why',
    );
    assert.match(
      src,
      /function balanceFigure\([\s\S]*?fmtCell\(n\)/,
      '`balanceFigure` must draw a grid cell through `fmtCell`, the compact twin of the bracket formatter',
    );
    assert.doesNotMatch(
      /function balanceFigure\([\s\S]*?\n}/.exec(src)?.[0] ?? '',
      /\bfmt\(/,
      '`balanceFigure` must NOT reach for the panel\'s local `fmt`, which is Math.abs() and would '
      + 'print a season in the hole as a positive figure — the opposite of the truth',
    );
  });

  it('every Opening / Net / Closing figure on both views goes through that helper, never the local fmt', () => {
    for (const field of ['seasonOpening', 'seasonNet', 'seasonClosing']) {
      assert.doesNotMatch(
        src,
        new RegExp(`\\bfmt\\(balance\\.${field}\\)`),
        `balance.${field} is rendered through the absolute formatter somewhere — it must go through balanceFigure / fmtSigned`,
      );
      assert.doesNotMatch(
        src,
        new RegExp(`\\bfmt\\(view\\.balance\\.${field}\\)`),
        `view.balance.${field} is rendered through the absolute formatter somewhere — it must go through balanceFigure / fmtSigned`,
      );
    }
    // The three rows exist on the grid and the List — the guard is only worth anything if they do.
    assert.match(src, /balanceCells\(balance\.net, balance\.seasonNet, balance\.undatedNet\)/, 'the grid\'s Net row');
    assert.match(src, /balanceCells\(balance\.closing, balance\.seasonClosing, null\)/, 'the grid\'s Closing row');
    assert.match(src, /balanceFigure\(balance\.seasonNet, false\)/, 'the List\'s Season net row');
    assert.match(src, /balanceFigure\(balance\.seasonClosing, false\)/, 'the List\'s Closing balance row');
  });

  it('paints a negative balance RED, never the retired plan-close green', () => {
    assert.match(src, /styles\.periodGridBelow/, 'the below-zero class is applied to a balance figure');
    assert.doesNotMatch(
      src,
      /periodGridAhead/,
      '`periodGridAhead` was the old Shortfall (Buffer) row\'s GREEN bracket — a balance below zero '
      + 'is the warning colour, and this class must not come back on any cell',
    );
  });

  it('still imports the shared formatter under a name that says what it does', () => {
    assert.ok(
      /import \{[^}]*fmt as fmtSigned[^}]*\} from '@\/lib\/coach-money-summary'/.test(src),
      'the shared formatter is imported as `fmtSigned` so the two formatters in this file cannot '
      + 'be confused for one another at the call site',
    );
  });

  it('leaves the label-carries-direction rows on the absolute formatter', () => {
    // The rows whose WORDS say the direction keep the unsigned figure — this guard must not be
    // read as "sign everything". If these ever move to the bracket formatter it is a separate
    // owner ruling, not a tidy-up.
    assert.ok(
      src.includes('fmt(periodView.estimateRows.remainder.total)'),
      'Still to itemize / Over your estimate stays absolute on the List',
    );
    assert.ok(src.includes('fmt(estimateRemainder)'), 'the status line\'s "Over your estimate by" stays absolute');
    assert.ok(src.includes('fmt(requiredDues)'), 'Required player dues is floored at zero and stays absolute');
  });
});
