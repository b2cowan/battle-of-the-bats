# PM Brief — Dashboard "Completed" + Post-Event Summary IA

**Status:** Proposed (awaiting approval) · **Date:** 2026-06-06 · **Branch:** dev
**Part of:** Admin Visual Redesign Phase E QA (Dashboard "Completed" + "Summary" rows)
**Plan:** [DASHBOARD_SUMMARY_IA_PLAN.md](DASHBOARD_SUMMARY_IA_PLAN.md)

## The problem in plain language

When a tournament finishes, the organizer has **two screens that say almost the same
thing**:

- The **Dashboard** flips to a "completed" view showing a recap (teams, games played,
  money collected) plus an Archive button.
- The **Post-Event Summary** (a Tournament Plus feature) shows the *same* recap numbers
  again — and then piles on a division recap, champion detection, and a row of five
  competing buttons (copy standings link, public standings, keep Plus active, reuse this
  setup, print).

So a paying customer sees the recap twice, and the Summary page is noisy because it tries
to do three unrelated jobs at once: **tell me how it went**, **help me share it**, and
**get me to renew / reuse for next year** — all with equal visual weight.

## What changes

We give each surface **one clear job**:

| Surface | Today | After |
|---|---|---|
| **Dashboard (completed)** | A full second recap | A **thin wrap-up** that hands off to the recap |
| **Post-Event Summary (Plus)** | Recap + share + renewal, all competing | The **single canonical recap**, in three ranked zones |

**Dashboard, completed — becomes a hand-off, and it's plan-aware:**
- **Tournament Plus orgs:** a short "Tournament complete" banner with the headline numbers
  and one primary button — **"Review event summary →"**. The detailed recap moves to
  Summary (no more duplication). Archive stays (owner-only).
- **Free Tournament orgs:** because their Summary is locked, the dashboard **keeps** the
  recap (final registration + final payments) so they're never left empty, plus **one tidy
  upsell line** that names what Plus unlocks (champions, shareable results, reuse next year).

**Post-Event Summary (Plus) — becomes the one recap, with a real hierarchy:**
1. **Recap (top, always visible):** champions first (the thing the organizer most wants to
   see and the one thing the dashboard can't show), then the at-a-glance stats, then the
   per-division detail.
2. **Share the results (compact, secondary):** copy the public standings link, open public
   standings, print — grouped together and quiet.
3. **Plan next year (collapsed by default):** reuse this setup + keep Plus active — tucked
   into a collapsible card so the renewal ask stops competing with the recap.

The **Free (locked) Summary** and the **clone-success** screens are unchanged in purpose;
they just inherit the cleaner styling and button rules.

## Why it matters

- **Less confusion, more trust.** One recap surface, one share spot, one renewal ask — the
  organizer always knows where to look.
- **The click is rewarded.** The dashboard answers "did it finish clean?" at a glance;
  clicking through to Summary pays off with **who won** — the emotional high point of the
  event.
- **Free still feels complete.** Free orgs keep a credible recap on the dashboard and get a
  single, honest upgrade nudge instead of a dead-end link to a lock wall.
- **It closes the Phase E QA loop** on the two surfaces and fixes outstanding design-system
  violations (the Summary page uses banned `btn-sm` buttons today).

## Who is affected

| Role | Before | After |
|---|---|---|
| **Owner/Admin (Plus)** | Recap twice; noisy Summary | Thin dashboard → rich, organized Summary; Archive unchanged |
| **Owner/Admin (Free)** | Recap on dashboard; Summary is a pure lock wall | Recap kept on dashboard + one clean upsell; lock wall unchanged |
| **Staff** | Same as admin (Archive hidden — owner-only) | Unchanged access model |
| **Coach / Public** | — | No change (these are admin-only surfaces) |

## Success criteria

- The recap appears on exactly **one** surface per plan (no duplication for Plus).
- Summary reads as three distinct, ranked zones; the CTA count in the share/renewal area
  drops from ~5 competing peers to a clear primary-plus-secondary in each zone.
- Champions are the first thing on Summary and the payoff for clicking through.
- Free orgs never hit an empty completed-dashboard, and never click a "summary" link that
  leads only to a lock.
- All five Summary states preserved (loading, error, no-tournament, locked/upsell, clone
  success); Dashboard Draft and Active/Live states untouched.
- Zero `btn-sm` / `btn-primary` (outside modals) on either surface; `CollapsibleCard` reused
  for the renewal zone.

## Priority & scope

Medium — quality/IA cleanup inside an already-greenlit redesign phase. **No new data model,
no API contract changes, no migration.** Pure front-end IA + styling, plus a small amount of
copy. Browser testing by the user on `/dev-test-org/completed-demo`.
