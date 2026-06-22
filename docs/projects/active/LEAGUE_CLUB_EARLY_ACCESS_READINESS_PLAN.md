# League + Club Early-Access Readiness — Plan & Go/No-Go Checklist

> **Status:** Planning
> **Created:** 2026-06-22
> **Branch:** dev
> **Source of truth:** `docs/agents/strategy/BUSINESS_DECISIONS.md` (2026-06-22 — managed early-access intent + cohort shape ratified; **open date is contingent on this checklist passing**)

## Goal

Define the **"ready to open" bar** and the hardening scope that gates opening League and Club to a small founder-managed early-access cohort (**5–10 Club, 10–15 League**) under the Founding-Season comp. Target ~August 2026, but the date follows the checklist — not the calendar. This plan turns "self-serve-verifiable by a real admin" from a principle into a concrete, testable gate.

## Why this gates everything else

Today League and Club aren't purchasable (`gatingStatus: 'early_access'`, checkout rejected server-side), so every Club decision (bands, $219 price, whole-staff portals) is untested against a single paying club. A managed cohort produces that validation — and the cohort the Founding-Season conversion play would later convert — but opening before the product delivers on first use accelerates the cliff and damages word-of-mouth. So: open only when the checklist is green.

## The "Ready to Open" Go/No-Go Checklist

A real admin (not the founder, not an engineer) must complete each end-to-end **without assistance** on a clean org. Group by module per tier.

### League (house-league) readiness
- [ ] Create a season → register players → assign teams → generate a schedule → publish → standings update after a result.
- [ ] Parent/participant notifications send and arrive (no 0-delivered, working reply path, rainout/postpone path). *(Coordinates with the open House-League In-Season Trust plan — that work is a dependency, not a duplicate.)*
- [ ] Money: registration fees / dues tracked honestly end-to-end (manual is acceptable pre-payments).
- [ ] No vanishing-season / schedule-honesty blockers outstanding.

### Club (adds rep teams + accounting + whole-staff portals)
- [ ] Provision a Club org → invite the whole coaching staff → each coach lands in a populated Premium portal (roster/schedule/fees) with **no per-team charge** (depends on **Club Repackaging** Phases 1–3).
- [ ] Team-count capacity enforced at the band boundary; over-cap add prompts upgrade.
- [ ] Accounting: org-level financial summary / board numbers are trustworthy *(coordinates with the open Billing & Accounting Coherence plan)*.
- [ ] Tournaments + house league + rep teams coexist without the tournament-first IA skew burying modules *(coordinates with Admin IA & Multi-Module Nav)*.

### Cross-cutting commercial readiness
- [ ] **Club Repackaging** complete through Phase 4 (pricing surfaces show bands, no $19 row, "League" not "League Plus").
- [ ] Stripe prices live for repriced Club + Club Large + League (sandbox + live), checkout verified end-to-end.
- [ ] Founding-Season comp mechanics confirmed for the cohort (how the comp is applied/tracked).
- [ ] Support posture: a documented path for cohort issues (who responds, how fast).
- [ ] Rollback/runbook if a cohort org hits a blocker mid-season.

## Architectural Decisions
- **Gating flip is the last step.** Opening = set `gatingStatus: 'live'` for `league` (and `club`/`club_large` when their bands are ready) in `lib/plan-config.ts`, owned by `/billing`, only after this checklist is green. Comment in `plan-config.ts` already notes this is the single switch.
- **Managed, not open-door.** Cohort is invite-only; no public self-serve until post-cohort validation.

## Phases
### Phase 1 — Define + baseline
- [ ] Ratify the checklist above with the owner; map each item to its owning plan (House-League In-Season Trust, Billing & Accounting Coherence, Admin IA, Club Repackaging).
- [ ] Baseline run: a real admin attempts each flow today; record pass/fail. The fails are the hardening scope.
### Phase 2 — Hardening sprint
- [ ] Burn down the failed checklist items (mostly via the dependency plans above, sequenced).
### Phase 3 — Go/No-Go + open
- [ ] Re-run the checklist clean → owner go/no-go → `/billing` flips gating for the cohort → invite 5–10 Club + 10–15 League.

## Open Questions
- [ ] Is League opened at the **same time** as Club, or League first (it has fewer dependencies)? Recommend staggering League slightly ahead if Club Repackaging lags.
- [ ] How is the Founding-Season comp represented for cohort orgs (existing comp/override path vs new)? → `/billing`.
- [ ] Cohort selection criteria + outreach — coordinate with the GTM mid-size-beachhead focus → `/marketing`.
