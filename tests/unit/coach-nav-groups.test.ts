import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';
import * as visibility from '../../lib/coach-nav-visibility.ts';
import {
  OVERVIEW_ITEM, SEASON_END_ITEM, TEAM_NAV_GROUPS, COACH_MORE_SECTIONS, COACH_NAV_ITEMS, PHONE_PRIMARY_HREFS,
  coachNavGroupsFor,
} from '../../lib/coach-team-nav.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';
import { stripComments } from './_source-code.ts';
import { COACH_TEAM_PAGE } from '../../lib/notification-view.ts';
import { CHAT_PAUSED } from '../../lib/chat-pause.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE COACH NAV'S TWO STANDING INVARIANTS (plan Phase 4, owner-approved 2026-08-15)
 *
 * The regroup ordered six fixed groups by how often a coach opens them and deleted the "Explore"
 * shelf. Both of the things that could go wrong are invisible at review time and expensive later:
 *
 *   1. **A RENAMED ITEM SILENTLY OPENS A DOOR.** `isCoachNavItemVisible` is a switch keyed by
 *      DISPLAY LABEL with `default: return true`. Rename "Money" and an assistant with no money
 *      grant gets the Money door. Group HEADINGS are free (nothing gates on them); item labels
 *      are not. This file pins the label set so a rename has to be deliberate.
 *
 *   2. **THE TWO NAVS DRIFT APART.** ⚖ Since navigation Phase 4 (2026-11-11) they cannot: the sidebar, the phone's More
 *      sheet and the strip's page name all read ONE list (`lib/coach-team-nav.ts`), which this file imports as VALUES —
 *      it read two module-local literals back out of two components' source until then. What is left to pin is that both
 *      navs still read it, and that the sheet is exactly the sidebar minus the bar's tabs.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

const SIDEBAR_CODE = stripComments(read('components/coaches/CoachesSidebar.tsx'));
const BOTTOM = read('components/coaches/CoachesBottomNav.tsx');
const BOTTOM_CODE = stripComments(BOTTOM);
const NAV_CODE = stripComments(read('lib/coach-team-nav.ts'));

/** The sidebar's labels in order: the landing slot's two (whichever the season's state calls for), then every group's. */
const sidebarItems = [OVERVIEW_ITEM.label, SEASON_END_ITEM.label, ...TEAM_NAV_GROUPS.slice(1).flatMap(g => g.items.map(i => i.label))];
const sidebarGroups = TEAM_NAV_GROUPS.map(g => g.label).filter((l): l is string => !!l);
const bottomItems = COACH_MORE_SECTIONS.flatMap(s => s.items.map(i => i.label));
const bottomGroups = COACH_MORE_SECTIONS.map(s => s.header);

