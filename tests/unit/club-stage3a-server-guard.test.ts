import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import { canMoveClubMoney, canOpenRepMoney } from '../../lib/member-access.ts';
import {
  MONEY_STATE_CHANGED, clubInstallmentRefusal, coachInstallmentRefusal, requestRefusal, clubUndoRefusal,
  installmentLineWords, requestLineWords, categoryWord, howItCame, teamsWord, REQUEST_STATUS_WORD,
  CLUB_MONEY_NOTICE, reminderEmailLines, UNREACHABLE_WORD,
} from '../../lib/club-money-words.ts';
import {
  NOTIFICATION_CATEGORY, NOTIFICATION_EVENT_DESCRIPTIONS, NOTIFICATION_EVENT_LABELS, NOTIFICATION_SECTIONS,
  PUSH_DEFAULT_ON_EVENTS,
} from '../../lib/notification-labels.ts';
import { closeOutBlockers, clubRequestsHoldPayout } from '../../lib/season-settlement.ts';
import { DUES_PAYMENT_METHODS } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 3a · SESSION 1 — the server half of club money (CLUB_TIER_STAGE3A_SERVER_PROMPT.md).
 *
 * What this file holds the build to, in the prompt's order:
 *   1. every money move is ONE database step that refuses a state it didn't expect (mig 315), and
 *      the coach's two moves never touch a ledger;
 *   2. ONE rule for who may move club money (`canMoveClubMoney`), on every write, inside the member's
 *      team groups;
 *   4. "holding up the payout" is the coach's own rule, shared;
 *   5. a team's book is read-only everywhere; a transfer voids both halves; a sourced line is
 *      changed at its source; payees merge in one step; the General ledger is made once;
 *   6. reminders never reach the sender, include the overdue, reply to the sender;
 *   7. every new notification ships WITH its event (never a toggle with nothing behind it).
 * (3, one definition per figure, has its own guard: club-money-one-definition-guard.test.ts.)
 * The live, database-level proof — a double submit leaves one pair of lines, a failed step leaves
 * none, and each refusal mutated away is caught — is `npm run check:club-money-atomicity`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * One top-level function's body. ⚠ Bounded at the next top-level function of ANY kind — the shared
 * `functionBody` stops only at `function` / `async function` / `export default function`, so in a
 * module of `export async function`s it ran on into the next one and a word in a NEIGHBOUR satisfied
 * (or failed) an assertion about this one.
 */
function functionBody(code: string, name: string): string {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name} is gone — the guard reads it`);
  const rest = code.slice(start + 1);
  const end = rest.search(/\n(?:export )?(?:async )?function \w|\nexport const \w/);
  return end > 0 ? code.slice(start, start + 1 + end) : code.slice(start);
}

const MIG = 'supabase/migrations/315_a_club_money_move_is_one_step.sql';
const sql = readSource(MIG);
/** One SQL function's body, from its CREATE to the closing `$$;`. */
function sqlFunction(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is gone from mig 315 — the guard reads it`);
  const end = sql.indexOf('$$;', sql.indexOf('AS $$', start) + 5);
  return sql.slice(start, end);
}

const R = {
  acctInstallment: 'app/api/admin/accounting/allocations/[allocationId]/installments/[installId]/route.ts',
  acctRequest: 'app/api/admin/accounting/payment-requests/[id]/route.ts',
  acctTransferVoid: 'app/api/admin/accounting/transfers/[entryId]/void/route.ts',
  acctPayees: 'app/api/admin/accounting/payees/route.ts',
  acctPayee: 'app/api/admin/accounting/payees/[payeeId]/route.ts',
  acctPayeeMerge: 'app/api/admin/accounting/payees/[payeeId]/merge/route.ts',
  acctReminders: 'app/api/admin/accounting/reminders/route.ts',
  acctEntries: 'app/api/admin/accounting/ledgers/[ledgerId]/entries/route.ts',
  acctEntry: 'app/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]/route.ts',
  acctTransfers: 'app/api/admin/accounting/transfers/route.ts',
  acctLedgers: 'app/api/admin/accounting/ledgers/route.ts',
  acctLedger: 'app/api/admin/accounting/ledgers/[ledgerId]/route.ts',
  oldAllocations: 'app/api/admin/rep-teams/allocations/route.ts',
  oldAllocation: 'app/api/admin/rep-teams/allocations/[allocationId]/route.ts',
  coachInstallment: 'app/api/coaches/[orgSlug]/teams/[teamId]/allocations/[splitId]/installments/[installId]/route.ts',
  coachRequests: 'app/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/route.ts',
  coachSurplus: 'app/api/coaches/[orgSlug]/teams/[teamId]/season-surplus/route.ts',
  clubSeasons: 'app/api/admin/rep-teams/teams/[teamId]/seasons/route.ts',
};

// ── 2. One rule ─────────────────────────────────────────────────────────────────────────────────

const org = (planId: string, status = 'active') =>
  ({ planId, subscriptionStatus: status, enabledAddons: [] as string[], freeFloor: null }) as never;

