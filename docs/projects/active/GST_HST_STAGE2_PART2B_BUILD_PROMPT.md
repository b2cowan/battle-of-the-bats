# GST/HST · Stage 2 Part 2b: a club gives its billing address when it turns on online payments (build prompt)

> **▶ BUILT 2026-11-05, committed `947fd8192` 2026-11-05 after /review high.** Part 0 counted 0 payout accounts on
> production and 1 on dev (connected, no address). Found and owner-ruled: Plan & billing shows its Billing address button
> only once an address exists, so `NO_ADDRESS` names ONLY the Payouts card (not "Plan & billing or…" as Part 3 below said).
> Demo seeds create no payout accounts (Part 3's demo item moot). Owner walk §463 PASSED 2026-11-05 (A–F, all steps).

> Written 2026-11-05. Parent: [GST_HST_STAGE2_BUILD_PROMPT.md](GST_HST_STAGE2_BUILD_PROMPT.md) (read its ▶ Progress block first:
> Part 2's "Ask 8" bullet and the "Part 2b (to build, Ask 8)" paragraph are this part's whole reason). Plan of record:
> [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 Stage 5 ("asks the club for its billing address when it sets up
> payouts"), brought forward. Recommended model: Opus for Part 0 (one owner ask, a re-frame check); Sonnet is enough for Parts 1–3.
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you). Everything below is [H]
> unless marked **[V 2026-11-05]** (read in the code the day this was written; line numbers drift).

## Why this exists, in one paragraph

Part 2 (committed `0e5aef0d1`) taxes the Stripe fees a club owes us (returned debits, disputes, foreign-card extra) on the club's
own monthly fee invoice. Stripe refuses to finalize a taxed invoice for a customer with no address. A comped, free-time or
Founding club can turn on online payments without ever having been asked for a billing address (Stage 1 asks only on a paid step),
so its first fee invoice would fail. Part 2 built the SAFETY NET: such a club's fees wait, unbilled, with an operator sentence in
platform admin, and nothing is billed untaxed. **Owner ruling Ask 8 (2026-11-05, as recommended):** ask for the billing address
when the club turns on online payments, in the same Billing address window the rest of the product uses, so no club reaches its
first fee invoice without one. The wait stays as the net. **Not** the payout account's business address (a source the club never
gave us for billing).

## Facts handed to you (verify before building on any)

- **The door [V 2026-11-05].** `components/admin/kit/club/PayoutsCard.tsx`: the primary button (`primary()`, ~:159) opens the
  "Before you set up payouts" window (`BeforeWindow`, ~:377) when the state is `not_set_up` or `disconnected`; its confirm runs
  `go()` (~:385), which posts `{ action: 'connect', feePayer, agreeToTerms: true }` (~:389) and goes to Stripe's onboarding link.
  The card is mounted on the club's settings (`SettingsKit.tsx` ~:309, home `club`) AND on the tournament side
  (`app/[orgSlug]/admin/tournaments/settings/payouts/page.tsx` ~:34, home `tournament`): a Tournament Plus organization reaches it too.
- **The route [V 2026-11-05].** `app/api/admin/payouts/route.ts` POST: `context()` (signed in, launch switch
  `onlinePaymentsOn()`, `canSeePayouts`, plan `hasPlanFeature(planId, 'online_payments')`, ~:35-51), owner only (~:176),
  `case 'connect'` (~:186): refused without the plan, 400 without `agreeToTerms`, then creates the Stripe account or reopens a
  disconnected one, audits, returns `onboardingLink`. `case 'continue'` (~:237) re-issues the link for an existing row.
  `app/api/admin/payouts/return/route.ts` re-issues it on Stripe's refresh path.
- **No billing-address check anywhere in this flow today [H, helper census 2026-11-05]**: `requireBillingLocation`,
  `useBillingAddressGate`, `BillingAddressDialog`, `isAddressRefusal` appear in none of the payouts route, the return route,
  `PayoutsCard.tsx` or `lib/stripe-connect.ts`.
- **Who reaches it [H]:** `online_payments` is Tournament Plus and up (`lib/plan-features.ts` ~:141, by `PLAN_RANK`); the free
  Tournament plan and the Premium Coaches Portal (`team`) cannot. The gate reads the stored `organizations.plan_id`, so a comped or
  Founding club on a paid tier CAN connect (inferred, verify): **those are the clubs this part exists for.**
- **Already connected [H]:** `org_payment_accounts` (keyed by `org_id`; `stripe_account_id`, `disconnected_at`,
  `card_payments_status`, `onboarding_finished_at`, `requirements_due`), read by `readAccount` in the route; state from
  `payoutsState` / `factsFromRow` (`lib/online-payment-account.ts`).
- **The net [V 2026-11-05].** `lib/platform-stripe-fees.ts` `invoiceOneClub` (~:421): no club row in `billing_locations` and no
  address on the Stripe customer → the fee rows get `bill_error: NO_ADDRESS` and the invoice is not made. `NO_ADDRESS` (~:487) is
  operator words naming **only Plan & billing** as where the club adds it ("…after it adds one on Plan & billing.").
- **The pieces to reuse, not rebuild:** the buyer is the ORGANIZATION (`{ kind: 'org', … }`, `lib/billing-location-server.ts`);
  `requireBillingLocation(buyer)` answers `billing_address_required` (409) or `billing_review_hold` (409, a flagged US address,
  Stage 2 Ask 1) through `decideBuyerTax`; the client gate `useBillingAddressGate` (`components/billing/BillingAddressDialog.tsx`):
  `ensure(next)` before a paid button, `refused(retry)` on the 409. The window and its words are shipped (Stage 1).

## Before any code (AGENCY_RULES, blocking)

1. Present the plan and the PM summary below in plain language and wait for a go-ahead (the one ask is already ruled: A).
2. Disagree out loud: argue from what the code does. In particular, say so if you find the payouts flow already collects an address
   somewhere this census missed, or that a club can take payments without passing `connect`.
3. No migration is expected. If you find you need one: `ls supabase/migrations` first, dev only, `MANUAL_PROD_STEPS.json`, the
   data dictionary, `npm run refresh:snapshots`.
4. Do not edit `.claude/settings*.json`, hooks, `package.json` scripts or anything in `WATCHED_PATHS`.
5. Stage explicit pathspecs only. Another session may have uncommitted Part 3 edits in `components/billing/*`, `lib/billing-tax.ts`,
   `lib/plan-billing-words.ts`, `lib/plan-move*.ts`: read fresh, do not commit them with yours (partial-commit method in memory).
6. This changes where we collect a person's details and what we invoice: run **`/legal`** (a new point of collection for an
   address the club already gives us; does the privacy policy's wording cover it?) and **`/accounting`** (the fee invoice can now
   always be made) before hand-off. Neither gates the build.
