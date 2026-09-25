# Insights scoreboard — on the white card, and the Overview's rows on a phone

**State:** ruled 2026-09-25 (A1 · B1 · C1, every ask as recommended) · built on `dev` 2026-09-25 ·
record note revised the same day · QA §233 WALKED 2026-09-25 — 10/10 PASS (A 5/5 · B 3/3 · C 2/2; owner, pasted back, no findings) · hub `docs/projects/active/INSIGHTS_SCOREBOARD_HUB.html`
(artifact `BmAfMYheb7DyinzVYoAj4k`) · PM brief `INSIGHTS_SCOREBOARD_PM_BRIEF.md`.

A follow-up to the phone project's stage 6 (`COACH_MOBILE_EXPERIENCE_PLAN.md` §14), which checked this
screen and passed it (§14.5 — "already box-less, S.4-compliant"). That check asked whether a figure
repeated a heading; it never measured what the figures cost.

## 1. The owner's question

> "why is the format of the dashboard on insights different than our other dashboards (i.e.
> transparent backgrounds instead of white)? also can we make our dashboard more mobile friendly and
> not take up so much space?"

## 2. Why it was different (from the code and the record)

- Drawn as a **borderless scoreboard band** on 2026-08-18 (Insights reports portal).
- The shared style kit (2026-09-16) put Money, Skills & Goals and the Overview on one card skin and
  listed this band among its deliberate differences — **decision D, "type only"**: the band took the
  kit's eyebrow / figure / caption and kept its bare shape. The recorded case was only "deliberately
  not cards"; no reason for the shape was written down.
- Since then the momentum chart and What stands out beneath it became cards, so the band was the one
  bare block on a page of cards.
- ⚠ **The two asks conflict if done naively**: five kit cards (the Overview's desktop tiles) make a
  phone view TALLER. One frame around all the figures answers both.

## 3. Measured (live page, candidate switched on in the browser — CSS/DOM only)

Probe `.probe/band-measure.mjs`; fixture UAT Test Team (7 games, one a scrimmage; 12 players).

| | Before | Ruled | Built |
|---|---|---|---|
| Dashboard figures, 390 / 360 | 317 / 317 | 207 / 207 (A1) | **207 / 207** |
| What stands out heading, 390 | 655 | 545 | **545** |
| Dashboard band, 1280 | 105 | 103 (B1) | **103** |
| Attendance figures, 390 | 214 | 178 (C1) | **178** |
| Attendance band, 1280 | 92 | 91 | **91** |

Declined, with numbers: A2 today's grid on a frame (271); three across (231, captions wrap to four
lines in 118px cells); five rows without folding Form (274); B2 five cards (128, +23); C2 rows on
Attendance (193).

## 4. The rulings (2026-09-25, pasted back from the hub)

- **A1 — phone:** the Dashboard's figures are the Overview's rows in one white frame; **Record and
  Form are one row** (pips + streak as the qualifier, the Overview's Record row). The record's scope
  note ("scrimmages left out") and the run bar drop on a phone only.
- **B1 — computer:** the band keeps its shape and dividers, on the kit card's skin.
- **C1 — Attendance:** the same band, framed at every width, two a line on a phone.

## 5. Built as (2026-09-25)

- **`components/coaches/CoachFigureRows.tsx`** (new) — `CoachFigureRows` (the framed phone list) and
  `CoachFigureRow` (label · one qualifier · figure · chevron; `tone` good/danger, `words`). Extracted
  because Insights is the **second consumer** of the Overview's phone board (B3/B5/B6) — the house
  rule is that the second consumer is the extraction point. The Overview now renders through it;
  its rows are unchanged (measured 51/53/51/51/51/44, list 303px — as before).
- **CSS:** `.boardRows`/`.boardRowFigure` renamed `.figureRows`/`.figureRowFigure` (one block, a
  note says they are shared); `.figureRowFigure[data-tone="good"]` added (the kit's `bigGood`).
- **The band** (`.insightsBand`/`.insightsStat`): the kit card's skin — `--card-bg` blocks on a
  `--home-line` ground with a **1px gap as the hairline** (so a wrapped band divides between its lines
  too; a `border-right` cannot), the `--home-line` edge, radius 8. Hover is a tint **image** over the
  card (the translucent `--home-olive-soft` as a background colour would show the line ground
  through it). The run bar's track moved from `--home-card` (white in warm → invisible on the card)
  to `--home-line`. `.insightsCalm` (no callers) deleted.
- **Phone:** `.insightsScoreboard` hides the Dashboard's band at ≤640 (stylesheet, never a JS width
  branch); `.insightsScoreboardRows` wraps the rows for the band's 1.2rem before the chart (the row
  list's `ul.rowList { margin: 0 }` outweighs a caller class). The Attendance band keeps two a line
  (`.insightsStat` flex 45%, padding 0.55rem 0.8rem).
- **Insights page:** the pips render once (`formPips`) and sit in two homes; the run differential's
  row title is sentence case (`diffLabel`) — the sport pack's Title Case "Run Diff" is the standings'
  column head and stays; the Attendance row's figure is a plain "95%" (a `<small>` came out at
  16.67px, off the type ladder — `check:layout` caught it).
