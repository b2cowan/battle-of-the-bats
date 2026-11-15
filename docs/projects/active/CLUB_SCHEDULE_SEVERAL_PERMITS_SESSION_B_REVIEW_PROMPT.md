# Session B — review, docs and commit run (ONE chat, resumable across /clear)

Owner prompt to start or continue this run (the same words every time):

> Run the Session B review run: read `docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_SESSION_B_REVIEW_PROMPT.md`
> and do the next unticked stage.

## How this run works (read every time)

- Read **Progress** below and start at the first unticked stage. Do not redo a ticked stage.
- After each stage, tick it here with ONE line: what changed, findings count, owner rulings given. Write the tick
  **before** you pause, so a /clear loses nothing.
- At a **⏸ PAUSE** marker, stop and say to the owner, exactly: *"Pause point — run /clear, then paste:"* followed by
  the owner prompt above in a code block. Also pause early (tick first, note where you stopped inside the stage) if the
  chat has already run two heavy agents or the context is getting deep.
- Owner rulings asked inside a stage are asked in-chat (AskUserQuestion or plain question) — that is not a pause point.
- Product-owner voice to the owner. Never push. Never touch prod. Dev branch only. No commit until Stage 6, and Stage 6
  asks first.
- After any code change in a stage, re-run the **Tests** below and report pass counts. A red result is reported as red.

## What Session B is (context for every agent)

Several-permits build, Session B: **a date off can name its parks** (default All venues). Plan
`docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md` §4c + Phase 2 (the build record and the defaults chosen);
drawing `CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html` SCR.off; DB shape `docs/agents/db/DB_ARCHITECTURE_REVIEW.md`
Finding #50 "Mig 2 (B)" (decided — do not reopen). Built 2026-11-15, uncommitted. Mig 488 applied to DEV only.

**Invariants (every stage must keep them):**
1. A one-permit, one-park schedule stores and cuts exactly what it did before (every date off sends `venueIds: []`).
2. A stale tab (datesOff without `venueIds`, or null) can never widen a named date off to All — not in the save (SQL
   keeps the stored set) and not in the drafts (the regenerate route's `datesOffKeepingParks` runs before cutting).
3. Unticking a permit re-derives a shared day from the permits still ticked.
4. No reader treats a schedule's dates off as venue-less (the guard's permit-side allow-list is the decision point).
5. The venue FK is NO ACTION — deleting a named park is refused, never silently widens.
6. All venues is stored as NO venue rows. Existing dates off keep meaning All venues.

**B's files:**
- New: `supabase/migrations/488_a_date_off_names_its_parks.sql`, `tests/sql/date-off-venues-fixture.sql`,
  `tests/unit/club-schedule-dates-off-venues.test.ts`, this prompt file.
- lib: `permit-time.ts`, `club-schedule-permit-rows.ts`, `club-schedule-server.ts`, `club-schedule-document.ts`,
  `club-schedule-overview.ts`, `club-schedule-words.ts`, `permit-dates-off.ts`, `permit-dates-off-view.ts`.
- app/components: `app/api/admin/schedules/[scheduleId]/route.ts`, `app/api/admin/org/venues/route.ts`,
  `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx`,
  `components/admin/kit/club/schedules/{NewScheduleWindow.tsx,ScheduleAttention.tsx,Schedules.module.css}`.
- tests: `tests/unit/club-scheduler-screens-guard.test.ts`, `tests/unit/team-move-coverage.test.ts` (the
  `org_time_date_off_venues` line only).
- records: `docs/agents/db/DATA_DICTIONARY.md`, the 7 `docs/agents/db/schema-snapshots/*` files +
  `memory/reference_db_schema.md` (generated whole), `supabase/migrations/MANUAL_PROD_STEPS.json` (the **488 entry
  only**), `docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md` (Phase 2), `TODO.md` (the several-permits line
  only).

