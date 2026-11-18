# Stripe charges the club for processing; we keep only our margin ("Stripe-owned pricing")

**Written:** 2026-11-17, from the GST/HST Stage 5 kickoff session (owner conversation; see "Why" below).
**Part of:** Families pay online (Club Tier Stage 12) — board project `payments`. Status lives on the board, not here.
**PM brief:** [STRIPE_OWNED_PRICING_PM_BRIEF.md](STRIPE_OWNED_PRICING_PM_BRIEF.md)
**First phase prompt:** [STRIPE_OWNED_PRICING_STAGE1_PROMPT.md](STRIPE_OWNED_PRICING_STAGE1_PROMPT.md)
**Holds:** [GST/HST Stage 5](GST_HST_COLLECTION_PLAN.md) (the tax on our fee) is reshaped by this plan and waits on its Stage 2.

---

## Owner rulings, 2026-11-17 (this conversation)

- **R1 — The GST/HST on our online-payment fee is included in the fee, paid out of our share.** No monthly tax bill to
  clubs. Reason (owner): a club believes what it paid at checkout is the whole cost; a later "you owe us more" bill sours
  first customers and invites complaints and non-payment. Revisit adding tax at purchase later, if Stripe can do it at
  payment time, and change the terms then if we choose. **Supersedes T2 for the application fee** (`BUSINESS_DECISIONS.md`
  ~L545). T3 is unchanged: the fee is FieldLogicHQ's charge to the club, so the club's billing address decides the rate.
  → `/strategy` logs it (Stage 1 step 4).
- **R2 — D1 goes to the accountant before online payments switch on:** is our payment fee a taxable supply or an exempt
  financial service? (Stripe treats its own processing as exempt.) The questions to bring are in Stage 1 step 5.
- **R3 — Move to Stripe-owned pricing before launch, starting with a test-mode trial.** Stripe charges each club's
  account for its own processing (and disputes, returned debits, foreign cards); FieldLogicHQ takes only its margin as the
  application fee. This plan.

Not ruled (do not record as ruled): the margin-only rate design (Stage 1 step 3); whether the billing-address-before-payouts
step stays (Stage 4). (The full payout test on/after 2026-11-25 runs as planned on today's model: owner, 2026-11-17.)

## Why

What the code does today (`lib/stripe-connect.ts` creates every club account with `fees_collector: 'application'`):
FieldLogicHQ pays Stripe's processing fee out of the all-in 3.5% + $1.50, plus the Connect payout fee (0.25% + $0.25 per
payout) and $2 a month per active account, and then bills each club monthly for disputes, returned debits and foreign cards.

