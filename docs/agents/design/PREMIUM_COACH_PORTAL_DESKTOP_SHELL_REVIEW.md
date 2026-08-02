# Design Review — Premium Coaches Portal desktop shell vs Tournament Admin shell

**Date:** 2026-08-01 · **Status:** Evaluation delivered, decisions D1–D4 pending owner ratification
**Mockups (approval = binding spec):** `claude.ai/code/artifact/949c4e72-05f7-47b5-bceb-63d5c9b7a8ed`
**Trigger:** Owner comparison of the two shells on desktop — "so much empty space on the right side of the
coaches portal", "headers on each screen are not pinned to the top like the tournament admin".
**Method:** 5-agent parallel ground-truth read (both shell anatomies, full per-page width survey, both
convention inventories), all facts line-cited; key claims re-verified by direct read.

Governing prior decisions honored here:

- **2026-07-25 two-family ruling** — Premium Coaches Portal is operator-family with admin; shell
  convergence is the standing direction. This review specifies the two highest-felt pieces of it.
- Warm paper theme is settled (this review changes layout, never colour).
- CoachTopStrip has **no bell by design** (comment at `components/coaches/CoachTopStrip.tsx:16` — bell
  lives in the sidebar header). Not a gap; do not re-propose.
- Two-breakpoint rule (`coaches.module.css:1-9`: 900 shell / 640 content) is preserved by every proposal.
- Deliberately-narrow surfaces stay: practice **run** screen (480px, `.ppRunPage`,
  `coaches.module.css:5825`), Development band stack, Chat (already full-bleed via
  `chat.module.css` negative margins).

---

## Ground truth (the numbers behind the felt difference)

| Dimension | Tournament admin | Premium coaches portal |
|---|---|---|
| Sidebar | 240px, `position: sticky` (`AdminSidebar.module.css:1-14`) | 220px plain flex child, own `overflow-y` (`coaches.module.css:305-318`) |
| Content width | **Fluid** — `.adminMain` flex:1, no max-width anywhere; `.mainPad` 2rem (`admin.module.css:21-39`) | `.page` **max-width: 960px, no centering** (left-anchored); `.pageWide` 1200px opt-in used by 2 surfaces (`coaches.module.css:432-444`) |
| Pinned identity | `AdminEventHeader` sticky top=48px z40, never collapses on desktop, publishes `--admin-header-h` for stacked toolbars (`AdminEventHeader.tsx:63-97`) | **Nothing.** `.pageHeader` has no sticky rule; only the fixed 48px CoachTopStrip pins (`coaches.module.css:446-537`) |
| Scroll container (desktop) | Window scrolls (deliberate, so sticky pins to viewport — `admin.module.css:29-32`) | `.coachesMain` is its own `overflow-y:auto` container (`coaches.module.css:270-280`) — convenient: `position: sticky; top: 0` inside it Just Works |
| Density | `[data-density]` compact/comfortable, `AdminDensityProvider`, no-flash script (`lib/admin-density.tsx`) | None — zero occurrences under `app/[orgSlug]/coaches` |
| At 1920×1080 | Content uses full ~1650px working area | ~676px of dead space right of the 960 column |

Page survey verdicts (full survey in the workflow output; container per page):

- **Top offenders:** Season-end (inline `maxWidth: 560` inside `.page` — `season-end/page.tsx:110`);
  Roster player detail (9 stacked `.detailSection`s, natural rail candidate); Lineups builder
  (`.lineupSummaryWrap{overflow-x:auto}` inside 960 — `coaches.module.css:4030`); Money·Budget
  (12-month grid in CoachScrollX at 960 while sibling **BvA already widened to 1200 for the same
  problem** — `bva.module.css:1-9` cites review f9-2; `budget.module.css:1-3` still 960 = drift);
  Money·Dues (7-col table at 960).
