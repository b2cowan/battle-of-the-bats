# The tournament phone bar follows the event's phase: PM brief

**Status:** drawn, ruled and built 2026-10-16; the bar committed `c7ca70ff`, the board's Check-in door committed `ca03e136`; all on prod 2026-10-18 (master job 281). Dashboard is pinned to the left corner in every phase (Draft and
game day ruled by the owner, A1–A4 as recommended), and the game-day dashboard's count of arrived teams opens Check-in,
under a label that reads "Check-in" (renamed from "teams arrived" during the walk so it says where it goes). Walk
✅ PASSED 2026-10-16, 11 of 11 (QA §323). Hub (QA walk,
mockup, asks, brief, plan): see the plan's header.

## What changes

On a phone, an organizer gets around their tournament with the bar along the bottom of the screen. Today that bar has
only two states. Before the event is launched it shows the setup tools (Setup · Teams · Schedule · Site). From the
moment it is launched it shows the game-day tools: **Results · Check-in · Schedule · Chat**.

A launched event can sit months before its first game. The owner's U13 Battle of the Bats 2027 launched 259 days out,
so for the rest of the year its organizer opens the app to a bar that leads with an empty Results screen and a Check-in
screen that has nobody to check in. Meanwhile the work of those months (teams registering, coaches signing up,
messaging the teams) sits behind More.

After this change the bar reads the same phase the event's header already shows (**Draft, Open, Game day, Completed**):

| The header says | The bar shows |
|---|---|
| Draft | **Dashboard · Teams · Schedule · Site** (ruled 2026-10-16; Setup in More) |
| **Open** (launched, before game day) | **Dashboard · Teams · Schedule · Chat** |
| Game day | **Dashboard · Results · Schedule · Chat** (ruled 2026-10-16; Check-in in More) |
| Completed / Archived | **Dashboard · Results · Schedule · Chat** (ask A3) |

The switch to the game-day tabs happens at the moment the header changes to "Game day": the event's first day, or
earlier if a game has already started.

## Why it matters

- **The bar stops pointing at empty screens.** For most of a tournament's life, two of its four tabs lead nowhere useful.
- **The home screen is one tap away.** The dashboard tells the organizer what needs doing months out, and today it is
  buried in More.
- **The header, the dashboard and the bar agree.** The September redesign gave the header and dashboard one shared game-day
  rule. The bar was built before that rule and never learned it.

## Who sees what

Everyone who runs a tournament on a phone: owners, admins, staff, treasurers and officials. Dashboard and Teams are
open to every role, so each role gets the same four tabs. An invite-only event (the free plan) has no Check-in or Chat,
so its Open bar is Dashboard · Teams · Schedule · Messages. Desktop is unchanged, because its sidebar lists everything.

## Priority and size

Small. The rule already exists and only needs reading in one more place. No data or permissions change. Help copy that
names the bar's tabs gets one line.

## Success looks like

- An organizer months out opens their event and the bar reads Dashboard · Teams · Schedule · Chat, with Dashboard lit.
- On the first day of the event (or when the first game starts) the bar reads Dashboard · Results · Schedule · Chat,
  the same moment the header reads "Game day", with Check-in in More.
- Nothing becomes unreachable: whatever leaves the bar is in More.
