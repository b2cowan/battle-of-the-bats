# Coach Budget Import — the sheet teaches its own vocabulary — PM Brief

**Status: plan drafted and owner-approved 2026-09-06, not yet built.** Companion to
`COACH_BUDGET_IMPORT_VOCABULARY_PLAN.md`. No migration, no pricing or plan-gating impact.

## What a coach or team treasurer sees and does differently

**Today**, someone bringing a budget in from a spreadsheet downloads our template and finds the
right column headings plus **six** example rows — six of the forty-to-seventy cost names their team
can actually use. Everything else they type from memory. If they get a **category** wrong, we stop
them and make them fix it. If they get a **cost name** slightly wrong — "Tourney Fees" instead of
"Entry Fees", or the same words with a hyphen or a double space — we accept it silently and quietly
mint a brand-new cost name for that team. Nobody is told. From then on the team's budget and its
Budget vs. Actual report carry two words for one thing, and the spend is split across both.

**After this change:**

- **The Excel template comes with the full list.** A second tab shows every category and every cost
  name the team may use, and where each one came from — the standard library, something the club
  published, or a word this team invented. Amounts stay blank throughout; we still never put a
  figure in anyone's budget.
- **The Category and Cost name columns become dropdowns.** Pick from the list instead of typing.
  Typing is still allowed — a coach with a cost we have no word for must be able to name it — but
  nobody has to spell ours from memory any more.
- **The review screen catches the near-misses.** Before anything is saved, a row that would create
  a new cost name says so, and where we can see what they probably meant it offers it: *"New name —
  did you mean Entry Fees?"* with a one-tap fix. Where the name already exists under a different
  category, it says that instead.
- **Trivial spelling differences just work.** A hyphen, a double space, a trailing full stop or a
  stray capital now lands on the existing cost name rather than creating a second one — and the
  corrected spelling appears in the preview, so the coach can see what happened and undo it before
  importing.

## Why it matters

This is a silent data-quality leak on the one screen a club treasurer is most likely to judge us
on. A budget that reads "Entry Fees $4,000" and "Tourney Fees $1,200" as two separate lines isn't
wrong by much, but it is exactly the kind of wrong that makes someone stop trusting a report — and
it happens *because* the product accepted their typing without comment. Cleaning it up afterwards
means finding the item-merge door, which most people won't.

It also lowers the cost of the very first thing a new coach does with our money tools. Importing an
existing spreadsheet is how a team arrives with a budget already written; the less of our vocabulary
they have to guess at, the fewer of them bounce off that step.

## What does NOT change

- Nothing is taken away. An unrecognised cost name still imports and still creates the word — that
  path exists because a line with no cost name is invisible to Budget vs. Actual, and it stays.
- No new blocking. Everything added here warns; only the existing category rule refuses a row.
- No figures. Neither the template nor the new reference tab ever suggests an amount.
- Templates people already downloaded still import.
- The **CSV** template is unchanged — a CSV file physically cannot carry a second tab or a dropdown.
  Those coaches are covered by the review-screen warnings instead, which is the half that works no
  matter where the spreadsheet came from.

## Tradeoffs taken

- **The cost-name dropdown lists every name, not just the ones under the category chosen in that
  row.** Making it depend on the category needs Excel formula tricks that break on category names
  containing "&" and break again in Google Sheets. A flat list still eliminates the typo, and the
  review screen catches a mismatched pair with a clearer message than a greyed-out cell would.
- **Near-matches are suggested, never applied automatically.** "Entry Fee" and "Entry Fees" might
  genuinely be two different things; that call belongs to the coach, so it's one tap, not silent.

## A correctness fix riding along

The importer currently matches a cost row against **both** sides of the books, so a spending row
can attach itself to an income word like "Grant" or "Sponsorship" — even though the picker a coach
uses on screen only ever shows one side at a time. Same twenty lines of code, fixed in the same
pass. It also removes a rare failure where two same-named words on opposite sides made an import row
fail with an error a coach could do nothing about.

## Priority

Medium. Nothing is broken for a customer right now in a way they'd report — the damage is quiet and
cumulative, which is precisely why it hasn't surfaced. Worth doing before the coach money surfaces
get more traffic, and it's a contained change with no schema impact.

## Success criteria

- A coach can build a complete, correctly-named budget in the template without typing a single one
  of our cost names from memory.
- A spelling that differs only by punctuation, spacing or case lands on the existing cost name — and
  the coach can see that it did, before importing.
- No new cost name is ever created without the coach being told, on screen, before it happens.
- A genuinely new cost still imports in one pass, with no extra steps.
- Every existing export in the product downloads exactly as it does today.
