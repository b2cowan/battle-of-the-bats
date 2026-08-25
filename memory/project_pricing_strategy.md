---
name: project_pricing_strategy
description: Pointer to the canonical plan/pricing facts + decision log (do not restate numbers here)
metadata:
  type: project
---

# Pricing Strategy — pointer (not a copy)

**Canonical plan/pricing/packaging facts (names, prices, capacity, gating, inclusions): `docs/agents/strategy/PLAN_PRICING_FACTS.md`.** Do not restate prices here — that's how docs drift. Binding *decisions* + rationale: `docs/agents/strategy/BUSINESS_DECISIONS.md`. Customer wording: `docs/agents/brand/PRICING_PAGE_COPY.md` (`/marketing`). See [[reference_business_decisions_log]] and [[project_free_tier_strategy]].

## The only facts safe to keep in memory (everything else → the Facts doc)

- Four-plan bundled model (no à la carte). Naming canon: **Tournament (free) → Tournament Plus**, **League (free floor) → League Plus**, **Club** (+ **Club · Association** band), **Premium Coaches Portal** (standalone $29). Never "League Starter"/"Starter", "Coach Portal" singular, or "Club Large" in customer copy.
- **Club repriced (decided 2026-06-22, not yet built):** two capacity bands (≤15 ~$219, 15–30 ~$379, custom >30), whole coaching staff portals included, per-team $19 meter retired, all team types count equally (no select discount). Standard Club price moved off $179 via the lower band; flat-$179 founding lock dormant (no founding clubs).
- **Monetization direction (decided):** facilitated payments scoped Q4 2026, launch H1 2027 (take-rate/who-pays/processor still Proposed).
- **GTM:** acquisition focus = mid-size dual-stream club (~8–14 teams); pricing still serves all sizes.
- **Family features packaging (decided 2026-07-11; ⚠ AMENDED 2026-08-01):** the whole Chunk D family layer is **PREMIUM-ONLY** and is BUILT on dev (follower tier live-ready; guardian tier switched off pending counsel). **FAMILY CHAT IS CUT — chat stays coaches/admins only, and G4's "chat basics with ANY portal" clause is VOID.** Practice-schedule visibility + richer family features = Premium Coaches Portal inclusion. No new SKU/price. Org "fan pass" = Proposed only. Also 2026-07-11: unified app ratified — per-tournament install identities retired; `advanced_tournament_branding` reframes to "branded space + QR on-ramp" (copy-only at build).
- **Coaches Portal tryout/evaluation = bundled, no per-player fee (decided 2026-06-29, not yet built):** the full tryout & player-evaluation suite is included in the Premium Coaches Portal ($29/mo per team standalone / whole-staff under Club) — no per-player or per-tryout fee, no add-on, no price change. Bundling vs per-player competitors ($4–$10/player/yr) is the deliberate wedge.
- **Roster export = Premium Coaches Portal inclusion (decided 2026-08-23, ratifies shipped behaviour):** a standalone coach exports their own roster in Excel, CSV and PDF. No feature key, no gate change — the gate is architectural (only a Premium/Club team has a coaches-portal roster at all). Basic (free) unchanged. ⚠ Never read plan inclusions from `lib/export/catalog.ts` — its `minPlan`/`moduleGate` fields are documentation that nothing enforces, and this drift is what produced the ruling. See PLAN_PRICING_FACTS.md.
- **PDF document customization = Premium Coaches Portal inclusion (decided 2026-08-21, ships with PDF Export Quality Phase 1):** document branding becomes two layers — a team-level "How your documents look" card in every coach portal (team logo/accent/footer; club settings are the inherited default, no club lock in v1), and the standalone Premium plan gains customization (previously Tournament Plus+). Basic (free) unchanged — it has no PDF export. No price change, no new SKU.

> If you need a number, open the Facts doc — do not trust a number written anywhere else without reconciling it there.
