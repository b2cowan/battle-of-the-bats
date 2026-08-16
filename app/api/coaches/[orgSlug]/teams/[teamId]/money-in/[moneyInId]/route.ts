import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamMoneyInRecord,
  updateRepTeamMoneyIn,
  deleteRepTeamMoneyIn,
  getDerivedIncomeClaims,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { resolveBudgetItem } from '@/lib/coach-budget-items';
import { whyIncomeIsRefused } from '@/lib/coach-money-derived';
import { MONEY_IN_SOURCES } from '@/lib/coach-money-in';
import type { MoneyInSource } from '@/lib/types';

// PATCH / DELETE one money-in record (mig 243).
//
// ⚠ THE KIND IS NOT EDITABLE, and that is the same ruling the expense form already carries for
// expense-vs-payable. Income and money back are not two labels on one event: one adds a revenue
// row, the other reduces a row somewhere else, and flipping between them would move a figure
// across the report while leaving one posted ledger entry to describe both. Wrong kind? Delete it
// and add it again — the honest correction, and cheap, because Delete states its own consequence.
//
// ⚠ NOTHING ELSE IS LOCKED, unlike a paid expense — see `updateRepTeamMoneyIn`, which explains why
// (one entry, always linked, so a correction cannot leave the books ambiguous). In particular
// RE-FILING WHICH ITEM IT POINTS AT MOVES NO MONEY and must stay open: locking it would make
// delete-and-re-enter the only way to fix a label (money-back plan §6.6).

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

/**
 * Load the record and re-assert it belongs to THIS team and THIS season, in the same breath.
 *
 * ⚠ THE SEASON CHECK IS NOT DECORATION. `resolveCoachContext` resolves the team's ACTIVE year, and
 * a record addressed by id from an archived season would otherwise be editable through a live-season
 * door — the archive is opt-in and money is never one of the things it opens (CLAUDE.md ruling
 * 2026-08-01).
 */
async function loadOwnRecord(moneyInId: string, teamId: string, programYearId: string) {
  const record = await getRepTeamMoneyInRecord(moneyInId);
  if (!record || record.teamId !== teamId || record.programYearId !== programYearId) return null;
  return record;
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; moneyInId: string }> },) => {
  const { orgSlug, teamId, moneyInId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const record = await loadOwnRecord(moneyInId, teamId, programYear.id);
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

  const body = await req.json();
  const patch: Parameters<typeof updateRepTeamMoneyIn>[1] = {};

  if (body.amount !== undefined) {
    if (typeof body.amount !== 'number' || !(body.amount > 0)) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }
    patch.amount = body.amount;
  }
  if (body.receivedDate !== undefined) {
    if (typeof body.receivedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.receivedDate)) {
      return NextResponse.json({ error: 'receivedDate must be a date (YYYY-MM-DD)' }, { status: 400 });
    }
    patch.receivedDate = body.receivedDate;
  }
  if (body.description !== undefined) {
    patch.description = typeof body.description === 'string' ? (body.description.trim() || null) : null;
  }
  if (body.notes !== undefined) {
    patch.notes = typeof body.notes === 'string' ? (body.notes.trim() || null) : null;
  }
  if (body.receivedFrom !== undefined) {
    const from = body.receivedFrom;
    if (from !== null && !MONEY_IN_SOURCES.includes(from as MoneyInSource)) {
      return NextResponse.json({ error: 'receivedFrom must be one of: club, vendor, sponsor, family, other' }, { status: 400 });
    }
    // A stated fact about a refund; on an income record there is nothing it could mean.
    patch.receivedFrom = record.kind === 'money_back' ? (from as MoneyInSource | null) : null;
  }

  // Re-filing. The category is re-derived from the item so the two levels cannot disagree — the
  // same rule the create path applies, for the same reason.
  let itemName: string | null = null;
  if (body.budgetItemId !== undefined) {
    const linked = await resolveBudgetItem(body.budgetItemId, ctx!.org.id, teamId, team.sport);
    if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 400 });
    if (!linked.item) {
      return NextResponse.json({ error: 'Pick a category and item — this record has to point at one.' }, { status: 400 });
    }
    /* ⚠ ONE ROW, ONE SOURCE, ON THE WAY IN AND ON THE WAY ACROSS. Re-filing an income record onto a
       row the fundraisers already answer for double-counts it exactly as creating one there would;
       an edit door that skipped this check would be the way around the guard. Money back stays
       exempt — it reduces a row rather than being a second source for it. */
    if (record.kind === 'income') {
      const refusal = whyIncomeIsRefused(await getDerivedIncomeClaims(programYear.id), linked.item);
      if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });
    }
    patch.budgetItemId     = linked.item.id;
    patch.budgetCategoryId = linked.item.categoryId;
    itemName = linked.item.name;
  } else {
    // Unchanged item: the ledger entry still has to be re-described from it, so look up the name.
    const current = await resolveBudgetItem(record.budgetItemId, ctx!.org.id, teamId, team.sport);
    itemName = current.ok ? (current.item?.name ?? null) : null;
  }

  const updated = await updateRepTeamMoneyIn(
    record, patch, { id: team.id, orgId: ctx!.org.id, name: team.name }, itemName,
  );
  return NextResponse.json({ moneyIn: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/money-in/[moneyInId]' });

export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; moneyInId: string }> },) => {
  const { orgSlug, teamId, moneyInId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const record = await loadOwnRecord(moneyInId, teamId, programYear.id);
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

  /* Deleting money IN lowers cash on hand — the opposite direction from deleting an expense, and
     the confirmation the coach read before this said so in dollars (lib/coach-money-in.ts). */
  const { reversedAmount } = await deleteRepTeamMoneyIn(
    record, { id: team.id, orgId: ctx!.org.id, name: team.name },
  );
  return NextResponse.json({ ok: true, reversedAmount });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/money-in/[moneyInId]' });
