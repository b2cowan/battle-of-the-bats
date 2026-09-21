# A scrimmage is a flag, not a kind of game — PM brief

**Owner ruling 2026-09-20:** "the flag." **Built, reviewed, committed `c255abc5` and walked (§211 passed) 2026-09-21 — CLOSED; ships with the next promote.** Plan: `COACH_SCRIMMAGE_IS_A_FLAG_PLAN.md`. Hub artifact
(mockup · brief · plan · decisions): `COACH_SCRIMMAGE_IS_A_FLAG_HUB.html`.

## What changes for the coach

- **Adding to the schedule offers four things, not five:** Tournament · **Game** · Practice ·
  Team event. "League Game" and "Scrimmage" are gone as separate choices.
- **A game has a one-line checkbox — "This is a scrimmage."** Tick it and the game stays on the schedule
  and in attendance like any other, but is left out of the season record and the Scouting Book's
  numbers, and the lineup builder opens on Development. Untick it and it counts again. The box can
  be changed at any time — before the game, after the score is in, a year later.
- **Rows read "vs Brampton Gold" / "@ Brampton Gold"** instead of "League Game vs Brampton Gold"
  or "Scrimmage vs Brampton Gold". A scrimmage carries a small, quiet **Scrimmage** chip beside
  its score. Existing games whose names were auto-written get the new shape; anything a coach
  typed is untouched.
- **A weekly scrimmage series** (a standing Tuesday against a partner club) can now be set up with
  Repeat weekly, like any game.
- **Nothing else moves.** The record still counts games and tournament games; scrimmages are
  still listed with **EXH** in the Scouting Book; the masthead still says "Sat 1:00 p.m.
  scrimmage"; import and export still say "Scrimmage" in the Event Type column and still read it.

## Why it matters

- **It fixes a trap coaches are already in.** A coach who upgrades from the free portal has every
  game filed as a scrimmage — permanently outside their record — because the upgrade assumed they
  could reclassify and the product never let them. With the flag, one untick per game fixes it.
- **It is the coach's mental model.** "Game vs Brampton — oh, that one's just a scrimmage" is a
  decision about a game, not a different kind of event. Asking the coach to pick the kind first,
  and then locking it forever, was the product's model leaking onto the screen.
- **It ends a lie.** A rep team's non-league friendly that the coach wants counted has had nowhere
  to go but "League Game". Now it is a Game, unticked.
- **It corrects the help.** Four articles promise a "count scrimmages" switch on Insights that was
  deleted in a September cleanup; the record has quietly never counted a scrimmage since. The
  product and the help will say the same thing.

## Customer impact

Every Premium coach who schedules games. Zero data loss: existing scrimmages become games with the
box ticked, and their standing in every record, book and report is exactly what it was. The Free
tier's three-kind schedule is untouched. The public demo needs no story change (it seeds no
scrimmages). Assistants and helpers see the chip and the checkbox under the same access they have
to the schedule today.

## Priority

Medium-high, small. A day's build plus a walk. It sits well before the next release because it
carries two tiny migrations (one before the promote, one after) and closes a standing defect for
upgraded coaches.

## Tradeoffs made

- **Game only.** A tournament game does not get the box — the organizer scores those, and a private
  "doesn't count" would put two records in disagreement. Deferred until a real case appears.
- **No global "count scrimmages" switch.** The per-game box is the finer instrument; the dead
  preference is removed rather than rebuilt.
- **The word "League" leaves the label.** Coaches who think of their games as league games still
  have the word in their team's context; the product stops asserting it.

## Success criteria

- A coach can turn any Game into a scrimmage and back from the edit form, and the record, masthead,
  Overview tile, Season's End split and Scouting Book all agree within one page load.
- An upgraded Free coach's games appear as Games, unflagged, counted once results are entered.
- A spreadsheet exported before the change imports after it with every scrimmage still a scrimmage
  and every league game a game.
- No help article describes a control that does not exist.
