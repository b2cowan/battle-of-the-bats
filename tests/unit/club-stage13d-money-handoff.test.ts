/**
 * Club Tier Stage 13d, Session B — money handed between people (build prompt
 * docs/projects/active/CLUB_TIER_STAGE13D_BUILD_PROMPT.md, "Session B guards").
 *
 *   · a schedule's bill not sent yet: drafts and in-review only (`billIsPending`), reserving nothing on its line — the
 *     one "committed" figure stays `lineAllocatedCents`; the figures are the schedule's own `computeBill`
 *   · New allocation's warning never blocks; the Fair shares window opens Schedules only for someone it opens for
 *   · the Bill window names Accounting's allocations and says why the permit's line isn't offered
 *   · "Owed to the club" on Accounting's Overview is the owner's band's sum by construction (no new query); Revenue says
 *     what it includes from the year's report
 *   · the tournament's "In the club's book" line: Accounting holders only, the first row word for word, no nav row
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BILL_PENDING_STATES, billIsPending } from '../../lib/club-schedule-bill.ts';
import { BILL_LINE_WORDS, DRAFT_BILL_WORDS as W, draftBillsByLine, type DraftBill } from '../../lib/club-draft-bill.ts';
import { bandCollected, collectedByBook } from '../../lib/club-money-figures.ts';
import { OWED_TO_THE_CLUB_WORDS as O } from '../../lib/club-money-words.ts';
import { CLUB_BAND_WORDS, owedToTheClub } from '../../lib/club-band-view.ts';
import { DRAFT_BOARD_WORDS, WEEKS_BEFORE_WORDS } from '../../lib/tournament-board-words.ts';
import { kitTournamentGroups } from '../../components/admin/kit/kit-tournament-groups.ts';
import { readCode } from './_source-code.ts';

const dome: DraftBill = {
  scheduleId: 's1', name: 'Winter dome 2026–27', state: 'draft', lineId: 'L1', lineName: 'Dome time — winter dome',
  cents: 2_700_000, teamCount: 6, hours: 200, hourCents: 13_500, plan: 'monthly', payments: 2,
  teams: [{ teamId: 't1', name: '14U AA', hours: 40, cents: 540_000 }],
};

describe('a bill not sent yet (13d-3 A)', () => {
  it('is a draft or in-review schedule with a bill and no allocation — and nothing else', () => {
    assert.deepEqual([...BILL_PENDING_STATES], ['draft', 'in_review']);
    assert.equal(billIsPending({ state: 'draft', bill_plan: 'one', allocation_id: null }), true);
    assert.equal(billIsPending({ state: 'in_review', bill_plan: 'monthly', allocation_id: null }), true);
    assert.equal(billIsPending({ state: 'final', bill_plan: 'one', allocation_id: null }), false, 'Finalize made it an allocation');
    assert.equal(billIsPending({ state: 'draft', bill_plan: 'one', allocation_id: 'a1' }), false);
    assert.equal(billIsPending({ state: 'draft', bill_plan: null, allocation_id: null }), false, 'no bill rides with it');
  });
  it('reserves nothing on its line: the send’s "committed" figure is still the allocations alone', () => {
    const send = readCode('lib/club-schedule-send.ts');
    assert.doesNotMatch(send, /club-draft-bill/, 'billBlockers never counts a draft bill');
    assert.match(send, /async function lineAllocatedCents[\s\S]*?from\('rep_cost_allocations'\)[\s\S]*?lineAllocated\(/);
    // The plan's Allocated / Not allocated never read a draft either.
    assert.doesNotMatch(readCode('lib/club-budget-report.ts'), /club-draft-bill|billIsPending/);
  });
  it('the figures are the schedule’s own bill — no second computation of a share', () => {
    const reader = readCode('lib/club-draft-bill-server.ts');
    assert.match(reader, /\.in\('state', \[\.\.\.BILL_PENDING_STATES\]\)/);
    assert.match(reader, /if \(!loaded \|\| !billIsPending\(loaded\.row\)/, 'the row as loaded decides');
    assert.match(reader, /computeBill\(row, billSlotsOf\(slots, assignments\), prices\.fullHour, teamOrder\)/);
    for (const f of ['lib/club-draft-bill-server.ts', 'lib/club-draft-bill.ts', 'components/admin/kit/club/money/DraftBills.tsx']) {
      assert.doesNotMatch(readCode(f), /\b(billShares|shareCents|pricedMinutes)\(/, `${f} computes no share`);
    }
  });
});

describe('Being billed (draft) on the line (13d-3 A, tab 4 notes 1-2)', () => {
  it('the row says what it would bill and to how many teams; no amount says so', () => {
    assert.equal(W.row(dome), 'A draft schedule · $27,000.00 to 6 teams when it’s sent · not billed yet');
    assert.equal(W.row({ ...dome, cents: null }), 'Draft · no amount yet');
    assert.equal(W.row({ ...dome, cents: null, state: 'in_review' }), 'In review · no amount yet');
    assert.equal(W.row({ ...dome, state: 'in_review' }), 'A schedule in review · $27,000.00 to 6 teams when it’s sent · not billed yet');
  });
  it('the budget table caption, and Not allocated stops saying the club pays it', () => {
    assert.equal(W.caption([dome]), '$27,000.00 being billed (draft)');
    assert.equal(W.caption([{ ...dome, cents: null }]), 'Being billed (draft) · no amount yet');
    assert.equal(W.notAllocated([dome], 2_700_000), 'A draft schedule is billing all of it. Allocating it here too bills the same teams twice.');
    assert.equal(W.notAllocated([dome], 3_000_000), 'A draft schedule is billing $27,000.00 of it. Allocating it here too bills the same teams twice.');
    const win = readCode('components/admin/kit/club/money/BudgetWindows.tsx');
    assert.match(win, /draftBills\.length \? DRAFT_BILL_WORDS\.notAllocated\(/);
    assert.match(win, /<BeingBilledRows bills=\{draftBills\}/);
    assert.match(readCode('components/admin/kit/club/money/BudgetPlanList.tsx'), /DRAFT_BILL_WORDS\.caption\(drafts\)/);
  });
  it('groups by line', () => {
    const by = draftBillsByLine([dome, { ...dome, scheduleId: 's2' }, { ...dome, scheduleId: 's3', lineId: 'L2' }]);
    assert.equal(by.get('L1')?.length, 2);
    assert.equal(by.get('L2')?.length, 1);
  });
});

describe('the read-only Fair shares window (13d-3 A, tab 4 note 3)', () => {
  it('opens Schedules only for someone the one Schedules rule opens it for', () => {
    assert.match(readCode('app/api/admin/accounting/being-billed/route.ts'),
      /opensSchedules: canOpenClubSchedules\(\{ planId: ctx\.org\.planId, role: ctx\.role \}\)/);
    const win = readCode('components/admin/kit/club/money/DraftBills.tsx');
    assert.match(win, /const open = opensSchedules && orgSlug\s*\?/);
    // The schedule's address appears once, behind that gate.
    assert.equal((win.match(/admin\/schedules\//g) ?? []).length, 1);
  });
  it('is Accounting’s window: the books gate, never the scheduler’s', () => {
    assert.match(readCode('app/api/admin/accounting/being-billed/route.ts'), /resolveClubMoney\(req, \{ scope: 'books', write: false \}\)/);
  });
  it('says the bill, the hours and the plan in the drawing’s words', () => {
    assert.equal(W.bill(dome), '$27,000.00 · Dome time — winter dome');
    assert.equal(W.hours(dome), '200 hours · $135.00 an hour');
    assert.equal(W.plan(dome), '2 payments, monthly');
    assert.equal(W.plan({ plan: 'one', payments: 1 }), 'One payment');
    assert.equal(W.eyebrow(dome), 'Schedule · draft · read only');
  });
});

describe('New allocation warns, never blocks (13d-3 A, tab 4 notes 4-5)', () => {
  it('names the schedule and the amount, never teams', () => {
    assert.equal(W.warnTitle([dome]), 'A draft schedule is billing this line.');
    assert.equal(W.warnOne(dome), '“Winter dome 2026–27” bills $27,000.00 to 6 teams when it’s sent.');
    assert.equal(W.warnEnd, 'Billing them here as well would charge the same time twice.');
  });
  it('the save path is unchanged: Bill is never disabled by the warning, create() never reads it', () => {
    const src = readCode('components/admin/kit/club/money/AllocationWindow.tsx');
    assert.match(src, /<DraftBillNotice bills=\{lineDrafts\}/);
    assert.match(src, /onClick=\{\(\) => void create\(\)\} disabled=\{busy\}/);
    const at = src.indexOf('async function create()');
    assert.ok(at > 0);
    const create = src.slice(at, at + 4000);
    assert.doesNotMatch(create, /lineDrafts|readDrafts/);
  });
});

describe('the Bill window sees Accounting’s allocations (13d-4 A, tab 4 notes 6-7)', () => {
  it('names each allocation by name, teams and amount', () => {
    const said = BILL_LINE_WORDS.billed([
      { name: 'Fall ball diamond fees 2026', amount: 1800, teamNames: ['15U AAA', '13U AAA'], otherTeams: 0 },
      { name: 'Diamond fees 2026', amount: 6750, teamNames: ['11U', '12U', '13U', '14U', '15U'], otherTeams: 0 },
    ]);
    // The teams are said as the line window says them (`teamsPhrase`: names up to three, else a count).
    assert.equal(said, '“Fall ball diamond fees 2026” charged 15U AAA and 13U AAA $1,800.00 and “Diamond fees 2026” charged 5 teams $6,750.00. If those were for this time, billing it here charges those teams twice.');
  });
  it('says the line is short, and names off-plan', () => {
    assert.equal(BILL_LINE_WORDS.overTitle(3200, 450), 'This bill is $3,200.00; the line has $450.00 left.');
    assert.equal(BILL_LINE_WORDS.offPlanWay, 'Pick another line, or bill it off-plan: the teams are billed and no line’s budget is used.');
  });
  it('says why the permit’s line isn’t offered instead of switching to no line', () => {
    const l = { id: 'L', description: 'Diamond permits — city fields', yearName: '2026–27', left: 0, closed: false, thisYear: true };
    assert.equal(BILL_LINE_WORDS.fellAwayTitle(l), 'The permit’s line, “Diamond permits — city fields”, has nothing left to bill.');
    assert.match(BILL_LINE_WORDS.fellAwayTitle({ ...l, closed: true }), /which is closed\.$/);
    assert.match(BILL_LINE_WORDS.fellAwayTitle({ ...l, thisYear: false, left: 5 }), /a bill draws from this year’s lines\.$/);
  });
  it('is one read and one small component — it refuses nothing', () => {
    const notice = readCode('components/admin/kit/club/schedules/BillLineNotice.tsx');
    assert.match(notice, /\/api\/admin\/accounting\/line-billed\?/);
    assert.doesNotMatch(notice, /disabled|onSave|setError/);
    assert.match(readCode('app/api/admin/accounting/line-billed/route.ts'), /resolveClubMoney\(req, \{ scope: 'books', write: false \}\)/);
  });
  it('the Bill window shows it under the choice, and asks of the permit’s line whether it could be offered', () => {
    const win = readCode('components/admin/kit/club/schedules/BillWindow.tsx');
    assert.match(win, /<BillLineNotice q=\{q\} lineId=\{lineId\}/);
    assert.match(win, /droppedLineId=\{!savedLineId && pricing\?\.lineId && !lines\.lines\.some\(l => l\.id === pricing\.lineId\) \? pricing\.lineId : null\}/);
    // A person who picks "No budget line" while the permit's line IS offered is not warned.
    assert.match(readCode('components/admin/kit/club/schedules/BillLineNotice.tsx'), /const fellAway = !lineId && !!droppedLineId;/);
  });
});

describe('Owed to the club, and what Revenue includes (13d-5 A, tab 5 notes 2-4)', () => {
  it('one name on both screens; the figure is the band’s own sum (no new query)', () => {
    const page = readCode('app/[orgSlug]/admin/accounting/page.tsx');
    assert.doesNotMatch(page, /'Owed by the teams'/);
    assert.match(page, /label: CLUB_BAND_WORDS\.owed\.label, figure: money\(owed\.total\), caption: owed\.caption/);
    assert.match(page, /const o = owedToTheClub\(\{/);
    assert.match(readCode('components/admin/kit/club/ClubBand.tsx'), /const added = owedToTheClub\(band\.owed\)/, 'the band adds it up the same way');
    const route = readCode('app/api/admin/accounting/summary/route.ts');
    assert.match(route, /import \{ leagueOwing \} from '@\/lib\/club-band-read'/);
    assert.doesNotMatch(route, /seasonMoney\(|loadSeasonMoneyLines\(/, 'the route sums nothing itself');
    assert.match(readCode('lib/club-band-read.ts'), /export async function leagueOwing\(/);
    assert.equal(CLUB_BAND_WORDS.owed.label, 'Owed to the club');
  });
  it('the caption is the band’s halves, with the players', () => {
    const both = owedToTheClub({ teams: { amount: 10950, overdue: 3450 }, league: { amount: 1740, players: 12 } }, { players: true });
    assert.equal(both.caption, 'teams $10,950.00 ($3,450.00 overdue) · house league $1,740.00 (12 players)');
    assert.equal(both.total, 12690);
    assert.equal(owedToTheClub({ teams: { amount: 10950, overdue: 0 }, league: { amount: 0, players: 0 } }).caption, 'teams $10,950.00', 'a half with nothing in it is not said');
    assert.equal(owedToTheClub({ teams: { amount: 0.1, overdue: 0 }, league: { amount: 0.2, players: 1 } }).total, 0.3, 'to the cent');
  });
  it('Revenue names what it includes; nothing typed', () => {
    assert.equal(O.revenueIncludes({ leagueFees: 2355, tournaments: [{ name: 'Harbourtown Invitational 2026', amount: 1440 }] }),
      'includes house league fees $2,355.00 · Harbourtown Invitational 2026 $1,440.00');
    assert.equal(O.revenueIncludes({ leagueFees: 0, tournaments: [] }), null);
  });
  it('the parts are Collected’s own lines by book: a float is no revenue, a refund nets its fees', () => {
    const lines = [
      { ledgerId: 'T', amount: 1440, entryType: 'income' as const, status: 'posted' as const, bookKind: 'tournament' },
      { ledgerId: 'T', amount: 500, entryType: 'transfer_in' as const, status: 'posted' as const, bookKind: 'tournament', partnerKind: 'org' },
      { ledgerId: 'H', amount: 100, entryType: 'income' as const, status: 'posted' as const, bookKind: 'league_season' },
      { ledgerId: 'H', amount: 20, entryType: 'expense' as const, status: 'posted' as const, bookKind: 'league_season', sourceModule: 'league_registration' },
      { ledgerId: 'G', amount: 75, entryType: 'income' as const, status: 'pending' as const, bookKind: 'org' },
    ];
    const by = collectedByBook(lines);
    assert.equal(by.get('T'), 1440);
    assert.equal(by.get('H'), 80);
    assert.equal(by.has('G'), false, 'pending counts nowhere');
    assert.equal([...by.values()].reduce((n, v) => n + v, 0), bandCollected(lines), 'the parts add up to Total revenue’s Actual');
  });
  it('the house league door is a line under the books, opening the season’s Money page — never a nav row or a cell link', () => {
    assert.equal(O.seasonDoor('2026 Fall House League', 1740), 'House league money: 2026 Fall House League · $1,740.00 still owing');
    const page = readCode('app/[orgSlug]/admin/accounting/page.tsx');
    assert.match(page, /href=\{`\/\$\{slug\}\/admin\/house-league\/seasons\/\$\{s\.id\}\/money`\} className=\{kit\.footLink\}/);
    assert.doesNotMatch(page, /admin\/house-league\/seasons`/, 'never House league’s season list');
  });
});

describe('the tournament’s "In the club’s book" (13d-11 A, tab 5 note 1)', () => {
  it('is read only for someone who holds Accounting', () => {
    assert.match(readCode('app/api/admin/tournament-dashboard/route.ts'),
      /const clubBookP = canOpenModule\(ctx, ctx\.org, 'module_accounting'\)\s*\?\s*readEventBook\(/);
  });
  it('the page copies the answer\'s book into what it shows (found in the walk: without this line the row never appeared)', () => {
    const page = readCode('app/[orgSlug]/admin/tournaments/dashboard/page.tsx');
    assert.match(page, /clubBook: data\?\.clubBook \?\? null,/);
  });
  it('the first row stays word for word; the new row is under it', () => {
    assert.equal(DRAFT_BOARD_WORDS.feesNotSet, 'Not set up — payments aren’t tracked here');
    const board = readCode('app/[orgSlug]/admin/tournaments/dashboard/WeeksBeforeBoard.tsx');
    assert.match(board, /row = <ClubRow as="link" href=\{feesHref\} title=\{feeLine\(fees\)\} chevron \/>/);
    assert.match(board, /\{row\}\s*(?:\{\s*\}\s*)?\{clubBook && <ClubRow as="link" href=\{clubBook\.href\}/);
  });
  it('names a float apart from money in', () => {
    assert.equal(WEEKS_BEFORE_WORDS.clubBook(1440), 'In the club’s book: $1,440 in');
    assert.equal(WEEKS_BEFORE_WORDS.clubBookLine(500), '$500 float moved in · opens the event’s book in Ledger');
    const read = readCode('lib/club-budget-read.ts');
    assert.match(read, /floatIn = sumMoney\(lines\.filter\(l => l\.entryType === 'transfer_in' && clubMovement\(l\) === 'own_transfer'\)\)/);
    assert.match(read, /moneyIn: collectedByBook\(lines\)/);
  });
  it('the tournament nav still has no Accounting row (B4 stands)', () => {
    for (const role of ['owner', 'admin'] as const) {
      const groups = kitTournamentGroups({ status: 'active', isSandbox: false, role, planId: 'club' });
      assert.ok(!groups.some(g => g.items.some(i => i.key === 'accounting')), role);
    }
  });
});
