# Coach Lineups IA + Insights Hub — Implementation Plan

> **Status: ✅ COMPLETE — owner browser-verified 2026-07-10, committed, ARCHIVED.** Phase 1 (Lineups tabs + filter bar, /review'd) + Phase 2 (Insights consolidation) + Phase 2b V3 ("Scoreboard + What stands out" dashboard + report pages + findings engine, /review'd with 6 fixes folded). Season-over-season comparisons retired (owner). Note: Phases 1+2 were swept into another session's commit `f697d31c` (2026-07-09); the V3 build is the 2026-07-10 commit. Both throwaway mockups deleted. Remaining follow-ups live in Phase 3 (growth: player stats / opponent scouting — separate sign-off) and one cleanup note: `lib/season-compare.ts` is orphaned (only its own test imports it) — remove with its test in a future sweep.
> **Created:** 2026-07-08
> **Branch:** `dev`
> **PM brief:** [COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PM_BRIEF.md](COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PM_BRIEF.md)
> **Scope:** Premium Coaches Portal only (`/{orgSlug}/coaches/teams/{teamId}/*`). **No migration anywhere in this plan** — every option below composes existing data + APIs.
> **Plan gating:** no new billing gate. Everything rides existing Premium Coaches Portal access (standalone $29/mo per team, or League/Club org plans) and existing per-assistant capabilities.
> **Related:** [COACH_LINEUPS_HUB_PLAN.md](COACH_LINEUPS_HUB_PLAN.md) (what just shipped and created Problem 1), [COACH_PORTAL_IA_UX_REVIEW_PLAN.md](COACH_PORTAL_IA_UX_REVIEW_PLAN.md) (§5.1 placement rubric + §9 binding constraints — this plan is a direct continuation of its anti-"stacking" mandate).

---

## 1. The two problems (owner, 2026-07-08)

1. **The Lineups page is a "basic stacked approach."** Three genuinely different jobs — build a game's lineup (game day), manage reusable templates (prep), review season analytics (reflection) — are piled vertically on one scrolling page. A coach on game day wants one thing; the page makes them wade past a template manager and five analytics accordions to realize the games list at the top was the thing they wanted.
2. **Analytics & reporting are scattered across the portal** (the bigger problem). Season-level "how are we doing?" read-outs live in five corners today, and upcoming features (player stats, opponent scouting) have no home at all.

---

## 2. Current state (code-verified 2026-07-08)

### 2.1 The Lineups page as shipped (`app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx`, 560 lines)

Top-to-bottom: compact `pageHeader` (icon + "Lineups" + subtitle + **lime "New template"** header action) → **Games** (Upcoming, uncapped, soonest-first, readiness chips probed per-game up to 20 · Recent, capped 6) → **Templates** manager (rows: name → template builder; Apply via centered modal with overwrite-aware confirm; inline rename; delete) → **Season analytics** (honesty line + five native `<details>`, default collapsed: fair playing time, bench balance, position variety, arm-care [omitted entirely with no pitching data], records by reused lineup) → Apply game-picker modal. Sub-pages already exist: `/lineups/[eventId]` (game builder, 587 lines) and `/lineups/templates/[templateId]` (template builder, 185 lines), both composing the shared `_LineupEditor.tsx` (534 lines). Analytics come from `GET .../lineup-analytics` → pure `lib/lineup-season-analytics.ts`.

**Gating:** page + all three data loads gate on `capabilities.lineups` (client UX + server `denyUnless`). Analytics are lineup data, not guardian PII — correctly NOT behind `rosterPii`.

### 2.2 Design-system assessment of the shipped page

What it gets **right**: compact operating-tool header (no hero); honest empty states everywhere (zone-level "No season trends yet", arm-care hidden without data, "Based on the N games you've saved a lineup for" basis line); exactly one `btn-lime` in the DOM so CP-1 *technically* holds; native `<details>` per the locked Q2 decision; 640px icon-only row actions.

What it gets **wrong** (the IA case, beyond "it feels stacked"):

| # | Finding | Why it matters |
|---|---|---|
| W1 | **The single lime is spent on "New template"** (header, `page.tsx:278`) — a few-times-a-season prep task. The hub plan's own §6 spec said the lime = **"Build lineup" for the nearest game that needs one**, and the binding 2026-07-04 Overview-anchor decision sets the IN-SEASON lime semantic portal-wide to "Build lineup". | CP-1's letter holds; its intent (lime = the one thing you came to do) is inverted. The page visually announces itself as a template tool. |
| W2 | **Three rubric categories on one surface.** Per the IA review's §5.1 rubric: Games = *Operate*, Templates = *Manage*, Season analytics = *Review*. The review's core finding was that stacking rubric categories is how the portal accreted its junk drawers. | The page repeats, in miniature, the exact disease the IA review existed to cure. |
| W3 | **Upcoming games are uncapped** (`:76`) and Recent renders even when it's the only section — mid-season the list pushes Templates/analytics hundreds of px down; off-season the page *leads with stale past games* (exactly what the owner's screenshots show). Readiness probing is also N+1 (one fetch per upcoming game, cap 20). | Game-day speed degrades exactly when the season is busiest; first impression off-season is a rear-view mirror. |
| W4 | Templates zone renders a second "New template" (outline, empty state) *while the header lime "New template" is visible above it* — two identical CTAs on first visit. | Redundant affordance noise on the page's very first render. |
| W5 | Apply game-picker uses `modalOverlay`/`modal` without `.sheetOnMobile` — stays a centered dialog at 640, off-convention. | Mobile convention drift (locked 2026-06-29 conventions). |
| W6 | Templates + analytics fetch failures are swallowed silently — the zone sits in loading/empty state forever with no error text. | Violates the UX-agent error-state rule; an outage reads as "you have no templates." |
| W7 | Mobile: all three zones stack below the (compacted) header; analytics accordions start ~2 screens down mid-season. Bottom nav reaches Lineups only via **More**, so the deep scroll compounds a 2-tap entry. | The one page a coach opens field-side is the portal's longest scroll. |

