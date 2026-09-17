# Coach row lists — one recipe (register F-17) · implementation plan

**Status: RULED AS DRAWN 2026-09-16 (Q1–Q6, owner: "agree with your mockups") · SESSION B1 BUILT
ON DEV THE SAME DAY (§10 below) · /simplify · /review · /docs done · walk owed (ledger §197) · commit owed on the owner's word,
**the §194 table-standard hunks FIRST** (this build composes their frame ground and `.rowTapLink`) ·
session B2 (the rest) not started.** The planning session the prompt `COACH_ROW_LIST_RECIPE_F17_PROMPT.md`
commissioned drew it; the same chat built B1 on the owner's "build here".
**Hub artifact (mockups · decisions · brief · plan · QA-walk sketch):**
https://claude.ai/artifact/S78c93Zrp4U91mZTpyMsXk · source `COACH_ROW_LIST_RECIPE_HUB.html`.
**PM brief:** `COACH_ROW_LIST_RECIPE_PM_BRIEF.md`. **Evidence:**
`docs/agents/design/TABLE_INVENTORY_2026-09-16_ROWLISTS.md` (23 targets · 1440 · 768 · 390 · both
skins · the ground read from the ancestor). **The recipe:** standard §3.10. **The rows:** register
F-26–F-40 (FIX), K-21–K-24 (KEEP), F-17 (the umbrella, now recording the bin-C removals).

---

## 1. What the re-measure found (the thing the prompt asked to be said out loud)

F-17 was recorded on 2026-09-06 as *"six row treatments for one job"*. Re-measured on the served
page, with every list named by its markup rather than detected, and with the **ground behind the
row** read from the first painted ancestor:

- **The enumeration was stale and impure.** `railItem` (22px) is the consumer account rail's
  class — the staff list was rebuilt on 09-11 (pass 2) as a framed, hairlined list. `settingRow`
  (71px) is the Settings *form*. The tryouts `row` (176px) is the setup checklist; `howStep` a
  stepper; `dateRangeOption` a menu; `collapseSection` the closed-season shelves themselves.
