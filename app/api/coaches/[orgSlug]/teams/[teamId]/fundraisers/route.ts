import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamTagLibrary,
  getRepTeamFundraiserTagsMap,
  setRepTeamFundraiserTags,
} from '@/lib/db';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { futureReceivedDateRefusal } from '@/lib/money-date-guards';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { tournamentToday } from '@/lib/timezone';
import { isFundraisingKind, isSponsorStatus } from '@/lib/coach-fundraising';
import { accrueArrival, creditPlanProblem, stillToCome, type CreditPlanShare } from '@/lib/sponsor-arrivals';
import { writeSponsorArrivalRow } from '@/lib/sponsor-arrivals-server';

/** The list shape a freshly-created record answers with — the table needs every column it prints. */
function mapNewRecord(
  row: Record<string, any>,
  money?: { arrived: number; credit: number },
  tagIds: string[] = [],
) {
  const arrived = money?.arrived ?? 0;
  const credit = money?.credit ?? 0;
  const pledged = row.pledged_amount != null ? Number(row.pledged_amount) : null;
  return {
    id:                  row.id,
    kind:                row.kind ?? 'fundraiser',
    sponsorStatus:       row.sponsor_status ?? null,
    name:                row.name,
    description:         row.description ?? null,
    playerRebatePercent: Number(row.player_rebate_percent),
    startDate:           row.start_date ?? null,
    endDate:             row.end_date   ?? null,
    isActive:            row.is_active,
    createdAt:           row.created_at,
    totalRaised:         arrived,
    teamNet:             Math.round((arrived - credit) * 100) / 100,
    totalCredits:        credit,
    playerCount:         0,
    broughtInBy:         null,
    broughtInById:       null,
    // Arrivals model (mig 268): the promise and what is still to come ride the record itself.
    pledgedAmount:       pledged,
    stillToCome:         stillToCome(pledged, arrived),
    tagIds,
  };
}

/**
 * The credit plan a sponsor create/edit sends (Q16): `creditPlan: [{playerId, value, unit}]`.
 * Legacy single-family fields (`broughtInById`/`creditValue`/`creditUnit`) map to one row so the
 * recording conversation and any not-yet-reworked caller keep working through the transition.
 */
function parseCreditPlan(body: Record<string, any>): CreditPlanShare[] | { error: string } {
  if (Array.isArray(body.creditPlan)) {
    const plan: CreditPlanShare[] = [];
    for (const row of body.creditPlan) {
      const playerId = typeof row?.playerId === 'string' ? row.playerId : '';
      const value = Number(row?.value);
      const unit = row?.unit === 'amount' ? 'amount' : row?.unit === 'percent' ? 'percent' : null;
      if (!playerId || !unit) return { error: 'Every credit row needs a family and a $ or % share.' };
      if (!Number.isFinite(value) || value <= 0) continue; // a zero share is "not credited"
      plan.push({ playerId, value, unit });
    }
    return plan;
  }
  const legacyId = body.broughtInById;
  const legacyValue = Number(body.creditValue ?? 0);
  const legacyUnit = body.creditUnit === 'amount' ? 'amount' : 'percent';
  if (legacyId && Number.isFinite(legacyValue) && legacyValue > 0) {
    return [{ playerId: legacyId, value: legacyValue, unit: legacyUnit }];
  }
  return [];
}

/**
 * ⚠ THE SINGLE-ARRIVAL WRITER IS GONE (mig 268). A pledge writes NO entry — the promise lives in
 * `pledged_amount` — and received money is written as a dated ARRIVAL through
 * lib/sponsor-arrivals-server.ts, the one writer all three sponsor doors share. What follows in
 * this file is only the create-time orchestration: record row, plan rows, then (if received) the
 * first arrival.
 */

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

