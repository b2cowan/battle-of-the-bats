# Is FieldLogicHQ a payment service provider (RPAA) or a money services business (FINTRAC)?
**Last verified:** 2026-11-17
**Re-verify by:** 2027-11-17, or a trigger: any change to how online payments move money (destination charges, transfers,
`on_behalf_of`, a reserve, a payout schedule we set, our own card form, saved cards, a wallet or club balance we keep);
**a change to the account's `fees_collector` or `losses_collector`** (both `stripe` since Stripe-owned pricing Stage 2,
2026-11-18: Stripe charges the club, and Stripe, not we, stands behind a balance the club can't cover);
online payments offered to anyone without a FieldLogicHQ plan; the PCMLTFA 2026 amendments' regulations; the first
Québec club; the first US club
**Depends on facts:** `LEGAL_FACTS.md` § Where data lives (Payments, and the 2026-11-17 census line); the business is a
sole proprietorship in Ontario (`ACCOUNTING_FACTS.md`)

## Question(s) this answers
Backlog L4. Does "Families pay online", built as Stripe Connect direct charges with our application fee, make FieldLogicHQ
a payment service provider that must register with the Bank of Canada under the Retail Payment Activities Act, or a money
services business under FINTRAC's rules? It is the one payments question with statutory penalties.

## Finding
**RPAA (S.C. 2021, c. 23, s. 177).**
- A PSP is one that "performs payment functions as a service or business activity that is not incidental to another
  service or business activity" (s. 2). The five functions are: an account for end users; holding funds; initiating an
  electronic funds transfer at an end user's request; authorizing or transmitting an instruction; and clearing or
  settlement. There is no general exclusion for platforms (s. 6 is narrow).
- Registration has been required **before** performing any retail payment activity since 2024-11-16 (s. 23), and
  supervision since 2025-09-08. The transition period has ended. The application fee is $2,500.
- Operating unregistered is a "very serious" violation. The maximum penalty is $10,000,000 (s. 101(1)(k); SOR/2023-229
  Schedule). Penalties are meant "to promote compliance … not to punish" (s. 76(4)). A law-firm bulletin (secondary)
  reports $0 penalties in every published unregistered-operation decision so far.
- **The Bank's scenarios that fit our facts:**
  - *Marketplace scenario 1 (2025-12):* sellers open their own accounts with the PSP, the PSP holds the funds and pays
    sellers "minus a commission fee owed by the seller to Marketplace A". The marketplace "is not a PSP and does not need to
    register". That is our application fee: Stripe takes it out of the club's payment and pays it to us.
  - *E-commerce tools scenario 1 (2024-08):* a web tool whose checkout redirects to a page hosted by another provider
    "does not perform any payment functions". That is our pay page sending the payer to Stripe Checkout.
- **The scenarios that would make us one:** holding the funds or controlling payouts (marketplace scenarios 3 and 4); a
  checkout that "captures and encrypts" the payer's card details (tools scenario 2); or a payment service sold as its own
  line, which the business does not need in order to work (tools scenario 3).

**FINTRAC (PCMLTFA s. 5(h)(ii)).** Payment services for goods and services are covered when a person (1) receives payment
instructions and acts as an intermediary between payer and payee, (2) with the payer consenting to pay "through them",
and (3) the payee has an agreement with them. We plausibly meet (3) but likely not (1) or (2): the payer pays through
Stripe's page, and Stripe receives the instructions. A secondary source reports PCMLTFA amendments with Royal Assent on
2026-03-26, regulations to follow. Not confirmed.

**Québec (Money-Services Businesses Act, CQLR c. E-12.000001).** Not read: both legisquebec and the AMF refused the
fetch. It is not relevant while we serve no Québec club (Terms §17).

**US.** Pointer only. FinCEN's money-transmitter rule has a payment-processor exemption, and state licensing varies. US
counsel is needed before US clubs take payments.

