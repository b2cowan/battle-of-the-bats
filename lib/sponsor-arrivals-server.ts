/**
 * Sponsor arrivals — the SERVER half (mig 268; Phase B of the sponsorship lifecycle).
 *
 * lib/sponsor-arrivals.ts holds the pure arithmetic; this module is the one place that turns it
 * into rows: post an arrival, undo one, or re-derive every credit after the agreement changes.
 * Three doors call it (the sponsor create, the arrivals route, the settings PATCH) and NONE of
 * them may write these tables directly — the Phase-A lesson, one layer up: a guard built beside
 * a writer drifts; a guard built INTO the only writer cannot.
 *
 * ⚠ THE PAYOUT FLOOR IS ASKED IN HERE, PRE-FLIGHT, per family (lib/dues-credit-guards.ts).
 * Undoing an arrival or shrinking the plan removes rep_dues_credits dollars; if a family's
 * remaining credits would no longer cover what has already been handed back in cash, the whole
 * operation refuses before any row is touched.
 *
 * ⚠ NO TRANSACTIONS. Order is chosen so a mid-flight failure leaves explicable state and each
 * writer unwinds what it already wrote (the mig-030 "money on the books that no screen can
 * explain is worse than a failed save" rule). A concurrent payout racing the guard-to-write gap
 * remains the documented residual (see the Phase-A comment in the fundraisers PATCH); the payout
 * writer's own post-write re-check narrows it from the other side.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import {
  createEntry,
  getOrCreateRepTeamLedger,
  getRepDuesCreditsForPlayer,
  getRepDuesPayoutsForPlayer,
} from './db';
import { payoutFloorViolation, payoutFloorMessage, CREDIT_HAS_PAYOUT } from './dues-credit-guards';
import { tournamentToday } from './timezone';
import {
  accrueArrival,
  deriveAllArrivalCredits,
  type CreditPlanShare,
} from './sponsor-arrivals';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface SponsorTeam { id: string; orgId: string; name: string }

/** The credit plan as stored — one row per credited family. */
export async function getSponsorCreditPlan(fundraiserId: string): Promise<CreditPlanShare[]> {
  const { data } = await supabaseAdmin
    .from('rep_fundraiser_credit_plan')
    .select('player_id, share_value, share_unit')
    .eq('fundraiser_id', fundraiserId)
    .order('created_at', { ascending: true });
  return (data ?? []).map(r => ({
    playerId: r.player_id as string,
    value: Number(r.share_value),
    unit: (r.share_unit as 'amount' | 'percent'),
  }));
}

/** A sponsor's arrivals, oldest first — the replay order every re-derivation depends on. */
export async function getSponsorArrivals(fundraiserId: string) {
  const { data } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('id, amount_raised, received_date, method, notes, accounting_entry_id, created_at')
    .eq('fundraiser_id', fundraiserId)
    .order('received_date', { ascending: true })
    .order('created_at', { ascending: true });
  return data ?? [];
}

/** Per-family dollars already credited by this sponsor's arrivals (via fundraiser_entry_id). */
async function accruedByFamily(entryIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!entryIds.length) return map;
  const { data } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('player_id, amount, fundraiser_entry_id')
    .in('fundraiser_entry_id', entryIds);
  for (const c of data ?? []) {
    if (!c.player_id) continue;
    map.set(c.player_id, round2((map.get(c.player_id) ?? 0) + Number(c.amount)));
  }
  return map;
}

/**
 * The generalized floor: would leaving each family with `projectedByFamily` dollars of
 * THIS-SPONSOR credit (their other credits untouched) strand a payout? Asked family by family,
 * refusing with the shared sentence on the first breach.
 */
async function sponsorFloorRefusal(args: {
  programYearId: string;
  currentByFamily: ReadonlyMap<string, number>;
  projectedByFamily: ReadonlyMap<string, number>;
  action: string;
}): Promise<NextResponse | null> {
  const { programYearId, currentByFamily, projectedByFamily, action } = args;
  for (const [playerId, current] of currentByFamily) {
    const projected = projectedByFamily.get(playerId) ?? 0;
    if (projected >= current - 0.005) continue; // this family keeps or gains — no floor question
    const [credits, payouts] = await Promise.all([
      getRepDuesCreditsForPlayer(programYearId, playerId),
      getRepDuesPayoutsForPlayer(programYearId, playerId),
    ]);
    // Substitute this sponsor's share of the family's credits with its projected total. Credits
    // from OTHER records keep their amounts — the projection only moves what this sponsor owns.
    const delta = round2(current - projected);
    const projectedSet = [
      ...credits.map(c => ({ amount: Number(c.amount), creditType: c.creditType as string })),
      { amount: -delta, creditType: 'fundraiser' },
    ];
    const violation = payoutFloorViolation(projectedSet, payouts);
    if (violation) {
      return NextResponse.json(
        { error: payoutFloorMessage(violation.paidOut, action), code: CREDIT_HAS_PAYOUT },
        { status: 409 },
      );
    }
  }
  return null;
}

