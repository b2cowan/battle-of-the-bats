'use client';
/**
 * The Premium Overview's notice for the last 14 days of free time staff gave (owner 2026-10-28): a coach who loses
 * track of the date finds it on the first screen they land on, not on a billing page they have no reason to open. Shown
 * only for an ENDING portal (nothing for running free time or a portal that pays). Keep Premium, the same door as the
 * billing page's card, goes to the portal's OWNER alone, because the purchase attaches only to the owner's portal; every
 * other coach reads the same notice with a line to ask the owner (owner 2026-10-30, Stage 4b). The words and the fetch
 * are the billing pages' own (`portalEndingOverviewBand`, `useCustomerFreeTime`).
 */
import FreeTimeBand, { useCustomerFreeTime } from '@/components/admin/FreeTimeBand';
import { teamWorkspaceReactivatePath } from '@/lib/coaches-portal-routes';
import { portalEndingOverviewBand } from '@/lib/portal-free-time';

export default function PortalFreeTimeEndingBand({ orgSlug, orgName }: { orgSlug: string; orgName: string | null }) {
  const state = useCustomerFreeTime(orgSlug);
  const canKeep = state?.canKeepPremium === true;
  const band = portalEndingOverviewBand(state?.portal ?? null, canKeep);
  if (!band) return null;
  return (
    <FreeTimeBand
      band={band}
      action={canKeep ? { label: 'Keep Premium', href: `${teamWorkspaceReactivatePath({ slug: orgSlug, name: orgName })}&keep=1` } : undefined}
    />
  );
}
