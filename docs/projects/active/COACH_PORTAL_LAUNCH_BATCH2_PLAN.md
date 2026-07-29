# Coach Portal Launch Batch 2 — The "First Week" Bundle — Implementation Plan

> **Status:** ✅ **BUILT ON DEV 2026-07-28 (uncommitted).** Mockups approved + D1–D5 ratified at the recommendations; all three phases built in one pass. `npm run typecheck` 0 errors · `npm test` **411/411** (391 + 20 new) · focused lint on every changed file **0 errors** · all six colour-token baselines still **ZERO**. **Remaining:** coordinated dev-server restart (a concurrent session owns port 3000) → owner phone QA → `/simplify` → `/review` → commit with per-action OK. NOT on prod.
>
> **Build deviations & notes (2026-07-28) — read before reviewing against the mockups:**
> - **Two doors, not one, on Roster.** The header's primary stays **Add Player** (one at a time is the common case once a roster exists); the bulk sheet is reached from the empty state's **Paste your roster** primary and from an **"Adding several? Paste a list →"** link inside the Add Player sheet. The mockups showed the bulk sheet but not which button opens it; adding a fourth header button would have crowded the mobile header (Attendance + Export + Add already sit there).
> - **Paste is a two-step flow** (textarea → **Preview N players** → editable preview table, with **Edit the list** to go back), not a live-parsing textarea sitting above the preview. Frame 1 showed a disabled "Add players" and frame 2 showed the preview with no textarea — consistent with either, but live-parsing would silently discard a coach's preview fix-ups the moment they touched the source text. The footer's input-step label is therefore "Preview N players", not "Add players".
> - **Add Payable got TWO disclosures, not one** — "Split into a deposit and a balance" (the 4 schedule fields) and "Add details (optional)" (method, payee, notes, tags). The mockup table said "Add details: everything else"; burying the due dates under a generic "details" line was worse than one extra group.
> - **Arrival/call time stayed in "When"** on the event form rather than moving into details — it is a time, and the When section is already compact. Everything else in the plan's fold list moved.
> - **`.setupSegments` CSS + the `optionalItems` local were DELETED**, not left dangling — the ring occupies that slot and carries the same states.
> - **The preview API returns plain draft rows** (no server-computed warnings). The sheet re-validates on every edit against the roster it already holds, and the commit route validates independently against the live roster; a third copy would be stale the moment a coach fixed a cell.
> - **`resolveCoachContext` was duplicated** into the three new routes, matching ~40 identical siblings. Extracting it is a codebase-wide job for `/simplify` — converting 3 of 43 would create two patterns, which is worse than the duplication.
> - **`npm run verify:changed` fails ONLY on schema parity, from the concurrent session's untracked migrations 204/205 (`game_change_notices`)** — present in the tree before this batch started. This batch has **no migrations**. Deliberately NOT re-baselined: that would silently accept another session's drift.
> **Created:** 2026-07-28
> **Branch:** dev
> **Source:** `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — P0 **#7** (no fast way to add a roster), **#8** (heavy-form overwhelm, a regression vs the free tier), **#6** (guided onboarding never mentions half the product), plus **Wow shortlist #1** (setup momentum ring, which is the natural home for the #6 fix).
> **Predecessor:** `COACH_PORTAL_LAUNCH_BATCH1_PLAN.md` (committed to dev `934e5275`) — its sheet contract, `CoachModalHeader`, `useOverlayOpen`, and one-column `formGrid` are **hard constraints** here, not suggestions.
> **Plan gating:** Premium Coaches Portal only (per-team paid plan / standalone Coaches Portal workspace). No billing-plan changes.
> **Migrations:** **NONE expected.** Every new read is a count over existing `rep_*` tables; every new write goes through the existing `createRepRosterPlayer`. If a schema change appears mid-build, the dictionary + `npm run refresh:snapshots` ride in the same unit of work.

---

## Goal

Make the premium portal's **first week** feel like a paid product: get a whole roster in from a paste or a spreadsheet instead of fifteen modal round trips; stop showing 11–13 fields at once on the forms a coach fills most; and turn the Overview's setup panel into a progress trail that both celebrates real milestones and names the five sections a coach currently never discovers.

---

## PM Brief

See `COACH_PORTAL_LAUNCH_BATCH2_PM_BRIEF.md`.

---

## Ground truth (verified by direct code read, 2026-07-28)

### Bulk roster add (#7)

- **Add Player today:** `app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx:581-693` — one modal, 11 fields, one player, closes on save. No "save & add another", no import, no paste. Duplicate jersey numbers are only flagged **after** save (list-level `dupNumbers`, line 424).
- **The write path already exists and is reusable:** `POST /api/coaches/[orgSlug]/teams/[teamId]/roster` → `createRepRosterPlayer` (`lib/db.ts:4818`). Guarded by `assignment.capabilities.rosterWrite` (head coach only) and org/team scoping via `resolveCoachContext`. **A bulk endpoint is a loop over the same helper — no new table, no new column.**
- **Import infrastructure is built, tested, and generic:** `lib/import/csv.ts` (`parseCSV`), `lib/import/xlsx.ts` (`parseXLSX`, ExcelJS), `lib/import/tabular.ts` (`matrixToParsedRows`, `normalizeHeader`, `getCell` alias matching), `lib/import/types.ts` (`ParsedImportFile`, `ImportPreview*`, `ImportParseError`). Covered by `tests/unit/import-parsers.test.ts`. The admin team/schedule importers (`lib/import/tournament-teams.ts`, `tournament-schedule.ts`) are the **preview → commit** reference pattern. **None of this is coach-portal-aware — it is pure and reusable as-is.**
- **Positions are sport-neutral already:** the Add Player dropdowns read `getSportPack(assignment.teamSport).fieldPositions` (roster/page.tsx:115) via `PositionSelect`. Any bulk path must not hard-code position vocabulary.
- **PII posture:** guardian name/email/phone + DOB are redacted server-side unless `capabilities.rosterPii` (`redactRoster`). Bulk add writes the same columns — it inherits the same gate, and the bulk endpoints additionally require `rosterWrite`.

### Progressive disclosure (#8)

- **The free tier's pattern to copy** — `components/coaches/RosterEditor.tsx:391-494`: essentials inline (`#`, first, last), then two collapsed panels behind `+ Add date of birth (optional)` / `+ Add parent contact / note (optional)` toggles; each open panel has a **title + a one-line "why"**; panels **auto-open when editing a player that already has that data** (lines 324-327). `ScheduleEditor.tsx:491` uses the identical `+ Add location / details (optional)` toggle. This is the exact shape to bring across.
- **Premium Add Player** — 11 fields in one flat `formGrid` (one column ≤640 after Batch 1).
- **Premium Add/Edit Event** — `schedule/page.tsx:2244-2634`. Already **sectioned** (`.formSection` + `.formSectionTitle`: Tournament / When / Where / Who / Tags / Links, then Name + Notes) — but **every section is always open**, so a coach adding a Tuesday practice scrolls past opponent, uniform, tags, and links. The fix here is disclosure, not re-sectioning.
- **Add Tournament Payable** — `accounting/expenses/page.tsx:649-~715`, 11 fields, no grouping. Named explicitly in review finding #8.
- **Assistant capability grid** — `components/coaches/CoachStaffPanel.tsx:217-258`: 3 segmented controls (money / documents / roster) + 7 checkboxes in one flat grid = **10 access decisions**, each firing `saveCaps` on click with **no confirmation** — including "Team money → View + edit", "Contacts & birthdates", and "Send announcements". Also carries a **native `window.confirm()`** for removing an assistant (line 117 — review finding f7-5) and is entirely inline-styled.
- **Shared CSS that already exists** (`coaches.module.css`): `.formSection` (1737), `.formSectionTitle` (1746), `.formSectionGrid` (1754), `.formGrid` (1686, one column ≤640), `.field`/`.label`/`.input`/`.select`/`.textarea` (1700-1732), `.formHint` (1892), `.formCheck` (1893), `.modalScrollBody` (1664). **No disclosure-toggle class exists yet** — that is the one new primitive.

