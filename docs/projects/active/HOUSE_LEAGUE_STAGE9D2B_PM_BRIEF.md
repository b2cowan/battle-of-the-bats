# House league 9d-2b — Publish the schedule, tell families once (PM brief)

> Built 2026-10-28 in seven parts. Plan: `HOUSE_LEAGUE_STAGE9_PLAN.md` §0h and §9. Build prompt:
> `HOUSE_LEAGUE_STAGE9D2B_BUILD_PROMPT.md`. Words: `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` ("Stage 9d-2b").

## What it is

Until now, a house-league game was on the public schedule the moment it was saved, and nobody was told about anything. A
league admin who fixed a typo in a time had no way to tell the families, and a half-built schedule was public while it was
being built.

Now a division's schedule is **a draft until the league admin presses Publish schedule.** Families see "the schedule is
coming" until then. Publishing asks once — how many games go public and how many households get an email — and then every
household gets one email about its own children's teams. After that, every change waits in a list called **Changes to
send** until the league admin sends it, and again every household gets one email, not one per change.

## What people see and do differently

- **League admin / convenor:** builds and fixes the draft freely, then presses **Publish schedule** (offered once the
  division's teams are published). After that a moved game, a new place, an added game, a cancel or a postpone is saved at
  once but waits under **Changes to send**, with who hears each change and how many families. Any change can be **put back**
  before the send. One press sends everything waiting.
- **An urgent cancel goes at once.** From the game's own window, after one question, "tell families now" sends that one
  change; anything else waiting keeps waiting.
- **Before publishing a game is deleted; after, it is cancelled** and stays on the schedule struck through. A postponed game
  leaves its week for **Needs a new date**; once given one it reads **Moved**, with the date it had.
- **Families:** one email when the schedule is published and one per send of changes, about their own children's teams;
  they hear nothing about scores or notes. The public page keeps showing what they last heard until the league admin sends.
- **Coaches:** the team page lists the team's schedule — games as families last heard them, and practices.
- **Owner / club admin:** when the club's game time for a division moves, the division's games move with it. A draft just
  moves; a published division's games wait in Changes to send (a game that no longer fits goes to Needs a new date). The
  league admins get a bell. A change the club made cannot be undone by the league admin — the game would go back onto time
  the club gave away.
- **League admin on a club with a schedule** can only place a game on the division's own game time; an owner or admin can
  place it anywhere.
- **Schedule health** has an **Adjust the rules** door: can a team play twice in a day, how far home and away may differ, and
  games per team for each division. The score follows the rules live.

## Why it matters

A schedule families can rely on: nothing public that the league admin did not choose to publish, nothing changed without
the families being told once and clearly, and no flood of one-email-per-edit. It is the foundation for the first-practice
notice (9d-3) and the rainout and scores work (9e), which reuse the urgent-cancel path.

## Priority and customer impact

High for any club running house league on the League or Club plan. The change is visible on every season as soon as it is
released: a division that already has games is marked published quietly (no email), so nothing public goes dark.

## Success criteria

- No game becomes public, and no family is emailed, without a Publish or a Send.
- A family never receives two emails for one send; a stopped send finishes without re-emailing anyone.
- A league admin can undo any waiting change; a played game is never rewound.
- The coach's page and the public page never show a change that has not been sent.
- Walks §418–§421 pass.

## Decisions to know about

- Games per team is set per division, not one number for the season (a round robin gives 8 teams 7 games and 5 teams 4).
- No bell goes to league admins for their own publish or send; the bell is for the club moving time.
- Several words are marked for a marketing pass; they are listed in the plan's §9 entry for Part 5 and Part 7.
