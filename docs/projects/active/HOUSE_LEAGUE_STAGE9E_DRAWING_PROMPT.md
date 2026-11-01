# House League Stage 9e, Game day: standings, scores and a rainout: draw it (prompt)

> **Written 2026-11-01**, the day 9d-3 closed (Session 2 committed `e9ac3b0ac`, walks §436 and §439 passed). **Paste the block
> at the bottom into a new chat on `dev`.** Other sessions share this working copy (TODO, the plan, the PM brief and the QA
> ledger carry their edits): stage explicit paths only, commit only your own hunks, and only when the owner says.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.
>
> **How to draw (owner ruling 2026-10-26, binding):** one published HTML-page Artifact with tabs and a written explanation beside
> every frame, published by `file_path`. **Never** the design canvas / the `design` quickstart / a Design artifact type, and never
> open an empty artifact "to fill later". Load `artifact-design` first. Frames at true size, a desk and a phone for each, with a
> whole-screen before/after. Run `/design` on the drawings before handing them over.

## What 9e is, and what is ruled

The plan's row (`HOUSE_LEAGUE_STAGE9_PLAN.md` §4, ~line 395): *Game day. Standings by sport pack; score entry (coaches if Q7);
rainout as one action.* Size S–M. Its Asks column is "—": **no 9e ask exists and nothing about 9e is ruled.**

**Ruled, do not reopen** (record each as ruled and add nothing it did not rule):
- **Q7:** light coach accounts (own team only; roster contacts, schedule and scores). Built in 9c, 9d-2b and 9d-3. **9c·1:** the
  coach's team page carries "roster and contacts, then schedule (9d) and scores (9e)"; **the Coaches Portal is untouched.**
- **9d2·1 / 9d2·2 / 9d2·13:** after a division is published, changes wait under "Changes to send" and go out together; an urgent
  cancel or postpone from a game sends at once; a game change emails the families of both teams and copies their coaches; **scores
  and notes never email**; families hear about a published game once, from the league admin's send.
- **Q16:** a finished season reads in place, locked, through the one gate. Whatever 9e adds is locked there. (CLAUDE.md's
  "closed season is one page" rule is the COACHES portal's; the club's house-league seasons follow Q16. Check which applies
  before drawing a finished-season frame.)
- The pencil's score rule already built: both scores filled = played; both empty = back to scheduled; one alone is held with
  "Enter both scores, or neither." (9d-2a step 4).
- A postponed game has no date and stays out of calendar feeds until re-dated (9d-2b / 9d-3).

## Leads to re-open against the code (a helper's summary, spot-checked once: **verify every row before drawing on it**)

