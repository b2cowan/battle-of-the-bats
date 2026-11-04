# Plans & pricing · Stage 1: guards and housekeeping (build prompt)

> Written 2026-11-03. Plan of record: [STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md](STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md) ("Stage list of record", item 1).
> Stage 0 is built, walked (§446) and waits only on its release; Stage 1 "waits on Stage 0" in the sense of ordering, and
> touches none of Stage 0's files except to read them. **Owner ruled "Stage 0 and the checklist first" (2026-10-31).**
> Recommended model: Sonnet is enough for Parts 2–4; Part 1 is a conversation, not code.
> Mark each fact you rely on [V] (verified by you in this session, with file:line) or [H] (handed to you, unverified). The
> research below was handed over by a helper and re-checked only where marked [V].

## What this stage is, in one paragraph

Stage 0 made the money plumbing safe. Stage 1 makes the **catalogue hard to get wrong**: when a plan is added or a price
changes, the build fails loudly instead of the site quietly disagreeing with itself. It adds no screen the owner will use.
Three pieces from the plan of record: (A) a new-plan checklist and a price-agreement check the build enforces, (B) the
"promotions are recorded but do nothing" gap, (C) the stale Stripe setup guide.

## ▶ Progress (read first when resuming)

All five parts built 2026-11-03 in one session; the commit hash goes here when the owner says commit.

- [x] Part 1 · promotions ruling (owner) — **ruled A, record-only, 2026-11-03.** Built: the section line, a hint under Status
  ("Active gives no one a discount; checkout never reads promotions.") and under Coupon code, "Not applied at checkout" under an
  Active or Scheduled row; the help article's sentence extended; `tests/unit/promotions-record-only-guard.test.ts` (no file but the
  screen and its route reads the table; nothing hands Stripe a coupon, promotion code or `discounts:`).
- [x] Part 2 · new-plan checklist — `tests/unit/new-plan-checklist.test.ts` reads 23 lists' source text (18 must hold every plan,
  5 partial with a reason per exclusion); a built-in case proves a missing plan fails as "Plan club_mega is incomplete: not in
  PLAN_ORDER in lib/plan-config-db.ts." Human half: `PLAN_PRICING_FACTS.md` "Adding a plan: the checklist". **Found and fixed:**
  the account switcher's plan labels (`lib/user-contexts.ts`) had no `club_large`, so a Club · Association workspace printed
  "CLUB_LARGE". **Left unregistered, each an owner question:** early-access `PLAN_OPTIONS` (league, club only), `PANEL_PLANS`
  (no club_large), `GATED_STRIP_LINES`, `PLAN_ARTICLE_CONTENT`, the dev-tool pickers.
- [x] Part 3 · price agreement — `tests/unit/plan-pricing-facts-agreement.test.ts`. **No drift:** all six plans' names and prices
  match. The free League floor row is listed as not a plan (a `free_floor` setting). H8: Phases 1–2 (the price-slot check) were
  already built; Phase 3 (in-app Upgrade guard) is not, and `isPlanCheckoutPriceConfigured` has no caller (reported, not built).
