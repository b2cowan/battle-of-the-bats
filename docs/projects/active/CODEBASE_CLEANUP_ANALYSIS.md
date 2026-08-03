# Codebase Cleanup — Verified Findings Analysis

> Status: **INVESTIGATION COMPLETE 2026-07-24 — no code changed, nothing executed.** Companion docs: `CODEBASE_CLEANUP_PLAN.md` (risk-classified tranche plan referencing the finding IDs below) and `CODEBASE_CLEANUP_PM_BRIEF.md`.
> Method: multi-agent audit per `CODEBASE_CLEANUP_INVESTIGATION_PROMPT.md` — 14 parallel inventory finders (workstreams A–G), then an independent adversarial verifier per removal candidate (traps list: dynamic imports, Next convention files, server actions, sw.js, cron, email deep-links, platform-admin, seed scripts, UAT specs, DB triggers/policies, prod-only references, recent concurrent activity), then a completeness critic. 153 workflow agents + 7 recovery verifiers; ~11.3M tokens; DB checks ran live against BOTH dev and prod (read-only) plus the fresh mig-198 snapshots.

## Result totals

| | Total | CONFIRMED | DOWNGRADED | REFUTED |
|---|---|---|---|---|
| A — dead routes/components/exports | 35 | 32 | 3 | 0 |
| B — duplicate / near-duplicate code | 31 | 24 | 7 | 0 |
| C — CSS + design-token debt | 47 | 40 | 7 | 0 |
| D — database schema | 26 | 17 | 8 | 1 |
| E — deps, flags, config, scripts | 20 | 16 | 2 | 2 |
| F — assets + PWA | 7 | 6 | 1 | 0 |
| G — docs + task hygiene | 35 | 33 | 1 | 1 |
| Recovered (verify-agent failures, re-verified) | 7 | 5 | 1 | 1 |
| **Total** | **208** | **173** | **30** | **5** |

Confirmed removal candidates: ~78 items, ≈4,400 LOC of dead code/CSS plus 8+ dead DB objects. DOWNGRADED = the cleanup is real but smaller/differently-shaped than first claimed (the verifier's correction is recorded per finding). REFUTED = do NOT act; kept in the inventory so the next sweep doesn't re-flag them.

## Headline findings (read these even if you read nothing else)

1. **D01 — PROD-only wide-open anon RLS policies.** Prod (and only prod) carries permissive `anon / ALL / USING(true)` policies ("Allow public full access to …") on `announcements, diamonds, divisions, games, teams, tournaments` (+2 on `pools`). The public anon key can write/delete these tables via raw REST. Dev proves the scoped policies are sufficient. Invisible to the existing drift report (it diffs only the RLS on/off bit — D10). → Tranche 0.
2. **E18 — live dev DB password committed in plaintext** in `scripts/run-migration.mjs` + `scripts/verify-migration.mjs`, present in git history on dev and master. Deleting files is not enough; rotate the password. → Tranche 0.
3. **G33 — local `master` is ~100 commits behind `origin/master`.** Any agent (including parts of this audit) treating local master as "prod truth" over-reports pending/dead state. Findings here that cite master were spot-corrected via origin/master where it mattered (G01, G28, A26); execution tranches must `git fetch` and check `origin/master`.
4. **G01 — every "mig NNN prod-pending" ⚠ memory marker through mig 198 is resolved.** The 2026-07-22/23 promotes shipped everything; a dozen memory/TODO trackers still say otherwise and misinform every new chat. → Tranche 2.
5. **D08 — a real correctness bug wearing dead-column clothing:** `rep_player_dues_schedules.budget_line_id` is never written, so the budget-line delete guard silently never fires.
6. **D18 — prod `games` has duplicate FKs and NO FK on `division_id`** (deleting a division on prod orphans games); prod `teams` carries an exact-duplicate FK (D23).
7. **B15–B21 — the J6-056 timezone bug class is back** on newer surfaces: raw-UTC "today" in tournament phase/lifecycle logic, coach schedule UIs, and accounting overdue math (~40 sites bypassing `lib/timezone.ts`).
8. **C34 — the warm-gate alias-freeze bug pattern has one more live instance** (`--primary`/`--primary-rgb` not remapped under the coach warm gate; already patched twice at class level, root cause open).

## Cross-cutting caveats

- **Concurrent sessions**: this tree is shared; several verified files carry uncommitted edits from other chats. Every deletion needs a fresh reference-grep at execution time (binding rule in the plan doc).
- **Duplicate entries**: dedup was location-keyed, so a few findings describe the same object from different angles (A04≈A07 PlansClient; D02/D03/D19 columns; D20≈D24 league_notification_log; C22≈C42 warm rgb twins; D17 overlaps D26 and R2/R6). The plan doc merges them into single tranche items.
- **est_loc** figures are finder estimates, some corrected by verifiers (noted inline); treat as order-of-magnitude.

## Recovered findings (R0–R6)

Seven findings were dropped by verify-agent crashes in the workflow and were re-verified afterward by dedicated adversarial agents:

### R0. scripts/backfill-invited-email.mjs — completed one-time backfill (mig 128)
- **Verdict:** CONFIRMED | **Risk:** judgment | **Removal:** yes
- **Verification:** Only refs = script itself + a historical comment in mig 128 SQL; no package.json wiring; single commit, already on master. Live queries: prod has the mig-128 column AND 0 `status='invited'` rows with null `invited_email` (job done). Dev's 1 null row traces to a UAT spec inserting directly (test debris); the live invite route always writes `invited_email`.

### R1. DEV tournaments table missing the tournaments_status_check CHECK that PROD enforces
- **Verdict:** CONFIRMED | **Risk:** judgment | **Removal:** no — this is drift to FIX on dev, not something to drop
- **Verification:** Live pg_constraint: prod has `CHECK (status IN draft/active/completed/archived)`; dev has no status CHECK. DRIFT report line ~100 independently confirms. All code writers only ever write the 4 allowed values (lib/types.ts TournamentStatus) — adding the CHECK to dev is zero-breakage parity.

### R2 + R6. Exact-duplicate index pairs on platform_metric_snapshots and rep_team_lineups
- **Verdict:** CONFIRMED (technical claim) / DOWNGRADED to owner-decision per DB-drop rule | **Removal:** yes (the plain twins)
- **Verification:** Live pg_indexes dev+prod: `idx_platform_metric_snapshots_date` duplicates UNIQUE `platform_metric_snapshots_snapshot_date_key`; `rep_team_lineups_event_idx` duplicates UNIQUE `rep_team_lineups_event_id_key` — same single column, no predicates, non-unique twins back no constraint (pg_constraint/pg_depend checked). Dropping the plain twin preserves lookup coverage via the UNIQUE sibling.

### R3. Small standalone dead lib exports (grouped, 7 exports)
- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Removal:** yes
- **Verification:** Each export (incl. `lib/assistant-invites.ts:128 listOpenAssistantInvitesForTeam`, `ALL_EVENT_TYPES`) is declaration-only — no importers, no internal use, no dynamic access, in dev AND origin/master (ALL_EVENT_TYPES' one master consumer was the org-notifications page dev already gutted to a redirect; shipped since). Parent modules stay live for other exports.

### R4. ~33 dead selectors in schedule-admin.module.css (diamond/priority pickers, mobile score-input)
- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Removal:** yes
- **Verification:** All 7 importers checked; zero dynamic `styles[...]` access and zero `composes:` anywhere; all 14 named + ~16 sampled additional classes zero-ref (several live inside indented @media blocks a naive grep would miss). Near-miss collision correctly avoided (`.scoreTeamName` dead vs `.scoringTeamName` live — strip carefully).

### R5. scripts/seed-botb-extra-divisions.mjs (Battle-of-the-Bats cluster)
- **Verdict:** REFUTED — do not delete | **Risk:** owner-decision
- **Verification:** The cluster is interdependent, idempotent, re-run QA tooling: extra-divisions errors "Run mirror-battle-of-the-bats.mjs first"; reset-botb-champions-moment documents a repeat re-arm cycle; design_decisions.md shows owner test sessions against this fixture across weeks; the BOTB tournament id was queried in agent work as recently as 2026-07-24. Whole cluster stays until the owner declares the BOTB QA cycle finished.

---

# Full verified inventory by workstream

Entries are sorted CONFIRMED → DOWNGRADED → REFUTED, then safe-mechanical → judgment → owner-decision. Each carries the finder's evidence, the independent verification, and the verifier's corrections. REFUTED entries are the do-not-remove list.

## Workstream A — Dead routes, pages, components, exports

### A01. lib/db.ts: ~49 exported CRUD helpers with zero callers — legacy surface predating direct-Supabase routes

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-export | **Removal:** yes | **~LOC/objects:** 750
- **Where:** lib/db.ts:151 updateTournament; lib/db.ts:173 deleteTournament; lib/db.ts:177 setActiveTournament; lib/db.ts:990 saveVenue; lib/db.ts:1287 getPools; lib/db.ts:2632 updateTournamentSettings; lib/db.ts:3120 createLeagueSeason; lib/db.ts:3940 deleteRepTeam
- **Evidence (finder):** Automated scan (extract every export function/const/class in lib/db.ts, grep each name repo-wide excluding own file) found 49 exports with zero external refs, spanning tournament/venue/pool/division/announcement/rep-team/org CRUD: updateTournament, deleteTournament, setActiveTournament, venue+facility CRUD, org-venue CRUD, pool/division CRUD, saveTeam/updateTeam, deleteGame, announcement CRUD, seedTournamentData, seedRulesAndResources, getOrganizationByUserId, updateOrgSubscription, updateTournamentSettings, createLeagueSeason, createDivision, enterGameResult, rep-team CRUD. Corroborated by DATA_DICTIONARY.md:1715: 'deleteRepTeam does a hard DELETE but is wired to no HTTP route.'
- **Verification:** Extracted all 335 lib/db.ts exports; git grep --word-regexp <name> repo-wide (excl. lib/db.ts+docs/**). All 8 cited names: ZERO code hits, only in archived docs historically. No namespace-import usage, no re-exports, no typeof derivation; each appears once in lib/db.ts (own def), zero internal calls. Same grep on master: zero hits. app/api/admin/tournaments/route.ts does tournament CRUD via direct supabase - live, reimplemented outside lib/db.ts. Checked scripts/*, sw.js, cron/*, uat/*, platform-admin/* - no hits. Recent commits touched other exports, never these 8; no uncommitted db.ts changes. Full scan found 59 zero-ref exports (superset incl. the 8), near claimed 49.
- **Verifier notes:** 8 sampled locations fully verified as proof of pattern. Independent scan found 59 zero-ref exports vs claimed 49 - reconcile against finder's exact list before mass deletion. No DB/migration involved. lib/db.ts is actively growing (concurrent commits) - land as isolated diff, rebase first.

### A02. StripePricesClient.tsx + CSS module orphaned after stripe-prices page became a redirect stub

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-component | **Removal:** yes | **~LOC/objects:** 428
- **Where:** app/platform-admin/stripe-prices/StripePricesClient.tsx; app/platform-admin/stripe-prices/stripe-prices.module.css
- **Evidence (finder):** app/platform-admin/stripe-prices/page.tsx no longer renders StripePricesClient — it only does redirect('/platform-admin/plans-pricing'). Repo-wide grep for 'StripePricesClient' shows the only occurrence is the component's own export in the same file; nothing imports/renders it. 194 lines + 234-line CSS module, dead code left behind by the plans-pricing merge.
- **Verification:** page.tsx: only redirect(), no import. Grep "StripePricesClient" repo-wide: only self-export + 2 doc mentions (archived plan, DATA_DICTIONARY) - no live import. Grep "stripe-prices.module": only self-import. Read PlansPricingClient.tsx (successor, 2773 lines): independent PRICE_PLAN_LABELS/ORDER + own API calls, no import of old client/CSS - full reimplementation. git grep on master: identical dead state already on prod. help-content references route (redirect still works), not component. CSS last touch = 93-file mechanical token sweep, 4 lines. No tests/uat/dynamic-import/flag hits. All 12 traps checked, none apply.
- **Verifier notes:** Follow-up for owner: app/api/platform-admin/stripe-prices/route.ts appears consumed only by this dead client - PlansPricingClient uses different endpoints. Worth checking separately; not verified dead here.

### A03. PublicBracketView.tsx — zero importers on both dev and master

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-component | **Removal:** yes | **~LOC/objects:** 300
- **Where:** components/public/PublicBracketView.tsx
- **Evidence (finder):** grep -rn PublicBracketView app components lib tests (dev) and git grep PublicBracketView master both return only the file's own `export default function PublicBracketView` line — no consumer on either branch. Live public bracket rendering for playoff games instead happens inline in components/public/ScheduleContent.tsx (imports the same lib/playoff-bracket.ts bracketRoundInfo/computeBracketColumns helpers), which IS mounted at app/[orgSlug]/[tournamentSlug]/schedule/page.tsx.
- **Verification:** grep -rn PublicBracketView (dev+master via git grep): only hit outside docs/ is the file own export line. StandingsContent.tsx now imports TieredBracket (feed-graph engine), not PublicBracketView/LogicSyncBracket - codebase moved on twice since orphaning. TieredBracket has no ref to it. tests/ (incl uat/): no matches. No barrel in components/public/. Case-insensitive/dynamic-import search: only self-decl + unrelated PlayoffBracketView (distinct fn, admin page). git log -5: last touch was cosmetic polish to dead code (07-14). PLAYOFF_ONLY_TOURNAMENT_PLAN.md:155: unused, left in place, safe to delete later (06-05); BRACKET_GRAPH_LAYOUT_PLAN.md:94: dead, no imports, skipped.
- **Verifier notes:** Team itself flagged this dead-and-safe-to-delete over a month ago (2026-06-05) and never removed it. Nothing imports it on either branch; safe to delete outright, no other file changes needed.

### A04. PlansClient.tsx + CSS module orphaned after platform-admin/plans page became a redirect stub

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-component | **Removal:** yes | **~LOC/objects:** 134
- **Where:** app/platform-admin/plans/PlansClient.tsx; app/platform-admin/plans/plans.module.css
- **Evidence (finder):** app/platform-admin/plans/page.tsx is now just redirect('/platform-admin/plans-pricing'). Repo-wide grep for 'PlansClient' (word boundary) shows only the component's own definition in the same directory, no importer. Same dead-code-left-behind pattern as StripePricesClient in the sibling finding.
- **Verification:** page.tsx = unconditional redirect(), no props to client. PlansClient.tsx self-documents "kept for reference only"/"Dead code". Repo-wide grep "PlansClient" (all files, excl node_modules/.git): only its own export + 2 archived-doc mentions, zero importers. grep "plans.module.css": only its own self-import. master (prod) has identical redirect stub + same orphaned files - not dev-only. git log: redirect stable since 2026-05-20; last CSS touch 2026-07-21 was a repo-wide token-literal sweep, not liveness. CLUB_REPACKAGING_PLAN.md (archived) lists this as unchecked cleanup TODO; STAGE_A_ROLE_AREA_MATRIX.md calls route a "tombstone". No dynamic import/RBAC/help/cron/UAT/sw.js refs.
- **Verifier notes:** Mirrors sibling StripePricesClient finding; stripe-prices/page.tsx is also a bare redirect stub, worth confirming coverage. Pure LOC reduction, matches an already-logged but never-executed cleanup TODO.

### A05. Duplicate tournament-import history route superseded by unified imports/history endpoint

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-api-route | **Removal:** yes | **~LOC/objects:** 95
- **Where:** app/api/admin/tournaments/[tournamentId]/registrations/import/history/route.ts; app/api/admin/tournaments/[tournamentId]/imports/history/route.ts (the endpoint actually used); app/[orgSlug]/admin/tournaments/data-tools/page.tsx:112; components/admin/import/TournamentTeamsImportDialog.tsx:22,54,73
- **Evidence (finder):** Both routes were added in the SAME commit (21620723). data-tools/page.tsx only builds `/imports/history` (line 112, filters both TOURNAMENT_SCHEDULE_IMPORT_TYPE + TOURNAMENT_TEAM_IMPORT_TYPE); TournamentTeamsImportDialog.tsx only calls .../registrations/import/{template,preview,commit}, never /history. Zero references to 'registrations/import/history' anywhere outside its own route.ts, in dev or on master (git grep confirmed on both). Same absence confirmed on master branch.
- **Verification:** Read both route.ts in full. Grep 'registrations/import/history' repo-wide (dev): only self-ref (route label string), zero callers. Grep 'imports/history': wired in data-tools/page.tsx:112 + 2 UAT specs. TournamentTeamsImportDialog.tsx calls only template/preview/commit, never history. git grep on master: same pattern - old path only self-refs, unified path is the one wired to UI/tests, so prod agrees it's dead. git log on file: only 2 commits ever, none recent/concurrent. Checked cron/*, platform-admin/*, lib/email*, sw.js: zero hits for old path.
- **Verifier notes:** Straightforward deletion of registrations/import/history/route.ts only; leave sibling template/preview/commit/shared.ts alone, they remain live.

### A06. Budget-plan-line allocation-preview GET route never called by the allocate UI

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-api-route | **Removal:** yes | **~LOC/objects:** 92
- **Where:** app/api/admin/accounting/budget-plan/lines/[lineId]/allocation-preview/route.ts; app/[orgSlug]/admin/accounting/budget/allocate/[lineId]/page.tsx
- **Evidence (finder):** grep for 'allocation-preview' across app/components/lib/scripts/tests finds only the route file's own definition/self-reference line and two archived plan docs. grep for 'preview' inside allocate/[lineId]/page.tsx (the only page for this feature) returns zero matches — the page calls only .../allocate-to-teams and .../periods, never this read-only preview endpoint. Confirmed same on master branch (git grep empty for callers).
- **Verification:** Read both files fully: page.tsx computes splits client-side and posts only to allocate-to-teams, never fetches allocation-preview. grep -rn "allocation-preview" repo-wide: only the route's own comment/tag lines, Next's auto-generated .next/dev/types files (existence-only), and 2 archived docs. grep "budget-plan/lines" across app/ enumerated every fetch site: none hit allocation-preview. git log -10 both files: last touches are unrelated mechanical edits (orgSlug threading, coach-upsell sweep). git grep master: identical empty-of-callers result. tests/uat grep: zero real matches.
- **Verifier notes:** Zero-reference in dev and master. Safe to delete route.ts (92 LOC); read-only endpoint, no schema/DB implications.

### A07. app/platform-admin/plans/PlansClient.tsx is dead — the page unconditionally redirects and never renders it

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-component | **Removal:** yes | **~LOC/objects:** 90
- **Where:** app/platform-admin/plans/page.tsx; app/platform-admin/plans/PlansClient.tsx; app/platform-admin/plans/plans.module.css
- **Evidence (finder):** app/platform-admin/plans/page.tsx body is only `redirect('/platform-admin/plans-pricing')` with comment '// Moved to Plans & Pricing'. PlansClient.tsx itself has a self-documented comment: '// This file is kept for reference only -- the page now redirects to /platform-admin/plans-pricing' and '// Dead code (page redirects to /platform-admin/plans-pricing)'. Grep confirms PlansClient is imported nowhere else in the repo.
- **Verification:** page.tsx = unconditional `redirect('/platform-admin/plans-pricing')`. PlansClient.tsx self-documents as dead. Grep `PlansClient` repo-wide: only self-match + archive/CLUB_REPACKAGING_PLAN.md (lists it as a "Dead-page hygiene" backlog item). plans.module.css imported only by PlansClient. No dynamic-import string; no loading/error/parallel-route files; layout.tsx has zero `plans` reference. `git grep PlansClient master`: identical dead file already on prod. UAT spec hits `/platform-admin/plans` URL but only asserts the redirected plans-pricing page renders, not a PlansClient ref. Last edit (97da8989) was a repo-wide mechanical hex-token sweep, not a revival.
- **Verifier notes:** Matches a previously-identified, deferred cleanup item already noted in archived CLUB_REPACKAGING_PLAN.md. PlansClient.tsx + plans.module.css unambiguously removable. Check nav links before deleting page.tsx itself; could alternatively keep as a permanent redirect stub.

### A08. HudPanel.tsx + StatDisplay.tsx — Sprint-1 scaffold components never adopted by any consumer

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-component | **Removal:** yes | **~LOC/objects:** 41
- **Where:** components/ui/HudPanel.tsx; components/ui/StatDisplay.tsx
- **Evidence (finder):** grep -rn HudPanel/StatDisplay app components lib tests (dev) and git grep on master both return only each file's own interface/export lines, unchanged since original commit 08ca5cbd 'FieldLogic Sprint 1 — visual foundation + platform shell'. The Tailwind classes they wrap (bg-hud-surface, shadow-hud, hud-label, text-logic-lime, border-blueprint-blue) ARE still used platform-wide (app/error.tsx, app/not-found.tsx, app/page.tsx, components/Footer.tsx, several admin pages) but every consumer hand-rolls the div/className directly instead of using these two intended shared wrappers.
- **Verification:** Read both files fully (41 lines): pure presentational div wrappers, no side effects/'use server'/dynamic import. Grep "HudPanel|StatDisplay" across whole repo (app/components/lib/tests/docs/memory) -> only each file's own declaration lines, zero consumers. git grep same pattern on master -> identical zero-consumer result (trap #11 clean, prod never adopted either). git log -8 --oneline on both paths -> single commit 08ca5cbd (2026-05-04 Sprint-1 scaffold), no edits since (trap #12 clean); git status --porcelain clean, no local uncommitted work on these files. No docs/memory mention as planned dormant future use. No barrel/dynamic-import indirection found.
- **Verifier notes:** Confirmed as claimed, ~41 LOC, zero blast radius. Side note (unverified, out of scope): sibling components/ui/HudSkeleton.tsx shares the same unused hud-* classes and looked similarly orphaned in a quick grep - possible follow-up finding for the owning workstream.

### A09. lib/team-workspace-entitlements.ts: hasTeamFreeTournamentSlot + hasTeamScopedRepTeamEntitlement have zero callers

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-export | **Removal:** yes | **~LOC/objects:** 25
- **Where:** lib/team-workspace-entitlements.ts:143; lib/team-workspace-entitlements.ts:240
- **Evidence (finder):** Repo-wide grep for hasTeamFreeTournamentSlot and hasTeamScopedRepTeamEntitlement each returns only their own declaration line in lib/team-workspace-entitlements.ts.
- **Verification:** Grep both names repo-wide: only decl lines :143,:240, no callers. git grep on master: same, not prod-only. Checked scripts/, tests/uat/, fragment matches for dynamic access: none. Read file: no internal caller either. git log -5 on file: last touch 2026-06-23, not concurrent activity. git log --all -S<name>: exactly ONE commit ever (e4987102, bulk checkpoint 2026-05-23) touches each string — no caller ever added+removed; dead on arrival. Archived STANDALONE_TEAM plan doc documents this file's helpers but never mentions either function. Not a Next.js convention file/action/cron/email/sw.js/platform-admin entry; no DB trigger tie.
- **Verifier notes:** Safe to delete just these two exports (lines 143-145, 240-242). Other exports in this file are heavily used elsewhere - leave the rest of the file alone.

### A10. lib/coach-guidance.ts: getCoachGuidanceStage + getCoachShortcuts dead — only getCoachGuidance is consumed

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-export | **Removal:** yes | **~LOC/objects:** 20
- **Where:** lib/coach-guidance.ts:27; lib/coach-guidance.ts:89; app/[orgSlug]/coaches/teams/[teamId]/page.tsx:16
- **Evidence (finder):** Module docstring describes a 3-part system: stage-aware card + nudge + "how do I" shortcuts. The one real consumer, app/[orgSlug]/coaches/teams/[teamId]/page.tsx:16, does `import { getCoachGuidance } from '@/lib/coach-guidance'` only — never imports getCoachGuidanceStage or getCoachShortcuts. Repo-wide grep for either name finds only their own declarations.
- **Verification:** Read coach-guidance.ts fully. Sole consumer page.tsx imports only getCoachGuidance, called with HARDCODED `getCoachGuidance('roster', {...})` (L550) - stage output never used. No GuidanceRail/Shortcut render there (grep confirms). Repo grep for both symbols hits only own decls + design_decisions.md, documenting deliberate settled history (2026-06-27): "getCoachGuidanceStage no longer called (roster is sole gate)"; walkthrough plan #17 "dropped the admin rail" (used getCoachShortcuts). git log 1 commit, status clean. git show master:lib/coach-guidance.ts errors "not in master" - dev-only module. No hits in scripts/, uat, cron, email, platform-admin.
- **Verifier notes:** Also drop orphaned CoachGuidanceStage type (only used by getCoachGuidanceStage). Update file docstring, which still describes a 3-part system; only hardcoded 'roster' card+nudge remain post-removal.

### A11. NEXT_PUBLIC_COACH_WARM_PREVIEW: retired in code, still set in .env.local, stale CSS comment

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-flag | **Removal:** yes | **~LOC/objects:** 12
- **Where:** .env.local:61; lib/coach-warm-preview.ts:8-11; app/globals.css:421-431
- **Evidence (finder):** Repo-wide grep for COACH_WARM_PREVIEW finds it only inside comments (lib/coach-warm-preview.ts, app/globals.css) — zero live `process.env.NEXT_PUBLIC_COACH_WARM_PREVIEW` reads anywhere. .env.local:61 still sets `NEXT_PUBLIC_COACH_WARM_PREVIEW=1`. globals.css:421-431 comment still says the marker emits '...only when NEXT_PUBLIC_COACH_WARM_PREVIEW === 1' and calls the flag 'mandatory until Stage 6' even though coach-warm-preview.ts's own docstring says that gate 'is retired now' and the marker is unconditional.
- **Verification:** git grep COACH_WARM_PREVIEW (dev HEAD): only comments/docs, zero process.env reads. lib/coach-warm-preview.ts: coachWarmAttr emitted unconditionally; its 2 consumers (coaches/layout.tsx:103, CoachPortalShell.tsx:153/280) same. git log: c23feb82 (2026-07-22) already retired the gate, is ancestor of HEAD. git grep on master: zero hits. Checked scripts/, amplify.yml, tests/uat: no refs. git check-ignore -v .env.local: gitignored/untracked, stale line has zero consumer. globals.css:421-431 comment claims marker still requires the env var; actual selector (line 440) has no such dependency - prose stale, code fine.
- **Verifier notes:** Three sub-locations, different fixes: .env.local:61 untracked/local, just delete the line; lib/coach-warm-preview.ts:8-11 is ALREADY-CORRECT retirement narration, should NOT be touched (finder mis-included it); globals.css:421-431 is the one genuinely stale comment needing a rewrite - comment-only, zero functional risk.

### A12. lib/email.ts: passwordResetHtml() dead duplicate — actually-wired template is platformPasswordResetHtml()

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** duplicate | **Removal:** yes | **~LOC/objects:** 10
- **Where:** lib/email.ts:976; lib/email.ts:986; app/api/auth/forgot-password/route.ts:3; app/api/auth/forgot-password/route.ts:46
- **Evidence (finder):** lib/email.ts defines two near-identical templates: passwordResetHtml() (line 976) and platformPasswordResetHtml() (line 986). app/api/auth/forgot-password/route.ts imports and calls only platformPasswordResetHtml (`defaultHtml: platformPasswordResetHtml(confirmUrl)`). Repo-wide grep for passwordResetHtml (without the platform- prefix) finds only its own declaration.
- **Verification:** Read email.ts:940-1019: two near-dupe templates. Grep "passwordResetHtml" case-sensitive: only its own decl (line 976). Case-insensitive adds platformPasswordResetHtml decl + its 2 real callers in forgot-password/route.ts (import + defaultHtml: platformPasswordResetHtml(confirmUrl)), confirmed by full read. Master: git grep passwordResetHtml master -> only decl (email.ts:902); master route.ts also calls only platformPasswordResetHtml. git log -8 on both files: no recent revival. platform-email-templates.ts has no dynamic name-lookup. tests/*, scripts/* grep: no hits.
- **Verifier notes:** Trivial isolated removal: delete passwordResetHtml (email.ts:976-984 dev; ~902 master) - zero callers dev+prod, no DB/product impact, platformPasswordResetHtml unaffected.

### A13. lib/auth.ts legacy stubs login()/logout()/isAuthenticated() have zero callers

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-export | **Removal:** yes | **~LOC/objects:** 8
- **Where:** lib/auth.ts:89; lib/auth.ts:92; lib/auth.ts:95
- **Evidence (finder):** Comment block: '// -- Legacy stubs -- kept so any remaining callers compile during the transition'. All three are already no-ops (`login(){return false}`, `logout(){}`, `isAuthenticated(){return false}`). Repo-wide grep for `login()`, `logout()`, `isAuthenticated()` matches only their own declarations in lib/auth.ts; every real '@/lib/auth' import site (17 files checked) pulls only signIn/signOut/getSession/getUser.
- **Verification:** Read lib/auth.ts fully: stubs at 90/93/96 (finder said 89/92/95, off-by-one, same funcs), no-ops under "Legacy stubs" comment. Grep `\blogin\(|\blogout\(|\bisAuthenticated\(` repo-wide: 12 file hits; each real hit rechecked individually (login/page.tsx, tournaments/dashboard, chat-resolvers.ts, platform-admin.spec.ts) - all false positives, zero actual calls. `git grep` on master: only the 3 declarations, same on prod tree. Grepped all 19 real lib/auth import sites - each imports only signIn/signOut/getSession/getUser. git log/blame: block added 2026-05-02, unedited since 2026-05-14, no concurrent activity. Not a convention file/'use server'/sw.js/cron/email/seed script.
- **Verifier notes:** Line numbers off by one (89/92/95 vs actual 90/93/96) due to blank line before JSDoc - trivial. Safe to delete lines 86-96 in one pass.

### A14. lib/import/index.ts is an unused barrel — every real consumer imports the submodules directly

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-export | **Removal:** yes | **~LOC/objects:** 7
- **Where:** lib/import/index.ts
- **Evidence (finder):** lib/import/index.ts re-exports from ./types, ./csv, ./xlsx, ./tournament-teams, ./tournament-teams-commit, ./tournament-schedule, ./tournament-schedule-commit. Repo-wide grep for `from '@/lib/import'` or `from './import'`/`'../import'` (bare, no /submodule) returns zero hits. Meanwhile lib/import/csv.ts, tournament-teams.ts etc. each have 8+ real importers via direct submodule paths (e.g. '@/lib/import/csv').
- **Verification:** Read lib/import/index.ts: pure re-export barrel, no side-effecting code. `git grep -nE "from ['\"](@/lib/import|\.\./import|\./import)['\"]"` across dev tree AND master branch: zero hits both. Dynamic-import check `import\([^)]*lib/import[^)]*\)`: zero. next.config/tsconfig/package.json: no modularizeImports/optimizePackageImports referencing it. Confirmed real consumers use direct submodule paths (@/lib/import/csv, @/lib/import/tournament-teams have live importers in app/api/admin/tournaments/.../import/*). git log -8 -- lib/import/index.ts: only 2 commits, both 2026-06-02/03, not recent activity.
- **Verifier notes:** Trivial deletion, zero blast radius: no import statement anywhere references the barrel path, and the file has no executable side effects. Safe to delete lib/import/index.ts as claimed.

### A15. Help sidebar still links to /platform-admin/stripe-prices, a page that only redirects away

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene)
- **Where:** lib/help-content/platform-admin.tsx:393
- **Evidence (finder):** lib/help-content/platform-admin.tsx:393 has { label: 'Stripe Prices', href: '/platform-admin/stripe-prices' } in the platform-admin help nav links, but that route is now a bare redirect to /platform-admin/plans-pricing. Clicking the help link bounces the admin to a different page than the help topic implies. No equivalent stale help link exists for /platform-admin/plans.
- **Verification:** lib/help-content/platform-admin.tsx L392-394 confirmed: links[] has both stale '/platform-admin/stripe-prices' AND correct '/platform-admin/plans-pricing' side by side. stripe-prices/page.tsx confirmed = redirect('/platform-admin/plans-pricing').

### A16. No retired NEXT_PUBLIC_ feature flag gates any app/ page (lead investigated, came up empty)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-flag | **Removal:** no (consolidation/hygiene)
- **Where:** app/(consumer)/scores/page.tsx; app/(consumer)/discover/page.tsx; app/platform-admin/dev-tools/layout.tsx; app/platform-admin/dev-tools/page.tsx
- **Evidence (finder):** Grepped every NEXT_PUBLIC_ occurrence under app/ (35 files, mostly API routes). Only page-level flags found: NEXT_PUBLIC_APP_URL (site-URL default, not a gate) in scores/discover pages; NEXT_PUBLIC_ENABLE_DEV_TOOLS (gates app/platform-admin/dev-tools entirely) + NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE (gates one toggle within dev-tools). Both are live/documented in .env.local, DATA_DICTIONARY.md, and active platform-admin-audit docs, not retired. This lead turned up no dead flag-gated page.
- **Verification:** Re-ran grep: exactly 35 files (matches). Only extra hit excluded was app/globals.css:426, a stale COMMENT re a coach-warm flag; lib/coach-warm-preview.ts confirms that gate is retired, marker now unconditional -- not a functioning page gate, doesn't contradict claim.

### A17. lib/team-org-billing.ts: 5 of 6 exports dead — retired org-billing-takeover request/invite/checkout entry points

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** dead-export | **Removal:** yes | **~LOC/objects:** 260
- **Where:** lib/team-org-billing.ts:3-10; app/api/admin/org/team-links/route.ts:73; app/api/coaches/[orgSlug]/team-links/route.ts:122
- **Evidence (finder):** File header: 'RETIRING (Club Repackaging, 2026-06-22)... The request/invite/respond/checkout entry points are no longer wired to any route (the team-links routes return 410)... this whole module is effectively dead and safe to delete once the webhook arms are removed.' Confirmed: requestOrgTeamAddonBilling, inviteOrgTeamAddonBilling, respondToOrgTeamAddonBillingInvite, declineOrgTeamAddonBillingRequest, startOrgTeamAddonCheckout each have zero references outside their own declarations. Only completeOrgTeamAddonBillingFromMetadata is still called (by app/api/billing/webhook/route.ts).
- **Verification:** git grep for each of the 5 exports across dev tree AND master (prod): zero hits outside own declarations (only prose in docs). Both route files don't import team-org-billing; both hard-return 410 for billing-transfer actions. completeOrgTeamAddonBillingFromMetadata confirmed still imported by billing webhook in dev+master. git log: last touch 2026-06-22, no pending edits. DB via db-query.mjs --dev/--prod: org_team_addon workspace count=0 both envs. Two UAT specs reference org_team_addon but click UI buttons no longer present outside the retired routes' error strings - stale specs, not live callers.
- **Verifier notes:** 5 exports genuinely dead; surviving export correctly identified. Out of scope: team-org-billing-stripe-smoke.spec.ts and team-org-link-smoke.spec.ts are themselves broken specs for the same retired flow, should be removed alongside. CLUB_REPACKAGING_PLAN.md has one unchecked line about this cleanup.

### A18. platform-admin plan-config GET/PATCH route superseded by product-catalog change-request workflow

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** dead-api-route | **Removal:** yes | **~LOC/objects:** 123
- **Where:** app/api/platform-admin/plan-config/route.ts (GET line 28-34, PATCH line 36-123); app/platform-admin/plans-pricing/page.tsx (reads via getAllPlanConfigOverrideRows() directly, SSR, not via this API); app/platform-admin/plans-pricing/PlansPricingClient.tsx (writes via /api/platform-admin/product-catalog/change-requests + /campaigns + /feature-matrix/publish instead)
- **Evidence (finder):** repo-wide search for the literal string 'platform-admin/plan-config' finds only the route file's own two `withObservability` route-tag lines plus two doc mentions (DATA_DICTIONARY.md, archived CLUB_REPACKAGING_PLAN.md). PlansPricingClient.tsx (the only plan-config admin UI) never fetches this path — it fetches product-catalog/change-requests, /campaigns, and /feature-matrix/publish. The page itself reads override rows server-side via the lib function directly. Route exists on master too, same absence of callers there.
- **Verification:** Read route.ts fully (123 lines). Grep "platform-admin/plan-config" repo-wide (dev) = only route's own 2 route-tag strings + 2 doc mentions (DATA_DICTIONARY, archived CLUB_REPACKAGING_PLAN). git grep master = identical 4 hits, no caller on prod tree. Confirmed supersession: change-requests/route.ts:545 calls the same upsertPlanConfigOverride() directly, inlining apply+audit logic. PlansPricingClient never fetches this path (posts change-request drafts instead); page.tsx reads override rows via lib fn directly. No dynamic fetch string, no cron/SW/UAT/script reference (one tests/uat hit is unrelated prose). git log last touch 44883f25 (older release, not concurrent). No orphaned DB dependency.
- **Verifier notes:** Confirmed dead across dev+master, fully superseded by change-requests/route.ts inlining the same upsertPlanConfigOverride call. Downgraded to judgment (not safe-mechanical) only because it mutates plan_config_overrides/pricing data; CLAUDE.md flags plan/pricing changes for reconciliation with PLAN_PRICING_FACTS.md, so owner/billing sign-off before deletion is warranted despite zero runtime risk.

### A19. platform-admin insights-digest route has zero internal callers — externally invoked by pg_cron

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** dead-api-route | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 66
- **Where:** app/api/platform-admin/insights-digest/route.ts; supabase/migrations/183_scheduled_http_ticks.sql; docs/agents/db/DATA_DICTIONARY.md:5778
- **Evidence (finder):** Repo-wide grep for 'insights-digest' finds only the route's own definitions and archived plan/dictionary docs — no fetch()/import caller in app|components|lib. Uses isCronRequest/x-cron-secret gating (lib/cron-auth.ts). DATA_DICTIONARY.md documents mig 183 pg_cron jobs 'insights-digest-weekly' (Sun 23:00 UTC) and 'insights-digest-catchup' (Mon 13:00 UTC) that call this route via app_cron_http_tick — classify as externally-invoked, not dead; verifier should confirm mig 183's cron jobs are actually present/active in the live dev+prod Supabase instances.
- **Verification:** Route confirmed; grep shows zero internal callers. Live DB query on BOTH dev and prod confirms cron.job rows insights-digest-weekly (0 23 * * 0, active=true) and insights-digest-catchup (0 13 * * 1, active=true) per mig 183 — genuinely externally-invoked, not dead code.

### A20. RegistrationConfirmationCta.tsx never mounted anywhere — orphaned acquisition CTA

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** dead-component | **Removal:** yes | **~LOC/objects:** 65
- **Where:** components/marketing/RegistrationConfirmationCta.tsx
- **Evidence (finder):** grep -rn RegistrationConfirmationCta app components lib tests (dev) and git grep ... master both return only self-matches inside the file (type decl + export). No page/component renders it. Its analytics eventType 'registration_confirmation' is still declared live in lib/tournament-plus-analytics.ts:28 (an AcquisitionSource union member) with no component left to fire it — the feature appears half-shipped: built with tracking wired in, never actually placed on the post-registration confirmation flow (components/public/RegisterContent.tsx has a `confirmation` state but doesn't render this CTA).
- **Verification:** Grep + `git grep master`: only self-matches in file + 4 archived-doc mentions, zero code refs. No barrel index, no dynamic imports, absent from tests/uat/*. git log: last touches old, no recent edits.

RegisterContent.tsx success step (L748-830): hand-built card w/ own CTAs (joinHref) — never imports this component. Archived plan doc confirms it was deliberately unmounted from success screen, file kept ("can stay").

'registration_confirmation' source's only other hit: UAT spec hitting /coaches/start?source=registration_confirmation as raw URL testing query handling — unrelated to component.

Sibling CTAs sharing acquisition helper ARE mounted elsewhere — only this consumer orphaned.
- **Verifier notes:** Widen scope: its CSS classes in tournament-growth.module.css are also unreferenced and should be pruned with it. risk_class=judgment not safe-mechanical since an archived plan explicitly chose to keep this file for possible reuse when unmounting it, though deletion is technically zero-risk today.

### A21. lib/season-compare.ts is orphaned — only its own unit test imports it, no production code does

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** dead-export | **Removal:** yes | **~LOC/objects:** 43
- **Where:** lib/season-compare.ts; tests/unit/season-compare.test.ts
- **Evidence (finder):** Docstring says this feeds 'the This season vs last panel on Season Review'. Repo-wide grep for winPct/compareValues/formatWinPct/season-compare finds only lib/season-compare.ts itself and tests/unit/season-compare.test.ts (which imports '../../lib/season-compare.ts' directly) — no app/ or components/ file imports it. The archived COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md V3 redesign reconciles 'TWO conflicting W-L-T definitions' into a different record-widget-based approach, superseding this module's design.
- **Verification:** Grep winPct|compareValues|formatWinPct in app/components/lib: only season-compare.ts+test+unrelated 'winPct' literal in lib/sports.ts. Grep season-compare: no importer anywhere. Read history/page.tsx (Season Review) - no import. git log: one commit only (6296fd4a, 2026-07-07). git grep on master: zero hits, never shipped prod. scripts/*, tests/uat/*, lib/email*: zero hits. Archived plan (2026-07-08, next day) reconciles away season comparison; live help copy coaches.tsx:997 says "no season-to-season comparison on purpose...scrapbook not scoreboard" - feature deliberately reversed. release-notes.ts:234 is historical text only.
- **Verifier notes:** Stronger than finder's claim: feature was deliberately reversed by documented product decision one day after landing, not merely unwired. Safe to delete season-compare.ts + its test together. Marked judgment not safe-mechanical since keeping generic winPct helpers is a maintainer taste call; zero runtime risk either way.

### A22. lib/chat-service.ts: ensureCoachMembership + countOpenReportsForRoom built defensively, never called

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** dead-export | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 30
- **Where:** lib/chat-service.ts:600; lib/chat-service.ts:1908; docs/projects/archive/TOURNAMENT_CHAT_PLAN.md:82
- **Evidence (finder):** TOURNAMENT_CHAT_PLAN.md:82 itself says: 'Membership helper made self-guarding -- ensureCoachMembership verifies participation before inserting (safe for any future caller); the hot path uses an unchecked internal helper to avoid double-resolution.' i.e. it was written for a hypothetical future caller that doesn't exist yet. Repo-wide grep for both names finds only their own declarations plus this doc mention.
- **Verification:** Both functions exist at cited lines; grep finds no callers anywhere besides own declarations and the accurately-quoted TOURNAMENT_CHAT_PLAN.md:82 line. Note countOpenReportsForRoom's own comment claims it 'drives the Reports badge' — worth a closer look, but exact-name grep across ts/tsx shows zero call sites today.

### A23. lib/coach-warm-preview.ts no longer earns its 'preview' name — candidate to inline or rename

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** other | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 19
- **Where:** lib/coach-warm-preview.ts:19; app/[orgSlug]/coaches/layout.tsx:103; components/coaches/CoachPortalShell.tsx:153; components/coaches/CoachPortalShell.tsx:280
- **Evidence (finder):** Module's own docstring: 'that gate is retired now that warm coverage is complete... The marker is unconditional.' The file now only exports `export const coachWarmAttr = {'data-coach-warm-enabled': ''}` — no branching logic, no env read. It has exactly 2 real consumers (both spreading the same static object). docs/projects/archive/CODEBASE_CLEANUP_INVESTIGATION_PROMPT.md itself flags this exact question: 'is the module still earning its name or should be renamed/inlined/removed?'
- **Verification:** lib/coach-warm-preview.ts contains only the docstring plus a static `coachWarmAttr` object — no branching/env logic. Grep confirms exactly 2 real consumers at the cited lines, both merely spreading the static object.

### A24. lib/admin-density.tsx: useAdminDensity() hook orphaned per an explicit 2026-06-05 design decision

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** dead-export | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 3
- **Where:** lib/admin-density.tsx:78; memory/design_decisions.md:1130-1136
- **Evidence (finder):** design_decisions.md 2026-06-05 entry: 'Density toggle removed from both the desktop sidebar footer and the mobile More sheet... The density tokens and useAdminDensity context remain -- auto-detection still fires -- only the two UI toggle blocks were removed.' Repo-wide grep for useAdminDensity finds zero call sites (AdminChrome.tsx only imports the sibling AdminDensityProvider, not the hook). The auto-detect + data-density attribute logic still functions; only the manual read/write hook is now unreachable.
- **Verification:** useAdminDensity has zero call sites besides its own declaration. AdminChrome.tsx imports only sibling AdminDensityProvider (verified via grep). design_decisions.md 2026-06-05 entry matches quoted text verbatim incl. 'useAdminDensity context remain[s] ... only the two UI toggle blocks were removed.'

### A25. 107 lib/ exports referenced only within their own file — over-exported surface, not dead

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** altitude | **Removal:** no (consolidation/hygiene)
- **Where:** lib/follow.ts (14 such exports); lib/chat-service.ts (6); lib/db.ts (10); lib/directory.ts (4); lib/export/pdf.ts (3)
- **Evidence (finder):** Automated per-export scan: for every lib/ export whose name has zero references in OTHER files, checked whether the name still appears elsewhere in its OWN file (used internally, just needlessly exported) vs literally only the declaration. 107 fall in the 'used internally, no external reason to export' bucket, e.g. lib/follow.ts exports followTournamentKey, followOrgKey, isFollowingTournament, isFollowingOrg, saveFollowedTournament/Org, readFollowedTournament/Org, readAllFollowed*, syncTournamentFollowToAccount, syncOrgFollowToAccount, clearAllAccountOwnedFollows, restoreAllParkedFollows -- all used only inside lib/follow.ts.
- **Verification:** Spot-checked lib/follow.ts's 14 named exports with self-match-excluded grep: 0 external refs for all. Also checked lib/export/pdf.ts: buildBattingOrderCardDoc/buildLineupPosterDoc have 0 external refs. Sample validates scan methodology and rough count.

### A26. PushPermissionPrompt.tsx + module.css orphaned by Notification Settings consolidation (dev-only)

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** dead-component | **Removal:** yes | **~LOC/objects:** 407
- **Where:** components/notifications/PushPermissionPrompt.tsx; components/notifications/PushPermissionPrompt.module.css
- **Evidence (finder):** grep -rn PushPermissionPrompt app components lib tests on dev: zero importers (only comments in app/api/notifications/push/subscribe/route.ts and lib/push-client.ts reference it historically). git diff master dev -- 'app/[orgSlug]/admin/org/notifications/page.tsx' shows the 375-line page that used to `import PushPermissionPrompt` was gutted to a 14-line redirect to /account/notifications (Notification Settings Phase 1, D1 decision). git grep on master CONFIRMS the component is still live in prod code today at that same page path. Dev's replacement flow uses components/notifications/EnablePushBanner.tsx (imported by app/[orgSlug]/admin/AdminChrome.tsx) instead.
- **Verification:** grep PushPermissionPrompt across app/components/lib/tests/scripts (excl .next/node_modules): only comments in push/subscribe/route.ts:5 and lib/push-client.ts:5, zero importers. Read full page.tsx: 14-line redirect, no import. git log page.tsx: gutting commit d6137c02, 2026-07-13 (11d old, not concurrent). Confirmed replacement EnablePushBanner imported/rendered in AdminChrome.tsx. git grep master: PushPermissionPrompt still imported+rendered live at master page.tsx:267 - prod-only survivor. Checked tests/uat, scripts/, sw.js, dynamic import() for 'Push': zero hits. PushPermissionError is a distinct unrelated class.
- **Verifier notes:** Zero live refs on dev - every trap empty there. owner-decision only because twin file still live in prod (master) today; dev deletion is mechanically safe (separate branch, dev's page already supersedes master's), but owner should confirm Notification Settings Phase 1 (mig 185, prod-pending) ships before promotion so prod isn't stranded mid-flight.

### A27. Anonymous fan-push subscribe/unsubscribe routes are intentional legacy shims for pre-existing device subscriptions

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** dead-api-route | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 67
- **Where:** app/api/public/fan-push/subscribe/route.ts (returns 410 Gone unconditionally); app/api/public/fan-push/unsubscribe/route.ts; lib/push-client.ts (current push flow uses /api/notifications/push/subscribe instead, no fan-push reference)
- **Evidence (finder):** subscribe/route.ts docstring: 'RETIRED (410 Gone)... Business Decisions Log 2026-07-14... New opt-ins go through the account path.' unsubscribe/route.ts docstring: 'no UI calls this anymore, but it stays live so a device holding a pre-retirement anonymous subscription can still be opted out.' Zero code callers anywhere (only doc/test-report mentions); lib/push-client.ts and PushPermissionPrompt.tsx exclusively use the newer account-scoped /api/notifications/push/subscribe.
- **Verification:** subscribe/route.ts = unconditional 410, docstring cites Business Decisions Log 2026-07-14; BUSINESS_DECISIONS.md L132-141 confirms exact decision. unsubscribe stays live per docstring. grep: zero code callers of either route; push-client.ts uses /api/notifications/push/* exclusively.

### A28. Per-org/per-tournament manifest.webmanifest routes are intentional legacy 308-redirect shims, not dead

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** dead-api-route | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 33
- **Where:** app/[orgSlug]/scorekeeper/manifest.webmanifest/route.ts; app/[orgSlug]/[tournamentSlug]/manifest.webmanifest/route.ts; app/[orgSlug]/scorekeeper/layout.tsx:24 (manifest: '/manifest.json'); app/[orgSlug]/[tournamentSlug]/layout.tsx:61 (manifest: '/manifest.json'); docs/projects/archive/UNIFIED_APP_PHASE0_SPIKE.md:13
- **Evidence (finder):** Both route files are self-documented 'LEGACY SHIM (unified-app Phase 0)' and simply `Response.redirect(new URL('/manifest.json', req.url), 308)`. Both layouts now point <link rel=manifest> at the unified /manifest.json (app/manifest.json/route.ts), so these routes get zero internal hits/links — they exist solely to 308-redirect OLD installed PWA instances still re-fetching the original per-org/per-tournament manifest URL. Not a caller gap; do not delete without a product decision on the backward-compat window for old installs.
- **Verification:** Both route.ts read verbatim as 308 redirects to /manifest.json w/ 'LEGACY SHIM' docstring. Both layouts confirmed pointing manifest at /manifest.json. grep confirms zero internal refs to manifest.webmanifest outside the two route files + 2 unrelated comments.

### A29. app/dev/email-preview has zero inbound links anywhere (orphaned by design: direct-URL dev tool, prod-gated)

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** other | **Removal:** no (consolidation/hygiene)
- **Where:** app/dev/email-preview/page.tsx
- **Evidence (finder):** No href/Link/router.push anywhere in app/, components/, lib/ points at /dev/email-preview (0 boundary-match hits repo-wide) — reached only by typing the URL directly. Self-documented as intentional: 'DEV-ONLY coach email gallery ... Blocked in production' with `if (process.env.NODE_ENV === 'production') notFound();` at line 241. Referenced as a workflow step in docs/projects/archive/COACH_EXPERIENCE_WALKTHROUGH_PLAN.md. Verdict: orphaned-from-nav but intentional — not a removal candidate, flagged only because it matched the zero-inbound-links scan.
- **Verification:** page.tsx L241 has NODE_ENV===production notFound() guard. Zero href/Link refs repo-wide. Referenced only in docs/projects/archive/COACH_EXPERIENCE_WALKTHROUGH_PLAN.md + archived audit doc, matching claim exactly.

### A30. LegacyInstallBanner is NOT dead / NOT a duplicate of InstallAppPrompt — owner-decision lead

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** other | **Removal:** no (consolidation/hygiene)
- **Where:** components/LegacyInstallBanner.tsx; app/layout.tsx:10; app/layout.tsx:100
- **Evidence (finder):** app/layout.tsx:10 imports it, :100 renders it unconditionally in the ROOT layout — mounts on every page, 1 importer, fully wired, not orphaned. Its trigger (lines 27-42) needs standalone mode + a legacy `?pwa=1` marker; InstallAppPrompt.tsx (134-136) bails whenever already standalone — mutually exclusive by design, not a duplicate. InstallAppPrompt targets non-installed users; LegacyInstallBanner nudges people on an OLD frozen per-tournament PWA install to switch. Comment self-describes as a light, one-time nudge for 'near-zero installed base', 6-month dismiss — owner call needed on whether that window has closed, but it is live code, not dead.
- **Verification:** app/layout.tsx:10 imports LegacyInstallBanner, rendered unconditionally near line 99 with a comment confirming self-gating. Component's standalone+?pwa=1 gate + 6-month dismiss matches claim exactly; InstallAppPrompt has its own separate standalone bail-out. No uncommitted concurrent work on this file.

### A31. lib/stripe-prices.ts: isPlanCheckoutPriceConfigured() is unwired WIP, not legacy dead code — do not remove

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** other | **Removal:** no (consolidation/hygiene)
- **Where:** lib/stripe-prices.ts:43; docs/projects/archive/STRIPE_PRICE_VALIDATION_PLAN.md:27-28
- **Evidence (finder):** STRIPE_PRICE_VALIDATION_PLAN.md: 'Phase 3 -- H8 in-app price-guard wiring -- NOT BUILT... Use isPlanCheckoutPriceConfigured in the in-app upgrade card's gating.' Zero current callers, but the plan explicitly earmarks it for imminent use -- flag to /billing or the plan owner instead of deleting.
- **Verification:** isPlanCheckoutPriceConfigured defined at lib/stripe-prices.ts:43 with exact 'H8 price-guard (runtime)' docstring; grep finds zero call sites in app/lib/components, only plan-doc/TODO mentions. TODO.md:37 confirms Phase 3 (the consumer of this fn) is explicitly not yet built.

### A32. lib/sports.ts: TOURNAMENT_SPORT_OPTIONS unused because the Phase 2 sport-picker is paused, not retired

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** other | **Removal:** no (consolidation/hygiene)
- **Where:** lib/sports.ts:75; docs/projects/archive/MULTISPORT_TOURNAMENTS_PLAN.md:173
- **Evidence (finder):** MULTISPORT_TOURNAMENTS_PLAN.md:173 marks this 'checked-done: Encoded as TAILORED_SPORT_IDS + TOURNAMENT_SPORT_OPTIONS in lib/sports.ts', but the project memory records 'Phase 2 picker PAUSED (softball first)' -- the consuming picker was never built. Zero repo-wide references outside lib/sports.ts itself. Do not delete -- paused in-flight feature scaffolding.
- **Verification:** lib/sports.ts:75 confirms the export; zero refs outside the file. Plan doc:173 confirms it's Phase 0 scaffolding for a paused Phase 2 picker (project memory: 'Phase 2 picker PAUSED, softball first'). Correctly paused work, not dead code.

### A33. RaceToPlayoffsView.tsx — zero importers on both dev and master; host page now redirects elsewhere

- **Verdict:** DOWNGRADED | **Risk:** safe-mechanical | **Type:** dead-component | **Removal:** yes | **~LOC/objects:** 238
- **Where:** components/public/RaceToPlayoffsView.tsx; app/[orgSlug]/standings/standings.module.css (dead raceHeader/raceSection/podium/playoffCutoff rule-sets, roughly lines 1007-1883)
- **Evidence (finder):** grep -rn RaceToPlayoffsView app components lib tests (dev) and git grep on master both return only self-matches. Its former host, app/[orgSlug]/standings/page.tsx, is now a 15-line redirect to the tournament-scoped standings page, rendered via StandingsContent.tsx instead (no race-to-playoffs UI). 'Race to playoffs' now lives via lib/playoff-picture.ts + app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx. Its CSS classes (.raceHeader/.podium/.playoffCutoff etc.) still sit inside standings.module.css, which StandingsContent.tsx also imports for unrelated classes — dead weight riding inside an otherwise-live file.
- **Verification:** grep RaceToPlayoffsView across app/components/lib/tests + git grep master: only self-matches, plus 4 doc hits. standings/page.tsx read: redirect-only, confirmed. 12 traps checked (sw.js, scripts/, tests/, email, platform-admin, dynamic-import/JSON, cron): all empty. git log: last touch 282466b9 (mechanical type sweep, not a mount; no recent activity). docs/projects/archive/PUBLIC_FAN_EXPERIENCE_PLAN.md:99 (also master): J6-027 -- podium owner-tested, rejected for simpler UI; deliberate closed decision. css:990-1928: core rules = one block (1007-1310); second cluster (1814-1897) inside shared mobile media query w/ live .followBar/.bracket*/.viewToggle rules.
- **Verifier notes:** Dead-code claim holds, removal safe. Corrections: (a) documented owner-reviewed rejection (J6-027), not an overlooked orphan; (b) CSS cleanup is two pieces: clean block (1007-1310) plus scattered rules in a shared mobile media query (1814-1897), not one span.

### A34. Family of legacy top-level compat-redirect stubs — zero inbound code links by design (stale bookmarks/emails only)

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** dead-route | **Removal:** no (consolidation/hygiene)
- **Where:** app/(consumer)/auth/select-org/page.tsx; app/(consumer)/home/page.tsx; app/my/page.tsx; app/my/join/page.tsx; app/my/registrations/page.tsx; app/team/page.tsx; app/team/checkout/complete/page.tsx; app/platform-admin/plans/page.tsx
- **Evidence (finder):** Each file's body is only redirect()/permanentRedirect() to the canonical path. home/page.tsx: 'stays alive FOREVER as a permanent (308) alias so already-sent emails/push/PWA links to /home never 404'. Full-repo search found ZERO inbound refs to /auth/select-org, /platform-admin/plans, /platform-admin/stripe-prices anywhere in app/components/lib/proxy.ts/sw.js. /home,/my/*,/team/* appear only in chrome-suppression checks and coaches-portal-routes.ts's rewriteLegacyCoachPortalPath() (rewrites old ?next= values, never a live href). Verdict: intentional, working as designed, not dead. Same pattern covers team/claim/[token] + my/registrations/[teamId] (omitted, 8-loc cap).
- **Verification:** 5/8 confirmed live stubs (select-org,home,team/page,team/checkout/complete,platform-admin/plans). BUT app/my/page.tsx, my/join, my/registrations (+my/registrations/[teamId], unlisted) are UNREACHABLE: proxy.ts matcher has '/my','/my/:path*' + unconditional redirect to /coaches/* before render, added same commit as these pages -- these 4 are dead code, not 'by design'.

### A35. app/platform/{tournaments,house-league,rep-teams,accounting} orphaned, superseded by /for-* pages

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** dead-route | **Removal:** yes | **~LOC/objects:** 568
- **Where:** app/platform/tournaments/page.tsx; app/platform/house-league/page.tsx; app/platform/rep-teams/page.tsx; app/platform/accounting/page.tsx
- **Evidence (finder):** Zero inbound refs anywhere in app/, components/, lib/, proxy.ts, public/sw.js. app/sitemap.ts STATIC_PATHS lists /for-tournament-organizers, /for-leagues, /for-clubs, /for-coaches, /pricing, /changelog, /discover, /scores — no /platform/*. app/page.tsx PERSONAS array links to /for-tournament-organizers etc, not /platform/*; PLATFORM_BENEFITS section is plain text, no hrefs. Navbar.tsx/Footer.tsx have no /platform/ links. Only mention anywhere is an archived completed plan doc listing them as files to edit. Same state on git show master:app/page.tsx (prod).
- **Verification:** git grep exact paths (dev+master) → only hit is archived doc, confirms no Link/import. BUT broader grep for bare '/platform' found a live hit finder missed: Navbar.tsx:29 `pathname.startsWith('/platform')` inside isMarketingPath() (used line 104) — deliberately renders marketing chrome for these routes; not orphaned-with-no-support. robots.ts disallow list omits /platform/*, no noindex meta → crawlable/indexable. git log: app/platform/tournaments (56767abe) predates for-tournament-organizers (8f0bc0ab) → pre-rename SEO pages. next.config.ts has legacy redirects but none for /platform/*. git status/diff/log confirm files untouched >1mo. LOC 135+145+146+142=568 matches.
- **Verifier notes:** "Zero references anywhere in components/" is false: Navbar.tsx still special-cases '/platform' for nav chrome. Pages are crawlable, pre-date the /for-* rename, and no 301 exists — bare deletion risks 404ing indexed/bookmarked traffic. Correct shape: add /platform/*→/for-* redirects, then delete files + vestigial Navbar prefix.


## Workstream B — Duplicate / near-duplicate code

### B01. Identical resolveCoachContext(orgSlug, teamId) helper hand-copied into 46 coaches route.ts files

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 900
- **Where:** app/api/coaches/[orgSlug]/teams/[teamId]/attendance/route.ts; app/api/coaches/[orgSlug]/teams/[teamId]/dues/route.ts; app/api/coaches/[orgSlug]/teams/[teamId]/roster/route.ts; app/api/coaches/[orgSlug]/teams/[teamId]/budget/route.ts; app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts; app/api/coaches/[orgSlug]/teams/[teamId]/expenses/route.ts; app/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/route.ts; app/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/route.ts
- **Evidence (finder):** grep -rl "^async function resolveCoachContext" app/api --include=route.ts => 46 files; 0 files import it from a lib module. Verified byte-for-byte identical ~20-line body across dues/route.ts, roster/route.ts, budget/route.ts, attendance/route.ts: getAuthContext -> org.slug match -> getRepTeam+org check (404) -> getCoachingAssignmentsForUser+find assignment (403) -> getActiveRepProgramYear (404). Codebase memory documents a 'resolveCoachContext() API pattern' as if centralized, but it is never actually imported from lib/ — each route locally redefines it.
- **Verification:** grep count=46 exact. 0 files import it (confirmed); lib/ hits are comments only, not real implementations. 4 sampled files (attendance/dues/roster/budget) byte-for-byte identical 21-line bodies. 46*21≈966 lines, consistent with est_loc:900. No uncommitted changes under app/api/coaches/.

### B02. Identical 4-line capability+entitlement gate() function copy-pasted into 66 admin route.ts files

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 260
- **Where:** app/api/admin/accounting/budget-categories/route.ts; app/api/admin/accounting/budget-plan/route.ts; app/api/admin/accounting/budget-vs-actual/route.ts; app/api/admin/house-league/seasons/route.ts; app/api/admin/house-league/seasons/[seasonId]/divisions/route.ts; app/api/admin/rep-teams/teams/route.ts; app/api/admin/rep-teams/dues/send-automated-reminders/route.ts; app/api/admin/public-site/route.ts
- **Evidence (finder):** grep -rl "function gate(" app/api --include=route.ts | wc -l => 66. Body is byte-identical modulo one capability string: unauthorized() if no ctx, forbidden() if !hasCapability(ctx.role,ctx.capabilities,'module_X'), forbidden() if !hasModuleEntitlement(ctx.org,'module_X'). Breakdown: 33x module_rep_teams, 16x module_house_league, 16x module_accounting, 1x module_public_site (verbatim-verified across 3 sampled accounting files). No shared helper checks hasCapability+hasModuleEntitlement together; lib/api-auth.ts requireCapability() only checks capability (re-fetches from DB), not module entitlement.
- **Verification:** grep count=66 exact. Per-file module-string extraction: 33 rep_teams/16 house_league/16 accounting/1 public_site = 66, matches claim exactly. 3 sampled accounting files byte-identical. lib/api-auth.ts requireCapability() (267-279) confirmed checks only hasCapability, no hasModuleEntitlement - no shared helper exists. No uncommitted changes in app/api/admin/.

### B03. CSV/XLSX dual-format export boilerplate duplicated across 5 export routes

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 200
- **Where:** app/api/platform-admin/audit/export/route.ts; app/api/platform-admin/feedback/export/route.ts; app/api/platform-admin/early-access/export/route.ts; app/api/platform-admin/observability/issues/export/route.ts; app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts
- **Evidence (finder):** grep -rl "new ExcelJS.Workbook" app/api --include=route.ts => 7 files (5 share this exact export shape; 2 others are import-template generators, different shape). audit/export and feedback/export verified near-identical ~45-line blocks: local csvValue() escaper, workbook.creator='FieldLogicHQ', headerRow.font/fill FF1E293B, ws.columns.forEach autofit Math.min(Math.max(headerLen,maxData)+2,80), ws.views=[{state:'frozen',ySplit:1}], xlsx.writeBuffer() response vs CSV-lines fallback, identical Content-Disposition pattern differing only by filename base.
- **Verification:** grep count=7 exact match (5 export-shape + 2 import-template). All 5 cited export routes share creator='FieldLogicHQ', fgColor FF1E293B header fill, Math.min(Math.max(headerLen,maxData)+2,60|80) autofit, frozen ySplit:1 view - near-identical boilerplate confirmed. No relevant uncommitted changes.

### B04. Read-only auth-check Supabase client duplicated instead of reusing lib/api-auth.ts's getAuthenticatedUser()

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 55
- **Where:** lib/platform-auth.ts:74-87 (getPlatformAdminContext); app/api/auth/accept-invite/route.ts:8-24; app/api/auth/invitations/route.ts:7-21; app/api/auth/invitations/[memberId]/route.ts:8-24; lib/api-auth.ts:66-83 (canonical getAuthenticatedUser)
- **Evidence (finder):** All 4 sites build the identical block: `createServerClient(url, anonKey, {cookies:{getAll(){...}, setAll(){}}}); const {data:{user}} = await supabase.auth.getUser();`. Three of the four (the API routes) locally define a function literally named `getAuthenticatedUser()` — same name, same body — instead of importing lib/api-auth.ts's export of that exact name. platform-auth.ts even already imports `getAuthenticatedUser` from './api-auth' elsewhere in the same file but doesn't reuse it here.
- **Verification:** lib/api-auth.ts:66-83 exports getAuthenticatedUser(). platform-auth.ts:7 imports it but getPlatformAdminContext() (74-86) rebuilds an identical client instead of calling it. accept-invite/route.ts:8-24, invitations/route.ts:7-21, invitations/[memberId]/route.ts:8-24 each locally redefine getAuthenticatedUser() with byte-identical bodies. No concurrent commits touch these files.
- **Proposed action:** Delete the 3 route-local getAuthenticatedUser() redefinitions and import lib/api-auth.ts's version; have lib/platform-auth.ts's getPlatformAdminContext() call the imported getAuthenticatedUser() instead of rebuilding the client.

### B05. Cron-or-super-admin actor + dryRun/orgId/teamId body parsing duplicated in the two sweep routes

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 20
- **Where:** app/api/platform-admin/dues-reminders/route.ts; app/api/platform-admin/insights-digest/route.ts
- **Evidence (finder):** Both routes: `const machine = isCronRequest(req); let actor='cron-scheduler'; if(!machine){ const auth = await requireSuperAdmin(); if(auth.response) return auth.response; actor = auth.user.email ?? 'platform-admin'; } let body:{orgId?:string;teamId?:string;dryRun?:boolean}={}; try{body=await req.json();}catch{} ...` is identical line-for-line in both files (grep -rl isCronRequest app/api --include=route.ts => exactly these 2 files). Only the downstream sweep-runner call and audit-log payload differ.
- **Verification:** Read both files: lines 26-43 (dues-reminders) and 23-40 (insights-digest) are verbatim identical (isCronRequest actor resolution + json parse + orgId/teamId/dryRun extraction). Only sweep-runner call and audit payload differ. grep confirms exactly these 2 files use isCronRequest under app/api. Pure mechanical dedup.

### B06. downloadCSV() in lib/utils.ts is fully superseded by lib/export/csv.ts and has zero remaining call sites

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-export | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 12
- **Where:** lib/utils.ts:13-24; lib/export/csv.ts:1-5
- **Evidence (finder):** lib/export/csv.ts's own header comment says it 'Normalizes the existing downloadCSV() in lib/utils.ts into the shared layer.' Grepping `downloadCSV` repo-wide (excluding the word 'downloadCSVBlob') returns only the lib/utils.ts definition itself and that one doc-comment reference — all 25 real consumer pages already import generateCSV/downloadCSVBlob from '@/lib/export'.
- **Verification:** lib/utils.ts:13-24 downloadCSV() confirmed. Repo-wide grep for 'downloadCSV' returns only its own definition and lib/export/csv.ts:4's doc-comment - zero real call sites. All 25+ actual export sites use downloadCSVBlob/generateCSV from lib/export instead. Dead code confirmed.
- **Proposed action:** Delete the dead downloadCSV() export from lib/utils.ts.

### B07. Team fee/deposit outstanding-balance math repeated 5x inline in the registrations page, no lib home

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** altitude | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 10
- **Where:** app/[orgSlug]/admin/tournaments/registrations/page.tsx:184; app/[orgSlug]/admin/tournaments/registrations/page.tsx:190; app/[orgSlug]/admin/tournaments/registrations/page.tsx:1253-1254; app/[orgSlug]/admin/tournaments/registrations/page.tsx:1271-1272
- **Evidence (finder):** Same formula written out independently 5 times in one 3025-line file: `Math.max(fee.depositAmount - team.depositPaid, 0)` (line 184, 1272) and `Math.max(fee.totalFeeAmount - team.totalPaid, 0)` (lines 190, 1254, 1271). Zero occurrences of this expression outside this page.tsx and zero matching lib/ helper (checked for outstandingBalance/amountOwed exports — none exist). Candidate home: lib/tournament-team-fees.ts, alongside sibling lib/tryout-fees.ts and lib/basic-coach-fees.ts for other fee domains.
- **Verification:** Read registrations/page.tsx: exact formula appears 5x as claimed - deposit-shortfall Math.max at lines 184,1272; total-shortfall Math.max at lines 190,1254,1271 (verified line-by-line). No lib/tournament-team-fees.ts exists; grep for outstandingBalance/amountOwed exports returns zero hits. Sibling fee-domain modules confirmed. Pure extraction.

### B08. One API route handler still unwrapped by withObservability (99.8% coverage)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** altitude | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 3
- **Where:** app/api/public/tournament-viewer/route.ts
- **Evidence (finder):** node scripts/check-observability-coverage.mjs --json => total:544 wrapped:543 pct:99.8; domain 'public' shows 8/9. The GET in tournament-viewer/route.ts is a plain `export async function GET(request: NextRequest) {...}` (no withObservability wrapper), unlike every sibling file in app/api/public/* which uses `export const GET = withObservability(...)`. Exclusion list (observability-route-exclusions.mjs) only excludes api/dev/** and api/client/error-capture — both entries still point at real, existing routes (15 files under app/api/dev, and app/api/client/error-capture/route.ts exists), so there is no stale-exclusion problem, only this one genuine coverage gap.
- **Verification:** Re-ran check-observability-coverage.mjs --json: total 544, wrapped 543, pct 99.8, domain public 9/8 - exact match. tournament-viewer/route.ts confirmed plain GET, no withObservability. Exclusion list only excludes api/dev/** (15 real files, verified) + api/client/error-capture (exists) - no stale-exclusion issue. No uncommitted changes to file.

### B09. No shared client-side fetch/error wrapper — hand-rolled try/fetch/res.ok/setError boilerplate repeated across ~150 files

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 800
- **Where:** components/coaches/FeeEditor.tsx:115-134; components/coaches/RosterEditor.tsx; components/coaches/ScheduleEditor.tsx; app/[orgSlug]/admin/tournaments/schedule/page.tsx; app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/page.tsx; app/[orgSlug]/admin/org/members/page.tsx; components/rep-teams/TryoutCheckIn.tsx; app/platform-admin/orgs/[id]/OrgDetailClient.tsx
- **Evidence (finder):** 524 occurrences of `res.ok` across 190 files; 369 occurrences of the `'Content-Type': 'application/json'` POST-body idiom across 147 .tsx files; 193 occurrences of `res.json().catch(() => ({}))` across 90 files. No lib/api-client.ts, apiFetch, useApiRequest, or toast library (sonner/react-hot-toast/useToast) exists anywhere — every call site hand-rolls `setBusy(true); setError(null); try { const res = await fetch(...); const data = await res.json().catch(()=>({})); if (!res.ok) throw new Error(data.error ?? 'fallback'); ... } catch(e) { setError(...) } finally { setBusy(false) }`.
- **Verification:** Grep 'res.ok' returns 528 occurrences/192 files (claim: 524/190, normal drift). Grep for any exported apiFetch|useApiRequest returns zero matches repo-wide, confirming no shared client fetch wrapper exists. Core claim fully verified; large multi-session proposal per finding's own est_loc 800.
- **Proposed action:** Introduce a small shared client helper (e.g. lib/api-client.ts exporting `apiFetch<T>()` returning `{data}` or throwing a normalized Error, or a `useApiRequest` hook that owns busy/error state) and migrate call sites incrementally, highest-traffic pages first. This is the largest duplication cluster in the codebase by file count; a full migration is a multi-session effort, not a single pass.

### B10. Display date formatting ('Jul 16') reimplemented ~20x instead of one shared helper

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** date-math | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 60
- **Where:** components/public/ScheduleContent.tsx:122,130-133,518,524; components/public/StandingsContent.tsx:58,339; components/public/TeamsContent.tsx:140; components/public/TournamentHomeContent.tsx:153-154,240; components/public/MyTournamentCard.tsx:233; components/public/MyTeamDock.tsx:272,290; components/public/DesktopMyTeamRailCard.tsx:88; app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx:36
- **Evidence (finder):** ~20 files across public/coaches/admin schedule surfaces (also LogicSyncBracket.tsx:178, [tournamentSlug]/teams/[id]/page.tsx:222,440, [tournamentSlug]/schedule/[gameId]/page.tsx:42, admin/tournaments/schedule/{PlayoffWizard.tsx:566, Generator.tsx, page.tsx:1032}) each locally repeat the same 'anchor at noon to dodge UTC-midnight rollback, then toLocaleDateString en-CA {month,day}' idiom. lib/timezone.ts has no display-formatting export (a genuine gap); lib/utils.ts's own relativeDayLabel() reimplements the identical anchor internally rather than calling a shared formatter.
- **Verification:** lib/utils.ts:90-95 relativeDayLabel uses `new Date(date+'T12:00:00').toLocaleDateString('en-CA',{month,day})` internally (not shared). lib/timezone.ts has zero display-formatters. Grep 'T12:00:00' hits 74 occurrences/36 files (more than the ~20 claimed). Spot-checked StandingsContent.tsx:58, MyTeamDock.tsx:272/290, playoffs/page.tsx:36 - all match cited pattern exactly.
- **Proposed action:** Extract a shared `formatGameDate(dateStr, opts?)` into lib/utils.ts (sibling to the existing formatTime()) that does the T12:00:00 anchor once, and have relativeDayLabel() + all ~20 call sites use it.

### B11. 3 Health Panel components reimplement a details-based card shell near-identical to CollapsibleCard.tsx

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 60
- **Where:** components/admin/CollapsibleCard.tsx:92-107; app/[orgSlug]/admin/tournaments/schedule/components/ScheduleHealthPanel.tsx:64-117; app/[orgSlug]/admin/tournaments/registrations/components/RegistrationHealthPanel.tsx:32-83; app/[orgSlug]/admin/tournaments/schedule/components/BracketHealthPanel.tsx:31-65
- **Evidence (finder):** CollapsibleCard.tsx is the documented shared 'admin card built on native <details>/<summary>' primitive (5 adopters). ScheduleHealthPanel/RegistrationHealthPanel/BracketHealthPanel each independently build their own `<details open={expanded} onToggle=...>` + summary + icon/title/meta-badge header + ChevronDown, but track `[expanded, setExpanded] = useState(defaultOpen)` in React state redundantly alongside the native details element's own open/close state (RegistrationHealthPanel.tsx:63-66 pattern repeated 3x) — CollapsibleCard avoids this by leaving `open` uncontrolled.
- **Verification:** CollapsibleCard.tsx confirmed uncontrolled details (open={defaultOpen}, no local state). RegistrationHealthPanel.tsx:32 confirmed [expanded,setExpanded]=useState(defaultOpen) plus <details open={expanded} onToggle=.../> at 63-67. Same redundant pattern verified in ScheduleHealthPanel.tsx:64/75/78 and BracketHealthPanel.tsx:31/47/50.
- **Proposed action:** Rebuild the 3 HealthPanel headers on top of CollapsibleCard (title/icon/meta slots already support a header score-badge via `meta`), dropping the redundant `expanded` state and the 3 duplicated header/toggle CSS blocks.

### B12. 'fmtDate' display helper (MMM D, YYYY) locally reimplemented in ~20 accounting/rep-teams/admin files

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** date-math | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 55
- **Where:** app/[orgSlug]/coaches/teams/[teamId]/accounting/{payment-requests,dues,fundraisers,allocations,expenses}/page.tsx; app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx:240; app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx:28; app/platform-admin/audit/page.tsx:122; app/[orgSlug]/admin/rep-teams/{payment-requests,allocations,allocations/[allocationId],teams/[teamId]/history/[yearId],teams/[teamId]/program-years/[yearId]/schedule}/page.tsx; lib/dues-reminders.ts:81; app/api/admin/rep-teams/{dues/send-automated-reminders,allocations/send-reminders}/route.ts + app/api/coaches/.../dues/send-reminders/route.ts; components/accounting/UpcomingPayablesPanel.tsx:32
- **Evidence (finder):** ~20 files each define a local `function fmtDate(...)` doing `new Date(s [+ 'T00:00:00']).toLocaleDateString('en-CA', {month, day, year, ...})` — nearly identical bodies with only month-length/weekday/year-inclusion varying. lib/format-date.ts exists but its own docstring scopes it to platform-admin only ('We do NOT pin to America/Toronto — platform-admin is internal operator tooling') so it isn't the right reuse target for these mostly coach/admin org-facing surfaces.
- **Verification:** Grep 'function fmtDate' finds exactly 20 files matching the claim. dues/page.tsx:51-53 and lib/dues-reminders.ts:81-85 both confirmed near-identical `new Date(s+'T00:00:00').toLocaleDateString('en-CA',{...})` bodies. lib/format-date.ts docstring explicitly scopes it to platform-admin-only ('we do NOT pin to America/Toronto'), confirming it's the wrong reuse target as claimed.
- **Proposed action:** Add 1-2 parameterized display-date formatters to lib/utils.ts (Toronto-pinned, matching the T12:00:00-anchor convention already used elsewhere) and migrate these ~20 local fmtDate definitions to import them.

### B13. Service-role Supabase admin client rebuilt inline instead of importing the lib/supabase-admin.ts singleton

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 35
- **Where:** app/api/registrations/[id]/route.ts:142-147; app/api/public/stats/route.ts:9-16; app/api/admin/tournaments/route.ts:290-300; app/api/admin/games/route.ts:164-174,616-626; app/api/admin/setup-tournament/route.ts:99-112,562-566
- **Evidence (finder):** Each site does `const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; const supabase = createClient(url, key);` (7 call sites total) — byte-identical to what lib/supabase-admin.ts already builds once as the exported `supabaseAdmin` singleton, which 90%+ of the rest of the codebase correctly imports.
- **Verification:** All 5 files verified line-exact: registrations/[id]/route.ts:147, public/stats/route.ts:16, admin/tournaments/route.ts:300, admin/games/route.ts:174+626, admin/setup-tournament/route.ts:112+565 all inline `createClient(url,key)` via SUPABASE_SERVICE_ROLE_KEY, identical to lib/supabase-admin.ts:6-9 singleton. Finding's own hedge re: setup-tournament.ts:562 cleanup path is appropriate.
- **Proposed action:** Replace each inline construction with `import { supabaseAdmin } from '@/lib/supabase-admin'`. Verify the setup-tournament.ts:562 cleanup-client instance isn't intentionally a fresh client for a specific serverless/connection reason before mechanically swapping it too.

### B14. 5 routes build their own raw Supabase client, bypassing the shared supabaseAdmin safety guard

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 30
- **Where:** app/api/admin/games/route.ts; app/api/admin/setup-tournament/route.ts; app/api/admin/tournaments/route.ts; app/api/public/stats/route.ts; app/api/registrations/[id]/route.ts
- **Evidence (finder):** grep -rl "createClient(process.env\|createClient(url, key)" app/api --include=route.ts => these 5 files (vs 219 files that correctly `import { supabaseAdmin } from '@/lib/supabase-admin'`). Each re-reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and calls createClient(url,key) itself, e.g. admin/games/route.ts:174,626. lib/supabase-admin.ts wraps the identical construction in assertSafeSupabaseServerEnvironment('Supabase admin client') before creating the client — these 5 routes skip that guard entirely.
- **Verification:** grep confirms exactly the 5 named files call createClient(url,key) raw; none call assertSafeSupabaseServerEnvironment (checked each). lib/supabase-admin.ts does call that guard first. Shared-import count is 219 (matches once counting any import-style, not just exact destructure phrasing). Fix needs care (e.g. setup-tournament's catch-block cleanup client), so judgment fits.

### B15. isOverdue(dueDate) reimplemented 4x with raw UTC 'today' instead of lib/timezone.ts

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** altitude | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 16
- **Where:** app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/page.tsx:55-58; app/[orgSlug]/coaches/teams/[teamId]/accounting/allocations/page.tsx:32; app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/page.tsx:25; app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:52
- **Evidence (finder):** All four: `return dueDate < new Date().toISOString().slice(0, 10);` (verbatim, or via a 1-line isOverdue wrapper). toISOString() is UTC, so for the org's America/Toronto timezone this flips an installment to 'overdue' several hours before local midnight actually passes (same bug class as the fixed 'Timezone date-math gotcha' in memory). lib/dues-status.ts already exists as the shared dues-math home (exports isNeverPaidPlayer) but has no isOverdue helper; lib/timezone.ts exports tournamentToday()/daysBetweenDateStrings() that could back one.
- **Verification:** grep found exactly 4 isOverdue defs system-wide, all with `dueDate < new Date().toISOString().slice(0,10)` verbatim at the claimed files/lines. lib/dues-status.ts confirmed to have only isNeverPaidPlayer, no isOverdue. lib/timezone.ts has needed primitives. No conflicting uncommitted work on any of the 4 files.

### B16. 'today' computed via raw UTC ISO-slice in schedule/tournament UI surfaces (coach + admin)

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** date-math | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 15
- **Where:** app/coaches/tournaments/page.tsx:56,144; app/coaches/team/[basicTeamId]/tournaments/page.tsx:35; app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx:53; components/coaches/CoachTournamentRecord.tsx:256; components/coaches/CoachLiveSchedule.tsx:121; components/coaches/TeamHQ.tsx:326; app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx:988; app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx:245
- **Evidence (finder):** Same `new Date().toISOString().split('T')[0]` / `.slice(0,10)` pattern used to compare against game/tournament dates for 'is today / is upcoming' UI logic (badges, conflict highlighting, current-tournament filters), across ~15 files total (also ScheduleTimeline.tsx:354, house-league/seasons/[seasonId]/schedule/page.tsx x2, rep-teams program-years schedule page). This is the fan/coach-facing class of bug lib/timezone.ts documents (J6-056), not just an internal tool.
- **Verification:** All 9 locations verified verbatim as `new Date().toISOString().split('T')[0]`. tournamentToday() confirmed already used in 24 other files (Navbar, ScoreTicker, etc.), confirming these coach/admin surfaces are genuine outliers not an intentional split.
- **Proposed action:** Replace with `tournamentToday()`. Since most are client components, either call it directly (Intl is available client-side) or thread the value down as a prop computed server-side.

### B17. teamInk() has 1 adopter; 13+ monogram/tile sites hardcode ink over the same HSL fill it protects

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** token-drift | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 15
- **Where:** lib/team-color.ts:31; app/[orgSlug]/[tournamentSlug]/teams/[id]/page.tsx:149; components/consumer/ScoresClient.module.css:115,239,363; components/consumer/HomePersonalization.module.css:256,302; components/consumer/FollowingList.module.css:96; components/chat/CoachChatView.module.css:152-154; app/[orgSlug]/coaches/coaches.module.css:1509; app/coaches/team/[basicTeamId]/tournaments/page.tsx:62
- **Evidence (finder):** teamInk(name) exists to fix white-on-warm-hue contrast failures from teamColor()/teamAvatarHue(). It's imported in exactly 1 file. Every other consumer hardcodes ink instead: `color:#fff` in ScoresClient/HomePersonalization/FollowingList/DiscoverClient/ChatInbox/TeamAvatar/MyTeamDock/ChatPanel/ChatManagePanel/teams.module.css; `--on-team-color:#ffffff` fixed token (globals.css:404) reused in coaches.module.css+CoachChatView.module.css (comment claims theme-safety, says nothing about hue contrast); one file (coaches/team/tournaments/page.tsx:62) hardcodes the OPPOSITE dark ink `#0f1123`. Three incompatible hardcoded strategies vs the one correct computed one.
- **Verification:** team-color.ts:31-39 teamInk() confirmed. Only 1 non-definition import: teams/[id]/page.tsx:149. Hardcodes verified at ScoresClient/HomePersonalization/FollowingList (color:#fff); CoachChatView.module.css:154 var(--on-team-color,#fff); globals.css:404 token reused at coaches.module.css:1509; tournaments/page.tsx:62 hardcodes opposite #0f1123.
- **Proposed action:** Adopt teamInk() as the ink source in the shared TeamAvatar/monogram render path and replace the #fff/--on-team-color/#0f1123 hardcodes at the listed sites; needs a visual pass since it changes rendered ink on some team/org names.

### B18. 'today' computed via raw UTC ISO-slice in core phase/lifecycle business logic, bypassing tournamentToday()

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** date-math | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 12
- **Where:** lib/coach-tournament-phase.ts:44; lib/tournament-phase.ts:40; lib/coach-tournament-lifecycle.ts:43; lib/coach-status-model.ts:85; lib/registration-attention.ts:224; lib/basic-coach-teams.ts:704; lib/db.ts:1832,3710,4467,5768
- **Evidence (finder):** All default `today?: string` params to `new Date().toISOString().split('T')[0]` (raw UTC date). lib/timezone.ts's own docstring says this exact form 'made the live ticker vanish mid-game, Today's Games go empty' (J6-056) and was built to fix it via tournamentToday(). coach-tournament-phase.ts:39 comment even says 'defaults to today (UTC, matching the organizer page)' — confirming organizer+coach phase derivation are a matched pair sharing the same anti-pattern.
- **Verification:** All 6 lib/ locations verified verbatim as raw UTC `today` defaults. db.ts:4467/5768 confirmed used in real overdue comparisons; db.ts:1832/3710 present but lower-stakes (seed fallback/ledger stamp). lib/timezone.ts:115 confirms J6-056 docstring + tournamentToday(). Comment at coach-tournament-phase.ts:39 matches claim verbatim. No concurrent fix (clean git log/status).
- **Proposed action:** Swap the default-param expression to `tournamentToday()` from lib/timezone.ts in both the organizer (lib/tournament-phase.ts) and coach (lib/coach-tournament-phase.ts) twins together, plus the other lifecycle/status/db.ts sites, so phase transitions (game_day/result cutovers) land on the Toronto calendar day instead of drifting up to ~5h with UTC.

### B19. 'today' computed via raw UTC ISO-slice for accounting overdue/due-date comparisons

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** date-math | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 10
- **Where:** app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/page.tsx:25; app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/page.tsx:57,93; app/[orgSlug]/coaches/teams/[teamId]/accounting/allocations/page.tsx:32,108; app/[orgSlug]/admin/rep-teams/allocations/[allocationId]/page.tsx:52,168; app/api/admin/accounting/budget-vs-actual/route.ts:109,263; app/api/coaches/[orgSlug]/teams/[teamId]/money-summary/route.ts:64; app/api/admin/rep-teams/allocations/route.ts:68
- **Evidence (finder):** `dueDate < new Date().toISOString().slice(0,10)` (and similar) used to flag ledger items 'overdue'/'due today'. Server (Amplify, UTC) vs Toronto local means an item can flip overdue up to ~5h early/late around midnight ET, misleading coaches/admins near the due-date boundary — same root cause class as J6-056 but on money surfaces.
- **Verification:** All 11 locations verified verbatim as `dueDate < new Date().toISOString().slice(0,10)` or equivalent 'today/now' assignment. One site (dues/page.tsx:93) is a record-date stamp not a direct comparison — minor breadth stretch, same file/pattern class, not a false claim.
- **Proposed action:** Route through `tournamentToday()` for the 'today' comparand on both client and server (API routes) sides.

### B20. Local formatTime() reimplementations bypass the canonical formatTime() already exported from lib/utils.ts

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 10
- **Where:** components/rep-teams/TryoutDayCard.tsx:43-46; app/[orgSlug]/archives/[archiveId]/page.tsx:56; app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx:26-28
- **Evidence (finder):** lib/utils.ts exports formatTime() (string-based HH:MM parser, no Date object) and 34+ files correctly `import { formatTime } from '@/lib/utils'`. These 3 files instead define their own local `function formatTime(...)`: TryoutDayCard.tsx does `wallClock(stored).toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit'})`; lineups/page.tsx does `new Date(value).toLocaleTimeString(...)` — a Date-based approach that can diverge from the canonical string-based one on malformed/partial inputs.
- **Verification:** Exactly 3 local formatTime defs confirmed (TryoutDayCard.tsx:43-46, archives/page.tsx:56-62, lineups/page.tsx:26-28) vs canonical lib/utils.ts:73-85. archives/page.tsx is byte-identical logic (safe swap); other two are Date-object-based, different signature - finding flags this. Importer count ~21 not '34+' (34 was total files importing anything from lib/utils); core claim unaffected.
- **Proposed action:** Delete the 3 local formatTime() definitions and import the canonical one from '@/lib/utils' (or, if the Date-based behavior is intentionally different for these 3 call sites, rename to avoid the same-name confusion).

### B21. Dashboard 'days until tournament' uses raw local Date math instead of lib/timezone.ts

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** altitude | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 6
- **Where:** app/[orgSlug]/admin/tournaments/dashboard/page.tsx:437-443
- **Evidence (finder):** function computeDaysUntil(startDate){ const start=new Date(startDate+'T00:00:00'); const today=new Date(); today.setHours(0,0,0,0); return Math.ceil((start.getTime()-today.getTime())/(1000*60*60*24)); } — uses the browser/server's local wall clock, not the tournament's timezone. lib/timezone.ts already exports daysBetweenDateStrings(from,to) and calendarDaysBetween(from,to,timeZone) specifically to avoid this (memory: 'Timezone date-math gotcha' — never raw UTC/local date math for days-until; server TZ can differ from tournament TZ and from the viewer's TZ).
- **Verification:** Read dashboard/page.tsx:437-443, verbatim matches quoted code. File is 'use client' (line1) so new Date() runs in viewer's browser TZ not org's. lib/timezone.ts confirmed exports daysBetweenDateStrings/tournamentToday as the established fix pattern. No recent/uncommitted work touches this function.

### B22. 36 CSS modules independently define a near-identical fixed full-viewport overlay/backdrop rule

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene)
- **Where:** components/admin/BottomSheet.module.css:1-11; components/chat/NewRoomDialog.module.css:1-10; app/platform-admin/change-requests/change-requests.module.css; app/[orgSlug]/admin/onboarding/onboarding.module.css; components/billing/PlanArticlePanel.module.css; app/[orgSlug]/coaches/coaches.module.css; components/help/help.module.css; app/[orgSlug]/scorekeeper/scorekeeper.module.css
- **Evidence (finder):** `grep -rlE "position:\s*fixed;" --include=*.module.css . | xargs grep -l "inset: 0"` returns 36 files. Diffed two: BottomSheet.module.css .backdrop (z-index:600, rgba(0,0,0,.62), backdrop-filter:blur(2px)) vs NewRoomDialog.module.css .backdrop (z-index:70, rgba(0,0,0,.55), no blur) — same shape (position/inset/display flex/align/justify), different constants, hand-copied per component instead of sharing a base overlay class/token.
- **Verification:** Re-ran grep: position:fixed + inset:0 across *.module.css returns exactly 36 files. Diff confirmed: BottomSheet.module.css .backdrop z-index:600, rgba(0,0,0,.62), blur(2px); NewRoomDialog.module.css .backdrop z-index:70, rgba(0,0,0,.55), no blur - same shape, different hand-copied constants.
- **Proposed action:** Extract a shared `.overlay`/backdrop utility (base rule + a z-index scale token) that per-component CSS composes/extends, so the ~36 copies collapse to constant overrides only.

### B23. 'today' UTC-slice used only for export/filename timestamp stamps — likely benign, flag for owner confirmation not fix

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** date-math | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 6
- **Where:** lib/export/pdf.ts:209; lib/export/bracket-pdf.ts:144; lib/export/table.ts:41; app/api/platform-admin/audit/export/route.ts:81; app/api/platform-admin/feedback/export/route.ts:93; app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts:178,213
- **Evidence (finder):** Same `new Date().toISOString().slice(0,10)` idiom, but only used as a cosmetic 'Exported: YYYY-MM-DD' label or filename suffix on a download — not compared against another date, so a few hours of UTC skew doesn't change behavior, only the printed date near midnight ET.
- **Verification:** All 7 locations verified verbatim, each a cosmetic 'Exported: YYYY-MM-DD' label/filename suffix with no downstream comparison — matches the finding's own self-downgrade to benign/cosmetic.
- **Proposed action:** Low priority — no functional bug. Could still swap to tournamentToday() for label consistency with the rest of the platform, but this is cosmetic-only; note as gap rather than violation per the binding rule's intent (day-boundary comparisons, not labels).

### B24. ToolbarMenu has 2 adopters; ExportMenu.tsx independently reimplements the same viewport-clamped floating-menu math

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** duplicate | **Removal:** no (consolidation/hygiene)
- **Where:** components/admin/tournament/TournamentAdminUI.tsx:213-344; app/[orgSlug]/admin/tournaments/data-tools/page.tsx:414-448; components/admin/ExportMenu.tsx:127-211
- **Evidence (finder):** ToolbarMenu/ToolbarMenuItem/ToolbarMenuSeparator are exported from components/admin/tournament/index.ts and used in only 2 files (TournamentAdminUI.tsx itself + data-tools/page.tsx). components/admin/ExportMenu.tsx (127-211) independently implements the same category of logic: outside-click close (mousedown listener + ref.contains), Escape-to-close, and a getBoundingClientRect()-based viewport-clamped position:'fixed' menu placement algorithm (flip above/below, clamp width/height) — the same problem ToolbarMenu already solves, built twice.
- **Verification:** ToolbarMenu grep confirms exactly 2 adopters. ExportMenu.tsx:134-211 verified: mousedown outside-click close, Escape-close (204-211), getBoundingClientRect fixed-position viewport-clamped placement w/ flip-above-below (145-201) - same category of logic as TournamentAdminUI.tsx:245-297 (ToolbarMenu's own impl). No concurrent uncommitted changes.
- **Proposed action:** Evaluate whether ExportMenu's trigger+positioning shell can compose on top of ToolbarMenu (keeping ExportMenu's export-specific item contract), or document why the two must stay separate; architectural call, not mechanical.

### B25. No shared spinner utility; @keyframes spin + .spin copy-pasted verbatim across ≥7 platform-admin CSS modules

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** duplicate | **Removal:** yes | **~LOC/objects:** 25
- **Where:** app/platform-admin/plans/plans.module.css:170-171; app/platform-admin/stripe-prices/stripe-prices.module.css:233-234; app/platform-admin/bulk-operations/bulk-operations.module.css:451-457; app/platform-admin/change-requests/change-requests.module.css:386-390; app/platform-admin/dev-tools/dev.module.css:526-527; app/platform-admin/email-templates/email-templates.module.css:614-615; app/[orgSlug]/admin/tournaments/branding/branding.module.css
- **Evidence (finder):** `grep -rlE "@keyframes spin\b"` across project CSS (excluding node_modules) hits 8 files; app/globals.css has no such keyframe. plans.module.css:170 and stripe-prices.module.css:233 are identical: `@keyframes spin { to { transform: rotate(360deg); } }` / `.spin { animation: spin 0.8s linear infinite; }`, immediately preceded by an identical `.errorCell` block in both files — these two CSS modules appear to be literal copy-paste siblings.
- **Verification:** grep -rlE "@keyframes spin\b" *.css hits 10 live files, not 7: misses plans-pricing.module.css, discover/page.module.css, PushDeviceTester.module.css. globals.css lacks this keyframe (confirmed). All 10 sites LIVE: verified callsites styles.spin in PlansClient/StripePricesClient/BulkOperationsClient/ChangeRequestsClient/dev-tools/EmailTemplateEditor; styles.spinnerSm in DiscoverClient.tsx (public page); styles.spinIcon consumed cross-file from settings/event/page.tsx:1857. Not verbatim: change-requests.module.css .spin adds `color: var(--logic-lime)` (L392-395) absent elsewhere; branding.module.css keyframe uses from/to vs to-only; class names vary (.spin/.spinIcon/.spinnerSm).
- **Verifier notes:** Opportunity real (no shared Spinner utility exists) but undercounted (10 files not 7) and mis-scoped as platform-admin-only — spans a public consumer page + cross-imported admin settings module. Naive "delete the 7 dupes" drops change-requests' lime color override; needs per-file modifiers preserved, not one interchangeable .spin class.
- **Proposed action:** Hoist @keyframes spin + a .spin utility class into app/globals.css once; delete the 7+ duplicate copies and point call sites at the global class.

### B26. Percent-of-total money split with remainder correction duplicated 3x across 2 pages

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** altitude | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 25
- **Where:** app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/page.tsx:222-225; app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/page.tsx:247-249; app/[orgSlug]/admin/rep-teams/allocations/new/page.tsx:52
- **Evidence (finder):** Two near-identical blocks in the SAME file (budget/page.tsx): `const dollars = values.map(v => Math.round(total * v) / 100); const allButLast = dollars.slice(0,-1).reduce((s,v)=>s+v,0); dollars[dollars.length-1] = Math.round((total-allButLast)*100)/100;` repeated at line 247-249 for a %<->$ toggle. admin/rep-teams/allocations/new/page.tsx:52 does the same Math.round(total * v) / 100 conversion independently. No lib/ module owns 'split a total across N shares with rounding-remainder correction'; candidate: lib/money-split.ts exporting splitAmountWithRemainder(total, weights).
- **Verification:** Budget/page.tsx blocks (222-225, 247-249) share a real remainder-correction pattern, but 2nd is a more general bidirectional version w/ scale param, not identical. 3rd location (allocations/new:52) only reproduces the bare Math.round(total*v)/100 formula - no allButLast/remainder logic there (verified). True dup-algorithm count is 2, not 3; 'duplicated 3x' overstates it slightly.

### B27. 37 CSS modules define their own .badge/.chip/.pill; ≥4 platform-admin modules have byte-identical .badge rules

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 20
- **Where:** app/platform-admin/orgs/orgs.module.css:309-317; app/platform-admin/customer-users/customer-users.module.css:178-187; app/platform-admin/email/email.module.css; app/platform-admin/orgs/[id]/orgDetail.module.css; components/shared/FlipPill.tsx
- **Evidence (finder):** 37 module.css files define `^.badge|.chip|.pill`. orgs.module.css:309 and orgDetail.module.css both define `.badge { display:inline-block; font-size:0.55rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:0.2rem 0.5rem; border:1px solid; }` verbatim; customer-users.module.css differs only in padding (0.18rem 0.45rem) + white-space:nowrap; email.module.css adds font-family. The only existing shared pill (components/shared/FlipPill.tsx) is narrowly purpose-built (role-flip UI), not a general status badge.
- **Verification:** Dup confirmed verbatim: orgs.module.css:309-317 and orgDetail.module.css:803-811 .badge byte-identical; customer-users.module.css:178-187 differs only in padding+nowrap; email.module.css:189-198 adds font-family+smaller size. But headline overstated: grep for exact .badge/.chip/.pill defs returns 19 files not 37 (loosest substring match only reaches 42).
- **Proposed action:** Extract a shared platform-admin StatusBadge (or a `.badge` base rule in a shared platform-admin CSS module) covering the ≥4 near-identical definitions first; leave the other 33 (different surfaces/tones) for a broader pass.

### B28. BottomSheet.tsx primitive has 4 adopters; ~25 dialogs hand-roll the same Escape+scroll-lock+focus logic

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene)
- **Where:** components/admin/BottomSheet.tsx:1-92; components/rep-teams/TryoutAcceptDrawer.tsx:131; app/(consumer)/chat/ChatSafetySheet.tsx:51-122; components/chat/NewRoomDialog.tsx:37-67; components/FeedbackModal.tsx:37-80; components/chat/ChatManagePanel.tsx; components/coaches/StartNextSeasonModal.tsx; components/admin/TournamentSetupWizard.tsx
- **Evidence (finder):** BottomSheet.tsx's doc comment says it 'replaces the per-page sheet CSS currently duplicated ... those migrate onto this in a follow-up.' grep for role="dialog"/aria-modal finds ~29 non-doc files implementing their own dialog; grep for BottomSheet imports finds only 4 adopters (UnfollowConfirmSheet, FollowAccountNudge, CheckInBoard, ScheduleTimeline). Spot-checked TryoutAcceptDrawer/ChatSafetySheet/NewRoomDialog/FeedbackModal: each reimplements its own Escape handler, `document.body.style.overflow='hidden'` scroll-lock, backdrop+stopPropagation, and role=dialog/aria-modal wiring — including missing a documented focus-churn bugfix present only in BottomSheet.tsx:37-44.
- **Verification:** 4 BottomSheet importers + ~29 hand-rolled dialogs confirmed. Spot-check overstated: TryoutAcceptDrawer.tsx has NO Escape handler/scroll-lock (zero grep hits). FeedbackModal.tsx has no scroll-lock and already owns an equivalent focus-churn onCloseRef fix (lines 37-44) - not 'missing' it. Only ChatSafetySheet.tsx fully matches the claimed pattern.
- **Proposed action:** Migrate hand-rolled dialog/drawer/sheet components onto BottomSheet (or a centered-modal variant of it); prioritize ones missing the focus-churn fix or Escape handling first.

### B29. lib/teamBadge.ts duplicates lib/team-color.ts — 2 modules computing team initials + color from a name

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** duplicate | **Removal:** yes | **~LOC/objects:** 29
- **Where:** lib/teamBadge.ts:1-29; lib/team-color.ts:21-50; components/public/PublicBracketView.tsx:4; components/public/RaceToPlayoffsView.tsx:4; app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx:21
- **Evidence (finder):** lib/teamBadge.ts independently reimplements `teamInitials()` (near-identical to team-color.ts's) and `teamColorFromName()` using a fixed 12-color dark palette + different hash (hash*31+charCode), vs team-color.ts's HSL-hue hash used everywhere else (~30 files). teamBadge.ts is imported in only 3 files (PublicBracketView, RaceToPlayoffsView, roster page). Its fixed dark palette is incidentally contrast-safe for white text, but the module itself is a pure duplicate of functionality team-color.ts already provides.
- **Verification:** Read both files: genuine duplicate (hash*31+charCode vs HSL-hue hash; different initials rule - teamBadge=word[0]+word[1], team-color strips parens then word[0]+word[last], e.g. "Toronto Blue Jays" -> "TB" vs "TJ"). Grep confirms only the 3 cited call sites use teamBadge; ~30 files use team-color.ts. git grep teamBadge master shows PublicBracketView/RaceToPlayoffsView already ship on prod. git log: last touched 2026-06-02, not concurrent work. standings.module.css .podiumBadge/.bracketTeamBadge hardcode color:#fff; team-color.ts's own comment says its variable-lightness palette needs teamInk() since some hues fail WCAG AA on white - a swap needs added ink logic.
- **Verifier notes:** Duplication real, call sites correct, but "removal_candidate" undersells scope. Migrating changes live badge colours+initials on public bracket/race pages + coaches roster (prod-facing visual change), and 2/3 sites hardcode color:#fff so teamInk() must be added, not just an import swap. Elevated to owner-decision since it's product-visible on prod.
- **Proposed action:** Delete lib/teamBadge.ts; migrate its 3 call sites to lib/team-color.ts's teamColor()/teamInitials() + teamInk() for ink (also fixes the contrast gap above at those 3 sites).

### B30. TeamsContent.tsx defines its own local TeamAvatar, duplicating the shared components/TeamAvatar.tsx (1 other adopter)

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** duplicate | **Removal:** yes | **~LOC/objects:** 13
- **Where:** components/public/TeamsContent.tsx:60-72; components/TeamAvatar.tsx:1-47; components/TeamAvatar.module.css:1-15; app/[orgSlug]/admin/tournaments/registrations/page.tsx:30
- **Evidence (finder):** components/TeamAvatar.tsx is a documented shared 'identity chip' (comment: 'so admin lists share the exact identity the public site already uses') but is imported in only 1 file (registrations page). components/public/TeamsContent.tsx:60-72 defines a same-named local `TeamAvatar` function inline using teamColor()/teamInitials() directly with a different lightness (45% via teamColor() vs the shared component's hardcoded hsl(...,58%,38%)), so the two 'same identity' avatars can render different shades for the same team name.
- **Verification:** lib/team-color.ts: teamColor(name,sat=58,lightness=45) is the real canonical fn ("single source... schedule avatars, scorebug, dock, broadcast card, team-profile all agree"). Grep shows 35 files call teamColor/teamAvatarHue/teamInitials directly, incl ScheduleContent.tsx:934 & MyTeamDock.tsx:325, which inline avatar markup just like TeamsContent.tsx:60-72 — an established repeated pattern, not an isolated dup. components/TeamAvatar.tsx (1 adopter) hardcodes hsl(...,58%,38%) instead of calling teamColor(), so it's the drifted outlier vs the 45% default, not TeamsContent's fn. git log -8 TeamsContent.tsx: active recent commits (a1ede2e4, 91a26de3), not legacy.
- **Verifier notes:** Proposal is backwards: deleting TeamsContent's local avatar for components/TeamAvatar.tsx would shift public Teams-page lightness 45%→38% (visible regression) and still leave ScheduleContent/MyTeamDock un-consolidated. Real fix: patch components/TeamAvatar.tsx to call teamColor()/teamAvatarHue() instead of hardcoding.
- **Proposed action:** Delete the local TeamAvatar in TeamsContent.tsx; extend the shared components/TeamAvatar.tsx (already supports a `size` prop) to cover this call site instead.

### B31. No toast/snackbar primitive exists; ~15 files hand-roll their own inline Copied text-flash as the de facto substitute

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** other | **Removal:** no (consolidation/hygiene)
- **Where:** app/[orgSlug]/[tournamentSlug]/layout.tsx:210; app/[orgSlug]/admin/tournaments/staff-kit/page.tsx:38,68-72,132-133; app/[orgSlug]/admin/org/tournaments/page.tsx; app/platform-admin/users/CompanyUsersClient.tsx; app/platform-admin/customer-users/CustomerUsersClient.tsx
- **Evidence (finder):** grep for `toast|Toast` across .tsx finds exactly 1 hit, and it's a code comment ('top-anchored toasts') describing intended future layout, not an implementation. The recurring pattern is instead a per-file `[copied, setCopied] = useState<string|null>(null)` + `setTimeout(() => setCopied(...), 1800-2000)` that swaps a button's label/icon between Copy/Check — same shape reimplemented independently in staff-kit/page.tsx and ~15 other files.
- **Verification:** toast/Toast grep = exactly 1 hit (comment). staff-kit/page.tsx:38,68-72 accurate. But broader clipboard-copy search found only ~9-11 files, not '~15'. Cited location app/[orgSlug]/admin/org/tournaments/page.tsx has NO copy-feedback pattern (its Copy/copied hits are cloning-summary counts, unrelated) - false citation. Core claim survives but count overstated, one location wrong.
- **Proposed action:** Low severity as-is; if there's appetite, extract a 3-line useCopyFeedback() hook rather than building a full toast system — flag to product/design whether a real toast/snackbar is wanted before investing here.


## Workstream C — CSS + design-token debt

### C01. components/consumer/ConsumerPage.module.css is a fully orphaned file — zero importers anywhere

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 298
- **Where:** components/consumer/ConsumerPage.module.css
- **Evidence (finder):** git grep -rn "ConsumerPage" (whole repo, all file types) = zero hits: no ConsumerPage.tsx exists, nothing imports this .module.css. Header comment: 'Shared content styling for the consumer shell tabs (Scores / Following / Account)' — that role is now served by ScoresClient.module.css, FollowingList.module.css, account.module.css instead. All 34 selectors (.page/.header/.title/.card/.cardLogo/.livePill/.cta/.ctaGhost/.feedRight etc.) are dead; whole 298-line file removable.
- **Verification:** git grep "ConsumerPage" (dev,tracked) -> only hit: a memory doc; zero code refs. Ripgrep case-insensitive repo-wide (incl untracked) -> same single doc hit. Grepped consumer/*.module.css import/composes sites: every sibling (ConsumerShell, warmTheme, ScoresClient, FollowingList, AppearanceCard, HomePersonalization) has live importers; ConsumerPage.module.css has none. git show master:path -> absent on prod. git log --all -A -- '*ConsumerPage.tsx' -> component never existed; file was shared styling later split per-page. Commit 05aac00f (Jul20) already deleted 70 lines of same file as dead CSS via /simplify. Read full file: plain scoped rules, no :global().
- **Verifier notes:** Continuation of an already-accepted cleanup (same file had 70 lines removed as dead CSS in 05aac00f). Safe to delete whole 298-line file.

### C02. app/page.module.css carries ~43 dead selectors from a superseded homepage design

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 250
- **Where:** app/page.module.css:70; app/page.module.css:162; app/page.module.css:214; app/page.module.css:299; app/page.module.css:311; app/page.module.css:415; app/page.module.css:468; app/page.module.css:533
- **Evidence (finder):** Sole importer app/page.tsx (path-resolved, no composes). Live markup only uses .hero*, .features, .sectionHead/Title/Sub, .howItWorks, .stepsGrid, .pricing, .testimonials/.testimonialGrid, .ctaSection (38 styles.X hits total). 43 classes never appear as styles.X: heroContent/heroBadge/heroActions; featureGrid/Card/Icon/Title/Desc; pricingGrid/planCard/planHighlight/popularBadge/planName/Price/Amount/Period/Note/Divider/Features/Row; rowCheck/Cross/Muted; showcase*; personaRouting; statsBar*/statItem/Number/Label; step/stepNum/Icon/Title/Desc; testimonialCard/Quote/Author/Avatar/Name/Role — remnants of an old pricing-table+testimonials layout.
- **Verification:** Read page.module.css + page.tsx fully; only 25 classes used (hero*, features, sectionHead/eyebrow/Title/Sub, howItWorks, stepsGrid, pricing, testimonials, testimonialGrid, ctaSection/Bg/Sub/Title/Actions). No bracket-notation access. Other ~44 selectors absent from JSX. Repo grep: root page.module.css has exactly ONE importer (page.tsx); look-alike names in for-clubs/pricing/PricingSection.tsx import their OWN distinct sibling modules, verified. No composes: refs. heroContent's "legacy alias" comment (line 69) traces via git blame to 2026-05-25 - stale, no live pointer. No UAT/lib-email/sw.js hits. Last edits 2026-07-13(tsx)/2026-05-25(css) - not concurrent work.
- **Verifier notes:** Dead count matches claim (~44 vs ~43). Removal should also drop associated @media blocks (~605-661) for the same dead classes.

### C03. 51 dead selectors in schedule.module.css — orphaned mobile-filter-sheet + follow-bar subsystem

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 240
- **Where:** app/[orgSlug]/schedule/schedule.module.css:1143 (.followBar); app/[orgSlug]/schedule/schedule.module.css:1381 (.mobileFilterButton); app/[orgSlug]/schedule/schedule.module.css:1435 (.sheetLayer); app/[orgSlug]/schedule/schedule.module.css:1454 (.filterSheet); app/[orgSlug]/schedule/schedule.module.css:1797 (.noFollowPrompt); app/[orgSlug]/schedule/schedule.module.css (railStandingsHeader/Row/Pts/Pos/Name/Rec); app/[orgSlug]/schedule/schedule.module.css:1034 (.scoreChip / scorebugScoreDisplay); components/public/ScheduleContent.tsx (only consumer of `styles.follow*`)
- **Evidence (finder):** The only importer that touches follow-related classes, ScheduleContent.tsx, uses followedGameRow/followStarSlot/followStar/followedBroadcast/followQuickActions — NONE of which are the 51 flagged names (followBar/followMain/followActions/followedBadge/sheetLayer/filterSheet/sheetHandle/railStandings*/scoreChip/scorebugScoreDisplay/etc). Whole mobile-filter-sheet + old follow-bar UI reads as superseded by a redesign that renamed everything.
- **Verification:** Found all 5 real importers via `git grep -l "schedule.module.css" '*.tsx'`: ScheduleContent.tsx(styles), playoffs/page.tsx(liveStyles), schedule/[gameId]/page.tsx(styles), teams/[id]/page.tsx(scheduleStyles), PublicBracketView.tsx(liveStyles) — finder missed 4 but none use flagged classes. Scoped per-file-alias script (avoided false-positive: "styles" reused by unrelated modules in same files): 52/198 top-level classes dead, matching all named locations. CSS comments confirm supersession: "moved to MyTeamCard.module.css (2026-07-03)". Checked master(prod) ScheduleContent.tsx too — also never references these. No raw-string/:global/UAT/dynamic refs. git status clean, no concurrent WIP.
- **Verifier notes:** 5 dead names (scoreNumbers, scorebugScoreDisplay, scorebugNextTime, railScoreNum, railNextTime) share one comma-list rule (lines 3-14) with still-ALIVE selectors (.matchScore, .mobileScoreNum) — strip only those tokens, don't delete the whole block. Remaining ~47 names are standalone dead rules, safe for blanket deletion.

### C04. Entire select-org.module.css is orphaned — page.tsx is now a bare redirect stub

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 170
- **Where:** app/(consumer)/auth/select-org/select-org.module.css; app/(consumer)/auth/select-org/page.tsx:1-6
- **Evidence (finder):** page.tsx body is exactly: `export default async function SelectOrgCompatibilityPage(){ redirect(await getAuthDestination()); }` — no CSS import, no JSX. Repo-wide `grep -rlF select-org.module.css --include=*.tsx --include=*.ts` returns ZERO files. All 15 classes (container/header/iconWrap/title/sub/orgList/orgItem/orgInfo/orgNameRow/orgName/planBadge/roleMeta/roleHighlight/enterBtn/footer, ~170 lines) are dead.
- **Verification:** Read page.tsx: 6 lines, no CSS import, just redirect(). Grep -rlF 'select-org.module.css' repo-wide = zero files. Grep 'select-org\.module' = zero files. Grep styles.container/orgList/iconWrap etc in the dir = zero matches. git log shows last touch = 0a69bebe (2026-07-14, 10 days ago, not concurrent). Checked master: git show master:app/auth/select-org/page.tsx = identical bare-redirect stub; git ls-tree master confirms select-org.module.css exists there too, unused - dead on prod as well, not a dev-in-progress artifact.
- **Verifier notes:** Safe to delete. Identical dead CSS also exists on master/prod; cleanup there is a release-manager call, not blocking this dev removal.

### C05. 28 dead selectors in onboarding.module.css — superseded optional-steps/plan-selection/venue design

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 150
- **Where:** app/[orgSlug]/admin/onboarding/onboarding.module.css:103 (.optionalGroup); app/[orgSlug]/admin/onboarding/onboarding.module.css:722 (.venueCard); app/[orgSlug]/admin/onboarding/onboarding.module.css:955 (.billingToggle); app/[orgSlug]/admin/onboarding/onboarding.module.css:986 (.planCard)
- **Evidence (finder):** Only importer is onboarding/page.tsx; zero refs to optionalGroup/optionalHeader/optionalStep*/stepSkipped/skippedPill/splitActions/skipBtn/venueInlineRow/venueCardGrid/venueCard/venueCardHeader/activatePanel/planStepPanel/planStepIcon/planStepCopy/billingToggle/toggleOption/toggleActive/planGrid/planCard*/planFeatureList/planButton (28 classes) — reads as a whole wizard step (optional steps + venue + plan-selection) that was reworked, leaving the old CSS behind.
- **Verification:** Read full page.tsx (only importer, confirmed via grep on dev + git grep on master). Grepped page.tsx for all 28 classes + styles[`...`] dynamic patterns: zero matches, dev and master alike. Current venue step uses venueComposer/venueSummaryRow* (recent commits 2a5718d0/958e3dc2/10ed79b7 reworked this step). Current plan step renders via <PricingSection> (styles.planStage/planModal), not dead planGrid/planCard/billingToggle. No composes:/relevant :global(). Repo-wide hits are same-named classes in unrelated scoped CSS Modules (billing/PricingSection/venues-admin/TournamentSetupWizard/for-*) - expected false positives. File clean vs HEAD.
- **Verifier notes:** Recent venue-step redesign commits directly corroborate "superseded" narrative. Sibling planCard* classes (Current/Header/Price/Tagline) also show zero refs - likely whole planCard* family here is dead, not just the 4 cited; verify each sibling so cleanup matches true dead surface.

### C06. 18 dead selectors in dashboard.module.css — same superseded registration-attention-panel cluster

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 70
- **Where:** app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:1168 (.registrationAttentionPanel); app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:1173 (.attentionTotalRow); app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:1196 (.attentionList); app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:1457 (.statusChipMobile); app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:1821 (.resetBtn)
- **Evidence (finder):** Only importer is dashboard/page.tsx; zero references to registrationOverview/registrationHeadline*/registrationAttentionPanel/attentionTotal*/attentionList/attentionItem*/statusChipMobile/statusDot/statusChipSub/resetBtn (18 classes). Sibling of the teams-admin.module.css finding — same superseded attention-panel design.
- **Verification:** Read CSS lines 730-1290/1450-1475/1815-1845: confirmed all 18 classnames exist. Sole importer of dashboard.module.css is page.tsx (git grep on dev AND master both confirm one importer). Grepped all 18 names in page.tsx: zero matches; page.tsx uses only static styles.foo dot-access, no bracket/dynamic/clsx access. No `composes:` in the CSS. Repo-wide grep (dev) for all names: zero hits. git grep on master: hits only same-named classes in unrelated scoped CSS modules (discover.module.css, EmailTemplateEditor, platform-admin orgs page) — not this file. git log -8 on both files shows only unrelated recent commits.
- **Verifier notes:** Matches finder's claim exactly — same superseded attention-panel design as sibling teams-admin.module.css finding. Safe mechanical CSS-only removal.

### C07. 16 dead selectors in rep-teams.module.css (add-event menu, score-section, delete-confirm clusters)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 65
- **Where:** app/[orgSlug]/admin/rep-teams/rep-teams.module.css:824 (.addEventWrap); app/[orgSlug]/admin/rep-teams/rep-teams.module.css:1031 (.scoreSection); app/[orgSlug]/admin/rep-teams/rep-teams.module.css:1040 (.deleteConfirm); app/[orgSlug]/admin/rep-teams/rep-teams.module.css:1072 (.btnDanger)
- **Evidence (finder):** Zero refs across all 18 importers: addEventWrap, addEventMenu, addEventMenuItem, eventChipResult, slideOverActions, scoreSection, scoreDisplay, scoreNum, scoreSep, resultBadge, scoreForm, scoreFormRow, deleteConfirm, deleteConfirmMsg, deleteConfirmBtns, btnDanger.
- **Verification:** Re-grepped all 16 selectors across all 18 .tsx importers of rep-teams.module.css: zero live refs, only CSS defs. btnPrimary/Secondary/Ghost (same block, excluded by finder) ARE used elsewhere - finder is precise. git grep master shows same dead block on prod too. git log --follow on the sole consumer (admin schedule page.tsx): started as 576-line full CRUD (2953819e), deliberately stripped in 0406d42e (Remove event creation POST - coaches portal is the write path). Current events route.ts exports GET only. Identical block IS wired in coaches.module.css + coaches schedule page.tsx (separate module) - not a ref into rep-teams.module.css. No recent CSS activity; no plan to restore admin CRUD.
- **Verifier notes:** Traceable to a deliberate documented 2026-05-11 decision (admin schedule=read-only, coaches own writes), not accidental drift. Finder correctly excluded btnPrimary/Secondary/Ghost from same block since those are still used elsewhere. Safe to delete the 16 selectors.

### C08. 13 dead selectors in branding.module.css (4 cardThumb_* names are dynamic false-positives, excluded)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 55
- **Where:** app/[orgSlug]/admin/tournaments/branding/branding.module.css:121 (.advancedTitle); app/[orgSlug]/admin/tournaments/branding/branding.module.css:203 (.toggleRow); app/[orgSlug]/admin/tournaments/branding/branding.module.css:739 (.customColorBtn); app/[orgSlug]/admin/tournaments/branding/branding.module.css:1068 (.confirmBanner)
- **Evidence (finder):** 13 classes dead across all 3 importers: advancedTitle, lockedAdvanced, toggleRow, toggleRowDisabled, toggleLabel, swatchLocked, swatchLockIcon, upgradeNote, customColorBtn, customColorBtnActive, customColorSwatch, confirmBanner, tieBreakerRow. NOTE: cardThumb_default/glass/outlined/flat (initially flagged) are FALSE POSITIVES — used via `styles[\`cardThumb_${key}\`]` at branding/page.tsx:859 — excluded here.
- **Verification:** Only 3 importers of branding.module.css exist repo-wide (dev + master, via git grep). Grepped all 13 flagged names against those files: zero matches. Only dynamic-key pattern is cardThumb_ (already excluded). 5 unrelated files with similar literal names each use their own separate CSS module, confirmed via import lines. No composes: reuse found. Master (prod) tree shows identical zero-usage. Git blame: last touches were 2026-07-21 value-only token swaps; advancedTitle added 2026-05-16 — no recent live-usage addition. Cited line numbers match file exactly.
- **Verifier notes:** All 13 are genuinely zero-reference, consistent across dev and prod (master). CSS Module classnames only reachable via the 3 known importers' styles object, both confirmed clean. No DB/runtime/prod-only angle for a pure admin CSS module.

### C09. 13 dead invite/confirm-panel + orb-bg classes in startForm.module.css

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 45
- **Where:** app/(consumer)/start/startForm.module.css (bg/orb1/orb2); app/(consumer)/start/startForm.module.css (invitePanel/inviteOrg/inviteRole/inviteBody); app/(consumer)/start/startForm.module.css (inviteSent/inlineNotice/linkMuted); app/(consumer)/start/startForm.module.css (confirmBox/confirmActions/btnGhost)
- **Evidence (finder):** 13 classes with zero `authStyles.X` (or bracket) references across all 3 importers (StartLeagueForm.tsx, StartTeamForm.tsx, AddOrgForm.tsx): bg, orb1, orb2, invitePanel, inviteOrg, inviteRole, inviteBody, inviteSent, inlineNotice, linkMuted, confirmBox, confirmActions, btnGhost.
- **Verification:** Read full startForm.module.css + all 3 importers - none reference the 13 classes. `from '.*startForm` grep confirms these 3 files are the ONLY importers repo-wide. git log -p: all 13 classes came from one commit (50c09ab5, 07-21) that wholesale-copied auth.module.css; never wired into JSX. Sibling classes ARE live in auth.module.css/auth/signup/page.tsx, but SIGNUP_INVITE_GUARD_PLAN.md (read fully) scopes only to that file; its /start-family touch is a redirect, no UI classes. Other active docs: zero mentions. git status clean on start dir (no concurrent work). File absent from master. Broader grep hits = unrelated same-named classes in other CSS modules.
- **Verifier notes:** Not dormant-by-design: the plan behind the live auth.module.css sibling classes never touched startForm.module.css. Genuinely dead, added 3 days ago via copy-paste, never wired up. Safe to delete the 13-class block.

### C10. 9 dead selectors in Home.module.css (championsHero/quickGame cluster)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 35
- **Where:** app/[orgSlug]/Home.module.css:201 (.heroAccent); app/[orgSlug]/Home.module.css:459 (.championsHero); app/[orgSlug]/Home.module.css:555 (.quickGameRow)
- **Evidence (finder):** Zero refs across all 3 importers (page.tsx, MyTournamentCard.tsx, TournamentHomeContent.tsx): quickGameTime, heroAccent, championsHero, championsHeroBadge, championsHeroHost, venueShortcutList, quickGameRow, quickGameTeams, quickGameMeta.
- **Verification:** Grepped all 9 selectors repo-wide in *.tsx: zero JSX usage. Home.module.css importers are only page.tsx/MyTournamentCard.tsx/TournamentHomeContent.tsx; other files' heroAccent hits are unrelated own module.css. git log -S: championsHero* added 6cadc88e (07-05), replaced by .championSection cluster in 3d6907c3 (07-06, wired L654+). quickGameRow/Teams/Meta/Time replaced by .finalRow (L613, via renderFinalRow); venueShortcutList folded into .statusItem (L624). Neither commit is on master - no prod reliance. No UAT selector refs. No dynamic styles[...]. git status clean, no concurrent WIP. No dormant-by-design note.
- **Verifier notes:** venueShortcutList and quickGameTime are each one token inside a comma-list shared with live selectors - remove just that token, not the whole rule. The other 7 are standalone dead blocks safe to delete outright.

### C11. TryoutDayCard.module.css: dead two-way blind-toggle UI, replaced by one-way reveal

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 35
- **Where:** components/rep-teams/TryoutDayCard.module.css:36; components/rep-teams/TryoutDayCard.module.css:52; components/rep-teams/TryoutDayCard.module.css:61; components/rep-teams/TryoutDayCard.module.css:62
- **Evidence (finder):** 4 selectors (.blindToggle L36-51, .switch L52-60, .switchOn L61, .knob L62-69, nested .switchOn .knob L70) have zero styles.X refs across all 5 importer .tsx files (grep confirms no matches). File comments show the history: L35 'Blind toggle (sibling of the Registration toggle)', L77 'One-way reveal (replaces the two-way blind toggle)' — .revealBtn/.revealedChip are the live replacement classes.
- **Verification:** Read full CSS + grepped all 5 importers for styles.blindToggle/switch/knob/switchOn incl bracket-access - zero hits. Broad repo grep for '.switch'/'.switchOn'/'.knob' hit FanNotificationBell.tsx and TryoutAcceptDrawer.tsx, but each imports its OWN separate CSS Module with independently-scoped duplicate class names (FanNotificationBell.module.css comments 'local pattern, references the tryout .switch/.switchOn idiom' = deliberate copy, not shared import). CSS Modules scope locally. blindHint IS used (TryoutDayCard.tsx:216); blindToggle/switch/switchOn/knob are not. git log -8 shows no revival. git cat-file -e master:...TryoutDayCard.module.css confirms component is dev-only, not on prod.
- **Verifier notes:** Also dead but outside the finding's line range: warm-theme override rules at lines 369-374 (:global(...) .switch/.switchOn) style the same dead toggle - remove together for a complete cleanup.

### C12. 7 dead credential-box selectors in dev.module.css (readiness* excluded — confirmed dynamic)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 30
- **Where:** app/platform-admin/dev-tools/dev.module.css:57 (.credBox); app/platform-admin/dev-tools/dev.module.css:82 (.credGrid)
- **Evidence (finder):** credBox, credLabel, credGrid, credRow, credEmail, credRole, credOrg — zero refs in dev-tools/page.tsx. NOTE: readinesspass/readinesswarn/readinessfail (initially flagged) are FALSE POSITIVES — used via `styles[\`readiness${item.status}\`]` at page.tsx:704 — excluded here.
- **Verification:** Grep for the 7 selectors repo-wide: hits only in dev.module.css itself. page.tsx's credentials UI is a separate LiveCredentials component using distinct classes (credPills/credDetail*/credEmpty/liveCredBox) which are used. No other file imports dev.module.css. Checked master (prod): same 9 dead lines exist there too, and prod page.tsx also only uses the distinct set - dead on both dev and prod, not just dev-ahead. No dynamic styles[`cred${x}`] construction. git log shows only unrelated commits.
- **Verifier notes:** Two extra compound lines (.credLabel code, .credOrg code) belong to same dead block, matches finder's est_loc 30.

### C13. 7 dead selectors in help.module.css (helpSections/helpNoResults cluster)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 25
- **Where:** components/help/help.module.css:817 (.helpNoResults); components/help/help.module.css:871 (.helpSections)
- **Evidence (finder):** Zero refs across all 9 importers (HelpHubClient, HelpDrawer, HelpButton, HelpCallout, HelpTooltip, HelpSectionBlock, HelpPageLayout, FieldHint, admin/help/page.tsx): helpNoResults, helpUtilityTitle, helpSectionHeader, helpSectionGroup, helpSectionHeading, helpSectionSummary, helpSections.
- **Verification:** Grepped all 7 names repo-wide: only hits = the CSS file + prose in HELP_SYSTEM_REDESIGN_PLAN.md, not code. Same via git grep master - not prod-only-live. Checked all 8 importers of help.module.css for styles.help* usage: none use these 7 names; HelpSectionBlock uses similarly-named but distinct live classes (helpSectionLinks/Link/Content), likely source of near-miss. No hits in tests/. git blame: lines last touched 2026-06-17, 5+ weeks old; git status clean on file. CSS's 'kept for backward compat' comments are unverified hedges: HelpHubClient's actual label class is helpHubSectionLabel, not helpUtilityTitle/helpSectionHeader.
- **Verifier notes:** Minor: 7 selectors+comments span ~817-875 (~50 lines), roughly double claimed est_loc 25. Doesn't affect verdict.

### C14. divisionStats/poolSearch dead in house-league.module.css

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 8
- **Where:** app/[orgSlug]/admin/house-league/house-league.module.css:312 (.divisionStats); app/[orgSlug]/admin/house-league/house-league.module.css:671 (.poolSearch)
- **Evidence (finder):** Zero refs across all 8 house-league importers (page + 7 season sub-pages).
- **Verification:** Confirmed both rules at cited lines. Confirmed exactly 8 .tsx importers via glob — no other component uses this module. Grep `divisionStats` repo-wide: only other hit is unrelated same-named class in tournaments/summary/summary.module.css (separate, used there). Grep `poolSearch`: zero hits outside its own 2 CSS lines. Checked all 8 importers for styles[`...`] dynamic class construction: none found. git grep on master (prod): same result, only CSS defs. git log -3 + diffed: last touch was pure token-var substitution, no new usage. Grepped tests/uat: no matches. Not a Next convention/SW/cron/email/platform-admin/seed/DB object.
- **Verifier notes:** Don't confuse with the unrelated, actively-used .divisionStats in tournaments/summary/summary.module.css — same class name, different module, not dead.

### C15. header/grid dead in orgDetail.module.css

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 8
- **Where:** app/platform-admin/orgs/[id]/orgDetail.module.css:19 (.header); app/platform-admin/orgs/[id]/orgDetail.module.css:325 (.grid)
- **Evidence (finder):** Zero refs to `styles.header`/`styles.grid` in OrgDetailClient.tsx or page.tsx. Generic names double-checked for computed/dynamic bracket access — none found.
- **Verification:** Read css lines 1-40 & 310-340: .header(19-26)/.grid(325-329) defined once each, no `composes` in file. Grep `styles\.(header|grid)\b` in app/platform-admin/orgs/[id]/ = 0 hits. Grep `styles\[` (dynamic access) = 0 hits. Full styles.* scan of OrgDetailClient.tsx(306) & page.tsx uses accountHero/heroActions/workflowGrid/sectionHeader etc, never bare header/grid; "header" hits in OrgDetailClient are all fetch `headers:` (false positive, excluded). Only 2 importers repo-wide (page.tsx, OrgDetailClient.tsx). git show master (prod tree) of both files: also 0 references — dead on prod too, not a dev regression. git log shows last touches are unrelated polish/token-sweep commits.
- **Verifier notes:** Clean removal: delete .header (lines ~19-26) and .grid (~325-329). Zero behavior risk on dev or prod.

### C16. 5 unused Tailwind 'Semantic FL alias' colors in tailwind.config.ts (fl-bg/fl-surface/fl-border/fl-accent/fl-muted)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** tailwind | **Removal:** yes | **~LOC/objects:** 6
- **Where:** tailwind.config.ts:23-28
- **Evidence (finder):** tailwind.config.ts:24-28 defines `'fl-bg':'#0A0A0A'`, `'fl-surface':'#111827'`, `'fl-border':'#1E3A8A'`, `'fl-accent':'#D9F99D'`, `'fl-muted':'#94A3B8'` under a "components only" comment. `grep -rn "fl-bg\|fl-surface\|fl-border\|fl-accent\|fl-muted" **/*.tsx` returns ZERO matches repo-wide — no Tailwind class (bg-fl-surface, text-fl-accent, etc.) ever consumes them. Distinct from the CSS custom-property --fl-surface ghost token (already resolved).
- **Verification:** Read config.ts:23-29. Sibling fl-text correctly excluded by finder (text-fl-text is live). Word-boundary greps for fl-bg/fl-surface/fl-border/fl-accent/fl-muted repo-wide: each hits only its own def line, zero class usage. fl-surface doc hits = separate --fl-surface CSS-var ghost token, already tracked, not this color. git grep master excl config: zero hits. Dynamic-construction grep: only false-positive fl-follow-change (channel name). git log: last edit 2026-07-21 deleted a different unused entry in same file as precedent; this block untouched since intro in 08ca5cbd (2026-05-04). Tailwind JIT emits CSS only for classes in content, so removal is a no-op.
- **Verifier notes:** Sibling fl-text in same block IS live - don't expand removal to include it.

### C17. Dead .bg/.orb1/.orb2 (display:none legacy orb-bg) in auth.module.css

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 3
- **Where:** app/(consumer)/auth/auth.module.css:12; app/(consumer)/auth/auth.module.css:13; app/(consumer)/auth/auth.module.css:14
- **Evidence (finder):** `.bg{display:none} .orb1{display:none} .orb2{display:none}` — grepped all 12 importers (login/signup/forgot-password/reset-confirm/reset-password/signup-confirm/accept-invite/accept-assistant-invite/suspended/layout/coaches-join pages) for `styles.bg`, `styles.orb1`, `styles.orb2`, `styles['bg']` etc: zero hits.
- **Verification:** Read file: lines 11-14 = `.bg/.orb1/.orb2{display:none}` under "Legacy orb divs neutralized". Grepped all 11 real importers plus repo-wide styles.bg/orb1/orb2 and bracket-access across all *.tsx/*.ts: zero hits anywhere. Unrelated orb1/orb2 hits elsewhere (Home.module.css, TournamentHomeContent.tsx, startForm.module.css) are separately-scoped CSS modules. Checked master (prod): identical dead file at app/auth/auth.module.css, same zero-usage there too - dead on prod, not just dev. git log: neutralization traces to old commit 758a8937, pre-dating the (consumer) rename; only recent touch (0a69bebe) was unrelated. UAT "orb" hits are false positives in bundled trace-viewer assets.
- **Verifier notes:** Verified independently, not just trusting finder's grep. Straightforward 3-line CSS deletion, zero runtime risk, confirmed dead on dev and prod.

### C18. Dead CSS custom property --bg-raised (defined 3x, zero consumers)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 3
- **Where:** app/globals.css:16; app/globals.css:192; app/globals.css:485
- **Evidence (finder):** Boundary-safe regex scan for `var(\s*--bg-raised(?![a-zA-Z0-9-])` across all .css/.tsx/.ts/.js/.jsx in the repo returns zero matches. The only hit for the string anywhere is a Markdown plan doc (docs/projects/archive/TOURNAMENT_SECTION_REVIEW_PLAN.md:137-238), which describes an *aspirational* design-consistency pass ('added missing global aliases for var(--bg-surface), var(--bg-raised)...') that was never actually wired into real CSS/TSX. Token is maintained in dark :root (line 16, #141D2B), light override (line 192, #FFFFFF), and the warm home-remap gate (line 485, var(--home-card)) but has no live consumer in any of the three themes.
- **Verification:** Literal grep `bg-raised` (broader than var()-only) across .ts/.tsx/.js/.jsx/.css/.mjs: only hits = 3 defs in app/globals.css (16,192,485) + non-runtime docs (archived plan, static prototype HTML). Checked lib/public-tournament-theme.ts (named light-token authority) for bg-raised/getPropertyValue/setProperty - none. Case-insensitive `raised` sweep in .ts/.tsx: only unrelated fundraiser hits. Prod: `git grep bg-raised master` - same, zero consumers (2 def sites, no warm-gate). git blame: def added 2026-05-23, warm-gate line added 2026-07-22 in landed theme-sweep, no consumer wired. git log -3 -p globals.css: no recent edits beyond that sweep.
- **Verifier notes:** Remove all 3 sites together (16/192/485) - one token kept in lockstep dark/light/warm per 2026-07-22 sweep; removing a subset breaks that parity pattern. Archived plan (DESIGN-01) shows intent as distinct 'raised card' tier vs --bg-surface, abandoned mid-plan rather than never-conceived.

### C19. Dead CSS custom property --info-strong (re-declared in all 3 theme blocks incl. warm gate, zero consumers)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 3
- **Where:** app/globals.css:90; app/globals.css:418; app/globals.css:557; memory/design_decisions.md:13-16
- **Evidence (finder):** Boundary-safe scan for `var(--info-strong` returns 0 matches anywhere in .css/.tsx/.ts. Sibling tokens --success-strong, --warning-strong, --danger-strong follow the identical 3-block pattern (base :root line 87-89, light override 415-417, warm-gate re-declaration 554-556) and ARE consumed by their own components -- --info-strong is the one member of that family with zero real usage. memory/design_decisions.md's 2026-07-23 'frozen-alias gotcha' entry documents the team deliberately re-declaring the --*-strong family (incl. --info-strong) inside the warm gate to fix a legibility bug, i.e. effort was spent maintaining a token line that has no consumer.
- **Verification:** Confirmed declarations at globals.css:90/418/557. Repo-wide grep "info-strong" (all extensions) hits ONLY these + prose in design_decisions.md/archive doc - zero code consumers. Siblings (--danger/--success/--warning-strong) ARE consumed (LogicSyncBracket.tsx ternary has no 'info' branch; TeamHQ/standings/schedule/ChampionsRecap use the other three). .next build cache: same, declarations only. Prod (master): whole --*-strong family absent, dev-only work, so prod-usage trap moot. git log: last touch 78abc845 (2026-07-23), memory says deliberate symmetry fix not a stub. No dynamic var-name construction found. Base --info token used elsewhere; only "-strong" variant orphaned.
- **Verifier notes:** Removal shape matches finding: delete the 3 lines only, siblings untouched, no visual change expected. Re-verify line numbers before deleting since concurrent sessions are actively editing this file.

### C20. app/pricing/page.module.css: .catLabel selector unused

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 3
- **Where:** app/pricing/page.module.css:348
- **Evidence (finder):** `.catLabel { color: var(--logic-lime); }` at L348. grep -rn catLabel across app/pricing/page.module.css, app/pricing/page.tsx, app/pricing/ComparisonTable.tsx (its only 2 importers) finds only the CSS definition — zero className refs in either .tsx.
- **Verification:** Repo-wide grep `catLabel`: 3 hits. Def at page.module.css:348; other 2 in unrelated tryout-score module (own scope). Only importers of pricing/page.module.css: ComparisonTable.tsx, page.tsx (git grep confirmed). Read ComparisonTable.tsx:146-168: sibling classes catRow/catToggle/catChevron/catChevronOpen ARE used, but cat.label is bare text inside <button className={styles.catToggle}> (L168), no span for catLabel. No dynamic class building found. `git grep catLabel master` shows same orphan on prod tree too. git log -5 shows old feature commits, not concurrent WIP.
- **Verifier notes:** Dead on both dev and prod. Pure 3-line CSS deletion, zero runtime risk.

### C21. Dead CSS custom property --black-10 (alpha-scale rung with zero consumers; siblings -20/-30/-40 ARE used)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 2
- **Where:** app/globals.css:65; lib/public-tournament-theme.ts:44; app/[orgSlug]/admin/tournaments/summary/summary.module.css:110
- **Evidence (finder):** grep -rn for `var(--black-10` (boundary-safe) across .css/.tsx/.ts finds 0 hits, vs. --black-20 (6 consumer files: admin-common.module.css, onboarding.module.css, tournaments-admin.module.css, teams-admin.module.css, RulesAdmin.tsx, TournamentSetupWizard.module.css), --black-30 (2 files) and --black-40 (1 file) which ARE consumed. summary.module.css:110 has an explicit code comment confirming awareness: 'only --black-10..40 exist' -- but --black-10 itself is the one rung nobody reaches for. Also re-declared in lib/public-tournament-theme.ts:44 (public tournament light-theme override, rgba(15,17,35,0.03)) with the same zero-consumer status.
- **Verification:** grep "black-10" across all *.css/*.ts/*.tsx (excl .next/node_modules): exactly 3 hits = globals.css:65 (decl), public-tournament-theme.ts:44 (decl), summary.module.css:110-111 (comment, not usage). Zero `var(--black-10` consumers vs black-20/30/40 which have 4-8 real consumer files. Confirmed RulesAdmin.tsx uses only --black-20. All 12 traps checked: N/A for Next-convention/server-action/cron/DB; zero hits in email templates, platform-admin, scripts, UAT, sw.js, offline.html. `git grep black-10 master`: prod has only 2 declarations, zero consumers - dead on prod too. Commit 78abc845 (1 day prior) touched same files but diff shows only --text-*/-strong aliases edited, not --black-10.
- **Verifier notes:** Two declarations to remove: globals.css:65 and public-tournament-theme.ts:44, matching finder's proposed shape. summary.module.css:110-111 is a comment referencing the family generically; not itself dead code, can stay or be trivially reworded.

### C22. Dead CSS custom property --home-rust-rgb (Stage 3 warm-palette RGB companion, zero consumers)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 1
- **Where:** app/globals.css:572
- **Evidence (finder):** --home-rust (line 571, #B45309) IS consumed (app/globals.css:577 --evt-external-tournament: var(--home-rust)), but --home-rust-rgb (line 572, '180, 83, 9') has zero `var(--home-rust-rgb` hits anywhere in .css/.tsx/.ts, same pattern/outlier status as --home-plum-rgb above -- both were added together as 'money category accents' but only the flat-color variant of each ended up wired to a consumer, never the rgba-alpha variant.
- **Verification:** Read globals.css:566-587. Repo-wide grep "home-rust-rgb": only hit is its own definition (line 572), zero var() consumers. Grep "home-rust" (no -rgb): flat --home-rust has 3 real consumers, none use -rgb. Cross-checked sibling tokens olive/live/amber/blue/win/line/paper/lime -rgb: each has real rgba(var()) consumers in multiple files; only rust/plum have none. git log -S"home-rust-rgb" = single introducing commit a2b6d90e, never consumed after. git grep "rust-rgb" master = empty (absent from prod tree). No design_decisions.md or build-prompt entry requires the -rgb variant.
- **Verifier notes:** Sibling --home-plum-rgb (line 570), same commit/pattern, is equally zero-consumer - handle together for consistency.

### C23. Two orphaned CSS modules surfaced incidentally by the scope-gap scan (not scope issues)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes
- **Where:** app/Home.module.css; components/Footer.module.css
- **Evidence (finder):** app/Home.module.css (top-level, 7.8KB, last modified Jun 7) is a DIFFERENT file from the properly public-scoped app/[orgSlug]/Home.module.css (39KB) — grep across all *.ts/*.tsx/*.css finds zero imports of the top-level one. (Note: .public-token-baseline.json's key 'app/[orgSlug]/Home.module.css':2 refers to the correctly-scoped file and is unrelated pre-existing drift, not evidence for this one.) components/Footer.module.css (hex0/rgba1) is never imported by components/Footer.tsx, confirmed by full read — Footer.tsx renders entirely with Tailwind utility classNames (bg-pitch-black, text-logic-lime, etc).
- **Verification:** grep -rn "Home.module.css"/"Footer.module.css" repo-wide (excl node_modules/.next): only hits import the DIFFERENT app/[orgSlug]/Home.module.css (page.tsx, MyTournamentCard.tsx, TournamentHomeContent.tsx); zero hits for components/Footer.module.css. Read full Footer.tsx (105 lines, mtime Jul 20): pure Tailwind classNames, no CSS-module import. git log -8 on both orphans: last touch old commits e936a582/84c8de18, no recent activity. Checked master: both files exist, git diff master HEAD empty (identical), master imports also point only at org-scoped file. Token baseline keys only the org-scoped file. No hits in scripts/, public/, lib/.
- **Verifier notes:** No trap applies: not a convention file, no dynamic import, no server-action/cron/email/platform-admin/UAT/DB reference, no recent git activity, prod (master) shows same dead state so not a concurrent-session in-progress wiring. Safe to delete as proposed.
- **Proposed action:** Delete both orphaned files after a fresh repo-wide import grep immediately before deletion (this was a spot-check, not exhaustive). Out of scope for the token-ratchet extension itself — surfaced as a byproduct of the scan.

### C24. public.dirs misses parent-facing registration/UI atoms homed outside components/public/

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** css-scope-gap | **Removal:** no (consolidation/hygiene)
- **Where:** components/rep-teams/register.module.css; components/league/register.module.css; components/YearSelector.module.css
- **Evidence (finder):** register.module.css files back TryoutRegisterForm.tsx and league/RegisterForm.tsx, each rendered ONLY at app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/register/page.tsx and app/[orgSlug]/league/[seasonSlug]/register/page.tsx — both inside the public scope's own app/[orgSlug] tree, just the CSS module physically sits in a sibling components/ dir instead of components/public/. Counts: rep-teams/register hex12/rgba19, league/register hex14/rgba34. components/YearSelector.module.css is imported only by components/public/{TeamsContent,StandingsContent,ScheduleContent}.tsx (rgba1) — same pattern, smaller.
- **Verification:** All 3 files exist; exact recount matches (register rep-teams hex12/rgba19, league hex14/rgba34, YearSelector rgba1). TryoutRegisterForm/league RegisterForm confirmed rendered only inside app/[orgSlug] public routes. Unambiguous single-scope usage, mirrors existing cherry-pick pattern — lower risk than typical judgment call.
- **Proposed action:** Add files entries to SCOPES.public: components/rep-teams/register.module.css, components/league/register.module.css, components/YearSelector.module.css (mirrors existing Navbar/ConsumerShell cherry-pick pattern). --init after adding.

### C25. New global error/not-found stylesheet app/system-screens.module.css is outside both scopes

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** css-scope-gap | **Removal:** no (consolidation/hygiene)
- **Where:** app/system-screens.module.css
- **Evidence (finder):** Untracked file (git status: ?? app/system-screens.module.css), imported by both app/error.tsx and app/not-found.tsx — true root-level chrome rendered regardless of which surface a user is on. Currently rgba=1, hex=0, but has zero ratchet coverage from day one since it's a brand-new file sitting directly under app/, matching neither public.dirs, operator.dirs, nor public.files/operator.files.
- **Verification:** File exists (untracked, 53 lines), imported by app/error.tsx:7 and app/not-found.tsx:3. Matches neither public scope (dirs app/[orgSlug], components/public; files Navbar/ConsumerShell) nor operator scope in check-public-tokens.mjs. Content: exactly 1 rgba(), 0 hex literals, matching rgba=1/hex=0.
- **Proposed action:** Add 'app/system-screens.module.css' to both public.files and operator.files (or the new shared/global bucket from the cross-cutting finding) before it accumulates literal-color debt unseen. --init once added.

### C26. --fl-surface CSS custom property is a fully-resolved ghost token (0 definitions, 0 consumers)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-flag | **Removal:** no (consolidation/hygiene)
- **Where:** docs/projects/archive/OPERATOR_TOKEN_JUDGMENT_TRANCHE_PLAN.md:81; app/platform-admin/customer-users/customer-users.module.css:1
- **Evidence (finder):** `grep -rn -- "--fl-surface" **/*.css` returns zero hits repo-wide. The plan doc confirms it was already replaced: customer-users.module.css:1 now defines `--cu-surface: #1a1a1a` (was `var(--fl-surface,#1a1a1a)`). No action needed — reported per the workstream C brief which named this token; confirms the P3-era fix is complete and nothing remains to remove.
- **Verification:** grep -- '--fl-surface' repo-wide: only doc mentions, zero CSS/TSX hits. customer-users.module.css:1 confirmed: '.page { max-width: 1300px; --cu-surface: #1a1a1a; }', matching plan doc line 81 exactly. Already-resolved, no action needed as reported.

### C27. Full 153-token re-audit of globals.css surfaces no additional dead tokens beyond the 5 above

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** other | **Removal:** no (consolidation/hygiene)
- **Where:** app/globals.css
- **Evidence (finder):** 2 independent scans over all 153 unique custom-property names in app/globals.css (239 def sites across :root/light/warm-gate): (1) crude substring `var(--TOKEN` over 1493 .css/.tsx/.ts/.js/.jsx files -> exactly 5 zero-hit tokens. (2) boundary-safe regex `var\(\s*--TOKEN(?![a-zA-Z0-9-])` (fixes prefix-collision false-positives, e.g. --gold matching inside --gold-strong, --home-win matching inside --home-win-rgb) plus .md/.mdx/.html -> confirms same 5; --bg-raised's only hit was a stale archived doc, not real code. No 6th token surfaced. Checked getPropertyValue/setProperty/CSS.supports, tailwind.config.ts, token baseline JSONs -- none reference the 5 dynamically.
- **Verification:** Reproduced: 153 unique tokens / 239 def sites in globals.css (exact match). Boundary-safe var() scan across 2065 files found the same 5 zero-hit tokens once --bg-raised's sole hit (docs/projects/archive/TOURNAMENT_SECTION_REVIEW_PLAN.md, confirmed via Grep) is excluded as a stale archived doc. Set: --black-10, --bg-raised, --home-plum-rgb, --home-rust-rgb, --info-strong.

### C28. --font-data (alias of --font-mono) unredeclared in coach warm gate — confirmed benign, not the same bug class

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** token-drift | **Removal:** no (consolidation/hygiene)
- **Where:** app/globals.css:398 (base: --font-data: var(--font-mono, 'IBM Plex Mono'), monospace;); app/globals.css:440-587 (gate never touches --font-data or --font-mono)
- **Evidence (finder):** --font-data is a genuine :root alias whose target (--font-mono) is never remapped by the warm theme system — font-family carries no color and the warm remap only changes color/surface/border tokens. 164 files (incl. coach-portal surfaces) consume var(--font-data) with no observed font regression under warm. Same FORM as the --primary gap (unredeclared :root alias in the gate) but not the same SUBSTANCE: no warm-remapped target to go stale against. False positive for the bug class; recorded per task instruction to distinguish it from --primary.
- **Verification:** globals.css:398 confirmed verbatim; gate (440-587) never touches --font-data/--font-mono, confirmed by read. Independent scan: 190 files consume var(--font-data) (finding said ~164, same order of magnitude). Distinguishing claim holds: font-family carries no color, no warm-remapped target to go stale against — correctly a non-bug.

### C29. --platform-primary-rgb (30,58,138) hand-copied as a raw rgba() tuple 33x across 4 files instead of var()

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 33
- **Where:** app/(consumer)/auth/auth.module.css (16 sites, e.g. lines 32,39,40,84,85,94); app/(consumer)/auth/select-org/select-org.module.css (9 sites, e.g. lines 8,11,19,26,27,74,75,160); app/page.module.css (7 sites, e.g. lines 11,19,20,320,327,339); components/help/help.module.css:1113
- **Evidence (finder):** Canonical `app/globals.css:29 --platform-primary-rgb: 30, 58, 138;`. 33 occurrences of the literal `rgba(30,58,138,...)`/`rgba(30, 58, 138,...)` across these 4 files, all of which could use `rgba(var(--platform-primary-rgb), X)`.
- **Verification:** Canonical globals.css:29 confirmed. Recounted literal rgba(30,58,138) occurrences: auth.module.css=16, select-org=9, page.module.css=7, help.module.css=1. Total=33, exact match to claim (verified via grep -o counts and line-level spot check).

### C30. STALE LIME: 20 sites/8 files use the OLD pre-refresh brand lime rgba(163,230,53) not current --logic-lime

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** token-drift | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 20
- **Where:** components/rep-teams/TryoutFlowHeader.module.css:25,26,46; components/rep-teams/TryoutDayCard.module.css:82,84,89,286,289; components/rep-teams/TryoutCheckIn.module.css:71; components/rep-teams/register.module.css:168,169; app/(consumer)/auth/auth.module.css:226,227; app/platform-admin/dev-tools/playbook.module.css:162; components/league/register.module.css:113,114,118,250,251; app/tryout-score/[token]/tryout-score.module.css:41
- **Evidence (finder):** Current brand lime per app/globals.css:344 is --logic-lime-rgb:217,249,157 (#D9F99D). 20 sites across these 8 files instead use the pre-refresh tuple rgba(163,230,53,X) — e.g. TryoutFlowHeader.module.css:25 border-left uses var(--logic-lime,#a3e635) alongside rgba(163,230,53,0.28); auth.module.css:226-227 reuses the same stale tuple. Each site should become rgba(var(--logic-lime-rgb), X). Visually changes rendered hue (dull old lime → bright current lime) on live tryout/registration/auth surfaces — flag for an eyeball pass before mass swap.
- **Verification:** Exact match: rgba(163,230,53,...) occurs exactly 20 times across exactly 8 files (verified via grep -o). Every cited line number (e.g. TryoutFlowHeader.module.css:25,26,46; auth.module.css:226,227) matches actual grep output. globals.css:344 confirms --logic-lime-rgb: 217,249,157 as the current/correct value.

### C31. --logic-lime-rgb (217,249,157) hand-copied as raw rgba() tuple 11x across 6 files

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 11
- **Where:** app/(consumer)/auth/select-org/select-org.module.css:126; app/globals.css:1143; components/help/help.module.css:460,1114; components/home/PendingInvitationsCard.module.css:4,5; components/notifications/EnablePushBanner.module.css:17,18; components/marketing/tournament-growth.module.css:48,87,88
- **Evidence (finder):** Canonical `app/globals.css:344 --logic-lime-rgb: 217, 249, 157;`. Same tuple hardcoded as rgba(217,249,157,X) in 6 files (11 sites total) instead of rgba(var(--logic-lime-rgb), X) — includes 2 files in the workstream C consumer/home scope (PendingInvitationsCard, select-org).
- **Verification:** Canonical globals.css:344 confirmed. Recounted rgba(217,249,157) occurrences: select-org=1, globals.css=1, help.module.css=2, PendingInvitationsCard=2, EnablePushBanner=2, tournament-growth=3. Total=11, exact match to claim.

### C32. Warm rgb triples re-hardcoded in warmTheme.module.css + AppearanceCard.module.css, not shared with globals.css

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 10
- **Where:** app/globals.css:447-448,450,453 (canonical warm-gate values); components/consumer/warmTheme.module.css:27-28,30,32,39-40 (re-declares same literals); components/consumer/AppearanceCard.module.css:85 (rgba(70,55,30,0.14) — same RGB, unique alpha)
- **Evidence (finder):** app/globals.css declares rgba(70,55,30,0.12)/rgba(70,55,30,0.20)/rgba(87,101,30,0.10)/rgba(217,72,43,0.10) inside the [data-coach-warm-enabled] gate; warmTheme.module.css:27-40 hand-copies the identical (70,55,30)/(87,101,30)/(217,72,43) RGB triples for the consumer .warmVars class. warmTheme.module.css's own comment says this is a DELIBERATE second copy ("the consumer shell keeps its own [--home-*] in warmTheme.module.css") for cross-shell independence — flagging for awareness, not an oversight. AppearanceCard.module.css:85 adds a 3rd raw copy of the (70,55,30) triple at a one-off alpha (0.14).
- **Verification:** globals.css:446-455 and warmTheme.module.css:27-40 both independently declare identical (70,55,30)/(87,101,30)/(217,72,43) triples. globals.css:434-435 comment confirms deliberate duplication. AppearanceCard.module.css:85 has a 3rd raw copy of (70,55,30) at alpha 0.14, confirmed by direct read.

### C33. --on-lime (#0f1123) value drift: 3 sibling hardcoded literals disagree with the canonical token

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** token-drift | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 5
- **Where:** app/globals.css:349 (canonical: --on-lime: #0f1123); app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:909 (#0a0c12); app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:2002 (#0b0f14); app/platform-admin/users/users.module.css:353 (#000); app/(consumer)/auth/select-org/select-org.module.css:141,153 (#0f1123 — right value, still hardcoded)
- **Evidence (finder):** Canonical: globals.css:349 --on-lime:#0f1123. 3 files hand-copy a WRONG value with a comment admitting drift: schedule-admin.module.css:908-909 "slight value drift from --on-lime (#0f1123), pinned pending normalization" uses #0a0c12; dashboard.module.css:2001-2002 same comment, uses #0b0f14; users.module.css:352-353 "differs from --on-lime (#0f1123)" uses #000. select-org.module.css:141,153 use the CORRECT value but still hardcoded, not var(). branding.module.css:675 (#0F1123) checked+excluded: its comment says it intentionally simulates light-mode preview text, unrelated to the on-lime token.
- **Verification:** globals.css:349 canonical #0f1123 confirmed. schedule-admin.css:908-909 #0a0c12, dashboard.css:2001-2002 #0b0f14, users.module.css:352-354 #000 all verified verbatim w/ drift comments. select-org.css:141,153 use correct value but hardcoded. branding.css:675 correctly excluded (unrelated light-preview mockup).

### C34. --primary/--primary-rgb frozen under coach warm gate — same alias-freeze bug already patched twice symptomatically

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** token-drift | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 4
- **Where:** app/globals.css:34-35 (base alias: --primary-rgb/--primary = var(--platform-primary-rgb/-primary)); app/globals.css:440-587 (warm gate block — no --primary/--primary-rgb/--platform-primary redeclaration); app/globals.css:602-627 (.btn-primary + .btn-outline overrides, each with a comment admitting root cause); app/[orgSlug]/coaches/coaches.module.css:1931 (one defensive consumer)
- **Evidence (finder):** Base :root (34-35): --primary-rgb: var(--platform-primary-rgb); --primary: var(--platform-primary). Gate (440-587) redeclares --blueprint-blue/-rgb, --text-*, --*-strong etc. but never --primary/--primary-rgb — same mechanism as the owner-reported --text-* bug (design_decisions.md 2026-07-23, line 13). Proof it already bit real components: line 603 comment on .btn-primary: 'the platform navy primary would otherwise keep its navy fill (--primary is not remapped)'; line 619 on .btn-outline: 'stays platform navy (--primary is not remapped)'. Both patched by overriding the CLASS not the token — a new bare var(--primary) consumer repeats the bug.
- **Verification:** globals.css:34-35 base alias, 440-587 gate (no --primary/--primary-rgb line) confirmed by direct read. 602-627 comments literally say '--primary is not remapped' x2. coaches.module.css:1931 confirmed defensive var(--home-olive, var(--primary)). design_decisions.md:13 confirms identical prior --text-*/--*-strong bug, fixed nearby (522-524, 551-557) but --primary missed.

### C35. --blueprint-blue-rgb missing from auth warm block's alias list — latent, no live consumer today

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** token-drift | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 1
- **Where:** app/globals.css:341-342 (base aliases --blueprint-blue / --blueprint-blue-rgb = var(--platform-primary...)); app/(consumer)/auth/auth.module.css:358-368 (.authSurface warm block — redeclares --blueprint-blue at 365, never --blueprint-blue-rgb); app/(consumer)/auth/layout.tsx (mounts warm.warmTab > styles.authSurface around all /auth/* incl. select-org)
- **Evidence (finder):** The auth group's nested warm override (design_decisions.md 2026-07-23 'Auth screens FOLLOW the user theme') enumerates and redeclares every dark alias the auth stylesheet/pages consume: --fl-text, --data-gray, --text-tertiary, --logic-lime(+rgb), --danger-light, --blueprint-blue (auth.module.css:359-365). It redeclares --blueprint-blue but not paired --blueprint-blue-rgb. A full var(--...) scan of app/(consumer)/auth/ found zero current uses of the -rgb form there, so LATENT ONLY — but a future tint pairing var(--blueprint-blue) with rgba(var(--blueprint-blue-rgb),...) (the codebase's standard pattern, e.g. --glow-blue at globals.css:394) renders a stale navy tint on the warm ground.
- **Verification:** globals.css:341-342 base aliases confirmed. auth.module.css:358-368 (UNCOMMITTED per git diff, i.e. live code, not already fixed by another session) redeclares --blueprint-blue (365) but never --blueprint-blue-rgb. Grep for blueprint-blue-rgb in app/(consumer)/auth/ = 0 hits. globals.css:394 confirms the rgba(var(x),var(x-rgb)) pairing precedent cited.

### C36. No 'consumer' scope: app/(consumer) shell + components/consumer/* entirely unguarded

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** css-scope-gap | **Removal:** no (consolidation/hygiene)
- **Where:** app/(consumer)/auth/auth.module.css; app/(consumer)/account/notifications/AccountNotifications.module.css; components/consumer/HomePersonalization.module.css; components/consumer/ScoresClient.module.css; components/consumer/AppearanceCard.module.css; components/home/PendingInvitationsCard.module.css; app/team/page.module.css; components/notifications/PreferencesTable.module.css
- **Evidence (finder):** public.files cherry-picks ConsumerShell.module.css but its 15 siblings in app/(consumer)/** (9 files, e.g. auth.module.css hex3/rgba24) and components/consumer/** (5 files, e.g. HomePersonalization hex2/rgba16) are not covered. Plus components/home/PendingInvitationsCard.module.css (used only by consumer/HomePersonalization.tsx), app/team/page.module.css (composes warmTheme; warm coach-signup route), and 3 consumer-only notifications files (PreferencesTable/PushDeviceTester/FanAlertsCard, used only by app/(consumer)/account/notifications). Total: 19 files, ~24 hex + ~132 rgba, zero ratchet coverage.
- **Verification:** All 19 files exist; exact recount = 24 hex, 132 rgba (matches claim exactly). PendingInvitationsCard imported only by HomePersonalization.tsx; team/page.module.css composes warmTheme; PreferencesTable/PushDeviceTester/FanAlertsCard/PreferenceGroups imported only by AccountNotificationsClient.tsx. No 'consumer' scope exists in script.
- **Proposed action:** Add SCOPES.consumer: dirs ['app/(consumer)','components/consumer'] + files [home/PendingInvitationsCard, team/page.module.css, notifications/{PreferencesTable,PushDeviceTester,FanAlertsCard}]; exclude warmTheme (defines tokens) and ConsumerShell (stays public.files). --init after.

### C37. No 'marketing' scope: top-level brand-site pages (app/page, for-*, pricing, changelog) unguarded

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** css-scope-gap | **Removal:** no (consolidation/hygiene)
- **Where:** app/page.module.css; app/pricing/page.module.css; app/for-clubs/page.module.css; app/for-coaches/page.module.css; app/for-leagues/page.module.css; app/for-tournament-organizers/page.module.css; app/changelog/page.module.css; components/PricingSection.module.css
- **Evidence (finder):** 10 files entirely outside app/[orgSlug] and outside any operator dir: app/page.module.css(rgba13), app/pricing(rgba44), for-clubs(rgba25), for-coaches(rgba24), for-leagues(rgba23), for-tournament-organizers(rgba20), changelog(rgba13), PricingSection.module.css(rgba22), EarlyAccessForm.module.css(hex1/rgba2), EarlyAccessModalTrigger.module.css(rgba5). Distinct audience/initiative from tenant public pages (same rationale the script uses to split operator from public) — 191 rgba() calls with zero ratchet visibility; script's regex is hex-only so even in-scope it'd miss this debt shape.
- **Verification:** All 10 files exist. Exact recount: 1 hex, 191 rgba total — matches claim exactly. Script's regex confirmed hex-only (no rgba scan). No 'marketing' scope exists. Files are top-level, outside app/[orgSlug] and operator.dirs.
- **Proposed action:** Add SCOPES.marketing: dirs [app/for-clubs, app/for-coaches, app/for-leagues, app/for-tournament-organizers, app/pricing, app/changelog] + files [app/page.module.css, PricingSection, EarlyAccessForm, EarlyAccessModalTrigger]. Script counts hex only — add an rgba() counter if this debt shape should be enforced.

### C38. operator.dirs omits 5 admin/coaches-only component libs — largest hidden pile (~126 hex/~304 rgba)

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** css-scope-gap | **Removal:** no (consolidation/hygiene)
- **Where:** components/rep-teams/TryoutDayCard.module.css; components/rep-teams/TryoutFlowHeader.module.css; components/accounting/UpcomingPayablesPanel.module.css; components/billing/PlanArticlePanel.module.css; components/feedback/FeedbackWidget.module.css; components/platform-admin/MetricCard.module.css; components/notifications/notifications-page.module.css; components/notifications/EnablePushBanner.module.css
- **Evidence (finder):** Verified operator-only usage via import grep. accounting/*: only admin/accounting|rep-teams + coaches accounting pages. billing/*: only admin/org/billing + platform-admin/dev-tools. rep-teams/{TryoutDayCard,FlowHeader,CheckIn,AcceptDrawer}: only admin/rep-teams + coaches tryouts (register.module.css in same dir differs — see public finding). feedback/FeedbackWidget: only AdminBottomNav. platform-admin/{MetricCard,RequiresAccess}: outside components/admin though app/platform-admin IS in operator.dirs. notifications/{notifications.module.css(8/22),notifications-page(5/26),EnablePushBanner(4/6)}: only admin/coaches chrome. rep-teams operator files alone: hex86/rgba139.
- **Verification:** 8 files exist; operator.dirs (live script) confirmed to omit accounting/billing/feedback/platform-admin dirs. Usage grep confirms admin+coaches-only. rep-teams 4-file recount exact: hex86/rgba139. Minor overstatement: FeedbackWidget also mounts via FeedbackLauncher in check-in/scorekeeper, not 'only AdminBottomNav' — doesn't change the recommendation.
- **Proposed action:** Add to operator.dirs: components/accounting, components/billing, components/feedback, components/platform-admin. Add files (not whole dir — register.module.css must stay out): rep-teams/{TryoutDayCard,TryoutFlowHeader,TryoutCheckIn,TryoutAcceptDrawer}, notifications/{notifications.module.css,notifications-page.module.css,EnablePushBanner.module.css}. --init after.

### C39. Standalone no-login evaluator page app/tryout-score/[token]/ sits outside both scopes entirely

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** css-scope-gap | **Removal:** no (consolidation/hygiene)
- **Where:** app/tryout-score/[token]/tryout-score.module.css
- **Evidence (finder):** Not under app/[orgSlug] (misses public.dirs) and not under any operator.dirs entry (app/coaches, app/platform-admin, etc.) since it's a top-level standalone route. hex=12 (hardcoded #0A0A0A background/text repeated, #f0f0f0 etc.), rgba=22. File's own comment: 'No-account evaluator scoring page ... used one-handed at a diamond'. Functionally an operator/volunteer day-of tool despite the token-based no-org-chrome URL shape.
- **Verification:** File exists; exact recount hex12/rgba22 matches claim; file's own comment reads verbatim 'No-account evaluator scoring page (Phase 2B.2). Standalone mobile page — used one-handed at a...'. Confirmed outside app/[orgSlug] and outside all operator.dirs entries.
- **Proposed action:** Add 'app/tryout-score' to SCOPES.operator.dirs (audience is coaches/evaluators, not the general public), or a small 'standalone-operator' files list if similar token pages exist elsewhere. --init after adding.

### C40. Several component libs render in BOTH public/consumer AND operator surfaces — no single scope fits

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** css-scope-gap | **Removal:** no (consolidation/hygiene)
- **Where:** components/chat/ChatPanel.module.css; components/chat/ChatManagePanel.module.css; components/marketing/tournament-growth.module.css; components/shared/FlipPill.module.css; components/InstallAppPrompt.module.css; components/TeamAvatar.module.css
- **Evidence (finder):** components/chat/* used by BOTH app/(consumer)/chat/ChatConversation.tsx and app/[orgSlug]/admin/tournaments/chat + coaches chat pages; ChatPanel.module.css hex1/rgba63 is the heaviest single file in the whole gap set. marketing/tournament-growth.module.css (hex7/rgba21) renders in [tournamentSlug]/layout.tsx (public) AND coaches/page.tsx (operator). shared/FlipPill.module.css used by public/TournamentFlipPill.tsx (public) and coaches/admin/volunteer components (operator). InstallAppPrompt.module.css (hex2/rgba8) mounts in consumer, scorekeeper, tournament, coaches, admin, check-in layouts. TeamAvatar.module.css (hex1/rgba1) used by public/TeamsContent.tsx and admin registrations page.
- **Verification:** All 6 files exist. ChatPanel.module.css (hex1/rgba63, heaviest file) used by consumer ChatConversation.tsx, admin tournaments/chat, and CoachChatView. tournament-growth.module.css (hex7/rgba21 exact) used by [tournamentSlug]/layout.tsx (public) + coaches/page.tsx (operator). InstallAppPrompt (hex2/rgba8) and TeamAvatar (hex1/rgba1) both span public+operator exactly as claimed.
- **Proposed action:** Neither directory-based scope can cleanly own these without double-listing. Either add a third 'shared' scope with its own baseline, or list each file explicitly under BOTH public.files and operator.files (as already done for Navbar/ConsumerShell). Needs an owner call before extending.

### C41. 9 dead selectors in plans-pricing.module.css (impactCard/changeControl cluster)

- **Verdict:** DOWNGRADED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 30
- **Where:** app/platform-admin/plans-pricing/plans-pricing.module.css:82 (.impactCard); app/platform-admin/plans-pricing/plans-pricing.module.css:115 (.changeControlStrip); app/platform-admin/plans-pricing/plans-pricing.module.css:1215 (.numValue)
- **Evidence (finder):** Only importer PlansPricingClient.tsx has zero refs to impactCard, impactPanel, changeControlStrip, changeControlCopy, changeControlSelect, changeControlMeta, numValue, numEmpty, envHeaderRow.
- **Verification:** Grepped all 9 names in PlansPricingClient.tsx: zero hits, confirms finder. stripe-prices.module.css/.tsx has same names but is a separate CSS module (coincidence). No dynamic styles[...] access, no :global/composes. git grep master -- PlansPricingClient.tsx: zero refs, dead on prod. Live replacements: impactCell/inline span+strong superseded impactCard/impactPanel; planMetricGrid superseded numValue/numEmpty; pendingApprovalBanner superseded changeControlStrip. No UAT hits. BUT 2 of 9 comma-share LIVE rules: `.snapshotItem span,.impactCard span{}` (snapshotItem live, TSX:1743) and @media(900px) list `.impactPanel,.changeControlStrip,` w/ live .snapshotPanel/.catalogSummary (1480-82).
- **Verifier notes:** Directionally correct (all 9 unreferenced, safe to remove) but scope off: real footprint ~90 LOC across 13 declarations not est_loc:30/3 locations; 2 declarations comma-share live selectors so need surgical single-line strips, not whole-block deletion.

### C42. Dead CSS custom property --home-plum-rgb (Stage 3 warm-palette RGB companion, zero consumers)

- **Verdict:** DOWNGRADED | **Risk:** safe-mechanical | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 1
- **Where:** app/globals.css:570
- **Evidence (finder):** --home-plum (line 569, #7B4B6E) IS consumed (e.g. app/globals.css:581 --evt-practice: var(--home-plum)), but its RGB companion --home-plum-rgb (line 570, '123, 75, 110', meant for rgba(var(--home-plum-rgb), alpha) patterns) has zero `var(--home-plum-rgb` hits anywhere in .css/.tsx/.ts. Every other warm-palette color in the same block (--home-olive-rgb, --home-live-rgb, --home-amber-rgb, --home-blue-rgb, --home-win-rgb, --home-line-rgb, --home-paper-rgb) has real var() consumers; --home-plum-rgb is the outlier with none.
- **Verification:** Grep "home-plum-rgb" repo-wide: only def at globals.css:570, zero consumers. Grep "home-plum": def+comment+--evt-practice(uses base color)+4 inline styles in coaches accounting using var(--home-plum,#a855f7) directly - confirms base used, -rgb never. Checked sibling --home-rust-rgb (line 572, same Stage3 commit a2b6d90e): ALSO zero consumers. Searched dynamic templating (--home-${}-rgb): none. git log -S home-plum-rgb: added a2b6d90e 2026-07-22, untouched since. git grep home-plum master: zero hits, dev-gated feature not on prod. tests/uat+components/accounting: only unrelated "plumb" false positive.
- **Verifier notes:** Real dead code, but finding undersizes it: --home-rust-rgb (line 572) is an identical zero-consumer sibling from the same Stage-3 commit, not mentioned. Correct cleanup unit is both companion RGB tuples together, not --home-plum-rgb alone.

### C43. 41 dead selectors in teams-admin.module.css — superseded 'attention bucket' + bulk-bar registration UI

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 180
- **Where:** app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:41 (.bulkBar); app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:320 (.paymentFilters); app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:479 (.attentionBucket); app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:497 (.attentionBucketActive); app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:1570 (.toolsSection); app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css:2423 (.attentionSheet)
- **Evidence (finder):** Zero refs in page.tsx or RegistrationHealthPanel.tsx for bulkBar/attentionBucket*/paymentFilter*/toolsSection*/attentionSheet* (41 classes total). Confirmed via `grep -n "accent-\${"` that the file's only dynamic bracket pattern (`styles[\`accent-${accent}\`]`) doesn't touch any of these names. Matches memory note: Registration Health Panel (shipped 2026-07-09) replaced an older attention-bucket design.
- **Verification:** Checked every claimed class vs usage in page.tsx/RegistrationHealthPanel.tsx + master. `.attentionSheetClear` (css:2272 dev/1977 master) IS live: `className={styles.attentionSheetClear}` renders the "Reset filters" button in the mobile filter sheet (page.tsx:2366 dev /:2060 master) — identical on prod (`git grep attentionSheetClear master` hits both files). Its `:hover` rule is live too. Script cross-referenced all 15 base class names in bulkBar/paymentFilters/attentionBucket*/toolsSection*/attentionSheet* against `styles\.<name>\b`: 14 unused, only attentionSheetClear used. Bare `.attentionSheet` (line 2423) has no base rule anywhere — genuinely orphaned as claimed.
- **Verifier notes:** Correct scope is ~39 dead selectors, not 41 — must exclude attentionSheetClear + its :hover (styles a live "Reset filters" button, present on prod/master too). A blanket grep-delete on the attentionSheet* prefix would silently break that button. Rest of the finding (bulkBar, paymentFilters, attentionBucket* family, toolsSection*) checks out dead in both dev and master.

### C44. 38 dead selectors in coaches.module.css (lineup-analytics, attendance-status, stat-strip clusters)

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 150
- **Where:** app/[orgSlug]/coaches/coaches.module.css:66 (.scrollX); app/[orgSlug]/coaches/coaches.module.css:82 (.stickyActionBar); app/[orgSlug]/coaches/coaches.module.css:423 (.statStripItem); app/[orgSlug]/coaches/coaches.module.css:524 (.lineupAnalyticsCard + 10 lineupAnalytics* siblings); app/[orgSlug]/coaches/coaches.module.css (teamStats/statItem/statLabel/statValue); app/[orgSlug]/coaches/coaches.module.css (tournamentHistoryPanel/Icon/Empty); app/[orgSlug]/coaches/coaches.module.css (attendanceStatusGroup/Btn/BtnActive/NoteToggle/attendanceUnsaved); app/[orgSlug]/coaches/coaches.module.css (lineupSummaryToggle/lineupHint/lineupOrderInput/lineupNotPlayingTag)
- **Evidence (finder):** Automated defined-vs-used pass over all 48 importer files (dot + bracket `styles[...]` access) found 38 classes with zero references; spot-verified scrollX/stickyActionBar/lineupAnalyticsCard/teamStats with targeted grep across app/[orgSlug]/coaches + components/coaches — no hits outside the CSS file itself. No dynamic `styles[\`...${}\`]` bracket patterns found in any importer that could explain these as computed keys.
- **Verification:** Checked all 48 importers of coaches.module.css (dot+bracket forms); no composes:. All 30 named classes: 0 hits, confirming most of the claim. git log -S: each cluster lost its JSX in a real refactor: lineupAnalytics* dropped from lineups/page.tsx 07-09 (f697d31c)->Insights hub; attendanceStatusGroup/Btn/NoteToggle dropped 06-30 (206437dd)->attendanceStatusBadge; teamStats/statItem/statLabel/statValue superseded in dashboard cards; tournamentHistoryPanel/Icon/Empty superseded elsewhere. BUT scrollX/stickyActionBar (L66/82) are "do FIRST" primitives in the still-open COACHES_PORTAL_MOBILE_PLAN.md + design_decisions.md; lineupTableWrap duplicates scrollX rules standalone = planned-not-wired.
- **Verifier notes:** Remove ~32-34 dead selectors (lineupAnalytics* cluster, statStripItem+Dot, teamStats/statItem/statLabel/statValue, tournamentHistoryPanel/Icon/Empty, attendanceStatus*/NoteToggle/Unsaved, lineupSummaryToggle/Hint/OrderInput/NotPlayingTag) = safe. EXCLUDE scrollX/scrollXSticky/stickyActionBar: active plan-tied primitives. est_loc ~120 not 150.

### C45. Status-color rgba tuples (danger/warning/success/info) hand-copied 118x across 15-20 admin files

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 118
- **Where:** app/platform-admin/dev-tools/dev.module.css (17 danger-rgb sites); app/[orgSlug]/admin/admin-common.module.css (6 danger + 2 success sites); app/[orgSlug]/admin/org/members/members.module.css (4 danger + 6 warning sites); app/platform-admin/email/email.module.css (6 warning sites); app/[orgSlug]/scorekeeper/scorekeeper.module.css (4 warning + 1 info site)
- **Evidence (finder):** Cluster counts from a repo-wide rgba scan: (239,68,68 danger-rgb) 52 occurrences/15 files; (245,158,11 warning-rgb) 46/14 files; (34,197,94 success-rgb) 15/6 files; (59,130,246 info-rgb) 5/4 files. Far larger than the platform-primary/logic-lime clusters above — flagged as an altitude observation for a dedicated future tranche, not itemized site-by-site here.
- **Verification:** Aggregate scale survives: re-run shows 51/44/13/6=114 occurrences across 25 files (claim: 118/15-20 files) - same order of magnitude. But 2 of 5 cited breakdowns are wrong: members.module.css has 6 danger occurrences not the claimed 4 (lines 192-3,539-40,624-5); dev.module.css has 16 not 17. 25 files also exceeds '15-20 admin files' framing; some files aren't admin-only.

### C46. 23 dead selectors in standings.module.css — orphaned follow-bar/view-toggle cluster

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** dead-css | **Removal:** yes | **~LOC/objects:** 90
- **Where:** app/[orgSlug]/standings/standings.module.css:112 (.resultsSummaryGrid); app/[orgSlug]/standings/standings.module.css:150 (.followBar); app/[orgSlug]/standings/standings.module.css:292 (.recordPill); app/[orgSlug]/standings/standings.module.css:946 (.viewToggle)
- **Evidence (finder):** Zero refs across all 3 importers (PublicBracketView/RaceToPlayoffsView/StandingsContent) for followBar/followMain/followStats/followResult/followActions/recordPill/recordCol/viewToggle*/followFinalRank/followRankBadge/etc (23 classes). Same follow-bar family as the schedule.module.css finding.
- **Verification:** Grepped repo-wide + the 3 real importers for every listed class: ~19/23 (followBar*, followMain/Stats/Result/Actions, emptyActions, viewToggle*, resultsSummaryGrid) are zero-ref on dev AND master (git grep on master). No test selectors, no dynamic styles[...] access, no composes:. Last CSS edit 94ccc8a1 (2026-07-16), no concurrent uncommitted edits. BUT master's StandingsContent.tsx still renders styles.recordCol/recordPill (dev dropped them via an already-shipped "REC merged R2-3" refactor). Several dead selectors also sit in comma-rules with live classes: tabular-nums rule, the flex-display rule, and th.statCenter,th.recordCol.
- **Verifier notes:** Bulk of cluster (~19 selectors) genuinely dead dev+master - MyTeamCard.tsx replaced the follow-bar CTA. recordPill/recordCol still live on prod's parallel build of the same file (dev already migrated via shipped R2-3 refactor) - ship-with-release, not unconditional orphan. ~6 selectors share comma-rules with live classes - needs surgical removal not block deletion. Real LOC likely exceeds 90.

### C47. 5 component dirs render admin/coaches-only UI but sit outside operator.dirs — confirmed by importer trace

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** css-scope-gap | **Removal:** no (consolidation/hygiene)
- **Where:** scripts/check-public-tokens.mjs:53; components/accounting; components/billing; components/platform-admin; components/rep-teams
- **Evidence (finder):** operator.dirs (L53-61) = app/[orgSlug]/{admin,coaches,scorekeeper}, app/coaches, app/platform-admin, components/{admin,coaches}. Importer trace shows these render ONLY admin/coaches pages yet sit outside it: components/accounting/* (admin+coaches accounting), components/billing/PlanArticlePanel+UpgradeGate (admin billing/chat), components/chat/ChatManagePanel|ChatRoomsPanel|NewRoomDialog (admin chat), components/platform-admin/* (app/platform-admin is scoped, this dir isn't), components/rep-teams/* (admin+coaches tryouts). Sampled 2 largest for dead-CSS: ChatPanel.module.css clean; TryoutDayCard.module.css had the 4 dead selectors above.
- **Verification:** operator.dirs confirmed excluding all 4 dirs; accounting/billing/platform-admin confirmed admin-only by import trace. But components/rep-teams is ALSO imported by a public page (teams/[teamSlug]/tryouts/.../register/page.tsx imports TryoutRegisterForm). 'admin/coaches-only' claim false for that dir; naive fix (add to operator.dirs) would mis-scope real public debt.


## Workstream D — Database schema

### D01. PROD-ONLY: permissive anon-role ALL/USING(true) policies on 6 core tables bypass all app authorization

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-rls | **Removal:** yes | **~LOC/objects:** 6
- **Where:** prod live: pg_policies (announcements, diamonds, divisions, games, teams, tournaments); dev live: pg_policies (same 6 tables) — 0 rows
- **Evidence (finder):** Live query on prod pg_policies WHERE roles ILIKE '%anon%' AND cmd IN ('ALL','INSERT','UPDATE','DELETE') AND (qual='true' OR with_check='true') returns 6 rows, all PERMISSIVE, roles={anon}, cmd=ALL, qual=true, with_check=true: 'Allow public full access to announcements/diamonds/age_groups/games/teams/tournaments'. Same query on dev returns 0 rows. Permissive policies OR-combine, so this grants the public anon key (embedded client-side) unrestricted write access on 6 tables. No migration file contains the policy name. DRIFT_dev_vs_prod.md only diffs relrowsecurity, never pg_policies content, so this is invisible to the existing drift report.
- **Verification:** pg_policies re-query on prod+dev: exactly 6 prod rows match roles={anon},cmd=ALL,qual=true,with_check=true (announcements/diamonds/divisions/games/teams/tournaments); dev has 0 across all 6. RLS enabled (relrowsecurity=true) on all 6 prod tables. Each table has identical scoped policies in both envs; dev works with ONLY those, proving prod grant is redundant. git grep "Allow public full access" in working tree + master: 0 hits. Only 1 client file uses createBrowserClient touching app tables, doesn't hit these 6 (exploitable via raw REST + public anon key). DRIFT_dev_vs_prod.md diffs only relrowsecurity bool (0 shown) - blind-spot claim verified.
- **Verifier notes:** All applicable traps empty: no migration/app/client-write/trigger reference; dev proves scoped policies suffice; drift report confirmed blind. Real, exploitable prod-only hole (public anon key + REST = unrestricted write/delete on 6 tables). DB drops are owner-decision - route to user/DBA for DROP POLICY, not autonomous removal.
- **Proposed action:** Confirm intent then DROP POLICY "Allow public full access to X" on all 6 tables in prod (dev already operates correctly without them, proving the scoped member/anon-read policies are sufficient). Treat as urgent given anon key is public.

### D02. platform_catalog_change_requests.target_version_id — never written or read

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-column | **Removal:** yes | **~LOC/objects:** 1
- **Where:** docs/agents/db/DATA_DICTIONARY.md:4592; app/platform-admin/plans-pricing/page.tsx:179
- **Evidence (finder):** git grep -n 'target_version_id' across app/lib/components/scripts on both dev and master returns ZERO hits — never set by the change-request insert route, and page.tsx:179 explicitly enumerates the change-requests SELECT column list without it. Only the FK constraint (→platform_plan_versions) exists. DATA_DICTIONARY.md labels it 'dead column: never written by the insert and never SELECTed by any reader.'
- **Verification:** grep "target_version_id"/camelCase in app/lib/components/scripts, dev+master: zero code hits (only docs/snapshots/migration). route.ts insert(L622-637)/update(L723-750) never set it; same for seed-support-loop.mjs, platform-catalog-approval.ts. select('*') at route.ts:642,679,756 & publish/route.ts:122 pulls it into `data` but nothing reads `.target_version_id` downstream. Both UI readers (change-requests/page.tsx:14, plans-pricing/page.tsx:179) use explicit column lists omitting it. Live DB: pg_proc/pg_policies/pg_trigger refs=[] dev+prod; rows dev 16/0 non-null, prod 18/0 non-null. tests/ grep empty.
- **Verifier notes:** Zero-reference in code both branches, zero non-null rows both envs, no trigger/function/policy dependency - clean dead-column case. owner-decision per blanket DB-drop rule, but technically safe to drop column+FK once owner signs off.
- **Proposed action:** Drop target_version_id column (and its FK) from platform_catalog_change_requests.

### D03. platform_plan_versions.snapshot — write-once seed column, never selected

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-column | **Removal:** yes | **~LOC/objects:** 1
- **Where:** docs/agents/db/DATA_DICTIONARY.md:4483; app/platform-admin/plans-pricing/page.tsx:170
- **Evidence (finder):** page.tsx:170 SELECTs platform_plan_versions by explicit column list (id, version_key, title, description, status, effective_at, published_at, created_by_email, created_at, updated_at, notes) and omits `snapshot`. Column is populated only once by migration 058's seed insert; no other writer exists. DATA_DICTIONARY.md: 'dead column: seeded... but never SELECTed by any code.'
- **Verification:** page.tsx:169-172 is the only app reference to platform_plan_versions; column list omits snapshot. git grep on master (prod) shows the same single reference/omission. git log -8 on page.tsx/mig058/DATA_DICTIONARY: no recent activity. Live dev: pg_trigger = only FK RI triggers; pg_proc source search = empty; pg_policies = empty. Row count = 1 in dev AND prod (matches single mig-058 seed, never rewritten). Grepped scripts/, platform-admin/**, lib/** for dynamic readers/seed jobs touching snapshot — none; other hits are unrelated (metric_snapshots, CSS class snapshotPanel). target_version_id FK (mig059) points at the table's id but no code joins through to snapshot.
- **Verifier notes:** Genuinely dead column, zero reads dev or prod, both live DBs checked. owner-decision purely because any DB drop is irreversible, not low confidence.
- **Proposed action:** Drop snapshot jsonb column from platform_plan_versions.

### D04. pools.settings — dead/reserved jsonb, only ever written as empty default

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-column | **Removal:** yes | **~LOC/objects:** 1
- **Where:** docs/agents/db/DATA_DICTIONARY.md:742; scripts/seed-bl-u18-splitpool.mts:80; scripts/mirror-tournament.mjs:94
- **Evidence (finder):** Only write site repo-wide is a one-off seed script (scripts/seed-bl-u18-splitpool.mts:80) inserting a literal `{}`; mirror-tournament.mjs:94 lists it in a mirror-exclude set. No app read path exists. DATA_DICTIONARY.md L742: 'dead/reserved'.
- **Verification:** grep "pools.*settings" repo+master: only mig097 DDL comment ("reserved for future"), types.ts JSDoc "Reserved for future use" (never read), dictionary's own "dead column" note, mirror scripts' JSONB_COLS cast list (select('*')-reinsert stringify only), 2 seed scripts writing literal {}. lib/db.ts getPools/savePool/updatePool never touch settings. grep admin/divisions,pool-slots,teams,setup-tournament,seal-tournament,team-profile routes: 0 hits. Dev pg_proc/pg_trigger/pg_policies on pools: no settings logic, only FK triggers+4 generic CRUD policies; same on prod. Dev pools: 22 rows all settings='{}'; prod pools: 0 rows. git log -8 on types.ts/mig097/dictionary/scripts: no recent activity.
- **Verifier notes:** Deliberately reserved (mig097+VENUE_CONFLICT_PLAN), never built out unlike sibling divisions.settings. Safe to drop (no reads exist) but DB drops are owner-decision by policy. Drop must also update mirror-tournament.mjs/mirror-battle-of-the-bats.mjs JSONB_COLS + DATA_DICTIONARY.md. venue_facilities.settings looks like same unused pattern, worth a joint decision.
- **Proposed action:** Drop settings jsonb column from pools.

### D05. early_access_leads.metadata — fully dead jsonb, no writer or reader

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-column | **Removal:** yes | **~LOC/objects:** 1
- **Where:** docs/agents/db/DATA_DICTIONARY.md:4962; docs/agents/db/DATA_DICTIONARY.md:4991; lib/early-access-admin.ts:46
- **Evidence (finder):** Zero repo hits tying `metadata` to early_access_leads writers/readers. EARLY_ACCESS_SELECT (lib/early-access-admin.ts:46) explicitly excludes it alongside user_agent/email_normalized. DATA_DICTIONARY.md: 'FULLY DEAD. No writer sets it..., no reader selects it...; relies on the DB default forever. No key catalog exists in code.'
- **Verification:** Read DATA_DICTIONARY.md:4930-4997 + early-access-admin.ts fully — EARLY_ACCESS_SELECT (24 cols) omits metadata. Grepped `metadata` in every writer/reader (basic-coach-interest.ts, early-access/route.ts, platform-admin early-access route/export/[leadId], platform-metrics.ts) — zero hits. Checked all 11 `.from('early_access_leads')` sites + their .select/.insert/.update — none select('*'), none names metadata. git grep on master = same files. db-query.mjs dev+prod: column exists both envs, table has 0 rows both. pg_trigger = only 2 unrelated FK triggers; pg_proc/pg_policies empty. Mig 044 sole definer. UAT/scripts hits don't mention it. git log -5 shows no recent edits.
- **Verifier notes:** Fully dead by every applicable trap. Kept owner-decision per rubric: DB drops are owner-decision regardless of confidence, irreversible on a live admin CRM table, even though this column has zero blast radius.
- **Proposed action:** Drop metadata jsonb column from early_access_leads.

### D06. early_access_leads.status — legacy/dead, fully shadowed by internal_status

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-column | **Removal:** yes | **~LOC/objects:** 1
- **Where:** app/api/early-access/route.ts:107; lib/basic-coach-interest.ts:153; app/platform-admin/early-access/EarlyAccessClient.tsx:132; lib/early-access-admin.ts:52
- **Evidence (finder):** Both DB insert paths (app/api/early-access/route.ts:107, lib/basic-coach-interest.ts:153) stamp status='new' once and never update it; every triage/list/metric read in the admin surface uses the separate `internal_status` column instead — grep for reads of `.status` tied to early_access_leads (outside the insert literal) returns nothing. DATA_DICTIONARY.md L4923: 'LEGACY/DEAD... never read by any triage/filter/metric path... No governing TS union.'
- **Verification:** Re-read all 4 files + every call site. Both inserts stamp status:'new' once, never updated. Both filter reads do .eq('internal_status', filters.status) - JS param 'status' maps to internal_status, never raw status. PATCH route only writes internal_status/converted_*. Export CSV 'status' col comes from row.internal_status. platform-metrics.ts query omits status. All 12 traps checked empty: no dynamic refs/server actions/sw.js/cron/email hits; UAT jsons inert; git log no edits in days (latest 2026-07-17 unrelated); master parity identical + its own DATA_DICTIONARY.md documents this trap. Live DB dev+prod: 0 rows, no CHECK/RLS/trigger/pg_proc on status.
- **Verifier notes:** Every trap empty; corroborated by codebase's own Data Dictionary. Owner-decision (irreversible schema drop) despite zero runtime risk. Drop column + rely on cascade for idx_early_access_leads_status; strip status:'new' literal from the 2 insert sites same unit.
- **Proposed action:** Drop status column from early_access_leads (internal_status remains the live triage field); update the 2-3 insert call sites in the same migration unit.

### D07. org_overrides.suppress_billing — written every time, read by nothing

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-column | **Removal:** no (consolidation/hygiene)
- **Where:** app/api/platform-admin/orgs/[id]/overrides/route.ts:39; app/api/platform-admin/orgs/[id]/overrides/route.ts:81; docs/agents/db/DATA_DICTIONARY.md:239; docs/agents/db/DATA_DICTIONARY.md:269
- **Evidence (finder):** route.ts writes suppress_billing on every override create (lines 81, 99) and echoes it to the audit payload, but `git grep suppress_billing -- lib` (the billing/entitlement logic layer) returns zero hits — no Stripe/billing code ever reads the column. DATA_DICTIONARY.md gotcha 5: 'suppress_billing has NO reader - written + echoed to the audit payload, never consumed. Inert.'
- **Verification:** route.ts:39,81,99 writes suppress_billing (default false), echoes to audit. Repo grep hits ONLY route.ts + docs — zero reads anywhere (lib/components/scripts/tests). OrgDetailClient.tsx (only create-UI) has no field for it, so it can never be sent true from the app. DB: dev 6 rows/0 true, prod 1 row/0 true. pg_proc/pg_trigger/pg_policies on org_overrides: only default FK triggers. git log -S suppress_billing --all: last touch 2026-06-09, no concurrent work. DATA_DICTIONARY.md gotcha 5 + TIMED_ENTITLEMENTS_PLAN.md "A2 deferral (2026-06-04)" show this is a dated, deliberate deferral (Stripe pause_collection), not oversight. master (prod) matches.
- **Verifier notes:** Finder's framing already correct/conservative (removal_candidate:false, owner-decision). No refuting evidence; docs corroborate deliberate deferral, not accidental dead code.
- **Proposed action:** Not pure dead code (still actively written) — owner must decide whether to wire it into the actual Stripe billing-suppression path it was built for (mig 109), or drop the column plus its write sites if the comp-without-suppressing-billing gap is accepted.

### D08. rep_player_dues_schedules.budget_line_id — never written; silently breaks a delete guard

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-column | **Removal:** no (consolidation/hygiene)
- **Where:** docs/agents/db/DATA_DICTIONARY.md:2907; docs/agents/db/DATA_DICTIONARY.md:2926; app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]/route.ts:114
- **Evidence (finder):** budget_line_id is never set by either dues-schedule insert path (verified always NULL in dev+prod per DATA_DICTIONARY.md L2907), yet lines/[lineId]/route.ts:114-123's DELETE handler queries `rep_player_dues_schedules WHERE budget_line_id = lineId` specifically to decide whether to BLOCK deleting a budget line that already generated dues — scheduleIds is therefore always empty, so the intended safety check silently never fires.
- **Verification:** Read lines/[lineId]/route.ts:114-123 DELETE handler — queries rep_player_dues_schedules WHERE budget_line_id=lineId for the 409 guard; identical on master (prod). Checked both insert paths: budget-generated upsert (generate-installments/route.ts:118-132) and manual createRepPlayerDuesSchedule (lib/db.ts:8144-8158) — neither sets budget_line_id. Migration 028 added the column "to trace back to originating budget plan" but nothing backfills it. Live: pg_trigger on rep_player_dues_schedules = [] dev AND prod (no trigger sets it). count(*)/count(budget_line_id): dev 12/0, prod 0/0 — always NULL. DATA_DICTIONARY.md:2907,2926 documents the same fact independently.
- **Verifier notes:** Genuine silent correctness bug, not simple dead-column removal (finder correctly scored removal_candidate:false). ON DELETE SET NULL FK gives no DB-level backstop either. Fix option (b) precedent exists: generate-installments/route.ts:60-76 does the equivalent guard correctly via program_year_id+source='budget_generated', no budget_line_id needed.
- **Proposed action:** This is a correctness bug wearing dead-column clothing, not a simple drop — owner must choose: (a) wire budget_line_id at dues-schedule insert time so the delete guard actually works, or (b) drop the column and replace the guard with a real check (e.g. by program_year_id + player linkage).

### D09. Five platform-admin tables built but never exercised (keep-dormant-by-design)

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-table | **Removal:** no (consolidation/hygiene)
- **Where:** docs/agents/db/DATA_DICTIONARY.md:4221
- **Evidence (finder):** DATA_DICTIONARY.md L4221: 'Five tables are built-but-(barely-)used today. platform_user_notes (0 rows both envs - full CRUD+UI exist, never exercised), platform_bulk_operations (0/0 - never run), platform_metric_snapshots (0/0 - never taken), platform_catalog_campaigns (0/0 - pure planning scaffolding, no checkout/Stripe consumer), platform_plan_versions (1 seed row, no app writer).' Verified platform_user_notes count(*)=0 via db-query.mjs on both --dev and --prod.
- **Verification:** Live counts (db-query.mjs, dev+prod) match dictionary exactly: user_notes 0/0, bulk_operations 0/0, metric_snapshots 0/0, catalog_campaigns 0/0, plan_versions 1/1. CRUD+UI confirmed real: notes route used by OrgDetailClient/CustomerUsersClient; bulk-operations route+client+page+nav; metric-snapshots route+button component; campaigns route used by PlansPricingClient; plan_versions read by plans-pricing/page.tsx:169. pg_trigger both envs: only FK RI_ConstraintTrigger, no custom triggers. pg_policies: zero on all five. git log: only old pre-existing commits, none recent. git grep master: same routes/pages ship on prod - live shipped code, not scaffolding.
- **Verifier notes:** Finding already declines removal (removal_candidate:false), routes to owner decision. Nothing found changes that; all claims verified on both envs.
- **Proposed action:** keep-dormant-by-design per the dictionary's own explicit framing (built ahead of feature launch, not abandoned) — do not mechanically drop; flag to product owner as a single batch decision: finish/launch these features, or formally retire the scaffolding.

### D10. 'Dev/prod structurally in sync' claim is incomplete — real drift exists in RLS policies and FK constraints

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** other | **Removal:** no (consolidation/hygiene)
- **Where:** docs/agents/db/schema-snapshots/DRIFT_dev_vs_prod.md:1-102; docs/agents/db/schema-snapshots/SNAPSHOT_MANIFEST.json
- **Evidence (finder):** DRIFT_dev_vs_prod.md reports 51 divergences (0 table diffs, 24 column diffs, 7 dev-only+9 prod-only constraint names, 1 prod-only CHECK) so 'in sync' was never literally true by the tool's own numbers, though most of those ARE cosmetic naming. Bigger gap: the refresh script only diffs relrowsecurity ('RLS state differs (0)') and never queries pg_policies content, so the prod-only wide-open anon ALL policies and the prod-only duplicate/missing FK constraints on games/teams (companion findings) were not caught by the freshness gate.
- **Verification:** DRIFT_dev_vs_prod.md confirms 51 divergences (not literally "in sync"). refresh-db-snapshots.mjs SQL.rls only diffs relrowsecurity + CHECK, never pg_policies. Live pg_policies query both envs: prod=245 vs dev=235 policies; 7 prod-only wide-open policies absent from dev ("Allow public full access to {announcements,diamonds,age_groups,games,teams,tournaments}", roles=anon, qual=true; +2 on pools). pg_constraint on games/teams: prod has literal duplicate FKs (e.g. both games_home_team_id_fkey and fk_games_home_team) dev lacks. git log: script untouched since freshness-gate commit.
- **Verifier notes:** Finding understates it — FK issue is literal duplicate constraints on prod (4 games + 2 teams), not just renames, invisible to the name-keyed diff. The 7 prod-only wide-open anon/authenticated ALL policies are real and live now; worth flagging as a security-posture question, separate from the tooling fix.
- **Proposed action:** Extend scripts/refresh-db-snapshots.mjs to also snapshot pg_policies (policyname/roles/cmd/qual/with_check) so future drift reports catch policy-level divergence, not just the RLS on/off bit; a clean DRIFT_dev_vs_prod.md should not be read as proof of RLS/constraint parity.

### D11. idx_games_generator_locked — partial index never hit; app filters generator_locked in JS after fetch

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-index | **Removal:** yes
- **Where:** supabase/migrations/105_schedule_generator_locks.sql:6-9; app/api/admin/games/route.ts:415; lib/game-delete-policy.ts:25,29; lib/db.ts:1588,1628,1652
- **Evidence (finder):** Index: CREATE INDEX idx_games_generator_locked ON games(tournament_id, division_id, generator_locked) WHERE generator_locked=true. idx_scan=0 on BOTH prod and dev (games table). Every read of generator_locked in the codebase is in-memory JS filtering on already-fetched rows (e.g. app/api/admin/games/route.ts:415 `.filter(e => ... && !e.generator_locked)`); no `.eq('generator_locked', ...)` or raw SQL WHERE exists anywhere. Migration comment describes an intended DB-filtered query pattern that was never implemented that way.
- **Verification:** Read migration 105: partial index matches finder exactly. Full grep `generator_locked` across dev tree (app/, lib/, tests/, docs/) — every read site (route.ts:415, game-delete-policy.ts:25,29, db.ts:1588/1628/1652) is JS in-memory filtering post-fetch; zero `.eq('generator_locked'` or SQL WHERE anywhere. `git grep generator_locked master` shows identical pattern on prod's live tree. Live pg_stat_user_indexes re-queried: idx_scan=0 on BOTH dev and prod. pg_proc/pg_policies grep for the column = 0 matches; pg_trigger on games = only FK RI_ConstraintTriggers, none reference it. git log -3 on the usage files shows unrelated recent commits, no concurrent work adding DB-side filtering.
- **Verifier notes:** Column games.generator_locked itself is live and must stay — only the redundant partial index is dead. Evidence is mechanically airtight; classified owner-decision only because it's a DB drop on the hot `games` table, per the fixed rule that all DB drops get that class.
- **Proposed action:** Drop idx_games_generator_locked; if a future schedule-regen query needs a true DB-side WHERE generator_locked=true, re-add it then. Confirm with /db before dropping since games is a hot operational table.

### D12. idx_platform_audit_actor never usable — actor search done client/JS-side, never a DB filter

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-index | **Removal:** yes
- **Where:** app/platform-admin/audit/page.tsx:71-102; app/api/platform-admin/audit/export/route.ts:48-76
- **Evidence (finder):** Index: CREATE INDEX idx_platform_audit_actor ON platform_audit_log(actor_email, created_at DESC). idx_scan=0 prod+dev. Both callers filter platform_audit_log only by created_at/action/org_id via Postgrest .gte/.lte/.eq, then apply the free-text 'actor' search as `rows.filter(r => r.actorEmail.toLowerCase().includes(lq))` in JS on the already-paginated result (page.tsx:98-102, export/route.ts:74-76). No `.eq('actor_email', ...)` exists against this table anywhere.
- **Verification:** Both files query platform_audit_log only via created_at/action/org_id, then filter actor_email in JS post-fetch (page.tsx:98-104, export/route.ts:74-78). git show master:<path> confirms same pattern on prod. Grep of actor_email repo-wide found zero .eq/.ilike('actor_email') against platform_audit_log (only such filter hit is on unrelated platform_admin_visits table). orgs/[id]/page.tsx queries platform_audit_log filtering only by org_id. DB catalogs dev+prod: no triggers, no RLS policies, no pg_proc mentions platform_audit_log. pg_stat_user_indexes live: idx_scan=0 both envs. No UAT specs cover audit/export. git log -5 shows no recent activity on these files or migration 018.
- **Verifier notes:** Genuinely dead index by current code shape, but a DB DROP on the audit-log/compliance surface is irreversible-ish and product-adjacent, so owner-decision regardless of trace confidence. Finder's alt (push actor filter into query, keep index) is a valid separate product call.
- **Proposed action:** Drop idx_platform_audit_actor, or (preferred if actor filtering is wanted) change the audit page/export to push actor filtering into the query and keep the index — currently neither happens, so the index is pure dead weight.

### D13. organization_members_invited_email_idx unusable — query uses plain equality, index requires lower() expr

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-index | **Removal:** yes
- **Where:** lib/invite-reconciliation.ts:69-76; lib/invite-reconciliation.ts:146-165; supabase/migrations/128_member_invited_email.sql:29-31
- **Evidence (finder):** Index: CREATE INDEX organization_members_invited_email_idx ON organization_members USING btree (lower(invited_email)) WHERE (status='invited'). Both live call sites do `.eq('status','invited').eq('invited_email', email)` — a PLAIN column comparison, not `lower(invited_email)`. Postgres cannot substitute an expression index for a plain-column predicate, so this index can never be selected by the current query text (idx_scan=0 prod+dev), despite inline comments (lines 69, 146) asserting it 'uses the lower(invited_email) partial index (mig 128)'.
- **Verification:** invite-reconciliation.ts:72-76,161-168 use .eq('invited_email', email) plain equality, never lower(). Mig 128:30-32 index is btree(lower(invited_email)) WHERE status='invited'.
DB proof (dev+prod): idx_scan=0 both envs. EXPLAIN w/ enable_seqscan=off: plain-eq query only usable as full-scan+Filter, cost 3.46 > seqscan 1.57 (never chosen by planner); lower()-eq query gets real Index Cond, cost 2.35 (index works, not for shipped query). Plan docs specified lower() querying; impl diverged.
Traps: git grep master=same bug live in prod; git log shows no in-flight fix; pg_proc/policies zero refs; sibling assistant_invite_tokens (mig174) has same mismatch, corroborating systemic issue.
- **Verifier notes:** 'Never selected' slightly absolute (huge tables could favor full partial-index scan) but confirmed mechanically today. Writers already lowercase on insert so queries are correct by coincidence; only index/query-shape mismatched. Same pattern also on assistant_invite_tokens_email_idx (mig174), out of scope. Routing to /db vs unilateral fix/drop is correct.
- **Proposed action:** Either fix the query to filter on the lower() expression (matches original design intent, mig 128) or drop the index as dead — flag to /db, this is an invite-security-adjacent path so don't silently pick one.

### D14. idx_platform_admin_visits_path_time dead — no code filters/orders by path; sibling actor_time idx has real scans

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-index | **Removal:** yes
- **Where:** lib/platform-admin-visits.ts:3-18
- **Evidence (finder):** Index: CREATE INDEX idx_platform_admin_visits_path_time ON platform_admin_visits(path, visited_at DESC). idx_scan=0 prod+dev. lib/platform-admin-visits.ts is the ONLY code touching this table and its sole read query is `.eq('actor_email', ...).order('visited_at desc').limit(1)` — never filters/orders by path. Sibling index idx_platform_admin_visits_actor_time (actor_email, visited_at DESC) on the SAME table shows idx_scan=26 on prod, proving the table gets real traffic and ruling out 'table too small to ever use an index' as the explanation.
- **Verification:** lib/platform-admin-visits.ts: only query is .eq('actor_email',...).order('visited_at desc').limit(1) — never touches path. git grep (repo+master) found no other code referencing platform_admin_visits. Callers: page.tsx (reads only visited_at) and visits/route.ts (insert-only). db-query.mjs BOTH envs: path_time idx_scan=0 dev+prod; sibling actor_time idx=272 dev/26 prod (real traffic). pg_trigger/pg_proc/pg_policies for table all empty. DATA_DICTIONARY.md independently states path "selected but never consumed" — corroborates without relying on finder. Ruled out "top source paths" false lead (unrelated table). Last file touch = old commit, not concurrent work.
- **Verifier notes:** Genuinely dead index, independently corroborated by the project's Data Dictionary. risk_class=owner-decision only because rubric mandates that for ALL DB drops — mechanically as safe as a drop gets: 0 scans both envs, 0 code paths, 0 DB-side consumers.
- **Proposed action:** Drop idx_platform_admin_visits_path_time; keep idx_platform_admin_visits_actor_time which is the one actually serving getPreviousPlatformAdminVisit().

### D15. idx_platform_plan_versions_status_time dead — plans-pricing page orders unfiltered, never filters by status

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-index | **Removal:** yes
- **Where:** app/platform-admin/plans-pricing/page.tsx:169-172
- **Evidence (finder):** Index: CREATE INDEX idx_platform_plan_versions_status_time ON platform_plan_versions(status, created_at DESC). idx_scan=0 prod+dev. The only query against this table is `.select(...).order('created_at', {ascending:false}).limit(12)` — no `.eq('status', ...)` anywhere in the codebase against platform_plan_versions.
- **Verification:** Grep `platform_plan_versions` repo-wide: only page.tsx:169-172 queries it (`.order('created_at',{ascending:false}).limit(12)`, no `.eq('status',...)`) — confirmed identical on master (prod) via git show. PlansPricingClient.tsx only does client-side `status===...` string checks for badges, no server filter. DB (dev+prod via db-query.mjs): idx_scan=0 both envs; no triggers/functions/RLS policies reference the table; table has exactly 1 row in both envs (seed row), so a status filter would gain nothing anyway. TODO.md marks this "read-only foundation" as [x] complete (not mid-build). git log shows last touch in old commit 28fe04d7; git status clean; no scripts/UAT specs reference it.
- **Verifier notes:** Rubric requires owner-decision for all DB drops regardless of confidence, not because a live use was found. Bonus: table has only 1 row in both envs, so the drop is zero-risk/zero-migration — just `DROP INDEX idx_platform_plan_versions_status_time`.
- **Proposed action:** Drop idx_platform_plan_versions_status_time.

### D16. idx_platform_addon_catalog_status_label dead — addon list orders unfiltered, never filters by status

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** db-index | **Removal:** yes
- **Where:** app/platform-admin/plans-pricing/page.tsx:174-176
- **Evidence (finder):** Index: CREATE INDEX idx_platform_addon_catalog_status_label ON platform_addon_catalog(status, label). idx_scan=0 prod+dev. The only query is `.select(...).order('label', {ascending:true})` — no `.eq('status', ...)` anywhere in the codebase against platform_addon_catalog.
- **Verification:** Re-verified: page.tsx:173-176 (dev tree) and git show master:same-file both show only `.select(...status...).order('label')`, no `.eq('status',...)`. Repo-wide grep (*.ts/tsx/mjs/js/sql) for platform_addon_catalog hits only this page.tsx + migrations 058 (creates table+index) and 065 (INSERT/UPDATE seeds, no status-filtered SELECT). PlansPricingClient.tsx: addon.status used only for a display badge (line 2156), never .filter(). Live DB: pg_stat_user_indexes idx_scan=0 dev AND prod. pg_trigger/pg_policies/pg_proc on both envs: no hits for this table/index. No cron, seed script, UAT spec, or API route touches this table. git log shows no recent/concurrent edits to page.tsx.
- **Verifier notes:** Index was speculatively created with the table in migration 058, anticipating a status filter never built - status is display-only in the admin UI. Zero live-reference risk; owner-decision flagged only per blanket DB-drop rule. Table is small so even a filtered query wouldn't lean on this index much.
- **Proposed action:** Drop idx_platform_addon_catalog_status_label.

### D17. Three rep_team_* prefix-redundant indexes fully covered by sibling composite UNIQUE indexes

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** duplicate | **Removal:** yes
- **Where:** pg_indexes: rep_team_tags_team_idx / rep_team_tags_name_uniq; pg_indexes: rep_team_lineup_templates_team_idx / rep_team_lineup_templates_name_uniq; pg_indexes: rep_team_tags_org_shared_idx / rep_team_tags_org_name_uniq
- **Evidence (finder):** rep_team_tags_team_idx (team_id, kind), no predicate, is a leading prefix of UNIQUE rep_team_tags_name_uniq (team_id, kind, lower(btrim(name))) — redundant. rep_team_lineup_templates_team_idx (team_id, program_year_id) is a leading prefix of UNIQUE rep_team_lineup_templates_name_uniq (team_id, program_year_id, lower(btrim(name))) — redundant. rep_team_tags_org_shared_idx (org_id, kind) WHERE team_id IS NULL is a leading prefix of UNIQUE rep_team_tags_org_name_uniq (org_id, kind, lower(btrim(name))) WHERE team_id IS NULL, SAME predicate — redundant. prod idx_scan=0 all three; dev idx_scan = 62 / 585 / 0 (real traffic on two, but fully served by the covering unique index's leading columns).
- **Verification:** Live pg_indexes dev+prod match finder's 3 defs exactly: each plain index is a strict prefix of its sibling UNIQUE index, same predicate. pg_stat_user_indexes: dev 62/585/0, prod 0/0/0 scans - matches claim. Migrations 159/181/184 show these were added for list-query support, unaware the UNIQUE index already covers that prefix. lib/db.ts getRepTeamTags() filters exactly (team_id,kind), served by the UNIQUE index prefix. pg_constraint: no composite FK on these columns. pg_trigger: none on either table. ON CONFLICT usages target only join-table PKs, never these tables. git grep master: tables/migrations absent from master entirely (stale, last commit 2026-06-25).
- **Verifier notes:** No live reference or dormant purpose found; finding holds. owner-decision per policy (all DB drops), not residual doubt - route via /db before DROP INDEX, dev first.
- **Proposed action:** Confirm with /db no code relies on these staying separate non-unique indexes, then drop all three, relying on the sibling UNIQUE indexes for the same lookups.

### D18. PROD games: duplicate FKs on diamond_id/home_team_id (one conflicting) + no FK on division_id

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** db-constraint | **Removal:** yes | **~LOC/objects:** 3
- **Where:** prod live: pg_constraint (games); dev live: pg_constraint (games)
- **Evidence (finder):** Live pg_get_constraintdef on prod games: fk_games_home_team ON DELETE CASCADE vs games_home_team_id_fkey ON DELETE SET NULL — two FKs on SAME column (home_team_id->teams.id) with conflicting actions. Also fk_games_diamond + games_diamond_id_fkey both SET NULL on diamond_id (pure duplicate). Prod has ZERO FK on division_id->divisions.id; dev enforces it via games_age_group_id_fkey ON DELETE CASCADE. away_team_id also differs: dev SET NULL vs prod's fk_games_away_team CASCADE.
- **Verification:** Live pg_get_constraintdef: PROD home_team_id has fk_games_home_team + games_home_team_id_fkey BOTH "ON DELETE CASCADE" (identical, not conflicting as claimed). diamond_id: both SET NULL (true duplicate, matches). division_id: zero FK on prod; dev has games_age_group_id_fkey CASCADE. pg_trigger empty both envs. Root cause: migrations/093_divisions_rename.sql STEP1 drops fk_games_age_group pre-rename, never recreated. Precedent: migs 080/082 already fixed sibling dup FKs same table, missed these two. Orphans=0 now, but divisions delete route has no games-guard.
- **Verifier notes:** Core claim (dup FKs + missing division_id FK) verified real. But "conflicting actions" on home_team_id is wrong: live data shows both are CASCADE, a plain duplicate like diamond_id, not a semantic conflict. Also flag divisions DELETE route has no games-guard - an adjacent, arguably more urgent app-layer gap alongside the DB fix.
- **Proposed action:** Decide canonical delete semantics per column, drop the redundant/conflicting duplicate constraint on home_team_id and diamond_id, and add the missing division_id FK to prod (integrity gap: deleting a division on prod leaves orphaned games.division_id).

### D19. 3 confirmed dead columns ready for physical drop (zero code references)

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** db-column | **Removal:** yes | **~LOC/objects:** 3
- **Where:** docs/agents/db/DATA_DICTIONARY.md:727 (pools.settings); docs/agents/db/DATA_DICTIONARY.md:4483 (platform_plan_snapshots.snapshot); docs/agents/db/DATA_DICTIONARY.md:4592 (platform_plan_versions.target_version_id)
- **Evidence (finder):** Dictionary flags all three as dead ('no code reads/writes it' / 'never SELECTed by any code' / 'never written... never SELECTed'). Fresh grep across app/lib/**/*.{ts,tsx} for pools.settings-style access, platform_plan_snapshots, and target_version_id returns 0 files for all three, confirming the dead-column verdict still holds today.
- **Verification:** grep app/lib: 0 hits for pools.settings, but scripts/ has a live writer finder missed: seed-bl-u18-splitpool.mts:80 inserts {settings:{}} into pools - PostgREST rejects unknown-column inserts, breaking this script on drop. mirror-tournament.mjs:94 registers pools:['settings'] in JSONB_COLS.
Table-name error: dict:4483 is platform_plan_versions.snapshot; no "platform_plan_snapshots" table exists. dict:4592 is platform_catalog_change_requests.target_version_id (FK->platform_plan_versions), not a platform_plan_versions col. DROP targets wrong tables for 2/3 items.
Other 2 confirmed dead: grep+master+pg_proc/trigger/policies dev+prod empty; SELECTs omit both; target_version_id NULL everywhere.
- **Verifier notes:** Only 2 of 3 are clean as scoped: platform_plan_versions.snapshot and platform_catalog_change_requests.target_version_id (finding mislabels the latter as platform_plan_versions.target_version_id on a fabricated platform_plan_snapshots table). pools.settings has real writers in seed-bl-u18-splitpool.mts + mirror-tournament.mjs to update alongside any drop. All are DB drops -> owner-decision.
- **Proposed action:** Drop pools.settings, platform_plan_snapshots.snapshot, and platform_plan_versions.target_version_id (and its now-pointless FK) in a migration to both envs; owner sign-off recommended since these carry historical data.

### D20. league_notification_log — dead/legacy table, superseded by league_email_log

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** db-table | **Removal:** yes | **~LOC/objects:** 1
- **Where:** supabase/migrations/020_house_league.sql; docs/agents/db/DATA_DICTIONARY.md:3320; docs/agents/db/DATA_DICTIONARY.md:3678; scripts/.dictionary-coverage-baseline.json:35
- **Evidence (finder):** git grep -E "['\"]league_notification_log['\"]" across app/lib/components/scripts in both dev (incl. untracked) and master matches ONLY scripts/.dictionary-coverage-baseline.json (a coverage-tracking artifact, not real usage) — zero real code references either tree. pg_stat_user_tables: n_live_tup=0 in both dev and prod; only 4 RI (FK) constraint triggers + 1 default RLS policy, no custom logic. DATA_DICTIONARY.md L3678 already calls it 'LEGACY / DEAD table... superseded by league_email_log... safe to drop.'
- **Verification:** git grep league_notification_log across app/lib/components/scripts (dev+untracked, and master): zero hits outside docs/schema-snapshots/coverage-baseline. Confirmed league_email_log has live code (lib/db.ts:3299 insert, :3314 select) — real successor. pg_stat_user_tables dev+prod: n_live_tup=0 both; seq_scan timestamps match league_email_log's exactly (12:55:21) = tooling sweep artifact, not app traffic. pg_trigger (non-internal) empty both envs. pg_proc source search empty both envs. No migration after 020 touches it.
- **Verifier notes:** Core claim holds (dead, empty, real successor exists) but finder said "1 default RLS policy, no custom logic" — actually a bespoke SELECT policy scoped via league_seasons→organization_members exists (dormant since nothing queries the table). Migration should explicitly drop that policy too, not just wave it off as boilerplate.
- **Proposed action:** Drop league_notification_log table via migration after owner sign-off (empty in both envs, no code path touches it, admin Notifications UI actually writes league_email_log instead).

### D21. venue_facilities.settings — unwired jsonb, only touched by mirror-script exclude lists

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** db-column | **Removal:** yes | **~LOC/objects:** 1
- **Where:** docs/agents/db/DATA_DICTIONARY.md:1036; scripts/mirror-tournament.mjs:96; scripts/mirror-battle-of-the-bats.mjs:86
- **Evidence (finder):** Repo-wide, the only appearances of venue_facilities' `settings` field are scripts/mirror-tournament.mjs:96 and mirror-battle-of-the-bats.mjs:86, both listing it in an EXCLUDE set for a data-mirroring utility — no app read or write path touches it. DATA_DICTIONARY.md L1036 calls it 'DEAD/unwired'.
- **Verification:** All traps empty. grep venue_facilities app/**,lib/**,scripts/**+git grep master: zero read/write of settings; venues route insert/update never sets it; mapFacility() never surfaces it. DB dev+prod: pg_trigger=only FK RI triggers; pg_proc prosrc search=empty; pg_policies quals=only tournament_id/can_access_tournament(). Data: count(settings<>'{}')=0/33 dev,0/7 prod. Cron/email/UAT/platform-admin=zero hits.

Correction: mirror-tournament.mjs JSONB_COLS.venue_facilities=Set(['settings']) is NOT exclude; lit(val,jsonb.has(c)) casts an INCLUDED col during copy-insert. Real exclude list (NULL_COLS) nulls source_org_facility_id, not settings. Mirror scripts copy the empty value through harmlessly.
- **Verifier notes:** Dead-column claim holds (matches DATA_DICTIONARY.md:1036). Downgraded bc finder mischaracterized mirror-script as exclusion when it's inclusion+cast. Mig 097 added as placeholder alongside divisions.settings (IS wired, shared.ts:185); venue_facilities.settings alone never built out. Fix: drop col both envs + update the two mirror scripts' maps together.
- **Proposed action:** Drop settings jsonb column from venue_facilities.

### D22. tournament_roster_players.updated_at — dead boilerplate, table has no UPDATE path

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** db-column | **Removal:** yes | **~LOC/objects:** 1
- **Where:** docs/agents/db/DATA_DICTIONARY.md:1155; docs/agents/db/DATA_DICTIONARY.md:1161
- **Evidence (finder):** DATA_DICTIONARY.md L1161: 'updated_at is DEAD: no code ever UPDATEs a row [resubmit is delete + reinsert], so it always equals created_at.' Gotcha 3 (L1155) confirms both writers (coach event-roster submit, admin day-of gate-roster) always DELETE-then-INSERT, never PATCH/UPDATE a row.
- **Verification:** Premise falsified: app/api/admin/check-in/route.ts save_gate_roster (L259-267) has a real UPDATE — .update({name,jersey_number,date_of_birth,position}).eq('team_id',..).eq('id',p.id) — added in a1eafe36 'non-destructive gate roster save J8-010' 2026-06-15, present on both dev and master(prod). Dictionary's 'no UPDATE path' text is from the table's 2026-06-11 sealing, BEFORE J8-010 - dictionary is stale. Also grep updated_at in both writers = 0 matches (UPDATE omits it); pg_trigger on dev = only FK RI triggers, no auto-bump. So value won't diverge today, but not because no UPDATE exists. Rows 0/0 dev+prod confirmed via db-query.mjs.
- **Verifier notes:** Not a safe solo drop. Table now has a real in-place-edit path (J8-010); either wire updated_at into that UPDATE or fix the dictionary's stale 'no UPDATE path' claim first. Owner call, not settled hygiene.
- **Proposed action:** Low-priority hygiene: drop updated_at from tournament_roster_players (boilerplate column that can never diverge from created_at). Low value — bundle with a broader boilerplate sweep rather than doing solo.

### D23. PROD teams table: exact-duplicate FK constraint pair on division_id

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** db-constraint | **Removal:** yes | **~LOC/objects:** 1
- **Where:** prod live: pg_constraint (teams)
- **Evidence (finder):** Live pg_get_constraintdef on prod teams: fk_teams_age_group and teams_age_group_id_fkey are byte-identical — both 'FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE'. Dev has only one (teams_age_group_id_fkey). Pure redundant duplicate maintained on every write.
- **Verification:** Live query confirms: prod teams has both fk_teams_age_group and teams_age_group_id_fkey, byte-identical FK defs; dev has only teams_age_group_id_fkey. Grepped dev+master *.ts/tsx/js/mjs for both names: zero app-code hits. pg_trigger(teams): none. pg_policies(teams, 5 rows): none reference constraint names. No live blocker found.

Drift already documented, not new: DATA_DICTIONARY.md:559 flags "prod also carries fk_teams_age_group ... gotcha in code hard-codes dev alias"; DRIFT_dev_vs_prod.md lists it "Only in PROD". Precedent mig 093 STEP1 fixed identical sibling (games.age_group_id): dropped fk_games_age_group, KEPT games_age_group_id_fkey (dev's name) - opposite of this proposal's choice.
- **Verifier notes:** Duplicate real/verified/zero-reference, but proposal names wrong survivor. Precedent (mig 093, games.age_group_id) kept dev-shared name. Correct shape: drop fk_teams_age_group, keep teams_age_group_id_fkey; ship as versioned migration + refresh DATA_DICTIONARY/DRIFT snapshots; needs owner-approved prod apply, not ad hoc drop.
- **Proposed action:** DROP one of the two identical constraints on prod (e.g. drop teams_age_group_id_fkey, keep fk_teams_age_group to match the fk_ naming already used for the other teams/tournament FK).

### D24. league_notification_log — dead table, zero code references, confirmed superseded by league_email_log

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** db-table | **Removal:** yes | **~LOC/objects:** 1
- **Where:** docs/agents/db/DATA_DICTIONARY.md:3320; docs/agents/db/DATA_DICTIONARY.md:3678
- **Evidence (finder):** DATA_DICTIONARY.md already documents this as 'LEGACY/DEAD... superseded by league_email_log, with zero reads/writes in current code (verified repo-wide)'. Fresh grep -r 'league_notification_log' across app/lib/**/*.{ts,tsx} returns 0 files, corroborating the dictionary's claim is still current.
- **Verification:** git grep league_notification_log on master + working-tree dev (*.ts/tsx/mjs/js, scripts/*, tests/*, cron/*, sw.js): zero hits except docs/dictionary/schema-snapshot files + migrations/020 + archived plan. git log -5 on introducing commit (2026-05-08): no recent activity. DB live (dev+prod via db-query.mjs): 0 triggers, 0 pg_proc funcs reference it, row count=0 both envs. NEW: found a live RLS policy on the table in BOTH dev+prod - "org members can read notification log" (pg_policies), which the finder's evidence omitted (dormant, drops with the table, not a blocker). Also seq_scan=211 dev/12 prod despite 0 rows/0 code refs - stale counters, not proof of use, but unexplained.
- **Verifier notes:** Dead-table claim holds (zero code refs repo-wide both branches, zero triggers/functions). Downgrading only risk_guess: this is a DROP TABLE, and per task rules ALL DB drops are owner-decision regardless of confidence, not "safe-mechanical". Proceed only after owner sign-off; note migration also removes the "org members can read notification log" RLS policy as a side effect.
- **Proposed action:** DROP TABLE league_notification_log in a migration applied to both dev and prod; update DATA_DICTIONARY.md to remove the entry once dropped.

### D25. platform_catalog_change_applications: request_time + surface_time indexes dead, list view fetches unfiltered

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** db-index | **Removal:** yes
- **Where:** app/platform-admin/change-requests/page.tsx:17-21; app/platform-admin/change-requests/ChangeRequestsClient.tsx:347-348; lib/platform-catalog-approval.ts:75-83
- **Evidence (finder):** Indexes: idx_platform_catalog_change_applications_request_time (change_request_id, applied_at DESC) and idx_platform_catalog_change_applications_surface_time (surface, applied_at DESC). Both idx_scan=0 prod+dev. The only read query (page.tsx:18-21) is `.select(...).order('applied_at', {ascending:false}).limit(200)` with NO filter on change_request_id or surface. ChangeRequestsClient.tsx:347-348 groups applications by change_request_id via an in-memory JS Map, not a DB query. lib/platform-catalog-approval.ts only INSERTs into this table.
- **Verification:** Confirmed: page.tsx:17-21 unfiltered order+limit; Client.tsx:344-351 groups in-memory (Map); approval.ts + all 10 call sites (git grep app/api/platform-admin/*) are INSERT-only. No .eq(change_request_id)/.eq(surface) anywhere in dev or master. pg_stat_user_indexes idx_scan=0 both envs. Rows: prod 18, dev 14. No hits in scripts/tests/cron/sw.js.
BUT change_request_id FK has confdeltype='r' (RESTRICT, live pg_constraint check) - dictionary gotcha documents it. Indexing a RESTRICT-FK col is standard practice even unused; no DELETE route exists today so it's dormant, unlike surface_time which is purely dead.
- **Verifier notes:** surface_time: clean drop, zero reference/FK role. request_time: zero-scan too but sits on RESTRICT FK col - different justification than finder's framing; row count (14-18) makes perf moot anyway. Both are DDL drops = owner-decision.
- **Proposed action:** Drop both idx_platform_catalog_change_applications_request_time and idx_platform_catalog_change_applications_surface_time; the applied_at-ordered fetch is served fine without them at current/foreseeable row counts (18 rows on prod).

### D26. 13 redundant indexes confirmed with idx_scan=0 on prod, each fully covered by a wider/unique index

- **Verdict:** REFUTED | **Risk:** owner-decision | **Type:** db-index | **Removal:** yes | **~LOC/objects:** 13
- **Where:** prod live: pg_stat_user_indexes; docs/agents/db/schema-snapshots/schema-dump-indexes-prod.json
- **Evidence (finder):** pg_stat_user_indexes on prod shows idx_scan=0 for indexes whose columns are a strict, unconditional prefix of another index on the same table (WHERE-clause parity checked to exclude partial-index false positives): rep_team_tags_org_shared_idx, rep_team_tags_team_idx, rep_team_lineup_templates_team_idx, rep_fundraiser_entries_fundraiser_idx, rep_team_lineups_event_idx, rep_team_lineup_entries_lineup_idx, rep_team_event_attendance_event_idx, chat_message_reactions_message_idx, chat_poll_votes_message_idx, accounting_entries_ledger_id_idx, league_registrations_season_idx, league_games_season_idx, rep_tryout_registrations_year_idx.
- **Verification:** Prod: all 12 tables have 0 rows - idx_scan=0 across EVERY index incl the claimed covering ones, so 0 scans proves nothing. Dev (real traffic) contradicts fully-covered claim: lineup_templates_team_idx=585 vs covering name_uniq=0; lineups_event_idx=210 vs event_id_key=40; team_tags_team_idx=62 vs name_uniq=0; lineup_entries_lineup_idx=6 vs lineup_id_player_id_key=0; event_attendance_event_idx=145 (sibling=206); chat msgs message_idx=15/8. Planner prefers narrow index for equality lookups. Migs recent (181/184=f697d31c Jul13/26); prod-empty=low adoption not dead. Only lineups_event_idx is byte-dup of event_id_key. 5 others (ledger_id,2x season_idx,fundraiser_idx,year_idx) 0 on dev too.
- **Verifier notes:** Don't batch-drop as 'confirmed redundant.' Only rep_team_lineups_event_idx is a genuine exact duplicate (safe alone). The other 12 need re-eval once features get real prod traffic - dev shows the planner actively picks several 'redundant' indexes over the claimed wider one, risking read regressions once these active features see production usage.
- **Proposed action:** Drop these 13 unused single-column indexes on prod+dev after a brief monitoring window; each is already served by an existing composite/unique index with the same leading column(s) on the same table.


## Workstream E — Dependencies, flags, config, scripts

### E01. 13 Tailwind theme-extension tokens in tailwind.config.ts have zero class usage

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** tailwind | **Removal:** yes | **~LOC/objects:** 20
- **Where:** tailwind.config.ts:16 (fl-bg/fl-surface/fl-border/fl-accent/fl-muted); tailwind.config.ts:16 (blueprint-dim, logic-lime-dim); tailwind.config.ts:37-40 (score-lg, score-md, hud-xs); tailwind.config.ts:56 (hud-inner); tailwind.config.ts:69-70 (grid-dense, grid-sm); tailwind.config.ts:79,91 (scan-line, bracket-wire)
- **Evidence (finder):** Repo-wide string-scan (app/**/*.tsx, components/**/*.tsx, plus a whole-repo re-check incl. lib/css) for each token finds it appears ONLY inside tailwind.config.ts itself — 0 usages as a Tailwind utility class anywhere. Contrast: sibling tokens in the same objects ARE used (fl-text: 41 files; hud/hud-lime via `shadow-hud`/`shadow-hud-lime` in components/ui/HudPanel.tsx; grid/grid-faint via `bg-grid`/`bg-grid-faint` in app/not-found.tsx; hud-boot/data-flow used once each; stat via `text-stat` in components/ui/StatDisplay.tsx) — confirming these 13 specific keys are genuinely dead, not a scan artifact.
- **Verification:** Grepped all 13 tokens across app/, components/, lib/, tests/, memory/, scripts/ (dev) and via git grep master (prod): every hit is inside tailwind.config.ts itself, zero elsewhere. One near-hit, var(--fl-surface) in customer-users.module.css, is a plain CSS custom prop (flagged elsewhere as an undefined ghost token), not the Tailwind class. No @apply in any *.css; Tailwind v3.4.19 classic config, no v4 duplication. Commit e657d2c5 (3 days ago) removed one dead token (pulse-lime) from this file as cleanup, left these 13, which remain zero-reference. Sibling used tokens trace to HudPanel.tsx/StatDisplay.tsx, but neither is imported anywhere - palette is orphaned from a May 2026 prototype.
- **Verifier notes:** Confirmed safe to delete. Bonus: HudPanel.tsx/StatDisplay.tsx (using surviving sibling tokens) are themselves never imported anywhere - broader HUD mini design-system may warrant its own finding.

### E02. "resend" npm SDK dependency is never imported anywhere

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dep | **Removal:** yes
- **Where:** package.json:38; lib/email.ts:1-50; lib/email-sender.ts
- **Evidence (finder):** grep for `from ['"]resend|require\(['"]resend|import\(['"]resend` across the whole repo (excl. node_modules) returns 0 matches. lib/email.ts sends via raw `fetch('https://api.resend.com/emails', ...)` with a manual Authorization header; lib/email-sender.ts does the same. The `resend` package (^6.12.2, listed in dependencies) is dead weight.
- **Verification:** grep -riE "resend" whole repo: 91 files, all literal "api.resend.com" URLs or route names (resend-invite/resend-access) or docs; zero `import...from 'resend'`. Regex `from ['"]resend['"]|require\(|import\(` -> 0 matches. `new Resend(|getResend` -> only in an archived plan doc describing a never-built pattern; no such function exists in code. Read lib/email.ts + lib/email-sender.ts fully: both use raw fetch w/ manual auth header, no SDK. master (prod tree): git grep for SDK import -> 0 matches; package.json on master also lists resend unused, same as dev. git log shows no in-flight edits adding SDK usage.
- **Verifier notes:** Mechanical removal: drop "resend" from package.json + lockfile, no code changes. Same unused state on master/prod, not dev-only drift.

### E03. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set + documented but never read by app code

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** env-var | **Removal:** yes
- **Where:** .env.local; docs/agents/ops/NEW_MACHINE_SETUP.md:109; lib/stripe.ts
- **Evidence (finder):** Var exists in .env.local and is called out by name in NEW_MACHINE_SETUP.md's required-secrets list, but repo-wide grep for `process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (and any import of stripe.js) hits 0 files outside docs/archive plans. lib/stripe.ts only builds a server-side `Stripe` client (secret key) for redirect-based Checkout Sessions — no client-side Stripe.js/Elements usage exists anywhere, so the publishable key has no consumer.
- **Verification:** git grep NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY on dev AND master: only doc hits (NEW_MACHINE_SETUP.md + 3 archived plans), 0 code. git grep stripe-js/loadStripe/Elements: 0 hits (1 commented pnpm-install line in archive doc); package.json lacks @stripe/stripe-js. lib/stripe.ts is server-only (STRIPE_SECRET_KEY). create-checkout + setup-payment-method routes both call stripe.checkout.sessions.create, return redirect url - Stripe-hosted, no client SDK. grep client_secret/clientSecret in *.tsx: 0 hits. amplify.yml echoes only STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET. audit-stripe-billing.mjs checks only STRIPE_SECRET_KEY.
- **Verifier notes:** Confirmed; all traps negative on dev and master. Removal = drop var from .env.local + its line in NEW_MACHINE_SETUP.md:109 (leave archived plan docs as history). No code touches it - billing is a shipped, redirect-only Stripe Checkout flow by design.

### E04. One-time migration-verification scripts for long-shipped migrations 090/093

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** yes
- **Where:** scripts/verify-migration-090.sql; scripts/verify-migration-093.mjs; scripts/verify-migration-093.sql; scripts/verify-migration-093-rest.mjs
- **Evidence (finder):** Full-repo string-scan for each filename's basename finds zero references outside the scripts/ folder (verify-migration-090.sql: 0 refs anywhere, not even self; the other three only reference each other). Their docstrings describe one-shot "post-migration verification" purpose for migrations 088/089/090/093, all long since applied per the DB watermark (migration 198 current).
- **Verification:** Read all 4 files: one-shot SQL check-suites for migrations 088-090 (contact refactor) and 093 (age_groups->divisions rename); no app/lib code imports them. grep across whole tree incl untracked: 0 hits outside scripts/, only mutual self-refs inside. git grep on master (prod): same, 0 external callers. package.json has no verify-migration* entries. No .github/workflows. No mentions in schema-snapshots/DATA_DICTIONARY/memory/TODO.md. git log: each file touched only in its introducing commit, no edits since. Live dev DB query: age_groups/contacts gone, only divisions exists - the PASS state checked for, purpose spent. No cron/proxy/email/platform-admin/UAT/SW refs.
- **Verifier notes:** Out of scope: sibling scripts/verify-migration.mjs (migs 088-089, unnumbered) has hardcoded plaintext Supabase creds - separate issue, not touched here.

### E05. fix-encoding.js — one-time encoding fix for a completed, archived project

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** yes
- **Where:** scripts/fix-encoding.js; docs/projects/archive/codex_HELP_CENTER_PLATFORM_ADMIN_PLAN.md
- **Evidence (finder):** Only reference anywhere in the repo is from the archived plan doc it was built for. No package.json wiring, no ongoing doc mentions.
- **Verification:** Read scripts/fix-encoding.js: standalone CLI (node fix-encoding.js <file>), no cross-file imports. Grep "fix-encoding" repo-wide -> only the script + archived doc (completed project). Not in package.json. git log -- path: 1 commit, no recent activity. git grep on master (prod): same 2 hits only, no prod-only use. Grepped memory/*.md, TODO.md, docs/agents for mojibake/encoding recurring-issue -> none. npx eslint on file -> exit 0 clean (doc's stale "blocks lint" note no longer true). Traps 1-12 checked, all empty: no convention/server-action/sw.js/cron/DB/platform-admin tie.
- **Verifier notes:** Genuinely dead: one-off manual CLI built for and referenced only by an archived project doc. Safe to delete; no need to touch the doc.

### E06. scripts/journeys/tmp-*.mjs and _inspect-club-org.mjs are unreferenced scratch files

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** yes
- **Where:** scripts/journeys/tmp-j4-check.mjs; scripts/journeys/tmp-j4-roster.mjs; scripts/journeys/tmp-j7-staging.mjs; scripts/journeys/tmp-params-probe.mjs; scripts/journeys/_inspect-club-org.mjs
- **Evidence (finder):** Full-repo string-scan for each basename returns 0 references anywhere, including no self-mentions in other files. Filenames themselves (`tmp-`, leading underscore) signal throwaway debugging scripts left in the tracked scripts/journeys/ folder.
- **Verification:** Read all 5 files: each self-labeled one-off/temp ("Temp inspection helper for staging — safe to delete.", "One-off: verify...", "One-off: insert...", "One-off J7 staging...", "One-off: prove..."). Full-repo grep per basename = 0 hits (app/, lib/, scripts/, docs/, .claude/, tests/, package.json). Checked every scripts/*.mjs using readdir/glob — none touch scripts/journeys. TODO.md cites the completed audit + J4-001 finding these scripts diagnosed, never the filenames. git log: all added in one commit 8564624c (2026-06-13, >5wks old, not concurrent). git status clean. git grep on master: files exist there too but zero code refs — standalone manual scripts, never invoked by app/cron/CI.
- **Verifier notes:** Zero functional risk. Files are tracked in git history so proper removal is `git rm`, not just filesystem delete. Sibling scripts/journeys/tmp-j6-ids.mjs matches identical pattern but was out of scope for this finding.

### E07. scripts/journeys/ subtree + journey-shots.mjs built for now-archived audit projects

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** yes
- **Where:** scripts/journey-shots.mjs; scripts/journeys/run-dev-seeds.mjs; scripts/journeys/create-journey-users.mjs; scripts/journeys/topup-club-org.mjs; scripts/journeys/topup-league-org.mjs; scripts/journeys/tmp-j6-ids.mjs; scripts/journeys/*.json (14 screenshot-diff files)
- **Evidence (finder):** Every doc reference to these files is docs/projects/archive/USER_JOURNEY_AUDIT_PLAN.md or docs/projects/archive/PLATFORM_ADMIN_EMPLOYEE_AUDIT_PLAN.md — both archived (completed) plans. No package.json wiring. 14 j*-shots.json files (Playwright screenshot-diff artifacts, e.g. j1-shots.json..j10d-shots.json) sit alongside them as generated output checked into the tracked scripts/journeys/ folder.
- **Verification:** Read journey-shots.mjs (manual `node scripts/journey-shots.mjs <spec.json>` Playwright driver) + j1-shots.json (input spec w/ hardcoded tournamentIds, not a diff artifact). package.json scripts block: zero journey entries. git grep "journey-shots|scripts/journeys" on dev HEAD: hits only in docs/projects/archive/{USER_JOURNEY_AUDIT_PLAN,PLATFORM_ADMIN_EMPLOYEE_AUDIT_PLAN}.md. Same on master: adds only archive/platform-admin-audit/STAGING_RUNBOOK.md. Active docs, .claude/, README, tests/uat/, other scripts: zero hits. git log -10 on both paths: 2 old commits only; mtimes Jun10-13; git status clean. The one doc proposing reuse is itself archived w/ stages marked complete.
- **Verifier notes:** Minor correction: the 14 *.json files are Playwright INPUT specs, not "screenshot-diff artifacts" as claimed - real PNG diffs go to gitignored tests/uat/results/journeys/. Doesn't change verdict. Directory also has unlisted dead one-offs (_inspect-club-org.mjs, tmp-j4-check.mjs, tmp-j4-roster.mjs, tmp-j7-staging.mjs, tmp-params-probe.mjs) broadening the case.

### E08. Self-described one-time/throwaway QA fixture scripts, zero external references

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** yes
- **Where:** scripts/seed-fan-experience-qa.mjs; scripts/seed-fan-qa-standings.mjs; scripts/seed-coach-nav-test.mjs; scripts/seed-free-tier-org.mjs; scripts/cleanup-orphan-draft-tournaments.mjs
- **Evidence (finder):** Each file's own docstring says it's one-time: seed-coach-nav-test.mjs literally opens "Throwaway seed for the Coach Nav Rebuild test (dev only)"; seed-fan-qa-standings.mjs targets the already-shipped FP-2 Phase E standings fix; seed-fan-experience-qa.mjs targets the completed Public Fan Experience project; cleanup-orphan-draft-tournaments.mjs hardcodes a single incident org/slug ('bob-test-org'/'2026-tournament'). None appear in package.json or any doc outside themselves.
- **Verification:** package.json: no match for any of 5 basenames. git grep across dev tree: zero hits outside each file. Ripgrep full-repo (incl untracked): only the 5 files match. git grep on master (prod): zero external hits. .github/workflows + app/ + lib/ grepped for 'scripts/seed'/'scripts/cleanup': none. tests/uat grepped for unique fixture IDs (free-test-org, free-owner@dev.local, coach-navtest@dev.local, fan-qa-standings, fan-qa-open, bob-test-org): zero matches (only unrelated live-demo/completed-demo fixtures appear, from other scripts). git log -5 per file: only original commit (Jun 7-18), no recent edits. Read docstrings of all 5, confirming self-described throwaway scope.
- **Verifier notes:** Standalone manually-run scripts never imported elsewhere, so near-zero cross-ref is baseline, but every trap (pkg.json, full grep incl untracked, prod/master, CI, UAT fixture cross-check, git activity) came back empty for all 5. cleanup-orphan-draft-tournaments.mjs is additionally SAFE BY DESIGN even if kept. No DB/schema risk from deletion.

### E09. add-demo-pools.mjs — completed one-time demo-data patch, zero references

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** yes
- **Where:** scripts/add-demo-pools.mjs
- **Evidence (finder):** Docstring: 'so the schedule scope picker (divisions → pools) has something to show... Run: node --env-file=.env.local scripts/add-demo-pools.mjs'. Hardcodes ORG_SLUG='dev-test-org', SLUGS=['live-demo','dev-tournament-2026']. Committed 2026-06-04 (fe9ea2da). Zero references in package.json/scripts/docs (git grep across *.md/*.ts/*.tsx/*.js/*.mjs/*.json finds nothing outside the file itself).
- **Verification:** Read full file: one-time idempotent patch hardcoded to dev-test-org/live-demo/dev-tournament-2026. git log -5 shows only original commit fe9ea2da. git grep 'add-demo-pools' repo-wide finds only the file itself. git ls-tree master shows equally unreferenced on prod tree. seed-live-tournament.mjs does not call it; it copies pools forward from dev-tournament-2026 each re-seed. Live dev DB query confirms patch effect already persisted: both tournaments show U11 pool_count=2, 2 pool rows - job done, propagates via normal seed copy.
- **Verifier notes:** Safe to delete: completed idempotent one-off dev-data patch; effect is durable DB state already propagated by seed-live-tournament.mjs's normal copy logic. No wiring on dev or prod tree.
- **Proposed action:** Delete. One-off patch that already shaped the dev-test-org demo tournaments' pool data for a since-shipped schedule scope-picker feature; not called by any other script, doc, or npm script.

### E10. cleanup-orphan-draft-tournaments.mjs — one-time incident cleanup, hardcoded to a single org/slug

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** yes
- **Where:** scripts/cleanup-orphan-draft-tournaments.mjs
- **Evidence (finder):** Docstring: 'Remove orphaned draft tournaments left behind when the setup wizard created the tournament row but a later step (divisions insert) failed...' Hardcodes `ORG_SLUG='bob-test-org'; TOURNAMENT_SLUG='2026-tournament'` — not parameterized, so only ever operates on that one incident. Also probes divisions.min_age NOT NULL (migration 108), a since-fixed issue. `grep -rn "bob-test-org"` across the repo finds only this file.
- **Verification:** Read file: hardcoded ORG_SLUG='bob-test-org', TOURNAMENT_SLUG='2026-tournament'; standalone, not imported. Repo grep for both strings: only self-refs + one hit in .claude/settings.json, a Bash permission-allowlist entry for a past triage grep command (git-blamed to "finalize shared Claude permission allowlist"), not a functional reference. No package.json script, no cron/lib/app wiring. git log: 1 commit (Jun 4), untouched since. Live DB dev+prod: org 'bob-test-org' returns [] both places (target gone, script would exit(1) if run). divisions.min_age/max_age nullable=YES on both dev+prod (mig 108 already applied everywhere) — schema-probe half also moot.
- **Verifier notes:** Stronger than claimed: fully inert today, not just narrowly scoped — target org absent from both DBs and the schema condition it checks is already resolved everywhere. Safe to delete outright.
- **Proposed action:** Delete. Despite the generic-sounding name, this is a hardcoded one-off incident remediation for a specific org/tournament and a schema bug (mig 108) already resolved — not a reusable tool.

### E11. seed-coach-nav-test.mjs — self-described throwaway QA fixture, feature already shipped

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** yes
- **Where:** scripts/seed-coach-nav-test.mjs
- **Evidence (finder):** Docstring: 'Throwaway seed for the Coach Nav Rebuild test (dev only). Creates a clean coach account pre-loaded with the scenarios b2cowan@outlook.com can't show...' Committed in the SAME commit as the feature and its plan doc: 9da4a176 'feat(coaches): rebuild team workspace nav — sectioned shell + roster/schedule/fees/tournaments/announcements/explore pages' (2026-06-16), which also added docs/projects/archive/COACH_NAV_REBUILD_PLAN.md.
- **Verification:** Read full file: self-labeled throwaway dev-only seed. git log -- scripts/seed-coach-nav-test.mjs: only commit 9da4a176, same commit shipping CoachPortalShell rebuild + plan doc. Grep "seed-coach-nav-test" repo-wide: only other hit is .claude/settings.json:285, a Bash-permission allowlist grouping it with other known-throwaway seed scripts (not a runtime dep). Grep coach-navtest@dev.local + package.json: no refs. tests/: no UAT refs. git grep on master: file present there too (already shipped, no dev-only hidden risk). git log -5 CoachPortalShell.tsx: 5 later commits build on the shipped nav rebuild, confirming feature is live/stable not still in flux.
- **Verifier notes:** No live reference found via any trap check. Standalone node script, never imported by app code — zero runtime risk to delete.
- **Proposed action:** Delete. Names the file the vague 'self-described one-time/throwaway QA fixture scripts' finding didn't enumerate. The Coach Nav Rebuild it validated shipped over a month ago in the same commit as this script. (COACH_NAV_REBUILD_PLAN.md's stale 'Planning' status header is a separate docs-hygiene nit, not a script finding.)

### E12. verify-migration.mjs — not a reusable template; hardcoded one-off for migs 088+089

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** yes
- **Where:** scripts/verify-migration.mjs
- **Evidence (finder):** Header: 'Post-migration verification queries for the contact model refactor. Runs after migrations 088 + 089 are applied.' All 7 queries hardcode column/constraint names specific to that refactor. Also hardcodes a raw project ref + a PLAINTEXT DB PASSWORD (`const DB_PASSWORD = 'kAtYeg2Tk8xqvHv3'`) instead of reading env — the opposite of a reusable pattern. Refactor is archived: docs/projects/archive/TOURNAMENT_CONTACT_REFACTOR_PLAN.md. `git grep verify-migration.mjs -- '*.md'` → no hits anywhere as a template.
- **Verification:** Read full file: header says "contact model refactor...migs 088+089"; queries hardcode that refactor's columns. Refactor archived (docs/projects/archive/TOURNAMENT_CONTACT_REFACTOR_PLAN.md). git log --follow: ONE commit ever (496488cc, unrelated divisions-rename mig 093); git show confirms file added NEW there, dead-on-arrival, unrelated to that commit's own work. git grep across dev tree AND master: zero hits; no package.json script; no glob/dynamic scan invokes it; no template doc convention found. git status clean, single worktree. PROJECT_REF npgnrxaitgbtbtvvykto confirmed as real current dev DB ref, so plaintext-password claim is accurate.
- **Verifier notes:** Delete is fully safe-mechanical. Side note: identical plaintext dev DB password also lives in scripts/run-migration.mjs (separate file, not part of this finding) — worth a follow-up owner-decision to rotate it; not resolved by this deletion alone.
- **Proposed action:** Delete — this is NOT the reusable generic verifier other scripts were meant to follow; it's a one-time, migration-088/089-specific script for an already-archived project that also leaves a stale plaintext DB credential in the repo. Distinct from the already-flagged verify-migration-090.sql / verify-migration-093*.mjs pair.

### E13. mirror-tournament.mjs — NOT dead: reusable prod-to-dev mirroring tool, just undocumented

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** script | **Removal:** no (consolidation/hygiene)
- **Where:** scripts/mirror-tournament.mjs
- **Evidence (finder):** Docstring explicitly frames it as a generalization: 'Generalizes mirror-battle-of-the-bats.mjs with two important safety changes...' Takes `--tournament <uuid> [--org <uuid>] [--dry-run]` CLI args (not hardcoded to any org/tournament), strips PII/billing columns generically via NULL_COLS/JSONB_COLS maps. Own standalone commit c73c6ee3 'chore(scripts): add mirror-tournament dev tool (prod→dev subtree copy)'. mirror-battle-of-the-bats.mjs (what it supersedes for general use) still exists in scripts/.
- **Verification:** mirror-tournament.mjs confirmed: docstring says 'Generalizes mirror-battle-of-the-bats.mjs', CLI parses --tournament/--org/--dry-run, has NULL_COLS/JSONB_COLS maps. Commit c73c6ee3 exists in git log. mirror-battle-of-the-bats.mjs still present. grep docs/ for mirror-tournament = 0 hits (undocumented, confirmed). Proposal is additive-only (doc mention), low risk.
- **Proposed action:** Do NOT delete. This is a still-relevant, generalized manual ops tool (any prod tournament → dev, by UUID) simply not referenced from any runbook. Add a one-line mention + usage example to docs/agents/ops/ so it's discoverable instead of looking dead.

### E14. No .env.example; the one prose doc that lists required vars is incomplete

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** env-var | **Removal:** no (consolidation/hygiene)
- **Where:** docs/agents/ops/NEW_MACHINE_SETUP.md:104-112
- **Evidence (finder):** Repo has no .env.example (Glob for it returns nothing). The only enumeration of required vars is a prose list in NEW_MACHINE_SETUP.md naming ~14 keys + "the NEXT_PUBLIC_* feature toggles" + "the UAT_* set" generically. A full code scan found 56 distinct process.env.* names in use, including several real, non-obvious ones the doc never names explicitly: CRON_SECRET, ENTITLEMENT_GRANTS_ENABLED, LEAGUE_STARTER_BETA, NEXT_PUBLIC_FOUNDING_SEASON_END, NEXT_PUBLIC_PLAN_GATES, NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE, PLATFORM_ADMIN_EMAILS (listed but easy to miss), REQUIRE_SIGNUP_EMAIL_VERIFICATION, ENABLE_BILLING_MOCK_PORTAL.
- **Verification:** No .env.example anywhere (only .env.local/.env.production.local exist). NEW_MACHINE_SETUP.md:104-112 matches verbatim as quoted. Clean process.env.* scan (excl. node_modules/.next) = exactly 56 distinct names, matching claim precisely; all 9 named 'missing' vars confirmed real/in-use in the codebase.

### E15. Observability route-coverage codemod/checker finished its job but isn't wired into any recurring check

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** script | **Removal:** no (consolidation/hygiene)
- **Where:** scripts/check-observability-coverage.mjs; scripts/wrap-route-observability.mjs; scripts/observability-route-exclusions.mjs; TODO.md:86; package.json
- **Evidence (finder):** TODO.md:86 confirms "MECHANISM B ROLLOUT COMPLETE — coverage 0.8% -> 100.0% (388/388)", so the one-time codemod (wrap-route-observability.mjs) has no more routes to wrap. check-observability-coverage.mjs (the regression guard) is not in package.json scripts nor in verify:changed nor docs/agents/ops/AGENT_VERIFICATION_WORKFLOW.md — grep for its name there returns nothing — so a newly added, unwrapped API route today would silently drop coverage with no automated check catching it.
- **Verification:** check-observability-coverage.mjs referenced only in the script itself + archived plan + TODO.md:86 - absent from package.json scripts, verify:changed, and AGENT_VERIFICATION_WORKFLOW.md (confirmed via grep). TODO.md:86 verbatim confirms 'MECHANISM B ROLLOUT COMPLETE - coverage 0.8% -> 100.0% (388/388)'.

### E16. .claude/settings.json auto-refresh hook matches the retired migration script, not the one actually used

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** other | **Removal:** no (consolidation/hygiene)
- **Where:** .claude/settings.json:253-268
- **Evidence (finder):** PostToolUse hook runs `node scripts/refresh-db-schema.mjs` gated on `"if": "Bash(*run-migration*)"`. The literal substring "run-migration" only matches invocations of the dead scripts/run-migration.mjs (see the hardcoded-password finding above) — it does NOT match `node scripts/apply-migration-api.mjs ...`, which is the tool actually used for every migration in .claude/settings.json's own allow-list (12+ entries). So the automated "refresh DB schema memory after a migration" safety net (per AGENTS.md's binding rule) silently never fires today.
- **Verification:** .claude/settings.json:297-308 confirms hook exactly: command 'node scripts/refresh-db-schema.mjs' gated on if:'Bash(*run-migration*)'. Confirmed 14 allow-listed migration commands all use apply-migration-api.mjs (no 'run-migration' substring); settings.json's only 'run-migration' match is the hook's own pattern, confirming it never fires.

### E17. "Battle of the Bats" demo-mirroring script cluster only references itself

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** script | **Removal:** yes
- **Where:** scripts/mirror-battle-of-the-bats.mjs; scripts/mirror-tournament.mjs; scripts/reset-botb-champions-moment.mjs; scripts/seed-botb-admin.mjs; scripts/seed-botb-extra-divisions.mjs; scripts/seed-botb-test-notifications.mjs
- **Evidence (finder):** String-scan shows these 6 files reference only each other (e.g. mirror-battle-of-the-bats.mjs mentioned by reset-botb-champions-moment.mjs, seed-botb-admin.mjs, etc.); only seed-botb-test-notifications.mjs also appears in one active doc (NOTIFICATION_CENTER_REWORK_PLAN.md). No package.json wiring. Likely a still-used demo-org toolkit rather than fully dead — needs owner confirmation the BOTB demo org is still wanted before archiving.
- **Verification:** "Battle of the Bats" is the platform's flagship tournament (git remote origin=battle-of-the-bats.git), a REAL prod org still live: db-query --prod finds 2 tournament rows (org 42871b5b) matching '%battle%', also present in dev (mirrored), proving active use. TODO.md has 4 entries (06-29→07-06) re owner tests "against mirrored prod Battle of the Bats" via this cluster. Two docs also reference it. scripts/seed-coach-nav-test.mjs hardcodes BOTB tournament_id as 1 of 2 test fixtures - real external consumer. Files touched 07-03→07-06, active churn. Narrower finding: mirror-tournament.mjs header says it "Generalizes mirror-battle-of-the-bats.mjs" - that one script looks superseded.
- **Verifier notes:** Correct shape: don't archive the cluster. At most retire mirror-battle-of-the-bats.mjs (superseded by mirror-tournament.mjs per its own header). Keep the other 5 - live dev-testing toolkit for the real BOTB tournament, mirrored in dev+prod today, cross-consumed by seed-coach-nav-test.mjs.

### E18. Two committed scripts hardcode a live dev DB password in plaintext source

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** script | **Removal:** yes | **~LOC/objects:** 60
- **Where:** scripts/run-migration.mjs:17-18; scripts/verify-migration.mjs:10-11
- **Evidence (finder):** Both files contain literal `const DB_PASSWORD = 'kAtYeg2Tk8xqvHv3';` connecting to Supabase project npgnrxaitgbtbtvvykto (dev) via raw `pg`. `git ls-files` confirms both are tracked; `git log --oneline -1` shows history back through at least commit 49469518. Neither is referenced by package.json, docs, or .claude configs (run-migration.mjs is only referenced by the also-dead verify-migration-093.mjs; verify-migration.mjs has 0 references anywhere). Superseded by scripts/apply-migration-api.mjs + scripts/db-query.mjs, which use env-var credentials (SUPABASE_ACCESS_TOKEN) instead.
- **Verification:** Confirmed DB_PASSWORD='kAtYeg2Tk8xqvHv3' literal in both files; git show master:... proves identical secret committed on prod branch too.
Finder's evidence is wrong on one point: .claude/settings.json:299 has hook "if":"Bash(*run-migration*)" -> refresh-db-schema.mjs, committed on BOTH dev+master. So run-migration.mjs IS referenced by a .claude config, contra finder's "not referenced" claim.
verify-migration.mjs: confirmed zero references anywhere.
Both non-functional now: pg absent from package.json/lockfiles/node_modules.
Superseded by apply-migration-api.mjs + db-query.mjs.
git log --follow: 1 commit ever each, no recent activity.
- **Verifier notes:** Real fix is rotating the dev DB password - deleting files leaves the plaintext secret in git history on dev+master forever. verify-migration.mjs: safe straight delete. run-migration.mjs: delete too, but leaves a harmless vacuous .claude hook pattern as minor follow-up. Prod-tree exposure + rotation call makes this owner-decision.

### E19. outline-svg-text.js — completed one-time brand-asset build tool, job already done

- **Verdict:** REFUTED | **Risk:** judgment | **Type:** script | **Removal:** yes
- **Where:** scripts/outline-svg-text.js; public/brand/logo-B.svg; public/brand/logo-B-outlined.svg
- **Evidence (finder):** Docstring: 'Converts the text elements in logo-B.svg to outlined SVG paths... pass --apply to overwrite logo-B.svg in place.' Verified live public/brand/logo-B.svg ALREADY has the F and L glyphs as `<path>` elements (comments '── F (top of stacked monogram) ──' / '── L (bottom...) ──'), not `<text>` — confirms --apply already ran. Only a leftover `<text>HQ</text>` remains, which this script never targets. Script + logo-B.svg committed together 2026-05-27 (a918095c).
- **Verification:** Read outline-svg-text.js + live logo-B.svg: F/L already `<path>`s (only `<text>HQ</text>` remains, out of script's scope); diff logo-B.svg vs logo-B-outlined.svg = zero diff, confirming --apply already ran (a918095c). BUT memory/brand_assets.md "Regeneration scripts" section prescribes re-running this exact script "if logo-B is ever edited back to text", paired with a "What NOT to do" warning about sharp/PNG rendering. Documented, maintained dormant-by-design repair tool, not orphaned cruft. git grep (dev+master): zero other references. opentype.js devDependency used ONLY by this script.
- **Verifier notes:** Not a flat delete: keep script+logo-B-outlined.svg per documented recovery workflow, OR if owner judges the regression risk gone, retire script AND update memory/brand_assets.md's Regeneration-scripts + What-NOT-to-do sections AND drop opentype.js devDependency together, not the script alone.
- **Proposed action:** Delete scripts/outline-svg-text.js — its one job (outline F/L in logo-B.svg) is already done and committed. The leftover public/brand/logo-B-outlined.svg is the script's now-redundant preview output and can likely be deleted alongside it — diff against logo-B.svg to confirm before removing.

### E20. seed-free-tier-org.mjs — completed one-time QA fixture for shipped free-tier bracket feature

- **Verdict:** REFUTED | **Risk:** judgment | **Type:** script | **Removal:** yes
- **Where:** scripts/seed-free-tier-org.mjs
- **Evidence (finder):** Docstring: 'Seed a FREE-tier tournament org with a REAL owner login, ready for manually building a playoff bracket... playoffs left EMPTY → log in and build the bracket by hand.' Committed 2026-06-13 alongside 8564624c 'feat(coaches): free-tier coaches portal + inline playoff bracket editor'. Per project memory, the free-tier / inline tiered bracket editor feature is already built and largely shipped.
- **Verification:** Script seeds org slug=free-test-org, owner free-owner@dev.local. Live dev DB query confirms org EXISTS NOW (created 2026-06-12). Grep hits docs/projects/archive/PLATFORM_ADMIN_WALKTHROUGHS.md (ACTIVE, touched 2026-07-09): "log in as a free-test-org member" (L220); "Upgrading free-test-org -> Tournament Plus" (L264); "carry forward: grant a section to free-test-org" (L222). TODO.md lists that project OPEN `[ ]`; doc headers say "Phase B/E/F in progress". Sibling seed-fp5-cluster4.mjs says it "Does NOT touch the existing free-cup fixture" - deliberately preserved.
- **Verifier notes:** Narrow "build bracket by hand" purpose is done, but the org this script provisions/resets is now the standard free-tier test org for the still-OPEN Platform-Admin Walkthroughs project. Re-check once that doc is archived and free-test-org is unreferenced.
- **Proposed action:** Delete. One-time manual-QA fixture for hand-testing the free-tier bracket builder, which shipped in the same commit as this script over a month ago.


## Workstream F — Assets + PWA

### F01. 5 unused create-next-app boilerplate SVGs sitting in public/ root

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** asset | **Removal:** yes | **~LOC/objects:** 5
- **Where:** public/file.svg; public/globe.svg; public/next.svg; public/vercel.svg; public/window.svg
- **Evidence (finder):** `git grep --fixed-strings -I <basename>` across the full repo (excl. node_modules/.next) returns 0 matches for each of these 5 files — no component, page, CSS url(), manifest, or script references any of them. They are the stock icons shipped by default with `create-next-app` and were never wired into this custom app.
- **Verification:** Extended finder's checks, all empty: git grep each basename across dev tree (excl node_modules/.next) - 0 matches; same grep against master (prod) - 0 matches. git log --all for each file - only commit is initial create-next-app scaffold, no recent edits. Read public/sw.js: PRECACHE_URLS only lists OFFLINE_URL + 2 PNG icons, none of these SVGs. Real manifest is dynamic app/manifest.json/route.ts, icons array uses only PNGs. Checked opengraph-image.tsx conventions (3 files) - none mention svg. Grepped for dynamic/template-built src paths using bare names - no matches.
- **Verifier notes:** Dead create-next-app boilerplate, never wired in, identical dev/prod. Minor: public/ files are served at root so deletion 404s those URLs - expected/fine.

### F02. sw.js NEVER_CACHE_PREFIXES has a stale '/dashboard' entry for a route that has never existed at the top level

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** dead-flag | **Removal:** yes | **~LOC/objects:** 1
- **Where:** public/sw.js:62
- **Evidence (finder):** NEVER_CACHE_PREFIXES (sw.js:61-64) includes '/dashboard' but no app/dashboard directory exists, and `git log --all --diff-filter=A --name-only | grep '^app/dashboard'` returns nothing — a top-level /dashboard route has never existed. All 'dashboard' strings in the codebase point to the nested `/{orgSlug}/admin/tournaments/dashboard`, already covered by the 'admin' entry in PRIVATE_ORG_SECTIONS (sw.js:66). The comment above the array (sw.js:51-54) enumerates 8 route names, not the 12 actually present.
- **Verification:** Checks: (1) git log --diff-filter=A --all -- 'app/dashboard*' + full-history search: no top-level app/dashboard dir ever existed. (2) ls app/: confirmed absent; only nested tournaments/dashboard/ exists, covered by 'admin' in PRIVATE_ORG_SECTIONS. (3) git grep "'/dashboard'" dev+master: zero hits besides sw.js:62. (4) proxy.ts/amplify.yml: no redirect. (5) git blame: added in sw.js's first commit (2026-06-18), which added no such route - speculative from day one. (6) git diff sw.js: uncommitted changes only bump CACHE_VERSION, line 62 untouched. (7) 'dashboard' also blocked in RESERVED_ORG_SLUGS so no org page can ever occupy /dashboard.
- **Verifier notes:** Related but separate residue, not folded in: lib/reserved-slugs.ts:25 reserves 'dashboard' on the same false premise; AdminTitleManager.tsx:10 has a dead /admin/dashboard$ regex from before the tournaments/dashboard rename.

### F03. public/brand/logo-B.png is an orphaned raster export with zero references anywhere

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** asset | **Removal:** yes | **~LOC/objects:** 1
- **Where:** public/brand/logo-B.png
- **Evidence (finder):** `git grep -I 'logo-B.png'` across code/scripts/docs returns 0 hits. Its SVG sibling `public/brand/logo-B.svg` is the one actually consumed (19 refs: scripts/generate-pwa-icons.js primary source, scripts/outline-svg-text.js, public/brand/preview.html img src, memory/design_decisions.md). No opengraph-image/icon route reads the .png variant either (checked apple-icon.tsx and icon-maskable/route.tsx, which read generated public/icons/*.png instead).
- **Verification:** git grep -I "logo-B.png" and broader "logo-B" (tree + master) return zero hits on the raster; all hits are logo-B.svg/-maskable/-outlined (generate-pwa-icons.js, outline-svg-text.js, preview.html, memory docs). Read apple-icon.tsx + icon-maskable/route.tsx fully: both fetch public/icons/pwa-512(-maskable).png only. opengraph-image.tsx builds via JSX, no asset reads. No manifest.json exists. brand_assets.md's own manifest table omits logo-B.png. git log --follow: last touch bulk commit 02e78b10 (2026-06-01), not recent. git status/diff clean on path. AgentPlaybook.tsx hit is false positive (docs/agents/brand/).
- **Verifier notes:** Static asset not DB/schema, no live-query needed. Likely leftover intermediate raster export from logo-B.svg text-to-path work; SVG sibling is the real source. Safe to delete; 1 file ~10KB, zero runtime impact.

### F04. public/images/news-default.png is orphaned (zero references, predates and survives the top-level /news page deletion)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** asset | **Removal:** yes | **~LOC/objects:** 1
- **Where:** public/images/news-default.png
- **Evidence (finder):** Repo-wide grep for 'news-default' returns zero matches anywhere in the current tree, including the surviving org-scoped news feature (app/[orgSlug]/news/page.tsx, news.module.css). It was not even referenced in the last-committed version of the now-deleted app/news/page.tsx or news.module.css, so this asset was already dead before the top-level /news removal and remains dead now.
- **Verification:** grep "news-default" whole dev tree: 0 matches. git grep on master (prod): 0 matches. git show master:public/images/news-default.png: exists on master too (genuine old orphan, not dev-only). git log --all for file: 1 commit 620287b6, no recent activity. Read surviving news pages (redirect stub + [tournamentSlug]/news/page.tsx): no image handling. Variants (newsDefault, news_default, images/news): 0 matches. Checked sw.js, manifest.json, offline.html, lib/email*, scripts/*, tests/uat/*: 0 matches. ls public/images/: only file in dir, ruling out dynamic pattern lookup; grep for `/images/` template usage: none found.
- **Verifier notes:** public/images/ contains only this file; removal empties the directory too.

### F05. logo-A.svg is the superseded single-mark 'Concept A' predecessor, unused by any generator default

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** asset | **Removal:** yes | **~LOC/objects:** 1
- **Where:** public/brand/logo-A.svg; scripts/generate-pwa-icons.js:22; public/brand/preview.html:326; memory/brand_assets.md
- **Evidence (finder):** git show --stat d54e10f9 (2026-05-27) added logo-A.svg alongside logo-B.svg/logo-C.svg/preview.html together as concepts explored that day. preview.html subtitle: 'Two-mark system - Primary (FL) + Icon (chevron) - 2026-05-27' (only B+C). brand_assets.md's file manifest lists only logo-B.svg + logo-C.svg, never logo-A.svg. logo-A.svg content = single 'HQ' <text>-based mark, still has Google Fonts @import (never outlined like B). generate-pwa-icons.js defaults primary=logo-B.svg (line 46); logo-A.svg appears only in a comment CLI example (line 22) and the same example in preview.html:326 - neither is an actual invocation.
- **Verification:** Repo grep "logo-A" (all types, excl node_modules/.next): only 2 hits, both doc-comment CLI examples (generate-pwa-icons.js:22, preview.html:326), not executed code. Checked sw.js, offline.html, manifest.json, layout.tsx, lib/email*, platform-admin/*, scripts/*, tests/uat/*: no matches. git grep on master: same 2 doc-only hits, no prod-only refs. git log --all -- logo-A.svg: 1 commit (d54e10f9, 2026-05-27, added w/ B/C as explored concept), no activity since. Read logo-A.svg: <text> "HQ" mark w/ Google Fonts @import, confirms superseded design. generate-pwa-icons.js defaults=B/C/badge/B-maskable only. brand_assets.md manifest lists only B/C.
- **Verifier notes:** Zero functional references anywhere (dev or master/prod). Loose end: 2 doc-comment CLI examples cite logo-A.svg as illustrative path; deleting asset without editing those lines leaves a dangling but non-functional example. Trivial same-pass fix, not a blocker.

### F06. logo-B-outlined.svg is a byte-identical stale duplicate of logo-B.svg - dead one-time-script byproduct

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** asset | **Removal:** yes | **~LOC/objects:** 1
- **Where:** public/brand/logo-B-outlined.svg; public/brand/logo-B.svg; scripts/outline-svg-text.js:29
- **Evidence (finder):** Both files: exactly 3032 bytes, same Jun 7 19:31 mtime, byte-identical content (full Read diff). outline-svg-text.js writes logo-B-outlined.svg only as a dry-run PREVIEW (OUT_SVG line 29) before the real target logo-B.svg gets overwritten via --apply (dest=SRC_SVG). Current logo-B.svg already has outlined <path> elements (no <text>/@import) so --apply already ran, making the committed preview copy fully redundant. generate-pwa-icons.js defaults primary to logo-B.svg not the -outlined variant; generate-favicon-ico.js uses public/favicon.svg; brand_assets.md's manifest never lists logo-B-outlined.svg.
- **Verification:** md5sum both files = identical hash (3032B, same mtime), confirms byte-identity independently. Read outline-svg-text.js: OUT_SVG=logo-B-outlined.svg is only the non-apply dry-run preview; real target is logo-B.svg. git grep "logo-B-outlined" on dev AND master (trap11): only hit both = the script itself. Checked sw.js precache(trap4), lib/email*(trap6), app/platform-admin(trap7), tests/ UAT(trap9), app/ manifest(trap2): zero "logo-B" matches anywhere. Read preview.html in full: only uses logo-B.svg/logo-C.svg. generate-pwa-icons.js/generate-favicon-ico.js default paths exclude -outlined variant. git log --all for file(trap12): single add commit a918095c 2026-05-27, never touched since.
- **Verifier notes:** No dynamic/string-built path resolves to this filename. Zero-reference static asset; safe to git rm with no other file changes needed.

### F07. 4 throwaway design-mockup HTML files are tracked+web-accessible under public/, despite docs saying uncommitted

- **Verdict:** DOWNGRADED | **Risk:** owner-decision | **Type:** asset | **Removal:** yes | **~LOC/objects:** 4
- **Where:** public/brand/preview.html; public/depth-chart-mockup.html; public/mockups/insights-next.html; public/mockups/player-awards-mockup.html
- **Evidence (finder):** Zero references from any app code/component (only self-links within preview.html and doc mentions). `git ls-files` confirms all 4 ARE tracked, yet docs/projects/archive/COACH_TAGS_AWARDS_PLAN.md:19 says player-awards-mockup.html is 'not committed — throwaway' and COACH_INSIGHTS_DIGEST_PLAN.md:3 calls insights-next.html 'throwaway'. Since they live under public/, Next.js serves them at their literal path (e.g. /depth-chart-mockup.html) in every deployed env including prod.
- **Verification:** git ls-files: all 4 tracked. git grep whole tree (excl. the 4 files) per filename: zero app-code hits; only doc hits (COACH_INSIGHTS_DIGEST_PLAN.md:3, COACH_TAGS_AWARDS_PLAN.md:19, design_decisions.md:406, brand_assets.md:25). sw.js: no reference (trap 4 clear). git log --follow dates: preview.html d54e10f9 (~06-25); depth-chart-mockup.html 89863484 (07-03); insights-next+player-awards 104c2ea3 (07-13) - all weeks old. git cat-file -e master:<path>: ONLY preview.html exists on master/prod; other 3 dev-only, never promoted (refutes "prod" claim for 3/4). brand_assets.md:25 documents preview.html as the intended reusable brand-preview tool - opposite of throwaway.
- **Verifier notes:** 3 of 4 (depth-chart-mockup.html, insights-next.html, player-awards-mockup.html) are legit dead: shipped features, dev-only, own docs call them throwaway. Exclude public/brand/preview.html - documented permanent brand tool per brand_assets.md, only one live on prod. Rescope to the 3 dev-only mockups; keep preview.html.


## Workstream G — Docs + task hygiene

### G01. Every 'mig NNN prod-pending / dev-only' warning marker in memory (through mig 198) is now RESOLVED

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** memory-marker | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 12
- **Where:** memory/project_notification_settings.md (mig 185); memory/project_notification_pause_switch.md (mig 194); memory/project_warm_coaches_portal_followup.md (mig 195); memory/project_tournament_seam_ux_review.md (mig 196); memory/project_unified_app_strategy.md (migs 186+188); memory/project_scheduled_jobs_wiring.md (migs 183+187); memory/project_coach_tags_awards.md (migs 182+184); memory/project_coaches_portal_player_development.md (migs 189-191)
- **Evidence (finder):** Ran `git cat-file -e origin/master:supabase/migrations/<file>` for every referenced migration (127,128,129,130,182,183,184,185,186,187,188,189,190,191,193,194,195,196,197,198,116,117) - ALL exist on origin/master (the true deployed prod branch, HEAD f064712d 2026-07-23). Corroborated by the fresh 2026-07-24 DRIFT_dev_vs_prod.md showing 0 dev-only tables and 0 dev-only columns. Remaining non-mig work (owner QA, Phase 3-4 items) on these projects is real and untouched by this finding.
- **Verification:** Re-ran check for all 22 cited migrations (116,117,127-130,182-191,193-198) via git cat-file -e origin/master:supabase/migrations/<file> — all exist on deployed prod branch. Fresh DRIFT_dev_vs_prod.md (2026-07-24): Tables 0/0, Columns 0 only-in-dev, corroborating real prod application. release-history file independently states 'Migs 193-196 applied to PROD ahead of promote' etc.

### G02. Theming/Warm-Coaches-Portal build docs are fully shipped to prod — archive the build-tracking set

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 8
- **Where:** docs/projects/archive/THEME_TOGGLE_FOUNDATION_PLAN.md; docs/projects/archive/THEME_TOGGLE_FOUNDATION_PM_BRIEF.md; docs/projects/archive/THEME_TOGGLE_FOUNDATION_BUILD_PROMPT.md; docs/projects/archive/WARM_PORTAL_THEME_OPTION_PLAN.md; docs/projects/archive/WARM_PORTAL_THEME_OPTION_PM_BRIEF.md; docs/projects/archive/WARM_PORTAL_THEME_OPTION_BUILD_PROMPT.md; docs/projects/archive/WARM_PORTAL_STAGE2_BUILD_PROMPT.md; docs/projects/archive/WARM_PORTAL_STAGE5_6_BUILD_PROMPT.md
- **Evidence (finder):** Docs describe Stage 3/'next=Stage4-then-S5-then-S6' as latest state, but git log (dev) shows Stage 4 (71ec4245,1616a72f), Stage5 chat+tryouts (289f651e), Stage6 QA (929589b2), and the public release (c23feb82 'warm coaches portal public release + Warm as the default') all landed. reference_prod_release_history.md confirms the whole warm portal Stages1-6 + mig195 shipped in the 2026-07-22 prod promote (c743c276).
- **Verification:** All 8 docs exist, none already archived. All 5 cited commits verified exact (71ec4245/1616a72f Stage4, 289f651e Stage5, 929589b2 Stage6, c23feb82 public release). reference_prod_release_history.md:12 confirms verbatim: mig195 + Stages1-6 shipped in the 2026-07-22 prod promote c743c276. Docs themselves describe Stage2-6 as pending, confirming staleness.

### G03. Role Flip P1-P3 build prompts done and shipped; only P4 remains open

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 3
- **Where:** docs/projects/archive/ROLE_FLIP_P1_BUILD_PROMPT.md; docs/projects/archive/ROLE_FLIP_P2_BUILD_PROMPT.md; docs/projects/archive/ROLE_FLIP_P3_BUILD_PROMPT.md
- **Evidence (finder):** reference_prod_release_history.md: 'PROMOTE 2026-07-23 (f064712d)... The Flip P1-P3 complete'. TODO.md line 281 itself already says 'P1-P3 SHIPPED to prod 2026-07-23 (promote f064712d); remaining: P4' with ROLE_FLIP_P4_BUILD_PROMPT.md as the next step (untracked file already created). Keep ROLE_FLIP_NAVIGATION_PLAN.md + PM_BRIEF + P4 prompt active; the P1/P2/P3 prompts are spent.
- **Verification:** TODO.md:282 verbatim: 'P1-P3 SHIPPED to prod 2026-07-23 (promote f064712d)...remaining: P4...build prompt ready: ROLE_FLIP_P4_BUILD_PROMPT.md'. That P4 file already exists (untracked). git log -3 on P1/P3 prompts shows only their own feature commits (cb52d118, 31bba4c5) as last touch.

### G04. Unified Home Phase 6 built and shipped, but plan doc still says 'BUILD NOT STARTED'

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 3
- **Where:** docs/projects/archive/UNIFIED_HOME_PHASE6_FOLLOWS_PLAN.md; docs/projects/archive/UNIFIED_HOME_PHASE6_FOLLOWS_PM_BRIEF.md; docs/projects/archive/UNIFIED_HOME_PHASE6_BUILD_PROMPT.md
- **Evidence (finder):** UNIFIED_HOME_PHASE6_FOLLOWS_PLAN.md status: 'RATIFIED, BUILD NOT STARTED.' But git log shows commit 2a2d2685 'feat(consumer): Unified Home Phase 6 - follow whole tournaments & organizations (free-first)' (2026-07-20), and reference_prod_release_history.md's 2026-07-22 promote explicitly lists 'follow whole tournaments & organizations free-first' among shipped Unified Home IA items. Directly contradicted.
- **Verification:** Plan status verbatim: 'RATIFIED, BUILD NOT STARTED.' Commit 2a2d2685 'Unified Home Phase 6 - follow whole tournaments & organizations (free-first)' exists on dev; release history's 2026-07-22 promote lists this exact feature as shipped. TODO.md:13 has identical stale 'build NOT started' text — systemic drift, not a one-off; confirmed by git log.

### G05. SCHEDULE_HEALTH_RULES_PLAN.md header stale (uncommitted) — actually shipped to prod, zero memory tracking

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** yes | **~LOC/objects:** 3
- **Where:** docs/projects/archive/SCHEDULE_HEALTH_RULES_PLAN.md:3; docs/projects/archive/PLAYOFF_POTENTIAL_SCHEDULE_HEALTH_PLAN.md
- **Evidence (finder):** Header: 'BUILT 2026-06-12 on feat/free-tier-coaches (== dev), uncommitted — awaiting browser verification.' Actual: the feature (schedule_health_rules JSONB, maxGamesPerDay/minRestMinutes/targetGamesPerTeam) shipped in commit 8564624c (2026-06-13), confirmed `git merge-base --is-ancestor 8564624c origin/master` = true. This is a DIFFERENT feature from the already-correctly-archived docs/projects/archive/PLAYOFF_POTENTIAL_SCHEDULE_HEALTH_PLAN.md (which memory/project_playoff_schedule_health.md tracks, built 2026-07-09, also shipped). No memory/project_*.md file exists for THIS rules-config feature at all.
- **Verification:** Header claims "uncommitted"; `git status --porcelain`+`git diff HEAD` on file = clean/empty → actually committed. `git show --stat 8564624c` lists SCHEDULE_HEALTH_RULES_PLAN.md+PM_BRIEF.md added alongside schedule-metrics.ts, ScheduleHealthPanel.tsx, Generator.tsx, tournaments/route.ts. `git merge-base --is-ancestor 8564624c origin/master`/`master` both true → on prod. Grep confirms full wiring: schedule_health_rules in ALLOWED_SETTINGS_KEYS+sanitizer, type+getter in lib/types.ts+schedule-metrics.ts, gear-editor UI in panel, Generator seeding. No archive-name collision. memory/*.md grep for schedule_health_rules = zero hits.
- **Verifier notes:** Doc-only move, zero runtime risk, reversible via git. Bonus: TODO.md:307 still lists this as an open unchecked task pointing at the plan — strike/update it in the same archive pass, not just the file move + memory note.
- **Proposed action:** Verify no remaining scope, then move to docs/projects/archive/ with a corrected header noting shipped-to-prod via 8564624c; add a brief memory note so future sweeps don't need to re-derive this from git archaeology.

### G06. TRUST_INTEGRITY_HARDENING_PLAN.md header stale — project already [x] complete in TODO.md

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** todo-stale | **Removal:** yes | **~LOC/objects:** 3
- **Where:** docs/projects/archive/TRUST_INTEGRITY_HARDENING_PLAN.md:3; TODO.md:51; memory/project_trust_integrity_phase_c.md
- **Evidence (finder):** Plan header: 'SCOPED 2026-06-13 — spun out of the User Journey Audit (Phase 5). Awaiting owner go-ahead to build. FIX-NOW headline project.' But TODO.md:51 already reads '[x] Trust & Integrity Hardening ... COMPLETE 2026-06-15 (Phases A+B+C) ... Browser-verified + migration 127 confirmed applied to prod (live-DB check 2026-06-17)'. memory/project_trust_integrity_phase_c.md: 'FP-1 COMPLETE (Phases A+B+C)' as of 2026-06-15, citing this exact plan file. The plan doc's own header is over a month stale relative to both its tracking TODO line and memory.
- **Verification:** Plan header (line 3): "SCOPED 2026-06-13 ... Awaiting owner go-ahead ... FIX-NOW headline project" but every item in Phases A/B/C is [x] DONE w/ commits, and doc body (line 70) says "FP-1 COMPLETE (Phases A+B+C) 2026-06-15." TODO.md:51 confirms [x] COMPLETE, browser-verified, mig 127 on prod 2026-06-17. memory/project_trust_integrity_phase_c.md confirms COMPLETE. git log: last edit 2026-06-25, 1-line change; git status clean, no concurrent edit. git grep across all .md: zero refs outside the plan/brief + archived synthesis doc. Tranche 1 deferred to FP-5, itself COMPLETE per TODO.md:55 - no open dependency.
- **Verifier notes:** Doc-hygiene fix, zero runtime risk. Proposal correct: update header to COMPLETE, move plan+PM brief to archive, update TODO.md:51 link.
- **Proposed action:** Fix header to COMPLETE (Phases A+B+C, browser-verified, mig 127 on prod as of 2026-06-17) and move the plan + PM brief to docs/projects/archive/, matching the TODO.md [x] state.

### G07. Operator token-debt judgment tranche (P2+P3) committed and shipped

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 2
- **Where:** docs/projects/archive/OPERATOR_TOKEN_JUDGMENT_TRANCHE_PLAN.md; docs/projects/archive/OPERATOR_TOKEN_JUDGMENT_TRANCHE_PROMPT.md
- **Evidence (finder):** git log: fadfb2ee 'refactor(tokens): operator P2 mechanical sweep - 136 value-identical token swaps', 97da8989 'refactor(tokens): operator P3 judgment tranche - 365->74 literals, zero visual change'. reference_prod_release_history.md lists 'operator token-debt tranches (P2/P3, zero-visual)' among items shipped in the 2026-07-22 promote. OPERATOR_VISUAL_TOKEN_DEBT.md (the underlying inventory, still lists platform-admin/coaches hex values outside this tranche's scope) should stay active.
- **Verification:** git log confirms fadfb2ee 'operator P2 mechanical sweep - 136 swaps' and 97da8989 'operator P3 judgment tranche - 365->74 literals' both on dev. Re-running the inventory doc now shows 'Summary: 74 literal hex colors across 26 files' matching P3's end-state, confirming completion; OPERATOR_VISUAL_TOKEN_DEBT.md is current and correctly recommended to stay active.

### G08. Notification Center Rework shipped to prod 18 days ago; plan doc never archived

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 2
- **Where:** docs/projects/archive/NOTIFICATION_CENTER_REWORK_PLAN.md; docs/projects/archive/NOTIFICATION_CENTER_REWORK_PM_BRIEF.md
- **Evidence (finder):** Plan status: '...on dev 2026-07-06 (unpushed;...) Feature-complete - ready for owner browser test -> release.' reference_prod_release_history.md: 'Prior promotion 58eec6f0 (2026-07-06 via /release promote...) shipped Notification Centre rework (redesigned bell...)'. Confirms this shipped to prod on 2026-07-06 (today 2026-07-24); the doc's 'unpushed' status is ~18 days stale.
- **Verification:** Plan says 'Feature-complete - ready for owner browser test -> release', dated 2026-07-06. Commit 58eec6f0 exists and release history attributes 'Notification Centre rework' to that same 2026-07-06 promote. 07-06 to 07-24 = 18 days as claimed; no remaining ambiguity.

### G09. One-shot kickoff prompts already consumed

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 2
- **Where:** docs/projects/archive/UNIFIED_HOME_BUILD_P01_PROMPT.md; docs/projects/archive/FOUNDING_SEASON_COACHES_WARM_RESTYLE_BUILD_PROMPT.md
- **Evidence (finder):** UNIFIED_HOME_BUILD_P01_PROMPT.md is the kickoff for Phases 0+1, which shipped (commit 9d727ad0, part of the 2026-07-22 promote). FOUNDING_SEASON_COACHES_WARM_RESTYLE_BUILD_PROMPT.md is the kickoff for the warm sign-up journey, shipped via commit 50c09ab5 'feat(coaches): warm the Premium sign-up journey (Founding Season S1-2)' + d8c35f74 'mark Founding Season S1-2 warm sign-up journey built + reviewed'. Both are one-time prompts whose work is done.
- **Verification:** Both files exist, still in active/. UNIFIED_HOME_BUILD_P01_PROMPT.md scope matches commit 9d727ad0 (Phases 0+1). FOUNDING_SEASON_COACHES_WARM_RESTYLE_BUILD_PROMPT.md scope matches commits 50c09ab5 + d8c35f74 (both in git log --all). No concurrent session has archived/moved these files.

### G10. STRIPE_PRICE_VALIDATION_PLAN.md has no status header; Phases 1-2 shipped, Phase 3 pending

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 2
- **Where:** docs/projects/archive/STRIPE_PRICE_VALIDATION_PLAN.md; TODO.md:37
- **Evidence (finder):** File opens with '# Stripe Price-Configuration Validation...' then '> Created: 2026-06-29' with no Status line anywhere. TODO.md:37: 'Phases 1+2 BUILT on dev 2026-06-29 ... Phase 3 (in-app card price-guard) lands with the H8 build'. Commit 38abab23 ('...stripe price validation') confirmed `git merge-base --is-ancestor 38abab23 origin/master` = true (shipped to prod). TODO.md tracks this correctly but the plan doc itself has no status marker at all, unlike its peers.
- **Verification:** STRIPE_PRICE_VALIDATION_PLAN.md has no Status field; body shows Phase1+2 BUILT, Phase3 NOT BUILT. TODO.md:37 matches almost verbatim. Commit 38abab23 exists and is a confirmed ancestor of origin/master (shipped to prod).
- **Proposed action:** Add a Status line matching TODO.md ('Phases 1-2 SHIPPED TO PROD 2026-06-29 via 38abab23; Phase 3 in-app card price-guard pending, ships with H8'); keep active since Phase 3 is open.

### G11. TODO.md has two separate entries for 'Unified Home IA Redesign' — the older is badly stale

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** duplicate | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 1
- **Where:** TODO.md:10; TODO.md:279
- **Evidence (finder):** Line 10 and line 279 are both titled '**Unified Home IA Redesign**' and both link docs/projects/archive/UNIFIED_HOME_IA_REDESIGN_PLAN.md. Line 279 only describes Phases 0+1 (2026-07-18 state) with no mention of Phases 2-5 or Phase 6 that line 10 (and reality) already cover — a stale duplicate left behind, not consolidated.
- **Verification:** TODO.md has two 'Unified Home IA Redesign' entries: line 10 (current, Phases 0-5) and line 280 (claimed 279, off-by-one only) under 'Active Tasks' section, stuck at 'Phases 0+1 BUILT... Next: P2/P3/P4/P5' — confirmed stale duplicate of the same project.

### G12. MEMORY.md index summary for prod-release-history is ~2 weeks stale (topic file body itself is current)

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** memory-marker | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 1
- **Where:** C:/Users/b2cow/.claude/projects/c--Users-b2cow-Documents-tournament-website/memory/MEMORY.md; C:/Users/b2cow/.claude/projects/c--Users-b2cow-Documents-tournament-website/memory/reference_prod_release_history.md
- **Evidence (finder):** MEMORY.md index line: 'Prod release history + watermark - prod at 56b4e59c (2026-07-10 release, migs <=181, verified 2026-07-17); dev ahead'. But the topic file's own top paragraph already documents 'PROMOTE 2026-07-23 (f064712d ... 13 commits)' and 'PROMOTE 2026-07-22 (c743c276 ... 55 commits)' with mig watermark 198. Confirmed via `git log origin/master -8` (HEAD f064712d) and migration-file existence checks. The one-line index summary was never refreshed after the file body was.
- **Verification:** Read reference_prod_release_history.md: top 2 paragraphs are 'PROMOTE 2026-07-23 (f064712d)' and 'PROMOTE 2026-07-22 (c743c276, watermark #196)', current. The stale '56b4e59c/migs<=181/verified 07-17' text is paragraph 3 of the SAME file (kept as history) but MEMORY.md's index one-liner quotes only that old paragraph. Matches finding exactly.

### G13. Player Development memory entry stale: marked '(ACTIVE)' but its plan doc is already archived

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** memory-marker | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 1
- **Where:** MEMORY.md:49 (project_coaches_portal_player_development.md); docs/projects/archive/COACHES_PORTAL_PLAYER_DEVELOPMENT_PLAN.md
- **Evidence (finder):** MEMORY.md: '[Player Development (ACTIVE)]...P3 3A/3B/3C COMMITTED -> 3D...next; migs 189-191 dev-only; D2 privacy gates prod'. But git log shows b968ec2e 'chore(docs): archive Player Development project (complete on dev)' and f7efdd36 'Player Development D6 copy pass + D2 privacy sign-off' - the plan/PM_BRIEF already sit in docs/projects/archive/, and D2 privacy (the stated prod-gate) is signed off. Migs 189-191 confirmed on origin/master.
- **Verification:** git log confirms b968ec2e 'archive Player Development project (complete on dev)' and f7efdd36 'D6 copy pass + D2 privacy sign-off'; plan file exists under docs/projects/archive/. Topic memory file's own header already says 'PROJECT CODE-COMPLETE...all four slices shipped' + D2 signed off. Migs 189-192 confirmed on origin/master. MEMORY's '(ACTIVE)...3D next' tag is stale.

### G14. Tournament Seam WI-2C described as 'uncommitted' — actually committed and shipped to prod

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** memory-marker | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 1
- **Where:** MEMORY.md:31 (project_tournament_seam_ux_review.md)
- **Evidence (finder):** MEMORY.md: 'P2 WI-2C...BUILT on dev uncommitted 2026-07-22; mig 196 dev-only prod-pending; remaining = /review + owner QA + commit'. git log shows commit 742eca07 'feat(tournament): recognize paid-portal coaches on public pages - Tournament Seam P2 WI-2C', and reference_prod_release_history.md's 2026-07-22 promote lists 'recognize paid-portal coaches on public pages' among shipped items; TODO.md:15 independently confirms '✅ COMMITTED + SHIPPED to prod in the 2026-07-22 release (mig 196 on prod; plans archived)'.
- **Verification:** git log shows 742eca07 'recognize paid-portal coaches...Tournament Seam P2 WI-2C'. TODO.md:15 (read directly) already states '✅ COMMITTED + SHIPPED to prod in the 2026-07-22 release (mig 196 on prod; plans archived)' — contradicting MEMORY.md's claim of 'uncommitted...mig 196 dev-only prod-pending; remaining = /review + owner QA + commit'.

### G15. PLAYOFF_TIEBREAKER_COINTOSS_RUNDIFF_PLAN.md header contradicts its own body

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 1
- **Where:** docs/projects/archive/PLAYOFF_TIEBREAKER_COINTOSS_RUNDIFF_PLAN.md:3; docs/projects/archive/PLAYOFF_TIEBREAKER_COINTOSS_RUNDIFF_PLAN.md:166; memory/project_tiebreaker_coin_rundiff.md; TODO.md:313
- **Evidence (finder):** Line 3 top header: 'Status: Planned — awaiting build greenlight'. Line 166 same file: '## Build status — BUILT 2026-06-10 on feat/free-tier-coaches (dev only)' with full adversarial-review detail below it. memory/project_tiebreaker_coin_rundiff.md and TODO.md:313 both correctly say BUILT dev-only, awaiting browser verification. lib/tie-breakers.ts exists live. Only the top-of-file header line was never updated after the build.
- **Verification:** Line 3 = 'Status: Planned — awaiting build greenlight'; line 166 = 'Build status — BUILT 2026-06-10 on feat/free-tier-coaches (dev only)' with full review detail. TODO.md:313 verbatim matches: 'BUILT 2026-06-10 ... awaiting browser verification.' Contradiction confirmed.
- **Proposed action:** Rewrite line 3 header to match the file's own §Build status + memory/TODO: 'BUILT 2026-06-10 on dev, no migration, awaiting browser verification' — do not archive yet (browser verification still open).

### G16. FREE_TIER_LEAGUE_STARTER_PLAN.md Status line contradicts its own build log above it

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 1
- **Where:** docs/projects/archive/FREE_TIER_LEAGUE_STARTER_PLAN.md:10; docs/projects/archive/FREE_TIER_LEAGUE_STARTER_PLAN.md:8; TODO.md:109
- **Evidence (finder):** Line 10: '> Status: Planning (6.0-6.4 built; 6.5-6.7 remaining)'. But line 8 (same file, the build log directly above): '6.7 DONE 2026-06-13: browser QA passed (owner) + migration 125 APPLIED TO PROD... Phase 6 BUILD COMPLETE + prod-DB-ready — a flag-off, unlisted beta. Remaining = Phase 9 launch.' TODO.md:109 agrees: '6.0-6.6 BUILT... 6.7 DONE... mig 125 APPLIED TO PROD... Remaining = Phase 9 launch.' Same internal-contradiction pattern as the tiebreaker plan — the summary Status line predates the build log and was never synced.
- **Verification:** Confirmed: FREE_TIER_LEAGUE_STARTER_PLAN.md line 8 says 'Phase 6 BUILD COMPLETE; Remaining = Phase 9 launch' while line 10 Status still says 'Planning (6.0-6.4 built; 6.5-6.7 remaining)'. TODO.md:109 corroborates completed status. Fix proposal is sound.
- **Proposed action:** Rewrite line 10 to 'Phase 6.0-6.7 BUILD COMPLETE + prod-DB-ready (flag off, unlisted beta); remaining = Phase 9 launch (flag flip + League Starter->League branding rename)' — do not archive, Phase 9 is still open.

### G17. TODO.md line 10: Unified Home IA Phases 0-5 described as uncommitted/untested but are committed and shipped to prod

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** todo-stale | **Removal:** no (consolidation/hygiene)
- **Where:** TODO.md:10
- **Evidence (finder):** Line reads 'Phases 0-5 ALL BUILT ON DEV (uncommitted, NOT owner-tested)'. git log shows each phase committed (9d727ad0 P0+1, b9a07c75 P2, 5c7e41c3 P3, 7eb0c1bf P4, 05aac00f P5), and reference_prod_release_history.md's 2026-07-22 promote (c743c276) explicitly ships 'Unified Home IA Phases 0-6'.
- **Verification:** TODO.md:10 says 'Phases 0-5 ALL BUILT ON DEV (uncommitted, NOT owner-tested)'. All phase commits verified: 9d727ad0, b9a07c75, 5c7e41c3, 7eb0c1bf, 05aac00f. memory/reference_prod_release_history.md confirms 2026-07-22 promote (c743c276) shipped Unified Home IA Phases 0-6.

### G18. TODO.md line 11: Notification Pause switch framed as pending prod bundle; already shipped

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** todo-stale | **Removal:** no (consolidation/hygiene)
- **Where:** TODO.md:11
- **Evidence (finder):** Line says 'Pending owner browser/device test + prod bundle (migs 194 + 193 -> prod first)'. Both migrations exist on origin/master and reference_prod_release_history.md lists the Pause switch as shipped in the 2026-07-22 promote. Only owner post-deploy verification could still be genuinely open.
- **Verification:** TODO.md:11 says pending 'migs 194 + 193 -> prod first'. Commit 5a6f20a8 (2026-07-20) built it; reference_prod_release_history.md 2026-07-22 promote entry lists migs 193+194 applied to PROD and Pause-notifications switch shipped.

### G19. TODO.md line 13: Unified Home Phase 6 says 'build NOT started' — actually shipped

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** todo-stale | **Removal:** no (consolidation/hygiene)
- **Where:** TODO.md:13
- **Evidence (finder):** Line: 'NO migration expected; build NOT started; must not run concurrently with Tournament Nav Unification'. Contradicted by commit 2a2d2685 (2026-07-20) and the 2026-07-22 prod promote listing 'follow whole tournaments & organizations free-first' as shipped.
- **Verification:** TODO.md:13 says 'build NOT started'. Commit 2a2d2685 (2026-07-20) implements exactly this feature; reference_prod_release_history.md 2026-07-22 promote lists it shipped.

### G20. TODO.md lines 18-19: Theming/Warm-portal status frozen at Stage 3, three stages behind actual shipped state

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** todo-stale | **Removal:** no (consolidation/hygiene)
- **Where:** TODO.md:18; TODO.md:19
- **Evidence (finder):** Line 19 ends 'Next = Stage 4 trap surfaces..., then S5 chat+tryouts, S6 QA + single public release.' Git log shows Stage4 (71ec4245,1616a72f), Stage5 (289f651e), Stage6 (929589b2), and the public release (c23feb82) all committed, and the whole program shipped in the 2026-07-22 prod promote per reference_prod_release_history.md. mig 195 (flagged 'prod-pending' on this line) is also confirmed on origin/master.
- **Verification:** TODO.md:18-19 stops at Stage 3. Confirmed later commits: 71ec4245/1616a72f (S4), 289f651e (S5), 929589b2 (S6), c23feb82 (public release). reference_prod_release_history.md 2026-07-22 promote lists warm portal Stages 1-6 shipped + mig 195 applied to prod, contradicting the 'prod-pending' framing.

### G21. TODO.md line 23: Platform-Wide Notification Settings still frames migs 185/186/188 as a pending prod bundle

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** todo-stale | **Removal:** no (consolidation/hygiene)
- **Where:** TODO.md:23
- **Evidence (finder):** Line: 'Remaining = owner QA + prod-promotion bundle (migs 185/186/188 + consumer shell + digest schedule, promote together).' All three migration files (185_user_marketing_opt_outs.sql, 186_fan_follows.sql, 188_fan_alert_prefs.sql) confirmed present on origin/master via `git cat-file -e`, and the fresh 2026-07-24 DRIFT report shows 0 dev-only tables. The prod-bundle blocker is resolved; only 'owner QA' (unverifiable here) may remain.
- **Verification:** TODO.md:23 (live disk) still says prod-bundle 'remains' pending. Verified deeper: migs 185/186/188 files exist on origin/master, app/(consumer)/account/notifications/page.tsx (consumer shell) is on origin/master, and digest code (lib/insights-digest.ts) is on origin/master. Whole bundle shipped; only owner QA could remain.

### G22. TODO.md line 44: Notification Center Rework says 'unpushed', but shipped to prod 18 days ago

- **Verdict:** CONFIRMED | **Risk:** safe-mechanical | **Type:** todo-stale | **Removal:** no (consolidation/hygiene)
- **Where:** TODO.md:44
- **Evidence (finder):** Line: 'P0-P4 ALL BUILT on dev 2026-07-06 (unpushed, no migration); feature-complete, pending final /docs + light /review of P4 before ship.' reference_prod_release_history.md confirms promote 58eec6f0 (2026-07-06) already shipped this exact feature to prod. Today is 2026-07-24 — the item has been live for over two weeks while TODO.md still tracks it as unshipped.
- **Verification:** TODO.md:44 (live disk) still says 'unpushed...pending /docs+/review of P4'. reference_prod_release_history.md: promote 58eec6f0 (2026-07-06) shipped 'Notification Centre rework (redesigned bell...new full See all page for BOTH admin+coaches)' matching this item verbatim. git log: app/[orgSlug]/admin/notifications/page.tsx first landed in 10f23791, present on origin/master.

### G23. Theming exploration + promotion-checklist docs — scope decided, build shipped, checklist executed

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 4
- **Where:** docs/projects/archive/WARM_PORTAL_PROD_PROMOTION_CHECKLIST.md; docs/projects/archive/WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md; docs/projects/archive/WARM_COACHES_PORTAL_AND_THEMING_EXPLORATION_PROMPT.md; docs/projects/archive/WARM_COACHES_PORTAL_AND_THEMING_PM_BRIEF.md
- **Evidence (finder):** WARM_PORTAL_PROD_PROMOTION_CHECKLIST.md status line reads 'READY on dev..., NOT on prod. Prepared 2026-07-22' but the 2026-07-22 promote (c743c276, confirmed via reference_prod_release_history.md + origin/master) shipped exactly this bundle. The ANALYSIS/EXPLORATION_PROMPT/PM_BRIEF trio are the upstream scoping docs whose decisions were folded into the (now-shipped) THEME_TOGGLE/WARM_PORTAL plans.
- **Verification:** Checklist listed migs 193-196 to apply pre-promote; release history confirms 193-196 applied to prod ahead of the 2026-07-22 promote and warm portal Stages 1-6 shipped as required — checklist stale/executed. ANALYSIS/PROMPT/PM_BRIEF are upstream docs that unlocked WARM_PORTAL_THEME_OPTION_PLAN.md, also shipped. Downgraded: ANALYSIS §9 keeps a facts index with residual reference value.

### G24. HELP_PHASE2_INCONTEXT_PLAN.md + its TODO.md line both say 'awaiting go' — feature is shipped

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** todo-stale | **Removal:** yes | **~LOC/objects:** 4
- **Where:** docs/projects/archive/HELP_PHASE2_INCONTEXT_PLAN.md:3; TODO.md:463; memory/project_help_system_redesign.md
- **Evidence (finder):** Plan header: 'Approved-pending-build ... awaiting the owner's final "go" to start Wave 0. No code until that go.' TODO.md:463: 'Phase 2 — In-context ("?") help — PLANNED 2026-06-18 ... awaiting owner sign-off'. But memory/project_help_system_redesign.md documents Parts 1, 2, 3B, 3C, and Deliverable E all BUILT + committed (commits 44cfde0, ee798a5, 2f522ec, 3532a6c, 9738c4b, 6ced4ba, 6fe8f50), each independently verified via `git merge-base --is-ancestor <commit> origin/master` = true (all shipped to prod). Both the plan doc AND the TODO.md tracking line are stale in the same direction — this is not just a doc-header slip, the master task list itself is wrong.
- **Verification:** Read plan:3 fresh - still "awaiting the owner's final 'go'"; last edited 2026-06-18, never since. Read TODO.md:463 fresh (status/diff empty, no concurrent edit) - still "awaiting owner sign-off." Memory names commits 44cfde0/ee798a5/2f522ec/3532a6c/9738c4b/6ced4ba/6fe8f50/0b560ca/747f539/f07b53d as the build; all 10 verified real via git log. Claimed files (HelpDrawer.tsx, FieldHint.tsx, HelpButton.tsx, HelpSectionBlock.tsx, registry.ts, app/coaches/help/page.tsx) exist in tree. Shipped to prod: master contains ee798a5 and has HelpDrawer.tsx. Provider mounted (git grep) in 3 live layouts, not orphaned.
- **Verifier notes:** No refuting evidence; every check corroborates further - shipped to prod, actively mounted. One nuance: memory shows Phase 5b left cross-device dismiss + page-level spotlights deferred pending owner go, so full archival isn't warranted yet, only a status correction - finder's proposal already hedges this way.
- **Proposed action:** Correct both TODO.md:463 and the plan header to reflect shipped-to-prod status (tooltip fix, HelpDrawer foundation, 4-page wiring, FieldHints, heads-up warnings, coaches help entry point); consider archiving the plan once any remaining tail items (cross-device dismiss, page-level capability spotlights) are confirmed still open or spun into a follow-up doc.

### G25. FOUNDING_SEASON_COACHES_FREE_PLAN.md says 'PROPOSED' — feature is fully built and live on prod

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 4
- **Where:** docs/projects/archive/FOUNDING_SEASON_COACHES_FREE_PLAN.md:3; memory/project_founding_season_coaches_free.md; TODO.md:199
- **Evidence (finder):** Header: 'PROPOSED (owner directive 2026-07-20; awaiting plan approval to start build)'. memory/project_founding_season_coaches_free.md: 'Phases 0-3 commits (8ea30fe3/e1028b0a/26380896) are ALL on origin/master... LAUNCHED 2026-07-23... prod plan_gating.team -> live... The $0 comp enrollment is OPEN.' Verified `git merge-base --is-ancestor` true for 8ea30fe3, e1028b0a, 26380896, 06d37b6f against origin/master. TODO.md:199 already correctly states 'Phases 0-3 SHIPPED + LAUNCHED 2026-07-23'. The plan doc's own top header is the only place still saying pre-build.
- **Verification:** Line 3 = 'PROPOSED ... awaiting plan approval to start build'. memory shows Phases 0-3 + mig-198 committed (8ea30fe3/e1028b0a/26380896/06d37b6f), all confirmed ancestors of origin/master, plus explicit 'LAUNCHED 2026-07-23' prod flip. Genuine open items remain (warm restyle, safeguard, runbook) supporting keep-active.
- **Proposed action:** Rewrite header to reflect Phases 0-3 SHIPPED + LAUNCHED 2026-07-23 (matching TODO.md wording); keep active — S1-2 warm restyle, one-per-owner safeguard decision, January runbook, and Stripe smoke test remain genuinely open per memory's '⚠ STILL OPEN' list.

### G26. FREE_TIER_COACHES_UNIFIED_PLAN.md says 'build not started' — Phases 0-4+ built and shipped

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 4
- **Where:** docs/projects/archive/FREE_TIER_COACHES_UNIFIED_PLAN.md:3; memory/project_free_tier_strategy.md; lib/basic-coach-roster.ts; lib/basic-coach-schedule.ts
- **Evidence (finder):** Header: 'SCOPED 2026-06-08 ... planning complete, build not started'. memory/project_free_tier_strategy.md documents Phase 0/1/2/3/4 all BUILT (through 2026-06-09) plus Phase 6 League Starter 6.0-6.7 built with mig 125 applied to prod. Verified lib/basic-coach-roster.ts and lib/basic-coach-schedule.ts (Phase 3/4 deliverables) both exist in origin/master via `git show origin/master:<path>` succeeding — i.e. shipped to prod. The unified plan is the canonical execute-in-order doc per memory yet its header never advanced past the initial scoping note.
- **Verification:** Line 3 = 'SCOPED 2026-06-08 ... build not started'. memory documents Phase 0-4 built with migs 114/115. git show origin/master:lib/basic-coach-roster.ts and lib/basic-coach-schedule.ts both succeed = shipped to prod. TODO.md carries multiple live entries confirming ongoing project, not abandoned.
- **Proposed action:** Rewrite header to summarize actual phase completion (Phases 0-4 built+shipped; Phase 5 tournament-coach experience and later phases per memory/TODO); do not archive — still the canonical umbrella doc with open phases, but the header is actively misleading in its current form.

### G27. ADMIN_ROLE_PARITY_PLAN.md header understates reality — already shipped to prod

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 3
- **Where:** docs/projects/archive/ADMIN_ROLE_PARITY_PLAN.md:3; memory/project_admin_role_parity.md
- **Evidence (finder):** Header: 'Phase 1 + Phase 2 BUILT (2026-06-09)... awaiting browser verification. (Phase 1 = commit ec64b17; Phase 2 = follow-up commit 247a16b.)' Verified via `git merge-base --is-ancestor ec64b17 origin/master` and same for 247a16b: both return true — both commits are ancestors of origin/master (prod). memory/project_admin_role_parity.md also stops at 'BUILT' with no shipped marker; §Still deferred lists real remaining org-level-route work.
- **Verification:** Line 3 = 'Phase 1+2 BUILT (2026-06-09) ... awaiting browser verification' (header doesn't literally name 247a16b, minor over-quote). git merge-base --is-ancestor confirms BOTH ec64b17 and 247a16b are ancestors of origin/master = shipped to prod. memory confirms a real deferred org-route item remains.
- **Proposed action:** Correct header to 'Phase 1+2 SHIPPED TO PROD (commits ec64b17, 247a16b)'. Keep active (not archived) because the file's own 'Still deferred (NOT built)' org-level-route items remain open; consider splitting into a smaller follow-up doc and archiving the Phase 1+2 portion.

### G28. ROLE_FLIP_NAVIGATION_PLAN.md header only reflects P1-uncommitted; P1-P3 shipped to prod

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 3
- **Where:** docs/projects/archive/ROLE_FLIP_NAVIGATION_PLAN.md:3; memory/project_role_flip_navigation.md; TODO.md:282; docs/projects/archive/ROLE_FLIP_P4_BUILD_PROMPT.md
- **Evidence (finder):** Top header (line 3): 'P1 BUILT on dev (uncommitted)'. memory/project_role_flip_navigation.md: 'P1-P3 SHIPPED TO PROD 2026-07-23 (promote f064712d...)'. Verified `git merge-base --is-ancestor f064712d origin/master` = true (local master ref was stale/behind — origin/master is the correct prod-truth source; confirmed FlipPill.tsx/AdminEventHeader.tsx exist in origin/master but not local master). TODO.md:282 already correctly says 'P1–P3 SHIPPED to prod 2026-07-23 (promote f064712d)'. The untracked docs/projects/archive/ROLE_FLIP_P4_BUILD_PROMPT.md (git status ??) is the live next-step doc; the parent PLAN.md's header was simply never updated past its original P1 entry.
- **Verification:** Line 3 = 'P1 BUILT on dev (uncommitted)'. memory: 'P1-P3 SHIPPED TO PROD 2026-07-23 (f064712d)'; confirmed ancestor of origin/master. Independently verified local master (8f8b9e1b) != origin/master (f064712d); FlipPill.tsx/AdminEventHeader.tsx exist only in origin/master, exactly as claimed.
- **Proposed action:** Rewrite the top Status line to 'P1-P3 SHIPPED TO PROD 2026-07-23; P4 in progress via ROLE_FLIP_P4_BUILD_PROMPT.md' — keep active (P4 open) but correct the header so it's not misleading at a glance; the mid-document Status(2026-07-23)/historical entries already have the truth, just not surfaced at the top.

### G29. REGISTRATION_COMMAND_CENTER_V1_PLAN.md has no status header; feature shipped, untracked in memory

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** doc-archive | **Removal:** yes | **~LOC/objects:** 2
- **Where:** docs/projects/archive/REGISTRATION_COMMAND_CENTER_V1_PLAN.md; docs/projects/archive/REGISTRATION_HEALTH_PANEL_PLAN.md; lib/registration-attention.ts
- **Evidence (finder):** File opens straight into '## Scope' with no Status line. Its implementation (lib/registration-attention.ts, six attention buckets, dashboard panel + registrations-page strip) was added in commit 02e78b10; `git merge-base --is-ancestor 02e78b10 origin/master` = true (shipped to prod). This is a DISTINCT feature from the already-archived REGISTRATION_HEALTH_PANEL_PLAN.md (lib/registration-health.ts, memory/project_registration_health_panel.md, a different score-card component) — confirmed by different lib files/components in git grep.
- **Verification:** Plan opens at '## Scope', no Status line. `merge-base --is-ancestor 02e78b10 origin/master`=true: shipped to prod. Last touch to lib/registration-attention.ts is f697d31c, ~7wks old, not recent. Grep: file is live, imported by tournament-dashboard route, dashboard page, registrations page, RegistrationHealthPanel.tsx, plus coach-status-model.ts, coaches-status.ts, registration-health.ts, slot-claim.ts. `git show master:lib/registration-attention.ts` returns content. Distinct from REGISTRATION_HEALTH_PANEL_PLAN.md per its own status header. No V2 doc found. TODO.md:176 still `[ ]` since 02e78b10; sweep commit 46be2ea3 fixed sibling lines but missed this one. git status clean.
- **Verifier notes:** Extend the fix: also flip TODO.md:176 from `[ ]`"implementation underway" to `[x]`/Completed with archive-repointed links — that's the actual tracking gap the title flags, and the latest docs-sweep commit (46be2ea3) missed this exact line while fixing sibling stale entries.
- **Proposed action:** Add a status header confirming shipped-to-prod via 02e78b10, then move to docs/projects/archive/ alongside its PM brief; note distinctness from REGISTRATION_HEALTH_PANEL_PLAN.md so a future sweep doesn't conflate them.

### G30. GAME_DAY_BOARD_CUSTOMIZE_PLAN.md says 'awaiting sign-off' — shipped over a month ago, zero tracking

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** doc-archive | **Removal:** yes | **~LOC/objects:** 2
- **Where:** docs/projects/archive/GAME_DAY_BOARD_CUSTOMIZE_PLAN.md:3
- **Evidence (finder):** Header: 'Branch: dev (single shared branch). Status: Awaiting sign-off before build.' Commit 3f20ed5b ('feat(gameday): make the live board customizable (drag/hide/+Add)', 2026-06-15) implements exactly this plan's described feature (GameDayPanelId set, DEFAULT_LAYOUT.gameDayPanels, layout v2 migration). `git merge-base --is-ancestor 3f20ed5b origin/master` = true (shipped to prod). No TODO.md line references GAME_DAY_BOARD_CUSTOMIZE_PLAN.md (grep returns nothing) and no memory/project_*.md file documents this feature — it is completely untracked despite being live in production.
- **Verification:** Plan header: "Awaiting sign-off," describes GameDayPanelId/gameDayPanels/v2 migration/renderGameDayZone. `git show --stat 3f20ed5b` = "make the live board customizable (drag/hide/+Add)" (2026-06-15) implements exactly this. `git merge-base --is-ancestor 3f20ed5b origin/master`=true, on both dev+master (prod). Live page.tsx grep confirms machinery present, now evolved to v3 w/ extra panels via later commits. `git status --porcelain` on plan/brief/dashboard=clean. TODO.md grep "customiz"+"game.?day" combo=0 hits. memory grep=only tangential same-day design_decisions.md entry (different CSS decision). Only referencer anywhere is its own paired PM_BRIEF.md.
- **Verifier notes:** Proposal should also archive the paired GAME_DAY_BOARD_CUSTOMIZE_PM_BRIEF.md (only other file referencing the plan). Corrected header should note the feature was later extended beyond this plan's scope (v2→v3, panels 'upNext'/'needsScore'/'gdScheduleHealth' added by commit 54af8f6c and others).
- **Proposed action:** Confirm scope match against commit 3f20ed5b, then move to docs/projects/archive/ with a corrected 'SHIPPED TO PROD 2026-06-15 (3f20ed5b)' header; add a TODO.md line or memory note so this doesn't require git archaeology again.

### G31. Several shipped features tracked only in docs/projects/active plans have no memory/project_*.md file

- **Verdict:** CONFIRMED | **Risk:** judgment | **Type:** memory-marker | **Removal:** no (consolidation/hygiene)
- **Where:** docs/projects/archive/SCHEDULE_HEALTH_RULES_PLAN.md; docs/projects/archive/REGISTRATION_COMMAND_CENTER_V1_PLAN.md; docs/projects/archive/GAME_DAY_BOARD_CUSTOMIZE_PLAN.md; docs/projects/archive/STRIPE_PRICE_VALIDATION_PLAN.md
- **Evidence (finder):** For each of these four docs, `grep -rl` across the full memory/ directory for the plan's distinctive implementation terms (schedule_health_rules/maxGamesPerDay, registration-attention/registrationAttention, gameday board customize, H8 price-guard) returns zero project_*.md hits. All four features are independently confirmed shipped to origin/master (see sibling findings) yet leave no memory trail — future sweeps would have to re-derive their status from git archaeology, exactly as this investigation had to.
- **Verification:** All 4 docs exist; grep of memory/ for distinctive terms returns zero project_*.md hits, confirming the gap. Independently verified all 4 features shipped to origin/master (schedule-metrics.ts, registration-attention.ts, gameDayPanels via 3f20ed5b, Stripe validation via 38abab23) despite one plan's own header still falsely reading 'awaiting sign-off' - docs even more stale than assumed.
- **Proposed action:** As each doc is archived, add a short memory/project_*.md entry (or fold into an existing adjacent topic file) recording what shipped and in which commit, so status isn't only recoverable via git log.

### G32. Notification Pause master switch shipped to prod 2026-07-22

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 2
- **Where:** docs/projects/archive/NOTIFICATION_PAUSE_SWITCH_PLAN.md; docs/projects/archive/NOTIFICATION_PAUSE_SWITCH_PM_BRIEF.md
- **Evidence (finder):** Plan status line says 'In build (dev)...NOT owner-tested...joins the pending Unified Home prod bundle'; but reference_prod_release_history.md's 2026-07-22 promote (c743c276) explicitly lists 'Pause-notifications master switch' as shipped (commit 5a6f20a8) and mig 194 was applied to prod ahead of that promote. Owner post-deploy device verification may still be open (not resolvable from this evidence) — flagged owner-decision rather than a clean archive.
- **Verification:** Plan says 'NOT owner-tested...joins pending Unified Home prod bundle' but commit 5a6f20a8 matches release history's 'Pause-notifications master switch' shipped 2026-07-22 (mig 194 applied same batch). Separate memory topic file still says 'mig 194 dev-only...pending owner test' — same staleness; owner device-verification unresolved from docs.

### G33. Local git branch 'master' is ~100 commits stale vs true deployed origin/master

- **Verdict:** CONFIRMED | **Risk:** owner-decision | **Type:** other | **Removal:** no (consolidation/hygiene)
- **Where:** local branch 'master' (HEAD 8f8b9e1b, 2026-06-25); origin/master (HEAD f064712d, 2026-07-23)
- **Evidence (finder):** `git rev-parse master` = 8f8b9e1b; `git rev-parse origin/master` = f064712d; `git rev-list 56b4e59c..origin/master --count` = 102. `git diff --stat master dev -- supabase/migrations` shows migrations 180-198 as dev-only, but every one of those files verified present on origin/master via `git cat-file -e`. AGENTS.md/project convention says 'Prod code = local git branch master' - that guidance is unreliable until `git fetch`+`git branch -f master origin/master` (or always diffing against origin/master) is done; any agent trusting local master will over-report dead/pending code.
- **Verification:** Confirmed: local master=8f8b9e1b (2026-06-25), origin/master=f064712d (2026-07-23) after fetch. rev-list 56b4e59c..origin/master=102 (exact match); 56b4e59c is ancestor of origin/master. branch -vv: master behind by 186. Migrations 180/185/190/195/198 all present on origin/master (cat-file -e). Minor nit: quoted phrase is from task context, not verbatim in AGENTS.md.

### G34. HELP_SYSTEM_REDESIGN_PLAN.md (parent doc) header stuck at 'Proposed' though child phases built

- **Verdict:** DOWNGRADED | **Risk:** judgment | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 3
- **Where:** docs/projects/archive/HELP_SYSTEM_REDESIGN_PLAN.md:3; memory/project_help_system_redesign.md; docs/projects/archive/HELP_PHASE5_DISCOVERY_PLAN.md
- **Evidence (finder):** Header: 'Proposed — review complete, awaiting owner direction on the open decisions in §10.' memory/project_help_system_redesign.md documents Phase 1 committed+approved, Phase 1.5 committed, Phase 2 substantially complete (multiple commits shipped to prod per the HELP_PHASE2 finding above), and Phase 5a+5b built+committed (bea5558/747f539/f07b53d). The six §10 decisions were in fact resolved 2026-06-17/18 per HELP_PHASE2_INCONTEXT_PLAN.md's own §9 'all six owner decisions RESOLVED'. The master roadmap doc's header was never revisited after the initial synthesis.
- **Verification:** Header confirmed stale; memory confirms Phases 1/1.5/2/5a/5b built+committed, cited hashes verified ancestors of origin/master. But 'six decisions resolved per Phase2's own §9' conflates two distinct lists (master §10 vs Phase2's internal 9.1-9.6); only 2 of master's 6 explicitly logged resolved in-doc. Core recommendation survives; citation imprecise.
- **Proposed action:** Update header to point at child-phase status (Phase 1/1.5/2/5a/5b built, decisions resolved 2026-06-17/18) rather than 'awaiting owner direction'; keep active as the umbrella doc since Phase 3/4/5b-remainder are still open.

### G35. FREE_TIER_STRATEGY_PLAN.md doesn't note it was superseded by the unified plan

- **Verdict:** REFUTED | **Risk:** safe-mechanical | **Type:** doc-archive | **Removal:** no (consolidation/hygiene) | **~LOC/objects:** 2
- **Where:** docs/projects/active/FREE_TIER_STRATEGY_PLAN.md:3; docs/projects/archive/FREE_TIER_COACHES_UNIFIED_PLAN.md; memory/project_free_tier_strategy.md
- **Evidence (finder):** Header: 'SCOPED 2026-06-07 (planning session — nothing built) · awaiting sign-off to sequence into build'. memory/project_free_tier_strategy.md: 'MERGED into ONE execution plan 2026-06-08: FREE_TIER_COACHES_UNIFIED_PLAN.md is now the canonical execute-in-order plan... The two source plans (FREE_TIER_STRATEGY_PLAN.md, COACHES_EXPERIENCE_EVAL_PLAN.md) are retained as DETAIL references only.' The header gives no indication the plan was superseded a day after being scoped, and that its content has since been executed via the successor doc.
- **Verification:** File line 3 (above the Status line) already reads: 'Execution sequence now lives in FREE_TIER_COACHES_UNIFIED_PLAN.md ... this doc is retained as the strategy/detail reference ... Build in the order the unified plan defines.' git blame shows committed 2026-06-08 (2d6a557c2), not stale/uncommitted. Finding's core claim is false.
- **Proposed action:** Add a superseded-by note pointing at FREE_TIER_COACHES_UNIFIED_PLAN.md (kept as detail reference, not archived, matching memory's framing).

