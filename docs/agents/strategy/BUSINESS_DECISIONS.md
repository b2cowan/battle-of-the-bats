# FieldLogicHQ — Business Decisions Log

**Canonical, binding record of durable business decisions** (pricing, packaging, positioning, GTM/segment focus, monetization, commercially-driven roadmap sequencing). Maintained by the `/strategy` agent. Newest first.

**Status legend:** `Decided` (ratified by the owner) · `Proposed` (recommended, awaiting ratification) · `Superseded by [#]` · `Reversed`.

**How this file is used:** `/strategy` reads it on every invocation — entries marked `Decided` are binding across all chats unless explicitly superseded. Customer-facing changes carry a **Handoff** to `/marketing` (copy), `/billing` (gates), and/or `/plan` (build). Do not delete history — supersede.

---

### 2026-06-26 — In-app paid→paid UPGRADE proration is not built (resolves Club-band open question)
**Status:** Decided (current-state truth + interim posture; tracks a build gap)
**Decision:** There is **no in-app path to upgrade between paid plans with proration** — and that is the **known, accepted interim state**, not a silent bug. Self-serve checkout always opens a *new* subscription, so an org that already pays and "upgrades" to a higher paid tier (Tournament Plus → League Plus, or **Club → Club · Association**) would get a **second, parallel subscription = double-billing** rather than a re-priced single one. In-app re-pricing-with-proration exists **only on the downgrade direction** (a paid→lower-paid or paid→free move reconciles Stripe correctly). **Interim rule until the upgrade path is built: paid→higher-paid moves must be done in the Stripe Dashboard** (edit the subscription item + apply proration manually); do not route an existing paying org through self-serve checkout to upgrade.
**Resolves:** the `CLUB_REPACKAGING_PLAN.md` open question "Mid-cycle band changes (Club ⇄ Club · Association): proration + upgrade/downgrade path." Answer: **downgrade = handled in-app with proration; upgrade = NOT built (Dashboard-only today).**
**Rationale:** Surfaced by a billing-agent code trace (2026-06-26) while defining the platform-admin "plan change ≠ billing change" operator copy (walkthrough finding B.1). Worth a logged entry because it's a real revenue/trust risk (double-billing a customer who tries to pay us *more*) and it gates the smooth-upgrade story for the new Club bands — leaving it as an un-owned "open question" is how it gets shipped around.
**Affects:** billing mechanics, Club-band upgrade experience, operator/owner billing guidance, roadmap.
**Handoff:** → `/plan` scope an in-app paid→paid upgrade-with-proration path (detect an existing active subscription and re-price the item with `create_prorations` instead of opening a new checkout); prioritize before Club · Association upgrades become common. · → `/billing` until then, guard self-serve checkout against creating a second subscription for an already-paying org, and ensure the platform-admin walkthrough B.1 copy + operator guidance state plainly that upgrades are Dashboard-only and the operator plan-change never calls Stripe (its only Stripe-touching control is Cancel Subscription). · → `/marketing` no customer copy should imply a one-click paid-to-paid upgrade until the path exists.
**Relates to:** the 2026-06-22 Club capacity-bands decision (this is the unbuilt half of its mid-cycle move story).

### 2026-06-25 — Premium Coaches Portal exit: cancel-only, no downgrade-to-free
**Status:** Decided (ratified 2026-06-25)
**Decision:** A Premium Coaches Portal coach has **no self-serve "downgrade to free (Basic Coaches Portal)" path** — by design. **"Cancel Premium" is the single exit**: it cancels the subscription, the Premium workspace goes inactive into the retention window, and the only return is **reactivating the same Premium** within that window (after which it purges). **No reverse data migration** (Premium roster/schedule/fees are *not* carried back into the free Basic team) and **no data export** on cancel. We deliberately do **not** make it easy to flip-flop between paid and free.
**Rationale:** Coaches don't need an easy paid↔free bounce, and because free Basic and Premium are **separate data models** (free is a *subset* — lineups/attendance/budget/documents don't exist in free), a "downgrade" would be inherently lossy. Cancel-with-reactivation is sufficient. Chosen as the "make cancel honest & safe" option over building parity, **minus the export** (owner ruling, 2026-06-25, after a code-mapped analysis of the org-vs-coach exit paths).
**Contrast:** Intentionally **differs from orgs**, where Tournament Plus → free Tournament is a clean self-serve downgrade (same org flips to the free tier, data retained). For coaches it is cancel-only.
**Affects:** packaging/exit model, coach cancel copy, coach-portal data hygiene. Pre-launch — the intended model from launch, not a change to live behavior.
**Handoff:** → `/marketing` (pre-launch) the Cancel Premium flow must state up front, *before confirm*, exactly what cancel does: the Premium portal + its data stay only through the reactivation window then are removed; the original free team remains but with **pre-upgrade data only**; Premium-era work does not carry back — so there is no "where did my data go" surprise. · Code: a data-hygiene fix (a cancelled/purged portal must not leave the free team pointing at a dead workspace) is being done this session, outside this log. · **Not building:** a downgrade-to-free UI, a reverse migration, or an export.
**Relates to:** the coach-portal free-vs-paid **separate-models** architecture decision (org-less `basic_coach_*` free vs org-scoped `rep_*` paid; copy-migrate on upgrade; "account-per-free-coach" unification noted as a future option). This exit-model decision is downstream of that separation.

