# Setting up Stripe to collect FieldLogicHQ's own sales tax
**Last verified:** 2026-11-06
**Re-verify by:** 2027-11-06, or when Stripe changes Stripe Tax pricing/behaviour, or when the live account's tax settings change (re-run `scripts/audit-revenue-readiness.mjs`)
**Depends on facts:** registered for GST/HST (confirmed 2026-10-31; effective date to confirm); Canada-based seller with a normal (not
simplified) GST/HST registration; **live** Stripe snapshot 2026-11-06 (`docs/projects/active/revenue-accounting-evidence/stripe-live-2026-11-06.json`:
tax settings `active`, head office set, origin CA, preset code `txcd_10103001`, **default tax behaviour "Automatic" (`inferred_by_currency`), 0
tax registrations**, all 14 prices `tax_behavior: unspecified`, every product `txcd_10103001`); the product code built in GST/HST Stage 2
(automatic tax, billing address and tax-ID collection on every paid path)

## Question(s) this answers
- What has to change in Stripe (and the product) for FieldLogicHQ to charge the right tax?
- Which live Stripe settings must be in place before the Stage 2 code reaches production, and which are optional?
- How does Stripe decide where a customer is? What Stripe Tax can and can't do.

## Finding
- Stripe Tax returns **zero tax wherever you have no registration added**, and says so only in the tax line's reason
  (`not_collecting`); the calculation still reads as **complete** (sandbox, 2026-11-05: a US address with no US registration). With
  automatic tax on and **no Canada registration**, a Canadian buyer would be quoted and charged **$0 tax**, silently, while FieldLogicHQ
  owes the GST/HST on the sale out of its own pocket.
- A registration starts collecting the day it is added ("Start collecting immediately") or on a scheduled future date; **Stripe will not
  record a past start date** (refused in sandbox, 2026-11-05). Sales made before it is added are not taxed by Stripe.
- A **Canada-based** business uses the **`standard`** Canada registration (`simplified` is for sellers not established in Canada). Stripe
  then charges GST/HST by the customer's province. A buyer's GST/HST number does not remove the tax for a Canadian seller (proven in
  sandbox, 2026-11-05). `province_standard` (BC, SK, MB, QC) only after registering with that province.
- **Tax behaviour:** a price must carry one, or the account default ("Include tax in prices") applies to every price that has none.
  Default **"Automatic"** = exclusive for CAD and USD, inclusive for every other currency; **"No"** = exclusive always. Once a price's
  behaviour is set to inclusive or exclusive it **can never be changed**. Proven in test mode 2026-11-06
  (`.probe/gst2/part7-unspecified-price-run1.txt`): a CAD price left `unspecified`, under an exclusive default, is taxed exclusive (ON
  2,190.00 + 284.70 = 2,474.70; AB + 109.50), the tax lines read `exclusive`, the quote adds up, and the price stays `unspecified`.
- Location order for subscriptions: shipping address → billing address → payment-method details → IP. Stage 2 sends our stored billing
  address, so the fallbacks are not used on our paths.
- Stripe Tax **does not tax Connect application fees** and doesn't count them toward thresholds.
- Pricing (USD, Stripe support page): 0.5% of volume where registered (no-code), or per-API-call pricing, or Tax Complete from
  US$90/month with filing included (1-year contract). Canadian pricing not confirmed.

## Recommendation — the live account, before the Stage 2 code is promoted
**Blocking (the promote stops without them):**
1. Add the **Canada · standard (GST/HST)** registration in live Stripe Tax → *Start collecting immediately*. Without it every Canadian
   sale is charged $0 tax and the tax is owed at our cost. Do it **before** the promote, not at it: the code taxes from its first sale.
2. Set **Include tax in prices: No** (exclusive). "Automatic" already gives exclusive for our CAD prices, so this is not a correctness gap
   today; it is the owner's ruling (Stage 2 Ask 7), it matches the sandbox every test row ran on, and it keeps a future non-CAD price
   from turning inclusive by default.
3. Re-run `scripts/audit-revenue-readiness.mjs --mode live` and confirm: registrations ≥ 1 (CA, standard, active), default behaviour
   `exclusive`, every product `txcd_10103001`. Re-count production subscriptions (Ask 7): any sale made before the registration was
   added was untaxed and its GST/HST is owed by us.

**Leave alone:** the 14 live prices. They follow the default; setting each to exclusive gains nothing and cannot be undone.

**Check before the first live invoice (Part 7 walk, W9):** the live account's public business details (name, Ontario address) and that
our **GST/HST number prints on live invoices and credit notes** (the account tax ID shown on documents). The sandbox prints it because
the sandbox has it set; nothing read so far shows the live account does. A club needs it on any invoice of $30 and more to claim
its input tax credits (Input Tax Credit Information Regulations; see GST_HST_ON_SUBSCRIPTIONS_CANADA.md), and every credit note must
carry it (SOR/91-44 s.3(b); CREDIT_NOTES_ON_REFUNDS.md).

Later, unchanged: provincial registrations only after registering with that province; the online-payment fee statement needs its own
invoice process (Stripe Tax won't do it) — see PLATFORM_FEE_TAX_TREATMENT.md.

## Sources
- [Stripe — Specify product tax codes and tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior) — accessed 2026-11-06
- [Stripe — Register for sales tax, VAT, and GST (registration types; adding a registration)](https://docs.stripe.com/tax/registering) — accessed 2026-11-06
- [Stripe — Collect tax in Canada](https://docs.stripe.com/tax/supported-countries/canada/collect-tax.md?tax-jurisdiction-canada=federal) — accessed 2026-10-31
- [Stripe — Customer locations](https://docs.stripe.com/tax/customer-locations) — accessed 2026-10-31
- [Stripe — Zero tax / not collecting](https://docs.stripe.com/tax/zero-tax) — accessed 2026-10-31
- [Stripe — Tax pricing](https://support.stripe.com/questions/understanding-stripe-tax-pricing) — accessed 2026-10-31
- Sandbox probes: `.probe/gst2/tax-behaviour-run2.txt` (2026-11-05), `.probe/gst2/part7-unspecified-price-run1.txt` (2026-11-06); live
  read-only audit `stripe-live-2026-11-06.json`

## Professional sign-off needed?
No for the configuration. Yes, when convenient, for one thing: the registration's effective date on CRA's letter versus the day it is added
in Stripe — if any production sale falls between them, an accountant should confirm how the untaxed sale is reported.
