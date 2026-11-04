# House League Stage 9f-1: Finished, honestly (build prompt)

> **Written 2026-11-04**, after the owner ruled asks **9f·1–9f·17** (plan `HOUSE_LEAGUE_STAGE9_PLAN.md` §0j) and accepted the words
> (`HOUSE_LEAGUE_STAGE9F_COPY.md`, every open question as recommended, 2026-11-04). **Paste this into a new chat on `dev`.**
> Size **S**. **No migration expected** (see "Archived seasons that already exist"); if you find one is needed, `ls supabase/migrations`
> first: the highest on 2026-11-04 is **429**.
>
> **Binding, do not reopen:** 9f·1 (two builds; this is the first), **9f·2** (the locked season is the frozen table; nothing is
> stored), **9f·3, 9f·4, 9f·5, 9f·6, 9f·7**, and CLAUDE.md's **9f·17** line: *"House-league seasons read in place under Q16 (locked,
> Money and Email families open). The one-page closed season is the Coaches Portal's rule. This is deliberate, not drift."* **Do
> not** add a one-page closed season, a season dial, or a coaches-portal branch to house league.
> **Not this build (9f-2, a later prompt):** "Start from" in the Create season window, the rare door "Start next season from this
> one…", the carry-over list, the marks on a new season, **9f·16 (the plan gate: `Proposed`, not ruled, build no gate)**. The word
> list below holds only 9f-1 strings; the 9f-2 strings are in copy §14.1 and are not yours.
>
> **Read first, in this order:** (1) plan §0j (lines 367–424: the rulings and the "Found on the way" block); (2) copy doc
> `HOUSE_LEAGUE_STAGE9F_COPY.md` Part A (§1–§6) and **§14, the binding word list**; (3) the drawings
> https://claude.ai/artifact/UN6Su7DsmAU8tcLyAu1d4Z (source `HOUSE_LEAGUE_STAGE9F_DRAWINGS.html`): **tab 2 "A season ends today"**
> (s1 finished Overview, s3 Complete window), **tab 3 "Archive"** (s4–s7), **tab 4 "The finished record"** (s8 admin standings,
> s9 "Final means completed", s10 coach final place, s11 Reopen then correct, s12 Reopen window), **tab 6 "Edges" 2 and 4** (Reopen
> after a newer season; the free League plan); (4) `BUSINESS_DECISIONS.md` lines 35–55 ("House League 9f·5", Decided) and
> `PLAN_PRICING_FACTS.md` line 118; (5) `lib/tournament-slot.ts` and `tests/unit/tournament-one-at-a-time.test.ts`, the tournament's
> same rule, which is your model.
>
> Re-verify every lead below before building on it: other sessions share this working copy. Stage **explicit paths only**, commit only
> your own hunks, check `git diff --cached --name-only` before every commit, **commit only when the owner says**, on `dev`.
>
> **Recommended model: Opus 5.5, one session.** Before any code, present the Product-Manager UX summary below (the repo's rules make it
> a blocking step) and a task list. Update the Progress block after each Part. Reading and searching go to helpers (Sonnet); a
> helper's summary is a lead, not evidence.

## ▶ Progress (read first when resuming)

- **2026-11-03 · Parts 1–5 BUILT (uncommitted), Part 6 in progress.** Archived league seasons counted read-only: **dev 0**
  (5 registration open, 3 running, 1 registration closed, 1 getting ready, 2 completed), **prod 0** (prod has no house-league
  seasons at all), so no data migration and no owner ask. Every build decision taken as written. Words for §6 live in
  `lib/free-floor.ts` (`seasonCapBody`, `reopenRefusal`, `REOPEN_CAP_ERROR`) beside `CAP_MESSAGES`; the Reopen refusal reaches
  the window as `MoveWords.refused`. "Newer" is `newerSeasons` in `lib/house-league-season.ts` (the switcher's own key).
  Checks: focused tests 1070/1070; full unit suite 13479/13486 (the 7 failures are other sessions' files: PhoneWindow,
  plan-billing-usage, stage-6 walk, seed-plan-ending-walk, ExpenseFormWindow); `tsc` clean; spelling, dates, dictionary,
  observability pass; ESLint could not run (config names a `react-hooks` plugin that is not installed). Facts doc line 118
  waits for the commit hash.
- **2026-11-03 · `/review` done (high-risk tier, 4 lenses, 0 Critical/High).** Fixed: the Reopen window's public-site sentence
  now reads `publicSeasonState` itself (it promised "Ended Aug 28" / "Playing now" where the site shows "Ended Aug 28, 2025" /
  "Starts {date}"); the birthday read loads divisions for live seasons only; two stale dictionary cites; a stale comment.
  Accepted, as the tournament's same rule does: the cap is a read-then-write (two simultaneous Reopens on a free club could both
  pass; floor is flag-off). Owner word question open: the Reopen refusal tells a club whose holder is open for registration to
  "Complete it first", which that season cannot do yet (copy §6.2 splits only the getting-ready case). Tests 1156/1156, `tsc`
  clean. Next: `/docs`, the walk.
