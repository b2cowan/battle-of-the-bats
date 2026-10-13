# Club Tier Stage 11c — New schedule, round two: rules as sentences, sharing a facility, times that move (built to hub version 101)

> Paste into a fresh session on `dev`. Written 2026-10-12, the day Stage 11c was drawn and **ratified**: all seven asks
> as recommended (owner: *"looks good"*, then "Yes, all seven"), and **the build starts now** (the owner chose "build
> right away" over waiting for the dome walk, §300, to close — Ask 7 as revised). Stage 11a (the scheduler's server and
> screens) is built and committed; this round changes its settings, its engine, New schedule, the grid's chip, Fair
> shares and the drafts.
>
> **Three owner asks, from walking §300 W1:** *"a simple way to have certain teams share a field but not all … when the
> junior teams use them they split them, or even only 2 of the junior teams split a field because of their age"*; *"is
> there a better way to group and organize this page so it reads easier?"*; *"an option for consistent times vs. spread
> out … sometimes they have the early one and sometimes the later one, sometimes field 1 and sometimes field 3"*.
> **Ruled before drawing:** *"sharing a slot counts as half a field from a cost perspective."*
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 11c** (version 101).
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW, RESTYLED, UNCHANGED and
>   WORDS tag note is a requirement; open each one. **Screens:** **Where it stands** (`#s11c-status`, the findings
>   S11C-01…06), **1 · The window, regrouped** (`#s11c-window`), **2 · Sharing a facility** (`#s11c-share`), **3 · Times
>   that move** (`#s11c-spread`). The "Before" frames are what is built today; they are not to build.
> - **"Formatting check"** (`#s11c-format`) is your checklist, every row, including the `/design` review's **D1–D7**.
>   **"Not drawn"** (`#s11c-build`) is the build's shape; every row is in scope.
> - The Decisions tab holds the rulings with their reasons: rows **"Stage 11c · Ask 1–7"** and **"Stage 11c · What a
>   shared slot costs"**. Where you must depart, say so and record why; never silently.
>
> **Read first:** `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` **§6c** (this stage), §5.4 (the settings as first built) and §7's
> "11a part A BUILT" / "11a part B as built"; the in-repo `memory/design_decisions.md` entries of **2026-10-12** — "NEW
> SCHEDULE, ROUND TWO" (this stage), "THE SIDEBAR COLLAPSES TO AN ICON STRIP … FAIR SHARES' FIGURES GO ABOVE THE
> TOOLBAR, ITS TEAMS BELOW THE GRID", "A CLUB SCHEDULE'S PAGE DOES NOT SAY ITS TIME ZONE", "A SENTENCE IN A WINDOW'S
> FOOT SITS AT ITS LEFT", "A CREATE FORM LISTS ONLY WHAT YOU ADDED" (its *Remove this division*, ink), "A SETTINGS
> PAGE'S CARDS OPEN IN PLACE" (a one-value choice is a dropdown with its sentence under it). Memory
> `project_club_stage11_scheduler`, `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`,
> `decision_record_reads_first_edits_whole`, `decision_rare_door_ends_body`, `decision_edit_autosaves_create_asks`,
> `feedback_form_selects_are_dropdowns`, `project_field_menu_hangs_over`, `decision_drawer_layers_form_vs_menu`,
> `reference_partial_commit_shared_tree`, `reference_shared_ledger_truncation`, `reference_artifact_publish_needs_full_read`,
> `reference_hub_script_parse_trap`, `reference_backticks_in_shell_strings`.

## ⚠ The lessons this stage already paid for

