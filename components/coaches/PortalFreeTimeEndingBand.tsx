'use client';
/**
 * The Premium Overview's notice for the last 14 days of free time staff gave (owner 2026-10-28): a coach who loses
 * track of the date finds it on the first screen they land on, not on a billing page they have no reason to open. Shown
 * only for an ENDING portal (nothing for running free time or a portal that pays); the head coach also gets Keep Premium,
 * the same door as the billing page's card. The words and the fetch are the billing pages' own (`portalEndingOverviewBand`,
 * `useCustomerFreeTime`).
 */
import FreeTimeBand, { useCustomerFreeTime } from '@/components/admin/FreeTimeBand';
import { teamWorkspaceReactivatePath } from '@/lib/coaches-portal-routes';
import { portalEndingOverviewBand } from '@/lib/portal-free-time';

export default function PortalFreeTimeEndingBand({ orgSlug, orgName, canKeep }: { orgSlug: string; orgName: string | null; canKeep: boolean }) {
  const state = useCustomerFreeTime(orgSlug);
  const band = portalEndingOverviewBand(state?.portal ?? null);
  if (!band) return null;
  return (
    <FreeTimeBand
      band={band}
      action={canKeep ? { label: 'Keep Premium', href: `${teamWorkspaceReactivatePath({ slug: orgSlug, name: orgName })}&keep=1` } : undefined}
    />
  );
}
