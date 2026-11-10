'use client';
/**
 * ⚖ WHAT THE STRIP NAMES ON A COMPUTER (navigation Phase 2 Part B, E2, owner 2026-11-09; P3, 2026-11-10). On a tournament's own
 * page the top strip names the page (the sidebar's lit row), and on the organization's Tournaments list and a Tournament
 * plan's Plan & billing it names the screen; there the page's paper title steps aside ABOVE 900px only — the phone keeps its
 * titles and its event bar until Phase 3 (P3). The page's buttons and its "?" stay on the page's top row, the "?" last (E11).
 *
 * Decided ONCE per render by the admin shell (`deskTitleAt`, a pure rule over the sidebar's own list) and read by the strip and
 * by every page header, so the two can never disagree and the phone bar never pays for it. Every input is known on the
 * server's first paint, and the title is hidden by CSS at the sidebar's breakpoint, never by a width read in script, so
 * nothing swaps. Outside the admin shell the answer is null (a page header keeps its title).
 *
 * ⚠ A club place names itself on BOTH widths (`TabPageHeader` + `useNamedInBar`): this is not that, and never for a club place.
 * PHASE-3: when the phone bar names the page too, this becomes that both-widths answer.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { kitBillingLink } from '@/lib/admin-kit-nav';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { deskTitleAt } from './kit/kit-tournament-groups';

const DeskTitle = createContext<string | null>(null);

/** Mounted once by the admin shell, around the strip and the page. */
export function DeskTitleProvider({ suspended, children }: { suspended: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { currentTournament } = useTournament();
  const isSandbox = useIsSandbox();
  const title = !suspended && currentOrg
    ? deskTitleAt({
      pathname,
      base: `/${currentOrg.slug}/admin`,
      status: currentTournament?.status,
      isSandbox,
      role: userRole,
      planId: currentOrg.planId,
      billingLink: kitBillingLink({
        orgSlug: currentOrg.slug, planId: currentOrg.planId, accountKind: currentOrg.accountKind, role: userRole,
        capabilities: userCapabilities, isSandbox,
      }),
    })
    : null;
  return <DeskTitle.Provider value={title}>{children}</DeskTitle.Provider>;
}

/** The page's name the strip shows on a computer, or null where the strip names what the phone bar names. */
export function useDeskTitle(): string | null {
  return useContext(DeskTitle);
}
