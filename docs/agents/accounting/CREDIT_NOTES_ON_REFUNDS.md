# Credit notes for refunds of FieldLogicHQ's own invoices: contents, part refunds, no-invoice charges
**Last verified:** 2026-11-06
**Re-verify by:** 2027-11-06, or if Stripe changes its credit-note template, the live account's public business details change, or a refund is ever made more than 4 years after the invoice's reporting period
**Updated:** 2026-11-07 (Stage 3 closeout section: refunds with no or a short note, the eighth check, USD notes, the fee cascade, deletion; earlier 2026-11-06: Part 7: Q1 "step by the gap" built and proven; Q2 PDF link gated; the registration number redacted from this file)
**Depends on facts:** registered for GST/HST (owner 2026-10-31); refunds made through platform admin's console as Stripe credit notes (GST/HST Stage 2 Part 6b, built 2026-11-05/06)

## Question(s) this answers
- What must a credit note show (ETA s.232(3), SOR/91-44 s.3, Memo 12.2), and does Stripe's credit note show it?
- Is a part refund rounded to "the nearest card figure not above the typed one" sound? Does it matter which invoice line takes it?
- Does a bare refund of a charge that paid no invoice need a credit note?
- Whose name goes on the note (cardholder, typed business name, a renamed club)?

## Finding
**Contents (SOR/91-44 s.3, current to 2026-10-19; Memo 12.2 ¶16, April 2008).** A credit note must show: (a) that it is a credit
note; (b) the supplier's name (or trade name) **and its GST/HST registration number**; (c) the recipient's name, the name it does
business under, **or its duly authorized agent's or representative's name**; (d) the date it is issued; (f)(ii) the amount of tax
adjusted, refunded or credited (or, for a tax-included total, a statement that it includes tax + the rate + the reduction). **No
address is required, and no invoice number** — Memo ¶20 says the note *should* show the date of the invoice (a recommendation).
Issue it within a reasonable time (¶15). A partial refund of what was paid is a **reduction of consideration, s.232(2)** (¶5–6):
refunding the tax is the supplier's choice (¶12), but the supplier may deduct it in net tax **only with a credit note issued**
(¶22–23); limit 4 years after the end of the reporting period of the reduction (¶11).

**Stripe's note, read in test mode 2026-11-06** (`.probe/gst2/part6b-part4-note-pdf-run1.txt`): "Credit Note", its number, "Invoice
<number>", "Date of issue", our name + "CA GST/HST <our number>" (the account tax ID set on the sandbox), the club's name and address under "Bill to", each line
before tax, "HST - Canada (13% on CA$88.49) CA$11.50", the adjustment total and the refund. **All of s.3 is met.** It names the
original invoice by number (not date; Memo ¶20 is met in substance — the number identifies the supply and its date). A note
made after the customer was renamed prints the **invoice's** name and address, not the customer's new ones
(`part6b-part4-note-name-run1.txt`) — right: the note names the recipient of the supply it adjusts.
⚠ The TEST account's header reads "FieldLogicHQ sandbox, Charlottetown, Prince Edward Island" — not the business's Ontario
address. Not a s.3 item, but the live account's public details must be checked before the first live note (Part 7 walk).

**Rounding (R1).** Stripe computes the tax per line and rounds it, so some card figures are unreachable (about 1 in 9 at 13%). Refunding
the nearest figure **not above** what staff typed is sound: the refund is discretionary, the note states the exact tax reversed,
and refunding less never over-claims the adjustment. Staff wording "Stripe can refund $X, the nearest it can make with the tax" is
accurate: since Part 7 (owner Q1, 2026-11-06) the planner states a figure only once Stripe has shown that one line unit more
would go above the typed figure, and refuses otherwise — proven on every row of the test-mode matrix, including a line-level coupon
and 75% off (`.probe/gst2/part6b-part7-refunds-run1.txt`: each figure checked by an independent one-unit-more preview).

**Which line (largest first, spilling past its cap).** On our invoices every taxed line of one invoice has the same place of supply
and so the same rate; the tax reversed is the same whichever line takes it. The note records the reduction against a line (a
supply). If a refund is really for one supply (e.g. "refund the recovered fee"), crediting the plan line misattributes it in the
record without changing the tax. Acceptable; a future "refund this line" choice would fix the record if it ever matters.

**A charge that paid no invoice (R3).** No invoice → Stripe Tax recorded no tax on it, and our checkout never makes one. A bare refund
makes no tax adjustment, and none may be claimed without a note (¶22) — so there is nothing to over-claim. If someone ever charged
in Stripe's dashboard and treated it as tax-included, the safe result is that we over-remit; the fix is never to charge without an
invoice, not to add a note.

**Name.** The rule is the same as the $500 invoice rule (see [GST_HST_ON_SUBSCRIPTIONS_CANADA.md](GST_HST_ON_SUBSCRIPTIONS_CANADA.md)):
the cardholder (an authorized representative), a typed business name and the club's own name each satisfy s.3(c). R4 (a returning
club's first invoice made inside Checkout naming the cardholder) is compliant. Replacing a business name typed on an EARLIER
Checkout with the club's name when none is typed this time is compliant (the club's name is the recipient's name); the buyer's own
GST/HST number is not a required item on our invoice (only ours is), and it stays on the customer. Premium → Club: invoices before
the move name the coach (the coach was the recipient), after it the club; a later note on an old invoice keeps the coach's name.

