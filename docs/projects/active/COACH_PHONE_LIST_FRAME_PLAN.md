# Phone lists in one frame — plan

**Status:** drawn 2026-09-29 (hub `COACH_PHONE_LIST_FRAME_HUB.html`, captures from the live dev
product at 390 and 360). **Every ask RULED 2026-09-29** — P1 · R1 as drawn; R2 no call button on the
phone roster; D1 a depth-chart player opens full-screen; D2 **Previous and next** (over the drawn
Next alone); D3 the Best order drags on the portal standard; M1 as drawn. **Built on dev 2026-09-29
in one pass** (§6), revised on the walk the same day (§6 "And" notes); **owner QA walk §248 ✅ PASSED
2026-09-29** on the owner's word; **committed `61993de7` 2026-09-29**. No migration.
PM brief: `COACH_PHONE_LIST_FRAME_PM_BRIEF.md`.

## 1 · Why this exists

The owner, looking at Roster → List on a phone beside the Schedule's list view: *"didn't we update
our design rules to move away from these spaced tiles towards more of an inline table look?"*

**Half.** The desktop rule is settled: *a row is not a card* (standard §3.10.2, ruled 2026-09-16).
The phone rule never moved. The standard still says a LIST becomes cards at ≤ 640 (§3.8) and names
"a roster" as its example; §3.10.8 says every row list becomes row-cards. The framed phone form the
Schedule shows was added 2026-09-20/21 as a per-list **opt-in** (`CoachRowList phoneFrame`), and five
lists took it: the Overview board, the Schedule list, the event sheet, the attendance room, the
calendar's day list. Everything else kept the default. So the roster is not a straggler. It
follows the rule as written, and that rule is out of step with every side-by-side the owner has
ruled (the Overview's grey tiles, B5 2026-09-21; the Schedule's one frame, C1 2026-09-21).

## 2 · What was measured (2026-09-29, `.probe/rtl-capture.mjs`, `.probe/rtl-sheets.mjs`)

Every team screen captured at 390 × 844 (touch, the UAT coach on the UAT Test Team). The roster read
was rewritten **in the browser only** for the roster and depth chart: fictional full-length
surnames, positions, and a guardian phone on every player, the worst case for fitting a row.
Nothing was written. "After" = the same live page with the proposed phone rules applied in the
browser (the CSS a build would ship).

| Screen | Rows | First screen (390) | List height |
|---|---|---|---|
| Roster → List | 12 | 11 → **12** | 634 → 561 px |
| Roster → List at **360** | 12 | 10 → **11** | 634 → 576 px |
| Roster → Depth chart (every player closed) | 12 | 8 → **11** | 750 → 568 px |
| Practice plans | 6 | 4 → 4 | 585 → 530 px |
| Lineups | 6 | 3 → 3 | 551 → 498 px |
| Insights → Scouting Book | 6 | 6 → 6 | 504 → 448 px |
| Lineups → Templates → Apply (a list in a sheet) | 7 | 7 → 7 | 575 → 495 px |
| Money → Player Dues (one family open) | 16 | — (below the tiles) | 1,188 → 1,042 px |
| Insights → Development (Coverage) | 12 | 9 → 9 | 534 → 530 px (rows raised to the 44px floor) |

**The honest read:** this is a consistency change, not a density one. The gaps cost 10–15% of a
list's height. The roster's first screen gains one player at 390 and at 360. (v1 drew a call column
beside every name; at 360 long names then wrapped and the first screen LOST a player, 9 against 10.
R2 removed the column and the trade-off with it; only a very long hyphenated name still wraps.)

### The survey: which phone lists are gapped cards today

Found **by eye** from contact sheets. A detector was tried first and missed Player Dues, the
lesson F-17 already recorded.

- **Short records, no labelled lines → the frame:** Roster, Depth chart, Practice plans, Lineups,
  Lineup templates and their Apply picker, Scouting Book, **Player Dues**, **Insights →
  Development**, the practice libraries (Templates · Circuits · Drills), and (not rendered on the
  fixture) Lineup Check and the inning panel inside the builder.
- **Records with labelled lines → cards stay:** Money → **Ledger** (DATE · CATEGORY · ITEM · MONEY
  IN/OUT · BALANCE per entry) and Money → **Club** (FILES UNDER · AMOUNT · STATUS).
- **Not records (bin C, out of this rule):** the Settings shelves, dashboard tiles, the
  next-practice / next-game card.
