# Free Tier Strategy — Per-Operator Free Floors, One Account

> ⚠️ **Execution sequence now lives in [FREE_TIER_COACHES_UNIFIED_PLAN.md](FREE_TIER_COACHES_UNIFIED_PLAN.md)** (merged with the Coaches Experience plan). This doc is retained as the **strategy / detail reference** — §9 payments, §10 opt-C coach line, §11–§15 taxonomy / technical model / instrumentation / abuse controls. Build in the order the unified plan defines.

**Status:** SCOPED 2026-06-07 (planning session — nothing built) · awaiting sign-off to sequence into build
**Session type:** strategy / planning only (no code changed)
**Related projects (this plan COORDINATES them — it does not duplicate their work):**
- **Coaches Experience — End-to-End + "Wow" Pass** → owns deepening the Basic Coaches Portal into real team management (master roster etc.). [COACHES_EXPERIENCE_EVAL_PLAN.md](COACHES_EXPERIENCE_EVAL_PLAN.md)
- **Coaches Portal Unified Product** → the Basic-vs-Premium model + the bridge. `memory/coaches-portal-unified-product.md`
- **Timed Entitlement Grants (Comps & Trials)** → the engine the Activation Trial rides on. [TIMED_ENTITLEMENTS_PLAN.md](TIMED_ENTITLEMENTS_PLAN.md)
- **Stripe Phase G go-live + the payment-processing revenue line** → the monetization dependency for every revenue-bearing piece.
- **Founding Season GTM** → the `comp_period` override the Activation Trial must coexist with.

---

## 1. Strategic decision (locked)

**Direction = Option E end-state** — per-operator *free-forever* floors funded by **payment processing**, with a trial used only to **sample** paid depth — **reached incrementally via Option C steps** (one scoped free SKU per operator type). **Do not announce the "E"/hybrid label externally until the payment-processing line is live.**

Rationale: the competitors FieldLogicHQ actually faces in the Canadian grassroots market (RAMP, TeamLinkt, Spond) all let an organization operate its core for **$0** and earn on payment processing. A **tournament-only** free tier sits **below** that market floor and reads as stingy to a budget-zero volunteer.

**Rejected:**
- **Option D (time-limited full trial)** — wrong side of the category norm (free-forever-bounded-by-scope is the expectation, not a clock), cannibalizes the brand-canon-protected free Tournament product ("free, no credit card" — never "free trial"), and is the heaviest build.
- **Option B (free-basic-of-all-modules in one scope)** — the right 12-month competitive destination but the costliest, highest-cannibalization build. Reach that destination via the cheaper Option C steps, not a big-bang.

## 2. The model (locked) — "separate scoped floors, one account"

The unit a **paid subscription** attaches to is the **ORG** (`plan_id` on the org row; multi-tenant `/{orgSlug}/`). **Free** is delivered as **per-operator-type floors scoped to their natural unit**, unified under **one user login** via the `/home` context switcher (`getUserAccessContexts`).

It is **NOT** one mega-subscription that unlocks every module's free functionality in one place — that would cannibalize the paid module differentiators (house league = what League sells; accounting/rep-teams = what Club sells), erase the upgrade triggers, break the 2026-05-29 billing-shelf rule (Coaches Portal / League / Club are **adjacent products for distinct user types, not one ladder**), and is the most expensive build.

It is **NOT** four parallel subscriptions a user juggles. Free orgs are `$0` with `subscription_status='active'` and **no Stripe subscription** (migration 050 invariant); the Basic Coaches Portal isn't a subscription at all.

**Three free floors (Club is paid-only):**

