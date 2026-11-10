import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement, Fragment, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import {
  ACCEPTANCE_WORDS,
  CONSUMER_SHELL_DOORS,
  SCREEN_WORDS,
  doorTermsVerdict,
  screenPassesThrough,
} from '../../lib/legal-acceptance-rules.ts';

/**
 * ACCEPTANCE AT EVERY ACCOUNT DOOR, AND THE SIGN-IN SCREEN (GST/HST Stage 6 step 6.3, Chunk B; build prompt B1–B3, the
 * approved drawings, owner yes 2026-11-09 on the three disagreements).
 *
 *   1. THE ACCOUNT-DOOR CENSUS — every file that makes a login (`auth.admin.createUser`, `auth.admin.generateLink`, or a
 *      password set in the browser with `auth.updateUser({ password })`) is a door that refuses without the box and records
 *      the tick, or is on a named list with its reason. A new one fails until someone decides which it is.
 *   2. THE FORMS — every form that posts to a door renders the one tick row and sends its fields.
 *   3. THE SHELL CENSUS — every layout or page that resolves a signed-in user sits under one that mounts the screen, or is
 *      exempt with its reason. Platform admin never mounts it.
 *   4. DARK MEANS INVISIBLE — with the pages off: no row, no refusal, no screen.
 *   5. THE SCREEN AND THE CANCEL DOOR — "published" never offers it; "updated" offers it to a paid-plan owner, and their
 *      billing page is reachable without agreeing.
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

// ════════════════════════════════════════════════════════════════ 1. the account-door census

/** A server door: refuses before it creates anything, records after. */
const DOOR_ROUTES: Record<string, string> = {
  'app/api/auth/signup/route.ts': 'signup + follow — Run a tournament, the account-only sign-up, the follow nudge',
  'app/api/auth/coach-signup/route.ts': 'coach_signup + registration + assistant_invite + league_coach_invite',
  'app/api/auth/team-signup/route.ts': 'team_signup — the Coaches Portal start',
};
/** Makes the login in a library or the browser; the named route holds the refusal and the record. */
const DELEGATED: Record<string, { route: string; fn: string; why: string }> = {
  'lib/registration-account.ts': {
    route: 'app/api/register/route.ts', fn: 'openRegistrationAccount',
    why: 'registration — the tournament registration that makes the coach’s account (refused before the entry is filed)',
  },
  'lib/family-invitation.ts': {
    route: 'app/api/family/claim/[token]/route.ts', fn: 'acceptWithNewAccount',
    why: 'family_accept — the family join page’s new account (the third box)',
  },
  'app/(consumer)/auth/accept-invite/AcceptInviteForm.tsx': {
    route: 'app/api/auth/accept-invite/route.ts', fn: 'join',
    why: 'staff_invite — the password is set in the browser before the server sees anything; the refusal sits on the join',
  },
};
/** Mints an invitation login for somebody who is not present; they tick at the staff invitation door. */
const INVITATION_MINTS: Record<string, string> = {
  'app/api/admin/members/invite/route.ts': 'an organization invites a member — the invitee ticks at /auth/accept-invite',
  'lib/invite-links.ts': 'reinvite and resend of the same invitation — the invitee ticks at /auth/accept-invite',
};
/** Staff and demo accounts never tick (lib/legal-acceptance-exempt.ts, R4). */
const EXEMPT: Record<string, string> = {
  'app/api/platform-admin/company-users/route.ts': 'staff — FieldLogicHQ’s own team',
  'app/api/dev/seed/platform-user/route.ts': 'staff — a dev seed of a platform user',
  'lib/demo-session.ts': 'demo — the no-login demo door signs in the two demo accounts',
};
/** Recovery and verification: an existing account, nothing agreed. */
const NOT_A_DOOR: Record<string, string> = {
  'app/api/auth/forgot-password/route.ts': 'recovery link',
  'app/api/auth/resend-verification/route.ts': 'a fresh link for an account that already ticked when it was made',
  'app/api/platform-admin/users/[id]/reset/route.ts': 'staff-issued recovery link',
  'app/(consumer)/auth/reset-password/page.tsx': 'a new password for an existing account',
};
/** Dev seed routes: their accounts record a `fixture` tick (Chunk A, A5). */
const SEEDS = ['app/api/dev/seed/org/route.ts', 'app/api/dev/seed/team-workspace/route.ts', 'app/api/dev/seed/users/route.ts'];

