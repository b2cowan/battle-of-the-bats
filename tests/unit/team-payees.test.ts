/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * LEDGER PARITY · SESSION 1 — shared payees and a team's own payees (owner rulings 2026-10-02, D5 + D7 +
 * D7a + D7b; Business Decisions Log "A club can SHARE payees…"; LEDGER_PARITY_SERVER_PROMPT.md).
 *
 * What this file holds the build to:
 *   1. ONE rule for what a team sees: a club team sees the club's SHARED payees + its own — never an
 *      unshared club payee, never another team's; a standalone team sees every payee of its org; the club's
 *      own picker sees every club payee.
 *   2. Every team read and write goes through that rule, and every write re-asserts the team's scope in its
 *      WHERE; nothing a team reads counts another team's records or the club's.
 *   3. A team record can name only a payee the team can see (the picker narrowing is a courtesy).
 *   4. The club is shown its own book's lines only — never a count or date from a team's records (D7a).
 *   5. The migration: only a club row is shared and it always carries its stamp; the launch step runs once;
 *      the team merge never touches the club's books; the club merge keeps the LATER stamp.
 * The live proof — every refusal of both merges, mutated away and caught — is
 * `npm run check:club-money-atomicity -- --mutate` (dev, rolled back).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import { teamPayeeFilter, teamPayeeScope } from '../../lib/team-payee-scope.ts';

/**
 * One top-level function's body, bounded at the next top-level function of ANY kind — the shared helper stops
 * only at a bare `function`, so in a module of `export async function`s a word in a NEIGHBOUR would satisfy
 * an assertion about this one (the Stage 3a guard's lesson).
 */
