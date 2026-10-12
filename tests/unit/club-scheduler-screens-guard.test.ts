/**
 * CLUB TIER STAGE 11a PART B — THE SCHEDULER'S SCREENS, held in place (ruled 2026-10-11; hub K4MPu4ni53Ct7yrDcmWJd9 →
 * Mockups → Stages 10 + 11, specimens 4–15; plan `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §7). What the screens were built to
 * do, and must not drift back from:
 *
 *   1. THE SCHEDULES ROW sits under Calendar for an owner or admin on a plan with the scheduler and rep teams to hand time
 *      to — absent everywhere else (a coach, a canceled club, a tournament-only club), never a row that dead-ends.
 *   2. THE PHONE READS, THE DESK CHANGES (P11-10): New schedule, the drag, the slot window's changes, Tools' changes and
 *      Finalize are absent at phone width.
 *   3. EVERY HAND CHANGE ENDS IN THE UNDO NOTICE (specimen 7), and Undo puts each slot back exactly (the route's `undo`).
 *   4. WHO-GETS-WHAT IS NEW ALLOCATION'S FORM TABLE (Ask 18) — the shared part, never a second table.
 *   5. THE GENERATOR'S LOOK, OUR OWN CODE: nothing imports from the tournament generator's files.
 *   6. "FROM THE CLUB" ALREADY MEANS MONEY (P11-03): a practice says "From {schedule} · the club’s schedule".
 *   7. THE DOORS INTO A SCHEDULE are gated like the page: the calendar's From row, a permit's "Hand out this time".
 *   8. A CLUB PRACTICE IS THE CLUB'S: the coach's sheet ends in Hand back and the club's sentence — no Cancel, no Delete.
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { kitSchedulesLink } from '../../lib/admin-kit-nav.ts';
import { SCHEDULE_COACH_WORDS, SCHEDULE_SCREEN_WORDS } from '../../lib/club-schedule-words.ts';

const LIST = 'app/[orgSlug]/admin/schedules/page.tsx';
const PAGE = 'app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx';
const KIT = 'components/admin/kit/club/schedules';
const NEW = `${KIT}/NewScheduleWindow.tsx`;
const GRID = `${KIT}/ScheduleGrid.tsx`;
const EDIT_ROUTE = 'app/api/admin/schedules/[scheduleId]/route.ts';
const RAIL = 'components/admin/kit/AdminKitRail.tsx';
const BAR = 'components/admin/kit/AdminKitBottomNav.tsx';
const CAL_VIEWS = 'components/admin/kit/club/ClubCalendarViews.tsx';
const CAL_READ = 'lib/club-calendar.ts';
const PERMIT = 'components/admin/kit/club/PermitWindows.tsx';
const SHEET = 'components/coaches/ScheduleEventSheet.tsx';
const SLOT_PARTS = 'components/coaches/ClubSlotParts.tsx';
const COACH_PRACTICE_FILES = [
  SHEET, SLOT_PARTS, 'components/coaches/ScheduleEventForm.tsx', 'components/coaches/ScheduleCalendarViews.tsx',
  'components/coaches/ClubReviewCard.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx',
];

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesUnder(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);

describe('1 · the Schedules row is there only where time can be handed out', () => {
  const link = (over: Partial<Parameters<typeof kitSchedulesLink>[0]> = {}) =>
    kitSchedulesLink({ base: '/riverdale/admin', canUse: () => true, isCanceled: false, role: 'admin', planId: 'club', ...over });
  it('an owner or admin on the plan, with rep teams: "Schedules" → /schedules', () => {
    assert.equal(link()?.href, '/riverdale/admin/schedules');
    assert.equal(link({ role: 'owner' })?.label, 'Schedules');
  });
  it('absent for a coach or a member, a canceled club, a plan without the scheduler, a club with no rep teams', () => {
    assert.equal(link({ role: 'coach' }), null);
    assert.equal(link({ role: 'member' }), null);
    assert.equal(link({ isCanceled: true }), null);
    assert.equal(link({ planId: 'tournament_plus' }), null);
    assert.equal(link({ planId: null }), null);
    assert.equal(link({ canUse: () => false }), null);
  });
  it('the rail and the phone’s More sheet carry it under Calendar, never on a tournament-only rail', () => {
    const rail = readCode(RAIL);
    assert.match(rail, /schedulesLink && !tournamentOnly/);
    assert.ok(rail.indexOf('calendarLink.href') < rail.indexOf('schedulesLink.href'), 'Schedules sits under Calendar');
    const bar = readCode(BAR);
    assert.match(bar, /\.\.\.\(calendarLink \? \[calendarLink\] : \[\]\), \.\.\.\(schedulesLink \? \[schedulesLink\] : \[\]\)/);
    assert.match(bar, /schedulesLink && row\(schedulesLink/);
  });
});

describe('2 · the phone reads; the desk changes (P11-10)', () => {
  it('New schedule is a desk door', () => {
    assert.match(readCode(LIST), /const canNew = !!read && !read\.nothingToSchedule && !isPhone;/);
  });
  it('a schedule’s changes — the drag, Tools’ changes, the slot window’s — wait for the desk', () => {
    const page = readCode(PAGE);
    assert.match(page, /const canChange = !isPhone;/);
    // …and never while a change is saving (a drop then would be lost, /review).
    assert.match(page, /canDrag=\{canChange && !busy\}/);
    assert.match(page, /canChange=\{canChange\}/);
    for (const tool of ['toolSettings', 'toolRegenerate', 'toolLockWeek', 'toolClearWeek', 'toolDelete']) {
      assert.match(page, new RegExp(`canChange[^\\n]*W\\.${tool}`), `Tools › ${tool} is a desk change`);
    }
    assert.match(page, /!isPhone && <button[^\n]*W\.finalize/, 'Finalize and send is a desk door');
    const grid = readCode(GRID);
    assert.match(grid, /useDraggable\(\{ id: [^\n]*disabled: !canDrag \|\| !one \}\)/, 'a chip drags only at the desk, and only when it holds one team');
  });
});

describe('3 · every hand change ends in the Undo notice', () => {
  it('the notice carries Undo, and Undo sends the slots back exactly', () => {
    const page = readCode(PAGE);
    assert.match(page, /action=\{notice\.undo \? \{ label: W\.undo, onAction:/);
    assert.match(page, /action: 'edit', undo: true,/);
    assert.equal(SCHEDULE_SCREEN_WORDS.undo, 'Undo');
    assert.match(readCode(EDIT_ROUTE), /undo/);
  });
});

describe('4 + 5 · New schedule wears the shared parts; nothing borrows the tournament generator', () => {
  it('who gets what is New allocation’s form table', () => {
    assert.match(readCode(NEW), /import FormTable, \{[^}]*\} from '@\/components\/shared\/FormTable';/);
  });
  it('no scheduler file imports from admin/tournaments/schedule', () => {
    const files = [...filesUnder(KIT), ...filesUnder('app/[orgSlug]/admin/schedules'), 'lib/club-schedule-view.ts', 'lib/club-schedule-document.ts', 'lib/export/club-schedule-export.ts'];
    for (const f of files) {
      assert.doesNotMatch(readCode(f), /from '[^']*tournaments\/schedule[^']*'/, `${f} imports from the tournament generator`);
    }
  });
});

describe('6 · "From the club" stays money’s phrase (P11-03)', () => {
  it('a practice says "From {schedule} · the club’s schedule"', () => {
    assert.equal(SCHEDULE_COACH_WORDS.sourceLead, 'From');
    assert.equal(SCHEDULE_COACH_WORDS.sourceTail, '· the club’s schedule');
    assert.match(readCode(SLOT_PARTS), /\{C\.sourceLead\} <strong>\{source\.scheduleName\}<\/strong> \{C\.sourceTail\}/);
  });
  it('no coach practice surface, and no coach word, says "From the club"', () => {
    for (const f of COACH_PRACTICE_FILES) assert.doesNotMatch(readCode(f), /From the club/i, f);
    const words = Object.values(SCHEDULE_COACH_WORDS).map(v => typeof v === 'function' ? (v as (...a: unknown[]) => unknown)('Winter dome 2026–27', 3) : v);
    assert.doesNotMatch(JSON.stringify(words), /From the club/i);
  });
});

describe('7 · the doors into a schedule are gated like the page', () => {
  it('the calendar’s From row links only for a reader who can open Schedules', () => {
    // One rule for every door (lib/club-schedule-gate.ts) — the page's own gate reads it too.
    assert.match(readCode(CAL_READ), /const canOpenSchedules = canOpenClubSchedules\(\{ planId: reader\.org\.planId, role: reader\.member\.role \}\);/);
    assert.match(readCode(CAL_VIEWS), /b\.clubSchedule\.canOpen/);
  });
  it('a permit’s "Hand out this time in a schedule" asks the same gate; Delete is absent while a schedule hands it out', () => {
    const permit = readCode(PERMIT);
    assert.match(permit, /const canBuild = canOpenClubSchedules\(\{ planId: currentOrg\?\.planId, role: userRole \}\) && canOpen\('module_rep_teams'\);/);
    assert.match(permit, /!editing && canBuild && \(/);
    assert.match(permit, /handedOut\.length === 0 && <RecordDelete/);
  });
});

describe('8 · a club practice is the club’s: the sheet ends in Hand back', () => {
  it('the club branch comes before the coach’s own Cancel and Delete, and replaces them', () => {
    const sheet = readCode(SHEET);
    const club = sheet.indexOf(') : clubSource ? (');
    assert.ok(club > 0, 'the sheet’s foot has a club branch');
    assert.ok(club < sheet.indexOf('<ClubPracticeEnd'), 'the club branch renders ClubPracticeEnd');
    assert.ok(sheet.indexOf('<ClubPracticeEnd') < sheet.indexOf('<GuardedDelete'), 'Delete is the other branch, never beside it');
  });
  it('a handed-back practice reads "Handed back", never "Cancelled"', () => {
    assert.match(readCode(SHEET), /clubSource\?\.handedBack \? CLUB_HANDED_BACK : 'Cancelled'/);
    assert.equal(SCHEDULE_COACH_WORDS.handedBack, 'Handed back');
  });
});
