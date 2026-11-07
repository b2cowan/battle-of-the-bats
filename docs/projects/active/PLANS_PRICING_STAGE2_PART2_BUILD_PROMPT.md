# Plans & pricing · Stage 2 · Part 2: the failed-payment story on one customer's Money tab (kickoff prompt)

> Written 2026-11-06, after Part 1 was committed. Read first: [PLANS_PRICING_STAGE2_BUILD_PROMPT.md](PLANS_PRICING_STAGE2_BUILD_PROMPT.md)
> (the stage prompt, including the **Owner rulings 2026-11-06** block, which overrides the stage prompt where they differ) and
> [STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md](STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md) ("Stage list of record", item 2).
> Drawings already ruled: `STAGE10_PLANS_PRICING_STAFF_DRAWINGS.html` (also a published Artifact). Tab 6 "Billing story" is the
> record view; tab 9 is Stage 3's TOOLS, and only its failed-payment banner and payments table belong here (lines ~611 and ~709-793).
> Mark each fact you rely on [V] (you opened it this session, with file:line) or [H] (handed to you, unverified). Everything below
> marked [H] came from helper reports or plan text, not from your own reading.

## What this part is, in one paragraph

Today a customer who is past due shows on the Money tab only as the word "Past due" in the status row. Staff have to open Stripe to
learn what failed, when, why, when Stripe tries again, and how many tries are left. Part 2 puts that story on the Money tab, read
from Stripe live (owner ruling 1: no local mirror), for staff who already see Stripe numbers there. **It changes nothing about
anyone's money and adds no button that does.** Retry, email a card link, mark paid and credit are Stage 3.

## What exists (all [H] until you open it)

- The Money tab is `app/platform-admin/orgs/[id]/MoneyTab.tsx`, fed by `app/api/platform-admin/orgs/[id]/money/route.ts` (says
  "Stripe, live… never cached"), which calls `readClubMoney` in `lib/console-money-stripe.ts`. Live calls there: subscriptions.list
  (~:205), invoices.createPreview (~:214, next charge), customers.retrieve (~:219), charges.list (~:222), invoices.list (~:224).
  The rows and the "Differs" chips are built in `lib/console-money.ts` (compare table ~:374-414, the Paid/Refunded/Next charge band
  ~:463-490).
- Gate: the page needs the `find_stripe` power (Super admin, Billing, Support). A role without it sees only Plan, Status, Renews and
  Free through, from our own record. **A role without `find_stripe` must still see nothing from Stripe.**
- Our own record already marks a club `past_due` when `invoice.payment_failed` arrives (`lib/billing-webhook-handler.ts`, the
  `invoice.payment_failed` arm; moved there in Part 1, commit on `dev`). `past_due` keeps access.
- The sale list (one row per sale) is our own tax record joined to Stripe, and it survives a Stripe outage. Whether it holds a
  FAILED payment at all is unknown: check before you promise a failed row can show when Stripe is down.
- There is **no failed-payments section and no retry date** on the Money tab today. Nothing stores a failed charge's reason.
- ⚠ Another session has **uncommitted edits** in `ClubRecord.tsx`, `MoneyTab.tsx`, `page.tsx` and `money.module.css` (platform-admin org
  record). Read the working copy, do not revert it, and commit with the partial-commit method (memory: reference_partial_commit_shared_tree).

## Before any code (AGENCY_RULES, blocking)

1. **Open the code and the drawings yourself.** Read the Money tab's current frames, then tab 6 and tab 9 of the drawings. List
   exactly what is drawn for a failed payment: the banner (the drawing shows "Jan 3 declined, retry Jan 6, attempt 2 of 4"), the
   payments table rows (Failed / Paid / "Paid outside Stripe"), and every empty, failed-read and "Stripe not answering" state.
2. **Disagree out loud where the drawing and Stripe differ.** Known soft spot to test: the drawing says "attempt 2 of 4". Stripe's
   retry schedule is a Dashboard setting; the invoice reports the attempt number and the NEXT attempt date, and may not report the
   total. **Do not print a number we cannot read from Stripe.** If "of 4" cannot be read, propose the honest wording and say so.
   Also check: when Stripe has stopped retrying (no next attempt), the story must say so rather than show an old date.
   "Paid outside Stripe" belongs to Stage 3; do not draw or build its marks.
