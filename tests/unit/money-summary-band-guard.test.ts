/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **EVERY MONEY TAB OPENS THE SAME WAY** (owner ruling 2026-09-03, D1 + D6 of
 * `docs/projects/active/COACH_MONEY_BANNER_STANDARD_PLAN.md`).
 *
 * ⚠⚠ WHY A GUARD RATHER THAN A CONVENTION, measured. Five money tabs opened with a summary and
 * drew it five ways: a prose strip on Budget vs. Actual, three cells on Club, four bordered cards
 * on Fundraising, a titled panel on Budget Plan, and on Player Dues nothing at all — its figures
 * sat in a table foot below the roster. Read off the stylesheets, the differences were not choices
 * but accidents of build order: label 11px vs 12px, tracking .07em vs .04em, figure weight 700 vs
 * 900, tabular numerals on three of four. A treasurer reads all five in one sitting and had to find
 * the summary somewhere new each time.
 *
 * The precedent for making this a TEST rather than a comment is one layer down:
 * `money-hierarchy-type-scale.test.ts` exists because the money TABLES forked into two type scales
 * twice in a single day, each time fixed only on the half someone was looking at — and its header
 * records that a comment asking the next contributor to change both had already failed twice.
 *
 * THE RULES, in the order they are asserted below:
 *   1. **The roster is closed.** Every `accounting/<tab>/panel.tsx` is classified here as a band
 *      tab or a deliberate no-summary tab. A NEW money tab fails until someone classifies it,
 *      which is the moment to ask "does this tab have a summary? then it uses the band."
 *   2. **A band tab imports and renders `MoneySummaryBand`.** Catches a tab quietly going back to
 *      drawing its own.
 *   3. **The tile roster is stated here, in order.** Which three or four figures a tab leads with
 *      is the single most-ruled-on question of this whole programme — every one of them was an
 *      owner decision, several were argued twice. Changing one is a decision, not a refactor, and
 *      it should have to be written down in one place. This also enforces the recipe's cap: no
 *      band may carry more than four tiles, because the stylesheet has rules for 2, 3 and 4 and a
 *      fifth would silently render into a four-column grid.
 *   4. **No coach money panel borrows the admin summary-card family.** `.summaryGrid` /
 *      `.summaryCard` belong to the org- and platform-admin screens; Fundraising was using them
 *      until 2026-09-04, which is exactly the drift this rule ends.
 *   5. **The guard must not go blind.** A tiles expression it cannot parse fails here rather than
 *      passing vacuously — the lesson that cost nine tag routes their coverage in 2026-08.
 *
 * If one of these fails, the change is not necessarily wrong — it just isn't recorded yet. Take
 * the question to the owner, then edit the table below in the same commit.
 *
 * ⚠⚠ **SCOPE LIMITS, STATED SO THEY ARE NOT MISTAKEN FOR COVERAGE.** This is a source SCAN:
 *
 *   1. **It cannot recognise a brand-new hand-rolled summary.** If tab six invents `.sixBand` in
 *      `coaches.module.css` and renders it, rule 4 will not see it — only rule 1 will, because
 *      that tab cannot exist without being classified here. Rule 1 is therefore the load-bearing
 *      one, and the reason the roster is a closed list rather than a glob with exceptions.
 *   2. **It does not render anything.** Whether the band actually stacks all-or-nothing at 760, or
 *      clears the tap floor, is proven by `scripts/check-layout-invariants.mjs` against the real
 *      screens at four widths — which is stronger evidence than a jsdom render and is why no React
 *      test harness was added for this.
 *   3. **Room tile strips are OUT OF SCOPE and that is deliberate.** A drive's room, a sponsor's
 *      room and a bill's room each carry a three-tile strip, ruled separately by List · Room ·
 *      Question. They are a different object — a record, not a tab — and folding them in here
 *      would let a room's ruling be changed by editing a tab's guard.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd());
const MONEY = path.join(ROOT, 'app/[orgSlug]/coaches/teams/[teamId]/accounting');

/**
 * ⚠ THE TILE ROSTER, tab by tab, IN THE ORDER A COACH READS IT. Each list is an owner decision;
 * the note beside it is the argument that settled it, so a future change has something to argue
 * with rather than a bare list to edit.
 */
