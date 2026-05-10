import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getLeagueSeasonById,
  getTeamsForDivision,
  getRegistrationsForDivision,
  assignRegistrationToTeam,
  bulkAssignTeams,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json();
  const { action, divisionId } = body;

  if (!divisionId) return NextResponse.json({ error: 'divisionId required' }, { status: 400 });

  const VALID_ACTIONS = ['randomize', 'assign', 'bulk_assign', 'clear'];
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (action === 'randomize') {
    const teams = await getTeamsForDivision(divisionId);
    if (!teams.length) {
      return NextResponse.json({ error: 'No teams in this division' }, { status: 422 });
    }
    const allActive = await getRegistrationsForDivision(divisionId, { status: 'active' });
    const unassigned = shuffle(allActive.filter(r => !r.teamId));
    if (!unassigned.length) return NextResponse.json({ assigned: 0 });

    const assignments = unassigned.map((r, i) => ({
      registrationId: r.id,
      teamId: teams[i % teams.length].id,
    }));
    await bulkAssignTeams(assignments);
    return NextResponse.json({ assigned: assignments.length });
  }

  if (action === 'assign') {
    const { registrationId, teamId } = body;
    if (!registrationId) {
      return NextResponse.json({ error: 'registrationId required' }, { status: 400 });
    }
    if (teamId) {
      await assignRegistrationToTeam(registrationId, teamId);
    } else {
      // teamId null = unassign (return player to pool)
      await supabaseAdmin
        .from('league_registrations')
        .update({ team_id: null, updated_at: new Date().toISOString() })
        .eq('id', registrationId);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'bulk_assign') {
    const { assignments } = body;
    if (!Array.isArray(assignments)) {
      return NextResponse.json({ error: 'assignments array required' }, { status: 400 });
    }
    await bulkAssignTeams(assignments);
    return NextResponse.json({ assigned: assignments.length });
  }

  if (action === 'clear') {
    await supabaseAdmin
      .from('league_registrations')
      .update({ team_id: null, updated_at: new Date().toISOString() })
      .eq('division_id', divisionId)
      .eq('status', 'active');

    // Clear draft state if it belongs to this division
    const { data: seasonRow } = await supabaseAdmin
      .from('league_seasons')
      .select('draft_state')
      .eq('id', seasonId)
      .single();
    const draft = seasonRow?.draft_state as { divisionId?: string } | null;
    if (draft?.divisionId === divisionId) {
      await supabaseAdmin
        .from('league_seasons')
        .update({ draft_state: null })
        .eq('id', seasonId);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unhandled action' }, { status: 500 });
}
