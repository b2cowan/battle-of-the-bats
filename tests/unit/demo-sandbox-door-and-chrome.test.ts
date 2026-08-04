import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDemoOrgByKind, isDemoOrganizerEmail } from '../../lib/demo-org.ts';
import { isReservedOrgSlug } from '../../lib/reserved-slugs.ts';
import {
  formatResetCountdown, msUntilSandboxReset, sandboxBannerCopy, sandboxTourSteps,
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

  test('resolves its redirect host through the trusted-origin helper, never a raw Origin header', async () => {
    const src = await doorSource();
    assert.ok(src.includes('resolveTrustedAppOrigin'), 'door must use resolveTrustedAppOrigin');
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
    for (const side of ['public', 'operator'] as const) {
      const copy = sandboxBannerCopy(side);
      const text = `${copy.lead} ${copy.emphasis ?? ''}`.toLowerCase();
      assert.ok(text.length > 0);
      for (const forbidden of ['error', 'failed', 'sorry', 'unable']) {
        assert.ok(!text.includes(forbidden), `${side} banner said "${forbidden}": ${text}`);
      }
    }
  });

  test('the tour is org-agnostic — an unbuilt sandbox renders no tour rather than the wrong one', () => {
    assert.deepEqual(sandboxTourSteps('coach', demo), []);
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