const BAND_TABS: Record<string, { tiles: string[]; ruled: string }> = {
  'budget-vs-actual': {
    tiles: ['headroom', 'spent', 'offplan', 'season-end'],
    ruled: 'D2 option A, 2026-09-03. `offplan` hides at zero — a well-run team sees three.',
  },
  budget: {
    tiles: ['planned', 'funding', 'installments'],
    ruled: 'D3, 2026-09-03. `funding` hides when the plan has no funding lines.',
  },
  club: {
    tiles: ['owed', 'waiting', 'settled'],
    ruled: 'The reference implementation the standard was written from (2026-08-17).',
  },
  dues: {
    tiles: ['assessed', 'collected', 'owing', 'pastdue'],
    ruled:
      'D4, 2026-09-03; QA §137 passed 22/22. `pastdue` hides at zero. Credits are captioned under '
      + 'Collected, NOT Balance owing — Balance owing sums positive rolling balances, so it is not '
      + 'assessed − collected − credits and the caption would claim arithmetic it does not do.',
  },
  fundraisers: {
    tiles: ['raised', 'keeps', 'credited', 'tocome'],
    ruled:
      'Ruled 2026-09-04; QA §139 passed 15/15. The drives/sponsors split moved into `raised`’s '
      + 'caption — it is already stated by the two lists beneath — which freed the seat for '
      + '`tocome`, a figure the tab could not previously show at all.',
  },
};

/** Money tabs that deliberately open with no band. Each needs a reason, not just an entry. */
const NO_BAND_TABS: Record<string, string> = {
  expenses:
    'The Ledger. It opens with ONE exact figure — the team’s cash to the cent, produced by its '
    + 'own route from the same records — which is deliberately not a summary. The demo narration '
    + 'says so out loud ("the figure at the top is not a summary — it is the team’s cash, to the '
    + 'cent") and `npm run check:register` proves that identity. A band of rounded-up tiles beside '
    + 'it would invite exactly the "why don’t these two agree?" question the exactness exists to '
    + 'prevent. Its `payBand*` classes are table ROW groupings inside the payables list, not a tab '
    + 'summary.',
};

function panelPath(tab: string) {
  return path.join(MONEY, tab, 'panel.tsx');
}

/** Every tab directory that actually ships a panel. */
function tabsOnDisk(): string[] {
  return readdirSync(MONEY, { withFileTypes: true })
    .filter(e => e.isDirectory() && existsSync(panelPath(e.name)))
    .map(e => e.name)
    .sort();
}

/**
 * The balanced source region for one tiles expression, from the opening bracket that follows
 * `from` to its match. Returns null when the brackets do not balance — the caller FAILS on null
 * rather than skipping, which is rule 5.
 */
function balancedFrom(src: string, from: number): string | null {
  const OPEN = '([{';
  const CLOSE = ')]}';
  let i = from;
  while (i < src.length && !OPEN.includes(src[i])) i += 1;
  if (i >= src.length) return null;
  const stack: string[] = [];
  const start = i;
  for (; i < src.length; i += 1) {
    const c = src[i];
    /* ⚠ COMMENTS FIRST, AND THIS IS NOT A NICETY. These panels are heavily commented INSIDE the
       tiles expression — that is where the reasoning for each figure lives — and an ordinary
       possessive ("the page's one verdict") reads as an opening quote to the scan below, which
       then swallows the rest of the file and reports the brackets as unbalanced. Caught on the
       first run against the real Budget Plan panel. */
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2);
      if (i === -1) return null;
      i += 1;
      continue;
    }
    // Skip string literals so a bracket inside copy cannot unbalance the scan.
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }
    if (OPEN.includes(c)) stack.push(CLOSE[OPEN.indexOf(c)]);
    else if (CLOSE.includes(c)) {
      if (stack.pop() !== c) return null;
      if (stack.length === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/** Every tile `key` a panel declares, in source order, across all of its band expressions. */
function tileKeys(tab: string): string[] {
  const src = readFileSync(panelPath(tab), 'utf8');
  const regions: string[] = [];

  // Shape one: passed inline as a JSX prop — `<MoneySummaryBand ... tiles={[ … ]}`.
  for (let at = src.indexOf('tiles={'); at !== -1; at = src.indexOf('tiles={', at + 1)) {
    const region = balancedFrom(src, at + 'tiles='.length);
    assert.ok(region, `${tab}: could not balance a tiles={…} expression — the guard would go blind`);
    regions.push(region);
  }
  // Shape two: declared first — `const xTiles: MoneyTile[] = […]` or `= useMemo(() => {…})`.
  for (let at = src.indexOf('MoneyTile[] ='); at !== -1; at = src.indexOf('MoneyTile[] =', at + 1)) {
    const region = balancedFrom(src, at + 'MoneyTile[] ='.length);
    assert.ok(region, `${tab}: could not balance a MoneyTile[] declaration — the guard would go blind`);
    regions.push(region);
  }

  // A declared array that is then passed by name yields the same keys twice; de-duplicate by
  // taking first appearance, so the roster reads as the coach reads it.
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const region of regions) {
    for (const m of region.matchAll(/\bkey:\s*'([^']+)'/g)) {
      if (!seen.has(m[1])) { seen.add(m[1]); keys.push(m[1]); }
    }
  }
  return keys;
}

