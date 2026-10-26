# Club Tier Stage 12b: families pay house-league fees by card (build prompt)

> **Written 2026-10-25**, after the 9b-2 walk (ledger §378) was marked done. **Paste this into a new chat on `dev` and
> re-verify every lead first**: the leads come from a census at `9c1545220` (a helper's reads, with the load-bearing ones
> re-read by me), so this prompt names **files, not lines**, and code moves. Other sessions share this working copy.
> Stage explicit paths only and commit only your own hunks.
>
> **Recommended model: Opus 5.5** (money, a second flow on a Stripe integration, a schema change to a live money table,
> auth on new routes). Helpers stay on Sonnet as configured.
>
> 12b is built in **parts, each committed locally after its own checks**. **Nothing charges real money:** test mode
> only; production keeps the feature switched off until counsel signs off (`LIVE_PAYMENTS_ALLOWED` stays false).

## What 12b makes true

- **A family pays a house-league fee by card on their phone**, the moment a child is accepted. The fee is shown before
  paying when families pay it (A14), and the receipt is in the club's name.
- **Every Stage 9 "Pay now" ghost comes alive** when the club is taking payments, and stays exactly today's screens when it
  isn't (A6). Those are the sign-up confirmation, the family status page, and the sign-up, approval and
  promoted-from-the-waitlist emails.
- **The convenor sees online next to by-hand** on the Registrations rows and the season's Money page ("Online, card" with
  a receipt number), and can **email a family the pay link** (also for a registration that was ended and then reinstated).
- **Refund to the card** starts from the window that ends a registration, and from a price correction on a paid
  registration. **Partial refunds** (L1) land here for both the house-league flow and the tournament flow.
- **The who-pays choice says who actually pays**: on League and Club it reads "Families and teams pay it" (COPY §20); on
  Tournament Plus it stays "Teams pay it". It is still ONE club-wide setting.
- A card payment lands in the season's book through **the one house-league money writer** (9b-2) as a `receive` with
  `method: 'online_card'`, a day and an amount. Mark received keeps working beside it.

## The rulings (do not reopen; record nothing they did not rule)

Verbatim in `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` §0b–§0d. The ones 12b builds:
- **2026-07-28 (with amendments):** direct charges on the club's own account, application fee, every paid org plan, counsel
  is the launch gate, **rates live only in the Facts doc and are read from `lib/plan-config.ts`** (never type one).
  FieldLogicHQ **keeps its fee on every refund** (§0c): a refund that includes the fee costs the club the whole fee, shown
  as a "Payment processing" cost; the application fee is never refunded.
- **A14:** families pay the fee (default) or the club pays it. Club pays = the family sees the base amount only.
- **A2 = C:** the "include the processing fee" box on a refund (shown only while families pay the fee): on when the club
  declines or cancels, off when the family asked to leave; the convenor can change it.
- **A3** no saved cards · **A4/A11/L2** bank debit and "Processing" are 12c, **do not build them** · **A6** not taking
  payments → Stage 9's words, no button, one quiet "Let them pay online" line only for whoever can connect.
- **A13** who may refund: **house league: owner, club admin, league admin, registrar (the house-league gate's
  `takeFees`), plus the treasurer.** The census found 12a's `canRefundOnline` is tournament-based (`create_tournaments`),
  so a registrar would be refused: add a house-league variant, don't widen the tournament one.
- **L1** partial refunds are in 12b.
- **Pay when accepted** (Stage 9 Q1, and the same rule 12a used): a family pays after the child is accepted, never at
  Submit. A child on the waitlist or pending approval has nothing to pay.
- **Mark received stays.** Every hand path (Mark received, Record a payment on Families, the price correction) is unchanged.

## Read first

- `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` (§0b–§0d, §3, §4 12b row) and the drawings,
  https://claude.ai/artifact/X7quYgnDpiWV9Dh76TYm57 (source `CLUB_TIER_STAGE12_DRAWINGS.html`).
  - **Build to the drawings:** the **12b House league** tab (b1 status page, b2 approval and promotion emails, b3 the
    convenor's rows, b4 the family record in Families, b5 pay link for an ended registration, b6 correcting a price after a
    card payment); the shared **Checkout** tab (k1 pay block, k2 the walk after Sign up, k3 receipt email); **Books &
    refunds** (m1 Money page, m2 Statement, m3 refund from the ending window).
  - The 12c tab is bank debit: **do not build it.**
