/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TWO-STEP SIGN-IN · THE SERVER CHECK (Board Ready, Part 1; plan BOARD_READY_PLAN.md §5 Stage 0a).
 *
 * ⚖ A password alone opens nothing for a person who has two-step on. The server decides "who is signed in" in ONE place,
 * lib/two-step-session.ts, and this file fails the build when something decides it another way.
 *
 *   1. No server file calls the sign-in service's getUser / getSession / getClaims itself. A new route that must read
 *      the session goes through getSignedInUser / getAuthenticatedUser / getSessionTwoStep, or joins the allow-list
 *      below with its reason — which is the decision point.
 *   2. The shared helpers apply the rule: getAuthenticatedUser returns only a session that passed; getAuthContext checks
 *      the seat (a club's switch); the platform context always requires it; the proxy uses the same check.
 *   3. Every one of the twelve password sign-in doors hands off to the one code step.
 *   4. The rule itself, and the session read, as behaviour.
 *   5. The retired demos left no special case in the set-up doors.
 *   6. The database half (mig 463) exists and is the same rule.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode, readSource, sourceExists } from './_source-code.ts';
import {
  TWO_STEP_GRACE_DAYS, platformStaffTwoStepRequired, requiredSeatNeed, seatTwoStepRequirement,
} from '../../lib/two-step-rule.ts';
import { codeTypedAt, provedWithin, readSessionTwoStep } from '../../lib/two-step-session.ts';
import { twoStepStepUrl } from '../../lib/two-step-paths.ts';

/** The ONLY server files that may ask the sign-in service for the session, each with its reason. */
const SESSION_READERS: Record<string, string> = {
  'lib/two-step-session.ts': 'THE one read: getUser, then the same session’s token for its two-step level',
  'lib/platform-sign-in-again.ts': 'getClaims for the password clock, only for a staff account with NO authenticator (dev opt-out)',
};

/** Browser modules: they read the browser's own session, and every server answer they lead to is checked server-side. */
const BROWSER_MODULES = new Set(['lib/auth.ts', 'lib/org-context.tsx', 'lib/use-notification-unread.ts', 'lib/supabase-browser.ts']);

