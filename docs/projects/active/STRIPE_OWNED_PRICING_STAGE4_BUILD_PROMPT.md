# Stripe-owned pricing, Stage 4 — retire the recovered-fee machinery: build prompt

Paste this into a fresh session. Written 2026-11-18 by the Stage 2 session (Stage 2 committed `142ef12d6`), from a code
census run that day. **Stage 4 goes before Stage 3** (owner, 2026-11-18). The census found the two independent: Stage 3
reads Stripe's fee off the club's own charge, and this machinery reads the platform's balance, which a Stripe-owned account
never touches. The one shared file is `lib/online-payment-landing.ts`.

---

You are building **Stage 4 of Stripe-owned pricing** (plan of record: `docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md`,
"Stage 4"; PM brief beside it). Board project `payments` (`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`); status lives on
the board. **This stage removes something we charge**: FieldLogicHQ stops billing clubs for Stripe's extras (the monthly
Stripe-fee invoice for disputes, returned debits and foreign cards), because under Stripe-owned pricing Stripe takes them
from the club's own balance. No club or family sees a new screen. The invoice, its list, alert, banner and admin panel go away.

**What is ruled (do not reopen):**
- Stripe-owned pricing, R3 + rate design A (2026-11-17, `BUSINESS_DECISIONS.md` top entry). Stage 2 built it: every new club
  account is `fees_collector: 'stripe'`; our application fee is margin only and stored per payment
  (`online_payments.application_fee_amount`, mig 498).
- An old `'application'` account takes no new payment, and "Set up payouts again" replaces it (owner 2026-11-18). So
  **nothing can create a recovered fee on a payment made from today on**. What remains is history on dev.
- UAT Rep Club's old account runs the payout test's payout steps on or after 2026-11-25 and is not replaced before then
  (owner 2026-11-18, "split the pass"). The owner re-creates the dev clubs during the final walk, not before.
- No professional is a gate. Online payments stay off in production throughout.

**What exists (census 2026-11-18; verify each before you cut it):**
- **The heart:** `lib/platform-stripe-fees.ts`, 947 lines. It holds the record functions (`recordStripeFee`,
  `recordReturnedDebitFee`, `recordDisputeFees`, `recordForeignCardFee`), the billing (`billFee`, `sendMonthlyFeeInvoices`,
  `remindUnpaidFeeInvoices`, `syncFeeInvoiceFromEvent`, `retryFailedFees`, `sweepDisputeFees`, the stranded-fee release),
  the reads (`readClubFees*`, `invoiceWhere`), `clubFeeInvoicePlaceable` and `STRIPE_FEE_WORDS`'s emails. Beside it are
  `lib/fee-invoice-line.ts`, `lib/fee-invoices-owed.ts` and `lib/fee-invoice-alert.ts`.
- **Writers in the webhooks:** `lib/online-payment-landing.ts` (~L20 imports, ~338 returned debit, ~426 debit dispute fee,
  ~522-535 card dispute, ~885/919 foreign card), and `lib/billing-webhook-handler.ts` ~L41/268-272, the `FEE_INVOICE_META`
  branch. Read its comment first: without it, a fee invoice reads as the subscription's.
- **⚠ The daily job is shared. Keep it.** `app/api/platform-admin/stripe-fees-daily/route.ts` runs 16 steps. Only
  `dispute_fees`, `retry_fees`, `sync_invoices`, `stranded_fees`, `monthly_invoices` and `invoice_reminders` are this
  machinery (confirm each). The rest are load-bearing on PRODUCTION: dispute reminders, lost disputes, terms notices,
  ending warnings, plan-ending emails, overdue endings, the tax-record catch-up and backfill, purchase emails and renewal
  reminders. **Keep the route, its path, the pg_cron job `stripe-fees-daily` (mig 395, recorded as WATCHED AUTOMATION in
  `MANUAL_PROD_STEPS.json`; do not unschedule or rename it) and the audit action `stripe_fees_sweep`**, which the GST
  worksheet looks for (`lib/gst-return-worksheet-read.ts:48`, `lib/charge-tax-record-server.ts:398`). Several walk
  fixtures call the route (`seed-gst-6-4-…`, `seed-gst-6-6-…`, `seed-plan-move-walk`, `seed-plan-ending-walk`).
- **Club screens:**
  - Plan & billing: `components/billing/StripeFeesList.tsx`, `FeeInvoiceLine.tsx`, `useStripeFeesRead.ts`, and
    `BillingBody.tsx` ~29-31/581/859, with `app/api/billing/stripe-fees/route.ts` behind them.
  - The overdue banner and alert: `components/admin/kit/club/FeeOverdueBanner.tsx`, `BillingKit.tsx`, `useFeeAlert.ts`,
    `ClubBriefProvider.tsx`, `AdminChrome.tsx` ~38/147, and `app/api/admin/club-brief/route.ts` ~15/245 (`feesOwed`).
