import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  isCoachNavItemVisible, OVERVIEW_LABEL, SEASON_END_LABEL,
  COACH_NAV_DEFAULT_CLOSED_GROUPS, coachNavDefaultOpenGroups, isCoachNavGroupOpen,
} from '../../lib/coach-nav-visibility.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';
import { stripComments } from './_source-code.ts';

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
 *   2. **THE TWO NAVS DRIFT APART.** The sidebar and the phone "More" sheet carry the same
 *      grouping in two files. A door added, moved or regrouped in one and not the other leaves
 *      desktop and phone telling different stories — which is exactly how the Explore shelf would
 *      have survived on phones only.
 *
 * Both are asserted against the component SOURCE. That is deliberate: these are module-level
 * literals in client components, and importing a `.tsx` that pulls in next/navigation, lucide and
 * a CSS module into the node test runner costs far more than reading the array back.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

/**
 * Nav labels that are written as a shared CONSTANT rather than a literal. Imported from the module
 * that owns them, so this map cannot drift from the value the navs actually render.
 */
const KNOWN_LABEL_CONSTANTS: Record<string, string> = {
  OVERVIEW_LABEL,
  SEASON_END_LABEL,
};

/**
 * Pull the ITEM labels out of a bounded slice of source, in order.
 *
 * ⚠ The negative lookahead is load-bearing. The sidebar's GROUP headings use the same `label:`
 * key as its items (`{ label: 'Season', items: [...] }`), so without it every heading came back
 * as an item and the two navs "disagreed" about a difference that was entirely this helper's.
 */
function labelsIn(source: string, startMarker: string, endMarker: string): string[] {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `could not find ${startMarker} — the nav was restructured, update this test`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `could not find ${endMarker} after ${startMarker}`);
  // ⚠ THREE forms, and each was a blind spot in turn — this helper has now lost sight of a real,
  // capability-gated door twice, which is precisely what it exists to prevent:
  //   · single quotes — the original;
  //   · DOUBLE quotes — "Season's End" carries an apostrophe, so it cannot use the first form;
  //   · a SCREAMING_SNAKE identifier — the two landing-slot labels are shared constants, because
  //     the label IS the capability-gate key and two hand-typed copies of it is exactly the drift
  //     this file guards. Resolved through KNOWN_LABEL_CONSTANTS below rather than skipped, so the
  //     assertion still fails if a label's TEXT changes.
  //
  // ⚠ The identifier form is deliberately restricted to the repo's CONSTANT casing. A bare `\w+`
  // also matched the TYPE annotation on the group literal (`{ label: string; items: … }`) and blew
  // up trying to resolve `string` as a nav label.
  return [...source.slice(start, end).matchAll(/label: (?:'([^']+)'|"([^"]+)"|([A-Z][A-Z0-9_]*))(?!, items:)/g)]
    .map((m) => {
      if (m[1] ?? m[2]) return m[1] ?? m[2];
      const resolved = KNOWN_LABEL_CONSTANTS[m[3]];
      assert.ok(resolved,
        `nav item label \`${m[3]}\` is an identifier this guard cannot resolve. Add it to `
        + 'KNOWN_LABEL_CONSTANTS — a label the extractor skips is a door that stops being checked.');
      return resolved;
    });
}

/**
 * Pull the group/section headers in source order.
 *
 * ⚠ Anchored on the `, items: [` that follows, NOT on `{ label: '…'` alone — the sidebar's ITEMS
 * use the same `label:` key, so the looser pattern returned headings and items interleaved.
 */
function headersIn(source: string, startMarker: string, endMarker: string, key: 'label' | 'header'): string[] {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  const slice = source.slice(start, end);
  return [...slice.matchAll(new RegExp(`\\{ ${key}: '([^']+)', items:`, 'g'))].map(m => m[1]);
}

const SIDEBAR = read('components/coaches/CoachesSidebar.tsx');
const BOTTOM = read('components/coaches/CoachesBottomNav.tsx');

/**
 * The same two files as CODE — comments stripped (tests/unit/_source-code.ts).
 *
 * ⚠ The label/heading extractors above deliberately keep the RAW text: they are anchored on the
 * group literals and stripping would not change what they find. Everything that asserts a rule is
 * PRESENT or ABSENT uses these instead, because those assertions read prose otherwise — and this
 * file proved it, twice in one sitting: "no Explore group" failed on the comment recording that
 * Explore was deleted, and "no phase-varying defaults" failed on the comment explaining why the
 * coach rail deliberately has none.
 */
