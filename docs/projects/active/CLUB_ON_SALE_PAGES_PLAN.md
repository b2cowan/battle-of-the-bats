# The on-sale pages — Club, Club · Association and League Plus follow the switch (plan)

**Status:** on the board (Owner Morning Brief, project "Club release").
**What this is:** the build the gate-flip runbook calls Step 0 (`docs/agents/ops/CLUB_GATE_FLIP_RUNBOOK.md` §Step 0),
planned 2026-11-18 from the code that day. PM brief: `CLUB_ON_SALE_PAGES_PM_BRIEF.md`. Drawings:
`CLUB_ON_SALE_PAGES_DRAWINGS.html` (published as a Claude Artifact; link in the brief). Words (draft for ruling):
`CLUB_ON_SALE_COPY.md`. **The audience review of the same day is folded in here** (its own section below, stages S3 and
S3b, Asks 21 to 34); it is not a separate project. Prices, names, bands, trial lengths and gates: `docs/agents/strategy/PLAN_PRICING_FACTS.md`
only — this plan states none of them.

**The rule the whole build serves:** a page about Club, Club · Association or League Plus shows what it shows today
while that plan's switch is closed, and a real way to buy the moment it opens — with no redeploy and no second edit.

## Already ruled (not re-opened here)

- Open launch, not invite-only; no club demo at launch (owner 2026-11-18, `BUSINESS_DECISIONS.md` :35-71).
- Three plans flip together, not one (runbook correction 1; `BUSINESS_DECISIONS.md` 2026-11-06 :322-337, 2026-09-25
  :2323-2325 — Club · Association is self-serve, not contact-us).
- Both band prices on `/pricing` and `/for-clubs` (Facts doc :188); the Club trial sentence is one sentence on every
  surface (`clubTrialLine()`, Facts :191, canon `PRICING_PAGE_COPY.md` :275-298).
- "No 'we set up Club with you' or 'talk to us' framing survives the flip" (`BUSINESS_DECISIONS.md` :49-50).
- The retired campaign emails are never revived (runbook §Step 0 last paragraph).
- ~~League Plus's free floor (the `LEAGUE_STARTER_BETA` start) is not this build's question — it stays as it is (off on
  production); whether the free league floor exists at all is `/strategy`'s open item (`BUSINESS_DECISIONS.md` :322).~~
  Ruled 2026-11-19 (retired) and built: **⚰ 2026-11-19: the free League is removed** (`FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md` Stage 1) — there is no `LEAGUE_STARTER_BETA` start any more; `/start/league` is League Plus while it is on sale, else the interest form.

## What the code does today (2026-11-18) — and where the runbook under-states it

Three helper censuses, the cited lines opened by the planning session.

1. **There is no way to create a Club or League Plus organization.** Every self-serve start makes a free
   `tournament` org (`app/api/org/create/route.ts:111`). The Run a tournament door drops a Club or League Plus pick by
   design (`lib/start-door.ts:34-41`, first-look G6), and its plan step offers only the two tournament plans
   (`app/[orgSlug]/admin/onboarding/PlanStep.tsx:30`). `/start/club` is a contact page; the `/start` chooser has no Club
   card; `/start/league` is the free League starter (flag off on production) or the interest form. Checkout
   (`app/api/billing/create-checkout/route.ts`) already accepts all three plans, reads the live gate (:120-126), refuses
   a second subscription (:132-148) and starts the trial — but only for an org that already exists (:86-93).
   ⇒ **Step 0 is a product build with new sign-up doors, not a copy pass.**
2. **The flip would not reach most pages.** `/pricing`, `/for-clubs`, `/for-leagues`, `/for-coaches` and
   `/for-tournament-organizers` use no request-time API; `getPlanGatingMap()` (`lib/plan-gating-server.ts:29-51`) reads
   cookies only under the dev toggle, and a plain read on such a route runs once at `next build` (Next 16.3
   `fetch.md:52`). The 2026-08-25 production build prerendered ~250 pages. Not yet proven per page — S1 proves it from a
   build's route table before changing anything. Home and `/start/*` are dynamic (they read the visitor).
   ⇒ Runbook Steps 3 and 4.2 ("the pages now follow the gate") are false until S1 ships.
3. **Existing customers have nowhere to buy.** A free Tournament org's Plan & billing offers only Tournament Plus
   (`lib/plan-upgrade.ts:28-30`; League Plus and Club are discovery cards, `lib/plan-billing-profile.ts:203`); Tournament
   Plus moves only to the Club bands (`lib/plan-move-options.ts:6-12`); a League Plus org can change nothing (:230 of the
   profile); a Founding-comped Tournament Plus org is refused a move (`lib/plan-move.ts:132-137`, no live subscription).
4. **Two in-product readers use the code's copy of the gate:** the house-league cap prompt
   (`components/admin/LeagueCapUpgrade.tsx:37-46` — and it opens the interest form even when "live") and the onboarding
   page's first paint (`app/[orgSlug]/admin/onboarding/page.tsx:279-286`).
5. **~45 typed lines across eight pages**, the runbook's list plus fourteen it missed — full table in
   `CLUB_ON_SALE_COPY.md` (each line: today, closed, open). The ones it missed that matter: a second always-shown
   "Express interest in League Plus or Club" button on `/pricing`; FAQs that say "not through self-serve checkout yet";
   `/for-tournament-organizers`' League Plus cross-sell; `/for-leagues`' Club cross-sell; the home's "in active
   development" (both branches); the plan grid sizes only 2 or 3 cards (`PricingSection.tsx:366`) and will have six.
6. **Premium Coaches Portal:** `PLAN_CONFIG.team.gatingStatus` is `early_access` (`lib/plan-config.ts:68`) while the
   production row has been `live` since 2026-07-24; the comment at :28 ("no other changes required") is wrong. Today the
   code value only matters when the database read fails — then Premium reads as closed.

## Audience review, 2026-11-18 — does each page sell to its buyer?

The first pass above switched the words over. The owner then asked for the whole public surface to be judged by
audience, "and add some more features and ideas to the existing mockup to make our release really sell". This section is
that review. It is not a second project: its accepted parts are stages S3 and S3b below, its words are W58 to W75 in
`CLUB_ON_SALE_COPY.md` (section M), its drawings are in the same artifact, and its asks are 21 to 34.

**How it was done.** Three helper censuses (every public page; what the product does today, with proof; the standing
rulings), the lines each recommendation turns on opened by the review session, then `/marketing`, `/legal`,
`/accounting`, `/strategy` and `/design` on the result.

### The five changes that matter most (ranked by effect on a sign-up)

1. **A league or club buyer cannot see the product before adding a payment method.** A tournament organizer and a coach
   each get a live demo. League Plus and Club have no demo (ruled, for launch) and no marketing page carries a single
   picture. Inside the ruling: the product's own screens on /for-leagues and /for-clubs (W67), and four plain steps on
   what happens to the payment method during the trial (W68).
2. **The Clubs page speaks only to the president about coaches.** The acquisition focus is the club that runs house
   league and rep teams together (`BUSINESS_DECISIONS.md` 2026-06-22). All four "old way" cards and the heading are
   about coaches; the treasurer has one line and the registrar none. New: the club's books in the first sentence (W65),
   two new "old way" cards (W66), and "What each person at your club gets" (W69).
3. **No page answers what a board asks before it spends club money.** Switching mid-season, a change of treasurer,
   families' information, stopping: the page census found none of them answered anywhere. New: "Questions a board asks"
   on both pages and in the pricing FAQ (W70), each answer checked against the product and the published policies.
4. **Group by buyer** (the owner's own point): three bands on /pricing, three doors in the picker and on the home page,
   and the home page sends people on instead of carrying six plan cards (W58 to W62). Two refinements below.
5. **Three live lines describe customers we do not have, and two say "free" over a paid plan** (W72, W73). They are on
   production today and change at the next promote, whatever is decided about the rest.

### Where the review disagrees with the planning session's proposal

- **Not a ladder.** The proposal called League Plus → Club → Club · Association "a clean three-step ladder".
  `BRAND_STRATEGY.md` §7 rules 1 to 3 say League Plus and Club are peers for different organizations, League Plus is not
  a step toward Club, and Club includes house league. The band keeps all three side by side (the buyer is the same: a
  volunteer board) but labels each by what a club runs. Club's label says it includes house league, because the first
  draft's labels would have let the club we aim at first buy League Plus by mistake (`/marketing` and `/strategy` both
  caught it).
