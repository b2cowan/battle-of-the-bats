import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifiedChanges,
  noticeTargets,
  scheduleChangesFromRows,
  NIL_TEAM_ID,
  type ScheduleSnapshotRow,
} from '../../lib/schedule-change-classify.ts';

/**
 * F72 (Tournament admin redesign, Stage 3 defects pass): the bracket editor's save (`save-bracket`) rewrote existing
 * games' day, time and field and recorded NO change — teams following a published bracket were never told a
 * semi-final moved. The save now reads each updated game's row before the write, reads the committed rows after it,
 * and records the batch through the same recorder a single-game move uses. That recorder is server-only; these are
 * its pure halves, composed exactly as the route composes them.
 */

const SEMI: ScheduleSnapshotRow = {
  game_date: '2026-10-11', game_time: '13:00:00', location: 'Lions Park — Diamond 1',
  diamond_id: 'park', venue_facility_id: 'd1', status: 'scheduled', division_id: 'u13',
  home_team_id: 'hawks', away_team_id: 'owls',
};

function targetsFor(
  before: Record<string, ScheduleSnapshotRow>,
  after: Array<ScheduleSnapshotRow & { id: string }>,
  published: string[],
) {
  const changes = scheduleChangesFromRows(new Map(Object.entries(before)), after);
  return noticeTargets(classifiedChanges(changes), new Set(published));
}

describe('bracket save — a moved published game is recorded once, an unpublished one never (F72)', () => {
  it('a semi-final moved to 3:00 p.m. in a published division reaches both its teams, once', () => {
    const targets = targetsFor({ sf1: SEMI }, [{ ...SEMI, id: 'sf1', game_time: '15:00:00' }], ['u13']);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].change.gameId, 'sf1');
    assert.equal(targets[0].kind, 'moved');
    assert.deepEqual(targets[0].teamIds, ['hawks', 'owls']);
    // The follower is told what they last had reason to believe.
    assert.equal(targets[0].change.before.time, '13:00:00');
  });

  it('the same move in an unpublished division records nothing', () => {
    const targets = targetsFor({ sf1: SEMI }, [{ ...SEMI, id: 'sf1', game_time: '15:00:00' }], []);
    assert.deepEqual(targets, []);
  });

  it('a game the save left where it was records nothing', () => {
    const targets = targetsFor({ sf1: SEMI }, [{ ...SEMI, id: 'sf1' }], ['u13']);
    assert.deepEqual(targets, []);
  });

  it('a re-wired matchup (the editor cleared a resolved team) stays silent — a time told to the wrong team is false', () => {
    const targets = targetsFor({ sf1: SEMI }, [{ ...SEMI, id: 'sf1', game_time: '15:00:00', home_team_id: null }], ['u13']);
    assert.deepEqual(targets, []);
  });

  it('a game with no teams yet (Winner SF1 vs Winner SF2) reaches no one', () => {
    const final = { ...SEMI, home_team_id: null, away_team_id: NIL_TEAM_ID };
    const targets = targetsFor({ fin: final }, [{ ...final, id: 'fin', game_date: '2026-10-12' }], ['u13']);
    assert.equal(targets.length, 1);
    assert.deepEqual(targets[0].teamIds, []);
  });

  it('a played game the editor kept is bookkeeping, not news; a game inserted by the save has no "before"', () => {
    const played = { ...SEMI, status: 'completed' };
    assert.deepEqual(targetsFor({ sf1: played }, [{ ...played, id: 'sf1', game_time: '15:00:00' }], ['u13']), []);
    assert.deepEqual(targetsFor({}, [{ ...SEMI, id: 'new' }], ['u13']), []);
  });

  it('a venue change on the same day and time is a move; a cosmetic rewrite of the field label is not', () => {
    const moved = targetsFor({ sf1: SEMI }, [{ ...SEMI, id: 'sf1', venue_facility_id: 'd2', location: 'Lions Park — Diamond 2' }], ['u13']);
    assert.equal(moved.length, 1);
    const cosmetic = targetsFor({ sf1: SEMI }, [{ ...SEMI, id: 'sf1', location: 'Lions Park - Diamond 1' }], ['u13']);
    assert.deepEqual(cosmetic, []);
  });
});
