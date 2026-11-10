import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import {
  ACCEPTANCE_BOX_TEXT,
  ACCEPT_ROUTE_DOORS,
  PLAN_LINE_WORDS,
  WINDOW_WORDS,
  termsStopOf,
} from '../../lib/legal-acceptance-rules.ts';

/**
 * NOBODY STARTS AN ORGANIZATION OR A PAID PLAN WITHOUT THE CURRENT TERMS (GST/HST Stage 6 step 6.3, Chunk C; build prompt
 * C1–C4, the approved drawings tabs 5–6, rulings R6 and Asks 4A, 5A, 6A).
 *
 *   1. THE GATE — every gated handler asks `requireAcceptance(` before any branch that writes or answers success; the cancel
 *      doors never ask (§18), and the staff and dev doors are exempt with their reasons.
 *   2. THE ORGANIZATION CENSUS — every maker of an organization (or a workspace a person owns) is reached only from a gated
 *      route, a staff or dev door, the Stripe webhook provisioning what a gated checkout sold, or a named not-gated door.
 *   3. THE PLAN CENSUS — every file that calls Stripe to start, change or set up a plan is named, with its reason.
 *   4. THE CALLERS AND THEIR SHELLS — every client caller of a gated route sends through the Terms gate (a Terms stop read
 *      before any 409 of its own), and every page that can reach one sits under a shell that mounts the sign-in screen, so
 *      §20 (5c)'s "Reload this page to see them" is true.
 *   5. THE WINDOW, THE LINE, THE WORDS — §20 (3) and (5d) exactly; the same request re-sent after the tick.
 *   6. DARK MEANS INVISIBLE — the pages off: every gated route passes without reading anything, no line, no window.
 *
 * The censuses key on NAMED calls, assert the lists EXACTLY, and fail loudly when blind (the history-guard shape).
 */