- **No price on the home page doors; never the Premium price on the coach door.** The 2026-08-07 ruling keeps prices off
  persona cards, and one of its three reasons is untouched: every coach starts on a free Basic Coaches Portal, so a
  price on that door overstates the cost. Prices sit in three rows in the home page's pricing section instead, which
  that ruling and the 2026-08-08 one allow. Ask 24 offers the one exception worth arguing and recommends against it.
  **⚠ Amended 2026-11-19** (`BUSINESS_DECISIONS.md` "'Coach a team' opens the PAID Premium Coaches Portal sign-up…"): the
  "every coach starts on a free Basic Coaches Portal" reason above no longer holds on a marketing door. "Coach a team"
  opens the paid Premium sign-up; the free portal comes only from registering a team for a tournament. The rule itself
  (no price on the coach door) is unchanged.
- **Three audiences for buying, four for landing.** A house league board and a club board buy from one band but search
  for different things and need different first sentences. /for-leagues and /for-clubs stay two pages and two nav
  entries; only the order follows the bands.
- **Marketing is after the launch by the owner's own ruling** (2026-11-17), and this build is in the launch. So the
  additions are split by rework risk: what S3 rebuilds anyway is built once in its final shape; the selling sections are
  S3b, which does not hold the flip (Ask 30). `/strategy` moved the trial steps into S3: they disclose, they do not
  persuade.
- **No comparison table, no "which plan am I?" quiz, no "Most popular" badge.** The table was removed on 2026-09-07 and
  its fault (rows of plumbing) is unchanged; inside a band the cards are the comparison. Three doors and the band labels
  do the quiz's job in one click. "Most popular" is a statement about customers.

### Each buyer, from landing to starting

| Buyer | Works today | Missing | Biggest lever |
|---|---|---|---|
| Tournament organizer | Free plan, live demo, walkthrough, a page that names the pain | Nothing says League Plus or Club starts from the same account; "Start Tournament Plus free" is not free of a payment method | One line on the cross-sells (W71) |
| House league board | Four real pains, the season in four steps | No picture, no demo; the trial is one sentence; no answer on switching, information or stopping; titled "For house league administrators" | Real screens in the four steps, and the trial steps (W67, W68) |
| Club board | Plain price, both sizes, every coach included | The page is about coaches; no treasurer, no registrar; nothing to take to a board meeting; no picture | "What each person at your club gets" (W69) |
| Coach | Free start, live demo, clear page *(⚠ "free start" struck 2026-11-19: the marketing doors open the paid Premium sign-up, `BUSINESS_DECISIONS.md` 2026-11-19)* | The free portal has no place on /pricing; "Free right now" on the paid card; no way to pass the Clubs page on | The coaches band, and "Copy a link for your club" (W58, W71) |

### The ideas, and the product fact each relies on (found 2026-11-18)

| Idea (words) | For | Page | Relies on | Size | Stage |
|---|---|---|---|---|---|
| Three audience bands (W58, W75) | all | /pricing | the six plans in `lib/plan-config.ts`; ~~the free Basic Coaches Portal~~ *(amended 2026-11-19: not shown on /pricing)* | a section rebuilt | S3 |
| Three-door picker (W59) | all | /pricing | the bands | words | S3 |
| Three doors, three price rows (W60 to W62) | all | home | the four persona pages; prices from config | two sections rebuilt | S3 |
| Nav order, footer column, menu entry (W63) | all | every page | `components/Navbar.tsx:17-23`, `components/Footer.tsx:34-52` (no Leagues or Clubs link today) | words | S3 (footer: S1) |
| Search titles (W64) | league and club boards | three pages | `lib/marketing-metadata.ts:45` appends the site name | words | S1 |
| How the trial works (W68) | league and club boards | /for-leagues, /for-clubs | checkout takes a payment method (`app/api/billing/create-checkout/route.ts:407-435`); the trial-ending email (`lib/billing-webhook-handler.ts:944-973`, `lib/email.ts:1669-1688`); cancelling ends the plan on the trial's last day (`lib/help-content/org.tsx:535`) | a new section | S3 |
| The product's own screens (W67) | league and club boards | /for-leagues, /for-clubs | eight real screens; a fixture club with invented names | a new section + eight pictures | S3b |
| What each person at your club gets (W69) | club board | /for-clubs | roles (`lib/board-roles.ts:72-84`), invite and remove (`app/api/admin/members/`), the board report export (`app/[orgSlug]/admin/accounting/page.tsx:189-284`), public registration, the waitlist and Email families, every coach's portal (`lib/coach-portal-plan.ts:24-29`) | a new section | S3b |
| Questions a board asks (W70) | league and club boards | /for-leagues, /for-clubs, /pricing FAQ | the same, plus "Start from" a past season (`app/api/admin/house-league/seasons/route.ts:76-90`), per-list exports (`lib/export/catalog.ts`), the published Terms and Privacy Policy | a new section | S3b |
| The Clubs page rebalanced (W65, W66) | club board | /for-clubs | none (pain, no promise) | words | S3b |
| Paths between audiences (W71) | organizers, coaches | three pages | buying from inside the product (S4) | words | S3b |
| Truth fixes (W72 to W74) | all | /pricing, /for-coaches, /for-leagues | none | words | S1 |

**Promises the review refused to make**, because the product or the policies do not back them: families paying online
(switched off, `lib/online-payments-switch.ts:21`); a president's summary (not built); bringing an existing house league
season in (no import exists on the club side); "export everything" and "your data is yours" (`LEGAL_FACTS.md`; the
approved line is "download from the lists that offer it, or ask us for a full copy"); information stored in Canada (it is
stored in the United States, and W70 says so); a link to the board pack (not ready to show); any customer count, quote
or logo (nothing has been sold).

**Needs product work — not in this build** (each is in `docs/projects/IDEAS_BACKLOG.md`, section "From the on-sale
pages audience review"): a house league or club demo; bringing an existing house league season in from a spreadsheet; a
demo link that opens on a chosen screen; changing a club's owner without writing to us; one download of everything a
club holds.

## The build — five sessions, by dependency and rework risk

Each session ships with the gates **closed** on production (runbook Step 3), so nothing a visitor sees changes until
the flip. Dev has every plan on sale by design (owner 2026-10-30), so dev shows the open state; the closed state is
walked with a dev-only "show as closed" switch (S1) and proved on production at Step 3.

### S1 — The switch reaches every page (foundation; no visible change while closed)

- Public plan pages read the live gate on every request: `/pricing`, `/for-clubs`, `/for-leagues`, `/for-coaches`,
  `/for-tournament-organizers` (and home, already dynamic). First prove the static claim from a build route table.
  One server helper answers "is this plan open?" for every public page (today each page re-spells
  `!gating[plan]`; `isCoachesPortalPurchasable` is the precedent, `lib/plan-gating-server.ts:53-67`).
- `LeagueCapUpgrade` and the onboarding first paint read the live gate.
- Dev-only: the plan-gates toggle gains "show as closed" so a walk can see both states on dev without touching dev's
  rows (dev's rows stay all-live, the owner's 10-30 ruling).
- Premium's code value → `live`, comment at :28 corrected (Ask 6). No unit test asserts `team`'s value.
- The closed-word canon fixes that sit on lines this build rewrites anyway (`CLUB_ON_SALE_COPY.md` W56 table), the
  "bring your team in" closed wording on the five pages that carry it (W22, `/legal`), and the interest form's consent
  box opening unticked (`/legal`).
- **Added by the audience review (2026-11-18), all wrong or missing today, so they ride the same promote:** the three
  pricing answers that describe customers we do not have (W72); "Free right now" off the Premium card and "Start
  Tournament Plus" without "free" (W73, Ask 31 — what the page then says about Tournament Plus's trial waits on that
  ask); "8:00 a.m." (W74); the footer's "Built for" column (W63); the search titles (W64).
