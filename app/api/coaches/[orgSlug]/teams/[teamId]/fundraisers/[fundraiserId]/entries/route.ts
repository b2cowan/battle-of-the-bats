import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getOrCreateRepTeamLedger,
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
import { futureReceivedDateRefusal } from '@/lib/money-date-guards';
import { groupByPlayer, totalsByPlayer } from '@/lib/dues-credits';
import { WHOLE_TEAM_ENTRY_LABEL } from '@/lib/coach-fundraising';
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

  /* ⚠ THE WHOLE ROSTER, status included — not just the active slice. The band's entries list
     (2026-08-31) shows every logged amount REGARDLESS of the player's roster status: the old
     roster-projected board silently dropped an inactive player's entry while its dollars stayed
     on the books, which once left a drive undeletable with directions pointing at rows the board
     could not show. Everything that always worked on the active slice (dues positions, the
     Record window's player list, sponsor plan names) keeps reading exactly that slice below. */
  const [{ data: entries }, { data: fullRoster }] = await Promise.all([
    supabaseAdmin
      .from('rep_fundraiser_entries')
      .select('*')
      .eq('fundraiser_id', fundraiserId)
      .order('amount_raised', { ascending: false }),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name, status')
      .eq('program_year_id', programYear.id),
  ]);
  const roster = (fullRoster ?? []).filter(p => p.status === 'active');

  /* ⚰ THE PER-PLAYER DUES POSITION LEFT THIS ROUTE (owner ruling 2026-08-31). It fed exactly two
     things, both retired the same day their surfaces were: the "Left to send" column (the dues
     figure the drill-in borrowed onto a fundraiser board) and the "Where it lands" preview's
     `openBills` (the Record form now states the credit in one sentence instead of computing its
     landing). The family's real position still lives where dues are managed. The season credits
     and payouts reads that used to sit here moved INTO the sponsor block below (/simplify
     efficiency lens, 2026-09-01): only the payout-floor exposure needs them, and a drive's
     expansion was paying for two whole-season table reads it never looked at. */

  /* ⚠⚠ A PLAYER'S TOTAL, NOT "THEIR ENTRY" (mig 287). This projection served one entry per player
     and was keyed by a Map that overwrote — safe only while the database guaranteed one row per
     player, which it no longer does. Left as it was, a player who handed in twice would have
     reported whichever row the amount-desc read happened to set LAST: their SMALLEST hand-in,
     silently, as though it were everything they had raised. It is summed instead, and `logged`
     names what it now is.
     ⚠ `null` MEANS "HAS NOT HANDED ANYTHING IN", and it is not the same as 0 — a player CAN be
     recorded with $0 raised (dictionary gotcha 5), and the Record door's consequence sentence asks
     this exact question to decide whether to name a resulting total. */
  const loggedByPlayer = new Map<string, number>();
  for (const e of entries ?? []) {
    if (!e.player_id) continue; // the whole team is not a player — it is never in this list
    loggedByPlayer.set(e.player_id as string,
      (loggedByPlayer.get(e.player_id as string) ?? 0) + Number(e.amount_raised));
  }

  /* ⚠ ROUNDED ONCE, AT THE READ (`/simplify`, 2026-09-10). The first cut rounded inside the loop,
     on every addition to a player's running total — work whose only meaningful result is the final
     figure, and which reads as though the intermediate cents mattered. They do not; the sum does. */
  const playerRows = (roster ?? []).map(p => {
    const logged = loggedByPlayer.get(p.id);
    return {
      playerId:       p.id,
      playerName:     [p.player_first_name, p.player_last_name].filter(Boolean).join(' '),
      logged:         logged === undefined ? null : Math.round(logged * 100) / 100,
    };
  });

  // Sort: players who have logged something first (desc by total), then the rest of the roster.
  playerRows.sort((a, b) => {
    if (a.logged !== null && b.logged === null) return -1;
    if (a.logged === null && b.logged !== null) return  1;
    if (a.logged !== null && b.logged !== null && a.logged !== b.logged) return b.logged - a.logged;
    return a.playerName.localeCompare(b.playerName);
  });

  const allEntries = entries ?? [];
  const totalRaised  = allEntries.reduce((s, e) => s + Number(e.amount_raised), 0);
  const totalRebates = allEntries.reduce((s, e) => s + Number(e.rebate_amount), 0);

  /* The band's raw material (2026-08-31): the ENTRIES, flat, largest first (the select's own
     order), each carrying its player's name and whether that player is still active. This is the
     record itself; `players` below stays the roster PROJECTION the Record window's player list
     still reads. */
  const nameByAnyPlayer = new Map((fullRoster ?? []).map(p =>
    [p.id as string, [p.player_first_name, p.player_last_name].filter(Boolean).join(' ')]));
  const activeIds = new Set(roster.map(p => p.id as string));
  /* ⚠⚠ A NULL PLAYER ON A DRIVE IS "THE WHOLE TEAM", NOT AN UNKNOWN ONE (owner ruling 2026-09-08).
     Hoodies sold at a table with nobody counting who sold what are a real entry with real money and
     no family share — and with Fundraising words removed from "Other money in", it is the ONLY way
     that money reaches the books. It reads through `WHOLE_TEAM_ENTRY_LABEL` so the board, the
     confirmations, the register's cash strip and the demo all print one spelling.
     ⚠ `playerActive: true` because there is no player to have left: the "no longer on roster" mark
     beside a name is about a person, and marking a team entry would invent one. */
  const driveEntries = allEntries.map(e => ({
    ...mapEntry(e as Record<string, unknown>),
    playerName:   e.player_id
      ? (nameByAnyPlayer.get(e.player_id as string) ?? 'Unknown player')
      : WHOLE_TEAM_ENTRY_LABEL,
    playerActive: e.player_id ? activeIds.has(e.player_id as string) : true,
  }));

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
    // Sponsor-only reads: the family's other credits and its payouts, for the payout floor.
    const [seasonCredits, seasonPayouts] = await Promise.all([
      getRepDuesCreditsByProgramYear(programYear.id),
      getRepDuesPayoutsByProgramYear(programYear.id),
    ]);
    const paidOutByPlayer = totalsByPlayer(seasonPayouts);
    const creditsByPlayer = groupByPlayer(seasonCredits);
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
      /* ⚠⚠ EVERY ENTRY, WHATEVER IT IS ATTACHED TO — and the name understates it since whole-team
         entries exist (2026-09-08). This is what the client's DELETE GUARD reads, and it must be
         every row that holds money: the board is built from the ACTIVE roster, so an inactive
         player's entry is invisible there while its dollars are on the books, and a guard counting
         the board promised "no money moves" over a delete the server then refused (UAT
         coach-sponsor-money-lifecycle pins both halves). A whole-team entry is off the board for the
         same reason and blocks the delete for the same reason.
         ⚠ THE PARTICIPATION FRACTION IS NOT THIS FIGURE. "2 of 14 players logged" is computed on
         the board from `entries`, where a team entry is counted separately and never as a player —
         see `driveFacts`. The list route's own `playerCount` is that other question and excludes a
         null player deliberately. */
      playerCount:  allEntries.length,
    },
    sponsorCreditExposure,
    // The record page's raw material (arrivals model, mig 268) — empty/zero for a drive.
    sponsorCreditPlan,
    sponsorArrivals,
    sponsorExposureByFamily,
    pledgedAmount: fundraiser.pledged_amount != null ? Number(fundraiser.pledged_amount) : null,
    players: playerRows,
    entries: driveEntries,
    // The meta line's denominator — the ACTIVE roster, which is also what its numerator counts
    // (an inactive player's entry is on the board but outside the fraction).
    rosterCount: roster.length,
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

  /**
   * ⚠⚠ AN EXPLICIT `null` PLAYER IS "THE WHOLE TEAM" — the load-bearing half of the fundraising
   * model (owner ruling 2026-09-08). A team sold hoodies at a table and banked $400 with nobody
   * counting who sold what: no player, no family share, no dues credit, and the income row still
   * written so the ledger sees the money. Once Fundraising words leave "Other money in", this is
   * the ONLY way that money can be recorded at all.
   *
   * ⚠ NO SCHEMA CHANGE WAS NEEDED and that is worth knowing: `player_id` has been nullable since
   * mig 237, and `UNIQUE (fundraiser_id, player_id)` does not cap NULLs — SQL NULLs are distinct
   * for uniqueness, which is exactly what mig 268 relies on for a sponsor's several arrivals. So a
   * drive may carry several team entries, deliberately: two hoodie tables on two weekends are two
   * events, not one to be edited.
   *
   * ⚠ EXPLICIT, NOT MERELY ABSENT. `undefined` — a caller that forgot the field — is still refused,
   * because "I did not say" and "nobody in particular" are different answers and only one of them
   * is a coach's. This is the same distinction the tag writers draw between `undefined` and `[]`.
   */
  const wholeTeam = playerId === null;
  if (!wholeTeam && !playerId) {
    return NextResponse.json({
      error: 'Say who raised it — a player, or the whole team.',
    }, { status: 400 });
  }
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
  // Record is for money that has already moved (QA §123 Phase C) — the third money-in door,
  // brought in step with dues receipts and sponsor arrivals in the same pass. The sentence
  // lives once, in lib/money-date-guards.ts.
  const futureRefusal = receivedDate !== null ? futureReceivedDateRefusal(receivedDate, 'drive entry') : null;
  if (futureRefusal) {
    return NextResponse.json({ error: futureRefusal }, { status: 400 });
  }

  /* The roster check is a question about a PLAYER, so a whole-team entry does not ask it: there is
     nobody to find on the roster.

     ⚰⚰ THE ONE-ENTRY-PER-PLAYER REFUSAL STOOD HERE AND IS GONE (mig 287, owner ruling 2026-09-10 on
     mockup `94c27428`). It read a `maybeSingle()` for an existing row and 409'd with "An entry
     already exists for this player. Use PATCH to update it." — the server half of a rule migration
     030 imposed a year before whole-team entries existed and that NOBODY EVER DECIDED. A player who
     sells six boxes in August and three more in September has handed in twice, exactly as a
     sponsor's two cheques are two arrivals and the team's two hoodie tables are two entries; those
     two were designed, this one was inherited.

     ⚠ THE PATCH IS UNCHANGED, and that is the point of writing this here. Editing one hand-in has
     always meant editing ONE ROW; it did not need the constraint and does not miss it.

     ⚠ WHAT REPLACES THE REFUSAL IS A SENTENCE, NOT A GUARD. Recording $60 twice for one player by
     mistake now succeeds. The Record door answers it before the save — its consequence line names
     the player's resulting total whenever they already have an entry — which is the same trade this
     product made when a bill lowered stopped being a collection: state the consequence, don't block
     the door. Do not restore a refusal here without re-opening that ruling. */
  let playerName = WHOLE_TEAM_ENTRY_LABEL;
  if (!wholeTeam) {
    const { data: player } = await supabaseAdmin
      .from('rep_roster_players')
      .select('id, player_first_name, player_last_name')
      .eq('id', playerId)
      .eq('program_year_id', programYear.id)
      .single();

    if (!player) return NextResponse.json({ error: 'Player not found in this program year' }, { status: 404 });
    playerName = [player.player_first_name, player.player_last_name].filter(Boolean).join(' ');
  }

  /* ⚠⚠ A TEAM ENTRY IS STAMPED 0%, NOT THE DRIVE'S RATE, and the stamp is what keeps it that way
     forever. `rebate_percent` is a SNAPSHOT the edit path re-multiplies by (dictionary gotcha 4), so
     storing the drive's rate here with a zero amount would mean the first amount correction
     silently minted a family credit — for a family the row does not name. Nobody raised this
     individually, so nothing comes off anyone's dues. */
  const rebatePct    = wholeTeam ? 0 : Number(fundraiser.player_rebate_percent);
  const rebateAmount = Math.round(raised * rebatePct / 100 * 100) / 100;
  /* The day the money ARRIVED — coach-typed or today. It dates BOTH writes below: the ledger
     entry (which is what places the income in a month on every report) and the family's credit
     (earned the day the money arrived; credit ordering applies by this date). */
  const receivedDay  = receivedDate ?? tournamentToday();

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
      // Null = the whole team raised it. Read the PARENT'S KIND to tell this from a sponsor's
      // arrival, never the null itself — see this table's dictionary entry.
      player_id:          wholeTeam ? null : playerId,
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

  /* 3 — Create dues credit if rebate > 0.
     ⚠ `!wholeTeam` IS A BELT, not the trousers: a team entry stamps 0% above, so `rebateAmount` is
     already 0 and this branch is unreachable for one. It is written out because the alternative
     failure is a NOT NULL violation on `rep_dues_credits.player_id` AFTER the income row and the
     entry are already committed — a half-written record, from a rounding change three releases
     from now. The condition that must never be true says so. */
  if (rebateAmount > 0 && !wholeTeam) {
    const { data: creditRow, error: cErr } = await supabaseAdmin
      .from('rep_dues_credits')
      .insert({
        program_year_id:    programYear.id,
        player_id:          playerId,
        amount:             rebateAmount,
        // "Credit", never "rebate", in anything a customer reads (2026-08-31) — this line shows
        // in the family's dues drawer. Existing rows keep their old wording: they are history.
        description:        `Fundraiser credit — ${fundraiser.name}`,
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