7. `npm run typecheck` needs `NODE_OPTIONS=--max-old-space-size=8192` (the default heap ran out on 2026-11-05).

## What the owner sees after this build (PM summary: present BEFORE any code)

- A club owner turning on online payments presses **Set up payouts**, reads the "Before you set up payouts" window as today, and
  presses its button. **If the club has no billing address on file, the Billing address window opens first** (the same one Plan &
  billing uses, filled in nothing, asking for the club's address); saving it carries straight on to Stripe's onboarding. A club
  that already has an address sees no change.
- The same on the tournament side's payouts page, and on **reconnecting** a disconnected account.
- A club that is ALREADY connected without an address sees one quiet line on its Payouts card with a Billing address button until it is saved (ruling A).
- Platform admin's waiting-fee sentence names both places a club can add its address.
- Role differences: none new. Only the owner can connect payouts (today's rule); staff never see the window.

## Part 0 · Verify, count, ask (no code)

- Verify every [H] fact above. Confirm that `connect` is the ONLY way a club reaches taking payments (no seed, operator or
  platform-admin path that creates an `org_payment_accounts` row without it, other than the demo seed: note what it does).
- **Count, read-only:** on dev and on production (the prod safe-read method in memory; a probe in `.probe/`), how many
  organizations have an `org_payment_accounts` row that is not disconnected AND no `billing_locations` row. Report the number with
  the plan and comp state of each (no names in the repo).
- **⚖ RULED 2026-11-05 (owner, in the session that wrote this prompt): A.** The build session does not ask it again; it still runs
  the count and reports it. *(The ask as written, kept for its reasons:)* *what does a club that is already connected without an
  address see?*
  - **A (recommended):** one quiet line on its Payouts card, "Add your club's billing address so your monthly fee invoice can go
    out." with a **Billing address** button (the shipped window), shown only while the address is missing. The fees keep waiting
    (the net) until it is saved; nothing is emailed. Why: it reaches exactly the clubs the net is holding, where the owner already
    looks at payouts, at no cost to anyone else.
  - **B:** nothing on screen; the operator sees the waiting fees in platform admin and follows up by hand. Cheaper, but the club
    never learns why no fee invoice arrives, and the money owed to us grows.
  - **C:** ask at their next `continue` (resuming onboarding) too, and block it until given. Rejected unless the owner wants it:
    blocking a club mid-onboarding over our fee invoice punishes a club that is already taking families' payments.
  Bring the count above with the ask: if it is 0 on production, say so (A then costs one line and serves only future edge cases).
- No drawing session unless A is chosen and the owner asks: the window is shipped; A's line follows the Payouts card's existing
  notice recipe. If you add the line, read the card's shipped strings and draw nothing new.

## Part 1 · The ask before connect

- Server: `case 'connect'` (and the reconnect of a disconnected account, which is the same case) calls
  `requireBillingLocation({ kind: 'org', orgId, name, stripeCustomerId })` **before** any Stripe call, and returns its 409 as is
  (`billing_address_required`, or `billing_review_hold` for a flagged US address). Nothing is created in Stripe on a refusal.
  `continue` and the return route are NOT gated (Part 0's ask decides anything more).
- Client: `PayoutsCard`'s `BeforeWindow` confirm goes through `useBillingAddressGate({ orgSlug })` → `ensure(go)`, and on the
  server's `billing_address_required` → `refused(() => go())` (the house pattern: the window opens instead of an error). A held
  account shows the server's sentence with no retry. The gate's window replaces the Before window while open (as `PlanMoveDialog`
  does), and saving returns into the connect, not back to the card.
- ⚠ The fee payer choice and the terms tick made in the Before window must survive the address window (do not reset them).

## Part 2 · The already-connected club (only as Part 0 rules)

If A: the Payouts card reads whether the club has an address (the GET route can answer `addressOnFile: boolean` from
`readBillingLocation`; owner only) and shows the line + button while it is missing. Saving clears it. If B: nothing here.

## Part 3 · Words, the net's sentence, the guard

- `NO_ADDRESS` (`lib/platform-stripe-fees.ts`): name both places ("…after it adds one on Plan & billing or on its Payouts card.").
  Operator words; one spelling (`npm run check:spelling`).
- Extend the every-path guard (`tests/unit/billing-location-every-path-guard.test.ts`) so the payouts `connect` must call
  `requireBillingLocation`, and the card must open the window on the refusal. Mutate-and-fail it.
- Unit tests: refused connect creates no Stripe account (stub it); a club with an address connects unchanged; a disconnected club
  reconnecting is asked; the client keeps the fee payer choice across the window (the real-window harness in
  `tests/unit/plan-billing-actions.test.ts` is the house way to drive a component).
- The demo seed: if the coach or tournament demo seeds a connected club with no billing address, give it one (a demo must not show
  A's line by accident), or say why not.

## Part 4 · Closeout

1. `npm run verify:changed`; `npm run typecheck` (with the heap setting). Report any skipped check.
2. `/legal` and `/accounting` (see "Before any code" 6); apply or record as owner questions.
3. Offer `/review` (payments onboarding: high-risk tier). `/simplify` only if a new abstraction appeared.
4. Offer `/docs`: the payouts set-up guide gains "you'll be asked for your club's billing address first". Product words only.
5. Owner walk: one purpose (*a club turning on online payments gives its billing address first, and its fee invoice can always be
   made*), the house checkable Artifact, a §number in the Owner QA Ledger: a club with no address (asked, then on to Stripe), a club
   with one (not asked), a reconnect, the tournament-side page, and (if A) an already-connected club seeing the line and clearing it.
6. Records: the parent prompt's Progress block (Part 2b done, hash), the plan's Stage 5 line ("address step done in Stage 2 Part
   2b"), the TODO line (one line), memory. Do not push. Ask before committing.

## Out of scope (do not build)

Copying the payout account's address (ruled out by Ask 8), the online-payment fee and its monthly statement (Stage 5), the
per-charge tax-reason record (Stage 3), US payments (Stage 8), and anything in Part 3 / Part 4 of the parent prompt.
