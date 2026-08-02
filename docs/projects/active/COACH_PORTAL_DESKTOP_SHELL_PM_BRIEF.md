# PM Brief — The coaches portal earns the desk (desktop shell upgrade)

**Status:** Ratified 2026-08-01; building. Mockups (binding): `claude.ai/code/artifact/949c4e72-05f7-47b5-bceb-63d5c9b7a8ed`

## What changes for a coach

- **The empty right side of the screen is gone.** Every page centers itself in the window, and the
  data-heavy screens — roster, attendance, schedule, lineups, dues, expenses, budget, documents, insights,
  the practice plan editor — grow from a narrow fixed column to a wide one. Tables stop scrolling sideways
  on a big monitor; the budget grid finally gets the same room its Budget-vs-Actual sibling already had.
- **The team header never scrolls away.** A slim bar pins to the top of every page: club name, team name,
  which season you're looking at, and the door to the public site. Deep in a long roster or schedule you
  always know whose season you're in — and in a finished season the bar keeps saying "read-only archive"
  on every page instead of only at the door.
- **The player profile becomes a real profile page.** Quick facts (guardian, safety, dues) sit in a side
  panel that stays visible while you scroll; the long sections (development, attendance, awards) collapse
  and can be linked to directly.
- **Season's End stops floating.** The Wrapped card and the recap sit side by side on desktop instead of a
  narrow strip in empty space.
- **Exports get one consistent control** wherever a screen already offers more than one export format.

## What deliberately does NOT change
The warm look · phone layouts (this is a desktop-space change; the pinned bar appears on phones but slims
as you scroll, like admin's) · Chat, the practice run screen, and the Development hub (each narrow/full by
recorded decision) · no density toggle (owner declined).

## Why it matters
The premium portal is the operator tier — it should sit on a desktop like the tournament admin does. This
closes the two loudest visual gaps (dead space, vanishing headers) using the same patterns admin already
proved, so a coach moving between admin and portal feels one product.

## How to test (owner QA)
On a wide monitor: open Roster, Dues, Schedule, Budget, the lineup builder — content should be wide and
centered with even margins. Scroll any long page — the team bar stays pinned and content slides under it.
Open a finished season — the bar says it's a read-only archive on every page. Open a player — quick facts
stay beside you as you scroll; section links open the right section. On a phone: scroll — the bar slims;
nothing new covers the bottom nav; attendance/lineup save bars still pin.

## After the build
A short follow-up review (owner-requested): which pages could use the reclaimed space for a genuine
side panel with live content (Option C candidates), ranked, with mockups — decisions only, no build.
