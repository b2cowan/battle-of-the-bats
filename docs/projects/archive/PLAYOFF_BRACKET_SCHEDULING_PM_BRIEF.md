# Playoff Bracket Scheduling PM Brief

## Objective

Make playoff bracket generation feel like a full scheduling assistant, not just a matchup template builder.

## What Changes

Tournament admins can now choose to auto-assign playoff games to dates, times, and facilities while building the bracket. They can also keep the previous workflow and leave scheduling details blank for later.

Admins can also choose whether they are replacing the full bracket or building from the current bracket. Building from current keeps protected playoff games in place and regenerates only unlocked scheduled games.

## Why It Matters

Playoff weekends are where scheduling mistakes are most visible. Finals cannot happen before semifinals, teams need recovery time between rounds, and field changes matter more when games are packed tightly. This upgrade gives organizers the same quality controls they already get from the Round-Robin Generator.

## Customer Impact

- Less manual playoff scheduling cleanup.
- Clearer confidence before committing playoff games.
- Same schedule-health audit after playoff games are saved.
- Temporary facilities still work when real venues are not finalized.
- Less risk of wiping played, submitted, or manually adjusted playoff games.

## Role And Plan Behavior

The Playoff Bracket Builder remains gated by the existing playoff generator feature. Users with access get the new scheduling controls. Users without access continue to see the existing upgrade path.

## Success Criteria

- Admins can create a bracket-only playoff template.
- Admins can auto-assign playoff slots using selected dates/facilities.
- Dependent rounds are scheduled after their source games with configured rest.
- Draft Health appears before commit.
- Saved Playoff Health appears on the Schedule page after commit.
- Existing bracket advancement behavior is preserved.
- Build from current keeps submitted, completed, cancelled, and manually kept playoff games.
- Round-robin regeneration no longer clears saved playoff games.
- API delete-policy tests cover protected playoff deletion and round-robin-only replacement.
- Browser verification is complete.
