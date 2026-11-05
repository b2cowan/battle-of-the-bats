/**
 * BANK RECONCILIATION R2c — the club's Bank tab (desk) holds its rules. Source guards over the screens; the server's
 * own rules are bank-r2-server-guard's.
 *   1 · the tab: right after the Ledger, for everyone, always, one real page, no Year pill, no year anywhere.
 *   2 · the screens send INTENT and draw the server's answer (rule 6): no figure added up on the screen.
 *   3 · every write control is absent for a reader (B7): each one sits behind `canMove`.
 *   4 · the kit's parts: LoadingState with a short "…" label, tokens only, the --type-* ladder, a symbol-only action
 *       with an aria-label and the 44px floor on a phone.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource, sourceExists, splitPhoneCss } from './_source-code.ts';
import { accountingTabs, accountingTabFor } from '../../lib/admin-kit-nav.ts';
import { BANK_WORDS } from '../../lib/bank-tab-words.ts';

const DIR = 'components/admin/kit/club/money/bank';
const FILES = ['BankTab.tsx', 'BankCheck.tsx', 'BankSetup.tsx', 'BankStatements.tsx', 'BankWindows.tsx', 'BankShared.ts'].map(f => `${DIR}/${f}`);
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
    assert.ok(sourceExists(PAGE), 'the tab is a real page');
  });
  it('the page adds no gate of its own (the layout decides) and mounts the tab', () => {
    const page = readCode(PAGE);
    assert.match(page, /<BankTab orgSlug=\{orgSlug\} \/>/);
    assert.doesNotMatch(page, /notFound|clubHasPayouts|allowSuspendedOrg/);
  });
  it('no Year pill and no year or season parameter anywhere on the tab (B3, B10)', () => {
    for (const f of [PAGE, ...FILES]) {
      const src = readCode(f);
      assert.doesNotMatch(src, /YearPill|fiscalYear|[?&](year|season)=|\b(year|season):\s/i, f);
    }
  });
});

describe('2 · intent in, the server’s numbers out (rule 6)', () => {
  it('a tick sends only the key and the intent; a keep-out the same', () => {
    const check = readCode(`${DIR}/BankCheck.tsx`);
    assert.match(check, /\/ticks`\), 'POST', \{ key, ticked \}/);
    assert.match(check, /\/kept-out`\), 'POST', \{ key, keptOut \}/);
    assert.match(check, /\{ kind: 'payment_processing', payoutKey \}/, 'the processing line’s amount is the server’s');
  });
  it('every write answers with the account read again, and the screen takes it whole', () => {
    const shared = readCode(`${DIR}/BankShared.ts`);
    assert.match(shared, /view: r\.data as unknown as AccountView/);
    assert.match(shared, /type AccountView = NonNullable<Awaited<ReturnType<typeof bankAccountView>>>/, 'the route’s own type, never a copy');
  });
  it('no figure is added up on the screen: the band reads the engine’s fields', () => {
    const check = readCode(`${DIR}/BankCheck.tsx`);
    for (const f of ['statementEndingBalanceCents', 'tickedBalanceCents', 'differenceCents']) assert.match(check, new RegExp(`shown\\.${f}`));
    assert.doesNotMatch(check, /reduce\(/, 'no sum in the check screen');
  });
});

describe('3 · a reader reads the same tab with every write control absent (B7)', () => {
  it('the check screen writes only when the member can move money AND the statement is open', () => {
    const check = readCode(`${DIR}/BankCheck.tsx`);
    assert.match(check, /const writes = canMove && open;/);
    assert.match(check, /if \(!writes \|\| pending\.has\(key\)\) return;/);
    assert.match(check, /\{writes && \(\s*<button type="button" className="btn btn-lime" onClick=\{\(\) => mark\(false\)\}/);
    assert.match(check, /\{changed && canMove && \(/, 'Mark checked again');
  });
  it('the list’s Check a statement and Undo, and the tab’s account doors, sit behind canMove', () => {
    const list = readCode(`${DIR}/BankStatements.tsx`);
    assert.match(list, /\{canMove && view\.next\?\.canStart && \(/);
    assert.match(list, /const showUndo = canMove && c\.can\.undo;/);
    const tab = readCode(`${DIR}/BankTab.tsx`);
    assert.match(tab, /if \(!canMove\) return <Callout role="status">\{W\.setupReader\}<\/Callout>;/);
    assert.match(tab, /const accountTools = canMove && \(/);
    assert.match(tab, /foot=\{canMove \? \(/);
  });
});

describe('4 · the kit’s parts', () => {
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
  it('the one symbol-only action has an aria-label and the 44px floor on a phone', () => {
    const setup = readCode(`${DIR}/BankSetup.tsx`);
    assert.match(setup, /className=\{s\.removeTyped\} aria-label=\{W\.typedRemove\(t\.description\)\}/);
    const { phone } = splitPhoneCss(readSource(CSS));
    assert.match(phone, /\.removeTyped \{ width: 44px; height: 44px; \}/);
  });
  it('the payout opener and Edit name what they do', () => {
    const check = readCode(`${DIR}/BankCheck.tsx`);
    assert.match(check, /aria-label=\{opened \? W\.payoutClose\(amount\) : W\.payoutOpen\(amount\)\}/);
    assert.match(check, /aria-label=\{W\.editAria\}/);
  });
});
