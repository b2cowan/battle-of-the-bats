# Zero-rating sales to US (non-resident) customers, and the evidence CRA expects
**Last verified:** 2026-10-31
**Re-verify by:** 2027-10-31, or when the first US club signs (then confirm the evidence process is actually running)
**Depends on facts:** registered for GST/HST (confirmed 2026-10-31); customers are organizations; FieldLogicHQ
supplies software access + a payment-facilitation fee, not advisory/consulting services and nothing on Canadian property

## Question(s) this answers
- Does a US club pay GST/HST on its subscription or on FieldLogicHQ's payment fee?
- How do we tell a Canadian customer from an American one, to CRA's satisfaction?

## Finding
- **Services to a non-resident are zero-rated** (ETA Sch. VI Pt V s.7) unless an exclusion applies — the relevant one
  is a service to an **individual who is in Canada** when it's performed; consulting/advisory and services on Canadian
  real or tangible property are also excluded. s.7 has no "not registered" condition.
- **IPP to a non-resident is zero-rated** (s.10) only if the recipient is **not registered under the regular GST/HST
  regime**, is not an individual in Canada, and the property is not usable only in Canada.
- SaaS isn't named in CRA guidance; TIB B-090 (2002) treats unrestricted online access as IPP. Meet **both** tests
  (non-resident AND not GST/HST-registered) and the characterization doesn't matter.
- **Residence of a club/association:** resident where the members with **management and control** reside
  (Memo 4.5.1 para 8(2)); a corporation by incorporation or central management and control. CRA looks at the
  **contracting party**.
- **Evidence (Memo 4-5-3 paras 102–104):** the supplier "must verify and maintain satisfactory evidence". An online
  **self-declaration of non-registration** is generally accepted; for residence, a **self-declaration plus a full
  address, backed by a second independent indicator** (billing address, card-issuing country, geolocation). Memo 4.5.1
  recommends a dated certificate effective on the supply date (Appendices A/B). If the evidence doesn't hold up, the
  supplier owes the tax.
- Zero-rated sales are still **taxable supplies**: they count toward the $30,000 small-supplier threshold and are
  reported on the GST/HST return (at 0%).

## Recommendation
Treat a customer as American only when **all** of these line up, and record them with a date:
1. A **US business address** captured as the billing address at checkout (not a PO Box);
2. A tick-box self-declaration: *"Our organization is managed and controlled outside Canada and is not registered for
   Canadian GST/HST"*;
3. One independent corroborator — the card's issuing country, or the country Stripe verified when the club connected
   its payout account.
Any mismatch (US address + Canadian card, or a GST number supplied) → charge Canadian tax by the address rules until it's
resolved. A US address alone, or an IP address, is not enough.

## Sources
- [GST/HST Memo 4-5-3 — Exports: services and IPP (Dec 2023)](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/4-5-3/exports-services-intangible-personal-property.html) — accessed 2026-10-31
- [GST/HST Memo 4.5.1 — Exports: determining residence status](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/4-5-1/exports-determining-residence-status.html) — accessed 2026-10-31
- [TIB B-090 — GST/HST and electronic commerce](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/b-090/gst-hst-electronic-commerce-2.html) — accessed 2026-10-31 (dated 2002)

## Professional sign-off needed?
Yes, once — have the accountant approve the three-part evidence rule and the declaration wording before the first US
club is billed at 0%.
