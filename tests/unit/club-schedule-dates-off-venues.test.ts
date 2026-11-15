import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cutSlots, type ScheduleTime } from '../../lib/club-schedule-engine.ts';
import { dateOffCovers, datesOffTaken, type PermitTime } from '../../lib/permit-time.ts';
import { datesOffChanged, datesOffKeepingParks, mergeDatesOff, type DateOffEntry, type DateOffParks } from '../../lib/club-schedule-permit-rows.ts';
import { scheduleNotes } from '../../lib/club-schedule-document.ts';
import { billingTestLoader } from './_billing-test-loader.ts';
import { filesUnder, functionBody, readCode, readSource } from './_source-code.ts';

/**
 * A SCHEDULE ON SEVERAL PERMITS, Session B (plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §4c and §8 Phase 2; owner rulings
 * P5 A, P6 A, N4 A; mig 488). A date off can name its parks (none named = All venues); a permit's copied date off closes
 * only that permit's parks. THE TWO-TOWN FIXTURE: Town A (Milton) holds Kinsmen Park, Town B (Halton Hills) holds Prospect
 * Park; Milton's Easter weekend must leave Prospect Park alone — in generation, in the hand-edit warnings and in Outside
 * the permit — and a one-permit, one-park schedule sends exactly what it always did.
 */
const K = '00000000-0000-4000-8000-00000000000a'; // Kinsmen Park (Town A)
const P = '00000000-0000-4000-8000-00000000000b'; // Prospect Park (Town B)
const A = 'permit-milton', B = 'permit-halton';
const FAC = new Map([[K, ['ka']], [P, ['pa']]]);
const SAT = '2027-03-27'; // Easter weekend (a Saturday)

const block = (venueId: string, permitId: string | null) => ({
  id: `b-${venueId}`, venueId, facilityIds: [] as string[], weekdays: [6], startTime: '09:00', endTime: '10:00', fromDate: null, untilDate: null, permitId,
});
const time = (datesOff: ScheduleTime['datesOff']): ScheduleTime => ({
  startsOn: '2027-03-20', endsOn: '2027-04-03', blocks: [block(K, A), block(P, B)], datesOff,
});
const cut = (t: ScheduleTime) => cutSlots(t, { slotMinutes: 60, changeoverMinutes: 0, prime: null, venueFacilities: FAC });
const onSat = (t: ScheduleTime) => cut(t).filter(s => s.day === SAT).map(s => s.venueId).sort();

const ctx = (parks: string[]): DateOffParks => ({ parks, permitParks: id => (id === A ? [K] : id === B ? [P] : []) });

describe('a date off names its parks — the one answer', () => {
  it('no parks named is every park; a named list is only those', () => {
    assert.equal(dateOffCovers({}, K), true);
    assert.equal(dateOffCovers({ venueIds: [] }, P), true);
    assert.equal(dateOffCovers({ venueIds: [K] }, K), true);
    assert.equal(dateOffCovers({ venueIds: [K] }, P), false);
  });
});