function functionBody(code: string, name: string): string {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name} is gone — the guard reads it`);
  const rest = code.slice(start + 1);
  const end = rest.search(/\n(?:export )?(?:async )?function \w|\nexport const \w|\nconst \w/);
  return end > 0 ? code.slice(start, start + 1 + end) : code.slice(start);
}

const TEAM = 'team-a';
const OTHER = 'team-b';
const rows = {
  own: { team_id: TEAM, shared_with_teams: false },
  otherTeams: { team_id: OTHER, shared_with_teams: false },
  clubShared: { team_id: null, shared_with_teams: true },
  clubUnshared: { team_id: null, shared_with_teams: false },
};

describe('what a team sees of its org\'s payees — the one rule', () => {
  it('a club team sees the club\'s shared payees and its own, nothing else', () => {
    assert.equal(teamPayeeScope(rows.own, TEAM, false), 'team');
    assert.equal(teamPayeeScope(rows.clubShared, TEAM, false), 'club');
    assert.equal(teamPayeeScope(rows.clubUnshared, TEAM, false), null, 'an unshared club payee stays the club\'s');
    assert.equal(teamPayeeScope(rows.otherTeams, TEAM, false), null, 'another team\'s payee is never seen');
  });

  it('a standalone team sees every payee of its org as its own — the flag never hides one', () => {
    assert.equal(teamPayeeScope(rows.own, TEAM, true), 'team');
    assert.equal(teamPayeeScope(rows.clubUnshared, TEAM, true), 'team');
    assert.equal(teamPayeeScope(rows.clubShared, TEAM, true), 'team');
    assert.equal(teamPayeeScope(rows.otherTeams, TEAM, true), null);
  });

  it('the club\'s own picker lists every club payee, shared or not, and no team\'s', () => {
    const body = functionBody(readCode('lib/db.ts'), 'searchOrgPayees');
    assert.match(body, /\.is\('team_id', null\)/);
    assert.doesNotMatch(body, /shared_with_teams/, 'the club\'s books may name any club payee');
    assert.doesNotMatch(body, /teamId/, 'a team id no longer widens the club\'s search');
  });
});

describe('every team read and write goes through the rule', () => {
  const code = readCode('lib/team-payees.ts');

  it('the database filter says the same as the rule', () => {
    assert.equal(teamPayeeFilter(TEAM, false, 'visible'), `team_id.eq.${TEAM},and(team_id.is.null,shared_with_teams.is.true)`);
    assert.equal(teamPayeeFilter(TEAM, false, 'own'), `team_id.eq.${TEAM}`, 'a club team\'s own never includes a club row');
    assert.equal(teamPayeeFilter(TEAM, true, 'visible'), `team_id.is.null,team_id.eq.${TEAM}`);
    assert.equal(teamPayeeFilter(TEAM, true, 'own'), `team_id.is.null,team_id.eq.${TEAM}`);
  });

  it('every read filters in the database AND labels through the rule', () => {
    for (const fn of ['searchTeamPayees', 'listTeamPayees']) {
      const body = functionBody(code, fn);
      assert.match(body, /teamPayeeFilter\(teamId, workspace, 'visible'\)/, `${fn} fetches only what the team could see`);
      assert.match(body, /teamPayeeScope\(/, `${fn} labels through the rule`);
    }
    assert.match(functionBody(code, 'payeeScopeForTeam'), /teamPayeeScope\(/);
  });

  it('a team\'s counts read THIS team\'s records only — never the club\'s lines or another team\'s', () => {
    const list = functionBody(code, 'listTeamPayees');
    assert.match(list, /from\('rep_team_expenses'\)\.select\('payee_id, created_at'\)\s*\.eq\('team_id', teamId\)/);
    assert.doesNotMatch(list, /accounting_entries/);
    assert.match(list, /shared\.push\(\{ id: p\.id, name: p\.name \}\)/, 'a shared payee is a name, never a count');
    assert.match(functionBody(code, 'deleteTeamPayee'), /from\('rep_team_expenses'\)\.select\('id', \{ count: 'exact', head: true \}\)\.eq\('team_id', teamId\)/);
  });

  it('a club payee is never renamed, merged or deleted by a team; writes re-assert the team\'s scope', () => {
    assert.match(functionBody(code, 'refuseUnlessOwn'), /scope === 'team' \? null : scope === 'club' \? CLUB_ONLY : NOT_FOUND/);
    const rename = functionBody(code, 'renameTeamPayee');
    const del = functionBody(code, 'deleteTeamPayee');
    for (const [fn, body] of [['renameTeamPayee', rename], ['deleteTeamPayee', del]]) {
      assert.match(body, /refuseUnlessOwn\(org, teamId, payeeId\)/, fn);
      assert.match(body, /if \(notOwn\) return notOwn;/, fn);
    }
    assert.match(rename, /const own = teamPayeeFilter\(teamId, workspace, 'own'\)/);
    assert.match(rename, /\.update\(\{ name: read\.name \}\)\s*\.eq\('id', payeeId\)\.eq\('org_id', org\.id\)\.or\(own\)/, 'rename re-asserts scope in the write');
    assert.match(del, /\.delete\(\)\s*\.eq\('id', payeeId\)\.eq\('org_id', org\.id\)\.or\(teamPayeeFilter\(teamId, isTeamWorkspaceOrg\(org\), 'own'\)\)/, 'delete re-asserts scope in the write');
    assert.match(functionBody(code, 'mergeTeamPayee'), /rpc\('team_payee_merge'/);
    assert.match(del, /if \(!data\?\.length\) return NOT_FOUND;/, 'a delete that matched nothing is not a success');
  });

  it('the routes: read on money-read, every write on money-write, all on the live season', () => {
    const base = 'app/api/coaches/[orgSlug]/teams/[teamId]/payees';
    const list = readCode(`${base}/route.ts`);
    assert.match(list, /canViewMoney\(assignment\.capabilities\)[\s\S]*listTeamPayees\(ctx\.org, teamId\)/);
    assert.match(list, /searchTeamPayees\(ctx\.org, teamId,/);
    for (const f of [`${base}/route.ts`, `${base}/[payeeId]/route.ts`, `${base}/[payeeId]/merge/route.ts`]) {
      assert.match(readCode(f), /resolveLiveCoachTeamContext\(orgSlug, teamId\)/, f);
    }
    const one = readCode(`${base}/[payeeId]/route.ts`);
    assert.match(functionBody(one, 'resolveWriter'), /denyUnless\(canWriteMoney\(resolved\.assignment\.capabilities\), NO_MONEY_ACCESS\)/);
    assert.equal((one.match(/await resolveWriter\(params\)/g) ?? []).length, 2, 'rename and delete both pass the write gate');
    assert.match(readCode(`${base}/[payeeId]/merge/route.ts`), /canWriteMoney\(resolved\.assignment\.capabilities\)/);
  });

  it('the coach door with no team is gone — in a club it listed every club payee and wrote into the club\'s list', () => {
    assert.equal(existsSync('app/api/coaches/[orgSlug]/payees/route.ts'), false);
  });
});

describe('a team record names only a payee the team can see', () => {
  it('a new expense: checked before anything is written', () => {
    const code = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/expenses/route.ts');
    assert.match(code, /!payeeId \|\| \(typeof payeeId === 'string' && teamMayNamePayee\(ctx!\.org, team\.id, payeeId\)\)/);
    assert.match(code, /if \(!payeeAllowed\) return NextResponse\.json\(\{ error: 'Choose a payee from the list\.', code: 'payee_not_allowed' \}/);
  });
  it('an edit: a NEW payee is checked; the one it already names passes (unsharing never breaks a record)', () => {
    const code = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]/route.ts');
    assert.match(code, /fields\.payeeId && !\(await teamMayNamePayee\(ctx!\.org, team\.id, fields\.payeeId, expense\.payeeId\)\)/);
    assert.match(functionBody(readCode('lib/team-payees.ts'), 'teamMayNamePayee'), /return payeeId === current \|\| \(await payeeScopeForTeam\(/);
  });
});

describe('the club is shown its own lines only (D7a)', () => {
  const code = readCode('lib/club-payees.ts');
  it('Entries and Last used are the club\'s book lines; a team record is one yes/no for the delete', () => {
    const list = functionBody(code, 'listClubPayees');
    assert.match(list, /const uses = tallyPayeeUses\(entries\.map\(/, 'counted from the club\'s entries');
    assert.match(list, /from\('accounting_entries'\)\.select\('payee_id, entry_date'\)/);
    assert.match(list, /const teamNamed = new Set\(teamRecords\.map\(r => r\.payee_id\)\)/, 'team records only ever become a yes/no');
    assert.match(list, /inUse: \(u\?\.count \?\? 0\) > 0 \|\| teamNamed\.has\(p\.id\)/);
  });
  it('a merge reports the club\'s own lines moved, never the team records it also moved', () => {
    assert.match(functionBody(code, 'mergeClubPayee'), /moved: r\.entries \?\? 0/);
  });
  it('a delete refused by a team\'s record says so without a count or a team', () => {
    const del = functionBody(code, 'deleteClubPayee');
    assert.match(del, /if \(uses > 0\) return inUse\(/);
    const teamRefusal = del.slice(del.indexOf('(teamRecord.data ?? []).length > 0'));
    assert.match(teamRefusal, /refused\(409, \{ error: 'A team’s records name this payee\. Merge it into another payee instead\.', code: 'payee_in_use' \}\)/);
    assert.doesNotMatch(teamRefusal.slice(0, teamRefusal.indexOf('})')), /uses/, 'no count, not even 0');
  });
  it('sharing never restarts a running clock, and only a club with teams can share', () => {
    const share = functionBody(code, 'setClubPayeeShared');
    assert.match(share, /const refusal = shareRefusal\(org, shared\);\s*if \(refusal\) return refusal;/);
    assert.match(share, /\.eq\('shared_with_teams', !on\)/);
    assert.match(functionBody(code, 'shareRefusal'), /if \(isTeamWorkspaceOrg\(org\) \|\| !hasModuleEntitlement\(org, 'module_rep_teams'\)\)/);
    const route = readCode('app/api/admin/accounting/payees/[payeeId]/route.ts');
    assert.match(route, /resolveClubMoney\(req, \{ scope: 'books', write: true \}\)/);
    assert.match(route, /setClubPayeeShared\(r\.ctx\.org, payeeId,/);
  });
  it('a refused rename-and-share changes nothing: every check first, then the rename, then the share', () => {
    const route = readCode('app/api/admin/accounting/payees/[payeeId]/route.ts');
    const early = route.indexOf('if (early) return moveRefused(early);');
    assert.ok(early > 0 && early < route.indexOf('renameClubPayee('), 'checks run before any write');
    assert.match(route, /shareRefusal\(r\.ctx\.org, body\.sharedWithTeams\)/);
    assert.ok(route.indexOf('renameClubPayee(') < route.indexOf('setClubPayeeShared('), 'the rename (still refusable) runs before the share');
  });
});

describe('migration 316', () => {
  const sql = readSource('supabase/migrations/316_a_club_shares_payees_with_its_teams.sql')
    .split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
  const fn = (name: string) => {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    assert.ok(start >= 0, `${name} is gone from mig 316`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('AS $$', start) + 5));
  };

  it('only a club row is shared, and a shared row always carries its stamp', () => {
    assert.match(sql, /\(NOT shared_with_teams AND shared_at IS NULL\)\s*OR \(shared_with_teams AND shared_at IS NOT NULL AND team_id IS NULL\)/);
  });
  it('D7b runs once, in clubs only, for payees a team record already names', () => {
    assert.match(sql, /IF NOT EXISTS \([\s\S]*column_name = 'shared_with_teams'[\s\S]*UPDATE public\.org_payees p[\s\S]*END IF;/);
    assert.match(sql, /o\.account_kind IS DISTINCT FROM 'team_workspace'\s*AND o\.plan_id IS DISTINCT FROM 'team'/);
    assert.match(sql, /FROM public\.rep_team_expenses e WHERE e\.payee_id = p\.id AND e\.org_id = p\.org_id/);
  });
  it('a team merge moves this team\'s records only, never the club\'s books, and refuses before writing', () => {
    const team = fn('team_payee_merge');
    assert.match(team, /UPDATE rep_team_expenses SET payee_id = p_into WHERE payee_id = p_from AND team_id = p_team;/);
    assert.doesNotMatch(team, /UPDATE accounting_entries/);
    assert.ok(team.indexOf("'named_elsewhere'") < team.indexOf('UPDATE rep_team_expenses'), 'refuses before any write');
    assert.match(team, /coalesce\(v_from\.team_id = p_team, v_workspace AND v_from\.team_id IS NULL, false\)/,
      'a club payee\'s NULL team must never read as the team\'s own');
  });
  it('the club merge keeps the LATER stamp, and both functions are server-only', () => {
    assert.match(fn('club_payee_merge'), /GREATEST\(v_from\.shared_at, v_into\.shared_at\)/);
    assert.match(sql, /REVOKE ALL ON FUNCTION\s*public\.team_payee_merge\(uuid, uuid, uuid, uuid\),\s*public\.club_payee_merge\(uuid, uuid, uuid\)\s*FROM public, anon, authenticated;/);
  });
});
