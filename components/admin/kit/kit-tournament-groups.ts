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
import { DollarSign, FileText } from 'lucide-react';
// Relative, not '@/': the unit runner imports this file directly and resolves no path alias.
import { TOUR_GROUPS, type TourGroup, type TourNavItem } from '../admin-nav-config.ts';
import { isNavKeyHiddenInSandbox } from '../../../lib/sandbox-curation.ts';
import { eventAreas } from '../../../lib/invite-only-event.ts';

const SUMMARY_ITEM: TourNavItem = { key: 'summary', icon: FileText, label: 'Summary' };

/** An event that is over carries its Summary page. */
export function isTournamentSummaryPhase(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'archived';
}

export function kitTournamentGroups({ status, isSandbox, role, planId, accountingHref = null }: {
  status: string | null | undefined;
  isSandbox: boolean;
  role: string | null | undefined;
  /** The organization's plan: it decides which areas an event has (`eventAreas`). */
  planId: string | null | undefined;
  /** ⚖ ACCOUNTING IS AN ADMIN ROW (the nav standard's N7, Ask B4, 2026-10-17): the club's book read for this event,
   *  last in Admin — so the sidebar and the phone's More sheet list it from this one list (the sidebar drew it as a lone
   *  row after the groups, and the sheet had no door to it). Null where the person cannot open Accounting (the caller
   *  holds that gate: the role capability and the plan module, as the lone row asked). */
  accountingHref?: string | null;
}): TourGroup[] {
  const areas = eventAreas(planId);
  const absent = new Set([
    ...(areas.checkIn ? [] : ['check-in']),
    ...(areas.volunteers ? [] : ['staff-kit']),
    ...(areas.chat ? [] : ['chat']),
  ]);
  const summary = isTournamentSummaryPhase(status) && areas.summaryPage;
  return TOUR_GROUPS
    .map(g => (g.key === 'operations' && summary ? { ...g, items: [...g.items, SUMMARY_ITEM] } : g))
    .map(g => (g.key === 'admin' && accountingHref
      ? { ...g, items: [...g.items, { key: 'accounting', icon: DollarSign, label: 'Accounting', href: accountingHref }] }
      : g))
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        !absent.has(i.key)
        && !(isSandbox && isNavKeyHiddenInSandbox(true, i.key))
        && (!i.roles || (!!role && i.roles.includes(role)))),
    }))
    .filter(g => g.items.length > 0);
}
