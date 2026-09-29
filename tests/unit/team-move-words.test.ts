import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import * as words from '../../lib/team-move-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE WORDS OF A TEAM MOVE (Club Tier Stage 2, B04 / Ask 2).
 *
 * ⚖ Owner ruling 2026-09-28 on the coach's own subscription: "we don't need to refund them, they
 * just don't need to get charged in the future … make sure the messaging doesn't mention refunds and
 * focuses on how they will simply not get charged in the future." So on EVERY surface a coach or a
 * club reads about the move — both pages, the bells, the refusals, the billing nudge, the Settings
 * door, the team page banner and the help — no word about a refund, a credit, proration or money
 * back. The positive half is pinned too: both approval screens carry the "won't be charged" line.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const NO_MONEY_BACK = /\brefund|\bprorat|money back|\bcredit(?!\s*card)/i;

const T = 'Ridgeview 14U';
const C = 'Northfield Minor Ball';
const S = 'Sam Cole';

/**
 * Every sentence the words module produces — each builder called with real arguments. The export
 * check below fails when a new builder is added and not listed here, so no sentence escapes.
 */
const SENTENCES: Record<string, string[]> = {
  clubPageLede: [words.clubPageLede(C)],
  clubCostLine: [
    words.clubCostLine({ planLabel: 'Club', placesAfter: 10, limit: 15 }),
    words.clubCostLine({ planLabel: 'Club', placesAfter: 16, limit: 15 }),
    words.clubCostLine({ planLabel: 'Club', placesAfter: null, limit: null }),
  ],
  coachPlanLineForClub: [words.coachPlanLineForClub(S)],
  clubAfterLine: [words.clubAfterLine({ coachName: S, teamName: T, clubName: C })],
  clubCardTitle: [words.clubCardTitle(T, C)],
  openTournamentLineForClub: [words.openTournamentLineForClub(S, 'Ridgeview Fall Classic')],
  clubApproveButton: [words.clubApproveButton(T)],
  clubMovedNotice: [words.clubMovedNotice({ teamName: T }), words.clubMovedNotice({ teamName: T, slugChangedTo: 'ridgeview-14u-2' })],
  coachPageLede: [words.coachPageLede(T)],
  coachCardTitle: [words.coachCardTitle(C, T)],
  coachAfterLine: [words.coachAfterLine({ teamName: T, clubName: C })],
  openTournamentLineForCoach: [words.openTournamentLineForCoach('Ridgeview Fall Classic')],
  coachApproveButton: [words.coachApproveButton(C)],
  confirmTitle: [words.confirmTitle(T, C)],
  historyLine: (['moved', 'declined', 'withdrawn', 'retired_link'] as const).map(s => words.historyLine(s, { clubName: C, date: 'Sep 27' })),
  REFUSAL: Object.values(words.REFUSAL).map(v => (typeof v === 'function' ? v('sam@example.com') : v)),
  bellClubAsked: Object.values(words.bellClubAsked({ clubName: C, teamName: T })),
  bellCoachAsked: Object.values(words.bellCoachAsked({ coachName: S, teamName: T, clubName: C })),
  bellMovedForStaff: Object.values(words.bellMovedForStaff({ teamName: T, clubName: C })),
  bellMovedForClub: Object.values(words.bellMovedForClub({ teamName: T, clubName: C, coachName: S })),
  bellCoachDeclined: Object.values(words.bellCoachDeclined({ coachName: S, teamName: T, clubName: C })),
  bellClubDeclined: Object.values(words.bellClubDeclined({ clubName: C, teamName: T })),
};
/** Exports that are not sentences. */
const NOT_SENTENCES = new Set(['normalizeTeamNameForConfirm', 'teamNameConfirmed']);

function everyWord(): string[] {
  const out: string[] = Object.values(SENTENCES).flat();
  for (const value of Object.values(words)) if (typeof value === 'string') out.push(value);
  return out;
}

/** The customer-facing files the move shows up in (their prose AND their code). */
const SURFACES = [
  'lib/team-move-words.ts',
  'app/[orgSlug]/admin/rep-teams/bring-in/page.tsx',
  'app/[orgSlug]/coaches/link-org/page.tsx',
];

