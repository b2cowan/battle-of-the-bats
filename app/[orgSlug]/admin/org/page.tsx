'use client';
/**
 * `/org` — THE DOOR TO ORGANIZATION, NOT A PAGE (⚖ Club Tier Stage 13i, A5 — Ask 3 = A, owner 2026-11-06).
 *
 * ⚰ The tile hub retired: Organization is a place with tabs (`OrgFrame`), so its address goes to the FIRST tab the person
 * holds — a replace, so Back does not return here. One tab is that page with no tab row (13a's one-door rule); none is the ONE
 * "not yours" screen. Tournaments, My Coaches Portal and Plan & billing, which the hub also tiled, are reached from the
 * sidebar (a program row, the foot's doors). The board by name (13a R1) is the "The board" tab of anyone without Members.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { NotYours } from '@/components/admin/kit/club/NotYours';
import { useOrgTabs } from '@/components/admin/kit/club/OrgFrame';
import LoadingState from '@/components/shared/LoadingState';

export default function OrgDoor() {
  const router = useRouter();
  const { currentOrg, userRole, loading } = useOrg();
  const { tabs } = useOrgTabs();
  const ready = !loading && !!userRole && !!currentOrg;
  const first = ready ? tabs[0]?.href ?? null : null;

  useEffect(() => {
    if (first) router.replace(first);
  }, [first, router]);

  if (!ready || first) return <LoadingState label="Loading the organization…" />;
  return <NotYours page="organization" />;
}