// GET /api/coaches/[orgSlug]/teams/[teamId]/fundraisers
// Returns all fundraisers with per-fundraiser totals.
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const { data: fundraisers, error: fErr } = await supabaseAdmin
    .from('rep_fundraisers')
    .select('*')
    .eq('program_year_id', programYear.id)
    .order('created_at', { ascending: false });

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });

  // ⚠ The money-tag LIBRARY ships even on an empty season, because the create form needs it before
  // the first record exists — an empty list must not mean an empty picker.
  const moneyTags = await getRepTeamTagLibrary(teamId, 'expense', ctx!.org.id);

  if (!fundraisers?.length) {
    return NextResponse.json({ fundraisers: [], moneyTags, tagsByFundraiserId: {} });
  }

  const fundraiserIds = fundraisers.map(f => f.id);
  const [{ data: entries }, { data: planRows }, tagsByFundraiserId] = await Promise.all([
    supabaseAdmin
      .from('rep_fundraiser_entries')
      .select('fundraiser_id, player_id, amount_raised, rebate_amount')
      .in('fundraiser_id', fundraiserIds),
    supabaseAdmin
      .from('rep_fundraiser_credit_plan')
      .select('fundraiser_id, player_id, share_value, share_unit')
      .in('fundraiser_id', fundraiserIds)
      .order('created_at', { ascending: true }),
    getRepTeamFundraiserTagsMap(fundraiserIds),
  ]);

  // Entries are ARRIVALS for a sponsor (mig 268) and per-player rows for a drive — the sum works
  // for both, and a pledged sponsor deliberately has none: its figure is the pledge column.
  const totalsMap = new Map<string, { totalRaised: number; totalRebates: number; playerCount: number }>();
  for (const e of entries ?? []) {
    const existing = totalsMap.get(e.fundraiser_id) ?? { totalRaised: 0, totalRebates: 0, playerCount: 0 };
    totalsMap.set(e.fundraiser_id, {
      totalRaised:  existing.totalRaised  + Number(e.amount_raised),
      totalRebates: existing.totalRebates + Number(e.rebate_amount),
      // Only a real player counts toward "how many have logged something" — a sponsor's
      // playerless arrivals must not read as players.
      playerCount:  existing.playerCount  + (e.player_id ? 1 : 0),
    });
  }

  // The credited families live on the PLAN since mig 268 — the muted words beside a sponsor's
  // name come from here, never from an entry's player.
  const planByFundraiser = new Map<string, { playerId: string; value: number; unit: string }[]>();
  for (const p of planRows ?? []) {
    const list = planByFundraiser.get(p.fundraiser_id) ?? [];
    list.push({ playerId: p.player_id as string, value: Number(p.share_value), unit: p.share_unit as string });
    planByFundraiser.set(p.fundraiser_id, list);
  }
  const planPlayerIds = [...new Set((planRows ?? []).map(p => p.player_id as string))];
  const nameById = new Map<string, string>();
  if (planPlayerIds.length) {
    const { data: players } = await supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .in('id', planPlayerIds);
    for (const p of players ?? []) {
      nameById.set(p.id, [p.player_first_name, p.player_last_name].filter(Boolean).join(' '));
    }
  }

  const result = fundraisers.map(f => {
    const t = totalsMap.get(f.id) ?? { totalRaised: 0, totalRebates: 0, playerCount: 0 };
    const isSponsor = (f.kind ?? 'fundraiser') === 'sponsor';
    const plan = isSponsor ? (planByFundraiser.get(f.id) ?? []) : [];
    const first = plan[0]?.playerId ?? null;
    const pledged = isSponsor && f.pledged_amount != null ? Number(f.pledged_amount) : null;
    return {
      id:                  f.id,
      kind:                f.kind ?? 'fundraiser',
      sponsorStatus:       f.sponsor_status ?? null,
      name:                f.name,
      description:         f.description ?? null,
      playerRebatePercent: Number(f.player_rebate_percent),
      startDate:           f.start_date ?? null,
      endDate:             f.end_date   ?? null,
      isActive:            f.is_active,
      createdAt:           f.created_at,
      // ARRIVED money — zero for a pledge, whose figure is pledgedAmount below.
      totalRaised:         Math.round(t.totalRaised  * 100) / 100,
      teamNet:             Math.round((t.totalRaised - t.totalRebates) * 100) / 100,
      totalCredits:        Math.round(t.totalRebates * 100) / 100,
      playerCount:         t.playerCount,
      // First credited family (the muted words beside the name); the whole plan rides too.
      broughtInBy:         first ? (nameById.get(first) ?? null) : null,
      broughtInById:       first,
      creditFamilies:      plan.map(p => ({ ...p, name: nameById.get(p.playerId) ?? null })),
      pledgedAmount:       pledged,
      stillToCome:         stillToCome(pledged, t.totalRaised),
      expectedBy:          isSponsor ? (f.expected_by ?? null) : null,
      // ⚠ Tags travel with the RECORD, never onto the list row (row-density ruling 2026-08-15) —
      // the list carries them only so the export can, and so opening a record does not need a
      // second fetch to know what it is already labelled.
      tagIds:              tagsByFundraiserId[f.id] ?? [],
    };
  });

  return NextResponse.json({ fundraisers: result, moneyTags, tagsByFundraiserId });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers' });

