# Row-list inventory — rendered 2026-09-16 (the F-17 re-measure)

The evidence for the row-list recipe (standard §3.10) and the register rows that resolve F-17.
Sibling to `TABLE_INVENTORY_2026-09-06.md`, deliberately **not** written into it: the drift between
the two dates is itself evidence, and three of the 09-06 list rows turned out to be things that
were never lists. Every number here was read from computed styles and real geometry on the served
page (`scripts/.tmp-tablereview/measure-rowlists.mjs` — scratch; the durable form is the gate the
plan proposes). Prompt: `docs/projects/active/COACH_ROW_LIST_RECIPE_F17_PROMPT.md`.

**Method, and the one thing this probe does that the 09-06 probe did not.** The 09-06 probe
*detected* row lists (≥ 3 same-class stacked children) — which is how a menu and a stepper reached
F-17. This one is **targeted**: every list is named by the class its markup gives it, read from the
source first, so what it measures is a decision about what a row list is. And it reads the
**ground** — the first non-transparent ancestor behind the row — because "sits on the card" named a
ground nothing painted for ten days and the old probe recorded the row's transparency and stopped
(F-24). Rendered: UAT coach on `uat-test-org` (UAT Test Team; the finished team for the closed
season) at **1440 · 768 · 390**, warm and dark, hover read at 1440.

## The numbers beside the 09-06 numbers

| List (09-06 sweep id · class) | 09-06 | 09-16 (1440 warm) | What moved |
|---|---|---|---|
| Schedule list view (`coach-schedule` · `eventChip`) | 5–6 rows · **31** · "12px" | 16 rows · **31 / 31 / 50** (1440/768/390) · item **14px** body 400, lead 12px | the "12px body" was the lead time; the name is 14. Unchanged otherwise — **31px is under every floor the standard has, and the row is a 736 × 31 control at 768** |
| Practice plans hub (`coach-practice-plans` · `lineupFrontRow`) | 6 · **73** · 20px display 800 | 7 · **73 / 73 / 76** · day tile 20px display 800 · title 16px 700 · meta 12 | redrawn twice since (stages 0–4) — the ROW is the same component and the same numbers; the page around it changed (next-practice card, tabs, "Every practice this season ›") |
| Lineups hub (`coach-lineups` · same component) | 5 · 73 · 20px display 800 | 6 · **73 / 73 / 74** | unchanged |
| Lineups → Templates (`lineupTplRow`, not on the 09-06 list) | — | 1 · **69 / 69 / 89** · 16px 650 | the same card shape with three controls in the row (Apply 70 × 33, two 38 × 38 icons) |
| Closed season — results shelf (`seasonRecordRow`) | 4 · 38 · 14 | 4 · **38 / 38 / 38** · 14px 400, tabular score right | unchanged; on the shelf's card |
| Closed season — roster shelf (`seasonDoorRow`) | 9 · 44 · 14 | 9 · **44 / 44 / 44** · 14px 600 | unchanged; one-line rows at a comfortable height |
| Closed season — practices shelf (`seasonDoorRow` as a Link) | — | 2 · **62–63** two-line doors | measured for the first time (the 09-06 sweep measured the shelf shut) |
| Closed season — the shelves (`collapseSection`) | 4 · 55 · 16px 700 | 4 · 55 | **not a list** — bin C |
| Settings → Tags — libraries (`tagShelfLib`) | 5 · 45 · 14 | 6 · **45 / 45 / 45** · 14px 700 | one more library; on the Settings shelf card |
| Settings → Tags — one library's words (`tagDrawerRow`) | — | 3 · **44 / 51 / 51** · **16px** 600 | measured for the first time; the word's size is **inherited**, not chosen |
| Settings — `settingRow` × 4 · 71px | on the list | — | **not a list** — the Settings form's rows; bin C |
| Notifications (`item`) | 3 · 102 · "16.8px" | 14 · **93 / 93 / 114** · title 14.08px 600 · body 12.8 · time 12 data | the "16.8px" was the emoji icon; three-line rows on the feed's own card |
| Scouting book (`scoutRow`) | 6 · 68 · 14 | 6 · **68 / 68 / 68** · 14px 700 · meta 12 · record chip 12 data | unchanged |
| Player → Season — last sessions / awards (`miniRow`) | 10 · 41 · 14 | 10 · **41 / 41 / 41** · 14px 400 · date 12 · badge 12 upper | unchanged; tinted pill rows on the section card |
| Player → Notes (`noteRow`, not on the 09-06 list) | — | 2 · **74 / 96 / 165** · 14px 400 · date 11px **data face** | measured for the first time |
| Staff (`coach-staff` · "`railItem` 11 × 22px") | 11 · 22 · 14 | 7 · **88 / 99 / 156** · name **16px** 600 (inherited) · caps line 12 | **the 09-06 row was wrong**: `railItem` is the consumer account rail's class, and the staff list was rebuilt on 2026-09-11 (pass 2) as a framed, hairlined list — it is on the recipe's shape already |
| Roster — Off the roster (`offRosterRow`) | 3 · 43 · 14 | 1 · **38 / 58 / 58** · 14px 600 · number 12 data | the fold's hairline is **`--white-05` → paper on paper** in warm (F-02's bug on a list row) |
| Tournaments entries (`CoachRegistrationCard .card`) | — | **not rendered** — the fixture team has no entry | stylesheet-read: `--surface` card, `--border`, radius, 1rem × 1.25rem padding, title 16px 700, meta 12; gap 0.5rem |
| Announcements sent list (`AnnouncementEditor .row`) | — | **not rendered** — none sent | stylesheet-read: `--surface-2` card rows, `--border-2`, radius-sm, gap 0.5rem, a 38 × 38 status tile, name 14px 700, meta 12 |
| Player → Family — guardians (`FamilyCard .row`) | — | **not rendered** — no contact on the fixture player | stylesheet-read: unhairlined rows separated by 0.6rem margin; label 14 600, sub 12 |
| An opponent's page — their results (`scoutIntelRow`) | — | **not rendered** — the fixture opponent has no other results | stylesheet-read: result letter · score (data face) · vs · date, four same-kind columns |
| Tryouts (`row` 176px · `howStep` 42) | on the list | 3 · 61 · checklist | **not lists** — the setup checklist and the how-it-works stepper; bin C |
| Ledger (`dateRangeOption` 7 × 26) | on the list | 7 · 26 / 44 / 44 | **not a list** — a menu; bin C |
| Team hub — setup checklist (`setupList`) | — | not rendered (setup complete on the fixture) | a checklist; bin C |
| Depth chart (`pcardRow`) | 12 · 54 | — | a board, not a list; bin C |

