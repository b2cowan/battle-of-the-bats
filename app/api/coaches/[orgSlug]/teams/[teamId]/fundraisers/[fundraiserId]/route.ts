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

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]
// Updates fundraiser header fields (name, description, rebate %, dates, isActive).
// Changing player_rebate_percent only affects future entries — existing entries
// snapshot their percent at creation time.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> },
) {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { team } = resolved;

  const { data: existing } = await supabaseAdmin
    .from('rep_fundraisers')
    .select('id')
    .eq('id', fundraiserId)
    .eq('team_id', team.id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    if (!body.name?.trim()) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.playerRebatePercent !== undefined) {
    const pct = Number(body.playerRebatePercent);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'playerRebatePercent must be between 0 and 100' }, { status: 400 });
    }
    updates.player_rebate_percent = pct;
  }
  if (body.startDate !== undefined) updates.start_date = body.startDate || null;
  if (body.endDate   !== undefined) updates.end_date   = body.endDate   || null;
  if (body.isActive  !== undefined) updates.is_active  = Boolean(body.isActive);

  const { data, error } = await supabaseAdmin
    .from('rep_fundraisers')
    .update(updates)
    .eq('id', fundraiserId)
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
      updatedAt:           data.updated_at,
    },
  });
}
