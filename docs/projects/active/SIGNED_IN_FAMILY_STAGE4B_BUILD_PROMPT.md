# Signed-in family accounts · Stage 4b, In / Out / Maybe and the coach's headcount: build (prompt)

> **Written 2026-11-13** (after the owner ruled all 15 asks A). Plan of record: `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md`, Stage 4, block
> "RULED 2026-11-13" (**it wins where this prompt or `COACH_AVAILABILITY_RSVP_PLAN.md` differs**). Drawing (build to it):
> https://claude.ai/artifact/UkYTNt3NtTbKrKP1GZoAiJ · source `SIGNED_IN_FAMILY_STAGE4B_DRAWINGS.html` (tabs 1–9; tab 10 holds the asks).
> Parent's sheet, first drawn in Stage 4: `SIGNED_IN_FAMILY_STAGE4_DRAWINGS.html` (the 4b drawing's tab 7 redraws it; tab 7 wins).
> Consent and privacy words: `docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md` (v0.1 → **0.2 in this stage**, Part 9). Older plan:
> `COACH_AVAILABILITY_RSVP_PLAN.md` (rewritten to the app channel 2026-11-08; its §3.3–3.5 are superseded by the drawing).
> PM brief: `COACH_AVAILABILITY_RSVP_PM_BRIEF.md` (update at closeout).
> **Paste this into a new chat on `dev`:** `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md`

## Binding, do not reopen (the owner's 15 rulings, compressed; full text in the plan)

1. **One switch per team** (Team settings → Sharing, under Schedule visibility): **Off / Games / Games and practices**, default **Off**.
   When on, parents answer **every upcoming event it covers**. No "Ask families" button, no tick on the event form, no "not asked yet" state.
2. **Remind** is the coach's only send. It reaches the **connected parents (signed in, in the app)** of players who have **neither a family
   answer nor a coach mark**. A note in the app + an email to the parent's own address. **Once per event per 24 hours for the whole
   staff**, never after the start. The report names players with **no parent in the app**. No email to an address that has not joined.
3. **No Accept buttons.** One **"Use N family answers"** copies answers **only into players the coach has not marked** (In → In, Out → Out,
   **Maybe stays Not marked**), then a toast with **Undo**. A tap in the player sheet takes one player. Only families write family answers;
   a phone call goes in the coach's book. The attendance book is **never written without a coach's tap**.
4. **Rep teams only in 4b.** House league is its own later stage. The answer record is built so it **can** hold a house-league game or
   practice, but **no house-league screen, switch, count or Remind ships**, and a house-league parent sees no In / Out / Maybe.
5. **The parent tick-box is enough.** A parent sees only: their own child's answer, the **other connected parent's first name and answer**,
   and their own note. Showing other families, the coach's marks or anyone else's note would require the club to confirm the parent first
   (not built; a guard test keeps every family payload to the allow-list above).
6. **Two parents differ: latest wins.** Coach sees who + the day + "earlier: In (Dev, Mon)". A parent sees the other parent's answer, first
   name and day, and **that** they left a note, **not its words**. A change clears the earlier parent's note.
7. **Red row**: "5 out · at most 8 can play" when players not out are fewer than the sport's field positions. No red for a sport with none.
8. **One count per player**: the coach's mark first (In/Late = in, Out = out), else the family's answer. "9 of 13 in · 1 out · 1 maybe";
   zero parts left out; nothing at all when nobody has answered and nobody is marked. The team Overview's "Next up" counts the same way
   while availability is on.
9. **Rename "No reply" → "Not marked", everywhere, for every team** (with or without availability on).
10. **A moved event:** a **new day clears the answers** (the family sees Answer again; the schedule-change notice says so). A new time on
    the same day keeps them.
11. **Who sees what:** the **count** on schedule rows = anyone on the staff who sees the schedule. The room's family lines/notes, Use family
    answers, Remind and the coach bell = **coaches who can mark attendance** (head coach and assistants, the `attendance` capability).
12. **Coach bell** "Family answers": an **Out at any time**, or **any change in the last 48 hours** before the event; **never a routine In**;
    bundled per event within the hour and per family across events; **"left a note", never the note's words**; bell on, email and push off;
    a **Family answers row in Account → Notifications**, shown only to a coach whose team has availability on.
