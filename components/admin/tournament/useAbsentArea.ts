'use client';
/**
 * AN AREA THIS EVENT DOESN'T HAVE — an invite-only event's hidden pages (Check-in, Staff kit, Chat, Summary) send the
 * host to the dashboard rather than render a wall (the free tournament tier, R5 "never a wall reached from the nav",
 * B2, 2026-10-16). No nav entry leads to them on such a plan, so only a bookmark, a stale link or a typed address
 * arrives here.
 *
 * `area` is asked of the one rule the nav reads (`eventAreas`), so a page and its nav entry can never disagree. Returns
 * true while the page is leaving, so it renders nothing meanwhile — never a flash of the area it doesn't have.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { eventAreas, type PlanArea } from '@/lib/invite-only-event';

export function useAbsentArea(area: PlanArea): boolean {
  const { currentOrg } = useOrg();
  const router = useRouter();
  const slug = currentOrg?.slug ?? null;
  const leaving = slug !== null && !eventAreas(currentOrg?.planId)[area];

  useEffect(() => {
    if (leaving) router.replace(`/${slug}/admin/tournaments/dashboard`);
  }, [leaving, slug, router]);

  return leaving;
}
