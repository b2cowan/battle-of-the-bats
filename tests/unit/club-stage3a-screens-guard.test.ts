import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { closeWarning, unsettledLines } from '../../lib/club-season-words.ts';

/**
 * CLUB TIER STAGE 3a · SESSION 2 — THE SCREENS (built to hub v22; plan §6 Stage 3). Pins the frame, the
 * retirements and the rules the drawings carry, so a later pass cannot quietly undo one:
 *   · Accounting is ONE page with the coach's tab row (Ask 2 option B) — the row PROMOTED, never copied;
 *   · the club's Ledger is the coach's Ledger, on the coach's own controls (Ask 6);
 *   · the old addresses forward before the Rep Teams layout can send a treasurer away;
 *   · the retired pages and shim routes stay gone;
 *   · a row's worded action is olive, and a correction (void, undo, reverse) is never red;
 *   · the coach SAYS sent, with the day, how and the reference (Ask 1).
 */

const ACCT = 'app/[orgSlug]/admin/accounting';
const MONEY = 'components/admin/kit/club/money';

describe('the frame — Accounting is one page with tabs (Ask 2 option B)', () => {
  it('the gate is decided on the server, by the one rule every Accounting route asks', () => {
    const layout = readCode(`${ACCT}/layout.tsx`);
    assert.match(layout, /canOpenModule\(ctx, ctx\.org, 'module_accounting'\)/);
    assert.match(layout, /<AccountingFrame/);
  });
  it('the tab row is the coach\'s, PROMOTED: one component both sides render, its rules out of the portal sheet', () => {
    assert.match(readCode(`${MONEY}/AccountingFrame.tsx`), /import HubTabBar from '@\/components\/shared\/HubTabBar'/);
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx'), /import HubTabBar from '@\/components\/shared\/HubTabBar'/);
    assert.ok(!existsSync('components/coaches/CoachTabBar.tsx'), 'the old file is gone, not left as a second copy');
    assert.match(readCode('components/shared/HubTabBar.tsx'), /from '\.\/HubTabBar\.module\.css'/);
    assert.doesNotMatch(readCode('app/[orgSlug]/coaches/coaches.module.css'), /^\.coachTabBtn \{/m, 'the row\'s rules moved, they were not copied');
  });
  it('no create in the page header; a page one level down has no tab row', () => {
    const frame = readCode(`${MONEY}/AccountingFrame.tsx`);
    // No actions (no create in the header) and no eyebrow (the club's name is in the bar above, owner 2026-10-01).
    assert.match(frame, /<AdminPageHeader title="Accounting" \/>/);
    // One level down: the page alone — no header, no tab row — inside the money frame's width (2026-10-07).
    assert.match(frame, /if \(!tab\) return <div className=\{repKit\.moneyFrame\}>\{children\}<\/div>;/);
  });
});

describe('the Ledger reads like the coach\'s Ledger (Ask 6), on the coach\'s own controls', () => {
  const ledger = readCode(`${ACCT}/ledger/page.tsx`);
  it('the filter pills are the portal\'s, promoted into a shared module', () => {
    for (const c of ['MultiSelectDropdown', 'SingleSelectDropdown', 'DateRangeDropdown']) {
      assert.match(ledger, new RegExp(`import ${c} from '@/components/coaches/${c}'`));
      assert.match(readCode(`components/coaches/${c}.tsx`), /from '\.\.\/shared\/FilterPill\.module\.css'/);
    }
    assert.doesNotMatch(readCode('app/[orgSlug]/coaches/coaches.module.css'), /^\.multiSelectSummary \{/m);
  });
  it('Status opens on Posted + Pending; Date opens on This month (the club\'s difference)', () => {
    assert.match(ledger, /const STATUS_REST: ReadonlySet<string> = new Set\(\['posted', 'pending'\]\);/);
    assert.match(ledger, /restQuiet restSelectionId="thisMonth"/);
    assert.match(ledger, /resolveDateRangePreset\('thisMonth', today, bounds\)/);
  });
  it('the Book pill lists the club\'s own books — a team\'s book is the coaches\' (Ask 5a, C12)', () => {
    assert.match(ledger, /filter\(b => b\.ledger\.entityType !== 'team'\)/);
    assert.match(ledger, /router\.replace\(`\$\{base\}\/teams\/\$\{teamBook\.ledger\.entityId\}`\)/, 'a team book\'s old address forwards to the team');
  });
  it('both halves of the filed word show — Category then Item, as on the coach’s Ledger (owner 2026-10-07)', () => {
    assert.match(ledger, /<th scope="col">Category<\/th>\s*<th scope="col">Item<\/th>/);
    assert.match(ledger, /data-label="Category">\{row\.category \?\? ''\}<\/td>\s*<td className=\{moneyKit\.cat\} data-label="Item">\{row\.item \?\? ''\}<\/td>/);
    assert.match(ledger, /label="Item" options=\{\(read\?\.items \?\? \[\]\)/, 'the Item filter lists the items on the book');
    assert.match(ledger, /params\.append\('category', c\)/, 'one category= per choice — a word may carry a comma');
    assert.match(ledger, /params\.append\('item', i\)/, 'one item= per choice — an item may carry a comma');
  });
  it('the Balance leaves once an entry that moves it is hidden — Type, Category, Item, or Status without Posted (§255); the export holds the whole period', () => {
    assert.match(ledger, /const showBalance = types\.size === 0 && cats\.size === 0 && items\.size === 0 && statuses\.has\('posted'\);/);
    assert.match(ledger, /params\.set\('export', '1'\)/);
  });
  it('the coach\'s Ledger holds the same rule: a Status without Actual takes the Balance too (§255)', () => {
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx'),
      /selectedStatus\.size > 0 && !selectedStatus\.has\('actual'\) \? 'x' : '',/);
  });
});

describe('old addresses forward, before the Rep Teams layout can turn a treasurer away', () => {
  const proxy = readCode('proxy.ts');
  it('Cost allocation (and every allocation), Payment requests, and a ledger\'s own address', () => {
    assert.match(proxy, /segments\[2\] === 'rep-teams' && segments\[3\] === 'allocations'/);
    assert.match(proxy, /admin\/accounting\/allocations/);
    assert.match(proxy, /segments\[2\] === 'rep-teams' && segments\[3\] === 'payment-requests'/);
    assert.match(proxy, /url\.searchParams\.set\('book', segments\[4\]\)/);
  });
  it('the notices the club receives open Accounting, on the bill or the request', () => {
    const notify = readCode('lib/club-money-notify.ts');
    assert.match(notify, /admin\/accounting\/allocations\/\$\{allocationId\}\$\{splitId \? `\?bill=/);
    assert.match(notify, /admin\/accounting\/payment-requests\$\{requestId \? `\?request=/);
  });
});

describe('what this session retired stays retired', () => {
  it('the old pages, their old look and the shim routes', () => {
    for (const gone of [
      'app/[orgSlug]/admin/rep-teams/allocations/page.tsx',
      'app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx',
      'app/[orgSlug]/admin/rep-teams/payment-requests/page.tsx',
      'app/[orgSlug]/admin/accounting/ledger/[ledgerId]/page.tsx',
      'app/[orgSlug]/admin/accounting/accounting.module.css',
      'app/api/admin/rep-teams/upcoming-payables/route.ts',
      'app/api/admin/rep-teams/allocations/send-reminders/route.ts',
      'app/api/admin/rep-teams/payment-requests/route.ts',
      'app/api/admin/rep-teams/payment-requests/[id]/route.ts',
      'app/api/admin/rep-teams/allocations/[allocationId]/splits/[splitId]/installments/[installId]/route.ts',
    ]) assert.ok(!existsSync(gone), `${gone} is retired`);
  });
  it('the Rep Teams board no longer carries the Upcoming bills panel', () => {
    assert.doesNotMatch(readCode('app/[orgSlug]/admin/rep-teams/page.tsx'), /UpcomingPayablesPanel/);
  });
  it('the Accounting overview no longer sends reminder waves (allocation reminders moved; families\' are Stage 5\'s)', () => {
    const overview = readCode(`${ACCT}/page.tsx`);
    assert.doesNotMatch(overview, /send-reminders|send-automated-reminders/);
  });
});

describe('the formatting rulings the windows carry', () => {
  it('a row\'s worded action is olive, never lime (Record received, Confirm received)', () => {
    const bill = readCode(`${MONEY}/BillWindows.tsx`);
    assert.match(bill, /<RowAction onClick=\{\(\) => onRecord\(i, 'receive'\)\}>Record received<\/RowAction>/);
    assert.match(bill, /<RowAction onClick=\{\(\) => onRecord\(i, 'confirm'\)\}>Confirm received<\/RowAction>/);
  });
  it('a correction is never red: void, undo and reverse keep the lines, marked void', () => {
    for (const f of [`${MONEY}/BillWindows.tsx`, `${MONEY}/RequestWindows.tsx`, `${MONEY}/LedgerWindows.tsx`]) {
      assert.doesNotMatch(readCode(f), /btn-danger/, `${f} dresses a correction in red`);
    }
  });
});

describe('the coach says SENT, with the day, how and the reference (Ask 1, specimen 7)', () => {
  const club = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx');
  it('"We\'ve sent it" opens a window and sends what the club needs to match it', () => {
    assert.match(club, /function SentWindow\(/);
    assert.match(club, /body: JSON\.stringify\(\{ sentOn: form\.sentOn, method: form\.method \|\| null, reference: form\.reference\.trim\(\) \|\| null \}\)/);
    assert.doesNotMatch(club, /\bmarkPaid\(/, 'the one-tap "record as paid" is gone');
  });
  it('a stale tap is refused in words and the bill re-reads in place', () => {
    assert.match(club, /async function refusedAsStale\([^\n]*\) \{\s*setActionError\([^;]+;\s*release\(\);\s*await refreshAfterWrite\(true\);/);
    // Both installment writes (We've sent it, Take it back) route their 409 through it.
    assert.equal(club.match(/if \(res\.status === 409\) \{ await refusedAsStale\(data, release\);/g)?.length, 2);
  });
  it('the coach\'s Ledger says a sent payment is waiting for the club, as a chip', () => {
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx'), /r\.waitingOnClub && <> <span className=\{styles\.registerChip\}>\{CLUB_SENT_WAITING_WORD\}<\/span><\/>/);
  });
  it('the payout sheet says the club has been told', () => {
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx'), /The club has been told it’s holding up your payout/);
  });
});

describe('the club\'s season window counts what the team owes the club (Ask 5b) — warns, never blocks', () => {
  it('the lines and the close sentence', () => {
    const owed = { installments: 2, amount: 810, sent: 1, requestsWaiting: 1 };
    assert.deepEqual(unsettledLines(null, owed), [
      '2 installments ($810.00) still owed to the club, 1 of them sent and waiting for the club to confirm',
      '1 payment request still waiting on the club',
    ]);
    assert.equal(
      closeWarning({ familiesOwing: 1, familiesWaitingToReturn: 0 }, { installments: 0, amount: 0, sent: 0, requestsWaiting: 2 }),
      '1 family still owes dues, and 2 payment requests are still waiting on the club. You can still close.',
    );
    // All four at once: clauses with their verbs, one comma before the last "and" (/review, 10-01).
    assert.equal(
      closeWarning({ familiesOwing: 3, familiesWaitingToReturn: 1 }, owed),
      '3 families still owe dues, money is waiting to go back to 1 family, 2 installments ($810.00) are still owed to the club, and 1 payment request is still waiting on the club. You can still close.',
    );
    assert.equal(closeWarning(null, null), null);
  });
});

describe('one admin button size, the portal’s (owner, 2026-10-01, option A)', () => {
  const css = readCode('app/globals.css');
  it('every admin button takes the one control height and the portal’s padding, at a weight a screen module can still override', () => {
    assert.match(css, /:where\(\[data-admin-kit\]\) \.btn:where\(:not\(\[data-public-preview\] \*\)\) \{\s*min-height: var\(--admin-control-h\);\s*padding: 0\.45rem 0\.9rem;/);
    // The former compact button no longer shrinks its type (it was the support step on the tournament screens and Export).
    const dataRule = css.match(/\[data-admin-kit\] \.btn-data:where\(:not\(\[data-public-preview\] \*\)\) \{[^}]*\}/)?.[0] ?? '';
    assert.ok(dataRule, 'the kit .btn-data rule exists');
    assert.doesNotMatch(dataRule, /font-size/, '.btn-data is the one size, not the support step');
    assert.doesNotMatch(css, /\[data-admin-kit\] \.btn-xs[^{]*\{[^}]*font-size: var\(--type-support\)/);
  });
  // ⚖ The HEIGHT is superseded (owner, 2026-10-03, "One control height"): the 10-01 38px rested on "the portal's
  // buttons are ~38", which measured 33.4 (white) and 31.4 (lime). One number now holds across the product.
  it('one control height, the portal’s button: 34px on a computer, 38 below 769px and in comfortable density', () => {
    const root = css.match(/--admin-row-pad-y:\s*0\.38rem;[\s\S]*?--admin-control-h:\s*(\d+)px;/)?.[1];
    assert.equal(root, '38', 'the default — a phone or a tablet — keeps 38, so no touch size moved');
    assert.match(css, /\[data-density="comfortable"\] \{[^}]*--admin-control-h:\s*38px;/);
    assert.match(css, /@media \(min-width: 769px\) \{\s*:root:not\(\[data-density="comfortable"\]\) \{ --admin-control-h: 34px; \}/);
  });
  it('the portal’s buttons take the same 34px on a computer, at no weight, so the lime and white match and any sized variant still wins', () => {
    const coach = readCode('app/[orgSlug]/coaches/coaches.module.css');
    const menu = readCode('components/coaches/CoachToolbarMenu.module.css');
    assert.match(coach, /@media \(min-width: 769px\) \{\s*:where\(\.btnPrimary:not\(\.compactAction\), \.btnSecondary:not\(\.compactAction\)\) \{ min-height: 34px; \}/);
    assert.match(menu, /@media \(min-width: 769px\) \{\s*:where\(\.trigger:not\(\.triggerChip\):not\(\.triggerGlyph\)\) \{ min-height: 34px; \}/);
  });
  it('a tournament toolbar control reads the shared height instead of a hand-written 38', () => {
    const T = 'app/[orgSlug]/admin/tournaments';
    for (const f of ['communication/communication.module.css', 'settings/settings-access.module.css']) {
      assert.doesNotMatch(readCode(`${T}/${f}`), /min-height:\s*38px/, f);
    }
    // Two named exceptions, neither a control: a health issue is a LIST ROW, and the Results lens pill is a
    // chip — chips keep their own height (ruling 3).
    const teams = readCode(`${T}/registrations/teams-admin.module.css`).replace(/\.regHealthIssue \{[^}]*\}/, '');
    assert.doesNotMatch(teams, /min-height:\s*38px/, 'teams-admin');
    const results = readCode(`${T}/results/results-admin.module.css`).replace('.lensPill { min-height: 38px; }', '');
    assert.doesNotMatch(results, /min-height:\s*38px/, 'results-admin');
  });
  it('the Ledger’s Payees door sits behind Tools, never a toolbar button and never olive text (Ledger Parity D6)', () => {
    // ⚖ Superseded 2026-10-02: the white Payees button (10-01) moved into Tools with Transfer — a rare tool goes
    // behind one menu on both Ledgers. Still never olive text: that is a card-foot door.
    const ledger = readCode(`${ACCT}/ledger/page.tsx`);
    assert.match(ledger, /<CoachToolbarMenu label="Tools"/);
    // A LINK since Sheet Frame step 5 (2026-10-06): on a phone Tools is a sheet that stands a Back step, and a step
    // only knows a tap left the page when the tap was a link — a router.push from a button was cancelled by the
    // step's own history.back() (the §258 failure).
    assert.match(ledger, /label="Payees"[\s\S]{0,200}href=\{payeesHref\} \/>/);
    assert.match(ledger, /label="Transfer"/);
    assert.doesNotMatch(ledger, /<Link href=\{payeesHref\}/, 'no Payees button on the toolbar');
    assert.doesNotMatch(ledger, /className=\{kit\.footLink\}/);
  });
});

describe('Coming due, round 2 (walk S3W3, owner 2026-10-05: CD1–CD4)', () => {
  const allocs = readCode(`${ACCT}/allocations/page.tsx`);
  it('CD1 — the Due window is a pill beside View, in Coming due only, quiet on the 14 days; "Show all" is gone', () => {
    assert.match(allocs, /view === 'coming-due' && \([\s\S]{0,120}<FilterGroup>[\s\S]{0,120}<SingleSelectDropdown\s+restQuiet restValue="soon"\s+label="Due"/);
    assert.doesNotMatch(allocs, /Show all/);
    assert.doesNotMatch(allocs, /showLater/);
  });
  it('CD1 — the export writes the bands the window shows, from the same list the screen draws', () => {
    assert.match(allocs, /body: comingDueBands\(due, dueWindow\)\.flatMap/);
    assert.match(allocs, /comingDueBands\(due, dueWindow\)\.filter\(x => x\.b\.groups\.length > 0\)/);
  });
  it('CD1b — on a phone View stays out of the Filter sheet: only Due is inside the group', () => {
    const group = allocs.slice(allocs.indexOf('<FilterGroup>'), allocs.indexOf('</FilterGroup>'));
    assert.equal((group.match(/<SingleSelectDropdown/g) ?? []).length, 1);
    assert.doesNotMatch(group, /label="View"/);
  });
  it('CD2 — no State column: five columns, and the only chip is how many days late', () => {
    assert.match(allocs, /<td colSpan=\{5\}>\{label\}<\/td>/);
    assert.doesNotMatch(allocs, /Sent · confirm/);
    assert.doesNotMatch(allocs, /tone="warn"/);
  });
  it('CD3 — the head coach sits under the team; the sent note does not repeat the head coach', () => {
    assert.match(allocs, /\{r\.teamCaption && <span className=\{repKit\.cellSub\}>\{r\.teamCaption\}<\/span>\}/);
    assert.match(allocs, /t\.sentBy && \(named \|\| t\.sentBy !== t\.headCoach\) \? `\$\{t\.sentBy\} sent it/);
    // The phone's one-line caption has no head-coach line to lean on, so its note always names the sender.
    assert.match(allocs, /phoneNote: band === 'sent' \? sentNote\(t, true\) : null/);
    assert.match(allocs, /const after = r\.phoneNote \?\? r\.teamCaption;/);
  });
  it('CD4 — By allocation carries no note explaining how its rows open', () => {
    assert.doesNotMatch(allocs, />A row opens its allocation from anywhere on it/);
  });
});
