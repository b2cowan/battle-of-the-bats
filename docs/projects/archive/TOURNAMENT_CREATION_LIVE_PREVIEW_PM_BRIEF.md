# Tournament Creation Live Preview — PM Brief

**Status:** Planned (green-lit 2026-08-02). Plan: `TOURNAMENT_CREATION_LIVE_PREVIEW_PLAN.md`.

## What the organizer sees

On a desktop screen, the tournament setup wizard gains a phone-shaped live preview beside the
form. As they type the event name, it lands in the hero of their future public page. As they set
dates, the date range forms and a countdown appears — "First pitch in 21 days." By the time they
click Save, they've watched their actual public fan page assemble itself from nothing. On phones
and small screens, the wizard is exactly as today.

Organizers reusing a past event's setup get an even better moment: the preview appears already
filled in the instant the wizard opens.

## Why it matters

Every competitor asks an organizer to trust that "it'll look good later." This proves it live,
before a single record is saved — the strongest possible first impression during the exact
minutes a skeptical volunteer decides whether to trust us with their season. It turns setup from
form-filling into a small magic trick, and it markets the public page (our most shareable
surface) to the person about to create one.

## Tradeoffs made

- Desktop-only for v1 — the side-by-side moment needs width; small screens keep today's wizard.
- The preview shows the page top (hero) only — enough for the wow, small enough to keep
  faithful as the real page evolves.
- The colour-swatch "repaint it live" beat from the mockup is deliberately parked: custom
  colours are a paid feature, so showing them during free signup is a pricing decision the
  owner makes separately, not a default.

## How to test it (owner QA)

Open Create Tournament on a wide desktop window: type a name, set dates, watch the phone update.
Repeat via "reuse a previous tournament setup" and confirm the preview arrives pre-filled.
Narrow the window below ~1280px and confirm the wizard looks exactly as it does today.

## Success criteria

The preview never disagrees with the real published page for the elements it shows; the wizard's
existing flows (blank + reuse) are unchanged in behaviour; no layout regressions at any width.