/**
 * Post one arrival: the dated income row, the entry, and each family's accrued credit — fully
 * unwound if any piece fails, so an arrival either exists whole or not at all.
 */
export async function writeSponsorArrivalRow(args: {
  team: SponsorTeam;
  programYearId: string;
  fundraiser: { id: string; name: string; pledged_amount: number | null };
  amount: number;
  receivedDate: string;   // YYYY-MM-DD, already validated ≤ today by the route
  method: string | null;
  notes: string | null;
  userId: string;
}): Promise<{ entryId: string } | { error: NextResponse }> {
  const { team, programYearId, fundraiser, amount, receivedDate, method, notes, userId } = args;

  const [plan, priorArrivals] = await Promise.all([
    getSponsorCreditPlan(fundraiser.id),
    getSponsorArrivals(fundraiser.id),
  ]);
  const priorTotal = priorArrivals.reduce((s, a) => s + Number(a.amount_raised), 0);
  const prior = await accruedByFamily(priorArrivals.map(a => a.id as string));

  const shares = accrueArrival({
    plan,
    pledged: fundraiser.pledged_amount ? Number(fundraiser.pledged_amount) : null,
    arrivalAmount: amount,
    priorArrivalsTotal: priorTotal,
    priorAccrued: prior,
  });
  const rebateTotal = round2(shares.reduce((s, r) => s + r.credit, 0));
  // Provenance snapshot only when the plan is exactly one percent share — otherwise 0, and the
  // credit rows themselves carry the story (dictionary: rebate_percent is a snapshot, not truth).
  const pctRows = plan.filter(p => p.unit === 'percent');
  const rebatePercent = plan.length === 1 && pctRows.length === 1 ? pctRows[0].value : 0;

  const ledger = await getOrCreateRepTeamLedger(team.orgId, team.id, team.name);
  const posted = await createEntry(ledger.id, {
    entryDate: receivedDate,
    description: `Sponsorship — ${fundraiser.name}`,
    amount,
    entryType: 'income',
    status: 'posted',
    category: 'fundraising',
  }, userId);

  const { data: entry, error: entryErr } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .insert({
      fundraiser_id: fundraiser.id,
      org_id: team.orgId,
      team_id: team.id,
      player_id: null, // an arrival belongs to the sponsor; families live on the plan (mig 268)
      amount_raised: amount,
      rebate_percent: rebatePercent,
      rebate_amount: rebateTotal,
      accounting_entry_id: posted.id,
      received_date: receivedDate,
      method,
      notes,
    })
    .select()
    .single();
  if (entryErr || !entry) {
    await supabaseAdmin.from('accounting_entries').delete().eq('id', posted.id);
    return { error: NextResponse.json({ error: entryErr?.message ?? 'That arrival could not be saved.' }, { status: 500 }) };
  }

  const written: string[] = [];
  for (const share of shares) {
    const { data: creditRow, error: creditErr } = await supabaseAdmin
      .from('rep_dues_credits')
      .insert({
        program_year_id: programYearId,
        player_id: share.playerId,
        amount: share.credit,
        description: `Sponsorship — ${fundraiser.name}`,
        credit_type: 'fundraiser',
        credit_date: receivedDate,
        created_by: userId,
        fundraiser_entry_id: entry.id,
      })
      .select('id')
      .single();
    if (creditErr || !creditRow) {
      // Whole-arrival unwind: a half-credited arrival would say different things to different
      // families. Remove what we wrote, oldest debt first.
      if (written.length) await supabaseAdmin.from('rep_dues_credits').delete().in('id', written);
      await supabaseAdmin.from('rep_fundraiser_entries').delete().eq('id', entry.id);
      await supabaseAdmin.from('accounting_entries').delete().eq('id', posted.id);
      console.error('[sponsor-arrival] credit insert failed — arrival unwound', { fundraiserId: fundraiser.id, error: creditErr });
      return { error: NextResponse.json({ error: 'That arrival could not credit every family, so nothing was saved. Try again.' }, { status: 500 }) };
    }
    written.push(creditRow.id as string);
  }

  // The status follows the money (mig 268): an arrival exists, so the sponsor is received.
  await supabaseAdmin
    .from('rep_fundraisers')
    .update({ sponsor_status: 'received', updated_at: new Date().toISOString() })
    .eq('id', fundraiser.id);

  return { entryId: entry.id as string };
}

/**
 * Undo one arrival: floor-guarded per family, then its credits, its income row and the entry
 * itself are removed; undoing the last arrival returns the sponsor to a pledge.
 */
