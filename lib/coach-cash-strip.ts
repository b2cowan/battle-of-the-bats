import { orgDayKey } from './timezone';
/* ⚠ THE BAND VOCABULARY LIVES IN `coach-budget-months`, NOT HERE, and is imported rather than
   re-exported: a type with two import paths is a type two readers can disagree about where it
   belongs. This module decides which RECORDS are cash; that one owns what the grid CALLS them. */
import {
  monthKeyOf, PAYOUT_CATEGORY_ID, PAYOUT_CATEGORY_NAME,
  type MonthKey, type RevenueGroupKey,
} from './coach-budget-months';
/* ⚠ THE TYPE ONLY. This module stays pure and framework-free; the club vocabulary's home is
   `coach-club-money`, and importing the union rather than re-declaring three strings is what stops
   a fourth answer reaching the report and silently missing the cash bands. */
import type { ClubRequestReportSide } from './coach-club-money';

/**
 * The Months view's CASH arithmetic — every dollar that actually moved, by the month it moved,
 * GROSS both directions, and (since the Option D merge, 2026-08-23) grouped the way the screen
 * reads it: revenue by source, spending by the category+item it was filed under.
 *
 * ⚠⚠ THIS IS DELIBERATELY A SECOND ARITHMETIC BESIDE THE REPORT'S, and the difference is the whole
 * point (owner ruling 2026-08-23, reversing 2026-07-30's "Money in is player dues only" —
 * `memory/design_decisions.md`). The report NETS money back and club reimbursements into the costs
 * they repaid, which is right for a report; cash is gross in both directions, which is right for a
 * bank balance. Reusing the report's netted cells for the expense band while adding the same
 * refunds to the revenue band would double-count them — so both bands are assembled from the
 * PRIMITIVE records here, never from the rollup's cells.
 *
 * ⚠ THE REGISTER IS THE CONTRACT. Each input's dating and inclusion rule below matches the register
 * route's row assembly exactly — same fallbacks, same exclusions — because `check:money-report`
 * asserts the two agree month-by-month, both directions, to the cent. Change a rule here and the
 * register together, or the build's own guard says no.
 *
 * ⚠⚠ `in` / `out` ARE SUMMED FROM THE EMITTED EVENTS, NEVER COMPUTED BESIDE THEM. They are the same
 * fact at a coarser grain, and the one way this module could quietly start telling two stories is a
 * second pass that adds a stream to one and not the other — which is precisely how payouts and
 * drive money went missing from the strip for weeks. One walk, two grains.
 *
 * ⚠ WHY THIS IS A MODULE AND NOT A ROUTE HELPER: the same reason `paidMovements` moved out of the
 * report route — a helper inside a route handler is an untestable one, and this one carries six
 * inclusion/dating rules worth pinning individually.
 */

/** Where a cash-out event sits in the budget taxonomy — resolved by the caller, carried by us. */
export interface CashPlacement {
  categoryId: string | null;
  categoryName: string | null;
  itemId: string | null;
}

/**
 * WHO or WHAT a dollar came from — the row a REVENUE group opens to (owner ruling 2026-08-24).
 *
 * ⚠⚠ THE NAME IS RESOLVED BY THE CALLER AND CARRIED BY US, exactly as `CashPlacement` is. This
 * module decides which records are cash; it has no database and no business learning a roster. What
 * it must do is keep the subject welded to the figure — the grid row, the month cell and the panel
 * behind that cell are three readings of ONE event, and a second lookup anywhere downstream is a
 * second chance to disagree about whose money it was.
 *
 * `id` is null only where a stream genuinely has nothing to group by (an arrival typed against no
 * budget item). Those land on a row of their own rather than vanishing.
 */
export interface CashSubject {
  id: string | null;
  name: string;
}