- **2026-11-03 · `/docs` done.** `lib/help-content/house-league.tsx` only: Archive retired in the lifecycle, delete and
  closing-out sections ("archive season"/"archived" kept as search keywords on Finished and Closing out); the free League
  article says "One season at a time" (the four holding states, a finished season holds nothing, both named refusals);
  public labels say "Ended {date}" and "Final standings" only once completed; the coach line's final place and the
  finished page's missing Schedule section; Complete erases ratings, fees *and refunds* stay open; Reopen's window lines.
  No anchor renamed. Spelling check passes; `measure:help` flags no section this touched.
- **2026-11-03 · Walk written, ledger §449 (owed).** https://claude.ai/artifact/FZRSfkFFfX8tgL3MoHHrHP (source
  `HOUSE_LEAGUE_STAGE9F1_WALK.html`), 26 steps A–F. Fixture `.probe/9f1-walk/fixture.mjs`: three throwaway dev clubs
  (`walk-9f1-club`, `walk-9f1-legacy`, `walk-9f1-free` with `free_floor` on it only) and four `@dev.local` sign-ins;
  `--reset` removes them. Built once on dev; the public pages were read back and match the walk (Ended Oct 25 chip and row,
  Final standings only on completed/archived, "This season has concluded." on the archived one, Hawks 1st 2-0-1 5 pts).
- **2026-11-03 · COMMITTED `9e6795518`** on `dev` (33 files: the code, tests, dictionary `league_seasons` hunks, help, walk,
  ledger §449), by explicit pathspec; another session's three staged app-icon files were left staged. Before it: focused
  tests 1156/1156, help tests 19/19; `tsc` errors only in another session's uncommitted tournament branding files (none in
  this build's). Hash recorded in plan §0j, the TODO 9f line and `PLAN_PRICING_FACTS.md` line 118 (separate commit);
  `/strategy` asked to flip `BUSINESS_DECISIONS.md` 9f·5 to built. **Next: the owner's walk §449**, then the 9f-2 prompt.

## What a person sees after this build (the PM / UX summary to present before any code)

- **A league admin (owner, club admin, league admin):** "Archive" is gone. A finished season is **Finished**, and its Overview ends with
  one rare door, **Reopen**. The **Complete** window now says **"Player ratings are erased."** and its money line says fees *and
  refunds* stay open. The **Reopen** window says the public site will list it as "Ended {date}" (or "Playing now"), that ratings were
  erased and don't come back, and names any newer season as **not changed**. A registrar and a treasurer see none of these doors, as today.
- **A family or anyone with the link:** a season past its last day that the club has not completed reads **"Ended Aug 28"** with
  **Standings →**, never "Final standings". Only after the club completes it does the page offer **Final standings →** and the
  standings page is titled **Final standings**. The old header chips "Season complete", "Archived" and "Season active" are gone (a
  finished season has no chip; a running one says Starts / Playing now / Ended). "This season has been archived." becomes "This season
  has concluded."
- **A team's coach:** for the 30 days the finished team page stays open, one line **Final place: 2nd of 6 · 8-3-1 · 17 points**
  (or "Tied for 3rd"), only if families could see the table, with **See the final standings**. The empty Schedule heading and its link
  are gone.
