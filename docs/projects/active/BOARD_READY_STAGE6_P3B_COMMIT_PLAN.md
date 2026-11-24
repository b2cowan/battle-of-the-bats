# Board Ready Stage 6 · Part 3b after the walk — the commit plan

Prepared 2026-11-24 by the session that built the after-walk fixes. **Nothing is committed.** Commit only at the owner's yes (memory:
no commit or push without his word); branch `dev`; never `master`. Four commits, in this order. Method: stage **explicit pathspecs only**
(never `git add -A` or `.`); after each commit run `git show --stat HEAD` and confirm only the files named below landed (a stray file →
`git reset --soft HEAD~1`, restore, redo). The record of what was built: `BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md`.

## Start conditions
1. `git rev-parse --abbrev-ref HEAD` is `dev`. `git status --short` still shows the files below (another session shares this working copy
   and has moved HEAD since this session began; re-read, do not trust this list blindly).
2. Gate, run once before the first commit: `npx tsc --noEmit -p .` clean; `node --import ./tests/ts-resolver.mjs --test
   tests/unit/board-ready-stage6-p3b.test.ts tests/unit/board-ready-stage6-p3a.test.ts tests/unit/board-ready-stage6-deals.test.ts
   tests/unit/online-payouts-list.test.ts tests/unit/bank-club-read.test.ts tests/unit/notification-facts.test.ts
   tests/unit/online-payments-guard.test.ts tests/unit/online-refund-block.test.ts` all pass; `npm run check:dictionary`;
   `npm run check:spelling`. Known red and NOT ours (do not chase): the chat-pause guard, the coach-portal stylesheet guard, the console
   foot-note guard, the pricing page guard, the Stripe form-profile test, `check:migrations` (530 to 534 are pending on production by
   design: it stays red until they are applied there).
3. A **clean-checkout typecheck before the last commit lands** (it caught a real break in Part 3a): a worktree at a short path on the new
   head (e.g. `/c/tmp/fsc3b`), `node_modules` as a junction, `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`; remove the
   junction with `cmd //c rmdir` BEFORE `git worktree remove`.
4. **No `Co-Authored-By` footer** (owner rule, memory `feedback_no_coauthored_by_line.md`; it overrides the default attribution).
   Messages say what the owner sees, house style "Board Ready Stage 6 Part 3b: …".

## NOT ours: never stage these (another session's work, in the same tree)
The club schedules project: `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx`, `components/admin/kit/club/PermitWindows.tsx`,
`components/admin/kit/club/Permits.module.css`, `components/admin/kit/club/schedules/*` (FairShares, NewScheduleWindow, Schedules.module.css,
GapsWindow), `lib/club-schedule-engine.ts`, `lib/club-schedule-view.ts`, `lib/club-schedule-words.ts`, `lib/club-schedule-gaps.ts`,
`tests/unit/club-schedule-*.test.ts`, `tests/unit/club-scheduler-screens-guard.test.ts`, `docs/projects/active/SCHEDULE_GAPS_*`,
`docs/projects/IDEAS_BACKLOG.md`, `scripts/lib/dome-practice-split.mjs`; the Milton demo scripts `scripts/lib/prospect-demo-rep.mjs`,
`scripts/prospect-demo.milton.config.mjs`; and the junk `.probe_dummy`, `debug.log`.