export interface CashStripInputs {
  /** Dues a family actually paid, the day it arrived (mig 232). ⚠ The family's name comes from the
   *  caller's roster read and is gated exactly as the Player Dues tab is — never wider. */
  duesPayments: Array<{
    id: string; amount: number; receivedDate: string | null;
    playerId: string | null; playerName: string; method: string | null;
  }>;
  /**
   * Recorded arrivals — BOTH kinds. `money_back` is cash IN even though the report nets it, and the
   * kind decides which revenue group it lands in ("Other income" vs "Money back & reimbursements").
   */
  moneyInRecords: Array<{
    id: string; amount: number; receivedDate: string | null; kind: 'income' | 'money_back';
    description: string;
    /** Where the coach filed it — the GROUPING for typed income, and the "what it repaid" line on
     *  money back. Both come off the record's own join; neither is re-derived here. */
    itemId: string | null; itemName: string | null; categoryName: string | null;
  }>;
  /**
   * Realised drive/sponsor entries, GROSS. A rebate is a CREDIT — a family sends less dues — never
   * cash out; gross fundraising + actual dues receipts is the identity the register already proves.
   * Dated the day the money arrived when the record knows it (mig 261), else the day it was
   * recorded — the register's exact fallback.
   * ⚠ The caller passes realised rows only (`getRealisedFundraiserEntries`); a pledge is not cash.
   * ⚠ `kind` splits the two revenue groups: a drive is Fundraising, a sponsor is Sponsorships.
   */
  realisedEntries: Array<{
    id: string; amountRaised: number; receivedDate: string | null; createdAt: string;
    kind: 'fundraiser' | 'sponsor';
    /** The drive or the sponsor this row belongs to — the row the group opens to. */
    fundraiserId: string; fundraiserName: string;
    /** Who raised it, and what their dues were credited. ⚠ THE REBATE IS A NOTE, NEVER A FIGURE
     *  (owner ruling 2026-08-24): the credit already lowered that family's dues, so showing it as
     *  an amount beside gross would read as money leaving. */
    playerId: string | null; playerName: string | null; rebateAmount: number;
  }>;
  /**
   * Approved club requests, settled the day they were DECIDED (approval posts the transfer).
   *
   * ⚠⚠ `side` IS THE COACH'S ANSWER, NOT THE DIRECTION (mig 271, owner D1) — and it decides which
   * ROW of the revenue band an arrival joins, never whether it is cash. Both incoming answers are a
   * dollar arriving; this is a cash strip, and cash does not care what a dollar means:
   *   · `reimbursement` → the **Money back** group, because the club repaying a cost is the same
   *     species of arrival as a vendor refunding one ("Repaid by the club");
   *   · `funding`       → **Other income**, on the row it was FILED under, exactly as a typed
   *     arrival groups — because that is the only grouping a grant has;
   *   · `cost`          → cash out, filed where the request itself was filed.
   *
   * ⚠ "Repaid by the club" now means only money back, which it did not before this release: every
   * arrival was in that row, so a grant read as a repayment on the one screen a treasurer scans.
   */
  clubRequests: Array<CashOutRecord & {
    side: ClubRequestReportSide; reviewedAt: string | null; createdAt: string;
    /** The item's word, for the "repaid Facilities / Dome time" line — `place` carries only its id. */
    itemName: string | null;
  }>;
  /**
   * One entry per expense PAYMENT (the standings' movements), on the day the money left.
   * ⚠ `familyPaidDirect` rows are the one spend that never moves team cash — a family paid the
   * vendor themselves. The register marks them `movesCash: false`; the band must drop them too,
   * or it can never equal the register.
   */
  expensePayments: Array<CashOutRecord & { paidDate: string | null; familyPaidDirect: boolean }>;
  /** Money handed BACK to a family (mig 234) — real cash out, its own expense-band group. */
  duesPayouts: Array<{
    id: string; amount: number; paidDate: string | null;
    playerId: string | null; playerName: string; method: string | null;
    /** WHY this family was paid back — "overpaid instalment #2", a shared surplus, a cashed-out
     *  credit. ⚠ It rides on the payment's own meta line rather than becoming a second grouping
     *  level, so the row still mirrors dues (owner ruling 2026-08-24). */
    reason: string | null;
  }>;
  /** Club allocation installments; only PAID ones are cash (on the day the team paid). */
  clubInstallments: Array<CashOutRecord & { paidAt: string | null }>;
}

/**
 * What every cash-out record carries beyond its date.
 *
 * ⚠ THE ID AND THE WORDS ARE NOT DECORATION. An Actual cell on the Months grid opens a drill-in
 * listing what makes it up, and that list is now CASH rather than the report's movements — so the
 * words a coach reads behind a figure have to travel with the figure, from the one place that
 * decided the figure was cash at all.
 */
