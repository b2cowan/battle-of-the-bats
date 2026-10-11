/**
 * NEW TOURNAMENT, STEP 2 — THE DIVISIONS AS A TICKED LIST (Tournament admin redesign, walk §290 finding; all seven asks
 * ruled as recommended, 2026-10-11 — sheet L7ddaLNLxucvkZN1vgCLBz, build prompt
 * `TOURNAMENT_ADMIN_REDESIGN_DIVISIONS_STEP_BUILD_PROMPT.md`). What the build must keep true:
 *   - nothing is ticked when the window opens, and only ticked rows are made, previewed and reviewed (Ask 1);
 *   - ONE FLAT LIST, no headings (owner, 2026-10-11, at the build's review — superseding Ask 5): the nine are ready-made
 *     rows, a division you add goes at the end in the order added, and nothing ever moves a row;
 *   - today's three mistakes keep their words, a ticked nameless division is refused in words, and Add refuses a blank
 *     or listed name;
 *   - the ages say what the Divisions page says (one phrase for one fact, /marketing 2026-10-11);
 *   - the form table's one full-screen row is an OPTION — the wizard passes it, New allocation never does (Ask 6);
 *   - the old step is gone: no Start from, no 12U example, no division cards, no row ✕ (Asks 2, 7).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  DIVISION_PRESETS, addDivisionRefusal, divisionMistakeFor, divisionsMistake, divisionsPayload, divisionTotals,
  holdsOpen, openDivision, presetDivisions, setupDivision, starterAges, tickDivisions, tickedDivisions,
  type SetupDivision,
} from '../../lib/tournament-setup-divisions.ts';
import { CREATE_WORDS as W } from '../../lib/tournament-setup-words.ts';
import { agesLine } from '../../lib/division-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ids = () => { let n = 0; return () => `d${++n}`; };
const presets = () => presetDivisions(ids());
const names = (rows: readonly SetupDivision[]) => rows.map(r => r.name);
const tick = (rows: SetupDivision[], ...which: string[]) => rows.map(r => (which.includes(r.name) ? { ...r, ticked: true } : r));
/** What "Add division" does: the window's draft, ticked, at the end of the list. */
const add = (rows: readonly SetupDivision[], id: string, name: string, minAge: string, maxAge: string) =>
  [...rows, setupDivision(id, name, { minAge, maxAge, ticked: true })];

describe('the start (Ask 1): the nine ready-made divisions, none ticked', () => {
  it('U9 … U19, Open, Competitive, Recreational — nothing ticked', () => {
    const rows = presets();
    assert.deepEqual(names(rows), ['U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Open', 'Competitive', 'Recreational']);
    assert.deepEqual(names(rows), [...DIVISION_PRESETS]);
    assert.equal(tickedDivisions(rows).length, 0);
  });
  it('ages fill from the name: U11 is up to age 11 (a typed 12U too), the adult presets are 18 and up', () => {
    assert.deepEqual(starterAges('U11'), { minAge: '', maxAge: '11' });
    assert.deepEqual(starterAges('12U'), { minAge: '', maxAge: '12' });
    assert.deepEqual(starterAges('Open'), { minAge: '18', maxAge: '' });
    assert.deepEqual(starterAges('Varsity'), { minAge: '', maxAge: '' });
    assert.deepEqual(starterAges('U12 Girls'), { minAge: '', maxAge: '12' }, 'a name that starts with its age group');
    assert.deepEqual(starterAges('12U AAA'), { minAge: '', maxAge: '12' });
    assert.deepEqual(starterAges('U123'), { minAge: '', maxAge: '' }, 'never a part of a longer number');
    const u11 = presets()[1];
    assert.equal(u11.capacity, '8', 'every division holds 8 teams until changed');
  });
  it('the window resets to the same start every time it opens', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /useState<SetupDivision\[\]>\(\(\) => presetDivisions\(nextDivisionId\)\)/);
    assert.match(src, /setDivisions\(presetDivisions\(nextDivisionId\)\);/, 'the reset when the window opens');
  });
});

