# Categories & Items Door — PM Brief

**Status: approved off mockup round 4b and building on dev, 2026-09-09.** Companion to
`COACH_BUDGET_CATEGORIES_AND_ITEMS_DOOR_PLAN.md`. Mockup (all rounds on one link):
https://claude.ai/code/artifact/43698c62-e5db-41c2-a6b3-70735a64e1fd

## What a coach sees and does differently

**Today** the Budget Plan has a button called *Manage our words*. It opens a dialog that lists every
standard heading first, then the coach's own items, then every standard word — sixty-odd rows in a
box that cannot scroll. On the demo team the only two rows a coach can change sit just below the
box's bottom edge, so the dialog reads as "my item isn't editable". The button also hides until the
team already owns an item, so a coach setting their vocabulary up before the first line has no door
at all. And, found on the way: the "+ Add custom category" step inside every money form has been
refused by the server since 2026-09-04 with a developer-worded error, so no coach has been able to
create a category for five days.

**After this change** the button reads **Manage categories & items** and opens a dialog called
**Categories & items** that:

- **Reads by side.** Two bands in the Add Line form's own words — *Money coming in* first, then
  *Money the team spends* — with each heading nested under the band it belongs to and its items under
  it. No row carries a "Money in / Expense" tag any more; the band says it. A heading that holds both
  kinds (Tournaments does) appears under both bands with only that side's items, exactly as the plan
  and the picker already read it.
- **Shows what is yours by default.** Filter chips use the same three words as the picker's chips —
  *Our own*, *Club*, *Standard* — plus *Everything*. *Our own* is the default, so a coach sees their
  own headings and items at once; the shared library is one tap away instead of on the page. A search
  box finds any heading or item by name.
- **Explains a grey bin on the row.** Each of your items shows what is filed against it ("2 budget
  lines · 1 recorded cost" or "Nothing filed yet"), which is why its bin is on or off.
- **Lets you add here.** Each band carries one **+ Item** link. The form asks two things, *Category*
  and *Item name*, in the words the form already uses. The category list puts headings already
  taking this side first, then every other heading labelled *"Not taking money in yet — pick one and
  it will"*, then *"+ New category…"* last — so a coach whose heading shows under the other band
  picks it rather than making a twin. Choosing New category unfolds one more field, and the heading
  is saved together with its first item. The side is never asked; it comes from the band you tapped.
- **Says where the money reports, in one line,** under the form: "Will report under Bake sales", and
  a note that only Fundraising and Sponsorship have a drive or a sponsor filling the number in.
- **Lets you remove an empty heading of your own.** Same rule as an item: only while nothing sits
  under it. Standard and club headings stay read-only.
- **Has a second door where you need it.** The item picker inside Add Budget Line, Record a cost, the
  club-bill filing and the fundraising form gains a last row, *Manage categories & items…*, the way
  the tags dropdown already has *Manage tags…*.
- **Scrolls.** The dialog's body scrolls on desktop and on the phone sheet.

## Why it matters

The vocabulary is the join between the plan and real money: every roll-up, variance and report keys
on the item. The one place a coach can tidy it was unreachable in practice, buried the editable rows
under sixty read-only ones, and the only way to create a heading had silently broken. This makes
tidying and adding a deliberate, findable act, in the words the rest of the screen already uses.

## What does NOT change

Who may edit what (standard and club rows stay read-only for a coach; the club renames its own from
Org Budget). Rename stays retroactive. An item with anything filed against it still cannot be removed,
only renamed or folded into a shared item. No item ever moves between sides. No totals, reports or
plans change. The demo sandboxes carry no sentence about this door, so nothing there goes stale.

## Priority and success

**Priority: high** — a live defect (category creation refused) plus a dialog that hides its purpose.
**Success:** a coach opens the dialog on the demo team and sees *Practice Gear* under *Money the team
spends* without scrolling; adds a money-in item under their own heading and sees that heading appear
under *Money coming in*; creates a new heading with its first item from a money form and from the
dialog; and the widened guard fails the build if any coach dialog on the scrolling recipe forgets to
name its scrolling pane.
