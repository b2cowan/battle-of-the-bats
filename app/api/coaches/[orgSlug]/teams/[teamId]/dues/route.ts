import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepRosterPlayers,
  getRepPlayerDuesSchedules,
  getRepDuesInstallmentsBySchedules,
  getRepDuesPaymentsByProgramYear,
  getRepDuesPayoutsByProgramYear,
  getRepDuesPaymentsForPlayer,
  getRepDuesPayoutsForPlayer,
  getRepDuesCreditsForPlayer,
  upsertRepPlayerDuesSchedule,
  syncDuesPaidProjection,
  reconcileOverpaymentCredits,
} from '@/lib/db';
import { getRepDuesPaidBackByCredit } from '@/lib/db';
import { payoutFloorViolation, payoutFloorMessage, projectScheduleTotalChange, CREDIT_HAS_PAYOUT } from '@/lib/dues-credit-guards';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney, canWriteMoney, redactRosterPlayer } from '@/lib/coach-capabilities';
import { outstandingForSchedule } from '@/lib/dues-status';
import { duesPaidAmount, splitFamilyOwnMoney, splitDuesLadder, SCHEDULE_CHANGE_CREDIT_DESCRIPTION } from '@/lib/dues-payments';
import { creditsTotal, amountsTotal, deriveDuesPosition, groupByPlayer, payoutCeiling } from '@/lib/dues-credits';
import { tournamentToday } from '@/lib/timezone';
import { normalizeGuardianEmail } from '@/lib/guardian-email';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';

/**
 * The family identity, made safe to send. Siblings share a guardian email (the platform's
 * de-facto family key — lib/coach-family-dues.ts), but the dues payload redacts that email for
 * a money-cleared coach without the PII grant — and the family dues STATEMENT must still roll
 * siblings into one household for them, or it asks the same parent twice. A one-way hash keeps
 * the grouping without the address: same email ⇒ same token, and the token says nothing.
 */
