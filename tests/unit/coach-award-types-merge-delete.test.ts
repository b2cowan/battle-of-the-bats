/**
 * Awards Join the One Tag Idiom, Part B (plan `COACH_AWARDS_ONE_TAG_IDIOM_PLAN.md`, Phases 2–3):
 * the award-TYPE library (MVP, Best Hitter, the chips a coach invents) gets the same door/drawer/
 * merge/shelf pattern every other tag vocabulary already has.
 *
 * R5's pairing rule (`resolveAwardTypeMergeCollisions`) is pure and unit-tested directly here —
 * the SQL RPC that actually performs the merge (`merge_rep_team_award_types`, migration 289) is
 * typecheck-blind, so a live-DB proof belongs in the owner walk, not a unit test that can't run
 * it. Everything else here pins structural rules by source, the same pattern
 * `coach-award-edit.test.ts` used for Part A.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { resolveAwardTypeMergeCollisions } from '../../lib/rep-award-occasion';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');

describe('resolveAwardTypeMergeCollisions — R5 pairing rule', () => {
  it('pairs a loser and winner award on the SAME game', () => {
    const loser = [{ id: 'l1', playerId: 'blake', eventId: 'g1', tournamentLabel: null, awardedAt: '2026-04-16' }];
    const winner = [{ id: 'w1', playerId: 'blake', eventId: 'g1', tournamentLabel: null, awardedAt: '2026-04-16' }];
    assert.deepEqual(resolveAwardTypeMergeCollisions(loser, winner), [{ loserAwardId: 'l1', winnerAwardId: 'w1' }]);
  });

  it('does not pair the same player on a DIFFERENT game', () => {
    const loser = [{ id: 'l1', playerId: 'blake', eventId: 'g1', tournamentLabel: null, awardedAt: '2026-04-16' }];
    const winner = [{ id: 'w1', playerId: 'blake', eventId: 'g2', tournamentLabel: null, awardedAt: '2026-04-23' }];
    assert.deepEqual(resolveAwardTypeMergeCollisions(loser, winner), []);
  });

  it('does not pair two DIFFERENT players on the same game', () => {
    const loser = [{ id: 'l1', playerId: 'blake', eventId: 'g1', tournamentLabel: null, awardedAt: '2026-04-16' }];
    const winner = [{ id: 'w1', playerId: 'sam', eventId: 'g1', tournamentLabel: null, awardedAt: '2026-04-16' }];
    assert.deepEqual(resolveAwardTypeMergeCollisions(loser, winner), []);
  });

  it('pairs two GENERAL awards on the same date with the same label', () => {
    const loser = [{ id: 'l1', playerId: 'blake', eventId: null, tournamentLabel: 'Milton Classic', awardedAt: '2026-06-02' }];
    const winner = [{ id: 'w1', playerId: 'blake', eventId: null, tournamentLabel: 'Milton Classic', awardedAt: '2026-06-02' }];
    assert.deepEqual(resolveAwardTypeMergeCollisions(loser, winner), [{ loserAwardId: 'l1', winnerAwardId: 'w1' }]);
  });

  it('does NOT pair two general awards on the same date with DIFFERENT labels — both survive', () => {
    const loser = [{ id: 'l1', playerId: 'blake', eventId: null, tournamentLabel: 'Milton Classic', awardedAt: '2026-06-02' }];
    const winner = [{ id: 'w1', playerId: 'blake', eventId: null, tournamentLabel: 'Summer Classic', awardedAt: '2026-06-02' }];
    assert.deepEqual(resolveAwardTypeMergeCollisions(loser, winner), []);
  });

  it('a game-linked award never collides with a general one, even on the same date', () => {
    const loser = [{ id: 'l1', playerId: 'blake', eventId: 'g1', tournamentLabel: null, awardedAt: '2026-06-02' }];
    const winner = [{ id: 'w1', playerId: 'blake', eventId: null, tournamentLabel: null, awardedAt: '2026-06-02' }];
    assert.deepEqual(resolveAwardTypeMergeCollisions(loser, winner), []);
  });

  it('every non-colliding loser award moves untouched (no false positives across a mixed set)', () => {
    const loser = [
      { id: 'l1', playerId: 'blake', eventId: 'g1', tournamentLabel: null, awardedAt: '2026-04-16' }, // collides
      { id: 'l2', playerId: 'blake', eventId: 'g2', tournamentLabel: null, awardedAt: '2026-04-23' }, // moves
      { id: 'l3', playerId: 'sam', eventId: 'g1', tournamentLabel: null, awardedAt: '2026-04-16' },   // moves (different player)
    ];
    const winner = [{ id: 'w1', playerId: 'blake', eventId: 'g1', tournamentLabel: null, awardedAt: '2026-04-16' }];
    assert.deepEqual(resolveAwardTypeMergeCollisions(loser, winner), [{ loserAwardId: 'l1', winnerAwardId: 'w1' }]);
  });
});

describe('the read-time re-seed trap is closed', () => {
  const db = read('lib/db.ts');
  it('ensureRepTeamAwardTypesSeeded no longer exists — delete would otherwise be undone on next read', () => {
    assert.doesNotMatch(db, /ensureRepTeamAwardTypesSeeded/);
  });
  it('createRepTeam seeds the starter library once, at creation', () => {
    const start = db.indexOf('export async function createRepTeam(');
    const body = db.slice(start, start + 2200);
    assert.match(body, /STARTER_AWARD_TYPES/);
    assert.match(body, /rep_team_award_types/);
  });
});

describe('the award-types GET route speaks the same wire shape as every other tag library', () => {
  const route = read('app/api/coaches/[orgSlug]/teams/[teamId]/award-types/route.ts');
  it('returns `{ tags }`, not `{ awardTypes }` — TagManagerList/TeamTagShelf self-fetch this basePath', () => {
    assert.match(route, /NextResponse\.json\(\{\s*tags\s*\}\)/);
  });
  it('carries a team-scoped, all-time usage count per type', () => {
    assert.match(route, /getRepTeamAwardTypeUsageCounts/);
  });
  it('no longer seeds on read', () => {
    assert.doesNotMatch(route, /ensureRepTeamAwardTypesSeeded/);
  });
});

describe('the award-types [typeId] route — DELETE (R2)', () => {
  const route = read('app/api/coaches/[orgSlug]/teams/[teamId]/award-types/[typeId]/route.ts');
  it('exports DELETE', () => {
    assert.match(route, /export const DELETE/);
  });
  it('answers an in-use type with 409 and the given-count sentence, not a silent refusal', () => {
    const idx = route.indexOf("code === '23503'");
    const block = route.slice(idx, idx + 400);
    assert.match(block, /status:\s*409/);
    assert.match(block, /merge it into another award or retire it instead/);
  });
});

describe('the award-types merge route (R5)', () => {
  const route = read('app/api/coaches/[orgSlug]/teams/[teamId]/award-types/merge/route.ts');
  it('exports a GET preview and a POST merge', () => {
    assert.match(route, /export const GET/);
    assert.match(route, /export const POST/);
  });
  it('POST reads winnerTagId/loserTagId — the same body shape TagManagerList.doMerge sends everywhere', () => {
    assert.match(route, /winnerTagId/);
    assert.match(route, /loserTagId/);
  });
});

describe('TagManagerList — the merge-or-retire policy (R2)', () => {
  const list = read('components/coaches/TagManagerList.tsx');
  it('exports the TagManagerPolicy shape', () => {
    assert.match(list, /export interface TagManagerPolicy/);
    assert.match(list, /inUseRemove\?:\s*'orphan'\s*\|\s*'merge-or-retire'/);
  });
  it('offers Retire and Merge instead on a used chip, under the merge-or-retire policy', () => {
    assert.match(list, /Retire\s*<\/button>/);
    assert.match(list, /Merge instead/);
  });
  it('an unused chip still deletes outright, no merge/retire offered', () => {
    assert.match(list, /It hasn&rsquo;t been given yet, so nothing else changes\./);
  });
  it('renders a Retired group with Restore', () => {
    assert.match(list, /Retired \(\{retired\.length\}\)/);
    assert.match(list, /RotateCcw/);
  });
  it('the icon policy mounts AwardIconPicker in the rename row', () => {
    assert.match(list, /hasIcon && iconPickerOpen/);
  });
});

describe('GiveAwardModal — the door', () => {
  const modal = read('components/coaches/GiveAwardModal.tsx');
  it('renders "Manage awards…" beside "+ New"', () => {
    assert.match(modal, /AWARD_TAG_MANAGE\.door/);
    assert.match(modal, /\+ New/);
  });
  it('opens TagManagerDrawer with the merge-or-retire policy', () => {
    assert.match(modal, /TagManagerDrawer/);
    assert.match(modal, /inUseRemove:\s*'merge-or-retire'/);
  });
});

describe('TeamTagShelf — the Awards row', () => {
  const shelf = read('components/coaches/TeamTagShelf.tsx');
  it('lists an awards library with the merge-or-retire, icon policy', () => {
    const idx = shelf.indexOf("key: 'awards'");
    assert.ok(idx > -1, 'no awards entry in LIBRARIES');
    const block = shelf.slice(idx, idx + 300);
    assert.match(block, /icon:\s*true/);
    assert.match(block, /inUseRemove:\s*'merge-or-retire'/);
  });
});

describe('the retired manager modal is gone', () => {
  it('AwardTypeManagerModal.tsx no longer exists', () => {
    assert.equal(fs.existsSync(path.join(REPO, 'components/coaches/AwardTypeManagerModal.tsx')), false);
  });
  it('nothing still imports it', () => {
    const grepTargets = [
      'app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx',
      'components/coaches/GiveAwardModal.tsx',
    ];
    for (const f of grepTargets) assert.doesNotMatch(read(f), /AwardTypeManagerModal/);
  });
  it('the report panel no longer mentions "Manage award types"', () => {
    assert.doesNotMatch(read('app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx'), /Manage award types/);
  });
});
