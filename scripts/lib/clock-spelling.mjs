/**
 * The clock's SHAPE rules for the spelling gate (`scripts/check-spelling-consistency.mjs`), kept in a module of their own so
 * the unit test can run them on a fixture (Support console Stage 5, Part 9; owner Q9, 2026-10-26).
 *
 * ⏰ THE HOUSE CLOCK IS "6:18 p.m." — lowercase, with periods, and NO LEADING ZERO. The first half of that was gated on
 * 2026-08-26 (`AM`/`PM` after a time). The second half was not, and the Errors and Feedback screens printed "06:18 p.m."
 * beside the console's "5:52 p.m." for months: two spellings of one time, and the gate could not see it, because the time is
 * BUILT AT RUNTIME. `toLocaleString('en-CA', { hour: '2-digit' })` is the whole bug, and there is no literal "06:18" in the
 * source to find. So the gate reads two things:
 *
 *   1. SOURCE — an options object that asks for `hour: '2-digit'` and does not also say it is a 24-hour clock
 *      (`hour12: false`, or `hourCycle: 'h23' | 'h24'`). A 24-hour axis label ("06:00") is a different thing and stays legal.
 *      The fix is always `hour: 'numeric'`; `formatTime()` in lib/utils.ts and `consoleClock()` in lib/console-dates.ts
 *      are the callers' real answer.
 *   2. TEXT — a leading-zero twelve-hour time written out: "06:18 p.m.", "06:18 PM", "09:05 am".
 *
 * Both skip a line carrying (or following) `spelling-ok`, exactly like every other rule in the gate.
 */

/** A twelve-hour time written with a leading zero and a day-half marker (any case, with or without periods). */
export const LEADING_ZERO_CLOCK = {
  id: 'clock-leading-zero',
  pattern: /(?<![\d:])0\d:\d{2}[\s\u00a0\u202f]*(?:[ap]\.m\.|[AaPp][Mm]\b)/g,
  right: 'no leading zero on a twelve-hour time ("6:18 p.m.") — formatTime() in lib/utils.ts, consoleClock() in lib/console-dates.ts',
};

const TWO_DIGIT_HOUR = /\bhour\s*:\s*(['"])2-digit\1/g;
const TWENTY_FOUR_HOUR = /\bhour12\s*:\s*false\b|\bhourCycle\s*:\s*(['"])h2[34]\1/;
const REACH = 600; // how far to look for the braces of the options object around the match

/**
 * The options object around `index`: from its opening brace to its closing one (naive brace counting, bounded — an
 * options object is a few lines). Falls back to the whole window when the braces cannot be found.
 */
function enclosingObject(code, index) {
  let depth = 0;
  let start = Math.max(0, index - REACH);
  for (let i = index; i >= Math.max(0, index - REACH); i--) {
    const c = code[i];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) { start = i; break; }
      depth--;
    }
  }
  depth = 0;
  let end = Math.min(code.length, index + REACH);
  for (let i = start; i < Math.min(code.length, index + REACH); i++) {
    const c = code[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  return code.slice(start, end);
}

/**
 * Every `hour: '2-digit'` in comment-stripped `code` whose options object is not a 24-hour clock. Returns the 1-based line
 * and the matched text. `code` keeps its line structure (comments blanked, not removed), so a line number is the file's.
 */
export function twoDigitTwelveHourHits(code) {
  const hits = [];
  for (const m of code.matchAll(TWO_DIGIT_HOUR)) {
    if (TWENTY_FOUR_HOUR.test(enclosingObject(code, m.index))) continue;
    hits.push({ line: code.slice(0, m.index).split('\n').length, found: m[0] });
  }
  return hits;
}

export const TWO_DIGIT_RIGHT = 'hour: \'numeric\' — a twelve-hour time never prints a leading zero (consoleClock() / formatTime()); a 24-hour axis label says hour12: false';