- **Platform admin:** `StripeFeesPanel.tsx`, `MoneyTab.tsx` ~37/492, `OnlinePaymentsTab.tsx` ~9/141, and the
  `…/money/stripe-fees` routes plus `[feeId]/retry`. `FEE_INVOICE_META` is read in `lib/console-money*.ts`,
  `lib/purchase-details*.ts` and `lib/billing-event-replay*.ts`. Health's "Needs a look" is `lib/platform-online-payments.ts`
  ~119/186. Bookkeeping's Sales by month has a "Fees billed back to clubs" column (`lib/sales-by-month.ts:33-36`).
- **Other readers that must not break:**
  - The endings count fees in flight at ~133-138 of `lib/online-payment-endings.ts`: Disconnect, cancel, deletion and the
    operator's Delete.
  - The dispute reads use a `feeWhere`: `lib/online-dispute-read.ts` ~148 and `lib/online-payment-dispute.ts` ~43/116.
  - `lib/email-kinds.ts` ~119 and `lib/platform-audit-reason.ts` ~24 (`retry_stripe_fee`).
- **The foreign-card rate:** `FOREIGN_CARD_EXTRA_BPS` in `lib/plan-config.ts` (~596) and `foreignCardFeeCents` in
  `lib/online-payment-fee.ts`, held to `PLAN_PRICING_FACTS.md` by `tests/unit/plan-pricing-facts-agreement.test.ts`.
- **Tax:** `RECOVERED_FEE_TAX` in `lib/billing-tax.ts` ~45-54, and the `'fee'` kind in `lib/charge-tax-record.ts` ~20/380
  and `-server.ts` ~160. The `'fee'` kind is also a CHECK on prod's tax tables (mig 451).
- **The tables:** `platform_stripe_fees` and `platform_fee_invoices` (migs 387/390/399/444). Both are RLS-on and
  service-role only; no SQL function or trigger reads them; there is an FK `platform_stripe_fees_invoice_fk` ON DELETE
  RESTRICT. On prod they exist (390/395/399/451 applied), and rows are expected to be 0 (no payout accounts ever). **On dev
  (read 2026-11-18), UAT Rep Club holds 6 `foreign_card` rows, $7.50:** 3 billed on an October fee invoice, and 3 unbilled
  ($3.75, created 2026-11-18 by the 2026-11-17 payout-test payments, which used US test cards).
- **Words:** `lib/online-payment-words.ts` ~97-100, ~397, ~426-428 (`otherFeesPlan`, "Your plan doesn't change", which
  `/legal` said on 2026-11-18 should retire), ~1286-1291 and ~1299-1406 (`STRIPE_FEE_WORDS`); also
  `lib/plan-billing-words.ts` ~18/479.
- **Tests:**
  - Dedicated: `stripe-fees-every-club`, `stripe-fees-owner-rulings`, `fee-invoice-line`, `fee-invoice-alert`,
    `fee-overdue-banner`.
  - Mixed, edit the relevant parts: `billing-location-every-path-guard` (~280, 497, 582-592), `billing-tax` (~87-91),
    `payouts-billing-address`, `bank-debit`, `bank-debit-desk`, `online-payments-guard`, `-leaving`,
    `billing-event-replay`, `gst-return-worksheet`, `gst-return-view`, `refund-credit-note-path-guard`,
    `migration-table-grants-guard`, `team-move-coverage`, `workspace-flip-guard`, `plan-billing-*`.
  - SQL: `scripts/online-payments-12d1-check.sql` ~261-284 and `12c-check.sql`.

**Do, in order (plan first; PM UX summary before code):**
1. **Stop the writing.**
   - Remove the fee recording from the landing paths (returned debit, both dispute kinds, foreign card) and the six
     billing steps from the daily job.
   - Keep the billing-webhook branch until the tables go, then remove it in the same unit.
   - Settle dev's October test-mode fee invoice in Stripe (void it or leave it paid) so no later event finds nothing to
     match. Say what you did.
   - The 3 unbilled dev rows would be invoiced on 2026-12-01 if the job still bills by then. This stage makes that moot;
     say so if the stage slips past that date.
2. **Remove the screens and their reads:** the club's Stripe-fees list, invoice line, alert line and overdue banner (and
   `feesOwed` in the club brief); the platform-admin panel, retry route, Money-tab and Health reads; the endings' fee
   counts; and the disputes' `feeWhere`. **Per the season-close lesson in `CLAUDE.md`, an entry point that leads nowhere is
   a bug**: grep every link, tab and tour anchor to a removed screen (`check:demos` fails on a dead tour anchor).
3. **The foreign-card rate:** delete `FOREIGN_CARD_EXTRA_BPS` and `foreignCardFeeCents`, along with their Facts-doc rider
   and agreement test, in the same commit as `plan-config.ts`.
