/**
 * A PLAYER'S DUES FIGURES — THE ONE DERIVATION THE PLAYER DUES TABLE SHOWS (Club Tier Stage 5a, E03).
 *
 * Dues − Fundraising − Other credits − Paid + Handed back = Balance: the coach's ladder, per player, for one season.
 *
 * ⚠⚠ WHY THIS FILE EXISTS. The arithmetic always lived in lib (`splitDuesLadder`, `duesPaidAmount`,
 * `outstandingForSchedule`, `deriveDuesPosition`, `buildFamilyDuesInputs` / `duesActual`), but the ORDER they are
 * called in — and the Balance line itself — lived only in the coach's dues route. A second reader (the club's Families
 * record) could only agree with the team's book by copying that order, which is how two screens start disagreeing about
 * what a family owes: the walk found Families reading $750.00 paid where the team's Money hub read $0.00 (E03). Both
 * now call `seasonDuesFigures`, and `tests/unit/dues-ladder-parity.test.ts` pins that they do.
 *
 * Pure: no reads, no app imports beyond the money modules (client-importable like them).
 */
import { duesPaidAmount, splitDuesLadder, type DuesLadder } from './dues-payments';
import { outstandingForSchedule } from './dues-status';
import { creditsTotal, amountsTotal, deriveDuesPosition, groupByPlayer, type CreditApplicationMode } from './dues-credits';
import { buildFamilyDuesInputs, duesActual, type DuesCreditKind, type FamilyDuesActual } from './coach-dues-actual';

/** One season's dues rows (one program year), any number of players. Amounts in dollars, as the money reads return them. */
export interface SeasonDuesRows {
  schedules: Array<{ playerId: string; total: number }>;
  payments: Array<{ playerId: string; amount: number }>;
  payouts: Array<{ playerId: string; amount: number }>;
  /** Every credit issued this season, any order (sorted oldest first here — the payout allocation reads that order). */
  credits: Array<{
    id: string; playerId: string; kind: DuesCreditKind; amount: number;
    creditDate: string | null; createdAt: string | null;
    /** A record made this credit (a fundraiser entry or an expense) — a typed assertion may not become revenue (R6/R7). */
    traced: boolean;
    /** What this credit's own paybacks settled (mig 281); omitted when nothing is LINKED to it (not the same as 0). */
    paidBack?: number;
  }>;
  /** The team's credit direction (`rep_program_years.credit_application`). Never moves a figure below; carried so the
   *  position is built exactly as the route builds it. */
  mode: CreditApplicationMode;
}

