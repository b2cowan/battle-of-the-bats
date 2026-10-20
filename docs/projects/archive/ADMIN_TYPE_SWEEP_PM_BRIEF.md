# Admin type sweep — PM brief

Hub: https://claude.ai/artifact/QcQCe3yy4oqRUnUEf9uMCb · Plan: `ADMIN_TYPE_SWEEP_PLAN.md`

**What changes.** The last of the old console lettering leaves the club and tournament admin: the
typewriter font, ALL CAPITALS and extra-wide spacing on headings, buttons, labels and numbers. Those
places read in the same normal font and sentence case as the rest of the new look. "ROUND 1" becomes
"Round 1", a "DONE" button becomes the standard "Done" button, "Open Registration" becomes "Open
registration", and a health score reads like any other number. Small capitals stay only where the new
look uses them on purpose: the small label above a figure, table column headings, band headings and
chips.

**Why it matters.** September's new look changed the colours on many screens but not the lettering, so
those screens look half-finished next to the ones that were redrawn. The owner caught it on the bracket
editor on 19 October. Our build checks look at colours and old code, not lettering, so nothing flagged
it. A guard that refuses old lettering stops it from creeping back.

**Customer impact.** Everyone who uses the admin: club owners, treasurers, registrars, tournament
directors and volunteers at the scorekeeper and gate. About 370 places across about 40 screens, plus
the top bar every screen shows. The change is to looks and wording only. No feature, workflow or data
changes. Help articles that quote a button's wording change along with it. The top bar, notifications
and help drawer are shared with the coaches portal, so coaches see those few changes too (ask A6).

**Priority.** Polish before the Club release. It goes in stages: every screen's frame first, then the
tournament admin starting with the bracket editor, then the club screens, then consistency fixes inside
the new look itself, then removal of the dead old styling. Chat (paused), the "Send feedback" window
(its own project) and the old message window (One Window Stage 3) are left to their owners.

**Success criteria.** No old lettering left on any admin screen outside the allowed roles. The build
check holds that at zero. Each stage's owner walk passes in Warm and Dark, on a computer and on a phone.
