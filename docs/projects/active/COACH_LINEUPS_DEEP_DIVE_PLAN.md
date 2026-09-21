# Coach Lineups Deep Dive — Implementation Plan

**Status:** Committed `ba4f2dfe` · **ON PROD 2026-09-18 (job 268)**, promoted ahead of the owner walks on the owner's call. Phase 0/1/2 built (2026-09-18): factual readiness/coverage analysis, exact conflict/open-cell cues, solid table/control treatment, per-inning coverage, playing-time decision support, the persisted Draft/Ready handoff (mig 304, applied to prod 2026-09-18), the Setup/Auto-fill toolbar hierarchy, the footer's move to the shared floating save pill, and print preflight for open roles. D1–D5 (§10) all approved on the recommended path. Phase 3 is now fully built too: the Playing-time upgrade landed alongside Phase 1 (D4), and its remaining piece — per-cell Auto-fill rationale — is built per D6/D7 (2026-09-18): a hover/focus tooltip names why Auto-fill placed a player (`Best 1`, `Rotated`, `Only eligible pitcher`), and the mound's open-role message names a proven pitching-cap cause when that's why it's blank. Statically verified + full unit suite green (4244 tests, +34 for this and prior work); an owner browser walk is still owed. Phase 4's inning inspector (D5) built the same day (see §6 Phase 4 · Implemented; walk owed — hub QA part H); its Sport Pack vocabulary half stays open. **D8 (2026-09-18, owner question on review): the three views became two** — the Batting order tab is retired, the grid's number is the phone's drag handle and row-actions door (see §10 D8; walk owed — hub QA part I). Where this document says "three views" below, it is describing the product as assessed, not as built.
**Companion brief:** `COACH_LINEUPS_DEEP_DIVE_PM_BRIEF.md`
**Review hub:** `COACH_LINEUPS_DEEP_DIVE_HUB.html` — published at https://claude.ai/artifact/DkLKncrdzh5eyZbPhsE33b (Mockup / PM Brief / Full Assessment / Decisions / QA Walk tabs; republish this same file path for any future revision)

## 1. Outcome

Turn Lineups from a capable but visually quiet spreadsheet into a coach-facing preparation workflow that answers, in order:

1. Who is in the batting order?
2. Is every inning covered?
3. Are any assignments unsafe or contrary to the depth chart?
4. Is playing time distributed the way the coach intends?
5. Is this lineup still a draft, or is it ready for game day?

The existing three-view model (batting order, positions, playing time) stays. The proposal clarifies the sequence, raises contrast, makes readiness honest, and separates an incomplete draft from a proven problem.

## 2. Scope and evidence

Reviewed:

- the Lineups games/templates hub;
- the shared game/template editor;
- batting-order, positions, and playing-time views;
- auto-fill, reshuffle, game-rule overrides, templates, print, undo/redo, autosave, and attendance reconciliation;
- lineup generation, profile eligibility, pitching caps, fairness analysis, and the hub's current “Lineup set” calculation;
- the app-wide table/list standard and the warm coach theme shown in the supplied screenshots;
- the saved production lineup for Milton Bats U13 Purple vs Brampton Gold at 10:00 a.m. on September 19, 2026 (read-only query on 2026-09-18).

No data was changed. Browser verification remains owner-run under the repository workflow.

### 2.1 Approved addendum — consecutive pitching stints (implemented 2026-09-18)

Auto-fill now treats pitching as the only continuity-constrained position. When it assigns a player more than one inning at `P`, those innings form one uninterrupted stint; it cannot generate `P → Bench → P` or `P → field position → P`. The active pitcher is reserved before bench and field rotation, then retired from pitching selection after leaving the mound.

Competitive mode keeps its ace-first behaviour and existing caps. Balanced and Development still spread pitching, but do so in consecutive blocks instead of alternating pitchers inning by inning. `Fill empty spots` bridges writable gaps between coach-set pitching innings when caps allow, preserves locked manual assignments, and reserves cap space for fixed pitching innings elsewhere in the game. No continuity rule applies to any other position.

Focused regression coverage exercises all three modes, bench-heavy seven-inning games, the editor's best-of-candidates path, pitching caps, writable partial-fill gaps, locked `P → SS → P` risk, and the absence of continuity rules for non-pitching positions.

## 3. What is already strong

- One shared editor keeps game lineups and templates behaviourally aligned.
- The three views separate ordering, assignment, and review better than one overloaded grid.
- Batting order supports drag, arrow controls, nine-player promotion/demotion, and preserves player assignments when reordered.
- Auto-fill honours ranked Best positions, Never exclusions, pitching eligibility/caps, bench balance, inning ranges, and three game intents.
- Attendance mismatches are explicit and never silently rewrite either attendance or the lineup.
- Autosave, visible save failure/retry, undo/redo, printouts, and templates cover the common recovery and reuse paths.
- Phone work has deliberate touch targets, pinned identity columns, a swipe cue, and a docked action bar.

These are foundations to preserve, not replace.

### 3.1 First-time coach walkthrough of today's experience

