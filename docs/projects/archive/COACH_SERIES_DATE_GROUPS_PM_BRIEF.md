# A weekly series' dates, grouped — PM brief

**Status:** Closed 2026-10-11, built on dev; the owner's browser walk is §299 in the Owner QA Ledger.
**Plan:** `COACH_SERIES_DATE_GROUPS_PLAN.md` · **Mockup and QA walks:** https://claude.ai/artifact/NKSa5J2q25Rm13aEXFwk2G

## What changed for the coach

When a coach adds a practice that repeats weekly, the list of dates it will create used to be one tall row per date,
each repeating either the start time they had just typed or the same note ("Outside the club's permit"). Thirteen
Wednesdays took about 800px, and the sentence that explained the notes sat below all of them.

Now:
- **The dates are grouped by what they have to say.** "Outside the club's permit" is said once, with its dates under
  it as small chips; a clash with another team is its own amber group; everything else is "The other dates". A series
  with nothing to flag is just its dates.
- **Each date is one tap to remove**, and one tap to put back; a removed date stays visible where it was.
- **A flagged group has a "Remove these 4" button**, because those dates are usually one decision.
- **The list sits after the venue**, right above the Add button, so the flags appear just under the venue the coach
  picked instead of above it (on a phone, off screen).
- **Game series** keep one row per date with an opponent box each; a blank box now shows, in grey, the opponent it will
  be saved with.
- **Editing a series** (This & future, All) shows the same groups, with the dates written as words.

## Why it matters

The list exists so a coach sees every date before anything is created. It now does that in about a third of the space
(801px → 288px for the screenshot's season), says each note once, and reads in the order the form is filled. The
silent fallback on game series (a blank date quietly taking the Opponent field) is now visible on the row.

## Who sees it

Every coach who adds or edits a repeating event. The flags appear only at a club's own venues (Venue library plans),
as before. Nothing changes for one-off events, house league, tryouts or tournaments.

## Success criteria

- The §299 walk passes at a desk, on a phone and in Dark.
- A coach can drop every date outside the permit in one tap and undo it in one tap.
- The Venue line's counts and Save's warning behave exactly as before (they count only the dates still kept).
