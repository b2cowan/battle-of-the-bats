# Playoff Schedule Health — "What Could Happen" Metrics

Owner-flagged 2026-07-09 from the Schedule Health dashboard debug session (Playoffs showed 15
"teams" vs Round Robin's 12; a follow-up interim fix over-corrected to 0/"No teams" once
placeholder-only bracket slots were excluded).

## Problem

The Schedule Health "Teams" KPI on the Playoffs tab is derived from whichever participants
literally appear in already-created game rows. Before a bracket's results are known, most of its
games reference an abstract slot ("Seed #6", "Winner R1-3") rather than a resolved `team_id`, so
the KPI either double-counts those slots as extra phantom teams, or (after excluding them) shows
zero — neither matches what an organizer actually wants to see: how many teams are IN the
bracket, and whether their day-of-day load/rest is healthy given the games/venues/times that are
ALREADY fixed regardless of who wins.

## Direction (owner-approved 2026-07-09)

1. **Teams KPI = seeds included in the bracket.** Read the division's saved playoff config
   (`teamsQualifying`, or the highest `toSeed` across tiers for a tiered bracket) instead of
   counting whatever has resolved in the game rows so far. Always correct, known the moment the
   bracket is built.
2. **Resolve `Seed #N` slots to the real team.** Organizers assign a seed number to a team
   up front (Teams admin, `teams.seed`); a bracket built in `reseed` or `tiers` mode literally
   labels each entry slot "Seed #N". That team's identity is known today, independent of any
   game result — so schedule-metrics should treat that slot as the real team for rest/back-to-
   back/max-per-day purposes, the same way Round Robin already does. (Bracket display text is
   untouched — this only changes the internal health calculation.)
3. **`Winner <code>`/`Loser <code>` slots (deeper rounds) stay unresolved for now.** Which real
   team lands there depends on an actual game result. A later phase can forward-simulate "if this
   seed keeps winning" using the existing Winner/Loser feed graph (`lib/playoff-bracket.ts`) to
   project a potential day/venue/rest schedule per seed — scoped to clean single-elimination
   graphs (no double-elim/consolation ambiguity, where a seed could land in either bracket).

## Phases

- **Phase 1 (this session):** Teams KPI now reads, in order: the highest seed covered by the
  division's tiered brackets, else the saved `teamsQualifying` cap, else (most tournaments —
  no explicit cap was ever set) the division's accepted-team count. Always shows a real number
  instead of 0/15. `Seed #N` slots also resolve to the real team via `teams.seed` when the
  organizer manually assigned seed numbers in the Teams admin — no display or bracket-building
  change.
- **Correction found while verifying Phase 1 live (2026-07-09):** the Milton U11 bracket that
  surfaced this bug seeds teams from **round-robin standings**, not a manually assigned
  `teams.seed` (every team's `seed` was `null`, and this division's `playoff_config` never set
  `teamsQualifying` either — hence the accepted-team-count fallback above). The `teams.seed`
  resolution only helps the manually-seeded case; it's a no-op here. The Teams KPI itself is
  fixed either way (via the fallback), but per-team back-to-back/rest/max-day still can't attach
  to a real team on this bracket, because there's no cheap live signal for "which real team is
  standings-seed #6" without running the standings/tie-breaker calculation.
