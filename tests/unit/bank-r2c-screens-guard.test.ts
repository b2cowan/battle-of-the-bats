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
/** The band's tiles live in the look-free module both portals' Bank screens share (BC7a, owner "Coach sharing"). */
const TILES = 'lib/bank-screen.ts';

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
    assert.match(tab, /\{canMove\s+\? <BankSetup /, 'a second account\'s first-check card is the writer\'s only');
  });
  it('every write a screen sends goes through bankWrite, and only from a component a writer reaches', () => {
    for (const f of FILES) {
      const src = readCode(f);
      assert.doesNotMatch(src, /moneyFetch\([^)]*\{\s*method:/, `${f}: a write outside bankWrite`);
    }
    // The list itself writes nothing: its rows only OPEN a check (BC2b); Delete is the window's, behind canMove (§8).
    assert.doesNotMatch(readCode(`${DIR}/BankStatements.tsx`), /bankWrite|moneyFetch/);
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
const NEW_SCREENS = ['BankCheckForm.tsx', 'BankFigure.tsx', 'BankSetup.tsx', 'BankCheckWindow.tsx', 'BankStatements.tsx', 'BankFind.tsx'];

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
    assert.match(fig, /bankBandTiles\(\{ date, figure, typed, saved, isPhone \}\)/);
    assert.match(readCode(TILES), /key: 'bank'[\s\S]*key: 'should'[\s\S]*\bdiff,/, 'The bank says · Should be in the bank · Difference, in that order');
    assert.doesNotMatch(readSource(CSS), /\.(bandTile|moneyTile|bandCard)\b/, 'no second band in the sheet');
  });
  it('an off check is AMBER, never red; a direction is said in words, never a minus sign', () => {
    const fig = code('BankFigure.tsx');
    assert.match(readCode(TILES), /tone: !settled \? 'plain' : figure\.result === 'matches' \? 'good' : 'warn'/);
    assert.doesNotMatch(fig + readCode(TILES) + code('BankCheckForm.tsx') + code('BankStatements.tsx'), /tone="(bad|danger)"|tone: 'danger'/);
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
    assert.match(code('BankCheckForm.tsx'), /import \{ figureCheck, waitingOnCheck, type BankLine, type WaitingItem \} from '@\/lib\/bank-check'/);
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
    assert.match(form, /'POST',\s*\{ date, bankCents: typed, anyway, waiting: \[\.\.\.marked\.keys\(\)\] \}/,
      'anyway is the treasurer\'s choice, not a figure; the marked lines go up as KEYS only (BC3a)');
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
  it('Online-payment lines are shown, never tickable; Show is the sums\' own, and Show them is Find\'s door (BC3a)', () => {
    const fig = code('BankFigure.tsx');
    assert.doesNotMatch(fig, /checkbox/);
    assert.match(fig, /aria-expanded=\{open\}/);
    assert.doesNotMatch(code('BankCheckForm.tsx'), /W\.showThem|W\.linesSince/, 'the form no longer draws the plain hint itself');
    assert.match(code('BankFind.tsx'), /aria-expanded=\{open\} onClick=\{\(\) => setOpen\(o => !o\)\}>\{open \? W\.hideThem : W\.showThem\}/);
  });
});

describe('6 · Start, when Stripe doesn\'t answer: warn, never block (owner 2026-11-06)', () => {
  it('the SERVER decides (BC2 review): a save that can\'t count Stripe is refused unless the body says anyway', () => {
    const steps = readCode('lib/bank-club-steps.ts');
    assert.match(steps, /if \(figure\.onItsWay\.state === 'not_counted' && body\.anyway !== true\) \{\s*return bankRefusedAs\(figure\.onItsWay\.reason === 'stripe_down' \? 'not_counted_down' : 'not_counted_unlisted'\);/);
    assert.match(code('BankShared.ts'), /code === 'not_counted_down' \? 'stripe_down' : code === 'not_counted_unlisted' \? 'unlisted' : null/);
  });
  it('the card turns that refusal into its notice and offers Try again and Start anyway', () => {
    const setup = code('BankSetup.tsx');
    assert.match(setup, /'PUT', \{ date, bankCents: c, anyway \}/);
    assert.match(setup, /const reason = notCountedOf\(r\.code\);\s*if \(reason\) setNotCounted\(reason\);/);
    assert.doesNotMatch(setup, /readFigure\(/, 'no second read of its own: the save\'s read is the one that counts');
    assert.match(setup, /W\.startAnyway/);
    assert.match(setup, /W\.tryAgain/);
    assert.match(setup, /save\(true\)/, 'Start anyway saves');
  });
  it('the notice names which of the two reasons it is, from the words module', () => {
    assert.match(BANK_WORDS.startNoticeDown, /Stripe didn’t answer, so online payments on their way aren’t counted yet/);
    assert.notEqual(BANK_WORDS.startNoticeDown, BANK_WORDS.startNoticeUnlisted);
  });
  it('a check shown counted that Stripe can\'t count at the save reads again; one shown not counted saves anyway', () => {
    const form = code('BankCheckForm.tsx');
    assert.match(form, /const anyway = fresh\.onItsWay\.state === 'not_counted';/);
    assert.match(form, /'POST',\s*\{ date, bankCents: typed, anyway, waiting:/);
    assert.match(form, /if \(notCountedOf\(r\.code\)\) \{ setError\(r\.error\); setAgain\(n => n \+ 1\); \}/);
  });
  it('the club\'s Delete reaches only a CLUB account\'s check (a team\'s account is in the same org, BC6)', () => {
    assert.match(readCode('lib/bank-club-steps.ts'), /export async function deleteCheck[\s\S]{0,400}readClubBankAccounts\(ctx\.org\.id\);\s*if \(!all\.accounts\.some\(a => a\.id === accountId\)\) return bankRefusedAs\('account_not_found'\);/);
  });
});

describe('7 · a stale view is re-read before the sentence is said (BC1 review findings 1–3)', () => {
  it('every screen that writes passes a stale refusal to the tab, which re-reads the overview and the account first', () => {
    for (const f of ['BankSetup.tsx', 'BankCheckForm.tsx', 'BankWindows.tsx', 'BankCheckWindow.tsx']) {
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

// ── Bank balance check BC3a: Find on a check ──────────────────────────────────────────────────────────────────────
describe('9 · Find: the hints, the lines, Not in the bank yet, Still waiting?', () => {
  it('Find is a writer\'s: it lives inside the check form, which the tab mounts behind canMove', () => {
    assert.match(code('BankCheckForm.tsx'), /<BankFind key=\{date\} figure=\{fresh\} band=\{band\}/);
    assert.match(code('BankTab.tsx'), /form=\{canMove \? \(\s*<BankCheckForm /);
    for (const f of FILES) {
      if (f.endsWith('BankCheckForm.tsx')) continue;
      assert.doesNotMatch(readCode(f), /<BankFind\b/, `${f}: Find mounted outside the writer's form`);
    }
  });
  it('the hints are the engine\'s only (hintsFor over findHints): no screen walks the lines for amounts itself', () => {
    const find = code('BankFind.tsx');
    assert.match(find, /hintsFor\(band\.differenceCents, lines\.filter\(l => !marked\.has\(l\.key\)\), before\)/,
      'on the TYPED difference, less the marked lines, with the look-back\'s lines (BC3b)');
    // Q2's look-back is offered only while the check is off (the server sends it within six months of the start).
    assert.match(find, /const before = off && figure\.beforeStart \? figure\.beforeStart\.lines : \[\];/);
    for (const f of FILES) {
      assert.doesNotMatch(readCode(f), /\bfindHints\(/, `${f}: the raw finder bypasses the direction rule`);
      assert.doesNotMatch(readCode(f), /amountCents\s*===|===\s*\w+\.amountCents/, `${f}: an amount compared on a screen`);
    }
    assert.match(readCode('lib/bank-check.ts'), /export function hintsFor[\s\S]{0,400}findHints\(differenceCents, direction \? candidates\.filter\(l => l\.direction === direction\) : \[\]\)/);
  });
  it('lines on their way are never candidates and have no action; the search is the rules\' (pickerSearch + lineMatches)', () => {
    const find = code('BankFind.tsx');
    assert.match(find, /const lines = suspects\.lines\.filter\(l => !onWayKeys\.has\(l\.key\)\);/);
    assert.match(find, /<td className=\{s\.actCell\} \/>\s*<\/tr>/, 'the on-their-way row\'s action cell is empty');
    assert.match(find, /lineMatches\(search, /);
    assert.match(find, /<SearchField /, 'the product\'s one search field');
  });
  it('the band re-figures through figureCheck with the marked items; the sums take the engine\'s sign', () => {
    const form = code('BankCheckForm.tsx');
    assert.match(form, /figureCheck\(\{ bankCents: typed \?\? 0, booksCents: fresh\.booksCents, onItsWayCents: fresh\.onItsWay\.cents, waiting: items, cashCents: null \}\)/);
    assert.match(form, /amount: moved\(waitingOnCheck\(w\)\)/);
    // WD1: and the restored marks still waiting on the figure, and the dropped-mark callout.
    assert.match(form, /const pickDate = \(v: string\) => \{\s*setDate\(v\); setError\(''\); setMarked\(new Map\(\)\); setDropped\(new Set\(\)\); setPending\(null\); setDroppedMarks\(0\);\s*\};/, 'a new date clears the marks and the answers');
  });
  it('Still waiting? asks each of the earlier check\'s items once: Yes marks it, No drops it', () => {
    const form = code('BankCheckForm.tsx');
    assert.match(form, /\(fresh\?\.stillWaiting \?\? \[\]\)\.filter\(w => !marked\.has\(w\.key\) && !dropped\.has\(w\.key\)\)/);
    assert.match(form, /onYes: \(\) => mark\(w\), onNo: \(\) => setDropped\(d => new Set\(d\)\.add\(w\.key\)\)/);
    // BC4a (owner 2026-11-06): the check on which a line is put on the start doesn't ask about it, after the start took it.
    assert.match(form, /setFigure\(null\);\n(?:\s*\/\/[^\n]*\n)*\s*setDropped\(d => new Set\(d\)\.add\(line\.key\)\);\n\s*onChanged\(r\.view, W\.atStartDone/);
    // The start's lines arrive as Still-waiting rows: the same sentence, no start-only words.
    assert.doesNotMatch(form, /stillWaiting[^\n]*atStart/);
    assert.match(code('BankFigure.tsx'), /W\.stillWaiting\(a\.what\)/);
  });
  it('every action is a real button (keyboard reachable): no clickable row or span; a chip is a door', () => {
    const find = code('BankFind.tsx');
    assert.doesNotMatch(find, /<(tr|td|span|div)\b[^>]*onClick/, 'a click on something that is not a button');
    assert.match(find, /<button type="button" className=\{s\.chipDoor\} aria-label=\{W\.chipOpen\(chipWords\(hint\)\)\} onClick=\{\(\) => setPick\(hint\.key\)\}>/);
    assert.match(find, /aria: W\.markLine\(nameOf\(l\)\)/, 'each row\'s button names its line');
    assert.match(find, /aria: W\.atStartLine\(nameOf\(l\)\)/, 'a line before the start names its line too');
    assert.match(find, /aria-label=\{action\.aria\}/);
    // Not hover-only: focus shows the button, and a touch screen shows it always.
    const css = readSource(CSS);
    assert.match(css, /\.findTable tr:focus-within \.markBtn \{ opacity: 1; \}|\.findTable tr:focus-within \.markBtn,?[\s\S]{0,40}\{ opacity: 1; \}/);
    assert.match(css, /\.markBtn:focus-visible \{ opacity: 1;/);
    assert.match(css, /@media \(hover: none\) \{\s*\.markBtn \{ opacity: 1; \}/);
  });
  it('a hinted row is amber-soft, never red', () => {
    assert.match(readSource(CSS), /tr\.hitRow > td \{ background: rgba\(var\(--warning-rgb\), 0\.08\); \}/);
    assert.doesNotMatch(code('BankFind.tsx'), /tone="(bad|danger)"|--danger|--bad\b/);
  });
});

// ── Bank balance check BC3b: the two doors out of the check ────────────────────────────────────────────────────────
describe('10 · Add the missing line, Waiting at the start', () => {
  it('"Add the missing line" opens the LEDGER\'S OWN add window, filled; no bank screen writes a book line (ask 1)', () => {
    const form = code('BankCheckForm.tsx');
    assert.match(form, /import \{ AddEntryWindow, useBudgetWords \} from '\.\.\/LedgerWindows';/);
    // The words the line is filed under are the Ledger page's own read (one loader for both doors).
    assert.match(form, /const words = useBudgetWords\(q, adding !== null\);/);
    assert.match(readCode('app/[orgSlug]/admin/accounting/ledger/page.tsx'), /const words = useBudgetWords\(q, /);
    assert.match(form, /setAdding\(\{\s*entryType: band\.direction === 'bank_more' \? 'income' : 'expense', date, amount: fieldAmount\(band\.offByCents\),/,
      'the gap, the statement\'s day, and the direction that closes it');
    assert.match(form, /view\.account\.books\.find\(b => b\.kind === 'org' && !b\.entityId\) \?\? view\.account\.books\[0\]/, 'the account\'s own club book (the Ledger\'s rule)');
    // Renamed "Add the missing entry" in WD1 (after the window it opens); the coach card's words stay until WD2.
    assert.match(code('BankFind.tsx'), /onClick=\{onAddLine\} disabled=\{busy\}>\{W\.addMissingEntry\}<\/button>/, 'a real door, never a dead button; held while a write is on its way');
    // The window keeps what it opened with (a figure read again never moves or closes it) and knows the closed years.
    assert.match(form, /\{adding && ownBook && \(/);
    assert.match(form, /fiscal=\{view\.fiscal\} canMove prefill=\{adding\}/);
    for (const f of FILES) {
      assert.doesNotMatch(readCode(f), /\/entries\b/, `${f}: a bank screen posts a book line itself`);
    }
    // The Ledger page's own add window starts as it always has without a prefill.
    const lw = readCode('components/admin/kit/club/money/LedgerWindows.tsx');
    assert.match(lw, /useState<'income' \| 'expense'>\(prefill\?\.entryType \?\? 'expense'\)/);
    assert.match(lw, /useState\(\(\) => prefill\?\.date \?\? tournamentToday\(\)\)/);
    assert.match(lw, /useState\(prefill\?\.amount \?\? ''\)/);
  });
  it('"Waiting at the start" corrects the start through PATCH …/setup with the line\'s KEY only; "Take it off" the same way', () => {
    // One helper sends both (`patchStart`): the line's key, nothing else.
    assert.match(code('BankShared.ts'), /bankWrite\(bankUrl\(orgSlug, `\/accounts\/\$\{accountId\}\/setup`\), 'PATCH', body, W\.atStartFailed\)/);
    assert.match(code('BankShared.ts'), /body: \{ add: string \} \| \{ remove: string \}/);
    assert.match(code('BankCheckForm.tsx'), /patchStart\(orgSlug, accountId, \{ add: line\.key \}\)/);
    assert.match(code('BankCheckWindow.tsx'), /patchStart\(orgSlug, view\.account\.id, \{ remove: item\.key \}\)/);
    assert.match(code('BankCheckWindow.tsx'), /savedSumRows\(check, canMove && start \? /, 'only a writer, only on the start');
    // A line before the start offers Waiting at the start, never Not in the bank yet (M3).
    // One map for each group, drawn as a table row at a desk and a card on a phone (BC4b): the action is the same.
    assert.match(code('BankFind.tsx'), /beforeShown\.map\(l => \(\s*<LineView key=\{l\.key\} line=\{l\} chip=\{chipFor\(l\.key\)\}\s*action=\{\{ label: W\.atStart,/);
    // The look-back pages by 10 on a phone (Save is the card's last thing there); the desk lists it whole (BC4b /design).
    assert.match(code('BankFind.tsx'), /const beforeShown = isPhone \? foundBefore\.slice\(0, beforePages \* PAGE_PHONE\) : foundBefore;/);
    assert.match(code('BankFind.tsx'), /const LineView = isPhone \? LineCard : LineRow;/);
  });
  it('a corrected start re-reads the day\'s figure; "Books now say" says why', () => {
    assert.match(code('BankCheckForm.tsx'), /const checksKey = `\$\{view\.checks\.map\(c => c\.id\)\.join\(','\)\}\|\$\{view\.start\?\.id \?\? ''\}:\$\{view\.start\?\.booksCents \?\? ''\}`;/);
    assert.match(code('BankCheckWindow.tsx'), /check\.startCorrected \? W\.booksNowSayStartWhy : W\.booksNowSayWhy\(when\)/);
  });
});

// ── Bank balance check BC2b: the saved checks open, Delete, Check this statement again, the top line ─────────────────
describe('8 · a saved check, opened', () => {
  it('every row opens its check: the kit\'s table door, the date a named button, a phone card a button', () => {
    const list = code('BankStatements.tsx');
    assert.match(list, /className=\{repKit\.rowOpens\} onClick=\{\(\) => opened\(onOpen, c\.id\)\}/);
    assert.match(list, /className=\{`\$\{repKit\.rowOpens\} \$\{s\.balanceRow\}`\} onClick=\{\(\) => opened\(onOpen, start\.id\)\}/, 'the start opens too (owner, BC2b ask 2)');
    assert.match(list, /<button type="button" className=\{`\$\{repKit\.nameButton\} \$\{repKit\.nameLink\}`\} aria-label=\{\(isStart \? W\.openStart : W\.openCheck\)\(/, 'the start\'s door is named for the starting statement');
    assert.equal(list.match(/<ClubRow key=\{\w+\.id\} as="button" chevron( muted)? onClick=\{\(\) => onOpen\(\w+\.id\)\}\n/g)?.length, 2, 'both phone cards are buttons');
    assert.doesNotMatch(list, /<ClubRow [^\n]*aria-label/, 'a phone card is named by its own date, balance and result (a label would replace them)');
  });
  it('a start saved with Stripe not counted says so in its row', () => {
    assert.match(code('BankStatements.tsx'), /start\.onItsWayCents === null \? W\.startNotCounted/);
  });
  it('the window draws the SAVED figure through the shipped joined band (no second band), past tense', () => {
    const win = code('BankCheckWindow.tsx');
    assert.match(win, /<BankBand date=\{check\.date\} figure=\{check\.figure\} typed saved \/>/);
    assert.match(win, /import KitDialog from '\.\.\/\.\.\/KitDialog'/);
    assert.match(readCode(TILES), /label: saved \? W\.savedBank : W\.bandBank[\s\S]*label: saved \? W\.savedShould : isPhone \? W\.bandShouldPhone : W\.bandShould/);
  });
  it('Delete and Check this statement again are a writer\'s only (B7)', () => {
    const win = code('BankCheckWindow.tsx');
    // The door row stands for a writer, or (BC5b) for anyone on a saved check, for Print; Delete inside it is a writer's.
    assert.match(win, /\{\(canMove \|\| !start\) && \([\s\S]{0,160}?<div className=\{canMove \? s\.recordDoor : `\$\{s\.recordDoor\} \$\{s\.printOnly\}`\}>/);
    assert.match(win, /\{canMove && \(startHeld\s*\? <p className=\{s\.statusNote\}>/);
    assert.match(win, /<RecordDelete onClick=/, 'an admin record\'s delete is RepKit\'s RecordDelete (design 2026-10-09)');
    assert.match(win, /footer=\{canMove && !start \? \(\s*<button type="button" className="btn btn-lime" onClick=\{\(\) => onAgain\(check\.date\)\}/);
    assert.doesNotMatch(win, /footerStart=|W\.close\b/, 'a record window closes by its ×: no Close, no door in the foot');
    assert.match(code('BankTab.tsx'), /<BankCheckWindow orgSlug=\{orgSlug\} view=\{view\} check=\{opened\} canMove=\{canMove\}/);
  });
  it('Delete asks once, goes through bankWrite, and a stale refusal goes to staleRefresh', () => {
    const win = code('BankCheckWindow.tsx');
    assert.match(win, /bankWrite\(bankUrl\(orgSlug, `\/accounts\/\$\{view\.account\.id\}\/checks\/\$\{check\.id\}`\), 'DELETE'/);
    assert.match(win, /if \(isStaleView\(r\.code\)\) onStale\(r\.error\); else setError\(r\.error\);/);
    assert.match(win, /\{asking && \(\s*<KitDialog\s+kind="question"/, 'one question first');
    assert.match(code('BankTab.tsx'), /<BankCheckWindow [\s\S]{0,200}onStale=\{t => void staleRefresh\(t\)\}/);
    assert.match(code('BankShared.ts'), /'check_not_found'/, 'a check already gone is a stale view');
    assert.equal(BANK_WORDS.deleteAsk('Oct 31, 2026'), 'Delete the check for Oct 31, 2026? Its figures go; who deleted it and when is kept.');
  });
  it('the start\'s door says the server\'s own sentence before the tap while a later check stands', () => {
    const win = code('BankCheckWindow.tsx');
    assert.match(win, /const startHeld = start && view\.checks\.length > 0;/);
    assert.match(win, /BANK_REFUSAL\.start_has_checks/);
  });
  it('who checked it and when: the clock only through formatTime, the day only through formatStoredDate', () => {
    const win = code('BankCheckWindow.tsx');
    assert.match(win, /formatTime\(at\.time\)/);
    assert.match(win, /dayYear\(at\.date\)/);
    assert.doesNotMatch(win + code('BankStatements.tsx'), /toLocale(Time|Date)?String|getHours|getMinutes/);
  });
  it('Check this statement again re-keys the form with the date; the form focuses the balance', () => {
    // Keyed by the signed-in person too (WD1: their working draft is read as the card mounts).
    assert.match(code('BankTab.tsx'), /<BankCheckForm key=\{`\$\{again\?\.n \?\? 0\}:\$\{personId \?\? ''\}`\} againDate=\{again\?\.date\}/);
    // The handed date wins over a working draft's (WD1), which wins over today.
    assert.match(code('BankCheckForm.tsx'), /useState\(againDate \?\? restored\?\.date \?\? today\)/);
    assert.match(code('BankCheckForm.tsx'), /field\?\.focus\(\{ preventScroll: true \}\)/);
  });
  it('the top line says "Checked through {date}" and an amber chip when the latest check is off (ask 4)', () => {
    const list = code('BankStatements.tsx');
    assert.match(list, /W\.checkedThroughLead/);
    assert.match(list, /through\.result === 'off' && view\.checks\[0\] && \(\s*<button type="button" className=\{s\.chipDoor\} aria-label=\{W\.openOffCheck\(cents\(through\.offByCents\), dayYear\(through\.date\)\)\} onClick=\{\(\) => onOpen\(view\.checks\[0\]\.id\)\}>\s*<RepChip tone="warn">\{W\.offBy\(/,
      'the chip is a door to the latest check: every highlight opens, its name keeping the amount');
  });
});

// ── Bank balance check BC4b: the Bank tab on a phone (drawing tabs 1, 3, 5; owner 2026-11-06) ────────────────────────
describe('11 · the phone: Find as row cards, the callout\'s row, the two phone words', () => {
  it('below 640px Find is the kit\'s row cards in one list, never the table', () => {
    const find = code('BankFind.tsx');
    assert.match(find, /const isPhone = useIsPhone\(\);/);
    // The table is the desk's branch only; the phone's is ClubRowList.
    assert.match(find, /: isPhone \? \(searchedEmpty \? null : phoneList\) : deskTable\}/);
    // Money in stays green at a desk too: scoped above the kit table's own cell ink (/review BC4b caught it tying).
    assert.match(readSource(CSS), /\.findTable td\.moneyIn, \.cardAmt\.moneyIn \{ color: var\(--badge-success-ink\); \}/);
    assert.match(find, /const phoneList = \(\s*<div className=\{s\.findCards\}>\s*<ClubRowList label=\{sinceTitle\}>/);
    assert.match(find, /const deskTable = \(\s*<div className=\{repKit\.tableFrame\}>\s*<table /);
    const cards = find.slice(find.indexOf('const phoneList'), find.indexOf('const deskTable'));
    assert.match(cards, /<\/ClubRowList>/, 'the phone list is whole before the desk table starts');
    assert.doesNotMatch(cards, /<table|<tr\b|<td\b/, 'no table on a phone');
    // A card is never a button: its action is its own control (the kit's RowAction).
    assert.doesNotMatch(find, /<ClubRow\b[^>]*\bas=/, 'a Find card has no as="button"/"link"');
    assert.match(find, /<RowAction aria-label=\{action\.aria\} onClick=\{action\.onClick\} disabled=\{action\.disabled\}>\{action\.label\}<\/RowAction>/);
    assert.match(find, /<RowAction quiet aria-label=\{W\.undoLine\(name\)\} onClick=\{undo\}>\{W\.undo\}<\/RowAction>/);
  });
  it('the signed amount is the engine\'s sign, formatted; no arithmetic on the screen', () => {
    const find = code('BankFind.tsx');
    assert.match(find, /moved\(signed\(l\.direction, l\.amountCents\)\)/);
    assert.match(find, /moved\(oiw\.cents\)/, 'the online payments\' amount as the figure signs it');
    assert.match(readCode('lib/bank-check.ts'), /export const signed = \(direction: BankDirection, cents: number\) => \(direction === 'in' \? cents : -cents\);/);
    assert.doesNotMatch(find, /amountCents\s*\*|-\s*l\.amountCents|\*\s*-1/, 'no sign worked out on the screen');
  });
  it('the phone pages by 10, the desk by 50; Show more is a real button ending its group', () => {
    const find = code('BankFind.tsx');
    assert.match(find, /const PAGE = 50;\nconst PAGE_PHONE = 10;/);
    assert.match(find, /const page = isPhone \? PAGE_PHONE : PAGE;/);
    assert.match(find, /\{more > 0 && <MoreRow n=\{more\} onClick=\{\(\) => setPages\(n => n \+ 1\)\} \/>\}/);
    assert.match(find, /\{beforeMore > 0 && <MoreRow n=\{beforeMore\} onClick=\{\(\) => setBeforePages\(n => n \+ 1\)\} \/>\}/);
    assert.match(find, /function MoreRow[\s\S]{0,120}<li className=\{s\.cardMore\}>\s*<button type="button" className=\{s\.link\} onClick=\{onClick\}>\{W\.showMore\(n\)\}<\/button>/);
  });
  it('the search stays on a phone, full width above the cards (owner, BC4b)', () => {
    assert.match(code('BankFind.tsx'), /\{isPhone \? <SearchField value=\{query\} onChange=\{searchFor\} label=\{W\.findSearch\} layout="fill" \/>/);
  });
  it('a hinted card is amber-soft, never red; marked and on-their-way cards are greyed', () => {
    const css = readSource(CSS);
    assert.match(css, /\.findCards li:has\(\.chipDoor\) \{ background: rgba\(var\(--warning-rgb\), 0\.08\); \}/);
    assert.match(css, /\.cardDim \{ color: var\(--text-tertiary\); \}/);
    // Never the kit's `muted` opacity on a Find card: it took the caption under the contrast floor (/review BC4b).
    assert.doesNotMatch(code('BankFind.tsx'), /<ClubRow muted\b|<ClubRow[^>]*\bmuted\b/);
    // A failed save's sentence sits by Save on a phone, where Save is the card's last thing.
    assert.match(code('BankCheckForm.tsx'), /\{isPhone && <FormError inPlace>\{error\}<\/FormError>\}\s*\{isPhone && saveButton\}/);
  });
  it('the callout\'s answers are each a full-width row on a phone, equal widths', () => {
    const css = readSource(CSS);
    const phone = css.slice(css.lastIndexOf('@media (max-width: 640px)'));
    // Each its own full-width row, one line (/design BC4b: side by side they broke mid-phrase at 390 and 361).
    assert.match(phone, /\.calloutActs \{ display: flex; flex-direction: column; align-items: stretch; flex: 1 1 100%; gap: 0\.5rem; \}/);
    assert.match(phone, /\.calloutActs > :global\(\.btn\) \{ width: 100%; justify-content: center; \}/);
    // The 44px floor is the kit callout's own (≤768).
    assert.match(readSource('components/admin/kit/club/RepKit.module.css'), /@media \(max-width: 768px\) \{ \.calloutActions :global\(\.btn\) \{ min-height: var\(--tap-min, 44px\); \} \}/);
  });
  it('the two phone words come from the words module: "Bank balance" (fields side by side) and "Should be there"', () => {
    assert.equal(BANK_WORDS.checkBalancePhone, 'Bank balance');
    assert.equal(BANK_WORDS.bandShouldPhone, 'Should be there');
    // The phone captions and group head (/marketing BC4b): no year, no figure in the middle tile (it can't be one amount).
    assert.equal(BANK_WORDS.bandBankCaptionPhone('Nov 1'), 'On Nov 1');
    assert.equal(BANK_WORDS.bandShouldCaptionPhone, 'Your books, adjusted for what’s pending');
    assert.equal(BANK_WORDS.findSinceMatchPhone('Sep 30'), 'Since your last match · Sep 30');
    assert.match(readCode(TILES), /captionShort: saved \? undefined : W\.bandBankCaptionPhone\(dayShort\(date\)\)/);
    assert.match(readCode(TILES), /captionShort: saved \? undefined : W\.bandShouldCaptionPhone/);
    assert.match(code('BankFind.tsx'), /<ClubRowBand>\{sinceHead\}<\/ClubRowBand>/);
    assert.match(code('BankCheckForm.tsx'), /label=\{isPhone \? W\.checkBalancePhone : W\.checkBalance\}/);
    const css = readSource(CSS);
    const phone = css.slice(css.lastIndexOf('@media (max-width: 640px)'));
    assert.match(phone, /\.checkRow \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
  });
  it('no pinned strip or dock, and no tick vocabulary, on any bank screen', () => {
    for (const f of [...FILES, CSS]) {
      const src = f === CSS ? readSource(f) : readCode(f);
      assert.doesNotMatch(src, /position:\s*sticky|position:\s*fixed/, `${f}: a pinned strip or dock`);
      assert.doesNotMatch(src, /\b[Tt]ick(ed|ing|s)?\b(?![- ]?off\b)/, `${f}: tick vocabulary`);
    }
  });
});

describe('12. BC5a: the Overview line and the fiscal-year close row (ask 4, R0 tab 7; owner 2026-11-06)', () => {
  const OVERVIEW = 'app/[orgSlug]/admin/accounting/page.tsx';
  const line = readCode(`${DIR}/BankOverviewLine.tsx`);
  it('the line sits right of "Where the club stands", from the summary read, never a year (it reads today on every year)', () => {
    const page = readCode(OVERVIEW);
    assert.match(page, /<BankOverviewLine marks=\{read\.bank \?\? null\} accountingBase=\{base\}>\s*<p className=\{cr\.recordSectionTitle\}>\{SUMMARY_WORDS\.standsHeading\(summary\.today\)\}<\/p>\s*<\/BankOverviewLine>/);
    const route = readCode('app/api/admin/accounting/summary/route.ts');
    assert.match(route, /bankMarks\(ctx\),/);
    const steps = readCode('lib/bank-club-steps.ts');
    const marks = steps.slice(steps.indexOf('export async function bankMarks'), steps.indexOf('const allBooks'));
    assert.match(marks, /checkedThrough: checkedThrough\(a\.checks\)/);
    assert.doesNotMatch(marks, /year|asOf|lastDay/i);
  });
  it('one line per account, each a door to the Bank tab on it; the off chip a door to that check; never a figure', () => {
    assert.match(line, /marks\.accounts\.map\(a =>/);
    assert.match(line, /<Link href=\{bankTabHref\(accountingBase, a\.id\)\} className=\{s\.overviewDoor\}>/);
    assert.match(line, /t\?\.result === 'off' && \(\s*<Link href=\{bankTabHref\(accountingBase, a\.id, t\.id\)\} className=\{s\.chipDoor\}/);
    assert.match(line, /<RepChip tone="warn">\{W\.offBy\(cents\(t\.offByCents\)\)\}<\/RepChip>/);
    assert.doesNotMatch(line, /bankCents|booksCents|shouldBe/);
  });
  it('no account: a writer’s door to the first check; a reader sees no line', () => {
    assert.match(line, /marks\.accounts\.length === 0\s*\? \(marks\.canMove \? \[/);
  });
  it('the Bank tab opens on the door’s account and check once, then drops them from the address', () => {
    const tab = readCode(`${DIR}/BankTab.tsx`);
    assert.match(tab, /if \(arrived\.current === null\) arrived\.current = \{ account: search\.get\('account'\), check: search\.get\('check'\) \};/);
    assert.match(tab, /arrived\.current = \{ account: null, check: null \};/);
    assert.match(tab, /rest\.delete\('account'\); rest\.delete\('check'\);/);
    // BC9a (owner "Club findings before the walk" 2026-11-07): the window opens only once the address no longer carries
    // the keys — never in the effect that replaces it (Back after closing reopened the check on the coach side, BC8a).
    const strip = tab.slice(tab.indexOf('const pendingCheck = useRef'), tab.indexOf('}, [view, router, pathname]);'));
    assert.doesNotMatch(strip, /setWin\(/);
    assert.match(tab, /if \(!id \|\| search\.has\('account'\) \|\| search\.has\('check'\)\) return;\s*pendingCheck\.current = null;\s*setWin\(\{ kind: 'check', id \}\);/);
  });
  it('the printed check’s items row may break across sheets (a near-page list never jumps whole to sheet two)', () => {
    const css = readCode(`${DIR}/BankReport.module.css`);
    assert.match(css, /\.items tr, \.sums > tbody > tr \{ break-inside: avoid; \}/);
    assert.match(css, /\.sums > tbody > tr:has\(> \.itemsCell\) \{ break-inside: auto; \}/);
  });
  it('the close row: a fifth kind from the server, no count, no figure, its door the Bank tab; never stored by the close', () => {
    const reads = readCode('lib/club-fiscal-reads.ts');
    assert.match(reads, /bank: bankOpen\(bank\?\.accounts \?\? \[\], year\.lastDay\),/);
    // A warning only: the close and the Overview read the bank quietly (a failed read never blocks either, /review BC5a).
    assert.match(reads, /readClubBankMarksQuietly\(orgId\),/);
    assert.match(readCode('lib/bank-club-steps.ts'), /const marks = await readClubBankMarksQuietly\(ctx\.org\.id\);\s*if \(!marks\) return null;/);
    const snap = reads.slice(reads.indexOf('function closeSnapshot('), reads.indexOf('// ── The Overview'));
    assert.doesNotMatch(snap, /\bbank\b/, 'the close stores no bank state (owner "Close snapshot")');
    const parts = readCode('components/admin/kit/club/money/FiscalYearParts.tsx');
    assert.match(parts, /o\.pending\.count \+ o\.bank\.count > 0/);
    const row = parts.slice(parts.indexOf('{o.bank.rows.map(r => ('), parts.indexOf('))}', parts.indexOf('{o.bank.rows.map(r => (')));
    assert.doesNotMatch(row, /count=|figure=/);
    assert.match(row, /href=\{bankTabHref\(accountingBase, r\.accountId, r\.kind === 'off' \? r\.checkId : undefined\)\}/);
  });
  it('the reader names no year: the close passes the year’s last DAY to the pure rule', () => {
    const rules = readCode('lib/bank-club-rules.ts');
    assert.match(rules, /export function bankCloseRow\(checks: readonly ClubSavedCheck\[\], lastDay: string\)/);
    assert.doesNotMatch(readCode('lib/bank-club-read.ts'), /fiscal|lastDay/i);
  });
});

describe('13. BC5b: the printed report (ask 9, R0 tab 9; owner "Report door / books changed / order / extras" 2026-11-06)', () => {
  const win = readCode(`${DIR}/BankCheckWindow.tsx`);
  const rep = readCode(`${DIR}/BankCheckReport.tsx`);
  it('"Print this check" is RepKit\'s RecordAction on every saved check, never the start, a reader\'s too, a desk\'s only', () => {
    assert.match(win, /\{!start && \(\s*<span className=\{s\.printDoor\}>\s*<RecordAction icon=\{<Printer[^>]*\/>\} onClick=\{\(\) => window\.print\(\)\}/);
    assert.doesNotMatch(win.slice(win.indexOf('s.printDoor'), win.indexOf('W.printCheck')), /canMove/, 'printing is a read');
    assert.match(win, /\{!start && <BankCheckReport view=\{view\} check=\{check\} \/>\}/);
    const css = readSource(CSS);
    assert.match(css, /@media \(max-width: 640px\) \{\s*\.printDoor \{ display: none; \}/, 'the report has no phone version');
  });
  it('the shipped PrintedPage frame; bank first from the engine, the starting point from the engine, no arithmetic on the page', () => {
    assert.match(rep, /import PrintedPage from '@\/components\/admin\/tournament\/PrintedPage';/);
    assert.match(rep, /<PrintedPage\s+name="bank-check"/);
    assert.match(rep, /const \{ terms, totalCents \} = reportTerms\(check\);/);
    assert.match(rep, /startingPoint\(check, view\.start, check\.startCorrected\)/);
    assert.doesNotMatch(rep, /Cents\s*[-+*/]\s*\w|\w\s*[-+]\s*\w+Cents\b/, 'no money arithmetic on the page');
    assert.doesNotMatch(rep, /accountNumber|bookName\b|Book'|budget/i, 'no account number, no Book column, no Budget vs. Actual');
  });
  it('prints the saved figures, with "Books now say" and its reason as the window says them; the clock through formatTime', () => {
    assert.match(rep, /check\.booksNowSayCents !== null && \(/);
    assert.match(rep, /check\.startCorrected \? W\.booksNowSayStartWhy : W\.booksNowSayWhy\(when\)/);
    assert.match(rep, /W\.reportCheckedBy\(check\.checkedBy, check\.checkedByRole, dayYear\(at\.date\), formatTime\(at\.time\)\)/);
  });
  it('the report\'s words', () => {
    assert.equal(BANK_WORDS.printCheck, 'Print this check');
    assert.equal(BANK_WORDS.reportEyebrow('Lakeshore Lynx'), 'Lakeshore Lynx · Bank check');
    assert.equal(BANK_WORDS.reportCheckedBy('Priya Shah', 'Treasurer', 'Nov 3, 2026', '8:14 p.m.'), 'Checked by Priya Shah (Treasurer), Nov 3, 2026 at 8:14 p.m.');
    assert.equal(BANK_WORDS.reportFoot('Nov 4, 2026', 'Lakeshore Lynx'), 'Printed Nov 4, 2026 from FieldLogicHQ · Lakeshore Lynx · Accounting → Bank');
  });
});
