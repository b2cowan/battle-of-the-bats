/**
 * The tournament's nav groups as ONE person sees them — built once for the kit rail and the kit
 * phone bar (Admin Design Continuity slice 1, `/simplify`). The old console rail and phone bar
 * (deleted in Part B, 2026-09-29) each built this themselves and disagreed in a small way (the phone
 * sheet role-filtered only Setup; the rail every group) — exactly the drift that lets a gated row show
 * on one nav and not the other. Pure: no hooks, no browser.
 *
 * In order: the Summary row joins Operations once the event is over (the old rails' rule), the "See it
 * live" sandbox's curated corners drop out (lib/sandbox-curation.ts), role-gated rows drop out for
 * roles that cannot open them, and a group left empty drops out entirely.
 */
import { FileText } from 'lucide-react';
// Relative, not '@/': the unit runner imports this file directly and resolves no path alias.
import { TOUR_GROUPS, type TourGroup, type TourNavItem } from '../admin-nav-config.ts';
import { isNavKeyHiddenInSandbox } from '../../../lib/sandbox-curation.ts';

const SUMMARY_ITEM: TourNavItem = { key: 'summary', icon: FileText, label: 'Summary' };

/** An event that is over carries its Summary page. */
export function isTournamentSummaryPhase(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'archived';
}

export function kitTournamentGroups({ status, isSandbox, role }: {
  status: string | null | undefined;
  isSandbox: boolean;
  role: string | null | undefined;
}): TourGroup[] {
  const summary = isTournamentSummaryPhase(status);
  return TOUR_GROUPS
    .map(g => (g.key === 'operations' && summary ? { ...g, items: [...g.items, SUMMARY_ITEM] } : g))
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        !(isSandbox && isNavKeyHiddenInSandbox(true, i.key))
        && (!i.roles || (!!role && i.roles.includes(role)))),
    }))
    .filter(g => g.items.length > 0);
}