- **Phase 2 (scoped 2026-07-09) — two sub-phases:**

  **2A — Standings-based seed resolution — BUILT 2026-07-09 (uncommitted, no migration).**
  `lib/tie-breakers.ts` already exports
  `computeTournamentStandings(divisionId, teams, games, playoffConfig?, tournamentSettings?)` —
  the same pure ranking math (W/L/T, run-diff cap, tie-breaker chain, coin-toss) that drives the
  public Standings page — and it needs only plain data `schedule-metrics.ts` can already be
  handed (teams/games/division/tournament settings), no new async/RPC dependency. `getParticipant`
  gets a second resolution path: when a `Seed #N` placeholder doesn't match a manually-assigned
  `teams.seed`, compute standings from the division's round-robin games and map seed N to
  `rows[N-1].teamId`. Requires widening `ScheduleMetricTeam` (add `status`/`poolId`) and
  `ScheduleMetricGame` (add `homeScore`/`awayScore`) to carry what the standings engine needs.
  **Owner decision (2026-07-09): resolve against the LIVE/current standings as soon as a ranking
  exists — not only once round-robin play is mathematically final — and visibly mark it as
  "current" rather than locked in**, mirroring how the public Standings page already labels
  a not-yet-final table (`standingsFinal`/`standingsPending`/`gamesStarted` in
  `components/public/StandingsContent.tsx` — reuse that established pattern, don't invent a new
  one). A team's attributed seed can still shift as more round-robin games are played; the "current"
  label is what keeps that honest.
  **Implementation notes:** `computeTournamentStandings`'s parameter types were widened from the
  full `Team[]`/`Game[]` domain types to two new minimal exported interfaces
  (`StandingsTeamInput`/`StandingsGameInput`) — a backward-compatible change (every existing
  caller still satisfies the looser shape) that lets `schedule-metrics.ts` call it without
  constructing full domain objects. `buildScheduleMetrics` takes a new optional
  `standingsGames` option (the tournament's full, unfiltered game list — needed because the
  games actually scoped to a Playoffs-tab call are pre-filtered to playoff-only and can't compute
  round-robin standings on their own); the Schedule page now passes its raw `games` state through
  for this. Each `TeamScheduleMetrics` row carries a `seedBasis` (`'manualSeed'` |
  `'currentStandings'`), and the team-detail table shows a small "Current" tag (with an
  explanatory tooltip) next to any team resolved via live standings. Smoke-tested against the
  live Milton U11 bracket (dev): Teams KPI reads 12, and 11 of 12 seeds resolved to their real
  team with a visible "Current" tag (the 12th seed doesn't yet have a created game row to attach
  to — a pre-existing bracket-build gap, not a resolution bug).

  **2B — "If this seed keeps winning" forward simulation.** Once a seed resolves to a real team
  (via 2A or the existing manual-seed path), walk the bracket's Winner-feed graph forward from
  that seed's current game to project their full potential schedule (dates/venues/times are
  already fixed regardless of the opponent) and feed that into the same rest/back-to-back/max-day
  math used everywhere else. The graph-walking pieces already exist inside
  `computeBracketColumns` in `lib/playoff-bracket.ts` (`ADVANCEMENT_REF_RE`, the local `byCode`/
  `deps`/`feedsInto` maps) but aren't exported — extract a small helper (e.g.
  `nextBracketCodeViaWinner(games, fromCode)`) rather than re-deriving the regex/graph logic.
  Scoped to standard single-elimination brackets only (reuse the existing section-code detection
  that already flips `computeBracketColumns` into multi-section mode); double-elimination,
  consolation, and non-reseed 2-pool-crossover brackets keep today's Phase 1 behavior unchanged —
  a seed could legitimately land in either the winner or loser bracket, and guessing which would
  be worse than not projecting at all.
  **Owner decision (2026-07-09): visually label every projected (not-yet-actually-scheduled)
  round distinctly from confirmed rounds**, so a rest/back-to-back warning on a hypothetical
  matchup is never mistaken for an already-locked-in conflict.

  **2B — BUILT 2026-07-09 (uncommitted, no migration).** First built with team-identity as a
  gate (project forward only after a seed resolves to a real team), then **redesigned same-day
  after owner review found two real problems with that**, tested live at `localhost:3000`
  against the real Milton U11 bracket:
  1. A live screenshot showed EVERY seed already resolved to a real team name (tagged
     "Current") despite zero round-robin games having been played — `computeTournamentStandings`
     only flags `needsCoinToss` once a tie is genuinely "settled" (every relevant game played and
     STILL tied), so a plain "nothing played yet" 0-0-0 tie doesn't trip that guard; the
     tie-breaker chain's fallback order was being read as a legitimate "current" ranking when it
     was actually arbitrary. **Fixed:** standings-based resolution now additionally requires at
     least one decided (completed/forfeit) round-robin result in the division before trusting it
     at all — before that, the seed shows as `Seed #N` instead of a specific (wrong) team name.
  2. Owner pointed out the deeper issue: a bracket slot's rest/back-to-back/day-load exposure
     doesn't depend on WHO occupies it, only on WHICH SLOT they're in — "Seed #1 would have the
     same metrics whether it's Seed #1 or a named team; you can still find out 'max games played
     in a day if they keep winning' from the schedule alone." Gating projection on name
     resolution meant an organizer couldn't see a hypothetical conflict until pool play had
     progressed far enough to know who a seed actually was — even though the bracket's
     venues/times were fixed the moment it was built.

  **Redesigned architecture:** for a standard single-elimination bracket, `buildScheduleMetrics`
  now walks the Winner-feed graph forward from EVERY seed's own first-round entry (found by
  matching the permanent `Seed #N` placeholder text, which `advancePlayoffs` never clears even
  after a game is decided) — not just from seeds that already resolved to a team. Each seed gets
  its own row labeled by the real team name the instant one resolves (manual seed or
  now-guarded standings match), or literally `Seed #N` until then. The walk stops the moment a
  round is actually decided in that seed's favor (rounds so far marked confirmed, continuing) or
  against them (seed eliminated — no further rounds, walk stops); everything from the first
  not-yet-decided round onward is marked projected. `lib/playoff-bracket.ts`'s
  `nextBracketCodeViaWinner(games, fromCode)` now returns `{code, side}` (not just the code) so
  the walk can track which side of each downstream game the seed lands on without ever needing a
  team id; `isStandardSingleEliminationBracket(games)` (reusing `computeBracketColumns`'s
  `SECTION_CODE_RE` signal) still gates eligibility, grouped per `bracketId` so a tiered
  division's non-single-elim tier is skipped without blocking its single-elim siblings — anything
  a seed-walk doesn't claim (double-elim/consolation/placement brackets, or games without a
  `Seed #N` entry) falls through unchanged to the ordinary Phase 1/2A per-game resolution.
  `TeamScheduleMetrics.projectedGameCount` surfaces how many of a row's games are hypothetical;
  the Team Detail table shows an amber "Projected" tag (twin of the blue "Current" tag) with a
  tooltip when it's non-zero. **Known, accepted scope limit:** the `expectedGamesPerParticipant`
  "at target" ratio is not specially adjusted for projected games (narrow edge case, noted here
  rather than silently handled). Verified: 21 unit tests total across both files (winner-feed
  step + side, single-elim detection, and 6 `buildScheduleMetrics` projection cases — anonymous
  seed projection, manual-seed name resolution, the pre-round-robin standings guard, structural
  elimination stopping the walk with no team identity involved, double-elim exclusion, and the
  already-decided-downstream dedup) plus two live-data-structure smoke tests against the real
  mirrored Milton U11 bracket — the second explicitly mixing resolved and still-anonymous seeds
  in the same bracket, confirming an anonymous "Seed #2" row projects identically to a resolved
  "Milton Mavericks" row in the same slot, and that an eliminated seed's projection correctly
  stops while the actual winner's continues.

