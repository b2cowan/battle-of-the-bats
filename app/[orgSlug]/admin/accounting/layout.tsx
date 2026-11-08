import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { canOpenModule } from '@/lib/member-access';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import AccountingFrame from '@/components/admin/kit/club/money/AccountingFrame';
import { notYoursScreenProps } from '@/lib/not-yours-server';
import { NotYoursScreen } from '@/components/admin/kit/club/NotYoursScreen';

/**
 * ACCOUNTING — ONE PAGE WITH TABS (⚖ Club Tier Stage 3a, Ask 2 option B, owner 2026-09-30).
 *
 * The gate is decided HERE, on the server, before any tab mounts: the member's Accounting capability
 * AND the plan's (`canOpenModule`, the one rule every Accounting route asks — C17: the pages used to
 * check the role alone and show an "Access restricted" card a moment after drawing their chrome).
 * ⚖ Someone who cannot open Accounting sees the ONE "not yours" screen in place of the tabs (Club Tier Stage 13a, Ask 6
 * = A). A plan that does not carry Accounting (or a cancelled one) and a team workspace still go home, as before.
 *
 * The frame (title, tab row) belongs to the tab pages and to a team's account, a view of the Teams tab
 * (Club Accounting · Teams, Ask 2 — `AccountingFrame` decides by the address).
 */
export default async function AccountingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // `allowSuspendedOrg: true` so a cancelled org reaches the redirect below rather than a 500:
  // `canOpenModule` already fails closed on a cancelled org (the Rep Teams layout's reasoning).
  const ctx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!ctx) redirect(`/auth/login?next=/${orgSlug}/admin/accounting`);
  if (ctx.org.slug !== orgSlug) redirect(`/${ctx.org.slug}/admin/accounting`);
  if (!canOpenModule(ctx, ctx.org, 'module_accounting')) {
    if (isTeamWorkspaceOrg(ctx.org) || !hasModuleEntitlement(ctx.org, 'module_accounting')) {
      redirect(isTeamWorkspaceOrg(ctx.org) ? `/${ctx.org.slug}/coaches` : `/${ctx.org.slug}/admin`);
    }
    return <NotYoursScreen {...await notYoursScreenProps(ctx, 'accounting')} />;
  }

  return (
    // Which tabs (rep teams' loop, Payouts) is the pinned bar's answer, the frame's too (`useClubPlaceAt`): the admin
    // layout reads the payouts fact once for the whole shell.
    <AccountingFrame>{children}</AccountingFrame>
  );
}
