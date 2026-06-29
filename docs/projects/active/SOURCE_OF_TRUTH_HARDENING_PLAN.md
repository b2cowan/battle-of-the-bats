# Single Source of Truth (SoT) Hardening — Implementation Plan

> **Created:** 2026-06-29 · Triggered by a platform-admin QA finding (Persona 3.3): plan limits shown on the Plans & Pricing screen had drifted from the canonical config because the same fact lived in multiple places. A 4-domain codebase audit (plan/billing, org/subscription, roles/access, content/copy) confirmed the problem is **systemic** — ~13 instances across the app, several **already wrong in production-facing surfaces today**.
>
> **Governance principle behind this work is logged in** `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-06-29, "Single source of truth for product-defining data"). This plan is the execution side of that decision.

## Why this matters
When the same fact (a price, a plan limit, an availability flag, a date, a label, "what a plan includes") is stored or written in more than one place and synced **by hand**, the copies drift. Several have already drifted onto **customer-facing** surfaces. The fix is not whack-a-mole — it's a small set of structural rules applied per recurring failure shape, plus **CI ratchets** that make drift un-mergeable (we already do this for the DB dictionary and design tokens; extend the same mechanism).

## The four mitigation rules (applied per shape)
1. **One authority per data element** — designate the single owner of each fact; everything else *reads* it.
2. **Derive, never copy** — import the one constant; render copy from the source. No hand-typed prices/dates/limits in copy or emails.
3. **Kill ghost controls** — an operator control must *enforce* what it displays, or be removed. (What you see = what gates.)
4. **Make drift un-mergeable** — a CI ratchet fails the build when the authority, the Facts doc, and any surface disagree.

## The five recurring shapes
- **A — Ghost controls:** an admin edits a store the runtime ignores (plan limits override table; plan module "Feature Matrix"; trial-day display).
- **B — Copy-pasted constants:** the same number/date/label hardcoded in N files (prices in emails; founding-season date; plan/module labels).
- **C — Stale copy after a packaging change:** marketing/help copy not updated when the product changed ("three Coaches Portal accounts" vs "whole staff included").
- **D — Inconsistent assembly:** code reads a raw field instead of the one resolver (raw `plan_id` gating bypassing `hasModuleEntitlement`).
- **E — Multi-writer vs an external system:** our DB vs Stripe (`subscription_status` written by 8+ paths).

---

## Findings register (audit 2026-06-29)

> Severity = customer-facing blast radius × likelihood. **LIVE** = wrong on a customer/operator surface *today* (not just "will drift").

### P0 — LIVE customer-facing drift (fix first)
| ID | Shape | Element | Where | Status |
|---|---|---|---|---|
| SOT-1 | C | Club still described as "**three Coaches Portal accounts**" (retired June repackaging → "whole coaching staff included"); contradicts the comparison table on the same page | `app/pricing/page.tsx:329`, `app/for-leagues/page.tsx:21` (canonical-correct: `ComparisonTable.tsx:101`, `lib/plan-article-content.ts:287`, `PricingSection.tsx:151`) | → `/marketing` |
| SOT-2 | A/D | **Venue Library nav hidden for Club · Association** — sidebar gate hardcoded `['league','club']`, missing `club_large`; API+page gates already include it (H13 regression survivor) | `components/admin/AdminSidebar.tsx:132` | ✅ **FIXED 2026-06-29** (added `club_large`) |
| SOT-3 | C | Email calls product "**Tournament Coach Portal**" (brand canon = "Coaches Portal") | `lib/email.ts:1852`, `EmailDashboardClient.tsx:773` | → `/marketing` |
| SOT-4 | A | **"Feature Matrix" is a ghost control** — platform-admin editor writes `platform_plan_module_entitlements`, but runtime `hasModuleEntitlement` reads `PLAN_CONFIG.moduleEntitlements` (code). Operator edits have no effect on real access; pricing-page matrix can show a different module set than is enforced | `lib/plan-module-entitlements.ts` (display) vs `lib/module-entitlements.ts:15` (enforce) | [DECISION] make it enforce, or remove the editor |
| SOT-5 | A | **Plan limits override table is a ghost control** (the original finding) — `plan_config_overrides` shown on Plans & Pricing but not read by enforcement; held stale finite caps for Tournament Plus (3/5) + League Plus seats (10) | `lib/plan-config-db.ts` (display) vs `lib/plan-config.ts:getEffectiveTournamentLimit` (enforce) | Stale rows cleared by owner 2026-06-29; structural fix pending |

### P1 — Latent, will go wrong at the next price/packaging change (customer-facing)
| ID | Shape | Element | Where |
|---|---|---|---|
| SOT-6 | B | **Prices hardcoded in transactional emails** (~18 literals: $39, $89, $29, $219) — code comment says "never hardcode prices"; violated | `lib/email.ts` (multiple), `EmailDashboardClient.tsx` (preview duplicates) |
| SOT-7 | B | **$29 hardcoded in in-app coach upgrade prompt**; **$39 hardcoded in a pricing FAQ answer** | `components/coaches/CoachExploreCatalog.tsx:150`, `app/pricing/page.tsx:130` |
| SOT-8 | B | **Founding-season end date hardcoded in ~10 places**; 3 grant-WRITE routes ignore the `FOUNDING_SEASON_END` env override; admin orgs-list filter uses a *different format* (`'2026-12-31'` vs `'2027-01-01T…'`) → email cohort ≠ "Founding" badge cohort | `lib/plan-config.ts:195` (canonical) vs `signup`, `org/create`, `league/create`, 4 email-audience paths, 2 onboarding inlines, `orgs/page.tsx:11` |
| SOT-9 | A | **Trial length display vs enforcement** — checkout uses merged DB override; billing page shows code default | `app/[orgSlug]/admin/org/billing/page.tsx:435` |
| SOT-10 | C | Help text says Accounting / Rep Teams "**or available as an add-on**" — à-la-carte add-ons retired; bundled model only | `lib/help-content/accounting.tsx:6,17`, `rep-teams.tsx:35` |

### P2 — Operational / internal risk (lower customer blast radius)
| ID | Shape | Element | Where |
|---|---|---|---|
| SOT-11 | E | **`subscription_status` written by 8+ paths**; admin demote-to-free can orphan a still-charging Stripe sub (H14 family); cancel-confirm writes DB before the Stripe call (Stripe failure → keeps billing) | `app/api/billing/webhook/route.ts` + 7 others; `cancel/confirm/route.ts:279` |
| SOT-12 | D | **Notifications / fan-alerts read raw `plan_id`**, bypassing `hasModuleEntitlement` → wrong gate for free-floor / add-on orgs | `lib/fan-notify.ts:54`, `lib/notify.ts:99` |
| SOT-13 | B | **Plan label maps duplicated in ~8 places**; two are wrong today (`user-contexts.ts` → "Premium"/"Tournament+"; webhook email hardcodes "Team") | `lib/user-contexts.ts:69`, `app/api/billing/webhook/route.ts:207`, + 6 admin maps (canonical: `PLAN_CONFIG.label`) |
| SOT-14 | B | **Plan feature LISTS hand-duplicated in 3 places** — any inclusion change needs 3+ edits | `components/PricingSection.tsx`, `app/[orgSlug]/admin/org/billing/page.tsx`, `lib/plan-article-content.ts` |
| SOT-15 | A | **Per-org tournament_limit doesn't propagate** when the plan-level override changes — existing orgs keep their stored cap; same-plan customers get different caps | `getEffectiveTournamentLimit` + `organizations.tournament_limit` |
| SOT-16 | B | **`ADDON_MODULE_LABELS` / module-label maps in 4 places**; **`ADDON_KEYS` validation list** must hand-sync with the module catalog; dead `isLeagueOrClub` drift-bomb | `bulk-operations/route.ts:42`, `OrgDetailClient.tsx:146`, `BulkOperationsClient.tsx:46`, `orgs/[id]/page.tsx:307`; `overrides/route.ts:56`; `AdminSidebar.tsx:78` |
| SOT-17 | B | **Stripe cent-amount validator hardcodes expected $ instead of deriving** from `PLAN_CONFIG` (dev tooling); admin help text hardcodes $29/$290 | `app/api/dev/team-checkout-readiness/route.ts:20`, `lib/help-content/platform-admin.tsx:400` |

### Already clean (good patterns to copy)
- Public/persona pricing **derives** from `PLAN_CONFIG` via `formatPriceAmount()`.
- Persona-page feature/article content single-sourced in `lib/plan-article-content.ts`.
- Role→capability (`lib/roles.ts` + `hasCapability`), platform-admin areas (`lib/platform-areas.ts`), `officialsFreeSeats` flag, Stripe **price IDs** (`stripe_prices` table) — all single-sourced.
- `BRAND_STRATEGY.md` / pricing-copy appendix / pricing memory **point at** `PLAN_PRICING_FACTS.md` instead of restating numbers.

---

## Phased execution (sequenced by blast radius)

- **Phase 0 — Live drift triage (P0).** SOT-2 ✅ done. SOT-1, SOT-3 → `/marketing`. SOT-4, SOT-5 → decide ghost-control disposition (enforce vs remove).
- **Phase 1 — Kill copy-pasted constants (B).** One exported constant each for prices (already exists — make emails/FAQ/in-app derive from it), the founding-season date, and the plan/module label maps. Add a **lint/grep ratchet** banning bare price literals (`$NN/month`) and the founding-date string outside the canonical module.
- **Phase 2 — Kill ghost controls (A).** Decide per control: make `plan_config_overrides` + `platform_plan_module_entitlements` actually enforce (display == enforcement), or remove the editors and read code config directly. Resolve the trial-day display gap.
- **Phase 3 — One access resolver (D).** Route every "what can this org do" read through `hasModuleEntitlement`; ban raw `plan_id` gating (lint guard, like the existing org-context guard). Centralize the band check (`isClubOrLeagueBand`) and retire the inline plan-list gates (incl. the dead `isLeagueOrClub`).
- **Phase 4 — Subscription-state reconciler (E).** A single idempotent authority for `subscription_status` vs Stripe; close the admin-demote-orphans-Stripe and cancel-before-Stripe-confirm gaps. → `/billing` + `/dba`.
- **Phase 5 — Drift ratchets in CI.** Extend the dictionary/token ratchet pattern: a check that fails when `PLAN_CONFIG`, `PLAN_PRICING_FACTS.md`, and any customer surface disagree on price/limit/inclusion/gating.

## Handoffs
- **`/marketing`** — SOT-1 (Club "whole staff" copy on `/pricing` + `/for-leagues`), SOT-3 (email "Coaches Portal" naming), SOT-10 (help "add-on" framing). Then derive remaining copy from the canonical source where structurally possible (SOT-6/7/14).
- **`/billing`** — SOT-11 (subscription-state reconciler), and the H8 gating-source switch already routed.
- **`/dba`** — data-model decisions for Phase 2 (enforce vs remove the override tables) and Phase 4.
- **`/plan`** — owns refining/sequencing this plan and its phases.

## Success criteria
- No customer-facing surface contradicts the canonical Facts doc / `PLAN_CONFIG`.
- A price/limit/date/label change requires editing **one** place; CI blocks any new duplicate.
- No operator control displays a value it doesn't enforce.
