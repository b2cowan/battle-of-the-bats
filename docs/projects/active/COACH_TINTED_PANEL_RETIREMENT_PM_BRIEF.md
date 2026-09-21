# PM Brief — the tinted panel retires

**Ruled 2026-09-21 · built on dev the same day · plan:** `COACH_TINTED_PANEL_RETIREMENT_PLAN.md` ·
hub https://claude.ai/artifact/Rj3qtLWpPXDQGUTPnmzBxF

## What a coach sees differently

The soft tinted surface (olive on the warm look, blue in dark mode) that framed panels and cards across
the coaches portal is gone. Everywhere it stood, the same two treatments take over:

- **Inside a form** — the bill's payment schedule, the repeating-dates list on Add Event — the block
  sits flat on the form, separated from its neighbours by space. Its heading, tools and totals bound it.
- **On a page** — Season's End's blocks, the link-a-club card, the week view's day columns, attendance
  rows, the lineup peek, a player's mini rows, and **every phone card in the portal** — a white card
  with a hairline.

Anything that was *selected, on, current or being dragged onto* keeps its colour: a pressed chip, a
chosen attendance option, the game console's current inning, a drag target, an active filter. Those
are states, not panels, and a selected thing still looks selected.

## Why it matters

One surface language: a card is white with a hairline, a section inside a form is flat. The tint had
been a third answer that meant nothing in particular — and in dark mode it read as blue.

## What it touches

The coaches portal only. The family and public pages paint the same tint on about twenty panels of
their own, and the tryout day cards on a dozen — same rule, a second wave with its own drawing.

## Trade-offs

- A few chips lose their fill and keep only a hairline (the roster's pitch chip, the scroll hint).
- The game console's identity chips (position, period, "who") keep their day-of palette for now —
  flagged, not swept.

## How to test

Owner QA walk §215 on the hub's QA Walk tab: Add a bill, Season's End, the schedule's attendance
list and week view, the roster on a phone, the link-a-club card.
