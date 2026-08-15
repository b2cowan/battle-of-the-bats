# PM brief — the fundraiser drill-in

**Plan:** [COACH_FUNDRAISER_DRILL_IN_PLAN.md](COACH_FUNDRAISER_DRILL_IN_PLAN.md)
**Status:** built on dev 2026-08-14, owner QA owed (ledger §23) · no database change
**Mockup the build follows:** https://claude.ai/code/artifact/8e699fa8-0e0e-46e0-84e9-2e564abe0490

## What a coach sees differently

**Before.** Opening a fundraiser from the Money hub threw them out of it. The row of Money tabs
disappeared, the Import door disappeared, and the only way back was one small text link. Getting
from a fundraiser to Player Dues meant going back, then sideways.

**Now.** A fundraiser opens **where the list was**. The tabs stay on screen with Fundraisers still
lit, so Dues is one click away. `← All fundraisers` puts the list back, and so does the browser's
own Back button. The fundraiser keeps its own web address, so it can still be bookmarked or sent
to an assistant coach — old links and old bookmarks redirect to it automatically.

Nothing about the work itself changed: the totals, the per-player leaderboard, the preview that
shows which bill a rebate will lower before you save, and the logging flow are exactly as they
were.

## The part that matters more than the tidy-up

Coaches can read a finished season. Until now, opening one of **last** season's fundraisers showed
last season's drive beside **this** season's players — with nothing on screen to say so, and with
the Settings and "Log amount" buttons still live over a closed year. It looked completely normal.

That is fixed at the root rather than at the screen: because a fundraiser now lives inside the
Money hub, it inherits which season the hub is showing. A past drive lists the players who were
actually on that roster, carries the `… · Complete` marker, and offers no way to edit anything.
The server refuses those edits outright now, not just the buttons.

## Who is affected

| Role | Change |
|---|---|
| Head coach | The tidier route, and the archive tells the truth. |
| Assistant with money access | Same, plus the correct rule for a season they weren't cleared for. |
| Assistant with **read-only** money | Sees the fundraiser exactly as before — reading was never the issue. |
| Parents / players | No change; nothing they see is touched. |

## Trade-offs made

- **The list is replaced, not shown beside the detail.** The leaderboard is a six-column table and
  the list a five-column one; side by side, neither gets enough width to be read.
- **A per-player export was left out** (owner call, 2026-08-14). The mockup showed one; the file
  would name each child beside the money they raised, which is a decision worth making on purpose
  rather than as part of a layout fix. The existing totals-only export on the list is unchanged.
- **The season chip drops the fundraiser when you switch year.** Switching from 2026 to 2025 while
  reading a drive lands on 2025's *list*, not on a matching drive — a fundraiser belongs to one
  season and has no counterpart in another.

## How to test it

Money → Fundraisers → open a drive. Confirm the tab row is still there and Dues is one click away;
that `← All fundraisers` and Back both return to the list; and that after logging an amount, going
back shows the list's totals already updated. Then use the season switcher to open a **completed**
season and repeat: the drive should list that season's players, show `… · Complete`, and offer no
Settings button and no way to log or edit an amount.

## Success criteria

1. A coach never leaves the Money hub to work on a fundraiser.
2. An old bookmark or emailed link to a fundraiser still opens that fundraiser.
3. A finished season's fundraiser shows that season's roster and cannot be edited by anyone.
4. Logging an amount is reflected in the list's totals without a reload.
