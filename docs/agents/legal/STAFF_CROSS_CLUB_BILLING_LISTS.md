# Staff lists of customers' billing across clubs, and sales records for our accountant
**Last verified:** 2026-11-07
**Re-verify by:** 2027-11-07; or Bill C-36 (federal privacy reform) passes; or the first Québec buyer; or a list starts showing a person's name, email or card details
**Depends on facts:** LEGAL_FACTS.md two privacy roles (for our own customers' billing we are the organization in our own right, not a service provider); coaches often buy as individuals; privacy policy draft v0.1 §5 "every record they open is logged", §6 provider table, §9 retention.

## Question(s) this answers
- Plans & pricing Stage 2 Part 4 drawings: may Super admin, Billing and Support see one list of every club's next renewal and every unpaid bill (club or portal name, invoice number, amounts, past-due-since)? Anything in the privacy policy draft it contradicts?
- Is a Coaches Portal's team name, shown with what it owes, personal information when the buyer is one coach?
- Sales records in the accountant package (buyer named, an individual coach as "Coach"): sharing? retention of exported files?

## Finding
- **Company information is generally not personal information; a sole buyer's can be.** OPC Interpretation Bulletin (personal information): information is about an identifiable individual where "there is a serious possibility that an individual could be identified through the use of that information", "alone or in combination with other information"; company information can be personal where it is "inextricably linked" to its owner-operator (case by case); and "a simple reference to an outstanding debt, even without disclosing specific details about the debt, is personal information." A Coaches Portal bought by one coach, shown as unpaid, is therefore that coach's personal information: staff can open the portal and see who owns it, so identification is a serious possibility. A club (an organization) that owes a bill is not.
- **Staff use is our own purpose, need-to-know.** The billing facts were collected to bill the customer; following up an unpaid bill is that same purpose. The safeguard principle (4.7) expects access limited to those who need it. Billing and Support already see each club's bills on the Money tab and the cross-club Online payments list; the new lists show no more than that, one view instead of many. No consent or notice question arises.
- **The policy's "every record they open is logged" stays true, read precisely.** The product logs each opened club or person record (`lib/platform-record-opens.ts`, 90 days); it has never logged lists (Clubs & portals, Online payments). A list row's door opens the club record, which is logged. The sentence is accurate only if "record" means a club or person record. Tighten the wording rather than log list views.
- **Accountant.** Giving our accountant our own books is an ordinary use; the policy's §6 table names only "companies that run parts of FieldLogicHQ", so the accountant is not listed. A sales file naming clubs (organizations) carries little personal information; an individual shown as "Coach" with no address is close to de-identified (an invoice number can be traced back only through our Stripe account).
- **Exported files leave our retention controls.** A downloaded spreadsheet of who owes money (with individual coaches in it) sits outside the product's 90-day and six-year rules; PIPEDA 4.5.3 expects destruction when no longer needed.

## What the product does today
- Record opens logged: `lib/platform-record-opens.ts:1-50`, written from `app/platform-admin/orgs/[id]/page.tsx` and `customer-users/[id]/page.tsx`; lists not logged (no call from the orgs list or Online payments).
- Export registry precedent: `lib/export/catalog.ts:353-367` (GST/HST return line detail: "an individual coach appears only as 'Coach'", `included_justified`).
- Nothing in Part 4 is built (drawing only).

## Recommendation
1. **Registry:** the two Renewals exports are `included_justified`, not "no sensitive fields": "Super admin, Billing and Support (need-to-know, billing follow-up). Includes Coaches Portals bought by one coach: the team's name with its plan and what it owes is that coach's personal information. No person name, email, address or card details. Audited before the file is sent."
2. **Lists:** keep them free of person names, emails, billing addresses, card details and decline reasons (as drawn). Do not add the owner's name to a Coaches Portal row.
3. **sales.csv for the accountant:** buyer = club name, or "Coach" for an individual; **no billing address or postal code**; province taxed is fine.
4. **Privacy policy draft (owner items, not a gate):** §5 read "every club or person record they open is logged"; §6 add a row "Our accountant · prepares our books and tax returns · our sales records (a club's name; an individual shown as 'Coach') and expenses · Canada".
5. **Staff help (via `/docs` when built):** one line on the export: it holds customers' billing, keep it off shared drives and delete it when the follow-up is done.

## Sources
- [OPC — Interpretation Bulletin: Personal Information](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/pipeda-interpretation-bulletins/interpretations_02/) — accessed 2026-11-07
- PIPEDA Schedule 1 principles 4.5.3 and 4.7 — via PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md (verified 2026-11-05); statute text not re-fetched this session

## Lawyer's eye needed?
No for the lists as drawn. Optional, with the privacy policy's first lawyer read: whether the accountant belongs in §6 or in a general "professional advisers" sentence.
