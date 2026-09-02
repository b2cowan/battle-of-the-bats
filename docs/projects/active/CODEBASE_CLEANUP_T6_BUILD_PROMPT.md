# Cleanup Tranche 6 — retire the money panels' standalone plumbing, and the post-August dead-code sweep

**For:** a fresh chat. **This one BUILDS** (deletions are the build), under the Codebase Cleanup
programme's binding rules (`docs/projects/active/CODEBASE_CLEANUP_PLAN.md`, tranches 0–3 executed
2026-07-24/25; T4 judgment consolidations and T5 DB stay owned by that plan and are **not** this
prompt's job). Written 2026-09-01 from a code inventory taken that day (appendix A). Owner intent:

> retire the money panels' dead standalone pages and also do a bigger review of any other dead
> code that we need to run cleanup on, hoping to keep our architecture as clean and understandable
> as possible as we continue to move forward with growing the product.

---

## 0. Rules that bind every deletion in this tranche

1. **Fresh reference-grep before every deletion**, even if appendix A says "confirmed". The July
   audit was overturned on five items at execution time (HudSkeleton, a token with a live consumer
   the audit missed, three button classes) — appendix A is a lead, not a verdict.
2. **Single-scope commits, explicit pathspecs, `git show --stat HEAD` after each.** Never
   `git add -A` / `git add .`. Commit only when the owner has said to (standing rule); propose the
   commit groups in §6 and wait.
3. **The working tree is SHARED with concurrent sessions.** Before touching a file, `git status`
   it: a file with foreign hunks is edited only by exact-match Edit, never rewritten, and is named
   in the hand-off as mixed. A mine-only commit can be a *broken* commit if it imports a module
   another session created but never committed — check `git cat-file -e HEAD:<path>` for every
   import a change relies on.
4. **Gates after every group:** `npm run typecheck` (shared modules move), `npm run
   verify:changed`, and `npm run check:layout -- --changed` when any coach screen or the portal
   stylesheet is touched (the money hub screens re-render; reseed first — a green sweep over an
   empty fixture is not evidence). Deleted files ⇒ **restart the dev server before hand-off**
   (stop, `rm -rf .next`, `npm run dev`).
5. **Tombstone discipline stays:** a deletion with a lesson behind it leaves a one-paragraph ⚰
   comment at the site (this codebase's convention; appendix B confirmed every existing tombstone
   is comment-only — keep it that way). A deletion with no lesson leaves nothing.
6. **Don't reach into work another tranche or review owns:** `.tagChip` (the tagging review,
   round-1 mockups already published), T4/T5 items, and anything the dues-forms / club-money
   builds are mid-QA on (§124/§126).

---

## 1. Part one — the named job: the money panels stop pretending they might be pages

**What's true now.** On 2026-08-31 the eight legacy standalone money routes and their redirect
module were deleted outright (commit `2d430bad`). The Money hub
(`app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx:24-40, :574`) is now the **only**
mount of all six panels, and it passes `embedded` as a bare `true`. Every panel still declares
`embedded = false` as a default and branches on it. That plumbing is a prop with one possible
value — a lie the next reader has to disprove by hand.

**Do, per panel** (`budget`, `budget-vs-actual`, `dues`, `expenses`, `fundraisers`, `club` —
`accounting/*/panel.tsx`):
- Remove the `embedded` prop and its default; the `variant={embedded ? 'embedded' : 'standard'}`
  ternaries (`budget/panel.tsx:494,499,1407` · `dues/panel.tsx:360,365,1618` ·
  `fundraisers/panel.tsx:59,64,367` · `expenses/panel.tsx:798,812,5636` · `club/panel.tsx:244,249,760`
  · `budget-vs-actual/panel.tsx:643,647,1015`) collapse to the embedded shape.
- Delete the two confirmed-dead `!embedded` branches: the standalone-only **Import** buttons at
  `budget/panel.tsx:1339-1348` and `expenses/panel.tsx:5596-5600` (the latter's own comment at
  `5628-5632` calls the prop inert). The hub's `Import ▾` menu is the one door.
- Remove the inert `help={{…}}` props the panels pass to `CoachPageHeader` — the embedded shape
  ignores them by design (`components/coaches/CoachPageHeader.tsx:117, :169-170`); the hub's own
  header carries this screen's "?".
