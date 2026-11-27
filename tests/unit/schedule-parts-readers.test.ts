import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eventFieldName, keptMask } from '../../lib/field-parts.ts';
import { practicePlaceLabel } from '../../lib/practice-sheet.ts';
import { eventSurfaceLabel, surfaceLabel } from '../../lib/sports.ts';
import { coachScheduleCalendarEntries, coachScheduleSheetRows, type CoachCalendarEvent } from '../../lib/export/schedule-calendar.ts';
import { readCode } from './_source-code.ts';

/**
 * CLUB SCHEDULES STAGE 2, SESSION 2C PART 2 (b), (d), (e): the side or quarter reaches every place a coach or a family
 * reads a practice's field. The part is read at READ time from the event's `section_mask` and its field's `sections`
 * (never stored as text: the Venue library's rename rewrites `field_number`); a coach line joins it with a comma. With no
 * split field every place reads exactly as before.
 */

const SIDE_A = 3, QUARTER_C = 4;

describe('eventFieldName — the field with the part the event carries', () => {
  it('a side, a quarter, and quarter words on a field whose split is unknown', () => {
    assert.equal(eventFieldName('Diamond 1', { sectionMask: SIDE_A, fieldSections: 2 }), 'Diamond 1, side A');
    assert.equal(eventFieldName('Field 2', { sectionMask: QUARTER_C, fieldSections: 4 }), 'Field 2, quarter C');
    assert.equal(eventFieldName('Field 2', { sectionMask: SIDE_A, fieldSections: null }), 'Field 2, quarters A–B', 'true ground whatever the split');
  });
  it('the whole field, or no part read: the name alone; no name: nothing (a part without its field means nothing)', () => {
    assert.equal(eventFieldName('Diamond 1', { sectionMask: 0, fieldSections: 2 }), 'Diamond 1');
    assert.equal(eventFieldName('Diamond 1', {}), 'Diamond 1');
    assert.equal(eventFieldName(null, { sectionMask: SIDE_A, fieldSections: 2 }), '');
    assert.equal(eventFieldName('  ', { sectionMask: SIDE_A, fieldSections: 2 }), '');
  });
});

describe('eventSurfaceLabel — an event’s facility in the sport’s word, with its part', () => {
  it('a bare code takes the noun, then the part; no part: surfaceLabel exactly', () => {
    assert.equal(eventSurfaceLabel('baseball', { fieldNumber: '1', sectionMask: SIDE_A, fieldSections: 2 }), 'Diamond 1, side A');
    assert.equal(eventSurfaceLabel('baseball', { fieldNumber: '1' }), surfaceLabel('baseball', '1'));
    assert.equal(eventSurfaceLabel('baseball', { fieldNumber: null, sectionMask: SIDE_A, fieldSections: 2 }), '');
  });
});

describe('the practice plan’s where-line and its printed sheet', () => {
  it('says the part after the field', () => {
    assert.equal(practicePlaceLabel({ location: 'UAT Fields', fieldNumber: '2', sectionMask: SIDE_A, fieldSections: 2 }, 'baseball'), 'UAT Fields, Diamond 2, side A');
  });
  it('no split: exactly as before', () => {
    assert.equal(practicePlaceLabel({ location: 'UAT Fields', fieldNumber: '2' }, 'baseball'), 'UAT Fields, Diamond 2');
    assert.equal(practicePlaceLabel({ location: 'UAT Fields', fieldNumber: '2', sectionMask: 0, fieldSections: 1 }, 'baseball'), 'UAT Fields, Diamond 2');
  });
});

describe('the coach’s calendar file, subscribed feed and spreadsheet (one feedPlace)', () => {
  const ev = (over: Partial<CoachCalendarEvent> = {}): CoachCalendarEvent => ({
    id: 'p', name: 'Practice', eventType: 'practice', isScrimmage: false, opponent: null, homeAway: null,
    startsAt: '2027-04-06T22:00:00.000Z', endsAt: '2027-04-06T23:30:00.000Z', arrivalTime: null, uniform: null, description: null,
    location: 'Kinsmen Park', locationAddress: '1 Park Rd', fieldNumber: 'Field 1', status: 'scheduled', ...over,
  });
  const OPTS = { teamName: '13U AAA', sport: 'soccer' };
  it('the calendar entry’s place names the side', () => {
    const [entry] = coachScheduleCalendarEntries([ev({ sectionMask: SIDE_A, fieldSections: 2 })], OPTS);
    assert.equal(entry.location, 'Kinsmen Park · Field 1, side A, 1 Park Rd');
  });
  it('no split: the place reads exactly as before', () => {
    const [entry] = coachScheduleCalendarEntries([ev()], OPTS);
    assert.equal(entry.location, 'Kinsmen Park · Field 1, 1 Park Rd');
  });
  it('the spreadsheet’s Field column carries the part; whole fields unchanged', () => {
    const [part, whole, none] = coachScheduleSheetRows([ev({ sectionMask: QUARTER_C, fieldSections: 4 }), ev(), ev({ fieldNumber: null })]);
    assert.equal(part.field, 'Field 1, quarter C');
    assert.equal(whole.field, 'Field 1');
    assert.equal(none.field, '');
  });
});