/** A session read, written any way: `.auth.getUser(`, split across lines, or off a destructured `auth`. */
const SESSION_READ = /\bauth\s*\.\s*(getUser|getSession|getClaims)\s*\(|\{\s*auth\s*\}\s*=/;

const isClient = (code: string) => /^\s*['"]use client['"]/.test(code);

function serverFiles(): string[] {
  const files = [
    ...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'),
    ...filesUnder('lib', '.ts'), ...filesUnder('lib', '.tsx'),
    ...filesUnder('components', '.ts'), ...filesUnder('components', '.tsx'),
    'proxy.ts',
  ];
  return files.filter(f => !f.endsWith('.test.ts') && !BROWSER_MODULES.has(f));
}

describe('1 · nothing on the server reads the session another way', () => {
  it('no server file calls auth.getUser / getSession / getClaims outside the allow-list', () => {
    const offenders: string[] = [];
    for (const f of serverFiles()) {
      const code = readCode(f);
      if (isClient(code)) continue;
      if (!SESSION_READ.test(code)) continue;
      if (SESSION_READERS[f]) continue;
      offenders.push(f);
    }
    assert.deepEqual(offenders, [], `these read the session without the two-step check — use getSignedInUser (lib/two-step-session.ts): ${offenders.join(', ')}`);
  });

  it('every allow-listed reader still exists and still needs its place', () => {
    for (const f of Object.keys(SESSION_READERS)) {
      assert.match(readCode(f), SESSION_READ, `${f} no longer reads the session: drop it from the list`);
    }
  });
});

describe('2 · the shared helpers apply the rule', () => {
  it('getAuthenticatedUser returns only a session that passed', () => {
    const code = readCode('lib/api-auth.ts');
    const body = code.slice(code.indexOf('export const getAuthenticatedUser'), code.indexOf('async function requestPathForReturn'));
    assert.match(body, /state\?\.passed \? state\.user : null/);
    assert.match(code.slice(code.indexOf('export const getSessionTwoStep')), /return readSessionTwoStep\(supabase\)/);
  });

  it('getAuthContext checks the seat before it returns an org', () => {
    const body = functionBody(readCode('lib/api-auth.ts'), 'getAuthContext');
    const check = body.indexOf('await assertTwoStepForSeat(orgRow, membership, state)');
    assert.ok(check > 0, 'the seat check is gone from getAuthContext');
    assert.ok(check < body.indexOf('const org: Organization'), 'the seat is checked before the org is built');
    assert.match(body, /select\('status, role, organizations\(\*\)'\)/, 'the seat (role) is read with the membership');
    assert.match(body, /const user = state\?\.passed \? state\.user : null;/, 'the user comes from the same two-step read the seat check uses');
    const seat = functionBody(readCode('lib/api-auth.ts'), 'assertTwoStepForSeat');
    assert.match(seat, /seatTwoStepRequirement\(/);
    assert.match(seat, /requiredSeatNeed\(state\)/);
    assert.match(seat, /throw new TwoStepRequiredError\(need/);
  });

  it('the platform context always requires two-step for staff', () => {
    const body = functionBody(readCode('lib/platform-auth.ts'), 'getPlatformAdminContext');
    assert.match(body, /const state = await getSessionTwoStep\(\)/);
    assert.match(body, /state\?\.passed \? state\.user : null/);
    assert.match(body, /platformStaffTwoStepRequired\(\)/);
    assert.match(body, /throw new TwoStepRequiredError\(need/);
  });

  it('the proxy and the cached page reader use the same check', () => {
    assert.match(readCode('proxy.ts'), /const user = await getSignedInUser\(supabase\)/);
    assert.match(readCode('lib/supabase-server.ts'), /export const getAuthUserCached = cache\(async \(\) => \{\s*const supabase = await createClient\(\);\s*return getSignedInUser\(supabase\);/);
  });

  it('the refusal is a 401 in a route and a redirect in a page', async () => {
    const { TwoStepRequiredError } = await import('../../lib/two-step-gate.ts');
    const { isRedirectError } = await import('next/dist/client/components/redirect-error.js');
    const err = new TwoStepRequiredError('set_up', '/milton/admin/families?x=1');
    assert.equal(err.status, 401);
    assert.equal(err.body().code, 'two_step_set_up');
    assert.ok(isRedirectError(err), 'a page that throws it must redirect, never show an error');
    assert.equal(err.destination, '/auth/two-step?why=required&next=%2Fmilton%2Fadmin%2Ffamilies%3Fx%3D1', 'why=required opens the club’s screen first (Part 3)');
    assert.equal(new TwoStepRequiredError('code', 'https://evil.example').destination, '/auth/login?step=code', 'an outside next is dropped');
  });
});

describe('3 · every password sign-in hands off to the one code step', () => {
  it('every caller of signIn() stops on handedOff, or shows the step itself', () => {
    const callers = [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
      .filter(f => /await signIn\(/.test(readCode(f)) && /(?:from |import\()'@\/lib\/auth'/.test(readCode(f)));
    assert.ok(callers.length >= 11, `expected the sign-in doors, found ${callers.length}`);
    for (const f of callers) {
      const code = readCode(f);
      const calls = code.match(/await signIn\(/g)?.length ?? 0;
      // The stop itself (`if (handedOff) return`, `if (x.handedOff) return`), not a mention of the name.
      const handled = (code.match(/handedOff\)\s*return\b/g)?.length ?? 0) + (code.match(/codeStep: 'here'/g)?.length ?? 0);
      assert.ok(handled >= calls, `${f}: ${calls} sign-in call(s) but ${handled} hand-off check(s)`);
    }
  });

  it('signIn() hands off when the account has two-step on', () => {
    const body = functionBody(readCode('lib/auth.ts'), 'signIn');
    assert.match(body, /getAuthenticatorAssuranceLevel\(\)/);
    assert.match(body, /currentLevel === 'aal1' && level\.nextLevel === 'aal2'/);
    assert.match(body, /window\.location\.assign\(twoStepStepUrl\('code', back\)\)/);
  });

  it('the shared sign-in page and the reset page show the code step', () => {
    assert.match(readCode('app/(consumer)/auth/login/page.tsx'), /<TwoStepCodeStep/);
    assert.match(readCode('app/(consumer)/auth/reset-password/page.tsx'), /<TwoStepCodeStep/);
  });

  it('"Use a different account" signs out this device only', () => {
    assert.match(readCode('components/auth/TwoStepCodeStep.tsx'), /signOut\(\{ scope: 'local' \}\)/);
  });

  it('the step links are same-site only', () => {
    assert.equal(twoStepStepUrl('code', '/platform-admin'), '/auth/login?step=code&next=%2Fplatform-admin');
    assert.equal(twoStepStepUrl('set_up', '//evil.example'), '/auth/two-step');
    assert.equal(twoStepStepUrl('set_up', null, { replace: '1' }), '/auth/two-step?replace=1');
  });
});

describe('4 · the rule, and the session read', () => {
  const NOW = Date.parse('2026-11-20T12:00:00Z');
  const DAY = 86_400_000;
  const club = { two_step_board_required_since: new Date(NOW - 20 * DAY).toISOString(), two_step_coaches_required_since: null, account_kind: 'organization', plan_id: 'club' };

  it('the board switch covers the board seats, past their 14 days', () => {
    for (const role of ['owner', 'admin', 'treasurer', 'league_admin', 'league_registrar']) {
      assert.equal(seatTwoStepRequirement(club, role, null, NOW).kind, 'required', role);
    }
    for (const role of ['coach', 'staff', 'official']) assert.equal(seatTwoStepRequirement(club, role, null, NOW).kind, 'none', role);
  });

  it('the coaches switch covers coaches only', () => {
    const c = { ...club, two_step_board_required_since: null, two_step_coaches_required_since: club.two_step_board_required_since };
    assert.equal(seatTwoStepRequirement(c, 'coach', null, NOW).kind, 'required');
    assert.equal(seatTwoStepRequirement(c, 'owner', null, NOW).kind, 'none');
  });

  it('the 14 days count from the switch, or from the person’s own later start', () => {
    const recent = { ...club, two_step_board_required_since: new Date(NOW - 3 * DAY).toISOString() };
    const g = seatTwoStepRequirement(recent, 'treasurer', null, NOW);
    assert.equal(g.kind, 'grace');
    assert.equal(g.kind === 'grace' && (g.until.getTime() - (NOW - 3 * DAY)) / DAY, TWO_STEP_GRACE_DAYS);
    assert.equal(seatTwoStepRequirement(club, 'treasurer', new Date(NOW - 2 * DAY).toISOString(), NOW).kind, 'grace');
  });

  it('a test organization and a coach’s own team workspace never require it', () => {
    assert.equal(seatTwoStepRequirement({ ...club, is_test_organization: true }, 'owner', null, NOW).kind, 'none');
    assert.equal(seatTwoStepRequirement({ ...club, account_kind: 'team_workspace' }, 'owner', null, NOW).kind, 'none');
    assert.equal(seatTwoStepRequirement({ ...club, two_step_board_required_since: null }, 'owner', null, NOW).kind, 'none');
  });

  it('a required seat: set it up when off, the code again after 30 days', () => {
    assert.equal(requiredSeatNeed({ hasFactor: false, provedAt: null }, NOW), 'set_up');
    assert.equal(requiredSeatNeed({ hasFactor: true, provedAt: NOW - 29 * DAY }, NOW), null);
    assert.equal(requiredSeatNeed({ hasFactor: true, provedAt: NOW - 31 * DAY }, NOW), 'code');
    assert.equal(requiredSeatNeed({ hasFactor: true, provedAt: null }, NOW), 'code');
  });

  it('staff always: the dev opt-out is refused against the production project', () => {
    assert.equal(platformStaffTwoStepRequired({ NEXT_PUBLIC_SUPABASE_URL: 'https://dev.supabase.co' } as unknown as NodeJS.ProcessEnv), true);
    assert.equal(platformStaffTwoStepRequired({ TWO_STEP_STAFF_REQUIRED: 'off', NEXT_PUBLIC_SUPABASE_URL: 'https://dev.supabase.co' } as unknown as NodeJS.ProcessEnv), false);
    assert.equal(platformStaffTwoStepRequired({ TWO_STEP_STAFF_REQUIRED: 'off', NEXT_PUBLIC_SUPABASE_URL: 'https://qcttcboqysynwcdyghil.supabase.co' } as unknown as NodeJS.ProcessEnv), true);
  });

  const token = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
  const fakeClient = (user: object | null, claims: object) => ({
    auth: {
      getUser: async () => ({ data: { user } }),
      getSession: async () => ({ data: { session: { access_token: token(claims) } } }),
    },
  }) as never;
  const verified = [{ id: 'f', status: 'verified', factor_type: 'totp' }];

  it('a password-only session with two-step on has not passed; one that typed the code has', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const off = await readSessionTwoStep(fakeClient({ id, factors: [] }, { sub: id, aal: 'aal1' }));
    assert.equal(off?.passed, true, 'two-step off: the password is the sign-in');
    // No service key in the test run: the backup-code read fails closed.
    const pw = await readSessionTwoStep(fakeClient({ id, factors: verified }, { sub: id, aal: 'aal1', session_id: id }));
    assert.equal(pw?.passed, false, 'two-step on, password only: not signed in');
    const t = Math.floor(NOW / 1000);
    const code = await readSessionTwoStep(fakeClient({ id, factors: verified }, { sub: id, aal: 'aal2', amr: [{ method: 'password', timestamp: t - 60 }, { method: 'totp', timestamp: t }] }));
    assert.equal(code?.passed, true);
    assert.equal(code?.provedAt, t * 1000);
    assert.equal(provedWithin(code!, 15, NOW + 14 * 60_000), true);
    assert.equal(provedWithin(code!, 15, NOW + 16 * 60_000), false);
    assert.equal(await readSessionTwoStep(fakeClient({ id, factors: [] }, { sub: 'someone-else', aal: 'aal2' })), null, 'a token that is not the user’s own is nobody');
    assert.equal(await readSessionTwoStep(fakeClient(null, {})), null);
    // Replacing a lost phone: no authenticator for the moment, but two-step stays ON, so a password alone is not a sign-in.
    const replacing = await readSessionTwoStep(fakeClient({ id, factors: [], app_metadata: { two_step_replacing: true } }, { sub: id, aal: 'aal1', session_id: id }));
    assert.equal(replacing?.hasFactor, true);
    assert.equal(replacing?.passed, false);
    // ⚠ /review of Part 2: mid-replacement the sign-in service lets ANY session (a stolen password's) set up its own first
    // authenticator and reach aal2. Then aal2 counts for nothing; only one of our backup codes lets a session through.
    const sideApp = await readSessionTwoStep(fakeClient(
      { id, factors: verified, app_metadata: { two_step_replacing: true } },
      { sub: id, aal: 'aal2', session_id: id, amr: [{ method: 'totp', timestamp: t }] },
    ));
    assert.equal(sideApp?.passed, false, 'an authenticator set up on the side during a replacement is not a sign-in');
    assert.equal(sideApp?.provedAt, null);
  });

  it('"when the code was typed" is the latest totp entry', () => {
    assert.equal(codeTypedAt({ amr: [{ method: 'totp', timestamp: 10 }, { method: 'totp', timestamp: 20 }, { method: 'password', timestamp: 30 }] }), 20_000);
    assert.equal(codeTypedAt({ amr: [{ method: 'password', timestamp: 30 }] }), null);
  });
});

describe('5 · the retired demos left no special case in the set-up doors', () => {
  it('set-up has no shared-account refusal any more, and the demo session maker is gone', () => {
    for (const f of ['app/api/auth/two-step/set-up/start/route.ts', 'app/api/auth/two-step/set-up/verify/route.ts']) {
      assert.doesNotMatch(readCode(f), /isDemoOrganizerEmail|demo-org/, f);
    }
    assert.ok(!sourceExists('lib/demo-session.ts'), 'lib/demo-session.ts is gone');
  });
});

describe('6 · the database half (mig 463)', () => {
  it('a later migration that grants signed-in accounts a table also gives it the two-step policy', () => {
    const later = filesUnder('supabase/migrations', '.sql').filter(f => Number(f.match(/\/(\d+)_/)?.[1] ?? 0) > 463);
    for (const f of later) {
      const sql = readSource(f).replace(/--[^\n]*/g, '');
      if (/grant\s+[^;]*\bon\s+(table\s+)?(public\.)?\w+\s+to\s+[^;]*\bauthenticated\b/i.test(sql)) {
        assert.match(sql, /two_step_passed/, `${f} grants a table to authenticated without the two_step_passed policy (mig 463's loop)`);
      }
    }
  });

  const mig = readSource('supabase/migrations/463_a_second_step_after_the_password.sql');
  it('says the same rule as the server', () => {
    const fn = mig.slice(mig.indexOf('create or replace function public.session_passed_two_step()'), mig.indexOf('revoke all on function public.session_passed_two_step()'));
    assert.match(fn, /auth\.jwt\(\) ->> 'aal', 'aal1'\) = 'aal2'/);
    assert.match(fn, /auth\.mfa_factors f\s+where f\.user_id = auth\.uid\(\) and f\.status = 'verified'/);
    assert.match(fn, /two_step_backup_codes b[\s\S]*used_session_id::text = \(auth\.jwt\(\) ->> 'session_id'\)/);
  });
  it('covers every table a signed-in token can reach, by its grants, and the file store', () => {
    assert.match(mig, /has_table_privilege\('authenticated', c\.oid, 'SELECT'\)/);
    assert.match(mig, /as restrictive for all to authenticated/);
    assert.match(mig, /create policy two_step_passed on storage\.objects as restrictive/);
  });
});
