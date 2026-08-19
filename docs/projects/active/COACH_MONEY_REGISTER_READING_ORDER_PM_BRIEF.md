# PM Brief — The Money register reads top to bottom

**Where:** Coaches Portal → Money → Transactions.
**Priority:** Medium — a real usability defect (not a money-correctness bug), found and fully
designed during an owner QA pass. Full plan: `COACH_MONEY_REGISTER_READING_ORDER_PLAN.md`.

## What a coach sees differently

**The list now reads the way you'd expect a book to.** Today, the Transactions register lists the
newest activity at the top and gets older as you scroll down — but any money still coming or
overdue sits in its own separate cluster near "Today," sorted the opposite direction. The two
different sort orders meeting in the middle is what made the running balance look like it was
jumping around at random, even though the math underneath was always right. Now it's one list,
oldest at the top, newest at the bottom, and an overdue bill sits at the date it was actually due —
not shelved next to today looking like it just came up.

**Overdue money can no longer hide.** A bill 3 months late used to read exactly like a bill due
next week — same shelf, same neutral label. It now carries its own "Overdue · N days" tag and sits
where it truly belongs on the calendar, so a coach can see at a glance how stale something really
is, not just that it's unpaid.

**The controls you need stay on screen.** Filters, the Add button, and the current tab used to
scroll away the moment a season's history got long. They now stay pinned at the top while you
browse — no re-scrolling to change a filter or add a record.

**A shorter view by default, with nothing missing.** The register now opens on a 60-day window
(30 days back, 30 forward) instead of the whole season at once — far less scrolling for the common
case. Anything still unpaid is the one exception: it always shows, no matter how old, so narrowing
the window can never be the reason a coach misses money that's actually outstanding.

**One thing traded away, worth a second look:** the big "Cash on hand" banner is gone, replaced by
a smaller number next to the Add button. It's less visually loud than before — flagging this so
it's judged once it's real rather than assumed fine from a mockup.

## Why it matters

This is the screen whose entire point is answering "where did the money go, and what's my cash
position?" A layout that makes its own balance column look wrong on first read undermines the one
thing the register exists to be trusted for.

## What's explicitly not part of this

- The Fundraising/Club rows' blank Category/Item columns — a real, separate gap, already logged,
  not touched here.
- Any change to the top navigation strip, sidebar, or team header banner — a portal-wide redesign
  candidate that's deliberately being scoped as its own project, not folded into this one.

## Success criteria

- Owner QA pass against the approved mockup (same Claude Artifact URL, four rounds) with no
  arithmetic regressions — `npm run check:register` stays green throughout.
- A coach can explain any balance figure on the register using only what's visible on screen,
  without needing to know it's sorted newest-first.
- An overdue bill is never invisible regardless of the date range in effect.
