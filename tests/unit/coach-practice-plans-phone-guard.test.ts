import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSource, stripComments } from './_source-code.ts';
import { blockWalk } from '../../lib/rep-practice-plan.ts';

describe('blockWalk — the sheet’s walk through the plan', () => {
  const blocks = [
    { id: 'a', title: 'Warm-up', duration: { minutes: 15 } },
    { id: 'b', title: '  ', duration: { minutes: 45 } },
    { id: 'c', title: 'Small-sided game', duration: { minutes: null, restOfPractice: true } },
  ];
  it('stops at the ends and names an untitled block by its place', () => {
    assert.deepEqual(blockWalk(blocks, 'a'), { prev: null, next: { id: 'b', label: 'Block 2' }, index: 1, total: 3 });
    assert.deepEqual(blockWalk(blocks, 'c'), { prev: { id: 'b', label: 'Block 2' }, next: null, index: 3, total: 3 });
    assert.deepEqual(blockWalk(blocks, 'gone'), { prev: null, next: null, index: 0, total: 3 });
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * PRACTICE PLANS ON A PHONE · STAGE 1 — the block on its own screen (owner ruling K1–K4 = A,
 * 2026-09-23; plan docs/projects/active/COACH_PRACTICE_PLANS_PHONE_PLAN.md §6)
 *
 *   K1 **ON A PHONE THE PLAN IS A LIST.** A shut block is its title and ONE line of facts that fit
 *      (length · who runs it · the count) with a chevron — never the two cut sentences a 234px
 *      column made of "what you're doing" and "watching for" — and no reorder pair under the clock.
 *   K2 **THE OPEN BLOCK IS A FULL-SCREEN SHEET**, the shape its own station form already had: the
 *      fields at the sheet's width (197px → 359px measured), the block's place and clock in the head,
 *      a walk to the neighbouring blocks and Done in the foot. The body is `BlockCard`'s OWN — one
 *      copy of the fields, two containers — and the timeline shows every block shut meanwhile.
 *   K3 **MOVE UP · MOVE DOWN · DELETE ON THE SHEET'S HEAD** — the pair left the gutter, which is
 *      what let the clock column narrow from 5.75rem to 5rem.
 *   K4 **"+ ADD A BLOCK" IS ONE ROW** once the plan has a block; a new, still-blank block offers
 *      "Start from a drill ›" under its title.
 *
 * Decided in JS (`useIsPhone`), never CSS: the two presentations differ in STRUCTURE. The desktop
 * and the 641–768 band keep the block open in place — measured unchanged at 1440 after the build.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const EDITOR = 'app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx';
const CSS = 'app/[orgSlug]/coaches/coaches.module.css';
const src = stripComments(readSource(EDITOR));
const css = readSource(CSS);

/** The body of a top-level function, from its declaration to the next top-level `function`. */
function fn(name: string): string {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const next = src.indexOf('\nfunction ', start + 10);
  const nextExport = src.indexOf('\nexport default function ', start + 10);
  const ends = [next, nextExport].filter(i => i > 0);
  return src.slice(start, ends.length ? Math.min(...ends) : undefined);
}

describe('practice plans on a phone · stage 1 (K1–K4)', () => {
  it('the phone decision is made in JS, and never for the circuit editor', () => {
    assert.match(src, /import \{ useIsPhone \} from '@\/lib\/hooks\/useIsPhone'/);
    assert.match(src, /const phoneSheet = useIsPhone\(!soloBlock\);/);
  });

  it('K1 — the phone row drops the two sentence lines, adds a chevron, and opens a dialog', () => {
    const card = fn('BlockCard');
    assert.match(card, /\{!phone && firstLine && <span className=\{styles\.ppTlDesc\}>/);
    assert.match(card, /\{!phone && watchingFor && <span className=\{styles\.ppTlWatch\}>/);
    assert.match(card, /\{phone && <ChevronRight[^>]*className=\{styles\.ppTlRowChevron\}/);
    assert.match(card, /'aria-haspopup': 'dialog'/);
    // The facts line leads with the length the gutter gave up, and never with a sentence.
    assert.match(card, /const phoneFacts = phone \? \[/);
    assert.match(card, /\{clock && !phone && <small>/);
  });

  it('K1 · K3 — no reorder pair and no drag on a phone', () => {
    const card = fn('BlockCard');
    assert.match(card, /const canDrag = !readOnly && !solo && !phone && !sheet && blockCount > 1;/);
    // The pair only renders inside `canDrag`, so the line above is the whole gate.
    assert.match(card, /\{canDrag && \(\s*<span className=\{styles\.ppTlMove\}/);
  });

  it('K2 — every block reads shut in the timeline while the phone sheet holds the open one', () => {
    assert.match(src, /open=\{soloBlock \|\| \(!phoneSheet && openId === block\.id\)\}/);
    assert.match(src, /openDoors=\{soloBlock \|\| \(!phoneSheet && openId === block\.id\) \? openDoors : NO_DOORS\}/);
    assert.match(src, /\{sheetBlock && sheetWalk && \(/);
    assert.match(src, /sheet=\{\{ walk: sheetWalk \}\}/);
  });

  it('K2 — ONE wiring for the row and the sheet, so the two cannot drift', () => {
    const uses = src.match(/<BlockCard \{\.\.\.blockCardProps\(/g) ?? [];
    assert.equal(uses.length, 2, 'the timeline row and the phone sheet both spread blockCardProps');
    assert.equal((src.match(/<BlockCard\b/g) ?? []).length, 2, 'no third, hand-wired BlockCard');
  });

  it('K2 — the sheet is a real dialog on the floor, with the walk, Done and the body keyed per block', () => {
    const sheet = fn('BlockSheet');
    assert.match(sheet, /useDialogFloor\(true, panelRef, \{/);
    assert.match(sheet, /walk: \{ prev: walk\.prev\?\.id \?\? null, next: walk\.next\?\.id \?\? null, onSelect: walk\.onSelect \}/);
    assert.match(sheet, /role="dialog" aria-modal="true"/);
    assert.match(sheet, /<RoomWalkNav nav=\{walk\} \/>/);
    assert.match(sheet, />Done<\/button>/);
    assert.match(sheet, /<div key=\{bodyKey\} className=\{`\$\{styles\.ppTlOpen\} \$\{styles\.ppBlockSheetBody\}`\}>/);
    // It covers the nav as every form does, and takes it out of reach while up.
    assert.match(src, /useOverlayOpen\([^)]*!!sheetBlock\)/);
  });

  it('K2 — the sheet mounts BEFORE the station modal, so every door inside a block opens over it', () => {
    const sheetAt = src.indexOf('{sheetBlock && sheetWalk && (');
    const stationAt = src.indexOf('<StationModal');
    const groupsAt = src.indexOf('<PracticeGroupsRoom');
    assert.ok(sheetAt > 0 && sheetAt < stationAt && sheetAt < groupsAt);
  });

  it('K3 — Move up · Move down · Delete sit on the sheet head, stopped at the ends', () => {
    const sheet = fn('BlockSheet');
    // The walk is the one source for the ends — the same shared arithmetic the station walk uses.
    assert.match(sheet, /aria-label=\{`Move \$\{label\} up`\}\s*disabled=\{!walk\.prev\}/);
    assert.match(sheet, /aria-label=\{`Move \$\{label\} down`\}\s*disabled=\{!walk\.next\}/);
    assert.match(src, /\.\.\.blockWalk\(plan\.blocks, sheetBlock\.id\)/);
    assert.match(sheet, /aria-label=\{`Delete \$\{label\}`\}/);
    // Delete from the sheet closes it — the block it showed is gone.
    assert.match(src, /if \(openId === block\.id\) openBlock\(null\);/);
  });

  it('K4 — one add row on a phone once the plan has a block; the blank plan keeps its ghost row', () => {
    assert.match(src, /const phoneAddRow = phoneSheet && !firstBlock;/);
    assert.match(src, /\{canAddBlock && phoneAddRow && \(/);
    assert.match(src, /className=\{styles\.ppTlAddRow\} data-pp-add-row onClick=\{addBlock\}/);
    // Closing the sheet lands focus on the block last shown, else an add row — both add rows carry
    // the marker, or deleting the ONLY block strands focus on <body> (/review, 2026-09-23).
    assert.equal((src.match(/data-pp-add-row onClick=\{addBlock\}/g) ?? []).length, 2);
    assert.match(src, /document\.getElementById\(`block-\$\{id\}`\)\?\.querySelector<HTMLElement>\('button'\)/);
    assert.match(src, /\{canAddBlock && !phoneAddRow && \(/);
  });

  it('K4 — "Start from a drill" only on a new, still-blank block, and the title takes the cursor', () => {
    assert.match(src, /const sheetIsBlank = !!sheetBlock && freshId === sheetBlock\.id && isUntouchedNewBlock\(sheetBlock\);/);
    // "Blank" is every field untouched — the /review data-loss finding: players, staff or a length
    // set before a title must never be discarded by the swap.
    const blank = fn('isUntouchedNewBlock');
    assert.match(blank, /Object\.entries\(block\)\.every/);
    assert.match(blank, /d\.minutes === DEFAULT_BLOCK_MINUTES/);
    const card = fn('BlockCard');
    assert.match(card, /\{sheet && onStartFromDrill && \(/);
    assert.match(card, /if \(sheet && open && focusTitle\) titleRef\.current\?\.focus\(\);/);
  });

  it('the stylesheet: the phone gutter is the clock alone, and the eyebrow is never uppercased', () => {
    assert.match(css, /\.ppTl \{ --pp-gutter-w: 5rem; \}/);
    assert.doesNotMatch(css, /\.ppTl \{ --pp-gutter-w: 5\.75rem; \}/);
    const eyebrow = css.slice(css.indexOf('.ppBlockSheetEyebrow {'), css.indexOf('}', css.indexOf('.ppBlockSheetEyebrow {')));
    assert.ok(eyebrow.length > 0);
    assert.doesNotMatch(eyebrow, /text-transform/, 'the eyebrow carries a clock — "P.M." is not the house spelling');
    assert.match(css, /\.ppTlOpen\.ppBlockSheetBody \{ margin: 0; border: 0; border-radius: 0; background: none; \}/);
    assert.match(css, /\.ppBlockSheet \.modalFooter \.btnPrimary \{ min-height: var\(--tap-min, 44px\);/);
  });
});
