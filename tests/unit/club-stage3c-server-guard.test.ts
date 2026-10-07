import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 3c · SESSION 1 — the server half of the club's fiscal year (CLUB_TIER_STAGE3C_SERVER_PROMPT.md;
 * owner rulings 2026-10-07).
 *
 * What this file holds the build to:
 *   1. the lock is ONE database rule (call 2): mig 318's twelve triggers, server-only grants, no policy;
 *   2. every club money write checks the lock FIRST, in words, and maps the database's refusal to the same 409;
 *   3. New allocation bills open seasons only, and the pasted ledger-entry id is refused (Ask 6, S3C-09, C17);
 *   4. every coach cash read reads club payments through ONE reader, by the season running when they were
 *      recorded (S3C-11, call 1) — and the coach's Club tab gains no year;
 *   5. closing, reopening and changing the first month tell nobody anything.
 * The pure rules have their own tests (club-fiscal-year, club-bill-split, club-year-compare,
 * coach-club-payment-season); the database half is proved by `check:club-money-atomicity`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const MIG = 'supabase/migrations/318_the_club_keeps_a_fiscal_year.sql';
const sql = readSource(MIG);
/** The migration with its `--` comments removed (a guard that reads prose proves the prose). */
const sqlCode = sql.split('\n').map(l => l.replace(/--.*$/, '')).join('\n');