**NOT B's — never edit, never stage:** the 486 entry in MANUAL_PROD_STEPS.json, `OWNER_QA_LEDGER.md`,
`.probe-edit.cjs`, `debug.log`, the `NOTIFICATION_MESSAGE_ROWS_*` prompt files, the owner's Bill/Send window edits, and
any other hunk another session left in a shared file. If an agent wants to change one, report it instead.

**Tests** (run after any code change):
```
node --import ./tests/ts-resolver.mjs --test tests/unit/club-schedule-*.test.ts tests/unit/club-scheduler-*.test.ts tests/unit/permit-*.test.ts
node scripts/db-query.mjs --dev -f tests/sql/date-off-venues-fixture.sql      # expects DATE OFF VENUES FIXTURE OK: 5/5
npm run lint:focused -- <changed files>
```
Whole typecheck only when a stage touched shared lib/route code: `NODE_OPTIONS=--max-old-space-size=10240 npm run typecheck`.
Known red before this run that is NOT B's: `team-move-coverage` (other sessions' `league_season_time_asks`,
`platform_charge_tax_looks`), the "Run a tournament" club-hub guard, and `verify:changed`'s npm test step.

## Progress

- [x] **Stage 1 · /simplify** — DONE 2026-11-15 (4 helper agents; ~30 findings, 4 applied, none touch the six invariants): park-name lookups now use the shared `placeName`/`placeWords` (page, document, New schedule window ×2); two dead `venueIds ?? []` maps dropped from the Settings… load; Needs attention computes "first row that asks" once (same lime/outline result). Guard test `club-scheduler-screens-guard` re-pinned to the new wording (5 asserts). Tests 487/487, SQL fixture 5/5, lint + whole typecheck clean. **Left for the owner/Stage 2 (bigger refactors, not done):** build per-permit Outside words in lib instead of the page (`scheduleOutsideRowWords`); `readScheduleOutside` keeps two parallel accumulators (derive the combined view from `rows`); "more than one park" decided in four places (set `venueIds: []` in `readScheduleOutside` for a one-park schedule); regenerate route's stale-tab fill could move into `readScheduleRequest`; `datesOffChanged` could drop its `days` arg; `PickField` needs a `hideLabel` prop instead of the CSS reach-in; per-render memoisation in the New schedule window. Original text: run `/simplify` scoped to B's files only. New abstractions to look at: `mergeDatesOff`,
  `dateOffVenues`, `datesOffChanged`, `datesOffKeepingParks`, `dateOffCovers` + `DateOff.venueIds`,
  `ScheduleOutside.rows` / `ScheduleOutsideRow`, the page's `outsideRows`, the form's `parksCtx` / `offParks`. Apply
  its cleanups if they keep the invariants; re-run Tests.
