# Coach row lists — one recipe · PM brief

**Status:** ruled as drawn 2026-09-16 ("agree with your mockups") and the first half BUILT on dev
the same day — the Scouting Book, the Schedule's list view, the two hubs and Lineups' templates are
on the recipe; the rest (tournaments, announcements, the player's lists, staff, the feed, the
closed-season rows, Off the roster, tags) is the second session. Owner walk owed (ledger §197). Hub: https://claude.ai/artifact/S78c93Zrp4U91mZTpyMsXk (mockups · decisions · brief ·
plan · QA-walk sketch). Plan: `COACH_ROW_LIST_RECIPE_PLAN.md`.

## What this is

The last records surface in the coach portal that is not on the table standard. Every table now
sits on a white card with one row height per kind of row, one hairline, one heading recipe. The
lists that are *not* tables — the practice and lineup hubs, the schedule's list view, the scouting
book, tournaments, announcements, the small lists on a player's page, the staff list, tags,
notifications, the closed-season shelves — were each drawn with their feature and never brought to
the same rules. Measured today, seven of them are floating white cards on the blueprint grid, one
tab away from a table that sits on a card.

## What changes for the coach

- **One look for every list.** A list of records sits on the same white card a table sits on,
  with the same thin line between rows, the same row heights for the same kind of row, and the
  same words in the same sizes. Moving from Results to Scouting Book, or from the Roster to "Off
  the roster", stops feeling like two products.
- **The practice hub and the lineups hub** lose their floating cards and the big date tile; the
  date becomes a quiet column, the title leads, and "Coming up" / "Recent practices" become bands
  inside one card. Everything the practices re-evaluation ruled — the next-practice card, the tabs,
  "Open the plan" / "Plan this practice" / "Open", the readiness chips — stays word for word.
- **The schedule's list view** becomes one card with a band per month and rows the same height as
  everywhere else — a little taller than today's thin chips, and at tablet width finally tall
  enough to tap. The Week and Month calendar views keep their chips exactly as they are.
- **The scouting book** matches the Results tab beside it. **"Off the roster"** finally has a
  visible line under its rows. The staff list and a tag's name stop rendering at a size nobody
  chose.
- **On a phone**, every list's cards are the same cards the roster already uses — no white slab
  behind a stack, the chevron in the corner.
- **Nothing else moves:** the notifications feed (its day headers and unread shading are kept),
  the closed-season page's shape and its month folds, the calendar cells, the next-practice card.

## Why it matters

The table standard (approved 2026-09-06) treated a table and a row list as one thing but only ever
wrote the sentences for tables. Ten days later the owner found the list tables on the paper, and
the same afternoon a leaderboard floating beside a carded table. The row lists are what is left —
and they are the portal's most-opened screens after the Overview. A product that looks like two
products on adjacent tabs reads as unfinished to a coach, and to a club deciding whether to pay.

## Customer impact

Every coach, every day, on the schedule and the two hubs. Nothing a coach can do changes; several
screens get quieter; one control becomes tappable at tablet width. The closed-season page and the
feed change by amounts a reader will not see.

## Tradeoffs made (and put on the panel)

- The schedule's rows grow from 31px to about 37 (about 64 as phone cards, from 52). One recipe
  with a floor costs a long month a little height; a private density for one screen is what the
  standard exists to refuse.
- The hubs' 20px display-face date tile goes. It was a small calendar flourish and the one row
  in the portal larger than its own page title.
- Two lists stay lists by judgement, not by the letter of the "three columns" test: the
  closed-season results (the season's record is already the answer strip above them) and a
  player's last sessions (the attendance counts are the boxes above them). The standard now says
  so, which is also why the Awards leaderboard — a ranking — became a table.

## Priority

Next in the table-standard sequence (§8, item 7) — the last records surface not on the standard.
Two build sessions: the season's daily screens first, the rest second.

## Success criteria

- The rendered gate finds **zero** lists of records on the paper across the coach sweep — and
  fails the day one is added, because it reads the ground behind the row, not the row.
- Every list renders through one shared row component; the old row styles are gone.
- The owner walk passes with no list looking different from its neighbour on any axis it did not
  claim in the register.
