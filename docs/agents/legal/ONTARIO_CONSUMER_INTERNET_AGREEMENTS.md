# Selling a plan online to an individual in Ontario (Consumer Protection Act)
**Last verified:** 2026-11-08 for O. Reg. 17/05 s. 32 items 1–2 and the Business Names Act search right (primary text); the
rest 2026-11-05, partly (see Sources)
**Re-verify by:** **the Consumer Protection Act, 2023 being proclaimed in force** (passed 2023-12-06; not confirmed in force
as of 2026-11-05) — re-check on ontario.ca/laws before any coach plan's terms are published; otherwise 2027-11-05
**Depends on facts:** `LEGAL_FACTS.md` § who the customers are (coaches buy as individuals — *unconfirmed* whether always)

## Question(s) this answers
What Ontario requires when a coach (a consumer, not an organization) buys a subscription online; what that means for
the Terms, checkout and the purchase email. (Backlog L8; drafted into `drafts/TERMS_OF_SERVICE.md` §16.)

## Finding
Under the **Consumer Protection Act, 2002** (Part IV, internet agreements; O. Reg. 17/05), for an internet agreement where
the consumer's total potential payment is **over $50**:
1. **Disclose before purchase**, clearly and prominently, in a form the consumer can keep and print: supplier's name (and
   operating name), **telephone number, business address**, other contact method; a fair description of the service and
   its technical requirements; itemized price and taxes; extra charges; the total, or **for an ongoing supply the amount
   and frequency of periodic payments**; payment terms; start date; cancellation, refund and return policies; currency if
   not Canadian; any other restrictions.
2. **An express opportunity to accept or decline, and to correct errors**, immediately before the agreement is made.
3. **Deliver a copy within 15 days** (email is fine) containing those items, the consumer's name and the date.
- **Remedies:** miss 1 or 2 → the consumer may cancel until 7 days after receiving the copy; miss 3 → cancel within 30 days
  of the agreement. A consumer's statutory rights can't be waived by the Terms.
- **CPA 2023:** replaces the 2002 Act on proclamation; commentary expects stronger rules on subscriptions (renewal and
  easy online cancellation). Its regulations were under consultation in 2025; in-force status not confirmed.

