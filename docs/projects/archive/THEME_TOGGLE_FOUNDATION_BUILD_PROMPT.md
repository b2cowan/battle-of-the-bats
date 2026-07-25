# Build Prompt — Theme Toggle Foundation (Cleanup + Consumer Dark⇄Warm Switcher)

**For a NEW chat. This is a BUILD prompt executing an owner-ratified plan.** Scope = Phases 0–2 of
`docs/projects/active/THEME_TOGGLE_FOUNDATION_PLAN.md` ONLY. The round-2 hard-frame mockups
(Phase 3) and the warm coaches-portal build are **NOT** in this chat — do not start them.

Everything here was ratified 2026-07-21 (design_decisions.md entry **TH-1…TH-4**). Do not
re-litigate the decisions; build to them. Where this prompt and the plan disagree, the plan wins;
where the plan and the TH log entry disagree, the log entry wins.

---

## READ FIRST (in order)

1. `docs/projects/active/THEME_TOGGLE_FOUNDATION_PLAN.md` — the plan you are executing.
2. `memory/design_decisions.md` — **grep for "TH-1"** (the 2026-07-21 Theming ratification entry;
   the file is ~400KB, never read it whole). Also grep **P0-1** (nav bar follows the venue —
   composes with TH-1, no conflict) and **S1-2** (the warm journey stays warm).
3. `docs/projects/active/WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md` — §2 (verified theming
   mechanism map), §5 (cleanup detail + quantified debt), §6 (failure-mode registry), §9 (key
   facts index with file:line pointers). This is the evidence base; trust it over stale memory.
4. `components/consumer/warmTheme.module.css` — `.warmVars` vs `.warm`; the additive token system.
5. `lib/consumer-routes.ts` — `isWarmSkinPath()` / `CONSUMER_SHELL_PREFIXES` /
   `WARM_JOURNEY_PREFIXES` (the static gate you are making preference-aware).
6. `app/globals.css` — BOTH `:root` blocks: `--primary` family (~line 22) and the additive
   platform block with `--blueprint-blue`/`-rgb` (~line 307); the light-mode single-authority
   comment (~line 160); `.btn-danger` raw rgba; dead `@keyframes pulse-lime`.
7. `scripts/check-public-tokens.mjs` — `PUBLIC_DIRS` / `EXCLUDE_SEGMENTS` / the three modes.
   **Known:** extending to operator segments requires NEW scan roots + a SEPARATE baseline/report —
   the exclude-set alone never visits those directories.
8. `app/layout.tsx` (~lines 55–72, the density no-flash inline script + `theme-color` meta) and
   `lib/admin-density.tsx` (note: its exported `DENSITY_NO_FLASH_SCRIPT` is currently DEAD —
   consolidate rather than adding a third hand-copied script).
9. `components/consumer/ConsumerNav.tsx` (~lines 51, 68–69 — where `warm.warmVars` +
   `topbarWarm`/`bottomNavWarm` are applied off the route check) and one warm tab for the wrapper
   pattern (e.g. `components/consumer/ScoresClient.tsx` + its module CSS).
10. `docs/agents/db/DATA_DICTIONARY.md` — confirm no user-preference table exists yet (the
    migration below creates the first one).

## The ratified contract (build to this exactly)

- **Attribute:** `data-user-theme` on `<html>`: `"dark" | "warm"`; absent = `default` = each
  shell's current default (consumer shell = warm as today; coaches portal = dark). **Non-choosers
  must see pixel-identical surfaces everywhere.**
- **Never** reuse or overlap `data-color-mode` (org/tournament authority). Org-branded surfaces
  (tournament public, org home, public team pages) and the warm sign-up journey
  (`WARM_JOURNEY_PREFIXES`) ignore the preference entirely.
- **One injection point per theme** — no second block may re-declare the same custom properties
  (this repo has three documented regressions from equal-specificity dual-authority CSS; see
  analysis §6.3).
- **Persistence:** account-level source of truth + localStorage fast path (`fl_user_theme` or
  similar) + root-layout no-flash script. Account value reconciles post-fetch (one rare repaint
  acceptable — the density precedent).

## Workflow requirements (AGENCY_RULES — blocking)

Before any code: present in-conversation (a) an **Implementation Plan / task list** for this build
and (b) a **plain-language PM UX summary** (what the user sees and does differently; base it on
`THEME_TOGGLE_FOUNDATION_PM_BRIEF.md`). Then build.

## Phase 0 — Contract prep

- Invoke **`/db`** for the user-theme-preference migration decision. Plan's recommendation: a
  minimal `user_preferences` table (`user_id` PK, `theme text null`) rather than widening
  `organization_members` (preference is identity-scoped; multi-org users must not fork themes).
  `/db` owns the final shape. Same unit of work: `DATA_DICTIONARY.md` update +
  `npm run refresh:snapshots` + `npm run check:dictionary`.

## Phase 1 — Cleanup (~2 days, ships first, zero visible change expected)