- **A request is validated before the engine sees it.** A copied "Facilities by group" rule naming another venue's
  facilities looked harmless in the engine (it never matched a slot) but the request's parser refuses it
  (`readScheduleSettings` → `bad_rule` against the time's venues), so every count and Generate failed. Before you say
  what a setting does when it is stale, read the parser and the route, not only the engine. Every new setting here gets
  the same question: what happens to a saved or copied value that no longer fits the time or the teams?
- **A window that navigates does it with the window still open** (KitDialog's header). Save as a draft closed first and
  the window's Back step cancelled the move (§300 W2, fixed `46e75964`, held by `club-scheduler-screens-guard`).
- **Permit and Copy a schedule are two fields** (built 2026-10-12, `46e75964`): a permit is a link the schedule keeps;
  a copy fills settings a year on and keeps a picked permit's time; `fieldsInTime` trims a copied facility rule to the
  time's facilities on a permit pick, a copy and a Venue change. Keep it working; sharing rules name teams, not
  facilities, so they need no trimming — but a copied sharing rule must drop teams that no longer run a season (the same
  question as above).
- **The bill already halves a shared slot** (`pricedMinutes` divides a slot's minutes by its teams). The owner's cost
  ruling is how it works today: **don't change the bill**; make the generator and Fair shares agree with it (S11C-02).
- **Two sessions on one tree.** The owner is walking §300 on this dev server, and another project (Sidebar Strip &
  Grid Width, `SIDEBAR_STRIP_AND_GRID_WIDTH_PLAN.md`) moves Fair shares (band above the toolbar, the team table under the
  grid). Build shared files as HEAD plus your own hunks; never `git add` a file another session has dirty.

## Preconditions (check before code)

1. **Git:** on `dev`; read `git log` and `git status` fresh. `46e75964` (Permit / Copy a schedule, Save as a draft, the
   review's fixes) and the Stage 11c records commit are in the log. Other sessions' hunks in shared files (TODO, the plans,
   the briefs, the ledger, the hub, `memory/design_decisions.md`) are theirs.
2. **Fair shares' layout.** Check whether the Sidebar Strip & Grid Width build has touched `FairShares.tsx` or the
   schedule page (committed, or dirty in the tree). **If either file is dirty from another session, stop and tell the
   owner** — two builds editing one panel at once is how a hunk gets lost. If that build has landed, put 11c's columns
   on its team card; if it has not started, add them to today's panel and leave that build a note (the columns ride along
   when the rows move).
3. **The owner is walking §300.** Keep every step of this build working on the dev server; batch any restart (new files,
   shared modules) to one, and tell the owner before it happens.

## Where the code is (re-grep before you trust a line)

- **Settings** `lib/club-schedule-settings.ts`: `ScheduleSettings` (`v: 1`, ~:77) with `teamsAtOnce` (~:82, limits ~:93,
  parsed ~:147-148), `PrimeTime.mode` `'keep' | 'rotate'` (~:29-36), the rules parser (days off ~:223-233, `fieldsBy`
  ~:234-244, refused against `known.facilityIds` / `known.groupIds`), the value (~:249). Saved in
  `club_schedules.settings` (jsonb; mig 326 checks only `jsonb_typeof = 'object'`, ~:57) — **no migration**, but the
  column's meaning changes: update `docs/agents/db/DATA_DICTIONARY.md` (`club_schedules.settings`) in the same unit of
  work (`check:dictionary`).
- **Engine** `lib/club-schedule-engine.ts`: seats in `prepare` (~:474-487, each slot × `teamsAtOnce`), `seatCounts`
  (~:493-500), `shareTargets` (~:249), `makeDraft` (~:552: `keepNights` ~:569, kept slots sliced to `teamsAtOnce` ~:579,
  `costOf` ~:608-620 — the continuity pull and prime rotation), the value swap pass (~:721-735, by slot weight),
  `measure` (~:819; prime ~:832, nights ~:835), `teamResults` (~:865-897: `pricedMinutes += m * weight`, **not ÷ teams**),
  `planMove` (~:967-1000, `teamsAtOnce`), strategies (`DraftStrategy` ~:424, `STRATEGIES_WITH_PRIME` /
  `_WITHOUT_PRIME` ~:523-530).
- **Bill** `lib/club-schedule-bill.ts` `pricedMinutes` (~:42-50) — unchanged.
- **Server** `lib/club-schedule-server.ts`: `readScheduleRequest` (~:719-732, the known facilities from the time's
  venues), the list's open count (~:563-577, `atOnce`), `readAssignments` (~:693-703, `slot_full` by `atOnce`),
  `draftToSave` (~:739-745).
- **View** `lib/club-schedule-view.ts` `dropVerdict` (~:302-310, `teamsAtOnce`).
- **Words** `lib/club-schedule-words.ts`: strategy names (~:28), the draft measures' words (~:98-99), New schedule's words
  (`SCHEDULE_SCREEN_WORDS`, ~:374 on: the rule words, `teamsAtOnce` ~:410-411, `primeMode`/`primeKeep`/`primeRotate`).
- **Screens** `components/admin/kit/club/schedules/`: `NewScheduleWindow.tsx` (the Draft and `EMPTY`, `draftFromSettings`,
  `settingsBody`, `fieldsInTime`, `pickPermit` / `pickCopy`, the three sections); `ScheduleGrid.tsx` `SlotChip` (~:161-203:
  a multi-team slot joins names with " · ", `--tc` only for one team, a filtered slot dims to 0.35); `ScheduleWindows.tsx`
  (the slot window: `teamsAtOnce > 1` Change team ~:125-144; the move ~:41-59); `FairShares.tsx`; the schedule page
  `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx` (move and swap ~:204-210).
- **Tests** `tests/unit/club-schedule-engine.test.ts` (the drawings' numbers), `club-schedule-view.test.ts`,
  `club-schedule-bill.test.ts`, `club-scheduler-guard.test.ts`, `club-scheduler-screens-guard.test.ts`.
- **Help** `lib/help-content/org.tsx`, the club-schedules article (New schedule: the time; who and how much; rules).
- **Layout** `scripts/layout-screens.mjs`: `admin-schedule-new` (~:1431), `admin-schedule` (~:1433) and its windows.

## What to build

**A · The settings** (Not drawn, row 1). Keep reading every saved shape: nothing saved may change meaning.
- **Sharing a facility:** a rule list, each `{ teamIds, groupIds, atOnce: 2–4 }`. Refuse (in words) a rule with no
  ticked team, an unknown group, a team in two sharing rules, or `atOnce` outside 2–4. A copied rule keeps only teams
  that still run a season.
- **Each team's time:** `'same' | 'moved'`, default `'same'`.
- **Retired:** `teamsAtOnce` leaves the form. A saved schedule with `teamsAtOnce > 1` and no sharing rules reads as **one
  sharing rule naming every ticked team at that number**. `prime.mode` leaves the form; a saved `'rotate'` reads as
  Each team's time `'moved'`. (Production holds no schedules — mig 326 is dev-only until the promote — but dev's and the
  §300 walk's do.)
- The data dictionary's `club_schedules.settings` line says the new shape.

**B · The generator** (Not drawn, rows 2–3; Asks 1–5).
- **Sharing:** a team outside every sharing rule always has its slot to itself. Teams in one rule may share a slot, up to
  its `atOnce`, **only with each other**. **Paired whenever a partner is free** (Ask 2): when two teams of a rule both
  need a slot at one start, they share rather than take two facilities. **A half facility (weight < 1) is never
  shared**; a sharing team may take one alone. Kept and hand-moved slots stay as they are (Ask 19).
- **What a shared slot counts** (Ask 3): its worth is the slot's weight ÷ its teams — in the share targets (By percentage,
  Evenly), the value swap pass, `teamResults` (hours and priced minutes, now agreeing with the bill) and Fair shares. **A
  set number a week still counts practices** (2 a week = 2 practices, each on half a facility).
- **Moved around** (Ask 4): when Each team's time is `'moved'`, the cost prefers a different facility and a different
  start from last week's, for every slot (today's prime-only rotation, widened); **the day keeps its pull** (a team keeps
  its days). `'same'` is today's continuity, unchanged.
- **The drafts follow the choice** (Ask 5): Moved around ranks three mixes that all move ("Best overall", "Another mix",
  "A third mix" — words to `/marketing`); Youngest earliest and "Prime time rotated" are not offered with it. The same
  each week offers Best overall · Another mix · Youngest earliest. ⚠ **Read the ruling this way:** Ask 5's text says "the
  same each week keeps today's three", but the drawing's note (specimen 3, *The drafts follow the choice*) says "Prime
  time rotated" leaves everywhere because Moved around rotates prime time too; a schedule the club chose to keep the
  same must not offer a rotating draft, so it retires in both modes. Say so in the hand-off.
- **Measures:** a draft with sharing says it ("9U AA and 11U AA share a facility: half a facility each"); Moved around
  says how evenly early and late fell ("Early and late taken in turn: 12 or 13 early starts each") and that facilities
  were taken in turn. The nights measure stays.
- **The server and the page:** `slot_full`, the list's open count, `planMove` and `dropVerdict` read each slot's capacity
  from who sits in it (one non-sharing team = full; a rule's teams = its `atOnce`), not a schedule-wide number.

**C · New schedule** (specimen 1; Asks 1, 4, 5, 6) — to the drawing:
- **The time:** Copy a schedule (built) · Name · Permit (built) · Venue · Facilities · From · To · rows of Days · From ·
  Until · Slot length · Changeover · Dates off · the count line. **No Teams at once.**
- **Who, and how much:** Split the time **beside Each team's time** (a dropdown, its sentence under it); the form table;
  "N teams have no season running"; then **Prime time** (hours) with **How it's shared** beside it ("Shared the same
  way" · "Shared evenly by team") where it applies today (By percentage, prime time set). No Keep / Rotate.
- **Rules:** only the rules the club added, **each as its sentence** with a pencil (34 px at a desk). The pencil opens
  that rule **in place**: its fields, ✓ in the pencil's spot, **Remove this rule** at its end in **ink**
  (`RecordAction`'s look, D2). A new rule opens this way. **Add a rule** (olive door) opens **one menu that hangs over
  the window** (the menu layer; no heading — D6): Start and finish times · A team's day off · Facilities for a group ·
  Sharing a facility · At most, a day or a week, each with its line. The three safeguards stay ticks under **Always**.
  Folded, the line is the same sentences; "N on" counts the rules and the ticks that are on.
- **Sharing a facility's editor:** Teams (groups and teams, the facility rule's picker), At once (2–4), the hint
  sentence under them, ✓, Remove this rule. Its sentence: "9U AA and 11U AA share a facility, 2 at once" · "The Junior
  teams share a facility, 2 at once" (words to `/marketing`).
- The foot's count says what Generate hands out (the sentence at the foot's left, `footerStart`); the closing row says
  why slots are left open when sharing frees them ("50 slots left open: 9U AA and 11U AA share a facility.").
- The required asterisk is ink, as built (D3).

**D · The schedule's page** (specimens 2 and 3; Asks 2, 3, 4):
- **A shared slot's chip:** the names stacked, the left edge in each team's colour (two halves for two; equal parts for
  three or four), **no "Shared" mark** (D4); its accessible name and the slot window say "shared". It moves through the
  slot window, not a drag (built). No "Times in Eastern time." on the toolbar (D1 — another session removed it on
  2026-10-12, uncommitted when this prompt was written; check the log, and never bring it back).
- **Fair shares:** **Hours** where there is no prime time (a shared slot and a half field each half; "50 shared" under
  All for a sharing team); **Early** and **Fields** when the schedule moves teams around. The panel's layout follows the
  Sidebar Strip ruling (precondition 2).
- **The slot window:** Change team on a shared slot names both teams; a refusal for one team too many reads the rule's
  number.
- **The Team filter** dims the others to 0.35 and draws nothing on the picked team (D5, D7) — as built.

**E · Words and help.** Every drawn sentence is a draft: `/marketing` words the rule sentences, the menu's lines, Each
team's time and its two sentences, the sharing hint, the measures and the draft names **before the walks**. `/docs`
rewrites New schedule's articles (the time; who and how much, Each team's time, prime time; rules as sentences; sharing a
facility; moving teams around) and the grid's (a shared slot; Fair shares' Hours, Early, Fields); keep "teams at once",
"share a field", "rotate", "spread out" as search terms.

