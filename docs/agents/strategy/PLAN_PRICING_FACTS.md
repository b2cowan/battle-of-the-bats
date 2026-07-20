# FieldLogicHQ — Plan & Pricing Facts (CANONICAL)

> **This is the single source of truth for plan names, prices, capacity, gating, and inclusions.**
> Maintained by `/strategy`. Kept matched to the app's plan configuration (`lib/plan-config.ts`) — the app config is the *runtime* truth; this table is the human-readable mirror plus any **decided-but-not-yet-built** changes.
>
> **Rule:** other docs must NOT restate these numbers. Brand strategy, the pricing-copy appendix, and the pricing memory file **point here**. When you change a price/name/gate, change it *here and in the app config in the same unit of work*, then run a drift check (see bottom).
>
> **Status legend:** `Live` (in the app today) · `Decided / not yet built` (ratified, app not yet updated — see Club Repackaging) · `Held` (built but not public) · `Target/anchor` (decided number, recalibrates with data).
> **Last reconciled:** 2026-06-22 (vs `lib/plan-config.ts`).

---

## Plans at a glance

| Plan (public name) | Monthly | Annual | Capacity | Purchasable today? | Status of current numbers |
|---|---|---|---|---|---|
| **Tournament** (free) | Free | Free | 1 tournament · 3 staff seats | Yes (self-serve) | Live |
| **Tournament Plus** | $39 *(Founding Season: $0 — see Promotions)* | $390 | Unlimited | Yes (self-serve) | Live |
| **League** (free floor) | Free | Free | 1 season / 1 division / 8 teams | No — **Held** for launch | Built, internal key `free_floor='league_starter'` |
| **League Plus** | $89 | $890 | Unlimited | No — early-access / express-interest | Live (app label is "League Plus") |
| **Club** | **$219** *(was $179)* | **$2,190** | **Up to 15 teams** | No — early-access | **Built dev 2026-06-22** (app config repriced; Stripe live prices = owner step) · price = Target/anchor |
| **Club · Association** | **$379** | **$3,790** | **15–30 teams** (custom > 30) | No — early-access | **Built dev 2026-06-22** (plan key `club_large`) · price = Target/anchor · *public name pending final /marketing sign-off* |
| **Premium Coaches Portal** (standalone) | $29 *(Founding Season: $0 — see Promotions; Decided 2026-07-20, comp path not yet built)* | $290 | One team | **Becoming yes** — $0 comp self-serve at the Coaches-launch build (Phase 3); until then closed (see Promotions ⚠ drift note) | Live |

**Annual convention:** ≈ 2 months free (pay for 10). $219→$2,190 and $379→$3,790 follow it.

## Promotions (live)