1. **The games hub appears reassuring too early.** The coach sees `Lineup set` as soon as any one position has been saved. They cannot distinguish a reusable complete plan from a draft abandoned after inning 1.
2. **The builder opens in Positions, mid-workflow.** This is efficient for a returning coach, but a first-time coach may not realize Batting order is a separate first step or that reordering there carries every position with the player.
3. **The setup row has no dominant action.** Format, Innings, Auto-fill, Reshuffle, and Templates carry similar visual weight. Auto-fill is the time-saving feature, but its current Competitive/Balanced/Development mode is hidden until opened.
4. **Generation produces an answer without an explanation.** The coach can see where everyone landed but not why, which depth-chart state mattered, which cap was applied, or why a role was left open. Reshuffle reuses settings that are no longer visible.
5. **Manual correction is visually difficult.** The page grid shows through the comparison table; headings and dropdown boundaries are quiet; every option looks equally valid; blank is a hyphen. A coach cannot see Best, Never, pitcher eligibility, or cap headroom at the decision point.
6. **The checks are separated from their targets.** A clash colours the inning heading, not the two clashing cells. Open roles become one amber sentence above the table. The coach has to scan the grid to locate the cause.
7. **The attached inning-7 message creates the wrong mental model.** Two blank player rows happen to be pitchers, while two field roles (`P`, `LF`) are open. The UI guesses that Never made them unfillable; the saved profiles prove otherwise. This encourages the coach to distrust either their depth chart or the warning.
8. **Playing time confirms totals but does not finish the decision.** The coach sees on-field ratios and position counts, but must infer who needs another inning, who sits consecutively, and how much pitching cap remains.
9. **Recovery and output are good once discovered.** Autosave, retry, Undo/Redo, templates, attendance reconciliation, and both printouts provide strong safety and practical field output.
10. **There is no finish line.** The coach leaves with Saved, but Saved only means persistence. It does not tell another staff member that the plan was reviewed and is ready for game day.

## 4. Findings

### F01 — The attached warning is right about coverage and wrong about cause and tone (P0)

The saved inning 7 has seven field assignments, three explicit Bench assignments, and two blank player cells (Alex Tennant and Ashlyn Webb). The required roles `P` and `LF` are unassigned. Both blank players are pitchers, but that does not fill the pitcher role: neither cell contains `P`. Neither has reached the stored four-inning pitching cap; Alex is eligible at LF and Ashlyn has LF in her ranked Best list.

`analyzeLineup()` only sees position strings. If any player is blank or benched, it reports every missing field role; it receives no profile, pitching, cap, or generator-decision context. The UI then adds one guessed cause: “a player may have this spot set to Never.” That cause is not true for this inning and could also be wrong when the actual cause is a pitching cap, a rotation cap, a benched eligible pitcher, a manually cleared cell, or a deliberate unfinished draft.

**Recommendation:** keep the coverage fact, remove the guessed diagnosis, and classify it as a neutral draft check while the coach is working: “Inning 7 has 2 open roles: P and LF.” Only show a warning when the application can prove a violation or when the coach attempts to mark the lineup ready. Add an action that focuses inning 7.

### F02 — “Lineup set” currently means “at least one nonblank cell” (P0)

`getRepTeamLineupSetEventIds()` marks a game set when any saved entry contains any nonblank position. The hub then displays “Lineup set,” removes the game from “Needs lineup,” and may present it as ready elsewhere. A one-cell draft and a complete, conflict-free lineup are therefore the same state.

**Recommendation:** replace the boolean with a shared readiness result:

- **Not started** — no assignments;
- **Draft** — work exists, but open roles, blank player decisions, or hard issues remain;
- **Ready** — every participating player has a field/Bench decision for every inning, required roles are covered for the chosen roster size, and there are no hard conflicts;
- **Needs review** — saved work has a proven clash, cap violation, or Never-position violation.

Prefer an explicit `draft` / `ready` status on the lineup with `ready_at` and `ready_by`, and automatically return it to Draft after an edit. This gives head and assistant coaches an honest handoff. If schema work is declined, use derived `Not started / Draft / Complete` wording and never call derived presence “ready.”

### F03 — The positions and playing-time tables do not paint the card ground (P0 visual)

The app-wide table standard requires the frame to paint `--card-bg`; body rows may then be transparent over it. `.lineupTableWrap` paints only a border, and `.lineupSummaryWrap` paints neither a frame nor a ground. The blueprint page grid therefore shows through both tables, exactly as the supplied screenshots demonstrate.

**Recommendation:** make each table a solid card-ground comparison surface, keep subtle row hairlines, and remove translucency from controls inside it. On mobile, retain the established pinned-column behaviour and opaque sticky cells.

### F04 — Column headings and controls use the quietest ink where the standard requires stronger ink (P0 visual)

Both lineup tables override headings to `--text-tertiary`; the standard says headings use `--text-secondary` and must never be the faintest text in their own table. Position selects use a translucent `--white-05` ground and a low-contrast border. Shared toolbar selects use the same treatment. In the warm theme this becomes gray text and hairlines over the page grid, so a control looks disabled before it is touched.

**Recommendation:** use the standard heading recipe (display face, support size, uppercase, secondary ink, card ground). Use an opaque input ground, strong neutral border, primary value ink, and a visible focus ring for all selects. A blank value should read “Open,” not a lone hyphen.

### F05 — The first-time workflow is present but not taught (P1)

The tabs are arranged in workflow order, but the page opens on Positions. A new coach can generate a rotation before reviewing the batting order, and nothing tells them whether order, attendance, or depth-chart setup is feeding the result. Five controls share similar visual weight (Format, Innings, Auto-fill, Reshuffle, Templates), so the main action is not obvious.

**Recommendation:** retain Positions as the returning-user default, but add a compact preparation stepper/readiness strip: `1 Order · 2 Positions · 3 Review`. Give Auto-fill the only primary treatment and show its current mode on the button (`Auto-fill · Development`). Move Format, Innings, and game-specific rules under a clearly labelled Setup group; keep Templates and Reshuffle secondary.