- [x] Part 4 · the Stripe setup guide — subscription half and the tail rewritten against the code; the Connect half (every
  heading other docs cite) kept word for word. Corrections to this prompt: **no restricted-key permission list exists** anywhere
  (the guide now says production keeps the full key, ruling T23); the 2026-10-29 "cancel off in the portal" line was superseded by
  the code-owned portal (cancel at period end). **Found, not fixed (runs against production; owner's to authorize):**
  `scripts/audit-stripe-billing.mjs` still expects Club at 17900/179000 and has no club_large slot; the guide warns about it.
- [x] Part 5 · closeout — the three new tests plus `lib/plan-config.test.ts` 14/14 (13 when first written; the simplify pass added a case for a comment inside a plan list) and typecheck clean. `npm test` has 7 failures, all in other sessions' committed files
  (an admin phone window, the free-time billing route, the Stage 6 walk page, a walk seed script's key prefix, a bookkeeping
  window); ESLint could not start (its react-hooks plugin is missing from the install); the admin lettering and old-look checks
  flag other sessions' CSS. None touches this stage's files.

## What the owner sees after this build (PM summary: present this BEFORE any code)

- **Nothing changes on any customer or staff screen** unless Part 1 is ruled otherwise.
- **For the owner as the person who adds plans and changes prices:** if a plan is added with a step missed, or the Facts doc
  and the site disagree about a price or a plan name, the check fails with a sentence naming the plan and the missing step,
  before anything ships. Today nothing catches this, and several of the lists a new plan must join are not type-checked.
- **For the owner as the person who sets up Stripe:** a setup guide that describes the product as it is, so the reconciliation
  and the first live purchase have a trustworthy script to follow.
- **Role differences:** none. Platform-admin only, no customer-facing copy.

## Before any code (AGENCY_RULES, blocking)

1. Present the plan and the PM summary above in plain language and wait for the owner's go on Part 1's answer.
2. Disagree out loud: say so before building if you think a part is wrong. Argue from what the code does.
3. Re-run `ls supabase/migrations` before numbering anything. **This stage should need no migration;** if you think it does, stop and say why.
4. Do not edit `.claude/settings*.json`, hooks, `package.json` scripts, `scripts/check-*.mjs` database checks or anything in
   `WATCHED_PATHS` (`scripts/check-agent-automation.mjs`). **A new unit test is picked up by `npm test` (and so by
   `verify:changed`) on its own, so none of that is needed.** If you find you need it, stop and ask.
5. Stage explicit pathspecs only; `TODO.md` and the Owner QA Ledger carry other sessions' edits (partial-commit method in memory).

## Part 1 · Promotions: record vs enforce (RULING FIRST, then maybe a small build)

**Facts [V by the main session 2026-11-03]:** a promotion is a row in `platform_catalog_campaigns` (title, type, status, target
plans, dates, coupon code, discount summary, trial days, notes), written by `app/api/platform-admin/product-catalog/campaigns/route.ts`
and read only by `app/platform-admin/plans-pricing/page.tsx`. **No checkout path reads it:** a search of `app/api/billing`,
`lib/billing-setup.ts` and `lib/team-org-billing.ts` for discounts, coupons and promotion codes finds nothing. The screen already
labels the list "For the record · not linked to checkout or Stripe". [H] Two checkout builders exist (`create-checkout`,
`create-team-checkout`), plus next-season and paid-to-paid paths. [H] Founding Season, operator free time and the Club 90-day
trial are NOT promotions and must not be touched.

**The gap:** a staff member can set a promotion to *active* and believe customers get a discount. They do not.

**Ask the owner (one question, three options). Recommend A.**
- **A · Keep promotions record-only, and make the screen impossible to misread.** Smallest. The staff review (first pass, /strategy Q7)
  already recommended this "until a concrete offer, eligibility and stacking rule is approved". No offer exists, no customers
  exist, and enforcement needs a stacking rule against free time, Founding comps and trials that nobody has ruled. Build:
  tighten the wording on the status control (an "active" promotion says it is not applied at checkout), and a test that fails
  if a checkout path ever starts reading the table without this decision being revisited.
- **B · Retire the fields that pretend** (coupon code, trial days, discount summary), keep title/notes/dates as a diary.
- **C · Build real enforcement** (create or look up a Stripe coupon, pass it at both checkout builders, honour dates and plans,
  record redemptions). Needs `/strategy` first for the stacking rule and `/accounting` after. Not recommended now; if chosen,
  stop and write it up as its own stage rather than building it here.

Do not start Part 2–4 work that depends on this; they are independent of it, so proceed with them while the owner decides.

## Part 2 · The new-plan checklist, enforced by the build

**Why:** adding a plan means touching many places, and several are plain string lists that TypeScript does not check, so a
missed one fails silently at runtime. [H, from the helper's census of the `club_large` footprint; re-verify each by opening it]:
`lib/types.ts` (the plan union) · `lib/plan-config.ts` (config, a typed record, so already enforced) · `lib/plan-features.ts`
(rank and grants) · `lib/plan-module-entitlements.ts` and `lib/plan-config-db.ts` (a plan order list each) ·
`lib/plan-gating-server.ts` (an all-plans list) · `lib/plan-billing-profile.ts` · `lib/plan-move-options.ts` · the pricing
page lists (`components/PricingSection.tsx`, `app/pricing/ViewerAwarePlans.tsx`) · the onboarding gating map · other plan-keyed
lists (early access, retention, free time, plan ending, metrics, workspace upgrade, campaigns route, bulk operations).

**Build:** one unit test, `tests/unit/new-plan-checklist.test.ts` (offline only: no database, no Stripe). For every plan in the
union, assert it is present in each list above or is on a short, commented **deliberate-exclusions** list (the existing
pattern is `lib/plan-config.test.ts`: `team` and `club_large` are deliberately not on the pricing cards). Export the lists
only where needed, as small named constants, rather than duplicating them in the test. **The failure message names the plan and
the missing place** ("Plan club_large is incomplete: not in PLAN_ORDER in lib/plan-config-db.ts"); the staff review §E6
suggests the wording.

**What a test cannot check offline** (database CHECK constraints on plan columns, the Stripe price slots for the new plan in
each environment, the Facts doc rows, copy, help articles, demo): write these as a short human checklist at the end of
`docs/agents/strategy/PLAN_PRICING_FACTS.md`'s drift-check section or next to it, and have the test's failure message point
there. Read the staff review's §E6 table (`STAGE10_PLANS_PRICING_STAFF_REVIEW_FIRST_PASS.md`, around lines 565–583) first; it
already sorts the ten items into verifiable and not.

**Prove it fails:** temporarily remove a plan from one list and show the test fails with the right sentence, then put it back.

## Part 3 · Price agreement: the Facts doc against the plan config

**Why:** `docs/agents/strategy/PLAN_PRICING_FACTS.md` is the canonical record of plan names and prices, and **nothing checks
that `lib/plan-config.ts` matches it** [V: the only tests that read the Facts doc check the online-payment fee rates]. The plan
of record's open question 6 asks whether to fold the older "H8 price guard" in; **fold it in** (the plan says Stage 1 "absorbs"
it). Read `lib/stripe-price-validation.ts` first: it already refers to the Facts doc and may already hold part of the H8 work.
The older plan is `docs/projects/archive/STRIPE_PRICE_VALIDATION_PLAN.md`; check the TODO entry for its phases. **Do not build
an in-app card guard here** (that was H8's Phase 3); only report what is and is not already covered.

**Build:** a unit test that reads only the "Plans at a glance" table in the Facts doc and compares, for every plan row, the public
name, monthly price and annual price with the plan config. Traps [H]: the table is prose, not data: prices appear as `$39`,
`**$219** *(was $179)*`, `$2,190` (comma) and `Free`; labels need an explicit mapping to plan keys (Premium Coaches Portal is
`team`; Club · Association is `club_large`); prices are CAD. Parse **only that table** so ordinary edits to the doc's prose never
fail the build, and say plainly in the failure message which side to believe ("the Facts doc is canonical; change the plan
config, or log the change through /strategy first"). A plan missing from the table, or a row with no plan, fails too.

**Prove it fails:** change one price in a scratch copy and show the message. Restore it.

**Also for the Facts doc:** per the Plan & pricing rule in CLAUDE.md, if you find the doc and the config already disagree,
that is drift: stop and flag it to `/strategy`, do not silently pick a number.

## Part 4 · The Stripe setup guide (`docs/agents/ops/stripe-setup-guide.md`)

**Facts [H, helper's comparison against the code; confirm each as you rewrite]:** the guide still calls the product "Battle of
the Bats"; describes plans "Starter / Pro / Elite" at "$29 / $79 USD" with a 14-day trial and `STRIPE_PRICE_*` environment
variables (the code reads price IDs from the `stripe_prices` table, pasted per environment in Plans & pricing; prices are CAD;
trials come from plan config, Club is 90 days); says the customer portal has cancel off and four options (the code now pins
our own portal settings: invoice history on, payment method update on, cancel at period end on, plan switching off); lists
a webhook event set that predates Stage 0 (now also the four dispute and refund events, an event log, an ordering guard and a
refusal of the wrong mode); mentions only a full `sk_live_` key (restricted `rk_` keys are accepted and have a permission
list); and omits the Plans & pricing price-slot step and the daily comparison job.

**The Connect half (about lines 249–329) is current and is linked from roughly ten walk and plan documents** (the "two listen
windows" section especially). **Recommended: rewrite the subscription half to match the code, fix the title, keep the Connect
half and every heading other documents link to.** Retiring the whole file would break those links. Owner-run steps stay the
owner's: this guide describes what to set; Claude never changes Stripe settings.

Write for the owner doing the reconciliation (project item R) and the first live purchase: numbered, plain language, which
environment each step is for. Link to the Facts doc for prices instead of restating them.

## Part 5 · Closeout

- Run `npm run verify:changed` (typecheck needs the 8 GB heap on this repo); report anything it stops on that is another
  session's, do not fix it.
- **No `/accounting` review is required:** nothing here changes what FieldLogicHQ charges, collects, invoices or reports.
  If Part 1 is ruled C, that changes and `/accounting` is required before handoff.
- **No `/docs` pass:** no user-facing flow changes (unless Part 1 changes the promotions wording on the staff screen; then
  update the two help articles that quote "not linked to checkout" in `lib/help-content/platform-admin.tsx`).
- Offer `/simplify` (a new test file that touches many modules may want its exports tidied), then `/review`, once each.
- Update this file's Progress block, the plan's Stage 1 line and the PM brief with the commit hashes; add or update the one TODO.md line. Commit only on the owner's go.

## Not in this stage (stay out)

- Any price, plan name or copy change; any new plan; any change to checkout behaviour (unless Part 1 = C, which is a different stage).
- Any Stripe dashboard or key change; the reconciliation (item R) and the live purchase (O6) belong to the release and Club-on-sale sequence.
- Staff screens (Stage 2), one-customer tools (Stage 3), the catalogue (Stage 4).
- Edits to hooks, `.claude/settings*.json`, `package.json` scripts or any `WATCHED_PATHS` file.

## Shared-file traps

- `TODO.md` and `docs/projects/active/OWNER_QA_LEDGER.md` carry other sessions' uncommitted edits: stage only your own hunks.
- `lib/plan-config.ts` and the plan lists are also edited by billing and House League sessions: `git log -5 -- <file>` before you start, re-read at the moment you edit.
- Dev server: new files mean a restart before any browser testing (AGENTS.md), though this stage should need none.
