import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookedWords } from '../../lib/club-schedule-document.ts';
import { SCHEDULE_SCREEN_WORDS as W } from '../../lib/club-schedule-words.ts';
import { readCode } from './_source-code.ts';

/**
 * NEW SCHEDULE · BY DAY — "Show already booked" (owner 2026-11-24).
 * A slot another booking already holds reads "Booked", then what holds it, in the draft's By day list, the printed
 * schedule and the Excel — one wording. By day starts with only what the draft just made; a tick brings the booked
 * slots back. The By day line wraps, so the tick has room on a phone.
 */
describe('a booked slot has one wording on the screen and in both exports', () => {
  it('says Booked, then what holds the slot when that is known', () => {
    assert.equal(bookedWords({ ownerName: 'Milton Bats U11 Rep Purple', kind: 'practice' }), 'Booked practice · Milton Bats U11 Rep Purple');
    assert.equal(bookedWords({ ownerName: 'Milton Bats U13', kind: 'game' }), 'Booked game · Milton Bats U13');
    assert.equal(bookedWords({ ownerName: '13U AAA', kind: 'tryout' }), 'Booked tryout day · 13U AAA');
  });

  it('says only Booked when the app does not know what holds the slot', () => {
    assert.equal(bookedWords({ ownerName: 'Somebody', kind: null }), 'Booked · Somebody');
    assert.equal(bookedWords({ ownerName: 'Somebody', kind: 'something-new' }), 'Booked · Somebody');
  });

  it('the screen and the exports take the wording from the one function', () => {
    const doc = readCode('lib/club-schedule-document.ts');
    assert.match(doc, /if \(s\.heldBy\) return bookedWords\(s\.heldBy\);/, 'the printed schedule and the Excel');
    const win = readCode('components/admin/kit/club/schedules/NewScheduleWindow.tsx');
    assert.match(win, /bookedWords\(s\.heldBy\)/, 'the By day list');
    assert.doesNotMatch(win, /'Tryout day' : 'Booked'/, 'no second copy of the wording on the screen');
  });
});

describe('By day hides the already-booked slots until they are asked for', () => {
  const win = readCode('components/admin/kit/club/schedules/NewScheduleWindow.tsx');

  it('starts hidden, and the tick reads "Show already booked (N)"', () => {
    assert.match(win, /const \[showBooked, setShowBooked\] = useState\(false\);/);
    assert.equal(W.showBooked(144), 'Show already booked (144)');
  });

  it('a slot counts as booked only when no team has it, a booking holds it and "avoid bookings" is on', () => {
    assert.match(win, /const isBookedSlot = \(s: DraftSlot\) => !!s\.heldBy && settingsNow\.rules\.avoidBookings && !\(pick\?\.assignments\[s\.key\] \?\? \[\]\)\.length;/);
  });

  it('the list drops them, and a day with nothing left drops its heading too', () => {
    assert.match(win, /g\.list\.filter\(s => showBooked \|\| !isBookedSlot\(s\)\)/);
    assert.match(win, /\.filter\(g => g\.list\.length\)/);
  });

  it('a list with nothing but booked slots says so, and says where they are', () => {
    assert.match(win, /shownDays\.length === 0 && bookedCount > 0 && <p className=\{sch\.dayEmpty\}>\{W\.onlyBooked\}<\/p>/);
    assert.match(W.onlyBooked, /every slot is already booked.*Show already booked/);
  });

  it('the tick is offered only on By day, and only when something is booked', () => {
    assert.match(win, /lens === 'day' && bookedCount > 0 && \(/);
  });

  it('the By day line wraps so the tick fits beside the switch and Export on a phone', () => {
    const css = readCode('components/admin/kit/club/schedules/Schedules.module.css');
    assert.match(css, /\.lensLine \{[^}]*flex-wrap: wrap;/);
  });
});