- `CLUB_TIER_STAGE12A_COPY.md` §8–§18 (shared words) and **§20 "Held for 12b"** (the eight label variants, "Departures",
  open question Q1). **Family-facing copy for the pay block, the status page's "paid online" line, the family pay link and
  the partial-refund window does not exist yet**: write it through `/marketing` into `CLUB_TIER_STAGE12B_COPY.md` before
  building words.
- `HOUSE_LEAGUE_STAGE9B2_BUILD_PROMPT.md` and `project_club_stage9_house_league` (memory): the writer, its refusals-as-data,
  its traps. **12a's code is the template**: `lib/online-payment-landing.ts`, `lib/stripe-connect.ts`,
  `app/api/pay/team/[token]/route.ts`, `lib/team-pay-view.ts`, `components/public/TeamPayContent.tsx`,
  `lib/online-payment-words.ts`, mig 358/359.
- `AGENTS.md`: Next 16; read the route-handler guide in `node_modules/next/dist/docs/` before a new route.
- Stripe's docs, current version, not memory (the pinned API version is in `lib/stripe.ts`; account creation is v2/preview,
  everything else pinned: plan §0d). Partial refunds on a direct charge with `refund_application_fee`.

## Verified state (leads; re-check each)

- **No shared pay block exists.** The "one pay block for every flow" in the drawings (k1) is unbuilt: the tournament pay
  page is `TeamPayContent.tsx` fed by `buildTeamPayView`; house league has an email-only `payBlock()` in `lib/email.ts` and
  two inline "To pay" cards with a **disabled** "Pay now" (`components/league/RegisterForm.tsx` and the status page's
  `StatusLookupForm.tsx`). Decide whether to extract a shared block or add a league view beside the team one, and say why.
- **`online_payments` is team/tournament-shaped** (mig 358): `flow` check allows only `tournament_team`; `scope` is
  `deposit/balance/full`; columns `tournament_id` + `team_id`; a unique index allows one open session per team; and the
  land function (`online_payment_land`) **raises when `team_id`/`tournament_id` is null** and calls the tournament writer
  inside one SQL transaction. 12b needs a migration (dev only) and a decision about shape (below).
