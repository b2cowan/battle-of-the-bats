/**
 * WHO A TOURNAMENT ANNOUNCEMENT EMAIL REACHES (Tournament admin redesign Stage 2, Part 0 — F42, A15).
 *
 * The composer said "All accepted teams · 18" and the send emailed every registered team (22 on the
 * test event: a rejected, a waitlisted and two pending teams besides the 18), while the email's record
 * listed only the accepted ones. The rule now lives in `lib/announcement-recipients.ts`, and:
 *
 *   1. With no targeting, only ACCEPTED teams are reached — never a rejected, waitlisted or pending one.
 *   2. The record IS the send's list: the route writes `email_recipients` from the same array it loops
 *      to send (a source read below — this repo unit-tests no live database).
 *   3. The free plan's cap counts that list, and choosing anything but the accepted teams is targeting
 *      (Tournament Plus).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  selectAnnouncementRecipients, usesAdvancedTargeting, readStoredRecipients,
  type RecipientTeamRow,
} from '../../lib/announcement-recipients';

const ROOT = join(import.meta.dirname, '..', '..');

const team = (id: string, status: string, extra: Partial<RecipientTeamRow> = {}): RecipientTeamRow => ({
  id, name: `${id} U11 Girls`, email: `${id}@example.test`, coach_email: null,
  status, payment_status: 'pending', division_id: 'u11', ...extra,
});

// The test event's shape: accepted teams, and one each of the three that must not be emailed.
const TEAMS: RecipientTeamRow[] = [
  team('falcons', 'accepted', { payment_status: 'paid' }),
  team('storm', 'accepted'),
  team('titans', 'waitlist'),
  team('blaze', 'pending'),
  team('freeze', 'rejected', { division_id: 'u15' }),
  team('cyclones', 'pending', { division_id: 'u15' }),
];

describe('an untargeted email reaches the accepted teams, and nobody else', () => {
  it('leaves out a rejected, a waitlisted and a pending team', () => {
    const list = selectAnnouncementRecipients(TEAMS, null);
    assert.deepEqual(list.map(r => r.email), ['falcons@example.test', 'storm@example.test']);
    for (const out of ['titans', 'blaze', 'freeze', 'cyclones']) {
      assert.ok(!list.some(r => r.email.startsWith(out)), `${out} must not be emailed`);
    }
  });

  it('treats targeting that names no status the same way (the default is the accepted teams)', () => {
    assert.deepEqual(selectAnnouncementRecipients(TEAMS, {}), selectAnnouncementRecipients(TEAMS, null));
    assert.deepEqual(selectAnnouncementRecipients(TEAMS, { teamStatuses: [] }), selectAnnouncementRecipients(TEAMS, null));
  });

  it('names the team each address stood for, and folds a shared address into one email', () => {
    const shared = [
      team('a', 'accepted', { coach_email: 'Coach@Example.test' }),
      team('b', 'accepted', { coach_email: 'coach@example.test' }),
    ];
    const list = selectAnnouncementRecipients(shared, null);
    assert.equal(list.length, 1);
    assert.equal(list[0].email, 'coach@example.test');
    assert.deepEqual(list[0].teams.map(t => t.id), ['a', 'b']);
  });

  it('skips a team with no address rather than recording a blank recipient', () => {
    const list = selectAnnouncementRecipients([team('x', 'accepted', { email: null })], null);
    assert.deepEqual(list, []);
  });
});

describe('choosing who: statuses, payment and division are the targeting the send already had', () => {
  it('reaches exactly the chosen statuses', () => {
    const list = selectAnnouncementRecipients(TEAMS, { teamStatuses: ['waitlist', 'pending'] });
    assert.deepEqual(list.map(r => r.teams[0].id).sort(), ['blaze', 'cyclones', 'titans']);
  });

  it('narrows by payment and division', () => {
    assert.deepEqual(selectAnnouncementRecipients(TEAMS, { paymentStatuses: ['pending'] }).map(r => r.teams[0].id), ['storm']);
    assert.deepEqual(selectAnnouncementRecipients(TEAMS, { teamStatuses: ['pending'], divisionIds: ['u15'] }).map(r => r.teams[0].id), ['cyclones']);
  });

  it('choosing anything but the accepted teams is targeting (Tournament Plus); the default is not', () => {
    assert.equal(usesAdvancedTargeting(null), false);
    assert.equal(usesAdvancedTargeting({}), false);
    assert.equal(usesAdvancedTargeting({ teamStatuses: ['accepted'] }), false);
    // Before F42 "every status" counted as the basic send; now it reaches teams the basic send never does.
    assert.equal(usesAdvancedTargeting({ teamStatuses: ['accepted', 'pending', 'waitlist', 'rejected'] }), true);
    assert.equal(usesAdvancedTargeting({ teamStatuses: ['waitlist'] }), true);
    assert.equal(usesAdvancedTargeting({ divisionIds: ['u11'] }), true);
    assert.equal(usesAdvancedTargeting({ paymentStatuses: ['pending'] }), true);
  });
});

describe('the record is the send\'s list', () => {
  const route = readFileSync(join(ROOT, 'app/api/admin/communications/route.ts'), 'utf8');

  it('resolves recipients through the one rule, nowhere else', () => {
    assert.match(route, /selectAnnouncementRecipients\(/);
    assert.doesNotMatch(route, /recipientMap|teamStatuses\.has\(/, 'a second copy of the rule is in the route');
  });

  it('sends to the list it writes down', () => {
    const send = route.slice(route.indexOf('recipients = await resolveRecipients('));
    assert.ok(send.length > 0);
    assert.match(send, /for \(const \{ email \} of recipients\)/, 'the send loops the resolved list');
    assert.match(send, /email_recipients:\s+recipients,/, 'the record is written from the same list');
    assert.match(send, /email_recipient_count:\s+recipients\.length,/);
  });

  it('caps the free plan on the same list', () => {
    assert.match(route, /const freeRecipients = await resolveRecipients\(data\.tournamentId, targeting\);/);
  });

  it('reads the stored list back, and says "not kept" (null) for anything that is not one', () => {
    assert.equal(readStoredRecipients(null), null);
    assert.equal(readStoredRecipients('x'), null);
    assert.deepEqual(readStoredRecipients([{ email: 'a@b.c', teams: [{ id: 't', name: 'T' }] }, { nope: 1 }]),
      [{ email: 'a@b.c', teams: [{ id: 't', name: 'T' }] }]);
  });
});
