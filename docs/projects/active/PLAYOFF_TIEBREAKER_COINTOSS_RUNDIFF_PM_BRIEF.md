# PM Brief — Playoff Tie-Breakers: Coin Toss + Run-Diff Cap

**Status:** Planned — awaiting build greenlight · **Created:** 2026-06-10
**Plan:** `PLAYOFF_TIEBREAKER_COINTOSS_RUNDIFF_PLAN.md`

## What we're adding (plain language)

Tournament organizers already set the order of tie-breaker rules (Head-to-Head, Run Diff,
Runs For, Runs Against) that decide standings and who gets which playoff seed. Two
additions:

1. **Coin Toss** — a final tie-breaker for when teams are still dead-even after everything
   else. The system can't flip a coin for you, so it **flags the tie and lets the organizer
   record who won**. That choice sticks and feeds the playoff bracket.
2. **Max run differential per game** — an optional cap so a single blowout doesn't decide
   seeding. Set it to 7 and a 14-0 win counts as **+7** toward Run Diff instead of +14.

## Why it matters

- **Fairness:** Caps stop lopsided games (and any temptation to run up the score) from
  skewing who makes/seeds the playoffs — a common ask in youth and rec sports.
- **Real-world completeness:** Coin tosses are how real tournaments break unbreakable ties;
  organizers needed a sanctioned, recorded way to do it instead of editing seeds by hand.
- **Trust:** The standings page already shows the tie-breaker order publicly; now it can
  honestly show "Coin Toss" and the cap rule, so teams understand how seeding was decided.

## What changes for each user

- **Organizer (admin):** Two new controls on Event Settings (and per-division if they use
  per-division rules): add **Coin Toss** to the tie-breaker list, and set a **max run diff
  per game**. When a tie needs a coin toss, they see a "Coin toss required" prompt on the
  admin standings and record the winner in one click.
- **Coaches / public:** See "Coin Toss" listed in the tie-breaker order and a note like
  "Run diff capped at ±7/game" when active. No new actions for them. Note: when a cap is
  on, Runs For / Runs Against stay as the real scores, so RF − RA won't always equal the
  capped Run Diff — the note explains why.

## Access / roles

- Configuration and coin-toss recording are **admin/organizer-only**, same place as today's
  tie-breaker settings. No new plan tier or paywall.
- Public/coach views are read-only and unchanged except for the two informational notes.

## Scope guardrails

- **Tournament standings only.** House-league / league standings use a separate engine and
  are intentionally left alone.
- No database migration (values live in existing settings/config fields).

## Priority & success criteria

- **Priority:** Medium — direct organizer request; bounded, no schema risk.
- **Success:**
  1. Organizer can add Coin Toss and set a per-game cap (tournament-wide or per division)
     and they persist.
  2. A real tie surfaces a "coin toss required" prompt; recording a winner updates standings
     and the playoff seed.
  3. A 14-0 game with cap 7 shows +7/−7 Run Diff while RF/RA stay 14/0, with a clear note.
  4. Public and league standings behave exactly as before for non-admins.