describe('one flat list (owner, 2026-10-11): no headings, the order added, nothing moves', () => {
  it('a division you add goes at the end, ticked — "U21", "Mixed" and "U12 Girls" alike', () => {
    const rows = add(add(add(presets(), 'x', 'U21', '', '21'), 'y', 'Mixed', '', ''), 'z', 'U12 Girls', '', '12');
    assert.deepEqual(names(rows).slice(-4), ['Recreational', 'U21', 'Mixed', 'U12 Girls']);
    assert.equal(rows.at(-1)!.ticked, true, 'it arrives ticked');
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /setDivisions\(ds => \[\.\.\.ds, d\]\);/, 'the window appends what Add gives it');
  });
  it('no headings anywhere: the list draws no group, and nothing groups by age', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.doesNotMatch(src, /groups=\{|FormTableGroup|DIVISION_HEADINGS|d\.heading|headingState|W\.headings/);
    const lib = code('lib/tournament-setup-divisions.ts');
    assert.doesNotMatch(lib, /heading|youth|placeDivision|rehome/i);
    const words = code('lib/tournament-setup-words.ts');
    assert.doesNotMatch(words, /headings|headingTick|headingHint|'Other'/);
  });
  it('nothing new is stored: the payload carries only the division\'s own fields', () => {
    const [payload] = divisionsPayload(tick(presets(), 'U11')).rows;
    assert.deepEqual(Object.keys(payload).sort(), ['capacity', 'maxAge', 'minAge', 'name', 'poolCount', 'poolNames', 'requiresPoolSelection']);
  });
});

describe('only ticked rows are made, previewed and reviewed', () => {
  it('the payload, the totals (the preview, the closing row) and the review count ticked rows only', () => {
    const rows = tick(presets(), 'U11', 'U13', 'U15');
    const { rows: payload, mistake } = divisionsPayload(rows);
    assert.equal(mistake, null);
    assert.deepEqual(payload.map(p => p.name), ['U11', 'U13', 'U15']);
    assert.deepEqual(divisionTotals(rows), { count: 3, spots: 24 });
    assert.deepEqual(divisionTotals(presets()), { count: 0, spots: 0 });
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /const realDivisions = tickedDivisions\(divisions\);/, 'the review step\'s row');
    assert.match(src, /const totals = divisionTotals\(divisions\);\s*const bound = source\.bindDivisions && totals\.count > 0;/, 'the preview');
    assert.match(src, /divisionCount=\{bound \? totals\.count : null\}/);
    assert.match(src, /teamSpots=\{bound \? totals\.spots : null\}/);
  });
  it('none ticked still goes on — Next works, and Create sends no divisions', () => {
    const { rows, mistake } = divisionsPayload(presets());
    assert.equal(mistake, null);
    assert.deepEqual(rows, []);
  });
});

describe('opening and closing a row', () => {
  it('a cleared name HOLDS its arrow or window; named, it closes', () => {
    const opened = openDivision(tick(presets(), 'U11'), presets()[1].id);
    const id = opened[1].id;
    assert.equal(opened[1].openedName, 'U11', 'it remembers the name it opened with');
    assert.equal(holdsOpen(opened, id), false);
    assert.equal(holdsOpen(opened.map(r => (r.id === id ? { ...r, name: ' ' } : r)), id), true);
    assert.equal(holdsOpen(presets().map(r => (r.id === id ? { ...r, name: '' } : r)), id), false, 'an unticked row is never held');
  });
  it('unticked with its name cleared, a row takes back the name it opened with — never a blank row', () => {
    const id = presets()[1].id;
    const rows = openDivision(tick(presets(), 'U11'), id).map(r => (r.id === id ? { ...r, name: '' } : r));
    const out = tickDivisions(rows, [id], false);
    assert.deepEqual([out[1].name, out[1].ticked], ['U11', false]);
    assert.equal(tickDivisions(presets(), ['d1', 'd2'], true).filter(r => r.ticked).length, 2);
    const reopened = openDivision(rows, id);
    assert.equal(reopened[1].openedName, 'U11', 'a cleared name never becomes the name it opened with');
  });
  it('a row keeps its place whatever its ages become (nothing moves a row)', () => {
    const id = presets()[1].id;
    const rows = tickDivisions(presets(), [id], true).map(r => (r.id === id ? { ...r, minAge: '20', maxAge: '' } : r));
    assert.deepEqual(names(tickDivisions(rows, [id], false)), names(presets()));
  });
});

