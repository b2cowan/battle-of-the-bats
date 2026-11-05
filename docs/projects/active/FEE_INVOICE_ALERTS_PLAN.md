# Fee invoice alerts — the owner finds out what they owe

Plan of record. PM brief: `FEE_INVOICE_ALERTS_PM_BRIEF.md`. Drawings (owner rulings, all eight asks A, 2026-11-05):
https://claude.ai/artifact/4dmPojUsg4EspaphPVxSEc, source `FEE_INVOICE_ALERTS_DRAWINGS.html`. Design record: `memory/design_decisions.md`
2026-11-05 "A FEE INVOICE THE CLUB OWES".

## Why

Raised by the owner reading a club's Plan & billing: the Stripe fees list shows "Pay the invoice" beside one $1.25 line, and asks whether
that list is the only way an owner learns they owe. Reading the code: it is nearly the only one. Three things are true today.

1. The invoice is never shown as a thing. The list is one row per fee; the invoice number repeats on every row; the pay link is shown once
   per invoice on its newest row (`StripeFeesList.tsx`, `payShown`). **No total, no tax.** Fees are taxed on top (`RECOVERED_FEE_TAX`,
   GST/HST Stage 2 Ask 3), so an Ontario invoice of three $1.25 fees is $4.24, not $3.75.
2. Overdue is computed (`own_overdue` in `readClubFees`) and then drawn identically to open (`billedWords`).
3. The only other signals are the invoice email and one reminder email after the due date. Nothing in the app outside that page. A failed
   plan payment (`past_due`) is also only a sentence on Plan & billing. Fee invoices never suspend an account (§7 ruling 3), so the in-app
   signal is the only lever the product has.

## What is ruled (drawings asks 1–8, all A)

1. Group the fees list by invoice: one invoice row (number, due date, Overdue chip with "Was due {day}", total, ONE lime "Pay invoice"
   button, new tab) and the fee lines under it, invoice number not repeated.
2. HST is its own line; the figure comes from the invoice. Unbilled fees: a quiet "Not on an invoice yet" group. Paid: a closed "Paid invoices" row.
3. Rail door "Plan & billing": the rail's count pill (invoices owed), amber open, **red** overdue. Phone: the same on "More" and on the row in the sheet.
4. Open, not yet due: pill + one callout line (amber edge) at the top of Plan & billing. Nothing on other pages.
5. Overdue: a banner on every club admin page, one line, red-edged, words + Pay button, no dismiss, scrolls with the page, ends when paid.
   On Plan & billing it replaces the separate line.
6. Owner only (`hasBillingAccess`).
7. Failed plan payment: amber pill; the red line keeps today's sentence (`W.plan.pastDue`) and gains a button (the shipped "Payment method &
   invoices" door). No banner elsewhere.
8. The pill's red tone is the one design-system extension.

