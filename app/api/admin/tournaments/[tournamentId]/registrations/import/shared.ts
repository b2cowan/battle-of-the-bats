import { NextResponse } from 'next/server';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type {
  TournamentTeamImportContext,
  TournamentTeamImportDivision,
  TournamentTeamImportExistingTeam,
} from '@/lib/import/tournament-teams';

export type RouteParams = { params: Promise<{ tournamentId: string }> };

type TournamentRow = {
  id: string;
  name: string;
  year: number | null;
  org_id: string | null;
  status: string | null;
};

type DivisionRow = {
  id: string;
  name: string;
};

type TeamRow = {
  id: string;
  division_id: string | null;
  name: string;
  coach: string | null;
  email: string | null;
  status: string | null;
  payment_status: string | null;
  deposit_paid: number | null;
  total_paid: number | null;
  waitlist_position: number | null;
  admin_notes: string | null;
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tournament';
}

export async function authorizeTournamentTeamImport(
  req: Request,
  tournamentId: string,
  options: { blockLocked: boolean },
) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { response: unauthorized() };
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return { response: forbidden() };
  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_registrations') && !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) {
    return { response: forbidden() };
  }
  if (!hasPlanFeature(ctx.org.planId, 'bulk_data_imports')) {
    return { response: json({ error: requiresPlanCopy('bulk_data_imports') }, 403) };
  }

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return { response: denied };

  const { data: tournament, error } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, year, org_id, status')
    .eq('id', tournamentId)
    .maybeSingle<TournamentRow>();

  if (error) return { response: json({ error: error.message }, 500) };
  if (!tournament || tournament.org_id !== ctx.org.id) return { response: forbidden() };
  if (options.blockLocked && tournament.status === 'completed') {
    return {
      response: json({
        error: 'This tournament is completed and locked. Set the status to Active in Event Settings to preview imports.',
      }, 409),
    };
  }

  return { ctx, tournament };
}

export async function loadTournamentTeamImportContext(input: {
  tournamentId: string;
  orgId: string;
}): Promise<TournamentTeamImportContext> {
  const [{ data: divisionRows, error: divisionError }, { data: teamRows, error: teamError }] = await Promise.all([
    supabaseAdmin
      .from('divisions')
      .select('id, name')
      .eq('tournament_id', input.tournamentId)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('teams')
      .select('id, division_id, name, coach, email, status, payment_status, deposit_paid, total_paid, waitlist_position, admin_notes')
      .eq('tournament_id', input.tournamentId)
      .order('name', { ascending: true }),
  ]);

  if (divisionError) throw new Error(divisionError.message);
  if (teamError) throw new Error(teamError.message);

  const divisions: TournamentTeamImportDivision[] = (divisionRows ?? []).map((division: DivisionRow) => ({
    id: division.id,
    name: division.name,
  }));

  const existingTeams: TournamentTeamImportExistingTeam[] = (teamRows ?? []).map((team: TeamRow) => ({
    id: team.id,
    divisionId: team.division_id ?? '',
    name: team.name,
    coach: team.coach,
    email: team.email,
    status: team.status,
    paymentStatus: team.payment_status,
    depositPaid: team.deposit_paid,
    totalPaid: team.total_paid,
    waitlistPosition: team.waitlist_position,
    adminNotes: team.admin_notes,
  }));

  return {
    tournamentId: input.tournamentId,
    orgId: input.orgId,
    divisions,
    existingTeams,
  };
}

