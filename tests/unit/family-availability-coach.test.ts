import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  headcountOf, isShort, remindPlan, roomFamilySummary, type RoomFamilyRow,
} from '../../lib/family-availability-rules.ts';
import { FAMILY_AVAILABILITY_COACH_WORDS as CW } from '../../lib/family-availability-words.ts';
import { ATTENDANCE_WORD } from '../../lib/coach-schedule-vocab.ts';
import { attendanceRowWords } from '../../lib/coach-schedule-sheet.ts';
import { functionBody, readCode, readSource } from './_source-code.ts';

/**
 * Signed-in family accounts Stage 4b, Session 2 (Parts 4–5; build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md;
 * drawing tabs 1–3). The pure rules by their real output; "this path never does X" by its source.
 */

const COACH_MODULE = 'lib/family-availability-coach.ts';
const ROOM_ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/family-answers/route.ts';
const EVENTS_ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts';
const FAMILY_CHAIN = 'lib/family-coach-route.ts';
const TEAM_ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/route.ts';
const BOOK_ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/attendance/route.ts';
const ADMIN_SCHEDULE = 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx';

const who = (by: 'coach' | 'family', name: string | null, day: string) => ({ by, name, day });

describe('ask 8 — one count per player, read from the record alone (one attendance record)', () => {
  it('In and Late count as in, Out as out, Maybe as maybe — whoever set it; Not marked counts nowhere', () => {
    const c = headcountOf([
      { status: 'attending' }, { status: 'late' }, { status: 'absent' }, { status: 'maybe' }, { status: 'unknown' }, { status: 'unknown' },
    ]);
    assert.deepEqual(c, { total: 6, in: 2, out: 1, maybe: 1 });
  });
  it('the words leave zero parts out, and say nothing when nobody has answered', () => {
    assert.equal(CW.headcount({ total: 13, in: 9, out: 1, maybe: 1 }), '9 of 13 in · 1 out · 1 maybe');
    assert.equal(CW.headcount({ total: 13, in: 8, out: 1, maybe: 0 }), '8 of 13 in · 1 out');
    assert.equal(CW.headcount({ total: 13, in: 2, out: 0, maybe: 0 }), '2 of 13 in');
    assert.equal(CW.headcount({ total: 13, in: 0, out: 0, maybe: 0 }), null, 'never “0 in”');
  });
});

describe('ask 7 — the red row counts OUTS against the sport’s field positions', () => {
  it('5 out of 13 on a baseball team leaves at most 8: short', () => {
    assert.equal(isShort({ total: 13, in: 2, out: 5, maybe: 0 }, 9), true);
    assert.equal(CW.short({ total: 13, out: 5 }), '5 out · at most 8 can play');
  });
  it('a low “in” never makes it red; a sport with no field positions never does', () => {
    assert.equal(isShort({ total: 13, in: 1, out: 0, maybe: 0 }, 9), false);
    assert.equal(isShort({ total: 13, in: 1, out: 4, maybe: 0 }, 9), false);
    assert.equal(isShort({ total: 6, in: 0, out: 5, maybe: 0 }, 0), false);
  });
});

