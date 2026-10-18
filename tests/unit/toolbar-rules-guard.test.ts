import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';

/**
 * Toolbar Rules (owner ruling 2026-10-17; hub SPjRTAB6kVqd9vJ8x1vuza; plan docs/projects/active/TOOLBAR_RULES_PLAN.md).
 * This pins the rules where a later screen would otherwise copy a neighbour instead of the rule.
 * Stage 1 — Rule 5, ONE search field: every list search wears `SearchField` (or the tournament toolbar's
 * `useToolbarSearch`, built on it) and no list styles its own box.
 * Stage 2 — Rules 4 and 6, the shapes: what picks WHICH list is rounded and what narrows keeps its corners; every row
 * of views with counts wears `ViewPills`; Check-in's board (never the day-of bar) switches the pill on at a desk.
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

/** The body of a sheet's top-level rule for `sel` (the first one written at the start of a line). */
const ruleOf = (css: string, sel: string) => {
  const at = css.indexOf(`\n${sel} {`);
  assert.ok(at >= 0, `${sel} is written`);
  return css.slice(at, css.indexOf('}', at));
};

const PILLS = 'components/shared/ViewPills.tsx';
const PILLS_CSS = 'components/shared/ViewPills.module.css';
const CHECK_IN = 'components/admin/CheckInBoard.tsx';
const DAY_OF_BAR = 'components/volunteer/DayOfBottomBars.tsx';
const DAY_OF_CSS = 'components/volunteer/DayOfShell.module.css';
const SCOREKEEPER = 'app/[orgSlug]/scorekeeper/page.tsx';
/** Every row of views with counts (plan §2 Rule 6 and the census). */
const PILL_HOSTS = [
  'app/[orgSlug]/admin/tournaments/results/page.tsx', // the drawing
  'app/[orgSlug]/admin/tournaments/communication/page.tsx',
  'app/[orgSlug]/admin/rep-teams/teams/[teamId]/tryouts/page.tsx',
  CHECK_IN, // on a desk, organizer and gate
];

