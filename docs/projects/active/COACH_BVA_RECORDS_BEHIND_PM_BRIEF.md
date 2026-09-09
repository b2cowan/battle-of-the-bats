# PM brief — Behind the figure: dates and doors

**Plan:** `COACH_BVA_RECORDS_BEHIND_PLAN.md` · **Mockup:** artifact `7af46200` ·
**Approved:** owner, 2026-09-09 · **Priority:** high (a visible untruth on the reconciling screen)

## What a coach sees change

On **Budget vs. Actual**, tapping any spent or received figure opens a small panel listing the
records behind it. Two things are different afterwards.

**1 — Sponsor and fundraising rows stop claiming their money is undated.** Today five sponsor rows
in a row can read *"no date recorded"* while the same cheques show their dates on the Months view of
the very same report. After this, each row says how many payments it holds and when they landed —
*"2 payments · May 10 – Jun 14"* — or just the date when there is only one. The words "no date
recorded" survive for the case that is actually true: a record somebody typed in without a date.

**2 — The panel stops being a dead end.** It used to close with a sentence telling the coach to go
and edit these on Transactions, with nothing to click. Now every sponsor and drive row opens that
sponsor's or drive's own page, and a single **Open the Ledger** button sits in the footer of every
one of these panels — including the ordinary expense panels, which are the majority and which
currently offer nothing at all.

## Why it matters

The statement is the screen a treasurer reconciles the season on. A row that says a dated cheque has
no date is not a cosmetic problem: it sends the coach looking for a data-entry mistake that does not
exist, and it makes the two halves of one report disagree in front of them. The dead end is the
quieter cost — an assistant coach opening that panel had no way forward at all, on a screen whose
whole job is "where did this number come from?"

## Role differences

- **Head coaches and standalone coaches** — full change as described.
- **Assistant coaches (read-only)** — this is the bigger win for them: the panel previously ended
  with nothing clickable. The sponsor links and the Ledger door are both open to them, matching how
  the Months view has worked since August.

## Tradeoffs taken

- **The row stays one line per sponsor, not one per cheque.** The figure on it is what the team
  *kept* after the family's share; the cheques are the gross amounts. Listing cheques individually
  would show a list that visibly does not add up to the number above it. The count in the date line
  is what tells the coach the row is a sum.
- **One door, not two, on the sponsor panel.** Each row already opens the sponsor it names, which
  lands closer to the work than a general "Open Sponsors" button would.
- **"Payments" is used for fundraising drives too**, not a separate word — the panel's own closing
  sentence already calls every record on it a payment, and two words for one thing on one screen is
  how help search stops finding things.

## Also fixed on the way

These panels asked to scroll but had nothing that scrolled — a row with a long list of records
clipped silently. Fixed, because the new footer needs a scrolling body to pin against.

## How to check it

1. Money → **Budget vs. Actual** → statement view.
2. Tap the received figure on a **sponsor or fundraising** row. Each line should name its date or
   its payment count and span; tapping a line should open that sponsor's page.
3. Tap a spent figure on an **ordinary expense** row. Dates unchanged; a **Open the Ledger** button
   now sits at the bottom.
4. Cross-check one sponsor against the **Months** view of the same report — the dates must agree.
5. Sign in as an **assistant coach** and repeat 2–3; everything above should still be reachable.

## Success criteria

- No panel on this screen ends without a way forward.
- No row says "no date recorded" for money that has dates.
- The statement and the Months grid never disagree about when a cheque arrived.
- Every figure on the report is unchanged — this moves no money.