### Onboarding coverage (#6) + momentum ring

- **The checklist** — `teams/[teamId]/page.tsx:459-536`, `SetupItem[]`: **6 steps** — `season` (core, always complete), `roster` (core), then optional `schedule`, `positions`, `lineups`, `budget`. Skip state persists per team in `localStorage` (`coach-setup-skipped:${teamId}`, lines 255-272). The status bar counts done-**or**-skipped (`isSatisfied`, 544). The money step is dropped for assistants without money access (538).
- **Section coverage today: 5 of 11.** The checklist + snapshot tiles touch Overview, Roster, Schedule, Lineups, Money (+ a Tournaments tile). **Chat, Staff, Documents, Announcements, Development are named nowhere on Overview.** Sidebar groups (`CoachesSidebar.tsx:23-51`): Overview · Roster · Lineups · Development · Tryouts* · Schedule · Insights · Tournaments* · Money · Chat · Announcements · Staff · Documents · Settings (*conditional).
- **The recede rule** — `showFullSetupPanel = !setupLoading && !requiredDone` (line 760): the panel is the top surface only while the **roster is empty**. The moment one player exists it collapses to a one-line strip and the phase anchor takes over. **A milestone trail placed inside today's panel would be visible only at 0-of-5** — the recede condition has to move for the ring to mean anything (see Phase 3.2).
- **The phase anchor** — `showAnchor = requiredDone` (761). The `preseason` variant (1001-1010) already renders "Your roster's ready → {next open setup step}", which is the same sentence the ring's "Next:" line will carry. They must not both render.
- **Milestone signals available today, and their honesty problems:**
  | Milestone | Signal today | Problem |
  |---|---|---|
  | Roster | `activeRosterCount` (roster fetch) | fine |
  | Schedule | `eventCount` (events fetch) | fine |
  | Lineup | `nextLineupReady` (next-game-scoped fetch, 286-301) | **false negative** — reads `null` when the next event is a practice, so a coach who *has* built lineups sees an unlit dot |
  | Announcement | *nothing fetched on Overview* | no signal |
  | Money | `budgetAmount != null` (program-year column) | ignores "dues set up but no budget" |
  | Staff / Documents | *nothing fetched* | no signal |
