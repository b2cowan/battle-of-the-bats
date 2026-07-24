# PM Brief — Warm Coaches Workspace as a Theme Option

**All design decisions are ratified (2026-07-21, both mockup rounds approved). This brief covers
the build that delivers it.** Plan: `WARM_PORTAL_THEME_OPTION_PLAN.md`.

## What coaches get

A coach who prefers the warm cream look picks it once under Account → Appearance, and their whole
workspace follows: overview, roster, schedule (including the calendar, event editor, and RSVP
flow), money pages, lineup builder, depth chart, documents, settings — and team chat, which wears
the same warm skin it already has in the consumer app. Tryout-day screens go warm too, with the
sunlight rules built in (solid fills, bold text, clear labels — designed to stay readable on a
phone in direct sun). Coaches who like the current dark workspace change nothing and see nothing
different — dark stays the default forever.

## The one product rule that shapes the rollout

**No coach ever sees a half-converted workspace.** The warm option won't appear for the coaches
workspace until every screen in it is ready — the work happens behind the scenes in stages you
can review privately, then switches on for everyone in a single release. Until that day, the
Appearance setting only governs the consumer app (and its wording says so honestly).

## What was decided in the mockup rounds (now binding)

- The overall warm look for every screen (round 1) and the hard screens (round 2: event editor,
  RSVP panel, month calendar, drag-and-drop lineup builder, depth chart).
- Four small design rules that make warm work: one consistent red for lineup conflicts, an
  olive-tinted playing-time heat map, the depth chart's three tints (olive = best, blue = okay,
  red = never), and a deeper legible gold for the A-squad star.
- Team accent colors stay decorative accents with safety guards for extreme colors (near-white,
  near-red).
- Organization brand colors never reach the workspace — that was settled during the cleanup:
  internal tools stay platform-styled; org branding is a public-page promise.

## When it happens

After the theme switcher ships on the consumer app and the color cleanup finishes in the coach
screens (both already in motion). This is deliberately the last, largest piece — the riskiest
screens are built last, each finished whole, with a design-fidelity check against the approved
mockups at every stage.

## How you'll test it

Each stage lands privately on dev for your review; the checklist per stage is simply "does it
match the approved mockups, and does dark look untouched?" The final release check: pick Warm,
open every section of a real team, and find zero dark leftovers; pick Dark, and find zero
changes anywhere.
