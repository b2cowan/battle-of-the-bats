# Selling a plan online to an individual in Ontario (Consumer Protection Act)
**Last verified:** 2026-11-05 (partly — see Sources: the primary text could not be fetched this session)
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

## Recommendation
- Checkout/signup: a required accept-the-Terms step recording version, person and time (reuse the payout-terms shape).
- A purchase-confirmation email carrying the item 1 list (or a durable link to the accepted version plus the list).
- A renewal reminder before a **yearly** plan renews — not required by the 2002 Act, but expected under CPA 2023 and
  Québec law, and the cheapest dispute insurance. Owner decision O2 in the Terms draft.
- Put a telephone number and business address in the Terms (owner O1).

## Sources
- O. Reg. 17/05 and CPA 2002 on [ontario.ca/laws](https://www.ontario.ca/laws/regulation/050017) — **fetch failed**
  (page renders by script; CanLII refused). The list above is from a law-firm pointer —
  [Mann Lawyers, "Internet Agreements with Ontario Consumers"](https://www.mannlawyers.com/resources/internet-agreements-with-ontario-consumers-consumer-protection-act-considerations-for-businesses/)
  — accessed 2026-11-05. **Read the primary text before publishing the Terms.**
- CPA 2023 status: [Legislative Assembly, Bill 142](https://www.ola.org/en/legislative-business/bills/parliament-43/session-1/bill-142);
  [Fasken, 2025-01](https://www.fasken.com/en/knowledge/2025/01/ontario-government-actively-consulting-on-regulations-with-major-ramifications) — accessed 2026-11-05

## Lawyer's eye needed?
Yes, briefly — whether the planned confirmation email satisfies the copy rule, and the auto-renewal / no-refund wording
once CPA 2023 is in force.
