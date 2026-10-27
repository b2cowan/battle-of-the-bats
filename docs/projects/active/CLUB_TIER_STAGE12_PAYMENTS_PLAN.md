# Club Tier Stage 12 — families pay online (plan)

> Opened 2026-10-24 with a drawing round (kickoff: `CLUB_TIER_STAGE12_KICKOFF_PROMPT.md`). Drawings: the Club Payments
> Drawings artifact (source `CLUB_TIER_STAGE12_DRAWINGS.html`, built by `.probe/s12/build.mjs`). PM brief:
> `CLUB_TIER_STAGE12_PAYMENTS_PM_BRIEF.md`. Parent: `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` § Stage 12. Decisions that bind
> it: `FACILITATED_PAYMENTS_SCOPING_PLAN.md`, `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-07-28), Stage 9's rulings
> (`HOUSE_LEAGUE_STAGE9_PLAN.md` §0, §0b, §2, §6a) and its payments contract (`CLUB_TIER_STAGE9_DEEP_DIVE_PROMPT.md` §4).
> **Rates live only in `docs/agents/strategy/PLAN_PRICING_FACTS.md`; the build reads them from `lib/plan-config.ts`.**
> No release timing: the Club release ships when every stage is complete and tested.

## 0 · State

- **Drawn 2026-10-24. All 15 asks RULED 2026-10-25, every one as recommended** (§0b). 12a built on Accounts v1 and
  committed `6f64e41cf`, `e87741f69`, `dc84cd49d` (+ help `c2c1eba12`). **Its account half was rebuilt on Accounts v2
  on 2026-10-25 (§0d "Built"; migration 364 on dev)**, after the first walk stopped at Set up payouts because Stripe
  refuses v1 account creation. The walk is owed again.
- A14 logged by /strategy 2026-10-25 (BUSINESS_DECISIONS.md; the Facts doc rider closed). **12a build prompt written
  2026-10-25: `CLUB_TIER_STAGE12A_BUILD_PROMPT.md`.** The owner moved the tournament card flow into 12a so it can be walked
  end to end; 12c is now bank debit for both flows. 9b-2 walked and closed 2026-10-25 (ledger §378), so 12b is
  unblocked: **12b build prompt written 2026-10-25, `CLUB_TIER_STAGE12B_BUILD_PROMPT.md`** (census at `9c1545220`).
- **12b BUILT 2026-10-25** (owner rulings §0e; words `CLUB_TIER_STAGE12B_COPY.md`), committed `aba98a7e6` (Part 1, mig 374,
  /dba + /review) · `40f7c5731` (Part 2) · `87cf762eb` (Part 3) · `7c69367b2` (Part 4) · `3ae979ef6` (Part 5, mig 375) ·
  `b3cb15e2b` (Part 6) · `1a2ca5bd4` (/review of Parts 2–6, mig 376, help). Migrations 374–376 applied to dev 2026-10-25
  (declared prod-pending, after 361–363 and 368–372); scripts/house-league-money-check.sql 34/34 on dev. Walk §380 owed.
  **Owner calls 2026-10-26 (§0f):** the treasurer does not refund, in either flow (built, same day); a PARTIAL refund of a
  tournament team's card payment moves to **12c** (§4). **Not built, named:** the Families record's "Paid online · card ·
  receipt" line (b4) — the record window had another session's edit in flight; "View the payment" in the row ⋯ (b3) —
  the receipt number is on the row.
- **12c BUILT 2026-10-26** (prompt `CLUB_TIER_STAGE12C_BUILD_PROMPT.md`; rulings §0g–§0k; words
  `CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md`), committed `293990174` (Part 1, mig 382, /review) · `855175d74`
  (Part 2, mig 383) · `5f3af63d4` (Part 3, mig 384) · `171a4ea91` (Part 4) · `960f2fd77` (Part 5, mig 386, /review) ·
  `906aeb420` `966fc11af` `b9eefac19` `3e2c5e8ad` (Part 6a–6d, mig 387) · `057a22f1c` (Part 7) · `164c6d885` (/review of
  the whole, mig 388) · `795119498` (Part 8, help + the setup guide). Migrations 382–384 and 386–388 applied to dev
  2026-10-26 and declared prod-pending in MANUAL_PROD_STEPS.json (385 is 9d-1's). `scripts/online-payments-12c-check.sql`
  T1–T30 on dev; house-league-money-check and the stage 7 atomicity checks still pass. Sandbox: the UAT club's account has
  `acss_debit_payments` active and a bank-debit Checkout opens on it as a direct charge with our fee; Stripe sends the
  agreement and each debit's notice itself. **Walk §389 (a refund you can see, a refund made in Stripe, a team's part
  refund) walked 2026-10-26, 44 of 44 checked, 8 marked Held (B9, D6, E12, G1–G5).** **Walk §390 (bank debit) walked 2026-10-26, 32 of 32 checked, 4 marked Held (A4, C6, E3, F6), no changes asked.** The returned CA$5 is `RETURNED_BANK_DEBIT_FEE_CENTS` (`lib/plan-config.ts`, Facts doc).
  **Owner step:** the Connect destination on Amplify dev and prod also sends `checkout.session.async_payment_failed` and
  `charge.dispute.created` (`docs/agents/ops/stripe-setup-guide.md`). **Named, not built (from /review):** a part deposit
  clearing hides past due for the whole team; a mixed bulk pay-link skip names one reason; a returned-debit fee whose invoice
  line failed is not retried by itself (the console's follow-up); a send-back is carried out in the decider's name without
  re-checking their right days later. **Not run by the builder:** a debit paid, returned and reversed through Stripe's own
  Checkout (a browser and a forwarded webhook; walk §390 drives them), and `check:layout` (the UAT club owner's session lands
  on "Page not found" on every admin screen, the hub included).
- **12d drawn 2026-10-26; all 13 asks ruled 2026-10-26 (rulings below)**: https://claude.ai/artifact/WutBgX8o56jBWN2zXXvZvg (source
  `docs/projects/active/CLUB_TIER_STAGE12D_DRAWINGS.html`, prompt `CLUB_TIER_STAGE12D_DRAWING_PROMPT.md`). Six frames
  (card dispute, paid twice, payouts list, leaving, terms read-out, platform-admin Online payments tab) + three decision
  pages (D1 GST/HST with a forwardable accountant sheet, D2 cards from outside Canada, D3 dispute cost); /ux + /design ran
  and are reported on the page. **Found first: a tournament team's online payment books silently past what the team owes**
  — `online_payment_land` (mig 382) passes the stored base to `tournament_team_payment_record` (mig 345), whose only amount
  check is >0 and ≤1,000,000; the desk's hand-recording refuses only while a debit is `clearing`, not while a Checkout
  session is `open`, so "contact opens Pay now, desk records the e-transfer, contact finishes the page" overpays with no
  item (asks 10 + 12). Stripe facts read 2026-10-26 (on the page's Start tab): CA$15 dispute fee never returned + CA$15
  answering fee returned on a win, both billed to the platform under `fees_collector: 'application'`; Express-dashboard
  dispute management with Stripe-covered losses is a public preview (build to confirm); payout contents listable for
  automatic payouts only. Two placements changed by review: the payouts list is an Accounting › Payouts tab (Settings is
  owner-only, so the treasurer never sees the Payouts card), and amber goes only to the person who can answer a dispute
  (only the person who set up payouts can sign in to Stripe). No plan text said "the platform carries losses"; nothing to
  correct.
  **⚖ Owner rulings 2026-10-26 (the three decision pages; asks 2–7 and 10–13 still open):**
  - **Ask 8 · GST/HST on the processing fee: paused.** "We are pre revenue and well below the 30k threshold." Nothing
    changes on any screen. *Revisit trigger (recommended, not ruled):* the threshold counts the whole application fee
    FieldLogicHQ takes (not its margin after Stripe), so fee revenue reaches it at roughly $850,000 of card volume.
  - **Ask 9 · Cards from outside Canada: (b), charge more for a foreign card**, plus a note to review the set-up later for
    clubs located in the US (USD cards paying USD clubs, where the fee treatment would differ). *Checks before build
    (owed, not ruled):* Stripe's surcharge is a preview (Canada: credit cards only, max 2.4%, "consistently across card
    networks or card products") and is not in hosted Checkout, so the pay flow becomes card-first; counsel's card-surcharge
    question (§6) now covers it.
  - **Ask 1 · Card dispute fees: the club is invoiced, free and comped clubs INCLUDED** ("we especially don't want to give
    free clubs incentive to rack up many $15 charges on us with no ability for us to recoup since we are comping them").
    Amount = Stripe's own figure at the time; the answering fee Stripe returns on a win comes off the club's bill.
    *Open for the build:* a comped club has no subscription invoice until its comp ends (`billDebitFee` exempts
    `comped` / `no_subscription` for exactly this reason), so it needs a standalone invoice, and what happens when one goes
    unpaid. *Owner's call, asked:* whether the CA$5 returned bank debit fee (§0k answer 2, comped clubs exempt) should
    follow the same rule — not changed. **→ Answered in round 2: yes.**
  **⚖ Owner rulings 2026-10-26, round 2 (paste-back): ALL 13 ASKS RULED.**
  - **Comped clubs, widened (owner):** "comped clubs do not get any reprieve on Stripe fees in any capacity, we are only
    comping their subscription." So the **CA$5 returned bank debit fee is billed to comped clubs too**, which CHANGES §0k
    answer 2 (built in 12c: `billDebitFee` stamps `exempt_reason = 'comped'`); 12d's build removes that exemption. Ask 1:
    A, with free and comped clubs NOT exempt (owner note: "as discussed").
  - **As recommended:** 2 (no family email from us) · 3 (book line stays while open; lost = a returned line beside the
    receipt and the child or team owes again; won = plain paid) · 4 (one downgrade rule; payouts stay connected) · 5 (an
    Accounting › Payouts tab for everyone who reads Accounting; the same list collapsed on the owner's Payouts card for a club
    without Accounting) · 6 (new terms: a notice + an owner item, payments stay on; the new version required to set up
    again, reconnect or change who pays the fee; Agree absent until ticked in both windows) · 7 (read only: a club tab + one
    Health list) · 10 (book an overpaid team payment, flag it, refund door set to the extra) · 11 (every ending closes open
    pay pages and counts them) · 12 (recording by hand warns and closes the open page) · 13 (one Copy of the facts for
    Stripe).
  - **Ask 8: (a) no tax on the fee**, the paste-back's form of round 1's "pause". **Ask 9: (b)**, as in round 1.
  **⚖ Owner ruling 2026-10-27 (round 3):** a club with no subscription invoice to ride on (comped, free) is sent **its own
  invoice**, "that they pay via Stripe that we track in platform admin like other payments." This closes round 1's open
  mechanism question for both the dispute fees and the CA$5 returned-debit fee. It was the recommendation he agreed to, so
  an unpaid one shows in platform admin and **nothing switches off by itself**. Not ruled: whether a standalone invoice goes
  out per fee or gathers them.
  **⚖ Owner ruling 2026-10-27 (ask 9 changed): bill the CLUB for a foreign card's extra cost**, on the same Stripe-fees
  bill, from Stripe's own figure. It **replaces ask 9's (b)**: the family is never charged more, so there is no surcharge
  and no card-first pay step. Owner: "this is not something we should cover and they should understand there could be
  additional charges if they run a tournament and host a team from another country ... let's just make sure our terms
  explain that these additional charges are possible." → counsel's terms must say so (§6).
  **⚖ Owner 2026-10-27, the words' §7 (`CLUB_TIER_STAGE12D_COPY.md`) plus two held items: all as recommended.**
  - **Wording:** say "a card issued outside **your country**", never "outside Canada" ("we may have club owners from the
    US").
  - **The rulings, as numbered in the words file's §7:**
    1. A won dispute's returned fee is "credited to your account".
    2. A comped club's own invoice comes in our email (Stripe's own invoice email off).
    3. An unpaid one gets one reminder email and a Health row.
    4. "Fraud" is never printed.
    5. A club keeping a team's overpayment is a note ("Keep it"), not a credit.
    6. The Payouts tab is hidden for a club that never connected.
    7. One "other Stripe fees may be billed to you" line near the rates, in the set-up window and on the Payouts card.
  - **The two held items:** a lost dispute does **not** return FieldLogicHQ's fee (same as §0c). A refunded payment
    leaves Stripe's foreign-card extra the club's.
  The build is split in two (12d-1: overpayment, disputes, billing every club; 12d-2: payouts
  tab, leaving, terms, platform-admin view): `CLUB_TIER_STAGE12D1_BUILD_PROMPT.md`, `CLUB_TIER_STAGE12D2_BUILD_PROMPT.md`.
- **12d-1 build state (opened 2026-10-27).**
  **⚖ Owner 2026-10-27, the build's four asks (all as recommended):**
  1. **Go on the UX summary**, including: every hand-recording path closes an open pay page (Record a payment, Mark paid,
     Mark received, AND check-in, the bulk Mark paid, import, team creation — found in the census; only the three drawn
     screens show the warning); and the **fallback**: if Stripe's own figure for the foreign-card extra (or a dispute fee)
     cannot be read per payment, it is billed from Stripe's published rate held as ONE constant beside
     `ONLINE_PAYMENT_RATES`, matched to the Facts doc (the CA$5 debit fee is held that way already).
  2. **One new daily scheduled job** (owner asked for it, this conversation): the dispute email three days before it is due,
     the one reminder on an unpaid fee invoice, and the monthly fee invoice. Its own commit (AGENCY_RULES, watched paths).
  3. **A club with no subscription invoice gets ONE invoice a month, sent on the 1st**, gathering the month's fees. (The
     prompt's "sent when the first fee of the month arrives" was dropped: every later fee that month would wait for the
     next month's first fee, which may never come.)
  4. **The club reads its Stripe fees on Settings › Plan & billing** (a short list: what, when, billed / unpaid, Pay the
     invoice) plus the fee line already on the dispute or returned-debit record.
  Builder's call, stated to the owner: a dispute is its own record (a table), not columns on the payment.
  **Resolved from the words, not reopened:** a CANCELLED club is invoiced too (round 3 "no subscription invoice → its own
  invoice"; the words doc §1.7 wins over D3's "those fees are ours"); the dispute emails go to the person who set up payouts
  alone (words §1.6 wins over the drawing's provisional "and the owner if they differ").
  **Stripe facts, read 2026-10-27 from Stripe's current docs (API `2026-04-22.dahlia`; accounts on `2026-09-30.preview`):**
  - Code census: no comp is a Stripe object. Free time and the Founding comp are `org_overrides` rows; a Founding club has no
    `stripe_subscription_id`; there are no coupons/discounts anywhere. So "a discount eats the fee line" cannot happen today,
    and every comped/free/cancelled club takes the standalone invoice.
  - Disputes on our direct charges arrive on the Connect webhook (`event.account` set): `charge.dispute.created`,
    `.updated`, `.closed`, `.funds_withdrawn`, `.funds_reinstated` (docs list them; they state no order — build for any).
    Statuses `warning_needs_response`/`warning_under_review`/`warning_closed` (an inquiry, mostly Amex/Discover; no fee when
    resolved), `needs_response`, `under_review`, `won`, `lost`, `prevented`; won/lost is the `status` itself. More than one
    dispute per charge is possible ("extremely rare"); a lost dispute can later turn to won. `evidence_details.due_by` = the
    answer-by time (0 when the bank allows no response). The disputed amount comes out of the CONNECTED account's balance;
    with `losses_collector: 'stripe'`, Stripe covers a negative balance.
  - **The dispute fees are the PLATFORM's** (`fees_collector: 'application'`): received fee and countered (answering) fee,
    the latter returned on a win (disputes after 2025-06-17). Stripe's figures today: CA$15 + CA$15 (never typed: printed
    from the record).
  - Answer in Stripe: the Express Dashboard manages disputes, and with Stripe-covered losses it cannot be turned off;
    reached by our single-use login link (`dashboardLink`), then a code to the account's email/phone. Never emailed.
  - Foreign card: the charge carries `payment_method_details.card.country`; Stripe's fee is paid by the PLATFORM. Published
    CA rate: +0.8% for an international card; currency conversion (+2%) cannot apply (a CAD charge on a CAD account).
    `fee_details` lists only `stripe_fee` / `application_fee` / … — no international line (to confirm by probe).
  - Standalone invoice: `invoices.create` (`collection_method: 'send_invoice'`, `days_until_due`,
    `pending_invoice_items_behavior` defaults to `exclude` → items are created with `invoice:`), finalize without
    `sendInvoice` and with `auto_advance: false` → Stripe sends no invoice email; `hosted_invoice_url` after finalizing;
    `invoice.paid` says paid (also for paid-out-of-band). Stripe Invoicing (Starter): 0.4% per paid invoice; credit notes
    on a paid invoice can credit the customer balance (applied to the next invoice).
  - **Sandbox probe, 2026-10-27** (`.probe/s12d1-dispute-probe.cjs`, `s12d1-debit-probe.cjs`; the 12a walk club's test
    account, `fees_collector: 'application'` confirmed on it): **a CARD dispute's CA$15 fee came out of the CLUB's own
    Stripe balance** (the dispute's balance transaction on the connected account: amount −50.00, fee 15.00 "Dispute fee",
    net −65.00; nothing on the platform's balance), **contradicting the docs' fee-payer table**. **A BANK DEBIT's dispute
    fee (CA$5) was charged to the PLATFORM** (a platform `stripe_fee` balance transaction "Dispute fee", −5.00, whose
    `source` is the dispute id), nothing on the club's. A failed debit drew **no failure fee on either side**, and Stripe
    returned our application fee to the club by itself. No countered (answering) fee appeared anywhere after evidence was
    submitted by API. Card processing fees do not appear on the platform's balance per charge (a bank debit's do, `source`
    = the charge), so **the foreign-card extra has no per-payment Stripe figure → the ruled fallback (the published rate,
    one constant)**. A lost dispute withdrew the WHOLE charge (our application fee included) from the club and left our
    fee untouched (matches the held ruling: a lost dispute does not return our fee). Events seen: `created` →
    `funds_withdrawn` → `updated` (under_review) → `closed` / `funds_reinstated`; an inquiry (`warning_needs_response`)
    takes nothing.
  **⚖ Owner 2026-10-27, after the probe:**
  5. **Bill only what Stripe charged us.** Each dispute is read from Stripe: a fee Stripe took from the club's balance is
     recorded on the dispute and never invoiced; a fee Stripe charged FieldLogicHQ (a platform balance transaction whose
     source is the dispute) is billed at Stripe's figure. A club is never charged twice. If live charges us without a
     per-dispute record, we absorb it until confirmed with Stripe (the builder drafts the support question).
  6. **The new sentence for a fee taken from the club's balance, as drafted:** "Stripe took its dispute fee,
     {disputeFee}, from the club’s Stripe balance." After an answer: "Answering added {answeringFee}, also from the
     club’s Stripe balance. It comes back if you win." Printed only when Stripe reports each figure.
  **Found, not ruled (for the owner at the end of the build):** under ruling 5's principle, 12c's CA$5 for a RETURNED
  (failed) debit is billed from the constant though the sandbox showed Stripe charging nobody for one; a REVERSED debit's
  fee does have Stripe's own figure (the platform balance transaction above), which Part 4 reads instead of the constant.
  **Part 2 (paid twice) committed `23510b099` 2026-10-27, no schema change.** Built as the words say, with these builder's
  calls for the walk: the item has one link (items carry no buttons), which opens the team with the refund window set;
  the census found **nine** hand-recording paths (adds the shared payment and the Families record; team creation has no
  page to close), all of which close an open page, and the three drawn screens warn; "Keep it"'s title, toast and
  settled line drop "as a credit" to match ruling 5, and "The dispute was lost." is a derived settled line (both owed to
  `/marketing`). Layout check skipped (the UAT fixture's screens were missing, untouched ones too). Next:
  `CLUB_TIER_STAGE12D1_PART3_PROMPT.md`.
  **Part 3 (card disputes) committed `20525a222` (server), `77cddf92b` (screens), `717f6811b` (its /review) 2026-10-27, no
  schema change.** Every `charge.dispute.*` event re-reads the dispute from Stripe and writes it once; a bank debit keeps
  12c's path. Builder's calls for the walk: the desk gets its own quiet copy of the item (words §1.4 `titleOthers`; the
  handoff read "item to the answerer only"); "Copy the facts" is one labelled button on a phone too (words §1.2 rules the
  symbol-alone rule out for it); an inquiry never blocks a refund (Stripe settles one by a refund, and "Stripe has already
  taken the money back" is false for it); the answering fee isn't printed (Stripe doesn't break it out); `answererGone`
  stays held; the opened email is built (the 3-days reminder is the daily job's); its email kind is unlogged (the logged
  list is the owner's 37). Derived words owed to `/marketing`: the inquiry's tap tip, the siblings' email act/button.
  Deferred to `/dba` (migrations) and the rest: `CLUB_TIER_STAGE12D1_PART4_PROMPT.md` "What Part 3 learned". Layout
  check skipped (UAT fixture, as Part 2).
  **Part 4 (every club pays its Stripe fees) committed `296ca4014` (billing, screens, help, Facts doc) and `378dc1fb0`
  (the daily job, its own commit) 2026-10-27, no schema change beyond mig 395 (a pg_cron schedule).** Builder's calls for
  the walk: a returned debit keeps the published CA$5, a reversed one is billed at Stripe's own figure (ruling 5); the
  foreign-card extra is +0.8% from `FOREIGN_CARD_EXTRA_BPS` (Facts doc), recorded once Stripe says paid (recorded or not);
  the club's own invoice is due in 30 days (ours, not Stripe's); a month whose credits cover its fees sends nothing; the
  fees list shows on Plan & billing for every plan (absent until a fee exists); the platform panel's Retry is
  `club_billing` and is a work tool on the audit-reason list; the two new emails are unlogged (`team` class, as Part 3's);
  the bulk "Email families who owe" leaves out a whole family when any owing child's card dispute was lost (a single send
  stays the desk's choice). **Mig 395 is written, NOT applied** (watched automation: the owner's yes for dev is asked).
  **Owner asks from Part 4:** (1) apply 395 on dev; (2) a cancelled club reading its fee list needs a billing-rail
  exemption (today it is emailed the invoice and its Pay button, and the list is absent while cancelled); (3) the
  returned-debit CA$5 is billed from the constant though the sandbox showed Stripe charging nobody for a failed debit —
  under ruling 5 it would stop until Stripe confirms; (4) `hello@fieldlogichq.ca` as `{supportEmail}` on the invoice.
  Derived words owed to `/marketing`: the Plan & billing list (`STRIPE_FEE_WORDS.list*`, `billed*`), `paLegacy`,
  `paFromRate`. Not done in Part 4, handed on: the `/dba` migration for Part 3's deferred SQL items and `/review` on the
  whole of 12d-1 (`CLUB_TIER_STAGE12D1_PART4B_PROMPT.md`).
  **Part 4b committed `50e66927c` (mig 396, dev applied; prod pending in MANUAL_PROD_STEPS) and `a5da8b0e4` (the /review)
  2026-10-27.** Of the five deferred items: open dispute statuses are ordered (a slow `needs_response` after
  `under_review` is stale); `online_payment_over_left` shares the team's surplus across its extras (kept first, then newest
  landed, each capped by what of its own payment is still received); a card dispute lost before its payment landed is
  booked at the landing (fresh or replayed, both flows; a failure there is logged and the daily job's `lost_disputes`
  step sweeps payments landed in the last week). **Not built, from the code:** "a refused returned line rolls back the
  dispute write" cannot happen — `club_league_money('reverse')` (mig 387) refuses only a non-positive amount or a missing
  date, and books past what is still received by design; and a `warning_closed` inquiry is final (Stripe, How disputes
  work → Inquiries: "open for 120 days without escalation… the card network won't escalate it"), so mig 391 was right.
  A payment the desk records BY HAND after a lost dispute is not linked to it and stays the desk's. Dev checks T4c, T6b,
  T15 added to `scripts/online-payments-12d1-check.sql`; 12c and 12d-1 checks pass on dev.
  **/review of 12d-1** (four lenses on Part 4 + 4b; Parts 1–3 had their own): fixed — the club's own invoice stamped fees
  billed as each line went on, so a run that stopped before the finalize or email stranded it for good (High); a failed
  invoice email was never resent nor reminded; a non-CAD or deleted subscription failed a fee for good; subscription
  lines and a stored-late draft are read back past Stripe's 24-hour key; the notifications guard (red since `717f6811b`).
  Refuted: a dispute fee billed when the club's balance paid it. **Recorded, not fixed (Low/advisory):** a fee put on a
  subscription that is then cancelled or discounted before its invoice stays pending and is never invoiced (our own
  invoices exclude pending items); a credits-only month's credit waits for a later fee that may never come, while the
  list says "next 1st"; a small fee invoice may sit under Stripe's minimum card charge; the panel's Retry records no staff
  reason (Part 4's call); Payouts tells a non-owner whether the plan is free; `writeInvoiceState` is not monotonic (the
  daily re-read heals it); over-left orders a won-back extra by its original landing; two overlapping monthly runs can
  write a spurious `send_error`. **Migration number:** another session's untracked `396_support_console_leads_pipeline.sql`
  collides with this 396 and needs renumbering by its owner (resolved: committed as 398).
  **Owner rulings on Part 4's asks and the /review's calls (2026-10-27, in the Part 4b session):** (1) **mig 395 applied
  to dev** (`f09401090`; the daily job runs at 11:15 GMT; prod stays a release step). (2) **A cancelled club is still billed
  and SEES its fee list** on Plan & billing (no reprieve; a billing-rail exemption for the list). (3) **The returned-debit
  CA$5 stops being billed from the constant**: a returned debit is billed at Stripe's own figure, as a reversed one is
  (ruling 5), and nothing when Stripe charged nothing. (4) **The invoice's contact address is NOT decided here**: it is
  one of the company addresses (with noreply and support) the owner will settle in a later company-wide email sweep;
  `hello@fieldlogichq.ca` stays until then. (5) **The single "Email the pay link" after a lost dispute WARNS, never
  skips** (the desk member's own choice; the bulk send keeps skipping). (6) **A fee put on a subscription that is
  cancelled or discounted before its invoice is caught by the club's own monthly invoice** (the pending line removed from
  Stripe, the fee billed on the own invoice once). (7) **A returned answering fee goes back against the invoice that
  carried the answering fee** (a Stripe credit note: refunded to the card when that invoice was paid, lowering it while
  open; netted on the same invoice, as today, when both fall in one month) — a credit never waits for a later fee.
  Rulings 2, 3, 5, 6, 7 are built in Part 5, before its help (`CLUB_TIER_STAGE12D1_PART5_PROMPT.md` §0).
  **Part 5 (first session, 2026-10-27): help, the setup guide, the gates and the walks, committed BEFORE §0.** The session
  read an early draft of the Part 5 prompt (no §0); the owner chose to commit the work and hand §0 to a fresh session,
  `CLUB_TIER_STAGE12D1_PART5B_PROMPT.md`, which builds rulings 2, 3, 5, 6, 7 and then trues up the help and walk §396.
  Built: help in tournaments (paid twice; a card dispute in two topics; the refund line; three Needs attention items),
  house league (two dispute topics; the open-page note on Mark received; "…'s fee was paid twice"), families, and a new
  org section `stripe-fees`; the Stripe setup guide's dispute events, billing-webhook events and one owner's-step table;
  `DisputeBlock.tsx`'s `org-slug-ok`. Found: the prompt's "12c help says a card dispute is 12d's" was false (none did); Part
  4's Payouts help said both dispute fees "go on the same invoice", corrected to ruling 5 (a fee from the club's own
  balance is never billed). Tests: the done list is covered (107 pass; nothing added). Not done: `check:layout` (aborted at
  the memory floor, then every screen "Page not found"); `check:demos` red since 12c Part 4 (`registration-attention.ts`'s
  extensionless import), not 12d-1's, for the owner. Walks: ledger §395 paid twice
  (https://claude.ai/artifact/GmV1oKgXPb1RmVRNSeHw2i), §396 disputes and fees
  (https://claude.ai/artifact/RKnhTRAFymveVggrXCUTnG).
  **Part 5b (2026-10-27): the owner's rulings 2, 3, 5, 6, 7 built, reviewed and committed, then the help and walk §396
  trued up.** Ruling 2 `3cd0731f1` (a cancelled club's owner sees the Stripe fees list on both Plan & billing pages; its
  read is on the billing rail's allow-list). A defect found first, `88625c444`: the club's own invoice wrote each fee's
  line id before its billed date, which `platform_stripe_fees_billed_chk` refuses, unread, so no own-invoice fee was ever
  stamped billed (dev held no fee rows; nothing mis-billed). Ruling 3 `ee2a890d7` (a returned debit read from the platform
  balance by its charge, nothing when Stripe charged nothing; `RETURNED_BANK_DEBIT_FEE_CENTS` removed; Facts doc line and
  reconcile note, the 2026-10-26 debit decision's point 4 superseded). Ruling 5 `e31adbb52` (one Email the pay link after a
  lost dispute asks, then sends; the bulk sends still skip; a tournament team's asks too, builder's call). Ruling 6
  `8d12152ae` (the daily job's `stranded_fees` step, before the monthly invoice: a pending line on a subscription the club
  can't ride is deleted, read again, and the fee returned to unbilled). Ruling 7 `947696ea9` + **mig 399** (applied to dev
  2026-10-27; prod pending in MANUAL_PROD_STEPS, before the promote): a returned answering fee nets beside its answering
  fee while that invoice is to come (a month they cancel out finalizes at nothing owed, paid, no email), else a Stripe
  credit note on THAT invoice (owed first, then refunded to the card), Stripe's email off, once only
  (`stripe_credit_note_id`, unique); Plan & billing reads "Returned {day}". **/review** (four lenses; Stripe's behaviour
  proven in test mode: a pending line names its subscription, a deleted one reads 404, a $0 invoice finalizes paid, a credit
  note lowers an open invoice and refunds a paid one) fixed in `0264dd868`: High, a
  credit's subscription line had no read-back (a second line after Stripe's 24 hours); Medium, the ask reached the refund's
  pay-link answer and the price-raise email (only the desk's own button asks now); Medium, a credit with no answering fee
  of ours threw for good; a credit note never made for a credit the own invoice claimed meanwhile; unbilled credits retried
  daily; the stranded sweep oldest first; a returned debit re-read two weeks, not sixty. **Recorded, not fixed (Low):** a
  returned-debit fee's `source` on the platform balance is undocumented, so reading it by the charge is unproven until a
  live failed debit is seen (the sandbox charged nothing; the e2e pass); a fee re-billed on the SAME subscription within 24
  hours of its release gets the deleted line back and heals at the next release; a subscription stamp racing the monthly
  claim; an answering fee claimed by an earlier month's unfinished draft lets its credit land on this month's invoice;
  `readClubFees` has no state for a void own invoice. Words: /marketing's pass (copy doc §1.5, §1.7). Help `/docs`: org
  `stripe-fees` (now three sub-topics, it was over 350 words), house league and tournaments dispute-ends and returned-debit
  lines. Walk §396 republished (version 3): C7–C8, E8–E9, part F, 29 → 37 steps. **`check:layout` still not run, and the
  cause is found:** `app/not-found.tsx`'s eyebrow "404 · Page not found" (`2e205823d`, 2026-10-23) rides in every page's
  inline data, and the check's LANDING_FAILURES matches "Page not found" in `textContent`, so every screen has failed since
  10-23 (not the fixture, not memory); a one-line fix in the shared check (visible text only) is the owner's call.
  `check:demos` red (12c's `registration-attention.ts` import) is still the owner's.
- **12d-2 build state (opened 2026-10-27; prompt `CLUB_TIER_STAGE12D2_BUILD_PROMPT.md`, committed `4844e54f4`).**
  **Stripe facts, read 2026-10-27 from Stripe's current docs (API `2026-04-22.dahlia`; our charges are DIRECT charges on
  the club's account, so every read below carries the club's `Stripe-Account`):**
  - **Listing payouts:** `GET /v1/payouts` on the club's account, newest first, cursor paging, `limit` 1–100; filters
    `created`, `arrival_date`, `status` (docs/api/payouts/list).
  - **What's inside one:** `GET /v1/balance_transactions?payout=po_…` — "For automatic Stripe payouts only". A payout's
    `reconciliation_status` is `completed` (listable), `in_progress` (Stripe is still matching it; `payout.reconciliation_completed`
    announces the end) or `not_applicable` (a manual or instant payout: "Stripe can't identify which transactions are
    included… You're responsible for reconciling payouts you create"). **The tab shows a manual one as its total alone, with
    the words' manual line** (docs/payouts/reconciliation).
  - **Tying a line back to our row:** a line's `source` is the charge (`ch_`), refund (`re_`) or dispute (`du_`), expandable
    (`expand[]=data.source`, four levels at most; expansion is the heavy kind of read). A charge carries its payment intent,
    which our row stores (`stripe_payment_intent_id`, `stripe_charge_id`); a refund and a dispute carry their charge. The
    Checkout Session is not reachable by expansion, and we never need it. Types a club's payout holds: `charge` / `payment`
    (a payment; which one a bank debit is: to confirm by probe), `refund` / `payment_refund`, `payment_failure_refund` (a
    bank debit that failed after it was counted), `payment_reversal`, `adjustment` with a dispute source (taken for a
    dispute, and given back on a win), `stripe_fee`, the payout's own `payout` / `payout_failure` / `payout_cancel`, and
    Stripe's reserve types. **Stripe recommends `reporting_category` over `type` for accounting**; every line we print is
    named by our row (payment, refund, returned debit, dispute, dispute won, Stripe fee) or "Not from FieldLogicHQ", never
    a bare Stripe type (docs/reports/balance-transaction-types).
  - **Dates:** `arrival_date` is "Date that you can expect the payout to arrive in the bank", weekends and holidays allowed
    for; it is an expectation (`payout.updated` fires when it moves) and the bank may post later. `created` is Stripe's
    own. **The tab's "Arrives" is `arrival_date`; "Sent" is `created`.**
  - **Failed or cancelled:** `pending` → `in_transit` → `paid`, or `failed` / `canceled` ("within 5 business days"; "some
    payouts that fail might initially show as paid, then change to failed"). `failure_code` is an enum, `failure_message`
    Stripe's text; the money returns to the club's Stripe balance (`payout_failure` / `payout_cancel`), and after a failure
    the bank account is disabled until it is replaced. Shown as the words' §3.2 "Didn't arrive" with a mapped reason, or no
    reason (docs/api/payouts/object, docs/connect/manage-connected-account-payouts).
  - **Limits:** 100 reads a second live, 25 in a sandbox, 25 a second on one endpoint; reads are also counted against a
    rolling 30-day allowance (at least 10,000 a month), each connected account with its own and the platform's reads on its
    accounts pooled. A season of a few hundred payments is 3–5 list calls of 100 (docs/rate-limits).
  - **Closing an open pay page:** `POST /v1/checkout/sessions/:id/expire` works only on an `open` session; afterwards "a
    customer can't complete" it and sees that it expired; a session already complete (or expired) returns an error. A bank
    debit's session becomes `complete` the moment the family submits it, so an ending can never cancel a debit already
    submitted: it clears or returns as it would have. The race (paid at the same moment) is not documented: our expire
    swallows the error and the webhook lands whatever Stripe completed (docs/api/checkout/sessions/expire,
    docs/payments/acss-debit).
  - **Events after an ending:** a direct charge's events reach the Connect endpoint while the account stays connected to
    the platform, with nothing tied to whether we still offer payments; disputes and debit failures can arrive weeks
    later. Express accounts cannot be deauthorized by OAuth (Standard only), and no ending here rejects or deletes the
    account (ask 4), so dispute and refund events keep arriving (docs/connect/webhooks, docs/connect/oauth-reference).
  - **Test mode payouts:** a payout created by API is MANUAL, so its contents never list. Reading contents in test mode
    needs an AUTOMATIC payout: the test account on a daily schedule, funds made available at once by the test card
    `4000000000000077` (to confirm for a CAD Express account), then a wait for `reconciliation_status: completed`
    (docs/connect/testing, docs/connect/manage-payout-schedule).
  **⚖ Owner 2026-10-27, the build's four asks (all as recommended, after the UX summary):**
  1. **The Payouts tab reads Stripe live**, held a few minutes; no stored copy of payouts.
  2. **The operator's Delete refuses while money is in flight**, naming each (an open dispute, a debit clearing, a Stripe
     fee unpaid or failed), as the live-subscription check does. The owner's "Ask us to delete" is never refused (drawn).
  3. **Console: super admin, billing and support** read the club's Online payments tab and Health › Online payments (the
     roles that already read a club's Stripe records).
  4. **The daily job gains the drawn emails** (the terms changed + its 14-day reminder; 7 days before an ending the owner
     didn't choose), in their own commit (owner asked for it, this conversation).
  **Found by the census, built without a ruling (they implement the drawing):** every online-payment notice is dropped
  once the plan loses `online_payments` (the notify plan guard), so the wind-down's dispute and refund items would never
  arrive; Disconnect leaves open pages payable; a Stripe-closed account writes no audit row, so the Story never shows it.
  **Builder's calls, stated to the owner:** Health › Online payments is ordered most urgent first, no filters; the Story
  gains "who pays the fee changed", "terms agreed" and "Stripe closed the account" (the drawing names none); the wind-down
  card's words are derived and owed to `/marketing`; the test club's payout schedule is set to daily in test mode by API
  (a manual payout never lists its contents).
  **⚖ Owner 2026-10-27, an ending the owner didn't choose — a failed subscription payment (the drawing could not be built
  as drawn):** a suspension after a failed payment has no known date (Stripe's retries decide it; the billing webhook
  stores none), so its warning goes **the day the subscription first goes past due**, without a date: an item, the card's
  notice and one email (derived words, owed to `/marketing`). A comp ending keeps the drawn "seven days before" (free
  time's `expires_at`; the Founding comp's `FOUNDING_SEASON_END` for a club that chose no plan).
  **Builder's facts:** a Checkout page expires at Stripe 24 hours after it opens (we set no `expires_at`). A downgrade
  reaches its date through the billing webhook's plan write, which closes the club's open pages there; an ending with no
  event (free time running out) is swept by the daily job (ruling 4). Deleting a club with invoiced fees is safe on dev:
  `online_payments` cascades first (constraint order), taking its fees before `platform_fee_invoices` meets its
  `RESTRICT`; every other link into `online_payments` is NO ACTION (checked at statement end). Sandbox probe
  (`.probe/s12d2-payouts-probe.cjs`, the UAT club's account): a bank debit is a `payment` line (`py_` source), a returned
  one a `payment_failure_refund` plus an `adjustment` (category `fee`) giving our fee back, a card dispute an `adjustment`
  (category `dispute`) carrying Stripe's CA$15 as its `fee`, a won one `dispute_reversal`; the account pays out daily
  with a 7-day delay and has made no payout yet.
  **12d-2 BUILT 2026-10-27 — Stage 12's build is complete.** Committed `ffee7864c` (Part 1, mig 401, /dba) · `038457ed0`
  (Part 2, Accounting › Payouts) · `2a86c9333` (Part 3, leaving) · `2041bf454` (Part 3's /review) · `d93427656` (Part 4,
  the terms, mig 403) · `cb658a53f` (puts back the support console's records that d93427656's temporary index carried
  stale) · `70b7e2302` (the daily job's two owner steps, its own commit, ruling 4) · `e42faf261` (Part 5, the console) ·
  `2a171752a` (/review of the whole). Migrations 401 (once-only stamps) and 403 (the owners' two Needs attention kinds in the
  notification indexes) applied to dev 2026-10-27, prod pending in MANUAL_PROD_STEPS. Help: Part 6 (`/docs`).
  **Builder's calls, for the walk:** the Payouts tab reads "Since" as the shared date field's own range face ("Sep 1 – Oct
  27"), default the first of last month, and a payout still on its way is kept whatever its arrival; a payout Stripe is
  still matching says so; Find matches a receipt whole; the treasurer opens a name read only; the wind-down card is
  "Online payments off" (derived words) and keeps Stripe's needs-attention words beside it; the plan is now checked LAST
  in both pay facts, so a plan without online payments (or a cancelled club) refuses Pay now and nothing else; a cancelled
  club's families can no longer open a new page (found by the /review: cancel never touched the plan id); the operator's
  Delete counts again after closing pages and refuses while a page is open or finishing; Health › Online payments rows are
  the words' six plus "A Stripe fee couldn't be billed" (the prompt's failed fee billing; clearing debits stay on the club's
  tab, a debit clearing being normal); the console's "Stripe closed the account" reads the record the closed-account event
  now writes; agreeing to the terms names the version the window showed (a version published meanwhile is refused).
  **Held for the owner (built around nothing):** the drawn "Your How to pay text is empty · Write it now" line points at
  one field the card does not have — How to pay is per season and per tournament. **Derived words owed to `/marketing`:**
  the payouts list's returned-fee / Stripe fee / refund-back / payout-back lines and its still-matching, didn't-arrive and
  no-match notes; the wind-down card; the failed-payment warning (title, sentence, subject); the operator's line and the
  Delete refusal; the ending item's settled lines; the Story titles; the failed-fee Health row; the tab's read failure.
  **Recorded, not fixed (Low, from the two /reviews):** a pay page whose session is created between an ending's read and
  its row stays payable until Stripe expires it (a day; the landing records it); closing many pages has no cap beyond its
  8-second deadline; the owner's deletion window names disputes and debits (as the words do) though the operator's Delete
  also waits for Stripe fees; a league sign-up with one child owing and a sibling clearing shows no pay block after a
  downgrade (as before); the console's "Read the terms" shows the current text (one version exists until counsel ships);
  a payout's lines past 2,000 are cut without a flag; the closed-account record is check-then-insert; the treasurer reads
  the connecting owner's email when no name is set; payout lines name a house-league child for an Accounting reader on a
  club whose house league is off. **Not run:** `check:layout` (every UAT screen lands on "Page not found" because of the
  404 page's eyebrow — not re-seeded, as instructed). **End to end in test mode:** the reads were exercised on the dev
  server as the UAT club's owner, treasurer and registrar (counts, terms row, payouts list, refusals all as built); the
  test account was funded so Stripe's daily automatic payout has money — a payout read on the tab and exported waits for
  that payout; the downgrade/Disconnect with a page open and the terms bump are walk steps (a terms bump is a constant
  change, never published by the builder).

## 0b · Rulings (owner paste-back, 2026-10-25)

- **A1** The owner connects and disconnects. The treasurer sees the Payouts state on the Money pages and gets the
  "needs attention" item. Nothing else in Settings opens for them.
- **A2 = C** It depends on who ends it. When the club declines or cancels, the fee is included by default; when the
  family asks to leave, it isn't. The convenor can change it each time. ⚠ **Partly reversed 2026-10-25 (§0c):**
  FieldLogicHQ keeps its fee on every refund, so a refund that includes the fee costs the club the whole fee, not the
  processor's kept share. The box and its defaults stand.
- **A3** No saved cards. Each payment is entered on Stripe's page, where the browser or Stripe's own wallet may fill it
  in.
- **A4** "Processing" is a state of the payment. The child stays Accepted with the spot held. The money counts as
  Received only once it clears. A returned debit emails the family a fresh Pay and gives the convenor a Needs attention
  item that clears itself.
- **A5** Rep-team dues online are not in Stage 12. Decide after 12c, in its own drawing round, as a possible 12e.
- **A6** Stage 9's screens unchanged: the club's "How to pay" text, no button. One quiet line, "Let them pay online",
  only for whoever can connect.
- **A7** Offer both, with the deposit pre-selected and the fee saving of paying in full shown.
- **A8** The same Payouts card, at the end of the tournament settings page.
- **A9** One optional sentence written on the Payouts card, shown as a "Refund policy" link beside Pay. Absent when
  blank. Counsel may make it required.
- **A11** A fourth figure, "Processing", only while a debit is clearing, so the band still adds up.
- **A12** Refund to the card from the online payment's ⋯.
- **A13** Whoever may end the registration or record a payment in that flow (house league: owner, club admin, league
  admin, registrar; tournaments: whoever runs tournaments), plus the treasurer.
- **A14** Yes: one club-wide choice on the Payouts card. "Families pay it" is the default.
- **L1** Partial refunds in 12b.
- **L2** Card in 12a. Bank debit in 12c, for house league and tournaments at once (one checkout).

Facts that changed with the rulings (re-read in the same unit of work): "the club nets the full fee" now holds only
while families pay the fee (A14), so §1, §7 and the PM brief say so. A2 applies only while families pay the fee.

## 0c · Rulings at the 12a build start (owner, 2026-10-25)

Asked because Stripe's current docs made a choice explicit that the 2026-07-28 decision never ruled.
- **Stripe, not FieldLogicHQ, covers a club's unrecoverable losses.**
  - Stripe now discourages direct charges on its legacy `type=express` accounts and points to accounts with controller
    properties / Accounts v2. On those, who covers a connected account's negative balance is chosen at creation.
  - Stripe covering it alongside the Express Dashboard is a public preview (Stripe's risk-management page).
  - Consequences: FieldLogicHQ can't pause or reject a club's account, so Disconnect stops new pay pages and nothing more,
    as A1 already said. No reserve is held on the platform balance.
  - Unchanged: **the fee model stays the 2026-07-28 one.** FieldLogicHQ pays Stripe's processing fee out of the all-in
    rate (Stripe's "you handle pricing"; the scoping plan's unit economics). The application fee is therefore the whole
    all-in fee, not "all-in minus the processor's cost". §3's line saying otherwise was a slip and is corrected there.
- **After a full card refund the team's paid figure goes back down.** The payment row reads "Refunded to card" with its
  date. The tournament book keeps the receipt and gets the refund as its own money-out line, the Stage 7a rule for a
  paid team that leaves.
- **The 12a UX summary was approved as written**, with these placements:
  - on Tournament Plus, a Payouts tile at the end of the Settings & access hub (the hub is tiles, not cards), opening the
    card on its own page;
  - a tournament-only club has no Money page, so the treasurer's status line sits on the Teams page's payments line;
  - card only, so the drawings' bank-debit buttons and "12c" labels are not built in 12a.
- **Stripe in test mode only, approved.** No live key is used.
- **FieldLogicHQ keeps its fee on every refund** (owner: "any time Stripe keeps their fee, we should keep ours as
  well"). Stripe never returns its processing fee, so the application fee is never refunded.
  - **This reverses part of A2.** Under A2 the processor's kept share was the club's only cost. Now a refund that
    includes the fee costs the club the whole fee, shown as a "Payment processing" cost.
  - **The A2 box stays, with its defaults** (on when the organizer ends it, off when the team asked to leave): ticked,
    the club pays the team's fee back out of its own balance, and the window says so.
  - **When the club paid the fee (A14),** a refund returns the base; the fee was already the club's cost when the
    payment arrived, so the refund adds nothing.
- **A refund and a "Payment processing" cost file on the tournament's own shelf.** Two spending words, "Refunds" and
  "Payment processing", join that event's word list the first time one is needed. The event's net (By activity) stays
  revenue less refunds less processing. Not the schema review's club-wide "Online payments" category. This adds to the
  event word list owner-approved in `HOSTED_EVENT_FILING_SHELF_PLAN.md` §6 call 1.
- **The who-pays choice names who actually pays.**
  - Tournament Plus: "Teams pay it" / "The club pays it".
  - League and Club: "Teams pay it" in 12a, then "Families and teams pay it" once house league joins in 12b.
  - It is one setting either way. This refines A14's "Families pay it" label; the choice itself is unchanged.
- Raised for `/strategy`, not ruled: Stripe collecting its fee from the club directly ("Stripe handles pricing") would
  drop the per-club monthly and per-payout Connect charges, but the club would absorb foreign and premium card
  surcharges, so it would no longer always net the exact fee.

## 0d · Accounts v2 (owner, 2026-10-25, after the 12a walk hit Stripe's refusal)

**What happened.** Set up payouts returned a 500 on the first walk. Stripe refused `POST /v1/accounts`: *"Stripe no
longer recommends Accounts v1 for new Connect integrations. Create connected accounts with POST /v2/core/accounts
instead … If your integration requires v1 account creation for a supported compatibility scenario, enable Accounts v1
support in the Dashboard."* New platforms have v1 creation **off by default**. §0c had already recorded that Stripe
"points to accounts with controller properties / Accounts v2", and the build chose v1 controller properties anyway —
that was the miss, not a Stripe surprise.

**Ruled (owner):** build the way Stripe wants it now — **Accounts v2**, not the "Accounts v1 support" toggle (a
compatibility crutch with no stated end; leave it OFF). Nothing of 12a is on production and no club has connected, so
the change costs nobody anything now and would cost real clubs later.

**The four account rulings carry over unchanged, mapped to v2** (Stripe's own map,
docs.stripe.com/connect/accounts-v2/connected-account-configuration#property-map):

| Ruling | v1 (as built) | v2 |
|---|---|---|
| Express Dashboard | `controller.stripe_dashboard.type: express` | `dashboard: 'express'` (immutable) |
| FieldLogicHQ pays the processing fee | `controller.fees.payer: application` | `defaults.responsibilities.fees_collector: 'application'` (immutable) |
| Stripe covers losses (Managed Risk) | `controller.losses.payments: stripe` | `defaults.responsibilities.losses_collector: 'stripe'` (immutable) |
| Stripe collects KYC | `controller.requirement_collection: stripe` | derived: `requirements_collector` = `stripe` (read-only) |

- **Express + Stripe-covered losses is still Stripe's public preview** on v2 (docs.stripe.com/connect/risk-management/
  connected-accounts-with-managed-risk): create the account on `2026-09-30.preview`. The GA version refuses this
  combination. The fully-GA alternative is `dashboard: 'full'` — rejected for now: far heavier for a volunteer
  treasurer, and the preview works (below).
- **Fee semantics confirmed:** with `fees_collector: 'application'` the application fee must cover Stripe's processing
  fee too (docs.stripe.com/connect/direct-charges-fee-payer-behavior). The all-in fee already does (§0c).

**Sandbox probe, 2026-10-25** (`.probe/s12v2-probe.cjs`, `.probe/s12v2-link.cjs`; test key only; left one account,
"Probe Club (S12 v2 test)"):
- `v2.core.accounts.create` on `2026-09-30.preview` with `identity.country: 'ca'`, `defaults.currency: 'cad'`,
  `dashboard: 'express'`, fees `application`, losses `stripe`, `configuration.merchant.capabilities.card_payments` →
  **created**; `requirements_collector` came back `stripe`; card_payments `restricted / requirements_past_due` (expected
  before onboarding). **Canada works on the preview.**
- Requesting `acss_debit_payments` on that account → **accepted** (restricted pending onboarding). Whether it reaches
  `active` after onboarding is checked in the 12a walk; it decides nothing for 12a, everything for 12c.
- `v2.core.accountLinks.create` (account_onboarding): on the **preview** version the `configurations` field is
  **unknown**; on the SDK's pinned `2026-04-22.dahlia` it is **required**. → **Use the preview version only for account
  creation** (Stripe's instruction) and the pinned version for every other call.
- `accounts.retrieve` (v2) on the pinned version reads the preview-created account fine.
- `accounts.createLoginLink` (v1, the Express Dashboard door) refuses before onboarding is done — same as v1.
- The installed `stripe@22.1.0` already has `v2.core.accounts`, `v2.core.accountLinks` and `v2.core.eventDestinations`.
  **No SDK upgrade needed for this.**

**What changes (the rework, one build session):**
1. Account creation → `v2.core.accounts.create` as above (preview version, idempotency key kept).
2. Onboarding → `v2.core.accountLinks.create` (pinned version, `configurations: ['merchant']`).
3. "Takes payments" → `configuration.merchant.capabilities.card_payments.status === 'active'`, not `charges_enabled`
   (the v2 object's own readiness field; Stripe's best-practices skill steers away from `charges_enabled` — reported by
   the research pass, not independently checked). The five Payouts states re-derive from v2: capability status +
   `status_details`, `requirements.summary.minimum_deadline` (status/time), and the requirements entries. The
   hard-coded v1 reason strings go.
4. Account events → v2 **thin** events on an **event destination** scoped to *Your account*:
   `v2.core.account[requirements].updated`, `v2.core.account[configuration.merchant].capability_status_updated`,
   `v2.core.account.closed` (replaces `account.application.deauthorized`). Fetch the account on receipt, as today.
   Checkout and refund events stay **v1 snapshot events** on the existing *Connected accounts* endpoint — unchanged.
   Two destinations means two signing secrets; local testing needs the CLI to forward both. (Names checked against
   docs.stripe.com/api/v2/core/events/event-types on 2026-10-25. That list also carries thin `v1.checkout.session.*` /
   `v1.refund.*` events — whether one thin destination could replace both is for the build session to test, not assume.)
5. `org_payment_accounts`' v1 mirror columns → a new migration reshaping them for v2 facts; dictionary updated (and its
   `payouts_enabled` drift fixed). Dev only so far — migrations 358/359 are prod-pending, so it can be a clean reshape.
6. Tests: the five-states fixtures and the guard's v1 method regex.
- **Unchanged:** Checkout Sessions on the connected account (`Stripe-Account` header + `application_fee_amount`),
  refunds, the fee arithmetic, the `stripe_connect_events` log, the Express login link (still v1 by Stripe's design).

**Deliberately NOT in this rework:** moving the repo from `2026-04-22.dahlia` to `2026-09-30.endive` (Stripe's newest
major, which also touches SaaS billing). One major behind is normal and nothing is deprecated; it is its own task.

**Built 2026-10-25** (rework prompt `CLUB_TIER_STAGE12A_V2_REWORK_PROMPT.md`; migration 364 applied to dev 2026-10-25;
committed `8eae6bec6` (migration 364) + `235a3e9bd` (the code)). What the build decided, on evidence:
- **v2 has no `details_submitted`**, and that flag was what told *Setting up* from *Needs attention*. Its successor is
  `onboarding_finished_at`. The sync stamps it the first time the account shows nothing asked for **at sign-up**
  (`requested_reasons: routine_onboarding`) that is due now, waiting on the club and without an error against it. It is
  set once and kept, as v1's flag was, so a later demand reads *Needs attention*, never *Setting up* again. An answer
  Stripe refused (an entry with an error) counts as *Needs attention*, not an unfinished form. Every state keeps its
  drawn meaning, and the shapes were fixed against the probe account's live retrieve (`.probe/s12v2-shape.cjs`).
- **The live shape before onboarding:** card_payments `restricted / requirements_past_due` and
  `summary.minimum_deadline` `past_due` with no time. Seven user entries, all `routine_onboarding`. That shape reads
  *Setting up* (unit test).
- **Two destinations, chosen on evidence.** Stripe accepts ONE thin destination carrying both scopes (probe 3b), but the
  pinned SDK (22.1.0) types thin notifications only for v2 accounts. Thin `v1.checkout.session.*` / `v1.refund.*` would
  mean hand-parsed events and an extra Stripe read on every payment, which rewrites the reviewed money path to save one
  secret. Stripe refuses v2 events on a snapshot destination (probe 3d). So: the account webhook is new
  (`/api/payments/connect-account-events`, `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET`), and checkout and refunds stay where
  they were (the payments endpoint dropped its two v1 account cases).
- **Locally that is two listen windows.** CLI 1.55.1 refuses snapshot and thin events in one listen. Both windows share
  one signing secret. End to end checked 2026-10-25: a real `v2.core.account[requirements].updated` was forwarded, the app
  answered 200, and it was logged processed once. Owner steps (local and staging) are in
  `docs/agents/ops/stripe-setup-guide.md` § Online payments; **the earlier single-staging-webhook instructions are
  withdrawn there.**
- The exact onboarding-link body (`configurations: ['merchant']` + `collection_options: eventually_due`) was checked live
  on the pinned version. Account creation sends the probe-proven body (no `include`); the country arrives with the first
  sync.
- **/review 2026-10-25 (4 lenses), five fixes:**
  - The sign-up stamp is strict. A `routine_onboarding` entry at ANY deadline keeps sign-up open, and a read missing the
    requirements never stamps. A stamp written early is permanent, while one written late only keeps "Setting up".
  - A read missing a part writes nothing, so one short read can't switch payments off.
  - `unsupported` is never a wait.
  - Reconnecting an account Stripe has closed is refused with a plain message BEFORE the row changes. Clearing first
    would have opened pay pages on a dead account.
  - The closed event re-reads before stamping, and stamps on the signed event alone only if that read fails.
  - Also done: "Open Stripe" is allowed whenever card payments are active, and 364 is declared in `MANUAL_PROD_STEPS.json`.
  - Accepted as they stand: out-of-order concurrent syncs and the double-click on Set up payouts (both as they were
    on v1), and the event log's unatomic dedupe (harmless; the dictionary's claim of `ON CONFLICT` + `FOR UPDATE` corrected).
- **Owed — the walk:** Set up payouts → "Before you set up payouts" → Stripe's sign-up with test data → back on the card
  → *Taking payments*; window 2 shows the account events; a tournament team pays by card; and record whether
  `acss_debit_payments` reached `active` (for 12c).

## 0e · Rulings at the 12b build start (owner, 2026-10-25)

Asked from `CLUB_TIER_STAGE12B_BUILD_PROMPT.md` "Before any code", after a census against `9c1545220`.
- **The 12b UX summary was approved as written.** It covers the family, the registrar or convenor, the treasurer and the
  owner, and a club not taking payments sees today's screens word for word.
- **a · Siblings: one checkout, with an item per child** (`online_payment_items`). This corrects the schema review's
  "the destination row is the item". A child's fee line exists only once the money lands, so the split has to be held
  from the moment of paying. A sibling whose line is refused (declined mid-checkout, marked received by hand) does not
  undo the others: only that child's share raises Needs attention with the refund door.
- **b · The landing goes through the one writer with no person attached.** It is recorded once per child, safe to
  replay. A refusal keeps the payment recorded as taken and raises the item. A day in a closed fiscal year books today,
  as the tournament landing does.
- **c · The pay link opens the family's status page, already unlocked, for that one sign-up.** It never expires. "Ask to
  withdraw a child" comes with it, because it is the same page the email and reference open.
- **d · The pay block is extracted and shared now**, so team and family read the same six states. The tournament pay page
  gets a short re-check in the walk.
- **A partial refund returns only the amount typed.** The "include the processing fee" box shows only with a full refund.
- Recorded alongside, not new rulings: the application fee is never refunded (§0c; no `refund_application_fee`). The
  drawings' "processor keeps $4.85" is superseded by §0c. A club-paid processing cost must never be filed as a
  house-league refund line, which would net fees. Only the card landing may record `online_card`, and a card receipt
  comes off only by refund (no Undo), as m4 draws.

## 0f · Rulings after the 12b build (owner, 2026-10-26)

- **A13 amended: the treasurer does not refund, in either flow.** The owner: "I don't think a treasurer would interact
  with registrations and refunds but rather just be there to log the accounting." Refunding a card payment, emailing a
  pay link and the "couldn't be recorded" / "refund didn't reach the card" notices belong to whoever runs that flow
  (house league: owner, club admin, league admin, registrar; tournaments: whoever runs tournaments). The treasurer keeps
  A1: the Payouts state and the "Stripe needs something" alert. This reverses the treasurer half of A13 as ruled
  2026-10-25, including what 12a built for tournaments. Built the same day.
- **A partial refund of a tournament team's card payment is built in 12c** (§4), with that stage's other change to how a
  team's payments move. Until then a team's card payment is refunded in full only (12a), as the help says.

## 0k · The 12c build start: Stripe's bank-debit facts and the owner's four answers (2026-10-26)

**Stripe facts, read on docs.stripe.com / stripe.com/en-ca on 2026-10-26** (pages: /payments/acss-debit,
/payments/acss-debit/accept-a-payment?payment-ui=checkout, /api/checkout/sessions/create, /connect/direct-charges,
/connect/disputes, /pricing/local-payment-methods). Pinned API `2026-04-22.dahlia`; the docs are not versioned.
- **Checkout params:** `payment_method_types` includes `acss_debit`; line items in `cad`;
  `payment_method_options.acss_debit.mandate_options.payment_schedule` (`sporadic` for a one-off fee) and `transaction_type`
  (`personal`) are required; `verification_method` `automatic` | `instant` | `microdeposits`. The connected account needs the
  `acss_debit_payments` capability (§0i). Direct charge + `application_fee_amount` with ACSS is implied by the two pages,
  not shown together — the sandbox run confirms it.
- **The agreement:** hosted Checkout collects the pre-authorized debit agreement itself. Payments Canada requires a
  mandate-confirmation email and a notice for each debit; **Stripe sends both by default.** Not stated: whether that holds for a
  connected account on a direct charge. **Settled in the sandbox in Part 5; if Stripe does not send them, stop and bring it to
  the owner (and counsel's list), never build a substitute silently.**
- **Clearing:** "up to 5 business days" (success at T+4, funds T+5; 5 p.m. Eastern cutoff). The ruled "Takes up to 5 business
  days" stands as written.
- **Events:** `checkout.session.completed` arrives with `payment_status: 'unpaid'`; the outcome is
  `checkout.session.async_payment_succeeded` / `_failed`, on the Connect endpoint with the event's `account`.
- **Failure reasons:** insufficient funds, invalid account, account closed, debit not authorized; the exact code strings are
  not documented — map what the sandbox returns (`pm_acssDebit_*` tokens), unmapped prints no reason (words §2.3).
- **After it cleared:** a bank return or a customer claim becomes a **dispute** (`charge.dispute.created`); personal accounts up
  to 90 calendar days, no evidence, cannot be won.
- **Refunds:** full and part, within 180 days, **about 3 business days** to the account; a refund on a pending debit waits for
  it to succeed and is cancelled if it fails; `refund.updated` / `refund.failed`. → `{bankDays}` = "about 3".
- **Stripe's price:** 1% + CA$0.40 (CA$5.00 cap) + CA$1.00 per instant verification; **CA$5.00 per failed payment or dispute.**
  Our all-in `ONLINE_PAYMENT_RATES.bankDebit` (2.5% + $1.00) matches the Facts doc; no drift.

**The four answers (owner, 2026-10-26):**
1. **The per-team entry adjustment is a list:** one line per part refund (amount, date, reason or "made in Stripe"), stored as a
   reduction so a later fee change still applies; only a part refund creates one (app or Stripe dashboard), never a full refund
   and never a typed figure. It reaches every place a team's amount due is read (team list figures and filters, the record,
   reminders, check-in, the dashboard, the pay page, the export with an "Entry lowered" column). Not public. Census correction:
   a team's fee is computed in six places (the prompt's "one FeeSchedule" was wrong; `fee_schedule_mode='division'` exists), so
   the build routes all six through one reading of the adjustment.
2. **A returned or reversed debit's CA$5 is the club's.** Follow-through before Part 6: how FieldLogicHQ recovers it from the
   club (Stripe charges the platform, the fee payer), `/billing` on the Facts doc, the figure as a constant (never typed),
   words via `/marketing`, `/strategy` to log it. **How (owner, 2026-10-26, after the research):** Stripe puts both dispute
   and payment-failure fees on the platform under `fees_collector = application` (docs.stripe.com/connect/direct-charges-fee-payer-behavior);
   an account debit is not available while Stripe carries losses (/connect/account-debits); the fee payer can't be set per fee;
   cost pass-through is a private preview that doesn't name the PAD failure fee. So **each return is recorded against the club
   and billed as a "Returned bank debit" line on its next FieldLogicHQ invoice; a comped or free club (Founding Season 2027)
   is not billed — FieldLogicHQ absorbs it until the club pays us.** Built with Part 6. Worth asking Stripe whether the PAD
   failure fee is pass-through eligible (it would replace the invoice line).
3. **Bank sign-in only** (`verification_method: 'instant'`): no micro-deposit wait; a family whose bank lacks it pays by card or
   another way.
4. **A debit reversed after it cleared is built in 12c**, as a dispute on a bank-debit charge only (returned line, family email,
   desk item); card disputes stay 12d.
Landing order (presented, not contested): Clearing at session completion (spot held, no book line, no receipt number); land
through the flow's own writer at `async_payment_succeeded`; a failure before landing touches no book; a reversal after
landing writes a returned line beside the receipt; every step a guarded transition, safe under replay and reorder.

## 1 · What it makes true

A club's owner (A1) connects the club's own Stripe Express account once from the settings page (or, on Tournament Plus,
the tournament settings page, A8). From then on a family pays on their phone the moment a child is accepted, by card or
bank debit, with the processing fee shown before paying; a tournament team pays its deposit or full entry once the
organizer accepts it. **Census correction:** the team form submits as "Pending organizer review", so the kickoff's
"pays when it registers" became "pays when accepted", the same rule Stage 9 ruled for house league. The charge is the club's own (a direct charge); FieldLogicHQ takes its part as an application fee and never
holds the funds. By default families pay the processing fee and the club nets the full fee; a club may instead pay it
out of each payment (A14). The receipt is in the club's name. The payment lands in the club's books
through the same write as a payment marked by hand, which keeps working. A refund starts from the window that ends a
registration (house league) or from the payment's row (tournaments, A12), card first. No live charge before counsel.

## 2 · Census (2026-10-24, at `c452042e9`)

| Where | Writer today | Records | Who |
|---|---|---|---|
| House league fee | `setLeagueFeePaid` (`lib/league-fee-paid.ts:40`) → `club_league_fee_set` (mig 342) | season's current fee, dated today; **no amount, date or method** | the house-league gate's `takeFees` (`lib/house-league-access.ts`, Stage 9a; owner, club admin, league admin, registrar) + `module_house_league` |
| Tournament entry | `lib/team-payments-server.ts` (`recordTeamPayment` :76, `payTeamDue` :88, change, remove) → `tournament_team_payment_*` (mig 345) | dated payment rows with method; tournament book line | `create_tournaments` |
| Families › Record a payment | `lib/families-payment.ts:189` → house league via `setLeagueFeePaid` (**drops the window's date and method**); rep lines → `family_payment_handoffs` | as above | `requireFamiliesAccess` |
| Coaches portal dues | `recordRepDuesPayment` (`lib/db.ts`) | dated, method, team book | coach with money write |

- **There are four writers, not one.** House league and tournaments share `club_fee_post` underneath. Each is pinned by
  its own guard test (`club-stage5c-families-guard`, `club-stage7a-house-fee-red`, `team-payments-guard`).
- **Stripe today:** subscriptions only (`lib/stripe.ts`, `app/api/billing/*`, one webhook `app/api/billing/webhook/route.ts`).
  No Connect code, no connected-account column. Test mode is detected by key prefix (`lib/stripe-prices.ts:19`).
- **Plan gate:** no key exists. Facts doc L141 says "three paid org tiers" (Tournament Plus, League Plus, Club incl. Club ·
  Association); the Club plan says "four". `PLAN_RANK` puts `tournament_plus` first among the paid plans, so one key at
  `tournament_plus` covers all of them. /billing reconciles the wording.
- **Settings:** `components/admin/kit/club/SettingsKit.tsx:152` is owner-only (`org_settings` in
  `OWNER_ONLY_CAPABILITIES`). The treasurer can't open it. `app/[orgSlug]/admin/org/layout.tsx` sends Tournament and
  Tournament Plus orgs away, so their Payouts door must be on `admin/tournaments/settings`.
- **Tournament refunds:** withdrawing a paid team keeps its payments; refunds are typed separately (Stage 7a).

## 3 · Design (as drawn; asks marked)

- **One checkout.** There is one pay block component, with six states: owing, processing, paid, failed, not taking payments
  (Stage 9's how-to-pay text), and no longer payable. The rail (card or bank debit) is chosen in the block, and each button
  carries its own total, because the fee differs by rail and must show before paying. The button opens a Stripe-hosted
  Checkout Session on the connected account. That session has one payment-method type, the base line plus a "Processing
  fee" line, the guardian's email prefilled, and `application_fee_amount` = our part. The family returns to our receipt (the
  status page's paid state). Our receipt email goes out in the club's name with the club as reply-to; Stripe's receipt email
  is off.
- **Fee:** rate × the base fee + the flat part, on the base (not grossed up), rounded to the cent. *Assumption for
  /billing.* Read from `lib/plan-config.ts`. The application fee is the whole all-in fee: FieldLogicHQ pays Stripe's
  processing fee out of it (the 2026-07-28 model; corrected 2026-10-25, §0c).
- **One online-payment record, no new writer.** The webhook (a separate Connect endpoint) marks the payment paid. A single
  landing function then calls the flow's own writer: house league → the 9b-2 fee writer (amount, date, method = online card
  or online bank, receipt); tournaments → `recordTeamPayment` with method `online`. A guard test lists the two landings.
  **Depends on 9b-2** giving house league's writer an amount, a date and a method.
- **Payment state** (owing / processing / paid / failed / refunded / partly refunded) is a fact on the payment, read by one
  rule. It is never a registration status (contract line 6).
- **The server decides at the moment of paying.** The pay route re-reads what is owed before it creates a session. Links
  carry a token scoped to one sign-up or team and never expire on their own. An ended, declined or paid registration gets
  "no longer payable" or "already paid". A second payment that lands anyway becomes "paid twice", a Needs attention item
  with Refund to the card (12d).
- **Not taking payments → absent.** Families see Stage 9's screens. One quiet line, "Let them pay online", appears only for
  whoever can connect (A1, A6).
- **The club is told the fee before connecting** (owner question 2026-10-24). Stripe's onboarding shows only Stripe's
  terms, never our fee. So Set up payouts first opens a "Before you set up payouts" window: the rates, printed from
  `lib/plan-config.ts`; who pays it (A14); where the money goes; that the club sets its refund policy; and the payments
  terms checkbox (counsel writes the terms; record who agreed and when). The rates also show on the Payouts card (before
  and after connecting) and beside the A14 setting. Families are told only the amount: in the card button, as Stripe's
  "Processing fee" line, and on the receipt.
- **Refunds:** from the end-a-registration window (house league) or the payment's ⋯ (tournaments, A12). Card first, and a
  partial refund for a price correction (L1). The fee checkbox defaults by who ended it (A2 = C). Under A2 = A or C, the
  processor's kept share is a club expense line "Payment processing", never a reduction of fees. Who may refund: A13.
- **Books:** Money band gains "Processing" only while non-zero (A11). The Statement is unchanged for revenue.
- **Counsel's gate:** a platform switch, off in production (no Payouts card, no Pay button). Test mode is marked on the
  Payouts card and every test receipt.

## 4 · Ladder

| Stage | Covers | Migrations | Size |
|---|---|---|---|
| **12a** foundation + the tournament card flow | **Proves itself on a tournament team paying by card (owner, 2026-10-25)**: the team pay page with deposit or full (A7), Pay in the acceptance email and the balance reminder, online rows and a full refund from the row (A12), landing through the tournament writer with a new online method value. Payouts card, five states, both homes, with the A14 who-pays choice and the A9 refund-policy sentence; the "Before you set up payouts" window; onboarding via Account Links + return; the gate + launch switch; pay block; Checkout for card; receipt page + email; online-payment record; Connect webhook (own secret, idempotent); full refund; test mode | `org_payment_accounts` (org, Stripe account id, state, charges/payouts enabled, requirements due, connected/disconnected by/at); `online_payments` (org, flow, payer email, base, fee, total, rail, state, processor ids, receipt no., timestamps); `online_payment_items` (payment → registration or team, amount); `online_payment_refunds` (amount, fee included, reason, by, processor id, state); `stripe_connect_events` (idempotency log) | 7–9 d |
| **12b** house league | every Stage 9 ghost; Pay now in approval and promotion emails; Email the pay link; no longer payable; refund in the end window; partial refund (L1); Families lines — **BUILT 2026-10-25 (§0 state; Families lines and the tournament partial refund named, not built)** | migs 374 (items, the league landing), 375 (refunds in part), 376 (refund cap) — dev only | 5–7 d |
| **12c** bank debit | bank debit for both flows at once (L2): the debit agreement, Processing until it clears with the spot held (A4), a fourth "Processing" figure on the Money band while clearing (A11), a returned debit's fresh Pay and self-clearing item. ⚖ The tournament card flow moved into 12a (owner, 2026-10-25). **+ A partial refund of a tournament team's card payment (L1 for tournaments, owner 2026-10-26, §0f):** a team's paid figure counts whole payment rows today, so it needs a "refunded so far" amount on the team's payment row (the team payments refresh sums amount less it), the refund functions taking an amount, and an amount field in the team's refund window — **BUILT 2026-10-26 (§0 state)** | migs 382 (a team payment's refunded-so-far + entry-adjustment list, the clearing state), 383 (a refund remembers when it came back and who was told), 384 (a refund made in Stripe records itself), 386 (a club account takes bank debit), 387 (the desk: decisions, reversal, the returned-debit fee), 388 (a decision and a reversal hold their ground) | 3–5 d (+1–2 d) |
| **12d** hardening | **card disputes** (today a card dispute is dropped without a word; only a bank debit's is handled) and the dispute fees Stripe bills the platform (Stripe covers negative balances); **paid twice** (house league already refuses and raises an item, generically titled; **a tournament team's overpayment books silently**, census 2026-10-26); a payouts list for matching the bank; "+ GST/HST" rider; international cards; platform-admin oversight; offboarding with registrations still to pay (the Disconnect window doesn't count house league; downgrade, cancel and deletion say nothing); help; **the terms: the agree box, refusal and who/when/version are already built — only the read-out, "agree again" and counsel's text remain** — **DRAWN 2026-10-26, asks open (§0 state)** — **BUILT: 12d-1 2026-10-27 (disputes, paid twice, every club pays its Stripe fees) and 12d-2 2026-10-27 (payouts tab, leaving, terms, the console); Stage 12's build is complete (§0 state). Counsel's terms text remains.** | 390, 391, 395, 396, 399 (12d-1); 401, 403 (12d-2) — dev only | 10–15 d |

The 12a–12c total of 16–22 days matches the scoping plan's first-build estimate (15–22). 12d matches its 10–15. Every
migration updates `docs/agents/db/DATA_DICTIONARY.md` and refreshes both snapshots in the same unit of work.

## 5 · Asks (all ruled as recommended 2026-10-25; the rulings are §0b)

A1 who connects (rec: the owner; the treasurer sees the state and alerts) · A2 the fee on a refund (rec: by who ends it) ·
A3 saved card (rec: no) · A4 a bank debit while it clears (rec: processing state, spot held) · A5 rep dues online (rec: not
in Stage 12) · A6 not connected (rec: Stage 9's screens plus one quiet line) · A7 tournament deposit (rec: both, deposit
pre-selected, the saving shown) · A8 the Tournament Plus home (rec: the same card on tournament settings) · A9 refund policy
sentence (rec: optional, shown as a link) · A11 Processing on the band (rec: yes, only while non-zero) · A12 tournament
refund from the payment (rec: yes) · A13 who refunds (rec: whoever records payments in that flow, plus the treasurer) ·
L1 partial refunds in 12b (rec: yes) · L2 bank debit (rec: card in 12a, bank debit in 12c) · **A14 (owner, 2026-10-24) may
the club choose who pays the processing fee** (rec: yes, one club-wide setting on the Payouts card, families pay by
default; club-pays = families see the base amount, the fee is a "Payment processing" cost line). Ruling it turns the
2026-07-28 family-pays decision from the only way into the default, so /strategy logs it and the Facts doc rider
"org-absorb override" closes. The pay block no longer carries the "the club receives the full fee" sentence (owner
2026-10-24).

## 6 · Owner steps (not code)

- Counsel session (memo ready). **No record found that it is booked**; confirm. **Add to the memo:** is a fee the family
  pays only when paying by card a card surcharge under the card networks' Canadian rules (cap, notice, Quebec)? If yes,
  A14's club-pays mode is the fallback.
  **Add to the terms brief (owner 2026-10-27):** the payments terms must tell the club that Stripe costs its payments cause
  are billed to it, comped and free clubs included: a returned bank debit, a card dispute, and a card issued outside
  Canada (for example, a team from another country paying a tournament). The product never surcharges the family.
- Accountant: the GST/HST display (paused 2026-10-26, ask 8).
- Insurance broker quote.
- Enabling Connect on the platform's Stripe account, in test mode. This is an external sign-up; ask before doing it.

## 7 · /billing on the gate (2026-10-24, review only)

- **One new key** (working name `online_payments`) with `FEATURE_MIN_PLAN` = `tournament_plus`. `PLAN_RANK` makes it
  cover `tournament_plus`, `league` (League Plus), `club` and `club_large` (Club · Association). It excludes `tournament`
  and `team` (the Premium Coaches Portal, rank 0). Keep it **separate from `payment_tracking`** (hand tracking, also at
  `tournament_plus`) so a packaging change can move one without the other. The launch switch is a platform setting, not a
  plan key.
- **"Three" vs "four" paid org tiers is wording drift, not a different set.** The Facts doc counts Club · Association
  inside Club; the Club plan counts it separately. Canon: "every paid org plan (Tournament Plus and above)", in the Facts
  doc; the Club plan points at it. The Facts doc + `lib/plan-config.ts`/`lib/plan-features.ts` change together when the key
  is built (Facts doc drift check).
- **Fee arithmetic:** rate × the base fee + the flat part, on the base, is consistent with the Facts doc (all-in,
  family-pays, organizer nets the full fee) and the scoping plan (the processor's cost falls on the grossed-up total).
  Rounding is unspecified: half-up to the cent, computed once on the server and stored with the payment.
- **The Facts doc's org-absorb rider is answered by A14** (ruled 2026-10-25: one club-wide choice, families pay by
  default), built in 12a. /strategy records it and closes the rider; the Facts doc and `lib/plan-config.ts` change
  together when it is built.
- **Overrides:** a platform plan override grants the feature with the plan. Check the comped coach-portal shadow orgs
  when 12a is built.

## 8 · Definition of done

Counsel's sign-off recorded. The club nets the full fee. A payment shows in its books untyped, through the flow's own
writer. A refund works from the record. Mark received still works. Unit tests cover the paid-state rule, the gate, the two
landings and the fee arithmetic against the Facts doc. Layout sweep on the touched screens. The Stage 12 walk passed.
