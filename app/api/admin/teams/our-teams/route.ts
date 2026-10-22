import {
  getAuthContextWithScope, getAuthContextWithRole, unauthorized, forbidden, scopeGuard, requireTournamentInOrg, GROUP_UNSCOPED_ROLES,
} from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { canOpenModule } from '@/lib/member-access';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import { isUuid } from '@/lib/utils';
import { withObservability } from '@/lib/observability';
import { notify } from '@/lib/notify';
import { tournamentTeamAdderUserIds } from '@/lib/notify-recipients';
import { refreshTournamentChatMembership } from '@/lib/chat-service';
import {
  enterOwnTeams, listOurTeamRows, listOwnTeamOptions, OwnTeamsEntryError,
} from '@/lib/club-own-teams-entry';

/**
 * ADD OUR TEAMS (Club Tier Stage 7b; lib/club-own-teams-entry.ts has the why).
 *
 * GET — the Teams page's two answers about the club's own teams in this tournament:
 *   `ours`    every registration that is our team, with its head coach read live (the row's Our team, Coach and No fee). Any
 *             member who may open this tournament reads it, on every plan (the one answer, lib/club-own-tournament-team.ts).
 *   `options` the window's list, or null when this member may not use it.
 * POST — enter the set: { tournamentId, entries: [{ repTeamId, divisionId }] }. All entered or none.
 *
 * Who may enter: whoever may add teams to the tournament today (`create_tournaments`), in a club that runs rep teams and is not a
 * coaches portal (a portal has one team and its own "Add my team"). A member limited to team groups enters only those teams.
 * A head coach has no way in from the coaches portal: a club team's tournament entry is the club's (registrable-teams).
 * No email goes to anyone; the people who may add teams get a bell notice, the club's coaches do not.
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Ctx = NonNullable<Awaited<ReturnType<typeof getAuthContextWithScope>>>;

function mayEnter(ctx: Ctx): boolean {
  return hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')
    && hasModuleEntitlement(ctx.org, 'module_rep_teams')
    && !isTeamWorkspaceOrg(ctx.org);
}

/** The member's team groups (null = every team), read the way the rep-teams routes read them. */
async function repGroupIdsOf(ctx: Ctx, orgSlug: string | undefined): Promise<string[] | null | false> {
  // These roles never carry a team-group limit, so there is nothing to look up.
  if (GROUP_UNSCOPED_ROLES.includes(ctx.role)) return null;
  const roleCtx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  return roleCtx ? roleCtx.repGroupIds : false;
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  // The live head coach's name and email are the tournaments area's to read, never any member of the club (the Teams route's
  // own gate; a scorekeeper or a coach-role member with no assignment would otherwise read every team's coach).
  if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();
  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId || !isUuid(tournamentId)) return json({ error: 'tournamentId is required.' }, 400);
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const optionsFor = async () => {
    const repGroupIds = await repGroupIdsOf(ctx, orgSlug);
    return repGroupIds === false ? false : listOwnTeamOptions({ orgId: ctx.org.id, tournamentId, repGroupIds });
  };
  const [ours, options] = await Promise.all([
    listOurTeamRows(ctx.org.id, tournamentId),
    mayEnter(ctx) ? optionsFor() : null,
  ]);
  if (options === false) return unauthorized();
  return json({ ours, options });
}, { route: '/api/admin/teams/our-teams' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!mayEnter(ctx)) return forbidden();

  const body = await req.json().catch(() => ({})) as { tournamentId?: unknown; entries?: unknown };
  const tournamentId = typeof body.tournamentId === 'string' ? body.tournamentId : '';
  if (!isUuid(tournamentId)) return json({ error: 'tournamentId is required.' }, 400);
  const raw = Array.isArray(body.entries) ? body.entries : [];
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const entries = raw.map((e: { repTeamId?: unknown; divisionId?: unknown } | null) => ({
    repTeamId: text(e?.repTeamId),
    divisionId: text(e?.divisionId),
  }));
  if (!entries.length) return json({ error: 'Choose at least one team.' }, 400);
  if (entries.length > 100) return json({ error: 'Choose at most 100 teams at once.' }, 400);
  if (entries.some(e => !isUuid(e.repTeamId))) return json({ error: 'That rep team is not in your organization.' }, 404);
  if (entries.some(e => !isUuid(e.divisionId))) return json({ error: 'Choose a division for every team.' }, 400);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const [wrongOrg, repGroupIds] = await Promise.all([requireTournamentInOrg(ctx, tournamentId), repGroupIdsOf(ctx, orgSlug)]);
  if (wrongOrg) return wrongOrg;
  if (repGroupIds === false) return unauthorized();

  try {
    const entered = await enterOwnTeams({
      orgId: ctx.org.id, tournamentId, actorUserId: ctx.user.id, repGroupIds, entries,
    });

    // The chat pause keeps a registration's room re-sync running on purpose (it seats nobody new and tells no one).
    refreshTournamentChatMembership(tournamentId).catch(console.error);
    // Only the people who may add teams hear of it; an empty list must never reach notify() (it falls back to everyone).
    const recipients = (await tournamentTeamAdderUserIds(ctx.org.id, tournamentId).catch(() => [] as string[]))
      .filter(id => id !== ctx.user.id);
    if (recipients.length) {
      for (const team of entered) {
        notify({
          orgId: ctx.org.id,
          tournamentId,
          eventType: 'registration_new',
          title: `New registration: ${team.name}`,
          body: 'Our team · Added by the club',
          link: `/${ctx.org.slug}/admin/tournaments/registrations?tournamentId=${tournamentId}`,
          userIds: recipients,
        }).catch(console.error);
      }
    }
    return json({ success: true, entered }, 201);
  } catch (error) {
    if (error instanceof OwnTeamsEntryError) return json({ error: error.message }, error.status);
    throw error;
  }
}, { route: '/api/admin/teams/our-teams' });