- **A free League plan club** (the plan is parked: flag off, no customer meets this today): one season at a time, counting only
  getting-ready, registration-open, registration-closed and running seasons. A finished season holds nothing, so last year no longer
  blocks next year. Reopen is refused, in words on its window before the tap, when it would make two live seasons. Paid plans are untouched.
- **Role differences:** none new. Status moves stay with the people who can run the league (`LEAGUE_RUNNER_ROLES`,
  `lib/house-league-access.ts:45`).

## Facts checked in the code on 2026-11-04 (a helper's map, re-read by the writer; re-check before relying)

1. **Archive today** lives in four places. The words and doors: `lib/house-league-status-words.ts`: `StatusMove` includes `'archive'`
   (:19), `MOVE_TO.archive` (:28), `movesFrom('completed')` returns `['archive','reopen']` (:42), the Archive window (:185–200), the rare door
   `rareDoor('archive')` (:228). The server: `ALLOWED_TRANSITIONS.completed = ['archived','active']` and `archived: ['active']`
   (`app/api/admin/house-league/seasons/[seasonId]/route.ts:34–35`). The page: `(['complete','archive','reopen'] as const)` at
   `app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx:185`, rendered :307–316. The public page: `app/[orgSlug]/league/[seasonSlug]/page.tsx:258`.
2. **Archive's side effects (§0j "Found on the way"), decided from the evidence.** Each is something Archive made *different* from
   Complete that no one designed; retiring Archive resolves all four by making an already-archived season behave as a completed one:
   - *Public header chip:* `STATUS_LABEL` (`page.tsx:30–37`) has `completed: 'Season complete'`, `archived: 'Archived'`, `active: 'Season active'`;
     rendered at :108–110. All three are 9a-retired words (9a copy §8). The row tag comes from `publicSeasonState`
     (`lib/house-league-season.ts:162–171`), which returns `'Final standings'` for an ended running season (:169) and null for finished.
   - *Club setup checklist "runs house league":* `lib/club-checklist.ts:76–77` counts seasons with `.neq('status','archived')`; the same
     filter is in `app/api/admin/org/startup-tasks/route.ts:95–99`. An archived-only club is told it has not run house league. Drop the filter.
   - *Birthday cut-off card's sports:* `lib/birthday-cutoff.ts:73` (`if (s.status === 'archived') continue;`) and the server read
     `lib/birthday-cutoff-server.ts:22` skip archived seasons, so a sport run only in an archived season loses its card. A completed
     season counts. Count archived too (and fix the comments at `birthday-cutoff.ts:23,47`).
   - *The 30-day clocks:* **already correct, nothing to build.** `finished_at` is stamped only on the *first* move into a finished status
     (`supabase/migrations/377_house_league_teams_and_people.sql:70–76`: `IF OLD.status NOT IN ('completed','archived')`), and cleared
     on Reopen (:78–80). Completing then archiving never restarted it; the §0j line "does not restart the 30-day clocks" was a
     statement of fact, not a defect. The same trigger erases ratings on the first finish, for `archived` too (:73–74), so the Complete
     and Reopen lines are true for legacy rows.
3. **The free League count.** `lib/free-floor.ts:56–58` `houseLeagueSeasonCap` (1 on the floor), :73–77 `CAP_MESSAGES`, :84 `leagueCapHit`.
   Enforced once, at create: `app/api/admin/house-league/seasons/route.ts:44–61` counts `.neq('status','archived')` (so a *completed*
   season holds the slot) and returns `leagueCapHit('league_season')` with 403. **Reopen has no check:** the status PATCH
   (`seasons/[seasonId]/route.ts:196–232`) allows `completed|archived → active` for everyone. The refusal window is
   `components/admin/LeagueCapUpgrade.tsx` (:9 title, :15 body, modal :55+); it is opened from `CreateLeagueSeasonDialog.tsx:55`
   via `app/[orgSlug]/admin/house-league/page.tsx:172,183`.
4. **The tournament's version of this rule** is the model: `lib/tournament-slot.ts` (`holdsSlot` :28, `needsFreeSlot` :36–38,
   `readSlotHolders` :53–60, holder named in the refusal), words `RECORD_WORDS.needsSlot` (`lib/tournament-status-words.ts:112`), tests
   `tests/unit/tournament-one-at-a-time.test.ts`.
