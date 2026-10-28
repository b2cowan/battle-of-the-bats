# House League Stage 9d-2b: Publish schedule, Changes to send, and the families' game emails (build prompt)

> **Written 2026-10-28**, after 9d-2a's walks §408–§413 all passed. **Paste this into a new chat on `dev`.** It builds the
> second half of 9d-2 from `HOUSE_LEAGUE_STAGE9_PLAN.md` §0h (rulings 9d2·1–16 and 9d2a·A–H, binding, do not reopen) and the
> drawings (https://claude.ai/artifact/TdXm5jmTEJ9qPvR3T5H9qU, version 4; source `HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html`; the
> frames are e1 ~1082 · e2 ~1130 · f1 ~1151 · f2 ~1178 · f3 ~1209 · f4 ~1225 · f5 ~1236 · g2 ~1284 · g3 ~1313). **It adds
> migrations.** Mig 385 (the season notices record) and 392–394, 397, 400 (house league's time) are already **applied to
> production** (`supabase/migrations/MANUAL_PROD_STEPS.json`, 2026-10-27); re-check that file before saying so. The highest
> migration on dev is 406 — `ls supabase/migrations` right before you create one (a peer took a number the same hour once).
>
> Re-verify every lead before building on it: other sessions share this working copy. Stage explicit paths only, commit only
> your own hunks, check `git diff --cached --name-only` before every commit. **Read "Shared-file traps" at the bottom first.**
>
> **Recommended model: Opus 5.5**, and **two sessions** (owner rule: a heavy prompt is split at a chunk boundary). Session 1 =
> Parts 0–3 (the store, Publish, editing a published game, Changes to send). Session 2 = Parts 4–7 (the emails and history, the
> coach's page, the owner moving time, the rules door, checks). The Progress block below is the hand-off; update it after each
> Part. Helpers stay on Sonnet for reading.

## ▶ Progress (read first when resuming)

- 9d-2a is complete: all eight build steps, `/simplify`, `/review`, `/docs`, walks §408–§413 passed
  (see `HOUSE_LEAGUE_STAGE9D2A_BUILD_PROMPT.md`'s Progress block for what the review fixed and the seven calls the owner
  decided on 2026-10-28).
- **Before any code — DONE 2026-10-28.** PM summary given; the four questions ruled as recommended (**9d2b·A–D**, plan §0h —
  ⚠ 9d2b·A AMENDS the prompt's backfill: games **and published teams**, because 4 of dev's 6 divisions with games had
  unpublished teams, Walk U11 among them); build defaults stated (Home/Away as facts; the coach's page shows the last-SENT
  values). Words settled by `/marketing` → `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` "Stage 9d-2b" (count word = **families**;
  undo = **Undo**; f5 offers **send later / tell families now**; the move refusal points at House league's time, not "ask an
  owner").
- **Part 1 — COMMITTED `f68640c90` 2026-10-28.** **Mig 409** (⚠ 407/408 were taken by Support console 4b the same hour),
  dev only, MANUAL_PROD_STEPS pending. ⚖ **The change record is a TRIGGER on `league_games`** (BEFORE UPDATE / AFTER INSERT,
  only when the division's `schedule_published_at` is set), not a per-route write: every writer — POST, PATCH, Postpone,
  Cancel, a put-back, and Part 5's club time move — records in its own statement. ⚖ **The send says the NET effect**
  (`lib/league-game-changes.ts`: earliest held `before` vs the game now), so Undo deletes rows and there is no
  `removed_before_send`. `slot_use_id` → `league_slot_uses(slot_id)` **ON UPDATE CASCADE** (the use's PK is its slot;
  `club_schedule_apply_changes` re-keys it when the club moves time, mig 392 §6, so games follow for free — Part 5 still
  has to move their `scheduled_at`). Functions: `league_division_schedule_publish(p_org, p_season, p_division, p_actor,
  p_games)`, `league_division_changes_send(…, p_changes, p_news)` (claims exactly the held rows the sender saw),
  `league_game_undo`, `league_games_generate_save` (atomic + locked), `league_schedule_family_count`. Proof:
  `scripts/house-league-schedule-publish-check.sql` T1–T9 passed on dev. Dev backfill marked 2 divisions (Dev House League
  2026 A/B); Walk U11 / U9 Rookie / the other two stay draft.
  - ⚠ Found by the writers census, for Part 3: **deleting a team silently deletes its games** (`teams/[teamId]` checks only
    active registrations) — refuse it on a published division. The **old `save=true` generate path**
    (`generate/route.ts` ~216) also inserts games — route it through `league_games_generate_save` or remove it.
  - Not done in Part 1 (moved to Part 3, where GameWindow is edited anyway): `gameWindowDoors` learning `published`.
    `lib/league-season-calendar.ts` and the schedule components carry another session's uncommitted edits ("Add Event") —
    commit around them.
- **Part 2 — COMMITTED `9f5025f00` 2026-10-28.** Publish schedule: header button (`showPublishButton`: runs the season,
  draft, teams published, games > 0) → `PublishScheduleWindow` (GET `schedule/publish?divisionId` = games/teams/families
  from `league_schedule_family_count`; POST → `league_division_schedule_publish`, refusals worded in
  `lib/league-schedule-words.ts`). The division's line is `SchedulePublishLine` under the time line (F3: the header has no
  subtitle slot); the schedule GET returns `publishing[divisionId] = {publishedAt, families, reached, failed, held}`.
  Generate's Save → `league_games_generate_save` (sets `slot_use_id` = the slot id); its words now say "draft". Public page
  → `publicSeasonGames` (`lib/league-game-changes-server.ts`: published divisions only, `asLastSent`), "… schedule is
  coming" + "· coming" tabs, "Moved · Was …". `LeagueDivision.teamsPublishedAt/schedulePublishedAt`,
  `LeagueGame.slotUseId/movedFrom`. 930 house-league tests pass; the committed tree type-checks (worktree).
  - ⚠ **Publish writes the pending email rows but SENDS NOTHING until Part 4** (dev sends no email anyway).
  - Not built, said out loud: the drawing's per-row "Draft" chip on every game (the line says it once; the copy section
    did not settle it — ask at the walk if it is wanted). "See the email" preview in e2 → Part 4 with the email words.
  - Standings were not gated on publish (completed games only; a draft has none) — 9e owns standings.
  - Still open from 9d-2a, for Part 3: GameWindow's Postpone/Cancel lines (`postponeSays`/`cancelSays` in
    `lib/league-season-calendar.ts`) still say "Families aren't emailed." — rewrite them as the state-true pairs (copy
    file f1) when `gameWindowDoors` learns `published`.
- **Part 3 — COMMITTED `b508c95e9` 2026-10-28** (all nine items below; no migration). Built on a temp index: the other
  session's uncommitted 9d-2a walk fixes in `GameWindow`, the schedule page, `SeasonScheduleViews` and
  `league-season-calendar` (Add Event, "Give it a new date" opens the form, list spacing/reveal) are NOT in it and stay in
  the working tree. What landed: `gameWindowDoors(status, published)` (+ `delete`); DELETE refuses a published game;
  PATCH `seen` + `updateLeagueGame(…, ifUpdatedAt)` (returns false → 409 `changed`); a draft's team change now saves, a
  published one's Home/Away are facts (409 `teamsFixed`); ⚖ **the move limit is a gate key, `placeAnywhere`**
  (`lib/house-league-access.ts`: runner AND (no club's schedule OR owner/admin)) used by `lib/league-game-place.ts`
  `placeGame` in POST and PATCH (only when start/venue/facility/text actually changes and the game is on; sets
  `slot_use_id`; free League plan unchanged); `heldGamesOf` / `childrenOnTeams` / `sendHeldChanges` in
  `lib/league-game-changes-server.ts` (the server computes `p_news`, never the client); routes
  `schedule/changes` (GET tray, GET `&gameId` = f5's family count, POST send) and `schedule/[gameId]/undo`; the schedule
  GET returns `changes` (per game kind/played) and `publishing.held` now counts GAMES shown (net), and a reader gets
  `asLastSent` games; f5 = PATCH `sendNow` (saved first; a failed send → `sendFailed` words, stays held);
  `ChangesToSendWindow` + `ChangesToSend.module.css` (amber count on the header button, Undo with its own aria-label);
  list markers via `SeasonBooking.held` + "Moved" trail chip; `SchedulePublishLine` adds the list note; team DELETE
  refused with games on a published schedule; the free plan's old generator refuses a published division. Words in
  `CHANGES_TO_SEND_WORDS` + `GAME_WINDOW_WORDS` (build words marked: "Postponed/Back on · not sent", `sent`,
  `deletePublished`, `sendNowFailed`, `teamHasPublishedGames`). 862 house-league/league tests pass; working tree and the
  committed tree type-check (the committed tree's only errors are support-console 4b's, at HEAD before this commit).
  - **Not built, said out loud:** the form doesn't LIST the division's open times — a league admin's off-time move is
    refused with the settled words (a picker is a later call); "See their email" (Part 4); "Reached 64 of 66" (Part 4,
    the send writes rows and sends nothing yet); no runtime probe of the new routes yet (Part 7's e2e).
  - ⚠ The help (`lib/help-content/house-league.tsx` ~565, ~585, ~587, ~668) still says "Families aren't emailed" and "a
    saved game is on the public schedule at once" — `/docs` in Part 7 rewrites it.
- **Part 4 — COMMITTED `670b00682` 2026-10-28.** **Mig 410** (dev only, MANUAL_PROD_STEPS pending, after 409): the
  family rows gain `sending` + `skipped` and `league_schedule_emails_claim` (the mig 378 pattern). `lib/league-schedule-mail.ts`
  `sendScheduleNotice` (claim → build each family's email at send time → `sendFamilyServiceBatch` kinds
  `house_league_schedule_published` / `house_league_games_changed` → outcome → recount; never throws) and
  `sendChangesAndTell` (wraps `sendHeldChanges`; Changes to send AND f5 go through it). Pure words in
  `lib/league-schedule-email.ts` + `SCHEDULE_EMAIL_WORDS` / `SCHEDULE_NOTICE_WORDS` / `reachedLine`; template
  `leagueScheduleNoticeHtml`. ⚖ A "games changed" email is read from the rows the send STAMPED (`notice_id`), so a
  resend says what was sent; a game played since is left out. ⚖ `failed_count` = every family still to reach (failed
  or never tried) = what "Send to the N it missed" can send; `skipped` (nothing left to say, and every row on dev — no
  key) is neither reached nor missed. Coaches copied on a change's FIRST send only; Publish copies nobody. History:
  two new Automatic rows, stopped → `resendNotice` on the season emails route. Previews: "See the email" (e2) and "See
  their email" (f2) via SendParts' MailView level (Publish's question is drawn as a form only while the email shows —
  only a form has the named back; **ask at the walk**). The division line's partial links "See them" to the season's
  history (`/seasons/{id}/notifications`). Dev e2e `.probe/9d2b-p4/e2e.ts` passed (run:
  `npx --yes tsx@4.19.2 --env-file=.env.local --require ./.probe/9d2b-p4/stub.cjs .probe/9d2b-p4/e2e.ts`). Also fixed:
  `team-move-coverage` now names Part 1's two tables.
  - **No bell in Part 4, said out loud:** 9d2·13's bell is the club's Send telling league admins their time moved
    (Part 5, the 11b bell); no ruling or settled word sends a bell on a league admin's own publish or send.
  - Build calls for the walk: a moved game is one email item with Now / Was on their own lines; Postponed-then-given-a-
    date in one send reads as a move (families never heard it was postponed); a partly-reached f5 says
    "Reached 19 of 21 families · 2 didn't send." + the others-waiting sentence (build word `sentNowPartly`).
  - Known, not mine: `check:schema-parity` lists 409/410 as dev-only until prod applies them (a gate baseline — not
    re-baselined); the committed tree's 2 type errors are support-console 4b's (`portal-free-time-give.ts`).
- **Part 4 `/simplify` `c5db241f1` + `/review` (high) `8228c9f23` 2026-10-28; walk §418 written (https://claude.ai/artifact/RJt2Q9V6BQmdHkwAHi9tez, 30 steps, owed).**
  - **Simplify:** the two send windows' "See the email" state is one hook + view in `SendParts` (`useEmailSample`, `SampleMail`); the sample's families group through `familiesFor`; the two `changeLine`s are `emailChangeLine` and `trayChangeLine`. ⚖ **Left as two copies, on purpose:** the placement and schedule senders' claim / outcome / recount (two tables, two status sets, different `failed_count` meaning, `sent_at` on one only — a shared helper would take a table name, a status list and a count rule and save ~12 lines); `placeReader` (the public page's `placeOf` is inline in a file another session is editing); `publishedLinesByTeam` reads the whole season (the by-division read swallows a failed read, which here would tell families nothing — the season read is now PAGED instead); `copyCoaches` per team (a coach of two teams gets one copy per team by design).
  - **Review fixed** (five lenses, tier high; the gate: `typecheck` ✓, 11,496 unit tests ✓, spelling / dictionary / snapshot ✓; `verify:changed`'s ESLint step crashed on another session's config, my files linted clean; migration drift = 409/410 dev-only as known): **High** — a send that died partway read "done, reached 0" forever (the notice is born `failed_count = 0`, only the end of a send raised it): counted before the first email now. **Medium** — a call that claims nothing no longer rewrites counts (a stale write could land after the winner's); a fresh `sending` row reads the notice as "Sending" on the history (not "Stopped"); each batch's rows are recorded as it returns (`sendFamilyServiceBatch` gained `onBatch`), so a request killed mid-send keeps what went; the transport answering "skipped" is a failure in production (dev keeps the quiet skip); a change that nets to nothing in words no longer reads "Sent to N families" (`silent`); the coach-copy exclusion is the parents reached WITH that team's lines (was every claimed address); `getSeasonGamesEveryStatus` is paged; the data dictionary's `failed_count` meaning; `family-email.ts`'s header list names the practice-change and the two schedule emails. **Low** — the rows read is paged; a division deleted since closes its rows; an unsendable address is skipped, not failed forever; "Cancelled: A vs B, ." dangling comma; Publish / Send say "we couldn't confirm" on no answer / a bare 5xx; the email door hides while Publish / Send is working; "Send to the N it missed" that took no one says so; the f5 `others` read can't turn a sent email into "it didn't send"; `role="alert"`, a named "See them" link, no duplicate list keys; the unused `noticeMissed` removed.
  - **Left, recorded (Low/Advisory):** a late original send can still write onto a taken-over `sending` row (the guard is the status, not a token); `byCreated` compares timestamps as strings (a refuter found the order holds for PostgREST's output); a "Schedule published" resend weeks later lists games since played; the coach copy never happens if the first send dies before it; two copies for a coach of two changed teams; "0 families emailed" for an empty division; a null preview reads as a load failure; `maxDuration = 120` unconfirmed against the host. Neither mig 409 nor 410 changed (still dev-only).
  - **New fixture / probes (dev, not committed):** `.probe/9d2b-p4/fixture.mjs` (`--reset`, `--stop`, `--stop=published`, `--remove`), `show.ts`, `e2e.ts` (now also proves the Sending state).
- **Part 5 — COMMITTED `4b2a4b45e` 2026-10-28** (plan §9 has the full entry). **Mig 411** (function-only,
  dev only, MANUAL_PROD_STEPS pending, after 409): the club's step lands `p_league.games` (move / postpone / remove) and
  `league_game_undo` refuses a club change (`'club'`). The plan moves a carried games use's games by the slot's shift; one
  that won't fit or sits on time taken back → Needs a new date (published) / off the draft (draft); played, started,
  cancelled and postponed stay. Send the changes: a "U12 games · …" row per division and slot (no tick), the callout lists it,
  the bell names game time and "N games wait in Changes to send". k5 names the slot's games. The tray hides Undo on a club
  change (⚖ built default: undoing it would put the game on time the club gave away, 9d2·3). The coach's page: one Schedule
  list (g3) — published games as last SENT + practices, from today on, "Needs a new date" after it (`CoachSchedule.tsx`
  replaces `CoachPractices.tsx`). Proof: `scripts/house-league-9d2b-part5-check.sql` passed; 11b's and the publish check,
  `.probe/11b5/e2e.ts` re-passed; 11,507 unit tests; typecheck clean; `.probe/9d2b-p5/coach.ts` read the coach page on dev.
  - **Not probed at runtime:** Send the changes' preview with games rows (needs an owner session — Part 7's e2e).
  - **[marketing] words to settle** (tagged in code): k5's draft line, the games row's "taken back" line and its non-settled
    sub-lines, the league admins' bell, `undoClub`, `changesHintLeagueGames`, `changesStatement`'s divisions clause.
  - Known, not mine: `verify:changed`'s ESLint step still crashes on the shared config (react-hooks plugin); the other red
    gates (admin type, index coverage, org-slug callers, css selectors, root files, schema parity 409/410) are other files.
- **▶ NEXT: Part 6 ("Adjust the rules", cuttable — 9d2b·C) then Part 7 (checks, guards, /review, /simplify, /docs, walks),
  in a FRESH session.** The dev server needs a restart before any browser check (new files + migs 410, 411).
- Part 3's list, as it was handed over (all done in `b508c95e9`):
  (1) `gameWindowDoors(status, published)`: Delete only before, Cancel only after; DELETE route refuses a published
  division's game. (2) PATCH stale-window refusal: the body carries `seen: {status, updatedAt}`; update with
  `.eq('updated_at', seen)` (updated_at is hand-set by `updateLeagueGame`, no trigger). (3) Home/Away as facts on a
  published game (the form's dropdowns were already ignored by the save). (4) The convenor move limit (9d2b·B): a
  league admin's move must land on one of the division's `league_slot_uses` (kind games) — set `slot_use_id`; owner/admin
  may type anywhere (null link). Role: find how a route tells owner/admin from league admin without `userRole` on a
  season screen (house-league-season-frame guard). (5) Changes to send tray (f2): read `heldChangesOf` + `heldGames`,
  rows by kind, who hears + family count, Undo (`league_game_undo`), Send (`league_division_changes_send` with
  `sendClaim`); header "Changes to send {n}". (6) f5 urgent cancel/postpone: send later / tell families now (the claim with
  that one game's rows). (7) Postponed → Needs a new date → Moved on the admin list (movedFrom). (8) Refuse deleting a
  TEAM whose division is published (teams/[teamId] route). (9) GameWindow words (9d2a·F rewrite).

## What the owner sees after this build (the PM summary — present a version of this in the conversation BEFORE any code)

- **A division's schedule is a draft until the convenor presses Publish schedule.** Until then families see "the schedule is
  coming" on the public page and are told nothing. Publish asks once (how many households will be emailed), then emails each
  household once and the games go public. There is no unpublish (9d2·1).
- **After publishing, a game is changed by editing it, and the change waits.** Edits, new dates, new places, adds and cancels
  collect under **Changes to send** with who hears each and the household count; one ✓ makes them live and emails families
  together, one email per household. Any change can be put back before the send. A score or a note never emails.
- **An urgent cancel (or postpone) goes at once**, from the game's own window, after one question; anything else waiting keeps
  waiting (f5; 9e's rainout will reuse it).
- **Before publishing a game is deleted; after, it is cancelled** and stays on the schedule struck through (9d2·9). A postponed
  game leaves its week for "Needs a new date" and, once given one, reads **Moved** with its earlier date (9d2·10).
- **The coach's team page lists the team's games** beside its practices (9d2·7). The public team page stays games-only.
- **When the owner moves a division's game time after publishing, its games move with it and wait in Changes to send**; the
  club's Send the changes tells the league admins and families hear once, from the convenor's send (9d2·13).
- Who can do what: the convenor / league admin / owner / admin run all of it; a registrar or treasurer reads nothing here (the
  one gate, `houseLeagueRefusal`, is unchanged).

## Before any code (AGENCY_RULES, blocking)

1. **The product-manager UX summary**, in the conversation (above is the raw material).
2. **Words.** The drawings' family email (f3) says "Words provisional". The Publish confirm (e2), Changes to send (f2), the
   urgent cancel (f5), "Needs a new date" → "Moved", the new history rows ("Schedule published", "Schedule changes"), the
   coach page's games, the public "schedule is coming" line, and the `Families aren't emailed.` lines 9d-2a left in Postpone,
   Cancel and Generate's Save (9d2a·F — **they become false and must be rewritten**) are all unsettled. **Run `/marketing` once,
   before code**, append the result to `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` under a "Stage 9d-2b" heading. House rules:
   "8:00 a.m.", `possessive()`, `pluralize()`, sport-neutral, "league admin", `check:spelling`, "installment" if money appears
   (it should not).
3. **Ask the owner these (build-session questions; recommended answer first). Do not ask more.**
   - **Backfill.** Today every saved game is public (9d2a·A). When publish exists, a division with games but no publish mark
     would go dark on the public page. Recommended: the migration marks **every division that already has games as published,
     silently, no email** — the mig 377 rule ("a season being played never emails because the feature turned on"). Not taken:
     leaving them draft (the public page would lose real games).
   - **The game's link to the club's time.** `league_games` has no slot link (mig 392's header says this build adds it).
     Recommended: add `league_games.slot_use_id` (nullable; set when a game is generated onto, or moved to, a division game
     slot). It is what makes "Time from {schedule}" exact instead of derived, what lets 9d2·13's "the games move with the time"
     work, and what lets moving a game be limited to the division's time (the owner ask 9d-2a left open: *"is moving a game
     limited to the division's game time?"* — recommended yes for a convenor, who cannot pick time the club did not allocate;
     the owner/admin who allocates may type anywhere. A game outside every use stays as it is and says nothing).
   - **"Adjust the rules" (health's d3).** 9d2a·G says the door arrives with this build's migrations. Recommended: build it as
     the LAST Part (6), small: games per team, twice in a day allowed, home/away tolerance, stored on the season; cut it first if
     the build runs long.
   - **Moved needs an earlier-date column.** Recommended: `league_games.moved_from` (timestamptz, the date it had) written by
     the re-date; the "Was {date}" a postponed game already shows keeps working.

## What is already built (re-read it; line numbers drift)

- **The 9d-2a screen:** `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` (a thin page) over
  `components/admin/kit/club/league/schedule/*` (`SeasonSchedule`, `SeasonScheduleViews`, `GameWindow` (read first, ✓ saves,
  Postpone / Cancel / Delete / Give it a new date), `GenerateGamesWindow`, `LeagueHealthWindow`), pure parts in
  `lib/league-season-calendar.ts` and `lib/league-game-generator.ts`, the Save in `lib/league-generate-server.ts` (the health
  mapper's file: find it with the 9d-2a entry in plan §9). Other sessions edited some of these uncommitted on 2026-10-28 ("Add Event", "Give it a new date"
  opening the new-date form, the Where block spacing) — read the working copy and `git log` before assuming.
- **The game writes:** the routes under `app/api/admin/house-league/seasons/[seasonId]/schedule/` (`route.ts`, `[gameId]`,
  `generate`) and `lib/league-generate-server.ts`. **All of them must learn the published state** — grep every writer of `league_games`
  (`clashReportForLeagueRows` is called in several; guard `club-stage6a-guard` pins them). The review left two things for
  here: the PATCH route accepts a stale window (postponing a finished game) — refuse it by comparing what the window SAW
  (status and `updated_at`) at the press; and two simultaneous Generate Saves could both insert — take a per-division advisory
  lock in the SQL function that saves (never lock a row inside a line trigger; that deadlocked 9b-2).
- **The pencil's Home/Away dropdowns on an existing game are ignored by the save** (carried from the 9d-2a review). The
  published-game edit is a rewrite of this form: either save the team change (it emails both teams' families and, because a
  team change moves a game between two coaches' pages, says so in f2) or show the teams as facts. Recommended: show them as
  facts — a different matchup is a new game (cancel this, add that), which the change record already explains.
- **The notices precedent:** mig 385's `league_season_notices` (kinds `teams_published`, `practices_changed`; CHECK replaced
  by mig 400), `league_placement_emails` (per-family rows, `notice_id`), `family_email_recipients` (person ids + family name,
  never addresses), `family_messages.season_id`. One send = `deliverFamilyEmail` (`lib/families-email.ts`); service-mode batch
  = `sendFamilyServiceBatch` (`lib/family-email.ts`, reaches unsubscribed families — the placement notices use it; so should
  these, as service notices about their child's games). `lib/house-league-placement-mail.ts` and
  `lib/club-schedule-league-mail.ts` (11b Part 5: coaches + families + the bell to league admins, one Automatic row per season)
  are the two nearest models. **Argue in the plan whether Publish and Send write through the same SQL claim as
  `league_division_publish` (one transaction with its email rows) — recommended yes.**
- **The held-change precedent:** the club scheduler's "Send the changes" (`lib/club-schedule-send.ts`, table
  `club_schedule_sends`, fingerprint checked at the press). A division's Changes to send is the same shape per division.
- **The publish mark:** `league_divisions.teams_published_at` exists (mig 377). **Publish schedule is offered only once the
  division's teams are published (9d2·8).** The schedule mark is a separate column on the division (`schedule_published_at /
  _by`), written only by a `league_division_schedule_publish` function, never unpublished.
- **The public page:** `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx` + the all-status read added in 9d-2a. It must
  show only PUBLISHED divisions' games and "The schedule is coming." for the rest (g2). Games only; practices are never public.
- **The coach's page:** the one-screen house-league team page (9c; 11b·C added practices). Add the team's published games
  (g3) — signed-in, so practices and games together. The Coaches Portal is untouched.
- **The history:** the season's sent history (9d-1; `families/EmailLog.tsx`, `/seasons/[id]/emails/history`) already shows
  Automatic rows; this build adds **Schedule published** and **Schedule changes** (f4). Automatic notices are never counted
  against the 3-a-day allowance (Q12c).

## Build, in this order, each committed after its checks

**Part 1 · The store and the pure parts (migration, then tests).**
- Migration(s): `schedule_published_at/_by` on `league_divisions`; `league_games.slot_use_id`, `moved_from`;
  a division change record (`league_game_changes`: division, game, kind — `added | moved | place | cancelled | postponed |
  given_date | removed_before_send`, before/after values, who, when, `sent_in` null while held); `league_season_notices.kind`
  CHECK widened (`schedule_published`, `games_changed`); the SQL functions `league_division_schedule_publish` (mark + notice +
  recipient rows in one transaction, advisory-locked on the division, refuses when teams are unpublished or already published),
  `league_division_changes_send` (claims the held rows and the households once, atomic, a second press is a no-op that says so),
  and the atomic generate-save with its lock. **Backfill per the owner's answer.** RLS on, no policies, service role only
  (every table in 385 is). Update `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same unit
  (`check:dictionary` fails otherwise); add the migration to `MANUAL_PROD_STEPS.json`; a `scripts/…-check.sql` like 385's.
- Pure, tested: the change-record reducer (what a Send says: the net effect of several edits on one game — a game moved twice
  reads once, an added-then-cancelled game reads nothing, a moved-then-put-back game reads nothing), the household
  grouping (one per household per send, one part per child whose team's games changed), the "who hears it" rule (the game's
  two teams' families + their coaches copied; a practice change = that team's families, 9d2·2 alternative), and the
  published-state doors (`gameWindowDoors` learns `published`: Delete only before, Cancel only after).

**Part 2 · Publish schedule (e1, e2) and the public page (g2).** Header button on the division's draft; confirm window with the
household count and the foot sentence left, buttons right (`KitDialog footerStart` — wrap a string in a span); `Draft · N games`
sub-line; the public page's "coming" state and half-published divisions; 9d2·11 becomes "the generator lists only divisions
with no published games; a published division adds games one at a time"; rewrite 9d-2a's "Families aren't emailed." lines.

**Part 3 · Editing a published game and Changes to send (f1, f2, f5).** Every write route records a change row when the division
is published (inside the same transaction as the game write — never a second call that can fail alone), and writes the game
at once; the PUBLIC page keeps showing the OLD date until the Send (9d2·16: "until the league admin sends, families see the old
dates") — **argue in the plan how**: recommended, the public read prefers the last-sent values held on the change row, i.e. a
game with an unsent change reads its `before` on the public page. f2's put-back ("Put it back on", 9d2a copy) restores the
game and removes the row. f5: the urgent cancel / postpone sends the one change now, asks once, and leaves the rest held.
Stale-window refusal on PATCH. Delete before / Cancel after (9d2·9). Postponed → Needs a new date → Moved (9d2·10).

**Part 4 · The emails and the history (f3, f4).** Publish and Send mail through the service-mode batch; one email per household
per send; coaches copied; the bell to `league_admin` members (11b Part 5 `b88d488f0` precedent: owners + admins + league
admins). The two new Automatic history rows. A practice change by 11b's club Send keeps its own path and its own row — do not
merge them. **The sender's failure story:** a stopped send finishes from `family_email_recipients` (9d1·10's "Send to the N it
missed"); say what your build does.

**Part 5 · The coach's page (g3) and the owner moving time (9d2·13, 9d2·16).** The coach's games list. When the owner moves or
takes back a division's game time (the club's Send the changes), a published division's games on it move with the time /
leave their week for Needs a new date and wait in the division's Changes to send; draft games just move; played games stay. The
club's Send tells the league admins (the 11b bell); families hear once, from the convenor's send. This needs `slot_use_id`.

**Part 6 · "Adjust the rules" (d3) — last, cuttable.** The health window's foot already says the rules in words; add the door
and store the three rules on the season. Re-run the Dev House League 2026 oracle (`.probe/hl/h9d2.mts`) and say what moved.

**Part 7 · Checks and done.**
- Unit tests for every pure part; a dev end-to-end on a **rolled-back** SQL fixture (the 11b pattern, `.probe/11b4/e2e.ts`;
  the 9d-2a walk fixture `.probe/9d2a-walk/fixture.mjs` = Walk U11 + ten Sunday slots at Kinsmen Diamond A; *Draft Test 2027* =
  1 division, 10 teams, 101 families, the real publish case). Dev sends no email — assert the rows written, as 9c/9d-1 did.
- Guards that move (read each, change with the reason in the commit): `house-league-game-window-guard`, `club-stage6a-guard`
  (the writers), `league-season-scope-guard` (a new route needs a line), `admin-overlay-guard`, `club-stage6c-screens-guard`
  (the public page), `schedule-health-one-number`, plus whatever pins `league_season_notices` kinds. Add a guard that **no
  route writes `league_games` without recording a change when the division is published** (grep-style, like
  `house-league-money-guard`).
- `npm run verify:changed`; `npm run typecheck` (shared modules); `npm run lint:focused -- <files>`; `npm run check:spelling`;
  `check:dictionary`. A failure in a file you did not touch is another session's: confirm before blaming yourself.
  `check:layout --changed` on the screens you touched, **on dev only for those**, never a whole-product sweep.
- Then `/review` (high — a send that emails people, a public query, an atomic SQL path), `/simplify`, **`/docs`** (the help
  must say a Save no longer goes public by itself, what Publish does, Changes to send, urgent cancel, Moved, the coach's games).
  Per owner ruling: **write the walks ALONGSIDE the review, not after it**, one purpose per walk (Publish · editing + Changes to
  send · urgent cancel · the family's email + history · the coach's page + owner moving time · the rules door), and grep every
  walk if review changes a quoted line.
- Records: plan §9, a PM brief (`HOUSE_LEAGUE_STAGE9D2B_PM_BRIEF.md`), `TODO.md` (a line), memory `project_club_stage9_house_league`,
  `OWNER_QA_LEDGER.md` (check the last § number). Release: the migration goes to `MANUAL_PROD_STEPS.json` as pending, applied
  BEFORE the promote that ships this code. After this lands, **9d-2a's "a Save is live" caveat ends** — say so in the release
  note.
- New files + migration → the dev server needs a restart before the owner tests; ask first.

## Do not

- Do not unpublish, ever (9d2·1). Do not let a house-league screen choose a day, time or place the club has not allocated
  (the 9d2·3 amendment) — including a typed place on a published game's edit for a convenor.
- Do not merge house league's game notices into the club's practice Send path (11b Part 5) — two senders, two Automatic rows.
- Do not email on a score or a note. Do not count an automatic notice against the 3-a-day allowance.
- Do not build 9d-3 (the first-practice notice, house-league calendars for coaches and families) or 9e (standings, score entry,
  the whole-night rainout). f5's urgent path is the one 9e will reuse — build it reusable, do not build the rainout.
- Do not redesign scheduling as a whole; the owner reviews house league + rep + games + practices together after Stage 11 and
  asked for no relabel before then.
- Do not reopen rulings 9d2·1–16, 9d2a·A–H. Ask only the questions above.

## Shared-file traps (learned in 9b–11b and 9d-2a; each cost a session)

- A `-U0` (zero-context) partial commit of a shared file MISPLACES pure insertions. Build the staged blob from the base plus
  exact string edits, diff it against the working tree (only other sessions' hunks may remain), and typecheck the COMMITTED tree
  in a worktree. `git commit -- <paths>` takes the WORKING-TREE copy — a foreign staged file also rides a plain commit.
- A lock taken on a row inside a line trigger deadlocked an ending (9b-2) — use advisory locks. One transaction's `now()` ties
  `created_at`; stamp `clock_timestamp()` when order matters.
- A season screen must not read `userRole` (house-league-season-frame guard). A group-limited member reads only their groups'
  rep names — any new rep-name read takes `repGroupIds`.
- The cancel route once cancelled CLUB practices: any house-league write refuses `club_schedule_slot_id` rows.
- A drawing's "exists today" is a claim — check the code before wiring to it (the permit-ended line did not exist).
- `registration_open_at` is the club's wall clock with a literal Z; fixture games store 10:00 UTC and read 6:00 a.m. — say so,
  don't "fix" it.
- PowerShell `Select-String -Path` with `[seasonId]` is a wildcard: use `-LiteralPath`. Edit prose with Write/Edit, never a
  shell string (backticks execute).
