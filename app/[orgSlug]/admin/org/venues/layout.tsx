import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { canReadVenueLibrary } from '@/lib/venue-library';
import { isOrgBillingSuspended } from '@/lib/org-billing-access';

/**
 * Organization › Venue library's door (Board Ready trust close-out 2, owner 2026-11-18): the library reads only for those
 * who schedule, run tournaments or handle money (`canReadVenueLibrary`). Anyone else is sent to Organization, never shown
 * a page whose read is refused; Organization's tabs have no Venue library row for them either. The plan and the
 * Tournament-plan boundary stay with Organization's own layout and the page.
 */
export default async function VenueLibraryLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;
  // Opted out of the billing rail so a cancelled club is sent on (to Organization, whose shell redirects it to Plan & billing)
  // rather than shown an error page; nothing of the library renders for it.
  const authCtx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!authCtx) redirect(`/auth/login?next=/${orgSlug}/admin/org/venues`);
  if (isOrgBillingSuspended(authCtx.org) || !canReadVenueLibrary(authCtx, authCtx.org)) redirect(`/${orgSlug}/admin/org`);
  return children;
}
