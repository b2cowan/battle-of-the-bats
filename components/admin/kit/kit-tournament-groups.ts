/**
 * The tournament's nav groups as ONE person sees them — built once for the kit rail and the kit
 * phone bar (Admin Design Continuity slice 1, `/simplify`). The old console rail and phone bar
 * (deleted in Part B, 2026-09-29) each built this themselves and disagreed in a small way (the phone
 * sheet role-filtered only Setup; the rail every group) — exactly the drift that lets a gated row show
 * on one nav and not the other. Pure: no hooks, no browser.
 *
 * In order: the Summary row joins Operations once the event is over (the old rails' rule) on a plan that carries
 * Summary, the areas the plan doesn't carry drop out (an invite-only event has no Check-in, Staff kit or Chat — the
 * free tournament tier, R5, 2026-10-16: absent, never a wall reached from the nav), the "See it live" sandbox's
 * curated corners drop out (lib/sandbox-curation.ts), role-gated rows drop out for roles that cannot open them, and a
 * group left empty drops out entirely.
 */
import { Bell, FileText } from 'lucide-react';
// Relative, not '@/': the unit runner imports this file directly and resolves no path alias.
import { TOUR_GROUPS, type TourGroup, type TourNavItem } from '../admin-nav-config.ts';
import { isNavKeyHiddenInSandbox } from '../../../lib/sandbox-curation.ts';
import { eventAreas } from '../../../lib/invite-only-event.ts';
import { orgSettingsOnTournamentSide } from '../../../lib/billing-urls.ts';
import { isTeamWorkspaceOrg } from '../../../lib/team-workspace-kind.ts';
import { isTournamentEventPath, litTournamentRow, tournamentOrgScreenName, type KitLink } from '../../../lib/admin-kit-nav.ts';

const SUMMARY_ITEM: TourNavItem = { key: 'summary', icon: FileText, label: 'Summary' };

/** The event's own mute page (T2, owner 2026-11-10; the words /marketing's): the person's, for this event. Last under Admin on
 *  both navs — its only other door was the retired Settings & access card page, so the phone's More sheet carries it too. */
export const YOUR_NOTIFICATIONS_ITEM: TourNavItem = { key: 'settings/notifications', icon: Bell, label: 'Your notifications' };

/** An event that is over carries its Summary page. */
export function isTournamentSummaryPhase(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'archived';
}

export function kitTournamentGroups({ status, isSandbox, role, planId, accountKind }: {
  status: string | null | undefined;
  isSandbox: boolean;
  role: string | null | undefined;
  /** The organization's plan: it decides which areas an event has (`eventAreas`). */
  planId: string | null | undefined;
  /** With the plan, where the organization's settings live (`orgSettingsOnTournamentSide`: a one-team workspace keeps its own). */
  accountKind?: string | null;
}): TourGroup[] {
  const areas = eventAreas(planId);
  const absent = new Set([
    ...(areas.checkIn ? [] : ['check-in']),
    ...(areas.volunteers ? [] : ['staff-kit']),
    ...(areas.chat ? [] : ['chat']),
    // ⚖ ONE HOME PER SETTING (navigation Phase 2 Part B, P2, owner 2026-11-10): a club keeps Members, PDF settings, Payouts and
    // Plan & billing in its Organization, so no tournament row points at them. A one-team workspace keeps the row on its phone:
    // its staff page has no other door there (its More sheet carries no Organization rows), and the row opens that page.
    ...(orgSettingsOnTournamentSide({ planId, accountKind }) || isTeamWorkspaceOrg({ planId, accountKind }) ? [] : ['settings']),
  ]);
  const summary = isTournamentSummaryPhase(status) && areas.summaryPage;
  return TOUR_GROUPS
    .map(g => (g.key === 'operations' && summary ? { ...g, items: [...g.items, SUMMARY_ITEM] } : g))
    .map(g => (g.key === 'admin' ? { ...g, items: [...g.items, YOUR_NOTIFICATIONS_ITEM] } : g))
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        !absent.has(i.key)
        && !(isSandbox && isNavKeyHiddenInSandbox(true, i.key))
        && (!i.roles || (!!role && i.roles.includes(role)))),
    }))
    .filter(g => g.items.length > 0);
}

/** The organization's screens, which leave the event's sidebar on a computer (E3, T1): they wear the organization's own. */
const ORG_ROW_KEYS = new Set(['settings', 'manage']);

/**
 * ⚖ THE EVENT'S SIDEBAR ON A COMPUTER (navigation Phase 2 Part B; E3, T1, T2, owner 2026-11-10): the event's pages only.
 * Settings & access and the Tournaments list are the organization's (a tournament-only organization's own short sidebar, a
 * club's own sidebar), so they leave; the event's own "Your notifications" stays the last row, under Admin. The way to the
 * list from an event is the cell's "All tournaments". PHASE-3: the phone's More sheet keeps `kitTournamentGroups` until then.
 */
export function deskTournamentGroups(groups: readonly TourGroup[]): TourGroup[] {
  return groups
    .map(g => ({ ...g, items: g.items.filter(i => !ORG_ROW_KEYS.has(i.key)) }))
    .filter(g => g.items.length > 0);
}

/**
 * ⚖ WHAT THE STRIP NAMES ON A COMPUTER (navigation Phase 2 Part B; E2, E3, T1, P3, owner 2026-11-09 / 2026-11-10), decided ONCE
 * for the strip and the page headers (`DeskNamedPage`): on the event's own pages, the page — the sidebar's lit row (this same
 * list, `deskTournamentGroups`), in its words; on the organization's Tournaments list and a Tournament plan's Plan & billing,
 * that screen. Null = the strip names what the phone bar names, and the page keeps its title (a page with no row of its own;
 * a Tournament plan's Settings & access, which is a place on both widths; the public preview; a cancelled account's one page).
 * Pure, and every input is known on the server's first paint.
 */
export function deskTitleAt({ pathname, base, status, isSandbox, role, planId, billingLink }: {
  pathname: string;
  base: string;
  status: string | null | undefined;
  isSandbox: boolean;
  role: string | null | undefined;
  planId: string | null | undefined;
  /** The foot's Plan & billing door (`kitBillingLink`): its page is the more specific door under Settings & access. */
  billingLink: KitLink | null;
}): string | null {
  if (!pathname.startsWith(`${base}/tournaments/`) || pathname.startsWith(`${base}/tournaments/preview`)) return null;
  if (!isTournamentEventPath(pathname, base)) return tournamentOrgScreenName(pathname, base);
  const rows = deskTournamentGroups(kitTournamentGroups({ status, isSandbox, role, planId })).flatMap(g => g.items);
  const lit = litTournamentRow(pathname.replace(/\/+$/, ''), base, rows.map(r => r.key), billingLink);
  return rows.find(r => r.key === lit)?.label ?? null;
}
