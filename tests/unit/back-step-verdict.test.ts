/**
 * Back goes up one level (owner, 2026-09-21) — the pure half of `useBackStep`.
 *
 * A sheet, a form, a station in Run practice: each stands one history entry behind the view it
 * opened from. `popVerdict` reads where the browser landed against the topmost open step and says
 * what the pop means; the hook does the pushing. The cases below are the ones that were argued
 * out — every one of them is a way a Back press could otherwise do nothing, or close the wrong
 * thing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addressOf, clickLeavesPage, createPressGate, homeOf, popVerdict, PRESS_CLICK_GRACE_MS, stepOf } from '../../components/coaches/backStep.ts';
import { readCode } from './_source-code.ts';

describe('popVerdict — what a Back landing means', () => {
  it('no step open: a page entry is nothing to do, a step entry is a dead one to step over', () => {
    assert.equal(popVerdict(null, null), 'stay');
    // A sheet left behind when the coach navigated away from inside it, reached again by Back;
    // or a closed sheet's entry reached by Forward. Either way, a press that would do nothing.
    assert.equal(popVerdict(3, null), 'step-back');
  });
  it('the top step\'s own entry was popped: hold the line and close it', () => {
    assert.equal(popVerdict(null, 3), 'close-top');   // one step over the page
    assert.equal(popVerdict(2, 3), 'close-top');      // a question over a room: the question closes
    assert.equal(popVerdict(1, 3), 'close-top');      // landed on a dead entry beneath — still the top's pop
  });
  it('landed on the top step\'s own entry: a no-op traverse, nothing to do', () => {
    assert.equal(popVerdict(3, 3), 'stay');
  });
  it('forward onto an entry above the top step: a closed step\'s leftover — undo it', () => {
    assert.equal(popVerdict(4, 3), 'step-back');
  });
  it('a dead entry that NAMES A PLACE is the destination, not a placeholder', () => {
    // Owner, 2026-09-22 — "back from the lineup skips the game". The schedule's game sheet leaves
    // `?event=…&tab=…` on its entry when the coach walks out through one of its doors; Back onto
    // it is a Back onto the GAME, and the page reopens it from the address. Stepping over it is
    // what landed the coach on the bare schedule.
    assert.equal(popVerdict(3, null, true), 'stay');
    // …and an unaddressed one still is a placeholder: nothing could be restored from it.
    assert.equal(popVerdict(3, null, false), 'step-back');
    // A page entry is a page entry whatever is claimed about it.
    assert.equal(popVerdict(null, null, true), 'stay');
    // The top step's own pop still closes it — an address changes where Back LANDS, never what
    // an open level does when its entry is popped.
    assert.equal(popVerdict(null, 3, true), 'close-top');
    // ⚠ And with a level still OPEN, an address ABOVE it is a leftover like any other: what is on
    // screen is the truth, so landing there would leave the coach reading one thing at the address
    // of another. The exception belongs to "nothing is open", not to "it has an address".
    assert.equal(popVerdict(4, 3, true), 'step-back');
  });
});

describe('addressOf / homeOf — the place an entry names', () => {
  it('reads a non-empty string, and nothing else', () => {
    assert.equal(addressOf({ __step: 1, __stepAt: '/t/schedule?event=e1' }), '/t/schedule?event=e1');
    assert.equal(addressOf({ __step: 1 }), null, 'a step that names no place');
    assert.equal(addressOf({ __step: 1, __stepAt: '' }), null, 'an empty address is no address');
    assert.equal(addressOf({ __step: 1, __stepAt: 3 }), null);
    assert.equal(addressOf(null), null);
    assert.equal(homeOf({ __step: 1, __stepHome: '/t/schedule' }), '/t/schedule');
    assert.equal(homeOf({ __step: 1 }), null);
    assert.equal(homeOf(undefined), null);
  });
});

describe('stepOf — the marker an entry carries', () => {
  it('reads a number, and nothing else', () => {
    assert.equal(stepOf({ __step: 7, __NA: true }), 7);
    assert.equal(stepOf({ __NA: true }), null);
    assert.equal(stepOf({ __step: '7' }), null);
    assert.equal(stepOf(null), null);
    assert.equal(stepOf(undefined), null);
  });
});

/**
 * THE OPEN GAME IS A PLACE (owner, 2026-09-22 — "browser back skips the game"). The verdict above
 * only pays off if a level that CAN name a place actually does. Every door out of the schedule's
 * event sheet leads to another page — the lineup builder, Game day, Run practice, a player — and
 * for as long as the sheet stood on an address-less level, Back out of any of them stepped over
 * it onto the bare schedule. These three are the wiring that makes the game reachable: the sheet
 * names its address, the floor hands it to the step, and the page answers it on the way back in.
 */
