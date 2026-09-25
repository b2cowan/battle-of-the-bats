import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode, splitPhoneCss } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * PRACTICE PLANS ON A PHONE · STAGE 3 — the field (owner ruling M1–M4 = A, 2026-09-25, with the
 * station's Back asked for the same day; plan docs/projects/active/COACH_PRACTICE_PLANS_PHONE_PLAN.md §6f)
 *
 *   M1 **THE BUTTONS AT THE FOOT OF THE SCREEN** on a phone, on every stop AND every station, in one
 *      place; a station carries the STOP's own moves, back-a-round included; every tap opens its
 *      screen at the top. ⚠ Built as a bar pinned above the tab bar, then REPLACED by stage 3b (below)
 *      the same day — the foot is now the full screen's own.
 *   M2 **A STOP READS LIKE A STATION**: ONE shared piece holds the headed lines; a drill block (one
 *      station — the station IS the block) shows that station's setup and kit, and no one-row
 *      "Stations" list.
 *   M3 **NO SWIPE, CLOSED.** Nothing to build — held here so a gesture handler cannot arrive quietly.
 *   M4 **"JUST FOR TONIGHT" FIRST** — it was a station's eighth line.
 *
 * STAGE 3b — the field, full screen (owner ruling M5 = A, M6 = B, 2026-09-25; plan §6g)
 *   M5 **ON A PHONE RUN PRACTICE IS A FULL SCREEN OF ITS OWN**, the block sheet's construction, over
 *      the team line and the tab bar — a stray tab tap threw the coach's place away (the run keeps
 *      nothing between opens). Stage 3's pinned bar and the three pieces holding it are retired.
 *   M6 **ITS FOOT IS THE BLOCK STEPPER** — "‹ Block 2 of 4 ›" always, a round row above it in a
 *      rotation (Rotate now, and from round 2 a labelled "‹ Round 1"); absent, never greyed; each
 *      block remembers its round while the run is open.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const RUN = readCode('app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/run/page.tsx');
