import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepFundraiser,
  setRepTeamFundraiserTags,
} from '@/lib/db';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { fmt } from '@/lib/coach-money-summary';
import { pluralize } from '@/lib/utils';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { isSponsorStatus } from '@/lib/coach-fundraising';
import { creditPlanProblem, type CreditPlanShare } from '@/lib/sponsor-arrivals';
import { applySponsorAgreement, getSponsorCreditPlan } from '@/lib/sponsor-arrivals-server';

/**
 * ⚠ THE SINGLE-ENTRY EDITOR IS GONE (mig 268). applySponsorMoney, resolveSponsorEffective and
 * the route-local payout-floor guard all lived on "a sponsor is one entry" — an edit re-derived
 * the one entry's amount, family and credit together. Under arrivals the PATCH edits the
 * AGREEMENT instead: the pledged amount and the credit plan. The money itself moves only through
 * the arrivals routes, and the payout floor now lives inside the one shared writer
 * (lib/sponsor-arrivals-server.ts), asked per family before any row is touched.
 *
 * Status is DERIVED truth: an arrival makes a sponsor received; undoing the last one returns it
 * to a pledge. A status write that disagrees with the money is refused below, with directions.
 */
function parseAgreementPlan(body: Record<string, any>): CreditPlanShare[] | { error: string } | null {
  if (Array.isArray(body.creditPlan)) {
    const plan: CreditPlanShare[] = [];
    for (const row of body.creditPlan) {
      const playerId = typeof row?.playerId === 'string' ? row.playerId : '';
      const value = Number(row?.value);
      const unit = row?.unit === 'amount' ? 'amount' : row?.unit === 'percent' ? 'percent' : null;
      if (!playerId || !unit) return { error: 'Every credit row needs a family and a $ or % share.' };
      if (!Number.isFinite(value) || value <= 0) continue;
      plan.push({ playerId, value, unit: unit as 'amount' | 'percent' });
    }
    return plan;
  }
  // Legacy single-family trio (the pre-arrivals Settings sheet): undefined means "not editing
  // the plan"; a named family maps to one row; an explicit empty family means "nobody".
  if (body.broughtInById === undefined && body.creditValue === undefined) return null;
  const legacyId = body.broughtInById;
  const legacyValue = Number(body.creditValue ?? 0);
  const legacyUnit = body.creditUnit === 'amount' ? 'amount' : 'percent';
  if (legacyId && Number.isFinite(legacyValue) && legacyValue > 0) {
    return [{ playerId: legacyId, value: legacyValue, unit: legacyUnit as 'amount' | 'percent' }];
  }
  return [];
}

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]
// Updates fundraiser header fields (name, description, rebate %, dates, isActive).
// Changing player_rebate_percent only affects future entries — existing entries
// snapshot their percent at creation time.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> },) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // ⚠ Scoped to the ACTIVE season. This lookup was `id + team_id` only, which let a finished
  // season's fundraiser be renamed, re-dated or re-opened from an archived Money hub — the team
  // check reads as tight but `rep_fundraisers` is keyed by program year, so it never bit.
  const existing = await getRepFundraiser(fundraiserId, team.id, programYear.id);
  if (!existing) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // ⚠ Validated BEFORE anything is written, and by the same rule the create path uses: the
  // junction's RLS reaches tenancy through the fundraiser, so a stray, cross-team or wrong-kind id
  // has to be refused here or nowhere. `undefined` means "not editing tags"; `[]` means "clear
  // them", and the two must stay distinguishable or a save from a form that never loaded the
  // picker would silently strip a record's labels.
  let tagIds: string[] | null = null;
  if (body.tagIds !== undefined) {
    const resolvedTags = await resolveValidTagIds(team.id, ctx!.org.id, 'expense', body.tagIds);
    if (resolvedTags === null) {
      return NextResponse.json({ error: 'tagIds must be an array of this team’s existing money-tag ids' }, { status: 400 });
    }
    tagIds = resolvedTags;
  }

  if (body.name !== undefined) {
    if (!body.name?.trim()) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.playerRebatePercent !== undefined) {
    const pct = Number(body.playerRebatePercent);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'playerRebatePercent must be between 0 and 100' }, { status: 400 });
    }
    updates.player_rebate_percent = pct;
  }
  if (body.startDate !== undefined) updates.start_date = body.startDate || null;
  if (body.endDate   !== undefined) updates.end_date   = body.endDate   || null;
  if (body.isActive  !== undefined) updates.is_active  = Boolean(body.isActive);
  // Q13 (mig 269): the pledge's optional expected-by date — edited on the agreement sheet.
  if (body.expectedBy !== undefined) {
    if (body.expectedBy !== null && body.expectedBy !== '' &&
        (typeof body.expectedBy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.expectedBy))) {
      return NextResponse.json({ error: 'expectedBy must be a date (YYYY-MM-DD)' }, { status: 400 });
    }
    updates.expected_by = body.expectedBy || null;
  }

  /**
   * ── A SPONSOR'S OWN FIELDS: THE AGREEMENT (mig 268) ────────────────────────────────────────
   *
   * ⚠ THE KIND IS NEVER IN `updates`. A drive's rows are players and a sponsor's are arrivals,
   * so switching afterwards has nothing sensible to do with what is recorded — the picker is
   * create-time only and the server refuses it here rather than trusting that.
   *
   * What a sponsor edit means now: the PLEDGED AMOUNT and the CREDIT PLAN — the agreement. The
   * money itself moves only through the arrivals routes, and STATUS follows the money: a status
   * write that disagrees with the arrivals is refused with directions rather than obeyed.
   */
  const isSponsor = existing.kind === 'sponsor';
  if (body.kind !== undefined && body.kind !== existing.kind) {
    return NextResponse.json({
      error: 'A fundraiser cannot become a sponsor, or the other way round — its records mean different things.',
    }, { status: 400 });
  }
  const planEdit = isSponsor ? parseAgreementPlan(body) : null;
  if (planEdit && !Array.isArray(planEdit)) {
    return NextResponse.json({ error: planEdit.error }, { status: 400 });
  }
  const pledgedEdit = body.pledgedAmount !== undefined ? body.pledgedAmount
    : body.sponsorAmount !== undefined ? body.sponsorAmount : undefined;
  const touchesSponsorMoney = pledgedEdit !== undefined || planEdit !== null || body.sponsorStatus !== undefined;
  if (!isSponsor && (touchesSponsorMoney || Array.isArray(body.creditPlan))) {
    return NextResponse.json({ error: 'Those fields belong to a sponsor.' }, { status: 400 });
  }

  if (isSponsor && body.sponsorStatus !== undefined) {
    if (!isSponsorStatus(body.sponsorStatus)) {
      return NextResponse.json({ error: 'sponsorStatus must be pledged or received' }, { status: 400 });
    }
    // Status is DERIVED from the money (mig 268). Sending the current value is a no-op the old
    // Settings sheet still does; asking to CHANGE it gets directions, not obedience.
    if (body.sponsorStatus !== existing.sponsor_status) {
      return NextResponse.json({
        error: existing.sponsor_status === 'received'
          ? 'A sponsor’s status follows the money — undo its arrivals to return it to a pledge.'
          : 'A sponsor’s status follows the money — record an arrival to mark it received.',
        code: 'SPONSOR_STATUS_IS_DERIVED',
      }, { status: 409 });
    }
  }

  let newPledged: number | null = existing.pledged_amount != null ? Number(existing.pledged_amount) : null;
  let newPlan: CreditPlanShare[] | null = null;
  if (isSponsor && (pledgedEdit !== undefined || Array.isArray(planEdit))) {
    if (pledgedEdit !== undefined) {
      const amt = Number(pledgedEdit);
      if (!Number.isFinite(amt) || amt <= 0) {
        return NextResponse.json({ error: 'A sponsor needs an amount greater than zero.' }, { status: 400 });
      }
      newPledged = amt;
      updates.pledged_amount = amt;
    }
    newPlan = Array.isArray(planEdit) ? planEdit : await getSponsorCreditPlan(existing.id);
    const problem = creditPlanProblem(newPlan, newPledged);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    if (newPlan.length) {
      const { data: players } = await supabaseAdmin
        .from('rep_roster_players')
        .select('id')
        .in('id', newPlan.map(p => p.playerId))
        .eq('program_year_id', programYear.id);
      if ((players ?? []).length !== newPlan.length) {
        return NextResponse.json({ error: 'That player is not on this season’s roster.' }, { status: 400 });
      }
    }
    // ⚠ The floor is asked inside the shared writer, per family, BEFORE any row is touched —
    // and before the header write below, so a refusal leaves nothing half-changed.
    const applied = await applySponsorAgreement({
      team,
      programYearId: programYear.id,
      fundraiser: { id: existing.id, name: (updates.name as string | undefined) ?? existing.name },
      newPlan,
      newPledged,
      userId: ctx!.user.id,
    });
    if ('error' in applied) return applied.error;
    // Provenance snapshot mirrors the create path: one percent share, else 0.
    updates.player_rebate_percent =
      newPlan.length === 1 && newPlan[0].unit === 'percent' ? newPlan[0].value : 0;
  }

  const { data, error } = await supabaseAdmin
    .from('rep_fundraisers')
    .update(updates)
    .eq('id', fundraiserId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (tagIds !== null) await setRepTeamFundraiserTags(fundraiserId, tagIds);

  return NextResponse.json({
    fundraiser: {
      id:                  data.id,
      name:                data.name,
      description:         data.description ?? null,
      playerRebatePercent: Number(data.player_rebate_percent),
      startDate:           data.start_date ?? null,
      endDate:             data.end_date   ?? null,
      isActive:            data.is_active,
      updatedAt:           data.updated_at,
      /* ⚠ NO `tagIds` HERE, deliberately. It would be present only when the request happened to
         edit tags and absent otherwise — a field that is sometimes on a fundraiser object and
         sometimes not is worse than one that never is, because the first reader to trust it will
         be right most of the time. Every path that promises `tagIds` (the list GET, the create
         POST, the record GET) always sends it. The only client of this PATCH refetches. */
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]' });

/**
 * DELETE — remove a fundraising record entirely (sponsors Q14 + drives R5-A, owner-ruled).
 *
 * ⚖ EMPTY SHELL DELETES; MONEY ON THE BOOKS REFUSES. The grammar is the owner's
 * foreseeable-refusal ruling (§118) read one level up: a record that never moved money is just a
 * plan entry and goes on a plain confirm, while one that DID is unwound row by row through the
 * doors that already state their own amounts and already carry the payout floor. The screens
 * render the same two states, so the refusal is normally seen before it is hit; this is the belt
 * against a stale screen, and it is the only one that binds.
 *
 * ⚠⚠ WHY REFUSE RATHER THAN CASCADE, since the FK would happily do it: `rep_fundraiser_entries`
 * is ON DELETE CASCADE from this table, so a single unguarded delete here would silently erase
 * every arrival and every player entry — and NOT their income rows, which hang off the entries by
 * a SET NULL link and would be left standing with nothing to explain them. That is the mig-030
 * hazard exactly. Beyond the orphan risk it cannot be consented to honestly: cash on hand would
 * move by a compound figure no confirm can state, and it would have to half-fail the moment one
 * family's credit is already paid out. Unwinding one row at a time fires every guard in order.
 *
 * ⚠ RESIDUAL, stated rather than hidden: a row created between the count below and the delete
 * would be swept by that cascade. The window is one round trip on a single team's own record, and
 * closing it properly needs a transaction this stack does not give a route — the same documented
 * gap the sponsor writer records for the guard-to-write race.
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> },) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Scoped to the ACTIVE season, like the PATCH above — a finished season's record is not deleted
  // from an archived hub either.
  const existing = await getRepFundraiser(fundraiserId, team.id, programYear.id);
  if (!existing) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });

  const { data: rows, error: countErr } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('amount_raised')
    .eq('fundraiser_id', fundraiserId)
    .eq('team_id', team.id);
  if (countErr) {
    console.error('[fundraiser-delete] entry count failed', { fundraiserId, error: countErr });
    return NextResponse.json({ error: 'Could not check what this record holds. Try again.' }, { status: 500 });
  }
  const count = (rows ?? []).length;
  const total = Math.round((rows ?? []).reduce((s, r) => s + Number(r.amount_raised), 0) * 100) / 100;
  const isSponsor = (existing.kind ?? 'fundraiser') === 'sponsor';

  if (count > 0) {
    /* `fmt` and `pluralize` are the shared ones — this sentence quotes dollars and counts the
       way every other surface does, rather than growing a fourth hand-rolled copy of each. */
    const them = count === 1 ? 'it' : 'them';
    return NextResponse.json({
      error: isSponsor
        ? `This sponsor has ${fmt(total)} on the team's books across ${pluralize(count, 'arrival')} — undo ${them} from the sponsor's row first.`
        : `This fundraiser has ${fmt(total)} logged across ${pluralize(count, 'entry', 'entries')} — remove ${them} from the leaderboard first.`,
      code: 'FUNDRAISER_HAS_MONEY',
      entryCount: count,
      total,
    }, { status: 409 });
  }

  /* The credit plan and the tag links go by cascade (both ON DELETE CASCADE from this row), and
     an empty record owns nothing else — a pledge posts no money, and a drive with no entries has
     never posted any either. Re-asserting org, team AND season in the WHERE rather than trusting
     the id the URL carried. */
  const { error: delErr } = await supabaseAdmin
    .from('rep_fundraisers')
    .delete()
    .eq('id', fundraiserId)
    .eq('org_id', ctx!.org.id)
    .eq('team_id', team.id)
    .eq('program_year_id', programYear.id);
  if (delErr) {
    console.error('[fundraiser-delete] delete failed', { fundraiserId, error: delErr });
    return NextResponse.json({ error: 'That record could not be deleted. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]' });
