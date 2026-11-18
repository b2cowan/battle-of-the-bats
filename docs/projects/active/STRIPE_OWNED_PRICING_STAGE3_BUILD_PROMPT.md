# Stripe-owned pricing, Stage 3: the club's books match what Stripe really takes. Build prompt

Paste this into a fresh session. Written 2026-11-18 by the Stage 5 session (Stage 5's part before Stage 3 committed
`9b0a05c1b`; Stage 4 `6dc9c6119`; Stage 2 `142ef12d6`). A read-only code census was run for this prompt the same day.
Its findings are below, and **they correct the plan's premise**, so read "What the census found" before you plan.

---

You are building **Stage 3 of Stripe-owned pricing**. The plan of record is
`docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md`: "Stage 3", Stage 2's "Left for Stage 3", and the Stage 3 help and
words list Stage 5 left there. The PM brief sits beside it. The board project is `payments`
(`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`), and status lives on the board.

**The model (built, do not reopen):**
- Every club account is `fees_collector: 'stripe'` + `losses_collector: 'stripe'`.
- Stripe takes its own processing fee from the club's balance on every payment, whoever pays the processing fee, and
  keeps it on a refund.
- Our application fee is the family-facing processing fee less Stripe's standard Canadian cost (rate design A,
  `lib/online-payment-fee.ts`). It is stored per payment (`online_payments.application_fee_amount`, mig 498).
- We bill clubs nothing else (Stage 4).
- Payments terms v0.2 (owner-approved 2026-11-18, `docs/agents/legal/drafts/PAYMENTS_TERMS.md` §4–§7) say:
  - the processing fee is Stripe's part plus ours;
  - neither part comes back on a refund or a lost dispute;
  - our fee comes back on a returned debit;
  - Stripe's extras come off the club's balance.

Online payments are off in production. Nothing here reaches a customer without the owner's yes.

## What the census found (2026-11-18; verify each before you rely on it)

The function bodies live only in migrations. The census used the latest definitions.

1. **The books already record the whole processing fee.** Landing a payment (`lib/online-payment-landing.ts`
   `landCheckoutSession` → SQL `online_payment_land`, mig 390:169-173; league `online_payment_league_land`, mig
   388:104-109):
   - It posts one "Payment processing · …" cost for the WHOLE `fee_amount`, only when the club pays the fee.
   - That fee is Stripe's standard cost plus our fee. When families pay, nothing is booked.
   - **For a domestic card or bank debit both modes are already exact:**
     - Club pays: payout = base − fee = the books.
     - Family pays: payout = base = the books.
   - **So "book Stripe's real fee on every payment" (the plan's wording) would double-count** in club-pays mode, and add
     a line that nets to nothing in family-pays mode. Do not build it as worded.
2. **What is actually off:**
   - **(a) Stripe's extras on a payment are unbooked.** A foreign card is +0.8% and a currency conversion +2% (Stripe's
     page, 2026-11-18). This holds in both modes. The club's books overstate the cash, and the bank check's "on its way"
     (`lib/bank-club-map.ts:236-271`) is off by the same amount.
   - **(b) A returned bank debit leaves the books one fee low** when the club pays the fee:
     - `online_payment_reverse` (mig 391:110-183) posts "Returned by the bank" for the base. It never reverses the
       landing's cost line (`processing_cost_entry_id` is untouched).
     - But Stripe returns its fee and our fee is auto-refunded (Stage 1 probe: the club nets $0).
     - This is a defect today, independent of the model.
   - **(c) Dispute fees are stored, not booked.** `online_payment_disputes.stripe_fee` exists (`lib/online-payment-dispute.ts:66`).
     No book line is written for it.
   - **(d) The Payouts tab labels the old model:**
     - `lib/online-payouts-map.ts:118, :223-225`: "Processing fee returned" is an `adjustment` with reporting category
       `fee`. It meant our fee given back under `application` accounts.
     - On a `stripe` account a returned debit shows as `payment_failure_refund` carrying Stripe's fee returned.
     - Our fee comes back as `application_fee_refund`. If it lands on the club's balance as its own line it would fall to
       `notOurs` (`:240-241`). **Unverified: probe it in test mode first.**
     - "Stripe fee" (`:122`) is the `stripe_fee` balance transaction (a dispute fee in practice).
