# Build the budget from revenue to closing balance — PM brief

**Status:** **built on dev 2026-09-12**, awaiting the owner's walk (Owner QA Ledger **§173**, the hub's QA Walk
tab). Approved 2026-09-12 on the mockup round following Owner QA §164 F1 — decisions A–D below all made, and
one more the same day: **the three tiles wear the table's own words** (Total revenue · Total expenses · Closing
balance), because a tile is the table's subtotal and one name means one number on this screen.
**Project hub:** [Mockup, this brief, the full plan and decisions on one artifact](COACH_BUDGET_REVENUE_FIRST_HUB.html).
**Plan:** [Implementation proposal](COACH_BUDGET_REVENUE_FIRST_PLAN.md).
**Mockup:** [Interactive budget states](COACH_BUDGET_REVENUE_FIRST_MOCKUP.html).

The Budget tab should let a coach build a season and check its timing without leaving for Budget vs. Actual. Both List and By period show Revenue above Expenses. Once dues exist, Player installments belongs in Revenue and opens the existing dues editor; it is derived from dues, never entered a second time as an ordinary budget line.

Before dues are set, a **Required player dues** calculation below the report shows the funding gap and the estimated amount per player. It does not enter revenue or rescue a monthly balance. The coach can preview a schedule before saving through the existing dues flow. After saving, that figure disappears and **Player installments** — the word for a dated, scheduled payment — takes its place inside Revenue.

The periodic report ends with Opening balance, Net for the month (or quarter), and Closing balance, following Budget vs. Actual. A short status sentence identifies the first month below zero, even when the whole season balances or a quarter ends positive. Quarters carry the same balances as months — a quarter's opening is its first month's, its closing its last month's — and a bad month inside an otherwise fine quarter still raises its own warning. The List gives the same season opening, season net and season closing. Existing opening money is visible separately from revenue; no silent change to the amount charged to families.

The coach can try an extra expense by amount and month and see every later balance change before saving, and can preview a dues schedule the same way before it's saved. A month's positive balance is insufficient evidence of room to spend: the proposal checks the lowest later balance too. Missing dates or unresolved estimates stop an affirmative room-to-spend claim. These remain budget projections assuming the planned receipts arrive, not today's spendable cash. **Both previews ship as part of this same project — the owner asked for them included rather than deferred.**

**The season-estimate question is settled: no policy change.** When itemized expenses run higher than the season estimate, the estimate keeps governing the total families are asked to cover — exactly as it does today — with "Lines so far" and "Over your estimate" staying visible in red immediately above it. The owner's reasoning: the real itemized total is never hidden, the gap is always flagged, and the number driving dues stays anchored to what the coach deliberately typed rather than to whichever figure happens to be bigger. This closes the question the plan originally raised for review — the recommendation to change that rule is **withdrawn**, not adopted. The one open item carried from that review: confirm every place that reads this total (Budget vs. Actual included) already agrees, since none of them should be computing it a second way.

**Access:** existing money readers see the report; existing money writers can edit lines, preview changes and use the dues editor. Archived seasons retain their current restrictions. This proposal grants no additional money or settings permissions.

**Priority:** one delivery — the report shape, the installment transition, the balances and both previews ship together, per the owner's call. Exports, help and reconciliation are part of the same delivery.

**Success:** a coach can answer what the season costs, what families need to cover, whether any month ends below zero, and whether a proposed purchase creates a later shortage. List, months, quarters and exported files reconcile. QA §164's 15 passes remain the record of the previous design; F1's follow-up proposal is now approved as written above, F2 keeps the conditional legend, and F3 keeps the matching wording.
