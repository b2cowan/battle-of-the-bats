# Club Tier Stage 12d-1: a team never overpays silently, card disputes, and every club pays its Stripe fees (build prompt)

> **Written 2026-10-27**, after all 13 of 12d's asks were ruled (2026-10-26) and the comped club's own invoice was ruled
> (2026-10-27). **Paste this into a new chat on `dev` and re-verify every lead first.** The leads come from a census at
> `490fb4e94` (a helper's read, with the load-bearing lines re-read by me). Code moves. Other sessions share this working
> copy: stage explicit paths only, and commit only your own hunks.
>
> **Recommended model: Opus 5.5.** This is money on both flows, a new Stripe event family, a new way of billing a club, and
> a change to a built rule (comped clubs exempt). Helpers stay on Sonnet as configured.
>
> **12d is two builds, and this is the first.** It covers the money that moves wrong today. 12d-2
> (`CLUB_TIER_STAGE12D2_BUILD_PROMPT.md`: the Payouts tab, leaving, terms, the platform-admin view) follows it, because
> its platform tab reads the disputes and fees this build records. Build in **parts, each committed locally after its own
> checks**, in the order below. **Nothing charges real money:** test mode only; `LIVE_PAYMENTS_ALLOWED` stays false.

## What 12d-1 makes true

- **A tournament team's online payment never books silently past what the team owes.** It is booked, flagged on the
  team's record and as a Needs attention item, and the refund door opens set to the extra amount. When all of it was
  extra, the refund is the whole payment with its fee. A payment recorded by hand while a pay page is open **warns**, and
  recording **closes the open page**. This covers Record a payment, Mark paid, and house league's Mark received.
- **A card dispute is seen and answered.** Today it is dropped without a word: the webhook returns early for anything
  but a bank debit.
  - The disputed payment shows its dispute on the record, in both flows. The book line stays while the dispute is open.
  - A **lost** dispute writes a returned line beside the receipt, and the child or team owes again. A **won** dispute
    goes back to plain paid.
  - **Amber and the item go only to the person who can answer**, which is the person who set up payouts, because only
    they can sign in to Stripe. Everyone else who reads the payment sees it, quietly.
  - **No email to the family** from us.
  - One **Copy the facts** beside **Answer in Stripe**. Nothing is ever submitted from the product.
- **Every club pays the Stripe fees its payments cause, comped or free included.** These are the CA$5 returned bank debit
  fee (built in 12c, which exempted comped clubs), the card dispute fees (Stripe's own figure at the time, with the
  answering fee coming off when Stripe returns it on a win), and **Stripe's extra cost on a card issued outside the club's country**
  (the family is never charged more).
  - A club with a paying subscription gets the line on its next subscription invoice, as today.
  - **A club with no subscription invoice to ride on gets its own invoice, paid through Stripe, and platform admin tracks
    it like other payments.** An unpaid one shows there, and nothing switches off by itself.

## The rulings (do not reopen; record nothing they did not rule)

Verbatim in `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` §0 state: the "12d drawn" bullet and the three 2026-10-26/27 ruling
blocks. Also see `docs/agents/strategy/BUSINESS_DECISIONS.md`, top entries (2026-10-26). This build uses:
- **Ask 1 = A, free and comped clubs NOT exempt.** Owner: "comped clubs do not get any reprieve on stripe fees in any
  capacity, we are only comping their subscription." This **changes 12c's §0k answer 2** for the CA$5 fee too.
- **Round 3, 2026-10-27:** a club with no subscription invoice gets its own invoice, "that they pay via Stripe that we
  track in platform admin like other payments." Unpaid = shown in platform admin, nothing switches off by itself.
- **Asks 2, 3, 10, 12, 13** as recommended (no family email; book line stays / lost = returned line + owes again / won =
  plain paid; book + flag + item + refund door at the extra; warn + close the open page; one Copy of the facts).
- **The treasurer never refunds (§0f).** A refund door for the extra goes to the flow's desk (tournaments:
  `create_tournaments`; house league: `takeFees`).
- **Ask 8 (GST/HST): no tax on the fee.** Nothing to build.
- **Ask 9, changed 2026-10-27: the club is billed Stripe's extra cost for a card issued outside the club's country**, on the same
  Stripe-fees bill, from Stripe's own figure. **The family is never charged more**: no surcharge, no card-first pay step,
  nothing on the pay button or receipt. Owner: the terms must say such charges are possible (counsel's text, plan §6;
  the product does not write legal text). **The words say "a card issued outside your country", never "outside
  Canada"** (owner: "we may have club owners from the US").