describe('the mistakes', () => {
  it('today\'s three keep their words, read over the TICKED rows only', () => {
    const dup = tick(presets(), 'U11', 'U13').map(r => (r.name === 'U13' ? { ...r, name: 'u11' } : r));
    assert.deepEqual(divisionsMistake(dup), { id: dup[2].id, text: W.divisionDuplicate('u11') }, 'the later row is the one listed twice');
    assert.equal(W.divisionDuplicate('U11'), '“U11” is listed twice. Give each division its own name.');
    const cap = tick(presets(), 'U11').map(r => (r.name === 'U11' ? { ...r, capacity: '0' } : r));
    assert.equal(divisionsMistake(cap)?.text, 'Teams it holds must be at least 1.');
    const ages = tick(presets(), 'U11').map(r => (r.name === 'U11' ? { ...r, minAge: '12' } : r));
    assert.equal(divisionsMistake(ages)?.text, 'The youngest age can’t be more than the oldest.');
    const unticked = presets().map(r => (r.name === 'U11' ? { ...r, capacity: '0', name: 'U9' } : r));
    assert.equal(divisionsMistake(unticked), null, 'an unticked row is never made, so never wrong');
  });
  it('a ticked division with no name is refused in words — never dropped without one', () => {
    const rows = tick(presets(), 'U11').map(r => (r.name === 'U11' ? { ...r, name: '  ' } : r));
    assert.deepEqual(divisionsMistake(rows), { id: rows[1].id, text: 'Give the division a name.' });
    assert.equal(divisionMistakeFor(rows, rows[1].id), 'Give the division a name.');
  });
  it('a red line stands while its mistake does: renaming either of a pair clears it', () => {
    const rows = tick(presets(), 'U11', 'U13').map(r => (r.name === 'U13' ? { ...r, name: 'U11' } : r));
    assert.ok(divisionMistakeFor(rows, rows[2].id));
    const fixed = rows.map(r => (r.id === rows[1].id ? { ...r, name: 'U11 Girls' } : r));
    assert.equal(divisionMistakeFor(fixed, rows[2].id), null);
  });
  it('Add refuses a blank name and a name already listed (ticked or not), in words', () => {
    assert.equal(addDivisionRefusal(presets(), '   '), 'Give the division a name.');
    assert.equal(addDivisionRefusal(presets(), 'u11'), W.divisionDuplicate('u11'), 'U11 is listed, unticked');
    assert.equal(addDivisionRefusal(presets(), 'U12 Girls'), null);
  });
  it('two names are one name by the house\'s one rule — case and spaces aside, as the copy paths read them', () => {
    const rows = add(presets(), 'x', 'U12 Girls', '', '12');
    assert.equal(addDivisionRefusal(rows, ' u12   girls '), W.divisionDuplicate('u12   girls'));
    const twice = add(rows, 'y', 'U12  GIRLS', '', '12');
    assert.ok(divisionMistakeFor(twice, 'y'), 'Next refuses it too');
  });
  it('a mistake opens its division — its arrow at a desk, its window on a phone; several red lines can stand', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /openRow\(m\.id, isPhone \? 'window' : 'arrow'\);/);
    assert.match(src, /if \(mistake\) \{ showDivisionMistake\(mistake\); return; \}/, 'Next');
    assert.match(src, /if \(divMistake\) \{ setStep\('divisions'\); showDivisionMistake\(divMistake\); return; \}/, 'Create');
    assert.match(src, /if \(!holdsOpen\(divisions, id\)\) return true;\s*setFlagged\(s => new Set\(s\)\.add\(id\)\);\s*return false;/, 'a cleared name holds');
    assert.match(src, /useState<ReadonlySet<string>>\(new Set\(\)\)/, 'a set of flagged divisions, not one');
  });
});

describe('the words (/marketing, 2026-10-11)', () => {
  it('the ages say what the Divisions page says, "Any age" when open', () => {
    assert.equal(W.agesColumn('', '11'), 'Up to age 11');
    assert.equal(W.agesColumn('9', '11'), agesLine(9, 11));
    assert.equal(W.agesColumn('9', '11'), 'Ages 9–11');
    assert.equal(W.agesColumn('18', ''), 'Ages 18 and up');
    assert.equal(W.agesColumn('12', '12'), 'Age 12');
    assert.equal(W.agesColumn('', ''), 'Any age');
  });
  it('a phone row\'s line and its door, lower-cased mid-line', () => {
    assert.equal(W.divisionLine('8', '', '11'), '8 teams · up to age 11');
    assert.equal(W.divisionLine('1', '9', '11'), '1 team · ages 9–11');
    assert.equal(W.divisionLine('8', '', ''), '8 teams · any age');
    assert.equal(W.openDivision('U11', '8', '', '11'), 'Open U11: 8 teams, up to age 11');
  });
  it('the count: "3 divisions · 24 team spots"; none ticked, "No divisions yet"', () => {
    assert.equal(W.divisionsBand(3, 24), '3 divisions · 24 team spots');
    assert.equal(W.divisionsBand(1, 1), '1 division · 1 team spot');
    assert.equal(W.divisionsBand(0, 0), 'No divisions yet');
    assert.equal(W.divisionsRow(0), 'No divisions yet', 'the review step and the closing row say one thing');
    assert.equal(W.divisionsRow(6), '6 divisions');
  });
  it('the retired words are gone (Start from, its choices, the 12U example, the row ✕, the old hint)', () => {
    const words = code('lib/tournament-setup-words.ts');
    assert.doesNotMatch(words, /starter|addDivisionPlaceholder|removeDivision|noDivisions/);
    assert.doesNotMatch(words, /\b\d{1,2}U\b/, 'U12, never 12U, for a tournament division (Ask 7)');
  });
});