describe('every money tab opens the same way', () => {
  it('rule 1 — the roster is closed: a new money tab must be classified here', () => {
    const known = new Set([...Object.keys(BAND_TABS), ...Object.keys(NO_BAND_TABS)]);
    const found = tabsOnDisk();
    const unclassified = found.filter(t => !known.has(t));
    assert.deepEqual(
      unclassified, [],
      'A money tab exists that this guard has never been told about. Does it open with a summary? '
      + 'Then it uses MoneySummaryBand and belongs in BAND_TABS with its tile roster. Does it '
      + 'deliberately not? Then it belongs in NO_BAND_TABS with the reason why.',
    );
    // And the reverse: a classified tab that has been deleted should not linger as a stale rule.
    for (const t of known) {
      assert.ok(found.includes(t), `${t} is classified here but has no panel on disk — stale entry`);
    }
  });

  it('rule 2 — a band tab imports AND renders the shared band', () => {
    for (const tab of Object.keys(BAND_TABS)) {
      const src = readFileSync(panelPath(tab), 'utf8');
      assert.match(
        src, /import MoneySummaryBand(?:,\s*\{[^}]*\})?\s+from '@\/components\/coaches\/MoneySummaryBand'/,
        `${tab} must import MoneySummaryBand`,
      );
      assert.ok(
        src.includes('<MoneySummaryBand'),
        `${tab} imports the band but never renders it — a tab summary drawn any other way is the `
        + 'exact drift D6 exists to stop',
      );
    }
  });

  it('rule 3 — the tile roster is what the owner ruled, in order, and never more than four', () => {
    for (const [tab, { tiles, ruled }] of Object.entries(BAND_TABS)) {
      const found = tileKeys(tab);
      assert.deepEqual(
        found, tiles,
        `${tab}: the tiles changed.\n  expected: ${tiles.join(' · ')}\n  found:    ${found.join(' · ')}\n`
        + `  ruled:    ${ruled}\n  Which figures a money tab leads with is an owner decision. If this `
        + 'is intended, update the roster here in the same commit.',
      );
      assert.ok(
        tiles.length >= 2 && tiles.length <= 4,
        `${tab}: the recipe is 3–4 tiles (2 is tolerated where a tab genuinely has two). The `
        + 'stylesheet has rules for 2, 3 and 4 — a fifth renders into a four-column grid.',
      );
    }
  });

  it('rule 4 — no coach money panel borrows the admin summary-card family', () => {
    for (const tab of tabsOnDisk()) {
      const src = readFileSync(panelPath(tab), 'utf8');
      for (const forbidden of ['styles.summaryGrid', 'styles.summaryCard']) {
        assert.ok(
          !src.includes(forbidden),
          `${tab} uses ${forbidden}. That family belongs to the org- and platform-admin screens; `
          + 'Fundraising borrowed it until 2026-09-04 and that is the drift this rule ends. A money '
          + 'tab summary is MoneySummaryBand.',
        );
      }
    }
  });

  it('rule 5 — the guard does not go blind: every band tab yields real keys', () => {
    for (const tab of Object.keys(BAND_TABS)) {
      const found = tileKeys(tab);
      assert.ok(
        found.length > 0,
        `${tab}: parsed no tile keys at all. Either the band moved out of panel.tsx — in which case `
        + 'teach this scan where it went, in the same commit — or the expression shape changed and '
        + 'this guard is now proving nothing.',
      );
    }
  });
});
