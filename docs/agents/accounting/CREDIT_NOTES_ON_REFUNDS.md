# Credit notes for refunds of FieldLogicHQ's own invoices: contents, part refunds, no-invoice charges
**Last verified:** 2026-11-06
**Re-verify by:** 2027-11-06, or if Stripe changes its credit-note template, the live account's public business details change, or a refund is ever made more than 4 years after the invoice's reporting period
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
<number>", "Date of issue", our name + "CA GST/HST 767993298RT0002", the club's name and address under "Bill to", each line
before tax, "HST - Canada (13% on CA$88.49) CA$11.50", the adjustment total and the refund. **All of s.3 is met.** It names the
original invoice by number (not date; Memo ¶20 is met in substance — the number identifies the supply and its date). A note
made after the customer was renamed prints the **invoice's** name and address, not the customer's new ones
(`part6b-part4-note-name-run1.txt`) — right: the note names the recipient of the supply it adjusts.
⚠ The TEST account's header reads "FieldLogicHQ sandbox, Charlottetown, Prince Edward Island" — not the business's Ontario
address. Not a s.3 item, but the live account's public details must be checked before the first live note (Part 7 walk).

**Rounding (R1).** Stripe computes the tax per line and rounds it, so some card figures are unreachable (about 1 in 9 at 13%). Refunding
the nearest figure **not above** what staff typed is sound: the refund is discretionary, the note states the exact tax reversed,
and refunding less never over-claims the adjustment. Staff wording "Stripe can refund $X, the nearest it can make with the tax" is
accurate — **where the planner really found the nearest** (see the line-coupon note below).

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
2. **Before the first live refund:** read the LIVE account's public business details (name, Ontario address, GST/HST number) on a
   live invoice or note — the test account's header is a PEI sandbox address (Part 7 walk step).
3. A refund that shows "the nearest it can make" must actually be the nearest: a line-level coupon (only possible from Stripe's
   dashboard; the product never applies one) makes the planner miss it and refuse every part refund. Not a tax defect (nothing
   wrong is filed or sent) — a product limitation; owner's call whether to build the gap step.
4. Plan & billing's fee list not showing a refunded fee invoice is not a tax gap (the s.232 document is issued and emailed, R2). The
   club's own books need the note, which they have; showing it is a product nicety for `/plan`.

## Sources
- [Credit Note and Debit Note Information (GST/HST) Regulations, SOR/91-44 s.3](https://laws-lois.justice.gc.ca/eng/regulations/SOR-91-44/page-1.html) — accessed 2026-11-06
- [GST/HST Memorandum 12.2, Refund, Adjustment, or Credit of the GST/HST under Section 232](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/12-2/refund-adjustment-credit-gst-hst-under-section-232-excise-tax-act.html) — accessed 2026-11-06
- Stripe test-mode credit-note PDFs, `.probe/gst2/part6b-part4-note-pdf-run1.txt`, `part6b-part4-note-name-run1.txt` — 2026-11-06

## Professional sign-off needed?
No for the build. Yes, eventually, for the first GST/HST return that carries credit-note adjustments (that Stripe Tax's net figure is
the one filed) — the same item already open in [UNPAID_SUBSCRIPTION_INVOICES.md](UNPAID_SUBSCRIPTION_INVOICES.md).
