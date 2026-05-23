import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasCapability } from '@/lib/roles';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';

export default async function RepTeamsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const ctx = await getAuthContextWithRole({ orgSlug });

  if (!ctx) {
    redirect(`/auth/login?next=/${orgSlug}/admin/rep-teams`);
  }

  if (ctx.org.slug !== orgSlug) {
    redirect(`/${ctx.org.slug}/admin/rep-teams`);
  }

  if (
    !hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams') ||
    !hasModuleEntitlement(ctx.org, 'module_rep_teams')
  ) {
    redirect(isTeamWorkspaceOrg(ctx.org) ? `/${ctx.org.slug}/coaches` : `/${ctx.org.slug}/admin`);
  }

  return <>{children}</>;
}
