# Founding Season — Coaches Free Extension + Billing Correctness Plan

**Status:** PROPOSED (owner directive 2026-07-20; awaiting plan approval to start build)
**Owner directive:** "I want the premium coaches portal free until January 1st and everything broken needs to be fixed… get it so that Tournament Plus and Premium Coaches Portal are free for users until 2027." Manual January conversion is explicitly acceptable (owner will mass-email + manage subscriptions by hand; current volume: 1 org / 2 free tournaments). Strategic goal: users on the platform giving feedback in 2026; free pricing justifies the beta feel.
**PM brief:** `FOUNDING_SEASON_COACHES_FREE_PM_BRIEF.md`
**Predecessor docs:** `FOUNDING_SEASON_PLAN.md` (Tournament Plus promo, shipped), audit results 2026-07-20 (two ultracode workflow runs, adversarially verified).

---

## End state (definition of done)

1. A brand-new organizer goes nudge → signup → free Tournament org → self-serve **Tournament Plus at $0** (already live) with no billing surface that can charge them before 2027-01-01.
2. A coach goes "Coach a team" → **free Basic Coaches Portal** (live, self-serve) → optional **Premium Coaches Portal at $0 until 2027-01-01** (new comp path), fully self-serve.
3. Nothing anywhere on the platform can improperly charge a card in 2026; the only card surface is an explicit card-on-file save (Oct 1–Dec 31 window) that charges $0.
4. All pricing surfaces, `lib/plan-config.ts`, `PLAN_PRICING_FACTS.md`, and `BUSINESS_DECISIONS.md` agree (drift check passes).
5. January 2027 conversion is a documented **manual runbook** (owner-executed), not automation.

## Verified problem inventory (from 2026-07-20 audits — all confirmed by adversarial verify)

| # | Problem | Severity |
|---|---|---|
| P1 | "Add payment method" button (billing page, Oct 1–Dec 31 window) actually opens a full subscription Checkout with a 14-day trial → would bill ~14 days after click, before Jan 1, contradicting the banner's "no card required until Jan 1" | **Critical (fix before Oct 1)** |
| P2 | `plan_gating.team` = `'live'` on **prod + dev** (seeded by mig 065, never audited/changed) while docs/copy say early-access → the $29/mo Premium Coaches Portal checkout is chargeable on prod TODAY (live Stripe price IDs set 2026-06-02; `team_workspaces` count = 0 so nobody has paid yet) | **Critical (close now)** |
| P3 | No comp path for Premium Coaches Portal: `provisionTeamWorkspaceFromCheckoutMetadata` hard-requires `stripeSubscriptionId`; the only Stripe-free path is the dev mock (`shouldApplyDirectly`), hard-disabled in production | Blocking for the promo |
| P4 | All 5+ `isFoundingSeasonActive()` call sites hardcode `planKey === 'tournament_plus'`; `billing/page.tsx` computes `showFoundingSeasonBanner = isFoundingSeason && !isTeamWorkspaceBilling` (actively suppresses promo UI for coach workspaces) | Blocking for the promo |
| P5 | Founding-season end date hardcoded locally in write paths (`app/api/auth/signup/route.ts`, `app/api/org/create/route.ts` declare their own `FOUNDING_SEASON_EXPIRES_AT`) instead of importing `FOUNDING_SEASON_END` from `lib/plan-config.ts` (SOT-8) | Medium |
| P6 | Post-promo dead end: org with `stripe_customer_id = null` after 2027-01-01 gets a 400 "No billing account found" from `/api/billing/portal` with no self-serve recovery | Medium (mitigated by manual January) |
| P7 | `/start` chooser family renders the root Navbar's empty org-home branch → invisible fixed link (≈ left half of the 72px top strip) pointing at `/`; no `--nav-height` offset so it overlaps the page header | High (funnel) |
| P8 | `Footer.tsx` `STATIC_ROOTS` misses the `for-*` segments → footer hidden on all four `/for-*` pages; `/for-coaches` becomes a dead end in the installed PWA | High (funnel) |
| P9 | Account-only signup 409 ("account already exists") renders plain text; org path has a tappable Sign-in link | Low |
| P10 | Account tab: "Create free account" and "Run a tournament" visually identical ghost CTAs | Low |
| P11 | Stale "not customer-ready / Phases 3-4" comments on `/start/page.tsx` + `/start/team/page.tsx` — free Basic portal is in fact fully built (roster/schedule/fees/announcements/chat/tournaments verified working) | Doc hygiene |
| P12 | Consumer tab bar (Home/Scores/Chat/Account) never mounts on the `/start` family — `CONSUMER_SHELL_PREFIXES` excludes it; user loses the back-to-app anchor the moment they leave Account | High (funnel) |
| P13 | `/start/tournament` signed-out = bare unexplained `redirect('/auth/signup')` into the heaviest form in the funnel | Medium (funnel) |
| P14 | Additional email surfaces advertise $29/"coming in 2027": `spotlight_coaches_org`/`spotlight_coaches_coach` (Oct 1) AND `spotlight_full_picture` (Nov 15, lists Coaches Portal under "What's coming in 2027"); plus the transactional team-workspace welcome email says "manage or cancel your subscription anytime" — false for a comp workspace | Medium (promo copy) |
| P15 | Org-creating signup form breaks the one-phone-viewport auth design intent; `/start` needs ~1.2–1.5 viewports of scroll to reach its escape link | Low (deferred → funnel redesign project) |

