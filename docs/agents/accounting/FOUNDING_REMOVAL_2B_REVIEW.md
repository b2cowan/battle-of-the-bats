# Founding Season code removed (Free League and Founding removal, Stage 2b) — does any of our own books or tax change?
**Last verified:** 2026-11-20 (the Stage 2b working copy: `lib/platform-metrics.ts` estimated monthly figure, `lib/renewals.ts`,
`app/api/billing/create-checkout/route.ts`, `lib/purchase-details.ts`, `lib/renewal-reminder*.ts`; counts only for production)
**Re-verify by:** if the Stage 2b code would reach production BEFORE migration 510 (see the finding); the first live Tournament
Plus purchase; an edit to the estimated monthly figure or to `TAXED_CHECKOUT`
**Depends on facts:** GST/HST registered, nothing sold yet (`ACCOUNTING_FACTS.md`); `FREE_LEAGUE_REMOVAL_REVIEW.md` (its trigger
"Stage 2 removal re-checks the comped-out figure and Renewals" — done here); the 2a review (holders' stored plan is the $0 plan)

## Question(s) this answers
Ruling D removes "· N comped clubs not counted" and the figure behind it; Renewals' Founding bucket goes; the $0 Tournament Plus
switch and the 2028 next-season choice are removed. Does any revenue figure, invoice, receipt, GST/HST collection or return input
change?

## Finding
**No MUST-FIX, no owner tax question. One ORDER condition, already in the production steps.**
- **The monthly figure.** It now adds the list price of every `active` organization's stored plan, with no comp exclusion. Counts
  on production today (2026-11-20): exactly 3 active organizations hold a live comp period, none with a Stripe subscription — one
  stored `tournament_plus`, one `tournament`, one `team`. Those are the three Founding holders that migration 510 moves (pending on
  production). **After 510** the two clubs' stored plan is the $0 Tournament plan and the coach's workspace row is stored ended,
  so the figure adds $0 for all three and nothing changes; the comped line would have read 0 anyway (dev: 0 such organizations).
  **If the Stage 2b code served BEFORE 510**, the figure would overstate by the Tournament Plus and Premium list prices for two
  accounts that pay nothing. It is an internal estimate (no book, invoice or return reads it), so not a tax defect — but it is why
  the production order (510 → 2b → 511) matters; it is recorded in `MANUAL_PROD_STEPS.json` 511.
- **Free time never feeds the figure** (a club's free time is a grant over its own stored plan; a staff-given portal is stored
  ended) — so a free-time version of the comped line would always read 0. Ruling D is right.
- **Renewals.** Its Founding choices and the `free_or_founding` bucket become "Free time ends" (staff-given free time). Renewals is
  a reading list: no charge, invoice or tax record is made from it. No effect.
- **The $0 Tournament Plus switch is gone.** It made no invoice and collected no tax (a $0 stored plan, no Stripe object). Every
  Tournament Plus choice now goes through the ordinary Stripe checkout with `TAXED_CHECKOUT`, the billing address read first —
  the same tax treatment, invoice and Bookkeeping flow as every paid plan (`START_DOORS_CHECKOUT_REVIEW.md`). Nothing sold yet,
  so nothing to correct. When a holder's free time ends on September 30, 2027 it returns to its own free plan or buys through that
  same taxed checkout.
- **The next-season choice is gone.** 0 next-season subscriptions on dev and production (counted 2026-11-20): no invoice, receipt or
  tax record ever came from it. The purchase-details email and the yearly renewal reminder lose a case that never fired; the
  renewal reminder (the yearly notice) still runs for renewals and yearly trials.

## Recommendation
Nothing to change in the code. Keep the production order exactly as recorded (510 before the 2b code; 511 after it serves).

## Sources
- `ACCOUNTING_FACTS.md`, `FREE_LEAGUE_REMOVAL_REVIEW.md`, `START_DOORS_CHECKOUT_REVIEW.md` — this folder
- Plan: `docs/projects/active/FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md` §4, §5, §5a (ruling D)

## Professional sign-off needed?
No.