export interface CashOutRecord {
  id: string;
  description: string;
  amount: number;
  place: CashPlacement;
  /**
   * The one thing this record needs a coach to know beside its date — the method it left by, the
   * reason a family was paid back. Absent on the ordinary rows, whose date and words say it all.
   */
  note?: string | null;
  /**
   * What KIND of record this is, where the record has no words of its own — see the same field on
   * `RevenueCashEvent` for why the two are not one field. A bill carries its own description and
   * needs none of this; money handed back to a family is only ever "Paid back".
   */
  kind?: string | null;
}

/** One dollar of revenue, in its group, on the day it arrived. */
export interface RevenueCashEvent {
  group: RevenueGroupKey;
  date: string | null;
  amount: number;
  /** The record's own id — the panel behind a cell lists records, and a list needs stable keys. */
  id: string;
  /** WHO or WHAT it came from — the family, the drive, the sponsor, the item it was filed under. */
  subject: CashSubject;
  /**
   * What KIND of record this is — "Dues payment", "Paid back", "Season sponsorship".
   *
   * ⚠⚠ IT IS NOT THE SAME THING AS `description`, AND CONFLATING THEM PUT THIRTEEN IDENTICAL LINES
   * ON A COACH'S SCREEN (owner-found 2026-08-25). Opened from a family, "Dues payment" is a useful
   * line — the title already names Maya. Opened from the GROUP, the title says "Player dues" and
   * every record restated it, so thirteen families arrived as thirteen rows reading "Dues payment".
   *
   * ⚠ NO HEURISTIC CAN TELL THESE APART, and three were tried against real records before this
   * field existed. "Every row says the same thing" drops "Season sponsorship" correctly and drops
   * "Home opener gate" wrongly; "only one record" keeps both. Whether a word belongs to the RECORD
   * or to its KIND is knowledge the source has and the screen cannot recover — so the source says
   * it, here, rather than the renderer guessing.
   */
  kind: string;
  /**
   * What THIS record says for itself — who raised it, what a refund repaid, which gate took it.
   *
   * Null where a record genuinely has no words of its own beyond its kind: one dues payment is
   * much like another, and the family, the date and the method are the whole story.
   */
  description: string | null;
  /** Its meta line: the method, the credit a drive gave back, the cost a refund repaid. */
  note: string | null;
}

/** One dollar of spending that actually left the team's cash, where it was filed. */
export interface ExpenseCashEvent extends CashOutRecord {
  date: string | null;
}

export interface CashStrip {
  /** Revenue by month — the sum of `revenue` below, at a coarser grain. */
  in: Record<MonthKey, number>;
  /** Cash spending by month — the sum of `expenses` below. */
  out: Record<MonthKey, number>;
  /** Every revenue arrival, grouped for the REVENUE band. */
  revenue: RevenueCashEvent[];
  /** Every cash departure, placed for the EXPENSES band (payouts carry the synthetic placement). */
  expenses: ExpenseCashEvent[];
  /**
   * What this arithmetic DELIBERATELY LEFT OUT — spending a family paid the vendor directly.
   *
   * ⚠⚠ IT IS REPORTED BY THE THING THAT EXCLUDED IT, and that is the whole point. The Statement
   * counts these (the season really did incur them); cash cannot (no team money moved). Something
   * has to explain that gap to a coach, and the only safe source is here — anywhere else would be a
   * SECOND copy of the exclusion rule, free to drift from the one that actually runs. Re-derived in
   * the route, a rule change here would silently stop matching the explanation on screen.
   */
  excluded: ExpenseCashEvent[];
  /**
   * Every day a cash event landed on — fed into the month grid's range derivation so a month where
   * cash moved always has a column (owner ruling 2026-08-23, Exhibit C: the grid GROWS the column;
   * silently dropping off-range cash from the strip was rejected with the mockups).
   */
  dates: string[];
}

/**
 * The two sources behind "Money back & reimbursements", which are two different EVENTS.
 *
 * ⚠ ONE OF THEM HAS A DOOR AND THE OTHER DOES NOT, and the asymmetry is the point (owner ruling
 * 2026-08-24). Club money has a Club screen to open; a refund a coach typed in has no "thing
 * itself" behind it — the record IS the thing, and it lives on Transactions.
 */
