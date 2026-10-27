# Club Tier Stage 12d-1, Part 4b: the deferred SQL, and the /review of the whole of 12d-1 (handoff prompt)

> **Written 2026-10-27** at the end of Part 4's session. Paste into a new chat on `dev`. The parent prompt is
> `CLUB_TIER_STAGE12D1_BUILD_PROMPT.md` (its rulings, "Do not" and Git rules apply). **Re-verify every lead.** Other
> sessions share this working copy: commit only your own hunks from a temporary index, then `git reset -q -- <your paths>`.
> Recommended model: Opus 5.5; helpers on Sonnet.

## Where things stand

- Parts 1–3: see `CLUB_TIER_STAGE12D1_PART4_PROMPT.md`.
- **Part 4:** `296ca4014` (every club pays its Stripe fees) and `378dc1fb0` (the daily job; mig 395 written, NOT
  applied). Plan §0 "Part 4" holds the builder's calls and four owner asks.
  - `lib/platform-stripe-fees.ts` is the one billing path: `recordStripeFee` → `billFee` (subscription line, or left for
    `sendMonthlyFeeInvoices`); `platformDisputeFees` reads the platform balance by dispute; `recordForeignCardFee`.
  - The billing webhook intercepts a fee invoice (metadata `FEE_INVOICE_META`) before its switch.
  - `/api/platform-admin/stripe-fees-daily` runs six steps from the rows.

## 1 · The deferred SQL (one migration; `/dba` first)

Exactly as listed in `CLUB_TIER_STAGE12D1_PART4_PROMPT.md` "Deferred from Part 3's /review": the refused returned line
that rolls back the whole dispute write; whether `warning_closed` → `needs_response` reuses the dispute id (check Stripe's
docs); ordering the open statuses; a payment paid but never landed; Part 2's `online_payment_over_left` surplus. Latest
migration on disk was **395** on 2026-10-27 (another session took 394); check before numbering. Dictionary, both snapshots,
`check:dictionary`, `MANUAL_PROD_STEPS.json`.

## 2 · `/review` on the whole of 12d-1

Range `c938e871a^..HEAD` restricted to 12d-1's commits (Parts 1–4 and 4b). Weight Part 4's money paths:
- the monthly invoice's crash-resume (claim → line read-back → finalize → email) and the one-per-month key;
- a fee recorded while the club's own invoice for that period already went (it waits for the next month);
- the billing webhook's intercept ordering;
- `billFee` racing the daily job (both idempotent on the fee; check the `.is('billed_at', null)` guards).

## Found in Part 4, not ruled (for the owner, don't build around)

- The single "Email the pay link" still sends after a lost dispute (the words rule only the bulk send).
- A cancelled club's fee list (billing-rail exemption) — owner ask (2) in plan §0.
- `/docs` (Part 5) must add the Plan & billing "Stripe fees" list and the comped club's own invoice to help.