- **Screens:** `/pricing`, `/for-clubs`, `/for-leagues`, `/for-coaches`, `/for-tournament-organizers`, home,
  onboarding plan step (first paint), house-league home + season page (cap prompt), the footer.
- **Risk:** low (closed output unchanged apart from the listed word fixes). **Gate before S2:** the build route table shows the five pages dynamic.
- **Built 2026-11-18** (prompt `CLUB_ON_SALE_S1_BUILD_PROMPT.md`; walk `CLUB_ON_SALE_S1_WALK.html`, Owner QA Ledger §
  "On-sale pages S1"). Committed `4ded7e325` 2026-11-19 (owner's yes). Proved before building: production
  served all five pages with `x-nextjs-prerender: 1` and `s-maxage=31536000`, and a production-style build marked all
  five `○` (home and `/start/*` `ƒ`). The fix is one line in the one reader: `getPlanGatingMap()` calls `connection()`,
  so every route that reads the gate renders per request. Pages ask `isPlanOpen()`; dev's "show as closed" is the
  `dev_plan_gates=closed` cookie. Part 0 records: `/strategy` (Decided entries + Facts trial lines and truth-up),
  `/marketing` (canon S1 lines + Tournament Plus's sentence), `/billing` (production gives Tournament Plus 14 days, no
  override rows). Choices the build made inside ruled lines: the copy doc's S1 table, "In code".

### S2 — The doors: a real Club start and a League Plus start (highest risk: accounts + money)

- `/start/club`, when Club or Club · Association is open: the Run a tournament pattern — step 1 account
  (`StartDoorForm`), step 2 the club's name, step 3 a plan step offering **Club** and **Club · Association** side by
  side (preselected from the pricing card's pick), then the billing address (the shipped first-time-setup **screen**,
  `app/[orgSlug]/admin/onboarding/AddressStep.tsx`, the second half of step 3 by the 2026-11-04 ruling, so the step line
  stays three labels with Plan current; drawn on tabs 6 and 7 since 2026-11-18, after the owner noticed the first
  drawings only named it) and Stripe's payment page via the existing checkout; back into the club setup kit (`onboarding/page.tsx:253`). Closed: today's page
  with canon words.
- `/start/league`, when League Plus is open: the same, one card. With League Plus closed it is the interest form.
  **⚰ 2026-11-19: the free League is removed** (`FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md` Stage 1) — there is no `LEAGUE_STARTER_BETA` start any more; `/start/league` is League Plus while it is on sale, else the interest form.
- A new start door (`club`, `league_plus` — names in the build) in `lib/start-door.ts`: the pick rides on the account
  like G4's; the door creates the org on `tournament` with **no Founding comp** (Ask 14); the waiting-workspace card on
  Home ("Name your club").
- **The return trip (`/billing` trap A, verified):** Stripe returns to `onboarding?success=1` before the webhook writes
  `plan_id` (`lib/billing-webhook-handler.ts:585-600`); the page still reads `tournament`, so `planSelectionSucceeded`
  opens the New tournament window (`onboarding/page.tsx:440-455`) and `ClubSetupKit` mounts only once the plan is a
  club plan (:253). The doors return to a "Setting up your club / league" wait that polls the plan — the Premium-in-place
  `ClubUpgradeSetup` + `/api/billing/club-upgrade-status` pattern, with a plain-org status read (it is keyed to a
  workspace today).
- **Abandoned checkout:** the org stays free Tournament, and today the club buyer never sees Club again (cancel →
  onboarding → `choosePlan=1` → a Tournament-only plan step). The intended plan is kept on the org's onboarding state
  (`startup_tasks`, not `user_metadata.start`, which steers screens only, `lib/start-door.ts:9-13`), so a resume shows
  the Club / League Plus plan step; S4 also gives the free org a Club row on Plan & billing.
- **The true trial before checkout (trap B):** one trial per Stripe customer (`hadSubscriptionBefore`,
  create-checkout ~:412). A brand-new org has no customer, so a new door always gets the trial; the plan step still shows
  the server's trial-or-not line (`previewClubCheckout`, `lib/workspace-upgrade-preview.ts:32`) rather than the code value.
- **Québec and the US before the org is made (trap C):** the door says so on step 1 (Ask 15), because a held address
  is otherwise refused only after the org exists.
- **Who the doors refuse (trap D):** a signed-in owner of any real org goes to that org's Plan & billing; a signed-in
  Coaches Portal coach goes to the in-place "Start your club" (`userBelongsToOtherRealOrg` exempts a portal, so the
  door would otherwise make a second org and strand the team).
- Doors: reuse the existing `league` door for League Plus and add one `club` door (no fourth). The `LEAGUE_STARTER_BETA`
  readers that would hide them (`lib/start-menu.ts:58`, `start/page.tsx:133`, `app/api/consumer/home/route.ts:136`)
  read the plan gate for the League Plus start; the flag keeps governing only the free floor. **⚰ 2026-11-19: the free League is removed** (`FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md` Stage 1) — there is no `LEAGUE_STARTER_BETA` start any more; `/start/league` is League Plus while it is on sale, else the interest form.
- `/start` chooser: Club and League cards appear when their plan is open.
- Pricing cards' buttons go to these doors (open) — the G6 guard test (`first-look-stage3.test.ts:25-36`) is rewritten
  to "every open org plan's card points at a door that sells it", reading the live gate, not the code value.
- Signed in with an organization already: the button lands on that org's Plan & billing (`ViewerAwarePlans` already
  does this for operators, `app/pricing/ViewerAwarePlans.tsx:91-103`) — the one-org guard holds.
- **Screens:** `/start`, `/start/club`, `/start/league`, the account step, the name step, the plan step (new variant),
  the billing address screen, the payment return, Home's waiting card.
