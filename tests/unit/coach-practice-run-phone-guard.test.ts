import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, splitPhoneCss } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * PRACTICE PLANS ON A PHONE · STAGE 3 — the field (owner ruling M1–M4 = A, 2026-09-25, with the
 * station's Back asked for the same day; plan docs/projects/active/COACH_PRACTICE_PLANS_PHONE_PLAN.md §6f)
 *
 *   M1 **THE BUTTONS ARE A BAR AT THE FOOT OF THE SCREEN** on a phone, on every stop AND every
 *      station, in one place. A station carries the STOP's own row, Back included. Every tap opens
 *      its screen at the top. (The measurements live in the stylesheet's comment.)
 *   M2 **A STOP READS LIKE A STATION**: ONE shared piece holds the headed lines; a drill block (one
 *      station — the station IS the block) shows that station's setup and kit, and no one-row
 *      "Stations" list.
 *   M3 **NO SWIPE, CLOSED.** Nothing to build — held here so a gesture handler cannot arrive quietly.
 *   M4 **"JUST FOR TONIGHT" FIRST** — it was a station's eighth line.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const RUN = readCode('app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/run/page.tsx');
const STATION = readCode('app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticeStationView.tsx');
const CSS = readCode('app/[orgSlug]/coaches/coaches.module.css');
/** Every ≤640 rule in the stylesheet — the phone's bar lives there and nowhere else. */
const { phone: phoneBar } = splitPhoneCss(CSS);
const rule = (block: string, selector: string) => {
  const at = block.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is declared`);
  return block.slice(at, block.indexOf('}', at) + 1);
};
/** The shared piece, from its export to the line helper after it. */
const LINES = STATION.slice(STATION.indexOf('export function StationLines('), STATION.indexOf('function StationFactLine('));

describe('M1 · the bar at the foot of the screen — the recording screen\'s construction (E4)', () => {
  const bar = rule(phoneBar, '.ppRunActions');
  it('sticks at the clearance token, never at zero, and never above the nav', () => {
    assert.match(bar, /position:\s*sticky/);
    assert.match(bar, /bottom:\s*var\(--coach-foot-clear\)/, 'a bar at zero is drawn under the nav');
    assert.match(bar, /z-index:\s*2;/, 'a bar raised over the nav buries the sheets that open from it');
    assert.doesNotMatch(bar, /env\(safe-area/, 'the inset is already inside the token — counting it twice floats the bar');
    assert.doesNotMatch(bar, /margin-inline:\s*-/, 'the column\'s own width — never a guessed gutter');
  });
  it('sits at the foot on a short stop too — the page fills the screen, a spacer before the bar takes the slack', () => {
    assert.match(phoneBar, /\.ppRunPage:has\(> \.ppRunActions\)::after \{ content: ''; flex: 1 1 auto; order: 1; \}/);
    assert.match(bar, /order:\s*2;/, 'the spacer is ordered before the bar');
    assert.doesNotMatch(bar, /margin-top:\s*auto/, 'the bar keeps its 0.9rem above it on a long page — the spacer takes the slack');
    const page = rule(phoneBar, '.ppRunPage:has(> .ppRunActions)');
    assert.match(page, /flex-direction:\s*column/);
    assert.match(page, /min-height:\s*calc\(100vh - var\(--coach-header-h, 0px\) - 1rem\)/,
      'the SHELL\'s unit (100vh, the large viewport) and the masthead\'s published height — never 100dvh, never a copied 37');
  });
  it('the shell drops the main\'s foot for a page whose bar opts in — the page never reaches up by its own class names', () => {
    assert.match(phoneBar, /\.coachesMain:has\(\[data-docked-foot\]\) \{ padding-bottom: 0; \}/,
      'the main\'s 2rem foot is what let the bar ride up at the page\'s end (measured 32px on a station, 55 on a short stop)');
    assert.ok(RUN.includes('<div className={styles.ppRunActions} data-docked-foot>'), 'the bar opts in');
  });
  it('a helper\'s line stays with the words — never pushed down behind a bar held above its own place', () => {
    assert.doesNotMatch(phoneBar, /\.ppRunHandedOff/,
      'pushed to the foot of a short stop it sat at 721–763 under the bar at 699–772 (measured on the first build)');
  });
  it('a station carries the stop\'s own row — Back included — never the forward button alone', () => {
    assert.ok(RUN.includes('actions={actionRow}'), 'one bar for the stop and the station');
    assert.ok(!/actions=\{\s*advance\.disabled/.test(RUN), 'the forward-only station row is gone');
  });
  it('"Who\'s here tonight" stays after the buttons in the page — a phone lays the bar out last by its order', () => {
    const stop = RUN.slice(RUN.lastIndexOf('className={styles.ppRunNext}'));
    assert.ok(stop.indexOf('{actionRow}') < stop.indexOf('{attendanceFold}'),
      'a computer\'s buttons are not docked — an opened roster above them would push them down (/review 2026-09-25)');
    assert.ok(STATION.indexOf('{props.actions}') > STATION.indexOf('Coming to you'), 'the station\'s bar is its last child');
  });
  it('every tap opens its screen at the top — before paint, keyed on the stop and the station', () => {
    assert.match(RUN, /useLayoutEffect\(\(\) => \{\s*window\.scrollTo\(\{ top: 0, left: 0, behavior: 'instant' \}\);\s*\}, \[stepIndex, stationId\]\);/);
  });
});

describe('M2 · a stop reads like a station — ONE shared piece', () => {
  it('the station view exports the one piece, and both screens render it', () => {
    assert.match(STATION, /export function StationLines\(\{ station, block \}/);
    for (const label of ['What you’re doing', 'What you’re watching for']) {
      assert.ok(LINES.includes(`label="${label}"`), `"${label}" is headed`);
    }
    assert.ok(LINES.includes('>Coaching points</p>'));
    assert.ok(RUN.includes('<StationLines station={sole} block={block} />') && RUN.includes('const sole = soleStationOf(block);'),
      'a plain stop passes its block\'s one station, or none');
    assert.ok(STATION.includes('<StationLines station={station} block={block} />'));
    assert.ok(!RUN.includes('ppRunNote') && !RUN.includes('resolveStationTeaching'), 'the unlabelled paragraph and the page\'s own resolve are gone');
  });
  it('a drill block shows its one station\'s setup and kit, and never offers that station as a one-row list', () => {
    assert.ok(LINES.includes('<StationFactLine label="Setup" text={station?.setup} />'));
    assert.ok(LINES.includes('<StationFactLine label="Equipment" text={station?.equipment?.join'));
    assert.ok(RUN.includes('step.round == null && (stations.length > 1 || soleNameSaysMore) &&'),
      'the Stations list needs two — or a lone station whose name the block\'s title does not say');
    assert.ok(LINES.includes('<StationFactLine label="Rotation" text={station?.rotationNote} />'),
      'a lone station\'s rotation note reaches the field through its stop (/review 2026-09-25)');
  });
});

describe('M3 · no swipe — closed, so nothing on the field listens for one', () => {
  it('no touch, pointer or swipe handler on the run screen or the station view', () => {
    for (const file of [RUN, STATION]) {
      assert.doesNotMatch(file, /onTouch(Start|Move|End)|onPointer(Down|Move|Up)|touchstart|pointerdown|useSwipe/i);
    }
  });
});

describe('M4 · "Just for tonight" first', () => {
  it('first in the shared piece — before the teaching, on a station and a drill block\'s stop alike', () => {
    assert.ok(LINES.indexOf('>Just for tonight</p>') < LINES.indexOf('label="What you’re doing"'), 'tonight → the teaching');
  });
  it('on a station, the shared piece comes straight after "With you now"', () => {
    const view = STATION.slice(STATION.indexOf('export default function PracticeStationView('));
    const now = view.indexOf('With you now');
    const lines = view.indexOf('<StationLines station={station} block={block} />');
    assert.ok(now > 0 && lines > now && !view.slice(now, lines).includes('StationFactLine'), 'With you now → tonight and the teaching');
  });
  it('its words have a class of their own, so the label sets at every other label\'s size', () => {
    assert.ok(LINES.includes('<p className={styles.ppStNoteTxt}>{station.note}</p>'));
    assert.doesNotMatch(CSS, /\.ppStNote p\s*\{/, 'a bare `.ppStNote p` outranked `.ppStLbl` and set the label at 14px');
  });
});
