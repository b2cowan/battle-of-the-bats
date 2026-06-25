# League Rebrand — "League Starter / League" → "League / League Plus"

> **Status:** ✅ EXECUTED 2026-06-13 (full rename incl. live public copy; typecheck 0-err + verify:changed green; final sweep clean). ~45 customer-facing strings across ~30 files + 3 brand-canon docs. Internal plan-label maps (platform-admin) also aligned to "League Plus" for consistency. Platform-admin **free-floor** badge kept as the internal codename "League Starter" (maps to `free_floor='league_starter'`). **Phase-9 follow-up:** add the public free-"League" pricing card / "start free" CTA when the beta flag flips. Awaiting owner browser spot-check (pricing page, billing upgrade cards, a cap-hit modal).
> **Owner of copy:** `/marketing` agent · **Branch:** `feat/free-tier-coaches`
> **PM brief:** [LEAGUE_REBRAND_PM_BRIEF.md](LEAGUE_REBRAND_PM_BRIEF.md)
> **Gates:** the eventual Free League Starter Phase-9 launch ([FREE_TIER_LEAGUE_STARTER_PLAN.md](FREE_TIER_LEAGUE_STARTER_PLAN.md))

## Decision (owner-approved 2026-06-13)

Mirror the Tournament line exactly:

| Customer-facing name | What it is | Internal key (UNCHANGED) |
|---|---|---|
| **Tournament** | free tournament floor | `plan_id='tournament'` |
| **Tournament Plus** | paid ($39) | `plan_id='tournament_plus'` |
| **League** *(was "League Starter")* | free house-league floor | `free_floor='league_starter'` (on a tournament plan) |
| **League Plus** *(was "League")* | paid ($89) | `plan_id='league'` |
| **Club** | paid ($179) | `plan_id='club'` |

**Why:** "League Starter" violates our own voice rule ("never *Starter*"), so the free floor needed a rename regardless. The Tournament/Tournament Plus parallel gives the League-operator segment a free entry named after their role and an honest "run a *bigger* league = League Plus" upsell. League is still early-access (no self-serve checkout, no live paid customers), so relabeling the paid tier now costs nothing in existing-customer confusion — it's the right moment.

## Rename rules — STRICT (a blind find-replace would break the app)

**CHANGE** (customer-facing tier *names* only):
- The word **"League"** when it names the **$89 paid tier** → **"League Plus"**.
- The phrase **"League Starter"** (and "Free League Starter") when shown to a **customer** → **"League"** (or "Free League").
- Upsell/gate copy that pointed at the paid tier ("upgrade to League", "Express interest in League", "included with … League …") → "League Plus".

**NEVER CHANGE** (not customer-facing tier names):
- Internal keys: `plan_id='league'`, `free_floor='league_starter'`, `PLAN_CONFIG.league`, Stripe price/product keys, DB values.
- **"House League"** — the *module* name (registration/divisions/seasons). Distinct concept; stays "House League".
- Routes/paths: `/start/league`, `/api/league/create`, `/[orgSlug]/league/…`, `/for-leagues`, `/api/events/league`.
- Code identifiers: `LeagueCapUpgrade`, `isFreeFloorLeague`, `leagueStarter`, `houseLeague*`, CSS classes, var names.
- House-league **domain terms**: "league season", "league registration", "league standings" (these describe the module, not the plan).
- **Code comments** referencing the internal `league_starter` concept (optional cleanup, not required; they're not customer-facing).
- **Platform-admin internal labels** (orgs badge/filter/panel "League Starter") — KEEP as the internal codename; it maps 1:1 to `free_floor='league_starter'` and disambiguates from paid "League Plus" for operators. (Noted, deliberate.)

## Surface inventory (do-now)

### A. Brand canon (do FIRST — or future agents revert the rename)
- `memory/marketing_brand_voice.md` — the "Always full plan names: Tournament, Tournament Plus, League, Club" rule → five names; add the League(free)/League Plus(paid) mapping + the "never Starter" note now satisfied.
- `memory/project_pricing_strategy.md` — four-tier table: rename the $89 row label → "League Plus"; add the free "League" floor note.
- `docs/agents/brand/PRICING_PAGE_COPY.md` — all paid "League" → "League Plus"; record the new free "League" tier (public card = Phase 9).

### B. Plan config + feature-gate copy (in-app, customer-facing)
- `lib/plan-config.ts` — `league.label: 'League'` → `'League Plus'` (single source feeding pricing/billing/gates).
- `lib/plan-features.ts` — ~21 "included with Tournament Plus, League, and Club" → "… League Plus, and Club".
- `app/[orgSlug]/admin/org/billing/page.tsx` — "Everything in League" → "League Plus"; "You're on League…" → "League Plus"; `detailLabel: 'Preview League'` → "Preview League Plus"; tournament_plus blurb "League and Club are coming soon".
- `lib/plan-article-content.ts` — `eyebrow: 'League'` → "League Plus" (+ any body tier refs).

### C. Public marketing copy (live)
- `components/PricingSection.tsx` — card `name: 'League'` → "League Plus"; "Everything in League" → "League Plus".
- `app/pricing/page.tsx` — any "League" tier mentions.
- `app/for-leagues/page.tsx` — "Express interest in League" → "League Plus"; "League is opening soon" / "League — built for the full season." → "League Plus …"; plan card `planName: 'League'` → "League Plus". (Free "League" tier copy = Phase 9.)
- `app/page.tsx` — "League · Coming soon", "League and Club modules", label 'League', early-access copy → "League Plus".

### D. Free-floor (beta) copy: "League Starter" → "League", "to League" → "to League Plus"
- `lib/free-floor.ts` `CAP_MESSAGES` — "Your free League Starter includes…" → "Your free League plan includes…"; "Upgrade to League" / "part of League" → "League Plus".
- `components/admin/LeagueCapUpgrade.tsx` `CAP_BODY` + CTA labels — same.
- `lib/user-contexts.ts` — `'Free League Starter'` /home card → `'Free League'`.
- `app/api/league/create/route.ts` — error "League Starter is not available yet." → "League is not available yet."
- `app/[orgSlug]/admin/onboarding/page.tsx` — two user-visible strings (L1016 error, L1607 hint): "Free League Starter" → "Free League"; "upgrading to League" / "part of League" → "League Plus".
- `app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx` — L258 "free League Starter plan. League gives you…" → "free League plan. League Plus gives you…"; L264 "Free League Starter —" → "Free League —".

## NOT in scope now (Phase-9 launch copy)
- Adding a **free "League" pricing card** to the public pricing page / a free-tier row on `/for-leagues` (the free floor stays unlisted until the flag flips).
- Any "start free League" public CTA.

## Sequence & verification
1. Brand canon (A) → 2. Plan config + gates (B) → 3. Public marketing (C) → 4. Free-floor beta copy (D).
2. `npm run typecheck` (label change touches PLAN_CONFIG consumers) + `npm run lint:focused -- <changed>`. No schema/migration → no dictionary/snapshot impact.
3. Owner does browser spot-check (pricing page, billing upgrade cards, a cap-hit modal).

## Risk notes
- Interim public state: "League Plus" shows as the $89 tier without a visible free "League" until Phase 9 — reads fine standalone to a new visitor (accepted, owner-ruled).
- The label is the shared source, so the public + in-app names flip together atomically (intended).
