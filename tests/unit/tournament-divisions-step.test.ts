/**
 * NEW TOURNAMENT, STEP 2 — THE DIVISIONS, A LIST OF ONLY YOURS (Tournament admin redesign, walk §290 finding; round 3,
 * ruled 2026-10-12 — the owner: "looks good, build as mocked", all four asks as recommended; sheet
 * L7ddaLNLxucvkZN1vgCLBz version 5). What the build must keep true:
 *   - the list starts EMPTY and holds only the divisions added: every row is made, previewed and reviewed;
 *   - the nine common divisions are SUGGESTIONS (Ask 1), offered while no listed division has that name — removed or
 *     renamed, offered again, never letter by letter while an open row's name is typed;
 *   - your own name goes in the same field, Add or Enter (Ask 3); a blank or listed name is refused in words; the
 *     "New division" window is retired;
 *   - a division leaves by "Remove this division" at the end of its own fields (Ask 2) — no tick, no mark on the row;
 *   - only an age-group name gives ages (Ask 4): Open, Competitive and Recreational are Any age;
 *   - ONE FLAT LIST (owner, 2026-10-11): the order added, nothing moves a row, no headings;
 *   - the form table's `allIn` (no tick) and one full-screen row are OPTIONS — the wizard passes them, New allocation
 *     never does.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  DIVISION_PRESETS, addDivisionRefusal, divisionMistakeFor, divisionsMistake, divisionsPayload,
  divisionTotals, holdsOpen, openDivision, removeDivision, setupDivision, starterAges, suggestedDivisions,
  type SetupDivision,
} from '../../lib/tournament-setup-divisions.ts';
import { CREATE_WORDS as W } from '../../lib/tournament-setup-words.ts';
import { agesLine } from '../../lib/division-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const names = (rows: readonly SetupDivision[]) => rows.map(r => r.name);
/** Adds each name in turn, as the field or a suggestion does (refused, or at the end); ids d1, d2, … */
const listOf = (...these: string[]) => these.reduce<SetupDivision[]>((rows, n, i) => {
  assert.equal(addDivisionRefusal(rows, n), null, `"${n}" adds`);
  return [...rows, setupDivision(`d${i + 1}`, n.trim())];
}, []);

describe('the start: an empty list, and the nine as suggestions (Ask 1)', () => {
  it('nothing is listed; all nine are offered, in their order', () => {
    assert.deepEqual(suggestedDivisions([]), ['U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Open', 'Competitive', 'Recreational']);
    assert.deepEqual(suggestedDivisions([]), [...DIVISION_PRESETS]);
    assert.deepEqual(divisionTotals([]), { count: 0, spots: 0 });
  });
  it('the window resets to an empty list, an empty field and no refusal every time it opens', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /useState<SetupDivision\[\]>\(\[\]\)/);
    for (const reset of ["setDivisions([]);", "setTypedDivision('');", "setAddRefusal('');"]) assert.ok(src.includes(reset), 'the reset when the window opens: ' + reset);
    assert.doesNotMatch(src, /presetDivisions|tickDivisions|tickedDivisions/);
  });
  it('a listed division is no longer offered — case and spaces aside', () => {
    assert.deepEqual(suggestedDivisions(listOf('U11', ' open ')), ['U9', 'U13', 'U15', 'U17', 'U19', 'Competitive', 'Recreational']);
  });
  it('removed or renamed, it is offered again — but not while its row is open, so it never flickers as you type', () => {
    const rows = listOf('U11', 'U13');
    assert.ok(suggestedDivisions(removeDivision(rows, 'd1')).includes('U11'), 'removed: offered again');
    const opened = openDivision(rows, 'd1').map(r => (r.id === 'd1' ? { ...r, name: 'U11 Girls' } : r));
    assert.ok(!suggestedDivisions(opened, new Set(['d1'])).includes('U11'), 'open: it holds the name it opened with');
    assert.ok(suggestedDivisions(opened).includes('U11'), 'closed: "U11" comes back for U11 Boys');
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /suggestedDivisions\(divisions, [^;]*openRows[^;]*divisionWindow/, 'the open rows: every arrow at a desk, the window on a phone');
  });
  it('a suggestion adds its division and leaves; focus moves to the next one along, or back to the field', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /onClick=\{\(\) => addSuggestedDivision\(p, offered\)\}/);
    assert.match(src, /aria-label=\{W\.addSuggestion\(p\)\}/);
    const fn = src.slice(src.indexOf('function addSuggestedDivision'), src.indexOf('function removeRow'));
    assert.match(fn, /offered\[at \+ 1\] \?\? offered\[at - 1\]/, 'the next one along, or the one before');
    assert.match(fn, /requestAnimationFrame\([\s\S]*?divisionField\.current/, 'or back to the field once the row is empty');
  });
});

