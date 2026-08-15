import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';

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

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries/[entryId]
// Updates a player's fundraising amount. Also adjusts the linked
// accounting entry and dues credit to match the new amount.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string; entryId: string }> },) => {
  const { orgSlug, teamId, fundraiserId, entryId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // ⚠ THE PARENT DECIDES THE SEASON, AND THE ENTRY ROW CANNOT: `rep_fundraiser_entries` carries a
  // team but no program year, so `id + fundraiser + team` matched a finished season's entry
  // perfectly and let an archived Money hub rewrite what a family raised two years ago. The ACTIVE
  // year, always — the write side never reads `?year=`.
  //
  // Joined rather than fetched first: this is the "log an amount" path, and a separate existence
  // check would put a second sequential round trip in front of the screen's primary action for a
  // row this query already has to reach. `!inner` makes the parent's season a condition of the
  // entry matching at all, so a past season's entry comes back as "not found" in one hop.
  const { data: entry, error: entryError } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('*, rep_fundraisers!inner(program_year_id, kind)')
    .eq('id', entryId)
    .eq('fundraiser_id', fundraiserId)
    .eq('team_id', team.id)
    .eq('rep_fundraisers.program_year_id', programYear.id)
    .single();

  // ⚠ A QUERY FAILURE IS NOT A MISSING ROW, and this lookup now has something to fail at: a join
  // whose relationship name resolves at RUNTIME. Swallowing the error would make a genuine outage
  // (a second FK between these tables making the embed ambiguous, a renamed relationship) read as
  // the ordinary, expected "this entry belongs to a finished season" refusal — indistinguishable
  // in the logs from working correctly. PGRST116 is the no-rows case `.single()` raises, which IS
  // the 404 below.
  if (entryError && entryError.code !== 'PGRST116') {
    console.error('[fundraiser-entry] lookup failed', { entryId, fundraiserId, error: entryError });
    return NextResponse.json({ error: 'Could not load this entry. Try again.' }, { status: 500 });
  }
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  /**
   * ⚠ A SPONSOR IS NOT EDITED HERE (review, 2026-08-15). This is the DRIVE's per-player edit and
   * knows nothing of `sponsor_status`: pointed at a still-PLEDGED sponsor's entry it re-derives a
   * rebate from the stamped percent and, finding no credit yet, takes the "no credit existed but
   * now one is needed" branch below — writing a real dues credit against a family for money
   * nobody has received, with no income posted anywhere. A sponsor's amount, status and family
   * share are decided together on its own record, which is the only place that keeps the three
   * consistent.
   */
  if ((entry as any).rep_fundraisers?.kind === 'sponsor') {
    return NextResponse.json({
      error: 'Edit a sponsor on the sponsor itself — its amount, status and family share are set together.',
    }, { status: 400 });
  }

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
      const today = tournamentToday();
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