Also done in this round (committed with this plan's first commit): **billing address tidy** — a street line or city typed entirely in lower
case or entirely in capitals is capitalised ("123 fake st" → "123 Fake St"); directions (NW) and unit letters (4B) stay capitals; mixed
case is never touched; the postal code keeps its own rule. `tidyAddressCase` in `lib/billing-location.ts`, applied inside
`checkBillingLocation` (so the one save path and the re-read of stored addresses both get it). Tests in `billing-location.test.ts` (107
pass across the four billing-location files).

## Open questions for the owner (found while planning, NOT in the drawings)

- **Q1 · Banner position.** The drawing put the banner full-width under the top bar, above the rail. The cheapest honest build puts it at
  the top of the content column, beside the rail, because the rail and every sticky toolbar read `--admin-topstrip-h` for their offset and a
  full-bleed banner above the rail would have to be counted into all of them (≈10 sticky consumers). Because ruling 5 says it scrolls away,
  the content-column version loses nothing the owner can see except the rail starting beside it, not under it. **Recommend: content column.**
- **Q2 · A cancelled club.** A cancelled club is still billed Stripe fees (ruling 2 of 12d-1) and its shell renders only the strip, with no
  rail and no pill. **Recommend: draw the banner in that shell too** (owner only), since that is the club least likely to open Plan & billing.
  Needs a short drawing check.
- **Q3 · Words.** The banner, the page line, the chip, the HST line label and the pill's spoken label go to `/marketing` before the build
  (new words, via `lib/plan-billing-words.ts`; amounts through `money()`; the source guard forbids literals with `$ <digit>`).

**Q1 and Q2 ruled 2026-11-05 (owner):** Q1 = the simpler build, the banner at the top of the content column beside the rail. Q2 = yes,
a cancelled club sees the banner too (owner only), drawn in the strip-only shell; needs a short drawing check before Part 4. Q3 (words)
is with `/marketing`.

## Build, in order (each part: Product Manager UX summary → build → verify → `/review`)

**Part 1 — the fees list, by invoice.** Server: `readClubFees` must stop dropping what it already selects. `INVOICE_COLUMNS` has
`amount_due` but `ClubFeeView` never copies it, and the table has no tax or total column. Decision: **persist at sync time** (extend
`writeInvoiceState` to store subtotal, total and the named tax lines from `namedTaxLines(inv.total_taxes, …)`; one migration, a jsonb
column, dictionary + snapshots refreshed) rather than a live Stripe call per page view; open rows written before the migration fill lazily
on first read. Route returns an `invoices[]` summary beside `fees` (never a total on each fee). Client: `StripeFeesList` groups by invoice.
Keep the route `allowSuspendedOrg` + behind `billing` (guard: `stripe-fees-owner-rulings`); platform admin's panel reads the same view.
Guards to update: `plan-billing-body` (fees render `''` until read, section order), `plan-billing-source-guard`.

**Part 2 — the signal's data and the pill.** `ClubBriefProvider` already fetches once per org and serves the rail, the bar and the hub, so
**no new fetch**: add an owner-only `feesOwed` (`{ count, overdue }`, from `platform_fee_invoices` where `status = 'open'`, right
`livemode`, cheap query, no Stripe call) to `/api/admin/club-brief`, present only where `hasBillingAccess`. `past_due` needs no fetch
(`useOrg().subscriptionStatus`). Counts are not supported on `kitBillingLink` today (no `count` field); add it WITHOUT changing the exact
`const billingLink = kitBillingLink({…})` call that `nav-standard-guard` pins. Render `WaitingCount` in the rail foot row, `dropCount` in the
More sheet row, add to `moreBadge`; the More tab's aria text says "unread", reword. Red variant: new tokens-only rules in
`AdminKitFrame.module.css` (`.count`) and `CoachesBottomNav.module.css` (`.tabCount`, `.dropCount`); check the token name in globals.css
(`--home-live` / `--danger`). Guards: `nav-standard-guard`, `admin-kit-nav`, `admin-kit-guard` (tokens only).

**Part 3 — the page line and the failed-payment button.** A `PageNotice`-area callout in `BillingBody` (the `waitCallout` recipe, amber
edge; red variant `.calloutDanger`); the failed-payment line gains its button. Words in `plan-billing-words.ts` (+ its test).

**Part 4 — the banner.** In `AdminChrome`, inside `<main>` above `AdminEventHeader` (Q1), owner-only, overdue-only, reads the brief's
`feesOwed.overdue`; on Plan & billing the banner stands in for the separate line. Phone: one row, 44 px button. Cancelled shell: per Q2.

**Part 5 — close.** `/docs` (help articles for Plan & billing and the coaches/club equivalents; the build-time spelling gate applies:
"installment", "fiscal year"), `/accounting` check of the HST line wording (display only, but it names a tax), `/review`, then an owner walk
as a checkable Artifact. Dev site only: the demo sandboxes follow the product (CLAUDE.md), nothing to do for them.

## Not in scope

No change to when invoices are issued, the one reminder email, or the "nothing switches off" rule. No dismiss on the banner. No second
approver. Coaches portal untouched (the coach portal has no fee invoices).

## Progress

- 2026-11-05 (later): **Part 1 BUILT, not yet applied or walked.** Migration `444_fee_invoice_total_and_tax.sql` written (adds `total` and
  `tax_lines`) but **NOT applied to dev: the auto-mode classifier refused the apply as a shared-resource change, so the owner applies it**
  (`node scripts/apply-migration-api.mjs supabase/migrations/444_fee_invoice_total_and_tax.sql`, then `npm run refresh:snapshots`).
  ⚠ **Until it is applied, every read of `platform_fee_invoices` on dev fails** (the column list now names the two columns): the Plan &
  billing fees section stays absent (fail-soft) and the invoice sync/email/reminder jobs on a locally running server error. Dictionary
  written (snapshots follow the apply). Code: `writeInvoiceState` stores Stripe's total + named tax lines; `readClubFeesAndInvoices`
  returns `invoices[]` beside `fees` (`readClubFees` kept for platform admin); the route returns `invoices`; `StripeFeesList` groups by
  invoice. Words added to `STRIPE_FEE_WORDS`; `payInvoice` is now "Pay invoice" (the email keeps "Pay the invoice"); help line for the
  fees list updated. Typecheck clean; 215 tests pass across the billing/fee guards. Prod: migration 444 owed before the code promotes.
  No unit test yet for the grouping itself (needs a fetch-mocked render); queue for `/review`.
- 2026-11-05 (after the owner's yes): **migration 444 applied to dev**; snapshots refreshed by the hook; `check:dictionary` passes;
  the dev-vs-prod drift lists exactly 444's three objects (`total`, `tax_lines`, `platform_fee_invoices_tax_lines_chk`) as missing on
  prod, as expected. **Prod apply owed before this code promotes.** Dev server restart owed before a browser look.
- Wording (marketing helper, 2026-11-05): proposals returned for the banner, page line, chips, pill spoken labels and plurals; Part 1's
  strings are in. Parts 2–4's strings are proposals pending the owner's nod (see the summary in the conversation): plural forms are
  needed because two open fee invoices can exist.

- 2026-11-05: drawings ruled (asks 1–8 all A). Design record written. **Address tidy built + tested** (uncommitted). Data path mapped and
  spot-checked against the code (fee view drops `amount_due`; no tax column; rail billing row has no count; brief route carries counts).
  Parts 1–5 not started; Q1–Q3 owed.
