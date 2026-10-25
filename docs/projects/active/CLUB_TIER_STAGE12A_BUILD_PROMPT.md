# Club Tier Stage 12a: payouts, one checkout, and a tournament team paying by card (build prompt)

> **Written 2026-10-25**, the day Stage 12 was ruled. **Paste this into a new chat on `dev` and re-verify every lead
> first**: the leads come from the Stage 12 census (helpers plus my own reads of the cited lines), so this prompt names
> **files, not lines**, and code moves. Other sessions share this working copy. ⚠ **The Stage 9a build is running in the
> house-league files** (its routes, `lib/league-fee-paid.ts`, `lib/families-payment.ts`, the Stage 9 plan): 12a touches
> none of them. Stage explicit paths only and commit only your own hunks.
>
> **Recommended model: Opus 5.5** (money, a second Stripe integration beside billing, webhooks, auth on new routes);
> helpers stay on Sonnet as configured.
>
> 12a is built in **parts, each committed locally after its own checks**, in the order below. **Nothing charges real
> money:** test mode only, and production keeps the feature switched off until counsel signs off.

## What 12a makes true

- **The club connects payouts.** The owner (A1) sees a Payouts card on the club's settings page (or, on Tournament Plus,
  the tournament settings page, A8). Set up payouts first opens **"Before you set up payouts"**: the rates, who pays the
  processing fee (A14, families by default), where the money goes, the refund policy, and the payments terms. It then
  hands over to Stripe's own onboarding and comes back. The card has five states: not set up, setting up, taking
  payments, needs attention, and disconnected. The treasurer sees the state and gets the alerts (A1).
- **One pay block, Stripe's page, one receipt**, built once and shared. 12a is card only (L2).
- **Its first real use is a tournament team paying its entry by card** (owner, 2026-10-25: 12a proves itself on the
  tournament flow, because house league waits on 9b-2). A team submits as "Pending organizer review"; once accepted, it
  pays its deposit or the full entry from the acceptance email, a balance reminder, or a link the organizer emails. The
  payment lands in the team's record as one more dated payment ("Online, card"), through the same write as Record a
  payment, and in the tournament's book.
- **The organizer refunds a card payment in full** from that payment's ⋯ (A12). Partial refunds are 12b (L1).
- When the club isn't taking payments, everything a team sees is exactly today's (A6).

## The rulings (do not reopen; record nothing they did not rule)

Verbatim in `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` §0b. The ones 12a builds:
- **2026-07-28 (with the 2026-10-25 amendment):**
  - Stripe Connect **direct charges** on the club's own **Express** account; FieldLogicHQ never holds the funds and takes
    its part as an application fee.
  - Every paid org plan (Tournament Plus and above); free tiers and the Coaches Portal are excluded.
  - Counsel's sign-off is the launch gate.
  - **Rates live only in `docs/agents/strategy/PLAN_PRICING_FACTS.md`;** the build reads them from `lib/plan-config.ts`.
    Never type a rate into a screen, a test fixture or a doc.
- **A14** (logged in `BUSINESS_DECISIONS.md` 2026-10-25): one club-wide choice, "Families pay it" (the default) or
  "The club pays it".
  - **Families pay it:** the fee is added and shown before paying.
  - **The club pays it:** the team pays the fee alone, and the processing fee is a "Payment processing" cost in the books,
    never a reduction of fee revenue.
- **A1** The owner connects and disconnects. The treasurer sees the state on the Money pages and gets "needs attention".
  Nothing else in Settings opens for them.
- **A8** The same card, at the end of the tournament settings page, for Tournament Plus.
- **A9** One optional refund-policy sentence on the Payouts card, shown as a "Refund policy" link beside Pay; absent when
  blank.
- **A3** No saved cards.
- **A6** Not taking payments → today's screens, no button; one quiet "Let them pay online" line only for whoever can
  connect.
- **A7** Deposit or full, deposit pre-selected, the fee saving of paying in full shown (only when families pay the fee).
- **A12** A tournament refund starts from the online payment's ⋯.
- **A13** Card refunds: whoever runs tournaments, plus the treasurer.
- **A2 = C** The refund window's "include the processing fee" box (shown only while families pay the fee):
  - on by default when the organizer is ending it;
  - off when the team asked to leave;
  - the organizer can change it.
  - Under it, the processor's kept share is a "Payment processing" cost line.