5. **Retired words in the DELETE route:** `seasons/[seasonId]/route.ts:271` and :274 both end "Archive it instead." (and the comment at
   :258 says a season "ends by being archived"). They point at a door that goes. New text: copy §3 `arc.delete.api`. The file's comment in
   `lib/house-league-status-words.ts:233–236` (`deleteSeasonWords`) and `tests/unit/house-league-season-delete.test.ts:10` say the same; fix the comments.
6. **Coach team page** `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx`: the finished notice :81–83, the Schedule section
   :85–98 (heading :87, link :97), the Scores section :100–113 with the standing line :103–109 (link `STANDINGS_WORDS.coach.link`).
   The standing is read in `lib/house-league-coach.ts:214–215` and **only for `view === 'open'`**; that is why the finished page has
   no line. `standingOf` :305–307; the line builder `coachStandingLine` is `lib/league-standings.ts:266–273`; the coach words :256–260.
7. **The standings page** `app/[orgSlug]/league/[seasonSlug]/standings/page.tsx`: title `{W.title}` :76 (`STANDINGS_WORDS.title`,
   `lib/league-standings.ts:195`). It already has `season` (:54). **The "Final standings →" link is already built**
   (`page.tsx:269`: finished → "Final standings →", active → "Standings →"); do not rewrite it.
8. **Complete / Reopen windows** are `moveWords` (`house-league-status-words.ts:162–184` Complete, :201–216 Reopen), shown by
   `components/admin/kit/club/league/SeasonStatusWindow.tsx`, which already prints a server refusal (`data.error`, :55) but knows
   nothing about other seasons. **Reopen's new facts** (newer seasons, the free-plan holder) must come from the season GET
   (`seasons/[seasonId]/route.ts`, the `NextResponse.json({ season, deletable, … })` block at :90–118) into `MoveFacts`
   (:49–60) via the page's `facts`. "Newer" = started after this one, ordered as `newestFirst` in `lib/house-league-season.ts` (start
   date, then created) does.
9. **Existing "archived" rows read as finished everywhere already:** `isFinishedLeagueSeason` (`lib/house-league-access.ts:51–53`),
   `seasonState` → "Finished" (`house-league-season.ts:116`), the shelf (`seasonGroup`), `league/page.tsx:48`, `money/page.tsx:112`,
   `league-signup-status.ts:122`, `CLOSED_SEASON_STATUSES` is coach-side and unrelated. The public season page loads through
   `getLeagueSeasonBySlug` on the admin client (`lib/db.ts:2449`), so the anon RLS policy that omits `archived`
   (`supabase/migrations/020_house_league.sql:170–172`) does not hide it.
10. **Dictionary:** `docs/agents/db/DATA_DICTIONARY.md` `league_seasons` Gotcha 2 (:6710) says status is forward-only and
    "`archived` is terminal", with stale line references; the `status` entry (:6734) repeats "forward-only". Both are wrong: completed and
    archived both go back to active. Its `getLeagueSeasonBySlug` cite (:6725) says `lib/db.ts:3009`; it is now :2449.

## Build decisions the prompt makes (say so in your report; the owner can overrule)

- **Archived seasons that already exist read exactly as completed ones, by code, with no data migration.** Keep `'archived'` in the
  CHECK, in `isFinishedLeagueSeason`, and `archived: ['active']` in `ALLOWED_TRANSITIONS` (a legacy row needs its way back;
  `tests/unit/house-league-gate-guard.test.ts:93` pins it). Remove only the *way in*: `completed` no longer lists `'archived'`, and
  the Archive window, door and move are deleted. **Before building, count archived league seasons on dev and prod** (read-only SQL via
  the usual probe route) and report the numbers. If prod has any, **stop and ask the owner** whether to move them to `completed`
  (a data migration, plus a dictionary line); code does not need it either way.