export async function undoSponsorArrival(args: {
  programYearId: string;
  fundraiser: { id: string; name: string };
  entryId: string;
}): Promise<{ ok: true; nowPledged: boolean } | { error: NextResponse }> {
  const { programYearId, fundraiser, entryId } = args;

  const arrivals = await getSponsorArrivals(fundraiser.id);
  const target = arrivals.find(a => a.id === entryId);
  if (!target) {
    return { error: NextResponse.json({ error: 'That arrival is not part of this sponsor.' }, { status: 404 }) };
  }

  const allIds = arrivals.map(a => a.id as string);
  const current = await accruedByFamily(allIds);
  const without = await accruedByFamily(allIds.filter(id => id !== entryId));
  const refusal = await sponsorFloorRefusal({
    programYearId,
    currentByFamily: current,
    projectedByFamily: without,
    action: 'undoing this arrival',
  });
  if (refusal) return { error: refusal };

  await supabaseAdmin.from('rep_dues_credits').delete().eq('fundraiser_entry_id', entryId);
  if (target.accounting_entry_id) {
    await supabaseAdmin.from('accounting_entries').delete().eq('id', target.accounting_entry_id);
  }
  await supabaseAdmin.from('rep_fundraiser_entries').delete().eq('id', entryId);

  const nowPledged = arrivals.length === 1;
  if (nowPledged) {
    await supabaseAdmin
      .from('rep_fundraisers')
      .update({ sponsor_status: 'pledged', updated_at: new Date().toISOString() })
      .eq('id', fundraiser.id);
  }
  return { ok: true, nowPledged };
}

/**
 * The agreement changed (plan rows and/or pledged amount): replay every arrival through the new
 * plan and bring the credit rows into line — floor-guarded per family, pre-flight, then
 * re-derived rather than patched. Stores the new plan rows in the same pass.
 */
export async function applySponsorAgreement(args: {
  team: SponsorTeam;
  programYearId: string;
  fundraiser: { id: string; name: string };
  newPlan: CreditPlanShare[];
  newPledged: number | null;
  userId: string;
}): Promise<{ ok: true } | { error: NextResponse }> {
  const { team, programYearId, fundraiser, newPlan, newPledged, userId } = args;

  const arrivals = await getSponsorArrivals(fundraiser.id);
  const entryIds = arrivals.map(a => a.id as string);
  const current = await accruedByFamily(entryIds);

  const rounds = deriveAllArrivalCredits({
    plan: newPlan,
    pledged: newPledged,
    arrivalAmounts: arrivals.map(a => Number(a.amount_raised)),
  });
  const projected = new Map<string, number>();
  for (const round of rounds) for (const s of round) {
    projected.set(s.playerId, round2((projected.get(s.playerId) ?? 0) + s.credit));
  }

  const refusal = await sponsorFloorRefusal({
    programYearId,
    currentByFamily: current,
    projectedByFamily: projected,
    action: 'changing this credit',
  });
  if (refusal) return { error: refusal };

  // Store the plan (replace-all: the form always sends the whole agreement).
  await supabaseAdmin.from('rep_fundraiser_credit_plan').delete().eq('fundraiser_id', fundraiser.id);
  if (newPlan.length) {
    const { error: planErr } = await supabaseAdmin.from('rep_fundraiser_credit_plan').insert(
      newPlan.map(p => ({
        org_id: team.orgId,
        team_id: team.id,
        fundraiser_id: fundraiser.id,
        player_id: p.playerId,
        share_value: p.value,
        share_unit: p.unit,
      })),
    );
    if (planErr) return { error: NextResponse.json({ error: planErr.message }, { status: 500 }) };
  }

  // Re-derive every arrival's credits from scratch under the new agreement.
  if (entryIds.length) {
    await supabaseAdmin.from('rep_dues_credits').delete().in('fundraiser_entry_id', entryIds);
    for (let i = 0; i < arrivals.length; i++) {
      const arrival = arrivals[i];
      const shares = rounds[i] ?? [];
      for (const share of shares) {
        const { error: creditErr } = await supabaseAdmin.from('rep_dues_credits').insert({
          program_year_id: programYearId,
          player_id: share.playerId,
          amount: share.credit,
          description: `Sponsorship — ${fundraiser.name}`,
          credit_type: 'fundraiser',
          credit_date: (arrival.received_date as string | null) ?? tournamentToday(),
          created_by: userId,
          fundraiser_entry_id: arrival.id,
        });
        if (creditErr) {
          console.error('[sponsor-agreement] credit re-derive failed mid-way', { fundraiserId: fundraiser.id, error: creditErr });
          return { error: NextResponse.json({ error: 'The credits could not be re-figured completely — open the sponsor and save the agreement again.' }, { status: 500 }) };
        }
      }
      const rebate = round2(shares.reduce((s, r) => s + r.credit, 0));
      const pctRows = newPlan.filter(p => p.unit === 'percent');
      await supabaseAdmin.from('rep_fundraiser_entries').update({
        rebate_amount: rebate,
        rebate_percent: newPlan.length === 1 && pctRows.length === 1 ? pctRows[0].value : 0,
        updated_at: new Date().toISOString(),
      }).eq('id', arrival.id);
    }
  }

  return { ok: true };
}
