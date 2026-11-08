# Plans & pricing · Stage 2 · Part 4: owner reports (PM brief)

> 2026-11-07 · Drawings: https://claude.ai/artifact/PqUgoHqg57j1SGSo2YypjP
> (`PLANS_PRICING_STAGE2_PART4_REPORTS_DRAWINGS.html`) · Stage prompt: `PLANS_PRICING_STAGE2_BUILD_PROMPT.md` · Status: **drawn,
> ten asks with the owner; nothing built.**

## What changes for the owner and staff

- **Customers › Renewals** (new page, read only), two views:
  - **Coming up:** one dated list of every plan that renews or ends in the dates picked: renewals with the price on file,
    Stripe trials ending, free time and Founding Season ending, and any club still marked as on trial after its date. A band
    of counts and the price on file (before tax) for the dates.
  - **Unpaid bills:** every unpaid bill across clubs, with before-tax, tax and total from our own invoice record, and how long
    the club has been past due. One door per row to the club's Money tab, which keeps the bank's reason and the next try.
- **Bookkeeping › Reports › Sales** (owner only): sales by month (invoiced, voided, credit notes, net sales, GST/HST, collected,
  written off), with one sentence that reconciles it to line 101 of the GST/HST return.
- **Today:** the Past due and Trials ending rows open the dated lists. No new card.
- **Accountant package:** gains the sales and credit-note files it says today are missing.
- **Stripe's fees to us:** no screen. One Bookkeeping expense a month from Stripe's statement (recommended).

## Why it matters

The owner can answer "what renews this month, who owes us, and what did we sell" without opening Stripe or ten club records,
and hand the accountant one package that includes sales. Every figure says what it counts and its dates; no total mixes tax,
test and live, or currencies.

## Re-framed from the brief

Five reports were listed. The code shows two of them as one dated list. The unpaid list can carry amounts from our own record
with no Stripe calls. Sales belongs beside the GST/HST return, built from the same records. And "Stripe fees" splits into income
(fees billed back to clubs, already shown) and our cost (best entered as a monthly expense). So the brief's five reports become
two lists and one view.

## Who sees what (recommended)

Renewals: Super admin, Billing, Support (the staff who already see club billing). Sales: the owner only (Bookkeeping). No role
sees the eye: nothing on either page changes anything.

## Found on the way

F1: Business numbers counts Founding clubs (paying $0) at list price. F2: "Trials ending" never stops counting a trial whose
date passed. Both are recommended as fixes inside Part 4.

## Reviews

`/accounting` ruled what the figures call revenue (`docs/agents/accounting/REVENUE_REPORT_DEFINITIONS.md`). `/legal` cleared the
staff lists, found that an individual coach's unpaid portal is personal information (so the exports need a stated reason),
and kept addresses out of the accountant's file (`docs/agents/legal/STAFF_CROSS_CLUB_BILLING_LISTS.md`).

## Success criteria

The owner rules the ten asks. The build matches the drawing. Every figure on the walk can be traced to its rows. "Could not read"
never shows as zero.
