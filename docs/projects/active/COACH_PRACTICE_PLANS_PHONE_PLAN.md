# Practice plans on a phone — building and running a practice at phone width, re-evaluated

**Created:** 2026-09-23 · **Owner:** product owner · **Hub (walk · stage drawings · plan · brief · QA walks, one artifact for the project's life):** `docs/projects/active/COACH_PRACTICE_PLANS_PHONE_HUB.html` — published as a Claude Artifact at `https://claude.ai/artifact/73DbeziBqDjMr4QEhRWTvp` (republish the same file path to stack a version).
**PM brief:** `COACH_PRACTICE_PLANS_PHONE_PM_BRIEF.md` · **TODO:** one line under the coach portal group, beside "Coaching from a phone" · **Ledger:** no § until a stage is built (a planning entry is not a §).

> **One stage at a time.** Each stage: drawn at true size on the hub → owner rules (paste-back) → build → `/review` → QA walk added to the hub → owner QA → next stage. No stage starts before the one before it is ruled.

## 0 · What this is, and where it picks up

A phone-first re-evaluation of the two screens a coach **builds** and **runs** a practice on — the plan editor and the field screen — in the shape of the phone programme (`COACH_MOBILE_EXPERIENCE_PLAN.md`): a measured walk, shape questions for the owner, a stage ladder drawn, ruled, built and walked one stage at a time.

It picks up exactly where two projects stopped, on purpose:

- **The phone programme's stage 4** collapsed the toolbar above the plan and named "the practice plan's sheet itself" as not reopened (§10.5 there). The editor under that toolbar was never drawn for a phone.
- **The practices re-evaluation** (`COACH_PRACTICES_REEVALUATION_PLAN.md`, stages 0–7) built the editor and drew every one of its screens on a desk; its phone notes are floors and reflows, not a design.

The owner's ask (2026-09-23, on four phone screenshots): *"we are wasting so much screen space with our left margin on the edit screen … most of the areas where we type things can barely fit a couple of words … tons of scrolling required which makes me lose my place in the plan … the running is pretty good."*

## 1 · Method

2026-09-23, `dev`, signed in as the UAT head coach, the **UAT probe practice** on the UAT Test Team — a written plan: a plain block (Warm-up · 15 min · six players), a rotating block (Skills circuit · 45 min · three stations · three drawn groups), a rest-of-practice block. The practice is a record (past), so the probe entered edit mode through the "⋯" drawer's *Edit the plan* — the same editor a live practice renders.

Playwright drove a 390×844 phone context (touch, DPR 2) and a 360×780 context through: the plan page with every block shut; block 1 open; block 2 open; the "Add a station" sheet and its "Write one" tab; an existing station's form; the groups room; the run screen's list; a rotating stop; a station; a plain stop. Per screen the browser's own geometry was read (never a screenshot): page height, every field's width and the characters it holds, the open block's height, how far the next block moved, sideways scroll, controls under the 44px floor, pinned chrome, and where the field's buttons sit against the fold (the 735px between the 37px team line and the 72px bar at 390). Screenshots were taken as reference for the drawings only. Probes: `.probe/pp-phone-measure.mjs` (390 and 360), `.probe/pp-station-modal.mjs`; the JSON records sit beside them.

⚠ **One thing the probe did to the fixture, and undid:** pressing "Write a station" on the "Write one" tab **adds a blank station card** to the block (it does not open a form) and the plan autosaved with it. On reload the blank station was not in the plan (a station with no name and no words is dropped on the way through), and the stations read Footwork ladder · Close control · Finishing before and after. The fixture is as found.

## 2 · Findings, by station (the hub's walk tab is the record)

| Station | Measured at 390×844 | Finding |
|---|---|---|
| A · The plan, blocks shut | Page 1,650. The timeline is 326 wide: a **92px** clock column (11px data face), a 2px spine, 234 for the row. A shut block is **117px** — title, a cut sentence, a cut "Watching for", who. The "Add a block · 15 min · or a drill from your library" row is **130px** (its words wrap in 234px). The first block sits at ~535. Pinned: the team line 37, the bar 72. | Three blocks cost 351px and say two cut sentences each. The row was drawn for a ~700px desk column. |
| B · A plain block, open | Page 1,650 → **2,546**. The open block is **1,013px** tall in a **228px** column that starts at x=146. Writing fields **197px** (~28 characters a line); the title **106px** (~15 — "Small-sided game" is 16); the five minutes chips wrap to two lines; six player chips take six lines; "Watching for" is a one-line box. Block 2 moves from 651 to **1,546**. | The form is nested three deep — sheet, spine, card — and each layer takes its padding; the writing column is the remainder. The 92px column is that wide because the ▲▼ reorder pair (two 44px buttons) sits under the clock at ≤640; the clock alone needs 66. |
| C · A rotating block, open | Page → **3,263**; the block **1,729px**. Three stations as 115–138px rows in a 197px column, each with its own reorder pair; "+ Add a station / a drill, or write one" wraps to 67px; the rotation grid is **404px wide inside a 197px box** — the page's only sideways scroll; "Edit groups ›" at 2,206. | The rotation cannot be read without scrolling sideways inside a card inside a page. |
| D · A station | An existing station's "Open ›" opens a **full-screen form** (`role="dialog"`, 390×844): fields **359px** (~51 characters), the name 296, an eyebrow "Footwork ladder — station 1 of 3", a foot with **Delete this station · ‹ (No previous) · Next: Close control ›**. Adding one: the "Add a station" sheet is full-screen (tabs 44, drill rows with "+ Add", search, Tags); "Write one" is a sentence and a **31px** lime button that adds a blank card — a new station's first field is **four taps** in. | **The form is the shape stage 1 proposes for the block, already built one level down.** Stage 2 owns the new-station path and the station rows. |
| E · The groups room | Full-screen, a pinned foot (+ Add a group · Done), 21 controls all at 44; scrolls 893 in 677. | Keep — the one editor screen drawn for a phone. |
| F · The field | The list **916** — one screen, rows 61–83, "Who's here tonight" at 631. A rotating stop: Back · Rotate now at **473**, all on screen one. A plain stop: at 563. A **station**: 1,156 tall, Rotate now at **996** — 224px under the fold. | Good, as the owner said. The station screen buries its button; a longer plan buries the block screen's too — the fixture (8-word notes, three stations) is a floor. |

**360×780:** fields 167px (~24 characters), the title 76 ("Skills circuit" is cut), the open block 1,080, the station's Rotate now 308 under the fold. Nothing broke; every screen 5–8% taller.

## 3 · Standing back (S.1–S.5)

- **S.1 The editor is nested, and nesting is the cost.** Sheet → spine → card → field: each layer takes its padding and the writing column is the remainder (197 of 390). The fix is not thinner padding; it is taking the form out of the timeline on a phone.
- **S.2 A form that grows in the flow moves everything under it.** A form on its own screen moves nothing; the list is where the coach left it.
- **S.3 A cut sentence is not information.** The row carries the facts that fit (length · who · stations); the sheet carries the words.
- **S.4 What already fits a phone is left alone.** The station form, the station sheet, the groups room, the run list and its stops were drawn for a phone and measure like it — and the station form is the template for the block.
- **S.5 At the field the thumb is busy.** The one control that moves the practice on sits where the thumb is, docked, never under the fold.

## 4 · Standing rulings this plan works inside (not reopened)

The plan as a document (practices stage 1, 2026-09-14); "+ Stations makes two" (D13); the grid as a starting point (D14); drag as an addition, buttons everywhere (L2); no clock at the field (P10); the run list as the first screen (W1–W4); the record's face (R2 — a past practice's rows open to read); the phone programme's shell, the transient Saved pill (A3), the field floor (A4) and E1's one-row toolbar; the tap floor as a touch-only rule and the 641–768 band; the portal's phone-panel conventions (a drawer flush to the bar, the warm scrim, Escape / scrim / the phone's Back all close, the foot on the shared clearance token). The desktop and the tablet band keep the timeline with the block open in place at every stage.

