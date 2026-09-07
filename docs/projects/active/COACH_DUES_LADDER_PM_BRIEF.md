# PM Brief — The Dues Ladder

**Plan:** `COACH_DUES_LADDER_PLAN.md` · **Mockup:** https://claude.ai/code/artifact/5df27ea9-8210-45de-a569-26c6c74894dc
**Priority:** high — it corrects two figures that currently contradict their own headings
**Status:** approved from mockup, in build (2026-09-07)

## The problem, in one row

A coach opened Avery's record and saw **After fundraising $700.00** against a **$700.00** bill —
after she had brought in $198.15 through a chocolate sale and two sponsorships. The tile was
arithmetically right and told a lie: it means *what's left on the bill once fundraising has been
applied to it*, and her cash had already settled every instalment, so there was no bill left for her
fundraising to reduce. It became money the team owes her instead.

**This is not the overpayment case.** It hits **every family who pays promptly** — pay in full in
March, raise $200 in August, and the screen says your fundraising changed nothing about your season.
That is the group you would least want to look unrewarded.

## What a coach sees instead

Player Dues reads as a sentence, left to right, on the table and inside a player's record:

> **Dues** $700.00 · **Fundraising** $198.15 · **Other credits** $380.00 · **Paid** $1,250.00 ·
> **Balance** ($1,128.15)

A family who has been handed money back gains one more figure — **Handed back** — in amber, because
it is the only one that pushes a balance up. It is absent entirely on a team where nobody has been
paid out.

Inside a player's record, **every figure at the top now has a section beneath it with the same total
in its heading** — Fundraising, Other credits, Payments, Paid out — so the row of figures works as a
table of contents for the records that produced them. On a phone the balance leads and the working
folds out behind a chevron.

## Why it matters commercially

Two numbers on a shipped screen currently disagree with their own labels, and a treasurer cannot
catch either because the disagreement is hidden inside a single column:

- **Blake raised $150 on the Bottle Drive and took $100 back.** The screen shows one netted figure.
  Once a column is headed *Fundraising*, it would say $50 against a fundraiser page saying $150.
- **Casey sent $1,200 and the screen says Paid $900.** Our own rule says Paid shows what the family
  actually sent.

Dues are the single most-scrutinised screen in the product — a parent asks about their own row by
name. A figure that cannot be reconciled to the screen beside it is the fastest way to lose a
treasurer's trust, and the slowest thing to win back.

## What it costs

- **One figure changes value:** Casey's Paid, $900.00 → $1,200.00, with $300.00 now shown as handed
  back. It is a correction, but it is a number moving on a screen coaches have read.
- **Two explanations are deleted.** The row's *"sent $550.00 more than billed"* sub-line — one of two
  visible things §148 shipped last week — and the per-tile captions in the drawer. Both were doing
  work the new columns now do; keeping them would be saying the same thing twice.
- **Payments moves below the two credit sections** in a player's record, so the sections read in the
  same order as the figures above them. Recording a payment is unaffected — that runs off the buttons
  at the top of the record, not this list.

## The promise this must keep

**No balance moves. No status changes.** Twelve families, checked against the rendered screen rather
than asserted. Coaches have already chased families on those numbers; the whole change is a re-split
of one total into figures that say what they mean, and it is built so the arithmetic cannot come out
differently.

## Access

No change. Anyone who can read the Money tab today sees this. No new permissions, no plan gating,
nothing added to the database.

## Success criteria

1. A coach can answer *"what did this family bring in, and what did they send?"* without opening
   anything.
2. Every row on the table adds up left to right, including the three families with payouts.
3. Every figure in a player's record has a section below it carrying the same total.
4. All twelve balances identical to their pre-change values on the rendered page.
