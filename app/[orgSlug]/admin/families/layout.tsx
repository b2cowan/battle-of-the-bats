import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { canOpenFamilies } from '@/lib/families-access';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import FamiliesFrame from '@/components/admin/kit/club/families/FamiliesFrame';

/**
 * FAMILIES — ONE PAGE WITH TABS (⚖ Club Tier Stage 5b, Ask 14, owner ratification 2026-10-17).
 *
 * The gate is decided HERE, on the server, before any tab mounts — the same three questions every Families route asks
 * (`canOpenFamilies`, lib/families-auth.ts: the member holds Families, the plan carries it, the member is not limited to
 * a group of teams). Until 5b each page asked on the client and drew a "needs the permission" card after its chrome.
 * Someone who cannot open Families goes back to the club's Overview, as Accounting sends them.
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
    redirect(isTeamWorkspaceOrg(ctx.org) ? `/${ctx.org.slug}/coaches` : `/${ctx.org.slug}/admin`);
  }

  return <FamiliesFrame orgSlug={ctx.org.slug}>{children}</FamiliesFrame>;
}
