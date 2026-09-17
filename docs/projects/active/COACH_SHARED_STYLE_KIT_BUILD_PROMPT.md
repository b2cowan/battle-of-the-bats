# Build — the coach-portal shared style kit (only what the owner ruled; nothing else)

*(paste everything below the line into a fresh chat, AFTER the owner has pasted back rulings A–H)*

---

You are building the **coach-portal shared style kit** — the project the owner asked for as the
close-out of the Development lifecycle re-evaluation ("shared stylings are important for
consistency across the app", 2026-09-14), assessed from source and drawn on 2026-09-16, and ruled by
the owner on the hub's Decisions tab. **You are only building what was ruled.** A decision marked
"Change" is built the way the owner's note says; "Not now" is not built and not argued with; a
surface the plan lists as a deliberate difference (§6) is not touched even where a consistent
version would be tidier. This is a consistency pass, not a redesign: the visible outcome is small
everywhere and real on one screen (the team Overview, decision C).

## Step zero — before any code

1. **Read the owner's paste-back** (it will be in the chat, or on the hub's Decisions tab under
   "Rulings so far" if a prior session recorded it). Write the eight rulings into the plan's §5 as a
   "Ruled" column and into the hub's `DECISIONS` array, and republish the hub to the SAME artifact
   URL (`docs/projects/active/COACH_SHARED_STYLE_KIT_HUB.html` → `url`
   `https://claude.ai/artifact/PGjDZKq8X5RDksnHH3abiN`). Then build.
2. **Check the two neighbours' state** — both may be mid-flight in the same files:
   - The **table-standard pass** (ledger §194, F-24/F-25) — was uncommitted at planning time, with
     hunks in `coaches.module.css`, the Development pages and both design docs. `git log --oneline
     -12` and `git status`; if still uncommitted, every commit this session makes is a private-index
     commit of your own hunks only (`reference_shared_worktree_stage_race`, both checks).
   - **F-17, the row-list recipe** (`COACH_ROW_LIST_RECIPE_PLAN.md`, hub
     `S78c93Zrp4U91mZTpyMsXk`) — planned the same day, its own rulings Q1–Q6 owed. Its `rowList`
     composes `.tableWrap` (`--card-bg` · `--home-line` · 8px) — the same token set this kit's card
     takes; confirm nothing there has moved before you declare the card. If F-17's build has
     started, `ListAgents` and message that session before touching `coaches.module.css`.
3. **Confirm the dev server rule**: this session adds new files under `components/coaches/kit/` and
   changes a shared stylesheet — a restart is owed before browser hand-off; batch it once.

## 1. Read first, in this order

1. The plan — `docs/projects/active/COACH_SHARED_STYLE_KIT_PLAN.md` — in full: §3 (the findings with
   file:line), §4 (what the kit holds, component vs class and WHY, the kit's values), §6 (what
   stays different), §7 (the sequence), §8 (verification — what WILL move).
2. The hub's Mockup tab — every After frame is the spec (`feedback_build_to_approved_mockups`: an
   approved mockup is the spec for every surface it depicts, including pre-existing elements shown
   restyled; a deliberate skip is flagged AT BUILD TIME).
3. Memory: `feedback_shared_component_over_shared_class` (this project applies it — and its two
   traps: never reach into a shared component's class from a caller; scope a rule to the container
   that measures it), `reference_codemod_jsx_verification` (the mass replacement),
   `reference_test_waits_on_copy` (renamed classes break UAT waits), `reference_warm_theme_badge_contrast`
   (a static gate here has read dark only), `project_coach_type_scale` (the ladder the kit consumes
   — eight steps, mint none), `reference_shared_worktree_stage_race`.
4. The code the kit replaces: `accounting/overview-dashboard.module.css` + `OverviewDashboard.tsx`
   + `MoneyRail.tsx` + `MoneyNextThirtyDays.tsx`; `development/overview.module.css` +
   `development/page.tsx` (the Overview section and the two list tabs); `coaches.module.css` at the
   line numbers §3 gives (the five toolbars, `.snapshotCard` family, `.cardPhoneLine`,
   `.devReportPhoneLine`/`.devReportOneLine`); `components/coaches/PlayerDevelopment.module.css`
   (`.phoneLine`); `components/coaches/LibraryRow.tsx`; `history/development/panel.tsx`;
   `teams/[teamId]/page.tsx` (the board); `history/page.tsx` (the band).
