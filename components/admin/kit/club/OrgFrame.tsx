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
 *
 * ⚖ THE TITLE AND THE TABS ARE IN THE PINNED BAR (Admin header bar Phase 2, owner 2026-11-07): "Organization", the club on
 * the small line on desktop, the person's tabs pinned inside the bar — Rep teams' shape. A person with one tab gets no row
 * (`HubTabBar`'s rule, and the bar keeps its bottom padding). The person's tabs are `useOrgTabs` (`useAdminKitNav.ts`),
 * the one list this frame, the bar and the `/org` door read.
 */
import type { ReactNode } from 'react';
import { useClubPlaceAt } from '@/components/admin/AdminBarPlace';
import PlaceFrame from './PlaceFrame';

export default function OrgFrame({ children }: { children: ReactNode }) {
  // Is this address one of THIS person's Organization tabs (`orgTabs`; a one-team workspace has none)? The bar asks the
  // same question from the address alone, so its first paint is this frame's.
  const place = useClubPlaceAt();
  if (place?.key !== 'org') return <>{children}</>;
  return <PlaceFrame place={place}>{children}</PlaceFrame>;
}
