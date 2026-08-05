import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_ORGS, getDemoOrgByKind, DEMO_TOURNAMENT_SLUG, DEMO_OPENER_SLUG, DEMO_INVITATIONAL_SLUG,
} from '../../lib/demo-org.ts';
import { sandboxMoments, sandboxTourSteps } from '../../lib/sandbox-chrome.ts';
import { SEE_IT_LIVE_PATH } from '../../lib/sandbox-door.ts';
import { demoBracketSeeds } from '../../lib/demo-tournament.ts';
import {
  resolveOpenerState, resolveInvitationalState, openerBracketSeeds,
  invitationalAttentionBuckets, INVITATIONAL_TEAMS,
} from '../../lib/demo-moments.ts';
import { utcToZonedInputs, ORG_TIME_ZONE } from '../../lib/timezone.ts';

/**
 * Phase 2 — the moments dock. What is pinned here:
 *
 *   • **Shape B is a decision, not an accident**: one demo ORG, three tournaments. Adding a
 *     second org to the allow-list is a different (rejected) architecture and must be a
 *     deliberate edit to this file.
 *   • The two still moments are pure functions of the clock, and the year stays in ORDER at any
 *     instant — morning-after strictly over, registration week strictly ahead.
 *   • The Invitational's payment buckets hold their exact mockup counts through the app's REAL
 *     attention engine — the U13 deposit deadline sits in the past by construction, so exactly
 *     one team reads Past Due.
 *   • The dock and the tour obey the rules the first tour paid for: every press narrates, no
 *     step count changes with who is looking, and operator doors fall back to the door.
 */

const demo = getDemoOrgByKind('tournament')!;
const org = { slug: demo.slug, landingPath: demo.landingPath };

describe('shape B — one org, three tournaments', () => {
  test('the allow-list still holds exactly ONE tournament demo org', () => {
    assert.equal(DEMO_ORGS.filter(o => o.kind === 'tournament').length, 1);
  });
  test('the three events carry three distinct slugs under that one org', () => {
    const slugs = [DEMO_TOURNAMENT_SLUG, DEMO_OPENER_SLUG, DEMO_INVITATIONAL_SLUG];
    assert.equal(new Set(slugs).size, 3);
  });
});

describe('the still moments are pure functions of the clock', () => {
  const instants = [
    new Date('2026-08-04T15:00:00Z'),
    new Date('2026-08-04T03:59:00Z'),   // just before Toronto midnight
    new Date('2026-08-04T04:01:00Z'),   // just after
    new Date('2026-12-31T05:00:00Z'),   // year boundary, EST
    new Date('2026-03-08T06:30:00Z'),   // DST spring-forward morning
  ];

  test('same instant, same answer — twice', () => {
    for (const now of instants) {
      assert.deepEqual(resolveOpenerState(now), resolveOpenerState(now));
      assert.deepEqual(resolveInvitationalState(now), resolveInvitationalState(now));
    }
  });

  test('the year stays in order at every instant: over, now, ahead', () => {
    for (const now of instants) {
      const localToday = utcToZonedInputs(now.toISOString(), ORG_TIME_ZONE).date;
      const opener = resolveOpenerState(now);
      const invitational = resolveInvitationalState(now);
      assert.ok(opener.startDate < opener.endDate, `opener window inverted at ${now.toISOString()}`);
      assert.ok(opener.endDate < localToday, `opener not over at ${now.toISOString()}`);
      assert.ok(invitational.startDate > localToday, `invitational not ahead at ${now.toISOString()}`);
      assert.ok(invitational.startDate < invitational.endDate);
    }
  });

  test('every Opener game is completed and scored — the moment has no loose ends', () => {
    const opener = resolveOpenerState(instants[0]);
    assert.equal(opener.games.length, 15);
    for (const game of opener.games) {
      assert.equal(game.status, 'completed');
      assert.ok(Number.isFinite(game.homeScore) && Number.isFinite(game.awayScore));
      assert.notEqual(game.homeScore, game.awayScore, `${game.key} ended in a tie`);
    }
  });

  test("the Opener's champion is NOT the Summer Classic's leading club — the world must not read as scripted", () => {
    assert.notEqual(openerBracketSeeds()[0].name, demoBracketSeeds()[0].name);
  });
});

