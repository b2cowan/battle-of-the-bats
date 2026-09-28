/**
 * A CANCELLED COACHES PORTAL — what the coach is told, and how long the team is kept.
 *
 * Found 2026-09-24, when Stripe's test-mode retention policy ended a 90-day-old test subscription
 * and the owner received the real cancellation email. Three defects, none visible in the happy path:
 *
 * 1. The name stuttered — "Your toronto blue jays5 Coaches Portal Coaches Portal has been
 *    cancelled". A standalone workspace org is always named "{team} Coaches Portal" and the copy
 *    says "Coaches Portal" itself; the senders passed the raw org name.
 * 2. Resubscribe opened the NEW-portal signup. The reactivation door ("Reactivate Premium without
 *    starting over") existed and the billing page used it; the email did not — so a coach who
 *    wanted their team back could buy a second, empty one.
 * 3. A Stripe-side end (card failed for good, cancel in Stripe's dashboard) recorded no retention
 *    at all: no deadline, no warning — while the email promised a "restore window".
 *
 * Owner ruling the same day: a Coaches Portal is kept for 365 days (a season cycle — coaches
 * cancel at season's end and return for next year's tryouts), warned 30 days out. Recorded in
 * docs/agents/strategy/BUSINESS_DECISIONS.md.
 *
 * ⚠ IT SCANS CODE. The email senders are two webhook/route branches nobody exercises by hand.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { teamWorkspaceReactivatePath } from '../../lib/coaches-portal-routes';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SENDERS = [
  'app/api/billing/cancel/confirm/route.ts',
  'app/api/billing/webhook/route.ts',
  // Review 2026-09-24: this door still sent the generic ORG email to a Coaches Portal owner.
  'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts',
];

test('the reactivation path names the workspace and the bare team name', () => {
  assert.equal(
    teamWorkspaceReactivatePath({ slug: 'toronto-blue-jays5-coaches-portal', name: 'toronto blue jays5 Coaches Portal' }),
    '/coaches/start?reactivateOrgSlug=toronto-blue-jays5-coaches-portal&teamName=toronto+blue+jays5',
  );
});

for (const rel of SENDERS) {
  test(`${rel}: the cancelled email uses the team name, the reactivation door, and a deadline`, () => {
    const src = read(rel);
    const at = src.indexOf("key: 'team_workspace_cancelled'");
    assert.ok(at > 0, 'the Coaches Portal cancellation email is sent here');
    const block = src.slice(Math.max(0, at - 1200), at + 800);
    assert.match(block, /teamWorkspaceDisplayName\(/, 'pass the team name, not the "{team} Coaches Portal" org name');
    assert.match(block, /teamWorkspaceReactivatePath\(/, 'Resubscribe must reactivate THIS workspace');
    assert.doesNotMatch(block, /\$\{SITE_URL\}\/coaches\/start`/, 'a bare /coaches/start is the new-portal signup');
    assert.match(block, /retentionUntil/, 'the email states the date the team is kept until');
  });
}

test('a Stripe-side end retains the workspace before emailing, and never double-emails', () => {
  const src = read('app/api/billing/webhook/route.ts');
  const retain = src.indexOf('applyCoachesPortalStripeRetention({');
  const send = src.indexOf("key: 'team_workspace_cancelled'");
  assert.ok(retain > 0 && retain < send, 'retention is applied before the email');
  assert.match(src.slice(retain, send), /if \(!retention\.applied/, 'skip the email when another door already retained it');

  // "Already retained" has no age window — a late re-send must not re-retain and quote a later date.
  const helper = read('lib/billing-retention.ts');
  const body = helper.slice(helper.indexOf('export async function applyCoachesPortalStripeRetention'));
  const check = body.slice(0, body.indexOf('if (existing)'));
  assert.match(check, /retentionReason', COACHES_PORTAL_RETENTION_REASON/);
  assert.doesNotMatch(check, /\.(gte|gt)\('retained_at'/, 'no age window on the already-retained check');
});

test('a Coaches Portal is kept 365 days and warned 30 days out; the cancel screen reads the same number', () => {
  const src = read('lib/billing-retention.ts');
  assert.match(src, /COACHES_PORTAL_RETENTION_DAYS = 365;/);
  assert.match(src, /COACHES_PORTAL_RETENTION_WARNING_DAYS = 30;/);
  const preflight = src.slice(src.indexOf('export async function buildCancellationPreflight'));
  const workspaceBranch = preflight.slice(0, preflight.indexOf('shutsDown'));
  assert.match(workspaceBranch, /retentionDays: COACHES_PORTAL_RETENTION_DAYS/);
});

test('every door that ends a Coaches Portal tags its records for reactivation', () => {
  for (const rel of [
    'app/api/billing/cancel/confirm/route.ts',
    'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts',
  ]) {
    assert.match(read(rel), /retentionDaysFor\(/, `${rel} picks the window by account kind`);
  }
  assert.match(
    read('app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts'),
    /COACHES_PORTAL_RETENTION_REASON/,
    'the platform-admin cancel tags a Coaches Portal so reactivation restores it',
  );
});