const STATION = readCode('app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticeStationView.tsx');
const CSS = readCode('app/[orgSlug]/coaches/coaches.module.css');
/** Every ≤640 rule in the stylesheet — none of them may serve the run's retired bar any more. */
const { phone: phoneBar } = splitPhoneCss(CSS);
const rule = (block: string, selector: string) => {
  const at = block.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is declared`);
  return block.slice(at, block.indexOf('}', at) + 1);
};
/** The shared piece, from its export to the line helper after it. */
const LINES = STATION.slice(STATION.indexOf('export function StationLines('), STATION.indexOf('function StationFactLine('));

/** The phone's frame and foot — module-level components in the run page. */
const FRAME = functionBody(RUN, 'FieldScreen');
const FOOT = functionBody(RUN, 'RunFoot');

describe('3b · M5 — on a phone, Run practice is a full screen of its own', () => {
  it('fixed over the app at the overlay layer, on the shell\'s ground', () => {
    const screen = rule(CSS, '.ppRunScreen');
    assert.match(screen, /position:\s*fixed;/);
    assert.match(screen, /inset:\s*0;/);
    assert.match(screen, /z-index:\s*400;/, 'the phone overlay layer — over the nav (300), under the help drawer (700)');
    assert.match(screen, /flex-direction:\s*column;/);
    assert.match(screen, /background:\s*var\(--pitch-black\);/, 'an explicit ground — a fixed surface with none shows the page through it');
  });
  it('registers with the portal\'s overlay signal — the tab bar hides, the page behind stops scrolling', () => {
    assert.match(FRAME, /useOverlayOpen\(phone\);/);
    assert.ok(RUN.includes("import { useOverlayOpen } from '@/lib/coaches-overlay';"));
  });
  it('a modal, as the block sheet — what is under it is covered, and the layout sweep measures it alone', () => {
    assert.ok(FRAME.includes('role="dialog" aria-modal="true" aria-label={label}'));
  });
  it('the foot sits BELOW the scroller, never over the words; the head pins inside it', () => {
    assert.match(FRAME, /<div ref=\{scrollRef\} className=\{styles\.ppRunScroll\} data-run-scroll>\{children\}<\/div>\s*\{foot && <div className=\{styles\.ppRunFoot\}>\{foot\}<\/div>\}/);
    const scroll = rule(CSS, '.ppRunScroll');
    assert.match(scroll, /overflow-y:\s*auto;/);
    assert.match(scroll, /min-height:\s*0;/, 'a flex child that may shrink below its content, or the foot is pushed off the screen');
    const head = rule(CSS, '.ppRunScreen .ppRunBar');
    assert.match(head, /position:\s*sticky;/);
    assert.match(head, /top:\s*0;/);
    assert.match(rule(CSS, '.ppRunFoot'), /padding:[^;]*env\(safe-area-inset-bottom, 0px\)/, 'nothing under the foot clears the home indicator any more');
  });
  it('ONE frame for the whole run — loading, the list, a station and a stop all return it', () => {
    assert.equal(RUN.match(/return frame\(/g)?.length, 4, 'a screen drawn outside the frame would unregister the overlay — the tab bar flashes back');
  });
  it('stage 3\'s pinned bar is retired, with the three pieces that held it', () => {
    assert.ok(!RUN.includes('data-docked-foot') && !CSS.includes('data-docked-foot'), 'the shell\'s opt-in has no page left to serve');
    assert.doesNotMatch(CSS, /\.ppRunPage:has\(> \.ppRunActions\)/, 'the stretched column and its spacer');
    assert.doesNotMatch(phoneBar, /\.ppRunActions/, 'no phone rule for a computer\'s row');
    assert.match(RUN, /const actionRow = phone \? helperLine : \(/, 'a phone draws no Back / Next row — the foot moves the run');
  });
  it('a helper\'s line stays with the words', () => {
    assert.doesNotMatch(phoneBar, /\.ppRunHandedOff/);
    assert.ok(RUN.includes('actions={actionRow}'), 'the station takes the stop\'s own — on a phone, the helper\'s line alone');
  });
  it('"Who\'s here tonight" stays after the buttons — a computer never finds them under an opened roster', () => {
    const stop = RUN.slice(RUN.lastIndexOf('className={styles.ppRunNext}'));
    assert.ok(stop.indexOf('{actionRow}') < stop.indexOf('{attendanceFold}'));
    assert.ok(STATION.indexOf('{props.actions}') > STATION.indexOf('Coming to you'), 'the station\'s moves are its last child');
  });
  it('every tap opens its screen at the top — before paint; on a phone the screen\'s own scroller', () => {
    assert.match(RUN, /useLayoutEffect\(\(\) => \{\s*const top = \{ top: 0, left: 0, behavior: 'instant' \} as const;\s*if \(scrollRef\.current\) scrollRef\.current\.scrollTo\(top\);\s*else window\.scrollTo\(top\);\s*\}, \[stepIndex, stationId\]\);/);
  });
});

describe('3b · M6 — the foot is the block stepper, with a round row in a rotation', () => {
  it('the block stepper always: ‹ Block n of N ›, ‹ from the first block is the list, the last block\'s › is the plan', () => {
    assert.ok(FOOT.includes('<nav className={styles.ppRunFootRow} aria-label="Blocks">'));
    assert.ok(FOOT.includes("aria-label={prevTitle ? `Previous block: ${prevTitle}` : 'Back to the list'}"));
    assert.ok(FOOT.includes('Block {blockIndex + 1} of {blocks.length}'));
    assert.match(FOOT, /\{nextTitle \? \([\s\S]*?aria-label=\{`Next block: \$\{nextTitle\}`\}[\s\S]*?\) : \([\s\S]*?aria-label="Done — back to the plan">Done<\/Link>/);
  });
  it('the practice ends on "Done" — a phone and a computer alike; the coach finishing, never a claim it ran', () => {
    assert.equal(RUN.match(/aria-label="Done — back to the plan">Done<\/Link>/g)?.length, 2, 'the phone\'s › place and the computer\'s last stop');
    assert.ok(!RUN.includes('>Back to the plan<'), 'one name for the one way out of the practice');
  });
  it('the round row only in a rotation: Rotate now, and a LABELLED back from round 2', () => {
    assert.match(FOOT, /\{round != null && \(/);
    assert.match(FOOT, /\{round > 1 && \(/, 'no back on round 1 — Rotate now takes the row');
    assert.ok(FOOT.includes('aria-label={`Back to round ${round - 1}`}') && FOOT.includes('Round {round - 1}'),
      'labelled — a bare ‹ over the block\'s ‹ was two identical arrows moving different things');
    assert.match(FOOT, /\{lastRound\s*\? <p className=\{styles\.ppRunFootNote\}>Last round/, 'the last round has a note where Rotate now was');
  });
  it('absent, never greyed — nothing in the foot is ever disabled', () => {
    assert.doesNotMatch(FOOT, /disabled/);
  });
  it('the ink is the one you\'ll tap next — Rotate now, else the block\'s ›', () => {
    assert.ok(FOOT.includes("const ink = lastRound ? '' : undefined;"), 'no Rotate now left — the block\'s way on is the next tap');
    assert.equal(FOOT.match(/data-ink=\{ink\}/g)?.length, 2, 'the › and, on the last block, "Done"');
    assert.ok(FOOT.includes('className={styles.ppRunPrimary} onClick={() => onRound(1)}>Rotate now</button>'));
  });
  it('every foot control is the field\'s 56px', () => {
    const arrows = rule(CSS, '.ppRunArrow, .ppRunEnd');
    assert.match(arrows, /min-width:\s*3\.5rem;/);
    assert.match(arrows, /min-height:\s*3\.5rem;/);
  });
  it('a block remembers its round while the run is open — a ref, never written anywhere', () => {
    assert.ok(RUN.includes('const lastStopOf = useRef(new Map<number, number>());'));
    assert.match(RUN, /useEffect\(\(\) => \{\s*if \(step\) lastStopOf\.current\.set\(step\.blockIndex, index\);\s*\}, \[step, index\]\);/);
    assert.ok(RUN.includes('else if (target < blocks.length) setStepIndex(stopFor(target));'), 'the block arrows land on the remembered stop');
    assert.equal(RUN.match(/onClick=\{\(\) => openBlock\(row\.index, /g)?.length, 2, 'the list\'s block and station rows do too');
    assert.doesNotMatch(RUN, /localStorage|sessionStorage/, 'nothing survives an open (P10)');
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