describe('the schedule\'s game sheet names its address', () => {
  const schedule = readCode('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx');
  // The sheet — its own file since the Schedule deep dive's split (S6, 2026-09-25). It is mounted
  // only while a game is open, so its floor stands for exactly as long as the game does.
  const sheet = readCode('components/coaches/ScheduleEventSheet.tsx');
  const floor = readCode('components/coaches/useDialogFloor.ts');

  it('the open event IS the address, and it carries the tab the coach is reading', () => {
    assert.match(
      sheet,
      /const sheetAddress = `\$\{base\}\/schedule\?event=\$\{ev\.id\}&tab=\$\{slideTab\}`;/,
      'the address is the one the deep link below already answers — and the builder\'s `return`',
    );
    assert.match(sheet, /useDialogFloor\(true, slideOverRef, \{[\s\S]*?address: sheetAddress \}\);/);
    assert.match(schedule, /\{selectedEvent && \(\s*<ScheduleEventSheet/, 'the sheet — and so its floor — exists only while a game is open');
  });

  it('the floor hands its address to the step', () => {
    assert.match(floor, /\}, opts\.address \?\? null\);/, 'useBackStep takes the floor\'s address');
  });

  it('the page hands the query back to the sheet, so a closed game leaves no address behind', () => {
    // A link, the builder's arrow or a reload lands on an entry carrying `?event=`. The sheet's
    // own entry carries it a commit later; this one gives it up, or closing the game would leave
    // an address naming a game that is no longer open.
    assert.match(schedule, /sp\.delete\('event'\);\s*sp\.delete\('tab'\);/);
    assert.match(schedule, /window\.history\.replaceState\(window\.history\.state, '', `\$\{window\.location\.pathname\}\$\{rest \? `\?\$\{rest\}` : ''\}`\);/);
  });
});

/**
 * A tap that closes a step may also be a tap on a link (§239 walk, 2026-09-25). The lineup builder's
 * Print and row menus close on an outside press; the press was the bottom bar's Schedule, and the
 * step's `history.back()` landed between the press and its click — the navigation was lost. A click
 * that LEAVES the page is left to push over the entry instead.
 */
describe('clickLeavesPage — does this click take the tab somewhere else?', () => {
  const at = { origin: 'https://app.test', pathname: '/org/coaches/teams/t/lineups/e', search: '', href: 'https://app.test/org/coaches/teams/t/lineups/e' };
  const link = (href: string | null, extra: Partial<{ target: string; download: boolean; button: number; modified: boolean }> = {}) =>
    ({ href, target: '', download: false, button: 0, modified: false, ...extra });

  it('the bottom bar\'s Schedule, from the lineup builder: it leaves', () => {
    assert.equal(clickLeavesPage(link('https://app.test/org/coaches/teams/t/schedule'), at), true);
  });
  it('the same path with another query is another place (the schedule\'s ?event=): it leaves', () => {
    assert.equal(clickLeavesPage(link('https://app.test/org/coaches/teams/t/lineups/e?tab=2'), at), true);
  });
  it('another site replaces the page: it leaves', () => {
    assert.equal(clickLeavesPage(link('https://elsewhere.test/'), at), true);
  });
  it('not a link, or a link to where the browser already is (a #hash): the page stays, the entry is consumed', () => {
    assert.equal(clickLeavesPage(link(null), at), false);
    assert.equal(clickLeavesPage(link('https://app.test/org/coaches/teams/t/lineups/e#notes'), at), false);
  });
  it('a new tab, a download, a middle or modified click: the page stays', () => {
    const to = 'https://app.test/org/coaches/teams/t/schedule';
    assert.equal(clickLeavesPage(link(to, { target: '_blank' }), at), false);
    assert.equal(clickLeavesPage(link(to, { target: '_self' }), at), true, '_self is this tab');
    assert.equal(clickLeavesPage(link(to, { target: '_top' }), at), true, '_top is this tab — the portal is never framed');
    assert.equal(clickLeavesPage(link(to, { target: '_parent' }), at), true, '_parent likewise');
    assert.equal(clickLeavesPage(link(to, { target: 'report' }), at), false, 'a named window is another tab');
    assert.equal(clickLeavesPage(link(to, { download: true }), at), false);
    assert.equal(clickLeavesPage(link(to, { button: 1 }), at), false);
    assert.equal(clickLeavesPage(link(to, { modified: true }), at), false);
  });
  it('mailto: and tel: open an app — the page stays (a family\'s phone on the player page)', () => {
    assert.equal(clickLeavesPage(link('mailto:family@example.test'), at), false);
    assert.equal(clickLeavesPage(link('tel:+15555550100'), at), false);
    assert.equal(clickLeavesPage(link('javascript:void(0)'), at), false);
  });
});

