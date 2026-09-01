import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { resolveBudgetItem } from '@/lib/coach-budget-items';
import { mapClubRequest, resolveMoneyInMeaning } from '@/lib/coach-club-money';
import { withObservability, captureAndJson } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

/**
 * ⚠⚠ BOTH HANDLERS BELOW RESOLVE A **LIVE** SEASON (`/review`, security lens, 2026-08-17).
 *
 * They used to run a hand-rolled auth chain that resolved no program year at all — it checked who
 * the caller was and stopped there. Meanwhile the GET side of this same feature moved to
 * `resolveCoachTeamRead`, which deliberately ADMITS a finished season so the Club tab can render it
 * as a read-only record. That left the write doors open on history:
 *
 *   a coach files a request → it is never answered → the team rolls into a new season
 *   (`startNextRepSeason` marks the outgoing one `completed` and does NOT check for open club
 *   requests — only the settlement close-out does) → the old season is now read-only everywhere,
 *   the panel hides every control on it, and a direct PATCH or DELETE to this route still rewrote
 *   or deleted the record.
 *
 * The client computing `isReadOnly` was the only thing standing in the way, which is not a gate.
 * `resolveLiveCoachTeamContext` 404s between seasons, exactly as the sibling POST does.
 *
 * ⚠ AND THE SEASON IS RE-ASSERTED IN EVERY WHERE CLAUSE BELOW, because "a live season exists" is
 * not the same claim as "this record belongs to it": a request raised LAST season is still reachable
 * by id while a NEW season is live, and that is the same hole one step along.
 */

