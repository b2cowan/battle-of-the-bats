# Putting Club, Club · Association and League Plus on sale — the gate flip runbook

> **What this is:** the steps that turn the Club release into something a club can buy, for Stage 8 of
> `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` ("the gate flip runbook — `plan_gating` → `live` for
> `club`, both sources in agreement (A10); Stripe checkout verified end to end in sandbox + live; trial/card copy
> true"). **A document only. Nothing here has been run. Written 2026-11-18 from the code that day.**
> Canonical prices, names and gates: `docs/agents/strategy/PLAN_PRICING_FACTS.md` — this page states none of its own.
> Stripe setup detail: `docs/agents/ops/stripe-setup-guide.md`. Release steps: `.claude/commands/release.md`.

## ⚠ Read this first — three corrections to the plan's line

1. **Three plans flip, not one.** Club **and Club · Association** go self-serve at the Club release (Facts doc, "Plans
   at a glance", Decided 2026-09-25 — Club · Association is *not* contact-us). **League Plus** goes on sale with the
   Club release (`BUSINESS_DECISIONS.md` 2026-11-06, "HANDOFF → /billing: League Plus joins the Club release
   runbook's gate flip"). The plan's Stage 8 line says `club` only and asks for a "Club · Association contact-us door";
   both are stale.
2. **The flip is not a switch yet.** Every price reads the live config, but most of the public words and doors for
   these three plans are typed in and **never look at the gate**. Flipping the gate today would leave "Coming soon",
   "Express interest" and "We set up Club with you directly" on the public pages, send the Club card's button to the
   tournament sign-up, and show no Club · Association card at all. **Step 0 is a build** (owned by `/plan` →
   `/marketing` → `/billing`), not a runbook step.
3. **"Both sources in agreement" is not true today for the one plan already flipped.** The Premium Coaches Portal
   (`team`) is live on production but still `early_access` in the code (`lib/plan-config.ts`), and nothing compares
   the two. The code comment "change this to 'live' — no other changes required" is wrong. Step 4 below closes it
   for the three new plans and should close it for `team` in the same change.

## How the gate works (for reading the steps)

- **Two sources.** The production database row per plan in `plan_gating` (`live` or `early_access`), and the code
  value `PLAN_CONFIG[plan].gatingStatus` in `lib/plan-config.ts`. The app reads the **database first** and uses the
  code value only when the database read fails or returns nothing (`lib/plan-gating-server.ts`; the browser's
  `usePlanGating()` falls back the same way). A few places read the code value directly (the onboarding page's first
  paint, the house-league cap upgrade, a unit test) — those are on the Step 0 list.
- **The audited door** to change a row is platform admin › Plans & pricing › **Request live**, which makes a change
  request; applying it needs an approved request and writes the audit log. The only script
  (`scripts/set-team-plan-gating.mjs`) is hard-wired to `team` — do not adapt it on the day; use the door.
- **Checkout** refuses a gated plan, finds the price in the `stripe_prices` table (live or sandbox, chosen by the
  Stripe key in use), and starts the plan's trial (Club and Club · Association 90 days, League Plus 30 — read from the
  config, overridable by a production `plan_config_overrides` row). Stripe collects a card during the trial.

---

## Step 0 — the build that has to ship before the flip (route to `/plan`)

Every line below is **true today while the plans are gated** and becomes **false the moment they flip**. The build
makes each one read the live gate (or removes it). Paths and lines are as found 2026-11-18.

**Plan cards (shared by /pricing, the home page and onboarding) — `components/PricingSection.tsx`**
- No **Club · Association** card or door: `RENDERED_PLAN_KEYS` leaves out `club_large`. The Club card says "up to 30
  on Club · Association" with no price; the Facts doc puts both band prices on /pricing and /for-clubs.
- Club's **"Start your Club trial"** and League Plus's buttons go to **`/start/tournament`** (`tests/unit/first-look-stage3.test.ts`
  asserts they must not — it fails the day either plan opens without its own door).
- League Plus card: **"No credit card required" / "Start free"** — false at the flip (30-day trial, card collected).
  There is no League Plus trial sentence in the copy canon; `/marketing` writes one.
- The strip's tag for Club reads "Not open yet"; the canon is "Coming soon" (wrong today, minor).

**`/pricing` — `app/pricing/page.tsx`**: "open for interest while we finish those workflows", "open for early interest
below", the "Not open yet / what they cover" section, the always-shown "Express interest in League Plus or Club"
button, the League and Club bridges ("built, but not open for sign-up", "Coming soon — express interest"), the
house-league segment's "Express interest in League Plus", and a billing FAQ with no Club trial-and-card sentence.

**`/for-clubs` — `app/for-clubs/page.tsx`**: "Coming soon — Club is in development", "finishing its final workflows
before self-serve checkout opens", the "Coming soon" tag, three "Express interest in Club" buttons, no Club ·
Association price, no "plus applicable taxes" line (correct only while gated), and the demo block "Both halves are
live today … express interest for the day they're one product" (see the demo ruling in the readiness plan's Stage 8).

**`/for-leagues` — `app/for-leagues/page.tsx`**: three "Express interest in League Plus", "built but not currently open
for sign-up", "when League Plus opens", the gated tag and sentence called with no gate check, no tax line.

**Home page — `app/page.tsx`**: the League Plus and Club cards stay "coming soon" until `liveBadge` is filled in;
"League Plus and Club modules can be added as they open".

**Sign-up — `app/(consumer)/start/club/page.tsx` and `start/page.tsx`**: "Club has no self-serve free path … We set up
Club with you directly … Talk to us about Club", and the chooser has no Club card. Self-serve needs a real Club (and
League Plus) start.

