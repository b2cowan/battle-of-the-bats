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
      assert.ok(moment.said.length > 20, `${moment.key} does not narrate — a press must never be silent`);
      // The tournament world has two REAL audiences, so all three of its moments must still differ.
      assert.ok(moment.saidOperator && moment.saidOperator.length > 20,
        `${moment.key} lost its operator voice — a family and an organizer are told different things here`);
      assert.notEqual(moment.saidOperator, moment.said,
        `${moment.key} says the same words to both sides — omit saidOperator instead of duplicating it`);
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
   * stub-state assertion; grown to five moments in Phase 2). Same dock component, its own
   * contract: the moments in SEASON order, every press a plain in-org navigation, and —
   * deliberately — NO live dot and NO countdown anywhere: nothing in the coach demo moves while
   * you watch (nightly re-anchor), and the chrome never claims motion the clock won't deliver.
   */
  const coachDemo = getDemoOrgByKind('coach')!;
  const coachOrg = { slug: coachDemo.slug, landingPath: coachDemo.landingPath };

  test('the coach dock: five moments of a season, in order, all inside the coach portal', () => {
    const moments = sandboxMoments('coach', coachOrg);
    // Season order, not build order — a visitor reads this row as a year, left to right.
    assert.deepEqual(moments.map(m => m.key),
      ['tryout-day', 'off-season', 'season-start', 'mid-season', 'seasons-end']);
    assert.equal(new Set(moments.map(m => m.teamId)).size, moments.length,
      'two moments share a team — one of them could never be the highlighted chip');
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

describe('the tour, trimmed to its doors', () => {
  test('four steps, numbered 1..4, and the count never changes with who is looking', () => {
    const asOrganizer = sandboxTourSteps('tournament', org, { isDemoOrganizer: true });
    const asVisitor = sandboxTourSteps('tournament', org, { isDemoOrganizer: false });
    assert.deepEqual(asOrganizer.map(s => s.n), [1, 2, 3, 4]);
    assert.equal(asVisitor.length, asOrganizer.length);
  });

  /**
   * This test used to assert the OPPOSITE — that steps 5 and 6 landed on the two moments and
   * narrated them. They did, and that was the problem: the dock already offers both jumps, so the
   * tour was spending two of its steps restating the season switcher. Owner ruling 2026-08-28,
   * from measured copy: the tour keeps its DOORS and gives up its prose, and a door the dock
   * already owns is not a door. Rather than delete the test with the steps, it is inverted into a
   * guard, so re-adding either one fails here instead of quietly re-crowding the screen.
   */
  /**
   * ⚠ SHARING A DOCK DESTINATION IS A DECISION, AND IT HAS TO EARN ITSELF.
   *
   * Steps 5 and 6 used to land exactly where the Registration-week and Morning-after chips land
   * and say roughly what they say — two of six steps spent restating the switcher. They were cut
   * on 2026-08-28. Step 1 also shares a destination (Game day's public home) and was NOT cut,
   * because it does something the chip cannot: it arms the live-score watch that then follows the
   * visitor through the rest of the demo. That is the distinction this guard encodes — not
   * "never overlap", but "overlap only where the step adds something the dock has no way to do".
   *
   * Adding a step that lands on a dock destination and brings nothing extra fails here. If a new
   * one genuinely earns its place, add it to JUSTIFIED_OVERLAPS with the reason, in the same
   * change — the way HISTORY_ENDPOINTS makes a year parameter a deliberate decision.
   */
  const JUSTIFIED_OVERLAPS: Record<number, string> = {
    1: 'arms the live-score watch that rides the chrome for the rest of the demo — a dock chip cannot',
    3: "the tour's one crossing from the family side to the operator side; the chip can only land you "
       + 'on the side you are already standing on, so it cannot make that handoff',
  };

  test('a tour step only re-treads a dock jump when it adds something the dock cannot', () => {
    const steps = sandboxTourSteps('tournament', org, { isDemoOrganizer: true });
    // A moment has TWO landing addresses, not one — the public side and the operator side — and a
    // step can collide with either. An earlier version of this guard read a `href` property that
    // SandboxMoment does not have, so it compared every step against a set of `undefined`, matched
    // nothing, and passed while proving nothing. A size check did not save it: a Set holding one
    // `undefined` still has size 1. Types caught it; the green run never would have.
    const momentHrefs = new Set(
      sandboxMoments('tournament', org).flatMap(m => [m.fanPath, m.operatorPath]),
    );
    assert.ok(momentHrefs.size >= 2, 'no dock destinations to compare against — this guard has gone blind');
    for (const href of momentHrefs) {
      assert.equal(typeof href, 'string', 'a dock destination is not a string — the guard is comparing nothing');
    }

    for (const step of steps) {
      if (!momentHrefs.has(step.href)) continue;
      assert.ok(
        JUSTIFIED_OVERLAPS[step.n],
        `step ${step.n} ("${step.label}") lands where a dock chip already goes and adds nothing — ` +
        'the dock owns that jump. Cut it, or record why it earns its place.',
      );
    }
  });

  test('every justified overlap still names a step that exists', () => {
    // An excuse outliving the step it excused is how an allow-list quietly stops meaning anything.
    // Deliberately NOT asserting a behaviour per entry: the reasons here are editorial judgements
    // about a tour's shape, and a predicate invented to "verify" prose would pass for the wrong
    // reasons. This is the HISTORY_ENDPOINTS pattern — a list of DECISIONS someone had to make on
    // purpose, kept honest by failing when a decision no longer corresponds to anything.
    const steps = sandboxTourSteps('tournament', org, { isDemoOrganizer: true });
    for (const n of Object.keys(JUSTIFIED_OVERLAPS).map(Number)) {
      assert.ok(steps.some(s => s.n === n), `step ${n} is excused for overlapping a dock jump but no longer exists`);
    }
  });

  test('every remaining step still says something — a door with no sentence is a dead end', () => {
    for (const step of sandboxTourSteps('tournament', org, { isDemoOrganizer: true })) {
      assert.ok(step.said.length > 20, `step ${step.n} narrates nothing`);
    }
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