describe('the readers carry the part (source guards)', () => {
  const db = readCode('lib/db.ts');
  it('every team-event read the mapper turns into an event asks for the field’s split', () => {
    const lines = db.split('\n');
    const calls = lines.flatMap((l, i) => (/mapRepTeamEvent\b(?!Attendance)/.test(l) && !/^function mapRepTeamEvent/.test(l) ? [i] : []));
    assert.ok(calls.length >= 11, 'the census found eleven');
    for (const i of calls) {
      const above = lines.slice(Math.max(0, i - 30), i + 1).join('\n');
      const selects = [...above.matchAll(/\.select\(([^)]*)\)/g)];
      assert.equal(selects.at(-1)?.[1], 'REP_EVENT_SELECT', `the read before line ${i + 1} must use REP_EVENT_SELECT`);
    }
    assert.match(db, /const REP_EVENT_SELECT = '\*, facility_split:org_venue_facilities\(sections\)'/);
    assert.match(db, /sectionMask: maskOf\(r\.section_mask\)/);
  });
  it('(e) a coach-side field write is the whole field — both writers that set the facility clear the part', () => {
    const writes = [...db.matchAll(/org_venue_facility_id = fields\.orgVenueFacilityId;\s*\w+\.section_mask = (fields\.sectionMask \?\? )?0/g)];
    assert.equal(writes.length, 2, 'updateRepTeamEvent and the series edit');
  });
  it('(e) …but an edit or a re-import that leaves the field alone keeps the part the club booked, while the field offers it', () => {
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts'),
      /fields\.sectionMask = keptMask\(event\.orgVenueFacilityId, event\.sectionMask, fields\.orgVenueFacilityId, event\.fieldSections\)/);
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/import/route.ts'),
      /changes\.sectionMask = keptMask\(stored\.orgVenueFacilityId, stored\.sectionMask, changes\.orgVenueFacilityId, stored\.fieldSections\)/);
    // The one rule (Stage 2 close): the same field keeps its part; another field, no field, or a part the field no
    // longer offers is the whole field.
    assert.equal(keptMask('f1', 3, 'f1', 2), 3);
    assert.equal(keptMask('f1', 3, 'f2', 2), 0);
    assert.equal(keptMask('f1', 3, null, 2), 0);
    assert.equal(keptMask('f1', 1, 'f1', 2), 0, 'quarter A on a field now in two sides');
    assert.equal(keptMask('f1', 3, 'f1', 1), 0, 'a field no longer split');
  });
  it('the send’s clash count reads each written practice’s part (side A beside side B is no clash)', () => {
    assert.match(readCode('lib/club-schedule-send.ts'), /\.select\('id, team_id, starts_at, ends_at, org_venue_id, org_venue_facility_id, section_mask,/);
  });
  it('the family reader asks for the part and its field’s split', () => {
    const fv = readCode('lib/family-view.ts');
    assert.match(fv, /section_mask, facility_split:org_venue_facilities\(sections\)/);
    assert.match(fv, /sectionMask: maskOf\(row\.section_mask\)/);
  });
  it('(d) the club calendar’s clash line names the other booking’s part, as a booking’s own line does', () => {
    assert.match(readCode('lib/club-calendar.ts'), /partProp\(other\.facilityId, other\.sectionMask\)/);
  });
  it('no coach or family screen prints an event’s field without its part', () => {
    for (const f of [
      'components/coaches/ScheduleEventSheet.tsx', 'components/coaches/ScheduleEventForm.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx', 'app/(consumer)/family/teams/[teamId]/FamilyTeamClient.tsx', 'app/(consumer)/family/page.tsx',
    ]) {
      const src = readCode(f);
      assert.match(src, /event(Surface|Field)(Label|Name)\(/, f);
      assert.doesNotMatch(src, /surfaceLabel\([^)]*\.fieldNumber\)/, `${f}: an event's field through surfaceLabel alone drops the part`);
    }
  });
});
