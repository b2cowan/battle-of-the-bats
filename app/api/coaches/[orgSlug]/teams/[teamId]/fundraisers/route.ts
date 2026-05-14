import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.find(a => a.teamId === teamId)) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, programYear };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/fundraisers
// Returns all fundraisers with per-fundraiser totals.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },
) {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { programYear } = resolved;

  const { data: fundraisers, error: fErr } = await supabaseAdmin
    .from('rep_fundraisers')
    .select('*')
    .eq('program_year_id', programYear.id)
    .order('created_at', { ascending: false });

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });

  if (!fundraisers?.length) return NextResponse.json({ fundraisers: [] });

  const fundraiserIds = fundraisers.map(f => f.id);
  const { data: entries } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('fundraiser_id, amount_raised, rebate_amount')
    .in('fundraiser_id', fundraiserIds);

  const totalsMap = new Map<string, { totalRaised: number; totalRebates: number; playerCount: number }>();
  for (const e of entries ?? []) {
    const existing = totalsMap.get(e.fundraiser_id) ?? { totalRaised: 0, totalRebates: 0, playerCount: 0 };
    totalsMap.set(e.fundraiser_id, {
      totalRaised:  existing.totalRaised  + Number(e.amount_raised),
      totalRebates: existing.totalRebates + Number(e.rebate_amount),
      playerCount:  existing.playerCount  + 1,
    });
  }

  const result = fundraisers.map(f => {
    const t = totalsMap.get(f.id) ?? { totalRaised: 0, totalRebates: 0, playerCount: 0 };
    return {
      id:                  f.id,
      name:                f.name,
      description:         f.description ?? null,
      playerRebatePercent: Number(f.player_rebate_percent),
      startDate:           f.start_date ?? null,
      endDate:             f.end_date   ?? null,
      isActive:            f.is_active,
      createdAt:           f.created_at,
      totalRaised:         Math.round(t.totalRaised  * 100) / 100,
      teamNet:             Math.round((t.totalRaised - t.totalRebates) * 100) / 100,
      totalCredits:        Math.round(t.totalRebates * 100) / 100,
      playerCount:         t.playerCount,
    };
  });

  return NextResponse.json({ fundraisers: result });
}

// POST /api/coaches/[orgSlug]/teams/[teamId]/fundraisers
// Creates a new fundraiser.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },
) {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { team, programYear } = resolved;

  const body = await req.json();
  const {
    name,
    description = null,
    playerRebatePercent = 0,
    startDate = null,
    endDate   = null,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const rebatePct = Number(playerRebatePercent);
  if (isNaN(rebatePct) || rebatePct < 0 || rebatePct > 100) {
    return NextResponse.json({ error: 'playerRebatePercent must be between 0 and 100' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rep_fundraisers')
    .insert({
      org_id:               team.orgId,
      team_id:              team.id,
      program_year_id:      programYear.id,
      name:                 name.trim(),
      description:          description?.trim() || null,
      player_rebate_percent: rebatePct,
      start_date:           startDate || null,
      end_date:             endDate   || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    fundraiser: {
      id:                  data.id,
      name:                data.name,
      description:         data.description ?? null,
      playerRebatePercent: Number(data.player_rebate_percent),
      startDate:           data.start_date ?? null,
      endDate:             data.end_date   ?? null,
      isActive:            data.is_active,
      createdAt:           data.created_at,
      totalRaised:         0,
      teamNet:             0,
      totalCredits:        0,
      playerCount:         0,
    },
  }, { status: 201 });
}
