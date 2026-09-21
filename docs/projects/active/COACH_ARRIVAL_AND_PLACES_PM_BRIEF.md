# PM Brief — Arrival & Places

**Ruled 2026-09-21 · building on dev · plan:** `COACH_ARRIVAL_AND_PLACES_PLAN.md` · hub https://claude.ai/artifact/GHsg5ucCcPnr9USu3E5std

## What a coach sees differently

- **Arrival** on a game or practice is a dropdown of *how long before* — 15 minutes to 2 hours, with the
  clock beside each ("45 minutes before · 5:15 p.m.") — and "A specific time…" for anything else, which
  opens an hour before the game instead of at the time of day you happen to be sitting at. Move the
  start time and a preset moves with it; a specific time stays put. Families see exactly what they see
  today: "Arrive by 5:15 p.m."
- **Team Settings gains "Arrive before a game / a practice."** Set once; every new game or practice
  starts there; any event can change it. Blank until the team says otherwise.
- **Location becomes a place the team keeps.** Type to find one of your places or add one inline
  (name, address, usual diamond, a note like "park behind the arena"). Picking it fills the address
  and the diamond; the map link works from then on without retyping. A one-off away park can still
  just be typed. The Recent chips retire into the picker's list; **Manage places** lives inside it.
- Under **More**, the diamond stays changeable per game (pre-filled from the place); the Address field
  goes — the place carries it.
- A team with a season behind it opens with its places already there — seeded from its own history.

## Why it matters

Arrival and location are the two things a coach types on every game. Both asked the question the
wrong way round: a clock instead of a lead time, and three loose strings instead of the place the
team actually goes to. The map link — the whole reason the address exists — only worked when a coach
retyped the address, which is why it mostly didn't.

## What else it touches

The event page and game-day header (unchanged — same stored values), the schedule import (a row
whose location matches a place takes its address and diamond), Team Settings (one new section), the
help articles for the schedule, game-day details and settings.

## Trade-offs

- Dropdown over pills — one shape across every form; seven answers plus the escape need the list.
- No hard "1 hour before" on every game — a game the coach never touched must not promise a family a
  time. The team default is where the habit belongs.
- Editing a place's address never silently rewrites past events; it offers to update upcoming ones.

## How to test

Owner QA walk §214 (the hub's QA Walk tab): the arrival dropdown on a game and a practice, the team
default, adding/finding/managing a place, the import match, the seeded book on the UAT team.