- **Tables backing the missing signals** (all exist): `rep_team_announcements` (`lib/rep-team-announcements.ts:215`), `rep_document_templates`, `rep_team_lineups`, `rep_player_dues_schedules`, `rep_team_coaches`, and `rep_program_years.budget_amount`. → one small server-side counts helper resolves every honesty problem in **one** round trip instead of four client fetches.

---

## Phases

### Phase 1 — Bulk roster add (P0 #7)

- [ ] **1.1 Parser lib — `lib/coach-roster-bulk.ts` (new, pure, unit-tested).**
  - `parseRosterPaste(text: string): DraftPlayer[]` — one player per line. Recognizes `12 Jordan Smith`, `Jordan Smith 12`, `Jordan Smith`, and tab/comma-separated `First, Last, #`. A standalone numeric token at the head or tail of a line is the jersey; the remaining first token is the first name and the rest is the last name. Blank lines skipped; a 200-row ceiling mirrors the import parsers' `maxRows` guard.
  - `rowsFromParsedImportFile(file: ParsedImportFile): DraftPlayer[]` — maps a `ParsedImportFile` (from the existing `parseCSV` / `parseXLSX`) through `getCell` alias sets: `first name|first|player first name`, `last name|last|surname|player last name`, `jersey|number|#|jersey number`, `position|primary position`, `date of birth|dob|birthdate`, `guardian first name|parent first name`, `guardian last name|parent last name`, `guardian email|parent email|email`, `guardian phone|parent phone|phone`, `notes|note`. **Position is carried as free text — no sport vocabulary is hard-coded** (Sport Pack rules are enforced at the picker, not the parser).
  - `validateDraftRoster(rows, existingPlayers): DraftPlayer[]` — per-row `errors` (missing first name) and `warnings` (jersey duplicated inside the paste **or** against the existing roster — this also closes review finding f1-7, "no live duplicate-jersey check"; name already on the roster).
  - Tests: `tests/unit/roster-bulk-parse.test.ts` (joins the existing `npm test` suite).
- [ ] **1.2 API — bulk endpoints under the existing roster route folder.**
  - `POST .../roster/bulk/preview` — accepts `multipart/form-data` with a `.csv`/`.xlsx` file; runs `parseCSV`/`parseXLSX` then `rowsFromParsedImportFile`; returns draft rows + warnings. **Paste never touches the network** (parsed client-side, instant preview as the coach types).
  - `POST .../roster/bulk` — accepts the confirmed `DraftPlayer[]`; loops `createRepRosterPlayer` in roster order; returns `{ created: RepRosterPlayer[], failed: { rowNumber, error }[] }` so a partial failure reports honestly instead of rolling the whole batch back silently.
  - Both reuse `resolveCoachContext` + `denyUnless(assignment.capabilities.rosterWrite, …)` verbatim from the existing route — same org/team/program-year scoping, same head-coach-only gate. Both wrapped in `withObservability`.
