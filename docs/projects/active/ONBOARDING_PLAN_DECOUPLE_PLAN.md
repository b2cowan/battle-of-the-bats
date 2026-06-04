# Onboarding — Decouple Plan Selection from the Tournament Setup Wizard

**Status:** Built 2026-06-04 (awaiting browser verification)
**Owner:** debug/onboarding
**File:** `app/[orgSlug]/admin/onboarding/page.tsx`

## Problem (reported from prod)

In the tournament onboarding wizard:
1. **The "One Quick Question" step (qualifying) is skipped on the way forward.** After choosing a plan the wizard jumps straight to *Create tournament* (shown as "Step 3/7"), even though the qualifying step is step 2. The user only noticed because the counter read 3 while they'd seen 2 screens.
2. **Back dead-ends on the plan picker.** Pressing Back walks into the `plan` step, which is rendered with no Continue button and the org's current plan shown as a disabled "Current plan" card — a dead end.
3. **The counter is inflated to /7** with an effectively unreachable step 1.

## Root cause

`'plan'` is wedged into the wizard's step array:

```ts
const WIZARD_ORDER = ['plan', 'qualifying', ...STARTUP_ORDER, 'review']; // 7 steps
```

- `getWizardResumeStep()` returns `'tournament'` after a plan is chosen (commit de16048), skipping `'qualifying'` — it should resume at the first *setup* step, which is `'qualifying'`.
- Because `'plan'` is index 0, `getPreviousWizardStep('qualifying')` returns `'plan'` → Back dead-ends.
- Because the array has 7 entries, every step shows `/7`.

## Key realization — the plan gate already exists

Routing already decouples plan selection (`lib/user-contexts.ts`):
- Orgs **without** an explicit plan → `/admin/onboarding?choosePlan=1` → the full-page plan gate (`planChoiceRequired` branch, `renderPlanChooser(true)`).
- Orgs **with** a plan → `/admin/onboarding?continueSetup=1` → resume the wizard.
- Sign-up sends new orgs to `?choosePlan=1` (`app/auth/signup/page.tsx`, `app/api/auth/signup/route.ts`).

So a standalone plan gate is already shipped. The only bug is that `'plan'` is *also* a wizard step. The decouple is therefore a small, low-risk change — not a rewrite of `choosePlan`/Stripe.

## Design

- **Wizard = 6 setup steps:** `qualifying → tournament → divisions → welcome → venues → review`, numbered `/6`.
- **Plan selection stays a standalone gate** reached via `?choosePlan=1` (already built). After a choice it round-trips through `?success=1`, the resume effect opens the wizard at `qualifying`.
- `'plan'` is removed from `WIZARD_ORDER` but **kept in the `StartupTaskId` union** so legacy guards (`activeModal === 'plan'`, `markStartupTask('plan', …)`) still type-check.

## Implementation (3 edits, all in `onboarding/page.tsx`)

1. **`WIZARD_ORDER`** — drop `'plan'`: `['qualifying', ...STARTUP_ORDER, 'review']`. Update `StartupTaskId` to `'plan' | typeof WIZARD_ORDER[number]` so `'plan'` remains a valid `ActiveModal`.
   - Side effects (free): `getPreviousWizardStep('qualifying')` → `null` (Back disabled, dead-end gone); `renderModalFrame` counts `/6`.
2. **`getWizardResumeStep()`** — always return `'qualifying'` (plan is gated upstream). Simplify the resume effect call site; drop the unused `shouldResumeAfterPlan`.
   - Safety: if a plan-less org somehow reaches the wizard without `?choosePlan=1`/`?continueSetup=1`/`?success=1`, redirect to `?choosePlan=1` (the decoupled equivalent of the old in-wizard plan step).
3. **Remove the dead `activeModal === 'plan'` case** in `renderActiveModal()` (the legacy in-wizard plan step). Nothing sets `activeModal='plan'` anymore.

`choosePlan`, `advancePlanStep`, and the `?choosePlan=1` gate render are **unchanged** — the `planChoiceRequired` completion branches (mark plan complete → `?success=1`) remain the live path; the `activeModal === 'plan'` else-branches simply become unreachable.

## Entry-point behavior after change

| Entry | Behavior |
|---|---|
| New sign-up `?choosePlan=1` | Plan gate → pick plan → `?success=1` → wizard at **qualifying (1/6)** |
| Resume `?continueSetup=1` | Wizard at **qualifying (1/6)** |
| `?success=1` (just chose plan) | Wizard at **qualifying (1/6)** |
| Plan-less, no param (edge) | Redirect to `?choosePlan=1` (gate) |
| League/Club | Unchanged — separate `league-*` wizard + its own resume effect |

## Risks / edge cases

- League/Club flow is independent (`LEAGUE_WIZARD_ORDER`, separate resume effect) — untouched.
- Post-onboarding "View plans" (`planChooserOpen`) — untouched (`choosePlan` not modified).
- `'plan'` kept in the type union prevents a cascade of comparison type-errors.
- Hot-reloads (page component) — no dev-server restart required.

## Browser test checklist

- [ ] New org via sign-up: plan gate → choose Tournament Plus → lands on **qualifying (1/6)**, not tournament; Back on qualifying is disabled (no plan dead-end).
- [ ] Free plan ("Continue free") from the gate → same wizard entry.
- [ ] Walk all 6 steps → review shows **6/6**; Back from each step lands on the previous setup step, never the plan picker.
- [ ] Resume via `?continueSetup=1` → opens at qualifying.
- [ ] League/Club onboarding still opens the league wizard normally.
