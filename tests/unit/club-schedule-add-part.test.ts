import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { familyUseOf, partFromFor, partLabelFor } from '../../lib/club-schedule-family.ts';
import { functionBody, readSource } from './_source-code.ts';

/**
 * ⚖ ADD TIME MAKES A PART (plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8 Phase 8, Session 2; build prompt
 * CLUB_SCHEDULE_ADD_TIME_PARTS_BUILD_PROMPT.md; owner rulings 1, 2, 6, 7, all A, 2026-11-16; mig 494).
 * On a FINAL schedule, Tools › Add time… is New schedule's form for a new PART — its own permits (any of them; one already
 * on the family brings only the time the family doesn't use), its own From and To (never before today), its own dates
 * off, nobody ticked — and "Keep this draft" saves it as a schedule of its own linked to the one it was added to. The
 * schedule it was added to is never written (the SQL fixture `tests/sql/schedule-part-save-fixture.sql` 6 checks its row
 * and slots byte for byte). On a draft or in review, Add time is gone and Settings… holds the Permits picker.
 */

const view = (endsOn: string, blocks: { permitId: string | null; weekdays: number[]; startTime: string; endTime: string; untilDate?: string | null }[]) => ({
  schedule: { endsOn } as never,
  time: { blocks: blocks.map(b => ({ venueId: 'v', facilityIds: [], fromDate: null, untilDate: b.untilDate ?? null, ...b })), datesOff: [] } as never,
});
const MILTON = 'permit-milton';

describe('the part’s name (ruling 1)', () => {
  it('is the date it was added, with no name to type', () => {
    assert.equal(partLabelFor('2026-11-17', []), 'Time added Nov 17');
  });
  it('a second the same day is “(2)”, a third “(3)”; another day’s label is no clash', () => {
    assert.equal(partLabelFor('2026-11-17', ['Time added Nov 17']), 'Time added Nov 17 (2)');
    assert.equal(partLabelFor('2026-11-17', ['Time added Nov 17', 'Time added Nov 17 (2)']), 'Time added Nov 17 (3)');
    assert.equal(partLabelFor('2026-11-17', ['Time added Nov 16']), 'Time added Nov 17');
  });
});

describe('a permit already on the schedule brings only the time it doesn’t use (ruling 7)', () => {
  // Fall practices: Milton Mon and Wed 6–9 p.m. to Jan 24 (the schedule's end); a part on Milton too, Thu, to Feb 10.
  const fall = view('2027-01-24', [{ permitId: MILTON, weekdays: [3, 1], startTime: '18:00:00', endTime: '21:00:00' }, { permitId: 'permit-halton', weekdays: [2], startTime: '18:00', endTime: '20:00' }]);
  const part = view('2027-03-27', [{ permitId: MILTON, weekdays: [4], startTime: '18:00', endTime: '19:30', untilDate: '2027-02-10' }]);
  it('the family’s use of it: each row of days and hours once, and the last day any of it runs', () => {
    assert.deepEqual(familyUseOf([fall], MILTON), { rows: [{ weekdays: [1, 3], startTime: '18:00', endTime: '21:00' }], until: '2027-01-24' });
    const both = familyUseOf([fall, part], MILTON)!;
    assert.equal(both.rows.length, 2);
    assert.equal(both.until, '2027-02-10');
  });
  it('a row runs to its own last day, never past its schedule’s', () => {
    assert.equal(familyUseOf([view('2027-01-24', [{ permitId: MILTON, weekdays: [1], startTime: '18:00', endTime: '19:00', untilDate: '2027-06-30' }])], MILTON)!.until, '2027-01-24');
  });
  it('a permit nothing in the family uses has no use', () => {
    assert.equal(familyUseOf([fall, part], 'permit-dome'), null);
  });
  it('From starts the day after the use ends — "your 6-month permit behind a 2-month schedule"', () => {
    const use = familyUseOf([fall], MILTON);
    assert.equal(partFromFor({ startsOn: '2026-09-08', endsOn: '2027-03-27' }, use, '2026-11-17'), '2027-01-25');
  });
  it('never before today (the schedule was sent), never before the permit', () => {
    assert.equal(partFromFor({ startsOn: '2026-11-23', endsOn: '2027-01-24' }, null, '2026-11-17'), '2026-11-23');
    assert.equal(partFromFor({ startsOn: '2026-09-08', endsOn: '2027-03-27' }, null, '2026-11-17'), '2026-11-17');
  });
  it('a use that reaches the permit’s end leaves From at the permit (the time left is other days, hours or parks — the cut leaves the rest out)', () => {
    const use = familyUseOf([view('2027-03-27', [{ permitId: MILTON, weekdays: [1], startTime: '18:00', endTime: '19:00' }])], MILTON);
    assert.equal(partFromFor({ startsOn: '2026-09-08', endsOn: '2027-03-27' }, use, '2026-11-17'), '2026-11-17');
  });
});

