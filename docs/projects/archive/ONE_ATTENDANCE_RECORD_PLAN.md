# One attendance record — plan

**Status:** on the board (Owner Morning Brief).
**History (not kept current):** RULED 2026-11-13 (owner, mid-walk §526). S1 the record committed `54272a665` + `f554a73ea` 2026-11-13; S2 the screens committed `bfdaa885e` 2026-11-13; S3 the closeout committed `6e9d5fc77` 2026-11-14 with its legal text in `ff92f1afd` (owner walk §529 PASSED 50/50 on 2026-11-14, no findings; the five owner calls RULED 2026-11-14 as recommended, only call 3 changes the product: consent 0.2 → 0.3 for new parents, worded by `/legal` and BUILT 2026-11-14). PM brief: `ONE_ATTENDANCE_RECORD_PM_BRIEF.md`.
**Supersedes** Signed-in Family Stage 4b's two-record design (`SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md`, committed
`22db0210d` … `7fa87f3f7`; `COACH_AVAILABILITY_RSVP_PLAN.md` §governing constraint 1 and :136-137; the accounts plan's
Stage 4b ask 3). Everything else Stage 4b ruled (the switch, Remind's cap, the bell's 48 h rule, consent 0.2, ask 14's
footer, the retention clocks' lengths) stands unless named below.

## 0. The ruling (owner 2026-11-13, binding)

One attendance answer per event + player. A connected parent or an attendance coach can set it; **latest change wins.**

1. Choices **In · Late · Maybe · Out** (+ Not marked), the same for family and coach before the event. Late is the
   coach's pre-game lineup signal.
2. **At the event's start families lock**; only the coach changes it after (what happened). A Maybe still standing
   counts as Not marked in every stat. Stats read the record as it stands — an uncorrected family In counts as
   attended (owner: fine).
3. **One status, two notes:** the family's note (coach reads; deleted 30 days after the event) and the coach's private
   note (staff only).
4. **Who and when, both sides:** "Out · Coach, today · earlier: In (Adasmom, Nov 1)". A parent sees the coach's change
   on their OWN child (owner: attendance is not confidential). Never a teammate, never the coach's note.
5. **No message to families when the coach changes it.** The coach's bell on a family change stays (Stage 4b ask 12).
6. **"All in" fills only players nobody has answered.** Remind skips any player with an answer, coach-set included.
7. The Attendance window loses "Family said" and "Use N family answers" — one answer per player with who/when.
8. **History:** the status is kept forever; who-set-it, the previous answer and family notes are purged on clocks
   (family note: event + 30 days; who/previous: season's last event + 60 days).
9. Call-ups (no family link) stay coach-only. House league has no coach book — its later stage designs its own; this
   plan must not block it.

## 1. What the code does today (verified 2026-11-13)

- The coach's book `rep_team_event_attendance` (mig 069; keyed `event_id, player_id`; on PROD with history) is read by
  every stat. Status CHECK `unknown|attending|absent|late` (069:12). `maybe` would fall through to "unknown" in every
  count (db.ts:5470, 5543, 6584; coach-attendance-receipts.ts:49; coach-practice-misses.ts:142).
- The family's answer `event_availability_answers` (migs 476/477/479/480/482) is **dev only** — never on prod.
- ⚠ **The Attendance window saves the WHOLE roster on every tap** (ScheduleEventSheet.tsx:614, 700 ms autosave; the
  upsert re-stamps every row, db.ts:6243-6262; "All in"/"Reset" set every row :594-598; the window never re-reads
  while open). Under latest-wins this would overwrite every family answer that arrived since the window opened. **The
  changed-rows save must ship in the same commit as the family writer.**
- ⚠ **Privacy:** 069:31-41 lets every org member / assigned coach read whole rows, and `getRepTeamEventAttendance`
  selects `*` (db.ts:6225) into the lineup, game console, practice plan and roster routes. Adding `family_note` and
  parent ids there would reach lineup-only staff (breaks Stage 4b ask 11). Explicit column lists; family fields only in
  the attendance-capability read. No browser code reads the table directly.
- Child → player for a parent's write already exists: `getFamilyReach` gives `teams[].entryId` = `rep_roster_players.id`
  (family-availability.ts:270-286). Requiring reach to THIS team keeps call-ups coach-only for free.
- The lineup triangle (db.ts:6583-6586) fires when a player marked coming is missing from the saved lineup or a player
  marked Out is in it. Under one record a family answer after the lineup was saved raises it — wanted.

## 2. Design

**Data — the coach's book becomes the one record; the answers table is retired.**
- Book gains: `maybe` in the CHECK; `set_by_kind` (coach|family|system), `set_by_user_id`, `set_at` (rename of the
  dev-only `marked_at`); `previous_status`, `previous_by_kind`, `previous_by_user_id`, `previous_at`; `family_note`
  (1–200), `family_note_by_user_id`, `family_note_at`. Backfill existing rows as coach-set (`set_at` from
  `marked_at`/`updated_at` where status ≠ unknown). Dev's family answers copied in; prod copies none.
- **One writer:** a SECURITY DEFINER function (row lock; moves current → previous only when the status changes;
  `only_if_unknown` for "All in"). Both the coach PATCH and the family route call it. Replaces the family CAS writer.
- The family writer never writes `updated_by` (so the purge can null family authorship without touching coach audit).
- RLS: drop/revoke the 069 read policies (no browser reader); server reads use explicit columns.

**Coach save:** the window sends only changed rows (status and coach note as separate fields); "All in" is a server
`fillUnanswered`; the response returns current rows so the window merges what it didn't touch. Same-player race =
latest wins (the ruling); the reply shows "Adasmom just changed this" when the row moved under the coach.

**Watched automation (own commit, needs the owner's explicit go — call C4):** the nightly purge keeps its name and
schedule (mig 477 untouched); its body is rewritten to NULL family notes/authorship on the two clocks and **never
DELETE a book row** (SQL test). Triggers (mig 480): the new-day rule per call C1 below; the note-clearing triggers
retarget to `family_note`; the new-day trigger is DROPPED (C1). The child-merge step for answers (482) becomes dead — the book rides `player_id`.

**Screens**
- *Family page:* In · Late · Maybe · Out; current answer with who/when (a coach setter reads "Coach"); locked at start.
- *Attendance window:* one column of answers with who/when and the family's note; Maybe offered before the start only;
  "Family said", "Use N family answers", Undo-of-use and the amber "changed since you marked" line removed (the bell
  covers it). Reset per call C2.
- *Schedule count / red row, Overview Next up, Remind, bell, lineup pool words:* read the book alone. Remind's
  "unanswered" = Not marked (any setter).
- *Stats:* no logic change; comments that say "the coach actually marked" reworded.

**Dead after the merge:** `usableFamilyMark`, `answerAgreesWithMark`, `familyDrifted`, `bookMarkedAt`,
`roomFamilySummary.usable/changed`, the 482 join step, the `FamilyAnswer` type (folds into the status vocabulary),
the `event_availability_answers` table.

## 3. Owner calls — RULED 2026-11-13

- **C1 = NOTHING is cleared on a new day** (owner chose against the recommendation): answers carry over; families and
  the coach update them by hand. This **reverses Stage 4b ask 10** — mig 480's new-day trigger is dropped, not
  retargeted, and any "answer again" wording tied to a moved event (Session 3's moved-event line) goes with it.
- **C2 = Reset clears only the coach's answers** (as recommended).
- **C3 = Maybe only where families can answer**, before the start only (as recommended). A team with the switch off
  or the tier off sees exactly today's In / Late / Out.
- **C4 = YES, change the nightly clean-up job** (the owner's explicit go for the watched automation, 2026-11-13): own
  commit; it blanks family notes and who-set-it on the clocks and never deletes an attendance answer.

### The calls as asked

- **C1 — A game moves to a new day.** Stage 4b ask 10 cleared family answers on a new day. Rec: clear **family-set**
  answers on events that haven't started; the coach's own answers stay (they're usually an injury or a known absence).
- **C2 — "Reset" in the Attendance window.** Rec: Reset clears only answers the coach set; families' answers stay.
- **C3 — Maybe when families can't answer** (the team's switch Off, or the family tier off). Rec: Maybe appears only
  where families can answer; a team with the switch off looks exactly as today.
- **C4 — The nightly clean-up job** (watched automation: changes only on the owner's explicit go, in its own commit).
  It deletes family answer rows today; under one record it must instead blank family notes and who-set-it on the
  clocks and never delete an attendance answer.

## 4. Build — three sessions

Migrations: **483** columns, CHECK, backfill, writer, indexes, RLS, dev copy · **484 (watched, own commit)** purge body ·
**485** triggers, delete trigger, `org_children_join` without the answers step, DROP the answers table. Prod order:
476 → 477 → 479 → 480 → 482 → 483 → 484 → 485 (or fold — none is on prod; decide at the promote).

- **S1 — the record:** 483–485; db.ts projections (explicit columns) + writer calls; attendance PATCH (changed rows,
  `fillUnanswered`); family route → the writer; the `maybe` type sweep (types.ts:1211, attendance/route.ts:19,
  coach-schedule-vocab/-sheet, attendanceOptions, ScheduleAttendanceRoom, roster player page, local unions); SQL tests
  (the purge never deletes; a family can't write after start; only_if_unknown).
- **S2 — the screens:** Attendance window, family page, schedule count, Remind, bell, lineup; delete the dead rules;
  unit tests rewritten.
- **S3 — closeout:** /simplify + /review; help (`lib/help-content/coaches.tsx` + any family help); DATA_DICTIONARY +
  snapshots; /legal (ruling 4 re-signs Stage 4b ask 5 and its payload guard; FAMILY_ANSWERS_AND_REMINDER_PRIVACY.md);
  MANUAL_PROD_STEPS; seeds/demos; UAT specs; the walk.

**Riskiest:** the changed-rows save shipping with the family writer (together, never apart); the purge never deleting;
the RLS change; the backfill on prod rows (batched, lock_timeout).

### Running a session

Start a fresh chat with: *"Build Session N of docs/projects/active/ONE_ATTENDANCE_RECORD_PLAN.md."* Each session:
present the PM UX summary for its slice first (AGENCY_RULES); read §1's verified facts but re-check any line you build
on; stage explicit pathspecs only; update the Progress block below; stop at the session boundary.
- ⚠ **Another session has uncommitted §526 walk fixes** in `components/coaches/FamilyAnswersSettingRow.tsx` (call 9:
  the switch paused under Staff only) and `lib/family-availability-words.ts` (as of 2026-11-13). Build around them; do
  not commit them as this project's; ask the owner if they are still uncommitted when S1 needs those files.
- Migration numbers: re-check `supabase/migrations` for the next free number before writing (483 was free 2026-11-13).
- `npm run dev` restart owed before the walk (new migrations, shared modules).

### Progress
- 2026-11-13: ruled (§0, §3 C1–C4); plan + PM brief written. Next: S1.
- 2026-11-13 — **S1 the record BUILT (commit owed; owner asked to approve first).** Migs 483 (columns, CHECK, backfill,
  the writer `rep_attendance_write` + the coach batch `rep_attendance_write_many`, RLS dropped/revoked, dev copy), 484
  (watched: the purge body; never deletes a book row), 485 (C1 new-day trigger dropped; delete trigger → Remind log only;
  note-clearing triggers retargeted to `family_note`; new family-note writer-gone trigger; `org_children_join` without
  482's step; answers table DROPPED) — all applied to DEV only. Dev backfill: 1,813 marked rows → coach-set; 3 family
  answers copied in (1 note). `tests/sql/one-attendance-record-fixture.sql` **13/13 on dev** (replaces the Stage 4b
  fixture, which tested the dropped table). Typecheck clean; the four family-availability unit files rewritten for one
  record (all pass); the full `npm test` has 22 failures, none in attendance or family answers (other sessions' work:
  billing, disputes, possessives, walks, practice-plan arrival words). ESLint on every changed file: 0 errors.
  `verify:changed` itself stops at the unit-test step and its ESLint run crashes on a plugin-config error over the
  shared tree (lint run directly on these files passes).
  - **Scope widened past §4's S1 line, deliberately:** dropping the answers table in S1 would have broken every reader of
    it until S2, so S1 also moved those readers onto the one record **with their current look**: the schedule count,
    the room's family lines (now "a row whose current answer a family set"), the lineup's family answers, Remind
    ("answered" = a family set it; any coach answer = marked), the coach's bell (the drift word gone — one record cannot
    disagree with itself), the parent's page and Leave/Stop's `answeredByAccounts`. `familyLineupFlagEventIds` is a no-op
    (`[]`) until S2 deletes it — a family Out is the status, so the coach's own triangle flags it.
  - **"All in" and "Reset" moved to the server in S1** (the hard rule pulled them in: a changed-rows save with a
    client-side "All in" that sets every row would still overwrite family answers). `{ fill: 'attending' }` →
    `only_if_unknown`; `{ reset: true }` → `only_if_set_by = 'coach'` (C2). The window runs them after flushing taps.
  - **The changed-rows save + the family writer are in the same unit** (hard rule): the window sends only rows whose
    status or coach note differs from what the server last said; the reply's rows are merged (a row re-picked while in
    flight keeps the pick). The **game console** (missed by §4) now sends the status alone.
  - **§1 re-checked:** confirmed — the whole-roster save, `select('*')` into lineup/console/practice/roster routes, no
    browser reader, `getFamilyReach` → `entryId`, the triangle rule. Corrected: `maybe` also fell through in
    `coach-schedule-sheet.ts`'s row words (would have crashed on a Maybe), the practice picker (would label Maybe "Out"),
    the practice run page (Maybe in no group), the schedule's "N marked" and the player page's label — all now read
    Maybe as Not marked via `countedAttendanceStatus` (lib/coach-schedule-vocab.ts), the ONE rule for ruling 2.
  - **Maybe for coaches (C3)** is accepted by the PATCH only where families can answer the event before its start; the
    window does not offer it yet (S2 draws it). `ATTENDANCE_OPTIONS` keeps four; `attendanceOption()` renders a Maybe.
  - **C1:** the moved-event "answer again" sentence and its pre-save check are gone (event PATCH, `family-notify`);
    `FAMILY_AVAILABILITY_WORDS.answerAgain` is left in the words file (another session's uncommitted edit is there; S2
    deletes it).
  - **Interim seams for S2 (deliberate):** the family page still speaks In / Out / Maybe — a coach's Late reads as In and a
    coach-set answer shows on the pill with no who/day line (S2 draws "Coach, today"); the room still shows "Family said"
    (now = family-set current answers, so "Use N family answers" always offers 0 and the amber drift never fires); the
    dead rules (`usableFamilyMark`, `familyDrifted`, `bookMarkedAt`, `roomFamilySummary.usable/changed`, `FamilyAnswer`)
    are still in the tree.
  - **Done ahead of S3 because a gate needed it:** DATA_DICTIONARY (the book rewritten as the one record; the answers
    table marked RETIRED) and MANUAL_PROD_STEPS entries for 483/484/485 (prod order, the backfill note, verify SQL).
    Schema snapshots were refreshed by the hook after each apply. Not touched: `FamilyAnswersSettingRow.tsx` and
    `family-availability-words.ts` (the §526 walk fixes, another session's).
  - **Commit shape proposed:** (A) 483 + 485 + all code, tests, fixture, dictionary, prod steps, snapshots, this plan,
    TODO line — the changed-rows save and the family writer together; (B) 484 alone, its message naming the behaviour
    change (the nightly job blanks instead of deleting). `TODO.md` has another session's edits: stage this line only.
  - Next: **S2 — the screens.** `npm run dev` restart owed before any browser look (new migrations, shared modules).
- 2026-11-13 — **S1 COMMITTED + REVIEWED.** Commit A `54272a665` (migs 483 + 485, all code, tests, fixture, dictionary, prod steps,
  snapshots, this plan, the TODO line; 44 files) and commit B `f554a73ea` (mig 484 alone — the watched nightly job, owner's go C4).
  Dev server restarted after both. `/review` (high-risk tier; four lenses: the coach window's save, the family writer's reach, a Maybe
  census, the RLS drop + dropped-table blast radius). Verified clean: the browser reads nothing from the table; no live code uses the
  dropped table or `marked_at`; the writer's guards, row lock, family-after-start refusal and `updated_by` rule hold; a call-up cannot be
  reached by a parent; the family reads name their columns. Proof run on a CLEAN copy of the commit: typecheck 0 errors, the
  attendance unit files + the sheet guard pass, the SQL fixture 13/13 on dev.
  - **Fixed in commit A (found by the review):** (1) a tap that went back to the answer held before an in-flight save was lost (the
    reply overwrote it) — the window now compares against what the request carried; (2) the coach's note lost a trailing space
    mid-typing (the server trims) — what the coach is typing stays as typed; (3) "All in" / "Reset" cleared the unsaved flag over a
    pick made while the flush ran, and (4) a save chained behind another read the rows of the render that asked for it — the window
    now keeps one live copy of the rows (written the instant it changes) and every save reads it when it runs; (5) the room's count
    chips and filter left a Maybe in no chip — they read through `countedAttendanceStatus`; (6) the practice picker tagged a Maybe like a
    marked player; (7) a parent tapping In over a coach's **Late** erased it (the page still shows Late as In) — an interim guard writes
    only the note then; **S2 removes it the moment the family page can pick Late**; (8) "Reset" did nothing on marked rows nobody set
    through the writer (seeded, fixture, UAT rows) — mig 483's Reset guard treats them as the coach's (re-applied to dev; fixture 13/13).
  - **Owner calls the review raised (not decided, not built):** (a) **Does a standing Maybe stay on Remind's list?** Ruling 2 (counts as
    Not marked) and ruling 6 (Remind skips any answer) disagree; today a Maybe is skipped. (b) **Stats on games not yet played:** the
    reliability and per-player reads count every scheduled event with no date test, so a parent's advance In / Out on an upcoming game
    now counts as attended / absent before it is played (a coach's advance mark always did). Ruling 2 says "as it stands" — confirm,
    or count started events only. (c) **Leave / Stop and a deleted account** blank the family's NOTES only; who-set-it stays until the
    60-day clock (design says notes only) — a /legal point for S3.
  - **For S2 (screens):** the family page picks In / Late / Maybe / Out and shows "Coach, today · earlier: …" (then delete the In-over-Late
    guard in `writeFamilyAnswer`); the game console shows nothing pressed for a Maybe and counts it "here", and the RSVP sheet ticks
    nothing for a Maybe; the room's Maybe badge and the choice styles have no `maybe` look; a confirming tap on a mark a family has since
    changed sends nothing (console and window); a parent of an **inactive** roster entry can still write an answer the coach never sees
    (`readChildTeamEntries` excludes call-ups, not inactive) — exclude them; delete the dead rules and `FAMILY_AVAILABILITY_WORDS.answerAgain`.
  - **For S3 (closeout):** the demo seed, UAT seeds and the demo reconcile insert marked rows with no setter (Reset now copes, but no
    "earlier" ever shows) and the reconcile deletes family answers at future demo events, which contradicts C1; the writer does not check
    that the player belongs to the event's team (both callers do; a lent call-up may belong to another team, so the check needs care);
    a no-op write still leaves an empty Not marked row (as the old whole-roster save did). `memory/reference_db_schema.md` was refreshed
    by the snapshot hook and is not in either commit.
  - Full suite, proven on CLEAN copies of the commits: the parent commit fails 34 tests and commits A + B fail the identical 34 — no new
    failure (practice-plan arrival words, the team-move table census, billing, disputes, possessives, walks). On the working tree it read 25
    (other sessions' uncommitted fixes mask some); the one failure this work caused on the way — the sheet guard naming the rows' state by
    its old spelling — is fixed in commit A.

- 2026-11-13 — **S2 owner calls RULED** (start of S2, as recommended): (a) **a standing Maybe stays OFF Remind's list** — ruling 6
  governs Remind (a Maybe is an answer); ruling 2 governs stats only. (b) **Stats count STARTED events only** — an advance answer on
  an event not yet started counts in no stat, whoever set it (also retires the older coach-advance-mark case). (c) S2 may edit
  `lib/family-availability-words.ts` and commit only its own hunks (the §526 "paused" hunk stays out); `FamilyAnswersSettingRow.tsx`
  is not touched. (d) **Inactive players: answers only** (owner, as recommended) — a parent of an INACTIVE roster entry can't answer
  and sees no pill; the family reach itself (team page, schedule, recap) is unchanged.
- 2026-11-13 — **S2 the screens COMMITTED `bfdaa885e`** (26 files; `family-availability-words.ts` without the §526 "paused" hunk,
  TODO.md this line only). No migration. Proof on CLEAN copies: typecheck 0 errors; full suite — the parent `9d05cd40a` and the commit
  fail the identical 34 tests (other sessions' work), no new failure. /design ran before the commit (findings 2–7 applied: the Set-by
  line clamps to two lines with a desk tooltip, a ticked-but-disabled Maybe keeps full contrast and the card fill, the desk RSVP
  panel scrolls instead of clipping, dead drift CSS removed, the console's Maybe tag takes the console chip idiom). **Owner calls
  open:** (1) the family pill pair — Maybe is an amber FILL and Late an amber RING, the reverse of the coach side (Late amber tint,
  Maybe dashed); /design recommends the family Maybe go dashed and Late take the fill, which restyles the approved Maybe; (2) dashed
  edge = "Maybe, undecided" widens the dashed rule logged 2026-09-30 ("left the list / projected"). Device check: the Late ◷ glyph.
  Dev server restart owed before the walk. `/review` offered.
  - **One vocabulary:** the family answers in the record's own words (`AnswerStatus` = attending · late · maybe · absent; null clears);
    `FamilyAnswer`, `isFamilyAnswer`, `statusOfFamilyAnswer`/`familyAnswerOfStatus` are gone (`isAnswerStatus`, `answerOfStatus`). The
    four words are `ATTENDANCE_WORD`'s, so a family's Late and a coach's Late are one spelling.
  - **Family page:** In · Late · Maybe · Out; the sheet's line "Out · Coach, today · earlier: In (You, Nov 1)" (`W.setLine`; the row's
    `setBy` replaces `byFirstName`/`dayWords` in the payload allow-list); a coach is "Coach", never named; the other parent named only
    while connected. **Tapping YOUR answer again clears it; the same answer set by the coach or the other parent is agreed with, not
    cleared** (it would otherwise let a parent's "yes, Out" wipe the coach's Out). The interim In-over-Late guard is DELETED.
    Inactive entries refused in the writer and offered no pill (`childSeasons` reads active entries only).
  - **Attendance window:** one answer per player with "Set by" (phone caption / desk column: "Adasmom, today · “note” · earlier: In
    (Coach, Nov 1)"); the lines come from the room's family read AND every attendance PATCH reply (`lines`, `answerLinesForReply` —
    attendance-capability route only), and a row with an unsaved pick shows no line until its save lands. "Family said", "Use N family
    answers", Undo, the amber line and the "N changed" door part are gone. The Families card counts the record: answered = a family set
    it, haven't / no parent = Not marked; "No parent in the app yet" now reads who is connected (a coach's marks no longer trip it).
  - **Confirming taps are sent** (window and console): a tap on the answer the screen shows is sent even when unchanged, because neither
    re-reads while open; a confirm made during another save survives that save's merge.
  - **Maybe:** `attendanceChoices` adds Maybe to the RSVP sheet only where families can answer before the start (C3), and shows a
    standing Maybe ticked-but-disabled after it; dashed `CircleDashed` look on the badge, the sheet and the console. Console: a Maybe
    lights Not marked dashed with a "Maybe" tag, is never counted "here", and the count adds "· N maybe".
  - **Record-alone reads:** `headcountOf` takes the status only; Remind unchanged (a Maybe is an answer, ruling a); the bell's prior is
    any setter's status (a parent's In over the coach's Late is a change) and `markWord` is gone; the lineup pool word reads the status
    (`lineupTagWord(status)`), `lineupFamilyOuts` = a lineup player whose current Out a FAMILY set, and both callers leave those players
    out of the book's "marked Out but still in the lineup" (no double sentence); `familyLineupFlagEventIds` deleted (the book's own
    triangle covers it).
  - **Stats (ruling b):** `getRepPlayerAttendanceSummary`, `getRepTeamAttendanceReliability`, `getRepTeamAttendanceMarks` take
    `starts_at <= now` (`startedBy`), so totals, receipts and the month chart agree. `computePracticeMisses` (pure, test-only consumer)
    untouched.
  - **Words changed that S3's /legal + /docs must re-read:** the switch's `on` / `off` / `turnedOff` (they promised "your own marks stay
    yours"; now "one answer per player… the parent sees yours"); the RSVP box hint "Families don't see your mark" → "A tap replaces the
    answer. The family sees it, but never your note."; `answerAgain` deleted.
  - **Tests:** the four family-availability unit files rewritten (86 tests) — 167/167 across every attendance file; typecheck 0 errors;
    ESLint 0 errors on every changed file; spelling gate clean. Full suite: 22 failures on the working tree, none in these files (proof
    on a clean copy of the commit in the commit entry).
  - **For S3:** dev bell lines filed before S2 hold `answer: 'in'|'out'` in their metadata; a fold into one reads "undefined" for that
    item (dev only, never on prod; a fresh line is fine). Help + family help, demos/UAT seeds, the walk.

- 2026-11-14 — **S2 REVIEWED (`/review`, high-risk tier); fixes COMMITTED `3756e37d8`** (6 files, no migration). Four finders (stats bound ·
  family payload + writer · lineup + Maybe) plus the coach window's save read in the main loop. **Held up, no change:** the window's
  changed-rows save (a confirm made during another save survives the merge and is sent next; a confirm never reaches a row the coach did
  not tap; All in / Reset flush first and then take the server's rows); the attendance PATCH's `lines` and the room's family read are both
  behind the attendance capability; the parent payload never names a coach, never carries the coach's note, never another family's answer,
  names the other parent only while connected; the stats bound is one helper on all three reads and the exact complement of the family lock
  (`starts_at` is a non-null timestamptz); the lineup sentence is never doubled and the schedule triangle still covers a family Out.
  **Fixed:** (1) a parent's CLEAR now takes away only a family's answer (`p_only_if_set_by 'family'`) — the page never re-reads, so a stale
  "tap your own answer" turned a coach's Late into Not marked; the coach's bell now reads the record after the write; (2) a bare "agree"
  with the other parent's answer sends no note (it wiped their note); (3) `firstNames` remembers a found name 10 min — the autosave reply
  and every console tap did one auth call per answered player; (4) a Maybe the player already holds is not refused after the start (the
  route refused it and rejected the WHOLE batch); (5) the event window words a lineup Out as the family's only while the Out on screen is
  the family's own. Four source guards added. **Left, for the owner / S3:** (a) stats reads have no paging — a Supabase select silently stops
  at 1,000 rows (pre-existing; ~25 players × 40+ started events); the three reads could truncate at different rows — wants `fetchAll`;
  (b) an unconfirmed advance family In/Out counts as attended/absent once the start passes (ruling 2 as written — a known consequence);
  (c) the save reply names a connected other parent "the other parent" until reload, after an agree (cosmetic); (d) Maybe can be set on a
  call-up (harmless); (e) the autosave retries a failing save every ~0.7 s (pre-existing for any error); (f) no unit test pins the three
  reads' `startedBy` agreement; (g) `roster/[playerId]/page.tsx` attendance rate counts Late in the denominator only (pre-existing). The
  two open design calls (family Late/Maybe pill pair; dashed = Maybe) untouched. **Proof:** typecheck 0 errors; ESLint + spelling clean;
  90 family-availability tests pass; full suite on clean copies — `bfdaa885e` and the fix commit fail the same 34 tests (same names).
  Dev server restart owed (a shared module changed).

- 2026-11-14 — **S3 the closeout BUILT, committed `6e9d5fc77` (legal text `ff92f1afd`).** No migration. Steps in the owner's order:
  1. **Stats cut-off fixed.** The three attendance stat reads (a player's summary, the team roll-up, the receipts and month-chart marks) now go
     through ONE read in `lib/db.ts` that carries the started-events bound (taken once per read) and pages with `fetchAll` under a stable
     `.order('id')`. The roll-up's arithmetic moved to `lib/attendance-stat-fold.ts` (pure) and counts through `classifyAttendanceMark`, the
     rule the receipts and the month chart already used, so the three can no longer disagree. Tests: a source guard (all three go through the
     helper; one `now`; paged; ordered) and a 1,350-row run where totals, receipts and the chart agree through a fake server that stops at 1,000
     rows (`tests/unit/attendance-stats-paging.test.ts`). A real-database check: `scripts/seed-attendance-large-roster-fixture.mjs` (walk Part 7)
     adds ~1,300 past rows to 15U AAA and prints its own figures from its own paged reads; proved here setup → 1,309 rows → teardown → 0.
  2. **The two design calls**, as ruled: the family page's Late is an amber fill and Maybe a dashed 1px edge on no fill in neutral ink, matching the
     coach's RSVP sheet and the game console (already drawn that way); the dashed rule is widened and logged at the top of `memory/design_decisions.md`
     (2026-11-14). `/design` ran: contrast Late ≈ 5.0:1 on its tint, dashed edge ≈ 9:1, no clash with the focus ring; two notes only (a closed answer is
     a neutral grey chip; the family sheet's ticked choice stays olive for every answer).
  3. **Review leftover fixed:** the save reply now names a CONNECTED other parent after an agree (`nameOfInReply`; never a coach, never a parent who
     left; a failed lookup falls back to "the other parent" and never fails a stored save). Left on purpose as listed: Maybe on a call-up, the autosave
     retry loop, Late in the roster page's rate denominator.
  4. **Help** (`/docs`): the whole "Families say if they're coming" section rewritten for the one record (one answer per player, set-by and when, latest
     wins, lock at the start, Maybe, two notes, All in / Reset / Remind, nothing cleared on a new day, stats count started events only), plus the
     attendance and lineup one-liners and four FAQs; keywords and search text carry the new terms. No parent help surface exists, so what a parent
     sees lives there.
  5. **/legal:** the privacy draft's §5 and §9 promised the OLD model ("a separate record … never changes the coach's own record", "answers deleted",
     "a new day deletes answers") and are rewritten from migs 483 to 485; the topic file carries an UPDATE section with the corrections and three owner
     questions (Q1 the consent box 0.2 does not say a coach can change the answer, the sheet's hint now does; Q2 a leaving parent's first name stays
     on the coach's side until the clock; Q3 an uncorrected parent's guess counts once started). Two product words changed: the answer sheet's hint
     (a coach can change the answer, and you will see who and when) and the Leave/Stop confirm (the answers stay as attendance; the first name stays 60
     days past the season's last event; the confirm now also shows when the name survives only as the "earlier" answer). **The legal draft files held
     other sessions' uncommitted hunks as well as mine; owner ruled 2026-11-14: commit mine plus the Stage 4b text (`ff92f1afd`; the 4b text of
     2026-11-13 was never committed and my rewrite sits inside it), leave the friend-requests, audit-log and club-schedule hunks to their sessions.**
  6. **Docs of record:** DATA_DICTIONARY and the snapshots were already current from S1 (`check:dictionary` ✓; snapshots refreshed); MANUAL_PROD_STEPS carries
     483/484/485 and now names "453 first" in the order; the Owner QA Ledger has §529 and marks §526 sections 4 to 14 superseded.
  7. **Demos and UAT:** the census found no seed or spec that still names the old table or words. The one real conflict: the demo reconcile deleted
     EVERY attendance row at future demo events, family answers included (contradicts "a new day clears nothing"); it now spares family-set rows, and
     `check:demos` ignores them. The seeds' marked rows carry no setter, so no "earlier" shows in the shop window: `/demos`' call, nothing built. Dev
     bell lines filed before S2 now read through a one-line old-to-new mapping (dev only; delete it once no such unread line can remain).
  8. **`/simplify`** (four angles): removed the now-duplicate interfaces and the clock wrapper, made the paged read generic, shortened the name lookup
     and the bell mapping, narrowed the roll-up's select. Skipped on purpose: one shared "connected parent's name" helper between the page read and the
     reply (two small copies of a 10-line rule, different inputs), and reading the marks once for both the totals and the receipts (a bigger change to the
     route). **`/review`** (high-risk tier, four lenses: paging and stats · privacy and the legal text · help text against code · demo, bell, fixture
     regressions): no Critical or High. **Fixed:** a failed name lookup could turn a stored answer into a failed save and skip the coach's bell; the demo
     check could pass vacuously on a failed read; eleven help sentences that overstated the product (who the Remind report names, what "haven't"
     counts, which changes ring the bell, the note-clearing rule, the Maybe timing, the lineup words' audience, retention wording); the privacy text's
     "other staff see only totals" and "notes deleted at once" (a parent with another connection keeps theirs). **Left:** offset paging is not a snapshot
     (a row written mid-read can shift one page: acceptable for a stat; wording corrected); the unconfirmed-In / lineup-only staff seeing "a family set
     this" without a name; a parent's clear of an answer that no longer exists returns an error instead of nothing (hand-built request only).
  9. **Walk:** §526 sections 4 to 14 replaced by §529 (https://claude.ai/artifact/XvMU9P4N76krc7oSgnbMh1; 8 parts, 50 steps, 5 calls outside the count).
  - **Proof (2026-11-14, before the commit):** typecheck 0 errors; ESLint 0 errors on the touched files; spelling and dictionary gates clean; every
    attendance, family-availability, receipts, monthly-attendance and help test file passes (137/137). Not run: `verify:changed` (its ESLint run crashes on a
    plugin-config error over the shared tree), `check:layout` (no dev server up).
  - **Proof on clean copies:** the full `npm test` on a clean copy of the parent (`04402a69c`) and of commit A (`6e9d5fc77`): both run with the same
    34 failing tests (95 lines of output) with identical names, none in attendance, family answers or help; A adds 11 passing tests (17,084 → 17,095) and
    no failure. A also typechecks with 0 errors on a clean copy. (The working tree run showed 22 failures against 34 on the clean copies; the reason was not
    investigated. What matters here is that both clean copies fail identically.)
  - **Second review (2026-11-14, standard tier, three lenses: paging and stats · family answers, bell shim, demo check · help text against code):** no
    Critical or High. **Fixed (help text, `lib/help-content/coaches.tsx`):** Reset clears every answer a COACH set (it said "you set"); a parent's
    different answer replaces the earlier parent's note even with a blank box (it said "a note typed with the new answer"); the Remind confirm names only
    players you marked; "nobody to remind" and the event row no longer promise a no-parent count they don't show; Maybe added to the coach's choice list;
    the "Can I stop that?" answer now names the Sharing switch; retired search terms ('use family answers', 'undo') removed. **Left, on purpose:** the read
    instant is taken once per read, so an event that starts in the milliseconds between the totals read and the receipts read could appear in one and not
    the other (Low; the old per-call clock had the same gap); `check:demos` no longer counts a past game whose only mark is a family's as "attendance
    taken" (Low, arguably more honest); the product's own card words `nobodyLeft`/`nobody` say "has answered" when the family may simply have been
    marked (a product word: own change, not a help fix); the help does not say a leaving parent's first name stays for 60 days (add if `/docs` agrees).
  - **Owed:** dev server restart before the walk (shared modules and a stylesheet changed); the walk §529; the prod promote in the order named above;
    the five owner calls in the walk; the three legal owner questions (Q1–Q3, topic file); the privacy draft's findings-note numbering skips 8 until the
    friend-requests text is committed by its own session.
  - **Commits:** A `6e9d5fc77` (code, tests, the fixture script, the help section, the pill CSS, the design log entry, MANUAL_PROD_STEPS, the §529 ledger
    block and §526 superseded lines, the walk file; 19 files); B `ff92f1afd` (the four legal files, mine plus Stage 4b only); C = this entry and the TODO
    line. `lib/attendance-stat-fold.ts` and `tests/unit/attendance-stats-paging.test.ts` are in A.

## 5. The walk (owner 2026-11-13: concise, one action per step, ~20–50 boxes)

Rewrites §526 from section 4 on, plus short re-checks for sections 1–3 covering only what changed for families (Late,
who/when). Owner calls live outside the step counter. Target ≤ 40 boxes for the whole rewrite.