const MONEY_BACK_RECORDED = { id: 'moneyback:recorded', name: 'Money back you recorded' };
export const MONEY_BACK_CLUB = { id: 'moneyback:club', name: 'Repaid by the club' };

/** Whole dollars where they are whole — a note line reads "$120 credited", never "$120.00". */
function money(n: number): string {
  const whole = Math.abs(n % 1) < 0.005;
  return `$${n.toLocaleString('en-CA', {
    minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
  })}`;
}

/** "Facilities / Dome time" — what a refund repaid, said the way the report files it. */
function repaidLabel(place: { categoryName: string | null; itemName?: string | null }): string | null {
  const parts = [place.categoryName, place.itemName].filter((p): p is string => !!p && !!p.trim());
  return parts.length > 0 ? `repaid ${parts.join(' / ')}` : null;
}

/** Where money handed back to a family sits — its own group, on that family's own row. */
const payoutPlace = (playerId: string | null): CashPlacement => ({
  categoryId: PAYOUT_CATEGORY_ID, categoryName: PAYOUT_CATEGORY_NAME, itemId: playerId,
});

export function buildActualCashStrip(x: CashStripInputs): CashStrip {
  const revenue: RevenueCashEvent[] = [];
  const expenses: ExpenseCashEvent[] = [];
  const excluded: ExpenseCashEvent[] = [];
  const dates: string[] = [];

  /* ⚠ A ZERO IS NOT AN EVENT. Emitting it would put a row on the grid for a record that moved
     nothing and, worse, would widen the month range to the day it did not happen. */
  const income = (
    group: RevenueGroupKey, date: string | null, amount: number,
    rec: { id: string; subject: CashSubject; kind: string; description?: string | null; note?: string | null },
  ) => {
    if (!amount) return;
    revenue.push({
      group, date, amount, id: rec.id, subject: rec.subject,
      kind: rec.kind, description: rec.description?.trim() || null, note: rec.note ?? null,
    });
    if (date) dates.push(date);
  };
  /* ⚠ THE EVENT IS BUILT FIELD BY FIELD, NEVER SPREAD FROM THE INPUT. An input row carries its own
     raw date under its own name (`paidDate`, `paidAt`, `reviewedAt`) and the whole job here is to
     resolve which of those the money actually moved on — so spreading would put a second, unresolved
     date on the event beside the answer, and the next reader has no way to know which one is real. */
  const spend = (rec: CashOutRecord, date: string | null) => {
    if (!rec.amount) return;
    expenses.push({
      id: rec.id, description: rec.description, amount: rec.amount, place: rec.place,
      note: rec.note ?? null, kind: rec.kind ?? null, date,
    });
    if (date) dates.push(date);
  };

  for (const p of x.duesPayments) {
    income('dues', p.receivedDate, p.amount, {
      id: `dues-payment-${p.id}`,
      subject: { id: p.playerId, name: p.playerName },
      kind: 'Dues payment',
      note: p.method,
    });
  }
  for (const m of x.moneyInRecords) {
    if (m.kind === 'money_back') {
      /* ⚠ A REFUND NAMES WHAT IT REPAID (owner ruling 2026-08-24). These are the figures that
         behave differently here than on the Statement — there they shrink the cost they repaid,
         here they are money that arrived — and the panel is where a coach learns that without
         reading a footnote. */
      income('moneyback', m.receivedDate, m.amount, {
        id: `money-in-${m.id}`,
        subject: MONEY_BACK_RECORDED,
        kind: 'Money back',
        description: m.description,
        note: repaidLabel(m),
      });
      continue;
    }
    /* ⚠ TYPED INCOME GROUPS BY WHAT IT WAS FILED UNDER — the only grouping a typed arrival has.
       An arrival against no item is its own row rather than a dollar with nowhere to sit. */
    income('other', m.receivedDate, m.amount, {
      id: `money-in-${m.id}`,
      subject: { id: m.itemId, name: m.itemName?.trim() || 'Not itemized' },
      kind: 'Income',
      description: m.description,
    });
  }
  for (const e of x.realisedEntries) {
    const sponsor = e.kind === 'sponsor';
    income(
      sponsor ? 'sponsorship' : 'fundraising',
      e.receivedDate ?? orgDayKey(e.createdAt),
      e.amountRaised,
      {
        id: `fundraiser-entry-${e.id}`,
        subject: { id: e.fundraiserId, name: e.fundraiserName },
        kind: sponsor ? 'Season sponsorship' : 'Fundraising',
        /* ⚠ A DRIVE'S RECORD HAS WORDS OF ITS OWN AND A SPONSOR'S DOES NOT: a drive entry is one
           family's effort, so WHO raised it is the record; a sponsor's arrival is the sponsor, who
           is already the row. */
        description: sponsor ? null : (e.playerName?.trim() || 'Team collection'),
        /* ⚠⚠ THE REBATE IS A NOTE, NOT A SECOND FIGURE. The credit already lowered that family's
           dues; printing it as an amount beside the gross would read as money leaving, which is
           the one thing a drive's cash never does. */
        note: sponsor
          ? 'received'
          : e.rebateAmount > 0.005
            ? `${money(e.rebateAmount)} credited to their dues`
            : e.playerId ? null : 'not attributed',
      },
    );
  }
  for (const r of x.clubRequests) {
    const settledOn = orgDayKey(r.reviewedAt ?? r.createdAt);
    if (r.side === 'reimbursement') {
      income('moneyback', settledOn, r.amount, {
        id: r.id,
        subject: MONEY_BACK_CLUB,
        kind: 'Money back',
        description: r.description,
        note: repaidLabel({ categoryName: r.place.categoryName, itemName: r.itemName }),
      });
    } else if (r.side === 'funding') {
      /* ⚠ THE SAME SHAPE AS TYPED INCOME, DELIBERATELY. A grant's only grouping is what it was
         filed under, so it takes the filed word as its subject — which means a club grant and an
         arrival the coach typed against the same item share one row, as they should: they are the
         same money against the same word. ⚠ THE CLUB IS NAMED IN THE **KIND**, so the row says
         where it came from without inventing a sixth revenue group for one source (D2's reasoning,
         applied to the band: filing already answers "whose dollar is this?"). */
      income('other', settledOn, r.amount, {
        id: r.id,
        subject: { id: r.place.itemId, name: r.itemName?.trim() || 'Not itemized' },
        kind: 'From the club',
        description: r.description,
      });
    } else spend(r, settledOn);
  }
  for (const p of x.expensePayments) {
    /* ⚠ RECORDED, NOT DISCARDED. The season spent this and the team's cash did not — the Statement
       counts it, this arithmetic must not, and the difference is a real question a coach asks. */
    if (p.familyPaidDirect) {
      if (p.amount) excluded.push({ id: p.id, description: p.description, amount: p.amount, place: p.place, date: p.paidDate });
      continue;
    }
    spend(p, p.paidDate);
  }
  for (const i of x.clubInstallments) {
    if (!i.paidAt) continue;
    spend(i, orgDayKey(i.paidAt));
  }
  /* ⚠ LAST ON PURPOSE. The month grid orders categories it learns from events by first appearance,
     and "Paid back to families" belongs at the FOOT of the expense band (the Option D mockup draws
     it there) rather than interleaved with the team's real spending categories. */
  for (const p of x.duesPayouts) {
    /* ⚠ BY FAMILY, MIRRORING DUES (owner call 2026-08-24) — this row was never in the D-2 spec, and
       left shut it would have been the one figure on the statement a coach could not trace to a
       record. The WHY rides on the payment's own meta line rather than splitting the group. */
    spend({
      id: p.id,
      /* ⚠ THE KIND, NOT A DESCRIPTION. Under a panel already titled "Paid back to families" the
         words say nothing — the family, the day and the reason are the record. */
      description: '',
      kind: 'Paid back',
      amount: p.amount,
      place: payoutPlace(p.playerId),
      note: [p.method, p.reason].filter(n => !!n && !!n.trim()).join(' · ') || null,
    }, p.paidDate);
  }

  const inMap: Record<MonthKey, number> = {};
  const outMap: Record<MonthKey, number> = {};
  const bucket = (map: Record<MonthKey, number>, date: string | null, amount: number) => {
    const m = monthKeyOf(date);
    if (!m) return;
    map[m] = Math.round(((map[m] ?? 0) + amount) * 100) / 100;
  };
  for (const e of revenue) bucket(inMap, e.date, e.amount);
  for (const e of expenses) bucket(outMap, e.date, e.amount);

  return { in: inMap, out: outMap, revenue, expenses, excluded, dates };
}
