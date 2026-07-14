# Coach Insights — Weekly Digest + Smarter Findings — Implementation Plan

> **Status:** In Progress — owner approved from the browser mockup 2026-07-10 (`public/mockups/insights-next.html`, throwaway). Building.
> **Branch:** `dev` · **No migration** (dedupe rides the notifications table; all data from existing sources).
> **PM brief:** [COACH_INSIGHTS_DIGEST_PM_BRIEF.md](COACH_INSIGHTS_DIGEST_PM_BRIEF.md)
> **Parent:** the completed/archived [COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md](../archive/COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md) — its extensibility invariants (rule registry, six-slot cap, priority ladder, admission test, within-season only, Overview⇄Insights tense boundary) are BINDING here.

## Goal

Two riders on the shipped Insights V3 rails: (1) **four new finding rules** in the registry — dues-deadline proximity, game-vs-practice attendance split, position-coverage risk, momentum/milestone — same strip, same six slots, smarter triage; (2) a **weekly digest notification** (Sunday evening) that delivers each coach's top findings through the existing bell + push system, built per-recipient from what that person's capabilities allow, sent only when something actually fired.

## Phase tasks

- [x] 1. Recon (workflow): (a) the existing scheduled/reminder machinery (dues auto-reminders, game-day reminders) — trigger mechanism, route/auth pattern, dedupe idiom to reuse; (b) `notify()` API + `lib/notification-labels.ts` event-type registration + push defaults + per-user settings + the coach-recipient resolution precedent (e.g. `tournament_announcement`); (c) field confirmation: dues installment `amount` field (for the deadline rule's $ figure), attendance row per-category fields, `positionVariety` code semantics. **Key recon finding: NO app-level cron exists** (pg_cron runs SQL functions only; dues "auto" reminders are button-triggered) → the digest ships as a super-admin **trigger route**; scheduling wiring = owner decision at handoff
- [x] 2. `lib/insight-findings.ts`: extend inputs (`FindingsAttendanceRow` gains per-category games/practices; `FindingsDuesSummary` gains `nextDue`; `FindingsGameSummary` gains `recentResults`) + 4 new rules with conservative thresholds: **dues deadline** (money tier — next unpaid installment due within 7 days), **practice/game split** (attendance tier — both categories ≥ min sample, gap ≥ 20 pts, lower side < 70%), **coverage risk** (fairness tier, info — a field position played by exactly ONE player, `gamesWithLineup ≥ 3`), **momentum** (`≥5 wins in last 6`, suppressed when the streak rule already fired) + **milestone** (win #10/#15/…, only when the latest result is the win that reached it). Plus `formatInsightDigest()` — pure title/body builder (lead with one good-news segment when present, then top warns, max 3 segments, ladder order)
- [x] 3. Unit tests for every new rule + digest formatting + non-regression of the existing 17 (`tests/unit/insight-findings.test.ts` — 22 tests, all green)
- [x] 4. Insights dashboard passes the new input shapes (installment due-dates, per-category attendance, recent-results sequence) — dues shaping extracted to shared `summarizeDuesForFindings()` in `lib/insight-findings.ts` so dashboard + digest can never diverge
- [x] 5. Weekly digest job: `lib/insights-digest.ts` (`runInsightsDigestSweep` — per-team inputs composed once via existing db helpers, per-coach capability filter, one `notify()` per recipient, quiet ⇒ no send, per-team try/catch) + `POST /api/platform-admin/insights-digest` (super-admin; `{orgId?, teamId?, dryRun?}`; dryRun returns per-recipient previews; audit-logged) + `getInsightsDigestTeams`/`hasRecentNotification` in `lib/db.ts`. Dedupe = notifications-table query, 6-day window
- [x] 6. Notification plumbing: `coach_insights_digest` in the `NotificationEventType` union, labels/descriptions/category('know')/icon(📊), **push-default ON**; deep-link to Insights. NOT in `NOTIFICATION_SECTIONS` — coaches have no notification-settings surface yet (documented gap, same as the assistant-coach lifecycle events)
  - **UPDATE 2026-07-13 — opt-out gap CLOSED.** Notification Settings Phase 1 shipped the coach-facing off switch (dev): the digest now gets an always-visible Bell/Push control on the coach card of the universal `/account/notifications` page (via the new `COACH_SETTINGS_SECTIONS`, rule R1 — never buried). Push default stays ON; the fix is a first-class off switch, not a default flip. ⚠ Prod-promotion coupling: the digest's automatic Sunday schedule (Scheduled Jobs Wiring, mig 183) must not go live on prod before this off switch rides the same promotion.
- [x] 7. `/docs`: digest added to the Premium portal-tour guide (bell paragraph + searchable "week in review"/"weekly digest" terms + a dedicated FAQ covering quiet-week silence and per-coach capability filtering). NOTE: the guide says "Sunday evening" — true once the owner wires the schedule (see Open Decisions); tweak if a different cadence is chosen
- [x] 8. `/review` funnel over the diff (high-risk tier: 4 finder lenses; deterministic gate green first). 2 findings, both confirmed + fixed: (1) HIGH — sweep filtered program years to `status='active'` only, but the portal treats `draft` (the DB default) as current too → draft-season teams would silently never get digests; fixed to mirror `getActiveRepProgramYear` exactly (draft|active, newest per team). (2) MEDIUM — per-player installment N+1 across a platform-wide sweep; replaced with one batched per-team query (`getRepDuesInstallmentsBySchedules`). Re-verified: typecheck + 32/32 tests + focused lint green
- [ ] 9. Owner browser/device verification (trigger a manual digest run for the test team) → commit on owner OK → archive this pair

## Binding constraints carried forward

- Findings: cap 6 on-page; digest max 3 segments; every sentence verifiable one tap away; a rule with no qualifying data never fires; within-season only; Sport Pack vocabulary.
- Digest honesty: quiet week ⇒ **no send**; each recipient's digest built ONLY from inputs their capabilities allow (money lines never reach a money-off assistant); no invented urgency.
- Overview⇄Insights tense boundary untouched (the digest is Insights-tense: accumulated-season facts, not next-event operations).

## Open items / risks

- Scheduling trigger is whatever the recon finds the dues-reminder system uses — if there is NO reusable scheduled trigger, STOP and surface options to the owner (new cron entry point is fine; new infra is a decision).
- Milestone/momentum overlap with the streak rule is de-duplicated by rule guards (documented in code).
