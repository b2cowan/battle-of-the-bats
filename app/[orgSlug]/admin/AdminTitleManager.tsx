'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { membersLabel } from '@/lib/member-access';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import { useTournament } from '@/lib/tournament-context';
import { adminTabTitle, isTournamentRoute } from '@/lib/admin-tab-title';

/** Sets the browser tab's title; the rules (and why the tournament's name is on tournament pages only) are in
 *  `lib/admin-tab-title.ts`. */
export default function AdminTitleManager() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();

  useEffect(() => {
    const title = adminTabTitle({
      pathname,
      orgName: currentOrg?.name,
      tournamentName: currentTournament?.name,
      // The people page is "Staff & access" in a one-team workspace; the tab says what the page title says.
      membersLabel: membersLabel(isTeamWorkspaceOrg(currentOrg)),
    });
    document.title = title;
    // ⚠ Tournament pages only. The route's own metadata title ("Admin | {org}") arrives AFTER hydration and replaces this
    // one, and so do the pages' fixed `usePageTitle` names. Both used to be overwritten again only because the tournament
    // list landed seconds later and re-ran this effect, which made this title the final word on every tournament page.
    // Since the list reaches the first paint (Navigation Phase 0) nothing re-runs, so here the title is put back whenever
    // something replaces it, which keeps that final word. Club pages are left alone: their pages name themselves
    // (`usePageTitle`), and this effect must not overrule them. The equality check ends the loop.
    if (!isTournamentRoute(pathname)) return;
    // ⚠ Compare with the title as the browser READS it back: `document.title` strips and collapses whitespace, so a name
    // with a double space or a trailing one would never equal what was written, and every write would wake the observer
    // again (a loop that freezes the tab; /review 2026-11-09).
    const asRead = title.replace(/[\t\n\f\r ]+/g, ' ').trim();
    const keep = () => { if (document.title !== asRead) document.title = asRead; };
    const observer = new MutationObserver(keep);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname, currentOrg, currentTournament?.name]);

  return null;
}
