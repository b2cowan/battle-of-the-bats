import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  recordRepDuesPayout,
  getRepDuesCreditsForPlayer,
  getRepDuesPaidBackByCredit,
  getRepDuesPayoutsForPlayer,
  PayoutExceedsOwedError,
  PaybackAlreadyLinkedError,
} from '@/lib/db';
import { settledPerCredit, type DuesCreditKind } from '@/lib/coach-dues-actual';
import { amountsTotal } from '@/lib/dues-credits';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';
import { selectPayback } from '@/lib/dues-payback-selection';
import { DUES_PAYMENT_METHODS } from '@/lib/types';

// ⚠ ACTIVE YEAR ONLY, deliberately (plan §10): this resolves the team's live season and cannot
// address a past one. Money moves; an archived season is a record, and the refund sheet renders
// there with no payout controls at all.
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

/* ⚠ THE SHARED LIST, not a local copy (mig 260). This route carried its own four-token array,
   which is exactly the drift the list's own doc-comment warns about: 'card' joined the product's
   one method list on 2026-08-22, and a copy here would have refused what the recording form
   offers. Payments and payouts share the type, the list and the DB CHECK. */
const METHODS = DUES_PAYMENT_METHODS;

// POST /api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payouts
// Hand a family their credit back in cash (mig 234) — the mirror of recording a payment. Posts
// one money-out entry to the team ledger dated the day the money LEFT, and puts that family's
// bills back up: those dollars are settled now, so they stop lowering installments.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { amount, paidDate = tournamentToday(), method = 'etransfer', note = null, creditIds = null } = body;

  /* ⚠⚠ THE COACH SELECTS, THE SERVER SUMS (owner ruling R5, 2026-09-07; mig 281). When the sheet
     sends a tick-list, the AMOUNT is computed from it here and the client's figure is only ever a
     check — see `selectPayback`. The old free-amount shape is still accepted so the season
     settlement and any un-migrated caller keep working; what it cannot do any more is come from the
     Pay out sheet, which always sends the list. */
  let links: Array<{ creditId: string; amount: number }> | undefined;
  let payoutAmount = amount;

  if (creditIds !== null) {
    if (!Array.isArray(creditIds) || creditIds.some(id => typeof id !== 'string')) {
      return NextResponse.json({ error: 'creditIds must be an array of credit ids' }, { status: 400 });
    }
    const [credits, paidBack, payouts] = await Promise.all([
      getRepDuesCreditsForPlayer(programYear.id, playerId),
      getRepDuesPaidBackByCredit(programYear.id),
      getRepDuesPayoutsForPlayer(programYear.id, playerId),
    ]);
    /* ⚠⚠ THE SAME STANDING RULE THE TICK-LIST IS BUILT FROM, AND IT HAS TO BE (found on the UAT
       fixture 2026-09-09). A payback recorded before mig 281 settled something and says nothing
       about WHAT, so a credit it touched is not fully standing — the dues route spreads it
       (`settledPerCredit`) before offering the debt. This door read the LINKS alone, valued that
       same credit at its full issued amount, summed a payback the family is not owed, and then its
       own ceiling refused it. Measured: a $300.00 sponsorship share carrying a $200.00 unlinked
       payback offered $100.00 on screen and refused every single time it was ticked, so that
       family's remaining credit could not be handed back through any door in the product.
       **Two doors, one rule** — the sentence `payoutCeiling` and `selectPayback` already answer to;
       this door was the one saying it and not doing it. */
    const settled = settledPerCredit(
      credits.map(c => ({
        kind: c.creditType as DuesCreditKind,
        amount: c.amount,
        linkedPaidBack: paidBack.get(c.id) ?? 0,
        creditDate: c.creditDate,
        createdAt: c.createdAt,
      })),
      amountsTotal(payouts),
    );
    const chosen = selectPayback(
      credits.map((c, i) => ({
        id: c.id,
        amount: c.amount,
        creditType: c.creditType,
        alreadyPaidBack: settled[i],
      })),
      creditIds,
      typeof amount === 'number' ? amount : undefined,
    );
    if ('refused' in chosen) {
      return NextResponse.json({ error: chosen.refused.message, code: chosen.refused.code }, { status: 409 });
    }
    links = chosen.ok.links;
    payoutAmount = chosen.ok.amount;
  }

  if (typeof payoutAmount !== 'number' || !Number.isFinite(payoutAmount) || payoutAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (payoutAmount > 999999.99) {
    return NextResponse.json({ error: 'amount is too large' }, { status: 400 });
  }
  if (typeof paidDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
    return NextResponse.json({ error: 'paidDate must be a YYYY-MM-DD date' }, { status: 400 });
  }
  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
  }

  const { data: playerRow } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name')
    .eq('id', playerId)
    .eq('program_year_id', programYear.id)
    .single();
  if (!playerRow) {
    return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });
  }
  const playerName = [playerRow.player_first_name, playerRow.player_last_name].filter(Boolean).join(' ') || 'player';

  try {
    const result = await recordRepDuesPayout({
      team: { id: team.id, orgId: team.orgId, name: team.name },
      programYearId: programYear.id,
      playerId,
      playerName,
      amount: payoutAmount,
      creditLinks: links,
      paidDate,
      method,
      note: typeof note === 'string' ? note : null,
      createdBy: ctx!.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof PayoutExceedsOwedError) {
      // The ceiling rides the error — it is the figure the write actually refused against, so
      // the reason a coach reads is the reason it refused, with no second round-trip.
      const owed = e.owedBack;
      return NextResponse.json(
        {
          error: owed > 0.005
            ? `This family has $${owed.toFixed(2)} left in credit — you can't pay out more than that.`
            : 'This family has no credit left, so there is nothing to pay out.',
          code: 'PAYOUT_EXCEEDS_OWED',
          owedBack: owed,
        },
        { status: 409 },
      );
    }
    /* ⚠ A REFUSAL, NOT A CRASH (found by review, 2026-09-09). A credit may carry only ONE payback
       (mig 281's `(credit_id)` key), and this fix made a SECOND legitimate attempt reachable: a
       partial link can now land, and undoing the legacy payout that caused it re-opens the rest of
       that credit. The database said 23505, the route said 500, and the coach read the generic
       "Could not record the payout" beside cash that had already been correctly put back. The way
       out is real, so the sentence names it. */
    if (e instanceof PaybackAlreadyLinkedError) {
      return NextResponse.json(
        {
          error: 'One of those debts already has a payback recorded against it. Undo that payback '
            + 'first, then record one payment covering the whole of what is owed.',
          code: 'PAYBACK_ALREADY_LINKED',
        },
        { status: 409 },
      );
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payouts' });
