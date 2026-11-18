# Stripe-owned pricing: commit the Stage 3 follow-up, then the owner walk for Stages 2–5. Build prompt

Paste this into a fresh session. Written 2026-11-18 by the Stage 3 follow-up session. The plan of record is
`docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md`: read Stage 3's **"Follow-up built on dev 2026-11-18"** bullets (the
words, help, terms, bank check, loose ends, `/accounting`, `/review` and the hardening), then Stage 2, Stage 4 and Stage 5's
"Built" paragraphs. They are the facts; this prompt lists only what is left.

## State when this was written
- Committed: Stage 3's code half `b7f8c4d74` and its daily-job steps `b04c1b3d7`.
- Built on dev, **not committed**: the follow-up (below). Mig 501 is `pending` for prod in `MANUAL_PROD_STEPS.json` and
  was edited in place after `b7f8c4d74`; dev has every changed function re-applied, and
  `node scripts/db-query.mjs --dev -f scripts/stripe-owned-pricing-501-check.sql` ends `STRIPE_OWNED_PRICING_501_PASSED`.
- Owner rulings 2026-11-18 in this conversation: **terms v0.2's narrowing APPROVED** ("I approve"); **"go ahead and
  harden"** the daily job (built; it is the second commit below).

## 1. Commit (the owner asked for it; explicit pathspecs; other sessions share these files)

Re-check `git rev-parse --abbrev-ref HEAD` is `dev`. Read each file's `git diff` before staging. **Several files also carry
other sessions' hunks** (at least `docs/agents/db/DATA_DICTIONARY.md` and `docs/agents/legal/LEGAL_INDEX.md`; check
every file): stage only the Stripe-owned-pricing hunks, using the temp-index method in the memory note
"Partial commit out of shared files". After each commit, `git show --stat HEAD` and confirm only these files landed.

**Commit A — the follow-up (words, help, terms, bank check, the writers' fixes):**
- `supabase/migrations/501_the_books_meet_what_stripe_takes.sql`, `scripts/stripe-owned-pricing-501-check.sql`
- `lib/online-payment-stripe-fees.ts`, `tests/unit/online-payment-stripe-fees.test.ts`
- `lib/online-payouts.ts`, `lib/online-payouts-map.ts`, `lib/bank-club-map.ts`, `lib/bank-club-read.ts`,
  `lib/bank-tab-words.ts`, `components/admin/kit/club/money/bank/BankFind.tsx`, `BankCheckForm.tsx`, `Bank.module.css`,
  `tests/unit/bank-club-read.test.ts`, `tests/unit/house-league-money-guard.test.ts`
- `lib/online-payment-words.ts` (one comment only), `lib/help-content/tournaments.tsx`, `accounting.tsx`,
  `house-league.tsx` (their Stage 3 hunks only)
- `scripts/seed-stripe-walk-tournament.mjs`
- `docs/agents/legal/drafts/PAYMENTS_TERMS.md`, `docs/agents/legal/LEGAL_INDEX.md` (the narrowing hunks)
- `docs/agents/db/DATA_DICTIONARY.md` (the 501 hunks), `docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md`, this
  prompt, `STRIPE_OWNED_PRICING_STAGE3_FOLLOWUP_PROMPT.md`
- The board line: `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`, project `payments`: its `remains` gains "Stage 3
  built and reviewed 18 Nov (the books match what Stripe takes; terms narrowed, your yes); the owner walk for Stages 2–5
  next". Change only that line.
- The message says what the club sees: the two reworded book lines, the bank check's "Stripe fee · not in your books",
  the help, the narrowed terms (approved), and the writers' fixes: no cost line where a tournament's fees aren't in the
  books; an answered inquiry is never charged an answering fee; a line dated in a closed fiscal year is dated today; an
  unmatched stand-alone fee is tried again while the daily job still lists it.

**Commit B — its OWN commit (it runs by itself; AGENCY_RULES "shared agent automation"):**
- `app/api/platform-admin/stripe-fees-daily/route.ts` and `lib/online-payment-landing.ts` (all of its hunks: the daily
  functions and two comments).
- The message says the BEHAVIOUR change: the two Stripe fee steps now run last; each counts a failing club, charge or
  line and carries on instead of stopping the step; the catch-up reads connected accounts only, newest first, and counts
  only real writes; it also books a dispute fee whose event came before the payment landed. Owner's word: 2026-11-18,
  "go ahead and harden".

Then restart the dev server (shared modules changed) before any browser test.

## 2. The owner walk for Stages 2 to 5 (Stage 5's close)

A checkable Artifact under the walk rules: **20 to 50 boxes, one action per step, one purpose** (that Stripe-owned
pricing works end to end on a club, as a treasurer and an owner see it); owner calls never in the counter; paste-back.
Before writing it, grep every existing walk for steps this one supersedes (the Stage 12 payout walks, the retired
fee-invoice walks) and say which.

- **Clubs.** `milton-bats` and `dev-club-org` set up payouts again on Stripe-owned accounts (Stage 2: their old accounts
  take no new payments; "Set up payouts again"). Those set-up steps can be the walk's first steps, done by the owner in
  test mode. **UAT Rep Club is not touched before its payout test's payout steps (on or after 2026-11-25).**
- **Cover, each as the club sees it** (pick the cases; don't add any): the Before window's "What it costs" and Stripe's
  terms line; the Payouts card's rates and who pays; a domestic card payment in each payer mode and its book lines; a
  foreign card (Stripe's extra line; in Canadian test mode `4242…` is a US card); a refund with the fee (neither part comes
  back: one Payment processing line); a card dispute (the dispute fee line); a bank debit that fails before it clears
  (the returned record now; the $5 "Returned debit fee" only after Stripe bills it hours later and the daily job runs:
  say so in the walk, or leave that case to the payout test); the Payouts tab's lines ("FieldLogicHQ’s fee returned");
  the house-league Money page's names; the help answer "Where the processing fee shows in your books"; no Stripe-fee
  invoices anywhere (Stage 4); the terms and privacy drafts in the dev preview.
- The bank check's "Stripe fee · not in your books" needs an unmatched stand-alone fee, which test mode can't make on
  demand: leave it out of the walk and name it as untested-by-walk (its unit tests and the 501 check cover it).
- Every figure in a step comes from the seed or the rates, never typed from memory.
- Record the walk in the QA ledger (`docs/projects/active/OWNER_QA_LEDGER.md`; never sort its § numbers).
- **Don't close the project or archive the plan.** The owner's word closes it.

## Still open, not this session
- The answering fee's return on a won dispute: still unseen in test mode (re-read 2026-11-18). Re-read the probe account's
  lines (`node .probe/s3/bt-list.cjs`) and on the payout test; if a credit appears, book it against its dispute as money in
  (`/accounting`: a refund of an expense, never revenue) and name a credit in the bank check when the bank holds more.
- Stripe's `tax` fee detail in live mode: now counted if it appears; unverified.
- Not this stage: GST/HST Stage 5; publishing the terms; switching payments on; the payout test itself; any rate.