- **Already good:** Schedule calendar + Roster depth view (both `.pageWide`), Chat (full-bleed),
  Practice editor + Staff (real right rails — but nested INSIDE the 960 cap, so the rails never reach
  the desktop's actual free width).
- **Fine as narrow:** Announcements, Settings, Tournaments, Lineups hub, Fundraisers/Payment requests.

---

## Issues Found

1. **Default page column is 960px and left-anchored; the working area right of it renders only the
   blueprint-grid background.** Severity: High | `coaches.module.css:432-444`, `:270-280`
2. **No identity/header pinning anywhere in the portal on any width** — team, season, and archive state
   scroll away; admin pins all three equivalents. Severity: High | `coaches.module.css:446-537`
3. **Width drift between siblings:** Budget 960 vs Budget-vs-Actual 1200, same grid shape, the 1200 fix
   was explicitly justified and never propagated. Severity: Medium | `budget.module.css:1-3` vs `bva.module.css:1-9`
4. **Season-end double-caps to 560px** inside the 960 page — the "skinny content floating in space"
   extreme. Severity: Medium | `season-end/page.tsx:110`
5. **Dense tables (Dues, Roster, Documents, Expenses) and 2-D grids (lineup builder) locked to the
   reading-column width**, self-scrolling sideways on monitors with 700px sitting empty. Severity: Medium
6. **No density choice** despite the design principle that density is a user choice on operator surfaces.
   Severity: Low | principle in `memory/design_principles.md` (responsive philosophy)
7. **Player profile is nine stacked full-width sections** — CRM-shaped content with no rail, no collapse,
   no deep links. Severity: Medium | `roster/[playerId]/page.tsx:287-660`

## Works Well (do not disturb)

- The per-page header idiom itself (`.pageHeader`/`.headerIcon`/`.pageTitle`) is centrally defined and
  consistently reused across ~29 pages — the problem is pinning/width, not the idiom.
- CoachScrollX + pinned-first-column + honest swipe hint is the right primitive and stays the answer
  when content genuinely overflows.
- Sticky bottom action bars, `.tableAsCards`, the 640/900 discipline, warm-gate architecture.
- Sidebar grouping already matches the domain-grouping the two-family ruling asked for
  (Overview + Squad/Season/Money/Communication/Team admin — `CoachesSidebar.tsx:24-63`).

## Recommended Fixes (decision list)

- **D1 — Width strategy. Recommended: Option B.** `.page` default → 1200px **centered**
  (`margin-inline:auto`); new narrower centered variant (~840–960) for compose/read surfaces
  (Settings, Announcements, Tryouts, Money hub, Tournaments, Season-end); logged-narrow screens
  untouched. Alternatives: (A) fluid like admin — honest convergence but every page needs internal
  caps, most rework; (C) rails everywhere — bespoke per-page design work, deferred to D3's player
  profile. Centering matters as much as the number: split margins kill the "everything is missing on
  the right" read even where content stays narrow.
- **D2 — Pinned team header. Recommended: shell-owned slim bar (~44px)**, rendered by the coaches
  layout above `{children}`: org eyebrow · team name · season chip (or **"2025 archive · read-only"**)
  · FlipPill header-right (standing rule). `position: sticky; top: 0` inside `.coachesMain`; publishes
  `--coach-header-h` (mirror of `--admin-header-h`) so in-page sticky bars can stack; mobile
  collapse-on-scroll with hysteresis, mirroring `AdminEventHeader.tsx:63-97`; desktop never collapses
  (same owner call as admin). Archive chip makes the frozen-season state ambient instead of
  page-by-page. Alternatives rejected: pinning per-page headers (tall, ×29 pages); waiting for full
  shell convergence (a program, not a fix).
- **D3 — Worst-five batch:** Season-end centering; player profile → main column + quick-facts rail +
  collapsible deep-linked sections (adopt/port CollapsibleCard behavior); lineups builder, Budget,
  Dues to wide. **Budget↔BvA drift gets fixed regardless of D1.**
- **D4 — Convention adoptions:** density toggle (portal tables adopt the existing `--admin-row-*`
  token mechanism or a coach-scoped mirror — needs a token-scoping decision, since density vars are
  currently deliberately admin-only per `globals.css:251-255`); ExportMenu standard on surfaces that
  already export; CollapsibleCard rides with D3.

**Explicitly not proposed:** dark re-theme; bell relocation; touching run screen/Development/Chat;
new breakpoints; full AdminChrome/coaches shell component merge (still the long-term direction —
D1+D2 are designed to be the pieces such a merge would keep).

**Next step on ratification:** plan + PM brief in `docs/projects/active/` (one build chunk for D1+D2+D3,
D4 items tagged on or queued), mockup artifact becomes binding, design decision logged to
`memory/design_decisions.md`.