| Lead | Where to look | Why it matters to the drawing |
|---|---|---|
| The league has standings today: W-L-T, **points = wins × 2 + ties**, then run differential, then runs-for. It counts completed games only, ignores the season's sport, has no head-to-head and no win percentage. The plan logs it as finding F21. | `lib/db.ts` `computeStandings` (~2940-2979); plan ~line 374 | "By sport pack" is a change to a live, public number. A hockey or soccer league with 3-point wins or overtime losses is wrong today. |
| A `SportPack` exists with `pointsPerWin`, `pointsPerDraw`, `usesDraws`, `standingsPrimary` ('points' or 'winPct'), `defaultTieBreakers`, score labels (RF/GF/PF). `league_seasons.sport` exists; **nothing in the league reads it.** | `lib/sports.ts` ~119-215; `lib/types.ts` ~313 | Which sports does a house league actually run (check the create-season sport list)? What does each pack say? Does a pack's value need a per-season override (an admin rule), the way 9d-2b's Rules door holds games per team? |
| The tournament has a tie-break engine with head-to-head, runs for/against, differential and a coin (`h2h rf ra rd coin`), a mercy-cap differential limit and a pending-game flag. It is pool-shaped. A third standings copy sits in the archives page. | `lib/tie-breakers.ts` (~21, 60, 188); `lib/public-standings.ts`; `components/public/PublicStandings.tsx` | Reuse or a thin league wrapper? Say what a tie looks like in a recreational league and whether the public page should explain a tiebreak. |
| Standings render on the public season page (division tabs) and an admin Standings rail item; **the coach page has none.** | `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx`; `app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/`; `lib/house-league-season.ts` ~33 | Does the coach want a one-line "your team: 4th, 3-2-1"? Does standings need a phone recipe? |
| Score entry is staff only: the schedule game window's pencil, through one PATCH route with a stale-window guard. The coach page shows a stub, **"The club enters scores for now."**, though the coach's game read already loads the scores. | `components/admin/kit/club/league/schedule/GameWindow.tsx`; `app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts`; `lib/league-game-patch.ts`; `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx` ~98-101; `lib/house-league-coach.ts` | **The central open question: can a coach enter a score?** If yes: which team's coach (both? the home coach?), does it count at once or wait for the league admin to confirm, what happens when the two coaches disagree, can the admin correct it, and does a correction change standings the families already saw? The coach route must use the coach link table, never the admin gate. |
| The tournament has a coach-submitted score with a pending state the admin confirms, and a final result a direct route call cannot flip. | `app/api/admin/games/route.ts` ~120 and its comments | A precedent for "submitted, then confirmed". Read it; do not assume it fits a league. |
| There is **no** bulk cancel or postpone for a day in house league. The tournament has "Shift the day" (rain delay): move and/or cancel a set of games, notify, all-or-nothing Undo, plan-gated. | `app/[orgSlug]/admin/tournaments/schedule/components/ShiftDayModal.tsx`; `lib/schedule-shift.ts`; `app/api/admin/games/route.ts` ~1034-1270; `lib/schedule-words.ts` (`RAIN_DELAY_WORDS`) | The best template for the interaction and the Undo. A rainout has two halves the drawing must keep apart: the games (cancel or postpone, with or without a new date) and the practices that evening (practices are the club's time; a league admin changes house-league time only). |
| A cancelled or postponed game flows to families through the change record, netted per game, held under "Changes to send" for a published division, urgent single send via `sendNow`. | `lib/league-game-changes.ts` (~31), `lib/league-game-changes-server.ts`; route ~216 | A rainout is many urgent changes at once: one email per household per send, the season's rolling email cap (the urgent send is a service notice; check whether it counts), and a coach copy. What do a family with two children on two teams in the rain read? |
| 9f (Season end) depends on the standings (a "Final standings" tag). | `lib/house-league-season.ts` ~159-169 | Whatever 9e decides about ties and points is what 9f freezes. |

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's summary is a lead, so open the cited lines
yourself; **disagree out loud**). Stage 9 plan §0, §3, §4 (9d-2, 9d-3, 9e, 9f rows), §5, the F21 finding; `HOUSE_LEAGUE_STAGE9D2B_BUILD_PROMPT.md`
(what the schedule and Changes to send do now); `HOUSE_LEAGUE_STAGE9D3_BUILD_PROMPT.md` (the coach page's newest lines);
`docs/agents/design/TABLE_AND_LIST_STANDARD.md` and `COACH_SURFACE_DESIGN_ADDENDUM.md`. Follow the shape and frame rules of
`HOUSE_LEAGUE_STAGE9D3_DRAWINGS.html` and `HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html` (links are in the plan's status log).
House rulings that touch these screens are in the auto-memory index under "UI conventions" (read before drawing any control, window,
toolbar or list), and `project_club_stage9_house_league.md`.

## What to produce

1. **A short push-back first, before drawing.** 9e is three different things bundled under one name (a number families read,
   a permission a coach has never had, and an emergency action). Say whether they should be one build or three, and which
   comes first by dependency (standings feed 9f; coach scores change what standings show). The owner will argue with it.
2. **Drawings** (one Artifact, tabs): *Standings* (public, admin, coach line; desk and phone; a tie; a sport with draws and one
   without); *Scores* (admin today vs. with a coach; the coach's entry window; the disagreement and correction cases; what
   changes standings and when); *Rainout* (the entry door, the picker of which games, the preview of who is told, Undo, the
   family's email and the coach's copy); a **Since 9d-3** tab checking each frame against the signed-in family account rulings
   (2026-10-31: everyone signs in; no new sent links) and the club-time rulings (a league admin never picks time the club has not
   allocated).
3. **The asks**, numbered 9e·1…, each with a recommendation, answerable by paste-back on the page. Likely ones: coach score entry
   (who, pending or final, disagreements); what a sport pack decides vs. what the admin can override; the tie-break order shown
   publicly; whether standings count a game only once its division is published; rainout scope (games only, or practices too);
   whether a rainout postpones to "date to come" or offers a make-up date; whether it is plan-gated like the tournament's
   (a /strategy question, flag it, do not decide it).
4. **Records, not code:** a §0 block in the Stage 9 plan with the asks, the plan's 9e row and §9 updated, the PM brief item, a
   TODO line, and the auto-memory note. A Product Owner summary in the conversation (what a coach, a convenor and a family see
   differently). Do not commit until the owner says; then only your own hunks.

Then print the next step's prompt (the /marketing words pass, once the asks are ruled) and stop.
