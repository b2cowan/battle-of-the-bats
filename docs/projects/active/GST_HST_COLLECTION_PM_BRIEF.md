# PM brief — FieldLogicHQ charges its own sales tax correctly

**Plan:** [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) · **Status:** planned 2026-10-31; Stage 1 Parts 1–5 committed 2026-11-04 (`fd55a1df3`, `32d466e59`, `95dbdcbec`, `1ab0bfb6f`), owner walk §454 passed 34/34 2026-11-04 and Part B re-walked on Part 6 2026-11-05; Stage 1 closed ·
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
- **A refund to a club** (staff, platform admin) comes with a credit note that shows the tax given back, and the club gets
  it. A club's invoices carry the club's name, not the name of whoever's card paid, unless the club typed a business name
  (Stage 2 Part 6b, built 2026-11-05/06; a part refund lands on the nearest figure Stripe can make, 2026-11-06.)
- **Stage 2 closeout (2026-11-06):** every quoted price says "plus applicable taxes", every paid step adds GST or HST for the
  buyer's billing address and charges what it quoted; a coach whose billing pays for two portals is asked to contact us before
  one becomes a club; the help explains the tax. **Owner walk §471 owed.** Before it reaches customers, the live Stripe account
  needs its Canada registration and "Include tax in prices: No" (owner steps at the promote).
- **The owner** sees tax collected by province, sales to US clubs, tax paid on expenses, and a ready-to-file return
  worksheet in Bookkeeping. Staff see each charge's tax and why on the organization's Money tab.
  *Stage 4, drawn and ruled 2026-11-06:* each expense records its tax by type, the supplier's number and CRA registration, and says
  in one sentence what credit it earns and why; tax paid by type shows in Reports (never a credit, never on the Overview). The
  worksheet is a Reports view that sets out lines 101–109 for any dates, with every figure opening what's behind it and a
  “Mark as filed” that freezes a period. Purchases (4a) build first; the worksheet (4b) follows the per-invoice sales record (Stage 3).
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
