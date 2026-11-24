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

**DONE 2026-11-06 (owner, live account; read-only audit `stripe-live-2026-11-06-after-registration.json`):** Canada registration added
("I've already registered", **standard**, start 2026-11-06 20:17 UTC, no end date; audit: 1 registration, `active`); default tax
behaviour now **exclusive** (set by Stripe's setup wizard, was "Automatic"); preset SaaS business use (`txcd_10103001`) unchanged; automatic
tax on for Dashboard-made invoices; the owner's GST/HST number added to the invoice template as the default (owner-confirmed; the number
ends 002, correct for the account; a printed live invoice or credit note not yet seen). Four unused add-on prices (Additional Rep Team,
Coaches Portal Org Add-on, monthly + yearly) were archived by the owner the same day: 14 → 10 prices, no code or env reference to them
(grep). The Locations page still showed "Needs attention" after setup (page data was 20 hours old); filing is "I'll file myself". Still owed:
re-count production subscriptions made before 2026-11-06 (untaxed, tax owed by us), and re-run the audit at the promote.

**Re-checked 2026-11-17 (read-only live audit `stripe-live-2026-11-17.json`, run by the agent at the owner's `/brief do`):** tax
settings, registrations and the account are **identical** to the 6 Nov after-registration audit — 1 registration, CA, `active`, from
2026-11-06 20:17 UTC, no end; default behaviour `exclusive`; origin CA; head office complete (no missing fields); all 10 prices
`txcd_10103001` and `unspecified`. Not tax, noted: one product renamed (Coaches Portal Premium → Premium Coaches Portal); the live
webhook gained 13 events (disputes, refunds, payment methods, invoice and credit-note events); Stripe's own default portal
configuration now has customer updates off (our sessions name our own configuration; ours, v2, does not exist on live yet). The
re-run at the promote and the re-count of production subscriptions stay owed as release steps, not owner steps.

**Re-checked 2026-11-22, after the promote was serving (read-only live audit `stripe-live-2026-11-22.json`, GST/HST Stage 9):**
every section identical to 2026-11-17 (1 CA registration `active`, default `exclusive`, 10 prices `unspecified`, no errors). The
"re-run at the promote" step is **done**. The re-count of production subscriptions made before 2026-11-06 is **done: zero**
(production counts read before the 2026-11-22 migrations: no subscriptions), so no untaxed sale exists to self-assess. Still open,
and only this: a printed live invoice or credit note has never been seen (the W9 check below).

**⚠ OPEN 2026-11-22 — the live dashboard says "Needs attention" on Canada.** Stripe moved Tax › Registrations to **Tax › Locations**.
There the one row reads *Canada (GST/HST) · 1 registration · Status **Needs attention** · Filing setup —*, with the tiles *Needs
attention 1, Collecting and filing 0, Not collecting tax 0*. Tax › Overview also shows *Continue Tax setup — 1/2 steps completed*,
while its Action items say *You're all set*. Stripe's docs (registering, monitoring) give exactly three causes for Needs attention:
sales over a threshold with no registration; **"an active registration but your tax setup is incomplete (for example, missing head
office address or preset product tax code)"**; or a draft registration application not yet submitted. Only the second fits an active
registration. "Collecting tax" is defined as an active registration **and** a complete setup, so on the docs' own words this row is
**not** in the collecting state. Whether calculation actually stops is **not stated**. It conflicts with the API read the same day
(tax settings `active`, `missing_fields` empty, preset code set, head office complete), so the dashboard is counting a step the API
does not report. Filing setup "—" is expected: that column belongs to Stripe's own filing service, and we file with CRA ourselves.
**Settles it:** (1) the dashboard's own reason, found by clicking the Canada row or Overview › *Continue setup*. Read it, change nothing
until it is known. (2) The §557 walk step B4: a live checkout with an Ontario address must show **HST 13%** on its own line. A $0
tax line there means Canadian sales are going out untaxed, and the first live sale must wait. Until both are read, "collecting on
live" is **unproven**, even though every API field says yes.
**Reason read 2026-11-22 (owner, the Canada (Federal) page):** *"you've added a tax registration, but your Stripe Tax setup isn't
complete. Continue Tax setup to start calculating and collecting tax on subscriptions, invoices, and payment links."* The page also
shows the GST/HST number ending 002, Standard, start 2026-11-06 20:17 UTC, no end date. The wording names Stripe's own no-code
surfaces. Our code switches automatic tax on, explicitly, on every paid path: checkout, plan moves, schedules, previews. So the most
likely reading is a dashboard default that our sales don't use. B4 is still the proof, and the unfinished step must be read before it
is completed.
**The unfinished step is choosing a Stripe Tax plan (owner screenshot of the setup wizard, 2026-11-22):** 1 Choose a Stripe Tax plan →
2 Choose where to collect and file → 3 Set up your integration. Plans, re-read 2026-11-22 (stripe.com/en-ca/tax/pricing and the
support pricing page): **Tax Basic** covers calculation and collection only, pay-as-you-go with no recurring fee. No-code use (Checkout,
Billing, Invoicing, Payment Links) costs 0.5% of volume where registered; API calculations cost CA$0.50 per transaction. **Tax Complete**
adds registrations and filing, from CA$120/month on a 1-year contract, and its Canada filing covers **only the Simplified (non-resident)
GST/HST registration, not a Normal one like ours**, so it buys us nothing. **Recommendation: Tax Basic.** The docs do not say what a live
account with no plan chosen does to automatic tax (calculated, $0, or an error), so B4 runs **after** the plan is chosen. In step 2,
add nothing: the Canada registration is already there, and filing is skipped because we file with CRA. In step 3, keep tax **added on
top** (exclusive) and edit no prices. Step 3 turned out to be guide links only (Subscriptions, Invoices: "Add automatic tax to your
…"). Nothing to switch on, because our code already turns automatic tax on per sale. **Where the 0.5% lands:** only on our own plan
billing. Automatic tax is enabled only on the subscription and plan-billing paths (checkout, plan moves, schedules, renewal and
proration invoices). Families' online payments to clubs never turn it on, and Stripe Tax does not tax or count Connect application
fees. The fee is charged per completed transaction in a jurisdiction where we are registered, so today that means Canadian buyers'
invoices, **renewals included**, not only the first sale. A US buyer is calculated at $0, with no registration, and Stripe states no
fee there. A price preview is not a transaction; the docs do not say outright that previews are free, but the per-transaction wording
implies it.
**Setup wizard completed 2026-11-22 (owner, live; recommended plan Tax Basic):** Tax › Overview no longer shows *Continue Tax setup*,
and Action items say *You're all set*. The Locations row was then read (owner screenshot, same day): *Canada (GST/HST) · 1 registration · **Collecting tax***,
with the tiles Needs attention 0 and Collecting and filing 1. Still to read: B4 (HST 13%
on a live checkout). This block closes when both are seen.

**Leave alone:** the 14 live prices. They follow the default; setting each to exclusive gains nothing and cannot be undone.

**Check before the first live invoice (Part 7 walk, W9):** the live account's public business details (name, Ontario address) and that
our **GST/HST number prints on live invoices and credit notes** (the account tax ID shown on documents). The sandbox prints it because
the sandbox has it set; nothing read so far shows the live account does. A club needs it on any invoice of $100 and more to claim
its input tax credits (Input Tax Credit Information (GST/HST) Regulations, tiers since 2021-04-20 — the old $30 tier is gone; see
GST_HST_ON_SUBSCRIPTIONS_CANADA.md), and every credit note must
carry it (SOR/91-44 s.3(b); CREDIT_NOTES_ON_REFUNDS.md).

Later, unchanged: provincial registrations only after registering with that province; the online-payment fee statement needs its own
invoice process (Stripe Tax won't do it) — see PLATFORM_FEE_TAX_TREATMENT.md.

## Sources
- [Stripe — Specify product tax codes and tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior) — accessed 2026-11-06
- [Stripe — Register for sales tax, VAT, and GST (registration types; adding a registration)](https://docs.stripe.com/tax/registering) — accessed 2026-11-06; Locations statuses re-read 2026-11-22
- [Stripe — Monitor your obligations (Locations statuses)](https://docs.stripe.com/tax/monitoring) — accessed 2026-11-22
- [Stripe — File with Stripe (Filing setup column)](https://docs.stripe.com/tax/file-with-stripe) — accessed 2026-11-22
- [Stripe — Collect tax in Canada](https://docs.stripe.com/tax/supported-countries/canada/collect-tax.md?tax-jurisdiction-canada=federal) — accessed 2026-10-31
- [Stripe — Customer locations](https://docs.stripe.com/tax/customer-locations) — accessed 2026-10-31
- [Stripe — Zero tax / not collecting](https://docs.stripe.com/tax/zero-tax) — accessed 2026-10-31
- [Stripe — Tax pricing](https://support.stripe.com/questions/understanding-stripe-tax-pricing) — accessed 2026-10-31; re-read 2026-11-22
- [Stripe — Tax pricing, Canada (CAD)](https://stripe.com/en-ca/tax/pricing) — accessed 2026-11-22
- [Stripe — File with Stripe outside the US](https://docs.stripe.com/tax/file-with-stripe-outside-us) — accessed 2026-11-22
- Sandbox probes: `.probe/gst2/tax-behaviour-run2.txt` (2026-11-05), `.probe/gst2/part7-unspecified-price-run1.txt` (2026-11-06); live
  read-only audit `stripe-live-2026-11-06.json`

## Professional sign-off needed?
No for the configuration. Yes, when convenient, for one thing: the registration's effective date on CRA's letter versus the day it is added
in Stripe — if any production sale falls between them, an accountant should confirm how the untaxed sale is reported.
