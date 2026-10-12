import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateScoredScheduleDrafts, type ScheduleDraftMatchup, type ScheduleDraftSlot } from '../../lib/schedule-generator.ts';

/**
 * "Final played on" (Tournament admin redesign, Stage 3 addendum, A64 — 2026-10-12): the Playoff generator holds the
 * final to one field. The engine treats any other slot as no fit, in every draft it tries.
 */
const slots = (times: string[], fields: Array<{ venueId: string; venueFacilityId: string | null; name: string }>): ScheduleDraftSlot[] =>
  times.flatMap(time => fields.map(f => ({ date: '2026-10-18', time, venueId: f.venueId, venueFacilityId: f.venueFacilityId, venueName: f.name })));
const LIONS = { venueId: 'lions', venueFacilityId: 'lions-d', name: 'Lions Diamond' };
const MAPLE1 = { venueId: 'maple', venueFacilityId: 'm1', name: 'Maple Field 1' };
const MAPLE2 = { venueId: 'maple', venueFacilityId: 'm2', name: 'Maple Field 2' };

const bracket = (finalOn: ScheduleDraftMatchup['onlyOn']): ScheduleDraftMatchup<string>[] => [
  { matchupId: 'SF1', homeParticipantId: 's1', awayParticipantId: 's4', homeLabel: 'Seed 1', awayLabel: 'Seed 4', payload: 'SF1', dependencyMinRestMinutes: 60 },
  { matchupId: 'SF2', homeParticipantId: 's2', awayParticipantId: 's3', homeLabel: 'Seed 2', awayLabel: 'Seed 3', payload: 'SF2', dependencyMinRestMinutes: 60 },
  { matchupId: 'FIN', homeParticipantId: 'w1', awayParticipantId: 'w2', homeLabel: 'Winner SF1', awayLabel: 'Winner SF2', payload: 'FIN',
    dependsOnMatchupIds: ['SF1', 'SF2'], dependencyMinRestMinutes: 60, onlyOn: finalOn },
];
const run = (finalOn: ScheduleDraftMatchup['onlyOn'], fields = [LIONS, MAPLE1, MAPLE2]) => generateScoredScheduleDrafts({
  tournamentId: 't', divisionId: 'd', matchups: bracket(finalOn), slots: slots(['09:00', '11:00', '13:00', '15:00'], fields),
  participants: [], gameDurationMinutes: 90, bufferMinutes: 15,
  priorities: { candidateCount: 24, maxGamesPerDay: 3, minRestMinutes: 60, avoidBackToBack: false, reduceVenueChanges: false, balanceTimeSlots: false },
}, 8);

describe('Final played on: the final is held to the one field', () => {
  test('every draft puts the final on Maple Field 2, and only the final is held', () => {
    const drafts = run({ venueId: 'maple', venueFacilityId: 'm2' });
    assert.ok(drafts.length > 0);
    for (const d of drafts) {
      assert.equal(d.assignments.find(a => a.payload === 'FIN')?.venueFacilityId, 'm2');
    }
    assert.ok(drafts.some(d => d.assignments.some(a => a.payload !== 'FIN' && a.venueFacilityId !== 'm2')), 'the semifinals go anywhere');
  });
  test('no free slot on that field after the semifinals: no draft', () => {
    // Maple Field 2 is offered only at 9:00 a.m., before the semifinals can end.
    const tight = [...slots(['09:00', '11:00', '13:00'], [LIONS, MAPLE1]), ...slots(['09:00'], [MAPLE2])];
    const drafts = generateScoredScheduleDrafts({
      tournamentId: 't', divisionId: 'd', matchups: bracket({ venueId: 'maple', venueFacilityId: 'm2' }), slots: tight,
      participants: [], gameDurationMinutes: 90, bufferMinutes: 15,
      priorities: { candidateCount: 24, maxGamesPerDay: 3, minRestMinutes: 60, avoidBackToBack: false, reduceVenueChanges: false, balanceTimeSlots: false },
    }, 8);
    assert.equal(drafts.length, 0);
  });
  test('no hold: the final goes on any field', () => {
    const fields = new Set(run(null).map(d => d.assignments.find(a => a.payload === 'FIN')?.venueFacilityId));
    assert.ok(fields.size >= 1);
  });
});
