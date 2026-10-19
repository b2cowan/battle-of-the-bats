import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { filesUnder, openingTags, parseProps, readCode, readSource } from './_source-code.ts';

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
  'app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx', // Skills & goals › Sessions
  'app/[orgSlug]/coaches/teams/[teamId]/history/opponents/panel.tsx', // the Scouting book
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
    // In a coach toolbar the search rides in `filters` (Stage 3), whose box takes the line on a phone.
    assert.match(readCode('components/coaches/kit/CoachKit.module.css'), /\.toolbarEnd:has\(> \[data-search-field="coach"\]\) \{ display: flex; flex: 1 1 100%; \}/);
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
  'app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx', // the state pills (census C5, Stage 3)
  'components/notifications/NotificationFeedBody.tsx', // the zones, coach and admin (census C5, Stage 3)
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

/* ══ Stage 3 — placement (Rules 1 and 2; census C4–C6, C8; 2026-10-19) ══ */

const KIT_TOOLBAR = 'components/coaches/kit/CoachListToolbar.tsx';
const KIT_CSS = 'components/coaches/kit/CoachKit.module.css';
const LIBRARY = 'components/coaches/LibraryRow.tsx';
const NOTIFY_CSS = 'components/notifications/notifications-page.module.css';
const COACH_CSS = 'app/[orgSlug]/coaches/coaches.module.css';
/** Rule 7 — the register exception: the two Ledgers keep their filter row among the toolbar's children. */
const LEDGERS = [
  'app/[orgSlug]/admin/accounting/ledger/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx',
];
/** Every screen whose find-and-narrow rides in `filters`, and what its `filters` must carry. */
const FILTER_HOSTS: Record<string, RegExp> = {
  'app/[orgSlug]/admin/accounting/allocations/page.tsx': /<FilterGroup>\s*<SingleSelectDropdown\s+restQuiet restValue="soon"\s+label="Due"/,
  'app/[orgSlug]/admin/accounting/budget/page.tsx': /<SingleSelectDropdown label="When" restQuiet restValue="all"/,
  'app/[orgSlug]/admin/accounting/payment-requests/page.tsx': /<MultiSelectDropdown restQuiet label="Team"/,
  'app/[orgSlug]/admin/accounting/teams/page.tsx': /<MultiSelectDropdown restQuiet label=\{TEAMS_WORDS\.group\}/,
  'app/[orgSlug]/admin/calendar/page.tsx': /<FilterGroup>[\s\S]*label="Venue"[\s\S]*label="Program"[\s\S]*label="Team"[\s\S]*<\/FilterGroup>\s*\{clashPill && <span className=\{cal\.pillOnLine\}>/,
  'app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx': /<FilterGroup>[\s\S]*W\.facilityPill[\s\S]*W\.groupPill[\s\S]*W\.teamPill[\s\S]*<\/FilterGroup>\s*\{clashPill\}/,
  'app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx': /<SingleSelectDropdown\s+label="Showing"\s+restQuiet\s+restValue="all"/,
  'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx': /<SingleSelectDropdown\s+label="When"\s+restQuiet\s+restValue="all"/,
  'app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx': /<MultiSelectDropdown\s+label="Award"[\s\S]*restQuiet/,
  'app/[orgSlug]/coaches/teams/[teamId]/history/results/panel.tsx': /<SingleSelectDropdown\s+label="Tag"\s+restQuiet\s+restValue="all"/,
  'components/coaches/CoachNotificationsPage.tsx': /role="group" aria-label="Read filter"/,
  [LIBRARY]: /^narrowing$/,
  // Stage 1's two coach searches: find is the right-hand group's too (Rule 2), so the phone rule they needed is gone.
  'app/[orgSlug]/coaches/teams/[teamId]/history/opponents/panel.tsx': /^<SearchField room="coach"/,
  'app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx': /<SearchField room="coach"[^>]*label="Search sessions"/,
};

/** Every `<CoachListToolbar …>` in comment-stripped code: its props and its children ('' when it closes itself). */
function toolbars(code: string, where: string): { props: Map<string, string | null>; children: string }[] {
  let from = 0;
  return openingTags(code, 'CoachListToolbar', where).map(tag => {
    const end = code.indexOf(tag, from) + tag.length;
    from = end;
    return { props: parseProps(tag), children: tag.endsWith('/>') ? '' : code.slice(end, code.indexOf('</CoachListToolbar>', end)) };
  });
}
const propOf = (bar: { props: Map<string, string | null> }, name: string) => bar.props.get(name)?.trim() ?? null;
/** Every product `.tsx` that mounts the toolbar — a raw pre-check first (stripping every file in the tree costs more). */
const TOOLBAR_FILES = [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
  .filter(f => readSource(f).includes('<CoachListToolbar'));
const NARROWING = /\brestQuiet\b|<FilterGroup\b/;

describe('Toolbar Rules · Rules 1 and 2 — find and narrow sit right (Stage 3)', () => {
  it('the kit has ONE place for them: `filters` leads the right-hand group on a desk and steps aside on a phone', () => {
    // The box renders whenever a caller passes `filters`, even while it is off — the actions keep one parent.
    assert.match(readCode(KIT_TOOLBAR), /\{filters !== undefined \? <div className=\{kit\.toolbarEnd\}>\{filters\}\{actionsBox\}<\/div> : actionsBox\}/);
    const css = readCode(KIT_CSS);
    assert.match(css, /\n\.toolbarActions,\s*\.toolbarEnd \{/, 'one rule for the two boxes');
    const end = ruleOf(css, '.toolbarEnd');
    assert.match(end, /margin-left: auto;/, 'the group carries the one auto margin');
    assert.match(end, /justify-content: flex-end;/);
    assert.match(css, /@media \(max-width: 640px\) \{\s*\.toolbarEnd \{ display: contents; \}/, 'a phone keeps each pill where it was (Ask 5)');
    // A coach room's search: the group keeps its frame and its line, the search a full-width row under the narrowings.
    assert.match(css, /\.toolbarEnd:has\(> \[data-search-field="coach"\]\) \{ display: flex; flex: 1 1 100%; \}\s*\.toolbarEnd > \[data-search-field="coach"\] \{ order: 10; \}/);
    assert.doesNotMatch(css, /\.toolbarActions:has\(/, 'a search is never an action, so the actions need no search rule');
  });

  it('no narrowing among a toolbar’s children, and no search among its actions — the two Ledgers keep their row (Rule 7)', () => {
    assert.ok(TOOLBAR_FILES.length >= 30, `the walk found the toolbars (${TOOLBAR_FILES.length} files)`);
    for (const f of TOOLBAR_FILES) {
      for (const bar of toolbars(readCode(f), f)) {
        assert.doesNotMatch(propOf(bar, 'actions') ?? '', /<SearchField\b/, `${f}: a search is find — pass it as \`filters\``);
        if (LEDGERS.includes(f)) continue;
        assert.doesNotMatch(bar.children, NARROWING, `${f}: a narrowing is a child of the toolbar — pass it as \`filters\``);
      }
    }
    for (const f of LEDGERS) {
      assert.ok(toolbars(readCode(f), f).some(bar => NARROWING.test(bar.children)), `${f}: Rule 7’s filter row is where it was`);
    }
  });

  it('every Stage 3 screen passes its find and narrow as `filters`', () => {
    for (const [f, carries] of Object.entries(FILTER_HOSTS)) {
      assert.ok(toolbars(readCode(f), f).some(bar => carries.test(propOf(bar, 'filters') ?? '')), `${f}: its narrowing rides in \`filters\``);
    }
    // The library's `narrowing` is search · Tags · Sort, in that order.
    assert.match(readCode(LIBRARY), /const narrowing = \(\s*<>\s*<SearchField room="coach"[^>]*\/>\s*<MultiSelectDropdown label="Tags"[^>]*restQuiet \/>\s*\{sort\}\s*<\/>\s*\);/);
  });

  it('Schedule detail: the olive View pill leads the toolbar (4+ views — the 6c rule); the head keeps only its title and sentence', () => {
    const f = 'app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx';
    const code = readCode(f);
    const desk = toolbars(code, f).find(bar => /options=\{desktopViews\}/.test(bar.children));
    assert.ok(desk, 'the desk toolbar holds the views');
    assert.match(desk.children, /^\s*<SingleSelectDropdown label="View" lead options=\{desktopViews\} value=\{lens\} onChange=\{next => setLens\(next as Lens\)\} \/>\s*\{dateNav\}\s*$/, 'the View pill, then the week');
    assert.doesNotMatch(code, /<ViewSwitch views=\{desktopViews\}/, 'no switch for four or more views');
    const head = code.slice(code.indexOf('className={sch.scheduleWorkspaceHead}'), code.indexOf('<CoachListToolbar', code.indexOf('scheduleWorkspaceHead')));
    assert.doesNotMatch(head, /<ViewSwitch|<SingleSelectDropdown/);
  });

  it('the Calendar: the dates end the left side, Export alone in the actions', () => {
    const f = 'app/[orgSlug]/admin/calendar/page.tsx';
    const [bar] = toolbars(readCode(f), f);
    assert.match(bar.children, /<div className=\{coach\.calNavOnLine\}>\{dateNav\}<\/div>\s*$/);
    assert.equal(propOf(bar, 'actions'), 'exportMenu');
  });

  it('the counts: ONE wording, "24 drills" / "2 of 24 drills"; Payment requests, the library and Opponents wear it; the picker and the dock have none', () => {
    const kitCode = readCode(KIT_TOOLBAR);
    assert.match(kitCode, /export function ToolbarCount\(\{ total, shown, one, many \}/);
    assert.match(kitCode, /const noun = total === 1 \? one : many;\s*return shown == null \? <><strong>\{total\}<\/strong> \{noun\}<\/> : <><strong>\{shown\}<\/strong> of \{total\} \{noun\}<\/>;/);
    for (const f of TOOLBAR_FILES) {
      for (const bar of toolbars(readCode(f), f)) {
        assert.doesNotMatch(propOf(bar, 'lede') ?? '', /<\/strong> of \{/, `${f}: a hand-built count — use ToolbarCount`);
      }
    }
    const lede = (f: string) => toolbars(readCode(f), f).map(bar => propOf(bar, 'lede') ?? '').join('\n');
    assert.match(lede('app/[orgSlug]/admin/accounting/payment-requests/page.tsx'),
      /<ToolbarCount total=\{all\.length\} shown=\{teams\.size \? waiting\.length \+ decided\.length : undefined\} one="payment request" many="payment requests" \/>/);
    assert.match(lede(LIBRARY), /<ToolbarCount total=\{items\.length\} shown=\{query\.trim\(\) \|\| tagFilter\.size \? shown : undefined\}/);
    assert.match(lede('app/[orgSlug]/coaches/teams/[teamId]/history/opponents/panel.tsx'), /<ToolbarCount total=\{inBook\.length\} shown=\{q \? shown\.length : undefined\}/);
    assert.match(readCode(LIBRARY), /if \(fill\) return <div className=\{styles\.ppDrillFilters\} data-fill>\{narrowing\}<\/div>;/, 'the picker and the dock: no count');
    const practice = 'app/[orgSlug]/coaches/teams/[teamId]/practice';
    for (const [view, noun, one] of [['_DrillsView', 'drills', 'drill'], ['_CircuitsView', 'circuits', 'circuit'], ['_PlanTemplatesView', 'templates', 'template']]) {
      assert.match(readCode(`${practice}/${view}.tsx`), new RegExp(`<LibraryFilterBar items=\\{active\\} noun="${noun}" one="${one}" shown=\\{shown\\.length\\}`));
    }
    const editor = readCode(`${practice}/_PracticePlanEditor.tsx`);
    assert.match(editor, /<LibraryFilterBar [^>]*\bfill \/>/);
    assert.doesNotMatch(editor, /<LibraryFilterBar [^>]*\bshown=/);
  });

  it('Club money and Notifications: the one view pill; the chips they wore are gone (census C5)', () => {
    const club = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx');
    assert.match(club, /\{showFilters && \(\s*<ViewPills\s+label="Which club money"/);
    assert.doesNotMatch(readCode(COACH_CSS), /\.clubChip|\.clubFilterRow/);
    const feed = readCode('components/notifications/NotificationFeedBody.tsx');
    assert.match(feed, /export function NotificationZones\b/);
    assert.doesNotMatch(feed, /NotificationZoneChips|styles\.chip/);
    assert.doesNotMatch(readCode(NOTIFY_CSS), /^\.chips? \{|\.chipActive|\.chipCount/m);
    // Hidden on a phone (owner 2026-09-06), by the stylesheet.
    assert.match(readCode(NOTIFY_CSS), /@media \(max-width: 768px\) \{[\s\S]*\.zones \{ display: none; \}\s*\}/);
    const coach = 'components/coaches/CoachNotificationsPage.tsx';
    const [bar] = toolbars(readCode(coach), coach);
    assert.match(bar.children, /^\s*<NotificationZones feed=\{feed\} \/>\s*$/, 'the zones alone on the left');
  });

  it('Unread · All narrows, so it keeps its square corners at every width (Rule 4) and the coach’s chosen half is the olive tint', () => {
    const css = readCode(NOTIFY_CSS);
    assert.doesNotMatch(css, /\.segToggle \{ border-radius: 999px; \}|\.segBtn \{ border-radius: 999px/);
    assert.match(ruleOf(css, '.segToggle'), /border-radius: 6px;/);
    // The coach's toggle: never the solid fill a primary wears (owner 2026-10-19, on /design's review).
    const coach = readCode('components/coaches/CoachNotificationsPage.tsx');
    assert.equal((coach.match(/styles\.segBtnNarrowOn/g) ?? []).length, 2);
    assert.doesNotMatch(coach, /styles\.segBtnActive/);
    const sheet = readCode(COACH_CSS);
    assert.match(sheet, /\.segBtnActive, \.segBtnActive:hover \{[^}]*\}\s*\.segBtnNarrowOn, \.segBtnNarrowOn:hover \{ background: var\(--home-olive-soft[^}]*color: var\(--home-olive/, 'after the solid face, so order wins');
  });

  it('Insights › Results: one Tag pill, its counts at each row’s end — no row of tag chips (census C6)', () => {
    const results = readCode('app/[orgSlug]/coaches/teams/[teamId]/history/results/panel.tsx');
    assert.match(results, /\.\.\.tagChips\.map\(c => \(\{ id: c\.tag\.id, label: c\.tag\.name, detail: String\(c\.count\) \}\)\)/);
    assert.doesNotMatch(results, /lineupFilterBar|lineupFilterChip/);
    assert.doesNotMatch(readCode(COACH_CSS), /\.lineupFilterChipActive/);
  });

  it('Tryouts check-in: find, then act, on one row at the right of a desk (census C8; owner 2026-10-19)', () => {
    const css = readCode('components/rep-teams/TryoutCheckIn.module.css');
    assert.match(ruleOf(css, '.searchRow'), /justify-content: flex-end;/);
    assert.match(css, /@media \(max-width: 640px\) \{\s*\.searchRow \{ justify-content: flex-start; \}/, 'a phone: the buttons under the field, at the left');
    assert.match(readCode('components/rep-teams/TryoutCheckIn.tsx'),
      /<div className=\{styles\.searchRow\}>\s*<SearchField room="coach"[^>]*\/>\s*<button type="button" className=\{styles\.addBtn\} onClick=\{openWalkup\}>[\s\S]*?onClick=\{printSheet\}[\s\S]*?<\/button>\s*<\/div>/);
  });
});
