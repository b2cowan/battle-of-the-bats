# The first look — Stage 3 build prompt: the first screen inside

Paste into a fresh session. Rewritten 2026-10-20 by the session that ran the Stage 3 gate. **The gate is done: G1–G6
were drawn (after `/design`) and all six ruled as recommended on 2026-10-20.** Do not re-ask them. The remaining
blocking step is the AGENCY_RULES product-manager UX summary in the chat (short; the gate page already holds the long
version). Then build. **This session builds Stage 3 only.** Stage 4 (the free team's first home, a league's first
season, the claim link) is not this build.

---

## Read first, in this order

1. `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`. The rules that bite here: one `dev` branch; stage explicit pathspecs
   only, ask before every commit, never push; the spelling and clock gates; "disagree out loud"; argue from what the
   code does, not from what a plan or this prompt says (the line numbers below were read 2026-10-20 and will drift).
   This build touches no shared agent-automation path. The working copy is shared: run `git status` first and leave
   other sessions' files alone. `TODO.md`, the QA ledger, `memory/design_decisions.md` and `FIRST_LOOK_SIGNUP_PLAN.md`
   regularly carry other sessions' uncommitted hunks; partial-stage them.
2. **The spec is two drawings.**
   - The hub https://claude.ai/artifact/AdLSGDCii8xExFuVdZxvsx, tab **End state drawn**, sub-nav **S3 · The first
     screen inside**. Source `docs/projects/active/FIRST_LOOK_SIGNUP_HUB.html` (~6.9 MB of images: never open it
     whole; its S3 panels are lines ~570–576; strip the `data:image` runs).
   - **The gate page, which wins where the two differ:** https://claude.ai/artifact/CtzAZMhmvnJZQxMTtn5xjj, source
     `docs/projects/active/FIRST_LOOK_STAGE3_GATE.html` (small, safe to read). It draws the states the hub did not
     (paid welcome, the three waiting cards, the pick-named plan step, the list-price card) with the `/design` fixes
     applied, and lists what that review changed and what it said to measure on the built page.
3. `docs/projects/active/FIRST_LOOK_SIGNUP_PLAN.md`: findings **F06, F07, F08, F17, F18**; rules 1–8 (*Standing back*);
   Asks 4, 5, 9 (*Shape questions*); *Inherited from Account-First* (the "first plan choice" reading is **SETTLED:
   keep as built, no schema change**); **Stage 3 gate (ruled 2026-10-20)** under the stage ladder; *As built, Stages 1
   and 2* (the pieces you reuse).
