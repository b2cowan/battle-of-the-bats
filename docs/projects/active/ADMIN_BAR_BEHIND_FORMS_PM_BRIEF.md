# Admin bar behind forms — PM brief

**Status:** built 2026-10-18; owner walk §332 passed 2026-10-19 — closed (the Chat step waits for chat to return). Plan: `ADMIN_BAR_BEHIND_FORMS_PLAN.md`.

## What changes

On a phone or a small tablet, every admin form window now opens **over** the bottom bar, so a tap that misses the
window can never land on a tab and leave a half-filled form. Almost every admin window already did this. Three did
not, and now do:

- **Chat → New room** (a tournament's chat). On a phone the only way in is the rooms list; that list now closes when
  you choose New room, as it does when you choose a room. Before, the window opened dimmed behind the list and could not
  be tapped until the list was dismissed.
- **Budget vs. Actual → a month's figure, and a line's plan** — on screens 641 to 900 pixels wide (a small tablet held
  upright). A phone was already right.
- **Rep teams → Shared library → an award's icon picker** — same widths.

The same change reaches the coaches portal on those tablet widths: its windows sit over the bar there too, as they
already did on phones, and the coach's **Saved / Couldn't save · Retry** word rises over a window with them, so a
failed save on a tablet is never hidden (caught by the review before it shipped).

## Why it matters

A form is where an admin is mid-task. A bar that stays live under it is one stray tap from losing the work. The rule
is the portal's own, ruled 2026-09-23: a form covers the bar, a menu (the More sheet, a picker) sits on top of it.

## What was deliberately not built

The coaches portal also hides its bar and freezes the page behind a form. For the admin that would have hidden a bar
that is already covered, and its page freeze does not reach the way the admin's phone page scrolls. Whether the page
behind an open form scrolls on a phone is checked in the walk first; a fix follows only if it does.

## Who sees it

Everyone who can open those windows: tournament admins (chat), club admins with accounting (Budget vs. Actual),
admins of a club's rep teams (shared library). No difference on a computer.

## Success

A build check now fails if any admin window is drawn under the bar, or if a new admin window appears without saying
whether it is a form (over the bar) or a menu. The walk passes on a phone: forms cover the bar, the More sheet still
sits on top of it.
