# PM Brief — Lineup Intelligence (Coaches Portal)

**One-liner:** Give the auto-fill lineup builder enough understanding of each player — where they play, where they never play, how good a pitcher they are, and whether they're a "big-game" player — to generate lineups a coach would actually run, and let the coach steer competitive vs. balanced games with a couple of simple dials.

## Why it matters
Today the builder only knows each player's Primary and Secondary position, then spreads bench time evenly. Coaches can't tell it "she never pitches," "he's our ace," "cap pitchers at 2 innings," or "in the gold-medal game, play my best 9." So they hand-fix the grid every game. This is the #1 thing standing between "cute auto-fill" and "the tool I trust to set my lineup."

## What the coach can do differently
- **Rate every position** for a player as **Best / Okay / Never** — and rank the "Best" ones. "Never" is a hard block the builder will always honor.
- **Build a pitching depth chart** — mark pitchers, rank them (ace / #2 / #3), and set an arm-care innings cap per pitcher.
- **Set team rules once, override per game** — a max-innings-at-one-position rule (forces rotation so more kids get chances), a pitching innings cap, and a minimum-innings-per-player floor, all set as season defaults. When a specific game (e.g. a tournament) runs different rules, override any of them right in the lineup builder — it defaults to "season default" and sticks with that game.
- **Flag an A-squad** — the players who start and take the key positions in competitive games.
- **Pick a game mode when building the lineup** (pre-chosen from the game type): **Competitive**, **Balanced**, or **Development**. In Competitive, two extra dials: whether the A-squad is *prioritized* (best barely sit) or plays with *balanced sits*, and a *no-back-to-back-sits* switch so the bottom of the roster still rotates instead of one kid sitting all game.
- **Manage it two ways:** on each player's page, or on a new **team depth-chart board** that shows the whole roster against every position at a glance.

## Customer impact
- Auto-fill output goes from "a starting point" to "usually right" — less hand-editing, more trust.
- Directly serves competitive travel/rep coaches (gold-medal games) *and* development-focused house coaches (fair rotation) with the same feature.
- Arm-care and rotation caps help coaches stay inside league rules automatically.

## Priority & effort
- **Priority:** High — deepens the flagship Premium Coaches Portal lineup tool.
- **Effort:** Medium-large; delivered in phases (positions → pitching → caps → A-squad/competitive modes → team board → polish). Each early phase already improves lineups on its own.

## Success criteria
- Coaches set positions, never-play, pitcher rank/caps, and A-squad from either surface.
- The builder never plays a "Never" position or breaks a cap.
- The three modes (and the competitive dials) produce clearly different, sensible lineups.
- Existing rosters keep working with zero coach action.

## Tradeoffs / open points
- Position-rotation cap assumed **per-season** (an age-group/league rule), pitching cap **per-player** (with a season default). Confirm if either should differ.
- Per-game cap overrides ARE in V1 (defaults come from season settings, overridable per game). Multi-game / pitch-count arm tracking is **out of scope for V1** (innings-based, single-game).
- A design pass against the real code (2026-07-01) surfaced and resolved four build risks before any code — the biggest: existing rosters and every screen that shows a player's position keep working untouched (we add richness alongside the current Primary/Secondary rather than replacing them), so nothing drifts.
