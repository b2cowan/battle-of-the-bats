import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Board Ready leftover fixes, second half (owner rulings 2026-11-19, queue P8b): source guards for the rules the dev
// proofs exercised (.probe/accept-invite-choose-prove.mjs, staff-removal-prove.mjs, program-year-coaches-emails-prove.mjs).
const read = (p: string) => readFileSync(p, 'utf8');

describe('call 12 — two invitations and no club named: ask, never pick', () => {
  const src = read('app/api/auth/accept-invite/route.ts');
  test('the GET and the POST decide on the one helper', () => {
    assert.equal(src.match(/await liveInvitationClubs\(user\.id\)/g)?.length, 2);
    assert.match(src, /\.eq\('status', 'invited'\)\s*\.gte\('invited_at', invitationLapseCutoff\(\)\)/);
  });
  test('the POST asks BEFORE the Terms agreement or the name is recorded', () => {
    const post = src.slice(src.indexOf('export const POST'));
    const ask = post.indexOf('liveInvitationClubs(user.id)');
    assert.ok(ask > 0 && ask < post.indexOf('checkAcceptance(user)') && ask < post.indexOf('updateUserById'));
    assert.match(post, /code: CHOOSE_CLUB, clubs \},\s*\{ status: 409 \}/);
  });
  test('the page asks the question and joins only the chosen club', () => {
    const page = read('app/(consumer)/auth/accept-invite/AcceptInviteForm.tsx');
    assert.match(page, /title="Which club are you joining\?"/);
    assert.match(page, /data\?\.code === 'choose_club'/);
    assert.match(page, /orgSlug: slug/);
  });
});

describe('call 4 — staff removal reads first, refuses whole, keeps a sign-in in use', () => {
  const src = read('app/api/platform-admin/company-users/[id]/route.ts');
  const del = src.slice(src.indexOf('export const DELETE'));
  test('the paged lookup and the shared keep test, never the unpaged account list', () => {
    assert.doesNotMatch(src, /listUsers/);
    assert.match(del, /findAuthUserIdByEmail\(target\.email\)/);
    assert.match(del, /readAccountKeepFacts\(authUserId, null\)/);
  });
  test('every read and the sign-in delete come before the staff row goes', () => {
    const at = (s: string) => del.indexOf(s);
    assert.ok(at("code: 'lookup_failed'") < at('auth.admin.deleteUser(authUserId)'));
    assert.ok(at("code: 'delete_failed'") < at('await deletePlatformUser(id)'));
    assert.ok(at('auth.admin.deleteUser(authUserId)') < at('await deletePlatformUser(id)'));
  });
  test('the keep test with no club counts every club seat and reads no club row', () => {
    const keep = read('lib/member-account-keep-server.ts');
    assert.match(keep, /orgId === null \? seats : seats\.neq\('organization_id', orgId\)/);
    assert.match(keep, /orgId === null\s*\? Promise\.resolve\(\{ data: null, error: null \}\)/);
  });
});

describe('call 9 — the program-year coaches list reads emails the Members screen’s way', () => {
  test('one read of just these people; a failed read refuses, and the page says so', () => {
    const src = read('app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/route.ts');
    assert.doesNotMatch(src, /listUsers/);
    assert.match(src, /peopleSignInFacts\(userIds\)/);
    const page = read('app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx');
    assert.match(page, /if \(!coachesRes\.ok\) throw new Error/);
  });
});
