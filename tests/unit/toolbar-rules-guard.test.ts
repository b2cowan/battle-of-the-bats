import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';

/**
 * Toolbar Rules (owner ruling 2026-10-17; hub SPjRTAB6kVqd9vJ8x1vuza; plan docs/projects/active/TOOLBAR_RULES_PLAN.md).
 * This pins the rules where a later screen would otherwise copy a neighbour instead of the rule.
 * Stage 1 — Rule 5, ONE search field: every list search wears `SearchField` (or the tournament toolbar's
 * `useToolbarSearch`, built on it) and no list styles its own box.
 */

const FIELD = 'components/shared/SearchField.tsx';
const FIELD_CSS = 'components/shared/SearchField.module.css';
const TOOLBAR_SEARCH = 'components/admin/tournament/useToolbarSearch.tsx';
const TOOLBAR_CSS = 'components/admin/tournament/AdminToolbar.module.css';
const FAMILIES = 'components/admin/kit/club/families/FamiliesBook.tsx';

/** Every list search in plan §2 tagged S. */
const TOURNAMENT_HOSTS = [
  'app/[orgSlug]/admin/tournaments/schedule/components/ScheduleToolbar.tsx', // Schedule and Results
  'components/admin/CheckInBoard.tsx', // the organizer's board and the gate
  'app/[orgSlug]/admin/tournaments/registrations/page.tsx', // Teams
];
const COACH_HOSTS = [
  'components/coaches/LibraryRow.tsx', // Practice plans' three tabs, the drill picker, the docked library
  'app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx', // Skills & Goals › Sessions
  'app/[orgSlug]/coaches/teams/[teamId]/history/opponents/panel.tsx', // the Scouting Book
  'components/rep-teams/TryoutCheckIn.tsx', // coach Tryouts check-in (census C8)
];

