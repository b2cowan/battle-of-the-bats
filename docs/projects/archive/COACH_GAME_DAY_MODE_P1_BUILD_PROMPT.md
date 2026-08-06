# Game-Day Mode — Phase 1 Build Prompt ("the bench console")

**Status:** ✅ **EXECUTED 2026-08-04** — mockup gate cleared (rev 2 presented, owner approved
with one vocabulary change → rev 3; the playing-time vocabulary ruling is logged in
`BUSINESS_DECISIONS.md` 2026-08-04 and sweeps app-wide via
`PLAYING_TIME_VOCAB_SWEEP_PLAN.md`). P1 + rider BUILT on dev, uncommitted; owner QA =
`OWNER_QA_LEDGER.md` §1.15. Kept for the build record. Original prompt below.

**Original status:** ✅ **APPROVED TO BUILD** — owner greenlit 2026-08-04 in-conversation ("ok sure,
let's build it"), with one gate left to clear FIRST:

1. **Mockup sign-off.** The mockup artifact exists — "Game-Day Mode — bench console"
   (artifact id `46d0fa8b-f009-47b2-b62c-0b52f54bf6fe`) — but it was produced alongside the
   *proposal* and has not had a dedicated sign-off round. Before touching code: re-open it
   against the plan's §3 UX spec, extend/revise it if the two have drifted (republish the
   SAME artifact for version history), present the sign-off set in-conversation, and get an
   **explicit owner OK**. Mockups are the spec (memory: build-to-approved-mockups). If the
   owner orders execution without changes, that clears the gate — P2/P3 scouting precedent.

**Parent plan:** `COACH_GAME_DAY_MODE_PLAN.md` — read ALL of it first; §1 (the D4
reckoning), §3 (UX spec), §5 (API), §6 (capabilities) bind. PM brief:
`COACH_GAME_DAY_MODE_PM_BRIEF.md`.

---

## Scope: plan §7 P1 (console core) + ONE rider

**P1 — Console core, exactly as the plan specifies:** route + one aggregated read,
header/board/footer, live substitutions onto the existing lineup grid, score sheet with
quiet (debounced, notification-suppressed) writes, attendance sheet, End-game wrap with
server-side result derivation + the single family notification, review mode, entry points
(schedule row + lineups hub + masthead, live-window-gated), mirrored-game read-only score
contract, warm + dark theming via tokens, mobile-first (900/640 system, ≥56px targets).