describe('the two-town fixture: Town A’s long weekend leaves Town B’s park alone', () => {
  it('in generation: a date off on Kinsmen cuts only Kinsmen’s slots that day', () => {
    assert.deepEqual(onSat(time([])), [K, P], 'both parks practise on the Saturday with no date off');
    assert.deepEqual(onSat(time([{ day: SAT, note: 'Easter weekend', venueIds: [K] }])), [P], 'Prospect keeps its Saturday');
    assert.deepEqual(onSat(time([{ day: SAT, note: 'Club AGM', venueIds: [] }])), [], 'All venues closes every park');
    assert.deepEqual(onSat(time([{ day: SAT, note: 'Club AGM' }])), [], 'a date off that never said is All venues (every existing one)');
    // Every other day is untouched either way.
    const others = (t: ScheduleTime) => cut(t).filter(s => s.day !== SAT).map(s => s.key);
    assert.deepEqual(others(time([{ day: SAT, note: null, venueIds: [K] }])), others(time([])));
  });

  it('in the hand-edit warnings and Outside the permit: Town A’s date off names only its own park’s practices', () => {
    const permitA: PermitTime = { id: A, startsOn: '2027-03-02', endsOn: '2027-05-29', blocks: [block(K, null)], datesOff: [{ day: SAT, note: 'Easter weekend' }] };
    const permitB: PermitTime = { id: B, startsOn: '2027-03-02', endsOn: '2027-06-25', blocks: [block(P, null)], datesOff: [] };
    // The schedule's held slots on that Saturday, at both parks (as the schedule page's Outside read asks them).
    const held = cut(time([])).filter(s => s.day === SAT).map(s => ({ key: s.key, venueId: s.venueId, facilityId: s.facilityId, startMs: s.startMs, endMs: s.endMs, teamIds: ['t'] }));
    const hit = datesOffTaken(permitA, held, [permitA, permitB], FAC, { from: '2027-03-01', nowMs: 0 });
    assert.deepEqual(hit.flatMap(d => d.bookings.map(b => b.venueId)), [K], 'Milton’s day takes Kinsmen’s practice only');
    assert.deepEqual(datesOffTaken(permitB, held, [permitA, permitB], FAC, { from: '2027-03-01', nowMs: 0 }).flatMap(d => d.bookings), [], 'Halton Hills has no date off there');
  });

  it('the document’s notes say a named date off’s parks, and none for All venues', () => {
    const notes = scheduleNotes({
      name: 'Spring', startsOn: '2027-03-20', endsOn: '2027-04-03', teams: [], slots: [],
      places: [{ venueId: K, venueName: 'Kinsmen Park', facilities: [] }, { venueId: P, venueName: 'Prospect Park', facilities: [] }],
      datesOff: [{ day: SAT, note: 'Easter weekend', venueIds: [K] }, { day: '2027-04-22', note: 'Club AGM', venueIds: [] }],
    });
    assert.ok(notes.includes('Dates off: Sat, Mar 27 (Easter weekend, at Kinsmen Park), Thu, Apr 22 (Club AGM).'), notes.join(' | '));
  });

  it('a date off that names a park no row uses still names it — it never reads as All venues; the names run A to Z', () => {
    const input = {
      name: 'Spring', startsOn: '2027-03-20', endsOn: '2027-04-03', teams: [], slots: [],
      places: [{ venueId: K, venueName: 'Kinsmen Park', facilities: [] }],
    };
    const noted = (datesOff: { day: string; note: string | null; venueIds: string[] }[], offParkNames?: Record<string, string>) =>
      scheduleNotes({ ...input, datesOff, offParkNames }).join(' | ');
    assert.match(noted([{ day: SAT, note: 'Easter', venueIds: [P] }], { [P]: 'Prospect Park' }), /Dates off: Sat, Mar 27 \(Easter, at Prospect Park\)/);
    assert.match(noted([{ day: SAT, note: null, venueIds: [P, K] }], { [P]: 'Prospect Park' }), /\(at Kinsmen Park and Prospect Park\)/, 'A to Z, not by id');
    assert.match(noted([{ day: SAT, note: 'Easter', venueIds: [P] }]), /\(Easter, at a venue this schedule doesn’t use\)/, 'no name known: still not bare');
  });
});

