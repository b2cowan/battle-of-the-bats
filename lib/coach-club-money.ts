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
 * ⚠⚠ WHICH SIDE OF THE ITEM LIBRARY A CLUB RECORD FILES AGAINST — **always the money-OUT side**,
 * on both request directions and on an allocation. Stated once, here, because it is the rule most
 * likely to be "corrected" by someone reading the direction off the money instead of off the thing.
 *
 * A `charge_to_org` brings money IN — the club is covering or paying back a cost — but what it is
 * FOR is a cost, so it files against the team's spending vocabulary. This is the refund rule
 * (mig 246 + redesign P2) applied to club money: **the direction flips the money, never the list.**
 *
 * Getting it backwards does not merely mis-file a row; it double-counts the season.
 * `rep_team_money_in`'s own table comment already spells out the arithmetic — *"counted twice, a
 * $325 reimbursement makes a season look $650 better than it is."*
 */
export const CLUB_MONEY_ITEM_DIRECTION = 'out' as const;

/**
 * Does an approved request land on Budget vs. Actual as a REIMBURSEMENT rather than a cost?
 *
 * ⚠ It is NOT a third concept — it is exactly the `rep_team_money_in` distinction the report already
 * runs on, reached from a different table:
 *  - `payment_to_org` — the team sends money to the club — is a **cost**, like a recorded expense.
 *  - `charge_to_org`  — the club covers or pays back a cost — is a **reimbursement**, which NETS
 *    into the item it repaid and is **never** counted as revenue. Counted as income instead, a $325
 *    reimbursement makes a season look $650 better than it is.
 *
 * ⚠ A PREDICATE, NOT A `'cost' | 'reimbursement'` UNION, and the reason is worth keeping. The union
 * form made its caller write `=== 'cost'`, which tripped `budget-line-kind-guard` — a guard that
 * exists because comparing a *budget line kind* to a literal was correct with two kinds and silently
 * wrong with three. This distinction is permanently binary (a request is the team paying the club,
 * or the club paying the team back; there is no third direction), so the right answer was to remove
 * the literal rather than to claim an exemption from the guard. Same reasoning migration 246's
 * review applied to `budget_items.direction`.
 *
 * ⚠ It names the REIMBURSEMENT case deliberately: that is the counter-intuitive half — money
 * arriving that must not be booked as income — so the call site reads with the surprising branch
 * named rather than implied.
 */
export function clubRequestIsReimbursement(type: ClubRequestType): boolean {
  return type === 'charge_to_org';
}
