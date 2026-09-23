# Money on a phone — PM brief

**Plan:** `COACH_MONEY_PHONE_PLAN.md` · **Hub:** `https://claude.ai/artifact/BC3Vx5H4YtVA8UdPJyJZRa`
**Status:** built on dev 2026-09-22. Owner walk owed before commit.

## The problem in one sentence

A coach who opened the team budget on their phone saw a summary, a warning and three rows of
buttons — and the first budget line was rendered **below the bottom of the screen**.

Not "had to scroll a bit". At rest, on a 390×844 phone, the budget tab showed no budget. Budget vs.
Actual had the same defect 34px deep. Money was the one part of the Coaches Portal that had never
had a phone pass — it was measured during the phone programme and deliberately deferred as "its own
walk later". This is that walk.

## What a coach sees now

**The summary reads two across instead of stacked.** The same three or four figures, each with a
short qualifier instead of a sentence. On Budget Plan the closing balance — the season's verdict —
takes the full width underneath the other two.

**The control row is shorter.** The two view controls stay visible; export and the add button stay
visible; *Collapse all* and *Manage categories & items* moved into a "⋯" that opens a drawer from
the bottom of the screen.

**Result:** the budget tab now opens with real budget lines on screen. Budget vs. Actual shows its
statement. Every Money tab's summary is the same height for the first time.

Nothing was removed. Every control still exists and every figure still shows. The desktop and tablet
versions are unchanged.

## Who it affects

Every coach and treasurer using a phone, across all six Money tabs — Budget Plan, Budget vs. Actual,
Player Dues, Fundraising, Club and the Ledger. Read-only coaches get the same improvement with
fewer entries in the drawer.

## Why it matters commercially

Money is the Premium tier's headline capability and the one a treasurer evaluates hardest. It is
also the part of the portal most likely to be opened standing in a parking lot rather than at a
desk — and until now it was the only part that had never been designed for that.

## Tradeoffs taken

**Export and the category tools are one tap further away on a phone.** Neither is a thing done at a
field, and both are exactly where they were on a desk.

**Six captions are shorter on a phone.** Some detail moved out of the summary into the table
beneath it, where a coach can act on it. The desk wording is untouched, so nothing was lost on the
screen that has room for it.

**The add button kept its words, so the control row is two lines rather than one.** This was a
reversal made after seeing the built screen: the Money page header already shows a lime "+" for
*Record money*, and a second identical lime "+" for *Add Line* gave one screen two different
actions wearing the same glyph. The words are worth the extra line. The one-line version becomes
available if the header's button is ever re-weighted.

**Fundraising and Club sit slightly taller than the rest** because one label on each wraps.
Shortening a label is a renaming decision, not a layout one, so it was left for a separate call.
Neither tab was ever failing.

## Success criteria — met

- ✅ Budget Plan and Budget vs. Actual show real content above the bottom bar at both 361 and 390.
- ✅ Every Money tab's summary is the same height on a phone (291–405px before; 176–193 now).
- ✅ No control lost, no figure made unreadable, nothing overflowing at the narrowest supported width.
- ✅ Nothing above 640px changed — proven by the layout sweep at 768 and 1440.

## What is still owed

- **Your walk on a real phone.** Nothing is committed until then.
- Player Dues' control row stays two lines — its view switch is a separate design call.
- The Ledger's control row is untouched; its date range genuinely needs a full-width line.
- **The Money tables** are the other half of "Money is a book on a phone" and are a separate piece
  of work with their own drawings.
