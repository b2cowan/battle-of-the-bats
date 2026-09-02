import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear, getRepDuesPaymentsByProgramYear, getRepDuesPayoutsByProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { paymentsTotalByPlayer, SCHEDULE_CHANGE_CREDIT_DESCRIPTION } from '@/lib/dues-payments';
import { groupByPlayer } from '@/lib/dues-credits';
import { formatPlayerFirstLast } from '@/lib/player-name';
import { planRosterDuesRun, toExistingInstallmentRows, type DuesRunPlan, type StoredInstallmentRow } from '@/lib/dues-bulk-run';
import type { RepInstallmentPreviewRow } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import {
  computeBudgetTotals, describeInstallmentBases, splitPerPlayer,
  type InstallmentBasis,
  normalizeBudgetLineKind,
} from '@/lib/coach-budget-totals';

/** Cents, for a refusal a coach has to be able to act on. */
function fmtMoney(n: number): string {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

/**
 * ⚠⚠ THE FOUR READS THAT MAKE THIS A PREVIEW RATHER THAN A TABLE (owner ruling 2026-09-01,
 * "Exceptions First").
 *
 * Every fact below was already known to the product at this moment and was simply told to the
 * coach LATER — the hand-set question as a 409 after the button, the payout-floor refusal as a
 * line in the result screen. Reading them here is what lets the preview stop being contradicted
 * by its own confirm step.
 *
 * The joining is `planRosterDuesRun` (lib/dues-bulk-run.ts) — SHARED with the write route's own
 * hand-set detection, so the names this screen offers to keep are exactly the names that route
 * keeps. No arithmetic lives here: the credit delta is the reconcile planner's, the refusal is
 * the payout floor's.
 *
 * Cost: four season-wide reads on a deliberate button press, ALL FOUR IN PARALLEL and none of them
 * per-player. The write route already pays for three of them on every run.
 *
 * ⚠ THE INSTALLMENTS READ FILTERS THROUGH ITS PARENT rather than fetching schedule ids first and
 * asking again with them. `rep_player_dues_installments` carries no season column — only a
 * `schedule_id` — and its denormalized `team_id` spans every season the team has ever had, so a
 * season's rows genuinely have to be reached through the schedule. An embedded `!inner` filter
 * (the pattern lib/db.ts and lib/family-engagement.ts already use) does that in ONE query, which
 * is what keeps this at four parallel reads instead of three-then-one-more.
 */
async function readRunExceptions(args: {
  programYearId: string;
  players: readonly { id: string; name: string }[];
  newScheduleTotal: number;
  newDueDates: readonly string[];
}): Promise<DuesRunPlan | { error: string }> {
  const { programYearId, players, newScheduleTotal, newDueDates } = args;

  const [installments, payments, payouts, credits] = await Promise.all([
    supabaseAdmin
      .from('rep_player_dues_installments')
      .select('player_id, installment_number, amount, due_date, rep_player_dues_schedules!inner(program_year_id)')
      .eq('rep_player_dues_schedules.program_year_id', programYearId),
    getRepDuesPaymentsByProgramYear(programYearId),
    getRepDuesPayoutsByProgramYear(programYearId),
    supabaseAdmin
      .from('rep_dues_credits')
      .select('id, player_id, amount, credit_type, payment_id, description')
      .eq('program_year_id', programYearId)
      // Newest first — the order `planOverpaymentReconcile` shrinks in, and the order the
      // executor hands it. A different order here would make the preview's credit figure a
      // different figure from the one the run writes.
      .order('created_at', { ascending: false }),
  ]);

  /* ⚠⚠ A FAILED READ IS NOT AN EMPTY ONE (/review 2026-09-01, High).
   *
   * Both of these used to fall through as `?? []`, and the two silences were the worst kind: an
   * installments failure makes the screen announce "this roster has no dues yet" and hide the
   * keep-my-hand-set-schedules checkbox on a roster that has both, and a credits failure empties
   * every family's projected credit set, which makes the payout floor refuse every family that
   * has ever been handed cash. Neither destroys anything — the write route reads all of this
   * again and refuses on its own terms — but a preview whose whole promise is "nothing after the
   * button contradicts this" cannot be allowed to guess. It fails loudly instead, exactly as the
   * write route already does on the same credits read. */
  if (installments.error || credits.error) {
    return { error: 'Could not read this season’s dues — nothing was previewed. Try again.' };
  }

  const existingRows = toExistingInstallmentRows(installments.data as StoredInstallmentRow[] | null);

  const creditRows = ((credits.data ?? []) as Array<{ id: string; player_id: string; amount: number; credit_type: string; payment_id: string | null; description: string | null }>)
    .map(c => ({
      playerId: c.player_id,
      id: c.id,
      amount: Number(c.amount),
      creditType: c.credit_type,
      // The engine's own standalone row — the only kind a top-up may land on, exactly as
      // `reconcileOverpaymentCredits` decides it. Same test, so the same plan comes out.
      consolidatable: c.payment_id == null && c.description === SCHEDULE_CHANGE_CREDIT_DESCRIPTION,
    }));

  return planRosterDuesRun({
    players,
    newScheduleTotal,
    newDueDates,
    existingRows,
    paymentTotals:   paymentsTotalByPlayer(payments),
    creditsByPlayer: groupByPlayer(creditRows),
    payoutsByPlayer: groupByPlayer(payouts),
  });
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
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const url   = new URL(req.url);
  const count = parseInt(url.searchParams.get('installmentCount') ?? '1', 10);
  const dates = url.searchParams.getAll('dates[]');
  // Which of the three answers the coach picked. Resolved AFTER the budget is read, because
  // "what this endpoint always did" is not a constant — see `basis` below.
  const basisParam = url.searchParams.get('basis');
  const rawAmounts = url.searchParams.getAll('amounts[]');
  const isManual   = basisParam === 'manual';

  if (isNaN(count) || count < 1 || count > 12) {
    return NextResponse.json({ error: 'installmentCount must be between 1 and 12' }, { status: 400 });
  }
  if (dates.length > 0 && dates.length !== count) {
    return NextResponse.json({ error: 'Number of dates must match installmentCount' }, { status: 400 });
  }

  // ⚠ THE WHOLE POINT OF THIS ENDPOINT'S REWRITE. It used to accept the dates and the count and
  // then re-derive an even split every single time, discarding whatever the coach had typed —
  // while the WRITE endpoint next door used those typed amounts. A coach entering $150 was shown
  // $800 and would have created $150. Whatever this returns is now what gets written.
  let manualAmounts: number[] = [];
  if (isManual) {
    if (rawAmounts.length !== count) {
      return NextResponse.json({ error: 'An amount is required for every installment' }, { status: 400 });
    }
    const parsed = rawAmounts.map(a => Number(a));
    if (parsed.some(a => !Number.isFinite(a))) {
      return NextResponse.json({ error: 'Every installment amount must be a number.' }, { status: 400 });
    }
    // ⚠ ROUNDED TO CENTS HERE, and only here. The split path has always gone through the shared
    // 2-dp helper; the manual path did not, so a typed "100.005" travelled un-rounded all the way
    // into a family's dues (the browser does not enforce `step` on a number input). Rounding
    // BEFORE the zero check also means "0.001" is correctly refused rather than silently stored
    // as a $0.00 instalment the write endpoint would then reject.
    manualAmounts = parsed.map(a => Math.round(a * 100) / 100);
    if (manualAmounts.some(a => a <= 0)) {
      return NextResponse.json({ error: 'Every installment amount must be at least $0.01.' }, { status: 400 });
    }
  }

  // Who is being charged, and what the season costs. Two independent reads on two tables with no
  // data dependency between them, so they go together — the pattern the sibling money routes
  // (budget, budget-vs-actual, money-summary) already use. Serially this route paid an extra
  // round trip on every Preview click for a short-circuit that essentially never fires: the modal
  // blocks an empty roster before the form is reachable at all.
  //
  // ⚠ The budget is read in MANUAL mode too, deliberately: it is what the sheet's running
  // comparison is quoted against ("$3,800 short of what players need to fund"). It just stops
  // being a gate.
  const [{ data: players }, { data: linesData }] = await Promise.all([
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .eq('program_year_id', programYear.id)
      .eq('status', 'active')
      .order('player_last_name'),
    supabaseAdmin
      .from('rep_budget_lines')
      .select('total_amount, line_kind')
      .eq('program_year_id', programYear.id),
  ]);

  // The one refusal that survives every basis — with nobody to charge there is nothing to preview
  // in any mode.
  if (!players || players.length === 0) {
    return NextResponse.json({ error: 'No active roster players found for this program year.' }, { status: 400 });
  }

  const totals = computeBudgetTotals({
    lines: (linesData ?? []).map((l: { total_amount: number; line_kind?: string | null }) => ({
      totalAmount: l.total_amount ?? 0,
      lineKind: normalizeBudgetLineKind(l.line_kind),
    })),
    estimatedTotal: programYear.budgetAmount ?? null,
    rosterCount: players.length,
  });
  const bases = describeInstallmentBases(totals);

  // ⚠ OWNER RULING 2026-08-13 — MANUAL IS NEVER BLOCKED BY THE BUDGET.
  //
  // Three states used to end this endpoint, and the sheet with it: no budget lines, funding
  // covering the whole season, and an estimate of $0. Every one of them says the same thing —
  // "there is no number to divide" — which is a reason a SPLIT cannot run, not a reason a coach
  // cannot type $400. Since this sheet is now also the Player Dues bulk door, where a coach may
  // never have built a budget at all, that refusal was turning people away from the only job that
  // screen exists to do. The reasons now travel per-basis (see `describeInstallmentBases`) and
  // only a split is refused.
  /**
   * ⚠ WHICH BASIS AN OLDER CLIENT GETS.
   *
   * "Default to budget" would NOT be what this endpoint always did. Before the picker existed it
   * divided `fundedByPlayers`, and that figure follows the season ESTIMATE whenever one is set
   * (the 2026-08-12 ruling). Defaulting to the itemized lines instead would quietly re-price a
   * roster — $8,000 of lines under a $9,000 estimate is $680 a player rather than $780, a $1,000
   * swing produced by omitting one query parameter. So an absent `basis` resolves to whichever
   * option reproduces the old arithmetic exactly.
   */
  const basis: InstallmentBasis =
    basisParam === 'manual' || basisParam === 'estimate' || basisParam === 'budget'
      ? basisParam
      : totals.estimatedTotal != null ? 'estimate' : 'budget';

  // ⚠ OWNER RULING 2026-08-13 — MANUAL IS NEVER BLOCKED BY THE BUDGET.
  //
  // Three states used to end this endpoint, and the sheet with it: no budget lines, funding
  // covering the whole season, and an estimate of $0. Every one of them says the same thing —
  // "there is no number to divide" — which is a reason a SPLIT cannot run, not a reason a coach
  // cannot type $400. Since this sheet is now also the Player Dues bulk door, where a coach may
  // never have built a budget at all, that refusal was turning people away from the only job that
  // screen exists to do. The reasons now travel per-basis (see `describeInstallmentBases`) and
  // only a split is refused.
  let installmentAmounts: number[];
  if (basis === 'manual') {
    installmentAmounts = manualAmounts;
  } else {
    const option = bases[basis];
    if (option.unavailable || option.perPlayer == null) {
      return NextResponse.json(
        { error: option.unavailable ?? 'There is nothing for players to fund on this basis.' },
        { status: 400 },
      );
    }
    installmentAmounts = splitPerPlayer(option.perPlayer, count);
  }

  /**
   * ⚠ THE PREVIEW MUST NEVER PROMISE A SCHEDULE THE WRITE WILL REFUSE.
   *
   * A basis is judged available on its TOTAL, but a total can be too small to cut into this many
   * dated pieces — a dollar across twelve dates leaves eight of them with nothing in. The write
   * endpoint rejects any installment at or below zero and refuses the WHOLE roster generically, at
   * the confirm step, after the coach has read and approved a table. Caught here instead, named,
   * before anything is shown.
   */
  if (installmentAmounts.some(a => a <= 0)) {
    return NextResponse.json(
      {
        error: `${fmtMoney(installmentAmounts.reduce((s, a) => s + a, 0))} per player does not divide into ${count} installments — some would be $0.00. Use fewer installments, or set the amounts yourself.`,
      },
      { status: 400 },
    );
  }

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

  /* Who this run treats differently — see `readRunExceptions`. The name is assembled with the
     SHARED first-last helper and the write route's own 'Unnamed player' fallback, so a family
     named in the preview is named identically in the result screen. */
  const run = await readRunExceptions({
    programYearId:    programYear.id,
    players:          players.map(p => ({
      id:   p.id,
      // ⚠ `.trim()` — the shared helper joins but does not trim, and a whitespace-only name is
      // TRUTHY, so without it a roster row holding " " renders as a blank instead of falling
      // back. The write route names the same families the same way, on purpose.
      name: formatPlayerFirstLast({ playerFirstName: p.player_first_name, playerLastName: p.player_last_name }).trim()
            || 'Unnamed player',
    })),
    newScheduleTotal: installmentAmounts.reduce((sum, a) => sum + a, 0),
    newDueDates:      dates,
  });
  if ('error' in run) return NextResponse.json({ error: run.error }, { status: 500 });

  // ⚠ THE ROWS, AND THE EXCEPTIONS — AND STILL NOT `perPlayer` / `fundedByPlayers`. Those two
  // were briefly returned here and NOTHING read them: the sheet computes both locally for its
  // live comparison, which it has to, since that line updates as the coach types and cannot wait
  // on a round trip. Shipping a second copy of a money figure nobody consumes is how the two
  // quietly stop agreeing, which is the entire defect this endpoint was rewritten to end.
  //
  // `run` earns its place by the opposite test: it is the ONLY source of those facts (nothing on
  // the client can know who is hand-set or who the payout floor refuses), it is read by the
  // screen on every render, and it comes from the same shared derivation the write route obeys.
  return NextResponse.json({
    preview,
    basis,
    rosterCount:      players.length,
    installmentCount: count,
    run,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/installment-preview' });
