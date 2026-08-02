# Build prompt — Top Nav Repair, Phases 0–4 (all rulings in hand)

> Run this in a FRESH chat. This is a **build** brief: every decision is ruled (owner,
> 2026-08-01) — do not re-open R1–R11/T1, do not re-litigate the rulings digest. Build in phase
> order, hand the owner a QA slice after each phase, and **commit only with an explicit
> per-commit owner OK** (explicit pathspecs; never `git add -A`; beware the `[orgSlug]`
> bracket-pathspec gotcha — use `:(literal)`).

## Read first (in this order)

1. `docs/projects/active/TOP_NAV_REPAIR_PLAN.md` — the plan WITH rulings baked in (R1–R11, T1,
   phases, the micro-rulings bundle). The RULED banner at the top is authoritative.
2. `docs/projects/active/TOP_NAV_CONSISTENCY_FINDINGS.md` — the evidence base with file:line for
   every defect (D1–D12 + §4 hygiene + §6b type metrics). Findings map to R-items in the plan.
3. `memory/design_decisions.md` 2026-08-01 entries + `docs/agents/strategy/BUSINESS_DECISIONS.md`
   top entry (2026-08-01 "Acquisition chrome is for PROSPECTS") — binding context for R9/R11.
4. `docs/projects/active/NAV_UNIFICATION_PLAN.md` §3 (grammar) + §5 (anonymous-public invariant).
5. Mockups (what the owner approved): claude.ai/code/artifact/6d825ef3-192a-4e12-8b4b-6f46e8e947b1

## Non-negotiables

- **Anonymous-public invariant (§5)**: no new identity fetches, no role-tied SSR DOM on public
  surfaces. All new role-aware behavior (R4 header/CTAs, R11 hiding) resolves client-side
  post-hydration from signals that ALREADY exist (`useClientSignedIn`, the role-summary /
  workspaces resolution the operator pill uses). Run
  `tests/uat/scenarios/anonymous-public-invariant.spec.ts` + `org-return-flip-smoke.spec.ts`
  before starting and after every phase — 33/33 is the baseline; each phase ADDS assertions
  (listed per phase in the plan) and must leave the suite green.
- **Shared working copy**: other agents edit this tree concurrently. Re-check branch (`dev`) and
  stage+commit in one atomic invocation. A concurrent session's practice-plan editor had a live
  parse error at audit time — if every route 500s, check that first, don't debug your own change.
- **Dev server**: needs network access (Supabase). Restart (stop → clear `.next` → start) after
  shared-module/new-file phases; verify the platform-admin login probe returns 200.
- **Resource-aware checks**: `npm run verify:changed` + focused lint per phase; full
  `npm run typecheck` on phases touching shared modules (0, 1, 2).
- **Measure, don't eyeball**: after each visual phase, re-run a throwaway Playwright measurement
  of the touched bars (the audit's method; scripts in scratchpad, deleted after). Targets that
  exist on dev: `dev-club-org` (League/Club row), `dev-league-org/league` (R6), `dev-test-org`
  (non-public org, R1 repro), `/dev-test-org/live-demo` (tournament chrome), `uat-test-org`
  admin (owner session; UAT auth states in `tests/uat/.auth/`, refresh via the auth-setup
  project). ⚠ The UAT **coach** fixture had ZERO workspaces at audit time — coach-side checks
  need the fixture reseeded first (flag to `/uat`, don't silently skip).

## Build order

**Phase 0 — hygiene sweep** (plan §Phase 0; findings §4 + D12). Stale ruling-contradicting
comments; fallback sweep to tokens (incl. consumer `3rem` → `--chrome-bar-h`); marketing dead
code; "Sign In" casing canon; the two z-index fixes; scorekeeper adopts `--hud-surface` + shared
52px constant (visible — tell the owner in the QA slice); day-of/platform-admin "ruled exception"
comments; docs truing (incl. the D1-shed wording per the BUSINESS_DECISIONS entry).

**Phase 1 — the 404 family** (R1 + R2; findings D1/D2). R1: fold `isPublic` into
`isOrgHomeRealDestination` (its `EntitlementOrg` param narrows to 4 fields — widen the type and
every caller's select; sitemap/directory already filter `is_public` so behavior there must be
UNCHANGED — verify, don't assume). R2: the coach wall renders inside the portal frame
(CoachTopStrip + Home/sign-out/mailto; org link only when the predicate passes; team-workspace
copy variant kept). New guard assertions per plan.

**Phase 2 — the marketing seam** (R3 + R4 + R5; findings D3/D4/D11). Breakpoint to 900; signed-in
header swap (Account + "Open app →") + state-aware plan-card CTAs (owner ruled R4 explicitly:
current-plan marking, org owner → billing deep-link, coach → upgrade flow, prospects unchanged —
CTA facts from `lib/plan-config.ts`, never hand-written prices); ratify-64px token
(`--marketing-bar-h`) + 1200px `.container` + one clearance rule.

**Phase 3 — paid-surface polish** (R6 + R7 + T1; findings D5/D7/§6b). League pages adopt
`.container` (inner columns keep widths, left-aligned); org-row door order swap (operator door
outermost); T1 tokens: ONE nav-label spec + ONE pill-height token across the five bars —
canonical values recommended 12.48px/600 + 30px pill; get `/design`'s quick confirm before
applying, then log in `memory/design_decisions.md`.

**Phase 4 — rulings tail** (R8 + R9 + R10 + R11 + micro-rulings; findings D6/D8/D10). More-sheet
You group loses Chat (check the coach phone nav for the same door in the same pass); R9 is
wording-only (Phase 0 may have done it — verify); R10 suspended-page copy fix; R11 Pricing AND
"Run a Tournament" hide for workspace-holders (client-side, same workspaces signal as the
operator pill — prospects and anonymous UNCHANGED, that's ratified acquisition chrome); log the
four micro-rulings in `memory/design_decisions.md` per the plan's bundle (rail org-name rule,
consumer phone topbar, day-of inert wordmarks, check-in flip declined).

## Per-phase closeout

Gate green (verify:changed, guards, typecheck where due) → measurement re-run of touched bars →
owner QA slice (product-owner voice: what changed, where to look) → offer `/review` (repo rule;
Phases 1, 2, 4 are the substantive ones) → owner OK → atomic commit, explicit pathspecs →
update `TODO.md` sub-line + `memory/project_navigation_model.md` state.

**Help-docs check (repo rule):** R4's pricing-page behavior, R10's suspended copy, and R11's
disappearing Pricing link are user-facing flow changes — run the `/docs` check once at the end of
Phase 4 (search help content for "Pricing" references that now depend on role).

## Out of scope — do not touch

Stage H mobile pass · org light/dark setting · rep-teams index page · the platform-admin `next=`
open redirect (separate security item) · anything in the findings' "correct by design" table
(§3) · the prospect-facing acquisition chrome (Pricing + Run a Tournament stay for anonymous +
workspace-less users — ratified, measured-before-removed only).