describe('ONE rule for who may move club money (Ask 1, C08)', () => {
  const club = org('club');
  it('whoever holds the club\'s accounting: owner, treasurer, an admin with Accounting', () => {
    assert.equal(canMoveClubMoney({ role: 'owner', capabilities: null }, club), true);
    assert.equal(canMoveClubMoney({ role: 'treasurer', capabilities: null }, club), true);
    assert.equal(canMoveClubMoney({ role: 'admin', capabilities: null }, club), true);
  });
  it('not an admin whose Accounting was taken away, and not staff, a coach or a league role', () => {
    assert.equal(canMoveClubMoney({ role: 'admin', capabilities: { module_accounting: false } }, club), false);
    assert.equal(canMoveClubMoney({ role: 'staff', capabilities: null }, club), false);
    assert.equal(canMoveClubMoney({ role: 'coach', capabilities: null }, club), false);
    assert.equal(canMoveClubMoney({ role: 'league_admin', capabilities: null }, club), false);
  });
  it('a member granted Accounting holds it (the rule is the program, not a role list)', () => {
    assert.equal(canMoveClubMoney({ role: 'staff', capabilities: { module_accounting: true } }, club), true);
  });
  it('answers to the plan too (C17): no Accounting on the plan, or a cancelled club, moves nothing', () => {
    assert.equal(canMoveClubMoney({ role: 'owner', capabilities: null }, org('tournament_plus')), false);
    assert.equal(canMoveClubMoney({ role: 'owner', capabilities: null }, org('club', 'canceled')), false);
  });
  it('reaching the loop stays canOpenRepMoney (a treasurer reaches it through Accounting)', () => {
    assert.equal(canOpenRepMoney({ role: 'treasurer', capabilities: null }, club), true);
  });

  const WRITES: [string, RegExp][] = [
    [R.acctInstallment, /resolveClubMoney\(req, \{ scope: 'loop', write: true \}\)/],
    [R.acctRequest, /resolveClubMoney\(req, \{ scope: 'loop', write: true \}\)/],
    [R.acctTransferVoid, /resolveClubMoney\(req, \{ scope: 'books', write: true \}\)/],
    [R.acctPayees, /resolveClubMoney\(req, \{ scope: 'books', write: true \}\)/],
    [R.acctPayee, /resolveClubMoney\(req, \{ scope: 'books', write: true \}\)/],
    [R.acctPayeeMerge, /resolveClubMoney\(req, \{ scope: 'books', write: true \}\)/],
    [R.acctReminders, /resolveClubMoney\(req, \{ scope: 'loop', write: true \}\)/],
    [R.acctEntries, /canMoveClubMoney\(ctx!, ctx!\.org\)/],
    [R.acctEntry, /canMoveClubMoney\(ctx!, ctx!\.org\)/],
    [R.acctTransfers, /canMoveClubMoney\(ctx!, ctx!\.org\)/],
    [R.acctLedgers, /canMoveClubMoney\(ctx!, ctx!\.org\)/],
    [R.acctLedger, /canMoveClubMoney\(ctx!, ctx!\.org\)/],
    [R.oldAllocations, /canMoveClubMoney\(ctx!, ctx!\.org\)/],
    [R.oldAllocation, /canMoveClubMoney\(ctx!, ctx!\.org\)/],
  ];
  for (const [file, rule] of WRITES) {
    it(`${file.replace('app/api/admin/', '')} asks the one rule, never a role list`, () => {
      const code = readCode(file);
      assert.match(code, rule);
      assert.doesNotMatch(code, /role !== 'owner' && ctx!?\.role !== 'treasurer'/);
      assert.doesNotMatch(code, /role !== 'treasurer' && ctx!?\.role !== 'admin'/);
    });
  }
  it('the gate pairs reach with the write rule, and both answer to the plan', () => {
    const gate = functionBody(readCode('lib/club-money-route.ts'), 'resolveClubMoney');
    assert.match(gate, /canOpenRepMoney\(ctx, ctx\.org\)/);
    assert.match(gate, /canOpenModule\(ctx, ctx\.org, 'module_accounting'\)/);
    assert.match(gate, /opts\.write && !canMoveClubMoney\(ctx, ctx\.org\)/);
  });
});