### F06 — Auto-fill hides the decision that matters most (P1)

The event type silently preselects Competitive, Balanced, or Development, but the closed control says only “Auto-fill.” Reshuffle then reuses hidden settings. After generation, the coach cannot tell why a player landed in a position, whether a Best rating was used, or why a hole remained.

**Recommendation:** expose the active mode in the toolbar, summarize it in one sentence before generation, and show short, nonpersistent explanations after generation: `Best 1`, `Rotated`, `Only eligible pitcher`, or `Open — no eligible pitcher under cap`. Do not clutter every healthy cell permanently; reveal rationale on focus/tap and in the inning review panel.

### F07 — Manual edits can violate the rules Auto-fill honours without a targeted check (P0/P1)

The native position select allows every hard-coded position for every player. Analysis checks duplicate singular positions, open roles, bench spread, and consecutive sits; it does not check a manual Never assignment, a manual pitcher over cap, a non-pitcher at P when a pitching chart exists, a per-position cap, or a minimum-playing-time rule.

**Recommendation:** never block a coach's manual override, but detect and name it. The option menu should group `Best`, `Available`, `Never`, and `Bench`; Never options remain selectable with a confirm/override marker. Proven rule issues appear in the readiness panel with player, inning, and rule source.

### F08 — Position conflicts point to the inning, not the conflicting cells (P1)

The analysis knows which position conflicts, but the table only colours the inning heading and lists prose above the grid. The two cells that need correction look like every other select.

**Recommendation:** mark the exact cells, connect them with `aria-describedby` to the issue text, and make the issue action focus the first conflicting cell.

### F09 — Per-inning completeness is hidden until it becomes prose (P1)

The original builder plan promised a per-inning fill count, but the current header contains only inning numbers and an optional clash glyph. Coaches must scan a 12-by-7 grid to see whether inning 7 is actually done.

**Recommendation:** add a small status under each inning heading (`9/9`, `7/9`, or issue dot). A horizontal readiness strip above the grid summarizes `6 complete · inning 7 open (2)`. This is the most direct answer to the attached screenshot.

### F10 — Playing time reports counts but does not support the next decision (P1)

The view shows on-field totals and position counts. It does not name who sits most/least, label consecutive sits, compare pitchers to their per-game caps, or show which innings create an imbalance. The warning state is currently encoded mainly as a bar colour. Heat opacity also competes with the blueprint grid behind the table.

**Recommendation:** use a solid table; add explicit `Field / Bench` figures; show an “Attention” column only when needed; include pitching `used / cap` and cap headroom; add an inning filter/jump from an issue. Keep the position matrix because it is useful for variety. Do not add season analytics here—those remain in Insights.

### F11 — Blank, Bench, open role, and not in the lineup are conceptually different but visually close (P1)

The data model correctly distinguishes them, but the editor shows blank as `-`, Bench as another dropdown value, open field roles only in prose, and removed players in a separate muted box. A first-time coach can reasonably read two blank player cells as “two pitchers are left” instead of “two player decisions are still open.”

**Recommendation:** use words and structure: `Open` (amber-neutral outline), `Bench` (neutral filled chip), field position (opaque white control), and `Not in lineup` (outside the table). Add a one-line legend under the table on first use and in Help.

### F12 — The comparison table needs a coach-first inning lens (P2)

The player-by-inning grid is the right overview, especially for printing and comparing a rotation. At the field, however, the coach asks “Who is at each position in inning 4?” The current editor requires reading down twelve player rows and mentally inverting them.

**Recommendation:** add an inning inspector/drawer opened from an inning heading. It lists the nine roles, assigned player, bench, and open roles, and supports direct reassignment. It is a second lens over the same data, not a replacement field diagram in phase 1.

### F13 — Position vocabulary is still hard-coded in the shared grid (P2 technical debt)

`LINEUP_POSITIONS` is a diamond-sport constant even though the editor receives a Sport Pack. This is documented debt and is harmless while only baseball/softball use the feature, but it must be removed before another sport is enabled.

**Recommendation:** build selectable field roles from `sportPack.fieldPositions` plus sport-supported extras and Bench. Do this in the same unit as the new analysis contract so display and validation cannot disagree.

### F14 — Role access is sound; readiness ownership is missing (P1)

Lineup capability gates both the hub and builder, and server routes remain authoritative. A permitted assistant and head coach see the same editing tools, which is appropriate. What is missing is who marked the lineup ready and whether it changed afterward.

**Recommendation:** no new capability. Any coach with lineup edit access may mark ready; record and display the actor/time. A later edit reverts to Draft for everyone.

## 5. Proposed experience

### 5.1 Arrival

The games hub shows `Not started`, `Draft · 2 open`, `Ready`, or `Needs review`, not a presence boolean. “Needs lineup” includes Not started and Draft; a separate proven-issue marker distinguishes Needs review.

### 5.2 Build

The builder opens with a readiness strip and three step tabs. Returning coaches still land on Positions. Setup shows Format and Innings; Auto-fill is the primary action and names its mode. The solid-ground table makes player identity and controls readable without competing with the blueprint background.

### 5.3 Diagnose

A neutral panel says what remains (`Inning 7 · P and LF open`) and jumps to it. Proven violations use warning/danger treatment and state the actual reason. Auto-fill can say why it left a role open only when it has the evidence.

### 5.4 Review

Playing time uses explicit figures and attention labels, including pitching cap headroom. The coach can jump back to the inning that creates a concern.

### 5.5 Finish and use