## 5 · The stage ladder

| Stage | Covers | Asks | State |
|---|---|---|---|
| 1 · The block on its own screen | The plan's blocks as a compact list on a phone (the spine and the clock stay; the row is title + one line of facts; 56px); a block opens as a **full-screen sheet** — the station form's shape — with every field at full width and a pinned foot (‹ N of M › · Done); Move up · Move down · Delete on the sheet's head; "+ Add a block" as one 44px row that opens a blank block's sheet with "Start from a drill ›" inside it. | K1–K4 | **drawn 2026-09-23 · RULED 2026-09-23 — K1–K4 = A as recommended** |
| 2 · Stations and the rotation | A station as a 56px row inside the block sheet (the row is the door to the form that exists); "Write one" adds the station *and* opens its form in one motion on a 44px button (four taps → two); the rotation table fitted to a phone — **drawn 2026-09-24 (§6d), T1–T2 ruling owed**; the earlier "by round" note is withdrawn (it is §6d's option D); hand-arrange stays the tap menu (D14); the desktop grid untouched. | L1–L2 · T1–T2 | rotation table drawn 2026-09-24 |
| 3 · The field | Back · Next · Rotate now docked above the bar on the block and station screens (the E4 idiom; the bar on the clearance token, never above the nav); the station screen's "Coming to you" kept; a plain stop's order (does the note lead, or the watching-for line and the points?); swipe between stops as an addition — recommended *Not yet* (gloves; the browser's back gesture; the docked buttons take most of the value). | M1–M3 | — |
| 4 · The head of the page | What sits above the first block on a phone: the sent line and "Send again" (~110px), the when-block, the goal, About — ~500px before the plan begins. Drawn unchanged in stage 1 on purpose so stage 1's own gain is not hidden. | N1 | — |

## 6 · Stage 1 — The block on its own screen (drawn 2026-09-23)

The drawing is the hub's **"1 · The block on its own screen"** tab: the whole screen before and after (the Skills circuit open in place, as built, beside the plan as a list), the sheet's top and its foot, every red dot a measured problem and every green dot what the drawing answers, and the four decisions with a paste-back.

### 6.0 Rulings (owner, 2026-09-23 — *"I agree with your recommendations"*: K1 = A · K2 = A · K3 = A · K4 = A)

- **K1 · the list** — A (recommended): keep the spine and the clock; the column narrows 92 → 66px as the reorder pair leaves it; a block is a 56px row, title + one line of facts (`Warm-up · 15 min · UAT Coach · 6 players`), a chevron, the whole row the door. B: the portal's row list with the time as an inline lead (the Schedule's phone shape; not drawn). C: keep one truncated sentence (measured never to complete at 390).
- **K2 · the block opens on its own screen** — A (recommended): the sheet — full width, its own header, the list untouched behind it, a pinned foot with ‹ 2 of 3 › and Done; the station form already opens exactly this way. B: stay in place and narrow the margin — honest arithmetic: fields 197 → ~223 (+13%), the block still ~1,000px in the flow.
- **K3 · reorder** — A (recommended): Move up · Move down · Delete as three 44px squares on the sheet's head; the desk keeps its gutter pair. B: a Reorder mode on the list with drag handles.
- **K4 · adding a block** — A (recommended): "+ Add a block" opens a blank block's sheet with "Start from a drill ›" under the title (one tap to the common case). B: a chooser first — Write one · From your drills.

### 6.1 Measured before → drawn after (390×844)

| | Before | After (drawn) |
|---|---|---|
| A shut block | 117px | 56px |
| Three shut blocks + Add a block | 481px | 212px |
| A writing field | 197px · ~28 chars | 358px · ~51 chars |
| The title field | 106px · ~15 chars | 358px · ~51 chars |
| Minutes chips | 2 lines | 1 line (390 and 360: 5×40 + 80 + gaps = 320 / 328) |
| Six player chips | 6 lines | 2 lines |
| Block 2's row when block 1 opens | moves 895px | moves 0 |
| The page with one block open | 2,546 | unchanged; the sheet scrolls on its own |

"Drawn" values follow from the drawing's own geometry; the build re-measures every one in the browser before the walk.

### 6.2 What holds, by construction

- Nothing is renamed and nothing is gated differently: the sheet renders the same fields, in the same order, through the same permissions as the open card; a viewer sees the read face in the sheet, a writer the form; the record's rows open to read in the same sheet with no ▲▼🗑 and the ‹ › still walking the blocks.
- Autosave is unchanged; the transient Saved pill appears over the sheet on an edit and fades; only an error persists.
- The desktop and the 641–768 band are untouched.
- Escape, the scrim and the phone's Back close the sheet (the portal's phone-panel convention).
- The plan-template editor is the same editor and inherits the sheet by construction.
- The rotation grid is still the desktop grid in stage 1 — 404px in a 358px box, scrolling a little. Drawn honestly; its fix is drawn in §6d.

