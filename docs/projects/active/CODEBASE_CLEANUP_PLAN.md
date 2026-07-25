# Codebase Cleanup — Tranche Plan

> Status: **PROPOSED 2026-07-24 — investigation complete, NO tranche executed. Owner ratifies each tranche before any execution chat touches code.**
> Companion docs: `CODEBASE_CLEANUP_ANALYSIS.md` (full verified findings inventory + evidence — finding IDs like A02/C03/D01 below refer to it) and `CODEBASE_CLEANUP_PM_BRIEF.md` (plain-language owner brief).
> Produced by the 2026-07-24 multi-agent audit (160 agents: 14 finders + adversarial verifier per removal candidate + completeness critic + 7 recovery verifiers; final tally 208 findings — 173 confirmed / 30 downgraded / 5 refuted).

## Binding rules for every execution tranche

1. **Per-action owner OK before any commit.** Stage explicit pathspecs only; `git show --stat HEAD` after each commit.
2. **Re-verify before deleting.** Concurrent sessions share this tree. Immediately before deleting any file/export, re-run the zero-reference grep from the analysis doc. A finding verified 2026-07-24 is not a license to delete blind a week later.
3. **⚠ Local `master` is stale (G33).** Local `master` = `8f8b9e1b` (2026-06-25); true deployed prod = `origin/master` = `f064712d` (2026-07-23, ~100 commits ahead). All prod-reference checks in execution tranches must use `origin/master` after a `git fetch`. Recommended one-time fix: `git fetch && git branch -f master origin/master` (owner/ops action — flag before doing).
4. **Dev-server restart rule.** Every tranche that deletes files or touches shared modules ends with: stop server → `rm -rf .next` → `npm run dev` → verify ready, before owner browser testing.
5. **Verification suite per tranche:** `npm run verify:changed`; `npm run typecheck` when lib/ or shared modules are touched; ratchet `--init` re-freeze only where a tranche explicitly extends scopes.
6. **DB changes** (Tranche 5 only): routed through `/db`–`/dba`, applied via `apply-migration-api.mjs` to BOTH envs, with `DATA_DICTIONARY.md` update + `npm run refresh:snapshots` in the same unit of work. ALL DB drops are owner-decision regardless of mechanical confidence.
7. **Never** commit `pnpm-workspace.yaml`; never `git add -A`.

---

## Tranche 0 — Urgent, owner-gated ✅ **EXECUTED 2026-07-24 (owner-approved; commits pending per-action OK)**