- **Keep** `tabActive` (real: it scopes each panel's unsaved-changes guard to the tab on screen)
  and **keep** `legacyMoneyAddress` in `lib/coach-money-links.ts` (the hub's `?section=`/`?tab=`
  normaliser; sole caller `accounting/page.tsx:176` — a live contract the mobile smoke asserts).
- Decide (owner Q1/Q2 below) whether the panels should render `CoachPageHeader` at all once the
  only shape is "actions row": the two bands already use the plainer `panelToolbar` +
  `panelSubhead` idiom, and one idiom for a panel's control row beats two.
- Retire the retired: drop `'from'` from `ONE_SHOT_KEYS` (`accounting/page.tsx:232` — nothing
  reads it; `expenses/panel.tsx:1660-1663` documents its retirement).
- Update the page-actions guard inventory (`tests/unit/coach-page-actions-guard.test.ts`) — it
  records each panel's header `variant: 'embedded|standard'`; after this pass that string is a
  lie in six rows.
- Re-run: typecheck, verify:changed, `check:layout --changed` (all six hub tabs), the phone smoke
  surfaces test and the membership smoke's deep-page block (which passes vacuously on the season
  redirect — known; don't "fix" it here, it belongs to season-close work).

**Why it matters beyond tidiness:** the `embedded`/standalone fork is exactly the shape that hid
the "Where it lands" preview's dead branch for a week and the never-working `.inlineField` rule for
a month — code guarded by a condition that can no longer be true reads as live to everyone who
comes after.

---

## 2. Part two — the post-August dead-code sweep (verify-then-delete)

Each item: fresh grep → delete → note. Group into the commits in §6.

**2a. Dead files and exports (confirmed by grep on 09-01):**
- `components/coaches/SeasonRecordWidget.tsx` — zero importers (the two "SeasonRecordWidget"
  mentions in `history/page.tsx:133` and `lib/coach-season-record.ts:3,5` are prose describing a
  convention, not imports). Delete the file; reword those two comments.
- `lib/coach-membership.ts:207` `getActiveMembershipsForUser`, `:222` `getActiveMembershipTeamIds`
  — declared, never called anywhere.
- `lib/coach-fundraising.ts:113` `resolveCredit` — zero references (the sponsor arrivals model
  superseded it; the file's own header still describes it — reword).
- `lib/coach-tournament-phase.ts:66` `isAcceptedPhase` — zero references.
- `lib/coach-money-links.ts:46` `LegacyMoneySection` type — zero importers; keep the string
  comparisons, drop the exported type.

**2b. Over-exported privates (used only in their own file — de-export, don't delete):**
`coach-membership.ts` `getTeamStaffMembershipList`, `syncLiveSeasonProjection` ·
`coach-register.ts` `byDateAscending` · `coach-roster-bulk.ts` `blankDraftRow`, `parseRosterLine` ·
`sponsor-arrivals-server.ts` `getSponsorArrivals` · `rep-tournament-game-mirror.ts`
`syncTournamentGameMirror` · `AwardIconPicker.tsx` `AWARD_ICON_LIBRARY` · `coach-cash-strip.ts`
`MONEY_BACK_RECORDED` · `coach-club-money.ts` `CLUB_MONEY_IN_WORD` · `coach-budget-rollup.ts`
`NO_ITEM`. (Check tests/ before de-exporting — a unit test importing one is a legitimate caller.)

**2c. Suspected-only — do NOT hand-delete; let tooling decide (§3):** ~70 exported *types* across
~55 lib/component files with no textual match outside their declaration (appendix A, Part C
list). Types are exported defensively; a hand pass here is where audits go wrong.

**2d. Dead CSS in `app/[orgSlug]/coaches/coaches.module.css` (12,340 lines):**
- Confirmed zero-usage: the old "Now" card's content variants — `nowBridge` (2489), `nowDivider`
  (2445), `nowEyebrowCount` (2410), `nowGameDay` (2395), `nowInSeason` (2394), `nowLiveDot`
  (2411), `nowMoneyAlert` (2461), `nowResult` (2396), `nowScoreResult` (2443), `nowScoreline`
  (2436 — flagged dead on 08-28), `nowStatIn`/`nowStatMuted`/`nowStatOk`/`nowStatWarn`
  (2456-2459), `nowStatsRow` (2447); and `ppFieldHint` (9226), `ppGroupTools` (9347), `ppWarn`.
  The card shell (`nowCard`, `nowEyebrow`, `nowHeadline`, `nowMeta`, `nowActions`, `nowSecondary`)
  is live — leave it.
- Selectors defined TWICE at top level with **conflicting** rules — real cascade bugs, fix by
  renaming one side to what it actually styles and updating its callers: `.statStrip` (1652 vs
  5150-5155), `.duesCardStatic` (11229-11235 `display:block` vs 11239-11245 `display:flex`).
  `.tagChip` (4696 vs 9864) is the same defect but **owned by the tagging review** — coordinate,
  don't race it.
- Additive duplicates to merge into one block (non-conflicting, just split): `.coachesShell`
  (354/3361), `.ptMatrixNever` (2010/2020), `.oneAnswerMuted` (2319/2334), `.setupItemSkipUndo`
  (2836/2847), `.orderGrip` (9060/9083).
- The sampled prefixes were `.now .pp .tag .sponsor .band .register .legacy .breadcrumb`; the
  other ~1,300 selectors were NOT sampled. §3's tooling covers the rest.

**2e. Stale baselines and records:**
- `scripts/.tsx-token-baseline.json` — three keys point at files that no longer exist:
  `accounting/fundraisers/detail.tsx`, `accounting/payment-requests/panel.tsx`,
  `app/tryout-response/[token]/page.tsx`. Prune (the checker skips missing files, so this is
  hygiene, not a failure).
- Plan docs in `docs/projects/active/` whose own status line says done — **archive** (move both
  the plan and its PM brief; TODO links repointed): `COACH_MONEY_HUB_TABS_PLAN.md` (on prod
  08-12), `COACH_PAYABLES_REBUILD_PLAN.md` (on prod 08-27), `COACH_FUNDRAISER_BAND_PLAN.md` +
  `_PM_BRIEF.md` (committed `2d430bad`, QA passed), and `COACH_FUNDRAISER_DRILL_IN_PLAN.md`,
  which now documents a mechanism that **no longer exists** — supersede its header pointing at
  the band plan before archiving. Do a full pass of `active/` for others (status line says
  PASSED / COMPLETE / on prod).
- Frozen UAT results (`tests/uat/results/journeys/J4/*`) reference deleted routes — historical
  snapshots, leave them.

**2f. Junk at the repo root (untracked, delete outright):** `0`, `=`, `scratch_diff.txt`, and two
files whose names are mangled Windows temp paths beginning `C:Usersb2cowAppDataLocalTemp…` (a
past session wrote a scratch diff to a path with `:` stripped). None is referenced by anything.

---

## 3. Part three — stop this from regrowing (the recommendation that matters most)

The July audit found ~4,400 lines of dead code; five weeks later a scoped sample found another
dead file, five dead exports, eighteen dead selectors, three conflicting duplicates and five stale
docs. **The product grows faster than a periodic audit can sweep**, and nothing in the repo
detects a dead export or a dead selector today (no knip / ts-prune / depcheck is configured —
verified). This repo's proven answer to that shape of problem is the **ratchet**: the colour-token
guardrail baselines what exists and fails only on *new* debt. Recommend the same for dead code:

- **Adopt `knip`** (unused files, exports, types, dependencies; understands Next.js route files)
  in **report mode first** (`npm run check:dead:report`), then wire a **ratchet** into
  `verify:changed`: a committed baseline of today's findings, red only on a NEW unused export or
  file. Same mechanics as `scripts/check-public-tokens.mjs` (`--init` to re-baseline, an
  annotation escape hatch for the deliberate cases: route exports, the sport-pack tables, test
  fixtures). Let it adjudicate the ~70 suspected type exports instead of a human.
- **A dead-selector check** for the CSS modules — knip does not see CSS; a small script (there is
  precedent in the token guardrail's selector walker) that lists module classes with zero
  `styles.<name>` / `shared.<name>` usage, baselined and ratcheted the same way; plus a
  **duplicate-top-level-selector** assertion (the three conflicts above are exactly what it would
  have caught on the day they were written).
- **A docs ratchet:** fail `verify:changed` when a file in `docs/projects/active/` has a status
  line matching PASSED / COMPLETE / "on prod" and its last commit is older than 14 days — the
  archive rule exists (`AGENCY_RULES.md`) and is missed every time because nothing runs it.
- **A repo-root allowlist** in `verify:changed`: any untracked file at the root not in the
  allowlist fails the gate with its name — the five junk files would have been caught the day they
  appeared.

Present these as options with the owner's questions (§4); build only what is ruled in.

---

## 4. Questions for the owner (answer before building)

1. **The panels' header row:** collapse to the embedded `CoachPageHeader` shape, or replace it
   with the bands' plainer `panelToolbar` idiom so a panel has one control-row pattern?
   (Recommendation: the toolbar idiom — fewer shapes; but it re-measures six screens in the
   rendered check, so it is a visible change, not a pure deletion.)
2. **Keep the panels mountable outside the hub at all?** (Recommendation: no — no route exists,
   and "might be a page again someday" is what the prop's own comment used to justify itself.)
3. **knip as a ratchet gate in `verify:changed`** — yes/no? And the CSS dead-selector +
   duplicate-selector check — yes/no?
4. **The docs-archive ratchet and the repo-root allowlist** — yes/no? (Both are ~50-line scripts.)
5. **The ~70 suspected type exports** — leave them to knip (recommended) or hand-verify now?
6. **Files with concurrent foreign hunks** (dues/budget/club panels are mid-QA): touch them under
   rule 0.3, or defer those three panels' plumbing removal until §124/§126 close? (Recommendation:
   exact-match edits only, named in the hand-off; the removal is mechanical and the QA walks don't
   exercise the removed branches.)

---

## 5. Verification and hand-off

Per group: typecheck · verify:changed · `check:layout -- --changed` (money hub tabs; reseed) ·
`npx playwright test tests/uat/scenarios/coach-money-mobile-smoke.spec.ts -g "every Money
surface"` · the sponsor lifecycle spec if any API file is touched. Dev server restarted before the
owner tests. Hand-off in product-owner voice: what a coach sees differently (for Part one:
*nothing* — that is the point; for the tooling: what turns red and why), what was deleted, what
was kept and why (the refuted list, so the next sweep skips it), what is owed.

Record completion in `CODEBASE_CLEANUP_PLAN.md` as **Tranche 6**, in `TODO.md` (one line), and in
the cleanup memory file — the July convention.

---

## 6. Proposed commit groups (single-scope each; wait for "commit")

1. `chore(repo): junk files + stale baseline keys + archived plan docs` (Part 2e/2f)
2. `refactor(coach-money): the panels stop pretending they might be pages` (Part 1)
3. `chore(coach): dead file + dead exports + de-exported privates` (Part 2a/2b)
4. `style(coach): dead selectors and duplicate selectors in coaches.module.css` (Part 2d, minus
   `.tagChip`)
5. `build(gates): dead-code ratchet(s)` (Part 3 — only what is ruled in)

---

## Appendix A — Inventory (2026-09-01, file:line; re-grep before acting)

See §1 and §2 for the itemised lines. Method: hub mount verified by grepping every panel
component name across app/, components/, lib/, scripts/, tests/ (one importer: the hub);
`⚰` tombstones (18 markers, 12 files) each checked for residual code — all comment-only; exports
checked by symbol + module-path grep; CSS checked by extracting all 1,486 class selectors and
grepping `styles.`/`shared.` usage across app/ and components/ for the sampled prefixes; duplicate
selectors found by scanning top-level `.name {` repeats (168 raw repeats, 160 legitimate `@media`
overrides, 8 real duplicates). Concurrency note: other sessions were editing the tree during the
inventory; line numbers drift.

## Appendix B — Refuted / keep (so the next sweep skips them)

`legacyMoneyAddress` (live hub normaliser) · `CoachBackLink` (three documented live sites:
development board, opponent detail, awards certificate) · `CoachPageHeader`'s `standard` variant
(live portal-wide; only the six panels' branch is dead) · the "Back to Money" tombstones (comment
only) · `tabActive` (live guard scoping) · the `nowCard` shell (live) · the July audit's own
refuted list in `memory/project_codebase_cleanup_audit.md` (BOTB seed scripts, seed-free-tier-org,
outline-svg-text, LegacyInstallBanner, fan-push 410 shims, the 13 "redundant" indexes).
