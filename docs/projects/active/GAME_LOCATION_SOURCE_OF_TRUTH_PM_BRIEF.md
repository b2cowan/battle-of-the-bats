# PM Brief — "The schedule can tell you you've double-booked a diamond"

> **Created:** 2026-08-07 · **Status:** Planning, nothing built
> **Plan:** `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md`
> **Raised by:** owner, 2026-08-07, during day-of volunteer QA

## What it does

Makes the schedule reliably warn an organizer that they've put two games on the same field at the
same time — **including when the field name was typed in by hand** rather than picked from a list.
Where the product genuinely cannot check a game, it says so out loud instead of staying quiet.

## Why it matters

Right now the product has **two different opinions about the same schedule, and the quieter one is
the one attached to the Save button.**

The schedule health panel already spots a double-booked "Diamond 1" and counts it. The schedule
editor — the screen the organizer is actually working in — shows no warning and lets the save go
through. Nothing announces itself. Every screen renders. The organiser finds out at the field on
Saturday morning, with eight teams standing on one diamond.

That gap is live today and needs no database change to close.

## What we found that changes the picture

The concern that prompted this was that 39% of games have a typed field name with no real field
record behind them, so they're invisible to clash detection.

Two things turned out differently once measured:

**Production is clean.** All 83 live games already point at a real field. The 39% is entirely
development test data — and 96% of it sits in four seeded demo tournaments using just nine distinct
field names. So the scariest part of this work, a data migration that guesses wrong and quietly
moves a real game to the wrong diamond, **has no customer data to damage.** That makes it far safer,
and far less urgent, than it first appeared.

**The bug the volunteer reported is a different bug.** The empty "All fields" dropdown they hit was
on a tournament whose games *do* have proper field records — so the typed-name problem doesn't
explain it. It needs reproducing on its own. Worth being explicit: **this work would not have fixed
what they saw**, and the plan's first step is to hand that defect back rather than quietly claim it.

We also found something the original write-up didn't cover: **house league has no field structure at
all**, so a league running all season across shared diamonds gets *zero* clash detection — a weekly
risk rather than a tournament-weekend one. It has no live data yet, which means we can decide how it
should work before there's anything to migrate. That window closes the moment a customer starts
using it.

## Who benefits

Tournament organizers on every plan tier, plus day-of volunteers and scorekeepers who rely on the
field filter. **No new plan gating** — catching a double-booking is basic correctness, not a premium
feature.

## Expected impact

- Organizers find field clashes on Tuesday instead of Saturday.
- When the product can't check a game, the schedule health panel says so with a count, instead of
  handing out a clean bill of health it hasn't earned.
- Typing a field name stops being the easy default. Picking a real field becomes the normal path,
  and typing text becomes a deliberate "this is off-site" choice.
- A game's field gets stated once and read everywhere — the way its division already is.

⚠ **One thing to expect at QA:** organizers working on tournaments with typed field names will start
seeing clash warnings where saves previously went through in silence. That is the entire point, but
without warning it will look like something broke.

## Priority

**High** for the checking gap — it's live, it's silent, and it needs no schema change.
**Medium** for the underlying data cleanup — real, worth doing, but the evidence says it's third in
line, not first.

## Success criteria

1. Two games on the same field at the same time are **always** flagged — typed name or picked field.
2. Where a game can't be checked, the product names it and says why.
3. The day-of field filter lists every field the day's games are actually on.
4. Not a single existing game is silently moved to the wrong field.
5. The two conflict engines can no longer drift apart, because they share one definition.

## Sequencing

| Phase | What | Schema change? |
|---|---|---|
| 0 | Reproduce the volunteer's empty dropdown — hand it back to the day-of work | No |
| 1 | **Close the checking gap** — both engines agree; say what can't be checked | **No** |
| 2 | Stop new drift — picking a field becomes the default path — ✅ **BUILT on dev 2026-08-08** (to approved mockups), owner QA pending | **No** |
| 3 | Tidy the existing typed names — admin reviews every match, nothing auto-applied | **No** |
| 4 | House league gets the same field model (**ruled**); coach events ruled out — ✅ **BUILT on dev 2026-08-08**, owner QA + prod migration decision pending | **Yes — the only one** |
| 5 | A database-level rule — **deferred, not proposed** | Yes, later |