// POST /api/coaches/[orgSlug]/teams/[teamId]/fundraisers
// Creates a new fundraiser.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const {
    name,
    description = null,
    playerRebatePercent = 0,
    startDate = null,
    endDate   = null,
    // ── Sponsor-only ── (the credit families arrive via `creditPlan` — or the legacy single
    // `broughtInById`/`creditValue`/`creditUnit` trio, mapped in parseCreditPlan)
    kind = 'fundraiser',
    sponsorStatus = 'received',
    sponsorAmount = 0,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!isFundraisingKind(kind)) {
    return NextResponse.json({ error: 'kind must be fundraiser or sponsor' }, { status: 400 });
  }
  const rebatePct = Number(playerRebatePercent);
  if (isNaN(rebatePct) || rebatePct < 0 || rebatePct > 100) {
    return NextResponse.json({ error: 'playerRebatePercent must be between 0 and 100' }, { status: 400 });
  }

  // ⚠ Every id PROVED against this team's money-tag library before anything is written. RLS on the
  // junction reaches tenancy through the FUNDRAISER, not the tag (mig 239), so the database cannot
  // catch a route that links one club's sponsor to another club's tag — this is that check.
  let tagIds: string[] = [];
  if (body.tagIds !== undefined) {
    const resolvedTags = await resolveValidTagIds(team.id, ctx!.org.id, 'expense', body.tagIds);
    if (resolvedTags === null) {
      return NextResponse.json({ error: 'tagIds must be an array of this team’s existing money-tag ids' }, { status: 400 });
    }
    tagIds = resolvedTags;
  }

  // ── A DRIVE: the record is the whole of it; its rows arrive later, one per player. ──
  if (kind === 'fundraiser') {
    const { data, error } = await supabaseAdmin
      .from('rep_fundraisers')
      .insert({
        org_id:               team.orgId,
        team_id:              team.id,
        program_year_id:      programYear.id,
        kind:                 'fundraiser',
        name:                 name.trim(),
        description:          description?.trim() || null,
        player_rebate_percent: rebatePct,
        start_date:           startDate || null,
        end_date:             endDate   || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (tagIds.length > 0) await setRepTeamFundraiserTags(data.id, tagIds);
    return NextResponse.json({ fundraiser: mapNewRecord(data, undefined, tagIds) }, { status: 201 });
  }

  // ── A SPONSOR: the record (with its promise), the credit plan, and — if the money is already
  // in — its FIRST ARRIVAL through the one shared arrival writer (mig 268). ──
  if (!isSponsorStatus(sponsorStatus)) {
    return NextResponse.json({ error: 'sponsorStatus must be pledged or received' }, { status: 400 });
  }
  const amount = Number(sponsorAmount); // the AGREEMENT — pledged_amount either way
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'A sponsor needs an amount greater than zero.' }, { status: 400 });
  }

  const planParsed = parseCreditPlan(body);
  if (!Array.isArray(planParsed)) {
    return NextResponse.json({ error: planParsed.error }, { status: 400 });
  }
  const plan = planParsed;
  const planProblem = creditPlanProblem(plan, amount);
  if (planProblem) return NextResponse.json({ error: planProblem }, { status: 400 });

  if (plan.length) {
    const { data: players } = await supabaseAdmin
      .from('rep_roster_players')
      .select('id')
      .in('id', plan.map(p => p.playerId))
      .eq('program_year_id', programYear.id);
    if ((players ?? []).length !== plan.length) {
      return NextResponse.json({ error: 'That player is not on this season’s roster.' }, { status: 400 });
    }
  }

  const received = sponsorStatus === 'received';
  // The promise's own date (Q13, optional): when the pledged money is expected. Quiet — never a
  // due date. Accepted on either status (a part-paid pledge can still have one).
  let expectedBy: string | null = null;
  if (body.expectedBy !== undefined && body.expectedBy !== null && body.expectedBy !== '') {
    if (typeof body.expectedBy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.expectedBy)) {
      return NextResponse.json({ error: 'expectedBy must be a date (YYYY-MM-DD)' }, { status: 400 });
    }
    expectedBy = body.expectedBy;
  }
  let receivedDate = '';
  let method: string | null = null;
  if (received) {
    receivedDate = typeof body.receivedDate === 'string' ? body.receivedDate : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
      return NextResponse.json({ error: 'Enter the date the money arrived.' }, { status: 400 });
    }
    if (receivedDate > tournamentToday()) {
      /* ⚖ ONE SENTENCE, FROM THE MAP. These two doors each carried their own copy and had already
         DRIFTED apart (one offered "record it as a pledge instead", the other said nothing) — which
         is exactly what lib/money-date-guards.ts exists to stop, and what its own header asked to be
         fixed the next time these routes were touched. The shared sentence now hands off to the
         pledge's expected-by date, which is the control the coach actually wanted. */
      return NextResponse.json({ error: futureReceivedDateRefusal(receivedDate, 'sponsor cheque')! }, { status: 400 });
    }
    const m = typeof body.method === 'string' && body.method ? body.method : null;
    if (m && !['etransfer', 'cash', 'cheque', 'card', 'other'].includes(m)) {
      return NextResponse.json({ error: 'method must be one of etransfer, cash, cheque, card, other' }, { status: 400 });
    }
    method = m;
  }

  // ⚠ Inserted as PLEDGED regardless of what was asked: the status follows the money, and the
  // arrival writer below is the only thing that may flip it. If the arrival then fails, the
  // sponsor survives honestly as a pledge with its plan — never as "received" with no money.
  const singlePct = plan.length === 1 && plan[0].unit === 'percent' ? plan[0].value : 0;
  const { data: record, error: recErr } = await supabaseAdmin
    .from('rep_fundraisers')
    .insert({
      org_id:               team.orgId,
      team_id:              team.id,
      program_year_id:      programYear.id,
      kind:                 'sponsor',
      sponsor_status:       'pledged',
      pledged_amount:       amount,
      expected_by:          expectedBy,
      name:                 name.trim(),
      description:          description?.trim() || null,
      // Provenance only when the whole plan is one percent share — the plan table is the truth.
      player_rebate_percent: singlePct,
      start_date:           startDate || null,
      end_date:             endDate   || null,
    })
    .select()
    .single();

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });

  if (plan.length) {
    const { error: planErr } = await supabaseAdmin.from('rep_fundraiser_credit_plan').insert(
      plan.map(p => ({
        org_id: team.orgId,
        team_id: team.id,
        fundraiser_id: record.id,
        player_id: p.playerId,
        share_value: p.value,
        share_unit: p.unit,
      })),
    );
    if (planErr) {
      await supabaseAdmin.from('rep_fundraisers').delete().eq('id', record.id);
      return NextResponse.json({ error: planErr.message }, { status: 500 });
    }
  }

  let arrivedCredit = 0;
  if (received) {
    const money = await writeSponsorArrivalRow({
      team,
      programYearId: programYear.id,
      fundraiser: { id: record.id, name: record.name, pledged_amount: amount },
      amount,
      receivedDate,
      method,
      notes: null,
      userId: ctx!.user.id,
    });
    if ('error' in money) {
      // The arrival unwound itself; the sponsor stands as a pledge. Say so rather than 500-ing
      // into mystery — the coach's typing became a real, recoverable record.
      return NextResponse.json({
        error: 'The sponsor was saved as a pledge, but the arrival could not be recorded. Open it and record the arrival again.',
      }, { status: 500 });
    }
    record.sponsor_status = 'received';
    arrivedCredit = accrueArrival({
      plan, pledged: amount, arrivalAmount: amount, priorArrivalsTotal: 0, priorAccrued: new Map(),
    }).reduce((s, r) => s + r.credit, 0);
  }

  if (tagIds.length > 0) await setRepTeamFundraiserTags(record.id, tagIds);

  return NextResponse.json({
    fundraiser: mapNewRecord(record, { arrived: received ? amount : 0, credit: Math.round(arrivedCredit * 100) / 100 }, tagIds),
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers' });