/**
 * The press gate, played as event sequences on a fake clock. Each case is a way the first build of
 * the fix got it wrong, or the behaviour it was built for (§239 walk and its /review, 2026-09-25).
 */
describe('createPressGate — an exit waits for the tap that closed it, and hears whether it left the page', () => {
  function clock() {
    let now = 0; let seq = 0;
    const due: { at: number; seq: number; run: () => void }[] = [];
    const timers = {
      set(run: () => void, ms: number) { const t = { at: now + ms, seq: seq++, run }; due.push(t); return t; },
      clear(h: unknown) { const k = due.indexOf(h as never); if (k >= 0) due.splice(k, 1); },
    };
    const advance = (ms: number) => {
      const end = now + ms;
      for (;;) {
        due.sort((a, b) => a.at - b.at || a.seq - b.seq);
        const next = due[0];
        if (!next || next.at > end) break;
        due.shift(); now = next.at; next.run();
      }
      now = end;
    };
    return { timers, advance };
  }
  const setup = () => { const c = clock(); const gate = createPressGate(c.timers); const heard: boolean[] = []; return { ...c, gate, heard, exit: () => gate.exit(l => heard.push(l)) }; };

  it('the lineup builder\'s Print menu, a tap on Schedule: held through the tap, then told it LEFT', () => {
    const { gate, heard, exit, advance } = setup();
    gate.press(); exit();                  // the menu closes on the pointer-down
    advance(80); assert.deepEqual(heard, [], 'held while the finger is down');
    gate.release(); advance(5); assert.deepEqual(heard, [], 'held after the release, until the click');
    gate.clicked(); gate.leaves();          // capture, then the bubble phase reaches window
    advance(0); assert.deepEqual(heard, [true]);
  });
  it('"Leave without saving?" → the guard stopped the click, so it never bubbled: the entry IS consumed', () => {
    const { gate, heard, exit, advance } = setup();
    gate.press(); exit(); gate.release();
    gate.clicked();                         // no leaves(): the guard stopped propagation
    advance(0); assert.deepEqual(heard, [false]);
  });
  it('a tap on the page (not a link) closes the menu: consumed, one macrotask after its click', () => {
    const { gate, heard, exit, advance } = setup();
    gate.press(); exit(); gate.release(); gate.clicked();
    assert.deepEqual(heard, [], 'not inside the click itself');
    advance(0); assert.deepEqual(heard, [false]);
  });
  it('an exit that arrives after the release but before its click is held too (a late cleanup)', () => {
    const { gate, heard, exit, advance } = setup();
    gate.press(); gate.release(); exit();
    gate.clicked(); gate.leaves(); advance(0);
    assert.deepEqual(heard, [true]);
  });
  it('a sheet that closes DURING its own click (its × or Save) settles after the click, as it always did', () => {
    const { gate, heard, exit, advance } = setup();
    gate.press(); gate.release(); gate.clicked(); exit();   // the React handler closes it
    advance(0); assert.deepEqual(heard, [false]);
  });
  it('a press that makes no click (a drag) settles after the grace, as a stay; a cancel settles at once', () => {
    const a = setup();
    a.gate.press(); a.exit(); a.gate.release();
    a.advance(PRESS_CLICK_GRACE_MS - 1); assert.deepEqual(a.heard, []);
    a.advance(1); assert.deepEqual(a.heard, [false]);
    const b = setup();
    b.gate.press(); b.exit(); b.gate.cancel(); b.advance(0);
    assert.deepEqual(b.heard, [false]);
  });
  it('a new press settles what an earlier press left held — one press\'s click never answers for another\'s exits', () => {
    const { gate, heard, advance } = setup();
    const a: boolean[] = [], b: boolean[] = [];
    gate.press(); gate.exit(l => a.push(l)); gate.release();   // a drag closed A — no click yet
    advance(100);
    gate.press(); assert.deepEqual(a, [false], 'A settled as a stay the moment the next press began');
    gate.exit(l => b.push(l)); gate.release(); gate.clicked(); gate.leaves(); advance(0);
    assert.deepEqual(b, [true], 'B heard its own leaving click');
    assert.deepEqual(a, [false], 'and A was not told about it');
    assert.deepEqual(heard, []);
  });
  it('a lost release: the next press settles what the first held', () => {
    const { gate, heard, exit } = setup();
    gate.press(); exit();
    gate.press(); assert.deepEqual(heard, [false]);
  });
  it('"left" lives for ONE click: a later exit — by a save, a timer, Escape, or the NEXT tap — is never told a stale one', () => {
    const { gate, heard, exit, advance } = setup();
    gate.clicked(); gate.leaves(); advance(0);   // a leaving click with nothing held (a door inside a sheet)
    exit(); advance(0);
    assert.deepEqual(heard, [false], 'an exit with nothing under way');
    gate.press(); exit(); gate.release(); gate.clicked(); advance(0);   // the next tap, not a link
    assert.deepEqual(heard, [false, false], 'the next tap\'s click did not leave');
  });
  it('with nothing under way, an exit settles one macrotask on, not inside the call', () => {
    const { heard, exit, advance } = setup();
    exit(); assert.deepEqual(heard, []);
    advance(0); assert.deepEqual(heard, [false]);
  });
});