13. **Lineup builder (a game's lineup only, never the template editor):** Out / Maybe words on the pool pills (the coach's mark first, then
    the family's answer), and the strip warning "{name}'s family said Out after you saved this lineup" with a one-tap **Take {name} out**
    that changes only the lineup.
14. **Joined second parents get the team's Unsubscribe line only; the Stage 3b Stop line stays on copies to a second address that has NOT
    joined.** (Changes Stage 4 ruling 8 for joined parents. See **O1** below for how far it reaches.)
15. **Retention:** a note's words are deleted **30 days after the event**; the answer, who and when are kept **until the season is finished
    plus 60 days**; a parent **leaving or being removed clears that parent's notes**.

**Standing rules this stage must not break:**
- **The guardian tier stays OFF** (`GUARDIAN_TIER_ENABLED`, `lib/family-guardian.ts:40` [V], on only for the literal `'true'`; every family
  entry point uses the one check, `assertGuardianTier`/the inline 404). **Tier off = nothing about availability exists for anyone**: no
  switch row, no count, no Families card, no family lines, no parent rows, every new route 404. **The one exception is ask 9**: the rename
  to "Not marked" is for everyone. Never set the flag in Amplify. For the owner's walk, ask first, then he sets it in his own `.env.local`.
- **No new no-login door.** The reminder email and bell open the **signed-in team page** (a sign-in is asked for if needed); they carry
  no answer, no token, no link that answers. **No address in any link.**
- **No write to `rep_team_event_attendance` by a family, ever** (the coach's PATCH is the only writer). No `maybe` in the attendance enum.
- **Reach is re-derived on every write** from the signed-in account (`getFamilyReach`), never from a team, event or child id the client sent.
  A parent who left, was removed or stopped is refused, including from a stale tab.
- **No push to families.** Bell and email only. **No chat**; the note is one short line on the answer (cap 200, app-enforced).
- **Live season only**: no closed-season shelf, no year parameter, no archive allow-list entry (`HISTORY_ENDPOINTS` untouched). A finished
  season shows no availability UI.
- **The 3b guard stays green:** no send path reads `second_parent_stops` (`tests/unit/league-second-parent.test.ts` [H]). Ask 14's "has
  this address joined?" reads `family_links`, not the stop list.
- **One spelling:** clock via `formatTime()` ("10:30 a.m."); `npm run check:spelling` is in `verify:changed`. Prose only; never rename a
  column or enum value (`unknown` stays `unknown`; only the WORD changes).
- **Schema = dictionary, same unit of work** (`DATA_DICTIONARY.md` + `npm run refresh:snapshots`; `npm run check:dictionary`). A new table
  needs an **explicit `service_role` grant** in its migration (the grants guard caught mig 448).

**Helpers' leads are leads.** **[V]** = opened by the author 2026-11-13; **[H]** = a helper's citation, re-verify before building on it.
Explicit pathspecs only; commit only your own hunks; `git diff --cached --name-only` before every commit; **commit only when the owner
says.** `TODO.md`, `OWNER_QA_LEDGER.md`, `DATA_DICTIONARY.md`, `MANUAL_PROD_STEPS`, the help files and the notification registries
(`lib/types.ts`, `lib/notification-labels.ts`, `lib/email-kinds.ts`) are shared with other sessions.

**Gate before any code:** present the Product Manager UX plan in plain language (what a parent, a coach who marks attendance, a head coach,
an assistant, a manager and a second parent see and do differently; benefits; who sees what). `/accounting` is **not** triggered (nothing
charged changes). `/legal` and `/marketing` run in the closeout (Part 9), because the reminder is an email about a child.

**Recommended model: Opus 5.5, four sessions.** Session 1 = Parts 1–3 (database, who may answer, the parent's page). Session 2 =
Parts 4–5 (the switch, the count, the attendance room, the rename). Session 3 = Parts 6–8 (moved events and leaving, Remind and its email,
the footer change, the lineup, the coach bell). Session 4 = Part 9 (closeout and walk). Update the Progress block after each Part. Stop at
the end of a session; recommend `/clear`.

## ⚠ Owner calls to answer at the start of the session that reaches them

- **O1 (before Part 7) · How far does ask 14 reach?** The ask reads "joined parents get the team's Unsubscribe line only; the Stop line
  stays on copies to a second address that has not joined", under a question about the reminder. **The prompt's reading: it applies to
  EVERY second-parent copy** (placement, schedule changes, pay receipts, the reminder), not only the reminder, because ruling 8 was about
  all of them and a joined parent can leave in the app (Stage 4 ruling 7). The cost is a touch of every caller of
  `withSecondParentStop` (below). The narrower reading (reminder only) leaves a joined parent with the Stop line on every other copy.
  **Ask the owner which**, record the answer here and in the plan. **Whichever is chosen, a copy without the Stop line must still carry a
  working unsubscribe.** Verify that for each caller before dropping the line from it.
- **O2 (Part 2) · Where does "first name" come from?** The sheet and the coach line show the other parent's first name ("Priya answered Out
  on Tuesday"), never an address. Find what the account/connection holds (the "who's connected" list in 4a ruling 7 already shows
  connected parents). If no first name is stored anywhere, say so to the owner: the options are a words-only fallback ("the other parent")
  or capturing a first name at accept. Do not invent a name from the email's local part.
- **O3 (Part 4) · Which permission turns the switch on?** The drawing says "head coach only, like the other Sharing rows". The code's
  Schedule visibility row is gated by `canManageSchedule` (the `scheduleManage` capability) and the premium family-layer check
  (`app/api/coaches/[orgSlug]/teams/[teamId]/route.ts:295-309`, `settings/page.tsx:941-990` [H]). **Default: use exactly the same gate and
  visibility as the Schedule visibility row** (that is what "like the other Sharing rows" means), and say so in the Progress block. Ask
  only if that gate would let someone other than a head coach or a coach the head coach delegated schedule rights to flip it.
- **O4 (Part 8) · What is "the season is finished" for retention?** Ask 15 keeps answers until "the season is finished plus 60 days".
  Rep teams close through the coach season-close (`COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md`). Find the stored close date; if a team can
  stay open for years (no close), say so: the purge then never fires for that team. State the rule you build in the Progress block; the
  owner confirms at the walk.

## What the code says today (read before Part 1)

- **The family team page** [H]: `app/(consumer)/family/teams/[teamId]/page.tsx:71` (404s when the tier is off) → `readFamilyTeam`
  (`lib/family-home.ts:172`) → `FamilyTeamClient.tsx`. Schedule rows come from `familyTeamSchedule` (`lib/family-team-schedule.ts:44`) as
  `FamilyScheduleEntry` (`lib/family-view.ts:30`), an **allow-list DTO with no player field and no RSVP field**. Rep entry ids are
  `rep_team_events.id`; league entries are `league_games.id` / `league_practices.id`, so an answer key is **(kind, eventId)**, never a
  bare id. There is no family write route for answers; the family API lives under `app/api/family/` (pattern:
  `children/[childId]/leave/route.ts`: `withObservability`, `getSignedInUser`, 401, then the tier 404).
- **Reach** [H]: `getFamilyReach(userId)` (`lib/family-access.ts:399`) returns one entry per verified link/child with `teams: ReachedTeam[]`
  (`lib/family-link-reach.ts:62`; `teamKey(kind,id)`, `reachKey(childId, teamId)`). `getVerifiedLinkForUserTeam` is rep-only and returns
  the FIRST matching link, so **do not use it for a per-child write**. A write also re-checks `getEnabledFamilyOrg(orgId, teamId)`
  (`family-access.ts:155`) and `getTeamFamilyAccess(repTeamId)`/`isVisibleToFamilies(schedule_visibility)` (`:257`, `:238`).
- **The coach's book** [H]: `ScheduleEventSheet.tsx` (room mounted ~`:1244`, sheet ~`:1305`) → `ScheduleAttendanceRoom.tsx:40` (filter chips,
  All in, Reset, one `CoachRow` per player) and `CoachRsvpSheet.tsx:42` (four choices, a note input, autosave). Words:
  `ATTENDANCE_WORD` in `lib/coach-schedule-vocab.ts:130` [V] (`unknown: 'No reply'` at `:134` [V]), also read by Game day's Who's here
  (`.../game/[eventId]/page.tsx:52,1352,1410,1477,1673`) and `components/coaches/attendanceOptions.ts:14-23`. The writer is the batch
  PATCH `app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/attendance/route.ts:80` (cap `attendance`, rep only, upsert
  `rep_team_event_attendance`). **Use Family answers goes through this same PATCH.**
- **Schedule rows**: `ScheduleCalendarViews.tsx` list-row face ~`:321-337` (`CoachRow` with `trail`); per-event data reaches rows through
  `ScheduleRowDecor` (`:49`). A count rides a new decor field. The club admin's read-only rep schedule uses the same rows **without
  the extras and must stay as it is** (drawing tab 9).
- **Overview "Next up"** `app/[orgSlug]/coaches/teams/[teamId]/page.tsx:1907-1932` reads the book only ("9 of 12 in" / "Attendance not
  taken"; the `['noreply', …, 'no reply']` chip at `:1932` is customer-visible).
- **Moves and the notice** [H]: event PATCH `.../events/[eventId]/route.ts:55` (single event: `dayChanges = orgDayKey(next) !== orgDayKey(...)`
  already computed at `:263-264`, update ~`:303`, notice `:327-342` via `notifyFamiliesOfGameUpdate`; series path `:138-180` has its own
  notify). `notifyFamiliesOfGameUpdate` (`lib/family-notify.ts:82`) is rep-only and returns silently when the schedule is not visible.
- **Family email and bell** [H]: `sendFamilyEmail` (`lib/family-email.ts:185`; the door checks the unsubscribe list, **fails closed**, adds the
  unsubscribe footer; batch `:220`), bell via `notify(...)` (`lib/notify.ts`, `family-notify.ts:171-190`). Kinds: `lib/types.ts:3445`,
  `lib/email-kinds.ts:116`, `lib/notification-labels.ts:33/126/480`, `lib/notification-view.ts:76`. `family_game_update` is deliberately
  **not** in `NOTIFICATION_SECTIONS` (parents have no org-prefs row); the coach's "Family answers" row **is** a section entry
  (`AccountNotificationsClient.tsx:107-114` builds from it). There is no per-kind digest.
- **The 3b footer** [V for the module, H for callers]: `withSecondParentStop(html, orgId, to)` (`lib/league-second-parent-footer.ts:35`,
  "only DRAWS the link"). Callers: `lib/league-second-parent-mail.ts:97` (`secondCopyHtml`; `sendSecondParentServiceCopies` `:108` already has
  an async `finish?` hook, the cleanest seam), `lib/house-league-placement-mail.ts:393`, `lib/league-signup-link-mail.ts:182`,
  `lib/online-payment-receipt.ts:346`, `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts:277`. A "joined" lookup = a `family_links`
  row for that club with the address, `status='verified'`, `user_id` not null (`lib/guardian-email.ts:29` normalises; `LINK_COLUMNS`
  `family-access.ts:99`).
- **Lineups** [H]: the pool heading "Not in the lineup" `lineups/[eventId]/page.tsx:1028` → `_LineupEditor.tsx` (the SAME editor serves
  templates at `lineups/templates/[templateId]`). Game lineup = `rep_team_lineups` (`UNIQUE(event_id)`, `updated_at`, autosave PUT
  `.../events/[eventId]/lineup/route.ts:145`). Confirm `updatedAt` reaches the page's type before relying on it as "saved at".
- **Sport positions**: `getSportPack(sport).fieldPositions` (`lib/sports.ts:342`, `SportPack.fieldPositions` `:160`): 9 baseball/softball, 5
  basketball, `[]` otherwise. Use `.length` (not `positions`, which includes DH/OF).
- **Migrations**: the highest on disk was **`475_the_club_reads_its_own_people.sql`** [V] on 2026-11-13; **take the next free number at build
  time** (other sessions are adding them). The purge template is mig `472_friend_requests_backstop_runs_nightly.sql` [H] (pg_cron, pure
  SQL); a cron needs a `MANUAL_PROD_STEPS` entry.

## Part 1 — The database (Session 1)

One migration (number: next free). Proved by a rolled-back SQL fixture in `tests/sql/` (the 4a pattern: `family-invitation-fixture.sql`).

1. **`rep_teams.family_answers`** `text not null default 'off' check (in 'off','games','games_and_practices')`. Applied to dev; DEFAULT keeps
   every existing team dark.
2. **The answer record** (name at build; suggestion `event_availability_answers`): `id`, `org_id`, `event_kind` check (`rep_event`,
   `league_game`, `league_practice`: the last two reserved, unused in 4b), `event_id uuid` (no FK: three source tables, enforced by the
   server), `child_id` FK `org_children` (**the child**, as the connection is, Stage 4 ruling 3), `answer` check (`in`,`out`,`maybe`),
   `note text` (≤ 200), `answered_by_user_id uuid`, `answered_at timestamptz`, and the **one-step history ask 6 needs**:
   `previous_answer`, `previous_by_user_id`, `previous_at`. `UNIQUE(event_kind, event_id, child_id)`: latest wins, updated in place.
   Indexes for "all answers for these events" (the schedule count) and "all answers by this user" (leave/removal). `service_role` grant;
   mirror the RLS posture of `family_invitations`/`family_links`.
3. **The reminder log**: `(event_kind, event_id, reminded_at, reminded_by_user_id, families, parents, app_only)`, so the 24-hour limit is a
   database fact, not a UI timer. Enforce "one per event per 24 hours" with a **single atomic insert-if-no-recent-row** (two coaches pressing
   at once must not both send).
4. **The purge** (ask 15): a SQL function + a nightly `pg_cron` schedule (template mig 472): (a) set `note = null` where the event started
   more than 30 days ago; (b) delete answers once the team's season is finished + 60 days (**O4**). `MANUAL_PROD_STEPS` gets an entry.
   **No retention promise is published anywhere until this purge exists and has run on dev** (Part 9 `/legal`).
5. **Coach notification kind** `family_availability_response` in the registries (types, labels with description, urgency class `know`, bell
   icon) and a **`NOTIFICATION_SECTIONS` entry** so Account → Notifications has a row (defaults bell on, email off, push off). A new
   family-side kind `family_availability_reminder` (bell + email) beside `family_game_update`, **not** in `NOTIFICATION_SECTIONS`; add it to
   `lib/email-kinds.ts` (`klass: 'family'`). Registry edits are shared files: exact hunks.
6. Dictionary + `npm run refresh:snapshots` + `MANUAL_PROD_STEPS` in the same unit of work. Re-run the migration twice (re-runnable).

## Part 2 — Who may answer (one server module + the parent's route) (Session 1)

One server-only module (suggestion `lib/family-availability.ts`) is the only place that decides, and holds **every word** the feature
shows so `/marketing` reads one file (the `league-second-parent.ts` precedent).

1. **`canAnswer`**: tier on; the signed-in account has a verified link to that child; that child is live on that **rep** team (via
   `getFamilyReach`, matching `reachKey(childId, teamId)`; **never** `getVerifiedLinkForUserTeam`); the event belongs to that team
   (`rep_team_events.team_id`); the team's `family_answers` covers the event type (Games → games only; practices refused); the schedule is
   visible to families; the org's family layer is enabled; the event is **not cancelled** and **has not started**.
2. **The write route** `POST /api/family/teams/[teamId]/events/[eventId]/availability` body `{childId, answer: 'in'|'out'|'maybe'|null, note?}`:
   `null` clears (deletes the row and its note). A change of answer copies the old answer/by/at into `previous_*` (only when the answer
   actually changed; re-sending the same answer changes nothing but the note). **A write replaces answer and note wholesale**, which is how
   "a change clears the earlier parent's note" falls out: the later writer's note (or none) is the only note. Notes trimmed, ≤ 200, plain text.
3. **The read** for the family page returns, per upcoming event and per **the account's own children on that team**: the answer, the
   answerer's **first name** and **day** (not the clock time), whether a **note** exists and (only if it is this account's own answer) the
   note. If the other parent answered: their first name, their answer, the day, and `hasNote` (a boolean). **Nothing else about anyone
   else.** Answers close at the start time (the row shows the answer, no control). Cancelled shows nothing (answer kept, hidden).
4. **Guard test (a):** a family payload contains no teammate's answer and no note text but the account's own; (b) tier off → the route
   404s and the page gains nothing; (c) a left/removed/stopped parent is refused; (d) practices refused on Games only; (e) a started or
   cancelled event is refused; (f) a write can never touch `rep_team_event_attendance`.
5. **O2** applies here: where the first name comes from.

## Part 3 — The parent's page (drawing tab 7) (Session 1)

Build on the existing family team page; extend the `FamilyScheduleEntry` DTO (and its allow-list guard test) deliberately, not around it.

1. **Schedule rows** get the child's answer on the right: a small pill in a **44 px** tap area; **In ✓** green, **Maybe** amber (the page's own
   chip colours), **Out** plain ink with an outline (a parent's answer never looks like an error), **Answer** when not answered. Cancelled:
   nothing. On Games, practices show nothing. Two children on a team: **one line per child** under the row.
2. **The sheet** (grab line, the child's name and the event, three 52 px choices with icon + word + tick, a one-line note). A tap saves;
   tapping the current answer again clears it. The hint is /legal's: "Your team's coaches see your answer and note. {Name}, {child}'s other
   parent, sees the answer but not your note. Other families see neither. Please don't put health details here; tell the coach directly."
   (the other-parent sentence only when another parent is connected). The line "{Name} answered Out on Tuesday and left a note for the coach."
3. **States:** started → the answer shows muted and cannot change, "Answers closed when the game started. To tell the coach something now,
   tell them directly."; an unanswered child on a started event shows "No answer"; **arriving from a reminder** → the page scrolls to that
   event with its row marked (the way it already scrolls to Up next), the sheet does not open by itself, and the line "The coach asked
   whether {child} is coming." shows only while the event is open and unanswered (with two children it names the one who hasn't answered).
4. **House league: nothing.** The house-league team page renders exactly as in 4a.
5. Phone first at 390; the page is shared with the desktop width. Tier off: the page is exactly as today.

## Part 4 — The switch and the count (Session 2)

1. **The switch** (drawing tab 3): a row **"Families say if they're coming"** under Schedule visibility, the same segmented control (warm
   theme: chosen = ink; 44 px on a phone), **Off / Games / Games and practices**. Shown only where Schedule visibility is shown, only with
   the tier on, and only on rep teams. Words under it exactly as drawn for each state (on, turning back off, nobody in the app yet,
   Schedule visibility on Staff only → the control is disabled and says to set Families or Public first). Gate: **O3**. The PATCH rides the
   same block as `scheduleVisibility`. No email goes out when it is turned on.
2. **The count** (drawing tab 1): the schedule row's second line gains "9 of 13 in · 1 out · 1 maybe" (list rows; at a desk the same words
   under the title, as the row's caption). Rules: the coach's mark first (In/Late = in; Out = out), else the family's answer; parts with
   zero left out; **nothing when nobody has answered and nobody is marked**; started/over/cancelled show nothing new; "of N" = the
   players the room lists (no call-ups). With availability on but no parent in the app, the count is the coach's own marks if any.
3. **Red** (ask 7): "5 out · at most 8 can play" when `players − outs < fieldPositions.length` and the sport has positions. Counts OUTS,
   never ins. Use the danger word style the event window already uses for Out.
4. **One aggregate per upcoming event** joined into the existing schedule events read (no N+1). It returns **counts only** to staff who
   see the schedule (ask 11): no names, no notes, no per-player status. A manager/treasurer/helper who sees the schedule sees the count and
   nothing else.
5. **The team Overview "Next up"** counts the same way while availability is on (ask 8), and says "Not marked" where it says "no reply".
6. The club admin's read-only rep schedule: **unchanged**. Verify, do not assume.

## Part 5 — The attendance room, the sheet and the rename (Session 2)

1. **The Attendance door row** in the event window gains one line, only while availability is on and the event has not started:
   "Families: 7 answered · 3 haven't · 1 changed" (amber "changed" only when a family changed after the coach marked that player). The
   head reads "…4 not marked". Coaches without the `attendance` capability do not get this line (ask 11).
2. **The room** (tab 2): a compact **Families card** at the top ("7 answered · 3 haven't · 3 have no parent in the app", and "⚠ 1 changed
   since you marked: Maya · Show", which filters the list to her), with two ghost buttons: **Use N family answers** (hidden when nothing to
   copy) and **Remind N** (Part 7). Under each player whose family said something, a grey line: "Family said Out · "away at a tournament" ·
   Priya, Tue" (answer, the note's words, first name, day; "earlier: In (Dev, Mon)" when it changed). Amber "⚠ Family changed to Out · Wed"
   when it changed after the coach marked the player. A player with no parent in the app has **no line** (the card says the count once); a
   call-up has no family line and is not counted as "no parent in the app". "Family hasn't answered" for a connected parent who hasn't.
   **Kept as built:** the count chips (they still count the coach's book), All in, Reset, the rows, the badge, the sheet on tap, autosave.
3. **Use N family answers** copies, through the existing batch PATCH, **only into players whose status is `unknown`**: In→attending,
   Out→absent; Maybe stays `unknown`. It never touches a player the coach marked (so the amber-drift player waits for the coach's tap).
   Then the toast "Used 1 family answer: Leo · Undo". **Undo puts exactly those players back to `unknown`** (Reset would wipe the coach's
   own marks, so Undo is its own list, held client-side for the toast's life). Hidden while the event has started? **No:** it stays until the
   event ends (the family lines explain the marks); Remind goes at the start.
4. **The player sheet** (`CoachRsvpSheet`): a **family box** above the four choices ("Maya's family said / **Out** · "can't make it after
   all" / Priya, Wed · earlier: In (Dev, Mon)") and the hint "Tap Out to use the family's answer, or tap In to keep your mark and clear the
   warning. Families don't see your mark." The coach's own note stays the coach's and never takes the family's words. **Tapping In on a
   player whose family said Out is the coach keeping the mark and clears the warning** (the warning compares the family answer's
   `answered_at` with the coach's mark time; if the book row carries no timestamp, add what is needed in the PATCH response, do not guess).
5. **Desk layout** (720 px event window, above 900 px the room fills the body): the family's answer gets its own column ("Player · Family said
   · Your mark").
6. **States (tab 2 table):** started → lines stay, Use stays until the event ends, Remind goes; cancelled → card and lines go, answers kept;
   availability turned off → card and lines go, the coach's marks stay, answers come back if it is turned on again this season; a player
   leaving the roster → their row goes.
7. **The rename (ask 9), scoped by a census [H]:** change the one word `ATTENDANCE_WORD.unknown` (`lib/coach-schedule-vocab.ts:134`), and the
   hard-coded copies: `lib/coach-schedule-sheet.ts` (line 88 count-word map, line 118 label, 2 comments), `.../practice/[eventId]/run/page.tsx:963`
   (a hard-coded label, not from the vocab), `.../teams/[teamId]/page.tsx:1932` (visible chip), `.../history/attendance/panel.tsx:649`
   ("events with no reply aren't counted"), `tests/unit/coach-schedule-sheet.test.ts`, and the **help articles** in
   `lib/help-content/coaches.tsx` (≈17 hits, **including `keywords`/`searchText`**: check lines ~1844, 3557–3594, 4031). Game day's Who's here
   inherits the vocab; open it and confirm. **Do NOT touch** the unrelated "no Reply" strings (platform-admin feedback, `early-access-admin`,
   `for-leagues`, `plan-article-content`, `platform-areas`, `FeedbackRecord`) or historical UAT `walk-findings.json`. Re-grep for the word
   with a fresh pass after the edits (helper counts are leads). Add a **guard test** that no customer attendance string says "No reply".
   Comments that name the status may say "unknown" instead.

## Part 6 — A moved event, leaving, and the lineup (Session 3)

1. **A moved event (ask 10):** in the single-event PATCH, right after the update, when the **day** changed (`dayChanges`, org-day key) and
   the team has availability on, **delete that event's answers**; a time change on the same day keeps them. The **series** branch does the
   same per occurrence whose day moved. The schedule-change notice (`notifyFamiliesOfGameUpdate`) gains one sentence, only when answers
   were cleared: families "will need to answer again" (/marketing words, in the one module). Cancelled → the answers are kept and hidden;
   reinstated → they return. (Rep only.)
2. **Leaving and removal (ask 15):** when a parent's connection ends (their own leave, a club removal, a 3b stop), **null the `note` on every
   answer that parent gave** (`answered_by_user_id`). The answer itself stays. Hook into the existing end-of-connection functions in
   `lib/family-invitation.ts`/`family-guardian.ts` [H: find them], not into each route. Test it.
3. **The lineup (tab 5), a game's lineup only:**
   - The pool pill gains a word, **Out** or **Maybe**, in the pool's existing tag style (the coach's mark first, then the family's answer;
     a player with no answer or a family In looks as today). The **template editor gets nothing** (the editor is shared: switch on "has an
     event").
   - The status strip gains one line in the builder's own sentence shape: "⚠ {Name}'s family said Out after you saved this lineup." with
     **Take {Name} out**, which moves the player to the pool and changes **only the lineup** (never the attendance book). With two: "2 families
     said Out after you saved this lineup: Maya, Blake" with **Take them out**. The chip reads "Needs a look". "After you saved" =
     `answered_at` later than the lineup's saved-at (`rep_team_lineups.updated_at`; confirm it is on the page's type).
   - The event window's **Lineup row** ("Lineup · Needs a look" + "{Name}'s family said Out after you saved") and the **schedule row's
     warning triangle** use the same count: a family's Out on a player the coach hasn't marked counts as Out; a family's change on a marked
     player shows as the warning above. One function decides this; do not compute it in three places.

## Part 7 — Remind, its email, and the footer (Session 3) · needs O1 answered

1. **The recipient rule** (one function, unit-tested): connected parents (verified `family_links` with an account) of players who have
   **no family answer AND `unknown` in the coach's book**, on an event that has **not started** and is **not cancelled**. A player the coach
   marked is settled. Players with no connected parent are reported, never emailed. **No email to an address that has not joined** (the plan's
   old "also the sign-up addresses" is ruled out, ask 2 A). The email goes to **the connected account's own address**.
2. **The flow (tab 4):** the Families card's **Remind N** turns into its own confirm, in place (the dues-reminder pattern): who gets it, the
   exact message, who is not reminded and why (marked players; no parent in the app), who gets the app note only (a parent whose email is
   turned off for the team), the 24-hour limit; one full-width action "Send N reminder(s)", "See what they'll get" and "Cancel" as links.
   Then the **report**: "Reminded {Name}'s family (2 parents) · 1 got the note in the app only" (a **count**, never who) and "Reminded at
   4:12 p.m. You can remind again tomorrow at 4:12 p.m." When nobody is left, the card says "every family you haven't marked has answered"
   and Remind goes. Needs the `attendance` capability. The report never shows an email address.
3. **The parent's email** through `sendFamilyEmail` ONLY (never a raw send): subject "{Team} vs {Opponent}, {date}: is your player coming?"
   (the team and the event word, **not the child's name**); body "Is {child} coming? … {Event} · {date and time} · {place} … {child}'s
   coach asked families to say whether their player is coming. Open the team page and tap Answer." Button **Open the team page** (the signed-in
   page at that event, `?event=` marked); "You'll be asked to sign in if you aren't already." **It cannot answer anything.** A parent with
   two children on the team gets **one** email naming both. The footer is the door's own (who sent it and why, the reply line, the team's
   Unsubscribe). **Fails closed:** a suppression/unsubscribe lookup error sends nothing. The build ships a test that **no reminder path
   bypasses the unsubscribe list or a stop**.
4. **The parent's bell** "Is {child} coming {date}?" / "{Team} vs {Opponent} · Answer on the team page", opening the team page at that event.
   No push.
5. **The footer change (ask 14, per O1):** `withSecondParentStop` (or its callers, via the async `finish` hook in
   `sendSecondParentServiceCopies`) drops the Stop line when the recipient **has joined** (a verified `family_links` row for that club
   and address with an account), keeping the team's Unsubscribe. Not-joined second addresses keep the Stop line exactly as built. Update
   `SECOND_PARENT_WORDS` only if a sentence assumed the Stop line is always there (the confirmation's "who added you" line asks
   `hasSecondParentStop` before it is built: re-check that path). Tests: a joined second parent's copy has Unsubscribe and no Stop; a
   not-joined one keeps both; the 3b guard (no send path reads `second_parent_stops`) still passes.
6. A coach turning availability **Off** stops Remind and hides everything (Part 5 states). Nothing is sent to anyone when it is turned on.

## Part 8 — The coach's bell (Session 3)

1. **When it fires:** a family **Out** at any time, or **any change** to an answer inside the 48 hours before the event. **Never a routine
   In.** To coaches with the `attendance` capability on that team (head coach and assistants by default).
2. **Wording** (as drawn): "{Child} is Out for Sat vs Lakeshore" / "{Parent first name} left a note · now 9 of 13 in · 1 out · 1 maybe";
   a change on a marked player: "{Child}'s family changed to Out for Sat vs Lakeshore" / "Was In · your mark still says In". **Never the
   note's words** ("left a note").
3. **Bundling:** several answers inside the hour for one event become **one line per event** ("3 families said Out for Thu, Apr 29
   practice" / names and the new count); one family answering Out to a run of events becomes **one line per family** ("Ava's family said
   Out for 3 events"). Decide the mechanism in the build; the simplest is to **update the coach's existing unread bell for the same
   (event) or (family) key within the window** instead of a queue. Record the choice in the Progress block.
4. **Opens** the event window on the attendance room. **Account → Notifications**: a "Family answers" row ("When a family says Out, or
   changes an answer in the 48 hours before an event.") under "As a coach", defaults bell on / email off / push off; **only shown to a coach
   whose team has availability on**. The page is shared by both portals: check the family and club versions render exactly as before.

## Part 9 — Closeout (Session 4)

1. `/simplify` (the new module and any shared reader), then `/review`. `npm run verify:changed`; `npm run typecheck` (shared types,
   notification registries and a family DTO change). The unit suites for the new module, the recipient rule, the aggregate, the purge function
   and the footer; plus the guards below.
2. **Guards that must exist as tests:** (a) tier off → no switch row, no count, no Families card, no lines, no parent rows, every new route 404
   (and the rename is the only thing that changed); (b) no family payload carries a teammate's answer or any note but the account's own;
   (c) a family can never write the attendance book; (d) a left/removed/stopped parent's write is refused; (e) no reminder path ignores an
   unsubscribe or a stop and fails closed; (f) the reminder carries no answer link or token; (g) the schedule count is counts only for staff
   without `attendance`; (h) the club admin's rep schedule and the house-league coach page are unchanged; (i) the 3b guard still passes;
   (j) no customer "No reply" attendance string remains; (k) a new day clears answers, a same-day time change keeps them; (l) a leaving parent's
   notes are cleared and their answers kept. Check and update: `family-guardian-tier-boundary`, `family-access-boundary`,
   `family-recap-boundary`, `coach-schedule-sheet`, `club-stage1-server-guard`, `team-move-coverage` [H].
3. `/legal` (before handoff, not optional): the reminder is an email about a child and the answer is a record about a child. Re-read the
   rendered words against the drawing's tab 9; bump `GUARDIAN_CONSENT_STAGE4.md` to **0.2** with the three added lines (a parent can answer
   once the coach turns it on; the coaches see answers, notes and when; the other parent sees your name and answer, not your note;
   **new joins only**, the sheet's hint is the notice for parents who joined earlier); publish a retention line **only now that the purge
   exists** and has run on dev; update the privacy-policy draft, `LEGAL_INDEX.md` and the CASL memo (flags b/d/e; ask 14 closes e for joined
   parents). **The FieldLogicHQ privacy page is still owed before the tier is on for real families**; say so again.
4. `/marketing`: the sheet, the hint, the reminder email and bell, the coach lines, the switch words, the schedule-change sentence.
5. `/docs`: the coach's attendance/schedule/lineup/settings articles (the rename touches them anyway), a new "Families say if they're coming"
   article, and the parent-side family help; `lib/help-content/coaches.tsx` and the family hub files [H].
6. **Records:** `COACH_AVAILABILITY_RSVP_PLAN.md` (status "Drawn + ruled 11-13; built <hash>", §3.3–3.5 pointed at the drawing, §9 open
   questions closed), the PM brief, the plan's Stage 4 status (commit hashes, the migration dev only + prod step, **MANUAL_PROD_STEPS**),
   the TODO line, the auto-memory note. Offer `/strategy` only if a ruling turned out to need logging.
7. **The walk:** a checkable QA Artifact (one purpose: Stage 4b), its own **Owner QA Ledger section** with the next free §number (the
   ledger's last known was §521: check, never renumber). Needs the tier on in the owner's `.env.local` (ask first), a Resend key on dev,
   and a rep team with **parents who accepted a 4a invitation** (nobody is connected on day one: set up two parents on one child and one
   on a sibling). Cover: the switch (each state, Staff-only disabled, off hides, back on restores); a parent answers In / Out / Maybe with a
   note, changes it, clears it; the second parent sees the first name + answer, not the note, and the coach sees "earlier"; started and
   cancelled; two children; Use family answers + Undo; the amber drift; Remind (confirm, report, the 24-hour wait, a marked player left
   alone, a parent with email off gets the app note only); the reminder email and bell open the right row; the coach bell on an Out and a
   late change, bundled; the red row on a baseball team; the lineup words, the warning and Take out (and a template editor unchanged);
   a moved day clears, a moved time keeps; a leaving parent's notes go; "Not marked" on every screen; the tier off. Restart the dev server
   before the walk (new files, shared modules).

## ▶ Progress (read first when resuming)

- Fill in per Part: date, commit hash (when the owner says to commit), tests run, anything done differently and why.
- **O1–O4 (owner, 2026-11-13, Session 1):**
  - **O1 = every copy.** A joined second parent's every second-parent copy (placement, schedule changes, pay receipts, the reminder) drops
    the Stop line and keeps the team's Unsubscribe; a not-joined second address keeps both. Verify a working unsubscribe per caller first.
  - **O2 = ask at joining + a words fallback.** Found: the account holds a name only when a sign-up form asked for one or the 4a accept
    copied the FIRST parent's league sign-up name (`nameOnSignup`); a second parent (the sign-up holds no `guardian_email_2` name) and most
    rep invitees have none, and `writeVerifiedLink` sets no `person_id`. Built: the accept page's new-account path asks "Your first name"
    (pre-filled from the sign-up when known); the first name read is `user_metadata.first_name`, else the first word of `full_name` /
    `display_name`, else the words "the other parent" (family side) / "a parent" (coach side). Never from the email. /legal re-reads the box.
  - **O3:** default (the Schedule visibility row's gate) unless Part 4 finds it reaches beyond a head coach or a delegated schedule role.
  - **O4 = 60 days after the season's last event, closed or not.** No rep season stores a close date (`rep_program_years` has `status`
    only), so "finished" = the season's last event; adding a later event moves the clock. Owner asked "don't coaches keep history?": yes,
    the coach's attendance book is NEVER touched; only the family's answers (answer, who, when, note) are deleted. The nightly job is
    owner-approved in this conversation as automation; it ships in its OWN migration and its own commit.
  - **Decided in the build (not an owner ask):** "Games" = `COACH_GAME_EVENT_TYPES` (league games incl. scrimmages, tournament games);
    "Games and practices" adds `practice`. The tournament container (`external_tournament`) and `team_event` are never asked (the games
    inside a tournament are).
- **Session 1 (Parts 1–3): COMMITTED 2026-11-13 on `dev`: A `22db0210d` (the build, mig 476, 29 files), B `7dd71b435` (WATCHED
  AUTOMATION, mig 477 alone, owner's go), C = the commit that holds this block (records). Migs 476 + 477 are on DEV only; prod steps
  are in `MANUAL_PROD_STEPS` (477 after 476). Simplify + review applied the same day (below). Not pushed.**
  - **Simplify (4 angles):** applied: one pure `familyAnswerState` (open / closed / cancelled / not covered) used by the parent's page
    and the writer (Remind will use it); the writer's answer row no longer carries a placeholder child name (`FamilyAnswerFields`);
    the reach lookup is one `find`; the sheet has one failure path and one open-sheet state; `daysBetweenDateStrings` instead of a
    hand-rolled day gap; rows grouped once per render. **Declined:** reading `rep_teams`/org gate once per page view instead of twice
    (touches shared page/org-gate code; ~3 extra queries per page view, acceptable until the page is measured); moving first-name
    resolution to `member-names.ts` and a shared `reachOnRepTeam` helper (Part 4+ may want them; not Session 1's files); the hook
    returning `decorate()` instead of the client branching (revisit when the coach side reuses the list); exporting `metaString`.
  - **Review (high-risk tier; deterministic gate green; lenses: concurrency/state, data/contract, security/tenancy).** Confirmed and
    FIXED: (1) the suspected sheet bug was real: the note's blur-save re-rendered the choices as disabled so the tap was dropped.
    First fix (an `intent` record) drifted after a failed save or a reopened sheet; rebuilt: one queue in the hook, each save decides
    at run time from the latest confirmed row, a second choice tap is ignored until the first answers, a closed answer locks the
    sheet. (2) the writer's update is now compare-and-swap (retries once) so `previous_*` stays right when two parents act at once.
    (3) mig 476: both purge clocks use the later of an event's start and end (a mistyped end before the start cannot purge early);
    the Remind-log purge is two plain statements, not a per-row subplan. (4) `cleanFirstName`: a name another parent reads (from the
    account's own editable metadata, or typed at joining) is stripped of invisible/direction-override characters, capped at 50, and
    needs a visible letter. (5) the reach lookup considers every link of the account to that child. Re-applied 476 twice on dev,
    fixture 7/7, unit 28/28.
  - **Review: declined, with reasons (all go to the owner's walk):** (a) an unconditional DELETE when a parent clears: a stale sheet
    can clear the other parent's newer answer; latest-wins is ruled, a re-tap restores it. (b) a note-only blur sends the answer the
    sheet shows: if the other parent changed it meanwhile, it re-asserts the old one as a change; same reason. (c) tapping the OTHER
    parent's current answer clears it (the prompt says "tapping the current answer again clears it"; it does not say whose): a walk
    item, and typing a note under the other parent's answer makes the answer yours. (d) The page can offer pills on a draft next
    season's events for a child still rostered only in the old season; the writer then refuses (404, "didn't save"). Rare (a team
    with two seasons open); Part 4 should filter the read by the child's own season. (e) Closing the sheet with a note typed and no
    answer chosen discards the note.
  - **Owed to later Parts (found in review, not Session 1's to build):** Part 6 (leaving/removal): clear the parent's notes. Today
    `endFamilyLink` does not touch the answers, and a parent whose answer stays shows by first name after they leave while the sheet's
    hint says no other parent is connected; decide whether a departed parent's answer shows by name or as "the other parent", and
    clear notes BEFORE any account delete (the FK sets `answered_by_user_id` null, which would orphan the "by this user" lookup).
    Part 7: the 24-hour claim is taken before the send, so a failed send burns the day: release the claim on a total failure.
  - **Foreign failures seen (not mine):** mig 478's `renewal_reminded_for` (dictionary), `platform_charge_tax_looks` (team-move
    coverage), `lib/two-step-emails.ts` working-tree diff drops trailing periods (check before whoever owns it commits). The schema
    snapshots in A were refreshed from live dev and carry those sessions' drift as well.
  - **(earlier note) BUILT 2026-11-13, then uncommitted:**
  - **Part 1.** Mig `476_families_say_if_theyre_coming.sql` (dev, applied twice; the tables were dropped once on dev while empty and
    re-made without `org_id`, see below) + mig `477_family_answers_are_cleaned_up_nightly.sql` (WATCHED AUTOMATION, its OWN commit;
    dev; the purge run once by hand there, 0 deleted). `tests/sql/family-availability-fixture.sql` **7/7 on dev** (switch, one answer
    per child, checks, the 24-hour claim, the purge's two clocks, a deleted event, the coach's book untouched). Dictionary entries,
    `MANUAL_PROD_STEPS` 476 + 477, snapshots refreshed by the hook. Registry kinds `family_availability_reminder` (family, bell +
    email, `email-kinds` family) and `family_availability_response` (coach, `know`) in types / labels / descriptions / urgency / icon.
  - **Part 2.** `lib/family-availability.ts` (server: `writeFamilyAnswer`, `readFamilyAnswers`), `lib/family-availability-rules.ts`
    (pure: the switch, the note, `firstNameOf`), `lib/family-availability-words.ts` (every word; /marketing reads this one). Route
    `POST /api/family/teams/[teamId]/events/[eventId]/availability`. O2's join-page box: `invitationEmailCheck` answers `askName`,
    `acceptWithNewAccount` refuses `name_required` before the account exists, `ClaimClient` shows "Your first name" only then.
  - **Part 3.** `FamilyAnswers.tsx` + `FamilyAnswers.module.css` beside `FamilyTeamClient` (pill in a 44 px tap area, one line per
    child, started / reminder lines, the sheet as a native dialog: bottom sheet on a phone, a window from 640 px); the page reads the
    answers server-side and takes `?event=` (a uuid) for the reminder's landing.
  - **Tests:** `tests/unit/family-availability.test.ts` 22/22 (guards a–f of Part 2 + the words + O2). `npm run typecheck` clean (needs
    `NODE_OPTIONS=--max-old-space-size=7168`: the default 4 GB ran out). Lint clean on every touched file. `verify:changed`: the full
    unit run had **21 failures, 2 mine, both fixed** (possessive guard, team-move coverage); the other 19 are other sessions' files
    (billing rail, BILLING_TAX_WORDS help content, PlayerGuardiansCard's possessive, `platform_charge_tax_looks` move coverage, etc.);
    the focused ESLint step crashes on another file's `react-hooks/set-state-in-effect` config; `check-index-coverage`,
    `check-public-tokens` and `check-css-selectors` fail on other sessions' files only.
  - **Done differently, and why:**
    1. **The answers do NOT ride `FamilyScheduleEntry`.** That DTO also feeds the PUBLIC team page and the calendar feed
       (`RepTeamPublicSchedule`, `team-two-pages-server`), and `family-view.ts` says child data must never join it. A separate
       `FamilyAnswersView` (allow-list `FamilyAnswerRow`, guard-tested) travels beside the entries; a guard asserts the entry gained no
       child field.
    2. **No `org_id` on either new table.** `team-move-coverage` holds every org_id table to a move decision; a row here is reached only
       through its event and child, so a team that moves carries its answers with nothing to re-point. The claim is `(kind, event, by)`.
    3. **The coach's "Family answers" row is NOT a `NOTIFICATION_SECTIONS` entry.** Sections feed the org-staff card; coach rows live
       on `CoachCard` in `AccountNotificationsClient.tsx` (beside Practice plans). Part 8 adds it there, gated on availability being on.
    4. **O2's box is shown only when no sign-up name exists**, rather than pre-filled: the join page opens from an emailed link with no
       sign-in, so a pre-filled name would show to anyone holding the link. Same outcome, nothing disclosed.
    5. Words added beyond the drawing: the day reads "today" / "yesterday" / "on Tuesday" (within a week) / "on Apr 2". /marketing
       confirms in Part 9.
- **Session 2 (Parts 4–5): COMMITTED 2026-11-13 on `dev`: A `b5d121f0c` (the build, mig 479, 37 files), B = the commit that holds this
  block (records). Mig 479 is on DEV only; prod step in `MANUAL_PROD_STEPS` (BEFORE this code). Simplify + review applied the same day
  (below). Not pushed.** PM UX plan presented first.
  - **O3 asked and RULED (owner, 2026-11-13): "Same as Schedule".** Found: `canManageSchedule` (`scheduleManage`) is ON by default
    for every assistant AND every manager (`lib/coach-capabilities.ts:176,270,284`), and a manager with `manageStaff` can hand it to a
    treasurer or helper (it is an "everyday" grant, `coach-staff-delegation.ts`). The owner chose the Schedule visibility row's exact
    gate anyway (anyone who can set Staff only already controls family answers in effect). Built: shown where Schedule visibility is
    shown (the family layer), only with the tier on and a live season; edited by `canManageSchedule`; others read "{choice} — only
    coaches who manage the schedule can change it."
  - **Mig `479_the_book_remembers_when_a_player_was_marked.sql`** (dev, applied twice; `MANUAL_PROD_STEPS` entry, before the
    Session 2 code): `rep_team_event_attendance.marked_at`. ⚠ Needed and not in the prompt: `updated_at` cannot say when a coach
    marked a player, because the room saves the WHOLE roster in one batch (every row's `updated_at` moves on any tap). The PATCH now
    reads the book first and moves `marked_at` only for a row whose status changed or that the coach tapped (`confirmed`, sent by the
    RSVP sheet's pick, even the same choice); the rule is `bookMarkedAt` in the rules file. Backfilled from `updated_at` for marked rows.
  - **Part 4.** `FamilyAnswersSettingRow` under Schedule visibility (same segmented control; the words per state from tab 3;
    "turning back off" shows right after this coach turned it off; Staff only disables the two "on" choices and keeps Off choosable;
    the PATCH refuses an "on" value while Staff only, 409). The count rides the schedule's one read (`scheduleHeadcounts`, counts
    only, bulk reads, paged) as `familyHeadcounts`, omitted when off; the list row's caption shows it ("9 of 13 in · 1 out · 1 maybe";
    red "5 out · at most 8 can play" in the event window's Out word style via `.sheetDoorTone[data-tone=out]`). `total` = the active
    roster (no call-ups). The admin's read-only schedule passes no `headcountFor` (unchanged). Overview "Next up": when the next event
    has a family count it shows "X of N in" (Late folded in) + Out + Maybe chips; otherwise today's chips, with "not marked".
  - **Part 5.** Room read `GET .../events/[eventId]/family-answers` (tier 404, `attendance` capability, live season; read only).
    `ScheduleAttendanceRoom`: Families card (counts, "⚠ N changed since you marked: Maya · Show" filtering the list, "Invite parents
    from the Roster →" when nobody or few are in the app, **Use N family answers**, the toast with **Undo** inline in the card), grey
    line under each player on a phone, amber when drifted, "Family hasn't answered"; at a desk (>900) the "Player · Family said ·
    Your mark" head and the family cell in the row. `CoachRsvpSheet` family box + hint. The event window's Attendance row gains
    "Families: 7 answered · 3 haven't · 1 changed" (amber "changed") until the start. Use stays until the event's end time (no end
    time: its day). Cancelled: card and lines go.
  - **The rename (ask 9):** `ATTENDANCE_WORD.unknown`, `COUNT_WORD`/label in `coach-schedule-sheet.ts` (and the all-unmarked
    sentence: "12 not marked — Avery, …" instead of "12 haven't replied"), the practice run page, Overview's chip word, the history
    panel, `MonthlyAttendanceChart`'s foot ("left Not marked"), 20 help lines in `coaches.tsx` (incl. keywords/searchText; "hasn't
    replied" → "isn't marked"; the redundant "(not marked yet)" gloss removed). Game day's Who's here inherits the vocab. NOT touched:
    the practice planner's "hasn't replied yes" (a different meaning: not In or Late) and code comments.
  - **Session 1 item (d) done:** the parent's read offers a pill only on events of a season the child is rostered in (through the
    account's own reach), so a team with two seasons open never offers one the writer refuses.
  - **Tests:** `tests/unit/family-availability-coach.test.ts` 23/23 (count, red, drift, mark time, Use, card, words, who-sees-what,
    tier-off gates, admin schedule unchanged, rename guard, the season filter); `family-availability.test.ts` 22/22 and
    `coach-schedule-sheet.test.ts` updated, green. `tsc` clean. Lint: warnings only, all pre-existing in those files.
  - **Done differently, and why:** (1) the room's family side is its OWN read (not added to the attendance/lineup GETs), so the
    shared attendance payload (also Game day's) is untouched; the sheet asks for it only when the schedule read says families can
    answer. (2) The coach side's day reads "Tue" (short weekday) and "today"; first name falls back to "a parent" (O2). (3) The
    toast is inline in the Families card, not a floating pill, so it never sits on the autosave's Saved pill. (4) The Families
    card's "Invite parents" link shows when nobody, or fewer than half, are in the app (the drawing shows it only on its "few" frame).
  - **Owed to the walk / later:** the desk column widths (17rem family cell) need eyes at 720 px; Remind (Session 3) joins the card.
  - **Session 2 simplify (4 angles: reuse, simplification, efficiency, altitude).** Applied: one day-wording classifier shared by the
    parent's and the coach's day words; one first-name rule (the room and the sheet used two, one printed "null"); the room's "changed"
    names come from the sheet; the "Use" list is emptied once at the source when the event has ended; `FW.changedPart` replaces the
    index hack; two pass-through word wrappers gone; `BookStatus` is `RepAttendanceStatus`; the team passed in saves a second
    `rep_teams` read on the schedule load; the Settings counts read together with the plan-coverage read; the room route's reads run
    together. **Declined, with reasons:** sharing one segmented control with the Schedule visibility row (touches Settings' other row,
    about a dozen hand-written copies exist; a later tidy); lifting the attendance route's private resolver into `lib/` (a shared
    PATCH, third copy noted, do it when a fourth route needs it); folding the room's read into the attendance GET (would widen the
    shared payload Game day reads; the separate read is on purpose); a name cache for `firstNames` (up to ~25 auth lookups per room
    open; fine for now, measure at the walk); `familyStateFor` / `byPlayer` helper (churn in a tested type for little gain); the
    Overview and schedule count sharing one view function (see the review notes); `plural` to `pluralize` (one call site fits).
  - **Session 2 review (high-risk tier; 4 finders: security/tenancy, data/contract, concurrency/state, regression; gate: typecheck
    clean, lint 0 errors, focused tests 116/116; `verify:changed` 22 failures, ALL other sessions' files).** No Critical or High.
    **Fixed:** (1) a confirming tap made while a save is in flight was dropped (the unsaved-changes check ignored it); (2) the sheet's
    optimistic mark time now uses the server's own rule (`bookMarkedAt`, with the status the server holds), so All in / Use / Undo no
    longer flash a false amber; (3) the room hides itself if the switch is turned off while the window is open; (4) a finished
    season's schedule read no longer carries headcounts (live season only); (5) Settings read could leave an unhandled rejection
    (introduced by simplify); (6) paged reads of marks, answers and links are ordered (a second page could skip or repeat a row);
    (7) the attendance writer no longer wipes a mark time a caller did not name; (8) the schedule row's count re-reads once on close
    when families are on and attendance was saved (it went stale until a reload).
  - **Review: declined / owner's call (go to the walk):** (a) the practice planner and its Groups room still say "haven't replied
    yes" and "Who replied" (a different meaning, not In or Late; ask 9's scope: owner); (b) the team Overview's "Next up" never shows
    the red "at most N can play" (ask 8 says the count; ask 7 puts the red on schedule rows; say if Overview should carry it);
    (c) the coach's family answers are read once when the window opens (an answer arriving while it is open shows on reopen; a tap
    then clears a warning for an answer the coach never saw); (d) Undo also resets a player the coach confirmed with a tap to the
    same mark; (e) a coach who can mark attendance sees parents' first names and notes even without roster-PII access (ask 11 as
    written: confirm); (f) Game day's one-tap Who's here cannot clear the amber (it sends no confirm; only before the start);
    (g) demo and UAT fixtures write attendance without `marked_at`, so they cannot show the amber until a coach re-taps (seed it if
    the demo should show it); (h) with Schedule visibility on Staff only the setting row keeps "Games" pressed while its help text
    says families cannot answer (the answers return when visibility goes back); (i) "Not marked" is longer than "No reply": the
    layout sweep on Game day's Who's here, the room's chips and the practice run page is owed at 360 px.
  - **Owed to Session 3 (carried from Session 1, still true):** clear a parent's notes BEFORE any account delete; decide whether a
    departed parent's answer shows by name; release the 24-hour Remind claim on a total send failure. Remind joins the Families card
    the room already has (`FamiliesCard` in `ScheduleAttendanceRoom`). The lineup warning uses `rep_team_lineups.updated_at`: confirm
    it reaches the page's type.
- Session 3 (Parts 6–8): not started.
- Session 4 (Part 9): not started.