- [x] **Stage 2 · /review** — DONE 2026-11-15 (4 lenses: SQL, lib/routes, form, venues route + blast radius; gate green; ~35 reports → ~22 after dedup; 0 Critical/High; six invariants hold in code except invariant 2's preview gap, now fixed). **Owner picked all four fix groups, applied:** (1) the generate preview now fills a day's stored parks before cutting (`datesOffKeepingParks`, guard-pinned); (2) the printed Dates off note always names a park (detail gains `offParkNames`; names A–Z; fallback "at a park this schedule doesn’t use" — **/marketing Stage 5 to review that sentence**); (3) SQL fixture check 3 now proves `null` on a day that names a park, and every setup save checks `ok`; (4) "Applies to" offers every park the save will send, and unticking a permit trims hand-picked lists to parks still used (a pick naming none stays as typed). Tests 488/488, SQL fixture 5/5, lint + whole typecheck clean. **Left, owner to rule or later stages:** deploy order (code on prod before mig 488 → schedule pages 500; the release gate `check:migrations` stops it); venue delete race returns the generic 500 (same as sibling refusals); the venue refusal doesn’t say which schedule; trigger accepts a permit-owned date off (**Stage 3 /dba question**); absent `datesOff` list = delete all (pre-existing); two permits same day/park show two rows; "From …" line shows on a one-park schedule; `.offRowParks` vs `.offRow` same-specificity CSS at ≤640px (check in Stage 5); Outside no-practices line omits the park; a one-permit two-park schedule stores permit dates off as named [A,B] not All (by P5 A). Original: run `/review` on B's files (after Stage 1), told to REPORT against the six invariants
  plus: the Settings… load merging "Take … off" days; the per-permit Outside rows and the parks each names; the
  `venue_in_date_off` refusal; the regenerate path filling stored parks BEFORE cutting. Then list the findings to the
  owner in plain words, each with a recommendation (fix / leave), and ask which to apply. Apply the ones he picks,
  re-run Tests + whole typecheck.
  **⏸ PAUSE**
- [x] **Stage 3 · /dba** — DONE 2026-11-15 (GO; 0 blocking). Shape matches Finding #50 "Mig 2 (B)" (verified live on dev); 488's save function differs from 487's only by the three declared variables + the datesOff block; org delete with a named park still cascades; fixtures 5/5 + 5/5, unit tests 488/488. **Owner ruled YES to one amendment:** the trigger now also refuses a park row on a PERMIT's date off (488 amended in place, re-applied to dev, fixture check 5 extended; snapshots refreshed by the hook). MANUAL_PROD_STEPS 488 entry gained the trigger verify + a "prod's save is still 487's" pre-check; dictionary + Finding #50 + plan updated. Left, Low/accepted: malformed park id → generic 500 (route validates first). Original: pre-prod review of mig 488: shape vs Finding #50 Mig 2 (B); `club_schedule_save` diffed
  against 487's (only the datesOff block + three declared variables should differ); the SQL fixture; the
  MANUAL_PROD_STEPS 488 entry and its verify queries; dictionary + snapshots. Ask it the open question: should the
  same-club trigger also refuse a PERMIT's date off (only schedules write the table today)? It updates Finding #50's
  status. If it wants the shape changed: 488 is not on prod, so amend 488 in place, re-apply to dev
  (`node scripts/apply-migration-api.mjs supabase/migrations/488_a_date_off_names_its_parks.sql`), re-run both SQL
  fixtures (`tests/sql/several-permits-fixture.sql` too) — but ASK the owner before any shape change. Never prod.
- [x] **Stage 4 · /docs** — DONE 2026-11-15 (`lib/help-content/org.tsx` only; 5 entries + parent keywords/searchText): club-schedules-t-time (Permits tick-list, untick, new "Applies to" paragraph: All venues first, From {permit}, merge rule, printed note), club-schedules-t-page (one Outside-the-permit row per permit, "Take … off {park}", "From the permits"), permits-t-dates-off + faq-permits-date-off-bookings (copied into a schedule they close only that permit's parks; answerText in sync), venue-library (new "Named by a date off" row: archive, not delete). check:spelling clean, lint clean, help tests 19/19. Add `lib/help-content/org.tsx` to B's commit (Stage 6). Original: update `lib/help-content/org.tsx`: `club-schedules-t-time` ("Applies to", All venues
  first, shown with more than one park; a permit's date off covers its own parks; "From {permit}"),
  `club-schedules-t-page` (one "Outside the permit" row per permit; "Take … off {park}"), `permits-t-dates-off` and
  `faq-permits-date-off-bookings` (copied into a schedule they close only that permit's parks), `venue-library` (a park
  a date off names is archived, not deleted). Keywords/searchText too. Words come from `lib/club-schedule-words.ts`.
  Run `npm run check:spelling`. (Add the edited help file to B's file list in Stage 6.)
  **⏸ PAUSE**
- [x] **Stage 5 · /design + /marketing (light)** — DONE 2026-11-15; owner agreed all four recommendations, all applied: (1) `PickField` gained an opt-in inline label, so a date off reads "Applies to  Kinsmen Park ⌄" in one box (the CSS reach-in and wrapper removed); (2) printed fallback now "a venue this schedule doesn’t use" (test re-pinned); (3) help bridge: "tick the venues the day closes (a town’s parks, say)" + venue-library "Applies to one venue"; (4) Overview "Different on a date" now says "every facility at {parks}" on a schedule over more than one park (permit rows only; one-park unchanged). New B files: `components/admin/kit/club/PermitWindows.tsx`, `Permits.module.css`, `schedules/ScheduleOverview.tsx`. Tests 507/507, SQL fixture 5/5, lint + spelling + whole typecheck clean. Findings left: menu detail line, ≤640px CSS clash (unreachable), repeated chip, From line on one park. Report text follows. Original: Design: fix "Applies to" key (give `PickField` an optional inline key label; small; replaces the CSS reach-in); leave menu detail line, ≤640px CSS clash (New schedule absent on phones, §5.9), repeated chip, "From" line on one park. Marketing: all strings KEEP except (a) printed fallback "a park this schedule doesn’t use" → "a venue this schedule doesn’t use" (minor), (b) Overview "Different on a date" row says "every facility" (`outsideDayPlace`, `lib/club-schedule-words.ts`) even when a date off names only some parks — check/decide, (c) help says "parks" in prose and "venues" on controls with no bridge sentence (org.tsx club-schedules-t-time "tick the parks"; venue-library). Original: `/design`: check the New schedule dates-off row against SCR.off.
  Known gaps: the "Applies to" key is visually hidden (PickField puts its label above) rather than inline in the
  button; the menu has no per-park detail line; and Needs attention with two Outside rows. Report and recommend; build a
  fix only if it is small and the owner says yes. `/marketing`: review the words — `dateOffAppliesTo`, `allVenues`,
  `dateOffFrom`, `outsideHead(permit)`, `outsidePractices(at)`, `takeDaysOff(at)` (the drawing's words), plus two new
  sentences: the document's "Dates off: Sat, Mar 27 (Easter weekend, at Kinsmen Park)" and the Venue library refusal
  "A date off on one of the club’s schedules names {venue}, so it can be archived but not deleted." Apply what the owner
  approves; re-run Tests + spelling.
- [x] **Stage 6 · Commit** — DONE 2026-11-15: committed `da0f39b53` on dev (41 files; owner said commit and to stop ending messages with Co-Authored-By, so none). Private index + CAS on HEAD; TODO.md and MANUAL_PROD_STEPS.json built from HEAD + B's piece only (the release-hardening TODO line and every other prod-status flip / the 486 entry stay uncommitted in the tree). Hash recorded in plan Phase 2, TODO and the project memory in a follow-up docs commit. Original: runs only after Stages 1–2 are ticked. **ASK the owner before committing; show the file
  list first.** Recipe: dev branch; explicit pathspecs; never push. Other sessions have uncommitted work in the tree
  (the Bill and Send windows, notifications, words/send/stylesheet pieces): stage only B's hunks, build blobs from the
  working copy minus foreign hunks, commit in a private index with a compare-and-swap on HEAD in ONE script (HEAD moved
  three times mid-build in A, once in B), then `git show --stat HEAD` and confirm only B's files landed. Read the staged
  hunks around every insertion; a filtered -U0 patch misplaced two in Session A. Do not touch the owner's Bill/Send
  window edits. Untracked `.probe-edit.cjs` and `debug.log` are not B's. Message names what the admin sees change and
  ends with the Co-Authored-By line. After the commit: record the hash in plan Phase 2, the project memory file
  (`project_schedule_several_permits.md` in the Claude auto-memory) and the TODO.md several-permits line ("committed
  `<hash>` <date>").
- [ ] **Stage 7 · Close** — tell the owner, in plain words: what the run changed; the browser pass he owes (restart
  the dev server first — new files + shared modules; then New schedule with two permits at two parks → "Applies to";
  untick one permit; Needs attention "Outside the permit" for the second permit → "Take … off"; try deleting a park a
  date off names); and the open owner decisions (the plan's Phase 2 list, plus the Step 0 overlap ruling — "trim" or
  "keep"). Next session after this: Session D.
