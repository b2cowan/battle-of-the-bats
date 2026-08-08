/**
 * "A downgrade must never archive the tournament that is happening right now."
 *
 * Why this test exists: when a platform admin downgrades an org to a smaller plan, the tournaments
 * that no longer fit are archived. The candidate list arrives sorted for DISPLAY — year DESC, then
 * name ASC — and the first version of the downgrade simply kept the first N of that list. Within a
 * single year that is pure alphabet: "April Open" (finished in the spring) would be KEPT over
 * "Summer Showdown" running today, and archiving a live tournament 404s its entire public site
 * instantly, mid-event, for every family and spectator watching.
 *
 * So the keep order is ranked by what the org is actually USING. These assertions pin that.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rankForKeeping, orderByKeepPriority } from '../../lib/billing-downgrade-order.ts';

const TODAY = '2026-08-06';

function t(over: Partial<{
  id: string; name: string; slug: string; status: string;
  year: number | null; startDate: string | null; endDate: string | null;
}> = {}) {
  return {
    id: 'id', name: 'Name', slug: 'slug', status: 'completed',
    year: 2026, startDate: null, endDate: null, ...over,
  };
}

describe('downgrade keep-order — never archive what is running now', () => {
  it('THE RULE: a live tournament outranks a finished one that sorts earlier alphabetically', () => {
    // The exact scenario the display order got wrong.
    const aprilOpen = t({ name: 'April Open', status: 'completed', startDate: '2026-04-01', endDate: '2026-04-03' });
    const summerShowdown = t({ name: 'Summer Showdown', status: 'active', startDate: '2026-08-05', endDate: '2026-08-08' });

    assert.ok(
      rankForKeeping(summerShowdown, TODAY) < rankForKeeping(aprilOpen, TODAY),
      'the running tournament must be kept over the finished one, whatever the alphabet says',
    );
  });

  it('counts a tournament as running from its date window even when the status has not caught up', () => {
    // Organizers do not always flip status to "active" on the morning of day one.
    const midEventButDraft = t({ status: 'draft', startDate: '2026-08-05', endDate: '2026-08-08' });
    assert.equal(rankForKeeping(midEventButDraft, TODAY), 0);

    // Single-day event happening today (start == today, no end date set).
    const oneDayToday = t({ status: 'draft', startDate: TODAY, endDate: null });
    assert.equal(rankForKeeping(oneDayToday, TODAY), 0);
  });

  it('ranks upcoming above draft-without-dates, and both above finished', () => {
    const upcoming = t({ status: 'draft', startDate: '2026-09-01' });
    const beingPlanned = t({ status: 'draft', startDate: null, endDate: null });
    const finished = t({ status: 'completed', startDate: '2026-01-01', endDate: '2026-01-02' });

    assert.equal(rankForKeeping(upcoming, TODAY), 1);
    assert.equal(rankForKeeping(beingPlanned, TODAY), 2);
    assert.equal(rankForKeeping(finished, TODAY), 3);
    assert.ok(rankForKeeping(upcoming, TODAY) < rankForKeeping(beingPlanned, TODAY));
    assert.ok(rankForKeeping(beingPlanned, TODAY) < rankForKeeping(finished, TODAY));
  });

  it('END TO END: a one-slot downgrade keeps the live event and archives the finished one', () => {
    // Exactly what an org dropping from Club to a one-tournament plan would hit.
    const list = [
      t({ id: 'april', name: 'April Open', status: 'completed', startDate: '2026-04-01', endDate: '2026-04-03' }),
      t({ id: 'summer', name: 'Summer Showdown', status: 'active', startDate: '2026-08-05', endDate: '2026-08-08' }),
      t({ id: 'fall', name: 'Fall Classic', status: 'draft', startDate: '2026-10-01' }),
    ];
    const ranked = orderByKeepPriority(list, TODAY);
    const kept = ranked.slice(0, 1).map(x => x.id);
    const archived = ranked.slice(1).map(x => x.id);

    assert.deepEqual(kept, ['summer'], 'the running tournament is the one kept');
    assert.ok(!archived.includes('summer'), 'a live tournament must never be archived');
    assert.deepEqual(archived.sort(), ['april', 'fall']);
  });

  it('orders upcoming events soonest-first so the nearest survives a tight cap', () => {
    const ranked = orderByKeepPriority([
      t({ id: 'later', name: 'Later', status: 'draft', startDate: '2026-12-01' }),
      t({ id: 'sooner', name: 'Sooner', status: 'draft', startDate: '2026-09-01' }),
    ], TODAY);
    assert.deepEqual(ranked.map(x => x.id), ['sooner', 'later']);
  });

  it('an ended tournament is finished even if its status still says active', () => {
    // Status drift the other way: the event is over, nobody closed it out.
    const endedButActive = t({ status: 'active', startDate: '2026-07-01', endDate: '2026-07-03' });
    // 'active' is trusted first by design — an organizer marking it active is a deliberate signal,
    // and keeping a stale-active event costs nothing, whereas archiving a live one is unrecoverable
    // mid-event. This assertion records that deliberate bias rather than pretending it isn't there.
    assert.equal(rankForKeeping(endedButActive, TODAY), 0);
  });
});