describe('the account-door census (B3): every login maker is a door, or named with its reason', () => {
  const makers = filesMatching(/auth\.admin\.(createUser|generateLink)\(|auth\.updateUser\(\s*\{\s*password/);
  const listed = [
    ...Object.keys(DOOR_ROUTES), ...Object.keys(DELEGATED), ...Object.keys(INVITATION_MINTS),
    ...Object.keys(EXEMPT), ...Object.keys(NOT_A_DOOR), ...SEEDS,
  ].sort();

  it('the scan is not blind: it finds the known doors', () => {
    assert.ok(makers.length >= 15, `the scan found only ${makers.length} files — it has gone blind`);
    for (const f of Object.keys(DOOR_ROUTES)) assert.ok(makers.includes(f), `${f} is no longer found by the scan`);
  });
  it('every login maker is listed, and every listed file still makes one', () => {
    assert.deepEqual(makers, listed,
      'A file that makes a login is not on a list (or a listed one no longer makes one). Decide: a door (refuse without the box, '
      + 'record after — accountDoorRefusal / recordDoorAcceptance), exempt (staff or demo only, R4), or not a door, with its reason.');
  });
  it('nothing reaches the auth admin through an alias the scan cannot follow', () => {
    const aliased = filesMatching(/=\s*supabaseAdmin\.auth(\.admin)?\s*;|\{\s*admin\s*\}\s*=\s*\w+\.auth/);
    assert.deepEqual(aliased, [], 'an aliased auth admin hides a createUser from this census — call it by its full name');
  });
  for (const [route, why] of Object.entries(DOOR_ROUTES)) {
    it(`${route} refuses before it creates, and records after (${why})`, () => {
      const src = sourceOf.get(route)!;
      const refuse = src.indexOf('accountDoorRefusal(');
      const record = src.indexOf('recordDoorAcceptance(');
      const create = Math.min(...['auth.admin.createUser(', 'auth.admin.generateLink('].map(c => src.indexOf(c)).filter(i => i >= 0));
      assert.ok(refuse > 0 && record > 0, `${route} must call accountDoorRefusal and recordDoorAcceptance`);
      assert.ok(refuse < create, `${route} must refuse BEFORE it creates the account`);
      assert.ok(record > create, `${route} must record AFTER the account exists`);
    });
  }
  for (const [file, { route, fn, why }] of Object.entries(DELEGATED)) {
    it(`${file} → ${route} holds the refusal and the record (${why})`, () => {
      const src = sourceOf.get(route)!;
      assert.ok(src.includes('accountDoorRefusal(') && src.includes('recordDoorAcceptance('), `${route} must refuse and record`);
      if (fn !== 'join') {
        const callers = filesMatching(new RegExp(`\\b${fn}\\(`)).filter(f => f !== file);
        assert.deepEqual(callers, [route], `${fn} gained a caller the census does not follow — it must refuse and record too`);
      }
    });
  }
  it('the staff invitation form posts to the join that refuses (the refusal is on the join, not the password)', () => {
    assert.match(sourceOf.get('app/(consumer)/auth/accept-invite/AcceptInviteForm.tsx')!, /fetch\('\/api\/auth\/accept-invite'/);
  });
  it('the dev seed routes record a fixture tick', () => {
    for (const f of SEEDS) assert.ok(sourceOf.get(f)!.includes('recordFixtureAcceptance('), `${f} must record its accounts' acceptance`);
  });
});

// ════════════════════════════════════════════════════════════════ 2. the forms

/** Every form that makes an account through a door, with the door it posts to. */
const FORMS: Record<string, string> = {
  'app/(consumer)/start/StartDoorForm.tsx': '/api/auth/',
  'app/(consumer)/auth/signup/AccountOnlySignup.tsx': '/api/auth/signup',
  'components/public/FollowAccountNudge.tsx': '/api/auth/signup',
  'app/coaches/join/page.tsx': '/api/auth/coach-signup',
  'components/public/RegisterContent.tsx': '/api/register',
  'app/team/TeamSignupClient.tsx': '/api/auth/team-signup',
  'app/(consumer)/auth/accept-assistant-invite/page.tsx': '/api/auth/coach-signup',
  'app/(consumer)/auth/accept-league-coach/page.tsx': '/api/auth/coach-signup',
  'app/(consumer)/auth/accept-invite/AcceptInviteForm.tsx': '/api/auth/accept-invite',
  'app/(consumer)/family/claim/[token]/ClaimClient.tsx': '/api/family/claim/',
};

describe('the forms (B1): the box and the server refusal land together', () => {
  it('exactly these files use the tick row (the screen is the one non-form)', () => {
    const users = filesMatching(/from '@\/components\/legal\/TermsTickRow'|from '\.\/TermsTickRow'/);
    assert.deepEqual(users, [...Object.keys(FORMS), 'components/legal/TermsAcceptScreen.tsx'].sort());
  });
  for (const [form, door] of Object.entries(FORMS)) {
    it(`${form} checks the box before sending and sends its fields to ${door}`, () => {
      const src = sourceOf.get(form)!;
      assert.ok(src.includes('useTermsTick('), 'uses the shared tick');
      assert.ok(src.includes('terms.missing'), 'checks the box before it sends (Ask 2A)');
      assert.ok(/terms\.fields/.test(src) || /termsVersion/.test(src), 'sends the tick and the version it showed');
      assert.ok(src.includes('terms.refusal(') || src.includes('termsRefusal('), 'reads the server refusal');
      assert.ok(src.includes(door), `posts to ${door}`);
    });
  }
  it('a form whose 409 means "this email has an account" reads the Terms refusal FIRST', () => {
    for (const form of ['app/(consumer)/start/StartDoorForm.tsx', 'app/(consumer)/auth/signup/AccountOnlySignup.tsx',
      'app/coaches/join/page.tsx', 'app/team/TeamSignupClient.tsx', 'app/(consumer)/auth/accept-assistant-invite/page.tsx',
      'app/(consumer)/auth/accept-league-coach/page.tsx']) {
      const src = sourceOf.get(form)!;
      const terms = src.indexOf('terms.refusal(');
      const exists = src.search(/status === 409/);
      assert.ok(terms > 0 && exists > 0 && terms < exists, `${form}: the terms_changed 409 must not read as "an account exists"`);
    }
  });
});

describe('doorTermsVerdict: the account door’s rule', () => {
  it('the pages off: never asked, whatever the body', () => {
    assert.equal(doorTermsVerdict({}, null), null);
    assert.equal(doorTermsVerdict(undefined, null), null);
  });
  it('unticked, or anything but the literal true', () => {
    assert.equal(doorTermsVerdict({}, 'draft'), 'unticked');
    assert.equal(doorTermsVerdict({ acceptTerms: 'true', termsVersion: 'draft' }, 'draft'), 'unticked');
  });
  it('a version that moved while the page was open', () => {
    assert.equal(doorTermsVerdict({ acceptTerms: true, termsVersion: '2027-01-01' }, 'draft'), 'changed');
    assert.equal(doorTermsVerdict({ acceptTerms: true }, 'draft'), 'changed');
  });
  it('ticked against the current version', () => assert.equal(doorTermsVerdict({ acceptTerms: true, termsVersion: 'draft' }, 'draft'), null));
});

// ════════════════════════════════════════════════════════════════ 3. the shell census

/** The shells that mount the screen (six, plus the house-league coach page the prompt's census missed). */
const MOUNTS = [
  'app/(consumer)/layout.tsx',
  'app/[orgSlug]/admin/layout.tsx',
  'app/[orgSlug]/check-in/layout.tsx',
  'app/[orgSlug]/coaches/layout.tsx',
  'app/[orgSlug]/league/[seasonSlug]/team/[teamId]/layout.tsx',
  'app/[orgSlug]/scorekeeper/layout.tsx',
  'app/coaches/layout.tsx',
].sort();
/** A whole subtree that never mounts it. */
const EXEMPT_SUBTREES: Record<string, string> = {
  'app/platform-admin/': 'staff only — staff are exempt (R4), and the console is not a customer’s agreement',
};
/** One file that reads the user and does not mount it. */
const EXEMPT_FILES: Record<string, string> = {
  'app/[orgSlug]/layout.tsx': 'reads the user only for a demo organization (the demo accounts are exempt); its signed-in children are the shells above',
  'app/page.tsx': 'a signed-in person is redirected to their workspace, which mounts the screen',
  'app/see-it-live/switch/page.tsx': 'the demo door — the demo accounts are exempt',
  'app/see-it-live/coaches/switch/page.tsx': 'the demo door — the demo accounts are exempt',
};
const RESOLVES_USER = /getAuthUserCached|getAuthContextWithRole|getCoachPortalAuth|getPlatformAdminContext|getAuthenticatedUser|\.getUser\(/;

describe('the shell census (B3): every signed-in layout and page is under the screen, or exempt with its reason', () => {
  const layouts = SOURCE.filter(f => f.startsWith('app/') && /\/layout\.tsx$/.test(f));
  const pages = SOURCE.filter(f => f.startsWith('app/') && /\/page\.tsx$/.test(f));
  const dirOf = (f: string) => f.slice(0, f.lastIndexOf('/') + 1);

  // Either form of the one gate: the component round one tree, or the decision at the top of a layout with several returns.
  const mounts = (f: string) => sourceOf.get(f)!.includes('<TermsAcceptGate') || sourceOf.get(f)!.includes('termsGateFor(');
  it('exactly these layouts mount the screen', () => {
    assert.deepEqual(layouts.filter(mounts).sort(), MOUNTS);
  });
  it('a layout that decides at the top returns the screen before anything else, and keeps the watch beside its page', () => {
    const src = sourceOf.get('app/[orgSlug]/coaches/layout.tsx')!;
    const decide = src.indexOf('termsGateFor(');
    assert.ok(decide > 0 && decide < src.indexOf('if (!authCtx)'), 'decided before the first wall');
    assert.ok(src.includes('if (terms?.screen) return terms.screen;'), 'the screen is returned instead of the portal');
    assert.ok(src.includes('const children = terms?.watch ? <>{terms.watch}{page}</> : page;'), 'the watch rides beside the page');
  });
  it('platform admin never mounts it', () => {
    assert.ok(!SOURCE.some(f => f.startsWith('app/platform-admin/') && sourceOf.get(f)!.includes('TermsAcceptGate')));
  });
  it('the scan is not blind', () => {
    const resolving = [...layouts, ...pages].filter(f => RESOLVES_USER.test(sourceOf.get(f)!));
    assert.ok(resolving.length >= 30, `only ${resolving.length} signed-in layouts and pages found — the scan has gone blind`);
  });
  it('every layout or page that resolves a signed-in user is covered or exempt — and every exemption is still needed', () => {
    const covered = (f: string) => MOUNTS.some(m => f.startsWith(dirOf(m)))
      || Object.keys(EXEMPT_SUBTREES).some(s => f.startsWith(s));
    const uncovered = [...layouts, ...pages].filter(f => RESOLVES_USER.test(sourceOf.get(f)!) && !covered(f)).sort();
    assert.deepEqual(uncovered, Object.keys(EXEMPT_FILES).sort(),
      'A signed-in layout or page is under no shell that mounts the Terms screen. Mount it (or a layout above it), or list it '
      + 'with its reason — a signed-in surface that skips the screen lets an existing account in without agreeing.');
  });
  it('the consumer shell lets its own account doors through, and only those', () => {
    assert.deepEqual([...CONSUMER_SHELL_DOORS], ['/auth/', '/family/claim/']);
    assert.match(sourceOf.get('app/(consumer)/layout.tsx')!, /<TermsAcceptGate user=\{user\} doors=\{CONSUMER_SHELL_DOORS\}>/);
  });
  it('the family join page is matched by the proxy, so its address is the proxy’s', () => {
    const proxy = read('proxy.ts');
    assert.match(proxy, /'\/family\/claim\/:path\*'/);
    assert.match(proxy, /segments\[0\] === 'family' && segments\[1\] === 'claim'/);
    assert.match(proxy, /'\/auth\/:path\*'/);
  });
});

describe('screenPassesThrough: where the page renders instead of the screen', () => {
  const doors = CONSUMER_SHELL_DOORS;
  it('the sign-in area and the family join page', () => {
    for (const p of ['/auth/accept-invite', '/auth/callback', '/auth/reset-password', '/family/claim/abc123']) {
      assert.equal(screenPassesThrough(p, { doors }), true, p);
    }
  });
  it('never the consumer app itself', () => {
    for (const p of ['/account', '/family', '/family/teams/x', '/discover', '/following', '/chat', '/authors']) {
      assert.equal(screenPassesThrough(p, { doors }), false, p);
    }
  });
  it('no address (no proxy header) never passes', () => assert.equal(screenPassesThrough(null, { doors }), false));
  it('a billing page passes only when it is one of the person’s cancel-door plans', () => {
    const billingHrefs = ['/club/admin/org/billing'];
    assert.equal(screenPassesThrough('/club/admin/org/billing', { billingHrefs }), true);
    assert.equal(screenPassesThrough('/club/admin/org/billing/mock-portal', { billingHrefs }), true);
    assert.equal(screenPassesThrough('/club/admin/org/billing', {}), false);
    assert.equal(screenPassesThrough('/club/admin/org/billingx', { billingHrefs }), false);
    assert.equal(screenPassesThrough('/other/admin/org/billing', { billingHrefs }), false);
  });
});

// ════════════════════════════════════════════════════════════════ 4. dark means invisible, over the real modules

type Row = Record<string, unknown>;
function legalHarness({ rows = [] as Row[] } = {}) {
  const table: Row[] = rows.map(r => ({ ...r }));
  const supabaseAdmin = {
    from: (name: string) => {
      assert.equal(name, 'legal_acceptances');
      let userId: unknown;
      const q = {
        select: () => q,
        eq: (_c: string, v: unknown) => { userId = v; return q; },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: table.filter(r => r.user_id === userId).at(-1) ?? null, error: null }),
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
  return { load, table };
}

const LINKS = { termsHref: 'https://x.test/legal/terms', privacyHref: 'https://x.test/legal/privacy', termsVersion: 'draft' };
/** The legal-links provider (as the root layout mounts it) round one element. */
const withLinks = (provider: unknown, links: typeof LINKS | null, child: ReactElement) =>
  createElement(provider as (p: { links: typeof LINKS | null }) => ReactElement, { links }, child);

/** Run `fn` with the process env set to `env` for the legal switch (the gate and the route read process.env). */
async function withEnv<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const keys = ['LEGAL_PAGES_PREVIEW', 'STRIPE_SECRET_KEY'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) { if (k in env) process.env[k] = env[k]; else delete process.env[k]; }
  try { return await fn(); } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

describe('dark means invisible (B3): the pages off — no box, no refusal, no row, no screen', () => {
  it('an account door accepts a body with no Terms fields (the production body, unchanged)', () => {
    const { load } = legalHarness();
    const { accountDoorRefusal } = load('lib/legal-acceptance.ts') as typeof import('../../lib/legal-acceptance.ts');
    assert.equal(accountDoorRefusal({}, OFF), null);
    assert.equal(accountDoorRefusal(undefined, OFF), null);
  });
  it('and records nothing', async () => {
    const { load, table } = legalHarness();
    const { recordDoorAcceptance } = load('lib/legal-acceptance.ts') as typeof import('../../lib/legal-acceptance.ts');
    await recordDoorAcceptance({ id: 'u1', email: 'a@b.test' }, 'signup', { acceptTerms: true, termsVersion: 'draft' }, OFF);
    assert.equal(table.length, 0);
  });
  it('the preview refuses an unticked box (5b) and a moved version (its twin), and records a ticked one', async () => {
    const { load, table } = legalHarness();
    const { accountDoorRefusal, recordDoorAcceptance } = load('lib/legal-acceptance.ts') as typeof import('../../lib/legal-acceptance.ts');
    const unticked = accountDoorRefusal({}, PREVIEW)!;
    assert.equal(unticked.status, 400);
    assert.deepEqual(await unticked.json(), { error: ACCEPTANCE_WORDS.refuseUnticked, code: 'terms_unticked' });
    const moved = accountDoorRefusal({ acceptTerms: true, termsVersion: '2026-01-01' }, PREVIEW)!;
    assert.equal(moved.status, 409);
    assert.deepEqual(await moved.json(), { error: ACCEPTANCE_WORDS.refuseChangedPage, code: 'terms_changed', termsVersion: 'draft' });
    assert.equal(accountDoorRefusal({ acceptTerms: true, termsVersion: 'draft' }, PREVIEW), null);
    await recordDoorAcceptance({ id: 'u1', email: 'a@b.test' }, 'follow', { acceptTerms: true, termsVersion: 'draft' }, PREVIEW);
    assert.equal(table.length, 1);
    assert.equal(table[0].door, 'follow');
    assert.equal(table[0].terms_version, 'draft');
  });

  it('the tick row renders nothing with the pages off, and the box with both links when on', () => {
    const { load } = legalHarness();
    const { LegalLinksProvider } = load('components/legal/LegalLinksProvider.tsx') as typeof import('../../components/legal/LegalLinksProvider.tsx');
    const row = load('components/legal/TermsTickRow.tsx') as typeof import('../../components/legal/TermsTickRow.tsx');
    function Form() {
      const tick = row.useTermsTick();
      return createElement(row.default, { tick, id: 't' });
    }
    assert.equal(renderToStaticMarkup(withLinks(LegalLinksProvider, null, createElement(Form))), '');
    const on = renderToStaticMarkup(withLinks(LegalLinksProvider, LINKS, createElement(Form)));
    assert.match(on, /type="checkbox"/);
    assert.ok(!/checked=""/.test(on), 'the box is never pre-ticked');
    assert.match(on, /href="https:\/\/x\.test\/legal\/terms"[^>]*target="_blank"[^>]*>Terms of Service</);
    assert.match(on, /href="https:\/\/x\.test\/legal\/privacy"[^>]*>Privacy Policy</);
    assert.match(on, /18 or older/);
  });
});

// ════════════════════════════════════════════════════════════════ 5. the gate, the screen, the cancel door

function ScreenStub() { return null; }
function WatchStub() { return null; }

async function runGate({ state, hadEarlier = false, pathname = '/club/admin', plans = [] as Array<{ name: string; billingHref: string }>, user = { id: 'u1', email: 'pat@x.test' } as { id: string; email: string } | null, doors }: {
  state: 'off' | 'exempt' | 'accepted' | 'needed'; hadEarlier?: boolean; pathname?: string;
  plans?: Array<{ name: string; billingHref: string }>; user?: { id: string; email: string } | null; doors?: readonly string[];
}) {
  const planReads: string[] = [];
  const load = billingTestLoader({
    '@/lib/legal-acceptance': { checkAcceptance: async () => ({ state, hadEarlier }) },
    '@/lib/legal-acceptance-plans': { paidPlansOwnedBy: async (id: string) => { planReads.push(id); return plans; } },
    'next/headers': { headers: async () => new Headers({ 'x-pathname': pathname }) },
    './TermsAcceptScreen': { __esModule: true, default: ScreenStub },
    './TermsGateWatch': { __esModule: true, default: WatchStub },
  });
  const Gate = (load('components/legal/TermsAcceptGate.tsx') as { default: (p: unknown) => Promise<ReactElement> }).default;
  const children = createElement('main', null, 'the shell');
  const out = await Gate({ user, children, doors });
  return { out, children, planReads };
}
const parts = (out: ReactElement) => [(out.props as { children: unknown }).children].flat() as Array<ReactElement | undefined>;
/** The shell untouched: its children, and no watch. */
const rendersShell = (out: ReactElement, children: ReactElement) =>
  out.type === Fragment && parts(out).includes(children) && !parts(out).some(p => p?.type === WatchStub);
/** A let-through page: its children, with the watch beside them (a tap away asks the server again). */
const letsThrough = (out: ReactElement, children: ReactElement) =>
  out.type === Fragment && parts(out).includes(children) && parts(out).some(p => p?.type === WatchStub);

describe('the gate (B2): decided on the server, the screen INSTEAD of the shell', () => {
  for (const state of ['off', 'exempt', 'accepted'] as const) {
    it(`${state}: the shell, untouched`, async () => {
      const { out, children } = await runGate({ state });
      assert.ok(rendersShell(out, children));
    });
  }
  it('a visitor is never asked', async () => {
    const { out, children } = await runGate({ state: 'needed', user: null });
    assert.ok(rendersShell(out, children));
  });
  it('needed: the screen, and none of the shell', async () => {
    const { out } = await runGate({ state: 'needed' });
    assert.equal(out.type, ScreenStub);
    assert.deepEqual(out.props, { email: 'pat@x.test', updated: false, plans: [], fixedWarm: false });
  });
  it('the consumer shell’s own doors render their page — with the watch, so a tap into the app asks again', async () => {
    const { out, children } = await runGate({ state: 'needed', pathname: '/auth/accept-invite', doors: CONSUMER_SHELL_DOORS });
    assert.ok(letsThrough(out, children));
    const watch = parts(out).find(p => p?.type === WatchStub)!;
    assert.deepEqual(watch.props, { doors: CONSUMER_SHELL_DOORS, billingHrefs: [] });
  });
  it('"published": no cancel door, no plan read, and the billing page is NOT let through', async () => {
    const plans = [{ name: 'Club', billingHref: '/club/admin/org/billing' }];
    const { out, planReads } = await runGate({ state: 'needed', hadEarlier: false, pathname: '/club/admin/org/billing', plans });
    assert.equal(out.type, ScreenStub);
    assert.deepEqual((out.props as { plans: unknown }).plans, []);
    assert.deepEqual(planReads, []);
  });
  it('"updated": the cancel door names the paid plans, and their billing page is reachable WITHOUT agreeing', async () => {
    const plans = [{ name: 'Club', billingHref: '/club/admin/org/billing' }];
    const screen = await runGate({ state: 'needed', hadEarlier: true, pathname: '/club/admin', plans });
    assert.equal(screen.out.type, ScreenStub);
    assert.deepEqual((screen.out.props as { plans: unknown; updated: boolean }), { email: 'pat@x.test', updated: true, plans, fixedWarm: false });
    const billing = await runGate({ state: 'needed', hadEarlier: true, pathname: '/club/admin/org/billing', plans });
    assert.ok(letsThrough(billing.out, billing.children), 'the billing page renders: cancelling is never gated');
  });
});

function renderScreen(props: { updated: boolean; plans: Array<{ name: string; billingHref: string }> }) {
  const load2 = billingTestLoader({
    'next/navigation': { useRouter: () => ({ refresh() {}, push() {} }) },
    '@/lib/auth': { signOut: async () => {} },
    '@/components/shared/BrandLockup': { __esModule: true, default: () => createElement('span', null, 'FieldLogicHQ') },
  });
  const { LegalLinksProvider } = load2('components/legal/LegalLinksProvider.tsx') as typeof import('../../components/legal/LegalLinksProvider.tsx');
  const Screen = (load2('components/legal/TermsAcceptScreen.tsx') as { default: (p: Record<string, unknown>) => ReactElement }).default;
  return renderToStaticMarkup(withLinks(LegalLinksProvider, LINKS, createElement(Screen, { email: 'pat@x.test', fixedWarm: false, ...props })));
}
const unescape = (html: string) => html.replace(/&#x27;|&#39;/g, '’').replace(/&amp;/g, '&');

describe('the screen (B2, drawings tab 4): §20 (2) words, the box, Continue off, Sign out always', () => {
  it('"published": its title and line, the box, Continue off until ticked, the account and Sign out, no cancel door', () => {
    const html = unescape(renderScreen({ updated: false, plans: [{ name: 'Club', billingHref: '/club/admin/org/billing' }] }));
    assert.match(html, new RegExp(SCREEN_WORDS.published.title));
    assert.match(html, /FieldLogicHQ now has <\/span><span><a[^>]*href="https:\/\/x\.test\/legal\/terms"/);
    assert.match(html, /type="checkbox"/);
    assert.match(html, /<button type="submit"[^>]*disabled=""[^>]*>Continue<\/button>/);
    assert.match(html, /Signed in as <b[^>]*>pat@x\.test<\/b>/);
    assert.match(html, />Sign out</);
    assert.ok(!html.includes('cancel your plan'), 'first publication sold nothing before the Terms existed: no cancel door');
    assert.ok(!html.includes('/club/admin/org/billing'));
  });
  it('"updated" + one paid plan: the cancel door links straight to its billing page', () => {
    const html = unescape(renderScreen({ updated: true, plans: [{ name: 'Club', billingHref: '/club/admin/org/billing' }] }));
    assert.match(html, new RegExp(SCREEN_WORDS.updated.title));
    assert.match(html, /Don’t agree\? You can <a[^>]*href="\/club\/admin\/org\/billing"[^>]*>cancel your plan<\/a> instead\./);
  });
  it('"updated" + several paid plans: the link opens a short list', () => {
    const html = unescape(renderScreen({ updated: true, plans: [
      { name: 'Club A', billingHref: '/a/admin/org/billing' }, { name: 'Team B', billingHref: '/b/coaches/billing' },
    ] }));
    assert.match(html, /<button type="button"[^>]*aria-expanded="false"[^>]*>cancel your plan<\/button>/);
  });
  it('"updated" with no paid plan: no cancel door (Sign out is the way out)', () => {
    const html = unescape(renderScreen({ updated: true, plans: [] }));
    assert.ok(!html.includes('cancel your plan'));
  });
});

describe('the cancel door’s plans: what a person PAYS Stripe for', () => {
  it('a live subscription the person owns; never a mock, a lapsed one, or none', async () => {
    const org = (over: Row) => ({ organizations: { slug: 's', name: 'N', plan_id: 'club', account_kind: 'organization', subscription_status: 'active', stripe_subscription_id: 'sub_1', ...over } });
    const rows = [
      org({ slug: 'club', name: 'Riverdale' }),
      org({ slug: 'tourney', name: 'Cup', plan_id: 'tournament_plus', subscription_status: 'past_due' }),
      org({ slug: 'team', name: 'Hawks', plan_id: 'team', account_kind: 'team_workspace', subscription_status: 'trialing' }),
      org({ slug: 'mock', stripe_subscription_id: 'mock_1' }),
      org({ slug: 'gone', subscription_status: 'canceled' }),
      org({ slug: 'comped', stripe_subscription_id: null }),
    ];
    const filters: Array<[string, unknown]> = [];
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push([c, v]); return q; },
      then: (res: (v: unknown) => unknown) => res({ data: rows, error: null }),
    };
    const load = billingTestLoader({ './supabase-admin': { supabaseAdmin: { from: (t: string) => { assert.equal(t, 'organization_members'); return q; } } } });
    const { paidPlansOwnedBy } = load('lib/legal-acceptance-plans.ts') as typeof import('../../lib/legal-acceptance-plans.ts');
    assert.deepEqual(await paidPlansOwnedBy('u1'), [
      { name: 'Riverdale', billingHref: '/club/admin/org/billing' },
      { name: 'Cup', billingHref: '/tourney/admin/tournaments/settings/subscription' },
      { name: 'Hawks', billingHref: '/team/coaches/billing' },
    ]);
    assert.deepEqual(filters, [['user_id', 'u1'], ['role', 'owner'], ['status', 'active']]);
  });
});

// ════════════════════════════════════════════════════════════════ the accept route

async function postAccept(env: Record<string, string>, body: unknown, { user = { id: 'u1', email: 'pat@x.test', app_metadata: {} } as Row | null } = {}) {
  const h = legalHarness();
  const load = billingTestLoader({
    '@/lib/supabase-server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/lib/observability': { withObservability: (fn: unknown) => fn },
    '@/lib/legal-acceptance': h.load('lib/legal-acceptance.ts'),
  });
  const { POST } = load('app/api/legal/accept/route.ts') as { POST: (req: Request) => Promise<Response> };
  const res = await withEnv(env, () => POST(new Request('http://x.test/api/legal/accept', { method: 'POST', body: JSON.stringify(body) })));
  return { res, rows: h.table };
}

describe('the accept route (B2): the one door that satisfies the check', () => {
  it('the pages off: not found, nothing recorded', async () => {
    const { res, rows } = await postAccept(OFF, { termsVersion: 'draft' });
    assert.equal(res.status, 404);
    assert.equal(rows.length, 0);
  });
  it('signed in only', async () => {
    const { res } = await postAccept(PREVIEW, { termsVersion: 'draft' }, { user: null });
    assert.equal(res.status, 401);
  });
  it('a version that moved while the screen was open: terms_changed, nothing recorded', async () => {
    const { res, rows } = await postAccept(PREVIEW, { termsVersion: '2026-01-01' });
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: ACCEPTANCE_WORDS.refuseChangedWindow, code: 'terms_changed', termsVersion: 'draft' });
    assert.equal(rows.length, 0);
  });
  it('the shown version: one row, door sign_in_screen', async () => {
    const { res, rows } = await postAccept(PREVIEW, { termsVersion: 'draft' });
    assert.equal(res.status, 200);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].door, 'sign_in_screen');
  });
});