describe("the Invitational's pipeline — the mockups' exact numbers, by the app's real engine", () => {
  // The same shared mapping the hourly sweep uses — one plumbing, three verifiers.
  const buckets = (now: Date) => invitationalAttentionBuckets(
    resolveInvitationalState(now),
    utcToZonedInputs(now.toISOString(), ORG_TIME_ZONE).date,
  );

  test('2 pending review · 2 waitlisted · 3 unpaid · exactly 1 past due · 0 missing email', () => {
    const b = buckets(new Date('2026-08-04T15:00:00Z'));
    assert.equal(b.pending_review, 2);
    assert.equal(b.waitlist, 2);
    assert.equal(b.unpaid, 3);
    assert.equal(b.past_due, 1);
    assert.equal(b.missing_email, 0);
  });

  test('and those counts hold across midnight and DST seams', () => {
    for (const iso of ['2026-08-04T03:59:00Z', '2026-08-04T04:01:00Z', '2026-11-01T06:30:00Z']) {
      const b = buckets(new Date(iso));
      assert.equal(b.past_due, 1, `past_due drifted at ${iso}`);
      assert.equal(b.unpaid, 3, `unpaid drifted at ${iso}`);
    }
  });

  test('U11 is exactly full and U13 has room — so registration reads OPEN with a waitlist forming', () => {
    const u11 = INVITATIONAL_TEAMS.filter(t => t.division === 'U11');
    assert.equal(u11.filter(t => t.status === 'accepted').length, 8);
    assert.equal(u11.filter(t => t.status === 'waitlist').length, 2);
    const u13 = INVITATIONAL_TEAMS.filter(t => t.division === 'U13');
    assert.ok(u13.filter(t => t.status === 'accepted').length < 8);
  });
});