- **What is left is two species, not six treatments.** Seven lists are **gapped card stacks on
  the paper** — the Practice plans hub, the Lineups hub and its Templates tab, the Schedule's list
  view, the Scouting book, Tournaments, Announcements (and the player's "Last 10 sessions", pills
  on a card). Each row is bordered, radiused, shadowed and gapped: the *phone's* card shape drawn
  at 1440, on the blueprint grid. Nine lists are **hairlined rows**, and eight of the nine already
  sit on a card something else paints (the staff list's own frame, the feed's own frame, the
  closed-season shelves, the Settings shelf, the player's section cards). The ninth — Off the
  roster — sits on the paper with a paper-coloured hairline (F-02's bug on a list row).
- **The standard's ground sentence named a table.** Nothing said who paints a list's ground, so
  four different things do (a list's own frame · the card around it · nothing · a dashed fold).
- **Two sizes are inherited, not chosen** (the staff name and the tag word at 16px — F-01's
  mechanism on a list row); the feed's sizes are literal rems in a module shared with the admin
  page; the two hubs put the **display face on a row** (a 20px day tile, larger than the page's
  own title).

So the prompt's question — *"what is the recipe?"* — has a shorter answer than it expected: the
recipe is mostly the table's recipe with one missing sentence (**exactly one painter of the
ground**) and one missing prohibition (**a row is not a card**). Everything else the row lists
needed (density by content, the ladder on the line, the hairline token, hover on a target, the
tap floor) the standard already said; the lists were drawn before it was written.

## 2. The bins (the first decision on every row of the panel)

| Bin | Lists | Register |
|---|---|---|
| **A · a table wearing divs** | An opponent's page — their results this season (`scoutIntelRow`: result · score · vs · date) | F-40 — a `<table>` on the shared frame when the page is next touched; no recipe |
| **B · a genuine row list** | Schedule list view · Practice plans hub · Lineups hub · Lineups templates · Scouting book · Tournaments entries · Announcements · player sessions & awards · player notes · guardians · Coaching staff · Notifications feed · closed-season results / roster / practices rows · Off the roster · Tags libraries & words | F-26–F-39 |
| **C · not records — removed from F-17** | the Ledger's date-range menu · the tryouts setup checklist and stepper · the team hub's setup checklist · the Settings form rows · the closed-season shelves themselves · the Schedule's Week/Month cell chips (K-21) · the depth-chart board · the chat panel · the money band tiles · the Overview's one-thing card · the free portal's lone tournament card | one line each on F-17 |

**Two borderline cases, decided on the panel (Q3):** the closed-season results shelf and the
player's last sessions have three same-kind columns — the letter of the prompt's bin-A test — and
are recommended to **stay row lists**, because the column question a table would answer is already
answered above them (the shelf's answer strip; the section's stat boxes). Standard §3.10 now states
the test that way: *a list is a table when a COLUMN answers the reader's question and nothing above
the rows already has* — which is why the Awards Leaderboard (a ranking) was one and these are not.

## 3. The recipe — standard §3.10 (summary; the standard is the text)

1. **Exactly one painter of the ground.** The table's frame (`.tableWrap`) when the list stands
   on the page; the enclosing card or shelf when it sits inside one; never zero, never two; stands
   down at ≤ 640 where the rows become the table's cards. The gate reads the ancestor.
2. **A row is not a card** on a desktop — no per-row border, radius, shadow, fill or gap.
3. Density by content via `.rowCaption`; `--tap-min` on a row with a control at ≤ 768.
4. Type from the ladder **on the line**; the item line `--type-body` (600 when it names the record
   and opens); a leading date is a **date column** (body, tabular, tertiary, fixed width); the
   display face nowhere below a heading; chips keep their own recipe.
5. The **band row** (uppercase `--type-support`, display face, 700, secondary, on the paper tone
   with `--home-line` above and below — the feed's day header) is the label row inside a frame.
6. Hover: `--home-olive-soft` + pointer on a row that opens, nothing else; the chevron last, or
   the ruled words at body 600 with the arrow; `.rowTapLink` for in-row controls.
7. **One lead mark**; the colour rail stays in calendar cells (K-21).
8. Phone: the table's card recipe, the title as the card's title, the corner chevron (K-09).
9. **One component**, never a second row class.

## 4. Build design (technical — for the build session, after the rulings)

### 4.1 The component

`components/coaches/CoachRowList.tsx`:

```tsx
<CoachRowList label?="…" aria-label>            // <ul data-row-list class=rowList>   composes .tableWrap
  <CoachRowBand>April 2026</CoachRowBand>       // <li data-row-band class=rowListBand>
  <CoachRow as="link" href | as="button" onClick aria-expanded | as="static"
            lead={<Date|Icon|Dot>} title caption trail={<Chip|Figure>} door={'chevron' | {words:'Open the plan'}}
            quietDoor caption2 />               // <li data-row-list-row class="rowListRow [rowListDoor]"> …
</CoachRowList>
```

- `rowList` **composes `tableWrap`** (border `--home-line`, 8px radius, `--card-bg`); `inset`
  variant (no frame, transparent) for a list inside a card or shelf — **the caller declares which
  it is**, and the gate checks the declaration against the render (§4.3).
- `rowListRow`: `display:flex; align-items:center; gap; padding: var(--table-pad-compact) 1rem;
  border-bottom: 1px solid var(--home-line)`; `:last-child` none; `:has(.rowCaption)` →
  `--table-pad-comfortable` (the same rule `.tr` has). `rowListCaption` **composes `rowCaption`**.
- `rowListDoor`: `cursor:pointer`, `:hover { background: var(--home-olive-soft) }`; the row is
  the `<a>` / `<button>` itself (the whole box is the target), never a nested control.
- `rowListLead`: `flex:none; color: var(--text-tertiary); font-variant-numeric: tabular-nums`;
  `data-lead="date|date-time|mark"` sets the fixed width (date 4rem · date-time 7.5rem).
- `rowListTitle`: `font-size: var(--type-body); font-weight: 600` (400 via `data-plain`);
  `rowListCaption`: `--type-support`, `--text-tertiary` (`data-meaning` → `--text-secondary`).
- `rowListGo`: the worded door — `--type-body` 600, `.rowTapLink`, `data-quiet` → tertiary;
  `rowListChevron`: `--text-tertiary`, 16px, last.
- `rowListBand`: `padding: .4rem 1rem; font: 700 var(--type-support) var(--font-display);
  letter-spacing:.05em; text-transform: uppercase; color: var(--text-secondary); background:
  var(--home-paper); border-top/bottom: 1px solid var(--home-line)`; `:first-child` no top.
- **≤ 640**: `rowList` sheds border + ground (the same compound-selector trap as
  `.tableWrap.tableAsCards` — write it below `.tableWrap` in source order); each row takes the
  `.tableAsCards tr` recipe (`--border-2`, 10px, `--home-olive-soft`, `margin-bottom: .65rem`);
  the band becomes a plain label; the lead date joins the caption line; the chevron corner-pins
  (K-09); a worded door hides (today's `lineupFrontAction { display:none }` behaviour, kept).
- **≤ 768**: a row that is a control is `min-height: var(--tap-min)`; icon buttons in a row are
  44 × 44 (F-28, F-39 already are).
- `CoachEventListRow` becomes a thin caller: `lead={<date>}`, the ruled chip in `trail`, the ruled
  words in `door` — its props and its callers do not change.
- `CoachRegistrationCard` gains `variant="row"` (the list) and keeps the card face for the free
  portal's lone Overview card (bin C).

### 4.2 Retirements (the dead-selector gate will demand them)

`.lineupFrontList/.lineupFrontRow/.lineupFrontDate/.lineupFrontDay/.lineupFrontMonth/.lineupFrontMain/.lineupFrontTitle/.lineupFrontMeta/.lineupFrontNote/.lineupFrontAction*/.lineupFrontPrimary`
(+ the ≤ 640 grid block), `.scoutList/.scoutRow/.scoutRowMain/.scoutRowName/.scoutRowMeta`,
`.miniList/.miniRow/.miniRowMain/.miniRowMeta`, `.offRosterList/.offRosterRow/.offRosterName/.offRosterNum`
(the fold's `details/summary` stays), `.calEventList` + the list-only rules of `.eventChip`
(the chip itself stays for the calendar cells — split the component by `dayKey`), the
`AnnouncementEditor .list/.row/.statusIcon` sizes, `FamilyCard .row + .row` margin,
`CoachStaffPanel .list` (→ composes `rowList`) and `.rowLink`'s own ≤ 768 floor (→ `.rowTapLink`),
`.tagDrawerRow`'s size gap, `.seasonRecordRow`'s `border-left`. `.lineupFrontChip` **stays** (the
ruled chip, used on the next-practice card too).

### 4.3 The gates (Q5)

1. **`tests/unit/table-recipe-guard.test.ts`** — extend `TABLE_SEL` with the row-list family:
   `\.(rowList)([A-Z][a-zA-Z]*)?` — so every `font-size` on a `rowList*` selector must be a
   `--type-*` token, every hairline/frame colour a line token, every `var(--x)` defined. Add the
   feed module (`notifications-page.module.css`) to the scanned set once F-36 lands (today it
   would fail on the literal rems — that is the point).
2. **`scripts/check-layout-invariants.mjs` — `type-ladder`**: beside `table th, td`, read
   `[data-row-list] [data-row-list-row]` and every text leaf inside it; one finding per list
   (`list·<label>`), sizes listed. The ladder is read from the page as today.
3. **`scripts/check-layout-invariants.mjs` — NEW rule `list-ground`** (the F-24 lesson as code):
   for every visible `[data-row-list]`:
   - at ≥ 641: walk from the first `[data-row-list-row]` up to `main`; the **first
     non-transparent `background-color`** must equal the computed value of `--card-bg` on that
     element (compare resolved rgb, both skins); a list declared `inset` must find that painter
     ABOVE the list; a list declared framed must find it ON the list. Finding: `list-ground ·
     list·<label> · ground is <rgb> painted by <class>, expected the card`.
   - at ≤ 640: the row's own `background-color` must be the card wash and **no element between
     the row and `main` may paint** (a slab behind the stack is the defect `.devTableCard` shipped).
   - Deliberately break it once in the build's verification (set one frame transparent) and
     record the finding in the ledger section — a rule that has never fired has never been tested.
4. `check:css-selectors` — no change; it enforces §4.2.

### 4.4 Per-list build notes

| Row | Where | Notes |
|---|---|---|
| F-26 | `schedule/page.tsx` `renderListView` + `EventChip` | `EventChip` grows a list face (`CoachRow` with `lead={<TypeIcon/>}` + date-time lead, the name, the trail: Moved / mismatch / record chip / score / result); months → `CoachRowBand`; "To be scheduled" → a band; the `Game day` sibling stays a sibling; the cell face (`dayKey` set) is untouched. **Drop the rail in the list face** (panel Q4). |
| F-27 | `CoachEventListRow.tsx`, `practice/page.tsx`, `lineups/page.tsx` | one `CoachRowList` per hub with two bands; `note` → `caption2` with `data-meaning`; the run-window `Run practice` sibling (`eventChipRow`) stays. The "Every practice this season ›" door sits under the frame. |
| F-28 | `lineups/page.tsx` templates pane | `as="static"` rows with the name as the link and three controls in `trail`, all `--tap-min` at ≤ 768. |
| F-29 | `history/opponents/panel.tsx` | `as="link"`, `lead={<NoteDot/>}`, trail: club badge + record chip. |
| F-30 | `CoachRegistrationCard.tsx` (+ its module) | `variant="row"`; `tournaments/page.tsx` and `CoachHostedTournamentsSection.tsx` pass it; the free Overview keeps the card. The `FanViewLink` line sits under the row as a caption line. |
| F-31 | `RepAnnouncementEditor.tsx` / `AnnouncementEditor.tsx` | `inset` list on the log card; the fold button stays; status icon as lead. |
| F-32 | `roster/[playerId]/page.tsx` (sessions, awards) | `inset`, compact, label line kept. |
| F-33 | `PlayerNotesTab.tsx` | date lead in the body face. |
| F-34 | `PlayerGuardiansCard.tsx` | `inset`, hairlines. |
| F-35 | `CoachStaffPanel.tsx` + module | `.list` composes `rowList`; the name `--type-body` 600; `.rowLink` composes `.rowTapLink`; frame `--home-line`. |
| F-36 | `notifications-page.module.css` | tokens for the three literal sizes; the day header on the band recipe. Shared with `/[orgSlug]/admin/notifications` — verify both. |
| F-37 | `season-end/page.tsx` | `inset` inside `SeasonMonths`; roster rows compact unless `<small>`; practices rows `as="link"` with hover; results rows lose `border-left`. |
| F-38 | `roster/page.tsx` | the `<details>` paints `--card-bg` when `[open]`, dashed edge kept (K-24); `inset` list inside. |
| F-39 | `TagManagerList.tsx` / `TeamTagShelf.tsx` | the word `--type-body` 600; the libraries list adopts the component (no visible change). |
| F-40 | `OpponentScoutingPanel.tsx` | a `<table class="table">` in `.tableWrap` — when next touched. |

### 4.5 What must not move (cite, do not re-decide)

The next-practice card (stage 0 D1) · the practices vocabulary (D3: Open the plan / Plan this
practice / Open; Plan set / No plan / No plan written) · "Every practice this season ›" (L8) ·
the Week/Month chips (K-21) · the feed's unread tint and day headers (K-22, §138) · the closed-season
page's shape and month folds (2026-08-18, K-23) · the Off-the-roster dashed fold (K-24) · the
Game day sibling link · "8:00 a.m." everywhere a time is shown.

## 5. Sequence (Q6) and sessions

1. **Session B1** — the component + the three gate extensions, proven on the Scouting book (the
   Q1 specimen); then the season's daily screens: Schedule list (F-26), the two hubs and Lineups
   templates (F-27, F-28). `/simplify` · `/review` · `/docs` · ledger §-walk · commit.
2. **Session B2** — Tournaments (F-30), Announcements (F-31), the small lists (F-32–F-35, F-38,
   F-39), the quiet ones (F-37, F-36), F-40 if the opponent page is open. Same close-out.

Each session's walk is its own ledger §; the hub's QA Walk tab is unhidden and finalised then.

## 6. Verification (per session)

`verify:changed` · `typecheck` (a shared component) · `table-recipe-guard` · `check:layout` at
361/390/768/1440 on the touched screens including the new `list-ground` rule, **with one
deliberate break recorded** · `check:css-selectors` (the retirements) · `check:spelling` ·
`check:demos` (the schedule list and the practice hub are tour destinations — anchors must
survive) · a Playwright read of the ground on the served page before and after (the
`measure-rowlists.mjs` probe, or its successor) · the ledger §-walk (the hub's QA tab, parts A–F).

## 7. The §-walk (sketched on the hub's QA tab; the build pins it)

A · The ground (desktop, both skins) — Scouting Book beside Results; the hubs; the schedule; the
calendar cells unchanged. B · Density and type — a schedule row against a Results row; the hub's
date column; the staff name; the tag word; the note's date. C · Bands, doors and hover — the
bands; tint-only hover; the practices-shelf doors; the roster shelf's two heights; no left rule.
D · The phone — cards, no slab, the corner chevron. E · Nothing else moved. F · The gate — zero
findings, one deliberate break reported by name, the retired classes gone.

## 8. Risks and what rides on them

- **The schedule's rows grow (31 → ~37; 52 → ~64 on a phone).** Stated on the panel (Q2a) and
  on the brief; the alternative is a private density, which the standard refuses by design.
- **`CoachRegistrationCard` serves the free portal.** The list face must not reach the lone
  Overview card; test both (`app/coaches/…` renders it).
- **The feed module is shared with the admin shell.** F-36's token change is invisible by
  design; verify the admin page renders the same.
- **The demo tours** anchor on the schedule list and the practice hub — the build fails if an
  anchor stops existing; the story is curated per release cycle, not here.
- **A gate that never fires.** `list-ground` must be broken on purpose once and the finding
  recorded, or it is the F-24 gate again.

## 10. Build record — session B1 (2026-09-16)

**Built as drawn, on the owner's six rulings.** Files: `components/coaches/CoachRowList.tsx` (new —
`CoachRowList` / `CoachRowBand` / `CoachRow` / `CoachRowListFoot`; a row is a link, a button or a
static record; a `beside` slot for a control that sits beside the row inside its `<li>`), the
stylesheet block "THE ROW LIST" in `coaches.module.css` (~11241 — placed where the retired
`.scoutRow*` rules stood, with `ul.rowList` / `ul.rowListInset` so the frame overrides win on
specificity rather than source order), `CoachEventListRow.tsx` (a thin caller of `CoachRow` —
props and callers unchanged), `history/opponents/panel.tsx` (F-29), `schedule/page.tsx` (F-26: the
three chips grew a `listRow` face; the list view is one `CoachRowList` with month bands; the cell
face is untouched — K-21), `practice/page.tsx` and `lineups/page.tsx` (F-27, F-28: one frame with
two bands each; the Run practice / Game day pills in the `beside` slot; the templates as rows with
the name as the link; the apply-to-game picker as button rows, inset).

**Retired:** `.lineupFrontRow` and its date-tile / title / meta / note / action classes and the
≤ 640 grid; `.scoutList` / `.scoutRow*`; `.lineupTplList` / `.lineupTplRow` / `.lineupTplInfo` /
`.lineupTplMeta`; `.ppEveryPractice`; `.calMonthGroup` / `.calMonthLabel` (from this module — the
admin schedule keeps its own copies). Kept on purpose: `.lineupFrontList` (the closed-season
shelves stack under it until F-37), `.lineupFrontChip` and `.lineupFrontPrimary` (the ruled chip
and the page's one lime), `.calEventList` and `.eventChipRow` (the day sheet and the cells).

**The gates:** `table-recipe-guard.test.ts` scans the `rowList` family (proven: a literal
`font-size: 13px` on `.rowListTitle` fails it); `check:layout`'s `type-ladder` reads
`[data-row-list] [data-row-list-row]` text; the new `list-ground` rule walks up from the first row
to `main` and asserts the first painted ancestor is the card token — **broken on purpose** (the
Scouting Book declared inset, on the paper) it reported `list·Opponents — the ground behind the row
is rgb(248, 244, 237), painted by <main …>, not the card`, then restored. At ≤ 640 it asserts the
row-card paints and no pure wrapper above the list paints a slab.

**Two things the build found that the drawings did not:** (1) on the phone, a worded door hides
and the card needs a corner chevron the mockup drew but the recipe's first draft did not render —
`CoachRow` now emits a phone-only chevron beside every worded door; (2) the Scouting Book's red
record chip, a 12% tint over the phone's card wash, composited under its own red ink to 4.06:1 —
the three chip fills are mixed over the card token now, opaque on every ground.

**Verification:** `table-recipe-guard` 5/5 · `check:layout` on the four screens at 390 · 768 · 1440
— no new findings, and the 15 baseline entries for the schedule's 31px rows at 768 **pruned** (the
ratchet tightened) · `check:css-selectors` clean after three retirements · `check:demos` green
(the lineups tour anchor now sits on the whole list, written as the literal attribute the anchor
guard scans) · `check:spelling` · CSS-module purity · unit suite 4,106 / 4,106 on the current tree (three were red for an hour while a peer's kit guard was mid-build) · `typecheck` clean on this build's files (the errors
in the tree are two peers' in-progress work) · the row-list probe on the served page at
390 · 768 · 1440, warm and dark: every converted list's first painted ancestor is the card.

**After the build — /simplify · /review · /docs (2026-09-16):** /simplify applied six (one chevron
span; the tournament chip's name and trail built once for both faces; `formatOrgDayMonth` in
`lib/timezone.ts`; one `offLadder` reader in the gate; the ground rule reads only the first visible
row; the phone order named once) and skipped two with reasons (a shared face-helper for three chips
that map different records; a portal-wide tone-fill token — recorded on F-29 for B2). /review
(high-risk funnel, four lenses) found 15 → 12 confirmed, 11 fixed: the worded door leaves the screen
but not the accessibility tree on a phone (`.rowListGo` is visually hidden, not `display: none`);
the page's one lime takes its own full-width row on a phone (`.rowListTrail:has(.lineupFrontPrimary)`
dissolves so the button can span); the `list-ground` rule keeps walking ABOVE a healthy frame and
reports a framed list inside a painted card ("two painters"); its phone slab walk counts VISIBLE
children; `check:layout --changed` strips `?section=` so a tab screen is reachable by the changed-file
filter (pre-existing miss, found on this diff); the record chip's tint is translucent everywhere and
opaque only inside a phone card (the opponent page's header chips sit on the paper); `.rowListTitle`
clamps at two lines; a band is `<li role="presentation"><span role="heading" aria-level="3">` so the
hubs keep jumpable headings; five self-test assertions pin the guard's `rowList` family; the demo
tour-anchor guard's scan reads literal values only; no `aria-label` on a static row; the rename editor
is a `<span>`; and the Game day pill no longer sits over the corner chevron on a phone. **One confirmed
finding has no code fix — the build composes the §194 session's UNCOMMITTED `.tableWrap` ground and
`.rowTapLink`; those hunks must be committed before this one** (§10's commit order). One refuted (the
template row's meta line is no longer part of the link — §3.6's own rule). /docs: no drift.

## 9. Help docs

No article names a card, a tile or a chip on these lists (the practice-plans and schedule articles
describe what a row says, not how it is drawn). `/docs` runs after each build session anyway: the
schedule article's "list view" sentence and the practice-plans article's hub description are the
two to re-read.
