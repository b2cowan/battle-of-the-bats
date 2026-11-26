# Board Ready Stage 6 fixes, Part A: finish it (reviews, probe, walk, commit)

> **Done 2026-11-26:** the reviews, `/dba` (542 revised and applied to dev), `/marketing`, `/legal` with `/accounting`,
> `/ux` at 390, `/docs`, a live test on Dev Club Org (API refunds standing in for the dashboard click) and walk §576
> (https://claude.ai/artifact/WoaUgqxo7PhCAPxnsTHQu8). The record, rulings and follow-ups: `BOARD_READY_PLAN.md` §5
> Stage 6 (Part A). The text below is the prompt as written before that work.

Written 2026-11-26 at the end of the build session. Part A is BUILT on dev and NOT committed. This prompt carries it from the
build to the commit. The ruled drawing is https://claude.ai/artifact/59e8zBT9RYsFGFPzwJ4kZX (all seven asks A, 2026-11-25).
The original build prompt, `BOARD_READY_STAGE6_FIXES_BUILD_PROMPT.md`, still binds: its start conditions and traps. Part B
there is a separate piece of work, not this one.

## ⛔ Start conditions
1. Branch `dev`. Other sessions have a lot of uncommitted work in the same files and folders. Commit only Part A's lines,
   through a private index (memory `reference_partial_commit_shared_tree.md`). Explicit pathspecs only. Run `git show --stat
   HEAD` after every commit.
2. **The code wins.** Every fact here was read on 2026-11-26. Re-check the lines you touch and say so where this prompt is wrong.
3. **Each of these needs the owner's yes in this chat:** a database change, a dev data change (seeding the walk included),
   and the commit. Another chat's yes does not count.
4. **Production:** AI sessions read production only as counts and schema, never rows. Migrations 530–534 and now 542 are
   pending on production and go with the promote. Not here.
5. No Co-Authored-By footer. Talk to the owner in product-owner words: what the club sees, not file names.
6. **Numbers move.** At writing, the next free ledger entry is §574 or later (§573 exists). Check it when you write the walk.
   Migration 542 is ours; 543–546 belong to other sessions.

## What is built (read the code, not this list, before you judge it)
- **Migration 542** (`supabase/migrations/542_a_refund_made_in_stripe.sql`) is applied to dev and was revised after
  `/simplify`: the fee line's column is `fee_refund_entry_id`, and §8 rebuilds mig 403's three notice indexes for two new
  Needs-attention kinds, `sponsor_refund_to_finish` and `sponsor_refund_twice`, keyed on `sponsorRefundId`. Dev was brought in
  line by `.probe/fixes-a-542b-build.cjs` (rename, then re-run the revised 542). The rolled-back case run is
  `.probe/fixes-a-542-cases.sql` (built by `.probe/fixes-a-542-build.cjs`; it still names the old column, so update it before
  re-running). Queries on dev: `node .probe/fixes-a-q.mjs <file.sql>` (it is hard-coded to the dev project).
- **The landing** (`lib/online-payment-landing.ts`): `applySponsorRefundEvent` settles only `origin 'app'` rows, then calls
  `recordStripeSponsorRefund` (the RPC `club_sponsor_card_stripe_refund`). `raiseStripeSponsorRefundNotice` raises the two new
  kinds. `finishStripeSponsorRefund` does the finish. `catchUpStripeSponsorRefunds({ write })` is the A5 catch-up. In
  `applyRefundEvent`, a refund on a payment we don't know yet asks Stripe whether it is a sponsor's (`isSponsorshipIntent`)
  before raising the family-worded notice. In `afterSponsorDispute`, a won dispute calls `club_sponsor_card_twice_settle`.
  `sweepStuckSponsorRefunds` has `.eq('origin', 'app')`.
- **The finish button's server side:** `app/api/admin/sponsorships/deals/[dealId]/refunds/[refundId]/finish/route.ts`.
  It is untracked. It is exempt from the launch switch (tests/unit/online-payments-guard.test.ts `AFTER_THE_MONEY`); the owner
  was told, and no ruling was asked.
- **Screens:** `components/admin/kit/club/sponsorships/DealScreen.tsx` (the callout, history, the finish question's mount) and
  `DealPaymentWindows.tsx` (the row chip, the refund block, `FinishRefundQuestion`, `QuestionError`).
- **Sums and paper:** `lib/club-sponsor-invoice.ts` (`DealRefund` gains the Stripe fields; `reason` and `createdByName` are
  `string | null`; `refundParts`, `refundToFinish`, `refundReturnedTwice`, `refundMadeOn`, `finishAsksOutcome`,
  `nextCreditNumber`; the credit note's fee rows and its `credit_on` date).
- **Other files:**
  - `lib/club-sponsorship-deals-server.ts`: the refund read, and Offer again's `givenBackInStripe`.
  - `lib/sponsor-invoice-email.ts`: the email waits for the finish and says when the fee went back.
  - `lib/needs-attention.ts` and `lib/needs-attention-words.ts`: the resolvers.
  - `lib/notification-labels.ts` and `lib/types.ts`: the two new kinds.
  - `lib/online-payouts.ts`: the fee line on Payouts.
  - `lib/stripe-connect.ts`: `retrievePaymentIntentMetadata`.
  - `lib/club-sponsorships-words.ts`: the Payouts hint.
- **The catch-up:** `scripts/catch-up-stripe-sponsor-refunds.mjs` (loads the app through jiti; `scripts/lib/server-only-stub.cjs`).
  It was run on dev: it found one old notice, which is not a sponsor's, and recorded nothing. Production has 0 open notices of
  that kind (a count).
- **Docs already written:**
  - `/accounting`'s addendum in `docs/agents/accounting/CLUB_SPONSOR_INVOICE_REVIEW.md` and its index row.
  - `docs/agents/db/DATA_DICTIONARY.md`: the refunds table and the notifications indexes.
  - Lines under "Four fixes before sponsor card payments go live" in `docs/projects/active/BOARD_READY_PLAN.md`.
  - The schema snapshots, refreshed after the dev apply.
- **The probe of FieldLogicHQ's fee:** `.probe/fixes-a-appfee-refund.cjs`. A club-side refund returns none of the
  application fee.
- **Tests:**
  - New Part A cases at the end of `tests/unit/board-ready-stage6-p3b.test.ts`.
  - Edited: `online-payments-guard`, `online-payouts-list`, `needs-attention-clears-itself` (28 kinds; it now reads 542).
  - `house-league-money-guard` is back as it was.
  - The refund and notice tests pass (595).
  - The full suite had about 42 failures, none in Part A's files; they are other sessions' work in progress.
- **Words:** every new word is a DRAFT. The Part A block at the end of `DEAL_WORDS.card` in
  `lib/club-sponsorship-deal-words.ts`, three lines in `needs-attention-words.ts`, the two kinds in `notification-labels.ts`,
  `refundHint`, and the credit note's closing sentence in `creditNoteLayout`.

## Run in this order
1. **`/review`, high-risk money.** Scope: Part A's files only (above). The two traps that must hold:
   - The daily retry never asks Stripe about an `origin 'stripe'` refund.
   - The UUID guard on refund metadata stays.
   Also check:
   - The refund that bounces after it was finished.
   - Pending then failed.
   - A refund before the payment landed (the landing's `reconcileDashboardRefunds`).
   - After a lost dispute, then a win.
   - "What happens to the deal" on the last money, compared with the database's `v_last`, which also requires
     `dispute_lost_at IS NULL`; the screen can't see that.
   - Offer again.
   Fix what it confirms. Re-run the tests.
2. **`/dba` on migration 542.** Lock order deal → payment → refund; SECURITY DEFINER and grants (the lines function is
   revoked from service_role too); the CHECK; the fiscal-year lock on relabelling; re-runnability; the §8 index rebuild. A fix
   to 542 is a database change: get the yes, then bring dev in line the way `.probe/fixes-a-542b-build.cjs` does, after a
   rolled-back run.
3. **`/marketing`** on every DRAFT word above, against the drawing's tab 7. One spelling everywhere (`npm run check:spelling`).
4. **`/legal`.** It is required, because Part A changes what a business is emailed and the credit note it receives (fee rows,
   issued date, "It includes the processing fee you paid on it"). If `/legal` or `/review` changes the credit note or the
   email, re-check with `/accounting` (its 2026-11-25 addendum).
5. **`/ux` at 390.** It is in the ruled order, though the owner's list for this session did not name it. Ask before skipping it.
   Check the callout, the row chip, the refund block, and the finish question as a centred card that rises above the keyboard.
6. **`/docs`.** Help in `lib/help-content/org.tsx`: "Refunded in Stripe itself?" (~2376), the refund terms (~2489–2493) and
   the FAQs (~2530). They still say to record it in the Ledger; they should say it records itself and is finished on the deal.
7. **The probe: a real dashboard refund.**
   - On Dev Club Org's test account (`acct_1UdEKYFuSujtPESp`, Express dashboard): a sponsor pays a dev deal by test card
     through its link.
   - The owner (or you, if a login link allows) presses Refund in that account's Stripe dashboard.
   - Read what landed: the refund row, its lines, the notice. Then finish it on the deal and read the credit note and email.
   - Find out first how dev receives Connect webhooks (a Stripe CLI forward, or staging); say if it can't.
   - The caveat to settle: whether an Express account can refund in its dashboard at all depends on a platform setting. If it
     can't, the help and the Payouts hint change (they tell the club to refund there).
   - The probe's dev data needs the owner's yes.
8. **The QA walk.**
   - A checkable Artifact, 20–50 boxes, one action per step, house walk format. Owner calls are never in the counter.
   - Login: `uat-club-owner@uat-rep-club.local` / `UATPassword2026!` (UAT Rep Club). Dev data only.
   - Seeding (a deal with a card payment refunded in Stripe, part and whole, one with the fee back) needs the owner's yes.
   - Restart the dev server before handing it over: new files, shared modules.
   - Cover: the callout and chip, the window, both finish questions, the credit note and email, a pending refund, Offer
     again, the notice clearing itself, the phone at 390.
   - Write the ledger entry under the next free § number.
9. **The commit, only at the owner's yes.**
   - Put the daily retry's guard (the `.eq('origin', 'app')` line in `sweepStuckSponsorRefunds`) in its own commit (build
     prompt trap 5), and say what behaviour it keeps.
   - In the same commit as the work, record the part in plan §5 Stage 6, in `BOARD_READY_PROMPTS_INDEX.md` and on the
     board's Board Ready line (`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`). Positive facts with anchors only.
   - Commit the refreshed schema snapshots with 542.
   - Leave the `.probe/` files out.

## Open with the owner
- A stray family-worded "refund made in Stripe" notice on Dev Club Org, from the fee probe. Clear it with Done, or keep it as
  a catch-up sample. He has not answered.
