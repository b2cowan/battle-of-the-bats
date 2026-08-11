# PM Brief — Coach Money Hub Tabs

## What a coach sees differently

Today, opening any Money screen (Player Dues, Budget Plan, Fundraisers, Expenses & Payables,
Org Allocations, Payment Requests, Budget vs. Actual) is a one-way door — the coach has to hit
"back" (or re-open the Money nav item) to get to any of the others. After this change, a tab
bar sits under the "Money" title at all times. Tapping a tab — or tapping a card on the
Overview tab, which still looks exactly like today's dashboard — swaps the screen in place.
The tab bar never disappears, so hopping from Player Dues to Fundraisers to Expenses is three
taps instead of three round trips through the hub.

On phone, the same tab bar appears, scrolling sideways with a faded edge — the same interaction
coaches may already recognize from the public tournament pages' mobile tab strip.

## Why it matters

Money is one of the most-used sections of the coach portal and has the most sub-screens of any
area (7). The current one-way navigation was the most-cited friction point in the mockup
review: every hop between two dues/expense screens costs a full page reload and a trip back
through the dashboard. This removes that entirely.

## Access differences

None. This is a navigation change only — no new gates, no new archive surface, no season-read
behavior change. Payment Requests and Org Allocations keep showing only for the live season,
same as today; they simply won't appear as tabs when a coach is looking at a closed/archived
season, exactly as their cards don't appear on the hub today.

## Scope of this pass

All 7 sections get tabs in one pass (not a partial rollout) — Overview, Budget Plan, Player
Dues, Fundraisers, Expenses & Payables, Org Allocations, Payment Requests, Budget vs. Actual.
The direct URLs a coach might already have bookmarked keep working unchanged; the tab bar is
the new easy-to-discover path, not a replacement for the old one.

Drilling into a single fundraiser's detail page still leaves the tab strip (it's a genuine
"go deeper," not a sibling swap) — same as today.

## Success criteria

- From any Money tab, reaching any other Money tab is one click/tap, with the tab bar visible
  the entire time.
- No behavior change to any individual screen's own functionality (forms, CRUD, exports) —
  this is a navigation wrapper, not a rebuild of what's inside.
- Old bookmarked/linked URLs to individual Money screens keep working.
- Works identically on desktop and mobile (the mobile tab strip was the deciding factor against
  the sidebar-expansion alternative considered in the mockup review — that pattern has no
  mobile equivalent, since the coach portal's sidebar doesn't exist below 900px).

## Follow-up owed after ship (not blocking)

- Confirm the coach sandbox demo's accounting-screen narration still reads true (it doesn't
  currently name specific sub-screens, so likely unaffected — verify, don't assume).
- Check help-doc references to the old "click into Player Dues" navigation flow for drift.