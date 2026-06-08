# Implementation Plan — Dashboard "Completed" + Post-Event Summary IA

**Status:** Proposed (awaiting approval) · **Date:** 2026-06-06 · **Branch:** dev
**PM brief:** [DASHBOARD_SUMMARY_IA_PM_BRIEF.md](DASHBOARD_SUMMARY_IA_PM_BRIEF.md)
**Part of:** Admin Visual Redesign Phase E QA — "Dashboard — Completed state" + "Summary" rows
**Reviewed by:** `/design` (binding guidance below) + `/ux` (journey guidance below)

---

## 1. Problem & decision

Two surfaces overlap after a tournament ends:

- **Dashboard completed** (`app/[orgSlug]/admin/tournaments/dashboard/page.tsx`, the
  `isCompleted` block ~L1497–1580): metric strip + **Final Registration** + **Final
  Payments** panels + a "Tournament Complete" wrap-up card (teams · games · $ collected →
  *View results*) + owner-only Archive.
- **Post-Event Summary** (`app/[orgSlug]/admin/tournaments/summary/page.tsx`, Plus-gated via
  `post_tournament_summary`): page header **and** a second hero (name + completion %) + 4
  metric cards (registered teams / schedule progress / divisions / payment) + an actions
  panel (Copy standings link · Public standings · Keep Plus active · Reuse this setup) +
  Print + a division recap with champion detection.

**Verified facts that drive the design:**
- The dashboard API (`/api/admin/tournament-dashboard`) returns **counts only — no
  champions**. Champions exist **only** in the Summary API (`championFromFinal`,
  `summary/route.ts`). → *Summary is the natural canonical recap; the dashboard cannot show
  the payoff without new data.*
- `AdminContextStrip` already nudges completed/archived → **"Review event summary"**
  (`AdminContextStrip.tsx` L72–73). The Summary nav item only appears once
  completed/archived (`AdminSidebar.tsx` L123–126). → *Summary is already positioned as the
  post-event destination; the dashboard currently contradicts it.*
- `active → completed` is set in **Event Settings** ("Mark as Completed" confirm + optional
  results email). Out of scope here, but it's the entry to this whole journey.
- Summary is **fully Plus-gated** (free orgs get a lock wall, GET returns 403). Goal #3 keeps
  that. → *The dashboard cannot become a thin pointer for **free** orgs without leaving them
  empty.*