describe('your own name (Ask 3): the same field, Add or Enter', () => {
  it('a typed name goes at the end, with the ages its name gives and 8 teams', () => {
    const rows = listOf('U11', 'U12 Girls', 'Mixed');
    assert.deepEqual(names(rows), ['U11', 'U12 Girls', 'Mixed']);
    assert.deepEqual([rows[1].maxAge, rows[1].capacity], ['12', '8']);
    assert.deepEqual([rows[2].minAge, rows[2].maxAge], ['', ''], 'Mixed: Any age');
  });
  it('a blank name or one already listed is refused in words, and the list is unchanged', () => {
    const rows = listOf('U12 Girls');
    assert.equal(addDivisionRefusal(rows, '   '), 'Give the division a name.');
    assert.equal(addDivisionRefusal(rows, ' u12   girls '), W.divisionListed('u12   girls'), 'case and spaces aside');
    assert.equal(W.divisionListed('U11'), '“U11” is already in the list.');
    const src = code('components/admin/TournamentSetupWizard.tsx');
    const fn = src.slice(src.indexOf('function addNamedDivision'), src.indexOf('function addTypedDivision'));
    assert.match(fn, /if \(refusal\) return false;[\s\S]*setDivisions\(ds => \[\.\.\.ds, setupDivision\(id, name\.trim\(\)\)\]\)/,
      'refused, the list is unchanged; otherwise the division goes at the end');
    assert.ok(fn.indexOf('nextDivisionId()') > fn.indexOf('if (refusal) return false;'), 'a refused name takes no id');
  });
  it('Enter adds, the field keeps focus, and a refusal is said under the field', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /e\.key === 'Enter'[^}]*addTypedDivision\(\)/, 'Enter adds');
    const fn = src.slice(src.indexOf('function addTypedDivision'), src.indexOf('function addSuggestedDivision'));
    assert.match(fn, /divisionField\.current\?\.focus\(\)/, 'the field keeps focus, added or refused');
    assert.match(src, /<FormError inPlace>\{addRefusal\}<\/FormError>/, 'the refusal under the field');
  });
  it('the field and the suggestions sit ABOVE the list (the design review) — an empty list draws no table (§3.7)', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    const at = (s: string) => src.indexOf(s);
    assert.ok(at('id="new-t-division"') > 0 && at('id="new-t-division"') < at('className={styles.suggestions}'));
    assert.ok(at('className={styles.suggestions}') < at('<FormTable'));
    assert.match(src, /\{divisions\.length > 0 && \(\s*<FormTable/);
  });
  it('the "New division" window is retired; the division window is the phone\'s edit window only', () => {
    const sheet = code('components/admin/tournament/DivisionSheet.tsx');
    assert.doesNotMatch(sheet, /AddDivision|mode: 'add'|W\.newDivision|addDivisionButton/);
    assert.doesNotMatch(code('components/admin/TournamentSetupWizard.tsx'), /mode: 'add'|W\.addDivision\b|addDivisionButton/);
    assert.doesNotMatch(code('lib/tournament-setup-words.ts'), /newDivision|addDivisionButton|addDivision:/);
  });
});