3. **Stripe's real fee is readable but read nowhere today.**
   - The landing re-reads the session with `expand: ['payment_intent.latest_charge']` (`lib/stripe-connect.ts:188-193`).
     Adding `.balance_transaction` is three levels, within Stripe's limit.
   - The charge's balance-transaction `fee` is the SUM of `fee_details` `stripe_fee` and `application_fee` (probe: $3.35 +
     $1.65). **Stripe's real cost is the `stripe_fee` detail only, never `fee`.**
   - No column stores it (dev snapshot: `online_payments` has `fee_amount, fee_pct, fee_flat, application_fee_amount`).
   - A bank debit's fee is known when it clears, which is when it lands.
4. **Refunds:**
   - Full team refund (`online_payment_refund_land`, mig 382:446-495) and league refund (`online_payment_league_refund_book`,
     mig 382 ~1038) post "Refunds" plus, when the family paid the fee and the organizer gave it back, "Payment processing ·
     Processing fee refunded · …" for `fee_refunded`.
   - Part refunds never include the fee (mig 391:41-105).
   - Club-pays refunds are exact (Stripe keeps its fee, and the landing's line stays).
   - **Double-count trap:** if you ever book Stripe's fee at landing in family-pays mode, the "fee given back" line
     books it again.
5. **Old dev accounts** (`application`; dev only; production has no online payments):
   - The platform paid Stripe on those, so a Stripe fee booked on them would be wrong.
   - Leave any new column NULL there ("not ours / unknown"). No backfill.
   - **UAT Rep Club's old account runs the full payout test on or after 2026-11-25** (owner, "split the pass"). Nothing
     here may change how its Payouts tab or books read those payments.
6. **What a change touches:**
   - **The landing:** `LAND_RPCS` and the only-the-landing-module-calls-them guard (`tests/unit/online-payments-guard.test.ts:32-68`).
   - **`online_payments_guard`** (mig 390:73+, extended by 498): a new column must be allowed or frozen on purpose.
   - **Schema records:** the data dictionary, plus `npm run refresh:snapshots`.
   - **Seed teardown:** `scripts/seed-stripe-walk-tournament.mjs:234-250` (it deletes cost entries by id).
   - **The house-league Money page's prefix parsing:** `app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx:134-139`
     matches `"Payment processing · "` and `"Processing fee refunded · "`, so a new line needs a recognised prefix.
   - **House-league money words:** `lib/house-league-money-words.ts:488, 490, 745, 785, 852-853`.
   - **A stale comment:** `landing.ts:254` ("Part 4 bills Stripe's extra cost").
   - **Tests and check scripts:** `online-payouts-list`, `bank-debit-desk`, `online-refund-block`, `house-league-money-guard`,
     `bank-check*`, `online-payments-*`, and the scripts `online-payments-12c-check.sql`, `12d1-check.sql`,
     `house-league-money-check.sql`, `stripe-owned-pricing-498-check.sql`.
   - **Untouched:** the demo seeds (none seed online payments), the accountant export (by category) and the coach side.

## First: the owner rules the shape (an owner call, before the plan)

Put this to the owner in plain words, with your recommendation, and wait for his ruling:

- **A (recommended): fix only what is off.**
  - Keep the one "Payment processing" line exactly as it is.
  - Store Stripe's real fee per payment (`stripe_fee` detail).
  - When it exceeds Stripe's standard cost (`stripeCostCents`), book the difference as its own cost line, "Stripe's
    extra · …", in either payer mode.
  - Book a dispute's fees as a cost when Stripe takes them.
  - Reverse the processing cost (and the extra) on a returned debit.
  - Result: 99% of payments read exactly as today, and the books meet the bank on the rest.
- **B: split every payment's fee.** Book "Stripe's fee" (real) and "FieldLogicHQ's fee" as two costs on every payment.
  In family-pays mode, also book the fee the family paid as income.
  - It is fully transparent, but doubles the cost lines.
  - It changes every Money page and Budget-vs-Actual figure.
  - It also needs the family-pays refund lines rethought.

Also ask:
- whether dispute fees belong in the club's books at all (recommend yes: it is money that left the club's balance);
- the line wording (route it to `/marketing`; one spelling, `check:spelling`).

## Do, in order (plan first; give the PM UX summary before any code)