### 6.3 Build notes, for the session that builds it (after the ruling)

- **≤640 only, decided in JS** by the portal's phone hook (`useIsPhone`, as the Schedule's sheet and the practice toolbar decide it) so the sheet is never rendered on a desk; the desk keeps every rule it has.
- **The list:** the timeline's shut row loses its two sentence lines and its gutter pair at ≤640 and gains a chevron; the gutter variable drops to the clock's width in the ≤640 block (the 5.75rem rule and its comment go with the pair). The row is a button as today.
- **The sheet:** the "Add a station" sheet's construction (its own header, the body the scroller, `role="dialog"` on the portal's dialog floor, the foot on the shared foot-clearance token — never a hand-copied 16px, the stage-4 lesson) hosting the same field components the card renders today (`PracticeFields`, the pickers, the station column, the doors). The head carries ✕ · the eyebrow ("Block 2 of 3 · 11:00 p.m.") · Move up · Move down · Delete; the foot carries ‹ N of M › and Done; ‹ › change the open block in place (the block index is the sheet's state, never the URL — "edit is a visit", stage 6's rule). Done returns to the list with the row focused.
- **"+ Add a block"** is one row at the list's foot that creates the block (15 minutes, as the ghost row does) and opens its sheet; "Start from a drill ›" inside the sheet opens the existing picker sheet over it (a sheet over a sheet — the RSVP-over-event-sheet precedent: the inner one closes first).
- **The pickers' dropdowns** hang below their inputs in absolute position and must not be clipped by the sheet's scroller — the card deliberately has no `overflow: hidden` for this reason (its comment says so); the sheet's body needs the same care or a portal.
- No migration, no new route, no year parameter (`HISTORY_ENDPOINTS` untouched); the closed-season reader renders the record's face in the sheet through the same route.

