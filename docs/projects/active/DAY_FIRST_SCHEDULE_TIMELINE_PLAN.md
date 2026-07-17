# Day-First Schedule Timeline — Tournament Mobile Polish, Round 4

**Status:** ✅ FULLY DECIDED (rev 2.2) — all 8 owner decisions accepted 2026-07-14;
**builds AFTER Rounds 1–3** (owner sequencing, 2026-07-14). No backend, no migrations.
**Rev 2 (2026-07-14):** owner feedback from the two test tournaments ("on game day there was a
lot of scrolling to find the games that mattered — they only cared about that day's games")
promotes a **day selector + single-day view** to the core interaction. The rev-1 day-first
timeline survives as the "All days" view and as the internal shape of every selected day.
**Parent project:** Tournament Mobile Polish (docs/projects/active/TOURNAMENT_MOBILE_POLISH_PLAN.md,
finding **F1** — "the single largest structural divergence" from the Phase 3 mockup baseline).
Green-lit via owner decision **G2** (2026-07-14); owner directed 2026-07-14 that it run as
**Round 4** of the polish project rather than a standalone project.
**Companion:** DAY_FIRST_SCHEDULE_TIMELINE_PM_BRIEF.md · Mockups: "Day-First Schedule — Round 4
Mockups" artifact (phone frames; directional, judged at hierarchy/qualities, never pixels).

---

## 1. Problem (from the verified F1 finding)

The public Schedule's Pool Play stage groups **pool-first, then day**: A-Pool Jul 12 →
A-Pool Jul 13 → (scroll past the whole A section) → B-Pool Jul 13. A fan reads the same
calendar day twice, screens apart — on game day the question is "what's happening **today**",
not "what is A Pool doing this weekend". The mockup baseline uses one day header
("SATURDAY · JULY 18") spanning all pools.

## 2. Why this is cheaper than it looks (verified in source, 2026-07-14)

The day-first mechanism **already exists in the same component**:

- `components/public/ScheduleContent.tsx` builds a flat `byDate` map (≈ lines 369–374) and
  already renders a **date-first path** (≈ line 1313) — one `dateGroup` per day →
  `renderDateLabel` → rows. The multi-pool Pool Play branch (≈ lines 1262–1293) is the only
  path that wraps `PoolHeader` around per-pool date groups instead.
- Everything day-level is already built and shared per `dateGroup`: sticky frosted day label,
  **Today** badge, done/total progress count, `todayGroup` auto-scroll on load, per-row status
  rails, staggered entrance. None of it changes.
- Pool attribution has a single shared source of truth: `inferGamePool` (lib/playoff-bracket),
  already used by Standings + the tiered bracket, exposed locally as `inferPool(...)`
  (≈ line 516). The per-row chip reads from it — no new attribution logic.

So Round 4 = **re-route the multi-pool Pool Play branch through the existing date-first
render** + **a per-row pool chip** + edge-case rules. It is deliberately scoped after
Rounds 1–3 because the chip must land in the row anatomy Round 1 finalizes (the F2
venue/diamond meta line and the G4 mono-label conventions).

## 3. Scope (rev 2)

**In:**
- **Day selector** on the Schedule: a chip strip of the tournament's dates (+ an "All" chip,
  D5), rendering **one day at a time**. Chips carry weekday + date; today gets a marker even
  when not selected. The strip reuses the segmented-control/chip language Round 1 formalizes;
  ≥ 44px targets (`--tap-min`).