**Decision:**
> **Summary is the single canonical post-event recap.** The completed dashboard becomes a
> **plan-aware hand-off**: a thin pointer for Plus orgs; a kept-recap + single upsell for
> Free orgs. Summary is reorganized into three ranked zones (recap / share / **what's next**).

**Decisions added 2026-06-06 (approved):**
- **Champions ARE shown on the completed dashboard banner** (all plans). The dashboard API
  now computes champions from the already-fetched games/teams (`championFromFinal`-parity, no
  extra query). "Who won" is the celebratory payoff and is **not** paywalled. The Free upsell
  therefore leads with *shareable recap + public results + reuse*, not "champions".
- **Zone 3 is reframed from "renewal" to "What's next"** (`/marketing` verdict): these are
  monthly **auto-renew** subscriptions, so the old "Keep Plus active" CTA implied a non-existent
  action and risked planting churn at the win moment. Dropped entirely. Zone 3 now = **Reuse
  this setup** (the real retention act) + a **visible value-reflection line** + **one opt-in
  League/Club discovery line** (inside the collapsed card) linking to the public `/pricing`
  page — never `/admin/org/` (Tournament/Org separation rule).

---

## 2. Design guidance (binding — from `/design`)

1. **Kill the double hero on Summary.** Keep one compact `.pageHeader`; delete the second
   `.hero`. Fold the completion-% into the existing schedule-progress metric card.
2. **Three ranked zones on Summary**, top to bottom: **Recap** (open) → **Share** (compact,
   secondary) → **Plan next year** (`CollapsibleCard`, `defaultOpen={false}`). Collapsing the
   renewal zone is what stops the CTA wall competing.
3. **Champions lead the recap** — the one thing the dashboard can't show. Reuse the existing
   `.championBadge` (lime fill / black text).
4. **Button compliance:** every `btn-sm` → `btn-data`. No `btn-primary` outside modals. Zone
   primaries: Share = `btn-outline btn-data`; Reuse = `btn-lime btn-data`; Print =
   `btn-ghost btn-data`.
5. **Thin pointer is plan-aware** (resolves the free-org tension): Plus = pointer only;
   Free = keep recap panels + one compact upsell.
6. **Tokens:** blueprint-blue panel frames + `--logic-lime` accents stay; everything via
   `var(--primary)` so Milton purple + light mode carry automatically.

## 3. UX guidance (binding — from `/ux`)

1. The pointer **must still carry the headline** (teams · games · $ collected) — don't force
   a click to learn *anything*; hand off only the *detail*.
2. **Free must not dead-end.** Free keeps the dashboard recap; its upsell is framed as value
   ("See champions, share & reuse — Tournament Plus"), never "Open summary →" into a lock.
3. **Preserve all five Summary states:** loading (spinner), error (specific message),
   no-tournament empty, locked/upsell (free), clone-success takeover.
4. Champions are the **click reward** — keep them the payoff for going to Summary.
5. Don't touch the working loops: Archive confirm modal, clone "never copied" modal, the
   `activeRepeatSetupSuccess` takeover + "Next checks" links.

---

## 4. Target layouts (wireframe level)

### 4.1 Dashboard — Completed, **Tournament Plus** org (thin pointer)

```
┌────────────────────────────────────────────────────────────┐
│ [🏆] Tournament Complete                                     │
│      12 teams · 15 games completed · $4,200 collected        │
│                                   [ Review event summary → ] │  ← btn-lime
└────────────────────────────────────────────────────────────┘
                                              [ Archive Tournament ]  ← owner-only, btn-ghost
```
*Dropped vs today:* `renderMetricStrip()`, the **Final Registration** panel, the **Final
Payments** panel. (They now live only on Summary.)
*Changed:* wrap-up card CTA `View results →` → **`Review event summary →`** (`btn-lime`,
href `${base}/summary`).

### 4.2 Dashboard — Completed, **Free** org (kept recap + one upsell)

```
┌────────────────────────────────────────────────────────────┐
│ [🏆] Tournament Complete                                     │
│      12 teams · 15 games completed · $4,200 collected        │
│                                          [ View results → ]  │
└────────────────────────────────────────────────────────────┘
┌──────────────────────────┐  ┌──────────────────────────────┐
│ Final Registration       │  │ Final Payments               │   ← kept (free's only recap)
│ 12 / 16 teams  ▓▓▓▓░ 75% │  │ $4,200 / $5,000 ▓▓▓▓░ 84%    │
└──────────────────────────┘  └──────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ ✦ Unlock your post-event summary                            │   ← single compact upsell
│   Division champions, shareable public results, and one-     │
│   click reuse for next year.        [ Review Tournament Plus ]│  ← btn-lime → subscription
└────────────────────────────────────────────────────────────┘
                                              [ Archive Tournament ]
```
*Gate:* `const hasSummary = hasPlanFeature(currentOrg.planId, 'post_tournament_summary')`.
Reuse the same flag the Summary page uses. `hasSummary ? <thin pointer> : <kept recap +
upsell>`.

### 4.3 Post-Event Summary — **Plus, full** (three zones)

```
[📄] Post-Event Summary
     {Tournament name} · recap                                    ← single header (no 2nd hero)

══ ZONE 1 · RECAP (always open) ════════════════════════════════
┌──── 🏆 Champions ──────────────────────────────────────────┐   ← NEW highlight band
│  U11  ▸ Bears U11          U13 ▸ {champion}   …             │     (only divisions w/ a champion)
└────────────────────────────────────────────────────────────┘
┌─ Registered ─┐┌─ Schedule ──┐┌─ Divisions ─┐┌─ Payments ──┐    ← existing 4 metric cards
│ 12           ││ 15/15 (100%)││ 3 · 3 champs ││ $4,200      │     (completion % folded in here)
└──────────────┘└─────────────┘└─────────────┘└─────────────┘
Division recap (existing per-division cards: champion/leader + reg + games)

══ ZONE 2 · SHARE THE RESULTS (compact, secondary) ═════════════
  [ Copy standings link ]  [ Public standings ↗ ]  [ Print ]      ← btn-outline/ghost btn-data

[ value reflection — visible, muted, no ask ]
  "Your saved summary, shareable public results, and reusing this
   setup next year all come with Tournament Plus."

══ ZONE 3 · WHAT'S NEXT (CollapsibleCard, collapsed) ═══════════
  ▸ What's next
     Start next year from this setup     [ Reuse this setup ]      ← btn-lime
     ── (opt-in discovery, inside the card) ──
     FieldLogicHQ also runs season-long leagues and full club
     operations …  See what League and Club include →             ← muted text + link to /pricing
```

### 4.4 Summary — **Free (locked)**, **clone-success**, loading/error/empty
Unchanged in behavior. Only sweep `btn-sm`→`btn-data` and confirm tokens. The locked card
already uses `btn-lime btn-data`.

---

## 5. File-by-file changes

### `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` (completed block only)
- Split the `isCompleted` render on `hasSummary` (add
  `hasPlanFeature(currentOrg.planId, 'post_tournament_summary')` alongside the existing
  `commandCenterAvailable` derive).
- **Plus branch:** render only the wrap-up card (CTA → `${base}/summary`, `btn-lime`) +
  owner Archive. Remove `renderMetricStrip()` + the two `analyticsPanel` sections from this
  branch.
- **Free branch:** keep the two `analyticsPanel` sections (Final Registration / Final
  Payments) + wrap-up card (CTA stays `View results →`) + a new compact upsell strip
  (reuse `.reuseSetupPrompt`-style row or a small inline card; `btn-lime` →
  `subscriptionHref`) + owner Archive.
- Do **not** touch Draft / Active / Live branches, `renderMetricStrip` definition (still used
  by Active), Archive handler/modal, or the populate/clone modals.

### `app/[orgSlug]/admin/tournaments/summary/page.tsx`
- Delete the second `.hero` section; keep `.pageHeader`. Move **Print** out of the header
  into Zone 2.
- **Zone 1:** add a Champions highlight band above `.metricGrid` (map
  `summary.divisions.filter(d => d.champion)`; reuse `.championBadge`; render nothing if
  none). Keep `.metricGrid`; fold `completionRatio` label into the schedule-progress card
  (it already shows `completed/total`). Keep the division-recap `.section` as the detail.
- **Zone 2:** a compact `.sharePanel` — Copy standings link (`btn-outline btn-data`),
  Public standings ↗ (`btn-outline btn-data`), Print (`btn-ghost btn-data`). Keep
  `copyPublicLink` + `trackSummaryAction('share_public_results' | 'print')`.
- **Zone 3:** wrap the renewal actions in `CollapsibleCard` (`title="Plan next year"`,
  `defaultOpen={false}`). Inside: Reuse this setup (`btn-lime btn-data`, opens existing
  repeat-setup modal) + Keep Plus active (`btn-outline btn-data` → `subscriptionHref`,
  keep `trackSummaryAction('renewal_cta_clicked')`). The `!canClone` path keeps its upgrade
  copy.
- Sweep every `btn-sm` → `btn-data`. Preserve loading/error/locked/clone-success states and
  the repeat-setup modal verbatim.

### `app/[orgSlug]/admin/tournaments/summary/summary.module.css`
- Remove `.hero` / `.heroStats` / `.eyebrow` (or repurpose minimally). Add `.championBand` /
  `.sharePanel` (compact flex row, `btn-data` sizing, `@media` stack ≤640px mirroring
  existing). Update `@media print` to hide Zone 3 + Zone 2 actions (keep recap).
- Keep blueprint-blue frames + `--logic-lime` accents; no new global tokens.

### `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css`
- Add a small `.completedUpsell` row style for the Free branch (or reuse existing
  `.reuseSetupPrompt`). No change to shared panel/strip classes.

### `app/api/admin/tournament-dashboard/route.ts`
- Add `home_score`/`away_score` to the local `GameRow` type and compute a `champions` array
  (per-division latest completed `FIN` winner, mapped to team name) from the **already-fetched**
  `games` + `teams` — **no new DB query**. Return it on the JSON payload.

**No migration, no shared-lib change.** The only API change is the additive `champions` field
on the dashboard endpoint (computed from data already loaded). `CollapsibleCard` is imported
from `@/components/admin/CollapsibleCard`.

---

## 6. Explicitly out of scope / decided against

- **Champion(s) on the dashboard banner** — *now INCLUDED* (see Decisions above). The
  dashboard API computes champions with no extra query; the banner shows a lime chip per
  division champion on both Plus and Free.
- **Un-gating Summary for Free** — goal #3 keeps the Free lock wall. Free's recap stays on
  the dashboard instead.
- **Role-gating clone / "Keep Plus active"** on Summary — pre-existing behavior, not changed
  here.
- **The `active → completed` transition** (Event Settings) — adjacent, untouched.

---

## 7. Verification

- `npm run lint:focused -- <the 4 files>` + `npm run verify:changed`. No shared-module/API
  changes, so a full `typecheck` isn't required, but run it if the edits touch imports.
- Restart rule: summary.module.css + page edits are page/style only → **hot reload, no
  restart** (no new files, no shared-module changes). If `CollapsibleCard` import is the only
  add, still no restart needed.
- **User browser test** on `/dev-test-org/completed-demo` (champion: Bears U11; re-seed:
  `node --env-file=.env.local scripts/seed-completed-tournament.mjs`; switch picker to
  "Completed Demo — Final Results"). Cross-check the axes from the Phase E matrix: mobile +
  desktop, dark + light, branded + default, **plus Free vs Plus org** (the new branch).
- Public cross-links unchanged: `/dev-test-org/completed-demo/standings · /schedule`.

## 8. Close-out

- Tick **"Dashboard — Completed state"** and **"Summary"** rows in
  `ADMIN_VISUAL_REDESIGN_QA_CHECKLIST.md` once browser-verified.
- Log the binding decisions (canonical recap = Summary; plan-aware thin pointer; Summary
  3-zone hierarchy) to `memory/design_decisions.md` **after** approval/implementation.