describe('group scope on every club money write (B11)', () => {
  const moves = readCode('lib/club-money-moves.ts');
  // Every club move finds its record through installmentFor / requestFor, and both end on the group check.
  for (const finder of ['installmentFor', 'requestFor']) {
    it(`${finder} refuses a team outside the member's groups`, () => {
      assert.match(functionBody(moves, finder), /return outsideGroups\(ctx, c\.team\.groupId\) \?\? \{ ok: true, c \};/);
      assert.match(functionBody(moves, 'outsideGroups'), /repGroupScopeGuard\(ctx, groupId\) \? refused\(403/);
    });
  }
  for (const [fn, finder] of [
    ['clubReceiveInstallment', 'installmentFor(ctx, p)'], ['clubUndoInstallment', 'installmentFor(ctx, p)'],
    ['clubApproveRequest', 'requestFor(ctx, p.requestId)'], ['clubDeclineRequest', 'requestFor(ctx, p.requestId)'],
    ['clubReverseRequest', 'requestFor(ctx, p.requestId)'],
  ]) {
    it(`${fn} refuses a team outside the member's groups before it writes`, () => {
      const body = functionBody(moves, fn);
      const guard = body.indexOf(`const found = await ${finder}; if (!found.ok) return found;`);
      assert.ok(guard > 0, `${fn} must check the group limit`);
      const write = Math.max(body.indexOf("rpc('"), body.indexOf('.update('));
      assert.ok(write > guard, `${fn} checks the group limit BEFORE writing`);
    });
  }
  it('a new allocation refuses a team outside the member\'s groups', () => {
    // Stage 3b moved the create into ONE step behind `createClubAllocation`; both create doors go through it.
    assert.match(readCode(R.oldAllocations), /createClubAllocation\(ctx!,/);
    assert.match(functionBody(readCode('lib/club-budget-writes.ts'), 'createClubAllocation'), /repGroupScopeGuard\(ctx, team\.group_id \?\? null\)/);
  });
  it('the reads narrow to the member\'s teams', () => {
    for (const f of ['allocations/route.ts', 'allocations/[allocationId]/route.ts', 'coming-due/route.ts', 'payment-requests/route.ts', 'teams/route.ts']) {
      assert.match(readCode(`app/api/admin/accounting/${f}`), /teamIdsInScope\(ctx\)/, f);
    }
    assert.match(readCode('app/api/admin/accounting/teams/[teamId]/account/route.ts'), /const t = await clubTeamFor\(ctx, teamId\);\s+if \('error' in t\) return t\.error;/);
    assert.match(functionBody(readCode('lib/club-team-route.ts'), 'clubTeamFor'), /repGroupScopeGuard\(ctx, team\.groupId\)/);
  });
  it('a team\'s book outside the member\'s groups is neither listed nor readable (found by /review 2026-10-01)', () => {
    // A group-limited member can hold Accounting (only owner / admin / treasurer are never limited),
    // and the ledger reads used to answer to Accounting alone.
    assert.match(functionBody(readCode('lib/club-team-route.ts'), 'bookInScope'),
      /return !scope \|\| ledger\.entityType !== 'team' \|\| \(ledger\.entityId !== null && scope\.has\(ledger\.entityId\)\);/);
    assert.match(readCode('app/api/admin/accounting/ledgers/route.ts'), /all\.filter\(l => bookInScope\(l, scope\)\)/);
    for (const f of ['ledgers/[ledgerId]/route.ts', 'ledgers/[ledgerId]/entries/route.ts']) {
      const GET = readCode(`app/api/admin/accounting/${f}`).split('export const GET')[1].split('export const')[0];
      assert.match(GET, /if \(!ledger \|\| !bookInScope\(ledger, scope\)\) return/, f);
    }
    assert.match(functionBody(readCode('lib/club-ledger-read.ts'), 'readBook'), /if \(!ledger \|\| !bookInScope\(ledger, opts\.scope \?\? null\)\) return null;/);
    const book = readCode('app/api/admin/accounting/ledgers/[ledgerId]/book/route.ts');
    assert.match(book, /const scope = await teamIdsInScope\(ctx\);/);
    assert.match(book, /readBookForExport\(ctx\.org\.id, ctx\.org\.name, ledgerId, \{ from, to, scope \}\)/);
    assert.match(book, /from, to, status, types, categories, items, scope,/);
  });
});

// ── 1. One step per move, and the state machine ───────────────────────────────────────────────

describe('every club money move is ONE database step that refuses a state it didn\'t expect (C07)', () => {
  it('the three method columns take exactly the methods the app offers (one list, two languages)', () => {
    // The app checks a method against DUES_PAYMENT_METHODS (isClubMoneyMethod); the database checks
    // the same columns with a literal list. A method added to one and not the other is either refused
    // by the database after the app accepted it, or offered on screen and never storable.
    const checks = [...sql.matchAll(/CHECK \((\w+_method) IS NULL OR \w+_method IN \(([^)]*)\)\)/g)];
    assert.deepEqual(checks.map(m => m[1]).sort(), ['paid_method', 'paid_method', 'sent_method']);
    for (const m of checks) {
      const listed = [...m[2].matchAll(/'(\w+)'/g)].map(x => x[1]);
      assert.deepEqual([...listed].sort(), [...DUES_PAYMENT_METHODS].sort(), m[1]);
    }
    assert.match(readCode('lib/club-money-words.ts'), /\(DUES_PAYMENT_METHODS as readonly string\[\]\)\.includes\(v\)/);
  });
  it('record / confirm received: locks the row, refuses received, refuses a state the caller did not see', () => {
    const fn = sqlFunction('club_installment_receive');
    assert.match(fn, /WHERE id = p_installment AND org_id = p_org\s+FOR UPDATE/);
    assert.match(fn, /IF v_inst\.paid_at IS NOT NULL THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'state_changed', 'state', 'received'\)/);
    assert.match(fn, /IF p_expect = 'unpaid' AND v_inst\.sent_at IS NOT NULL THEN/);
    assert.match(fn, /IF p_expect = 'sent' AND v_inst\.sent_at IS NULL THEN/);
    // Both lines AND the stamp in the same function, the payer's half kept as the link.
    assert.match(fn, /INSERT INTO accounting_entries[\s\S]*'transfer_out'[\s\S]*'transfer_in'[\s\S]*UPDATE rep_allocation_installments[\s\S]*accounting_entry_id = v_out/);
  });
  it('undo: only a received installment; never a pre-275 one it cannot see; voids both lines first', () => {
    const fn = sqlFunction('club_installment_undo');
    assert.match(fn, /IF v_inst\.paid_at IS NULL THEN/);
    assert.match(fn, /IF v_inst\.accounting_entry_id IS NULL THEN\s+RETURN jsonb_build_object\('ok', false, 'code', 'unlinked'\)/);
    assert.ok(fn.indexOf('club_void_entry_pair(') < fn.indexOf('UPDATE rep_allocation_installments'), 'void before the stamp clears');
    assert.match(fn, /undone_at = now\(\), undone_by = p_actor, undone_reason = p_reason/);
  });
  it('approve: only a pending request (a double approval is impossible); keeps its entry link', () => {
    const fn = sqlFunction('club_request_approve');
    assert.match(fn, /FOR UPDATE/);
    assert.match(fn, /IF v_req\.status <> 'pending' THEN/);
    assert.match(fn, /SET status = 'approved'[\s\S]*accounting_entry_id = v_out/);
  });
  it('reverse: only an approved request with a link; voids both lines; closes as reversed', () => {
    const fn = sqlFunction('club_request_reverse');
    assert.match(fn, /IF v_req\.status <> 'approved' THEN/);
    assert.match(fn, /IF v_req\.accounting_entry_id IS NULL THEN/);
    assert.match(fn, /club_void_entry_pair\(v_req\.accounting_entry_id, p_reason, p_actor\)/);
    assert.match(fn, /SET status = 'reversed', reversed_at = now\(\), reversed_by = p_actor, reversed_reason = p_reason/);
  });
  it('the two-sided void takes BOTH halves, locked in id order, with the reason on each', () => {
    const fn = sqlFunction('club_void_entry_pair');
    assert.match(fn, /v_ids := array_remove\(ARRAY\[p_entry, v_partner\], NULL\)/);
    assert.match(fn, /ORDER BY id FOR UPDATE/);
    assert.match(fn, /SET status = 'void', void_reason = p_reason, voided_by = p_actor/);
  });
  it('dates are the club\'s day: the app passes the day; the database never reads a UTC clock for it', () => {
    for (const name of ['club_installment_receive', 'club_request_approve']) {
      const fn = sqlFunction(name);
      assert.match(fn, /p_on/);
      assert.doesNotMatch(fn, /current_date|now\(\)::date/);
    }
    assert.match(functionBody(readCode('lib/club-money-moves.ts'), 'readMoveDay'), /const today = moneyMovedMaxDate\(\);/);
    assert.match(functionBody(readCode('lib/money-date-guards.ts'), 'moneyMovedMaxDate'), /return tournamentToday\(\);/, 'the club\'s day, not UTC');
  });
  it('a decline writes no ledger line and refuses unless still waiting', () => {
    const body = functionBody(readCode('lib/club-money-moves.ts'), 'clubDeclineRequest');
    assert.match(body, /\.eq\('status', 'pending'\)/);
    assert.doesNotMatch(body, /accounting_entries|rpc\(/);
  });
  it('the routes never write a ledger line themselves any more (no create_accounting_transfer outside its own door)', () => {
    for (const f of [R.acctInstallment, R.acctRequest, R.coachInstallment, 'lib/club-money-moves.ts']) {
      assert.doesNotMatch(readCode(f), /create_accounting_transfer/, f);
    }
  });
});

describe('the coach never writes to the club\'s books (Ask 1, C08, S3A-01)', () => {
  const moves = readCode('lib/club-money-moves.ts');
  const route = readCode(R.coachInstallment);
  it('"sent" is one conditional update: only an unpaid, unsent installment, and no ledger line', () => {
    const body = functionBody(moves, 'coachSendInstallment');
    assert.match(body, /\.is\('paid_at', null\)\s+\.is\('sent_at', null\)/);
    assert.doesNotMatch(body, /accounting_entries|rpc\(/);
  });
  it('take it back: only the team\'s own UNCONFIRMED sent; a payment the club recorded is refused in words', () => {
    const body = functionBody(moves, 'coachTakeBackInstallment');
    assert.match(body, /\.is\('paid_at', null\)\s+\.not\('sent_at', 'is', null\)/);
    assert.doesNotMatch(body, /accounting_entries|rpc\(|void/);
    const refused = coachInstallmentRefusal('received', 'Northfield Minor Ball');
    assert.equal(refused.fixedBy, 'club');
    assert.match(refused.error, /Northfield Minor Ball has recorded this payment/);
  });
  it('the coach route sends PATCH to "sent" and DELETE to "take it back", on the LIVE season with money write', () => {
    assert.match(route, /resolveLiveCoachTeamContext\(orgSlug, teamId\)/);
    assert.match(route, /canWriteMoney\(assignment\.capabilities\)/);
    assert.match(functionBody(route.replace(/export const PATCH = withObservability\(async /, 'function PATCH_HANDLER'), 'PATCH_HANDLER'), /coachSendInstallment\(/);
    assert.match(route, /coachTakeBackInstallment\(/);
    assert.doesNotMatch(route, /unmarkRepAllocationInstallmentPaid|markRepAllocationInstallmentPaid/);
  });
});

describe('a stale tap is refused in words: one coded 409 (the shape of season_not_live)', () => {
  it('says what it is now and who can fix it', () => {
    for (const r of [
      clubInstallmentRefusal('sent', '11U AA'), clubInstallmentRefusal('received', '11U AA'), clubInstallmentRefusal('unpaid', '11U AA'),
      coachInstallmentRefusal('sent', 'Club'), coachInstallmentRefusal('unpaid', 'Club'), clubUndoRefusal('unpaid'),
      requestRefusal('approved', 'club'), requestRefusal('withdrawn', 'club'),
    ]) {
      assert.equal(r.code, MONEY_STATE_CHANGED);
      assert.ok(r.error.length > 10);
      assert.ok(typeof r.state === 'string');
      assert.ok(r.fixedBy === null || r.fixedBy === 'club' || r.fixedBy === 'coach');
    }
    assert.match(clubInstallmentRefusal('sent', '11U AA').error, /11U AA’s coach has just said they sent/);
    assert.equal(requestRefusal('denied', 'club').error, 'This request has already been declined.', 'the stored word is never shown');
  });
  it('every move maps the database\'s state_changed to that 409', () => {
    const moves = readCode('lib/club-money-moves.ts');
    // Each maps its database refusal to the words module's ONE coded refusal (MONEY_STATE_CHANGED).
    const expect: Record<string, RegExp> = {
      clubReceiveInstallment: /r\.code === 'state_changed'\s+\? refused\(409, clubInstallmentRefusal\(/,
      clubUndoInstallment: /r\.code === 'state_changed'\) return refused\(409, clubUndoRefusal\(/,
      clubApproveRequest: /refused\(409, requestRefusal\(r\.code === 'state_changed'/,
      clubDeclineRequest: /refused\(409, requestRefusal\(/,
      clubReverseRequest: /r\.code === 'state_changed'\) return refused\(409, requestRefusal\(/,
      coachSendInstallment: /if \(!data\) return coachRefusal\(/,
      coachTakeBackInstallment: /if \(!data\) return coachRefusal\(/,
      coachRefusal: /return refused\(409, coachInstallmentRefusal\(/,
    };
    for (const [fn, re] of Object.entries(expect)) assert.match(functionBody(moves, fn), re, fn);
  });
});

// ── 4. Holding up the payout ────────────────────────────────────────────────────────────────────

describe('"holding up the payout" is the coach\'s own rule, shared (Ask 5b, S3A-03)', () => {
  const blockers = (pot: number, cash: number, pending: number) =>
    closeOutBlockers({ pot: { expectedIn: pot } as never, awaitingCash: cash, pendingClubRequests: pending });
  it('true only when waiting club requests are the ONE thing left', () => {
    assert.equal(clubRequestsHoldPayout(blockers(0, 0, 1)), true);
    assert.equal(clubRequestsHoldPayout(blockers(120, 0, 1)), false, 'dues still out: the club is not what holds it');
    assert.equal(clubRequestsHoldPayout(blockers(0, 50, 1)), false);
    assert.equal(clubRequestsHoldPayout(blockers(0, 0, 0)), false);
  });
  it('the request list, the brief and the payout sheet all read it; the club is told once per request', () => {
    assert.match(readCode('lib/club-money-reads.ts'), /clubRequestsHoldPayout\(closeOutBlockers\(sheet\)\)/);
    assert.match(readCode('app/api/admin/club-brief/route.ts'), /holdingPayout: rows\.filter\(r => held\.has\(r\.program_year_id\)\)/,
      'the brief counts held payouts through the same seasonsHoldingPayout read');
    assert.match(readCode(R.coachSurplus), /holdsPayout: clubRequestsHoldPayout\(closeOutBlockers\(sheet\)\)/);
    const tell = functionBody(readCode('lib/club-money-moves.ts'), 'tellClubIfRequestsHoldPayout');
    assert.match(tell, /\.is\('payout_hold_told_at', null\)/);
  });
  it('the club\'s season window counts what the team owes the club, and never refuses on it', () => {
    const code = readCode(R.clubSeasons);
    assert.match(code, /seasonOwedToClub\(team\.orgId, team\.id, live\.id\)\.catch\(/, 'read for the live season, and a failed read is quiet');
    const GET = code.slice(code.indexOf('export const GET'), code.indexOf('export const POST'));
    assert.doesNotMatch(GET, /status: 409/);
    const writes = code.slice(code.indexOf('export const POST'));
    assert.doesNotMatch(writes, /seasonOwedToClub|owedToClub/, 'the roll and the close never read it — it only warns');
  });
});

// ── 5. The club's books ────────────────────────────────────────────────────────────────────────

describe('a team\'s book is read-only everywhere; a transfer voids both halves (C12, C13)', () => {
  it('a transfer refuses a team\'s book on either side', () => {
    assert.match(readCode(R.acctTransfers), /fromLedger\.entityType === 'team' \|\| toLedger\.entityType === 'team'/);
    const fn = sqlFunction('club_transfer_void');
    assert.match(fn, /org_id <> p_org OR entity_type = 'team'/);
    assert.match(fn, /'code', 'team_book'/);
  });
  it('an ordinary entry is In or Out, never re-typed as half of a transfer', () => {
    assert.match(readCode(R.acctEntry), /const VALID_ENTRY_TYPES = new Set<string>\(\['income', 'expense'\]\);/);
  });
  it('a line written by an allocation, a request or a fee is changed only at its source', () => {
    const code = readCode(R.acctEntry);
    assert.equal((code.match(/await writtenBySource\(existing\)/g) ?? []).length, 2, 'edit AND void ask');
    assert.match(sqlFunction('club_transfer_void'), /'code', 'from_a_source'/);
  });
  it('one half of a transfer is never voided alone', () => {
    assert.match(readCode(R.acctEntry), /code: 'use_transfer_void'/);
  });
  it('the General ledger is made once (the partial unique index, respected under a race)', () => {
    assert.match(sqlFunction('club_general_ledger'), /ON CONFLICT \(org_id\) WHERE entity_type = 'org' AND entity_id IS NULL DO NOTHING/);
    assert.match(functionBody(readCode('lib/db.ts'), 'getOrCreateOrgLedger'), /rpc\('club_general_ledger'/);
  });
  it('payees merge in one step and are never deleted while a line names them (C01)', () => {
    const fn = sqlFunction('club_payee_merge');
    assert.match(fn, /UPDATE accounting_entries SET payee_id = p_into[\s\S]*UPDATE rep_team_expenses SET payee_id = p_into[\s\S]*DELETE FROM org_payees WHERE id = p_from/);
    assert.match(fn, /team_id IS NULL/, 'the club\'s payees only');
    assert.match(functionBody(readCode('lib/club-payees.ts'), 'deleteClubPayee'), /if \(uses > 0\) return inUse\(/);
  });
  it('the pasted ledger-entry id has LEFT New allocation (C17 — Stage 3c, Ask 6)', () => {
    /* ⚖ C17's end state (owner 2026-10-07, Ask 6): 3a checked a pasted entry id against the club's own live books;
       no screen ever read it, so 3c takes it out of the form and the create refuses one in words. Old rows keep
       theirs; the step no longer takes one (mig 318: club_allocation_create has no p_source_entry). */
    const code = functionBody(readCode('lib/club-budget-writes.ts'), 'createClubAllocation');
    assert.match(code, /code: 'source_entry_retired'/);
    assert.doesNotMatch(code, /p_source_entry/);
  });
  it('the club\'s category list is its own, never the teams\'', () => {
    assert.match(readCode('app/api/admin/accounting/categories/route.ts'), /await clubCategories\(ctx\.org\.id\)/);
    // Stage 3b: the club-owned books' one read (getClubOwnedLedgers — Club, Tournament, House league; never a team's).
    assert.match(functionBody(readCode('lib/club-ledger-read.ts'), 'clubCategories'), /getClubOwnedLedgers\(orgId\)/);
    assert.match(functionBody(readCode('lib/db.ts'), 'getClubOwnedLedgers'), /\.in\('entity_type', \[\.\.\.CLUB_OWNED_BOOK_KINDS\]\)/);
  });
  it('every server-only function is closed to the browser key (mig 311\'s rule)', () => {
    const fns = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(club_\w+)\(/g)].map(m => m[1]);
    assert.ok(fns.length >= 9);
    const revoke = sql.slice(sql.indexOf('REVOKE ALL ON FUNCTION'), sql.indexOf('FROM public, anon, authenticated;'));
    for (const fn of fns) assert.match(revoke, new RegExp(`public\\.${fn}\\(`), fn);
  });
});

describe('a line names the team (J4-016); old lines read right too', () => {
  it('new lines carry the drawn words on both halves', () => {
    const w = installmentLineWords({ teamName: '11U AA', orgName: 'Northfield', allocation: 'Diamond fees', number: 2, of: 3 });
    assert.equal(w.club, 'Allocation received · 11U AA · Diamond fees, 2 of 3');
    assert.equal(w.team, 'Allocation paid to Northfield · Diamond fees, 2 of 3');
    assert.equal(requestLineWords({ teamName: '11U AA', orgName: 'N', description: 'Umpire clinic', requestType: 'charge_to_org' }).club, 'Paid to 11U AA · Umpire clinic');
    assert.equal(requestLineWords({ teamName: '14U Girls', orgName: 'N', description: 'Float', requestType: 'payment_to_org' }).club, 'From 14U Girls · Float');
  });
  it('a stored key reads as the club\'s word; stored history is never rewritten', () => {
    assert.equal(categoryWord('rep_allocation'), 'Team allocations');
    assert.equal(categoryWord('team_charge_to_org'), 'Team support');
    assert.equal(categoryWord('Insurance'), 'Insurance');
    assert.doesNotMatch(sql, /UPDATE accounting_entries SET (description|category)/, 'no backfill of words');
  });
  it('one spelling: the product\'s method list, and Declined for the stored "denied"', () => {
    assert.equal(howItCame('etransfer', '4471'), 'E-Transfer 4471');
    assert.equal(REQUEST_STATUS_WORD.denied, 'Declined');
    assert.equal(REQUEST_STATUS_WORD.reversed, 'Reversed');
  });
  it('teams read the way a treasurer talks', () => {
    const t = (id: string, groupId: string | null = 'g') => ({ id, name: id, groupId, groupName: 'Boys' });
    const all = ['a', 'b', 'c', 'd', 'e'].map(id => t(id));
    assert.equal(teamsWord(all, all), 'All 5 teams');
    assert.equal(teamsWord([t('a'), t('b')], all), 'a and b');
    assert.equal(teamsWord([t('a'), t('b'), t('c')], all), 'a, b and c');
    const boys = ['a', 'b', 'c', 'd'].map(id => t(id));
    assert.equal(teamsWord(boys, [...boys, t('x', 'girls')]), 'Boys · 4 teams');
  });
});

// ── 6. Reminders ───────────────────────────────────────────────────────────────────────────────

describe('reminders reach the team, never the sender, and include the overdue (Ask 4, C16)', () => {
  const code = readCode('lib/club-money-reminders.ts');
  it('the preview drops the sender and names every team that cannot be reached, and why', () => {
    assert.match(functionBody(code, 'reminderPreview'), /p\.userId !== ctx\.user\.id/);
    assert.match(functionBody(code, 'reminderPreview'), /remindsAbout\(i, today\)/);
    assert.deepEqual(Object.keys(UNREACHABLE_WORD).sort(), ['invitation_unanswered', 'no_head_coach', 'only_you']);
  });
  it('the send re-reads the preview, sends only to the teams confirmed, replies to the sender, and records the wave', () => {
    const send = functionBody(code, 'sendReminders');
    assert.match(send, /const preview = await reminderPreview\(ctx/);
    assert.match(send, /confirmed\.has\(t\.teamId\)/);
    assert.match(send, /replyTo: ctx\.user\.email/);
    assert.match(send, /code: 'just_sent'/);
  });
  it('a wave is CLAIMED in one database step before any email goes, so a double submit sends one wave (/review 2026-10-01)', () => {
    const send = functionBody(code, 'sendReminders');
    const claim = send.indexOf("rpc('club_reminder_wave_claim'");
    assert.ok(claim > 0, 'the send claims the wave');
    assert.ok(send.indexOf('sendEmail(') > claim, 'no email before the claim');
    assert.doesNotMatch(send, /Date\.now\(\) - new Date\(preview\.lastSent/, 'the app-side check was the race');
    assert.match(send, /from\('rep_allocation_reminder_waves'\)\.delete\(\)\.eq\('id', waveId\)/, 'a wave that sent nothing is released');
    assert.match(send, /from\('rep_allocation_reminder_waves'\)\s*\.update\(\{ team_ids: reached\.map/, 'the wave records what went');
    const fn = sqlFunction('club_reminder_wave_claim');
    assert.match(fn, /PERFORM pg_advisory_xact_lock\(hashtextextended\('club_reminder_wave:' \|\| p_org::text, 0\)\);/);
    assert.ok(fn.indexOf('pg_advisory_xact_lock') < fn.indexOf('SELECT max(sent_at)'), 'the lock comes before the read');
  });
  it('the email carries the team, each installment with its amount, due date and lateness, and how to pay', () => {
    const w = reminderEmailLines({ orgName: 'Northfield', teamName: '16U Girls', senderName: 'Priya Nair', lines: [
      { allocation: 'Diamond fees 2026', number: 2, of: 3, amount: 450, dueDate: '2026-09-15', daysLate: 15 },
    ] });
    assert.match(w.items[0], /Diamond fees 2026, 2 of 3 · \$450\.00 · due Sep 15, 2026 · 15 days late/);
    assert.match(w.outro, /reply to this email and it will reach Priya Nair/);
  });
});

// ── 7. Notifications ───────────────────────────────────────────────────────────────────────────

const MONEY_EVENTS = [
  'club_money_received', 'club_money_undone', 'club_request_approved', 'club_request_declined', 'club_request_reversed',
  'team_money_sent', 'team_request_filed', 'team_request_holding_payout',
] as const;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('every money notification ships WITH its event (S3A-02, Ask 5c)', () => {
  const repo = path.join(import.meta.dirname, '..', '..');
  const sources = [...walk(path.join(repo, 'lib')), ...walk(path.join(repo, 'app', 'api'))]
    .filter(f => !/notification-(labels|view)\.ts$/.test(f))
    .map(f => readCode(path.relative(repo, f)))
    .join('\n');
  for (const evt of MONEY_EVENTS) {
    it(`${evt}: labelled, described, categorised, push-on — and fired somewhere`, () => {
      assert.ok(NOTIFICATION_EVENT_LABELS[evt]);
      assert.ok(NOTIFICATION_EVENT_DESCRIPTIONS[evt]);
      assert.ok(NOTIFICATION_CATEGORY[evt]);
      assert.ok(PUSH_DEFAULT_ON_EVENTS.has(evt));
      assert.match(sources, new RegExp(`event: '${evt}'`), `${evt} has a toggle but nothing sends it`);
    });
  }
  it('the club\'s three sit in the Accounting row; the coach\'s five in "Your club"', () => {
    const acct = NOTIFICATION_SECTIONS.find(s => s.label === 'Accounting')!;
    assert.equal(acct.module, 'module_accounting');
    assert.deepEqual(acct.eventTypes, ['team_money_sent', 'team_request_filed', 'team_request_holding_payout']);
    assert.match(readCode('app/(consumer)/account/notifications/AccountNotificationsClient.tsx'),
      /const CLUB_MONEY_EVENTS: NotificationEventType\[\] = \[\s*'club_money_received', 'club_money_undone', 'club_request_approved', 'club_request_declined', 'club_request_reversed',\s*\];/);
  });
  it('each notice carries the club\'s reason where there is one', () => {
    assert.match(CLUB_MONEY_NOTICE.undone({ orgName: 'N', teamName: 'T', amount: 1, what: 'W', reason: 'Bounced' }).body, /Bounced/);
    assert.match(CLUB_MONEY_NOTICE.declined({ orgName: 'N', amount: 1, what: 'W', reason: 'Not budgeted' }).body, /Not budgeted/);
    assert.match(CLUB_MONEY_NOTICE.reversed({ orgName: 'N', amount: 1, what: 'W', reason: 'Wrong team' }).body, /Wrong team/);
  });
  it('a typed reason reaches an email as text, never markup', () => {
    const fn = functionBody(readCode('lib/notify.ts'), 'notificationEmailHtml');
    assert.match(fn, /const title = escapeHtml\(rawTitle\)/);
    assert.match(fn, /const body = rawBody \? escapeHtml\(rawBody\) : rawBody/);
  });
  it('they go to the team\'s money people and the club\'s accounting people, never the actor', () => {
    const n = readCode('lib/club-money-notify.ts');
    // A head coach's capabilities always include money (HEAD_COACH_ALL), so "can view money" is the
    // ruled set: head coaches plus staff granted the team's money (question 2).
    assert.match(functionBody(readCode('lib/coach-membership.ts'), 'isTeamMoneyMember'), /canViewMoney\(resolveMembershipCapabilities\(m\)\)/);
    assert.match(functionBody(n, 'teamsMoneyPeople'), /\.filter\(isTeamMoneyMember\)/);
    assert.match(functionBody(n, 'tellTeamMoneyPeople'), /\.filter\(isTeamMoneyMember\)/);
    assert.match(functionBody(n, 'clubAccountingUserIds'), /canOpenModule\(m, org, 'module_accounting'\)/);
    assert.match(functionBody(n, 'tellTeamMoneyPeople'), /excludeUserIds: \[p\.actorUserId\]/);
    // ⚠ organization_members is keyed by organization_id (it predates the org_id convention). The first
    // draft filtered on org_id, the read failed, and the best-effort sender swallowed it: no club notice
    // ever went (found by the live probe, 2026-09-30).
    assert.match(functionBody(n, 'clubAccountingUserIds'), /\.from\('organization_members'\)[\s\S]*?\.eq\('organization_id', org\.id\)/);
  });
});

describe('the coach\'s figures follow "sent" through ONE rule (ruled 2026-09-30, question 1)', () => {
  it('the register, Cash on hand, the settlement pot, the cash band and the report all ask clubInstallmentLeftTeamOn', () => {
    for (const f of [
      'lib/coach-register-book.ts', 'app/api/coaches/[orgSlug]/teams/[teamId]/money-summary/route.ts',
      'lib/coach-season-settlement.ts', 'lib/coach-cash-strip.ts', 'app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts',
    ]) {
      assert.match(readCode(f), /clubInstallmentLeftTeamOn\(/, f);
    }
  });
  it('the bill\'s Left still means "the club has it": Outstanding subtracts only what the club received', () => {
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/money-summary/route.ts'), /outstanding: r2\(totalAllocated - allocationsReceived\)/);
  });
});
