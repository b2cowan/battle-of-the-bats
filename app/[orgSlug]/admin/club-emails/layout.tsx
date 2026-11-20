import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { hasModuleEntitlement, isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { BOARD_ROLES } from '@/lib/board-people';
import { opensCommunications, placeFacts } from '@/lib/club-communications-place';
import { notYoursScreenProps } from '@/lib/not-yours-server';
import CommunicationsFrame from '@/components/admin/kit/club/communications/CommunicationsFrame';
import { NotYoursScreen } from '@/components/admin/kit/club/NotYoursScreen';

/**
 * COMMUNICATIONS — A CLUB PLACE WITH ONE PAGE (Club Communications Stage 1, Session 2; drawing tabs 1 and 4). The gate is
 * decided HERE, on the server, before the page mounts: `opensCommunications`, the one pure answer the sidebar, the bar and
 * the routes ask (the routes through `lib/club-communications-auth.ts`; this layer reads only the pure rules). Someone it is
 * not open to sees the ONE "not yours" screen (tab 4), the club's name in the bar:
 *   · a board seat (an admin, a league admin, a registrar) whose switch is off — "{owner} can give {an admin} access";
 *   · everyone else (staff, a volunteer, a member limited to some teams) — "{owner} and the people on the club's board open
 *     it": no switch gives them the place, they have nobody to write to.
 * A tournament-only organization has no club side; a team workspace goes to its portal; a plan that does not carry the
 * place (a cancelled one: the plan half closes) goes home, as Families' layout does — that is not "not yours".
 * ⚖ Session 3: a treasurer has the place (their one button is Email the board), so a treasurer whose switch is off is a board
 * seat like the rest: "{owner} can give a treasurer access".
 */
export default async function CommunicationsLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // `allowSuspendedOrg` so a cancelled org reaches the redirect below rather than a 500 (every peer layout does the same).
  const ctx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!ctx) redirect(`/auth/login?next=/${orgSlug}/admin/club-emails`);
  if (ctx.org.slug !== orgSlug) redirect(`/${ctx.org.slug}/admin/club-emails`);
  if (isTeamWorkspaceOrg(ctx.org)) redirect(`/${ctx.org.slug}/coaches`);
  if (isTournamentOnlyWorkspace(ctx.org)) redirect(`/${ctx.org.slug}/admin/tournaments`);
  if (!hasModuleEntitlement(ctx.org, 'module_communications')) redirect(`/${ctx.org.slug}/admin`);
  const facts = placeFacts({ role: ctx.role, capabilities: ctx.capabilities, limited: !!ctx.repGroupIds }, ctx.org);
  if (!opensCommunications(facts)) {
    const page = (BOARD_ROLES as readonly string[]).includes(ctx.role) && !ctx.repGroupIds ? 'communications' : 'communicationsBoard';
    return <NotYoursScreen {...await notYoursScreenProps(ctx, page)} />;
  }
  return <CommunicationsFrame>{children}</CommunicationsFrame>;
}