- **`online_payment_items` was deferred to 12b** by the schema review (`CLUB_TIER_STAGE12A_SCHEMA_REVIEW.md`, "don't build
  unless 12b proves it needs it"). It does: a sign-up pays for several children at once.
- **The house-league writer is TypeScript, not SQL:** `writeLeagueMoney(ctx, {seasonId, regId}, move)` in
  `lib/league-fee-paid.ts` → RPC `club_league_money`.
  - It **needs `ctx.user.id`** (`p_actor`); a webhook has no user. `accounting_entries.created_by` is nullable: propose a
    system-actor option and make it explicit. It does not exist today.
  - It returns **refusals as data** (`ended`, `not_accepted`, `already_received`, `over`, `date`, `future`, …), and refuses a
    day in a closed fiscal year. A payment can arrive after a decline, a withdrawal, or someone else's Mark received:
    **Stripe has the money while the writer says no.** That is the `land_failed` case: raise the self-clearing Needs
    attention item and offer the refund. Do not swallow it.
  - It is **not atomic with `online_payments`** (two calls). Design the order and the idempotency so a retried webhook
    never writes a second receive line; prove it with a test.
  - `LEAGUE_MONEY_METHODS` already contains `online_card`, and the label map already reads "Online, card", but the picker
    on the hand paths (`MoneyKit` `MethodField`) correctly does not offer it: keep it out of the hand paths.
  - There is no deposit or instalment: one fee, part payments allowed up to the balance. A7's deposit-or-full does **not**
    apply; show what is owing.
  - A sign-up with several children shares a `signup_ref`; the status page already sums "To pay". One card payment of
    several children = one `receive` per child.
- **No league pay link or token.** The tournament token is an HMAC of the team id (`lib/team-pay-link.ts`, never stored,
  never expires). League status lookups prove possession with email + reference. Propose the token scope (a sign-up) and
  its URL; "links never expire" and "scoped to one sign-up" are the rulings, the shape is yours to propose.
- **Where the ghosts are** (each must flip when the club is taking payments and stay as is when it isn't):
  sign-up confirmation (`RegisterForm.tsx`) · status page (`StatusLookupForm.tsx`) · `payBlock()` in `lib/email.ts`, used by
  the sign-up email and by `acceptedPay` for the approval and waitlist-promotion emails · the Registrations row menu
  (`lib/house-league-registrations.ts` `RowActionKey`: no "Email the pay link" exists) · the Money page's quiet "Let them pay
  online" line (tournament version exists in `PayoutsStatusLine.tsx`, league version does not) · the ending window
  (`EndWindow.tsx`) and `PriceWindow.tsx` · the Families page's help text.
  `tests/unit/house-league-signup-guard.test.ts` **pins the disabled Pay now and must flip** with its comments.
- **Refunds:** the 12a refund is full-only (`online_payment_refund_open` sets the amount; the index
  `online_payment_refunds_one_full_refund` must be dropped by name for partials, per its own comment; `reason` is
  `organizer_ended`/`team_left`). On the book side, `refund` already takes an amount, and a price correction already
  refunds `received − new price` as its own expense line. So: **the book half of L1 exists; the card half does not.**
  Today the ending window has no "refund to the card" choice; add it so the Stripe refund and the book line are one act
  and can't disagree.
- **Fee payer "club":** the tournament flow files a "Payment processing" cost line on the event's shelf. House league has
  no equivalent; the Statement keys house-league lines off the season's budget words (mig 371/372). Find how a processing
  cost line files for a season, and keep a family's fee out of revenue (A14).

## Before any code

1. **Product-manager UX summary** (AGENCY_RULES, blocking): what a family, the registrar/convenor, the treasurer and the
   owner see differently, with the role differences. Get the owner's yes.
2. **The words through `/marketing`** → `CLUB_TIER_STAGE12B_COPY.md` (the gaps listed above). House rules: sentence case,
   "8:00 a.m.", the bare possessive, "instalment" is spelled **installment**, `npm run check:spelling`. Legal text is
   counsel's: placeholder only.
3. **Bring these design choices to the owner as short proposals with a recommendation, before building:**
   a. **One payment per child, or one payment for a sign-up with items?** (`online_payment_items`). The family wants one
      checkout for siblings; the books want one line per child. Recommend items, and say why.
   b. **How the landing works when the writer is TypeScript** (ordering, idempotency, system actor, refusals).
   c. **The family pay-link token scope and URL.**
   d. **Whether the pay block is extracted and shared now.**
4. **`/dba` on the migration** (dev only): widen `flow`; make `tournament_id`/`team_id` optional per flow without losing
   the tournament guards; the open-session rule per sign-up; items; the refunds index for partials; reasons for a
   house-league ending; a link from the house-league money line to the payment. RLS on every table, the data dictionary and
   both snapshots in the same unit of work (`npm run check:dictionary`). Declare it in `MANUAL_PROD_STEPS.json`.

## What to build, in parts

**Part 1 · Schema and the landing (commit first).** The migration; the league landing as the single named landing next to
the tournament one; the extended guard (`online-payments-guard`: landing-only, the writer call, no other file marks a payment
paid) **and** `house-league-money-guard` still true (nothing but `writeLeagueMoney` calls `club_league_money`). The system
actor. Tests: lands once under a replayed webhook; a refusal raises the item and leaves the payment recorded as taken;
a late payment after a decline; a closed year.

**Part 2 · The pay route and the family pay page.** Re-reads what is owing at the moment of paying; refuses an ended,
unaccepted, waitlisted or paid registration ("no longer payable" / "already paid"); creates a Checkout Session on the club's
account for the owed total of the chosen children (base line + "Processing fee" line while families pay it); application fee
per A14; prefilled email; button disables on press. Return goes to our receipt, which waits for the webhook and never shows
Paid on the redirect alone. The pay block states are the six in plan §3, card only.

**Part 3 · The ghosts.** Flip each surface in the list above, behind the same "club is taking payments" read the tournament
side uses. Pay now in the sign-up, approval and promoted emails; the status page's paid-online line; the confirmation walk
(k2). The disabled button and its guard go; **when not taking payments, today's screens are word-for-word unchanged.**

**Part 4 · The convenor's side.** Online beside by-hand on the Registrations rows and the Money page (Received counts it;
the Money page's paid-online breakdown); "Email the pay link" (+ "Pay link sent") in the row menu; the "Let them pay online"
quiet line on the Money page for whoever can connect; the treasurer's Payouts status on the season Money page. Needs
attention items for a payment that couldn't be recorded, with the refund door.

**Part 5 · Refunds, in full and in part.** The ending window offers "refund to the card" (the A2 box while families paid the
fee); the price correction refunds the difference to the card; partial refund amounts for the tournament row too (A12 row
⋯). Book line and Stripe refund as one act; Stripe failure raises a self-clearing item to refund another way. Who: the
house-league variant of A13. Refund email, family-worded.

**Part 6 · The books.** An online payment is revenue at the base in the season's book through the one writer; a club-paid fee
is one "Payment processing" cost line per payment; a refund nets the fees row and Collected, never Spent (`isFeeRefund`).
Check the Statement and Budget vs. Actual on a Club-plan dev club.

**Part 7 · Help, copy sync, demos, lists.** `/docs`: families paying online, the convenor's side, refunds, the label.
`lib/help-content/families.tsx` currently says "Online payment isn't available yet": fix it. Comments that say "until
online payment exists" and "no family credit before Stage 12" go with the work. Demos follow the product (nothing to do unless
a tour anchor moved). `check:layout --changed` on the touched screens at 1440 and 390, Warm and Dark; never a whole-product
sweep on dev (house league can't be measured by it; the UAT club forwards to its own domain, so walk those on a phone).

## Definition of done

- Parts 1–7 committed; `npm run verify:changed` and `npm run typecheck` clean; `/review` on Part 1 and on the whole.
- Unit tests: the fee arithmetic against the Facts doc line, both A14 modes, the gate and switch, both landings listed in the
  guard, replay/idempotency, late and declined payments, siblings in one checkout, partial refund arithmetic including the
  fee, the A13 variant, and the flipped signup guard. `scripts/house-league-money-check.sql` extended for a card receive.
- **End to end in test mode** on the test Express account from the 12a walks: a family pays one child; a family pays two
  siblings in one checkout; Pay now from the approval email; a promotion from the waitlist; the convenor emails the pay link;
  a decline between Checkout and the webhook; a partial refund; a full refund with and without the fee; club-pays mode.
  The email checks the 12a walks deferred (E4, E9, F5, G1, and the D/E/G sections of walk 2) belong to the ONE final
  end-to-end pass on Amplify dev once Stage 12 is built: write them into that pass, don't re-walk them locally.
- **The switch is off in production**, verified by a test.
- **The 12b walk:** a checkable Artifact plus the next § in `OWNER_QA_LEDGER.md` (check the latest number), one purpose per
  walk; signed in as owner, registrar, treasurer, plus a family on a phone. Club-plan walk on `uat-rep-club`; League Plus on
  `dev-league-org` (League Plus has no Accounting: the treasurer view is Club-plan only).
- **Records:** plan §0 and §4 (12b state, anchors); the Club index news row (`ArtifactData`, artifact
  `MBKRySURVFu3V9cZJvmjVr`, stage `s12`; read first and pin `if_version`); the TODO line; the memory file
  `project_club_stage12_payments`; the Facts doc only if a rate or gate changed (it shouldn't).

## Do not

- Charge real money, use a live key, or switch the feature on in production.
- Build bank debit or "Processing" (12c), disputes or a payouts list (12d), rep-team dues online (A5), saved cards, a
  "payment pending" status, a second money writer, or any household money.
- Write to `club_league_money` from anywhere but `writeLeagueMoney`, or to the tournament payment tables from the league
  landing.
- Restate a rate anywhere. Write a legal sentence.
- Widen the tournament refund permission to fix the registrar's; add a league variant.
- Reopen a ruling. If the code says a ruling can't be built as drawn, bring it to the owner drawn, before building around it.
- Push or promote.

## Git

- `dev` only; explicit pathspecs; `git show --stat HEAD` after every commit. Another session's work may be staged: build
  your commit in a temporary index (memory: "Partial commit out of shared files").
- Part 1 in its own commit. Migrations stay on dev (declared pending in `MANUAL_PROD_STEPS.json`; 361–363 and 368–372
  already wait ahead of it).
- No push and no promote without the owner's word.
