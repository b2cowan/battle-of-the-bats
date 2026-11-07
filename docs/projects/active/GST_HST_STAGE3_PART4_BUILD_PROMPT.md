# GST/HST Stage 3 · Part 4 build prompt (revenue before tax)

GST/HST Stage 3 Part 4 ("the before-tax band") is the next build. Parts 1, 2, 3a and 3b are committed (3b is `8adbb0549`).
Build Part 4 only. Do not start Part 5 (the owner walk and closeout) or Stage 4. Recommended model: Opus (money figures, a shared band,
the Story). No migration: the record tables are only read.

Mark each fact [V] (you opened it, file:line) or [H] (handed to you). Line numbers drift: re-open before relying on one.

## Read first (in this order)
1. docs/projects/active/GST_HST_STAGE3_BUILD_PROMPT.md: the "Part 4, revenue before tax" paragraph (about line 128) and ▶ Progress, entries
   "Part 2 RULED" and "Part 2 BUILT" (the band words the owner already ruled) through "Part 3b BUILT" and the "Part 3 /accounting" entry.
2. The drawings, docs/projects/active/GST_HST_STAGE3_PART2_DRAWINGS.html (https://claude.ai/artifact/NwkZe2YiwiN7Ydua9JVntA): tab 1 (the
   "after" frame, the cell marked "RESTYLED · Part 4") and tab 4 "after" (Stripe unreachable). Every label and note comes from there.
3. memory/design_decisions.md 2026-11-06 "The club record's Money tab lists sales, not charges" (the gap rulings, esp. gap 2: the unreachable band).
4. docs/agents/accounting/GST_HST_RETURN_LINES.md and CREDIT_NOTES_ON_REFUNDS.md (a reduction counts in the period the credit note is issued).
5. The code you change [re-open each]:
   - lib/console-money.ts `moneyBand` :483-497 [V]. "Paid, last 12 months" sums succeeded `c.amountCents`; "Refunded" sums `r.amountCents`. Both
     are STRIPE'S tax-inclusive amounts [V]. The Stripe-read `MoneyCharge`/`MoneyInvoice` types carry no before-tax figure [H].
   - lib/console-money-sales.ts `recordMoneyBand` :342-357 [V]. Sums `total_cents` and `refunded_cents` (tax-inclusive); its test is
     tests/unit/console-money-sales.test.ts :265-269 and pins `$200.02` [H]. The record has `amount_before_tax_cents`, `tax_total_cents`,
     `cad_amount_before_tax_cents` [V charge-tax-record.ts:214]; `platform_credit_note_tax_records` has `amount_before_tax_cents`, `tax_total_cents`,
     `issued_at`, `status` (`SALE_NOTE_COLUMNS` console-money-sales.ts:48).
   - app/platform-admin/orgs/[id]/MoneyTab.tsx: which band shows when (`read ? moneyBand(...) : unreachable && recordsRead ? recordMoneyBand(rows) : null`)
     and the reads in lib/console-money-sales-store.ts (`readSaleRecords` returns notes only for the sales in the window).
   - lib/platform-metrics.ts :241, :260, :307-308 [V]: `estimatedMrr` += `PLAN_CONFIG[plan].monthlyPrice` for active orgs; `estimatedArr` = MRR x 12. It reads
     LIST PRICES from lib/plan-config.ts and no Stripe amount at all [H], so it is already before tax. Shown at app/platform-admin/business-numbers/page.tsx
     :87-88 and app/platform-admin/page.tsx :152 as "about $X a month at list price" [V]. The plan's words "MRR/ARR line" mean these two.
     (ARR is MRR x 12 even for annual-billed orgs: not a tax matter; leave it, mention it in the hand-off.)
   - The Story: lib/console-money-story.ts uses Stripe charge/refund amounts (tax-inclusive) [H]; lib/platform-story.ts :377-383 builds "Refunded $X (console)" from
     `platform_refunds.amount_cents` with the sub-line "credit note CN-... / no credit note" [V]; the `refund_charge` audit value already carries `before_tax_cents`
     for an invoice charge [V console-money-stripe.ts:535]; disputes (platform-story.ts :78-85) carry Stripe's `charge.amount`/`dispute.amount` [H].
   - Help text that names the band: lib/help-content/platform-admin.tsx :267 [V].

## What the drawings and the plan say (build exactly this)
- The paid figure is **before tax, read from our record**, and its label says so: **"Paid, last 12 months, before tax"** (drawn). Notes as drawn:
  Stripe read "4 paid sales since Nov 6, 2025"; Stripe unreachable "... · our record" (the shipped words already).
- **Refunded** (drawn): "a refund with no credit note has no tax split, so the Refunded cell keeps the amount refunded and says why it is not split":
  "1 refund, Oct 9 · no credit note, so no tax split". **Next charge** is Stripe's quote: it keeps its total and "includes $11.51 tax". The subscription, the
  fees panel and the families line do not change.
- Source order from the plan: the stored record first; fall back to Stripe's pre-tax amounts; **never "total minus guesswork"**.
- Business numbers: say "before tax" on the MRR/ARR line, and add a **guard test** that no figure in lib/platform-metrics.ts reads an amount that includes tax.
- The Story's refund/dispute entries gain the tax split (plan wording).

