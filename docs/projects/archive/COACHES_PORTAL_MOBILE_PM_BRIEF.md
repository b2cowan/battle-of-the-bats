# PM Brief — Coaches Portal Mobile Pass

**What:** Make the Premium Coaches Portal genuinely usable on a phone, screen by screen, against one shared set of mobile rules — starting with Schedule, then Roster, Overview, and the rest.

**Why it matters:** Coaches use this at the field, on a phone. We built features desktop-first and kept deferring mobile, which left rough spots (a week view that scrolls sideways, a lineup grid where the player name scrolls off, event forms that are tall, touch targets that are a bit small). Rather than keep deferring, we're doing one focused mobile pass now while the Schedule is fresh.

**Good news / scope:** the portal is already *partly* mobile-friendly (the roster turns into cards, the event panel rises as a bottom sheet, the lineup grid scrolls, the team-at-a-glance cards stack). So this is mostly **tidying up and filling gaps**, not a rebuild — which keeps it fast.

**What the coach gets:**
- No more sideways scrolling to read the week — it stacks day-by-day.
- The lineup keeps the player's name pinned while you scroll across innings, with a clear "swipe" cue.
- Add/edit event and the event details open as proper bottom sheets, easy to reach with a thumb.
- Bigger, easier tap targets for attendance and actions; nothing hidden behind the bottom nav.

**How we're doing it:** lock the shared mobile rules once (done — design decision logged), build a few reusable building blocks, then sweep each screen as a small change with device testing per screen. Going forward, "works on mobile" is part of finishing any new section, so we don't fall behind again.

**Priority order:** Schedule (incl. attendance + lineup) → Roster → Overview → Tournaments/Announcements/Accounting/Documents/Settings. (Chat already had its own mobile fix.)

**Success:** on a phone, every screen reads cleanly with no horizontal scrolling, comfortable tap targets, and bottom sheets/action bars that clear the nav and home indicator.

**Effort:** small-to-medium per screen (mostly CSS + a couple of small layout branches); no database changes.
