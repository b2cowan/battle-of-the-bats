# GST/HST · Stage 1 · Part 2: ask for the address on every paid checkout (build prompt)

> Written 2026-11-03 at the end of the session that did Part 0 and Part 1. Parent prompt (read its ▶ Progress block FIRST,
> it holds every ruling): [GST_HST_STAGE1_BUILD_PROMPT.md](GST_HST_STAGE1_BUILD_PROMPT.md). Approved drawing (owner, all six
> drawing asks A, 2026-11-03): https://claude.ai/artifact/UQoWJNs62uta61rmLNfUjV, source
> [GST_HST_STAGE1_DRAWINGS.html](GST_HST_STAGE1_DRAWINGS.html). **Build to the drawing.** Recommended model: Opus.
> Mark facts [V] (verified by you, file:line) or [H] (handed over). Every file:line below is [H] from helper reads on
> 2026-11-03; open the lines before relying on them.

## Already true when you start

- **Part 1 is built, UNCOMMITTED, and is committed together with this part** (owner, 2026-11-03: "commit both together when
  part 2 is done"). Part 1 files: `supabase/migrations/433_every_buyer_has_a_billing_address.sql` (applied to DEV only),
  `lib/billing-location.ts`, `tests/unit/billing-location.test.ts`, the `billing_locations` section of
  `docs/agents/db/DATA_DICTIONARY.md`, the `433_…` entry in `supabase/migrations/MANUAL_PROD_STEPS.json`, the refreshed
  snapshot files under `docs/agents/db/schema-snapshots/`, the 2026-11-03 billing-address entry at the top of
  `memory/design_decisions.md`, the TODO line "Address search box … research later", and the two build prompts + the
  drawings file. ⚠ Several of those files also carry OTHER sessions' uncommitted hunks (TODO.md, DATA_DICTIONARY.md,
  MANUAL_PROD_STEPS.json, the snapshots, design_decisions.md): commit only your hunks (partial-commit method in memory,
  `reference_partial_commit_shared_tree`).
- `billing_locations`: one row per buyer, exactly one of `org_id` (a club) or `user_id` (a coach buying as a person).
  Read the dictionary section's three gotchas.
- `lib/billing-location.ts` is the ONLY place that decides what a valid address is. Use `checkBillingLocation(input,
  { usSalesOpen })`, `BILLING_LOCATION_WORDS`, `BILLING_COUNTRIES` (labels per country), `usDeclarationText`,
  `US_DECLARATION_VERSION`, `toStripeAddress`, `formatBilledTo`, `formatBillingAddress`, `countryChangeReview`. Do not
  restate a rule or a message anywhere else.
- Production has 0 live subscriptions (read 2026-11-03), so no existing buyer needs a migration path.

## What the owner sees after this part (from the drawing; re-read its tabs 1–6)

1. **Club / tournament, first paid purchase:** pressing a paid button opens the **Billing address** window (form, 520) BEFORE
   the monthly-or-yearly question. Continue saves, then the question opens. With an address on file the window is skipped
   and the question shows one "Billed to {formatBilledTo} · Change" line above the two choices (Change swaps to the window,
   filled in; Save brings the question back).