### 2026-06-22 — Adopt a Business Decisions Log + `/strategy` steward
**Status:** Decided
**Decision:** Durable business decisions (pricing, packaging, positioning, GTM, monetization) are tracked here and stewarded by the `/strategy` agent, which hands copy to `/marketing`, gates to `/billing`, and plans to `/plan`. Scope = all business decisions, not just pricing.
**Rationale:** Pricing/product decisions were scattered across memory files, brand docs, and the README with no single source of truth and no owner to keep customer-facing copy in sync — which is how contradictions arise (e.g. the free-plan email-gate inconsistency below).
**Affects:** process/governance.
**Handoff:** none (meta).

---

### 2026-06-22 — Plan & pricing single source of truth + drift governance
**Status:** Decided
**Decision:** Establish ONE canonical reference for live plan/pricing/packaging facts — `docs/agents/strategy/PLAN_PRICING_FACTS.md`, kept matched to the app's plan configuration — and stop restating prices/names/gates in other docs. Brand strategy (§5/§7), the pricing-copy appendix, and the pricing memory file become **pointers**, not copies. `/strategy` runs a **drift check** (the checklist at the bottom of the Facts doc) on every pricing/packaging change and before any billing release; any agent touching a pricing fact **reconciles to the Facts doc and flags divergence to `/strategy`** instead of silently writing a new number. Any change updates the Facts doc + app config in the same unit of work.
**Rationale:** The same fact lived in ~5 hand-maintained places and drifted — the League/League Plus split was right in 2 docs and wrong in 3, surfacing only by luck during the marketing pass. Fewer copies + one owner + a check-on-change prevents customer-facing contradictions (a plan card promising what the table gates away, a price that disagrees with the app).
**Affects:** process/governance, all pricing/packaging docs.
**Handoff:** done this session — Facts doc created; brand §5/§7 + pricing memory converted to pointers; `CLAUDE.md` guardrail added. → `/marketing` convert the `PRICING_PAGE_COPY.md` appendix table to a pointer in its next pass.

### 2026-06-22 — League naming: free "League" floor + paid "League Plus" ($89)
**Status:** Decided (ratified 2026-06-22)
**Decision:** The $89/mo paid house-league tier is **"League Plus"**; a **free "League" floor** sits beneath it — mirroring Tournament (free) → Tournament Plus (paid). This **confirms the deliberate 2026-06-13 rebrand** (`docs/projects/archive/LEAGUE_REBRAND_PLAN.md`) and **corrects** the earlier framing (in this log + `BRAND_STRATEGY.md` §5/§7) that treated "League Plus" as a typo. Internal keys unchanged (paid tier `plan_id='league'`; free floor `free_floor='league_starter'`). Never write "League Starter"/"Starter" in customer copy.
**Rationale:** The newer, deliberate rebrand — with its own plan and already live in customer copy and the app label — supersedes the older general "four tiers: …League…" statement in the brand doc. The free→paid "Plus" parallel is learnable and feeds the free-tier acquisition funnel; reverting would orphan a shipped free tier. **Caveat:** the free "League" floor is held for a later public launch, so "League Plus" reads oddly in isolation until then — a launch-sequencing wrinkle, not a naming problem.
**Affects:** positioning, pricing copy. (App plan-config label was already correct.)
**Handoff:** → `/marketing` ensure `/pricing` + `/for-leagues` reflect League (free) / League Plus (paid) when the free floor launches; brand §5/§7 already corrected this session.
**Supersedes:** the "League Plus is a typo / canonical is League" note in the early-access entry below, and any "League $89" line in `BRAND_STRATEGY.md` §7.