describe('Toolbar Rules · Rule 5 — one search field', () => {
  it('the field is rounded, a magnifier, 16rem on a desk, and the room decides its height', () => {
    const tsx = readCode(FIELD);
    const css = readCode(FIELD_CSS);
    assert.match(tsx, /<Search size=\{14\}/);
    assert.match(css, /\.field \{[^}]*border-radius: 999px;/);
    assert.match(css, /\.field\[data-layout="desk"\] \{[^}]*width: 16rem;/);
    assert.match(css, /\.field:focus-within \{ box-shadow: inset 0 0 0 1px var\(--home-olive/);
    assert.match(css, /\.field:has\(input:focus-visible\) \{ outline: 2px solid/, 'the keyboard ring');
    // The ✕ sits beside the label, never inside it (a label holds only the control it names).
    assert.match(tsx, /<\/label>\s*\{value !== '' && \(\s*<button/);
    // admin: the control height, 44 at touch widths; coach rooms: 44 at every width (the car-park rationale).
    assert.match(css, /\.field \{[^}]*min-height: var\(--admin-control-h/);
    assert.match(css, /\.field\[data-search-field="coach"\] \{ min-height: var\(--tap-min, 44px\); \}/);
    // The two phone behaviours: the coach rooms' own full-width row (the field's), the tournament's open row under
    // the line (the toolbar sheet's — a host places the field, it never restyles it).
    assert.match(css, /\.field\[data-search-field="coach"\]\[data-layout="desk"\] \{ display: flex; flex: 1 1 100%; width: 100%; \}/);
    assert.match(readCode('components/coaches/kit/CoachKit.module.css'), /\.toolbarActions:has\(> \[data-search-field="coach"\]\) \{ flex: 1 1 100%; \}/);
    const toolbarCss = readCode(TOOLBAR_CSS);
    assert.match(toolbarCss, /\.phoneSearchRow \{ display: none; \}/);
    assert.match(toolbarCss, /@media \(max-width: 640px\) \{(?:[^{}]*\{[^}]*\})*?\s*\.phoneSearchRow \{ display: flex;/);
  });

  it('words: the hint is always the name and "…"; the name keeps no dots; the ✕ is "Clear the search"', () => {
    const tsx = readCode(FIELD);
    assert.match(tsx, /placeholder=\{`\$\{label\}…`\}/);
    assert.doesNotMatch(tsx, /placeholder\?:/, 'no caller can override the hint and drop the dots');
    assert.match(tsx, /aria-label=\{label\}/);
    assert.match(tsx, /export const CLEAR_SEARCH = 'Clear the search';/);
    assert.match(readCode('lib/schedule-words.ts'), /search: 'Search teams',/, 'the accessible name carries no dots');
    for (const f of [...COACH_HOSTS, ...TOURNAMENT_HOSTS, FAMILIES]) {
      const code = readCode(f);
      assert.doesNotMatch(code, /Find a session/, `${f}: "Search sessions…", as every list says it`);
      assert.doesNotMatch(code, /label="Search[^"]*…"/, `${f}: a field's name never carries the dots`);
    }
  });

  it('the tournament toolbars wear useToolbarSearch — the desk field, the phone square, the open row', () => {
    const hook = readCode(TOOLBAR_SEARCH);
    assert.match(hook, /field: <SearchField /);
    assert.match(hook, /className=\{`\$\{tb\.tool\} \$\{tb\.phoneTool\}`\}/);
    assert.match(hook, /<div className=\{tb\.phoneSearchRow\}>\s*<SearchField [^>]*layout="fill" autoFocus/);
    // Typing keeps the row open (deleting the last letter never shuts it under the thumb); the ✕ closes it and hands
    // focus back to the square (/review).
    assert.match(hook, /onChange=\{next => \{ setOpen\(true\); onChange\(next\); \}\}/);
    assert.match(hook, /onClear=\{\(\) => \{ setOpen\(false\); square\.current\?\.focus\(\); \}\}/);
    for (const f of TOURNAMENT_HOSTS) {
      const code = readCode(f);
      assert.match(code, /useToolbarSearch\(\{ value: /, `${f} uses the shared toolbar search`);
      assert.match(code, /\.row\}/, `${f} places the phone row`);
      assert.doesNotMatch(code, /setSearchOpen/, `${f}: no hand-built copy`);
    }
  });

  it('Families: the shared field right of the Show pill at a desk, always its own row on a phone', () => {
    const code = readCode(FAMILIES);
    assert.match(code, /<SingleSelectDropdown label=\{W\.show\}[^>]*\/>\s*<span className=\{tb\.toolbarSpacer\} aria-hidden \/>\s*<div className=\{tb\.deskFilters\}><SearchField /);
    assert.match(code, /<div className=\{tb\.phoneSearchRow\}><SearchField [^>]*layout="fill" \/><\/div>/);
  });

  it('the coach rooms wear SearchField in the coach room', () => {
    for (const f of COACH_HOSTS) {
      const code = readCode(f);
      assert.match(code, /import SearchField from '@\/components\/shared\/SearchField';/, `${f} imports the field`);
      assert.match(code, /<SearchField room="coach"/, `${f} renders it in the coach room`);
      assert.doesNotMatch(code, /type="search"|inputMode="search"|scoutSearch/, `${f}: no list styles its own box`);
    }
    const editor = readCode('app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx');
    // The drill picker and the docked library fill their row (no count there — plan §2); so does the groups window.
    assert.match(editor, /<LibraryFilterBar [^>]* fill \/>/);
    assert.match(editor, /<SearchField room="coach" layout="fill" value=\{query\} onChange=\{setQuery\} label="Search practices or groups" \/>/);
  });

  it('the looks it replaced are gone, and nothing wears them', () => {
    const toolbarCss = readCode(TOOLBAR_CSS);
    assert.doesNotMatch(toolbarCss, /\.searchField\b|\.phoneSearch\b|\.searchClear\b/);
    assert.doesNotMatch(readCode('app/[orgSlug]/coaches/coaches.module.css'), /\.scoutSearch\b/);
    assert.doesNotMatch(readCode('components/admin/tournament/index.ts'), /ToolbarSearch/);
    assert.doesNotMatch(readCode('components/rep-teams/TryoutCheckIn.module.css'), /^\.search \{/m);
    // A raw pre-check first: stripping comments from every file in the tree costs more than the scan.
    const retired = /tb\.(searchField|phoneSearch|searchClear)\b/;
    const wearers = ['app', 'components']
      .flatMap(root => (readdirSync(root, { recursive: true }) as string[]).map(f => `${root}/${f.replace(/\\/g, '/')}`))
      .filter(f => f.endsWith('.tsx') && retired.test(readSource(f)) && retired.test(readCode(f)));
    assert.deepEqual(wearers, [], 'the retired tournament field');
  });
});
