import 'server-only';
import { createHash } from 'node:crypto';
import { isFundingKind } from './coach-budget-totals';
import { getRealisedFundraiserEntries } from './db';
import { supabaseAdmin } from './supabase-admin';
import {
  getRepRosterPlayers,
  getRepPlayerDuesSchedules,
  getRepDuesInstallmentsBySchedules,
  getRepDuesPaymentsByProgramYear,
  getRepDuesCreditsByProgramYear,
  getRepDuesPayoutsByProgramYear,
  getRepTeamExpenses,
  getRepTeamMoneyIn,
  writeRepDuesPayout,
  removeRepDuesPayout,
  getOrCreateRepTeamLedger,
  getCommitmentStandings,
} from './db';
import { amountsTotal, deriveDuesPosition, groupByPlayer } from './dues-credits';
import {
  deriveSettlement,
  closeOutBlockers,
  expenseTotals,
  type SettlementParticipant,
  type SettlementSheet,
  type SettlementSheetRow,
  type SettlementFamily,
} from './season-settlement';

export type { SettlementSheet, SettlementSheetRow, SettlementFamily } from './season-settlement';
import { familyLabel } from './coach-family-dues';
import { normalizeGuardianEmail } from './guardian-email';
import type { CoachCapabilities } from './coach-capabilities';
import type { RepProgramYear, DuesPaymentMethod } from './types';

/**
 * The season settlement sheet, assembled from the database — the ONE place the whole sheet is
 * derived, read by the screen, by the per-row payout and by the bulk "Pay all".
 *
 * ⚠ WHY IT IS ONE PLACE. Pass 2's review found the previous refund route clamping each row at
 * zero while building its total from unclamped figures, so one family's over-payout silently
 * cancelled another family's real credit inside the shared pool. A write path that recomputed its
 * own ceiling would be the same defect with a cheque attached. So the ceiling a payout is
 * refused against and the number the coach read on screen come from this function, always.
 *
 * The arithmetic itself is pure and lives next door (lib/season-settlement.ts); this module only
 * fetches, and hands it the figures the shared credit model (lib/dues-credits.ts) derives.
 */

type AdjustmentRow = { player_id: string; kind: string; amount: number; note: string | null };

/**
 * A household's identity ON THE WIRE — stable, comparable, and carrying no PII.
 *
 * Grouping is decided from the guardian's email (the platform's de-facto family identity, same as
 * `computeFamilyDues`), but the browser is only ever told WHICH ROWS BELONG TOGETHER, never who
 * they belong to. The key is derived from that address rather than being it: two siblings hash to
 * one value, two unrelated families cannot collide into one household, and a coach cleared for
 * money but not for guardian contacts learns nothing they could not already see.
 *
 * A player with no guardian address on file is their own household — nothing links them to
 * anyone, and guessing from a shared surname would merge two unrelated families on one roster.
 */
