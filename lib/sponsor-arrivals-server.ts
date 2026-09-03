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
import { orgDayKey } from './timezone';
import {
  accrueArrival,
  accruedByFamilyFromRounds,
  arrivalOrder,
  deriveAllArrivalCredits,
  type AccruedShare,
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
async function getSponsorArrivals(fundraiserId: string) {
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
  const projected = accruedByFamilyFromRounds(rounds);

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
  const rewrite = await rewriteSponsorCredits({ programYearId, fundraiser, plan: newPlan, arrivals, rounds, userId });
  if (rewrite) return { error: rewrite };

  return { ok: true };
}

/**
 * Bring every credit row into line with a replay: the old rows go, one row per family per
 * arrival comes back from `rounds`, and each arrival's own `rebate_amount` is restated. Shared by
 * the agreement edit and the cheque edit (Phase B) — the two doors that re-figure history rather
 * than add to it — so the rows they write can never be shaped two ways.
 *
 * `arrivals` must be in REPLAY ORDER (the same order `rounds` was derived in). Returns the refusal
 * to send when a row could not be written, else null.
 */
async function rewriteSponsorCredits(args: {
  programYearId: string;
  fundraiser: { id: string; name: string };
  plan: readonly CreditPlanShare[];
  arrivals: readonly { id: string; received_date: string | null; created_at: string }[];
  rounds: AccruedShare[][];
  userId: string;
}): Promise<NextResponse | null> {
  const { programYearId, fundraiser, plan, arrivals, rounds, userId } = args;
  const entryIds = arrivals.map(a => a.id);
  if (!entryIds.length) return null;

  /* ⚠ THE ROWS THAT ARE ABOUT TO GO ARE KEPT (`/review`, 2026-09-02). This is a delete-then-insert
     with no transaction; if the insert fails the families read $0 credited from this sponsor until
     someone retries. So the old rows are snapshotted first and put back on that failure — the
     module's own rule, "each writer unwinds what it already wrote", honoured here too. */
  const { data: previous } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('*')
    .in('fundraiser_entry_id', entryIds);
  await supabaseAdmin.from('rep_dues_credits').delete().in('fundraiser_entry_id', entryIds);
  const pctRows = plan.filter(p => p.unit === 'percent');
  const rebatePercent = plan.length === 1 && pctRows.length === 1 ? pctRows[0].value : 0;
  // One insert for every credit row of every arrival — a cheque correction on a sponsor with many
  // arrivals and families is otherwise dozens of sequential round trips (`/simplify`, 2026-09-02).
  const creditRows = arrivals.flatMap((arrival, i) => (rounds[i] ?? []).map(share => ({
    program_year_id: programYearId,
    player_id: share.playerId,
    amount: share.credit,
    description: `Sponsorship — ${fundraiser.name}`,
    credit_type: 'fundraiser',
    /* ⚠ NEVER TODAY (`/review`, 2026-09-02 — the drive route's own Critical finding, one door over).
       An undated cheque is dated the org-clock day it was recorded, exactly as every reader dates
       it; stamping the replay's day on it would move a family's credit into this month because a
       coach corrected a note. */
    credit_date: arrival.received_date ?? orgDayKey(arrival.created_at),
    created_by: userId,
    fundraiser_entry_id: arrival.id,
  })));
  if (creditRows.length) {
    const { error: creditErr } = await supabaseAdmin.from('rep_dues_credits').insert(creditRows);
    if (creditErr) {
      console.error('[sponsor-agreement] credit re-derive failed — restoring the previous rows', { fundraiserId: fundraiser.id, error: creditErr });
      if (previous?.length) await supabaseAdmin.from('rep_dues_credits').insert(previous);
      return NextResponse.json({ error: 'The credits could not be re-figured, so they were left as they were — open the sponsor and save its credit split again.' }, { status: 500 });
    }
  }
  // Each arrival's own rebate snapshot — a different figure per row, so one update per arrival.
  for (let i = 0; i < arrivals.length; i++) {
    const rebate = round2((rounds[i] ?? []).reduce((s, r) => s + r.credit, 0));
    await supabaseAdmin.from('rep_fundraiser_entries').update({
      rebate_amount: rebate,
      rebate_percent: rebatePercent,
      updated_at: new Date().toISOString(),
    }).eq('id', arrivals[i].id);
  }
  return null;
}

/**
 * EDIT ONE CHEQUE — amount, the day it arrived, how it came, a note (List · Room · Question
 * Phase B, 2026-09-02; the parity the drive's entries already had and arrivals did not — undo-only
 * since mig 268, with no recorded reason).
 *
 * ⚠ AN EDIT IS A REPLAY, NOT A ROW PATCH. A cheque's credits were figured against everything that
 * arrived BEFORE it (a dollar share fills proportionally; the cheque that reaches the pledge takes
 * the remainder), so changing one amount — or moving one date past a sibling's — re-figures every
 * family's credit on every arrival. The edited history is replayed through the stored plan, the
 * payout floor is asked per family PRE-FLIGHT, and only then are the ledger row, the entry and the
 * whole credit set rewritten. Same writer the agreement edit uses (`rewriteSponsorCredits`), so
 * the two doors cannot drift.
 *
 * Fields left `undefined` are untouched; `method: null` / `notes: null` clear. Validation (an amount
 * above zero, a date that has happened, a method from the one list) is the route's.
 */
export async function editSponsorArrival(args: {
  programYearId: string;
  fundraiser: { id: string; name: string; pledged_amount: number | null };
  entryId: string;
  amount?: number;
  receivedDate?: string;
  method?: string | null;
  notes?: string | null;
  userId: string;
}): Promise<{ ok: true } | { error: NextResponse }> {
  const { programYearId, fundraiser, entryId, amount, receivedDate, method, notes, userId } = args;

  // The plan and the arrivals are independent reads — together, as `writeSponsorArrivalRow` fetches them.
  const [plan, arrivals] = await Promise.all([
    getSponsorCreditPlan(fundraiser.id),
    getSponsorArrivals(fundraiser.id),
  ]);
  const target = arrivals.find(a => a.id === entryId);
  if (!target) {
    return { error: NextResponse.json({ error: 'That arrival is not part of this sponsor.' }, { status: 404 }) };
  }

  /* ⚠ A NOTE OR A METHOD IS NOT MONEY (`/review`, 2026-09-02). Only an amount or a date changes
     what any family earned; replaying the credits for a note correction would rewrite every credit
     row of every arrival (new ids, new created_by) for money that never moved. Those edits touch
     the entry alone and return. */
  const moneyMoved = (amount !== undefined && Math.abs(amount - Number(target.amount_raised)) > 0.005)
    || (receivedDate !== undefined && receivedDate !== (target.received_date ?? null));
  if (!moneyMoved) {
    const { error: noteErr } = await supabaseAdmin
      .from('rep_fundraiser_entries')
      .update({
        ...(method !== undefined ? { method } : {}),
        ...(notes !== undefined ? { notes } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('fundraiser_id', fundraiser.id);
    if (noteErr) {
      console.error('[sponsor-arrival] entry update failed', { entryId, error: noteErr });
      return { error: NextResponse.json({ error: 'That cheque could not be saved. Try again.' }, { status: 500 }) };
    }
    return { ok: true };
  }

  // The history AS IT WOULD BE — the edited row substituted, then put back in replay order, because
  // a moved date can change which cheque comes first.
  const edited = arrivals
    .map(a => (a.id === entryId
      ? { ...a, amount_raised: amount ?? Number(a.amount_raised), received_date: receivedDate ?? (a.received_date as string | null) }
      : a))
    .map(a => ({ ...a, receivedDate: a.received_date as string | null, createdAt: String(a.created_at) }))
    .sort(arrivalOrder);

  const current = await accruedByFamily(arrivals.map(a => a.id as string));
  const rounds = deriveAllArrivalCredits({
    plan,
    pledged: fundraiser.pledged_amount,
    arrivalAmounts: edited.map(a => Number(a.amount_raised)),
  });
  const refusal = await sponsorFloorRefusal({
    programYearId,
    currentByFamily: current,
    projectedByFamily: accruedByFamilyFromRounds(rounds),
    action: 'changing this cheque',
  });
  if (refusal) return { error: refusal };

  // The books first: the income row carries the amount and the month every report reads.
  if (target.accounting_entry_id && (amount !== undefined || receivedDate !== undefined)) {
    const { error: ledgerErr } = await supabaseAdmin
      .from('accounting_entries')
      .update({
        ...(amount !== undefined ? { amount } : {}),
        ...(receivedDate !== undefined ? { entry_date: receivedDate } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', target.accounting_entry_id);
    if (ledgerErr) {
      console.error('[sponsor-arrival] ledger update failed — nothing changed', { entryId, error: ledgerErr });
      return { error: NextResponse.json({ error: 'The books entry could not be changed, so nothing was saved. Try again.' }, { status: 500 }) };
    }
  }

  const { error: entryErr } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .update({
      ...(amount !== undefined ? { amount_raised: amount } : {}),
      ...(receivedDate !== undefined ? { received_date: receivedDate } : {}),
      ...(method !== undefined ? { method } : {}),
      ...(notes !== undefined ? { notes } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('fundraiser_id', fundraiser.id);
  if (entryErr) {
    console.error('[sponsor-arrival] entry update failed after the ledger moved', { entryId, error: entryErr });
    return { error: NextResponse.json({ error: 'The books entry changed but the cheque itself could not be saved — save it once more to bring the two back in line.' }, { status: 500 }) };
  }

  const rewrite = await rewriteSponsorCredits({
    programYearId,
    fundraiser,
    plan,
    arrivals: edited.map(a => ({ id: a.id as string, received_date: a.receivedDate, created_at: a.createdAt })),
    rounds,
    userId,
  });
  if (rewrite) return { error: rewrite };

  return { ok: true };
}
