# PM brief — Registration health as a button and a window

**What changes for the organizer.** On Teams, the "At a glance" card is gone. Registration health is a button at the top of the page,
first in the row, showing the score (green, amber or red) and a count of what needs fixing. Tapping it opens a window with the score
and a one-word verdict, four figures, and each problem with a "Show them" link that takes you to those exact teams. Whether
registration is open now shows as a small chip next to the division picker; tapping it opens a menu to close or reopen it.
Payments for the division is one slim line above the list, opening to the same detail as before. The team list starts about 140 px
higher. The dashboard's Registration card opens with the same score as its first row, opening the same window.

**Why.** Health was a drop-down inside the page, under a division picker while scoring every division. Schedule health already became a
button and a window for that reason (2026-10-19); this makes the two work the same way. A full-width row for one word ("Registration
open") was too much, but it held the only switch for closing a division, so the switch moved rather than disappeared.

**Who is affected.** Tournament Plus and above (the health button and the Payments line); the registration chip on every event with
registration, including one that its plan ended (the chip shows the plan's lock instead of the button). A free invite-only event is
unchanged: no health button, no chip, no Payments line.

**Trade-off accepted.** The page no longer names the problems in words ("4 missing an email") — it shows a score and a count, as
Schedule health does. The words are one tap away, and the dashboard's follow-up rows still say them.

**Priority.** Medium; a design-consistency change on a screen organizers use daily.

**Success.** An organizer finds Registration health where they find Schedule health; closing or reopening a division is still one
menu away; the score on the dashboard equals the score on Teams for the same event.
