> STALE HEADER (corrected 2026-08-01): DF-1..DF-7 were ratified, BUILT and COMMITTED on dev (a0f56d34) — the "nothing built" line below predates that. Owner QA tracked in active/OWNER_QA_LEDGER.md.

# PM brief â€” Free coach Overview coherence

**Status:** review complete, awaiting a decision. Nothing built.
**Plan:** `FREE_COACH_OVERVIEW_COHERENCE_PLAN.md` Â· **Mockups:** `claude.ai/code/artifact/8efbb388-a58c-40b9-8377-62b36f140bde`

## The question we were asked

After the premium team Overview was rebuilt around "say one thing", someone had to check whether the
free coach's Overview had the same problem. It doesn't â€” but it has one of its own.

## What's wrong today, in plain terms

A free coach who has entered one tournament opens their team home and sees **that tournament three
times on one screen** â€” as a row, again as a card right below it, and again as a number in the
strip â€” plus a fourth time in the header bar that's always on screen. Nearly half the first
screenful is the same fact repeated. The section that leads the page is also a straight copy of the
Tournaments tab, which is already one tap away.

Worse is the coach who creates a team from scratch. They land on an empty tournaments message,
then five boxes reading zero, zero, none, $0.00, zero â€” and the card that would actually help them
("Let's set up your team") is **below the bottom of the screen**. The first thing we show a new
coach is a report on a team that doesn't have anything in it yet.

## What changes for the coach

- **The Overview names one tournament â€” the one that matters right now** â€” with the link to its
  public page attached to it. "See all" leads to the full list, which stays on the Tournaments tab.
- **On a phone the five numbers sit two across** instead of stacked, so four of the five are visible
  without scrolling (today it's one, and it's clipped).
- **A brand-new coach sees the invitation before the numbers**, and a tool they haven't switched on
  says what it would do for them instead of reporting a zero.
- **One "there's more" link on the page instead of two** pointing at the same place.
- **The right event gets named.** Today the block picks whichever tournament was *registered* most
  recently, so a coach entered in a future event yesterday could see that one instead of the event
  they're playing today. It could also show a finished event under a heading that says "Your event".

## Why it matters

The free portal is the acquisition funnel â€” every public tournament registration creates one. A page
whose most prominent section is a duplicate of another tab reads as thin, and a first-run screen
that opens on five zeros is the worst possible first minute for a coach deciding whether any of this
is worth their time. Neither is a bug anyone would file; both are why the page doesn't feel like it
has anything of its own to say.

## Trade-offs made

- **The full tournament list leaves the Overview.** A coach with several entries has one extra tap
  to see them all. Judged worth it â€” the list has a permanent home in the tab row, and the Overview
  earns back a screenful.
- **We are not porting the premium design.** Free stays the lighter "companion" experience; this is
  a tidy-up of what's there, not a rebuild.
- **The Premium mention at the bottom stays exactly where it is.** It's on the approved list of
  places we're allowed to mention it, and this pass doesn't reopen that.

## Priority and cost

**Medium â€” small.** One pass, mostly ordering, layout and wording. No database change, no new
screens, no new components. One of the seven changes touches shared code that the paid portal also
uses, so it gets a proper review pass and a paid-portal re-check.

## Success criteria

1. A coach with one tournament sees it once above the fold, not three times.
2. On a 390 px phone, four of the five team numbers are visible without scrolling (today: one).
3. A brand-new coach sees "Let's set up your team" without scrolling (today: 82â€“186 px below the
   fold depending on the phone).
4. The tournament block names the event being played whenever there is one.
5. No change to what the coach can do or reach â€” this is about what they see first.