- **Already framed:** Schedule, Overview board, Staff, the tryouts checklist, Money → Overview,
  Budget Plan, every Insights report table.
- **Unverified:** Money → Fundraising and Budget vs. Actual rendered blank in the capture run (the
  dev server was restarted by another session mid-run). Captured at build.

## 3 · The proposal

### P1 · The rule (amends standard §3.8 and §3.10.8)

> **On a phone, records sit in ONE frame.** A table whose columns fit stays a table (S.7,
> unchanged). A row list keeps its frame. Rows are separated by the hairline and are never
> separate cards; inside a card or sheet, the hairlines sit in that card. **Separate cards only
> where each record carries labelled lines**: a label per value is what earns a record its own
> edge. A row that opens a **form** opens it full-screen with a back arrow; a row that opens a
> **short read** folds in place, its detail on the paper tone.

### Per surface

- **R1 Roster → List becomes the phone table.** `# · Player · Positions`. The grip and
  Family columns hide below 640 (Family: owner ruling 2026-08-26, unchanged; reordering is a
  desktop job, 2026-08-26, unchanged). The heading row shows. The name may take two lines (S.7),
  never an ellipsis (§3.4). An empty position shows the dash (the desktop's "+ Add a position"
  prompt is not drawn in a phone cell; the nudge above the list already counts them). The whole
  row stays the door to the player (hub F06).