### 2.3 The analytics scatter (inventory, code-verified)

Season-level analytical read-outs currently live in **five places**, four different gates:

| Home | Route | What lives there | Gate |
|---|---|---|---|
| Lineups page | `/lineups` | 5 lineup analytics (fair play, bench, variety, arm-care, records by reused order) | `lineups` |
| **Attendance report — a nav ORPHAN** | `/attendance` | per-player season reliability (games + practices attended/known; explicitly "not a ranking") | `roster !== 'off'` — reachable ONLY via a button on the Roster page; it is in **no nav menu at all** |
| Money hub + 7 sub-pages | `/accounting/*` | Budget-vs-Actual (variance + monthly chart + dues collection rate), dues table + never-paid list + refund calculator, expenses, fundraisers, allocations, payment requests | `money !== 'off'` (tri-state; write actions on `write`) |
| Season Review | `/history` | this-season-vs-last trend stats (win% Δ, roster Δ, dues Δ, expenses Δ), past-season cards (record, tryout acceptance %, money rows) | nav open to all assigned; money rows nulled server-side without money access |
| Overview (glances) | `/` | SeasonRecordWidget (W-L-T, form pips, streak, diff), snapshot tiles (dues/budget/next-up attendance), money-gated "Last season" tile | per-tile gates |

Plus in-context per-entity views that should stay in context: per-player attendance + dues on `/roster/[playerId]`, per-game analysis inside the builder, tryout scoreboard inside `/tryouts` (operational + blind-mode; not hub material).

**Structural facts that shape the options:**
- **Season Review already IS the Review-rubric destination** — but it sits in the **Team admin** group, a compromise the IA review itself flagged (§5.2: "History is a Review-rubric item placed in Team admin to avoid a thin one-item group").
- The **Season group currently holds only Schedule** for most teams (Tournaments is conditional/Explore) — it has room.
- **Money analytics are inseparable from money operations** — the dues table is also where you mark paid/send reminders; Budget-vs-Actual sits beside the budget editor. Moving money *reports* out would split a workflow; the tri-state gate + per-assistant defaults (`off`) also make Money the most sensitive section.
- The portal has two proven sub-view idioms: **hub + sub-routes** (Money: summary cards + link cards → 7 sub-pages) and **in-page segmented toggle** (Roster list⇄depth chart, Schedule list/week/month).
- The nav has a generic, cheap **Explore-graduation** mechanism (hidden → explore → primary on a per-assignment boolean signal) if a new destination ever needs hide-until-used behavior.
- Standings/placement remain CUT (owner 2026-07-06) — no standings section anywhere in this plan.

---

## 3. Problem 1 — Lineups page IA: options

### Option 1A — "Game-day front door" (rubric split) — **RECOMMENDED**

The Lineups landing keeps exactly one job: **get me into a game's lineup.**

- **Games zone leads** and gets bounded: next N upcoming (≈5) with readiness chips + a "Show all upcoming" expander; Recent collapses to a link-row ("Recent games ▸") or short tail. Off-season (no upcoming): a calm "Season's quiet — recent lineups below" framing instead of leading with stale games.
- **The lime moves to "Build lineup"** on the nearest game without a saved lineup (identical semantic to the Overview IN-SEASON anchor). No game needing one → no lime on the page (lime is earned, not mandatory).
- **Templates become a compact strip** on the landing: template chips/rows with one-tap **Apply** (the game-day-adjacent action stays put) + a quiet "Manage templates →" link.
- **Template management graduates to `/lineups/templates`** (index sub-page): full manager (new / rename / delete / apply / open builder), its own single lime = "New template", "← Lineups" back-link per the 2026-07-08 breadcrumb rule. The builder routes already live under this path — the index completes the family.
- **Season analytics leave the page** → they move to the Insights destination (Problem 2), replaced by a quiet blueprint-blue "Season insights →" link. *(If Problem 2 is deferred, the analytics zone simply stays as-is at the bottom — Option 1A degrades gracefully.)*

