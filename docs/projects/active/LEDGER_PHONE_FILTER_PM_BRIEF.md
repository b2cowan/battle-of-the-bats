# Ledger Phone Filter — PM brief

**Status:** decisions D1–D7 accepted 2026-10-02; committed `687187cf` 2026-10-02; owner QA §261 next. Hub: https://claude.ai/artifact/9MkS5tTMA7RvytnUXCsVdx

## What changes
On a phone, the Ledger's filters move behind one **Filter** button: Type, Status, Item, Date and Tags on a team's
Ledger; Type, Status, Category and Date on the club's. The button opens a sheet from the bottom of the screen. The
sheet lists each filter with what it's set to, and tapping one opens its choices. The button lights up with a count
when anything is narrowed. **Reset filters** puts everything back to normal. Cash on hand (Balance, on the club's)
moves up beside the button. Nothing changes on a desktop or tablet.

## Why it matters
The coach's Ledger toolbar stays pinned while the coach scrolls. On a phone it was up to three lines of filters, so
the season's money was read through a slot. At 390px the list gets 79px more on every screen (520px to 599px).

## Customer impact
- Coaches and money assistants on a phone see more of the Ledger and still reach every filter. Changing a filter
  takes one more tap.
- Club owners and treasurers on a phone get the same change on the club's Ledger.
- Nobody at a desk sees a difference.

## Priority
Polish, not a blocker. A small change, because the filter controls and the sheet already exist and are shared by
both Ledgers.

## Success criteria
- At 360px and 390px, every view of both Ledgers has a two-line toolbar, whatever filters are on.
- Every filter choice offered today can be made from the sheet, with the same counts.
- A coach can tell a narrowed Ledger from an unfiltered one without opening the sheet.
- No visible change at desktop width.
