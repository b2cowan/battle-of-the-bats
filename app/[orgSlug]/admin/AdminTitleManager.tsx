'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { membersLabel } from '@/lib/member-access';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import { useTournament } from '@/lib/tournament-context';
import { adminTabTitle } from '@/lib/admin-tab-title';

/** Sets the browser tab's title; the rules (and why the tournament's name is on tournament pages only) are in
 *  `lib/admin-tab-title.ts`. */
export default function AdminTitleManager() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();

  useEffect(() => {
    document.title = adminTabTitle({
      pathname,
      orgName: currentOrg?.name,
      tournamentName: currentTournament?.name,
      // The people page is "Staff & access" in a one-team workspace; the tab says what the page title says.
      membersLabel: membersLabel(isTeamWorkspaceOrg(currentOrg)),
    });
  }, [pathname, currentOrg, currentTournament?.name]);

  return null;
}
