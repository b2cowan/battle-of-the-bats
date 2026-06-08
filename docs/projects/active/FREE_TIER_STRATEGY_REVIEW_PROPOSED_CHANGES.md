# Free Tier Strategy Review - Proposed Changes

Status: Review/proposal  
Date: 2026-06-08  
Reviewer: Codex

## Executive Recommendation

I agree with the direction of `FREE_TIER_STRATEGY_PLAN.md`: free-forever, persona-scoped entry points are a better fit for FieldLogicHQ than time-limited full-product trials. The product serves volunteer-heavy sports operators who often have no approved software budget, no procurement process, and very little patience for "book a demo before I can see if this solves my Saturday problem." A free floor that helps them finish one real job is the right shape.

What I would change is the operating model and sequence.

The current plan is strategically sound, but it is trying to turn a subscription-tier product into a multi-persona free-entry product before the product taxonomy, signup model, cap enforcement, and measurement system are ready. I would still pursue the free-floor strategy, but I would make it more explicit that this is a product-model evolution:

1. Paid subscriptions remain organization-level plans: Tournament Plus, League, and Club.
2. Free entry points become "operator starts": tournament organizer, coach, and house-league admin.
3. Free entry points may create different workspace types, but they should all land in `/home` under one login.
4. Payment-processing-funded language stays internal/future-state until Connect/payfac-style money movement is live, priced, and tested.
5. Activation Trial should move out of the launch plan. It depends on effective plan-rank grants that are not built yet, and it adds complexity before the free floors have proved activation.

My recommended sequence:

1. Fix trust and canonical language first.
2. Build account-first persona routing and existing-user "add workspace" flows.
3. Add entitlement/cap primitives before launching League Starter.
4. Launch Free Tournament cleanup first, because it already exists.
5. Launch standalone Basic Coaches Portal after the Coaches Experience roster/payment slices make Basic meaningful.
6. Launch League Starter as a capped beta before broad public marketing.
7. Revisit processing-funded economics and Activation Trial only after the core free floors have activation data.

## What I Reviewed

Primary docs:

- `docs/projects/active/FREE_TIER_STRATEGY_PLAN.md`
- `docs/projects/active/FREE_TIER_STRATEGY_PM_BRIEF.md`
- `README.md`
- `TODO.md`
- `memory/MEMORY.md`
- `memory/launch-pricing-positioning.md`
- `memory/billing-plan-invariants.md`
- `memory/coaches-portal-unified-product.md`
- `memory/standalone-team-workspace.md`
- `docs/projects/active/COACHES_EXPERIENCE_EVAL_PLAN.md`
- `docs/projects/active/COACHES_EXPERIENCE_EVAL_PM_BRIEF.md`
- `docs/projects/active/COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md`
- `docs/projects/active/COACHES_PORTAL_UNIFIED_PM_BRIEF.md`
- `docs/projects/active/TIMED_ENTITLEMENTS_PLAN.md`
- `docs/projects/active/TIMED_ENTITLEMENTS_PM_BRIEF.md`
- `docs/projects/archive/HOUSE_LEAGUE_MODULE_PLAN.md`
- `docs/projects/archive/LEAGUE_ONBOARDING_WIZARD_PLAN.md`

Related code:

- `lib/plan-config.ts`
- `lib/plan-features.ts`
- `lib/module-entitlements.ts`
- `lib/plan-module-entitlements.ts`
- `lib/types.ts`
- `lib/user-contexts.ts`
- `lib/basic-coach-teams.ts`
- `app/home/page.tsx`
- `app/api/auth/signup/route.ts`
- `app/auth/signup/page.tsx`
- `app/api/auth/coach-signup/route.ts`
- `app/coaches/join/page.tsx`
- `app/coaches/page.tsx`
- `app/coaches/teams/page.tsx`
- `app/api/coaches/basic-teams/route.ts`
- `app/pricing/page.tsx`
- `components/PricingSection.tsx`
- `app/pricing/ComparisonTable.tsx`
- `app/for-tournament-organizers/page.tsx`
- `app/for-leagues/page.tsx`
- `app/for-coaches/page.tsx`
- `app/for-clubs/page.tsx`
- `app/[orgSlug]/admin/house-league/page.tsx`
- `app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx`
- `app/api/admin/house-league/seasons/[seasonId]/schedule/generate/route.ts`
- `app/api/admin/house-league/seasons/[seasonId]/teams/route.ts`
- `app/api/billing/create-checkout/route.ts`
- `app/api/billing/create-team-checkout/route.ts`
- `lib/stripe.ts`
- `lib/plan-gating-server.ts`

