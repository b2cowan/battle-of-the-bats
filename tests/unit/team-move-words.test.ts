import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import * as words from '../../lib/team-move-words.ts';
import { coachPlanEndsLine, ownPlanEndOf } from '../../lib/team-move-carve-out.ts';

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
 *
 * ⚖ NARROWED 2026-11-19 (owner ruling (a), CLUB_ON_SALE_PAGES_PLAN.md): the rule is superseded for ONE
 * sentence at ONE place — the coach is told at their yes that their own plan ends today and the unused part
 * is not refunded. That sentence lives only in `lib/team-move-carve-out.ts`. Everywhere else the rule above
 * still holds, and the last describe below fails if a refund word appears outside that module.
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
    const billing = readSource('lib/plan-billing-words.ts');
    const nudge = billing.slice(billing.indexOf('clubBody:'), billing.indexOf('keepPremium:', billing.indexOf('clubBody:')));
    assert.ok(nudge.length > 0, 'the billing nudge moved — re-point this guard');
    assert.doesNotMatch(nudge, NO_MONEY_BACK);
    assert.match(nudge, /won’t be charged for your own Coaches Portal again/);
    const shared = readCode('components/billing/BillingBody.tsx');
    assert.match(shared, /W\.change\.clubBody/);
    assert.match(readSource('lib/plan-billing-words.ts'), /won’t be charged for your own Coaches Portal again/);
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
    assert.match(readSource('app/[orgSlug]/coaches/link-org/page.tsx'), /: COACH_PLAN_LINE\}/);
  });
});

