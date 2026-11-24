# A club changes one team's payment arrangement after the bill is made — PLAN (needs a drawing session)

**Status:** on the board (Owner Morning Brief). **Ruled 2026-11-23 (owner): after launch** — draw it once the closing staging sweep has run.
**History (not kept current):** LOGGED 2026-11-13 (owner), not drawn, not ruled, not built. Found walking Club Tier Stage 13c step 82:
the owner asked why a finalized schedule couldn't be billed, and then the bigger question: *"a team comes to the
president and makes an arrangement of payment — shouldn't the president be able to amend the financial part without
changing the schedule's status?"* The first half (a finalized, unbilled schedule can still be billed, once) is BUILT
(mig 481, "Send the bill"). This file is the second half.

## The need, in the owner's words
One team agrees a different way to pay with the president (later dates, fewer or more payments, a different split of
what is left). The president should change **that team's payments** without reopening the schedule, resending it or
touching any other team.

## What stands in the way (read from the code, not from a plan)
- **Ruling 3d Ask 7b: "a bill goes live when made and its terms never change."** It was deliberate: changing a team's
  share or payments moves **received payments**, **the team's own payment schedule**, **the budget line's "left"** and
  **what the coach was told**. "That is a money edit with its own rules, not a field on a record." The ruling said that if
  a club needs it, it is its own item with its own drawing. This is that item.
- The schedule's status is **not** the blocker. A money edit would never have to change `state`; nothing about the
  schedule reopens. (Mig 481 proved the schedule can take a money step while staying final.)
- Money › Club already has credits (`club_credit_apply`: a lost Sunday comes off the latest payment first) and accepted
  requests to pay (the club gives money back). Neither lets the president **move a due date or re-split what is left**.
  I did not find a per-team "change the arrangement" door in Money; confirm in the drawing session.

## The design questions the drawing session must answer
1. **What can change:** due dates only? the number of payments? the amounts of the payments still to come? Never the
   share (what the team owes in total) — that is a credit, and credits exist. *Recommended start: the dates and amounts of
   payments **not yet paid**, summing to what is still owed.*
2. **Where it lives:** on the team's row in Money › Club (the president is looking at the team's money when it happens),
   not on the schedule page. A schedule's bill is one of several things a team owes the club.
3. **Paid payments never move.** A payment with money received against it is untouchable; only the rest re-spreads.
4. **Who is told:** the coach sees the change on their own Money tab and gets one email saying what moved and why — a
   new payment plan is a promise, and a silent change is the wrong default.
5. **The record:** who changed it, when, from what to what, and a reason (one line, optional) — an audit row the
   treasurer can read at year end.
6. **Who may:** the people who hold the club's Accounting (the same gate as billing).
7. **The send baseline:** a re-spread changes no team's *value*, so Send the changes' baseline is untouched — verify this
   in the build, it is the failure that double-billed once before.
8. **The coach's own copy:** the coach's Money tab reads the club's allocation; confirm it reads the new dates with no
   change of its own.

## Sequence
Draw it **after 13c's walk closes and the staging layout sweep has run**: it re-opens the Bill/Money screens, and a
second edit to them before the walk would be reworked. It does not depend on 13d–13h. Needs a mockup session (house
layout, whole-screen before/after, `/design` before hand-off), then the owner's rulings, then a build prompt.

## Not in this plan
Changing a bill's total or its split between teams (a different, bigger ruling); undoing a bill (credits and requests
cover it); anything for house league (it has no bills).