External sanity checks:

- [TeamLinkt pricing](https://teamlinkt.com/pricing) emphasizes a $0 core entry for sports organizations and paid bundles around operations/revenue.
- [Spond](https://www.spond.com/en-us/) positions itself as a free team/club management app, and its help docs describe a transaction-driven payments model: [Payments Costs in the Spond App](https://help.spond.com/app/en/articles/118091-payments-costs-in-the-spond-app).
- [Stripe Connect pricing for Canada](https://stripe.com/en-ca/connect/pricing) confirms that payment monetization is feasible but comes with concrete pricing and operating choices. If Stripe handles pricing, the platform may qualify for revenue share. If the platform handles pricing, Stripe lists CA$2 per monthly active account and 0.25% + CA$0.25 per payout, plus the platform is responsible for processing fees and can collect fees from users.

## Product Objective As I Understand It

FieldLogicHQ is trying to become the operating system for Canadian amateur sports organizations in the 50-500 player range. The strongest product thesis is not "another tournament app" or "another team app." It is:

> One system that lets a volunteer-run sports organization grow from one event, to a season, to a full club without rebuilding its operational data every year.

That matters because most competing workflows are fragmented:

- Tournament organizers use one tool or spreadsheet.
- House-league admins use another.
- Rep coaches use team apps.
- Club presidents inherit all of the above, usually with no source of truth.

The free-tier strategy should therefore do two jobs:

1. Lower the first-use barrier for each operator persona.
2. Preserve the product's long-term consolidation advantage by making each free entry point point back to the same organizational graph.

That second job is the part I would protect most aggressively. If the free strategy creates isolated products that do not naturally ladder into Club, it will generate activity without strategic compounding.

## Strengths Of The Current Plan

### 1. Free-forever floors match the category better than trials

The plan correctly rejects a time-limited full-product trial as the primary free strategy. In this market, a trial often expires before the next real planning cycle. A volunteer organizer may create an account in January, build schedule pieces in March, run the event in June, and only understand the value after cleanup in July. A 14-day or 30-day trial is poorly aligned with that rhythm.

Free floors let FieldLogicHQ earn trust at the speed of amateur sports operations.

### 2. Persona-scoped entry points are more honest than one giant free plan

The plan avoids the trap of making "Club Free" or "everything free until you are huge." That would blur the paid value proposition and create support load from organizations with no upgrade intent.

The three free floors are naturally scoped:

- A tournament organizer wants to run one event.
- A house-league admin wants to run one small season/division.
- A coach wants one durable team home.

That is a good segmentation model. Each floor maps to a real first job instead of an abstract feature bundle.

### 3. The plan preserves organization-level paid subscriptions

Keeping paid subscriptions attached to organizations is the right instinct. FieldLogicHQ's long-term revenue should come from org-level operational consolidation, not from a tangle of tiny subscriptions that later need to be merged, transferred, or reconciled.

The plan also correctly keeps Club paid-only. Club should remain the consolidation and governance product. A free Club tier would be expensive to support and hard to explain.

### 4. The `/home` context model already supports the direction

The existing `lib/user-contexts.ts` and `app/home/page.tsx` model already treats a user as someone who can have multiple access contexts:

- organization membership
- official assignment
- Basic Coaches Portal context
- Premium Coaches Portal context

That is a real architectural advantage. The free strategy does not need to invent "one login, many hats" from scratch. It needs to add creation flows and better context destinations.

### 5. The plan correctly identifies D1 and D2 as keystones

The strategy calls out the two signup blockers that actually matter:

- D1: `/auth/signup` always creates a Tournament org.
- D2: existing users have no clean way to add another free floor.

That diagnosis is accurate. Without account-first persona routing and an add-workspace path, the product cannot honestly market "start free as a coach, league admin, or tournament organizer."

### 6. The processing language is now scoped more safely

Section 9 of the plan makes an important correction: "free to operate, funded by processing" is an end-state, not launch posture. That is the right move.

The repo currently has Stripe subscription checkout and a gated Coaches Portal checkout path. It does not have Connect/payfac-style money movement, connected accounts, platform fees, payout handling, dispute handling, or fee/revenue-share economics. Payment processing should not be on the critical path for the first free floors.

### 7. Coaches Experience sequencing is directionally right

The plan correctly says standalone Basic Coaches Portal should wait until Basic has real substance. A coach-only free entry that merely shows historical tournament registrations is too thin. The Coaches Experience plan's roster/payment/status/team-HQ work gives Basic a reason to exist.

### 8. House League is more feasible than the plan implies

The house-league module is not just a concept. The repo already has season management, division/team screens, registration/team/schedule/standings surfaces, and a round-robin generator behind `module_house_league`.

The big League Starter risk is not whether a small league experience can exist. It is whether the product can enforce the free boundary cleanly and explain it without making paid League feel arbitrary.

## Weaknesses And Risks

### 1. The canonical product model is currently split

`README.md` still describes FieldLogicHQ as four bundled SaaS tiers with no a la carte modules:

- Tournament
- Tournament Plus
- League
- Club

The free-tier strategy introduces a different mental model:

- Free Tournament
- Free League Starter
- Free Basic Coaches Portal
- paid Tournament Plus
- paid Premium Coaches Portal
- paid League
- paid Club

That is not automatically wrong, but it needs a canonical taxonomy. Right now the docs mix "subscription tiers," "module bundles," "free floors," "coach teams," and "coming soon products" in ways that will confuse implementation and marketing.

Recommended fix:

- Internally define two layers:
  - **Workspace/account type:** organization workspace, coach team workspace/basic coach team, official context.
  - **Commercial entitlement:** free floor, paid subscription, temporary grant.
- Externally avoid explaining the taxonomy. Use action language:
  - "Run a tournament"
  - "Start a small season"
  - "Coach a team"
  - "Run the whole club"

### 2. Basic Coaches Portal scope conflicts with active docs

The free-tier plan says Basic Coaches Portal should include:

- tournament registrations/history
- persistent master roster
- payment/check-in visibility
- game-day bridge
- multi-team support
- standalone on-ramp

But the active Coaches Portal unified docs say Basic does not include roster management. They position roster, attendance, lineups, dues/budget, and documents as Premium.

The newer Coaches Experience plan moves toward persistent roster continuity, which I think is the right product direction. But the free-tier plan should explicitly amend the older Basic/Premium boundary instead of assuming it has already changed.

Recommended boundary:

- Basic may include a **master roster identity list**: player name, jersey number, position, guardian contact where needed, and event-submission status.
- Basic should not include **team operations**: attendance, lineups, document library, dues/budget/accounting, parent portal, full event calendar, or online collections.
- Basic should collect sensitive minor data only when there is a clear workflow reason. Date of birth should be optional or tournament-required, not a casual default field.

That preserves Basic's usefulness without giving away the Premium team-management product.

### 3. League Starter has no cap enforcement foundation yet

The League Starter promise depends on caps:

- one active season
- one division
- roughly eight teams
- limited public surface
- no exports
- no full branding

Current house-league code is module-gated, not cap-gated. If an org has `module_house_league`, APIs can create multiple seasons, divisions, and teams. The round-robin generator is available to any org with that module entitlement. There is no server-side concept of a free league floor.

This cannot be solved with UI hiding alone. Free boundaries must be enforced at the API layer.

Recommended technical prerequisite:

- Add a server-side free-floor limit helper before launching League Starter.
- Enforce limits in create/update APIs, not just in React.
- Instrument every cap hit.
- Make cap-hit screens upgrade-aware even if paid League is still early access.

### 4. Free League Starter risks giving away the paid League core

The emotional core of house-league software is:

- collect registrations
- make teams
- generate schedule
- show standings

The plan gives League Starter auto-schedule and standings for one division. I think that is still probably necessary, because a free league floor that cannot produce a schedule will feel fake. But it makes the paid boundary delicate.

The paid League value must therefore be about operating scale and polish, not "you finally get the one thing you came for."

Recommended paid League walls:

- multiple seasons or age groups
- multiple divisions
- more than eight teams
- public org site and multi-division public navigation
- registration exports and reports
- custom registration fields and waivers
- online payment collection when processing exists
- advanced scheduling constraints
- communications at scale
- role delegation
- officials integration
- sponsor/branding controls

Recommended free inclusion:

- one public season registration page, if technically feasible
- one division
- up to eight teams
- schedule generation
- standings
- manual fee tracking

I would not include a full public organization website in League Starter, but I would include a narrow registration/schedule/standings public surface. Without at least one public shareable surface, the first-value loop may be too weak.

### 5. Signup is org-first, but the strategy is account-first

Current `/auth/signup` asks for organization name and slug, creates a Supabase user, creates an organization with `plan_id='tournament'`, and then redirects into onboarding.

That is fine for tournament organizers. It is wrong for coaches. It is awkward for house-league admins if the product wants to ask them first what they are trying to run.

Recommended fix:

- Introduce an account-first start route, likely `/start`.
- Let new users choose a job/persona before creating a workspace.
- Let existing users add another workspace from `/home`.
- Keep `/auth/signup` available as the tournament organizer deep link, but stop making it the universal entry point.

Potential routes:

- `/start` - persona selection and account creation wrapper.
- `/start/tournament` - current org creation flow with tournament defaults.
- `/start/league` - Free League Starter org creation and league onboarding.
- `/start/team` or `/coaches/start-free` - Basic coach team creation with no org slug.
- `/home` - existing user context switcher plus "Start something new."

### 6. Existing-user multi-floor creation is missing

The `/home` context switcher is good, but it only helps after contexts exist. The plan mentions `/create-org` or equivalent, but no route exists today.

This matters because the best free-floor adoption path may be cross-persona:

- A tournament organizer also coaches a rep team.
- A coach later helps run a small house league.
- A club admin tests a tournament before evaluating Club.

Recommended fix:

- Build one add-workspace flow that starts from `/home`.
- Do not make existing users sign up again.
- Do not reject existing emails for new persona starts.
- Make each created context explicit in `/home`.

### 7. Payment-processing-funded positioning is economically unproven

External market references support the instinct that "free software funded by payments" is plausible. TeamLinkt publicly advertises a $0 core entry and payment-driven economics. Spond publicly positions as free and says it makes money when users process payments through Spond.

But that does not mean FieldLogicHQ can claim the same yet.

The repo currently has no Connect integration. Stripe's Canadian Connect pricing also creates real choices:

- If Stripe handles pricing, the platform may qualify for revenue share, but that is not the same as owning a predictable margin.
- If FieldLogicHQ handles pricing, Stripe lists added platform costs such as CA$2 per monthly active account and payout fees, and the platform is responsible for processing fees.

Recommended fix:

- Keep "funded by processing" out of customer-facing copy until Flow B is built and validated.
- Internally model processing economics before promising it:
  - average registration volume by org type
  - expected payment adoption rate
  - refund/dispute rate
  - payout cadence
  - support burden
  - gross margin after Stripe/connect costs
  - whether fees are absorbed by orgs or passed to families

### 8. Activation Trial should not be part of the MVP sequence

The plan includes a future Club Activation Trial. I understand the goal: let a club president experience the "whole system" briefly without giving away Club forever.

I would move it out of this strategy's implementation path.

Reasons:

- `TIMED_ENTITLEMENTS_PLAN.md` says the Scenario B/A1 slice is built behind `ENTITLEMENT_GRANTS_ENABLED`, but effective `plan_tier` grants are deferred.
- `lib/plan-features.ts` gates important features by plan rank, not only module entitlement.
- Club trialing has higher support and expectation cost than a scoped free floor.
- The launch plan already has enough dependency risk.

Recommended replacement:

- For Club, use guided demo/sample workspace/consultative activation until plan-rank grants and billing lifecycle behavior are clean.
- Revisit Activation Trial as a separate project after free-floor activation data exists.

### 9. Pricing and PM docs contain stale/conflicting language

Specific inconsistencies:

- `FREE_TIER_STRATEGY_PM_BRIEF.md` says revenue-bearing pieces wait on payment-processing line plus Stripe go-live. The plan now says free floors do not wait on Flow B processing, and Stripe subscription checkout already exists for some paths.
- `TIMED_ENTITLEMENTS_PM_BRIEF.md` says timed entitlements are planned/not started, while `TIMED_ENTITLEMENTS_PLAN.md` says the first slice is built behind a flag.
- `README.md` still states the four-tier bundled SaaS model without the new free-floor layer.
- Active Coaches Portal docs still say Basic has no roster management, while Free Tier Strategy and Coaches Experience depend on Basic roster continuity.
- `components/PricingSection.tsx` still has Tournament Plus annual copy that can say "14-day trial first" even though founding-season positioning says Tournament Plus is free through December 31, 2026.
- `docs/agents/brand/PRICING_PAGE_COPY.md` has amended sections, but older trial language remains in the same doc as superseded copy.

Recommended fix:

- Add a canonical pricing/product-model note before implementation.
- Update PM briefs immediately after approving direction.
- Treat trust-copy cleanup as Phase 0, not "nice to have."

### 10. The plan does not define measurement tightly enough

The plan names success outcomes, but it needs event-level instrumentation before launch. Otherwise the team will not know whether free floors are working or just creating accounts.

Recommended events:

- `signup_persona_selected`
- `free_floor_created`
- `existing_user_floor_added`
- `first_value_reached`
- `scope_wall_hit`
- `upgrade_intent_clicked`
- `express_interest_submitted`
- `coach_team_created`
- `coach_roster_created`
- `coach_event_connected`
- `league_season_created`
- `league_schedule_generated`
- `league_public_page_shared`
- `tournament_published`
- `tournament_afterglow_prompt_shown`
- `coach_advocacy_referral_clicked`

Recommended first-value definitions:

- Tournament: tournament published with at least one division and public schedule/bracket page.
- Coach: Basic team created with roster or tournament registration linked.
- League Starter: season created, teams created, schedule generated, and public schedule/standings link shared.
- Club: not applicable until Activation Trial or guided activation exists.

### 11. Support and abuse controls are missing

Free floors create operational risk:

- dormant organizations
- duplicate coach teams
- accidental personal data collection
- spammy public pages
- support requests from non-paying accounts
- cap bypass attempts

Recommended minimum controls:

- rate-limit workspace creation per user/email/domain/IP
- require email verification before public publishing
- define retention for dormant free workspaces
- add duplicate-detection prompts for similar org/team names
- add admin visibility for free-floor creation and cap hits
- keep sensitive roster fields minimal until needed

## What I Would Do Differently

### 1. Rename the internal model

I would stop calling this "free tiers" internally. "Tier" already means paid org subscription in the product.

Recommended internal language:

- **Free floor:** a scoped free entitlement boundary.
- **Operator start:** the onboarding path for a persona.
- **Workspace:** the thing created by the start path.
- **Paid plan:** the org subscription plan.
- **Temporary grant:** a time-boxed override from DBA/admin tooling.

Recommended customer language:

- "Run one tournament free."
- "Start a small league season free."
- "Create your coach team home free."
- "Upgrade when you need more scale, automation, or club-wide control."

### 2. Make `/start` the new front door

The current signup flow creates a Tournament org too early. I would introduce a new account-first front door and gradually move marketing CTAs to it.

High-level flow:

1. User chooses what they are trying to do:
   - Run a tournament
   - Run a small league season
   - Coach a team
   - Explore club operations
2. User authenticates or creates an account.
3. The product creates the appropriate workspace/context.
4. `/home` becomes the persistent context switcher and "start another thing" hub.

This makes the system match the strategy. It also reduces the chance that a coach accidentally creates an organization just to see a coach product.

### 3. Split the implementation into two rails

The current phase list mixes trust fixes, signup architecture, coach product work, league caps, payment strategy, activation trials, and marketing.

I would split it into two rails:

**Launch Rail: self-serve free starts**

1. Trust and canonical language cleanup.
2. Account-first start flow.
3. Existing-user add-workspace flow.
4. Free-floor/cap primitives.
5. Free Tournament cleanup.
6. Standalone Basic Coaches Portal.
7. League Starter beta.
8. Marketing flip by floor.

**Future Rail: monetization expansion**

1. Premium Coaches Portal paid launch.
2. Stripe subscription cutover after founding season.
3. Payment-processing Flow B/Connect.
4. Processing-funded public positioning.
5. Club Activation Trial.

This separation would make the plan easier to execute and less likely to stall on payment infrastructure.

### 4. Treat League Starter as a beta until caps are proven

League Starter is valuable, but it has the highest risk of accidental over-entitlement. It should not launch broadly until server-side caps are in place and tested.

I would launch it first as:

- "Start a small season free" from a controlled page.
- cap-hit upgrade/interest screens.
- no public claim that it replaces League.
- analytics on first value and cap hits.

Once data shows that the cap works and the first-value loop is real, then fold it into the main pricing/start pages.

### 5. Make Basic Coaches Portal standalone, but keep it intentionally narrow

I would approve standalone Basic because the current tournament-registration-only entry is too dependent on organizer adoption. Coaches are a natural top-of-funnel persona and can become strong club advocates.

But I would keep Basic narrow:

Included:

- create a team
- manage a lightweight master roster
- connect tournament registrations to that team
- see registration/payment/check-in status for connected tournaments
- see tournament schedule/history
- manage multiple Basic teams under one coach account

Not included:

- attendance
- lineups
- documents
- dues/budget
- online collection
- parent/member app experience
- full calendar
- team accounting

The upgrade moment should be: "You have the team identity and event history. Upgrade when you want to run the whole team week to week."

### 6. Keep Free Tournament honest about brackets

The product currently has a nuanced boundary:

- Free Tournament can manually create/manage playoff games and show bracket-like tournament history.
- Tournament Plus gates automated schedule generation and playoff bracket generation.

Marketing should say this plainly. Avoid promising "brackets" in a way that makes users expect a full automated bracket builder on the free plan.

Recommended copy boundary:

- Free: "manual scheduling, manual playoff games, public schedule/results."
- Plus: "auto-schedule, playoff bracket builder, exports, and advanced event operations."

### 7. Do not sell Club through a free tier yet

The plan keeps Club paid-only, which I agree with. I would go one step further and avoid a "Club Activation Trial" until the entitlement system can safely grant effective plan rank.

Better Club free/evaluation options for now:

- demo workspace
- guided sample-data walkthrough
- concierge import assessment
- limited "review your current workflow" consultation
- invitation to connect existing Tournament/League/Coach contexts under one org once they exist

The Club sales motion should be consultative until the product has enough self-serve proof from the smaller operator starts.

## Revised Proposed Sequence

### Phase 0 - Canonical Model And Trust Cleanup

Goal: Make the product say only things that are true today.

Work:

- Update `FREE_TIER_STRATEGY_PM_BRIEF.md` to match Section 9 of the plan: Flow B processing is future-state, not a launch blocker.
- Update `TIMED_ENTITLEMENTS_PM_BRIEF.md` to reflect that the first grant slice exists behind `ENTITLEMENT_GRANTS_ENABLED`, while `plan_tier` grants are deferred.
- Update README/product model docs if the free-floor strategy is accepted.
- Clean pricing copy conflicts:
  - Tournament Plus founding-season vs 14-day trial language.
  - League/Club/Coaches "coming soon" vs "start free" language.
  - superseded trial copy in brand docs.
- Clarify Free Tournament bracket copy.
- Add the analytics event spec to the strategy plan or a companion implementation plan.

Exit criteria:

- No public page implies League, Club, or Coaches Portal paid checkout is live when it is not.
- No public page implies Tournament Plus is a normal 14-day trial during the founding-season comp period.
- No docs conflict on whether payment-processing funding is launch copy or end-state.

### Phase 1 - Account-First Start Flow

Goal: Users can start from their job, not from an org-subscription assumption.

Work:

- Add `/start` persona routing.
- Keep `/auth/signup` as the tournament organizer deep link or refactor it behind the `/start/tournament` path.
- Add existing-user add-workspace entry from `/home`.
- Make signup/auth endpoints handle existing email paths cleanly.
- Preserve `/home` as the context switcher.

Exit criteria:

- New tournament organizer can create a free tournament org.
- New coach can create an account without creating an org.
- Existing user can add another workspace/context without signing up again.
- `/home` shows all contexts and offers a start-new action.

### Phase 2 - Free-Floor Entitlements And Caps

Goal: Free boundaries are enforced server-side.

Work:

- Add an entitlement profile/free-floor concept, or make an explicit plan-key decision.
- Add helpers for free-floor limits.
- Enforce League Starter limits in APIs:
  - seasons
  - divisions
  - teams
  - schedule generation
  - public surfaces
  - exports
- Enforce Tournament free boundaries consistently:
  - one active tournament
  - no auto-schedule
  - no playoff builder
  - no exports
  - limited branding
- Add instrumentation for cap hits.

Exit criteria:

- A user cannot bypass caps through direct API calls.
- Cap-hit responses are explainable and UI-ready.
- DBA/admin can see free-floor status and cap-hit signals.

### Phase 3 - Free Tournament Cleanup

Goal: Make the existing free product feel intentional.

Work:

- Fix public copy around manual vs automated brackets.
- Ensure one-active-tournament cap is consistently messaged.
- Make afterglow prompt low-pressure and earned.
- Make upgrade walls explain concrete outcomes, not abstract plan names.

Exit criteria:

- Free Tournament organizer can run one event without hitting misleading copy.
- Upgrade prompts appear at natural pressure points.

### Phase 4 - Standalone Basic Coaches Portal

Goal: Coaches can start with FieldLogicHQ even before a tournament organizer invites them.

Work:

- Extend `basic_coach_teams` to support a standalone source.
- Allow `POST /api/coaches/basic-teams` without `registrationId` for standalone creation.
- Add `/coaches/start-free` or route through `/start/team`.
- Add lightweight master roster.
- Keep sensitive fields minimal and purpose-driven.
- Let tournament registrations attach to an existing Basic team.
- Keep Premium CTA gated until Premium checkout is actually live.

Exit criteria:

- New coach can create a Basic team with no org.
- Existing coach can add another Basic team.
- Coach can link a tournament registration to that team.
- Basic does not expose Premium operations.

### Phase 5 - League Starter Beta

Goal: A small house-league admin can create one real season and hit first value.

Work:

- Create Free League Starter workspace flow.
- Use the existing house-league onboarding wizard where possible.
- Enforce one active season, one division, and eight-team cap.
- Allow schedule generation and standings for that scope.
- Decide and implement public surface:
  - recommended: one narrow public registration/schedule/standings page
  - not included: full public org site
- Add manual fee tracking.
- Add cap-hit interest/upgrade path.

Exit criteria:

- Small league admin can generate a usable season schedule.
- Cap limits work server-side.
- Paid League boundary is visible and credible.

### Phase 6 - Marketing Flip By Floor

Goal: Public pages only advertise free starts that are actually live.

Work:

- Flip tournament CTAs first.
- Flip coach CTAs after standalone Basic is live.
- Flip league CTAs after League Starter beta is stable.
- Keep Club as consultative/paid.

Exit criteria:

- Every public "start free" CTA maps to a working flow.
- Every "coming soon" CTA maps to express interest or contact.
- No page relies on future payment processing claims.

### Future Phase - Processing And Activation Trials

Goal: Add monetization modes only after the free-floor product loops work.

Work:

- Build Connect/payment-processing Flow B.
- Decide Stripe handles pricing vs FieldLogicHQ handles pricing.
- Model transaction economics.
- Add online collections to paid plan walls.
- Build effective `plan_tier` timed grants before Activation Trial.
- Revisit Club Activation Trial with support and billing lifecycle coverage.

Exit criteria:

- Processing revenue can be measured.
- Flow B economics are defensible.
- Temporary Club access can safely unlock plan-rank gated features.

## Technical Model Recommendation

### Do not overload the existing paid plan model too much

Today `OrgPlan` is:

- `tournament`
- `team`
- `tournament_plus`
- `league`
- `club`

`PLAN_RANK` treats `tournament` and `team` as rank 0, `tournament_plus` as rank 1, `league` as rank 2, and `club` as rank 3. Module entitlements are primarily binary. Feature gates like `auto_schedule` and `playoff_generator` use plan rank.

Free League Starter does not fit neatly into this:

- It needs `module_house_league`.
- It should not get paid League rank.
- It needs caps that paid League does not have.
- It may need marketing/billing labels that are not simply "Tournament."

Recommended approach:

- Add a separate entitlement profile/free-floor concept rather than immediately adding `league_starter` to `OrgPlan`.
- Keep paid `plan_id` as the subscription/commercial plan.
- Let the free-floor profile contribute module entitlements and caps.
- Compute effective entitlements from:
  - paid plan
  - enabled add-ons
  - temporary grants
  - free-floor profile

Possible shape:

```ts
type FreeFloor = 'tournament_free' | 'league_starter' | null;

type EffectiveEntitlements = {
  modules: Set<ModuleCapability>;
  features: Set<PlanFeature>;
  limits: {
    activeTournaments?: number;
    activeHouseLeagueSeasons?: number;
    houseLeagueDivisionsPerSeason?: number;
    houseLeagueTeamsPerSeason?: number;
  };
};
```

This keeps the current paid plan ladder intact while making the free boundary explicit.

If the team prefers a visible plan key, `league_starter` can work, but it is more invasive. It touches `OrgPlan`, `PLAN_CONFIG`, plan rank, billing checkout guards, pricing/comparison tables, onboarding destinations, gating maps, and any code assuming plans are the paid ladder.

### Server-side cap enforcement checklist

League Starter:

- `POST /api/admin/house-league/seasons`: block second active/non-archived season.
- `POST /api/admin/house-league/seasons/[seasonId]/divisions`: block second division.
- `POST /api/admin/house-league/seasons/[seasonId]/teams`: block over eight teams, including bulk create.
- Schedule generator: allow only for the included division/season; block advanced scheduling options if added later.
- Public site routes: allow narrow season public pages only if approved; block full org-site publication.
- Exports: block CSV/PDF/report exports.

Tournament Free:

- enforce one active tournament.
- block auto-schedule API paths.
- block playoff-generator batch paths.
- allow manual game/playoff management if that is the intended free promise.
- block exports.

Basic Coaches Portal:

- standalone team creation allowed.
- registration-linked team creation still supported.
- no Premium fields/pages/API exposure.
- roster fields scoped to Basic.
- attach registrations by explicit link, not email fallback.

### Existing-user flow checklist

- Add "Start something new" to `/home`.
- Route authenticated users to `/start` without forcing signup.
- Allow creation of:
  - new tournament org
  - new league starter org/workspace
  - new Basic coach team
- Reuse `/home` after creation.
- Avoid duplicate email errors by separating auth from workspace creation.

## Messaging Recommendation

### Main positioning

FieldLogicHQ should not lead with "free tiers." It should lead with jobs:

- "Run one tournament free."
- "Start a small league season free."
- "Create a free team home for your season."
- "Upgrade when your operation needs more scale, automation, payments, or club-wide control."

### What not to say yet

Avoid these until true:

- "Funded by payment processing."
- "Free for every club."
- "Start League free" if the League Starter cap is not live.
- "Coaches Portal is available" if only express interest is live.
- "14-day trial" for Tournament Plus during founding-season comp positioning.

### Upgrade-wall language

Good upgrade walls name the operational pressure:

- "You have reached the one active tournament included in Free Tournament."
- "Multiple divisions are part of League."
- "Exports are included in Tournament Plus."
- "Attendance and lineups are part of Premium Coaches Portal."
- "Online collection requires paid League once payment processing is available."

Avoid walls that only say "upgrade your plan." Volunteer operators need to understand what changed in their workflow.

## Decisions To Make Before Implementation

1. Is Free League Starter represented as a new `OrgPlan` or as a free-floor/entitlement profile attached to an org?
2. Does League Starter include a narrow public registration page, or only admin-side manual fee tracking?
3. What are the exact League Starter caps: teams only, or players/registrations too?
4. Is Basic Coaches Portal allowed to store date of birth before tournament submission requires it?
5. Is "master roster" officially part of Basic now, superseding the older Coaches Portal unified docs?
6. What is the standalone Basic source value in `basic_coach_teams`: `standalone`, `coach_created`, or something else?
7. Should Premium Coaches Portal launch before or after standalone Basic? My recommendation: Basic first is acceptable only if Premium CTAs remain honest.
8. What is the first public league CTA: "Start small season free" or "Join League Starter beta"?
9. What event analytics system should own the instrumentation?
10. What is the dormant-free-workspace retention policy?

## Proposed Changes To The Current Plan

### Change 1 - Add canonical terminology

Add a section near the top:

> FieldLogicHQ has paid organization plans and free operator floors. Paid plans define subscription revenue and long-term product packaging. Free floors define scoped entry paths for specific operators. A user can hold multiple contexts under one login.

### Change 2 - Make account-first routing explicit

Replace "persona detection at signup" with "account-first start flow." Detection sounds passive or heuristic-driven. The product should ask the user what they are trying to do.

### Change 3 - Move Activation Trial out of the main free-floor sequence

Keep it as a future related project after effective plan-rank grants are built.

### Change 4 - Make cap enforcement a named dependency

Add `D6 Free-floor cap enforcement`:

> League Starter and Free Tournament boundaries must be enforced server-side before public launch. UI hiding is insufficient.

### Change 5 - Amend Basic Coaches Portal boundary

Add:

> This plan intentionally updates the prior Basic/Premium boundary. Basic may include a lightweight master roster for continuity, but Premium remains the home for team operations such as attendance, lineups, documents, dues/budget, and collections.

### Change 6 - Clarify League Starter first-value loop

Decide whether the free floor includes a public registration/schedule/standings page. My recommendation is yes for one season/division, no for full public org site.

### Change 7 - Add instrumentation before marketing flip

Do not launch broad free messaging until first-value and cap-hit events are wired.

### Change 8 - Treat processing-funded language as a later GTM phase

The current plan mostly does this already. The PM brief should match it.

### Change 9 - Add support/abuse controls

Free products need operational limits beyond product caps.

### Change 10 - Make marketing flips floor-specific

Do not wait for all floors to be ready, but do not claim a floor is live before its route works:

- Tournament first.
- Coaches second.
- League third.
- Club consultative only.

## Bottom Line

The plan's strongest idea is that FieldLogicHQ should stop treating "free" as a generic trial and start treating it as a real operating surface for each persona. That is the right move.

The biggest weakness is that the product architecture still thinks mostly in paid org subscription tiers, while the strategy now wants account-first, persona-first creation. That mismatch is fixable, but it should be made explicit before implementation starts.

If I were implementing this, I would narrow the MVP:

1. Clean up trust/copy.
2. Build `/start` and existing-user add-workspace.
3. Add free-floor entitlement/cap primitives.
4. Make Free Tournament and Basic Coach starts work.
5. Launch League Starter as a capped beta.
6. Keep payment-processing-funded and Club Activation Trial work out of the critical path.

That gives FieldLogicHQ the strategic upside of free entry without overpromising payments, undermining paid League/Club, or creating a signup/product taxonomy knot that will be harder to unwind later.
