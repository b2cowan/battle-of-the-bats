/**
 * The tournament hero's shared strings — the anti-drift pin.
 *
 * The setup wizard's live preview and the real public hero render from two different
 * places (a client mimic and a server component). These helpers are the only thing they
 * share, so what is pinned here is what stops an organizer being shown a page that never
 * ships: the date range wording, the lifecycle line, the countdown's single-unit
 * granularity, and the inclusive day count.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HERO_DATES_TBD,
  formatHeroDateRange,
  heroCountdownText,
  formatCountdownDuration,
  heroFirstPitchISO,
  tournamentDayCount,
} from '../../lib/tournament-hero-copy.ts';

describe('formatHeroDateRange', () => {
  it('reads long months with one year when the event stays inside a year', () => {
    assert.equal(formatHeroDateRange('2026-08-08', '2026-08-10'), 'August 8 - August 10, 2026');
  });

  it('shows both years when the event crosses New Year', () => {
    assert.equal(
      formatHeroDateRange('2026-12-30', '2027-01-02'),
      'December 30, 2026 - January 2, 2027',
    );
  });

  it('keeps the range form for a single-day event', () => {
    assert.equal(formatHeroDateRange('2026-05-02', '2026-05-02'), 'May 2 - May 2, 2026');
  });

  it('falls back to TBD until BOTH dates exist — the wizard state before a date is picked', () => {
    assert.equal(formatHeroDateRange('2026-08-08', ''), HERO_DATES_TBD);
    assert.equal(formatHeroDateRange(null, null), HERO_DATES_TBD);
    assert.equal(formatHeroDateRange(undefined, '2026-08-10'), HERO_DATES_TBD);
  });

  it('does not shift a day behind in a zone west of UTC (manual parse, not new Date)', () => {
    // `new Date('2026-08-08')` is UTC midnight — rendered in Toronto that is Aug 7.
    assert.equal(formatHeroDateRange('2026-08-01', '2026-08-01'), 'August 1 - August 1, 2026');
  });
});

describe('heroCountdownText', () => {
  it('counts calendar days to go before the event', () => {
    assert.equal(heroCountdownText('2026-08-08', '2026-08-10', '2026-07-18'), '21 days to go');
  });

  it('reads in-progress on the first and last day inclusive', () => {
    assert.equal(heroCountdownText('2026-08-08', '2026-08-10', '2026-08-08'), 'Tournament in progress');
    assert.equal(heroCountdownText('2026-08-08', '2026-08-10', '2026-08-10'), 'Tournament in progress');
  });

  it('reads complete the day after the end date', () => {
    assert.equal(heroCountdownText('2026-08-08', '2026-08-10', '2026-08-11'), 'Tournament complete');
  });

  it('says nothing at all until both dates exist', () => {
    assert.equal(heroCountdownText('2026-08-08', '', '2026-07-18'), '');
    assert.equal(heroCountdownText(null, null, '2026-07-18'), '');
  });
});

describe('formatCountdownDuration', () => {
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('shows the single largest unit only', () => {
    assert.equal(formatCountdownDuration(41 * DAY + 19 * HOUR), '41 days');
    assert.equal(formatCountdownDuration(6 * HOUR + 40 * MIN), '6 hours');
    assert.equal(formatCountdownDuration(8 * MIN), '8 minutes');
  });

  it('singularises', () => {
    assert.equal(formatCountdownDuration(DAY), '1 day');
    assert.equal(formatCountdownDuration(HOUR), '1 hour');
    assert.equal(formatCountdownDuration(MIN), '1 minute');
  });

  it('never renders "0 minutes" in the last seconds before first pitch', () => {
    assert.equal(formatCountdownDuration(20_000), '1 minute');
  });
});

describe('heroFirstPitchISO', () => {
  it('defaults to 9 AM when nothing is scheduled yet — the wizard preview case', () => {
    assert.equal(heroFirstPitchISO('2026-08-08'), '2026-08-08T09:00:00');
  });

  it('normalises HH:MM and HH:MM:SS to a parseable instant', () => {
    assert.equal(heroFirstPitchISO('2026-08-08', '18:30'), '2026-08-08T18:30:00');
    assert.equal(heroFirstPitchISO('2026-08-08', '18:30:00'), '2026-08-08T18:30:00');
    assert.ok(!Number.isNaN(Date.parse(heroFirstPitchISO('2026-08-08', '18:30:00') as string)));
  });

  it('has no target without a date', () => {
    assert.equal(heroFirstPitchISO(null), null);
    assert.equal(heroFirstPitchISO(''), null);
  });
});

describe('tournamentDayCount', () => {
  it('counts both ends', () => {
    assert.equal(tournamentDayCount('2026-08-08', '2026-08-10'), 3);
    assert.equal(tournamentDayCount('2026-08-08', '2026-08-08'), 1);
  });

  it('never reads below one day, even if the dates are inverted', () => {
    assert.equal(tournamentDayCount('2026-08-10', '2026-08-08'), 1);
  });

  it('is unknown until both dates exist', () => {
    assert.equal(tournamentDayCount('2026-08-08', ''), null);
    assert.equal(tournamentDayCount(null, null), null);
  });
});
