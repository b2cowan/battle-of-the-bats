# Club Tier Stage 12 — families pay online (plan)

> Opened 2026-10-24 with a drawing round (kickoff: `CLUB_TIER_STAGE12_KICKOFF_PROMPT.md`). Drawings: the Club Payments
> Drawings artifact (source `CLUB_TIER_STAGE12_DRAWINGS.html`, built by `.probe/s12/build.mjs`). PM brief:
> `CLUB_TIER_STAGE12_PAYMENTS_PM_BRIEF.md`. Parent: `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` § Stage 12. Decisions that bind
> it: `FACILITATED_PAYMENTS_SCOPING_PLAN.md`, `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-07-28), Stage 9's rulings
> (`HOUSE_LEAGUE_STAGE9_PLAN.md` §0, §0b, §2, §6a) and its payments contract (`CLUB_TIER_STAGE9_DEEP_DIVE_PROMPT.md` §4).
> **Rates live only in `docs/agents/strategy/PLAN_PRICING_FACTS.md`; the build reads them from `lib/plan-config.ts`.**
> No release timing: the Club release ships when every stage is complete and tested.

## 0 · State

- **Drawn 2026-10-24. All 15 asks RULED 2026-10-25, every one as recommended** (§0b). Nothing built. No Stripe account
  or key created.
- A14 logged by /strategy 2026-10-25 (BUSINESS_DECISIONS.md; the Facts doc rider closed). **12a build prompt written
  2026-10-25: `CLUB_TIER_STAGE12A_BUILD_PROMPT.md`.** The owner moved the tournament card flow into 12a so it can be walked
  end to end; 12c is now bank debit for both flows. 12b waits on 9b-2.

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
| **12b** house league | every Stage 9 ghost; Pay now in approval and promotion emails; Email the pay link; no longer payable; refund in the end window; partial refund (L1); Families lines | none beyond 12a once 9b-2 has the writer's amount/date/method | 5–7 d |
| **12c** bank debit | bank debit for both flows at once (L2): the debit agreement, Processing until it clears with the spot held (A4), a fourth "Processing" figure on the Money band while clearing (A11), a returned debit's fresh Pay and self-clearing item. ⚖ The tournament card flow moved into 12a (owner, 2026-10-25) | a way-of-paying value for bank debit | 3–5 d |
| **12d** hardening | disputes and negative balance, paid twice, a payouts list for matching the bank, "+ GST/HST" rider, international cards, platform-admin oversight, offboarding with registrations still to pay, help, the terms | disputes, payouts | 10–15 d |

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
- Accountant: the GST/HST display.
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
