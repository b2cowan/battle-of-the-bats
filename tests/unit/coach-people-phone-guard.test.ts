import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import { orderRoomsForTeam } from '../../lib/chat-display.ts';
import { FILLED_PLAYER } from '../../scripts/lib/seed-filled-player.mjs';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * PEOPLE ON A PHONE (phone re-evaluation stage 5, owner ruling 2026-09-23 — "I approve as
 * designed"; plan §11 of COACH_MOBILE_EXPERIENCE_PLAN.md, the hub's "5 · People" tab). ≤640 only.
 *
 *   F1 **DETAILS LANDS AS THE RECORD; EDIT LIVES ON THE SECTION.** The record face is the one a
 *      coach without roster-write has seen since 13 September — widened, not rewritten — and it
 *      now prints NEVER positions (a hard block in every lineup mode, silently dropped before).
 *      Edit is a VISIT: never stored, never in the URL, false on every load, focus moved by hand.
 *   F4 **FAMILY & PAPERWORK, THE SAME.** Guardian contact and Safety each carry an Edit; their
 *      phone numbers are `tel:` rows. Documents carries none — uploading is not editing.
 *   F2 **THE NAME IS THE SWITCHER.** A chevron on the player's name opens a sheet of the roster —
 *      the team sheet's own container, a MENU at the menu layer. The prev/next stepper was
 *      withdrawn; the `<select>` survives above 640.
 *   F3 **THIS TEAM'S ROOMS FIRST, CLIENT-SIDE**, with a "Your other teams" divider (option B).
 *      NEVER in `listRoomsForUser` — the consumer inbox is built on it and relies on its order.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx';
const ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/route.ts';
const SHEET = 'components/coaches/CoachPlayerSwitchSheet.tsx';
const TEAM_SHEET = 'components/coaches/CoachTeamSwitchSheet.tsx';
const SECTION = 'components/coaches/CoachPageSection.tsx';
const CHAT_VIEW = 'components/chat/CoachChatView.tsx';
const CHAT_SERVICE = 'lib/chat-service.ts';
const CSS = 'app/[orgSlug]/coaches/coaches.module.css';
const SEEDER = 'scripts/seed-uat-coach-fixture.mjs';

const page = readCode(PAGE);
const sheet = readCode(SHEET);

describe('F1 · the record face — one face, widened, with Never', () => {
  it('prints every field of the record, in the ruled order', () => {
    const labels = [...page.matchAll(/<RecordRow label="([^"]+)"/g)].map(m => m[1]);
    const details = labels.slice(0, 8);
    assert.deepEqual(details,
      ['Name', 'Jersey #', 'Date of birth', 'Positions', 'Pitching', 'A-squad', 'Bats / throws', 'Jersey size']);
  });
  it('prints NEVER positions, from the SAVED player — never the form', () => {
    assert.match(page, /<RecordRow label="Positions" value=\{positionsLine\(savedPositions\.preferred, savedPositions\.never\)\}/);
    assert.match(page, /const savedPositions = playerPositionPrefs\(player, pitcherPos\)/);
    const fn = page.slice(page.indexOf('function positionsLine'), page.indexOf('function positionsLine') + 400);
    assert.match(fn, /`Never \$\{never\.join/, 'the line names Never positions');
  });
  it('the form is a writer\'s — always above 640, on a phone only while that section is edited', () => {
    assert.match(page, /const showForm = \(s: EditSection\) => canWriteRoster && \(!isPhone \|\| isEditing\(s\)\)/);
    for (const s of ['player', 'guardian', 'safety']) {
      assert.match(page, new RegExp(`\\{showForm\\('${s}'\\) \\? \\(`), `section ${s} chooses by showForm`);
      assert.match(page, new RegExp(`action=\\{editAction\\('${s}'\\)\\}`), `section ${s} carries its own Edit`);
    }
  });
  it('a coach without roster-write gets no Edit and keeps the head-coach line', () => {
    assert.match(page, /if \(!canWriteRoster \|\| !isPhone\) return undefined;/);
    assert.match(page, /\{!canWriteRoster && \(\s*<p[^>]*>Only the head coach can edit a player’s record\.<\/p>/);
  });
  it('the removal stays at the foot of the FORM — so on a phone it appears only inside Edit', () => {
    assert.match(page, /\{showForm\('player'\) && \(\s*<div className=\{styles\.playerDangerZone\}>/);
  });
  it('Documents carries no Edit (uploading is not editing)', () => {
    assert.doesNotMatch(page, /sectionId="documents"[^>]*action=/);
  });
});

describe('F1 · Edit is a VISIT, not an address', () => {
  it('lives in page state keyed to the player, false on every load', () => {
    assert.match(page, /useState<\{ playerId: string; sections: EditSection\[\] \} \| null>\(null\)/);
    assert.match(page, /editing\.playerId === playerId/, 'a switch never carries an open form to the next child');
  });
  it('a section holding unsaved work stays OPEN — crossing 640 never hides typed values behind the record (/review)', () => {
    assert.match(page, /const isEditing = \(s: EditSection\) =>\s*\(!!editing && editing\.playerId === playerId && editing\.sections\.includes\(s\)\) \|\| sectionDirty\(s\);/);
  });
  it('the Edit / Done box keeps one id per section, so it never unmounts under the pointer', () => {
    assert.match(page, /id=\{`edit-\$\{s\}`\}/);
  });
  it('is never stored and never written into an address', () => {
    assert.doesNotMatch(page, /localStorage|sessionStorage/);
    assert.doesNotMatch(page, /['"`?&]edit=|searchParams\.get\('edit'\)/);
    assert.doesNotMatch(page, /playerTabHref\([^)]*editing/);
  });
  it('moves focus by hand to each section\'s first writable field, and those fields exist', () => {
    assert.match(page, /SECTION_FIRST_FIELD: Record<EditSection, string> = \{ player: 'pfn', guardian: 'gfn', safety: 'medical' \}/);
    for (const id of ['pfn', 'gfn', 'medical']) assert.match(page, new RegExp(`id="${id}"`));
    assert.match(page, /document\.getElementById\(focusField\.id\)\?\.focus\(\)/);
  });
  it('THE RECORD AUTOSAVES (owner, 2026-09-24) — the shared hook and pill, no save bar, no Discard', () => {
    assert.match(page, /useRecordAutosave\(\{/);
    assert.match(page, /<SaveStatusPill saving=\{saving\} dirty=\{dirty\} error=\{saveError\} onRetry=\{handleSave\} \/>/);
    assert.doesNotMatch(page, /styles\.saveBar|Save changes|endVisit|savedFlash/);
    // Every field marks the record changed — a bare setForm in a handler would edit without saving.
    assert.doesNotMatch(page, /on(Change|Click)=\{[^}]*setForm\(/);
  });
  it('a cleared first name is HELD, not saved as blank, and the field says why', () => {
    assert.match(page, /blocked: form && !form\.playerFirstName\.trim\(\)/);
    assert.match(page, /\{!form\.playerFirstName\.trim\(\) && \(/);
  });
  it('Done asks nothing — it saves what is pending now; the section stays a form until that lands', () => {
    const done = page.slice(page.indexOf('function closeEdit'), page.indexOf('function closeEdit') + 300);
    assert.match(done, /if \(dirty && !saving\) void handleSave\(\);/);
    assert.doesNotMatch(done, /confirm\(/);
  });
  it('switching players saves first and stays put if the save cannot land', () => {
    assert.match(page, /if \(dirty && !\(await handleSave\(\)\)\) return;\s*router\.push\(playerHref\(id\)\);/);
  });
  it('the write updates the SAVED player, never the form — typing during a save is kept', () => {
    const w = page.slice(page.indexOf('const write = useCallback'), page.indexOf('const { saving, dirty'));
    assert.match(w, /setPlayer\(data\.player\);/);
    // …except where the SERVER stored something else (the innings cap "0" → 1), and only when nothing
    // was typed meanwhile: otherwise a phone section reads as unsaved for ever and never closes (/review).
    assert.match(w, /if \(!f \|\| JSON\.stringify\(formToPayload\(f, pitcherPos\)\) !== sig\) return f;/);
    assert.match(w, /if \(storedValue\(f\[k\]\) !== storedValue\(saved\[k\]\)\) next = \{ \.\.\.next, \[k\]: saved\[k\] \};/);
    assert.doesNotMatch(w, /setForm\(playerToForm/, 'never a whole-form reset — it would eat a trailing space mid-word');
  });
  it('a save already in flight is not raced by a second copy (switch, take off the roster)', () => {
    assert.equal((page.match(/if \(saving\) return;\s*if \(dirty && !\(await handleSave\(\)\)\) return;/g) ?? []).length, 2);
  });
});

describe('F2 · the name is the switcher; the sheet is the team sheet\'s twin', () => {
  it('is offered only on a phone, with somewhere to go, for a player on the list', () => {
    assert.match(page, /const canSheet = isPhone && onRoster && roster\.length > 1;/);
  });
  it('the <select> survives above 640 only', () => {
    assert.match(page, /const switchPlayer = !isPhone && roster\.length > 1 \? \(/);
  });
  it('the team sheet\'s twin: the More sheet\'s rows, no stylesheet of its own', () => {
    // Sheet Frame step 2 (2026-10-05): both switchers sit on the portal's sheet frame — its container, dim,
    // label, the dim inside the host's dismiss boundary and the focus hand-back are held by
    // `sheet-frame-guard.test.ts`. This guard keeps F2's own decision: one row density with the team sheet.
    assert.match(readSource(SHEET), /import sheet from '\.\/CoachesBottomNav\.module\.css';/);
    for (const cls of ['dropItem', 'dropActive']) {
      assert.match(sheet, new RegExp(`sheet\\.${cls}\\b`), `uses .${cls}`);
      assert.match(readCode(TEAM_SHEET), new RegExp(`sheet\\.${cls}\\b`), `the team sheet uses .${cls} too`);
    }
    assert.equal((readSource(SHEET).match(/\.module\.css'/g) ?? []).length, 1, 'no local stylesheet');
  });
  it('is a MENU: it does not enrol in the overlay counter (that would hide the bar it is drawn against)', () => {
    assert.doesNotMatch(sheet, /useOverlayOpen/);
    assert.match(sheet, /role="menu"/);
  });
  it('rows are LINKS — the page guard asks the unsaved-changes question on them — tinted "you are here", no chevron', () => {
    assert.match(sheet, /<Link[\s\S]*?role="menuitem"[\s\S]*?aria-current=\{active \? 'true' : undefined\}/);
    // No chevrons on EITHER switcher (owner, 2026-09-24): the tint says where you are.
    assert.doesNotMatch(sheet, /ChevronRight|dropChevron/);
    assert.doesNotMatch(readCode(TEAM_SHEET), /ChevronRight|dropChevron/);
    assert.match(page, /<UnsavedChangesGuard active=\{dirty\} \/>/);
  });
  it('a row keeps the tab the coach was reading and the way back', () => {
    assert.match(page, /const playerHref = \(id: string\) => playerTabHref\(`\$\{base\}\/roster\/\$\{id\}`, tab, \{ returnTo \}\);/);
    assert.match(page, /hrefFor=\{playerHref\}/);
  });
  it('lists ACTIVE players only (a call-up or a departed player is never a row)', () => {
    assert.match(readCode(ROUTE), /roster: rosterRows\.filter\(p => p\.status === 'active'\)/);
  });
  it('the name button IS 44px — its own box, not a small element wearing a big ::after', () => {
    const css = readSource(CSS);
    const rule = css.slice(css.indexOf('.playerNameSwitch {'), css.indexOf('.playerNameSwitch {') + 500);
    assert.match(rule, /min-height: var\(--tap-min, 44px\)/);
    assert.doesNotMatch(css, /\.playerNameSwitch::after/);
  });
  it('the section Edit is ICON-ONLY in the builder\'s 44px icon square — a pencil, then a check (owner, 2026-09-23)', () => {
    assert.match(page, /className=\{`\$\{styles\.footerIconBtn\} \$\{styles\.sectionEditBtn\}`\}/);
    assert.match(page, /\{on \? <Check size=\{18\} aria-hidden \/> : <Pencil size=\{18\} aria-hidden \/>\}/);
    assert.match(page, /aria-label=\{on \? `Done editing \$\{SECTION_TITLE\[s\]\}` : `Edit \$\{SECTION_TITLE\[s\]\}`\}/);
    // The square is 44px at every width the Edit renders at (it renders at ≤640 only).
    assert.match(readSource(CSS), /@media \(max-width: 900px\) \{\s*\.footerIconBtn \{ width: var\(--tap-min, 44px\); height: var\(--tap-min, 44px\); \}/);
  });
});

describe('the section ACTION slot is not the fact slot', () => {
  it('CoachPageSection has its own `action` prop and class, apart from `meta`', () => {
    const s = readCode(SECTION);
    assert.match(s, /\{action && <span className=\{styles\.pageSectionAction\}>\{action\}<\/span>\}/);
    assert.match(s, /\{meta && <span className=\{styles\.pageSectionMeta\}>\{meta\}<\/span>\}/);
  });
});

describe('F3 · this team\'s rooms first — client-side', () => {
  const room = (name: string, staffTeamId: string | null) => ({ name, isStaffRoom: !!staffTeamId, staffTeamId });
  it('this team, then unscoped (tournament) rooms, then other teams under the divider — server order kept inside each', () => {
    const rooms = [room('other-1', 'B'), room('tournament', null), room('mine', 'A'), room('other-2', 'C')];
    const out = orderRoomsForTeam(rooms, 'A');
    assert.deepEqual(out.rooms.map(r => r.name), ['mine', 'tournament', 'other-1', 'other-2']);
    assert.equal(out.dividerAt, 2);
  });
  it('no divider when nothing from another team is listed', () => {
    assert.equal(orderRoomsForTeam([room('mine', 'A'), room('tournament', null)], 'A').dividerAt, -1);
  });
  it('a team with no room of its own: the divider leads, saying so (the UAT fixture today, §11.5b)', () => {
    const out = orderRoomsForTeam([room('x', 'B'), room('y', 'C')], 'A');
    assert.equal(out.dividerAt, 0);
  });
  it('no team in the address leaves the server order alone', () => {
    const rooms = [room('b', 'B'), room('a', 'A')];
    assert.deepEqual(orderRoomsForTeam(rooms, null), { rooms, dividerAt: -1 });
  });
  it('lives in the VIEW, and the service the consumer inbox shares is not taught a team', () => {
    assert.match(readCode(CHAT_VIEW), /orderRoomsForTeam\(rooms, teamId\)/);
    const svc = readCode(CHAT_SERVICE);
    assert.doesNotMatch(svc, /orderRoomsForTeam/);
    assert.match(svc, /export async function listRoomsForUser\(userId: string\): Promise<ChatRoomListItem\[\]>/);
  });
});

describe('the fixture has a FILLED player (§11.7: first task, not last)', () => {
  it('fills every field the read face shows', () => {
    const f = FILLED_PLAYER;
    assert.ok(f.dateOfBirth && f.best.length && f.never.length && f.pitcher.rank && f.bats && f.throws && f.jerseySize);
    assert.ok(f.guardian.phone && f.guardian.email && f.medicalNotes && f.emergency.phone);
  });
  it('fills DEVON — the player the layout sweep opens — and the seeder asserts it on every run', () => {
    assert.equal(FILLED_PLAYER.firstName, 'Devon');
    assert.match(readCode(SEEDER), /await fillPlayerRecord\(db, \{ programYearId: py\.id \}\);/);
  });
});

describe('§228 walk rulings, 2026-09-24 — the Season figures (F5), the emergency rows, Upload in the head', () => {
  const css = readSource(CSS);
  it('F5 · the header is never repeated as a box: no rate box, no recorded box, no field/bench boxes', () => {
    assert.doesNotMatch(page, /statBoxLabel\}>(Attendance|Recorded|Field innings|Bench innings)</);
  });
  it('F5 · on a phone Attendance and Playing time are one line; Attendance has its proportion bar', () => {
    assert.match(page, /function FigureLine\(/);
    assert.equal((page.match(/<FigureLine figures=/g) ?? []).length, 2);
    assert.match(page, /className=\{styles\.attnSplit\} role="img"/);
    for (const k of ['in', 'late', 'out']) assert.ok(css.includes(`.attnSplit i[data-k="${k}"]`), `the ${k} segment is painted`);
  });
  it('F5 · on a phone the dues ladder is a LEDGER, in the ladder\'s order, ending on the balance', () => {
    const led = page.slice(page.indexOf('<dl className={styles.duesLedger}>'), page.indexOf('</dl>', page.indexOf('<dl className={styles.duesLedger}>')));
    const order = ['>Dues<', '>Fundraising<', '>Other credits<', '>Paid<', '>Handed back<', '>Balance<'].map(w => led.indexOf(w));
    assert.ok(order.every(i => i >= 0), 'every ladder line is present');
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'the ledger keeps the ladder\'s arithmetic order');
  });
  it('the emergency contact\'s name and number are two rows; only the number calls', () => {
    assert.match(page, /<RecordRow label="Emergency contact" value=\{player\.emergencyContactName\} kept=\{!pii\} \/>/);
    assert.match(page, /<RecordRow label="Emergency phone" value=\{player\.emergencyContactPhone\}/);
    assert.doesNotMatch(page, /\[player\.emergencyContactName, player\.emergencyContactPhone\]/);
  });
  it('Upload sits in the Documents section head, as the pencils do', () => {
    const docs = readCode('components/coaches/PlayerDocumentsSection.tsx');
    assert.match(docs, /<CoachPageSection sectionId="documents" title="Documents" action=\{uploadButton\}>/);
    assert.match(docs, /isPhone \? `\$\{styles\.footerIconBtn\} \$\{styles\.sectionEditBtn\}`/);
    assert.doesNotMatch(page, /<CoachPageSection sectionId="documents"/, 'the page no longer wraps it');
  });
});
