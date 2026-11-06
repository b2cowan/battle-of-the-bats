/**
 * THE CLUB'S BANK TAB holds its rules (Bank reconciliation R2c; trimmed in Bank balance check BC1 to what survives the
 * tick-off). Source guards over the screens; the server's own rules are bank-r2-server-guard's.
 *   1 · the tab: right after the Ledger, for everyone, always, one real page, no Year pill, no year anywhere.
 *   3 · every write control is absent for a reader (B7): each one sits behind `canMove`.
 *   4 · the kit's parts: LoadingState with a short "…" label, tokens only, the --type-* ladder.
 * BC2 adds the check form's own pins (intent in, the server's numbers out) when it builds the form.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, readSource } from './_source-code.ts';
import { accountingTabs, accountingTabFor } from '../../lib/admin-kit-nav.ts';
import { BANK_WORDS } from '../../lib/bank-tab-words.ts';

const DIR = 'components/admin/kit/club/money/bank';
const FILES = [...filesUnder(DIR, '.tsx'), ...filesUnder(DIR, '.ts')];
const PAGE = 'app/[orgSlug]/admin/accounting/bank/page.tsx';
const CSS = `${DIR}/Bank.module.css`;
const BASE = '/club/admin';

describe('1 · the tab', () => {
  it('Bank is right after the Ledger, with or without rep teams, and never behind a flag', () => {
    for (const runsRepTeams of [true, false]) {
      const ids = accountingTabs(BASE, { runsRepTeams }).map(t => t.id);
      assert.equal(ids[ids.indexOf('ledger') + 1], 'bank');
    }
    assert.equal(accountingTabFor(`${BASE}/accounting/bank`, BASE, { runsRepTeams: false }), 'bank');
    assert.ok(readSource(PAGE), 'the tab is a real page');
  });
  it('the page adds no gate of its own (the layout decides) and mounts the tab', () => {
    const page = readCode(PAGE);
    assert.match(page, /<BankTab orgSlug=\{orgSlug\} \/>/);
    assert.doesNotMatch(page, /notFound|clubHasPayouts|allowSuspendedOrg/);
  });
  it('no Year pill and no year or season parameter anywhere on the tab', () => {
    assert.ok(FILES.some(f => f.endsWith('BankTab.tsx')), 'the walk reaches the tab');
    for (const f of [PAGE, ...FILES]) {
      const src = readCode(f);
      assert.doesNotMatch(src, /YearPill|fiscalYear|[?&](year|season)=|\b(year|season):\s/i, f);
    }
  });
});

describe('3 · a reader reads the same tab with every write control absent (B7)', () => {
  it('the tab\'s first-check card and its account doors sit behind canMove', () => {
    const tab = readCode(`${DIR}/BankTab.tsx`);
    assert.match(tab, /if \(!canMove\) return <Callout role="status">\{W\.setupReader\}<\/Callout>;/);
    assert.match(tab, /const accountTools = canMove && \(/);
    assert.match(tab, /foot=\{canMove \? \(/);
    assert.match(tab, /\? canMove\s+\? <BankSetup /, 'a second account\'s first-check card is the writer\'s only');
  });
  it('every write a screen sends goes through bankWrite, and only from a component a writer reaches', () => {
    for (const f of FILES) {
      const src = readCode(f);
      assert.doesNotMatch(src, /moneyFetch\([^)]*\{\s*method:/, `${f}: a write outside bankWrite`);
    }
    // The list itself writes nothing (BC2 adds Delete behind canMove).
    assert.doesNotMatch(readCode(`${DIR}/BankStatements.tsx`), /bankWrite|onClick/);
  });
});

describe('4 · the kit\'s parts', () => {
  it('loading is the shared LoadingState, its labels short and ending "…"', () => {
    for (const f of FILES) assert.doesNotMatch(readCode(f), />\s*Loading/, `${f}: no hand-typed Loading`);
    for (const [k, v] of Object.entries(BANK_WORDS)) {
      if (!k.startsWith('loading') || typeof v !== 'string') continue;
      assert.ok(v.length <= 40 && v.endsWith('…'), `${k}: "${v}"`);
    }
  });
  it('tokens only, and type from the ladder', () => {
    const css = readSource(CSS).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'no hex colour');
    assert.doesNotMatch(css, /rgba?\(\s*\d/, 'no literal rgb');
    for (const m of css.matchAll(/font-size:\s*([^;]+);/g)) assert.match(m[1], /^var\(--type-[a-z]+\)$/, m[0]);
  });
  it('a text button is a finger\'s target on a phone (44px)', () => {
    assert.match(readSource(CSS), /\.link \{[^}]*min-height: var\(--tap-min, 44px\); min-width: var\(--tap-min, 44px\);/);
  });
});
