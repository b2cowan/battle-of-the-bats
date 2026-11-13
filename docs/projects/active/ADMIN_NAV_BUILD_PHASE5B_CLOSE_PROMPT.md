# Navigation Phase 5b — close-out: /design, /simplify, /review, then commit

Written 2026-11-12 by the session that built Phase 5b. Run in a fresh session (Opus), on `dev`.

**The owner has said yes to the commit** (2026-11-12, "a prompt to run design, simplify, review and commit") — it lands at
the end of this prompt, once the three passes are applied and the checks are green. **If a pass turns up something that needs
an owner call** (a change to what a coach sees beyond the drawing, a ruling question), stop, record it in the plan's 5b record,
and ask before committing.

## What was built (read these, not this summary, before judging it)

- Plan of record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` §5 Phase 5b — the "BUILT 2026-11-12" record has the shape,
  the measurements and the owed passes. Build prompt: `ADMIN_NAV_BUILD_PHASE5B_PROMPT.md`.
- Drawings (the owner's rulings A1–A6, all as recommended): https://claude.ai/artifact/SAVNjmaraLUazZqVTPAXRR (source
  `ADMIN_NAV_PHASE5B_DRAWINGS.html`).
- Walk §521 (published, owed): https://claude.ai/artifact/KHs5QacKtSWKZt6PLXNHEm — source `ADMIN_NAV_PHASE5B_WALK.html`, built by
  `.probe/nav-phase5b/build-walk.cjs` (edit the builder, re-run it, republish the SAME file path). Ledger `OWNER_QA_LEDGER.md` §521.
- Standard: `docs/agents/design/NAV_STANDARD.md` N3, N11, N13. Design log: `memory/design_decisions.md` (2026-11-12 entry).

**This session's files** (everything else modified in the tree belongs to other sessions — sign-in, club audit log, legal,
house-league teams, business email):

| Kind | Files |
|---|---|
| Code | `app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx` · `components/coaches/CoachPageHeader.tsx` · `components/coaches/CoachTopStrip.tsx` + `.module.css` · `components/coaches/CoachPlayerSwitchMenu.tsx` (NEW) · `components/coaches/CoachPlayerSwitchSheet.tsx` · `components/shared/SidebarMenu.tsx` · `components/shared/UnsavedChangesGuard.tsx` · `lib/coach-team-nav.ts` · `lib/coach-player-tabs.ts` · `app/[orgSlug]/coaches/coaches.module.css` · `scripts/layout-screens.mjs` · `lib/help-content/coaches.tsx` |
| Tests | `tests/unit/coach-band-phase4b.test.ts` · `coach-nav-phase4.test.ts` · `coach-nav-phase5.test.ts` · `coach-page-actions-guard.test.ts` · `coach-people-phone-guard.test.ts` |
| Docs | `docs/agents/design/NAV_STANDARD.md` · `memory/design_decisions.md` · `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` · `ADMIN_NAV_BUILD_PROMPTS_INDEX.md` · `ADMIN_NAV_BUILD_PHASE6_PROMPT.md` · `OWNER_QA_LEDGER.md` (§521 only) · `TODO.md` (the Phase 5b line, and the 🧭 header line if it mentions 5b) · `ADMIN_NAV_PHASE5B_WALK.html` (NEW) · this prompt (NEW) · the untracked 5b build prompt, drawing prompt and drawings if `git status` shows them untracked |

⚠ `git diff` EVERY file before staging. Several (TODO, the plan, the prompts index, the help file, `coaches.module.css`, the
page, NAV_STANDARD) may also carry another session's hunks — take only the 5b hunks.

## 1. /design — the built screens against the drawing

Run `/design` on the player page as built, at 1440, 768 and 390 (Details, This season; the Players list open on a computer; the
roster sheet on a tablet; Morgan Left off the roster; a long name), against the drawing above. The build's measurements are in
the plan record (Details' first section 248 on a computer vs the drawing's ≈246). Probes and screenshots from the build are in
`.probe/nav-phase5b/` (`after.mjs` parts `settled|paint|menu|long`, `off.mjs`). Sign in with `npx playwright test --config
playwright.config.ts --project=auth-setup` if the stored state is stale. Apply what it finds that the drawing already ruled; a
finding that changes the drawing is an owner call.

## 2. /simplify — where to look

Three new shapes, each worth a hard look:
- **A title with one home per width** in `CoachPageHeader` (`deskRecord` / `barNames` / `untitled` / `titleAway`, plus the new
  `titleMenu` slot): is there a simpler way to say "the chrome holds the title one level down"?
- **The strip's facts giving way** (`useFactsGiveWay` in `CoachTopStrip.tsx` — a ResizeObserver + MutationObserver that marks
  `data-crowded`; the CSS rules after `.recordSlot`): is the observer pair needed, or would CSS alone do it?
- **The band learning a second shape** (`coachBandAt` answers `roster/{id}`) and **save-first** (`data-saves-first` as the
  guard's one opt-out; the list and the sheet both call the page's `switchTo`): is there duplication between
  `CoachPlayerSwitchMenu` and `CoachPlayerSwitchSheet` rows worth one helper?
Keep `SidebarMenu`'s keyboard contract and the three placements intact. Run `/simplify` before `/review`.

## 3. /review

Run `/review` on the 5b diff (the files above). Areas the builder flagged: the off-roster check (`onRoster` from the active
roster list), the save-first path when a save is already in flight, `aria-controls` only while the sheet is open, the game
console's "← Schedule │ Game" side effect, and the summary's Figure captions ("a fact or nothing").

## 4. Keep the walk true

**Run the walk alongside these passes, never gated on them** (owner 2026-10-28). If a fix changes a line a §521 step quotes,
change the step in `.probe/nav-phase5b/build-walk.cjs`, re-run it, check its script parses, and republish
`docs/projects/active/ADMIN_NAV_PHASE5B_WALK.html` to the same URL. Grep the Phase 6 prompt for any 5b wording that went stale.

## 5. Checks

- `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` (it OOMs silently with exit 0 otherwise).
- The guards: `node --import ./tests/ts-resolver.mjs --test tests/unit/coach-band-phase4b.test.ts tests/unit/coach-nav-phase4.test.ts tests/unit/coach-nav-phase5.test.ts tests/unit/coach-people-phone-guard.test.ts tests/unit/coach-page-actions-guard.test.ts tests/unit/sheet-frame-guard.test.ts tests/unit/one-window-stage3.test.ts tests/unit/one-window-stage2.test.ts tests/unit/club-share-census.test.ts tests/unit/coach-player-tabs.test.ts tests/unit/nav-standard-guard.test.ts`.
- `npm run check:spelling`, `npm run check:demos` (or the demo anchor check `verify:changed` runs), eslint on the touched files.
- `npm run check:layout -- --changed` on the player screens only if a pass changed layout (no sweeps on the dev server).
- `verify:changed` had 22 failures at the build, none in a touched file (billing, disputes, support console, tournaments) —
  re-check that is still true; do not fix other sessions' reds.

## 6. Commit (the owner's yes is given above)

On `dev` (re-check `git rev-parse --abbrev-ref HEAD`). Through a **private index on HEAD** — `GIT_INDEX_FILE=<tmp> git read-tree
HEAD`, then add exact hunks (`git apply --cached` of a hand-cut patch for a shared file), `git write-tree`, `git commit-tree`,
and a compare-and-swap `git update-ref refs/heads/dev <new> <old>` — so other sessions' staged work is never touched. Two
commits, as earlier phases did:
1. The build: code, tests, help, layout script, NAV_STANDARD, `memory/design_decisions.md`. Message says what a coach sees
   change (the player page's tabs from the start, the summary on Details only, the name ▾ as the switcher, off-roster in the
   bar, long names), and ends with the co-author line.
2. The records: the plan's 5b record ("committed `<hash>` 2026-11-12"), the prompts index row, the TODO line, ledger §521's
   header (`commit owed` → `committed <hash>`), the Phase 6 prompt, the walk page, this prompt and the untracked 5b prompt /
   drawing files.
After each, `git show --stat HEAD` and confirm only these files landed. Then update the auto-memory
(`project_admin_nav_evaluation.md` and its `MEMORY.md` line) with the hashes. Do not push.

## Done when

/design, /simplify and /review are applied or recorded in the plan's 5b record; the checks are green on touched files; §521's
steps still match the screen (republished if any changed); both commits are on `dev` with only these files; the records name the
hashes; the owner has a product-owner summary of what the passes changed and what is still owed (walk §521; the dev server
restart if one is due).