**In the product**: the house-league cap upgrade reads the code value and would show "Upgrade to League Plus →" yet open
the interest form; the onboarding page's first paint reads the code value.

**The interest form** (`components/EarlyAccessForm.tsx`, `EarlyAccessModalTrigger.tsx`): after the flip it should leave
these three plans' pages. Its confirmation promises "we'll write to {email} as the areas you picked become ready" —
nothing sends that, so Step 6 does it by hand.

**Not in the build, but a trap:** retired campaign emails (`lib/marketing-email-defaults.ts`, same text in a
migration) say "Club is free through December 31, 2026", "parent notifications" and "team invoicing" — all false.
They are kept "for revival the day a product un-parks"; **never revive them for this release** (`/marketing` writes
new ones if wanted).

---

## Step 1 — Stripe, in the sandbox (dev or staging)

1. In the sandbox, confirm `stripe_prices` has monthly and annual rows for `club`, `club_large` and `league`, and
   that the amounts match the Facts doc.
2. With the Step 0 build on the sandbox site, buy each plan from the public page as a new person:
   - **Club**: the trial is 90 days, a card is asked for, the first invoice is dated after the trial, and the
     "plus applicable taxes" line shows on the price you are charged.
   - **Club → Club · Association**: the move shows a prorated preview and changes the one subscription.
   - **Club · Association** bought directly, the same checks.
   - **League Plus**: 30-day trial, card asked for.
   - A club that already has a subscription is refused a second checkout.
3. Cancel each test subscription afterwards (remember test-clock objects are hidden from Stripe's list calls; prove
   "none left" per customer).
4. Note the date and what passed in the release-history record.

## Step 2 — Stripe, live (before the flip)

1. Run the live audit in `stripe-setup-guide.md` ("item R" checklist; `scripts/audit-stripe-billing.mjs` against the
   production env). On 2026-11-06 all 10 live prices were correct, Club and Club · Association included, and **10
   webhook events were missing in live** — fix those first.
2. Read production's `stripe_prices` rows for the three plans (the readiness plan once noted the live Club rows were
   not configured; the 11-06 audit says the prices exist — confirm the rows, not the dashboard).
3. Read production's `plan_config_overrides` for the three plans; a `trial_days` row there overrides the config.
4. The GST/HST work: "plus applicable taxes" on a chargeable price must reach production with the tax build, not
   before (Facts doc, sales-tax rider). Confirm with the GST/HST plan's owner that tax collection is live before
   these plans are chargeable.

