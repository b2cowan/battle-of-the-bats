# PM brief — FieldLogicHQ charges its own sales tax correctly

**Plan:** [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) · **Status:** planned 2026-10-31; Stage 1 Parts 1–3 committed 2026-11-04 (`fd55a1df3`, `32d466e59`), Part 4 + walk owed ·
**Priority:** gates the first paid subscription

## Stages and when the project is done (owner, 2026-10-31)
Plain words: the work is nine stages. 0 is the owner's desk work (the CRA date is found; a few small tasks remain). 1 collects
each buyer's address. 2 makes every checkout and price preview charge and show the right tax. 3 records why each charge was
taxed and shows it to staff. 4 teaches the books the sales side of GST/HST. 5 puts tax on the online-payment fee and finishes
together with Club Stage 12. 6 is the Terms of Service with the lawyer. 9 (new) is the closing pass: help articles, the demo
check, the database notes and production changes, the accounting review and an owner walk. **The project is done when Stages 0–6
and 9 are complete.** Three things are standing triggers and the project does not wait for them: provincial registrations
(Stage 7), opening to US clubs (Stage 8b, with the US price list, the per-state tracker, no fee on top for US families and
bank debit), and the recurring rhythm (returns, the January report, the yearly re-check). The first GST/HST return is out of
scope — the owner handles it next year.

## What changes
FieldLogicHQ is now registered for GST/HST, so every sale from the first one carries tax. Today the product charges
none, knows no customer's location, has no Terms of Service, and prices never say "plus tax". After this work:

- **A club or coach buying a plan** gives its address once at checkout. Before paying it sees the price, the tax by
  name ("HST 13%", "GST 5%") and the total. A US club ticks a short declaration and pays no Canadian tax.
- **Every invoice and receipt** shows FieldLogicHQ's GST/HST number and the tax line.
- **Prices everywhere** read "plus applicable taxes".
- **A club taking online payments** gets a monthly statement of the fees FieldLogicHQ took and the tax on them, once
  counsel confirms the fee's treatment.
- **The owner** sees tax collected by province, sales to US clubs, tax paid on expenses, and a ready-to-file return
  worksheet in Bookkeeping. Staff see each charge's tax and why on the organization's Money tab.
- **New customers accept Terms of Service** at signup.

## Why it matters
Charging the wrong tax, or none, makes the owner personally liable for it. Getting location, evidence and invoices
right before the first sale is far cheaper than correcting a year of invoices later. Done right, it also returns money:
tax paid on business expenses can be claimed back, and foreign software vendors stop charging tax once they have the
number.

## Customer impact
Canadian customers pay their province's sales tax on top of today's prices (most organizations that are registered get
it back). US customers pay none, and US clubs are offered plans once they can also take payments. No Canadian buyer is blocked by
their province. Checkout gains one address step.

## Role differences
Buyers (club admins, coaches) see the address step and tax lines. Platform staff see tax on the Money tab. Only the
owner sees the Bookkeeping tax reports.

## Owner decisions (ruled 2026-10-31)
- **US customers:** the address step covers both countries now; the review of US clubs taking payments is part of this
  project (done 2026-10-31); every product, coach Premium included, opens to US customers together once US tax and
  payments work. US clubs pay Stripe's fees directly (Stripe files the US tax forms), the fee is never added on top for
  US families, and US bank debit is included. All 50 states and DC open at once; a per-state tracker in platform admin
  warns before any state's threshold. No US lawyer before launch; one is brought in if sales grow, a state alerts, or
  Stripe can't file the US tax forms for our clubs.
- **The payment fee:** tax added on top, charged to the club; the fee is always the club's charge legally.
- **Prices:** "plus applicable taxes". **Tax engine:** Stripe Tax.
- **Accountant:** the question package is prepared, but it does not hold the launch; differences are settled at tax time.
- **US proof:** address + declaration + one outside-Canada sign.

## Success criteria
- The first paid subscription in every province, and from a US club, charges the tax this plan's research supports,
  with a recorded reason; the accountant reviews it at tax time.
- Every invoice meets CRA's documentation rules.
- The first GST/HST return is filled in from the Bookkeeping worksheet without hand-gathering figures.
- No province or US registration is missed when its threshold arrives.
