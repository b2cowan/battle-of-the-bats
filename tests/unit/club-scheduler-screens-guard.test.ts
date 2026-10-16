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
 *   9. A SEND TELLS THE CLUB'S COACHES ONLY (owner 2026-10-12, walk §300 W7: "this is between clubs and their coaches";
 *      amends Ask 7): no send reads the venue's bookings contact, and the Send window has no row for it. The venue keeps
 *      the contact on its window (Venue library); a club hands a venue the schedule through Export.
 *  10. NEW SCHEDULE, ROUND TWO (Stage 11c, ratified 2026-10-12 — hub → Stage 11c; design log "NEW SCHEDULE, ROUND TWO"):
 *      no Teams at once in The time; Each team's time beside Split the time; prime time whole in Who, and how much, with
 *      no Keep / Rotate; rules as sentences with ONE Add a rule; Remove this rule in ink (RecordAction, /design D2); a
 *      shared slot's chip stacks its names and carries no "Shared" mark (D4); the page never says its time zone (D1).
 *  12. COPYING IS HOW THE WINDOW OPENS (owner 2026-10-13, decision sheet https://claude.ai/artifact/1eReDtSsJLkLNAunzRredf,
 *      Asks 1–2 + /design D1–D5): once the club has a schedule, New schedule opens on its schedules as rows (dates ·
 *      venues), an "or", Cancel and the lime Start blank (Start from the permit, from a permit's page); never in
 *      Settings…; step 1 has no Copy field and its line names what it was copied from. No Back to the list (Ask 2).
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
  it('a phone reads Day · By team: one day, its arrows over the days with slots — never the desk’s seven columns (owner, 2026-10-12)', () => {
    const page = readCode(PAGE);
    assert.match(page, /views=\{\[\{ id: 'grid', label: W\.phoneDay \}, \{ id: 'team', label: W\.viewTeam \}\]\}/);
    assert.match(page, /const days = useMemo\(\(\) => \(read \? slotDays\(read\.slots\) : \[\]\), \[read\]\);/);
    assert.match(page, /<ScopeNav placement="row"/);
    assert.doesNotMatch(page, /phoneWeek|phoneSeg/, 'the phone no longer borrows the desk’s seven columns (seven Sundays on the dome)');
    assert.equal(SCHEDULE_SCREEN_WORDS.phoneDay, 'Day');
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
  it('Save as a draft goes to the schedule’s page with the window still open (KitDialog’s rule — §300 W2, 2026-10-12)', () => {
    // Closing the window first let its Back step's tidy-up cancel the navigation: the admin stayed on a stale list.
    const list = readCode(LIST);
    assert.match(list, /onSaved=\{id => router\.push\(href\(id\)\)\}/);
    assert.doesNotMatch(list, /setNewOpen\(false\);\s*router\.push/);
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
    assert.match(readCode(SHEET), /\{notOnWord\(clubSource\?\.handedBack\)\}/);
    assert.match(readCode('components/coaches/ClubSlotParts.tsx'), /\(handedBack \? C\.handedBack : STATE_WORDS\.cancelled\)/);
    assert.equal(SCHEDULE_COACH_WORDS.handedBack, 'Handed back');
  });
});

describe('9 · a send tells the club’s coaches only, never the venue', () => {
  it('no send reads the venue’s bookings contact, and the Send window offers no row for it', () => {
    for (const file of ['lib/club-schedule-send.ts', `${KIT}/SendWindow.tsx`, `${KIT}/ScheduleWindows.tsx`, 'lib/club-schedule-words.ts']) {
      assert.doesNotMatch(readCode(file), /bookings_email|bookingsEmail|bookingsRow|bookingsChanges/, file);
    }
  });
});

describe('10 · New schedule, round two: three questions, rules as sentences, sharing a facility (Stage 11c)', () => {
  const code = readCode(NEW);
  const who = code.slice(code.indexOf('const whoSection'), code.indexOf('const rulesSection'));
  const time = code.slice(code.indexOf('const timeSection'), code.indexOf('const unit ='));
  it('The time asks no Teams at once — who shares a facility is a rule about teams (Ask 1)', () => {
    assert.doesNotMatch(code, /teamsAtOnce|ns-atonce/);
    assert.doesNotMatch(time, /sharing|W\.prime\b/);
    assert.equal('teamsAtOnce' in SCHEDULE_SCREEN_WORDS, false);
  });
  it('Each team’s time sits beside Split the time, a dropdown with its sentence under it (Ask 4)', () => {
    const split = who.indexOf('id="ns-split"'), mode = who.indexOf('id="ns-time-mode"');
    assert.ok(split > 0 && mode > split, 'both in Who, and how much, Split first');
    assert.ok(mode - split < 900, 'in the same pair');
    assert.match(who, /<option value="same">\{W\.timeSame\}<\/option>\s*<option value="moved">\{W\.timeMoved\}<\/option>/);
    assert.match(who, /draft\.timeMode === 'moved' \? W\.timeMovedHint : W\.timeSameHint/);
  });
  it('prime time is whole in Who, and how much — its hours and how it is shared; no Keep / Rotate anywhere (Ask 5)', () => {
    assert.match(who, /id="ns-prime"/);
    assert.match(who, /id="ns-pshare"/);
    assert.ok(who.indexOf('id="ns-prime"') > who.indexOf('<FormTable'), 'after the teams and their shares');
    for (const source of [code, readCode('lib/club-schedule-words.ts')]) assert.doesNotMatch(source, /primeMode|primeKeep|primeRotate|Rotate it weekly/);
  });
  it('rules read as sentences with a pencil, open in place, and ONE Add a rule door holds every kind (Ask 6)', () => {
    const rules = code.slice(code.indexOf('const rulesSection'), code.indexOf('// ── Step 2: the drafts'));
    assert.equal(rules.match(/aria-hidden \/>\{W\.addRule\}/g)?.length, 1, 'one Add a rule');
    assert.match(code, /className=\{!r\.whole \? sch\.ruleUnfinished : r\.idle \? sch\.ruleIdle : sch\.ruleSentence\}/);
    assert.match(code, /data-escape-owner=\{adding \? '' : undefined\}/, 'the menu answers Escape, never the whole window');
    assert.match(code, /aria-label=\{W\.editRule\(said\)\}/);
    assert.match(code, /aria-label=\{W\.ruleDone\}/, 'the ✓ in the pencil’s spot');
    assert.doesNotMatch(code, /W\.(addWindow|addDayOff|addFieldsBy|ruleWindows|ruleDaysOff|fieldsBy)\b/, 'no empty heading or Add door per kind');
    assert.deepEqual(Object.values(SCHEDULE_SCREEN_WORDS.ruleKinds).map(k => k.title),
      ['Start and finish times', 'A team’s day off', 'Facilities for a group', 'Sharing a facility', 'At most, a day or a week']);
    assert.match(rules, /\{W\.always\}/, 'the three safeguards under Always');
    assert.match(code, /useAnchoredMenu\(adding, addRef, addMenuRef/, 'the menu hangs over the window');
  });
  it('Remove this rule is ink — the record’s undoable door, never a red delete (/design D2)', () => {
    assert.match(code, /<RecordAction icon=\{<Trash2 size=\{13\} aria-hidden \/>\} onClick=\{\(\) => removeRule\(r\)\}>\{W\.removeRule\}<\/RecordAction>/);
    assert.doesNotMatch(code, /RecordDelete/);
  });
  it('a shared slot’s chip stacks its names, its edge in each team’s colour, and carries no “Shared” mark (D4)', () => {
    const grid = readCode(GRID);
    assert.match(grid, /s\.teamIds\.map\(t => <span key=\{t\} className=\{sch\.slotName\}>\{nameOf\(t\)\}<\/span>\)/);
    assert.match(grid, /'--edge': edge/);
    assert.match(grid, /\$\{shared \? `, \$\{W\.slotShared\}` : ''\}/, 'its accessible name says shared');
    assert.doesNotMatch(grid, />\s*Shared\s*</);
    assert.doesNotMatch(grid, /teamIds\.map\(nameOf\)\.join\(' · '\)/, 'never the old one-line join');
  });
  it('the schedule’s page never says its time zone (/design D1, owner 2026-10-12)', () => {
    assert.doesNotMatch(readCode(PAGE), /Eastern time|zoneSentence|timesIn/);
  });
  it('a sharing team’s count says “shared” wherever a team’s slots are counted — never a bare 50 that reads as double the time', () => {
    const page = readCode(PAGE);
    assert.equal(page.match(/r\?\.shared \? W\.sharedCount\(r\.got, r\.shared\)/g)?.length, 2, 'By team at a desk and on a phone');
    assert.match(readCode('components/admin/kit/club/schedules/FairShares.tsx'), /W\.sharedCount\(r\.got, r\.shared\)/);
    assert.match(code, /r\.shared \? W\.sharedCount\(r\.got, r\.shared\) : W\.rowSlots\(r\.got\)/, 'the drafts’ By team');
  });
});

/* 11 · A HAND-BACK MAY ASK FOR MONEY BACK (Stage 11d part A, ratified 2026-10-12 — hub → Stage 11d, specimens 1–5): the
   tick sits on Hand back only when the Sundays carry a figure; an asked practice wears the amber "Money back asked" pill
   (sheet and row); the club answers in ONE window whose foot is a sentence left, Decline… · Accept right; Credited is a
   fifth figure only on a bill that has a credit; an accepted ask is settled with Record paying, never a second Approve. */
describe('11 · a hand-back may ask for money back (Stage 11d)', () => {
  const parts = readCode(SLOT_PARTS);
  it('the tick sits on Hand back only when the picked Sundays carry a figure, and says what it asks', () => {
    assert.match(parts, /\{money && picked && picked\.cents > 0 && \(\s*<label className=\{own\.money\}/);
    assert.match(parts, /<input type="checkbox" checked=\{askMoney\}/);
    assert.match(parts, /<b>\{H\.tick\(picked\.cents\)\}<\/b>/);
  });
  it('an asked practice wears the amber pill — on its sheet and on its row — and the sheet offers Withdraw', () => {
    assert.match(parts, /export function HandBackAskedPill\(\) \{\s*return <span className=\{`\$\{styles\.badge\} \$\{styles\.badgePending\}`\}>\{H\.pill\}<\/span>;/);
    assert.match(readCode('components/coaches/ScheduleCalendarViews.tsx'), /\{clubSource\?\.ask && !cancelled && <HandBackAskedPill \/>\}/);
    assert.match(readCode(SHEET), /WithdrawAskQuestion/);
  });
  it('on a phone the ask’s status ends the body; the pinned foot keeps only its door (owner, 2026-10-13)', () => {
    const sheet = readCode(SHEET);
    assert.match(sheet, /const askStatusBlock = isPhone && canAddEvents && clubSource\?\.ask && !clubSource\.ask\.late \? <HandBackAskStatus ask=\{clubSource\.ask\} inBody \/> : null;/);
    assert.equal(sheet.match(/\{descriptionBlock\}\{resourcesBlock\}\{askStatusBlock\}\{actionsBlock\}/g)?.length, 2, 'in both orders, just before the actions');
    assert.match(sheet, /askInBody=\{isPhone\}/);
    assert.match(parts, /\{!askInBody && <HandBackAskStatus ask=\{ask\} \/>\}/);
  });
  it('the club answers a waiting ask in ONE window: the sentence at the foot’s left, Decline… then Accept', () => {
    const answer = readCode('components/admin/kit/club/money/AnswerWindow.tsx');
    assert.match(answer, /footerStart=\{read && read\.state === 'waiting' \? <span className=\{repKit\.footNote\}>\{H\.answerFoot\(read\.teamName\)\}<\/span>/);
    assert.ok(answer.indexOf('{H.declineDoor}') > 0 && answer.indexOf('{H.declineDoor}') < answer.indexOf(': H.accept}'), 'Decline… before Accept');
    // The rule lives in the ONE shared request flow (Club Accounting · Teams, Ask 5), which Payment requests and a team's
    // account both mount — so every door to a waiting ask's request opens Answer.
    assert.match(readCode('components/admin/kit/club/money/RequestFlow.tsx'),
      /if \(!ask && r\.handBack && r\.status === 'pending'\) \{\s*return <AnswerWindow/, 'a waiting ask’s request opens Answer, never Approve');
    assert.match(readCode('app/[orgSlug]/admin/accounting/payment-requests/page.tsx'), /<RequestFlow key=\{open\.id\} request=\{open\}/);
  });
  // The club's bill window keeps Credited but no longer as a FIFTH figure: its date left the band (owner 2026-10-16,
  // option A — `club-bill-outstanding-line.test.ts`). The coach's bill room keeps all five.
  it('Credited joins the band only on a bill that has a credit — the coach’s band and the club’s bill window', () => {
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx'), /\.\.\.\(figures\.credited > 0\.005 \? \[\{ label: HB\.credited,/);
    assert.match(readCode('components/admin/kit/club/money/BillWindows.tsx'), /\.\.\.\(f\.credited > 0 \? \[\{ key: 'credited', label: HAND_BACK_WORDS\.credited,/);
  });
  it('an accepted ask is settled with Record paying, never a second Approve (D6)', () => {
    const windows = readCode('components/admin/kit/club/money/RequestWindows.tsx');
    assert.match(windows, /canMove && r\.status === 'accepted' \? \(\s*(\/\/[^\n]*\n\s*)?<button type="button" className="btn btn-lime" onClick=\{\(\) => onAsk\('approve'\)\}>\{HB\.recordPayingButton/);
    assert.match(windows, /paying \? HB\.recordPayingTitle\(r\.teamName/);
  });
});

describe('12 · copying is how New schedule opens, never a field inside it (owner, 2026-10-13)', () => {
  const code = readCode(NEW);
  const opening = code.slice(code.indexOf('const choosing ='), code.indexOf('const timeSection'));
  const has = (src: string, piece: string, why?: string) => assert.ok(src.includes(piece), why ?? piece);
  it('the opening screen shows only when there is a schedule to copy, and never in Settings…', () => {
    has(code, 'const choosing = !editing && !started && !!inputs?.schedules.length;');
    has(code, 'else if (choosing) body = openingBody;');
  });
  it('the club’s schedules are rows with their dates and venues, then an "or"', () => {
    has(opening, '<ClubRow key={s.id} as="button" chevron title={s.name}');
    has(opening, "caption={[scheduleDates(s.startsOn, s.endsOn), s.venues].filter(Boolean).join(' · ')}");
    has(opening, '<div className={sch.or}>');
  });
  it('its foot is Cancel beside the lime — every create window keeps Cancel (/design D1, 2026-10-09)', () => {
    const foot = code.slice(code.indexOf('const footOpening'), code.indexOf('let body: ReactNode;'));
    assert.ok(foot.indexOf('{W.cancel}') > 0 && foot.indexOf('{W.cancel}') < foot.indexOf('btn btn-lime'), 'Cancel, then the lime');
    has(foot, 'startPermit ? W.startFromPermit : W.startBlank');
    has(code, 'footer={choosing ? footOpening :');
  });
  it('step 1 has no Copy field and no "Don’t copy"; its line names the copy', () => {
    assert.doesNotMatch(code, /ns-copy|dontCopy|copyHint/);
    assert.equal('dontCopy' in SCHEDULE_SCREEN_WORDS, false);
    has(code, 'copiedFrom ? W.copiedFrom(copiedFrom) : W.step1');
    assert.equal(SCHEDULE_SCREEN_WORDS.copiedFrom('Winter dome 2026–27'), 'Step 1 of 2 · settings · copied from Winter dome 2026–27');
  });
  it('changing your mind is Cancel — the window’s back stays step 2’s (Ask 2)', () => {
    has(code, "back={step === 'drafts' ? { label: W.settingsBack, onBack: () => setStep('settings') } : undefined}");
  });
});

/* 13 · THE ASK ON THE SCHEDULE'S PAGE, AND FAIR SHARES B (Stage 11d part B — hub → Stage 11d, specimen 3, `#s11d-format`
   D1, D4, D5; Sidebar Strip & Grid Width Stage 1, ratified 2026-10-12): Answer is the page's one lime while an ask waits;
   an asked Sunday carries Hand back's glyph, never the ring alone; a hand-back is never a change waiting for a send; the
   page reads `?answer=`; Fair shares' figures sit above the line and its teams under the grid. */
describe('13 · the ask on the schedule’s page; Fair shares B (Stage 11d part B)', () => {
  const page = readCode(PAGE);
  const parts = readCode(`${KIT}/ScheduleParts.tsx`);
  const grid = readCode(GRID);
  const css = readCode(`${KIT}/Schedules.module.css`);
  it('Answer is the page’s one lime while an ask waits: the oldest ask’s; Send the changes beside it steps down to outlined', () => {
    assert.match(page, /<AskCallout key=\{a\.id\} ask=\{a\} places=\{v\.places\} lime=\{i === 0\}/);
    assert.match(parts, /className=\{`btn \$\{lime \? 'btn-lime' : 'btn-outline'\}`\} onClick=\{onAnswer\}>\{H\.answer\}/);
    assert.match(page, /className=\{`btn \$\{answering \? 'btn-outline' : 'btn-lime'\}`\} onClick=\{\(\) => setWin\(\{ kind: 'send', start: 'changes' \}\)\}/);
    assert.match(page, /onAnswer=\{v\.canMoney \? \(\) => setWin\(\{ kind: 'answer', id: a\.id \}\) : undefined\}/, 'Answer only for someone who moves club money');
    assert.match(parts, /H\.calloutTailLate\(ask, !!onAnswer\) : H\.calloutTail\(ask, !!onAnswer\)/, 'without Answer, the callout’s last line says who answers');
  });
  it('an asked Sunday carries Hand back’s own glyph in its own class — never the ring alone (D1)', () => {
    assert.match(grid, /ask \? sch\.slotAsked : ''/);
    assert.match(grid, /\{ask && <Undo2 size=\{12\} className=\{sch\.slotAskGlyph\} aria-hidden \/>\}/);
    assert.match(grid, /\$\{ask \? `, \$\{H\.pill\.toLowerCase\(\)\} by \$\{ask\.teamName\}` : ''\}/, 'its name says so');
    assert.match(css, /\.slotAskGlyph \{/);
    assert.match(page, /\{asked\.has\(x\.id\) && <RepChip tone="warn"><Undo2 size=\{12\} aria-hidden \/>\{H\.pill\}<\/RepChip>\}/, 'a phone’s Day carries the same mark');
  });
  it('a hand-back is never a change waiting for a send (Ask 9): the changes callout reads the club’s changes only', () => {
    assert.doesNotMatch(page, /handedBack\]|changes\.handedBack/);
    assert.match(page, /const changeLines = v\.changes\.teams\.flatMap/);
  });
  it('the page reads ?answer= (D5): Answer opens over it for a money mover; an ask no longer waiting says so', () => {
    assert.match(page, /useRef<string \| null>\(search\.get\('answer'\)\)/);
    assert.match(page, /if \(!r\.data\.asks\.some\(a => a\.id === asked\)\) setNotice\(\{ id: \+\+noticeSeq\.current, text: H\.doorStale \}\);\s*else if \(r\.data\.canMoney\) setWin\(\{ kind: 'answer', id: asked \}\);/);
    assert.match(page, /<AnswerWindow q=\{q\} handBackId=\{win\.id\}/);
  });
  it('Fair shares B: the band above the line, the week’s lines above the grid, the teams in a card under it', () => {
    const at = (s: string) => { const i = page.indexOf(s); assert.ok(i > 0, s); return i; };
    assert.ok(at('<FairSharesBand model={fair}') < at('<CoachListToolbar actions'), 'the band above the toolbar');
    assert.ok(at('<FairSharesLines model={fair} />') < at('<ScheduleGrid'), 'the lines above the grid');
    assert.ok(at('<ScheduleGrid') < at('<FairSharesTeams model={fair}'), 'the card under the grid');
    assert.doesNotMatch(css, /\.body \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 300px/, 'no 300 column beside the grid');
  });
});
