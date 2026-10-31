# Setting up Stripe to collect FieldLogicHQ's own sales tax
**Last verified:** 2026-10-31
**Re-verify by:** 2027-10-31, or when Stripe changes Stripe Tax pricing/behaviour, or before the first registered invoice
**Depends on facts:** registered for GST/HST (confirmed 2026-10-31; effective date to confirm); Canada-based seller with a normal (not
simplified) GST/HST registration; Stripe live config snapshot 2026-10-23 (Stripe Tax "active", origin CA, **0 tax
registrations**; prices `tax_behavior: unspecified`; no automatic tax, no address or tax-ID collection on any checkout;
customers created with email only; organizations store no country/province/address)

## Question(s) this answers
- What has to change in Stripe (and the product) for FieldLogicHQ to charge the right tax?
- How does Stripe decide where a customer is?
- What Stripe Tax can and can't do.

## Finding
- Stripe Tax returns **zero tax wherever you have no registration added** — with 0 registrations today, turning on
  automatic tax alone would charge nothing.
- A **Canada-based** business uses a **normal** GST/HST registration in Stripe; Stripe then charges GST/HST by the
  customer's province, and monitors **other provinces'** PST/QST/RST thresholds. The "a GST/HST number stops the tax"
  behaviour applies to the **simplified (non-resident) regime**, not to a Canadian seller — Canadian B2B sales still
  carry GST/HST. A **QST number** stops QST only for sellers under the specified QST regime.
- Location order for subscriptions: shipping address → billing address → payment-method billing details → IP. Checkout
  uses the address it collects. US customers need a full address (country alone isn't supported).
- Stripe Tax **does not tax Connect application fees** and doesn't count them toward thresholds.
- Event admissions are treated as taxable where the event is (relevant only if clubs ever use Stripe Tax themselves).
- Pricing (USD, Stripe support page): 0.5% of volume where registered (no-code), or per-API-call pricing, or Tax Complete
  from US$90/month with filing included (1-year contract). Canadian pricing not confirmed.

## Recommendation (in order; nothing here before the registration status is settled)
1. Add the **Canada (normal GST/HST)** registration in Stripe Tax with its effective date; origin Ontario.
2. Set every price to **tax-exclusive** and give it a SaaS tax code (prices already carry one — confirm it's right).
3. On every subscription checkout: **require a billing address**, turn on **automatic tax**, and offer tax-ID collection
   (so a club's GST/QST number shows on its invoice; it should not remove GST/HST — **test this in test mode** before
   relying on it).
4. Save the club's country and province on the organization record when it subscribes, and at payout onboarding, so
   the product (not just Stripe) knows where each club is. Add the US-customer declaration from
   ZERO_RATED_SALES_TO_US_CUSTOMERS.md for US addresses.
5. Existing subscribers have no address on file — collect one before the first taxed renewal; without it Stripe falls
   back to card details/IP, and CRA's fallback is the highest provincial rate.
6. Add BC / Québec / Saskatchewan / Manitoba registrations in Stripe only after registering with those provinces.
7. Fee statements for the online-payment fee need their own invoice process (Stripe Tax won't do it) — see
   PLATFORM_FEE_TAX_TREATMENT.md.

## Sources
- [Stripe — Collect tax in Canada](https://docs.stripe.com/tax/supported-countries/canada/collect-tax.md?tax-jurisdiction-canada=federal) — accessed 2026-10-31
- [Stripe — Customer tax IDs](https://docs.stripe.com/billing/customer/tax-ids) — accessed 2026-10-31
- [Stripe — Customer locations](https://docs.stripe.com/tax/customer-locations) — accessed 2026-10-31
- [Stripe — Zero tax / not collecting](https://docs.stripe.com/tax/zero-tax) — accessed 2026-10-31
- [Stripe — Obligations monitoring](https://docs.stripe.com/tax/monitoring) — accessed 2026-10-31
- [Stripe — Tax pricing](https://support.stripe.com/questions/understanding-stripe-tax-pricing) — accessed 2026-10-31

## Professional sign-off needed?
No for the configuration itself; yes for the registration effective date entered in step 1 (it must match CRA's record).
