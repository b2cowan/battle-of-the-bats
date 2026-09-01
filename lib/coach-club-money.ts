/**
 * THE CLUB RELATIONSHIP, IN ONE VOCABULARY — the shared half of the Club tab (money redesign P4).
 *
 * Two kinds of record describe a team's money with its club: what the club **bills** it
 * (`rep_allocation_splits` → `rep_allocation_installments`) and what the team **asks** of it
 * (`rep_team_payment_requests`). Until P4 they were two tabs, two panels and two independent row
 * shapes; the merge gives them one screen, so the shape a request is read in lives here rather than
 * being spelled out at each of the three route handlers that return one. (It already had three
 * near-identical copies — the GET, the POST and the PATCH — and they had already drifted: only one
 * of them returned `accountingEntryId`.)
 *
 * ⚠ This module is framework-free and does no database work: the merged panel imports it for the
 * type, and route handlers import it for the mapper. Nothing here may reach for `supabase-admin`
 * or the client bundle grows a service-role graph (the lesson `coach-budget-item-usage.ts` is split
 * out to record).
 */

/** The two directions, from the TEAM's side. Stored values — do not rename without a migration. */
export type ClubRequestType = 'payment_to_org' | 'charge_to_org';
export type ClubRequestStatus = 'pending' | 'approved' | 'denied';

/**
 * What money arriving FROM the club MEANS — the coach's answer, never the code's (mig 271).
 *
 * ⚠⚠ NULL IS **LEGACY**, NOT "UNANSWERED", and every reader must treat it as `reimbursement`.
 * Requests approved before mig 271 keep the reading they already report under; there is no
 * backfill, by standing rule, so no report restates itself under a treasurer who has already
 * reconciled the month. Only `charge_to_org` ever carries one (CHECK-enforced).
 */
export type ClubMoneyInMeaning = 'funding' | 'reimbursement';

/**
 * The ask, in the exact words the mockup draws ("New Money, or Money Back" frame 1, owner-approved
 * 2026-08-30) — the label, the two sentences and their sub-lines.
 *
 * ⚠ IT LIVES HERE, NOT ON THE PANEL, because TWO surfaces ask it: the request window (while the
 * club has not answered) and the row's own filing dialog (which stays open for good — D3: the
 * record locks, the team's label does not). Two copies of one question is how one screen ends up
 * asking something subtly different from the other, which for this question would file real money
 * on the wrong side of the books.
 */
export const CLUB_MONEY_IN_ASK = {
  label: 'New money, or money back?',
  options: [
    {
      value: 'funding' as const,
      name: 'New money for the season',
      sub: 'A grant, or a cost the club agreed to carry — adds to what the season has',
    },
    {
      value: 'reimbursement' as const,
      name: 'Paying us back for a cost',
      sub: 'Nets into the cost it repaid — never counts as income twice',
    },
  ],
};

/** The answer in two words, for a row that prints its meaning rather than asking it. */
export const CLUB_MONEY_IN_WORD: Record<ClubMoneyInMeaning, string> = {
  funding: 'New money',
  reimbursement: 'Money back',
};

/**
 * What a request's meaning READS AS on a screen or in a spreadsheet — null-safe, so a display
 * surface never decides for itself what a missing answer means.
 *
 * ⚠⚠ THE `?? 'reimbursement'` USED TO BE WRITTEN OUT AT EVERY CALL SITE (`/simplify`, 2026-08-30),
 * and there were already two — the Club tab's row and the CSV export — before this build was a day
 * old. `clubRequestReportSide` centralises the same rule for every REPORT consumer; the display
 * ones had nothing to import, so each re-decided that NULL means "money back". Get it wrong on a
 * third surface and the screen labels a legacy row "New money" while the report counts it as a
 * repayment — the same record, two answers, which is the whole defect class this column exists in.
 *
 * ⚠ Returns null for a request going TO the club: a cost has no second reading, and printing one
 * would invent a distinction the record does not carry.
 *
 * ⚠ IT ACCEPTS `undefined` AS WELL AS NULL, and only because it is a DISPLAY helper: an export row
 * shape may not carry the field at all, and "absent" and "unanswered" read the same to a coach.
 * `clubRequestReportSide` deliberately does NOT — it decides where money lands, and a caller that
 * forgot to select the column must fail to compile rather than quietly report every arrival as a
 * repayment.
 */
export function clubMoneyInWord(
  r: { requestType: ClubRequestType; moneyInMeaning?: ClubMoneyInMeaning | null },
): string | null {
  if (r.requestType !== 'charge_to_org') return null;
  return CLUB_MONEY_IN_WORD[r.moneyInMeaning ?? 'reimbursement'];
}

