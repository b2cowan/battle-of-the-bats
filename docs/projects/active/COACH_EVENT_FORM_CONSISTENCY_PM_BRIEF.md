# PM Brief — The Add Event form looks like the rest of the portal

**Ruled 2026-09-21 · built on dev the same day · plan:** `COACH_EVENT_FORM_CONSISTENCY_PLAN.md`
**Mockup:** https://claude.ai/artifact/VzYmNKQ2DTqXRFaPiWKgKx

## What a coach sees differently

Open **Add Event → Game** on the Premium schedule.

- The form opens on the fields, not on a legend. No "* Required" line; no row of event-type pills.
  The title says **Add Game** with the game's colour dot beside it — the same dot the schedule row
  and the Add Event menu use. Picked the wrong type? Cancel, pick again.
- **Date · Start time · End time** on one row, then **Arrival time**. Before, the date was typed
  twice (once inside Starts, once inside Ends). The repeating form already asked it this way.
- The When / Where / Who boxes are gone. The same fields sit flat on the sheet, in groups
  separated by space — the way Record money, Add a goal and every other form in the portal reads.
  (The "blue background" was this box in dark mode; olive in the warm theme. Same box.)
- **Opponent** and **Home / Away** share a row; Home / Away is a dropdown like every other pick in
  the portal. The "@ vs vs" hint sits under the row. "This is a scrimmage" is unchanged.
- The optional group is named for what it holds — **More — field, uniform, tags, links, notes** —
  instead of "Add details (optional)".
- The footer is the ordinary square buttons: **Cancel · Add game** (Add practice, Add tournament,
  Add team event; a repeating series still says "Add 11 games"; editing still says Save changes).
- Escape closes the form, focus returns to where you were, and a screen reader is told it is a
  dialog — the floor every other form already had.

Net: the Game form is roughly 250px shorter; on a phone, Opponent is above the fold.

## What else it touches

- The **same rule** that drew the tinted boxes draws the open "More" group on every form, the Give
  Award sheet and the paste-a-roster sheet — all four flatten together, so nothing is left as the odd
  one out.
- The "* Required" line comes off the six other forms that still carried it (Add Player, Add Budget
  Line, dues credit, the head-coach editor, the free schedule editor, the interest form).
- "(optional)" tags come off the premium forms that still had them (Give an award, Add a goal,
  Record a result, Review a goal, the skill/test definition sheet, the game console's "About a
  player?", the scouting note, the budget period grid). The free-tier editors keep their older
  "+ Add … (optional)" panels — a separate call.
- The help articles say **Arrival time** where they said "Arrival / call time" (search for "call
  time" still finds them).

## Why it matters

A coach meets this form more than any other on the portal — every game, every practice. It was the
one form still speaking an older visual language, and every difference cost either space (the pills,
the legend, the boxes) or a small doubt (is this the same product?). The pass spends no new design;
it applies rulings already in force.

## Trade-offs

- Changing the type mid-form now means Cancel + re-pick (one tap; the discard guard only asks if
  something was typed). Chosen over keeping a whole row on every open.
- An event that crosses midnight (23:00–01:00) is recomposed same-day if edited. Youth-team events
  do not cross midnight; the repeating branch already assumed this.
- Home / Away as a dropdown is one more tap for an away game than the segmented row was. Ruled for
  one shape across every form.

## How to test

Owner QA walk §212 in `docs/projects/active/OWNER_QA_LEDGER.md` — Add Game / Add Practice / Add
Tournament / a tournament game slot, edit, repeat weekly, phone width, Escape, and the four flattened
siblings.
