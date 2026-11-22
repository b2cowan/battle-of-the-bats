# Build prompt — On-sale pages, session S4: buying from inside the product

> Paste everything below the line into a new chat on `dev` (`/clear` first). Written 2026-11-21, after the S4 drawing
> round (drawing v3 https://claude.ai/artifact/5axLqJjfLTuT42Hm589H2y, calls 35–46 **ruled as recommended** 2026-11-21,
> call 40 = option A). The plan's order: … S3 → S3b → **S4**. **S4 is a launch item (call 42): it ships before the flip.**
> It changes what FieldLogicHQ charges, so `/accounting` runs before hand-off, not as an offer.
> **Model: Opus** (money, accounts, a plan-ending change). Helpers read on Sonnet.
> **Do not overlap a Plan & billing build session** (plan §Sequencing): check the board (`plan-billing`) and `git log`
> for one in flight and say so in your first message.

---

You are building **S4 of the on-sale pages** for FieldLogicHQ: a person already inside the product starts League Plus,
Club or Club · Association from Plan & billing, a paying Tournament Plus organization moves to League Plus, and a
free-time organization can start the plans above its free plan. S1 made the pages read the on-sale switch, S2 built the
doors for a NEW organization, S3/S3b the pages. **S4 reuses what ships** (the Change plan table, the payment window, the
move window, the "setting up" wait); it builds no second purchase flow.

## Read first

1. `CLAUDE.md`, `AGENCY_RULES.md`, `AGENTS.md` (this is not the Next.js you know: read the guide in
   `node_modules/next/dist/docs/` before changing how a route or page renders).
2. The plan of record, `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`: **S4** in full, including **"S4 drawing round
   (2026-11-20/21)"** (what the code showed, the decided guards, asks 35–46 and their rulings); the **S2 record** (traps
   A–D, `start_plan`, terms acceptance, "fail visibly"); "Owner asks" (all ruled; do not re-open one). PM brief:
   `CLUB_ON_SALE_PAGES_PM_BRIEF.md`.
3. **The drawing is the build target:** `docs/projects/active/CLUB_ON_SALE_S4_DRAWINGS.html` (v3). Every tab, both gate
   states, desk and phone; click every numbered note (each says what ships today, what S4 does, and why). Captures and the
   probe evidence: `docs/projects/active/club-on-sale-s4/`; the capture script `.probe/club-on-sale/s4/capture-s4.mjs`
   (its own guard; reuse it for after-shots).
4. Prices, trials and tax words come only from `lib/plan-config.ts` (import-free: seed scripts load it with plain Node),
   `lib/plan-trial-line.ts`, `BILLING_TAX_WORDS`, `formatAnnualSavings` — never typed. Facts:
   `docs/agents/strategy/PLAN_PRICING_FACTS.md`.
5. The free-time rules: `FREE_TIME_SAME_RULES_PLAN.md`, `lib/free-time.ts`, `lib/free-time-reclose.ts`,
   `lib/plan-ending.ts` (`applyEnding`), `lib/club-free-time-reminders.ts`.

**What changed since the asks were ruled, and binding constraints (these win over any older doc):**
- Team limits count the teams given a Premium Coaches Portal; house league teams are unlimited (2026-11-19). Words: "the
  teams you give a Premium Coaches Portal" (`/marketing`).
