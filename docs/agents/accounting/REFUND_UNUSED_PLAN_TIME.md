# Refunding the unused part of a prepaid plan when it ends early (the Data Terms §6 objection right)
**Last verified:** 2026-11-18
**Re-verify by:** 2027-11-18, or if: the refund console stops issuing credit notes; a plan line is ever sold tax-included; a
yearly plan is first sold to a US club with GST/HST (none today); Terms §8's "we end your plan" refund sentence changes
**Depends on facts:** registered for GST/HST (owner 2026-10-31, effective 2026-09-26, annual filer, regular method); plans sold
as Stripe subscriptions with Stripe Tax, tax added on top; refunds made through platform admin's console as Stripe credit notes
(see [CREDIT_NOTES_ON_REFUNDS.md](CREDIT_NOTES_ON_REFUNDS.md), whose rules this file applies and does not repeat)

## Question(s) this answers
- Data Terms §6 (owner ruling 2026-11-18, Q1): a club that objects to a new sub-processor may end its plan before the change
  takes effect, "and we will refund the unused part of what you paid in advance". How is that refund taxed, documented, booked
  and dated? Can the product make it today? Anything different for a coach buying as an individual? Is the sentence safe?

## Finding
**Tax and document.** Refunding the unused part is a reduction of the consideration for a supply already made and invoiced
(ETA s.232(2); Memo 12.2 ¶5-6). We may refund the GST/HST on that part, and we deduct it from net tax **only once a credit note
is issued** (Memo 12.2 ¶22-23). The document is therefore a **credit note**, never an adjusted receipt or a re-issued invoice; the
original invoice stays as it was. Stripe's credit note already carries every SOR/91-44 s.3 item (CREDIT_NOTES_ON_REFUNDS.md).
The refund should include the tax on the refunded part: Terms §8 already promises exactly that when *we* end a plan for a
reason that is not the customer's fault ("refund the unused part … including the tax on it, and send you a credit note"), and
the §6 case is the same kind of refund.

**Which period.** The credit note's own issue date (s.232(3)(b); Memo 12.2 ¶23-24): **line 107 of the return for the period the
note is issued**, at the original invoice's rate, capped at that invoice's GST/HST. Line 103 stays gross. A note issued in a later
year never touches a filed return. Limit: within four years after the end of the period of the reduction (¶11).

**Bookkeeping (from the code, 2026-11-18).** Sales by month takes the note off net sales, and its tax off tax, in the month of the
**note's** issue day (`lib/sales-by-month.ts:157`). The GST/HST worksheet puts it on line 107 in the note's period at the
invoice's rate, capped per invoice, with line 101 kept gross and the note shown as a memo (`lib/gst-return-worksheet.ts:13-19`).
A refund made in Stripe's own dashboard with no note is listed and never netted (the safe side: we over-remit).

**What the product does today (read from the code 2026-11-18, not run against Stripe).**
- *Refund this charge* (platform admin, Super admin and Billing) **can refund part of a charge**: an "All of it / Part of it"
  choice with a typed amount, previewed against Stripe, and sent as a **credit note on the invoice the charge paid**, lines by
  before-tax amount so Stripe reverses the tax per line (`lib/console-money-stripe.ts:535-548`). The figure is the nearest Stripe
  can make **not above** the typed one (sound, CREDIT_NOTES_ON_REFUNDS.md R1). Billing staff cannot refund a charge older than
  6 months; Super admin has no age limit. A yearly plan's refund near the end of its year therefore needs Super admin.
- *Ending the plan*: the customer's own cancel (Stripe portal and in-app) ends at the renewal date with no proration
  (`lib/stripe-portal-settings.ts:30`), so it leaves **no unused part to refund**. Only platform admin's **End now** ends it
  early, and it refunds nothing itself; its confirm already tells staff to refund the unused part afterwards with *Refund this
  charge*, never from Stripe's dashboard (`ClubRecord.tsx:1270`). End now also **suspends the club at once and cannot be put
  back**, so it must be run on the day the club chose, not the day it asked.