function familyKeyFor(player: { id: string; guardianEmail: string | null }): string {
  const email = normalizeGuardianEmail(player.guardianEmail);
  if (!email) return `solo:${player.id}`;
  return `fam:${createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
}

/**
 * ⚠ Reads only. Callers that WRITE resolve the ACTIVE season for themselves and pass it in — an
 * archived season renders this sheet as a record and offers no controls at all.
 */
export async function loadSeasonSettlement(opts: {
  programYear: RepProgramYear;
  capabilities: CoachCapabilities;
}): Promise<SettlementSheet> {
  const { programYear, capabilities } = opts;
  const pyId = programYear.id;

  const [
    rosterPlayers, schedules, payments, credits, payouts, expenses,
    surplusRes, adjustmentsRes, splitsRes, requestsRes, linesRes, moneyInRecords, standings,
  ] = await Promise.all([
    getRepRosterPlayers(pyId),
    getRepPlayerDuesSchedules(pyId),
    getRepDuesPaymentsByProgramYear(pyId),
    getRepDuesCreditsByProgramYear(pyId),
    getRepDuesPayoutsByProgramYear(pyId),
    getRepTeamExpenses(pyId),
    supabaseAdmin.from('rep_season_surplus').select('*').eq('program_year_id', pyId).maybeSingle(),
    supabaseAdmin.from('rep_season_refund_adjustments').select('player_id, kind, amount, note').eq('program_year_id', pyId),
    /* ⚠ THE FUNDRAISER-ID QUERY IS GONE. It existed to feed a "does this season have any?" ternary
       that was itself removed when the entries read became unconditional — so it had been fetching
       a list nobody read, one round trip on every load of this sheet and on every write that
       recomputes it. */
    supabaseAdmin.from('rep_allocation_splits').select('id').eq('program_year_id', pyId),
    supabaseAdmin.from('rep_team_payment_requests').select('request_type, amount, status')
      .eq('team_id', programYear.teamId).eq('program_year_id', pyId),
    supabaseAdmin.from('rep_budget_lines').select('total_amount, line_kind').eq('program_year_id', pyId),
    getRepTeamMoneyIn(pyId),
    // Where every commitment stands (Payables Rebuild P1) — what a season actually PAID, which is
    // the ceiling on every family's refund. Read here rather than derived, so the pot and the
    // Money hub's cash line cannot disagree about it.
    getCommitmentStandings(pyId),
  ]);

  // The second wave. All three depend only on ids the first wave returned and on NOTHING from
  // each other, so they go together — awaiting them one at a time cost two extra round trips on
  // every read of this sheet, and a write pays for the sheet twice.
  const splitIds = (splitsRes.data ?? []).map((s: { id: string }) => s.id);
  const [installments, entriesRes, allocInstallsRes] = await Promise.all([
    getRepDuesInstallmentsBySchedules(schedules.map(s => s.id)),
    // ⚠ REALISED ONLY — the pot is money the team is HOLDING. A pledged sponsor's entry exists
    // but nothing has arrived, and this pot is what families are paid out of: counting a promise
    // here could have funded a real refund of money the team never received (review, 2026-08-15).
    // Called unconditionally: it already returns [] for a season with no fundraisers, and the
    // "are there any?" ternary it replaced made the surrounding Promise.all infer one union type
    // across all three results instead of a tuple. That ternary's own query is gone above.
    getRealisedFundraiserEntries(pyId),
    splitIds.length
      ? supabaseAdmin.from('rep_allocation_installments').select('amount, paid_at').in('split_id', splitIds)
      : Promise.resolve({ data: [] as Array<{ amount: number; paid_at: string | null }> }),
  ]);
  const installmentsByPlayer = groupByPlayer(installments);

  // ── Money in ───────────────────────────────────────────────────────────────────────────────
  // ⚠ UNCAPPED. The Collected tile caps dues at each schedule total so an overpayment is not
  // double-counted in a BALANCE; for the pot that cap is wrong — the money physically arrived
  // and the team is holding it. (The overpayment then appears on the owed-to-families line,
  // where it belongs, so it is counted exactly once.)
  const duesReceived = amountsTotal(payments);

  // ⚠ THE FULL AMOUNT RAISED. The fundraiser flow posts all of it to the team's books and the
  // player's rebate is a separate credit — so subtracting the players' share here would remove
  // it a second time. That double-subtraction is the defect this whole sheet replaces.
  const fundraisingRaised = amountsTotal(
    (entriesRes as Array<{ amountRaised: number }>).map(e => ({ amount: e.amountRaised ?? 0 })));

  // ⚠⚠ CLUB MONEY IS IN THE POT NOW (owner ruling 2026-08-17, money redesign P3).
  //
  // It was excluded for years, and the exclusion was RIGHT while it lasted: `rep_team_payment_requests`
  // carried no program year, so an approved request could not be attributed to a season, and this
  // figure sets a CASH PAYOUT CEILING — a team in its third season would have carried two earlier
  // seasons' club funding into a surplus it never received. This sheet is also read in a FINISHED
  // season, where approving a request next year would have rewritten last year's settled pot every
  // time someone opened it. The comment here named the fix and called it beyond that pass:
  // *"a program year on the payment-requests table (a migration + a backfill)."*
  //
  // Migration 247 is that migration. Both hazards close with it — the query below is season-scoped,
  // so a finished season's pot holds what THAT season was given and nothing later can reach it.
  const requests = (requestsRes.data ?? []) as Array<{ request_type: string; amount: number; status: string }>;
  const approvedThisSeason = (type: string) => amountsTotal(
    requests.filter(r => r.status === 'approved' && r.request_type === type).map(r => ({ amount: r.amount ?? 0 })));
  const orgFunding = approvedThisSeason('charge_to_org');
  const orgPayments = approvedThisSeason('payment_to_org');

  /* ⚠⚠ NOT MONEY — A COUNT OF OPEN CONVERSATIONS, and it BLOCKS the close (money redesign P4,
     owner ruling 2026-08-17). A pending request stays out of every figure above, exactly as it
     always has: the club may still decline it. But seasons are independent by ruling — the Club tab
     shows the working season and nothing else — so a season closed with a request the club never
     answered leaves that request in a place nobody looks at again. The loop is closed on the way
     out rather than by re-opening history. The escape is entirely the coach's: chase the club, or
     withdraw the request. */
  const pendingClubRequests = requests.filter(r => r.status === 'pending').length;

  // ⚠ RECORDED ARRIVALS, BOTH KINDS (mig 243). Income the coach logged and money that came back are
  // both cash the team is holding, and this pot counted neither — so every family's refund was
  // computed from a smaller pot than the team actually had. The report's income/refund distinction
  // has no bearing here: the question is only whether a dollar arrived.
  const recordedIn = amountsTotal(moneyInRecords);

  // ── Money out (CASH only) ──────────────────────────────────────────────────────────────────
  const { paid: expensesPaid, cashPaid: expensesCashPaid } = expenseTotals(expenses, standings);
  const allocationsPaid = amountsTotal(
    ((allocInstallsRes.data ?? []) as Array<{ amount: number; paid_at: string | null }>)
      .filter(i => i.paid_at).map(i => ({ amount: i.amount ?? 0 })));
  const cashOut = Math.round((expensesCashPaid + allocationsPaid + orgPayments) * 100) / 100;

  // ── Per player ─────────────────────────────────────────────────────────────────────────────
  const hasSchedule = new Set(schedules.map(s => s.playerId));
  const paymentsByPlayer = groupByPlayer(payments);
  const creditsByPlayer  = groupByPlayer(credits);
  const payoutsByPlayer  = groupByPlayer(payouts);

  const adjustments = new Map<string, AdjustmentRow>(
    ((adjustmentsRes.data ?? []) as AdjustmentRow[]).map(a => [a.player_id, a]));

  const participants: SettlementParticipant[] = [];
  /** Each player's derived position AND the raw payout total behind it — both are wanted again
   *  when the rows are dressed below, and deriving them twice over the same roster is how two
   *  loops start disagreeing about one player. */
  const derived = new Map<string, {
    position: ReturnType<typeof deriveDuesPosition>['position'];
    payouts: typeof payouts;
    rawPaidOut: number;
  }>();
  for (const p of rosterPlayers) {
    const playerPayouts = payoutsByPlayer.get(p.id) ?? [];
    const rawPaidOut = amountsTotal(playerPayouts);
    const { position } = deriveDuesPosition({
      installments: hasSchedule.has(p.id) ? (installmentsByPlayer.get(p.id) ?? []) : [],
      payments: paymentsByPlayer.get(p.id) ?? [],
      credits: creditsByPlayer.get(p.id) ?? [],
      paidOut: rawPaidOut,
      mode: programYear.creditApplication,
    });
    derived.set(p.id, { position, payouts: playerPayouts, rawPaidOut });
    const adj = adjustments.get(p.id);
    participants.push({
      playerId: p.id,
      onRoster: p.status === 'active',
      creditsIssued: position.creditsIssued,
      owedBack: position.owedBack,
      leftToSend: position.leftToSend,
      // Forgiveness counts as a share ALREADY RECEIVED only to the extent it relieved real debt —
      // a forgiveness larger than the balance simply evaporates and was never the family's money.
      forgiven: position.forgivenApplied,
      // ⚠ The RAW total, not the credit-clamped one: the part beyond their credits is share money
      // already in their hands, and that is exactly what keeps everyone else's share still.
      paidOut: rawPaidOut,
      choice: adj?.kind === 'fixed' ? 'fixed' : adj?.kind === 'no_share' ? 'none' : 'even',
      fixedAmount: Number(adj?.amount ?? 0),
    });
  }

  const surplusRow = surplusRes.data as { hold_back_amount?: number; notes?: string | null } | null;
  const settlement = deriveSettlement({
    cash: {
      duesReceived, fundraisingRaised, orgFunding, recordedIn, cashOut,
      payoutsTotal: amountsTotal(payouts),
      holdBack: Number(surplusRow?.hold_back_amount ?? 0),
      pendingClubRequests,
    },
    participants,
  });

  // ── Dress the rows ─────────────────────────────────────────────────────────────────────────
  const playerById = new Map(rosterPlayers.map(p => [p.id, p]));
  const evenTakers = settlement.rows.filter(r => r.choice === 'even').length;

  const rows: SettlementSheetRow[] = settlement.rows.filter(r => {
    // A departed player appears only if there is money in it — their own, or a debt that joined
    // the pot. One who left owing nothing and owed nothing is not part of this season's
    // settlement, and a row of dashes would only make the sheet harder to read.
    const p = playerById.get(r.playerId)!;
    return p.status === 'active'
      || Math.abs(r.refund) > 0.005 || r.owedBack > 0.005 || r.leftToSend > 0.005;
  }).map(r => {
    const p = playerById.get(r.playerId)!;
    const { position, payouts: playerPayouts, rawPaidOut } = derived.get(r.playerId)!;

    // The line-by-line story. It sums to the refund exactly — credits issued, minus what they
    // already spent on bills, minus what already went out, plus the share, minus what is still
    // to send. Nothing is explained in the table itself; it is explained HERE, on opening a row.
    const breakdown: SettlementSheetRow['breakdown'] = [];
    for (const c of (creditsByPlayer.get(r.playerId) ?? [])) {
      if (c.creditType === 'forgiven') continue; // never the family's money — listed separately
      breakdown.push({ label: c.description || 'Credit', detail: c.creditDate, amount: c.amount });
    }
    if (position.applied > 0.005) {
      breakdown.push({ label: 'Already lowered their bills', detail: null, amount: -position.applied });
    }
    if (rawPaidOut > 0.005) {
      breakdown.push({
        label: 'Already paid out',
        detail: playerPayouts.map(o => o.paidDate).sort().at(-1) ?? null,
        amount: -rawPaidOut,
      });
    }
    if (r.forgiven > 0.005) {
      breakdown.push({
        label: 'Balance forgiven — counts as their share, already received',
        detail: null, amount: 0,
      });
    }
    if (p.status !== 'active') {
      breakdown.push({ label: 'Off the season’s-end roster — no share', detail: null, amount: 0 });
    } else if (r.choice === 'none') {
      breakdown.push({ label: 'No share — left to the team', detail: null, amount: 0 });
    } else {
      breakdown.push({
        label: r.choice === 'fixed' ? 'A set amount' : `Even share — one of ${evenTakers}`,
        detail: null, amount: r.cashShare,
      });
    }
    if (r.leftToSend > 0.005) {
      breakdown.push({ label: 'Dues still to send', detail: null, amount: -r.leftToSend });
    }

    const adj = adjustments.get(r.playerId);
    return {
      playerId: r.playerId,
      playerFirstName: p.playerFirstName,
      playerLastName: p.playerLastName,
      departed: p.status !== 'active',
      owedBack: r.owedBack,
      cashShare: r.cashShare,
      leftToSend: r.leftToSend,
      refund: r.refund,
      benefit: r.benefit,
      forgiven: r.forgiven,
      choice: r.choice,
      choiceNote: adj?.note ?? null,
      settled: r.settled,
      paidOut: rawPaidOut,
      sharePaid: r.sharePaid,
      payableNow: Math.max(0, r.refund),
      lastPaidDate: playerPayouts.map(o => o.paidDate).sort().at(-1) ?? null,
      // ⚠ AN OPAQUE KEY, NEVER THE GUARDIAN'S EMAIL. Households are recognised by the guardian
      // address (the platform's de-facto family identity), but that address is PII behind its own
      // grant — and money access and the guardian-PII grant are INDEPENDENT, so a treasurer with
      // money:read and no PII grant reads this payload. Shipping the raw address as the grouping
      // key would have handed them every family's email and quietly defeated the gate the rest of
      // the product enforces. The browser only ever needs "same household or not".
      familyKey: familyKeyFor(p),
      breakdown,
    };
  });

  // ── Families ───────────────────────────────────────────────────────────────────────────────
  // Siblings are ONE conversation and ONE cheque. The label follows the same rule the "who owes"
  // answer uses (lib/coach-family-dues `familyLabel`), including its capability seam: a coach
  // with money access but no guardian-PII grant gets the players' own names, which they already
  // see on every roster screen. Grouping is identical either way; only the words change.
  const familyMap = new Map<string, { key: string; players: typeof rows; surnames: string[] }>();
  for (const row of rows) {
    const p = playerById.get(row.playerId)!;
    let f = familyMap.get(row.familyKey);
    if (!f) { f = { key: row.familyKey, players: [], surnames: [] }; familyMap.set(row.familyKey, f); }
    f.players.push(row);
    if (capabilities.rosterPii && p.guardianLastName) f.surnames.push(p.guardianLastName);
  }
  const families: SettlementFamily[] = [...familyMap.values()].map(f => ({
    key: f.key,
    label: familyLabel(
      f.surnames,
      f.players.map(r => [r.playerFirstName, r.playerLastName].filter(Boolean).join(' ')),
    ).receiptLabel,
    playerIds: f.players.map(r => r.playerId),
    refund: Math.round(f.players.reduce((s, r) => s + r.refund * 100, 0)) / 100,
    payable: Math.round(f.players.reduce((s, r) => s + Math.max(0, r.refund) * 100, 0)) / 100,
  }));

  // ⚠ `awaitingFrom` stood here and is GONE (2026-08-14). It named, biggest debt first, whose
  // money the other families were waiting on — and existed for ONE consumer: the "paying everyone
  // needs $X still to arrive from …" strip on the settlement sheet. The close-out ruling deleted
  // that strip (the readiness checklist states the same fact where the question is asked), leaving
  // a per-request derivation with an O(n²) `families.find` inside its map and nothing reading it.
  // `awaitingCash` — the SCALAR the close-out gate tests — is untouched and still on the payload.

  // Planned costs the season has not spent yet. NOT in the arithmetic (the owner's pot is cash
  // held minus what is owed — full stop), but a coach opening this sheet mid-season is looking at
  // money the season still needs, and a sheet that stayed silent about that would be inviting
  // them to share it.
  const plannedCost = amountsTotal(
    ((linesRes.data ?? []) as Array<{ total_amount: number; line_kind?: string | null }>)
      .filter(l => !isFundingKind(l.line_kind))
      .map(l => ({ amount: l.total_amount ?? 0 })));
  const plan = Math.max(plannedCost, programYear.budgetAmount ?? 0);

  return {
    ...settlement,
    rows,
    families,
    unspentPlan: Math.max(0, Math.round((plan - expensesPaid) * 100) / 100),
    notes: surplusRow?.notes ?? null,
  };
}

/** Refused because the settlement sheet does not owe this family that much. Carries the true
 *  figure, so the reason a coach reads is the reason the write refused. */
export class SettlementExceedsRefundError extends Error {
  constructor(public readonly payableNow: number, public readonly playerName: string) {
    super('SETTLEMENT_EXCEEDS_REFUND');
    this.name = 'SettlementExceedsRefundError';
  }
}

/**
 * The refusal path could not finish undoing itself — a payout the sheet cannot cover is standing,
 * with a ledger entry behind it.
 *
 * ⚠ THIS IS THE ONE FAILURE THE DESIGN CANNOT SELF-HEAL, so it must never be quiet. Every other
 * money path here recovers by re-deriving; this one is a write that could not be reversed, and a
 * generic 500 would leave a coach's books overstating what went out with nothing saying so.
 */
export class SettlementUnwindFailedError extends Error {
  constructor(public readonly stranded: string[]) {
    super('SETTLEMENT_UNWIND_FAILED');
    this.name = 'SettlementUnwindFailedError';
  }
}

/**
 * The season is still collecting, so it cannot be closed out (owner ruling 2026-08-14).
 *
 * ⚠ This guards the CLOSE-OUT path only — `playerIds === null`, the "pay everyone" batch. Paying
 * ONE family (a player leaving mid-season, settled from their own money record) stays legal at any
 * point in the season and must not be caught here.
 */
export class SettlementSeasonNotClosableError extends Error {
  constructor(
    public readonly expectedIn: number,
    /** The payouts' shortfall against cash on hand — non-zero when a family was overpaid early. */
    public readonly awaitingCash: number,
    /** Club requests the club has never answered (P4). ⚠ Whatever renders this MUST name the two
     *  ways out — chase the club, or withdraw the request — or an unresponsive club office locks a
     *  team out of closing its season with no stated remedy. */
    public readonly pendingClubRequests: number = 0,
  ) {
    super('SETTLEMENT_SEASON_NOT_CLOSABLE');
    this.name = 'SettlementSeasonNotClosableError';
  }
}

/**
 * Settle the season, in cash — one payout row per player, each dated the day the money left and
 * each carrying its own money-out ledger line.
 *
 * ⚠ THE WHOLE REQUEST IS DECIDED HERE. Which rows are being paid (`playerIds: null` means every
 * row that is owed something) and how much each may take are one question, not two, so they are
 * answered against ONE snapshot. Splitting them — the route expanding "pay all" from its own
 * read, this function re-validating against its own — meant two mechanisms sharing one job and
 * four full derivations per click; it is now two, which is the pre-write read and the post-write
 * re-check, both of which must exist.
 *
 * ⚠ THE CEILING IS THE SHEET'S OWN NUMBER, not the credit ceiling the drawer uses. A settlement
 * cheque covers the family's owed-back money AND their share of the surplus, and a share is not
 * a credit — refusing it against credits alone would make the sheet offer a button that always
 * failed.
 *
 * ⚠ AND IT IS RE-CHECKED AFTER THE WRITE. The ceiling is read before the insert, so two
 * concurrent clicks would each pass it against the same stale snapshot and between them hand a
 * family more than the team owes — the exact race the payment path learned in the 2026-08-13
 * review and the payout path in Pass 2's. The loser undoes ITSELF: void the entry, delete the
 * row, refuse. One re-derivation covers the whole batch, so a bulk settle pays for it once.
 */
export async function recordSettlementPayouts(opts: {
  team: { id: string; orgId: string; name: string };
  programYear: RepProgramYear;
  capabilities: CoachCapabilities;
  /** Whose rows to pay. `null` = every row the sheet says is owed something ("Pay all"). */
  playerIds: readonly string[] | null;
  /** A hand-typed amount, only meaningful for a single row; otherwise each row is paid what its
   *  own figure says (which is what makes one cheque per family honest). */
  amount: number | null;
  paidDate: string;
  /* The shared dues-method type (mig 260 widened it to include 'card') — an inline copy of the
     union here is how a widened list gets refused by one caller and accepted by another. */
  method: DuesPaymentMethod;
  note?: string | null;
  createdBy: string;
}): Promise<{ sheet: SettlementSheet; paidCount: number; paidTotal: number }> {
  const load = () => loadSeasonSettlement({ programYear: opts.programYear, capabilities: opts.capabilities });
  const before = await load();

  // ⚠ THE CLOSE-OUT GATE, server-side (owner ruling 2026-08-14). The button is disabled in the
  // browser; this is what makes the rule true.
  //
  // ⚠ IT KEYS ON HOW MANY FAMILIES ARE PAID, NOT ON THE `null` SENTINEL. The first cut tested
  // `playerIds == null` — the shape the "pay everyone" button sends — and adversarial review
  // walked straight around it: this route also accepts an explicit array of any length, each row
  // paid what its own figure says, which is the same act under a different request body. The
  // browser already holds every playerId, so the bypass was one hand-written fetch. It granted no
  // capability a coach lacked (paying families one at a time is legal all season, and N sequential
  // single payouts reach the same place), but a guard that a reshaped request steps around is a
  // guard that gets BELIEVED and isn't true — including by this file's own comments.
  //
  // So: ONE family is the documented early-payout path (a player leaving mid-season) and stays
  // open all season. TWO OR MORE is a close-out by another name and must meet its conditions.
  //
  // ⚠ `awaitingCash` is a SEPARATE condition, not a restatement of the first. A family paid out
  // early can owe value back at close-out (their `sharePaid` exceeding their eventual share), and
  // one negative row makes `payable` — what actually leaves the account — larger than the cash on
  // hand even with every due collected. Proved by the randomised test in
  // tests/unit/season-settlement.test.ts, which is what caught the one-condition version.
  const isCloseOut = opts.playerIds == null || opts.playerIds.length > 1;
  const blockers = closeOutBlockers(before);
  if (isCloseOut && !blockers.canClose) {
    throw new SettlementSeasonNotClosableError(
      blockers.duesOutstanding, blockers.cashShort, blockers.pendingClubRequests,
    );
  }

  const rowById = new Map(before.rows.map(r => [r.playerId, r]));
  const nameOf = (row: SettlementSheetRow) =>
    [row.playerFirstName, row.playerLastName].filter(Boolean).join(' ') || 'this family';

  const planned: Array<{ row: SettlementSheetRow; amount: number }> = [];
  for (const playerId of opts.playerIds ?? before.rows.filter(r => r.payableNow > 0.005).map(r => r.playerId)) {
    const row = rowById.get(playerId);
    if (!row) throw new SettlementExceedsRefundError(0, 'that player');
    // A typed amount only makes sense for one row; every other case is paid what the sheet says.
    const amount = opts.amount != null && opts.playerIds?.length === 1 ? opts.amount : row.payableNow;
    if (amount <= 0.005) continue;
    if (Math.round(amount * 100) > Math.round(row.payableNow * 100)) {
      throw new SettlementExceedsRefundError(row.payableNow, nameOf(row));
    }
    planned.push({ row, amount });
  }
  if (planned.length === 0) return { sheet: before, paidCount: 0, paidTotal: 0 };

  // ONE ledger lookup for the batch — it is the same team on every row, and resolving it per
  // cheque meant eight near-identical round trips to settle eight families.
  const ledger = await getOrCreateRepTeamLedger(opts.team.orgId, opts.team.id, opts.team.name);

  const written = [];
  for (const { row, amount } of planned) {
    // ⚠ SEQUENTIAL, deliberately. These are irreversible cash writes whose post-write check reads
    // the settled state of the whole batch; issuing them concurrently would buy a little latency
    // in exchange for a harder story when one of them fails halfway.
    written.push(await writeRepDuesPayout({
      team: opts.team,
      ledgerId: ledger.id,
      programYearId: opts.programYear.id,
      playerId: row.playerId,
      playerName: nameOf(row),
      amount,
      paidDate: opts.paidDate,
      method: opts.method,
      note: opts.note ?? null,
      createdBy: opts.createdBy,
      source: 'season_settlement',
    }));
  }

  // ── The post-write truth ───────────────────────────────────────────────────────────────────
  // The race being guarded is a SECOND PAYOUT landing in the window between this batch's read and
  // its write — two clicks between them handing a family more cash than the team owes.
  //
  // ⚠ SO THE TEST IS "did more money go out to this family than this batch meant to send?", NOT
  // "is their refund negative now". Those are different questions, and the second one has a false
  // positive with real consequences: a refund also goes negative when something UNRELATED lands
  // in the same window — another coach invoicing that family for a tournament fee, say. Judging
  // on the refund would undo a perfectly good cheque because a bill arrived while it was being
  // written, and tell the coach they had double-paid when they had not.
  const expectedPaidOut = new Map<string, number>();
  for (const { row, amount } of planned) {
    expectedPaidOut.set(row.playerId, Math.round((row.paidOut + amount) * 100) / 100);
  }
  const after = await load();
  const overpaid = new Set(
    after.rows
      .filter(r => expectedPaidOut.has(r.playerId)
        && Math.round(r.paidOut * 100) > Math.round(expectedPaidOut.get(r.playerId)! * 100))
      .map(r => r.playerId));
  if (overpaid.size > 0) {
    // ⚠ THE UNDO ITSELF CAN FAIL, and if it does, silence is the worst outcome: the over-ceiling
    // payout stands, with a real ledger entry behind it, and a generic 500 tells nobody. So a
    // failed unwind is reported as its own thing — loudly, naming the money left standing —
    // rather than being swallowed by the refusal path it was trying to complete.
    const stranded: string[] = [];
    for (const p of written.filter(w => overpaid.has(w.playerId))) {
      try {
        await removeRepDuesPayout(p, opts.team);
      } catch {
        stranded.push(`${p.amount.toFixed(2)} to ${nameOf(rowById.get(p.playerId)!)}`);
      }
    }
    if (stranded.length > 0) {
      throw new SettlementUnwindFailedError(stranded);
    }
    const first = after.rows.find(r => overpaid.has(r.playerId))!;
    throw new SettlementExceedsRefundError(Math.max(0, rowById.get(first.playerId)!.payableNow), nameOf(first));
  }

  // The caller renders THIS sheet — it is the post-write truth, already paid for above.
  return {
    sheet: after,
    paidCount: written.length,
    paidTotal: Math.round(written.reduce((s, w) => s + w.amount * 100, 0)) / 100,
  };
}
