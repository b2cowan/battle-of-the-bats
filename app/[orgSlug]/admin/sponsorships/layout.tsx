import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { hasModuleEntitlement, isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { opensSponsorships } from '@/lib/club-sponsorships-place';
import { familiesBarredFor } from '@/lib/member-access';
import { notYoursScreenProps } from '@/lib/not-yours-server';
import SponsorshipsFrame from '@/components/admin/kit/club/sponsorships/SponsorshipsFrame';
import { NotYoursScreen } from '@/components/admin/kit/club/NotYoursScreen';

/**
 * SPONSORSHIPS — A CLUB PLACE WITH FOUR TABS (Board Ready Stage 6, Part 1; ask 12 + its note, owner 2026-11-22): Deals ·
 * Packages · Sponsors · Setup. The gate is decided HERE, on the server, before any tab mounts: `opensSponsorships`, the one
 * pure answer the sidebar row, the bar and every route ask. Someone it is not open to sees the ONE "not yours" screen, with
 * the owner named (the owner gives the access in Manage member). A tournament-only organization has no club side; a team
 * workspace goes to its portal; a plan that does not carry Sponsorships (or a cancelled one) goes home — that is not
 * "not yours".
 */
export default async function SponsorshipsLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // `allowSuspendedOrg` so a cancelled org reaches the redirect below rather than a 500 (every peer layout does the same).
  const ctx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!ctx) redirect(`/auth/login?next=/${orgSlug}/admin/sponsorships`);
  if (ctx.org.slug !== orgSlug) redirect(`/${ctx.org.slug}/admin/sponsorships`);
  if (isTeamWorkspaceOrg(ctx.org)) redirect(`/${ctx.org.slug}/coaches`);
  if (isTournamentOnlyWorkspace(ctx.org)) redirect(`/${ctx.org.slug}/admin/tournaments`);
  if (!hasModuleEntitlement(ctx.org, 'module_sponsorships')) redirect(`/${ctx.org.slug}/admin`);
  if (!opensSponsorships({ role: ctx.role, capabilities: ctx.capabilities, limited: !!ctx.repGroupIds }, ctx.org)) {
    // A member limited to some teams is never given it (as Families): the screen must not send them to ask.
    const limited = familiesBarredFor(ctx.role, !!ctx.repGroupIds);
    return <NotYoursScreen {...await notYoursScreenProps(ctx, limited ? 'sponsorshipsLimited' : 'sponsorships')} />;
  }
  return <SponsorshipsFrame>{children}</SponsorshipsFrame>;
}