| Floor | Technical unit | What's free | Scope wall → paid |
|---|---|---|---|
| **Free Tournament** | org on the `tournament` plan ($0, no Stripe sub — mig 050) | 1 active tournament, manual schedule/brackets, public schedule, basic comms; **tournament core is universal** | 2nd concurrent event · auto-schedule · bracket generator · exports · full branding → **Tournament Plus $39** (self-serve) |
| **Free League Starter** *(new SKU)* | org, capped house-league free-grade | 1 active season, ~8 teams, 1 division, auto-schedule + standings for that one division, manual fee tracking; **no public org site, no exports** | 2nd division · 9th team · public org site · exports · online payments → **League $89** |
| **Free Basic Coaches Portal** | `basic_coach_teams` (email-keyed, **no org, not a subscription**) | **No-tournament floor (verified, opt-C):** team profile · multi-team · **master roster** (identity) · **basic schedule** · **basic comms** · coach-self-recorded **manual fee ledger** · standalone Team HQ. *Tournament-participant extras (only with a tournament): registration history/status, read-only organizer schedule, game-day bridge.* **+ NEW standalone on-ramp.** Full line in §10 | lineups · power-calendar · attendance · dues automation · budget · documents · season-setup · online fee collection → **Premium $29 / $19 in Club** |

**Club ($179)** = the **paid consolidation** (all modules + cross-module org-wide visibility). Its "free experience" = a **Free League Starter** + the **Free Basic Coaches Portals** its coaches already hold. Per the billing-shelf rule, the only self-serve *in-org* upgrade is **Tournament → Tournament Plus**; everything else is an adjacent product, not a rung.

**One account, many floors:** a single person who is e.g. a club president *and* a rep coach holds their org (one subscription scope) **+** their Basic Coaches Portal team (separate, no sub), surfaced together at `/home`. They add a second floor from the same account; they never manage parallel subscriptions, and there is no single plan that hands them every module.

## 3. New decisions made this session

- **Standalone Basic on-ramp = APPROVED.** A coach may create a `basic_coach_teams` profile with **no tournament registration attached**. Note migration 092 deliberately *removed* the old email-fallback link "because the product is not live" — this is an **intentional new entry path**, not a revival of that fallback. It is what turns coaches into a genuine top-of-funnel acquisition channel rather than a by-product of someone else running a tournament.
- **Flipping `team` (paid Premium standalone checkout) to `live` = DEFERRED** until the whole coach project is finalized and the team module is **fully tested**. The **free Basic floor does not require this flip** — `team` = **Premium** (a provisioned `team_workspaces` org), which is a different construct from the free, org-less Basic portal.

## 4. Cross-cutting prerequisites / dependencies

- **D1 — Persona-detection routing at signup (KEYSTONE).** Today `/auth/signup` always calls `createOrganization(…, 'tournament')` and drops everyone into the 6-step tournament wizard. Every new free door is **unreachable-by-intent** without routing. **Prerequisite to Phases 3–4 — not optional validation.**
- **D2 — Existing-user multi-floor flow.** `/create-org` (or equivalent) + "start a Basic team" for a logged-in user. Today `/auth/signup` rejects existing emails and there is no second-org path. This is the connective tissue that makes "one account, many floors" real. **Implementation note:** separate auth from workspace creation — do **not** reject existing emails or force a re-signup for a new persona start; each created context shows explicitly in `/home` (§12 checklist).
- **D3 — Payment-processing revenue line.** **→ DEFERRED to a separate future enhancement (see §9, decided 2026-06-07): the free-tier model ships with NO payment processing; D3 is removed from the free-tier critical path.** Flow B (facilitated payments / Stripe Connect) is freely deferrable; Flow A (subscription go-live / Stripe Phase G) is separate and bounded by the Jan-2027 founding conversion. When Flow B is eventually scoped it gates online fee collection, the Activation Trial monetization, and Premium standalone checkout — and must settle the fee-bearer + blended-rate questions in §9 first.
- **D4 — Coaches Experience A (spine) + the master-roster half of Phase C** for the Basic floor to be "real team management." Verified: today's Basic model is 3 org-less tables with no players/schedule/money — the coach free floor is almost entirely net-new build. The on-ramp's real gate is the org-less team-profile route + create path + D1/D2, **NOT** Phase C; the master roster + basic schedule + basic comms make the floor *compelling* and should land before it is *marketed* (see §10). The master-roster migration = the next free number (**≥114; NOT 112 — already taken by `games.duration_minutes`**). Coaches B/D/E are tournament-participant-specific; their standalone variants are owned by Phase 3.
- **D5 — Pressure ladder (from Coaches Experience).** In-portal pre-event surfaces stay **pitch-free**; the **one earned ask** is at the afterglow. The "free to operate" marketing pillar applies to the **public marketing site**, not the portal interior.
- **D6 — Free-floor caps enforced server-side (named dependency).** League Starter boundaries (seasons / divisions / teams / schedule / public surface / exports) must be enforced in the create/update **APIs**, not in React — house-league is module-gated today, **not cap-gated** (verified), so these caps are net-new. Every cap-hit is instrumented (§13) and renders an upgrade-aware screen even while paid League is early-access. *(Tournament-free caps already exist and are server-enforced — `tournamentLimit` / seat checks; the net-new cap work is League-Starter-specific.)*