Explicitly **out of scope**: the warm in-app organizer panel (Unified Home funnel Option 2 — separate design-gated project), League/Club launch, Stripe production smoke test execution (owner step; must land before any real January charges), automated January conversion (Phase 4C of `FOUNDING_SEASON_PLAN.md` stays parked — superseded for the 2026 cohort by the manual runbook).

---

## Phase 0 — Ratify + immediate prod safety (docs + one platform-admin action; same day)

1. **`/strategy` logs the decisions** in `BUSINESS_DECISIONS.md`:
   - D1: Premium Coaches Portal joins Founding Season — $0 until 2027-01-01, self-serve. **Promo, not repricing**: $29/$290 list stands and remains the visible anchor ("Free until Jan 1, 2027 — then $29/mo"). Knowingly trades the "$29 standalone, do-not-cannibalize" Club-bridge economics for 2026 acquisition/feedback volume; bridge economics resume 2027-01-01.
   - D2: Coaches Portal goes **live** for self-serve acquisition now: Basic (free) + Premium (comped). Supersedes the "not customer-ready" gate on the `/start` card.
   - D3: January 2027 conversion for the entire 2026 comp cohort (orgs + coach workspaces) = **manual runbook**, owner-executed (mass email → card-on-file → owner flips/cancels per account). Automated conversion remains deferred.
   - D4: The `plan_gating.team='live'` prod drift is resolved deliberately: close immediately (this phase), reopen intentionally when the comp path ships (Phase 3).
2. **`PLAN_PRICING_FACTS.md`**: extend the Promotions section (Premium Coaches Portal added to Founding Season with same end date + runtime pointers), update the Premium Coaches Portal row (purchasable = "Yes — $0 comp during Founding Season" once Phase 3 ships), note Basic = live. Run the bottom-of-doc drift check.
3. **Immediate prod safety action — ✅ EXECUTED 2026-07-20:** `plan_gating.team` → `early_access` on **prod** via the dedicated reviewed script `scripts/set-team-plan-gating.mjs` (before/after printed; `last_change_note` references BUSINESS_DECISIONS D4; the generic db-query tool correctly refuses prod writes, hence the dedicated script — the platform-admin change-request UI requires an authenticated owner session and can be used to mirror the paper trail later if desired). **Dev deliberately left `'live'`** so the existing paid checkout path and UAT smoke keep working while Phase 3 is built. Phase 3 reopens prod with the same script (`--set live`). *(Rationale: zero paid workspaces existed; the risk was someone paying $29 days before it becomes free.)*
4. Memory + TODO.md entries for this project.

## Phase 1 — Billing correctness (P1, P5, P6; ship before anything gets louder)

1. **P1 — rebuild "Add payment method" as a true card-only save**: Stripe **SetupIntent** session (mode=setup), no subscription, no trial, nothing charged; stores `stripe_customer_id` + default payment method. Confirmation copy: card saved, nothing will be charged before Jan 1, 2027. This matches the original `FOUNDING_SEASON_PLAN.md` design that was never implemented. The subscription-with-trial Checkout path stays intact for the post-promo era but is no longer reachable from the founding-season banner.
2. **P5 — single-source the date**: write paths import `FOUNDING_SEASON_END` from `lib/plan-config.ts`; sweep the ~10 hardcodes flagged by SOT-8 (at minimum the two grant-WRITE routes).
3. **P6 — graceful no-billing-account state**: `/api/billing/portal` 400 → billing page shows a friendly "no card on file yet — add one" state wired to the Phase-1 SetupIntent flow instead of a dead button.
4. Regression: dev-mock upgrade, founding-season $0 org flip, and the real post-promo checkout all still work (`verify:changed` + UAT billing smoke).

