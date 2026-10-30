import BillingKit from '@/components/admin/kit/club/BillingKit';

import { redirect } from 'next/navigation';
import { getCoachPortalAuth } from '@/lib/coach-portal-request';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import { getBillingHref } from '@/lib/billing-urls';
import { pathWithSearchParams } from '@/lib/coaches-portal-routes';

/** Hosted by admin except for the retired standalone address and its subscription alias. */
export default async function BillingPage({ params, searchParams }: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgSlug } = await params;
  const auth = await getCoachPortalAuth(orgSlug);
  if (auth && isTeamWorkspaceOrg(auth.org)) {
    // Preserve payment-return and plan-panel flags from old emails and bookmarks. Temporary on purpose
    // (owner, Stage 3 walk 3): a browser must not remember it if this workspace later becomes a Club.
    redirect(pathWithSearchParams(getBillingHref(auth.org, { host: 'coach', purpose: 'return' }), await searchParams));
  }
  return <BillingKit />;
}
