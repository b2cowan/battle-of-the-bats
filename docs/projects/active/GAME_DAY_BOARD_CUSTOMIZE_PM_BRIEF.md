# Game-Day Board Customization (PM Brief)

**One-liner:** Let organizers rearrange, hide, and restore the panels on the **live game-day dashboard** — the same way they already can on the pre-event dashboard.

**Who it's for:** tournament owners/admins running an event. Today they can customize the dashboard *before* the event, but the moment it goes "live" on game day, the board becomes a fixed layout they can't touch — and the Customize button disappears.

## What changes
- On game day, the **Customize** button is available again.
- Entering Customize lets the organizer **drag to reorder**, **hide (✕)**, and **+Add back** the live panels: Now Playing, Games Progress, Team Check-in, Schedule Health, and By Division.
- Their arrangement is **remembered per org** (saved in the browser), just like the pre-event board.
- The live board and the pre-event board have **independent layouts** — hiding "Payments" before the event won't hide "Now Playing" during it.

## Why it matters
The game-day board is what an organizer stares at most during the event. Different organizers care about different things — one wants check-in front and center, another only wants live scores and division progress. Forcing one fixed layout on everyone, exactly when the board matters most, is the gap. This makes the live command view theirs.

## Customer impact
- Owners/admins get a personalized live board. No change for volunteers, coaches, or the public.
- Low risk: it's a layout preference saved in the browser, fully reversible, no data or billing involved.

## Priority
Medium. It's a polish/enhancement surfaced during FP-5 game-day QA, not a correctness bug. It can slot in now (owner requested it) or wait until the remaining FP-5 clusters are done — owner's call.

## Success criteria
- Customize is available on game day.
- Each live panel can be reordered, hidden, and re-added; the arrangement persists across reloads.
- The pre-event and game-day layouts don't interfere with each other.
- Existing saved dashboard layouts keep working after the change.

Full implementation detail: `docs/projects/active/GAME_DAY_BOARD_CUSTOMIZE_PLAN.md`.