describe('nav item labels are the capability-gate keys, so they are pinned', () => {
  /**
   * ⚠ CHANGING THIS LIST IS THE DECISION POINT. A label here is the exact string
   * `isCoachNavItemVisible` switches on. If you are renaming a door, you must also add a `case`
   * for the new label (keeping the old one as a fallthrough is the established pattern — the
   * portal tour still asks for "Announcements" by its pre-Chunk-B name).
   */
  const EXPECTED_ITEMS = [
    // The landing slot — whichever of the two the season's state calls for.
    'Overview', "Season's End",
    'Schedule', 'Practice plans', 'Lineups', 'Tournaments',
    /* ⚠ "Development" → "Skills & goals" (owner ruling 5, 2026-08-18). `isCoachNavItemVisible` gained a case for the new
       label AND kept the old one as a fallthrough — the pattern this list's own header describes. */
    'Skills & goals', 'Insights',
    'Money',
    'Chat', 'Email families',
    'Roster', 'Tryouts',
    'Staff', 'Documents', 'Settings',
  ];

  it('the sidebar carries exactly the expected labels, in the approved order', () => {
    assert.deepEqual(sidebarItems, EXPECTED_ITEMS);
    // The landing group holds Overview alone; every item the nav can draw is one of the above.
    assert.deepEqual(TEAM_NAV_GROUPS[0], { items: [OVERVIEW_ITEM] });
    assert.deepEqual([...COACH_NAV_ITEMS.map(i => i.label)].sort(), [...EXPECTED_ITEMS].sort());
  });

  it('every label has its own gate — none falls through to `default: return true`', () => {
    // A helper holds no duty at all. Every gated door must be shut for them; a label that fell
    // through to the default would open, which is the failure this catches.
    const helper = resolveCoachCapabilities('assistant_coach', {
      schedule: false, scheduleManage: false, attendance: false, lineups: false, notes: false,
      money: 'off', documents: 'off', tryouts: false, rosterPii: false, announcementsSend: false,
      staffChat: false,
    });
    // Overview is deliberately ungated — it is where a helper lands, and it renders their practice. Settings is open
    // to every coach by its OWN case since 2026-10-22 (Club Tier 4c-2 Part B: each coach's public-name switch).
    const DELIBERATELY_OPEN = ['Overview', 'Settings'];
    const ungated = sidebarItems.filter(l => !DELIBERATELY_OPEN.includes(l) && isCoachNavItemVisible(helper, l));
    assert.deepEqual(ungated, [],
      'these nav labels have no case in isCoachNavItemVisible and fall through to `return true`');
    // …and the list the sidebar draws for that helper is what the gate says.
    assert.deepEqual(coachNavGroupsFor(helper, false).flatMap(g => g.items.map(i => i.label)), DELIBERATELY_OPEN);
  });

  it('a head coach sees every door', () => {
    const head = resolveCoachCapabilities('head_coach');
    for (const label of sidebarItems) {
      // ⚖ Chat is hidden from everyone while it is paused (2026-10-18).
      assert.equal(isCoachNavItemVisible(head, label), label === 'Chat' ? !CHAT_PAUSED : true, `head coach cannot see ${label}`);
    }
  });
});

