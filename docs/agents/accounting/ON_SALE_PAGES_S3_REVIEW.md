# On-sale pages S3: price rows, the trial sentence, "How the trial works" (review)
**Last verified:** 2026-11-20
**Re-verify by:** an edit to `planTrialLine`, `trialDaysAfterHistory`, `BILLING_TAX_WORDS.plusTax`, the home `priceRows`, or `HowTheTrialWorks`; Québec or the US opens; first live Club / League Plus purchase
**Depends on facts:** GST/HST registered, Canada only, Québec closed (`PLAN_AVAILABILITY_WHO`); checkout is Stripe Checkout, `mode: 'subscription'`, `automatic_tax` on (`TAXED_CHECKOUT`). Builds on `START_DOORS_CHECKOUT_REVIEW.md` (tax point at trial end) and the 2026-11-18 ruling in `CLUB_ON_SALE_PAGES_PLAN.md` ("Reviews run on the audience review").

## Question(s) this answers
- Are the home page's three price rows and their single tax line as ruled?
- Does `planTrialLine` match what checkout does, including a 0-day override?
- Is "How the trial works" step 4 right?
- Does the tax line sit only under open plans' prices?

## Finding
**No must-fix.** What was read, and the verdict:

1. **Home rows (`app/page.tsx:339-359`, `:583-597`).** Rows render only when `allProgramPlansOpen` (League Plus, Club, Club · Association). One tax line inside the same card: "Prices are in Canadian dollars, plus applicable taxes. Available to organizations in Canada, outside Québec for now." built from `BILLING_TAX_WORDS.plusTax` and `PLAN_AVAILABILITY_WHO`. As ruled. Every dollar figure comes from `PLAN_CONFIG` through `formatPriceAmount`. Not typed: the team counts "up to 15" / "up to 30" (`:348`), which are not prices (no tax effect) but should read `teamLimit`.
2. **Trial sentence (`lib/plan-trial-line.ts:27`).** Matches checkout: `create-checkout/route.ts:130` reads `getPlanConfigOverride` (same `getPlanConfigOverrides()` the pages read), `:341` applies `trialDaysAfterHistory` (0 for a returning customer), `:359` passes `trial_period_days` only above 0, and no `payment_method_collection` is set, so Stripe collects the payment method (its default). First charge is the trial-end invoice, taxed by the address then (tax point in `START_DOORS_CHECKOUT_REVIEW.md`). "plus applicable taxes" is right. A 0-day override shows no sentence on every surface read: `PricingSection.tsx:404-408`, `app/pricing/page.tsx:237`, `for-clubs/page.tsx:92-93`, `for-leagues/page.tsx:69`, `for-tournament-organizers/page.tsx:109`, and the "How the trial works" section (gated on the line existing). The public sentence describes a new customer; a returning customer is told "no second trial" at the plan step (`plan-billing-words.ts:414`, now with "plus applicable taxes", closing the earlier S2 finding).
3. **Step 4 (`HowTheTrialWorks.tsx:37`).** Right: the payment method is charged at trial end, plus tax, on the chosen cycle, and the subscription renews until cancelled. Step 3's email promise rests on `/billing`'s 2026-11-20 confirmation of `trial_will_end`.
4. **Tax line under open prices only.** `PricingSection.tsx:489` (`!isGated && plan.currency`), `for-clubs:272`, `:319` (inside the open branch), `for-leagues:200`, `for-coaches:166`/`:93` (`checkoutOpen`), `for-tournament-organizers:253`. As ruled.

## Recommendation
- **Should fix** `app/pricing/page.tsx:243`: one trial line stands for "Club and Club · Association" using Club's length only. If a platform admin sets different lengths, the Club · Association half is wrong. When `trialDays.club !== trialDays.club_large`, write two halves: "Club: {line} Club · Association: {line}".
- **Should fix** buttons that say "trial" regardless of an override of 0 (the sentence goes, the word stays): `for-clubs/page.tsx:121,297,334,427`, `for-leagues/page.tsx:99,218,331`. Use "Start your Club trial" only when the line exists, else "Start Club" (same for the other two).
- **Note** `app/page.tsx:339-358`: the Tournament Plus and Premium rows print prices without reading their own gate (`teamOpen` is computed at `:324` and unused here). If either closes, the one tax line sits under a closed price, which the ruling says carries none. Gate the row, or accept while both are on sale.
- **Note** `app/[orgSlug]/admin/onboarding/PlanStep.tsx:86` passes the code trial length (`PLAN_CONFIG.tournament_plus.trialDays`) to `PlanTermsLine`, while checkout uses the override. Differs only under an override.

## Sources
- Code read 2026-11-20: the files named above. No external source needed.

## Professional sign-off needed?
No new item. The standing accountant questions are unchanged (tax point of the trial-end invoice, annual first charge: `START_DOORS_CHECKOUT_REVIEW.md`).