- **The free count is one shared module, modelled on `lib/tournament-slot.ts`:** a new `lib/league-season-slot.ts` with
  `SLOT_STATUSES = ['draft','registration_open','registration_closed','active']`, `holdsSlot(status)`, `needsFreeSlot(from, to)`
  (moving from outside the set into it: only Reopen from `completed|archived`), and `readSlotHolders(db, orgId, exceptId?)`. The create
  route and the status PATCH both use it, so the words, the count and the server cannot disagree. **No plan value moves**
  (`lib/plan-config.ts` untouched; the cap stays 1 / 1 / 8).
- **The refusal names the holder.** The 403 body from `leagueCapHit('league_season')` also carries `holder: { name, status }`; the
  modal picks the named sentence for a running/open holder or a getting-ready holder, and the generic fallback only when none is
  named. `CreateLeagueSeasonDialog` passes the holder to `onCapHit`, `house-league/page.tsx` to `LeagueCapUpgradeModal` (the season
  page's use of the same modal for divisions and teams is unchanged).
- **Reopen is refused twice:** the season GET carries `reopen: { newer: string[]; blockedBy: { name; status } | null }` (for a finished
  season only), the page puts it in `facts`, and `SeasonStatusWindow` shows the refusal lead in place of "What changes" with the Reopen
  button **absent** and the only button **Close** (copy §6.2); the PATCH also refuses (422, copy `free.reopen.api`) so a direct request
  cannot skip the window. Both read the same module.
- **The Reopen window picks one public-site sentence by the dates** (`ro.public.ended` when the season's last day has passed,
  `ro.public.playing` otherwise), and one newer-season sentence by count (one, two, three or more).
- **One chip function.** The season page's header chip comes from `publicSeasonState` (so a season is never named two ways); a finished
  season shows no chip. `STATUS_LABEL` is deleted. `publicSeasonState`'s ended branch returns `Ended {dayLabel}` (neutral tone on the
  public side).
- **Final place line:** `coachStandingLine` gains a `final` option that prefixes "Final place: "; the coach read computes the
  standing for `view === 'open' || view === 'finished'`; a `none` kind (nothing scored) writes **no line** on a finished page. The link
  reads `See the final standings` on a finished page, `See the standings` on a live one.
- **Standings title:** "Final standings" when `season.status` is completed or archived, else "Standings". The sub line stays the season name.

## Parts (build in this order; stop and update Progress after each)

**Part 1 · Archive is retired.** Delete the `archive` move, its window words, the rare door and the `'archive'` entry in the page's
`rare` list; `movesFrom('completed')` becomes `['reopen']`; `ALLOWED_TRANSITIONS.completed` becomes `['active']` (keep `archived:
['active']`). Reword the two DELETE refusals (copy `arc.delete.api`) and the stale comments (:258, `deleteSeasonWords`'s header,
`house-league-season-delete.test.ts:10`, `house-league-access.ts:21,26–27`, the page header comment :14–16). Make already-archived rows behave as
completed: drop the `archived` filters in `lib/club-checklist.ts:77`, `app/api/admin/org/startup-tasks/route.ts:95–99`,
`lib/birthday-cutoff.ts:73` and `lib/birthday-cutoff-server.ts:22`. Public: delete `STATUS_LABEL` and the archived sentence
(`page.tsx:30–37,258`), draw the header chip from `publicSeasonState`. Dictionary: correct `league_seasons` Gotcha 2 and the `status`
entry per fact 10; `npm run refresh:snapshots` only if the dictionary check asks.

**Part 2 · "Final" means completed, "Ended" means the calendar.** `publicSeasonState` ended branch → `Ended {date}`
(`house-league-season.ts:169`); the standings page title by status (copy `pub.fin.title`); the Reopen window's two public-site
lines become the one sentence by dates (copy §2). Leave the existing "Standings →" / "Final standings →" links as they are.

**Part 3 · Complete and Reopen lines.** Complete: add **Player ratings are erased.** after the public-site line and change the money
line to **…mark fees received and record refunds.** Reopen: the ratings line, the newer-season sentences, the facts they need (fact 8),
all in `moveWords` / `MoveFacts` so one place owns the words; `SeasonStatusWindow` renders them without a new layout.