- [ ] **1.3 UI — "Add players" sheet (new, replaces the Add Player button's single destination).**
  - Roster header button becomes **Add players**; the sheet opens on a **Paste a list** tab with a **Upload a spreadsheet** tab beside it (mechanism per Decision **D1**).
  - Paste tab: a textarea with a worked-example placeholder, a live preview table below it, and a row count in the footer button (`Add 14 players`).
  - Spreadsheet tab: file picker (`.csv`, `.xlsx`), a **Download a template** link (generated client-side from the existing `generateCSV` in `lib/import/csv.ts` — no new asset to keep in sync), then the same preview table.
  - Preview table: editable `#` / First / Last per row, a remove-row control, inline warning chips (duplicate jersey, already on roster), blocking error chips (no first name) that disable only that row. Guardian/DOB/position columns appear **only when the uploaded file supplied them** — the paste flow deliberately captures names and numbers only.
  - Mobile (≤640): the sheet contract applies unchanged — `CoachModalHeader` (both back + close), actions in `.modalFooter`, `useOverlayOpen(open)`. Preview rows reflow to one line per player (`#` ~52px + first + last + remove) — **never a horizontally-scrolling table on a phone**.
- [ ] **1.4 "Save & add another" on the single-player sheet** (review P2, explicitly in scope): the Add Player sheet keeps its existing shape (as restyled by Phase 2) and gains a secondary footer action that saves, clears the form, keeps focus in First Name, and shows a running "3 added" count in the header. This is the one-at-a-time fallback the bulk flow does not replace.
- [ ] **1.5 Roster empty state** — the `HelpCallout` at `roster/page.tsx:517` is replaced by the shared `CoachEmptyState` (full-card variant: lime primary + ghost secondary only, rounded-square medallion) with **Paste your roster** as the primary and **Add one player** as the secondary, so the fast path is the discoverable one.

### Phase 2 — Progressive disclosure (P0 #8)

- [ ] **2.1 New shared primitive — `components/coaches/CoachFormDisclosure.tsx` + CSS in `coaches.module.css`.**
  Collapsed state renders the free tier's language exactly: `＋ Add parent contact (optional)`. Open state renders a `.formSection`-styled panel with a title, an optional one-line "why", and the fields. Props: `label`, `title`, `note`, `defaultOpen`, `children`. **`defaultOpen` is honoured on mount only** (same contract as `CollapsibleCard`) so a caller can auto-open a group that already has data without ever fighting the coach's manual toggle. Children stay mounted when collapsed — form state, validation, and dirty-tracking are unaffected, and `UnsavedChangesGuard` keeps working.
- [ ] **2.2 Add Player sheet** (`roster/page.tsx`) — field split per Decision **D2**. Recommended split:
  - **Always visible:** First Name*, Last Name, Jersey #, Primary Position.
  - **`＋ Add parent/guardian contact`** — guardian first/last, email, phone. Note line: *"Dues reminders and announcements are sent to this address."* Auto-opens when editing a player who already has contact on file.
  - **`＋ More details`** — Date of birth, Secondary position, Notes. Auto-opens when any is already set.
- [ ] **2.3 Add/Edit Event sheet** (`schedule/page.tsx:2244-2634`) — keep **Event type**, **When**, **Where (location only)**, and — for game types only — **Who (opponent + home/away)** always open. Fold **Arrival/call time, Address, Field/Diamond #, Uniform, Tags, Links, custom Name, Notes** into a single `＋ Add details (optional)` disclosure. Auto-opens on edit when any folded field has a value, so no saved data is ever hidden from the coach who entered it. The Tournament section keeps its current conditional behaviour untouched.
- [ ] **2.4 Add Tournament Payable** (`accounting/expenses/page.tsx:649+`) — same treatment: essentials (tournament, amount, due date) visible; the rest behind one `＋ Add details (optional)` disclosure.
- [ ] **2.5 Consistency audit of the remaining Batch-1-converted sheets** — Add Expense, New Payment Request, New Fundraiser, Fundraiser Settings, Budget line, dues `ScheduleForm`. **Rule: any sheet over 8 fields gets a disclosure; 8 or fewer is left alone.** Findings and the applied/skipped decision for each get recorded in this plan at build time — no silent partial coverage.
- [ ] **2.6 Assistant capability grid** (`CoachStaffPanel.tsx`) — three changes:
  1. **Group with disclosure:** "Everyday coaching" (schedule, attendance, lineups, roster view) visible; "Sensitive access" (team money, documents, contacts & birthdates, internal notes, send announcements, tryouts) behind a `＋ Sensitive access` disclosure showing a live summary of what is currently granted, so collapsing never hides a live grant.
  2. **Confirm on escalation** per Decision **D3** (recommended: keep autosave, confirm only when *granting* money view/edit, contacts & birthdates, or send-announcements — revoking is always instant and never confirmed).
  3. **Replace the native `window.confirm()`** for removing an assistant with the portal's `ConfirmProvider` (closes review finding f7-5, same file, same edit).
- [ ] **2.7 Design-decision log entry** — the disclosure primitive, the essentials-vs-collapsed rule, and the escalation-confirm rule are binding going forward → `memory/design_decisions.md`.

### Phase 3 — Onboarding coverage + momentum ring (P0 #6 + Wow #1)

- [ ] **3.1 Milestone signals — one honest source.**
  New `getCoachTeamMilestones(programYearId, teamId)` in `lib/db.ts` returning booleans + counts for: active roster, events, **any saved lineup** (`rep_team_lineups` — replaces the next-game-scoped false negative), **any sent announcement** (`rep_team_announcements`), **money started** (`rep_program_years.budget_amount` set **or** any `rep_player_dues_schedules` row), **any assistant** (`rep_team_coaches`), **any team document** (`rep_document_templates`). Served by `GET .../teams/[teamId]/milestones`, capability-aware (money/staff/documents signals suppressed for assistants who cannot see those areas, so a restricted assistant is never shown a step they cannot complete). One request replaces four client-side derivations on Overview.
- [ ] **3.2 One panel, two renderings — the ring is the checklist's five headline steps.**
  `SetupItem` gains `milestone?: boolean`. The five milestone steps render as the **momentum ring**; the remaining steps render as the existing checklist rows underneath. **One data model, no second source of truth, no duplicated step.**
  - **Ring (5):** Roster · Schedule · Lineup · Announcement · Money.
  - **Checklist rows (4):** Confirm season · Jerseys & positions · Invite assistant coaches *(new)* · Add team documents *(new)*.
  - Each ring dot has three states — **lit** (done, with its live count beneath: "12 players"), **skipped** (dim, the existing skip affordance still applies), **open** (outline). The first open step drives the panel's existing "Next: …" line + lime CTA, unchanged.
  - **Recede rule changes (the reason the ring is visible at all):** the panel stays expanded while any *milestone* step is open, and recedes to today's thin strip once all five are done-or-skipped and only config steps remain. Today's rule (recede as soon as one player exists) would show the ring only at 0-of-5.
  - **Anchor conflict:** while the panel is expanded the `preseason` anchor does not render (it says the same sentence). `in_season` / `game_day` / `result` anchors keep priority and sit **above** the panel — a game today always outranks onboarding.
  - Retirement per Decision **D4**.
- [ ] **3.3 "Also in your portal" discovery row** — under the checklist rows, a chip row naming the sections the checklist still cannot honestly own: **Chat**, **Development**, **Insights**, and **Tryouts** (when the conditional nav shows it), each with a one-line "what it's for" on hover/tap and a link. Capability-filtered. This takes named coverage from **5 of 11 sections to 11 of 11** and gives the review's #6 its complete answer. Chat's chip copy is honest about being tournament-scoped (review P1: "give Chat an honest empty state") rather than promising a populated room.
- [ ] **3.4 Checklist expansion** per Decision **D5** — Staff and Documents become skippable optional steps with real completion signals from 3.1; Chat / Development / Insights / Tryouts stay discovery-row mentions (no honest "done" state exists for a hub).

### Phase 4 — Verification + handoff

- [ ] `npm run typecheck` + `npm run verify:changed` (shared modules `lib/db.ts` + a new lib are touched → full typecheck is required, not just focused lint).
- [ ] `npm test` — the new `roster-bulk-parse` unit tests plus the existing 391.
- [x] **Playwright computed-style probes — RUN 2026-07-28 at 360×740, 25/25 PASS** (computed styles + bounding boxes, never screenshots). Recipe refined from Batch 1: the UAT coach (`uat-coach@uat-test-org.local`) **already has** `rep_teams` + `rep_program_years` + `rep_team_coaches` on the UAT org — the only missing piece is the `organization_members` row (`getAuthContext` needs it or the portal bounces to `/discover`). **⚠ Recipe correction for `/uat`: the column is `organization_id`, NOT `org_id`, and the row needs `status:'active'` + `accepted_at`.** The probe provisioned exactly that one row and deleted it scoped by a marker `display_name`; teardown verified 0 rows remain. Temp script deleted.
  - **Ring:** 5 steps in 5 grid columns (Roster/Schedule/Lineup/Families/Money), `docScrollW == vw == 360`, zero clipped labels. Discovery chips = Chat · Development · Insights (Tryouts correctly absent — no tryout signal on that team).
  - **Add Player sheet:** full-height (panel 740 = vh 740), footer bottom 739, nav `visibility:hidden`, body `overflow:hidden`, no sideways scroll. Opens with **4 visible field controls** (was 11) behind 2 disclosures; expanding takes it 4 → 7 with the footer still pinned at 739 and no sideways scroll.
  - **Bulk sheet:** full-height, footer pinned, nav hidden. Parsed all six seeded lines correctly — `12 Jordan Smith` → `["12","Jordan","Smith"]`, `Maria de la Cruz` → `["","Maria","de la Cruz"]`, bare `7` → `["7","",""]`. Duplicate `#12` produced **2 warning flags**, the name-less row **1 blocking error**, and the commit button read **"Add 5 players"** (6 rows, 1 blocked) — the pre-save clash check the single-player form never had. Preview grid `52px 117.4px 117.4px 28px`, `docScrollW == vw == 360` with a 6-row preview.
- [ ] **Help-docs sync** (`/docs`) — `lib/help-content/coaches.tsx`: how to paste/import a roster, what the collapsed field groups mean, what the momentum ring is and when it retires. Search matches keywords, not body — keywords must include "import", "csv", "spreadsheet", "paste", "bulk".
- [ ] **Memory + TODO** — `project_premium_coach_portal_ux_eval.md` updated; `TODO.md` line added. ⚠ TODO.md is currently modified by a concurrent session (schedule-alerts stream) — check freshness before staging and **never stage another session's files**.
- [x] **Clean dev restart DONE 2026-07-28** (owner authorised killing the concurrent session's server): stopped → `rm -rf .next` → restarted. A supervisor respawned a fresh `next dev` on 3000 (PID 21024, 15:26) *after* the cache purge, so the running server is cache-clean — verified `/platform-admin/login` **200**, `/` **200**, `/discover` **200**, **zero Supabase EACCES** in `.next/dev/logs`.
- [x] **`/simplify` DONE 2026-07-28** — 4 parallel cleanup lenses (reuse / simplification / efficiency / altitude) over the scoped diff; **10 findings applied, 2 skipped**, then re-probed **16/16**.
  **Applied:**
  1. **Bulk commit was ~400 sequential round trips at the 200-row ceiling** (each `createRepRosterPlayer` did a `SELECT` for `display_order` then an `INSERT`, in an awaited loop). Extracted `getNextRepRosterDisplayOrder`, added an optional `displayOrder` to `createRepRosterPlayer` (single-add path unchanged), and the bulk route now reads the append position **once** and runs inserts in `Promise.allSettled` waves of 10 → ~20 waves instead of 200 sequential pairs. Per-row failure reporting preserved exactly.
  2. **`activePlayers`/`events` were dead weight** — 2 of 8 milestone queries, shipped in the response and typed on both sides, but never read (the Overview already derives both from fetches it makes anyway). All four agents flagged it independently. Removed → **6 queries**.
  3. **The visibility filter was a hard-coded key chain gating on async nulls**, so a restricted assistant briefly saw three steps they can't act on until `/milestones` resolved. Each `SetupItem` now carries its own `visible`, computed synchronously from `capabilities` — the flash is gone and adding a 10th step means editing one place. The `lineups` step also gained its (previously missing) capability gate.
  4. **Two duplicate checklist rows.** The classification change (`group === 'optional'` → `!milestone`) put "Confirm season" in both the Required block and the row list; separately, "Add your roster" rendered as both trail step 1 and a required row. Fixed by **deleting the separate Required-steps block** — the roster step *is* trail step 1, and the panel's own "Next:" line and CTA already drive it. Rows are now exactly the four the plan specified, probe-confirmed.
  5. **Tags/Links rendered as bordered cards nested inside the disclosure's own bordered card** (box-in-a-box). New `.formSubGroup` keeps the heading language without a second border; probe asserts zero nested boxed sections.
  6. **Indentation lied about nesting** — ~120 lines of Tags/Links/Name/Notes swallowed by the fold were never re-flowed, sitting at the same column as the tag that contains them. Re-indented.
  7. **Grant-confirm text personalised nothing** — `.replace('them', who)` was a no-op for 2 of the 3 prompts and the message body was never personalised at all. Entries are now `who => ({title, message})` and interpolate into both.
  8. **A third segmented-control style.** `.bulkTabs`/`.bulkTab` duplicated the portal's existing `.segChoice` (the Roster page's own List/Depth-chart toggle). Deleted in favour of `.segChoice` + a `.segChoiceFull` width modifier — the sheet now opens with a control the coach just used.
  9. **`.discHide` was borrowed as a generic link and overridden inline at 2 sites.** Promoted a proper `.linkBtn` + `.linkBtnAccent` pair; both inline style objects deleted.
  10. **Silent truncation made visible** — `parseRosterPaste` caps at 200 and the guard on it was dead, so a 250-line paste quietly lost the tail. The sheet now says so. Also dropped a misleading `blankDraftRow` spread whose every field was immediately overwritten, and memoised the paste parse (it ran on every render, then again on the Preview click).
  **Skipped (noted, not argued):** capability-gating the remaining milestone queries — they're already inside one `Promise.all`, so it buys zero latency for added API surface; and repo-wide extraction of the per-route `resolveCoachContext` (~43 files) — a separate unit of work, not something to do for 3 files.
  **Post-fix gate:** typecheck 0 errors · `npm test` 411/411 · lint 0 errors · all six colour baselines ZERO · Playwright re-probe **16/16** (temp script deleted, DB teardown verified clean).
- [x] **`/review` DONE 2026-07-28** (high-risk tier · deterministic gate green first · 5 lenses: correctness, security/multi-tenant, data/contract, concurrency/state, regression/blast-radius). **13 findings confirmed and FIXED, 3 refuted, 3 accepted-and-noted.** Re-probed **20/20** (now including the bulk WRITE path end-to-end).
  **HIGH — fixed:**
  1. **The trail could never retire.** Trail dots render as dots, and only checklist ROWS carried a Skip control — so the four optional milestones (schedule/lineup/announcement/money) could never be skipped, `firstWeekDone` could never become true, and the full panel would sit on Overview forever for any coach who won't use one of them. Worse, the "Hide" control only renders once the panel has already receded, so there was no escape at all. This directly broke ratified **D4**. Fixed: a **Skip this step** control beside the panel's next-action CTA (only for optional steps), and a skipped dot becomes its own **Undo skip** button so a mis-tap is reversible. Probe-verified skip → undo round trip.
  2. **The panel rendered ABOVE the game-day card**, inverting this plan's own stated rule ("a game today always outranks onboarding"). Only the preseason anchor had a guard; game_day/in_season/result did not. Fixed by moving the anchor blocks above the panel in the JSX; probe asserts anchor-top < panel-top.
  3. **`hasLineup` counted a lineup with zero positions as done** — opening the builder auto-seeds the batting order and saving writes a row, so the step could tick with no position ever assigned. That is the *exact* false-"done" this milestone was introduced to eliminate. Now reuses the codebase's own stricter `getRepTeamLineupSetEventIds` (requires a real position), so the trail and the Lineups page can't disagree.
  4. **`.xlsx` upload DoS.** `parseXLSX` truncates to `maxRows` only *after* sweeping the sheet's declared extent, so a tiny file declaring a cell at the grid's far corner (1,048,576 × 16,384) forces billions of cell reads — the 2MB size cap doesn't defend against it. Pre-existing in shared import code, but this batch widened exposure from admins to every head coach. Bounded the sweep (256 cols, `maxRows*2+100` rows) with a warn on truncation; legitimate files are unaffected.
  **MEDIUM — fixed:** 5. `hasSentAnnouncement` filtered on `sent_at IS NOT NULL`, but that column is **NOT NULL** — the filter was a no-op and a send whose every recipient bounced still ticked the step; now `sent_count > 0`. 6. `teamDocuments` counted **archived** templates the Documents page filters out; now `is_active = true`. 7. Money **read→write** escalation skipped the confirm (only off→on asked), i.e. the *bigger* grant was ungated; now any widening confirms, via a rank comparison. 8. Bulk commit re-validated against the live roster then **threw the warnings away** — a clash created by another coach mid-session was silently written; warnings now return and surface in the result. 9. Zero-created bulk commits showed a **green success** toast reading "0 players added"; now reported as an error. 10. Switching the Paste/Upload tab **silently binned a reviewed list**; now confirms. 11. "Save & add another" runs lost their tally when finished via the primary button (five saves → "Carol added"); now reports the full count. 12. Full panel **flashed back** for coaches who'd long finished, because the gate didn't wait on the milestones fetch; now waits.
  **LOW — fixed:** 13. Parser hardening — `"12 12"` created a player named "12"; jersey clash matching was case-sensitive (`12a` vs `12A`); the guardian-email warning pointed at a field the preview can't edit (copy now says where to fix it); server-side per-field length caps added (bulk is 200× the single-add surface). Two new unit tests cover the parser cases.
  **Also added while fixing #3's family:** a **Swap first / last** control on the preview — a list exported "Last, First" is indistinguishable from "First Last" line by line, so rather than guess wrong per row the coach flips the whole batch in one tap.
  **Refuted (dropped):** setup-panel headline "inverted" (it matches the approved mockup); overlay double-registration and double-submit (both verified safe — flags set synchronously before the first await, symmetric mount/unmount); `createRepRosterPlayer` behaviour drift for its three existing callers (verified byte-identical on the no-`displayOrder` path, and `??` correctly preserves a legitimate `0`).
  **Accepted, not fixed (noted):** `display_order` collisions between a bulk commit and a concurrent single add — no unique constraint, ties resolve alphabetically, self-heals on any manual reorder, and the same race pre-existed between two single adds; the trail not live-refreshing when a step is completed in a *second tab* (it refreshes correctly on the normal navigate-away-and-back flow, matching every sibling effect on the page); repo-wide `resolveCoachContext` extraction (~43 files, separate unit of work).
  **Security/tenancy verdict: ZERO defects.** All three new routes carry the proven org → team → assignment chain byte-for-byte; `rosterWrite` is head-coach-only server-side; milestone nulling matches the capability rules exactly; no PII leak (only head coaches, who always hold `rosterPii`, can reach the write path); no `.or()` filter injection; no CSV formula-injection vector.
  **Post-fix gate:** typecheck 0 errors · `npm test` **413/413** · lint 0 errors · all six colour baselines ZERO · Playwright **20/20** at 360×740 (incl. bulk write: 5 players created, `display_order` contiguous 0–4 in paste order, full teardown verified — 0 probe rows left).
- [ ] Owner phone QA (checklist delivered at handoff) → commit on `dev` with explicit per-action OK. **Not pushed to prod** — Batch 2 rides a future release bundle.

---

## Architectural Decisions (proposed — ratify before build)

- **Decision:** Paste is parsed **client-side**, files are parsed **server-side**, and both converge on one shared draft-row shape and one commit endpoint. *Rationale:* paste needs to preview as you type with no network round trip (it is the phone path); `.xlsx` needs ExcelJS, which belongs on the server. Converging them means one preview table, one validator, one write path — not two half-features.
- **Decision:** Bulk create loops the **existing** `createRepRosterPlayer` and reports per-row failures rather than running a transaction. *Rationale:* no new DB surface, no new PII path, and a coach who pastes 15 names with one bad line gets 14 players plus one honest error — not a silent all-or-nothing rollback.
- **Decision:** One disclosure primitive serves every portal form, and `defaultOpen` is a mount-only hint. *Rationale:* the drift this batch is fixing came from each form solving field-overwhelm (or not) on its own; and a controlled-open prop would re-collapse a section the coach just opened on every parent re-render.
- **Decision:** The momentum ring **is** the setup checklist's five headline steps, drawn as a trail — not a second widget. *Rationale:* the readiness review lists the checklist among the five strengths to protect and says "extend it, don't replace it"; two competing "get started" surfaces on one page is the problem this batch exists to fix, not a new feature.
- **Decision:** Milestone truth comes from one capability-aware server read, not from client-side derivations. *Rationale:* the current lineup signal is next-game-scoped and produces a false "not done" for coaches who *have* built lineups — an onboarding trail that lies about work already finished is worse than no trail.

---

## Open Questions — ALL RATIFIED 2026-07-28 (owner, at the recommendations) · mockups APPROVED

- [x] **D1 — Bulk-add mechanism: BOTH, paste primary.** Paste-a-list is the default tab; spreadsheet upload sits beside it.
- [x] **D2 — Add Player field split: Variant A.** Visible = First*, Last, Jersey #, Primary position. Collapsed = guardian contact / (DOB + secondary position + notes).
- [x] **D3 — Capability grid: keep autosave, confirm sensitive GRANTS only.** Money view/edit, contacts & birthdates, send-announcements ask once when granted; revoking is always instant.
- [x] **D4 — Ring retirement: auto-hide once all five are done-or-skipped**, plus the existing per-step Skip and the panel's "Hide" control.
- [x] **D5 — Checklist expansion: Staff + Documents become skippable steps** (real completion signals); Chat / Development / Insights / Tryouts stay discovery chips — no fake "done" state.

---

## Mockups

Visual spec artifact — owner approval is binding per `memory/feedback_build_to_approved_mockups.md`; every element labelled **NEW / RESTYLED / UNCHANGED**.

**Coach Portal Batch 2 — Mockups:** `claude.ai/code/artifact/c52d7d67-dfeb-4727-b122-40d5ad73afec` (rev 1, published 2026-07-28 — **awaiting owner approval**). 14 frames at a true 360px phone width in the warm portal theme (the platform default): bulk-add paste/preview/upload + roster empty state; Add Player variants A and B; Add Event disclosed; grouped permissions + escalation confirm; the momentum ring at 0-of-5, 3-of-5, under a game-day anchor, and at retirement. Decisions D1–D5 are rendered as cards with the recommendation marked.

---

## Landmines carried forward from Batch 1 (do not relearn these)

- Every portal modal is a **full-height sheet at ≤640px by default**. New/edited sheets must use `CoachModalHeader` (renders both back and close), put actions in `.modalFooter`, and call `useOverlayOpen(open)` — it throws without the provider **by design**; `useOverlayOpenIfAvailable` is only for components that also render outside the portal. **Never** pair `CoachModalHeader` with `.centeredOnMobile`.
- `.formGrid` is **one column at ≤640** (owner fix) — no two-column squeeze on phones, including in the new preview table.
- **Git:** one shared `dev` branch; bracket paths need `:(literal)` pathspecs; explicit pathspecs only; audit `git show --stat` after committing; never commit or push without explicit per-action owner OK. The tree holds another session's uncommitted work (`lib/schedule-change-notices.ts`, migration 205, TODO.md) — never stage it.
- **Dev server** may be owned by a concurrent session — check port 3000 ownership before killing anything.

## Out of scope (stays in the readiness review, later batches)

Season-end lockout (P0 #1) and real-tournament-game attendance/lineups (P0 #2) — Batches 3 and 4. Schedule bulk import (P1) is deliberately excluded: it is the same rationale one tier down and belongs with the recurrence fix, not here. The Money reports' mobile treatment, the Attendance nav home, and the mobile notification bell are P1 items in no batch yet.
