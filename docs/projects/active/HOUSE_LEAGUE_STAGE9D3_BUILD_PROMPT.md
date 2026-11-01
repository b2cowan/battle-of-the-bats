# House League Stage 9d-3: the first practice notice, hand-out-again as a change, and the coach's Subscribe (build prompt)

> **Written 2026-11-01**, after the owner ruled every 9d-3 ask (plan `HOUSE_LEAGUE_STAGE9_PLAN.md` §9, entries of 2026-11-01) and
> accepted the words. **Paste this into a new chat on `dev`.** Binding inputs, do not reopen: the rulings **9d3·1, 3–7** (2 and 8
> are withdrawn), the second-parent and moved-child rulings, and the accepted words in `HOUSE_LEAGUE_STAGE9D3_COPY.md`. The
> frames are in the drawings (https://claude.ai/artifact/Uazj5c2RKqVPAs1Gwpm9pM, version 4; source
> `HOUSE_LEAGUE_STAGE9D3_DRAWINGS.html`: c1–c6 the notice, b1–b5 the coach's Subscribe, Edges, Gate & build notes).
> **It adds migrations.** `ls supabase/migrations` right before you create one: on 2026-11-01 the highest is 414 (a function-only
> Plan & billing migration, prod `pending`, unrelated), so the next is 415; a peer has taken a number the same hour before.
>
> Re-verify every lead before building on it: other sessions share this working copy. Stage explicit paths only, commit only
> your own hunks, check `git diff --cached --name-only` before every commit, **commit only when the owner says**. **Read
> "Shared-file traps" at the bottom first.** `lib/email.ts` carried another session's uncommitted edit on 2026-11-01.
>
> **Recommended model: Opus 5.5, two sessions.** Session 1 = Parts 1–4 (the store, the notice, hand-out-again, the moved block).
> Session 2 = Parts 5–7 (the coach's lines and copy, the coach's Subscribe, checks). Owner rule 9d3·3: **one build, the notice
> first** (it fixes the silent re-hand-out), the Subscribe second; it can slide without loss. Update the Progress block after each
> Part. Helpers stay on Sonnet for reading.

## ▶ Progress (read first when resuming)

- **Owner rulings at the build's start (2026-10-31, Session 1):** (1) the moved-child email carries dates when the new team
  has been **TOLD** (the recommended answer); (2) the cap noun is **"the season's 3"** ("It doesn't count toward the season's 3
  emails."), not "your 3 emails a day" — the built allowance is a rolling 24 hours (9d-1 copy settlement: "a rolling 24 hours
  has no today") and every sibling line says "the season's {cap}"; the number comes from `CLUB_EMAIL_CAP`; (3) **build the
  staff email fix now**: no screen or route edited a guardian's email before this build (only sign-up wrote it), so "See them"'s
  "Add an email / Fix the email" needs a new write — the convenor, league admin, owner and admin (`houseLeagueRefusal 'run'`).
- **⚖ Deviation from Part 1's shape (the build's own call, reported):** the told state is NOT columns on `league_teams`. Mig 020's
  "public can read teams of active seasons" makes `league_teams` anon-readable, so a snapshot there would publish every team's
  practice times. It is a service-only table `league_team_practices_told` (team_id PK, told_at, snapshot, notice_id); the three
  questions stay answerable from it.
- **⚖ Gap the prompt missed (the build's own call, reported):** the club's Send the changes (11b Part 5) emails a told team's
  families a moved practice; without a refresh the told snapshot goes stale and the next hand-out would send them the same change
  again. That send now refreshes `league_team_practices_told` for told teams whose families it reached (no merge of the senders).
- **Part 1 ✅ built 2026-10-31 (uncommitted):** mig **415** `415_families_are_told_their_practice_times.sql` applied to **dev
  only**; tables `league_team_practices_told`, `league_practice_tells`, `league_practice_emails`; kind `practices_sent`; functions
  `league_practices_tell` (refuses finished / nothing / nobody / changed / already / sending), `league_practice_emails_claim`,
  `league_practice_emails_sent` (marks sent AND advances the told row, never backwards). Proof `scripts/house-league-9d3-check.sql`
  passes (T1–T10). Dictionary, snapshots, `MANUAL_PROD_STEPS.json` (prod `pending`) done. The "past dates are not a change"
  compare lives in TS (`lib/league-practice-tell.ts`), proved by unit test, not SQL — one compare, used before the write.
  Amended the same day (dev re-applied, tables were empty): `league_practice_tells.told_before` (a change's Was side, read under
  the lock, so a resend says the same change) and `league_practice_emails_add` ("Send again" — a fixed or added address joins
  the send; a failed row it covers is skipped). Check script T8b/T8c cover both.
- **Parts 2–4 ✅ built 2026-10-31 (uncommitted):** pure rules + words `lib/league-practice-tell.ts` (states none / untold /
  changed / told; change pairing nearest-first within the week → the 11b rows, plus an "Added:" line [marketing] the 11b email
  never needed; `predictHandOut` + `handOutAgainCounts` for the confirm); server `lib/league-practice-tell-server.ts` (read,
  press, claim-first send, resend, reminders, `refreshToldAfterClubSend`, `toldDateLines`); route
  `.../practice-tell/route.ts` (GET read / `?reminders=1`, POST send / resend; 'run'); `PracticeTellWindow.tsx` (the step, its
  states, See an example, See them with the email fix) + `PracticeTellReminder` under the division's time line; the
  re-hand-out confirm in `PracticeTimeWindow.tsx`; step 1's foot replaced; kind `house_league_practice_times`; the history row
  (`families-emails-log.ts`, `EmailLog.tsx`, the emails route's resendNotice); the email fix (`registrations/[regId]` PATCH
  `guardianEmail`, 'run', the sign-up's same-address children follow); `readHouseholds` gained `registrationId`; the moved
  block (`house-league-placement-mail.ts` + `leagueTeamMovedHtml`'s optional `practices`). Dev counts a transport-skipped send
  as reached so a walk sees the told state. Tests `tests/unit/league-practice-tell.test.ts` 15/15 (+ `team-move-coverage`
  classifies the three tables); 192 related tests pass; typecheck clean (8 GB heap — the default 4 GB runs out).
- **Not done in Session 1 (carry):** the season-wide "not told" total beside the season's other waiting counts (only the
  division's line is placed — find where the season's waiting counts live first); walk A and its fixture (add-only); `/simplify`,
  `/review`, `/docs`; the commit. **`check:schema-parity` fails until 415 reaches prod** (dev-only tables) — a database gate,
  owner's call (accept in the baseline, or apply 415 to prod first). `verify:changed` also stops on other sessions' failures
  (tournament schedule CSS, admin lettering, platform-admin orphans, export catalog, root files, billing/stage-6/console tests).
- **`/simplify` ✅ run 2026-10-31 (uncommitted, on top of 3dcb06705):** one household→rows mapping, `UNSENT` and name helpers
  shared inside the sender; the shared finished-season test; the send's recount ported from the schedule sender's guard (no
  write when another send holds the rows); independent reads in parallel (press, send, reminders, club-send refresh); the
  reminder reads registrations only when a team is waiting; the Practice-time read carries the told block only for the window's
  GET, and only for told teams; dead fields and the unused step-1 foot copy removed; the route's refusals are one table; the
  window's two sends share one POST helper; a registrar/treasurer no longer fires the refused reminder call; the staff email fix
  reads the household first and writes once. **Left for a later pass:** the circular import with the 11b sender (clean break
  edits `club-schedule-send.ts`); splitting `readTell` so the press skips the sample/last reads (the Session 2 hunks sit in it).
- **`/docs` ✅ run 2026-10-31 (uncommitted):** `lib/help-content/house-league.tsx`, "House league's time" section: three new sub-topics
  (Telling families their practice times; Families who won't get it, and sending again; When told practices change); the two
  "hand-out emails no one" sentences now point to the Tell step; the section's summary, keywords and searchText, the Email families
  guide (Automatic rows, "Practice times sent") and "Who can do what" (registrar and treasurer never see it) updated. Coach line, coach
  copy email and Subscribe (Session 2) not documented. `check:spelling` ✅. No customer string outside the help changed, nothing for `/marketing`.
- **⚠ Open defect, logged 2026-10-31 (found by `/simplify`, NOT fixed — a behavior change, not a cleanup):** "See an example"
  (`sampleOf` in `lib/league-practice-tell-server.ts`) takes the child's first name by splitting the joined name on the first
  space and the family name from the rest, so "Mary Jane Smith" reads "Mary" and "The Jane Smith family". The real send uses
  the registration's own `player_first_name` ("Mary Jane"), so the example disagrees with the email for multi-word first
  names. Fix: add `first` and `last` to `Household.children` in `readHouseholds` (`lib/club-schedule-league-mail.ts`; every
  family email reads that one reader) and have the sample and the 11b sender use them. TODO.md carries the one-liner.
- **`/review` ✅ run 2026-10-31 (scope: commit 3dcb06705 + the uncommitted /simplify hunks; high-risk; three finders — SQL/RLS,
  the compare, the email fix + club refresh — each finding read against the code before it was believed).** Gate: typecheck
  clean, lint clean, 35/35 tests, `house-league-9d3-check.sql` ends HOUSE_LEAGUE_9D3_PASSED (re-run after the fixes).
  **Fixed (uncommitted):** (1) HIGH — a press that covered only SOME of a failed row's teams skipped the whole row, so a family's
  other child was in no live row and its team read told (mig 415 now takes only the covered children off the row; a row left
  with nothing is skipped; a dead `sending` row returns `failed`; check T7b/T7d). (2) `league_practice_emails_add` was
  `ON CONFLICT DO NOTHING`: a child added under a skipped row's address, or a fixed address another family already had, was
  never emailed — now merged into the row and pending again (T8d). (3) The 11b refresh marked every team of a reached household
  told, on ANY household reached — now only teams the email was about, and only when every household it was about was reached.
  (4) The season emails route let a registrar resend a `practices_sent` notice (the Tell route refuses the registrar): **decided —
  yes it was wrong**; now 'run' on the server and the button hidden for a registrar; the registrar still resends the other
  notices. (5) A practice with no place printed a trailing "·" in the change email (Cancelled / Now / Added). (6) The email-fix
  comment claimed the Families book keeps a family by `person_id` — migration 333 (E02) re-points the child to the new address's
  owner and the duplicate queue proposes the pair; comment corrected, behavior kept (it is the designed "edited email follows the
  child"). **Cleared:** the claim is atomic; two presses serialise on the division lock; the 'run' gate and season scoping are right;
  `ilike` wildcards are harmless (the exact compare follows); `skipped` counts as reached only outside production; the compare's
  past/pairing/null-end rules and `predictHandOut` match the mig 393 SQL; RLS + grants are service-role-only on all three tables
  and four functions. **Carried (not fixed, owner's call):** (a) the 11b refresh snapshots the practices AS THEY ARE, so an
  un-told hand edit on a told team is swallowed by a club send; (b) no claim token — a send running past ten minutes can be
  reclaimed and re-emailed (needs a column + TS); (c) "Send again" on an OLD notice sends its older times to a household a newer
  notice already told; (d) `league_practice_emails_sent` marks every team on a row told even if a roster change left the email
  with no line about one of them; (e) the "Hand out again" confirm counts a told team whose families have all moved out;
  (f) the address check lets `a@b.c,d.com` through and the PATCH takes `guardianEmail` ahead of other fields. Dev-only: 415 re-applied
  to dev (prod pending, unchanged); snapshots + dictionary refreshed.

- **Session 2 (2026-11-01).** Session 1 committed 3dcb06705 + 5ce10e699; walk A is ledger §436. ⚠ **The Subscribe migration
  is 420, not 416** (Plans & pricing took 416–418, Signed-in families 419).
- **Part 5 ✅ built 2026-11-01 (uncommitted):** the coach's line under the Schedule heading (`coachToldLine` / `COACH_TOLD_WORDS`
  in `lib/league-practice-tell.ts`, read by `readCoachTeamPage` through the Tell step's own `readPracticesNow` + `readTold` +
  `tellStateOf`, live season only): told (only when the schedule lists a practice), not told, told different times (even with
  nothing listed — every told practice was taken away), and "No practices yet. Nobody has handed any out." only when the team
  NEVER had a practice (the schedule's own "No practices yet." stands otherwise, and is hidden when the line says it). The
  coaches' copy: `lib/league-practice-coach-copy.ts` (own file — raw `sendEmail`), kind `house_league_practice_coach_copy`
  (team), words `coachCopyWords` (singulars "1 {team} family" / "the date" are the build's), called after the press and after
  "Send again". **Once per team ever** via a new column `league_team_practices_told.coaches_copied_at`, **added to mig 415**
  (prod pending, so no new migration; re-applied to dev; existing rows backfilled to `told_at`), claimed null → now WHERE
  `notice_id` = the send that told the team. ⚖ Build's call, reported: **accepted coaches only** (the email opens a page an
  invited coach can't open yet; the 11b coach email also mails invited ones).
- **Part 6 ✅ built 2026-11-01 (uncommitted):** **mig 420** `420_a_house_league_coach_subscribes_to_the_schedule.sql` applied to
  **dev only** (MANUAL_PROD_STEPS `pending`; dictionary + snapshots done): `league_team_coaches.calendar_link_generation` /
  `calendar_last_read_on`, trigger `league_team_coaches_calendar_on_revoke` bumping the generation on `removed_at` set **and on
  `user_id` replaced** (build's widening: a seat handed to another account must not keep feeding the first one's calendar).
  `lib/coach-calendar-link.ts` gained a `CoachCalendarDomain` param (default rep, byte-identical; house league signs
  `league-coach-calendar:`) and the feed path per domain. `lib/league-coach-calendar.ts` (own link, Reset CAS, once-a-day
  read, `readLeagueCoachFeed`); `readCoachFeedEvents` + `readCoachFeedTeam` in `lib/house-league-coach.ts` (games via the
  shared `readGamesAsSent` — the page's `readTeamGames` now filters it from today — and every practice; **the whole season**,
  postponed / dateless games left out). Routes `app/api/calendar/league-coach/[token]` and
  `app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/calendar-link` (GET / POST Reset; throttled first, the public-form
  guard). Window: `CoachCalendarSubscribe` gained optional `linkEndpoint` + `whatsIn` (not forked); `CoachSubscribe.tsx` on the
  Schedule heading's line wraps it in `ConfirmProvider` (the league page has no portal: without it `useConfirm` answers yes and
  Reset goes unasked). Words `whatsInLeagueCoach(division, phone)`, `coachButton`, `coachButtonLabel`.
- **Part 7 (partial) 2026-11-01:** `tests/unit/house-league-9d3-coach.test.ts` 10/10 (a new file, so the commit can't carry
  another session's uncommitted hunk in `league-practice-tell.test.ts`); 362 related tests + 109 email-guard tests pass;
  typecheck, focused lint, spelling, dictionary, observability, date and token checks clean. `verify:changed` stops on other
  sessions' failures (billing free time, Stories column, Stage 6 walk HTML, console foot, public-site org slug, platform-admin
  CSS; its ESLint runner also errors on a missing react-hooks plugin). **Still owed:** `/simplify`, `/review`, `/docs` (the coach's
  line, the copy email and Subscribe in `lib/help-content/house-league.tsx`), walk B + its fixture (accepted coaches Morgan Reid —
  Reds — and Sam Blake — Blues — exist on dev; "never" needs a coached team with no practices), the commit, the auto-memory note.
- **Session 2 `/simplify` ✅ run 2026-11-01 (uncommitted, no behaviour change):** `lib/house-league-coach.ts` — the page's team read
  and `readCoachFeedTeam` now share ONE `readTeamRow` (same select, same error text, same card rule); `lib/league-practice-coach-copy.ts`
  — the "families reached" count is one pass into a map instead of a re-filter per coach. Typecheck, 185 related tests (9d3-coach,
  league-practice-tell, club-stage6d-*, coach-read-guard, family-email-guard, support-console-stage5, throttle guard), focused
  lint and `check:spelling` clean. **Left, and why:** (1) `lib/league-coach-calendar.ts` stays a mirror of the rep's link functions —
  the three small functions (own seat, Reset CAS, once-a-day read) differ in table, columns and stop rules, and a shared version
  would need a table + column map that reads worse than 30 duplicated lines; the shared part (token domain, feed path) is already
  shared in `coach-calendar-link.ts`. (2) `emailHtml` still comes from `club-schedule-send.ts` (circular with the Tell server):
  four other family-mail files import it the same way, and a clean break edits the 11b sender — out of Session 2's scope, carried
  with Session 1's note. (3) `coachToldLine`/`coachToldWords` and CoachSchedule's "No practices yet." hide are already one rule in one
  place (the line decides, the schedule defers when it is `never`). (4) `CoachSubscribe` is already the thin wrapper — two optional
  props on `CoachCalendarSubscribe`, no fork. (5) `orgSlugOf` fallback in the coaches' copy stays: `TellMailOrg.slug` is optional.
- **Session 2 `/review` ✅ run 2026-11-01 (HIGH tier; uncommitted; 3 finders — token + feed, coaches' copy, regression + UI wiring):**
  gate clean (typecheck, 783 related tests, focused lint, spelling, CSS purity/tokens/contrast). **Fixed (7):** (1) the link
  route's Reset with NO `generation` sent used the current one and skipped the compare-and-set (two bare POSTs reset twice) → now a
  409; the new route only, the rep route is untouched; (2) **mig 415's backfill re-ran on every apply** and would have marked a team
  told moments ago as already copied → now runs only in the run that adds the column (415 changed → re-applied to dev, a no-op
  there; no dictionary change; snapshots refreshed); (3) "changed with nothing listed" read "…haven't been sent **these** times"
  with nothing to point at → its own sentence (`COACH_TOLD_WORDS.changedEmptied`); (4) a late first copy read "all 0 dates" →
  its own sentence; (5) the club's skin never defined the four tokens the shared window reads (`--home-scrim/-line/-olive/
  -olive-soft`) → the page behind went undimmed and hairlines + keyboard focus rings were lost → mapped in `ClubFrame.module.css`;
  (6) `CoachSubscribe` imported the window statically, shipping the portal's ~965 KB stylesheet on every coach page → `dynamic`,
  as the rep's Export button does. Tests pinned for each (`house-league-9d3-coach.test.ts` 11/11). **Cleared (verified in code):**
  token domains cannot collide and rep tokens are byte-identical (same HMAC input); every stop rule is an empty 200 calendar, only
  a forged token the counted 404, no plan gate, private cache; Reset CAS is one atomic UPDATE; link route gate (own live seat,
  org + season slugs match, UUID-checked); mig 420 re-runnable, trigger on `removed_at` AND `user_id`, no double bump, grants;
  claim atomic, awaited inline, never throws, HTML escaped, accepted coaches only, no copy on a resend of an older notice or a
  send that reached nobody; the coach page's games unchanged by `readGamesAsSent`, the feed takes the whole season as last sent;
  ConfirmProvider wraps the window (Reset asks). **Carried as owner calls:** (A) the copy's once-ever claim is spent even when
  a team has no ACCEPTED coach yet (invited only) or a read fails after the claim — that coach never gets the copy (they see the
  told line on the page); recommend leave; (B) a concurrent "Send again" can claim a team while the first send is still going, so
  the copy's family count can be partial (no corrected copy follows); recommend leave; (C) the 11b club send clears `notice_id`
  on told rows — if it lands between the families' send and the claim, no copy; tiny window, recommend leave; (D) **release
  order:** the open-season coach page now READS 415's table (and the Subscribe route 420's columns) — apply 415 + 420 to prod
  BEFORE the promote or every open-season coach page 500s (already in MANUAL_PROD_STEPS); (E) "live season" for the feed/link is
  "not completed/archived", the same rule the coach page uses (a draft season's seat counts) — confirm that is the intent; (F) the
  Schedule heading gained 0.75rem bottom spacing (a small change, check on walk B). Not rendered: `check:layout` skipped (no
  dev server up; the owner's walk B covers the phone and desk look).
- **Session 2 `/docs` ✅ run 2026-11-01 (uncommitted):** `lib/help-content/house-league.tsx` only. The coach's guide ("How coaches get
  their team page") gained a sub-topic `coach-page-told-subscribe` — the line under Schedule in its four states (told / not told yet /
  told different times, incl. the taken-away sentence / no practices yet; a club admin or league admin sends), the one copy email on
  a team's first send (signed-in coaches only, once per team), and Subscribe (own link, games once published and as last sent,
  practices, cancelled marked, live season only, how often, Reset asks, a removed coach's calendar empties); the Schedule bullet
  links to it. The convenor's "Telling families their practice times" gained the coaches-get-one-copy bullet; "What coaches and
  families hear" no longer says the page only reads. Keywords + searchText updated on both sections. Sentences quoted from
  `COACH_TOLD_WORDS`, `coachCopyWords` and `calendar-subscribe-words.ts`. `check:spelling` + focused lint clean. No product string
  changed, nothing for `/marketing`.
- **Session 2 walk B ✅ PASSED 34/34 2026-11-01, no changes asked (ledger §439, six parts; commit owed):**
  https://claude.ai/artifact/LprT36UTRktpLHzpn88wrg, source `HOUSE_LEAGUE_STAGE9D3_WALK_B.html`. Fixture `.probe/9d3-walkB/fixture.mjs`
  (modes none / `--untold` / `--changed` / `--never` / `--purples-practice` / `--remove-seat` / `--reset`; every mode run once on dev and
  reset). Dev server restarted (login 200, no `EACCES`). **Corrections to the step-4 prompt, reported:** (1) the dev terminal does NOT
  show who a copy email would go to (no email key; the coach copy is an unlogged `team` kind), so Part B proves the copy by
  `coaches_copied_at` and the fixture prints "the one copy email would go to"; (2) `--remove-seat` on Purples proves nothing if Purples
  never had a practice (its link is empty either way), so an extra mode `--purples-practice` gives it one first; (3) "Sam cannot open
  Reds' link address" is walked as Reds' team page + Reds' calendar-link address (both 404 for Sam); the feed address itself is a
  bearer link by design, so only a made-up one is "not found"; (4) the finished-season case is unit-pinned, not staged. (present a version of this as the PM summary BEFORE any code)

- **Handing out practices is still silent, but the very next step asks "Tell the families?"** One button, "Send to {n} families",
  one email per household, listing every date, nothing goes until that press. "Not yet" leaves an amber count on the schedule.
- **A second hand-out for a team that was already told reopens the same step as a change**, for exactly the told teams, in the
  words of the change email 11b built. A told team's practices can no longer move with nobody told.
- **The coach's team page says whether families know** ("told on…", "not told yet", "told different times") and the coach gets
  one short copy email on the team's first send.
- **A child moved onto an already-told team gets that team's dates in the "new team" email.**
- **The house-league coach gets the same Subscribe a rep coach has**, on the Schedule heading's line: games as last sent plus
  practices, live season only, a link of their own with a Reset.
- Who can do what: the convenor / league admin / owner / admin tell families and see the count; a registrar or treasurer sees
  none of it; a coach sees the line and Subscribe on their own team page only (`houseLeagueRefusal(ctx,'run')`, unchanged).
- The families' side is **email only**. There is no family link, no calendar button, no "Open in the app", no unsubscribe link
  (owner direction 2026-10-29: the end state is a signed-in app; 2026-10-31: no new emailed links).

## Before any code (AGENCY_RULES, blocking)

1. **The product-manager UX summary**, in the conversation (above is the raw material).
2. **Words are settled** (`HOUSE_LEAGUE_STAGE9D3_COPY.md`, accepted 2026-11-01 with the six recommendations). Do not rewrite them.
   Three things the build must confirm and report, not decide: (a) the cap noun — the accepted text says "It doesn't count toward
   your {n} emails a day"; read the real cap (Q12c, 3 typed sends a day) and make the number come from it; if it is not what the
   words say, stop and report. (b) The `Hi {first name},` / `Hi,` split for a second address needs nothing now (no second address
   exists yet) but the household reader must be the **one** place Stage 3 of `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` widens. (c) The
   drawing's own mistakes (below) are corrected, not copied.
3. **Ask the owner only this one question (recommended answer first):** *When does the moved-child email carry dates?* The ruling
   says "when that team's practices have been handed out", and its next sentence says "if the team has not been told yet, no dates,
   the family gets the normal first notice". Those differ for a team handed out but not told. **Recommended: when the team has been
   TOLD** (it is the gap the ruling closes; a handed-out, untold team's families get the first notice, so the dates would arrive
   twice). Not taken: handed out. Do not ask more.

## What is already built (verified 2026-11-01; re-read it)

- **Practice time window:** `components/admin/kit/club/league/time/PracticeTimeWindow.tsx` (fetches ~49 and ~67, foot ~121,
  `W.foot` / `W.footPhone`), opened from `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` (~1269). Words
  `lib/league-practice-time.ts` (`PRACTICE_TIME_WORDS` ~289, `foot` ~322 says "Families aren't emailed." — **now false**;
  `PRACTICE_TIME_REFUSALS`; `COACH_PRACTICE_WORDS`). Server `lib/league-practice-time-server.ts` (`handOutPractices` ~102, rpc
  `league_practices_hand_out` ~117, `HandOutResult` = `{ok, written, removed, practicesAWeek}`). Route
  `app/api/admin/house-league/seasons/[seasonId]/practice-time/route.ts` (GET `'read'`, POST `'run'`).
- **The hand-out SQL:** `supabase/migrations/393_the_review_of_house_leagues_time.sql` ~337–453. It **deletes** future
  (`scheduled_at > now()`) practices on the given slots whose team is not in the new rows (~402–406), **upserts** on
  `(club_schedule_slot_id, team_id)` (~408–421) and returns only `{ok, written, removed}`. **Nothing reports which teams changed.**
- **Nothing records "families were told".** `league_teams` has `id, season_id, division_id, name, color, coach_name, sort_order,
  created_at` only (DATA_DICTIONARY ~6905–6920, dev snapshot). `league_practices` has no such column.
- **The family send:** `sendFamilyServiceBatch` in `lib/family-email.ts` (~272): `{kind, messages:{to,subject,html}[], fromName,
  replyTo?, onBatch?}`, no suppression list, no unsubscribe link, the html carries the reason line. Kinds live in
  `lib/email-kinds.ts` (`house_league_practice_change` ~97, `house_league_games_changed` ~100). Households:
  `readHouseholds` in `lib/club-schedule-league-mail.ts` (~39–54) groups active `league_registrations` by
  `season|lower(trim(guardian_email))`, the same as the SQL (`lower(btrim(guardian_email))` in migs 385 and 409). The Automatic
  history row is an insert into `league_season_notices` (~89–92; `kind` check from **mig 409**: `teams_published,
  practices_changed, schedule_published, games_changed`); the TS side is `NoticeKind` and a switch in
  `lib/families-emails-log.ts` (~58–74). **A new kind needs a migration that drops and re-adds the check, and a new case there.**
- **The model for a claim-first, per-household send:** `lib/league-schedule-mail.ts` with table `league_schedule_emails` and
  `league_schedule_emails_claim` (migs 409/410). It is what gives "Send again to only the families not reached" and a double-press
  guard.
- **The change email to reuse:** `lib/club-schedule-league-words.ts` `familyEmailWords` (~131) builds each child's part from
  `familyPartOpening` / `familyRowLines` (Now/Was; assumes a change); `familyClose`, `familySubject`, `FamilyPart` and the zone
  sentence are reusable; `leaguePracticesChangedHtml` (`lib/email.ts` ~1328) is generic (greeting, parts, outro, foot, reason). A
  **first** email needs its own part opening ("{Child}'s practices with {team}:") and date lines with no Was.
- **The moved-team email:** `leagueTeamMovedHtml` (`lib/email.ts` ~1294–1320; takes `fromTeam, toTeam, coaches, statusUrl`),
  words `movedMail` in `lib/house-league-teams-words.ts` (~120–129), sender `sendClaimed` in
  `lib/house-league-placement-mail.ts` (~161–172) reached from `sendPlacementEmails` (~68, from the placement route ~53 and the
  publish route). `readTeamFacts` (~48) already reads team names and coaches.
- **The coach's page:** `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx` (Schedule heading `<h2 id="coach-schedule">` ~83,
  `CoachSchedule` ~86 only when `view === 'open'`), `CoachSchedule.tsx` (`PracticeRow` ~89), data from
  `lib/house-league-coach.ts` (`readCoachTeamPage` ~166, `readTeamGames` ~216, `readTeamPractices` ~262). `league_team_coaches`
  columns: `org_id, season_id, team_id, name, email, first_name, last_name, user_id, token_hash, invited_at, expires_at,
  invited_by, invite_failed_at, accepted_at, removed_at, created_by, created_at, updated_at` — **no calendar columns**.
- **The rep coach's feed (reuse, do not fork):** `lib/coach-calendar-link.ts` (signs `membershipId.generation.HMAC`, secret
  `CALENDAR_LINK_SECRET`), `lib/coach-calendar-feed.ts` (`readCoachFeed` ~52 is rep-only), route
  `app/api/calendar/coach/[token]/route.ts`, `app/api/coaches/[orgSlug]/teams/[teamId]/calendar-link/route.ts` (GET link, POST
  Reset), mig **323** (`calendar_link_generation`, `calendar_last_read_on`, a trigger bumping the generation on revoke),
  `components/coaches/CalendarSubscribeWindow.tsx` (presentational, reusable), `CoachCalendarSubscribe.tsx` (hard-codes the rep
  endpoint), `lib/calendar-feed-response.ts` (`calendarResponse`, `refusedFeedResponse`, `PRIVATE_FEED_CACHE`),
  `lib/export/team-feed-words.ts` (`teamCalendarName`, titles F1–F10), `lib/calendar-subscribe-words.ts` (signed off 2026-10-11).
- **Who:** `LEAGUE_RUNNER_ROLES = ['owner','admin','league_admin']` (`lib/house-league-access.ts` ~46); `houseLeagueRefusal` in
  `lib/house-league-gate.ts` ~19; a coach is a `league_team_coaches` row with `user_id`, `accepted_at` set, `removed_at` null
  (`houseLeagueCoachAccess` ~149; views `open | finished | ended | gone | none`).
- **No second guardian exists** (`league_registrations` has `guardian_first_name/last_name/email/phone` only).

## Build, in this order, each committed (when the owner says) after its checks

### Part 1 — the store (migration 415) [Session 1]
- **What families were told, per team.** Add to `league_teams`: `practices_told_at timestamptz` (null = never told) and
  `practices_told_snapshot jsonb` (the future practice instants + place that team's families were told, as of the last send).
  This is the drawing's "told timestamp on the team" widened by one column, because three ruled behaviours need *what* was told,
  not only *when*: the **Now/Was** lines of the change email, the coach's **"told different times"** line, and the re-hand-out
  confirm's **"{c} teams' practices change. {u} team's don't."** If you find a cleaner shape, keep these three answerable.
  ⚠ **Compare only future dates.** Past practices fall off the current list while still in the snapshot; a naive diff calls every
  old team "changed". Filter the snapshot to `scheduled_at > now()` before comparing.
- **The per-household send record**, modelled on `league_schedule_emails` (claim-first, sent/failed per household per team, so
  "Send again to only the families who didn't get this one" and a double-press both work). Recommended: a new table + claim function
  mirroring 409/410, keyed `(season, team, lower(btrim(guardian_email)))`. A household with two teams handed out the same day is one
  email (one part per team) but one claim per team, so "first" stays per team.
- **The Automatic history kind** `practices_sent`: drop and re-add `league_season_notices_kind_check` (from 409's list, plus the new
  kind), and add the case in `NoticeKind` / `lib/families-emails-log.ts`. Words in the copy doc, section E.
- RLS / grants the way 409 did them (check its pattern; anon and authenticated get nothing unless 409 gave it). Advisory locks, not
  row locks, inside any trigger (9b-2 deadlock). Stamp `clock_timestamp()` where order matters.
- **Same unit of work:** `docs/agents/db/DATA_DICTIONARY.md`, `npm run refresh:snapshots`, `npm run check:dictionary`, a
  `supabase/migrations/MANUAL_PROD_STEPS.json` entry (prod `pending`; applies before the code ships). Apply to **dev only**.
- Proof: a SQL check script in the style of `scripts/house-league-schedule-publish-check.sql` (claim twice → second is refused;
  a told team's snapshot compare ignores past dates; kind check accepts `practices_sent`).

### Part 2 — the Tell step and the first email [Session 1]
- **Step 2 of the Practice time window** (frames c1, c1b, c3): after the hand-out lands, the window shows the Tell step with its
  statement, tiles, "What each family gets" row ("See an example"), "Not yet" / "Send to {n} families", the left-out line with
  the "See them" window (fix the address, "Send again to {n}"), the sending, result, couldn't-send, changed-while-looking and
  everyone-has-been-told states, and the teams-with-no-practices state. **All words from the copy doc, sections A–B.** Replace
  `PRACTICE_TIME_WORDS.foot` / `footPhone` ("Families aren't emailed." is now false; step 1's foot becomes the copy doc's).
- **The reminder (c3):** an amber count beside the practice time on the house-league schedule ("{n} teams' families haven't been
  told · Tell them"), opening straight to step 2, in the house's waiting-count idiom. The season-wide total sits with the season's
  other waiting counts; per-division counts sit on each division's time line.
- **The send:** through `sendFamilyServiceBatch` only (a new kind in `lib/email-kinds.ts`, e.g. `house_league_practice_times`,
  klass `family`), households from **`readHouseholds` and nowhere else** (so Stage 3's second address widens every family email
  at once). Held until the convenor presses Send; "first" is per team; one email per household with a part per child whose team was
  handed out that day; the email lists **every upcoming date** at the moment of the press (a practice cancelled before is left
  out, never announced). Everyone with a usable email is told, **including a family who unsubscribed from club news**; it never
  counts toward the typed-send allowance (Q12c); one Automatic `practices_sent` row per send (per season, per division sent).
- **The email** (frame c4, copy section C): no link, no button, no unsubscribe link; the footer says why it arrived and the zone
  sentence. Build date lines with the same helpers `familyRowLines` uses (`formatShortWeekdayDate`, `formatTimeRange`, the clock
  via `formatTime`), **with the place on each date line**, not in the heading. Reuse `leaguePracticesChangedHtml`.
- **A household with one told and one new team** (c2 edge): the told team's part is the change opening with Now/Was; the new team's
  part is the first opening; subject "Practice times for {A} and {B}".
- Gate: `houseLeagueRefusal(ctx,'run')`; a finished season refuses (423). The window's double-press guard is the claim, not the
  button alone.

### Part 3 — hand-out-again is a change (9d3·6) [Session 1]
- A hand-out never silently moves a told team. The hand-out itself stays as built (the delete and upsert in mig 393 are not
  changed), and the **Tell step that follows** reopens as a **change** for exactly the teams whose future practices now differ from
  `practices_told_snapshot` (frame c2), in the **11b change email's words** (Now/Was). Teams never told in the same hand-out get
  the first email in the same step ("{b} teams haven't been told yet, so their {m} families get their practice times for the first
  time").
- **The re-hand-out confirm** (copy section B) states, before the rewrite, "{a} teams' families were already told…" and "{c}
  teams' practices change. {u} team's don't." Compute that from the planner's rows against the snapshot (the planner is in
  `lib/league-practice-time.ts`); do not guess from the database after the rewrite.
- Do not merge this into the club's practice Send path (11b Part 5): two senders, two Automatic rows.
- After a change send, update `practices_told_at` / `practices_told_snapshot` in the same claim step.

### Part 4 — the moved-child dates (ruled 2026-11-01) [Session 1]
- In `sendClaimed` (`lib/house-league-placement-mail.ts`), for a `moved` email whose **new team has been told** (the owner's answer
  to the one question above), add the block under the coach line: "{First}'s practices with {toTeam}:" then every upcoming date,
  one line each, then "Times in {zone}." (copy section G). **Source the dates from the told snapshot**, so a later change reaches
  the moved family through the same change email as everyone else. Extend `leagueTeamMovedHtml` with optional practice lines and a
  zone line; add no second button or link. If the team has not been told, nothing changes in the email.
- The existing subject has an em dash (`movedMail.subject`); it is built copy, flag it, do not change it.

### Part 5 — the coach's lines and the copy email [Session 2]
- **On the coach's team page** (`page.tsx` Schedule section, frame b2): one quiet line under the Schedule heading for the team's
  state — "told on {date}", "not told yet. A club admin or league admin sends them.", "told different times on {date}…", and "No
  practices yet. Nobody has handed any out." Words: copy section E. ⚠ The drawing said the no-practices cause was "the schedule
  isn't published yet"; practices come from Practice time, not from publishing games — word it as the copy doc does.
- **The coach's copy**: one short email to each team's coaches on the **team's first send** (copy section D), through
  `sendFamilyServiceBatch`-adjacent machinery **in its own file** (the family-email guard forbids a raw `sendEmail(` beside a
  guardian-shaped name in a guarded file). Coaches come from `league_team_coaches`. Once per team; a change is already covered by
  11b's coach email. Read the `houseLeagueCoachAccess` rule for who counts as a coach.

### Part 6 — the coach's Subscribe (9d3·5) [Session 2]
- **Migration 416** (separate from 415, so the notice can ship alone): on `league_team_coaches` add `calendar_link_generation`
  (int, default 0) and `calendar_last_read_on` (date), with the same revoke-bump trigger as mig 323 firing on `removed_at`. Same
  dictionary / snapshots / MANUAL_PROD_STEPS unit of work.
- **The token:** reuse `signCoachCalendarToken` / `verifyCoachCalendarToken` with a **distinct signing domain** (a prefix such as
  `league-coach-calendar:`) so a rep membership token can never verify as a house-league one. The token is rebuilt on every read
  from the row id, the generation and the HMAC; nothing secret is stored.
- **The feed:** a new `readLeagueCoachFeed` mapping `league_games` (as last sent — `readTeamGames` with `asLastSent`, so a held
  change is never in a feed) and `league_practices` (`readTeamPractices`) to the shared feed entries; titles, cancelled marks,
  durations and the empty-calendar answer come from `lib/export/team-feed-words.ts` and `lib/calendar-feed-response.ts`
  unchanged. Live season only: a closed or missing season answers an empty calendar named for the team. A bad shape or signature is
  the counted 404. The last read is recorded at most once a day. A route such as `/api/calendar/league-coach/[token]`.
- **The window and button:** a house-league version of `CoachCalendarSubscribe` over the **same** `CalendarSubscribeWindow` (do
  not fork the words; the copy doc's section F). One new sentence: `whatsInLeagueCoach` beside `whatsInCoach`. The button is a text
  "Subscribe" on the Schedule heading's line on a desk, the mark alone on a phone (accessible label "Subscribe in your calendar
  app"), **never a toolbar and no download** (9d3·5). Reset is the built shared Reset and touches the coach's own link only.
- **No plan gate is drawn or built.** Whether house league's coach Subscribe carries a plan gate is an open `/strategy` packaging
  question; do not invent one. Do not add `module_families` to any role (Families stays a grant, 9d1·2).

### Part 7 — checks and records [Session 2]
- Tests (extend, don't fork): `tests/unit/league-practice-time.test.ts` (words, planner, the changed-team compare and the
  past-dates filter), `league-club-schedule.test.ts` / `club-schedule-league-plan.test.ts` (the change email reuse),
  `league-schedule-email.test.ts` (the claim shape), `house-league-9d1-email.test.ts` / `house-league-place-guard.test.ts` (the moved
  block), `house-league-coach-read-guard.test.ts` (the coach lines), and `club-stage6d-*` for the feed (the export guard requires
  the Subscribe control only on the Schedule). Add a guard that the family email file contains no `http`, no `href`, no
  "unsubscribe", no "Open in the app" and no `Your sign-up` (the 2026-10-31 rulings), and that nothing but `readHouseholds`
  builds the household list. `tests/unit/family-email-guard.test.ts` fails only for a file with raw `sendEmail(` /
  `sendEmailBatch(` beside a guardian-shaped name; check whether a new sender file must be listed in its manifest.
- `npm run verify:changed`, `npm run typecheck` (API, contract and shared-module edits), `npm run check:spelling` ("practice" only;
  the clock via `formatTime`), `npm run check:dictionary`. `/simplify`, then `/review`; `/docs` for the convenor's and the coach's
  guides in `lib/help-content/house-league.tsx`; `/marketing` only if a string changes.
- **Owner walks** (a checkable Artifact each, paste-back; check the ledger's last § right before you number one): walk A after
  Session 1 (the notice, the re-hand-out, the moved email), walk B after Session 2 (the coach's lines, copy email, Subscribe). A
  fixture is needed: a division with teams, handed-out practices, households with a child on two teams, one household with no email
  and one with a refused address, a team already told, and a coach with an accepted seat. Add it to the fixture script **add-only**;
  never run a seed that resets sign-ins mid-walk.
- Records: plan §9 progress entry, TODO line, PM brief, QA ledger, this Progress block, and the auto-memory file.

## Drawing mistakes found by the words pass (do not copy these)

- Step 1 draws "Teams at once · 1 a diamond"; the built word is **"1 per facility"** (`perFacility`).
- Frame c2's foot ("The words are the change email 11b built. Nothing new to learn.") is a design note. It must not ship.
- Frame b5's Reset words differ from the built, signed-off ones. Use the built (copy section F).
- Frame c4 puts one venue in the part heading. A team's dates can span venues: the place goes on each date line.
- The drawing's "Where the code lives" table is from 2026-10-29. Use the verified list above.

## Do not

- Do not give a family a link, a button, a calendar, "Open in the app" or "Your sign-up" in the practice email (owner 2026-10-31:
  no other link is ever sent to a family). Do not add a family calendar link in any form (9d3·2 and 9d3·8 are withdrawn).
- Do not build a second guardian address. Stage 3 of the accounts plan does; this build only keeps one reader for it.
- Do not unpublish or touch the game-schedule Publish / Changes to send paths (9d-2b). Do not build 9e (standings, score entry,
  the whole-night rainout).
- Do not change the rep coach's Subscribe words or the hand-out SQL's delete/upsert rules. Do not email on a score or note.
- Do not reopen 9d3·1, 3–7, 9d2·1–16, 9d2a·A–H, 6d's rulings, 9c·4, or Q12c. Ask only the one question above.
- Do not redesign scheduling as a whole (the owner reviews house league + rep + games + practices after Stage 11).

## Shared-file traps (learned in 9b–11b and 9d-2; each cost a session)

- A `-U0` (zero-context) partial commit of a shared file MISPLACES pure insertions. Build the staged blob from the base plus exact
  string edits, diff it against the working tree (only other sessions' hunks may remain), and typecheck the COMMITTED tree in a
  worktree. `git commit -- <paths>` takes the WORKING-TREE copy — a foreign staged file also rides a plain commit.
- `lib/email.ts`, `TODO.md`, the plan, the QA ledger and `layout-screens` carry other sessions' edits: commit around them.
- A season screen must not read `userRole` (house-league-season-frame guard). Any new rep-name read takes `repGroupIds`.
- Any house-league write refuses `club_schedule_slot_id` rows it should not touch (the cancel route once cancelled CLUB practices).
- A drawing's "exists today" is a claim — check the code before wiring to it.
- Edit prose with Write/Edit, never a shell string (backticks execute). PowerShell `Select-String -Path` with `[seasonId]` is a
  wildcard: use `-LiteralPath`.
- A rolled-back DO block cannot stage concurrency; prove a race with a committed-fixture two-process script.
- The dev server needs a restart after new files or migrations-dependent shared changes (AGENTS.md restart rule); stop it before
  deleting `.next` on Windows.
