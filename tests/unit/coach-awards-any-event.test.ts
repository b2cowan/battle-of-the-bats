/**
 * AWARDS AT ANY EVENT (owner, 2026-09-25): "I should be able to assign awards at any event,
 * including practices." The pure rules — when an event unlocks, what an award reads as — are pinned
 * in rep-award-occasion.test.ts. This file pins the WIRING: that the window, the give route and
 * every label actually read those rules, because the defect this project exists to prevent is
 * quiet — each surface would read fine alone while calling a practice award "General" in one
 * place and "vs opponent" in another. Plan: docs/projects/active/COACH_AWARDS_AT_ANY_EVENT_PLAN.md.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');
// The schedule's event sheet — its own file since the Schedule deep dive's split (S6, 2026-09-25).
const schedule = read('components/coaches/ScheduleEventSheet.tsx');
const awardsRoute = read('app/api/coaches/[orgSlug]/teams/[teamId]/awards/route.ts');
const awardIdRoute = read('app/api/coaches/[orgSlug]/teams/[teamId]/awards/[awardId]/route.ts');
const reportPanel = read('app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx');
const doors = read('lib/coach-schedule-doors.ts');
const db = read('lib/db.ts');

describe('the give route opens on the same rule the window shows by', () => {
  it('asks awardUnlockState — never a hand-written score check', () => {
    assert.match(awardsRoute, /awardUnlockState\(event, Date\.now\(\)\)/);
    assert.doesNotMatch(awardsRoute, /event\.teamScore == null/);
  });

  it('dates an event award on its org-zone day, never the UTC slice', () => {
    assert.match(awardsRoute, /awardedAt = orgDayKey\(event\.startsAt\)/);
    assert.doesNotMatch(awardsRoute, /awardedAt = event\.startsAt\.slice/);
  });

  it('names the event kind in its refusals', () => {
    assert.match(awardsRoute, /describeAwardOccasion\(\{ eventId, tournamentLabel, awardedAt \}, eventType\)/);
    // the occasion AS IT WILL BE — a renamed label included (/review, 2026-09-25)
    assert.match(awardIdRoute, /describeAwardOccasion\(\s*occasion,/);
    assert.doesNotMatch(awardIdRoute, /linked to a game/);
  });
});

describe('the schedule window offers awards on every event', () => {
  it('the door is permission only — no isGame', () => {
    assert.match(doors, /awards: canManageAwards\(caps\),/);
  });

  it('a non-game event shows its section only once it can carry one', () => {
    assert.match(schedule, /const awardUnlock = awardUnlockState\(ev, nowMs\);/);
    // A game's section waits for the score to lead — at EVERY width since the Schedule deep dive's
    // stage 1 · E6 (2026-09-25): the desk no longer draws the locked box on a game days away.
    assert.match(schedule, /drawerDoors\.awards && \(isGameEvent \? scoreLeads : awardUnlock === 'open'\)/);
  });

  it('builds the Give form label from the shared helper, on the org-zone day', () => {
    // The sheet names its event `ev` (it is handed one; the page's `selectedEvent` is that event).
    assert.match(schedule, /label: `\$\{awardOccasionLabel\(ev, null\)\} — \$\{shortDate\(orgDayKey\(ev\.startsAt\)\)\}`/);
    assert.doesNotMatch(schedule, /vs \$\{(selectedEvent|ev)\.opponent \?\? 'opponent'\}/);
  });

  /** Owner, first look at the build (2026-09-25): "why is give awards in a different place in
   *  practices vs. games?" — so a started non-game's awards sit ABOVE attendance at both widths,
   *  where a started game's already do. */
  it('places a non-game event\'s awards above attendance at both widths — where a game\'s sit', () => {
    // Since the Schedule deep dive's stage 1 (E1 · E6, 2026-09-25) there is ONE order per clock at
    // every width, and attendance is a door ROW: a started non-game's awards sit directly above the
    // rows, as a started game's awards sit above them in the score-first order.
    assert.match(schedule, /\) : \((\r?\n)\s*<>(\r?\n)\s*\{summary\}(\r?\n)\s*\{awardsBlock\}(\r?\n)\s*\{doorRows\}/, 'rows first: the awards, then the rows');
    assert.match(schedule, /\{scoreBlock\}\{tagsBlock\}\{awardsBlock\}(\r?\n)\s*\{doorRows\}/, 'score first: the score, the awards, then the rows');
    assert.doesNotMatch(schedule, /const body = !isPhone/, 'no second order at a desk');
  });
});

describe('every label reads the one occasion helper', () => {
  it('the hydrated award carries occasionLabel, not a bare opponent', () => {
    assert.match(db, /occasionLabel: awardOccasionLabel\(/);
    assert.doesNotMatch(db, /eventOpponent/);
  });

  it('the report reads occasionLabel for its "For" column and its edit form', () => {
    assert.match(reportPanel, /const awardFor = \(a: RepPlayerAward\) => a\.occasionLabel \?\? \(a\.tournamentLabel \|\| 'General'\)/);
    assert.doesNotMatch(reportPanel, /eventOpponent/);
  });

  it('the merge preview names the event kind, not "game" for everything', () => {
    assert.match(db, /describeDatedAwardOccasion\(/);
    assert.doesNotMatch(db, /`for the \$\{shortDate\} game`/);
  });
});