### 6.4 Verification at build

- **Unit:** a source guard for the ≤640 row (no sentence lines, no pair, a chevron) and the sheet (the same field set as the card, asserted by name; the foot on the clearance token; ‹ › bounded at the ends; the record face with no ▲▼🗑); the vocabulary guard untouched.
- **`check:layout --only=`** the plan page (shut), the plan page with a block open, a new screen for the sheet open, and the template editor, at 361/390/768/1440; `check:css-selectors` before calling it done (this stage retires the phone's gutter-pair rule).
- **A hit-test, not a look,** on the pinned foot at rest and mid-scroll at 390 and 360 with the keyboard closed; the Saved pill over the sheet (z-order against 250/260); Escape / scrim / Back.
- **Driven by hand at 390 and 360:** write a three-block plan from blank without returning to the list; open a past practice and read its blocks through the sheet; a picker dropdown inside the sheet not clipped.
- A **"QA walk · 1"** tab on the hub at build time, its § number from the ledger.

### 6.5 Built as (2026-09-23 · dev · every number read from the browser's own geometry — probe `.probe/pp-stage1-after.mjs` at 390 / 360 / 1440) — **ledger §227, walk owed; committed 2026-09-23 with its /simplify + /review fixes**

**Measured after, 390×844:**

| | Before | After (measured) |
|---|---|---|
| A shut block | 117px, two cut sentences | **59px**, title + one facts line, nothing cut (`Warm-up` / `15 min · UAT Coach · 6 players`) |
| The clock column | 92px | **80px** (5rem — the proven clock-alone width; the drawing's 66 would have cut "12:00 p.m.") |
| Three blocks + the add row | 481px | **221px** |
| A writing field / the title | 197 / 106px | **359 / 359px** (329 at 360) |
| Block 2 when block 1 opens | moves 895px | **moves 0** |
| The sheet's foot | — | Previous · Next · Done all 44px, **pinned at 783** at rest and with the body scrolled to its end |
| Desktop 1440 | — | **unchanged**: rows 117px, the pair under every clock, the block opens in place, no dialog |

**What was built.** `BlockSheet` (new, in the editor) is the station form's construction — the
portal modal with `.ppStationModal`, `useDialogFloor` with the block walk bound to ← / →, the
shared `CoachModalHeader` carrying a two-line eyebrow (the place, then the clock — never uppercased,
the clock rule) and Move up · Move down · Delete, the body `scrollPane`, and a `.modalFooter` with
`RoomWalkNav` and Done. `BlockCard` gained `phone` / `sheet` / `onStartFromDrill`: its open body is
built ONCE (`titleEl` + `body`) and rendered either inside the timeline card (desktop, unchanged
markup) or inside the sheet; the sheet's body wrapper keeps the `.ppTlOpen` class (so every field
rule written for the open block reaches it) and drops the card's look. The editor decides
`phoneSheet = useIsPhone(!soloBlock) && !soloBlock`, renders every timeline block SHUT on a phone,
mounts the open one as the sheet BEFORE the station modal / groups room / picker / drill sheet, and
wires both from ONE `blockCardProps(block, i)` so the row and the sheet cannot drift. The body is
keyed per block (a picker's typed-but-unchosen search starts fresh on a step), the panel is not (the
floor, its focus rule and its history step stay armed across the walk). The sheet enrols in
`useOverlayOpen`. K4: one `.ppTlAddRow` once the plan has a block; the blank plan keeps its lime
ghost row. "Start from a drill ›" shows only on a just-added, still-blank block and swaps it for the
drill sheet's own new-block path. No migration, no route, no year parameter.

**Found and fixed on the way:**
- ⚠ **The new block's title lost the cursor in the dev build.** `autoFocus` fired, then the dialog
  floor's StrictMode double-mount cleanup handed focus back to "+ Add a block" and the re-mount
  seated it on the panel. An effect in `BlockCard` (a parent's effects run after its children's)
  now focuses the title last, in either build.
- ⚠ **The layout sweep measured the WRONG dialog when two are stacked.** `openModal` took the FIRST
  visible `aria-modal` dialog — the block sheet — so the station form over it read as a fixed bar
  covering 20 controls. It now takes the LAST (the one the user is in; every stacked floor mounts
  after its host). A sweep fix, not a product one: the product's keys, Tab and Back already answer
  only the top floor.
- ⚠ **A probe's delete was lost to the autosave debounce** — the browser closed inside the pause and
  two blank blocks stayed on the fixture; removed and proven by reload. The after-probe now waits
  for the Saved pill and reloads before it reports.
- The sweep's `openFirstBlock` waited on the in-place card's "Close <block>" — it now waits on
  whichever presentation the width draws.

**Deviations from the drawing, stated:** the clock column is 80px not 66 (above); the foot's walk
is the shared `RoomWalkNav`, so it names the neighbours ("‹ War…" / "Small-sid… ›") where the
drawing showed a bare "‹ 2 of 3 ›" — the same control the station form's foot uses; at 360 a long
row's facts WRAP (79 / 108px) rather than truncate — the no-truncation rule held over the height
target; the five quick-length chips sit on one line with the minutes box, "Rest of practice" and
"ends …" wrap to a second (the ≤640 clock-row rule, unchanged).

**Verified:** typecheck clean · eslint 0 · unit **4,631 / 4,631** (new
`coach-practice-plans-phone-guard.test.ts`, 11 cases; one `practice-vocabulary-guard` assertion
updated to the widened drag gate) · `check:css-selectors`, `check:spelling`, CSS-module purity
green · `check:layout --only=coach-practice-plan,coach-practice-station,coach-practice-record-open`
clean at 361 / 390 / 1440 (768: the header "?" — the known touch-debt entry, now also recorded for
the station screen where it predated this change) · driven at 390 / 360: the sheet's walk, Escape
back to the row, add → title focused → delete → reload shows the plan as found.

**/simplify + /review (2026-09-23, high-risk tier: 4 cleanup lenses, then 4 finder lenses; `verify:changed` green, 4,634 unit):**
- /simplify applied: the sheet's walk now uses a shared `blockWalk` beside `stationWalk` (the same `roomNeighbours` arithmetic, unit-tested at the ends); `BlockSheet` derives first/last/can-move from the walk instead of three duplicate props; one `canAddBlock`/`phoneAddRow` pair instead of a hand-negated condition; a dead `&& !soloBlock`. Skipped with reasons: extracting a shell shared with `StationModal` (reshapes a component outside this change — a follow-up); a first-tag-name micro-optimisation (a handful of blocks); moving the title-focus fix into `useDialogFloor` via `[autofocus]` (React does not render that attribute on the client — the proposed fix would find nothing).
- /review — **four confirmed, all fixed:** ⚠ **(High, data loss)** "Start from a drill ›" judged a block blank by title/stations/words only, so players, staff, a length or coaching points set before a title were discarded by the swap — now `isUntouchedNewBlock` requires every field to be as `addBlock` made it (a field the type grows later counts as work by default). **(Medium, a11y)** deleting a block from its own sheet restored focus to that block's deleted row (focus fell to `<body>`), and closing after a walk returned focus to the FIRST row opened — the editor now focuses the row of the block last shown, else the add row (both add rows carry the marker, so deleting the ONLY block lands on the blank plan's lime row). **(Low)** a blank block moved before "Start from a drill" re-landed at the end — the drill sheet now carries the position. **(Low)** a template's clock-less gutter printed "Rest of practice" into the 5rem phone column — it says "rest", the dated gutter's word. Refuted/clean: Back with a stacked station form closes only the top; stepping pushes no history; the overlay lock does not double-register; read-only viewers get no Move/Delete/add; the desktop title markup is identical.
- **Noted, not changed:** "Start from a drill ›" disappears once the coach steps away from the new block and back (the fresh flag clears on any step — discoverability, not data); rotating a phone across 640 with a block open unmounts the sheet into the desk card — worth one real-device check on the walk.