Trade-offs: **+** page = one job, game-day speed restored; **+** each zone lands in its rubric home (Operate / Manage / Review); **+** fixes W1–W4 in one move; **−** template rename/delete is now one tap deeper (mitigated: Apply — the frequent action — stays on the landing); **−** medium build (~0.5–1 day), one new index route.

### Option 1B — In-page tabs (Games | Templates | Insights)

One route, one segmented control (Roster list⇄depth precedent), default tab Games; analytics stay in Lineups as the third tab.

Trade-offs: **+** one destination, cheaper than 1A, analytics discoverable where lineup-minded coaches look; **−** two rarely-used jobs get permanent chrome on the game-day surface; **−** does nothing for Problem 2 (lineup analytics stay siloed from attendance/records); **−** the portal's existing toggles switch *views of one dataset*, not *different jobs* — this would be a new pattern; **−** tab state needs query-param deep-linking to be shareable.

### Option 1C — Reorder + progressive disclosure (minimal)

Keep the single page: lime→"Build lineup", cap upcoming, collapse Templates to a summary row that expands in place, analytics stay collapsed at bottom.

Trade-offs: **+** cheapest (hours); **+** fixes W1/W3/W4; **−** still a three-job stack — the structural complaint survives; **−** Templates manager squeezed into a disclosure widget; **−** invisible to Problem 2.

**Recommendation: 1A.** It is the only option that answers the owner's actual complaint (three jobs ≠ one page) instead of softening it, and it composes with either Problem-2 outcome. 1C is acceptable as a stopgap if the owner wants zero route changes this cycle.

---

## 4. Problem 2 — Reporting/analytics architecture: options

### Option 2A — One "Insights" destination in the **Season** group — **RECOMMENDED**

Evolve **Season Review (`/history`) into the portal's single Review-rubric home** and move it Team admin → Season:

- **Nav:** Season group = Schedule · **Insights** · Tournaments *(conditional)*. Team admin sheds its one misfiled Review item (becomes Staff / Documents / Settings — an honest back-office). Item count unchanged; still six group headers.
- **Hub landing (reuses the existing `/history` page as its backbone):** section-carded, one honest headline per section, drill-in for depth — the proven Money-hub idiom, NOT a new long stack:
  - **Results & records** (open to all assigned coaches): this-season-vs-last trend stats + past-season cards — already on this page today.
  - **Playing time & lineups** (`lineups` gate): the five analytics move here from the Lineups page (component + existing `lineup-analytics` API move nearly verbatim; honesty line intact).
  - **Attendance & reliability** (`roster !== 'off'` gate): headline (e.g. "Attendance recorded for N events") + drill-in to the existing `/attendance` page — **which finally gets a nav home** (it gains a "← Insights" back-link; the Roster page keeps its in-context button).
  - **Money reports** (`money !== 'off'`): a **cross-link card only** ("Budget vs. actual · Player dues →" into the Money hub). Money analytics stay IN Money — reports and operations (mark paid, send reminders) are one workflow there, and the tri-state gate stays in one fortress.