/**
 * PATCH /api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]
 *
 * Correct a request the club has NOT yet looked at (owner ruling 2026-08-15). Until this existed
 * the only recovery from a typo was to withdraw the request and type the whole thing again —
 * while the office may already have been reading it.
 *
 * ⚠ PENDING ONLY, AND THE SERVER IS WHERE THAT IS DECIDED. An approved request has already moved
 * money between the team's and the org's books, and a declined one carries a written reason that
 * answers what it said at the time; letting either be edited would rewrite the thing the club
 * acted on. The panel hides the fields too, but a hidden field is presentation — this check is
 * the rule.
 *
 * ⚠ STATUS, DENIAL REASON AND THE REVIEW STAMPS ARE NOT WRITEABLE HERE. Approving is the admin
 * route's job; a coach editing their own request must never be able to reach those columns, so
 * they are omitted from the update rather than filtered out of the body.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; id: string }> },) => {
  const { orgSlug, teamId, id } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { requestType, amount, description, paymentMethod = null, notes = null } = body;

  // Same three rules the POST enforces — a correction may not produce a request the create door
  // would have refused.
  if (!['payment_to_org', 'charge_to_org'].includes(requestType)) {
    return NextResponse.json({ error: 'requestType must be payment_to_org or charge_to_org' }, { status: 400 });
  }
  if (typeof amount !== 'number' || amount <= 0 || amount > 999999.99) {
    return NextResponse.json({ error: 'amount must be a positive number no greater than 999999.99' }, { status: 400 });
  }
  if (!description?.trim() || description.trim().length > 500) {
    return NextResponse.json({ error: 'description is required and must be 500 characters or fewer' }, { status: 400 });
  }

  /* ⚠⚠ AND SO IS THE MEANING (mig 271). Same three rules again: a correction may not produce a
     request the create door would have refused, and "new money or money back" is one of them.
     ⚠ THE FLIP IS THE CASE TO HOLD IN MIND. A coach may still change a pending request's DIRECTION
     here — that is what makes this door a correction rather than a re-type — and a request turned
     round to *To the club* is a cost, which has no second reading. `resolveMoneyInMeaning` returns
     null for that direction, and the column's CHECK agrees, so the stale answer cannot survive the
     edit that made it meaningless. */
  const meaning = resolveMoneyInMeaning(requestType, body?.moneyInMeaning);
  if (!meaning.ok) return NextResponse.json({ error: meaning.error }, { status: 400 });

  /* ⚠⚠ THE FILING IS PART OF THE CORRECTION, NOT AN EXTRA (mig 250). This handler names every
     column it writes, so a request edited here would otherwise keep whatever it was filed under
     while the coach watched the picker show something else — and the report would follow the stale
     one. Same rule as the POST: the category is derived from the item, never taken from the caller. */
  const item = await resolveBudgetItem(body?.budgetItemId, ctx.org.id, teamId, team.sport);
  if (!item.ok) return NextResponse.json({ error: item.error }, { status: 400 });

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .select('id, team_id, status')
    .eq('id', id)
    .eq('org_id', team.orgId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (existing.team_id !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'This request has already been reviewed, so it can no longer be changed.' }, { status: 409 });
  }

  /* ⚠⚠ THE WRITE RE-ASSERTS EVERY CONDITION THE READ ABOVE CHECKED — pending, org and team — and
     that is not belt-and-braces, it is the correctness of the rule.

     The admin's approve does: read the request → confirm pending → **create the accounting transfer**
     → mark it approved. That middle step moves real money and takes a database round trip, so there
     is a wide, reliably reproducible window in which this coach's read still says "pending" while an
     approval is already in flight. Filtering the UPDATE on `id` alone let an edit land on a row that
     had since been approved: the request would read $500 while the transfer actually posted $100,
     and the money record would disagree with the money. A coach watching their own list can see an
     approval starting and aim for that window deliberately.

     Zero rows updated now means "somebody got there first" — reported as the same 409 the pre-check
     gives, because from the coach's side it is the same situation. */
  const { data, error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .update({
      request_type:   requestType,
      money_in_meaning: meaning.value,
      amount,
      description:    description.trim(),
      payment_method: paymentMethod?.trim() || null,
      notes:          notes?.trim() || null,
      budget_item_id:     item.item?.id ?? null,
      budget_category_id: item.item?.categoryId ?? null,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', team.orgId)
    .eq('team_id', team.id)
    // ⚠ THE SEASON, TOO — a request raised last season is still reachable by id while a new one is
    // live, and editing a finished season's record is the hole this whole block closes.
    .eq('program_year_id', programYear.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (error) return captureAndJson(error, { error: error.message }, 500);
  if (!data) {
    return NextResponse.json(
      { error: 'This request has already been reviewed, so it can no longer be changed.' },
      { status: 409 },
    );
  }

  return NextResponse.json({
    request: mapClubRequest(data, { item: item.item?.name ?? null, category: item.item?.categoryName ?? null }),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]' });

// DELETE /api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]
// Coaches can only cancel their own pending requests.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; id: string }> },) => {
  const { orgSlug, teamId, id } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .select('id, team_id, status')
    .eq('id', id)
    .eq('org_id', team.orgId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (existing.team_id !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 409 });
  }

  /* ⚠⚠ SAME RE-ASSERTION AS THE PATCH ABOVE, AND HERE THE RACE IS WORSE. Pre-existing (this
     handler predates the 2026-08-16 review that found it), but the identical window: the admin's
     approve creates the accounting transfer BEFORE it marks the request approved, so a withdraw
     aimed at that gap deleted the request while the transfer stood — money moved between the team's
     and the org's books with no record left explaining why. A withdraw that finds nothing to delete
     now says so instead of reporting success. */
  const { data: removed, error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .delete()
    .eq('id', id)
    .eq('org_id', team.orgId)
    .eq('team_id', team.id)
    // ⚠ Season-scoped for the same reason as the PATCH above — a withdraw is a DELETE, so reaching
    // a finished season's record here destroys it rather than merely rewriting it.
    .eq('program_year_id', programYear.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) return captureAndJson(error, { error: error.message }, 500);
  if (!removed) {
    return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]' });
