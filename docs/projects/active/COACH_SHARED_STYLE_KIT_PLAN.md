# Coach shared style kit — plan

**Status:** assessed from source and drawn 2026-09-16 · **A–H RULED the same day, all as
recommended** ("agree with your recommendations, go ahead and build") · **BUILDING on dev
2026-09-16** in §7's order, in the planning session on the owner's word. Scope and the F-17 wall
ruled 2026-09-16 (both as recommended). §7 carries the build record per step.
**Hub artifact (ONE URL for the project's whole life — mockup · decisions · brief · plan · QA walk):**
https://claude.ai/artifact/PGjDZKq8X5RDksnHH3abiN — source `docs/projects/active/COACH_SHARED_STYLE_KIT_HUB.html`.
**PM brief:** `COACH_SHARED_STYLE_KIT_PM_BRIEF.md`. **Build prompt (for the session after the
rulings):** `COACH_SHARED_STYLE_KIT_BUILD_PROMPT.md`.

## 1. Origin, scope, and the wall

Owner, 2026-09-14, on hearing that Skills & Goals' Overview had been given Money's dashboard grammar
by copying the stylesheet: *"let's make sure this is discussed when this project is over. Shared
stylings are important for consistency across the app."* The Development lifecycle re-evaluation
closed 2026-09-16 (archived plan §17.1 is the origin; §21 row G4 names the phone-line debt this
project inherits). This is that discussion.

Ruled 2026-09-16, first question of the session:

- **Coach portal first, door open.** The duplication evidence is coach-internal (the twin
  stylesheets; five toolbars; three phone-line pairs). The club-admin accounting pages share 5 of
  ~180 selectors with the coach money pages — not twins — and the tournament-admin dashboard is a
  different species under its own owner-ruled density system (K-13 / K-17 / K-18). The kit is
  written on tokens so it is portable; §9 lists the candidates without drawing them.
- **Two projects with a wall — F-17 owns the row.** `COACH_ROW_LIST_RECIPE_F17_PROMPT.md` (commissioned
  the same day from ledger §194) owns what a record row looks like and whether a div-row list sits
  on the card. This project owns everything around and above the row: the dashboard card, the
  chrome above any list, the table frame's phone fold, and the rail of doors (F-17's bin C).
  Build order in §7.

**Foundation, and its state.** The table standard's F-24 / F-25 pass (ledger §194) is built on dev
and **uncommitted** at the time of this assessment — its hunks sit in `coaches.module.css`, the
Development pages, both design docs and the ledger, with five peer sessions live. This assessment
reads the working tree as truth (it is what renders). The build lands as a private-index commit
(`reference_shared_worktree_stage_race`).

## 2. Method

Source-based, the way the Development re-evaluation's §2–§3 were: every `*.module.css` under
`app/[orgSlug]/coaches/` and `components/coaches/` with a dashboard, overview, table, list or card in
its name or selectors was read; the look-alikes were diffed; consumers were grepped. Each finding is
tagged **Code finding** (follows from what the code does), **UX hypothesis** (a coach would
plausibly notice; not observed) or **Proposal**. Values quoted below are the declared CSS resolved
through the warm and dark token blocks in `app/globals.css`; the build session re-measures on the
served page (§8).

## 3. Findings

### F01 — Two dashboards, one stylesheet copied by hand · Code finding

