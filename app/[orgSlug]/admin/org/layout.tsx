import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { isTournamentTier } from '@/lib/billing-urls';

/**
 * Org-admin tier boundary.
 *
 * Tournament and Tournament Plus are standalone tournament-operator subscriptions
 * with no concept of an "org" — they live entirely within /admin/tournaments/ and
 * must never reach any /admin/org/ page (billing, members, venues, settings, etc.).
 * This server-side guard is the authoritative boundary; proxy.ts adds an earlier
 * redirect, and AdminSidebar hides the section in the nav.
 */
export default async function OrgAdminLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;

  const authCtx = await getAuthContextWithRole({ orgSlug });
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/admin/org`);
  }

  if (isTournamentTier(authCtx.org.planId)) {
    redirect(`/${orgSlug}/admin/tournaments`);
  }

  return <>{children}</>;
}
