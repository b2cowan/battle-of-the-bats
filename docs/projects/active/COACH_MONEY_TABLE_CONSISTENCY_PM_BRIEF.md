# PM Brief — Money Hub Table Consistency

**Plan:** `COACH_MONEY_TABLE_CONSISTENCY_PLAN.md` · **Mockup:**
`claude.ai/code/artifact/14181bd3-93b2-4cb6-bb11-5f5eb28b14be`
**Status:** **on prod 2026-08-14 (job 256; built 08-13)**, owner QA pending · **Priority:** medium — polish, not a
blocker

---

## The problem in one sentence

A coach moving between the Money hub's tabs sees rows of money drawn five different ways, so one
hub reads as three separate products.

## What we found

Twelve places in Money show rows of money. They use five different visual treatments. Underneath,
they are only doing three different jobs — showing a **list**, showing an **outline** (categories
holding lines), or showing a **grid** (a comparison across months). Three of the five treatments
exist because the same job got drawn from scratch a second and third time.

Three real problems came out of the inventory, none of them previously known:

1. **Money doesn't line up.** On Player Dues, Expenses, the payment schedule and allocation
   instalments, dollar figures sit against the left of their column instead of the right. A
   treasurer comparing four balances has to read the digits rather than see the shape. This is the
   single most visible piece of the inconsistency.
2. **Two tables scroll sideways on a phone with nothing telling the coach they can** — a player's
   payment schedule and the season-end refund preview. Everything else in the hub either turns into
   cards or shows a swipe hint.
3. **Three lists have no shared styling at all** — Fundraisers, Payables and Payments. They look
   alike today by luck; the next edit to any one moves it away from the other two.

## What a coach sees differently

**On a desktop**

- Every money column right-aligns and uses the same numeral face, so figures line up on the dollar
  across every Money tab.
- Budget Plan and Budget vs. Actual — which show the same category-and-line structure — get the
  same frame, the same category bar and the same number column, so switching tabs stops feeling
  like switching apps.
- Fundraisers, Payables and Payments gain a single heading row instead of repeating their labels on
  every card. On Fundraisers that is three labels instead of nine (or thirty, at ten fundraisers),
  and "which fundraiser raised the most" becomes a glance down one column.
- A zero drops to muted grey so the figures that need attention carry the colour alone.

**On a phone**

- Lists still turn into labelled cards, exactly as today.
- The month grid still scrolls sideways with the line name pinned — that is a standing ruling and is
  not being reopened.
- The two tables that scrolled sideways in silence get the same treatment as everything else.

**What does not change:** every row, column, figure, button, drill-in and permission. Nobody gains
or loses access to anything. A read-only money assistant sees exactly what they see today.

## Why it matters

Money is the surface where trust is won or lost — it is the one place in the portal handling real
club funds, often by a volunteer treasurer using it a handful of times a season. Figures that don't
line up read as sloppy bookkeeping even when the arithmetic is perfect. And the shared pieces this
creates would serve roster, schedule and attendance later, where the same drift exists.

## Tradeoffs taken

- **Consistency does not mean one table.** Budget Plan keeps its card stack — it is something a
  coach edits, not a report they read — and the month grid keeps scrolling sideways. Flattening
  either would be a regression wearing a tidy-up's clothes.
- **Fundraisers loses a little breathing room.** A fundraiser has a description that reads well in a
  card. Traded for a scannable column of takings and the removal of the repeated labels the owner
  has already ruled against once this month.
- **The wider portal is left alone.** The same inconsistency exists on roster, schedule and
  attendance. Noted, not fixed — the shared pieces are built to be liftable there later.

## How it lands

Four passes, each shippable on its own, in order of payoff-per-risk:

1. **Money lines up** — no layout or controls move, all seven number-bearing surfaces at once.
2. **One outline** — Budget Plan and Budget vs. Actual stop being two forks of the same thing.
3. **The three card lists become lists** — the only visible desktop shape change.
4. **The two grids agree, and the phone gaps close.**

Owner QA rides the ledger at §12 (Group 1C) after each pass.

## Success criteria

- A coach can move Budget Plan → Budget vs. Actual → Player Dues and not notice a change of visual
  language.
- Every money figure in the hub lines up on the dollar with every other figure in its column.
- No new sub-44px tap targets at 390px; no page scrolls sideways at any width.
- No table in the hub scrolls sideways on a phone without a visible hint.

## Decisions taken

All three calls were approved on 2026-08-13: the three-job model, converting all three card lists,
and running all four passes.

## What changed during the build that this brief did not predict

- **Payables now opens its deposit and balance behind a "Payment details" tap** instead of showing
  both inline. It is the only genuinely nested row in the hub, and flattening it into columns would
  have cost the two Mark-paid buttons their home. The row itself gained a plain-English status —
  *Scheduled*, *Part paid*, *Overdue*, *Paid* — so the summary is readable without opening it.
- **A settled balance stopped being green.** A roster where everyone had paid was a full column of
  success green saying nothing. Colour in the dues table now means "there is something here": green
  a credit, amber an amount owed, grey a nil.
- **The safety net that checks these screens had never actually looked at them.** The test team the
  automated layout check uses had no budget, no dues, no expenses and no fundraisers, so every Money
  screen was being checked as an empty page — and three tabs weren't checked at all. That is now
  fixed, and the moment it could see real tables it found four genuine problems, including one
  unreadable line of grey text on Budget vs. Actual that predates this work. **This is the more
  valuable half of the change**: every future edit to a Money screen is now actually verified.
- **One fix reaches beyond Money on purpose.** Small buttons at the bottom of a stacked card were
  never given a thumb-sized target, despite the shared rule claiming they were. Fixing it improves
  every list in the portal, on phones only.
