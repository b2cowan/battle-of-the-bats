/**
 * Free time, the same rules for clubs and coaches (owner rulings 2026-11-19, ask A; build go 2026-11-20, all three kinds):
 * a club whose free time has an end date is emailed 14 days and 3 days before its last free day, every active owner, once
 * each per end — the coach's reminder (support-console-stage4b-ending-reminders.test.ts), for a club. A grant with no end
 * date never is. The words never name a price, never threaten loss, never say "cancel".
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { clubEndingEmailWords, clubEndingReminderDue } from '../../lib/club-free-time-reminders-words';
import { foldGrants } from '../../lib/free-time';

const NONE = { at14: null, at3: null };

describe('which reminder a club grant is due (the coach rule)', () => {
  it('nothing more than 14 days out; the 14-day one inside 14; the 3-day one inside 3; never both', () => {
    assert.equal(clubEndingReminderDue(15, '2027-09-30', NONE), null);
    assert.equal(clubEndingReminderDue(14, '2027-09-30', NONE), 14);
    assert.equal(clubEndingReminderDue(9, '2027-09-30', { at14: '2027-09-30', at3: null }), null);
    assert.equal(clubEndingReminderDue(3, '2027-09-30', { at14: '2027-09-30', at3: null }), 3);
    assert.equal(clubEndingReminderDue(2, '2027-09-30', NONE), 3);
    assert.equal(clubEndingReminderDue(2, '2027-09-30', { at14: null, at3: '2027-09-30' }), null);
  });
  it('an end moved by staff re-arms both', () => {
    const told = { at14: '2027-09-30', at3: '2027-09-30' };
    assert.equal(clubEndingReminderDue(10, '2027-10-31', told), 14);
    assert.equal(clubEndingReminderDue(2, '2027-10-31', told), 3);
  });
});

const plan = (over: Partial<Parameters<typeof clubEndingEmailWords>[0] & { kind: 'plan_tier' }> = {}) => clubEndingEmailWords({
  kind: 'plan_tier', clubName: 'Riverside', plan: 'tournament_plus', ownPlan: 'tournament', lastDay: '2027-09-30', daysLeft: 14,
  givenOnSale: true, overLimitAfter: false, ...over,
} as Parameters<typeof clubEndingEmailWords>[0]);

describe('the words', () => {
  it('a whole plan (the two former Founding clubs)', () => {
    const w = plan();
    assert.equal(w.subject, 'Your free time on Tournament Plus has 14 days left');
    assert.equal(w.lead, 'Riverside’s free time on Tournament Plus has 14 days left. It runs through September 30, 2027.');
    assert.equal(w.body, 'On October 1 Riverside goes back to the free Tournament plan automatically. Nothing is charged, and nothing you made is deleted. The tools that come only with Tournament Plus close then. To keep Tournament Plus, contact us.');
    assert.equal(w.button, 'Open Plan & billing');
  });
  it('a plan not on sale, and one over the free limit', () => {
    assert.match(plan({ givenOnSale: false }).body, /Tournament Plus isn't open for sign-up yet, so there is nothing to choose\.$/);
    assert.match(plan({ overLimitAfter: true }).body, /Your tournaments are kept; you can start a new one once you're back within the free plan\.$/);
  });
  it('sections, one and two', () => {
    const one = clubEndingEmailWords({ kind: 'module_addon', clubName: 'Riverside', sections: ['House League'], lastDay: '2027-09-30', daysLeft: 14 });
    assert.equal(one.subject, 'Your free time on House League has 14 days left');
    assert.equal(one.body, 'On October 1 House League turns off automatically. Nothing is charged, and nothing you made in it is deleted. To keep it, contact us.');
    const two = clubEndingEmailWords({ kind: 'module_addon', clubName: 'Riverside', sections: ['House League', 'Accounting'], lastDay: '2027-09-30', daysLeft: 3 });
    assert.match(two.subject, /House League and Accounting has 3 days left/);
    assert.match(two.body, /turn off automatically.*in them.*keep them/);
  });
  it('a billing status that reopened an ended club, and one on an unpaid club', () => {
    const reopened = clubEndingEmailWords({ kind: 'subscription_status', clubName: 'Riverside', lastDay: '2027-09-30', daysLeft: 14, reopenedEndedClub: true });
    assert.equal(reopened.subject, 'Your free time on FieldLogicHQ has 14 days left');
    assert.equal(reopened.lead, 'The free time FieldLogicHQ gave Riverside has 14 days left. It runs through September 30, 2027.');
    assert.equal(reopened.body, "On October 1, if Riverside hasn't chosen a plan, it closes again. Its information is kept for 90 days from that day, and you'll get an email with the date. Nothing is charged.");
    assert.equal(reopened.button, 'Open Plan & billing');
    const other = clubEndingEmailWords({ kind: 'subscription_status', clubName: 'Riverside', lastDay: '2027-09-30', daysLeft: 14, reopenedEndedClub: false });
    assert.equal(other.body, 'On October 1 Riverside’s billing goes back to how it was before the free time. Nothing is charged for the free time.');
    assert.equal(other.button, 'Open Plan & billing');
  });
  it('one day left and the last day read as words', () => {
    assert.equal(plan({ daysLeft: 1 }).subject, 'Your free time on Tournament Plus has 1 day left');
    assert.equal(plan({ daysLeft: 0 }).subject, 'Your free time on Tournament Plus ends today');
  });
  it('never a price, a threat of loss, "cancel" or "ends on", at any day count, for any kind', () => {
    for (const n of [14, 9, 3, 1, 0]) {
      const all = [
        plan({ daysLeft: n }), plan({ daysLeft: n, givenOnSale: false, overLimitAfter: true, ownPlan: 'tournament_plus', plan: 'club' }),
        clubEndingEmailWords({ kind: 'module_addon', clubName: 'R', sections: ['Accounting'], lastDay: '2027-09-30', daysLeft: n }),
        clubEndingEmailWords({ kind: 'subscription_status', clubName: 'R', lastDay: '2027-09-30', daysLeft: n, reopenedEndedClub: true }),
        clubEndingEmailWords({ kind: 'subscription_status', clubName: 'R', lastDay: '2027-09-30', daysLeft: n, reopenedEndedClub: false }),
      ].map(w => `${w.subject} ${w.lead} ${w.body}`).join(' ');
      // /legal 2026-11-20: "not a CEM" holds only while the email carries no price, offer or outside link.
      assert.doesNotMatch(all, /\$|price|\blose\b|\blost\b|cancel|ends on|discount|\boffer|%|https?:/i, `${n} days`);
    }
  });
});

describe('the wiring', () => {
  const job = readCode('lib/club-free-time-reminders.ts');
  const route = readCode('app/api/platform-admin/portal-free-time-daily/route.ts');

  it('claimed with a conditional update BEFORE it is sent, refused if the grant ended or moved, given back only if nothing went', () => {
    const claimAt = job.indexOf('.update(Object.fromEntries(columns.map(c => [c, lastDay])))');
    assert.ok(claimAt > -1 && claimAt < job.indexOf('await sendEmail('), 'claim first');
    assert.match(job, /\.is\('revoked_at', null\)[^\n]*\n\s*\.eq\('expires_at', g\.expires_at\)/);
    assert.match(job, /\.or\(`\$\{stampColumn\}\.is\.null,\$\{stampColumn\}\.neq\.\$\{lastDay\}`\)/);
    assert.match(job, /\.eq\(stampColumn, lastDay\)/); // the release undoes only our own stamp
    assert.match(job, /if \(!allDefinitelyUnsent\) continue;/);
  });
  it('the 3-day reminder also stamps the 14-day one', () => {
    assert.match(job, /wave === 3 \? STAMPS : \(\['ending_reminded_14_for'\] as const\)/);
  });
  it('every active owner, its own logged kind, a grant with an end date only, never a portal, a suspended club or switched-off grants', () => {
    assert.match(job, /orgOwnerEmails\(org\.id\)/);
    assert.match(job, /kind: 'club_free_time_ending'/);
    assert.match(job, /\.not\('expires_at', 'is', null\)/);
    assert.match(job, /isTeamWorkspaceOrg\(/);
    assert.match(job, /billing_suspended_at\) continue/);
    assert.match(job, /if \(!grantsEnabled\(\)\) return/);
    assert.match(readCode('lib/email-kinds.ts'), /club_free_time_ending:\s+\{ klass: 'account'/);
  });
  it('only when something changes at the end, judged from ALL the club\'s grants the way the door folds them (/review 2026-11-20)', () => {
    // One fold the moment before the end, one the moment after: an overlapping grant that keeps a thing on means no email.
    assert.match(job, /before: foldGrants\(own, rows, new Date\(at\.getTime\(\) - 1\)\), after: foldGrants\(own, rows, at\)/);
    assert.match(job, /before\.planId !== plan \|\| after\.planId === plan/);
    assert.match(job, /holdsSection\(before, a\) && !holdsSection\(after, a\)/);
    assert.match(job, /if \(before\.subscriptionStatus === after\.subscriptionStatus\) return null/);
    assert.match(job, /if \(ending\.length === 0\) return null/);
  });
  it('the fold it relies on: a section a running plan grant also carries stays on when the section grant ends', () => {
    const own = { planId: 'tournament' as const, subscriptionStatus: 'active' as const, enabledAddons: [], storedTournamentLimit: null, storedTeamLimit: null };
    const rows = [
      { type: 'module_addon', value: null, target: { addons: ['module_accounting'] }, starts_at: null, expires_at: '2026-12-02T05:00:00.000Z', revoked_at: null },
      { type: 'plan_tier', value: null, target: { plan: 'club' }, starts_at: null, expires_at: '2027-01-01T05:00:00.000Z', revoked_at: null },
    ];
    const after = foldGrants(own, rows, new Date('2026-12-02T05:00:00.000Z'));
    assert.equal(after.planId, 'club'); // the plan grant still runs, and Club carries Accounting: nothing turns off
  });
  it('a claim that fails is a failure, and the email is built before the claim', () => {
    assert.match(job, /if \(claimError\) throw claimError;/);
    assert.ok(job.indexOf('const words = clubEndingEmailWords(input);') < job.indexOf(".from('org_overrides')\n        .update("), 'words before the claim');
  });
  it('never imports a cancel, an ending or retention function', () => {
    assert.doesNotMatch(job.replace(/\/\*\*[\s\S]*?\*\//g, ''), /from '\.\/(plan-ending|billing-cancel|billing-retention)/);
  });
  it('the daily route runs it as its own step, and the stamps are two nullable date columns', () => {
    assert.match(route, /run\('club_free_time_reminders'/);
    assert.match(route, /sendClubFreeTimeReminders\(now\)/);
    const cols = readCode('supabase/migrations/512_a_club_free_time_grant_remembers_its_ending_reminders.sql');
    assert.match(cols, /ending_reminded_14_for date/);
    assert.match(cols, /ending_reminded_3_for date/);
  });
  it("the staff windows say the owner is emailed where an email will go", () => {
    const win = readCode('app/platform-admin/orgs/[id]/FreeTimeWindows.tsx');
    assert.match(win, /The owner is emailed 14 days and 3 days before it runs out\./);
    assert.match(win, /The owner is emailed 14 days and 3 days before the new last day\./);
  });
});
