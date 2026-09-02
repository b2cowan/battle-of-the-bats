# PM Brief — Money returned to families gets its own band

**Plan:** `docs/projects/active/COACH_MONEY_RETURNED_BAND_PLAN.md`
**Mockup:** `https://claude.ai/code/artifact/cc79b9c1-3871-402b-9aea-fcc3ea50a443`
**Status:** planned, not built. Owner-ruled 2026-09-02.
**Priority:** medium — a clarity fix on the portal's most closely read money screen, with one real
defect riding along.

---

## The problem, in the words that found it

A coach opened Budget vs. actual → Months and asked why the report said the season spent $3,945
while Headroom said $3,545. Chasing it down produced a better question: **why is "Paid back to
families" inside the Expenses band at all?**

It should not be. Money handed back to a family is one of two things, and neither is spending:

- **Revenue going back out** — a family overpaid their dues, or raised more at the bottle drive than
  their dues came to, or takes a share of a season-end surplus.
- **Cash settling a cost already counted** — a parent buys a bucket of balls; the season's spending
  goes up that day, whoever paid. The cheque that repays them months later is not a second cost.

Filed under a heading that says "Expenses", the first looks like spending it is not, and the second
looks like spending counted twice.

## What changes for the coach

On the Months view, **"Money returned to families" becomes its own band** below Expenses, with its
own subtotal, outside Total expenses.

- **Total expenses now means one thing:** cash the team paid vendors.
- **The closing balance does not move.** The band is still subtracted — it just is not called an
  expense.
- **Nothing else in the product changes at all** — not Headroom, not the Statement view, not Player
  Dues, not the Overview card, not cash on hand. It is a filing change, not an arithmetic one.

A second, smaller piece ships with it: **a collapsed tie-out under the table** that walks Total
expenses to Headroom in two lines, so the two figures on the same screen stop looking like a
contradiction. The Statement view has had this for a while; the Months view, which is where a
treasurer actually goes looking, never has.

## A defect fixed on the way past

Today, on the Difference lens, "Paid back to families" prints a red **−195** — reading as "$195 over
budget" against a budget that does not and cannot exist. The band will not render on that lens at
all.

## Why not the more thorough option

An earlier draft proposed routing each payout by what it settles: dues refunds netting against
revenue, reimbursements filing against the original cost's category. **The owner rejected it, and
the reason is worth keeping:** a payout draws on a family's pooled credit balance. A parent who buys
equipment *and* sells at a fundraiser gets one credit for both, so the cheque is part one and part
the other in proportions nobody recorded. Routing it means inventing an attribution that does not
exist. This is not a "later" — it is settled.

## Customer impact

- **Who sees it:** every coach and team treasurer using the Money area. Head coaches and assistants
  alike; no role differences.
- **Risk:** low. No data change, no migration, no new question asked of anyone. The main risk is
  cosmetic — a third band on a table that already fights for horizontal room on a phone.
- **Not a billing or plan-gating change.**

## Success criteria

1. Total expenses on Months equals cash paid to vendors, and a coach can say what it counts without
   opening help.
2. Headroom and Total expenses no longer look like a contradiction: the difference is stated on the
   screen, in two lines, in the coach's own vocabulary.
3. Every figure outside the Months view is unchanged, provably — the existing money-report guard
   holds its bridge identity throughout.
4. The in-app help and the coach demo's money narration describe the new shape in the same unit of
   work, not the next release.

## Open calls for the owner

1. **The band's name** — "Money returned to families" (recommended), "Paid back to families"
   (today's wording), or "Money returned".
2. **Does the Expenses band get a caption** saying it counts cash paid to vendors? Recommended yes,
   as one line in the footnote already under the table.
3. **Does the band appear on the Difference lens?** Recommended no.
4. **Does the Statement view gain the band?** Recommended no — it stays named in that view's existing
   cash bridge.

## Deliberately parked

Two findings turned up alongside this and are not in scope until called:

- The Difference lens's Total column counts months that have not happened, so a row can disagree
  with its own months by a dues instalment nobody owes yet.
- The "No date yet" column treats undated plan money as good news on both bands — correct for
  spending, backwards for income not yet collected.