- League Plus changes to no other plan at launch (no League Plus → Club button; C1 of walk §550, after launch).
- League Plus's and Club's closed word is "Coming soon"; the status pill sits on the first line.
- The Founding Season is gone; its three holders are ordinary free-time organizations. No Founding sentence anywhere.
- No coach surface changes (a Premium coach's Plan & billing is out of S4 and must stay as it is).
- One spelling: "installment", "8:00 a.m." through `formatTime()`, no "module".

**The plan's and the drawing's code citations are leads, not evidence.** Other sessions commit to these files. A helper
does the broad reading; you open the lines a decision turns on and mark each fact [V] (opened, `file:line`) or [H].

## Before any code

Give the Product Manager UX summary (what each person sees and does differently: free Tournament owner, paying Tournament
Plus owner, free-time owner, someone who left Stripe halfway, a visitor on `/for-tournament-organizers`; and that a
Premium coach and a League Plus organization see no change) and a task list. Disagree out loud if the code says the plan
is wrong. Then build in the parts below, in order; stop and hand back at the end of a part if the context grows deep.

## Part 1 — the starts on Plan & billing (drawing tabs 2, 3, 4, 7)

1. **Rows (call 35).** `upgradePlansFor` offers a free Tournament organization Tournament Plus, League Plus, Club and
   Club · Association; a free-time organization only the plans ranked ABOVE its running granted plan (it needs the grant,
   not only the own plan). `showChanges` stops hiding Change plan for a free-time organization (its granted plan is the
   "Your plan" row, "Free through {date}"). `PANEL_PLANS` gains `club_large`, with the panel links and tests.
2. **The shelf (35).** "Managing more than tournaments?" keeps the Premium Coaches Portal card only, for both Tournament
   plans.
3. **Closed rows (36).** The plan's name carries the "Coming soon" pill (the shipped gated tag); the button reads
   "Contact us" (same mail link). A closed MOVE row reads the same. Rows read the live gate as today; "still loading"
   counts as closed (no flash).
4. **The count line (37).** Under the table, only when a Club row shows: "Club and Club · Association count the teams you
   give a Premium Coaches Portal. House league teams are unlimited. More than 30? Contact us for a custom plan." (absorbs
   today's "More than 30 teams?" line); Club's own card line (`growingTeams` / `largestTeams`) gains the same clause.
5. **The payment window (38).** Every checkout start opens the shipped `PlanCycleDialog` (Monthly | Yearly, opens on
   Monthly, saving from `formatAnnualSavings`), from the table and from `PlanPanelDrawer` over any page (today hard-coded
   monthly at :54 and :93; reuse `PlanArticlePanel`'s cycle handling). It states the TRUE trial: the trial sentence with
   the real length, or `clubUpgrade.noTrial`, from a **read-only** trial read (like `/api/billing/start-plan`'s
   `trialDaysAfterHistory`) that never creates a Stripe customer (checkout's `ensureStripeCustomer` must not run for it).
6. **The left start (41).** While `start_plan` is set on a free Tournament organization and that plan is open, one line
   above the table: "You were starting Club. Pick up where you left off with Upgrade to Club below." Absent while closed.
   No expiry state (every press makes a fresh Stripe session).
7. **The wait (decided).** Any Tournament-own-plan organization's checkout of League Plus, Club or Club · Association
   returns to the shipped "setting up" wait (`StartPlanSetup` keyed on `session_id`; `door` = league for League Plus,
   club for both Club plans), not to `success=1` and "Your plan is active". Same for the onboarding four-card chooser's
   purchase. Tournament Plus keeps today's notice. Words: "Setting up {plan}" / "We're setting up {plan} for {org}. Your
   events, teams and staff stay where they are. Please don't start another payment." and the shipped longer / unconfirmed
   states with the plan's name.
8. **No second start while one is landing (decided, the `/ux` must-fix).** Before creating a session, `create-checkout`
   asks Stripe whether this organization's customer already has a subscription the webhook has not recorded; if so it
   refuses (409, a code the screen reads) and Plan & billing shows the wait instead of the rows. Verify whether the
   customer id exists on the organization at first press (`ensureStripeCustomer`) before relying on it.
9. **Refusals, all before Stripe, all with shipped words:** no billing address (the address window first); the plan
   closed between load and press; legal pages off on a live key; a Québec or US address (`billing_region_closed`); a start
   at or below a running free plan (new server refusal in `create-checkout`, even from a stale page — `/billing` must-fix).

## Part 2 — the move to League Plus (drawing tab 5)

1. `MOVES.tournament_plus.league = 'up'` (`lib/plan-move-options.ts`). Everything else is the shipped move-up rule
   (`lib/plan-move.ts:26-38`): prorated today from Stripe's preview with the preview's `proration_date`, same cycle, no
   second trial, a trialing subscription keeps its trial. **Charge sentence (call 39, `/accounting`: correct and
   complete).**
2. The window's first sentence per plan (decided; `move.up` today reads "up to 9999 teams" for League Plus): League Plus
   — "{org} moves to League Plus today. Your events, teams and staff stay where they are."; Club / Club · Association —
   "{org} moves to {plan} today and can hold up to {limit} teams with a Premium Coaches Portal. Your events, teams and
   staff stay where they are." The hint gains "No second trial."
3. **A failing payment (46):** a Tournament Plus organization whose payment is past due is refused before the window with
   Premium's words ("Your last payment didn't go through. Update your payment method first, then move.").
4. **Legal pages off on a live key (decided):** `/api/billing/move` AND its preview refuse league / club / club_large,
   before the address work, as `create-checkout` does (:105-111). This newly covers the existing Tournament Plus → Club
   move: say so in the commit message. Add both routes to the S2 census tests.
5. The move's other states are the shipped ones (loading, no address, check failed, charge changed, region closed).

## Part 3 — free time falls back (call 40, option A) — its own `/review` high-risk

**The ruling:** buying a plan does not end free time; **if the paid plan then ends while a plan free time runs, the
organization falls back to its free plan instead of closing.** Today `applyEnding` suspends it, takes the site off,
archives tournaments and starts the 90-day clock, and plan free time does not let it back in
(`lib/free-time-reclose.ts:6-8`, `lib/free-time.ts:488-491`).

1. In the ending (in-app cancel at period end, End now, Stripe giving up): when a running `plan_tier` grant would apply
   to the organization's free own plan, the ending stores the free own plan and does NOT suspend, take the site off,
   archive or start the clock; tournaments over the granted plan's limit follow the shipped retention rule. Read every
   caller of `applyEnding` first; free time with no end date behaves the same.
2. When that free time later ends with no paid plan, the shipped free-time ending applies (back to free Tournament, as
   the band already says).
3. Words: under the table for a free-time organization — "Starting a plan doesn't end your free time. If you stop it,
   {org} goes back to free Tournament Plus through {date}." (no end date: "…goes back to free Tournament Plus."); the
   cancel window and "Reduce or cancel" for such an organization say the same instead of "tournaments go offline".
   `/legal` reads the words as built (it caught v1 promising this before it was true).
4. **The comeback trap (`/billing`):** a free-time organization whose stored status is `canceled` must not have its first
   purchase treated as a reactivation (`lib/billing-webhook-handler.ts:603-606`: restore, the `subscription_recovered`
   event, the "Welcome back" email at :660-668). Check the free-time fixtures on dev; production is a count only (how
   many free-time organizations are stored `canceled`) — read by the owner or as a count, never a row.
5. Reminders and the platform-admin free-time console: confirm a grant outranked by a paid plan reads as such (no
   "ending" email while the paid plan runs — `club-free-time-reminders.ts:109`), and that the console does not call it
   ended.

## Part 4 — the second-subscription alert, the onboarding words, the line (calls 43, 44, 45; drawing tabs 8, 9)

1. **Call 45:** the webhook's "second subscription ignored" branch (`lib/billing-webhook-handler.ts` ~:524-531, today one
   `console.warn`) raises an ops alert to the owner through the existing ops-alert path, naming the organization, both
   subscription ids and the charge. No automatic cancel or refund (by hand from our admin). If adding the alert changes a
   watched automation path, stop and ask (AGENCY_RULES).
2. **Call 43:** the onboarding change-plan window keeps its four cards; while League Plus and/or Club is open its subtitle
   adds "Running more than tournaments? League Plus adds house league seasons, and Club adds rep teams and the club's
   books." (only the open plan's clause); today's sentence while both are closed. Check each claim against the Facts doc.
3. **W71, call 44 (keep the ruled verb):** on `/for-tournament-organizers`, under the League Plus and Club cross-sells,
   "Already running tournaments here? Start League Plus from Plan & billing. Your events, teams and staff stay where they
   are." (Club the same), each only while ITS plan is open; "Plan & billing" links through the plan's own start door (a
   signed-in owner lands on their Plan & billing — S2 trap D — a visitor signs in). **Guard:** a unit test fails if the
   League Plus line can render while `moveDirection('tournament_plus','league')` is null.

## Proofs (dev, Stripe TEST mode, with teardown)

Follow S2's probe pattern (`.probe/club-on-sale/s2/`: dev Supabase and an `sk_test_` key or refuse). For each: a free
Tournament organization starts Club, Club · Association and League Plus (complete the hosted checkout with a test card or
drive the subscription through the test API as S2 did), the wait lands on the new workspace; a paying Tournament Plus
organization moves to League Plus (monthly, and yearly) and the invoice shows the credit and charge lines with tax; a
mid-trial move invoices $0; a second start while the first is landing is refused; a free-time organization starts Club
and then cancels at period end → falls back to free Tournament Plus, site on, nothing archived. **Teardown:** cancel and
delete every test customer and subscription you made; prove none left with `invoices.search` / per-customer lists (Stripe
list calls hide test-clock objects — memory `reference_stripe_list_hides_test_clock_objects`). Restore the fixtures you
changed (record each before you change it).

## Tests and checks

- Unit: the rows per plan and per grant rank; closed rows; the shelf; the count line only with Club rows; the true-trial
  read creates no customer; the wait's success URL for every Tournament-org start; the second-start refusal; the
  at-or-below refusal; the move row and its sentences; the past-due refusal; the move + preview legal-pages refusal (S2
  census); the plan-ending fall-back (every `applyEnding` path) and the comeback trap; the second-subscription alert; W71's
  guard; a Premium coach's Plan & billing unchanged (snapshot or render test).
- `npm run verify:changed` (it stops at the first failing step; other sessions' work can fail `npm test` — then run the
  later checks one by one and say which failures are not yours). `npm run typecheck` with
  `NODE_OPTIONS=--max-old-space-size=8192`. Spelling gate. Layout: `check-layout-invariants.mjs --changed` on the screens
  touched (never a whole-product sweep on the dev server).
- After-shots with the S4 capture script, both gate states, desk and phone. The free Tournament fixture
  (`free-owner@dev.local`) must tick the current Terms once first (the owner may do it; or the walk's first step).
- Restart the dev server before hand-off (new files, shared modules); stop it before deleting `.next`.

## Reviews before handing off (run them, not offered)

`/review` **high-risk** (accounts + money; Part 3 separately); `/billing` (gates, double-charge, free-time); `/accounting`
(the move invoice, the fall-back, the alert's money); `/legal` (the free-time words and the cancel-window words as
built); `/design` on the built screens against the drawing (both states, desk and phone, one lime per screen);
`/marketing` on every word as built; `/docs` (a customer flow changes: Plan & billing, plan changes, free time). Offer
`/simplify` if a second copy of the start logic appears.

## Rules

- Branch `dev` only. Explicit pathspecs. **No commit and no push without the owner's yes.** Re-check the branch before
  every commit; `git show --stat HEAD` after it.
- **Other sessions have uncommitted edits in shared files** (on 2026-11-21: the plan, the board, the QA ledger). `git diff`
  a file before editing it; stage only your hunks by building HEAD + your exact edits (`git hash-object -w` +
  `git update-index --cacheinfo`), never a `-U0` filter (memory `reference_partial_commit_shared_tree`).
- No database change on production, no gate flipped; the flip is the runbook's. A migration (if Part 3 needs one) updates
  `DATA_DICTIONARY.md` and the snapshots in the same unit and goes on `MANUAL_PROD_STEPS.json`.
- Production is read only as counts and schema, never a person's row.

## The walk and the hand-back

1. What each person sees differently, in product-owner voice, and how to see both states on dev (Dev tools › Plan gates
   › "Show as closed").
2. **One walk** (an Artifact, 20–50 boxes, one action per step, ONE purpose: "buying from inside the product"), entered in
   the Owner QA Ledger; owner calls never in the counter. Exact logins:
   - free Tournament owner `free-owner@dev.local` · `devpass123` (org `free-test-org`; tick the Terms first)
   - paying Tournament Plus owner `uat-owner@uat-test-org.local` · `UATPassword2026!` (org `uat-test-org`; this person also
     owns `uat-plus-org` — name the slug in each step)
   - free-time owner `owner@dev.local` · `devpass123` (org `dev-tplus-org`, Tournament Plus free through Sep 30, 2027)
   - Premium coach `uat-paying-coach@uat-free-coach.local` · `UATPassword2026!` (unchanged check)
   - platform admin `uat-platform@fieldlogichq.ca` · `UATPassword2026!` (Plan gates, the free-time console)
   - Stripe test card 4242 4242 4242 4242, any future date, any CVC.
3. Records in the same pass: the plan's S4 stage (built, then its commit once the owner commits), the board line
   `club-tier`, `PRICING_PAGE_COPY.md` (W71 now in code), the PM brief, the Claude memory file
   `project_club_on_sale_pages.md`, help content via `/docs`.
4. **Owner steps to list:** the walk; any production step Part 3 adds (on `MANUAL_PROD_STEPS.json`); the count of
   free-time organizations stored `canceled` on production (Part 3.4); S2's migration 508 (`start_plan`) is already a
   promote condition.
