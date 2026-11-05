# GST/HST · Stage 1: know where every buyer is (build prompt)

> Written 2026-11-03. Plan of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 "Stage 1" (and §3 T1, T7, §6 touchpoints,
> §7 risks); PM brief [GST_HST_COLLECTION_PM_BRIEF.md](GST_HST_COLLECTION_PM_BRIEF.md). Sequencing: Stage 1 runs **beside** "Plans end
> at renewal" Stages 1–3 and ahead of Stage 2 (tax live). It charges no tax and changes no price; it only makes the product **know
> where every paying buyer is**. Recommended model: Opus for Part 0 and Part 2 (design-shaped); Sonnet is enough for Parts 1, 3, 4.
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you, unverified). Everything below
> that is not marked [V] is [H]: the plan was written 2026-10-31 and its line numbers are old.

## What this stage is, in one paragraph

Today no organization or coach has a country, province or address on file, and every Checkout path lets Stripe guess where the
buyer is. Stage 2 will turn tax on, and **a missing address silently becomes the wrong tax** (plan §7). Stage 1 makes a billing
location a required fact: collected before a first paid checkout on every path, saved on our own records (not only on the Stripe
customer), kept current when the buyer edits it in Stripe's portal, and flagged when a US address looks wrong. No tax is
charged here. Stage 2 reads what this stage stores.

## ▶ Progress (read first when resuming)

Nothing built. **Part 0 facts verified 2026-11-03. Asks 1–6 RULED 2026-11-03, all as recommended (owner):**
1 our own Billing details step before Stripe opens; 2 provisional US wording stored with a version label, draft *"I
confirm that [club name / I] am located in the United States and am buying this subscription for use in the United
States."*; 3 "needs review" only stores the flag + shows it to platform admin, never blocks or emails; 4 a Canada↔US change
after a subscription exists is held as needs review; 5 the US side is built in full behind one switch, OFF in production
(choosing United States says "We're not selling in the United States yet" and the paid button stays off), ON on dev for the
walk; 6 the location belongs to the BUYER: the club for a club, the person for a coach (one home address covers every portal
they pay for); a portal becoming a Club is asked for the club's address, prefilled from the coach's and editable.
Billing address step DRAWN 2026-11-03 after `/design` + `/ux`: `GST_HST_STAGE1_DRAWINGS.html`, published
https://claude.ai/artifact/UQoWJNs62uta61rmLNfUjV (8 tabs; **drawing asks 1–6 RULED 2026-11-03, all A**, logged in `memory/design_decisions.md`). Design findings applied: Plan &
billing is owner-only (10-29), so there is NO read-only view for other members (the prompt's "others see it read only" is
void); a US hold removes the button and says why in the footer (not greyed). Next: Part 1.
**Part 1 design (Ask 6 ruling):** one table `billing_locations`, the buyer = exactly one of `org_id` (a club) or `user_id`
(a coach, who buys as a person), not columns on `organizations`. A Canada↔US change after paying (Ask 4 "held") is
implemented as SAVED + `review_reason` set: Stage 2 taxes a flagged buyer as Canadian, which is the hold's tax effect in
both directions.
**Out of this stage (owner 2026-11-03):** an address search box (type, pick, fields fill in) — a TODO "research later"
item under Deferred Enhancements. Build the Billing details step as plain separate fields; a search box can sit above them
later with no rework.

Part 0 findings (2026-11-03):
- **Production paid subscriptions: 0** (live Stripe not-ended subscriptions 0; prod `organizations`/`team_workspaces` rows
  following a non-mock subscription 0; read-only probe, owner-approved). No backfill holds.
- **Paths that charge for our own plans** (scope of Parts 2 and 4): A club/tournament plan checkout
  (`app/api/billing/create-checkout/route.ts:387`, callers BillingBody, PlanMoveDialog fallback, PlanPanelDrawer, admin
  onboarding); B Premium portal → Club with no live subscription (same route, `clubName`); C coach Premium new /
  reactivate / Keep Premium (`app/api/billing/create-team-checkout/route.ts:321`, caller `app/team/TeamSignupClient.tsx`);
  D Founding next-season choice (`app/api/billing/choose-next-season/route.ts:180`); E plan move up on a live
  subscription (`lib/plan-move.ts` `subscriptions.update`, immediate prorated invoice). Not charging now: downgrade
  confirm, move down schedules, card-setup sessions, portal. **Dead:** `startOrgTeamAddonCheckout`
  (`lib/team-org-billing.ts`, no route calls it). **Stage 5 finding, not this stage:** the monthly Stripe-fee recovery
  invoice (`lib/platform-stripe-fees.ts`) can bill a club that has no paid plan, so no location.
- **[V] Buyer with no org row: C new Premium** — the shadow org is created by the webhook after payment. Changes Part 1
  (Ask 6).
