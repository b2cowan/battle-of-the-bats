import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getOrCreateRepTeamLedger,
  getRepDuesPaymentsByProgramYear,
  getRepDuesCreditsByProgramYear,
  getRepDuesPayoutsByProgramYear,
  getRepFundraiser,
  createEntry,
  getRepTeamTagLibrary,
  getRepTeamFundraiserTagsMap,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday, orgDayKey } from '@/lib/timezone';
import { deriveDuesPosition, groupByPlayer, totalsByPlayer } from '@/lib/dues-credits';
import { creditExposure } from '@/lib/dues-credit-guards';

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

function mapEntry(e: Record<string, unknown>) {
  return {
    id:                 e.id,
    fundraiserId:       e.fundraiser_id,
    playerId:           e.player_id,
    amountRaised:       Number(e.amount_raised),
    rebatePercent:      Number(e.rebate_percent),
    rebateAmount:       Number(e.rebate_amount),
    accountingEntryId:  e.accounting_entry_id ?? null,
    creditId:           e.credit_id ?? null,
    notes:              e.notes ?? null,
    /* ⚠ THE DAY THE MONEY ARRIVED (mig 261) — returned so the leaderboard's edit form can show it
       and correct it (P2). Without this the create path could set a date the edit path could not
       even display, which is how a wrong month becomes permanent. */
    receivedDate:       e.received_date ?? null,
    /* ⚠⚠ WHAT THE COACH ACTUALLY SEES THIS ROW DATED, and the ONLY thing an edit form may pre-fill.
       Pre-mig-261 rows carry NO received date; the register falls back to the org-clock day the row
       was created, and so must anything that offers to correct that date. Pre-filling TODAY instead
       (the first cut did) meant a coach editing an old entry's AMOUNT silently moved its ledger row
       and the family's credit into this month — see the PATCH's own note. One rule, one place:
       `received_date ?? orgDayKey(created_at)`, exactly as `register/route.ts` states it. */
    effectiveDate:      (e.received_date as string | null) ?? orgDayKey(e.created_at as string),
    createdAt:          e.created_at,
    updatedAt:          e.updated_at,
  };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries
// Returns per-player entries joined with player names, plus a summary.
//
// ⚠ ON THE SEASON-READ RAIL (2026-08-14, approved in the write-guard test's list). The
// fundraisers LIST has served `?year=` since Chunk F, so an archived Money hub correctly lists
// that season's drives — but opening one landed here, which resolved the ACTIVE year and paired
// a 2025 fundraiser with the 2026 roster. The archive door was already open; only its last room
// was furnished from the wrong season. Capabilities come from the RESOLVED season's assignment
// row (governing rule 1), so an assistant granted money in 2025 and not since still reads 2025.
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> },) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Year-scoped: a fundraiser id from another season is a 404 here, not a page rendered from
  // whichever season the reader happens to be standing in.
  const fundraiser = await getRepFundraiser(fundraiserId, teamId, programYear.id);
  if (!fundraiser) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });

  const [{ data: entries }, { data: roster }] = await Promise.all([
    supabaseAdmin
      .from('rep_fundraiser_entries')
      .select('*')
      .eq('fundraiser_id', fundraiserId)
      .order('amount_raised', { ascending: false }),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .eq('program_year_id', programYear.id)
      .eq('status', 'active'),
  ]);

  // Each player's dues position, derived the ONE way every dues surface derives it (owner model
  // 2026-08-14): payments allocate to installments, credits land on the cash remainders in the
  // team's application mode. The previous version summed paid STAMPS (reading a part-paid family
  // as having paid nothing) and clamped a credits-subtracted figure it called "outstanding" — a
  // different number wearing the shared definition's word.
  const rosterIds = (roster ?? []).map(p => p.id);
  const [{ data: allInstallments }, seasonPayments, seasonCredits, seasonPayouts] = await Promise.all([
    supabaseAdmin
      .from('rep_player_dues_installments')
      .select('id, schedule_id, player_id, installment_number, amount, due_date, paid_at')
      .in('player_id', rosterIds),
    getRepDuesPaymentsByProgramYear(programYear.id),
    getRepDuesCreditsByProgramYear(programYear.id),
    getRepDuesPayoutsByProgramYear(programYear.id),
  ]);
  const paidOutByPlayer = totalsByPlayer(seasonPayouts);

  const instsByPlayer = new Map<string, any[]>();
  for (const i of (allInstallments ?? []) as any[]) {
    if (!instsByPlayer.has(i.player_id)) instsByPlayer.set(i.player_id, []);
    instsByPlayer.get(i.player_id)!.push(i);
  }
  const paysByPlayer = groupByPlayer(seasonPayments); // generic {playerId} grouper
  const creditsByPlayer = groupByPlayer(seasonCredits);

  const entryMap = new Map<string, Record<string, unknown>>();
  for (const e of entries ?? []) entryMap.set(e.player_id as string, e as Record<string, unknown>);

  const playerRows = (roster ?? []).map(p => {
    const insts = instsByPlayer.get(p.id) ?? [];
    const { position } = deriveDuesPosition({
      installments: insts.map((i: any) => ({ id: i.id, installmentNumber: i.installment_number, amount: Number(i.amount), paidAt: i.paid_at ?? null })),
      payments: paysByPlayer.get(p.id) ?? [],
      credits: creditsByPlayer.get(p.id) ?? [],
      paidOut: paidOutByPlayer.get(p.id) ?? 0,
      mode: programYear.creditApplication,
    });
    const instById = new Map(insts.map((i: any) => [i.id as string, i]));
    const entry = entryMap.get(p.id);

    return {
      playerId:       p.id,
      playerName:     [p.player_first_name, p.player_last_name].filter(Boolean).join(' '),
      // What this family is still asked to SEND — the honest name for the figure the old
      // payload called remainingDues (plan §7.6).
      leftToSend:     position.leftToSend,
      // The open bills, for the "Where it lands" preview: the sheet shows which bills a new
      // rebate would lower BEFORE the coach saves (mockup §2).
      openBills: position.perInstallment
        .filter(b => b.toSend > 0.005)
        .map(b => ({
          installmentNumber: b.installmentNumber,
          dueDate: (instById.get(b.installmentId)?.due_date as string | undefined) ?? null,
          // Same insts list built both maps — the id is always present.
          amount: Number(instById.get(b.installmentId)!.amount),
          toSend: b.toSend,
        })),
      entry:          entry ? mapEntry(entry) : null,
    };
  });

  // Sort: players with entries first (desc by amount_raised), then remaining roster
  playerRows.sort((a, b) => {
    if (a.entry && !b.entry) return -1;
    if (!a.entry && b.entry) return  1;
    if (a.entry && b.entry) return (b.entry.amountRaised as number) - (a.entry.amountRaised as number);
    return a.playerName.localeCompare(b.playerName);
  });

  const allEntries = entries ?? [];
  const totalRaised  = allEntries.reduce((s, e) => s + Number(e.amount_raised), 0);
  const totalRebates = allEntries.reduce((s, e) => s + Number(e.rebate_amount), 0);

  // ⚠ Sponsor only (arrivals model, mig 268): the record page's raw material — the credit PLAN,
  // each ARRIVAL, and how many dollars of each family's accrued credit are already spoken for by
  // cash payouts (the figure the agreement sheet warns with BEFORE the payout floor refuses).
  let sponsorCreditExposure = 0; // legacy scalar: the LARGEST family exposure, kept for the sheet
  const sponsorExposureByFamily: { playerId: string; exposure: number }[] = [];
  let sponsorCreditPlan: { playerId: string; playerName: string | null; value: number; unit: string }[] = [];
  let sponsorArrivals: {
    entryId: string; amount: number; receivedDate: string | null; method: string | null;
    notes: string | null; credited: number;
  }[] = [];
  if ((fundraiser.kind ?? 'fundraiser') === 'sponsor') {
    const nameByPlayer = new Map((roster ?? []).map(p => [p.id, [p.player_first_name, p.player_last_name].filter(Boolean).join(' ')]));
    const { data: planRows } = await supabaseAdmin
      .from('rep_fundraiser_credit_plan')
      .select('player_id, share_value, share_unit')
      .eq('fundraiser_id', fundraiserId)
      .order('created_at', { ascending: true });
    sponsorCreditPlan = (planRows ?? []).map(p => ({
      playerId: p.player_id as string,
      playerName: nameByPlayer.get(p.player_id as string) ?? null,
      value: Number(p.share_value),
      unit: p.share_unit as string,
    }));

    const entryIds = allEntries.map(e => e.id as string);
    const creditsByEntry = new Map<string, number>();
    const sponsorAccrued = new Map<string, number>(); // per family, from THIS sponsor
    if (entryIds.length) {
      const { data: linked } = await supabaseAdmin
        .from('rep_dues_credits')
        .select('id, player_id, amount, fundraiser_entry_id')
        .in('fundraiser_entry_id', entryIds);
      for (const c of linked ?? []) {
        const eid = c.fundraiser_entry_id as string;
        creditsByEntry.set(eid, Math.round(((creditsByEntry.get(eid) ?? 0) + Number(c.amount)) * 100) / 100);
        if (c.player_id) {
          sponsorAccrued.set(c.player_id, Math.round(((sponsorAccrued.get(c.player_id) ?? 0) + Number(c.amount)) * 100) / 100);
        }
      }
    }
    sponsorArrivals = allEntries
      .slice()
      .sort((a, b) => String(a.received_date ?? '').localeCompare(String(b.received_date ?? '')) || String(a.created_at).localeCompare(String(b.created_at)))
      .map(e => ({
        entryId: e.id as string,
        amount: Number(e.amount_raised),
        receivedDate: (e.received_date as string | null) ?? null,
        method: (e.method as string | null) ?? null,
        notes: (e.notes as string | null) ?? null,
        credited: creditsByEntry.get(e.id as string) ?? 0,
      }));

    // Exposure per family: how much of THIS sponsor's accrued credit is already paid out, given
    // the family's other credits. The sheet warns with it; the floor refuses on it.
    for (const [playerId, accrued] of sponsorAccrued) {
      const familyCredits = (creditsByPlayer.get(playerId) ?? []) as { id: string; amount: number; creditType: string }[];
      const exposure = creditExposure(
        { id: `sponsor:${fundraiserId}:${playerId}`, amount: accrued },
        [
          // This sponsor's slice as one synthetic credit beside the family's OTHER credits —
          // creditExposure excludes by id, so the sponsor's own linked rows are re-shaped here.
          { id: `sponsor:${fundraiserId}:${playerId}`, amount: accrued, creditType: 'fundraiser' },
          ...familyCredits.filter(c => {
            const viaSponsor = allEntries.some(e => (c as Record<string, unknown>).fundraiserEntryId === e.id);
            return !viaSponsor;
          }),
        ],
        [{ amount: paidOutByPlayer.get(playerId) ?? 0 }],
      );
      if (exposure > 0.005) sponsorExposureByFamily.push({ playerId, exposure });
      if (exposure > sponsorCreditExposure) sponsorCreditExposure = exposure;
    }
  }

  // The record's money tags, and the library behind the picker in its Settings sheet. The library
  // is the team's LIVE vocabulary even in an archived season — a tag is an instrument, and the
  // read-only sheet never opens there anyway; what the archive must show correctly is which tags
  // this record carries, which comes from the record.
  const [moneyTags, tagsByFundraiserId] = await Promise.all([
    getRepTeamTagLibrary(teamId, 'expense', ctx!.org.id),
    getRepTeamFundraiserTagsMap([fundraiserId]),
  ]);

  return NextResponse.json({
    fundraiser: {
      id:                  fundraiser.id,
      // The kind decides what this screen IS — a leaderboard for a drive, a single record for a
      // sponsor. Without it the client would draw a roster of fifteen "—" rows against one
      // sponsor, which is the exact shape sponsorships were added to stop.
      kind:                fundraiser.kind ?? 'fundraiser',
      sponsorStatus:       fundraiser.sponsor_status ?? null,
      expectedBy:          fundraiser.expected_by ?? null,
      name:                fundraiser.name,
      description:         fundraiser.description ?? null,
      playerRebatePercent: Number(fundraiser.player_rebate_percent),
      startDate:           fundraiser.start_date ?? null,
      endDate:             fundraiser.end_date   ?? null,
      isActive:            fundraiser.is_active,
      tagIds:              tagsByFundraiserId[fundraiserId] ?? [],
    },
    moneyTags,
    summary: {
      totalRaised:  Math.round(totalRaised  * 100) / 100,
      teamNet:      Math.round((totalRaised - totalRebates) * 100) / 100,
      // What THIS DRIVE awarded (Σ rebate_amount) — deliberately not a credits-table read: a
      // credit can later be applied, paid out or forgiven while the award stands (plan §7.5).
      totalCredits: Math.round(totalRebates * 100) / 100,
      playerCount:  allEntries.length,
    },
    // The team's credits setting — the "Where it lands" preview walks bills in this direction.
    creditApplication: programYear.creditApplication,
    sponsorCreditExposure,
    // The record page's raw material (arrivals model, mig 268) — empty/zero for a drive.
    sponsorCreditPlan,
    sponsorArrivals,
    sponsorExposureByFamily,
    pledgedAmount: fundraiser.pledged_amount != null ? Number(fundraiser.pledged_amount) : null,
    players: playerRows,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries' });

// POST /api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries
// Logs or updates a player's fundraising amount for this fundraiser.
// Creates: accounting_entries income record + rep_fundraiser_entries row +
// rep_dues_credits row (when rebate > 0). All three are linked by FK.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> },) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // The ACTIVE year, always — the write side never reads `?year=`, so a finished season's
  // fundraiser is not addressable from here at all (write-guard rule).
  const fundraiser = await getRepFundraiser(fundraiserId, team.id, programYear.id);
  if (!fundraiser) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });
  /**
   * ⚠ A SPONSOR IS NOT A DRIVE, AND THIS IS THE DRIVE'S DOOR.
   *
   * This route predates sponsors and enforces a drive's rules only: it checks `is_active` (which
   * a sponsor carries as `true` by column default and never uses) and knows nothing of
   * `sponsor_status`. Left open it would let a caller holding legitimate money-write add a SECOND
   * entry to a sponsor — breaking the one-record-one-entry invariant every sponsor read depends
   * on — and post real income plus a real dues credit for a sponsorship still marked PLEDGED,
   * which is the precise thing the pledged/received split exists to prevent.
   *
   * A sponsor's amount is edited through its own record, where status and credit are decided
   * together (review, 2026-08-15).
   */
  if (fundraiser.kind === 'sponsor') {
    return NextResponse.json({
      error: 'A sponsor is recorded as one amount on the sponsor itself, not logged per player.',
    }, { status: 400 });
  }
  if (!fundraiser.is_active) return NextResponse.json({ error: 'Fundraiser is closed' }, { status: 400 });

  const body = await req.json();
  const { playerId, amountRaised, notes = null, receivedDate = null } = body;

  if (!playerId) return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  const raised = Number(amountRaised);
  if (isNaN(raised) || raised < 0) {
    return NextResponse.json({ error: 'amountRaised must be a non-negative number' }, { status: 400 });
  }
  /* Optional since 2026-08-23 (owner ruling, money centralization §80 walk): treasurers log
     drive money AFTER it arrived and need it in the PERIOD it arrived — the month reports read
     the ledger entry's date. Same shape and validation as the dues receipt's receivedDate;
     omitted = today, exactly the old behaviour. */
  if (receivedDate !== null && (typeof receivedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate))) {
    return NextResponse.json({ error: 'receivedDate must be a YYYY-MM-DD date' }, { status: 400 });
  }

  const { data: player } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name')
    .eq('id', playerId)
    .eq('program_year_id', programYear.id)
    .single();

  if (!player) return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });

  const { data: existingEntry } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .select('id')
    .eq('fundraiser_id', fundraiserId)
    .eq('player_id', playerId)
    .maybeSingle();

  if (existingEntry) {
    return NextResponse.json(
      { error: 'An entry already exists for this player. Use PATCH to update it.' },
      { status: 409 },
    );
  }

  const rebatePct    = Number(fundraiser.player_rebate_percent);
  const rebateAmount = Math.round(raised * rebatePct / 100 * 100) / 100;
  /* The day the money ARRIVED — coach-typed or today. It dates BOTH writes below: the ledger
     entry (which is what places the income in a month on every report) and the family's credit
     (earned the day the money arrived; credit ordering applies by this date). */
  const receivedDay  = receivedDate ?? tournamentToday();
  const playerName   = [player.player_first_name, player.player_last_name].filter(Boolean).join(' ');

  // 1 — Create team ledger income entry
  const ledger = await getOrCreateRepTeamLedger(team.orgId, team.id, team.name);
  const accountingEntry = await createEntry(
    ledger.id,
    {
      entryDate:   receivedDay,
      description: `Fundraiser income — ${fundraiser.name} (${playerName})`,
      amount:      raised,
      entryType:   'income',
      status:      'posted',
      category:    'fundraising',
    },
    ctx!.user.id,
  );

  // 2 — Create fundraiser entry row
  const { data: feRow, error: feErr } = await supabaseAdmin
    .from('rep_fundraiser_entries')
    .insert({
      fundraiser_id:      fundraiserId,
      org_id:             team.orgId,
      team_id:            team.id,
      player_id:          playerId,
      amount_raised:      raised,
      rebate_percent:     rebatePct,
      rebate_amount:      rebateAmount,
      accounting_entry_id: accountingEntry.id,
      // mig 261 — the entry itself remembers the day (the register reads THIS, not the ledger).
      received_date:      receivedDay,
      notes:              notes?.trim() || null,
    })
    .select()
    .single();

  if (feErr) return NextResponse.json({ error: feErr.message }, { status: 500 });

  let credit = null;

  // 3 — Create dues credit if rebate > 0
  if (rebateAmount > 0) {
    const { data: creditRow, error: cErr } = await supabaseAdmin
      .from('rep_dues_credits')
      .insert({
        program_year_id:    programYear.id,
        player_id:          playerId,
        amount:             rebateAmount,
        description:        `Fundraiser rebate — ${fundraiser.name}`,
        credit_type:        'fundraiser',
        credit_date:        receivedDay,
        notes:              null,
        created_by:         ctx!.user.id,
        fundraiser_entry_id: feRow.id,
      })
      .select()
      .single();

    if (!cErr && creditRow) {
      // 4 — Link the credit back to the entry
      await supabaseAdmin
        .from('rep_fundraiser_entries')
        .update({ credit_id: creditRow.id, updated_at: new Date().toISOString() })
        .eq('id', feRow.id);

      credit = {
        id:          creditRow.id,
        amount:      Number(creditRow.amount),
        description: creditRow.description,
        creditDate:  creditRow.credit_date,
      };
    }
  }

  return NextResponse.json({
    entry: mapEntry({ ...feRow, credit_id: credit?.id ?? null } as Record<string, unknown>),
    credit,
    accountingEntryId: accountingEntry.id,
  }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/entries' });
