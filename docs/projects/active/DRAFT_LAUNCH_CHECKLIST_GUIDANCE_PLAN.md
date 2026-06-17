# Draft Launch Checklist — Guidance & Discovery Redesign

**Status:** In progress (2026-06-17)
**Branch:** `dev`
**Surface:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` (the "Draft Launch Checklist" section) + `dashboard.module.css` + `lib/help-content/tournaments.tsx`
**Owner sign-off:** Recommendations + the three open decisions approved 2026-06-17.

---

## Problem

The draft-state setup checklist gates activation on only **Tournament dates + At least one division** (correct — owner locked this 2026-06-16; fees and open-registration deliberately do *not* gate). Everything else lives in a single flat **"Optional setup — N of 8 complete"** collapsible drawer.

Two failures of that flat model:

1. **Skew / junk-drawer effect.** Nine items of wildly different importance carry identical weight. "Add venues" (no default — teams literally can't find the field) sits next to "Tie-breaker rules" (already correct by default). The "Optional" label communicates nothing about contents, so first-timers never open it.
2. **Hidden functionality.** Several "optional" items are *never blank* — they ship sensible defaults (game timing 90/15, tie-breakers H2H→Run Diff→…, contact = org email). New organizers don't discover these options exist, never mind that they're customizable. The owner wants the "oh yeah, we should set that" moment-of-recognition without clutter or nagging.

## Goal

Turn the checklist from a pass/fail gate into a **guided tour** that (a) succinctly tells a first-timer what's worth reviewing before go-live, and (b) surfaces capabilities they wouldn't think to look for — **making defaults visible rather than hidden**. The activation gate itself does **not** change (`ready = hasDates && hasDivisions`).

## Approach — three-tier model

Inside the (still-collapsed) drawer, split the flat list into three labeled groups with divider micro-labels:

- **Recommended before go-live** — Tournament schedule, Venues & fields, Public page, Rules & resources
- **Defaults you can fine-tune** — Game timing, Tie-breaker rules, Contact email
- **Registration & fees — your call** — Open public registration, Fee approach

## Work items

### P0 — grouped drawer + visible defaults
- Partition `optionalItems` into the three groups above; render divider micro-label rows between them (new `.checklistDivider` style, reuses the `.rowOptTag` register: uppercase, data-gray, border-top).
- Per-group badge text replaces the uniform "Optional": **Recommended / Default / Your call** (same neutral `.rowOptTag` style — **no** alarm color on default-backed rows).
- **Defaults group rows always show a one-line value sub-label** (done or not) — the recognition moment:
  - Game timing → `90 min games / 15 min buffer, tournament-wide`
  - Tie-breakers → `H2H → Run Diff → Runs For → Runs Against`
  - Contact email → `Defaults to your org contact email — override optional`
- Status text per group reads invitingly, not as a chore (e.g. defaults show `Review →` / `Customized`, not `Configure timing →`).

### P0 — drawer rename
- Toggle label: `Optional setup — N of 8 complete` → **`Schedule, venues, tie-breakers & more — N reviewed`** (named items seed vocabulary; "reviewed" not "complete" removes false-incomplete anxiety).
- Icon `Info` → `Settings` (gear signals configurability). `Settings` is already imported.

### P1 — concept tooltips (UNIVERSAL — extended per owner 2026-06-17)
- Add a `?` `HelpTooltip` (size `sm`) to **every** optional drawer row (all three groups) + the schedule row + the required "At least one division" row. Each carries a "what is this · why we ask · where it shows up" explainer — distinct from the short action nudge (which stays visible while undone). Skipped on "Tournament dates" (self-evident). Originally scoped to just tie-breakers/game timing; broadened so the help layer is consistent and reassures first-timers (e.g. why a contact email is asked: shows on the public page + included in coach/team emails).
- **Markup constraint:** `HelpTooltip` renders a `<button>`; it must NOT be nested inside the row `<Link>` (invalid button-in-anchor; no such usage exists in the repo). Every row carrying a tooltip makes the **label text the link** and renders the tooltip as a sibling, so the row container is a `<div className=checklistRow>` (hover/border styling preserved). Rows with no tooltip (Tournament dates) stay full-row `<Link>`.
- **Tradeoff:** optional rows + the schedule/divisions rows lose whole-row click (label-click instead). Net consistency win across the drawer; flagged to owner and accepted.
- **Clip fix:** `.checklistList` has `overflow: hidden` (clips the popover). Change to `overflow: visible` (no border-radius on the list, so visually safe; QA the required list too).

### P1 — go-live confirmation summary
- The existing "Activate tournament?" modal gains a read-only two-section summary above the footer:
  - **Not yet set up** — only the Recommended-group items still missing (schedule/venues/public page/rules); omit the section entirely if none. **Excludes** registration + fees (they're choices, not chores — keeps the tier line clean).
  - **Defaults that will apply** — the three default values, verbatim from the sub-labels.
- No new blocking step; the lime "Yes, activate" CTA stays dominant.

### P1 — schedule float-up (only when broken)
- When a schedule exists **and** its health tone is `warning` or `danger`, lift the schedule row out of the drawer to **above the toggle** (reuses the existing `data-sched-tone` amber/red flag). Suppress the in-drawer copy in that case. When healthy / neutral / not-set-up, it stays in the Recommended group. Keeps the above-fold clean 99% of the time, loud exactly when it matters.

### P2 — searchable help
- Add two FAQ entries to `lib/help-content/tournaments.tsx` (`settings-and-access` section): "How do tie-breaker rules work?" (`popular: true`) and "What is game timing?" — so searching "tie-breaker" stops being a dead end and the tooltips/modal have a reference to link to.

## Decisions (owner-approved 2026-06-17)
1. Drawer label seeds: **Schedule, venues, tie-breakers**.
2. Shortened default sub-labels as listed above.
3. Go-live summary lists **only** Recommended gaps; registration + fees excluded.

## Anti-patterns (deliberately NOT doing)
- No separate persistent "readiness strip" / orientation banner (the named toggle already does this job).
- No second pre-activation interstitial (the confirm modal *is* that beat).
- No dismissible tip callout in the drawer (banner fatigue on every new tournament).
- No nested second accordion for done rows.
- No alarm color on default-backed rows (trains users to ignore warnings).
- No swap of the bespoke toggle for `CollapsibleCard` (wrong visual weight).

## Verification
- `npm run lint:focused -- <changed files>` + `npm run typecheck` (page edit only — no shared modules/proxy/config; no migration; no new app-imported files).
- **No dev-server restart needed** (page + CSS + help-content hot-reload; new files are docs only).
- User browser-verifies: draft dashboard renders three groups, defaults visible, tooltips open without navigating, rename shows, go-live modal summary, schedule float-up when a schedule has issues. Mobile (narrow) wrap check.

## Out of scope
- The activation gate logic (unchanged).
- Server/API changes to `tournament-dashboard` route (all data already available).
- Reworking the underlying settings pages the rows link to.