**Not verified, and why:** `coach-practice-groups` could not be swept at any width, desktop
included — the probe practice has aged into a RECORD (read-only, so no "Edit groups ›"); the fixture
wants its usual re-seed, which is not this change's. The help article still describes "the arrows
under each block's start time … on a phone" — `/docs` owed.

## 6c · The Groups room on a phone (drawn 2026-09-24 — **RULED 2026-09-24: G1 = A · G2 = A · G3 = A**, owner: "I agree with your recommendations")

Hub tab "The Groups room on a phone". G1 the draw folds to one summary line once groups exist ("⤮ 3 groups · from who replied · Change ›", opens in place, never redraws by itself; a block with no groups opens with the controls showing). G2 a group's head is "Group A · 4" + ⋯ (Rename in place · Delete, players to Not in a group, no question). G3 the ⠿ dots leave the chips and their sides tighten (tap for "Move to…", hold to drag, 44px, unchanged). Phones only. Build not started.

## 6d · The rotation table on a phone (drawn 2026-09-24 — **RULED 2026-09-24: T1 = A · T2 = A**, owner: "I agree with your recommendations, go ahead"; built on dev the same day — §6d.1; ledger §229)

The owner's question at the same message was the ROTATION TABLE under a rotating block, not the groups room. Hub tab "The rotation table on a phone": five live specimens (today · A · B · C · D) drawn from one data set, switchable 390/360 · reading/editing · 3/4/5 stations · hand-arranged (a shared station, an empty one, a group sitting out).

