/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A FINAL SCORE NOTIFIES NO FAMILY** (owner ruling 2026-10-06).
 *
 * A final score used to send connected families a message — from the bench console's End game AND
 * from a score typed on the Schedule. It went, for every path at once: a result is something a
 * family looks up, not something they act on. Families still hear about the changes they must act
 * on — a game moved, cancelled, or back on.
 *
 * Why a guard and not just the deletion: the two paths are the trap. Putting the message back on
 * ONE of them — the obvious "fix" for a coach who asks why families weren't told — rebuilds the
 * backwards rule this ruling refused: families hearing about a result only when the coach entered
 * it the slow way. A score message, if one is ever wanted, comes back as a decision of its own, and
 * this file is edited in that same commit.
 *
 * Source scan, so it proves only what it can read: no family-message kind for a score exists, the
 * route never maps a score onto one, and the console no longer promises one.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p: string) => readFileSync(p, 'utf8');
const NOTIFIER = read('lib/family-notify.ts');
const EVENTS_ROUTE = read('app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts');
const CONSOLE = read('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx');

describe('A final score notifies no family', () => {
  it('the family notifier has no score kind', () => {
    const union = NOTIFIER.match(/export type FamilyGameUpdateKind\s*=\s*([^;]+);/);
    assert.ok(union, 'FamilyGameUpdateKind is still declared in lib/family-notify.ts');
    assert.doesNotMatch(union[1], /score|result/i, 'no family-message kind for a score or a result');
  });

  it('the events route decides the family message from status, time and place only', () => {
    const block = EVENTS_ROUTE.match(/const familyUpdateKind\s*=([\s\S]*?);\r?\n/);
    assert.ok(block, 'the route still computes familyUpdateKind');
    assert.doesNotMatch(block[1], /teamScore|opponentScore|result/, 'a score field never picks a family message');
    // Nor a second call site that names a score kind outright, outside that one expression.
    assert.doesNotMatch(EVENTS_ROUTE, /final_score/, 'no score message is sent from anywhere in the route');
  });

  it('the End game sheet names the act, not a notification', () => {
    assert.match(CONSOLE, /endSaving \? 'Ending…' : 'End game'/);
    assert.doesNotMatch(CONSOLE, /notify families|one notification|sends families/i);
  });
});
