import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear, getRepDuesPaymentsByProgramYear, syncDuesPaidProjection, reconcileOverpaymentCredits } from '@/lib/db';
import { paymentsTotalByPlayer } from '@/lib/dues-payments';
import type { RepDuesPayment } from '@/lib/types';
import { tournamentToday } from '@/lib/timezone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

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
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

interface InstallmentInput {
  installmentNumber: number;
  dueDate: string;
  amount: number;
}

interface PlayerOverride {
  playerId: string;
  installments: InstallmentInput[];
}

/** Matches the preview endpoint's cap — the two must refuse the same schedules. */
const MAX_INSTALLMENTS = 12;

// POST /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/generate-installments
// Body: {
//   installments: InstallmentInput[],   // default schedule for all players
//   overrides?: PlayerOverride[],        // per-player adjustments (optional)
//   replace?: boolean,                   // rewrite an existing schedule (see below)
// }
//
// Creates one rep_player_dues_schedule + N rep_player_dues_installments per active
// roster player. Uses source='budget_generated' to distinguish from manual schedules.
//
// ── Re-running (owner rulings 2026-08-13, updated same day by the payment record / mig 232) ──
// Without `replace` this still refuses once a schedule exists, so nothing overwrites dues by
// accident. With `replace: true` it rewrites for EVERYONE — including players who have paid.
//
// ⚠ WHY THAT IS NOW SAFE, precisely: the receipts no longer live on the installment rows. A
// payment is its own record (rep_dues_payments) carrying the ledger link; the paid stamp on an
// installment is only a coverage projection. Rewriting a paying player's schedule deletes plan
// rows, never money — their payments re-allocate oldest-first against the new plan and the
// projection is re-synced below. (The pre-232 flow HAD to skip these players whole, because the
// installment row was simultaneously the bill, the receipt and the ledger link — deleting it
// destroyed the record of money collected. That is the defect the payment record dissolved.)
//
// A player whose recorded payments exceed the NEW total gets the stranded excess saved as an
// overpayment credit automatically (owner ruling 5) — without it, lowering dues below what a
// family already paid would make the difference invisible: capped out of Paid, absent from
// Balance, in no one's books.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const defaultInstallments: InstallmentInput[] = body.installments ?? [];
  const overrides: PlayerOverride[]             = body.overrides    ?? [];
  const replace: boolean                        = body.replace === true;

  // Which of the three answers produced these amounts. NOT re-derived from — the numbers arrive
  // already agreed, straight from the preview the coach approved. It is recorded so the schedule
  // can say where it came from: the note used to read "Generated from budget plan" for every row,
  // which became untrue the moment a coach could type their own amounts, or split against the
  // season estimate, or open this from Player Dues with no budget plan at all.
  const SCHEDULE_NOTES: Record<string, string> = {
    manual:   'Set by the coach',
    estimate: 'Generated from the season estimate',
    budget:   'Generated from budget plan',
  };
  const scheduleNote = SCHEDULE_NOTES[body.basis as string] ?? SCHEDULE_NOTES.budget;

  // Existing schedules for this season, and which of them have money against them. Both are
  // needed before anything is written: the first decides create-vs-replace, the second decides
  // which players are off-limits.
  const existingSchedules = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, player_id')
    .eq('program_year_id', programYear.id);

  const scheduleRows  = (existingSchedules.data ?? []) as { id: string; player_id: string }[];
  const scheduleIds   = scheduleRows.map(s => s.id);
  const scheduleByPlayer = new Map(scheduleRows.map(s => [s.player_id, s.id]));
  let existingInstallmentCount = 0;

  if (scheduleIds.length > 0) {
    const { data: instRows } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('player_id')
      .in('schedule_id', scheduleIds);
    existingInstallmentCount = (instRows ?? []).length;
  }

  // Recorded payments per player (mig 232) — kept across a replace, re-applied to the new plan.
  // Full rows, not just totals: the coverage projection after each rewrite runs on THESE rows,
  // so the whole roster loop below does zero payment re-reads. Credits reconcile per player
  // below — symmetric, so lowering dues credits stranded money AND raising dues claws a stale
  // automatic credit back (review 2026-08-13, Critical 1).
  const seasonPayments = await getRepDuesPaymentsByProgramYear(programYear.id);
  const paymentTotals = paymentsTotalByPlayer(seasonPayments);
  const paymentsListByPlayer = new Map<string, RepDuesPayment[]>();
  for (const p of seasonPayments) {
    if (!paymentsListByPlayer.has(p.playerId)) paymentsListByPlayer.set(p.playerId, []);
    paymentsListByPlayer.get(p.playerId)!.push(p);
  }
  const paidPlayerIds = new Set(paymentTotals.keys());

  // ⚠ This refusal is a QUESTION for the client, not a dead end, so it carries a code.
  //
  // The client used to decide `replace` for itself from the budget plan's `hasInstallments`,
  // which counts only source='budget_generated'. A roster with any hand-set schedule therefore
  // reported "nothing here", sent replace:false, and landed on this 409 quoting an option no
  // screen offered — permanently, and by the commonest route in the product, since per-player
  // dues and bulk dues sit on the same page. The code lets the modal turn this into "replace
  // what's there?" with the coach's form still intact.
  if (existingInstallmentCount > 0 && !replace) {
    return NextResponse.json(
      {
        error: 'This roster already has a dues schedule.',
        code: 'ALREADY_HAS_DUES',
        playersWithDues:     new Set(scheduleRows.map(s => s.player_id)).size,
        playersWithPayments: paidPlayerIds.size,
      },
      { status: 409 },
    );
  }

  if (defaultInstallments.length === 0) {
    return NextResponse.json({ error: 'installments array is required and must not be empty' }, { status: 400 });
  }

  // ⚠ THE SAME CEILING THE PREVIEW ENFORCES. Without it this endpoint would accept an installments
  // array of any length and write that many rows FOR EVERY ACTIVE PLAYER — a roster-sized
  // multiplier on an unbounded input, reachable by anyone who can already write money here.
  if (defaultInstallments.length > MAX_INSTALLMENTS
      || overrides.some(o => (o.installments?.length ?? 0) > MAX_INSTALLMENTS)) {
    return NextResponse.json(
      { error: `A schedule can have at most ${MAX_INSTALLMENTS} installments.` },
      { status: 400 },
    );
  }

  // ⚠ `Number.isFinite`, NOT `typeof === 'number'`. NaN is a number, and `NaN <= 0` is false, so a
  // NaN amount walked straight through this gate and into a family's dues — where every sum built
  // from it becomes NaN in turn. Infinity likewise.
  const badRow = (inst: InstallmentInput) =>
    !inst.dueDate || !Number.isFinite(inst.amount) || inst.amount <= 0;

  if (defaultInstallments.some(badRow) || overrides.some(o => (o.installments ?? []).some(badRow))) {
    return NextResponse.json({ error: 'Each installment must have a dueDate and a positive amount' }, { status: 400 });
  }

  const totalPerPlayer = defaultInstallments.reduce((s, i) => s + i.amount, 0);

  // Fetch active roster
  const { data: players, error: rosterErr } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name, org_id')
    .eq('program_year_id', programYear.id)
    .eq('status', 'active');

  if (rosterErr || !players || players.length === 0) {
    return NextResponse.json({ error: 'No active roster players found.' }, { status: 400 });
  }

  const overrideMap = new Map(overrides.map(o => [o.playerId, o.installments]));

  // Create all schedules and installments in sequence
  let totalCreated = 0;
  let playersProcessed = 0;
  /** Players whose recorded payments were kept and re-applied to the rewritten plan. */
  let playersWithPaymentsKept = 0;
  /** Dollars of stranded excess auto-credited (payments beyond a player's NEW total). */
  let overpaymentCreditsCreated = 0;
  /** Players whose dues could not be written. NAMED, not counted — see the response note. */
  const playersFailed: string[] = [];
  const nameOf = (p: { player_first_name: string | null; player_last_name: string | null }) =>
    [p.player_first_name, p.player_last_name].filter(Boolean).join(' ').trim() || 'Unnamed player';

  for (const player of players) {
    const playerInstallments = overrideMap.get(player.id) ?? defaultInstallments;
    const playerTotal = playerInstallments.reduce((s, i) => s + i.amount, 0);

    // ⚠ ORDER IS LOAD-BEARING: secure the schedule row FIRST, delete only once it succeeded.
    //
    // Supabase gives us no transaction here, so the delete and the insert cannot be made atomic
    // — but the window can be made as small as possible and never opened for nothing. Deleting
    // before the upsert (as this did originally) meant a failed upsert wiped a player's dues and
    // wrote nothing back, and that player was then dropped from BOTH counters, so the coach was
    // told about a roster that was quietly one player short.
    const { data: schedule, error: schedErr } = await supabaseAdmin
      .from('rep_player_dues_schedules')
      .upsert(
        {
          program_year_id: programYear.id,
          player_id:       player.id,
          team_id:         team.id,
          org_id:          ctx!.org.id,
          total_amount:    playerTotal,
          notes:           scheduleNote,
        },
        { onConflict: 'program_year_id,player_id' },
      )
      .select('id')
      .single();

    // Nothing has been deleted yet, so this player is simply untouched — their old schedule (if
    // any) still stands. Reported, never swallowed.
    if (schedErr || !schedule) { playersFailed.push(nameOf(player)); continue; }

    // Now clear the old rows: installment_number is unique per schedule, so an insert over the
    // top would collide rather than supersede. Safe for a paying player too — these are PLAN
    // rows; the receipts (rep_dues_payments) and their ledger links are untouched, and the
    // legacy accounting_entry_id a pre-232 stamped row carried is a duplicate of the link its
    // migrated payment adopted.
    if (replace) {
      const { error: delErr } = await supabaseAdmin
        .from('rep_player_dues_installments')
        .delete()
        .eq('schedule_id', schedule.id);
      if (delErr) { playersFailed.push(nameOf(player)); continue; }
    }

    const installmentRows = playerInstallments.map(inst => ({
      schedule_id:        schedule.id,
      player_id:          player.id,
      installment_number: inst.installmentNumber,
      amount:             inst.amount,
      due_date:           inst.dueDate,
      source:             'budget_generated' as const,
      org_id:             ctx!.org.id,
      team_id:            team.id,
    }));

    // ⚠ THE RESULT OF THIS INSERT IS THE WHOLE POINT. It used to be discarded, and the counters
    // incremented regardless — so a failure here (a unique-key collision from a double submit, a
    // transient error) left a player holding a total_amount with no installments behind it while
    // the coach was told "✓ Dues set for N players". On a replace that is silent data loss: the
    // old rows are already gone. A failure is now surfaced with the player's name.
    // (`.select` returns the fresh ids so a paying player's coverage projection below runs on
    // rows already in hand — re-fetching per player made a full-roster replace hundreds of
    // sequential round-trips.)
    const { data: insertedRows, error: insErr } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .insert(installmentRows)
      .select('id, installment_number, amount');
    if (insErr || !insertedRows) { playersFailed.push(nameOf(player)); continue; }

    // A paying player's money re-applies to the new plan: re-project coverage onto the fresh
    // rows, then credit any stranded excess (payments beyond the NEW total that no payment-linked
    // credit already carries — ruling 5's automatic credit, minus what was credited at record
    // time against the old total).
    if (paidPlayerIds.has(player.id)) {
      playersWithPaymentsKept += 1;
      try {
        await syncDuesPaidProjection(programYear.id, player.id, {
          installments: insertedRows.map((r: any) => ({
            id: r.id, installmentNumber: r.installment_number, amount: Number(r.amount), paidAt: null,
          })),
          payments: paymentsListByPlayer.get(player.id) ?? [],
        });
      } catch {
        // The plan rows are written and correct; a projection lag self-heals on the next payment
        // write. Not worth failing the player over.
      }
      try {
        const { created } = await reconcileOverpaymentCredits({
          programYearId: programYear.id,
          playerId: player.id,
          scheduleTotal: playerTotal,
          paymentsTotal: paymentTotals.get(player.id) ?? 0,
          creditDate: tournamentToday(),
          createdBy: ctx!.user.id,
          paymentId: null,
        });
        overpaymentCreditsCreated = Math.round((overpaymentCreditsCreated + created) * 100) / 100;
      } catch {
        playersFailed.push(nameOf(player));
        continue;
      }
    }

    totalCreated += installmentRows.length;
    playersProcessed += 1;
  }

  // playersProcessed + playersFailed.length === players.length, always. The client states each
  // bucket; a roster that silently didn't add up was the defect being fixed. `playersSkipped` is
  // kept at 0 for older clients of this response — nothing is skipped since mig 232.
  return NextResponse.json({
    created: true,
    playersProcessed,
    playersSkipped: 0,
    playersWithPaymentsKept,
    overpaymentCreditsCreated,
    playersFailed,
    installmentsCreated: totalCreated,
    totalPerPlayer,
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/generate-installments' });