describe('the /review fixes (round 3)', () => {
  const src = code('components/admin/TournamentSetupWizard.tsx');
  it('a name typed but never added stops Next, in words — never dropped silently', () => {
    const next = src.slice(src.indexOf('function next()'), src.indexOf('function back()'));
    assert.ok(next.indexOf('typedDivision.trim()') > -1 && next.indexOf('typedDivision.trim()') < next.indexOf('divisionsPayload(divisions)'),
      'checked before the divisions are read');
    assert.match(next, /setAddRefusal\(W\.divisionNotAdded\(/);
    assert.equal(W.divisionNotAdded('Varsity'), '“Varsity” isn’t in the list yet. Press Add, or clear the box.');
  });
  it('Remove clears its own red line and a stale refusal, never another division\'s error', () => {
    const fn = src.slice(src.indexOf('function removeRow'), src.indexOf('function openRow'));
    assert.match(fn, /if \(flagged\.has\(id\)\) setError\(''\);/);
    assert.match(fn, /setAddRefusal\(''\);/);
    assert.match(src.slice(src.indexOf('function back()'), src.indexOf('function requestClose')), /setAddRefusal\(''\);/, 'Back too');
  });
  it('focus returns to the field at a desk only (a phone would raise its keyboard), without scrolling', () => {
    assert.match(src, /function focusDivisionField\(\) \{\s*if \(!isPhone\) divisionField\.current\?\.focus\(\{ preventScroll: true \}\);/);
    assert.match(src.slice(src.indexOf('function removeRow'), src.indexOf('function openRow')), /requestAnimationFrame\(focusDivisionField\)/);
  });
  it('Enter never adds a word an input method is still composing', () => {
    assert.match(src, /e\.key === 'Enter' && !e\.nativeEvent\.isComposing/);
  });
});

describe('a division leaves from its own fields (Ask 2)', () => {
  it('removeDivision takes it out; the rest keep their order', () => {
    assert.deepEqual(names(removeDivision(listOf('U11', 'U13', 'Mixed'), 'd2')), ['U11', 'Mixed']);
  });
  it('"Remove this division" ends the fields — the record\'s rare door, in ink (RecordAction), at both widths', () => {
    const sheet = code('components/admin/tournament/DivisionSheet.tsx');
    const fields = sheet.slice(sheet.indexOf('export function DivisionFields'), sheet.indexOf('export default function DivisionSheet'));
    assert.ok(fields.lastIndexOf('<RecordAction') > fields.lastIndexOf('usePools'), 'after the pools: the last thing in the fields');
    assert.match(fields, /<RecordAction[\s\S]*?onClick=\{onRemove\}>\{W\.removeDoor\}<\/RecordAction>/);
    assert.doesNotMatch(sheet, /RecordDelete/, 'ink, not red: nothing is saved yet');
    assert.equal(W.removeDoor, 'Remove this division');
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /onRemove=\{\(\) => removeRow\(d\.id\)\}/, 'the desk\'s arrow');
    assert.match(src, /onRemove=\{\(\) => removeRow\(editing\.id\)\}/, 'the phone\'s window');
  });
  it('no tick and no mark on a row: the table is allIn', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /<FormTable[\s\S]*?allIn[\s\S]*?\/>/);
    assert.doesNotMatch(src, /ticked:|onTick|tickLabel|tickRows/);
  });
});

describe('ages come from an age-group name only (Ask 4)', () => {
  it('U11 is up to age 11 (a typed 12U too); Open, Competitive and Recreational are Any age', () => {
    assert.deepEqual(starterAges('U11'), { minAge: '', maxAge: '11' });
    assert.deepEqual(starterAges('12U'), { minAge: '', maxAge: '12' });
    assert.deepEqual(starterAges('U12 Girls'), { minAge: '', maxAge: '12' }, 'a name that starts with its age group');
    assert.deepEqual(starterAges('12U AAA'), { minAge: '', maxAge: '12' });
    assert.deepEqual(starterAges('U123'), { minAge: '', maxAge: '' }, 'never a part of a longer number');
    for (const n of ['Open', 'Competitive', 'Recreational', 'Varsity']) assert.deepEqual(starterAges(n), { minAge: '', maxAge: '' }, n);
    assert.equal(W.agesColumn(setupDivision('x', 'Open').minAge, setupDivision('x', 'Open').maxAge), 'Any age');
    assert.doesNotMatch(code('lib/tournament-setup-divisions.ts'), /ADULT_PRESETS|'18'/);
  });
});

describe('every row is made, previewed and reviewed; one flat list', () => {
  it('the payload, the totals (the preview, the closing row) and the review count every row', () => {
    const rows = listOf('U11', 'U13', 'U15');
    const { rows: payload, mistake } = divisionsPayload(rows);
    assert.equal(mistake, null);
    assert.deepEqual(payload.map(p => p.name), ['U11', 'U13', 'U15']);
    assert.deepEqual(divisionTotals(rows), { count: 3, spots: 24 });
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(src, /title=\{W\.divisionsRow\(divisions\.length\)\}/, 'the review step\'s row');
    assert.match(src, /const totals = divisionTotals\(divisions\);\s*const bound = source\.bindDivisions && totals\.count > 0;/, 'the preview');
  });
  it('none still goes on — Next works, and Create sends no divisions', () => {
    assert.deepEqual(divisionsPayload([]), { rows: [], mistake: null });
  });
  it('nothing new is stored: the payload carries only the division\'s own fields', () => {
    const [payload] = divisionsPayload(listOf('U11')).rows;
    assert.deepEqual(Object.keys(payload).sort(), ['capacity', 'maxAge', 'minAge', 'name', 'poolCount', 'poolNames', 'requiresPoolSelection']);
  });
  it('no headings anywhere, and a row keeps its place whatever its ages become', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    assert.doesNotMatch(src, /groups=\{|FormTableGroup|d\.heading|headingState|W\.headings/);
    assert.doesNotMatch(code('lib/tournament-setup-divisions.ts'), /heading|youth|placeDivision|rehome/i);
    const rows = listOf('U11', 'U13').map(r => (r.id === 'd1' ? { ...r, minAge: '20', maxAge: '' } : r));
    assert.deepEqual(names(rows), ['U11', 'U13']);
  });
});

