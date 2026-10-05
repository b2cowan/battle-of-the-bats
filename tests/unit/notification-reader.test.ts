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
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127/history', 'coach'), 'Open Insights');
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127/schedule', 'coach'), 'Open Schedule');
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127/settings', 'coach'), 'Open Settings');
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127/development', 'coach'), 'Open Skills & Goals');
    assert.equal(notificationDestination('/uat-test-org/coaches/teams/3127', 'coach'), 'Open Overview');
  });

  it('names ONE practice when the link opens one, and the hub when it does not', () => {
    assert.equal(notificationDestination('/o/coaches/teams/t/practice/e-1', 'coach'), 'Open the practice plan');
    assert.equal(notificationDestination('/o/coaches/teams/t/practice', 'coach'), 'Open Practice plans');
  });

  it('never calls a practice LIBRARY "the practice plan"', () => {
    assert.equal(notificationDestination('/o/coaches/teams/t/practice/templates', 'coach'), 'Open Practice plans');
    assert.equal(notificationDestination('/o/coaches/teams/t/practice/templates/tpl-1', 'coach'), 'Open Practice plans');
    assert.equal(notificationDestination('/o/coaches/teams/t/practice/circuits/c-1', 'coach'), 'Open Practice plans');
  });

  it('reads the path, not the query or the fragment', () => {
    assert.equal(notificationDestination('/o/coaches/teams/t/history?section=scouting#top', 'coach'), 'Open Insights');
    assert.equal(notificationDestination('/chat?room=abc', 'coach'), 'Open Chat');
  });

  it('says plainly when a link opens the admin — to a COACH (the parked recipient-scoping bug)', () => {
    assert.equal(notificationDestination('/o/admin/tournaments/registrations?tournamentId=x', 'coach'), 'Open in admin');
    assert.equal(notificationDestination('/o/admin/accounting/payment-requests?request=r-1', 'coach'), 'Open in admin');
  });

  it('never guesses a name — an unknown place still gets a working button', () => {
    assert.equal(notificationDestination('/o/some-tournament', 'coach'), 'Open');
    assert.equal(notificationDestination('/o/coaches/teams/t/something-new', 'coach'), 'Open');
  });

  it('offers no button at all when there is nowhere to go', () => {
    assert.equal(notificationDestination(null, 'coach'), null);
    assert.equal(notificationDestination('', 'coach'), null);
  });
});

/**
 * Notifications Open in Place, step 1 (owner ruling 2026-10-05, D4): in the ADMIN, the button names
 * the page in that screen's own words and lands on the record. Every link below is a shape a sender
 * writes today (grep `link:` in the `notify()` callers); none may fall to a bare "Open" or to "Open
 * in admin", which tells someone already in the admin nothing.
 */
describe('in the admin, the button names the club’s page and lands on the record', () => {
  const admin = (link: string) => notificationDestination(link, 'admin');

  it('names the RECORD when the link opens one', () => {
    assert.equal(admin('/o/admin/accounting/payment-requests?request=r-1'), 'Open the request');
    assert.equal(admin('/o/admin/accounting/allocations/a-1?bill=s-1'), 'Open the bill');
    // Results with `?gameId=` opens that game's score editor (owner, 2026-10-05, Q3).
    assert.equal(admin('/o/admin/tournaments/results?tournamentId=t&gameId=g'), 'Open the game');
    assert.equal(admin('/o/admin/rep-teams/teams/rt-1'), 'Open the team');
    assert.equal(admin('/o/admin/rep-teams/teams/rt-1/coaches'), 'Open the team’s coaches');
  });

  it('names the PAGE when the link opens a list', () => {
    assert.equal(admin('/o/admin/accounting/payment-requests'), 'Open Payment requests');
    assert.equal(admin('/o/admin/accounting/allocations/a-1'), 'Open the allocation');
    assert.equal(admin('/o/admin/tournaments/results?tournamentId=t'), 'Open Results');
    assert.equal(admin('/o/admin/tournaments/check-in'), 'Open Check-in');
    assert.equal(admin('/o/admin/org/billing'), 'Open Plan & billing');
    assert.equal(admin('/o/admin/rep-teams'), 'Open Rep Teams');
    assert.equal(admin('/o/admin/rep-teams/bring-in'), 'Open Bring in a coach’s team');
  });

  it('calls a tournament’s registrations page TEAMS and a house league’s Registrations (owner, Q2)', () => {
    assert.equal(admin('/o/admin/tournaments/registrations?tournamentId=t'), 'Open Teams');
    assert.equal(admin('/o/admin/house-league/seasons/s-1/registrations'), 'Open Registrations');
  });

  it('an empty record id is the list, not a record', () => {
    assert.equal(admin('/o/admin/accounting/payment-requests?request='), 'Open Payment requests');
  });

  it('never guesses — an admin page not named here gets a working "Open"', () => {
    assert.equal(admin('/o/admin/some-new-page'), 'Open');
    assert.equal(admin('/o/admin'), 'Open');
  });

  it('keeps the coach portal’s names for coach links, whoever reads them', () => {
    assert.equal(admin('/o/coaches/teams/t/history'), 'Open Insights');
    assert.equal(admin('/chat?room=abc'), 'Open Chat');
  });
});

describe('the reader’s date line', () => {
  it('names the day and the clock, in the house spelling', () => {
    const stamp = notificationStamp(new Date(2026, 8, 20, 19, 0).toISOString());
    assert.match(stamp, /^Sun, Sep\.? 20 · 7:00 p\.m\.$/);
  });
});
