# The Schedule deep dive — PM brief

**Plan:** `COACH_SCHEDULE_DEEP_DIVE_PLAN.md` · **Hub:** `https://claude.ai/artifact/5yvmCESNKNWnpFiHg8b7Lc` · **Created:** 2026-09-25

> **Merged into the Club Tier project on 2026-10-09** (the owner's call). The rest of this work now runs as part of Club Tier
> Production Readiness: the desktop schedule is drawn inside a new review of every calendar in the app (Stage 6c), the
> calendar subscription becomes Stage 6d, the form corrections Stage 6e, and the Tournaments pages are drawn with Stage 7.
> None of it holds the Club release. Stage 1 (below) is built; its walk is still owed. See
> `CLUB_TIER_PRODUCTION_READINESS_PM_BRIEF.md`.

## What changes for the coach

The Schedule is the screen a coach opens most, and after this project every event reads the same way at every width. You get what it is, when and where, and then the jobs, each on one row that already tells you where things stand. "Attendance: Out: #12 Logan · Late: #11 Kai". "Lineup: Has a lineup" — or, when attendance and the lineup disagree, "Kai and Logan are in, but not in the lineup". "Scouting: 2-1 vs them".

Tapping Attendance opens the whole roster on one screen, with All in, the filters and a player's answer sheet on top. A practice and a game stop looking like two different screens. The Overview's and Insights' "Take attendance" links go straight to that roster. On a desk, the schedule opens on today instead of April.

Later stages give Tournaments a proper phone pass and a road from a tournament to its games. The coach's calendar export gets fixed, and it may gain a live subscription. The add/edit forms get their last small corrections.

## Why it matters

- **The job sinks as the day goes on.** Before a game, the first player's row is 414px down the phone screen. Once the game starts it's 524px, and on a scored game 696px. On game day, the one player who isn't coming is the twelfth row, about 1,060px down.
- **A practice and a game are two different screens.** A practice shows one inline list; a game hides the same list behind three tabs. That difference is what the owner flagged.
- **A September desktop still opens in April.** On a real season, the next event sits more than two screens down.
- **Two defects in the calendar export.** An evening game at 8 p.m. or later lands on the wrong day in a coach's calendar, and a cancelled game exports as confirmed.

## Customer impact

Every Premium coach on every event, several times a week, and most of all on game day at the field. The tradeoff: marking attendance from the schedule list takes one more tap, because the roster now sits behind a row. In return, the coach reads who's missing without opening anything, and the Overview and Insights links stay at three taps. The calendar defect already affects any team with evening games.

## Priority

This is the owner's next project, named on 2026-09-25. Stage 1 (the event sheet) comes first. The two calendar defects are recommended for a fix now, ahead of the stages.

## Where it stands

**Stage 1 built and committed on dev 2026-09-25** (part 0 `1265bbca` · part 1 `13929db2` · part 2 the sheet) (ruled the same day, every ask as drawn), with the calendar defects fixed first — widened to the Excel and CSV exports, which put evening games on the wrong date too — and the page split into its pieces with nothing on screen changing. Measured on the test team: every event's sheet fits one phone screen, the attendance room shows all 12 players on the first screen at both phone sizes, and nothing a thumb taps is under 44px. Reviewed before commit: the review found and fixed three things — the Attendance row could count late players as out when more than three were named, closing a game from inside the attendance room at a desk left it to reopen on a reload, and a failed load read as "No lineup yet" — and the coach help guide now describes the rows and the room. The owner's QA walk is ledger §242, on the hub's "QA walks" tab. Stages 2–5 are drawn next, one at a time.

## Success criteria

- On a phone, every event's sheet fits on one screen, and every control on it is at least 44px.
- In the attendance room, all 12 players of the test roster show on the first screen, at both phone sizes.
- The coach can see who is out or hasn't replied without opening the roster.
- The Overview and Insights attendance links still reach a saved answer in three taps.
- The desktop and the phone show the same rows on the same event.
- A calendar export puts every event on its real day and marks cancelled events as cancelled.
