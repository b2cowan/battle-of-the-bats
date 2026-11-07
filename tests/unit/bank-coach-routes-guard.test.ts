import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, reachableFrom } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE TEAM'S BANK ROUTES, HELD (Bank balance check BC6b; build prompt BANK_BALANCE_CHECK_BC6_BUILD_PROMPT.md; plan
 * BANK_RECONCILIATION_PLAN.md §9 BC6). The coach's half of tests/unit/bank-r2-server-guard.test.ts:
 *
 *   1. every route under app/api/coaches/[orgSlug]/teams/[teamId]/bank/** resolves the LIVE season first
 *      (`resolveLiveCoachTeamContext`: no live season, no answer, a read included) and gates money read or money write
 *      (B7) before it reads the request; none reads a year (`HISTORY_ENDPOINTS` unchanged — the GET's header records the
 *      one read back, Q1);
 *   2. the client sends intent: the account is the server's read of THIS team's (never the request's), the books and every
 *      waiting line's figures are the server's, the pure plan runs on every save, a team's save sends no start and no
 *      book ids (rule 6; BC6a "For BC6b");
 *   3. ⚖ D1 (owner 2026-11-06, `decision_coach_books_stay_the_teams`): the club never reads a coach's bank. Nothing outside
 *      the coach's own bank files imports them, nothing club-side reaches them by any chain of imports, and every bank
 *      table read outside them is filtered to the club's own accounts (`owner_kind = 'club'`).
 * The pure decisions are tested in bank-coach.test.ts; the routes are proved on dev by `.probe/bank-bc6/bc6.mjs`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const BANK_ROOT = 'app/api/coaches/[orgSlug]/teams/[teamId]/bank';
const ROUTES = filesUnder(BANK_ROOT, 'route.ts');
/** Each route's handlers, and whether each writes (money write) or reads (money read). */
const EXPECTED: Record<string, Record<string, boolean>> = {
  [`${BANK_ROOT}/route.ts`]: { GET: false },
  [`${BANK_ROOT}/checks/route.ts`]: { POST: true },
  [`${BANK_ROOT}/checks/[checkId]/route.ts`]: { DELETE: true },
};
const COACH_BANK_LIBS = ['lib/bank-coach-map.ts', 'lib/bank-coach-rules.ts', 'lib/bank-coach-read.ts', 'lib/bank-coach-steps.ts'];
const STEPS = readCode('lib/bank-coach-steps.ts');
const fnBody = (code: string, name: string) => {
  const a = code.indexOf(`export async function ${name}(`);
  assert.ok(a >= 0, `${name}: gone`);
  const b = code.indexOf('\nexport ', a + 10);
  return code.slice(a, b < 0 ? undefined : b);
};

