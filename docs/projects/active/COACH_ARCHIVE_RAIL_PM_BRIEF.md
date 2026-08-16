# PM Brief — a finished season tells you which season it is

**Plan:** `COACH_ARCHIVE_RAIL_PLAN.md` · **Mockups:** artifact `8dae1e81-79a4-4165-80c6-e421a6b02a21`
**Status:** proposal, awaiting approval · **Priority:** high — the largest remaining correctness gap
in the coach portal's read surfaces

---

## What a coach experiences today

A coach opens last year's season from the season switcher and taps **Insights**. What happens next
depends on something they would never guess: **whether they still coach that team.**

- **If they do**, they are shown **this** season's record and game log, under a page that says nothing
  about a year. There is no visible clue they are looking at the wrong season. A coach comparing
  "how did we do in 2024?" is reading 2026's numbers.
- **If they have moved on** — the assistant who did one season, the coach who handed the team over —
  the game log is not merely empty, it is **gone**. They see a one-line summary of the season's record
  with no way to see the games behind it. And the Insights hub tells them **"Team not found"** for a
  team they ran all year.

Both come from the same missing question. The page never asks which season it is supposed to be
describing.

## What changes

**The archive gets the real Insights, and it states its year.**

- Every Insights page carries the **season chip** the rest of the portal already uses, so the year is
  on screen and switchable in place.
- The page shows **that season's** games, that season's record, that season's money, attendance,
  awards and development — the same seven reports a coach gets in a live season.
- **Both coaches see the same thing**, because the season decides what the page is, not who is still
  standing on the team.
- One report — **playing time** — is **hidden** in a past season rather than shown broken. Its
  underlying figures aren't season-aware yet, and a link that dead-ends is worse than no link.
- The sidebar in a finished season stops having a one-off: **Attendance disappears as its own item**
  because it is reachable through Insights again, exactly as it is during the season.

## Why it matters

The archive is a **promise**: a coach can open any past season read-only and find what they had. Right
now that promise is kept at the door and broken one step inside — the most expensive kind of defect,
because everything renders perfectly and the numbers are simply the wrong year's.

It also matters commercially in a quiet way. A coach's history is the thing that makes leaving costly
and renewing obvious. A history that shows the wrong year, or refuses to show anything to the coach
who built it, is a retention asset that doesn't work.

## Who is affected

| Role | Today | After |
| --- | --- | --- |
| Head coach still running the team | Silently shown the current season | Sees the season they asked for, labelled |
| Coach or assistant who has moved on | No game log; "Team not found" on the hub | Full read-only access to the season they ran |
| Assistant with limited duties | Sees only what their duties allowed **that season** | Unchanged — already correct, and stays so |

## Tradeoffs made

- **Season-aware Insights over a simpler "archive summary" page.** The simpler option would have meant
  building a second, parallel set of pages — more to maintain, and showing coaches *less* than the
  system can already prove they're allowed to see.
- **One report hidden rather than half-working.** Playing time waits for its own decision instead of
  holding up the other six.
- **Nothing becomes editable.** The archive gains pages it can already prove it may show, and nothing
  else. Every route involved refuses to write, enforced at build time.

## Success criteria

1. A coach opening a past season's Insights sees **that season's** figures, with the year on screen.
2. A coach with no current assignment can open the season they ran and read all of it.
3. Nobody sees a report their duties that season didn't allow.
4. No link in a finished season leads anywhere that shows the wrong year or nothing at all.

## Owner decisions needed

1. **Approve the direction** (season-aware Insights, per the mockups).
2. **Opponent notes in a past season** — show today's scouting book, labelled as current? (Recommended.)
3. **Playing time** — put it on the season rail later, or rule it live-season-only for good?

## Testing

Needs a **genuinely finished season** — the automated layout fixture has none, which is exactly why
this gap survived. The same fixture gap makes ledger **§32 part D** the highest-value QA step already
outstanding; these should be walked together.
