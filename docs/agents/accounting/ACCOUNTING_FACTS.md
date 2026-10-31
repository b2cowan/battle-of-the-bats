# FieldLogicHQ — Owner's Business Accounting Facts
**Last updated:** 2026-10-31

These are the facts the Accounting Agent (`/accounting`) reasons from. They are about **FieldLogicHQ
the business**, not the product's customer-facing bookkeeping features. Update this file the moment
any of them change — a stale fact here can make every topic file built on it wrong, and the agent
should flag which topic files need re-checking when a fact changes.

## Structure
- **Legal form:** Sole proprietorship (unincorporated). Business income and expenses are reported on
  the owner's personal T1 return via Form T2125 (Statement of Business or Professional Activities).
- **Owner/operator:** b2cowan — single person, no partners.
- **Trading name:** FieldLogicHQ. *(Unconfirmed: whether a business name is registered with
  ServiceOntario under the Business Names Act, and its renewal date — fill in when known.)*

## Jurisdiction
- **Home province:** Ontario, Canada.
- **Governing tax authorities:** CRA (federal — income tax, GST/HST) and Ontario (provincial income
  tax, filed jointly with the federal T1 — no separate Ontario sales tax since Ontario uses HST, not
  GST+PST).

## Registrations
- **GST/HST:** **Registered** (owner confirmed 2026-10-31; number received the week of 2026-10-24 — a
  voluntary registration, made while still a small supplier). **No subscription or other taxable sale has
  ever been made** (owner, 2026-10-31), so there is no past exposure to correct. Once registered, tax
  applies to every taxable supply regardless of the $30,000 threshold, and registration must be kept at
  least one year. *(Unconfirmed: the exact effective date on CRA's confirmation letter — it can be up to
  30 days before the request — and the filing frequency. Neither the BN nor dates of returns are stored
  here; check CRA My Business Account.)* ⚠ The Business Decisions Log entry of 2026-10-26 ("pre-revenue,
  below the small-supplier threshold" → no GST/HST on the payment fee) rested on not being registered —
  that reason no longer holds; flagged to /strategy.
- **Payroll (RP) account:** None — no employees.
- **Provincial sales tax outside Ontario:** Not applicable today; would become relevant only if the
  business registers or operates in another province.

## Staffing
- **Employees:** None. Owner operates solo. No T4 filings, no CPP/EI employer remittances. The owner
  still pays CPP as a self-employed individual via Schedule 8 on the T1.
- **Contractors:** None currently on record. *(Update if that changes — contractor payments carry
  their own reporting rules, e.g. T4A, to research when it actually happens.)*

## Fiscal year
- **Year end:** December 31 (calendar year) — standard for a sole proprietorship reporting via T2125.

## Cross-border footprint
- **Current US/foreign revenue:** None yet — this is forward-looking, not an active situation.
- **US entity:** None.
- **US tax or sales-tax registrations:** None.
- **Why this matters:** The moment real non-Canadian customer revenue starts, several questions open
  at once — GST/HST treatment of the export (likely zero-rated if the customer has no Canadian
  presence, but confirm), US state sales/use-tax economic nexus thresholds, Canada–US tax treaty /
  permanent-establishment exposure, and whether a payment processor will request a W-8BEN. **Tell the
  Accounting Agent the moment a US (or other foreign) customer actually signs** — don't let it keep
  answering from the Canadian-only facts below that point.

## Product scope boundary
This file is about FieldLogicHQ the business, not the product. The platform's own customer-facing
bookkeeping features (club/coach money tracking) are a separate body of work — see
`memory/project_bookkeeping_accountant_fixes.md` and related memory files — and are out of scope for
this agent unless the owner explicitly asks it to weigh in on both.
