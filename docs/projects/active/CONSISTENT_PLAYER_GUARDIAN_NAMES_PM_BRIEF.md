# PM Brief — Consistent First + Last Names for Players & Guardians

**One-liner:** Capture player and guardian names as **first + last** everywhere (free portal, Premium, tournament registration) instead of one free-text box on the free side — so names are clean at the source and carry over perfectly on upgrade, with no "we guessed your name split, please check it" step.

**Plan:** [CONSISTENT_PLAYER_GUARDIAN_NAMES_PLAN.md](CONSISTENT_PLAYER_GUARDIAN_NAMES_PLAN.md) · **Related:** [COACH_PREMIUM_UPGRADE_FLOW_PLAN.md](COACH_PREMIUM_UPGRADE_FLOW_PLAN.md)

## Why it matters

The free Coaches Portal stores a player (and their guardian) as a single name box; Premium stores first and last separately. So when a coach upgrades, we have to *guess* where the first name ends and the surname begins, and we honestly flag the ones we're unsure about — a small "please check these names" chore the coach shouldn't have to do. Collecting first + last from the start removes the guess entirely and gives cleaner names everywhere they're used (rosters, lineups, exports, sorting).

## What changes for the user

- **Free portal:** the roster's single "Player name" box becomes **First / Last**, and the same for the guardian. **Last name is optional**, so single-name players still work.
- **Premium portal:** last name becomes optional too (it's required today), so the two sides match; the add-player form also stops forcing a guardian when there isn't one.
- **Upgrade:** names come across exactly as entered — **no "uncertain name" item** in the post-upgrade "check these" list.
- **Everywhere else** (exports, lineups, emails): names show and sort correctly under the two-field model, including when there's no last name.

## Tradeoffs

- One extra field per player and per guardian on the free roster — a small bit more typing, in exchange for clean data and a smoother upgrade. (Accepted.)
- Best done **before the coach product launches**, while there's essentially no real data to convert (verified: only a handful of test records exist, nothing on production) — so it's a clean, low-risk change now and avoids converting names at scale later.

## Scope notes / open decisions

- **Tournament registration rosters:** confirmed as in-scope if they capture player names as a single field (first build step verifies the exact spot).
- **The registrant/coach name** (the person registering a team) is a coach, not a player/guardian — flagged for a quick owner decision on whether it gets the same treatment.
- **Guardian becomes optional** in the Premium add form (to match the free side) — bundled here as part of "consistent across the board"; confirm.

## Priority & effort

Medium effort, bounded; the free portal is the bulk, Premium is a light touch, and the upgrade flow actually gets *simpler*. Recommended **before coach-product launch**. Not a blocker for anything already shipped.

## Success criteria

First + last (player and guardian) everywhere, last name optional and working for single-name players; upgrade carries names 1:1 with no name-check step; names render/sort/export correctly with blank last names; the few existing single-name records convert cleanly.
