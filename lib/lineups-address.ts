/**
 * The Lineups room's addresses (the hub brought level with the Practice plans room, owner ask
 * 2026-09-18): one room, two tabs — Games · Templates — each a real, shareable address on
 * `?section=`, the Money / Insights / Skills & Goals / Practice plans hubs' convention
 * (`CoachTabBar`). The bare hub address IS the Games landing and never carries `?section=games`.
 *
 * ⚠ This replaced `?tab=templates`, which was page STATE mirrored into the URL by hand
 * (`history.replaceState`) — a tab that looked like an address but was not one: no Back, no
 * middle-click, and the template editor's "All lineups" door could only land on Games. Nothing
 * outside the hub ever linked to the old form (`lib/sandbox-chrome.ts` and the Overview address
 * the bare hub), so there is no redirect to keep.
 *
 * The template editor is a drill-in of its own at `/lineups/templates/{id}` — the list is a tab,
 * the record is a page, the same split the Practice plans room makes.
 *
 * ⚠ NEVER A YEAR. Lineups and their templates are live-season instruments; the look-back layer is
 * the closed-season page (`HISTORY_ENDPOINTS`), and no address here reads one.
 *
 * Framework-free on purpose, like `practice-plans-address.ts`.
 */
import { safeReturnPath } from './development-address.ts';

export type LineupsSection = 'games' | 'templates';
export const LINEUPS_SECTIONS: ReadonlyArray<LineupsSection> = ['games', 'templates'];

/** The hub, or one of its tabs. `base` is the team root (`/{org}/coaches/teams/{id}`). */
export function lineupsHref(base: string, section: LineupsSection = 'games'): string {
  return section === 'games' ? `${base}/lineups` : `${base}/lineups?section=${section}`;
}

/**
 * A game's lineup builder — with the way back (phone re-evaluation stage 3 · D3, owner 2026-09-21:
 * "back from the lineup must lead to the game, not to Lineups"). The four doors in — the
 * Schedule sheet's Lineup tab, the game-day console's two, the Overview's card — each send their
 * OWN address as `returnTo`, and the builder's header arrow returns there (`returnLabel` names it
 * by where it goes). The Lineups room's rows send none, so the arrow reads All lineups. The
 * portal's one `return` convention (`safeReturnPath`): an address outside this team's portal is
 * dropped here, so the link never carries it.
 */
export function lineupBuilderHref(base: string, eventId: string, opts: { returnTo?: string | null } = {}): string {
  const back = safeReturnPath(opts.returnTo ?? null, base);
  return back ? `${base}/lineups/${eventId}?return=${encodeURIComponent(back)}` : `${base}/lineups/${eventId}`;
}

/** The template editor's own address (`'new'` for a template not yet saved). */
export function lineupTemplateHref(base: string, templateId: string): string {
  return `${base}/lineups/templates/${templateId}`;
}

/** An unknown or missing section lands on Games — the landing. */
export function parseLineupsSection(raw: string | null | undefined): LineupsSection {
  return LINEUPS_SECTIONS.includes(raw as LineupsSection) ? (raw as LineupsSection) : 'games';
}
