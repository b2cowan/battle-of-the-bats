# PM brief — the day-of volunteer bottom bars

**Status:** planned, not built · **Decided:** 2026-08-07 (owner picked Option C from the mockups)
**Plan:** `DAY_OF_VOLUNTEER_BOTTOM_BARS_PLAN.md` · **Mockups:** Artifact `2bf781e7-…`

## What this is

The two day-of volunteer screens — the scorekeeper's game board and the gate check-in board — get
a bottom of the screen. Today they have nothing there, and everything a volunteer touches sits at
the top, above a list they have to scroll.

## Why it matters

A volunteer opens the scorekeeper standing at a field, usually one-handed, often in sunlight and
sometimes in gloves. Right now they scroll past a title, three counters, a date picker, a search
box and two dropdowns before they see a single game. And the control they use most — switching
between "still to score" and "already done" — is at the very top, so using it means scrolling all
the way back.

This is not a cosmetic complaint. It is the difference between a volunteer who scores games
promptly and one who gives up and tells an admin the scores at the end of the day.

## What a volunteer sees differently

**Their games first.** The counters disappear (their numbers move into the new bottom bar) and
the date, search, field and division controls fold behind a single Filters button. Two games are
visible on arrival instead of none.

**The buckets under their thumb.** To Score / Review / Final / All become a pinned row at the
bottom, carrying their counts. Switching never needs a scroll. On the gate board the same row
carries All / Not arrived / Checked in / No-show.

**Their duties as tabs.** Below that, a tab bar: Score, Gate, Account. A volunteer who does both
jobs at a tournament hops between them with one tap instead of hunting for a link in the header.

**A cleaner header.** With the gate hop and Sign Out moved into the bar, the top row is just the
FieldLogicHQ mark, the club name and the public-site door — so the club name finally fits instead
of being cut off mid-word.

**A place to be themselves.** The Account tab answers "who am I signed in as, and what am I
allowed to do here?" — which matters when the phone is borrowed or shared at a gate — and holds
install-the-app and sign out.

## Role differences

The tab bar shows only the duties the volunteer actually holds. Someone who only scores sees two
tabs, Score and Account. Someone who only works the gate sees Gate and Account. Nobody is shown a
door they cannot open. No permissions change — this is chrome only.

## Tradeoffs taken

- **Two bars cost about 110px** of permanently-spoken-for screen, on top of the 52px header. This
  was the known price of Option C over the simpler alternatives, and it was chosen deliberately.
- **Sign out goes from zero taps to one.** It lives behind an always-visible, labelled Account
  tab. Worth watching in QA — that button exists because a volunteer on a borrowed phone once had
  no way to end their session at all.
- **Filters cost one extra tap** for a volunteer who changes field or division often. Flagged for
  QA; the date stays visible in the collapsed row.
- **The single-duty volunteer is the weakest case** — a two-tab bar where one tab is the screen
  they are already on. If QA finds it hollow, they get the sub-bar only and keep Sign Out in the
  header.

## Success criteria

1. On a 390×844 phone, at least one game card is fully visible without scrolling on both shells.
2. A volunteer can change status bucket from anywhere in the list without scrolling up.
3. A dual-duty volunteer moves between scoring and the gate in one tap.
4. Sign out is reachable in one tap from any state, on both shells.
5. Nothing on the admin gate screen changes — the check-in board is shared with it.
6. Nothing lands behind the bars on a notched iPhone.

## Priority

Medium — a real day-of ergonomics fix on a surface used under pressure by untrained people, but
it changes no capability and blocks nothing else. Sits behind the current QA backlog.
