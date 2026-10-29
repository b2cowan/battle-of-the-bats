import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publicGameState, publicGameStatusLabel, type PublicGameState } from '../../lib/game-status.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';

/**
 * ONE STATUS HELPER for the frame-on Schedule and game page (Public tournament pages Stage 3, Part 1). It must say what
 * the old Schedule's badge said, so a family never reads a different result under the new look. The old rule
 * (ScheduleContent's `statusBadge`) is written out here as the table the helper is held to.
 */

const DATE = '2026-10-28';
const TIME = '17:00';
const start = Date.parse(zonedWallClockToUtc(DATE, TIME)!);
const during = new Date(start + 10 * 60_000);
const before = new Date(start - 3 * 3_600_000);
const after = new Date(start + 5 * 3_600_000);

/** ScheduleContent's badge, as it was: live → cancelled → completed → submitted (Unofficial only when finalization is
 *  required) → none. */
function oldBadge(status: string, live: boolean, requireFinalization: boolean): string | null {
  if (live) return 'Live';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'completed') return 'Final';
  if (status === 'submitted') return requireFinalization ? 'Unofficial' : 'Final';
  return null;
}
const wordOf = (s: PublicGameState) => (s === 'upcoming' ? null : publicGameStatusLabel(s));

describe('the one status helper reads as the old Schedule badge did', () => {
  for (const status of ['scheduled', 'submitted', 'completed', 'cancelled'] as const) {
    for (const requireFinalization of [true, false]) {
      for (const [when, now] of [['before the game', before], ['during the game', during], ['after the game', after]] as const) {
        it(`${status} · finalization ${requireFinalization ? 'required' : 'not required'} · ${when}`, () => {
          const state = publicGameState({ status, date: DATE, time: TIME }, requireFinalization, now);
          const live = state === 'live';
          assert.equal(live, status !== 'cancelled' && status !== 'completed' && now === during, 'live is the clock window');
          assert.equal(wordOf(state), oldBadge(status, live, requireFinalization));
        });
      }
    }
  }

  it('a game\'s own length decides how long it stays live', () => {
    const long = publicGameState({ status: 'scheduled', date: DATE, time: TIME, durationMinutes: 400 }, false, after);
    assert.equal(long, 'live');
  });

  // The ONE deliberate difference: the old badge drew nothing for a forfeit, though it is as final as a completed game
  // (it has a score and advances the bracket). The Overview and the game page already call it Final.
  it('a forfeit is a Final (the old Schedule drew no badge)', () => {
    assert.equal(wordOf(publicGameState({ status: 'forfeit', date: DATE, time: TIME }, true, after)), 'Final');
    assert.equal(oldBadge('forfeit', false, true), null);
  });
});
