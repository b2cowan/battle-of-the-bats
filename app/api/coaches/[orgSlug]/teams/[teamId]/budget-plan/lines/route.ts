import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { BUDGET_LINE_KINDS, type BudgetLineKind } from '@/lib/coach-budget-totals';
import { resolveBudgetItem } from '@/lib/coach-budget-items';

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

// POST /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines
// Adds a new estimated cost line to the team's budget plan.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();

  const description: string = typeof body.description === 'string' ? body.description.trim() : '';
  const totalAmount: number = Number(body.totalAmount);
  const itemId:     string | null = body.itemId     || null;
  const notes:      string | null = body.notes?.trim() || null;
  // Absent = cost, which is what every line was before migration 230. Only the two known kinds
  // are accepted; the DB CHECK would reject anything else, but a 400 explains it.
  const lineKind: string = body.lineKind === undefined ? 'cost' : String(body.lineKind);

  /* ⚠ EVERY LINE IS NAMED BY ITS ITEM NOW, IN BOTH DIRECTIONS (mig 243, plan §3.2).
     Until this release a money-in line carried no category and no item — the 2026-08-13 ruling
     that "a spending taxonomy has nothing to say about a bottle drive" was read as "money in needs
     its own list", and it does not: a coach can already create categories and items, so the SAME
     picker, the same three ownership tiers and the same sport rail serve both directions. A second
     list would have meant two pickers, two rollups, and still no way to put a hosted tournament's
     revenue next to its costs.
     ⚠ NO BACKFILL. Lines written before this keep their typed description and no taxonomy at all,
     and report in the "No category / Not itemized" bucket the rollup already has. A coach re-files
     one by editing it; guessing which category their "Riverdale Auto" sponsorship belongs to would
     be confident-and-wrong data.
     The description stays optional-but-stored for both: the column is NOT NULL, and a line whose
     item was later deleted still has something true to show. It is never a grouping key. */
  if (description.length > 200) {
    return NextResponse.json({ error: 'description must be 200 characters or fewer' }, { status: 400 });
  }
  if (isNaN(totalAmount) || totalAmount <= 0) {
    // Positive for BOTH kinds: expected funding is stored positive and displayed negative, so
    // the sign lives in one place (the kind) and never in the data.
    return NextResponse.json({ error: 'totalAmount must be a positive number' }, { status: 400 });
  }
  if (!BUDGET_LINE_KINDS.includes(lineKind as BudgetLineKind)) {
    return NextResponse.json({ error: 'lineKind must be one of: cost, funding, sponsorship' }, { status: 400 });
  }

  /* The item must be one THIS TEAM can see — platform, club-published, or its own (mig 240). The
     category is derived from it rather than accepted from the request: an item belongs to exactly
     one category, so trusting both would let a caller file a line under a category its own item
     does not live in, and the report's two levels would disagree about the same row. Same lesson as
     the ownership gap hardened during the Chunk G review, one tier deeper. */
  let categoryId: string | null = null;
  let itemName: string | null = null;
  if (!itemId) {
    return NextResponse.json(
      { error: 'Pick a category and item — they name this line on your plan and on Budget vs. Actual.' },
      { status: 400 },
    );
  }
  const linked = await resolveBudgetItem(itemId, ctx!.org.id, team.id, team.sport);
  if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 400 });
  categoryId = linked.item!.categoryId;
  itemName   = linked.item!.name;

  const { data, error } = await supabaseAdmin
    .from('rep_budget_lines')
    .insert({
      org_id:          ctx!.org.id,
      team_id:         team.id,
      program_year_id: programYear.id,
      category_id:     categoryId,
      item_id:         itemId,
      // NOT NULL in the database, and no longer a name in either direction: the item's own name is
      // stored so anything reading the column raw still shows something true.
      description:     description || itemName || '',
      total_amount:    totalAmount,
      line_kind:       lineKind,
      notes,
    })
    .select('*, rep_budget_periods(*), budget_categories(name), budget_items(name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ line: data }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines' });