- **Tests:** new `tests/unit/coach-insights-scoreboard-guard.test.ts` (B1 skin + gap dividers + hover
  image + visible track; A1 both renderings + ≤640 hide + four rows + pips once + sentence case; C1
  the Attendance band never hidden, never rows); `coach-first-screen-guard.test.ts` follows the
  rename and the component.
- **Layout baseline:** one entry added — the Dashboard's "#5 Emerson Test…" What stands out row at 768
  is the same accepted 40px `.insightsCo` debt as the "#1 Avery Test…" entry (the fixture's data
  renamed the finding); its fix stays with the touch-target project (stage 6 ask T).

### Verified

- Unit: 4,710 / 4,712 — the two failures are `coach-schedule-doors` and `rep-award-occasion`, whose
  modules another session is editing in the shared tree (not touched here); the two guard files 21/21.
- `tsc` clean (after `npx next typegen`); focused ESLint 0 errors (warnings pre-existing); CSS
  purity, spelling, contrast, css-selectors, the rest of `verify:changed` green.
- `check:layout --only=coach-history,coach-attendance,coach-overview` at 361/390/768/1440: no new
  findings.
- Built measurements: `.probe/scoreboard-built.mjs` (390, 360, 768, 1280) — the table in §3.

### Revised on the owner's first look (2026-09-25)

> "on the computer I think we can make the record one smaller so attendance can fit on narrower
> screens. maybe remove the 'Scrimmages left out' note"

⚠ Corrected on the way: the Overview's desktop Record tile DOES carry a note — "Scrimmages left out"
(its `sub`) — and the record FAQ ("the tile says so underneath the number") points coaches at it; only
the PHONE rows show the record without one. So the choice was shorten-to-match vs remove, measured on
the live page (`.probe/record-note-widths.mjs`, the narrowest window at which the band is one line):

| Record note | Record width | One line down to a window of |
|---|---|---|
| "Games + tournaments · scrimmages left out" | 284px | 1,150px |
| **"Scrimmages left out"** (the Overview tile's words) — built | 149px | **1,010px** |
| none | 118px | 980px |

Built: `scopeCaption = 'Scrimmages left out'` — one wording on both dashboards; removing it bought
30px more. Verified built: one line down to 1,010px, the band 103px at 1280. The guard asserts both
dashboards carry the same words.

## 6. Found, not this work's

- The saved UAT coach session had expired mid-session (probes land on sign-in); refreshed with
  `npx playwright test --project=auth-setup --grep "authenticate: coach"`.
- Nine layout-baseline entries on these three screens no longer reproduce (the tab arrows widened by
  stage 6, the callout arrow's contrast, the renamed finding) — a `--prune` for whoever owns the next
  baseline pass.

## 7. /review and /docs (2026-09-25, after the walk)

**/review** (standard tier — shared portal stylesheet + a new shared component; three lenses:
correctness, blast radius, CSS cascade). 9 raised → 2 confirmed and fixed, the rest ruled out or by design:
- **[Medium] the band's `overflow: hidden` clipped the keyboard focus ring** — the portal's outset
  `:focus-visible` ring landed outside every tile's edge (cut above and below every tile and at both
  ends). Fixed: `a.insightsStat:focus-visible { outline-offset: -2px; }` — the framed row list's own
  fix. Verified live: offset −2px on a tabbed-to tile.
- **[Low] the pips' `aria-label` ("Recent form, oldest to newest") replaced their letters in the
  link's name** — a screen reader heard no result on the phone's Record row or the desktop Form tile.
  Fixed: the label spells them out ("Last 5, oldest first: W L T W L"), as the Overview's row does.
- Ruled out with evidence: no remaining reference to the old class names anywhere; no reader of the
  dropped `data-tone="default"/"muted"` values; no demo anchor or UAT spec touched; band and rows
  read identical conditions and values; `diffLabel` right for every sport pack; `--card-bg` opaque in
  both skins; no competing `.insightsStat` rule. By design: `[data-words]` outranking a tone (a
  worded figure is muted); the hover no longer fades (a background image does not transition).

**/docs** — `lib/help-content/coaches.tsx`, the Insights section: "Reading Insights on a phone" gains
the Dashboard (one short row per figure, the Overview's rows, record and last five sharing one);
the Dashboard article's scoreboard bullet adds that the record leaves scrimmages out; keywords +
searchText learn the phone terms. `help-articles` + `help-subtopics` tests 45/45; measure:help leaves
the section under the standard.

Gate after both: tsc clean · the two guard files 22/22 · focused ESLint 0 errors · css-selectors,
purity, contrast, spelling green.
