# Tax treatment of FieldLogicHQ's online-payment (platform) fee — all four cross-border scenarios
**Last verified:** 2026-10-31
**Re-verify by:** 2027-10-31, or when online payments are switched on in production, when counsel answers the facilitated-
payments brief, or when the first US club connects a payout account
**Depends on facts:** registered for GST/HST (confirmed 2026-10-31 — so the 2026-10-26 "below the threshold" reason for no tax on the fee no longer holds); the payment model as built — direct charges
on the **club's own** Stripe account (club = merchant of record), FieldLogicHQ takes the whole fee as an application fee,
and the club chooses whether the fee is **added on top for the payer ("family", the default) or absorbed by the club**;
online payments are switched OFF in production pending counsel (2026-10-31)

## Question(s) this answers
- Is the fee taxable or an exempt financial service?
- Whose location decides the tax on the fee — the club's or the paying family/team's?
- What changes in scenarios 1–4 (Canadian/US clubs × Canadian/US payers)?
- Do the 2021 digital-platform GST/HST rules make FieldLogicHQ collect tax on the clubs' registrations?

## Finding
- **Taxable vs exempt is unresolved.** Para (r.6) of "financial service" (Budget **2023**, after *CIBC*) only takes card-
  network services (Visa-type) out of financial services; it says nothing directly about platforms. The competing hooks
  are para (l) "arranging for" a financial service (exempt) vs para (r.4) preparatory/ancillary services (taxable). No
  CRA document addresses a SaaS platform's percentage fee. A fee that bundles software/platform services is more likely
  taxable. **Already an open counsel question** (Business Decisions Log 2026-10-26, D1; facilitated-payments counsel brief).
- **Whose location counts:** place of supply follows the **recipient = the person liable to pay** (Memo 3-3-6 para 29).
  If the fee is FieldLogicHQ's charge **to the club**, the club's address decides it every time, and the payer's country
  is irrelevant to FieldLogicHQ. If the "family pays" line is characterized as FieldLogicHQ charging the **family**, the
  family's location decides it, and a US family paying while in Canada would not get the s.7 zero rate.
  (Inference from the general rule, not a CRA statement about platforms.)
- **Digital-platform (DPO) deemed-supplier rules (ETA s.211.1+)** reach supplies by **specified non-resident suppliers**
  to Canadian consumers. Canadian clubs are resident → out. A US club's US-tournament registration sold to a Canadian
  team is a service consumed **outside Canada** → listed as excluded. A "solely processes payments" interface is
  excluded, but FieldLogicHQ sets terms and runs registration, so don't rely on that exclusion. Event registrations aren't
  addressed directly anywhere.

| Scenario | Who FieldLogicHQ's fee is supplied to (club-pays characterization) | GST/HST on the fee *if taxable* | The registration itself |
|---|---|---|---|
| 1. Canadian club, Canadian payers | Canadian club | Club's province rate (13/14/15% HST or 5% GST) | The club's own tax question (many youth programs are exempt or the club is a small supplier) — not FieldLogicHQ's |
| 2. US club, US payers | US club (non-resident) | 0% (zero-rated, s.7) — keep the US-customer evidence | US state rules; see US_TAX_EXPOSURE.md (marketplace-facilitator risk) |
| 3. US team → Canadian tournament | Canadian club | Club's province rate — the team being American changes nothing | Club's question; Stripe treats event admissions as taxed where the event is |
| 4. Canadian team → US tournament | US club | 0% (zero-rated) | Outside Canada; not FieldLogicHQ's (DPO excluded) |

## Recommendation
1. **Make the fee legally FieldLogicHQ's charge to the club in every case** — in the club terms of service, and on the
   statement the club receives — with "family pays" meaning *the club passes its cost on to its payers as the club's own
   charge*. That one wording choice makes the tax on the fee depend only on the club's address (scenarios 3 and 4
   collapse into 1 and 2) and keeps FieldLogicHQ out of identifying families' locations. Put this to counsel alongside D1.
2. Once registered and if the fee is taxable: Stripe Tax does **not** calculate tax on application fees and they don't
   count toward its thresholds. Plan on a **monthly fee statement/invoice per club** (tax-inclusive fee with the GST/HST
   portion shown, or a gross-up), carrying the registration number. Whether tax sits inside the published rates is a
   pricing decision (→ /strategy): at today's rates it turns an $800 card payment's ~$3.14 margin to about −$0.25.
3. The fee alone reaches the $30,000 small-supplier threshold at roughly **$850,000 of card volume** (Decisions Log
   2026-10-26) — sooner if subscriptions are added in, which they must be.

## Sources
- [Excise Tax Act s.123(1) "financial service"](https://laws-lois.justice.gc.ca/eng/acts/e-15/section-123.html) — current to 2026-09-30, accessed 2026-10-31
- [Budget 2023 — payment card clearing services](https://www.budget.canada.ca/2023/report-rapport/nwmm-amvm-02-en.html) — accessed 2026-10-31
- [CRA Excise & GST/HST News No. 114](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/news114/news114-excise-gst-hst-news-no-114.html) — accessed 2026-10-31
- [CRA GI-200 — credit card surcharges](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/gi-200/application-gst-hst-credit-card-surcharges.html) — accessed 2026-10-31
- [GST/HST Memo 3-3-6 (recipient = person liable to pay, para 29)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/3-3-6/plc-spply-prvnc-gnrl-rls-fr-srvcs.html) — accessed 2026-10-31
- [Excise Tax Act s.211.1 definitions](https://laws-lois.justice.gc.ca/eng/acts/e-15/page-59.html) · [CRA digital economy definitions](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/digital-economy-gsthst/digital-economy-definitions.html) — accessed 2026-10-31
- [Stripe — Collect tax in Canada (event admissions taxed where the venue is)](https://docs.stripe.com/tax/supported-countries/canada/collect-tax.md?tax-jurisdiction-canada=federal) — accessed 2026-10-31
- [Stripe Tax — obligations monitoring (application fees don't count)](https://docs.stripe.com/tax/monitoring) — accessed 2026-10-31

## Professional sign-off needed?
**Yes** — taxable vs exempt (D1), and the club-pays characterization of the fee, before online payments are switched on
in production.