**Part 4 · The coach's final place.** Fact 6. Compute the standing for the finished view when the table was public (division
schedule published and Show standings on, `house-league-coach.ts:215`), prefix "Final place: ", swap the link word, and remove the
Schedule heading and its "See the season's schedule" link when `view === 'finished'` (keep the live page byte-for-byte). The guards
`tests/unit/house-league-coach-read-guard.test.ts` and `house-league-9d3-coach.test.ts:134` pin parts of this file; re-read them first.

**Part 5 · The free League plan counts live seasons.** `lib/league-season-slot.ts` (above); the create route uses it instead of
`.neq('status','archived')` (`seasons/route.ts:44–61`); the status PATCH refuses a Reopen that needs a free slot; the season GET carries the
`reopen` block; the refusal words come from copy §6 and live where `CAP_MESSAGES` / `CAP_BODY` do today (`lib/free-floor.ts:73–77`,
`components/admin/LeagueCapUpgrade.tsx:9,15`), the modal choosing named or fallback. **Facts doc:** update `PLAN_PRICING_FACTS.md`
line 118 from "not built" to "built {hash}, 9f-1" and run the drift check at the bottom of that doc (flag any drift to `/strategy`,
never edit a number); ask `/strategy` to flip the `BUSINESS_DECISIONS.md` 9f·5 entry's "Not built" to built. No plan-config value moves.
`/accounting` is **not** triggered: nothing here changes what FieldLogicHQ charges or collects.

**Part 6 · Words, spelling, help, tests, hand-off.** See below.

## The word list (binding; pasted verbatim from copy §14 on 2026-11-04)

| String | Where it shows | Who reads it | Section |
|---|---|---|---|
| Money stays open: you can still mark fees received and record refunds. | Complete window (replaces "…received.") | league runners | 1 |
| Player ratings are erased. | Complete window, after the public-site line, before "Families are not emailed." | league runners | 1 |
| Your public site lists it as Ended {Aug 28} until you complete it again. | Reopen window (last day passed) | league runners | 2 |
| Your public site lists it as Playing now. | Reopen window (last day not passed, or no last day) | league runners | 2 |
| Player ratings were erased when it finished. They don’t come back. | Reopen window | league runners | 2 |
| {Draft Test 2028} is not changed. · {A} and {B} are not changed. · Your {3} newer seasons are not changed. | Reopen window, when a newer season exists (one, two, three or more) | league runners | 2 |
| (removed) Finished and settled? Archive the season… | finished Overview rare door | league runners | 3 |
| (removed) the Archive window: title "Archive {season}?" and "Archive the season?", lead, four changes, loose end, foot, "Archive season", "Archiving…" | status window | league runners | 3 |
| Only a season that has not opened registration can be deleted. · This season already has families, teams, games, email or money entries attached, so it can’t be deleted. | the season DELETE route’s refusals (the sentence "Archive it instead." goes) | league runners | 3 |
| This season has concluded. (for an archived season too) | public season page | families | 3, 4.2 |
| (removed) "Archived", "Season complete", "Season active" header chips | public season page | families | 3, 4.2, 4.3 |
| Ended {Aug 28} | public season row and season page header chip, in place of "Final standings" and "Season active" | families | 4.1 |
| Starts {date} · Playing now | the season page header chip, from the shared function | families | 4.2 |
| Final standings | the standings page title (completed or archived season only); "Standings" otherwise | families | 4.2 |
| Final place: {2nd} of {6} · {8-3-1} · {17 points} · Final place: Tied for {3rd} of {6} · … | the coach’s team page, 30 days after completion, only if the table was public | team coaches | 5 |
| See the final standings | the coach’s link on a finished page ("See the standings" stays on a live one) | team coaches | 5 |
| (removed) the empty "Schedule" heading and its "See the season’s schedule" link | the coach’s page on a finished season | team coaches | 5 |
| One season at a time on your free plan | refusal window title (Create season) | free League club | 6.1 |
| Your free League plan runs one season at a time, and {Fall Ball 2027} holds it. Once you complete it, you can start the next. It stays on your site. League Plus runs several seasons and age groups side by side. | refusal window body, holder running or open | free League club | 6.1 |
| Your free League plan runs one season at a time, and {Draft Test 2028} holds it while it’s getting ready. League Plus runs several seasons and age groups side by side. | refusal window body, holder getting ready | free League club | 6.1 |
| Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next. League Plus runs several seasons and age groups side by side. | refusal window body, fallback (no single holder to name) | free League club | 6.1 |
| Your free League plan runs one season at a time, and a finished one stays on your site. Complete your current season to start the next, or upgrade to League Plus to run several seasons. | the route’s error text | free League club | 6.1 |
| Your free League plan runs one season at a time, and {Fall Ball 2027} isn’t finished. Complete it first, then you can reopen this one. · Your free League plan runs one season at a time, and {Draft Test 2028} is still getting ready. · League Plus runs several seasons and age groups side by side. · Close | Reopen window, replacing "What changes"; the Reopen button is absent | free League club | 6.2 |
| Your free League plan runs one season at a time. Complete your current season before you reopen this one. | the route’s error text for Reopen | free League club | 6.2 |

