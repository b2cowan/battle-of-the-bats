# Game-Day Mode — PM Brief

**Status:** Proposed · **Plan:** `COACH_GAME_DAY_MODE_PLAN.md` · **Date:** 2026-08-03

## What it is

A phone screen a head coach opens at the field on game night. It shows tonight's matchup and
score, who's on the field and who's on the bench *right now*, and lets the coach do the three
things they actually do at a bench: swap players in and out, keep the score, and fix attendance
("Ava's not here"). When the game ends, one tap confirms the final score and tells families —
and the playing-time and fairness reports update themselves.

Practices already have a "run it live" screen; games — the main event — don't. This closes that
gap.

## What a coach sees and does differently

- On game day, the schedule (and the team masthead) grows a **Game day** button for that game.
  It appears around arrival time and disappears a few hours after — no setup, no "start game"
  ceremony.
- The screen has three parts: the matchup header with the score and "Inning 3 of 7" (in the
  sport's own words), a big-tap roster board split **On field / Bench**, and a footer with
  *Who's here*, and *End game*.
- Tap a bench kid, tap the kid they're replacing — done. The change is saved instantly to the
  same lineup the coach built before the game, so the "Is playing time fair?" report and each
  player's season recap reflect what *actually* happened, not just the pre-game plan.
- The board quietly warns about the things the fairness report would flag later: a kid on their
  second straight bench sits at the top of the bench list; a pitcher nearing their limit gets a
  flag before the swap, not after the game.
- Scorekeeping is two big +1 buttons. Families are *not* pinged on every run — they get exactly
  one notification, the final score, when the coach taps **End game**.
- For a tournament game run by an organizer, the score area politely steps back ("Scored by the
  tournament") — everything else still works.
- Afterwards the same screen becomes a read-only recap: tonight's playing time per player, what
  changed, links onward to the reports.

## Why it matters

- It's a weekly-use, felt-every-game feature — the strongest kind of premium retention.
- It makes the analytics we already sell dramatically more trustworthy: today a coach who never
  updates the lineup after the game produces the same "fairness" numbers as one who does.
- It's honest about coach reality: if the coach gets busy and stops tapping in the 4th, nothing
  breaks and no data lies — the plan simply stands in for the rest, exactly like today.

## Role differences

Head coaches get everything. Assistants get exactly what their existing permissions say
(attendance-only helpers see score + attendance; lineup-capable assistants can run subs). A
schedule-only Helper sees a read-only view with "Your coach runs the bench." Archived seasons
never show a Game day button — this is a live-season instrument.

## Tradeoffs made

- **No new "live tracking" data anywhere** — the console edits the existing lineup and score.
  This was deliberate: a second, half-finished record of a game is worse than none (the same
  ruling that shaped the practice screen). Abandoning the console mid-game is harmless.
- Batting-order changes and per-inning score breakdowns are out of v1 (rare mid-game, and the
  full builder is one tap away).
- Timestamped "moments" (Maya's first triple → season recap material) are phase 2.

## Success criteria

- Coaches who use the console produce visibly different (more accurate) playing-time data than
  their pre-game plan — measurable as post-start lineup edits on game events.
- No increase in family notification volume per game (exactly one final-score notice).
- Console usable one-handed on a phone in bright light; every control ≥ thumb-size.

## How to test (owner QA)

On a phone, from the schedule, open a game inside its game-day window: make two substitutions,
score a few runs for each side, mark one player absent, end the game. Then check: the lineup
grid shows the subs, the playing-time report moved, families got exactly one notification, and
re-opening the link shows the read-only recap. Try the same on a tournament-mirrored game and
confirm the score area is read-only.
