import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { RepInstallmentPreviewRow } from '@/lib/types';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
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
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, programYear };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/installment-preview
// ?installmentCount=3&dates[]=2026-05-15&dates[]=2026-06-15&dates[]=2026-09-15
//
// Returns a per-player preview of the installment amounts that would be
// generated. Does not write anything to the database.
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

  const url   = new URL(req.url);
  const count = parseInt(url.searchParams.get('installmentCount') ?? '1', 10);
  const dates = url.searchParams.getAll('dates[]');

  if (isNaN(count) || count < 1 || count > 12) {
    return NextResponse.json({ error: 'installmentCount must be between 1 and 12' }, { status: 400 });
  }
  if (dates.length > 0 && dates.length !== count) {
    return NextResponse.json({ error: 'Number of dates must match installmentCount' }, { status: 400 });
  }

  // Total budget for this program year
  const { data: linesData } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('total_amount')
    .eq('program_year_id', programYear.id);

  const totalBudget = (linesData ?? []).reduce(
    (s: number, l: { total_amount: number }) => s + (l.total_amount ?? 0),
    0,
  );

  if (totalBudget <= 0) {
    return NextResponse.json({ error: 'Budget has no lines. Add at least one line before generating installments.' }, { status: 400 });
  }

  // Active roster players
  const { data: players } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name')
    .eq('program_year_id', programYear.id)
    .eq('status', 'active')
    .order('player_last_name');

  if (!players || players.length === 0) {
    return NextResponse.json({ error: 'No active roster players found for this program year.' }, { status: 400 });
  }

  const perPlayer   = totalBudget / players.length;
  const perInstallment = perPlayer / count;
  // Round each installment to 2dp; last installment absorbs rounding remainder
  const installmentAmounts = Array.from({ length: count }, (_, i) => {
    const base    = Math.round(perInstallment * 100) / 100;
    const already = base * i;
    return i === count - 1 ? Math.round((perPlayer - already) * 100) / 100 : base;
  });

  const preview: RepInstallmentPreviewRow[] = players.map(p => ({
    playerId:        p.id,
    playerFirstName: p.player_first_name,
    playerLastName:  p.player_last_name,
    installments:    installmentAmounts.map((amount, i) => ({
      installmentNumber: i + 1,
      dueDate:           dates[i] ?? '',
      amount,
    })),
  }));

  return NextResponse.json({
    preview,
    totalBudget,
    rosterCount:  players.length,
    perPlayer:    Math.round(perPlayer * 100) / 100,
    installmentCount: count,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/installment-preview' });