Words **not** to change: "Running" in the Reopen lead (copy Q5), "This season is currently active. Registration is closed." (Q6), the
standings sub line (Q4), "Create season" (Q9). No exclamation marks, no stage names, no plan-gate wording for Start next season.

## Rules that bite

- **One spelling, everywhere a customer can read it** (AGENCY_RULES, owner 2026-08-24): `npm run check:spelling` runs in
  `verify:changed`. Nothing in the list trips it, but you will touch strings near ones that might: "Canceled" is build-gated, "House League"
  is lowercase in prose, clocks go through `formatTime()` ("8:00 a.m."), dates through `formatStoredDate` (the chip uses
  `dayLabel`: "Aug 28", with the year only when it is not this year; the status windows pass `withYear: false`). A name ending in s
  takes `possessive()`. Before adding a word with a known variant, grep for the other spelling.
- **House league says "season"; "fiscal year" is the club's money period and never appears here.**
- **Absent beats disabled** (9a·4): the Reopen button is not drawn when the free plan refuses it.
- **Do not add a thirtieth finished-season branch** and do not touch the Coaches Portal's one-page rule (CLAUDE.md, 9f·17).

## Guard tests to change or add (find these; they pin the words that move)

Change (each currently asserts a retired word or door):
- `tests/unit/house-league-public-seasons.test.ts:26` expects `'Final standings'` for an ended running season; becomes `Ended Aug 30`.
  :54 `doesNotMatch(... Season active|Season complete)` is on `league/page.tsx`; add the same absence on the season page and on `STATUS_LABEL`.
- `tests/unit/house-league-season-page.test.ts:65` (`rareDoor('archive')`) goes; :77–86 (doors and the server table agree, per status) holds if
  both sides change together; :119–120 (the `['complete','archive','reopen']` regex) becomes `['complete','reopen']`.
- `tests/unit/club-stage4c2-settings.test.ts:48–53` ("leaves out a sport only an archived team or an archived season carries"):
  an archived *season* now counts; keep the archived-*team* half.
- `tests/unit/house-league-gate-guard.test.ts:92–93` keeps `archived: [... 'active']` and `completed: [... 'active']`; assert `completed` no
  longer lists `'archived'`. :174 only names "archive" in a test title; reword it.
- `tests/unit/league-standings.test.ts:157–172` (the coach line) gains the `final` form; add the title/link words test.
- `tests/unit/house-league-coach-read-guard.test.ts:47` and `house-league-9d3-coach.test.ts:134` pin the coach page; adjust to the finished-view standing and the removed Schedule section.
- `tests/unit/house-league-season-delete.test.ts:10` comment only.
Add: `tests/unit/league-season-slot.test.ts` (modelled on `tournament-one-at-a-time.test.ts`: the four holding statuses, finished holds nothing,
`needsFreeSlot` only for Reopen, the create route and the PATCH both read the module, the refusal sentences); a `moveWords` test for the
Complete ratings and refunds lines, the Reopen sentences by dates and by newer count, and the absence of every Archive string; a source-guard that
`ALLOWED_TRANSITIONS.completed` has no `'archived'`. Grep `tests/` for `Archive`, `Season complete`, `Season active`, `one active season`
and `houseLeagueSeasonCap` once more at the end; none should survive except as an absence assertion.

## Help, demos, docs

