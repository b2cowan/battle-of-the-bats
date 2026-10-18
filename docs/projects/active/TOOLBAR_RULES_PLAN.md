# Toolbar Rules — every list's toolbar, one layout, one search, one shape language

**Ruled 2026-10-17** (owner, *"looks good"*, all asks as recommended) on the Search & Filter Rules mockup, round 4
plus its club section: https://claude.ai/artifact/SPjRTAB6kVqd9vJ8x1vuza **version 5** (the spec). The ruling is
recorded whole in `memory/design_decisions.md` (top entry, 2026-10-17 "EVERY LIST'S TOOLBAR …"). PM brief:
`TOOLBAR_RULES_PM_BRIEF.md`. Build prompt: `TOOLBAR_RULES_BUILD_PROMPT.md`.

Earlier the same day (context, not to redo): Results took the tournament line (`b966aff8`), Teams moved its search
right and Check-in took the shared line and lost its "still owe" line (`898f07e5`). Both commits stand.

## 1. The rules (the ruling, restated for building)

| # | Rule | Build test |
|---|---|---|
| 1 | **Left = which list.** The view choice (day, division, Needs you · All games, arrival buckets, the olive `lead` scope/view picker, a view switch) — or the list's count where there is no view choice ("24 drills", "2 of 24 drills" while narrowed). | Changing it swaps the whole list. |
| 2 | **Right = find, narrow, act:** Search, then filters, then Tools ⋯, after a deliberate gap (an auto margin). | A narrowing pill (`restQuiet`, plain face — the 10-07 "two faces" test) sits right of the gap. A `lead` pill sits left. |
| 3 | **Page actions stay where each portal keeps them, at the far right.** Tournament: the page header. Coach/club money screens: the toolbar's end, **Export · Tools · [lime add]** (Ledger Parity D6 — do not reorder). | No action moves between header and toolbar. |
| 4 | **Shape follows job.** Rounded (999px): view pills, the view picker (Schedule's Day pill), the olive `lead` pill, the view switch, Teams' division picker, the search field. Square-cornered (~8px, today's): Filter, Tags and every narrowing pill, Tools, Export, every button. | "Does it pick WHICH list, or is it typed into?" → rounded. |
| 5 | **One search field.** Rounded, magnifier, **16rem** on a desk. Height follows the room: 44px at every width in the coach practice and skills rooms (car-park rationale, `coaches.module.css` ~11634), the admin control height elsewhere (34 desk / 44 at ≤768). Phone: coach rooms give it its own full-width row; tournament toolbars keep the 44px square that opens a full-width field (10-12). | One shared component; no screen styles its own. |
| 6 | **One view pill.** Results' rounded lens pill, 38px, count in the lighter ink, olive when chosen. Check-in's arrival buttons take it on a desk (organizer's board AND the gate's — one board), sized to their words; both phones keep the four-up bar (count over word). | Every row of view choices with counts. |
| 7 | **The register exception.** THREE OR MORE kinds of filter shown as named pills **AND** a running figure those filters change → the filters get a row of their own under the toolbar, the figure at its right end. Today: the club Ledger and the coach's Ledger only. | Both conditions, or rule 2 applies. |

**Words:** every hint reads "Search <noun>…" and ends in "…" — **placeholder only**; the accessible name and the
"Clear …" label keep no dots. "Find a session…" → "Search sessions…". Grep the other spelling before adding any.

## 2. Screen by screen (the call list)

Tags as in the hub: **S** = search field, **P** = placement, **R** = rounding, **W** = words, **C** = count.

### Tournament admin
| Screen | Today | Change |
|---|---|---|
| Results | lens pills, gap, square field, Filter (`results/page.tsx` → `ScheduleToolbar`) | S, W |
| Schedule | Day pill, arrows, gap, square field, Filter, Tools (`schedule/components/ScheduleToolbar.tsx`) | S, W |
| Teams | division picker (square), gap, field, Filter, Tools (`registrations/page.tsx` ~1815) | S, W, R (the picker → rounded, keeps its waiting dot and amber count) |
| Check-in (+ the volunteer gate) | arrival bar (square, `components/volunteer/DayOfBottomBars.tsx` inline), gap, field, Filter (`components/admin/CheckInBoard.tsx`) | S, W, R (Rule 6 view pill on a desk for both boards; the gate's pinned phone bar and both phones' four-up bar unchanged). `DayOfFilterButton` is shared with the gate shell — the rounded face is a desk/inline variant, never the pinned bar. |
| Communication | `repKit.views` row | R (Rule 6) — shares the style with rep-team Tryouts |

### Club admin
| Screen | Change |
|---|---|
| Ledger | **Rule 7 — keeps its two decks.** R (Book `lead` rounds). Nothing else. |
| Allocations | P (the Due narrowing → right, before Send reminders · Export · New), R |
| Budget | R; P for any narrowing (classify When / Columns / Collapse all by the two-faces test — Columns and Collapse all are arrangement/verbs, not narrowings) |
| Budget vs. Actual | R; P for any narrowing (Compare / Showing — classify) |
| Payment requests | P (Team → right), C (a count on the left) |
| Accounting · Teams | R; P for any narrowing (classify Group) |
| Team statement | R (Team `lead`) |
| Calendar | P: Venue · Program · Team and the clash pill → right, before Export; the time-zone note stays with the dates (10-09). R (view switch). **Moves together with the coach schedule** (same toolbar, `components/coaches/ScheduleCalendarViews.tsx` ~733–800). |
| Venue library | R (view switch) |
| Rep team schedule | R (view switch) |
| Tryouts | R + Rule 6 (`repKit.views`: count lighter, not " · n" inline) |
| Schedule detail | P: the view switch comes down from the section head into the toolbar (left); Facility · Group · Team → right; R |
| Families (Stage 5b, in flight in another session) | S, P (search right of the Show pill), R, W "Search families…". See the amendment at the top of `CLUB_FAMILIES_BOOK_PLAN.md`. **Do not edit Families files another session holds uncommitted** — coordinate. |
| House league (Teams, Schedule, Standings, Registrations) | **Deferred** — legacy toolbars; take the rules when next worked on. |

### Coaches portal
| Screen | Change |
|---|---|
| Practice plans › Drills / Circuits / Templates | S (the shared field, 16rem, 44px), P (search moves right, Tags after it), C ("24 drills", "2 of 24 drills" — page only: **not** in the picker sheet or the 320px docked library, which keep a full-width search row, as a phone does). The Tags panel must right-anchor where Tags now ends the row (it left-anchors at ≤640 today — re-walk at 390). `components/coaches/LibraryRow.tsx` `LibraryFilterBar` ~261 and its three hosts. |
| Skills & Goals › Sessions | S, W ("Search sessions…"); stays right (`development/page.tsx` ~412). |
| Opponents book | S (it already wears `.scoutSearch`; gains the magnifier and 16rem; placement per rule 2). |
| The coach's Ledger (`accounting/expenses/panel.tsx`) | **Rule 7.** R only. |
| Every other coach list screen with a toolbar (roster, schedule, dues, fundraisers, awards, notifications, player development…) | **Stage 0 census decides** — check each against rules 1–6 and list the changes before building. |

## 3. Stages (each: build → `/review` → owner walk → commit; one commit per stage, explicit pathspecs)

- **Stage 0 · Census (no code).** Every list toolbar in the three surfaces against rules 1–7: one table (screen ·
  today left/right · changes by rule number). It confirms §2, classifies every club pill lead/narrowing, and fills
  the coaches portal rows. Present it to the owner before Stage 1; anything §2 did not foresee is an ask, not a build.
- **Stage 1 · The search field.** ONE shared component (memory: a shared component beats a shared class) with the
  room's height and the two phone behaviours; adopt it on every screen in §2 tagged S; retire `.scoutSearch`, the
  tournament `.searchField` look and the hand-rolled boxes (Sessions, Families when it lands). The words (W) ride here.
- **Stage 2 · Shapes.** Rule 4 and 6: the `lead` pill, the view switch, Teams' division picker, `repKit.views`, the
  Check-in arrival buttons' desk/inline face. These reach the coaches portal's matching pickers — census them in
  Stage 0 so the walk covers them.
- **Stage 3 · Placement.** Rule 2 and 1 moves: Practice plans, the club screens tagged P, the Calendar with the coach
  schedule, Schedule detail, the counts (C).
- **Stage 4 · Records.** The table standard's §3.9 already reworded (2026-10-17); add the exception register entry for
  Rule 7; `/docs` for any help text that names a toolbar position; the QA walks below; this plan's §10.

## 4. Guards (build-enforced, so the next screen copies the rule, not a neighbour)
- Extend `tests/unit/tournament-stage3-part7-guard.test.ts` (it holds Check-in and Teams on the shared line today) or
  add a toolbar-rules guard: every list search renders the shared field (no `type="search"` input styled locally in
  the scoped trees); narrowing pills never sit left of the toolbar gap outside the two Rule 7 ledgers.
- `npm run check:spelling` for the hint words; `check:css-selectors` for the retired classes.
- `check:layout --changed` per touched screen on the dev server (warm it first); never a whole-product sweep there.

## 5. Walks (QA ledger, one purpose per walk, checkable artifact)
W1 the search field on every screen (desk size, phone behaviour, words). W2 the shapes (rounded picks vs square
narrows; Check-in desk vs phone vs the gate). W3 placement (Practice plans, Calendar + coach schedule, the club
screens). W4 the ledgers unchanged except the rounded Book. Add them to the hub as a QA Walk tab.

## 6. Out of scope
House league's four legacy toolbars; the rep-teams list's native group select (noticed, not ruled); phone search
behaviour unification (Ask 5: phones keep what each side has); anything the Stage 0 census turns up beyond §2
(it becomes an ask).

## 7. Risks
- **Two shared pickers reach the coaches portal** (`lead` pill, view switch): a portal-wide visual change — the walk
  must cover the coach screens, not only the club ones.
- **The gate shares the Check-in board and its bar component** with the volunteer shell: the rounded face must not
  reach the pinned bottom bar.
- **Families is mid-build in another session.** Coordinate through its plan's amendment note; never edit its
  uncommitted files.
- Demo tours anchor on screens: the build fails if a tour anchor disappears — keep anchors on moved controls.

## 9. Stage 0 census — ruled 2026-10-17 (owner *"as recommended"*)
The census is the hub's **Census · Stage 0** section (version 6): every list toolbar in the three portals, the
two-faces classification, and asks C1–C9, all ruled as recommended (recorded whole in `memory/design_decisions.md`,
the 10-17 toolbar entry's census addendum). What it changes in §2 and §3:
- **Stage 1 adds:** coach Tryouts check-in (C8); the ✕ is named "Clear the search" everywhere (C9); the setup
  wizard's venue search and the practice editor's "Search practices or groups" gain "…" (C9). There was no shared
  search field to extend — the tournament phone behaviour lives in `ScheduleToolbar` with hand copies in
  `CheckInBoard` and Teams; Stage 1 builds the one component from it and deletes the unused `ToolbarSearch`.
- **Stage 2 adds:** the gate's desk boxes (>768) take the view pill, switched on by the Check-in board, never by
  `DayOfFilterBar` itself — the Scorekeeper wears the same bar and stays unchanged (C1). Roster's List · Depth chart
  and the player record's Goals / Results switch round (C7). The amber attention toggles stay rounded (C2). The
  olive picker's reach includes the Accounting Overview Year, the Payees window Year, the Venue library's Permits
  Year and Families' Show (the last one without touching its files).
- **Stage 3 adds:** coach Dues' Showing → right + the narrowing face (C4); coach Club money's and Notifications'
  status rows → the view pill, left; Notifications' Unread · All → right (C5); Insights › Results' tag chips → one
  Tag pill, right (C6); Opponents count + field right, Tryouts check-in field right (C8); Accounting Teams' Group and
  Awards' Award → right; the Calendar's time-zone note moves beside the dates at every desk width, as drawn.
- **Not changed (C3):** Budget Columns, BvA Compare / Showing, Collapse all. **Corrected:** the coach schedule has
  no filters — only its view switch rounds. **Left to its own project:** the coach Budget's "Manage categories"
  sitting after the lime Add line (Categories & Items door, uncommitted).

## 10. Departures
(Record here, with the reason, any place the build departs from the hub or this plan.)

**Stage 1 (built 2026-10-17; committed `56bfa9f9` 2026-10-18; walk §330 ✅ 9 of 9 2026-10-18):** `components/shared/SearchField` (the look, both rooms, both phone behaviours) and
`components/admin/tournament/useToolbarSearch` (the tournament line's desk field, phone square and open row, built on
it). Departures:
1. **The hint is derived, not a second word.** The build prompt asked for a placeholder-only word beside
   `SCHEDULE_DAY_WORDS.search`; the field instead makes its hint from its name ("Search teams" → "Search teams…")
   unless a caller passes one. Same result on screen, one string per field, and a future field cannot forget the dots.
2. **The ✕ shows on every field while it holds text** — the tournament desk field had none, the coach fields had
   the browser's own (Chrome only, unstyled). One drawn ✕, named "Clear the search" (C9), on every browser; on a desk
   it hands focus back to the field, on the tournament phone row it also closes the row (as before).
3. **Families joined Stage 1, with its placement.** Stage 5b was committed (`05eaa588`, 2026-10-17) while Stage 1
   was being built, so per the build prompt Families took the shared field here, and its search moved right of the
   Show pill (Rule 2) at the same time — on a phone it stays its own row, always open (no square). The retired
   tournament field (`.searchField` / `.searchClear` / `.phoneSearch`) then had no wearer and is deleted; the guard
   walks the tree for it.
6. **/simplify (2026-10-18):** the hint can no longer be overridden (always the name and "…"); the tournament phone
   row's placement lives in the toolbar sheet (`.phoneSearchRow`), not in the field; the practice library's Tags
   menu lost its page right-anchor and phone flip (search fills its own row wherever Tags would have ended a tight
   row, so the shared "opens where it fits" serves the page) and keeps only the dock's left pin; the practice
   editor's "Groups from another practice" window takes the field. **Kept:** the coach toolbar's one phone rule
   that lets a search take the line (moving the field out of the actions would strand it mid-row on a desk — the
   lede is capped at 64ch). **Left for a later stage:** the tournament setup wizard's venue search (its own field,
   only its hint dots were ruled, C9) and the rep-team link popover's search.
4. **The Opponents book's count and placement (C8) landed in Stage 1, not Stage 3** — its search IS its toolbar, so
   the field alone would have needed a spacing patch to be removed a stage later. Tryouts check-in's placement waits
   for Stage 3 as planned.
5. **Tryouts check-in's search gained an accessible name** ("Search name, bib or reference"); it had none.
