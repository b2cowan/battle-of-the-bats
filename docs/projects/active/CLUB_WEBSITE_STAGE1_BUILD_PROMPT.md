# Club Website Enhancements — Stage 1 build prompt (game day on the club home)

> Written 2026-11-25, after the Stage 1 drawing and its rulings (commit `2ce4cc003`), on the owner's "commit, then write
> the build prompt". **Two sessions, in order**, each pasted into a fresh chat (`/clear` first):
> - **1A** (Opus): *"Read and follow docs/projects/active/CLUB_WEBSITE_STAGE1_BUILD_PROMPT.md — Session 1A"*
> - **1B** (Opus): *"… — Session 1B"*
>
> Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (§3, §4 F1 and F2, §6 Stage 1 and the standing rules under the ladder, §7's
> Stage 0, events E1–E12 and Stage 1 G1–G11 rulings, §9, §10). Status lives on the board (project `club-website`).
> **The drawing is the spec:** `CLUB_WEBSITE_STAGE1_DRAWINGS.html`, published
> https://claude.ai/artifact/Y8yvdP4H5dzAhDiEtG6TdL. Tab 7 (the one games read) and tab 8 (the build's shape) are the
> engineering half; tabs 2–6 are what a visitor sees. Where this prompt and the plan differ, the plan wins; where the plan
> and the CODE differ, the code wins — say so out loud before building on it.

## ⛔ Start conditions (both sessions)

1. The G1–G11 rulings are in plan §7, ticked (commit `2ce4cc003`). If not, stop and tell the owner.
2. **Other sessions share this working copy.** At writing: Board Ready Stage 6 Part 4 (sponsorship files), the club
   events records (this plan's §7 and Progress block, the board line), and possibly Track P's build. Commit your lines
   through a private index (`reference_partial_commit_shared_tree.md` in auto-memory), never `git add -A`.
3. Migrations: Stage 1 is not expected to need one. If it does, number after the highest in `supabase/migrations/` at
   commit time and say why on the plan; then the dictionary + snapshots rule applies.
4. Milton Bats' three answers (Stage 0 prompt's feedback slot). Re-read it. If they are in and one bears on a ruled
   ask (most likely G10, rep teams shown only when Public), tell the owner before building that piece. Do not re-rule it.

## What the owner ruled (plan §7, all A, 2026-11-25; build exactly this)

- **G1** no look-ahead on a day with no games: the games part is absent.
- **G2** "Latest results" holds today and the two days before.
- **G3** no filter chips.
- **G4** four rows a band, in a stated order: tournament or champs day first, then time, then house league by division
  from the youngest, then rep, then place. The rest open in place ("N more …", "Show fewer"). A capped band links to the
  season's own schedule.
- **G5** a rep team's away games show.
- **G6** the house league schedule, standings and season page check every 30 seconds, from half an hour before the
  day's first game to the end of the last game's window; the home's games part the same. **A, not D: no "Updated" line.**
- **G7** one live rule for all three programs: house league shows "Score after the game" during its window, then "No
  score yet" in Latest results until a score is entered; rep shows the coach's running score as live; the rep "T 4–2"
  defect is fixed first.
- **G8** stacked rows in the 540 column on a computer (the layout standard's R6).
- **G9** the Tournaments card says "Games today", not "Live now".
- **G10** no change to who makes a rep team public; the site editor says how many rep teams show their games.
- **G11** a failed first read shows "Games can't be shown right now. The house league schedule and each team's page
  still have them." with Try again, all or nothing; a failed 30-second check says nothing and keeps what is on screen.

Earlier rulings this stage must hold (do not re-open): Stage 0 **A1** (the home's fixed order; Open now at most two rows,
then "N more"; each part absent when empty; the first live game inside a phone's first screen), **A2**, **A3** (a running
tournament is one row with its counts, opening its Overview). Events **E1, E5, E6, E10** (see "Club events" below).

### Club events: what this stage does NOT build

Club events and the champs day page are Board Ready Stage 5's build and **do not exist in the code yet** (nothing under
`lib/` or `app/` models a club event or a champs day; `lib/champions.ts` is tournament champions). So Stage 1 builds the
place for them and none of their rows:
- G4's order keeps "tournament or champs day first" as a slot the champs day row drops into.
- E6 (a champs day = one Today row, its games left out of Today's own rows), E10 (the "Champs day" band on the season
  schedule) and E11's schedule row are **not built here**. Write one line in plan §6 Stage 1 saying they ride with
  whichever of the two lands second, and one in Board Ready plan §5 Stage 5's split record if that is where it belongs.
  Do not invent an events table to draw them.

## Read first (delegate broad reading to a helper; open the lines a conclusion turns on yourself)

- Tab 7 of the drawing, then each file it cites. Re-check each citation still points where it says; the drawing was
  traced on 2026-11-25 and other sessions commit daily.
- `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md` (R5, R6), the club-site look rulings in in-repo
  `memory/design_decisions.md`, the owner's UI conventions (auto-memory index).
- The shipped refresh: `lib/hooks/usePublicTournamentLive.ts` (30 seconds, paused when hidden). Reuse its pattern.
- The shipped game row (`PublicGameRow` and its CSS) and the club home (`components/public/ClubSiteHome.tsx`).
- `formatTime()` in `lib/utils.ts` for every time; the shared time helpers in `lib/timezone.ts` for "today".

---

## Session 1A — the defect, then Pass 1 (nothing a visitor sees, except the defect fix)

### Part 0 · the rep running-score defect (its own commit)