4. `lib/plan-config.ts` for every price, limit and date (never type one); `docs/agents/strategy/PLAN_PRICING_FACTS.md`
   is the record. `memory/design_decisions.md` L191–230 (the first run's eight rules) and the 2026-10-12 *one loading
   line* entry; the `--type-*` ladder in `app/globals.css` ~L700–725 (incl. the first-run heading exception).

Delegate the broad reading (CLAUDE.md). Read the lines a decision turns on yourself.

---

## The rulings you build to (2026-10-19 Asks 4, 5b, 9; 2026-10-20 gate G1–G6)

### 3a — The plan step (`/{org}/admin/onboarding?choosePlan=1`)

- **One heading, said once: "How do you want to start?"** with the step line *Account ✓ · Organization ✓ · 3 Plan*.
- **Sub line (G4):** with a pricing pick, "You picked **{plan}** on the pricing page. You can change it here, or any
  time in Plan & billing." ({plan} is "Tournament Plus, billed annually/monthly" or "Tournament (free)"). With no
  pick, the drawn line: "{Org name} starts on one of these. You can change it any time in Plan & billing."
- **Two choices only: Tournament Plus and Tournament**, three differences each (drawn). League Plus and Club come off
  this step. The pick comes first and is preselected (2px olive edge) and holds **the one lime**; the other is the white
  secondary. With no pick, Tournament Plus first, as today. A pick is only a preselection.
- **Billing choice** on Tournament Plus: the shared two-option control with a visible "Billing" label, a drawn check
  on the picked option. With the Founding offer: "Then $39/month" / "Then $390/year", price "$0", small line "through
  {FOUNDING_SEASON_END_LABEL} · normally $39/month", chip "Founding Season". **Without it (G5):** the choice drops
  "Then"; the price follows it ($39/month or $390/year); annual's small line is the pricing page's own
  `formatAnnualSavings` text; monthly's has none. Every figure from `plan-config`.
- **Buttons:** "Start with Tournament Plus", "Start free with Tournament"; foot row link "Compare every plan" (drawn
  external-link icon) opening `/pricing` in a new tab.
- **Frame (G3):** the drawn page inside the admin's **bare first-run frame**, no top bar, as today. Laptop: **two up
  from 900px wide** (a named exception to rule 1, forced by rule 6); below that, the one 420px column.
- **Fold (rule 6), measured:** both buttons in view at 1366 × 768; the preselected plan's button above 844 at
  390 × 844.
- **The Founding $0 rule is untouched** (`foundingOfferHeld`, `foundingSeasonOfferOnPlanChoice`; settled).
- **G4 carry the free pick:** the pricing page's Tournament button carries `?plan=tournament` (no billing); step 1's
  plan sentence reads "Tournament (free)" with no billing period; the plan step preselects it.
- **G6 guard, not a build:** a unit test that fails when any plan other than Tournament / Tournament Plus points its
  start button at the tournament door while it can render one. No League Plus or Club door is built.

### 3b — The welcome and checkout complete (Ask 5b, F06, F17, G1, G2)

One card, two routes, in the consumer shell (white top bar, phone tabs), one 420px column, no card frame (rule 1).

- **The welcome (`/coaches/welcome`):** check well, title "Premium is on for {team}", then **only if the team holds
  the Founding comp, read from its record (G1)**: "Free through September 30, 2027. Nothing is charged before October 1,
  2027; in September you'll choose a plan for 2028." (labels from `plan-config`). One lime button **"Open your team"**
  (no arrow). The monospace-capitals pill and the "Opens your portal…" fine line go. A paid coach gets no second
  sentence. A failed comp read shows no dates sentence (fail closed: never promise a date you could not read).
- **Checkout complete (`/coaches/checkout/complete`), G2's three cards plus the ready state:**
  1. **No payment:** no `session_id`, or Stripe does not know it, or it is not a completed/paid session → at once:
     title "We can't find that payment", sub "If you've just paid, your portal link is on its way to your email.",
     lime **Go to Home** (`/`). Quiet well (ink-soft icon; amber is only ever a notice edge).
  2. **Setting up:** paid, no workspace yet → title "Setting up your portal", then the shared loading line (pulsing dot,
     no spinner): "Payment received. This takes a few seconds." No button. Keep the mechanism: the webhook creates the
     portal; the page polls (`router.refresh()` every 2.5 s, 20 tries).
  3. **Still setting up:** after the 20 tries → title "Still setting up your portal", sub "Payment received. We'll
     email you a link the moment it's ready, so you can close this page.", lime **Check again** (restarts the poll).
     The email is real: `lib/team-checkout.ts` ~L667 sends the welcome when the portal is made.
  4. **Ready:** the card **turns into the paid welcome** (G1, no second sentence) instead of redirecting past it.
     "Open your team" goes to `/{slug}/coaches?success=1` (the portal forwards the flag to the team landing; keep it).

### 3c — A fan's Home (Ask 9, F18)

Under the `signedInEmpty` empty-state sentence, one quiet olive text link, **"Want to run your own? Start a team or a
tournament"**, opening `/start`. No card, no button, 44px tall. The rest of Home is unchanged.

**Words:** `/marketing` reads every new string above before it ships (the heading, both sub lines, the six bullets,
the buttons, the welcome lines, the three waiting cards, the fan line). The drawn and ruled words are the starting
point; reopen one only with cause, and bring any change back to the owner.

---

## Where it lives in the code (read 2026-10-20; re-check before you rely on a line)

### The plan step — `app/[orgSlug]/admin/onboarding/page.tsx`
- Default export ~L225–230: a **Club** owner gets `<ClubSetupKit />` even with `?choosePlan=1`; everyone else
  `OnboardingPageLegacy`.
- `planChoiceRequired` ~L267; `pricingPlan = parseStartPricing(plan, billing)?.plan ?? null` ~L272; `?billing=` read
  separately ~L971. `foundingOfferHeld` ~L278–292 (fetches `/api/admin/org/founding-season-status?planChoice=1`).
- The required plan step's return ~L1389–1401: `<h1>` ~L1394 + `<p>` ~L1395, then `renderPlanChooser(true)`.
- `renderPlanChooser` ~L936–986: its `<h2 id="onboarding-plan-title">` ~L947 + `<p>` is **also the change-plan
  dialog's title** (keep it for the dialog). Renders `PricingSection` ~L965–981 with `order`, `featuredPlan`,
  `foundingOfferHeld`, `ctaLabel`, `initialBilling`; `compact` is never true today.
- `choosePlan` ~L470–551: `tournament` POSTs `/api/admin/org/onboarding-plan`; a paid plan POSTs
  `/api/billing/create-checkout` with `{ planKey, billingCycle, orgSlug, returnTo }`; `applied === true` = no Stripe
  needed (the Founding $0 path); else `window.location.assign(data.url)`; errors to `planError`. **Both actions stay.**
- **The change-plan dialog** (`planChooserOpen`, overlays ~L1421 and ~L1554) opens only from "View plans" ~L1457,
  which is in the league / other-plan return. It keeps the full `PricingSection`, its close (×) and "Continue free".
- Frame: `app/[orgSlug]/admin/AdminChrome.tsx` ~L42–48 makes `/admin/onboarding` a focused shell (no strip, no rail,
  no bottom nav). The page's CSS is `onboarding.module.css` (legacy dark rules at the top, kit overrides from ~L578).
  The drawn page needs the warm tokens: wrap it in the AccountForm `.page` recipe (composes `warm warmVars warmTab`
  from `components/consumer/warmTheme.module.css`) or the equivalent, and check it follows Warm / Dark (Ask 10).

### `components/PricingSection.tsx` (shared with `app/page.tsx` ~L564 and `app/pricing/ViewerAwarePlans.tsx`)
- Its cards are the marketing cards (11–12 bullets, `CTA_CLASS` lime on every card). **Recommended build:** the
  required plan step renders its own small two-choice component built from the AccountForm kit pieces; the dialog keeps
  `PricingSection`. This leaves every marketing caller's markup untouched (the build-prompt rule "never edit a shared
  card's markup"). Do not fork the logic: the $0 decision
  `(foundingOfferHeld && plan.key === 'tournament_plus') || isFoundingSeasonPromoActive(plan.key)` (~L384–388) becomes
  **one shared helper** both call; the price and savings text come from `plan-config`.
- `getSignupHref` ~L326–337 returns Tournament's bare `ctaHref`: G4 changes that link only (no visual change). Every
  org plan's `ctaHref` is `/start/tournament` (~L75, L116, L145, L178); closed plans render "Express interest" (~L464)
  instead of a link, which is why nothing is wrong today.
- Pricing page bottom "Get Started Free" (`app/pricing/page.tsx` ~L476) is a generic start, not a Tournament pick:
  leave it.

### The pick's path (G4)
- `lib/start-door.ts`: `START_PLANS` ~L25 (`tournament_plus, league, club, club_large`; add `tournament`),
  `parseStartPricing` ~L47 (billing defaults to monthly: a free pick must not grow a billing period anywhere it is
  shown), `planStepPath` ~L52.
- Step 1's sentence: `app/(consumer)/start/StartDoorForm.tsx` ~L224–231 ("You picked **{label}, billed {period}**, from
  the pricing page. You'll confirm it after naming your organization.").
- Also read by `app/(consumer)/start/tournament/page.tsx` ~L38/L72 and `app/api/auth/signup/route.ts` ~L102 (stored on
  the account). Grep for every other reader of `pricing` before adding the new value; anything that assumes a paid plan
  must be checked.

### The welcome — `app/coaches/welcome/page.tsx` (54 lines, server) + `welcome.module.css`
- Reads only `?team` (trimmed, 80 chars) and `?next` (`safeNextPath`, the portal URL `/{slug}/coaches?success=1`).
- `founding = isFoundingSeasonPromoActive('team')` ~L32 is **the calendar, not the comp**: replace it (G1). The comp is
  an `org_overrides` row on the workspace org: `type = 'comp_period'`, `expires_at in FOUNDING_SEASON_COMP_EXPIRIES`,
  `revoked_at is null` (the query shape is in `foundingSeasonOfferOnPlanChoice`, `lib/founding-season.ts` ~L83–91;
  provisioned by `provisionCompTeamWorkspaceFromCheckout` in `lib/team-checkout.ts`). The page is public
  (`proxy.ts` ~L288–302 carve-out); read the comp server-side from the workspace named by `next`. Never trust a URL
  flag for it.
- Only link in: `app/team/TeamSignupClient.tsx` ~L326–339 (`startCheckout`), on an internal URL while
  `foundingPromoActive`. The create route (`app/api/billing/create-team-checkout/route.ts` ~L127+) returns
  `comped: true` on that path; the client does not read it today.
- Frame: `app/coaches/welcome/layout.tsx` wraps `CoachJourneyChrome` (`components/consumer/CoachJourneyChrome.tsx`).
- Its CSS: a 440px white card, an off-ladder 1.35rem/800 title, `.promoPill` (monospace), a lime `.cta` not on
  `--home-lime-ink`. Rebuild on `StartColumn` / `StartHead` / `accountForm.primary` instead.

### Checkout complete — `app/coaches/checkout/complete/page.tsx` + `CheckoutProvisioning.tsx`
- Server ~L21–55: `stripe.checkout.sessions.retrieve(session_id)` → subscription id → `team_workspaces` by
  `stripe_subscription_id` (`limit(1)`) → org slug; **`redirect()` stays outside the try/catch** (its comment explains
  the bug it once caused). Today every failure (no id, bad id, no subscription) falls through to the poller; G2's card 1
  splits those out.
- Client: `POLL_MS = 2500`, `MAX_ATTEMPTS = 20`, all inline dark styles, a `Loader2` spinner, "Check again" resets.
- No layout file and `/coaches/checkout` is **not** in `WARM_JOURNEY_PREFIXES` (`lib/consumer-routes.ts` ~L39), so it
  wears the marketing bar and footer. Needs both: the prefix (drops the marketing chrome) **and** a `layout.tsx`
  wrapping `CoachJourneyChrome` (mounts the warm bar). Check the CoachPortalShell pass-through list
  (`lib/coaches-portal-routes.ts` ~L53–64). Stripe's `success_url` is set in `create-team-checkout/route.ts` ~L331.
- The loading line: `components/shared/LoadingState` (`inline`); AccountForm.module.css ~L20–22 already styles it in
  this column.
- Build the card once (welcome, ready, setting up, still setting up, can't find) and use it from both routes.

### A fan's Home — `components/consumer/HomePersonalization.tsx`
- `signedInEmpty` ~L149–152; its `<p className={styles.quietEmpty}>` ~L237–241. `waiting` suppresses it, so it never
  shows beside `WaitingWorkspaceCard` (which keeps its own door link).
- No quiet sentence-link class exists in `HomePersonalization.module.css` (`.headLink` is the monospace kicker style;
  do not reuse it). Add one (olive, 600, 14px, 44px tall), on the module's existing `--home-*` tokens.

---

## Keep (behaviours a restyle must not lose)

- Every Account-First behaviour: the remembered and locked start door, the Founding door, V1–V3, the 409 hand-off, the
  waiting-workspace card on Home.
- The plan step's two real actions and the `applied === true` branch; the change-plan dialog, its close and "Continue
  free"; a Club owner still gets the club setup kit.
- The checkout mechanism (webhook provisions, page polls, redirect outside the try) and the portal's `?success=1`.
- **Pinned tests, update a pin deliberately, never delete it:** `tests/unit/account-first-signup.test.ts` — L155
  (the $0 line in PricingSection: it moves with the shared helper), L157 `foundingOfferHeld={foundingOfferHeld}`,
  L159–160 (`offerKey`, `foundingOfferHeld`), L209 `featuredPlan={pricingPlan ?? 'tournament_plus'}` (the required step
  stops passing it to `PricingSection`: re-pin the same protection on the new component), L50–51 `planStepPath`.
  Also `tests/unit/gated-plan-availability-copy.test.ts` L55–85 (PricingSection's banned phrases),
  `lib/plan-config.test.ts` (`RENDERED` mirror of `RENDERED_PLAN_KEYS`), `tests/unit/tournament-stage5-create.test.ts`
  L138–143 (onboarding must keep `openNew('first_run'`), `tests/unit/admin-overlay-guard.test.ts` L84,
  `scripts/check-public-tokens.mjs` (PricingSection + onboarding CSS), `scripts/.css-selector-baseline.json`,
  `scripts/.admin-restyled-baseline.json`, and the `marketing-seam` UAT spec. **The pricing page and the home must look
  exactly as before.**

## Not in Stage 3 (ruled, later: don't build them on the way past)

- The plan step in the app's own frame (G3: a later call). A start door for League Plus or Club (G6: the guard holds).
- Stage 4: the free team's first home (F16), a league's first season and the club setup kit, the claim link (Ask 7).
- The public face, warm: marketing pages, the other emails, the system screens.
- **No schema change.** If you find yourself wanting a column, stop and ask.

## Report, don't build (residual risks to name in the hand-off)

- G6's guard reads the code. A plan can also be opened at runtime by the `plan_gating` table (and the dev cookie /
  env switch, `lib/plan-gating-server.ts` ~L21–40), which no unit test sees. Say so; the release checklist that opens a
  plan is `/billing`'s, not this build's.

---

## Build order and commits (each part committable alone; ask before each commit)

- **3a** the plan step + G4 (the free pick end to end) + G5 + the G6 guard test.
- **3b** the welcome and checkout complete (one card, both routes, the comp read).
- **3c** the fan's line.
- **Before each commit:** `/simplify` (3a adds a component and a shared helper next to `PricingSection`), then `/review`
  (billing and checkout are high risk). After 3a, offer `/docs` (no help article quotes these screens, checked
  2026-10-20; the organization guide may want to say what the first plan choice is).
- **Design log:** the ruled strings and G1–G6 go into `memory/design_decisions.md` as **one dated entry**, citing the
  gate page. The in-repo `memory/` write updates `memory/MEMORY.md` only if you add a file (you shouldn't need to).

## Verify

- During the work: `npm run verify:changed`; `npm run typecheck` once per part (`npx next typegen` first on Next 16.3);
  the unit tests above.
- **Layout** (`scripts/layout-screens.mjs`, entry shape at its top; sessions in `scripts/check-layout-invariants.mjs`
  ~L101–120): none of these screens has an entry. Add them, or say why not:
  - the plan step: the existing `admin-onboarding` fixture (`orgOwner` on `onboardingOrgSlug`) is a **Club** org, which
    renders the club setup kit, so it cannot show the plan step. A fresh tournament-plan org fixture is needed; if that
    means touching the UAT fixture setup, say so and ask rather than widening the fixtures quietly.
  - the welcome: `anon` with `?team=…&next=/{slug}/coaches` (no comp → the paid wording; a comp case needs a fixture).
  - checkout complete: `anon` with no `session_id` now renders card 1 at once; the waiting cards need a stub or a
    `clock`/`interact`.
  - an empty fan Home: there is no fan session; say so in the hand-off, or ask before adding one.
  - Run `npm run check:layout --changed` on the dev server for the screens each part touched, 320/361/390/768/1440.
    Never a whole-product sweep on dev.
- **Fold (rule 6), measured, not eyeballed:** the preselected button at 390 × 844; both buttons at 1366 × 768; whether
  the 32px heading wraps to two lines at 358px (about +34px); the "Compare every plan" row not clipped.
- **Dark:** every new screen in Dark (none was drawn dark; Dark stays dark, `design_decisions.md` ~L223).
- **Dev server:** shared modules and new files change; restart before handing to the owner (stop the server before
  clearing `.next`).
- **Stripe:** the setting-up and ready states need a real session; use staging or the `team-direct-checkout-smoke` UAT
  spec, and mark those steps staging-only in the walk.

## QA

- **One checkable walk, one purpose** (auto-memory `feedback_qa_walkthroughs_as_checkable_artifacts`), published as an
  Artifact: a fresh organizer to the plan step on a laptop and a phone, three ways (picked Tournament Plus annual on the
  pricing page; picked Tournament; no pick), Founding $0 shown, League Plus and Club absent, both buttons in view; the
  change-plan dialog on a League Plus org still opens and closes; a Founding Season coach to the welcome (one dates
  sentence, "Open your team"); a paid coach through checkout complete (setting up, the paid welcome, the portal with
  its first-visit summary); the checkout page opened with no payment; a fan's empty Home with the line. Warm and Dark.
- Take the next free § in `OWNER_QA_LEDGER.md` at build time (§352 was the last seen on 2026-10-20; other sessions
  number too, re-check). Never sort the §s. Say which steps are staging-only.

## Success

- A new organizer reaches the plan step and can act without scrolling: two choices, one heading, both buttons in view,
  their pricing-page pick (paid or free) already chosen and named.
- A Founding Season coach and a paid coach see one welcome in the app's own frame; neither is told something untrue
  about charges; the waiting never looks like a different product, and a page opened without a payment says so at once.
- A fan with an empty Home can find a way to start something in one tap.
- Every Account-First behaviour and every pinned test still protects what it protected; the marketing and pricing pages
  are unchanged.