describe('the form’s dates off merge to one per day at send (mergeDatesOff)', () => {
  it('two permits, the same day: the union of their parks, the first note that says something', () => {
    const entries: DateOffEntry[] = [
      { day: SAT, note: '', permitId: A }, { day: SAT, note: 'Easter weekend', permitId: B }, { day: SAT, note: 'Holiday', permitId: B },
    ];
    assert.deepEqual(mergeDatesOff(entries, ctx([K, P])), [{ day: SAT, note: 'Easter weekend', venueIds: [K, P] }]);
  });
  it('All venues wins over any list, whichever comes first', () => {
    assert.deepEqual(mergeDatesOff([{ day: SAT, note: null, permitId: A }, { day: SAT, note: 'AGM', venueIds: [] }], ctx([K, P])),
      [{ day: SAT, note: 'AGM', venueIds: [] }]);
    assert.deepEqual(mergeDatesOff([{ day: SAT, note: 'AGM' }, { day: SAT, note: null, permitId: A }], ctx([K, P])),
      [{ day: SAT, note: 'AGM', venueIds: [] }], 'a typed date off starts on All venues');
  });
  it('a permit’s date off defaults to its own parks — only while the schedule uses more than one park (P5 A, UX 7)', () => {
    assert.deepEqual(mergeDatesOff([{ day: SAT, note: 'Easter weekend', permitId: A }], ctx([K, P])), [{ day: SAT, note: 'Easter weekend', venueIds: [K] }]);
    assert.deepEqual(mergeDatesOff([{ day: SAT, note: 'Easter weekend', permitId: A }], ctx([K])), [{ day: SAT, note: 'Easter weekend', venueIds: [] }],
      'one park: All venues, as every schedule always sent');
    assert.deepEqual(mergeDatesOff([{ day: SAT, note: null, permitId: A, venueIds: [P] }], ctx([K, P])), [{ day: SAT, note: null, venueIds: [P] }], 'the admin’s choice wins');
  });
  it('unticking a permit re-derives a shared day from the permits still ticked', () => {
    const both: DateOffEntry[] = [{ day: SAT, note: 'Easter', permitId: A }, { day: SAT, note: 'Easter', permitId: B }, { day: '2027-04-10', note: null, permitId: A }];
    const before = mergeDatesOff(both, ctx([K, P]));
    assert.deepEqual(before.map(d => [d.day, d.venueIds]), [[SAT, [K, P]], ['2027-04-10', [K]]]);
    // Milton unticked: its rows go; Halton Hills' Saturday stays, on Prospect only. (Kinsmen's rows went with Milton, so
    // the time is one park now — and one park sends All venues, which on that one park is the same day off.)
    const left = both.filter(e => e.permitId !== A);
    const twoParks = mergeDatesOff(left, ctx([K, P]));
    assert.deepEqual(twoParks, [{ day: SAT, note: 'Easter', venueIds: [P] }], 'B’s parks only — never the day for both');
    // The hint counts what really came off (/review F5): both of Milton's days changed.
    assert.deepEqual(datesOffChanged([SAT, '2027-04-10'], before, twoParks), [SAT, '2027-04-10']);
    // A day a typed All-venues row keeps off exactly as before did NOT come off.
    const typed: DateOffEntry[] = [...both, { day: '2027-04-10', note: 'AGM', venueIds: [] }];
    assert.deepEqual(datesOffChanged([SAT, '2027-04-10'], mergeDatesOff(typed, ctx([K, P])), mergeDatesOff(typed.filter(e => e.permitId !== A), ctx([K, P]))), [SAT]);
  });
  it('one permit, one park: the send is the same days and notes as before, every one All venues', () => {
    const entries: DateOffEntry[] = [{ day: SAT, note: ' Easter ', permitId: A }, { day: '2027-04-22', note: '' }];
    assert.deepEqual(mergeDatesOff(entries, ctx([K])), [{ day: SAT, note: 'Easter', venueIds: [] }, { day: '2027-04-22', note: null, venueIds: [] }]);
    // …and the engine cuts exactly what it cut from the old { day, note } (no parks) shape.
    const oldShape = { ...time([{ day: SAT, note: 'Easter' }]), blocks: [block(K, A)] };
    const newShape = { ...oldShape, datesOff: mergeDatesOff(entries.slice(0, 1), ctx([K])) };
    assert.deepEqual(cut(newShape), cut(oldShape));
  });
});

