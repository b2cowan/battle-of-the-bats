# House League Stage 9f, Season end: Archive, the finished season, Start next season: draw it (prompt)

> **Written 2026-11-03**, the day 9e closed (9e-1 `01e3990be`, 9e-2 `4528b4a2d`, 9e-3 `5e09022ee`; the walks are all marked
> complete). **Paste this whole file into a new chat on `dev`.** Recommended model: Opus 5.5, one session. Reading and searching go
> to helpers; a helper's summary is a lead, so open the cited lines yourself. Other sessions share this working copy (TODO, the
> plan, the PM brief and the QA ledger carry their edits): stage explicit paths only, commit only your own hunks, and only when the
> owner says.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.
>
> **How to draw (owner ruling 2026-10-26, binding):** one published HTML-page Artifact with tabs and a written explanation beside
> every frame, published by `file_path`. **Never** the design canvas / the `design` quickstart / a Design artifact type, and never
> open an empty artifact "to fill later". Load `artifact-design` first. Frames at true size, a desk and a phone for each, with a
> whole-screen before/after. Run `/design` on the drawings before handing them over. The house layout (sticky tabs, minimal
> scroll, an "Everything / Show only what differs" toggle) is in the auto-memory note on mockups.

## What 9f is, and what is ruled

The plan's row (`HOUSE_LEAGUE_STAGE9_PLAN.md` §4, ~line 457): *Season end. Archive; the finished-season record (Q16); Start next
season copies forward. Returning families with a pre-filled form wait on Stage 14, and the pre-fill is for a **signed-in** parent
only, never a sent link.* Size M. Its Asks column is "—": **no 9f ask exists and nothing about 9f is ruled beyond the rows below.**
Last checked 2026-11-03: no status-log entry mentions 9f except as a dependency.

**Ruled, do not reopen** (record each as ruled and add nothing it did not rule):
- **Q16:** a finished season reads **in place, locked, through the one gate**, Money still open, "Finished" in the switcher. The
  hub offered "one record page per finished season, like the coaches portal" and the owner chose in place. "Finished" = status
  `completed` **or** `archived`. **Check which rule applies before drawing a finished-season frame:** CLAUDE.md's "a closed season
  is ONE PAGE" is the **Coaches Portal's** (rep teams); the club's house-league seasons follow Q16, and the club's fiscal year
  has its own scoped line there. House league has **no** scoped line in CLAUDE.md, so someone may "correct" it later (see push-back 4).
- **Q14:** several live seasons are allowed (so nothing says Start next season ends the old one).
- **Archive** was built label-only in 9a ("what Archive does is 9f's"); the ruled correction is that an archived season **stays**
  under Past seasons. **9a·4:** every status change asks in a window; Complete, Archive and Reopen are a rare door at the end of
  the Overview's body. **No family or coach is emailed** by any status change ("Families are not emailed" is in every window).
- **9c·2b:** ratings live with this season only and are **erased automatically when the season finishes**; carrying them forward is
  Stage 14's question. **9b-2:** Money stays open after Complete (fees received, refunds, price corrections).
- **Email families stays open** on a finished season (Q16's one addition). A finished season's schedule, teams, registrations,
  divisions and settings are refused (423); 9e-3 added: **no score doors anywhere** on a finished season, no Rainout, Subscribe
  is live-season only.
- **Coach page** stays 30 days after the season finishes, then the card goes. **A family's "Your sign-up" link** stops 30 days
  after it finishes, except a family still owing keeps it until paid (owner 2026-11-01).
- **9b·9 / 9b·8 / Q19** already say what copies: how-to-pay text is "one per season, copied forward"; the "owing" amber threshold is
  "copied forward with the season"; an age group on its own calendar "is a different season, copied by 9f's Start next season".
- **9e·15 (2026-11-02):** no plan gate of its own for standings, coach scores or the rainout; they ride house league as a whole.
  *Whether Start next season gets one is NOT ruled: flag it for /strategy, do not decide it.*
- The coach plan's two carry-overs that bind in spirit: **unsettled money WARNS, never BLOCKS** (Complete already warns with
  "N players still owe fees"), and a window **says what locks first**.
- **Signed-in family accounts (2026-10-31):** everyone signs in; **no new sent links**. Pre-fill for returning families is
  Stage 5 of that plan and waits on Stage 14: **not 9f**. Draw nowhere it would live, only say where it will plug in.
- **Club time (9d2·15):** the club allocates time to House league; a league admin never picks time the club has not given. A copied
  season therefore **starts with no club time**; do not draw it carrying last year's slots.

## Leads to re-open against the code (checked 2026-11-03: the starred rows were opened by the writer; **verify every row before drawing on it**)