## Phase 2 — Fix everything broken in the funnel (P7–P13; no launch flips yet)

*Deliberately contains NO acquisition-opening changes — the "Coach a team" card flip and `/for-coaches` copy flip move to Phase 3 so the free door and the $0 upgrade launch together (otherwise Phase-2-acquired Basic coaches would hit a gated/403 upgrade until Phase 3 ships).*

1. **P7**: exclude the `/start` family from the root Navbar's org-home fallback; kill the invisible link + the phantom scrolled bar.
2. **P12**: mount the consumer tab bar on the `/start` family by extending it into the consumer shell using the existing `WARM_HOLDOUTS` pattern (tab bar present, `/start` keeps its current dark look — no theme change, so no new design ratification; extends the ratified Nav-Merge "never strip the app chrome from an acquisition surface" principle).
3. **P8**: add the four `for-*` segments to `Footer.tsx` `STATIC_ROOTS`.
4. **P13**: replace `/start/tournament`'s silent signed-out redirect with a one-line themed heads-up ("Creating your free organizer account…" → continue to signup) so the heaviest form doesn't appear unannounced.
5. **P9** sign-in-link parity on the account-only signup 409; **P10** de-emphasize "Run a tournament" vs "Create free account" on the Account tab (reuse the consumer-shell CTA recipe; extends the ratified quiet-door principle).
6. **P11**: fix the stale comments (mark the `/start` card flip as pending Phase 3, correct `/start/team/page.tsx`).
7. **P15 logged as deferred** → belongs to the separate Account-tab funnel redesign project (warm panel / Option 2), not silently dropped.

## Phase 3 — Coaches Portal LAUNCH: $0 Premium + free door, flipped together (P2 reopen, P3, P4, P14)

1. **Comp enrollment path**: when Founding Season is active, Premium signup/upgrade provisions the full team workspace **without Stripe** — reuse `provisionStandaloneTeamWorkspace` + `migrateBasicTeamIntoWorkspace` with the **existing `platform_override` billing-mode/entitlement-source convention** + `stripe_subscription_id = null` (verified: column nullable since mig 065, partial unique index permits NULLs, CHECK constraints already include `platform_override` — **no migration expected**; if one becomes necessary anyway → DATA_DICTIONARY.md + `refresh:snapshots` same unit of work); comp period end = `FOUNDING_SEASON_END`. Covers new premium signups (`/coaches/start`) and Basic-team upgrades (Explore/ScopeShelf CTAs), signed-out and signed-in.
2. **Promo-aware surfaces (P4)**: un-hardcode the `tournament_plus` checks where the team plan needs them; remove the `!isTeamWorkspaceBilling` banner suppression; price displays become "$0 until Jan 1, 2027 — then $29/mo" on: org billing page product shelf, `PlanArticlePanel`, `/coaches/start` signup, `/for-coaches`. **`/pricing` is net-new founding-season work** (it has ZERO promo wiring today for ANY plan — Tournament Plus shows full list price there too): wire it for both tournament_plus and team in this pass, or explicitly log it as a separate pre-existing gap — do not silently absorb it.
3. **P14 — email sweep**: update `spotlight_coaches_org` + `spotlight_coaches_coach` (Oct 1, "$29/month" + express-interest CTA) AND `spotlight_full_picture` (Nov 15, "What's coming in 2027" framing) to the promo story; add a comp variant of the transactional team-workspace welcome email (no "manage or cancel your subscription" line; mirror the org `founding_welcome` "free through Dec 31, no card required" copy).
4. **Launch flips, together, last**: flip the `/start` "Coach a team" card → `/start/team` tagged **Free**; `/for-coaches` copy flip via `/marketing` ("Coming soon"/express-interest → live "Start free" + "$0 until Jan 1, 2027" Premium framing; naming canon respected); platform-admin change-request reopens `plan_gating.team` → `live` (dev + prod, audit-logged); create-team-checkout routes to the comp path (not Stripe Checkout) while the promo is active.
5. `lib/plan-config.ts` + `PLAN_PRICING_FACTS.md` updated in the same unit of work; run the drift check; `/docs` sync for coach signup/billing/upgrade help.

