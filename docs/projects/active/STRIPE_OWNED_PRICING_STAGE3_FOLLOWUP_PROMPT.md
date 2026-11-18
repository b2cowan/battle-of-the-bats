# Stripe-owned pricing, Stage 3 follow-up: words, help, terms, reviews. Build prompt

Paste this into a fresh session. Written 2026-11-18 by the Stage 3 session, which built the code half on dev
(uncommitted until the owner's word; see "Commit" below). The plan of record is
`docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md`, Stage 3: read **"Owner rulings"** (a)–(f), **"Stage 3 probe
results"** and **"Built on dev 2026-11-18"** first. They are the facts; this prompt only lists what is left.

## What is built (do not rebuild)
- Mig 501 on dev. Stripe's fee per payment, "Stripe’s extra · …", "Dispute fee · receipt N", "Returned debit fee · …"
  and ruling (f)'s family-paid "Payment processing · …" at a reversal. All of it applies to Stripe-owned accounts only.
- Landing, webhook (`bookDisputeFee`), daily job steps `stripe_fee_catch_up` and `standalone_stripe_fees`.
- Payouts map entry links; the `fee_back` label is now "FieldLogicHQ’s fee returned".
- The house-league Money page names the new lines.
- Checks: `scripts/stripe-owned-pricing-501-check.sql`, `tests/unit/online-payment-stripe-fees.test.ts`, the
  `bank-club-read` Stage 3 case.

## Do, in order (give the PM UX summary before code)

1. **`/legal`: narrow terms v0.2** (`docs/agents/legal/drafts/PAYMENTS_TERMS.md` §4 "The one exception" and §7 "If a
   bank debit is returned unpaid"), per ruling (e):
   - Our fee comes back when a debit fails before it clears.
   - A debit returned after it clears is handled as a dispute: neither part comes back, and Stripe's $5 comes off the
     balance.
   - Update the returned-debit NOTE: the probe now shows the $5 failure fee, billed later.
   - The terms are unpublished; the owner approved v0.2 on 2026-11-18. Show him the changed sentences before
     calling it done.
2. **Words, with `/marketing`** (one spelling; `check:spelling`):
   - The four book texts (mig 501).
   - The Money words `processingExtra` / `processingDisputeFee` / `processingFailureFee`
     (`lib/house-league-money-words.ts`).
   - `PAYOUT_LINE_WORDS.feeBack` ("FieldLogicHQ’s fee returned").
   - A word for an unmatched stand-alone fee in the bank check.
   - A book text changes in SQL: correct it with a NEW migration if 501 has reached prod; else edit 501, re-apply on dev,
     and keep `STAGE3_LINE_PREFIX` matching (its test checks this).
3. **The bank check names an unmatched stand-alone Stripe fee "to record by hand".**
   - Rows in `online_payment_stripe_fee_lines` with `entry_id IS NULL` (`unmatched_reason`).
   - Read `lib/bank-club-read.ts` / `bank-club-map.ts` and the bank check screen first. The reader may only select
     (`bank-club-read.test.ts` rule 6).
4. **Help and words, with `/docs`.** These are the plan's "Stage 3's help and words" list:
   - `online-payments-fee` "Where it shows in your books".
   - The refund sentences.
   - `registrations-refund-card`.
   - `accounting.tsx` `payouts-tab-inside`: ~849 still says "Processing fee returned". Also ~112 and ~833.
   - `record.choiceHint.club`.
   - `feeOnWhy` / `feeOnChanged` and their stale comment.
   - The house-league money words.

   Rules: no dead anchors; `keywords` / `searchText` / `answerText` in the same pass.
5. **Loose ends:**
   - **Seed teardown.** `scripts/seed-stripe-walk-tournament.mjs:234-250` deletes cost entries by id. The three new
     `online_payments` entry FKs have no ON DELETE, so clear or delete in an order that works.
   - **Countered fee returned on a win.** It was unseen on 2026-11-18. Re-read the probe account's lines with
     `node .probe/s3/bt-list.cjs`. If a credit such as "Countered Fee Refund" appeared, teach `standaloneFeeOf` and
     `online_payment_stripe_fee_line_take` to book it against its dispute. That needs a money-back line: the house-league
     Money page shows every `online_payment` line as a cost (`seasonProcessingLines`), so mind the sign.
   - **The house-league ledger route's sign.** `app/api/admin/house-league/seasons/[seasonId]/ledger/route.ts`
     `seasonProcessingLines` takes every `online_payment` line as a cost. That holds today, because every Stage 3 line is
     an expense.
6. **Reviews before hand-off:**
   - `/accounting`: it changes what the club's books record.
   - `/review`: mig 501, the landing, the daily job, the Payouts map.
   - `/simplify` (a new shared module, `lib/online-payment-stripe-fees.ts`).
7. **Then Stage 5's close:** the owner walk for Stages 2–5 as a checkable Artifact (20–50 boxes, one action per step).
   - It needs dev clubs re-created on Stripe-owned accounts. `milton-bats` and `dev-club-org` can be re-created now;
     UAT Rep Club only after its payout test's payout steps (on or after 2026-11-25).
   - Record the walk in the QA ledger.
   - The owner's word closes the project.

## Commit (owner's word only; explicit pathspecs; other sessions share these files)

The Stage 3 session's files, if not yet committed:
- `supabase/migrations/501_the_books_meet_what_stripe_takes.sql`
- `lib/online-payment-stripe-fees.ts`
- `lib/online-payment-landing.ts`
- `lib/stripe-connect.ts`
- `lib/online-payouts.ts`
- `lib/online-payouts-map.ts`
- `lib/house-league-money-words.ts`
- `app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx` (only the Stage 3 hunks: the import and
  `processingWhat`)
- `app/api/payments/connect-webhook/route.ts`
- `scripts/stripe-owned-pricing-501-check.sql`
- the tests `online-payment-stripe-fees`, `bank-club-read`, `online-payouts-list`, `online-payments-guard`
- the plan and the PM brief
- the dictionary hunks, the snapshots, `MANUAL_PROD_STEPS.json` (only the 501 entry), and the board line

`app/api/platform-admin/stripe-fees-daily/route.ts` (two new daily steps, owner ruling (d)) runs by itself, so it goes
in its OWN commit, whose message says the daily job gains the fee catch-up and the stand-alone fee matching.

Restart the dev server before any browser test: new files and a shared module.

**Not this stage:** GST/HST Stage 5; publishing the terms; switching payments on; the payout test itself; any rate.