describe('a stale tab can’t widen a named date off — through the TypeScript path (readTimeBody → timePayload)', () => {
  const stub = { from: () => { throw new Error('no database in this test'); }, rpc: () => { throw new Error('no database in this test'); } };
  const server = billingTestLoader({ './supabase-admin': { supabaseAdmin: stub }, '@/lib/supabase-admin': { supabaseAdmin: stub } })('lib/club-schedule-server.ts') as {
    readTimeBody: (b: Record<string, unknown>) => { ok: true; time: ScheduleTime } | { ok: false; error: string };
    timePayload: (t: ScheduleTime) => { datesOff: Record<string, unknown>[] };
  };
  const body = (datesOff: unknown[]) => ({
    startsOn: '2027-03-20', endsOn: '2027-04-03', datesOff,
    blocks: [{ venueId: K, facilityIds: [], weekdays: [6], startTime: '09:00', endTime: '10:00' }],
  });
  const read = (datesOff: unknown[]) => { const r = server.readTimeBody(body(datesOff)); assert.ok(r.ok, 'the body reads'); return (r as { time: ScheduleTime }).time; };

  it('a date off that leaves venueIds out (or sends null) stays unsaid, and the payload leaves the key out', () => {
    for (const d of [{ day: SAT, note: 'Easter' }, { day: SAT, note: 'Easter', venueIds: null }]) {
      const t = read([d]);
      assert.equal(t.datesOff[0].venueIds, undefined);
      assert.deepEqual(server.timePayload(t).datesOff, [{ day: SAT, note: 'Easter' }], 'no key: the save keeps what the day names');
    }
  });
  it('a said list, and All venues as an empty list, go to the save as said', () => {
    assert.deepEqual(server.timePayload(read([{ day: SAT, note: null, venueIds: [K, K] }])).datesOff, [{ day: SAT, note: null, venueIds: [K] }]);
    assert.deepEqual(server.timePayload(read([{ day: SAT, note: null, venueIds: [] }])).datesOff, [{ day: SAT, note: null, venueIds: [] }]);
    assert.equal(server.readTimeBody(body([{ day: SAT, venueIds: ['not-a-park'] }])).ok, false, 'a park that is not an id is refused');
  });
  it('the regenerate fills an unsaid date off from what is stored, so the drafts are cut on the parks it names', () => {
    const stored = [{ day: SAT, note: 'Easter', venueIds: [K] }, { day: '2027-04-22', note: null, venueIds: [] }];
    const stale = read([{ day: SAT, note: 'Easter' }, { day: '2027-04-22', note: null }, { day: '2027-03-31', note: 'new' }]);
    const kept = datesOffKeepingParks(stale.datesOff, stored);
    assert.deepEqual(kept.map(d => [d.day, d.venueIds]), [[SAT, [K]], ['2027-04-22', undefined], ['2027-03-31', undefined]]);
    assert.deepEqual(server.timePayload({ ...stale, datesOff: kept }).datesOff[0], { day: SAT, note: 'Easter', venueIds: [K] });
    // The drafts cut from it keep Prospect Park's Saturday, as the stored date off says.
    assert.deepEqual(onSat({ ...time(kept), blocks: [block(K, A), block(P, B)] }), [P]);
    // A said list is the request's own, never overwritten.
    assert.deepEqual(datesOffKeepingParks([{ day: SAT, note: null, venueIds: [] }], stored)[0].venueIds, []);
  });
});

/**
 * ⚖ GUARD (Session B, A's guard-1 pattern): NO READER TREATS A SCHEDULE'S DATES OFF AS VENUE-LESS. A schedule's date off
 * closes only the parks it names (`dateOffCovers`, none named = every park). The only code that reads a date off by its DAY
 * alone is the PERMIT's own (a permit's dates off never name parks: they close the permit's time, all of it). A new
 * day-only reader anywhere else fails here — ask `dateOffCovers` instead; that is the decision point, not a tidy-up.
 */