## Per-list measurements (1440 warm unless stated; 768 and 390 heights and tap boxes beside)

| List | Rows | Row h 1440 / 768 / 390 | Gap | Pad Y | Item line | Caption | Label row | Hairline | Row fill · frame · radius · shadow | **Ground behind the row** (warm · dark) | Hover (1440) | Opens | Tap box 768 · 390 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Schedule list view | 16 | 31 / 31 / 50 | 6px | 7.2 | 14 body 400 · lead 12 tertiary | 11 upper (result) | month: 12px upper body 700 tertiary, `--home-line` under it, on the paper above the stack | **none** | `--home-card` · none · 0 6 6 0 · 3px colour rail left | **paper** #F8F4ED · #0A0A0A | olive-soft · pointer | row is a `<button>` | 736 × **31** · 358 × 52 |
| Practice plans hub | 7 | 73 / 73 / 76 | 9px | 12 | day 20 **display 800** · title 16 **heading** 700 | 12 tertiary | 11px upper kicker on the paper | blueprint/olive .3 border | `--white-8` (white in warm) · olive/blueprint .3 · 12px · shadow | **paper** · #0A0A0A | `--white-10` (= `--home-line`, a brown tint) · **lift −1px** · pointer | row is a link | 736 × 73 · 358 × 87 |
| Lineups hub | 6 | 73 / 73 / 74 | 9px | 12 | same component | same | same | same | same | **paper** · #0A0A0A | same | row is a link | 646 × 73 · 268 × 87 |
| Lineups → Templates | 1 | 69 / 69 / 89 | — | 10.4 | 16 650 | 12 | none | same border | same card | **paper** | white (no tint) · auto | a link inside + 3 controls | 538 × 47, 70 × **33**, 38 × 38 · 160 × 66 |
| Closed season — results | 4 | 38 / 38 / 38 | 0 (9 between months) | 7.2 | 14 body 400 | — | month head (body 600) | `--home-line` ✓ | none · none · 0 · 2px left rule `--border-subtle` | **shelf card** #FFF · #111827 ✓ | none · auto | nothing (flat by ruling) | — |
| Closed season — roster | 9 | 44 / 44 / 44 | 0 | 10.4 | 14 body 600 | 12 (`<small>`, when present) | none (the shelf title) | `--home-line` ✓ | none | **shelf card** ✓ | none · default | nothing (flat by ruling) | — |
| Closed season — practices | 2 | 62–63 | 0 | 10.4 | 14 body 600 | 12 | month head | `--home-line` ✓ | none | **shelf card** ✓ | **none on a row that opens** | row is a link → read-only plan | 44+ |
| Tags — libraries | 6 | 45 / 45 / 45 | 0 | 0 (44 min) | 14 body 700 | 12 | none (the shelf title) | `--home-line` ✓ | none | **Settings shelf card** ✓ | olive-soft · pointer (on the button) | a `<button aria-expanded>` — the row | 699 × 44 · 321 × 44 |
| Tags — words | 3 | 44 / 51 / 51 | 0 | 3.2 | **16** 600 (inherited) | 12 | none | `--home-line` ✓ | none | **Settings shelf card** ✓ | none | three icon buttons | 44 × 44 ×3 ✓ |
| Notifications | 14 | 93 / 93 / 114 | 0 | 13.6 | title **14.08** 600 · body **12.8** | time 12 **data face** | day header **10.24 data face** upper on the paper band | `--home-line` (top) ✓ | unread: blueprint .06 tint | **feed card** ✓ | olive-soft · pointer | a `<div>` with onClick (redraw R8 open) | 686 × 134 · 324 × 215 |
| Scouting book | 6 | 68 / 68 / 68 | 8px | 11.2 | 14 body 700 | 12 tertiary · record chip 12 **data** 700 | none | blueprint/olive .3 border | `--white-8` · .3 · 12px · shadow | **paper** · #0A0A0A | `--white-10` · **lift** · pointer | row is a link | 736 × 68 · 358 × 68 |
| Player → Season — sessions / awards | 10 | 41 / 41 / 41 | 5px | 6.4 | 14 body 400 | 12 tertiary · badge 12 upper 600 | 12px upper 700 tertiary (`miniListLabel`) | `--home-line` (as the pill's border) | **olive-soft** · `--border-2` · 8px · no | **section card** #FFF · #111827 | none | nothing | — |
| Player → Notes | 2 | 74 / 96 / 165 | 0 | 9.6 | 14 body 400 | date 11 **data face** 600 · source chip | none | `--home-line` ✓ | none | **section card** ✓ | none | a link inside (Goal ›) | 274 × 44 ✓ |
| Staff | 7 | 88 / 99 / 156 | 0 | 9.6 | **16** 600 (inherited) | 12 tertiary (email, caps line) | none | `--border-2` (= `--home-line`) ✓ | none · **the list paints `--home-card` with `--border`** ✓ · radius | **the list's own frame** ✓ | none · auto | a `<button>` "Edit access ›" | 170 × 44 ✓ (36 at 1440) |
| Roster — Off the roster | 1 | 38 / 58 / 58 | 0 | 6.4 | 14 body 600 secondary | number 12 data | the `<summary>` (14 body 600 tertiary) | **`--white-05` → paper** ✗ | none · dashed `--border-2` fold · 10px | **paper** ✗ | none | a link inside + "Add back" | 82 × 44, 65 × 44 ✓ |

The bin-C surfaces measured for the record — Ledger date-range menu 26 / 44 / 44 (a menu inside its
own popover card), the tryouts setup checklist 61 / 61 / 76 (its own card), the closed-season
shelves 55 (each its own card) — are not in the table above because they are not lists of records.

## What the numbers make visible

1. **Two species, not six treatments.** Seven lists are **gapped card stacks on the paper** (the
   two hubs, Lineups' templates, Scouting book, the Schedule list, Tournaments, Announcements) and
   one is a stack of tinted pills on a card (the player's sessions). Every one of them is the
   *phone's* card shape drawn at 1440 — bordered, radiused, shadowed, gapped — and every one sits
   on the blueprint grid. The other nine are **hairlined rows**, and eight of the nine already sit
   on a card something else paints (a shelf, a section card, the staff list's own frame, the
   feed's own frame). The ninth — Off the roster — sits on the paper with a paper-coloured hairline.
2. **The ground is painted by four different things.** The staff list and the feed paint their own
   frame; the shelves and the player sections are painted by the card around them; the hubs, the
   schedule, the scouting book and the fold are painted by nothing. "Exactly one painter" is the
   rule that was missing.
3. **Two sizes are inherited, not chosen** — the staff name and the tag word both render at
   **16px** because nothing on the row asks for a size (the "cell decides its own size" rule, F-01's
   mechanism on a list row). The notifications feed's 14.08 / 12.8 / 10.24 are literal rems from a
   module shared with the admin page.
4. **The display face is on a row** in the two hubs (the day tile at `--type-title` 800) — the one
   place in the portal a row reads larger than its section heading.
5. **Hover is a card idiom on five lists** (tint + lift −1px + shadow) and **absent on two rows
   that open** (the practices shelf's doors; the feed's rows tint, but are not buttons).
6. **Density has no floor on the schedule** — 31px rows, and at 768 the row is a 736 × 31 control
   (under `--tap-min`; the "one schedule item at 768" the 09-07 sweep left red).
7. **Four 09-06 "lists" were never lists** (a form's rows, a checklist, a stepper, a menu) and one
   was measured against a class that had left the page (`railItem`).
