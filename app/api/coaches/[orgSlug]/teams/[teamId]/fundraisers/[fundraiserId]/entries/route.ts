import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getOrCreateRepTeamLedger,
  createEntry,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

async function getFundraiser(fundraiserId: string, teamId: string) {
  const { data } = await supabaseAdmin
    .from('rep_fundraisers')
    .select('*')
    .eq('id', fundraiserId)
    .eq('team_id', teamId)
    .single();
  return data;
}

function mapEntry(e: Record<string, unknown>) {
  return {
    id:                 e.id,
    fundraiserId:       e.fundraiser_id,
    playerId:           e.player_id,
    amountRaised:       Number(e.amount_raised),
    rebatePercent:      Number(e.rebate_percent),
    rebateAmount:       Number(e.rebate_amount),
    accountingEntryId:  e.accounting_entry_id ?? null,
    creditId:           e.credit_id ?? null,
    notes:              e.notes ?? null,
    createdAt:          e.created_at,
    updatedAt:          e.updated_at,
  };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries
// Returns per-player entries joined with player names, plus a summary.
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> },) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const fundraiser = await getFundraiser(fundraiserId, teamId);
  if (!fundraiser) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });

  const [{ data: entries }, { data: roster }] = await Promise.all([
    supabaseAdmin
      .from('rep_fundraiser_entries')
      .select('*')
      .eq('fundraiser_id', fundraiserId)
      .order('amount_raised', { ascending: false }),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .eq('program_year_id', programYear.id)
      .eq('status', 'active'),
  ]);

  // Build a map of player dues balance (outstanding - credits) for each player
  const rosterIds = (roster ?? []).map(p => p.id);
  const { data: allCredits } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('player_id, amount')
    .eq('program_year_id', programYear.id)
    .in('player_id', rosterIds);

  const { data: allSchedules } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('player_id, total_amount')
    .eq('program_year_id', programYear.id)
    .in('player_id', rosterIds);

  const { data: allInstallments } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .select('player_id, amount, paid_at')
    .in('player_id', rosterIds);

  const scheduleMap = new Map<string, number>();
  for (const s of allSchedules ?? []) scheduleMap.set(s.player_id, Number(s.total_amount));

  const paidMap = new Map<string, number>();
  for (const i of allInstallments ?? []) {
    if (i.paid_at) paidMap.set(i.player_id, (paidMap.get(i.player_id) ?? 0) + Number(i.amount));
  }

  const creditMap = new Map<string, number>();
  for (const c of allCredits ?? []) {
    creditMap.set(c.player_id, (creditMap.get(c.player_id) ?? 0) + Number(c.amount));
  }

  const entryMap = new Map<string, Record<string, unknown>>();
  for (const e of entries ?? []) entryMap.set(e.player_id as string, e as Record<string, unknown>);

  const playerRows = (roster ?? []).map(p => {
    const totalDues  = scheduleMap.get(p.id) ?? 0;
    const paid       = paidMap.get(p.id)     ?? 0;
    const credits    = creditMap.get(p.id)   ?? 0;
    const outstanding = Math.max(0, totalDues - paid - credits);
    const entry = entryMap.get(p.id);

    return {
      playerId:       p.id,
      playerName:     [p.player_first_name, p.player_last_name].filter(Boolean).join(' '),
      remainingDues:  Math.round(outstanding * 100) / 100,
      entry:          entry ? mapEntry(entry) : null,
    };
  });

  // Sort: players with entries first (desc by amount_raised), then remaining roster
  playerRows.sort((a, b) => {
    if (a.entry && !b.entry) return -1;
    if (!a.entry && b.entry) return  1;
    if (a.entry && b.entry) return (b.entry.amountRaised as number) - (a.entry.amountRaised as number);
    return a.playerName.localeCompare(b.playerName);
  });

  const allEntries = entries ?? [];
  const totalRaised  = allEntries.reduce((s, e) => s + Number(e.amount_raised), 0);
  const totalRebates = allEntries.reduce((s, e) => s + Number(e.rebate_amount), 0);

  return NextResponse.json({
    fundraiser: {
      id:                  fundraiser.id,
      name:                fundraiser.name,
      description:         fundraiser.description ?? null,
      playerRebatePercent: Number(fundraiser.player_rebate_percent),
      startDate:           fundraiser.start_date ?? null,
      endDate:             fundraiser.end_date   ?? null,
      isActive:            fundraiser.is_active,
    },
    summary: {
      totalRaised:  Math.round(totalRaised  * 100) / 100,
      teamNet:      Math.round((totalRaised - totalRebates) * 100) / 100,
      totalCredits: Math.round(totalRebates * 100) / 100,
      playerCount:  allEntries.length,
    },
    players: playerRows,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries' });

// POST /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries
// Logs or updates a player's fundraising amount for this fundraiser.
// Creates: accounting_entries income record + rep_fundraiser_entries row +
// rep_dues_credits row (when rebate > 0). All three are linked by FK.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> },) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const fundraiser = await getFundraiser(fundraiserId, teamId);
  if (!fundraiser) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });
  if (!fundraiser.is_active) return NextResponse.json({ error: 'Fundraiser is closed' }, { status: 400 });

  const body = await req.json();
  const { playerId, amountRaised, notes = null } = body;

  if (!playerId) return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  const raised = Number(amountRaised);
  if (isNaN(raised) || raised < 0) {
    return NextResponse.json({ error: 'amountRaised must be a non-negative number' }, { status: 400 });
  }

  const { data: player } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name')
    .eq('id', playerId)
    .eq('program_year_id', programYear.id)
    .single();

  if (!player) return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });

  const { data: existingEntry } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('id')
    .eq('fundraiser_id', fundraiserId)
    .eq('player_id', playerId)
    .maybeSingle();

  if (existingEntry) {
    return NextResponse.json(
      { error: 'An entry already exists for this player. Use PATCH to update it.' },
      { status: 409 },
    );
  }

  const rebatePct    = Number(fundraiser.player_rebate_percent);
  const rebateAmount = Math.round(raised * rebatePct / 100 * 100) / 100;
  const today        = new Date().toISOString().slice(0, 10);
  const playerName   = [player.player_first_name, player.player_last_name].filter(Boolean).join(' ');

  // 1 — Create team ledger income entry
  const ledger = await getOrCreateRepTeamLedger(team.orgId, team.id, team.name);
  const accountingEntry = await createEntry(
    ledger.id,
    {
      entryDate:   today,
      description: `Fundraiser income — ${fundraiser.name} (${playerName})`,
      amount:      raised,
      entryType:   'income',
      status:      'posted',
      category:    'fundraising',
    },
    ctx!.user.id,
  );

  // 2 — Create fundraiser entry row
  const { data: feRow, error: feErr } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .insert({
      fundraiser_id:      fundraiserId,
      org_id:             team.orgId,
      team_id:            team.id,
      player_id:          playerId,
      amount_raised:      raised,
      rebate_percent:     rebatePct,
      rebate_amount:      rebateAmount,
      accounting_entry_id: accountingEntry.id,
      notes:              notes?.trim() || null,
    })
    .select()
    .single();

  if (feErr) return NextResponse.json({ error: feErr.message }, { status: 500 });

  let credit = null;

  // 3 — Create dues credit if rebate > 0
  if (rebateAmount > 0) {
    const { data: creditRow, error: cErr } = await supabaseAdmin
      .from('rep_dues_credits')
      .insert({
        program_year_id:    programYear.id,
        player_id:          playerId,
        amount:             rebateAmount,
        description:        `Fundraiser rebate — ${fundraiser.name}`,
        credit_type:        'fundraiser',
        credit_date:        today,
        notes:              null,
        created_by:         ctx!.user.id,
        fundraiser_entry_id: feRow.id,
      })
      .select()
      .single();

    if (!cErr && creditRow) {
      // 4 — Link the credit back to the entry
      await supabaseAdmin
        .from('rep_fundraiser_entries')
        .update({ credit_id: creditRow.id, updated_at: new Date().toISOString() })
        .eq('id', feRow.id);

      credit = {
        id:          creditRow.id,
        amount:      Number(creditRow.amount),
        description: creditRow.description,
        creditDate:  creditRow.credit_date,
      };
    }
  }

  return NextResponse.json({
    entry: mapEntry({ ...feRow, credit_id: credit?.id ?? null } as Record<string, unknown>),
    credit,
    accountingEntryId: accountingEntry.id,
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries' });