- **The words' §7 and two held items (owner 2026-10-27, all as recommended):**
  - A won dispute's returned answering fee is "credited to your account" everywhere.
  - A comped club's own invoice arrives in **our** email; Stripe's own invoice email is off for these invoices.
  - An unpaid one gets **one** reminder email, and a Health row (the row is 12d-2's list).
  - "Fraud" is never printed.
  - A club keeping a team's overpayment is a note ("Keep it"), not a credit.
  - One "other Stripe fees may be billed to you" line sits near the rates, in the set-up window and on the Payouts card.
  - A **lost dispute does not return FieldLogicHQ's processing fee** (the same rule as every refund, §0c).
  - A refunded payment leaves Stripe's foreign-card extra the club's.

## Read first

- The plan sections above, the PM brief `CLUB_TIER_STAGE12_PAYMENTS_PM_BRIEF.md` item 6, and the Facts doc
  `docs/agents/strategy/PLAN_PRICING_FACTS.md` (the CA$5 line and the 12d drift-check note).
- **Build to the drawings:** https://claude.ai/artifact/WutBgX8o56jBWN2zXXvZvg
  (`CLUB_TIER_STAGE12D_DRAWINGS.html`). This build covers frames **1 (card dispute)** and **2 (paid twice)**, the D3 page
  (dispute cost), the Start tab's Stripe facts, and the review table (the /ux and /design findings applied there).
- **The words (settled; build from these, don't re-word):** `CLUB_TIER_STAGE12D_COPY.md`. Where a drawing's provisional
  words differ, the words doc wins. **Its §7 is ruled** (owner 2026-10-27, recorded at the top of §7 and in plan §0).
- **12c's code is the template:** `lib/online-payment-landing.ts` (`reverseDebit`, `afterDebitBack`), `lib/platform-debit-fee.ts`,
  `lib/stripe-connect.ts` (`expireCheckout`), `lib/online-payment-words.ts`, migrations 382, 387 and 388; and
  `CLUB_TIER_STAGE12C_BUILD_PROMPT.md` for its traps.
- `AGENTS.md` (Next 16; read the route-handler guide in `node_modules/next/dist/docs/` before a new route).
- **Stripe's current docs, not memory.** The pinned API version is in `lib/stripe.ts`. See Before any code, step 2.

## Verified state (leads; re-check each)

**Overpayment and open pay pages**
- `online_payment_land` (latest definition in mig 382) refuses only a payment that already landed, was refunded or was
  returned. It calls `tournament_team_payment_record` (mig 345, its only definition), which records any amount above
  zero with **no check against what the team owes**.
- `online_payments_one_open_per_team` (partial index on `open`/`clearing`, mig 382) allows one open pay page per team.
- The desk's payments POST (`app/api/admin/tournaments/[tournamentId]/registrations/payments/route.ts`) refuses a team
  not in the tournament, the club's own team, and a **clearing** debit. It does **not** check for an open card pay page.
  House league's Mark received (`app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts`) is the
  same: it refuses clearing only.
- House league already refuses a second payment at landing (`already_received`, mig 387) and tells the family it was sent
  back (`lib/league-pay-words.ts`, `lib/online-payment-words.ts`). **The tournament flow is the gap.**
- `expireCheckout` (`lib/stripe-connect.ts`) is called only by the two pay routes, to replace a stale page. Nothing on
  the desk closes an open page. **Race to design for:** the family finishes paying a moment before the desk's recording
  closes the page. The expire then fails because the session is already complete, and the payment lands anyway. For a
  team, ask 10 catches it; house league already refuses it.

**Disputes**
- `app/api/payments/connect-webhook/route.ts` handles `charge.dispute.created` only and routes it to `reverseDebit`
  (`lib/online-payment-landing.ts`), which **returns early when `rail !== 'bank_debit'`**. A card dispute is logged as
  processed and nothing else happens. Nothing handles `charge.dispute.updated`, `.closed` or `.funds_*`.
- The bank-debit path: `online_payment_reverse` (mig 387, redefined in 388, once per dispute) sets `reversed`, stores
  `stripe_dispute_id`, emails the family, raises the desk notice, and records the CA$5 fee through `afterDebitBack`.
  **Keep that path working unchanged.**
- `online_payments.stripe_dispute_id` exists, unique (mig 382). There is **no dispute table**. The latest migration on
  disk is **389**; check before numbering.
- `docs/agents/ops/stripe-setup-guide.md` subscribes `charge.dispute.created` only (both the `stripe listen` line and the
  dashboard list). **The owner adds new events in Stripe's dashboard himself.** Write the list into the guide and name it
  as an owner step; never change Stripe settings.
- `lib/console-money.ts`'s "Disputed" handling is for the club's own subscription charges, not Connect charges. Don't
  conflate the two.

**Billing every club**
- `billDebitFee` (`lib/platform-debit-fee.ts`) creates a pending invoice item on the club's customer with
  `subscription: sub.id` (Stripe adds it to the next subscription invoice), idempotency key `debit-fee:<id>`, CAD only.
  - Exemptions: `test_mode` (keep it), **`comped`** (free time or the Founding comp; remove it) and **`no_subscription`**
    (now routes to the club's own invoice).
  - It writes `platform_debit_fees` (mig 387; unique on `online_payment_id` + `kind`; an unbilled index).
- **Nothing reads `platform_debit_fees`** apart from the writer. Platform admin shows none of it, and `bill_error` is
  never read, so a failed line is never retried or seen.
- **No code creates a standalone Stripe invoice** (`invoices.create` appears nowhere).
- Platform admin reads a club's money through `readClubMoney` (`lib/console-money-stripe.ts`: subscriptions, charges,
  invoices, the upcoming preview) on the org's Money tab (`app/platform-admin/orgs/[id]/MoneyTab.tsx`, power
  `find_stripe`). ⚠ `lib/console-money.ts` flags **any charge from an invoice with no subscription** as
  `not_subscription` / `manualInvoice: true`, a warning. A standalone fee invoice would land there as a false alarm
  unless it is recognised (by metadata) and shown as a fee payment.
- ⚠ **A discount can eat the fee line.** If a comp is a Stripe coupon or discount on the customer or subscription, it
  applies to every line on that invoice, the fee included. Find how each comp is held (free time,
  `workspaceHoldsFoundingComp`) before deciding which clubs ride the subscription invoice. Any club whose subscription
  invoice is discounted gets the standalone invoice.
- The three help articles that say a complimentary club isn't billed: `lib/help-content/tournaments.tsx` (a HelpNote
  plus its keywords), `lib/help-content/org.tsx` (body plus keywords), `lib/help-content/house-league.tsx`. They change
  in the same part as the code, never before it.

