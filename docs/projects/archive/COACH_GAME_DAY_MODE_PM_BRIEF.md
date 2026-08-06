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
- Timestamped "moments" (Maya's first triple) shipped in **phase 2** — see below.

## Phase 2 — moments (built 2026-08-05, awaiting owner QA)

**What a coach does differently.** During a game, the console footer offers **Note**. One tap,
one line, an optional player tag, save — and the sheet stays open saying "Saved — add another?"
so a second thought costs nothing. At **End game** those lines read back above the confirm
button. Afterwards they appear on the tagged player's page, next to the family recap preview,
and one of them — the most recent — appears as a quoted line on the team's Season Wrapped card.

**Why it matters.** The thing coaches say they lose is not data, it's the small stuff: the
first triple, the kid who finally called for the ball. This is the cheapest possible way to
keep it, and it survives into the two moments that matter — the season-end conversation with a
family, and the card the team shares at the wrap-up.

**What it deliberately does NOT do.**
- It changes **no number anywhere**. Not playing time, not attendance, not the record. A coach
  who logs twenty moments and one who logs none get identical reports. A half-used log has to
  poison nothing, and that is now asserted by test rather than promised in a doc.
- It **notifies nobody, ever**. Families still hear exactly once per game: the final score.
- **Families never see a moment.** These are the coach's and their staff's.
- Moments **can't be edited** — a typo is removed and retyped — so "what you wrote at 7:32" is
  always what was written at 7:32.
- A game with no moments looks exactly like the phase-1 screen. No empty state, no nudge.

**Access.** Anyone who runs the bench (attendance, lineups, or schedule-management duties) can
log one. A schedule-only helper cannot — their console is read-only and shows no footer.

**Past seasons.** A finished season's Wrapped card shows the moments logged during it,
read-only; there is no way to add or remove one once a season closes.

## Phase 3 — playing-time polish (PROPOSED 2026-08-05 — plan + mockups only, no code)

Full plan: `COACH_GAME_DAY_MODE_P3_PLAN.md` · mockups rev 5, frames 19–23.

**The honest framing.** Phase 3 is the first phase that is genuinely optional — the console
already works, and every candidate is polish. So the plan argues what *not* to build, and cuts
half of what was originally listed.

**What a coach would see differently — three small things.**
1. **The bench list puts the longest-sitting player on top**, which is what the signed-off
   drawing said and what didn't get built. The order settles at the start of each period and
   then holds still — a list that re-shuffles under a coach's thumb mid-inning is how the wrong
   child gets subbed in.
2. **The pitching-cap chip finally works for most teams.** Today it only appears for players
   who have a personal arm-care cap. A team that set one season-wide cap instead — the common
   case — sees nothing at all, on the exact screen where the coach is choosing the next
   pitcher. This is the item with a real safety argument, and the reason the phase is worth
   doing at all. If no cap is set anywhere, the screen still says nothing; the product never
   invents a ceiling it wasn't given.
3. **The screen can stay awake during the game** (owner decision pending) — visible as a chip
   the coach can switch off in one tap, only while the game is live, only for the coach who is
   actually running the bench.

**What is being cut, deliberately.**
- **Tonight's playing time compared to season averages.** It duplicates the season report,
  which is already one tap away; it needs the whole season loaded onto a live-game screen; and
  a one-game difference is close to meaningless in a sport where the coach rotates on purpose.
  It is also the item most at risk of turning measurement into a verdict about a child, which
  the vocabulary ruling forbids. Drawn anyway (frame 23) so the call is visible and reversible.
- **A per-inning score breakdown.** Deferred a third time: it needs new storage, and a
  half-filled line score is exactly the kind of unfinished record this whole feature was
  designed to avoid.

**Cost and risk.** No new data stored, no new screen, no migration, no change to what families
receive. Small enough to drop item-by-item if priorities shift.

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