## Step 3 — promote the Step 0 build (gates still closed)

Ship it with the normal release while the three database rows still say `early_access`. Check on production that
nothing changed for a visitor (still "Coming soon"), because the pages now follow the gate and the gate is closed.

## Step 4 — flip

1. Platform admin › Plans & pricing: **Request live** for `club`, `club_large` and `league`; approve; apply. Each
   writes an audit row — give the note "Club release: on sale" (or your words).
2. **Verify from the live gate, never from a plan header** (the 2026-07-24 lesson): read the three rows on
   production, then open `/pricing`, `/for-clubs`, `/for-leagues`, `/start` and the home page signed out.
3. **Make both sources agree** in the next promote: set `gatingStatus: 'live'` for `club`, `club_large`, `league`
   **and `team`** in `lib/plan-config.ts`, update the test that asserts the old value, and correct the misleading
   code comment. Add a check that fails when a production row and the code value disagree (`/billing`).

## Step 5 — the first live purchase

Follow `stripe-setup-guide.md` "first live purchase": watch the first real Club checkout end to end (trial started,
card on file, webhook received, the club's plan and modules correct in platform admin, the welcome email sent).

## Step 6 — after the flip

1. **People who expressed interest**: platform admin › Early access; email by hand, from support@, only those who
   gave consent to be told (`release_notifications_consent`), naming the plan they picked.
2. `/strategy` logs the release decision and the cohort shape (Stage 8's own line); the Facts doc's "Purchasable
   today?" column changes in the same unit of work.
3. `/demos` at the next release cycle (see the demo ruling).

## Undoing the flip

Set the three rows back to `early_access` through the same door. Anyone who already bought **keeps** their
subscription and plan (checkout is refused for new buyers only). Code undo is in
`docs/agents/ops/CLUB_SUPPORT_AND_ROLLBACK_RUNBOOK.md` §3.

---

## Drift found 2026-11-18 that is wrong **today** (not a release item) — flagged, not edited

For `/strategy` (canon) and `/marketing` (words). No price disagrees anywhere; these are words and names.

| Where | Says | Disagrees with |
|---|---|---|
| `README.md:47` | "a Free League Starter" | Naming canon: never "Starter" |
| `lib/plan-billing-profile.ts` (Club's Included list, shown on /for-clubs) | "Everything in League (tournaments, house league, public org page)"; leaves out Families | Canon says League Plus; Families is a Club inclusion |
| Home page `app/page.tsx` | "League Plus and Club are in active development"; tag "· In development" | Canon tags: League Plus "built but not open", Club "Coming soon" |
| `/pricing` header | "Tournament and Tournament Plus are live — start free, no credit card required" | Minor: reads as if Tournament Plus needs no card; its trial checkout collects one ("start free" is true only of the free Tournament plan) |
| `/for-leagues` | Coaches Portal cross-sell always "Express interest in the Coaches Portal" | Premium has been on sale since 2026-07-24 |
| Interest form | "Early access", "Join early access"; "Coach portal" | Canon: never "early access"; "Coaches Portal" |
| `PRICING_PAGE_COPY.md` | Club $179 card and comparison tables, "Free League Starter", "League is opening soon", "automated parent notifications", officials counted toward seats, announcements not free, "no credit card required until you're ready" | Facts doc (Club $219, naming canon, officials exempt, announcements free) — the canon doc is behind its source |
| `PLAN_PRICING_FACTS.md` itself | Still lists the Club card's "No credit card required" as drift (now fixed in the cards); still says bank reconciliation is "not built" (the bank check passed 2026-11-07) | The product — `/strategy` to true on its next reconcile |
| `.claude/commands/marketing.md` | Plan list "Tournament, Tournament Plus, League, Club" | Naming canon (not edited: shared agent file) |
| Readiness plan, "Marketing truth" checklist line (~1469) | "homepage 'field bookings' removed" | Facts doc 2026-10-11: ruled pain-framing and kept |