The coach marks the lineup ready. The hub and game-day surface show who marked it and when. Any later edit returns it to Draft. Print remains available for drafts, but confirms when roles are open and names them before generating the file.

## 6. Implementation phases

### Phase 0 — Shared truth model and regression tests (P0)

- **Implemented addendum:** Auto-fill produces one consecutive pitching block per player, protects the active pitcher from the bench/field rotation, honours fixed-cell cap reservations, and applies no equivalent rule to other positions.
- **Implemented core:** the shared analysis now returns Not started / Draft / Needs review / Coverage complete, all missing field roles, player decision counts, and proven position clashes. The editor treats an open role as a factual draft check and never attributes it to Never without eligibility evidence.
- Introduce a pure lineup validation/readiness model shared by builder, hub, game day, print preflight, and tests.
- Inputs include assignments, participating players, Sport Pack roles, player preferences/Never states, pitcher profiles, and resolved game rules.
- Emit typed issues with severity, player, inning, role, and proven cause; never compose causal copy from missing information.
- Add regression coverage from the attached production shape: inning 7 has open `P` and `LF`; the message does not claim Never; both blank pitchers remain eligible under their caps.
- Test partial-save states so one filled cell cannot become Ready.

### Phase 1 — Readability and actionable positions grid (P0/P1)

- **Implemented core:** positions and playing-time frames paint an opaque card ground; headings and controls use stronger semantic ink; blank cells read Open; started innings expose field-role coverage; exact clash/open controls are styled and described; coverage checks jump directly to their inning; Playing time now shows Field, Bench, pitching/cap usage, and player attention.
- Paint solid card grounds on positions and playing-time frames.
- Align table heading type, ink, density, borders, and pinned cells with the approved standard.
- Restyle toolbar and cell selects with opaque grounds and stronger borders; replace `-` with `Open`.
  - ⚖ **Reversed for the CELL on owner review (2026-09-18):** the blank cell reads `—` again — "Open" truncated to "Opei" in the narrow select and read like a position code, the opposite of what a blank should do; the amber outline carries the state. "Open" stays the word wherever there is room for it: the inning inspector, the coverage checks, the cell's accessible description.
- Add inning fill status, exact issue-cell styling, jump/focus actions, and the blank/Bench legend.
- Keep existing responsive behaviour and measure warm/dark themes at desktop, 768, 640, 390, and 361 widths.

### Phase 2 — Workflow and readiness (P1)

- Add setup/build/review hierarchy and active auto-fill mode.
- Replace hub boolean readiness with `Not started / Draft / Ready / Needs review`.
- Add explicit ready metadata (recommended migration) and revert-to-draft on any mutation.
- Update the Overview/game-day readiness consumers and Help copy in the same unit.
- Add print preflight for open roles and hard issues.

### Phase 3 — Coach analysis (P1)