**The rider — the Opponent Scouting Book handoff** (scouting plan §4.10; deferred from its
P3 because this project didn't exist yet; both plans list it as the integration point):
- **Console header → the book:** tapping the opponent's name opens the Scouting tab content
  as a sheet — reuse `components/coaches/OpponentScoutingPanel` (it is self-contained:
  fetches its own card; takes `orgSlug/teamId/eventId/opponentName/mirrored`). Pass
  `mirrored` from the event so a platform-tournament game shows "Their tournament so far"
  at the bench — the payoff pairing. Absent when the event has no opponent name (TBD slot
  = no dead end, same rule as the schedule drawer).
- **End-game wrap → the capture door:** after the score finalizes, the wrap gains the quiet
  "Add to the book on {opponent}?" link (never a modal), opening the same capture surface
  the score-saved toast opens today. Skipping never re-prompts. Same gating as the book:
  anyone with `schedule` logs observations.

**Explicitly OUT of P1:** moments (P2 — needs a migration), fairness polish (P3), batting
order edits, per-period line scores, wake lock (owner ruled: follow the practice-run ban in
P1, revisit with field feedback — plan §9 Q1).

## Constraints that bind (do not re-litigate)

- **D4 by construction:** no new playing-time table, no shift log, no new event status.
  Subs edit `rep_team_lineup_entries.inning_positions` via the EXISTING lineup PUT.
  Abandonment mid-game must leave data indistinguishable from never opening the console.
- **"Live" is a time window, never a stored state** (sandbox precedent). Entry actions are
  absent outside the window, not disabled; the deep link outside the window renders review
  mode, never a 404.
- **The quiet score flag is server-checked**: honored ONLY for score fields and ONLY within
  the live window — it must not be a general notification bypass. Final notification fires
  exactly once, at End game. (Notification pause switch: score notifications route through
  the `notify()` chokepoint — do not build a second path around it.)
- **Mirrored tournament games:** organizer owns score/result/opponent/time (409 contract —
  existing tests must stay green). Score zone read-only with the "scored by the tournament"
  note; subs + attendance + the book handoff still work.
- **Attendance vocabulary** is the schedule tab's `ATTENDANCE_OPTIONS`/`ATTENDANCE_WORD`
  verbatim — a hard requirement; they must never drift.
- **Live-season INSTRUMENT** (CLAUDE.md archive ruling): the console runs a game, so it is
  live-season-only. Its route joins NEITHER `APPROVED_ARCHIVE_DOORS` nor
  `APPROVED_SEASON_AWARE_ROUTES`; archived seasons never show an entry point. ⚠ Plan §5
  mentions `resolveCoachSeasonRead` for the read — do NOT put the route on the season rail;
  use `resolveLiveCoachTeamContext` (`lib/coach-route-context.ts`) like the scouting
  routes (P3 /simplify lesson: never hand-copy the auth chain), and let the write-guard
  contract stay untouched.
- **Capabilities (plan §6):** console on `attendance` OR `lineups`, zone-by-zone gating;
  score writes on `scheduleManage`; Helper preset = read-only console with the
  practice-run "Your coach runs the bench" sentence. No new capability key.
- **Chrome stays feature-free:** the masthead entry point takes the shape
  `lib/coach-opponent-nudge.ts` established — a feature-side module fed chrome shapes,
  never feature imports inside `lib/coach-masthead*`.
- Sport-neutral everything via the Sport Pack (`periodLabel`, `positions`,
  `pitcherPosition`, `startVerb`, `score.unit`) — no innings hard-codes.
- Practice-run bans carry over: no swipe/drag/long-press, no sound/vibration, no
  auto-advance. Period cursor is client-side (sessionStorage), never persisted.
- **No migration in P1.** If one proves necessary, stop — that's a scope question.
- Icon-only mobile buttons with aria-labels; tokens only (no hex; watch the
  `composes`-non-transitive and `-webkit-backdrop-filter`-first gotchas).

## Verification bar (match the scouting phases)

- Unit: swap-from-period-N grid math (pure, table-driven); quiet-flag guard (rejected
  outside window / non-score fields / mirrored games); server result derivation
  (win/loss/tie/null); entry-window predicate boundaries; review-mode selection.
- Existing mirrored-game 409 tests and the coach-season-write-guard contract stay green
  WITHOUT list edits.
- `npm run typecheck`, full `npm test`, `npm run verify:changed` all green. Rendered
  `check:layout` if a dev server is up — this is a new SCREEN, so if it can't run, say so
  in the handoff and flag it for owner QA.
- Post-build: offer `/simplify` then `/review` (high-risk: lineup-grid writes + the
  notification-suppression flag are the two surfaces that can hurt real families/records),
  then `/docs` (coaches guide gains a game-day section; the "one notification at End game"
  promise and the helper's read-only view belong in it).
- New OWNER_QA_LEDGER section (next free §1.x) with a phone-first QA script (≤640 bench
  swap, abandonment mid-game, no family notification until End game, mirrored game
  read-only score, helper read-only view, archived season shows no entry point, the two
  scouting-handoff doors).
- ⚠ **Shared working copy:** other projects' uncommitted hunks live in shared files
  (A1 roster-baseline especially). Commit only with explicit per-action owner OK, explicit
  pathspecs, and hunk-level splitting where a shared file mixes projects — see the
  `d87fb31b` commit message for the precedent. Bracketed dirs need `:(literal)` pathspecs.
- Dev-server restart rule applies before owner browser QA (new files + shared modules).