describe('the routes make a part, and never write the schedule it is added to (source guard)', () => {
  const gen = readSource('app/api/admin/schedules/generate/route.ts');
  const list = readSource('app/api/admin/schedules/route.ts');
  const one = readSource('app/api/admin/schedules/[scheduleId]/route.ts');
  const server = readSource('lib/club-schedule-server.ts');
  it('the drafts: a part is asked as New schedule asks, with the WHOLE family taken, never before today', () => {
    assert.match(gen, /partOf \? partParent\(orgId, r, body\.partOf\) : null/);
    assert.match(gen, /partTimeRefusal\(part\.parent, asked\.value\.time\)/);
    assert.match(gen, /part\?\.ok \? part\.family : loaded/);
    assert.ok(!/addTime|addTimeRequest/.test(gen), 'the old Add time request is retired');
  });
  it('the save: one step makes the part with its practices, cut with the family taken; the parent is not saved', () => {
    const post = list.slice(list.indexOf('export const POST'));
    assert.match(post, /draftToSave\(asked\.value, prices, assignments, new Map\(\), null, part\?\.ok \? part\.family : \[\]\)/);
    assert.match(post, /partOfScheduleId: part\.parent\.row\.id, partLabel: label/);
    // Every save in the route makes a NEW row (null id): nothing is written to the schedule the time is added to.
    for (const m of post.matchAll(/saveScheduleStep\(orgId, ([^,]+),/g)) assert.equal(m[1], 'null');
    assert.ok(!/\.update\(|\.from\('club_schedules'\)\.update/.test(post));
  });
  it('the part’s checks: final, not a part, the whole family; From not before today', () => {
    const parent = functionBody(server, 'partParent');
    assert.match(parent, /state !== 'final'/);
    assert.match(parent, /part_of_schedule_id\) return/);
    assert.match(parent, /wholeFamily\(orgId, parentId\)/);
    assert.match(functionBody(server, 'partTimeRefusal'), /time\.startsOn < today/);
  });
  it('two saves racing on one family say "changed since you opened it", never a 500 (mig 491’s unique, mig 541’s floor)', () => {
    const floor = functionBody(server, 'floorRefusal');
    assert.match(floor, /code === '23505' && \/club_schedules_part_label_once\/\.test\(msg\)\) return refusal\(409, 'changed', R\.changed\)/);
    // The place floor is an exclusion constraint since mig 541: 23P01, by its own name, the same answer.
    assert.match(floor, /code === '23P01' && \/club_schedule_slots_family_place_overlap\/\.test\(msg\)\) return refusal\(409, 'changed', R\.changed\)/);
    assert.ok(!floor.includes('family_place_start'), 'the equal-start index is gone (mig 541)');
    // A part the field no longer offers is said in words, before the 23514 catch-all reads it as a bad figure.
    assert.ok(floor.indexOf('part_illegal') > -1 && floor.indexOf('part_illegal') < floor.indexOf("'23514'"));
    const mig = readSource('supabase/migrations/541_a_field_splits_into_parts.sql');
    assert.match(mig, /add constraint club_schedule_slots_family_place_overlap\s+exclude using gist/);
  });
  it('today’s Add time internals are gone: no add_time action, no addTimeRequest, no addedTime, no add keep', () => {
    assert.ok(!one.includes("'add_time'"));
    assert.ok(!server.includes('addTimeRequest') && !server.includes('addedTime('));
    const keep = readSource('lib/club-schedule-keep.ts');
    assert.ok(!keep.includes("kind: 'add'") && !keep.includes('export function addedTime'));
  });
  it('the save learns the link on its insert only (mig 494)', () => {
    const mig = readSource('supabase/migrations/494_the_save_makes_an_added_part.sql');
    assert.match(mig, /part_of_schedule_id, part_label, created_by, updated_by\)/);
    assert.match(mig, /nullif\(p_data->>'partOfScheduleId', ''\)::uuid/);
    assert.ok(!/set[\s\S]*part_of_schedule_id\s*=/.test(mig.slice(mig.indexOf('update club_schedules set'), mig.indexOf("if p_data ? 'blocks'"))), 'the update branch never sets the link');
  });
});

describe('the window and the page (source guard)', () => {
  const win = readSource('components/admin/kit/club/schedules/NewScheduleWindow.tsx');
  const page = readSource('app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx');
  it('Add time is offered on a final schedule only (ruling 2)', () => {
    assert.match(page, /canChange && final && <CoachToolbarMenuItem label=\{W\.toolAddTime\}/);
  });
  it('Add time is New schedule’s form: nothing on the schedule is edited, and nobody is ticked to start (ruling 6)', () => {
    assert.match(win, /const editing = partOf \? null : settingsOf\?\.view \?\? null;/);
    assert.match(win, /setDraft\(\{ \.\.\.EMPTY, ticked: \[\], slotMinutes: partOf\.schedule\.settings\.slotMinutes, changeoverMinutes: partOf\.schedule\.settings\.changeoverMinutes \}\)/);
    // Every running team is listed (the table is New schedule's `running`), one not on the schedule said so.
    assert.match(win, /PART_WORDS\.teamNotOnParent\(partOf\.schedule\.name\)/);
  });
  it('Generate and Keep ask for the part; no PATCH of the schedule it is added to', () => {
    assert.match(win, /\.\.\.\(partOf \? \{ partOf: partOf\.schedule\.id \} : \{\}\)/);
    assert.match(win, /\.\.\.\(partOf \? \{ partOf: partOf\.schedule\.id \} : \{ name: draft\.name\.trim\(\) \}\)/);
    assert.ok(!win.includes("action: 'add_time'") && !win.includes('keepAdded'));
  });
  it('From is the part’s own and never before today; a permit on the family says the time it leaves out', () => {
    assert.match(win, /min=\{partOf \? tournamentToday\(\) : undefined\}/);
    assert.match(win, /if \(partOf && draft\.startsOn < tournamentToday\(\)\) return PART_WORDS\.fromBeforeToday/);
    assert.match(win, /PART_WORDS\.permitUsed\(/);
  });
  it('Settings… on a draft or in review holds the Permits picker; unticking a saved permit is its card’s Take it off… (tab 2)', () => {
    assert.match(win, /const showPicker = !editing \|\| editing\.schedule\.state !== 'final';/);
    assert.match(win, /onChange=\{onPermits\}/);
    assert.match(win, /canTakeOff\(gone\[0\]\)\) \{ setTakingOff\(gone\[0\]\); return; \}/);
  });
});
