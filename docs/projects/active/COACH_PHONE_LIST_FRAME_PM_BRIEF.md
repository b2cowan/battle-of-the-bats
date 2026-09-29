# Phone lists in one frame — PM brief

**Priority:** medium. A consistency fix across about a dozen phone screens. No data changes.
**Status:** every decision made 29 Sept; built on dev the same day; owner walk §248 passed 29 Sept.

## What changes for a coach

On a phone, lists stop being stacks of separate white cards with gaps between them. Each list sits
in one white frame with a thin line between rows, the way the Schedule already looks. Concretely:

- **Roster** becomes a small table on the phone: number, player, positions. The numbers line up in a
  column instead of floating beside each name. The call button on each row goes (owner ruling,
  29 Sept): coaches open this list many times to record things, usually have parents' numbers in
  their own phone, and can find contacts on the player's page.
- **Depth chart:** a list of players in one frame; tapping a player opens their position editor
  full-screen, with a back arrow to the list (owner ruling, 29 Sept). A "Next player" button at the
  foot is proposed so a coach can set up the whole team in one pass. A player's Best positions are
  put in order by dragging (hold the grip), the way the lineup builder works, instead of up/down
  arrows; a tap on the grip still offers Move up / Move down. The player's own page changes the
  same way, on phone and desktop.
- **Player Dues:** the families sit in one frame and still fold open in place; an opened family's
  installments sit on the page's paper tone, so they read as "inside" that row.
- **Practice plans, Lineups, Lineup templates, Scouting Book, the Development report, the practice
  libraries,** and the lists inside the lineup builder's sheets all take the same frame.
- **Ledger and Club (Money) keep their cards.** Each entry there carries five to seven labelled
  lines, and the gap is what shows where one entry ends and the next begins.

On a desktop or tablet the only change is the player page's Best-positions order, which drags
there too. Every screen keeps what it shows. The one change to what a
tap does is the depth chart: a player opens full-screen instead of unfolding inside the list.

## Why it matters

The portal has two phone looks for the same kind of list, and a coach switching between Schedule
and Roster sees both in two taps. The owner has picked the frame every time the two were shown side
by side. This makes that the rule instead of an exception five lists opted into.

## The trade-off, said plainly

This is about looking like one product, not about fitting more on a screen. The gaps cost 10–15%
of a list's height. The roster shows all 12 players on the first screen instead of 11 on the most
common phone width, and 11 instead of 10 on the narrowest phones.

## Role differences

None. Head coaches and assistants see the same shapes. Family contacts stay where they are today
for the coaches allowed to see them: the player's page, and the Family column on a desktop.

## Success criteria

- Every phone list of short records sits in one frame; only Ledger and Club draw separate cards.
- No list loses a control, a fold, or a door it has today, apart from the roster's call button,
  which was ruled away.
- Every row a coach taps is at least 44px tall.
- A build check fails if a separate-card list comes back anywhere outside the Ledger and Club.