1. **Probe in test mode first** (`.probe/`, test key only; a `stripe` account like the Stage 1 probe's):
   - A domestic card and a foreign card (read `fee_details`).
   - A bank debit that clears and one that is returned: which balance transactions appear on the CLUB's balance, and
     whether `application_fee_refund` lands there.
   - A dispute fee.
   - Record the results in the plan.
2. **The column and the landing:**
   - A migration for Stripe's real fee per payment (and, under A, the extra line's entry id), via `/db`.
   - Update the data dictionary and refresh the snapshots.
   - The guard allows the writes only from the land/reverse functions.
   - Read the fee at landing. If the balance transaction is not ready, leave it NULL and catch it up later: the webhook
     on a later event, or the daily job. Never block the landing on it.
   - Old-account rows stay NULL.
   - The production migration goes in `MANUAL_PROD_STEPS.json` as pending, applied WITH the promote.
3. **The books** (per the ruling):
   - the extra line;
   - the returned-debit reversal (also fix (b) for the existing cost line);
   - the dispute fee line (if ruled);
   - the same for tournaments and house league;
   - the Money page prefixes.
4. **The Payouts tab and the bank check:**
   - Map the new-model balance transactions from the probe.
   - Relabel "Processing fee returned".
   - "On its way" nets to the payout on a foreign card and a returned debit.
   - Do not break the old-account read UAT Rep Club's payout test depends on.
5. **Words and help, with `/docs`,** from the plan's Stage 3 list, which Stage 5 left there:
   - `online-payments-fee` "Where it shows in your books";
   - the refund sentences ending "shows in your books as Payment processing";
   - `registrations-refund-card`;
   - `accounting.tsx` `payouts-tab-inside` (~848, ~850), ~112 and ~833;
   - `record.choiceHint.club`;
   - the refund window's `feeOnWhy` / `feeOnChanged` and the stale comment above them ("never 'Stripe keeps part of
     it'": under Stripe-owned pricing Stripe DOES keep its part);
   - the house-league money words.

   Rules: no dead anchors; `keywords` / `searchText` / `answerText` in the same pass; `check:spelling`.
6. **Tests:**
   - Unit tests for the landing (card domestic and foreign, debit cleared and returned, both payer modes), the
     returned-debit reversal, the double-count trap, the Payouts map, the bank check and the guard.
   - Extend the SQL check scripts.
7. **The record:**
   - The plan's Stage 3 marked Built, with what you found.
   - The PM brief and the board line in the same commit as the work.
   - `/strategy` drift check only if a rate or figure in the Facts doc moves (it should not).
8. **Reviews before hand-off:**
   - `/accounting`: it changes what the club's books record.
   - `/review`: substantive (a migration, the landing, money).
   - `/simplify` if a new shared helper appears.
   - `/legal`: only if a sentence a club reads about its money changes meaning against terms v0.2 §4–§7.
9. **Then the close for the whole project (Stage 5's step 6),** if context allows. Otherwise write its prompt:
   - The owner walk for Stages 2 to 5 as a checkable Artifact under the walk rules: 20 to 50 boxes, one action per step,
     one purpose.
   - It needs the dev clubs re-created on Stripe-owned accounts. `milton-bats` and `dev-club-org` can be re-created at
     any time; UAT Rep Club only after the payout test's payout steps.
   - Record the walk in the QA ledger.
   - The owner's word closes the project. Do not archive the plan before it.

**Owner calls to carry:**
- **(a)** The shape: A or B.
- **(b)** Dispute fees in the books.
- **(c)** The new line's wording.
- The default payer setting stays "Teams pay it" until the owner rules before switch-on (O5, 2026-11-18). Not this stage.

**Not this stage:**
- GST/HST Stage 5 (the tax inside our fee, recorded per paid fee, and the fee statement).
- Publishing the terms or the privacy version.
- Switching payments on.
- The payout test itself (on or after 2026-11-25).
- Any change to the rates.

**Process (repo rules):**
- Stage explicit pathspecs only. Commit only on the owner's word.
- The board line changes in the same commit as the work.
- Online payments stay off in production. A production read needs the owner's yes in that session.
- Other sessions edit `MANUAL_PROD_STEPS.json`, the board file, the QA ledger, `LEGAL_INDEX.md` and the snapshots at the
  same time, so commit only your hunks from them.
- Restart the dev server before hand-off (new files, a shared module, a migration).