### 2026-06-22 — No separate "select/development" team pricing
**Status:** Decided (ratified 2026-06-22)
**Decision:** Select and development teams are treated **identically to rep teams** on the platform — they count equally toward the Club capacity bands and receive the full platform (scheduling, accounting, budgeting, lineups, Coaches Portal). There is **no discounted lighter tier** for mid-level teams; whether to put them on the platform is the club's choice. This **resolves the open question** that previously gated the two Club decisions below: every team a club adds counts toward the band, and each gets a portal.
**Rationale:** No "select"-grade product exists to justify a discount, and every team consumes the same services even if a given team uses fewer of them. A separate cheaper class would also invite gaming the band thresholds. (Owner ruling, 2026-06-22 strategy session.)
**Affects:** plan config, pricing copy, positioning.
**Handoff:** → `/marketing` band/portal copy must convey "every team counts, full tools for each" — no implied select discount · → `/billing` band team-count includes all team types equally.

### 2026-06-22 — Coaches Portal: include the whole coaching staff in Club; retire the per-team meter
**Status:** Decided (direction; dollar thresholds set by the capacity-band decision below) — *ratified 2026-06-22*
**Decision:** Include the Premium Coaches Portal for a club's **whole coaching staff** in the Club plan; **retire the "$19/mo per team beyond 3" meter** entirely. Keep the **$29/mo standalone** portal for org-less coaches (a different buyer — do not cannibalize). Club-size differences are captured by the capacity bands below (and, later, payment volume), not a per-team meter.
**Rationale:** ~85–90% of Club buyers run more than 3 teams (median ~10), so "3 included + $19" made Club's *real* price ~$270–350/mo and taxed the exact coach-adoption loop that is the product's main in-org advocacy surface. Per-team metering also collided with the "no seat limits" posture and the free Basic floor. (Pricing & product review, 2026-06-20; club-size research, 2026-06-22.) Open question on mid-tier teams **resolved** by the "no separate select pricing" decision above.
**Affects:** plan config, pricing copy, positioning.
**Handoff:** → `/billing` retire the per-team meter; whole-staff portals included in Club · → `/marketing` re-frame Club as "whole coaching staff included," and **rewrite the coach pricing bridge** (the "$19/mo, $10 less than standalone" line is gone — new bridge: standalone $29 until your org joins Club, then your portal is *included*, you stop paying) · → `/plan` rollout plan.
**Supersedes:** the "3 team accounts + $19/additional team" structure in `BRAND_STRATEGY.md` §7 and the Segment 3/4 pricing-bridge copy.

### 2026-06-22 — Club pricing structure: capacity bands, not flat and not per-team meter
**Status:** Decided (structure + 15/30 boundaries; price points are the launch anchor, calibratable Q1 2027) — *ratified 2026-06-22*
**Decision:** Price Club as **two flat capacity bands**: **Club** (full platform + whole-staff coach portals, up to **15 teams**) at **~$219/mo**, and **Club Large / Association** (15–**30** teams) at **~$379/mo**, **custom above 30**. Band boundaries are **fixed at 15 and 30 teams regardless of team type** (all teams count — see "no separate select pricing"). The $219 / $379 figures ship as the **working launch anchor** and recalibrate from real conversion data in Q1 2027.
**Rationale:** A single flat price either undersells big associations or prices out small clubs; two bands capture both while staying predictable (volunteer treasurers hate variable bills) and avoiding per-unit nickel-and-diming. Boundary placed at the natural club/association gap so the numerous 8–12-team buyers sit cleanly inside the lower band. (Strategy discussion, 2026-06-22.)
**Affects:** plan config, pricing copy, positioning, README.
**Handoff:** → `/billing` two-band Club at 15 / 30 caps; custom quote above 30 · → `/marketing` band cards + comparison table + `/for-clubs` "what you pay"; **settle the "Club Large / Association" plan name** (brand canon owns plan names) · → `/plan` build plan.