| Lead | Where to look | Why it matters to the drawing |
|---|---|---|
| ★ Six statuses; the only writer is the season PATCH, `ALLOWED_TRANSITIONS`: `active` to `completed`; `completed` to `archived` **or back to `active`**; `archived` to `active` only. Reopen goes to `active` (registration stays closed). The dictionary still calls archived "terminal" and forward-only: stale. | `app/api/admin/house-league/seasons/[seasonId]/route.ts` ~28-36; `lib/house-league-status-words.ts` `movesFrom`; DATA_DICTIONARY `league_seasons` | Archive is reversible, so "what does Archive do" is a real question, not a one-way door. |
| ★ Archived differs from completed by almost nothing: one public sentence ("This season has been archived."), and the free League floor's season cap **ignores archived seasons** (archiving frees a slot). | `app/[orgSlug]/league/[seasonSlug]/page.tsx` ~257; `app/api/admin/house-league/seasons/route.ts` ~44-52 | The one real effect today is a billing quirk nobody designed. A drawing must say whether it is kept, and /billing flags it if the cap changes. |
| ★ A finished season **has no frozen final table**: standings are computed live from the games on every read. The only "frozen" thing is that the gate refuses edits; only **Reopen** can change a result, then the table recomputes with no record of the earlier one. | `lib/db.ts` `computeStandings` (~2959); `lib/league-standings.ts` `rankStandings`, `gameCounts` | The plan says "9f must define the frozen table". Push-back 2: a locked season is already frozen. Argue it. |
| ★ "Final standings" is a **label only**: an `active` season past its end date, and a "Final standings →" button on a finished season's public page. No stored field behind it. | `lib/house-league-season.ts` ~158-171; public season `page.tsx` ~264 | The wording is date-driven, the state is not. A season the admin forgot to complete reads "Final standings" and is still editable. |
| ★ The coach's finished view (30 days) shows players, the notice and the Scores list with no doors, but **no standing line and no schedule**: the standing needs the `open` view. A coach loses their team's final place the day the season finishes. | `lib/house-league-coach.ts` ~215 (`ranks`); `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx` | A small, real gap. Decide whether the finished view carries "Final place" and how long. |
| ★ **No copy-forward exists** for house league. Create-season asks only name, sport and dates; divisions are added afterwards and only **default** size and price from the last division. The plan's F22 says the same. | `components/admin/kit/club/CreateLeagueSeasonDialog.tsx`; `app/api/admin/house-league/seasons/route.ts` POST; season `page.tsx` ~356 | Start next season is the one piece of genuinely new work in 9f. |
| The rep-team "Start next season" (coaches portal) is a separate system: it **closes the old season**, carries the roster and optionally the fee template, the planned budget and cash (toggles with provenance), starts the schedule fresh, and has a Close-the-season sibling and a Reopen only while no newer live season exists. Undoing a rollover is deliberately not built. | `lib/rep-season-rollover.ts`; `components/coaches/StartNextSeasonModal.tsx`; `COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md` | Reusable **ideas** (toggles, say what locks first, warn never block); no reusable code (it is rep-program-year shaped). |
| What a next season **could inherit** (per-season tables): season settings (sport, fee, auto-approve, auto-promote, waiver, how-to-pay, consent, owing threshold, home/away tolerance, twice-in-a-day), divisions (name, capacity, born years, price, early price, note, games per team, show standings), teams (name, colour, order), coaches (name and email only; each needs a **fresh invite**), practice length and teams-at-once, schedule-health settings. **Must not inherit:** registrations, payments, ratings (already erased), games, scores, changes, rainouts, practices, notices, email logs, the budget seed, the fee words; and **publish flags must reset** (`schedule_published_at` is "never cleared", so a copy must not carry it). `league_slot_uses` belong to specific club slots: not copied. | helper census 2026-11-03; DATA_DICTIONARY league_* sections | The list on the "what copies" tab. Re-verify each table; this is a helper's census. |
| Reopen: the window **does not say ratings are gone** and the trigger does not restore them. Reopen is offered even when a newer season exists. | `supabase/migrations/377_house_league_teams_and_people.sql` ~64-83; Reopen window in `house-league-status-words.ts` | A line the window owes. The coach plan refused to build undoing a rollover; house league's Reopen is far cheaper, so the question is what a successor does to it. |
| Admin Standings page shows either way (with `published` and `showStandings` in the response); the public page needs the division published and "Show standings" on. | `.../seasons/[seasonId]/standings/`; public `.../standings/page.tsx` | What a finished season's standings read like to each audience; the switch must keep working after finish. |

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (**disagree out loud**; argue from what the code does). Stage 9 plan §0 (0a to 0i), §3, §4
(9a, 9b-2, 9c, 9e, 9f rows), §5, F21/F22; `HOUSE_LEAGUE_STAGE9A_COPY.md` §4 (the Complete, Archive and Reopen windows: ~207-258;
the public "finished" words ~225-241, 341, 363) and `HOUSE_LEAGUE_STAGE9E3_BUILD_PROMPT.md` Progress (what a finished season
already locks). `COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md` headline rulings only. `docs/agents/design/TABLE_AND_LIST_STANDARD.md`
and `COACH_SURFACE_DESIGN_ADDENDUM.md`. Follow the frame rules of `HOUSE_LEAGUE_STAGE9E_DRAWINGS.html` and
`HOUSE_LEAGUE_STAGE9D3_DRAWINGS.html` (links are in the plan's status log). House rulings that touch these screens are in the
auto-memory index under "UI conventions" (read before drawing any control, window, toolbar or list): in particular **a rare door
ends the body, never a foot row**; a window's foot is the sentence left and the buttons right; **absent beats disabled**; a waiting
count is the amber pill; every date is the shared themed date picker; anything that tells families is held until the check;
a create asks.

## What to produce

1. **A short push-back first, before drawing.** The owner will argue with it. The writer's lean, to confirm or overturn against the code:
   1. **9f is three different things under one name.** *Archive* is nearly nothing (one sentence and a billing quirk). *The
      finished-season record* is mostly already built (Q16) with two real gaps (the coach's final place; the Reopen line).
      *Start next season* is the only large piece, and it is the one with customer value: a club runs this league every year.
      Say whether they are one build or two, and which first. The lean: **Start next season is 9f-1; everything else is a small
      9f-2**, and Archive is decided in the asks, not drawn at length.
   2. **Do not build a frozen standings table.** A finished season is locked, so its table cannot change except by Reopen, which
      is deliberate. A snapshot adds a second source of truth that disagrees with the games the moment anyone Reopens and edits.
      The plan's "9f must define the frozen table" is better answered with "the locked season is the frozen table, and the
      date-driven label is renamed or retired". Argue for or against, with the Reopen-then-edit case drawn.
   3. **Start next season should not close the old season** (the coaches' rollover does, because a rep team is one program year;
      a league's Q14 allows several live seasons, and the old season still has money open). The lean: it copies **from any season**
      and leaves the old one exactly as it was. If the drawing disagrees, say what the old season then reads like.
   4. **Record a scoped line for house league in CLAUDE.md** (the owner's decision, the same shape as the club-fiscal-year line):
      "house-league seasons read in place under Q16; the one-page rule is the Coaches Portal's". Do not edit CLAUDE.md in this
      session; **put it in the asks.**
2. **Drawings** (one Artifact, tabs): *A season ends today* (the admin's Overview, Past seasons shelf, Complete / Archive / Reopen
   windows, the coach's finished card, the family's public page: what each reads now, desk and phone); *Archive* (keep, retire or
   give it a job; what a family and the shelf read); *The finished record* (the admin Standings page, the family's Final standings,
   the coach's final place for the 30 days; a Reopen-then-edit case; the Reopen window with its missing ratings line); *Start next
   season* (the doors: the Past seasons shelf row and the finished Overview's end, who sees it; the window or steps with the
   carry toggles on the one list above, defaults ticked and why; how the dates shift, with the shared date picker; the name; the
   result: a draft "Getting ready" season with no club time, coaches listed but un-invited until Publish, publish flags reset, and
   what is said first about what does **not** copy; a phone); *Edges* (a copy while the old season still has money owing; Reopen
   after a successor exists; an age group on its own calendar, Q19; the free League floor's one-season cap and what archiving
   frees; a season the admin forgot to complete); a **Since 9e** tab checking each frame against Q16, the 9e-3 locks, the
   signed-in-family rulings and the club-time rulings.
3. **The asks**, numbered **9f·1…**, each with a recommendation, answerable by paste-back on the page. Likely ones: Archive's job
   (keep as is, retire the status, or "leave the public index after a time"); a frozen table or the locked season; what the
   coach reads after finish (a "Final place" line, how long); where Start next season lives and who may press it (the league
   runners only; registrar and treasurer unruled); copy from any season or only a finished one; whether it closes the old season;
   exactly what copies (the list above), including the coaches (name and email carried, invited at Publish, 9c·10) and the budget
   seed (9b·11, unruled); how dates shift and how the name is proposed; Reopen when a successor exists; any end-of-season family
   or coach notice (none ruled: recommend none, and say why); how long a finished season stays on the public index and the switcher
   (no retention ruling exists); whether Start next season is plan-gated (**flag for /strategy, do not decide**); the CLAUDE.md line.
4. **Records, not code:** a §0j block in the Stage 9 plan with the asks (after 0i), the plan's 9f row and §9 updated, a PM brief item,
   a TODO line, and the auto-memory note. Note the stale dictionary line ("archived is terminal") and the Reopen-window gap as
   findings for the build, not fixes now. A Product Owner summary in the conversation (what an admin, a coach and a family see
   differently). Do not commit until the owner says; then only your own hunks.

Then print the next step's prompt (the /marketing words pass, once the asks are ruled) and stop.
