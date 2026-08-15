import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getOrCreateRepTeamLedger,
  createEntry,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';
import { tournamentToday } from '@/lib/timezone';
import { isFundraisingKind, isSponsorStatus, resolveCredit } from '@/lib/coach-fundraising';

/** The list shape a freshly-created record answers with — the table needs every column it prints. */
function mapNewRecord(row: Record<string, any>, money?: { amount: number; credit: number }) {
  const amount = money?.amount ?? 0;
  const credit = money?.credit ?? 0;
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
    totalRaised:         amount,
    teamNet:             Math.round((amount - credit) * 100) / 100,
    totalCredits:        credit,
    playerCount:         0,
    broughtInBy:         null,
    broughtInById:       null,
  };
}

/**
 * Write a sponsor's single arrival: the entry always, the books and the family's credit ONLY once
 * the money is actually in.
 *
 * ⚠ PLEDGED IS NOT MONEY. The entry exists either way because it records the arrangement — the
 * amount, who brought it in, what was agreed — but a pledge posts nothing to the team's books and
 * lands nothing on a family's dues. A season that counted promises as income would flatter itself,
 * and a family whose bill dropped on a cheque that never arrived would have to be un-credited by
 * hand.
 */
async function writeSponsorArrival(args: {
  team: { id: string; orgId: string; name: string };
  programYear: { id: string };
  record: Record<string, any>;
  amount: number;
  credit: number;
  percent: number;
  playerId: string | null;
  userId: string;
}): Promise<{ entryId: string } | { error: Response }> {
  const { team, programYear, record, amount, credit, percent, playerId, userId } = args;
  const received = record.sponsor_status === 'received';
  const today = tournamentToday();

  let accountingEntryId: string | null = null;
  if (received) {
    const ledger = await getOrCreateRepTeamLedger(team.orgId, team.id, team.name);
    const posted = await createEntry(
      ledger.id,
      {
        entryDate:   today,
        description: `Sponsorship — ${record.name}`,
        amount,
        entryType:   'income',
        status:      'posted',
        category:    'fundraising',
      },
      userId,
    );
    accountingEntryId = posted.id;
  }

  const { data: entry, error: entryErr } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .insert({
      fundraiser_id:       record.id,
      org_id:              team.orgId,
      team_id:             team.id,
      // Null for a club-wide sponsor — the whole reason migration 237 relaxed this column.
      player_id:           playerId,
      amount_raised:       amount,
      rebate_percent:      percent,
      rebate_amount:       credit,
      accounting_entry_id: accountingEntryId,
    })
    .select()
    .single();

  if (entryErr) {
    /**
     * ⚠ UNDO THE POSTING. There is no transaction across these writes, and the income row was
     * created first — so without this the team's books keep real income for a sponsor that has no
     * entry, the list shows it as $0 raised (totals come from entries), and every later edit dies
     * on "this sponsor has no record to update". Money on the books that no screen can explain is
     * worse than a failed save (review, 2026-08-15).
     */
    if (accountingEntryId) {
      await supabaseAdmin.from('accounting_entries').delete().eq('id', accountingEntryId);
    }
    return { error: NextResponse.json({ error: entryErr.message }, { status: 500 }) };
  }

  if (received && playerId && credit > 0) {
    const { data: creditRow, error: creditErr } = await supabaseAdmin
      .from('rep_dues_credits')
      .insert({
        program_year_id:     programYear.id,
        player_id:           playerId,
        amount:              credit,
        description:         `Sponsorship — ${record.name}`,
        credit_type:         'fundraiser',
        credit_date:         today,
        created_by:          userId,
        fundraiser_entry_id: entry.id,
      })
      .select()
      .single();
    /**
     * ⚠ A FAILED CREDIT MUST NOT READ AS A GIVEN ONE. The entry already carries `rebate_amount`,
     * so swallowing this error left the screen and the export both saying a family had been
     * credited while their dues were untouched — the one direction of this bug a coach would
     * never notice, because the number they check says what they expect.
     */
    if (creditErr || !creditRow) {
      console.error('[sponsor] credit insert failed', { entryId: entry.id, error: creditErr });
      await supabaseAdmin
        .from('rep_fundraiser_entries')
        .update({ rebate_amount: 0, rebate_percent: 0, updated_at: new Date().toISOString() })
        .eq('id', entry.id);
      return {
        error: NextResponse.json({
          error: 'The sponsor was saved, but the family credit could not be applied. Open it and set the credit again.',
        }, { status: 500 }),
      };
    }
    await supabaseAdmin
      .from('rep_fundraiser_entries')
      .update({ credit_id: creditRow.id, updated_at: new Date().toISOString() })
      .eq('id', entry.id);
  }

  return { entryId: entry.id };
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

// GET /api/coaches/[orgSlug]/teams/[teamId]/fundraisers
// Returns all fundraisers with per-fundraiser totals.
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const { data: fundraisers, error: fErr } = await supabaseAdmin
    .from('rep_fundraisers')
    .select('*')
    .eq('program_year_id', programYear.id)
    .order('created_at', { ascending: false });

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });

  if (!fundraisers?.length) return NextResponse.json({ fundraisers: [] });

  const fundraiserIds = fundraisers.map(f => f.id);
  const { data: entries } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('fundraiser_id, player_id, amount_raised, rebate_amount')
    .in('fundraiser_id', fundraiserIds);

  const totalsMap = new Map<string, { totalRaised: number; totalRebates: number; playerCount: number }>();
  // A SPONSOR's one entry names the family who brought it in — the two muted words the list keeps
  // beside a sponsor's name, and the reason a coach scans a sponsor list at all. A club-wide
  // sponsor has no player (migration 237), which is an ABSENCE on the row rather than an em-dash.
  const attributedPlayerId = new Map<string, string>();
  for (const e of entries ?? []) {
    const existing = totalsMap.get(e.fundraiser_id) ?? { totalRaised: 0, totalRebates: 0, playerCount: 0 };
    totalsMap.set(e.fundraiser_id, {
      totalRaised:  existing.totalRaised  + Number(e.amount_raised),
      totalRebates: existing.totalRebates + Number(e.rebate_amount),
      // Only a real player counts toward "how many have logged something" — a sponsor's
      // playerless entry must not read as a player.
      playerCount:  existing.playerCount  + (e.player_id ? 1 : 0),
    });
    if (e.player_id && !attributedPlayerId.has(e.fundraiser_id)) {
      attributedPlayerId.set(e.fundraiser_id, e.player_id as string);
    }
  }

  // One lookup for every attributed family, not one per row.
  const playerIds = [...new Set(attributedPlayerId.values())];
  const nameById = new Map<string, string>();
  if (playerIds.length) {
    const { data: players } = await supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .in('id', playerIds);
    for (const p of players ?? []) {
      nameById.set(p.id, [p.player_first_name, p.player_last_name].filter(Boolean).join(' '));
    }
  }

  const result = fundraisers.map(f => {
    const t = totalsMap.get(f.id) ?? { totalRaised: 0, totalRebates: 0, playerCount: 0 };
    const attributed = attributedPlayerId.get(f.id);
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
      totalRaised:         Math.round(t.totalRaised  * 100) / 100,
      teamNet:             Math.round((t.totalRaised - t.totalRebates) * 100) / 100,
      totalCredits:        Math.round(t.totalRebates * 100) / 100,
      playerCount:         t.playerCount,
      // Sponsor only — null on a drive, and null on a club-wide sponsor.
      broughtInBy:         f.kind === 'sponsor' && attributed ? (nameById.get(attributed) ?? null) : null,
      broughtInById:       f.kind === 'sponsor' ? (attributed ?? null) : null,
    };
  });

  return NextResponse.json({ fundraisers: result });
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
    // ── Sponsor-only ──
    kind = 'fundraiser',
    sponsorStatus = 'received',
    sponsorAmount = 0,
    broughtInById = null,
    creditValue = 0,
    creditUnit = 'percent',
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
    return NextResponse.json({ fundraiser: mapNewRecord(data) }, { status: 201 });
  }

  // ── A SPONSOR: one record AND its single arrival, written together. ──
  //
  // ⚠ The entry is what makes every existing reader work unchanged — totals, exports, the archive
  // and deletion all read entries, so a sponsor that stored its amount on the record instead would
  // need a parallel path through all of them.
  if (!isSponsorStatus(sponsorStatus)) {
    return NextResponse.json({ error: 'sponsorStatus must be pledged or received' }, { status: 400 });
  }
  const amount = Number(sponsorAmount);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'A sponsor needs an amount greater than zero.' }, { status: 400 });
  }
  if (creditUnit !== 'amount' && creditUnit !== 'percent') {
    return NextResponse.json({ error: 'creditUnit must be amount or percent' }, { status: 400 });
  }

  // Nobody to credit means no credit, whatever was typed — the field is disabled in the UI for
  // exactly this case, and a client that sends one anyway must not create an orphan.
  const { credit, percent } = broughtInById
    ? resolveCredit(amount, Number(creditValue), creditUnit)
    : { credit: 0, percent: 0 };

  if (broughtInById) {
    const { data: player } = await supabaseAdmin
      .from('rep_roster_players')
      .select('id')
      .eq('id', broughtInById)
      .eq('program_year_id', programYear.id)
      .maybeSingle();
    if (!player) {
      return NextResponse.json({ error: 'That player is not on this season’s roster.' }, { status: 400 });
    }
  }

  const { data: record, error: recErr } = await supabaseAdmin
    .from('rep_fundraisers')
    .insert({
      org_id:               team.orgId,
      team_id:              team.id,
      program_year_id:      programYear.id,
      kind:                 'sponsor',
      sponsor_status:       sponsorStatus,
      name:                 name.trim(),
      description:          description?.trim() || null,
      // The sponsor's own rate, kept for the same reason a drive keeps one: it explains the
      // credit after the fact ("50% of $250") without anyone re-deriving it.
      player_rebate_percent: percent,
      start_date:           startDate || null,
      end_date:             endDate   || null,
    })
    .select()
    .single();

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });

  const money = await writeSponsorArrival({
    team, programYear, record, amount, credit, percent,
    playerId: broughtInById, userId: ctx!.user.id,
  });
  if ('error' in money) return money.error;

  return NextResponse.json({ fundraiser: mapNewRecord(record, { amount, credit }) }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers' });