- **Long events — one selector, two presentations (D8).** The selector is built from
  **distinct game dates**, never the start–end calendar span (a 6-week Saturday series is 6
  entries, not 42). While the whole event fits on screen (≈ ≤ 5 game dates — the 3–4-day
  norm) it presents as the roomy weekday chips (segmented-control read, nothing scrolls).
  Beyond that it presents as a **compact date rail** (the FIFA/ESPN World-Cup pattern):
  narrow "MON 15" cells (~7 visible at 390px), horizontal swipe with snap, the landed day
  auto-centered, an edge month label, today dotted even when unselected, and a **jump cell**
  ("⋯") opening a plain date list grouped by week (bottom sheet on mobile, dropdown on
  desktop) for direct long hops. Same component, same behavior, two densities — rejected
  alternatives: week tabs (a hierarchy fans don't think in and the data doesn't model) and
  prev/next-arrows-only (hides the event's shape; a three-day hop = three taps). Multi-week
  *seasons* remain the League product's concern — this page stays the event schedule.
- **Smart landing** (the owner's rule, "most recent date that has not passed"): the first
  tournament date ≥ today → during the event that's **today** (a mid-event gap day lands on
  the next date with games); before the event → the **first day**; after → the **last day**.
  Uses the tournament-timezone helpers (lib/timezone), never device-local date math.
  The existing scroll-to-today behavior retires — landing replaces scrolling.
- **Day-first inside the selected day** (unchanged from rev 1): all pools in one timeline,
  rows in start-time order, per-row **pool chip** via the shared attribution (self-hides when
  the division has < 2 pools or attribution is unknown).
- **Filter interplay:** search / My Games auto-expand to the full event, day-first grouped
  (D6) — a searched team's whole weekend in one list, never a false "no games today".
- Single-pool divisions: day selector still applies (the scrolling feedback wasn't
  pool-specific); no pool chips, no banner.
- Desktop + mobile both switch (one render path — see decision D2).

**Out (unchanged):**
- The Playoffs stage keeps its round grouping and bracket layout (playoffs usually fit one
  day, so its selector simply has fewer chips); Track A's playoff-day default keeps working —
  it selects the stage, not the grouping. Merging both stages into one day view is decision
  D7 (default: keep stages; decide with the Round 1 control-stack work).
- The pool tables on Standings (pool-first is CORRECT there — that's the standings unit).
- Search, followed-team pin/filter, division picker, stage toggle, live broadcast cards,
  score alerts — all orthogonal; they filter the same list that then groups by day.
- Ticker/dock/chrome; any Theme C/D visual-language items (Rounds 1–3 own those).

### 3b. Ride-along fix (owner-directed 2026-07-16, from Round 3's capture evidence)

**The schedule page forces mobile zoom-out — fix it in this round's build.** Round 3's capture
harness measured the schedule rendering with a **448px layout viewport at a 390px device width**
(`window.innerWidth` = 448, `vh` = 970 — every other public page measures 390/844). Some element
in the schedule's control stack or row area is wider than the device, so mobile Chrome/Safari
zoom the whole page out ~13% (everything renders smaller than designed; fixed bottom chrome —
dock + bottom nav — pins to the taller layout viewport and sits below an 844px screenshot crop,
which is why the Round 3 artifact's schedule captures show neither). The probe's `overflowX`
check misses it because `scrollWidth` is compared against the already-expanded viewport. Round 4
rebuilds this page's render path anyway, so the offending element gets found and constrained
here (likely candidates: the stage-segment/controls row or a row grid — verify with the harness,
not by eye). Acceptance: schedule captures report vw=390/vh=844 at the 390×844 device (and
360/800 at the narrow spot-check), matching every other page.

## 4. Build phases

| Phase | Contents | Effort |
|---|---|---|
| **P1 — Grouping switch** | Route the multi-pool Pool Play branch through the date-first render (`byDate` over the stage-filtered list); retire `PoolHeader` from that branch (component stays — the pool-playoffs variant at ≈1291 may still use it pending Round 2's F3 outcome); within-day sort = time asc, tiebreak pool name then id (stable keys — entrance animation must not replay on poll). | S/M |
| **P2 — Day selector + smart landing** | Date-chip strip from the tournament's distinct game dates (+ "All", D5); selected day filters the rendered list to one `dateGroup`; landing rule = first date ≥ `tournamentToday()` (falls back to last date post-event, first date pre-event; gap days land on the next date with games); today marker on its chip; retire the auto-scroll-to-today (landing replaces it); single-day tournaments hide the strip entirely. Search/My Games auto-expand to all days per D6. | M |
| **P3 — Pool chip** | Chip on every row via `inferPool`: joins the mono meta line (time cell on desktop, the F2 venue line on mobile — final placement per D1). Self-hide rules: division has < 2 pools, `inferGamePool` returns null, or the row is a cross-pool matchup (`hasPoolPlaceholders` semantics → show both or drop, see D1 note). Token-only; ≥ 44px row targets unaffected. | S |
| **P4 — Edge cases + verification** | Placeholder-teams days (pre-seeding), gap days, single-day tournaments (no strip), completed tournaments (land on final day), division switch resets/keeps day sensibly (keep if the date exists in the new division, else re-land), 390+360, branded-dark/-light, followed + anonymous. Harness re-run + the checks in §6. | S |

## 5. Owner decisions — ✅ ALL EIGHT DECIDED (owner accepted every recommendation,
2026-07-14; D8 logged to the design decisions log same day, D1–D7 logged as the Round 4
package entry). Round 4 is fully specced — build waits only on Rounds 1–3.

1. **D1 ✅ — Pool tag in the row's meta line** with time/venue ("9:00 AM / D2 · POOL A") —
   joins the quiet mono line Round 1 formalizes, zero new row height. (Beside-the-time
   variant rejected: competes with the time and abbreviates to a bare letter.)
2. **D2 ✅ — Desktop parity.** Day view + selector on every screen size — one render path,
   one mental model. (Mobile-only fork rejected.)
3. **D3 ✅ — Strict start-time order** within a day. (Pool-clustering rejected — recreates
   the fragmentation inside the day card.)
4. **D4 ✅ — Whole-day progress count** across pools ("8/12 today").
5. **D5 ✅ — Keep the "All" chip** — the day-first timeline as the overview for weekend
   planning, screenshots, and post-event review.
6. **D6 ✅ — Filters expand to all days.** Search / My Games ignore the selected day and
   show the whole event day-first grouped — never a false "no games today".
7. **D7 ✅ — Keep the stage toggle** (Pool Play / Playoffs) — the merged single-timeline day
   view is REJECTED as the Round 4 baseline. Reopen only if the Round 1 control-stack work
   (C3/G5) independently proposes it — relay this default to the review chat so their
   control-stack decisions don't assume a merge.
8. **D8 ✅ — Selector presentation at scale** (accepted earlier the same day; see the
   design-log entry): roomy chips ≈ ≤ 5 game dates, compact date rail + week-grouped jump
   sheet beyond; entries = distinct game dates only.
8. **D8 — Selector presentation at scale. ✅ ACCEPTED (owner, 2026-07-14; logged to the
   design decisions log the same day).** Roomy chips while the whole event fits on screen
   (≈ ≤ 5 game dates), the compact date rail + week-grouped jump sheet beyond (the World Cup
   case). Rejected: week tabs, prev/next arrows only, forcing one presentation on both cases.
   The switch threshold is a constant — trivial to tune.

## 6. Verification

- Re-run `scripts/mobile-review-capture.mjs` (in-repo since Track A): the landed view shows
  **only the smart-default day** (during the seeded live window that's today, with the live
  games in the first viewport — the direct fix for the test-tournament feedback); each
  calendar date renders exactly once in the "All" view; day chips clear the 44px floor
  (`smallTargets`); `overflowX` stays false; median row pitch within Round-1 targets.
- **Layout-viewport check (§3b):** the schedule metrics JSON must report `vw`/`vh` equal to
  the device viewport (390/844 and 360/800) — today it reports 448/970 at 390, the zoom-out
  signature. `overflowX:false` alone is NOT sufficient (it compares against the expanded
  viewport and stays false while the page is zoomed out).
- Landing-rule matrix (computed, tournament timezone): pre-event → first day; each event day
  → that day; gap day → next day with games; post-event → last day.
- Computed-style checks (not screenshots) for the sticky day label + today auto-scroll
  offsets after regrouping.
- Manual: division with 2 pools + a cross-pool game; a placeholder-only day; the followed
  team's pinned card + ★ markers still correct in mixed-pool day cards.
- `npm run verify:changed`; typecheck (shared render loop touched).

## 7. Dependencies & sequencing

- **After Round 1** (row anatomy: F2 venue line + G4 label conventions — the chip's home).
- **After Round 2** only for one interaction: if F3 collapses the Standings bracket embed
  differently, confirm the schedule's pool-playoffs sub-branch (≈1291) fate there first.
- **After Round 3** per owner sequencing (Round 4 is last).
- Coordinates with nothing outside the polish project. No migration, no API change.
