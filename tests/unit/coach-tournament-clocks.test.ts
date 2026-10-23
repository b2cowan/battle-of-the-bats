import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { formatGameDateLabel, formatGameTimeLabel, homeAwayWord } from '../../lib/game-clock-labels.ts';
import { isGameLive } from '../../lib/game-status.ts';
import { formatStoredDate } from '../../lib/timezone.ts';

/**
 * Club Tier Stage 7d, Ask 11 (T7–T9): game rows on the BOOKING's clock and the house time, dates on the
 * club's clock, "Playing now" by the one shared rule, "vs" at home and "at" away.
 */

describe('a game reads on its own clock, whatever the device', () => {
  it('a 6:00 p.m. booking reads "6:00 p.m." on a device in a third zone', () => {
    const before = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14 — nowhere near the venue or the server
      assert.equal(formatGameTimeLabel('18:00:00'), '6:00 p.m.');
      assert.equal(formatGameDateLabel('2026-10-17'), 'Sat, Oct 17');
      process.env.TZ = 'Pacific/Pago_Pago'; // UTC−11
      assert.equal(formatGameDateLabel('2026-10-17'), 'Sat, Oct 17');
    } finally {
      process.env.TZ = before;
    }
  });
  it('no time → no label; no day → TBD', () => {
    assert.equal(formatGameTimeLabel(null), null);
    assert.equal(formatGameDateLabel(null), 'TBD');
  });
});

describe('dates on the club\'s clock', () => {
  it('an evening entry is not the next day', () => {
    // 9:30 p.m. Eastern on Oct 7 is already Oct 8 in UTC (the server's clock).
    assert.equal(formatStoredDate('2026-10-08T01:30:00Z', { withYear: false }), 'Oct 7');
  });
});

describe('"Playing now" — the one shared rule', () => {
  const game = { status: 'scheduled', date: '2026-10-17', time: '18:00' };
  it('a game in its window with no score yet IS live (the old "score entered today" rule said no)', () => {
    assert.equal(isGameLive(game, 90, new Date('2026-10-17T22:30:00Z')), true); // 6:30 p.m. Eastern
  });
  it('not before it starts, and not once final', () => {
    assert.equal(isGameLive(game, 90, new Date('2026-10-17T21:30:00Z')), false);
    assert.equal(isGameLive({ ...game, status: 'completed' }, 90, new Date('2026-10-17T22:30:00Z')), false);
  });
  it('no coach reader keeps the narrow rule', () => {
    for (const file of ['components/coaches/CoachLiveSchedule.tsx', 'lib/basic-coach-teams.ts']) {
      const src = readFileSync(file, 'utf8');
      assert.doesNotMatch(src, /status === 'submitted' && (g(ame)?\.)?(game_)?date === today/, file);
      assert.match(src, /isGameLive\(/, file);
    }
  });
});

describe('"vs" at home, "at" away — rows, the change notice, the calendar file', () => {
  it('one word', () => {
    assert.equal(homeAwayWord(true), 'vs');
    assert.equal(homeAwayWord(false), 'at');
  });
  it('no "@" left where the coach reads a tournament game', () => {
    for (const file of ['components/coaches/CoachLiveSchedule.tsx', 'components/coaches/CoachTournamentRecord.tsx']) {
      const src = readFileSync(file, 'utf8');
      assert.doesNotMatch(src, /'vs' : '@'|\? '@'/, file);
    }
  });
  it('the device-locale "client twins" are gone', () => {
    const src = readFileSync('components/coaches/CoachLiveSchedule.tsx', 'utf8');
    assert.doesNotMatch(src, /toLocaleTimeString|toLocaleDateString/);
  });
});
