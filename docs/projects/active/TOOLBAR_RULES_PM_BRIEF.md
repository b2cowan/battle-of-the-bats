# Toolbar Rules — PM brief

**Status:** ruled 2026-10-17 (owner, all asks as recommended). Spec: the Search & Filter Rules mockup,
https://claude.ai/artifact/SPjRTAB6kVqd9vJ8x1vuza version 5. Plan: `TOOLBAR_RULES_PLAN.md`.

## What changes for people
Every list in the product reads the same way. **The left side picks which list you are looking at** (the day,
the division, Needs you · All games, the arrival buttons, the book or year), or shows how many items there are.
**The right side is for working inside that list:** search, then filters, then Tools. Page actions like Export and
Add stay where they are today.

Search looks and sizes the same everywhere: the coaches portal's rounded search box, now with a magnifier, one
width on a desk. Things that choose which list you see are rounded; things that narrow or act are square-cornered.
Check-in's arrival buttons become the same rounded pills Results uses.

The two Ledgers (the club's and the coach's) keep their second row of filters with the balance at its end — the
one written exception, for screens with many kinds of filter and a running figure.

## Why it matters
The owner spotted Results and Schedule with different-sized search boxes on different sides; a census found two
toolbar styles and five hand-built search boxes across the product. Each screen read fine alone, but moving
between them meant re-learning where search and filters live. One rule, written into the standard and held by
the build, stops the next screen copying whichever neighbour it was built beside.

## Customer impact
Organizers, club treasurers and coaches find search and filters in the same place on every list. Nothing is
removed; no data or permissions change. Phones keep what each side has today.

## Priority and sequencing
Medium. A census first (confirming every screen the rules touch, the coaches portal included), then three build
stages — the search field, the shapes, the placement moves — each walked by the owner before it is committed.
House league's older toolbars wait until that area is next worked on. Families (being built now) lands with search
on the right.

## Success criteria
- Every list search in the three portals is the one rounded field, the same width on a desk.
- No narrowing filter sits on the left of a toolbar, except the two Ledgers' filter row.
- Every view choice is rounded; every narrowing or action is square-cornered.
- A build check fails if a screen brings back its own search box or puts filters on the left.
- The owner's walks pass on desk and phone.