## 5. Phased sequence (respects "team flip last")

**Phase 0 — Trust & honesty fixes** *(independent, ship now, no module risk)*
- Remove the **trial-vs-"Coming soon" conflict** on the League/Club pricing cards (they advertise a 30/90-day trial while marked "Coming soon" — a live trust hit a skeptical buyer reads as "not real").
- Resolve **"bracket bait"**: browser-confirm whether the free Tournament tier's brackets auto-generate (`playoff_generator` / `auto_schedule` are Plus-gated while free copy lists "single & double-elimination brackets"). Either make the free bracket genuinely useful and label auto-generation as **Tournament Plus**, or tighten the copy.
- **Tier-aware account framing** (Tournament/Tournament Plus: "Account & branding," not "organization profile" — these users have no "org" mental model).
- Reconcile **Coaches Portal pricing copy** ($29 standalone vs "$19 / 3-included under Club") into one story. Do not enforce the $19/3-included economics yet (copy-only today, unenforced in `PLAN_CONFIG`) but make the copy consistent.
- **Fix the live over-promise copy (verified trust bug):** coach surfaces (`app/coaches/page.tsx`, `teams/page.tsx`, `tournaments/[teamId]/page.tsx`, dashboard CtaCards) advertise *"run your team year-round — roster, lineups, schedule, dues, budget, documents"* as the free offer, but **everything except a basic roster / schedule / comms is Premium** — stop describing Premium as free.
- **Canonical taxonomy + stale-doc cleanup** (see §11): update **README** (still "four bundled SaaS tiers" — no free-floor layer), this plan's **PM brief** (still says revenue-bearing waits on the processing line — contradicts §9), and the **Timed Entitlements PM brief** (says "not started" while the first grant slice is built behind `ENTITLEMENT_GRANTS_ENABLED`).
- **Fix residual trial copy:** Tournament Plus annual still says "**14-day trial first**" (`components/PricingSection.tsx`) during the founding-season comp where Plus is free through 2026-12-31; and superseded trial language remains in `docs/agents/brand/PRICING_PAGE_COPY.md`.
- **Rule:** do **not** flip persona-page copy from "express interest" to "Start free — no credit card" ahead of the product. Copy follows product, per floor.

**Phase 1 — Account-first `/start` front door** *(D1 keystone)*
- Replace "persona detection at signup" with an explicit **`/start`** front door that **asks** the user their job first (run a tournament / start a small league season / coach a team / explore club). `/start/tournament`, `/start/league`, `/start/team` (or `/coaches/start-free`) create the appropriate workspace/context; `/home` gains a **"Start something new."**
- **Keep `/auth/signup` as the tournament-organizer deep link** (or refactor it behind `/start/tournament`) — stop making it the universal entry that always creates a tournament org.
- Move the plan gate **after** first value (or make "Continue free" visually dominant).

**Phase 2 — Existing-user multi-floor flow** *(D2)*
- `/create-org` for logged-in users + a "start a Basic team" entry. Lets one account hold multiple floors, surfaced at `/home`.

