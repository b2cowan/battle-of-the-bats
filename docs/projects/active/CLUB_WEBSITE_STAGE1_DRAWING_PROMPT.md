# Club Website Enhancements — Stage 1 drawing prompt (game day on the club home)

> Paste this whole file into a FRESH session. Written 2026-11-25. Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (read §3, §4
> F1 and F2, §5 idea 2, §6 Stage 1 and the standing rules under the ladder, §7's Stage 0 rulings, the Progress block's
> Stage 0 Part 1 items 1–4 and Part 3, §9, §10). Status lives on the board (project `club-website`).
>
> **This session can run beside the Track P drawing session** (`CLUB_WEBSITE_TRACK_P_DRAWING_PROMPT.md`). The two share no
> screens. Both edit the plan's Progress block and the board line, so re-read those before you write to them.

## What this session is for

Stage 1 makes the club home change on a game day. Under Open now, a games part titled "Today" (or "Latest results" the
day after) shows the club's games across house league, public rep teams and its tournaments, built from scores already
entered. House league pages start refreshing the way tournament pages do. It goes first in the ladder because it needs no
new typing from a volunteer, so it proves the home's moving region on real data, and Stages 2, 4, 6 and 7 all sit on it.

**Stage 0 already drew the frame** (tab 2 of `CLUB_WEBSITE_STAGE0_DRAWINGS.html`, "The club home", the quiet day, game
day and computer states). **This session finishes it:** true-size drawings from the shipped components, every state,
and the questions the frame left open. Do not redraw the home's order; it is ruled.

**Already ruled (2026-11-24; do not re-open):**
- **A1 = A:** one fixed order every day: the notice slot → Open now (at most two rows, then "N more") → the games part
  ("Today" or "Latest results") → News → Teams · House league · Tournaments · About · Sponsors. Each part is absent when
  it has nothing. The first live game must still start inside a phone's first screen with four things open.
- **A2 = A:** one region in two parts: games, and News (posts and coming events). A closed place rides the notice slot.
- **A3 = A:** a running tournament is one row in the games part, with its counts, opening its own Overview.
- **C4 = A:** the ladder's order; Stage 1 is first.
- Stage 0 `/marketing` words for this region: "Today", "Latest results", "Live now", "N more open now".

**Read before you draw: the club events drawing** (`CLUB_WEBSITE_EVENTS_DRAWINGS.html`, drawn 2026-11-25 by another
session; its asks E1–E9 are in plan §7). E1, E5 and E6 touch this stage: an event's row in Open now or "Coming up", a
champs day's games joining its page "with Stage 1", and a champs day as one Today row (A3's pattern). **If E1–E9 are
still unruled when you start, draw to their recommended A and mark each place on the page with its E ask.** Do not
publish a Stage 1 page that contradicts a ruled E.

**Nothing is built here.** No code, no migration, no gate. The output is one published page and the owner's rulings.

## Milton Bats' answers

Stage 0's prompt (`CLUB_WEBSITE_STAGE0_PROMPT.md`, the feedback slot) holds the three questions the owner asked Milton.
Re-read the slot first. If the answers are in, test the drawing against them (is what families ask for answered in one
look). If not, say so on the asks tab and draw anyway. One club is one data point, never the shape of the product.

## Read first (delegate the broad reading to helpers; open the lines a conclusion turns on yourself)

- `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md`, the club-site look rulings (2026-10-19, in-repo
  `memory/design_decisions.md`), and the owner's UI conventions (auto-memory index) before drawing any control.
