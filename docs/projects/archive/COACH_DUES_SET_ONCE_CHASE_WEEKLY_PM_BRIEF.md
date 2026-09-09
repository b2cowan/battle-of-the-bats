# PM Brief — Player Dues: Set Once, Chase Weekly

**Plan:** `COACH_DUES_SET_ONCE_CHASE_WEEKLY_PLAN.md`
**Decided:** 2026-09-04 (owner, twelve answers on the "Set Once, Chase Weekly" mockup) · **Priority:** high — the Player Dues tab is the coach's weekly money screen
**Status:** ✅ SHIPPED to `dev` 2026-09-04 (`06645a32` + `d7771935`) and **walked clean** — Owner QA
§140 PASSED 2026-09-06, 37/37, all nine parts, zero defects, all three open calls ratified as built.
Eleven of the twelve items are live; sticky column headings (G4) stay deferred to the first
twenty-family roster.

---

## What this is

Dues are set once. After that a coach or treasurer opens Player Dues every week to do three things:
see who is behind, nudge them, and answer a parent's "what do I owe?". This pass makes the screen
honest about that rhythm.

## What changes for a coach

- **The set-once door steps back.** Once dues exist, "Set dues for all players" leaves the toolbar
  and becomes a quiet "Change the schedule for everyone" link at the foot of the Collection
  schedule, next to a sentence saying whether every family is on the same schedule. It is not a
  lock: re-running mid-season stays legitimate and the preview still names everyone it treats
  differently. Before any dues exist, nothing changes.
- **The band ties out.** Balance owing says what it excludes when families are in credit, so a
  treasurer's subtraction matches.
- **A Showing filter** beside View: Everyone, Behind, Still owing, Nothing owing. Narrows the table
  and the grid; the export follows it.
- **Send due reminders tells you before it sends.** How many families and installments, how many
  were skipped because they were reminded in the last 7 days, how many have no email on file. The
  button reads "Send 9 emails" and is disabled at zero with the reason. "See what they'll receive"
  shows the real email, in the on-demand wording.
- **A player's panel** gains the guardian's contact line (where the roster already allows it), a
  "Last reminded" line, and one "Remind this family" button that works for anyone late, due within
  3 days, or who has paid nothing yet.
- **By installment reads the way a coach thinks.** Column headings lead with the date; the
  installment to chase is lit and in view when the grid opens; the swipe chip is gone and a ‹ ›
  pager appears beside View only when columns overflow. Names stop wrapping.

## Why it matters

A treasurer visits this tab weekly. Every change here removes a question they had to answer by
arithmetic, by scrolling, or by sending an email to find out what it would do.

## Access

Every new write control (the door, the filter is read-only, Remind this family, Send) is hidden
from read-only money assistants. The contact line respects the roster's guardian-details grant.

## Not in this pass

- A lock on dues (ruled out 2026-08-14, reaffirmed).
- Sticky column headings on a long roster (owner: later).
- Sorting late families to the top; editing the reminder email per team.

## Success criteria

- Owner QA walk passes on the UAT team (desktop and phone).
- Both lenses filter together; the band and schedule never change with the filter.
- The reminder count shown equals the emails sent.
