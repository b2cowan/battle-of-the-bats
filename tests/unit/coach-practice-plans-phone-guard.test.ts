import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode, readSource, stripComments } from './_source-code.ts';
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
 *      a walk to the neighbouring blocks in the foot (its Done left on the §231 walk, 2026-09-25 —
 *      the head's ← is the way back). The body is `BlockCard`'s OWN — one
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

  it('the grip under the time — one handle at every width, no ▲▼ pair anywhere (owner, 09-24)', () => {
    const card = fn('BlockCard');
    assert.match(card, /const canMove = !readOnly && !solo && !sheet && blockCount > 1;/);
    // The gutter is the handle; the grip inside it is the tap/click menu — no arrows.
    assert.match(card, /<div ref=\{setHandleRef\} \{\.\.\.\(canMove \? handleListeners : \{\}\)\}/);
    assert.match(card, /\{canMove && \(\s*<span className=\{styles\.ppTlMove\}>\s*<CoachToolbarMenu label=\{`Move \$\{label\}`\} variant="glyph"/);
    assert.doesNotMatch(card, /aria-label=\{`Move \$\{label\} up`\}/);
  });

  it('K2 — every block reads shut in the timeline while the phone sheet holds the open one', () => {
    assert.match(src, /open=\{soloBlock \|\| \(!phoneSheet && openId === block\.id\)\}/);
    assert.match(src, /openDoors=\{soloBlock \|\| \(!phoneSheet && openId === block\.id\) \? openDoors : NO_DOORS\}/);
    assert.match(src, /\{sheetBlock && sheetWalk && \(/);
    assert.match(src, /sheet=\{\{ walk: sheetWalk, onward: sheetOnward, onAdd: !readOnly && canAddBlock \? addBlock : undefined, onEdit, onDoneEditing \}\}/);
  });

  it('K2 — ONE wiring for the row and the sheet, so the two cannot drift', () => {
    const uses = src.match(/<BlockCard \{\.\.\.blockCardProps\(/g) ?? [];
    assert.equal(uses.length, 2, 'the timeline row and the phone sheet both spread blockCardProps');
    assert.equal((src.match(/<BlockCard\b/g) ?? []).length, 2, 'no third, hand-wired BlockCard');
  });

  it('K2 — the sheet is a real dialog on the floor, with the walk and the body keyed per block', () => {
    const sheet = fn('BlockSheet');
    assert.match(sheet, /useDialogFloor\(true, panelRef, \{/);
    assert.match(sheet, /walk: \{ prev: walk\.prev\?\.id \?\? null, next: walk\.next\?\.id \?\? null, onSelect: walk\.onSelect \}/);
    assert.match(sheet, /role="dialog" aria-modal="true"/);
    // §227 walk, option C (owner 2026-09-23): the foot's walk is COMPACT ("‹ 2 of 3 ›") — a named
    // pair got ~7 letters a name at 390 — and the next block is named in full at the body's end.
    assert.match(sheet, /<RoomWalkNav nav=\{walk\} compact end=\{onAdd && \{ label: 'Add a block', onSelect: onAdd \}\} \/>/);
    assert.match(sheet, /<WalkOnward walk=\{walk\} noun="block" kicker=\{onward\.kicker\} meta=\{onward\.meta\} onAdd=\{onAdd\} \/>/);
    // §231 walk (owner 2026-09-25): NO Done in the foot — it only closed, which the head's ← does,
    // and it sat under ✓ "Done editing", which does the opposite. One block: nothing to walk, no foot.
    assert.doesNotMatch(sheet, />Done<\/button>/);
    assert.match(sheet, /\{walk\.total > 1 && \(\s*<div className=\{styles\.modalFooter\}>\s*<RoomWalkNav nav=\{walk\} compact end=\{[^}]*\}\} \/>\s*<\/div>/);
    assert.match(sheet, /<div key=\{bodyKey\} className=\{`\$\{styles\.ppTlOpen\} \$\{styles\.ppBlockSheetBody\}`\}>/);
    // It covers the nav as every form does, and takes it out of reach while up.
    assert.match(src, /useOverlayOpen\([^)]*!!sheetBlock\)/);
  });

  it('§227 option C — the next stop is named in full at the end; the station form follows on a phone only', () => {
    const onward = fn('WalkOnward');
    // Both steps are the walk's own — exactly the foot's arrows, never a second navigation.
    assert.match(onward, /walk\.onSelect\(walk\.next!\.id\)/);
    assert.match(onward, /walk\.onSelect\(walk\.prev!\.id\)/);
    assert.match(onward, /That’s the last \{noun\}\./);
    // One stop and nothing to add: no row. One stop that CAN add (the plan's first block): the row.
    assert.match(onward, /if \(walk\.total <= 1 && !onAdd\) return null;/);
    // The station form: compact + the onward row on a phone, the named pair kept on a desk.
    const station = fn('StationModal');
    assert.match(station, /const phone = useIsPhone\(\);/);
    assert.match(station, /\{phone && \(\s*<WalkOnward /);
    assert.match(station, /<RoomWalkNav nav=\{\{ \.\.\.walk, noun: 'stations', onSelect: onStep \}\} compact=\{phone\}\s*end=\{onAddStation && \{ label: 'Add a station', onSelect: onAddStation \}\} \/>/);
  });

  it('the LAST station adds one instead of dead-ending on "End" (owner, 2026-09-28)', () => {
    // "When I get to the end I should be able to add a station rather than just having a dead end."
    const station = fn('StationModal');
    assert.match(station, /kicker="Next station" meta=\{nextWho \|\| null\} onAdd=\{onAddStation\} \/>/);
    // The phone's end-of-body row: the fact, then the action — "Add a station", never the dead line.
    const onward = fn('WalkOnward');
    assert.match(onward, /\) : onAdd \? \(\s*<button type="button" className=\{styles\.ppWalkNext\} onClick=\{onAdd\}>/);
    // The block's own add, so the two can never add differently; never while reading or on a full block.
    assert.match(src, /onAddStation=\{!readOnly && \(openStationBlock\.stations\?\.length \?\? 0\) < MAX_STATIONS_PER_BLOCK\s*\? \(\) => addStationTo\(openStation\.blockId\) : undefined\}/);
    // A drill picked from inside the form is the station the form steps to.
    assert.match(src, /if \(openStation\?\.blockId === blockId\) setOpenStation\(\{ blockId, stationId: fresh\.id \}\);/);
    // The shared stepper: the end action takes the dead "End"'s place only when one is passed —
    // the money rooms pass none and keep it.
    const nav = stripComments(readSource('components/coaches/RoomShell.tsx'));
    assert.match(nav, /\{!nav\.next && end \? \(/);
    assert.match(nav, /\{nav\.next\?\.label \?\? 'End'\}/);
    assert.doesNotMatch(nav, /<RoomWalkNav nav=\{nav\} busy=\{busy\} end=/);
  });

  it('the LAST block on a phone adds one too — "it\'s the same workflow" (owner, 2026-09-28)', () => {
    // The list's own "+ Add a block" (`addBlock`: the end of the plan, opened, title focused) — never
    // while reading, never past MAX_BLOCKS, never in the circuit editor (it has no block sheet).
    assert.match(src, /onAdd: !readOnly && canAddBlock \? addBlock : undefined/);
    assert.match(src, /const canAddBlock = layout\.timeline && plan\.blocks\.length < MAX_BLOCKS;/);
    const card = fn('BlockCard');
    assert.match(card, /onAdd=\{sheet\.onAdd\}/);
    // The title's cursor is placed ONCE per new block — keyed on its id, never on the `sheet` object
    // (a new object every render: keyed on it, each keystroke in another field of a just-added block
    // was sent back into the title). The id re-places it when the add steps to the next new block.
    assert.match(card, /const inSheet = !!sheet;\s*useEffect\(\(\) => \{\s*if \(inSheet && open && focusTitle\) titleRef\.current\?\.focus\(\);\s*\}, \[inSheet, open, focusTitle, block\.id\]\);/);
    assert.doesNotMatch(card, /\}, \[sheet, open, focusTitle\]\);/);
  });

  it('K2 — the sheet mounts BEFORE the station modal, so every door inside a block opens over it', () => {
    const sheetAt = src.indexOf('{sheetBlock && sheetWalk && (');
    const stationAt = src.indexOf('<StationModal');
    const groupsAt = src.indexOf('<PracticeGroupsRoom');
    assert.ok(sheetAt > 0 && sheetAt < stationAt && sheetAt < groupsAt);
  });

  it('ONE anatomy — block sheet and station form: head toggle · name first · Delete at the end · the walk', () => {
    // Owner, §227 walk 2026-09-24: "aren't they effectively the same?" — they are now.
    const sheet = fn('BlockSheet');
    const station = fn('StationModal');
    // The block sheet is a phone's alone, so it always carries the toggle. The station form carries
    // it on a PHONE only (owner, 2026-09-28: "done editing in desktop can live only above the main
    // sheet", then no ✎ either — a lone ✎ put the bin under the pointer that pressed it). On a desk
    // the toolbar above the sheet is the one Edit / Done editing.
    assert.match(sheet, /<SheetEditToggle readOnly=\{readOnly\} onEdit=\{onEdit\} onDoneEditing=\{onDoneEditing\} \/>/, 'block sheet: the head\'s one control');
    assert.match(station, /\{phone && <SheetEditToggle readOnly=\{readOnly\} onEdit=\{onEdit\} onDoneEditing=\{onDoneEditing\} \/>\}/, 'station form: the toggle on a phone only');
    for (const [name, body] of [['block sheet', sheet], ['station form', station]]) {
      // The bin rides the head beside ✓ while writing (owner, 09-24: "so the user doesn't have to go
      // digging for the delete") — and it ASKS first, because the delete has no undo.
      assert.match(body, /\{!readOnly && \(?\s*<SheetDeleteButton label=\{label\}/, `${name}: the bin in the head, while writing`);
    }
    // NO Done in either foot, at any width: the phone's left on the §231 walk (owner 2026-09-25), the
    // desk station form's on 2026-09-28 (owner: "why do we have 2 done buttons?") — it only closed,
    // which × / ← and Escape do, and it sat under ✓ "Done editing", which does the opposite.
    assert.doesNotMatch(sheet, />Done<\/button>/, 'block sheet: no Done');
    assert.doesNotMatch(station, />Done<\/button>/, 'station form: no Done, a desk included');
    assert.match(station, /\{walk\.total > 1 && \(\s*<div className=\{`\$\{styles\.modalFooter\} \$\{styles\.ppSheetFoot\}`\}>/, 'station form: the walk alone, and no empty foot');
    // …and the desk's open card asks the same question (owner, 2026-09-24) — no bin deletes unasked.
    assert.match(fn('BlockCard'), /\{!readOnly && !solo && <SheetDeleteButton label=\{label\} message=\{deleteMessage\} onDelete=\{onDelete\} \/>\}/);
    const bin = fn('SheetDeleteButton');
    assert.match(bin, /const ok = await confirm\(\{ title: `Delete \$\{label\}\?`, message, confirmText: 'Delete', cancelText: 'Keep it', tone: 'danger' \}\);\s*if \(ok\) onDelete\(\);/);
    // The toggle is ONE button that flips in place; on a phone the glyph alone, the words its name.
    const toggle = fn('SheetEditToggle');
    assert.match(toggle, /const act = readOnly \? onEdit : onDoneEditing;/);
    assert.match(toggle, /aria-label=\{readOnly \? 'Edit' : 'Done editing'\}/);
    assert.match(css, /\.ppSheetEditWord \{ display: none; \}/);
    // Revising K3 (owner, stage 1b): a block moves from the LIST by its grip, never from inside it.
    assert.doesNotMatch(sheet, /Move \$\{label\} up/);
    assert.match(src, /\.\.\.blockWalk\(plan\.blocks, sheetBlock\.id\)/);
    // Delete from the sheet closes it — the block it showed is gone.
    assert.match(src, /if \(openId === block\.id\) openBlock\(null\);/);
  });

  it('1b · R1 — a plan opens to READ; only an empty upcoming plan opens to write', () => {
    const page = stripComments(readSource('app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx'));
    assert.match(page, /setEditing\(\s*!practiceIsRecord\(body\.event\?\.startsAt, Date\.now\(\), body\.event\?\.endsAt\)\s*&& !practiceHasPlan\(\{ practicePlan: body\.plan \?\? null \}\),\s*\);/);
    assert.match(page, /const reading = !editing;/);
    assert.match(page, /const writing = canWrite && !reading;/);
    // ✎ on a block and a station — only for a reader who may write.
    assert.match(page, /onEdit=\{canWrite && reading \? startEditing : undefined\}/);
    // ⚠ The save pill is NOT gated on `writing` (/review, 2026-09-24): "Done editing" does not stop
    // the autosave, so a save that fails after the press must still be able to say so.
    assert.match(page, /\{canWrite && \(!recordMode \|\| editedThisVisit \|\| dirty \|\| saving\) && !loading && !loadError && \(\s*<SaveStatusPill /);
    assert.doesNotMatch(page, /\{writing && !loading && !loadError && \(\s*<SaveStatusPill /);
    assert.match(page, /onDoneEditing=\{canWrite && !reading && \(hasBlocks \|\| isPracticeRecord\) \? \(\) => setEditing\(false\) : undefined\}/);
  });

  it('1b · R4 — a row moves by its GRIP: hold (or drag) to move, tap/click for Move up · Move down', () => {
    assert.match(src, /label="Move up" disabled=\{index === 0\}/);
    assert.match(src, /label="Move down" disabled=\{index === blockCount - 1\}/);
    // A finger lifts only on a phone that is writing, after a quarter-second hold — in the circuit
    // editor too, whose lone block has no grip but whose stations do (2026-09-24).
    assert.match(src, /const touchGrip = useIsPhone\(!readOnly\);/);
    // ⚠ ALWAYS two sensors: a list that changed length with the width crashed the page (09-24).
    assert.match(src, /activationConstraint: touchGrip \? \{ delay: 250, tolerance: 6 \} : \{ distance: Number\.POSITIVE_INFINITY \}/);
    assert.match(src, /const dragSensors = useSensors\(mouseSensor, touchSensor\);/);
    // The times preview the drop, from the SAME clock walk over the reordered list.
    assert.match(src, /walkBlockClocks\(next, eventStartsAt, eventEndsAt\)\.clocks/);
    // The plan runs edge to edge on a phone — the shell's gutter off, never a negative bleed.
    assert.match(css, /\.coachesMain:has\(\.ppSheetPair\) \{ padding-inline: 0; \}/);
    assert.match(css, /\.coachesMain:has\(\.ppSheetPair\) \.teamHeader \{ margin-inline: 0; \}/);
  });

  /* Owner, 2026-09-24, on the block sheet's station cards: "this should be drag and drop just like
     blocks are". The ‹ › pair became the block's grip one level down — the same two gestures on one
     glyph, in the ONE drag context, landing in slots between the columns of its own block only. */
  it('a station moves by its GRIP too: drag to a slot between columns, tap for Move earlier · Move later', () => {
    const grip = fn('StationGrip');
    assert.match(grip, /useDraggable\(\{\s*id: `station:\$\{blockId\}:\$\{stationId\}`/);
    assert.match(grip, /<CoachToolbarMenu label=\{`Move \$\{label\}`\} variant="glyph" icon=\{<GripVertical/);
    assert.match(grip, /label="Move earlier" disabled=\{index === 0\}/);
    assert.match(grip, /label="Move later" disabled=\{index === count - 1\}/);
    // The arrows are gone — one move control per column, never a pair beside a grip. (A ChevronRight
    // IS allowed since stage 2: the phone row's "opens" mark, the block row's own — not a move.)
    const cols = fn('StationColumns');
    assert.doesNotMatch(cols, /ChevronLeft|ChevronUp|ChevronDown|ppMoveBtn|Move \$\{label\} (earlier|later)/);
    const chevrons = cols.match(/<ChevronRight[^>]*>/g) ?? [];
    assert.equal(chevrons.length, 1, 'one ChevronRight — the phone row\'s "opens" mark, never a move arrow');
    assert.match(chevrons[0], /className=\{styles\.ppStRowChevron\}/);
    assert.match(cols, /<StationSlot blockId=\{blockId\} index=\{i\} side="before" \/>/);
    assert.match(cols, /<StationSlot blockId=\{blockId\} index=\{i \+ 1\} side="after" \/>/);
    // A slot lights for a station of THIS block, never beside its own place.
    assert.match(fn('StationSlot'), /lifted\?\.kind === 'station' && lifted\.blockId === blockId && index !== lifted\.index && index !== lifted\.index \+ 1/);
    // A block gap never takes a station; the drop moves it only inside its own block.
    assert.match(fn('GapTarget'), /const carried = !lifted \|\| lifted\.kind === 'station' \? null/);
    assert.match(src, /if \(what\.kind === 'station' && what\.blockId === where\.blockId\) moveStationTo\(where\.blockId, what\.stationId, where\.index\);/);
    // ⚠ The grip's rules reach the TRIGGER only: the menu's panel renders inside the wrapper, and a
    // bare `button` selector crushed its full-width items to the glyph's 28px box.
    assert.match(css, /\.ppStColMove button\[aria-haspopup\] \{/);
    assert.doesNotMatch(css, /\.ppStColMove button \{/);
    assert.doesNotMatch(css, /\.ppTlMove button \{/);
    // A slot reaches into the gap only while LIVE (a resting reach read as a 4px spill on every
    // column at 768 and 1440), and by half the gap PLUS the column's border — 0.3rem alone left a
    // 2px dead strip at the gap's centre, exactly under the line (/review, 2026-09-24).
    assert.match(css, /\.ppStColSlot \{ --reach: 0rem;/);
    assert.match(css, /\.ppStColSlot\[data-target='on'\] \{ --reach: calc\(0\.3rem \+ 1px\); \}/);
  });

  it('K4 — one add row on a phone once the plan has a block; the blank plan keeps its ghost row', () => {
    assert.match(src, /const phoneAddRow = phoneSheet && !firstBlock;/);
    assert.match(src, /\{canAddBlock && phoneAddRow && \(/);
    assert.match(src, /className=\{styles\.ppTlAddRow\} data-pp-add-row onClick=\{addBlock\}/);
    // Closing the sheet lands focus on the block last shown, else an add row — both add rows carry
    // the marker, or deleting the ONLY block strands focus on <body> (/review, 2026-09-23).
    assert.equal((src.match(/data-pp-add-row onClick=\{addBlock\}/g) ?? []).length, 2);
    const blockRow = fn('blockRowFor');
    assert.match(blockRow, /document\.getElementById\(`block-\$\{blockId\}`\)\?\.querySelector<HTMLElement>\('button'\)/);
    assert.match(blockRow, /\?\? document\.querySelector<HTMLElement>\('\[data-pp-add-row\]'\)/);
    assert.match(src, /\{canAddBlock && !phoneAddRow && \(/);
  });

  it('K4 — "Start from a drill" while still on the new block (asks first), the block kept until a pick; the title takes the cursor', () => {
    // §231 walk (owner 2026-09-25, "agreed, make it match" — the station's rule one level up).
    assert.match(src, /const offerSheetFromDrill = !!sheetBlock && freshId === sheetBlock\.id && !readOnly && \(drills\.length > 0 \|\| circuits\.length > 0\);/);
    assert.doesNotMatch(src, /sheetIsBlank/, 'no longer "while it is blank"');
    const start = src.slice(src.indexOf('const startSheetFromDrill = offerSheetFromDrill ? async () => {'), src.indexOf("setDrillSheet({ kind: 'block', at: sheetIndex, replaceId: block.id });"));
    assert.ok(start.length > 0);
    assert.match(start, /if \(!isUntouchedNewBlock\(block\)\) \{\s*const ok = await confirm\(\{/);
    assert.match(start, /if \(!ok\) return;/);
    // ⚠ The block is NOT removed on the tap — a closed picker leaves it exactly as it was…
    assert.doesNotMatch(start, /setBlocks\(|openBlock\(null\)/);
    // …and the pick takes its place, keeping its id, never counted against the block limit.
    const body = fn('PracticePlanEditor');
    const insert = body.slice(body.indexOf('function insertBlock('), body.indexOf('function moveBlockTo('));
    assert.match(insert, /if \(replacing >= 0\) next\[replacing\] = \{ \.\.\.block, id: replaceId! \};/);
    // …only while that block is still THERE (/review): a vanished one makes the pick an insert, capped.
    assert.match(body, /if \(!replacesABlock\(replaceId\) && plan\.blocks\.length >= MAX_BLOCKS\) \{ setDrillSheet\(null\); return; \}/);
    assert.match(fn('replacesABlock'), /return !!replaceId && plan\.blocks\.some\(b => b\.id === replaceId\);/);
    assert.match(src, /addBlockFromDrill\(drill, openDrillSheet\.at, openDrillSheet\.replaceId\)/);
    assert.match(src, /addBlockFromCircuit\(circuit, openDrillSheet\.at, openDrillSheet\.replaceId\)/);
    assert.match(src, /\(openDrillSheet\.kind === 'block' && openDrillSheet\.replaceId\) \? undefined/, 'no "Write a block" from inside the block');
    // "Blank" is every field untouched — the /review data-loss finding: players, staff or a length
    // set before a title are work, so they are ASKED about before the swap.
    const blank = fn('isUntouchedNewBlock');
    assert.match(blank, /Object\.entries\(block\)\.every/);
    assert.match(blank, /d\.minutes === DEFAULT_BLOCK_MINUTES/);
    const card = fn('BlockCard');
    assert.match(card, /\{sheet && onStartFromDrill && \(/);
    assert.match(card, /if \(inSheet && open && focusTitle\) titleRef\.current\?\.focus\(\);/);
  });

  it('the stylesheet: the phone gutter is the clock alone, and the eyebrow is never uppercased', () => {
    assert.match(css, /\.ppTl \{ --pp-gutter-w: 5rem; \}/);
    assert.doesNotMatch(css, /\.ppTl \{ --pp-gutter-w: 5\.75rem; \}/);
    const eyebrow = css.slice(css.indexOf('.ppBlockSheetEyebrow {'), css.indexOf('}', css.indexOf('.ppBlockSheetEyebrow {')));
    assert.ok(eyebrow.length > 0);
    assert.doesNotMatch(eyebrow, /text-transform/, 'the eyebrow carries a clock — "P.M." is not the house spelling');
    assert.match(css, /\.ppTlOpen\.ppBlockSheetBody \{ margin: 0; border: 0; border-radius: 0; background: none; \}/);
    // The foot is the walk alone, centred; the Done it styled is gone (§231 walk).
    assert.match(css, /\.ppBlockSheet \.modalFooter \{ align-items: center; justify-content: center; \}/);
    assert.doesNotMatch(css, /\.ppBlockSheet \.modalFooter \.btnPrimary/);
    // The station form's foot the same at every width — centred, and nothing left styling a Done.
    assert.match(css, /\.ppSheetFoot \{ align-items: center; justify-content: center; \}/);
    assert.doesNotMatch(css, /\.ppSheetFoot \.btnPrimary/);
    // The toolbar's Edit / Done editing wears its neighbours' border (owner, 2026-09-28), and the
    // Library toggle's press is a fill — never the `--white-45` outline Warm turns into dim TEXT ink.
    assert.doesNotMatch(css, /\.ppEditDoor\[data-on='on'\]/);
    assert.match(css, /\.ppToolbarEnd\[data-on='on'\] \{ color: var\(--text-primary\); background: rgba\(var\(--home-olive-rgb, var\(--logic-lime-rgb\)\), 0\.1\); \}/);
    assert.doesNotMatch(css.slice(css.indexOf(".ppToolbarEnd[data-on='on']"), css.indexOf('}', css.indexOf(".ppToolbarEnd[data-on='on']"))), /--white-45/);
    // The rows' focus mark is the list row's, INSIDE the row — the global ring drew a second box
    // round the station list's edge (§231 walk, owner 2026-09-25). Quieted, never removed.
    assert.match(css, /\.ppTlClosed:focus-visible, \.ppTlAddRow:focus-visible, \.ppStRowDoor:focus-visible \{ outline: 2px solid var\(--primary-light\); outline-offset: -2px; \}/);
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * PRACTICE PLANS ON A PHONE · STAGE 2 — stations inside a block (owner ruling S1 · S2 · S4 = A,
 * 2026-09-24; plan §6e)
 *
 *   S1 **ON A PHONE A STATION IS ONE ROW** in the block's sheet: the name, one facts line (who runs
 *      it · "Just for tonight" when it has a note), a chevron, the whole row the door — never the
 *      desk column's "Open ›" line or its cut first line of words. The grip at the row's LEFT.
 *   S2 **ADDING A STATION OPENS IT**, the cursor in its name: on a phone "+ Add a station" and
 *      "+ Stations" skip the chooser; at every width "Write a station" opens what it makes. The
 *      library is "Start from a drill ›" inside, while the new station holds nothing — the pick
 *      takes its place and keeps its id.
 *   S4 **A NEW STATION LEFT EMPTY GOES** when its screen closes — measured: a blank station
 *      survives a reload otherwise, counted in the list, skipped by the rotation.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
describe('practice plans on a phone · stage 2 (S1 · S2 · S4)', () => {
  it('S1 — the phone row: name, one facts line, chevron, whole-row door; the grip first; no "Open ›"', () => {
    const cols = fn('StationColumns');
    const phoneBranch = cols.slice(cols.indexOf('if (phone) {'), cols.indexOf('return (\n    <div className={styles.ppStCols}>'));
    assert.ok(phoneBranch.length > 0, 'a phone branch exists');
    assert.match(phoneBranch, /className=\{`\$\{styles\.ppStCols\} \$\{styles\.ppStList\}`\}/);
    assert.doesNotMatch(phoneBranch, /Open ›|ppStColFirst|station\.description/, 'no "Open ›" line and no cut first line of words');
    assert.match(phoneBranch, /<span className=\{styles\.ppStRowTonight\}>\{DOOR_LABELS\.note\}<\/span>/, 'the note shows as its field\'s own label, not its sentence');
    assert.match(phoneBranch, /who\.join\(', '\)/, 'every name who runs it');
    assert.match(phoneBranch, /<ChevronRight size=\{18\} aria-hidden className=\{styles\.ppStRowChevron\} \/>/);
    // The handles (slots + grip) come BEFORE the door in the row — its left edge; the desk column
    // keeps them after its door, at the foot.
    assert.ok(phoneBranch.indexOf('{handles}') < phoneBranch.indexOf('className={styles.ppStRowDoor}'), 'grip left of the door');
    const deskBranch = cols.slice(cols.indexOf('return (\n    <div className={styles.ppStCols}>'));
    assert.ok(deskBranch.indexOf('className={styles.ppStColDoor}') < deskBranch.indexOf('{handles}'), 'the desk grip stays at the foot');
    assert.equal((cols.match(/<StationGrip /g) ?? []).length, 1, 'one grip, built once for both shapes');
    assert.match(phoneBranch, /\+ Add a station/);
    // Only the block's PHONE sheet asks for rows — never the desk card, never the circuit editor.
    assert.match(src, /phone=\{!!sheet\}/);
  });

  it('S1 — the stylesheet: one bordered list, rows touching, slots meeting on the divider, the grip in the flow', () => {
    assert.match(css, /\.ppStCols\.ppStList \{\s*gap: 0;/);
    assert.match(css, /\.ppStList > \.ppStCol > \.ppStColMove \{ position: static;/);
    assert.match(css, /\.ppStList \.ppStColSlot\[data-target='on'\] \{ --reach: 0\.5px; \}/);
    const list = css.slice(css.indexOf('.ppStCols.ppStList {'), css.indexOf('}', css.indexOf('.ppStCols.ppStList {')));
    assert.doesNotMatch(list, /overflow/, 'the grip\'s menu renders inside a row — the list must never clip it');
    assert.doesNotMatch(css.slice(css.indexOf('.ppStRowName {'), css.indexOf('}', css.indexOf('.ppStRowName {'))), /ellipsis|nowrap/, 'nothing on the row is cut');
  });

  it('S2 — adding opens the station it made, at every width; on a phone there is no chooser first', () => {
    assert.match(src, /setOpenStation\(\{ blockId, stationId: made\.id, fresh: true \}\);/);
    assert.match(src, /const addStationTo = \(blockId: string\) => \(phoneSheet\s*\? addBlankStation\(blockId\)\s*: setDrillSheet\(\{ kind: 'station', blockId \}\)\);/);
    assert.match(src, /onAddStation: \(swapId\?: string\) => \(swapId\s*\? setDrillSheet\(\{ kind: 'station', blockId: block\.id, swapId \}\)\s*: addStationTo\(block\.id\)\)/);
    // The cursor in the name — after the floor, so it survives the dev build's double mount.
    const modal = fn('StationModal');
    assert.ok(modal.indexOf('useDialogFloor(') < modal.indexOf('if (focusName) nameRef.current?.focus();'), 'the name focus runs after the floor');
    assert.match(modal, /<input ref=\{nameRef\}/);
    assert.match(src, /focusName=\{!!openStation\.fresh && !readOnly\}/);
  });

  it('S2 — "Start from a drill ›" while still on the new station, typed-on or not (asks first); the pick keeps its place; no "Write one" there', () => {
    // §231 walk (owner 2026-09-25): "if I start typing something by accident I can't get back to
    // loading a drill". The door stays while the coach is ON the station they just added…
    assert.match(src, /const offerStartFromDrill = !!openStation\?\.fresh && !!openStationRow && !readOnly && !openStationRow\.drillId && drills\.length > 0;/);
    assert.doesNotMatch(src, /openStationUntouched/, 'no longer "while it holds nothing"');
    assert.match(src, /onStartFromDrill=\{offerStartFromDrill \? \(\) => void startStationFromDrill\(\) : undefined\}/);
    // …and asks before the pick replaces anything the station holds.
    const start = src.slice(src.indexOf('const startStationFromDrill = async () => {'), src.indexOf('setDrillSheet({ kind: \'station\', blockId: openStation.blockId, swapId: openStation.stationId, startFrom: true });'));
    assert.ok(start.length > 0);
    // Holds anything, OR typed anything (the touch is counted on input — a new staff name saves late).
    assert.match(start, /if \(!stationIsEmpty\(openStationRow\) \|\| !freshStations\.has\(openStationRow\.id\)\) \{\s*const ok = await confirm\(\{/);
    assert.match(start, /if \(!ok\) return;/);
    assert.match(src, /swapId: openStation\.stationId, startFrom: true/);
    assert.match(src, /onWriteOne=\{\(openDrillSheet\.kind === 'station' && openDrillSheet\.startFrom\) \|\| \(openDrillSheet\.kind === 'block' && openDrillSheet\.replaceId\) \? undefined/);
    // The swap path keeps the ORIGINAL id — the rotation's keys and the station's place hold.
    assert.match(fn('PracticePlanEditor'), /s\.id === swapId \? \{ \.\.\.fresh, id: s\.id \} : s/);
  });

  it('§231 walk — a station deleted from its screen goes back to the block, in ONE write', () => {
    // Owner 2026-09-25: "when I delete a station I should be navigated back to the block viewing the
    // stations, not navigated back to another station".
    const body = fn('PracticePlanEditor');
    const del = body.slice(body.indexOf('const deleteStation = '), body.indexOf('function addBlock()'));
    assert.ok(del.length > 0);
    assert.match(del, /setOpenStation\(null\);/);
    assert.doesNotMatch(del, /neighbour|stationWalk/, 'no step to another station');
    // A delete is a close: S4's removal runs on the SAME pass, never a second read of this render's plan.
    assert.match(del, /const next = dropEmptyStations\(collapseSoleStation\(\{ \.\.\.block, stations: remaining \}\), freshStations\);/);
    assert.doesNotMatch(del, /dropFreshEmptyStations|closeStation\(/);
  });

  it('§231 walk — on a phone the drill picker\'s Tags menu opens from the LEFT (Tags starts the wrapped line)', () => {
    const phoneBlock = css.slice(css.indexOf('.ppDrillFilters .scoutSearch { flex-basis: 100%; }'), css.indexOf('}', css.indexOf('.ppDrillFilters [data-pill="panel"] { left: 0; right: auto; }')) + 1);
    // The pill's panel is reached by its data attribute: its class lives in the shared pill module
    // (promoted 2026-10-01), so a `.multiSelectPanel` selector in this sheet would match nothing.
    assert.match(phoneBlock, /\.ppDrillFilters \[data-pill="panel"\] \{ left: 0; right: auto; \}/);
    // The desk keeps its right anchor (the 320px docked library, where Tags ends the row).
    assert.match(css, /\.ppDrillFilters \[data-pill="panel"\] \{ left: auto; right: 0; \}/);
  });

  it('S4 — on close, every fresh station still holding nothing goes; a step removes nothing; the collapse brings the block home', () => {
    const body = fn('PracticePlanEditor');
    const drop = body.slice(body.indexOf('const dropFreshEmptyStations = '), body.indexOf('const closeStation = () => {'));
    // The rule itself is the library's, tested by behaviour in rep-practice-plan.test.ts.
    assert.match(drop, /const next = dropEmptyStations\(block, freshStations\);/);
    // Never while reading — the page's onChange is a no-op there, and the ids would be forgotten.
    assert.match(drop, /if \(readOnly \|\| freshStations\.size === 0\) return undefined;/);
    assert.match(src, /onClose=\{closeStation\}/);
    // "Done editing" on the station's head drops first, while the plan can still change.
    assert.match(src, /onDoneEditing=\{doneEditingStation\}/);
    // Typing anything on a station makes it the coach's — a staff name still being created keeps it.
    assert.match(fn('StationModal'), /styles\.ppStationBody\}`\} onInput=\{onTouched\}>/);
    assert.match(src, /onTouched=\{\(\) => touchStation\(openStation\.stationId\)\}/);
    assert.match(src, /onStep=\{stationId => setOpenStation\(\{ blockId: openStation\.blockId, stationId \}\)\}/, 'a step is only a step');
  });

  it('focus after a block or station screen closes: ONE rule — the thing last shown, else the add control', () => {
    const hook = fn('useFocusLastShownOnClose');
    assert.match(hook, /if \(!dialog\.contains\(target\)\) return;/, 'yields to a dialog that took over, whatever order the dialogs mount in');
    assert.equal((src.match(/useFocusLastShownOnClose\(/g) ?? []).length, 3, 'the hook and its two callers');
    assert.match(fn('stationDoorFor'), /\[data-pp-add-station=/);
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * PRACTICE PLANS ON A PHONE · STAGE 4 — the head of the page (owner rulings N1–N4 = A, 2026-09-25;
 * plan §6i). Measured before: in a REAL week the first block started under the tab bar (777px down at
 * 390; 858 for an assistant named on the plan) — the head, not the plan, was the screen.
 *
 *   N1 **THE SHEET'S HEAD IS ONE DOOR** on a phone: the day and time on one line, WHERE and when to
 *      arrive (the page never said either; the paper and the notification did), the plan's fit; the
 *      whole block links to the schedule — no separate "View on schedule" row, no nested link.
 *   N2 **THE SENT LINE IS ONE ROW THAT IS "SEND AGAIN"** — the same words, one copy of them.
 *      ⤷ REVISED the same day (owner, on the built screen): "sending to coaches should be in the ...
 *        drawer with print and save, no need for the banner". On a phone there is NO sent line —
 *        ⋯ → Send to staff is the one door, and the last send is the send sheet's first line. The
 *        sheet took the portal's sheet recipe whole, and the edge-to-edge rule stopped handing the
 *        page's dialogs (and the "Saved" pill) a side margin.
 *   N3 **ABOUT WAITS UNDER THE PLAN** on a phone (JS order, never CSS `order`), and the "Started
 *      from" banner is GONE at every width — the template picker makes that promise at the choice.
 *   N4 **THE SCOUTING NOTE IS ONE ROW UNDER THE TOOLBAR**, opening the book; the desk keeps its card.
 *   + two controls under the tap floor, fixed: "You're on" rows, the scouting card's link.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
describe('practice plans on a phone · stage 4 (N1–N4) — the head of the page', () => {
  const PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx';
  const CHROME = 'components/coaches/PracticeSheetChrome.tsx';
  const page = readCode(PAGE);
  const chrome = readCode(CHROME);

  it('N1 — both of the page\'s sheet heads go through ONE renderer, which is the door on a phone', () => {
    const head = functionBody(page, 'renderDocHead');
    assert.match(head, /if \(isPhone && event\?\.startsAt\)/);
    assert.match(head, /<PracticeWhenDoor [\s\S]*place=\{practicePlaceLabel\(event, assignment\?\.teamSport\)\}/);
    // /review 2026-09-25: the arrival goes by the DATE — a past practice opened for editing is not a
    // record face, but "Arrive by" on it would instruct nobody.
    assert.match(head, /arrivalTime=\{isPracticeRecord \? null : event\.arrivalTime\}/);
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/history/development/practices/[eventId]/page.tsx'),
      /where=\{practicePlaceLabel\(data\.event, assignment\?\.teamSport\) \|\| null\}/, 'the finished-season reader uses the one join too');
    assert.equal((page.match(/renderDocHead\((true|recordMode)\)/g) ?? []).length, 2, 'the no-plan record and the sheet');
    assert.equal((page.match(/<PracticeScheduleLink /g) ?? []).length, 1, 'the desk\'s link lives in the renderer alone');
  });

  it('N1 — the door: one link (never a link inside it), "View on schedule" as its name, where + arrival, no arrival on a record', () => {
    // Bounded by hand: `functionBody` ends a top-level function at the next bare `function`, and the
    // next one here is `export function PracticeScheduleLink` (which holds a Link of its own).
    const doorAt = chrome.indexOf('export function PracticeWhenDoor(');
    const door = chrome.slice(doorAt, chrome.indexOf('export function ', doorAt + 10));
    assert.ok(doorAt > 0, 'PracticeWhenDoor exists');
    assert.equal((door.match(/<Link /g) ?? []).length, 1, 'a nested link is invalid — the desk\'s "Set it on the schedule ›" keeps only its words here');
    assert.match(door, /className=\{`\$\{styles\.ppDocHead\} \$\{styles\.ppWhenDoor\}`\}/);
    assert.match(door, /<span className="sr-only">View on schedule: <\/span>/);
    assert.match(door, /!record && arrivalTime \? `Arrive by \$\{formatStoredClock\(arrivalTime\)\}`/, 'the Schedule\'s words, the house clock; a record has nobody to instruct');
    assert.match(chrome, /function planFit\(/, 'the desk line and the door word the fit through ONE helper');
    const sheet = readCode('lib/practice-sheet.ts');
    assert.match(sheet, /export function practicePlaceLabel\(/);
    assert.match(sheet, /practicePlaceLabel\(event, sport\)/, 'the paper\'s where-line uses the same join');
  });

  it('N2, revised — no sent line on a phone; ⋯ → Send to staff is the one door, and the sheet reads the last send', () => {
    assert.match(page, /\{!isPhone && !recordMode && hasBlocks && data\.sent && \(\s*<p className=\{styles\.ppSentLine\} data-testid="sent-to-staff">/);
    assert.doesNotMatch(page, /ppSentRow|canSendAgain/, 'the phone row and its second gate are gone');
    assert.doesNotMatch(css, /\.ppSentRow\s*\{/);
    assert.equal((page.match(/'bell, push and email'/g) ?? []).length, 1, 'one copy of the sent line\'s words (`sentFacts`)');
    assert.match(page, /lastSent=\{sentFacts\}/, 'the sheet reads the page\'s words, never a second sentence');
    assert.match(page, /<span>\{sentFacts\}<\/span>/, 'the desk line');
    // ONE gate for every way into the sheet: a past practice being edited offered "Send again" beside
    // a toolbar with no Send in it.
    assert.match(page, /const canSend = canWrite && !isPracticeRecord && \(data\?\.staffPeople\?\.length \?\? 0\) > 1;\s*if \(canSend\) \{\s*deskActions\.push\(\{ key: 'send'/);
    assert.match(page, /\{canSend && \(\s*<button type="button" className=\{styles\.ppLinkBtn\} onClick=\{\(\) => setSendOpen\(true\)\}>Send again<\/button>/);
  });

  it('N2, revised — the send sheet is the portal\'s sheet recipe whole: the shared header, one pane, the foot outside it', () => {
    const sheet = readCode('app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticeSendSheet.tsx');
    assert.match(sheet, /<CoachModalHeader title="Send to staff" onClose=\{onClose\} closeAriaLabel="Close" \/>/, '← on a phone, × above 640 — a hand-rolled × alone sat beside the title');
    assert.doesNotMatch(sheet, /ppDrillWrite/, 'its 2.4rem inset put the body 14px inside the title on a phone');
    const pane = sheet.indexOf('<div className={`${styles.scrollPane} ${styles.ppSendBody}`}>');
    const last = sheet.indexOf('{lastSent && <p className={styles.ppSendLast} data-testid="send-sheet-last">{lastSent}</p>}');
    const hint = sheet.indexOf('A bell and a push, with a link to this plan.');
    const error = sheet.indexOf('{error && <p className={`${styles.errorText} ${styles.ppSendError}`} role="alert">{error}</p>}');
    const foot = sheet.indexOf('<div className={styles.modalFooter}>');
    assert.ok(pane > 0 && pane < last && last < hint && hint < error && error < foot, 'pane → the last send → the hint … → the error → the foot');
    // The pane closes BEFORE the error: nothing but the pane's own `</div>` (and a stripped comment's
    // `{ }`) between the preview's end and the error line.
    assert.match(sheet, /\)\}\s*<\/div>\s*(\{ \}\s*)?\{error && <p className=\{`\$\{styles\.errorText\} \$\{styles\.ppSendError\}`\}/, 'the error and the foot sit outside the scroll');
    // The edge-to-edge rule's gutter skips every fixed child of the page.
    assert.match(css, /\.coachesMain:has\(\.ppSheetPair\) \.page > :not\(\.ppSheetCol\):not\(\.modalOverlay\):not\(\.savePill\),\s*\.coachesMain:has\(\.ppSheetPair\) \.ppSheetCol > :not\(\.ppSheetPair\):not\(\.modalOverlay\) \{ margin-inline: 1rem; \}/);
  });

  it('N3 — About renders under the timeline on a phone, before the focus rail; in JS order', () => {
    assert.match(src, /const aboutAfterPlan = phoneSheet;/);
    const before = src.indexOf('{!aboutAfterPlan && aboutFold}');
    const tl = src.indexOf('<div className={styles.ppTl}>');
    const after = src.indexOf('{aboutAfterPlan && aboutFold}', tl);
    const rail = src.indexOf('{canOfferFocus && (');
    assert.ok(before > 0 && before < tl && tl < after && after < rail, 'goal → About (desk) → timeline → About (phone) → focus rail');
    assert.doesNotMatch(css, /\.ppAbout[^{]*\{[^}]*\border:/, 'never CSS `order` — the reading order is the order seen');
  });

  it('N3 — the "Started from" banner is gone at every width (the picker already promises the template won\'t change)', () => {
    assert.doesNotMatch(page, /ppProvenance|Started from/);
    assert.doesNotMatch(css, /\.ppProvenance\s*\{/);
    assert.match(page, /The template is left exactly as it is, and anything you change here stays here\./, 'the promise the banner repeated, in the picker');
  });

  it('N4 — the desk keeps its card; a phone gets one row, under the toolbar and the sent line (the top only with no toolbar)', () => {
    assert.match(page, /\{bridge && !isPhone && \(\s*<div className=\{styles\.ppScoutBridge\}>/);
    assert.match(page, /\{isPhone && !sheetShown && scoutRow\}/);
    assert.match(page, /\{isPhone && scoutRow\}/);
    assert.match(page, /<Link href=\{bookHref\} className=\{styles\.ppScoutRow\}/);
    assert.equal((page.match(/\{bridgeLead\}/g) ?? []).length, 2, 'one lead, both presentations');
  });

  it('the stylesheet: the door stays a row, the rows take the floor, and the two floors that lost come AFTER their base rules', () => {
    assert.match(css, /\.ppDocHead\.ppWhenDoor \{\s*display: block; position: relative;/, 'two classes deep: the ≤640 column rule is one');
    assert.match(css, /\.ppWhenBit \{ white-space: nowrap; \}/, 'a clock never breaks across lines');
    assert.match(css, /\.ppWhenDoor \.ppDocWhenLine \{ padding-right: 1\.75rem; \}/, 'the chevron beside the first line only');
    assert.match(css, /\.ppScoutRow \{[^}]*min-height: var\(--tap-min, 44px\)/);
    const base = css.indexOf('.ppYoureOnItem { color: var(--text-primary);');
    const floor = css.indexOf('@media (max-width: 768px) { .ppYoureOnItem { min-height: var(--tap-min, 44px); } }');
    assert.ok(base > 0 && floor > base, '"You\'re on" rows: the touch floor must follow the 32px base rule it overrides');
    const linkBase = css.indexOf('.ppScoutBridgeLink {');
    const linkFloor = css.indexOf('@media (max-width: 768px) { .ppScoutBridgeLink { display: inline-flex; align-items: center; min-height: var(--tap-min, 44px); } }');
    assert.ok(linkBase > 0 && linkFloor > linkBase, 'the card\'s "Full book" link takes the floor in the touch band');
  });
});
