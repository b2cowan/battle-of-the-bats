'use client';
/**
 * REP TEAMS IS A PLACE WITH TABS (⚖ Club Tier Stage 13i, A2 — Asks 1 and 2 = A, owner 2026-11-06; drawing tabs 2 and 4).
 *
 * One title, "Rep teams", and its six tabs (`repTeamsTabs`: Teams · Assistant coaches · Document templates · Shared
 * library · Past seasons · Bring in a coach's team) over every Rep teams page — EXCEPT under a team, which is a place of
 * its own (`TeamFrame`, its own header and five tabs), and a record page one level down (Rename team addresses, reached
 * from the Teams toolbar: its own "← Teams" and no tab row — owner 2026-11-06). Each tab is its own address. No create
 * sits in this header: Add team is the Teams tab's toolbar's last control (2026-09-30: a create belongs to its tab).
 * ⚖ N9 (13i B3): each tab carries its own waiting count — Assistant coaches the brief's, the number the sidebar's Rep
 * teams row carries as the sum of its tabs'.
 *
 * ⚖ THE TITLE AND THE TABS ARE IN THE PINNED BAR (Admin header bar Phase 2, owner 2026-11-07): "Rep teams", the club on
 * the small line on desktop (A4), the six tabs pinned inside the bar. Nothing on the paper above the page.
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { clubPlaceAt } from '@/lib/admin-kit-nav';
import { briefPageCount, useClubBrief } from './ClubBriefProvider';
import { WaitingCount } from './money/MoneyKit';
import PlaceFrame from './PlaceFrame';

export default function RepTeamsFrame({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const pathname = usePathname();
  const { canOpen } = useOrg();
  const { brief } = useClubBrief();
  // The bar asks the same question from the address alone, so its first paint is this frame's.
  const place = clubPlaceAt(pathname, `/${orgSlug}/admin`, { canUse: canOpen, seasonAccess: null });
  if (place?.key !== 'rep-teams') return <>{children}</>;
  const tabs = place.tabs.map(t => {
    const count = briefPageCount(brief, t.id);
    return count > 0 ? { ...t, mark: <WaitingCount n={count} /> } : t;
  });
  return <PlaceFrame place={{ ...place, tabs }}>{children}</PlaceFrame>;
}
