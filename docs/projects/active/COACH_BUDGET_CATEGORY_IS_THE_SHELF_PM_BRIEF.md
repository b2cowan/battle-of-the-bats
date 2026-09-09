# PM brief — The category is the shelf

**Owner-ruled 2026-09-09** · plan: `COACH_BUDGET_CATEGORY_IS_THE_SHELF_PLAN.md` · mockup artifact `728dcb1e` (Option A · Option 2 taken).
**Priority:** high — it is a consistency defect on the money screens a treasurer reads most, and half of it is a ruling from 8 September that was recorded and never built.
**Status:** built on dev 2026-09-09; every automated gate green; **Owner QA §158 owed** (walk artifact `c8659d30`), with three calls for the owner to confirm on the built screen — see the plan's status line.

## What changes for a coach

**One rule for where money shows up: under the category you filed it in.** Today that is true for costs everywhere, and for money coming in only on two of the six screens that show it. After this it is true everywhere.

- **Budget Plan.** The funding half of the plan stops reading *Fundraising · Sponsorship · Other income* and reads the categories the coach actually chose — *Fundraising · Sponsorship · Tournaments · Other Income*, plus any category they made themselves — each with its subtotal, exactly the way the cost half already reads. A concession stand filed under Tournaments appears under **Tournaments**. The month-by-month grid and both downloads follow the same headings.
- **Budget vs. Actual — Months.** The revenue rows take the same category names. *Sponsorships* becomes *Sponsorship* (the category's name), and the catch-all *Other income* row becomes real categories: *Tournaments* for tournament money, *Other Income* only when something was filed there. Player dues stays first, Money back & reimbursements stays its own band, every total is unchanged to the cent.
- **Budget vs. Actual — Statement and By activity.** No change. These already worked the way the owner expects; they are the model the others now match.
- **"What am I forgetting?"** stops being a wall of 57 chips. Opening it shows two headings in the form's own words — *Money coming in*, *Money the team spends* — and under each, one button per category with a count (*Team Gear 9 · Facilities 6 …*). Tap a category to see its words; tap a word to add it, as before. Fourteen rows instead of fifty-seven chips on a desktop; on a phone the seven funding words are on the first screen instead of a screen and a half down.

## Why it matters

A coach files a line under **Tournaments** and, one screen later, cannot find the word Tournaments anywhere. The 8 September ruling promised the grouping; this finishes it in the simpler of the two ways drawn (peer heading, not a heading nested inside *Other income*) and applies the one rule across all six surfaces, so the plan, the grid, the downloads and the three Budget vs. Actual views agree about what a heading means.

## Trade-offs made

- **Bigger change, simpler end state.** The alternative (nesting Tournaments inside *Other income*) was lower-risk and kept the 8 September wording exactly; it was rejected because it left the funding side one level deeper than the cost side and produced the heading "Other income → Other Income".
- **Two earlier rulings are amended, on the record.** Months' "group by where the money came from" (23 Aug) now applies only to Player dues and Money back — the two rows that genuinely are not categories. The "Sponsorships keeps its name" ruling (24 Aug) was about lens renaming and still holds; the row simply takes the category's name under every lens.
- **No colour by direction.** Settled 2 September; colour is for cash.
- **Duplicate standard words are not touched.** Two rows called *Insurance* stay two rows. Whether the standard vocabulary should offer the same word twice is a separate owner session (plan §7).

## Role and access

No change. The forgetting list remains a write-coach control; read-only coaches see the plan grouped the new way and nothing more.

## Success criteria

- A tournament revenue line shows under **Tournaments** on the plan list, the period grid, both plan downloads, and the Months view — and the Statement still shows it there.
- Months' revenue category set equals the Statement's (Player dues and Money back aside), enforced by the money-report check.
- Every total on every surface unchanged to the cent.
- The forgetting list at 390px shows both headings and the funding categories without scrolling.
- Owner QA §158 passes at true size on a real handset.

## Follow-on decision (owner)

A **standard vocabulary review** — the 57 default words were seeded in two generations and overlap in seven places. Its own decision sheet with usage counts from both databases, then a data migration if merges are ruled.
