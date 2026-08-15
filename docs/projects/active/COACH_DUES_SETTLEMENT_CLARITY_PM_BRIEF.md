# PM Brief — Coach Dues & Settlement Clarity Pass

**Plan:** `COACH_DUES_SETTLEMENT_CLARITY_PLAN.md`
**Started:** 2026-08-14 · **Priority:** high (two live correctness defects)

---

## What this is

A tidy-up of the coach's **Player dues** screen and the **Season settlement** sheet, asked for
because the dues table had become wall-to-wall text. Reviewing the mockups turned up two things
that are wrong on production today, so the work now leads with those.

## Why it matters

A coach uses the dues screen to answer one question — *who owes me money?* — and the settlement
sheet to answer another — *what goes back to each family at the end of the season?* Both screens
currently make their reader do work the product should have done. One of them can also start a
payment the team cannot afford.

---

## What changes for the coach

### On the dues table

**Today** every cell carries the amount plus a sentence underneath — "paid May 12", "covered by
fundraising", "overdue". Four instalments across a roster is fifty-odd lines of text, and the
$200.00 instalment amount is repeated for every player.

**After**, the instalment amount is stated once in the column heading, and each cell shows a small
symbol: a tick when there is nothing left to send, a warning and the amount when a family is late,
a half-mark and the amount when they are part-way, and nothing at all for an instalment that has
not come due. **The grid stops saying where the money came from** — a tick means settled, whether
the family paid it or fundraising covered it. That detail is still on the player's own record,
which is where a coach goes to ask it.

The totals row underneath loses its labels. It was repeating "COLLECTED" four times under columns
already headed "Installment 1", "Installment 2" and so on, and repeating figures the progress band
directly above it already shows. Only the two season figures remain, sitting under the columns they
total. On a phone, where the table stacks into cards and there are no headings to read across to,
the wording stays.

### On the season settlement

**It stops being a drawer that doubles the page length.** In its place is a single line that states
what the season still has coming in and opens the settlement in a window. The window shows the money
summary with the family payouts beneath it, and it no longer changes the length of the page at all.

**When it isn't ready, it says why in one place.** The window opens on "Not ready to close yet" and,
beside the money summary, a short checklist naming every condition: who still owes and how much,
whether the team is holding enough to cover the refunds, and two advisories that are worth knowing
but never block — money the season still plans to spend, and club funding that can't be attributed
to one season. Previously a coach had to scroll past the whole table to find a single warning.

**It becomes an end-of-season act rather than a payment console.** Today the sheet lets a coach
start paying families while some still owe money — and will offer to pay out more than the team
actually holds. That situation should not arise, so the sheet no longer creates it: the payout
button only comes alive when every family is square, and it does one thing — pay everyone and close
the season. Opened before then, the sheet is a forecast: a coach can see where the season is
heading, set who takes what share, and adjust what the team keeps for next year, but cannot pay
anyone from it.

A family who needs settling early — someone leaving the team mid-season — is paid from their own
money record, alongside the rest of their history, which is a better home for it anyway.

**The refund figures will finally add up on screen.** A family's refund is their share of the
surplus minus whatever they still owe, but the "still owes" figure was on no column, so the numbers
looked arbitrary. It is now a visible column, and every row reads left to right. The totals row
adds up every column, and the refunds total to exactly the cash the team can pay out.

**Negative amounts appear in brackets** — `($152.86)` — everywhere money is shown across the coach
money screens, replacing the minus sign.

**The amount held back for next season** moves above the total instead of below it. It was already
subtracted from the surplus but printed underneath, so the visible column was short by exactly that
amount and anyone checking the arithmetic found a hole.

---

## Access and roles

No change. Everything here follows the existing money-write permission; assistant coaches without
it see the same screens read-only. Finished seasons stay read-only as they are today.

## Tradeoffs made

- **The grid no longer distinguishes cash from fundraising.** Owner call. It makes the cell answer
  one question instead of two, and the distinction is preserved where it is actually asked.
- **Partial and staged payouts are deliberately not supported from the settlement.** They were
  possible before and effectively invisible; designing them properly would have meant a new
  allocation screen, and the owner ruled the underlying situation should not happen.
- **The settlement no longer says which families are paid together.** It works out what each family
  is owed; it doesn't issue the payments. Siblings are still paid as one household — the sheet just
  stops narrating it, after two attempts at saying it both read as clutter.
- **Changing a family's share costs one extra click.** It moved out of the table and into the row's
  own breakdown, because a tappable control in every row was setting the row height and turning an
  eight-family list into a four-family scroll. A coach now opens the family, sees why their number
  is what it is, and changes it there — which is where they were already looking.
- **Two assumptions were taken rather than blocking the work.** "Ready to close" means no family
  still owes anything — a season that still plans to spend money warns but does not block. And
  closing the season pays everyone but does **not** lock the books; a lock is a separate decision.

## One thing still open

The dues grid's **Due next** column still carries a caption under each figure — the same two-line
shape removed from the instalment cells. It was left deliberately: it is the only place that says
*when* the next money is due and how much of the total is already late. Raised with the owner and
not yet ruled on. Everything else in this pass is settled.

## Success criteria

1. A coach can scan the dues grid and find every family who owes money without reading a sentence.
2. Every settlement row's refund can be checked by reading across the row.
3. The settlement cannot start a payout the team cannot fund, or one while families still owe.
4. The dues page and the money hub show negative amounts one way.
5. The settlement no longer changes the page's length when opened.

## How to test it

Open a team's **Money → Player dues**. Switch the desktop lens to **By installment** and confirm
the grid reads as symbols with figures only where money is owed, and that the totals row carries no
labels. Narrow the browser to phone width and confirm the cards keep their wording.

Then open **Season settlement** from the line at the foot of the page. On a team with families
still owing, confirm the sheet opens as a window, that the checklist beside the money summary names
what's blocking, and that nothing can be paid. On a team where everything is collected, confirm the
checklist turns to ticks, the heading changes to "Ready to close", and the single close-out action
comes alive. Check the hold-back sits above the total and that the column adds up, and that the
refunds total to exactly the cash the team can pay out.

Open a family's row and confirm the arithmetic reads across, with "Change what … takes" beside it.
Narrow to phone width and confirm the settlement becomes a card stack that still captions every
figure.