## Commit 1 · the database: migrations 531 to 534
Files: `supabase/migrations/531_a_sponsor_card_after_the_walk.sql`, `532_a_sponsor_card_dispute_is_booked.sql`,
`533_a_payment_that_holds_no_money.sql`, `534_a_won_dispute_after_paying_again.sql`; `supabase/migrations/MANUAL_PROD_STEPS.json` (only the
four new entries are in its diff); `docs/agents/db/DATA_DICTIONARY.md` (three column entries, the foreign-key note: all ours);
`docs/agents/db/schema-snapshots/` (DRIFT_dev_vs_prod.json, DRIFT_dev_vs_prod.md, SNAPSHOT_MANIFEST.json, schema-dump-columns-dev.json,
schema-dump-constraints-dev.json, schema_dumps.json: the diff is three new columns and one foreign key rule, nothing foreign);
`memory/reference_db_schema.md`.
Message: what changes for a club (a payment given back or lost to a dispute stops counting and the deal is owing again; a won dispute puts
it back and says what stands past the invoice; Withdraw and Revise work after a loss; a refund booked after a loss never ends the deal;
every refund on a taxed invoice carries a credit note; a stuck "not recorded" payment refunded in full from Stripe's dashboard stops
wedging its deal) and the production order: **applied to dev 2026-11-24; pending on production in this order, 530, 531, 532, 533, 534, before
the promote that ships the code** (the deal page reads `returned_at`).

## Commit 2 · the code, the words and the tests
Files (all ours unless marked ✱ = see "the walk-time tweaks"):
- `lib/`: `club-sponsor-invoice-pdf.ts`, `club-sponsor-invoice.ts`, `club-sponsorship-deal-words.ts` ✱, `club-sponsorship-deals-server.ts`,
  `help-content/house-league.tsx`, `help-content/platform-admin.tsx`, `help-content/tournaments.tsx`, `house-league-money-words.ts`,
  `league-pay-words.ts`, `needs-attention-words.ts`, `needs-attention.ts`, `notification-labels.ts`, `online-payment-landing.ts`,
  `online-payment-receipt.ts`, `online-payment-words.ts` ✱, `online-payouts-map.ts`, `online-payouts.ts`, `online-refund-block.ts`,
  `online-refund-email.ts`, `platform-online-payments.ts`, `public-form-throttle.ts`, `sponsor-card-server.ts`, `sponsor-deal-view.ts`,
  `sponsor-invoice-email.ts`; `lib/export/pdf.ts` ✱ (4 lines, walk-time).
- `app/`: `api/admin/sponsorships/deals/[dealId]/payments/[paymentId]/refund/route.ts`, `api/public/sponsorship/[token]/pay/route.ts`,
  `platform-admin/orgs/[id]/MoneyTab.tsx`; `[orgSlug]/admin/tournaments/registrations/components/OnlinePaymentWindows.tsx` ✱.
- `components/`: `admin/kit/club/sponsorships/DealPaymentWindows.tsx` ✱, `DealScreen.tsx` ✱, `Sponsorships.module.css` ✱,
  `public/SponsorDeal.module.css` ✱, `public/SponsorDealContent.tsx` ✱.
- `tests/unit/`: `board-ready-stage6-p3a.test.ts`, `board-ready-stage6-p3b.test.ts` (see the one line below), `notification-facts.test.ts`,
  `online-payments-guard.test.ts`, `online-payouts-list.test.ts`, `online-refund-block.test.ts`.
Message: what the club and the business now see (the Payouts tab names a sponsorship, the bank check clears it; a lost dispute is booked and
the deal owes again; a payment given back or taken back is marked; a bounced refund keeps its credit note, marked cancelled, and the
business is told; no Stripe code on any refund email; refund arrival time never promised as certain; the sponsor's page has its own
limits; the reviews' defects fixed). Say it was reviewed (`/simplify`, `/review` five lenses, `/marketing`, `/legal`, `/accounting` for the
dispute) and that **it needs 530 to 534 on production first**.

### The walk-time tweaks (✱): owner decision, recommended: ride along in Commit 2
Seven files, and four of them (`DealPaymentWindows.tsx`, `SponsorDealContent.tsx`, `club-sponsorship-deal-words.ts`,
`online-payment-words.ts`) hold BOTH this batch's hunks and the card walk's look-and-wording tweaks (the refund window's "Either way it goes
back to the card…" and "All of it" choice, the business's receipt downloads row, the partly-refunded chip, the sponsor download CSS, three
lines of `pdf.ts`). They are Part 3b's own screens, in the tree since the walk. **Recommended: stage those files whole in Commit 2 and say
so in its message** ("also carries the walk-time look and wording tweaks to the refund window and the receipt's download row"), as Part
3b's first commit carried the Milton updates. Splitting them hunk by hunk (the private-index method, memory
`reference_partial_commit_shared_tree.md`: a temporary index, exact edits, a CAS `update-ref`) is possible but buys a smaller diff only.
If the owner wants them out, say so before Commit 2 and the splitting is done on those four files.

