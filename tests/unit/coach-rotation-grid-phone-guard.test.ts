import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode, splitPhoneCss } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * PRACTICE PLANS ON A PHONE · THE ROTATION TABLE (owner ruling T1 = A · T2 = A, 2026-09-24;
 * plan docs/projects/active/COACH_PRACTICE_PLANS_PHONE_PLAN.md §6d)
 *
 *   T1 **THE SAME TABLE, MADE TO FIT.** The desk's way round (D6) is kept on a phone — the drawing
 *      of the table TURNED fitted one station fewer, because a station name's longest word needs a
 *      wider column than a clock on two lines. What changes ≤640: no 22rem floor, both modes sized
 *      to content, the clock at its narrowest (it breaks at its space), headings wrap between words
 *      only, a group's name never wraps — and when it still cannot fit, `CoachScrollX` SAYS so.
 *      Measured before: 404px in 359 editing at 390, 352 in 329 reading at 360, with no hint.
 *   T2 **WHILE EDITING, A GROUP IS A TILE WITH NO GRIP** on a phone — the grip's width is most of
 *      what pushed a third station off the sheet; the tap menu is the phone's path (D14).
 *
 * And the side finding fixed with it: a phone rule meant for the block's minutes row hid EVERY
 * `.ppClockSep`, so the groups read back ran "Group A#1 Avery Test".
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const EDITOR = 'app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx';
const CSS = 'app/[orgSlug]/coaches/coaches.module.css';
const MENU = 'components/coaches/CoachToolbarMenu.tsx';
const src = readCode(EDITOR);
const css = readCode(CSS);
const menu = readCode(MENU);
const fn = (name: string): string => functionBody(src, name);
const { phone, rest: desk } = splitPhoneCss(css);

describe('the rotation table on a phone (T1 · T2)', () => {
  it('a phone grid scrolls in CoachScrollX, with a hint naming what is off to the side', () => {
    const board = fn('RotationBoard');
    assert.match(board, /const phone = useIsPhone\(!withoutPeople\);/);
    assert.match(board, /phone\s*\?\s*<CoachScrollX hint="Swipe the table to see every station"/);
    // The desk keeps its own scroller ("phones only").
    assert.match(board, /:\s*<div className=\{styles\.ppGridScroll\}>\{gridBody\}<\/div>/);
  });

  it('the desk grid is untouched: its floor, fixed columns and max-content pills stay', () => {
    assert.match(css, /\.ppGrid \{[^}]*min-width: 22rem;/);
    assert.match(css, /\.ppGridCols \{ table-layout: fixed; \}/);
    assert.match(css, /\.ppGridPills \{ table-layout: auto; width: max-content; min-width: 100%; \}/);
  });

  it('≤640 the table sizes to its content, with no floor, in both modes', () => {
    assert.match(phone, /\.ppGridCols \{ table-layout: auto; width: 100%; min-width: 0; \}/);
    // The clock at its narrowest; a heading wraps between WORDS (anywhere would collapse min-content).
    assert.match(phone, /\.ppGridCols thead th:first-child, \.ppGridCols tbody th \{ width: 1%; \}/);
    assert.match(phone, /\.ppGridCols thead th \{[^}]*white-space: normal; overflow-wrap: normal;/);
    // A group's name never breaks.
    assert.match(phone, /\.ppGridCols tbody td \{ white-space: nowrap; overflow-wrap: normal; \}/);
  });

  it('≤640 a group while editing is a tile with no grip — styled through a class the grid owns', () => {
    const pill = fn('GridPill');
    assert.match(pill, /triggerClassName=\{styles\.ppGridTile\}/);
    assert.match(pill, /className=\{styles\.ppGridGrip\}/);
    // Each state names its HOVER twin: a phone keeps :hover on a tapped button, and the chip's own
    // `.triggerChip:hover:not(:disabled)` is (0,3,0) — two classes deep lost to it (/review, 2026-09-24).
    assert.match(phone, /\.ppGridCols \.ppGridTile, \.ppGridCols \.ppGridTile:hover:not\(:disabled\) \{[^}]*border-radius: 0\.55rem;/);
    assert.match(phone, /\.ppGridCols \.ppGridTile\[aria-expanded='true'\], \.ppGridCols \.ppGridTile\[aria-expanded='true'\]:hover:not\(:disabled\) \{/);
    assert.match(phone, /\.ppGridCols \.ppGridGrip \{ display: none; \}/);
    // The tile and grip rules exist ONLY on a phone — the desk's pill keeps its grip.
    assert.doesNotMatch(desk, /\.ppGridTile\b/);
    assert.doesNotMatch(desk, /\.ppGridGrip\b/);
  });

  it('the shared menu appends a caller class to its trigger, after the variant', () => {
    assert.match(menu, /triggerClassName\?: string;/);
    assert.match(menu, /\$\{triggerClassName \? ` \$\{triggerClassName\}` : ''\}/);
  });
});

describe('the separator dot on a phone', () => {
  it('only the minutes row and the rotation strip drop their dots; every other separator stays', () => {
    // The minutes row, and the rotation strip — whose dots are flex items that strand on a wrap.
    assert.match(phone, /\.ppClockRow \.ppClockSep, \.ppRotStrip \.ppClockSep \{ display: none; \}/);
    // A rule whose selector STARTS with the dot's class — i.e. not qualified by its row.
    assert.doesNotMatch(css, /(^|[;{}])\s*\.ppClockSep \{ display: none; \}/m,
      'a bare .ppClockSep hide makes the groups read back run "Group A#1 Avery Test"');
  });
});
