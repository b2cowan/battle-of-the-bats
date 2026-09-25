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
const schedule = read('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx');
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
    assert.match(awardIdRoute, /describeAwardOccasion\(\s*current,/);
    assert.doesNotMatch(awardIdRoute, /linked to a game/);
  });
});

describe('the schedule window offers awards on every event', () => {
  it('the door is permission only — no isGame', () => {
    assert.match(doors, /awards: canManageAwards\(caps\),/);
  });

  it('a non-game event shows its section only once it can carry one', () => {
    assert.match(schedule, /const awardUnlock = awardUnlockState\(ev, nowMs\);/);
    assert.match(schedule, /drawerDoors\.awards && \(isGameEvent \? \(!isPhone \|\| scoreLeads\) : awardUnlock === 'open'\)/);
  });

  it('builds the Give form label from the shared helper, on the org-zone day', () => {
    assert.match(schedule, /label: `\$\{awardOccasionLabel\(selectedEvent, null\)\} — \$\{shortDate\(orgDayKey\(selectedEvent\.startsAt\)\)\}`/);
    assert.doesNotMatch(schedule, /vs \$\{selectedEvent\.opponent \?\? 'opponent'\}/);
  });

  /** Owner, first look at the build (2026-09-25): "why is give awards in a different place in
   *  practices vs. games?" — so a started non-game's awards sit ABOVE attendance at both widths,
   *  where a started game's already do. */
  it('places a non-game event\'s awards above attendance at both widths — where a game\'s sit', () => {
    assert.match(schedule, /\{practiceBlock\}(\r?\n)\s*\{!isGameEvent && awardsBlock\}(\r?\n)\s*\{actionsBlock\}/);
    assert.match(schedule, /\{practiceBlock\}(\r?\n)\s*\{\/\*[\s\S]{0,500}?\*\/\}(\r?\n)\s*\{awardsBlock\}(\r?\n)\s*\{peekWarnBlock\}\{tabsBlock\}\{tabContent\}/);
  });
});

describe('every label reads the one occasion helper', () => {
  it('the hydrated award carries occasionLabel, not a bare opponent', () => {
    assert.match(db, /occasionLabel: awardOccasionLabel\(/);
    assert.doesNotMatch(db, /eventOpponent/);
  });

  it('the report reads occasionLabel for its "For" column and its edit form', () => {
    assert.match(reportPanel, /const forText = a\.occasionLabel/);
    assert.doesNotMatch(reportPanel, /eventOpponent/);
  });

  it('the merge preview names the event kind, not "game" for everything', () => {
    assert.match(db, /describeDatedAwardOccasion\(/);
    assert.doesNotMatch(db, /`for the \$\{shortDate\} game`/);
  });
});
