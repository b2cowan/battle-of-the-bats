# PM brief — The plan file reads back whole

**One line.** A coach can download their season budget plan, work on it in Excel, and import it back
without the money-coming-in half of it turning into spending.

## What we found once we looked

The reported problem was one of **three**, and the other two were worse. Exporting the season budget
plan and importing it back has not worked at all for over a week:

1. **Money coming in came back as spending** — the reported problem.
2. **Every cost line was silently dropped** — since 09 September, one day old when we found it. The
   file stopped marking a cost row as a line, so the importer read each one as a heading and threw it
   away.
3. **No row had an amount** — since 02 September, when the column was renamed to *Planned* and the
   importer was never told. Every row came back refused for want of a figure.

So in practice a coach doing this today would not even reach the problem the walk describes: they
would get a preview of nothing but refusals. All three are fixed together, because any one of them
alone leaves the file unusable.

## What a coach sees today

Download the plan. Import that same file. The preview shows every fundraising drive, sponsor and
tournament-revenue line as a **new line to add** — and if they press Import, each one becomes a
**cost** filed under a revenue heading. Planned costs jump by the size of the plan's own funding, the
plan double-counts (the real money-in line is still sitting there), and the team's word list quietly
gains "Chocolate Sale" as something the team *spends* money on.

Nothing warns them. Every row reads as a perfectly ordinary add.

## What a coach sees after

The same file imports as what it is. Cost lines come back matched to the lines they came from — an
update, not an add. Money-in lines do the same on their side. The preview marks a money-in row
**Funding** — the same word the file itself prints over those lines — so the coach can see the file
was understood before anything is saved, and the
name suggestions on those rows offer the team's money-in words rather than its costs.

A coach who builds a sheet by hand sees no change at all: a sheet with no band headings is read
exactly as it is read today, all costs.

## Why it matters

This is the round trip on the product's own file — the most trusted import there is, because the
product wrote it. A coach doing the ordinary thing (export, edit in Excel, import) currently ends the
day with a budget that overstates spending and a vocabulary list with words on the wrong side, and
neither is obvious afterwards. It is also the one import defect that gets *worse* the more the plan
is used: the more funding a team plans, the bigger the phantom.

## Who it affects

Head coaches and any coach with money access, on the Budget tab's Import door. No change for club
admins, families or the public site. No plan-tier gating change.

## Priority

**High, small.** It is a correctness defect on a live door with a real financial consequence, and it
is contained — one reader, one review step, one write path and a tag in the preview. No migration, no
new screen.

## Success criteria

1. Export the plan, import it back, commit: **nothing is added**, every line updates itself, and both
   the Planned costs and Planned funding totals are unchanged.
2. A money-in row that names a word the team does not have yet creates that word **on the money-in
   side**, where the coach will find it in the picker's money-in band.
3. A sheet with no band headings imports exactly as it does today.
4. A club that has genuinely named a category "Funding" or "Costs" still imports under it normally.

## Tradeoffs taken

- **No new column in the export.** The file already carries the two bands the screen shows, and the
  house rule is that an export's shape is its screen's shape. It also means the fix reaches files
  coaches already have on disk, not just files exported from tomorrow.
- **The blank template stays spending-only.** It says so in its own words today. Offering both sides
  in the template is a separate design question (dropdowns, the reference sheet, its prompts) and is
  noted, not smuggled in.
- **No way to flip a row's side inside the preview** in this build. The band heading is one row above
  it in the sheet; if that turns out to be a real friction in the walk, it is a small follow-up.

## How to test it

Coach sandbox or a real team: Budget → **Export** the plan (CSV or Excel) → Budget → **Import**,
choose that file, and read the preview. Every row should say *Updates*, money-in rows should be marked
**Funding**, and there should be no phantom line for a heading, a subtotal or the ladder.
Then commit and confirm the plan's two totals are exactly what they were before.