## Before any code

1. **Product-manager UX summary** (AGENCY_RULES, blocking). Cover what each role sees differently: the tournament desk,
   the house-league desk, the person who set up payouts, the treasurer, the owner of a comped club, a family and a team
   contact, and the platform team. Get the owner's yes.
2. **Stripe facts, from the current docs, written into plan §0 (12d state) before Part 3.** Words that depend on them
   stay tokens until then; if a fact can't be stated honestly, its sentence goes.
   - **Disputes on a direct charge** to an Express connected account with `fees_collector: 'application'` and
     `losses_collector: 'stripe'`:
     - the dispute events and their order (created, updated, closed, funds withdrawn and reinstated);
     - the statuses and what "won" and "lost" are on the object;
     - `evidence_details.due_by`;
     - which balance the disputed amount and the fees come from, and whether the application fee is touched;
     - how the platform learns the answering (countered) fee was charged and when it is returned.
   - **Answer in Stripe:** whether the Express dashboard's dispute view exists for our accounts (it was a public preview
     on 2026-10-26), how the person reaches it (login link or dashboard URL), and who can sign in.
   - **The foreign-card cost:** how the platform learns a charge carried Stripe's international-card fee (the card's
     country on the charge; whether the balance transaction's fee details break the international part out, or only
     the total), and its amount. If Stripe's own figure can't be isolated per charge, bring the owner the honest
     alternative (a rate held as a constant beside `ONLINE_PAYMENT_RATES`, matched to the Facts doc) before building.
     Note whether Stripe's currency-conversion fee can ever apply here (every charge is CAD on a CAD account).
   - **The standalone invoice:** `invoices.create` with `collection_method: 'send_invoice'` and `days_until_due`; which
     pending items it pulls in; the hosted invoice page and Stripe's own email; a customer that doesn't exist yet
     (create it); the events that say it was paid; and Stripe's charge for Invoicing, if any. Hand that to `/billing`
     against the Facts doc; never type it.
