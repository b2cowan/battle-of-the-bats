import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getDemoOrgByKind, isDemoOrganizerEmail, DEMO_COACH_TEAM_IDS, DEMO_COACH_SHOWCASE,
} from '../../lib/demo-org.ts';
import { isReservedOrgSlug } from '../../lib/reserved-slugs.ts';
import {
  formatResetCountdown, msUntilSandboxReset, sandboxBannerCopy, sandboxTourSteps, sandboxMoments,
} from '../../lib/sandbox-chrome.ts';
import {
  SANDBOX_HIDDEN_TOURNAMENT_NAV_KEYS, isNavKeyHiddenInSandbox,
} from '../../lib/sandbox-curation.ts';
import { SEE_IT_LIVE_PATH } from '../../lib/sandbox-door.ts';
import { DEMO_CYCLE_MINUTES } from '../../lib/demo-tournament.ts';

/**
 * Slices S3 (the door), S4 (the chrome) and S6 (curation).
 *
 * The write-block contract lives in `demo-sandbox-write-guard.test.ts` and is the guarantee this
 * door rests on. What is pinned HERE is the door's own non-negotiables — the ones that would fail
 * quietly and dangerously rather than loudly:
 *
 *   • nothing derived from the request may choose who gets signed in, and there is deliberately no
 *     redirect parameter at all;
 *   • the door path can never be shadowed by an org slug;
 *   • the countdown reads the same cycle the reconcile job writes against.
 */

const demo = getDemoOrgByKind('tournament')!;

/** Read once, lazily — the test runner transpiles to CJS, so no top-level await. */
let doorSourceCache: string | null = null;
async function doorSource(): Promise<string> {
  doorSourceCache ??= await readFile(new URL('../../app/see-it-live/route.ts', import.meta.url), 'utf8');
  return doorSourceCache;
}

