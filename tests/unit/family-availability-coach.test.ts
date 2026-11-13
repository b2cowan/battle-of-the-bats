import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bookMarkedAt, familyDrifted, headcountOf, isShort, roomFamilySummary, usableFamilyMark, type RoomFamilyRow,
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

const line = (answer: 'in' | 'out' | 'maybe', extra: Partial<{ note: string; by: string | null; day: string }> = {}) => ({
  answer, note: extra.note ?? null, by: extra.by === undefined ? 'Priya' : extra.by, day: extra.day ?? 'Tue', previous: null,
});

describe('ask 8 — one count per player: the coach’s mark first, else the family’s answer', () => {
  it('In and Late count as in, Out as out; a family answer counts only where the coach has not marked', () => {
    const c = headcountOf([
      { status: 'attending', family: 'out' }, // the mark wins
      { status: 'late', family: null },
      { status: 'absent', family: 'in' },
      { status: 'unknown', family: 'in' },
      { status: 'unknown', family: 'maybe' },
      { status: 'unknown', family: null },
    ]);
    assert.deepEqual(c, { total: 6, in: 3, out: 1, maybe: 1 });
  });
  it('the words leave zero parts out, and say nothing when nobody has answered and nobody is marked', () => {
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

describe('the amber warning — a family changed after the coach marked the player', () => {
  const mark = { status: 'attending' as const, markedAt: '2026-11-10T12:00:00Z' };
  it('an Out after an In mark warns; the same answer, or one given before the mark, does not', () => {
    assert.equal(familyDrifted(mark, { answer: 'out', answeredAt: '2026-11-11T12:00:00Z' }), true);
    assert.equal(familyDrifted(mark, { answer: 'maybe', answeredAt: '2026-11-11T12:00:00Z' }), true);
    assert.equal(familyDrifted(mark, { answer: 'in', answeredAt: '2026-11-11T12:00:00Z' }), false);
    assert.equal(familyDrifted(mark, { answer: 'out', answeredAt: '2026-11-09T12:00:00Z' }), false);
  });
  it('a player the coach has not marked never warns', () => {
    assert.equal(familyDrifted({ status: 'unknown', markedAt: null }, { answer: 'out', answeredAt: '2026-11-11T12:00:00Z' }), false);
  });
  it('the mark time moves only on a changed or tapped mark (tapping In again keeps the mark and clears the warning)', () => {
    const now = '2026-11-12T00:00:00Z';
    assert.equal(bookMarkedAt({ status: 'attending', markedAt: '2026-11-10T12:00:00Z' }, 'attending', false, now), '2026-11-10T12:00:00Z');
    assert.equal(bookMarkedAt({ status: 'attending', markedAt: '2026-11-10T12:00:00Z' }, 'attending', true, now), now);
    assert.equal(bookMarkedAt({ status: 'attending', markedAt: '2026-11-10T12:00:00Z' }, 'absent', false, now), now);
    assert.equal(bookMarkedAt(undefined, 'late', false, now), now);
    assert.equal(bookMarkedAt({ status: 'absent', markedAt: now }, 'unknown', true, now), null, 'Not marked has no mark time');
  });
  it('ONE RECORD: the attendance PATCH writes only the changed rows, through the one writer; All in and Reset are the server’s', () => {
    // One attendance record (mig 483, plan §1): the window used to send the WHOLE roster on every tap, re-stamping each row;
    // under latest-wins that overwrote every family answer that arrived while it was open. Never again.
    const code = readCode(BOOK_ROUTE);
    assert.match(code, /await writeCoachAttendance\(\{ eventId, coachUserId: ctx\.user\.id, entries: rows \}\)/);
    assert.match(code, /onlyIfUnknown: true/, '"All in" fills only players nobody answered (ruling 6)');
    assert.match(code, /onlyIfSetBy: 'coach'/, '"Reset" clears only the coach’s answers (call C2)');
    assert.doesNotMatch(code, /upsertRepTeamEventAttendance|markedAtFor|confirmed/);
    const sheet = readCode('components/coaches/ScheduleEventSheet.tsx');
    const save = functionBody(sheet, 'saveAttendanceNow');
    assert.match(save, /const statusChanged = row\.status !== \(row\.savedStatus \?\? 'unknown'\)/);
    assert.match(save, /if \(!statusChanged && !noteChanged\) return \[\];/);
    assert.doesNotMatch(sheet, /entries: attendanceRows\.map\(/, 'the window never sends the whole roster');
    assert.match(functionBody(sheet, 'setAllAttendance'), /\{ fill: 'attending' \} : \{ reset: true \}/);
    // The game console's one tap sends the status alone (never the coach's note back).
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx'), /entries: \[\{ playerId, status \}\]/);
  });
});

describe('ask 3 — “Use family answers” copies only into players the coach has not marked', () => {
  it('In → In, Out → Out, Maybe stays Not marked; a marked player is never touched', () => {
    assert.equal(usableFamilyMark('unknown', 'in'), 'attending');
    assert.equal(usableFamilyMark('unknown', 'out'), 'absent');
    assert.equal(usableFamilyMark('unknown', 'maybe'), null);
    assert.equal(usableFamilyMark('attending', 'out'), null);
    assert.equal(usableFamilyMark('unknown', null), null);
  });
  it('the room’s card counts families (not the book), leaves call-ups out, and names who changed', () => {
    const family: RoomFamilyRow[] = [
      { playerId: 'ava', connected: true, line: line('out'), answeredAt: '2026-11-10T00:00:00Z' },
      { playerId: 'leo', connected: true, line: line('in'), answeredAt: '2026-11-10T00:00:00Z' },
      { playerId: 'maya', connected: true, line: line('out'), answeredAt: '2026-11-11T00:00:00Z' },
      { playerId: 'noor', connected: true, line: line('maybe'), answeredAt: '2026-11-10T00:00:00Z' },
      { playerId: 'owen', connected: true, line: null, answeredAt: null },
      { playerId: 'zoe', connected: false, line: null, answeredAt: null },
    ];
    const s = roomFamilySummary([
      { playerId: 'ava', status: 'absent', markedAt: '2026-11-09T00:00:00Z' },
      { playerId: 'leo', status: 'unknown', markedAt: null },
      { playerId: 'maya', status: 'attending', markedAt: '2026-11-10T12:00:00Z' },
      { playerId: 'noor', status: 'unknown', markedAt: null },
      { playerId: 'owen', status: 'unknown', markedAt: null },
      { playerId: 'zoe', status: 'unknown', markedAt: null },
      { playerId: 'callup', status: 'unknown', markedAt: null },
    ], family);
    assert.deepEqual(
      { answered: s.answered, haveNot: s.haveNot, noParent: s.noParent, changed: s.changed, usable: s.usable },
      { answered: 4, haveNot: 1, noParent: 1, changed: ['maya'], usable: [{ playerId: 'leo', status: 'attending' }] },
    );
  });
  it('Use goes through the coach’s own PATCH, and the family modules never write the book', () => {
    for (const f of [COACH_MODULE, 'lib/family-availability.ts', ROOM_ROUTE]) {
      const code = readCode(f);
      assert.doesNotMatch(code, /rep_team_event_attendance['"]\)\s*\.(insert|update|upsert|delete)/, f);
    }
    assert.doesNotMatch(readCode(ROOM_ROUTE), /export const (POST|PATCH|PUT|DELETE)/, 'the room’s family read is read only');
  });
});

describe('the words the coach reads (tab 2)', () => {
  it('the grey line, the desk cell, the amber line and the family box', () => {
    const l = { ...line('out', { note: 'away at a tournament' }), previous: { answer: 'in' as const, by: 'Dev', day: 'Mon' } };
    assert.equal(CW.line(l), 'Family said Out · “away at a tournament” · Priya, Tue · earlier: In (Dev, Mon)');
    assert.equal(CW.cell(line('in', { by: 'Sam', day: 'Wed' })), 'In · Sam, Wed');
    assert.equal(CW.drift(line('out', { day: 'Wed' })), '⚠ Family changed to Out · Wed');
    assert.equal(CW.line(line('in', { by: null })), 'Family said In · a parent, Tue', 'never an address (O2)');
    assert.equal(CW.box.head('Maya'), 'Maya’s family said');
    assert.equal(
      CW.box.hint({ familyChoice: 'Out', markChoice: 'In', drift: true }),
      'Tap Out to use the family’s answer, or tap In to keep your mark and clear the warning. Families don’t see your mark.',
    );
  });
  it('the card and the event window line count families; “hasn’t” for one', () => {
    assert.deepEqual(CW.familyParts({ answered: 7, haveNot: 3, noParent: 3 }), ['7 answered', '3 haven’t', '3 have no parent in the app']);
    assert.deepEqual(CW.familyParts({ answered: 2, haveNot: 1, noParent: 1 }), ['2 answered', '1 hasn’t', '1 has no parent in the app']);
    assert.equal(CW.card.changed(['Maya']), '⚠ 1 changed since you marked: Maya');
    assert.equal(CW.card.use(1), 'Use 1 family answer');
    assert.equal(CW.card.used(['Leo']), 'Used 1 family answer: Leo');
  });
  it('the switch’s words (tab 3)', () => {
    assert.equal(CW.setting.label, 'Families say if they’re coming');
    assert.equal(CW.setting.on('games_and_practices', 10, 13),
      'Parents in the app can answer In, Out or Maybe for every upcoming game and practice. You see their answers in Attendance; your own marks stay yours. 10 of 13 players have a parent in the app.');
  });
});

describe('ask 11 — who sees what', () => {
  it('the schedule count is COUNTS ONLY: its read selects no note, no answerer, and returns numbers', () => {
    const code = readCode(COACH_MODULE);
    const body = code.slice(code.indexOf('export async function scheduleHeadcounts'), code.indexOf('interface RoomBookRow'));
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