## Gates

- **Engine unit tests** (the drawings' numbers): the dome with 9U AA and 11U AA sharing → 250 slots handed out of 300,
  50 open, every team 37.5 hours, the bill $2,700.00 each; a non-sharing team never shares; sharing teams pair only
  within their rule and never on a half facility; Moved around over the dome → each Senior team 12 or 13 early starts of
  25, at least three facilities, every slot on a Sunday (days kept); a saved `teamsAtOnce: 2` reads as one sharing rule;
  a saved `prime.mode: 'rotate'` reads as Moved around; a copied sharing rule drops a team with no season.
- **The parser:** every refusal above, in words; a settings round trip (form → parse → form) loses nothing.
- **A screens guard** (extend `club-scheduler-screens-guard`): no Teams at once in The time; Each team's time beside
  Split the time; prime time in Who, no Keep / Rotate; rules render as sentences with one Add a rule; Remove this rule is
  ink; the shared chip stacks names and carries no "Shared" mark.
- `npm run verify:changed`, `npm run typecheck` (after `npx next typegen`), the targeted unit files, `check:dictionary`,
  `check:spelling`, `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:old-look`.
- **`check:layout`, both themes,** `--only=admin-schedule-new,admin-schedule` and the slot window's entry (ask the owner
  first — the dev server is the one the walk uses). If a saved sign-in has gone stale, refresh it
  (`npx playwright test --config playwright.config.ts --project=auth-setup`) — a redirect is a failure, not a skip.