const root = resolve(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const OFF: Record<string, string> = {};
const PREVIEW = { LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'sk_test_x' };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(resolve(root, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = join(dir, name);
    if (statSync(resolve(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel.split('\\').join('/'));
  }
  return out;
}
/** Code only: block and line comments removed (a `//` after a colon is a URL, not a comment). */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const SOURCE = ['app', 'lib', 'components'].flatMap(d => walk(d));
const sourceOf = new Map(SOURCE.map(f => [f, code(read(f))]));
const filesMatching = (re: RegExp) => SOURCE.filter(f => re.test(sourceOf.get(f)!)).sort();
/** The files that CALL `fn(` — its own definition's file excluded. */
const callersOf = (fn: string, definedIn: string) => filesMatching(new RegExp(`\\b${fn}\\(`)).filter(f => f !== definedIn);

/** One exported handler's body: from `export const METHOD` to the next export (or the end of the file). */
function handlerBody(file: string, method: string): string {
  const src = sourceOf.get(file)!;
  const start = src.indexOf(`export const ${method} =`);
  assert.ok(start >= 0, `${file} has no ${method} handler`);
  const next = src.indexOf('export const ', start + 1);
  return src.slice(start, next < 0 ? undefined : next);
}

// ════════════════════════════════════════════════════════════════ 1. the gate

/** route → why it is gated. Every one: `requireAcceptance(` at the top, before any branch (C1). */
const GATED: Record<string, string> = {
  'app/api/org/create/route.ts': 'creates a tournament organization and its Founding Season comp',
  'app/api/league/create/route.ts': 'a league is an organization',
  'app/api/coaches/teams/route.ts': 'the free Basic coach team — no organization row, but a workspace a person owns and starts',
  'app/api/billing/create-checkout/route.ts': 'checkout, the dev mock and the Founding Season upgrade (the last two write a plan without Stripe)',
  'app/api/billing/create-team-checkout/route.ts': 'the Coaches Portal checkout, its comp and dev-mock provisioning',
  'app/api/billing/move/route.ts': 'a move between plans (POST only)',
  'app/api/billing/choose-next-season/route.ts': 'next season’s subscription',
  'app/api/billing/setup-payment-method/route.ts': 'the card next season charges',
};
/** Writes that must never come before the check. */
const WRITES = [
  'createOrganization(', 'createBasicCoachTeam(', 'requireBillingLocation(', 'checkout.sessions.create', 'provision',
  'recordNextSeasonChoice(', 'applyMove(', 'createCardSetupSession(', '.insert(', '.update(', 'Limiter', 'ensureFoundingSeasonCompPeriod(',
];
/** A return before the check may only be a refusal: 401, 403, 400 or the auth helpers' own refusals. */
const REFUSAL = /\b40[0-9]\b|unauthorized\(\)|\bdenied\b|authorized\.response/;

/** Never gated, on purpose: cancelling never waits on the Terms (§18 "If you do not agree, you can cancel"). */
const NEVER_GATED: Record<string, { methods: string[]; why: string }> = {
  'app/api/billing/portal/route.ts': { methods: ['POST'], why: 'the billing portal — where a person cancels (its no-customer card setup is a side door of the same page)' },
  'app/api/billing/downgrade/confirm/route.ts': { methods: ['POST'], why: 'a downgrade is a step toward cancelling' },
  'app/api/billing/cancel/confirm/route.ts': { methods: ['POST'], why: 'cancelling' },
  'app/api/billing/cancel/keep/route.ts': { methods: ['POST'], why: 'keeping the current plan after a cancel — no new agreement' },
  'app/api/billing/move/route.ts': { methods: ['GET', 'DELETE'], why: 'DELETE keeps the current plan; GET reads' },
  'app/api/billing/move/preview/route.ts': { methods: ['POST'], why: 'read-only — the figures before a move' },
  'app/api/billing/mock-apply/route.ts': { methods: ['POST'], why: 'the dev billing mock (404 unless the mock is on)' },
};
/** Staff and dev doors — not a customer's agreement; their owners accept at their next sign-in. */
const EXEMPT: Record<string, string> = {
  'app/api/platform-admin/orgs/[id]/plan/route.ts': 'staff change a plan',
  'app/api/platform-admin/bulk-operations/route.ts': 'staff bulk plan operations',
  'app/api/platform-admin/orgs/[id]/overrides/route.ts': 'staff grant an override',
  'app/api/platform-admin/people/[id]/portal-free-time/route.ts': 'staff give free Coaches Portal time (provisions a workspace)',
  'app/api/platform-admin/watching-stripe/replay/route.ts': 'staff replay a missed Stripe event (the webhook path, below)',
  'app/api/dev/seed/org/route.ts': 'dev seed',
  'app/api/dev/seed/team-workspace/route.ts': 'dev seed',
};

describe('the gate (C1): every gated handler asks the Terms first; cancelling never does', () => {
  for (const [route, why] of Object.entries(GATED)) {
    it(`${route} asks requireAcceptance before any branch (${why})`, () => {
      const body = handlerBody(route, 'POST');
      const at = body.indexOf('requireAcceptance(');
      assert.ok(at > 0, `${route} must call requireAcceptance(user) in its POST handler`);
      const before = body.slice(0, at);
      for (const w of WRITES) assert.ok(!before.includes(w), `${route}: "${w}" runs before the Terms check`);
      for (const [, ret] of before.matchAll(/return\s+([^;]+);/g)) {
        assert.match(ret, REFUSAL, `${route}: "return ${ret.trim()}" answers before the Terms check — only a refusal may`);
      }
      assert.match(body.slice(at), /^requireAcceptance\([^)]*\);\s*if \(!terms\.ok\) return terms\.response;/, 'the refusal is returned at once');
    });
  }
  for (const [route, { methods, why }] of Object.entries(NEVER_GATED)) {
    it(`${route} ${methods.join('/')} never asks (${why})`, () => {
      for (const m of methods) assert.ok(!handlerBody(route, m).includes('requireAcceptance('), `${route} ${m} must never wait on the Terms`);
    });
  }
  for (const [route, why] of Object.entries(EXEMPT)) {
    it(`${route} is exempt (${why})`, () => {
      assert.ok(existsSync(resolve(root, route)), `${route} no longer exists — take it off the list`);
      assert.ok(!sourceOf.get(route)!.includes('requireAcceptance('), 'staff and dev doors are not a customer’s agreement');
    });
  }
  it('exactly the gated routes ask — a new caller of requireAcceptance is decided here', () => {
    assert.deepEqual(filesMatching(/\brequireAcceptance\(/).filter(f => f !== 'lib/legal-acceptance.ts'), Object.keys(GATED).sort());
  });
});

// ════════════════════════════════════════════════════════════════ 2. the organization census

/** fn → { defined in, its callers exactly, why each is allowed }. Followed up to a route. */
const ORG_MAKERS: Record<string, { definedIn: string; callers: Record<string, string> }> = {
  createOrganization: { definedIn: 'lib/db.ts', callers: {
    'app/api/org/create/route.ts': 'gated',
    'app/api/league/create/route.ts': 'gated',
    'lib/team-workspace-provisioning.ts': 'provisionStandaloneTeamWorkspace, followed below',
  } },
  provisionStandaloneTeamWorkspace: { definedIn: 'lib/team-workspace-provisioning.ts', callers: {
    'lib/team-checkout.ts': 'the two checkout provisioners, followed below',
    'lib/portal-free-time-give.ts': 'givePortalFreeTime, followed below',
    'app/api/dev/seed/team-workspace/route.ts': 'exempt — dev seed',
  } },
  provisionTeamWorkspaceFromCheckoutMetadata: { definedIn: 'lib/team-checkout.ts', callers: {
    'app/api/billing/create-team-checkout/route.ts': 'gated (the dev-mock path)',
    'lib/billing-webhook-handler.ts': 'the Stripe webhook provisions what a GATED checkout sold — the buyer agreed before the session existed',
  } },
  provisionCompTeamWorkspaceFromCheckout: { definedIn: 'lib/team-checkout.ts', callers: {
    'app/api/billing/create-team-checkout/route.ts': 'gated (the comp path)',
  } },
  givePortalFreeTime: { definedIn: 'lib/portal-free-time-give.ts', callers: {
    'app/api/platform-admin/people/[id]/portal-free-time/route.ts': 'exempt — staff',
  } },
  createBasicCoachTeam: { definedIn: 'lib/basic-coach-teams.ts', callers: {
    'app/api/coaches/teams/route.ts': 'gated',
  } },
  // ⚖ NOT GATED, argued (Chunk C, 2026-11-09): a tournament entry gets its team record. The coach's claim links the entry to a
  // team they already have, or makes a fresh free record only when none is chosen — the same side effect the registration has.
  // Gating it would let FieldLogicHQ's Terms stop a club's tournament registration; the registration form carries the box for a
  // new account, and the claim page sits under the Coaches Portal shell, which shows the sign-in screen on load.
  linkTournamentRegistrationToBasicCoachTeam: { definedIn: 'lib/basic-coach-teams.ts', callers: {
    'app/api/coaches/basic-teams/route.ts': 'not gated — the claim of a tournament entry (the note above)',
    'app/api/register/route.ts': 'not gated — the tournament registration’s own team record (the note above)',
  } },
};

describe('the organization census (C4): every maker is reached only from a gated, exempt or named door', () => {
  for (const [fn, { definedIn, callers }] of Object.entries(ORG_MAKERS)) {
    it(`${fn}: exactly its listed callers`, () => {
      assert.deepEqual(callersOf(fn, definedIn), Object.keys(callers).sort(),
        `${fn} gained (or lost) a caller. Decide: gate its route (requireAcceptance at the top), or list it with its reason.`);
    });
  }
  it('the only direct organizations inserts are createOrganization and the dev seed', () => {
    assert.deepEqual(filesMatching(/from\('organizations'\)\s*\.insert\(/), ['app/api/dev/seed/org/route.ts', 'lib/db.ts']);
  });
  it('the webhook runner is reached only by the Stripe webhook and the staff replay', () => {
    assert.deepEqual(filesMatching(/\brunVerifiedBillingEvent\b/).filter(f => f !== 'lib/billing-webhook-handler.ts'),
      ['app/api/billing/webhook/route.ts', 'lib/billing-event-replay-run.ts']);
    assert.deepEqual(filesMatching(/billing-event-replay-run'/), ['app/api/platform-admin/watching-stripe/replay/route.ts']);
  });
  it('the scan is not blind', () => assert.ok(callersOf('createOrganization', 'lib/db.ts').length >= 3));
});

// ════════════════════════════════════════════════════════════════ 3. the plan census

const STRIPE_PLAN_CALL = /checkout\.sessions\.create|subscriptions\.update|subscriptionSchedules\.(create|update)|billingPortal\.sessions\.create|\bcreateCardSetupSession\(/;
const PLAN_FILES: Record<string, string> = {
  'app/api/billing/create-checkout/route.ts': 'gated',
  'app/api/billing/create-team-checkout/route.ts': 'gated',
  'app/api/billing/choose-next-season/route.ts': 'gated',
  'app/api/billing/setup-payment-method/route.ts': 'gated (calls createCardSetupSession)',
  'app/api/billing/portal/route.ts': 'never gated — the billing portal, and its no-customer card setup',
  'lib/billing-setup.ts': 'createCardSetupSession — callers pinned below (one gated, one never gated)',
  'lib/plan-move.ts': 'applyMove — callers pinned below (the gated move, and the cancel flows’ reschedule)',
  'lib/plan-ending-server.ts': 'never gated — the cancel and downgrade flows (Stripe’s cancel-at-period-end, and their reschedule of a waiting move)',
  'lib/team-org-billing.ts': 'startOrgTeamAddonCheckout — NO callers (pinned below); a caller would be gated',
  'lib/stripe-connect.ts': 'not a FieldLogicHQ plan — a family paying a club on the club’s own Connect account',
};

describe('the plan census (C4): every Stripe plan call is named, with its reason', () => {
  it('exactly these files call Stripe to start, change or set up a plan', () => {
    assert.deepEqual(filesMatching(STRIPE_PLAN_CALL), Object.keys(PLAN_FILES).sort(),
      'A file that calls Stripe for a plan is not on the list (or a listed one no longer does). Gate its route, or list it.');
  });
  it('createCardSetupSession: the gated card setup, and the never-gated portal', () => {
    assert.deepEqual(callersOf('createCardSetupSession', 'lib/billing-setup.ts'),
      ['app/api/billing/portal/route.ts', 'app/api/billing/setup-payment-method/route.ts']);
  });
  it('applyMove: the gated move, and the cancel flows (a dynamic import)', () => {
    assert.deepEqual(callersOf('applyMove', 'lib/plan-move.ts'), ['app/api/billing/move/route.ts', 'lib/plan-ending-server.ts']);
  });
  it('startOrgTeamAddonCheckout has no callers', () => {
    assert.deepEqual(callersOf('startOrgTeamAddonCheckout', 'lib/team-org-billing.ts'), []);
  });
  it('the Connect checkout is reached only by the family payment links', () => {
    assert.deepEqual(filesMatching(/from '@\/lib\/stripe-connect'/).filter(f => sourceOf.get(f)!.includes('createCheckout(')),
      ['app/api/pay/league/[token]/route.ts', 'app/api/pay/team/[token]/route.ts']);
  });
});

// ════════════════════════════════════════════════════════════════ 4. the callers and their shells

const GATED_URLS = ['/api/org/create', '/api/league/create', '/api/coaches/teams', '/api/billing/create-checkout',
  '/api/billing/create-team-checkout', '/api/billing/move', '/api/billing/choose-next-season', '/api/billing/setup-payment-method'];
/** Every client file that posts to a gated route, and how its request reaches the gate. */
const CALLERS: Record<string, string> = {
  'app/(consumer)/start/tournament/StartTournamentForm.tsx': 'the start step’s send',
  'app/(consumer)/start/league/StartLeagueForm.tsx': 'the start step’s send',
  'app/(consumer)/start/team/StartTeamForm.tsx': 'the start step’s send',
  'app/team/TeamSignupClient.tsx': 'its own gate',
  'app/[orgSlug]/admin/onboarding/page.tsx': 'its own gate',
  'components/billing/BillingBody.tsx': 'its post(), through its own gate',
  'components/billing/PlanMoveDialog.tsx': 'its own gate — the window opens OVER the move window (Ask 5A)',
  'lib/plan-upgrade.ts': 'the drawer’s gate, passed in as send',
};
/** The component that hosts each caller's gate (the window mounts there). */
const HOSTS: Record<string, string> = {
  'app/(consumer)/start/tournament/StartTournamentForm.tsx': 'app/(consumer)/start/StartDoorForm.tsx',
  'app/(consumer)/start/league/StartLeagueForm.tsx': 'app/(consumer)/start/StartDoorForm.tsx',
  'app/(consumer)/start/team/StartTeamForm.tsx': 'app/(consumer)/start/StartDoorForm.tsx',
  'app/team/TeamSignupClient.tsx': 'app/team/TeamSignupClient.tsx',
  'app/[orgSlug]/admin/onboarding/page.tsx': 'app/[orgSlug]/admin/onboarding/page.tsx',
  'components/billing/BillingBody.tsx': 'components/billing/BillingBody.tsx',
  'components/billing/PlanMoveDialog.tsx': 'components/billing/PlanMoveDialog.tsx',
  'lib/plan-upgrade.ts': 'components/billing/PlanPanelDrawer.tsx',
};
/** The shells that mount the sign-in screen (Chunk B). */
const SCREEN_SHELLS = [
  'app/(consumer)/layout.tsx', 'app/[orgSlug]/admin/layout.tsx', 'app/[orgSlug]/check-in/layout.tsx', 'app/[orgSlug]/coaches/layout.tsx',
  'app/[orgSlug]/league/[seasonSlug]/team/[teamId]/layout.tsx', 'app/[orgSlug]/scorekeeper/layout.tsx', 'app/coaches/layout.tsx',
];

/** The import graph of app/, lib/ and components/ (static and dynamic imports), reversed: file → the files that import it. */
function importedBy(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const resolveSpec = (from: string, spec: string): string | null => {
    if (!spec.startsWith('@/') && !spec.startsWith('.')) return null;
    const base = spec.startsWith('@/') ? spec.slice(2) : join(dirname(from), spec).split('\\').join('/');
    return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(p => sourceOf.has(p)) ?? null;
  };
  for (const f of SOURCE) {
    const src = read(f);
    for (const [, spec] of src.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const target = resolveSpec(f, spec);
      if (!target) continue;
      if (!graph.has(target)) graph.set(target, new Set());
      graph.get(target)!.add(f);
    }
  }
  return graph;
}
/** Every page or layout that reaches `file` through imports. */
function routesReaching(file: string, graph: Map<string, Set<string>>): string[] {
  const seen = new Set<string>([file]);
  const queue = [file];
  const out = new Set<string>();
  while (queue.length) {
    const f = queue.shift()!;
    if (/^app\/.*\/(page|layout)\.tsx$/.test(f)) out.add(f);
    for (const g of graph.get(f) ?? []) if (!seen.has(g)) { seen.add(g); queue.push(g); }
  }
  return [...out].sort();
}

describe('the callers (C3/C4): every caller of a gated route sends through the Terms gate', () => {
  it('exactly these client files name a gated route', () => {
    const quoted = new RegExp(`['"\`](${GATED_URLS.map(u => u.replace(/[/-]/g, m => `\\${m}`)).join('|')})['"\`]`);
    const clients = filesMatching(quoted).filter(f => !f.startsWith('app/api/'));
    assert.deepEqual(clients, Object.keys(CALLERS).sort(),
      'A client file posts to a gated route and is not on the list. Send it through useTermsGate().send, and list it here.');
  });
  for (const [file, how] of Object.entries(CALLERS)) {
    it(`${file} never fetches a gated route directly (${how})`, () => {
      const src = sourceOf.get(file)!;
      for (const url of GATED_URLS) assert.ok(!src.includes(`fetch('${url}'`), `${file} fetches ${url} past the Terms gate`);
      const host = sourceOf.get(HOSTS[file])!;
      assert.ok(host.includes('useTermsGate()'), `${HOSTS[file]} hosts the gate`);
      assert.ok(host.includes('.window}'), `${HOSTS[file]} mounts the window`);
    });
  }
  it('the billing page’s post() is the gate', () => {
    assert.match(sourceOf.get('components/billing/BillingBody.tsx')!, /async function post\([^)]*\) \{[\s\S]{0,400}await terms\.send\(endpoint/);
  });
  it('the move window mounts the Terms window AFTER itself, so it opens over it (Ask 5A)', () => {
    const src = sourceOf.get('components/billing/PlanMoveDialog.tsx')!;
    assert.match(src, /<\/KitDialog>\{terms\.window\}<\/>/);
  });

  // ⚖ (5c) "Reload this page to see them" is true only where a reload shows the sign-in screen. One honest edge, by design: on
  // "updated" a paid owner's billing page is let through (the cancel door), so a reload there shows the billing page again —
  // but the window always opens there; (5c) shows only if the window cannot load at all.
  const graph = importedBy();
  for (const file of Object.keys(HOSTS)) {
    it(`every page that reaches ${HOSTS[file]} sits under a shell that mounts the sign-in screen`, () => {
      const routes = routesReaching(HOSTS[file], graph);
      assert.ok(routes.length > 0, `found no page reaching ${HOSTS[file]} — the scan has gone blind`);
      const outside = routes.filter(r => !SCREEN_SHELLS.some(s => r === s || r.startsWith(s.slice(0, s.lastIndexOf('/') + 1))));
      assert.deepEqual(outside, [], `${HOSTS[file]} is reachable from a page under no shell that mounts the screen: (5c) would be untrue there`);
    });
  }
  it('each named shell still mounts the screen', () => {
    for (const s of SCREEN_SHELLS) assert.ok(/<TermsAcceptGate|termsGateFor\(/.test(sourceOf.get(s)!), `${s} no longer mounts the screen`);
  });
});

// ════════════════════════════════════════════════════════════════ 5. the window, the line, the words

/** The draft's §20 lines, flattened: quote marks and link brackets off, one apostrophe, one space. */
const draft = read('docs/agents/legal/drafts/TERMS_OF_SERVICE.md').replace(/^\s*> ?/gm, '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').replace(/’/g, "'");
const flat = (s: string) => s.replace(/’/g, "'");

describe('the words (§20 (3) and (5d)): copied exactly from the Terms draft', () => {
  it('(3) the paid-plan line, and its trial sentence', () => {
    assert.ok(draft.includes(flat(PLAN_LINE_WORDS.lead + PLAN_LINE_WORDS.terms + PLAN_LINE_WORDS.end)), 'the line drifted from §20 (3)');
    assert.ok(draft.includes(flat(PLAN_LINE_WORDS.trial.trim())), 'the trial sentence drifted from §20 (3)');
    assert.ok(draft.includes(flat(PLAN_LINE_WORDS.trialMaybe.trim())), 'the conditional trial sentence drifted from §20 (3)');
  });
  it('(5d) the window’s title and both first lines', () => {
    assert.ok(draft.includes(`**${WINDOW_WORDS.title}**`.replace(/\*/g, '')) || draft.includes(WINDOW_WORDS.title));
    assert.ok(draft.includes(flat(WINDOW_WORDS.published.join(''))), 'the "never agreed" line drifted from §20 (5d)');
    assert.ok(draft.includes(flat(WINDOW_WORDS.updated.join(''))), 'the "agreed earlier" line drifted from §20 (5d)');
  });
});

describe('termsStopOf: a Terms stop is read before any 409 of the caller’s own', () => {
  it('the gated route’s refusal', () => {
    assert.deepEqual(termsStopOf(409, { code: 'terms_required', termsVersion: 'draft', hadEarlier: true }), { termsVersion: 'draft', hadEarlier: true });
    assert.deepEqual(termsStopOf(409, { code: 'terms_required', termsVersion: 'draft' }), { termsVersion: 'draft', hadEarlier: false });
  });
  it('never another 409, another status, or a refusal with no version', () => {
    assert.equal(termsStopOf(409, { code: 'portal_exists' }), null);
    assert.equal(termsStopOf(409, { error: 'That address is taken.' }), null);
    assert.equal(termsStopOf(400, { code: 'terms_required', termsVersion: 'draft' }), null);
    assert.equal(termsStopOf(409, { code: 'terms_required' }), null);
    assert.equal(termsStopOf(409, null), null);
  });
});

function windowLoader() {
  const KitDialogStub = ({ title, children, footer, footerStart }: { title: ReactNode; children: ReactNode; footer: ReactNode; footerStart: ReactNode }) =>
    createElement('div', { 'data-window': '' }, createElement('h2', null, title), children, footerStart, footer);
  return billingTestLoader({ '@/components/shared/KitDialog': { __esModule: true, default: KitDialogStub } });
}
const LINKS = { termsHref: 'https://x.test/legal/terms', privacyHref: 'https://x.test/legal/privacy', termsVersion: 'draft' };
/** The legal-links provider (as the root layout mounts it) round one element. */
const withLinks = (provider: unknown, links: typeof LINKS | null, child: ReactElement) =>
  createElement(provider as (p: { links: typeof LINKS | null }) => ReactElement, { links }, child);
const unescape = (html: string) => html.replace(/&#x27;|&#39;/g, '’').replace(/&amp;/g, '&');

describe('sendThroughTerms (C3): the same request again after the tick; nothing else touched', () => {
  const { sendThroughTerms } = windowLoader()('components/legal/TermsAcceptWindow.tsx') as typeof import('../../components/legal/TermsAcceptWindow.tsx');
  const stop = () => Response.json({ code: 'terms_required', termsVersion: 'draft', hadEarlier: false }, { status: 409 });
  function fetcher(answers: Response[]) {
    const calls: Array<[string, RequestInit | undefined]> = [];
    return { calls, fetch: async (input: string, init?: RequestInit) => { calls.push([input, init]); return answers.shift()!; } };
  }
  const init = { method: 'POST', body: JSON.stringify({ planKey: 'club', billingCycle: 'annual' }) };

  it('a stop, then a tick: the identical request is sent again, and its answer returned', async () => {
    const f = fetcher([stop(), Response.json({ url: 'https://checkout.test' })]);
    const asked: unknown[] = [];
    const res = await sendThroughTerms(f.fetch, async s => { asked.push(s); return true; }, '/api/billing/create-checkout', init);
    assert.deepEqual(asked, [{ termsVersion: 'draft', hadEarlier: false }]);
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[1][0], '/api/billing/create-checkout');
    assert.equal(f.calls[1][1], init, 'the same body — nothing chosen twice');
    assert.deepEqual(await res!.json(), { url: 'https://checkout.test' });
  });
  it('a stop, then the window closed: null, and nothing sent again', async () => {
    const f = fetcher([stop()]);
    assert.equal(await sendThroughTerms(f.fetch, async () => false, '/api/org/create', init), null);
    assert.equal(f.calls.length, 1);
  });
  it('another 409 is the caller’s: never asks', async () => {
    const f = fetcher([Response.json({ code: 'portal_exists', url: '/x' }, { status: 409 })]);
    let asked = false;
    const res = await sendThroughTerms(f.fetch, async () => { asked = true; return true; }, '/api/billing/create-team-checkout', init);
    assert.equal(asked, false);
    assert.equal(res!.status, 409);
    assert.deepEqual(await res!.json(), { code: 'portal_exists', url: '/x' }, 'the body is still readable by the caller');
  });
  it('no window available (the pages off on this page): the stop is handed back — its text is (5c)', async () => {
    const f = fetcher([stop()]);
    const res = await sendThroughTerms(f.fetch, null, '/api/org/create', init);
    assert.equal(res!.status, 409);
  });
  it('a second stop after agreeing asks once more, then hands the answer back rather than loop', async () => {
    const f = fetcher([stop(), stop(), stop()]);
    let asks = 0;
    const res = await sendThroughTerms(f.fetch, async () => { asks += 1; return true; }, '/api/billing/move', init);
    assert.equal(asks, 2);
    assert.equal(f.calls.length, 3);
    assert.equal(res!.status, 409);
  });
});

describe('the window (C3, drawing tab 6): "Before you continue", the line by history, the box, Continue off', () => {
  function render(hadEarlier: boolean, links: typeof LINKS | null = LINKS) {
    const load = windowLoader();
    const { LegalLinksProvider } = load('components/legal/LegalLinksProvider.tsx') as typeof import('../../components/legal/LegalLinksProvider.tsx');
    const { TermsAcceptWindow } = load('components/legal/TermsAcceptWindow.tsx') as typeof import('../../components/legal/TermsAcceptWindow.tsx');
    return unescape(renderToStaticMarkup(withLinks(LegalLinksProvider, links,
      createElement(TermsAcceptWindow, { stop: { termsVersion: 'draft', hadEarlier }, onDone: () => {} }))));
  }
  it('never agreed: (5d)’s first line with both links, the box, Cancel, Continue off', () => {
    const html = render(false);
    assert.match(html, /<h2>Before you continue<\/h2>/);
    assert.match(html, /<span>FieldLogicHQ now has <\/span><a[^>]*href="https:\/\/x\.test\/legal\/terms"[^>]*>Terms of Service<\/a>/);
    assert.match(html, /and we’ll carry on where you left off\./);
    assert.match(html, /type="checkbox"/);
    assert.ok(!/checked=""/.test(html), 'never pre-ticked');
    assert.match(html, />Cancel<\/button>/);
    assert.match(html, /<button type="button" class="btn btn-lime" disabled="">Continue<\/button>/);
  });
  it('agreed to an earlier version: "We’ve changed our Terms of Service since you last agreed to them."', () => {
    const html = render(true);
    assert.match(html, /<span>We’ve changed our <\/span><a[^>]*>Terms of Service<\/a><span> since you last agreed to them\./);
  });
});

describe('the window on a page loaded while the pages were OFF (the app was open when the Terms went live)', () => {
  it('still shows the sentence with both links and the box — it brings its own links', () => {
    const load = windowLoader();
    const { LegalLinksProvider } = load('components/legal/LegalLinksProvider.tsx') as typeof import('../../components/legal/LegalLinksProvider.tsx');
    const { TermsAcceptWindow } = load('components/legal/TermsAcceptWindow.tsx') as typeof import('../../components/legal/TermsAcceptWindow.tsx');
    const html = unescape(renderToStaticMarkup(withLinks(LegalLinksProvider, null,
      createElement(TermsAcceptWindow, { stop: { termsVersion: '2027-01-01', hadEarlier: false }, onDone: () => {} }))));
    assert.match(html, /<a[^>]*href="\/legal\/terms"[^>]*>Terms of Service<\/a>/);
    assert.match(html, /<a[^>]*href="\/legal\/privacy"[^>]*>Privacy Policy<\/a>/);
    assert.match(html, /type="checkbox"/);
  });
});

describe('the line (C2, drawing tab 5): §20 (3), only while the pages are on', () => {
  function render(links: typeof LINKS | null, props: Record<string, unknown> = {}) {
    const load = billingTestLoader();
    const { LegalLinksProvider } = load('components/legal/LegalLinksProvider.tsx') as typeof import('../../components/legal/LegalLinksProvider.tsx');
    const Line = (load('components/legal/PlanTermsLine.tsx') as { default: (p: Record<string, unknown>) => ReactElement }).default;
    return unescape(renderToStaticMarkup(withLinks(LegalLinksProvider, links, createElement(Line, props))));
  }
  it('off: nothing', () => assert.equal(render(null), ''));
  it('on: the line, with the Terms linked', () => {
    const html = render(LINKS);
    assert.match(html, /Your plan renews automatically until you cancel\./);
    assert.match(html, /By continuing, you agree to the <\/span><a[^>]*href="https:\/\/x\.test\/legal\/terms"[^>]*>Terms of Service<\/a>/);
    assert.ok(!html.includes('Your trial ends'));
  });
  it('a trial this purchase starts (the screen knows): the trial sentence first, one paragraph', () => {
    assert.match(render(LINKS, { trial: 'known' }), /^<p[^>]*>Your trial ends on the date shown at checkout, and your card is charged then unless you cancel\. <span>Your plan renews/);
  });
  it('a plan with trial days where checkout decides: the conditional sentence (/legal 2026-11-09)', () => {
    assert.match(render(LINKS, { trial: 5 }),/^<p[^>]*>If your plan starts with a trial, it ends on the date shown at checkout, and your card is charged then unless you cancel\. <span>Your plan renews/);
  });
  it('the line is placed only beside a priced button: never on a Founding Season "free" choice', () => {
    assert.match(sourceOf.get('components/billing/PlanCycleDialog.tsx')!, /\{!free && \(monthlyPrice > 0 \|\| annualPrice > 0\) && <PlanTermsLine trial=/);
    assert.match(sourceOf.get('components/billing/PlanArticlePanel.tsx')!, /\{!promoActive && config\.monthlyPrice > 0 && <PlanTermsLine trial=/);
    assert.match(sourceOf.get('app/[orgSlug]/admin/onboarding/PlanStep.tsx')!, /\{!zero && <PlanTermsLine place="column" trial=/);
    assert.match(sourceOf.get('components/billing/BillingBody.tsx')!, /free=\{freeChoice\(payFor\)\}/);
  });
  it('every line beside a plan that may carry a trial says so — a line with no trial sentence is only for a plan without one', () => {
    // Where the plan can have trial days, the line reads the plan's own settings (never a hard-coded "no trial").
    // (the line takes the plan's trial days as a number and says the conditional sentence itself when they are above zero)
    for (const f of ['components/billing/PlanCycleDialog.tsx', 'components/billing/PlanArticlePanel.tsx', 'components/billing/BillingBody.tsx',
      'components/PricingSection.tsx', 'app/[orgSlug]/admin/onboarding/PlanStep.tsx', 'app/[orgSlug]/admin/onboarding/AddressStep.tsx',
      'app/team/TeamSignupClient.tsx']) {
      assert.ok(/<PlanTermsLine\b[^>]*trial=\{[^}]*trialDays/i.test(sourceOf.get(f)!),`${f}: the line must say "if your plan starts with a trial" where the plan has trial days`);
    }
    // The two that carry none, on purpose: Reactivate (a returning buyer — checkout gives no trial) and the next-season choice
    // (its route sets no trial). The move window knows from its quote.
    assert.match(sourceOf.get('components/billing/PlanMoveDialog.tsx')!, /trial=\{quote && quote\.trialDays > 0 \? 'known' : undefined\}/);
  });
  it('exactly these files render the line', () => {
    assert.deepEqual(filesMatching(/<PlanTermsLine\b/), [
      'app/[orgSlug]/admin/onboarding/AddressStep.tsx', 'app/[orgSlug]/admin/onboarding/PlanStep.tsx', 'app/team/TeamSignupClient.tsx',
      'components/PricingSection.tsx', 'components/billing/BillingBody.tsx', 'components/billing/PlanArticlePanel.tsx',
      'components/billing/PlanCycleDialog.tsx', 'components/billing/PlanMoveDialog.tsx',
    ]);
  });
});

// ════════════════════════════════════════════════════════════════ 6. dark means invisible; the check and the accept route

type Row = Record<string, unknown>;
function legalHarness(rows: Row[] = []) {
  const table: Row[] = rows.map(r => ({ ...r }));
  let reads = 0;
  const supabaseAdmin = {
    from: (name: string) => {
      assert.equal(name, 'legal_acceptances');
      let userId: unknown;
      const q = {
        select: () => q,
        eq: (_c: string, v: unknown) => { userId = v; return q; },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => { reads += 1; return { data: table.filter(r => r.user_id === userId).at(-1) ?? null, error: null }; },
        insert: async (row: Row) => { table.push({ ...row }); return { error: null }; },
      };
      return q;
    },
    auth: { admin: { updateUserById: async () => ({ error: null }) } },
  };
  const load = billingTestLoader({
    './supabase-admin': { supabaseAdmin },
    './platform-auth': { isPlatformAdminEmail: async () => false },
  });
  return { load, table, reads: () => reads };
}
async function withEnv<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const keys = ['LEGAL_PAGES_PREVIEW', 'STRIPE_SECRET_KEY'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) { if (k in env) process.env[k] = env[k]; else delete process.env[k]; }
  try { return await fn(); } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

describe('requireAcceptance (C1): the gated routes’ check', () => {
  const user = { id: 'u1', email: 'pat@x.test', app_metadata: {} };
  it('the pages off: passes, and reads nothing — every gated route behaves exactly as today', async () => {
    const h = legalHarness();
    const { requireAcceptance } = h.load('lib/legal-acceptance.ts') as typeof import('../../lib/legal-acceptance.ts');
    assert.deepEqual(await requireAcceptance(user, OFF), { ok: true });
    assert.equal(h.reads(), 0);
  });
  it('the preview, never agreed: 409 terms_required with the version to show and "published"', async () => {
    const h = legalHarness();
    const { requireAcceptance } = h.load('lib/legal-acceptance.ts') as typeof import('../../lib/legal-acceptance.ts');
    const r = await requireAcceptance(user, PREVIEW);
    assert.equal(r.ok, false);
    const res = (r as { response: Response }).response;
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.code, 'terms_required');
    assert.equal(body.termsVersion, 'draft');
    assert.equal(body.hadEarlier, false);
    assert.deepEqual(termsStopOf(409, body), { termsVersion: 'draft', hadEarlier: false });
  });
  it('the preview, agreed (the mirror): passes with no query', async () => {
    const h = legalHarness();
    const { requireAcceptance } = h.load('lib/legal-acceptance.ts') as typeof import('../../lib/legal-acceptance.ts');
    assert.deepEqual(await requireAcceptance({ ...user, app_metadata: { legal_terms_accepted: 'draft' } }, PREVIEW), { ok: true });
    assert.equal(h.reads(), 0);
  });
});

async function postAccept(env: Record<string, string>, body: unknown) {
  const h = legalHarness();
  const load = billingTestLoader({
    '@/lib/supabase-server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'pat@x.test', app_metadata: {} } } }) } }) },
    '@/lib/observability': { withObservability: (fn: unknown) => fn },
    '@/lib/legal-acceptance': h.load('lib/legal-acceptance.ts'),
  });
  const { POST } = load('app/api/legal/accept/route.ts') as { POST: (req: Request) => Promise<Response> };
  const res = await withEnv(env, () => POST(new Request('http://x.test/api/legal/accept', { method: 'POST', body: JSON.stringify(body) })));
  return { res, rows: h.table };
}

describe('the accept route (C3): the window records door purchase_window', () => {
  it('the two doors it serves', () => assert.deepEqual([...ACCEPT_ROUTE_DOORS], ['sign_in_screen', 'purchase_window']));
  it('the window’s tick: one row, door purchase_window, the box sentence kept', async () => {
    const { res, rows } = await postAccept(PREVIEW, { termsVersion: 'draft', door: 'purchase_window' });
    assert.equal(res.status, 200);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].door, 'purchase_window');
    assert.equal(rows[0].box_text, ACCEPTANCE_BOX_TEXT);
  });
  it('any other door named is the screen’s, never a free label', async () => {
    const { rows } = await postAccept(PREVIEW, { termsVersion: 'draft', door: 'fixture' });
    assert.equal(rows[0].door, 'sign_in_screen');
  });
  it('the pages off: not found, nothing recorded', async () => {
    const { res, rows } = await postAccept(OFF, { termsVersion: 'draft', door: 'purchase_window' });
    assert.equal(res.status, 404);
    assert.equal(rows.length, 0);
  });
});
