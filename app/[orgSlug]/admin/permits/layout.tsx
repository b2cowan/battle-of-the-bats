import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { isTournamentTier } from '@/lib/billing-urls';
import PermitsFrame from '@/components/admin/kit/club/PermitsFrame';

/**
 * The Permits place (Club Tier Stage 13c, C1 = A): the club side only. A Tournament-plan organization has no club side
 * (Organization's own boundary, `org/layout.tsx`), so it never reaches its permits; the route refuses a coach and the plan
 * (`hasOrgVenueLibrary`) on the server, and the page says so on a plan without the Venue library.
 */
export default async function PermitsLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;
  // `allowSuspendedOrg: true` so a cancelled org reaches the admin shell's own redirect to Plan & billing rather than a 500
  // (every peer layout does the same): the page's API calls stay closed for it, so opening the shell here grants nothing.
  const authCtx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!authCtx) redirect(`/auth/login?next=/${orgSlug}/admin/permits`);
  if (isTournamentTier(authCtx.org.planId)) redirect(`/${orgSlug}/admin/tournaments`);
  return <PermitsFrame>{children}</PermitsFrame>;
}
