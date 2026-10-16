# Club Accounting · Teams — PM brief

**Hub:** https://claude.ai/artifact/M3iNQq4N8cRWeZCdN6G8Ps · **Plan:** `CLUB_ACCOUNTING_TEAMS_PLAN.md` ·
**Build prompt:** `CLUB_ACCOUNTING_TEAMS_BUILD_PROMPT.md`

Ratified by the owner 2026-10-16, all eight decisions as recommended. Built and committed 2026-10-16 (`b9c9ced3`; plan §11); the owner walks it
on Owner QA §321, the hub's QA tab. Ships inside the Club release.

## What changes for the treasurer

- **A Teams tab**, second in Accounting's row. Every team and its money for the year, one click from anywhere in
  Accounting, instead of a scroll to the Overview's fourth section.
- **Moving between teams without going back.** Opening a team keeps you in the tab; a Team dropdown at the top switches
  to any other team, and "All teams" returns to the list.
- **A team's page says what to do.** What is late shows in red under what the team owes ("3 late · since Aug 23"). A
  "Needs you" list shows each late payment, each payment the team says it sent, and each request waiting, and opens each
  in one click to record, confirm, remind or approve.
- **Who to call.** The team's season and head coach are named at the top, or "No head coach" in red.
- **The Overview gets shorter.** The full teams table moves to the tab; the Overview keeps a short card ("8 teams have
  money late · 4 have a request waiting for you") with a door to the tab.
- **A team still owing on an earlier year says so on its row** ("+ $600.00 overdue from 2025–26"), whether that year
  is closed or not (owner, in the build), so the list, the Overview's card and the team's page never seem to disagree.

## For owners and admins

Everything above, plus a door from a team's money to its Rep Teams page at the end of the money page, the mirror of the
"With the club" door Rep Teams already has. A treasurer doesn't see it, because a treasurer can't open Rep Teams.

## Why it matters

Checking a team and chasing a team are a treasurer's most frequent club-money jobs. Today each costs a scroll and a round
trip, and the team's page hides the two facts the treasurer came for: what's late, and who to talk to. On the dev club,
11U AA has $2,358.00 late and its own page never says so.

## Customer impact

Every club that runs rep teams, weekly through the season and daily near a due date. A club without rep teams sees no
change (no Teams tab, as with Allocations and Payment requests). No figure changes meaning.

## Priority

Small and contained: no new money rules, no data change, one shared control learns to group its choices. Inside the Club
release, which is not yet on sale.

## Success criteria

- Any team's account in two clicks from any Accounting tab.
- Moving from one team to the next never passes through a list.
- A team's late money and waiting requests are on its page, each one click from being acted on.
- The head coach is named on the team's page for everyone who can open Accounting.
- The Overview's teams card and its "Owed by the teams" figure always agree.