export interface ClubRequest {
  id: string;
  requestType: ClubRequestType;
  amount: number;
  description: string;
  paymentMethod: string | null;
  notes: string | null;
  status: ClubRequestStatus;
  denialReason: string | null;
  /** ⚠ The CLUB's `org_budget_lines` id — not the team's filing. See `budgetItemId`. */
  budgetLineId: string | null;
  /**
   * What money coming IN from the club means (mig 271). NULL on every `payment_to_org` — a cost
   * has no second reading — and on every request raised before that migration, where it means
   * LEGACY rather than unanswered. See `ClubMoneyInMeaning`.
   */
  moneyInMeaning: ClubMoneyInMeaning | null;
  /** What the team filed it under, in its own taxonomy (mig 250). Null until filed. */
  budgetCategoryId: string | null;
  budgetItemId: string | null;
  budgetCategoryName: string | null;
  budgetItemName: string | null;
  accountingEntryId: string | null;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * One database row → the shape every club surface reads.
 *
 * `names` is optional because the two write paths already know the item they just resolved and have
 * no list to look it up in; the GET passes the maps it built for the whole page.
 */
export function mapClubRequest(
  row: Record<string, any>,
  names?: { item?: string | null; category?: string | null },
): ClubRequest {
  return {
    id:                 row.id,
    requestType:        row.request_type,
    amount:             Number(row.amount),
    description:        row.description,
    paymentMethod:      row.payment_method ?? null,
    notes:              row.notes ?? null,
    status:             row.status,
    denialReason:       row.denial_reason ?? null,
    budgetLineId:       row.budget_line_id ?? null,
    moneyInMeaning:     (row.money_in_meaning as ClubMoneyInMeaning | null) ?? null,
    budgetCategoryId:   row.budget_category_id ?? null,
    budgetItemId:       row.budget_item_id ?? null,
    budgetCategoryName: names?.category ?? null,
    budgetItemName:     names?.item ?? null,
    accountingEntryId:  row.accounting_entry_id ?? null,
    createdBy:          row.created_by ?? null,
    reviewedBy:         row.reviewed_by ?? null,
    reviewedAt:         row.reviewed_at ?? null,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at ?? null,
  };
}

/**
 * ⚠⚠ WHICH SIDE OF THE ITEM LIBRARY A CLUB **BILL** FILES AGAINST — always the money-OUT side.
 * Stated once, here, because it is the rule most likely to be "corrected" by someone reading the
 * direction off the money instead of off the thing.
 *
 * A bill is what the club charges the team. What it is FOR is a cost, whichever way the money
 * happens to travel, so it files against the team's spending vocabulary. Getting it backwards does
 * not merely mis-file a row; it double-counts the season. `rep_team_money_in`'s own table comment
 * spells out the arithmetic — *"counted twice, a $325 reimbursement makes a season look $650 better
 * than it is."*
 *
 * ⚠⚠ IT NO LONGER SPEAKS FOR A **REQUEST** (mig 271, owner D1). Until this release one constant
 * answered for all three kinds of club money, and its comment said so — a `charge_to_org` filed
 * against the spending words because it was *assumed* to be a reimbursement. That assumption is the
 * thing D1 deleted: a club GRANT is new money, files against the income words, and reports as
 * revenue. A request now asks `clubRequestItemDirection` instead, which reads the coach's answer.
 * The bill keeps this constant, and keeps it unconditionally — a club cannot grant a team money by
 * billing it.
 */
export const CLUB_MONEY_ITEM_DIRECTION = 'out' as const;

/**
 * Which side of the item library a REQUEST files against — decided by the coach's answer, not by
 * the direction of the money (mig 271).
 *
 * ⚠ A LEGACY ROW (NULL meaning) KEEPS THE OUT SIDE, which is the word it was actually filed with.
 * Anything else would show a coach a picker that cannot offer the item their own record already
 * carries.
 *
 * ⚠⚠ IT IS A PROJECTION OF `clubRequestReportSide`, NOT A SECOND COPY OF THE RULE (`/simplify`,
 * 2026-08-30). It shipped as its own condition —
 * `requestType === 'charge_to_org' && moneyInMeaning === 'funding'` — which is the same test the
 * report side already makes, written twice. Two spellings of one rule is how the picker comes to
 * offer the income words for a record the report is filing as a cost: nothing would fail, and the
 * money would land on the wrong side of the books. Derived, the question "what counts as funding?"
 * has exactly one answer in this file.
 */
export function clubRequestItemDirection(
  r: { requestType: ClubRequestType; moneyInMeaning: ClubMoneyInMeaning | null },
): 'in' | 'out' {
  return clubRequestReportSide(r) === 'funding' ? 'in' : 'out';
}

/**
 * Where an APPROVED club request lands on Budget vs. Actual. Three answers, and the middle one is
 * the whole point of migration 271.
 *
 *   · `cost`          — `payment_to_org`: the team sent the club money, like any other spending.
 *   · `reimbursement` — the club paying the team back. NETS into the item it repaid, in brackets,
 *                        and is **never** revenue: counted as income, a $325 reimbursement makes a
 *                        season look $650 better than it is.
 *   · `funding`       — new money the club gave the season (a grant, or a cost it agreed to carry).
 *                        Its own REVENUE row, under its filed name, with a dash in Budget when
 *                        nothing was planned. No budget line is ever created for it.
 *
 * ⚠⚠ THIS REPLACED A BOOLEAN PREDICATE, AND THE OLD ONE'S REASONING IS WORTH RECORDING RATHER THAN
 * DELETING. `clubRequestIsReimbursement(type)` argued — correctly, at the time — that the
 * distinction was "permanently binary (a request is the team paying the club, or the club paying
 * the team back; there is no third direction)". The direction still has no third value. What the
 * argument missed is that the REPORT SIDE was never the direction: two different events arrive as
 * one `charge_to_org`, and only a coach can say which. So the shape that was right for two answers
 * had to grow a third, and a union is now the honest form.
 *
 * ⚠⚠ AND NOBODY COMPARES IT TO A LITERAL — `clubRequestOnSide` below is how a caller acts on it.
 * That is not deference to the budget-line-kind guard (which fires on two of these three words and
 * is right to, having been written after a two-member enum grew a third across nineteen readers);
 * it is the same lesson applied to the same shape. A `switch` narrows for TypeScript and still lets
 * a fourth answer reach a `default` nobody wrote; an exhaustive record of handlers cannot be
 * written incompletely.
 *
 * ⚠ NULL MEANING = LEGACY = `reimbursement`, which is exactly the reading those rows have reported
 * under since they were approved. That is the whole of "no backfill, no restatement".
 */
export type ClubRequestReportSide = 'cost' | 'reimbursement' | 'funding';

export function clubRequestReportSide(
  r: { requestType: ClubRequestType; moneyInMeaning: ClubMoneyInMeaning | null },
): ClubRequestReportSide {
  if (r.requestType === 'payment_to_org') return 'cost';
  return r.moneyInMeaning === 'funding' ? 'funding' : 'reimbursement';
}

/**
 * Do the one thing this request's side calls for — the only way a caller should act on the answer.
 *
 * ⚠ THE HANDLER SET IS A `Record` OVER THE UNION, so every side must be handled or the file does
 * not compile. That is the whole reason this exists rather than a `switch` at the call site: a
 * switch on a narrowed union is *checked* by TypeScript only if somebody remembers to write the
 * exhaustiveness assertion, and the money defect this replaced was precisely a branch that read two
 * cases where three existed.
 */
export function clubRequestOnSide<T>(
  r: { requestType: ClubRequestType; moneyInMeaning: ClubMoneyInMeaning | null },
  handlers: Record<ClubRequestReportSide, () => T>,
): T {
  return handlers[clubRequestReportSide(r)]();
}

/**
 * The ask, validated once for both write doors — create, correct, and re-file.
 *
 * ⚠⚠ REQUIRED ON `charge_to_org`, AND THE SERVER IS WHERE THAT LIVES. The panel asks, but a hidden
 * or unsent field is presentation; this is the rule. Without it the column would take NULL on a new
 * record, and NULL means LEGACY — so a request created today would silently join the pile of rows
 * the report is entitled to read as reimbursements without anyone having said so. That is exactly
 * the guessed reversal D1 exists to end.
 *
 * ⚠ AND IT REFUSES A MEANING ON `payment_to_org` rather than quietly dropping one. The column's
 * own CHECK says the same thing, so accepting-and-discarding here would turn a caller's mistake
 * into a 500 at the database instead of a sentence — or, if the CHECK were ever relaxed, into a
 * stored value nothing reads and the next person to write a query believes.
 *
 * ⚠ A FLIP FROM "From the club" TO "To the club" ON A PENDING REQUEST CLEARS THE ANSWER, which is
 * this function returning `null` for the outgoing direction. The correction form sends whatever it
 * is holding; the rule that a cost has no second reading is applied here, not there.
 */
export function resolveMoneyInMeaning(
  requestType: ClubRequestType,
  raw: unknown,
): { ok: true; value: ClubMoneyInMeaning | null } | { ok: false; error: string } {
  const given = raw === '' || raw === undefined ? null : raw;
  if (requestType === 'payment_to_org') {
    if (given !== null) {
      return { ok: false, error: 'A request to send the club money is a cost — it has no new-money answer.' };
    }
    return { ok: true, value: null };
  }
  if (given !== 'funding' && given !== 'reimbursement') {
    return { ok: false, error: 'Say whether this is new money or the club paying you back.' };
  }
  return { ok: true, value: given };
}