**Measured today** (probe `.probe/pp-rot-measure.mjs`, the UAT probe practice's Skills circuit): 390 reading 359 in 359 (fits, just); 390 editing 404 in 359 (45 cut); 360 reading 352 in 329 (23 cut — the table's `min-width: 22rem` alone); 360 editing 404 in 329 (75 cut). Finishing is the cut column every time. **No swipe hint** — `.ppGridScroll` is a bespoke scroller, not `CoachScrollX`, so the portal's "a sideways table says so" rule is broken here. Rows 52 reading (the clock breaks onto two lines in its 4.5rem column) / 58 editing; heads two lines reading, one editing — the same table takes two shapes.

- **T1 · the shape — A recommended: today's table, tightened, phone only.** Keeps D6's orientation (and the desk's). Drops the 22rem floor; the clock on two lines in a ~52px column; while editing a group is a tile, not a pill with a grip (T2); `CoachScrollX` with its hint when it must still swipe ("Swipe the table to see every station"). Drawn: 3 stations fit at both widths in both modes; 4 fit at 390 both modes and at 360 reading; 5 fit at 390 reading. Shortest shape in every combination (−3 to −84px vs today, drawn). Cost: station names wrap to 2–3 lines in capitals at 4–5 stations; who runs a station stays in the cards above. **B** turn the table (stations down the side, who-runs-it on each row) — drawn expecting it to fit more; it fits LESS, because a station name's longest word needs a wider column than a two-line clock: it swipes at 4 stations while editing at both widths, and would turn the phone's table opposite to the desk's. **C** each station carries its own evening (no table) — nothing swipes, the whole-rotation picture is gone, +260–1,000px while editing. **D** a list per round — the plan's earlier stage-2 note, WITHDRAWN: tallest in every combination, repeats every station name every round, and turns a comparison into cards (the portal's table rule: a comparison stays a grid).
- **T2 · a group while editing — A recommended: the cell is the button** (a soft 44px tile, no outline pill, no ⠿); tap for the same menu ("Move to <station> · Sits this round out"), hold-to-drag within its round kept. Part of why 4 stations fit at 390. B keep the pill.
- **Not changed:** the desk and 641–768; `computeRotation`; the statements (D25); the menu words; "Back to the standard rotation ›"; the groups read-back and "Edit groups ›"; Run practice.
- **Side finding, fix with it:** at ≤640 `.ppClockSep { display: none }` (meant for the block's clock row) hides EVERY `ppClockSep` in the practice screens, so the groups read-back renders "Group A#1 Avery Test" and "Not in a group#2 Blake Test" (visible in the owner's 09-24 screenshot). Scope that rule to the clock row.