- **Section gating = never render when the capability fails** (matches the page's existing money-row behavior); **data honesty = per-section thresholds already implemented at each source** (no data → the section teaches how to earn it, never zeros-as-content).
- **Glance layer unchanged:** Overview keeps the record widget + tiles + Last-season tile; each glance deep-links into the hub. Principle: **every number gets exactly one deep home + at most one glance.**
- **Future growth slots in:** Player development (per-player stats) and Opponent scouting arrive as new hub sections/sub-pages later — they finally have an address. (If a future section should hide-until-used, the Explore-graduation signal mechanism is available — not needed for V1.)
- **Naming (sub-decision D3):** recommend **"Insights"**; route stays `/history` (label ≠ route is the established precedent — Money→`/accounting`, Season Review→`/history` — and avoids breaking deep-links/help anchors). Cost: second rename of this nav item in a week → help-docs aliases must keep "history", "season review" AND the new name searchable (the alias machinery already exists from the 2026-07-06 rename).

Trade-offs: **+** one obvious answer to "how is my season going?"; **+** repairs two standing IA debts (the `/attendance` orphan; Season-Review-in-Team-admin); **+** future-proof address for player stats/scouting; **+** no migration, mostly relocation; **−** nav churn (rename #2 in a week; /docs pass required); **−** medium build (~1–2 days); **−** risk of the hub itself becoming a new stack — mitigated by the section-card + drill-in structure and per-section gates.

### Option 2B — Grow in place + cross-links only

Everything stays where it is; add links between the analytics corners (Lineups analytics ↔ attendance report ↔ Season Review) and maybe a small "Reports" link list on Season Review.

Trade-offs: **+** near-zero build, zero churn; **−** doesn't consolidate anything — the owner's stated pain survives; **−** `/attendance` stays a nav orphan; **−** player stats will still have no home; **−** produces a link-web IA (every report advertising every other) that ages badly.

### Option 2C — Full Reports hub (money included)

One destination containing team-performance AND money analytics (move or mirror Budget-vs-Actual, dues analytics, etc.).

Trade-offs: **+** literally one place for every number; **−** splits money *reports* from money *operations* (the dues table is also the mark-paid/remind surface) or duplicates them (drift risk); **−** double-gates the hub's majority content behind the most-restricted capability; **−** unwinds the week-old Money hub organization. **Rejected.**

**Recommendation: 2A**, with money deliberately federated behind a gated cross-link card.

---

## 5. How the two decisions interact + sequencing

- **CHOSEN COMBO (owner, 2026-07-08): 1B + 2A.** The original 1B sketch had three tabs; with the Insights hub approved, the lineup analytics move there (one deep home, no mirroring) and the page settles at **two tabs — Games | Templates** — with a quiet "Season insights →" link on the Games tab. A mirrored third analytics tab was considered and rejected (double-homing violates the one-deep-home principle logged with D2).
- Build order unchanged: Phase 1 (tabs + filters) ships first and stands alone. Interim state before Phase 2 moves the analytics: keep the analytics zone rendered BELOW the tab panes (do NOT ship an interim third tab that Phase 2 would delete a week later); prefer building Phases 1+2 in one arc so the interim barely exists.
- Naming/label work in Phase 2 triggers a `/docs` pass once, not twice — batch the Lineups-page copy changes into the same docs update.

---

## 6. Phases (provisional — tasks final only after owner sign-off)

### Phase 1 — Lineups = tabbed page (Option 1B, CHOSEN) + Games filter bar

> **BUILT on `dev` 2026-07-08 (uncommitted).** Files: `lineups/page.tsx` (tabs + filters + bulk readiness + error surfacing + sheet modal), `app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts` (+`lineupSetEventIds`, lineups-gated), `lib/db.ts` (`getRepTeamLineupSetEventIds` bulk helper), `coaches.module.css` (filter-bar/primary/tpl-header classes + 640 wrap rule). `npm run typecheck` clean; `lint:focused` on all three code files = 0 errors, 0 new warnings (the deep-link tab is seeded from Next 16's `searchParams` promise prop instead of a set-state-in-effect, so no new lint debt). Tabs use the portal's real segmented idiom (`.segChoice`/`.segBtn` — **lime active fill**, matching Roster's List⇄Depth toggle; the mockup's blue tabs were an approximation). ⚠ `lib/db.ts` is a shared module → **dev-server restart required before browser testing** (owner browser-passed 2026-07-08). **`/review` high-risk funnel COMPLETE 2026-07-09** — deterministic gate green for THIS diff (the red `verify:changed` items are OTHER sessions' in-flight work: a hex literal in `components/public/FanNotificationBell.module.css` + stale snapshots for their uncommitted mig 179); 4 finder lenses (correctness · security/tenant · contract/blast-radius · UI regression); security + contract lenses CLEAN (capability gate, tenant scoping, PII, consumers, query load, sheet contract all verified). **5 confirmed findings, ALL FIXED in-tree:** (1) **High** — the "Needs lineup" toggle unmounted while still active once the last missing lineup was saved, stranding an all-hidden Games list with no escape → toggle now stays mounted while toggled on (`needsTotal > 0 || needsOnly`); (2) **Medium** — a mid-session capability revocation (stale client cache) falsely badged every game "Not set" → events GET now OMITS `lineupSetEventIds` when lineups-denied and the client renders no badges when the field is absent (mirrors the old probe's no-signal behavior); (3) **Medium** — tabs/chips sat under the 2026-06-29 mobile touch-target convention → `.lineupTabs .segBtn` ≥36px (≥40px @640) + chips min-height 30px (36px @640); (4) **Low** — an in-progress template rename persisted invisibly across tab switches → `switchTab` closes it; (5) **Low** — Templates-scoped notices bled over the Games pane → `switchTab` clears the notice. Advisory accepted, no change: Templates pane uses `aria-label` (the tab button carries the visible label). Re-gate after fixes: typecheck + focused lint clean.

- [x] Segmented **Games | Templates** control on the landing (reuse the Roster list⇄depth `.segChoice` idiom), Games default; tab deep-linkable via query param (e.g. `?tab=templates`) so Overview CTAs land on Games and template links land on Templates (`app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx`)
- [x] **Games filter bar (v2 /design pass — ✅ ACCEPTED by owner 2026-07-08, incl. dropping the "Show:" label):** two composable dimensions, not one flat row. (a) **Scope chips** — worded select-one chips `All · League · Tournament · Scrimmage`, **no leading label** (dropped per owner 2026-07-08: the attendance list-filter bar is label-less and "All" + list placement already read as a filter; a leading label like WLT's "Counting:" is reserved for stat-scope toggles that change a number's meaning), no counts, active = lime tint + 12px check (WLT check-chip convention); **a type chip hides when the team has zero games of that type**. (b) **"⚠ Needs lineup" toggle chip** — warning icon always `--warning`, selected = warning-tint fill (attendance "selected fills its own status colour" convention), carries the bar's ONE live count (scoped to the selected type), composes with scope (e.g. Tournament + Needs lineup), hides when the season has nothing to triage. **Chips never take solid `--primary`** — that's the segmented tab's active state; the two control species must read differently (chips = smaller tinted fills). Filters span Upcoming + Recent (kickers hide when emptied); honest empties ("No games match" / "All caught up — every game here has a lineup." when the toggle is on); wraps at ≤640 into scope row + toggle row (never horizontal scroll); extensible later (home/away, month)
- [x] **Bulk lineup-existence flag on the events read** (mirrors `lineupMismatchEventIds` on the events GET, gated on `caps.lineups`): powers the Needs-lineup chip + readiness chips on ALL rows incl. recent (backfill use-case feeds the Insights basis count) and **retired the N+1 per-game readiness probes** (`READINESS_LIMIT` machinery deleted)
- [x] Games tab lime → "Build lineup" on the nearest **visible** upcoming game without a saved lineup (respects the active filters; D4 default: no qualifying game → no lime on this pane). Styled span inside the row Link so the row stays one interactive element
- [x] Templates tab = the full existing manager (rows/rename/delete/apply); its single lime "New template" moved here from the page header (header action removed; when the pane is empty the empty-state CTA is the lime — no duplicate). CP-1 = one lime per **visible tab pane** (logged)
- [ ] Quiet "Season insights →" link at the bottom of the Games tab — **deferred into Phase 2** (the hub doesn't exist yet; linking to nothing would be dishonest). Interim as planned: the analytics zone stays rendered below the tab panes
- [x] Apply game-picker modal → `.sheetOnMobile`
- [x] Quiet error text when templates/analytics fetches fail (stop swallowing) — W6 ("couldn't be loaded — refresh to try again")
- [x] Focused verify: `npm run typecheck` clean + `lint:focused` 0 errors/0 new warnings (no schema change → dictionary n/a). **Pending: owner browser pass (desktop + ≤640px) + `/review`**

### Phase 2 — Insights destination (Option 2A)

> **BUILT on `dev` 2026-07-09 (uncommitted).** Nav: `/history` moved Team admin → Season in BOTH components, label "Season Review" → **"Insights"**, icon `History` → `BarChart3`, gate case renamed in `lib/coach-nav-visibility.ts` (still open to any assigned coach). Hub: `history/page.tsx` restructured into sections — **Results & records** (existing this-vs-last + past seasons) · **Playing time & lineups** (`caps.lineups`; the five collapsibles + honesty line MOVED here; fetch waits for ctx + capability; a 403 sets `analyticsDenied` and HIDES the section — stale-cap honest) · **Attendance & reliability** (`caps.roster!=='off'`; `.moneyCard`-idiom link card → `/attendance`) · **Money reports** (server `canViewMoney`; link card → `/accounting`). Lineups page: analytics zone + fetch REMOVED, quiet blueprint "Season insights →" link at the bottom of the Games pane. `/attendance`: dead hidden breadcrumb replaced by a visible "← Insights" back-link (`.lineupBackLink`, 2026-07-08 rule). Overview: `SeasonRecordWidget` gained an optional `insightsHref` prop → quiet "Season insights →" footer link. `npm run typecheck` clean; `lint:focused` across all 8 touched files = 0 errors, 0 NEW warnings (7 pre-existing in untouched regions). ⚠ Shared components/lib touched (both navs, widget, nav-visibility) → **dev-server restart required before browser testing.**

- [x] Nav: move `/history` item Team admin → Season; label per D3; both nav components pick it up via the shared `TEAM_NAV_GROUPS`/`MORE_SECTIONS` arrays + `lib/coach-nav-visibility.ts` (gate stays "always visible to assigned coaches")
- [x] Restructure `/history` landing into sections (Results & records · Playing time & lineups · Attendance · Money cross-link), per-section capability gating (`app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx`)
- [x] **Layout corrected 2026-07-09 (owner rejected the stacked V1):** the four domains now compose as a **dashboard card grid** (`.insightsGrid`, auto-fit 340px, Overview-tile idiom) — all visible in one desktop viewport; past seasons compacted from fat year-cards to one-line expandable rows; Attendance/Money are whole-card links. Owner's general rule logged as **BINDING** in `memory/design_decisions.md`: *page scroll = one long homogeneous list, never travel between domains; multi-domain pages compose as grid or tabs.* typecheck + lint re-run clean (0 new warnings)
- [x] Move the five lineup-analytics collapsibles + honesty line from Lineups into the hub (component move; existing `lineup-analytics` API unchanged); Lineups gets the quiet "Season insights →" link
- [x] `/attendance`: "← Insights" back-link (2026-07-08 breadcrumb rule); hub Attendance card links to it; Roster keeps its button
- [x] Overview glances deep-link into the hub (record widget `insightsHref` footer link; Last-season tile already links to `/history`)
- [x] `/docs` pass DONE 2026-07-09 (batched Phase 1+2): premium-portal-tour section (nav groups: Insights in Season, Team admin slimmed; Lineups = Games/Templates tabs + filter row), find-lineups FAQ rewritten (tabs + filters + where-analytics-went), attendance-season FAQ (Insights → Season attendance path first, Roster path kept), lineup-analytics FAQ (now "in Insights", move note), templates FAQ ("Templates tab"), start-next-season section + both FAQs (Season Review → Insights), Last-season tile mention. Alias chain extended: "history" → "season review" → "insights" all searchable (keywords + searchText + answerText mirrors kept in sync). `lint:focused` clean; content-only (hot reload, no restart needed for docs)
- [x] Focused verify + typecheck (shared nav module touched) — clean. **Pending: owner browser pass; offer `/review`**
- [x] Log accepted decisions to `memory/design_decisions.md` (done 2026-07-08, D1–D3)

### Phase 2b — Insights V3: "Scoreboard + What stands out" dashboard (direction set 2026-07-09, MOCKED, awaiting owner mockup sign-off before build)

> **Owner rejected the V2 grid on substance (2026-07-09):** money tile = hollow link, results card = mostly empty, playing-time = closed accordions that reflow the grid when opened. Ask: "meaningful analytics a coach understands the first time they open the page… help the coach on their journey." An ultracode design workflow ran (data-feasibility audit + 3 competing concepts + 3-lens adversarial judge panel, 7 agents): **unanimous winner = "Scoreboard + Smart Callouts"** over "dense KPI tiles" (no triage layer; degrades toward the rejected grid) and "BI report-picker" (hides 5 of 6 domains behind a click on first open).
>
> **The V3 model (owner accepted all three direction recommendations 2026-07-09):**
> 1. **Season scoreboard band** — record (ONE definition + scope caption; note: codebase has TWO conflicting W-L-T definitions, reconcile to the record-widget one), form pips, streak, run diff (two-segment lime/grey proportion bar), **close-games record** (games decided by one run; margin threshold via the Sport Pack), attendance % (roster-gated), dues % collected + proportion bar (money-gated). Blocks omit without data; band re-wraps to fill gaps; single skeleton load, no staggered spinners.
> **Season-over-season comparisons RETIRED (owner, 2026-07-09):** youth seasons aren't comparable (teams age up divisions, competition changes, rosters turn over) — NO cross-season delta metrics or trend arrows anywhere in Insights. This retires the V2 "This season vs last" TrendStat panel (win%/roster/dues/expenses deltas) in the V3 build and replaced the planned win%-vs-last band block. **Past seasons stay as a plain ARCHIVE** (per-year records inside the "How are we doing?" report — a scrapbook, not a scoreboard); the Overview "Last season" tile is archive display and stays. The honest "are we improving?" signals are WITHIN-season: form, streak, close-games record, and findings rules like home/away splits ("All 3 losses came on the road"), momentum ("won 5 of your last 6"), and milestones. `/docs` task at build: rewrite the "improving year over year" FAQ to the within-season framing.
> 2. **"What stands out" (centerpiece, owner-accepted):** ranked plain-language findings (cap ~6), severity dot + sentence + report link. Rules engine = new pure `lib/insight-findings.ts` (no I/O, unit-tested like `lib/lineup-season-analytics.ts`), thresholds REUSED from vetted libs (arm-care caps, `isNeverPaidPlayer`, attendance known>0), ordering = **hardcoded priority ladder (safety → money → attendance → fairness → good news), never a scoring model**. No qualifying data → row doesn't fire; quiet week → one calm line.
> 3. **Question-titled report doorway tiles** ("How are we doing?" / "Is playing time fair?" / "Who shows up?" / "Where's the money?") — one honest summary stat each, opening **separate full report pages** (owner-accepted depth model): playing-time = ONE unified per-player table (On field / Bench / Back-to-back / Positions / Pitching w/ cap flags) + "Which lineup wins?" table — accordions eliminated; attendance = existing report + "Manage RSVPs →" ops link; money = headline numbers on the dashboard (owner-accepted; Overview-dues-tile precedent), full reports stay in Money. **Sparse ≠ gated:** permission-gated tiles VANISH; sparse-data tiles stay visible de-emphasized with honest teach copy.
> **Data audit (workflow):** every number computable TODAY from existing endpoints (events / history / lineup-analytics / attendance / dues / budget — ≤6 fetches, Overview-style) or via one new composed read-only `insights` endpoint (all helpers exist; per-section gating server-side; recommended). Traps pinned: dual W-L-T definitions; `result` NULL ≠ loss; attendance 0/0 = "not tracked yet" never 0%; reused-lineup records use scoredGames; /history money-nulling (not 403) pattern.
> **Mockup:** `public/mockups/insights-dashboard.html` — dashboard + the playing-time report page + brand-new-team sparse state + desktop/phone toggles. Build only after owner signs off on the mockup.

> **V3 BUILT on `dev` 2026-07-10 (uncommitted).** Chose the 6-fetch client composition (task 1 option B — zero new backend; Overview-precedent gating: capability-denied fetches are never fired). Files: `lib/insight-findings.ts` (+`tests/unit/insight-findings.test.ts`, 17 tests) · `history/page.tsx` (dashboard) · `history/playing-time/page.tsx` + `history/results/page.tsx` (report pages) · Overview `page.tsx` (armCareFlag safety bridge) · `coaches.module.css` (V2 grid classes deleted, V3 `.insights*` set added) · `lib/lineup-season-analytics.ts` (import → relative `.ts` so `node --test` can run the suite — pre-existing breakage, not mine) · help-content synced (tour, playing-time FAQ → "Is playing time fair?", attendance → "Who shows up?", year-over-year FAQ → within-season framing + stale compare prose in start-next-season fixed). **`/review` funnel COMPLETE 2026-07-10:** 4 lenses (correctness · data-honesty · capability/tenant · regression); capability lens fully clean (gated fetch/render verified per role, no PII in findings, no new endpoints); **6 confirmed findings ALL FIXED in-tree:** (1) dues overdue missing midnight truncation (same-day disagreement w/ Overview); (2) results doorway could show fabricated "0-0" when results exist only outside the record scope (now scoped-aware, count fallback); (3) stale-team flash on client team switch (loadedFor guard, all 3 pages); (4) attendance thresholds unified via exported `ATTENDANCE_MIN_KNOWN`/`ATTENDANCE_FLAG_BELOW` (tile said 70%, engine used 60%) + team-% now requires the min sample; (5) permitted-but-FAILED fetches no longer masquerade as "no data yet" (per-source error copy on tiles); (6) stale V2 season-compare prose in help content. **1 refuted:** money tile mixing /history % with /dues never-paid — both computations are credit-blind over the same installments, cannot diverge. Accepted (cleanup debt, not fixed): `lib/season-compare.ts` now orphaned (only its own test imports it — remove with its test in a later sweep). Re-gate: 27/27 unit tests · typecheck clean · lint 0 errors/0 new warnings. ⚠ NEW ROUTE FILES + shared lib → **dev-server restart required (stop → clear `.next` → start)** before browser testing. Pending: owner browser pass → delete both mockups → commit.

**V3 build — ONE phase, ordered tasks (no migration; executor: this plan + the mockup are the binding spec — a fresh session must read both plus the extensibility/boundary invariants below and the data-audit traps above before writing code):**
- [ ] 1. Data layer: composed read-only `GET /api/coaches/[orgSlug]/teams/[teamId]/insights` (all db helpers exist; per-section capability gating server-side — money/attendance/lineups sections absent-not-403, mirroring the `/history` money-nulling pattern), OR compose the existing 6 fetches Overview-style. Reconcile to ONE record definition (the record-widget client definition + scope caption) — do NOT mix with the history route's different W-L-T set
- [ ] 2. `lib/insight-findings.ts` — pure rule registry (no I/O) + `tests/unit/insight-findings.test.ts`: seed rules = arm-care over-cap · never-paid/outstanding · attendance reliability (known>0 only) · most-benched/back-to-back · winningest reused lineup (scoredGames only) · home/away split · streak/momentum milestones. Hardcoded priority ladder (safety → money → attendance → fairness → good news); cap 6; every rule links to its report; sentences via Sport Pack vocabulary
- [ ] 3. Report pages: `/history/results` "How are we doing?" (game log + past-seasons ARCHIVE, no cross-season deltas) + `/history/playing-time` "Is playing time fair?" (ONE unified per-player table: on-field/bench/back-to-back/positions/pitching w/ cap flags + "Which lineup wins?" table + "Manage lineups →" ops link). Attendance report = existing `/attendance`; money = Money hub
- [ ] 4. Dashboard: replace the V2 grid in `history/page.tsx` with scoreboard band (record/form/streak/run-diff bar/close-games/attendance%/dues% — omit-without-data, re-wrap, single skeleton) + "What stands out" strip (quiet-line fallback) + 4 question tiles (sparse = visible-softened; gated = vanish)
- [ ] 5. Overview safety bridge: ONE quiet blueprint line when a safety-tier finding fires → Insights (owner may veto; CP-1-safe, never lime)
- [ ] 6. `/docs` re-sync: Insights guide sections + rewrite the "improving year over year" FAQ to within-season framing + aliases
- [ ] 7. `/review` high-risk funnel over the full V3 diff; fold confirmed fixes
- [ ] 8. Owner browser pass (desktop + phone, mid-season + fresh team) → delete both mockup files → commit (explicit owner OK)

> **Extensibility invariants (owner Q 2026-07-09 — BINDING build constraints; growth changes what fills the slots, never the number of slots):**
> 1. **Findings = a rule REGISTRY.** Each rule in `lib/insight-findings.ts` is an independent entry declaring: inputs (a shaped summary object), threshold, sentence template (sport-pack vocabulary — no hard-coded "runs/innings"), severity, priority-ladder position, and link target. New features ship RULES, not UI — the strip's shape (dot + sentence + link) never changes. Strip capped at ~6 shown; more rules = smarter triage, never a longer page. A rule whose input data doesn't exist (team/sport/plan/capability) silently never fires — that's the forward-compatibility mechanism; rules are NOT welded to the current schema.
> 2. **Scoreboard blocks are self-contained** (label + value + qualifier + optional proportion bar + gate + data-presence rule); cap ~7 blocks; a block must be a number a coach already recites — needs-explaining ⇒ report content, not a band block. Multi-sport: blocks/vocab come from the Sport Pack.
> 3. **Tiles = one per REPORT, question-phrased.** A new report (player development, opponent scouting) earns a tile; a new METRIC never does — it lands inside an existing report or as a finding. Tile cap ~6 (same restraint as the six nav headers).
> 4. **Admission test for any new finding rule:** would a coach say this sentence to another coach? Every finding must be verifiable one tap away (no claim without an underlying report row). Ladder order: safety → money → attendance → fairness → good news; new categories get an explicit ladder slot when added, never ad-hoc ordering.
> 5. **Overview ⇄ Insights boundary (owner Q 2026-07-09 — BINDING):** the TENSE TEST decides placement — about the NEXT EVENT (act now: headcounts, lineup-not-set, overdue chase, game-day) → Overview; about the ACCUMULATED SEASON (understand: rates, patterns, records, fairness) → Insights. Insights never shows next-event operational state; Overview never grows season analytics beyond its record-widget glance (+ archive Last-season tile). Shared data appears in different tenses, never the same framing twice ("12 of 15 in Saturday" vs "91% season rate"). One sanctioned bridge (recommended, owner may veto): a SAFETY-tier finding (arm-care over-cap) may echo as ONE quiet blueprint line on Overview linking to Insights — no other findings cross over. Journey model: act (Overview) → accumulate → understand (Insights) → act better.

### Phase 3 — Growth (deferred, separate sign-off)
- [ ] Player development section (per-player stats aggregation — new engine work, own plan)
- [ ] Opponent notes/scouting section (own plan; depends on data model that doesn't exist yet)
- [ ] Optional: hub headline glance on Overview (only if the anchor doesn't already cover it)

**Restart note:** both phases add/move files → dev-server restart at each handoff (stop → clear `.next` → start).

## 7. Gating matrix (hub sections, Option 2A)

| Section | Capability | Data-honesty threshold (already implemented at source) |
|---|---|---|
| Results & records | any assigned coach | ≥1 finalized game (record); "first season" framing when no prior year |
| Playing time & lineups | `lineups` | ≥1 game with a saved lineup; arm-care only with pitching data; reused-records need a ≥2-game signature |
| Attendance & reliability | `roster !== 'off'` | any recorded attendance; per-player "not tracked yet"; explicitly not a ranking; no guardian PII anywhere (verified) |
| Money reports (cross-link card) | `money !== 'off'` | n/a (links into Money's own honest states) |
| Tryout acceptance (inside past seasons) | unchanged (aggregate, open) | unchanged |

## 8. Architectural decisions

- **Decision:** Money analytics stay in the Money hub; Insights links to them. **Rationale:** reports and operations are one workflow there; keeps the tri-state gate in one place; avoids duplication/drift.
- **Decision:** hub = section cards + drill-ins (Money-hub idiom), never a single long stack. **Rationale:** the whole point is to stop stacking; the idiom is proven in-portal.
- **Decision:** one deep home + at most one glance per number; in-context views (roster player page, builder analysis, Overview tiles) stay put and link deeper. **Rationale:** context beats consolidation for operational glances; the hub owns depth.
- **Decision:** label ≠ route (keep `/history`, `/attendance`, `/accounting`). **Rationale:** established twice already; avoids breaking deep-links/help anchors.
- **Decision:** no migration; every option composes existing endpoints. **Rationale:** carries the IA review's migration-free ethos; scope stays IA.

## 9. Open questions (owner sign-off needed before any build)

- [x] **D1 — Lineups page: ✅ ACCEPTED 2026-07-08 — Option 1B (tabs)**, chosen from the browser mockup and reconciled with 2A: **two tabs (Games | Templates)** — analytics move to Insights per D2, quiet "Season insights →" link on Games — plus an owner-requested **Games filter-chip bar** (All / Not set / League / Tournament / Scrimmage, live counts; needs the bulk readiness flag). Mockup updated to the chosen layout with working filters.
- [x] **D2 — Reporting: ✅ ACCEPTED 2026-07-08 — Option 2A.** Insights destination in the Season group; money reports stay in Money behind a gated cross-link card.
- [x] **D3 — Hub name: ✅ ACCEPTED 2026-07-08 — "Insights."** Route stays `/history` (label ≠ route precedent); help-doc aliases keep "History" / "Season Review" searchable.
- [x] **D4 — defaulted 2026-07-08:** no qualifying game → no lime on the Games pane (lime is earned); the Templates pane always carries its own "New template" lime. Owner can override during browser review.
- [x] **D5 — resolved by D1 (tabs):** Upcoming + Recent stay as sections inside the Games tab (Recent keeps its 6-row cap); the filter chips span both.

**Decisions logged:** D1 (tabs + Games filter bar), D2 (Insights destination), D3 (name) — all in `memory/design_decisions.md` 2026-07-08 (binding). No `/strategy` entry needed (no pricing/packaging/gating change) unless the owner turns Insights into a marketed differentiator.
