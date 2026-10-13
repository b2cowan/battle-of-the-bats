import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { resolveBudgetItem } from '@/lib/coach-budget-items';
import { mapClubRequest, resolveMoneyInMeaning, type ClubRequestType } from '@/lib/coach-club-money';
import { withObservability, captureAndJson } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

/**
 * PATCH /api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]/filing
 *
 * ═══ THE TEAM'S OWN LABEL ON A CLUB RECORD — and the ONLY thing this door can touch ═══
 *
 * ⚖ D3 (owner, 2026-08-30): **the record locks; the team's label does not.** An answered request
 * opens read-only for a reason that has not changed — it records what the club acted on, and
 * rewriting the amount or the wording would make that record a lie. But *what the team files it
 * under*, and *what the team reads the arrival as*, are a layer the team owns on top of the club's
 * decision. A bill has had exactly this affordance since mig 250; this gives a request the same
 * one, which is why both kinds now carry the SAME live filing control inside their own row.
 * ⚠ The affordance was a **File it** / **Change** button in the row cell until 2026-09-02, when it
 * became a live picker in the fold. The route is unchanged by that — noted so this comment does not
 * keep describing a control the product no longer has.
 *
 * ⚠⚠ THIS IS A SEPARATE ROUTE RATHER THAN A MODE ON THE SIBLING PATCH, AND THE REASON IS THE LOCK.
 * That handler refuses anything not `pending`, deliberately and at the database — the WHERE clause
 * carries `.eq('status', 'pending')` because the club's approve posts the accounting transfer
 * BEFORE it stamps the row, so there is a real window in which a coach's edit can land on money
 * that has already moved. Teaching it "…unless the body only contains a filing" would put the
 * status rule and its exception in one place and make the next reader prove which fields a request
 * carried. Here, the columns this door can reach are the whole file: it names three, and it can
 * name no others.
 *
 * ⚠ RE-FILING MOVES NO MONEY. Nothing here touches an amount, a status, a direction, a review
 * stamp, an accounting entry or — the rule most easily broken by accident — a payment schedule or
 * anybody's dues. It moves which row of Budget vs. Actual tells the story.
 *
 * ⚠ THE DIRECTION IS READ FROM THE STORED ROW, NEVER FROM THE BODY. `resolveMoneyInMeaning` needs
 * to know whether this is money coming in, and on an approved request that fact is settled — taking
 * it from the caller would let a body claim `charge_to_org` on an outgoing request and write a
 * meaning the column's CHECK would then reject with a 500 instead of a sentence.
 *
 * ⚠ A LIVE SEASON, as every write door here does. A finished season's club records are records; the
 * panel withdraws every control on them and this refuses the same edit if something else asks.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; id: string }> },) => {
  const { orgSlug, teamId, id } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));

  /* ⚠ THE SEASON AND THE TEAM ARE ASSERTED ON THE READ **AND** ON THE WRITE below. A request id
     arrives from the browser, and one belonging to another team — or to this team in a season that
     is no longer the working one — must not be reachable through this door. The 404 does not
     confirm the id exists. */
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .select('id, request_type')
    .eq('id', id)
    .eq('org_id', team.orgId)
    .eq('team_id', team.id)
    .eq('program_year_id', programYear.id)
    .maybeSingle();

  if (fetchErr || !existing) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const meaning = resolveMoneyInMeaning(existing.request_type as ClubRequestType, body?.moneyInMeaning);
  if (!meaning.ok) return NextResponse.json({ error: meaning.error }, { status: 400 });

  /* ⚠ The category is DERIVED from the item, exactly as the create and correct doors derive it — an
     item belongs to one category, and Budget vs. Actual reads the two levels in different orders,
     so a row carrying one level reports under two headings depending which part of the page asks. */
  const item = await resolveBudgetItem(body?.budgetItemId, ctx.org.id, teamId, team.sport);
  if (!item.ok) return NextResponse.json({ error: item.error }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .update({
      money_in_meaning:   meaning.value,
      budget_item_id:     item.item?.id ?? null,
      budget_category_id: item.item?.categoryId ?? null,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', team.orgId)
    .eq('team_id', team.id)
    .eq('program_year_id', programYear.id)
    .select()
    .maybeSingle();

  if (error) return captureAndJson(error, { error: error.message }, 500);
  if (!data) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  return NextResponse.json({
    request: mapClubRequest(data, { item: item.item?.name ?? null, category: item.item?.categoryName ?? null }),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]/filing' });
