# PM Brief — Notification feed: grouping, ordering and filters

**Plan:** `COACH_NOTIFICATIONS_FEED_FIXES_PLAN.md` · **Mockup (the spec):**
`https://claude.ai/code/artifact/9427bc24-94e4-47dc-9823-ae94d95d09ff`
**Status:** shipped — `baa9be54`, on prod 2026-09-08 (job 262). Owner QA still owed.

## What this is

Four changes to how a coach (and an org admin) reads their notifications. Three are corrections to
things that were quietly wrong. The fourth changes what a word on the screen promises.

## What a coach sees differently

**The screen stops contradicting itself.** A notification's timestamp and the heading above it were
computed two different ways, so a Friday-evening notice could read "1d ago" while sitting under a
heading that said "Earlier". Now the heading names the day and the row names the time inside it —
"2h ago" while it is still today, then "6:21 p.m." under Yesterday, "Fri, 6:21 p.m." under Earlier
this week, and a date past that. A side benefit: a coach can finally tell two Friday notices apart,
which "1d ago" never let them do.

**There is a new heading, "Earlier this week."** "Earlier" was one bucket holding everything from two
days ago to three months ago — in our test data, two-thirds of the whole feed. The new heading takes
about half of that and gives the recent past a name. It sensibly disappears early in the week, when
Today and Yesterday already cover it.

**On a phone, the three filter pills are gone.** They named "Needs attention" and "Activity" — the
two headings the list already shows a finger below — and the number on the pill repeated the number
in the heading underneath it. They filtered a list already on the screen. Measured on the real page,
removing them puts **one more notification above the fold and moves the first day heading from just
below the fold to just above it**. (The mockup predicted two more rows; it was optimistic, because
the new Clear button has to meet the 44 px touch floor and so makes those rows slightly taller. The
measured gain is one row.) Desktop keeps the pills, where the row fits on one line and the list is
long enough for filtering to earn its place.

**"Needs attention" now means what it says.** Previously a row left that list the moment you *opened*
it. Open a failed payment on the bus, fix nothing, and the list quietly reported you were clear while
the club's subscription was still unpaid. Now each of those rows carries a **Clear** button and stays
until you press it. The heading says so, in a line that is visible on a phone for the first time —
the room the filter pills were using is exactly what that sentence needed.

## Why it matters

The first three are small corrections, but the fourth is the one with money attached. A triage list
whose count you cannot trust is worse than no triage list, because it teaches the coach to ignore it.
The failure mode is a missed payment, not a cosmetic complaint.

## Access and roles

No role changes. The same behaviour reaches org admins through the same bell — one API, one meaning,
so the dropdown and the full page cannot disagree about what is outstanding.

## Tradeoffs we accepted

- **The list only empties if someone clears it.** If it fills up and stays full it becomes wallpaper.
  We chose this over having the platform decide a row is resolved, because only two of the current
  event types have a signal the platform could read — "team marked no-show" has none, so that row
  would have sat there forever.
- **"Mark all read" and "Clear" are now two different verbs.** That split already existed (mark-all
  deliberately skips these rows), but the Clear button makes it visible. The help guides now explain
  it.
- **Act rows are slightly taller** than the approved drawing, because the Clear button has to meet
  the portal's 44 px touch floor rather than the 34 px sketched.

## The follow-up this makes urgent

All three rows a coach currently sees in Needs attention are **club-admin decisions** — billing,
tournament check-in, rep-team admin — that link to screens a coach may not be able to open. That
recipient-scoping gap was already ticketed. Keeping rows on screen until they are cleared makes an
unactionable list stickier, so this moves from "nice to have" to the highest-value next piece of
work on this surface.

## How to test it

Open the coaches portal notifications page **on a phone** (the sizes only mean anything on the real
device). Check that: the filter pills are gone and only Unread/All remains; the "stays until you
clear it" line is visible beside the count; every timestamp agrees with the heading above it; there
is an "Earlier this week" heading; and pressing **Clear** on a pinned row drops the count and the row
moves down into the day feed as history. Then reload — it should still be gone. Open one *without*
clearing it and confirm it stays put. Finally press **Mark all read** and confirm the Needs attention
count does **not** move.

The test fixture has been reseeded (64 notifications, 16 unread) since the §138 walk had used it up.
