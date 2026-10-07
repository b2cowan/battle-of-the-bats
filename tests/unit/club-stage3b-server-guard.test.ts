import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import { BUDGET_ITEM_REFERENCES } from '../../lib/coach-budget-item-usage.ts';
import { TEAM_SUPPORT_WORD_IDS } from '../../lib/club-budget-report.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 3b · SESSION 1 — the server half of the Budget, Budget vs. Actual and the board
 * summary (CLUB_TIER_STAGE3B_SERVER_PROMPT.md; owner rulings 2026-10-06).
 *
 * What this file holds the build to:
 *   1. every Budget write answers 3a's ONE money rule (Ask 4d) — never owner/treasurer by name;
 *   2. every allocation is ONE database step, and its money rules live in the step (C11);
 *   3. one word, one line on the club's plan, made true by a join that re-points before it deletes;
 *   4. a club ledger line is filed under a WORD (Ask 4a): the merge list reaches it, and a filed line
 *      writes no free text;
 *   5. the team's cash is read through the coach's own function, never a year into a coach route (D1);
 *   6. a coach's request no longer stores a club line link it was handed (owner's go 2026-10-06);
 *   7. nothing in 3b tells anybody anything (no new notification).
 * The figures have their own guard (club-money-one-definition-guard) and arithmetic gate
 * (check:club-money-arithmetic); the database-level proof is `check:club-money-atomicity`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const MIG = 'supabase/migrations/317_the_club_plan_meets_its_books.sql';
const sql = readSource(MIG);
function sqlFunction(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `${name} is gone from mig 317 — the guard reads it`);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('AS $$', start) + 5));
}

const BUDGET_WRITES: Record<string, string[]> = {
  'app/api/admin/accounting/budget-plan/lines/route.ts': ['POST'],
  'app/api/admin/accounting/budget-plan/lines/[lineId]/route.ts': ['PATCH', 'DELETE'],
  'app/api/admin/accounting/budget-plan/lines/[lineId]/periods/route.ts': ['POST'],
  'app/api/admin/accounting/budget-plan/start-from/route.ts': ['POST'],
};

describe('1. every Budget write answers the one money rule (Ask 4d, S3B-03)', () => {
  for (const [file, verbs] of Object.entries(BUDGET_WRITES)) {
    it(file, () => {
      const code = readCode(file);
      for (const verb of verbs) {
        const at = code.indexOf(`export const ${verb} =`);
        assert.ok(at >= 0, `${verb} is gone from ${file}`);
        const next = code.indexOf('export const', at + 10);
        const body = code.slice(at, next > 0 ? next : undefined);
        assert.match(body, /resolveClubMoney\(req, \{ scope: 'books', write: true \}\)/, `${verb} must ask canMoveClubMoney through resolveClubMoney`);
      }
      assert.doesNotMatch(code, /role !== 'owner'|role !== 'treasurer'/, 'no role BY NAME on a Budget write');
    });
  }
  it('New allocation answers the one rule too', () => {
    assert.match(readCode('app/api/admin/rep-teams/allocations/route.ts'), /canMoveClubMoney\(ctx!, ctx!\.org\)/);
  });
  it('the reads say who may write (canMove), from the same rule', () => {
    // ⚖ Stage 3c (Ask 1): `canMove` is the one money rule AND an open year — a closed year's writes are absent,
    // through the switch the Budget already reads (`describeFiscalYear`'s `canWrite`).
    const route = readCode('app/api/admin/accounting/budget-plan/route.ts');
    assert.match(route, /const canMove = canMoveClubMoney\(ctx, ctx\.org\);/);
    assert.match(route, /canMove: read\.canWrite/);
    assert.match(readCode('lib/club-fiscal-year-server.ts'), /canWrite: canMove && !year\.locked/);
  });
});

