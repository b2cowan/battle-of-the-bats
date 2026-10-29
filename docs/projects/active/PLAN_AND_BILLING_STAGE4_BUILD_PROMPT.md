# Plan & billing, Stage 4: the rest of the family (build prompt)

> **Written 2026-10-28.** Paste into a new Codex chat on `dev`. **First read `PLAN_AND_BILLING_CODEX_RULES.md`**, then the
> plan. Leads name **files, not lines**; re-verify each. **Gate:** Stages 1–3 committed and verified; the Stage A drawings for the
> "Covered by {Club}" line and the free-team footer are ruled; the owner has said "build Stage 4".

## What Stage 4 makes true

- A coach on a **club-owned team** can tell **who pays**: a quiet, read-only "Covered by {Club}" line, placed where the drawings
  put it. **No** billing controls, no price, no link to the club's billing (they are not the owner). If the club's plan lapses, the
  existing wall still says so — this line is the calm everyday version of it.
- A **free Basic team's** "Upgrade to Premium" footer and Explore page speak the **same plan words** as the billing page (price
  line, "per team", free-through phrasing) — one source, so changing a price or a name changes it everywhere.
- The Money tab's "club bill" vocabulary does not collide with the subscription's (Money's "Club" bill is a team fee, not a
  subscription — check the words for any place a coach could mistake one for the other and report it; change only what the owner
  rules).

## Part 1 · "Covered by {Club}"

Audience is a coach/assistant on a team whose org is a **club/league** (not a standalone workspace). Source of truth: the org plan
carries the Coaches Portal (`lib/coach-portal-plan.ts` `orgPlanCarriesCoachesPortal`) and a paying club entitles its own teams
(`lib/team-workspace-entitlements.ts` — a club-owned team is **not** gated by `team_entitlements`). The line says only what is
true: "Covered by {Club}" (club name through the words module and `possessive()` where needed). It must not appear for a standalone
workspace, a free Basic team, or while the club is suspended (the wall owns that). Phone at 390px; no new tap target.

## Part 2 · Free-team footer and Explore on the registry

`components/coaches/ScopeShelf.tsx` footer, `components/coaches/CoachExploreCatalog.tsx`, `ScopeCeilingInterest`,
`CoachStartInterest`: price and plan name come from the registry/`plan-config` (today they say "$29/month per team" while the
billing page says "$29 CAD / month"; the owner rules which form each surface uses — **propose, do not pick**; the founding
"free through {date} — normally $29/month" variant reads from the same source). Gated plans keep "See everything it includes".

## Part 3 · Clean-up

Anything Stages 1–3 left on the compatibility list (the old `getBillingHref` export, dead helper branches, unused CSS in
`billing.module.css` if any survived), stale baselines (`.css-selector-baseline.json`, `.admin-type-baseline.json`,
`.layout-baseline.json` entries for removed screens — **generate with the scripts, do not hand-edit; layout baselines are
refreshed on staging**), and `scripts/check-public-tokens.mjs` file lists. Confirm with a repo-wide grep that nothing references
`BillingPagePlans`, `PLAN_FEATURES`, `CLUB_INCLUDES` or the old titles.

## Done when

The two coach-side additions render in the states the drawings show; no plan name or price is typed in a billing or coach upsell
screen (the Stage 1 guard is extended to cover these files); `verify:changed` + `typecheck` green. **Owed after:** `/review`,
`/docs` (coach help: "Who pays for my team"), the owner walk, dev-server restart.