## What the product does today
Census 2026-11-17, re-read in `lib/stripe-connect.ts:38-53` and `:188-205`:
- direct charges on the club's own Stripe account through Stripe-hosted Checkout;
- no transfers, no destination charges, no `on_behalf_of`;
- the payment never enters our balance; only our fee and Stripe's charges to us do;
  **Update 2026-11-18 (Stripe-owned pricing Stages 2 and 4, `142ef12d6`, `6dc9c6119`):** accounts are now created with
  `fees_collector: 'stripe'` and `losses_collector: 'stripe'`. Stripe charges the club for processing and its extras from
  the club's own balance, and nothing of Stripe's is charged to us or billed on by us, so **only our fee** enters our
  balance, and the fee is our margin only. This narrows the "per-payment fee" soft spot below (no pass-through of
  Stripe's cost) and changes no conclusion. Payments terms v0.2 §3–§5 describe it (`drafts/PAYMENTS_TERMS.md`).
- no reserve, and the payout schedule is Stripe's default;
- no card form of our own and no saved cards;
- refunds are a Stripe API call on the club's account, started by a club person's click;
- online payments are sold only as part of a paid plan (Tournament Plus and up), never on their own.

**One soft spot:** we create the Checkout session and the refund request through Stripe's API. That is close to
"initiation at an end user's request". The tools scenarios turn on who captures the payer's details and builds the first
instruction, and here that is Stripe's page. The other soft spot is the per-payment fee, which the Bank reads as a sign of
a distinct business line in its merchant and tools scenarios. Marketplace scenario 1 treats a commission netted by the PSP
as consistent with not being a PSP.

## Recommendation
**Likely not a PSP, and likely not an MSB, as built. Moderately confident.** It rests on the payment functions being
incidental to the software, with Stripe as the PSP.
1. **Don't register.** Keep this file as the dated self-assessment. The Bank says an entity that is unsure may apply and
   describe its operations. That is open to the owner for certainty; the cost is $2,500 plus the effort of
   applying.
2. **Hold the shape as a build rule.** Any of the re-verify triggers above reopens this file before it ships. Destination
   charges, a reserve, or a payout schedule we set would most likely make us a PSP.
3. **Words.** Describe our fee as a charge for FieldLogicHQ's online-payment features, and Stripe as the one that processes
   payments. The payments terms draft §2 and §4 are written that way. The product's "Processing fee" label is the payer's
   name for the club's cost; it does not describe us.

## Sources
- [Retail Payment Activities Act](https://laws-lois.justice.gc.ca/eng/acts/R-7.36/page-1.html) — accessed 2026-11-17 (via a helper's summarized fetch)
- [Retail Payment Activities Regulations, Schedule](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2023-229/page-6.html) — accessed 2026-11-17 (helper)
- [Bank of Canada — Case scenarios about marketplaces (2025-12)](https://www.bankofcanada.ca/2025/12/case-scenarios-about-marketplaces/) — accessed 2026-11-17, read directly
- [Bank of Canada — Case scenarios about e-commerce web-building tools and payment gateways (2024-08)](https://www.bankofcanada.ca/2024/08/case-scenarios-about-e-commerce-web-building-tools-and-payment-gateways/) — accessed 2026-11-17, read directly
- [Bank of Canada — Supervisory policy for online marketplaces (2025-12-19)](https://www.bankofcanada.ca/2025/12/supervisory-policy-for-online-marketplaces/) — accessed 2026-11-17 (helper)
- [Bank of Canada — Criteria for registering payment service providers](https://www.bankofcanada.ca/regulatory-oversight/retail-payments/criteria-for-registering-payment-service-providers/) — accessed 2026-11-17 (helper)
- [Bank of Canada — Case scenarios about merchants and the incidental payment function (2023-12)](https://www.bankofcanada.ca/2023/12/case-scenarios-about-merchants-and-the-incidental-payment-function/) — accessed 2026-11-17 (helper)
- [Bank of Canada — Retail payments supervision FAQ (2026-01)](https://www.bankofcanada.ca/2026/01/frequently-asked-questions-about-retail-payments-supervision/) — accessed 2026-11-17 (helper)
- [Bank of Canada — Administrative monetary penalties](https://www.bankofcanada.ca/2025/03/administrative-monetary-penalties/) — accessed 2026-11-17 (helper)
- [PCMLTFA s. 5](https://laws-lois.justice.gc.ca/eng/acts/P-24.501/section-5.html) — accessed 2026-11-17 (helper)
- [FINTRAC — Money services businesses](http://fintrac-canafe.canada.ca/msb-esm/msb-eng) — accessed 2026-11-17 (helper; page modified 2025-10-01)
- Pages marked "helper" were read through a summarizing fetch. Re-read the exact wording before quoting any of them in a
  customer document.

## Lawyer's eye needed?
Yes, when the owner chooses:
- whether creating the Checkout session and the refund through Stripe's API is "initiation" or "facilitation" (RPAA s. 2(c)
  and (d));
- whether the per-payment fee makes this a distinct payment service;
- apply to the Bank, or rely on the incidental reading;
- FINTRAC's "receive payment instructions" test, and the 2026 amendments;
- Québec's Act and US state licensing before either market.