## What the product does today
From a code census 2026-11-05: checkout is Stripe Checkout (subscription mode; auto-renews; card on file); **no "I agree"
step anywhere at signup or checkout**; **no purchase email carrying the terms** (Stripe's receipt only); **no reminder
before an ordinary renewal**; trial lengths stated nowhere outside checkout; a cancel button exists (owner only). The ruled
"plan ends at the renewal date" is built on dev, not on production.
**Update 2026-11-09 (step 6.3, built dark):** the accept-the-Terms step now exists at every account door, the sign-in screen
and a window over any stopped purchase (version, sentence, door and time recorded); every priced paid button carries §20 (3)'s
renewal line, with a trial sentence where the plan has trial days (conditional where checkout decides). The purchase email
(item 3, the copy) is still 6.4.

## Recommendation
- Checkout/signup: a required accept-the-Terms step recording version, person and time (reuse the payout-terms shape).
- A purchase-confirmation email carrying the item 1 list (or a durable link to the accepted version plus the list).
- A renewal reminder before a **yearly** plan renews — not required by the 2002 Act, but expected under CPA 2023 and
  Québec law, and the cheapest dispute insurance. Owner decision O2 in the Terms draft.
- Put a telephone number and business address in the Terms (owner O1).

## The seller's identity without personal details (owner question O1′, 2026-11-08)
**Primary text read 2026-11-08** (O. Reg. 17/05 s. 32, the list for s. 38(1) of the Act, from e-Laws' Word copy): item 1 —
"The name of the supplier and, if different, the name under which the supplier carries on business." Item 2 — "The telephone
number of the supplier, the address of the premises from which the supplier conducts business, information respecting other
ways, if any, in which the supplier can be contacted by the consumer, such as the fax number and e-mail address of the
supplier." For a sole proprietor, the supplier **is** the owner, so item 1 asks for the owner's name.

**What limits it:**
- It is owed only to a **consumer** (an individual buying for personal, family or household purposes), only for an internet
  agreement over $50, and only **before** the purchase and in the **copy** sent within 15 days. Clubs are not consumers. A
  public Terms page does not have to carry it.
- The remedy for a missing item is the consumer's right to **cancel** (until 7 days after receiving the copy) — a refund,
  bounded by what that buyer paid. *(These two points rest on the law-firm pointer below; the Act's s. 1 "consumer" and
  ss. 38–40 were not read this session.)*
- **The name is already public:** a business-name registration records the registrant, and "any person is entitled … to search
  and obtain copies" of the register (Business Names Act s. 1.1(4), read 2026-11-08). Whatever address was given at
  registration is public too; a change is filed as an amended registration within 15 days (s. 4(4)).
- The Business Names Act's duty to print both names on contracts and invoices (s. 2(6)) applies to corporations and "such other
  persons as are prescribed"; the regulation was not read, so whether it reaches a sole proprietor is unconfirmed.

**"Premises from which the supplier conducts business"** is a physical place of business. A mail service's address (a
mailbox store's street address with a unit number, or a "virtual office" provider) receives, scans and forwards mail; it is
not where the work is done, so it does not plainly meet the words. For a home business the literal answer is the home. A
virtual office or coworking plan the owner actually works from some days is the cleanest fit; a PO box is the weakest.

**Options, best first:**
1. **"FieldLogicHQ" on every public page; the owner's name only where the law asks** — in a disclosure line shown to a buyer
   just before paying and in the purchase email (6.4). A mail-service street address and a VoIP number everywhere. Meets item 1
   fully; nothing new becomes public (the name is on the register already). Residual: item 2's "premises" wording.
2. **The name nowhere.** "FieldLogicHQ" only, plus the mail-service address, phone and email. Exposure: a consumer buyer may
   cancel within 7 days of the copy (a refund of that plan). Small and bounded at this scale, but a deliberate gap.
3. **Incorporate.** The supplier becomes the corporation, so item 1 is its name, not the owner's. Costs, tax and the public
   record of directors and addresses to check first (backlog L14; tax side → `/accounting`).

**Recommendation was** option 1. **⚖ Owner ruled option 2, 2026-11-08** — no personal name anywhere, the consumer's
cancel-and-refund right accepted as the cost ("a small cost and an expectedly very rare occurance"). The cost is that whole
purchase (a yearly plan in full) if a coach cancels within the window, not a part-month. Revisit with L14 (incorporating
removes the gap) or if consumer sales grow.

## Sources
- [O. Reg. 17/05, Word copy from e-Laws](https://www.ontario.ca/laws/docs/050017_e.doc) — s. 32 read 2026-11-08
- [Business Names Act, R.S.O. 1990, c. B.17, Word copy from e-Laws](https://www.ontario.ca/laws/docs/90b17_e.doc) — ss. 1.1(4), 2(2), 2(6), 4(4) read 2026-11-08 (the copy's text came through garbled; re-read before relying on exact words)
- O. Reg. 17/05 and CPA 2002 on [ontario.ca/laws](https://www.ontario.ca/laws/regulation/050017) — **fetch failed**
  (page renders by script; CanLII refused). The list above is from a law-firm pointer —
  [Mann Lawyers, "Internet Agreements with Ontario Consumers"](https://www.mannlawyers.com/resources/internet-agreements-with-ontario-consumers-consumer-protection-act-considerations-for-businesses/)
  — accessed 2026-11-05. **s. 32's items 1–2 were read in the primary text 2026-11-08 (above); the rest of the list and the
  Act's ss. 38–40 still rest on this pointer — read them before publishing the Terms.**
- CPA 2023 status: [Legislative Assembly, Bill 142](https://www.ola.org/en/legislative-business/bills/parliament-43/session-1/bill-142);
  [Fasken, 2025-01](https://www.fasken.com/en/knowledge/2025/01/ontario-government-actively-consulting-on-regulations-with-major-ramifications) — accessed 2026-11-05

## Lawyer's eye needed?
Yes, briefly — whether the planned confirmation email satisfies the copy rule, and the auto-renewal / no-refund wording
once CPA 2023 is in force.
