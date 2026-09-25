/**
 * tests/unit/notification-reader.test.ts
 *
 * The coach notification reader's two words (owner ruling 2026-09-25, D3 option B —
 * COACH_NOTIFICATIONS_ONE_ROW_PLAN): the button that takes the coach on names the page they will
 * land on, in the nav's own words, and the date line always names the day and the clock.
 *
 * The links below are the shapes the senders actually write (weekly digest → Insights, a schedule
 * change → Schedule, a practice plan sent → that practice, a chat message → Chat, the admin links
 * the parked recipient-scoping bug hands a coach).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { notificationDestination, notificationStamp } from '../../lib/notification-view';

describe('the reader names where its button goes', () => {
  it('names a team page in the nav’s own words', () => {
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127/history'), 'Open Insights');
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127/schedule'), 'Open Schedule');
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127/settings'), 'Open Settings');
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127/development'), 'Open Skills & Goals');
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127'), 'Open Overview');
  });

  it('names ONE practice when the link opens one, and the hub when it does not', () => {
    assert.equal(notificationDestination('/o/coaches/teams/t/practice/e-1'), 'Open the practice plan');
    assert.equal(notificationDestination('/o/coaches/teams/t/practice'), 'Open Practice plans');
  });

  it('never calls a practice LIBRARY "the practice plan"', () => {
    assert.equal(notificationDestination('/o/coaches/teams/t/practice/templates'), 'Open Practice plans');
    assert.equal(notificationDestination('/o/coaches/teams/t/practice/templates/tpl-1'), 'Open Practice plans');
    assert.equal(notificationDestination('/o/coaches/teams/t/practice/circuits/c-1'), 'Open Practice plans');
  });

  it('reads the path, not the query or the fragment', () => {
    assert.equal(notificationDestination('/o/coaches/teams/t/history?section=scouting#top'), 'Open Insights');
    assert.equal(notificationDestination('/chat?room=abc'), 'Open Chat');
  });

  it('says plainly when a link opens the admin', () => {
    assert.equal(notificationDestination('/o/admin/tournaments/registrations?tournamentId=x'), 'Open in admin');
  });

  it('never guesses a name — an unknown place still gets a working button', () => {
    assert.equal(notificationDestination('/o/some-tournament'), 'Open');
    assert.equal(notificationDestination('/o/coaches/teams/t/something-new'), 'Open');
  });

  it('offers no button at all when there is nowhere to go', () => {
    assert.equal(notificationDestination(null), null);
    assert.equal(notificationDestination(''), null);
  });
});

describe('the reader’s date line', () => {
  it('names the day and the clock, in the house spelling', () => {
    const stamp = notificationStamp(new Date(2026, 8, 20, 19, 0).toISOString());
    assert.match(stamp, /^Sun, Sep\.? 20 · 7:00 p\.m\.$/);
  });
});