describe('the form table\'s one full-screen row (Ask 6) — an option, never markup beside it', () => {
  const table = code('components/shared/FormTable.tsx');
  it('the shared table carries the option; at a desk it changes nothing', () => {
    assert.match(table, /phoneRowWindows = false/);
    assert.match(table, /g \? \(phoneRowWindows \? boxGroup\(g\) : groupBand\(g\)\) : null,\s*phoneRowWindows \? boxRecord\(r\) : record\(r\),/,
      'one phone frame; the option switches only the rows');
    assert.equal((table.match(/el\.indeterminate = g\.state === 'some'/g) ?? []).length, 1, 'the mixed box, once');
    assert.match(table, /<label className=\{styles\.boxCell\} htmlFor=\{id\}>\{tickInput\(r, id\)\}<\/label>\s*<button type="button" className=\{styles\.door\} aria-label=\{r\.phoneOpen\.label\} onClick=\{r\.phoneOpen\.onOpen\}>/,
      'a ticked row: its box, then ONE button to its window');
    assert.match(table, /<ChevronRight size=\{16\} aria-hidden className=\{styles\.doorChevron\} \/>/, 'the house row chevron');
    const css = read('components/shared/FormTable.module.css');
    assert.match(css, /\.boxCell \{[^}]*width: 48px;[^}]*padding-left: 12px;/, 'one 48px box column, 12px from the edge');
    assert.match(css, /\.tick \{[^}]*width: 18px;[^}]*height: 18px;/, 'the tick box stays 18px');
  });
  it('the touch band (641–768) keeps the desk table, so its figure input meets the tap floor there', () => {
    const css = read('components/admin/TournamentSetupWizard.module.css');
    assert.match(css, /@media \(max-width: 768px\) \{[\s\S]*?\.teamsCell > input \{ min-height: var\(--tap-min, 44px\); \}/);
    assert.match(code('components/admin/TournamentSetupWizard.tsx'), /<span className=\{styles\.teamsCell\}>\s*<input className=\{`\$\{ck\.input\} \$\{moneyKit\.shareInput\}`\}/,
      'New allocation\'s 32px figure input, never a second one');
  });
  it('one keyed list, never an array per row — a row keeps its element across any re-order', () => {
    assert.equal((table.match(/rows\.flatMap\(r => \{/g) ?? []).length, 2, 'the phone frame and the desk table');
    assert.doesNotMatch(table, /rows\.map\(r => \{\s*const g = headsBefore/);
  });
  it('a row\'s arrow and its form show only while it is ticked', () => {
    assert.match(table, /const toggle = \(r: FormTableRow\) => r\.ticked && r\.expand && \(/);
    assert.match(table, /const formOpen = \(r: FormTableRow\) => r\.ticked && r\.expand\?\.open;/);
  });
  it('the wizard passes the option; New allocation never does (its rows keep opening in place)', () => {
    assert.match(code('components/admin/TournamentSetupWizard.tsx'), /<FormTable[\s\S]*?phoneRowWindows[\s\S]*?\/>/);
    assert.doesNotMatch(code('components/admin/kit/club/money/AllocationWindow.tsx'), /phoneRowWindows|phoneOpen/);
  });
  it('the standard says it, as the form table\'s one full-screen row', () => {
    const std = read('docs/agents/design/TABLE_AND_LIST_STANDARD.md');
    assert.match(std, /the form table's one full-screen row\*\* \(owner, 2026-10-11, walk §290 Ask 6\)/);
  });
});

describe('the old step is gone (Asks 2, 7)', () => {
  const src = code('components/admin/TournamentSetupWizard.tsx');
  it('no Start from select, no add-a-name field, no division cards, no row ✕', () => {
    assert.doesNotMatch(src, /new-t-starter|new-t-add-division|divisionPreset|setNewDivision/);
    assert.doesNotMatch(src, /styles\.(division|divisions|divisionHead|remove|starter|checkLine|pools)\b/);
    assert.doesNotMatch(src, /✕|removeDivision/);
    assert.doesNotMatch(src, /W\.starter/);
  });
  it('a division\'s window is the kit\'s form window, raised — never a half sheet; the edit window has no foot', () => {
    const sheet = code('components/admin/tournament/DivisionSheet.tsx');
    assert.equal((sheet.match(/kind="form"\s*raised/g) ?? []).length, 2, 'add and edit');
    const edit = sheet.slice(sheet.indexOf('function EditDivision'));
    assert.doesNotMatch(edit, /footer=/, 'no Done beside ←');
    assert.match(sheet, /onAdd\(\{ \.\.\.draft, name: draft\.name\.trim\(\) \}\)/);
    assert.match(edit, /kind="form"\s*raised\s*record/, 'a record: it opens on its panel, never the name (no phone keyboard)');
  });
});
