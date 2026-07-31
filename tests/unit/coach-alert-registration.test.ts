import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  pickFanViewRegistration,
  pickFeaturedRegistration,
  resolveRowFanView,
  type AlertHistoryEntry,
} from '../../lib/coach-alert-registration.ts';

const TODAY = '2026-07-30';

function entry(
  id: string,
  tournament: Partial<NonNullable<AlertHistoryEntry['tournament']>> | null,
  orgSlug: string | null = 'milton',
  registrationStatus = 'accepted',
): AlertHistoryEntry {
  return {
    registration: { id, status: registrationStatus },
    org: orgSlug ? { slug: orgSlug } : null,
    tournament: tournament ? { slug: `t-${id}`, status: 'active', name: id, ...tournament } : null,
  };
}

/**
 * Callers hand these functions history in `registeredAt` DESC order — that is what
 * `getBasicCoachTournamentHistoryForTeam` returns and what the premium API sends. Every fixture
 * below is written in that order on purpose, so a regression that trusts array position fails here.
 */
describe('pickFeaturedRegistration — the ONE tournament the free Overview names', () => {
  it('names the LIVE event, not the one registered most recently', () => {
    const history = [
      // registered yesterday, plays in August
      entry('august', { startDate: '2026-08-15', endDate: '2026-08-17' }),
      // registered months ago, being played right now
      entry('today', { startDate: '2026-07-29', endDate: '2026-07-31' }),
    ];
    assert.equal(pickFeaturedRegistration(history, TODAY)?.registration.id, 'today');
  });

  it('names the soonest upcoming event when nothing is live', () => {
    const history = [
      entry('far', { startDate: '2026-09-01', endDate: '2026-09-02' }),
      entry('soon', { startDate: '2026-08-02', endDate: '2026-08-03' }),
    ];
    assert.equal(pickFeaturedRegistration(history, TODAY)?.registration.id, 'soon');
  });

  it('falls back to the MOST RECENT finished event once everything is over', () => {
    const history = [
      entry('may', { startDate: '2026-05-01', endDate: '2026-05-02' }),
      entry('june', { startDate: '2026-06-20', endDate: '2026-06-21' }),
    ];
    assert.equal(pickFeaturedRegistration(history, TODAY)?.registration.id, 'june');
  });

  it('prefers anything still ahead over a finished event', () => {
    const history = [
      entry('finished', { startDate: '2026-07-01', endDate: '2026-07-02' }),
      entry('ahead', { startDate: '2026-12-01', endDate: '2026-12-02' }),
    ];
    assert.equal(pickFeaturedRegistration(history, TODAY)?.registration.id, 'ahead');
  });

  it('still names an UNPUBLISHED registration — it just has no fan-view door', () => {
    const draft = entry('draft', { startDate: '2026-08-10', endDate: '2026-08-11', status: 'draft' });
    const featured = pickFeaturedRegistration([draft], TODAY);
    assert.equal(featured?.registration.id, 'draft');
    assert.equal(resolveRowFanView(featured!), null);
  });

  it('returns null for a team with no tournaments (the empty state owns that case)', () => {
    assert.equal(pickFeaturedRegistration([], TODAY), null);
  });

  // `history` carries REJECTED entries unfiltered — they are part of the team's record. Lifecycle
  // alone would headline an event the team was turned away from while the one they're actually in
  // sits behind "See all".
  it('never headlines a REJECTED entry over one the team is still in, even when the rejected event is live', () => {
    const history = [
      entry('rejected-live', { startDate: '2026-07-29', endDate: '2026-07-31' }, 'milton', 'rejected'),
      entry('accepted-soon', { startDate: '2026-08-20', endDate: '2026-08-21' }),
    ];
    assert.equal(pickFeaturedRegistration(history, TODAY)?.registration.id, 'accepted-soon');
  });

  it('prefers pending and waitlisted over rejected too — anything the team is still in', () => {
    for (const status of ['pending', 'waitlist']) {
      const history = [
        entry('rejected-live', { startDate: '2026-07-29', endDate: '2026-07-31' }, 'milton', 'rejected'),
        entry('still-in', { startDate: '2026-09-01', endDate: '2026-09-02' }, 'milton', status),
      ];
      assert.equal(
        pickFeaturedRegistration(history, TODAY)?.registration.id, 'still-in', `status ${status}`,
      );
    }
  });

  it('DOES feature a rejection when it is the only entry — that is the honest answer, not an empty page', () => {
    const only = entry('turned-away', { startDate: '2026-07-01' }, 'milton', 'rejected');
    assert.equal(pickFeaturedRegistration([only], TODAY)?.registration.id, 'turned-away');
  });

  it('falls back to the best REJECTED entry by lifecycle when every entry is rejected', () => {
    const history = [
      entry('old-rejection', { startDate: '2026-05-01' }, 'milton', 'rejected'),
      entry('recent-rejection', { startDate: '2026-07-01' }, 'milton', 'rejected'),
    ];
    assert.equal(pickFeaturedRegistration(history, TODAY)?.registration.id, 'recent-rejection');
  });

  it('does not fall over on a registration whose tournament row is missing entirely', () => {
    const featured = pickFeaturedRegistration([entry('orphan', null)], TODAY);
    assert.equal(featured?.registration.id, 'orphan');
  });
});

describe('pickFanViewRegistration — the premium tail row', () => {
  it('DF-2: picks the live event over a future one registered later', () => {
    const history = [
      entry('august', { startDate: '2026-08-15', endDate: '2026-08-17' }),
      entry('today', { startDate: '2026-07-29', endDate: '2026-07-31' }),
    ];
    assert.equal(pickFanViewRegistration(history, TODAY)?.name, 'today');
  });

  it('stays narrower than the row rule — a COMPLETED event is not the current event', () => {
    const completed = entry('done', {
      startDate: '2026-07-01', endDate: '2026-07-02', status: 'completed',
    });
    assert.equal(pickFanViewRegistration([completed], TODAY), null);
    // ...but its list ROW still opens the public page (owner call 2026-07-23).
    assert.deepEqual(resolveRowFanView(completed), { orgSlug: 'milton', tournamentSlug: 't-done' });
  });

  it('can still return a finished-but-unarchived event (status active) — the chip says so', () => {
    const stale = entry('stale', { startDate: '2026-07-01', endDate: '2026-07-02' });
    assert.equal(pickFanViewRegistration([stale], TODAY)?.name, 'stale');
  });

  it('skips an entry with no org or tournament slug', () => {
    assert.equal(
      pickFanViewRegistration([entry('noorg', { startDate: '2026-08-01' }, null)], TODAY),
      null,
    );
  });
});

describe('resolveRowFanView — one rule for every coach-facing tournament row', () => {
  it('opens for active and completed (the public statuses), never for draft or archived', () => {
    for (const [status, expected] of [
      ['active', true], ['completed', true], ['draft', false], ['archived', false],
    ] as const) {
      const got = resolveRowFanView(entry('e', { status }));
      assert.equal(got !== null, expected, `status ${status}`);
    }
  });

  it('needs BOTH slugs', () => {
    assert.equal(resolveRowFanView(entry('e', { slug: null })), null);
    assert.equal(resolveRowFanView(entry('e', {}, null)), null);
  });
});
