# The Schedule deep dive — the coach's schedule at both widths, re-evaluated

**Created:** 2026-09-25 · **Owner:** product owner · **Hub (walk · stage drawings · brief · plan · decisions · QA, one artifact for the project's life):** `docs/projects/active/COACH_SCHEDULE_DEEP_DIVE_HUB.html` — published as a Claude Artifact at `https://claude.ai/artifact/5yvmCESNKNWnpFiHg8b7Lc` (republish the same file path to stack a version).
**PM brief:** `COACH_SCHEDULE_DEEP_DIVE_PM_BRIEF.md` · **TODO:** one line under Active Tasks · **Ledger:** no § until a stage is built (a planning entry is not a §).

> **One stage at a time — the owner's pattern (2026-09-25).** *"You are supposed to do a walk through and build a plan with stages, in each stage you walk me through what you did and your proposed changes. I read those proposed changes, review with the product and provide feedback on what to change or add."* Each stage: drawn at true size on the hub with what was measured → the owner reads it against the product and sends feedback → redrawn until ruled → build → `/review` → QA walk on the hub → the next stage is drawn. No stage is drawn before the one before it is ruled.

## 0 · What this is, and how it was read

A deep dive on the coach's **Schedule at both widths** — the list, Week and Month, the event sheet on every kind of event, attendance, the doors out of an event, the add and edit forms, the Tournaments list and record, and the coach's own calendar — in the shape of the phone re-evaluation (`docs/projects/archive/COACH_MOBILE_EXPERIENCE_PLAN.md`): a measured walk, station by station, with shape questions (Keep · Reshape · Not yet); rules across the walk; a stage ladder; stage 1 drawn.

**Method (2026-09-25, `dev`).** A read-only Playwright probe (`.probe/sdd-walk.mjs` — it opens sheets and forms and closes them with Escape; it never taps an answer or saves) at **390×844** and **360×780** (touch, DPR 2), **768×1024** (touch) and **1440×900**. Every number is read from the browser's own geometry, never a screenshot. Specimens:

- **UAT Test Team** (`uat-coach@uat-test-org.local`): 24 events; the day's **UAT probe game** (started 3:07 p.m., 10 in · Kai late · Logan out, has a lineup); **UAT probe game · no lineup** (Sun Sep 27, 1:00 p.m., nobody has answered); **vs Ridgeview** (May 4, scored, carries a lineup-vs-attendance warning); **UAT probe practice** (finished, 9 in · Jules late · Kai out · Logan no reply); **Practice review — next week** (Mon Sep 28, a one-block plan).
- **A real season:** the coach demo's **Riverdale Ridge 12U** — 39 events, Jul 18 → Sep 26 — read through the no-login demo door (the account cannot write).
- **A tournament:** **UAT Rep Club 15U AAA** in **UAT Rep Club Invitational 2026** (Oct 5–7), signed in as the club coach — the only tournament entry on dev.
- **Not on any fixture, read from the code:** the multi-day tournament event, a team event, a tryout session, an organizer-mirrored game (dev has none on any team). Nothing was seeded.

**Step 0 is not a gate.** The kickoff prompt made a QA walk of five built-unwalked changes (§212 · §214 · §219 · §222 · §236) the first gate. The owner corrected the pattern the same day. That walk is published (https://claude.ai/artifact/TuKePWta8N51U41BaY78SR) and is owed on its own clock; its findings fold into the stages they touch.

## 1 · Findings, by station (the hub's walk tab is the record)

| Station | Measured | Finding |
|---|---|---|
| 1 The list at open | Phone: today's row at **142px**, 6 rows on screen (C1, walked §216). Desktop 1440: opens on **Apr 2**; today's row the 15th at **852px**. A real season (demo 12U): the next event at **1,916px**, 38 finished rows above it. Tablet 768: opens on Apr 2, today at 923px. | **F01** — the desktop is the last list in the portal that opens on the past. |
| 2 Week and Month (desk) | Week: seven columns, empty days as "—" (fine at 1440). Month: 165px cells; chips cut to "UAT probe prac", no time. | **F09** — Month at a desk cannot say what or when. The 641–768 band's Month chips (16px) are still owed from §216 C4. |
| 3 The event sheet, by kind | Phone first player: **414** (game before first pitch, 8 of 12 on screen one) · **524** (started, 6) · **696** (scored, 3) · **445** (practice ahead, 8) · **591** (finished practice, 5). Desktop dialog 720px, one order for everything: first player **500**, 7 on screen. | **F02** — the job sinks as the day goes on. **F03** — a practice is one inline list, a game is three tabs: two shapes (the owner's triggering complaint). **F04** — "Attendance" is the tab and the heading under it. **F08** — the desktop still shows "Enter a final score to unlock awards" on a game two days away. |
| 4 Attendance | From the list: row → player → choice = **3 taps** (the sheet opens on Attendance). The Overview carries **four** links into it ("10 of 12 in", "1 late", "1 out", the tile) + Insights' "Take attendance". RSVP sheet 391px, four 52px choices. On the started game, the one player who is **Out is the 12th row, ~1,060px down**. | **F05** — "who isn't coming" is at the bottom of the list. **F06** — the lineup warning's "edit the lineup →" is **97×15px** (the only control under the floor on the phone sheet) and says "fix the attendance below". |
| 5 The doors out | Lineup tab: a look-only peek + a door — phone "Edit ›" before first pitch, **"Game day ›"** after; desktop **"Edit in Lineups →" always**. Scouting: the book panel inside the sheet. Practice: "Open the plan →". | **F07** — the desktop's lineup door never turns by the clock. |
| 6 Adding and editing | Edit details **asks** (Save changes at the foot); at 390 the form is **1,286px** in 842, 13 fields. A saved change to **when or where sends families a "schedule changed" notice** (the event PATCH's `schedule_change`). | Edit details should keep its Save (see S5). **F12** — "Arrive 5:30 p.m." on a 3:07 p.m. game, nothing flags it. **F13** — a practice's More label promises an address it no longer holds; a weekly series asks each date's opponent in a plain box (no Scouting Book). |
| 7 Tournaments | List at 390: the card **runs off the right edge**; the fan-view line 23px. Record at 390: **2,139px**, **11 of 17 controls under 44**, **no help "?"**, titled by the **team** ("UAT Rep Club 15U AAA") with "Invitational 2026 **(2026)**" under it, "Accepted" twice, a tinted hero, an inline head-coach form with its own Save, **no road to the games on the Schedule**. 1440: 1,955px. | **F10** — the page a tournament weekend starts from was never given a phone pass, and it is shared with the free portal. |
| 8 The coach's calendar | One-time `.ics` download (phone: the quiet "Export the season" row; desk: Export → Excel · CSV · Calendar). Every kind; arrival + uniform in the description. | **F11** — two DEFECTS, verified by running the code: an event at **8 p.m. or later (summer; 7 p.m. in winter) lands on the next day** (the date is read in universal time, the clock in the device's) — 8 of 238 events on dev; a **cancelled event exports as confirmed**. No subscription exists; the team feed issuer has had no caller since 2026-09-12. |
| 9 The page | `schedule/page.tsx`: **4,211 lines, 60 state variables**; the sheet rendered in three JSX orders. | **F14** — any stage-1 build rewrites the sheet inside the largest route in the portal. |

## 2 · The rules across the walk (Standing back, R1–R6)

- **R1 · One shape for every event.** The sheet is the event's summary; its jobs are doors. The owner's complaint was a practice/game *difference*; the fix is the same shape on both, not moving attendance on one.
- **R2 · A door names what is behind it.** A bare "Attendance ›" is worse than the inline list it replaces. "Out: Logan · Late: Kai" is better than both.
- **R3 · Today first, at every width.** The phone opens on today; the desktop is the last exception (C1 left it as an explicit re-ask).
- **R4 · A record is titled by what it records.** A tournament's page names the tournament.
- **R5 · A calendar entry is the event's own time.** Every screen reads the org's zone (Chunk C0); the export must too.
- **R6 · Edit autosaves — except where a save is a message.** A saved change to when/where notifies families and a series edit asks "this one or all following"; both need one deliberate commit.

## 3 · The stage ladder

| Stage | Covers | Asks | State |
|---|---|---|---|
| 0 The five built changes | The QA walk of §212 · §214 · §219 · §222 · §236 — published separately | — | **published 2026-09-25** (TuKePWta8N51U41BaY78SR); walked on its own clock, not a gate |
| 1 The event sheet | One shape on every event: a summary + door rows that name their state; **attendance in its own full-screen room**; Lineup and Scouting as rows (the tabs go); the lineup warning joins the rows; the deep links open the room; the desktop dialog takes the same rows; **the page split lands first** | E1–E6 (S1, S6) | drawn 2026-09-25 · **ruled 2026-09-25 — E1–E6 as drawn, S6 split first** · **built on dev 2026-09-25 in three parts (§4.12)** · ledger §242 walk owed |
| 2 The desktop schedule | The list opens on today; Month says what and when; the toolbar's two rows; the 641–768 band's Month (owed from §216 C4) | S2 | walk read; drawn after stage 1 is ruled |
| 3 Tournaments | The list and the record at 390 and 1440; one help door; titled by the tournament; the road from a tournament to its games and back; the off-grid breakpoints (600/901); **both portals move** | S3 | walk read |
| 4 The coach's calendar | The two export defects (**ruled 2026-09-25: fix now**, built with stage 1 as its part 0 — §6); a subscribable feed row beside the download; what it carries | S4 | walk read |
| 5 The forms | Edit details keeps its Save (R6); the practice's More label; the series' opponent boxes take the picker; arrival after the start says so | S5 | walk read |

## 4 · Stage 1 — the event sheet (drawn 2026-09-25)

### 4.0 Rulings (owner paste-back, 2026-09-25)

**E1 · E2 · E3 · E4 · E5 · E6 as drawn** (E2 = the full-screen room; E3 = rows, the peek retires) · **S6 = split first, a pure move** · **D1 = fix the calendar defects now.** The walk's station questions came back unticked; the ones stage 1 answers (Q 3.1, Q 4.1, Q 5.1, Q 9.1, Q 8.1) are ruled through E1–E6 / S6 / D1. **Q 1.1, Q 2.1, Q 6.1, Q 6.2, Q 7.1 and Q 8.2 are NOT ruled** — they are re-asked when stages 2–5 are drawn. Build prompt: `docs/projects/active/COACH_SCHEDULE_DEEP_DIVE_STAGE1_BUILD_PROMPT.md`.

### 4.1 E1 — one shape: the event's summary on top, its jobs as door rows

On every event, at every width: header · title · when · the place row · the kind's own block (a practice's plan row; from first pitch, a game's score and awards as ruled in C3 and on 2026-09-25) · **door rows** · the quiet "+ Add final score" (a game before first pitch, as ruled) · the foot row (Edit details · Cancel event · Delete, unchanged). A door row is the portal's row recipe at 64px: an icon, a label, **a second line that says where the job stands**, a chevron; the whole row is the tap.

Measured today → drawn: on a phone, a game before first pitch puts its first player at 414px with 8 of 12 on screen; drawn, **the whole sheet is one screen** — the three rows sit at ~250–440px and nothing scrolls. A scored game: 696px / 3 players today; drawn, the rows sit under the score and awards, on screen one.

### 4.2 E2 — attendance in its own room

The Attendance row opens a **full-screen room** (it covers the nav — a working surface, the §13 drawer rule's "form" layer): ← back to the event · "Attendance" · the event's name and date · the five filter chips (44px) · All in · Reset · one 48px row per player, the row is the tap · the RSVP sheet rises over it (the second visible layer, unchanged) · the transient Saved pill. The heading-under-the-tab duplication (F04) goes with the tab.

Drawn at 390×844: rows start at ~160px, **all 12 players on screen one** (a 15-player roster: 14 of 15); at 360×780, 12 of 12. Measured at build.

The row's second line **names names**: "Out: Logan · Late: Kai"; before anyone answers, "12 haven't replied — Avery, Blake, Casey and 9 more"; once everyone has, "All 12 in". Considered and not drawn: an "All in" button on the row itself (a bulk write from a summary a thumb scrolls past).

### 4.3 E3 — on a game, Lineup and Scouting are rows too; the tabs go

- **Lineup** — "Has a lineup · Ready" / "No lineup yet"; before first pitch it opens the builder, from first pitch **Game day** (the clock rule, now at **both** widths — fixes F07). The look-only peek (the inning flip) retires: since stage 3 · D5 the builder's first screen *is* the order, one inning at a time.
- **Scouting** — "2-1 vs them · 3 notes" / "First meeting"; opens the scouting panel as a room.
- A mirrored game keeps the same rows; a TBD opponent has no Scouting row (today's rule).

### 4.4 E4 — the lineup warning joins the rows

When attendance and the lineup disagree, the **Lineup row's second line** says so in the warning tone — on the fixture's vs Ridgeview (May 4), "Kai and Logan are in, but not in the lineup" — and the row opens the builder, where the fix is. The separate warning box, its 97×15px link and the words "fix the attendance below" retire (F06).

### 4.5 E5 — the deep links open the room; Back goes up one level

`?event=…&tab=attendance` (the Overview's four links, Insights' "Take attendance", the next-step card) opens the event's sheet **with the room open on top**: link → player → choice stays **3 taps**. Back from the room → the event (§219, one level); Back again → where the coach came from. `tab=lineup` (the builder's return address, §222) opens the sheet — the Lineup row is on screen one. `tab=scouting` opens the Scouting room. The address grammar is unchanged; §222's machinery carries it.

### 4.6 E6 — the desktop dialog takes the same rows

The 720px dialog draws the same summary and the same three rows; a row opens its room **inside the dialog**, with "← back to the event" at its head. The desktop's pre-game "Enter a final score to unlock awards" goes (F08 — the phone's C3 rule). This answers S2's "are the doors the same rows at 1440?" — yes; the rest of S2 is stage 2.

### 4.7 The tap cost, stated

| Path | Today | Drawn |
|---|---|---|
| From the list, set one player | row → player → choice = **3** | row → Attendance → player → choice = **4** |
| From the list, everyone's in | row → All in = **2** | row → Attendance → All in = **3** |
| From the Overview / Insights / next step | link → player → choice = **3** | **3** (the link opens the room) |
| Read who isn't coming | open → scroll to the 12th row | open → read the row (**1**, no scroll) |

**The door costs one tap on the most frequent field action, from the list.** It buys: one shape on every event; who is missing named without opening anything; the whole roster on one screen in the room; the desktop and the phone reading alike. If the owner mostly marks attendance from the list at the field, that tap is paid every time — the tradeoff is real and the drawing states it.

### 4.8 Every kind under the one shape

| Kind | Its own block | Door rows |
|---|---|---|
| Game (a scrimmage is a flag) | from first pitch: score, awards | Attendance · Lineup · Scouting |
| Tournament game you entered | as a game; "Part of …" | Attendance · Lineup · Scouting |
| Organizer's game (mirrored, gold) | "From the organizer"; no Cancel/Delete | Attendance · Lineup · Scouting |
| Tournament (multi-day) | its days and games; "+ Add game" | Attendance |
| Practice | the plan row ("1 block · 20 min"), Run practice | Attendance |
| Team event | — | Attendance |
| Tryout session (projected) | read-only; opens Tryouts | — |

### 4.9 S6 — the page split lands first

Before any behaviour changes, the first commit of stage 1 moves the event sheet (and the new room) out of `schedule/page.tsx` into their own files, then the add/edit form, then the calendar views — **a pure move, walked as "nothing changed"**. Proposed seams: `ScheduleEventSheet` (the sheet + its blocks + the three orders it has today) · `ScheduleAttendanceRoom` (new) · `ScheduleEventForm` (the QuestionShell form) · `ScheduleListView` / `ScheduleWeekView` / `ScheduleMonthView`. The page keeps the data (events, the book, capabilities) and passes it down. Not a separate project; budgeted inside stage 1.

### 4.10 Verification at build

Measured before → after at 390×844, 360×780, 768×1024, 1440×900 on every fixture event (the probe above, re-run): the rows' positions, "the sheet is one screen", the room's players on screen one, controls under 44 (0 on touch). `check:layout --only=` the six schedule screens (never a full sweep) — the attendance and RSVP screens' baseline keys change with the room. Unit: the deep-link grammar, the row's names-line, the Lineup row's clock door at both widths. The §222/§219 Back paths re-driven in a real browser. `coach-history-endpoint-guard` untouched (no year).

### 4.11 Not reopened

C1–C4 (§216) stand; C3's "tabs before first pitch / score from first pitch" becomes "rows before / score from", the same clock. The four bottom tabs (Q 0.2). The RSVP sheet as built. Family RSVP is out (no family identity). The console's inside (§224), the builder's inside, the practice plan's inside, the closed-season page.

### 4.12 Build record (2026-09-25, on dev)

Built on dev 2026-09-25 from `COACH_SCHEDULE_DEEP_DIVE_STAGE1_BUILD_PROMPT.md` in three parts, each verified before the next; committed as three on the owner's say-so, 2026-09-25: part 0 `1265bbca` (the calendar fix) · part 1 `13929db2` (the split) · part 2 the sheet, with its review and docs — the commit carrying this record (the hub names its hash). No migration, no new route, no year parameter. Ledger **§242** (walk owed); QA walk on the hub's "QA walks" tab.

**Part 0 · the calendar defects (D-1, D-2).** The coach Schedule's `.ics` and the house-league admin's are built from the INSTANT (`lib/export/schedule-calendar.ts` → `composeICSFromInstants`, through the new browser wrapper `downloadICSFromInstants` beside `downloadICS`, one blob path for both) and carry `STATUS:CANCELLED`. Widened on the evidence, said before the build: **the Excel/CSV Date column had the same universal-date defect on both screens** (coach: UTC date + the device's clock; house league: UTC date + the org's clock) — fixed with it. And the coach entry's title now uses the list's own `opponentSuffix` rule: it read "vs Ridgeview vs Ridgeview" and "@ Fairhaven vs Fairhaven". The house-league entry now carries its real end time where the game has one. `tests/unit/schedule-calendar-export.test.ts` (12) — run under `TZ=America/Toronto` and `America/Vancouver`; the composed file is byte-identical across Toronto, Vancouver and Tokyo (DTSTAMP aside). **Checked and left alone, as correct:** the tournament record's export (`CoachTournamentRecord`) and the free team calendar (`lib/team-calendar.ts`) — both read a stored LOCAL `game_date` / `game_time`, which is what `downloadICS` is for (its header now says which input shape belongs to which caller).

**Part 1 · the split (S6), a pure move.** `schedule/page.tsx` 4,211 → 1,116 lines: `ScheduleCalendarViews.tsx` (list / week / month and the three row kinds, stateless), `ScheduleEventSheet.tsx` (the sheet, with the state that exists only while an event is open — attendance and its autosave, the score being typed, the delete question, the award dialog, the RSVP sheet — keyed on the event so it opens fresh, the reset `openEvent` used to do field by field), `ScheduleEventForm.tsx` (the QuestionShell form, its own typing, Save and discard question; seeded by `seedAddForm` / `seedEditForm`), `lib/coach-schedule-view.ts` (the shared date / span / result reads). Two dead render-time maps (`eventsByMonth`, `eventsByWeek`) were not carried. **Proof:** the walk probe re-run before and after at 390 · 360 · 768 · 1440 — **every measured number identical** (one desk list read came back empty on the first run, a timing miss; the desk re-run matched all 10 desk measurements). Typecheck clean; unit suite 4,870/4,870; `check:layout --only=` the six schedule screens "✓ No new layout findings". The 13 path-reading guards were re-pointed at the files their code moved to, no assertion loosened (`coach-read-gates-guard` gained one: the sheet never derives a second doors answer beside the page's).

**Part 2 · E1–E6.** One JSX order per clock at every width (`data-sheet-order` = `score-first` | `rows-first`; the desk's third order is gone). Door rows (`CoachRowList phoneFrame` + `CoachRow`, `.sheetDoorRows`: 64px, a 22px mark, the name over its second line at every width — the recipe's phone card would have wrapped the line under the icon, so `.sheetDoorRows` keeps the drawn anatomy at ≤640). The words and the Lineup door's clock are pure in `lib/coach-schedule-sheet.ts` (18 unit tests); the markup is pinned in `tests/unit/coach-schedule-sheet-guard.test.ts` (23). The room is `ScheduleAttendanceRoom.tsx` — presentational, everything moved from the tab; the state stays the sheet's. The peek, the tabs, the warning box and their CSS are deleted (`check:css-selectors` clean); the field floor moved from `.attendanceSection` to `.attendanceRoom`.

**Decided at build, said before the code (the four findings), and one found driving it:**
1. **The Lineup door rule** (E3 vs E4 on the drawn fixture): before first pitch the builder; from first pitch Game day; no lineup → the builder at any hour (nothing to run — the peek did the same); **a disagreement on a game whose live window has closed → the builder**, because Game day outside its window is a read-only recap and E4 says "opens the builder, where the fix is" — the drawn case, vs Ridgeview on 4 May, is exactly that game. Inside the window the console is where the fix is. `lineupDoor`, pinned.
2. **A tournament's "its games"** (§4.8) read as today's block — the date range and "+ Add game". The sheet has never listed a tournament's games; a list is new, undrawn work, not built.
3. **"Has a lineup", never "Ready"** — the sheet runs no readiness analysis (the peek declined the same claim).
4. **Names:** the Out / Late / No reply line uses "#12 Logan"; the nobody-replied sentence and the lineup warning use first names — both as drawn. **The length rule: three names at most, one budget across Out → Late → No reply; a group cut short reads "and N more" (more of THAT answer), and a group the budget never reached is counted in its own words ("2 no reply")** (`ROW_NAME_CAP`), with a two-line clamp as the belt. ⚠ Built first as "the rest folded into the last named group" — `/review` caught that it read 3 Out + 2 Late as five out; corrected before commit.
5. **Found driving E5 in a browser:** under React's strict mode (on in dev by default) a link that opens the sheet AND the room mounts two history steps in one commit; the double mount left a dead entry, so Back from the event stayed on `?event=…` and a third Back was needed. The room's step is now armed one commit after the sheet's — the shape a tapped-open room always had. Pinned in `back-step-verdict.test.ts`.

**Measured after** (`.probe/sdd-s1-after.mjs`, JSON `.probe/sdd-s1-after-geo.json` / `-flows.json`):
- **Every fixture event's sheet is one screen** at 390×844 and 360×780 (before: 1,092–1,392px of scroll); **0 controls under 44** at 390 · 360 · 768; no tab role anywhere.
- **The room: 12 of 12 players on screen one at 390×844 and 360×780** (first player 185, last bottom 772); the 13-name fixture (vs Ridgeview, with a call-up) 13/13 at 390, 12/13 at 360.
- Rows on screen one on the scored game (413–607 at 390). A row is 64–65px, 74–75 when its second line wraps; the mixed-answer practice's Attendance row is 96px (its head "9 in · 1 late · 1 out · 1 no reply" wraps, and so does its line) — still on screen one, sheet still one screen.
- The desk: no "unlock awards" line on a game ahead (F08); a started, unscored game still reads it (drawn in E2's frame).
- **Back / Escape, driven at 390:** from the list — row → Attendance → player → Escape ×3 closes the RSVP sheet, then the room, then the event (the URL follows: `&tab=attendance` → `?event=` → plain); Back ×2 the same. **From the Overview's "10 of 12 in · 1 late · 1 out"**: the room (12 on screen one) → Back → the game → Back → the schedule → Back → the Overview. ⚠ The drawing's flow says "Back → the game → Back → Overview"; the schedule step between is §222's standing rule for EVERY link into the schedule (the deep link hands its query to the sheet and leaves the plain schedule behind) — Game day's link does the same today; not changed here. §222's doors: the builder, Game day and the practice plan each Back to the open event; the builder's own arrow (`tab=lineup`) opens the event; `tab=scouting` opens the book and Back returns to the event. Tap cost as §4.7: from the list row → Attendance → player → answer = 4; from the Overview link → player → answer = 3.
- `check:layout --only=` the six schedule screens: "✓ No new layout findings" (the attendance and RSVP screens held no baseline entry before and hold none now). `verify:changed` green (4,910 tests).

**/simplify → /review → /docs (2026-09-25, before commit).** /simplify: the views' head is the portal's one modal head — `CoachModalHeader` gained `backLabel` (a back that names where it goes: the arrow at every width, the event's name beside it above 640, on the subtitle below) instead of a fifth hand-built head; the page's view state became one `sheetView`, `bookEntry` / `gameDayLive` / `onEdit(event)` replaced three props. /review, four lenses (logic · timing & state · the split's regressions · the export's data contract), each finding verified before it was acted on:
- **Fixed — the Attendance line misattributed its overflow.** Every name past `ROW_NAME_CAP` folded into the LAST named group, so 3 Out + 2 Late read "Out: … and 2 more" (five out beside a head saying three), and the pinned mixed case read one Late + two No reply as "three more" Late. Now "and N more" is only ever more of that answer and a group the budget never reached is counted in its own words and tone ("2 late"); decision 4 above and `coach-schedule-sheet.test.ts` carry the rule.
- **Fixed — the × on a view closed two history steps in one commit** (confirmed by `.probe/sdd-s1-xclose.mjs` at 768 and 1440 — a phone draws no × on a view): the outer step's exit found the inner entry on top of its own, stripped nothing and consumed nothing, so the browser came to rest on the game's entry, still addressed, and a reload reopened the game just closed. Fixed at the mechanism, not the sheet: `useBackStep` BURIES a step whose exit finds a same-batch closing step standing over its entry, and `onPop` consumes a buried entry address-first when the browser lands on it (header note beside "two steps must not mount in one commit"; pinned in `back-step-verdict.test.ts`). Re-probed: the × lands on the plain schedule and a reload stays there; the Overview → room ladder is unchanged.
- **Fixed — a failed read read as "No lineup yet"** on the Lineup row; it now shows the error, like the Attendance row.
- **Fixed — a comment** in `schedule-calendar.ts` (and the test's header) said neither export passed `cancelled`; the house-league export always did — D-2 was the coach export's.
- **Verified, kept:** a saved order holding the whole roster with no positions yet (the builder seeds from the roster) reads **Needs a look** when a player in it is Out — the schedule list's ⚠ (`getRepTeamLineupAttendanceMismatchEventIds`) and the builder's own check use the same rule, so the row agrees with both rather than claiming "No lineup yet" beside a ⚠.
- **Pre-existing, recorded, not this stage's:** Edit details / Delete do not flush a pending attendance edit (<0.7s); `onEventChanged` re-runs the attendance fetch and resets its dirty flag; a one-day tournament (end = start) exports as the 2-hour default where it was a 30-minute block (both wrong — an all-day VEVENT is stage 4's); an empty calendar carries no `X-WR-CALNAME`.
/docs (`lib/help-content/coaches.tsx` — this stage's passages only, replayable as `.probe/sdd-s1-commit/help.cjs` since another session holds edits in the same file): the sidebar article, "Where do I build game lineups?", "Taking attendance" (and its summary, which also claimed an Out player drops out of the lineup — the article's own FAQ says the two are kept apart), its filter / note / lineup FAQs, the Scouting Book's "Scouting tab" mentions, and a new FAQ `faq-premium-event-rows` — *Where did the Attendance, Lineup and Scouting tabs go?*; `exports.tsx`: a cancelled game goes in cancelled. No anchor renamed. Gate after the fixes: typecheck clean · `verify:changed` green (4,913) · `check:layout --only=` the six schedule screens, no new findings · the room 12 of 12 at 390 · 360 · 768 · 1440.

**Owed:** the §242 walk (with the hub's G4, added by /review).

## 5 · Stages 2–5 (read on the walk; drawn in turn)

- **Stage 2 · the desktop schedule** — open on today with the season above (F01); Month chips with the time and the name on two lines, or dots + the day's rows as on the phone (F09); the toolbar's two rows (Add Event + Import, then Export beside List/Week/Month) as one; the 641–768 band's Month.
- **Stage 3 · Tournaments** — the card inside the screen; the record titled by the tournament with the team as its meta; one help door; the head-coach editor to autosave or to Settings; a "Games on your Schedule" row that opens the schedule on the tournament's days, and a "← Tournament" back; the 600/901 breakpoints onto 640/768/900. **The record is shared with the free portal through flag props — every change lands on both.**
- **Stage 4 · the coach's calendar** — a "Subscribe on this phone" row beside the download; carries every kind including organizer games and cancelled events marked cancelled; tryout sessions only when the coach runs them. ⚠ A coach-scoped feed token is new storage — **a migration may appear here**; decided when drawn.
- **Stage 5 · the forms** — Edit details keeps its Save (R6); "More — field, links, notes" on a practice; the series' per-date opponent boxes take the picker; an arrival after the start says so under the field and on the sheet.

## 6 · Defects found on the walk — not design questions

| # | Defect | Evidence | Recommendation |
|---|---|---|---|
| D-1 | The calendar export puts an event at 8 p.m. or later (EDT; 7 p.m. EST) on the **next day** | run in `America/Toronto`: 2026-09-22T02:45Z (Sep 21, 10:45 p.m.) exports as Sep 22, 10:45 p.m.; 8 of 238 dev events | **ruled 2026-09-25: fix now** — build the entry from the instant (the family feed's `composeICSFromInstants` already does). ⚠ **Widened:** the house-league admin schedule export has the same defect (`scheduledAt.slice(0, 10)` + a zoned clock); the tournament record's and the free team calendar's exports read local date/time fields and are correct. **Fixed on dev 2026-09-25 (stage 1 part 0, §4.12) — and widened again at build: both screens' Excel/CSV Date column carried the same universal date** |
| D-2 | A cancelled event exports as **confirmed** (the coach export; the house-league one always passed it) | the export never passes `cancelled` | fix with D-1 — **fixed on dev 2026-09-25 (part 0)** |
| D-3 | The Tournaments card runs off a 390 screen | capture `tourn-club-list-390` | stage 3 (or now, if the owner wants it before a tournament weekend) |
| D-4 | The lineup warning's link is 97×15px | probe | stage 1 (E4 removes it) — **gone on dev 2026-09-25** |
| D-5 | The desktop shows "Enter a final score to unlock awards" before a game | capture `sheet-1440-gFuture` | stage 1 (E6) — **gone on dev 2026-09-25** |
| D-6 | An arrival after the start is not flagged | the started probe game reads "Arrive 5:30 p.m." at 3:07 p.m. | stage 5 |

## 7 · Out of scope

The game console's inside (§224), the lineup builder's inside (stage 3 · D12/D13), Money, the practice plan's inside, the closed-season page, a family-facing schedule, family RSVP.

## 8 · Migrations, APIs, years

Stages 1–3 and 5: **none expected** — the sheet, room and forms re-arrange what exists; the deep-link grammar is unchanged. Stage 4 may need a coach-scoped calendar token (decided when drawn). The schedule is a live-season surface: **no year parameter**; `HISTORY_ENDPOINTS` in `tests/unit/coach-history-endpoint-guard.test.ts` is untouched by every stage.
