/**
 * Awards One Tag Idiom, Part A (plan `COACH_AWARDS_ONE_TAG_IDIOM_PLAN.md`) — a given award can
 * now be edited and removed where it was given, not just deleted from a separate report page.
 * Structural rules a live-DB test can't reach without a fixture; this pins them by source.
 *
 * R0 (owner ruling, from the mockup): the edit form carries NO "Remove this award" control — one
 * job per control, delete stays the row's own trash icon with its own confirm.
 *
 * "Which game an award is for" is deliberately NOT editable (plan's architectural decisions) — a
 * wrong game is remove-and-re-give, same as a tag on the wrong event. Pinned by absence: the
 * PATCH route never writes an `event_id` field, and its request body never sends `eventId`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');

const modal = read('components/coaches/GiveAwardModal.tsx');
const awardsRoute = read('app/api/coaches/[orgSlug]/teams/[teamId]/awards/route.ts');
const awardIdRoute = read('app/api/coaches/[orgSlug]/teams/[teamId]/awards/[awardId]/route.ts');
const scheduleAwardSection = (() => {
  // The schedule's event sheet — its own file since the Schedule deep dive's split (S6, 2026-09-25).
  const page = read('components/coaches/ScheduleEventSheet.tsx');
  // NOT `indexOf('Awards given')` — an earlier comment ("...the slide-over's \"Awards given\"
  // section...") contains that same phrase and would anchor the slice hundreds of lines too
  // early. The JSX heading is unique.
  const start = page.indexOf('>Awards given</h4>');
  return page.slice(start, start + 3000);
})();
const reportPanel = read('app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx');

describe('GiveAwardModal — edit mode', () => {
  it('R0: never renders a "Remove this award" control — delete stays the row\'s own icon', () => {
    assert.doesNotMatch(modal, /Remove this award/i);
  });

  it('supports an `editing` prop and titles the form "Edit award" when it is set', () => {
    assert.match(modal, /editing\?:\s*RepPlayerAward/);
    assert.match(modal, /editing\s*\?\s*'Edit award'\s*:\s*'Give an award'/);
  });

  it('PATCHes the existing award id when editing, instead of POSTing a new one', () => {
    assert.match(modal, /`\$\{base\}\/\$\{editing\.id\}`/);
    assert.match(modal, /method:\s*'PATCH'/);
  });

  it('never sends eventId in the edit PATCH body — which game an award is for is not editable', () => {
    const patchCallStart = modal.indexOf("method: 'PATCH'");
    const patchBody = modal.slice(patchCallStart, patchCallStart + 400);
    assert.doesNotMatch(patchBody, /eventId/);
  });
});

describe('the award PATCH route — R5 once per occasion, and no editable game', () => {
  it('exports PATCH and never writes an event_id/eventId field', () => {
    assert.match(awardIdRoute, /export const PATCH/);
    assert.doesNotMatch(awardIdRoute, /fields\.eventId/);
  });

  it('checks findRepPlayerAwardCollision before writing, excluding the row being edited', () => {
    assert.match(awardIdRoute, /findRepPlayerAwardCollision\(/);
    assert.match(awardIdRoute, /findRepPlayerAwardCollision\(\s*[\s\S]{0,200}awardId,?\s*\)/);
  });

  it('answers a collision with 409, not a silent success', () => {
    const collisionBlock = awardIdRoute.slice(awardIdRoute.indexOf('if (collision)'), awardIdRoute.indexOf('if (collision)') + 700);
    assert.match(collisionBlock, /status:\s*409/);
  });

  /** /review 2026-09-12: the check above is check-then-act; migration 289's partial unique
   *  indexes close the race, but a race that slips past the check must still land on the
   *  friendly sentence, not a raw 500 from an unhandled 23505. */
  it('maps a 23505 unique-violation from updateRepPlayerAward to the same 409 collision sentence', () => {
    assert.match(awardIdRoute, /catch\s*\(error: unknown\)[\s\S]{0,300}23505/);
    const catchIdx = awardIdRoute.search(/catch\s*\(error: unknown\)/);
    const catchBlock = awardIdRoute.slice(catchIdx, catchIdx + 700);
    assert.match(catchBlock, /already has/);
    assert.match(catchBlock, /status:\s*409/);
  });

  /** /review 2026-09-25: a departed player's award could not be edited at all — fixing its note
   *  failed on "That player is not on the active roster", a player the coach never touched. */
  it('keeps the award\'s own player even once they have left the roster; only a CHANGE must be active', () => {
    assert.match(awardIdRoute, /if \(body\.playerId !== current\.playerId\) \{\s*const player = roster\.find\(p => p\.id === body\.playerId && p\.status === 'active'\);/);
  });

  /** /review 2026-09-25: renaming a general award's occasion onto one the player already holds it
   *  for is the same collision — and the check read the OLD label. */
  it('checks the occasion AS IT WILL BE — the patched label, not the stored one', () => {
    assert.match(awardIdRoute, /tournamentLabel: fields\.tournamentLabel !== undefined \? fields\.tournamentLabel : current\.tournamentLabel,/);
    assert.match(awardIdRoute, /findRepPlayerAwardCollision\(teamId, playerId, awardTypeId, occasion, awardId\)/);
    assert.match(awardIdRoute, /describeAwardOccasion\(occasion, /, 'the refusal names the occasion the coach typed');
  });
});