export interface PlayerDuesFigures {
  /** The five figures the Player dues table reads left to right (plus `ownMoney`, the drawer's). */
  ladder: DuesLadder;
  /** The table's Balance — `rollingBalance` on the dues payload. Positive owes; negative is held for the family. */
  balance: number;
  /** Payments capped at the schedule (the balance's pair with `netCredits`). */
  cappedPaid: number;
  /** Schedule total − cappedPaid. */
  outstanding: number;
  /** Credits issued, less what was handed back in cash. */
  netCredits: number;
  /** What the family contributed (the band's Collected) and what came off the bill; null with no schedule. */
  contribution: FamilyDuesActual | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A `rep_dues_credits` row as the derivation takes it — the ONE reading of TRACED (a record made this credit; a typed
 *  assertion may not become revenue, R6/R7) and of the mig-281 paid-back links (`undefined` where nothing is LINKED to
 *  the credit, which is not the same claim as 0). The coach's dues route and the Families read both map through it. */
export function duesCreditFromRow(
  row: { id: unknown; player_id: unknown; credit_type: unknown; amount: unknown; credit_date?: unknown; created_at?: unknown; fundraiser_entry_id?: unknown; expense_id?: unknown },
  paidBackByCredit: ReadonlyMap<string, number>,
): SeasonDuesRows['credits'][number] {
  const id = row.id as string;
  return {
    id, playerId: row.player_id as string, kind: row.credit_type as DuesCreditKind, amount: Number(row.amount),
    creditDate: (row.credit_date as string | null | undefined) ?? null, createdAt: (row.created_at as string | null | undefined) ?? null,
    traced: (row.fundraiser_entry_id ?? null) !== null || (row.expense_id ?? null) !== null,
    paidBack: paidBackByCredit.has(id) ? paidBackByCredit.get(id) : undefined,
  };
}

/** Every player's figures for one season, keyed by player id. A player with no rows reads all zeros. */
export function seasonDuesFigures(rows: SeasonDuesRows, playerIds: readonly string[]): Map<string, PlayerDuesFigures> {
  const oldestFirst = [...rows.credits].sort((a, b) =>
    String(a.creditDate).localeCompare(String(b.creditDate)) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
    // ⚠ and by id last (/review 2026-10-17): two credits written in one transaction share a date and a created_at, and the
    // payout spread is order-dependent — without a final key the coach's screen and Families could split Dues and Other
    // credits differently for the same family (the Balance never moved).
    || String(a.id).localeCompare(String(b.id)));
  // The report's own assembly — the band's figures and `billLowered` come from here, never from a second rule.
  const actualInputs = buildFamilyDuesInputs({
    schedules: rows.schedules,
    payments: rows.payments,
    payouts: rows.payouts,
    credits: oldestFirst.map(c => ({ playerId: c.playerId, kind: c.kind, amount: c.amount, traced: c.traced, paidBack: c.paidBack })),
  });
  const schedules = new Map(rows.schedules.map(s => [s.playerId, s]));
  const payments = groupByPlayer(rows.payments);
  const payouts = groupByPlayer(rows.payouts);
  const credits = groupByPlayer(oldestFirst);

  const out = new Map<string, PlayerDuesFigures>();
  for (const playerId of playerIds) {
    const schedule = schedules.get(playerId);
    const mine = credits.get(playerId) ?? [];
    const paymentsTotal = amountsTotal(payments.get(playerId) ?? []);
    const cappedPaid = schedule ? duesPaidAmount(paymentsTotal, schedule.total) : 0;
    const outstanding = outstandingForSchedule(schedule ? { totalAmount: schedule.total } : null, cappedPaid);
    const creditsIssued = creditsTotal(mine);
    // The position's paidOut is the payouts clamped to the non-forgiven credits (applyCreditsToBills) — taken from the
    // position itself, never re-stated. Bills and payments do not move it.
    const { position } = deriveDuesPosition({
      installments: [], payments: [],
      credits: mine.map(c => ({ id: c.id, amount: c.amount, creditType: c.kind, creditDate: c.creditDate ?? '', createdAt: c.createdAt })),
      paidOut: amountsTotal(payouts.get(playerId) ?? []),
      mode: rows.mode,
    });
    const netCredits = Math.max(0, r2(creditsIssued - position.paidOut));
    const contribution = actualInputs.has(playerId) ? duesActual(actualInputs.get(playerId)!) : null;
    const ladder = splitDuesLadder({
      dues: schedule?.total ?? 0,
      grossPayments: paymentsTotal,
      cappedPaid,
      creditsIssued,
      fundraiserIssued: creditsTotal(mine.filter(c => c.kind === 'fundraiser')),
      /* ⚠⚠ EVERY OVERPAYMENT CREDIT, NOT A NARROWED SET: a $50 overpayment credit with no payment link (it predates
         linking) is still the family's own money when their payments exceed the bill. How much of it is theirs is the
         clamp in `splitDuesLadder` (arithmetic), never a link test — the first cut's link test came out $50 wrong. */
      overpaymentIssued: creditsTotal(mine.filter(c => c.kind === 'overpayment')),
      paidOut: position.paidOut,
      billLowered: contribution?.billLowered.total ?? 0,
    });
    out.set(playerId, { ladder, balance: r2(outstanding - netCredits), cappedPaid, outstanding, netCredits, contribution });
  }
  return out;
}
