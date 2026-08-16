import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isCoachNavItemVisible, OVERVIEW_LABEL, SEASON_END_LABEL } from '../../lib/coach-nav-visibility.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';

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
    assert.deepEqual(sidebarGroups, ['Season', 'Progress', 'Money', 'Communication', 'Team', 'Team admin']);
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
  for (const [name, source] of [['sidebar', SIDEBAR], ['bottom nav', BOTTOM]] as const) {
    it(`${name} has no "Explore" section and no conditional item state`, () => {
      assert.equal(/dropSectionLabel}>Explore|sidebarGroupLabel}>Explore/.test(source), false,
        `${name} still renders an "Explore" heading`);
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