- `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §9–§10a: what tournament pages settled (game rows, the ticker, following and
  alerts only in the installed app). The `PublicGameRow` rule: no pills under a heading that already says it.
- The club home today: `components/public/ClubSiteHome.tsx` and its CSS.
- **The publish rules, one per program (Stage 0 Part 1 item 2; re-open each):** rep = `getPublicTeamSchedule`
  (`lib/public-team-schedule.ts`, one team at a time; guard test `club-stage6d-feeds-guard`); house league = season not
  draft + `schedule_published_at` + unsent changes held back (`lib/league-game-changes-server.ts`, and the season page and
  standings repeat it inline); tournaments = status active or completed + division published (`lib/public-games.ts`,
  the literal repeated in six files). **`readClubCalendar` (`lib/club-calendar.ts`) is the staff calendar with none of
  these rules and must never feed a public page.**
- How tournament pages refresh: `lib/hooks/usePublicTournamentLive.ts` (30 seconds, paused when the tab is hidden).

## Part 1 — The walk and the census (answer from code, with file and line)

1. **Capture today at true size** (390 and 1280, DPR 1): the Kestrel Bay home on dev on a quiet day and a game day (the
   extras seed runs in the daytime; auto-memory `project_club_on_sale_pages.md` names the scripts), one house league
   season page, schedule and standings mid-game, and the Milton home on staging (no sign-in needed). Stage 0's captures
   in `docs/projects/active/club-website-stage0/` may be reused if the pages have not changed since; say which.
   AGENTS.md for the dev server; a handful of screens, not a sweep.
2. **The one read of the club's games (F2).** How it CALLS each program's rule and never copies it; what a rep team set to
   "families only" does (never appears); a house league division whose schedule is unpublished, or a change not yet sent
   (held back); a tournament with an unpublished division; a game whose time zone differs from the club's. Name the guard
   a build would add so a later edit cannot widen it.
3. **What the region needs that does not exist:** "today" and "the day after" in the club's own time zone; a game's live
   state and final across the three programs (where each is stored, and whether house league and rep have a "live" at
   all); the counts on a tournament's row; how many rows a busy Saturday really holds (dev, counts only).
4. **House league pages refreshing.** Which pages, what refreshes, and what it costs per open page (the 30-second read).
5. **What the home costs to serve.** It is the most-opened public page; say whether the games part can be cached and for
   how long without a final score arriving late.

Stop and tell the owner what the walk found before drawing, in a few plain lines. A `/clear` between Part 1 and Part 2 is
fine; put the findings in the plan's Progress block first.

## Part 2 — The drawing

Whole-screen before (the capture) beside after, true size, phone first, then the computer. Built from the shipped
components and the layout standard. Owed:
- **The home in each state Stage 1 changes:** quiet day (the games part absent), a game day (house league only; house
  league + one public rep team; + a running tournament), the day after ("Latest results"), a club with no public rep
  teams, a very busy Saturday (where "N more" and "the rest open in place" land), and the first-screen line on every
  phone frame.
- **Each row kind:** house league, rep, a tournament row, a final, a live game, a postponed game (the shipped pill), and a
  champs day per E6. One-line rows on the computer.
- **The filter chips** in the frame (All · U9 · U11 · U13 · Rep): whether they belong in Stage 1 at all, with how they
  behave on a club with 20 rep teams. An ask if unclear.
- **House league season, schedule and standings** with the refresh, and what changes on screen when a score lands
  (nothing moves yet; the motion is Stage 6).
- **The empty and failure states:** the read fails; a game with no place; a game with no time.

Hard limits: no page for one game; no club-wide schedule page; no follow, alert or share control in a browser; no child
named; "the site writes it" = fixed sentence patterns, no AI; words go to `/marketing` in ONE pass before hand-off;
times "8:00 a.m."

## Part 3 — Reviews, then hand off

1. `/ux`, then `/design`, on the page before the owner sees it. `/db` reads the one read and the refresh (what each
   request costs, and that no unpublished game can reach it). `/legal` is not owed unless the drawing shows a person.
2. **Publish ONE page** (a Claude Artifact, an HTML page, the house layout; never the canvas): the walk, the census, the
   drawings, and the asks with a paste-back line. Every highlighted thing is clickable to its ask.
3. **The asks,** a recommendation on each, option A first. Expected at least: whether "Today" also looks ahead ("This
   week") on a day with no games but games later in the week; how long "Latest results" holds; the filter chips; rows per
   band; whether a rep team's away game shows; house league pages refreshing, and on which pages. Do not ask what to do
   first; recommend an order.
4. **The build's shape,** written for the build prompt: one pass or two, the guard tests, what the help articles gain
   (`/docs`), and what the Kestrel and Milton demos will show (they follow the product; `/demos` curates once per cycle).
5. Records: plan Progress block and §7, §10 for the words, the PM brief if scope moved, the board line (phase and next).
   No commit without the owner's word.

## Done means

One published page the owner can rule from; the one games read traced to each program's own rule with file and line;
every home state and row kind drawn at true size, phone and computer; the asks waiting; nothing built.