describe('the hook wires the gate — five listeners, and the marker kept while an exit is held', () => {
  const hook = readCode('components/coaches/useBackStep.ts');
  it('the press, its release, a cancel and the click\'s start are CAPTURE listeners — each checked in its own statement', () => {
    for (const [ev, call] of [['pointerdown', 'press'], ['pointerup', 'release'], ['pointercancel', 'cancel'], ['click', 'clicked']] as const) {
      assert.match(hook, new RegExp(`window\\.addEventListener\\('${ev}', \\(\\) => gate\\.${call}\\(\\), true\\);`), `${ev} → gate.${call}(), capture`);
    }
  });
  it('"it left the page" is read in the BUBBLE phase, so a click the unsaved-changes guard stopped does not count', () => {
    const at = hook.indexOf('if (leaves) gate.leaves();');
    assert.ok(at > 0, 'the bubble listener calls gate.leaves()');
    assert.ok(hook.lastIndexOf("window.addEventListener('click', event => {", at) > 0, 'inside a click listener');
    // The line that closes that listener — the very next one — carries no capture flag.
    const after = hook.slice(at).split('\n');
    assert.equal(after[1].trim(), '});', 'the listener closes with no third argument — the bubble phase');
  });
  it('the step\'s exit goes through the gate and consumes only when the tap did not leave', () => {
    assert.match(hook, /reg\.gate!\.exit\(left => \{[\s\S]{0,160}if \(left\) return;\s*if \(stepOf\(window\.history\.state\) !== step\.seq\) return;\s*window\.history\.back\(\);/);
  });
  it('while held, the entry keeps its marker — the replaceState wrapper reads the closing steps too, their address already given up', () => {
    assert.match(hook, /const step = liveStep\(reg\.steps\) \?\? liveStep\(reg\.closing \?\? \[\]\);/);
    assert.match(hook, /const closing: Step = \{ \.\.\.step, address: null \};\s*reg\.closing\?\.push\(closing\);/);
  });
  it('a registry kept across a hot reload gains the gate on first use', () => {
    assert.match(hook, /if \(!reg\.gate\) watchPresses\(reg\);/);
  });
});