- **Founding Season — Tournament Plus free until 2027-01-01.** Runtime: `lib/plan-config.ts` `FOUNDING_SEASON_END` (env-overridable via `NEXT_PUBLIC_FOUNDING_SEASON_END`), `isFoundingSeasonActive()`. This is a **promo, not a repricing** — the $39/$390 list price stands and is what post-promo billing anchors to. Customer-facing framing lives in `PRICING_PAGE_COPY.md` §16. *(Line added 2026-07-14 — drift repair: this doc was the one place the live promo wasn't recorded, flagged by the Free App Conversion sweep.)*
- **Founding Season — Premium Coaches Portal free until 2027-01-01** (Decided 2026-07-20, `BUSINESS_DECISIONS.md`; **not yet built** — ships at `FOUNDING_SEASON_COACHES_FREE_PLAN.md` Phase 3). Same promo window + runtime constants as Tournament Plus; $29/$290 list stands as the visible anchor ("Free until Jan 1, 2027 — then $29/mo"). Comp enrollment provisions the workspace without Stripe (`platform_override` + null subscription id). Pauses the 2026-06-22 Club-bridge do-not-cannibalize economics for 2026 only. January 2027 conversion for the whole comp cohort = **manual owner runbook** (no automation). ⚠ **Drift note (2026-07-20):** `plan_gating.team` was found `'live'` on prod (mig-065 seed, never audited) with live Stripe prices — the $29 checkout was accidentally open (0 sales). Being closed to early-access immediately; reopens deliberately as the $0 comp path at Phase 3 launch.

---

## Naming canon (ratified 2026-06-22)

- The coach product is **"Coaches Portal"**, with **Basic Coaches Portal** (free) and **Premium Coaches Portal** (paid). Never "Coach Portal" (singular), "Team plan", "Coaches Portal Premium".
- **League (free) → League Plus (paid)** mirrors **Tournament (free) → Tournament Plus (paid)**. The $89 tier is **"League Plus."** Never write "League Starter"/"Starter" in customer copy. *(This corrects the earlier "League Plus is a typo" framing — the 2026-06-13 rebrand stands.)*
- The larger Club band is **"Club · Association"** (working public name; "Club Large" is internal only — never the SaaS-seniority words "Large/Enterprise/top tier" in customer copy).
- Always full plan names. Never "Pro", "Starter", "the paid plan".

---

## Capacity, seats & inclusions

- **Club teams:** all team types (rep, **select, development**) count **equally** toward the 15 / 30 band caps. **No discounted "select" tier.** Above 30 teams = custom quote.
- **Club includes the whole coaching staff's Premium portals** — no per-team fee. **The "$19/team beyond 3" meter is retired** (Decided / not yet built).
- **Coach bridge:** standalone Premium Coaches Portal is $29/mo until the coach's org joins Club, at which point the portal is **included** in Club (coach stops paying). *(The old "$19/team, $10 less than standalone" bridge is gone.)*
- **Free-tier staff seats (3):** count admin/staff only. **Officials & scorekeepers are exempt** (Decided — app currently still counts them; `officialsFreeSeats` to flip for the exemption). Paid plans = unlimited seats.
- **Module inclusions** (unchanged): Tournament Plus = tournaments + comms workflow; League Plus adds public site + house league; Club adds accounting + rep teams (+ whole-staff portals).

## Email / communications split (ratified 2026-06-22)

| | Tournament (free) | Tournament Plus + |
|---|---|---|
| Basic all-team announcement | ✓ | ✓ |
| Templates, send-scheduling, delivery tracking, segmentation | — | ✓ |

Framing: **"announcements free, communications workflow paid."** *(Decided — reconcile live card + comparison table.)*

---

## Decided-but-not-yet-built change log (close these to keep app == this table)

- [x] **Club Repackaging** — **BUILT dev 2026-06-22** (local/unpushed). Repriced Club $179→$219/$2,190; added **Club · Association** (`club_large`, $379/$3,790, 15–30 teams, custom >30 via per-org `organizations.team_limit`); retired the $19/team meter (charge path, takeover flow, nudge all removed); whole-staff portals included; 15/30 caps enforced at rep-team create. Both bands stay early-access. Migs 144 (CHECK widenings) + 145 (`team_limit`) + 146 (Club · Association Stripe price slots) applied **dev only** — prod migs + Stripe live-price creation are owner steps. (`docs/projects/active/CLUB_REPACKAGING_PLAN.md`)
- [x] **Officials seat exemption** — BUILT dev 2026-06-22 (free-tier `officialsFreeSeats` on; both seat-count + invite paths already honor it; the score-entry "official" role *is* the scorekeeper role). Local/unpushed.
- [x] **Free email split + guard** — BUILT dev 2026-06-22. The basic-free / advanced-gated split was already enforced in the product (copy was the only gap — fixed by `/marketing`); added a free-tier volume guard (100 recipients/send, 10 sends/24h). *Note: "templates / send-scheduling" Plus features don't exist yet — nothing to gate until built.* Local/unpushed.
- [ ] **Founding $179 lock** — dormant (no founding $179 clubs exist); no grandfather to build.
- [ ] **Fan tournament-message push = Tournament Plus** — Decided 2026-07-06 (`BUSINESS_DECISIONS.md`), not yet built. New anonymous-fan push for organizer day-of messages + schedule changes gates at **`tournament_plus`**, same tier as `fan_score_alerts` (one bundled fan-push capability). Base Tournament still posts the public rain-delay banner + free coach email. On build (`/billing`): broaden `fan_score_alerts` or add a sibling gate at `tournament_plus` in `lib/plan-features.ts`, keep opt-in/revocable/rate-limited/operational-only, run drift check. (`RAIN_DELAY_DAYOF_OPS_PLAN.md` Feature A.)
- [ ] **Tournament branding reframe (unified app, G1)** — Decided 2026-07-11 (`BUSINESS_DECISIONS.md`), not yet built. Per-tournament PWA install identities are retired (one-app ratification); `advanced_tournament_branding` (Tournament Plus) **keeps** theming/custom appName/branded space-in-app + QR on-ramp and **loses** the "your own installable app icon" framing. **Copy-only** at the unified-app plan's Phase 0 build (in-app help + branding-page wording via `/marketing`) — no price/tier/feature-key change. (`UNIFIED_APP_CONSUMER_LAYER_PLAN.md`.)
- [ ] **Family-feature packaging (G4)** — Decided 2026-07-11 (`BUSINESS_DECISIONS.md`), not yet built (gated on the unified-app plan's Phase 4 + PIPEDA/CASL review). When verified-family ships: **family team-chat basics included with ANY Coaches Portal (Basic or Premium)**; **practice-schedule visibility + richer family features = Premium Coaches Portal inclusion** (no new SKU, no price change, no per-family fee). Org-purchased "fan pass" = **Proposed only**. On build (`/billing`): gate at the premium-coach entitlement, update this table's inclusions + `lib/plan-config.ts`/`lib/plan-features.ts` in the same unit of work, run drift check.
- [x] **Bulk Rain-delay tool = Tournament Plus** — Decided + BUILT dev 2026-07-07 (`BUSINESS_DECISIONS.md`). The one-tap "shift the day" bulk reschedule/cancel tool gates at **`tournament_plus`** via a **new `bulk_reschedule` feature key** (same tier/family as the `auto_schedule`/`playoff_generator` generators). Server gate live (the `bulk-reschedule` action in `app/api/admin/games/route.ts` returns the standard plan-gate 403 for free orgs); UI locked-state + upsell wired with the Schedule-page reorg (same session). **Not gated:** posting a pinned rain-delay banner (free Communication tool) or manual single-game edit/cancel — only the bulk convenience is Plus. `lib/plan-features.ts` updated (`bulk_reschedule` → `tournament_plus` + copy). **No price/name/limit change** — packaging/gating only. (`RAIN_DELAY_DAYOF_OPS_PLAN.md` Feature B.) Local/unpushed.

---

## Drift check (run on every pricing/packaging change + before any billing release)

Compare this table against each of these and reconcile any divergence (flag to `/strategy`):
1. **App config** `lib/plan-config.ts` — runtime truth for names/prices/limits/gating.
2. **Decisions** `docs/agents/strategy/BUSINESS_DECISIONS.md` — is the change logged?
3. **Brand** `docs/agents/brand/BRAND_STRATEGY.md` §5/§7 — should point here, not restate.
4. **Copy** `docs/agents/brand/PRICING_PAGE_COPY.md` — should reference these numbers.
5. **Memory** `memory/project_pricing_strategy.md` — should point here.
6. **README** + live pricing/`/for-*` pages.

A divergence is a bug. The fix is to make everything point at (or match) this table — never to fork a second copy.