describe('the dock', () => {
  test('three moments, in the order the year happens, each naming its time', () => {
    const moments = sandboxMoments('tournament', org);
    assert.deepEqual(moments.map(m => m.key), ['registration-week', 'game-day', 'morning-after']);
    for (const moment of moments) {
      assert.ok(moment.sub.length > 0, `${moment.key} has no time anchor`);
      assert.ok(moment.saidPublic.length > 20 && moment.saidOperator.length > 20,
        `${moment.key} does not narrate both sides — a press must never be silent`);
    }
  });

  test('Game day is the only live moment, and the only one that keeps the replay countdown', () => {
    const moments = sandboxMoments('tournament', org);
    assert.deepEqual(moments.filter(m => m.isLive).map(m => m.key), ['game-day']);
    for (const moment of moments) {
      if (moment.key === 'game-day') assert.equal(moment.bannerNote, null);
      else assert.ok(moment.bannerNote && moment.bannerNote.length > 0,
        `${moment.key} would show the Summer Classic's replay countdown — a lie in its banner`);
    }
  });

  test('fan paths stay inside the demo org; operator paths fall back to the door without a session', () => {
    const asOrganizer = sandboxMoments('tournament', org, { isDemoOrganizer: true });
    const asVisitor = sandboxMoments('tournament', org, { isDemoOrganizer: false });
    for (const moment of asOrganizer) {
      assert.ok(moment.fanPath.startsWith(`/${demo.slug}/`), `${moment.key} fan path leaves the org`);
      assert.ok(moment.operatorPath.startsWith(`/${demo.slug}/admin/`), `${moment.key} operator path is not admin`);
    }
    for (const moment of asVisitor) {
      assert.equal(moment.operatorPath, SEE_IT_LIVE_PATH,
        `${moment.key} operator path would wall a visitor without the demo session`);
    }
    assert.equal(asOrganizer.length, asVisitor.length, 'the dock never changes shape with who is looking');
  });

  /**
   * The coach sandbox's phase dock (built 2026-08-04, replacing the earlier "renders no dock"
   * stub-state assertion). Same dock component, its own contract: three moments in season
   * order, every press a plain in-org navigation, and — deliberately — NO live dot and NO
   * countdown anywhere: nothing in the coach demo moves while you watch (nightly re-anchor),
   * and the chrome never claims motion the clock won't deliver.
   */
  const coachDemo = getDemoOrgByKind('coach')!;
  const coachOrg = { slug: coachDemo.slug, landingPath: coachDemo.landingPath };

  test("the coach dock: three moments of a season, in order, all inside the coach portal", () => {
    const moments = sandboxMoments('coach', coachOrg);
    assert.deepEqual(moments.map(m => m.key), ['tryout-day', 'mid-season', 'seasons-end']);
    for (const moment of moments) {
      assert.ok(moment.teamId, `${moment.key} names no team — the dock could not highlight it`);
      assert.ok(moment.fanPath.startsWith(`/${coachDemo.slug}/coaches/teams/`),
        `${moment.key} leaves the coach portal`);
      assert.equal(moment.fanPath, moment.operatorPath,
        `${moment.key} splits sides — the coach portal has no public half`);
    }
    // The dock's default moment and the door agree by construction: both derive from the team id.
    assert.equal(moments.find(m => m.key === 'mid-season')!.fanPath, coachDemo.landingPath);
  });

  test('the coach dock claims no motion: no live dot, and every moment carries its own banner note', () => {
    const moments = sandboxMoments('coach', coachOrg);
    assert.deepEqual(moments.filter(m => m.isLive), [],
      'a live dot promises movement while you watch; the coach demo re-anchors nightly');
    for (const moment of moments) {
      assert.ok(moment.bannerNote && moment.bannerNote.length > 0,
        `${moment.key} would fall back to a replay countdown that belongs to the tournament demo`);
    }
  });
});

describe('the tour, grown to six', () => {
  test('six steps, numbered 1..6, and the count never changes with who is looking', () => {
    const asOrganizer = sandboxTourSteps('tournament', org, { isDemoOrganizer: true });
    const asVisitor = sandboxTourSteps('tournament', org, { isDemoOrganizer: false });
    assert.deepEqual(asOrganizer.map(s => s.n), [1, 2, 3, 4, 5, 6]);
    assert.equal(asVisitor.length, asOrganizer.length);
  });

  test('steps 5 and 6 land on the moments and narrate them', () => {
    const steps = sandboxTourSteps('tournament', org, { isDemoOrganizer: true });
    const five = steps.find(s => s.n === 5)!;
    const six = steps.find(s => s.n === 6)!;
    assert.ok(five.href.endsWith('/registrations'));
    assert.equal(five.tournamentSlug, DEMO_INVITATIONAL_SLUG);
    assert.ok(six.href.endsWith('/summary'));
    assert.equal(six.tournamentSlug, DEMO_OPENER_SLUG);
    assert.ok(five.said.length > 20 && six.said.length > 20);
  });

  test('every operator step names its event for an organizer — three tournaments share one admin', () => {
    const steps = sandboxTourSteps('tournament', org, { isDemoOrganizer: true });
    for (const step of steps.filter(s => s.href.includes('/admin/'))) {
      assert.ok(step.tournamentSlug, `step ${step.n} would land on whichever event the admin last edited`);
    }
  });

  test('without the demo session no step carries a tournament pin — the door takes no parameters', () => {
    const steps = sandboxTourSteps('tournament', org, { isDemoOrganizer: false });
    for (const step of steps) {
      if (step.href === SEE_IT_LIVE_PATH) assert.equal(step.tournamentSlug, undefined);
    }
  });
});
