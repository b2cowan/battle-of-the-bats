# Plans & pricing · Stage 2 · Part 4: the Reports drawing session (kickoff prompt)

> Written 2026-11-07, after Part 3 (the Stripe page in Health) was committed (`514d3a2d0`). Read first: the Progress block and the
> "Owner rulings, 2026-11-06" block of [PLANS_PRICING_STAGE2_BUILD_PROMPT.md](PLANS_PRICING_STAGE2_BUILD_PROMPT.md).
> **This session draws. It builds no screen and writes no product code.** The owner ruled (2026-11-06, ruling 4) that reports get a short
> drawing session first: a mockup Artifact through `/design`, the owner rules it, and only then is Part 4 built.
> Mark each fact you rely on [V] (verified this session, with file:line) or [H] (handed to you). Everything below about what the code
> holds is [H]: it comes from a read-only census on 2026-11-07. Open the lines before you draw anything that depends on them.

## What Part 4 is

Five reports for the owner, from the stage list: **renewals this month, trials ending, failed payments, revenue by month, Stripe
fees**; plus the two scraps the Part 3 walk deferred to Part 4: a **"This month" card** and **"Export for the accountant"**
(`PLANS_PRICING_STAGE2_PART3_WALK.html`). The stage prompt's rule for the figures: each one says what it counts and its date range;
a total that mixes test and live, or tax and price, is a defect. "Owner-only first."

## Disagree out loud, before drawing (AGENCY_RULES, blocking)

The census found that the premise is wider than the five names suggest. Test each of these against the code and say which you agree
with BEFORE you open a mockup. Do not draw five reports because five were listed.

1. **Which of the five are actually missing?** Trials ending already has a 14-day count (Business numbers, Today) and a "Trials
   ending soon" filter on Clubs & portals. Renewal dates sit on the club record and the Money tab shows the next charge per club.
   What is missing is a **dated, cross-club list**, not the data. A report that repeats a filter the owner already has is noise.
2. **Revenue by month overlaps work that is already committed.** GST/HST Stage 4b Session B adds a "GST/HST return" view to
   Bookkeeping Reports, a tax-period sales table with a worksheet CSV and "Copy lines" (`GST_HST_STAGE4B_BUILD_PROMPT.md`). The engine
   behind it (`readGstReturnWorksheet`) already exists. Ask whether "revenue by month" is a second screen, a column on that view,
   or the same thing under a different name. The same applies to "Export for the accountant": Bookkeeping already has an accountant
   package export.
3. **"Owner-only" is not a role.** The platform roles are Super admin, Billing, Support, Product, Growth, Read only. Bookkeeping is gated
   by an owner email list, not a role. Business numbers is readable by every role. The first cross-customer money total needs a
   deliberate answer: a new area (as `watching_stripe` was), Super admin only, or a Bookkeeping view. Put the question to the owner
   with the three options drawn, do not pick one silently.
4. **"Stripe fees" is two different things and the label will be misread.** What exists is fees caused by clubs' online family payments,
   recovered FROM clubs and taxed on top (`platform_stripe_fees`, Health › Online payments, the club Money tab). What does NOT exist
   anywhere is Stripe's processing fee on FieldLogicHQ's own subscription sales. The stage ruling is that storage is added only for
   this figure, and only if the owner asks for it at this session. Draw both meanings, labelled apart, and make the storage question
   explicit with its cost (a stored copy versus a live read that pages through Stripe).
5. **A failed-payments report across clubs is expensive.** Per club the story is rich and read live (the Part 2 notice). Across clubs the
   product holds only a status (`past_due`) and event counts: no amount, reason or next try. Draw what a cross-club list can show
   honestly today (club, since when, status), and what it would take to show amounts (one live Stripe read per past-due club, or storage).
   A past-due club keeps working; unpaid is still revenue and still owes tax (`docs/agents/accounting/UNPAID_SUBSCRIPTION_INVOICES.md`),
   so never draw it as "lost revenue".
6. **There is no "owner dashboard" yet; Business numbers' dollar figure is NOT revenue.** It is a point-in-time sum of list prices for
   active clubs (before tax, no discounts, no yearly plans, no history). Say so on the drawing wherever a "monthly" figure appears, or
   the owner will read two different numbers as one.

If the evidence supports a smaller Part 4 (for example: two cross-club lists plus a revenue view that lives in Bookkeeping), propose
that. Do not manufacture objections: if a report is right as listed, say so plainly.

## What the census says exists (all [H]; open the cited lines)

