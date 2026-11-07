'use client';
/**
 * ORGANIZATION IS A PLACE WITH TABS (⚖ Club Tier Stage 13i, A5 — Ask 3 = A, Ask 4 = B, owner 2026-11-06; drawing tab 2).
 *
 * The title "Organization" and the person's tabs (`orgTabs`: Members · Audit log · Settings · Venue library · PDF settings,
 * each only where it opens — or "The board" in Members' place for someone without Members) over every Organization page that
 * is one of THEIR tabs. The tile hub retired: `/org` goes to the first tab (`org/page.tsx`). Tournaments, My Coaches Portal
 * and Plan & billing are no longer reached from here: Tournaments is a program, the Coaches Portal door and Plan & billing are
 * in the sidebar's foot (Ask 4 B).
 *
 * ⚠ Plan & billing (`/org/billing`) lives under this layout but is NO tab: it keeps its own header and no Organization tab
 * row, and the sidebar lights its foot row there. Audit log lives under `members/audit`, and each tab lights on its OWN
 * address only, so Members never lights over it. An address that is no tab of this person's (a page they cannot open, a
 * legacy address that forwards) renders alone with its own header, as before.
 *
 * A one-team workspace (a coach's own, on a tournament plan) keeps its staff page as it was: the coaches portal is not
 * touched by 13i (Ask 9).
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useOrg } from '@/lib/org-context';
import { orgTabs, placeTabFor, showsOrgBoard } from '@/lib/admin-kit-nav';
import { useOrgLinks } from '../useAdminKitNav';
import PlaceFrame from './PlaceFrame';

/** The person's Organization tabs — the frame's and the `/org` door's one list. */
export function useOrgTabs() {
  const { userRole } = useOrg();
  // Not `useAdminKitNav`: that hook also fetches the coach's team access and builds every rail list.
  const { base, orgLinks, isTeamWorkspace } = useOrgLinks();
  const tabs = orgTabs({
    base,
    orgLinks,
    showsBoard: showsOrgBoard({ role: userRole, orgLinks, isTeamWorkspace }),
  });
  return { tabs, isTeamWorkspace };
}

export default function OrgFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { tabs, isTeamWorkspace } = useOrgTabs();
  const tab = isTeamWorkspace ? null : placeTabFor(tabs, pathname);
  if (!tab) return <>{children}</>;
  return (
    <PlaceFrame header={<AdminPageHeader title="Organization" />} tabs={tabs} activeId={tab} ariaLabel="Organization">
      {children}
    </PlaceFrame>
  );
}
