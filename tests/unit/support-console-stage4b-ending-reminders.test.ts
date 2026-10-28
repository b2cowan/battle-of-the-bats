/**
 * Support console Stage 4b · the ending of staff-given free time is told BEFORE it happens (owner 2026-10-28, "go with b";
 * this reverses Q7's "in the product only, no email"). Two doors: the Premium Overview's band for the last 14 days, and
 * two emails (14 days and 3 days before) from a daily job. The words never threaten loss (nothing is deleted), never name a
 * price, and say "runs through" the last free day.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  portalEndingEmailWords, portalEndingOverviewBand, portalEndingReminderDue,
} from '../../lib/portal-free-time';

const NONE = { at14: null, at3: null };

describe('which reminder a portal is due', () => {
  it('nothing more than 14 days out', () => {
    assert.equal(portalEndingReminderDue(15, '2026-12-26', NONE), null);
  });
  it('the 14-day one inside 14 days, once per end', () => {
    assert.equal(portalEndingReminderDue(14, '2026-12-26', NONE), 14);
    assert.equal(portalEndingReminderDue(9, '2026-12-26', NONE), 14);
    assert.equal(portalEndingReminderDue(9, '2026-12-26', { at14: '2026-12-26', at3: null }), null);
  });
  it('the 3-day one inside 3 days, once per end', () => {
    assert.equal(portalEndingReminderDue(3, '2026-12-26', { at14: '2026-12-26', at3: null }), 3);
    assert.equal(portalEndingReminderDue(0, '2026-12-26', { at14: '2026-12-26', at3: null }), 3);
    assert.equal(portalEndingReminderDue(2, '2026-12-26', { at14: '2026-12-26', at3: '2026-12-26' }), null);
  });
  it('a job that was down sends the later one only, never both on one day', () => {
    assert.equal(portalEndingReminderDue(2, '2026-12-26', NONE), 3);
    // and once the 3-day one is stamped, the 14-day one can never follow it
    assert.equal(portalEndingReminderDue(2, '2026-12-26', { at14: null, at3: '2026-12-26' }), null);
  });
  it('an end moved by staff re-arms both', () => {
    const told = { at14: '2026-12-26', at3: '2026-12-26' };
    assert.equal(portalEndingReminderDue(10, '2027-01-16', told), 14);
    assert.equal(portalEndingReminderDue(2, '2027-01-16', told), 3);
  });
});

describe('the words', () => {
  it('the email: the last free day, what happens after, nothing deleted, Keep Premium', () => {
    const w = portalEndingEmailWords('2026-12-26', 9);
    assert.equal(w.subject, 'Your Premium free time has 9 days left');
    assert.match(w.lead, /runs through December 26, 2026/);
    assert.match(w.body, /free Coaches Portal automatically/);
    assert.match(w.body, /nothing you made is deleted/i);
    assert.equal(w.button, 'Keep Premium');
  });
  it('one day left and the last day read as words, not "0 days"', () => {
    assert.equal(portalEndingEmailWords('2026-12-26', 1).subject, 'Your Premium free time has 1 day left');
    assert.equal(portalEndingEmailWords('2026-12-26', 0).subject, 'Your Premium free time ends today');
  });
  it('never a price, a threat of loss, "cancelled" or "ends on"', () => {
    for (const n of [14, 9, 3, 1, 0]) {
      const w = portalEndingEmailWords('2026-12-26', n);
      const all = `${w.subject} ${w.lead} ${w.body}`;
      assert.doesNotMatch(all, /\$|price|lose|lost|cancel|reactivate|ends on/i, `${n} days`);
    }
  });
  it('the Overview band is for the last 14 days only, and does not point "below"', () => {
    assert.equal(portalEndingOverviewBand(null), null);
    assert.equal(portalEndingOverviewBand({ state: 'running', lastDay: '2026-12-26', daysLeft: 40 }), null);
    assert.equal(portalEndingOverviewBand({ state: 'ended', lastDay: '2026-12-26' }), null);
    const band = portalEndingOverviewBand({ state: 'ending', lastDay: '2026-12-26', daysLeft: 9 });
    assert.equal(band?.tone, 'amber');
    assert.equal(band?.eyebrow, 'Free time · 9 days left');
    assert.doesNotMatch(band?.text ?? '', /below/);
    assert.match(band?.text ?? '', /everything you made on Premium is saved/);
  });
});

describe('the wiring', () => {
  const job = readCode('lib/portal-free-time-reminders.ts');
  const route = readCode('app/api/platform-admin/portal-free-time-daily/route.ts');

  it('a reminder is claimed with a conditional update BEFORE it is sent, and given back if nothing went out', () => {
    const claimAt = job.indexOf('.update(Object.fromEntries(columns.map(c => [c, ft.lastDay])))');
    assert.ok(claimAt > -1 && claimAt < job.indexOf('await sendEmail('), 'claim first');
    assert.match(job, /\.eq\('billing_mode', 'platform_override'\)\s*\.or\(/); // the claim itself is refused once the coach chose Premium
    assert.match(job, /\.or\(`\$\{stampColumn\}\.is\.null,\$\{stampColumn\}\.neq\.\$\{ft\.lastDay\}`\)/);
    assert.match(job, /result\?\.status === 'sent'/);
    assert.match(job, /\.catch\(\(e: unknown\)/); // a send that throws is "nothing went out" too, so the stamp is given back
    assert.match(job, /\.eq\(stampColumn, ft\.lastDay\)/); // the release undoes only our own stamp
  });
  it('the 3-day reminder also stamps the 14-day one', () => {
    assert.match(job, /wave === 3 \? \['free_time_reminded_3_for', 'free_time_reminded_14_for'\] as const : \['free_time_reminded_14_for'\] as const/);
    assert.match(job, /\.update\(Object\.fromEntries\(columns\.map\(c => \[c, ft\.lastDay\]\)\)\)/);
  });
  it('only a portal still billed by nobody, only its owner, never a demo coach, and only the ending state', () => {
    assert.match(job, /\.eq\('billing_mode', 'platform_override'\)/);
    assert.match(job, /primary_owner_user_id/);
    assert.match(job, /isDemoOrganizerEmail/);
    assert.match(job, /ft\.state === 'ended'/); // running (14 days left) and ending are read; an ended one never sends
  });
  it('is a logged account email of its own kind, and never imports a cancel or retention function (T15)', () => {
    assert.match(job, /kind: 'portal_free_time_ending'/);
    assert.doesNotMatch(job, /cancel|retention/i);
  });
  it('the route takes the scheduler secret or run_jobs, and writes one audit row', () => {
    assert.match(route, /isCronRequest\(req\)/);
    assert.match(route, /requirePlatformPower\('run_jobs'\)/);
    assert.match(route, /writePlatformAuditLog\(actor, null, 'portal_free_time_sweep'/);
  });
  it('the schedule calls that route and has a manual prod step; the stamps are two nullable date columns', () => {
    const cron = readCode('supabase/migrations/408_the_portal_free_time_daily_job_is_scheduled.sql');
    assert.match(cron, /portal-free-time-daily/);
    assert.match(cron, /\/api\/platform-admin\/portal-free-time-daily/);
    assert.match(readCode('supabase/migrations/MANUAL_PROD_STEPS.json'), /"408_the_portal_free_time_daily_job_is_scheduled\.sql"/);
    const cols = readCode('supabase/migrations/407_a_portal_remembers_which_free_time_reminders_it_sent.sql');
    assert.match(cols, /free_time_reminded_14_for date/);
    assert.match(cols, /free_time_reminded_3_for date/);
  });
  it('the Overview band mounts only on a Coaches Portal, and its button is outlined (the page keeps its one lime)', () => {
    const page = readCode('app/[orgSlug]/coaches/teams/[teamId]/page.tsx');
    assert.match(page, /currentOrg\?\.accountKind === 'team_workspace' && !isClosedTeam && \(\s*<PortalFreeTimeEndingBand/);
    const band = readCode('components/admin/FreeTimeBand.tsx');
    assert.match(band, /btn btn-outline btn-sm/);
    assert.doesNotMatch(band, /btn-lime/);
    const mount = readCode('components/coaches/PortalFreeTimeEndingBand.tsx');
    assert.match(mount, /canKeep \? \{ label: 'Keep Premium'/);
  });
});