## Phase 4 — January 2027 manual runbook (docs only; owner-executed in January)

Write `docs/agents/ops/JANUARY_2027_CONVERSION_RUNBOOK.md`:
1. How to list the comp cohort (orgs: the platform-admin Founding Season filter, already shipped; comp team workspaces: a documented **query** — no new admin UI in this phase, keeping Phase 4 docs-only).
2. Email sequence (reuse the shipped editable-campaigns system + existing founding templates; add a coaches variant): "add your card by Dec 31" (Oct), reminder (Nov/Dec), conversion notice (Jan).
3. Card-on-file window (Oct 1–Dec 31): the fixed SetupIntent button for orgs; extend the same card-save to coach-workspace billing if cheap, else coaches are email-only.
4. January steps per account: charge/convert (requires Stripe production smoke test — hard prerequisite, tracked separately, deadline Dec 31) or downgrade/cancel; who to contact; how to verify.

## Sequencing, verification, release

- Order: Phase 0 (same day) → 1 → 2 → 3 → 4. Phases 1+2 ≈ one session each; Phase 3 ≈ 2–3 sessions (new provisioning path + surface/email sweep); Phase 4 ≈ half session.
- Each phase: `npm run verify:changed`; `npm run typecheck` where shared modules/billing routes change; UAT smoke for coach signup + comp upgrade on dev; owner browser-tests each phase per AGENCY_RULES.
- **Dev-server restarts** (AGENTS.md rule): Phase 1 adds a new API route (SetupIntent) and Phase 3 adds a provisioning path + touches `lib/plan-config.ts` (shared module) — both phases end with a stop → `rm -rf .next` → restart before owner browser testing. Phase 2 moves `/start` into the consumer shell (file moves) — same rule applies.
- `/review` (adversarial funnel) after Phases 1 and 3 (billing-touching).
- **Prod reality**: everything lands on `dev` first. The end state is only real for users after the next prod release bundle (several migrations already pending prod — coordinate via `/release`; Phase 3's possible entitlement migration joins that bundle). Phase 0's gating flip is the only immediate prod action.

## Phase 1 build log (2026-07-20)

Phases 0+1 BUILT + simplified + adversarially reviewed (4-lens funnel, high-risk tier). Review outcomes:
- **Fixed:** ensureStripeCustomer first-writer-wins guard + orphan-customer cleanup (double-click race → card on orphaned customer); org-scoping on `/api/billing/portal` + `/api/billing/setup-payment-method` (multi-org member on Org B's page could create/mutate Org A's billing via home-org resolution — client now posts `orgSlug`, routes scope `getAuthContext`); promo-aware card-saved copy (generic after Jan 1); one-shot `?success=1`/`?card_saved=1` params stripped after seeding (refresh no longer re-opens the modal); gating script — uniform SQL escaping, `--actor` flag, audit-log insert on every flip + `--backfill-audit` recovery (prod backfill for the 2026-07-20 close DONE).
- **Accepted/documented, not coded:** changing `NEXT_PUBLIC_FOUNDING_SEASON_END` mid-promo desyncs previously written comp rows from status/audience queries — caveat now documented at the constant; if the date moves, backfill `org_overrides.comp_period.expires_at` in the same change. Webhook default-payment-method last-write-wins on concurrent card saves (fine for a manual action). Gating script UPDATE→audit INSERT not transactional (visible failure + backfill mode). Team-workspace comp orgs will reach the same generic card-save copy post-Phase 3 — covered by P4/P14 launch-flip work, not this phase.

## Risks / accepted tradeoffs

- **Club-bridge cannibalization** (comped Premium blunts the $29→Club conversion lever) — accepted for 2026, logged as D1.
- **Comp cohort grows with zero revenue** until January — accepted; owner explicitly wants feedback volume over 2026 revenue.
- **Manual January at scale** — accepted at current volume (1 org); revisit automation if cohort exceeds what one person can hand-convert (~50+ accounts).
- **Comp provisioning is the biggest defect surface in Phase 3** — the schema already supports it (`platform_override` + null subscription id, verified), but the code path from checkout-request → comp provision → entitlement is new; adversarial review targeted there.
- Anyone comped keeps Premium features until manually converted — accepted (D3).
