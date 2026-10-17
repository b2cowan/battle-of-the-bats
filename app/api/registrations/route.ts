import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { canOpenModule } from '@/lib/member-access';
import { captureError, withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * The Teams screen's registration list (app/[orgSlug]/admin/tournaments/registrations, its one caller): every team of
 * the requested tournament — or of every tournament the caller may see — with its contact emails, payment and admin
 * notes.
 *
 * Until 2026-10-16 it answered any non-suspended member of the club, a pending invitee, a scorekeeper or a
 * coach-role member included, for every tournament of the club (the second sweep's fourth finding). Now it answers the
 * Teams screen's own audience — an ACCEPTED member who can open the tournaments area (`canOpenModule`, as the
 * tournament dashboard asks) — within their assigned tournaments, and its name lookups read only this club's rows.
 */
export const GET = withObservability(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const requestedTournamentId = searchParams.get('tournamentId');
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();
  if (requestedTournamentId) {
    const denied = scopeGuard(ctx, requestedTournamentId);
    if (denied) return denied;
  }

  try {
    // This club's tournaments — the one asked for, or every one the caller is assigned (all, when unrestricted).
    let tournamentQuery = supabaseAdmin
      .from('tournaments')
      .select('id, name')
      .eq('org_id', ctx.org.id);

    if (requestedTournamentId) {
      tournamentQuery = tournamentQuery.eq('id', requestedTournamentId);
    } else if (ctx.assignedTournamentIds !== null) {
      tournamentQuery = tournamentQuery.in('id', ctx.assignedTournamentIds);
    }

    const { data: orgTournaments } = await tournamentQuery;
    const tournamentIds = (orgTournaments ?? []).map((t: { id: string }) => t.id);

    if (tournamentIds.length === 0) {
      return NextResponse.json([]);
    }

    const [teamsRes, groupsRes] = await Promise.all([
      supabaseAdmin
        .from('teams')
        .select('*')
        .in('tournament_id', tournamentIds)
        .order('registered_at', { ascending: false }),
      supabaseAdmin.from('divisions').select('id, name').in('tournament_id', tournamentIds),
    ]);

    if (teamsRes.error) throw teamsRes.error;

    const groupsMap = new Map((groupsRes.data || []).map((g: { id: string; name: string }) => [g.id, g.name]));
    const tournsMap = new Map((orgTournaments || []).map((t: { id: string; name: string }) => [t.id, t.name]));

    const flattened = teamsRes.data?.map((r: any) => ({
      ...r,
      division_name: groupsMap.get(r.division_id) || 'Unknown Division',
      tournament_name: r.tournament_id ? tournsMap.get(r.tournament_id) : 'Internal',
    }));

    return NextResponse.json(flattened);
  } catch (err: any) {
    console.error('Registrations Route Error:', err);
    void captureError(err, { route: '/api/registrations', method: 'GET', statusCode: 500 });
    return NextResponse.json({ error: 'Server error', message: err?.message }, { status: 500 });
  }
}, { route: '/api/registrations' });
