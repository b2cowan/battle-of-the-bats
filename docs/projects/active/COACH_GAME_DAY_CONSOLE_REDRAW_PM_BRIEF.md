# PM brief — The bench console, re-drawn

**Status:** Built on dev 2026-09-22, walk owed · **Plan:** `COACH_GAME_DAY_CONSOLE_REDRAW_PLAN.md`
**Hub:** https://claude.ai/artifact/48VgBmd2bGwJRY6Y8erSBZ
**Ships with:** nothing to migrate, nothing for families, no new screens.

---

## What this is

The game-day console is the one screen in this product a coach holds at a fence, one-handed, in
daylight, with a game going on. It shipped in August and was never re-read at phone width. Looking
at it properly found two things that were not design preferences — they were broken.

## The two things that were broken

**You could not press the buttons.** *Who's here*, *Note*, *Full grid* and **End game** were drawn
underneath the phone's bottom navigation bar. They only became tappable if you scrolled to the very
bottom of the page. A coach trying to end a game would have pressed a dead strip of screen.

**You could not tap a player who was on the field.** Tapping a player's name did nothing unless you
had already picked someone off the bench first. If you wanted to move a player from second base to
shortstop — both already on the field — there was no way to do it except a sideways-scrolling table
of tiny dropdowns.

Both are fixed.

## What a coach sees change

- **Tap the position beside any name to change it.** On the field or on the bench, a small sheet
  opens with every position, grouped the way that player's depth chart sees them. It is the *same*
  sheet the lineup builder opens, so the two screens now work identically.
- **Sending someone in is one tap** — tap the dash beside a bench player and pick where they go.
  The old "pick from the bench, then tap who they replace" swap still works for a straight swap.
- **The buttons work.** *Who's here*, *Note*, **Scouting** and *End game* sit above the navigation
  bar from the moment the screen opens.
- **Scouting has a door you can see.** Your book on the opponent used to be reachable only if you
  happened to know the opponent's name was tappable. It is now a button in the bar. The name still
  works too.
- **Scorekeeping is out of the way.** The big running score is gone; a quiet *Update score* row
  under the board opens the same score sheet. **Nothing about the record changes** — the final score
  is still entered when you end the game, that is still the one notification families get, and
  End game has its own score boxes, so you can skip the running score entirely.
- **A third of the wasted space came back.** The strip along the top is gone, the kit and arrival
  time fit one line, and only the inning follows you down the page instead of the whole header card.
- **The inning bar is the builder's.** Arrows, the inning, and a row of dots showing which innings
  are set and which still have a hole in them.
- **"Saved" stops living at the top.** It is the pill every other coach screen uses: it appears when
  something is saving, says *Saved*, and fades. Only a failure stays put.
- **The screen just stays on.** No chip, no switch. Your power button still works.
- **The back arrow** lost its word on a phone and still goes where it always went — this game's
  entry on the schedule.

## What went away

The **Full grid** sheet — the sideways-scrolling table. Fixing the fifth inning while you stand in
the second is the inning arrows now, which is what the lineup builder already does. The door to the
full builder (batting order, modes, caps) is still there, under the board.

## Who is affected

Head coaches and assistants who run the bench. A helper with schedule-only access sees the same
board read-only, with no write controls — unchanged, except that their buttons are reachable too.
Nothing touches a tournament-scored game, the read-only recap after the game, or anything a family
sees.

## Why it matters

This is the screen with the least forgiving conditions in the product — one hand, sunlight, a game
in progress, gloves. It was the only coach screen whose main actions could not be pressed and whose
players could not be tapped. Everything else here is second to that.

## Tradeoffs made

- **The board kept its shape.** The owner asked for "the lineup editor's experience". It got the
  editor's *editing* — same tap, same sheet — but kept *On the field / Bench*, because "who is out
  there right now" is the question this screen exists to answer and the builder's batting-order list
  cannot answer it without reading every row.
- **The bar still has four buttons**, so the labels stay at today's tighter size rather than growing
  back. That is the cost of making scouting findable, and it was judged worth it.
- **A standing rule was retired.** Until now, a screen that refused to sleep had to say so. It no
  longer does, because the power button sleeps the handset whatever a web page asks and the lock
  already lets go in your pocket — so nothing was ever trapped. The honesty moved into help.

## How to test it

The 22-step walk is on the hub's **QA walk** tab, with tick-boxes and a paste-back. Run it on a
real phone, on a game inside its live window. The two steps that matter most are **4 and 5** — press
*Who's here* and *End game* without scrolling at all — and **8 and 9**, changing the position of a
player already on the field.

## Success criteria

A coach can end a game without scrolling. A coach can change any player's position in one tap from
the row they are looking at. Nine of eleven players read on one screen. And the console stops being
the one coach screen with its own private version of the save word.
