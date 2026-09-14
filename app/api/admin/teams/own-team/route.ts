import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { notify } from '@/lib/notify';
import { refreshTournamentChatMembership } from '@/lib/chat-service';
import { addHostOwnTeamToTournament, getHostOwnTeamState, HostOwnTeamError } from '@/lib/host-own-team';

/**
 * The hosting coach's OWN team, in the tournament their portal runs (lib/host-own-team.ts has the
 * why). GET answers the Teams page's "draw the button or the chip?"; POST is the button.
 *
 * Same guard as every write on /api/admin/teams — the org scope, `create_tournaments`, the
 * tournament in the org and in the caller's assignment. No second gate for a delegate: the Run
 * tournaments switch hands over the whole tournament page or nothing (delegation ruling 2026-09-13,
 * D2 here), and the registration is written as the head coach whoever clicks.
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return json({ error: 'tournamentId is required.' }, 400);
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const state = await getHostOwnTeamState(ctx.org, tournamentId);
  return json({ ownTeam: state });
}, { route: '/api/admin/teams/own-team' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  const body = await req.json().catch(() => ({})) as { tournamentId?: unknown; divisionId?: unknown; paymentStatus?: unknown };
  const tournamentId = typeof body.tournamentId === 'string' ? body.tournamentId : '';
  const divisionId = typeof body.divisionId === 'string' ? body.divisionId : '';
  if (!tournamentId || !divisionId) return json({ error: 'Division and tournament are required.' }, 400);
  const paymentStatus = body.paymentStatus === 'pending' ? 'pending' : 'paid';

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const { data: tournament } = await supabaseAdmin.from('tournaments').select('status').eq('id', tournamentId).maybeSingle<{ status: string }>();
  if (tournament?.status === 'completed') {
    return json({ error: 'This tournament is completed and locked. Set the status to Active in Event Settings to make changes.' }, 409);
  }

  try {
    const result = await addHostOwnTeamToTournament({
      org: ctx.org,
      tournamentId,
      divisionId,
      paymentStatus,
      actorUserId: ctx.user.id,
    });

    // Fire-and-forget, like Add Team: the host's team joined; the chat rooms learn it now rather
    // than when someone next opens the admin chat screen.
    refreshTournamentChatMembership(tournamentId).catch(console.error);
    notify({
      orgId: ctx.org.id,
      tournamentId,
      eventType: 'registration_new',
      title: `New registration: ${result.teamName}`,
      body: 'Your team · Added by the host',
      link: `/${ctx.org.slug}/admin/tournaments/registrations?tournamentId=${tournamentId}`,
      excludeUserIds: [ctx.user.id],
    }).catch(console.error);

    return json({ success: true, id: result.registrationId }, 201);
  } catch (error) {
    if (error instanceof HostOwnTeamError) return json({ error: error.message }, error.status);
    throw error;
  }
}, { route: '/api/admin/teams/own-team' });
