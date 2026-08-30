import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepDuesCreditsForPlayer,
  getRepDuesPayoutsForPlayer,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { payoutFloorViolation, payoutFloorMessage, CREDIT_HAS_PAYOUT } from '@/lib/dues-credit-guards';
import { orgDayKey } from '@/lib/timezone';

/**
 * The entry, or the refusal that stands in for it — shared by the two verbs that reach one row.
 *
 * ⚠ THE PARENT DECIDES THE SEASON, AND THE ENTRY ROW CANNOT: `rep_fundraiser_entries` carries a
 * team but no program year, so `id + fundraiser + team` matched a finished season's entry
 * perfectly and let an archived Money hub rewrite what a family raised two years ago. The ACTIVE
 * year, always — the write side never reads `?year=`.
 *
 * Joined rather than fetched first: this is the "log an amount" path, and a separate existence
 * check would put a second sequential round trip in front of the screen's primary action for a
 * row this query already has to reach. `!inner` makes the parent's season a condition of the
 * entry matching at all, so a past season's entry comes back as "not found" in one hop.
 *
 * ⚠ A QUERY FAILURE IS NOT A MISSING ROW, and this lookup has something to fail at: a join whose
 * relationship name resolves at RUNTIME. Swallowing the error would make a genuine outage (a
 * second FK between these tables making the embed ambiguous, a renamed relationship) read as the
 * ordinary, expected "this entry belongs to a finished season" refusal — indistinguishable in the
 * logs from working correctly. PGRST116 is the no-rows case `.single()` raises, which IS the 404.
 *
 * The KIND is returned rather than judged here: editing a sponsor and removing one are refused
 * with different directions, and a shared refusal would have to pick one of them.
 */