describe('the door (S3)', () => {
  test('signs in exactly one hardcoded, allow-listed, unreachable address', () => {
    assert.equal(isDemoOrganizerEmail(demo.organizerEmail), true);
    assert.match(demo.organizerEmail, /@example\.com$/);
  });

  test('takes no redirect target from the request — not even a validated one', async () => {
    // An open redirect wearing a marketing button. The landing path is a constant on the
    // allow-list entry; if this ever needs to vary, it varies in lib/demo-org.ts, not in a URL.
    const src = await doorSource();
    assert.ok(!/searchParams\.get\(\s*['"]next['"]/.test(src), 'door must not read ?next');
    assert.ok(!/searchParams\.get\(\s*['"]redirect/.test(src), 'door must not read ?redirect');
    assert.ok(!/searchParams\.get\(\s*['"]email/.test(src), 'door must not read ?email');
  });

  test('resolves its redirect host through a trusted-origin helper, never a raw Origin header', async () => {
    const src = await doorSource();
    // ⚠ Was `resolveTrustedAppOrigin` until 2026-08-07. That helper answers with the CANONICAL
    // host, which is right for a link going into an email and wrong for a redirect the visitor
    // follows on this request: the door sets the session cookie for the host it was ASKED for, so
    // sending them to a different host throws the session away. See the host-parity block at the
    // foot of this file for the production trace.
    assert.ok(src.includes('resolveSameHostOrigin'), 'door must use resolveSameHostOrigin');
    assert.ok(
      !/headers\.get\(\s*['"]origin['"]\s*\)/i.test(src),
      'door must not read the request Origin header directly',
    );
  });

  test('is rate-limited', async () => {
    const src = await doorSource();
    assert.ok(src.includes('FixedWindowRateLimiter'), 'door must be rate-limited');
    assert.ok(src.includes("globalLimiter.take('global')"), 'a spoofing-proof global ceiling is required');
  });

  test('asks for nothing before letting a visitor in — no form, no email, no interstitial', async () => {
    // The GTM posture is binding (BUSINESS_DECISIONS.md 2026-08-02). A door that reads a body has
    // started collecting something.
    const src = await doorSource();
    assert.ok(!/req(uest)?\.json\(\)/.test(src), 'the door must not read a request body');
    assert.ok(!/export async function POST/.test(src), 'the door is a GET; a POST implies a form');
  });

  test('the confirm screen is reachable ONLY for a visitor who is already signed in', async () => {
    // The ungated ruling forbids asking a STRANGER for something. The confirm screen asks a
    // CUSTOMER for permission before replacing their session — so it must be gated on there being
    // a session at all, and a logged-out visitor must never meet it.
    const src = await doorSource();
    const confirmLine = src.split('\n').find(l => l.includes('SANDBOX_CONFIRM_PATH') && l.includes('redirect'));
    assert.ok(confirmLine, 'the door must redirect to the confirm screen somewhere');

    const rateLimit = src.indexOf('ipLimiter.take(ip)');
    const seededLookup = src.indexOf('await demoOrgIdForSlug(');
    const sessionCheck = src.indexOf('await currentSessionUser(');
    const attach = src.indexOf('await attachDemoSession('); // the CALL, not the import line

    // Two orderings, both of which were defects before the 2026-08-03 review:
    //   • metering comes FIRST, so the failure branches below it can't be used to spend uncapped
    //     queries and uncapped `critical` alerts;
    //   • the existing-session check comes BEFORE any session is written, so a real customer's
    //     account can never be replaced without the confirm screen.
    assert.ok(rateLimit > 0 && seededLookup > rateLimit,
      'the rate limiter must be spent before any lookup or alert');
    assert.ok(sessionCheck > 0 && attach > sessionCheck,
      'the existing-session check must come before the door writes any session');
  });

  test('the session swap is a POST that takes no input', async () => {
    const src = await readFile(new URL('../../app/api/sandbox/switch/route.ts', import.meta.url), 'utf8');
    assert.ok(/export async function POST/.test(src), 'destroying a session must not be a GET');
    assert.ok(!/export async function GET/.test(src), 'a GET here would be sign-out-by-image-tag');
    assert.ok(!/req(uest)?\.json\(\)/.test(src), 'the swap must not read a request body');
    assert.ok(src.includes('isTrustedAppOrigin'), 'the swap must refuse a cross-origin submit');
    assert.ok(src.includes('FixedWindowRateLimiter'), 'the swap must be rate-limited');
    // Same non-negotiable as the door: nothing from the request may choose the account.
    assert.ok(!/searchParams\.get\(/.test(src), 'the swap must take no parameters at all');
  });

  test('its path can never be shadowed by an organization slug', () => {
    assert.equal(isReservedOrgSlug(SEE_IT_LIVE_PATH.replace('/', '')), true);
  });

  test('lands on the fan side — the half that proves it is live within seconds', () => {
    assert.ok(demo.landingPath.startsWith(`/${demo.slug}/`), demo.landingPath);
    assert.ok(!demo.landingPath.includes('/admin'), 'the door must not land on the operator side');
  });
});

describe('the chrome (S4)', () => {
  test('the countdown reads the reconcile job’s own cycle', () => {
    const cycleMs = DEMO_CYCLE_MINUTES * 60_000;
    // Cycles are anchored to absolute epoch time, so a browser and a scheduled job agree without
    // talking to each other. At a boundary the answer is a full cycle, never zero.
    assert.equal(msUntilSandboxReset(DEMO_CYCLE_MINUTES, 0), cycleMs);
    assert.equal(msUntilSandboxReset(DEMO_CYCLE_MINUTES, cycleMs), cycleMs);
    assert.equal(msUntilSandboxReset(DEMO_CYCLE_MINUTES, cycleMs + 60_000), cycleMs - 60_000);
  });

  test('the countdown never renders a negative or malformed clock', () => {
    assert.equal(formatResetCountdown(0), '00:00');
    assert.equal(formatResetCountdown(-5000), '00:00');
    assert.equal(formatResetCountdown(61_000), '01:01');
    // A two-hour cycle means minutes are NOT capped at 59.
    assert.equal(formatResetCountdown(90 * 60_000), '90:00');
  });

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
      // ⚠ Nothing in this demo moves while you watch — the re-anchor is nightly. A step that
      // claimed a live payoff would be the tournament sandbox's hardest-won lesson, re-learned.
      assert.equal(step.watchesLiveScore, undefined, `step ${step.n} promises motion this demo has none of`);
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

    // The one row the tour addresses by name. If the seed stops minting it at this id the step
    // lands on a 404, which is the one failure a narration sentence cannot paper over.
    const recapStep = steps.find(s => s.anchor?.includes('family-recap'));
    assert.ok(recapStep, 'the family-recap beat is part of the approved spine');
    assert.ok(recapStep!.href.endsWith(DEMO_COACH_SHOWCASE.midSeasonPlayerId),
      'the family-recap step must address the fixed showcase player');
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
  test('covers the four ratified corners and nothing else', () => {
    // Ratified 2026-08-02: billing/subscription, staff invitations, data tools/exports, deep
    // settings forms. `settings` is the Settings & Access hub and carries three of the four.
    assert.deepEqual(
      [...SANDBOX_HIDDEN_TOURNAMENT_NAV_KEYS].sort(),
      ['data-tools', 'settings', 'settings/event'],
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

  test('every door that mints a session uses the same-host resolver, not the email one', async () => {
    // The four routes that set the demo cookie and redirect in one response. An email-bound
    // resolver in any of them reintroduces the production defect verbatim.
    const doors = [
      'app/see-it-live/route.ts',
      'app/see-it-live/coaches/route.ts',
      'app/api/sandbox/switch/route.ts',
      'app/api/sandbox/switch-coach/route.ts',
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