4. **Tax:** stop writing the `'fee'` kind and retire `RECOVERED_FEE_TAX`. **Leave prod's CHECK and the readers tolerant of
   history**: no prod row has it, and a CHECK that still allows a value harms nothing. Removing it from the CHECK is a
   separate, optional migration; recommend, don't do. `/accounting` reviews this step.
5. **Bookkeeping's Sales by month:** drop the "Fees billed back to clubs" column, or keep it reading 0 for history.
   Recommend one, with the reason. Prod has never had a fee invoice.
6. **The tables:**
   - Recommend drop, the plan's word "retired by migration". Before you write it, do a read-only prod row count of both
     tables, expecting 0. A prod read needs the owner's yes in that session, or he runs the query.
   - The migration drops the FK, the tables and their grants; `migration-table-grants-guard` is told.
   - Add a `MANUAL_PROD_STEPS.json` entry (pending; ORDER: this code ships before the drop, since the prod code reads them
     until then).
   - Update `DATA_DICTIONARY.md` and refresh the snapshots in the same unit (`npm run refresh:snapshots`;
     `check:dictionary`).
   - If you conclude the tables should stay frozen instead, put it to the owner.
7. **Words:**
   - Retire `STRIPE_FEE_WORDS`, `otherFeesPlan`, the email kinds and the audit reason.
   - The Payouts card and the Before window already say "Stripe takes it from your balance" (Stage 2). Check that nothing
     still promises an invoice, a monthly bill or "on your … invoice".
   - `/marketing` only if a new sentence is needed.
8. **Help:**
   - `/docs` for the sections that describe the screens this stage removes, so no article points at a missing screen.
     The census found them in `platform-admin.tsx` (~388-451, 725/786, 1223/1241, 2156) and in the plan's "Help articles
     to rewrite (found in Stage 2)".
   - The wider fee-split rewrite stays Stage 5. Where it is the same paragraph, do it once.
9. **Walks and the ledger:**
   - §396's held steps E5, E8 and E9 (the fee invoice email and the answering fee on the invoice) test what this stage
     removes. Withdraw them in the ledger as retired by this stage. Don't let them sit as owed. Check what A11 is first
     and leave it if it is not fee machinery.
   - §405 F4 (the "Fees billed to the club" card) and §405 A (Disconnect counts) read differently after this stage.
     Rewrite the steps.
   - Grep **every** walk HTML for the retired screens and words (the walks rule: rewrite one, grep them all).
   - Confirm the payout test's checklist (`CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` ~465-480) touches nothing removed. Its
     "Stripe fee" line reads Stripe's live balance, so it should be safe.
10. **The record:**
    - `PLAN_PRICING_FACTS.md`: retire the foreign-card, returned-debit and dispute riders (Stage 2 marked them "old setting
      only, retires in Stage 4").
    - Then `/strategy` runs the drift check.
    - `docs/agents/ops/stripe-setup-guide.md` ~229-243 and `scripts/audit-stripe-billing.mjs` ~94-95.
    - `FEE_INVOICE_ALERTS_PLAN.md` is in the `plan-billing` board line's files. Tell that line its subject is retired;
      don't close a project yourself.
11. **Reviews before hand-off:**
    - `/accounting` (we stop invoicing and stop a tax kind).
    - `/legal`: the privacy policy published 2026-11-17 (~L48/174) names the club's monthly Stripe-fee invoice. Its new
      version is Stage 5. Confirm the gap is acceptable while payments are off in prod, and record it.
    - `/review` on the diff, and `/simplify` first if the cut leaves shared helpers half-used.

**Owner calls to carry:**
- **(a) Keep the billing-address step before payouts?** It is the open Stage 4 call. Recommendation: yes, because we still
  need the club's province for the GST/HST inside our fee (GST/HST Stage 5). If kept:
  - `requireBillingLocation` in the `connect` case of `app/api/admin/payouts/route.ts` (~235) stays.
  - The card's "address missing" line (~154-158) loses `clubFeeInvoicePlaceable`. Move the check it needs (does the org
    have a billing location?) somewhere that survives.
  - Its words (`online-payment-words.ts` ~100, "FieldLogicHQ needs it for the fee it charges", Stage 2) stay true, and
    `billing-location-every-path-guard` ~582-589 is re-pinned.
- **(b) Drop the tables or freeze them** (step 6). Recommendation: drop.
- **(c) The Sales by month column** (step 5).

**Not this stage:** the club's books recording Stripe's real fee (Stage 3, its prompt still to be written); payments terms
§4/§5, the privacy policy's new version, the help's fee-split rewrite and the close (Stage 5); the tax inside our fee
(GST/HST Stage 5).

**Process (repo rules):** stage explicit pathspecs only; commit only on the owner's word; the board line changes in the
same commit as the work; online payments stay off in production. Other sessions edit `MANUAL_PROD_STEPS.json`, the board
file and the snapshots at the same time, so commit only your hunks from them.