const SIDEBAR_CODE = stripComments(SIDEBAR);
const BOTTOM_CODE = stripComments(BOTTOM);

/**
 * ⚠ THE LANDING SLOT IS HOISTED, AND THE EXTRACTOR HAS TO FOLLOW IT (P2, 2026-08-16). Overview and
 * Season's End live in named constants above `TEAM_NAV_GROUPS` because the first slot SWAPS: a team
 * whose working season has finished lands on Season's End instead. Both are still capability-gated
 * labels, so both belong in the pinned list — reading only the group literal would have quietly
 * dropped two doors out of this guard's sight, which is exactly the blindness it exists to prevent.
 */
const landingItems = labelsIn(SIDEBAR, 'const OVERVIEW_ITEM', 'const TEAM_NAV_GROUPS');
const sidebarItems = [...landingItems, ...labelsIn(SIDEBAR, 'const TEAM_NAV_GROUPS', '\n];')];
const sidebarGroups = headersIn(SIDEBAR, 'const TEAM_NAV_GROUPS', '\n];', 'label');
const bottomItems = labelsIn(BOTTOM, 'const MORE_SECTIONS', '\n];');
const bottomGroups = headersIn(BOTTOM, 'const MORE_SECTIONS', '\n];', 'header');

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
    'Development', 'Insights',
    'Money',
    'Chat', 'Email families',
    'Roster', 'Tryouts',
    'Staff', 'Documents', 'Settings',
  ];

  it('the sidebar carries exactly the expected labels, in the approved order', () => {
    assert.deepEqual(sidebarItems, EXPECTED_ITEMS);
  });

  it('every label has its own gate — none falls through to `default: return true`', () => {
    // A helper holds no duty at all. Every gated door must be shut for them; a label that fell
    // through to the default would open, which is the failure this catches.
    const helper = resolveCoachCapabilities('assistant_coach', {
      schedule: false, scheduleManage: false, attendance: false, lineups: false, notes: false,
      money: 'off', documents: 'off', tryouts: false, rosterPii: false, announcementsSend: false,
      staffChat: false,
    });
    // Overview is deliberately ungated — it is where a helper lands, and it renders their practice.
    const ungated = sidebarItems.filter(l => l !== 'Overview' && isCoachNavItemVisible(helper, l));
    assert.deepEqual(ungated, [],
      'these nav labels have no case in isCoachNavItemVisible and fall through to `return true`');
  });

  it('a head coach sees every door', () => {
    const head = resolveCoachCapabilities('head_coach');
    for (const label of sidebarItems) {
      assert.equal(isCoachNavItemVisible(head, label), true, `head coach cannot see ${label}`);
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
  // OCCUPIES the Overview tab on a team whose working season has finished. The bar still shows
  // four; which one the first is depends on the season, and neither of the two candidates repeats
  // in the sheet.
  const PHONE_PRIMARIES = ['Overview', "Season's End", 'Schedule', 'Roster', 'Chat'];

  it('the More sheet is the sidebar minus the phone primaries — nothing else', () => {
    assert.deepEqual(bottomItems, sidebarItems.filter(l => !PHONE_PRIMARIES.includes(l)));
  });

  it('the group headings and their order match between the two navs', () => {
    // The sidebar's ungrouped Overview row has no heading, so both lists start at "Season".
    // ⚠ FIVE, not six: "Team admin" merged into "Team" (Phase 5b, 2026-08-18). The item list above
    // is UNCHANGED by that merge — if a diff touches both this line and EXPECTED_ITEMS, something
    // moved that was not supposed to.
    assert.deepEqual(sidebarGroups, ['Season', 'Progress', 'Money', 'Communication', 'Team']);
    assert.deepEqual(bottomGroups, sidebarGroups);
  });
});

describe('the Explore shelf and its conditional mechanism are gone from both navs', () => {
  /**
   * ⚠ Not a style preference. Conditional items sat in their group only once `hasTryoutSignal` /
   * `hasTournamentHistory` was true and otherwise dropped to a shelf labelled "Explore", so the
   * sidebar REARRANGED ITSELF mid-season — moving items a coach had already learned the position
   * of. "Explore" also collided with a real product concept (browsing public tournaments to enter,
   * `/discover`). Deleting it from one nav and not the other would have kept the shelf alive on
   * phones only, which is precisely the drift the test above exists for.
   */
  // ⚠ CODE, not raw source. Every assertion below is an ABSENCE, and both of these files carry
  // comments that name Explore and the conditional mechanism in order to record that they are gone.
  for (const [name, source] of [['sidebar', SIDEBAR_CODE], ['bottom nav', BOTTOM_CODE]] as const) {
    it(`${name} has no "Explore" section and no conditional item state`, () => {
      // ⚠ `sidebarGroupLabel` was the <p> heading and is GONE — the rail's headings are buttons
      // (`sidebarGroupHeader`) since Phase 5b. Matching only the retired class name would have left
      // this assertion passing on a string that can no longer appear, which is a guard that has
      // quietly stopped guarding. Both spellings stay so neither shape can bring the shelf back,
      // and the label test below catches the heading whatever it is wrapped in.
      assert.equal(/dropSectionLabel}>Explore|sidebarGroupLabel}>Explore|sidebarGroupHeaderText}>Explore/.test(source), false,
        `${name} still renders an "Explore" heading`);
      assert.equal(/'Explore'|"Explore"/.test(source), false,
        `${name} still names an "Explore" group`);
      assert.equal(/conditional\?:|conditional: '/.test(source), false,
        `${name} still carries the conditional mechanism`);
      // ⚠ The READ, not the word — both files mention `hasTournamentHistory` in a comment
      // explaining that nothing consumes it any more, and that comment is the point.
      assert.equal(/currentAssignment\?\.hasTournamentHistory/.test(source), false,
        `${name} still reads the "in use yet?" signal that decided the shelf`);
      assert.equal(/const navSignals/.test(source), false,
        `${name} still computes the shelf's signals`);
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
  it('the sidebar groups go through withClosedSeasonNav', () => {
    assert.match(
      SIDEBAR, /withClosedSeasonNav\(group\.items, seasonFinished, SEASON_END_ITEM\)/,
      'the desktop groups must collapse to the single closed-season door.',
    );
  });

  it('the phone bar AND its More sheet both close', () => {
    assert.match(
      BOTTOM, /withClosedSeasonNav\(TEAM_TABS, seasonFinished, SEASON_END_TAB\)/,
      'the bar must collapse to the single closed-season door.',
    );
    assert.match(
      BOTTOM, /seasonFinished \? null : MORE_SECTIONS\.map\(/,
      'the More SHEET must close too. This is the half that was missed once: the bar is what a '
      + 'reviewer looks at, and the sheet is eleven more doors into live instruments on a season '
      + 'that has ended.',
    );
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE RAIL'S GROUPS COLLAPSE (Phase 5b, owner-approved 2026-08-18)
 *
 * Both invariants below are the kind that break in silence: nothing throws, no screen 404s, the
 * coach is simply shown less than they should be. Neither is observable from the label lists the
 * rest of this file pins, so they are asserted against the RULES themselves — which is why the
 * rules live in `lib/coach-nav-visibility.ts` and not inside the client component.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('the rail collapses on a fixed rule, not on taste', () => {
  const ALL_GROUPS = ['Season', 'Progress', 'Money', 'Communication', 'Team'];

  it('only Team starts closed', () => {
    // ⚠ CHANGING THIS IS THE DECISION POINT, and the rule is HOW OFTEN a coach opens the group,
    // never how many rows it has. A group opened weekly or more never starts closed — the collapse
    // is meant to shorten the rail, not to make the week's work take an extra click.
    assert.deepEqual([...COACH_NAV_DEFAULT_CLOSED_GROUPS], ['Team']);
    assert.deepEqual(
      coachNavDefaultOpenGroups(ALL_GROUPS),
      ['Season', 'Progress', 'Money', 'Communication'],
    );
  });

  it('every default-closed group is a real heading', () => {
    // A stale entry here closes nothing and reads as though it does — the rule would look applied
    // while the rail stayed fifteen rows long.
    for (const label of COACH_NAV_DEFAULT_CLOSED_GROUPS) {
      assert.ok(sidebarGroups.includes(label),
        `"${label}" is in the default-closed set but is not a group the rail renders`);
    }
  });

  it('the defaults do not vary by season state', () => {
    // ⚠ Phase 4 deleted the `conditional` mechanism because a rail that rearranges itself moves
    // items a coach has already learned the position of. Auto-opening on season state is a softer
    // form of the same thing and is deliberately NOT built — the admin rail's `defaultOpenFor`
    // equivalent must not appear here.
    assert.equal(/defaultOpenFor/.test(SIDEBAR_CODE), false,
      'the coach rail must not learn phase-varying defaults');
    assert.equal(/defaultOpenFor/.test(stripComments(read('lib/coach-nav-visibility.ts'))), false,
      'the coach rail must not learn phase-varying defaults');
  });

  it('an active item forces its group open, whatever the stored state says', () => {
    // ⚠⚠ THE ONE THAT MATTERS. Without it a coach closes a group, arrives inside it from a link or
    // a card, and their own location is missing from the menu they are reading.
    const shut = new Set<string>();
    assert.equal(isCoachNavGroupOpen('Team', shut, true), true,
      'a group holding the current page must be open even when stored state says closed');
    assert.equal(isCoachNavGroupOpen('Team', shut, false), false);
    assert.equal(isCoachNavGroupOpen('Team', new Set(['Team']), false), true);
  });

  it('the rail keeps its own storage key, not the admin rail\'s', () => {
    // One shared key would let a tournament admin's Setup preference decide whether a coach's Team
    // group is open — two different portals whose headings merely collide by name.
    assert.equal(/'fl_nav_groups'/.test(SIDEBAR_CODE), false,
      'the coach rail must not share the admin rail\'s localStorage key');
    assert.match(SIDEBAR_CODE, /flhq-coach-nav-groups/);
  });

  it('the ungrouped landing slot never gets a chevron, and an empty group never gets a heading', () => {
    // Overview / Season's End is one row, not a shelf — and a team between seasons whose entire
    // menu is that single door must not have to open anything to reach it.
    assert.match(SIDEBAR_CODE, /const label = group\.label;\s*\n\s*if \(!label\) return/,
      'the headingless landing group must short-circuit before the collapsible heading renders');
    assert.match(SIDEBAR_CODE, /if \(!items\.length\) return null;/,
      'a group whose items are all hidden from this coach must render no heading at all');
  });

  it('a closed group surfaces what is asking for attention inside it', () => {
    // ⚠⚠ Chat's unread badge sits on a row INSIDE Communication. Once that group can close, a coach
    // who closes it stops seeing that anyone messaged them — nothing errors, the signal just goes
    // quiet. The heading carries the roll-up, and a folded-row count when there is nothing to say.
    assert.match(SIDEBAR_CODE, /itemUnread/,
      'the rail must roll its rows\' attention signals up onto a closed heading');
    assert.match(SIDEBAR_CODE, /!open && \(unread > 0/,
      'a closed heading must show the rolled-up unread badge, and the folded-row count otherwise');
  });
});

/**
 * ⚠⚠ **A CLOSED GROUP IS AN UNMEASURED GROUP.** `check:layout` measures what is RENDERED, so the
 * five doors folded into a closed Team group leave the layout sweep's safety net on every coach
 * screen. The sweep opens every group before it measures (`scripts/check-layout-invariants.mjs`
 * seeds the storage key above); this pins the two ends of that arrangement together, because the
 * failure is invisible — the sweep goes green over fewer screens than it reports.
 */
describe('the layout sweep still measures the folded doors', () => {
  it('the sweep opens every nav group before measuring', () => {
    const sweep = read('scripts/check-layout-invariants.mjs');
    assert.match(sweep, /flhq-coach-nav-groups/,
      'the layout sweep must seed the coach rail\'s groups open, or the five rows folded into a '
      + 'closed Team group are silently exempt from every layout invariant.');

    // ⚠⚠ ASSERT THE SEEDED LABELS, NOT JUST THE KEY. Checking only that the storage-key string
    // appears leaves this guard green after a heading RENAME — which this codebase explicitly
    // allows ("group headings are free; item labels are not"). The rail REPLACES its default-open
    // set with whatever it reads from storage, so a renamed group would come back closed under the
    // sweep and quietly leave its whole subtree unmeasured again: the exact bug the seeding was
    // added to fix, reopened by the weakness of its own guard.
    const seeded = sweep.match(/'flhq-coach-nav-groups',\s*\n?\s*JSON\.stringify\(\[([^\]]*)\]/);
    assert.ok(seeded, 'could not read the labels the sweep seeds — the seeding was restructured');
    const seededLabels = [...seeded[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    assert.deepEqual(seededLabels, sidebarGroups,
      'the sweep seeds a different set of group headings than the rail actually renders. Every '
      + 'heading it misses is a group that stays folded during the sweep, so its rows are measured '
      + 'by nothing.');
  });
});
