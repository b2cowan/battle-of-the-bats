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

// ── Bank balance check BC2a: the check form, the band, the sums, Start's Stripe notice ──────────────────────────────
const code = (f: string) => readCode(`${DIR}/${f}`);
const NEW_SCREENS = ['BankCheckForm.tsx', 'BankFigure.tsx', 'BankSetup.tsx'];

describe('5 · the check form: a balance, not a tick-off', () => {
  it('no tick vocabulary on any screen or in the words (tick, ticked, untick, a checkbox on a line)', () => {
    for (const f of FILES) {
      const src = readCode(f);
      // The account window's BOOK list is the one place a box is ticked (a book moved into an account): a book, never a line.
      const lineBoxes = f.endsWith('BankWindows.tsx') ? src.replace(/type="checkbox"/g, '') : src;
      assert.doesNotMatch(lineBoxes, /type="checkbox"|\bun?ticked?\b|\bticking\b|Mark (this statement )?checked|Finish later/i, f);
    }
    for (const [k, v] of Object.entries(BANK_WORDS)) {
      if (typeof v === 'string') assert.doesNotMatch(v, /\btick|\bticked\b|Finish later|Mark checked/i, k);
    }
  });
  it('the band is the SHIPPED joined band (MoneySummaryBand), three tiles, never hand-drawn cards', () => {
    const fig = code('BankFigure.tsx');
    assert.match(fig, /import MoneySummaryBand/);
    assert.match(fig, /<MoneySummaryBand /);
    assert.match(fig, /key: 'bank'[\s\S]*key: 'should'[\s\S]*\bdiff,/, 'The bank says · Should be in the bank · Difference, in that order');
    assert.doesNotMatch(readSource(CSS), /\.(bandTile|moneyTile|bandCard)\b/, 'no second band in the sheet');
  });
  it('an off check is AMBER, never red; a direction is said in words, never a minus sign', () => {
    const fig = code('BankFigure.tsx');
    assert.match(fig, /tone: !settled \? 'plain' : figure\.result === 'matches' \? 'good' : 'warn'/);
    assert.doesNotMatch(fig + code('BankCheckForm.tsx') + code('BankStatements.tsx'), /tone="(bad|danger)"|tone: 'danger'/);
    for (const k of ['bandBankMore', 'bandBankLess'] as const) {
      const sentence = BANK_WORDS[k]('$75.00');
      assert.doesNotMatch(sentence, /[-−]\s?\$|\(\$/, k);
      assert.match(sentence, /more than your books|less than your books/);
    }
  });
  it('the screens never do the arithmetic: no sum, difference or reduce over cents; the band comes from figureCheck', () => {
    for (const f of NEW_SCREENS) {
      const src = code(f);
      assert.doesNotMatch(src, /[Cc]ents\s*[-+*/]\s*[A-Za-z0-9(]|[A-Za-z0-9)]\s*[-+*/]\s*[A-Za-z.]*[Cc]ents\b/, `${f}: arithmetic on cents`);
      assert.doesNotMatch(src, /\.reduce\(/, `${f}: a sum`);
    }
    assert.match(code('BankCheckForm.tsx'), /import \{ figureCheck \} from '@\/lib\/bank-check'/);
    assert.match(code('BankCheckForm.tsx'), /figureCheck\(\{ bankCents: typed \?\? 0, booksCents: fresh\.booksCents, onItsWayCents: fresh\.onItsWay\.cents/);
  });
  it('words come from the words module only: no sentence typed into a new screen', () => {
    for (const f of NEW_SCREENS) {
      const src = code(f);
      const jsxText = [...src.matchAll(/>([^<>{}\n]*[A-Za-z]{2,}[^<>{}\n]*\s[A-Za-z]{2,}[^<>{}\n]*)</g)].map(m => m[1].trim()).filter(Boolean);
      assert.deepEqual(jsxText, [], `${f}: hand-typed words in JSX`);
      assert.doesNotMatch(src, /(?:label|title|caption|placeholder)=["'][A-Z][a-z]+ [a-z]/, `${f}: hand-typed attribute words`);
    }
  });
  it('Save is intent only: the date and the typed balance; books, on its way and the result are the server\'s (rule 6)', () => {
    const form = code('BankCheckForm.tsx');
    assert.match(form, /'POST', \{ date, bankCents: typed \}/);
    assert.doesNotMatch(form, /booksCents:\s*(fresh|figure)\b[^)]*\}\s*,\s*W\./, 'the books never go up in the request');
    assert.doesNotMatch(form, /method:\s*['"]/, 'a write outside bankWrite');
  });
  it('Save works while off: no $0.00 gate on the button (ruling 3)', () => {
    const form = code('BankCheckForm.tsx');
    assert.match(form, /disabled=\{busy \|\| !fresh\}/);
    assert.doesNotMatch(form, /result === 'matches'[^;]*disabled|disabled=\{[^}]*(band|offBy|differenceCents)/);
  });
  it('the form is a writer\'s: the tab mounts it behind canMove, and it asks for a CHECK (the start\'s own day reads before_start)', () => {
    assert.match(code('BankTab.tsx'), /form=\{canMove \? \(\s*<BankCheckForm /);
    assert.match(code('BankCheckForm.tsx'), /readFigure\(orgSlug, accountId, asOf, 'check'\)/);
  });
  it('Online-payment lines are shown, never tickable; Show is the sums\' own, and Find\'s Show them is not here (BC3)', () => {
    const fig = code('BankFigure.tsx');
    assert.doesNotMatch(fig, /checkbox/);
    assert.match(fig, /aria-expanded=\{open\}/);
    assert.doesNotMatch(code('BankCheckForm.tsx'), /Show them|W\.showThem/);
  });
});

describe('6 · Start, when Stripe doesn\'t answer: warn, never block (owner 2026-11-06)', () => {
  it('the card reads Stripe\'s on-its-way for the start\'s day first and offers Try again and Start anyway', () => {
    const setup = code('BankSetup.tsx');
    assert.match(setup, /readFigure\(orgSlug, id, date, 'start'\)/);
    assert.match(setup, /onItsWay\.state === 'not_counted'/);
    assert.match(setup, /W\.startAnyway/);
    assert.match(setup, /W\.tryAgain/);
    assert.match(setup, /save\(true\)/, 'Start anyway saves');
  });
  it('the notice names which of the two reasons it is, from the words module', () => {
    assert.match(BANK_WORDS.startNoticeDown, /Stripe didn’t answer, so card payments on their way aren’t counted yet/);
    assert.notEqual(BANK_WORDS.startNoticeDown, BANK_WORDS.startNoticeUnlisted);
  });
});

describe('7 · a stale view is re-read before the sentence is said (BC1 review findings 1–3)', () => {
  it('every screen that writes passes a stale refusal to the tab, which re-reads the overview and the account first', () => {
    for (const f of ['BankSetup.tsx', 'BankCheckForm.tsx', 'BankWindows.tsx']) {
      assert.match(code(f), /isStaleView\(/, f);
      assert.match(code(f), /onStale\(/, f);
    }
    const tab = code('BankTab.tsx');
    assert.match(tab, /const o = await loadOverview\(true\);[\s\S]*await loadView\(id\);[\s\S]*setNotice\(\{ tone: 'bad', text \}\)/, 'overview, then the account, THEN the sentence');
    for (const c of ['changed', 'account_not_found']) assert.match(code('BankShared.ts'), new RegExp(`'${c}'`));
  });
  it('the first Start flips the tab off the setup card locally while the overview re-reads (finding 3)', () => {
    assert.match(code('BankTab.tsx'), /setOverview\(o => o && \{\s*\.\.\.o, never: false/);
  });
});