## Recommendation
1. Keep the build as is: credit notes meet s.232 / SOR/91-44 s.3; R1's rule, the line order and R3's bare refund are sound.
2. **Before the first live refund:** read the LIVE account's public business details (name, Ontario address) and confirm our
   GST/HST number is set to print on live invoices and notes — the test account's header is a PEI sandbox address, and the number
   prints on the sandbox only because the sandbox has it set (Part 7 walk, W9; see STRIPE_TAX_SETUP.md).
3. ~~A line-level coupon makes the planner miss the nearest~~ — **resolved 2026-11-06** (owner Q1, built in Part 7). A figure the
   planner cannot prove within its preview budget is refused, never stated: safe side (no note, no adjustment claimed).
   **The credit-note PDF link** in platform admin goes only to staff who can refund (owner Q2, 2026-11-06). Not a tax rule — least
   access to the club's billing name and address; the club itself still receives the note by email and in Stripe's portal.
4. Plan & billing's fee list not showing a refunded fee invoice is not a tax gap (the s.232 document is issued and emailed, R2). The
   club's own books need the note, which they have; showing it is a product nicety for `/plan`.

## GST/HST Stage 3 closeout (2026-11-07): what the kept records do with refunds, notes, currency and deletion
From the facts already on file (Memo 12.2 ¶22-24, Memo 3-6, the six-year rule); no new research was needed.
1. **A refund with no credit note leaves the GST/HST unreduced: correct, not a defect.** The s.232 deduction exists only once a
   note is issued (line 107). Refunding the card in Stripe's dashboard without one means we over-remit the tax on it, the safe
   direction. Remedy when "Needs a look" lists one: issue a credit note in Stripe for the refunded amount (linked to the refund).
2. **Check 7 measured by what the notes paid back to the card (owner 2026-11-07): sound.** A note that credited the customer's
   balance pays nothing back, so a separate card refund is rightly still listed; an out-of-band note never touches the charge's
   refunded figure, so it cannot cause a false flag. A note whose refund Stripe attached late reads as unexplained: a false
   flag (over-remit side), never a false clear.
3. **The eighth check (Stripe zero-rated a sale to an address kept in Canada): sound.** Software supplied to a Canadian address
   has no zero-rating route for us (a zero-rated export needs a non-resident; Schedule VI Part V). It is a look, not a ruling: a
   genuine non-resident with a Canadian billing address is possible but would fail our own evidence rule anyway.
4. **A USD credit note valued at its own day's rate: fine today, one Stage 4 rule.** Every USD sale we make is zero-rated, so a
   USD note carries no GST/HST and nothing reaches line 107. If a USD note ever carries GST/HST, the line 107 adjustment must not
   exceed the CAD tax first reported on the invoice (Memo 12.2: only "to the extent the tax was in net tax"): value its tax at
   the ORIGINAL invoice's rate for the return. For line 101 revenue, the note's own-day value is acceptable if used consistently.
5. **Zero-rating on a US address + the declaration, with card/payout country only feeding "needs a look": as recorded.** The
   three-part evidence rule in ZERO_RATED_SALES_TO_US_CUSTOMERS.md (address + declaration + one corroborator; a mismatch is held)
   still needs the accountant's approval before the first US club. Nothing changes while US sales are closed.
6. **The fee table's cascade on a club delete: no retention gap.** Every fee invoice also has its own kept tax record
   (`kind = fee`), which has no link to the club and survives; Stripe keeps the invoice too. Stage 4 must read fees from the kept
   records, never from the cascading fee table.
7. **Our copy survives a deletion of the Stripe customer: required, not optional.** The six-year retention (ETA s.286, ITA s.230)
   is not overridden by a deletion request (RECORDS_RETENTION_AND_LOCATION.md). How the privacy policy says so is `/legal`'s.

## Sources
- [Credit Note and Debit Note Information (GST/HST) Regulations, SOR/91-44 s.3](https://laws-lois.justice.gc.ca/eng/regulations/SOR-91-44/page-1.html) — accessed 2026-11-06
- [GST/HST Memorandum 12.2, Refund, Adjustment, or Credit of the GST/HST under Section 232](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/12-2/refund-adjustment-credit-gst-hst-under-section-232-excise-tax-act.html) — accessed 2026-11-06
- Stripe test-mode credit-note PDFs, `.probe/gst2/part6b-part4-note-pdf-run1.txt`, `part6b-part4-note-name-run1.txt` — 2026-11-06

## Professional sign-off needed?
No for the build. Yes, eventually, for the first GST/HST return that carries credit-note adjustments (that Stripe Tax's net figure is
the one filed) — the same item already open in [UNPAID_SUBSCRIPTION_INVOICES.md](UNPAID_SUBSCRIPTION_INVOICES.md).