- **`/docs` is owed** (a user-facing flow changed). In-app help hits to fix, all in `lib/help-content/house-league.tsx`: :16–17 (the lifecycle
  article's `keywords`/`searchText` list "archive season", "archived"), :26 ("Finished: completed or archived"), :28 (the sentence naming
  "Complete the season, Archive the season and Reopen the season"), :76–83 (**the free League plan article**: "One active season at a time",
  summary "one capped season"), :98 (the Create-season article's `searchText` "archive instead"), :193 (the Delete article: "the season ends by
  being archived instead"), :1608–1612 (the public-labels article says "Final standings once the season's dates have passed but it isn't
  completed yet"), :1621–1630 (**"Closing out a season"**: summary, keywords, `searchText`, and the "Archive the season" bullet). Keep `archive season`
  as a search keyword pointing at Finished. Do not hand-write them: run `/docs`.
- **Demos:** neither demo (`riverdale-minor-ball`, `riverdale-ridge`) seeds a house-league season (`lib/demo-tournament.ts`, `lib/demo-coach.ts` and
  `scripts/seed-demo-*.mjs` contain no `league_seasons`); the fixtures that do (`scripts/seed-club-fixture.mjs:854` registration_open,
  `scripts/seed-families-fixture.mjs:397`, `app/api/dev/seed/house-league/route.ts:52` active) seed no archived season. Nothing to re-seed; demos
  follow, never gate (CLAUDE.md).
- **Dictionary** (Part 1) and the data-dictionary check (`npm run check:dictionary`) ride `verify:changed`.

## Verification

`npm run verify:changed` (includes `check:spelling`, `check:dictionary`); the focused tests above (`node --test` on the changed files);
**`npm run typecheck`** (shared modules move: `lib/free-floor.ts`, `lib/house-league-status-words.ts`, `lib/house-league-season.ts`,
`lib/house-league-coach.ts`, `lib/league-standings.ts`, `lib/birthday-cutoff*.ts`; use the 8 GB heap, the default 4 GB runs out). Run the
expensive checks serially. Report anything skipped and the residual risk. New files (`lib/league-season-slot.ts`, two test files) mean the
**dev server must be restarted** before the owner walks it (`npm run dev` only; stop it before clearing `.next`).

## After the build (in this order)

1. Offer **`/simplify`** only if you added an abstraction beyond `lib/league-season-slot.ts` (that module mirrors an existing one; probably not needed).
2. **`/review`** (server rule, public data, the Reopen refusal). 3. **`/docs`** for the hits above.
4. **Walk:** write `docs/projects/active/HOUSE_LEAGUE_STAGE9F1_WALK.html` as a checkable Artifact (one purpose per walk; paste-back), with a fixture
   (`.probe/9f1-walk/`) that has: a running season past its last day never completed; a completed season with a coach on a team whose division
   was published with standings on (and one team with the switch off); a legacy `archived` season; a running season plus a finished one on a
   free League org (flip `free_floor` on that fixture org only; the flag stays off in production) to see both refusals; a newer season beside a
   finished one for the Reopen line. Add the walk to `docs/projects/active/OWNER_QA_LEDGER.md` **owed**, taking the **next free § number**
   (the highest on 2026-11-04 is §448; grep before taking one, never sort them).
5. **Commit** with explicit pathspecs on `dev` when the owner says; `git show --stat HEAD` to confirm only your files landed. Then record the commit
   hash in plan §0j and in the TODO line (`TODO.md:282`), and replace this file's Progress block.
6. Final report: the build decisions above (say which the owner can overrule), the archived-row counts, any check skipped, and what the owner must do (apply nothing
   to prod: there is no migration).

## Shared-file traps

- `lib/house-league-status-words.ts`, `lib/house-league-season.ts`, `lib/house-league-coach.ts`, `lib/league-standings.ts`, `lib/db.ts` and the
  dictionary are shared and often carry other sessions' hunks: edit narrowly, commit hunk by hunk. `git status` on 2026-11-04 already showed
  unrelated edits in `CLAUDE.md`, `TODO.md`, the 9f plan/drawings and platform-admin files.
- Do not restate a number in a help sentence or demo unless it is computed. Do not use `git add -A`.