## Undrawn states: put these to the owner in the UX summary with a recommendation (CLAUDE.md: a state not drawn is an owner question)
1. **What "Refunded" sums when some refunds have a credit note and some do not.** Recommend: each refund counts at what it took off the revenue: the
   credit note's before-tax figure where an issued note exists, else the amount refunded (tax-inclusive), and the note names how many are not split
   ("2 refunds, 1 with no credit note, so no tax split"). The label is "Refunded, before tax" only when every refund in the window is split.
   Recommend counting a refund in the period its **credit note was issued** (not the sale's), as the return does; this needs a light read of the customer's
   credit notes by `issued_at` (a note on an older sale can fall inside the 12 months and `readSaleRecords` does not return it). Read only.
2. **Our records could not be read but Stripe was** (no before-tax figure exists): recommend the paid cell drops "before tax", keeps Stripe's total, and its
   note says "includes tax; our records could not be read".
3. **A charge with no invoice and no record** ("No tax record", e.g. a charge Stripe holds that paid no invoice): recommend it counts at its amount and the
   note says how many charges are counted as charged ("1 charge with no tax record, counted as charged").
4. **The Story**: recommend a console refund line adds its split when its credit note's record exists ("$44.25 + $5.75 tax", read through
   `stripe_credit_note_number`), says nothing more when there is no note (as today), and the dispute entries keep Stripe's amount but say "including tax".
   No migration for it: `platform_refunds` has no tax columns and none are added. If the owner says leave the Story alone, record it.
5. **Non-CAD sales**: the band sums in the first paid sale's currency today. Recommend leaving that as is and saying nothing new (note it in the hand-off).

## Do not
- Do not change the record tables, their writer or reader contract; no migration. Do not touch the mark (3b), the 3a rules or Today's row.
- Do not change the Next charge cell, the fees panel, the families line, the subscription table, or anything in Part 3's strip/dot/list.
- Do not change plan prices, MRR/ARR arithmetic or any plan-config number (docs/agents/strategy/PLAN_PRICING_FACTS.md is the home).
- Do not hard-code a date or a rate. The FindBox result amount (lib/console-money-stripe.ts :332, unlabeled, tax-inclusive) is a payment amount, not revenue:
  leave it and say so in the hand-off.
- Do not touch live Stripe, production, hooks or settings. Do not restart the dev server mid-session; restart ONCE near hand-off if files were added.

## Shared, dirty tree
Other sessions' uncommitted hunks may sit in files you touch (MoneyTab.tsx, lib/console-money.ts and lib/console-money-sales.ts have held another session's
failed-payment work; some of it is committed since `9f5823655`). Read each file fresh, keep what you did not write, and commit ONLY your hunks with explicit
pathspecs; never `git add -A`. The working template is `.probe/gst3/commit-3b.cjs` (private index on the CURRENT HEAD; shared files are HEAD plus your edits
replayed, so a foreign hunk cannot ride along; hook; commit-tree; compare-and-swap update-ref). Re-check HEAD and the branch (`dev`) before committing.
No commit and no push without the owner's yes; the yes given for 3a and 3b does not carry over.

## Rules for the session
- The repo rule: before any code, a plain-language UX summary for a product manager (what each role sees, what changes on the band in each of the three states
  [Stripe read, Stripe unreachable, records unreadable], what changes on the Story, Business numbers and Overview), with the five undrawn states above and your
  recommendation for each. That is a blocking step.
- Money Tab roles: Support, Billing and Super admin see the band (find_stripe); Product, Growth and Read-only see "our record" only: unchanged.
- Words in ONE home beside `SALES_WORDS`/`NEEDS_LOOK_WORDS`/the existing band words; spelling-gated (`check:spelling`); dates `consoleDay`/`consoleWhen`, times "8:00 a.m.".
- A figure computed from our records is the ONE rule for both the Stripe-read and unreachable bands where it can be (a single function over the sales rows),
  not two sums that can drift. Prove the sums with fixtures that include a part refund with a note, a refund with no note, a $0 sale, a void sale, a sale
  before the window and a note on an older sale.

## Done when
- The paid cell says "before tax" and sums `amount_before_tax_cents` in all the states the owner ruled; the Refunded cell is as ruled; the MRR/ARR line says
  "before tax"; the guard keeps tax-inclusive amounts out of lib/platform-metrics.ts; the Story shows the split as ruled.
- Unit tests: the band sums on the fixtures above (update tests/unit/console-money-sales.test.ts :265-269 on purpose, not by loosening it), the credit-note
  period rule, the Stripe-read band, the three states' words, the metrics guard, and the Story line.
- `npm run typecheck` (use `NODE_OPTIONS=--max-old-space-size=8192`; a plain run can run out of memory); `node --import ./tests/ts-resolver.mjs --test
  tests/unit/console-money*.test.ts tests/unit/support-console-stage3-guard.test.ts tests/unit/table-recipe-guard.test.ts tests/unit/platform-audit*.test.ts
  tests/unit/plan-reader-door-guard.test.ts tests/unit/support-console-stage4b-inforce-guard.test.ts`; `check:spelling`, `check:dictionary`, `lint:focused` on
  touched files. Baseline failures that are other sessions' (report any new one by file): the `ExpenseFormWindow.tsx` footer (two tests) and the
  `lib/workspace-upgrade-status.ts` in-force census.
- Then `/simplify`, `/review` (money, high), and `/accounting` BEFORE hand-off (it changes what the console calls revenue: the credit-note period, before-tax vs
  total, the CAD valuation, the "no credit note" refund). **`/docs` is REQUIRED this time:** lib/help-content/platform-admin.tsx :267 names the band. `/legal`: none expected; confirm.
- A ▶ Progress entry per step in GST_HST_STAGE3_BUILD_PROMPT.md (positive facts with anchors, never "uncommitted"), the commit pathspecs and which shared files
  needed a partial commit; update the auto-memory project_gst_hst_collection.md and its MEMORY.md line.
- Hand-off in product-owner voice: what the owner sees on the band, the Story and Business numbers, what changed in review, the commit hash, and that the browser
  walk is Part 5's (say what to look at: a club with a part refund that has a credit note and one that does not; Stripe unreachable; Business numbers wording).
