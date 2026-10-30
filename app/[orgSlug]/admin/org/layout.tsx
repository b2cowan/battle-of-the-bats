import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { isTournamentTier } from '@/lib/billing-urls';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';

/**
 * Org-admin tier boundary.
 *
 * Tournament and Tournament Plus are standalone tournament-operator subscriptions
 * with no concept of an "org" — they live entirely within /admin/tournaments/ and
 * must never reach any /admin/org/ page (billing, members, venues, settings, etc.).
 * This server-side guard is the only boundary (proxy.ts's earlier copy read the stored plan and went in Support
 * console Stage 4): `authCtx.org.planId` is the door's answer, so a club on free Club time is let in and is bounced
 * again the moment it ends. The admin rail (`AdminKitRail`) hides the section in the nav.
 * A one-team workspace on a tournament plan is let in: its staff and access page and billing alias live here.
 */
export default async function OrgAdminLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;

  // ⚠ `allowSuspendedOrg: true` is LOAD-BEARING: the resubscribe page (/admin/org/billing) is a
  // child of this layout, so throwing here would strand a cancelled org with no way to pay again.
  // See the same note in the parent admin layout; the API rail keeps everything else closed.
  const authCtx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/admin/org`);
  }

  if (isTournamentTier(authCtx.org.planId) && !isTeamWorkspaceOrg(authCtx.org)) {
    redirect(`/${orgSlug}/admin/tournaments`);
  }

  return <>{children}</>;
}
