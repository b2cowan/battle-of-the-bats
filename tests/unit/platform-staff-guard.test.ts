/**
 * A SUPPORT OR BILLING ACTION IS FOR CUSTOMERS' ACCOUNTS (security fix, 2026-10-16; the second sweep's second finding).
 * The person actions sit behind `person_support` (support; billing lost it, Stage 2 A1) and took any account; a platform role
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
  // Support console Stage 2: every action goes through ONE front door (`personActionContext`), which reads the person by
  // account number and refuses a staff account — or any email the action would set — before the route does anything.
  it('the front door refuses a staff target, naming the account\'s own email and any email the action would set', () => {
    const door = readCode('lib/platform-person-action.ts');
    assert.match(door, /staffTargetRefusal\(auth\.role, \{ userId: id, emails: \[found\.person\.email, \.\.\.emailsFrom\(body\)\] \}\)/);
    assert.ok(at(door, 'if (staffRefused) return') < at(door, 'return { action: { auth'), 'the refusal comes before the action is handed out');
  });
  const cases: Array<[string, string]> = [
    ['update', 'supabaseAdmin.auth.admin.updateUserById('],
    ['ban', 'supabaseAdmin.auth.admin.updateUserById('],
    ['revoke-sessions', 'await fetch('],
    ['confirm-email', 'supabaseAdmin.auth.admin.updateUserById('],
    ['reset', 'supabaseAdmin.auth.admin.generateLink('],
  ];
  for (const [name, act] of cases) {
    it(name, () => {
      const src = readCode(`${USERS}/${name}/route.ts`);
      assert.match(src, /await personActionContext(<[^>]*>)?\(req, id/);
      assert.ok(at(src, 'if (ctx.response) return ctx.response;') < at(src, act), `${name} goes through the front door before it acts`);
    });
  }
  it('update names the new email to the staff refusal too', () => {
    assert.match(readCode(`${USERS}/update/route.ts`), /personActionContext<[^>]*>\(req, id, body => \[cleanEmail\(body\.email\)\]\)/);
  });

  it('every support-gated action on a user is in that list (notes are harmless; delete is super-admin only)', () => {
    const actions = readdirSync(USERS).filter(n => statSync(`${USERS}/${n}`).isDirectory());
    const covered = new Set(cases.map(c => c[0]));
    for (const name of actions) {
      const src = readCode(`${USERS}/${name}/route.ts`);
      if (name === 'notes') continue;
      if (/requirePlatformPower\('delete_records'\)/.test(src)) continue;
      assert.ok(covered.has(name), `${name} is a support-gated user action without the staff check`);
    }
  });
});
