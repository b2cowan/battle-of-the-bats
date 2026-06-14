# PM Brief — Playoff Bracket Builder: make it findable, make manual games connect

**Status:** Planned · 2026-06-11 · dev only, no database change
**Plan:** [PLAYOFF_BRACKET_BUILDER_UX_PLAN.md](PLAYOFF_BRACKET_BUILDER_UX_PLAN.md)
**Builds on:** [PLAYOFF_MANUAL_AND_TIERS_PLAN.md](PLAYOFF_MANUAL_AND_TIERS_PLAN.md)

## What this is
A free-tier organizer can already build a real playoff bracket by hand — but almost nobody finds it,
because the tool is buried inside a button called **"Auto"** that looks like a paid feature. And the one
button they *do* reach for, **"Add Game,"** can't connect bracket games together, so DIY brackets come out
as a meaningless list of games. This change surfaces the builder as the obvious way to make a bracket and
fixes Add Game so a single game can point at "Winner of Game 1" or "Seed #5."

## What the customer sees differently
- **A clear starting point.** On the Playoffs → Bracket screen, an empty bracket now shows a friendly
  prompt with a **"Build Bracket"** button — and a one-click **"Start from standings (1 v 8, 2 v 7…)"**
  option that lays out a sensible first round to edit. No more hunting in the "Auto" menu.
- **Add Game that actually works for brackets.** When adding or editing a playoff game, each side can be
  set to a real team **or** a placeholder like *Seed #3*, *Winner SF1*, or *Loser SF1* — so the bracket
  lines connect and winners advance automatically as games finish.
- **No more confusing "Auto" framing.** The "Auto" menu now holds only the paid automation
  (auto-scheduling). Building a bracket is free and lives on the bracket screen where it belongs.

## Role / plan differences
- **Free (Tournament) organizers:** can build and edit full playoff brackets manually, by hand-entering
  dates/times — this was always allowed, just hidden. Now discoverable.
- **Tournament Plus / League / Club:** unchanged extras — one-click **auto-scheduling** of bracket
  dates/times/venues and **tiered auto-split**. These stay clearly marked as upgrades (locked with an
  upgrade prompt for free orgs).
- No change for players, coaches, or the public — only the admin bracket-building experience.

## Why it matters
The capability shipped but wasn't paying off because it was invisible and the obvious DIY path was broken.
This converts an existing-but-unused free feature into something organizers actually succeed with,
strengthens the free tier's credibility, and keeps a clean, honest upgrade line: **building** a bracket is
free; **auto-scheduling** it is paid.

## Customer impact
- Removes a real dead-end (manual brackets that don't connect) that makes the product look broken.
- Lowers the support/confusion burden around "how do I make a playoff bracket?"
- Makes the free → Plus upgrade story crisper (manual vs. automated), without taking anything away.

## Priority
Medium-high. Small, additive, no migration, low risk — high payoff for free-tier credibility and the
in-flight free-tier program.

## Success criteria
- A brand-new free org can create a connected, correct playoff bracket without opening the "Auto" menu.
- A single game added/edited via Add Game can reference Seed #N / Winner / Loser and advances correctly
  when its source game completes.
- Paid auto-scheduling and tiered split remain clearly upgrade-gated and functional.
- No regression to existing brackets, scheduling, or advancement.