describe('guard — no reader treats a schedule’s dates off as venue-less', () => {
  const CODE = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]
    .filter(f => !f.endsWith('.test.ts'));
  it('a date off is read by its day alone only on the permit’s side', () => {
    const dayOnly = /datesOff\.(map|some|filter|find|every)\(\(?\w+\)? => \w+\.day\b/;
    const readers = CODE.filter(f => dayOnly.test(readCode(f))).sort();
    assert.deepEqual(readers, ['components/admin/kit/club/PermitWindows.tsx', 'lib/permit-form.ts', 'lib/permit-time.ts'],
      'a new day-only reader of dates off — a schedule’s date off names parks: ask dateOffCovers');
  });
  it('the engine cuts through blockDates, and blockDates asks dateOffCovers', () => {
    const time = readCode('lib/permit-time.ts');
    assert.match(functionBody(time, 'blockDates'), /permit\.datesOff\.filter\(d => dateOffCovers\(d, block\.venueId\)\)/);
    const engine = readCode('lib/club-schedule-engine.ts');
    assert.match(engine, /const asPermit = \{ id: 'schedule', startsOn: time\.startsOn, endsOn: time\.endsOn, blocks: time\.blocks, datesOff: time\.datesOff \};/);
    assert.equal((engine.match(/asPermit/g) ?? []).length, 2, 'the schedule-as-permit is read by blockDates alone');
  });
  it('every schedule reader carries the parks: the read, the request, the save, the form, the document, Take … off', () => {
    const server = readCode('lib/club-schedule-server.ts');
    assert.match(server, /\.select\('day, note, org_time_date_off_venues\(org_venue_id\)'\)/, 'readScheduleTime reads each date off’s parks');
    assert.match(server, /\.\.\.\(d\.venueIds === undefined \? \{\} : \{ venueIds: \[\.\.\.d\.venueIds\] \}\)/, 'timePayload leaves the key out when unsaid');
    assert.match(functionBody(server, 'readTimeBody'), /const venueIds = raw == null \? undefined : \[\.\.\.new Set\(raw as string\[\]\)\];/, 'unsaid stays undefined, never All');
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/route.ts'), /datesOffKeepingParks\(read\.value\.time\.datesOff, loaded\.time\.datesOff\)/, 'a regenerate keeps the stored parks');
    assert.match(readCode('app/api/admin/schedules/generate/route.ts'), /datesOffKeepingParks\(asked\.value\.time\.datesOff, loaded\.time\.datesOff\)/, 'the preview is cut with the stored parks too');
    const form = readCode('components/admin/kit/club/schedules/NewScheduleWindow.tsx');
    assert.match(form, /datesOff: mergeDatesOff\(draft\.datesOff\.filter\(o => isCalendarDate\(o\.day\)\), offParks\),/, 'the form sends one per day, each saying its parks');
    assert.match(form, /flatMap\(o => dateOffVenues\(o, offParks\)\)/, '"Applies to" offers every park the save will send');
    assert.match(form, /const kept = used\.size > 1 \? keep : \[\];/, 'unticking trims a hand-picked list to the parks still used (and to All on one park)');
    assert.match(readCode('lib/club-schedule-document.ts'), /d\.venueIds \?\? \[\]/, 'the document names a date off’s parks');
    assert.match(readCode('lib/permit-dates-off.ts'), /venueIds: \[\.\.\.new Set\(permit\.blocks\.map\(b => b\.venueId\)\)\]\.filter\(v => scheduleParks\.has\(v\)\),/, 'Outside the permit: each permit’s row names its parks');
  });
  it('mig 488: the shape /dba Finding #50 decided', () => {
    const mig = readSource('supabase/migrations/488_a_date_off_names_its_parks.sql');
    assert.match(mig, /org_venue_id uuid not null references public\.org_venues\(id\),\n/, 'the venue FK is NO ACTION — a cascade would widen a date off to All');
    assert.match(mig, /date_off_id  uuid not null references public\.org_time_dates_off\(id\) on delete cascade,/);
    assert.match(mig, /primary key \(date_off_id, org_venue_id\)/);
    assert.match(mig, /case when jsonb_typeof\(d->'venueIds'\) = 'array' then d->'venueIds'\n\s+else coalesce\(v_off_venues->\(\(d->>'day'\)::date::text\), '\[\]'::jsonb\) end as vs/,
      'only a said list changes a day’s parks; anything else keeps what is stored');
    assert.match(readCode('app/api/admin/org/venues/route.ts'), /'venue_in_date_off'/, 'the Venue library refuses the delete in words');
  });
  it('the merge is pure: no React, no database', () => {
    assert.doesNotMatch(readCode('lib/club-schedule-permit-rows.ts'), /from 'react'|supabase|server-only/);
  });
});

describe('Needs attention: the second permit’s date off is its own row, naming its permit and its park', () => {
  it('reads as the drawing reads it, and "Take … off" names the park', async () => {
    const { scheduleOutsideWords } = await import('../../lib/club-schedule-overview.ts');
    const { SCHEDULE_SCREEN_WORDS: W } = await import('../../lib/club-schedule-words.ts');
    const slots = [{ key: 'k1', day: '2027-05-13', weekday: 4, teamIds: ['t11'] }, { key: 'p1', day: '2027-05-13', weekday: 4, teamIds: ['t12'] }];
    // Milton's row: only Kinsmen's slot (the one rule asked of Milton's own parks), never Prospect's.
    const row = { permitName: 'Milton spring 2027', days: [{ day: '2027-05-13', note: null, slotKeys: ['k1'] }], league: [], leagueDays: [], leagueHref: null, rows: [] };
    const w = scheduleOutsideWords(row, { slots, teams: [{ id: 't11' }, { id: 't12' }] },
      { draft: false, nameOf: id => (id === 't11' ? '11U AA' : '12U AA'), permitNamed: true, at: 'Kinsmen Park' });
    assert.equal(w.head, 'Thu, May 13 is a date off on Milton spring 2027');
    assert.equal(w.line, '1 practice on this schedule sits on that day at Kinsmen Park: 11U AA. The team still has it.');
    assert.equal(W.takeDaysOff(w.days, 'Kinsmen Park'), 'Take May 13 off Kinsmen Park');
    // One permit, one park: the words are as they always were.
    const one = scheduleOutsideWords(row, { slots, teams: [{ id: 't11' }, { id: 't12' }] }, { draft: false, nameOf: () => '11U AA' });
    assert.equal(one.head, 'Thu, May 13 is a date off on the permit');
    assert.equal(W.takeDaysOff(one.days), 'Take May 13 off');
  });
});
