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
 * Plans end at renewal (Stage 1, 2026-11-01): every door — the owner's, the platform admin's, Stripe ending it — now
 * reaches ONE ending (lib/plan-ending.ts), and its email is sent from ONE place (lib/plan-ending-server.ts). The three
 * promises above are pinned there, and the doors are held to sending none of their own.
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

const ENDING = 'lib/plan-ending.ts';
const SENDER = 'lib/plan-ending-server.ts';
const DOORS = [
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

test('the cancelled email uses the team name, the reactivation door, and a deadline — sent by the one ending only', () => {
  const src = read(SENDER);
  const at = src.indexOf("key: 'team_workspace_cancelled'");
  assert.ok(at > 0, 'the Coaches Portal cancellation email is sent here');
  const block = src.slice(Math.max(0, at - 1200), at + 800);
  assert.match(block, /teamWorkspaceDisplayName\(/, 'pass the team name, not the "{team} Coaches Portal" org name');
  assert.match(block, /teamWorkspaceReactivatePath\(/, 'Resubscribe must reactivate THIS workspace');
  assert.doesNotMatch(block, /\$\{SITE_URL\}\/coaches\/start`/, 'a bare /coaches/start is the new-portal signup');
  assert.match(block, /retentionUntil/, 'the email states the date the team is kept until');
  for (const rel of DOORS) assert.doesNotMatch(read(rel), /key: 'team_workspace_cancelled'/, `${rel} sends no email of its own`);
});

test('a Stripe-side end retains the workspace before emailing, and never double-emails', () => {
  const src = read(ENDING);
  const body = src.slice(src.indexOf('export async function applyEnding'));
  const retain = body.indexOf('await deps.insertRecords(');
  const send = body.indexOf('await deps.sendEndedEmail(');
  assert.ok(retain > 0 && retain < send, 'retention is recorded before the email');
  assert.match(body.slice(retain, send), /if \(notify && !endedEmailSentAt\)/, 'one email per ending, whatever replays');
  // An ending that already ran (a door ended it and sent its email) is not run again by the deletion that follows. No age
  // window either: the applied row is recognised by ITS subscription, so a late re-send finds it and quotes no later date.
  const deleted = src.slice(src.indexOf('export async function endingForDeletedSubscription'));
  assert.ok(deleted.indexOf("if (applied) return { kind: 'already'") > 0);
  assert.ok(deleted.indexOf("if (applied) return { kind: 'already'") < deleted.lastIndexOf('applyEnding('));
  assert.match(read('app/api/billing/webhook/route.ts'), /if \(account\) await endingForDeletedSubscription\(account, sub, endingDeps\);/);
});

test('a Coaches Portal is kept 365 days and warned 30 days out; the cancel screen reads the same number', () => {
  const src = read('lib/billing-retention.ts');
  assert.match(read('lib/billing-cancellation-policy.ts'), /COACHES_PORTAL_RETENTION_DAYS = 365;/);
  assert.match(src, /from '\.\/billing-cancellation-policy'/, 'preflight reads the shared retention policy');
  assert.match(src, /COACHES_PORTAL_RETENTION_WARNING_DAYS = 30;/);
  const preflight = src.slice(src.indexOf('export async function buildCancellationPreflight'));
  const workspaceBranch = preflight.slice(0, preflight.indexOf('shutsDown'));
  assert.match(workspaceBranch, /retentionDays: COACHES_PORTAL_RETENTION_DAYS/);
});

test('every door that ends a Coaches Portal tags its records for reactivation', () => {
  // The one ending picks the window by account kind and tags a Coaches Portal with the reason reactivation restores.
  assert.match(read(SENDER), /retentionDays: account => retentionDaysFor\(/);
  assert.match(read(ENDING), /\? 'coaches_portal_cancellation'/);
  assert.match(read('lib/billing-retention.ts'), /COACHES_PORTAL_RETENTION_REASON = 'coaches_portal_cancellation';/);
  for (const rel of DOORS) assert.match(read(rel), /readEndingAccount\(/, `${rel} ends through the one ending`);
});