describe('Toolbar Rules · Rules 4 and 6 — the shapes', () => {
  it('the olive lead picker rounds; the base summary every narrowing pill wears keeps its 8px', () => {
    const css = readCode('components/shared/FilterPill.module.css');
    assert.match(ruleOf(css, '.multiSelectLead > .multiSelectSummary'), /border-radius: 999px;/);
    assert.match(ruleOf(css, '.multiSelectSummary'), /border-radius: 8px;/);
  });

  it('the view switch rounds, its track and its buttons; Teams’ division picker rounds as the Day pill', () => {
    const kitCss = readCode('components/coaches/kit/CoachKit.module.css');
    assert.match(ruleOf(kitCss, '.calViews'), /border-radius: 999px;/);
    assert.match(ruleOf(kitCss, '.calView'), /border-radius: 999px;/);
    assert.doesNotMatch(readCode('app/[orgSlug]/coaches/coaches.module.css'), /^\.calViews? \{/m, 'one home for the look');
    assert.match(ruleOf(readCode(TOOLBAR_CSS), '.divisionSelect'), /border-radius: 999px;/);
    assert.match(ruleOf(readCode('app/[orgSlug]/admin/tournaments/schedule/components/ScheduleDay.module.css'), '.viewPill'), /border-radius: 999px;/);
  });

  it('ONE view pill: rounded, 38px with the tap floor at 768, olive when chosen, its count lighter until chosen', () => {
    const css = readCode(PILLS_CSS);
    const pill = ruleOf(css, '.pill');
    assert.match(pill, /border-radius: 999px;/);
    assert.match(pill, /min-height: 38px;/);
    assert.match(css, /\.pill\[aria-pressed='true'\],\s*\.pill\[aria-pressed='true'\]:hover \{[^}]*border-color: var\(--home-olive\);[^}]*color: var\(--home-olive\);/);
    assert.match(ruleOf(css, '.count'), /opacity: 0\.65;/);
    assert.match(css, /\.pill\[aria-pressed='true'\] \.count \{ opacity: 1; \}/);
    assert.match(css, /@media \(max-width: 768px\) \{\s*\.pill \{ min-height: var\(--tap-min, 44px\); \}/);
    const tsx = readCode(PILLS);
    assert.match(tsx, /role="group" aria-label=\{label\}/);
    assert.match(tsx, /aria-pressed=\{value === v\.id\}/);
    assert.match(tsx, /\{v\.count != null && <span className=\{styles\.count\}>\{v\.count\}<\/span>\}/, 'the count is its own span, never written into the word');
  });

  it('every row of views with counts wears it — no black switch, no " · n", no copy of the recipe', () => {
    for (const f of PILL_HOSTS) {
      const code = readCode(f);
      assert.match(code, /import ViewPills from '@\/components\/shared\/ViewPills';/, `${f} imports the pill`);
      assert.match(code, /<ViewPills\b/, `${f} renders it`);
      assert.doesNotMatch(code, /repKit\.views?\b|repKit\.viewOn|s\.filterChip|\blensPill\b|lensCount|` · \$\{counts\[/, `${f}: no hand-built pill`);
    }
    const repKit = readCode('components/admin/kit/club/RepKit.module.css');
    assert.doesNotMatch(repKit, /^\.views? \{|\.viewOn\b/m, 'the black switch is gone');
    assert.doesNotMatch(readCode('app/[orgSlug]/admin/tournaments/results/results-admin.module.css'), /\.lensPill\b|^\.lens \{/m);
  });

  it('Check-in: the BOARD switches the pill on at a desk; the day-of bar stays the phone’s; the Scorekeeper is untouched', () => {
    const board = readCode(CHECK_IN);
    // The board places both faces: the bar (a phone's) and the pills in the toolbar's own desk slot, which a phone hides.
    assert.match(board, /<DayOfFilterBar label="Arrival filter" inline=\{!pinnedFilters\} className=\{styles\.phoneBar\}>/);
    assert.match(board, /<\/DayOfFilterBar>\s*<div className=\{tb\.deskFilters\}>\s*<ViewPills label="Arrival filter" views=\{arrivalViews\}/);
    const boardCss = readCode('components/admin/CheckInBoard.module.css');
    assert.match(boardCss, /@media \(min-width: 641px\) \{\s*\.toolbar > \.phoneBar \{ display: none; \}/, 'the bar steps out on a desk');
    assert.match(boardCss, /@media \(max-width: 640px\) \{\s*\.toolbar > \.phoneBar \{ flex: 1 1 100%; \}/, 'its own row on a phone');
    assert.match(readCode(TOOLBAR_CSS), /@media \(max-width: 640px\) \{(?:[^{}]*\{[^}]*\})*?\s*\.deskFilters, \.toolbarSpacer \{ display: none; \}/);
    // The bar never turns itself into pills, and draws no desk face of its own.
    const bar = readCode(DAY_OF_BAR);
    assert.doesNotMatch(bar, /ViewPills/);
    assert.doesNotMatch(readCode(DAY_OF_CSS), /filterBarInline \.barBtn|filterBarPhoneOnly/);
    // The Scorekeeper wears the same bar and stays exactly as it is: four boxes at every width.
    const score = readCode(SCOREKEEPER);
    assert.match(score, /<DayOfFilterBar label="Status filter">/);
    assert.doesNotMatch(score, /ViewPills/);
  });

  it('Roster’s List · Depth chart and a player’s Goals / Results take the rounded view switch (census C7)', () => {
    const roster = readCode('app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx');
    assert.match(roster, /<ViewSwitch [^>]*label="Roster view"/);
    const player = readCode('components/coaches/PlayerDevelopmentSection.tsx');
    assert.match(player, /<ViewSwitch [^>]*label="Development views" fill \/>/);
    for (const code of [roster, player]) assert.doesNotMatch(code, /styles\.segChoice|styles\.segBtn/, 'no square segmented switch');
    // One switch, in the kit (no page loads the calendars to draw it); the player record's takes its row on a phone.
    const sw = readCode('components/coaches/kit/ViewSwitch.tsx');
    assert.match(sw, /\$\{kit\.calViews\} \$\{kit\.toolbarView\}\$\{fill \? ` \$\{kit\.toolbarViewFill\}` : ''\}/);
    // The kit barrel exports it, so it may wear the kit's sheet only — the portal's 957 KB sheet would ride into every
    // admin page that imports the kit (/review 2026-10-18).
    assert.doesNotMatch(sw, /coaches\.module\.css/);
    assert.match(readCode('components/coaches/kit/index.ts'), /export \{ default as ViewSwitch \} from '\.\/ViewSwitch';/);
    assert.doesNotMatch(readCode('components/coaches/ScheduleCalendarViews.tsx'), /export function ViewSwitch/);
    assert.match(readCode('components/coaches/kit/CoachKit.module.css'), /@media \(max-width: 640px\) \{\s*\.toolbar \.toolbarViewFill \{ display: grid; width: 100%; \}/);
  });
});