describe('the team move never mentions money coming back', () => {
  it('every sentence builder the words module exports is checked here', () => {
    const unchecked = Object.entries(words)
      .filter(([name, v]) => typeof v !== 'string' && !(name in SENTENCES) && !NOT_SENTENCES.has(name))
      .map(([name]) => name);
    assert.deepEqual(unchecked, [], 'a new builder in lib/team-move-words.ts must be added to SENTENCES');
  });

  it('no sentence the words module produces mentions a refund, a credit, proration or money back', () => {
    const offenders = everyWord().filter(s => NO_MONEY_BACK.test(s));
    assert.deepEqual(offenders, []);
  });

  it('neither page nor the words module says it anywhere either', () => {
    for (const file of SURFACES) {
      // CODE, comments stripped: the comments that explain this very rule name the word.
      assert.doesNotMatch(readCode(file), NO_MONEY_BACK, file);
    }
  });

  it('the coach’s billing nudge, Settings door and team banner say the same thing', () => {
    const billing = readSource('app/[orgSlug]/admin/org/billing/page.tsx');
    const nudge = billing.slice(billing.indexOf('Part of a club?'), billing.indexOf('Join a club', billing.indexOf('Part of a club?')));
    assert.ok(nudge.length > 0, 'the billing nudge moved — re-point this guard');
    assert.doesNotMatch(nudge, NO_MONEY_BACK);
    assert.match(nudge, /won’t be charged for your own Coaches Portal again/);
    assert.doesNotMatch(billing, /Basic visibility link/);
    assert.doesNotMatch(readSource('app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx'), /Connect your team for recognition/);
    assert.match(readSource('app/[orgSlug]/coaches/teams/[teamId]/page.tsx'), /wants to bring your team into the club/);
  });

  it('the help articles about the move say it the same way (their own blocks — other help talks about dues credits)', () => {
    const block = (file: string, id: string) => {
      const src = readCode(file);
      const start = src.indexOf(`id: '${id}',`);
      assert.ok(start > 0, `${file}: the '${id}' article moved — re-point this guard`);
      const next = src.indexOf("\n    {\n      id: '", start);
      return src.slice(start, next > 0 ? next : undefined);
    };
    const club = block('lib/help-content/rep-teams.tsx', 'recipe-bring-in-coach-team');
    const coach = block('lib/help-content/coaches.tsx', 'recipe-link-parent-org');
    const operator = block('lib/help-content/platform-admin.tsx', 'team-ownership-transfer');
    for (const [name, text] of [['club', club], ['coach', coach], ['operator', operator]] as const) {
      assert.doesNotMatch(text, NO_MONEY_BACK, name);
      assert.doesNotMatch(text, /basic visibility/i, `${name}: the retired link is not explained as a step`);
    }
    assert.match(club, /won&apos;t be charged for their own Coaches Portal again|won’t be charged for their own Coaches Portal again/);
    assert.match(coach, /won&apos;t be charged for your own Coaches Portal again|won’t be charged for your own Coaches Portal again/);
    assert.doesNotMatch(readCode('lib/help-content/org.tsx'), /recipe-review-team-link-request/, 'the club recipe lives under Rep Teams now');
  });

  it('the ruling’s positive sentence is on BOTH approval screens', () => {
    assert.match(words.coachPlanLineForClub('Sam Cole'), /^Sam Cole won’t be charged for their own Coaches Portal again\./);
    assert.match(words.COACH_PLAN_LINE, /^You won’t be charged for your own Coaches Portal again\./);
    assert.match(readSource('app/[orgSlug]/admin/rep-teams/bring-in/page.tsx'), /coachPlanLineForClub\(coach\)/);
    assert.match(readSource('app/[orgSlug]/coaches/link-org/page.tsx'), /\{COACH_PLAN_LINE\}/);
  });
});

describe('the words themselves', () => {
  it('never guess the coach’s pronouns (the drawing said "his")', () => {
    const offenders = everyWord().filter(s => /\b(he|him|his|she|her|hers)\b/i.test(s));
    assert.deepEqual(offenders, []);
  });

  it('never speak in internal words (J4-037)', () => {
    const offenders = everyWord().filter(s => /phase 5a|platform[- ]assisted|platform override|basic visibility|ownership transfer/i.test(s));
    assert.deepEqual(offenders, []);
  });

  it('the cost is a team place, never a price, and never "16 of 15" at the cap', () => {
    assert.equal(words.clubCostLine({ planLabel: 'Club', placesAfter: 10, limit: 15 }),
      'Included in your Club plan. It takes one of your team places: 10 of 15 after.');
    assert.equal(words.clubCostLine({ planLabel: 'Club · Association', placesAfter: null, limit: null }),
      'Included in your Club · Association plan.');
    assert.equal(words.clubCostLine({ planLabel: 'Club', placesAfter: 16, limit: 15 }),
      'Included in your Club plan. All 15 of your team places are in use, so make room first.');
    assert.doesNotMatch(words.clubCostLine({ planLabel: 'Club', placesAfter: 10, limit: 15 }), /\$/);
  });

  it('the typed confirmation forgives case and spaces, nothing else', () => {
    assert.ok(words.teamNameConfirmed('  ridgeview   14u ', 'Ridgeview 14U'));
    assert.ok(!words.teamNameConfirmed('Ridgeview 14', 'Ridgeview 14U'));
    assert.ok(!words.teamNameConfirmed('', 'Ridgeview 14U'));
    assert.ok(!words.teamNameConfirmed('anything', ''), 'an empty team name confirms nothing');
  });

  it('every sentence says the move can’t be undone where a yes is given', () => {
    assert.match(words.clubAfterLine({ coachName: 'Sam', teamName: 'T', clubName: 'C' }), /can’t be undone/);
    assert.match(words.coachAfterLine({ teamName: 'T', clubName: 'C' }), /can’t be undone/);
    assert.match(words.CONFIRM_BODY_CLUB, /can’t be undone/);
    assert.match(words.CONFIRM_BODY_COACH, /can’t be undone/);
  });
});
