# PM Brief — Where the buttons live in the Coach Portal

**Plan:** `COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md`
**Mockup (the spec):** `claude.ai/code/artifact/44162825-32ef-4744-90dc-7939ee635e9e`
**Priority:** high — it fixes one thing a coach genuinely cannot find today
**Status:** approved 2026-08-13, not yet built

---

## The problem in one paragraph

A coach moving between screens in the portal meets the same button in a different place, under a
different name, drawn a different way — or not at all. Inside the Money hub alone, "create the main
thing on this page" is a filled green button on Fundraisers and a plain white one on Budget Plan,
one tab apart. Import is a text link on two screens, a proper button on a third, and on Roster it
has no home at all. None of this breaks; it just quietly teaches a coach that the portal is
unpredictable, so they stop looking for things.

## The one real defect

**A coach cannot bulk-add players to a roster that already has players on it.** The feature exists
and works. It is offered on an empty roster, and it survives as a second door inside the Add Player
form — so after tryouts, when a coach has one player entered and fourteen to go, there is nothing on
the screen that says this is possible. Everything else in this project is consistency work. This
part is a coach doing an hour of typing that the product could have done for them.

## What changes for a coach

**The Money hub gets two permanent doors.** "Import" and "Export" sit in the Money header and never
change, whichever tab you're on. Each opens a short list of what you want to move — your budget,
your dues, your expenses, your fundraisers — so you no longer have to guess which tab hides the
export. Today only two of the seven tabs offer one at all.

**Every "add" button moves down to the thing it adds to.** "Add Line" sits with the budget, "Add
Expense" with the expenses. The tabs across the top go back to being purely a way to move around,
with nothing hanging off them. On five of the seven tabs the button joins a row that already exists,
so the page gets *shorter*, not longer.

**Roster gains an Import button** that stays put whether the roster is empty or full, and whether
you're in list or depth-chart view. Today the whole button group disappears when you switch to depth
chart, taking the export with it.

**Screens that had three buttons crowding the title get one.** On Plan templates, "New template" and
"Add from a past season" are two ways to do the same thing, so they become one button with a choice
inside it. "Your tags" moves down beside the search box, where the thing it filters actually is.

**On a phone, the portal stops offering things a phone can't use.** Spreadsheet exports and all
imports come off the phone header — a coach isn't importing a season budget from a sideline, and a
downloaded `.xlsx` goes into a folder they'll never open on that device. What stays is what a phone
is good at: PDFs you can read or forward, and "Add to calendar" on the schedule, which is arguably
the single most useful button in the portal at that size.

## The tradeoffs we accepted

**A feature disappears on phones, on purpose.** The importers were deliberately built with a
"paste your list in" mode *because* phones often have no file picker. Hiding Import on phones would
have silently retired that. The compromise: **the offer stays wherever a screen is empty** — a coach
who opens a blank budget on a phone is still shown a way in. It's only the permanent header button
that goes.

**A coach on a free plan may see no export button at all on some phone screens**, because the PDF
export is a paid feature and the spreadsheet formats have been removed from phones. We judged an
absent button better than a locked one, but it is a visible change for those users.

**We chose not to build a "Data Tools" page** like the tournament side has, even though the tidiness
argument for one is real. A club admin running a tournament is in a back-office frame of mind; a
volunteer coach checking something between innings is not. A destination would move the button away
from the moment someone realises they need it — you want to import a budget while staring at an
empty budget, not while browsing a tools page. We took the useful half instead: a "Recent imports"
entry inside the Import menu, so a coach can still see what was brought in and when.

## Why it matters

Consistency isn't a polish item here. The portal is used by volunteers who open it a few times a
week, often on a phone, often in a hurry. Every screen that arranges itself differently is a small
tax on someone who was never going to read a manual. Three of these buttons are currently in places
where a coach will simply never find them — which means features we built and shipped are, in
practice, not there.

## How to check it

- Open **Money** and click through all seven tabs. Import and Export should never move or change.
  The button that creates things should always be down with the thing it creates.
- Open a **roster that already has players**. There should be an Import button, and it should still
  be there after switching to depth chart.
- Open **Plan templates**. One green button in the header, and its dropdown should offer both ways
  to make a template.
- Open **Money on a phone**. No Import or Export in the header at all — just the title and help.
  Then open a **team with no budget yet** on the same phone: the empty budget should still offer to
  import one.
- Open **Schedule on a phone**. "Add to calendar" should be there.

## Success criteria

- A coach with a non-empty roster can find bulk import without opening the Add Player form.
- Every Money tab presents its create button in the same place, drawn the same way.
- No page header in the portal carries more than two buttons plus help.
- Nothing in the portal offers a spreadsheet download on a phone.
- Every empty state that could accept an import still offers one at phone width.