async function loadEntry(
  entryId: string, fundraiserId: string, teamId: string, programYearId: string,
): Promise<{ error: NextResponse } | { entry: Record<string, any> }> {
  const { data: entry, error: entryError } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('*, rep_fundraisers!inner(program_year_id, kind)')
    .eq('id', entryId)
    .eq('fundraiser_id', fundraiserId)
    .eq('team_id', teamId)
    .eq('rep_fundraisers.program_year_id', programYearId)
    .single();

  if (entryError && entryError.code !== 'PGRST116') {
    console.error('[fundraiser-entry] lookup failed', { entryId, fundraiserId, error: entryError });
    return { error: NextResponse.json({ error: 'Could not load this entry. Try again.' }, { status: 500 }) };
  }
  if (!entry) return { error: NextResponse.json({ error: 'Entry not found' }, { status: 404 }) };
  return { entry };
}

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries/[entryId]
// Updates a player's fundraising amount. Also adjusts the linked
// accounting entry and dues credit to match the new amount.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string; entryId: string }> },) => {
  const { orgSlug, teamId, fundraiserId, entryId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const loaded = await loadEntry(entryId, fundraiserId, team.id, programYear.id);
  if ('error' in loaded) return loaded.error;
  const { entry } = loaded;
  /**
   * ⚠ A SPONSOR IS NOT EDITED HERE (review, 2026-08-15). This is the DRIVE's per-player edit and
   * knows nothing of `sponsor_status`: pointed at a still-PLEDGED sponsor's entry it re-derives a
   * rebate from the stamped percent and, finding no credit yet, takes the "no credit existed but
   * now one is needed" branch below — writing a real dues credit against a family for money
   * nobody has received, with no income posted anywhere. A sponsor's amount, status and family
   * share are decided together on its own record, which is the only place that keeps the three
   * consistent.
   */
  if (entry.rep_fundraisers?.kind === 'sponsor') {
    return NextResponse.json({
      error: 'Edit a sponsor on the sponsor itself — its amount, status and family share are set together.',
    }, { status: 400 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let newRaised = Number(entry.amount_raised);

  /* ⚠⚠ THE DAY THE MONEY ARRIVED IS CORRECTABLE (money centralization P2, 2026-08-23).
     Migration 261 gave the CREATE path a received date so a treasurer could log drive money
     into the period it actually landed in — and left the edit path unable to fix a wrong one,
     which is the half of a date field that matters most. Same shape and same validation as the
     create path and the dues receipt. */
  if (body.receivedDate !== undefined && body.receivedDate !== null) {
    if (typeof body.receivedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.receivedDate)) {
      return NextResponse.json({ error: 'receivedDate must be a YYYY-MM-DD date' }, { status: 400 });
    }
    updates.received_date = body.receivedDate;
  }
  /**
   * ⚠⚠ RE-DATING HAPPENS ONLY WHEN A DATE WAS ACTUALLY SENT — and that is a defect fix, not a
   * nicety (/review, 2026-08-23, Critical). The first cut resolved a date for EVERY edit
   * (`sent ?? stored ?? today`) and stamped it onto the ledger row and the family's credit. On a
   * pre-mig-261 row `stored` is NULL, so an edit of the AMOUNT — or of the note — resolved to
   * TODAY and silently moved last spring's fundraiser income, and the credit it earned, into this
   * month. The client made it trivially reachable by pre-filling the date box with today.
   *
   * So: no date sent, nothing re-dated. The entry keeps whatever it had (including nothing, which
   * the register reads as the creation day), exactly as it behaved before P2.
   */
  const sentDay = updates.received_date as string | undefined;
  /** The day this entry is CONSIDERED to have arrived — for stamping a credit that did not exist
   *  before. Falls back the way every reader does: stored date, else the org-clock creation day. */
  const arrivalDay = sentDay
    ?? (entry.received_date as string | null)
    ?? orgDayKey(entry.created_at as string);

  /* ⚠ A DATE-ONLY EDIT MUST REACH THE LEDGER AND THE CREDIT TOO (/review, 2026-08-23, High). These
     stamps used to live inside the `amountRaised` block, so correcting ONLY the date moved the
     entry and left the books and the family's credit on the old one — the split-brain this route's
     own comment promises does not happen. They live out here now, keyed on the date being sent. */
  if (sentDay) {
    if (entry.accounting_entry_id) {
      const { error: entryDateError } = await supabaseAdmin
        .from('accounting_entries')
        .update({ entry_date: sentDay, updated_at: new Date().toISOString() })
        .eq('id', entry.accounting_entry_id);
      /* ⚠ CHECKED, because the money must not diverge in silence. `lib/db.ts`'s `updateEntry`
         exists for exactly this: an amount correction that moved the record and left the ledger
         behind, with a green save and nothing logged. */
      if (entryDateError) {
        console.error('[fundraiser-entry] ledger re-date failed', { entryId, error: entryDateError });
        return NextResponse.json({ error: 'Could not move the books entry to that date. Try again.' }, { status: 500 });
      }
    }
    if (entry.credit_id) {
      const { error: creditDateError } = await supabaseAdmin
        .from('rep_dues_credits')
        .update({ credit_date: sentDay })
        .eq('id', entry.credit_id);
      if (creditDateError) {
        console.error('[fundraiser-entry] credit re-date failed', { entryId, error: creditDateError });
        return NextResponse.json({ error: 'Could not move the family credit to that date. Try again.' }, { status: 500 });
      }
    }
  }

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
      const { error: amountError } = await supabaseAdmin
        .from('accounting_entries')
        .update({ amount: newRaised, updated_at: new Date().toISOString() })
        .eq('id', entry.accounting_entry_id);
      /* Checked for the same reason the re-date above is — a silent failure here is the record and
         the books disagreeing about a figure, permanently, behind a green save. */
      if (amountError) {
        console.error('[fundraiser-entry] ledger amount update failed', { entryId, error: amountError });
        return NextResponse.json({ error: 'Could not update the books entry. Try again.' }, { status: 500 });
      }
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
      /* No credit existed but now one is needed (rebate was 0 before, amount changed).
         ⚠ DATED THE DAY THE MONEY ARRIVED, NOT TODAY (found at the P2 gate, 2026-08-23). A
         back-dated entry that later grew a credit stamped it with the edit date, so the family
         credit landed in a different month from the income that created it — a mig-261 loose
         end, invisible until a coach reconciled two months. */
      const { data: newCredit } = await supabaseAdmin
        .from('rep_dues_credits')
        .insert({
          program_year_id:    programYear.id,
          player_id:          entry.player_id,
          amount:             rebateAmount,
          description:        `Fundraiser rebate — updated`,
          credit_type:        'fundraiser',
          credit_date:        arrivalDay,
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
      receivedDate:      updated.received_date ?? null,
      updatedAt:         updated.updated_at,
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries/[entryId]' });

/**
 * DELETE — remove one player's entry from a drive (R5-A, owner-ruled 2026-08-30).
 *
 * ⚠⚠ THIS IS THE ONLY DOOR THAT UNWINDS A DRIVE ENTRY, and that is why it has to exist. The
 * credit a drive entry creates carries its provenance (`fundraiser_entry_id`), and the dues
 * drawer refuses to edit or delete a credit that has one — it says "unwind it where it came
 * from" and points here. Without this verb that sentence pointed at nothing: a mis-logged
 * amount could be corrected but never removed, and the guarded whole-drive delete below would
 * have refused with directions a coach could not follow.
 *
 * Three rows go together, in the order `undoSponsorArrival` established: the family's credit,
 * the dated income row, then the entry itself. Credits FIRST because the FK from
 * `rep_dues_credits.fundraiser_entry_id` is ON DELETE SET NULL, not CASCADE — dropping the entry
 * first would leave the family holding a credit with no source, which the dues drawer would then
 * happily let someone edit. The same is true of the income row (`accounting_entry_id` is SET NULL
 * too): money on the books that no record explains is the mig-030 hazard, and it is worse than a
 * failed save.
 *
 * ⚠ THE PAYOUT FLOOR IS ASKED PRE-FLIGHT (lib/dues-credit-guards.ts), before a single row is
 * touched. A guard that fires after an irreversible write strands the record forever.
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string; entryId: string }> },) => {
  const { orgSlug, teamId, fundraiserId, entryId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const loaded = await loadEntry(entryId, fundraiserId, team.id, programYear.id);
  if ('error' in loaded) return loaded.error;
  const { entry } = loaded;

  /* ⚠ A SPONSOR'S CHEQUE IS NOT REMOVED HERE, for the same reason it is not edited here: an
     arrival's credits are accrued across the whole agreement, so taking one out is a replay of
     the plan, not a row delete. Its own door does that and says so. */
  if (entry.rep_fundraisers?.kind === 'sponsor') {
    return NextResponse.json({
      error: 'Undo a sponsor’s cheque from the sponsor’s own row — its credits are figured across the whole agreement.',
    }, { status: 400 });
  }

  /* Every credit this entry owns. Both links are read: the modern one is the provenance stamp,
     and `credit_id` is the original single-credit pointer that rows predating it still carry. */
  const { data: ownCreditRows, error: ownErr } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('id')
    .eq('fundraiser_entry_id', entryId);
  if (ownErr) {
    console.error('[fundraiser-entry] credit lookup failed', { entryId, error: ownErr });
    return NextResponse.json({ error: 'Could not check this entry’s family credit. Try again.' }, { status: 500 });
  }
  const ownCreditIds = new Set<string>((ownCreditRows ?? []).map(c => c.id as string));
  if (entry.credit_id) ownCreditIds.add(entry.credit_id as string);

  /* The floor, per the ONE family this entry credits. What is left after the removal must still
     cover every dollar already handed back to them in cash. */
  if (entry.player_id && ownCreditIds.size) {
    const [credits, payouts] = await Promise.all([
      getRepDuesCreditsForPlayer(programYear.id, entry.player_id as string),
      getRepDuesPayoutsForPlayer(programYear.id, entry.player_id as string),
    ]);
    const projected = credits
      .filter(c => !ownCreditIds.has(c.id))
      .map(c => ({ amount: Number(c.amount), creditType: c.creditType as string }));
    const violation = payoutFloorViolation(projected, payouts);
    if (violation) {
      return NextResponse.json(
        { error: payoutFloorMessage(violation.paidOut, 'removing this entry'), code: CREDIT_HAS_PAYOUT },
        { status: 409 },
      );
    }
  }

  if (ownCreditIds.size) {
    const { error: creditErr } = await supabaseAdmin
      .from('rep_dues_credits')
      .delete()
      .in('id', [...ownCreditIds]);
    if (creditErr) {
      console.error('[fundraiser-entry] credit delete failed — nothing removed', { entryId, error: creditErr });
      return NextResponse.json({ error: 'The family credit could not be taken back, so nothing was removed.' }, { status: 500 });
    }
  }

  if (entry.accounting_entry_id) {
    const { error: ledgerErr } = await supabaseAdmin
      .from('accounting_entries')
      .delete()
      .eq('id', entry.accounting_entry_id);
    /* ⚠ CHECKED AND REPORTED, not swallowed. The credit is already gone by here; leaving the
       income row standing would overstate what the drive raised, and a coach told "removed" would
       have no way to find it. Named plainly so the state is explicable rather than mysterious. */
    if (ledgerErr) {
      console.error('[fundraiser-entry] ledger delete failed after credit removal', { entryId, error: ledgerErr });
      return NextResponse.json({
        error: 'The family credit was taken back, but the income row could not be removed. Open the team ledger and remove it there.',
      }, { status: 500 });
    }
  }

  /* Re-asserting team AND fundraiser in the WHERE, not just the id the URL carried — the
     check-then-act rule this hub keeps everywhere it deletes. */
  const { error: rowErr } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .delete()
    .eq('id', entryId)
    .eq('fundraiser_id', fundraiserId)
    .eq('team_id', team.id);
  if (rowErr) {
    console.error('[fundraiser-entry] entry delete failed', { entryId, error: rowErr });
    return NextResponse.json({ error: 'That entry could not be removed. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries/[entryId]' });