### The one test line that moves to Commit 3
`tests/unit/board-ready-stage6-p3b.test.ts` line 340 pins `app/api/platform-admin/stripe-fees-daily/route.ts` (the daily job's new step).
Commit 2 must not fail it, so Commit 2 stages the test file WITHOUT that one `assert.match(readCode('app/api/platform-admin/stripe-fees-daily/route.ts'), …)`
line (a private-index version of the file), and Commit 3 adds it back.

## Commit 3 · the daily job's new step, on its own
Files: `app/api/platform-admin/stripe-fees-daily/route.ts` (an import and one step, `sponsor_refunds`, run before the Stripe-slow steps) plus
the one test line above. Message: **what behaviour changes: the daily online-payments job now also settles or retries a sponsor's card
refund stuck "on its way" for more than 15 minutes (it looks in Stripe first, so a refund is never doubled), and sends again a correction
email that failed. It adds no schedule; it runs inside the existing daily job.** Not on the watched list (`WATCHED_PATHS`), but kept
separate so it can be reverted alone.

## Commit 4 · the records
Files: `docs/projects/active/OWNER_QA_LEDGER.md` (the §564 result and the new §565; append only, never sort the § numbers; the file is
mixed line endings: stage it as it is, no normalising), `BOARD_READY_STAGE6_P3B_AFTER_WALK_WALK.html`, `BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md`,
`BOARD_READY_STAGE6_P3B_PAYOUTS_BANK_CHECK_PLAN.md`, `BOARD_READY_STAGE6_P3B_PAYOUTS_BANK_CHECK_PM_BRIEF.md`,
`BOARD_READY_STAGE6_P3B_COMMIT_PLAN.md` (this file), `docs/agents/accounting/ACCOUNTING_INDEX.md`, `docs/agents/accounting/CLUB_SPONSOR_INVOICE_REVIEW.md`,
`docs/agents/legal/BOARD_READY_STAGE6_PART3B_CARD_REVIEW.md`, `docs/agents/legal/LEGAL_INDEX.md`,
`docs/agents/legal/drafts/PAYMENTS_TERMS_SPONSORSHIP_CARD_ADDENDUM.md`. Plus, **in the same commit (rule: a session that moves a project
changes its board line in the same commit)**, two small edits made at commit time with the three hashes in hand (positive facts, never
"uncommitted"): the Part 3b bullet in `docs/projects/active/BOARD_READY_PLAN.md` ("after-walk fixes COMMITTED `<hash 1>`, `<hash 2>`,
`<hash 3>`; walk §565 owed; production waits on migrations 530 to 534") and the `board-ready` line in
`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` (add, to its stage or next text: "Stage 6 sponsorships: the card, refunds and disputes are
built and committed; the owner's walk §565 and production migrations 530 to 534 come before the switch goes on for a real club").

## After the commits (not commits)
- Production: apply 530, 531, 532, 533, 534 in that order with `scripts/apply-migration-api.mjs --prod` (only at the owner's word, per the
  release rules; `/release` runs it), then refresh snapshots, then the promote. `ONLINE_PAYMENTS_ENABLED` stays off until the owner turns it on.
- Walk §565 is the owner's; a failing step may add a defect (record it in the after-walk document).
- Still open, by the owner's calls: the dashboard-refund half of fix 8 (a small plan of its own); the three rare SQL cases still logged in the
  after-walk document (a lost-dispute payment in the refund window's SQL forecast, a never-recorded payment refunded for less than the invoice total, a refund stuck for good with no notice); `/ux` at 390 on the sponsor page (owed since the finish prompt); and the older `/design` look of the new "Taken back" chip.
