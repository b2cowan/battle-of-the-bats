import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getDemoOrgByKind, DEMO_COACH_TEAM_IDS, DEMO_COACH_SHOWCASE,
} from '../../lib/demo-org.ts';
import { isReservedOrgSlug } from '../../lib/reserved-slugs.ts';
import {
  sandboxBannerCopy, sandboxTourSteps, sandboxMoments,
} from '../../lib/sandbox-chrome.ts';
import {
  SANDBOX_HIDDEN_TOURNAMENT_NAV_KEYS, isNavKeyHiddenInSandbox,
} from '../../lib/sandbox-curation.ts';
import { SEE_IT_LIVE_PATH, RETIRED_DEMO_LANDING, sandboxDoorsVisible } from '../../lib/sandbox-door.ts';

/**
 * Slices S3 (the door), S4 (the chrome) and S6 (curation).
 *
 * ⚠ The door is SHUT (owner ruling 2026-11-25): the S3 block below now pins that no public address
 * signs anyone in and every old demo address lands on /pricing. The chrome and curation pins stay
 * until Phase 3 of RETIRE_PUBLIC_DEMOS_PLAN.md deletes the demo machinery and this file with it,
 * because a demo session may still be open until Phase 2 deletes the shared accounts.
 */

const demo = getDemoOrgByKind('tournament')!;

/**
 * The doors are SHUT (owner ruling 2026-11-25, "Both public demos are RETIRED"; Ask 1 ruled A). This block used to pin
 * how the door signed a stranger into the shared demo account safely. It now pins the opposite: no public address
 * signs anyone in, and every old demo address lands on /pricing. Phase 3 of RETIRE_PUBLIC_DEMOS_PLAN.md deletes the
 * routes and this file with them.
 */
