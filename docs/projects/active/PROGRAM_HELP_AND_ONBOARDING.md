# Program — Help System & Onboarding

> **Consolidated 2026-07-28.** Replaces 9 help/onboarding plan-brief files + 4 prototype HTML files (§5).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §4.
> **Reminder:** in-app help content is single-sourced in `lib/help-content/*.tsx` and is a **code-time**
> responsibility (`/docs`), not a periodic manual sweep.

---

## 0. Ground truth (verified 2026-07-28)

Phases 1, 1.5, 2, 5a and 5b are built and — since `dev` is only 8 commits ahead of `origin/master` —
**live in production**. The umbrella plan's §10 owner decisions (single-scroll guides, in-context
slide-over drawer, hub role-path disclosure) were **resolved 2026-06-17/18** and are reflected in the
shipped product. What remains is the **discovery layer (Phases 3–4)**, a **content-coverage tail**,
and one genuinely open scope question.

---

## 1. Outstanding work

### 1.1 Contextual-help coverage tail (Wave B) — small, mechanical
Six shared-header admin pages still have no contextual help wired: **Venues, Check-in, Staff Kit,
Rules, Branding, Data Tools**. All six use the same header component, so each is a one-line mapping.
Cheapest remaining win in the program.

### 1.2 Remaining capability spotlights
The "Did you know?" spotlight framework is shipped; four planned spotlights were never wired to their
milestones: **fan alerts / PWA · data import · post-event summary · clone-and-reuse**.

### 1.3 Post-event wrap-up "Next steps" row
On the completed-tournament wrap-up card. Designed, never built. Pairs naturally with the organizer
dashboard finalize work (`PROGRAM_TOURNAMENTS.md` §Stage 3) — build them together.

### 1.4 Cross-device dismissal (the 5b remainder)
Today "don't show me this again" is stored in **localStorage only**, so dismissals are lost when an
organizer clears their browser or switches devices — and a nudge they've already dismissed reappears.
Fixing it properly requires **a server-side column** (a small migration). See decision **HP-1**.

### 1.5 Guided tours — scoped, deferred, needs a go/no-go
A full level-of-effort and UX proposal exists: an opt-in, two-tour release using `@reactour/tour`
(MIT, ~18 KB gzipped), triggered by a one-time post-wizard offer on a brand-new blank tournament.
The recommendation on file was to **keep tours deferred** behind the FieldHint + HelpDrawer layer —
that layer has now shipped, so the question is live again. See decision **HP-3**.

### 1.6 Phases 3–4 — the discovery layer
The lifecycle Guidance Rail and the wider discovery work are partially delivered through 5a/5b. What
remains of Phases 3–4 should be **re-scoped against what actually shipped** rather than built from the
original plan, which predates the 5a/5b delivery.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| HP-1 | **Cross-device dismissals: accept localStorage-only, or add the server column?** localStorage is free but loses state on browser clear / device switch. | Add the column. Nudges that reappear after being dismissed actively erode trust in the help layer. |
| HP-2 | **How far does contextual help extend beyond tournaments?** The same coverage gaps exist on house-league, rep-teams, accounting and org-admin surfaces. This is the one §10 decision never answered. | Tournaments + coach portal now; house-league and accounting when those modules get their own UX pass. |
| HP-3 | **Guided tours — build the two-tour opt-in release, or keep deferred?** | Keep deferred. The drawer + hints layer is shipped and covers the need; tours are the most expensive help mechanism per unit of value. |
| HP-4 | **Game-day nudge aggressiveness** — if an organizer reaches game day having never set up scorekeepers, do we interrupt them? | Quiet + dismissible, never blocking. |
| HP-5 | **Is the guidance rail a tournament-specific primitive or a reusable one?** Affects whether house league and rep teams inherit it free. | Build reusable — the pattern (headline + one action + dismiss) is module-agnostic. |

---

## 3. Resolved — do not re-litigate

Single-scroll guides (not accordion) · in-context slide-over drawer (not deep-link-in-new-tab) ·
role paths as a hub disclosure · no topic-count signal in the TOC · SetupChecklist as a shared
primitive. All ruled 2026-06-17/18 and reflected in shipped code.

---

## 4. Shipped — reference only

- **Phase 1 + 1.5** — help centre made usable; single-scroll guides with sticky TOC; content accuracy pass across guides.
- **Phase 2 (in-context help)** — shared `HelpDrawer` slide-over, four-page wiring, fixed `HelpTooltip` (touch-safe, closes on tap-away/Escape, keyboard-focusable), status-legend popovers.
- **Phase 5a + fast-follow** — dashboard "what's next" guidance rail across lifecycle stages, dismissible "Did you know?" nudges, "See common tasks" outcome shortcuts, first-run wizard copy, Staff Kit intro fix.
- **Phase 5b** — persona panel ("what everyone else sees" — parents, coaches, volunteers); the "I want to…" shortcut block shared into the drawer on every tournament page.
- **Draft launch checklist guidance** — the tournament setup checklist recast from a flat "Optional — N of 8" junk drawer into a three-tier guided drawer (Recommended / Defaults you can fine-tune / Registration & fees), with default values visible on the row.

## 4a. Helpdesk gaps — all three resolved

The standing helpdesk-gap log is now empty: the invite-email bypass is caught by the shipped sign-up
invite guard; prod migration-drift visibility is covered by the `check:migrations` release gate; and
the bracket column/connector issue was dissolved by the bracket graph-layout work.

---

## 5. Source files consolidated (archive candidates)

`HELP_SYSTEM_REDESIGN_PLAN.md` · `HELP_SYSTEM_REDESIGN_PM_BRIEF.md` · `HELP_PHASE2_INCONTEXT_PLAN.md` ·
`HELP_PHASE2_INCONTEXT_PM_BRIEF.md` · `HELP_PHASE5_DISCOVERY_PLAN.md` · `HELP_PHASE5_DISCOVERY_PM_BRIEF.md` ·
`HELPDESK_GAPS.md` · `DRAFT_LAUNCH_CHECKLIST_GUIDANCE_PLAN.md` · `DRAFT_LAUNCH_CHECKLIST_GUIDANCE_PM_BRIEF.md` ·
`help-hub-prototype.html` · `help-layout-prototype.html` · `help-phase2-incontext-prototype.html` ·
`help-phase5a-discovery-prototype.html`