describe('the two navs tell the same story', () => {
  /**
   * The phone bar's PRIMARY tabs do not repeat in the More sheet, so the sheet is the sidebar
   * minus exactly those. This is the one legal divergence — a consequence of the bar, not a second
   * opinion about grouping.
   */
  // ⚠ Season's End joins this list as of P2 (2026-08-16) — not as a fifth tab, but because it
  // OCCUPIES the Overview tab on a team whose working season has finished.
  const PHONE_PRIMARIES = ['Overview', "Season's End", 'Schedule', 'Roster', 'Chat'];

  it('the More sheet is the sidebar minus the phone primaries — nothing else', () => {
    assert.deepEqual(bottomItems, sidebarItems.filter(l => !PHONE_PRIMARIES.includes(l)));
    // ⚖ Navigation Phase 4 made the sheet a derivation of the list; these are the rows it had as a literal, unchanged.
    assert.deepEqual(bottomItems, [
      'Practice plans', 'Lineups', 'Tournaments', 'Skills & goals', 'Insights', 'Money', 'Email families',
      'Tryouts', 'Staff', 'Documents', 'Settings',
    ]);
    assert.deepEqual([...PHONE_PRIMARY_HREFS], ['', '/schedule', '/chat', '/roster']);
  });

  it('the group headings and their order match between the two navs', () => {
    // ⚠ FIVE, not six: "Team admin" merged into "Team" (Phase 5b, 2026-08-18).
    assert.deepEqual(sidebarGroups, ['Season', 'Progress', 'Money', 'Communication', 'Team']);
    assert.deepEqual(bottomGroups, sidebarGroups);
  });

  it('both navs read the one list — neither keeps a copy', () => {
    assert.match(SIDEBAR_CODE, /coachNavGroupsFor\(workingSeason\.capabilities, seasonFinished\)/);
    assert.match(BOTTOM_CODE, /const MORE_SECTIONS = COACH_MORE_SECTIONS;/);
    for (const [name, code] of [['sidebar', SIDEBAR_CODE], ['bottom nav', BOTTOM_CODE]] as const) {
      assert.doesNotMatch(code, /const (TEAM_NAV_GROUPS|OVERVIEW_ITEM|SEASON_END_ITEM)\b|\{ header: '/, `${name} keeps its own copy`);
    }
  });
});

describe('the Explore shelf and its conditional mechanism are gone from both navs', () => {
  // ⚠ CODE, not raw source. Every assertion below is an ABSENCE, and these files carry comments that name Explore and the
  // conditional mechanism in order to record that they are gone.
  for (const [name, source] of [['sidebar', SIDEBAR_CODE], ['bottom nav', BOTTOM_CODE], ['nav list', NAV_CODE]] as const) {
    it(`${name} has no "Explore" section and no conditional item state`, () => {
      assert.equal(/'Explore'|"Explore"|>Explore</.test(source), false, `${name} still names an "Explore" group`);
      assert.equal(/conditional\?:|conditional: '/.test(source), false, `${name} still carries the conditional mechanism`);
      assert.equal(/currentAssignment\?\.hasTournamentHistory/.test(source), false,
        `${name} still reads the "in use yet?" signal that decided the shelf`);
      assert.equal(/const navSignals/.test(source), false, `${name} still computes the shelf's signals`);
    });
  }
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A CLOSED SEASON CLOSES BOTH NAVS, NOT JUST THE VISIBLE HALF** (owner ruling 2026-08-18,
 * COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN §3.5).
 *
 * ⚠⚠ **THIS TEST EXISTS BECAUSE THE TESTS ABOVE STRUCTURALLY CANNOT CATCH IT.** They compare the
 * two navs' LIVE-season label sets, which are identical whether or not the phone honours the
 * closed-season rule — so when `withClosedSeasonNav` was applied to the bar's `TEAM_TABS` and NOT
 * to the More sheet's `MORE_SECTIONS`, desktop showed one door and the phone still listed all
 * eleven, and every test in this file passed. It was caught by a person reading the diff.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('a closed season leaves one door in BOTH navs', () => {
  it('the sidebar\'s groups (and the strip\'s name) go through withClosedSeasonNav: one door, Season\'s End', () => {
    assert.match(NAV_CODE, /withClosedSeasonNav\(g\.items, seasonFinished, SEASON_END_ITEM\)/,
      'the desktop groups must collapse to the single closed-season door.');
    const head = resolveCoachCapabilities('head_coach');
    assert.deepEqual(coachNavGroupsFor(head, true), [{ label: undefined, items: [SEASON_END_ITEM] }]);
    // A group the coach can see nothing in renders no heading at all.
    assert.ok(coachNavGroupsFor(head, false).every(g => g.items.length > 0));
  });

  it('the phone bar AND its More sheet both close', () => {
    assert.match(
      BOTTOM, /withClosedSeasonNav\(TEAM_TABS, seasonFinished, SEASON_END_TAB\)/,
      'the bar must collapse to the single closed-season door.',
    );
    assert.match(
      // The sheet's body — the hot tiles and the grouped rows (phone re-evaluation stage 0 · A1,
      // 2026-09-20) — renders inside ONE season gate; this is that gate's opening.
      BOTTOM, /seasonFinished \? null : \(\s*<>\s*<MoreSheetTiles\s+tiles=\{hotTiles/,
      'the More SHEET must close too. This is the half that was missed once: the bar is what a '
      + 'reviewer looks at, and the sheet is eleven more doors into live instruments on a season '
      + 'that has ended.',
    );
    // ⚠ The regex above pins only the gate's OPENING (/review 2026-09-20). Slice the gate's fragment and require BOTH
    // halves inside it.
    const gateStart = BOTTOM.indexOf('seasonFinished ? null : (');
    const gateEnd = BOTTOM.indexOf('</>', gateStart);
    assert.ok(gateStart > 0 && gateEnd > gateStart, 'the sheet renders inside a seasonFinished gate that closes with </>.');
    const gate = BOTTOM.slice(gateStart, gateEnd);
    assert.match(gate, /<MoreSheetTiles\s+tiles=\{hotTiles/, 'the hot tiles render inside the season gate.');
    assert.match(gate, /\{rows\.map\(/, 'the grouped rows render inside the SAME season gate — not after it.');
  });
});

/**
 * ⚖ NOTHING FOLDS (navigation Phase 4, E14, owner 2026-11-09). The Phase 5b fold — "Team" closed by default, a stored
 * choice, an active row forcing its group open, a closed heading rolling up Chat's unread count — retired with the 240
 * unfolded rail: every row, Chat's count on it, is always there. ⚰ The rules that pinned it (and the layout sweep's seeding
 * of the fold's storage key, which the sweep still writes harmlessly — shared automation, the owner's call, as the admin's
 * `fl_nav_groups` seeding after Phase 2) were deleted, not weakened.
 */
describe('the rail does not fold', () => {
  it('no folding state, no stored choice, and the headings are labels', () => {
    assert.doesNotMatch(SIDEBAR_CODE, /flhq-coach-nav-groups|toggleGroup|openGroups|isCoachNavGroupOpen|localStorage\.getItem/);
    assert.doesNotMatch(SIDEBAR_CODE, /<button[^>]*sidebarGroupHeader|aria-expanded|sidebarGroupCount|sidebarGroupBadge/);
    assert.match(SIDEBAR_CODE, /<div className=\{styles\.sidebarGroupHeader\}>\{group\.label\}<\/div>/);
    for (const gone of ['COACH_NAV_DEFAULT_CLOSED_GROUPS', 'coachNavDefaultOpenGroups', 'isCoachNavGroupOpen']) {
      assert.equal(gone in visibility, false, `${gone} is back`);
    }
  });

  it('Chat’s unread count sits on the Chat row itself, always drawn', () => {
    assert.match(SIDEBAR_CODE, /label === 'Chat' && <ChatUnreadBadge count=\{chatUnread\} className=\{strip\.cornerCount\} \/>/);
  });
});

/**
 * The phone sheet's HOT ROW (phone re-evaluation stage 0 · A1, owner 2026-09-20) is a shortcut,
 * not a regrouping: three tiles at the top of the sheet, each of which is still an item in its
 * own More group. A key in `HOT_KEYS` that no group lists would be a door the two navs disagree about.
 */
describe('the phone sheet\'s hot row is a shortcut, never a regrouping', () => {
  it('every hot key is a More section item', () => {
    // Two sets since the chat pause (2026-10-18, P3T): `CHAT_PAUSED ? [paused three] : [today's three]`. Each is three.
    const start = BOTTOM.indexOf('const HOT_KEYS');
    assert.notEqual(start, -1, 'could not find const HOT_KEYS');
    const branches = BOTTOM.slice(start, BOTTOM.indexOf('\n];', start)).split(/\]\s*:\s*\[/)
      .map(b => [...b.matchAll(/'(\/[a-z-]+)'/g)].map((m) => m[1]));
    const listed = COACH_MORE_SECTIONS.flatMap(s => s.items.map(i => i.key));
    for (const hot of branches) {
      assert.equal(hot.length, 3, 'three tiles, as drawn — a fourth is a design decision, not a tweak');
      for (const key of hot) assert.ok(listed.includes(key), `${key} is a hot tile but not a More section item`);
    }
  });
});

/**
 * The notification reader's onward button names the page it opens in the NAV'S OWN WORDS ("Open
 * Insights", "Open Skills & goals" — owner ruling 2026-09-25, D3 option B). That table is a third
 * copy of these page names, in `lib/notification-view.ts`; this block ties it to the nav, so a rename
 * in the nav fails here instead of leaving the reader's button naming a page the coach can no longer
 * find by that name. Read from the one list (navigation Phase 4: it was the phone nav's literals).
 */
describe('the notification reader names pages the way the nav does', () => {
  const navPages = new Map(COACH_NAV_ITEMS.map(i => [i.href.replace(/^\//, ''), i.label] as const));
  it('reads the nav (a guard that found nothing would pass over everything)', () => {
    assert.ok(navPages.size >= 12, `read only ${navPages.size} pages from the nav list`);
  });
  it('every page the reader names carries the nav’s name for it', () => {
    for (const [segment, label] of Object.entries(COACH_TEAM_PAGE)) {
      assert.ok(navPages.has(segment), `the reader names /${segment} ("${label}") but the nav has no such page`);
      assert.equal(label, navPages.get(segment), `the reader calls /${segment} "${label}"; the nav calls it "${navPages.get(segment)}"`);
    }
  });
});