- Then `/simplify`, `/review` at the **high-risk** tier (engine + settings + server), and a `/design` review of the built
  screens against the hub at 1440 and in Dark.

## Walks

A new Owner QA ledger § (the number **at the moment you write it**; grep before and after appending, and grep your
record whole before staging — memory `reference_shared_ledger_truncation`), checkable walks on the hub's QA tab under
Stage 11c, one purpose each, with the sign-in card. **Generate every figure on dev before writing a walk** (the 11a
lesson): run the walk's own settings through the generator without saving.
1. **The window, regrouped:** New schedule reads The time · Who, and how much · Rules; no Teams at once; Each team's time
   beside Split; prime time whole; Rules as sentences; Add a rule's menu; a rule opened in place and closed with ✓;
   Remove this rule.
2. **Sharing, end to end:** a sharing rule for 9U AA and 11U AA → the count and the closing row → the drafts say it →
   Save as a draft lands on the page → the shared chips → Fair shares' Hours → Bill the teams charges each $2,700.00 for
   its 50 shared slots, and the closing line names the open time.
3. **Moved around, end to end:** the same dome moved around → the drafts (three mixes) → the page filtered to 14U AA
   (Field 1 early, then a late start elsewhere, …) → Fair shares' Early and Fields.
4. **What was saved before:** the §300 walk's draft opens, regenerates and bills exactly as before; a copied schedule
   with a sharing rule drops a team with no season.
5. **Dark** — every changed frame.
Fold in §300's owed re-checks if still open (Permit and Copy a schedule with Fall diamonds; Save as a draft landing on
the page).

## Hand-off

- An owner-voice summary: what a club admin sees and does differently, the walks to run, departures from the drawings
  (including the drafts reading above), anything found and not fixed.
- The records: plan `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` ("11c BUILT" at the top and §6c's as-built), the PM brief, the
  TODO line, memory `project_club_stage11_scheduler`, the in-repo design log if a new ruling lands, and the hub's QA tab
  republished at the same address (read it first; parse every script before publishing).
- **Notes to others:** the Sidebar Strip & Grid Width build (Fair shares' new columns); Stage 9 / 11b (house league's
  practices meet sharing and moving the same way); 6d (a shared slot is one booking with its teams, as built).
- **Commit only when the owner says**, staging your own files and, in shared files, HEAD plus your own hunks; after the
  commit, `git show --stat HEAD` and confirm only your files landed.
