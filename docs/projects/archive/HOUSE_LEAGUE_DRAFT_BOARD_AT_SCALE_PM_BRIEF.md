# The draft board at real size — PM brief

**What changes.** The house-league Teams & draft screen gets rebuilt for a real division of 100+ players. The players
waiting for a team move into their own column on the left, which stays on screen while you scroll. The teams sit beside
it in their own grid. Each player becomes one short line: rating, name, small marks for family, note and money owed, then
age. The waiting list gets Search, Filter and Sort. The setup steps fold away into one line. After the draft, the waiting
list folds into one line too, and the teams use the whole width. Later, the draft itself learns to keep brothers and
sisters on the same team.

**Why it matters.** The screen was designed and tested with five players. At 120 it became a column about 12,000 px
tall, with seven of the ten teams buried below it. That is unusable on draft day, which is the single most important
hour of a house-league season for the convenor. Families with more than one child, and the notes families wrote at
sign-up, were also invisible while drafting.

**Who sees what.** Convenors and anyone who runs the league get everything. Anyone who can't see ratings (the
registrar, for one) sees no rating column, rating sort or averages, as today. Family notes show only to people who can
already open that player's registration.

**Customer impact.** A convenor can draft a full division on one screen: find any child in seconds, see each team's
balance as they place players, keep families together, and read the notes that matter. Small leagues see the same
screen, just shorter.

**Priority.** High within the house league. It blocks a credible demo or pilot with any real-size league.

**Success criteria.**
- With 120 players and 10 teams, every team can be reached from the waiting list without scrolling it out of view.
- Any player can be found by name in one step.
- Siblings are visible as a family and, after the second build, are drafted together by default.
- The 6-player case looks and works the same, only shorter.
- The owner's QA walk passes on the 120-player dev season and on a small season.

**Status.** Drawn and ruled on 2026-10-26 (all 12 asks, as recommended, plus the steps drawer, which stays closed once
you close it). **Built the same day** in two commits: the board, then keeping families together in the draft (on by
default, with a switch; with the switch off the draft deals exactly as before). One addition while building: after
dealing families, the draft swaps single players between teams to even out the averages, so keeping families together
doesn't cost balance. The owner's QA walk is next: https://claude.ai/artifact/F3P4GoqonbFY9fjh2NPPn3. Plan:
`HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE_PLAN.md`.
