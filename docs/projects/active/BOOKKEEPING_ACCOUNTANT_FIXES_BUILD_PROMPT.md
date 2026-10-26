# Bookkeeping: the accountant-review fixes (build prompt)

> **Written 2026-10-25**, the evening the owner accepted the stand-in accountant's review of Bookkeeping
> (https://claude.ai/artifact/Stn2GmaBENDZYSUwmVkhCS) and asked for this build. **Paste this into a new chat on `dev` and
> re-verify every lead before building on it.** The leads below were read in the code and walked in the browser during the
> review, with file and line where it helped, but code moves.
>
> **Other sessions share this working copy** (Support Console Stage 4, Club Tier Stage 12, house league). Stage explicit paths
> only, commit only your own hunks, and use a temporary index when a file is shared (memory: "Partial commit out of shared
> files"). Run `git show --stat HEAD` after every commit.
>
> **Recommended model: Opus 5.5** (an API contract change, a removed write path, money records). Helpers stay on Sonnet.
>
> Four parts, in order. Each part is committed on its own after its own checks, **and only after the owner says yes in your
> chat**. His "go ahead" in the review chat does not carry over.

## What this build makes true

The owner can record money he puts in, takes out, or pays himself back. Today every owner transfer is refused. When a form is
wrong, the message appears where he pressed Save and names the field. "Permanently delete" is gone, so a void is the only way a
record leaves the totals and the history is never lost. The unfinished Stripe preview tab is out of sight. Month-end has the
periods an accountant closes: last month, last quarter, last calendar year. A purchase dated in the future gets a gentle warning.

Nothing here changes the tax fields, the package contents, production, AWS or backups. Those wait for the outside accountant's
answers and for the owner's own decisions (see "Not in this build").

## The rulings (owner, 2026-10-25; do not reopen, record nothing they did not rule)

The owner accepted the review's recommendations: the order, the gap list and the push-back. He explicitly confirmed one choice:

- **R1. Permanent delete is removed entirely.** Void is the only way out. This **reverses the 2026-10-23 ruling** that kept it.
  Reason: the bookkeeping database grants the app SELECT and INSERT only (verified read-only on 2026-10-25), so the button
  could never succeed, and an append-only record is what an accountant needs.

The recommendations he accepted, to record as accepted direction (not as built):

- **R2.** The first real close is **October 2026, expenses and owner money only.** It does not wait for the Stage 3 Stripe import
  or reconciliation (BKX-4.4 redefined).
- **R3.** The outside accountant is consulted **before** any tax field is built. The owner-movement classification review
  (BKX-3.2) and the accountant's review (BKX-4.3) move to the front.
- **R4.** GST/HST is captured properly before the May–October backfill: the tax split by type, the supplier's GST/HST number,
  and a "foreign supplier charged tax" flag. It is designed after the accountant answers, not in this build.
- **R5.** The printable accountant summary: **yes, as the package's first page** (BKX-2.4 decided). Built after the accountant
  answers.
- **R6.** Bank reconciliation is split. A **statement tick-off** for the card or account that pays the expenses comes before the
  first close. **Stripe payout reconciliation** comes before the first live charge (BKX-3.4 reshaped).
- **R7.** Field-specific errors are **shrunk to the cases in Part C** plus showing the error at Save (BKX-1.5 narrowed). The rest
  of the shared window and focus polish is later.
- **R8.** The owner walks (BKX-0.5, 1.6, 2.5) happen **after** this build, in one sitting that includes the owner ledger.
- **R9.** The Support Console's **S9 trigger** changes from "plan complete" to two events:
  - **S9a:** after the first real expense-and-owner close has been handed to the outside accountant.
  - **S9b:** after the first full month with live Stripe income has been closed.
- **R10.** Work order: these quick fixes → accountant → the owner's business-account and real-books decisions, then the
  production store and backups → the build the accountant's answers call for (tax capture, package summary, owner balance,
  copy-as-new, duplicate warning, search by amount) → one owner walk → backfill and the October close with a "closed through"
  date → Stripe before the first live charge.

## Part A: record the rulings (docs only)

- `docs/projects/active/BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md`:
  - Update the **Status** line.
  - Add a dated rulings entry carrying R1–R10, with the review link as the evidence.
  - Rewrite the record-flow sentence about Permanent Delete (around line 35).
  - Reshape BKX-1.5, 2.4, 3.2, 3.4, 4.3 and 4.4 to match.
  - Add the new items the review raised as **open**, without building them: the "closed through" date, the package summary
    page, the owner balance, copy-as-new, the duplicate warning, search by amount, the statement tick-off, and deciding where the
    real books live.
  - Correct the claim that the Stage 3 owner-transfer draft is "built for the group walkthrough". It could not save a transfer.
- `..._PM_BRIEF.md`: the same in plain language.
- `..._REVIEW.html`: update the task checklist rows to match.
- `docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`: change **only the S9 row** (about line 169) to the R9
  triggers. Another session edits this file, so commit only that hunk.
- `TODO.md`: one line linking the plan. No detail.
- This prompt file (`BOOKKEEPING_ACCOUNTANT_FIXES_BUILD_PROMPT.md`, untracked when written) goes in Part A's commit, with
  `BOOKKEEPING_ACCOUNTANT_REVIEW.html`. That is the source of the review Artifact
  (https://claude.ai/artifact/Stn2GmaBENDZYSUwmVkhCS), whose second tab holds the owner's answers to the accountant
  questions. To change the page, edit that file and publish it with the Artifact's `url`. Answers live in the owner's
  browser, never in the page.

## Part B: commit the existing Bookkeeping build as a baseline (no code changes)

The whole Stage 1–4 build the review walked has **never been committed**. Commit it as-is, on its own, so Part C's fixes are a
separate, readable change. **Show the owner the file list and get a yes first.**

**Whole files** (all Bookkeeping, nobody else's):
- `app/api/platform-admin/bookkeeping/expenses/route.ts`
- `app/api/platform-admin/bookkeeping/export/route.ts`
- `app/api/platform-admin/bookkeeping/package/route.ts`
- `app/api/platform-admin/bookkeeping/owner-movements/` (new)
- `app/platform-admin/bookkeeping/BookkeepingClient.tsx`
- `app/platform-admin/bookkeeping/bookkeeping.module.css`
- `app/platform-admin/bookkeeping/page.tsx`
- `app/platform-admin/bookkeeping/OwnerLedger.tsx` (new)
- `lib/bookkeeping-expenses.ts`
- `lib/bookkeeping-export.ts`
- `lib/bookkeeping-store.ts`
- `lib/bookkeeping-owner-movements.ts` (new)
- `scripts/bookkeeping-aws/schema.sql`
- `scripts/bookkeeping-aws/002_expense_dates.sql`, `003_tax_amount_known.sql`, `004_owner_movements.sql` (new)
- `scripts/bookkeeping-backup.mjs`
- `scripts/bookkeeping-dsql-date-migration.mjs`, `bookkeeping-dsql-tax-migration.mjs`, `bookkeeping-dsql-owner-movement-migration.mjs` (new)
- `tests/unit/bookkeeping-expenses.test.ts`
- `docs/projects/active/BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md`, `_PM_BRIEF.md`, `_REVIEW.html` (as they stood before Part A)
- `docs/projects/archive/BOOKKEEPING_AWS_RESOURCES.md`

**Shared files: Bookkeeping hunks only**, via a temporary index. Each holds 1–2 Bookkeeping lines among other sessions' work:
`TODO.md`, `docs/agents/db/DATA_DICTIONARY.md`, `docs/projects/active/OWNER_QA_LEDGER.md`. Leave the schema-snapshot files,
the help content, the console menu and CSS alone; their changes are not Bookkeeping's. Re-check with
`git status --short | grep -i bookkeep` in case the set has moved.

Before committing, run `npm run verify:changed` and the bookkeeping unit tests. If anything fails, report it rather than fixing
it in this commit. The commit message says what the baseline is (the Stage 1–4 owner-experience build as reviewed on
2026-10-25), never "wip". Ordering: either commit Part B before Part A's plan edits, or commit Part A in the same baseline. Do
not let the plan's pre-Part-A text and Part A's edits blur together.

## Part C: the fixes

**C1. Owner transfers save.** The server refuses every transfer because the ID check in
`app/api/platform-admin/bookkeeping/owner-movements/route.ts:8` is malformed. Its fourth group is `[89ab][0-9a-f]{12}` where a
UUID needs `[89ab][0-9a-f]{3}-[0-9a-f]{12}`. The same check guards the linked expense, so reimbursements fail too.
- Look for an existing shared UUID check in `lib/` before writing another.
- Add a unit test that feeds it `crypto.randomUUID()` and a seeded QA id such as `b2026102-3000-4000-8000-000000000001`.
  No test covers this route today.
- In the browser, prove: a contribution, a draw, and a reimbursement linked to a personally paid expense; the over-reimbursement
  refusal; a correction; a void; and the transfer appearing in the package's `owner-transfers.csv`.

**C2. Errors where you pressed Save, naming the field.**
- Today both forms print the error at the top of the page (`BookkeepingClient.tsx` ~272, `OwnerLedger.tsx` ~125). Nothing
  scrolls to it, so on a long form Save looks dead. Show it beside the actions and move focus to the field at fault. Use the
  shared window and focus recipe where it fits (memory: "One window for the whole product"); no `window.confirm`.
- The server returns one catch-all, "Check the expense amounts and required fields". Return which field failed and say what to
  do:

  | Case | Message |
  |---|---|
  | Amount of 0 | "Enter an amount above $0.00." |
  | Tax above the amount | "Purchase tax can't be more than the amount." |
  | USD conversion note | "Say where the rate came from and its date, like 'Card statement 2026-10-16'." Also show this rule as the field's hint before anyone gets it wrong. |
  | Receipt over 10 MB | Check the size in the browser before uploading. Find out why the server said "Invalid form" (likely the upload body failing to parse) and make it say "Receipt must be a PDF, JPEG or PNG under 10 MB." |
  | Amount format | Accept "1,200.00" and "$1,200.00" by stripping the dollar sign and thousands commas. Keep refusing "12,50", which is ambiguous, with "Use numbers like 1200.00." |
  | Owner transfers | Name the field the same way (date, amount, linked expense). |

- Copy follows the house rules: the spelling gate, and no clock or currency spelled any other way.

**C3. Remove Permanently delete.** Remove all of it:
- the button and its confirmation box on the record;
- the DELETE handler in the expenses route;
- the store's delete function, and the receipt-delete helper if nothing else uses it;
- any tests that cover them;
- any help-content mention.

The record's actions become Correct and Void, and a voided record shows none. Do **not** change the database grants.

**C4. Hide the Sources tab.** Take it out of the tab row (the "B3 · fixture import preview"). Keep the preview code for Stage 3;
only the entry point goes.

**C5. Periods.** Add **Last month**, **Last quarter** and **Last calendar year** to the Reports period choice. Calendar quarters
are fine; the proprietor's fiscal year is the calendar year. Prove the Export CSV and the Accountant package accept the
resulting ranges: the export route has an "Invalid report period" check. The default stays as it is.

**C6. Future-date warning.** When the expense date or payment date is after today, show a quiet note under the field: "This date
is in the future. Check it before saving." It warns and never blocks.

After Part C:
- run `npm run verify:changed` and `npm run typecheck` (an API contract changes);
- offer `/review`;
- offer `/docs`, if the platform-admin help covers Bookkeeping.

## Part D: one owner walk

Write a checkable QA walk Artifact with **one purpose**: the owner ledger works end to end, and the six fixes behave. Add its
entry to `OWNER_QA_LEDGER.md` the ledger's usual way, and don't renumber anything. The five-journey walk (R8) is a separate,
later walk; do not merge them.

## Testing access and data (read before probing)

- Bookkeeping opens only for addresses in `BOOKKEEPING_OWNER_EMAILS` (default `fieldlogichq@gmail.com`), never for a
  platform-admin role. To probe as the UAT platform admin:
  1. Ask the owner.
  2. Append that address after `fieldlogichq@gmail.com` in `.env.local`. It is gitignored, and the dev server reloads it on
     change, so no restart is needed.
  3. Remove the line afterwards and confirm a 403.
- **The development bookkeeping store is the only working store** (production isn't wired up). Prefix test entries "ACCT-FIX",
  void every one when done, and **never delete**. List them in your hand-off.
- Probe pitfalls the review hit:
  - The page has two date boxes; the label "Payment date is different from expense date" matches "expense date".
  - "Hide more details" matches a search for "More details".
  - On a phone the date is the device's own picker.
  - The console's global search box sits before the Expenses "Find" box.

## Not in this build

- Tax fields; the package summary page; the owner balance; copy-as-new; the duplicate warning; search by amount; the
  "closed through" date; the statement tick-off. All of these wait for the accountant and their own mockup session.
- The production store, backups, and anything in AWS or production. These are the owner's decisions, and they run as their own
  sessions under the shared-automation rule.
- Stripe and the Sources preview's future.
- Cleaning up the "B2 QA" and "QA verification" categories, which are development data.
- The "Business bank" and "Business card" choices, which wait for the business-account decision.
