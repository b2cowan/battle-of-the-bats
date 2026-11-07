import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasCapability } from '@/lib/roles';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { notYoursScreenProps } from '@/lib/not-yours-server';
import { NotYoursScreen } from '@/components/admin/kit/club/NotYoursScreen';
import RepTeamsFrame from '@/components/admin/kit/club/RepTeamsFrame';

export default async function RepTeamsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // `allowSuspendedOrg: true` so this layout reaches its OWN cancelled-org handling below rather
  // than 500ing: `hasModuleEntitlement` already fails closed on a cancelled org and redirects out
  // of rep-teams. Opening the resolver grants nothing — it just lets the right redirect happen.
  const ctx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });

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
    // A plan that does not carry Rep teams (or a cancelled one) and a team workspace go home: that is not "not yours".
    if (isTeamWorkspaceOrg(ctx.org) || !hasModuleEntitlement(ctx.org, 'module_rep_teams')) {
      redirect(isTeamWorkspaceOrg(ctx.org) ? `/${ctx.org.slug}/coaches` : `/${ctx.org.slug}/admin`);
    }
    // ⚖ Someone who does not hold Rep teams sees the ONE "not yours" screen in place of the page (Club Tier Stage 13a, Ask
    // 6 = A). Every Rep teams page sits under this layout, so none of them draws a refusal of its own.
    return <NotYoursScreen {...await notYoursScreenProps(ctx, 'repTeams')} />;
  }

  // ⚖ Rep teams is a place with tabs (Club Tier Stage 13i, A2): its title and tab row over every page but a team's (a place of
  // its own) and a record page one level down.
  return <RepTeamsFrame orgSlug={ctx.org.slug}>{children}</RepTeamsFrame>;
}
