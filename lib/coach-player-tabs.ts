/**
 * The player page's FIVE tabs and their addresses (roster + player page review, owner rulings
 * 2026-09-13: R2-1 Details first · R2-2 "Skills & Goals" · R2-3 Notes is its own tab; hub F13).
 *
 * ⚠ TABS HAVE AN ADDRESS. They were `useState` buttons: reload returned to the first tab, Back did
 * not undo a switch, nothing could link to a tab, and a `?section=` into a non-default tab landed
 * on the wrong tab silently because its target was not in the DOM. Now `?tab=` names the tab on the
 * portal's shared tab bar (the Money hub and Insights convention), and `?section=` keeps
 * scrolling-and-flashing WITHIN the tab.
 *
 * ⚠ EVERY EXISTING DEEP LINK KEEPS WORKING WITHOUT A CHANGE TO ITS PRODUCER. `?section=development`
 * (with any `view=`) is what the Skills & Goals hub, the Insights reports, the layout sweep, the
 * marketing shots and seventeen help articles already send; `tabForSection` maps a section to the
 * tab that holds it, so an address that names only a section still opens the right tab. An
 * explicit `?tab=` wins over the mapping.
 *
 * Framework-free so the roster row, the tab bar and a unit test all read one table.
 */
import { developmentAddressTab } from './development-address.ts';

export type PlayerTab = 'details' | 'season' | 'skills' | 'notes' | 'family';

/** `short` only where the phone needs a shorter word — a label that already fits carries none. */
export const PLAYER_TABS: ReadonlyArray<{ id: PlayerTab; label: string; short?: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'season',  label: 'This season',        short: 'Season' },
  { id: 'skills',  label: 'Skills & Goals',     short: 'Skills' },
  { id: 'notes',   label: 'Notes' },
  { id: 'family',  label: 'Family & paperwork', short: 'Family' },
];

/** Details lands first (owner, round 2): the glance card carries the mid-season answer on every tab. */
export const DEFAULT_PLAYER_TAB: PlayerTab = 'details';

/** Which tab a `?section=` lives on. Unknown sections fall to the default tab. */
const SECTION_TAB: Record<string, PlayerTab> = {
  player: 'details',
  attendance: 'season', 'playing-time': 'season', awards: 'season', dues: 'season',
  development: 'skills',
  notes: 'notes', about: 'notes',
  guardian: 'family', safety: 'family', guardians: 'family', documents: 'family',
};

const isPlayerTab = (v: unknown): v is PlayerTab => typeof v === 'string' && PLAYER_TABS.some(t => t.id === v);

export function tabForSection(section: string | null | undefined): PlayerTab | null {
  return section ? (SECTION_TAB[section] ?? null) : null;
}

/**
 * The tab an address opens: `?tab=` first, then the tab a RETIRED development view now lives on
 * (a bare `view=observations` is the Notes tab — re-evaluation stage 3, E1; the address module
 * owns that mapping), then the tab that holds its `?section=`, then the default.
 */
export function resolvePlayerTab(params: { get(name: string): string | null }): PlayerTab {
  const tab = params.get('tab');
  if (isPlayerTab(tab)) return tab;
  return developmentAddressTab(params) ?? tabForSection(params.get('section')) ?? DEFAULT_PLAYER_TAB;
}

/**
 * The address of a tab on this player's page. Switching tabs drops `section`/`view`/`metric`/`goal`
 * (they belonged to the tab being left) and keeps `return` (the way back belongs to the page).
 */
export function playerTabHref(
  playerBase: string,
  tab: PlayerTab,
  opts: { section?: string; returnTo?: string | null } = {},
): string {
  const qp = new URLSearchParams();
  qp.set('tab', tab);
  if (opts.section) qp.set('section', opts.section);
  if (opts.returnTo) qp.set('return', opts.returnTo);
  return `${playerBase}?${qp.toString()}`;
}