Execution record: mig 199 applied to dev (no-op) + PROD — all 6 "Allow public full access" anon-ALL policies, `pools_admin_all` (authenticated-ALL), and 2 duplicate pools read policies DROPPED; live pg_policies re-verified (only `teams_anon_insert` remains, both-envs, deliberately deferred to T5); snapshots refreshed (watermark #199) + DATA_DICTIONARY gotcha added. Dev DB password ROTATED via Management API (leaked value dead); both password-bearing scripts deleted; `.claude/settings.json` hook retargeted `*run-migration*`→`*apply-migration-api*` (now runs the full snapshot refresh). 3 public mockup HTML files deleted (brand preview kept). Local `master` fast-forwarded to origin/master (now tracking; prod advanced again 2026-07-24 → `f62c03a0`). verify:changed green for all T0-touched files (one UNRELATED pre-existing ratchet failure from a concurrent session's team-profile.module.css edit — flagged, not touched).

| # | Item | Action | Findings |
|---|------|--------|----------|
| 0.1 | **Prod-only wide-open anon RLS policies** | On PROD only, `pg_policies` has permissive `roles={anon}, cmd=ALL, qual=true, with_check=true` policies named "Allow public full access to X" on **announcements, diamonds, divisions, games, teams, tournaments** (+2 similar on `pools` per D10 verification). The public anon key can write/delete these tables via raw REST. Dev runs correctly WITHOUT them, proving the scoped policies suffice. Owner + `/db` confirm intent, then `DROP POLICY` all of them on prod. | D01, D10 |
| 0.2 | **Committed plaintext dev DB password** | `scripts/run-migration.mjs:17` and `scripts/verify-migration.mjs:10` contain a literal dev DB password, committed on dev AND master history. Deleting the files does NOT remove it from git history → **rotate the dev DB password** (Supabase dashboard), then delete both scripts (both are non-functional: `pg` isn't even installed; superseded by `apply-migration-api.mjs`/`db-query.mjs`). Follow-up: `.claude/settings.json` hook `"if": "Bash(*run-migration*)"` becomes vacuous → retarget it to `*apply-migration-api*` (also fixes E16: the auto-snapshot-refresh hook currently never fires). | E18, E12, E16 |
| 0.3 | **Web-accessible throwaway mockups** | `git rm public/depth-chart-mockup.html`, `public/mockups/insights-next.html`, `public/mockups/player-awards-mockup.html` (dev-only, own plan docs call them throwaway; served at literal URLs). **Keep `public/brand/preview.html`** — documented permanent brand tool, lives on prod. | F07 |
| 0.4 | **Stale local master** | `git fetch` + reset local `master` to `origin/master` (see binding rule 3). | G33 |

No app-code behavior changes in this tranche. 0.1 is the single most important finding of the audit.

---

## Tranche 1 — Safe-mechanical code deletions (~3,000 LOC, zero-runtime-risk, all CONFIRMED) ✅ **EXECUTED + COMMITTED 2026-07-25**

Execution record (2026-07-25, solo chat): all sub-sections 1a–1h + the deferred Stripe-prices route executed on dev — 10 single-scope commits (`ef592614` 1a · `0669c12f` 1b · `c5ec38b1` 1c · `3f80d58b` 1d · `a3646da9` 1e-1 · `5dfe7a60` 1e-2 · `fccd41f5` 1f · `43f4c880` 1g · `024b1f24` 1h · `468b4841` Stripe route), ~9,000 LOC removed (atomic `git commit -- <paths>` after a concurrent rebase orphaned the first 1e-1 attempt — re-verified + re-landed). **Re-verify overturned the audit on 5 KEPT-live items:** HudSkeleton (still live), `--home-rust-rgb` (live consumer in TryoutDecisionBoard the audit missed → kept, `--home-plum-rgb` still removed), CoachGuidanceStage type + `helpHref` (used by live getCoachGuidance), btnPrimary/Secondary/Ghost. **Verify-then-include:** HudSkeleton EXCLUDED; Stripe-prices route DELETED (/billing-approved) + DATA_DICTIONARY trued to the single change-request write path. **R3:** 3 of the claimed 7 grouped exports enumerated + deleted; other 4 not identifiable from the analysis doc → deferred. `typecheck` clean; `verify:changed` clean EXCEPT the pre-existing team-profile.module.css public-ratchet (now committed by concurrent `a6117c31`, 4 color-mix/ink literals — NOT T1's, still red). Clean dev restart verified (login + `/` HTTP 200). Full commit-by-commit detail in memory `project_codebase_cleanup_audit.md`. Open follow-ups: post-HudPanel a few HUD tailwind tokens may now be orphaned (future finding); R3's 4 unidentified exports.

Everything here had zero references in dev AND the prod tree, with all adversarial traps checked. Delete in the groups below; after the tranche: `verify:changed` + `typecheck` + dev-server clean restart.

### 1a. Dead pages/components (+ their CSS)
- `app/platform-admin/stripe-prices/StripePricesClient.tsx` + `stripe-prices.module.css` (A02) — page is a redirect stub. *Quick check first:* `app/api/platform-admin/stripe-prices/route.ts` appears consumed only by this dead client → verify + delete together if confirmed.
- `app/platform-admin/plans/PlansClient.tsx` + `plans.module.css` (A04/A07 — same finding twice; keep `page.tsx` as the redirect stub).
- `components/public/PublicBracketView.tsx` (A03 — flagged "safe to delete" in plan docs since 2026-06-05).
- `components/public/RaceToPlayoffsView.tsx` (A33) + its dead CSS in `standings.module.css` (clean block ~1007–1310; second cluster 1814–1897 sits inside a shared mobile media query with live rules — surgical strip).
- `components/ui/HudPanel.tsx` + `components/ui/StatDisplay.tsx` (A08). *Follow-up check:* `components/ui/HudSkeleton.tsx` looked equally orphaned — verify and include.
- `components/marketing/RegistrationConfirmationCta.tsx` (A20, judgment→include only with owner nod: an archived plan deliberately kept it "for possible reuse"; also prune its classes in `tournament-growth.module.css`).

### 1b. Dead API routes
- `app/api/admin/tournaments/[tournamentId]/registrations/import/history/route.ts` (A05 — superseded by `imports/history`; leave the sibling template/preview/commit routes).
- `app/api/admin/accounting/budget-plan/lines/[lineId]/allocation-preview/route.ts` (A06).

### 1c. Dead lib exports
- `lib/db.ts`: delete the ~49 zero-caller CRUD exports (A01). Verifier's independent scan found **59** zero-ref exports — reconcile the exact list with a fresh scan at execution time; land as an isolated diff (file is actively growing).
- `lib/auth.ts` legacy stubs `login()/logout()/isAuthenticated()` (A13, actual lines 90–96).
- `lib/email.ts` `passwordResetHtml()` (A12).
- `lib/import/index.ts` unused barrel (A14).
- `lib/coach-guidance.ts` `getCoachGuidanceStage` + `getCoachShortcuts` + orphaned `CoachGuidanceStage` type + docstring fix (A10).
- `lib/team-workspace-entitlements.ts` `hasTeamFreeTournamentSlot` + `hasTeamScopedRepTeamEntitlement` (A09).
- `lib/utils.ts` `downloadCSV()` (B06 — superseded by `lib/export/csv.ts`).
- Small grouped exports (recovered finding R3, all declaration-only dev + origin/master): `lib/assistant-invites.ts:128 listOpenAssistantInvitesForTeam` and 6 siblings from the grouped finding (incl. `ALL_EVENT_TYPES`, dead on dev's design since the org-notifications page became a redirect stub).

### 1d. Retired-flag residue (A11)
- Delete `.env.local:61` `NEXT_PUBLIC_COACH_WARM_PREVIEW=1` (untracked file, local only).
- Rewrite the stale comment `app/globals.css:421-431` (claims the marker is env-gated; it's unconditional).
- Do **NOT** touch `lib/coach-warm-preview.ts:8-11` — that docstring is correct retirement narration. (Renaming/inlining the module itself is Tranche 4, A23.)

### 1e. Dead CSS (confirmed zero-reference; respect the comma-list cautions)
Whole orphaned files: `components/consumer/ConsumerPage.module.css` (C01, 298 lines), `app/(consumer)/auth/select-org/select-org.module.css` (C04), `app/Home.module.css` + `components/Footer.module.css` (C23).
Dead-selector strips (count · caution): `app/page.module.css` ~44 selectors + their @media blocks (C02) · `app/[orgSlug]/schedule/schedule.module.css` ~52 (C03 — 5 names live inside a comma-list with live selectors, strip tokens only) · `onboarding.module.css` 28 + verify planCard* siblings (C05) · `dashboard.module.css` 18 (C06) · `rep-teams.module.css` 16 (C07 — keep btnPrimary/Secondary/Ghost) · `branding.module.css` 13 (C08 — cardThumb_* are dynamic, keep) · `startForm.module.css` 13 (C09) · `[orgSlug]/Home.module.css` 9 (C10 — 2 names are comma-list tokens) · `TryoutDayCard.module.css` blind-toggle cluster + warm-override lines 369–374 (C11) · `dev.module.css` 7 cred* (C12 — readiness* are dynamic, keep) · `help.module.css` 7 (C13) · `house-league.module.css` 2 (C14) · `orgDetail.module.css` 2 (C15) · `pricing/page.module.css` .catLabel (C20) · `plans-pricing.module.css` 9 (C41 — 2 declarations comma-share live selectors, surgical) · `auth.module.css` .bg/.orb1/.orb2 (C17) · **recovered R4:** `schedule-admin.module.css` ~33 selectors, diamond/priority-picker + mobile score-input clusters (CONFIRMED across all 7 importers, zero dynamic access/composes; several dead classes live inside indented @media blocks, and `.scoreTeamName` (dead) sits next to `.scoringTeamName` (live) — strip carefully).
Dead tokens in `app/globals.css`: `--bg-raised` (3 sites, remove all together), `--info-strong` (3), `--black-10` (+ `lib/public-tournament-theme.ts:44`), `--home-plum-rgb` + `--home-rust-rgb` together (C18/C19/C21/C22/C42). C27 confirms these 5 are the complete dead-token set.
Tailwind: the 13 zero-usage theme tokens in `tailwind.config.ts` (C16/E01 — keep `fl-text`, it's live).

### 1f. Dead scripts (one-offs for shipped work; all confirmed unreferenced)
`scripts/verify-migration-090.sql`, `verify-migration-093.mjs`, `verify-migration-093.sql`, `verify-migration-093-rest.mjs` (E04) · `fix-encoding.js` (E05) · `scripts/journeys/` subtree + `journey-shots.mjs` + tmp-* + `_inspect-club-org.mjs` + `tmp-j6-ids.mjs` (E06/E07 — the 14 *.json are input specs, delete with them) · `seed-fan-experience-qa.mjs`, `seed-fan-qa-standings.mjs`, `seed-coach-nav-test.mjs` (E08/E11) · `add-demo-pools.mjs` (E09) · `cleanup-orphan-draft-tournaments.mjs` (E10 — target org gone from both DBs).
**Keep (refuted/live):** `seed-free-tier-org.mjs` (E20 — free-test-org is the standard fixture for the OPEN Platform-Admin Walkthroughs project) · `outline-svg-text.js` (E19 — documented brand recovery tool; see Tranche 4 bundle) · `mirror-tournament.mjs` (E13 — live ops tool, document it) · the whole BOTB cluster incl. `seed-botb-extra-divisions.mjs` (E17 + recovered R5 REFUTED — active owner QA toolkit, in use as of 2026-07-24).

### 1g. Dependencies, env, assets, PWA
- `package.json`: remove `resend` (E02 — email goes through raw fetch; SDK never imported).
- Env: remove `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` from `.env.local` + its line in `docs/agents/ops/NEW_MACHINE_SETUP.md:109` (E03 — checkout is Stripe-hosted redirect; no client SDK exists).
- Assets: `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` (F01) · `public/brand/logo-B.png` (F03) · `public/images/news-default.png` (F04 — empties `public/images/`) · `public/brand/logo-A.svg` + fix the 2 doc-comment CLI examples that cite it (F05). (`logo-B-outlined.svg` → Tranche 4 bundle with E19.)
- `public/sw.js`: remove stale `'/dashboard'` from `NEVER_CACHE_PREFIXES` + fix the 8-vs-12 route comment (F02). Related residue noted, no action needed: `lib/reserved-slugs.ts` keeps 'dashboard' reserved (harmless), `AdminTitleManager.tsx:10` dead regex (optional).
- Help link: `lib/help-content/platform-admin.tsx:393` stale Stripe Prices link → point at Plans & Pricing (A15).

### 1h. Tiny hygiene fixes (additive, not deletions)
- Wrap `app/api/public/tournament-viewer/route.ts` GET in `withObservability` → 100% coverage (B08).
- Wire `check-observability-coverage.mjs` into `verify:changed` so coverage can't silently regress (E15).

---

## Tranche 2 — Docs / TODO / memory truth-up (safe-mechanical, no code; can run any time)

The 2026-07-22/23 prod promotes made a large slice of tracking docs stale in the same direction (things marked pending that actually shipped).

**Archive moves** (`Move-Item docs/projects/active/X.md docs/projects/archive/X.md`, plans + PM briefs + spent build prompts together):
- Theming set: `THEME_TOGGLE_FOUNDATION_{PLAN,PM_BRIEF,BUILD_PROMPT}.md`, `WARM_PORTAL_THEME_OPTION_{PLAN,PM_BRIEF,BUILD_PROMPT}.md`, `WARM_PORTAL_STAGE2_BUILD_PROMPT.md`, `WARM_PORTAL_STAGE5_6_BUILD_PROMPT.md` (G02); `WARM_PORTAL_PROD_PROMOTION_CHECKLIST.md` + exploration trio (G23 — note ANALYSIS §9 keeps residual reference value; archive with pointer).
- Role Flip spent prompts: `ROLE_FLIP_P{1,2,3}_BUILD_PROMPT.md` (G03 — keep the parent plan + P4 prompt active, fix parent header per G28).
- `SCHEDULE_HEALTH_RULES_PLAN.md` (G05 — header corrected to SHIPPED via 8564624c; also strike TODO.md:307) · `TRUST_INTEGRITY_HARDENING_PLAN.md` + PM brief (G06) · `OPERATOR_TOKEN_JUDGMENT_TRANCHE_{PLAN,PROMPT}.md` (G07 — keep OPERATOR_VISUAL_TOKEN_DEBT.md active) · `NOTIFICATION_CENTER_REWORK_{PLAN,PM_BRIEF}.md` (G08) · `UNIFIED_HOME_PHASE6_FOLLOWS_{PLAN,PM_BRIEF}.md` + `UNIFIED_HOME_PHASE6_BUILD_PROMPT.md` (G04) · `UNIFIED_HOME_BUILD_P01_PROMPT.md` + `FOUNDING_SEASON_COACHES_WARM_RESTYLE_BUILD_PROMPT.md` (G09) · `REGISTRATION_COMMAND_CENTER_V1_PLAN.md` + brief, with status header added first (G29; also flip TODO.md:176 to [x]) · `GAME_DAY_BOARD_CUSTOMIZE_PLAN.md` + PM brief (G30, header notes later v3 extensions) · `NOTIFICATION_PAUSE_SWITCH_{PLAN,PM_BRIEF}.md` (G32 — **owner confirms device QA is done first**, else header-fix only).

**Header fixes, keep active** (project genuinely has open tail): `STRIPE_PRICE_VALIDATION_PLAN.md` add status (G10) · `PLAYOFF_TIEBREAKER_COINTOSS_RUNDIFF_PLAN.md:3` (G15) · `FREE_TIER_LEAGUE_STARTER_PLAN.md:10` (G16) · `HELP_PHASE2_INCONTEXT_PLAN.md:3` + TODO.md:463 (G24) · `FOUNDING_SEASON_COACHES_FREE_PLAN.md:3` (G25) · `FREE_TIER_COACHES_UNIFIED_PLAN.md:3` (G26) · `ADMIN_ROLE_PARITY_PLAN.md:3` (G27) · `ROLE_FLIP_NAVIGATION_PLAN.md:3` (G28) · `HELP_SYSTEM_REDESIGN_PLAN.md:3` (G34) · `FREE_TIER_STRATEGY_PLAN.md` needs nothing (G35 refuted — supersession note already present).

**TODO.md truth-up:** lines 10 (G17), 11 (G18), 13 (G19), 18–19 (G20), 23 (G21), 44 (G22), 176 (G29), 307 (G05), 463 (G24); delete the stale duplicate Unified Home entry at ~line 280 (G11).

**Memory truth-up** (auto-memory dir): resolve every "mig NNN prod-pending / dev-only" ⚠ marker through mig 198 — all verified applied to prod (G01: notification_settings 185, pause_switch 194, warm_portal 195, seam 196, unified_app 186+188, scheduled_jobs 183+187, tags_awards 182+184, player_development 189–191, invite_reconciliation 128, schedule_publish 129, fp3 130, trust_integrity 127) · MEMORY.md index line for prod-release-history (G12) · Player Development "(ACTIVE)" tag (G13) · Tournament Seam WI-2C "uncommitted" (G14) · add small memory entries for the 4 shipped-but-untracked features: schedule health rules, Registration Command Center, game-day board customize, Stripe price validation (G31).

---

## Tranche 3 — Token-ratchet scope extensions (then `--init` re-freeze both baselines)

Current uncovered debt found: ~24 hex + ~132 rgba in consumer surfaces, 1 hex + 191 rgba in marketing pages, ~126 hex + ~304 rgba in operator component libs.

1. **New `consumer` scope** (C36): dirs `app/(consumer)`, `components/consumer` + files `components/home/PendingInvitationsCard.module.css`, `app/team/page.module.css`, `components/notifications/{PreferencesTable,PushDeviceTester,FanAlertsCard}.module.css`. Exclude `warmTheme.module.css` (defines tokens); `ConsumerShell` stays in public.files.
2. **New `marketing` scope** (C37): dirs `app/for-*`, `app/pricing`, `app/changelog` + files `app/page.module.css`, `PricingSection`, `EarlyAccessForm`, `EarlyAccessModalTrigger`. Note: script counts hex only — decide whether to add an rgba counter (marketing debt is 99% rgba).
3. **Extend `operator` scope** (C38/C39/C47): add dirs `components/accounting`, `components/billing`, `components/feedback`, `components/platform-admin`, `app/tryout-score`; add files (NOT whole dir — `register.module.css` is public per C24): `components/rep-teams/{TryoutDayCard,TryoutFlowHeader,TryoutCheckIn,TryoutAcceptDrawer}.module.css`, `components/notifications/{notifications,notifications-page,EnablePushBanner}.module.css`.
4. **Extend `public` scope** (C24/C25): files `components/rep-teams/register.module.css`, `components/league/register.module.css`, `components/YearSelector.module.css`, `app/system-screens.module.css` (also add the latter to operator — it's root chrome).
5. **Owner decision — shared surfaces** (C40): `components/chat/*`, `tournament-growth`, `FlipPill`, `InstallAppPrompt`, `TeamAvatar` render in both public and operator shells. Either a third `shared` scope with its own baseline, or double-list under both. Needs a call before extending.

---

## Tranche 4 — Judgment consolidations (each item is its own mini-decision; sized S/M/L)

**Date/time correctness (the J6-056 bug class on new surfaces) — highest-value judgment group:**
- Swap raw-UTC `today` defaults to `tournamentToday()` in phase/lifecycle logic: `lib/{tournament-phase,coach-tournament-phase,coach-tournament-lifecycle,coach-status-model,registration-attention,basic-coach-teams}.ts` + 4 `lib/db.ts` sites (B18, S).
- Same for coach/admin schedule UI surfaces (~15 files, B16, S) and accounting overdue comparisons (~11 sites, B19, S) + the 4 local `isOverdue()` copies (B15) + dashboard `computeDaysUntil` (B21).
- Add shared display-date formatters to `lib/utils.ts` and migrate ~20 local `fmtDate` + ~20 'Jul 16' reimplementations (B10/B12, M); delete 3 local `formatTime` copies (B20, S). Export-stamp sites are cosmetic only (B23 — optional).

**Route boilerplate → lib (mechanical but wide):**
- Hoist the byte-identical `resolveCoachContext()` from 46 coaches routes into lib (B01, M, ~900 LOC).
- Hoist the 4-line capability+entitlement `gate()` from 66 admin routes into `lib/api-auth.ts` (B02, M).
- Shared CSV/XLSX export builder for the 5 export routes (B03, S); dedupe the 3 route-local `getAuthenticatedUser()` copies + `platform-auth.ts` (B04, S); sweep-route actor/body parsing (B05, S).
- Replace 7 inline service-role `createClient()` sites with the `supabaseAdmin` singleton (B13/B14, S — check setup-tournament's cleanup-path client intent first; restores the env-guard those sites skip).

**UI primitives:**
- Shared overlay/backdrop utility for the 36 hand-copied fixed-inset rules (B22, M).
- Hoist `@keyframes spin` + spinner class to globals (10 files, preserve per-file modifiers like change-requests' lime override; B25, S).
- Shared platform-admin `.badge` base for the ≥4 byte-identical copies (B27, S).
- Migrate hand-rolled dialogs onto `BottomSheet` starting with ones missing Escape/scroll-lock (B28, L, multi-session).
- Rebuild 3 HealthPanels on `CollapsibleCard` (B11, S). ExportMenu-vs-ToolbarMenu composition (B24) and a real toast primitive vs `useCopyFeedback()` hook (B31) are owner/design calls.
- `apiFetch`/`useApiRequest` client wrapper (B09, L — largest duplication cluster, ~150 files; migrate incrementally).

**Token drift (visual pass required):**
- Swap 33 hardcoded `rgba(30,58,138)` → `var(--platform-primary-rgb)` (C29) and 11 `rgba(217,249,157)` → `var(--logic-lime-rgb)` (C31).
- **Stale lime:** 20 sites × 8 files still use pre-refresh `rgba(163,230,53)` → current token; changes rendered hue on tryout/registration/auth surfaces — eyeball pass before mass swap (C30).
- `--on-lime` drift: normalize the 3 admitted-drift literals + 2 correct-but-hardcoded sites (C33).
- **Warm-gate alias freeze:** redeclare `--primary`/`--primary-rgb` inside the coach warm gate (root-cause fix; two class-level patches already admit it — C34) + add `--blueprint-blue-rgb` to the auth warm block (latent, C35). Status-color tuple sweep (114+ sites) is its own future tranche (C45).

**A-workstream judgment removals:**
- `lib/team-org-billing.ts`: delete the 5 retired exports + the 2 broken UAT specs for the same retired flow (A17).
- `app/api/platform-admin/plan-config/route.ts` (A18 — zero callers, but it mutates plan config → `/billing` sign-off per pricing-facts rule).
- `lib/season-compare.ts` + its unit test (A21 — feature deliberately reversed by documented decision).
- `/my/*` correction (A34): `app/my/page.tsx`, `my/join`, `my/registrations{,/[teamId]}` are UNREACHABLE (proxy.ts redirects before render) → genuine delete candidates after re-verifying the proxy matcher; the other stubs (`/home`, `select-org`, `/team/*`, `platform-admin/plans`) are intentional permanent aliases — keep.
- Defensive never-called helpers `ensureCoachMembership`/`countOpenReportsForRoom` (A22) and `useAdminDensity()` (A24): keep-or-delete taste call; document if kept.
- `lib/coach-warm-preview.ts` rename/inline (A23 — 2 consumers spread a static attr; suggest inlining into `CoachPortalShell` or renaming to `coach-warm-marker.ts`).
- 107 needlessly-exported lib symbols (A25): batch de-export opportunistically when touching each file, not as a dedicated sweep.
- `backfill-invited-email.mjs` (recovered R0 — job done on both envs; delete; mig-128 SQL comment reference is historical, fine).
- Brand recovery bundle (E19/F06): either keep `outline-svg-text.js` + delete only the byte-identical `logo-B-outlined.svg` preview, or retire script + svg + `opentype.js` devDep + update `memory/brand_assets.md` regeneration section together. Owner taste; zero runtime impact either way.
- `.env.example` creation covering all 56 process.env keys (E14) + document `mirror-tournament.mjs` in ops docs (E13); retire `mirror-battle-of-the-bats.mjs` only (superseded by mirror-tournament; rest of BOTB cluster stays — E17/R5).

**Owner-decision (non-DB) leftovers:** `app/platform/*` pre-rename SEO pages — add `/platform/*→/for-*` redirects in next.config, then delete the 4 pages + the vestigial Navbar `/platform` prefix check (A35). `PushPermissionPrompt` (A26) — dead on dev; stale-master caveat resolved (gutting commit shipped 2026-07-22) → re-verify against origin/master, then likely reclassify safe-mechanical. `LegacyInstallBanner` (A30) — live and NOT a duplicate; owner decides when the legacy-PWA nudge window closes. Keep as-is: fan-push 410 shims (A27), manifest 308 shims (A28), `/dev/email-preview` (A29), `isPlanCheckoutPriceConfigured` (A31 — earmarked for H8 Phase 3), `TOURNAMENT_SPORT_OPTIONS` (A32 — paused Phase 2).

---

## Tranche 5 — Database (LAST, separately gated; every drop = owner decision + `/db` routing)

Migration mechanics: one migration file per sub-tranche, applied to dev AND prod via `apply-migration-api.mjs`, `DATA_DICTIONARY.md` + `refresh:snapshots` in the same unit of work.

### 5a. Correctness/integrity fixes (not drops; do before drops)
- **Prod `games` FKs** (D18): drop the duplicate FK pair members on `home_team_id` (both CASCADE — plain duplicate) and `diamond_id`; **add the missing `division_id` FK on prod** (deleting a division on prod currently orphans games). Survivor naming: keep dev's `*_fkey` names per mig-093 precedent (D23 verifier). Same pass: drop prod `teams` duplicate `fk_teams_age_group`.
- **Dev missing CHECK** (recovered R1): add `tournaments_status_check` to DEV for parity with prod (code writes only the 4 allowed values; zero breakage risk).
- **Broken delete guard** (D08): `rep_player_dues_schedules.budget_line_id` is always NULL, so the budget-line delete guard never fires. Owner picks: (a) write `budget_line_id` at insert so the guard works, or (b) drop the column and re-guard via `program_year_id + source='budget_generated'` (precedent exists in generate-installments route).
- **Index/query mismatch** (D13): `organization_members_invited_email_idx` requires `lower(invited_email)`, queries use plain equality → either fix the two queries in `lib/invite-reconciliation.ts` to match the index (original design intent) or drop it. Same pattern on `assistant_invite_tokens_email_idx` (mig 174) — include in the decision. Invite-security-adjacent: route through `/db`.
- **Tooling fix** (D10): extend `refresh-db-snapshots.mjs` to snapshot `pg_policies` content so policy drift is never invisible again.

### 5b. Dead column drops (all zero-reference dev+prod, verified live both envs)
`platform_catalog_change_requests.target_version_id` (+FK, D02) · `platform_plan_versions.snapshot` (D03) · `pools.settings` (D04 — update the two mirror scripts' JSONB_COLS + the seed script in the same unit) · `early_access_leads.metadata` (D05) · `early_access_leads.status` (D06 — also strip the two `status:'new'` insert literals; index cascades) · `venue_facilities.settings` (D21 — update mirror scripts) · `tournament_roster_players.updated_at` (D22 — **defer**: a real UPDATE path exists since J8-010; first fix the stale DATA_DICTIONARY claim, then either wire `updated_at` into that UPDATE or drop).

### 5c. Index drops
- **Clean exact duplicates** (recovered R2/R6, verified both envs, constraint-backing checked): `rep_team_lineups_event_idx` (duplicate of UNIQUE `rep_team_lineups_event_id_key`) and `idx_platform_metric_snapshots_date` (duplicate of UNIQUE `..._snapshot_date_key`).
- **Zero-use speculative indexes** (idx_scan=0 both envs, no code can ever hit them): `idx_games_generator_locked` (D11), `idx_platform_audit_actor` (D12 — or push actor filtering into the query and keep), `idx_platform_admin_visits_path_time` (D14), `idx_platform_plan_versions_status_time` (D15), `idx_platform_addon_catalog_status_label` (D16), both `platform_catalog_change_applications` indexes (D25 — note request_time sits on a RESTRICT-FK column; standard practice says keep FK-column indexes, table has 18 rows, owner call).
- **Prefix-redundant trio** (D17: `rep_team_tags_team_idx`, `rep_team_lineup_templates_team_idx`, `rep_team_tags_org_shared_idx`): technically covered by sibling UNIQUE indexes, BUT the D26 refutation showed dev's planner actively picks these narrow indexes (585/62 scans vs 0 on the covering ones) — `/db` evaluates before dropping; do NOT batch-drop.
- **REFUTED — do not act** (D26): the "13 redundant indexes, idx_scan=0 on prod" batch. Prod tables are empty (0 rows) so zero scans prove nothing; several of these are actively used on dev.

### 5d. Table drop
- `league_notification_log` (D20/D24 merged): empty both envs, zero code refs both trees, real successor `league_email_log` is live. Migration must also drop its bespoke SELECT policy explicitly.

### 5e. Owner product decisions (no default action)
- `org_overrides.suppress_billing` (D07): written, never read — wire into the Stripe pause-collection path it was built for (deliberate A2 deferral), or drop column + write sites.
- Five dormant platform-admin tables (D09: `platform_user_notes`, `platform_bulk_operations`, `platform_metric_snapshots`, `platform_catalog_campaigns`, `platform_plan_versions`): built-ahead features with live shipped UI, 0 rows. Single batch decision: launch or formally retire. Dictionary frames them keep-dormant-by-design — recommend keep, revisit at next audit.

---

## Suggested execution order

1. **Tranche 0** now (security posture; smallest diffs, biggest risk reduction).
2. **Tranche 2** next (pure docs/memory; unblocks every other chat's situational awareness — several near-misses in this audit came from stale trackers).
3. **Tranche 1** (one execution chat, grouped commits per sub-section, owner OK per commit).
4. **Tranche 3** (ratchet extension + re-freeze; pairs naturally with the end of Tranche 1's CSS deletions).
5. **Tranche 4** as appetite allows — date/time correctness group first (real user-facing correctness), then boilerplate hoists.
6. **Tranche 5** last, sub-tranche by sub-tranche, `/db`-routed, 5a before any drop.

## Estimated payoff
~3,000 LOC deleted in Tranche 1 alone (plus ~900 LOC of copy-pasted route boilerplate collapsible in Tranche 4); 6 fewer npm/env surprises; every CSS surface under ratchet guard; 8+ dead DB objects and one security-critical policy set removed; tracking docs/memory brought back to truth (a dozen ⚠ markers resolved).
