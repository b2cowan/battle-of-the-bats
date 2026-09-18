# Coach Lineups Deep Dive — Implementation Plan

**Status:** Assessment complete; mockup and recommendations ready for owner review (2026-09-18). No production code changed.
**Companion brief:** `COACH_LINEUPS_DEEP_DIVE_PM_BRIEF.md`
**Review hub:** `COACH_LINEUPS_DEEP_DIVE_HUB.html`

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

- Introduce a pure lineup validation/readiness model shared by builder, hub, game day, print preflight, and tests.
- Inputs include assignments, participating players, Sport Pack roles, player preferences/Never states, pitcher profiles, and resolved game rules.
- Emit typed issues with severity, player, inning, role, and proven cause; never compose causal copy from missing information.
- Add regression coverage from the attached production shape: inning 7 has open `P` and `LF`; the message does not claim Never; both blank pitchers remain eligible under their caps.
- Test partial-save states so one filled cell cannot become Ready.

### Phase 1 — Readability and actionable positions grid (P0/P1)

- Paint solid card grounds on positions and playing-time frames.
- Align table heading type, ink, density, borders, and pinned cells with the approved standard.
- Restyle toolbar and cell selects with opaque grounds and stronger borders; replace `-` with `Open`.
- Add inning fill status, exact issue-cell styling, jump/focus actions, and the blank/Bench legend.
- Keep existing responsive behaviour and measure warm/dark themes at desktop, 768, 640, 390, and 361 widths.

### Phase 2 — Workflow and readiness (P1)

- Add setup/build/review hierarchy and active auto-fill mode.
- Replace hub boolean readiness with `Not started / Draft / Ready / Needs review`.
- Add explicit ready metadata (recommended migration) and revert-to-draft on any mutation.
- Update the Overview/game-day readiness consumers and Help copy in the same unit.
- Add print preflight for open roles and hard issues.

### Phase 3 — Coach analysis (P1)

- Upgrade Playing time with Field/Bench figures, labelled attention states, pitching used/cap, and issue-to-inning links.
- Add focus/tap rationale for Auto-fill placements and genuinely unfillable roles.
- Preserve season-level trend analysis in Insights; link there rather than duplicating it.

### Phase 4 — Inning inspector and sport vocabulary (P2)

- Add the inning-first assignment drawer.
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
- Editing a ready lineup visibly returns it to Draft.

## 10. Decisions requested

1. **D1 — Readiness:** approve explicit Draft/Ready state with ready-by/time (recommended), or use derived Not started/Draft/Complete with no migration.
2. **D2 — Draft checks:** approve neutral open-role checks during editing and warnings only for proven violations / ready attempts (recommended).
3. **D3 — Toolbar hierarchy:** approve Auto-fill as the primary action with its mode visible; Setup/Reshuffle/Templates remain secondary (recommended).
4. **D4 — Playing time:** include per-game pitching cap headroom here while season trends remain in Insights (recommended).
5. **D5 — Inning inspector:** accept as Phase 4 follow-on after the truth/readability work (recommended), rather than expanding phase 1.

## 11. Out of scope

- Live game substitutions and actual-stat scoring; those remain Game day / future stats work.
- Season trends or opponent-result analysis; those remain Insights and the scouting book.
- A decorative baseball field diagram in the first phase; the inning inspector earns priority by solving a decision, not by looking thematic.
- Changing who receives lineup access.