- **L2** Card only in 12a; bank debit is 12c, for both flows.
- **Owner, 2026-10-24:**
  - The pay block carries **no** "the club receives the full fee" sentence: the payer needs the amount only.
  - The club is told the fee before Stripe (Stripe's onboarding never shows it).
- **Mark-paid stays.** Every hand path (Mark paid, Record, "+ Record a different amount", the pencil) is unchanged.
- **Pay when accepted** (the census correction, matching Stage 9 Q1): a team pays after the organizer accepts it, never at
  Submit.

## Read first

- `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` (the census, §3 design, §7 /billing) and the drawings,
  https://claude.ai/artifact/X7quYgnDpiWV9Dh76TYm57 (source `CLUB_TIER_STAGE12_DRAWINGS.html`).
  - **Build to the drawings:** 12a tab, Checkout tab, 12c tab, Books & refunds §3–§4.
  - The house-league tab is 12b: **do not build it.**
- `FACILITATED_PAYMENTS_SCOPING_PLAN.md`, `FACILITATED_PAYMENTS_COUNSEL_BRIEF.md`, the Facts doc's facilitated-payments
  line, and the 2026-10-25 decision.
- `AGENTS.md`: this is Next 16. Read the route-handler and proxy guides in `node_modules/next/dist/docs/` before writing a
  route; the webhook must pass `proxy.ts` without a session.
- Stripe's own docs, current version (the repo pins the API version in `lib/stripe.ts`):
  - Connect direct charges with `application_fee_amount`;
  - Express accounts and Account Links;
  - Checkout Sessions created on a connected account;
  - Connect webhooks (a separate endpoint with its own signing secret; `account.updated`,
    `checkout.session.completed`, `charge.refunded` and the related events);
  - refunds with `refund_application_fee`.

## Verified state (leads; re-check each)

- **Stripe today is subscriptions only:**
  - `lib/stripe.ts`, the `app/api/billing/*` routes, and one webhook, `app/api/billing/webhook/route.ts` (a template for
    signature checks and idempotency, not a place to add Connect events);
  - test mode is detected by key prefix (`lib/stripe-prices.ts`);
  - no Connect code anywhere, and no column for a club's account.
- **Tournament payments:**
  - writer: `lib/team-payments-server.ts` (record, pay due, change, remove) → the `tournament_team_payment_*` database
    functions (mig 345);
  - rows: `tournament_team_payments` with amount, date, label and method;
  - the team's `total_paid` / `deposit_paid` are a cache; `tests/unit/team-payments-guard.test.ts` fails the build if app
    code writes them;
  - the tournament book line is written when the fee book is on.
- **Today's surfaces:**
  - team record: `app/[orgSlug]/admin/tournaments/registrations/components/TeamRecord.tsx` + `TeamPayments.tsx`;
  - public form: `app/[orgSlug]/[tournamentSlug]/register` (the review step's "Payment handled by organizer" box: total fee,
    deposit, "Payments are made directly to the organizer, outside the platform.");
  - **find** where the team-accepted email and the balance reminder are sent (leads: the registrations routes and the
    email templates).
- **A typed refund for a withdrawn paid team** exists separately from the payment (Stage 7a). **Find how it is recorded**
  and land a card refund through the same path. If there is none, bring it to the owner before inventing one.
- **Settings:**
  - `components/admin/kit/club/SettingsKit.tsx` is owner-only (`org_settings` in `OWNER_ONLY_CAPABILITIES`,
    `lib/member-access.ts`), with its cards in this order: details, birthdays, public-site door, Delete;
  - `app/[orgSlug]/admin/org/layout.tsx` sends Tournament and Tournament Plus orgs away, hence A8's second home under
    `admin/tournaments/settings`;
  - `canMoveClubMoney` is the club-money rule (accounting holders).
- **Gate:** no key exists. Add one (working name `online_payments`) at `tournament_plus`, separate from
  `payment_tracking`. `team` (Premium Coaches Portal) ranks 0 and stays excluded.

## Before any code

1. **Owner step: Connect in test mode on the platform's Stripe account.** This is an external setting in the owner's
   name, so **ask before touching Stripe**.
   - Never create or use a live key.
   - The Connect webhook needs a new secret env var (a name of your choosing, e.g. `STRIPE_CONNECT_WEBHOOK_SECRET`) in
     `.env.local`. Staging needs the same, which is an owner step.
   - A new env var means a dev-server restart before hand-off (AGENTS.md).
2. **The product-manager UX summary** (AGENCY_RULES, blocking): what the owner, treasurer, tournament organizer and a
   team see differently, with the role differences. Get the owner's yes.
3. **The words through `/marketing`** → `CLUB_TIER_STAGE12A_COPY.md`. That covers:
   - the Payouts card's five states and the rates line;
   - "Before you set up payouts";
   - the disconnect window;
   - the treasurer's status line;
   - the pay block's states;
   - the receipt page and email;
   - the review-step payment box (connected and not);
   - Pay now in the acceptance email and the reminder;
   - "nothing to pay" and "already paid";
   - the refund window and the refund email.

   **The payments terms are counsel's to write:** use a clearly marked placeholder, never invented legal text. House
   rules apply: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`.
4. **`/dba` on the schema before the migration:**
   - the club's connected account (one per organization: Stripe account id, state, what Stripe still needs, who
     connected and disconnected it and when, who pays the fee (A14), the refund-policy sentence, who agreed to the terms
     and when);
   - online payments (organization, flow, the team or registration it pays, payer email, base, fee, total, who paid the
     fee, way of paying, state, the Stripe ids, receipt number, times);
   - refunds (amount, fee included, reason, who, Stripe id, state);
   - a log of Stripe events so none is applied twice.

   RLS on every table; the data dictionary and both snapshots in the same unit of work (`npm run check:dictionary`).

## What to build, in parts

**Part 1 · The gate, the switch and the schema (commit first).**
- **Gate:** the feature key in `lib/plan-features.ts`, plus the Facts doc line and a `/billing` drift check in the same
  unit of work.
- **Launch switch:** a platform switch that is **off in production by default**. With it off, no Payouts card and no
  Pay button render anywhere, and the pay and connect routes refuse.
- **Schema:** the migration from `/dba` (dev only).
- **Rates:** read from `lib/plan-config.ts` by one fee function: rate × the base + the flat part, rounded half-up to the
  cent, computed once on the server and stored on the payment. Unit tests check it against the Facts doc line (parse it,
  as `.probe/s12/kit.mjs` does), so a rate typed anywhere else fails.
- **Guard test:** an online payment lands only through the named landing, which calls the tournament writer. No route
  writes the payment cache or a book line itself.

**Part 2 · Payouts (drawn: 12a §1, §1b, §2, §2b, §3, §4).**
- **The card:** both homes; owner-only actions, checked on the server. On the club page it sits after the public-site
  door and before Delete organization.
- **"Before you set up payouts":** rates printed from config; the A14 choice; the terms checkbox, recorded.
- **Onboarding:** Account Links with return and refresh URLs. On return, read the real state from Stripe; the
  `account.updated` webhook keeps it current.
- **The record:** reads first; the pencil flips the whole record. It holds the A14 choice (autosaves; it tells nobody)
  and the A9 sentence.
- **Disconnect:** a rare door at the end of the card, asking in a window that counts what is still owed. It stops new
  payments; past payments stay in the books and are refunded in Stripe.
- **Needs attention:** an item for the owner and the treasurer that clears itself when Stripe says the account is
  enabled.
- **The treasurer's status line** on the Accounting overview (club) and the tournament's Money page.
- **The quiet line** for whoever can connect (A6).

**Part 3 · The one checkout (drawn: Checkout tab §1–§3).**
- **The pay block component**, 12a states: owing (card only), confirming, not finished, paid, nothing to pay / already
  paid, and not taking payments (today's words).
- **The pay route:**
  - re-reads what is owed at that moment;
  - refuses an ended, unaccepted or paid team;
  - creates a Checkout Session on the connected account for that amount (direct charge):
    - families pay: the base line plus a "Processing fee" line;
    - the club pays: the base line only;
    - the application fee per A14 in both cases;
  - prefills the payer's email.

  Both buttons disable on press ("Opening the secure payment page…").
- **Links** carry a token scoped to one team; they never expire on their own.
- **Return:** to our receipt (the pay page's paid state), which waits for the webhook and never shows "Paid" on the
  redirect alone.
- **Receipt email:** one per payment, from our email stack in the club's name with the club as reply-to. Stripe's own
  receipt is off.
- **Test mode:** marked on the Payouts card and on every test receipt.

**Part 4 · The tournament flow (drawn: 12c §1–§3).**
- **Review step:** the payment box says what will happen when the club is taking payments; it is today's box word for
  word when it isn't (A6).
- **Pay now:** in the team-accepted email, and "Pay the balance" in the balance reminder.
- **The team's pay page:** in the tournament's theme, with deposit or full (A7, deposit pre-selected; the saving line
  only while families pay the fee).
- **The landing:**
  1. the Connect webhook marks the online payment paid (idempotent);
  2. the landing calls the tournament writer: amount = the base fee, dated the payment day, label Deposit / Balance /
     Payment, method **online card** (a new method value), linked to the online payment;
  3. the tournament book line follows from the writer as today.
- **The team record:**
  - "Online, card" plus the receipt number on that row;
  - no pencil on an online row;
  - its ⋯ offers View the payment and Refund to the card;
  - "Email the pay link" in the balance row's ⋯, then "Pay link sent";
  - Mark paid, Record and "+ Record a different amount" unchanged.
- **The registrations list** and its Payments line read the same rows and need no change. Check that they don't.

**Part 5 · Refund to the card, in full (drawn: Books & refunds §3, for the tournament row).**
- **The window:**
  - the amount;
  - while families paid the fee, the fee checkbox (A2 = C), asking whether the organizer is ending it or the team asked
    to leave;
  - a note;
  - the button names what it does ("Refund and email").
- **The refund** goes to Stripe with the application fee returned when the fee is included. It lands through the same
  path today's typed refund uses (see Verified state).
- **Under A2**, the processor's kept share is a "Payment processing" cost line.
- **The refund email.** A refund that can't reach the card raises a self-clearing Needs attention item to refund another
  way.
- **Who:** A13.

**Part 6 · The books (drawn: Books & refunds §1–§2 in tournament form).**
- An online payment is revenue at the base amount in the tournament's book, filed exactly as a hand-recorded one.
- When the club pays the fee, one "Payment processing" cost line per payment.
- The family's or team's processing fee is never revenue.
- Check what the Statement shows on the dev club.

**Part 7 · Help, demos and the lists.**
- `/docs`: Payouts, who pays the fee, a team paying online, refunds, the treasurer's view.
- The demos follow the product: nothing to do unless a tour anchor moved.
- `check:layout --changed` on the touched screens at 1440 and 390, Warm and Dark; never a whole-product sweep on dev.

## Definition of done

- Parts 1–7 committed.
- `npm run verify:changed` and `npm run typecheck` clean.
- Unit tests pass: fee arithmetic against the Facts doc, both A14 modes, the gate, the switch, the landing guard, and
  the pay route's refusals.
- **End to end in test mode** on a test Express account:
  1. connect;
  2. a team pays a deposit by test card;
  3. the webhook lands it in the team's record and the tournament's book;
  4. the team pays the balance from the reminder;
  5. a full refund, with and without the fee;
  6. club-pays mode;
  7. needs attention, then disconnect.
- **The switch is off in production**, verified by a test, not by reading config.
- `/review` on Part 1 and on the whole; findings fixed or recorded.
- **The 12a walk:** a checkable Artifact plus the next § in `OWNER_QA_LEDGER.md` (check the latest number), one purpose
  per walk. Signed in as owner, treasurer and organizer, plus a team on a phone.
- **Records:**
  - the Stage 12 plan's §0 and §4 (12a's scope now includes the tournament card flow; 12c is bank debit for both flows);
  - a news row on the Club index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`, stage `s12`; read it first and pin
    `if_version`);
  - the TODO line with the commit anchors.

## Do not

- Charge real money, create or use a live key, or switch the feature on in production. Touch Stripe only after the owner
  says so.
- Build house league (12b waits on 9b-2), bank debit (12c), partial refunds (12b), disputes or a payouts list (12d), or
  rep-team dues online (A5).
- Touch the house-league files the 9a build is changing.
- Add a "payment pending" status, a second money writer, saved cards, or any household money.
- Restate a rate anywhere. Write a legal sentence (the terms and any surcharge disclosure are counsel's).
- Reopen a ruling. If the code says a ruling can't be built as drawn, bring it to the owner drawn, before building
  around it.
- Push or promote.

## Git

- `dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit.
- If another session's work is staged, build your commit in a temporary index (memory: "Partial commit out of shared
  files").
- Part 1 in its own commit. Migrations stay on dev.
- No push and no promote without the owner's word.
