import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';
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
  return [...source.slice(start, end).matchAll(/label: '([^']+)'(?!, items:)/g)].map(m => m[1]);
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

const sidebarItems = labelsIn(SIDEBAR, 'const TEAM_NAV_GROUPS', '\n];');
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
    'Overview',
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
  const PHONE_PRIMARIES = ['Overview', 'Schedule', 'Roster', 'Chat'];

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