describe('2. an allocation is ONE step, and its money rules live in the step (C11)', () => {
  const fn = sqlFunction('club_allocation_create');
  it('the line is locked BEFORE what is already allocated is summed (two allocations count one after the other)', () => {
    const lock = fn.indexOf('FOR UPDATE');
    const sum = fn.indexOf('club_line_allocated(p_source_line)');
    assert.ok(lock > 0 && sum > lock);
  });
  it('refused above what is left on the line; a money-in line bills nobody', () => {
    assert.match(fn, /'over_line'/);
    assert.match(fn, /'not_a_cost_line'/);
  });
  it('its total is its teams\' shares, and the line link is written in the same insert', () => {
    assert.match(fn, /VALUES\s*\(v_alloc, p_org, p_description, v_shares, p_source_entry, p_source_line, p_actor\)/);
  });
  it('the one create door goes through it — and nothing in the app inserts an allocation by hand any more', () => {
    assert.match(readCode('app/api/admin/rep-teams/allocations/route.ts'), /createClubAllocation\(/);
    assert.match(readCode('lib/club-budget-writes.ts'), /rpc\('club_allocation_create'/);
    const repo = path.join(import.meta.dirname, '..', '..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
      const full = path.join(dir, n);
      return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(n) ? [full] : [];
    });
    const offenders = [...walk(path.join(repo, 'app')), ...walk(path.join(repo, 'lib'))]
      .filter(f => /from\('rep_cost_allocations'\)\s*\.insert\(/.test(readCode(path.relative(repo, f).split(path.sep).join('/'))));
    assert.deepEqual(offenders, []);
  });
  it('one way to bill teams, not two: the old Allocate page and its route are retired (session 2)', () => {
    // The line window's "Allocate $X" opens New allocation filled in from the line; the old page (and the
    // route only it called, which refused a second allocation per line) went with the old look.
    const repo = path.join(import.meta.dirname, '..', '..');
    assert.equal(existsSync(path.join(repo, 'app/api/admin/accounting/budget-plan/lines/[lineId]/allocate-to-teams/route.ts')), false);
    assert.equal(existsSync(path.join(repo, 'app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx')), false);
    assert.match(readCode('app/[orgSlug]/admin/accounting/allocations/new/page.tsx'), /sourceBudgetLineId: line\.id/);
  });
  it('a line\'s total and periods are one step: a CHANGED total below allocated is refused with the figure; periods must add up', () => {
    const save = sqlFunction('club_budget_line_save');
    assert.match(save, /'below_allocated', 'allocated', v_allocated/);
    assert.match(save, /p_total IS NOT NULL AND v_total <> v_line\.total_amount/, 'an unchanged total is never refused');
    assert.match(save, /abs\(v_sum - v_total\) > 0\.02/);
    assert.ok(save.indexOf('FOR UPDATE') < save.indexOf('club_line_allocated(p_line)'));
  });
  it('a line\'s WORD saves in the same step, under the same lock: its category is the word\'s, a word on the year is refused naming its line, and a billed line stays a cost', () => {
    const save = sqlFunction('club_budget_line_save');
    assert.match(save, /SELECT category_id, direction INTO v_category, v_direction FROM budget_items WHERE id = p_item/);
    assert.match(save, /'word_on_plan', 'existingLineId', v_holder/);
    assert.match(save, /EXCEPTION WHEN unique_violation THEN/, 'a word planned in the same instant is the same refusal, never a 500');
    const lock = save.indexOf('FOR UPDATE');
    const cost = save.indexOf("'allocated_line_is_a_cost'");
    assert.ok(lock > 0 && cost > lock, 'the billed-line check reads under the line\'s lock');
    assert.match(save, /v_direction = 'in' AND EXISTS \(SELECT 1 FROM rep_cost_allocations WHERE source_budget_line_id = p_line\)/);
    assert.match(sql, /DROP FUNCTION IF EXISTS public\.club_budget_line_save\(uuid, uuid, numeric, jsonb, timestamptz\);/, 'the five-argument save is dropped, never left beside the new one');
  });
  it('an edit is ONE call of that step — no second write a refusal could leave half-done', () => {
    const route = readCode('app/api/admin/accounting/budget-plan/lines/[lineId]/route.ts');
    assert.match(route, /editClubLine\(/);
    assert.doesNotMatch(route, /supabaseAdmin|\.update\(/, 'the PATCH writes nothing by hand');
    const w = readCode('lib/club-budget-writes.ts');
    const edit = w.slice(w.indexOf('export async function editClubLine('), w.indexOf('export async function deleteClubLine('));
    assert.equal(edit.match(/saveClubLine\(/g)?.length, 1);
    assert.doesNotMatch(edit, /\.update\(/);
  });
  it('a line is removed in one step under the lock an allocation takes, refused while one is drawn from it', () => {
    const del = sqlFunction('club_budget_line_delete');
    assert.ok(del.indexOf('FOR UPDATE') > 0 && del.indexOf('FOR UPDATE') < del.indexOf("'has_allocations'"));
    assert.match(readCode('app/api/admin/accounting/budget-plan/lines/[lineId]/route.ts'), /deleteClubLine\(/);
  });
  it('starting a year from another is refused when the target already has a line', () => {
    const roll = sqlFunction('club_budget_roll_year');
    assert.match(roll, /'year_has_lines'/);
    assert.match(roll, /pg_advisory_xact_lock/);
  });
  it('every new function is server-only (mig 311\'s rule)', () => {
    for (const name of ['club_line_allocated', 'club_allocation_create', 'club_budget_periods_refusal', 'club_budget_line_add', 'club_budget_line_save', 'club_budget_line_delete', 'club_budget_roll_year', 'club_book_totals']) {
      assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION[\\s\\S]*public\\.${name}\\(`), `${name} REVOKE`);
      assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION[\\s\\S]*public\\.${name}\\([\\s\\S]*TO service_role`), `${name} GRANT`);
    }
  });
});

describe('3. one word, one line on the club\'s plan (Ask 4a; the coach\'s mig-286 rule)', () => {
  const join = sql.slice(sql.indexOf('DO $$'), sql.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS org_budget_lines_one_line_per_item'));
  it('the join re-points every foreign key that points at a line BEFORE it deletes the twins', () => {
    const del = join.indexOf('DELETE FROM org_budget_lines');
    for (const repoint of ['UPDATE org_budget_periods SET budget_line_id = keeper', 'UPDATE rep_cost_allocations SET source_budget_line_id = keeper', 'UPDATE rep_team_payment_requests SET budget_line_id = keeper']) {
      const at = join.indexOf(repoint);
      assert.ok(at > 0 && at < del, `${repoint} must run before the delete`);
    }
  });
  it('the table is held against writes from before the join until the index is built', () => {
    const lock = sql.indexOf('LOCK TABLE public.org_budget_lines IN SHARE ROW EXCLUSIVE MODE;');
    assert.ok(lock > 0 && lock < sql.indexOf('DO $$'));
  });
  it('the index is built after the join, partial on a word', () => {
    assert.ok(sql.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS org_budget_lines_one_line_per_item') > sql.indexOf('DELETE FROM org_budget_lines'));
    assert.match(sql, /ON public\.org_budget_lines \(org_id, season_year, item_id\)\s*WHERE item_id IS NOT NULL/);
  });
  it('planning a word already on the year ADDS to its line, through the coach\'s own joinPeriodSplits, against the line\'s last change', () => {
    const w = readCode('lib/club-budget-writes.ts');
    assert.match(w, /if \(r\.code === 'word_on_plan'\) return joinOntoLine\(/);
    assert.match(w, /joinPeriodSplits\(/);
    assert.match(w, /expect: line\.updated_at/);
  });
  it('a line is ADDED in one step with its dates (nothing is made then taken back), under the lock a roll takes', () => {
    const add = sqlFunction('club_budget_line_add');
    const lock = "pg_advisory_xact_lock(hashtextextended('club_budget_year:' || p_org::text || ':' || p_year::text, 0))";
    assert.ok(add.includes(lock), 'the add takes the year\'s lock');
    assert.ok(sqlFunction('club_budget_roll_year').includes(lock.replace(/p_year/g, 'p_to')), 'the roll takes the same one');
    assert.ok(add.indexOf('club_budget_periods_refusal(p_periods, v_total)') < add.indexOf('INSERT INTO org_budget_lines'), 'the dates are checked before anything is written');
    assert.match(add, /INSERT INTO org_budget_periods/);
    const w = readCode('lib/club-budget-writes.ts');
    assert.match(w, /rpc\('club_budget_line_add'/);
    assert.doesNotMatch(w, /from\('org_budget_lines'\)\s*\.(insert|delete)\(/, 'no line is inserted or deleted by hand');
  });
  it('the dates rule is ONE function for the add and the save; kept dates are re-checked only against a CHANGED total', () => {
    assert.match(sqlFunction('club_budget_periods_refusal'), /abs\(v_sum - p_total\) > 0\.02/);
    const save = sqlFunction('club_budget_line_save');
    assert.match(save, /v_refusal := club_budget_periods_refusal\(p_periods, v_total\);/);
    assert.match(save, /ELSIF p_total IS NOT NULL AND v_total <> v_line\.total_amount THEN/);
  });
  it('a general allocation\'s source entry is checked and HELD inside the step (never voided underneath it)', () => {
    const fn = sqlFunction('club_allocation_create');
    assert.match(fn, /l\.entity_type IN \('org', 'tournament', 'league_season'\) AND e\.status <> 'void'\s*FOR SHARE OF e;/);
    assert.match(fn, /'code', 'bad_source_entry'/);
    assert.match(fn, /coalesce\(\(s->>'amount'\)::numeric, 0\) <= 0/, 'every share above zero, not just their sum');
  });
});

describe('4. a club ledger line is filed under a WORD (Ask 4a)', () => {
  it('the word-merge list reaches club ledger lines (through the club\'s own books — they carry no org_id)', () => {
    const ref = BUDGET_ITEM_REFERENCES.find(r => r.table === 'accounting_entries');
    assert.ok(ref && ref.column === 'budget_item_id' && ref.categoryColumn === 'budget_category_id' && ref.orgScope === 'ledger');
    const merge = readCode('lib/coach-budget-items.ts');
    assert.match(merge, /ref\.orgScope === 'ledger'\s*\?\s*\{ column: 'ledger_id', ids: await \(clubBooks \?\?= clubOwnedBookIds\(\)\)/);
    assert.match(merge, /\.in\('entity_type', \[\.\.\.CLUB_OWNED_BOOK_KINDS\]\)/, 'the club\'s own books, never a team\'s');
    assert.equal(merge.match(/\.in\(scope\.column, scope\.ids\)/g)?.length, 2, 'both the label and the word move only inside the org');
  });
  it('a new line is filed under a word and writes no free-text category; the word is on the line\'s own side', () => {
    // Session 2: the Add entry window draws Filed under as required (hub specimen 2), so the free-text
    // category retired outright — a new line without a word is refused, never saved with a typed category.
    const post = readCode('app/api/admin/accounting/ledgers/[ledgerId]/entries/route.ts');
    assert.match(post, /code: 'word_required'/);
    assert.match(post, /category: null,/);
    assert.match(readCode('lib/club-budget-writes.ts'), /word\.item\.direction !== want/);
  });
  it('a club plan line\'s category is always its word\'s: neither door reads a bare category id', () => {
    for (const f of ['app/api/admin/accounting/budget-plan/lines/route.ts', 'app/api/admin/accounting/budget-plan/lines/[lineId]/route.ts']) {
      assert.doesNotMatch(readCode(f), /categoryId/, f);
    }
    assert.match(sqlFunction('club_budget_line_add'), /SELECT category_id INTO v_category FROM budget_items WHERE id = p_item;/);
    assert.match(sqlFunction('club_budget_line_save'), /category_id\s+= coalesce\(v_category, category_id\)/);
  });
  it('the Ledger\'s Category filter lists what lines are FILED under (C14), never a team\'s words', () => {
    const read = readCode('lib/club-ledger-read.ts');
    const list = read.slice(read.indexOf('export async function clubCategories('));
    assert.match(list, /getClubOwnedLedgers\(orgId\)/);
    assert.match(list, /ledgerCategory\(filingFacts\(r\)/, 'the list reads the rule the column reads');
  });
  it('the standard word is club-only (a coach\'s picker never lists it) and fixed', () => {
    assert.match(sql, new RegExp(`'${TEAM_SUPPORT_WORD_IDS.categoryId}', NULL, NULL, 'Team support', 'org'`));
    assert.match(sql, new RegExp(`'${TEAM_SUPPORT_WORD_IDS.itemId}', '${TEAM_SUPPORT_WORD_IDS.categoryId}', NULL, NULL,\\s*'Paid to teams on request', 0, true, false, 'out'`));
    assert.match(readCode('app/api/coaches/[orgSlug]/budget-items/route.ts'), /\.in\('scope', \['team', 'both'\]\)/, 'the coach picker never offers a club-only heading');
  });
});

describe('5. the team\'s cash is read through the coach\'s own function (D1, C15)', () => {
  const cash = readCode('lib/club-team-cash.ts');
  it('through seasonClosingCashCents (cashOnHandCents over the register), the live season or the last closed one', () => {
    assert.match(cash, /seasonClosingCashCents\(season, teamId\)/);
    assert.match(cash, /const live = liveSeasonOf\(mine\);/);
    assert.match(cash, /live \?\? latestClosedSeasonOf\(mine\)/);
  });
  it('never a year parameter into a coach route, never stored', () => {
    assert.doesNotMatch(cash, /\/api\/coaches|fetch\(|\?year=/);
    assert.doesNotMatch(cash, /\.insert\(|\.update\(|\.upsert\(/);
  });
  it('never added into a club figure: Cash on hand reads the club\'s books only', () => {
    // A closed year's band reads its locked closing (Stage 3c) — still only the club's own books.
    assert.match(readCode('lib/club-budget-report.ts'), /const cashOnHand = year\.closed \? year\.closed\.closingBalance : clubCashOnHand\(books\);/);
  });
});

describe('6–7. the request link, and no new notification', () => {
  it('a coach\'s request no longer stores a club budget-line link it was handed', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/route.ts');
    assert.doesNotMatch(route, /budgetLineId/);
    assert.doesNotMatch(route, /budget_line_id:/);
  });
  it('planning, reading and reporting tell nobody anything', () => {
    for (const f of ['lib/club-budget-writes.ts', 'lib/club-budget-read.ts', 'lib/club-budget-report.ts', 'lib/club-team-cash.ts', 'lib/club-payee-report.ts']) {
      assert.doesNotMatch(readCode(f), /club-money-notify|from '\.\/notifications|sendNotification|notifyUsers/, f);
    }
  });
});
