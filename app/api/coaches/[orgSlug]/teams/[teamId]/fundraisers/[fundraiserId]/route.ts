import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepFundraiser,
  getOrCreateRepTeamLedger,
  createEntry,
  setRepTeamFundraiserTags,
} from '@/lib/db';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';
import { isSponsorStatus, resolveCredit } from '@/lib/coach-fundraising';

/**
 * Re-derive a sponsor's money from what it is now.
 *
 * ⚠ RE-DERIVED, NOT PATCHED. The amount, the family and the status decide TOGETHER whether an
 * income row and a dues credit should exist; applying them one at a time is how an edit leaves a
 * credit sitting on a family's bill for money that was never received, or leaves the books
 * carrying income for a cheque that turned back into a pledge. So the whole picture is recomputed
 * and the three linked rows are brought into line with it.
 *
 * The single entry is the sponsor's record of the arrangement and always survives; what comes and
 * goes is the accounting row and the credit.
 */
async function applySponsorMoney(args: {
  team: { id: string; orgId: string; name: string };
  programYear: { id: string };
  record: Record<string, any>;
  body: Record<string, any>;
  userId: string;
}): Promise<{ ok: true } | { error: Response }> {
  const { team, programYear, record, body, userId } = args;

  const { data: entry } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('*')
    .eq('fundraiser_id', record.id)
    .maybeSingle();
  if (!entry) return { error: NextResponse.json({ error: 'This sponsor has no record to update.' }, { status: 404 }) };

  const amount = body.sponsorAmount !== undefined ? Number(body.sponsorAmount) : Number(entry.amount_raised);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: NextResponse.json({ error: 'A sponsor needs an amount greater than zero.' }, { status: 400 }) };
  }

  const playerId = body.broughtInById !== undefined
    ? (body.broughtInById || null)
    : (entry.player_id as string | null);

  if (playerId && body.broughtInById !== undefined) {
    const { data: player } = await supabaseAdmin
      .from('rep_roster_players')
      .select('id')
      .eq('id', playerId)
      .eq('program_year_id', programYear.id)
      .maybeSingle();
    if (!player) {
      return { error: NextResponse.json({ error: 'That player is not on this season’s roster.' }, { status: 400 }) };
    }
  }

  // Nobody to credit means no credit, whatever was typed.
  const { credit, percent } = playerId
    ? (body.creditValue !== undefined
        ? resolveCredit(amount, Number(body.creditValue), body.creditUnit === 'amount' ? 'amount' : 'percent')
        // The amount changed but the split did not: keep the AGREED SHARE, not the old dollars.
        // "Half" stays half when a cheque is corrected from $250 to $300.
        : resolveCredit(amount, Number(entry.rebate_percent) || 0, 'percent'))
    : { credit: 0, percent: 0 };

  const received = record.sponsor_status === 'received';
  const today = tournamentToday();

  // ── The books ──
  let accountingEntryId: string | null = entry.accounting_entry_id ?? null;
  if (received && !accountingEntryId) {
    const ledger = await getOrCreateRepTeamLedger(team.orgId, team.id, team.name);
    const posted = await createEntry(ledger.id, {
      entryDate: today,
      description: `Sponsorship — ${record.name}`,
      amount,
      entryType: 'income',
      status: 'posted',
      category: 'fundraising',
    }, userId);
    accountingEntryId = posted.id;
  } else if (received && accountingEntryId) {
    await supabaseAdmin.from('accounting_entries')
      .update({ amount, description: `Sponsorship — ${record.name}`, updated_at: new Date().toISOString() })
      .eq('id', accountingEntryId);
  } else if (!received && accountingEntryId) {
    // Back to a pledge: the money is not the team's, so the books must stop saying it is.
    await supabaseAdmin.from('accounting_entries').delete().eq('id', accountingEntryId);
    accountingEntryId = null;
  }

  // ── The family's credit ──
  let creditId: string | null = entry.credit_id ?? null;
  const wantsCredit = received && !!playerId && credit > 0.005;
  if (wantsCredit && !creditId) {
    const { data: row, error: creditErr } = await supabaseAdmin.from('rep_dues_credits').insert({
      program_year_id: programYear.id,
      player_id: playerId,
      amount: credit,
      description: `Sponsorship — ${record.name}`,
      credit_type: 'fundraiser',
      credit_date: today,
      created_by: userId,
      fundraiser_entry_id: entry.id,
    }).select().single();
    // ⚠ Same rule as the create path: the entry must never claim a credit the family never got.
    if (creditErr || !row) {
      console.error('[sponsor] credit insert failed on edit', { entryId: entry.id, error: creditErr });
      return { error: NextResponse.json({
        error: 'The sponsor was saved, but the family credit could not be applied. Set the credit again.',
      }, { status: 500 }) };
    }
    creditId = row.id;
  } else if (wantsCredit && creditId) {
    await supabaseAdmin.from('rep_dues_credits')
      .update({ amount: credit, player_id: playerId, description: `Sponsorship — ${record.name}` })
      .eq('id', creditId);
  } else if (!wantsCredit && creditId) {
    await supabaseAdmin.from('rep_dues_credits').delete().eq('id', creditId);
    creditId = null;
  }

  await supabaseAdmin.from('rep_fundraiser_entries').update({
    player_id: playerId,
    amount_raised: amount,
    rebate_percent: percent,
    rebate_amount: credit,
    accounting_entry_id: accountingEntryId,
    credit_id: creditId,
    updated_at: new Date().toISOString(),
  }).eq('id', entry.id);

  return { ok: true };
}

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

// PATCH /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]
// Updates fundraiser header fields (name, description, rebate %, dates, isActive).
// Changing player_rebate_percent only affects future entries — existing entries
// snapshot their percent at creation time.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> },) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
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

  /**
   * ── A SPONSOR'S OWN FIELDS ─────────────────────────────────────────────────────────────────
   *
   * ⚠ THE KIND IS NEVER IN `updates`. A drive's rows are players and a sponsor is one arrival, so
   * switching afterwards has nothing sensible to do with what is already recorded — the picker is
   * create-time only and the server refuses it here rather than trusting that.
   *
   * The money is re-derived rather than patched: amount, credit and status decide together
   * whether an income row and a family credit should exist, so writing them one at a time is how
   * a half-applied edit leaves a credit on a bill for money that was never received.
   */
  const isSponsor = existing.kind === 'sponsor';
  if (body.kind !== undefined && body.kind !== existing.kind) {
    return NextResponse.json({
      error: 'A fundraiser cannot become a sponsor, or the other way round — its records mean different things.',
    }, { status: 400 });
  }
  const touchesSponsorMoney = ['sponsorAmount', 'sponsorStatus', 'broughtInById', 'creditValue']
    .some(k => body[k] !== undefined);
  if (touchesSponsorMoney && !isSponsor) {
    return NextResponse.json({ error: 'Those fields belong to a sponsor.' }, { status: 400 });
  }
  if (isSponsor && body.sponsorStatus !== undefined) {
    if (!isSponsorStatus(body.sponsorStatus)) {
      return NextResponse.json({ error: 'sponsorStatus must be pledged or received' }, { status: 400 });
    }
    updates.sponsor_status = body.sponsorStatus;
  }

  const { data, error } = await supabaseAdmin
    .from('rep_fundraisers')
    .update(updates)
    .eq('id', fundraiserId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isSponsor && touchesSponsorMoney) {
    const applied = await applySponsorMoney({
      team, programYear, record: data, body, userId: ctx!.user.id,
    });
    if ('error' in applied) return applied.error;
  }

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