Phases 1-3 need no database migration at all. That's deliberate: this exact column has a history of
a production-only failure (a stricter rule on production than development made deleting a venue fail
for live customers), and there is nothing on production to migrate anyway.

## Owner rulings — 2026-08-08 (all three decided)

1. ✅ **Ship Phase 1 quietly.** No announcement. The warning has to explain itself the first time an
   organizer sees it, so the wording of that message is now the only briefing they get — it names
   both games, the field, and what to do about it.
2. ✅ **"TBD" means no field set.** It stops being treated as a field name, so two unrelated TBD
   games can never look like a clash. Instead they're counted in the "these games aren't being
   checked" line, which is the honest answer. ("TBA" gets the same treatment.)
3. ✅ **House league gets the same field model as tournaments.** A league gets clash detection from
   day one rather than being the module that quietly never had it.
4. ✅ **The health score now reflects what was actually checked** (added 2026-08-08, once the owner
   confirmed no live tournaments would be affected). The "no clashes found" portion of the score is
   earned in proportion to how much of the schedule could be checked — half your games located
   means half that credit, not all of it. Deliberately *scaled* rather than *penalised*: a game
   with no field set is **unverified**, not **broken**, and an unchecked schedule can never score
   worse than one with confirmed double-bookings.

**What ruling 3 changes:** Phase 4 becomes the only phase needing a database change, and it should
**not** drift to the end of the queue. The whole reason it's cheap is that house league has no live
data — that stops being true the moment a customer schedules a league game, and then it becomes a
migration with customers attached.

## Phase 4 — built 2026-08-08 (dev), with two further owner decisions

Production was re-measured first: still zero league games and practices, so the window was open.

5. ✅ **A league's fields are the club's own field list** — the "define your locations once"
   library that League and Club plans already have (it finally gets used). Not per-season copies:
   this means two seasons sharing a diamond are checked against each other automatically.
6. ✅ **Practices and games share one booking pool.** A practice occupying a diamond blocks a game
   on it, and vice versa — a booking is a booking.

**What a league organizer sees now:** picking a field from a list is the normal path (typing text
is the explicit "somewhere else" choice); saving a game or practice onto an already-booked field is
stopped with a message naming both bookings, the time and the field; the generator warns instead of
blocking (its drafts deliberately stack games); and the schedule page carries the same honesty line
tournaments got — "N bookings have no diamond set — they aren't being checked." Families see no
change (the public league schedule doesn't show locations).

**Still with the owner:** browser QA, and the decision to apply the database change to production
(it is on dev only — deliberately, since applying migrations to prod is never automatic).

## Phase 2 — built 2026-08-08 (dev), with two further owner decisions

Built to mockups the owner approved the same day (the "Phase 2 — Field Picking Mockups" artifact).

7. ✅ **League and Club clubs with no tournament fields are offered their Venue Library first.**
   The "no venues yet" prompt leads with importing the club's own field list; plain create is the
   fallback (and the only option on Tournament plans, which have no library).
8. ✅ **The setup prompt says "venues."** The buttons land on a page called Venues, next to a button
   called Venue Library — so the prompt matches. The sport's own word (diamond, court, rink) stays
   wherever a specific playing surface is being picked for a game.

**What a tournament organizer sees now:** picking a real field is the normal path everywhere a game
gets a location — the game window, the inline schedule row, the timeline, the bracket builder —
and typing text is a deliberate "Somewhere else (type it)" choice that says, right there, that
typed locations aren't checked. Clearing a field genuinely clears it (it used to silently keep the
old one). A tournament with no venues is asked to set them up the first time someone schedules,
instead of silently accepting text. A spreadsheet import links field names that exactly match your
real fields, and the preview names — by name, with counts — every field name it couldn't match,
without ever blocking the file over one. The scorekeeper's field filter lists the places today's
games are actually at, including typed-only locations that used to be unreachable through it.

**One cosmetic effect to expect:** the product writes field names as "Lions Park — Diamond 2" (one
canonical format). Games saved before this phase may show a hyphen instead; they pick up the
canonical form the next time they're edited or imported.

**Still with the owner:** browser QA (QA ledger has the script). The volunteer's empty field
dropdown remains a separate defect — Phase 2 does not claim it.