2. **Founding next-season choice:** the same window first when no address is on file.
3. **Coach Premium (new, restart, keep):** the sign-up page gets a third step **Address** after Team (Team's button becomes
   Next; steps row ACCOUNT — TEAM — ADDRESS; sign-up page fields, not window fields; hint "You buy Premium as yourself, so we
   ask for your home address. We use it only to work out sales tax, and it prints on your receipts."). With an address on
   file, no step: a "Billed to … Change" line above Continue to checkout; Change opens the fields in place.
4. **Premium portal → Club ("Start your club" window):** a "Club billing address" block under Club name, filled in from the
   coach's home address, hint "We filled in your home address. Change it if the club has its own." Saved to the CLUB's
   own org row; the coach's own row is never changed by it.
5. **Plan & billing plan card (owner-only page):** after an address exists, one hint line "Billing address: {formatBillingAddress}"
   and a white `btn-outline` **Billing address** beside "Payment method & invoices"; it opens the window with Save. A saved
   change shows the save pill. Same on a coach's own Plan & billing (window titled "Your home address").
6. **US while US sales are closed:** choosing United States removes the other fields; the window foot shows the amber
   sentence `BILLING_LOCATION_WORDS.usClosed` at the LEFT with only Cancel (the main button is ABSENT, not greyed). On the
   sign-up page (no foot) the same sentence is one amber line under Country and Continue to checkout is absent.
   **US open (dev only):** "State", "ZIP code", and the required tick-box with `usDeclarationText` (club name or person).
7. **States (drawing tab 2 and 4 cards):** errors on press, one red line under each field; "Saving…" and no double press;
   a failed save = one red sentence in the foot (sign-up page: above the button), "We couldn't save your address. Try
   again.", nothing lost; closing with something typed asks Keep writing / Discard (the shipped form-window behaviour);
   changing country keeps street/unit/city, resets the region, re-checks the postal code; sign-up Back keeps everything.
8. **Free, comped, trial:** nothing until a paid button is pressed.

## Build

**A · The US switch.** One server reading of an env flag, e.g. `US_SALES_OPEN === 'true'` (absent = closed). Set it in
`.env.local` for dev; do NOT touch Amplify/production env (absent there = closed, as ruled). The client learns it from the
GET below, never from its own env.

**B · Server module + route.** A server-only module (e.g. `lib/billing-location-server.ts`) that: reads the buyer's row
(org or user); saves through `checkBillingLocation` (US declaration stamped with `US_DECLARATION_VERSION` and now; a
Canada↔US change when the buyer already paid sets `review_reason` via `countryChangeReview`, saved and flagged, see the
parent Progress block); copies the address to the buyer's Stripe customer when one exists (`toStripeAddress`); and
exposes ONE check, e.g. `requireBillingLocation(buyer)`, that every paid path calls and that refuses with a stable code
(e.g. 409 `billing_address_required`) when there is no valid row. A route (e.g. `/api/billing/location`, GET + PUT):
for a club, the same permission as create-checkout (owner / `billing` capability) [H]; for a coach, the signed-in user's
own row only. GET returns the row (or null), `usSalesOpen`, and for a coach whether the address is theirs.

**C · The paths (Part 0's list, parent Progress block).** Call the check before any Stripe call on:
A `app/api/billing/create-checkout/route.ts` (~:387; buyer = the org) · B the same route with `clubName` (in-place
Premium → Club: the window sends the club's address with the name; save it to the club's org row, then check) · C
`app/api/billing/create-team-checkout/route.ts` (~:321; buyer = the USER, `user.id`; the new-customer create ~:307 gets the
address) · D `app/api/billing/choose-next-season/route.ts` (~:180; buyer = the org) · E the plan move up
(`app/api/billing/move/route.ts` → `lib/plan-move.ts` ~:369): every subscription after this stage has an address, so E
only needs the check as a safety net; the screen reacts to the refusal by opening the window. Customers: `ensureStripeCustomer`
(`lib/billing-setup.ts` ~:42-93) creates with the address and updates an existing customer's address on save. Not in
scope: card-setup sessions, the portal, downgrades, the dead `startOrgTeamAddonCheckout` (Part 4 deletes it or lists it).

**D · The screens.** One shared **Billing address** window component on the shipped `KitDialog` (`components/shared/KitDialog.tsx`,
`kind="form"`, footer sentence via its foot-start slot, Cancel then the lime main button), window fields as the shipped
form windows draw them (36 px on a computer, 44 at ≤768; required = plain `*` in the label's ink; no "(optional)"). For the
province/state list use the same select the shipped form windows use, and confirm a phone opens the device's own picker
(drawing Ask 5); if the shipped select is the custom field menu, use a native `<select>` styled as the field instead and
say so. Callers [H]: `components/billing/BillingBody.tsx` (`checkout()` ~:534, Next season ~:572), `components/billing/PlanCycleDialog.tsx`
(gains the "Billed to … Change" line), `components/billing/PlanMoveDialog.tsx` (~:171 fallback, and the in-place
"Start your club" form), `components/billing/PlanPanelDrawer.tsx` via `lib/plan-upgrade.ts` ~:54-72,
`app/[orgSlug]/admin/onboarding/page.tsx` ~:555, `app/team/TeamSignupClient.tsx` (the Address step; styles
`components/auth/AccountForm.module.css`). **Find every caller of the four routes yourself** (grep the route paths) and make
each one open the window on the refusal code instead of showing an error: the order is window → question → Stripe. Words
come from `lib/billing-location.ts` and, for labels/buttons, the existing words files (`lib/plan-billing-words.ts`); one
spelling everywhere.

**E · Tests.** Behaviour tests for anything pure you add; source guards (house style: `tests/unit/_source-code.ts`) that
each of paths A–E calls the shared check before its Stripe call. (Part 4 later adds the build-wide guard on new
`checkout.sessions.create` calls; do not build Part 4 here.)

## Rules (from AGENCY_RULES and memory; blocking)

- Present a short plan (task list) before code; the PM summary is the drawing, already approved. Disagree out loud if the
  code says the drawing can't be built as drawn, and stop on that point rather than redesign it.
- Do not edit `.claude/settings*.json`, hooks, `package.json` scripts, `scripts/check-*.mjs` or anything in `WATCHED_PATHS`.
- No new migration is expected. If you need one, re-run `ls supabase/migrations` first (numbers are being taken fast).
- Verify: `node --import ./tests/ts-resolver.mjs --test tests/unit/billing-location.test.ts` plus your new tests,
  `npm run verify:changed`, `npm run typecheck` (shared modules + routes), `npm run check:spelling`,
  `npm run check:layout -- --changed` on the screens you touched (NOT a whole-product sweep). Report anything skipped.
- New files and a shared-module change ⇒ restart the dev server before the owner tests (`npm run dev`, network allowed;
  stop it before deleting `.next`).
- Offer `/simplify` (new shared component + server module) and then `/review`, once each, BEFORE committing.
- **Commit:** on `dev` (re-check the branch), Part 1 + Part 2 in one commit (or two adjacent commits, Part 1 first),
  explicit pathspecs only, only your hunks in shared files; `git show --stat HEAD` after. Do not push. Record the hash in the
  parent prompt's Progress block and the TODO line ("committed `<hash>` <date>", never "uncommitted").
- Stage 1's closeout (Part 5) still owes: Part 3 (Stripe-page edits + card country + the platform-admin block), Part 4
  (the guard), `/accounting` review, `/docs`, the owner walk. Leave a Progress entry naming exactly where you stopped.

## Out of scope

Tax of any kind, "plus applicable taxes", tax IDs, the platform-admin Money tab block and the webhook (Part 3), the guard
(Part 4), help articles (Part 5), an address search box (TODO, research later), Stripe-side settings.