3. **Bring these to the owner as short proposals with a recommendation, before building them:**
   a. **When a standalone invoice goes out** (not ruled): one per fee, or the month's fees gathered. Recommend one a month,
      sent when the first fee of the month arrives, unless Stripe's docs make per-fee simpler and free.
   b. **Where the club reads its Stripe fees.** Recommend the owner's existing billing page (Settings › Plan & billing),
      plus the line on the dispute or returned-debit record that already names the fee.
   c. **The dispute record's shape:** a dispute table, or columns on `online_payments`. Recommend a table: a payment can
      be disputed more than once, an inquiry can turn into a dispute, and the bank-debit reversal already uses
      `stripe_dispute_id`.
4. **`/dba` on the migrations** (dev only; latest on disk 389). These cover:
   - the dispute record;
   - generalising `platform_debit_fees` to every Stripe fee a club owes (kinds: returned debit, dispute, answering fee,
     answering fee returned, foreign card), or a renamed table if `/dba` prefers. Keep the 12c rows; history stays.
   - how a fee was billed (on a subscription invoice, or on a standalone invoice with its Stripe id, status, paid at);
   - the team overpayment flag, or the amount over.
   - RLS on every table, `DATA_DICTIONARY.md`, both snapshots (`npm run refresh:snapshots`), `npm run check:dictionary`.
     Declare each in `MANUAL_PROD_STEPS.json`; migs 382–388 already wait ahead.

## What to build, in parts

**Part 1 · Schema (commit first).** The migrations above, with SQL tests:
- a team payment over what's owed books and is flagged, with the amount over;
- a second dispute on the same payment;
- a lost dispute writes a returned line and never deletes the receipt;
- a won dispute leaves the book as it was;
- a fee row can't be billed twice.

**Part 2 · A team never overpays silently (frame 2).**
- **Landing:** an online team payment over what's owed books, raises the item, and flags the record. The refund door
  opens set to the extra, or to the whole payment with its fee when all of it was extra.
- **The desk, both flows:** Record a payment, Mark paid and Mark received warn while a pay page is open. Recording closes
  that page through `expireCheckout`, and the race above is handled: if the expire fails because the page completed,
  landing catches it.
- The server refuses nothing new except what the drawing shows. The warning is a window, not a block (ask 12 = A).
- When the desk keeps an overpayment, it is a note with a reason ("Keep it"). The team carries no credit.
- Unit tests: over by part, over by all, the race, house league unchanged.

**Part 3 · Card disputes (frame 1).**
- The webhook handles the dispute events from Before-any-code 2 for a **card**. Bank debit keeps 12c's path exactly.
- Idempotent under replayed and out-of-order events: a `closed` before its `created` writes once and correctly.
- The dispute shows on the record in both flows (status, reason, amount, the due date, the outcome). The item and amber
  go to the person who set up payouts only; others read it quietly.
- **Answer in Stripe** and **Copy the facts**: the facts we hold (sign-up, the refund policy shown, the receipt and its
  email). Copy is the symbol alone in a small window.
- A lost dispute writes the returned line, the child or team owes again, and the desk is told. FieldLogicHQ's
  processing fee is not returned to the club. A won dispute is plain paid. No family email. The reason is the
  cardholder's, mapped, or nothing; "fraud" is never printed.

**Part 4 · Every club pays its Stripe fees.**
- One billing path for every fee kind:
  - `test_mode` stays exempt; `comped` goes;
  - a club with a live, undiscounted subscription gets the line on its next invoice;
  - every other club gets its own invoice.
- The dispute fee is recorded when Stripe charges it, with Stripe's amount (never a typed figure). The answering fee
  comes off the club's bill when it is returned on a win: a credit line on the next invoice, or a smaller invoice if the
  first hasn't gone.
- **The foreign-card cost** is recorded when a card payment from outside the club's country lands (both flows), with
  Stripe's figure (or the ruled alternative from Before-any-code 2), and billed the same way. Nothing changes for the
  family. **Compare the card's country with the club's connected account's country, never with a hard-coded "CA"**, so a
  US club later needs no rebuild. A refund leaves the cost billed; a credit line follows only if Stripe returns the fee.
