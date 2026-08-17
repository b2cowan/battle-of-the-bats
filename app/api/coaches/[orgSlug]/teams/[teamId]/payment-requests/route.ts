import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { resolveBudgetItem } from '@/lib/coach-budget-items';
import { mapClubRequest } from '@/lib/coach-club-money';
import { withObservability, captureAndJson } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

/**
 * What this team has asked its club for, in the season on screen.
 *
 * ⚠⚠ SEASON-SCOPED SINCE 2026-08-17 (money redesign P4), AND THIS LIST WAS THE LAST HOLD-OUT.
 * Migration 247 gave a request a season and every *cash figure* started reading it, but P3 left the
 * LIST team-lifetime on purpose — so a request raised last season and never answered could not
 * silently vanish. Owner ruling at the P4 mockup review overturned that: *"our default for all data
 * is it is independent on each season and only brought into view on a case by case basis, so default
 * to not show anything from past seasons."* The hole that holding decision was protecting is closed
 * at the other end instead — an unanswered request now blocks the season close-out, beside the
 * families who still owe (`lib/coach-season-settlement.ts`).
 *
 * ⚠ AND A FINISHED SEASON STILL ANSWERS. `resolveCoachTeamRead` admits a season that has ended;
 * these are records of money that moved and of decisions the club made, so between seasons they
 * render in place, read-only. The old resolver 404'd, which is why the tab disappeared entirely.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear, isReadOnly } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const status = new URL(req.url).searchParams.get('status') ?? undefined;

  /* ⚠ THE FILING'S WORDS RIDE THE SELECT (`/simplify`, 2026-08-17). This used to collect the ids and
     fire a second wave against `budget_items` + `budget_categories` — the same block the allocations
     route and the report had each written out separately. One round trip, and one way to turn an
     item id into a word. */
  let query = supabaseAdmin
    .from('rep_team_payment_requests')
    .select('*, budget_items(name), budget_categories(name)')
    .eq('team_id', teamId)
    .eq('program_year_id', programYear.id)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return captureAndJson(error, { error: error.message }, 500);

  return NextResponse.json({
    requests: ((data ?? []) as Array<Record<string, any>>).map(r => mapClubRequest(r, {
      item:     (r.budget_items?.name as string) ?? null,
      category: (r.budget_categories?.name as string) ?? null,
    })),
    isReadOnly,
    programYearName: programYear.name,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-requests' });

/**
 * File a new request with the club.
 *
 * ⚠ `resolveLiveCoachTeamContext` — a write addresses a LIVE season. Between seasons this returns
 * 404 with "No active program year for this team", and the merged panel no longer offers the form
 * at all (owner ruling 5, 2026-08-17): the old panel offered it, the server refused with a database
 * error, and Owner QA §46 §I recorded the mismatch. The button is gone and the door is still shut.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const {
    requestType,
    amount,
    description,
    paymentMethod = null,
    notes = null,
    budgetLineId = null,
  } = body;

  if (!['payment_to_org', 'charge_to_org'].includes(requestType)) {
    return NextResponse.json({ error: 'requestType must be payment_to_org or charge_to_org' }, { status: 400 });
  }
  if (typeof amount !== 'number' || amount <= 0 || amount > 999999.99) {
    return NextResponse.json({ error: 'amount must be a positive number no greater than 999999.99' }, { status: 400 });
  }
  if (!description?.trim() || description.trim().length > 500) {
    return NextResponse.json({ error: 'description is required and must be 500 characters or fewer' }, { status: 400 });
  }

  /* ⚠⚠ WHAT THIS REQUEST IS FOR (mig 250). Without it, an approved request reached NO part of Budget
     vs. Actual — the report reads neither this table nor the allocations, so on a club-run team the
     largest line of the season was missing from the screen that compares spending to plan.

     ⚠ The category is DERIVED from the item, never taken from the caller: an item belongs to exactly
     one category, and the report reads the two levels in different orders. */
  const item = await resolveBudgetItem(body?.budgetItemId, ctx.org.id, teamId, team.sport);
  if (!item.ok) return NextResponse.json({ error: item.error }, { status: 400 });

  /* ⚠ A REQUEST BELONGS TO A SEASON (mig 247, NOT NULL) — resolved above rather than looked up
     again here, because the live-season resolver is what already refused a team between seasons. */
  const { data, error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .insert({
      org_id:          team.orgId,
      team_id:         team.id,
      program_year_id: programYear.id,
      request_type:    requestType,
      amount,
      description:     description.trim(),
      payment_method:  paymentMethod?.trim() || null,
      notes:           notes?.trim() || null,
      budget_line_id:  budgetLineId || null,
      budget_item_id:     item.item?.id ?? null,
      budget_category_id: item.item?.categoryId ?? null,
      created_by:      ctx.user.id,
    })
    .select()
    .single();

  if (error) return captureAndJson(error, { error: error.message }, 500);

  return NextResponse.json({
    request: mapClubRequest(data, { item: item.item?.name ?? null, category: item.item?.categoryName ?? null }),
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-requests' });
