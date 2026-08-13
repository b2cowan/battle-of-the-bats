# Coach Money Overview — One-Screen Dashboard

**Status:** ✅ COMMITTED `dev` `09b2ddc3` 2026-08-11 (post /simplify + /review) — awaiting owner browser QA (see §Owner QA states)
**Build notes (2026-08-11):** implemented as planned with one deviation — the new styles live in
a component-scoped `overview-dashboard.module.css` beside the two new components
(`OverviewDashboard.tsx`, `MoneyNextThirtyDays.tsx`, colocated in the accounting folder),
not appended to the 5,300-line `coaches.module.css`; same warm-token idiom, follows the
`UpcomingPayablesPanel` component+module precedent. `MoneySummary` moved from `page.tsx`
into `OverviewDashboard.tsx` (page imports it back). Verified: typecheck clean ·
`verify:changed` all green (tokens/contrast/dates/parity/dictionary/demos) · rendered
`check:layout --only=coach-accounting` ×4 widths: **no new findings** · help guide synced ·
demo touchpoints confirmed unaffected (both target the unchanged standalone
Budget vs. Actual route) · dev server restarted fresh post-build.
**Original approval:** owner approved mockups 2026-08-11.
**/simplify run (2026-08-11, 4 lenses):** 6 fixes applied — dropped the redundant
`showOrgSections` prop (org rail rows now gate purely on href presence, one signal);
removed the dead `count` and derivable `direction` fields from `LedgerRow` (direction
derives from lane); made the ledger iterate lanes generically via `LANE_KIND_BY_ID`
(an unknown future lane renders as money-out instead of silently vanishing — the
altitude reviewer's concrete-cost scenario); folded the five per-render aggregate
passes into the rows `useMemo`; deduplicated the byte-identical `fmt` between
`page.tsx` and `OverviewDashboard.tsx` (page imports it); added a producer-side
comment in `upcoming-payables/route.ts` pinning the description/dueDate/amount
merge-key contract the grouping relies on. **3 findings deliberately skipped:**
the verbatim 30/60/90 toggle duplication with `UpcomingPayablesPanel` (extraction
would touch the shared panel → visual change on its two other surfaces incl. an
admin screen — follow-up, not this diff), a shared fetch hook (would be a brand-new
abstraction; none exists in the repo), and skeleton-CSS unification (cosmetic,
only worth doing alongside the toggle extraction). Reuse reviewer confirmed the
per-file `fmt`/`fmtDate` idiom is repo-wide convention (13 pre-existing copies in
the accounting folder alone) — not new debt.
**/review run (2026-08-11, standard tier, 3 lenses + full deterministic gate):**
19 raw findings → 7 confirmed and FIXED: the grouped row's "+N more" undercounted
players with blank names (now counts members, not surviving names); an empty-string
player name rendered a blank row title (`??`→`||`); a stale-response race on the
30/60/90 toggle (monotonic request-seq guard added — the shared panel and the page
summary carry the same pre-existing pattern, deliberately untouched); a green
"on track" chip rendered beside "no installments are set yet" (chip now absent when
nothing is scheduled); the Collections bar segment lacked the 100% cap the Budget
card has; two help-copy overstatements ("Remind shortcut" now says reminders are
sent in Player Dues; "every figure leads" now names the footer links + rail rows);
and this plan's own false archive-allow-list claim. 8 findings refuted or accepted
as design intent (overdue bucket is direction-agnostic by design; overdue dues rows
red not green by design; defensive null guard kept; ledger fmt negative branch
inert; grouped/ungrouped key churn cosmetic; days-toggle reset on season switch =
pre-existing parity; zero-amount-lines starter edge noted; season-switch flash
hypothesis refuted by the loading gate). 1 surfaced pre-existing HIGH (see
"Surfaced by /review" section — owner ruling needed). Full 1,586-test suite green
before AND after fixes; typecheck/lint/verify:changed green post-fix.
**Origin:** owner request in-chat, follow-on to the Money hub tabbed navigation
(`COACH_MONEY_HUB_TABS_PLAN.md`, built + QA-passed 2026-08-11).
**Binding spec:** mockup artifact
<https://claude.ai/code/artifact/8eac5808-b803-4d97-85df-73eed0722fb8> — version
**"calm-footers-no-cta"** (later versions supersede earlier ones; the Send-reminders
button visible in early screenshots was explicitly REMOVED by owner call, do not
reintroduce it from an older image). Zones are tagged NEW / RESTYLED / UNCHANGED /
REMOVED in the artifact; per the mockups-are-spec rule, untagged chrome (header,
tab bar) is UNCHANGED.

## Why

The tab bar shipped, but the Overview panel underneath is still the pre-tabs hub page
whose job was navigation. Audit against the live screen found:

- The 1·Plan → 4·Review journey-card stack duplicates the tab bar's destinations —
  two navigation systems on one screen.
- The same facts render repeatedly: overdue count ×3 (anchor banner, payables pill,
  dues card chip), collected-of-expected ×3, headroom ×2–3, budget total ×2,
  expenses-paid ×2.
- `UpcomingPayablesPanel`'s three fixed columns each hold a third of the width even
  when two are empty sentences, while near-identical dues rows stack vertically.
- Net: ~3 screens of scroll for ~8 facts.

## What's changing (operate stage only)

The Overview tab of `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx`
becomes, **when `summary.stage === 'operate'`**, a one-screen dashboard:

**Row 1 — three story cards** (each fact gets exactly one home):

1. **Collections** (merges the operate-stage anchor + Money In tile + Player Dues
   card). Headline `$collected of $expected · pct%`; segmented progress bar —
   collected (olive), overdue (danger, **hatched** so it survives CVD/print),
   remaining (track); legend `$in / $overdue / $to come`; state chip:
   `⚠ N overdue` (danger) → `N unpaid` (warn, when overdue=0 && neverPaidCount>0)
   → `on track`; red left edge only while overdue. Footer link: **Player Dues →**.
   **NO reminder button** — acting on arrears is deliberately one click deeper
   (ledger row's Remind, or the dues screen).
2. **Cash on hand** (merges Money In / Money Out / On Hand tiles). Headline
   `onHand` (green ≥ 0 / danger < 0); two labelled mini-bars IN / OUT scaled
   against `max(moneyIn.total, moneyOut.total)`; the cash-basis caveat sentence
   moves from page level into this card as a footnote (the page-level
   `moneySummaryBasis` line is removed). Footer link: **See what's outstanding →**
   (dues tab).
3. **Budget** (merges Headroom tile + Season Budget Plan card + Budget vs. Actual
   card). Headline `$headroom headroom` + chip `on plan` / `over budget`;
   spent-vs-planned bar (blueprint blue fill); legend `$spent / $planned /
   $perPlayer per player`; footers **Budget plan →** and **Budget vs. Actual →**.
   Null state (`headroom == null` while operating): em-dash headline, "no budget
   yet", single **Set up your budget →** footer.

**Row 2 — ledger (2fr) + rail (1fr):**

4. **Next 30 days ledger (NEW component)** — one chronological list merging the
   three payables lanes, same `upcoming-payables` API, 30/60/90 toggle kept.
   Header carries a one-sentence rollup computed client-side:
   `$X overdue · $Y coming in · $Z going out` (dues = in; team payables + org
   allocations = out). **Grouping rule:** non-overdue dues items sharing the same
   installment label, due date and amount collapse into one row —
   "Installment #2 — 12 players", sub-line = first 3 names "+N more", amount =
   the sum, action **View** → dues tab. Overdue items NEVER group — each gets its
   own row (date shown red, `Nd late` badge, danger amount) with a small
   **Remind** action deep-linking to the dues tab (no new write surface from the
   Overview). Empty lanes cost one italic line ("No team payables or org payments
   fall due in this window."), not a column. Footer: **See the full payment
   schedule →** (expenses tab, schedule view — unchanged destination).
5. **"More in Money" rail** — one line per surface not already owned by a story
   card, real stat each, chevron → its tab: Fundraisers (`$raised` or "None yet ·
   start one"), Org Allocations + Payment Requests (org-linked live seasons only,
   same `showOrgTabs` gate), Season Budget Plan (`$total set`), Budget vs. Actual
   (`$headroom headroom`).

**Removed in operate stage:** the operate branches of `renderAnchor()` (overdue /
never-paid / on-track cards — absorbed by the Collections card), the 4-tile
`summaryGrid`, the page-level basis sentence, the `UpcomingPayablesPanel` usage on
Overview, and the entire 1·Plan → 4·Review `moneyGroup` card stack.

⚠ **SUPERSEDED 2026-08-12 — the paragraph below is kept for the record and is NO
LONGER TRUE.** The setup-stage carve-out was closed the day after it shipped: the
owner met the empty-team render and asked the same question this plan asks about
the operate stage. The journey stack is now gone at EVERY stage, both Overview
shapes end in one shared rail, and the tiles + payables panel wait until they have
something to report. See `memory/design_decisions.md` 2026-08-12 ("The Money
Overview keeps ONE shape all season") and the mockup
`claude.ai/code/artifact/f28ebd03-06b8-4c97-9649-fff303da581d`.

~~**Unchanged:** `stage === 'plan' | 'collect'` keeps today's guided layout exactly
(anchor card, tiles, payables panel, journey cards — it is good onboarding).~~ Header,
tab bar, all seven tab panels, old standalone routes, season gating, archive
allow-lists (correction 2026-08-11, found in review: `'Money'` IS in
`APPROVED_ARCHIVE_DOORS` and `money-summary` IS season-aware — this plan originally
claimed the opposite; either way this diff edits neither list), the lazy-mount/
keep-mounted tab machinery.

**Card footers (all cards):** action links pin to the card's bottom edge behind a
hairline (`margin-top: auto` in the card's flex column + top border), so footers
align as one band across siblings and slack space sits between content and footer.
Same height everywhere — **no button-height footers; no lime CTA anywhere on the
Overview** (owner call 2026-08-11: earned-lime is a ceiling, not a quota; a daily
dashboard reports, it doesn't shout).

**Mobile:** single column, urgency order — Collections → Cash → Budget → ledger →
rail. Ledger rows keep date / badge / name / amount; grouped installments are what
keep the phone view short.

## Confirmed architecture (researched 2026-08-11)

- **`UpcomingPayablesPanel` is SHARED** — also used by the coach Expenses tab and
  admin `rep-teams/page.tsx`. Do NOT modify it; build the merged ledger as a new
  coach-Overview-only component. The existing panel keeps its other two callers.
- The `upcoming-payables` payload (`lanes[].items[]`: `label`, `description`,
  `amount`, `dueDate`, `daysUntilDue`, `overdue`) already carries everything the
  ledger needs — grouping and the header rollup are pure client-side presentation.
  **No API change, no migration.** (Confirm at build time which of
  `label`/`description` holds the player name vs the installment name for the dues
  lane and key the grouping accordingly.)
- `money-summary` (`MoneySummary` in `accounting/page.tsx`) already carries every
  number the three cards and the rail need, including `dues.neverPaidCount`,
  `budget.perPlayer`, `fundraisers.*`, `allocations.*`, `paymentRequests.*`.
- Org-only rail rows follow the existing `showOrgTabs` gate
  (`summary.orgLinked && !page.isReadOnly`) — no new archive surface, no
  allow-list edit.

## Build steps

1. **New ledger component** (suggested: `components/coaches/MoneyNextThirtyDays.tsx`
   or beside the page) — fetches `upcoming-payables?days=N`, merges lanes
   chronologically (overdue first, then by due date), groups per the rule above,
   computes the header rollup, renders the 30/60/90 toggle, Remind/View deep-links
   via the page's `sectionHref`. Reuse the existing skeleton/error idioms.
2. **New Overview dashboard layout** — the three story cards + rail, driven
   entirely by the already-fetched `MoneySummary`; grid `1fr 1fr 1fr` over
   `2fr 1fr`, collapsing to one column ≤ ~720px. New CSS in `coaches.module.css`
   beside the existing `.money*` rules, warm tokens only (`--home-*`, `--danger`,
   `--warning`, `--blueprint-blue`), hatched overdue segment
   (`repeating-linear-gradient`).
3. **Stage-gate the panel** in `accounting/page.tsx`: `operate` → new dashboard;
   `plan`/`collect` → existing layout untouched. Delete the operate-only anchor
   branches, tiles, basis line, payables usage and journey stack from the operate
   path only.
4. **Help docs** (`/docs`): `lib/help-content/coaches.tsx` "premium-money" —
   the section describes the Overview's cards/areas; re-describe the dashboard
   (three cards + timeline + rail) and note reminders are sent from Player Dues.
5. **Demo pass** (standing CLAUDE.md rule): the coach sandbox (`riverdale-ridge`)
   lands on this exact screen in its mid-season moment. Re-read the moments-dock
   arrival line for the accounting screen ("…what has actually gone out, line by
   line…") and any guided-tour step that names Overview elements against the new
   layout; adjust copy in the same unit of work if stale. `npm run check:demos`.
6. **Verify:** `npm run verify:changed`; rendered `check:layout` pass for the
   accounting screen (it's in the coach-portal screen list — the money tab bar has
   already produced two rendered-only defects this month); dev-server restart
   before handoff (new files). Owner drives browser QA per the standing rule.

## Owner QA states (one sitting)

Overdue state (demo team as-is) · on-track (no overdue/unpaid) · never-paid chip ·
no-budget null card · plan stage and collect stage unchanged · org-linked vs
standalone rail rows · archived season (org rows absent) · 60/90 toggle ·
grouped-row View + Remind deep-links land on the dues tab · phone stack order ·
footers align at equal height.

## Surfaced by /review — pre-existing archive gap, RULED AND FIXED 2026-08-11

**The Money archive door showed the live season's payables timeline.** `Money` is an
approved archive door and `money-summary` is season-aware (so `stage`, the cards and
the rail all reflect the VIEWED season), but `upcoming-payables` resolves the ACTIVE
program year and is not in `APPROVED_SEASON_AWARE_ROUTES` — so a coach opening an
archived season's Money tab saw a "Next 30 days" list (previously: the Upcoming
Payables panel — same data, same gap) populated from TODAY's season, violating
archive rule 3 ("show what the coach could see AT THE TIME"). Predated this project
(verified identical in the pre-diff panel usage).

**Owner ruling (2026-08-11): hide the instrument in archives** — a finished season
has no "next 30 days", and any season-aware reconstruction would be a view nobody
ever saw. Implemented same day: the dashboard's ledger and the setup-stage layout's
UpcomingPayablesPanel both render only when the viewed season is live
(`page.isReadOnly` gates both; the dashboard signals it by the payables URL simply
not being passed, matching the org-rows presence pattern). An archived season's
Overview keeps the three season-aware story cards and the rail — the season's
record — with the rail taking the row alone. No allow-list edit, no API change;
fails closed, same posture as Payment Requests/Allocations in archives. The closed
season's uncollected-dues story remains available where it is a record: the
Collections card and the Player Dues tab.

## Explicitly not in v1

- One-click send-reminder from the Overview (calm-dashboard call; revisit only if
  QA shows the two-click path is annoying in practice).
- Inline expand of a grouped ledger row (View → dues tab is the drill-in).
- Any change to the seven tab panels, the money-summary API, or the shared
  `UpcomingPayablesPanel`.