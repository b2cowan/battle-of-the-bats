# Club Tier Stage 11a, part B — the club scheduler's screens, help and the dome walk (built to hub version 87)

> Paste into a fresh session on `dev`, **after part A (`CLUB_SCHEDULER_A_BUILD_PROMPT.md`) is committed**. Written
> 2026-10-11, the day the Stages 10 + 11 drawings were **ratified**: all twenty-seven asks as recommended (owner: *"looks
> great, go ahead and write the build prompt based on your recommendations"*). Part A built the server — the data, the
> engine, the bill, every writer, the sends — with no screens. **This part builds every 11a drawing, the help and the
> walks, and closes 11a.** The calendar feeds (6d) are not a precondition (owner, 2026-10-11).
>
> **The definition of done is the owner's own flow** (plan §6a), walked end to end in the browser: a six-month winter dome
> permit (10a), six fields, four full and two half; its Sundays 8:00–11:00 a.m. in 90-minute slots; the teams billed for
> the time each got, with payments that follow the time (Oct 1 pays for October and November, Dec 1 for December and
> January, …); the schedule and the bill sent for review; finalized; every team's schedule and budget following — every
> figure read back on the club's side and a team's. *"The simpler and more streamlined we can make this the better we will
> be able to market our product. This is a real pain point for orgs at present."*
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stages 10 + 11** (version 87).
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW, RESTYLED, UNCHANGED,
>   SHARED and COPY tag note is a requirement; open each one. **This part's screens:** **4 · Schedules · New schedule**
>   (`#s1011-list`), **5 · Drafts** (`#s1011-drafts`), **6 · The grid** (`#s1011-grid`), **7 · Adjusting**
>   (`#s1011-adjust`), **8 · Summaries · Export** (`#s1011-summary`), **9 · Send** (`#s1011-send`), **10 · Changed since
>   sent** (`#s1011-changed`), **11 · A coach's club slot** (`#s1011-coach`), from **12** (`#s1011-others`) the club
>   calendar frame only, **13 · A phone** (`#s1011-phone`), **14 · The dome, walked** (`#s1011-flow`, steps 3–6), **15 ·
>   Exports** (`#s1011-exports`, the schedule's PDF and workbook). The "precedent" frames show what is built today; they
>   are not to build.
> - **"Formatting check"** (`#s1011-format`) is your checklist, every row, including the seventeen `/design` changes.
>   **"Not drawn"** (`#s1011-build`) lists what part A carried; check its *Exports*, *Gates* and *Help* rows here.
> - The Decisions tab holds the rulings with their reasons (rows "Stages 10 + 11 · Ask 1–27", Stage 11 Asks 1–6, and the
>   two *Build question* rows part A put to the owner). Where you must depart, say so and record why; never silently.
>
> **Read first:** `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` (§5.3–§5.9 the shape, §6 the asks, §6a, §6b) and the **"10a BUILT"**
> and **"11a part A BUILT"** blocks at its top; `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §5 **D1** and **D3**. Memory
> `project_club_stage11_scheduler`, `project_club_stage6c_one_calendar`, `feedback_exports_house_format`,
> `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`, `feedback_money_figures_one_joined_band`,
> `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks`, `decision_rare_door_ends_body`,
> `decision_export_is_one_button`, `decision_one_toolbar_rare_tools_behind_tools`, `decision_waiting_count_is_amber_pill`,
> `decision_drawer_layers_form_vs_menu`, `project_coach_series_edit_scope`, `reference_artifact_publish_needs_full_read`,
> `reference_hub_script_parse_trap`, `reference_backticks_in_shell_strings`. The in-repo `memory/design_decisions.md`
> entries from 2026-10-01 on, including part A's Part 0 entries.

## ⚠ The lessons this stage already paid for

- **Wear the tournament's look; never touch its code** (P11-02, Ask 5). The New schedule window takes the generator's
  frame (`KitDialog kind="form" wide`, two steps), its ranked cards, its one statement and `NoticePill`'s Undo — as your
  own components. Lifting the two-step frame into one shared part is the tournament redesign's shared ask: **never edit
  `app/[orgSlug]/admin/tournaments/schedule/**` in this build.**
- **The grid is 6c specimen 4's, not the Timeline's axes** (P11-01, Ask 12): facilities down, a week across, each day's
  slots in clock order, an open slot drawn dashed; a one-weekday schedule reads its dates across, seven at a time (Ask 27,
  R12). It takes the Timeline's **behaviour** — the dashed preview, a refusal with its reason, the spring back, Undo.
- **"From the club" already means money** (P11-03). The coach's Money › Club tab labels a request the club pays that way.
  A practice says *"From {schedule} · the club’s schedule"* (Ask 16) — a screens guard holds it.
- **Hide the door where there is nothing to schedule.** League Plus has no rep teams until 11b, so the Schedules row is
  absent there (an entry point that can't serve is the 404's politer face). At phone width, New schedule and dragging
  are absent, not dead-ended (§5.9).
- **A team with no running season shows only its closed-season page** (`CoachTeamSeasonGate`): its coach can't review
  slots or a bill. Part A refuses such a team in Who; the screens say why in words, never a silent gap.
- **A shared part travels with its reason** (the 6c lesson): before reusing a part, check what question it answers. The
  New allocation form table answers "who pays how much"; here it answers "who gets how much time" — its words change, its
  shape doesn't.
- **Probes write nothing; one browser tester at a time.** Saved sign-ins go stale: check the landed path and retry once.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` and `git status` read fresh. Other sessions' hunks in shared files (TODO, the plans, the
   briefs, the ledger, the hub, the strategy docs) are theirs: build shared files as HEAD plus your own hunks.
2. **Part A is committed.** Read its "BUILT" block and **its note here, item 2a** (route names and shapes, the engine's
   module and inputs, the notice kinds, the words left for `/marketing`, and the two build questions' answers). If part
   A isn't committed, stop and tell the owner.

   **2a. Part A's note to part B (written by the part A session, 2026-10-11 — re-grep before you trust a name).**
   - **The data:** mig **326** (`club_schedules` + `club_schedule_slots` + `club_schedule_slot_teams` +
     `club_schedule_replies` + `club_schedule_sends`; `org_time_blocks.schedule_id` / `org_time_dates_off.schedule_id`, one
     owner each; `rep_team_events.club_schedule_slot_id`, NOT a foreign key). Dictionary: "The club's schedules". A send
     log row counts only once its step **landed** (`landed_at`); show nothing else.
   - **The routes** (every admin one takes `?orgSlug=` and asks `resolveScheduler`: the `club_scheduler` key, owner or
     admin, rep teams to hand time to):
     - `GET /api/admin/schedules` → `{ schedules, nothingToSchedule, canMoney }` (the list, specimen 4; hide the door when
       `nothingToSchedule`). `?new=1` → New schedule's inputs `{ groups, teams (each with its running season or null),
       places, permits (time only), schedules }`.
     - `POST /api/admin/schedules/generate` `{ startsOn, endsOn, blocks, datesOff, settings, startedFromPermitId?,
       scheduleId? (a regenerate keeps its locked/moved slots), round?, previewOnly? }` → `{ summary }` or `{ summary,
       slots, drafts }`. Each draft: `strategy`, `label`, `score`, `lines` (its measures in words), `measures`,
       `warnings` (each with its `line`), `totals`, `teams`, `assignments` (`{ slotKey: teamIds }`). Nothing is written.
     - `POST /api/admin/schedules` `{ name, …the time, settings, assignments: [{ slotKey, teamIds }],
       startedFromPermitId?, startedFromScheduleId? }` → `201 { id, version }` (Save as a draft; the server cuts the slots
       again and refuses a team twice at once).
     - `GET /api/admin/schedules/[id]` → the page: `schedule`, `time`, `places`, `teams`, `slots` (each with `heldBy`,
       `clash`, `locked`, `movedByHand`, `handedBack`), `fairness`, `bill` (**null unless `canMoney`**), `replies`,
       `sendLog` (money fields emptied unless `canMoney`), `changes` (the Changed-since-sent callout's lines).
     - `PATCH /api/admin/schedules/[id]` `{ action, version, … }` → `{ version }`: `rename { name }` · `regenerate { …the
       time, settings, assignments }` · `edit { edits: [{ slotId, teamIds?, locked? }] }` (a slot whose teams change by
       hand LOCKS itself; `locked: false` frees it — work out the weeks a drop reaches with `planMove`) · `bill { bill: null
       | { lineId, permitId, amount, plan: one|monthly|two_months|dates, firstDue, dates } }` (money readers only; never
       on a final schedule). Every write answers `409 changed` on a stale version. `DELETE` refuses a final schedule.
     - `GET /api/admin/schedules/[id]/send?kind=review|final|changes&replyBy=` → the preview (statement, teams with their
       people and lines, unreachable teams with the reason, the bookings contact, `blockers`, `correctionBlocked`, "Last
       sent"); for a reader without Accounting a team's bill, its correction and any email carrying money are left out.
       `POST { kind, version, teamIds, bookings?, replyBy?, billCorrections? }` → `{ teams, people, failed, bookings,
       allocationId, version, checks: { clashes, outsidePermit } }`.
     - Coach: `GET/POST /api/coaches/[orgSlug]/teams/[teamId]/club-schedules` (a HEAD coach's review cards; the reply
       `{ scheduleId, answer: looks_good|ask_for_change, words? }`); `GET/POST …/events/[eventId]/hand-back` (the three
       rows; `{ scope: one|remaining|all }`). The coach's events read now carries `clubSources` (`{ slotId: {
       scheduleId, scheduleName } }`) for "From {schedule} · the club's schedule"; a permit's window carries
       `handedOutBy` (Delete is refused while a schedule hands its time out).
   - **The engine:** `lib/club-schedule-engine.ts` (pure, client-safe): `cutSlots`, `heldSlots`, `seatCounts`,
     `shareTargets`, `generateDrafts`, `teamResults`, `planMove` (skips a week as `not_theirs` · `no_slot` · `full` ·
     `already_there` — all four need words), `teamTwice`, `slotPatterns`. Its inputs are built server-side by
     `buildEngineInput` (`lib/club-schedule-server.ts`). Settings: `lib/club-schedule-settings.ts` (`ScheduleSettings`,
     `readScheduleSettings`, `defaultSettings`). The bill: `lib/club-schedule-bill.ts`; the bill now, one place:
     `computeBill`.
   - **The notices:** `club_schedule_review` (act), `club_schedule_final`, `club_schedule_changes`, `club_bill_arrived`,
     `club_schedule_reply`, `club_schedule_handed_back` (the builders'; their link assumes the schedule's page at
     `/{orgSlug}/admin/schedules/{id}` — build it there or change `tellBuilders`).
   - **Words for `/marketing`:** every `[marketing]` tag in `lib/club-schedule-words.ts` and `lib/club-slot-event.ts`
     (the drafts' lines, the refusals, the emails, the notices, the send log line).
   - **The two build questions, ruled 2026-10-11:** **A** — a share is pre-filed only under a PLATFORM word the team's
     running-season plan already has; otherwise unfiled. **B** — a team that GAINED time is billed a correction; a team
     that LOST time is told what it is owed back and asks for it on Money › Club; never a negative bill; the first bill
     never changes. Only a team the changes touch is measured again (a rounding cent never bills an unchanged team).
   - **What the screens must do that part A can't:** (1) the coach's event form and sheet must **leave out the club's
     fields** on a club practice (name, time, place, status…: `CLUB_OWNED_API_FIELDS`) exactly as they do for a mirrored
     tournament game — the PATCH refuses them with `409 club_slot`; (2) Send the changes with **"bill corrections" off**
     forgives the gain for good (the baseline moves on) — say so on the switch; (3) a team that **handed time back** is
     owed back (recorded in the log) but not emailed — it did it itself; say it in the preview's hand-back lines; (4) an
     admin without Accounting can't send a schedule carrying a bill for review (the email shows the bill) — the
     blocker says why; (5) the review's "replies" read the latest LANDED round only.
   - **Departure from the drawings:** the dome's sample grid puts 11U AA and 9U AA on two fields at 9:30 at once; the
     schedule's one refusal forbids a team twice at once, so the engine gives a Junior team its full field and its half
     field at different times of the morning — the same 25 + 25 slots and the same $4,050.00.
3. **The UX summary for the owner comes first** (AGENCY_RULES), short and in owner voice:
   - **a club admin:** Schedules under Calendar; New schedule in one window (the time from a permit in one pick, who gets
     how much — evenly, by percentage by group, or a number a week — and the rules folded away); ranked drafts read by
     team or by day and exported before anything is kept; the schedule's page with every open slot on a week grid and
     fairness beside it; moves by drag with Undo; Bill the teams in two presses; Send for review or Final now; replies on
     the page; Finalize and send; changes held until Send the changes;
   - **a head coach:** the club's slots on the team's Schedule, marked as the club's, with their own arrival, notes,
     attendance and plan; a review card with their slots and their bill (Looks good / Ask for a change); Hand back; the
     bill on Money › Club and one callout on the Budget (Use the club's figure / Keep mine);
   - **a family:** the team's slots where they already look; no email from the club;
   - **the dome's booking office:** the whole schedule by field in one email;
   - any departure from the drawings.
4. **One browser tester at a time.** Ask the owner before any capture, probe, `check:layout` sweep or `auth-setup`, and
   whether another session is measuring. **A dev-server restart is owed before the walks** (new files and shared modules
   change): ask first. **Never reset the test club.**

## The code, read 2026-10-11 (re-grep before you trust a line number)

- **The look to wear** `app/[orgSlug]/admin/tournaments/schedule/Generator.tsx` (read only: step 1 `:1265`, step 2
  `:1454-1519` — cards `:1460-1474`, "Three more drafts" `:1475-1477`, the statement `:1512-1515` — the window `:1524-1548`,
  the save asks once `:1541`, `:1550-1565`); words `lib/schedule-words.ts` (`draftStatement` `:146`, `GENERATOR_WORDS`
  `:168-272`). The behaviour `…/schedule/components/ScheduleTimeline.tsx` (`dragPreview` `:276`, `refusedNote` `:278`,
  `handleDragMove` `:461`, `dropVerdict` `:486`, `handleDragEnd` `:504`, spring-back `:523-525`, preview band
  `:744-746`); the Undo notice `…/schedule/page.tsx:104-106`; `NoticePill` `components/admin/kit/club/RepKit.tsx:453`
  (doc `:439-452`); `KitDialog` `components/admin/kit/club/KitDialog.tsx:121` (`kind` `:143`, `wide` `:138`, `:181`);
  `PublishScheduleModal.tsx:2-19` ("who is told").
- **The form table for shares** `components/admin/kit/club/money/AllocationWindow.tsx:103` (Split `:527-533`, `SPLITS`
  `:57-63`, Pay by `:534-546`, the form table `:556-576` with its closing row `:566-575`); `spreadGroupFigure`
  `lib/club-bill-split.ts:81`.
- **The send window to copy** `components/admin/kit/club/money/RemindersWindow.tsx:28` (sample `:76-78`, `:142-150`;
  unreachable `:124-133`; last sent `:140`).
- **The admin's nav:** `kitCalendarLink` `lib/admin-kit-nav.ts:204-221`; built in `components/admin/kit/useAdminKitNav.ts:59`;
  the rail `components/admin/kit/AdminKitRail.tsx:142-149` (Overview, Calendar); the phone's More sheet
  `components/admin/kit/AdminKitBottomNav.tsx:137-139`, `:233-240` (Calendar first). **Schedules goes directly under
  Calendar in both.**
- **The club calendar:** `app/[orgSlug]/admin/calendar/page.tsx` (header "NOTHING HERE WRITES" `:2-32`, export `:163-168`);
  `lib/club-calendar.ts` (`readClubCalendar` `:121`, `teamDoor` `:306-309`, the rep booking's door `:326`); door words
  `lib/club-calendar-view.ts:138-143`; the read window `components/admin/kit/club/ClubCalendarViews.tsx:230-252` (the door
  as `footerStart`).
- **The coach's sheet** `components/coaches/ScheduleEventSheet.tsx` (`sourceBlock` `:702-717`, "From **{name}** ·
  organizer’s schedule" `:706`, "Only {name} can cancel or remove this game." `:1092-1096`); the series pencil's three rows
  (memory `project_coach_series_edit_scope`) are Hand back's precedent.
- **The coach's Overview** `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` (the club card `:2029-2031`, the invitation
  banner `:1968-1979`, `CoachOneThingCard` `:2038`); the card to copy `components/coaches/CoachClubArrivalCard.tsx:20-49`
  (`CoachCard accent`, kicker, title, body, `useCoachNudgeDismiss`).
- **The coach's money:** Money › Club `app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx` (`ClubFilingControl`
  `:2095-2117`, the unfiled hint `:2118-2121`); Budget vs. Actual `…/budget-vs-actual/route.ts` (paid installments placed by
  the filing `:823-845`, scheduled `:1266-1285`); the Budget's own line editor (find where the coach's plan line for a word
  is edited; the callout's **Use** writes there, the coach's own press — D1).
- **The notices list** `app/(consumer)/account/notifications/AccountNotificationsClient.tsx` (`CLUB_MONEY_EVENTS` `:46`, "Your
  club" `:159-191`).
- **Exports:** `buildTablePDF` `lib/export/pdf.ts:341`, `downloadPDF` `:868`; **the schedule document**
  `lib/export/schedule-document.ts` (`buildScheduleDocument` `:92`; its header `:7-12` asks for its columns and per-row
  builder to become parameters — do that, never a fork); fixtures `scripts/pdf-documents.mjs` (`doc()` `:166-168`,
  `tournament-schedule` `:229-235`, `NO_PDF_SCREENS` `:1366`); `buildXLSXWorkbook` `lib/export/xlsx.ts:313` (with 10a's print
  setup and page footer); the masthead guard `tests/unit/export-masthead-guard.test.ts:30`; the catalog
  `lib/export/catalog.ts:147` (`club-calendar` `:759`, `coaches-schedule` `:625`) + `npm run check:export-catalog`; the
  calendar file `lib/export/ics.ts` (`composeICSFromInstants` `:73`, `downloadICSFromInstants` `:175`),
  `lib/export/schedule-calendar.ts:58`.
- **Screens guards to copy:** `tests/unit/club-stage6c-screens-guard.test.ts`, `club-stage6b-screens-guard.test.ts`.
- **Layout entries** `scripts/layout-screens.mjs`: `coach-team-hub` `:619`, `coach-schedule` `:672` (`-week` `:694`,
  `-month` `:695`, `-add` `:702`), `admin-calendar` `:1398`, `admin-rep-team-schedule` `:1432`,
  `admin-accounting-allocations` `:1460`, `admin-accounting-allocation` `:1464`.
- **Help:** `lib/help-content/org.tsx` `club-calendar` `:463`; `coaches.tsx` `recipe-build-coach-schedule` `:248`,
  `premium-money-org` `:2132`; `accounting.tsx` `allocations` `:275` (`allocations-create` `:285`), `reminders` `:423`;
  `rep-teams.tsx` `cost-allocations` `:408`.

## What to build

Every 11a drawing, each to its tag notes. Pointers to what the drawings carry:

- **Schedules** in the rail directly under Calendar and in the phone's More sheet (hidden where there is nothing to
  schedule); the list as a 1200 table with its band rows (*In use now* · *Coming up* · *Ended*) and one state chip only
  where it needs saying (**Draft**, the amber **Changed since sent**); **New schedule** the one lime.
- **New schedule**, step 1 (the generator's frame): *The time* (Start from a permit fills the venue, fields, dates, hours
  and dates off in one pick; last year's schedule a year on), *Who, and how much* (one card: the form table for time,
  groups and teams, the closing row, Prime time's two choices), *Rules* folded ("Rules · 4 on"); foot: what Generate hands
  out · Cancel · lime **Generate drafts**. **Step 2:** three ranked cards, **By team · By day**, **Export** (Excel, PDF)
  above it, the one statement, Back to settings · lime **Save as a draft**.
- **The schedule's page:** the one toolbar line (Grid · By team · By group · the week · Facility · Team · the amber clash
  pill · "Times in Eastern time." · Tools: **Settings…** first, Regenerate the unlocked slots…, Lock this week, Clear this
  week…, Send log · Export · the state's lime); the grid; the fairness panel (the joined band, then a row per team);
  adjusting (drag with the dashed preview, the which-weeks question, `NoticePill` Undo for 8 seconds, the slot's small
  window, a hand move locking itself, the regenerate question naming what stays); **By team** and **By group**;
  **The bill** in Fair shares opening **Bill the teams** (filled in from the schedule and its permit).
- **Send** (the reminders window's shape): what sending does in one statement, who is told per team, Nobody to send to
  with its reason, See {team}'s email, Last sent; **For review first** / **Final now**; the replies on the page;
  **Finalize and send** (asks once, naming what it writes and bills). **Changed since sent:** the white callout with the
  amber edge listing what moved, and **Send the changes**. **The send log** (Tools).
- **The coach:** the club slot on the team's Schedule in every view (the sheet's source words; *"Only the club can move or
  remove this practice."* at the body's end; **Hand back** after it with the series rows and what it does); the **review
  card** on the Overview (`CoachClubArrivalCard`'s pattern: their slots and their bill, Looks good / Ask for a change,
  gone once answered or final); the bill on Money › Club; **the Budget's one callout** where the coach's plan for that word
  differs: **Use {the club's figure}** / **Keep mine** — the coach's press writes the coach's own line (D1); the notices in
  "Your club".
- **The club calendar:** a club-slot booking reads as any other, plus one line ("From Winter dome 2026–27") and one door
  (**Open the schedule**, the read window's `footerStart`); a shared slot is one booking with its teams.
- **A phone:** the admin reads the list (one frame, hairlined rows), a schedule By team and its week as day frames, the
  send log, and **Send the changes** (a confirm); **New schedule and dragging are absent at phone width.** The coach's
  phone: the slot in the week, its sheet, Hand back at the end, 44 px.
- **Exports** (§6b, Ask 26; memory `feedback_exports_house_format`): the schedule's **PDF** by facility and week through
  `buildScheduleDocument` made parameterised (the club's band, crest top-left, a section per day ruled in the club's
  colour, the club-colour head row in sentence case, a faint alternate row, notes under the tables, the footer line), with
  a fixture in `scripts/pdf-documents.mjs`; the **workbooks** (a row per slot; By team; By field) through
  `buildXLSXWorkbook` with the masthead and the club's logo, the slate header frozen, number formats, notes, the
  FieldLogicHQ row, 10a's print setup and page footer, each on the masthead guard's list; the **Calendar** file once sent;
  the export catalog entries. A draft's export (step 2 and the page) carries the draft's name and says it is a draft.
- **Words:** every drawn sentence is a draft — `/marketing` words them (the statements, the emails, the review card,
  Hand back's line, Ask 16's source words) **before the walks**.

## Help, words, walks

- **`/docs`:** Schedules (the list, New schedule, the time from a permit, sharing by percentage, rules, drafts by day and
  their export, the grid and its moves, fairness, Bill the teams, Send for review, replies, Finalize, changes, the send
  log); the club calendar's club slots; the coach's club slot and Hand back, the review card, the bill's Budget callout;
  the allocations article's "By the time each team got". Keep "dome", "permit", "practice schedule", "time slots" and
  "allocation" as search terms.
- **`/demos`** at the next `/demos` session, not here: whether the coach demo shows a club slot (the demos follow the
  product).
- **Walks:** a new Owner QA ledger § (the number **at the moment you write it**; grep before and after appending),
  checkable walks on the hub's QA tab under the stage, one purpose each, with the sign-in card. **The definition of done
  is the dome, walked:**
  1. **Start from the permit:** New schedule from Winter dome 2026–27 — the fields, Sundays and Dec 27 come in one pick;
     90 minutes; Senior 1 full field, Junior 1 full + 1 half; Fields 5–6 only for Junior; "300 slots for 8 teams."
  2. **Drafts:** three ranked; By day reads every Sunday's twelve slots; Export the draft (Excel and PDF) before saving;
     Save as a draft.
  3. **The page:** the Sundays read across (Oct 4 – Nov 15 the first seven); fairness says 25 / 50; a drag asks which
     weeks; Undo takes it back; a hand move locks itself; Settings… and a regenerate keep it.
  4. **Bill the teams:** two presses; By the time each team got; every two months from Oct 1 — read back $2,700.00 /
     $4,050.00 and $972.00 / $864.00 / $864.00, $1,458.00 / $1,296.00 / $1,296.00; the closing row matches $27,000.00.
  5. **Send for review:** who is told, the sample email, the dome's office ticked; send.
  6. **The coach reviews** (15U AA): their Sundays and their bill on the Overview card; *Ask for a change* — 9:30.
  7. **The replies; the swap** with 12U AA on Field 2; **Finalize and send**.
  8. **The team's side** (15U AA and 12U AA): the slots on the Schedule with the club's words; the bill on Money › Club,
     its payments $972.00 / $864.00 / $864.00; Budget vs. Actual places it under Dome Time (per build question A); the
     callout's **Use $2,700.00**.
  9. **After it is sent:** move one slot → *Changed since sent* lists it; the team keeps the old time until **Send the
     changes**; only that team is told; the correction (per build question B).
  10. **Hand back** (a coach, this & future) → *Open · handed back by …* on the grid; the builders' notice.
  11. **The club calendar:** a Sunday's slots as bookings with the one line and the door; a shared slot is one booking.
  12. **The exports:** the schedule's PDF and workbook in the house format (logo, frozen header, notes, the FieldLogicHQ
      row; print preview).
  13. **Who:** a reader without the role sees no Schedules row; a coach sees only their team's slots; a League Plus club
      without rep teams sees no Schedules row.
  14. **A phone (390)** — the admin's reads and Send the changes; the coach's slot and Hand back.
  15. **Dark** — every new frame.

## Gates

- `npm run verify:changed`, `npm run typecheck` (after `npx next typegen`), the targeted unit files, `check:dictionary`,
  `check:spelling`, `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:old-look`,
  `check:export-catalog`, `check:pdf` (`--only=` the new fixture), the masthead guard.
- **A screens guard** for the stage (the 6c pattern: the drawn words, the doors, the doors absent at phone width, no
  "From the club" on a practice — P11-03, the Schedules row hidden where nothing can be scheduled).
- **`check:layout`, both themes,** on every new and touched screen (ask the owner first; `--only=` batches of about ten);
  new entries for Schedules, a schedule's page, its windows and the coach's review card; baseline entries with reasons.
- Then `/simplify`, `/review` at the **high-risk** tier, and a `/design` review of the built screens against the hub at
  1440 and 390.

## Hand-off

- An owner-voice summary; the walks to run; departures from the drawings; anything found and not fixed.
- The plan record (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md`: **"11a BUILT"** and §7), the PM brief, the parent plan's Stage 11
  pointer, memory `project_club_stage11_scheduler`, the TODO line, and the hub's QA tab republished at the same address
  (read it fresh first; the session's first publish needs the live copy READ in full — memory
  `reference_artifact_publish_needs_full_read`; parse every script before publishing).
- **Notes to others:** the tournament redesign (Ask 5's shared frame, if it wants it); Stage 7 (the one send window and
  log shape it reuses, Ask 9); Stage 9 (11b: house league's practices take `club_schedule_slot_id` and a creator, the
  scheduler's house-league writer, league admins in the send, the Schedules row on League Plus); 6d (if not yet built:
  club slots are ordinary practice rows carrying `club_schedule_slot_id`; a removed one is cancelled or deleted by the
  mirror's rule; a handed-back one is gone).
- **Commit only when the owner says**, from a private index with this session's files and hunks only. Export and
  typecheck the staged tree before committing; after it, `git reset -q -- <paths>` on the shared index.
