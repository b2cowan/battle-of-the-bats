import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { canOpenFamilies } from '@/lib/families-access';
import { familiesBarredFor } from '@/lib/member-access';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { notYoursScreenProps } from '@/lib/not-yours-server';
import FamiliesFrame from '@/components/admin/kit/club/families/FamiliesFrame';
import { NotYoursScreen } from '@/components/admin/kit/club/NotYoursScreen';

/**
 * FAMILIES — ONE PAGE WITH TABS (⚖ Club Tier Stage 5b, Ask 14, owner ratification 2026-10-17).
 *
 * The gate is decided HERE, on the server, before any tab mounts — the same three questions every Families route asks
 * (`canOpenFamilies`, lib/families-auth.ts: the member holds Families, the plan carries it, the member is not limited to
 * a group of teams). Until 5b each page asked on the client and drew a "needs the permission" card after its chrome.
 * ⚖ Someone who cannot open Families sees the ONE "not yours" screen in place of the page (Club Tier Stage 13a, Ask 6 =
 * A): what Families is, who gives access by name, and a door back to their own home. A plan that does not carry Families
 * (or a cancelled one) and a team workspace still go home, as before: that is not "not yours".
 */
export default async function FamiliesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const ctx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!ctx) redirect(`/auth/login?next=/${orgSlug}/admin/families`);
  if (ctx.org.slug !== orgSlug) redirect(`/${ctx.org.slug}/admin/families`);
  // `allowSuspendedOrg` so a cancelled org reaches this redirect rather than a 500: the plan half fails closed on it.
  if (!canOpenFamilies(ctx, ctx.org)) {
    if (isTeamWorkspaceOrg(ctx.org) || !hasModuleEntitlement(ctx.org, 'module_families')) {
      redirect(isTeamWorkspaceOrg(ctx.org) ? `/${ctx.org.slug}/coaches` : `/${ctx.org.slug}/admin`);
    }
    // A member limited to some teams is never given Families (Stage 5a, Ask 12): the screen must not send them to ask.
    const limited = familiesBarredFor(ctx.role, !!ctx.repGroupIds);
    return <NotYoursScreen {...await notYoursScreenProps(ctx, limited ? 'familiesLimited' : 'families')} />;
  }

  return <FamiliesFrame>{children}</FamiliesFrame>;
}
