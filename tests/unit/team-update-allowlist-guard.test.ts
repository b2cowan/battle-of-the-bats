/**
 * THE TEAMS SCREEN'S UPDATE WRITES ONLY WHAT THE TEAMS SCREEN EDITS (security fix, 2026-10-16).
 *
 * The teams route's update branch wrote every key it was sent into `teams` and checked the organization against the
 * team's CURRENT tournament only: an organizer could move a team into another organization's event, point it at
 * another event's pool, or stamp the check-in columns (FREE_TOURNAMENT_TIER_REVIEW_PLAN.md §12, "Pre-existing").
 * Its promote action took a slot id nobody checked, and its swap checked one of its two slots.
 *
 * These cases pin: every key a screen sends is admitted (read from the screens' own source, so a new field on the
 * team record fails here rather than failing every save); an unknown key refuses; a pool outside the team's division
 * refuses; the invite-only refusals still fire on the checked columns; and the route never goes back to spreading
 * the request.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_UPDATE_COLUMNS, TEAM_UPDATE_REFUSALS, emailsToCheck, poolIdsToCheck, poolOutsideDivision, readTeamUpdate,
  readTeamUpdates, type TeamUpdateItem,
} from '../../lib/team-update-allowlist';
import { teamUpdateAllowed } from '../../lib/invite-only-event';
import { readCode } from './_source-code.ts';

const TEAM = '11111111-1111-4111-8111-111111111111';
const TEAM_2 = '22222222-2222-4222-8222-222222222222';
const POOL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROUTE = 'app/api/admin/teams/route.ts';

function columns(raw: Record<string, unknown>) {
  const read = readTeamUpdate(raw);
  assert.ok(read.ok, `admitted: ${JSON.stringify(raw)} — ${read.ok ? '' : read.error}`);
  return read.updates;
}

function refusal(raw: unknown): string {
  const read = readTeamUpdate(raw);
  assert.ok(!read.ok, `refused: ${JSON.stringify(raw)}`);
  return read.error;
}

describe('the list is what the screens send', () => {
  it('is exactly the eight keys — a new one is a decision, made here (the paid figures left in mig 345: a payment is recorded)', () => {
    assert.deepEqual(Object.keys(TEAM_UPDATE_COLUMNS).sort(), [
      'adminNotes', 'coach', 'email', 'name', 'paymentStatus', 'poolId', 'seed', 'status',
    ]);
  });

  it('admits every key the team record window sends (TeamRecordUpdates, read from its source)', () => {
    const src = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamRecord.tsx');
    const type = src.match(/export type TeamRecordUpdates = Partial<\{([\s\S]*?)\}>/);
    assert.ok(type, 'TeamRecordUpdates is still declared');
    const keys = [...type[1].matchAll(/(\w+)\s*:/g)].map(m => m[1]);
    assert.ok(keys.length >= 6, `read the type's keys (${keys.join(', ')})`);
    assert.ok(!keys.includes('depositPaid') && !keys.includes('totalPaid'), 'the record window never types a paid figure');
    for (const key of keys) assert.ok(Object.hasOwn(TEAM_UPDATE_COLUMNS, key), `the team record sends "${key}"`);
  });

  it('admits every key the Teams page sends (each patch, each pool move)', () => {
    const src = readCode('app/[orgSlug]/admin/tournaments/registrations/page.tsx');
    const sent = new Set<string>();
    for (const m of src.matchAll(/\bpatch\([^,]+,\s*\{([^}]*)\}/g)) for (const k of m[1].matchAll(/(\w+)\s*:/g)) sent.add(k[1]);
    for (const m of src.matchAll(/\bupdates:\s*\{([^}]*)\}/g)) for (const k of m[1].matchAll(/(\w+)\s*:/g)) sent.add(k[1]);
    for (const m of src.matchAll(/\bupdates:\s*\{\s*(\w+)\s*\}/g)) sent.add(m[1]); // `updates: { poolId }` shorthand
    for (const key of ['status', 'paymentStatus', 'poolId']) assert.ok(sent.has(key), `found the page's "${key}" payload`);
    for (const key of sent) assert.ok(Object.hasOwn(TEAM_UPDATE_COLUMNS, key), `the Teams page sends "${key}"`);
  });

  it('turns the real payloads into the columns they always wrote', () => {
    assert.deepEqual(columns({ name: '  Riverdale Rays ' }), { name: 'Riverdale Rays' });           // rename
    assert.deepEqual(columns({ seed: 3 }), { seed: 3 });                                              // seed
    assert.deepEqual(columns({ seed: null }), { seed: null });                                        // clear seed
    assert.deepEqual(columns({ seed: 0 }), { seed: null });                                           // as before: out of range clears
    assert.deepEqual(columns({ poolId: POOL }), { pool_id: POOL });                                   // pool move
    assert.deepEqual(columns({ poolId: '' }), { pool_id: null });                                     // out of a pool
    assert.deepEqual(columns({ status: 'accepted' }), { status: 'accepted' });                        // accept
    assert.deepEqual(columns({ status: 'rejected' }), { status: 'rejected' });                        // reject
    assert.deepEqual(columns({ paymentStatus: 'paid' }), { payment_status: 'paid' });                 // mark paid
    assert.deepEqual(columns({ paymentStatus: 'pending' }), { payment_status: 'pending' });           // mark unpaid
    assert.deepEqual(columns({ adminNotes: '' }), { admin_notes: '' });
    assert.deepEqual(columns({ coach: 'Sam Lee' }), { coach: 'Sam Lee' });
    assert.deepEqual(columns({}), {});
  });

  it('stores absence the way every other write path does, and the address as registration does', () => {
    assert.deepEqual(columns({ coach: '   ' }), { coach: null });
    assert.deepEqual(columns({ email: ' Coach@Club.CA ' }), { email: 'coach@club.ca' });
    assert.deepEqual(columns({ email: '' }), { email: '' });
  });
});

describe('anything else refuses the whole request', () => {
  it('a column the screen never edits', () => {
    for (const key of [
      'tournament_id', 'tournamentId', 'division_id', 'divisionId', 'slot_id', 'slotId', 'pool_id', 'id',
      'checked_in_by_user_id', 'checked_in_by_name', 'checked_in_at', 'check_in_status', 'checkInStatus',
      'registered_at', 'roster_submitted_at', 'roster_confirmed_at', 'payment_collected_at', 'coach_email',
      'waitlist_position', 'waitlistPosition', 'payment_status', 'deposit_paid', 'total_paid', 'admin_notes',
      // Mig 345: the paid figures are the database's sum of the team's payments, never typed through this route.
      'depositPaid', 'totalPaid', 'fee_book_baseline', 'fee_changed_by',
      '__proto__', 'constructor',
    ]) {
      assert.equal(refusal({ name: 'Rays', [key]: 'x' }), TEAM_UPDATE_REFUSALS.unknownKey(key), key);
    }
    // A JSON body can carry an own "__proto__" key; it is refused, never merged into the prototype.
    assert.equal(refusal(JSON.parse('{"__proto__": {"tournament_id": "x"}}')), TEAM_UPDATE_REFUSALS.unknownKey('__proto__'));
  });

  it('one bad team in a bulk change refuses all of them', () => {
    const read = readTeamUpdates({ updates: [{ id: TEAM, updates: { poolId: POOL } }, { id: TEAM_2, updates: { tournament_id: TEAM } }] });
    assert.deepEqual(read, { ok: false, error: TEAM_UPDATE_REFUSALS.unknownKey('tournament_id') });
  });

  it('a value the screen would never send', () => {
    assert.equal(refusal({ name: '   ' }), TEAM_UPDATE_REFUSALS.name);
    assert.equal(refusal({ name: 7 }), TEAM_UPDATE_REFUSALS.name);
    assert.equal(refusal({ email: 'not-an-address' }), TEAM_UPDATE_REFUSALS.email);
    assert.equal(refusal({ email: 42 }), TEAM_UPDATE_REFUSALS.email);
    assert.equal(refusal({ status: 'checked_in' }), TEAM_UPDATE_REFUSALS.status);
    assert.equal(refusal({ paymentStatus: 'partial' }), TEAM_UPDATE_REFUSALS.paymentStatus);
    assert.equal(refusal({ poolId: 'pool-1' }), TEAM_UPDATE_REFUSALS.pool);
    assert.equal(refusal({ poolId: 5 }), TEAM_UPDATE_REFUSALS.pool);
    assert.equal(refusal({ coach: { first: 'Sam' } }), TEAM_UPDATE_REFUSALS.text);
    assert.equal(refusal({ adminNotes: ['x'] }), TEAM_UPDATE_REFUSALS.text);
    assert.equal(refusal(['name']), TEAM_UPDATE_REFUSALS.noUpdates);
  });

  it('a body of the wrong shape, or a team id that is not an id', () => {
    assert.deepEqual(readTeamUpdates({}), { ok: false, error: TEAM_UPDATE_REFUSALS.noUpdates });
    assert.deepEqual(readTeamUpdates({ updates: [] }), { ok: false, error: TEAM_UPDATE_REFUSALS.noUpdates });
    assert.deepEqual(readTeamUpdates({ ids: [], updates: { name: 'x' } }), { ok: false, error: TEAM_UPDATE_REFUSALS.noUpdates });
    assert.deepEqual(readTeamUpdates({ ids: TEAM, updates: { name: 'x' } }), { ok: false, error: TEAM_UPDATE_REFUSALS.badTeam });
    assert.deepEqual(readTeamUpdates({ ids: ['x),id.not.is.null'], updates: { name: 'x' } }), { ok: false, error: TEAM_UPDATE_REFUSALS.badTeam });
    assert.deepEqual(readTeamUpdates({ updates: [{ updates: { name: 'x' } }] }), { ok: false, error: TEAM_UPDATE_REFUSALS.badTeam });
    assert.deepEqual(readTeamUpdates({ updates: ['x'] }), { ok: false, error: TEAM_UPDATE_REFUSALS.badTeam });
  });

  it('both shapes the screens send are read', () => {
    assert.deepEqual(readTeamUpdates({ ids: [TEAM, TEAM_2], updates: { poolId: POOL } }), {
      ok: true, items: [{ id: TEAM, updates: { pool_id: POOL } }, { id: TEAM_2, updates: { pool_id: POOL } }],
    });
    assert.deepEqual(readTeamUpdates({ updates: [{ id: TEAM, updates: { poolId: POOL } }] }), {
      ok: true, items: [{ id: TEAM, updates: { pool_id: POOL } }],
    });
  });
});

describe('a pool is the team’s own division’s, in its own tournament', () => {
  const teams = new Map([
    [TEAM, { tournament_id: 'T1', division_id: 'D1' }],
    [TEAM_2, { tournament_id: 'T1', division_id: null }],
  ]);
  const move = (id: string, pool: string | null): TeamUpdateItem[] => [{ id, updates: { pool_id: pool } }];

  it('admits the team’s own division’s pool, and taking it out of a pool', () => {
    assert.equal(poolOutsideDivision(move(TEAM, POOL), teams, new Map([[POOL, { division_id: 'D1', tournament_id: 'T1' }]])), false);
    assert.equal(poolOutsideDivision(move(TEAM, null), teams, new Map()), false);
  });

  it('refuses another organization’s pool, another event’s, another division’s, and one that does not exist', () => {
    assert.equal(poolOutsideDivision(move(TEAM, POOL), teams, new Map([[POOL, { division_id: 'D9', tournament_id: 'T9' }]])), true);
    assert.equal(poolOutsideDivision(move(TEAM, POOL), teams, new Map([[POOL, { division_id: 'D1', tournament_id: 'T9' }]])), true);
    assert.equal(poolOutsideDivision(move(TEAM, POOL), teams, new Map([[POOL, { division_id: 'D2', tournament_id: 'T1' }]])), true);
    assert.equal(poolOutsideDivision(move(TEAM, POOL), teams, new Map()), true);
    assert.equal(poolOutsideDivision(move(TEAM_2, POOL), teams, new Map([[POOL, { division_id: 'D1', tournament_id: 'T1' }]])), true);
  });

  it('the route reads each pool an update names, and only those', () => {
    const items: TeamUpdateItem[] = [{ id: TEAM, updates: { pool_id: POOL } }, { id: TEAM_2, updates: { pool_id: null } }, { id: TEAM, updates: { pool_id: POOL } }];
    assert.deepEqual(poolIdsToCheck(items), [POOL]);
    assert.deepEqual(emailsToCheck([{ id: TEAM, updates: { email: 'a@b.ca' } }, { id: TEAM_2, updates: { email: '' } }]), ['a@b.ca']);
  });
});

describe('the invite-only refusals still fire, on the checked columns', () => {
  it('no payment moves on the free plan; a paid plan is unchanged', () => {
    for (const raw of [{ paymentStatus: 'paid' }, { paymentStatus: 'pending' }]) {
      assert.equal(teamUpdateAllowed('tournament', 'accepted', columns(raw)), false, JSON.stringify(raw));
      assert.equal(teamUpdateAllowed('tournament_plus', 'accepted', columns(raw)), true, JSON.stringify(raw));
    }
  });

  it('an accepted team on an invite-only event is not declined; the screen’s edits pass', () => {
    assert.equal(teamUpdateAllowed('tournament', 'accepted', columns({ status: 'rejected' })), false);
    assert.equal(teamUpdateAllowed('tournament', 'pending', columns({ status: 'accepted' })), true);
    assert.equal(teamUpdateAllowed('tournament', 'accepted', columns({ name: 'Rays', poolId: POOL, seed: 2, adminNotes: 'x' })), true);
  });
});

describe('the route reads the request through the list, and nowhere else', () => {
  const route = readCode(ROUTE);
  // The update branch: from the list's read to the end of POST.
  const updateBranch = route.slice(route.indexOf('readTeamUpdates(body)'), route.indexOf('export const DELETE'));
  const promote = route.slice(route.indexOf("body.action === 'promote-from-waitlist'"), route.indexOf("body.action === 'swap-slots'"));
  const swap = route.slice(route.indexOf("body.action === 'swap-slots'"), route.indexOf("body.action === 'create-team'"));
  /** Where `needle` is — found, or the assertion fails (an ordering check never passes on a missing line). */
  const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };

  it('the slices are the code they name', () => {
    assert.ok(updateBranch.length > 2000 && promote.length > 500 && swap.length > 500, 'each slice found');
  });

  it('the update branch is built from readTeamUpdates and refuses what it refuses', () => {
    assert.match(updateBranch, /^readTeamUpdates\(body\);\s*if \(!read\.ok\) return badUpdate\(read\.error\);\s*const items = read\.items;/);
  });

  it('never reads the request again after the list has read it — by any spelling', () => {
    // `body` appears in the update branch exactly once: the list's read. Object.assign, a cast, a bracket, a
    // destructure or a spread of the request all need the word. (A notice's own `body:` field is not the request.)
    assert.deepEqual([...updateBranch.matchAll(/\bbody\b(?!\s*:)/g)].map(m => m.index), ['readTeamUpdates('.length],
      'the only `body` is readTeamUpdates(body)');
    assert.doesNotMatch(route, /body\.updates|body\.ids/, 'the body’s updates are read only by lib/team-update-allowlist.ts');
    assert.doesNotMatch(route, /\.\.\.\s*body\b/, 'no spread of the request body anywhere in the route');
    assert.doesNotMatch(route, /\.(update|insert|upsert)\(\s*body\b/, 'no write of the request body');
  });

  it('the write is the checked columns, and nothing else joins it — never a paid figure (mig 345)', () => {
    assert.equal([...route.matchAll(/\.\.\.\s*item\.updates\b/g)].length, 2, 'one checked copy and one for the payment actor');
    assert.match(updateBranch, /const dbUpdates: TeamUpdateColumns & Record<string, unknown> = \{ \.\.\.item\.updates \};/);
    assert.deepEqual([...updateBranch.matchAll(/Object\.assign\(([^)]*)/g)].map(m => m[1]), [],
      'nothing is merged into the write: a "Mark paid" is a recorded payment, made by the database');
    // A READ of total_paid is fine (the "unpaid" refusal looks at it); a write or a key is not.
    assert.doesNotMatch(updateBranch, /\b(deposit_paid|total_paid)\s*:|\.(deposit_paid|total_paid)\s*=(?!=)|markPaidInFullPatch/,
      'the route writes no paid figure and stamps none');
    assert.match(updateBranch, /if \(markedByPayment\.has\(item\.id\)\) delete dbUpdates\.payment_status;/,
      'a status a payment already moved is dropped from the copy, never written twice');
    assert.doesNotMatch(updateBranch, /\bdbUpdates(\.\w+|\[[^\]]+\])\s*=(?!=)/, 'no key assigned onto the write');
    assert.doesNotMatch(updateBranch, /\bitems\s*\[|\bitem\.updates(\.\w+|\[[^\]]+\])\s*=(?!=)/, 'the checked items are never changed after the list');
    assert.match(updateBranch, /const stampedUpdates = paymentChanged \? \{ \.\.\.item\.updates, fee_changed_by: ctx\.user\.id \} : item\.updates;/,
      'the payment actor is added to a new object, after the request allowlist');
  });

  it('each check refuses, and runs before the write', () => {
    const write = at(updateBranch, ".from('teams')\n        .update(stampedUpdates)");
    for (const step of [
      'return badUpdate(TEAM_UPDATE_REFUSALS.oneTournament);',
      'if (poolOutsideDivision(items, currentById, pools)) return badUpdate(TEAM_UPDATE_REFUSALS.pool);',
      'if (await isPlatformAdminEmail(email)) return badUpdate(TEAM_UPDATE_REFUSALS.staffEmail);',
      'if (!teamUpdateAllowed(ctx.org.planId, current?.status, item.updates ?? {})) return inviteOnlyRefusal();',
      "const paid = await payTeamDue({ teamId: item.id, actorId: ctx.user.id, scope: 'all' });",
    ]) assert.ok(at(updateBranch, step) < write, `${step} runs before the write`);
    assert.match(updateBranch, /if \(new Set\([^;]*\.map\(t => t\.tournament_id\)\)\.size > 1\) \{\s*return badUpdate\(TEAM_UPDATE_REFUSALS\.oneTournament\);/);
  });

  it('promote takes no slot from the request: its spot is the division’s lowest open one', () => {
    assert.equal([...promote.matchAll(/\bbody\b/g)].length, 2, '`body` appears only in the action test and the teamId read');
    assert.match(promote, /^body\.action === 'promote-from-waitlist'\) \{\s*const \{ teamId \} = body as \{ teamId: string \};/);
    assert.match(promote, /const slotId: string = sorted\[0\]\.id;/);
    assert.doesNotMatch(promote, /\bslotId\s*=(?!=)/, 'the slot is never reassigned');
  });

  it('swap keeps both slots in one division, refused after the organization check and before any write', () => {
    const check = at(swap, 'if (slotB.tournament_id !== slotA.tournament_id || slotB.division_id !== slotA.division_id) {');
    assert.match(swap, /if \(slotB\.tournament_id !== slotA\.tournament_id \|\| slotB\.division_id !== slotA\.division_id\) \{\s*return new Response/);
    assert.ok(at(swap, 'if (wrongOrg) return wrongOrg;') < check, 'the organization check answers first');
    assert.ok(check < at(swap, ".from('pool_slots').update("), 'checked before either slot is written');
  });
});
