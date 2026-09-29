import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode, functionBody } from './_source-code.ts';
import { askedByOf, historyStateOf } from '../../lib/team-move-state.ts';
import { NOTIFICATION_CATEGORY, NOTIFICATION_EVENT_LABELS, PUSH_DEFAULT_ON_EVENTS } from '../../lib/notification-labels.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE TEAM MOVE, APP SIDE (Club Tier Stage 2, B04 / Ask 2; owner ruling 2026-09-28).
 *
 * The database gate (`team-move-coverage.test.ts`) holds WHAT moves. This holds HOW it is allowed
 * to happen: the second yes moves the team with no FieldLogicHQ step, behind the safety that step
 * used to give — a typed confirmation checked on the server, the plan and the team place, the
 * Stripe cancel only AFTER the move committed, and bells that reach exactly the people who answer.
 * The Basic visibility link is retired: nothing writes one again. Guards read CODE (comments
 * stripped), so a paragraph explaining a rule cannot stand in for the rule.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const LIB = 'lib/team-ownership-transfer.ts';
const LINKS = 'lib/team-org-links.ts';
const CLUB_ROUTE = 'app/api/admin/org/team-links/route.ts';
const COACH_ROUTE = 'app/api/coaches/[orgSlug]/team-links/route.ts';
const REPO = path.join(import.meta.dirname, '..', '..');