describe('ONE RECORD — the coach’s save (rulings 6–7)', () => {
  it('the attendance PATCH writes only the changed rows, through the one writer; All in and Reset are the server’s', () => {
    // One attendance record (mig 483, plan §1): the window used to send the WHOLE roster on every tap, re-stamping each row;
    // under latest-wins that overwrote every family answer that arrived while it was open. Never again.
    const code = readCode(BOOK_ROUTE);
    assert.match(code, /await writeCoachAttendance\(\{ eventId, coachUserId: ctx\.user\.id, entries: rows \}\)/);
    assert.match(code, /onlyIfUnknown: true/, '"All in" fills only players nobody answered (ruling 6)');
    assert.match(code, /onlyIfSetBy: 'coach'/, '"Reset" clears only the coach’s answers (call C2)');
    assert.doesNotMatch(code, /upsertRepTeamEventAttendance|markedAtFor|confirmed/);
    const sheet = readCode('components/coaches/ScheduleEventSheet.tsx');
    const save = functionBody(sheet, 'saveAttendanceNow');
    assert.match(save, /if \(!statusChanged && !noteChanged\) return \[\];/);
    assert.doesNotMatch(sheet, /entries: attendanceRows\.map\(/, 'the window never sends the whole roster');
    assert.match(functionBody(sheet, 'setAllAttendance'), /\{ fill: 'attending' \} : \{ reset: true \}/);
    // The game console's one tap sends the status alone (never the coach's note back).
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx'), /entries: \[\{ playerId, status \}\]/);
  });
  it('a CONFIRMING tap is sent — the window and the console never read a family’s newer answer while open (S2)', () => {
    const sheet = readCode('components/coaches/ScheduleEventSheet.tsx');
    assert.match(functionBody(sheet, 'saveAttendanceNow'), /const statusChanged = row\.status !== \(row\.savedStatus \?\? 'unknown'\) \|\| !!row\.confirmed;/);
    // A confirm made while another save was in flight survives that save's merge, and is still unsent.
    assert.match(sheet, /confirmed: carried\?\.status === undefined && !!r\.confirmed,/);
    assert.match(sheet, /const unsent = attendanceRowsRef\.current\.some\(r => !!r\.confirmed \|\|/);
    const consoleSrc = readCode('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx');
    assert.doesNotMatch(consoleSrc, /prev\.status === status\) return/, 'the console no longer drops a tap on the answer it shows');
  });
  it('the reply carries the who/when lines, and the family modules never write the book directly', () => {
    assert.match(readCode(BOOK_ROUTE), /\.\.\.await linesFor\(teamId, team, event, \[\.\.\.activePlayerIds\]\)/);
    for (const f of [COACH_MODULE, 'lib/family-availability.ts', ROOM_ROUTE]) {
      const code = readCode(f);
      assert.doesNotMatch(code, /rep_team_event_attendance['"]\)\s*\.(insert|update|upsert|delete)/, f);
    }
    assert.doesNotMatch(readCode(ROOM_ROUTE), /export const (POST|PATCH|PUT|DELETE)/, 'the room’s family read is read only');
  });
  it('the two-record rules are gone: no drift, no “Use family answers”, no mark time', () => {
    const rules = readCode('lib/family-availability-rules.ts');
    for (const dead of ['usableFamilyMark', 'answerAgreesWithMark', 'familyDrifted', 'bookMarkedAt', '\\bFamilyAnswer\\b', 'isFamilyAnswer']) {
      assert.doesNotMatch(rules, new RegExp(dead), dead);
    }
    const room = readCode('components/coaches/ScheduleAttendanceRoom.tsx');
    assert.doesNotMatch(room, /onUse|onlyChanged|card\.changed|card\.use|data-drift/);
    assert.doesNotMatch(readCode('lib/family-availability-words.ts'), /answerAgain|Family said|changed since you marked|Use \$\{/);
  });
});

describe('the room’s Families card counts the record (one attendance record)', () => {
  it('answered = a family set the answer; haven’t / no parent = Not marked; a coach’s answer is neither; call-ups out', () => {
    const family: RoomFamilyRow[] = [
      { playerId: 'ava', connected: true }, { playerId: 'leo', connected: true }, { playerId: 'maya', connected: true },
      { playerId: 'noor', connected: true }, { playerId: 'owen', connected: true }, { playerId: 'zoe', connected: false },
    ];
    const s = roomFamilySummary([
      { playerId: 'ava', status: 'absent', setByKind: 'family' },
      { playerId: 'leo', status: 'attending', setByKind: 'coach' },
      { playerId: 'maya', status: 'maybe', setByKind: 'family' },
      { playerId: 'noor', status: 'late', setByKind: 'coach' },
      { playerId: 'owen', status: 'unknown', setByKind: null },
      { playerId: 'zoe', status: 'unknown', setByKind: null },
      { playerId: 'callup', status: 'unknown', setByKind: null },
    ], family);
    assert.deepEqual(s, { answered: 2, haveNot: 1, noParent: 1, remind: ['owen'] });
  });
  it('a standing Maybe is an answer: Remind never asks about it, whoever set it (owner, S2)', () => {
    const plan = remindPlan([
      { playerId: 'maya', status: 'maybe', answered: true, connected: true },
      { playerId: 'noor', status: 'maybe', answered: false, connected: true },
      { playerId: 'owen', status: 'unknown', answered: false, connected: true },
    ]);
    assert.deepEqual(plan, { remind: ['owen'], marked: ['noor'], noParent: [] });
  });
});

describe('the words the coach reads (tab 2; ruling 4)', () => {
  it('the list line is who set it and when — never the note or the answer before (owner 2026-11-14); the sheet keeps the history', () => {
    const l = { ...who('family', 'Priya', 'Tue'), familyNote: 'away at a tournament', previous: { ...who('coach', null, 'Mon'), status: 'attending' as const } };
    assert.equal(CW.setLine(l), 'Priya, Tue');
    assert.equal(CW.setLine({ ...who('coach', null, 'today'), familyNote: null, previous: { ...who('family', 'Adasmom', 'Nov 1'), status: 'attending' } }), 'Coach, today');
    assert.equal(CW.setLine({ ...who('family', null, 'Tue'), familyNote: null, previous: null }), 'A parent, Tue', 'never an address (O2)');
    assert.equal(CW.box.meta({ ...who('coach', null, 'today'), familyNote: null, previous: { ...who('family', 'Adasmom', 'Nov 1'), status: 'attending' } }),
      'Coach, today · earlier: In (Adasmom, Nov 1)', 'the sheet’s who box still reads the answer before (ruling 4)');
    assert.equal(CW.box.meta({ ...who('family', 'Sam', 'Wed'), familyNote: 'late from school', previous: null }), 'Sam, Wed');
    assert.equal(CW.box.note({ ...who('family', 'Sam', 'Wed'), familyNote: 'late from school', previous: null }), '“late from school”');
    assert.equal(CW.box.hint, 'A tap replaces the answer. The family sees it, but never your note.');
    assert.deepEqual(CW.desk, { player: 'Player', setBy: 'Set by', answer: 'Answer' });
  });
  it('the card and the event window line count families; “hasn’t” for one', () => {
    assert.deepEqual(CW.familyParts({ answered: 7, haveNot: 3, noParent: 3 }), ['7 answered', '3 haven’t', '3 have no parent in the app']);
    assert.deepEqual(CW.familyParts({ answered: 2, haveNot: 1, noParent: 1 }), ['2 answered', '1 hasn’t', '1 has no parent in the app']);
  });
  it('the switch’s words (tab 3) say it is one answer', () => {
    assert.equal(CW.setting.label, 'Families say if they’re coming');
    assert.equal(CW.setting.on('games_and_practices', 10, 13),
      'Parents in the app can answer In, Late, Maybe or Out for every upcoming game and practice, until it starts. Their answer and yours are one answer per player: the latest change counts, and the parent sees yours. 10 of 13 players have a parent in the app.');
  });
});

describe('ask 11 — who sees what', () => {
  it('the schedule count is COUNTS ONLY: its read selects no note, no answerer, and returns numbers', () => {
    const code = readCode(COACH_MODULE);
    const body = code.slice(code.indexOf('export async function scheduleHeadcounts'), code.indexOf('interface LineBookRow'));
    assert.ok(body.length > 200 && body.length < 3000, 'found the function');
    assert.doesNotMatch(body, /note|set_by|previous_/, 'the count never reads a note or who answered');
    assert.match(body, /Promise<Record<string, Headcount> \| null>|out\[id\] = c/);
  });
  it('the room’s family lines (with the note’s words) need the attendance capability', () => {
    // Both coach-side family routes run ONE chain (Session 4): the tier, the family layer, `attendance`, the live season.
    assert.match(readCode(ROOM_ROUTE), /await resolveFamilyAttendanceContext\(params\)/);
    assert.match(functionBody(readCode(FAMILY_CHAIN), 'resolveFamilyAttendanceContext'), /denyUnless\(resolved\.assignment\.capabilities\.attendance/);
  });
  it('the switch uses exactly the Schedule visibility row’s gate (O3)', () => {
    const code = readCode(TEAM_ROUTE);
    const patch = code.slice(code.indexOf("if ('familyAnswers' in body)"));
    assert.match(patch, /canManageSchedule\(assignment\.capabilities\)/);
    assert.match(patch, /isFamilyLayerEnabled\(/);
  });
});

describe('guard (a) — the guardian tier off: nothing about family answers exists for the coach', () => {
  it('every new coach path is gated on the tier', () => {
    assert.match(readCode(ROOM_ROUTE), /await resolveFamilyAttendanceContext\(params\)/);
    assert.match(functionBody(readCode(FAMILY_CHAIN), 'resolveFamilyAttendanceContext'),
      /if \(!GUARDIAN_TIER_ENABLED\) return \{ error: NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\) \}/);
    assert.match(functionBody(readCode(COACH_MODULE), 'coachFamilyAnswersSetting'), /if \(!GUARDIAN_TIER_ENABLED\) return null/);
    const team = readCode(TEAM_ROUTE);
    assert.match(team, /familyAnswersRow = familyLayer && GUARDIAN_TIER_ENABLED && programYear\.status === 'active'/);
    assert.match(team, /familyAnswers: familyCounts\s*\?/);
    assert.match(team, /if \('familyAnswers' in body\) \{\s*if \(!GUARDIAN_TIER_ENABLED\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\)/);
  });
  it('the schedule read omits the count while it is null', () => {
    assert.match(readCode(EVENTS_ROUTE), /\.\.\.\(familyHeadcounts \? \{ familyHeadcounts \} : \{\}\)/);
  });
});

describe('guard (h) — the club admin’s read-only rep schedule is unchanged', () => {
  it('its row decorations carry no count', () => {
    assert.doesNotMatch(readCode(ADMIN_SCHEDULE), /headcountFor|familyHeadcounts/);
  });
});

describe('ask 9 — “No reply” is “Not marked”, everywhere a coach reads attendance', () => {
  it('the one word, and the event window’s line', () => {
    assert.equal(ATTENDANCE_WORD.unknown, 'Not marked');
    const p = (n: string) => ({ id: n, firstName: n, lastName: null, number: null });
    const w = attendanceRowWords([{ player: p('a'), status: 'attending' }, { player: p('b'), status: 'unknown' }]);
    assert.equal(w.head, 'Attendance · 1 in · 1 not marked');
  });
  it('no customer attendance string still says “No reply”', () => {
    const files = [
      'lib/coach-schedule-vocab.ts', 'lib/coach-schedule-sheet.ts', 'components/coaches/attendanceOptions.ts',
      'components/coaches/ScheduleAttendanceRoom.tsx', 'components/coaches/CoachRsvpSheet.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/run/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/history/attendance/panel.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx',
      'components/charts/MonthlyAttendanceChart.tsx',
      'lib/help-content/coaches.tsx',
    ];
    for (const f of files) {
      // Comments may still name the status; customer text may not (an identifier like `noReply` is not text).
      const code = readCode(f).replace(/noReply|'noreply'|NoReply/g, '');
      assert.doesNotMatch(code, /no[ -]reply/i, f);
    }
  });
});

describe('the parent’s page offers a pill only in the child’s own season (Session 1 review, item d)', () => {
  it('rows are filtered by the event’s season against the child’s rostered seasons', () => {
    const src = readSource('lib/family-availability.ts');
    // One record: the row is read by the roster entry the child holds in the EVENT's season (the writer's own entry).
    assert.match(src, /const entryId = seasons\?\.child\.get\(c\.childId\)\?\.get\(seasons\.event\.get\(e\.id\) \?\? ''\);\s*\n\s*if \(!entryId\) continue;/);
  });
});
