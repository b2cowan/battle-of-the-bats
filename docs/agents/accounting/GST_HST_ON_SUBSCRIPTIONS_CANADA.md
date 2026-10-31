# GST/HST (and provincial tax) on FieldLogicHQ's subscriptions to Canadian customers
**Last verified:** 2026-10-31
**Re-verify by:** 2027-10-31, or if any province changes its rate, if FieldLogicHQ's GST/HST registration status changes, or if Stripe Tax registrations are added
**Depends on facts:** **registered for GST/HST** (owner confirmed 2026-10-31; nothing sold yet); Ontario home base;
subscriptions sold to clubs (organizations) and to individual coaches (coach Premium)

## Question(s) this answers
- What tax does FieldLogicHQ charge a Canadian club on a subscription, and which province's rate?
- When must FieldLogicHQ register (small-supplier test), and what counts toward it?
- Which provincial sales taxes reach an Ontario SaaS seller?
- What must an invoice show?

## Finding
**Small-supplier threshold — $30,000.** Counts total taxable supplies **including zero-rated supplies (so US/export
sales count)** and associates' taxable supplies, worldwide; excludes exempt supplies, financial services, capital
property and goodwill. Exceeded in a single calendar quarter → registrant on the supply that crosses it; exceeded over
four consecutive calendar quarters → you stop being a small supplier at the end of the month after that quarter, and
must register within 29 days of the first taxable supply after that (wording from memory of CRA "When to register" —
re-read the page before relying on the dates). **The whole online-payment fee counts, not FieldLogicHQ's margin after Stripe.**
Voluntary registration commits you to charging on every taxable supply, filing, and staying registered ≥1 year.

**Rates (CRA table, page dated 2025-04-01):** ON 13% HST · NB, NL, PE 15% HST · **NS 14% HST (cut from 15% on
2025-04-01)** · AB, NT, NU, YT 5% GST · BC, MB, SK, QC 5% GST (their PST/RST/QST is separate).

**Place of supply (GST/HST Memoranda 3-3-5 IPP and 3-3-6 services, April 2026 — they replaced TIB B-103):** a SaaS
subscription is either IPP or a service; both use the same test. If the supplier obtains **one Canadian business
address** of the recipient in the ordinary course, the supply is made in that province; if several, the one most
closely connected (generally the contracting address). Billing/contracting addresses qualify; **email and IP addresses
do not; a PO Box is not a business address.** The supplier need not collect an address it doesn't already collect — but
if it has none, the IPP fallback is the **highest-rate province** where the property can be used (15%).
→ Ontario club 13% · BC club 5% · Nova Scotia club 14% · NB/NL/PE club 15% · Québec club 5% GST (+QST question below).

**Provincial sales taxes on SaaS from an Ontario seller (separate registrations, separate returns):**
- **BC PST 7%** — out-of-province (incl. other-province Canadian) sellers of software must register once BC revenue
  > $10,000 in the prior 12 months (or expected next 12), *before* supplying (PST 001, rev. Oct 2026). Software SaaS
  coverage from Bill 3 (2024) seen only via summary — confirm.
- **Saskatchewan PST 6%** — resident and non-resident SaaS providers must collect (PST-7); non-resident vendors making
  retail sales are expected to be licensed; no dollar threshold found — confirm small-trader rules (PST-5).
- **Manitoba RST 7%** — cloud computing incl. SaaS taxable **from 2026-01-01** (RST 033, rev. Jan 2026); providers in
  and outside MB must collect; threshold unclear ($10,000 vs $30,000 in different bulletins) — confirm with MB Finance.
- **Québec QST 9.975%** — Canadian suppliers outside Québec register under the **specified (simplified) QST system**
  once taxable supplies to **specified Québec consumers** exceed **$30,000 over 12 months**. A specified Québec
  consumer is a person **not registered for QST** — so a small non-profit club that isn't QST-registered likely counts
  (all Québec points: Revenu Québec pages blocked fetch; confirm).

**Invoices (input-tax-credit documentation, tiers since 2021-04-20):** under $100: supplier/trading name, date, total ·
$100–$499.99: add GST/HST charged (or that it's included), **GST/HST registration number** · $500+: add buyer's name,
description, payment terms. (Memo 8.4 still shows the old $30/$150 tiers — outdated.)

## Recommendation
1. Registered (2026-10-31) with no sales yet: every taxable supply from the first one carries tax; the small-supplier
   threshold no longer applies. Implementation plan: `docs/projects/active/GST_HST_COLLECTION_PLAN.md`.
2. Once registered, charge by the **club's business address province**, collected as a required billing address at
   checkout and stored on the organization — never infer from IP or email.
3. Price **tax-exclusive** ("plus applicable taxes") so one CAD price works in every province.
4. Watch BC ($10,000) and Québec ($30,000) — the first provincial registrations an Ontario SaaS seller usually hits;
   SK and MB may require registration from the first sale. Stripe Tax monitors provincial thresholds for a Canada-based
   seller; it does not register you.

## Sources
- [CRA — GST/HST rates by province](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html) — accessed 2026-10-31
- [CRA — When to register for and start charging GST/HST](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html) — accessed 2026-10-31
- [CRA — Register for a GST/HST account (total annual revenue definition)](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/account-register.html) — accessed 2026-10-31
- [GST/HST Memo 3-3-6 — place of supply, services](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/3-3-6/plc-spply-prvnc-gnrl-rls-fr-srvcs.html) — accessed 2026-10-31
- [GST/HST Memo 3-3-5 — place of supply, IPP](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/3-3-5/plc-sppl-prvnc-gnrl-rls-ntngbl-prsnl-prprt.html) — accessed 2026-10-31
- [BC PST 001 — registering to collect PST](https://www2.gov.bc.ca/assets/gov/taxes/sales-taxes/publications/pst-001-registering-to-collect-pst.pdf) — accessed 2026-10-31
- [Saskatchewan PST-7 — computer hardware, software & services](https://sets.saskatchewan.ca/rptp/wcm/connect/a1169319-a762-4328-b84c-88d844e8f340/PST.007+Computer+Hardware,+Software+&+Computer+Services.pdf) — accessed 2026-10-31
- [Manitoba RST 033 — cloud computing](https://www.gov.mb.ca/finance/taxation/pubs/bulletins/033.pdf) — accessed 2026-10-31
- [Revenu Québec — specified system for suppliers outside Québec](https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/special-cases-gsthst-and-qst/suppliers-outside-quebec/qst-registration-for-suppliers-outside-quebec/registration-under-the-specified-system-suppliers-outside-quebec-who-are-registered-under-the-general-gsthst-system/) — not fetchable 2026-10-31 (403); confirm
- [CRA — input tax credit documentation](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html) — accessed 2026-10-31

## Professional sign-off needed?
**Yes** — (1) confirming the registration status and, if registered, the exposure on past subscriptions and how to
correct it; (2) BC/SK/MB/QC registration timing before the first sale into each of those provinces.