- **Reviews:** `/review` high-risk tier (money, accounts, terms acceptance); `/legal` on the plan step's promises.
- **Built 2026-11-19** (prompt `CLUB_ON_SALE_S2_BUILD_PROMPT.md`; walk `CLUB_ON_SALE_S2_WALK.html`, Owner QA Ledger §545). Committed
  `d21eade14` 2026-11-19, with the simplify + docs pass below (walk §545 owed). What the build found and decided, against the plan above:
  - **`startup_tasks` does not exist** on either database (mig 026 was never applied; the code ignores the missing column, which
    is also why a cancelled checkout opened New tournament). The intended plan lives in a new column instead,
    **`organizations.start_plan`** (mig 508, owner ruling 2026-11-19 "New field on the organization"), written by
    `/api/org/create`'s new `startPlan`, read by `lib/start-plan-server.ts`, cleared by the webhook when a paid plan lands. Applied
    to dev 2026-11-19; **production must have it before the promote** (runbook Step 3).
  - **`previewClubCheckout` cannot serve trap B** (it takes only the two Club bands and only runs on the Premium→Club path). The
    plan step reads `/api/billing/start-plan`, and checkout and the step share one rule, `trialDaysAfterHistory` (lib/start-door.ts).
  - **The Terms are already live in dev's code** (`LEGAL_PAGES_PUBLISHED` true since 2026-11-17, `e5be7d3b5`; production until
    that promote reads false). "Fail visibly" is four layers (`/legal` S2 review): checkout refuses the three plans on a live key
    while the legal pages are off (`legal_pages_unpublished`); the census tests list the new routes; a guard fails the build if the
    switch is off while the doors exist; the flip runbook's new Step 3b.
  - **League door:** `/start/league` sells League Plus while it is on sale; the free League starter shows only while League Plus
    is closed and `LEAGUE_STARTER_BETA` is on (so on dev it is reached with "show as closed"). **⚰ 2026-11-19: the free League is removed** (`FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md` Stage 1) — there is no `LEAGUE_STARTER_BETA` start any more; `/start/league` is League Plus while it is on sale, else the interest form.
  - **Trap D:** an owner of a real organization goes to that organization's own plan step if a paid door made it and it is still
    free, else to its Plan & billing; a member who is not an owner goes to their usual landing; a Premium coach (Start a club only)
    to their portal's Plan & billing. `/api/org/create` enforces the organization and portal halves itself.
  - **The wait** reuses the Coaches Portal return's card (`StartPlanSetup`), keyed on Stripe's session id
    (`?setup=1&door=…&session_id={CHECKOUT_SESSION_ID}`); backing out of Stripe returns to `?choosePlan=1`.
  - **Proved on dev in Stripe test mode** (a probe, 2026-11-19): Club, Club · Association and League Plus purchases end to end
    (plan, trialing, 90/90/30-day trials, prices, an acceptance row each), the back-out and the sign-in resume, Québec stopped before
    Stripe, both signed-in owners, the closed state, and the wait forced to show (dev's deployed webhook usually lands the plan
    before the browser returns). All throwaway accounts, organizations and Stripe customers deleted, proved by search. **Not
    proved:** the Premium-coach redirect (no fixture coach outside a club) — walk step G3.
  - **Reviews:** `/billing` (Part 0), `/legal` (`docs/agents/legal/ON_SALE_PAGES_S2_REVIEW.md`), `/accounting`
    (`docs/agents/accounting/START_DOORS_CHECKOUT_REVIEW.md`: no change to what is charged or recorded; the no-second-trial line
    gained "plus applicable taxes"), `/review` high-risk (four lenses; seven confirmed findings fixed, six recorded in the walk's
    call C5 and below), `/design` on the screens.
  - **Recorded, not fixed:** two tabs naming a club at once can make two organizations (Run a tournament has the same gap);
    `/api/billing/move` has no Terms-off refusal (dead today; S4's path); a hung plan-step read stays blank; a reopened Founding
    window would let a door organization pick Tournament Plus free; `getPlanGatingMap` is read several times per request.
  - **Simplify + docs pass 2026-11-19** (prompt `CLUB_ON_SALE_S2_SIMPLIFY_DOCS_PROMPT.md`), nothing a visitor sees changed:
    the two paid-door forms became one (`StartPaidDoorForm.tsx`; `StartClubForm` / `StartLeaguePlusForm` deleted);
    `StartDoorForm`'s per-door maps folded into one `DOOR_COPY` entry per door (`account`, `signup`, `pick`); the two plan
    steps share `PlanStepParts.tsx` (start button, Compare every plan); `PAID_DOOR_STEPS`, `openPaidDoorPlans`,
    `isCompletedCheckoutOf`, `planTermsTrial` and `isLeagueDoorOpen` (start menu + Home's card) each hold a rule written
    twice before; the plan step's offer reads the gate, the trial overrides (once) and Stripe's history together; the
    paid plan step's "Go to Home" is a `Link` (lint). `/review` re-review of the changed hunks: equivalent, no finding.
    Help (true in both gate states, not gated): org "How to set up your club" (the Start a club steps, the wait, the
    back-out), Club plan & billing (address step, the plan step's trial line), house-league Plans and limits (the
    League Plus start, conditional on it being open), coaches' Plan & billing FAQ (a Premium coach on Start a club is
    sent to Start your club), staff Plans & pricing (gating opens the start pages). Walk §545 steps A1 and I3 re-worded
    to the no-Free/Paid-pill ruling another session applied to `/start` the same day (republished v2); that session's
    page change also broke `on-sale-doors-s2.test.ts`'s pill count, updated here. **Listed, not done:** a request-scoped
    cache for `getPlanGatingMap` (shared, outside S2); one Stripe-return session reader shared with the Coach Premium
    return; one poll interval shared by the three setup waits; the wait not blocking on the offer read when `?door=` is
    present (a visible speed-up); a shared helper for the two door pages' signed-in branch (the S2 page tests stub
    `start-plan-server` by name).

### S3 — The pages' open state (depends on S1 + S2 + the words ruled)

- Plan cards (`PricingSection`): add `club_large` to `RENDERED_PLAN_KEYS` (and `new-plan-checklist.test.ts`); the
  Club · Association card; League Plus trial-and-payment sentence; tax line on the three open prices; buttons to the
  S2 doors; the trial sentence reads the length checkout will use (Ask 9 / billing Q6).
- **The grid for six cards — ~~two rows of three, "Tournaments and leagues" / "Clubs and coaches" (Ask 4)~~ superseded
  2026-11-18 by three audience bands (W58, Ask 21):** those rows grouped by price, and a league board and a club board
  are the same buyer. Running a tournament (Tournament, Tournament Plus) · Running a league or a club (League Plus, Club,
  Club · Association, each under a label that says what a club runs) · Coaching one team (the free Basic Coaches Portal
  beside Premium, one full-width band; **⚠ amended 2026-11-19: Premium only, no Basic strip**). Each band reads the gate and shows only open plans; band 2 does not render until
  one of its plans is open; a closed plan stays in the strip. With both open, the League Plus and Club bridge cards
  under the grid are removed (W75). `/pricing` only: the home page stops rendering the grid when all three are open.
- The role picker on `/pricing`: three doors when all three plans are open, each jumping to its band (W59); the
  four-door picker while one is closed.
- Home: three audience doors (W60), all four roles as full cards (W40), three price rows in place of the grid (W61),
  the hero's two buttons with two destinations (W62). No price on a door (the 2026-08-07 ruling; Ask 24).
- The public nav in the bands' order, and "Start a club" in the Get started menu (W63).
- "How the trial works" under the plan cards on `/for-clubs` and `/for-leagues` (W68, Ask 27): a disclosure, so it is
  here and not in S3b. No trial length is typed in it. Before it ships: confirm production receives Stripe's
  "trial ending" signal (`docs/agents/ops/stripe-setup-guide.md:223`; `scripts/audit-stripe-billing.mjs:78`), because the
  section promises that email.
- `/pricing`, home, `/for-clubs` (incl. the demo block, Ask 11), `/for-leagues`, `/for-tournament-organizers`: every
  line in `CLUB_ON_SALE_COPY.md` switches on the gate.
- The interest form follows the gate (Ask 5): offered only for a closed plan; with all three open it appears on no
  public page; its own closed-state words fixed.
- **⚖ One place for the status pill (owner 2026-11-19).** Today the same pill sits in four places: above the name on
  the `/pricing` plan cards, under the price on the `/for-clubs` and `/for-leagues` plan cards, top-right on the home
  doors, top-left above the title on the home role cards. Nobody chose that; each page placed it itself. **Rule: the
  status pill sits on the card's first line, on the right when the card has a small label on the left** (the home doors
  already do this). Every card S3 rebuilds follows it, open and closed. Check the drawings against this rule BEFORE
  building, and correct a drawing that breaks it rather than building it as drawn.
- **League Plus's closed words (owner 2026-11-19, words through `/marketing`).** "Not open yet" and "built, but not open
  for sign-up… the clearest signal we have for when to open it" came from 2026-09-28, when League Plus was parked with
  no release. Since 2026-11-06 (`BUSINESS_DECISIONS.md`) it goes on sale WITH Club, so that reason is gone. Until the
  flip, League Plus says what Club says ("Coming soon"); `/marketing` writes its closed sentence. The tag helper, its
  tests and the strip's group-tag rule (W6) simplify with it, since both plans then wear one word.
- **Screens:** `/pricing`, home, `/for-clubs`, `/for-leagues`, `/for-tournament-organizers`, `/for-coaches` (Club line
  only), the interest form, the public nav and the Get started menu.

### S3b — The selling sections (depends on S3 for the pages' shape; does NOT hold the flip)

Added by the audience review. By the owner's 2026-11-17 ruling marketing is after the launch, so nothing here is a flip
prerequisite: it can ship closed-safe before the flip, or after it. Every section is true in both states unless marked.

- `/for-clubs`: the heading's "org" becomes "club" and the sub-line names the club's books (W65); the four "old way"
  cards rebalanced toward the treasurer and registrar (W66); a new section "What each person at your club gets" after
  the modules (W69).
- `/for-leagues` and `/for-clubs`: one picture of the real screen in each of the four steps / four modules (W67). The
  pictures are shot from a fixture club built for the purpose with invented names (never the live demo clubs, never a
  production row), by a capture script kept with the build so `/demos` can re-shoot them each release cycle.
  - **⚖ Owner, 2026-11-19: before any picture is built, show him BOTH options side by side and he chooses** — (A) real
    screenshots of the product, (B) drawn pictures of the same screens. His reason: our screenshots have historically
