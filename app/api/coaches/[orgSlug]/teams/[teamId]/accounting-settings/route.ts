import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getSeasonName,
  setAutoRemindersEnabled,
  setCreditApplicationMode,
  setDefaultPlayerCreditPercent,
  setSeasonOpeningBalance,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { CREDIT_APPLICATION_MODES, type CreditApplicationMode } from '@/lib/dues-credits';

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

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  return NextResponse.json({
    autoRemindersEnabled: programYear.autoRemindersEnabled,
    creditApplication: programYear.creditApplication,
    defaultPlayerCreditPercent: programYear.defaultPlayerCreditPercent,
    /* ⚠ NULL TRAVELS AS NULL (mig 262). "Nothing was carried" and "we opened at zero" are the same
       number and different facts, and the settings row says different things about them. */
    openingBalance: programYear.openingBalance,
    /** The season it was carried from, so the row can explain itself without a second request. */
    openingBalanceFrom: await getSeasonName(programYear.openingBalanceFromYearId),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/accounting-settings' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));

  const hasReminders = typeof body.autoRemindersEnabled === 'boolean';
  const hasCreditMode = typeof body.creditApplication === 'string';
  const hasDefaultCredit = body.defaultPlayerCreditPercent !== undefined;
  const hasOpening = body.openingBalance !== undefined;
  if (!hasReminders && !hasCreditMode && !hasDefaultCredit && !hasOpening) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (hasOpening) {
    /* ⚠⚠ THIS ONE MOVES CASH ON HAND (mig 262), which is what makes it different from every other
       setting on this route. Explicit `null` CLEARS it — the row disappears from the register and
       the report rather than reading $0.00, because a season that carried nothing should say
       nothing about it.

       ⚠ AND THE PROVENANCE IS DROPPED ON A HAND EDIT, deliberately. Once a coach has changed the
       figure, "Carried from the 2026 Season when this one was started" is no longer true of the
       number on screen, and a provenance line that outlives the value it describes is worse than
       none: it is a sentence vouching for a figure nobody carried.

       ⚠ NOTHING IS VALIDATED AGAINST LAST SEASON'S CLOSE. A coach correcting a handoff knows
       something the product cannot see — they settled up in cash, they forgave a balance — which is
       the same reason unsettled money WARNS and never blocks. */
    if (body.openingBalance === null) {
      await setSeasonOpeningBalance(programYear.id, null, null);
    } else {
      const amount = Number(body.openingBalance);
      if (!Number.isFinite(amount) || Math.abs(amount) > 100_000_000) {
        return NextResponse.json({ error: 'Enter the money the team was holding when this season started.' }, { status: 400 });
      }
      await setSeasonOpeningBalance(programYear.id, Math.round(amount * 100) / 100, null);
    }
  }
  if (hasDefaultCredit) {
    const pct = Number(body.defaultPlayerCreditPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'Default player credit must be between 0 and 100.' }, { status: 400 });
    }
    // ⚠ Forward-looking ONLY. This seeds the next new-fundraiser/new-sponsor form; nothing already
    // recorded is touched, because every logged entry snapshots its own rate. A write that reached
    // back would change what families had already been told they owe.
    await setDefaultPlayerCreditPercent(programYear.id, pct);
  }
  if (hasReminders) {
    await setAutoRemindersEnabled(programYear.id, body.autoRemindersEnabled);
  }
  if (hasCreditMode) {
    // Strict, not normalized: a typo from a future client must be a 400, not a silent
    // fall-back to last_first that changes every family's reminder amounts.
    if (!CREDIT_APPLICATION_MODES.includes(body.creditApplication as CreditApplicationMode)) {
      return NextResponse.json({ error: 'Invalid credit application mode' }, { status: 400 });
    }
    await setCreditApplicationMode(programYear.id, body.creditApplication as CreditApplicationMode);
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/accounting-settings' });