function handler(code: string, verb: string): string {
  const start = code.indexOf(`export const ${verb} = `);
  if (start < 0) throw new Error(`export const ${verb} is gone — the guard reads it`);
  const rest = code.slice(start + 1);
  const end = rest.search(/\nexport (const|async function|function) /);
  return end > 0 ? rest.slice(0, end) : rest;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(path.join(REPO, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(REPO, rel)).isDirectory()) out.push(...filesUnder(rel));
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

describe('the second yes moves the team — behind the operator step’s safety', () => {
  const approve = functionBody(readCode(LIB), 'approveTeamMove');

  it('the typed team name is checked on the server BEFORE the move runs', () => {
    const check = approve.search(/teamNameConfirmed\(input\.confirmTeamName, team\.name\)/);
    const rpc = approve.search(/supabaseAdmin\.rpc\('move_team_into_club'/);
    assert.ok(check > 0 && rpc > check, 'confirmation first, then the move');
    assert.match(approve, /error: REFUSAL\.confirmMismatch, code: 'confirm_mismatch'/);
  });

  it('only the side that did NOT ask can give the second yes', () => {
    assert.match(approve, /if \(askedByOf\(link\) !== otherSide\(side\)\) return NOT_WAITING;/);
  });

  it('the club must carry Rep Teams, and the team place is checked (and re-counted inside the move)', () => {
    assert.match(approve, /if \(!clubHasRepTeams\(club\)\) return/);
    assert.match(approve, /places\.used >= places\.limit/);
    assert.match(approve, /p_team_cap: places\.limit/);
  });

  it('a link already moved answers "already moved" and cancels nothing a second time', () => {
    const early = approve.search(/if \(link\.status === 'org_owned'\) \{/);
    const cancel = approve.search(/cancelCoachSubscription\(/);
    assert.ok(early > 0 && cancel > early);
    assert.match(approve, /if \(moved\.alreadyMoved\) return \{ ok: true, moved, stripeCancellation: 'not_needed' \};/);
  });

  it('⚖ the coach’s own subscription is cancelled AFTER the move commits — never before, never refunded', () => {
    const rpc = approve.search(/supabaseAdmin\.rpc\('move_team_into_club'/);
    const cancel = approve.search(/await cancelCoachSubscription\(/);
    assert.ok(rpc > 0 && cancel > rpc, 'the move clears the Stripe ids first, so the webhook sends no "cancelled" email');
    const cancelFn = functionBody(readCode(LIB), 'cancelCoachSubscription');
    assert.match(cancelFn, /stripe\.subscriptions\.cancel\(subscriptionId\)/);
    assert.doesNotMatch(cancelFn, /refund|prorat|invoice_now/i, 'cancel now, no refund, no proration (owner ruling 2026-09-28)');
  });

  it('a cancel that fails does not undo the move, and FieldLogicHQ is told what to cancel by hand', () => {
    assert.match(approve, /stripeCancellation\.status === 'failed'[\s\S]*captureError\(/);
    assert.match(approve, /eventType: 'team_org_ownership_transfer_completed'/);
  });
});

describe('who is told — named, never "everyone in the org"', () => {
  const lib = readCode(LIB);

  it('every bell names its recipients (a club bell without userIds would reach every coach in the club)', () => {
    const calls = [...lib.matchAll(/await bell\(\{([\s\S]*?)\n  \}\);/g)].map(m => m[1]);
    assert.ok(calls.length >= 5, `expected the ask, moved and declined bells, found ${calls.length}`);
    for (const c of calls) assert.match(c, /userIds: /, c.slice(0, 120));
  });

  it('club recipients are the owner and admins; the coach side is the team’s head coaches', () => {
    assert.match(functionBody(lib, 'clubAdminUserIds'), /\.in\('role', \['owner', 'admin'\]\)/);
    assert.match(lib, /listActiveStaffUserIds\(workspace\.repTeamId, \{ headCoachesOnly: true \}\)/);
  });

  it('the two events are registered as lifecycle bells: the ask needs a decision, the answer is news', () => {
    assert.equal(NOTIFICATION_CATEGORY.team_move_requested, 'act');
    assert.equal(NOTIFICATION_CATEGORY.team_move_answered, 'know');
    for (const evt of ['team_move_requested', 'team_move_answered'] as const) {
      assert.ok(NOTIFICATION_EVENT_LABELS[evt], evt);
      assert.ok(PUSH_DEFAULT_ON_EVENTS.has(evt), evt);
    }
  });
});

describe('the Basic visibility link is retired (B12)', () => {
  it('nothing in the product writes a visibility or billing link any more', () => {
    const writers = [...filesUnder('lib'), ...filesUnder('app')]
      .filter(f => !f.includes('/help-content/'))
      .filter(f => /link_type:\s*'(visibility|billing)'/.test(readCode(f)));
    // lib/team-org-billing.ts is the retired billing takeover — self-described dead code, no route calls it.
    assert.deepEqual(writers.filter(f => f !== 'lib/team-org-billing.ts'), []);
  });

  it('a request is opened as a move request, by either side', () => {
    const open = functionBody(readCode(LIB), 'openRequest');
    assert.match(open, /status: 'ownership_pending',\s*link_type: 'ownership',\s*sharing_level: 'full_org_owned'/);
    assert.doesNotMatch(readCode(LIB), /Create the Basic visibility link/);
  });

  it('the old steps answer 410 in words, on both sides', () => {
    const club = handler(readCode(CLUB_ROUTE), 'POST');
    assert.match(club, /'invite_ownership', 'decline_ownership'\]\.includes\(action\)/);
    assert.match(club, /typeof body\.target === 'string'/);
    assert.match(club, /status: 410/);
    const coach = handler(readCode(COACH_ROUTE), 'PATCH');
    assert.match(coach, /'accept', 'request_ownership', 'accept_ownership', 'decline_ownership'/);
    assert.match(coach, /status: 410/);
  });

  it('the rows it left are history: an old visibility row reads as a retired link, never an open request', () => {
    assert.equal(askedByOf({ status: 'linked', link_type: 'visibility', approved_by_org_user_id: 'u', approved_by_team_user_id: 'v' }), null);
    assert.equal(historyStateOf({ status: 'linked', link_type: 'visibility' }), 'retired_link');
    assert.equal(historyStateOf({ status: 'requested', link_type: 'visibility' }), 'retired_link');
    assert.equal(historyStateOf({ status: 'org_owned', link_type: 'ownership' }), 'moved');
    assert.equal(historyStateOf({ status: 'revoked', link_type: 'ownership' }), 'withdrawn');
    assert.equal(askedByOf({ status: 'ownership_pending', link_type: 'ownership', approved_by_org_user_id: 'u', approved_by_team_user_id: null }), 'club');
    assert.equal(askedByOf({ status: 'ownership_pending', link_type: 'ownership', approved_by_org_user_id: null, approved_by_team_user_id: 'v' }), 'coach');
  });
});

describe('who may answer, and where', () => {
  it('the club side: the owner or an admin holding Rep Teams, on a plan that carries it', () => {
    const src = readCode(CLUB_ROUTE);
    const resolve = functionBody(src, 'resolveClub');
    assert.match(resolve, /ctx\.role !== 'owner' && ctx\.role !== 'admin'/);
    assert.match(resolve, /hasModuleEntitlement\(ctx\.org, 'module_rep_teams'\)/);
    assert.match(resolve, /hasCapability\(ctx\.role, ctx\.capabilities, 'module_rep_teams'\)/);
    for (const verb of ['GET', 'POST']) assert.match(handler(src, verb), /await resolveClub\(req\)/, verb);
  });

  it('the coach side: the head coach only, from the team membership, on every verb', () => {
    const src = readCode(COACH_ROUTE);
    for (const verb of ['GET', 'POST', 'PATCH']) assert.match(handler(src, verb), /denyUnless\(resolved\.isHeadCoach, HEAD_COACH_ONLY\)/, verb);
  });

  it('a link is answered only by its own club or its own team (another’s reads as not found)', () => {
    const scoped = functionBody(readCode(LIB), 'scopedLink');
    assert.match(scoped, /scope\.side === 'club' && link\.linked_org_id !== scope\.clubOrgId/);
    assert.match(scoped, /scope\.side === 'coach' && link\.team_workspace_id !== scope\.workspaceId/);
  });

  it('decline and withdraw never race a move: both are conditional on the request still being open', () => {
    const lib = readCode(LIB);
    for (const fn of ['declineTeamMove', 'withdrawTeamMove']) {
      assert.match(functionBody(lib, fn), /\.eq\('status', 'ownership_pending'\)/, fn);
    }
  });

  it('the club finds a coach by a lookup that scans every account (the old one read the first 1,000)', () => {
    assert.match(functionBody(readCode(LINKS), 'findCoachOwnTeamByEmail'), /findAuthUserIdByEmail\(email\)/);
    assert.doesNotMatch(readCode(LINKS), /listUsers\(\{ perPage: 1000 \}\)/);
  });
});

describe('no FieldLogicHQ step is left', () => {
  it('the operator’s completion route is gone, and its page keeps a read-only record', () => {
    assert.ok(!existsSync(path.join(REPO, 'app/api/platform-admin/team-ownership-transfers')), 'the completion route came back');
    const client = readCode('app/platform-admin/orgs/[id]/OrgDetailClient.tsx');
    assert.doesNotMatch(client, /team-ownership-transfers/);
    assert.doesNotMatch(client, /Complete Transfer/);
    assert.match(client, /teamMoves\.map\(move =>/);
  });

  it('the page moved under Rep Teams, and the old address forwards to it', () => {
    assert.match(readCode('app/[orgSlug]/admin/org/coaches-portal-links/page.tsx'), /redirect\(`\/\$\{orgSlug\}\/admin\/rep-teams\/bring-in`\)/);
    assert.match(readCode('lib/admin-kit-nav.ts'), /key: 'rt-bring-in'/);
    assert.doesNotMatch(readCode('lib/admin-kit-nav.ts'), /'org\/coaches-portal-links'/);
  });
});
