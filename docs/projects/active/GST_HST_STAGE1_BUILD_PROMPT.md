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
- [ ] Part 3 · keeping it current (portal edits, payout-country comparison, US evidence flag)
- [ ] Part 4 · the guard (a new checkout path cannot skip the location)
- [ ] Part 5 · closeout (`/accounting` review, `/simplify` and `/review` offered, `/docs`, dictionary + snapshots, walk, records)

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