describe('the one place a move says "not refunded" (ruling (a), 2026-11-19)', () => {
  const club = 'Northfield Minor Ball';
  const paidOn = { kind: 'paid', endsOn: '2027-03-01' } as const;

  it('the sentence is /legal’s, word for word, with the date', () => {
    assert.equal(
      coachPlanEndsLine({ clubName: club, plan: paidOn, dateText: 'Mar 1, 2027' }),
      'Your own plan ends today, because Northfield Minor Ball now covers this team. ' +
      'You won’t be charged for it again, and the unused part of what you paid, to Mar 1, 2027, is not refunded.',
    );
  });

  it('a paying coach with no usable date hears it without a date, never an invented one', () => {
    const line = coachPlanEndsLine({ clubName: club, plan: { kind: 'paid', endsOn: null }, dateText: null });
    assert.match(line, /You won’t be charged for it again, and the unused part of what you paid is not refunded\.$/);
    assert.doesNotMatch(line, /, to /);
  });

  it('a trial, free time or no subscription says nothing about a refund: there is nothing paid', () => {
    const line = coachPlanEndsLine({ clubName: club, plan: { kind: 'nothing_paid' }, dateText: null });
    assert.equal(line, 'Your own plan ends today, because Northfield Minor Ball now covers this team. You won’t be charged for it.');
    assert.doesNotMatch(line, NO_MONEY_BACK);
  });

  it('classifies the coach’s plan: paid with the renewal date, paid without one, a trial, free time, no subscription', () => {
    assert.deepEqual(ownPlanEndOf({ realSubscription: true, status: 'active', waitsOn: '2027-03-01' }), { kind: 'paid', endsOn: '2027-03-01' });
    // Already set to end at renewal: the stored period end is the same date, so the same answer.
    assert.deepEqual(ownPlanEndOf({ realSubscription: true, status: 'active', waitsOn: '2027-03-01' }), { kind: 'paid', endsOn: '2027-03-01' });
    assert.deepEqual(ownPlanEndOf({ realSubscription: true, status: 'active', waitsOn: null }), { kind: 'paid', endsOn: null });
    // Past due: the current period is unpaid, so there is no paid part to say is forfeited (/accounting, 2026-11-20).
    assert.deepEqual(ownPlanEndOf({ realSubscription: true, status: 'past_due', waitsOn: '2027-03-01' }), { kind: 'nothing_paid' });
    assert.deepEqual(ownPlanEndOf({ realSubscription: true, status: 'trialing', waitsOn: '2027-01-01' }), { kind: 'nothing_paid' });
    assert.deepEqual(ownPlanEndOf({ realSubscription: false, status: 'active', waitsOn: null }), { kind: 'nothing_paid' });
  });

  it('the refund words exist ONLY in the carve-out module, in a screen’s own code, never beside the club’s or the bells’ words', () => {
    assert.match(readCode('lib/team-move-carve-out.ts'), /is not refunded/);
    for (const file of ['lib/team-move-words.ts', 'app/[orgSlug]/admin/rep-teams/bring-in/page.tsx', 'app/[orgSlug]/coaches/link-org/page.tsx',
      'app/api/coaches/[orgSlug]/team-links/route.ts']) {
      // (The Settings page and BillingBody talk about dues credits and billing elsewhere, so they are not scanned whole;
      // the billing nudge and the help articles are pinned by their own blocks above.)
      assert.doesNotMatch(readCode(file), NO_MONEY_BACK, file);
    }
  });

  it('the coach’s page shows the sentence on the card AND in the confirm window, from the carve-out module only', () => {
    const page = readCode('app/[orgSlug]/coaches/link-org/page.tsx');
    assert.match(page, /from '@\/lib\/team-move-carve-out'/);
    assert.equal((page.match(/endsLineFor\(/g) ?? []).length, 3, 'defined once, used on the card and in the confirm window');
    // Owner 2026-11-20: the card said "won't be charged" twice. The ends line carries ruling (c)'s meaning; the general
    // line is only the fallback when the coach's plan is unknown, never shown beside it.
    assert.match(page, /ownPlan \? endsLineFor\(club, ownPlan\) : COACH_PLAN_LINE/, 'one money statement on the card, not two');
    // Owner 2026-11-20: one open request at a time as the coach sees it. The ask form is absent while a club waits on
    // the coach or the coach waits on a club, so "Ask a club" never sits under a club's own request.
    assert.match(page, /const canAsk = fromClubs\.length === 0 && mine\.length === 0;/);
    assert.match(page, /\{canAsk && <CoachPageSection title=\{COACH_REQUEST_FORM_TITLE\}>/);
    // The portal's standard white section card, never the retired tinted panel (owner 2026-09-21).
    assert.doesNotMatch(page, /detailSection/);
    // The club's screen is NOT changed by ruling (a).
    assert.doesNotMatch(readCode('app/[orgSlug]/admin/rep-teams/bring-in/page.tsx'), /team-move-carve-out|coachPlanEndsLine/);
  });

  it('the route reads the coach’s plan from the fields Plan & billing reads, and tells the page', () => {
    const route = readCode('app/api/coaches/[orgSlug]/team-links/route.ts');
    assert.match(route, /waitingDate\(/);
    assert.match(route, /hasRealSubscription\(/);
    assert.match(route, /ownPlanEndOf\(/);
    assert.match(route, /NextResponse\.json\(\{ links, ownPlan \}\)/);
  });
});

describe('"everything comes with it" follows the Club sale gate (ruling (c), 2026-11-19)', () => {
  const PROMISE = /Everything the team built comes with it/;

  it('the club’s and the coach’s page ledes drop the promise while Club is closed, and keep it while open', () => {
    assert.match(words.clubPageLede(C), PROMISE);
    assert.match(words.clubPageLede(C, true), PROMISE);
    assert.doesNotMatch(words.clubPageLede(C, false), PROMISE);
    assert.match(words.coachPageLede(T), PROMISE);
    assert.match(words.coachPageLede(T, true), PROMISE);
    assert.doesNotMatch(words.coachPageLede(T, false), PROMISE);
    for (const s of [words.clubPageLede(C, false), words.coachPageLede(T, false)]) assert.doesNotMatch(s, NO_MONEY_BACK);
  });

  it('every closed-state lede still names what happens (the team becomes one of the club’s)', () => {
    assert.match(words.clubPageLede(C, false), /becomes one of the club’s teams/);
    assert.match(words.coachPageLede(T, false), /you keep coaching it as one of the club’s teams/);
  });

  it('each reader reads the gate through isPlanOpen on a map that reads closed until it arrives', () => {
    for (const file of ['app/[orgSlug]/admin/rep-teams/bring-in/page.tsx', 'app/[orgSlug]/coaches/link-org/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx']) {
      const code = readCode(file);
      assert.match(code, /isPlanOpen\(usePlanGating\(\) \?\? \{\}, 'club'\)|isPlanOpen\(gating \?\? \{\}, 'club'\)/, file);
    }
    assert.match(readCode('app/[orgSlug]/admin/rep-teams/bring-in/page.tsx'), /clubPageLede\(clubName, clubOpen\)/);
    assert.match(readCode('app/[orgSlug]/coaches/link-org/page.tsx'), /coachPageLede\(ownTeamName, clubOpen\)/);
    // ⚖ UPDATED IN THE OPEN (Settings in both workspaces Session 2, C4, owner 2026-11-20): Organization holds the team's name,
    // web address and birthday date too, so the gate moved from the section onto the Join a club row (and its sentence).
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx'), /\{clubOpen && \(\s*<div className=\{styles\.settingRow\}>/);
  });

  it('a request that is already waiting keeps its "What comes with the team" column, whatever the sale state', () => {
    for (const file of ['app/[orgSlug]/admin/rep-teams/bring-in/page.tsx', 'app/[orgSlug]/coaches/link-org/page.tsx']) {
      assert.match(readCode(file), /\{WHAT_COMES_WITH_THE_TEAM\}/, file);
    }
  });

  it('the shared plan gate file stays import-free of runtime code (the demo seed scripts load it with plain Node)', () => {
    const imports = readSource('lib/plan-config.ts').split('\n').filter(l => /^\s*import\s/.test(l));
    assert.ok(imports.every(l => /^\s*import type\s/.test(l)), imports.join('\n'));
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