- **[V] Coach Premium already reuses the buyer's Stripe customer** (`lib/team-checkout-customer.ts`, Stage 0 S10): the
  "new customer per click" item is already fixed; drop it.
- **[V] No `customer.updated` handler** anywhere: a portal address edit never reaches us today. Part 3 adds it.
- Card country: `online_payments.card_country` is registrations only; subscription cards store brand + last4 only
  (`organization_billing_facts`); the country is on the payment method Stripe already sends (`payment_method.attached`).
- **⚠ Conflict with a ruling:** BUSINESS_DECISIONS T1 follow-up — no US customer is sold any product, Premium included,
  until the US work is done. The prompt's "a US buyer ticks one box" then pays is out of step (Ask 5).

- [x] Part 0 · verify the facts, count production subscribers, present the PM summary, get the asks answered (owner) — 2026-11-03
- [x] Part 1 · the stored location — BUILT 2026-11-03, committed `fd55a1df3` 2026-11-04: mig **433** `433_every_buyer_has_a_billing_address.sql`
  (table `billing_locations`, applied to DEV only; `MANUAL_PROD_STEPS.json` entry `pending`; dictionary section added,
  `check:dictionary` OK; snapshots refreshed by the hook); `lib/billing-location.ts` (pure: lists reuse
  `lib/canadian-provinces.ts`, `checkBillingLocation` with `usSalesOpen`, PO Box rule, postal/ZIP normalizing, the words,
  `US_DECLARATION_VERSION`, Stripe address mapping, `evidenceReview`, `countryChangeReview`, `reviewSentence`);
  `tests/unit/billing-location.test.ts` 33/33. Nothing reads the table yet (no role-summary hook change needed).
  **Owner 2026-11-03: Part 1 is committed TOGETHER with Part 2.** Part 2 prompt: `GST_HST_STAGE1_PART2_BUILD_PROMPT.md`.
  Part 2 needs: a `US_SALES_OPEN` env switch (dev on, prod off/absent), the save route, the shared checkout check on paths
  A–D, the window (tab 2), the sign-up Address step (tab 4), the Start your club fields (tab 5), the plan-card line +
  button (tab 6).
