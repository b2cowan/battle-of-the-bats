# Plan & billing, Stage 5: help, demos, tests and walks (build prompt)

> **Written 2026-10-28.** Paste into a new Codex chat on `dev`. **First read `PLAN_AND_BILLING_CODEX_RULES.md`**, then the
> plan. **Gate:** Stages 1–4 committed and verified; the owner has said "build Stage 5". Follow `.claude/commands/docs.md` for the
> help system (you cannot run the slash command; read the file and apply it). The in-app help in `lib/help-content/*.tsx` is the
> single source of truth.

## What Stage 5 makes true

The in-app guides describe the screens as they now are, **for every plan**, in the words the screens use: the same section names,
the same button labels, the same states. A coach finds "Plan & billing" in the coach help; an organizer finds it in theirs.

## Part 1 · Help articles

Rewrite or add, in the scannable format the help system uses (`memory/project_help_scannable_format` is Claude-side; follow the
existing articles' shape): `club-plan-and-billing` (now **plan-and-billing for every plan**, one article, plan-specific lines only
where a plan differs), `subscription-ends`, the Stripe-fees articles, the cancel article, the tournament help that links to
`../tournaments/settings/subscription` (`lib/help-content/tournaments.tsx`), and a **coach** article: where Plan & billing is,
what the owner can do, who can see it, what "Covered by {Club}" means, how to reactivate. **Every `keywords` / `searchText`
uses the one spelling** (`npm run check:spelling`). Link only to screens that exist; no phantom names ("Club's two sizes",
"Teams on your plan" — keep or drop them to match the final screen).

## Part 2 · Demos and marketing shots

Per the owner's rule (2026-09-13) **demos follow the product and never gate it**: do **not** add notes to demo files. Run
`node scripts/check-demos.mjs` and `node scripts/capture-marketing-shots.mjs --check`; if a tour destination or anchor is gone,
repair it. Report anything the story would now say differently — the curation is a separate `/demos` session.

## Part 3 · Tests, UAT, fixtures

UAT specs touching billing (`plan-gating.spec`, `marketing-seam.spec`, `coach-wall-doors.spec`) and the fixtures that seed billing
states (founding season, club, QA-day, coach notifications) match the final screens. Add UAT coverage for: standalone coach
reaches Plan & billing from rail and sheet without an admin screen; non-owner locked card on every plan; each wall's owner door.

## Part 4 · The owner walk (hand-off only)

You do not write the checkable walk Artifact (a Claude session does, one purpose per walk). In your hand-off give the **list of
states and roles to walk** — plan (6) × state (active, trial, past due, free time ×3, founding, cancelled) × role (owner,
admin, non-owner) × host (admin, portal) × width (desktop, 390px), marking the combinations that do not exist — so that session
can write it without re-reading the code.

## Done when

`npm run check:spelling`, `verify:changed` and `typecheck` green; help articles match the screens word for word. **Owed after:**
`/review` (light — copy and tests), the owner walk, release truth-up per `.claude/commands/release.md` Phase 2b when promoted.
