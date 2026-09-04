/**
 * AN UNANSWERED QUESTION SUSPENDS THE WALK — AND BOTH HALVES MUST ASK ONE NODE.
 *
 * A room (`RoomShell`) can hold a question: a delete's confirm, a payment's Remove, a tag manager's
 * "merge these two?". While one is open, stepping to another record ANSWERS IT BY ABANDONING IT —
 * the dialog vanishes, nothing is written, and nothing tells the coach their question was dropped.
 * So the walk is suspended while a question is open.
 *
 * ⚠⚠ THAT SUSPENSION IS IMPLEMENTED TWICE, AND THE TWO HALVES DRIFTED ON THE DAY THEY WERE WRITTEN.
 * The MOUSE half is a stylesheet rule (no script can hide a control from a pointer as cheaply); the
 * KEYBOARD half is in `useDialogFloor`, because ← / → are bound in JS and no stylesheet can reach a
 * key binding. Both shipped 2026-09-04 with a comment saying "change one, change both" — and they
 * were already inconsistent when that comment was written:
 *
 *   · the CSS was anchored on `.footDoors`, so it only saw a question docked in the pinned FOOT;
 *   · the JS queried the whole panel, so it suspended on ANY `alertdialog` in the room.
 *
 * A question in the room's BODY therefore satisfied one half and not the other. The keys went
 * silently dead while Prev / Next stayed on screen, looking live and still clickable — so a MOUSE
 * could do the exact thing the mechanism exists to prevent. It was reachable, not theoretical: the
 * bill room's Tags field opens the tag manager in place (no portal, a true descendant of the panel)
 * and its delete/merge confirm is an `alertdialog` nowhere near the foot.
 *
 * A comment could not hold this, so the rule is stated once, here: **both halves must anchor on the
 * SAME node — the room panel — and neither may be scoped to the foot.** Re-scoping either one fails
 * the build, and that failure is the conversation.
 *
 * ⚠ THIS IS NOT A RULE ABOUT THE FOOT'S OTHER CONTROLS. `.footDoors` staying foot-scoped is correct
 * and deliberate: "a question replaces the controls it suspends" is about the band a question is
 * docked in. The WALK is different — it is suspended by a question asked ANYWHERE in the room,
 * because stepping away abandons it wherever it was asked. The two rules are allowed to differ;
 * what is forbidden is the WALK rule quietly acquiring the FOOT rule's scope.
 *
 * Same shape as `room-address-keys-guard.test.ts` and `budget-line-kind-guard.test.ts`: every
 * scanner carries a PROBE proving it can still see the offence, so a green run is never a run that
 * looked at nothing.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE ANYTHING IS SCANNED. Both files quote these selectors at length in
 * prose — including the DEFECTIVE spelling, on purpose, so the next reader knows what went wrong.
 * A scan that read the comments would pass on the very text describing the bug.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CSS_PATH = join(ROOT, 'components', 'coaches', 'RoomShell.module.css');
const FLOOR_PATH = join(ROOT, 'components', 'coaches', 'useDialogFloor.ts');

/** Block comments (both files) and line comments (the TS one). Prose must never satisfy a scan. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

/** The stylesheet rules that hide the walk. `\b` keeps `.navBtn` / `.navLabel` / `.navCount` out. */
function walkHidingRules(css: string): string[] {
  return code(css)
    .split('}')
    .map(r => r.trim())
    .filter(r => /\.nav\b/.test(r) && /display:\s*none/.test(r));
}

/** Does the keyboard half refuse to walk while the PANEL holds a question? */
function keyboardGuardsOnPanel(ts: string): boolean {
  return /panel\.querySelector\(\s*['"`]\[role="alertdialog"\]['"`]\s*\)/.test(code(ts));
}

const CSS = readFileSync(CSS_PATH, 'utf8');
const FLOOR = readFileSync(FLOOR_PATH, 'utf8');

describe('a room’s walk is suspended by a question — and both halves ask one node', () => {
  it('the stylesheet hides the walk exactly once, anchored on the room panel', () => {
    const rules = walkHidingRules(CSS);
    assert.equal(
      rules.length, 1,
      `expected exactly one rule hiding the walk, found ${rules.length}: ${JSON.stringify(rules)}`,
    );
    assert.match(
      rules[0], /\.room:has\(\s*\[role="alertdialog"\]\s*\)/,
      'the walk-hiding rule must be anchored on `.room:has([role="alertdialog"])` — the same element '
      + '`useDialogFloor` holds as `panel`. Anchoring it anywhere narrower is the 2026-09-04 defect.',
    );
  });

  it('the walk-hiding rule is NOT scoped to the foot — that was the defect', () => {
    const [rule] = walkHidingRules(CSS);
    assert.doesNotMatch(
      rule, /\.footDoors/,
      'the walk must be suspended by a question asked ANYWHERE in the room, not only by one docked '
      + 'in the foot. A body-level question (the tag manager’s delete/merge confirm) reaches the '
      + 'keyboard half and would not reach this one.',
    );
  });

  it('the keyboard half refuses the walk while the PANEL holds a question', () => {
    assert.ok(
      keyboardGuardsOnPanel(FLOOR),
      '`useDialogFloor` must return early when `panel.querySelector(\'[role="alertdialog"]\')` finds '
      + 'a question. Without it, ← / → step to another record and abandon it unanswered.',
    );
  });

  /* ── The probes: each scanner must still be able to FAIL ──────────────────────────────────── */

  it('probe — the CSS scanner sees the defective foot-scoped spelling', () => {
    const broken = CSS.replace(
      '.room:has([role="alertdialog"]) .foot > .nav { display: none; }',
      '.foot:has(.footDoors > [role="alertdialog"]) > .nav { display: none; }',
    );
    assert.notEqual(broken, CSS, 'probe did not mutate anything — the rule was respelled, fix the probe');
    const [rule] = walkHidingRules(broken);
    assert.match(rule, /\.footDoors/, 'the scanner must be able to see the foot-scoped spelling');
    assert.doesNotMatch(rule, /\.room:has/, 'the scanner must not read the defective rule as anchored on the panel');
  });

  it('probe — the CSS scanner sees the rule going missing altogether', () => {
    const broken = CSS.replace('.room:has([role="alertdialog"]) .foot > .nav { display: none; }', '');
    assert.equal(walkHidingRules(broken).length, 0, 'a deleted rule must read as zero, not as a pass');
  });

  it('probe — the keyboard scanner sees the guard going missing', () => {
    const broken = FLOOR.replace(/panel\.querySelector\(\s*['"`]\[role="alertdialog"\]['"`]\s*\)/, 'false');
    assert.notEqual(broken, FLOOR, 'probe did not mutate anything — the guard was respelled, fix the probe');
    assert.equal(keyboardGuardsOnPanel(broken), false, 'the scanner must be able to see the guard missing');
  });

  it('probe — comments alone never satisfy either scanner', () => {
    const proseOnly = '/* .room:has([role="alertdialog"]) .foot > .nav { display: none; } */';
    assert.equal(walkHidingRules(proseOnly).length, 0, 'a rule quoted in a comment is not a rule');
    assert.equal(
      keyboardGuardsOnPanel('// if (panel.querySelector(\'[role="alertdialog"]\')) return;'),
      false,
      'a guard quoted in a comment is not a guard',
    );
  });
});
