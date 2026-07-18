# PM Brief — Live Tournament: Playoff Moment + Home/Standings Polish

**One-liner:** Make the moment the playoff bracket is set feel like an event — a home-page hero takeover, a push notification to fans and staff, and a shareable "Playoff Picture" — plus three fan-page polish fixes.

**Status:** Built on dev (unpushed), tested against a mirror of the live Battle of the Bats. Needs a dev-server restart, then owner browser testing. One small database change is applied to dev and still needs to go to production before release.

## What the customer sees

**When the bracket is set (automatic):**
- The tournament home page **transforms into a "Playoffs" hero** — a bold badge, "The Bracket Is Set", and a live countdown to the first playoff game, with buttons to the Playoff Picture and the bracket.
- A **push notification** goes out once: to fans who turned on team score alerts ("🏆 The playoff bracket is set!") and to the organizer's staff.
- A new **Playoff Picture** page — a shareable, article-style summary of the seeding: a short write-up, standout-team callouts (top seed, best offense, stingiest defense, best run differential), the full seed list with the playoff cut line marked, and the opening matchups with real team names filled into the "Seed #4 vs Seed #5" slots. There's a Share button so organizers and parents can spread it.

**Fan-page polish:**
- **Home:** the redundant small "Today's Games" box is gone; the better-looking "Upcoming Games" section plus "Latest Results" now carry the day-of view.
- **Standings on mobile:** every column (W, L, T, Runs For/Against, Run Diff, Points) is now viewable by swiping sideways, with only the team name frozen in place — no more hidden columns.
- **Run differential:** now shows the true differential with the playoff-seeding value in brackets when a cap is set — e.g. `+10 (+7)` — so it's clear why a team with a big win margin can still be seeded lower. (This only appears when the organizer has set a max run-differential; Battle of the Bats hasn't, so it shows a single number there.)

## Why it matters
The playoff bracket being set is the emotional peak of a tournament — today it happens silently. This turns it into a shareable, notify-worthy moment that pulls fans and coaches back to the app right when engagement is highest, and it's a natural showcase for the paid fan-alerts feature (the fan push is Tournament Plus+). The polish items remove long-standing friction on the two most-visited fan pages.

## Access / who sees what
- Hero takeover + Playoff Picture: **everyone** (public).
- Fan push: fans on tournaments with the paid fan-alerts feature (Tournament Plus+).
- Staff push/bell: the organizer's team, on any plan.

## Priority & success criteria
- **Priority:** high — owner-requested, ties directly to the live event and the fan-alerts value story.
- **Success:** organizers see the hero + get the Playoff Picture with correct seeds; fans receive the push; standings are fully readable on a phone; run differential reads clearly when a cap is in play.

## Tradeoffs
- The seeding summary is generated from the data with a designed template (instant, free, always accurate) rather than AI — an AI-written narrative can be layered on later.
- The announcement fires once, automatically, when the bracket is first created (even for placeholder brackets built early) — chosen for simplicity over an explicit "announce now" button.