- **Built 2026-11-20** (prompt `CLUB_ON_SALE_S3_BUILD_PROMPT.md`; walk `CLUB_ON_SALE_S3_WALK.html`,
  https://claude.ai/artifact/9aVyHMby5sGfy4G5Hug8WS, Owner QA Ledger §550). **Committed `1f3bdb41b` 2026-11-20** (owner's "commit"); walk §550 owed.
  - **Part 0:** `/marketing` wrote League Plus's closed words ("Coming soon"; "League Plus is coming soon — it isn't open for
    sign-up yet."; both closed: "Club and League Plus are coming soon."), now one tag for every closed plan, so the strip's
    per-plan status went (W6 simplified). `/strategy`: the Facts truth-up was already done in S1 (`4ded7e325`). `/billing`:
    production's live webhook endpoint receives `customer.subscription.trial_will_end` (read-only API check 2026-11-20) and the
    handler emails every active owner with the date, so "How the trial works" ships.
  - **The open layouts switch on all three** (`allProgramPlansOpen`: League Plus, Club, Club · Association, each its own gate);
    band 2 on any one (`anyProgramPlanOpen`). While all three are closed every page renders S1's closed state (the guard test
    renders each page in both states and in a partial flip). Club leads `/pricing` once Club is open (Ask 32 B). The trial
    sentence everywhere reads the length checkout will use (`getPlanConfigOverrides()`); at 0 days no sentence, no "trial"
    button (`/accounting`). The in-product onboarding chooser keeps its four cards (S4's).
  - **Choices inside ruled lines** (walk call C2): band-2 labels on the card's first line (pill rule); the coaches band line
    "The Premium Coaches Portal is for the head coach running a competitive team's whole season."; team counts say "with a
    Premium Coaches Portal" (2026-11-19 rule; `/marketing`); Club · Association's "every team type counted the same" replaced
    by the portal line; "Available in Canada, outside Québec for now." without "organizations" on `/pricing` and home (`/legal`:
    a coach buys there as a person); home role cards split into label left, pill right (`/design`).
  - **`/legal` must-fix applied:** League Plus can change to no other plan (no `MOVES` row), so "Upgrade or downgrade at any
    time" leaves the open pages and the change-plans answer says only the moves the product makes. **Owner call C1:** build a
    League Plus → Club move (to `/plan`). `/legal` notes: step 2 "Your whole plan is on from the first day" holds only if nothing
    in the plans is switched off at the flip (call C3). Reviews: `docs/agents/legal/ON_SALE_PAGES_S3_REVIEW.md`,
    `docs/agents/accounting/ON_SALE_PAGES_S3_REVIEW.md`, `/design` (screenshots `.probe/s3-design/`), `/review` standard (three
    partial-flip contradictions on `/pricing` fixed; the nav reads the gate only on the pages that already do).
  - **Not changed:** `/for-coaches` (its Club links read true in both states; the bring-in promise stays held, Ask 13). The
    `/pricing` "what they cover" section shows only while League Plus and Club are both closed; Club · Association has no
    closed line of its own if it alone stays closed (call C4; they open together).
  - **Checks:** the plan-page tests (99) pass; `check:layout --only` the six marketing screens at 320–1440 passes (`--changed`
    widened to a whole-product sweep through another session's shared CSS, so it was not run). The full test run's 32 other
    failures are other sessions' work in the tree. Drawings corrected to v4 locally (republish = call C5).
    looked much worse than the drawings, and if the drawings look much better he will go that route. (His point is that
    the drawings look better than our SCREENSHOTS of the product, not better than the product.) The comparison must
    be fair to both: (A) is the product captured at its best (tight crop on the part that sells, 2× pixels, a fixture
    with realistic data, no browser chrome, phone shots where the screen reads better narrow), not a full-page grab;
    (B) is drawn FROM the real screen (same layout, same words, same controls; cleaner, never a feature the product lacks).
    Same eight screens, both options, at true size on the page they will sit in.
  - **Refresh on a schedule, either way (owner 2026-11-19):** the pictures are rotated quarterly or twice a year to keep
    the pages fresh, whether or not the screens changed, so both options carry the same periodic job. The cadence is
    decided at S3b. The one difference left: between refreshes, a screen that changes is caught by re-running the
    screenshot script, while a drawing needs someone to notice. W67's caption ("These are the product's own screens…")
    fits (A); (B) needs its own wording and a `/legal` read.
- `/for-leagues`, `/for-clubs`: "Questions a board asks" before the bottom call to action (W70); its first four answers
  also join the `/pricing` FAQ, which is grouped under three small headings. Answer 6 (a year's cost) shows only while
  the plan is open. **Ships only with the Terms and Privacy Policy live on production** (the answer links to it), and
  with the data terms published or the by-hand "full copy" procedure confirmed (Ask 29).
- The paths between audiences (W71): one line on `/for-tournament-organizers`' two cross-sells (true once S4 ships, so
  it ships with or after S4); "Copy a link for your club" on `/for-coaches`; one line under the coach demo on `/demos`.
- **Screens:** `/for-clubs`, `/for-leagues`, `/pricing` (FAQ), `/for-tournament-organizers`, `/for-coaches`, `/demos`.
- **Reviews:** `/legal` on W70 as built; `/design` on the pictures in place; `/docs` not needed (no product flow changes).

### S4 — Buying from inside the product (depends on S1; after S3 because both touch the plan cards)

- Plan & billing for a free Tournament org: start Club, Club · Association or League Plus (checkout) when open —
  today `upgradePlansFor('tournament')` is Tournament Plus only (`lib/plan-upgrade.ts:28-30`), `PANEL_PLANS` lacks
  `club_large`, and only Premium's discovery card has a button (`BillingBody.tsx:509`). This is also the
  - **Part 0 built 2026-11-20 (the comparison; owner's three calls open: A or B, the cadence, B's caption).** The fixture
    is **Kestrel Bay Softball Association** (`kestrel-bay`, dev only, invented names, addresses on reserved test domains,
    no medical notes): `seed-prospect-demo.mjs --club=kestrel` (the Milton machinery now takes a pinned club config,
    `on-sale-pictures.kestrel.config.mjs`), then `seed-on-sale-pictures-extras.mjs` (a tournament with two games live at
    capture time, a rep team's roster, a year of club books), then `capture-on-sale-pictures.mjs` (its own guard: dev
    server, dev project, `/kestrel-bay/` only, the fixture's marker; one-time-link sign-in, no password kept; 16:10 crops
    at 2×; refuses a "Loading" screen). Comparison Artifact: https://claude.ai/artifact/EqmU4jxPS6epwohkC6KRog.
    **Findings for the build:** no screen shows "the schedule beside the standings" (W67 03 / the drawing), so 03 is the
    public standings page; the two registrations pictures use two views (To review on `/for-leagues`, Accepted on
    `/for-clubs`); the event page is shot at desk width; every house-league screen (admin and public) opens on the
    youngest age group even when it has no games (route to `/plan`, not S3b); the extras seed leaves the previous
    roster's 13 children and their guardians behind on each re-run (fix in the build).
  abandoned-checkout resume.
- The plan panel drawer passes monthly only (`PlanPanelDrawer` ~:105): add the monthly / yearly choice.
- The moves ruled in Ask 12 (recommended at launch: paying Tournament Plus → League Plus, one `MOVES` entry; League
  Plus → Club after launch — nobody holds League Plus at launch). ~~A Founding-comped Tournament Plus org → Club…~~
  **STRUCK 2026-11-19:** the Founding Season is removed before S4 (`FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md` Stage 2);
  its three holders are then ordinary free-time accounts, so S4 handles them as a free-time org moving to Club (check
  that move's words then; do not build a Founding-specific sentence).
- ~~The house-league cap prompt reads the live gate and, when open, opens Plan & billing's League Plus panel
  (`?plan=league`)…~~ **STRUCK 2026-11-19: handled by the free League removal** (`FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md`
  Stage 1 deletes the free floor, its caps and the cap prompt; the count settled it: 0 production orgs ever held it).
- ~~**Clear `free_floor` when a paid League Plus or Club plan applies** (`/billing` Q4)…~~ **STRUCK 2026-11-19: handled by
  the same Stage 1** (the column and the caps are removed, so nothing is left to clear).
- A closed plan's row in Plan & billing keeps its contact link (an existing customer writes to us; the interest form is
  for prospects — `/billing` Q7). It already reads the live gate (`BillingBody.tsx:185, 486-487`); the rows must exist.
- **Screens:** Plan & billing (free Tournament, Tournament Plus, League Plus, a free-time org), the plan move window,
  the onboarding change-plan window. (The house-league cap prompt and the Founding-comped state are gone with the
  removal, 2026-11-19.)
- **Reviews:** `/review` high-risk; `/accounting` (what we charge on a move).

### After the build (runbook, not this plan)

Step 1 sandbox purchases with S1–S4 on staging; Step 2 live Stripe; Step 3 promote with gates closed and check
production shows today's pages; Step 4 the flip; Step 4.3 the three code values → `live` and the agreement check
(`/billing`, its own commit, on the owner's word — it is a database check, AGENCY_RULES).

## Sequencing against other builds

- **⚖ The free League + Founding removal goes BEFORE S3 (owner 2026-11-19).** Separate project
  (`FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md`), sequenced here: removal Stage 1 (free League) → Stage 2a (Founding
  holders to free time) → Stage 2b (Founding code) → **then S3, S3b, S4**. Reason: S3 rebuilds the very pages Founding
  still sits on (`/pricing` FAQ, home, `/for-tournament-organizers`, `/for-coaches`), and S4 carried three items that
  exist only because of the free floor and Founding (struck above). Built in the other order, S3/S4 would build and walk
  states that are then deleted. The flip does not move: it waits on live Stripe and the test purchase either way.

- **Touches the same screens as:** Plan & billing (the billing body, the plan move window — `plan-billing` project);
  the first look (start doors, plan step); the GST/HST tax line (`BILLING_TAX_WORDS`). S4 must not overlap a Plan &
  billing build session.
- **Waits on nothing to start S1.** Tax at checkout is already on production (GST/HST Stage 2 closeout `e303868f4`,
  tag `release/2026-11-15`; live Stripe holds one active Canada registration, exclusive — `/accounting` 2026-11-18), so
  Facts :43-44 is met and the tax line can follow the gate. The *flip* (not this build) still waits on live Stripe
  (runbook Step 2), the ~$1 live purchase with an Ontario address and a printed-invoice check (`/accounting`: a hard
  prerequisite — no printed live invoice has been seen), and the Club test suite. ⚠ The board's `gst-hst` "next" line
  still says tax ships with the next release — stale (for `/brief`).

## Reviews run in the planning session

- **`/billing` (2026-11-18):** the shape is sound; create the org first, not Premium-style (a club needs a name, slug
  and owner before its setup kit; provisioning from webhook metadata after the charge adds a name collision and a
  signed-out buyer). S4 is not optional. Traps A–D folded into S2 above; the free-floor trap into S4. Premium's code
  value → `live` in S1 is a truth-up: the database wins everywhere, and the code value is read only when the gate read
  fails or the gate has no rows (then Premium shows closed and its checkout 403s), and at first paint (`usePlanGating`,
  `PlanPanelDrawer:97`, onboarding :279-285). The three new plans stay `early_access` in code until after the flip
  (fail closed). The trial sentences should read the override (`getPlanConfigOverrides()` server-side; the public text
  reads the code value at `PricingSection.tsx:144,519`, `BillingBody.tsx:352`, `PlanArticlePanel.tsx:181`,
  `AddressStep:67`, `PlanStep:100`). Confirm `NEXT_PUBLIC_PLAN_GATES` is unset in the production build. Unit tests must
  mock both gate states — dev cannot show the closed state. Sandbox matrix additions: Tournament Plus → League Plus,
  comped Tournament Plus → Club by checkout, returning buyer (no trial), Québec refusal, the webhook-delay return.
- **`/accounting` (2026-11-18):** "plus applicable taxes" beside each price is right; the trial sentence must carry the
  tax too (tax is worked out on the address on file at the trial's end — Stage 2 test clock, `GST_HST_STAGE2_BUILD_PROMPT.md:323, :494`).
  Tax is already on production (see Sequencing). Recommends one public line: available to organizations in Canada,
  outside Québec for now, prices in Canadian dollars (Ask 15). $0 trial invoice: nothing to build. For a professional
  (no gate): the pending CRA backdate; a club left at a Québec address renewing at GST only.
- **`/marketing` (2026-11-18):** `CLUB_ON_SALE_COPY.md`, W1–W57, each line closed / open / "closed also changes";
  eleven asks of its own (folded into Asks 7, 10–14 below). The League Plus trial sentence is Club's in shape with its
  own length (`clubTrialLine(trialDays)` takes the length already; a plan-neutral name in the build). Handoffs:
  `/strategy` records League Plus's trial in the Facts doc and the over-30 quote path; `/marketing` writes accepted
  lines into `PRICING_PAGE_COPY.md` (and fixes its stale ~:378 and the $179 Club tables).
- **`/legal` (2026-11-18):** trial sentence option (b) (tax in the sentence — Competition Act general impression; the
  sentence also runs where no price sits beside it; matches Terms §7). **Hard prerequisite of the flip:** the Terms and
  Privacy live on production — with them off, `requireAcceptance` passes (`lib/legal-acceptance.ts:184-185`, verified),
  so production would take paid sign-ups with no tick and no record; the first test purchase must write an acceptance
  row. The interest form's consent box opens ticked (`components/EarlyAccessForm.tsx:44`, verified) — doubtful express
  consent: make it unticked (S1), and email only ticked leads from the last six months (implied consent, CASL
  s.10(10)(e)), never unticked ones; the email needs a mailing address we do not yet have. "Bring your team in with
  everything you've built" is a misrepresentation risk today (five pages) — fix the closed words at the next promote.
  Add the price and tax to the trial-ending email (`lib/email.ts:1669-1688`). Verify before the words ship: "Premium
  Coaches Portal for every coach, no per-team fee" (Facts :116 says decided, not built); the band move's proration
  words (W17, W20); soften W19's "every setup step". Lawyer's eye (no gate): card-on-file trial wording, Québec
  French-language rules, the pre-ticked box, Terms §7's "free trial".
- **`/design` (2026-11-18, 527 decisions on record):** nine drawing changes, applied and republished (v2) — the 420px
  start column, 32px headings, 48px fields and buttons with 10px corners (first-run rules 1–2, 2026-10-20); one lime
  per view on /for-clubs; the wait screen as the shipped checkout-complete card (no button, "Payment received. This
  takes a few seconds.", "Still setting up" + Check again after ~50 s); the "Paid plan" pill in the Free pills' olive
  tint; 12px eyebrows; NEW / CHANGED WORDS / UNCHANGED tags on every drawn card; the View switch as one white track;
  markers as edge tabs; Fit to width on screens narrower than a 1440 page plus its notes. Two `/design` source files
  named by the command no longer exist (`memory/design_system.md`, `memory/design_principles.md`) — `/design`'s
  command file is shared automation, flagged, not edited.

### Reviews run on the audience review (2026-11-18, section M of the copy doc)

- **`/marketing`:** corrected the band-2 line and labels (the first draft implied Club lacks house league, against
  `BRAND_STRATEGY.md` rule 3, and used "organization", which is our word and not a volunteer's); "Basic Coaches Portal"
  on the coaches band; "Built for" as the footer heading; titles cut to fit the site-name suffix; the Clubs sub-line
  softened so it does not promise a president's summary; "with nothing charged" removed from the trial steps (too close
  to the rejected "nothing is charged until the trial ends"); "What each person at your club gets" (coaches are not on a
  board); "one tap" removed from the phone-install line. Agrees there is no price on any home door and recommends
  against Ask 24's exception. Its canon handoffs are in the copy doc.
- **`/legal`:** the privacy answer narrowed to "your club's information" and "FieldLogicHQ never shows a player's name,
  birth date or roster on a public page" (checked page by page: club team pages, tournament pages and house league
  schedule and standings pages carry no players; a club can still type a child's name into its own news post, which the
  Terms make the club's responsibility); the United States storage sentence stays; the cancel answer gains the 90 days
  and "no refund" from the published Terms; "ask us for a full copy" needs the data terms published or the by-hand
  procedure confirmed; the trial steps gain "first paid plan" and "renews until you cancel", and their email promise
  needs production confirmed; the owner change must come from the current owner's address; pictures only from a fixture
  with invented names. Rates W72 the most urgent item and "Free right now" high risk. For a lawyer's eye (no gate): the
  general impression of the trial steps and the "free" labels; whether a share-link button could count as helping send a
  commercial message (read as no); "never shows" against club-typed text; quoting cross-border storage in marketing;
  the "full copy" promise ahead of the published data terms; French-language rules for pages reachable from Québec.
- **`/accounting`:** one tax line under the three home price rows is acceptable (the canon's block sentence), inside the
  same container, built from the tax words, shown only when all three plans are open; W70's year-cost answer and W68's
  step 4 are right. The trial sentence in code still lacks the tax words the drawings show (Ask 8 covers it).
- **`/strategy` (Proposed, nothing logged):** the proposals mostly reverse the ordering half of the 2026-08-08 "live
  products lead, everywhere" ruling (design log), whose reason ends when all six plans are on sale; its other half, that
  no surface hand-writes availability, must stay, and the bands do read the gate. Consistent with "the plan cards are
  the comparison" (2026-09-07) and the peer rule once Club's label says it includes house league. Pushed the trial steps
  into S3 (a disclosure). No "Most popular" words. Raised Ask 32 (which card leads) and the Tournament Plus trial
  (Ask 31). Drift found is in "Found outside this build".
- **`/design` (fourteen findings, applied and republished as version 3):** the drawn sections were about a quarter too
  large and off the shipped kit, so headings are 32px, card titles 20px, cards 14px corners with the shipped shadow and
  24px padding, sections 72px; the footer is the shipped footer (paper ground, twelve columns, the "Also on your phone"
  column kept beside the new "Built for" column, the copyright row); the FAQ and "Questions a board asks" are the
  shipped accordion, changed answers open; the trial steps are a numbered row, not four boxes; one tag system; rail
  notes anchored to what they describe; the phone pages show the fixed bottom bar; 44px tap rows. Left as owner calls
  (Ask 34). Three of the command's source files do not exist (`memory/design_system.md`, `memory/design_principles.md`,
  `memory/project_milton_bats_palette.md`): shared automation, flagged, not edited.

## Found outside this build (flagged, not acted on)

- **The Facts doc says three shipped things are "not built"** (audience review, 2026-11-18; `/strategy` drift check).
  `PLAN_PRICING_FACTS.md` ~:137-139 and :185 (bank reconciliation), :182 (a club's own web address) and :116 (whole-staff
  Premium portals; :176 of the same file says live since 2026-06-24) each say decided, not built. The product has all
  three, and the Clubs page and the Club plan card already advertise the first and third. :117 (the coach-into-Club move
  "not released") looks stale too. → `/strategy` truth-up before the open words ship; the board's `bank-check` line
  ("one release carrying the balance check") → `/brief` to check against the 2026-11-15 release.
- **Only five clubs can connect their own web address today.** The host's limit is 5 addresses per app with 2 used
  (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` :1321-1322, :1357; a request for 500 filed 2026-10-23, still open when last
  read). Under an open launch that is a limit a fourth club would hit. No page in this build promises the feature; it
  is listed here because no document carries it as an owner item. → `/release` to check the request before the flip.
- **Tournament Plus has a 14-day trial nobody ruled on.** The plan settings give it one, checkout applies it and takes a
  payment method, the copy canon says Tournament Plus advertises no trial, and two live buttons say "free" (Ask 31).
  → `/strategy` and `/billing`: say it or switch it off.
- **Production still offers the Founding Season.** Signed out on 2026-11-18, production `/pricing` shows "through
  September 30, 2027" twelve times and `/start` (dynamic) shows "2027 season free", though the offer closed 2026-10-26
  and the closing commit `954508360` is on `origin/master`. `/start` is rendered per request, so it is not a stale
  page; most likely a production `NEXT_PUBLIC_FOUNDING_SEASON_SIGNUP_CLOSE` still holds the old date. → `/release`, a
  check (not a fix).
- The board's `gst-hst` "next" line still says tax ships with the next release (it shipped 2026-11-15) → `/brief`.

## Owner asks

**⚖ RULED 2026-11-18 (owner): every live ask as recommended.** His words: "I agree with all 33 recommendations" (34
numbers below; Ask 4 was replaced by Ask 21, so 33 live asks). Nothing was added to a recommendation and nothing was
changed. Where an ask offered options, the recommended one is the ruling:

- **Ask 8:** (b), the tax inside the trial sentence, for all three plans, with the tax line still under each price; the
  price and tax join the trial-ending email.
- **Ask 13:** "bring your team in with everything you've built" changes at the next promote to "you won't be charged for
  the portal again", and returns only once the coach-into-Club move is on production and proved.
- **Ask 18:** Premium's code value becomes "live" in S1; the production-and-code agreement check stays a hand read in the
  release steps (making it automatic was not ruled).
- **Ask 19:** `/release` checks why production still shows the Founding Season offer (a check, not a fix).
- **Ask 24:** A. No price on any home page door; prices sit in the three rows lower on the page.
- **Ask 27:** "How the trial works" ships in S3; the copy rule on trial length names the section; production is confirmed
  to send the trial-ending email before the section ships.
- **Ask 29:** "Questions a board asks" as drawn, with the United States storage answer; **the data terms are published
  with the release** (so "ask us for a full copy" rests on a published promise).
- **Ask 30:** S3 carries what it rebuilds anyway; S3b does not hold the flip.
- **Ask 31:** the untrue lines are fixed at the next promote (with S1), and **Tournament Plus's trial is said on the page**
  as Club's is, not switched off. The words are `/marketing`'s, from the one trial sentence with Tournament Plus's own
  length; `/strategy` records the trial in the Facts doc.
- **Ask 32:** B. **Club leads the pricing page** from the flip: the one lime button and the olive edge move from
  Tournament Plus to Club. Never the words "Most popular".
- **Ask 34:** as drawn: band headings at the card-title size; one lime per view is read per screenful; the free Basic
  Coaches Portal is a strip above Premium. **⚠ Amended 2026-11-19: the Basic strip is dropped** (the coaches band is
  Premium only; `BUSINESS_DECISIONS.md` 2026-11-19). The heading and lime-button calls stand.

Also settled on 2026-11-18 by the owner's questions, inside Ask 33: once its plan is open, the last band of /for-clubs
and /for-leagues has one button ("Start free with Tournament" leaves; W30, W36). And noted, not changed: the billing
address screen stays the second half of step 3 with a three-label step line (the 2026-11-04 ruling; the owner was told
one of its two reasons does not apply to a paid-only door and did not ask for a fourth label).

**⚖ RULED 2026-11-19 (owner, from the S1 walk, §543), each as proposed:**

- **The interest line** when the updates box is unticked: "Tell us you're interested and we'll let you know when it
  opens." (and the interest window's intro line, which made the same promise, and `/pricing`'s "and we'll let you know
  when it opens") becomes `/legal`'s sentence, **"Tell us you're interested. Tick the box on the form if you'd like an
  email when it opens."** One spelling everywhere; built first in S2.
- **A team move ends the coach's own plan at once with no refund** (`lib/team-ownership-transfer.ts`; Terms 2026-11-17
  §8 promises a cancelled plan runs to the end of the paid period): (a) say it where the coach says yes to the move —
  their own plan ends today and the unused part of what they paid is not refunded, with the date it would have run to;
  (b) one Terms sentence carving the move out, drafted by `/legal` as a Terms-version change (Terms are published; not a
  quiet edit); (c) keep "you won't be charged for your own Coaches Portal again" (true) and show the "everything comes
  with it" lines (coach help, the Plan & billing Club card, settings) only while Club is open; (d) a prorated refund is a
  separate, later decision. Not built in S2 (they are the team-move flow's screens, not the doors); the owner chooses
  the session.
- **The tax words stay inside Tournament Plus's trial sentence**, as S1 built it (one sentence from one function, for
  all four plans).

**What the rulings start (in order of dependency):** the records they change (`/strategy` log and Facts doc,
`/marketing` canon), then S1. Build prompt: `CLUB_ON_SALE_S1_BUILD_PROMPT.md`. Agreement to the recommendations is not a
go to build: each session starts on the owner's word.

Thirty-four, numbered on the drawings' "Your calls" tab with a recommendation each (copy-back). Recorded here as ruled
once ruled. 1 to 20 are the planning session's. **Ask 4 (the grid in two rows) is replaced by Ask 21.** 21 to 34 are the
audience review's (2026-11-18). All ruled as recommended (above):

| # | Call | Recommendation |
|---|---|---|
| 21 | Three audience bands on /pricing, labelled by what a club runs, not as a ladder; the coaches band shows the free Basic Coaches Portal beside Premium (replaces Ask 4) *(⚠ amended 2026-11-19: the coaches band shows Premium only; the Basic Coaches Portal is reached through tournament registration, `BUSINESS_DECISIONS.md` 2026-11-19)* | Yes, as drawn |
| 22 | The role picker has three doors, each jumping to its band | Yes |
| 23 | The home page: three audience doors, all four roles as full cards, three price rows instead of the six plan cards | Yes, as drawn |
| 24 | A price on the home page doors (a re-frame of the 2026-08-07 ruling): A no price on any door; B "from" the League Plus price on the league and club door only. Never a price on the coach door | A |
| 25 | Nav: Leagues and Clubs stay two entries, in the bands' order; the footer gains a "Built for" column | Yes |
| 26 | The product's own screens on /for-leagues and /for-clubs, shot from a fictional club, re-shot each release cycle. Not a demo; the no-club-demo ruling stands | Yes |
| 27 | "How the trial works" on both pages, in S3. The trial-length copy rule names the section; production confirmed to send the trial-ending email | Yes |
| 28 | The Clubs page speaks to the whole board: "You run the club", the club's books in the sub-line, rebalanced "old way" cards, "What each person at your club gets" | Yes |
| 29 | "Questions a board asks", with the United States storage answer said plainly, and the data terms published with the release (or the by-hand full-copy procedure confirmed) | Yes; publish the data terms |
| 30 | S3 carries what it rebuilds anyway; S3b carries the selling sections and does not hold the flip (the 2026-11-17 ruling: marketing after the launch) | Yes |
| 31 | Lines not true today, fixed at the next promote: three answers that describe customers; "Free right now" on the Premium card; "Start Tournament Plus free". For Tournament Plus: say the 14-day trial, or switch it off | Fix now; say the trial |
| 32 | Which card leads /pricing once Club is on sale: A Tournament Plus keeps the one lime button; B Club takes it. Never the words "Most popular" | B |
| 33 | The paths between audiences: "your events, teams and staff stay where they are"; "Copy a link for your club"; one line under the coach demo. Added at the owner's question (2026-11-18): once its plan is open, the last band of /for-clubs and /for-leagues has one button; "Start free with Tournament" leaves it (W30, W36), and the hero's quiet tournament link stays | Yes |
| 34 | Three drawing calls from `/design`: the band headings at the card-title size (so "Available now" stays the page's one display heading); one lime button per view read per screenful (the Leagues and Clubs pages repeat the same lime action in the hero, on the plan card and in the bottom band, as they do live today); the free Basic Coaches Portal as a strip above Premium *(⚠ the Basic strip dropped 2026-11-19, `BUSINESS_DECISIONS.md`; the other two calls stand)* | As drawn on all three |

## Team move words and three small fixes — built 2026-11-20 (calls C1 and C5; walk §549)

Prompt `TEAM_MOVE_WORDS_AND_SMALL_FIXES_BUILD_PROMPT.md`. Built on dev, not committed. The move itself is unchanged: the coach's own plan still ends at once, no refund, no proration.

**Part A, the words.** `lib/team-move-carve-out.ts` is the ONE place a move says "not refunded" (it supersedes, for one sentence, the 2026-09-28 rule in `lib/team-move-words.ts`; the test now fails if a refund word appears anywhere else). The coach's request card and confirm window read `/legal`'s sentence, from the server's reading of the coach's own plan: paying with a renewal date ahead (the date Plan & billing shows; a plan already set to end at renewal reads the same date); paying with no usable date (no date said); a trial, a payment past due (`/accounting`: the current period is unpaid), free time or no subscription (no refund sentence, "again" dropped). The club's screen is unchanged (ruling (a) says where the coach says yes; the club's line stays "{Coach} won't be charged…"). Ruling (d), a prorated refund, is NOT built; it is `/accounting`'s separate decision. Terms: edit **T5** is in the held draft (now 0.4), not published; `draftPath` stays null, `current` and `oldestAccepted` untouched, the frozen 2026-11-17 file untouched.

**The gate (ruling (c)).** The "everything comes with it" lines show only while Club is open: the two page ledes, the coach's Settings "Join a club" row (the whole Organization section), and Plan & billing's "Part of a club?" card. Unread or unreadable gating reads closed (no promise flashes in). Built per reader with `usePlanGating()` + `isPlanOpen`; `lib/plan-config.ts` untouched (still import-free; a test pins it). **Pushed back on the ruling in two places and built it that way (owner's "continue" after the UX summary):** a request already waiting keeps its "What comes with the team" column whatever the sale state (it is what the coach is agreeing to move), and the Join a club page stays reachable (bell, Overview banner, direct address) so a club made another way (a demo, a platform-admin grant) can still receive a team. **Help:** the two articles (`recipe-link-parent-org`, `recipe-bring-in-coach-team`) are static and the help system has no conditional section; not widened. Left as written, with this note. **Recorded, not fixed:** with Club closed and a coach's own outbound request waiting, the coach has no Settings door to Withdraw (the bell and address remain).

**Part B.** (1) Two tabs: `/api/org/create` now claims, then verifies (`lib/org-create-claim.ts`): the earliest owner seat keeps its organization, the later removes only what it just made and answers with the winner's address when that was made under two minutes ago, else the ordinary "already has a workspace" refusal; a generated address taken between the check and the insert is retried (4 times), a typed one is refused as taken; the name step ignores a second press while one create is in flight. No migration. **Honest limit:** the order is the seat's database timestamp, not commit order, so a stalled request on top of a double submit could still make two (call C4: the exact fix is a database function with a per-person lock, a migration). The live race was NOT reproduced on dev. (2) `lib/login-destination.ts`: `next` is honoured without a workspace only for `/start`, `/start/club`, `/start/league`, `/start/tournament`, `/start/team` (a recovery destination such as a suspended account wins); the `hasWorkspace` rule is kept for everything else (it stops a person with no organization being sent to an admin page they cannot open). **Not changed:** `StartDoorForm`'s bare `/auth/login` link sits on the "you've been invited" screen, where a start-door `next` would be wrong. (3) Titles: the brand removed from 11 titles (the start pages, the coaches start and checkout-complete pages, the platform-admin layout and bookkeeping page, and `/discover` and `/scores`, which had the same doubling); `tests/unit/page-title-brand-guard.test.ts` fails if a page title names the brand again.

**Owner questions open (walk §549 calls):** C1 the wording; **C2 section 18 (30 days' email and accept again?)** `/legal` first said an ordinary version published before any club can receive a team on production, then, on a second look, not to rely on "no club is on sale": the move code has no sale check, so a platform-admin or free-time club could receive a team on production. Check by counts only (coach teams with a paid plan; club-type organizations) before the release; **C3 a failed Stripe cancel after a move** leaves the coach charged until staff cancel by hand, making "you won't be charged" untrue for a while (a change to the move itself; to `/plan`); C4 above. Also: `/accounting` could not find Stripe's no-refund default for the cancel call in our own notes (a two-minute test-mode check settles it), and an unpaid open invoice on a past-due coach after a move is an owner and accountant call. The Ontario consumer-rule question stays open (a lawyer's-eye item).

**What the release must do:** publish the Terms version that carries T5 in the SAME promote as this build (the confirm sentence must not reach production before it), after the section 18 call. Existing failures not from this work: `team-move-coverage` (four tables that carry an organization id have no written move decision: club_schedule_bill_rates, league_season_time_asks, online_payment_stripe_fee_lines, platform_charge_tax_looks; for whoever added them) and 30 others from other sessions' uncommitted work.
