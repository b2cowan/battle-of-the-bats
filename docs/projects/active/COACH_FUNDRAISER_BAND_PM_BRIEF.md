# PM Brief — The Fundraiser Opens In Place

**Companion to:** `COACH_FUNDRAISER_BAND_PLAN.md` · approved mockup: Artifact "Fundraiser
Drill-In Redesign" (round 3) · planned 2026-08-31

## What the coach sees and does differently

Today, opening a fundraiser leaves the Fundraisers list for a separate screen: its own header,
back link, four summary tiles, and a leaderboard that draws **every roster player** — so a drive
with one logged amount shows a dozen rows of dashes, a dues figure that belongs to another tab,
and a floating "15% player rebate" line above a large empty band.

After this change, the fundraiser opens **right inside the list**, the same way a sponsor does.
Click the drive's row and it unfolds beneath: one quiet facts line (the credit rule, "3 of 12
players logged", the dates, the tags), one row per **amount actually logged** — largest first,
which is the leaderboard — and two buttons: **Record** (log money, through the same recording
window used everywhere) and **Edit** (name, credit %, dates, status, tags, delete). Correcting or
removing an amount happens on its own row, in place. Nothing to navigate back from; the sponsors
sit right below; the whole Money tab now behaves as one surface with one habit.

## Why it matters

- **The tab reads as one thing.** Drives and sponsors stop having different manners; a coach
  learns one gesture (open the row) for every money-in record.
- **A drive looks like what it is** — a short list of money that came in, not a wall of empty
  roster slots. The "basic amount of information" no longer needs a whole separate place.
- **A real oddity goes away:** money logged for a player who later leaves the active roster
  currently vanishes from the board while staying on the books (it once made a drive impossible
  to delete, with instructions pointing at rows that weren't visible). Now every logged amount
  stays visible, with a small "no longer on roster" note.
- **Clearer words:** the confusing "Left to send" column (it was the family's overall dues
  balance) is removed; "rebate" becomes **credit** everywhere a coach reads it, matching the rest
  of Money; the drive's settings door says **Edit** like the sponsor's does.

## What doesn't change

Recording money (same window, same where-it-lands preview), the rules for closed drives (no new
money; corrections still allowed), the guarded delete, exports, the season summary tiles, and
phone behaviour. No data changes shape; nothing moves on the books.

## Tradeoffs accepted

A fully-participated drive opens tall — one row per player who took part — and scrolls with the
page. The Rank column goes (largest-first order says the same thing). If real usage shows a coach
living inside one big drive every day, a dedicated drive view can come back later.

## How to test (owner QA, new § after build)

In the coach sandbox or a dev team: open Money → Fundraisers. Open and close a drive from its
row; deep-link into one from the Budget month view and from a family's dues drawer and confirm it
lands open and scrolled; record an amount; edit an amount's value and its date; remove an entry;
try a closed drive (Record gone, edit-amount dead, remove alive); delete an empty drive from
Edit; check the phone layout stacks cleanly; confirm the in-app help and the demo tour still
describe what's on screen.

## Priority and success

Medium-high within coach money polish — it retires the last money-in record with a separate
screen and closes three confusions the owner hit in one sitting (title/tags weight, the floating
rebate line, "left to send"). Success: a coach can run a whole drive — create, log, correct,
close, delete — without ever leaving the Fundraisers list, and nothing about the books changes.