| Report | Data today | Gap |
|---|---|---|
| Renewals this month | `organizations.current_period_end`, `subscription_status`, `plan_id`, `subscription_amount_cents`, `subscription_currency` (mig 418; `lib/platform-metrics.ts:152`; label set `renewalLabel()` at `lib/console-money.ts:381`) | no list sorted by date. Coaches Portal rows often hold a blank billing cycle (the 11 clubs the morning comparison flags): do not draw a cycle column as reliable. Free time and Founding comps have no subscription and end through `org_overrides.expires_at`. The amount is the list PRICE before tax, in the row's own currency. |
| Trials ending | `subscription_status = 'trialing'` and `current_period_end` within 14 days (`lib/platform-metrics.ts:263`, Clubs & portals filter `trial_ending`, Today) | two meanings: Stripe trials, and free time / Founding Season (`org_overrides.expires_at`; Founding clubs also sit in `trialing`). Draw them as labelled apart. |
| Failed payments | per club: live Stripe (`lib/console-money.ts:567-669`, the Part 2 notice). Across clubs: `past_due` status and `platform_events` (`subscription_past_due`, `subscription_recovered`) | no cross-club amounts, reasons or next try (see point 5). |
| Revenue by month | `platform_charge_tax_records` (mig 451): one row per Stripe invoice with before-tax, tax, total, issue date, status, `livemode`, and CAD-valued twins; credit notes in `platform_credit_note_tax_records`. Backfilled from 2026-05-01. | no screen. Never sum raw cents across currencies. Before-tax and tax apart. A sale belongs to its issue day, paid or not. Voids, uncollectible, credit notes and refunds need explicit treatment. Fee-kind and one-off rows are different from subscription revenue. Sales before the GST registration date are revenue but outside the return. |
| Stripe fees | recovered fees only: `platform_stripe_fees` (mig 390), `lib/platform-stripe-fees.ts`, Health › Online payments | Stripe's own processing fee on our subscription sales is stored nowhere (see point 4). |

Pages the reports must not duplicate: Business numbers, the Money tab (renewals, failed bills, sales, fees per club), Health › Stripe,
Health › Online payments, Free time, the Clubs & portals attention filters, and the coming Bookkeeping "GST/HST return" view. Also read
the untracked `BANK_CHECK_WORKING_DRAFT_*` files before drawing anything about payouts or bank matching (the other half of the gaps
doc's item 17): that is not one of the five and is not ruled.

## Export conventions to reuse in the drawing (do not invent a new one)

The Export registry (`lib/export/catalog.ts`, proven by `check:export-catalog`): any new export needs a registry entry with its
sensitive-field reason. Excel first, CSV in the menu (`components/admin/ExportMenu`); server exports as
`/api/platform-admin/<area>/export?format=xlsx|csv` following the page's filters; formula-safe cells; CAD columns beside the
original-currency columns. Reuse Bookkeeping's period names: this month, last month, this year, last quarter, last year.

## The session

1. **Say which of the six points above you agree with** (one line each, argued from the code you opened). Re-frame if the question is
   wrong. Wait for the owner only if a point changes what you would draw.
2. **Ask `/accounting` what a report calls "revenue"** (invoiced on the issue date versus paid; how a void, an uncollectible bill, a
   credit note and a refund show; before-tax and tax apart; CAD and USD). No ruling is on file. Draw only after the answer, or draw the
   options and mark the choice as the owner's.
3. **Draw through `/design`, as a Claude Artifact (an HTML page, never the design canvas)**, following the owner's house layout for
   mockups (2026-10-28): sticky tabs, minimal scroll, and an **Everything / Show only what differs** toggle; the whole screen, before
   and after, at true size. Draw controls from the SHIPPED components, and the money figures as ONE joined band (tiles connected).
   Every highlight, flag or chip in the drawing is clickable and opens its explanation; hover alone is not enough. Use the Part 3 page
   (`/platform-admin/watching-stripe`) and Bookkeeping Reports as the formatting benchmark and check against their written rules.
4. **What the drawing must cover:** where Reports lives (menu entry, group, who sees it, the eye, the three role options from
   point 3); each report's columns and what it counts, with its date range; every empty, "could not read" and "Stripe not answering"
   state (Stage 0 fix 3: could not read is never nothing wrong); the test/live line (a total never mixes them; default shows the site's
   own mode only); the currency line; the "This month" card; the export (one CSV per screen, the registry entry, who may download);
   and, if the owner wants it, the Stripe-fees storage question with its cost drawn as a choice.
5. **Put the open choices to the owner as numbered asks with a recommendation each**, not as questions with no answer.
6. **Run `/legal` and `/accounting` on the drawing before the hand-off** (names, emails and payment history on a screen; what a report
   calls revenue and how tax shows). Record what they said, or record it as an owner question.
7. **Publish the drawing and a short product-owner brief.** When the owner has ruled, write the Part 4 build prompt (parts, files,
   tests, walk) as a separate file and add the rulings to the Progress block of the stage prompt. Update the Progress block's last
   line while you are there: it still lists Part 3 as open, and it is committed.

## Do not

Build a screen, a query or a migration. Add a button that changes anything. Store a copy of Stripe facts (ruling 1: no local mirror)
unless the owner asks for the fees figure at this session. Put a number in a drawing that the code cannot produce (every figure is
computed from the data above or it is not on the page). Touch `.claude/settings*.json`, hooks, `package.json` scripts or anything in
`WATCHED_PATHS`. Start Part 5 (replay) or the GST/HST Stage 4b build; both are other sessions. Touch live Stripe. Use
`git add -A` / `git add .`; commit only your own files, and ask the owner before committing.