const readRepo = (rel: string) => readFile(new URL(`../../${rel}`, import.meta.url), 'utf8');
/** Comment-stripped, so a docblock that names the old calls can never be what satisfies (or fails) a pin. */
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** Anything that could read, mint or swap a session. */
const SESSION_CODE = /demo-session|attachDemoSession|currentSessionUser|signIn|createServerClient|supabase|getSignedInUser|demo-org|cookies\(/;

describe('the doors are shut (retired 2026-11-25)', () => {
  test('the marketing switch is off in code, whatever the Amplify variable says (Decision D1)', () => {
    const before = process.env.NEXT_PUBLIC_SEE_IT_LIVE_DOORS;
    try {
      for (const value of ['true', 'false', '', undefined]) {
        if (value === undefined) delete process.env.NEXT_PUBLIC_SEE_IT_LIVE_DOORS;
        else process.env.NEXT_PUBLIC_SEE_IT_LIVE_DOORS = value;
        assert.equal(sandboxDoorsVisible(), false, `the doors showed with the variable at ${JSON.stringify(value)}`);
      }
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_SEE_IT_LIVE_DOORS;
      else process.env.NEXT_PUBLIC_SEE_IT_LIVE_DOORS = before;
    }
  });

  test('every old demo address lands on the pricing page (Ask 1 ruled A)', () => {
    assert.equal(RETIRED_DEMO_LANDING, '/pricing');
  });

  test('both door routes answer with a permanent redirect and sign nobody in', async () => {
    for (const file of ['app/see-it-live/route.ts', 'app/see-it-live/coaches/route.ts']) {
      const code = codeOf(await readRepo(file));
      assert.match(code, /NextResponse\.redirect\(\s*new URL\(\s*RETIRED_DEMO_LANDING,\s*resolveSameHostOrigin\(request\)\s*\),\s*308\s*\)/,
        `${file} must redirect 308 to the retired-demo landing on the host the visitor asked for`);
      assert.doesNotMatch(code, SESSION_CODE, `${file} must not read, mint or swap a session`);
      assert.doesNotMatch(code, /searchParams/, `${file} must take nothing from the request`);
      assert.doesNotMatch(code, /export (async )?function POST/, `${file} is a GET only`);
    }
  });

  test('both confirm screens and /demos render nothing but a permanent redirect', async () => {
    for (const file of ['app/see-it-live/switch/page.tsx', 'app/see-it-live/coaches/switch/page.tsx', 'app/demos/page.tsx']) {
      const code = codeOf(await readRepo(file));
      assert.match(code, /permanentRedirect\(RETIRED_DEMO_LANDING\)/, `${file} must permanently redirect to the retired-demo landing`);
      assert.doesNotMatch(code, SESSION_CODE, `${file} must not read or swap a session`);
      assert.doesNotMatch(code, /<form|<Link|href=/, `${file} must offer no door`);
    }
  });

  test('both session-swap endpoints refuse with 410 Gone and touch no session', async () => {
    for (const file of ['app/api/sandbox/switch/route.ts', 'app/api/sandbox/switch-coach/route.ts']) {
      const code = codeOf(await readRepo(file));
      assert.match(code, /status:\s*410/, `${file} must answer 410`);
      assert.doesNotMatch(code, SESSION_CODE, `${file} must not touch a session`);
      assert.doesNotMatch(code, /export (async )?function GET/, `${file} grew a GET`);
    }
  });

  test('its path can never be shadowed by an organization slug (Decision D3)', () => {
    assert.equal(isReservedOrgSlug(SEE_IT_LIVE_PATH.replace('/', '')), true);
  });
});

describe('the chrome (S4)', () => {
  test('the banner never blames the visitor and never says a change failed', () => {
    for (const kind of ['tournament', 'coach'] as const) {
      for (const side of ['public', 'operator'] as const) {
        const copy = sandboxBannerCopy(side, kind);
        const text = `${copy.lead} ${copy.emphasis ?? ''} ${copy.toastText}`.toLowerCase();
        assert.ok(text.length > 0);
        for (const forbidden of ['error', 'failed', 'sorry', 'unable']) {
          assert.ok(!text.includes(forbidden), `${kind}/${side} banner said "${forbidden}": ${text}`);
        }
      }
    }
  });

  /**
   * The coach tour (Phase 3), pinned by the two things that would fail QUIETLY.
   *
   * Until 2026-08-05 this asserted `[]` — the correct "not built yet" state. Now that the steps
   * exist, the same slot pins the contract they have to keep: a step that lands somewhere the
   * visitor can already be standing, or that points at a person the seed no longer creates, reads
   * as a dead button rather than as an error, and nothing else in the build would catch either.
   *
   * ⚠ THE COUNT IS A RATCHET, NOT A CEILING. It went 7 → 8 on 2026-08-17 when the register shipped
   * and the tour gained a step for it (money redesign P3). Raising it is a deliberate act — the
   * assertion exists so that a step VANISHING is loud, which is the failure that reads as a
   * shorter, blander demo rather than as a bug.
   */
  test('the coach tour walks its own org, and no step can be a no-op', () => {
    const coachOrg = getDemoOrgByKind('coach')!;
    const steps = sandboxTourSteps('coach', coachOrg);
    assert.equal(steps.length, 8, 'the approved spine is eight beats');

    const teamIds = new Set<string>(Object.values(DEMO_COACH_TEAM_IDS));
    for (const step of steps) {
      assert.ok(step.said.trim().length > 20, `step ${step.n} has no sentence — it can read as dead`);
      assert.ok(step.href.startsWith(`/${coachOrg.slug}/coaches/teams/`),
        `step ${step.n} leaves the demo org: ${step.href}`);
      const teamId = step.href.split('/teams/')[1]?.split('/')[0];
      assert.ok(teamIds.has(teamId), `step ${step.n} names a team the seed does not build: ${teamId}`);
      assert.equal(step.tournamentSlug, undefined, `step ${step.n} pins an event; the coach portal has none`);
    }

    /**
     * ⚠ The prefix trap, pinned. `isOnStepPage` treats a step's destination as a SECTION unless the
     * step opts out, so a step landing on `/tryouts` counts a visitor standing on `/tryouts/score`
     * — where the moments dock drops them — as "already here", and the press does nothing at all.
     * Any step whose destination is an ancestor of somewhere else the demo can send someone must
     * therefore be exact.
     */
    // Ancestry is a PATH relationship — a destination may carry a query string (the Money hub's
    // tabs are `?section=…` since 2026-08-13), and `"a?x=1".startsWith("a?x=1/")` is false for
    // every possible child, which would quietly blind this guard for exactly those destinations.
    const pathOf = (href: string) => href.split('?')[0];
    for (const step of steps) {
      const stepPath = pathOf(step.href);
      const isAncestorOfAnother = steps.some(o => o !== step && pathOf(o.href).startsWith(`${stepPath}/`));
      const isAncestorOfADockLanding = sandboxMoments('coach', coachOrg)
        .some(m => pathOf(m.fanPath).startsWith(`${stepPath}/`));
      if (isAncestorOfAnother || isAncestorOfADockLanding) {
        assert.equal(step.exactPath, true,
          `step ${step.n} (${step.href}) is a parent of somewhere the demo already sends people — `
          + 'without exactPath, arriving there first makes this step a silent no-op');
      }
    }

    /**
     * ⚠ The SAME-PATH trap, pinned (One-Room build, 2026-08-23). Two destinations can now share
     * one pathname and differ only in query — tour step 1 (`/tryouts?stage=decide`) and the
     * dock's tryout-day moment (`/tryouts?stage=tryout-day&view=score`). `exactPath` cannot save
     * a step here: the matcher ignores params the step's OWN href does not name, so a step whose
     * query fails to contradict its sibling's counts a visitor standing on that sibling as
     * "already here" — the press does nothing. The step's href must name at least one param
     * whose value differs. (The ancestry guard above is startsWith(path + '/') and is blind to
     * this case by construction.)
     */
    const queryOf = (href: string) => new URLSearchParams(href.split('?')[1] ?? '');
    const coachLandings = sandboxMoments('coach', coachOrg).map(m => m.fanPath);
    for (const step of steps) {
      const siblings = [...steps.filter(o => o !== step).map(o => o.href), ...coachLandings]
        .filter(h => h !== step.href && pathOf(h) === pathOf(step.href));
      for (const sibling of siblings) {
        const sq = queryOf(step.href);
        const oq = queryOf(sibling);
        const distinguished = [...sq.entries()].some(([k, v]) => oq.get(k) !== v);
        assert.ok(distinguished,
          `step ${step.n} (${step.href}) shares a pathname with ${sibling} but names no query `
          + 'param that separates them — arriving at the sibling first makes this step a silent no-op');
      }
    }

    // The one row the tour addresses by name. If the seed stops minting it at this id the step
    // lands on a 404, which is the one failure a narration sentence cannot paper over.
    const recapStep = steps.find(s => s.anchor?.includes('family-recap'));
    assert.ok(recapStep, 'the family-recap beat is part of the approved spine');
    // The path names the player; the query names the TAB the recap row lives on (This season, since
    // the five-tab rebuild of 2026-09-13 — a bare player URL now lands on Details, where the anchor
    // is not). Both halves are load-bearing.
    const recapPath = recapStep!.href.split('?')[0];
    assert.ok(recapPath.endsWith(DEMO_COACH_SHOWCASE.midSeasonPlayerId),
      'the family-recap step must address the fixed showcase player');
    assert.ok(/[?&]tab=season(&|$)/.test(recapStep!.href),
      'the family-recap step must open the This season tab, where the recap row lives');
  });

  test('EVERY step narrates — the defect that made the first tour read as dead buttons', () => {
    // The regression this pins, measured against the running app on 2026-08-03: two steps anchored
    // to panels the product removes whenever no game is live (the fan page's Live Now section, the
    // dashboard's Now Playing strip). With the anchor gone each fell back to its href — which for
    // both was the page the visitor was already standing on — so pressing produced no scroll, no
    // navigation and no feedback whatsoever.
    //
    // The fix is that `said` is the deliverable and `anchor` is decoration: the narration strip
    // appearing is itself a visible change, on the spot the visitor just pressed. So a step
    // without a sentence is the bug, whatever else it carries.
    const steps = sandboxTourSteps('tournament', demo);
    assert.ok(steps.length >= 3, 'the tour needs at least three beats');
    for (const step of steps) {
      assert.ok(step.said && step.said.trim().length > 20,
        `step "${step.label}" has no sentence to show — it can read as a dead button`);
      assert.ok(step.href?.startsWith('/'), `step "${step.label}" has no destination`);
      // Written for a stranger: no vocabulary that only we use.
      for (const ours of ['sandbox', 'seed', 'reconcile', 'tick']) {
        assert.ok(!step.said.toLowerCase().includes(ours),
          `step "${step.label}" says "${ours}" to a visitor`);
      }
    }
    assert.deepEqual(steps.map(s => s.n), steps.map((_, i) => i + 1), 'steps must be numbered in order');
  });

  test('one tour spans BOTH halves — the flip is the climax, not a second tour', () => {
    // The first build ran two unrelated three-chip tours, so a visitor who flipped lost their
    // place and started again, which made the dual view read as a detour rather than the sale.
    const steps = sandboxTourSteps('tournament', demo);
    assert.ok(steps.some(s => s.href === demo.landingPath), 'the tour must start on the fan side');
    assert.ok(steps.some(s => s.href.includes('/admin/')), 'the tour must reach the operator side');
    // And it must get there in that order — watching a score arrive as a parent is what makes
    // the organizer's seat mean anything.
    const firstAdmin = steps.findIndex(s => s.href.includes('/admin/'));
    const firstFan = steps.findIndex(s => s.href.startsWith(demo.landingPath));
    assert.ok(firstFan < firstAdmin, 'the fan beats must come before the operator ones');
  });

  test('the operator steps point at the DOOR for anyone not holding the demo session', () => {
    // Anonymous (arrived by a shared link) or signed in as themselves: the admin shell would bounce
    // them, so those steps must route through the door, which knows how to place each of them. No
    // step is ever removed — the dual view is the beat that sells.
    const steps = sandboxTourSteps('tournament', demo, { isDemoOrganizer: false });
    assert.ok(!steps.some(s => s.href.includes('/admin/')), 'no direct admin link without the session');
    assert.ok(steps.some(s => s.href === SEE_IT_LIVE_PATH), 'the operator steps must route via the door');
    // The fan side's own beats are untouched, and the step count never changes with who is looking.
    assert.equal(steps.length, sandboxTourSteps('tournament', demo).length);
    assert.ok(steps.some(s => s.href === demo.landingPath));
  });
});

describe('curated surfaces (S6)', () => {
  test('covers the ratified corners and nothing else', () => {
    // Ratified 2026-08-02: billing/subscription, staff invitations, data tools/exports, deep
    // settings forms. `settings` is the Settings & Access hub and carries three of the four.
    // ⚰ `data-tools` left with its page (Tournament admin redesign Stage 5, E10, A59): Data tools retired, each import
    // now on Teams' Export and the schedule's Tools — whether a demo hides those doors is the /demos session's call.
    // `settings/notifications` (navigation Phase 2 Part B, 2026-11-10): the event's own mute page left the hub for the event's
    // sidebar ("Your notifications", T2) and stays hidden, as it was behind the hub — a visitor has nothing to mute.
    assert.deepEqual(
      [...SANDBOX_HIDDEN_TOURNAMENT_NAV_KEYS].sort(),
      ['settings', 'settings/event', 'settings/notifications'],
    );
  });

  test('hides nothing at all outside a sandbox', () => {
    for (const key of SANDBOX_HIDDEN_TOURNAMENT_NAV_KEYS) {
      assert.equal(isNavKeyHiddenInSandbox(false, key), false, `${key} must stay visible for customers`);
      assert.equal(isNavKeyHiddenInSandbox(true, key), true);
    }
    assert.equal(isNavKeyHiddenInSandbox(true, 'dashboard'), false, 'the demo must show the product deeply');
    assert.equal(isNavKeyHiddenInSandbox(true, 'schedule'), false);
  });
});

/**
 * The redirect host — the defect found on production 2026-08-07.
 *
 * The site answers on BOTH `fieldlogichq.ca` and `www.fieldlogichq.ca`, and cookies do not span the
 * two. Every door here mints the shared demo session and redirects in the same response, so if the
 * redirect lands on a different host than the cookie was written for, the visitor arrives anonymous
 * and is bounced to a login page — on a product whose whole promise is that there isn't one.
 *
 * ⚠ The old code asked for the CANONICAL origin, which is right for a link going into an EMAIL and
 * wrong for a redirect the visitor follows now. And it failed on the NORMAL path, not an edge case:
 * a browser sends `Origin` on CORS requests, form POSTs and fetches — never on a typed address or an
 * ordinary link — so a top-level navigation always fell through to the canonical fallback.
 *
 * What is pinned: a same-request redirect keeps the visitor on the host they arrived at, an
 * unrecognised host still falls back to canonical, and no door regresses to the email resolver.
 */
describe('demo doors keep the visitor on the host they arrived at', () => {
  /**
   * ⚠ These are STRUCTURAL pins, not behavioural ones, and the distinction is deliberate rather
   * than lazy: `lib/app-origin.ts` imports `server-only`, which is supplied by the Next bundler and
   * is not resolvable under `node --test`, so no unit test in this repo can execute it. That is why
   * every other test in this file also reads source. A test that LOOKED behavioural while only
   * matching text would be worse than one that says plainly what it checks.
   *
   * The behaviour itself was verified against production by walking both hosts on the live site
   * (2026-08-07): apex bounced to a login page, www landed in the demo. That trace is what this
   * pins against coming back.
   */
  test('the same-host resolver derives from the REQUEST url and still validates it', async () => {
    const src = await readFile(new URL('../../lib/app-origin.ts', import.meta.url), 'utf8');
    const fn = src.slice(src.indexOf('export function resolveSameHostOrigin'));
    // Comment-stripped like the door test below — a stale comment naming the old call must never
    // be what satisfies a pin.
    const body = fn
      .slice(0, fn.indexOf('\n}'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.ok(
      /new URL\(\s*req\.url\s*\)/.test(body),
      'the redirect base must come from the request URL, or a cookie set for that host is orphaned',
    );
    assert.ok(
      /isTrustedAppOrigin\(/.test(body),
      'the request host must still be validated through the shared predicate',
    );
    assert.ok(
      /resolveTrustedAppOrigin\(/.test(body),
      'an unrecognised host must fall back to the canonical origin, not be honoured',
    );
  });

  test('both retired doors still redirect on the same host, not the email one', async () => {
    // The two door routes no longer mint a session (retired 2026-11-25), but they still redirect, and a
    // redirect the visitor follows on this request belongs on the host they asked for. The two
    // session-swap endpoints left this list: they answer 410 and redirect nowhere.
    const doors = [
      'app/see-it-live/route.ts',
      'app/see-it-live/coaches/route.ts',
    ];
    for (const file of doors) {
      const src = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      assert.ok(
        /\bresolveSameHostOrigin\s*\(/.test(code),
        `${file} must CALL the same-host resolver — a bare import satisfies nothing`,
      );
      assert.ok(
        !/\bresolveTrustedAppOrigin\s*\(/.test(code),
        `${file} must not use the email-link resolver for a same-request redirect`,
      );
    }
  });
});