function familyKeyFor(guardianEmail: string | null | undefined): string | null {
  const email = normalizeGuardianEmail(guardianEmail);
  return email ? createHash('sha256').update(email).digest('hex').slice(0, 16) : null;
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
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const [rosterPlayers, schedules, allPayments, allPayouts] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepPlayerDuesSchedules(programYear.id),
    getRepDuesPaymentsByProgramYear(programYear.id),
    getRepDuesPayoutsByProgramYear(programYear.id),
  ]);
  // Cash already handed back (mig 234): those dollars are settled, so they stop lowering bills.
  // One grouping; each player's total comes off their own rows at the point of use.
  const payoutsByPlayer = groupByPlayer(allPayouts);

  const scheduleMap = new Map(schedules.map(s => [s.playerId, s]));

  // ONE batched query for the whole roster's installments (the per-schedule helper here was a
  // 12–20-query N+1 — the same batched helper the digest and Ask already use).
  const allInstallments = await getRepDuesInstallmentsBySchedules(schedules.map(s => s.id));
  const installmentsBySchedule = new Map<string, typeof allInstallments>();
  for (const i of allInstallments) {
    if (!installmentsBySchedule.has(i.scheduleId)) installmentsBySchedule.set(i.scheduleId, []);
    installmentsBySchedule.get(i.scheduleId)!.push(i);
  }

  const paymentsMap = new Map<string, typeof allPayments>();
  for (const p of allPayments) {
    if (!paymentsMap.has(p.playerId)) paymentsMap.set(p.playerId, []);
    paymentsMap.get(p.playerId)!.push(p);
  }

  // Fetch all credits for this program year in one query
  const { data: allCredits } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('*')
    .eq('program_year_id', programYear.id)
    .order('credit_date', { ascending: false });

  const creditsMap = new Map<string, Array<Record<string, unknown>>>();
  for (const c of (allCredits ?? []) as Array<Record<string, unknown>>) {
    const pid = c.player_id as string;
    if (!creditsMap.has(pid)) creditsMap.set(pid, []);
    creditsMap.get(pid)!.push(c);
  }

  /* ⚠ WHAT EACH CREDIT HAS ALREADY HAD PAID BACK (mig 281). The Pay out sheet ticks whole debts, so
     it needs to know which ones are still standing — and a credit part-settled by a PRE-281 payout
     shows only what is left. A credit missing from this map has had nothing LINKED to it, which is
     not the same as nothing paid back: a legacy payout settled something and says nothing about
     what. `payableNow` remains the family-level ceiling and is unchanged. */
  const paidBackByCredit = await getRepDuesPaidBackByCredit(programYear.id);

  const playersWithDues = await Promise.all(
    rosterPlayers.map(async p => {
      const schedule = scheduleMap.get(p.id) ?? null;
      const installments = schedule ? (installmentsBySchedule.get(schedule.id) ?? []) : [];
      const payments = paymentsMap.get(p.id) ?? [];
      const paymentsTotal = payments.reduce((s, pay) => s + pay.amount, 0);
      // Paid = recorded payment FACTS (mig 232), capped at the schedule total — the auto-created
      // overpayment credit already carries the excess, and counting it twice would push a family
      // "In credit" twice over. The stamps on installments are only a projection of coverage.
      const cappedPaid = schedule ? duesPaidAmount(paymentsTotal, schedule.totalAmount) : 0;
      // ONE shared definition (lib/dues-status.ts) — this figure is also quoted by the weekly
      // digest and by an Ask the Front Office answer, and three hand-copies each promised in a
      // comment that they matched, with nothing enforcing it.
      const outstanding = outstandingForSchedule(schedule, cappedPaid);
      // Per-installment coverage for the drawer's "$200.00 of $300.00" chips, plus the credit
      // position over the remainders — ONE assembly (lib/dues-credits.ts deriveDuesPosition),
      // shared with every other dues reader so they cannot drift.

      const rawCredits = creditsMap.get(p.id) ?? [];
      const credits = rawCredits.map(c => ({
        id:          c.id,
        programYearId: c.program_year_id,
        playerId:    c.player_id,
        amount:      c.amount,
        description: c.description,
        creditDate:  c.credit_date,
        creditType:  c.credit_type,
        notes:       c.notes ?? null,
        paymentId:   c.payment_id ?? null,
        // ⚠ THE DRAWER'S NO-PENCIL/NO-TRASH GATE READS THESE (QA §118 A2). Dropping them here
        // starved the row of the fact that another record authored it, so every sourced credit
        // rendered live edit/delete buttons — and the delete route had no refusal behind them.
        fundraiserEntryId: c.fundraiser_entry_id ?? null,
        expenseId:   c.expense_id ?? null,
        createdAt:   c.created_at,
        /* What earlier paybacks have already settled off THIS credit (mig 281). Drives the Pay out
           sheet's tick-list; 0 for every credit nothing points at, which includes every credit a
           pre-281 payout touched. */
        paidBack:    paidBackByCredit.get(c.id as string) ?? 0,
      }));
      // ONE credit definition (lib/dues-credits.ts) — one of five hand-copied credit sums.
      const creditsIssuedTotal = creditsTotal(credits.map(c => ({ amount: c.amount as number })));

      // Credits land on bills (owner model 2026-08-14): derived over the CASH remainders, in the
      // team's chosen direction. Cash always claims a bill before a credit does — recompute after
      // any payment/credit/schedule change and the answer is simply true again.
      const { coverage, position } = deriveDuesPosition({
        installments: schedule ? installments : [],
        payments,
        credits: credits.map(c => ({
          id: c.id as string,
          amount: c.amount as number,
          creditType: c.creditType as string,
          creditDate: c.creditDate as string,
          createdAt: (c.createdAt as string | null) ?? null,
          description: (c.description as string | null) ?? null,
        })),
        paidOut: amountsTotal(payoutsByPlayer.get(p.id) ?? []),
        mode: programYear.creditApplication,
      });
      const creditCoverageById = new Map(position.perInstallment.map(c => [c.installmentId, c]));

      // ⚠ A CREDIT HANDED BACK IN CASH NO LONGER REDUCES WHAT THIS FAMILY OWES. The Credits
      // column, the Balance column, the drawer stat, the season-totals footer and the dues export
      // all read these two figures, and showing the GROSS credit after a payout tells a coach a
      // family's dues are lowered by money they have already been given (/review 2026-08-14).
      const netCredits = Math.max(0, Math.round((creditsIssuedTotal - position.paidOut) * 100) / 100);

      /* ⚠⚠ A FAMILY'S OWN MONEY LEAVES THE CREDITS COLUMN (owner ruling 2026-09-06, QA §146 · D6).
         `Credits` now means what someone OTHER than this family covered; `Paid` shows what the
         family actually sent. The full reasoning — and the reason this is a RE-SPLIT of one total
         rather than two new sums — lives on `splitFamilyOwnMoney`. Read it before touching either
         figure: the balance below is unchanged BY CONSTRUCTION, and that is the whole point. */
      const own = splitFamilyOwnMoney({
        cappedPaid,
        netCredits,
        overpaymentCredits: creditsTotal(
          credits.filter(c => c.creditType === 'overpayment').map(c => ({ amount: c.amount as number })),
        ),
        paidOut: position.paidOut,
      });
      const paidAmount  = own.paid;
      const totalCredits = own.credits;
      /* The family's own money the team is still holding. Drives the "Overpaid" wording, which is
         NOT the same fact as a negative balance: a family can be in credit purely because a sponsor
         covered their dues, and calling that overpaid would be a lie about where the money came
         from. Casey on the QA fixture is exactly that case. */
      const ownMoneyHeld = own.ownMoneyHeld;

      /* ⚠⚠ THE DUES LADDER (owner ruling 2026-09-07, out of the QA §148 walk) — the five figures the
         table and the drawer now read left to right. GROSS on purpose: `netCredits` and `cappedPaid`
         above quietly absorb payouts, which is invisible while one column holds everything and a lie
         the moment the columns are named (Blake's $150 Bottle Drive rebate would read $50; Casey's
         $1,200 reads $900). The full story, and the proof that these still sum to `rollingBalance`
         untouched, lives on `splitDuesLadder`. Read it before changing any of the five. */
      const ladder = splitDuesLadder({
        dues: schedule?.totalAmount ?? 0,
        grossPayments: amountsTotal(payments),
        cappedPaid,
        creditsIssued: creditsIssuedTotal,
        fundraiserIssued: creditsTotal(
          credits.filter(c => c.creditType === 'fundraiser').map(c => ({ amount: c.amount as number })),
        ),
        /* ⚠⚠ EVERY OVERPAYMENT CREDIT, NOT A NARROWED SET — the first cut narrowed this to the
           engine's schedule row plus receipt-linked rows and was wrong within the hour: Umar holds
           a $50 overpayment credit with no payment link (it predates linking) and his family really
           did send $50 over, so the link test filed his own money under Other credits and the ladder
           came out $50 wrong. How many of these dollars are the family's own is ARITHMETIC — the
           clamp in `splitDuesLadder` — and the drawer hides rows by that amount (`hiddenOwnMoneyIds`),
           so the tile and the rows beneath it agree by construction rather than by two predicates
           happening to match. A coach-typed overpayment with no payment behind it still lands under
           Other credits, counted, because the clamp leaves it there. */
        overpaymentIssued: creditsTotal(
          credits.filter(c => c.creditType === 'overpayment').map(c => ({ amount: c.amount as number })),
        ),
        paidOut: position.paidOut,
      });

      /* ⚠⚠ THE BALANCE SUBTRACTS `netCredits`, NOT THE NARROWED `totalCredits`, AND THAT DISTINCTION
         IS THE WHOLE RE-SPLIT. `outstanding` is built from `cappedPaid`, so pairing it with the
         narrowed credit figure double-counts the money that just moved into `paidAmount`.

         ⚠ THIS WAS A REAL DEFECT IN THIS BUILD, caught on the rendered screen and by nothing else:
         Avery's balance read ($578.15) instead of ($1,128.15) — the one number D6 promised not to
         move. A type could not see it and neither could the unit test, because the helper's
         invariant is about `paid + credits` and this line was quietly using a different pair.

         (cappedPaid, netCredits) is the BALANCE's pair, and always was. (paidAmount, totalCredits)
         is what a coach READS. They sum to the same total by construction — see
         `splitFamilyOwnMoney` — which is exactly why both can be true at once. */
      const rollingBalance = Math.round((outstanding - netCredits) * 100) / 100;

      // ⚠ `remainingAmount` is the NET figure since Pass 1 of the credit model — the cash
      // remainder MINUS credits applied: what the family is actually asked to send. Every
      // downstream quoting surface (Insights dues line, digest, By-installment lens) reads this
      // field precisely so "the figure reminders chase" changes in one place. The raw cash
      // remainder stays available per installment in `coverage`.
      const installmentsOut = installments.map(i => {
        const cc = creditCoverageById.get(i.id);
        return {
          ...i,
          remainingAmount: cc?.toSend ?? i.amount,
          creditApplied: cc?.creditApplied ?? 0,
          // Settled by the server's own definition — the UI must never re-derive this predicate
          // (it branches the status pill; a client-side threshold would silently drift).
          creditSettled: cc?.settled ?? false,
          creditSources: cc?.sources ?? [],
        };
      });

      return {
        // Money access and guardian-PII access are independent grants — redact PII/notes for a
        // money-cleared coach who lacks the PII grant (the dues table shows a guardian identifier).
        player: redactRosterPlayer(p, capabilities),
        // Read from the UNredacted row, deliberately: the statement's sibling grouping must
        // survive the PII redaction above, and the hash is what makes that safe.
        familyKey: familyKeyFor(p.guardianEmail),
        schedule,
        installments: installmentsOut,
        payments,
        coverage,
        paidAmount,
        outstanding,
        credits,
        totalCredits: Math.round(totalCredits * 100) / 100,
        ownMoneyHeld,
        // The ladder the table and drawer read left to right (see splitDuesLadder).
        ladder,
        rollingBalance,
        // The three-state position (owner model 2026-08-14): what credits did, per player.
        leftToSend: position.leftToSend,
        creditApplied: Math.round((position.applied + position.forgivenApplied) * 100) / 100,
        owedBack: position.owedBack,
        // The outbox (mig 234): what has been handed back, and what still could be.
        payouts: payoutsByPlayer.get(p.id) ?? [],
        paidOut: position.paidOut,
        // ⚠ PAYABLE ≠ OWED-BACK. A credit sitting ON a bill can still be handed over in cash —
        // the bill simply goes back up (binding mockup §5: Riley's $500 is applied to #4 and the
        // sheet still pays it out). Gating the button on owedBack would hide it in exactly the
        // case the mockup draws. Forgiveness is excluded: never the family's money.
        payableNow: payoutCeiling(
          credits.map(c => ({ amount: c.amount as number, creditType: c.creditType as string })),
          payoutsByPlayer.get(p.id) ?? [],
        ),
      };
    }),
  );

  return NextResponse.json({ players: playersWithDues, creditApplication: programYear.creditApplication });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { playerId, totalAmount, notes = null, installments } = body;

  if (!playerId || typeof totalAmount !== 'number' || totalAmount <= 0) {
    return NextResponse.json({ error: 'playerId and totalAmount > 0 are required' }, { status: 400 });
  }
  if (!Array.isArray(installments) || !installments.length) {
    return NextResponse.json({ error: 'At least one installment is required' }, { status: 400 });
  }

  const installmentSum = installments.reduce((s: number, i: any) => s + Number(i.amount), 0);
  if (Math.abs(installmentSum - totalAmount) > 0.01) {
    return NextResponse.json(
      { error: `Installment amounts (${installmentSum}) must sum to totalAmount (${totalAmount})` },
      { status: 400 },
    );
  }

  /* The player must belong to THIS season — the same membership check the payment POST has
     always made, and this door was the one dues write missing it (/review 2026-08-30, Medium):
     without it a foreign or stale player id sailed past every scoped read below (they all just
     return empty for it) and the upsert stamped this team's org/team onto another team's player. */
  const { data: playerRow } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id')
    .eq('id', playerId)
    .eq('program_year_id', programYear.id)
    .single();
  if (!playerRow) {
    return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });
  }

  /* ⚠⚠ THE PAYOUT FLOOR, ASKED PRE-FLIGHT (QA §123 Phase A2) — before the upsert, never after.
     Raising a paid-up family's total makes the reconcile below delete the overpayment credit any
     cash already handed back was standing on, and the books would then say the family was owed
     nothing. This door and the bulk re-run are doors 5 and 6 in lib/dues-credit-guards.ts's list;
     the P4 lesson is binding — a guard that refuses after an irreversible write strands the
     record forever. Payments are fetched here (not after the write, as before) so the projection
     and the post-write reconcile read the same rows.
     ⚠ Pre-flight is the STRUCTURE, not a transaction: a payout committed between this read and
     the reconcile below slips the floor — the same documented guard-to-write window doors 1–4
     accept (no route here gets a transaction), self-healing on the next write to this player's
     credits. What this check closes is every non-raced path, which before it was ALL of them. */
  const [playerPayments, playerPayouts] = await Promise.all([
    getRepDuesPaymentsForPlayer(programYear.id, playerId),
    getRepDuesPayoutsForPlayer(programYear.id, playerId),
  ]);
  const paymentsTotal = amountsTotal(playerPayments);
  if (playerPayouts.length > 0) {
    const familyCredits = await getRepDuesCreditsForPlayer(programYear.id, playerId);
    const projected = projectScheduleTotalChange({ familyCredits, paymentsTotal, newScheduleTotal: totalAmount });
    const violation = payoutFloorViolation(projected, playerPayouts);
    if (violation) {
      return NextResponse.json(
        {
          error: payoutFloorMessage(violation.paidOut, "raising this player's dues total"),
          code: CREDIT_HAS_PAYOUT,
        },
        { status: 409 },
      );
    }
  }

  const result = await upsertRepPlayerDuesSchedule({
    programYearId: programYear.id,
    playerId,
    teamId: team.id,
    orgId: team.orgId,
    totalAmount,
    notes,
    installments: installments.map((i: any, idx: number) => ({
      installmentNumber: i.installmentNumber ?? idx + 1,
      amount: Number(i.amount),
      dueDate: i.dueDate,
    })),
  });

  // The plan changed under recorded money (mig 232): re-project coverage onto the fresh rows,
  // and reconcile the automatic overpayment credit BOTH ways — before this, editing one player's
  // total below what their family had sent silently capped the difference out of every figure
  // (review 2026-08-13, Critical 2), and only the bulk path did any of this.
  // ⚠ The payments are RE-READ here, never the pre-flight's snapshot (peer review 2026-08-30):
  // the floor's read above happens before the upsert, and a payment recorded in that window
  // would be invisible to a reconcile fed the stale total — the credit would come out short.
  // Same check-then-act discipline as every coach-money write; the extra read costs one query
  // on the paid-player path only.
  if (playerPayments.length > 0) {
    await syncDuesPaidProjection(programYear.id, playerId);
    const freshPayments = await getRepDuesPaymentsForPlayer(programYear.id, playerId);
    await reconcileOverpaymentCredits({
      programYearId: programYear.id,
      playerId,
      scheduleTotal: totalAmount,
      paymentsTotal: amountsTotal(freshPayments),
      creditDate: tournamentToday(),
      createdBy: resolved.ctx!.user.id,
      paymentId: null,
    });
  }

  return NextResponse.json(result, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues' });
