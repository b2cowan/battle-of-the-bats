/**
 * A SUPPORT OR BILLING ACTION IS FOR CUSTOMERS' ACCOUNTS (security fix, 2026-10-16; the second sweep's second finding).
 * The Customer users actions sit behind `manage_support` (support and billing) and took any account; a platform role
 * is read from the session's email, so changing emails escalated to super admin. Now each action refuses a staff
 * target — the account, or an email it would set or send to — unless the caller is a super admin.
 *
 * Source scans: the guard's own rules, and that every support-gated action on a user calls it before acting. A new
 * action under users/[id] fails here until it does (or is listed as harmless).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { readCode } from './_source-code.ts';

const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };
const USERS = 'app/api/platform-admin/users/[id]';

describe('the guard', () => {
  const lib = readCode('lib/platform-staff-guard.ts');

  it('lets a super admin through, and only a super admin', () => {
    assert.match(lib, /if \(role === 'super_admin'\) return null;/);
  });

  it('reads the target account’s email and refuses when it, or any email named, is staff', () => {
    assert.match(lib, /supabaseAdmin\.auth\.admin\.getUserById\(target\.userId\)/);
    assert.match(lib, /if \(await isPlatformAdminEmail\(email\)\) return NextResponse\.json\(\{ error: STAFF_TARGET_REFUSAL \}, \{ status: 403 \}\);/);
  });

  it('fails closed when the target can’t be read', () => {
    assert.match(lib, /if \(error && error\.status !== 404\) return NextResponse\.json\(\{ error: STAFF_TARGET_REFUSAL \}, \{ status: 403 \}\);/);
  });
});

describe('each Customer users action checks before it acts', () => {
  const cases: Array<[string, RegExp, string]> = [
    ['update', /staffTargetRefusal\(auth\.role, \{ userId: id, emails: \[email\] \}\)/, 'supabaseAdmin.auth.admin.updateUserById('],
    ['ban', /staffTargetRefusal\(auth\.role, \{ userId: id, emails: \[email\] \}\)/, 'supabaseAdmin.auth.admin.updateUserById('],
    ['revoke-sessions', /staffTargetRefusal\(auth\.role, \{ userId: id, emails: \[body\.email\] \}\)/, 'await fetch('],
    ['confirm-email', /staffTargetRefusal\(auth\.role, \{ userId: id, emails: \[body\.email\] \}\)/, 'supabaseAdmin.auth.admin.updateUserById('],
    ['reset', /staffTargetRefusal\(auth\.role, \{ emails: \[email\] \}\)/, 'supabaseAdmin.auth.admin.generateLink('],
  ];
  for (const [name, call, act] of cases) {
    it(name, () => {
      const src = readCode(`${USERS}/${name}/route.ts`);
      assert.match(src, call);
      const check = at(src, 'if (staffRefused) return staffRefused;');
      assert.ok(check < at(src, act), `${name} refuses before it acts`);
    });
  }

  it('every support-gated action on a user is in that list (notes are harmless; delete is super-admin only)', () => {
    const actions = readdirSync(USERS).filter(n => statSync(`${USERS}/${n}`).isDirectory());
    const covered = new Set(cases.map(c => c[0]));
    for (const name of actions) {
      const src = readCode(`${USERS}/${name}/route.ts`);
      if (name === 'notes') continue;
      if (/requireSuperAdmin\(/.test(src)) continue;
      assert.ok(covered.has(name), `${name} is a support-gated user action without the staff check`);
    }
  });
});
