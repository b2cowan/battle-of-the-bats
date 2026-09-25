import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode, splitPhoneCss } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * PRACTICE PLANS ON A PHONE · THE GROUPS ROOM (owner rulings G1 = A · G2 = A · G3 = A, 2026-09-24;
 * plan docs/projects/active/COACH_PRACTICE_PLANS_PHONE_PLAN.md §6c)
 *
 *   G1 **ONCE GROUPS EXIST, THE DRAW FOLDS TO ONE LINE** on a phone — "⤮ 3 groups · from who
 *      replied · Change ›" — that opens today's controls in place. The line NEVER draws: a stray
 *      tap cannot reshuffle anyone. A block with no groups opens with the controls showing.
 *   G2 **A GROUP'S HEAD IS ITS NAME AND COUNT WITH A ⋯** — Rename (the name becomes a box in
 *      place; Enter / Escape / leaving it ends the rename, and Escape does not close the room) and
 *      Delete (its players go to Not in a group — no question, nothing is lost).
 *   G3 **THE CHIPS DROP THEIR ⠿ DOTS** and tighten their sides; tap and hold are unchanged.
 *
 * Measured at 390 on the fixture: the third group went from starting under the bar to ending
 * above it. The desk keeps the draw row, the name boxes, the bins and the dots.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOM = 'components/coaches/PracticeGroupsRoom.tsx';
const CSS = 'app/[orgSlug]/coaches/coaches.module.css';
const src = readCode(ROOM);
const room = functionBody(src, 'PracticeGroupsRoom');
const head = functionBody(src, 'PhoneGroupHead');
const chip = functionBody(src, 'PlayerChip');
const { phone, rest: desk } = splitPhoneCss(readCode(CSS));

describe('the Groups room on a phone (G1 · G2 · G3)', () => {
  it('the phone decision is made once, for the room — never per chip', () => {
    assert.match(room, /const phone = useIsPhone\(\);/);
    assert.doesNotMatch(chip, /useIsPhone/);
  });

  it('G1 — the draw folds on a phone once groups exist; the summary line only opens and closes it', () => {
    assert.match(room, /const showDraw = !phone \|\| groups\.length === 0 \|\| drawOpen;/);
    assert.match(room, /\{phone && groups\.length > 0 && \(\s*<button type="button" className=\{styles\.ppDrawSummary\} aria-expanded=\{drawOpen\} aria-controls=\{drawId\}\s*onClick=\{\(\) => setDrawOpen\(v => !v\)\}>/);
    assert.match(room, /\{showDraw && \(\s*<div id=\{drawId\} className=\{styles\.ppDrawRow\}>/);
    // The only thing that deals groups is still the draw row's own button.
    assert.equal(room.split('drawGroups(').length - 1, 1, 'one place draws');
  });

  it('G2 — a phone head is name · count with a ⋯ for Rename and Delete; the desk keeps its box and bin', () => {
    assert.match(room, /head=\{phone \? \(\s*<PhoneGroupHead /);
    assert.match(room, /aria-label=\{`Remove \$\{group\.name\}`\}/);   // the desk's bin, still there
    assert.match(head, /<CoachToolbarMenuItem label=\{`Rename \$\{label\}`\} onSelect=\{onStartRename\} \/>/);
    assert.match(head, /<CoachToolbarMenuItem label=\{`Delete \$\{label\}`\} onSelect=\{onDelete\} \/>/);
    assert.match(head, /\{label\}<span className=\{styles\.ppGroupHeadingCount\}>&nbsp;· \{group\.playerIds\.length\}<\/span>/);
  });

  it('G2 — renaming is a box in place: it owns its Escape, and leaving it never steals focus', () => {
    assert.match(head, /data-escape-owner=""/);
    assert.match(head, /onBlur=\{\(\) => onEndRename\(false\)\}/);
    assert.match(head, /if \(e\.key !== 'Enter' && e\.key !== 'Escape'\) return;\s*e\.preventDefault\(\);\s*onEndRename\(true\);/);
  });

  it('G2 — Delete asks nothing (the players go to Not in a group) and focus lands on a neighbour', () => {
    const del = room.slice(room.indexOf('const deleteGroup'), room.indexOf('const endRename'));
    assert.match(del, /removeGroup\(groupId\);/);
    assert.doesNotMatch(del, /confirm/i);
    assert.match(del, /groups\[at \+ 1\] \?\? groups\[at - 1\] \?\? null/);
  });

  it('G3 — the chip drops its dots on a phone only, through classes the room owns', () => {
    assert.match(chip, /triggerClassName=\{styles\.ppGroupChipTrigger\}/);
    assert.match(chip, /className=\{styles\.ppGroupGrip\}/);
    assert.match(phone, /\.ppGroupCols \.ppGroupGrip \{ display: none; \}/);
    assert.match(phone, /\.ppGroupCols \.ppGroupChipTrigger \{ padding-inline: 0\.5rem; \}/);
    assert.doesNotMatch(desk, /\.ppGroupGrip\b/);
    assert.doesNotMatch(desk, /\.ppGroupChipTrigger\b/);
  });

  it('§231 walk — no Done on a phone: the head’s ← closes; "+ Add a group" is pinned left; a full room has no foot', () => {
    // Owner 2026-09-25: "remove the done from the group screen". It only closed the room (the ← and
    // the back gesture do) — the groups save as they change. A desk keeps it beside its ×.
    assert.match(room, /\{!phone && <button type="button" className=\{styles\.btnPrimary\} onClick=\{onClose\}>Done<\/button>\}/);
    assert.match(room, /\{\(!phone \|\| groups\.length < MAX_GROUPS\) && \(/);
    // Left, so "+ Add a group" never lands where a thumb used to find Done.
    assert.match(phone, /\.ppGroupsRoom \.modalFooter \{ justify-content: flex-start; \}/);
    assert.doesNotMatch(desk, /\.ppGroupsRoom \.modalFooter/);
  });
});
