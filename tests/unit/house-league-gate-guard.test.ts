import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';
import { houseLeagueAccess, isFinishedLeagueSeason, type HouseLeagueAccess } from '../../lib/house-league-access.ts';
import type { EntitlementOrg } from '../../lib/module-entitlements.ts';
import type { OrgRole } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9a, PART 1 — THE ONE HOUSE-LEAGUE GATE (owner Q16 + Q17, 2026-10-24; build prompt
 * docs/projects/active/HOUSE_LEAGUE_STAGE9A_BUILD_PROMPT.md).
 *   1. EVERY ROUTE GOES THROUGH IT: each handler under app/api/admin/house-league refuses through `houseLeagueRefusal`,
 *      no route names a role or asks the capability itself (F01: sixteen writers checked `owner || league_admin` by name
 *      after a gate that let the club admin in, so the club admin read everything and saved nothing).
 *   2. A WRITE ASKS ABOUT ITS SEASON: every season-scoped write passes the season, so a finished one is locked (Q16).
 *   3. THE MATRIX (frame F), including a finished season, as data.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTES = filesUnder('app/api/admin/house-league', '.ts').filter(f => f.endsWith('/route.ts'));
const ROLE_LITERAL = /['"`](owner|admin|staff|official|league_admin|league_registrar|treasurer|coach)['"`]/;
const VERB = '(GET|POST|PATCH|PUT|DELETE)';

/** Each `export const VERB = withObservability(...)` handler, by verb. Section 1 proves no handler is written another way. */
function handlers(code: string): { verb: string; body: string }[] {
  const parts = code.split(new RegExp(`export const ${VERB}\\s*=`));
  const out: { verb: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) out.push({ verb: parts[i], body: parts[i + 1] });
  return out;
}

/** The first gate call in a handler, and its action. */
function firstGate(body: string): string | null {
  return /houseLeagueRefusal\(ctx, '(\w+)'/.exec(body)?.[1] ?? null;
}

/**
 * The one write handler whose FIRST gate is a read: the registration PATCH decides per field (fee, notes, placement,
 * status), and section 2b proves each branch asks its own write action on the season.
 */
const FIRST_GATE_READ = new Set(['app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts PATCH']);

describe('1 · every house-league route goes through the one gate', () => {
  it('the glob found the tree', () => assert.ok(ROUTES.length >= 20, `only ${ROUTES.length} routes found`));
  for (const file of ROUTES) {
    const code = readCode(file);
    it(`${file} names no role and asks no capability itself`, () => {
      assert.doesNotMatch(code, ROLE_LITERAL, `${file} names a role — ask lib/house-league-access.ts instead`);
      assert.doesNotMatch(code, /\bhasCapability\(|\bhasModuleEntitlement\(|\bcanOpenModule\(/, `${file} gates on its own`);
      assert.doesNotMatch(code, /\.role\b/, `${file} reads a role`);
    });
    it(`${file} declares its handlers the one way this guard reads`, () => {
      assert.doesNotMatch(code, new RegExp(`export\\s+(async\\s+)?function\\s+${VERB}\\b|export const ${VERB}\\s*:`),
        `${file} declares a handler this guard cannot see`);
      assert.ok(handlers(code).length > 0, `${file} has no handler the guard can read`);
    });
    for (const { verb, body } of handlers(code)) {
      it(`${file} ${verb} refuses through houseLeagueRefusal before it works`, () => {
        const action = firstGate(body);
        assert.ok(action, `${file} ${verb} has no gate`);
        if (verb !== 'GET' && !FIRST_GATE_READ.has(`${file} ${verb}`)) {
          assert.notEqual(action, 'read', `${file} ${verb} writes behind a read gate`);
        }
      });
    }
  }
});

/** The writes that do not belong to one season: creating a season. */
const NOT_SEASON_SCOPED = new Set(['app/api/admin/house-league/seasons/route.ts POST']);
const SEASON_CHECK = /houseLeagueRefusal\(ctx, '\w+', (season|stored\.season|exists\.season)\)/g;

describe('2 · a season-scoped write asks about its season (a finished season is locked, Q16)', () => {
  for (const file of ROUTES) {
    for (const { verb, body } of handlers(readCode(file))) {
      if (verb === 'GET' || NOT_SEASON_SCOPED.has(`${file} ${verb}`)) continue;
      it(`${file} ${verb} passes the season to the gate`, () => {
        assert.match(body, new RegExp(SEASON_CHECK.source), `${file} ${verb} never asks whether the season is finished`);
      });
    }
  }
  it('the season PATCH keeps a status move apart from a field edit', () => {
    const body = handlers(readCode('app/api/admin/house-league/seasons/[seasonId]/route.ts')).find(h => h.verb === 'PATCH')!.body;
    assert.equal(firstGate(body), 'changeStatus');
    // Decided on the fields the route writes, after it has collected them, and before the status move.
    assert.match(body, /if \(Object\.keys\(patch\)\.length > 0\) \{\s*const refused = houseLeagueRefusal\(ctx, 'run', season\);/);
    assert.ok(body.indexOf("houseLeagueRefusal(ctx, 'run', season)") < body.indexOf("if (typeof body.status === 'string')"));
  });
  it('a finished season has a way back (otherwise the lock is permanent)', () => {
    const code = readCode('app/api/admin/house-league/seasons/[seasonId]/route.ts');
    assert.match(code, /registration_closed:\s*\[[^\]]*'registration_open'/);
    assert.match(code, /completed:\s*\[[^\]]*'active'/);
    assert.match(code, /archived:\s*\[[^\]]*'active'/);
    assert.doesNotMatch(code, /active:\s*\[[^\]]*'registration_open'/, 'reopen registration is offered only before play (owner 2026-10-24)');
  });
});

describe('2b · the registration PATCH asks each branch its own action', () => {
  const body = handlers(readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts'))
    .find(h => h.verb === 'PATCH')!.body;
  const at = (marker: string) => { const i = body.indexOf(marker); assert.ok(i >= 0, `${marker} is gone`); return i; };
  it('the fee goes through the one fee write, open on a finished season', () => {
    assert.ok(at('canMarkLeagueFeePaid(ctx!)') < at("if ('adminNotes' in body"));
  });
  it('notes, placement and status each ask on the season, inside their own branch', () => {
    const notes = at("if ('adminNotes' in body"), place = at("if ('divisionId' in body"), status = at("if (!('status' in body))");
    const calls = [...body.matchAll(SEASON_CHECK)].map(m => ({ i: m.index!, action: /'(\w+)'/.exec(m[0])![1] }));
    assert.ok(calls.some(c => c.action === 'register' && c.i > notes && c.i < place), 'notes branch has no season check');
    assert.ok(calls.some(c => c.action === 'run' && c.i > place && c.i < status), 'placement branch has no season check');
    assert.ok(calls.some(c => c.action === 'register' && c.i > status), 'status branch has no season check');
  });
});

// ── 3 · the matrix ────────────────────────────────────────────────────────────────────────────

const CLUB: EntitlementOrg = { planId: 'club', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null };
const LEAGUE: EntitlementOrg = { planId: 'league', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null };
const CANCELLED: EntitlementOrg = { ...CLUB, subscriptionStatus: 'canceled' };
const LIVE = { status: 'active' };
const DONE = { status: 'completed' };

const access = (role: OrgRole, org: EntitlementOrg = CLUB, season?: { status: string }, capabilities: Record<string, boolean> | null = null) =>
  houseLeagueAccess({ role, capabilities }, org, season);

const pick = (a: HouseLeagueAccess) => ({
  read: a.read, readMoney: a.readMoney, run: a.run, changeStatus: a.changeStatus,
  register: a.register, takeFees: a.takeFees, email: a.email,
});
const ALL = { read: true, readMoney: true, run: true, changeStatus: true, register: true, takeFees: true, email: true };
const NONE = { read: false, readMoney: false, run: false, changeStatus: false, register: false, takeFees: false, email: false };

describe('3 · who can do what (frame F, Q17)', () => {
  for (const role of ['owner', 'admin', 'league_admin'] as const) {
    it(`${role} runs the league — the club admin is a league admin (Q17)`, () => assert.deepEqual(pick(access(role, CLUB, LIVE)), ALL));
  }
  it('the registrar works registrations, fees and email, and reads the rest', () => {
    assert.deepEqual(pick(access('league_registrar', CLUB, LIVE)), { ...ALL, run: false, changeStatus: false });
  });
  it('the treasurer reads Money and nothing else in house league', () => {
    assert.deepEqual(pick(access('treasurer', CLUB, LIVE)), { ...NONE, readMoney: true });
  });
  it('the treasurer reads no Money where the club runs no house league', () => {
    const tournamentOnly: EntitlementOrg = { ...CLUB, planId: 'tournament_plus' };
    assert.equal(access('treasurer', tournamentOnly).readMoney, false);
  });
  it('the treasurer reads no Money on a plan without Accounting (League)', () => {
    assert.equal(access('treasurer', LEAGUE).readMoney, false);
  });
  it('staff and a coach have no access; a staff member granted House league reads it', () => {
    assert.deepEqual(pick(access('staff', CLUB, LIVE)), NONE);
    assert.deepEqual(pick(access('coach', CLUB, LIVE)), NONE);
    assert.deepEqual(pick(access('staff', CLUB, LIVE, { module_house_league: true })), { ...NONE, read: true, readMoney: true });
  });
  it('a club admin whose House league was switched off reads nothing in it', () => {
    assert.deepEqual(pick(access('admin', CLUB, LIVE, { module_house_league: false })), { ...NONE, readMoney: true });
  });
  it('a cancelled club opens nothing, whatever the role', () => {
    for (const role of ['owner', 'admin', 'league_admin', 'league_registrar', 'treasurer'] as const) {
      assert.deepEqual(pick(access(role, CANCELLED, LIVE)), NONE, role);
    }
  });
});

describe('3b · a finished season reads in place, locked, Money and Email families open (Q16; email: owner 2026-10-24)', () => {
  it('completed and archived are finished; nothing else is', () => {
    assert.ok(isFinishedLeagueSeason({ status: 'completed' }));
    assert.ok(isFinishedLeagueSeason({ status: 'archived' }));
    for (const status of ['draft', 'registration_open', 'registration_closed', 'active']) {
      assert.equal(isFinishedLeagueSeason({ status }), false, status);
    }
    assert.equal(isFinishedLeagueSeason(null), false);
  });
  for (const role of ['owner', 'admin', 'league_admin'] as const) {
    it(`${role}: reads, takes fees, emails families and can reopen or archive; edits nothing`, () => {
      const a = access(role, CLUB, DONE);
      assert.equal(a.finished, true);
      assert.deepEqual(pick(a), { ...ALL, run: false, register: false });
    });
  }
  it('the registrar still takes fees and emails families on a finished season; registrations are locked', () => {
    assert.deepEqual(pick(access('league_registrar', CLUB, DONE)),
      { ...NONE, read: true, readMoney: true, takeFees: true, email: true });
  });
  it('the treasurer still reads Money on a finished season', () => {
    assert.equal(access('treasurer', CLUB, DONE).readMoney, true);
  });
  it('no season (creating one) is never finished', () => {
    assert.equal(access('owner', CLUB).run, true);
    assert.equal(access('owner', CLUB).finished, false);
  });
});
