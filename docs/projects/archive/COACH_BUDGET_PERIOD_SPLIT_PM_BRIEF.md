# PM Brief — Budget Line Period Split

**Plan:** `COACH_BUDGET_PERIOD_SPLIT_PLAN.md` · **Mockup (binding):**
https://claude.ai/code/artifact/590648f2-6440-4ae2-a3e1-4f0111805d0c
**Who it affects:** any coach with money-write access on a paid team, on one screen —
Money → Season Budget Plan → adding or editing a budget line.

## The problem, in the owner's words

Three things were wrong with the same form, all found in one sitting:

- Pressing **Save Changes** appeared to do nothing. The reason it refused was printed in a thin strip
  at the bottom of a form that scrolls, so it was usually off-screen. The honest first conclusion is
  that the button is broken.
- The form insisted on a **label for every payment period** — a name the coach had to invent for
  something that already had a date on it.
- Every period needed an **exact date**. That suits a tournament entry fee. It does not suit an annual
  budget, which coaches think about in months or quarters — and which cost twelve trips through a
  date picker to enter.

## What a coach does differently

Ticking **Split by period** now asks one question first: *how is this line split?* — by **months**,
**quarters**, **specific dates**, or **just names**. Then they add periods one at a time, exactly as
before.

Each period row carries its own picker for whichever unit they chose. A twelve-month budget is now
twelve taps on "Add period" — the month advances itself, Feb, Mar, Apr — followed by **Split evenly**.
No typing at all. "Fill the season" does it in one click.

The **label is optional**. A period with a month, quarter or date names itself: *Apr 2027*, *Q2 2027*,
*Mar 14, 2027*. The name it will be given shows greyed in the label box, so nothing is a surprise, and
a coach who wants to call it "Spring tournament" still can.

When a save can't go through, **the form moves**: it scrolls to the offending row, outlines it, puts
the cursor in it, and a counter appears beside the Save button that stays on screen no matter where
the coach has scrolled. Clicking the counter jumps back to the problem. The only things that can now
block a save are the ones that are genuinely wrong — a missing amount, or amounts that don't add up
to the line total.

Bulk actions — filling the season, clearing the periods, or switching split mode — **happen
immediately and leave an Undo**, rather than stopping the coach with a confirmation box.

## Why it matters

The budget is the first real work a coach does in Money, and the period split is the most laborious
thing in the product to type. It is also the screen where a coach decides whether this software is
worth the subscription. A form that appears broken on first use, on the screen that sells the module,
is expensive in a way no error log records.

The change also improves what everyone downstream sees: **Budget vs. Actual** and the month grid now
receive real month names instead of whatever was typed at 11pm, and month-mode periods land in month
columns by construction.

## Customer impact

- **Coaches on paid teams:** materially less typing, and a form that explains itself when it refuses.
- **Read-only assistant coaches:** no change — they never see this form.
- **Everyone else (parents, org admins, tournament customers):** no change.
- **Existing budgets:** untouched. A line saved before this change opens in whichever mode matches
  what it already holds, and nothing is rewritten unless the coach saves.

No price change, no plan-gating change, no new permission.

## Priority

High for a small piece of work. It is three owner-reported defects on one screen, it needs no
database change and no new API, and it removes the single largest data-entry cost in the Money module.

## Success criteria

1. A coach can enter a twelve-month budget without typing a label or opening a date picker.
2. A save that cannot go through visibly moves the form and names the row at fault.
3. No coach is ever blocked from saving by a missing label or a missing date.
4. Budget vs. Actual and the month grid show the same numbers as before for every existing line.

## Known limits, accepted

- The first period defaults to **January**, because the season year is the only thing the platform
  records about a season. Clubs running Sep–Aug will correct it each time.
- **Changing split mode clears the periods.** Deliberate, per owner ruling — a mode change is a fresh
  decision about how the line works, and the Undo makes an accidental tap cheap.
- Two periods may sit in the same month without comment. Legitimate for two payments; also an easy
  slip we've chosen not to police.