- **The comped club's own invoice:** sent in our email, with Stripe's own invoice email off for it. One reminder if it
  goes unpaid; nothing switches off. A won dispute's answering fee on an invoice already paid is "credited to your
  account" (`/billing` confirms the mechanism: a credit note or a credit on the next invoice).
- **The "other Stripe fees" line** (`before.otherFees`, `record.otherFees`) in the set-up window and on the Payouts card.
- **Platform admin tracks the fees like other payments:**
  - the org's Money tab recognises a fee invoice (by metadata) and shows it as one, paid or unpaid, never as the
    `not_subscription` warning;
  - a fee whose billing failed (`bill_error`) is shown and can be retried;
  - nothing switches off when an invoice goes unpaid.
- The three help articles change in this part.
- `/billing` reads the Facts doc first. The Facts doc's CA$5 line and the 12d drift note are updated to "built" in the
  same part.

**Part 5 · Help, records, layout.**
- `/docs` for every changed flow: disputes (desk, and the person who answers), the overpayment item and refund, the
  hand-recording warning, a comped club's own invoice. 12c's help that says "a card dispute is 12d's" changes too.
- Add the dispute events to `docs/agents/ops/stripe-setup-guide.md` and name them as the owner's step.
- `npm run check:spelling`.
- `check:layout --changed` on the touched screens at 1440 and 390, in Warm and Dark. Never a whole-product sweep on dev.
- Demos follow the product.

## Definition of done

- Parts 1–5 committed; `npm run verify:changed` and `npm run typecheck` clean; `/review` on Part 1, on Part 3 (a new
  event family on money) and on the whole.
- Unit tests:
  - overpayment (part, all, the race);
  - a card dispute's whole life (created → won; created → lost; replayed; out of order);
  - a bank-debit dispute exactly as 12c;
  - fee billing for a subscribed club, a discounted one, a comped one, a free one and test mode;
  - the answering fee returned;
  - a card from outside the club's country recorded and billed to the club in both flows, the family's total unchanged;
  - the treasurer never offered a refund door.
- **End to end in test mode** on the test Express account from the 12a–12c walks:
  - a team overpaying through a pay page left open while the desk records an e-transfer;
  - Stripe's test dispute cards (won and lost) on a family payment and on a team payment;
  - a returned debit on a comped club, raising its own invoice and paying it on Stripe's hosted page;
  - a team paying with one of Stripe's test cards issued outside Canada (the test club is Canadian).
  - The email checks go in the ONE final end-to-end pass on Amplify dev once Stage 12 is built: write them into that pass.
- **The walk:** a checkable Artifact plus the next § in `OWNER_QA_LEDGER.md` (check the latest number). One purpose per
  walk; likely two (paid twice; disputes and fees).
- **Records:**
  - plan §0 and §4 (12d-1 state, anchors) and PM brief item 6;
  - the Club index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`, stage `s12`; read first and pin `if_version`);
  - the memory file `project_club_stage12_payments`;
  - the Facts doc (built status only; no rate moves).

## Do not

- Charge real money, use a live key, switch the feature on in production, or change any Stripe dashboard setting
  (events, Radar, invoicing). Those are the owner's.
- Charge the family more for any card, or change the pay step for one. The foreign-card cost is the club's (ruled
  2026-10-27).
- Build 12d-2's parts: the Payouts tab, leaving, terms, or the platform-admin Online payments tab and Health list.
- Email the family about a dispute. Give the treasurer a refund door. Put amber on anyone but the person who can answer.
- Write a second money writer, or delete a receipt or book line to undo money.
- Type a rate, a Stripe fee or a Stripe timing; print it from the constant or from Stripe's figure.
- Reopen a ruling. If the code says one can't be built as drawn, bring it to the owner drawn, before building around it.
- Push or promote.

## Git

- `dev` only; explicit pathspecs; `git show --stat HEAD` after every commit. Another session's work may be staged: build
  your commit in a temporary index (memory: "Partial commit out of shared files").
- Part 1 in its own commit. Migrations stay on dev, declared pending in `MANUAL_PROD_STEPS.json`.
- No push and no promote without the owner's word.