`app/[orgSlug]/coaches/teams/[teamId]/development/overview.module.css` (180 lines) duplicates
`accounting/overview-dashboard.module.css` (679 lines) value for value on `.row3 .row2 .card
.cardAlert .eyeRow .eye .chip .chipDanger .chipWarn .chipGood .big .sub .bar .seg .legend .legendDot
.foot .footLink .railRow .railDot .railName .railStat .railChev`. Its docblock says why (a coach
screen must not import another section's module) and names the fix ("a shared dashboard kit is the
right extraction if a third Overview appears"). Three days in it has drifted:

| Selector | Money | Skills & Goals |
|---|---|---|
| `.railChev` size | `--type-support` (12px) | `--type-heading` (16px) |
| `.railCard` container query — two columns above 940px | present | absent |
| `.vBad` / `.vMuted` | present | absent |
| `.railNote` | absent | present |
| `.rowSolo` | present (archived-season layout; likely dead since the one-page ruling) | absent |

The second consumer is the extraction point, not the third (memory
`feedback_shared_component_over_shared_class`, third instance).

### F02 — Three card skins for one card, and three greys in dark · Code finding

| Skin | Where | Ground (warm / dark) | Border | Radius | Shadow |
|---|---|---|---|---|---|
| Dashboard card | `.card` in both modules | `--home-card` → #FFF / `--bg-card` #111827 | `rgba(blueprint,.15)` → olive / platform blue | 8 | none |
| Overview family | `.snapshotCard` `.nowCard` `.oneThing` `.insightsCallouts` (`coaches.module.css` 1694, 2558, 2326, 2020) | `--white-8` → #FFF / **rgba(255,255,255,.08) over #0A0A0A** | `rgba(blueprint,.3)` | 12 (`--radius`) | `--shadow-sm` + `--highlight-top` |
| Table frame | `.tableWrap` (3164; 16 consumers) | `--card-bg` → #FFF / `--hud-surface` #111827 | `--home-line` (neutral) | 8 | none |
| Tinted section | `.detailSection` (5692) | `--home-olive-soft` | `rgba(blueprint,.15)` | 8 | none |

In warm the first three grounds all resolve to `#FFF`; in dark the Overview family is a translucent
wash while the other two are opaque. Two quiet inks split the same way: the dashboard's `.sub` uses
`--home-dim` (white-45 in dark) while the tile's `.snapshotSub` uses `--text-tertiary` (`#94A3B8`).
The standing direction is *card + neutral hairline* — the 2026-07-30 ink/lime ruling, the Staff
screen (08), the nudge panels, the table standard's F-10 (09-06); the dashboard's accent tint
(built 08-11) predates it. `.snapshotCard`'s own comment says its elevation was designed for "the
near-black page" — a dark-skin reason applied to both skins.

### F03 — Three eyebrows · Code finding · UX hypothesis

| Class | Face | Size | Weight | Tracking | Ink |
|---|---|---|---|---|---|
| `.eye` (dashboard) | `--font-data` | `--type-label` 11 | 700 | .09em | `--text-secondary` |
| `.snapshotHead` (tiles) | sans | `--type-support` 12 | 700 | .04em | `--text-tertiary` |
| `.insightsStatLbl` (band) | sans | `--type-token` 10 | 800 | .12em | `--text-tertiary` |
| `.railStep` (rail group) | `--font-data` | `--type-token` 10 | 700 | .09em | `--home-dim` |

The type ladder names `--type-label` as the uppercase-eyebrow step and found "a heading at badge
size" on this role once already (`COLLECTIONS` at 9.9px, 2026-08-28). Hypothesis: a coach reading
Overview → Money → Insights meets three label sizes in two faces on consecutive screens.

### F04 — Two figure faces · Code finding

`.big` is Inter 24px 800 tabular; `.snapshotValue` and `.insightsStatVal` are Barlow Condensed 24px
800. The ladder pass settled the size (figure 24 — "they are card figures") and not the face.

### F05 — Five toolbars for one job · Code finding · ⚠ corrected at build: THREE live, two dead, one not a toolbar

*Build correction (2026-09-16):* `.scheduleToolbar` had **zero callers**; `.listToolbarFact` and its phone drop had **zero callers** (the count left the Roster toolbar on 2026-08-26); `.ppToolbar` is the practice **document's** action row (Save as template · Print the sheet · Library), ruled with the practice document, and is not a list toolbar. The fold is `.panelToolbar` + `.listToolbar` + `.insightsPanelToolbar` → one component; the dead ones are deleted with headstones; `.ppToolbar` is a named exemption in the kit's header.

| Recipe (`coaches.module.css`) | Consumers | Gap | Below | Tap floor |
|---|---|---|---|---|
| `.panelToolbar` + `Actions` + `Sticky` (7973) | dues · club · expenses · fundraisers · development ×2 | .5 × .75rem | .9rem | — |
| `.listToolbar` + `End` + `Fact` (5250, 13517) | roster · schedule · PlayerDevelopmentSection | .75rem | 1rem | own copy on `End` |
| `.insightsPanelToolbar` (2166) | Insights reports | .6rem | 1rem | own copy (`> a, > button`) |
| `.ppToolbar` + `End` + `Flush` (9867) | practice hub · Schedule's practice panel | .5rem | .9rem | own copy @768 |
| `.scheduleToolbar` + `Actions` (5998) | schedule ×3 | .5rem | — | — |

Same job — context or a lens left, actions right, wraps, a rem below, the table under it. Not in the
set, on purpose: `.devReportToolbar` (14257 — a report's selector fields, `align-items: flex-end`)
and `.ppDrillFilters` (search + tag chips): different jobs.

### F06 — Three count lines · Code finding

`.devListLede` (8929) support 12 · tertiary · 64ch (Sessions, Metrics) — `.listToolbarFact` (5258)
body 14 · tertiary (Roster) — `.moneySummaryBasis` (7899) support 12. `.devReportDenominator` (14268:
body 14 · 700 · primary) is Coverage's *finding* sentence ("4 of 12 players have a result this
season"), not a lede — kept.

### F07 — Three phone-line pairs, one of them already the shared one · Code finding

| Pair | Where | Line's type |
|---|---|---|
| `.cardPhoneLine` / `.cardDesktopCell` (**shared**, promoted 2026-09-16 by the practices stage-4 build; `coaches.module.css` 215) | `LibraryRow.tsx` — Drills · Templates · Circuits · Practices | none of its own; consumers compose `.listRowSub` → support 12 · **tertiary** |
| `.phoneLine` / `.desktopCell` | `components/coaches/PlayerDevelopment.module.css` 148, 199 — a player's Results table (stage 3, E6) | support 12 · **secondary** · `b` primary 600 tabular |
| `.devReportPhoneLine` / `.devReportDesktopCell` + `.devReportOneLine` / `.devReportRowCell` | `coaches.module.css` 14398–14420 — Coverage (one line per player, 38px rows) and the records cards (stage 4, G4) | support 12 · **secondary** · `b` primary 600 · body face forced (its desktop cell is K-20 mono) |

The practices commit's comment on the shared pair says it in so many words: *"that table and the
peer's records cards still wear their own copies — S6 (the shared stylings close-out) points them
here."* The one open question is the ink.

### F08 — The rail is two copies · Code finding

See F01: the fold (Money's `@container (min-width: 940px)` two-column rule with `break-inside:
avoid` per row and per self-labelled group), the chevron, the note.

## 4. What the kit holds — component or class, and why

The repo's rule (`feedback_shared_component_over_shared_class`): a shape that carries behaviour or
any a11y / tap-target detail, in more than ~5 files, is a component; a purely visual recipe is a
class family with a guard.

| Part | Form | Why that form | Consumers after the build |
|---|---|---|---|
| **`CoachCard`** — roles `report` (default) and `door` | Component | the door role carries behaviour: the whole card is the link, hover lift, arrow in the eyebrow, focus ring, `data-tone` | Money Overview ×5 · S&G Overview ×5 · team Overview ×6 tiles + One Thing (decision C) |
| **Eyebrow · Figure · Sub · Chip** | Class family in the kit module (`Chip` a small component — tone is a prop, colour never carries the verdict alone) | purely visual; the ladder's tokens plus a guard | every card above; the Insights band (D) |
| **`CoachBar`** — segments · legend · hatched overrun | Component | a11y: the ratio in the accessible name, the hatch for deutan vision, the legend dots — three places to get wrong by hand | Money dues · S&G measured · Overview dues tile |
| **`CoachListToolbar`** — `lede` · `lens` · `actions` · `sticky` | Component | the 44px floor (three hand copies today) and the sticky measured-top (`.panelToolbarSticky`'s inline `top`) are behaviour | 15 files, five recipes → one |
| **`CoachRail` · `CoachRailRow`** — `dot` lane · `name` · `note` · `stat` · href | Component | the container fold and the link row | Money · S&G |
| **Phone-line family** — `.cardPhoneLine` `.cardDesktopCell` `.cardsOneLine` | Class family (existing, completed) | a display swap and a type recipe; the markup is two cells and a span — under the component threshold and already one family | Drills · Templates · Circuits · Practices · Results · Coverage · records |

**Where it lives:** `components/coaches/kit/` — one `CoachKit.module.css` (tokens only; the only
pixels are the ladder's and the card's 8px), one export per part, one docblock listing the
exemptions in §6 so the next reader knows they were seen. **Consumers never reach into a kit class
from their own module** (the `.pageHeaderBlock .pageHeaderStd` trap). Both Overviews' stylesheets
shrink to screen-only rules: Money keeps its plan-vs-actual rows, flow bars, ledger and days toggle;
S&G keeps its arc line, `.linkButton` and the attention list.

**The kit's values** (decisions A, B): card = `--card-bg` ground · `--home-line` 1px · radius 8 ·
padding .95rem 1.05rem · flex column gap .45rem; `door` adds `--shadow-sm` + `--highlight-top`, a
1px hover lift and the arrow. Eyebrow = `--font-data` · `--type-label` · 700 · .09em · uppercase ·
`--text-secondary`. Figure = sans · `--type-figure` · 800 · -.02em · tabular; `small` = support 600
dim. Sub = `--type-support` · 1.45 · `--home-dim`. Chip = `--font-data` · `--type-token` · 700 ·
.05em · pill; tones danger / warn / good. Bar = 12px · radius 6 · `--home-line` track · olive fill ·
hatched overrun. Foot = `margin-top: auto` · hairline top · links 44px · body 650 olive. Toolbar =
flex wrap · gap .5rem .75rem · .9rem below · lede support/tertiary/64ch · actions `margin-left:
auto` · every control ≥ 44px at ≤ 768. Rail row = grid 10px 1fr auto 10px · 44px · hairline · chevron
support size · folds at 940. Phone line = support · `--text-secondary` · `b` primary 600 · tabular ·
sans (decision F).

## 5. Decisions (on the hub's Decisions tab, with the paste-back block)

| # | Question | Recommendation | Ruled (2026-09-16) |
|---|---|---|---|
| A | One ground token, the neutral hairline, radius 8 on every kit card? | Yes | **Build as drawn** |
| B | Two roles — report card and door tile — on one skin? | Yes | **Build as drawn** |
| C | The team Overview adopts the kit: the six tiles as door tiles, and the One Thing card takes the skin (keeping its kicker, headline, chips, action and accent edge)? | Yes, both; "tiles only" is the named alternative | **Build as drawn — both** |
| D | The Insights band takes the kit's eyebrow / figure / caption, keeping its borderless shape? | Yes, type only | **Build as drawn** |
| E | The list toolbar becomes one component with one lede role (support / tertiary)? | Yes | **Build as drawn** |
| F | The three phone-line pairs fold into the shared one, in the secondary ink? | Yes, secondary | **Build as drawn — secondary** |
| G | The rail becomes one component on Money's values? | Yes | **Build as drawn** |
| H | Confirm the deliberate differences the kit does not touch (§6) | Confirm | **Confirmed** |

Owner's words: *"agree with your recommendations, go ahead and build."*

## 6. Deliberate differences kept (decision H)

- Money's plan-vs-actual rows and cash in/out mini-bars — approved on mockup 64d49b0e; screen-only.
- The Ledger rows (`.ledgerRow`) and the attention list (`.attnRow`) — different content in the same
  card slot (records; findings). Stay per-screen; **named to F-17 for binning** (likely B and C).
  F-17's plan (drawn the same day) already has an `inset` row-list variant for a list inside a card —
  that is where these land if F-17 bins them B, and its recipe composes the same frame token this
  kit's card takes (`--card-bg` · `--home-line` · 8px), so the two plans agree on the ground.
- The Insights band's borderless shape — type only (D).
- The One Thing card's kicker · headline · chips · single lime action · accent edge by `data-kind`
  (the One Thing ruling). Skin only (C).
- `.devReportToolbar` (selector fields) and `.devReportDenominator` (a finding, not a lede).
- `.ppToolbar` — the practice document's action row, not a list toolbar (found at build; the
  practices re-evaluation's surface).
- The Roster's own phone reflow (`.rosterTable` hidden columns — owner-ruled roster phone chrome).
- The closed-season page (2026-08-18), the practice document (practices re-evaluation), everything
  under F-17.

## 7. Sequence (the build session — one session, chunks committed as they land)

1. **Kit first, no consumers.** The module, the six parts, the guard (§8). Nothing renders it yet.
2. **Money Overview** onto the kit — pixel-identical except the border. The layout baseline must
   not move a row on `coach-money-overview`.
3. **Skills & Goals Overview** — the twin block in `overview.module.css` deleted; chevron 16 → 12.
4. **`CoachListToolbar`** — the five recipes, one screen at a time, Money last (its geometry is the
   kit's; it is the control). `.panelToolbarSticky`'s measured `top` becomes the `sticky` prop.
5. **Phone line** — `.cardPhoneLine` carries its type; `.cardsOneLine` joins; the two private pairs
   deleted; UAT waits keyed to the old class names re-pointed.
6. **Team Overview (C) and the Insights band (D)** — the visible ones, last, so an owner "not now"
   on either costs nothing above.
7. **Rail (G).**

**Against F-17:** the toolbar (step 4) lands before F-17's build, so F-17's lists sit under the same
toolbar; F-17's "does a row list sit on the card" ruling lands before step 1 declares the card
token final, so one ground token serves both. If F-17 has not ruled by then, the kit ships on the
table frame's token and F-17 adopts it.

### 7.1 Build record (2026-09-16, built on dev in the planning session on the owner's word)

| Step | Built as | Rendered check |
|---|---|---|
| 1 · Kit + guard | `components/coaches/kit/` — `CoachKit.module.css` (tokens only), `CoachCard` + `CoachDoorCard` + `CoachEyebrow` + `CoachFigure`, `CoachChip`, `CoachBar` (segments `fill` · `bad` · `over`, optional legend, optional accessible label), `CoachListToolbar` (lede · children · actions · sticky/stickyTop · style; `forwardRef`), `CoachRail` (groups → rows; the container fold; `idPrefix`), `index.ts`. `tests/unit/coach-kit-guard.test.ts`: red on 40 declarations at first run, green by deletion — the dashboard signature is the `.eye` + `.big` PAIR (a metric sheet has an unrelated `.big`), the toolbar/tile/phone-line names are unconditional, the kit's own list is asserted, the phone-line family is asserted to live once in `coaches.module.css` beside `.tableAsCards`. The card gained an `accent` role (`--card-accent` set by the screen's own class — a custom property, so cross-module cascade order cannot matter) for the One Thing and getting-started cards. | — |
| 2 · Money Overview | `OverviewDashboard.tsx`, `MoneyRail.tsx` (keeps its ROWS map and steps; renders `CoachRail`), `MoneyNextThirtyDays.tsx` (the shell only) on the kit; `overview-dashboard.module.css` 679 → 344 lines, screen-only (plan rows, flow bars, ledger, `rowSolo`). | `coach-accounting` green at 361/390/768/1440. Two F-21 chrome rows (34px tab-scroll arrow @390, help "?" @768) accepted with F-21's reason — Money's Overview simply lacked the rows Dues/Fundraising/Club already had. |
| 3 · S&G Overview | `development/page.tsx` renders the kit; `overview.module.css` 180 → 51 lines (the arc line, the link button, the attention list). Chevron 16 → 12; border tint → hairline. | `coach-development` green. Visually identical in warm; in dark the cards are the opaque card grey. |
| 4 · Toolbar | **Three** live recipes → `CoachListToolbar` (the plan said five: `.scheduleToolbar` and `.listToolbarFact`/`PhoneDrop` had **zero callers**; `.ppToolbar` is the practice DOCUMENT's action row and stays — corrected in the kit header and the register-of-exemptions). Consumers: Dues, Club, Ledger (sticky with its measured top), Fundraising ×3, S&G Sessions + Metrics, Roster (`kit.toolbarView` on the switch), Schedule, a player's Results, Insights → Awards. Headstones for eight retired selectors. **The floor is ≤ 768** (standard §3.6, tablet-band §115) — the recipes disagreed (640 / 768 / 640). | Eight screens green, and **ten baseline debt rows no longer reproduce** (Export/Send reminders/List/Depth chart/Fundraiser/Pledge at 768 now clear the floor) — dropped surgically. An eleventh, `coach-accounting|768|tap-floor|button·Import`, was dropped in the same pass but is **not the kit's**: that Import lives in the Money page HEADER, measures 44px at 768 today, and its 33px row was stale before this build (the gate flagged it on the first run, before any floor moved) — dropped as stale, credited to whoever fixed the header (/review caught the mis-attribution). |
| 5 · Phone line | `.cardPhoneLine` carries its own type (support · secondary · `b` primary 600 · tabular · body face) inside c5's `.tableAsCards` scoping; `.cardDesktopCell` hides any element (the two folded pairs hid rows and spans, not only cells); `.cardsOneLine` + `.cardsOneLineLead` join the family. `PlayerDevelopment.module.css`'s pair and `coaches.module.css`'s `devReport*` pair deleted with headstones; LibraryRow drops the composed caption class. | Drills, Coverage, a player's Results green. |
| 6 · Team Overview (C) | Six tiles → `CoachDoorCard` (eyebrow with icon + arrow · figure, `words` for a phrase · sub · pips · `CoachBar` with the `bad` fill for an overdue share · flag); the pending placeholders → `CoachCard`; the tile family retired for `.boardGrid` (the grid is the board's own); the phone compaction retired (one card at every width; 24px figures two-up at 390 fit). `.oneThing` and `.nowCard` keep layout + `--card-accent` by kind/phase and render as `<CoachCard accent>` (7 sites: the One Thing card, Money setup ×2, S&G preseason ×2, Attendance ×2). | `coach-overview` green — **no baseline row moved** (the gate measures floors, widths, overflow and contrast; the tile's radius and figure face are not baseline axes). |
| 6 · Insights band (D) | `history/page.tsx` and `history/attendance/panel.tsx` wear `kit.eye` · `kit.big` (+ `bigGood`/`bigBad` for the score diff) · `kit.sub`; the three `insightsStat*` type classes retired. `.insightsCallouts`' ground → `--card-bg` (one grey in dark; its lime top edge and radius stay — it is a highlight frame, not a kit card). | `coach-history`: six pre-existing rows recorded with reasons (F-21 chrome ×3; three 40px callout rows — HEAD's own `.insightsCo` rule, rendering now that the fixture has findings). |
| 7 · Rail (G) | Done in steps 2–3 (`CoachRail`). | — |

**Gates:** `verify:changed` green (unit 4,106/4,106, tokens, contrast, purity, selectors, spelling, snapshots, dictionary, demos, exports) · `typecheck` 0 · lint 0 errors · the kit guard · `check:layout` on every touched screen.

**/simplify (four lenses, 2026-09-16) — 8 applied:** the guard reads through the shared source helper (`_source-code.ts`) with one read per file and the selector shape asserted in the regex itself (no per-match slice of a 786KB file); `clsx` in the kit's five class joins and the card's helper inlined; the toolbar's `actions` slot used in Club, Dues, Fundraising ×3 and the player's Results (with an `actionsClassName` hook for the one slot that stacks on a phone) instead of hand-wrapping the same div; the toolbar's `style` prop dropped — the Sponsors band's 2rem of air moved onto its own section, and the Fundraisers band's 0.5rem tightening went (one geometry, decision E); the eyebrow's unused `id` prop dropped. **2 skipped:** the Ledger's two-deck right slot stays a child by the component's own contract; the directory walker duplicated from the table-recipe guard has a different signature and that file is mid-edit by a peer.

**/review (standard tier, two lenses: regression/blast-radius · correctness + CSS cascade) — 3 confirmed, all fixed; 0 refuted:**
1. **High — cross-module cascade order.** The One Thing and getting-started cards' own padding/gap lost to the kit's `.card` (same specificity, the kit's stylesheet emitted later): measured 15.2 × 16.8 on the served page where the card's own is 16.8 × 20. Fixed the way the accent edge already was — the kit reads `--card-pad` / `--card-gap` the screen sets; measured back to the card's own at 1440 and 390. Found by the main loop's own probe before the finder reported it; the finder's reasoning matched.
2. **Medium — the same hazard, two more places, found by the main loop:** the Roster view switch's grid rule vs the portal's segmented-control rule (anchored under the toolbar, (0,2,0), order-proof — measured 112×30 / 102×44 equal pills); and the Coverage one-line rule, which had moved ABOVE the stack-cell rule it must beat (the old copy won by sitting at the file's end) — raised to (0,3,1) and measured back to a 38px row. The guard now also counts a class that ends a compound selector as a declaration, so a caller reaching into a kit class from its own stylesheet fails the build.
3. **Medium — the Overview tiles' gauge lost its hover sentence** (the old span carried `title`; the kit bar mapped it only to the accessible name). The bar takes a `title`; the tile passes it.
4. **High — a mis-credited baseline drop** (above): corrected in the record, the row stays dropped as stale.
**Not the kit's, surfaced by its sweeps (left for their owners):** the awards history table's per-row icon controls (print 19px wide, Edit/Remove 22px tall — identical in HEAD; session 2d's screen) — 21 unbaselined rows on `coach-history-awards`; an intermittent 401 on the fixture's session under three concurrent sweeps rendering a "Try again" error state (21px) once per run.

## 8. Verification — and what WILL move

- `check:layout` at 361 · 390 · 768 · 1440, **both skins**, on: `coach-overview` ·
  `coach-money-overview` · `coach-development` (Overview, Sessions, Metrics) · `coach-history`
  (Insights hub) · `coach-roster` · `coach-dues` · `coach-history-playing-time` ·
  `coach-practice-plans` · the library tabs · `coach-history-development-focus` · a player's Results.
- **The Overview baseline will move** (tile radius 12 → 8, the figure's line box, the 12px bar,
  the One Thing card's radius) — re-accept those rows *by measurement*, never by hand, and say
  which rows in the commit. **Every other screen must not move a row**; F-17's re-measured
  inventory is the second witness for the lists.
- The type-ladder guard extended to the kit's classes; `warm-palette-contrast.test.ts` given the
  kit's ink/ground pairs in both skins (`reference_warm_theme_badge_contrast` — a static gate here
  has read dark only before).
- **A stylesheet guard** (the "no thirtieth branch" pattern of
  `tests/unit/coach-history-endpoint-guard.test.ts`): any `*.module.css` under
  `app/[orgSlug]/coaches` or `components/coaches` outside the kit that declares `.card .eye .big
  .railRow .panelToolbar .listToolbar .insightsPanelToolbar .ppToolbar .scheduleToolbar .phoneLine
  .devReportPhoneLine .snapshotCard` fails the build. A kit nothing can find drifts by Christmas.
- `verify:changed` · `typecheck` (shared modules) · `check:spelling` · `check:demos` (the coach
  demo tours land on the Overview and Money — anchors must survive the tile rename).
- The QA walk (hub tab, filled by the build session): PIN IDENTITIES not figures — "the Record tile
  opens the record", "the Dues card's overdue slice is hatched", "the Drills line reads in the
  same ink as the Results line" — never "$4,250".

## 9. Door left open — not drawn

Tournament-admin dashboard (`app/[orgSlug]/admin/tournaments/dashboard/` — drag cards, a checklist,
its own owner-ruled density system K-13/K-17/K-18), the club-admin accounting pages
(`admin/accounting/budget`, `bva` — 5 of ~180 selectors shared with the coach pages), the public
site's state cards (`components/public/PublicTournamentState.module.css`), the platform console's
overview. The kit is written on tokens; any of these could adopt it. Each is its own session with
its own mockups, and the admin shell's density ruling is reconciled first, not overridden.

## 10. Failure modes this plan is written against

- Folding a redesign into a consistency pass (the guardrail): every visible change above is a skin,
  a size or a face moving to a value another owner-approved surface already has.
- Extracting a class where the shape carries behaviour (the back-link lesson, 27 files).
- Reading the dark skin through the warm one: F02 is invisible in warm.
- Committing over the table-standard session's uncommitted hunks: private index, both checks.
- Drawing F-17's row. The wall is §1.