**Phase 3 — Standalone Basic Coaches Portal on-ramp** *(gate = org-less team route + create path + D1 + D2; master roster is a fast-follow, not a hard gate)*
- Allow creating a `basic_coach_teams` profile with no tournament registration.
- **Door can open thin** (team identity; migration 091 already has `source='coach_created'`) and enrich as the floor lands; **don't market the floor as an acquisition channel until master roster + basic schedule + basic comms ship.**
- Build the **option-C free coach floor** (§10): basic team schedule, basic team comms (email/notify to roster contacts — reuses Resend + notifications), the coach-self-recorded manual fee ledger, and the **standalone no-event "Team HQ" state** (reuses Coaches Phase D's shell, not its tournament phase model).
- **Standalone earned-ask** = the **lineups / documents / budget / dues-automation ceiling → express-interest** (online fee collection — the original pick — is deferred with payments §9; Premium isn't live, so the ask captures interest, not a checkout).
- **Privacy gate (in-phase):** a self-signed coach stores minors' DOB with no organizer vetting — set the consent/DOB posture before the door opens.

**Phase 4 — Free League Starter floor (capped beta)** *(depends on D1 + D6 caps; online-collection gate depends on D3)*
- New free-grade house-league entitlement: 1 season / ~8 teams / 1 division, auto-schedule + standings for that division, manual fee tracking, **+ one narrow public schedule/standings/registration page** (the first-value / share loop) — **no full public org site, no exports**.
- **Implementation = a free-floor entitlement profile, NOT a new `OrgPlan` key** (resolves open decision #1 — see §12): keep `plan_id` as the paid ladder; the free-floor profile contributes module entitlements + caps. Avoids touching `OrgPlan` / `PLAN_CONFIG` / rank / checkout / pricing tables.
- **Ship as a capped beta** ("Start a small season free" from a controlled page) until server caps + first-value data prove the boundary; only then fold into the main pricing/start pages.
- Scope-wall upgrade triggers → League (multiple seasons/divisions, 9th+ team, full org site, exports, custom fields/waivers, scale comms, online collection once it exists).

**Phase 5 — Payment-processing line (Flow B) — DEFERRED to a separate enhancement** *(see §9)*
- Net-new Stripe Connect build; **not on the free-tier critical path**. Subscription go-live (Flow A / Stripe Phase G) is separate and bounded by the Jan-2027 founding conversion (tracked under Stripe Integration / Founding Season GTM, not here).

**Phase 6 — Premium Coaches Portal standalone go-live** *(DEFERRED — owner's gate)*
- Flip `team` to `live` for paid Premium standalone checkout — only after **full team-module testing** + D3 + D1 routing. (`lib/plan-config.ts:22` — "To activate a plan, change this to 'live' — no other changes required" — but we gate it on testing + Stripe.)

**Phase 7 — Activation Trial — OUT OF THE LAUNCH MVP (Future Rail, see §15)**
- **Moved out of the launch path** — depends on the unbuilt `plan_tier` (effective-plan-rank) grant, and Club trialing carries higher support/expectation cost than a scoped free floor. **In the MVP, Club has NO self-serve free path — consultative/demo only** (guided sample-data walkthrough, concierge import assessment, "connect your existing Tournament/League/Coach contexts under one org once they exist"). Revisit as a separate project *after* free-floor activation data exists.
- **When revisited** *(depends on D3 + the Timed Entitlement Grants engine)*:
- One-time, self-triggered trial sampling the matching paid tier's depth; **auto-reverts to the free floor, never to zero**. Rides the Timed Entitlement Grants engine (`ENTITLEMENT_GRANTS_ENABLED`, currently OFF; the `plan_tier` grant type — raising effective plan rank — is the deferred piece that must be built). **Resolve founding-season `comp_period` coexistence first** (the comp silently mutates `plan_id` to `tournament_plus` with no auto-revert → two entitlement mechanisms on one org row).

**Phase 8 — Marketing surface flip** *(follows product, per floor)*
- Persona pages flip "Coming soon / express interest" → "Start free — no credit card" **as each floor ships**. Pricing-page reframe to "every operator starts free; paid = depth + scale + cross-module + online payments." Introduce the "free to operate" narrative pillar **only once the processing line is live**.

## 6. Risks & mitigations

- **Unfunded give-away / free-anchored base.** Mitigation: Basic is intentionally thin (no online collection, no deep workspace); online collection + depth stay paid; gate revenue-bearing floors and the trial behind D3. The free coach floor is the cheapest to give because Premium is a clean, already-built upgrade target.
- **Routing mis-route (D1).** Mitigation: D1 is a hard prerequisite to Phases 3–4, not validation.
- **Founding-season comp collision with the Activation Trial.** Mitigation: design coexistence before Phase 7; build the Jan-2027 conversion/notice flow (blocked on Stripe today).
- **Messaging complexity** ("three floors + a trial" vs a competitor's blunt "free"). Mitigation: per-floor crisp packaging + persona routing so each visitor sees only their floor.
- **Standalone Basic coach has no afterglow earned-ask.** Mitigation: the Phase 3 scope-ceiling trigger.

## 7. Open decisions (carry into build kickoff)

1. **Free League Starter caps + representation** — RESOLVED 2026-06-08: 1 season / ~8 teams / 1 division, enforced server-side (D6 / §12); represented as a **free-floor entitlement profile, not a new `OrgPlan` key** (§12). Still to confirm at kickoff: caps on players/registrations too (teams-only vs a registrant cap)?
2. **Standalone Basic earned-ask trigger** — RESOLVED 2026-06-07: the **lineups / documents / budget / dues-automation ceiling → express-interest** (online fee collection was the original pick but is deferred with payments, §9). Swap in online-collection once Flow B + Premium go-live.
3. **D3 processing rate target + realistic ship date** — validate FIRST; it gates the whole economics.
4. **Bracket behavior** — browser-confirm in Phase 0.
5. **Free League Starter public surface** — RESOLVED 2026-06-08: **one narrow public schedule/standings/registration page** (the first-value / share loop), **no full public org site** (that stays a League differentiator).
6. **Standalone Basic source value** — RESOLVED: use `coach_created` (already a valid `basic_coach_teams.source` per migration 091).
7. **DOB before tournament submission** — may a standalone Basic coach store minor DOB at all, or only when a tournament requires it? *(Lean: optional / purpose-driven, not a default field — privacy gate in Phase 3.)*
8. **First public league CTA** — "Start a small season free" vs "Join League Starter beta"? *(Lean: beta-framed until caps + first-value data prove it.)*
9. **Analytics owner** — which event system owns the §13 instrumentation? (Decide before the marketing flip.)
10. **Dormant-free-workspace retention policy** — define before broad launch (§14).

## 8. Success criteria

- Each of the three operator personas (organizer, coach, league admin) has a **complete self-serve FREE path** (today only the organizer does; coach/league dead-end at an email modal).
- Coach + league-admin **activation rate moves off ~0**.
- **Free → paid conversion via scope walls + the online-collection gate** (not a clock).
- **Coach → Club advocacy conversions tracked** (the afterglow org-bridge) — the stated #1 organic path to Club.
- **No persona-page copy advertises a product that isn't buyable** (trust-conflict eliminated).

## 9. Payment processing — deferred to a separate future enhancement *(decided 2026-06-07)*

**Decision:** the free-tier model ships with **no payment processing of any kind**. No participant payments are collected online, and no subscription tier charges a card during this work (consistent with Founding Season — the paid tiers are free through 2026-12-31 anyway). **All money handling stays manual fee tracking** (mark paid/unpaid, organizer-recorded) — already how the Basic Coaches Portal works. The **facilitated-payments "processing line" becomes its own enhancement project** with a dedicated, lengthy planning discussion before any build.

**Two money flows this separates — do NOT conflate them:**
- **Flow A — Subscriptions (org → FieldLogicHQ for a plan).** Built (Stripe Phases A–F); **Stripe Phase G = production cutover**, still off. Has its **own clock**: it is bounded by the **Founding-Season conversion (Jan 1 2027)**, when free founding orgs are positioned to convert to paid. "Not processing payments yet" is correct *now*, but Phase G + the 4C conversion flow must land **before that cliff** — it is **NOT** part of the deferred Flow-B enhancement and is **not** freely deferrable. Tracked separately (Stripe Integration / Founding Season GTM).
- **Flow B — Facilitated payments (participant → org, platform takes a per-transaction margin).** **Zero infrastructure today** (no Stripe Connect, no `application_fee`, no connected accounts — verified). The net-new "processing line." **Deferred in full** to a future enhancement; freely deferrable (no deadline).

**Parked for the future Flow-B planning discussion (so it starts from a known list):**
- **Fee-bearer model** — org-absorb vs **participant-paid service fee** (the youth-sports norm; recommended) vs org-choice. The defining product decision.
- **Blended-rate feasibility** — reselling vanilla Stripe (~2.9% + C$0.30) **cannot** beat RAMP's sub-2% *org-absorbed* rate; the realistic path is **participant-paid fee + a modest platform margin**, or negotiated/volume Connect pricing, or an alternative payfac. Validate before committing the "funded by processing" model.
- **Mechanics** — Connect account type (Express likely), onboarding UX, payouts, refunds/disputes/chargebacks, reconciliation into the Accounting module, receipts, Canadian GST/HST handling.
- **Surfaces it lights up** — tournament registration fees (`online_tournament_payments`), Coaches Portal dues, house-league registration, gate/at-gate.
- **Economic model (build before promising "funded by processing"):** average registration volume by org type · expected payment-adoption rate · refund/dispute rate · payout cadence · support burden · gross margin after Stripe/Connect costs · absorb-vs-pass-to-families. **Concrete Stripe Connect Canada pricing (verified 2026-06-08):** if Stripe handles pricing the platform may qualify for revenue share; if the platform handles pricing, Stripe adds **CA$2 per monthly active connected account + 0.25% + CA$0.25 per payout** and the platform owns processing fees — so margin is a real design choice, not a given.

**What this changes in the free-tier model (interim, pre-Flow-B):**
- Every free floor ships as **free + manual fee tracking**; the "Pay now / collect online" capability and the **"online collection" upgrade trigger move to the Flow-B enhancement**.
- **Conversion is driven by scope/feature/scale walls** (2nd tournament, 2nd division, 9th team, lineups, documents, cross-module visibility) — all of which work with no payments. Only the "want to collect fees online" trigger is absent in the interim.
- The **"free to operate, funded by payment processing" revenue story is the END state, not the launch posture.** Until Flow B ships, free floors are funded by **subscription conversions** of orgs that outgrow them (post-founding-season).
- **Known interim competitive gap:** orgs that specifically want **online registration payment collection** (a RAMP/TeamLinkt feature) won't get it on FieldLogicHQ yet. Acceptable for the founding cohort (tournament organizers, small leagues, coaches who take e-transfer/cash and track manually); carried by the platform's other differentiators; revisit when Flow B is scoped.

**Net effect:** D3 is **removed from the critical path of the free-tier rollout.** The free floors (Phases 0–4), persona routing (D1), and the multi-floor account flow (D2) **no longer wait on any payments work.** The Activation Trial (Phase 7) and the paid Coaches Portal go-live (Phase 6) still depend on the relevant payments piece and remain deferred accordingly.

## 10. Coaches free/paid line (verified, opt-C) + integrated execution sequence *(2026-06-07)*

Grounded in a code-verified review of the Coaches Experience plan + the actual Basic-vs-Premium split. **Key correction:** today's free Basic model is 3 org-less tables (`basic_coach_teams` + users + registrations, migration 091) with **no players, no schedule, no money, no events** — everything operational is Premium (the org-scoped `team_workspaces` rep-teams stack). So the free coach floor is **almost entirely net-new build**, and several items earlier listed as "free" are actually Premium.

### Free vs paid (locked, option C)

**FREE — no-tournament floor** *(the genuine standalone floor; net-new):*
- Org-less team profile/identity · multi-team switcher
- **Master roster** — players (name / jersey / contact, optional DOB). *Identity only — NOT attendance (attendance is Premium).*
- **Basic team schedule** — add practices/games, parents see it. *Not the Premium power-calendar.*
- **Basic team comms** — announce to parents (email/notify to roster contacts; reuses Resend + notifications; parents are contacts, not accounts).
- **Coach-self-recorded manual fee ledger** — mark paid/unpaid against the roster (only meaningful once the roster exists).
- Standalone **Team HQ** home state (roster completeness + fee status + next event).

**FREE — tournament-participant only** *(empty for a no-tournament coach; must NOT lead the standalone floor):*
- Tournament registration history/status · read-only organizer-published schedule · game-day bridge (follow / alerts / public deep links).

**PREMIUM ($29 standalone / $19 in Club)** — the "serious operator" line:
- Lineup builder (batting order / positions / PDF) · power-calendar (recurring events, week/month, export) · attendance · **dues automation** (schedules / installments / reminders / online collection) · team budget · documents (waivers / medical / consent) · season-setup checklist.

**The firm line:** *manual* fee tracking is free, *dues automation* is paid; *basic* schedule is free, *power-calendar + lineups* are paid. Rationale: the free coach is the **advocacy engine** (every active free coach seeds a future Club — the #1 organic path), so the floor is deliberately generous enough to retain the coach and pull parents in; Premium keeps the high-value automation/treasurer-grade tools.

### Integrated execution sequence (Free Tier × Coaches Experience)

1. **[Spine]** Org-less team-profile route + access-context resolver (`getUserAccessContexts` has no resolver for a bare `basic_coach_team` today) + IA — **decide the URL up front** (distinct, identity-resolved; do NOT overload the Premium `/coaches/teams` list). *Owner: Coaches Phase A, promoted to a first-class deliverable.*
2. **Coaches Phase A remediation** — fix residual inline-style ghost tokens (→ `--text-secondary` / `--text-tertiary`, NOT `--text-muted` which also doesn't exist), the still-live "when you register" empty-state copy, and `btn-primary` / `btn-sm` convention nits. *Phase A is "mostly built, needs a verified pass," not green.*
3. **Free Tier Phase 0** — trust/honesty, **including the live over-promise copy fix**.
4. **Free Tier Phase 1** — D1 persona routing.
5. **Free Tier Phase 2** — D2 multi-floor + "start a Basic team."
6. **Free Tier Phase 3 (door opens thin)** — standalone on-ramp on the spine + create path; build the option-C floor (schedule / comms / fee-ledger) + standalone Team HQ + privacy gate + earned-ask.
7. **Coaches Phase C (master roster) — fast-follow** that makes the floor compelling (privacy gate, migration ≥114). **Market the floor once this lands.**
8. **Coaches B / D / E** — tournament-participant value, parallel. B generalizes its status component (organizer- OR coach-authored source); D extracts a shared shell (Phase 3's standalone hero reuses it) and its tournament Team HQ stays tournament-only; E afterglow stays tournament-only and its $19/$29 bridge becomes **express-interest** until Premium go-live.
9. **Free Tier 4–8** — unaffected; none of Coaches A–E wait on payments (§9).

## 11. Canonical product taxonomy *(added 2026-06-08, per external review)*

Two internal layers — keep them distinct in code and docs:
- **Workspace / account type** — *organization workspace* (tournament/league/club), *coach team workspace* (`team_workspaces`, Premium) / *Basic coach team* (`basic_coach_teams`), *official context*.
- **Commercial entitlement** — *free floor* (scoped free entitlement), *paid subscription* (org `plan_id`), *temporary grant* (timed override).

**Internal language:** free floor · operator start (the onboarding path) · workspace (the thing created) · paid plan (org subscription) · temporary grant. Avoid "free tier" internally — "tier" already means a paid org plan.

**Customer language = jobs, not taxonomy:** "Run one tournament free." · "Start a small league season free." · "Create a free team home for your season." · "Upgrade when your operation needs more scale, automation, payments, or club-wide control." Update README to layer free floors over the four paid tiers.

## 12. Technical model — entitlement profile + server-side caps *(added 2026-06-08)*

**Don't overload `OrgPlan`.** Keep `plan_id` as the paid ladder (`tournament` / `team` / `tournament_plus` / `league` / `club`). Add a **free-floor profile** that contributes module entitlements + caps; compute **effective entitlements** from `paid plan + add-ons + temporary grants + free-floor profile`:

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

**Server-side cap checklist (D6) — enforce in APIs, not React:**
- *League Starter:* block 2nd active season (`POST .../house-league/seasons`); block 2nd division (`.../divisions`); block >8 teams incl. bulk (`.../teams`); schedule generator only for the included season/division; narrow public page only (block full org-site publish); block CSV/PDF/report exports.
- *Tournament Free (already enforced — keep consistent):* 1 active tournament; no `auto_schedule`; no `playoff_generator` batch; manual game/playoff management allowed; no exports.
- *Basic Coaches Portal:* standalone + registration-linked creation; no Premium fields/pages/APIs; roster fields scoped to Basic; attach registrations by explicit link (no email fallback).

**Existing-user add-workspace checklist:** "Start something new" on `/home` → authenticated users route to `/start` **without forcing signup**; allow new tournament org / new League Starter workspace / new Basic coach team; reuse `/home` after creation; **separate auth from workspace creation** so existing emails don't error.

## 13. Instrumentation & first-value *(added 2026-06-08 — gate the marketing flip on this)*

Without event-level tracking we can't tell activation from empty-account creation. Wire these before any broad "start free" messaging:

`signup_persona_selected` · `free_floor_created` · `existing_user_floor_added` · `first_value_reached` · `scope_wall_hit` · `upgrade_intent_clicked` · `express_interest_submitted` · `coach_team_created` · `coach_roster_created` · `coach_event_connected` · `league_season_created` · `league_schedule_generated` · `league_public_page_shared` · `tournament_published` · `tournament_afterglow_prompt_shown` · `coach_advocacy_referral_clicked`.

**First-value definitions:** *Tournament* = published with ≥1 division + public schedule/bracket. *Coach* = Basic team created with a roster or a linked tournament registration. *League Starter* = season created + teams + schedule generated + public link shared. *Club* = n/a until consultative / Activation-Trial activation exists.

## 14. Support & abuse controls *(added 2026-06-08)*

Free floors add operational risk (dormant orgs, duplicate teams, accidental minor-PII, spammy public pages, non-paying support load, cap-bypass). Minimum controls: rate-limit workspace creation per user/email/domain/IP · require email verification before any public publishing · define dormant-free-workspace retention · duplicate-detection prompts on similar org/team names · admin visibility for free-floor creation + cap hits · keep sensitive roster fields minimal until a workflow needs them.

## 15. Execution rails *(added 2026-06-08 — supersedes the §5 ordering for launch scope)*

**Launch Rail (self-serve free starts):** (0) trust + canonical-language cleanup → (1) account-first `/start` + existing-user add-workspace → (2) free-floor entitlement + cap primitives (§12) → (3) Free Tournament cleanup → (4) standalone Basic Coaches Portal → (5) League Starter **capped beta** → (6) marketing flip **by floor** (Tournament first, Coaches after Basic is live, League after the beta is stable; Club consultative). **Gate the flip on §13 instrumentation.**

**Future Rail (monetization expansion):** Premium Coaches Portal paid launch · Stripe subscription cutover after founding season (Flow A / Phase G) · payment-processing Flow B (Connect) · processing-funded public positioning · Club Activation Trial (needs `plan_tier` grants first).

*(The §10 Coaches × Free-Tier integrated sequence still governs the coach-floor spine ordering; the cap-primitive prerequisite means caps land just-in-time before the League Starter beta, not before the coach floor. This rail view is the program-level structure.)*

## 16. Journey-audit pricing inputs (J1, routed 2026-06-11)

Two free-tier friction findings from the J1 organizer journey are pricing decisions, not bugs (evidence in docs/projects/active/journeys/JOURNEY_J1_TOURNAMENT_ORGANIZER.md):

- **J1-072** — the free tier has zero registration export (no CSV for gate lists / insurance). Consider one basic CSV (or a print view) on free; keep XLSX/PDF/custom-field exports as Plus.
- **J1-078** — the free 3-seat cap counts scorekeepers, so a 3-diamond weekend cannot be staffed on free. Consider making official/scorekeeper seats free on all tiers and capping admin/staff seats only.

Related context from the same walk (kept in the audit backlog, same free-tier value story): J1-104 (archiving last year's event makes its results unviewable on free) and J1-113 (in-admin upsells never mention Plus is $0 during the Founding Season).
