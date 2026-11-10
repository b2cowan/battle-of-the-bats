# Finish prompt — Navigation, Phase 1 · Part B: `/design`, `/review`, then commit

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-10 after Part B was built, measured and
> `/simplify`-ed on `dev` (nothing committed). Read first: the hand-off block at the top of
> `docs/projects/active/ADMIN_NAV_BUILD_PHASE1_PARTB_PROMPT.md` ("Part B BUILT 2026-11-10"), then the plan's Phase 1 →
> Part B record in `ADMIN_NAV_EVALUATION_PLAN.md`. Drawings: https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4 (tab 13, ruled B1–B6 all A).

## The job, in order
1. **`/design`** on the built screens against tab 13. Look at: the club cell with a one-line, a two-line and a cut name; the tile
   with a logo, initials, a wide / tall / very light logo; folded (40px, 2px of air, the line meeting the tab band's); the dark
   theme (the tile stays white); the back link (strip, phone bar, paper header) hover / press / focus. Fixture to change the test
   club: `node scripts/walk-logo-tile.mjs logo|two|long|wide|tall|light|none|broken`, then **`restore` when finished**.
   Dev server: it is running on :3000 (restarted 2026-11-10 after the new files). Do not sweep the whole product on it; use
   `npm run check:layout -- --only=admin-hub,admin-rep-teams` style runs only.
2. **`/review`** on this session's diff (the file list below, not the whole working tree). Apply what it finds, or record a
   finding the owner must rule on. Re-run the gates after any fix: `npx tsc --noEmit` (set `NODE_OPTIONS=--max-old-space-size=6144`),
   `npx eslint` on the touched files, `node --import ./tests/ts-resolver.mjs --test tests/unit/sidebar-logo-tile.test.ts tests/unit/sidebar-strip-guard.test.ts tests/unit/admin-kit-guard.test.ts tests/unit/admin-kit-nav.test.ts`,
   `node scripts/check-spelling-consistency.mjs`, `node scripts/check-public-tokens.mjs --scope=all`.
   **Known red checks that are NOT this work** (other sessions'): the colour literal in `components/help/help.module.css`,
   admin lettering for `Billing.module.css` / `KitDialog.module.css`, `schedule-admin.module.css` old-look count, the
   `/platform-admin` orphan CSS classes, `debug.log` at the repo root, `bank_saved_lines` schema parity, the Overview "Needs
   someone" tap-floor findings, the folded foot's 7px spill. Do not fix them here; say they are still red.
3. **Commit** (this prompt is the owner's yes for ONE commit; do not push, do not touch `master`).

## This session's files
**New (whole files, safe to add):** `components/shared/SidebarLogoTile.tsx`, `components/shared/SidebarLogoTile.module.css`,
`lib/club-shape-read.ts`, `lib/logo-aspect.ts`, `lib/org-logo-measure.ts`, `scripts/backfill-org-logo-aspect.mjs`,
`scripts/walk-logo-tile.mjs`, `supabase/migrations/458_a_logo_remembers_its_shape.sql`, `tests/unit/sidebar-logo-tile.test.ts`,
`docs/projects/active/ADMIN_NAV_PHASE1B_WALK.html`, `docs/projects/active/ADMIN_NAV_BUILD_PHASE1_PARTB_FINISH_PROMPT.md` (this file).

**Modified, whole-file mine:** `app/api/admin/club-brief/route.ts`, `app/api/admin/org-logo/route.ts`,
`app/[orgSlug]/admin/layout.tsx`, `app/[orgSlug]/admin/AdminChrome.tsx`, `app/globals.css` (the two `--logo-tile-*` tokens),
`components/admin/AdminPageHeader.module.css`, `components/admin/AdminTopStrip.module.css`,
`components/admin/kit/AdminKitEventHeader.module.css`, `components/admin/kit/club/ClubBriefProvider.tsx`,
`components/coaches/CoachesChrome.tsx`, `components/coaches/CoachPageHelpSlot.tsx` (comments only), `lib/api-auth.ts`,
`lib/club-email-context.ts`, `lib/db.ts`, `lib/server-organizations.ts`, `lib/stock-logo-render.ts`, `lib/types.ts`.
**Check each with `git diff -- <file>` before staging; if it shows a hunk that is not described above, it is another session's: leave it out.**

**Modified, MIXED with other sessions' hunks — commit only this session's hunks:**
- `components/admin/kit/AdminKitRail.tsx`: mine = the `ClubCell` function, the `SidebarLogoTile` / `isSidebarStrip` imports, the
  `currentOrg` line, the club-cell JSX. Another session's = the foot / spacer / heading rules.
- `components/admin/kit/AdminKitFrame.module.css`: mine = the `.clubCell` comment + `.clubName`, and the removal of `.clubTile`
  and the cell's font lines. Another session's = the foot / spacer / heading rules.
- `docs/agents/db/DATA_DICTIONARY.md`: mine = the `organizations.logo_aspect` entry only.
- `docs/projects/active/OWNER_QA_LEDGER.md` (mine = the new §507 block at the very end only; the file also has another session's
  edits and a line-ending difference against HEAD — do NOT let the commit rewrite the whole file), `TODO.md` (mine = the one
  navigation line), `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` (mine = the "Part B BUILT 2026-11-10" bullet),
  `docs/projects/active/ADMIN_NAV_BUILD_PROMPTS_INDEX.md` (one row), `docs/projects/active/ADMIN_NAV_BUILD_PHASE1_PARTB_PROMPT.md`
  (the new top block; the file is untracked-or-new, check `git status`).
- `docs/agents/db/schema-snapshots/*`: the refresh after mig 458 also holds other sessions' bank tables. Include them only if the
  diff is the refresh's own output and you can say so; otherwise leave them and note that a `npm run refresh:snapshots` is owed.
Method for a mixed file: `reference_partial_commit_shared_tree` in the memory index (a private index on HEAD, exact edits, then
update the ref). Never `git add -A` or `git add .`; explicit pathspecs only. Branch must be `dev` (`git rev-parse --abbrev-ref HEAD`,
re-check just before committing).

## Commit message (one commit)
Subject: `Navigation Phase 1 Part B: the club's name on two lines, the one logo tile, the club's shape on the first paint, one back-link look`
Body (short): what the owner sees; the logo's shape is stored with the logo (migration 458, **dev only — production at the promote with the
owner's yes, with the one-time pass `scripts/backfill-org-logo-aspect.mjs --prod --write` and the read-only N10 census before it**);
the shared tile takes its source and fallback as props (event in Phase 2, team crest in Phase 4, not wired); the review / design results;
the other sessions' red checks left alone. End with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
After committing: `git show --stat HEAD` and confirm only this session's files landed (if a foreign file or hunk slipped in:
`git reset --soft HEAD~1`, unstage it, re-commit). Then fill in the commit hash (positive wording: "committed `<hash>` 2026-11-10") in the
TODO line, the plan's Part B bullet, the index row, this folder's Part B prompt block, and the project memory
(`project_admin_nav_evaluation.md`) — as a SECOND small docs commit of those lines only.

## Report back (product-owner voice)
What `/design` changed, what `/review` found and what you did with each finding, the gates' final state, the commit hash(es), and what
is still owed: the owner walk §507 (https://claude.ai/artifact/PCppSvfDoD9DVaJ5Qtrded), `/demos` look, mig 458 + the backfill on production
at the promote, the N10 census. Do not start Phase 2.
