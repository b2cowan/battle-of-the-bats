Public tournament pages — Stage 8 Part 6: verify, walk, release. Build on `dev`. Part 6 is mostly checking: the
whole-stage review, the layout sweep, one owner walk, and the release. Code work is small: the service worker's cache
version, plus whatever the review and the sweep find.

READ FIRST: AGENTS.md, AGENCY_RULES.md, `.claude/commands/release.md` (all of Phase 1, Phase 2 and Phase 2b), and
docs/projects/active/PUBLIC_TOURNAMENT_STAGE8_PLAN.md: §4 (Part 6), §5, §8 (success criteria), and the "Handed on"
lists of §16, §17, §18 and §19. Then the release-history record (the Claude memory file `reference_prod_release_history.md`
— READ IT BEFORE ANY PROMOTE) and `supabase/migrations/MANUAL_PROD_STEPS.json`. Argue from the code, not from this prompt:
re-open every claim below before acting on it. Parts 1–5 are committed on `dev` (§19's title holds the last hash).

Present the plain-language UX summary first (blocking), before any change. If the code says this prompt is wrong, say so
BEFORE doing the work and ask.

ALREADY RULED (do not re-ask): asks A–D (2026-11-03, BUSINESS_DECISIONS.md "Tournament branding is a logo, colours and
type"; ruling D = the icon change and the flip ship TOGETHER); every in-session ruling of Parts 1–5 (§10–§19); Part 5a's
call (no second font empty; 426 runs blanket, in the promote window). Ask C stands: no column is dropped in this stage.

⚠ ASK FIRST — THE RELEASE IS BIGGER THAN STAGE 8 (re-count it): a promote ships ALL of `dev`. At 2026-11-04 that was 132
commits ahead of `origin/master` and 22 migrations pending on prod (414–438 less a few), from many projects (Club tier
— not on sale —, bank reconciliation, house league, plans and billing, signed-in family accounts, GST/HST…), several of
them with owner walks and prod steps owed (e.g. `UNSUBSCRIBE_SECRET` before signed-in family accounts Stage 1). Whether
`dev` as a whole may go to production is the owner's release decision, not this stage's.
**Recommend splitting Part 6 into 6a and 6b**, and get the owner's ruling before starting:
- **6a — Stage 8 is ready to ship** (this session): the review, the sweep, the cache bump, the walk. Stage 8 then waits on
  `dev`, done.
- **6b — the promote** (`/release`, its own session, when the owner calls the release): every project's prod steps in
  numeric order, the release note, the promote, the truth-up, the morning-after demo check. Stage 8 contributes its own
  line items (below) to that release's checklist.
If the owner rules "one session", do 6a fully first and stop for an explicit go before anything touches production.

THE WORK — 6a (re-open each)
6a-1. `/review` on the WHOLE Stage 8 diff — the switch-removal is exactly the "touches everything" shape (high-risk tier).
     The tree and the history are shared: review the Stage 8 commits only, never a `d4af280e6..HEAD` range (other
     sessions' commits sit between them). The commits (re-check the plan's record titles): Part 1 `d4af280e6`, Part 2
     `02e29f453`, 3a `3304c77fe`, 3b `9b6252e8a`, 3c `62f5841f9`, 3d `33386d5df`, the feed fix `55045ecf4`, 4a
     `ecffa177f`, 4b `72cd94a46`, Part 5 `393b78045` (plus their record commits, docs only). Each part already had a
     /review — this one hunts the CROSS-part defects: a reader one part deleted that another part still calls, a style
     whose last importer went in a later part, a guard rewritten in one part that a later part made vacuous, any
     surviving reference to the switch (`data-public-frame` *selectors* are still live — the frame is the new look; the
     COOKIE, `isPublicFrameOn`, `frameOn` props and the setter route must be gone). Apply Confirmed findings; record the rest.
6a-2. The service worker: `public/sw.js` `CACHE_VERSION` (`v13` at 2026-11-04) — bump it in the code that ships, so an
     installed device drops the old public payloads (raw tournament, notes; §16) and the old-look pages. Check what else
     keys on the version (tests, the SW's own cleanup) before bumping; one bump per release, and say it in the release's
     checklist so 6b does not bump again.
6a-3. The layout sweep — on a LOCAL PRODUCTION BUILD or staging, NEVER the dev server (standing rule, owner 2026-10-13):
     `next build` + `next start` on another port, `UAT_BASE_URL` pointed at it, the public tournament screens and the
     admin Public site / Look screens (`check:layout -- --list` names them; scope with `--only`), 4 widths. The known
     owed rows (§16–§18: the admin strip's 34 px "Dismiss", the club editor's unlabelled 18 px input, the demo chrome's
     tap floors, the old Register/News 36 px doors) — report each as still-present or gone; fix only what is Stage 8's;
     the rest stays recorded. Memory guard: a sweep that aborts is a FAILURE, not a pass.
6a-4. The feed fix's "production port" (§16 Q3): it was written for a release of the feed fix ALONE. If the release
     promotes `dev` (which carries `55045ecf4` and the new pages that read the narrowed feed), no port is needed — confirm
     from the code that prod's legacy pages are gone in what ships (Part 3), and record the port as moot. If the owner
     wants the feed fix out BEFORE the stage, that is a separate hand job and §16's warnings apply.
6a-5. The owner walk — ONE walk, a customer's view with the switch gone (no preview link needed), built as a checkable
     Artifact (the QA-walk convention: paste-back, one purpose, identities pinned not figures) + its OWNER_QA_LEDGER §
     (the next free number at the time). Cover: every public tournament page on a phone and a computer (Overview,
     Schedule + a game, Standings, Teams + a team, Playoffs, Champions, Rules, Register, the pay page); the Public site
     page on Tournament Plus (Look, Logo, Pages) and on the free plan (the one lock line); a club tournament following the
     club's look; "branding done" on the dashboard; the iPhone home-screen icon is FieldLogicHQ's; the demo tour lands on
     every step; the help's Public site guide and the app-icon answer. Run `/design` on the walk only if it draws
     something new (it should not).
6a-6. Close 6a: §20 of the plan (same shape as §19), the header, the Stage 8 TODO line, the PM brief's status
     (`PUBLIC_TOURNAMENT_STAGE8_PM_BRIEF.md`); "Stage 8 is ready to ship; the promote is 6b".

STAGE 8'S LINE ITEMS FOR THE RELEASE (6b — hand these to `/release`; do not run them in 6a)
- Migration 426 on prod **in the promote window, immediately before the push**, blanket, never filtered (its
  MANUAL_PROD_STEPS note, amended in Part 5a): verify 0 just before; re-check once live (`barlow` = old, set NULL;
  any other value → look at that tournament's Public site page with the owner first). 426 also adds
  `organizations.tournament_look_policy`, which the new code reads — prod 500s without it.
- `check:demos:prod` the next morning: the tour's anchors moved in Part 2 and the build reseeds the demo; the tournament
  demo's seed import fault (recorded at the 10-27 release) — check it is fixed before trusting the reseed.
- The post-release truth-up (`/release` Phase 2b): Stage 8's TODO line, the plan header, the memory files that say
  "releases with the flip", the release-history record.
- Release-note material: the new look on every public tournament page; the installed icon is always FieldLogicHQ's;
  the Branding page is now Pages, Look and Logo. Words via `/marketing` (the release note is customer copy).

TESTS — the cache bump gets its guard (or the existing SW guard pins the new version); any review fix gets a test that
fails without it (mutation, as §18); the walk's HTML parses (a broken script kills every tab — parse it before
publishing).

VERIFY — touched + neighbouring unit tests; ESLint on changed files; `check:spelling`; typecheck
(NODE_OPTIONS=--max-old-space-size=6144) if lib/ changed; full `npm test` (name the failures and whose they are — §18
and §19 list the foreign ones); `demo-destinations-guard`; the sweep above. `verify:changed` stops at `npm test` on
foreign failures (`&&`): run its ratchets one by one and report only what names a Stage 8 file. Dev server: restart only
if files were added or deleted (stop it BEFORE deleting `.next`); the production build runs on its own port and is
stopped when the sweep is done.

SCOPE / COMMIT / AFTER — as Parts 4a–5 (§17–§19): own files only; the tree is shared and other sessions stage their own
files, so commit from a private index (pick your hunks; `TODO.md`, `lib/db.ts`, `lib/types.ts`, the snapshots,
`MANUAL_PROD_STEPS.json` and the dictionary are shared); explicit pathspecs; CAS `update-ref`; no push; never master;
nothing against production in 6a. Show the result and the exact file list and WAIT for the owner's go before committing.
Then "6a committed, Stage 8 ready to ship; next 6b (the promote, with `/release`)" and recommend /clear.

STILL OWED, NOT STAGE 8 (record, do not do): the retired-branding-columns drop pass (TODO line, a later `/db` pass);
the News page / Overview news list showing a post aimed at a held-back division (§16); `getDivisions`' empty
`settings` (§16, a latent default-duration read); the playoff-bracket and fan-live-score marketing shots; a help-wide
rename of "Branding" to the menu's "Public site" (§19); the org-settings PATCH still accepting `themeCardStyle` (§19).
