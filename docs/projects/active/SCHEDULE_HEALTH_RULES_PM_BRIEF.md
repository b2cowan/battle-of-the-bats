# Schedule Health Rules — PM Brief

**One-liner:** Let organizers define what a "healthy" schedule means for *their* event, edited right on the Schedule Health panel, with the score and warnings updating live.

## Proposed functionality
A gear/"Adjust rules" control on the Schedule Health panel opens a compact inline editor with three thresholds:
- **Max games per day** (default 2)
- **Minimum rest between a team's games** (default 15 min)
- **Target games per team** (default: none)

Dragging the values re-rates the health score, the MAX/DAY colour, and the "Heavy same-day loads" / "Back-to-back" / target warnings in real time. **Save** persists the rules for that tournament; **Restore defaults** resets. The saved "max games/day" also becomes the default the auto-schedule Generator builds toward, so generating and grading share one definition of healthy.

## Why it matters
Today the panel grades against fixed, invisible numbers (more than 2 games/day, under 15 min rest). A one-day blitz and a 3-day league event have very different norms, so a single hardcoded definition mislabels good schedules as unhealthy and vice-versa. Tuning lives one click from the result, so organizers learn the trade-offs by watching the score move.

## Customer impact
- Organizers (admins/staff) get an accurate, trusted health score tailored to their event — fewer false "heavy load" flags, more confidence in the number.
- No change for coaches, parents, or the public; Schedule Health is admin-only.

## Priority
Medium. Small, self-contained, no migration. Direct response to an owner request.

## Success criteria
- Changing a rule on the panel updates the score/warnings live; Save persists across reloads.
- "Heavy same-day loads" and the MAX/DAY colour honor the org's chosen max (not a hardcoded 2) on both the Schedule panel and the dashboard summary.
- Auto-Generator defaults its max-games/day to the saved rule.
- Defaults reproduce today's behavior exactly for tournaments that never touch the editor.

## Scope notes
- v1 is tournament-level. Per-division overrides and an "ideal start window" lever are fast-follows.
- Scores become relative to each org's rules (not comparable across orgs) — intended.
