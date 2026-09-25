# PM brief — Notifications on a phone: one row, a page that knows where it is, and messages you can finish reading

**Priority:** small, high-frequency polish on the coach's only notifications screen on a phone.
**Status:** all of it ruled and built on dev 2026-09-25; the owner's walk is owed. Mockup: https://claude.ai/artifact/CNimUy8dmco8thDa778zND

## What changes for the coach

- **More of the feed on screen.** The settings gear no longer takes a row of its own. It's a plain icon
  beside the "?" in the title row. "Mark all read" sits beside Unread / All, next to the list it marks.
  The first notification starts 56px higher on a phone.
- **A switch that looks like a switch.** Unread / All is the same two-part control the coach already
  uses on Roster (List | Depth chart), instead of a faint toggle whose chosen half looked like a blob.
- **The page says where you are.** On this page the bottom bar now lights More, and the Notifications
  row inside More is marked, the same as every other page you open from More. Before, nothing was
  lit, and the page felt off the map. There is deliberately **no back arrow**: every arrow in the
  portal goes up to a page it names, and Notifications has no page above it.
- **Desktop:** the gear is a plain icon beside the "?" there too. "Mark all read" moves down beside
  the filters. Nothing wraps.

## Why it matters

A phone is the coach's only way to read notifications (there's no bell panel at that width). This is
the screen they open from More every time something happens, so the rows above the list are
paid for on every visit.

## A tap opens the notification (D3, ruled B)

- **Tap any notification and it opens** over the list: the whole message, the day and the time it
  arrived, and one button on to the place that deals with it, named for where it goes ("Open
  Insights", "Open Schedule", "Open the practice plan"). Close it and you're still on Notifications.
- **Opening it marks it read.** So a coach can read one and put it away without leaving the page.
  That's the owner's reason for choosing this, and nothing offered it before.
- **Every message can now be read whole on a phone.** The weekly review is still cut to two lines
  on the row, but the reader shows the rest, including older weeks. Before, those were cut
  mid pitching-cap warning with nowhere to read the rest, because Insights shows the team today.
- **A Needs attention item** can be cleared from inside the reader as well as from its row.
- **A grouped row** ("17 scores submitted") opens as its list.
- **The trade-off, accepted:** reaching the page a notification points at now takes two taps (open,
  then the button) instead of one.
- **Unchanged:** the desktop bell's drop-down (a quick glance; a tap there still goes straight to the
  page) and the admin notifications page.

## Success criteria

- On a phone, the first notification sits one row higher than before, with no control lost.
- On the Notifications page, the bottom bar shows More as the current section.
- Every notification's full text can be read on a phone, and one can be marked read without leaving
  the page.
