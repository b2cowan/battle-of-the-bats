/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TWO-STEP SIGN-IN · PART 2, YOUR ACCOUNT (Board Ready; plan BOARD_READY_PLAN.md §5 Stage 0a "Part 2").
 *
 *   1. The actions that ask for a code: each calls the ONE server helper, after its own checks and before its first
 *      write or link. A new one joins FRESH_CODE_DOORS (the decision point).
 *   2. The helper's rule as behaviour: two-step off is never asked; a proof inside 15 minutes passes; older is refused.
 *   3. Turn off: a password-only session cannot reach it; a covered seat is refused; the ORDER leaves two-step on if it
 *      fails part-way (and a swap of that order is caught: the mutants).
 *   4. Set up a new phone: the lost-phone path keeps Part 1's order (mark first, delete after; mutant-tested); the
 *      still-have-it path adds before it removes.
 *   5. Change password: checked on a client with no cookies (never the session's own), that session signed out, the
 *      code asked after the password and before the save, the other sessions signed out after.
 *   6. One window: staff's "sign in again" renders the shared window and has no field of its own; the product-wide
 *      listener answers exactly the two "type your code" refusals and never its own check.
 *   7. Keyed backup-code hashes, both forms checked.
 *   8. Lost your phone: the support version for everyone until Part 3's door exists.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { hasFreshCode } from '../../lib/two-step-fresh.ts';
import { backupCodeMatches, hashBackupCode } from '../../lib/two-step-codes.ts';
import { CLUB_RESET_DOOR_BUILT, lostPhoneVersion } from '../../lib/two-step-lost-phone.ts';
import { CODE_AGAIN_REFUSALS, CODE_AGAIN_ROUTE, TWO_STEP_CODE_REFUSAL, TWO_STEP_FRESH_CODE, TWO_STEP_SET_UP_REFUSAL } from '../../lib/code-again.ts';
import { TWO_STEP_REFUSAL } from '../../lib/two-step-gate.ts';
import type { SessionTwoStep } from '../../lib/two-step-session.ts';

/** Every action that asks for a code, with the first write or link the check must come BEFORE. */
const FRESH_CODE_DOORS: Record<string, string[]> = {
  'app/api/admin/payouts/route.ts': ['createClubAccount(', 'onboardingLink(row.stripe_account_id', 'dashboardLink(', "update({ disconnected_at: now"],
  'app/api/admin/members/invite/route.ts': ['auth.admin.listUsers('],
  'app/api/admin/members/[memberId]/route.ts': ['.update(update)', "'rep_group_scope_changed'"],
  'app/api/platform-admin/orgs/[id]/transfer-ownership/route.ts': [".update({ role: 'owner' })"],
  'app/api/platform-admin/company-users/route.ts': ['auth.admin.createUser('],
  'app/api/platform-admin/company-users/[id]/route.ts': ['updatePlatformUser(id'],
  'app/api/auth/two-step/backup-codes/route.ts': ['createBackupCodes('],
  'app/api/auth/two-step/set-up/start/route.ts': ['auth.admin.updateUserById(', 'deleteFactor('],
  'app/api/auth/two-step/turn-off/route.ts': ['auth.admin.updateUserById('],
  'app/api/auth/password/route.ts': ['auth.admin.updateUserById('],
};

const FRESH_CALL = /requireFreshCode\(\)|hasFreshCode\(state\)/g;

describe('1 · the actions that ask for a code', () => {
  for (const [file, writes] of Object.entries(FRESH_CODE_DOORS)) {
    it(`${file} asks before it writes`, () => {
      const code = readCode(file);
      const calls = [...code.matchAll(FRESH_CALL)].map(m => m.index ?? -1);
      assert.ok(calls.length > 0, `${file} no longer asks for a fresh code`);
      for (const w of writes) {
        const at = code.indexOf(w);
        assert.ok(at > 0, `${file}: anchor "${w}" moved`);
        assert.ok(calls.some(c => c < at), `${file}: "${w}" can run before the code is asked for`);
      }
    });
  }

  it('the payouts route asks inside each of the four Stripe-link actions, and never for fee settings or the terms', () => {
    const code = readCode('app/api/admin/payouts/route.ts');
    for (const action of ["case 'connect'", "case 'continue'", "case 'dashboard'", "case 'disconnect'"]) {
      const start = code.indexOf(action);
      const end = code.indexOf('case ', start + action.length);
      const body = code.slice(start, end > 0 ? end : undefined);
      assert.match(body, /requireFreshCode\(\)/, `${action} no longer asks`);
    }
    const terms = code.slice(code.indexOf("case 'agree_terms'"), code.indexOf("case 'continue'"));
    assert.doesNotMatch(terms, /requireFreshCode/);
    const patch = code.slice(code.indexOf('export const PATCH'), code.indexOf('export const POST'));
    assert.doesNotMatch(patch, /requireFreshCode/, 'who pays the fee is not a payout detail');
  });

  it('adding an admin asks; other roles do not', () => {
    assert.match(readCode('app/api/admin/members/invite/route.ts'), /if \(role === 'admin'\) \{\s*const stale = await requireFreshCode\(\)/);
    assert.match(readCode('app/api/admin/members/[memberId]/route.ts'), /if \(body\.role === 'admin'\) \{\s*const stale = await requireFreshCode\(\)/);
  });
});

const session = (over: Partial<SessionTwoStep>): SessionTwoStep => ({
  user: { id: 'u' } as SessionTwoStep['user'],
  aal: 'aal2', sessionId: 's', hasFactor: true, provedAt: null, viaBackupCode: false, passed: true,
  ...over,
});

describe('2 · the rule', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  it('two-step off is never asked', () => assert.equal(hasFreshCode(session({ hasFactor: false, aal: 'aal1' }), now), true));
  it('a code 10 minutes old passes; 16 minutes is asked again', () => {
    assert.equal(hasFreshCode(session({ provedAt: now - 10 * 60_000 }), now), true);
    assert.equal(hasFreshCode(session({ provedAt: now - 16 * 60_000 }), now), false);
  });
  it('a session that has not passed never passes', () => {
    assert.equal(hasFreshCode(session({ passed: false, provedAt: now }), now), false);
    assert.equal(hasFreshCode(null, now), false);
  });
});

/** Turn off's order: mark → remove every authenticator → confirm none → clear the mark → backup codes. */
function turnOffOrderHolds(code: string): boolean {
  const mark = code.indexOf('[REPLACING_AUTHENTICATOR_FLAG]: true');
  const del = code.indexOf('deleteFactor(');
  const confirm = code.indexOf('(after?.factors ?? []).length > 0');
  const clear = code.indexOf('const { error: clearErr }');
  const codes = code.indexOf("from('two_step_backup_codes').delete()");
  return [mark, del, confirm, clear, codes].every(i => i > 0) && mark < del && del < confirm && confirm < clear && clear < codes;
}

describe('3 · turn off', () => {
  const route = readCode('app/api/auth/two-step/turn-off/route.ts');

  it('a password-only session is refused before anything else', () => {
    const first = route.indexOf('if (!state?.passed)');
    assert.ok(first > 0 && first < route.indexOf('updateUserById'), 'a session that has not typed the code reaches the write');
  });
  it('any covered seat (staff; a club seat, grace included) is refused', () => {
    assert.match(route, /requirements\.reasons\.length > 0/);
    assert.ok(route.indexOf('requirements.reasons.length > 0') < route.indexOf('updateUserById'));
  });
  it('the order leaves two-step ON if it fails part-way', () => assert.equal(turnOffOrderHolds(route), true));
  it('mutants: each swap of the order is caught', () => {
    const swapMarkAndDelete = route
      .replace('[REPLACING_AUTHENTICATOR_FLAG]: true', '@@MARK@@')
      .replace(/deleteFactor\(/, '[REPLACING_AUTHENTICATOR_FLAG]: true')
      .replace('@@MARK@@', 'deleteFactor(');
    assert.equal(turnOffOrderHolds(swapMarkAndDelete), false);
    const codesFirst = route
      .replace("from('two_step_backup_codes').delete()", '@@CODES@@')
      .replace('[REPLACING_AUTHENTICATOR_FLAG]: true', "from('two_step_backup_codes').delete()")
      .replace('@@CODES@@', '[REPLACING_AUTHENTICATOR_FLAG]: true');
    assert.equal(turnOffOrderHolds(codesFirst), false);
    assert.equal(turnOffOrderHolds(route.replace('(after?.factors ?? []).length > 0', 'false')), false);
  });
});

/** The lost-phone path: the account is marked BEFORE the old authenticator is deleted. */
function markFirstHolds(code: string): boolean {
  const mark = code.indexOf('[REPLACING_AUTHENTICATOR_FLAG]: true');
  const del = code.indexOf('deleteFactor(');
  return mark > 0 && del > 0 && mark < del;
}

describe('4 · set up a new phone', () => {
  const start = readCode('app/api/auth/two-step/set-up/start/route.ts');
  const verify = readCode('app/api/auth/two-step/set-up/verify/route.ts');

  it('asks for a proof from the last 15 minutes before any new phone', () => {
    assert.match(start, /\(hasVerified \|\| isReplacingAuthenticator\(user\)\) && !hasFreshCode\(state\)/);
  });
  it('lost phone (a backup code let it in): marked first, deleted after — and a swap is caught', () => {
    assert.equal(markFirstHolds(start), true);
    const swapped = start
      .replace('[REPLACING_AUTHENTICATOR_FLAG]: true', '@@MARK@@')
      .replace('deleteFactor(', '[REPLACING_AUTHENTICATOR_FLAG]: true')
      .replace('@@MARK@@', 'deleteFactor(');
    assert.equal(markFirstHolds(swapped), false);
  });
  it('still have it (the app’s code): the old authenticator is never deleted at start, only after the new one verified', () => {
    assert.match(start, /const adding = hasVerified && state\.aal === 'aal2'/);
    assert.match(start, /if \(f\.status !== 'verified' \|\| marking\)/, 'a verified authenticator is deleted at start only when marking');
    const verified = verify.indexOf('mfa.verify(');
    const removed = verify.indexOf('deleteFactor(');
    assert.ok(verified > 0 && removed > verified, 'the old phone goes only after the new one is verified');
    assert.match(verify, /if \(f\.id === body\.factorId \|\| f\.status !== 'verified'\) continue/);
  });
});

describe('5 · change password', () => {
  const route = readCode('app/api/auth/password/route.ts');
  it('checks the current password on a client that keeps no session, never the session’s own', () => {
    assert.match(route, /persistSession: false/);
    assert.match(route, /checker\.auth\.signInWithPassword\(/);
    assert.doesNotMatch(route, /\(await createClient\(\)\)\.auth\.signInWithPassword/);
    assert.match(route, /checker\.auth\.signOut\(\{ scope: 'local' \}\)/, 'the check’s own session is left behind');
  });
  it('the code is asked after the password and before the save; other sessions go after it', () => {
    const pw = route.indexOf('checker.auth.signInWithPassword(');
    const fresh = route.indexOf('hasFreshCode(state)');
    const save = route.indexOf('auth.admin.updateUserById(');
    const others = route.indexOf("signOut({ scope: 'others' })");
    assert.ok(pw < fresh && fresh < save && save < others);
  });
});

describe('6 · one window', () => {
  it('staff’s "sign in again" renders the shared window and has no field of its own', () => {
    const staff = readCode('app/platform-admin/SignInAgain.tsx');
    assert.match(staff, /<CodeAgainWindow/);
    assert.doesNotMatch(staff, /<input/);
    assert.doesNotMatch(staff, /<KitDialog/);
  });
  it('the listener answers exactly the two "type your code" refusals, never its own check, and is mounted once', () => {
    assert.deepEqual([...CODE_AGAIN_REFUSALS].sort(), [TWO_STEP_CODE_REFUSAL, TWO_STEP_FRESH_CODE].sort());
    assert.equal(TWO_STEP_CODE_REFUSAL, TWO_STEP_REFUSAL.code);
    assert.equal(TWO_STEP_SET_UP_REFUSAL, TWO_STEP_REFUSAL.set_up);
    const provider = readCode('components/shared/CodeAgainProvider.tsx');
    assert.match(provider, /const OWN_CHECKS = new Set\(\[CODE_AGAIN_ROUTE, '\/api\/platform-admin\/sign-in-again'\]\)/);
    assert.match(provider, /!OWN_CHECKS\.has\(url\.pathname\)/);
    // A request that cannot be sent again is never asked about (the code would be spent for nothing).
    assert.ok(provider.indexOf('!canResend(again, init)') < provider.indexOf('await opener(kind)'));
    assert.equal(CODE_AGAIN_ROUTE, '/api/auth/two-step/code-again');
    assert.match(readCode('app/layout.tsx'), /<CodeAgainProvider \/>/);
  });
  it('both doors check through the one server function', () => {
    assert.match(readCode('app/api/auth/two-step/code-again/route.ts'), /checkProofAgain\(state, body\)/);
    assert.match(readCode('lib/platform-sign-in-again.ts'), /checkProofAgain\(state, proof\)/);
  });
});

describe('7 · keyed backup-code hashes', () => {
  const key = 'k'.repeat(40);
  it('new codes are keyed when the secret exists, the older form otherwise', () => {
    assert.match(hashBackupCode('salt', 'KD7PR4TS', key), /^k1:[0-9a-f]{64}$/);
    assert.match(hashBackupCode('salt', 'KD7PR4TS', null), /^[0-9a-f]{64}$/);
  });
  it('both forms are checked, and a keyed code is never let through without the secret', () => {
    const keyed = hashBackupCode('salt', 'KD7PR4TS', key);
    const plain = hashBackupCode('salt', 'KD7PR4TS', null);
    assert.equal(backupCodeMatches(keyed, 'salt', 'KD7PR4TS', key), true);
    assert.equal(backupCodeMatches(keyed, 'salt', 'KD7PR4TX', key), false);
    assert.equal(backupCodeMatches(keyed, 'salt', 'KD7PR4TS', null), false);
    assert.equal(backupCodeMatches(keyed, 'salt', 'KD7PR4TS', 'x'.repeat(40)), false);
    assert.equal(backupCodeMatches(plain, 'salt', 'KD7PR4TS', key), true);
  });
});

describe('8 · lost your phone', () => {
  it('everyone gets the support version until Part 3 builds the club’s reset', async () => {
    assert.equal(CLUB_RESET_DOOR_BUILT, false);
    assert.equal(await lostPhoneVersion('00000000-0000-0000-0000-000000000000'), 'support');
  });
  it('the screen asks for the version, and never names a club', () => {
    const route = readCode('app/api/auth/two-step/lost-phone/route.ts');
    assert.match(route, /version: await lostPhoneVersion\(state\.user\.id\)/);
    assert.doesNotMatch(route, /orgName|organizations\(/);
  });
});

describe('9 · the fixes from the review', () => {
  it('a backup code is counted inside the SHORTEST window anything asks for (staff, 10 minutes)', async () => {
    const { BACKUP_READ_AFTER_MS } = await import('../../lib/two-step-session.ts');
    const { SIGN_IN_AGAIN_MINUTES } = await import('../../lib/sign-in-again.ts');
    const { TWO_STEP_FRESH_MINUTES } = await import('../../lib/two-step-rule.ts');
    assert.ok(BACKUP_READ_AFTER_MS <= Math.min(SIGN_IN_AGAIN_MINUTES, TWO_STEP_FRESH_MINUTES) * 60_000);
  });
  it('finishing a set-up asks for a fresh code before it verifies anything', () => {
    const verify = readCode('app/api/auth/two-step/set-up/verify/route.ts');
    const fresh = verify.indexOf('if (!hasFreshCode(state)) return freshCodeRefusal();');
    assert.ok(fresh > 0 && fresh < verify.indexOf('mfa.challenge('));
  });
  it('a replacement removes every other authenticator BEFORE the mark is cleared, and keeps the mark if one stays', () => {
    const verify = readCode('app/api/auth/two-step/set-up/verify/route.ts');
    const removed = verify.indexOf('deleteFactor(');
    const kept = verify.indexOf('if (!oldRemoved)');
    const cleared = verify.indexOf('[REPLACING_AUTHENTICATOR_FLAG]: false');
    assert.ok(removed > 0 && removed < kept && kept < cleared);
    assert.match(verify, /if \(body\.replace === true \|\| wasReplacing\)/);
  });
  it('the seat list fails closed: an unreadable list never reads as "nothing requires it"', () => {
    const req = readCode('lib/two-step-requirements.ts');
    assert.match(req, /if \(membersErr\) throw membersErr;/);
    assert.match(req, /if \(gracesErr\) throw gracesErr;/);
  });
  it('a proof time in the future never counts', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    assert.equal(hasFreshCode(session({ provedAt: now + 60_000 }), now), false);
  });
});