The cost check (Stripe's Canadian pages read 2026-11-17: card 2.9% + $0.30; PAD 1% + $0.40 capped at $5; Connect "you
handle pricing" $2/active account/month + 0.25% + $0.25 per payout, plus an unclear "funds routing" 0.25% line) on a
$1,000 card payment, family pays, Ontario, tax included (R1):

| | Today (we pay Stripe) | Stripe-owned pricing |
|---|---|---|
| Family pays | $1,036.50 | $1,036.50 (if the family-facing number is kept) |
| Stripe processing | ~$30.36, from our fee | ~$30.36, from the club's balance |
| Payout + account fees | ~$2.50 + $0.25 + $2/month, ours | none (Stripe's Connect page) |
| Our application fee | $36.50 | ~$6.14 (margin only) |
| GST/HST inside our fee (13/113) | ~$4.20 | ~$0.71 |
| **We keep** | **about −$0.56** | **about +$5.43** |

At today's model, card payments lose money above about $640 in Ontario and $460 in the 15% provinces. Under Stripe-owned
pricing the tax base is our margin only, Stripe's costs never pass through our books, and the monthly Stripe-fee invoice
(the very "you owe us more" bill R1 objects to) is no longer needed.

**Why now:** the fee setting is **immutable** on an account (Stage 12 plan §0d table). Production has **0 payout accounts**
(`RECOVERED_STRIPE_FEES_TAX.md`, 2026-11-05; online payments locked off twice). Switching after clubs connect means every
club onboards again.

**What Stripe says** (read 2026-11-17):
- [SaaS platform monetization](https://docs.stripe.com/connect/saas): in the Stripe-owned model connected accounts pay
  Stripe fees, carry their negative balances, take direct charges; the platform earns subscriptions, **an application fee
  per transaction**, and possibly a revenue share. "Stripe doesn't charge your platform in this model."
- [Changelog 2026-06-24](https://docs.stripe.com/changelog/dahlia/2026-06-24/express-connected-accounts-v2-stripe-owned-pricing-negative-balance-liability):
  Express accounts on v2 now allow `fees_collector: 'stripe'` + `losses_collector: 'stripe'` — **preview API**
  (`2026-06-24.preview` or later). Our current accounts already depend on a preview (`2026-09-30.preview`) for losses.
  ⚠ The Stripe SaaS overview says "connected accounts … assume liability for their negative balances" in this model,
  while the changelog says `losses_collector: 'stripe'` means Stripe absorbs them. Stage 1 settles which applies to us.
- [Direct charges](https://docs.stripe.com/connect/direct-charges.md?platform=web&ui=stripe-hosted): the connected account
  receives the charge less Stripe fees and the application fee; no Stripe fee on the application fee itself; application
  fees are not refunded unless asked.

## What the club and family see after

- **Family:** unchanged if the family-facing fee number is kept — one fee line at checkout, no tax line (T3).
- **Club:** Stripe's processing fee comes out of its Stripe balance on each payment; disputes ($15), returned debits ($5),
  foreign cards (+0.8%) and conversion (+2%) come out the same way, automatically. **No monthly Stripe-fee invoice from us,
  no overdue banner, no reminder emails.** The club's books show Stripe's real fee on each payment as a cost line.
  The Payouts card and terms say what Stripe takes and what we take.
- **Changed promise:** "the club always receives the full fee" becomes "the club receives the fee, less Stripe's extra on
  the rare foreign card or currency conversion" — which is what it already pays today, by our invoice, afterwards.
- **Us (platform admin):** no Stripe-fees panel, no fee invoices to chase, no tax on recovered fees. Our income from
  payments is our margin only; Bookkeeping records it with its tax (GST/HST Stage 5, reshaped).

## Stages

Each stage gets its own build prompt, written at the end of the stage before it. Plan first, PM UX summary before code,
`/accounting` before hand-off on any stage that changes what we charge or record, `/strategy` drift check on any rate change,
`/legal` on any change to what a club agrees to. Online payments stay off in production throughout.

### Stage 1 — Prove it and price it (no product code)
Prompt: [STRIPE_OWNED_PRICING_STAGE1_PROMPT.md](STRIPE_OWNED_PRICING_STAGE1_PROMPT.md).
1. Test-mode probe (`.probe/`, test key only) on the Express + v2 preview: create a Canadian account with fees `stripe`
   and losses `stripe`; onboard it; run card, PAD, foreign-card, refund, dispute (won and lost) and payout cases. Record
   who is charged what, from the balance transactions on both accounts. Confirm the Express login link still works, and
   whether negative balances are Stripe's or the club's.
2. **Go / no-go** to the owner, with the evidence. No-go fallback: stay on today's model with R1 at 3.5% or ~3.75%.
3. `/strategy`: the margin-only rate design. Options: (A) keep one family-facing number (3.5% + $1.50 card, 2.5% + $1.00
   bank) and set our application fee to that number less Stripe's standard domestic cost; (B) publish the two parts
   ("Stripe's processing + our fee"); (C) a margin-only fee the club sees, with Stripe's fee visible in its own dashboard.
   Recommendation in the prompt; owner rules. Updates `PLAN_PRICING_FACTS.md` + `lib/plan-config.ts` in Stage 2, not here.
4. `/strategy` logs R1, R2, R3 (and the rate ruling) in `BUSINESS_DECISIONS.md`.
5. `/accounting`: tax base = our application fee only, tax included (R1), by club province, US 0%; tax point = when the fee
   is taken; the accountant question list (D1 first). `/legal`: a quick read of money-services and payments-terms impact
   (§4 margin, §5 replaced by "Stripe charges your organization directly").
6. Write the Stage 2 build prompt; update the board line in the same commit.

#### Stage 1 probe results (test mode, 2026-11-17)
Full record: `.probe/sop/RESULTS.md` (scripts `sop-*.cjs`, raw output beside them). Probe account `acct_1Ud0FDFuSu8KhK2Q`,
Canada, v2, Express, `fees_collector: stripe` + `losses_collector: stripe`, created on `2026-09-30.preview` (the version
`lib/stripe-connect.ts` already uses). Stripe's v1 view of it: `fees.payer = account`, `losses.payments = stripe`.

- **Creation:** accepted first try. **Onboarding:** Stripe refuses ToS acceptance and identity documents from the platform on
  this account type; the club does both on Stripe's hosted form, exactly as today. The owner completed it with test data.
- **Figures** ($100 registration; card: family pays $105.00, application fee $1.65; bank: $103.50, fee $2.06):

| Case | Stripe charged the club | Club nets | Platform |
|---|---|---|---|
| CA card (direct charge) | $3.35 | $100.00 | +$1.65, Stripe fee $0 |
| PAD/ACSS debit | $1.44 | $100.00 | +$2.06, fee $0 |
| US / UK card | $4.19 (incl. 0.8% intl) | $99.16 | +$1.65 |
| Full refund, fee not refunded | Stripe keeps its $3.35 | out $5.00 (as today) | keeps $1.65 |
| Dispute won / lost | $15 dispute fee, **not returned on a win** | out $15 / out $120 | keeps fee, not debited |
| Debit returned (NSF) | Stripe fee returned; **our fee auto-refunded to the club** | $0 | −$2.06 |
| Debit disputed | $5 dispute fee | — | keeps fee |
| Payout $233.70 (standard) | fee $0 | paid | no line at all |

- **Checkout:** a Checkout Session on the club's account with `payment_intent_data.application_fee_amount` is accepted.
- **Express login link:** refused before onboarding finished, works after.
- **Negative balance:** after disputes and a refund that followed a payout, the club's available balance read −$240 and then
  −$500; the platform was never debited. Stripe's two pages reconcile: the club owes its own negative balance first
  (`debit_negative_balances: true`, Stripe may debit its bank); if it cannot pay, Stripe absorbs it (`losses_collector:
  stripe`: "Your platform has no financial liability if a connected account can't cover a refund or chargeback").
- **Not provable in test mode:** Connect's live-only platform fees (billed outside the balance); Stripe's SaaS page says
  "Stripe doesn't charge your platform in this model". A returned debit charged no failure fee in test mode.
- **Side finding:** Stripe's SaaS page offers platforms in this model a revenue share "when your connected accounts meet
  product activation targets". Ask Stripe before launch.
- **Go / no-go: GO** (owner 2026-11-17, on this evidence).

#### Rate design: A, ruled 2026-11-17
Owner: "agree with your recommendation". Logged with R1–R3 in `BUSINESS_DECISIONS.md` 2026-11-17 "Stripe-owned pricing…".
- **Family-facing rates unchanged:** card 3.5% + $1.50, bank debit 2.5% + $1.00, on the base.
- **Our application fee = that fee less Stripe's standard Canadian cost for the payment:** card 2.9% + $0.30 on the whole
  charge; PAD 1% + $0.40 capped at $5 (Stripe's published prices; the probe charged exactly these). Held as a new figure
  beside `ONLINE_PAYMENT_RATES`, held to the Facts doc by the same test. Club-pays mode: Stripe's cost is on the base.
- **What we keep after the tax inside our fee** (families pay; Ontario / 15% province; `.probe/sop/out-7-margin.txt`):

| Base | Card | Bank |
|---|---|---|
| $100 | $1.46 / $1.43 | $1.82 / $1.79 |
| $400 | $2.79 / $2.74 | $5.74 / $5.64 |
| $800 | $4.55 / $4.47 | $14.16 / $13.91 |
| $1,000 | $5.43 / $5.34 | $18.58 / $18.26 |

  Today's model, card, Ontario: $0.57, $0.12, −$0.50, −$0.81.
- Rejected: B (two lines to families: surcharge-rule exposure, and Stripe's real cost is unknown at checkout); C (club
  absorbs Stripe's cost: every club nets ~3.35% less; kept as the shape for the US schedule, amounts still owed).
- **Drift check for Stage 2** (`PLAN_PRICING_FACTS.md`, no edits in Stage 1): the facilitated-payments line's "application
  fee is the whole fee", the tax rider (still says on top; R1 put it inside, drift since 2026-11-17 until Stage 2), the
  foreign-card / returned-debit / dispute riders (retire in Stage 4), the code-homes sentence (new Stripe-cost figure), and
  "the organizer nets the full team fee" (+ "less Stripe's extra on a foreign card or conversion"). The family-facing
  rates, every plan price, band, SKU, key and gate are untouched, so no pricing page or plan card changes.

### Stage 2 — Accounts and the fee
New accounts created with Stripe-owned pricing; our application fee becomes margin only per the Stage 1 ruling; the rate
record (Facts doc + plan config + their tests) updated; dev test accounts re-created (the setting is immutable); the
account-setting guard test updated to the new pinned values; Payouts card and Before window words. `/strategy` drift check.

**Owner ruling 2026-11-18 (Stage 2 step 5, the old dev accounts): refuse and re-create.** An account made under the old
setting (`fees_collector: 'application'`; dev only: `dev-club-org`, `milton-bats`, `uat-rep-club`; production has none)
opens no new payment, and setting up payouts again makes a NEW Stripe-owned account rather than reusing it. One fee rule
lives in the code. The owner redoes Stripe's hosted test sign-up once per dev club.

**Owner ruling 2026-11-18 (the payout test meets the ruling above): split the pass.** UAT Rep Club holds the 2026-11-17
lead-time payments for the full payout test (on/after 2026-11-25, ruled to run as planned). Mig 498 marked its account
disconnected and it now refuses new payments, but the Payouts tab reads Stripe live through the row's account id (not
`disconnected_at`), so **the payout steps run on 2026-11-25 as planned on the old account — and UAT Rep Club must NOT be
re-created before they are done** (setting up again replaces the account, and the tab would then read the new, empty one).
After them, the owner re-creates UAT Rep Club (Stripe's hosted test form), and the held steps that need a connected club
taking payments — walk §405's Disconnect counts with a page paid, the ending emails (G) and the terms emails (F1–F2) — run
on the new account. They test the leaving flows, not the fee model. `milton-bats` and `dev-club-org` can be re-created at
any time.

**Build (Stage 2 session, 2026-11-18), found in the code beyond the prompt:**
1. **The foreign-card line would bill a Stripe-owned club twice.** `recordForeignCardFee` bills Stripe's published +0.8%
   on every foreign card whatever the account; on a `stripe` account Stripe takes that 0.8% from the club itself. It now
   bills only a payment taken on an `application` account. The dispute and returned/reversed-debit lines read the
   PLATFORM's balance, which is empty on a `stripe` account, so they bill nothing there without a change.
2. **"Too small" must test the whole fee.** The pay routes refused when the application fee reached the total; with the
   margin smaller, a ~$1.40 club-pays payment would pass while the club nets below zero. The rule is now `canOpen()` in
   `lib/online-payment-fee.ts`: the whole fee below the total and a margin above zero.
3. **A reconnect reused the account,** so an old one would have come back. Each account now records its fee setting
   (`org_payment_accounts.fees_collector`); `takesPayments()` refuses an `application` one, and setting up again replaces
   it with a new account under a new idempotency key (`club-account:stripe-fees:<org>`: a Stripe key can outlive a day,
   and the old body under the old key would hand back the old account). The migration marks the three dev rows
   disconnected, so their cards offer "Set up payouts again".
4. **Our share of each payment is stored, never recomputed:** `online_payments.application_fee_amount` (existing rows
   = their `fee_amount`, which is what the old setting took), frozen by the guard. Stripe Tax never sees an application
   fee, so this is the only per-payment source for our GST/HST return.

**Left for Stage 3 (found here, not built):** the Payouts tab map labels a `fee` adjustment on a returned debit "Processing
fee returned" (`lib/online-payouts-map.ts`), which a Stripe fee taken from the club's balance could wear; the bank check's
"on its way" (`lib/bank-club-map.ts`) assumes the book lines net to the payout, off by Stripe's extras on a `stripe`
account; the refund window's "the fee is the club's whole cost" is exact only for a domestic card. Events from a REPLACED
dev account (a refund or dispute on an old dev payment) no longer map to the club's row: dev only, accepted.

**Carried to Stages 4–5 from the Stage 2 reviews (2026-11-18):**
- `/legal`: **never publish `drafts/PAYMENTS_TERMS.md` with §4/§5 as they stand** ("we pay Stripe's fee", "we bill" the
  extras) — add it to the draft's "Before this can be published" list when Stage 5 starts. The published privacy policy
  (2026-11-17) names the club's "monthly invoice for its Stripe fees": a new privacy version ships with Stage 5. The Before
  window carries no line about Stripe's own agreement, its price changes or a negative balance debited from the club's
  bank: Stage 5 §5, earlier only if payments could switch on first. `otherFeesPlan` ("Your plan doesn't change.") no
  longer follows from anything: retire it with the Stage 4/5 words. The billing-address line now reads "FieldLogicHQ needs
  it for the fee it charges", true only while the address-before-payouts step stays (the open Stage 4 call).
- `/accounting` (`PLATFORM_FEE_TAX_COLLECTION_METHOD.md` Stage 2 review): GST/HST Stage 5 reads `application_fee_amount`
  only on rows with `paid_at` set and `livemode`, dates by `paid_at` in Toronto (never `paid_on`), and must SNAPSHOT the
  province/country, rate and tax cents when the fee is taken (`billing_locations` is editable); a returned debit's credit
  record carries its own date. Confirm in the Stage 5 probe that Stripe returns our fee on a debit reversed after it
  cleared. Tax is inside OUR share, not inside `fee_amount`: words that say "the fee includes GST/HST" would overstate it.
- `/strategy` drift check (Facts doc reconcile 2026-11-18): `memory/project_pricing_strategy.md:19` ("GST/HST on top of the
  payment fee") → `/strategy` memory pass; `lib/billing-tax.ts:49` comment (online-payment fee "takes the SAME
  treatment" as the taxed-on-top recovered fee) → `/billing`; the help and terms items as above.

### Stage 3 — The club's books record Stripe's real fee
**Build prompt (2026-11-18, after Stage 5's first part `9b0a05c1b`):**
[STRIPE_OWNED_PRICING_STAGE3_BUILD_PROMPT.md](STRIPE_OWNED_PRICING_STAGE3_BUILD_PROMPT.md). ⚠ **Its census corrects the
paragraph below:** the books already record the WHOLE processing fee (Stripe's standard cost + ours) when the club pays,
so a domestic payment already nets exactly in both modes. What is off: Stripe's extras (foreign card, conversion), unbooked
dispute fees, a returned debit that never reverses the cost line (books one fee low, a defect today), and the Payouts
tab's old-model labels. The owner rules the shape first (A: fix only what is off, recommended; B: split every fee).
Today the club's books record only our fee (and only when the club pays it). Under Stripe-owned pricing Stripe's fee comes
off the club's balance on every payment, whoever pays our fee, and Stripe keeps it on a refund. Each payment's landing
reads Stripe's fee from the charge and books it as its own "Payment processing" cost; refunds leave it in place. The
delicate stage: the land and refund functions for tournaments and leagues, a stored Stripe-fee figure per payment, and the
Payouts tab's existing Stripe-fee lines checked against it.

**Owner rulings (2026-11-18, the Stage 3 session):**
- **(a) Shape A: fix only what is off.** The one "Payment processing" line stays exactly as it is. Stripe's real fee is
  stored per payment; when it differs from Stripe's standard cost the difference is its own cost line, in either payer
  mode. ~~The returned debit takes the cost line back.~~ Withdrawn the same session (ruling (e) below): the census's
  defect (b) does not exist.
- **(b) Dispute fees are booked** as a cost when Stripe takes them (and given back in the books when Stripe gives one back).
- **(c) Wording:** "Stripe's extra · <payment>", "Dispute fee · receipt <n>", in the existing "Payment processing"
  category; `/marketing` checks it.
- **(d) Stand-alone Stripe fees: match and book** (the probe below found them). Once a day, each club's stand-alone
  `stripe_fee` lines are matched to their payment by Stripe's wording and day and booked once on that payment's book. A line
  that can't be matched stays on the Payouts tab and the bank check names it as a Stripe fee to record by hand. (Rejected:
  booking Stripe's listed price at the event, which puts a price list back in our code.)
- **(e) The census's "returned debit leaves the books one fee low" is wrong; the terms narrow instead.** Read in the code
  (`lib/online-payment-landing.ts` `returnDebit`, `reverseDebit`; the webhook): a debit that bounces BEFORE it clears
  (`checkout.session.async_payment_failed`) never landed, so nothing is in the books; Stripe returns its fee and our fee
  is auto-refunded (probe (f)), and only the later $5 "Payment Failure" is unbooked (ruling (d) matches it). A debit
  returned AFTER it clears arrives as `charge.dispute.created` (`online_payment_reverse`): Stripe keeps its fee, takes a
  $5 dispute fee inline, and our fee is NOT refunded (probe (f) "debit disputed", app fee refunded 0). In club-pays mode the
  books are then exact except the $5. **Owner (2026-11-18): narrow the terms, not the product** — `/legal` rewrites
  terms v0.2 §4's exception and §7's returned-debit bullet: our fee comes back when a debit fails before it clears; one
  returned after it clears is handled as a dispute (neither part back, Stripe's $5 off the balance).
- **(f) Found here, in scope under (a): family-pays mode under-books a reversal by the fee.** On a lost card dispute or a
  debit returned after it clears, Stripe pulls back everything the family paid (base + fee) and keeps both fees, but the
  books post only the base ("Dispute lost" / "Returned by the bank"). Probe (e) lost, $105 US card: the club netted
  −$20.84; the books would read −$15.84 with the extra and dispute fee booked. Exists today in both account models. Fix:
  the reversal posts the fee the family paid as the ordinary "Payment processing · …" cost (the line club-pays mode
  already has), stored as the payment's processing cost line.

#### Stage 3 probe results (test mode, 2026-11-18)
Scripts and raw output `.probe/s3/`. The Stage 1 probe account (`acct_1Ud0FDFuSu8KhK2Q`) still held every case; its
balance lines were read, and new rounding charges made on it.
- **Stripe bills some fees LATER, as stand-alone lines with no source.** About 2½ hours after the Stage 1 cases, two
  `stripe_fee` balance transactions appeared, `source: null`, `reporting_category: fee`:
  "Pre-Authorized Debit in Canada (2026-11-18): Payment Failure" −$5.00, and "Card Dispute Countered Fee (2026-11-18)"
  −$15.00. **This corrects Stage 1** ("no failure fee appeared in test mode", "a returned debit nets $0", "dispute won: out
  $15"): a returned debit costs the club $5; an answered dispute costs $15 more. Stripe's Canadian price page (read
  2026-11-18): dispute received $15 (kept); dispute countered $15, **returned for a won dispute**; PAD failures and
  disputes +$5; international card +0.8%; conversion +2%. The countered fee's return on the Stage 1 win had not appeared
  by 16:30 UTC; re-read before building its match.
- **The dispute received fee is attached:** the `adjustment` / `dispute` line carries it in `fee_details`
  (`stripe_fee` "Dispute fee", $15 card / $5 debit), `source` = the dispute. A won dispute's `dispute_reversal` returns the
  amount with fee 0.
- **A returned debit on the club's balance:** `payment_failure_refund` / `charge_failure` −$103.50 with fee −$1.44
  (Stripe's fee returned), then `adjustment` / `fee` +$2.06 "Application fee refund for py_…", `source` = the payment. So
  our fee comes back as an `adjustment` with category `fee` (the Payouts map's `fee_back`), never as its own
  `application_fee_refund` line on the club. Plus the $5 failure fee above, later.
- **Rounding matches to the cent.** Card charges of $5.00, $15.00, $25.00, $35.00, $123.45 and $999.99 (the first four land
  on a half cent): `stripe_fee` = `stripeStandardCostCents` every time (half-up). US/UK card $105: $4.19 = $3.35 + 0.8%
  ($0.84). So a domestic card books no extra line. Bank debits of $10.50, $20.50 (half cents) and $600.00 (the $5 cap):
  `stripe_fee` $0.51, $0.61, $5.00, equal to ours; each debit's balance transaction was made when it cleared.
- **The fee is NOT readable at the moment of success.** Right after `confirm`, `latest_charge.balance_transaction` was
  null on all six cards; it appeared about a second later. The landing must leave the figure NULL and catch it up.

**Built on dev 2026-11-18 (the code half; uncommitted until the owner's word).** Mig 501 (dev applied; prod `pending` in
MANUAL_PROD_STEPS, applied WITH the promote): `online_payments.stripe_fee_amount` + three entry ids
(`stripe_extra_entry_id`, `dispute_fee_entry_id`, `reversal_fee_entry_id`), table `online_payment_stripe_fee_lines`, the
guard freezing them, and the writers `online_payment_stripe_fee_set` (the extra = Stripe's fee less
`fee_amount − application_fee_amount`, so no price list in SQL), `online_payment_dispute_fee_book`,
`online_payment_stripe_fee_line_take` (exactly one candidate or unmatched with a reason), and `online_payment_reverse`
with ruling (f). Every writer acts only on a Stripe-owned account (`online_payment_stripe_owned`), so the old dev
accounts, UAT Rep Club's payout test among them, read exactly as before. Code: the landing reads the fee from the
re-read session (`retrieveCheckout` expands `latest_charge.balance_transaction`), `bookDisputeFee` on every dispute event,
the daily job's `stripe_fee_catch_up` (35 days) and `standalone_stripe_fees` (10 days); the Payouts map links each new line
for the bank check (`fees`, `standalone` in `PayoutEntryIndex`) and relabels `fee_back` "FieldLogicHQ’s fee returned"; the
house-league Money page names the new lines (`STAGE3_LINE_PREFIX`, "Payment processing · Stripe’s extra · …" beside the
existing "fee given back"). Book text: "Stripe’s extra · <payment>", "Dispute fee · receipt N", "Returned debit fee ·
<payment>", and ruling (f)'s ordinary "Payment processing · <payment>". Checks: `scripts/stripe-owned-pricing-501-check.sql`
PASSED (T1–T9, incl. probe (e) lost netting −$20.84 in the books); the 12c, 12d1, 498 and house-league money checks PASSED;
unit tests `online-payment-stripe-fees`, `bank-club-read`, `online-payouts-list`, `online-payments-guard` pass.
Census corrections: defect (b) does not exist (ruling (e)); `application_fee_refund` never lands on the club as its own line
(it is an `adjustment` / `fee`); the daily job had no online-payments catch-up before this.
**Left for the follow-up session** ([STRIPE_OWNED_PRICING_STAGE3_FOLLOWUP_PROMPT.md](STRIPE_OWNED_PRICING_STAGE3_FOLLOWUP_PROMPT.md)):
the words and help below with `/docs` + `/marketing`; `/legal` narrows terms v0.2 §4/§7 (ruling (e)); the bank check names an
unmatched stand-alone fee "to record by hand" (the line is recorded with its reason; nothing on screen yet); the seed
teardown's entry deletes against the three new FKs; the countered fee's RETURN on a win (unseen in the probe: re-read the
probe account's lines, then match it as a credit); `/accounting` and `/review`; the owner walk (Stage 5's step 6).

**Follow-up built on dev 2026-11-18 (the words, help, terms and bank-check half).**
- **Terms (`/legal`):** v0.2 narrowed per ruling (e): §4's exception covers only a debit that fails before it clears; §5's
  bank-debit bullet and §7's returned-debit bullet (now two) follow; the returned-debit NOTE records the probe's later $5
  "Payment Failure". Change log and O4 line say so; **the owner reads the changed sentences**.
- **Words (`/marketing`):** kept "Stripe’s extra · …", "Dispute fee · receipt N", "Returned debit fee · …", ruling (f)'s
  "Payment processing · …" and "FieldLogicHQ’s fee returned". Changed in mig 501 (prod `pending`, so edited in place and
  the two functions re-applied on dev; 501 check PASSED with a new T8b): the answering fee reads **"Dispute fee · answered ·
  receipt N"** (an answered dispute had two identical lines), and a bank debit's attached $5 reads **"Returned debit fee ·
  receipt N"** (the product calls that dispute "Returned by the bank"). `/marketing` proposed "Returned by the bank ·
  Stripe’s fee · …"; not taken: that prefix finds a team's returned line (`lib/online-payouts.ts`, the 12c check). The
  Money page's prefixes cover both unchanged.
- **Bank check:** Find names an unmatched stand-alone Stripe fee ("Stripe fee · not in your books", its amount, "in the payout
  of {day}", link to the Payouts tab) while the check is off and the bank holds less. Never counted in the figure. Placed on
  an account by its payout's other book lines (one with none is named anyway). Fees taken only, never a credit. The
  instruction files it as a bank fee (Admin · Bank & payment fees, the existing "Add a bank fee" door), not an event's
  Payment processing (`/accounting`: matched to no payment, it belongs to no event's net). Read stays select-only (rule 6).
  `ourIndex` no longer skips a payout of stand-alone fees alone on the bank check's read.
- **Help (`/docs`):** tournaments' new answer **"Where the processing fee shows in your books"**
  (`#online-payments-fee-books`, split from "Who pays the processing fee", which had reached 535 words), house-league
  Money, accounting `ledgers-payouts`, `payouts-tab-inside` ("FieldLogicHQ’s fee returned", Dispute covers a debit taken
  back after clearing, Stripe fee), `bank-tab-find`. The refund sentences and `record.choiceHint.club` were re-read and are
  still true (unchanged); the refund window's stale comment rewritten.
- **Loose ends:** the walk seed's reset now clears the three new entry links' lines and the stand-alone fee lines (not run:
  it wipes the walk tournament). The countered fee's **return** was still unseen on the probe account (re-read 2026-11-18,
  `.probe/s3/out-bt-2.txt`): not built; re-read on the payout test. `house-league-money-guard` matched
  `dispute_fee_entry_id` as a house-league write since `b7f8c4d74`; its pattern is now the whole word.
- **`/accounting` review (2026-11-18):** no MUST-FIX; the books net to Stripe's result in every probed case, both modes; no
  FieldLogicHQ tax or record issue (the s.232 credit record stays GST/HST Stage 5). Open, for the owner: (1) the won
  dispute's returned $15 (books overstate by it; the bank check would offer "Add interest"): build the credit once seen;
  (2) unmatched lines are never retried; (3) a dispute fee is skipped when the dispute arrives before the landing; (4) a fee
  still unread after 35 days raises nothing. (2)–(4) change the daily job or the webhook: owner's word.
- **`/review` (2026-11-18, high-risk, four lenses over `b7f8c4d74`, `b04c1b3d7` and this follow-up):** nothing Critical. Fixed
  here, in mig 501 (re-applied on dev, check PASSED): the cost writer books nothing for a tournament whose fee book is off
  (`tournament_fee_book_on`, as the landing books no receipt there); an answered inquiry (`warning_*`) is never a
  countered-fee candidate. In the bank check: only fees taken (never a credit), and only from payouts that arrived after
  the last check that matched (a settled fee is never asked for again). **Owner's word (the daily job runs by itself):** one
  failing club or charge stops each daily step for every club after it (no per-item catch; the catch-up has no order and
  counts skips as recorded); the steps have no time budget ahead of the plan-closing steps; a closed fiscal year makes the
  extra's line raise (the landing re-dates; `stripe_fee_set` does not), so the fee is never stored; unmatched and refused
  lines are final (a line read before our own webhook's stamp stays `no_payment`); the debit-failure window has no D+1;
  Stripe's `tax` fee detail, if live mode bills one, is not counted (unverified). **Owner 2026-11-18: "go ahead and
  harden" — BUILT on dev the same day:** each daily step counts a failing club, charge or line and goes on; the catch-up
  reads connected accounts only, newest first, and counts only real writes (`failed` and honest `recorded` in the audit);
  both Stripe steps run LAST, after the plan-closing and tax steps; a cost line in a closed fiscal year is dated today
  (`online_payment_cost_out`); unmatched and refused stand-alone lines are tried again while the job's 10 days still list
  them, re-checked under the payment's lock; the debit window gains D+1; a dispute fee whose event came before the landing
  is booked from the stored dispute by the catch-up; `stripeFeeCents` counts Stripe's `tax` detail and reads "no
  `stripe_fee` detail yet" as not there (never a stored 0). 501 check PASSED (new T7g); 498 unit tests in reach pass.
- **Next:** commit (A: the follow-up; B: the daily job, its own) and the owner walk for Stages 2–5:
  [STRIPE_OWNED_PRICING_WALK_AND_COMMIT_PROMPT.md](STRIPE_OWNED_PRICING_WALK_AND_COMMIT_PROMPT.md). Deploy order stands: mig 501 BEFORE the code (the Payouts tab reads its
  columns).
- **Committed 2026-11-18:** the follow-up `5e350e26c`, the daily job `b3d54e1ba` (its own commit). **The owner walk for Stages 2–5
  (Stage 5's close) is published:** Owner QA Ledger §541, [STRIPE_OWNED_PRICING_WALK.html](STRIPE_OWNED_PRICING_WALK.html),
  5 walks, 41 steps, on Dev Club Org (a tournament) and Milton Bats (a house-league season); what dev can't show and the older
  walks it replaces are in §541. Found writing it, fixed the same day: on a club setting up payouts again (its account
  disconnected or on the old fee setting) the Before window printed the card rate alone (`app/api/admin/payouts/route.ts`: such a
  club now reads as before setup, both rates). For the walk: the walk seed takes `--org`, and
  `scripts/run-stripe-fees-daily-dev.mjs` runs the daily job once on dev. **The walk PASSED 41/41 (owner paste 2026-11-18).** The project closes on the owner's word; the step 17 finding below is still to build.

**Stage 3's help and words (left by Stage 5, 2026-11-18, for this stage to write WITH its code; `/docs`, same rules: no
dead anchors, `keywords` / `searchText` / `answerText` in the same pass).** Stage 5 ran before Stage 3 and left every
sentence about what the club's books, the Payouts tab or the refund window's cost line record:
- `lib/help-content/tournaments.tsx` `online-payments-fee`, "Where it shows in your books" (club pays → a "Payment
  processing" cost of the whole fee; nothing when teams pay) and the shelf's net sentence under it.
- `tournaments.tsx` `online-payments-refunds`: "The window says so, and it shows in your books as **Payment
  processing**." (Stage 5 rewrote the sentence before it: neither part of the fee comes back.)
- `house-league.tsx` `registrations-refund-card`, "Refund to the card": "it shows on the Money page as **Payment
  processing**".
- `accounting.tsx` `payouts-tab-inside` (~848 "Processing fee returned", ~850 "Stripe fee"), ~112 and ~833.
- `lib/online-payment-words.ts`: `record.choiceHint.club` ("shows in your books as Payment processing"); the refund
  window's `feeOnWhy` / `feeOnChanged`, and the comment above them ("a fee the club gives back is the club's whole cost —
  never 'Stripe keeps part of it'"): under Stripe-owned pricing Stripe DOES keep its part on a refund (terms v0.2 §4), so
  the comment's reason is stale even where the words stay true.
- With Stage 2's "Left for Stage 3" list above (the Payouts tab map, the bank check's "on its way", the refund window's
  domestic-card exactness).
Then Stage 5's close (the owner walk for Stages 2 to 5) runs after this stage.

**Found in walk §541 step 17 (2026-11-18): a dispute that arrives before its payment lands is dropped silently, and Stripe
is told it went fine.** Test card 4000000000000259 disputes the payment at the instant it is charged, so its dispute events
beat the landing by about a second (dev: both dispute events processed at 15:20:42.3, no error; the payment landed at
15:20:43.2; no dispute row, no "Dispute fee" line). `applyCardDispute` and `bookDisputeFee` look the payment up by charge or
intent and, finding none (both ids are stored at the landing), `return` with a 200, so Stripe never redelivers. The existing
"not landed yet, throw so Stripe redelivers" guard only covers a payment already found. A real dispute arrives days later, so
this is a narrow race, not a launch blocker, but the loss is silent (no dispute record, no item for the club, no fee).
- **Fix (small):** when a dispute names a charge/intent the books don't have yet, answer a retryable failure so Stripe
  redelivers, as the found-but-unlanded case already does. Care: a dispute on a charge that will never be ours (another
  platform, a non-FieldLogicHQ payment on the same account) must not retry for ever; bound it (e.g. only while the account's
  newest open payment is under a few minutes old, or cap on the event's `attempts`).
- **BUILT 2026-11-18 (uncommitted):** `applyCardDispute` now throws (Stripe redelivers) when no payment holds the dispute's charge
  AND the account has a card payment started in the last 30 minutes that has not landed (`hasFreshUnlandedCardPayment`); any
  other unknown dispute is let go as before, so nothing retries for ever. A bank debit's dispute can wait up to 30 minutes
  behind an unrelated fresh card payment, then settles. Unit guard extended in `online-payments-card-dispute.test.ts` (21 pass).
  Not yet replayed against dev with the 0259 card: re-run walk §541 W3 steps 13 to 17 without the resend workaround when convenient.
- **Walk workaround (no longer needed once built):** resend the two dispute events with `stripe events resend <id> --account <acct>` once the
  payment has landed (§541 step 17).
- Route the build through `/plan`; it needs a unit test for the not-found-yet case and a replay test.

### Stage 4 — Retire the recovered-fee machinery
The monthly Stripe-fee invoices, their daily job, the club's Stripe-fees list, alert line and overdue banner, the
platform-admin Stripe-fees panel and retry, the invoice emails, the fee kind in the tax records, the foreign-card rate, and
their tests (about 20 code files, 6 dedicated test files, two tables retired by migration with the data dictionary and
snapshots). Owner/`/accounting` call: keep the billing-address-before-payouts step (we still need the club's province for
the tax inside our fee) — likely yes.
**Built before Stage 3** (owner 2026-11-18; the census found them independent). Build prompt, with the census:
[STRIPE_OWNED_PRICING_STAGE4_BUILD_PROMPT.md](STRIPE_OWNED_PRICING_STAGE4_BUILD_PROMPT.md). The daily job stays: it also
runs production's reminders and tax catch-ups. Only its six fee-billing steps go.

**Built on dev 2026-11-18.** Owner calls (2026-11-18): **(a)** keep the billing address before payouts (the Payouts card's
address line now reads the stored address, `hasBillingLocation`); **(b)** drop the tables — mig 499 (dev applied; prod
`pending` in MANUAL_PROD_STEPS, applied WITH the promote, since master's parity gate refuses the code while prod still has
them; the old code's reads fail safe for those minutes; prod held 0 rows, read with the owner's yes); **(c)** keep Sales by
month's "Fees billed back to clubs" row for history (/accounting confirmed; it also recommends NOT narrowing the `'fee'`
CHECK). Dev's open October test-mode fee invoice (UAT Rep Club, $4.59) was **voided** in Stripe before the cut; its three
unbilled fees were never billed, so the 2026-12-01 run is moot. `/review` found two more open test-mode fee invoices (of two
deleted walk clubs, one on a test clock) that Stripe's plain list hides; both voided the same day. A Stripe SEARCH of every
state now finds none open, and no pending fee item sits on any of the 18 dev customers. The fee-invoice marker's readers went too (production never
had a fee invoice); an old dev one read straight from Stripe now shows as "Invoice made in Stripe". The plan-payment pill
survived as `lib/billing-door-alert.ts`. Census corrections: §396 A11 is the dispute email (stays Held; E5, E8, E9
withdrawn); §405's fee steps are F2, F5, F11 and C1 (rewritten), not F4 or A; the foreign-card rate was pinned by
`bank-debit.test.ts`, not the Facts agreement test. Reviews: `/accounting` no MUST-FIX (its topic file retired);
`/legal` (`docs/agents/legal/STRIPE_FEE_INVOICE_RETIREMENT.md`): the 2026-11-17 privacy policy names the fee invoice
(~L34/48/174) — acceptable while payments are off, **MUST-FIX in Stage 5's privacy version before any production club sets
up payouts**; it also lists the payments-terms §4/§5 lines for Stage 5. Help retired with `/docs` (org `stripe-fees` section
gone); the help's remaining "who pays which fee" paragraphs stay Stage 5.

### Stage 5 — Words, help, terms, close
**Build prompt (2026-11-18, after Stage 4 `6dc9c6119`):** [STRIPE_OWNED_PRICING_STAGE5_BUILD_PROMPT.md](STRIPE_OWNED_PRICING_STAGE5_BUILD_PROMPT.md).
It can run before Stage 3, except the help about the club's books and the Payouts tab, and the close, which wait for Stage 3.

**Built 2026-11-18, the part before Stage 3** (Stage 3 not built, so its help moved under Stage 3 above; the close waits):
- **Payments terms v0.2** (`docs/agents/legal/drafts/PAYMENTS_TERMS.md`): §4 "The processing fee, and our fee" (two
  parts; the club's net in each payer mode; tax included, D1-open; neither part refunded; our fee back on a returned
  debit, Stripe's left to its pricing per `/legal`, since the probe was test mode only); §5 "Stripe charges your organization directly" (Stripe's agreement and prices; dispute, returned-debit,
  foreign-card and conversion fees; the net varies; a negative balance is the club's and Stripe may debit its bank; Stripe
  can change its fees); §3, §6, §7, §10, §12 follow. Before list: item 0 (never publish v0.1's §4/§5) and **O4: v0.2
  APPROVED by the owner 2026-11-18**; the privacy version publishes with it (owner call (b) agreed 2026-11-18); the
  default payer setting is left for before switch-on (owner 2026-11-18, O5). Not published. **Dispute figures deliberately not quoted** (Stripe's page read 2026-11-18:
  CA$15 per dispute, CA$15 more to answer it, the answering fee returned on a win, the first fee not; PAD failure or
  dispute + CA$5; the build prompt's "a win does not return them" is true of the first fee only).
- **Privacy policy, next version drafted** (`drafts/PRIVACY_POLICY.md`, wired as the privacy `draftPath`; the filter
  test passes): the billing-address purpose, the email list and the Stripe row no longer name the fee invoice; the
  Payments Terms agreement named in §3's acceptance row and §9's retention bullet; **found beyond the prompt:** §9's
  organization-deletion bullet now lists the Payments Terms record among what survives deletion (mig 497 keeps it with no
  foreign key, so the published text was not quite true). Publishes with the payments terms (owner call (b)).
- **Before window:** one new line under "What it costs" (`before.stripeTerms`): Stripe's agreement and prices apply,
  Stripe can change its fees, a negative balance is the club's and Stripe may take it from the club's bank.
- **Help** (`/docs` rules): `online-payments-setup` "What it costs", `online-payments-fee` (two parts; full entry fee
  less Stripe's foreign-card/conversion extra), `online-payments-refunds` and `registrations-refund-card` (neither part
  comes back), both `-dispute-ends` ("Lost": neither part; "The fees.": a win does not return the dispute fee),
  `settings-t-payouts` (the check: "from the current rates", the fee covers both), `bookkeeping-stripe-fees` (most
  card-processing fees never reach our statement; our fee is money in, never this expense); `bookkeeping-sales` read as
  history (no change); both sections' `searchText` carry the new terms.
- **Records:** the Facts doc's terms clause answered (v0.2 §5); Stage 12 §0d's fee row marked superseded; RPAA re-verify
  triggers gain `fees_collector` / `losses_collector` and a dated census update; `CARD_SURCHARGE_PAYER_FEE.md` gains the
  cost-of-acceptance flag (and the payments terms' lawyer's-eye item 1).
Payments terms §4/§5 (`/legal`), help articles (org, tournaments, house league, accounting, platform admin — `/docs`),
the Facts doc's riders, accounting topic files (`RECOVERED_STRIPE_FEES_TAX.md` retires), the Stage 12 plan's §0d table.
**`/accounting` review, 2026-11-17 (Stage 1):** confirmed — the tax base is our application fee only; the tax is included
(13/113 ON, 14/114 NS, 15/115 NB/NL/PE, 5/105 elsewhere) by the club's billing address, a US club 0%; the tax point is the
charge date (a debit's fee shows on our balance days before it settles: an accountant check). Stripe Tax never sees an
application fee, so **our own per-fee record is the only source for the return** (Stage 2's stored application fee, then
GST/HST Stage 5). A returned debit auto-refunds our fee: the tax comes back off only with a credit record (s.232), so Stage 5
writes one. A club-ticked refund or a lost dispute leaves our fee and its tax in place. Files:
`PLATFORM_FEE_TAX_COLLECTION_METHOD.md` (superseded by "The R1 method"), `RECOVERED_STRIPE_FEES_TAX.md` (retires in Stage 4),
the accountant list `STRIPE_OWNED_PRICING_ACCOUNTANT_QUESTIONS.md` (D1 first; the new facts lean slightly toward taxable, not
a conclusion). It recommends **keeping the billing-address-before-payouts step**: the province must be known before the
first fee.

#### Help articles to rewrite (found in Stage 2, 2026-11-18)

Found by `/docs`, not edited (the build prompt: do not rewrite these twice). Paths are `lib/help-content/`; line numbers
are the 2026-11-18 file state and will drift, so re-grep by article id. **Retires 4** = the article describes the monthly
Stripe-fees invoice machinery, so it is cut or collapsed when Stage 4 deletes the machinery. **Rewrite 5** = it stays but
its words about who pays which fee change. Every one of these is still true for any account that is on the old model until
Stage 4. Every entry also has `keywords` / `searchText` / `answerText` terms to clean in the same pass (noted where they
sit). Nothing found misleads a club today: online payments are off in production.

**Org (`org.tsx`)**
- 1780-1844, section `stripe-fees` "Stripe fees on your online payments", all four sub-topics (`stripe-fees-which`,
  `-where`, `-list`, `-alerts`): "FieldLogicHQ passes them on to every club on every plan", "billed to the club at
  FieldLogicHQ's published rate" (foreign card), "A club with a paid subscription gets each fee as a line on its next
  FieldLogicHQ invoice", the Stripe fees list, "A number on Plan & billing", "A red line on every admin page". **Retires 4**
  (the whole section; its anchor `#stripe-fees` is linked from `org.tsx` 1709, `tournaments.tsx` 1274 and
  `house-league.tsx` 1614, so those links go with it). Section `keywords` (1784) and `searchText` (1785) are all fee-invoice
  terms: drop them with the section.
- 1709, sub-topic `settings-t-payouts-related` "Payouts: terms, the payouts list and Stripe fees": "Other Stripe fees, such
  as for disputes, returned bank debits and cards issued outside your country, are billed to the club. FieldLogicHQ passes
  them on to every club on every plan". The quoted note is card copy from `lib/online-payment-words.ts`. **Retires 4.**
  The section `keywords` / `searchText` (1688, 1689: "returned bank debit fee", "card dispute fee", "foreign card",
  "invoice of its own", "stripe fees passed on", "next fieldlogichq invoice") go with it.
- 1699, sub-topic `settings-t-payouts` "Payouts: let teams pay online": "chooses who pays the processing fee ... The card
  prints both rates ... under the Processing fee row ... What it costs". The family-facing rate is unchanged, so only a
  re-read against terms §4 (the row name and the worked line) is owed. **Rewrite 5 (check only).**
- 389, section `club-plan-and-billing`: "a line at the top while you owe an invoice for Stripe fees ... Stripe fees when any
  exist". **Retires 4.** `searchText` 384 carries "stripe fees taxed".
- 437, sub-topic `club-plan-and-billing-t-taxes`: "Stripe fees we bill back to the club carry the same tax." **Retires 4.**

**Tournaments (`tournaments.tsx`)**
- 1205, sub-topic `online-payments-bank-debit-returned`, note "When Stripe charges a fee for a debit that comes back": "billed
  to the club at Stripe's own figure as a Returned bank debit line on its next FieldLogicHQ invoice ... A club with no
  subscription invoice is sent an invoice of its own ... Cards issued outside your country carry an extra Stripe fee,
  passed on the same way." **Retires 4**, and what replaces it (Stripe takes it from the club's balance at Stripe) is
  **Rewrite 5**.
- 1274, sub-topic `online-payments-dispute-ends`, "The fees." paragraph: "If you win, Stripe gives the answering fee back
  and FieldLogicHQ returns it: taken off the invoice that charged it ... either taken from the club's Stripe balance, or
  passed on to the club on a FieldLogicHQ invoice ... never both." **Retires 4** (the invoice branch); the Stripe-balance
  branch stays and the paragraph becomes the one-way answer in Stage 5.
- 1007 / 1008, section `online-payments` `keywords` and `searchText`: "returned bank debit fee", "next fieldlogichq invoice",
  "invoice of its own", "stripe fees passed on every club", "foreign card", "dispute fee", "answering fee comes back if you
  win". **Retires 4.**
- 1090-1092, sub-topic `online-payments-fee` "Who pays the processing fee": "The fee comes out of each payment, so you
  receive the entry fee less the fee", and 1032 `online-payments-setup` "What it costs". The family rates and the club's
  net are unchanged, but "the processing fee" is now Stripe's fee plus our margin taken separately. **Rewrite 5.**
- 1230, sub-topic `online-payments-refunds`: "FieldLogicHQ's processing fee is never refunded, so a processing fee you give
  back comes from the club", and 1272 (`online-payments-dispute-ends`, "Lost"): "FieldLogicHQ's processing fee isn't
  returned." Legal §4: "not refunded" now covers our margin only, Stripe also keeps its fee on a refund, a returned debit
  gives both back. **Rewrite 5.**

**House league (`house-league.tsx`)**
- 1637, sub-topic `registrations-bank-debit`: "When Stripe charges a fee for a debit that comes back, it is billed to the club
  at Stripe's own figure as a Returned bank debit line on its next FieldLogicHQ invoice ... A club with no subscription
  invoice, such as a complimentary or free plan, is sent an invoice of its own. Stripe's fees are passed on to every club on
  every plan. Cards issued outside your country carry an extra Stripe fee, passed on the same way." **Retires 4**, plus
  **Rewrite 5** for the replacement sentence.
- 1614, sub-topic `registrations-dispute-ends`, "The fees." paragraph (same sentence as `tournaments.tsx` 1274, including
  the `#stripe-fees` link). **Retires 4**, then **Rewrite 5** as above.
- 1371 / 1372, section `registrations` `keywords` and `searchText`: "stripe fees", "dispute fee", "answering fee returned",
  "refunded to the card". **Retires 4.**
- 1547 (`registrations-refund-card`) and 1611 (`registrations-dispute-ends`, "Lost"): "When it is ticked the club pays that
  fee back" and "FieldLogicHQ's processing fee isn't returned." Same legal §4 point as tournaments 1230. **Rewrite 5.**

**Accounting (`accounting.tsx`)** (`payouts-tab` section)
- 848, `payouts-tab-inside`, "Returned by the bank": "Processing fee returned when our processing fee came back with it."
  The fee that comes back is now both Stripe's and ours. **Rewrite 5.**
- 850, same sub-topic, "Stripe fee": "A Stripe fee taken from the club's own balance." Already describes the new model but
  covers only disputes and a debit's fee on the payout listing: re-read against what the payout detail actually prints
  after Stage 2. **Rewrite 5 (check only).**
- 112 (`ledgers-payouts`, "A processing fee the club pays shows in the tournament's own book as Payment processing") and 833
  (`payouts-tab-list`, "Amount ... after the processing fee when the club pays it): the figures are unchanged, so these
  probably stay; `searchText` 812 has "processing fee returned" and "stripe fee". **Rewrite 5 (check only).**

**Platform admin (`platform-admin.tsx`)**
- 422 (`club-online-payments-panels`, "Fees billed to the club"): "Each Stripe fee passed on to the club and where it was
  billed. Retry is not here: it stays on the club's Money tab." **Retires 4.**
- 409 (`club-online-payments-tab`, "Open disputes": "with the Stripe fees on them so far"). **Retires 4** (the fee figure
  becomes Stripe's, not ours).
- 438-439 (`club-online-payments-health`): "a Stripe fee that couldn't be billed", "an invoice for Stripe fees that is
  unpaid", and the closing line "or the invoice is paid". **Retires 4.**
- 451 (`club-online-payments-delete`) and 2156 (`delete-organization`): the "money in flight" list names "a Stripe fee not
  yet billed ... a Stripe fee that couldn't be billed, or an unpaid invoice for Stripe fees". **Retires 4.**
- 388 / 389, section `club-online-payments` `keywords` and `searchText`: "fees billed to the club", "stripe fee", "a stripe
  fee couldn't be billed", "an invoice for stripe fees is unpaid", "stripe fee unbilled failed unpaid fee invoice".
  **Retires 4.**
- 1223 / 1241 (`replay-stripe-update`, "What it refuses"): "a club's Stripe-fees bill are refused" and `searchText` "stripe
  fees bill later". **Retires 4.**
- 725 / 786 (`bookkeeping-sales`, `bookkeeping-sales-month-and-files`): "the split by kind (Plans, Coach Premium, Fees billed
  back to clubs, One-off charges)" and `searchText` "fees billed back to clubs". **Retires 4** (the kind goes with the
  fee record; the Stage 4 line already lists "the fee kind in the tax records").
- 798-817, section `bookkeeping-stripe-fees` "How to enter Stripe's monthly fees as an expense": "Stripe's fees to
  FieldLogicHQ", "Card-processing fees carry no GST/HST", and the warning "Fees billed back to clubs are income, not this
  cost". Under the new model most card-processing fees never reach us, so what the owner enters from the statement shrinks
  to Billing/Tax/Radar/Sigma plus any old-model account. `keywords` / `searchText` (802, 803) include "processing fees",
  "payouts are net", "fees billed back to clubs are income". **Rewrite 5** (with `/accounting`; the retired invoice
  sentence goes in Stage 4).

**Families (`families.tsx`)**: nothing to change (181, 215 say only that the processing fee is never counted as dues).

**Shared source of the sentences:** `lib/online-payment-words.ts` (already in the `/legal` bullet below). The org card note
at `org.tsx` 1709 and the tournaments / house-league notes quote it, so fix the words once there, then re-read the articles.

**`/legal` read, 2026-11-17 (Stage 1), what Stage 5 must carry:**
- `drafts/PAYMENTS_TERMS.md` §4: cut "out of it we pay Stripe's own processing fee"; Stripe takes its fee from the club's
  balance and ours separately; tax "plus" → "included" (D1 still open); "not refunded" covers our margin, and Stripe also
  keeps its fee on a refund; a returned debit gives both fees back; the club's net in each payer mode. §6's "the whole
  fee comes out of your balance" gets the same split.
- §5 ("Other Stripe fees we bill") is replaced by "Stripe charges your organization directly": Stripe's agreement and
  pricing; disputes ($15 card / $5 debit, not returned on a win), foreign card, conversion; the net varies; the club's own
  negative balance first, with Stripe able to debit its bank (we promise nothing about Stripe's backstop); Stripe can
  change its fees. §3, §7, §10 and §12 mention the billed fees too.
- **Privacy policy version 2026-11-17** (`lib/legal-documents/privacy/2026-11-17.md` ~L34, L48, L174) names "a club's
  monthly invoice for its Stripe fees": true until Stage 4, so a new privacy version ships with the payments-terms
  rewrite. The billing address stays needed (the tax inside our fee), so that row's purpose changes, not the data.
- Product words in `lib/online-payment-words.ts` (~L97-100, 397, 427, 503, 1280-1405) describe the billed fees →
  `/marketing` + `/docs` in Stage 4/5.
- `CARD_SURCHARGE_PAYER_FEE.md`: the family fee stays above Stripe's real cost with our margin as the gap, which sharpens
  the "no more than the cost of acceptance" point a little; the owner's O2 ruling stands. Flag for a lawyer's eye.
- Money services (`RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`): **neutral to slightly helpful** (Stripe still nets our fee;
  we carry no pass-through). Add `fees_collector` / `losses_collector` changes to its re-verify triggers; re-read it
  before accepting any Stripe revenue share.

Owner walk. Then GST/HST Stage 5 (reshaped: the tax inside our fee recorded per paid fee so Bookkeeping and the return
pick it up, and an information-only fee statement in Plan & billing) can build on the final fee shape.

## Open asks for the owner

1. ~~The full payout test booked for on/after 2026-11-25 runs on today's model.~~ **RULED 2026-11-17 (owner): run it as
   planned** — it proves payouts reach a bank, which does not change; the fee lines are re-tested after Stage 3.
2. Rate design (Stage 1 step 3).
3. Keep the billing-address step before payouts (Stage 4) — recommendation yes.

## Risks

- **Preview API.** Express + Stripe-owned pricing is a 2026-06-24 preview; a preview can change. Our accounts already
  ride a preview; Stage 1 probes it, and the fallback is today's model.
- **The club's net varies** by Stripe's own extras. Words must say so plainly.
- **Sunk work.** The recovered-fee invoicing and fee-invoice alerts were built and walked. They are retired, not reworked.
- **The figures above are estimates** from Stripe's public pages; Stage 1's balance transactions replace them.