describe('1. the lock is one database rule (call 2)', () => {
  const TRIGGERS = [
    'org_fiscal_years_chain', 'organizations_fiscal_first_month_chain', 'org_fiscal_years_closed_guard', 'accounting_ledgers_fiscal_lock',
    'rep_allocation_installments_carrier', 'rep_program_years_carry_waiting',
    'accounting_entries_fiscal_lock', 'org_budget_lines_fiscal_lock', 'org_budget_periods_fiscal_lock',
    'rep_cost_allocations_fiscal_lock', 'rep_allocation_splits_fiscal_lock', 'rep_allocation_installments_fiscal_lock',
  ];
  for (const t of TRIGGERS) {
    it(`trigger ${t}`, () => assert.match(sqlCode, new RegExp(`CREATE (CONSTRAINT )?TRIGGER ${t}\\b`)));
  }
  it('every function the migration makes is revoked from public, anon and authenticated', () => {
    const made = [...sqlCode.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map(m => m[1]);
    assert.ok(made.length >= 30, `found ${made.length} functions — the guard reads mig 318`);
    const revoke = sqlCode.slice(sqlCode.indexOf('REVOKE ALL ON FUNCTION'), sqlCode.indexOf('FROM public, anon, authenticated;'));
    for (const f of made) assert.match(revoke, new RegExp(`public\\.${f}\\(`), `${f} is not revoked`);
  });
  it('execute goes to the server only; the two new tables carry no policy', () => {
    assert.doesNotMatch(sqlCode, /TO (anon|authenticated)\b/);
    assert.doesNotMatch(sqlCode, /CREATE POLICY/);
    assert.match(sqlCode, /ALTER TABLE public\.org_fiscal_years ENABLE ROW LEVEL SECURITY/);
    assert.match(sqlCode, /ALTER TABLE public\.org_fiscal_year_reopenings ENABLE ROW LEVEL SECURITY/);
  });
  it('every SECURITY DEFINER function pins its search path', () => {
    const definers = sqlCode.split('CREATE OR REPLACE FUNCTION').slice(1).filter(f => /SECURITY DEFINER/.test(f.slice(0, f.indexOf('AS $$'))));
    assert.ok(definers.length > 0);
    for (const f of definers) assert.match(f.slice(0, f.indexOf('AS $$')), /SET search_path/, f.slice(0, 60));
  });
  it('season_year is NOT dropped this stage (the drop-column migration goes on prod LAST)', () => {
    assert.doesNotMatch(sqlCode, /DROP COLUMN[^;]*season_year/i);
  });
});

describe('2. every club money write checks the lock first, and maps the database refusal to the same 409', () => {
  const PRE_CHECKS: Record<string, RegExp[]> = {
    'app/api/admin/accounting/ledgers/[ledgerId]/entries/route.ts': [/refuseIfClosedFor\(/, /isClosedYearError\(/],
    'app/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]/route.ts': [/refuseIfClosed\(setting, \[existing\.entry_date\]/, /refuseIfClosedFor\(ctx!\.org\.id, \[existing\.entry_date\], 'recorded'\)/, /isClosedYearError\(/],
    'app/api/admin/accounting/transfers/route.ts': [/refuseIfClosedFor\(/, /isClosedYearError\(/],
    'app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts': [/refuseIfClosed\(setting, \[line\.entry_date\]/],
    'app/api/admin/accounting/budget-plan/lines/[lineId]/route.ts': [/lineYearRefusal\(/],
    'app/api/admin/accounting/budget-plan/lines/[lineId]/periods/route.ts': [/lineYearRefusal\(/],
  };
  for (const [file, patterns] of Object.entries(PRE_CHECKS)) {
    it(file, () => {
      const code = readCode(file);
      for (const p of patterns) assert.match(code, p, `${file}: ${p}`);
    });
  }
  it('the line PATCH and DELETE both check the line\'s year', () => {
    const code = readCode('app/api/admin/accounting/budget-plan/lines/[lineId]/route.ts');
    assert.equal(code.match(/lineYearRefusal\(/g)?.length, 2);
  });
  it('adding a line, rolling a year and New allocation check the year they would land in', () => {
    const w = readCode('lib/club-budget-writes.ts');
    const fn = (name: string) => { const a = w.indexOf(`export async function ${name}(`); assert.ok(a >= 0, name); return w.slice(a, w.indexOf('\nexport ', a + 10)); };
    assert.match(fn('addClubLine'), /refuseIfYearLocked\(setting, year, canMove\)/);
    assert.match(fn('rollClubYear'), /refuseIfYearLocked\(setting, to, canMove\)/);
    assert.match(fn('createClubAllocation'), /refuseIfYearLocked\(setting, fiscalYearOf\(lineKey, setting\), true\)/);
    assert.match(fn('createClubAllocation'), /refuseIfClosed\(setting, \[firstDue\]/);
  });
  it('the money loop\'s steps answer a closed year in words', () => {
    const moves = readCode('lib/club-money-moves.ts');
    for (const step of ['clubReceiveInstallment', 'clubUndoInstallment', 'clubApproveRequest', 'clubReverseRequest', 'clubVoidTransfer']) {
      const a = moves.indexOf(`export async function ${step}(`);
      assert.ok(a >= 0, step);
      assert.match(moves.slice(a, moves.indexOf('\nexport ', a + 10)), /closedYearFromError\(/, step);
    }
  });
});

describe('3. New allocation (Ask 6)', () => {
  const create = (() => { const w = readCode('lib/club-budget-writes.ts'); const a = w.indexOf('export async function createClubAllocation('); return w.slice(a, w.indexOf('\nexport ', a + 10)); })();
  it('the pasted ledger-entry id is refused when sent (C17)', () => {
    assert.match(create, /code: 'source_entry_retired'/);
    assert.doesNotMatch(create, /p_source_entry/);
  });
  it('only a running season is billed (S3C-09), and the team-options read offers nothing else', () => {
    assert.match(create, /if \(running\(team\.id\) !== season\.id\)/, 'the team’s RUNNING season — the one its payments are carried by');
    assert.match(create, /code: 'season_closed'/);
    const options = readCode('app/api/admin/accounting/team-options/route.ts');
    assert.match(options, /const open = liveSeasonOf\(/);
    assert.match(options, /programYears: open \? \[/);
  });
  it('the split and the schedule are worked out once, by the pure module', () => {
    assert.match(create, /billSplits\(body\)/);
  });
});

describe('4. one reader for every coach cash read (S3C-11, call 1)', () => {
  const READERS = [
    'lib/coach-register-book.ts',
    'lib/coach-season-settlement.ts',
    'app/api/coaches/[orgSlug]/teams/[teamId]/money-summary/route.ts',
    'app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts',
  ];
  for (const f of READERS) {
    it(f, () => {
      const code = readCode(f);
      assert.match(code, /getSeasonClubBills\(/, `${f} must read club payments through getSeasonClubBills`);
      assert.doesNotMatch(code, /getRepAllocationSplitsForTeam\(/, `${f}: the bill-season reader is not a cash read`);
    });
  }
  it('the reader asks the one rule, and carries the payments this season recorded', () => {
    const bills = readCode('lib/coach-club-bills.ts');
    assert.match(bills, /seasonReadsClubInstallment as seasonReads/);
    assert.match(bills, /\.eq\('carried_by_program_year_id', programYearId\)/);
  });
  it('the coach\'s Club tab reads earlier seasons\' owed bills with no year (Ask 8b)', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/allocations/route.ts');
    assert.match(route, /getEarlierSeasonOwedBills\(teamId, programYear\.id\)/);
    assert.doesNotMatch(route, /searchParams|\?year=|readYearParam/);
  });
});

describe('5. closing, reopening and the first month tell nobody anything', () => {
  for (const f of [
    'app/api/admin/accounting/fiscal-years/[key]/close/route.ts',
    'app/api/admin/accounting/fiscal-years/[key]/reopen/route.ts',
    'app/api/admin/accounting/fiscal-years/first-month/route.ts',
    'app/api/admin/accounting/fiscal-years/[key]/route.ts',
    'app/api/admin/accounting/fiscal-years/route.ts',
    'lib/club-fiscal-year-moves.ts',
    'lib/club-fiscal-reads.ts',
  ]) {
    it(f, () => assert.doesNotMatch(readCode(f), /club-money-notify|notifications|sendNotification|notifyUsers|sendEmail|resend/i, f));
  }
  it('every fiscal-year write answers the one money rule', () => {
    for (const f of ['app/api/admin/accounting/fiscal-years/[key]/close/route.ts', 'app/api/admin/accounting/fiscal-years/[key]/reopen/route.ts', 'app/api/admin/accounting/fiscal-years/first-month/route.ts']) {
      assert.match(readCode(f), /resolveClubMoney\(req, \{ scope: 'books', write: true \}\)/, f);
    }
  });
});