While a coach keeps the running score in Game-Day Mode, the public rep team page and the family schedule show the game
as a finished tie ("T 4–2") until End game. Fix it with **one rule** for "a score, no result, inside the game window"
read as live (G7), used by the public team page and the family schedule. Find every place that turns a score into a
W/L/T and make them ask the rule. A unit test pins: running score → live; End game → final with its result; a score
with no result outside the window → what the shipped page shows for a finished game (say what that is). This is live
today, so it is its own commit, offered to the owner as soon as it passes `/review`.

### Pass 1 · the foundation (tab 8, "Pass 1")

1. **One house league public-games rule.** The draft-season check moves inside the shared published-division +
   last-sent step (`lib/league-game-changes-server.ts`); the schedule, season page, standings (and the six other pages
   tab 7 lists) call it and test nothing themselves. Plus a **"today" version inside that module**, the window applied
   AFTER the unsent-changes view (a game moved today to next week still shows today until the change is sent).
2. **A batch version of the rep rule inside its own module** (`lib/public-team-schedule.ts`): all of a club's Public
   teams in about 3 reads, not 5 per team. The one-team rule stays and both share one definition of Public.
3. **The one games read** over the three rules: asks the site-and-plan check once per program first (the rep rule does
   not check it itself), then each rule for today and the two days before, and returns its **own short list of fields**.
   It drops every tournament game copied onto a rep team, every rep multi-day tournament entry and every practice. The
   club's tournaments come only through the tournament rule (status, published division, Schedule page on, held-back
   opponent blanked; no row at all while the Schedule page is off).
4. **The live rule** for house league and rep (G7), shared with Part 0.
5. **The games-only check request** the home and the house league pages poll: site and plan check, no cookies' worth of
   anything, held at the edge 15–30 seconds with **no serve-stale**. No tag cache. A newer render that already shows
   "Final" ignores an older check still saying "Live now".
6. **The guard tests** (tab 7's list, all of them): the read's imports are an exact list (dynamic imports and
   re-exports caught); it reads no game table and holds no copy of a rule; each program's rule is skipped when its switch
   or plan says no; the returned fields are its own (a test fails on notes, score-entry details or internal ids); copied
   tournament games, multi-day entries and practices never come out; the "today" window after unsent changes, pinned with
   a moved game; **no public file imports the staff calendar** (`lib/club-calendar.ts`; the schedule's calendar-view
   import stays allowed); no house league page tests "draft" or "schedule published" itself; the new read joins the
   public-games guard's list. Extend `club-stage6d-feeds-guard` rather than starting a parallel one where it fits.

Nothing a visitor sees changes in Pass 1. Pass 1 touches nine house league pages, so it gets **its own `/review`** before
Session 1B starts. Typecheck (it touches shared modules), `verify:changed`, the unit tests. Offer the commit; commit
only at the owner's word.

Records at the end of 1A: plan Progress block (what landed, commit ids), §6 Stage 1 line, the board line.

---

## Session 1B — Pass 2 (what a visitor sees), then the close

Start condition: Pass 1 is committed and reviewed. If not, stop.

1. **The home** (tab 2, every state): Open now capped at two rows then "N more open now"; the games part titled "Today"
   or "Latest results"; bands, order and caps per G4; a running tournament as one row with its counts (A3); the day
   after; a rained-out day (postponed, cancelled and moved games in their own band, a rainout collapsed to one row);
   early morning and evening; a club with no Public rep teams; the computer at 1280 with stacked rows in the 540 column
   (G8). The first game row inside a phone's first screen on every state.
2. **The rows** (tab 3): house league, rep (away games shown, G5), tournament, final, live, postponed; no place → the
   place line left out. Directions as drawn (the Navigation icon on a phone, the small labelled button on a computer).
   The live edge green, never the club colour.
3. **The house league pages refreshing** (tab 5, G6): schedule, standings and season page; the score and Final pill
   land in place; the standings reorder once per check; the schedule keeps "Show earlier weeks" as the visitor left it;
   checks stop outside the window and pause while the tab is hidden; a tab coming back checks at once.
4. **The Tournaments card's word** (G9) and **the site editor's rep line** (G10: "3 of 20 rep teams show their games on
   your site. Each team's coach chooses this in Schedule visibility." with its one, all and none forms).
5. **Failure** (tab 6, G11): the all-or-nothing first read and its line; a failed check says nothing.
6. **Words:** exactly the list on tab 8 and plan §10, one `/marketing` pass before hand-off. `check:spelling` green.
7. **The walk's seed:** the walk needs house league games and a Public rep team on today's date. Add them to Kestrel's
   extras seed (daytime only; the prospect reset wipes the club's budget lines, so re-run the extras after it). A walk
   task, not a demo step.
8. Then `/simplify`, `/review`, `/docs` (tab 8's three help changes: what the home shows on a game day and that a rep
   team shows only when Public; house league scores update the public pages within 30 seconds; the coach's Public setting
   now also puts the team's games on the club home), and `/design` on the shipped screens against the drawing.
9. **One walk** as a checkable Artifact (20–50 boxes, one action per step, exact logins), the owner's to run.
10. Records: plan §6 tick and Progress, the PM brief if anything moved, the board line, the Owner QA Ledger row for the
    walk. Commit at the owner's word.

## Hard limits (both sessions)

No page for one game; no club-wide schedule page; no follow, alert or share control in a browser; no child named; no
AI-written words; no motion (Stage 6); no realtime channel or browser database connection on the home; times only
through `formatTime()`; the staff calendar never feeds a public page.

## Done means

The defect fixed and committed on its own; one house league rule, one games read, its guards green; the home, the rows,
the three house league pages and the failure state as drawn on a phone and a computer; help updated; one walk waiting
for the owner; nothing on production until a release.