3. **Present a short plain-language PM summary** (what Billing/Support/Super admin see on a past-due customer, what a customer who
   paid on the retry looks like afterwards, what a role without Stripe access sees, the empty and error states) and **wait for
   the owner's go.** Product-owner voice, no file names.
4. Money screens show customers' names and payment history: keep to what the drawings show. No card numbers beyond what the tab
   already shows (brand and expiry). Note in your summary what failure reason text you would show and why that is safe.
5. Do not edit `.claude/settings*.json`, hooks, `package.json` scripts, database checks or anything in `WATCHED_PATHS`
   (`scripts/check-agent-automation.mjs`). **No migration is expected for this part** (nothing is stored); if you find you need one,
   stop and ask.
6. Never touch live Stripe from a session. Test mode only, through our own code; the owner runs anything against live.

## What to build (re-cut after step 1 if the code says otherwise)

- **The failed-payment story**, on the Money tab, only when the customer has an unpaid invoice or a recent failed payment: what
  failed and the amount (price and tax shown apart if the tab already does so), when it failed, the reason Stripe gave in plain
  words, how many tries have been made, when Stripe tries next (or that it has stopped), and what the product does meanwhile
  (access stays; say so in the words the product already uses for `past_due`). One source of truth: read it from the same live
  read the tab already makes; **do not add a second round-trip to Stripe if the invoice list already carries it.**
- **The payments list** gains failed rows (marked Failed) beside paid ones, per the drawing. Refund and Needs-a-look keep working as
  they do today.
- **Every state drawn**: nothing failed (say nothing, or the drawn quiet line), a failed read of Stripe (say "could not be read, Read
  again", never "no failed payments"; Stage 0 fix 3: none is not failed read), Stripe not answering, a customer with no Stripe
  customer at all, and a role without `find_stripe`.
- **Read-only, to the letter.** No retry button, no "email a card link", no mark-paid, no credit. If the drawing shows the Billing
  tools menu, it is NOT part of this part.
- **Viewing is not logged**: the drawings do not say a staff view is logged, and nothing here should log one. Mention it in the
  /legal note at stage closeout.
- Wording goes through the house spellings (`npm run check:spelling`) and times through `formatTime()`.

## Verification (the owner browses; you do not)

`npm run verify:changed` or `lint:focused` on the files you touched; `npm run typecheck` once (shared types, a route). Run
`NODE_OPTIONS=--max-old-space-size=8192` if the typecheck runs out of memory. Unit tests: the Money tab's pure builders
(`lib/console-money.ts`) get tests for every state above, including the "attempt count unreadable" case. Known red tests NOT from
this work: `workspace-flip-guard`, `support-console-stage4b-inforce-guard` (allowlists), `support-console-stage3-guard` (a modified
bookkeeping window): report, do not fix. A new file means restart the dev server before hand-off.
Hand the owner a short checkable list: a past-due test-mode customer (use the sandbox club you create through our own checkout with a
card that declines), a customer who recovered, a customer with no Stripe customer, and a Support login against a Read-only login.

## Out of scope (stay out)

Retry/mark paid/credit/refund changes (Stage 3), the Watching Stripe page (Part 3), reports (Part 4), replay (Part 5), the Stripe
cleanup O12/O13, a local copy of Stripe facts (owner ruling 1), and anything that changes the failed-payment outcome (S11 is a
read-only check, Part 3).

## Done means

PM summary approved → built → tests for each state → owner's checklist handed over → offer `/simplify` if a new abstraction appeared,
then `/review` (this tab touches money screens) → ask before committing (explicit paths, partial commit around the other session's
edits, `git show --stat HEAD` after) → tick Part 2 in the stage prompt's Progress block. `/legal` and `/accounting` run once at the
stage's closeout (Part 6), but note anything this part adds for them.
