'use client';
/**
 * ⚖ WHAT THE CHROME NAMES, AT BOTH WIDTHS (navigation Phase 2 Part B, E2, owner 2026-11-09; Phase 3, E5, 2026-11-11). On a
 * tournament's own page the top strip (a computer) and the bar (a phone) name the page — the sidebar's lit row — and on the
 * organization's Tournaments list and a Tournament plan's Plan & billing they name the screen; there the page's paper title
 * steps aside at both widths. The page's buttons and its "?" stay on the page's top row, the "?" last (E11).
 *
 * Decided ONCE per render by the admin shell (`deskTitleAt`, a pure rule over the sidebar's own list) and read by the strip,
 * the phone bar and every page header, so none of them can disagree. Every input is known on the server's first paint, and
 * which header shows it is CSS at the sidebar's breakpoint, never a width read in script, so nothing swaps. Outside the admin
 * shell the answer is null (a page header keeps its title). The name `useDeskTitle` predates Phase 3; it is both widths' now.
 *
 * ⚠ A club place names itself on BOTH widths (`TabPageHeader` + `useNamedInBar`): this is not that, and never for a club place.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { kitBillingLink } from '@/lib/admin-kit-nav';
import { deskTitleAt } from './kit/kit-tournament-groups';

const DeskTitle = createContext<string | null>(null);

/** Mounted once by the admin shell, around the strip and the page. */
export function DeskTitleProvider({ suspended, children }: { suspended: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { currentTournament } = useTournament();
  const title = !suspended && currentOrg
    ? deskTitleAt({
      pathname,
      base: `/${currentOrg.slug}/admin`,
      status: currentTournament?.status,
      role: userRole,
      planId: currentOrg.planId,
      billingLink: kitBillingLink({
        orgSlug: currentOrg.slug, planId: currentOrg.planId, accountKind: currentOrg.accountKind, role: userRole,
        capabilities: userCapabilities,
      }),
    })
    : null;
  return <DeskTitle.Provider value={title}>{children}</DeskTitle.Provider>;
}

/** The page's name the chrome shows (the strip on a computer, the bar on a phone), or null where it names the place, the
 *  club or the organization instead and the page keeps its own title. */
export function useDeskTitle(): string | null {
  return useContext(DeskTitle);
}
