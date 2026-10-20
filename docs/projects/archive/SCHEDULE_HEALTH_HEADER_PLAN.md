# Schedule health in the header — plan (✅ CLOSED 2026-10-19)

All three stages built, owner-QA'd and committed 2026-10-19; house league moved to Club Tier Stage 9 as an option (below).

Owner rulings 2026-10-19 (this session): A1–A7 of the drawing, all as recommended. Drawing: `docs/projects/archive/SCHEDULE_HEALTH_HEAD_DRAWINGS.html`
(Artifact https://claude.ai/artifact/RV78mLkeKtosAgVBWjYZEp, v3 records the rulings). PM brief: `SCHEDULE_HEALTH_HEADER_PM_BRIEF.md`.

## Why

The tournament schedule's health was a full-width row at the foot of the day or the bracket. When the schedule was fine it
spent a row saying so, and when it wasn't, the warning sat under every game. Separately, the dashboard worked out its own
score and left playoff games out, so a playoffs-only tournament read "No timed schedule generated yet" on the board beside a
scored bracket on the Schedule.

## Stages

| Stage | What | State |
|---|---|---|
| 1 · One number (A7) | One event-health call for the Schedule and the dashboard: every game, pool and playoff; each division's timing; the bracket wiring and scores; the saved rules. "No timed schedule" is decided by games with a day and a time on both. A build check fails if either screen scores the event another way. | Committed `a610548d` 2026-10-19 |
| 2 · The Schedule's header button (A1–A3, A6) | The foot row becomes the header's first action: the score in its tone, "Schedule health", the issue count in the amber pill; on a phone a pulse icon with the count as its badge. It opens the wide (800) form window, so the team table fits without scrolling sideways (owner 2026-10-19, after the first look): the score with its scale and the caption, then the panel's body, its rules door at the end ("The score uses this tournament's rules." · Adjust the rules), the rules opening under it with the hint now saying "above". A tap outside does nothing; unsaved rules ask in the foot. Never arrives open, the demo included. Hidden while a bracket is edited. The layout sweep opens the window by the tour anchor and measures it alone. | Committed `59c1cf58` 2026-10-19; owner browser QA passed 2026-10-19; /review (2 lenses) 6 fixed, 3 dropped; help updated (`faq-schedule-health` new) |
| 3 · The dashboard opens the same window (A5) | The game-day board's health row and the before-the-event Schedule card open the same window instead of opening in place / jumping to the Schedule. The board only receives a summary, so the window must load the schedule's games when it opens (the Schedule page's own loader) and compute with the one call. Owner 2026-10-19: "it is supposed to open the same modal in the middle of the screen" — taken as Q2 answered as recommended: the rules editor stays (one shared rules hook for both), and "Show them" opens the Schedule with that clash filter on (`?show=`). The board's own panel copy and its styles are deleted; the before-the-event card opens the window once games are timed (with none, it still links to the Schedule to build one). | Committed `ac8c4b82` 2026-10-19, owner QA passed ("looks good"); /review 2 lenses, 7 fixed, 1 dropped — incl. the rules editor now shown only to owners/admins (create_tournaments) on BOTH places, and the demo refusal in words |
| 4 · House league (A4) | **Premise was wrong** — see Q1. | **Moved out 2026-10-19 (owner):** a house league health score is an OPTION for Club Tier Stage 9's drawing session (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` Stage 9), not part of this project |

## Open questions for the owner

- **Q1 · A4 rested on a false fact.** The drawing said the house league schedule wears the same health row. It does not: it
  shows only a clash warning box from its own check, with no score. "House league follows" would mean building it a health
  score. Recommendation: drop A4 from this project; a house league score is its own decision. **Resolved 2026-10-19 (owner):**
  "put the house league health score option as part of the house stage of the club readiness project" — Club Tier Stage 9.
- **Q2 · The dashboard's window, rules and "Show them".** Recommendation: the identical window, including the rules editor;
  "Show them" opens the Schedule filtered to those games (today it filters the page it is on, and the dashboard has no
  schedule on it).

## Follow-ups this leaves

- The demo tour's step 4 words ("The health score reacts as you drop it") still hold; the window's demo line now says to close
  it first. The next `/demos` pass may want to re-word the step to name the header button.
- `check:demos:prod` computes health its own way (a third copy). It already counts playoff games, so it agrees today; it is a
  production monitor, so it is reported here rather than changed.
- The layout baseline's `admin-t-schedule-health` entries measured the row; they refresh at the next staging sweep.
- Help: done in `59c1cf58` (a new Schedule health answer; the Current/Projected answer points at the window). Stage 3 will need the dashboard sentence revisited.
