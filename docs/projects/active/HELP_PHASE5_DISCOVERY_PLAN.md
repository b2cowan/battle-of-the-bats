# Help System Redesign — Phase 5 (Discovery &amp; Orientation) Build Plan

**Status:** Proposed — mockup + plan + PM brief authored, NO code yet (awaiting owner sign-off on the in-chat PM brief).
**Created:** 2026-06-19
**Layer:** L3 (Discovery &amp; Orientation) of the three-layer help model. Extends the master design in `HELP_SYSTEM_REDESIGN_PLAN.md` §13.
**Mockup (satisfies §15 gate):** [help-phase5a-discovery-prototype.html](help-phase5a-discovery-prototype.html) — clickable; stage + plan switcher, dismissible nudge, "I want to…" shortcuts (rail + drawer), plus the static D5 wizard additions and a labeled D3 (5b) preview.
**Depends on:** Phase 1 (single-scroll guides ✅), Phase 1.5 (content accuracy ✅), Phase 2 (HelpDrawer + registry + provider ✅ — all on `dev`). No new dependency on the Coaches Portal.

---

## 0. What changed after grounding (corrections to master §13)

A 5-agent read-only grounding pass (2026-06-19) verified §13's assumptions against current code. The load-bearing corrections that change the build:

| §13 assumption | Verified reality | Impact on 5a |
|---|---|---|
| Possible separate standalone tournament dashboard | **Only one dashboard exists:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`. `app/admin/**` does not exist. Tournament/Tournament Plus orgs reach it through the org-slug shell (they just lack `/admin/org/*` nav). | Rail lands on exactly one surface. Simpler. |
| Staff Kit spotlight = "highest-value" (implied Plus) | **Staff Kit is FREE** — no plan gate. Generates QR for `/{slug}/scorekeeper` and `/{slug}/check-in`, both free on all plans. | Staff-Kit nudge shows on **all** plans, **no Plus badge**. |
| Playoff Wizard spotlight | **Two entry points on the Schedule page:** manual bracket builder (`playoff_manual`) is **free**; the auto-generate Playoff Wizard (`playoff_generator`/`auto_schedule`) is **Tournament Plus**. | Game-day playoff nudge text **swaps by plan**: free = "build by hand", Plus = "auto-generate". |
| "Fan PWA / score alerts (Plus)" | **Split:** PWA install + live-score refresh are **free**; only push **score alerts** (`fan_score_alerts`) are **Plus**. | Persona panel (5b) says "fan app" (free) + "live score alerts" (Plus). |
| Data import, post-event summary, clone/reuse | Confirmed **Tournament Plus** (`bulk_data_imports`, `post_tournament_summary`, `tournament_cloning`). Registration export also Plus. | "Import a team list" + "Export results" + "Reuse setup" shortcuts carry a **Plus** marker on free orgs. |
| Lifecycle stage detection | `status` (draft/active/completed/archived) + derived `isGameDay` (date-range **OR** first game started/scheduled). Canonical helper `resolvePhase()` in `lib/tournament-phase.ts` → draft/open/gameday/completed/archived. Dashboard re-derives inline (`isDraft`/`isPreEvent`/`isPostEventActive`/`isGameDay`). | Rail keys off the **same** booleans the dashboard already computes — do not invent new stage logic. |
| Launch checklist milestones | Only **2 required** items: `hasDates` + `hasDivisions`. Everything else optional/collapsed. `checklist.ready` comes from the API. | Draft rail reads those two fields for its "X of 2" progress; never implies a fully-configured tournament. |
| Tip-dismissal key format `guidance_nudge_*` / `spotlight_*` | **Plan-only — not in code.** Real convention: `HelpCallout` is the canonical dismissible banner (`dismissible` + `localStorageKey` props, stores `'1'`, default key `flhq-help-dismissed-{slug}`). Per-tournament precedent: `fl_admin_strip_dismiss:{tid}`. | New keys follow the real pattern: **`flhq-help-dismissed-{tipSlug}-{tournamentId}`**. Reuse `HelpCallout` where possible. |
| `taskShortcuts` export | **Does not exist yet** in `tournaments.tsx`. | 5a adds it as a new named export. |
| Plan read from per-tournament | **No per-tournament plan.** Read `currentOrg.planId` via `hasPlanFeature()`. Billing CTA must use `getBillingHref(slug, planId)` (tournament-tier orgs bill at `/admin/tournaments/settings/subscription`, not `/admin/org/billing`). | Upsell CTAs route correctly per plan tier. |
| Role differences | Dashboard is **not** role-gated; content is identical for owner &amp; admin. (Archive action gated by capability; billing page read-only for admin.) | **No Discovery surface differs by role.** Brief states this plainly. |
| HelpDrawer renders only `getHelpSections` | No slot for a shortcut-list header today. | D4 in-drawer shortcuts need a new UI block injected **above** the section renders (small drawer change). |

---

## 1. Scope &amp; phasing

**Phase 5a — high-value, low-risk, ship first (this plan's build target):**
- **D1** Lifecycle Guidance Rail — one pinned card at the top of the dashboard body, stage-aware (draft / pre-event / game-day / post-event / completed): headline + one-sentence context + one primary action.
- **D2** Capability Spotlights — **two** to start: Staff-Kit / scorekeeper handoff (pre-event) and Playoff bracket (game-day). Rendered inline in the rail as a dismissible "Did you know?" line.
- **D4** "I want to…" outcome shortcuts — lifecycle-filtered (4–5 items/stage), surfaced (a) collapsed under the rail ("See common tasks") and (b) at the top of the HelpDrawer.
- **D5** First-run wizard additions — first-time context blurb (step 1, first-timers only) + "what happens next" callout (Review step, every time).
- Empty-state teaching copy on the Staff Kit page (static).
- **Dismissal:** `localStorage` only. **No migration.**

**Phase 5b — follow-on (outlined here, built after 5a is verified):**
- **D3** "What everyone else sees" persona-journey panel (collapsible, dashboard).
- Remaining spotlights (fan alerts, data import, post-event summary, clone/reuse) wired to their milestones.
- Cross-device dismiss (one migration: a `dismissed_tips` JSONB on `organization_members`, or a `member_tips` table).
- Post-event wrap-up "next steps" row.

Recommend: **build 5a, get owner browser sign-off, then start 5b.**

---

## 2. D1 — Lifecycle Guidance Rail (build spec)

**Component:** new `components/admin/tournament/GuidanceRail.tsx` (`'use client'`). Recommend building it **generic** (`<GuidanceRail stage cta nudge tasks plan orgSlug tournamentId />`) per master §13.I.4 so house-league/rep can reuse it later — but ship it wired only to the tournament dashboard in 5a.

**Mount points (the only insertion sites — single dashboard page):**
- Draft: directly below the `reuseSetupPrompt` banner (when present), **above** the `.publishChecklist` section.
- Active/pre-event: **above** `renderMetricStrip()` + `renderPanelZone()`.
- Active/game-day: **above** `renderGameDayZone()` (full-width block; metric strip is suppressed here).
- Completed: **above** the `wrapUpCard`.

**Visual contract (reuse existing banner language):** border `1px solid var(--border-2)`, background `var(--white-03)`, `padding:1rem 1.15rem`, flex row, `margin-bottom:1.5rem`; icon `var(--logic-lime)`; title `var(--font-data)` 0.86rem/700; context `0.73–0.8rem var(--white-50)`; primary CTA `.btn.btn-lime.btn-data`. Game-day variant uses `var(--warning)` border/accent to match the coin-toss alert tone. Never a modal.

**Stage detection:** reuse the dashboard's existing inline booleans (`isDraft`, `isPreEvent`, `isPostEventActive`, `isGameDay`, `daysUntil`). Do not call a new API.

**Content:** see the lifecycle table in §6. Draft progress reads `checklist.hasDates` + `checklist.hasDivisions`.

**Anti-overwhelm:** the rail card itself is **not** dismissible (it's the persistent orientation anchor); only the nudge inside it is. Previous-stage content retires automatically as the tournament advances.

---

## 3. D2 — Capability Spotlights ("Did you know?")

**5a ships two**, both rendered as the dismissible nudge line inside the rail:

| Spotlight | Stage shown | Plan behavior | Target |
|---|---|---|---|
| Scorekeeper handoff (Staff Kit) | Pre-event (also a quieter game-day fallback) | **All plans, no badge** | `/{slug}/admin/tournaments/staff-kit` |
| Playoff bracket | Game-day (pool play winding down) | **Text swaps:** free = "build by hand", Plus = "auto-generate" | `/{slug}/admin/tournaments/schedule` |

Plus a per-stage default nudge for draft (preview), post-event (results link / Plus reuse), completed (Plus reuse or upgrade CTA) — see §6.

**Dismissal:** reuse `HelpCallout`'s mechanism or mirror it — store `'1'` under **`flhq-help-dismissed-{tipSlug}-{tournamentId}`**. SSR-safe: initialize shown=true, reconcile in `useEffect` (the `setHydrated(true)` pattern), never read `localStorage` synchronously at render.

**Trigger simplification (grounded):** §13 proposed triggers like "Active AND no staff-kit visit recorded." There is **no staff-kit-visit tracking** today. For 5a: show the nudge by **stage** and suppress on dismiss. Optional 1-line enhancement — write a `flhq-help-seen-staffkit-{tid}` flag when the Staff Kit page loads, and skip the nudge if present (acts-on suppression without a migration). Flag this as an owner option, not a requirement.

**Game-day aggressiveness (master §13.I.1, owner decision):** recommend the game-day playoff nudge be **quiet and dismissible** (default `--border-2`, not amber) so it doesn't compete with live operations. Owner to confirm whether game-day spotlights appear at all or only pre-event.

---

## 4. D4 — "I want to…" outcome shortcuts

**Data:** new named export `taskShortcuts` in `lib/help-content/tournaments.tsx`, keyed by stage. Each item `{ label, sectionId, minPlan? }`. Deep-links resolve to **real, verified** section IDs:

| Outcome | sectionId | Gate |
|---|---|---|
| Preview what teams will see | `public-site-preview` | — |
| Set up divisions and pool play | `divisions-and-pools` | — |
| Import a team list from a spreadsheet | `data-tools-imports` | Plus |
| Understand what activating does | `settings-and-access` | — |
| Get my schedule onto the public site | `recipe-build-tournament-schedule` | — |
| Set up a playoff bracket | `schedule-playoffs` | — |
| Hand scorekeeping to a volunteer | `scores-and-results` | — |
| Send an announcement to all teams | `public-communication` | — |
| Mark the tournament complete | `recipe-closeout-tournament` | — |
| Reuse this setup for next year | `repeat-event-setup` | Plus |
| Export results &amp; schedule | `exports` | Plus |

(Full per-stage lists in §6 / the prototype.) Plus-gated items render a small **Plus** marker on free orgs and link to `getBillingHref(...)` instead of the guide.

**Two surfaces:**
- **Rail:** collapsed under a "See common tasks" link (D4a).
- **Drawer:** a shortcut block injected **above** the section renders in `HelpDrawer` body (D4b — small drawer change; the body currently maps only `getHelpSections`). The drawer's shortcut list = the same stage slice. The dashboard opens the drawer via the existing `openHelp(...)` context API.

---

## 5. D5 — Setup Wizard additions

**File:** `components/admin/TournamentSetupWizard.tsx`. No new step; no flow change.

1. **First-time context blurb** — 3 bullets, inserted as the **first child** of the step-1 (`tournament`) `.workflowModalBody`, **above** the Tournament-name label. Rendered only when `hasPastTournaments === false` (already a local const derived from the `existingTournaments` prop). New CSS class (e.g. `.orientationBlurb`, blueprint-blue border box) — do **not** reuse `.emptyModalState` (dashed empty-state look) or `.draftPrivacyNote` (too muted).
   - Caveat: `hasPastTournaments` is derived from the prop the parent passes; the sidebar mount passes all tournaments unfiltered. For first-time accuracy, ensure the parent passes a correctly filtered list (or thread an explicit `isFirstTimeTournament` prop). Document, don't silently rely on the current sidebar behavior.
2. **"What happens next" callout** — Review step (step 5), below the review rows, **every time**. Replaces the existing `.emptyModalState` reassurance box (incorporating its "nothing public until you activate" text) with a forward-looking version in a new `.nextStepsCallout` class.

---

## 6. Lifecycle content (grounded copy — single source of truth)

| Stage | Pill | Rail headline | One action (CTA) | "Did you know?" nudge | Free vs Plus |
|---|---|---|---|---|---|
| **Draft** | DRAFT | "Let's get your tournament ready to launch" | Finish your launch checklist → | Preview your public page before you go live | same both |
| **Pre-event** | ACTIVE · PRE-EVENT | "Your event is N days away" | Set up volunteer access → (Staff Kit) | Hand scorekeeping to a volunteer — phone scoring view, no admin access | same both (Staff Kit free) |
| **Game day** | ACTIVE · LIVE | "It's game day — here's your live view" | Open the live game board → | Free: "build your playoff bracket by hand from the Schedule page" · Plus: "auto-generate your bracket from pool results" | text swaps |
| **Post-event** | ACTIVE · EVENT ENDED | "Your event has wrapped up" | Mark tournament complete → | Free: "results stay live at the same link forever" · Plus: "completing unlocks your event summary + reuse" | text swaps |
| **Completed** | COMPLETED | "Tournament complete — nice work" | Free: View final results → · Plus: View your event summary → | Free: upgrade-to-reuse CTA (→ billing) · Plus: "reuse this entire setup next year in one step" | CTA + nudge swap |

Per-stage "I want to…" lists are in the prototype's `CONTENT` object and §4 table.

---

## 7. Anti-overwhelm guarantees (hard rule)

1. **One action + one nudge per stage** — never a menu.
2. **Just-in-time** — guidance about scorekeepers/playoffs/close-out appears only at the stage it's relevant; previous-stage content retires automatically.
3. **Always dismissible** — every "Did you know?" can be dismissed with one click and never returns (per tournament, per tip).
4. **Invisible to returning users** — the first-run wizard blurb shows only to first-timers; dismissed nudges stay dismissed; a seasoned organizer opening their 5th tournament sees only stage-appropriate cues, no first-run orientation.
5. **Pull always available** — anything dismissed is retrievable on demand via the "?" drawer ("I want to…") and the guide pages.

---

## 8. Open decisions for the owner

1. **Game-day nudges:** show the playoff nudge during game day (quiet/dismissible), or hard-stop spotlights at pre-event and keep only the "?" pull on game day? (Recommend: quiet + dismissible.)
2. **Acts-on suppression:** add the optional 1-line "seen Staff Kit" flag so the scorekeeper nudge disappears after they visit Staff Kit (no migration), or rely purely on manual dismiss? (Recommend: add it — cheap, feels smart.)
3. **Generic vs tournament-specific rail:** build `GuidanceRail` generic for future reuse (recommended), or tournament-only now and refactor later?
4. **D4 drawer injection:** add the shortcut block to the shared `HelpDrawer` (appears on every tournament page's "?"), or only to the dashboard's drawer open? (Recommend: shared — it's the "retrieve a dismissed tip" safety net.)

---

## 9. Rollout &amp; verification

**Build order:** D5 wizard copy (lowest risk) → `taskShortcuts` data + D4 surfaces → D1 rail (draft + pre-event first, then game-day + completed) → D2 nudges → Staff-Kit empty-state copy.

**Restart-required:** new component file(s) + shared-module touch (`tournaments.tsx`, possibly `HelpDrawer`, wizard) ⇒ restart dev server (stop → `rm -rf .next` → `npm run dev`, network access) near handoff, batched once.

**Static checks:** `npm run lint:focused -- <changed files>`; `npm run typecheck` (touches shared help-content + drawer). Offer `/review` after the rail + nudges land (substantive logic).

**Owner browser test plan (per stage, both plans):** seed/visit a tournament in each lifecycle stage; confirm the rail shows the right headline + one CTA; the nudge matches plan and dismisses permanently; "See common tasks" reveals the right stage list with Plus markers on free; the "?" drawer shows the same shortcuts above the section; the wizard first-run blurb shows only on a brand-new org's first tournament and the Review callout shows every time. Confirm mobile stacks sensibly and nothing blocks the dashboard.

---

## 10. Out of scope (explicitly)

Guided tours (master §14 — deferred), video walkthroughs, cross-device dismiss (5b), the persona panel (5b), role-specific scorekeeper/coach onboarding flows, and any database migration. 5a is static + localStorage only.