- **`/review` pass #2 (2026-07-09, high-risk tier, 4-lens — covering Phase 2A + the Phase 2B
  redesign):** found and fixed one real regression: the Playoffs-only "hide an unresolved
  bracket slot" filter (added in Phase 1) had no scope check, so it also ran for the schedule
  Generator's slot-mode round-robin preview — an unrelated feature whose only participant
  identity IS that same kind of slot key. That preview's team-detail table and every aggregate
  stat (health score, back-to-back, max/day) would have silently read as empty/perfect. Fixed by
  scoping the exclusion to the Playoffs view only; regression test added. Two lower-severity,
  pre-existing items also surfaced (not fixed, not blocking): manual bracket editing has no guard
  against rewriting a completed game's bracket code/placeholder text, which the new projection
  now leans on being permanent (display-only impact if ever exercised — a future hardening
  candidate); and a small matching inconsistency (exact vs. case-insensitive) between real
  advancement and the new projection's wiring lookup.

- **`/review` pass #1 (2026-07-09, high-risk tier — shared `lib/schedule-metrics.ts`):** 3-lens
  finder + main-loop triage caught 4 real issues in the Phase 1 diff, all fixed:
  a `divisionSeedCount` of exactly `0` (genuinely empty division) was being read as falsy and
  silently falling back to the old count instead of showing 0; the schedule Generator's
  "Build from current" preview was picking up the new seed-count override even though it's
  scoring a round-robin draft, showing a self-contradicting Teams number vs. the team-detail
  table below it (fixed by gating the override on the scoped games actually all being playoff
  games, not the raw `includePlayoffs` flag); two teams accidentally sharing one seed number
  used to silently misattribute one team's stats to the other (now left unresolved instead);
  and the "X of Y at target" ratio's denominator now matches its numerator (both count
  currently-resolvable teams) instead of mixing in the full seed count. One dormant landmine
  also closed (the dashboard's separate data-mapping path was dropping the seed field, inert
  today but would've silently broken if the dashboard ever showed playoff-scoped health).
  One item was reviewed and accepted as a known Phase 1 limitation, not a bug: a bracket game
  where *both* sides are still fully undetermined (e.g. a Final before the Semis are decided)
  won't count toward day-load/rest math yet — there's no real team to attach it to until Phase 2.

## Notes

- No schema change (Phase 1 rides existing `teams.seed` + `divisions.playoff_config`).
- Round Robin metrics are unaffected — this only touches the playoffs branch of
  `buildScheduleMetrics`.
