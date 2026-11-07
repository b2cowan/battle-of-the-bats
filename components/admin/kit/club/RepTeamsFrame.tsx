'use client';
/**
 * REP TEAMS IS A PLACE WITH TABS (⚖ Club Tier Stage 13i, A2 — Asks 1 and 2 = A, owner 2026-11-06; drawing tabs 2 and 4).
 *
 * One title, "Rep teams", and its six tabs (`repTeamsTabs`: Teams · Assistant coaches · Document templates · Shared
 * library · Past seasons · Bring in a coach's team) over every Rep teams page — EXCEPT under a team, which is a place of
 * its own (`TeamFrame`, its own header and five tabs), and a record page one level down (Rename team addresses, reached
 * from the Teams toolbar: its own "← Teams" and no tab row — owner 2026-11-06). Each tab is its own address. No create
 * sits in this header: Add team is the Teams tab's toolbar's last control (2026-09-30: a create belongs to its tab).
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { placeTabFor, repTeamsTabs } from '@/lib/admin-kit-nav';
import PlaceFrame from './PlaceFrame';

export default function RepTeamsFrame({ orgSlug, children }: { orgSlug: string; children: ReactNode }) {
  const pathname = usePathname();
  const tabs = repTeamsTabs(`/${orgSlug}/admin`);
  const tab = placeTabFor(tabs, pathname);
  if (!tab) return <>{children}</>;
  return (
    <PlaceFrame header={<AdminPageHeader title="Rep teams" />} tabs={tabs} activeId={tab} ariaLabel="Rep teams">
      {children}
    </PlaceFrame>
  );
}
