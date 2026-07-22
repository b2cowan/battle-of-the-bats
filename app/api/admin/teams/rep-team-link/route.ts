import { NextResponse } from 'next/server';
import {
  getAuthContextWithScope,
  unauthorized,
  forbidden,
  scopeGuard,
  requireTournamentInOrg,
} from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { withObservability } from '@/lib/observability';
import {
  getRepTeamLinksForTournament,
  linkRepTeamToRegistration,
  unlinkRepTeamFromRegistration,
  repTeamBelongsToOrg,
  registrationBelongsToTournament,
} from '@/lib/rep-team-tournament-links';

/**
 * Admin control behind WI-2C.3 — links a tournament registration (`teams` row) to a rep
 * team so the public tournament page recognizes that team's paid-portal coaches. Mirrors
 * the `/api/admin/teams` auth chain (scope guard → tournament-in-org) and additionally
 * requires the rep-teams module AND asserts `rep_teams.org_id === ctx.org.id`, so
 * cross-tenant linking is structurally impossible. Passive: no proactive match prompts.
 */

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Shared gate: auth + tournament scope + rep-teams entitlement + registration binding. */
async function guardTournamentRepAccess(req: Request, tournamentId: string | null) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() as Response };
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return { error: forbidden() };
  // Same two-axis reserved-module check the rep-teams routes use — linking only exists for
  // League/Club orgs that actually run rep teams.
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return { error: forbidden() };

  if (!tournamentId) return { error: badRequest('tournamentId is required.') };
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return { error: denied };
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return { error: wrongOrg };

  return { ctx };
}

export const GET = withObservability(async (req: Request) => {
  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  const gate = await guardTournamentRepAccess(req, tournamentId);
  if (gate.error) return gate.error;

  const links = await getRepTeamLinksForTournament(tournamentId!);
  return NextResponse.json({ links });
}, { route: '/api/admin/teams/rep-team-link' });

export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const tournamentId = typeof body.tournamentId === 'string' ? body.tournamentId : null;
  const registrationId = typeof body.registrationId === 'string' ? body.registrationId : '';
  const repTeamId = typeof body.repTeamId === 'string' ? body.repTeamId : '';

  const gate = await guardTournamentRepAccess(req, tournamentId);
  if (gate.error) return gate.error;
  const { ctx } = gate;

  if (!registrationId || !repTeamId) return badRequest('registrationId and repTeamId are required.');

  // The registration must belong to THIS (scope-checked) tournament...
  if (!(await registrationBelongsToTournament(registrationId, tournamentId!))) {
    return NextResponse.json({ error: 'That registration is not part of this tournament.' }, { status: 404 });
  }
  // ...and the rep team must belong to the caller's org (cross-tenant linking impossible).
  if (!(await repTeamBelongsToOrg(repTeamId, ctx.org.id))) {
    return NextResponse.json({ error: 'That rep team is not in your organization.' }, { status: 404 });
  }

  await linkRepTeamToRegistration({
    registrationId,
    repTeamId,
    orgId: ctx.org.id,
    userId: ctx.user.id,
  });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/teams/rep-team-link' });

export const DELETE = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const tournamentId = typeof body.tournamentId === 'string' ? body.tournamentId : null;
  const registrationId = typeof body.registrationId === 'string' ? body.registrationId : '';

  const gate = await guardTournamentRepAccess(req, tournamentId);
  if (gate.error) return gate.error;

  if (!registrationId) return badRequest('registrationId is required.');
  // Scope: only unlink a registration that belongs to this scope-checked tournament.
  if (!(await registrationBelongsToTournament(registrationId, tournamentId!))) {
    return NextResponse.json({ error: 'That registration is not part of this tournament.' }, { status: 404 });
  }

  await unlinkRepTeamFromRegistration(registrationId);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/teams/rep-team-link' });