- **Nothing computes the unused part.** The End-now window counts the days lost but no money figure; staff work it out by hand.
- **Possible gap, coach paying for several portals:** the console refuses a Stripe customer carried by more than one
  organization record (`lib/console-money-store.ts:67`, `customerSharing` `orgCount !== 1`). If a coach's several portals each carry
  the coach's one customer, the console would refuse the refund. Not tested; routed to `/plan` as a check.

**How to compute the unused part (recommended rule).** Days from the day the plan ends to the end of the paid period, divided by
the days in that period, times the **before-tax amount actually paid for the plan** on that invoice (after any discount; free
time and credits were not paid, so they are not refunded). Type that before-tax figure plus its tax at the invoice's rate as the
"Part of it" amount; the console refunds the nearest figure not above it and the note states the exact tax. A monthly plan's
unused part is at most one month; a yearly plan's can be most of a year.

**A coach buying as an individual.** The GST/HST mechanics are identical: same tax, same credit note, same line 107, same
periods. The only difference is on the buyer's side: an individual cannot claim the tax back, so refunding the tax on the
unused part matters more to them (already the recommendation). Whether consumer-protection law gives an individual a wider or
quicker refund right (Ontario's internet-agreement rules) is `/legal`'s question, not a tax one; Terms §8 already reserves "any
right to a refund you have under the law".

## Recommendation
1. **The promise is workable today, by hand:** End now on the day the club chose, then *Refund this charge* → Part of it with
   the computed figure. The tax and the books come out right, because the refund is a credit note.
2. **The §6 sentence is safe in substance but should be tightened** (customer words, for `/legal` to place; do not edit the
   draft from here):
   > If you object to a new company on reasonable grounds, tell us before the change takes effect. If we can't address your
   > concern, you may end your plan on any day up to the day the change takes effect, and we will refund the unused part of the
   > period you paid for, from the day your plan ends, including the tax on it, and send you a credit note showing it.

   Why each change: "tell us before the change takes effect" sets when the right is used; "on any day up to" because ending is
   immediate and permanent, so the club picks the day; "the unused part of the period you paid for … including the tax on it,
   and send you a credit note" is Terms §8's existing wording, so one refund rule reads the same in both documents and the tax
   is promised plainly; "from the day your plan ends" fixes what "unused" counts from.
3. **For `/plan` (product gaps, no code here):** (a) an "unused part" figure in the End-now / refund flow, so staff are not doing
   the day arithmetic by hand (the same need already exists for Terms §8's "we end your plan" refund); (b) check whether a coach
   paying for several portals can be refunded at all (the shared-customer refusal). (a) is HELD (owner 2026-11-19) until the
   first such refund is near. (b) is built 2026-11-19: a coach's several portals each read and refund their one customer.
4. **Run it through the console only.** A refund from Stripe's dashboard issues no note, so the tax on it is not recovered.
5. **A coach with several portals (added 2026-11-19):** that coach's Money tab lists the charges for ALL of their portals. Refund
   the charge whose invoice is for the portal being ended (match the plan and the paid period on the charge), and take the
   days from that portal's period. The credit note and our tax record follow the charge's own invoice, so the books are
   right whichever portal's tab it was refunded from; only the choice of charge needs care.

## Sources
- ETA s.232 and SOR/91-44 s.3; GST/HST Memorandum 12.2 (April 2008) — as cited and accessed in
  [CREDIT_NOTES_ON_REFUNDS.md](CREDIT_NOTES_ON_REFUNDS.md) and [GST_HST_RETURN_LINES.md](GST_HST_RETURN_LINES.md) §10, 2026-11-06/07
- Code read 2026-11-18: refund console, cancel paths, Sales by month, GST/HST worksheet, Terms 2026-11-17 §8 and §11 (cited inline)

## Professional sign-off needed?
No for the promise or the mechanics (s.232 with a credit note is settled). The first return carrying credit-note adjustments is
already on the accountant list (UNPAID_SUBSCRIPTION_INVOICES.md).