describe('opening and closing a row', () => {
  it('a cleared name HOLDS its arrow or window; named, it closes', () => {
    const opened = openDivision(listOf('U11'), 'd1');
    assert.equal(opened[0].openedName, 'U11', 'it remembers the name it opened with');
    assert.equal(holdsOpen(opened, 'd1'), false);
    assert.equal(holdsOpen(opened.map(r => ({ ...r, name: ' ' })), 'd1'), true);
    const reopened = openDivision(opened.map(r => ({ ...r, name: '' })), 'd1');
    assert.equal(reopened[0].openedName, 'U11', 'a cleared name never becomes the name it opened with');
  });
  it('removing a division closes its arrow or window and clears its red line', () => {
    const src = code('components/admin/TournamentSetupWizard.tsx');
    const fn = src.slice(src.indexOf('function removeRow'), src.indexOf('function openRow'));
    assert.match(fn, /setOpenRows\(/);
    assert.match(fn, /setFlagged\(/);
    assert.match(fn, /if \(divisionWindow\?\.id === id\) setDivisionWindow\(null\);/);
  });
});

describe('the mistakes', () => {
  it('the four keep their words, over every row', () => {
    const dup = listOf('U11', 'U13').map(r => (r.name === 'U13' ? { ...r, name: 'u11' } : r));
    assert.deepEqual(divisionsMistake(dup), { id: 'd2', text: W.divisionDuplicate('u11') }, 'the later row is the one listed twice');
    assert.equal(W.divisionDuplicate('U11'), '“U11” is listed twice. Give each division its own name.');
    const cap = listOf('U11').map(r => ({ ...r, capacity: '0' }));
    assert.equal(divisionsMistake(cap)?.text, 'Teams it holds must be at least 1.');
    const ages = listOf('U11').map(r => ({ ...r, minAge: '12' }));
    assert.equal(divisionsMistake(ages)?.text, 'The youngest age can’t be more than the oldest.');
    const nameless = listOf('U11').map(r => ({ ...r, name: '  ' }));
    assert.deepEqual(divisionsMistake(nameless), { id: 'd1', text: 'Give the division a name.' });
  });
  it('a red line stands while its mistake does: renaming either of a pair clears it', () => {
    const rows = listOf('U11', 'U13').map(r => (r.name === 'U13' ? { ...r, name: 'U11' } : r));
    assert.ok(divisionMistakeFor(rows, 'd2'));
    assert.equal(divisionMistakeFor(rows.map(r => (r.id === 'd1' ? { ...r, name: 'U11 Girls' } : r)), 'd2'), null);
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

describe('the words (/marketing, 2026-10-11 and 2026-10-12)', () => {
  it('the lede, the field, the suggestions, the door', () => {
    assert.equal(W.divisionsLede, 'Add the divisions teams can register in. You can skip this and add them later.');
    assert.equal(W.divisionName, 'Division name');
    assert.equal(W.divisionPlaceholder, 'e.g. U11 Girls', 'step 1\'s form: "e.g. Spring Classic 2027"');
    assert.equal(W.add, 'Add');
    assert.equal(W.suggestionsLabel, 'Common divisions');
    assert.equal(W.addSuggestion('U11'), 'Add U11');
  });
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
  it('the count: "3 divisions · 24 team spots"; none, "No divisions yet"', () => {
    assert.equal(W.divisionsBand(3, 24), '3 divisions · 24 team spots');
    assert.equal(W.divisionsBand(1, 1), '1 division · 1 team spot');
    assert.equal(W.divisionsBand(0, 0), 'No divisions yet');
    assert.equal(W.divisionsRow(0), 'No divisions yet', 'the review step and the closing row say one thing');
    assert.equal(W.divisionsRow(6), '6 divisions');
  });
  it('U12, never 12U, for a tournament division', () => {
    assert.doesNotMatch(code('lib/tournament-setup-words.ts'), /\b\d{1,2}U\b/);
  });
});

describe('the form table: `allIn` and the one full-screen row are options, never markup beside it', () => {
  const table = code('components/shared/FormTable.tsx');
  it('allIn: the name alone in the lead cell, every row live and in — no box anywhere', () => {
    assert.match(table, /allIn = false/);
    assert.match(table, /return allIn \? <span className=\{styles\.leadName\}>\{name\}<\/span> :/, 'the name alone, written once');
    assert.match(table, /const isIn = \(r: Row\) => allIn \|\| r\.ticked === true;/);
    assert.match(table, /const live = \(r: Row\) => allIn \|\| Boolean\(r\.onTick\);/);
    assert.match(table, /const toggle = \(r: Row\) => isIn\(r\) && r\.expand/, 'the arrow on every row that is in');
    assert.match(table, /if \(allIn\) return <div key=\{r\.key\}[^>]*>\{door\}<\/div>;/, 'a phone row is one door');
    const css = read('components/shared/FormTable.module.css');
    assert.match(css, /\.doorAlone \{ padding-left: 0\.75rem; \}/, 'the door from the frame\'s edge');
    assert.match(css, /\.allIn \.table \.formCell \{ padding-left: 0\.7rem; \}/, 'a row\'s form under its name');
  });
  it('a ticked table is unchanged: its box, then ONE button to its window; the house row chevron', () => {
    assert.match(table, /<label className=\{styles\.boxCell\} htmlFor=\{id\}>\{tickInput\(r, id\)\}<\/label>\s*\{door\}/);
    assert.match(table, /export interface FormTableRow extends FormTableRowBase \{\s*ticked: boolean;[\s\S]*?tickLabel: string;/,
      'a ticking table keeps its tick and its name required');
    assert.match(table, /\| \{ allIn: true; rows: readonly FormTableInRow\[\] \}/, 'only an allIn table takes rows without one');
    assert.match(table, /<ChevronRight size=\{16\} aria-hidden className=\{styles\.doorChevron\} \/>/);
    assert.equal((table.match(/el\.indeterminate = g\.state === 'some'/g) ?? []).length, 1, 'the mixed box, once');
    const css = read('components/shared/FormTable.module.css');
    assert.match(css, /\.boxCell \{[^}]*width: 48px;[^}]*padding-left: 12px;/, 'one 48px box column, 12px from the edge');
    assert.match(css, /\.tick \{[^}]*width: 18px;[^}]*height: 18px;/, 'the tick box stays 18px');
  });
  it('one keyed list, never an array per row — a row keeps its element across any re-order', () => {
    assert.equal((table.match(/rows\.flatMap\(r => \{/g) ?? []).length, 2, 'the phone frame and the desk table');
    assert.doesNotMatch(table, /rows\.map\(r => \{\s*const g = headsBefore/);
  });
  it('the touch band (641–768) keeps the desk table: its figure input, Add and the suggestions meet the tap floor', () => {
    const css = read('components/admin/TournamentSetupWizard.module.css');
    assert.match(css, /@media \(max-width: 768px\) \{\s*\.addButton,\s*\.suggestion \{ min-height: var\(--tap-min, 44px\); \}[\s\S]*?\.teamsCell > input \{ min-height: var\(--tap-min, 44px\); \}/);
    assert.match(css, /\.suggestion \{[^}]*min-height: var\(--admin-control-h\);[^}]*border-radius: 999px;/, 'the club scheduler\'s day pill');
    assert.match(code('components/admin/TournamentSetupWizard.tsx'), /<span className=\{styles\.teamsCell\}>\s*<input className=\{`\$\{ck\.input\} \$\{moneyKit\.shareInput\}`\}/,
      'New allocation\'s 32px figure input, never a second one');
  });
  it('the wizard passes both options; New allocation passes neither', () => {
    assert.match(code('components/admin/TournamentSetupWizard.tsx'), /<FormTable[\s\S]*?allIn\s*phoneRowWindows[\s\S]*?\/>/);
    assert.doesNotMatch(code('components/admin/kit/club/money/AllocationWindow.tsx'), /phoneRowWindows|phoneOpen|allIn/);
  });
  it('the standard says both: the one full-screen row, and a form table whose rows are all in', () => {
    const std = read('docs/agents/design/TABLE_AND_LIST_STANDARD.md');
    assert.match(std, /the form table's one full-screen row\*\* \(owner, 2026-10-11, walk §290 Ask 6\)/);
    assert.match(std, /\*\*A form table whose rows are all in carries no tick\*\*/);
  });
});

describe('the division window', () => {
  const sheet = code('components/admin/tournament/DivisionSheet.tsx');
  it('the kit\'s form window, raised, a record with no foot — never a half sheet, never a Done beside ←', () => {
    // `medium`: a record keeps today's 640 (One Window Stage 1, call S4, 2026-10-18).
    assert.match(sheet, /kind="form"\s*size="medium"\s*raised\s*record/, 'a record: it opens on its panel, never the name (no phone keyboard)');
    assert.doesNotMatch(sheet, /footer=/);
  });
});