### 2026-06-22 — Reprice Club upward from $179 (realized via the lower band)
**Status:** Decided — *ratified 2026-06-22*
**Decision:** The standard Club price moves up from $179; the uplift is **realized by the ~$219 lower band** above (the $199–249 range is superseded by that concrete figure). A **flat $179 Founding-rate lock** remains on the books as a *forward-looking* principle (never raise prices on a cohort you're converting) but is **dormant — there are currently no founding $179 clubs**, so no grandfathering is required. Calibrate the standard figure from conversion data in Q1 2027.
**Rationale:** The typical buyer is a large, high-value club; Canadian comparables (Crossbar ~$1,350 CAD/yr, Uplifter Gold) and module depth support a higher anchor. Adversarial review rejected an immediate jump to $229+ as premature — hence anchor-now / calibrate-later. (Pricing & product review, 2026-06-20.)
**Affects:** pricing copy, plan config.
**Handoff:** → `/marketing` Club priced at the new band anchor; founding-rate-lock framing held in reserve (no active cohort) · → `/billing` standard Club rate = lower-band price for new subscribers.
**Supersedes:** the $179/mo Club price in `BRAND_STRATEGY.md` §7.

### 2026-06-22 — Monetization: facilitated payments are the real size-scaler (scope Q4 2026, launch H1 2027)
**Status:** Decided (direction + sequencing). Rate / who-pays default / processor / legal posture remain **Proposed** pending Q4 scope. — *ratified 2026-06-22*
**Decision:** Pursue facilitated payments (a participant→org take-rate, family-pays default) as the primary mechanism that scales revenue with club size and funds the free floors. **Formally scope in Q4 2026; target H1 2027 launch** — deliberately *not* before the Jan 2027 billing cliff. The current "no payments" posture was always a **temporary setup-phase deferral**, not a strategic stance against payments — this is the planned graduation once the app is stable/productionalized, not a reversal of conviction.
**Rationale:** Every dominant Canadian competitor (RAMP, TeamLinkt, Spond) gives software away and earns on payments; a flat subscription alone leaves the biggest value metric uncaptured and is a harder sell against free. Sequencing matters: KYC friction + trust risk during a "free" season make a pre-cliff launch dangerous. (Pricing & product review, 2026-06-20.)
**Affects:** monetization model, roadmap, positioning.
**Handoff:** → `/plan` write the facilitated-payments scoping plan + PM brief (Q4 2026). **Must resolve in scope:** the "~2.5% + $0.30" figure is ambiguous and likely mis-stated — clarify whether it is FieldLogicHQ's **margin on top of** processor cost (~2.9% + $0.30, viable, lands ~5.4% all-in in competitor range) or an **all-in** rate (underwater on every transaction). Also resolve family-pays-vs-org-pays default, processor choice, and Canadian KYC / money-transmission / refunds / chargeback posture with counsel.

### 2026-06-22 — GTM: serve all club sizes via structure; focus acquisition on the mid-size beachhead
**Status:** Decided — *ratified 2026-06-22*
**Decision:** Pricing serves both small clubs and large associations (via bands + future payments), but **acquisition focus** is the mid-size, dual-stream suburban club (~8–14 rep teams) — numerous, able to pay (sits in the $219 lower band), self-serve-able — then land-and-expand up to large associations and down to small clubs. This is a **focus, not an exclusion**: a large association or small club that walks in is served; the spear simply points at the middle.
**Rationale:** Pricing architecture ≠ go-to-market focus. Inclusive pricing and a concentrated sales motion coexist; the mid-size dual-stream club is the lowest-hand-holding, highest-volume entry point and aligns with the tournament-funnel thesis. (Strategy discussion, 2026-06-22.)
**Affects:** positioning, GTM.
**Handoff:** → `/marketing` persona-page emphasis and acquisition messaging centered on the mid-size dual-stream club.

### 2026-06-22 — Founding-Season conversion mechanics: September annual lock-in opt-in
**Status:** Proposed — *owner deferred 2026-06-22; revisit when a real founding cohort exists and the cliff date is firm.*
**Decision (proposed):** Convert the Jan 2027 billing cliff into a warm opt-in — an annual-commitment offer ("commit annual before the deadline, lock your founding rate") to orgs that have **actually run a real event**, with the offer **triggered by having run that event rather than a fixed calendar date** (tournament orgs in early autumn; season-based League/Club orgs later, once they've lived a season). **Not** a graduated discount ramp (rejected — it creates a second cliff).
**Rationale:** The Founding Season has no conversion mechanics; an event-triggered annual opt-in creates prepaid, committed founding customers without anchoring the cohort to a discount. **Deferred** because it is entirely forward-looking — there is no founding cohort yet, the cliff is ~7 months out, and the send is legally gated regardless; nothing is lost by deciding it closer to the event with more information. (Pricing & product review, 2026-06-20.)
**Affects:** lifecycle/email, billing.
**Handoff:** none yet (deferred). **When activated:** → `/marketing` the opt-in email/banner · → `/billing` annual checkout. **Blocked on:** CASL consent posture (signup captures opt-out, not express opt-in) — confirm lawful basis with counsel before any commercial send.

### 2026-06-22 — Open League + Club to managed early-access after a product-hardening sprint (~Aug 2026)
**Status:** Decided (intent + cohort shape). Open date is **contingent** on a `/plan`-defined readiness checklist, not a fixed August commitment. — *ratified 2026-06-22*
**Decision:** Open **League** and **Club** to a **founder-managed** early-access cohort (5–10 Club, 10–15 League) under the Founding-Season comp, **after** the core flows are self-serve-verifiable by a real admin. Target ~August 2026. Don't open today; don't run open-door self-serve.
**Rationale:** You can't validate willingness-to-pay on the highest-ACV tiers while they're non-purchasable — and every Club decision above is currently untested against a single paying club. A small managed cohort produces that validation (and the cohort the deferred conversion play would later convert) without an open-door launch that accelerates the cliff and damages word-of-mouth. (Pricing & product review, 2026-06-20.)
**Affects:** GTM, roadmap.
**Handoff:** → `/plan` define the "ready to open" go/no-go checklist + hardening scope (this gates the open date). **Naming (resolved 2026-06-22):** the paid tier opened here is **"League Plus"** ($89) — see the League naming decision above. ~~Earlier note treated "League Plus" as a typo; that was wrong and is superseded.~~

### 2026-06-22 — Fix the free-tier email-gate contradiction
**Status:** Decided — *ratified 2026-06-22*
**Decision:** Resolve the contradiction where the free Tournament card promises "basic team/contact email" but the comparison table gates all email to Plus: **a basic all-team announcement is free**, and **templates, scheduling, delivery tracking, and segmentation are gated to Tournament Plus**. Reframe the Plus story as "announcements free, communications **workflow** paid."
**Rationale:** Contradictory copy on the primary acquisition page reads as a broken promise; this also closes a competitive gap (free competitors give basic email). Low-risk — the product already supports basic email on free. (Pricing & product review, 2026-06-20.)
**Affects:** pricing copy, comparison table, plan config.
**Handoff:** → `/marketing` reconcile the free card + comparison table around "announcements free, workflow paid" · → `/billing` enforce the split and add a **light volume guard on the free announcement** (mirror the Basic coach floor's ~100-contact / 10-sends-per-24h cap) to prevent abuse.

### 2026-06-22 — Exclude officials/scorekeepers from the free-tier 3-seat count
**Status:** Decided — *ratified 2026-06-22*
**Decision:** Don't count officials/scorekeepers (the most restricted, score-entry-only role) against the free Tournament plan's 3-seat cap; keep the cap for admin/staff seats only.
**Rationale:** Counting them punishes orgs running legitimate multi-field events with zero monetization upside — and those multi-field events show the product at its best. No abuse vector, since it's the most restricted role by design. Trivial change. (Pricing & product review, 2026-06-20.)
**Affects:** plan config, FAQ.
**Handoff:** → `/billing` exempt the score-entry-only roles (officials/scorekeepers) from the free-tier seat cap · → `/marketing` one-line FAQ clarification.

---

## Findings & context (not decisions — the evidence base behind the proposals above)

- **Competitive landscape (2026-06-20 review, 15 competitors):** The Canadian grassroots market is dominated by *free* software (RAMP, TeamLinkt, Spond) funded by payment take-rates (2.9–5% + fixed). US incumbents charge real money but are mostly USD-only, demo-gated, and opaque — a transparency/CAD gap FieldLogicHQ can exploit. Tournament Plus ($39) and League Plus ($89) are well-calibrated vs comparables; Club ($179) was under-priced; Premium Coaches Portal ($29) is defensible after FX (≈ TeamSnap Ultra).
- **Typical Canadian club size (2026-06-22 research, medium confidence):** Median target Club buyer runs **8–12 rep/competitive teams** (~10). Small 3–6, large 18–32+. ~85–90% of Club buyers exceed the old 3-included floor. By sport: hockey 8–12 (10–20 combined genders), softball 6–8 (9–13 with select), basketball 12–18, soccer 10–20, baseball 8–14. No official source — triangulated from real club rosters.
- **Adversarial review caution:** 10 of 16 aggressive "do-it-now" pricing moves were rejected as premature at zero customers. Theme: the Founding Season is a *product-validation* window; price-point fine-tuning becomes answerable only after 30–50 orgs run real seasons.

## Source documents
- Pricing & product review (2026-06-20): competitive analysis + 7 lenses + adversarial verification (run via multi-agent workflow).
- Canadian club team-count research (2026-06-22): per-sport rep-team counts + verification.
- `memory/project_pricing_strategy.md`, `memory/project_free_tier_strategy.md`, `docs/agents/brand/BRAND_STRATEGY.md`, `docs/agents/brand/PRICING_PAGE_COPY.md`.