5. The gates you extend: `tests/unit/coach-history-endpoint-guard.test.ts` (the shape of a
   "no thirtieth branch" guard), the table-recipe stylesheet guard from the table standard's
   build (§9 of `TABLE_AND_LIST_STANDARD.md`), `scripts/layout-screens.mjs`.

## 2. What is settled (cite, do not re-decide)

- The kit's **values** are plan §4's — Money's where the copies disagreed; the type ladder's tokens;
  the table frame's ground and hairline. Not one pixel that is not the ladder's or the card's 8px.
- **Form**: `CoachCard` (report · door), `CoachBar`, `CoachListToolbar`, `CoachRail`/`CoachRailRow`
  are components; eyebrow/figure/sub/chip and the phone-line family are class families — §4 says
  why each; do not swap a component for a class because it is quicker.
- **Where**: `components/coaches/kit/` — one `CoachKit.module.css`, one export per part, one docblock
  that lists §6's exemptions by name.
- **Sequence**: plan §7 — kit first with no consumers, Money Overview (must not move a row), S&G
  Overview, the toolbar screen by screen with Money last, the phone line, THEN the visible ones
  (team Overview C, Insights band D), then the rail. An owner "Not now" on C or D costs nothing
  above it.
- **Deliberate differences** (§6, decision H as ruled) stay. The docblock names them.
- Standing rules that bind every line: the type ladder (eight steps); one spelling; `formatTime()`;
  no zebra; the tap floor 44 both ways at ≤ 768; **the current season is the primary focus** on
  every surface you touch; a closed season is ONE PAGE (you do not go near `season-end`).

## 3. Method

- **Build the kit's guard in step 1, red, and make it green by deletion.** The guard fails on any
  coach `*.module.css` outside the kit declaring `.card .eye .big .railRow .panelToolbar
  .listToolbar .insightsPanelToolbar .ppToolbar .scheduleToolbar .phoneLine .devReportPhoneLine
  .snapshotCard`. Every step of §7 turns one of those red rows green by deleting the copy.
- **Each consumer is a codemod, verified as JSX** (`reference_codemod_jsx_verification`): after
  every replacement, `tsc` over the changed files AND a rendered check — `check:layout` on that
  screen, both skins.
- **Measure the baseline before and after each step, not once at the end.** The plan's §8 is
  precise about what may move: the Overview's rows (re-accepted by measurement, listed in the
  commit message), nothing else. A row that moves on Money, S&G, Roster, Dues, Sessions, Playing
  Time, the library, Coverage or Results is a defect in that step, not a baseline update.
- **Read the dark skin every time you read the warm one.** F02 is invisible in warm.
- **UAT waits**: grep `tests/uat` for every class you rename before you rename it.
- After each logical chunk: `/simplify` (this project's whole point is the reuse lens — run it
  before `/review`), then `/review`, then `/docs` only if a user-facing flow changed (it should not
  — say so in one line if nothing needs it).
- **Commit per §7 step on the owner's say-so**, private index, explicit pathspecs, `git show --stat
  HEAD` after each; record each hash in the plan's §7 row and the hub's stage strip ("Built
  `<hash>` <date>" — an anchored positive, never "pending").

## 4. The QA walk you write at the end

On the hub's QA Walk tab (unhide the button and the section; fill `QA_PARTS`), one part per §7
step, steps pinned to IDENTITIES not figures: "the Record tile opens the record and lifts on hover",
"the Dues card's overdue slice is hatched, in both skins", "the Roster's toolbar and the Sessions'
toolbar sit at the same height and their count lines read at one size", "the Drills line and the
Results line read in one ink at 390", "the S&G rail's chevron matches Money's", "in dark, the
Overview's cards are the same grey as Money's". Append a ledger § at the tail of
`OWNER_QA_LEDGER.md` (re-read the tail first — a § can be taken by a peer between sessions), update
TODO's line and the plan header, republish the hub.

## 5. What would make this session a failure

- Building anything the owner ruled "Not now", or "improving" a §6 exemption on the way past.
- A class where §4 says component (the back-link lesson: the identical anti-pattern one level
  down, in the pass that existed to end it).
- A kit stylesheet with a pixel in it that is not the ladder's or the card's radius.
- Re-accepting a moved baseline row by hand, or on a screen other than the Overview.
- Reading warm only.
- A commit that carries the table-standard session's or F-17's hunks under your message.
- A guard that nothing can find — the kit drifts by Christmas.