- **R2 The call button — RULED 2026-09-29: removed from the phone roster.** Owner: *"the coach
  will go here many times to record metrics etc. and often will just have parents numbers on
  their phone and if not, can go into the profile to get contact details."* Reverses the
  2026-09-13 ruling that added it (roster hub F06 / register F-23's call half). The player's
  Family tab keeps its `tel:` rows (phone stage 5 · F4); the desktop Family column keeps its links.
- **D1 Depth chart — RULED 2026-09-29: a player opens as a full-screen sheet with a back button to
  the list.** Owner: *"I would prefer this to open as a full screen drawer on the phone with a back
  button to the list"* (on the v2 drawing, which folded the editor open inside the frame). The phone
  list is one frame, hairlined, heads at the 44px floor (was 52), each row a door ending in the
  chevron (the fold triangle goes). The sheet is a FORM, so it covers the phone bar (the 2026-09-23
  drawer-layer rule); the shared sheet header (back arrow, the player's name, "#4 · Depth chart");
  the editor exactly as today; back (arrow or the phone's back gesture) returns to the list at the
  same scroll. The board's private card recipe (`--line` border, `--shadow-sm` when open, 8px
  gaps) retires. Desktop and 641–768 keep the grid.
- **D3 The Best-positions order — RULED 2026-09-29: drag to reorder, "our portal standard".** The
  standard is the lineup builder's D8 handle (2026-09-21): a grip; a finger lifts after a 250ms
  hold (5px tolerance), a mouse after 6px, the keyboard via the sortable keyboard sensor; a TAP on
  the grip opens Move up / Move down (the lineup's row-actions menu). The tap half is kept: every
  reorder in the portal keeps a non-drag path (WCAG 2.5.7, and design log: hiding a control is only
  safe if its replacement is reachable). The rows leave their per-row olive cards for one outlined
  list (a form control keeps its edge, like an input). `PositionProfileEditor` is shared, so the
  player page changes too, phone and desktop. These were the last live up/down reorder arrows in the
  portal — the roster's `rosterMoveControls` arrows are hidden at every width since 2026-08-26 and
  are deleted with R1.
- **D2 Next player (asked).** A docked "Next player · <name> ›" at the sheet's foot opens the next
  player on the list in the same sheet (absent on the last). Recommended: setting positions for a
  whole team at the start of a season is otherwise open–edit–back twelve times; the observation
  form's "Save & next player" (phone stage 4) is the precedent. Alternatives: previous and next;
  none.
- **L Row lists (the component).** The framed form becomes `CoachRowList`'s **only** phone form:
  the row-card form retires with its CSS, and the `phoneFrame` prop goes (every list is framed).
  Covers Practice plans, Lineups, Lineup templates, the Apply picker, Scouting Book, Lineup Check,
  the inning panel. Tournaments and Announcements join when row-list session B2 (F-30/F-31) moves
  them onto the component.
- **M1 Player Dues + Development report + the libraries.** Dues' phone cards (`.duesCards`, their
  own recipe) become a framed fold list that FOLDS IN PLACE: its detail is a short read (the
  installment lines and a link to the full record), not a form, so D1's sheet does not apply. The `.tableAsCards` one-line variant
  (`.cardsOneLine`: Insights → Development) and the library tabs' phone-line cards take a framed
  variant, and those rows rise to 44px.
- **Stays:** Ledger and Club keep their cards (labelled lines). **Report-only:** the Ledger's phone
  card is the heaviest list in the product (seven labelled lines plus a full-width button per entry,
  ~200px each). That deserves its own look, not this rule's.

## 4 · Build (after the rulings)

1. `components/coaches/CoachRowList.tsx` + the recipe block in `coaches.module.css` (~12,730–12,850):
   the ≤640 row-card rules go; `.rowListPhoneFrame`'s rules become the plain ≤640 rules; the
   phone ORDER rules (title · trail · break · date lead · caption) stay. Drop the `phoneFrame` prop and
   `data-row-list-phone`; update its callers (Overview, Schedule list, event sheet, attendance room,
   calendar views, `CoachFigureRows`).
2. Roster (`roster/page.tsx` + the reflow block ~4,583–4,690): replace the ≤640 card reflow with
   the phone table; delete `.playerCellMeta` / `.playerNumBadge` / `.playerPosChip` (the phone-only
   folded meta); the call cell goes entirely (R2): the `.rosterCallTd` / `.rosterCallBtn` markup,
   its ≤640 CSS and the `tr:has(.rosterCallBtn)` padding rule are deleted; desktop never drew it.
   Name wraps. `SortableRow` loses the phone meta span and the never-shown `rosterMoveControls`
   arrows. Register F-23 records the reversal.
3. Depth chart (`DepthChartBoard.tsx` + its module ~191–220): at ≤640 the accordion becomes a
   framed list of doors; the open player renders in a full-screen sheet — `CoachModalHeader` (back
   arrow, the name, "#N · Depth chart"), the existing `pcardBody` editor unchanged, the form layer
   that covers the nav (`useOverlayOpen`, as the other phone forms), `useBackStep` so the phone's
   back closes it, scroll restored on close. The save-state text (Couldn't save · Retry) must show
   INSIDE the sheet (the list's save bar is behind it). Undo/Redo stay on the list. D2's foot if
   ruled. The in-list fold CSS (`.pcardRow.open`, the body under the head) retires at ≤640.
   **D3:** `PositionProfileEditor`'s Best list becomes a `SortableContext` with the D8 sensors
   (lift the lineup's `useSensors` block into a shared hook rather than a third copy); each row's
   grip button carries the listeners and its onClick opens the Move up / Move down menu (the
   lineup's `lineupRowSheet` markup — extract it to a shared row-actions sheet rather than
   copying); `moveBest` stays the one write; the arrow buttons and `arrowBtn` go; the rows lose
   their inline olive card styles for one outlined list.
4. Dues (`.duesCards` / `.duesCard*` ~14,234–14,380): the frame, hairlined folds, open body on paper.
5. `.tableAsCards` family (~64–260): a framed variant for a card with no labelled lines. Apply it to
   `.cardsOneLine` and the library tabs. Rows ≥ 44.
6. Standard + register: §3.8 (drop "a roster" as the card example; the labelled-lines boundary),
   §3.10.8 (one phone form), new F-rows for Roster / Depth / Dues / one-line cards / the component
   default, K-rows for Ledger and Club.
7. Gates: `list-ground` asserts the framed form for every row list at ≤ 640 (no second form to
   hold); a rendered check (from `.probe/rtl-survey.mjs`, reworked) that no phone list outside the
   KEEP list draws a gap between bordered sibling rows; `coach-schedule-phone-guard` (`phoneFrame`
   on the list) updated.
8. `/docs` check (help articles that describe phone cards), `/review`, the QA walk.

## 6 · Build record (2026-09-29, dev working copy)

**What changed, by file:**
- **Row lists** — `CoachRowList`: the `phoneFrame` prop and `data-row-list-phone` are gone; the
  recipe block's ≤640 rules no longer strip the frame, the band or the row (`ul.rowList { overflow:
  clip }` only); the `.rowListPhoneFrame` block is deleted. Callers updated (Overview figure rows,
  Schedule list + day list, event sheet, attendance room). `check-layout-invariants.mjs` R9
  (`list-ground`) holds ONE sentence at every width. Guards updated: `coach-first-screen-guard`
  (B5 · P1 — no declaration, no stand-down, no row paints a card), `coach-schedule-phone-guard`,
  `coach-schedule-sheet-guard`.
- **Roster** (R1 · R2) — the ≤640 block is the phone TABLE: each row a grid of three fixed tracks
  (`2.6rem · 1fr · 8.5rem`) with the heading row on the same tracks, so `position: relative` sits
  on an ordinary box and the name link's stretched ::after is the whole-row door on every phone (a
  real table row's containing block is not honoured everywhere — where it is not, one row's link
  would cover the whole list). Grip and Family hidden; name wraps; the empty position is
  `.rosterPosNone` (a dash + a screen-reader "No position yet"; the desktop prompt link hides).
  Deleted: `.playerCellMeta` / `.playerNumBadge(Dup)` / `.playerPosChip`, `.rosterCallTd` /
  `.rosterCallBtn` + the call cell, the never-shown `rosterMoveControls` arrows + `movePlayer`,
  the arrows hint variant. A stale `styles.playerCellTd` (its only rule lived in the old phone
  block) rendered as the class `undefined` — removed.
- **Depth chart** (D1 · D2) — `DepthChartBoard`: the phone accordion is one framed list of doors
  (`aria-haspopup="dialog"`, the chevron); `openId` on a phone opens the portal's modal
  (`.modalOverlay` + `.modal` — full-screen at ≤640, the nav hidden via `useOverlayOpen`,
  `useBackStep` for the phone's back), `CoachModalHeader` (name + "#N · Depth chart"), the editor
  as before, a failed save surfaced INSIDE the sheet (`role="alert"`), and `.modalFooter` with
  Previous / Next naming their players. Closing returns focus (and scroll) to the last player's row.
  Worked out before the return, never in a JSX IIFE (`react-hooks/refs` reads an IIFE as render).
- **The Best order** (D3) — `PositionProfileEditor`'s `BestOrderList`: `@dnd-kit/sortable` rows on
  the D8 sensors, now ONE hook (`lib/hooks/useReorderSensors.ts`, which the lineup editor reads
  too — its guard points at the hook); each row's grip carries the listeners and its click opens the
  lineup's own menu (`.lineupAutoMenu` + `.lineupRowSheet` + `LineupSheetScrim`; `menuCoversNav`
  in the depth sheet drops it to the screen's foot); one outlined list, type on the ladder.
- **Player Dues** (M1) — `.duesCards` is the frame, `.duesCard` / `.duesCardStatic` hairlined, an
  opened family's body on the paper tone.
- **Phone-line cards** (P1) — `.cardsFramed` beside `.tableAsCards` keeps the frame; Coverage and
  the practice libraries wear it; a `.cardsOneLine` row clears 44px.
- **Docs** — standard §3.8 / §3.10.1 / §3.10.8; register F-41 – F-45, K-25 / K-26 + changelog; help
  (`lib/help-content/coaches.tsx`, two places: "reorder with the arrows" → the grip).

**After the build (owner, 2026-09-29, D2a):** the Previous / Next buttons show the player's name alone with
the chevron — "is the player's name enough?" — the words stay in the accessible name; 44px buttons.
**And (owner, 2026-09-29 — "why is there an extra border?"):** every full-screen phone sheet drew the
desktop dialog's 1px tinted outline round the very edge of the screen (measured: `1px solid
rgba(87,101,30,.3)` on the depth sheet AND on Roster → Add player); beside the docked foot's hairline
it read as a box around the buttons. The shared ≤640 full-screen rule now sets `border: 0` — every
phone sheet at once; centred phone dialogs (`.centeredOnMobile`) and the desktop keep theirs.

**A DEFECT FOUND ON THE WALK — the depth chart never saved on dev (owner, 2026-09-29: "they don't seem
to be saving … not seeing a saving/saved pill").** Measured: a tap changed the chip and NO PATCH went
out — on the phone sheet AND on the desktop grid (untouched by this build), so it predates it. Cause:
the board's `cancelledRef` was set only in an unmount cleanup; React's development double-mount runs
that cleanup once, nothing reset it, and `scheduleSave` refused every edit. Production does not
double-mount, so it saved there — but the flag is now reset on mount (right under any remount).
Fixed with it: the board wears the portal's ONE autosave word (`SaveStatusPill`: Unsaved changes →
Saving… → ✓ Saved, fading; only an error persists), which the stylesheet already raises over a
full-screen form — measured 10px above the sheet's Previous / Next — in place of its own "✓ Saved"
text; and a leave-the-page save (on visibility loss, keepalive PATCHes for whatever is still unsaved —
the game-day console's pattern), because the save waits ~0.9s for more taps and a refresh inside that
window used to drop the last one (probed: an edit then a refresh 150ms later still sends its save).
The same cleanup-only guard shape sat in two free-portal "Turn on" flows (`CoachExploreCatalog`,
`CoachTeamSetupPanel` — on dev the write landed, the guard read "left", the spinner never cleared);
reset on mount the same way.

**And (owner, 2026-09-29, D3a):** the Best rank numbers leave the position chips (the editor — the
priority-order list under them IS the order) and the depth chart's phone list (the SEQUENCE is the
order: "C CF 2B"). Kept on the **desktop grid**, whose columns are the positions in a fixed order, so
a Best cell's number is the only place the order shows there. The pitching chips ("Ace ≤1", "#2 ≤2")
are pitching ranks, not Best order, and stay.

**And (owner, 2026-09-29 — the desktop grid, "we should be able to fit this on 1 row"):** the Pitcher
cell's rank chip and innings cap sit side by side (they stacked and doubled every pitcher's row). The
pinned Pitcher column widens 86 → 150px (the one-row content measured 130px); the three pinned widths
and their sticky offsets are ONE constant in the component (`PINNED`), mirrored in the module's
column rules. Measured at 1440 and 768: every row 52/53px, the pinned columns flush (0px) before and
after a sideways scroll. At 768 the pinned block is 64px wider, so the positions scroll a little sooner.

**Build-time calls (on the QA walk):** the reorder menu's last button is **Done**, not the lineup's
"Cancel" (moves apply at once); the phone roster's grid rows (above); Undo / Redo stay at the foot
of the depth-chart list.

**Verified** — `.probe/rtl-built.mjs` on the built product (390 + 360, touch): **35/35** — the
roster's heading, no call, aligned columns, 44px rows, a tap on a row's Positions opens that
player; the depth list framed; the sheet full-screen with the nav hidden, titled, Previous / Next
named, the grip menu at the screen's foot, Move down reorders, Next changes player, the phone's back
closes it; Practice · Lineups · Scouting · Coverage · Drills · Schedule · Dues framed; a dues family
folds in place. Unit: the 24 files that read the touched sources (492/492), the full suite
5,190/5,191 — the one failure is `admin-kit-nav` ("a team page is inside Teams"), which passed on
the run before and moved with the Club Tier session's uncommitted `lib/admin-kit-nav.ts`; typecheck
clean on the touched files; lint 0 errors (the depth chart's nine warnings are the committed file's
nine); spelling, contrast, text contrast, dates, demos, CSS-module purity, export catalogue, root
files pass. `check:public-tokens` and `check:css-selectors` fail ONLY on the Club Tier session's
uncommitted admin files (a new `#2F7D4A`; six dead classes in rep-teams / RepKit / `teamCardTop`) —
reported to that session.

**Report-only (not built):** the practice plan editor's touch drag holds for 250ms with a **6px**
tolerance where the lineup (and now the Best order) use **5px** — one gesture, two tunings; it
carries its own `touchGrip` model, so it was left, not folded into the hook. The Ledger's phone card
(K-25) is the heaviest list on a phone — its own look, later.

## 5 · Findings (clickable on the hub)

- **P1 — the phone rule still says cards.** §3.8 and §3.10.8 make separate cards the phone default;
  the framed form is an opt-in five lists took.
- **P2 — Roster: a table that fits, carded.** `# · Player · Positions` fits at 360 with the name on
  two lines, so S.7 (owner, 2026-09-24) says it stays a table. It was never re-measured after S.7.
- **P3 — Depth chart: a private card recipe.** Its own border token, a shadow when open, 8px gaps:
  a second card recipe, which §3.10.1 already forbids. (Fixed by D1: one framed list; the player
  opens full-screen.)
- **P4 — Player Dues: a private card recipe.** `--home-line-strong` border, radius 10, 0.7rem
  gaps, the same species as the depth chart's folds.
- **P5 — a list inside a sheet draws cards inside the sheet.** The Apply picker, Lineup Check, the
  inning panel: cards on a white sheet, two edges where §3.10.1 allows one painter.
- **P6 — one-line cards under the tap floor.** Insights → Development rows are 38px; each is a
  door.