### 6d.1 Built as (2026-09-24, dev — probes `.probe/pp-rot-after.mjs` at 390 / 360 / 1440 and `.probe/pp-rot-desk-edit.mjs`)

| | Before | After (measured) |
|---|---|---|
| 390 reading | 359 in 359 | 359 in 359, rows 49 |
| 390 editing | **404 in 359 — Finishing cut** | **359 in 359**, rows 55 |
| 360 reading | **352 in 329 — cut** | **329 in 329**, rows 49 |
| 360 editing | **404 in 329 — cut** | **329 in 329**, rows 55 |
| A group while editing | 82px pill with a ⠿ grip | 69×44 tile, radius 0.55rem, the field ground, no grip; the menu unchanged (Move to … · Sits this round out) |
| The clock column | 72 reading / 91 editing | 46 — "11:00" over "p.m." |
| Groups read back | "Group A#1 Avery Test" | "Group A · #1 …" |
| Desk 1440 | — | unchanged: `.ppGridScroll`, fixed equal columns (225), the pill with its grip, no hint |

**What was built.** ≤640 only, all in the stylesheet except the scroller: a `@media (max-width: 640px)` block after the grid rules — `.ppGridCols` (and with `.ppGridPills`) `table-layout: auto; width: 100%; min-width: 0`; tighter cell padding; headings wrap between words only (`overflow-wrap: normal`, so min-content never collapses a column to a letter) and centre over their cells; the clock column `width: 1%` (its min-content, so it breaks at its space); group cells `nowrap`; `.ppGridCols .ppGridTile` (two classes deep — it must out-rank `.triggerChip` from another module) and `.ppGridCols .ppGridGrip { display: none }`. `GridPill` passes `triggerClassName={styles.ppGridTile}` and a classed grip. `CoachToolbarMenu` gained an optional `triggerClassName` (appended after the variant's classes; documented). `RotationBoard` asks `useIsPhone(!withoutPeople)` once and on a phone wraps the grid in `CoachScrollX` (hint "Swipe the table to see every station", `frame={false}`); the desk keeps `.ppGridScroll`. The separator fix: `.ppClockSep { display: none }` → `.ppClockRow .ppClockSep`. Guard: `tests/unit/coach-rotation-grid-phone-guard.test.ts`. Help: the phone section gained a "rotation table" line and search words.

**/simplify + /review (2026-09-24, before commit) — three confirmed, fixed:** (1) the tile at `.ppGridCols .ppGridTile` (0,2,0) lost to `.triggerChip:hover:not(:disabled)` (0,3,0) — a phone keeps `:hover` on a tapped button — so each tile state now also names its `:hover:not(:disabled)` twin (probe `.probe/pp-rot-tilehover.mjs`: rest = hovered = after-close); (2) scoping `.ppClockSep` un-hid the rotation strip's dots, which are FLEX ITEMS in a wrapping row and stranded on a wrap (probe `.probe/pp-rot-strip.mjs`) — `.ppRotStrip .ppClockSep` joins the minutes row's hide; (3) help "always fit" → "usually fit". Simplify: `.ppGridCols, .ppGridCols.ppGridPills` → `.ppGridCols` (the later equal-specificity rule already wins); `functionBody` + `splitPhoneCss` promoted to `tests/unit/_source-code.ts` (older guards keep their copies — not this change's files). Refuted: the wrapper swap remounting the grid when `phone` flips (the open block already moves between `BlockSheet` and the in-place card at the same breakpoint); the tile enlarging the drag surface (69px vs the 82px pill).

**Not measured on the product:** 4 and 5 stations (the fixture has 3) — the drawing's specimens cover them (A: 4 fit at 390 in both modes and at 360 reading); the hint's appearance there is `CoachScrollX`'s own. The layout sweep's grid screens still cannot run — the probe practice has aged into a record (fixture re-seed owed, not this change's).

## 7 · Not in scope

- The desktop and the 641–768 band — every drawing here is a ≤640 form.
- The rulings that decide what a plan *is* (section 4). This project reads those screens as phone screens only.
- The library pages (drills · circuits · templates) and the Skills & Goals session. One note stands from the Schedule stage: the library's "+ ▾" still wears its chevron on a phone — a one-line owner call, not taken here.
- Money; the between-seasons page; the demo sandbox's phone chrome.
