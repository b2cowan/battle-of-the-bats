import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

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

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries/[entryId]
// Updates a player's fundraising amount. Also adjusts the linked
// accounting entry and dues credit to match the new amount.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string; entryId: string }> },) => {
  const { orgSlug, teamId, fundraiserId, entryId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, programYear } = resolved;

  const { data: entry } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('*')
    .eq('id', entryId)
    .eq('fundraiser_id', fundraiserId)
    .eq('team_id', team.id)
    .single();

  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let newRaised = Number(entry.amount_raised);

  if (body.amountRaised !== undefined) {
    const raised = Number(body.amountRaised);
    if (isNaN(raised) || raised < 0) {
      return NextResponse.json({ error: 'amountRaised must be a non-negative number' }, { status: 400 });
    }
    newRaised = raised;
    const rebatePct    = Number(entry.rebate_percent);
    const rebateAmount = Math.round(newRaised * rebatePct / 100 * 100) / 100;

    updates.amount_raised  = newRaised;
    updates.rebate_amount  = rebateAmount;

    // Update the linked accounting entry (bypass ledger resolution — admin client has full access)
    if (entry.accounting_entry_id) {
      await supabaseAdmin
        .from('accounting_entries')
        .update({ amount: newRaised, updated_at: new Date().toISOString() })
        .eq('id', entry.accounting_entry_id);
    }

    // Update the linked dues credit
    if (entry.credit_id && rebateAmount > 0) {
      await supabaseAdmin
        .from('rep_dues_credits')
        .update({ amount: rebateAmount })
        .eq('id', entry.credit_id);
    } else if (entry.credit_id && rebateAmount === 0) {
      // Credit reduced to zero — delete it
      await supabaseAdmin.from('rep_dues_credits').delete().eq('id', entry.credit_id);
      updates.credit_id = null;
    } else if (!entry.credit_id && rebateAmount > 0) {
      // No credit existed but now one is needed (rebate was 0 before, amount changed)
      const today = new Date().toISOString().slice(0, 10);
      const { data: newCredit } = await supabaseAdmin
        .from('rep_dues_credits')
        .insert({
          program_year_id:    programYear.id,
          player_id:          entry.player_id,
          amount:             rebateAmount,
          description:        `Fundraiser rebate — updated`,
          credit_type:        'fundraiser',
          credit_date:        today,
          created_by:         ctx!.user.id,
          fundraiser_entry_id: entryId,
        })
        .select()
        .single();
      if (newCredit) updates.credit_id = newCredit.id;
    }
  }

  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;

  const { data: updated, error } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    entry: {
      id:                updated.id,
      fundraiserId:      updated.fundraiser_id,
      playerId:          updated.player_id,
      amountRaised:      Number(updated.amount_raised),
      rebatePercent:     Number(updated.rebate_percent),
      rebateAmount:      Number(updated.rebate_amount),
      accountingEntryId: updated.accounting_entry_id ?? null,
      creditId:          updated.credit_id ?? null,
      notes:             updated.notes ?? null,
      updatedAt:         updated.updated_at,
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries/[entryId]' });
