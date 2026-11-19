# Free League removal, Stage 1 — does any of our own books or tax depend on it?
**Last verified:** 2026-11-19 (commit `859a2d0b5`: the removed metrics block, `lib/platform-metrics.ts` MRR and comp lines, `components/PricingSection.tsx` League card, `lib/plan-trial-line.ts`; counts only for production: organizations with the free-League mark 0)
**Re-verify by:** the first live League Plus purchase; an edit to `planTrialLine`, `BILLING_TAX_WORDS` or the card's tax line; Stage 2 (Founding) removal, which touches the "comped out of revenue" figure
**Depends on facts:** GST/HST registered, nothing sold yet (`ACCOUNTING_FACTS.md`); `START_DOORS_CHECKOUT_REVIEW.md` (League Plus checkout, trial-end tax point); BUSINESS_DECISIONS 2026-11-18 Ask 8 (b)

## Question(s) this answers
Did anything in FieldLogicHQ's own books, Bookkeeping page, invoices or receipts, GST/HST collection, export catalog or revenue figures use the free League, and is the League Plus card's trial wording consistent with where tax first appears?

## Finding
**No MUST-FIX, no owner tax question.**
- **No revenue ever sat on the free League.** It charged nothing, production held 0 organizations on it (counts only), so there is no sale, invoice, receipt, GST/HST collected or return input to correct. The mark appears in no tax, Bookkeeping, sales-record or export code (a full-tree search of `app/`, `lib/`, `components/`, `scripts/` and `tests/` finds none left).
- **The one figure that read it was a usage funnel, not money.** The removed "League Starter" panel and `leagueStarter` block counted free-mark organizations and seven analytics events (seasons created, schedules generated, scope-wall hits, upgrade intents). Estimated monthly revenue is unchanged: it still reads paying subscriptions (`stripe_subscription_id`) and leaves out clubs on a running comp period (`comp_period`, `lib/platform-metrics.ts:244-279`), neither of which used the free-League mark. The comped-out-of-revenue figure is untouched until Stage 2.
- **The card now matches how tax first appears.** The League Plus card's note is the one trial sentence (`planTrialLine`), whose text includes "first charged, plus applicable taxes, when the trial ends"; the tax line under the price is the same `BILLING_TAX_WORDS.plusTax` every plan card prints. That is exactly Ask 8 (b) and the tax point the checkout review recorded (the trial-end invoice date). It replaces "No credit card required", which checkout contradicted. Not a tax change; no rate, setting, price or trial length moved.
- **One small thing to keep in mind (not tax):** the card quotes the code's 30 days, while checkout uses the server value a platform admin can override. If that override is ever set for League Plus the card and the invoice date disagree. Same exposure as the Club card; no tax effect (the tax point follows the invoice, not the card).

## Recommendation
Nothing to change. When Stage 2 removes Founding, re-check the comped-out-of-revenue line and the renewals report together (they share the comp record).

## Sources
- `ACCOUNTING_FACTS.md`, `START_DOORS_CHECKOUT_REVIEW.md` — this folder
- BUSINESS_DECISIONS.md 2026-11-18 "Trial words on the plan pages" (Asks 7, 8, 31)

## Professional sign-off needed?
No.
