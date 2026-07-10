# PM Brief — Money Hub Redesign (Premium Coaches Portal)

**Date:** 2026-07-08 · **Priority:** High — Money is positioned as a flagship selling feature of the Premium portal · **Status:** Building (full experience, one phase)

## What changes for the user

Today a coach clicks **Money** and gets seven identical grey cards stacked in no particular order, four numbers that don't add up the way a treasurer thinks (the "Net Balance" counts the budget as income), and a first-run banner that wrongly tells them to wait for an org admin. Volunteers don't know where to start, that the budget can generate every player's payment schedule in one click, or why their spending report shows everything as "Unbudgeted."

After this change, opening Money greets the coach with **the answer, not a menu**:

1. **A "right now" guide card at the top** that reads the team's actual data and leads with the single next step — brand new team: *"Start with your season budget"*; budget built: *"Turn your plan into player dues — $4,800 across 12 players"* with a one-click Generate button; season running: *"3 players overdue · $450 — send reminders"* or *"You're on track"* with collection progress. One clear action button, always the right one.
2. **Honest headline numbers**: Money In, Money Out, On Hand, and Budget Headroom — real treasurer math that always agrees with the Budget vs. Actual report (and now counts every way money actually leaves: expenses, org allocations, and approved org payments).
3. **The sections regrouped into the workflow** — Plan → Collect → Spend → Review — with live figures on every card (collected vs expected, headroom, upcoming payables) instead of description sentences.
4. **Both budget styles, reconciled**: coaches can set one season total, itemize line-by-line, or both — any gap shows as an explicit "Non-itemized buffer" so the two numbers never silently disagree.
5. **Reliable spending categories**: logging an expense now uses the same category picker as the budget (typo-proof), warns when something won't match the plan, and the report gets a one-click "recategorize" fix for old mismatched entries.
6. **Connected seams**: the Dues page now advertises the budget-powered schedule generator; the Budget vs. Actual report gains export (Excel/CSV/PDF); the auto-reminder toggle moves to the Dues page where people look for it.
7. **Standalone-team cleanup**: solo Premium teams no longer see "Org Allocations" / "Payment Requests" cards referring to an organization they don't have.

## Role differences
Head coaches (and money-write assistants) get the guided actions; money-read assistants see the same status and numbers without action buttons; money-off assistants still see no Money section at all. Nothing changes for parents or org admins.

## Why it matters
Team budgets are managed by volunteers who aren't accountants — this is the section most likely to win (or lose) the Premium sale. The functionality was already strong (budget generator, automatic fundraiser credits, three-layer reminders, refund calculator); it was the packaging that failed. This makes the strongest feature set in the portal legible in one glance.

## Tradeoffs
- The hub's quick "Set budget" number editor moves to the Budget page (one budget home; the hub card links straight there).
- Free-text expense categories are retired in favour of the picker — a deliberate constraint that makes the analytics trustworthy.
- No new "all transactions" ledger view yet (the reconciled Money Out total addresses the confusion at the summary level); report date filters deferred — export covers slicing for now.

## How to test
As a standalone Premium head coach: open Money empty → see the "start with your budget" guide → build a budget (try a season total + a few line items; watch the buffer row) → Generate installments from the guide card → watch the hub flip to collection mode → log an expense with a picked category → check Budget vs. Actual headroom matches the hub → mark dues paid/overdue and watch the guide card change. Then repeat as an org-linked coach (allocation/request cards return) and as a money-read assistant (numbers, no buttons).

## Success criteria
A first-time coach can answer unprompted: where do I start, how do I set a budget, where do I log spending, how do dues get assigned, and where do I see how we're tracking — without opening help. Hub and report numbers always agree.