describe('1. every team bank route: the live season, then money read or write, and no year', () => {
  it('the list of route files is the list this guard knows (a new one must be added here)', () => {
    assert.deepEqual([...ROUTES].sort(), Object.keys(EXPECTED).sort());
  });
  for (const [file, handlers] of Object.entries(EXPECTED)) {
    it(file, () => {
      const code = readCode(file);
      const exported = [...code.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = withObservability\(/g)].map(m => m[1]);
      assert.deepEqual(exported.sort(), Object.keys(handlers).sort(), `${file}: handlers`);
      // A handler written any other way would escape the gate checks below (/review BC6b).
      assert.doesNotMatch(code, /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b|export\s*\{[^}]*\b(GET|POST|PUT|PATCH|DELETE)\b/, `${file}: a handler outside withObservability`);
      for (const [method, write] of Object.entries(handlers)) {
        const start = code.indexOf(`export const ${method} = `);
        const next = code.indexOf('export const ', start + 10);
        const body = code.slice(start, next < 0 ? undefined : next);
        const gate = body.indexOf('resolveLiveCoachTeamContext(orgSlug, teamId)');
        const can = body.indexOf(`denyUnless(${write ? 'canWriteMoney' : 'canViewMoney'}(resolved.assignment.capabilities)`);
        assert.ok(gate > 0 && can > gate, `${file} ${method}: the live season, then ${write ? 'money write' : 'money read'}`);
        // Nothing is read from the request before both gates (the body, the date, the path's check id).
        for (const read of ['bankBody(', 'askedDay(', 'isUuid(']) {
          if (body.includes(read)) assert.ok(body.indexOf(read) > can, `${file} ${method}: ${read} after the gate`);
        }
      }
      assert.doesNotMatch(code, /resolveCoachTeamRead|resolveCoachHistoryRead|searchParams\.get\(\s*['"](year|season|programYear|yearId|seasonId)['"]/,
        `${file}: never a finished season, never a year`);
      assert.doesNotMatch(code, /resolveClubMoney|getAuthContextWithRole/, `${file}: the coach gate, never the club's`);
    });
  }
  it('the coach bank libraries take no year from a request either', () => {
    for (const file of COACH_BANK_LIBS) {
      assert.doesNotMatch(readCode(file), /searchParams\.get\(\s*['"](year|season|programYear|yearId|seasonId|fiscalYear)['"]/, file);
    }
  });
});

describe('2. the client sends intent; the server decides (rule 6)', () => {
  it('a save reads this team\'s working season, then asks the pure plan on that read', () => {
    const body = fnBody(STEPS, 'saveTeamCheck');
    assert.match(body, /const read = await readTeamBank\(\{ orgId: c\.orgId, season: c\.season, today: tournamentToday\(\), date \}\);/);
    assert.match(body, /const plan = coachSavePlan\(\{ date, body, facts: read\.facts \}\);\s+if \(!plan\.ok\) return bankRefusedAs\(plan\.code\);/);
    // The account is the read's (this team's) or the one the first save makes for this team — never the request's.
    assert.match(body, /const account = read\.account \?\? await openTeamAccount\(c\);/);
    assert.match(body, /p_account: account\.id,/);
    // A team has no start and no club books (the step refuses either); its `bad_item` is the team's sentence.
    assert.match(body, /p_book_ids: a\.bookIds,[\s\S]*p_start: null, p_start_books: null,/);
    assert.match(body, /\{ bad_item: 'bad_team_item' \}\);/);
    assert.ok(body.indexOf('coachSavePlan(') < body.indexOf('openTeamAccount('), 'a refused first save makes no account');
  });
  it('a delete reaches only a check of this team\'s working season', () => {
    const body = fnBody(STEPS, 'deleteTeamCheck');
    assert.match(body, /if \(!read\.account \|\| !read\.checks\.some\(ch => ch\.id === checkId\)\) return bankRefusedAs\('check_not_found'\);/);
    assert.match(body, /p_account: read\.account\.id,/);
  });
  it('the request never supplies the books, a difference, the account, the season or a waiting line\'s figures', () => {
    for (const file of ['lib/bank-coach-steps.ts', 'lib/bank-coach-rules.ts', ...ROUTES]) {
      assert.doesNotMatch(readCode(file),
        /body\.(booksCents|onItsWayCents|differenceCents|bookIds|kind|amountCents|direction|label|accountId|teamId|seasonId|programYearId)\b/, file);
    }
  });
  it('the account is made for the gate\'s team, named as ruled, and a racing first save reads the other one\'s', () => {
    assert.match(STEPS, /\.insert\(\{ org_id: c\.orgId, owner_kind: 'team', team_id: c\.season\.teamId, name: TEAM_BANK_ACCOUNT_NAME, created_by: c\.actorId \}\)/);
    assert.match(readCode('lib/bank-coach-read.ts'), /export const TEAM_BANK_ACCOUNT_NAME = 'Team bank account';/);
    assert.match(STEPS, /error\.code === '23505' && \/bank_accounts_one_per_team\//);
  });
  it('every write is awaited, and the steps are the bank\'s own', () => {
    for (const line of STEPS.split('\n')) {
      if (/supabaseAdmin\.(from\([^)]*\)\.(insert|update|delete|upsert)|rpc)\(|\bstep\('/.test(line)) assert.match(line, /await /, line.trim());
    }
    assert.deepEqual([...STEPS.matchAll(/step\('(\w+)'/g)].map(m => m[1]).sort(), ['bank_check_delete', 'bank_check_save']);
    // The account insert spans lines, so the per-line walk can't see it (/review BC6b).
    assert.match(STEPS, /= await supabaseAdmin\.from\('bank_accounts'\)\s*\.insert\(/);
  });
  it('the shared `step` (any bank function by name) is called only by the two bank step files', () => {
    const callers = ['app', 'components', 'lib'].flatMap(d => [...filesUnder(d, '.ts'), ...filesUnder(d, '.tsx')])
      .filter(f => /import\s*\{[^}]*\bstep\b[^}]*\}\s*from\s*['"][^'"]*bank-club-steps['"]/.test(readCode(f)));
    assert.deepEqual(callers, ['lib/bank-coach-steps.ts']);
  });
});

describe('3. ⚖ D1 — the club never reads a coach\'s bank', () => {
  const ALL = ['app', 'components', 'lib'].flatMap(d => [...filesUnder(d, '.ts'), ...filesUnder(d, '.tsx')]);
  const isCoachBank = (f: string) => COACH_BANK_LIBS.includes(f) || f.startsWith(`${BANK_ROOT}/`);
  // BC7 draws the coach's Bank view in the coaches portal: its screens may import the coach's bank (client-safe parts).
  const isCoachPortal = (f: string) => f.startsWith('components/coaches/') || f.startsWith('app/[orgSlug]/coaches/');

  it('the walk reaches the repo (guards against a vacuous pass)', () => {
    assert.ok(ALL.length > 500 && ALL.includes('lib/bank-club-read.ts') && ALL.includes(`${BANK_ROOT}/route.ts`));
  });
  it('only the coach\'s own bank files, and the coaches portal, import the coach\'s bank', () => {
    const importers = ALL.filter(f => !isCoachBank(f) && !isCoachPortal(f))
      .filter(f => /from ['"][^'"]*\/bank-coach-[\w-]+['"]|import\(['"][^'"]*\/bank-coach-/.test(readCode(f)));
    assert.deepEqual(importers, []);
  });
  it('nothing club-side reaches the coach\'s bank by any chain of imports', () => {
    const clubEntries = ALL.filter(f => f.startsWith('app/api/admin/') || f.startsWith('components/admin/')
      || f.startsWith('app/[orgSlug]/admin/') || /^lib\/(bank-club-|club-)/.test(f));
    const reached = [...reachableFrom(...clubEntries)].filter(f => /(^|\/)lib\/bank-coach-/.test(f));
    assert.deepEqual(reached, []);
  });
  it('every bank account or check read outside the coach\'s bank is the club\'s own (owner_kind = club)', () => {
    let reads = 0;
    for (const f of ALL.filter(x => !isCoachBank(x))) {
      const code = readCode(f);
      for (const m of code.matchAll(/\.from\(['"](bank_accounts|bank_checks)['"]\)/g)) {
        reads += 1;
        const statement = code.slice(m.index!, code.indexOf(';', m.index!));
        assert.match(statement, /\.eq\(['"](?:bank_accounts\.)?owner_kind['"],\s*['"]club['"]\)/, `${f}: ${m[1]} read without the club's filter`);
      }
      assert.doesNotMatch(code, /owner_kind['"]?\s*[:,=]\s*['"]team['"]/, `${f}: names a team's bank account`);
    }
    // Today 3 (the club's accounts, its checks, the rename); the floor only proves the walk sees them (/review BC6b).
    // ⚠ A literal filter is what this reads: a club read filtered another way fails here and is decided then.
    assert.ok(reads >= 2, 'the club\'s own reads are found (a vacuous pass otherwise)');
  });
});