- [x] Part 2 · collecting it on every paid checkout path — BUILT 2026-11-03 (prompt `GST_HST_STAGE1_PART2_BUILD_PROMPT.md`).
  **COMMITTED `fd55a1df3` 2026-11-04 (Parts 1 + 2 together, on dev, not pushed; mig 433 dev only, prod apply owed in `MANUAL_PROD_STEPS.json`).**
  Server: `lib/billing-location-server.ts` (the buyer: a club's org row, a Coaches Portal's = the signed-in owner's own user
  row; `requireBillingLocation` 409 `billing_address_required`; save stamps the US declaration + version, flags a Canada↔US
  change by a buyer who has paid, copies to the buyer's Stripe customers non-fatally), `app/api/billing/location` GET + PUT
  (club = `billing` capability, allowed for a cancelled org as the comeback path; person = `?scope=person`). `US_SALES_OPEN`
  read once on the server; set `true` in dev `.env.local` only. Paths A–E call the check before Stripe AND before their
  dev-mock branch; the comped Founding branches skip it. `ensureStripeCustomer` takes the address (create with it / update
  an existing customer). Screens: one window (`components/billing/BillingAddressDialog.tsx`, + `useBillingAddressGate`),
  shared fields (`BillingAddressFields.tsx`, native selects = the phone's own picker, `aria-required` so the browser shows
  no bubbles of its own), "Billed to … Change" in the monthly-or-yearly question, the plan card line + Billing address
  button + save pill (NoticePill), the "Club billing address" block in Start your club (prefilled from the coach's home
  address, sent with the purchase, saved to the club's row), the sign-up page's third step Address, and every other paid
  door (details panel, Reactivate, Next season, the upgrade drawer, first-time setup, the move window) opens the window on
  the server's refusal. **Found + fixed: migration 433 had no `GRANT … TO service_role`** (prod-only failure; dev held it via
  mig 025, read live) — added to 433 before any commit, nothing to re-apply on dev. Tests: new
  `tests/unit/billing-location-checkout-guard.test.ts`; the shared billing test loader stands in an "address on file" check;
  guard lists given reasons (team move STAYS, flip census, billing rail comeback path, sign-up step line per drawing tab 4).
  Verified: typecheck clean; affected tests 310/310 + 50/50; lint 0 errors on touched files; spelling/contrast/dictionary/
  snapshot checks OK; `check:layout --only=coach-billing,admin-org-billing,admin-onboarding` no new findings (the window
  opens on a click and no fixture has an address, so the sweep cannot see the new pieces — the walk must); dev route probe
  `.probe/gst-p2-probe.mjs` passed (PO Box refused, CA saved + normalized, US refused without the tick, saved with it).
  Not mine, failing in the shared tree: plan-billing-usage (date-dependent), public-tournament-stage6-walk, stripe-mode
  (`scripts/seed-plan-ending-walk.mjs`), support-console-stage3 (bookkeeping window); `verify-changed.mjs`'s lint step
  crashes on an eslint config error ("react-hooks" plugin) before linting — ran `lint:focused` on the files instead.
  Known edge: a coach REACTIVATING a comped Founding portal is asked for an address the free path never needs (the page
  cannot know; the server skips the check, so nothing is refused).
  **`/simplify` + `/review` DONE 2026-11-04** (high-risk tier, 5 lenses; no Critical/High). Applied: one call now saves the
  address sent with a purchase and then checks (`requireBillingLocation(buyer, sentAddress)`); the doubled `usSalesOpen` prop
  gone; customers looked up once and in parallel; a dead helper removed. Fixed from the review: **the save route refuses the
  demo organizer** (a visitor could have saved an address onto the public demo club; pinned in the demo write-guard list); a
  **failed address read is no longer remembered as "no address on file"** (it asked a buyer who has one to retype it); a
  **Stripe error during a Canada↔US change no longer fails the save** (flagged for review instead); NUL/lone-surrogate
  characters are dropped instead of failing the save; a slow home-address answer no longer overwrites what the coach typed for
  the club; dictionary wording on flag clearing.
  **Owner questions / follow-ups (not fixed, none blocks the commit):**
  1. UAT specs `team-direct-checkout-smoke` and `premium-to-club-path` (tests/uat) will fail until they seed or PUT an address
     (Founding window closed 10-26, so the comp branch no longer hides the check). Not in the unit suite. Fix in Part 4 or the walk.
  2. A Premium coach's REFUSED move/checkout to Club (name too long, more than one team) has already saved the club address and
     copied it to their live Premium Stripe customer. Stage 2 reads that customer address. Fix before Stage 2: stamp Stripe only
     after the move is accepted.
  3. `ON DELETE CASCADE` on both buyer links means deleting an org or user deletes the address, US declaration and review flag.
     Check against the 6-year record-keeping expectation before Stage 2 (`/accounting`).
  4. A Founding next-season choice (a real Stripe subscription, charges Oct 1) does not count as "paid" for the Canada↔US change
     flag. Does the owner mean it to?
  5. Only `stripe_edit_invalid` ever clears; a `card_country_mismatch` flag stays after the buyer corrects their country (Part 3).
  6. The PO Box rule is easy to get around ("PO Box No. 12", "Lockbox 5"), and region is not checked against postal code/ZIP
     (ON with a BC postal code saves). US territories and military codes are not offered. Intended strictness is an owner call.
  7. In dev mock billing a Founding org meets the address window the comped production path never shows; the dev-only mock
     plan toggle (`/api/billing/mock-apply`) takes no address. `startOrgTeamAddonCheckout` (dead) has no check: Part 4's guard
     should cover it.
  8. Low: the cycle choice (Yearly) is lost when the buyer uses "Change" on the Billed-to line; separate gates on one screen do
     not share a saved address; the sign-up page's Next can double-fire while the first address read is pending; Stripe stamp
     errors at checkout are a 500 where the save swallows them; the address read is fetched on mount even when never needed.
- [x] Part 3 · keeping it current (portal edits, payout-country comparison, US evidence flag). **COMMITTED `32d466e59`
  2026-11-04 on dev, not pushed (no migration).** Next: Part 4 (the guard). Prompt written 2026-11-04:
  `GST_HST_STAGE1_PART3_BUILD_PROMPT.md` (3 owner asks first; the refused-move Stripe stamp must be fixed in this part because
  reading portal edits back would turn it into a wrong home address).
  **Verify findings 2026-11-04 [V]:** `customer.updated` was on neither endpoint's event list (stripe-setup-guide Stage 3 Step 5);
  the refused "Start your club" stamp confirmed (and that customer maps to BOTH the coach and the not-yet-club until the flip);
  subscription cards stored no country anywhere; `org_payment_accounts.country` has one writer (`syncPayoutsAccount`) and every
  payout account is created Canadian (`createClubAccount`, `identity.country 'ca'`), so the payout check only ever flags a
  US-address club; `hadSubscriptionBefore` also decides trials in four other places (club checkout, team checkout, operator
  Club trial, the upgrade preview). **Re-frame accepted by the owner:** with Stripe's page editable, a refused edit there looks
  saved to the buyer, Stripe keeps an address we refused (Stage 2 taxes from Stripe's copy), and a US edit skips the tick.
  **Owner rulings 2026-11-04 (all as recommended):** (R) Stripe's billing page no longer edits the address, tax ID stays (portal
  config v2; reverses the plan's "keeps address and tax ID editable"); NO `customer.updated` handler, so no new Stripe event to
  switch on; `stripe_edit_invalid` retired (CHECK still allows it). Ask 1 evidence flags set AND clear with the evidence,
  country-change flag stays until Stage 2, one reason at a time. Ask 2 fix now: the "Start your club"
  address reaches Stripe only after the move is accepted. Ask 3 a Founding next-season choice counts as paying for the
  country-change flag ONLY (`paidOrPromisedToPay`), trials unchanged. Carried strictness items left for a later pass.
  **BUILT 2026-11-04:** portal v2 (`lib/stripe-portal-settings.ts`, the audit follows the constants); card country = newest card
  across the buyer's customers, read from Stripe's current list on `payment_method.attached`/`detached` (swap-order safe) and on
  a save whose row has none; **the evidence flags are worked out when READ (`currentReview`), never stored** (the /simplify
  altitude finding: a stored copy went stale on the two payout-disconnect paths that skip the sync; the payouts module is
  untouched) — only the country-change flag is stored; **Stage 2's tax decision must ask `currentReview`**; reverse
  customer→buyer map (coach's own portal first, then a non-portal org; ambiguous = nobody; one shared `coachOwnPortals` rule); the move route copies the club address after `applyMove`, the
  in-place checkout through the customer its session charges; platform admin's Money tab gets one read-only "Billing address"
  block (`find_stripe` power, like the tab's panels). Tests: `tests/unit/billing-location-evidence.test.ts` (behaviour +
  source guards incl. one writer of `billing_locations`); plan-reader door guard lists the file as `identity`.
  ⚠ **Stage 2 note:** a move up charges a prorated invoice INSIDE `applyMove`; once tax is on, the club-address copy must land
  after the move's checks and before its Stripe update (comment on `copyBillingLocationToStripe`).
  ⚠ Not changed (report-only): `scripts/audit-stripe-billing.mjs`'s FAIL text still says "address and tax ID are needed for
  GST/HST" — its check follows the constants, only the sentence is stale.
  **`/simplify` + `/review` DONE 2026-11-04** (high-risk tier; 4 cleanup + 4 review lenses). Applied: evidence computed at read
  (above); one `coachOwnPortals` rule for both directions AND the console (a club-paid portal shows no coach's home address);
  a first-time coach's card found through the customer's `ownerUserId` metadata (the card attaches before the portal exists);
  `recordCardCountry` writes compare-and-set and re-reads once (two card events at once); save's reads in parallel; the
  "Start your club" check no longer re-reads what it saved; uuid guard on the console read. **Owner questions / follow-ups
  (none blocks the commit):**
  1. **A removed LAST card never clears anything (pre-existing, found by review):** Stripe's `payment_method.detached` names
     no customer (it is in `previous_attributes`), and the webhook returns `no_customer` before its card arms — so the
     card-on-file clear (`clearCardOnFileIfNoCardsLeft`, the "no card yet" reminder audience) has never run either. A swap
     is fine (the attach refreshes). Fix belongs to whoever owns the card-on-file reminders; it changes who gets reminders.
  2. A country-change flag stays even when the buyer changes back (CA→US→CA) and its sentence then names the old move;
     Stage 2 taxes that buyer as Canadian until staff resolve it. As ruled; confirm when Stage 2 builds the resolve.
  3. A refused "Start your club" can still leave the CLUB row saved; a retry with the other country by a coach who has paid
     Premium flags the new club (the Premium customer's history counts). Rare; Stage 2's resolve answers it.
  4. An abandoned in-place "Start your club" CHECKOUT still stamps the club address on the coach's lapsed Premium customer
     (Checkout needs it on the customer when the session opens); the coach's next Premium checkout puts the home address back.
  5. Owner step after the deploy: open Stripe's billing page once in test and once in live mode, so v2 is created and v1
     switched off (until then v1 still offers the address; `audit-stripe-billing` warns "v2 does not exist yet").
  Verified: billing tests 327 (1 failing = Plans-end-at-renewal Part B's in-progress `workspace-move-money` reactivation
  test, theirs); typecheck clean on my files (other sessions' errors: plan-ending, email-preview, seasons routes); lint,
  spelling, dictionary, contrast, dates, observability OK; `check:layout` n/a (the club record is not in the sweep).
- [x] Part 4 · the guard (a new checkout path cannot skip the location). **COMMITTED `95dbdcbec` 2026-11-04 on dev (tests
  only, no migration).** Prompt: `GST_HST_STAGE1_PART4_BUILD_PROMPT.md` (it replaces the "Part 4 · The guard" section below).
  `tests/unit/billing-location-every-path-guard.test.ts`: a census of every charging Stripe call in `app/`, `lib/`,
  `components/` (`scripts/` left out on purpose), each `checked` or `allowed` with its reason and pinned facts, exact counts,
  stale entries fail; every `applyMove` caller pinned; the dead add-on checkout fails the day anything calls it; the matcher
  proved on fixture strings.
  **Verify findings 2026-11-04 [V]:** census unchanged since the prompt (plus `invoices.finalizeInvoice`, same fee file);
  **`applyMove` has a SECOND caller**, `rescheduleMove` in `lib/plan-ending-server.ts` (Keep {Plan} rebuilding a waiting
  move): safe, it refuses anything but a move down before the call, now pinned; `startOrgTeamAddonCheckout` has no importer,
  and the only plan naming it (archived `CLUB_REPACKAGING_PLAN.md`) says remove it after the cutover, so "the bring-in program
  may revive it" is unsupported (it is on `DEAD_CODE_REPORT.md`); `mock-apply` answers 404 whenever `isProduction()`.
  **Owner rulings 2026-11-04 (all as recommended):** Ask 1 leave the dead add-on checkout, guarded. Ask 2 allow the Connect
  family payment and the Stripe-fee recovery invoice, reasons in the guard; until Stage 5 the fee invoice is the ONE
  FieldLogicHQ charge that can go out with no address on file. Ask 3 fix the two UAT walks: each seeds a Canadian home
  address for its new coach (cascades with the user); the team-direct walk also signs in from an explicitly empty session.
  **UAT run on the dev server 2026-11-04 — neither walk passes, for reasons that are not the address (follow-up for the
  Plan & billing program, whose screens moved):** team-direct-checkout-smoke now gets through the checkout (applied, portal
  made) and fails later on "Coaches Portal ready", text no longer in the product. premium-to-club-path group C never opens
  the window: its `#billing-change`-scoped "Start my club" locator is not found although the button is on the page (group A
  fails the same way); group B fails on the lapsed fixture portal's state (no wall). So the in-place club address prefill is
  verified from code only, not by the walk.
  Verified: new guard 20/20, and a mutated copy fails as it should (unlisted call, wrong count, a loosened `rescheduleMove`);
  `billing-location*` 94/94; lint and spelling clean; typecheck not needed (tests only). `/review` skipped by the owner.
- [x] Part 5 · closeout (`/accounting` review, `/docs`, the owner walk, the open owner questions in one list, records). Prompt
  `GST_HST_STAGE1_PART5_BUILD_PROMPT.md` (it replaces the "Part 5 · Closeout" section below, whose "edit in Stripe's portal"
  walk step is void since Part 3). **COMMITTED `1ab0bfb6f` 2026-11-04 on dev; owner walk §454 written, owed.**
  **Verify findings 2026-11-04 [V]:** census 94/94, no new charging path; Parts 1–4 were not on `origin/dev`; the dev site
  (Amplify branch `dev`) runs Stripe TEST keys, no mock billing, the same Supabase project as local (mig 433 present), and its
  billing webhook receives `payment_method.attached`; **`US_SALES_OPEN` was absent on the dev site, and a console variable alone
  does not reach the runtime: `amplify.yml` copies an explicit list into `.env.production`** (a helper found this; verified);
  Stripe's usual test card 4242 is US-issued, so a Canadian walker paying with it is flagged (the walk uses 4000 0012 4000 0000
  for Canadian buyers and 4242 on purpose for the disagreeing-card step); **bug: the first-time plan screen (`?choosePlan=1`)
  never rendered the Billing address window, so a paid choice with no address dead-ended** (fixed, owner yes).
  **Owner rulings 2026-11-04:** (walk site) push dev and turn US sales on for the dev site: `US_SALES_OPEN=true` added to the
  Amplify `dev` branch variables (all 19 others kept) and an `amplify.yml` copy line (production has no value, so US stays
  closed); dev pushed `b5f42ea47`. (Ask 1) strictness → Stage 2 (province vs postal code decides the tax rate once tax is on;
  PO Box workarounds and US territories low); the small UX leftovers (Yearly reset on Change, gates not sharing an answer,
  sign-up Next double-fire, the Stripe-stamp 500, the eager address read) → one polish line in Stage 2; the removed-last-card
  gap → the Plan & billing program (card-on-file reminders own it); the three Stage 2 resolve items (flag after CA→US→CA, a
  refused club row left saved, an abandoned in-place checkout leaving the club address on the lapsed Premium customer) →
  Stage 2's resolve. (Ask 2) **fix the two Plan & billing UAT walks HERE** (reverses the prompt's recommendation). (US wording)
  change now to v2. (Privacy) a `/legal` agent shaped like `/accounting` is to be built (TODO line). (`/docs`) yes.
  **`/accounting` verdicts (topic files current, no re-research):** (1) CASCADE: OK for Stage 1; the wider point is that
  `billing_locations` is the CURRENT location (overwritten on change), never a six-year record — Stage 3 keeps a COPY of the
  evidence per charge that survives deleting the buyer, before the first zero-rated sale (plan §4 Stage 3 note,
  `RECORDS_RETENTION_AND_LOCATION.md`); no migration now. (2) fee-recovery invoice with no address: OK while nothing is
  taxed; Stage 5 is the home and asks a club for its address at payout set-up (plan §4 Stage 5 note). (3) family payment: no
  family address needed while the fee is our charge to the club (T3). (4) the provisional US wording missed "managed and
  controlled" and "not GST/HST-registered" → v2 `us-2026-11-v2` (owner yes; every wording kept in `US_DECLARATION_TEXTS`);
  the accountant still approves it before the first US sale (not a gate). (5) privacy: the window already states the purpose;
  FieldLogicHQ has no privacy policy of its own (Stage 6), not a tax matter → the `/legal` agent.
  **Built:** onboarding PlanStep renders `address.dialog`; v2 wording + test (95/95 billing-location); dictionary note;
  `amplify.yml` line; help (`org.tsx` subtopic `club-plan-and-billing-t-address`, `coaches.tsx` FAQ
  `faq-premium-billing-address`); UAT specs repaired by a helper and run on the local dev server: team-direct-checkout-smoke
  1/1 (asserts the landing Overview, Premium chip, team name), premium-to-club-path A 2/2 · B 3/3 · C 4/4 (region-scoped
  locator — `#billing-change` sits on the heading; group B follows the fixture's free-time state; **group C now checks the
  Club billing address prefill in a browser**; the fake-clock test counts real reads). Walk §454
  `GST_HST_STAGE1_WALK.html`, https://claude.ai/artifact/QgAJzYxD2WAPDDApn2eTX5 (10 parts, 34 steps; D the Founding
  choice is NOT reachable on dev until 2027-06-01; reactivate is code-proven).
  **Verified:** typecheck clean (0 errors in the tree); lint clean on touched files; spelling OK; billing-location tests 95/95.
  **Follow-ups (not fixed):** the shared UAT fixture `uat-free-team-coaches-portal` was given free time on 10-28, so group B
  now walks the free-time wall, not the plain cancelled one (clear its `free_time_given_at` + grant to restore); a stale-compile
  "setOrgNav is not a function" seen once during the UAT runs (another session's uncommitted nav work, cleared on rerun).
  ⚠ Commit note: another session committed `5b0d27fc0` five seconds before this part's first commit, which was built on the
  older base and reverted theirs; it was replaced (CAS) by `1ab0bfb6f` on top of `5b0d27fc0` before any push.
  **Part 6 · the first-time plan screen asks on its own screen (owner 2026-11-04, drawings
  `PLAN_STEP_ADDRESS_DRAWINGS.html`, https://claude.ai/artifact/VZPfo6JhC9BxDVMDpncxvY).** Raised by the owner while walking §454
  Part B: the window over the plan screen looked different from the coach sign-up's Address step, and no ruling said why.
  **Rulings (all as recommended):** (Ask 1 A) a page that runs in steps asks in a step; a screen you are working on asks in a
  window — only this one screen changes. (Ask 2 C) the step line stays Account · Organization · Plan, Plan current; the address
  screen is the second half of step 3 (the shipped three-label line already fills a 390 phone; four labels would wrap).
  (Ask 3 A) the button below the fold is accepted on both Address screens (this one and the coach sign-up's).
  **Built 2026-11-04:** `AddressStep.tsx` (the coach sign-up's fields, `variant="start"`, the window's words, Back keeps
  the draft and the monthly or yearly pick); `page.tsx` shows it, on a refused paid pick, in place of `PlanStep` when
  `?choosePlan=1`; every other page keeps the window; `PlanStep` takes `initialBilling`; guard added to
  `billing-location-checkout-guard.test.ts`. Typecheck clean; lint clean on touched files; spelling OK; 78 tests pass.
  **Owed:** walk §454 Part B steps 2–3 still describe the window (rewrite once this is on the dev site, then republish the
  walk); `/review`; `/docs` (no help article names the window on this screen: checked); commit.

## What the owner sees after this build (PM summary: present this BEFORE any code)

- **A buyer is asked once, in plain words, where they are** before their first paid checkout: country (Canada or United States),
  province or state, and a billing address. A coach buying Premium is asked for their home address and told it is only used to
  work out sales tax. The buyer can read and change it later on Plan & billing.
- **A US buyer ticks one box** confirming they are a US buyer, and that tick is saved with the date. A buyer whose card or payout
  country disagrees with their address is **flagged for review**; until someone looks, Stage 2 will treat them as Canadian.
- **Free, comped and trial workspaces are never asked** until they are about to pay; nothing changes for them today.
- **Nothing is charged differently and no price changes.** No tax line appears anywhere yet.
- **Platform admin** can read each organization's stored location (read only) on the same record they already open; no new tab.
- **Role differences:** the club owner (or the person who can change the plan) enters it; others see it read only. A coach buys
  as an individual. Staff see it, never edit it here.

## Before any code (AGENCY_RULES, blocking)

1. Present the plan and the PM summary above in plain language, **then the asks in Part 0, with a recommendation each, and wait.**
2. Disagree out loud: if a part is wrong, say so before building. Argue from what the code does, not from this prompt or the plan.
3. Re-run `ls supabase/migrations` before numbering anything (430 existed untracked on 2026-11-03; another session may have taken
   more). Apply to **dev only**; add the `MANUAL_PROD_STEPS.json` entry; update `docs/agents/db/DATA_DICTIONARY.md` and run
   `npm run refresh:snapshots` in the same unit of work.
4. Do not edit `.claude/settings*.json`, hooks, `package.json` scripts, `scripts/check-*.mjs` database checks or anything in
   `WATCHED_PATHS`. A new unit test is picked up by `npm test` on its own. If you think you need it, stop and ask.
5. Stage explicit pathspecs only; `TODO.md` and the Owner QA Ledger carry other sessions' edits (partial-commit method in memory).
6. This is money-adjacent: **run the `/accounting` review before hand-off**, as CLAUDE.md requires for anything that changes what
   FieldLogicHQ charges, collects, invoices or records. Apply what it finds or record it as an owner question.

## Part 0 · Verify, count, ask (no code)

**Verify these [H] facts, reading the code** (the plan's §6 touchpoints; line numbers will have moved):
1. The Checkout builders: `lib/billing-setup.ts`, `app/api/billing/create-checkout/route.ts`, `app/api/billing/create-team-checkout/route.ts`
   (coach Premium; the plan says it creates a new Stripe customer per click), `app/api/billing/choose-next-season/route.ts`,
   `lib/team-org-billing.ts`; plus any "Continue to checkout" on a plan change. **List every path that opens a paid Checkout or
   creates a subscription**, including the org add-on and anything added since 2026-10-31. This list is the scope of Part 2 and Part 4.
2. **Who the buyer is** for each path. [H] A coach buys through a team organization (the "shadow org" of a comped coach portal). If that
   is right, the buyer is always an `organizations` row and one set of columns serves both; if a path has a buyer with no org row,
   say so, because it changes Part 1.
3. What already exists: `org_payment_accounts.country` (mig 358, the country Stripe verified for club payouts) and a card country
   (mig 390). [H] mig 390's `card_country` sits on payment records of **registrations**, not on subscriptions; so the corroborator for
   a subscription would have to be read from the Stripe payment method. Confirm, and say which source Part 3 can really use.
4. The customer portal configuration (`lib/stripe-portal-settings.ts`) already lets the buyer edit name, email, address and tax ID
   [V 2026-11-03, line 24]. Confirm that an address edit there reaches our webhook handler (which event, which file) or does not.
5. **Production subscribers.** The plan says "no backfill: there are no subscribers", but Coaches Portal and Tournament Plus are
   on sale in production. Run a **read-only** production count of active/trialing/past-due paid subscriptions (probe in `.probe/`,
   see memory on probes and the prod Supabase safe-read method). If the count is not zero, the no-backfill assumption is false:
   **stop and report**, with a recommendation for how those buyers meet the step.

**Asks for the owner (present each with your recommendation; do not build Part 2 before they are answered):**
- **Ask 1 · Where the address is typed.** (a) Our own "Billing details" step on Plan & billing before "Continue to checkout"; or
  (b) Stripe's own address form inside Checkout, copied back to us afterwards. *Recommendation: (a).* Stage 2's previews (the plan
  move preview and the Premium→Club "Due today" window) quote **before** Stripe is opened, and the plan says that window must quote
  against the buyer's address (sequence ruling 5); with (b) the address does not exist yet at that moment, so Stage 2 would rework
  the whole flow. Cost of (a): one new small form and one extra step for a first-time buyer. If you find (b) is clearly cheaper and
  can hold up in Stage 2, argue it.
- **Ask 2 · Wording of the US tick-box.** The plan says wording is reviewed with the accountant package and **not before launch**
  (T7). Recommend building it with provisional wording, stored with a version label so it can be replaced without losing which
  words each buyer saw. Offer draft wording; ask the owner to accept or edit.
- **Ask 3 · What "needs review" does.** A US address whose card or payout country is outside the US, or the reverse, is flagged and
  (per the plan) falls back to Canadian tax in Stage 2. Recommend: Stage 1 only stores the flag and shows it read-only to platform
  admin; nothing blocks a purchase. Confirm.
- **Ask 4 · Changing country after a paid subscription exists.** Recommend: allowed in the form, but a change from one country to
  the other is held as "needs review" rather than applied silently.

The plan's own order puts a **design check** ahead of any new screen. If Ask 1 is (a), run the new "Billing details" step past
`/design` and `/ux` (a PM-level drawing in the house style: one small card, plain words, the portal's formatting rules) before
building Part 2, and say that is what you did in your summary. Do not ask the owner for a full mockup session unless they ask.

## Part 1 · The stored location (one migration, one helper)

- **Migration (dev only), number after the highest on disk.** On `organizations` (or wherever Part 0 says the buyer lives), nullable
  columns for: billing country (`CA`/`US`, upper-case ISO, CHECK), province/state code, address line 1, line 2, city, postal/zip
  code, `billing_location_confirmed_at`, `billing_location_review` (null / a short reason code), and for US buyers the
  declaration: `us_declaration_at` and `us_declaration_version`. Keep names consistent with `org_payment_accounts.country` and
  mig 390. No default values that pretend a location exists. **No backfill** (unless Part 0 item 5 says otherwise).
- `lib/billing-location.ts` (pure, no I/O): the country list (Canada, United States; T1), a province/state list per country with
  codes, a validator (country required, province/state must belong to the country, postal/zip format per country, **a PO Box
  alone is not a billing address**), and the review-reason codes. Unit tests for every branch, including all provinces/territories
  and states, and a PO Box.
- Update `DATA_DICTIONARY.md` (every new column, with its meaning and who writes it) and `npm run refresh:snapshots`; run
  `npm run check:dictionary`.
- The role-summary hook copies fields by hand (memory: `reference_role_summary_hook_copies_fields`): if anything reads these fields
  through it, add them there too.

## Part 2 · Collecting it on every paid checkout path

- One shared server check, used by every path in Part 0's list: **no paid Checkout is created unless the organization has a valid
  stored location**; when it is missing, the server refuses with a plain sentence and the screen shows the Billing details step
  instead of an error. Free, comped and trial states never see it until the buyer presses the paid button.
- The Billing details step (per Ask 1): country first, province/state picker that follows the country, address, postal code; for a
  US country the required tick-box (Ask 2) with the date saved. A buyer who already has a location sees it filled in and editable.
  Coach Premium says "your home address". Words in the product's voice, one spelling everywhere (`npm run check:spelling`).
- Pass the stored address to Stripe so its customer carries it too (the customer is created or updated with it), and make the
  coach Premium path stop creating a new Stripe customer on every click **only if** that is a safe, small change; otherwise record it
  as a finding for Stage 2 (do not widen this stage).
- Phone width and the portal formatting benchmark apply (memory: `feedback_portal_is_the_formatting_benchmark`). A tap target is not
  smaller than the house floor. Run `check:layout --changed` on the screens you touched, not a whole-product sweep.

## Part 3 · Keeping it current

- When the buyer edits their address in Stripe's portal (Part 0 item 4), the change reaches our record (webhook), validated by the
  same helper; an invalid or country-changing edit is stored as "needs review", not applied silently.
- Compare the stored country with the country Stripe verified for club payouts (`org_payment_accounts.country`) and, for a US
  buyer, with the card's issuing country read from the Stripe payment method **if Part 0 says that is available**; a disagreement
  sets `billing_location_review`. Never block, never email in this stage.
- Platform admin: show the stored location and any review reason **read only** on the organization record they already open (no
  new tab, no edit). If that needs a read in the console's reader, keep it to one small block.

## Part 4 · The guard

A unit test (house style: reads source text, like `tests/unit/promotions-record-only-guard.test.ts`) that fails the build with a
sentence naming the file when any code creates a paid Checkout session or subscription without going through the shared location
check from Part 2, and when a new `stripe.checkout.sessions.create` appears outside the known list. This is what keeps Stage 2's
"every Checkout path" promise true after the next person adds a plan or a button.

## Part 5 · Closeout

1. `npm run verify:changed`; `npm run typecheck` (shared modules and a migration are touched). Report any skipped check and why.
2. `/accounting` review (blocking, see "Before any code" 6).
3. Offer `/simplify` (a new shared helper was added) and then `/review`, once each.
4. Offer `/docs`: the Plan & billing help article gains "where we ask for your address and why". Product words only.
5. Owner walk: write one checkable walk (one purpose: *a first-time buyer is asked where they are before paying, once, in every
   path, and the answer is remembered*), publish it as the house Artifact, and add its §number to the Owner QA Ledger. Cover each
   path in Part 0's list, Canada and US, a PO Box refusal, an edit in Stripe's portal, and a disagreeing US card.
6. Records: the plan's Stage 1 line and status header, the PM brief's status, the TODO line (one line), this Progress block,
   `MANUAL_PROD_STEPS.json` (migration, dev only), `BUSINESS_DECISIONS` only if an ask changed a ruling (it should not).
7. Do not push. Ask before committing. The migration is **dev only**; production waits for the promote's database order.

## Out of scope (do not build, do not "just add")

Stripe Tax registration, "plus applicable taxes" copy, tax on any preview or invoice, tax IDs, the tax reason record, the books,
the payment fee, Terms of Service, Québec or US payments. Those are Stages 2–8. If something here seems to need one of them,
stop and say which.