describe('the award POST route — R5 applies to giving a new award too', () => {
  it('checks findRepPlayerAwardCollision before creating', () => {
    assert.match(awardsRoute, /findRepPlayerAwardCollision\(/);
    const collisionIdx = awardsRoute.indexOf('findRepPlayerAwardCollision(');
    const createIdx = awardsRoute.indexOf('createRepPlayerAward(');
    assert.ok(collisionIdx > -1 && createIdx > -1 && collisionIdx < createIdx,
      'the collision check must run BEFORE the award is created, not after');
  });

  /** /review 2026-09-12: same race-safety gap as the PATCH route above. */
  it('maps a 23505 unique-violation from createRepPlayerAward to the same 409 collision sentence', () => {
    assert.match(awardsRoute, /catch\s*\(error: unknown\)[\s\S]{0,300}23505/);
    const catchIdx = awardsRoute.search(/catch\s*\(error: unknown\)/);
    const catchBlock = awardsRoute.slice(catchIdx, catchIdx + 700);
    assert.match(catchBlock, /already has/);
    assert.match(catchBlock, /status:\s*409/);
  });
});

describe('the schedule game drawer — awards given get their own controls', () => {
  it('renders an Edit and a Remove control per award row, not plain text', () => {
    assert.match(scheduleAwardSection, /<Pencil size=\{14\}/);
    assert.match(scheduleAwardSection, /<Trash2 size=\{14\}/);
  });

  it('Edit opens the modal in edit mode against that specific row', () => {
    assert.match(scheduleAwardSection, /setEditingAward\(a\);\s*setGiveAwardOpen\(true\)/);
  });
});

describe('the season report page — Edit sits beside the existing Print and Remove', () => {
  it('renders Pencil, Printer and Trash2 on each history row', () => {
    // The whole history table, not a fixed-length slice: the phone's menu (below) sits in the same
    // cell ahead of the desktop icons, and a 3,200-character window stopped short of them.
    // The DESKTOP table — the phone's own table (the row opens the award's sheet) comes first, so the
    // slice runs to the LAST tbody (phone plan §14.13).
    const tableStart = reportPanel.indexOf('Full history');
    const table = reportPanel.slice(tableStart, reportPanel.lastIndexOf('</tbody>'));
    assert.match(table, /<Pencil size=\{13\}/);
    assert.match(table, /<Printer size=\{13\}/);
    assert.match(table, /<Trash2 size=\{13\}/);
  });

  it('the remove confirm asks once and never offers an undo it then denies (2026-09-25)', () => {
    const at = reportPanel.indexOf('const ok = await confirm({', reportPanel.indexOf('async function handleDelete'));
    const del = reportPanel.slice(at, reportPanel.indexOf('});', at));
    assert.doesNotMatch(del, /Undo /, '"Undo MVP for …? This can\'t be undone." offered and denied an undo');
    assert.match(del, /title: `Remove \$\{award\.playerName \?\? 'this player'\}’s \$\{award\.awardType\?\.name \?\? 'award'\}\?`/);
    assert.match(del, /message: 'This can’t be undone\.'/);
  });
});

/**
 * THE AWARD'S SHEET (coaching from a phone §14.13, owner 2026-09-25) — on a phone a row opens the
 * award: read first, the bin and the pencil in its head, the award edited in place.
 */
describe('the award\'s sheet on a phone', () => {
  const sheet = read('components/coaches/AwardSheet.tsx');
  const sheetCss = read('components/coaches/AwardSheet.module.css');

  it('the report mounts it for a phone, outside the loading branch, keyed on the award', () => {
    assert.match(reportPanel, /\{isPhone && openAward && \(\s*<AwardSheet\s+key=\{openAward\.id\}/);
    assert.match(reportPanel, /onSaved=\{reloadAwardsQuietly\}/, 'a save re-reads the list QUIETLY — no "Loading report…" behind the sheet');
    // a save cannot change the award-type library, so it re-reads the awards alone; a library change re-reads both
    assert.match(reportPanel, /const reloadAwardsQuietly = useCallback\(\(\) => \{ void load\(undefined, \{ quiet: true, withTypes: false \}\); \}, \[load\]\);/);
    assert.match(reportPanel, /onLibraryChanged=\{reloadQuietly\}/);
    assert.match(reportPanel, /onRemove=\{handleDelete\}/, 'the bin goes through the report\'s own confirm');
  });

  it('has no title — its head is the bin, then the pencil that flips to ✓ in the same button', () => {
    assert.doesNotMatch(sheet, /drawerTitle|<h2|<h3/);
    const head = sheet.slice(sheet.indexOf('className={own.head}'), sheet.indexOf('{editing ? (\n            <dl'));
    assert.ok(head.indexOf('<Trash2') > -1 && head.indexOf('<Trash2') < head.indexOf('<Pencil'), 'the bin sits LEFT of the pencil');
    assert.match(head, /\{editing \? <Check size=\{18\} aria-hidden \/> : <Pencil size=\{18\} aria-hidden \/>\}/, 'one button, the glyph flips — ✓ where ✎ was');
    assert.equal((head.match(/<button/g) ?? []).length, 2, 'two buttons in the head, no third');
  });

  it('the head buttons are the portal\'s own borderless square, in both states (the §227 / §228 rulings)', () => {
    const head = sheet.slice(sheet.indexOf('className={own.head}'), sheet.indexOf('{editing ? (\n            <dl'));
    assert.equal((head.match(/className=\{shared\.ppIconBtn\}/g) ?? []).length, 2, 'the bin and the pencil/✓ are .ppIconBtn');
    assert.doesNotMatch(sheetCss, /\.iconBtn\b/, 'no private copy of the icon square');
  });

  it('editing saves as you go and holds a change the product would refuse, with the route\'s own sentence', () => {
    assert.match(sheet, /useRecordAutosave\(/);
    assert.doesNotMatch(sheet, />\s*Save( changes)?\s*</, 'no Save button — ✓ means finished, not save');
    assert.match(sheet, /sameAwardOccasion\(o, occasion\)/);
    assert.match(sheet, /already has \$\{typeOf\(form\.typeId\)\?\.name \?\? 'that award'\} \$\{describeAwardOccasion\(occasion, award\.eventType\)\}\./);
    assert.match(sheet, /if \(blocked \|\| finishingRef\.current\) return;/, '✓ with a change held stays in the edit — and a second ✓ never sends the PATCH twice');
    assert.match(sheet, /method: 'PATCH'/);
    const patch = sheet.slice(sheet.indexOf('const patch = {'), sheet.indexOf('};', sheet.indexOf('const patch = {')));
    assert.doesNotMatch(patch, /eventId:/, 'which event an award is FOR is never editable');
    assert.match(sheet, /body: JSON\.stringify\(patch\)/);
  });

  // /review 2026-09-25 — each of these was a way the sheet failed a coach who did nothing wrong.
  it('sends only what CHANGED since the last write — never re-asserts a field the coach did not touch', () => {
    const patch = sheet.slice(sheet.indexOf('const patch = {'), sheet.indexOf('};', sheet.indexOf('const patch = {')));
    for (const [field, key] of [['playerId', 'playerId'], ['typeId', 'awardTypeId'], ['label', 'tournamentLabel'], ['note', 'note']]) {
      assert.match(patch, new RegExp(`f\\.${field} !== saved\\.${field} \\? \\{ ${key}:`), `${key} only when it changed`);
    }
    assert.match(sheet, /if \(Object\.keys\(patch\)\.length === 0\) return;/, 'typed and put back sends nothing (the route answers an empty patch with 400)');
  });

  it('the scrim and Escape always leave — a held change closes without it, instead of trapping the coach', () => {
    assert.match(sheet, /if \(editing && !blocked\) void finish\('close'\); else onClose\(\);/);
  });

  it('a save and a removal never cross: the bin waits for a save, the autosave pauses for a removal', () => {
    assert.match(sheet, /enabled: !removing,/);
    const bin = sheet.slice(sheet.indexOf('aria-label={`Remove ${readPlayer}'), sheet.indexOf('<Trash2'));
    assert.match(bin, /disabled=\{removing \|\| saving\}/);
  });

  it('the award\'s own player stays in the select after leaving the roster', () => {
    assert.match(sheet, /\{!players\.some\(p => p\.id === award\.playerId\) && \(\s*<option value=\{award\.playerId\}>/);
  });

  it('a removal re-reads the report quietly — the list keeps its place', () => {
    const del = reportPanel.slice(reportPanel.indexOf('async function handleDelete'), reportPanel.indexOf("return 'removed';"));
    assert.match(del, /reloadQuietly\(\);/);
    assert.doesNotMatch(del, /void load\(\);/);
  });

  it('reading is a menu above the bar; editing is a form that covers it (the 2026-09-23 drawer layers)', () => {
    assert.match(sheet, /useOverlayOpen\(editing\);/, 'only while editing does the bar go — out of the tab order too');
    assert.match(sheet, /className=\{`\$\{sheet\.sheetAnchor\} \$\{editing \? own\.anchorForm : ''\}`\}/);
    assert.match(sheetCss, /\.anchorForm\.anchorForm \{\s*bottom: 0;\s*z-index: 390;/, 'above the nav (300), below .modalOverlay (400)');
  });

  it('the picker\'s drawers render beside the panel, never inside it (the floor answers keys inside its panel)', () => {
    const panelEnd = sheet.lastIndexOf('</div>\n      </div>\n      {picker.overlays}');
    assert.ok(panelEnd > -1, 'picker.overlays renders as a sibling of the anchor, after the panel closes');
    assert.match(sheet, /useDialogFloor\(true, panelRef, \{ onClose: requestClose, busy: removing \}\);/);
  });

  it('the picker\'s create row: Escape puts away the row alone, and focus lands back on "+ New"', () => {
    const picker = read('components/coaches/AwardTypePicker.tsx');
    assert.match(picker, /if \(e\.key === 'Escape'\) \{ claimEscape\(e\); closeCreateRow\(\); \}/, 'claimed, so the sheet around it stays open');
    assert.match(picker, /requestAnimationFrame\(\(\) => newBtnRef\.current\?\.focus\(\)\)/, 'the row unmounts under the focus — it never drops to <body>, outside the sheet\'s Tab trap');
    assert.match(picker, /<button ref=\{newBtnRef\} type="button" className=\{styles\.tagChipCreate\}/);
    assert.match(picker, /<div className=\{styles\.tagChips\} role="group" aria-label="Award">/, 'the chips have a name — the sheet\'s "Award" is a <dt>, not a label');
  });

  it('Print certificate is the one worded action, and only while reading', () => {
    const read = sheet.slice(sheet.indexOf(') : (\n            <>'), sheet.indexOf('<SaveStatusPill'));
    assert.match(read, /<Link href=\{certificateHref\} className=\{own\.printRow\}>/);
  });
});