1. **⚠ OWNER DECISION FIRST — the blueprint-blue open flag (TH-3a).** Before shipping the alias,
   surface to the owner: post-alias, a custom-branded org's `--primary` cascades into
   coaches-portal + admin accents for that org (today pinned platform blue via `--blueprint-blue`,
   101 refs in `coaches.module.css` alone). Present option (a) accept — operator accents follow
   org brand (alias `--blueprint-blue: var(--primary); --blueprint-blue-rgb: var(--primary-rgb);`
   — single-source, analysis-recommended) vs (b) pin operator chrome to a platform constant and
   document it on the rebrand checklist. Show both looks (a dev-org with a custom brand color is
   the comparison surface). **Do not ship the alias before the owner picks.**
2. Implement the chosen reconciliation. Verification: for the DEFAULT org the alias is
   value-identical — expect ZERO visual change; manual pass over coaches portal (sidebar,
   bottom-nav, insights-door hover, modal Save), admin dashboard, chat, marketing pricing section;
   plus one custom-branded dev org if option (a).
3. **Ratchet extension:** operator scope for `scripts/check-public-tokens.mjs` (new roots:
   `app/[orgSlug]/admin`, `app/[orgSlug]/coaches`, `app/[orgSlug]/scorekeeper`, `app/coaches`,
   `app/platform-admin`, `components/admin`, `components/coaches`) with a **separate** baseline
   file + report doc (`--scope=operator` flag or sibling script — never conflate with the public
   redesign baseline). `--init` freezes today's counts (expect ≈ admin 211 / coaches 66 /
   scorekeeper 58 in module CSS). Wire into `npm run verify:changed`.
4. Zero-visual-change housekeeping only: delete dead `@keyframes pulse-lime`; `.btn-danger` raw
   rgba → `rgba(var(--danger-rgb), …)`. Nothing else — P2–P4 debt tranches are out of scope.

## Phase 2 — Consumer Dark⇄Warm switcher

1. Preference plumbing: the Phase-0 migration; account API read/update; localStorage fast path;
   **root-layout** no-flash script (nested layouts re-create scripts on client nav — root only),
   consolidated with the density script constant.
2. Pref-aware warm gating: consumer-shell routes render warm when pref ∈ {default, warm}, dark
   when pref = dark. The warm JOURNEY stays warm unconditionally. Each tab's dark rendering is its
   existing base styling under the warm overlay — **verify per tab** (Home/Scores/Chat/Account),
   and `/account/notifications` must flip WHOLLY with its tab (never half — the WARM_HOLDOUTS
   lesson; analysis §6.1).
3. **Appearance card on Account** — the rev-1 mockup artifact frame is the binding spec
   (`claude.ai/code/artifact/f503dfc9-c4bc-4d7f-a5c0-b63b7ae7040e`): Dark/Warm options with swatch
   previews. **Copy (amended per TH-5 §4, 2026-07-21):** "Applies to your FieldLogicHQ app.
   Tournament pages always show the organizer's colors." — do NOT mention the coaches workspace
   yet; the portal joins the toggle only when its warm coverage is complete (its own project),
   and the copy gains "…and coaches workspace" in that release. Do NOT render a dead Light
   option — omit it unless `/design` explicitly blesses a "coming later" treatment.
4. Dynamic `theme-color` meta on consumer routes (dark `#0a0a0f` / warm paper); org-branded
   routes unchanged.
5. QA gates (all must pass before handoff): no-flash on hard reload AND client nav in both themes;
   signed-out device-only pref vs signed-in account-wins; shared-device sanity (sign-out keeps the
   device pref, sign-in overlays the account pref); PWA installed pass; tournament pages
   byte-identical in both prefs; non-chooser pixel-identity everywhere.

## Discipline

- One shared **`dev`** branch (re-check HEAD before committing); **explicit pathspecs only**;
  `git show --stat HEAD` after every commit; **NO commit/push without the owner's per-action OK.**
- `npm run verify:changed` + **`npm run typecheck`** (shared modules + root layout touched).
- **Restart the dev server before owner handoff** (new files + shared-module changes; stop server
  → `rm -rf .next` → `npm run dev` → wait for Ready).
- After each substantive phase: offer **`/simplify`** (new shared theme plumbing = new
  abstraction) then **`/review`**. After Phase 2: offer **`/docs`** — the Appearance card is a new
  user-facing flow (Account → Appearance) and the in-app help must document it, including "why
  doesn't the tournament page change?".
- No new top-level routes are expected; if one appears anyway, it joins the SW cache denylist +
  cache-version bump (PII rule).
- Report honestly: skipped checks + residual risk named at handoff; owner performs browser testing.

## Out of scope (do not start)

Warm coaches-portal build (gated on round-2 mockups) · round-2 mockups themselves · Light theme ·
admin/scorekeeper theming · operator debt tranches P2–P4 · runtime brand editor · anything
touching tournament-page theming (P0-1/R1-2 territory).

## Definition of done

Phases 0–2 built on dev, QA gates green, dev server restarted, owner walked through the
test script (flip Dark⇄Warm on Account → four tabs follow instantly with no flash; second device
follows the account; tournament pages identical in both; untouched-setting users see zero change),
`/simplify` + `/review` + `/docs` offered, TODO.md updated, and commits made only with per-action
owner OKs.