- ✅ **Built in Phase 1:** Playing time Field/Bench figures, labelled attention states, pitching used/cap, and issue-to-inning links (D4).
- ✅ **Already satisfied (pre-existing):** season-level trend analysis stays in Insights; the hub's "Season insights" link predates this project.
- ✅ **Built (2026-09-18) — Auto-fill rationale, per D6/D7:**
  - Tag each cell Auto-fill places with a short reason at generation time: `Best <rank>` (competitive/balanced rank match), `Rotated` (least-played pick, no rank match), or `Only eligible pitcher` (mound, single eligible arm). `generateBestLineup` runs several randomized candidates and keeps the highest-scoring one — the reason map must travel with that winning candidate specifically, not be reconstructed after the fact.
  - When the mound is left blank because no eligible pitcher remains under cap, tag it `Open — no eligible pitcher under cap` (D7: pitcher slot only; every other blank field position keeps today's plain `Open` wording — no general "why is this position blank" reasoning engine in this pass).
  - Surface the reason through the same hover-title / `aria-describedby` pattern already on every cell for open-role and clash messages (D6) — no new tap/popover component.
  - **Accepted limitation from D6:** a native `title` tooltip has no touch equivalent. A coach on a phone/tablet without an external keyboard will not see a per-cell reason — only the existing pre-generation mode summary sentence and the per-inning issue panel. This is a known tradeoff of the faster option, not an oversight.
  - Rationale is held only in memory for the lineup as currently generated — never persisted to the saved lineup. Reopening a previously saved lineup, or manually editing any cell, shows no rationale until the coach runs Auto-fill or Reshuffle again (matches the plan's original "nonpersistent explanations" language).
  - Regression coverage: one reason case per tier (competitive Best-rank match, balanced rotation pick, sole-eligible pitcher, capped-pitcher blank) alongside the existing generator suite.
  - **Fixed same day:** a short-a-pitcher roster can leave the mound open for most of the game, and the open-role list originally repeated one identical block per inning (owner screenshot: six near-identical "No eligible pitcher..." cards pushing the grid below the fold). Innings sharing the exact same open roles AND the exact same proven cause now collapse into one line covering the span (`formatInningRanges` — "Innings 2–7 each have..."); the "Review" button jumps to the first inning in the group, which (via the Phase 4 door) opens straight into that inning's inspector.

### Phase 4 — Inning inspector and sport vocabulary (P2)

- **Implemented (2026-09-18, the inspector half):** `components/coaches/LineupInningInspector.tsx` (+ its module stylesheet) over a pure lens in `lib/lineup-inning.ts` (`inspectInning`, `inningChoiceChanges`, `standingFor`; 13 unit tests in `tests/unit/lineup-inning.test.ts`, including the production inning-7 shape). Opened from every inning heading (`InningHeadingDoor`, rendered inside the grid's own `<th>` so the `data-lineup-inning` scroll anchor is unchanged) and from "Review inning N" (which now opens the lens on that inning and still scrolls the grid beneath it). One `QuestionShell` over the builder: prev/next inning · the Sport Pack's field roles as a `CoachRowList` (the role code as the row's anchor — large, its own column, first at every width; the holder; a depth-chart fact only where there is one — Best N / Never on their chart, nothing for a plain available player; on a charted mound the rank and innings used of cap; the control's resting label is the action — Change… / Assign… / Keep one… — never the name) · Bench / Open / Also lines · and, once the inning is started and a role is open, a "Why this is a draft check" card (per undecided player: pitching used/cap, standing at each open role). The only causes it names are the two the inputs prove — every idle player Never here; every idle pitcher at cap (plus no idle player / no idle pitcher). **D9 (owner review the same afternoon):** the door word beside each role (Change / Assign / Keep one) opens `SublinedChoice` in a new `menu` variant — the money chooser's own floating list, hung from the word's right edge, sized for its rows (`listWidth`, viewport-capped), opening UPWARD when the room below is short, never pushing the table (an in-place fold was built first and rejected by the owner on sight); the control gained an optional per-option `trail` (text + tone) rendered in its live-hint slot (`convWhatOptLive[data-tone]` — three rules added beside the recipe) and a `triggerClassName`; **and every player named under the roles has a door** (owner's third look: "it tells me who is open but gives me no way to action it") — the Bench / Open lines are rows (`CoachRowBand` + `CoachRow`) whose menu is `playerChoiceChanges`: an undecided player's *Decide* (`bench`, or `take:<code>` — the holder SITS, stated in the option, so the inning ends whole rather than handing the open decision to the displaced player), a benched player's *Move* (the same position list); each candidate is a name, a sub-line in the chart's own words (Pitcher P2 · 2 of 4 innings used · Best 1B, 3B, LF · Never C / No positions rated yet) and a coloured pill only about THIS role (Best N · Never · At cap · Doesn't pitch; on the mound the rank), grouped Open → On the Bench → On the field · swap (charted mound: Pitchers → At cap → Not on the pitching chart → swap); a candidate's current position is never shown (it is on the grid behind); a filled role's fold ends with "Leave open", a clash's with "Keep". The native select and its one-line suffixes are gone. Every pick applies through one editor mutation (`applyInningChanges`) so Undo steps back one gesture; a Never pick is allowed and named, not blocked. Deliberately NOT built from the mockup: the "Suggested resolution" line (a matching guess) and a confirm on a Never pick (F07's override marker). Verified: typecheck, lint, the static gates, and a read-only Playwright probe at 1440 and 390 (door 44px on the phone, nine 44px selects, no horizontal overflow, Escape closes). Owner walk: hub QA part H.
- Add the inning-first assignment drawer. ✅
- Source selectable roles from the Sport Pack and retire the hard-coded diamond list before enabling another sport.

## 7. Data and API impact

Recommended migration on `rep_team_lineups`:

- `status` (`draft` / `ready`, default `draft`);
- `ready_at` nullable timestamp;
- `ready_by` nullable user id.

Every assignment, order, mode, inning-count, player-membership, or rule edit clears readiness atomically. The API returns both persisted status and derived validation. The server refuses `ready` when hard issues exist; it may permit a coach-confirmed short-handed lineup only if every participating player has an explicit Field/Bench decision and the exception is recorded in the future. Do not infer intent from blank cells.

If the owner declines the migration, use derived labels only and call the complete state `Complete`, not `Ready`.

## 8. Verification

- Unit tests for readiness, issue causes, caps, Never overrides, roster sizes below/above field size, partial innings, blank versus Bench, and the production regression shape.
- API tests for ready/edited-back-to-draft and capability enforcement.
- Focused component/guard tests for exact issue cells, accessible descriptions, and hub status vocabulary.
- `npm run verify:changed`; typecheck because shared contracts and API shapes change.
- Rendered layout checks for warm/dark at 1440, 768, 640, 390, and 361; measure table ground, heading contrast, select contrast, sticky columns, horizontal overflow containment, and 44px touch targets through 768.
- Owner browser walk: first-time coach builds from scratch, edits an Auto-fill result, resolves/accepts a draft check, reviews playing time, marks ready, changes one cell, prints, and verifies hub/game-day status.

## 9. Success criteria

- A first-time coach can identify the primary action and explain the three views without opening Help.
- No blueprint grid is visible through either lineup table or its controls.
- Every heading and control meets the app's semantic ink and table standards in warm and dark themes.
- A partial lineup never appears as Ready or “Lineup set.”
- Open roles name the inning and roles without guessing a cause.
- A proven Never/cap/conflict issue names the player, inning, rule, and resolution target.
- The coach can answer who sits most, whether anyone sits consecutively, and each pitcher's cap headroom from Playing time.
- Every multi-inning pitcher created by Auto-fill appears in one consecutive block; a pitcher never returns after a Bench or field-position inning.
- Editing a ready lineup visibly returns it to Draft.

## 10. Decisions requested — ALL APPROVED on the recommended path (owner, 2026-09-18)

1. **D1 — Readiness:** ✅ explicit Draft/Ready state with ready-by/time. Built as migration 304 (`status`/`ready_at`/`ready_by` on `rep_team_lineups`) — applied to prod 2026-09-18 (job 268).
2. **D2 — Draft checks:** ✅ neutral open-role checks during editing, warnings reserved for proven violations. Built in Phase 0/1.
3. **D3 — Toolbar hierarchy:** ✅ Auto-fill primary with its mode visible; Format/Innings grouped under a labelled Setup cluster; Reshuffle/Templates secondary. Built.
4. **D4 — Playing time:** ✅ per-game pitching cap headroom shown; season trends stay in Insights. Built in Phase 1.
5. **D5 — Inning inspector:** ✅ deferred past Phase 0/1/2, then built the same day as Phase 4 (see §6 Phase 4 · Implemented). The Sport Pack vocabulary half (retiring the hard-coded diamond list in the grid cell) stays open.
6. **D6 — Auto-fill rationale display (2026-09-18):** ✅ hover/focus tooltip reusing the existing per-cell description pattern; no dedicated tap/popover component. Accepted tradeoff: a touch-only coach will not get a per-cell reason (see Phase 3).
7. **D7 — Blank-cell reason granularity (2026-09-18):** ✅ the pitcher slot only; every other blank field position keeps the existing generic "Open" wording rather than a full reasoning engine.
8. **D8 — Two tabs, not three (owner question on review, 2026-09-18):** ✅ approved from the hub mockup (screen 6, desktop + true-size phone) and built the same day. The Batting order view is retired: the builder is **Lineup** (order, positions, who's in) and **Playing time**, at every width, as the portal's segmented control (`segChoice`, sized to its labels; full-width 44px on a phone — the strip ruling relayed the same day). The reason the third view existed — a phone could not drag inside the sideways-scrolling grid — is answered in the grid: at touch widths (≤768) the batting number is a 44px handle in the pinned column; the touch sensor lifts a row after a **hold** (250ms, 5px tolerance) so hold and swipe are told apart by time rather than direction, a mouse still lifts after 6px; a plain **tap** opens a row-actions sheet (Move up · Move down · Remove from lineup · Cancel — the `lineupAutoMenu` phone recipe, so the ↑ ↓ × the order view carried are one tap away instead of one tab away, and nobody is stranded if press-and-hold misbehaves on a given phone). The desktop grid is untouched (grip + ×). Gone with the view: its "usual positions" subtitle and the "drag above this line" bench cut (the Start checkbox does that job at every width). Help article updated. UAT smoke tests rewritten (two tabs; handle 44px; sheet opens on tap; a reorder from the sheet keeps positions with the player) — green at 360px. `check:layout` on both editor screens: the two findings this change would have introduced were fixed in passing (the shared toolbar height's two-class selector outranked the phone floor on Format/Innings; the cells' sr-only descriptions were absolutely positioned against the viewport and scrolled the whole page sideways by 300px at 390 — the scroller is now their containing block). Owner walk: hub QA part I.
9. **D9 — The inspector's picker (owner review of the built panel, 2026-09-18):** ✅ three looks in one afternoon. (i) The native select beside each role echoed the name and crammed "· Bench · Best 2 · C" into one line, and the list clipped LF/CF/RF — fixed. (ii) Redrawn to the money chooser's recipe; the first build folded the candidates open UNDER the row and the owner rejected it on sight ("can't this open as a dropdown and not push the whole table down?") — rebuilt as `SublinedChoice`'s new `menu` variant, a floating list hung from the door word that never moves the rows, with a toned trail in the chooser's live-hint slot; a candidate's current position is never shown; the swap group stays, last. (iii) "It tells me who is open but gives me no way to action it" — the Bench / Open lines became rows with *Decide* / *Move* menus (Bench this inning, or take a position with the holder sitting). Walk: hub QA part H.
10. **D10 — One banner, one door (owner review of the built page, 2026-09-18):** ✅ built the same day. The owner opened a game and read three warning surfaces above Setup (the attendance mismatch strip, the readiness card, a duplicated "Review inning" button) and then, on a lineup short a pitcher, **six** open-role cards — one per inning, each repeating "P" — before the grid: *"7 rows above the lineup on the main page is not a good user experience."* Ruled, over a consolidated-list counter-proposal: **a single banner** with a status symbol (a check when every role is covered, a warning while anything waits, a cross on a clash) and one sentence naming what is waiting; tapping it opens **the Lineup check** (`components/coaches/LineupCheck.tsx`), a summary Question in three groups — Attendance (the Add / Remove buttons moved here from the page strip), Innings (one row per inning that needs a decision, the shared fact said once on the band — "P open in all 6" — and the innings nobody has started as one row), Fair play — and each inning row opens the **existing inning inspector**, which now wears the same status symbol in its header and carries a way back to the check. The attendance strip, the per-inning cards, the clash line and the uneven-bench line are gone from the page; the strip is the only thing between the views and Setup. **Tradeoff accepted:** the Remove-Out-player button is one tap further away; Mark ready sits beside the door, never inside it (a mismatch warns, never blocks). Hub mockup v2 (clickable): https://claude.ai/artifact/RPMeEUzvnW6phPZPPH2tCS. Walk owed: hub QA part J.
11. **D11 — Ready with open spots (owner question 2026-09-20, drawn and ✅ APPROVED the same day — a–d built, c as the check; e stays open; committed `b823e721` 2026-09-20 together with D10; walk owed, hub QA part K):** coaches pre-fill a few innings or positions and adjust at the field, so a lineup with empty spaces is legitimately "ready" to the coach. **What the code does today:** `Mark lineup ready` is offered — and the PATCH accepts — only when `analysis.readiness === 'ready'` (every player decided in every inning, every required role covered in every inning, no clash), so that lineup stays Draft forever, the Overview's one-thing card keeps prompting for it and the hub keeps it under Needs lineup; meanwhile the builder deliberately keeps untouched innings quiet ("a wholly blank inning is intentional, not an error") and then refuses to honour the choice at the gate. The state was built to stop a one-cell accident reading as done (F02); "not started cannot be marked" serves that reason in full, and "nothing may be empty" is a stronger rule nobody asked for. **Proposed (hub mockup screen 7, D11 card on the Decisions tab):** (a) gate Mark ready on *wrongness* — a clash blocks, an empty lineup has nothing to mark, open roles never block; (b) the Lineup check's count of innings needing a decision rides on the button (`Mark ready · 3 innings open`), the Ready strip's sentence (`Innings 5–7 open — fill them at the field`) and the hub chip (`Ready · 3 open`), no confirmation dialog; (c) the mark on a Ready-with-gaps lineup is the coach's word — a check (recommended) — with a warning-mark alternative drawn beside it; (d) an edit at or after game time is the game and does not return the lineup to Draft — today a Game-Day Mode substitution goes through the same PUT and un-readies it, so every game the coach adjusted live reads Draft on the hub afterwards; the open count is dropped once the game is over; (e) separate: whether a past game shows a record word (Lineup / No lineup) rather than Draft / Ready. Server re-check stays; print preflight still warns; the Schedule quick-look keeps "Has a lineup". **Built 2026-09-20:** `canMarkLineupReady` (hasAssignments && !hasConflicts) and `inningsNeedingDecision` in `lib/lineup-analysis.ts` — the ONE count the builder's button, the Ready strip and the hub chip all read; the PATCH gates on it (409 names the clash or the empty grid); the PUT passes `keepReadiness: gameHasStarted(event, now)` (new predicate in `lib/coach-game-day.ts`, start time not the live window's opening) and `upsertRepTeamLineup` leaves `status/ready_at/ready_by` out of the payload when it is set; `getRepTeamLineupReadinessByEvent` returns `{ statusByEvent, openInningsByEvent }` and the events read emits `lineupOpenInningsByEvent` beside `lineupStatusByEvent`; the builder page reads the same clock through `useMinuteClock` for its local Draft mirror and takes the PUT response's status as truth; the strip's mark on a marked-ready lineup is the check (`LineupCheck` gained `stateLabel` so its header says "Marked ready" rather than "every role covered"); copy is sport-neutral ("on game day", "game time"). Unit: +11 tests (analysis helpers, the clock); full suite 4291 green; typecheck clean. **/review 2026-09-20 (high-risk funnel, 5 lenses):** Critical CONFIRMED + fixed — `handleMarkReady` fired its own PUT while the debounced autosave could still be in flight; with no server-side ordering the earlier PUT could land after the PATCH and reset the row to Draft (pre-existing since D1; D11's write-back of the PUT response made it visible on screen). Fix: every lineup PUT on the builder page runs through one promise chain (`saveChainRef`, the console's own guard from the 2026-08-04 review) and the mark awaits it; the status write-back is signature-guarded like the dirty clear; the mark trusts the PATCH response. Also fixed: template editor's "Coverage complete" detail now `withWaiting` (a warn mark over an uneven bench had no sentence naming it — pre-existing); the hub's template-apply optimistic Draft now checks `gameHasStarted`; `DATA_DICTIONARY.md` rep_team_lineups gotcha 4 and the `RepTeamLineup.status` comment corrected (both said a save ALWAYS resets). Refuted: the Overview card moving on for Ready-with-gaps (approved D11b). Recommended, not built: the Overview prep chip carrying "· N open" like the hub chip. Help synced (/docs) — see the hub card. ⚠ At the time of the review a peer's uncommitted "scrimmage is a flag" (mig 306) refactor made the shared tree's typecheck and 8 unit tests red — none in D11 files; D11's own runs were clean before those edits landed.

## 11. Out of scope

- Live game substitutions and actual-stat scoring; those remain Game day / future stats work.
- Season trends or opponent-result analysis; those remain Insights and the scouting book.
- A decorative baseball field diagram in the first phase; the inning inspector earns priority by solving a decision, not by looking thematic.
- Changing who receives lineup access.

## 12. Print pass — the dugout poster reviewed, and a portrait sheet for the clipboard (2026-09-19 → built 2026-09-20)

**Origin.** The owner printed a lineup (UAT Test Team vs Probe Rovers, 12 batters, 7 innings) and asked two things: what formatting would make the poster read better, and could it come in portrait, since most coaches clip it to a board. Review published as an Artifact (https://claude.ai/artifact/HEpyKsW8SNhi5WZ14S8Vif — source `COACH_LINEUP_POSTER_REVIEW_MOCKUP.html` beside this plan): today's sheet redrawn from its own geometry, the proposed landscape, the new portrait sheet, the Print menu before/after, nine numbered notes, and four decisions. **Owner: "looks good, go for it" — every recommended path taken.**

**The nine notes (all built):**
1. **Jersey number gets its own column** — `#2 Blake Test` sat under a column headed `#` whose value was the batting slot. Now **Order · No. · Player**; the number is its own field on the poster contract (`LineupPosterPlayer.number`), the name carries no prefix. The No. column is omitted when nobody has a number (its width returns to the name).
2. **The team name prints once** — team paper always stamps the team name as its identity line (`applyTeamLook`), and the headline opened with the same words (every team, not just standalone). The crest now sits beside the headline (`drawMatchupBand`); the identity text is drawn only when it is genuinely something else (club paper). Applied to the card too — same helper, same duplication.
3. **"vs" / "@" set at 60% in the accent**, drawn as its own run; a filled **HOME / AWAY** pill on the date line (neutral prints nothing). The never-truncate rule holds: shrink through the ladder, then the team alone on line one and "vs" leading the opponent (≤2 lines) below.
4. **Inning numerals at cell size** — header band 10 mm; numerals take the position size (they were 9.5 pt over 12–14 pt cells).
5. **Striping at ~6% grey** (242) — 3% printed as white on office lasers.
6. **A heavy rule above the first sub + "Subs" in the order column** (9-player mode); the per-row "(sub)" suffix is gone. Subs keep their inning cells.
7. **Portrait** — `orientation` on the poster contract; column widths per orientation (landscape Order 12 / No. 11 / Player 52; portrait 11 / 10 / 48), innings share the rest. Position type is capped by **cell width** as well as row height (a 14 pt "CF" filled a 10 mm cell edge to edge on the rendered twelve-inning portrait sheet).
8. **Words match the paper** — the Print menu and the open-roles preflight said "blank boxes"; the box was removed 2026-08-26. Now "blank cells" (menu, preflight, help article).
9. **The paper speaks the sport's words** — poster heading "Player" (sport-neutral); the card's title and the menu row take the Sport Pack's `orderLabel` ("BATTING ORDER" / "PLAYING ORDER").

**Decisions (owner, 2026-09-19):** **D1** one Dugout poster row with a Landscape · wall / Portrait · clipboard switch (the portal's `segChoice`, radio semantics), remembered per device in local storage (`flhq-coach-poster-orientation`) — not two rows. **D2** first-time default **portrait**; the builder's own default stays landscape so every existing caller prints what it printed. **D3** headings Order · No. · Player. **D4** all nine notes with the portrait sheet as one pass.

**Kept, deliberately:** full identity (crest + team) · rows fill the sheet · no inner pen-box · headline never truncates · the card stays one full page.

**Verification.** Contract suite rewritten for the new shape and the pass (141 tests in `tests/unit/pdf-export-contract.test.ts`; the recording mock now records each run's font size and ignores FILLED rounded rects — the HOME pill is not a pen box). Rendered gate (`npm run check:pdf`): three new fixtures in `scripts/pdf-documents.mjs` — `portrait` (12 batters, notes), `portrait-twelve-innings` (the tight case, long matchup), `nine-player-subs-away` (subs rule, "@", AWAY) — 23 documents / 112 files / 210 pages green. Real sheets rasterized and looked at (landscape, portrait, portrait-12, subs-away, card). `verify:changed` green, 4265 tests. **Committed `08651e9d` 2026-09-20 (private index; the other sessions' hunks in the shared files stayed in the tree). Owner walk owed — QA §208.** No migration.

**Help (`/docs` 2026-09-20).** The Lineups save/print FAQ was rewritten to the screen as it is: the save word in the title row with its three states (Unsaved changes · Saving… · Saved, Couldn't save · Retry), Undo/Redo/Print/Templates in the toolbar beside Setup, Auto-fill and Reshuffle (the bottom bar it described was retired 2026-09-18), the orientation switch and "blank cells", and the order card named for the sport. Search terms added: toolbar, unsaved changes, playing order card, portrait, landscape, clipboard, orientation.

**/review (2026-09-20, high-risk tier, four lenses).** Deterministic gate green throughout; `check:layout --only=coach-lineup-builder` no new findings at 361/390/768/1440 (the sweep renders the page at rest — the Print menu is closed — so the switch itself is the owner's walk). Confirmed and fixed in the same tree:
- **Touch floor (High).** The orientation switch had no 44 mm floor in the touch band while every other `segChoice` does (`.lineupViews`, `.ppDrillTabsWrap`); now `min-height: var(--tap-min)` ≤768 and full-width, `nowrap` ≤640 so neither label can wrap in its pill on a 320–340 px phone.
- **Toggle semantics (Medium).** `role="radiogroup"/"radio"` promised arrow-key movement the buttons never implemented; now `role="group"` + `aria-pressed` — two Tab stops that read their state.
- **Storage key (Advisory).** `coach.lineupPoster.orientation` → `flhq-coach-poster-orientation`, the portal's dashed convention.
- **Hollow tests (High ×2, Medium ×2).** The twelve-inning overrun test never placed a code in inning 12 and filtered code runs out of its right-edge check; the portrait/landscape parity test would pass if notes vanished from BOTH sheets; the HOME pill's fill was never asserted (the fake dropped filled rects on the floor); the No.-column omission never checked the name took the width. All four now bite — the fake records `align` (a centred run's x is its anchor) and `pills`; the twelve-inning test feeds a three-letter legend code so the width cap must fire in the fake's narrow metrics; **both High cases were mutation-proven** (cap loop removed → red; notes block removed → red; restored surgically).
- **Date line (Low).** The date was fitted to the whole width before the HOME/AWAY pill, so a long date could push the mark off silently; the date now gives way first.

**Raised, pre-existing, deliberately NOT fixed here (both Medium, both from the 08-25 "rows fill the sheet" ruling's 6 mm / 9 mm floors, untouched by this pass):** a poster with ≳24 players or a card with ≳22 batters runs past the page bottom rather than shrinking further or spilling to a second page. No lineup in the fixtures or the demo reaches it; a real team of that size on one sheet is a design question (second page vs smaller floor) for its own session — recorded so it is not mistaken for an oversight. Refuted: the 4–5 mm top accent bar sits inside a printer's unreachable edge — decorative, pre-existing, harmless when clipped.
