import { NextResponse } from 'next/server';
import { futureReceivedDateRefusal } from '@/lib/money-date-guards';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamMoneyIn,
  createRepTeamMoneyIn,
  getDerivedIncomeClaims,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney, canWriteMoney } from '@/lib/coach-capabilities';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { resolveBudgetItem } from '@/lib/coach-budget-items';
import { derivedIncomeKeys, whyIncomeIsRefused } from '@/lib/coach-money-derived';
import { MONEY_IN_KINDS, MONEY_IN_SOURCES } from '@/lib/coach-money-in';
import type { MoneyInKind, MoneyInSource } from '@/lib/types';

// GET  /api/coaches/[orgSlug]/teams/[teamId]/money-in   — a season's arrivals
// POST /api/coaches/[orgSlug]/teams/[teamId]/money-in   — record one
//
// ⚠⚠ TWO KINDS, AND ONLY THE COACH CAN TELL THEM APART (mig 243). `income` is revenue and gets its
// own report row; `money_back` is a refund, credit or reimbursement that NETS into the row it
// repaid and is never counted as income. A club grant and a club reimbursement arrive as the same
// amount, from the same club, on the same day — nothing here can infer which, which is why the
// form asks outright.
//
// ⚠⚠ NEITHER KIND EVER TOUCHES A PAYMENT SCHEDULE. Not a dollar of anyone's dues (owner correction
// 2026-08-15). A coach who receives extra money usually spends it on extra things; passing it on is
// a deliberate edit on the screen that owns dues. Nothing in this file writes rep_dues_*, and
// `receivedFrom: 'family'` is a label, not a credit — the credit mechanism is out-of-pocket
// spending (rep_team_expenses.paid_by_player_id), which is the opposite event.

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

  const [moneyIn, claims] = await Promise.all([
    getRepTeamMoneyIn(programYear.id),
    getDerivedIncomeClaims(programYear.id),
  ]);
  const derivedKeys = derivedIncomeKeys(claims);
  /* The closed rows travel WITH the list so the form can grey them and say why, rather than
     letting a coach fill in a whole record and meet a refusal at save time. The server refuses
     regardless — this is the courtesy, not the guard. */
  return NextResponse.json({ moneyIn, derivedKeys: [...derivedKeys] });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/money-in' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const {
    kind, amount, receivedDate,
    budgetItemId = null, description = null, notes = null, receivedFrom = null,
  } = body;

  if (!MONEY_IN_KINDS.includes(kind as MoneyInKind)) {
    return NextResponse.json({ error: 'kind must be "income" or "money_back"' }, { status: 400 });
  }
  /* ⚠ POSITIVE, ON BOTH KINDS. The kind carries the sign, never the amount (mig 230's rule). A
     negative money-back amount would silently ADD to the row it was supposed to reduce. */
  if (typeof amount !== 'number' || !(amount > 0)) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (typeof receivedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
    return NextResponse.json({ error: 'receivedDate must be a date (YYYY-MM-DD)' }, { status: 400 });
  }
  /* ⚠⚠ AND IT CANNOT BE AHEAD OF TODAY (owner-raised 2026-08-30, money-date consistency). This
     route checked the date's SHAPE and never its position, so income and money-back could be
     dated next March while every other money-in door refused it — and the form's own picker
     stopped nobody, because the cap lived only in the form. Money that has not arrived is not
     income: it is a pledge, a bill, or a schedule, all of which have their own home. Same sentence
     the client shows, from the same map, so the two can never drift. */
  const futureRefusal = futureReceivedDateRefusal(receivedDate, kind === 'money_back' ? 'money back' : 'income');
  if (futureRefusal) {
    return NextResponse.json({ error: futureRefusal }, { status: 400 });
  }
  if (receivedFrom !== null && !MONEY_IN_SOURCES.includes(receivedFrom as MoneyInSource)) {
    return NextResponse.json({ error: 'receivedFrom must be one of: club, vendor, sponsor, family, other' }, { status: 400 });
  }

  /* What this IS, in the shared taxonomy (mig 240) — validated against the vocabulary THIS team can
     see, with the category derived from the item so the two levels can never disagree about one row.
     ⚠ REQUIRED, exactly as it is on a cost: an unclassified arrival lands in the "Not itemized"
     bucket this whole change exists to empty. */
  const linked = await resolveBudgetItem(budgetItemId, ctx!.org.id, team.id, team.sport);
  if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 400 });
  if (!linked.item) {
    return NextResponse.json(
      {
        error: kind === 'money_back'
          ? 'Pick what this is paying you back for — it is what lets the refund reduce the right row.'
          : 'Pick a category and item — they line this up with your budget.',
      },
      { status: 400 },
    );
  }

  /* ⚠⚠ ONE ROW, ONE SOURCE (§4.1). A row whose actual already comes from a fundraiser or a sponsor
     cannot also accept a typed one — player rebates are computed off those figures, so the same
     dollar counted twice reaches a family's dues, not just a report.
     ⚠ MONEY BACK IS EXEMPT and must be: a tournament really can refund a registration the team
     took, and refusing it would leave the coach no way to record a real event. A refund reduces the
     row rather than being a second source for it. */
  if (kind === 'income') {
    const refusal = whyIncomeIsRefused(await getDerivedIncomeClaims(programYear.id), linked.item);
    if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });
  }

  const record = await createRepTeamMoneyIn({
    programYearId: programYear.id,
    teamId: team.id,
    orgId: ctx!.org.id,
    kind: kind as MoneyInKind,
    amount,
    receivedDate,
    budgetItemId: linked.item.id,
    budgetCategoryId: linked.item.categoryId,
    description: typeof description === 'string' ? (description.trim() || null) : null,
    notes: typeof notes === 'string' ? (notes.trim() || null) : null,
    // Only meaningful on a refund; an income record has no "who paid it back".
    receivedFrom: kind === 'money_back' ? (receivedFrom as MoneyInSource | null) : null,
    createdBy: ctx!.user.id,
  }, { id: team.id, orgId: ctx!.org.id, name: team.name }, linked.item.name);

  return NextResponse.json({ moneyIn: record }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/money-in' });
