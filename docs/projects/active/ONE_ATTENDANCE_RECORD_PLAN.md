# One attendance record — plan

**Status:** RULED 2026-11-13 (owner, mid-walk §526). Not built. PM brief: `ONE_ATTENDANCE_RECORD_PM_BRIEF.md`.
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

## 5. The walk (owner 2026-11-13: concise, one action per step, ~20–50 boxes)

Rewrites §526 from section 4 on, plus short re-checks for sections 1–3 covering only what changed for families (Late,
who/when). Owner calls live outside the step counter. Target ≤ 40 boxes for the whole rewrite.
