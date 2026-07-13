# Scheduled Jobs Wiring — Insights Digest + Automatic Dues Reminders — Implementation Plan

> **Status:** In Progress — owner approved the scheduler proposal 2026-07-12 ("sounds good, go for it").
> **Branch:** `dev` · **Migration:** yes (pg_cron + pg_net schedule entries; no app-table changes expected).
> **PM brief:** [SCHEDULED_JOBS_WIRING_PM_BRIEF.md](SCHEDULED_JOBS_WIRING_PM_BRIEF.md)
> **Related:** [COACH_INSIGHTS_DIGEST_PLAN.md](COACH_INSIGHTS_DIGEST_PLAN.md) (open decision #1 → resolved by this plan).

## Goal

Make the two operator-triggered sweeps fire themselves: the coach Insights **weekly digest** (Sunday evening) and **dues reminders** (daily), using the platform's existing database scheduler (pg_cron) + async HTTP (pg_net) calling machine-authorized app routes. No new vendors; schedules ship as a migration; monitoring rides the existing heartbeat/audit idioms.

## Decision record (owner-approved 2026-07-12)

- **Scheduler = pg_cron + pg_net** (option 1 of 4 presented). Tradeoffs accepted: no automatic retry (mitigated — both jobs are idempotent + a second catch-up tick is cheap), UTC schedules (≈1h seasonal drift accepted for a digest).
- **Escalation path documented, not built:** EventBridge Scheduler is the drop-in upgrade if guaranteed retries/exact-local-time ever matter; the route contract (secret-header POST) stays identical.
- **Machine auth = shared-secret header** accepted by the trigger routes *in addition to* super-admin session; secret + app base URL live per-environment (Supabase Vault on the DB side, env var on the app side).
- **Dues copy/threshold review** is a blocking sub-step before the daily job goes live — reminders reach parents without a human once wired.

## Phase tasks

- [ ] 1. Recon (3 parallel agents): (a) existing dues-reminder machinery — helpers, sent-stamps, copy, recipients, current trigger UI + auth; (b) pg_cron migration precedent (observability), heartbeat pattern, migration numbering/tooling, pg_net/Vault presence; (c) proxy.ts treatment of `/api/platform-admin/*` + any shared-secret precedent + env conventions
- [ ] 2. Plan pair + TODO line (this file)
- [x] 3. Machine auth: `lib/cron-auth.ts` (`isCronRequest`, timing-safe `x-cron-secret` vs env `CRON_SECRET`, fail-closed when unset) wired into BOTH `insights-digest` and `dues-reminders` routes (secret OR super-admin); audit log records the principal (`cron-scheduler` vs the admin email)
- [x] 4. Dues sweep: `lib/dues-reminders.ts` (`runDuesRemindersSweep`) + `POST /api/platform-admin/dues-reminders` (super-admin or secret, `{orgId?,teamId?,dryRun?}`, audit-logged, per-team try/catch). Reuses `getDueReminderCandidates` + the existing sent-stamps + 7-day cooldown; email copy byte-identical to the org-admin wave. **Waves run 7-day-first then 30-day with a per-team claim-set** so an installment in the overlap (≤9 days out) gets ONE most-urgent email, never two per run
- [x] 5. Migration 183 (`183_scheduled_http_ticks.sql`): `pg_net` + `app_cron_http_tick(job,path)` (Vault-read URL+secret, `net.http_post` with `x-cron-secret`, heartbeats to `observability_cron_heartbeat`) + 3 idempotent `cron.schedule` jobs (digest Sun 23:00 UTC + Mon 13:00 UTC catch-up; dues daily 13:30 UTC). **Applied to dev**; Vault secrets set on dev; all 3 jobs verified active + tick fired `status='ok'`. Snapshots refreshed (watermark #183), dictionary functions/cron section updated
- [x] 6. Dues copy + thresholds review — see the handoff summary + the "Copy & cadence" note below. Copy is byte-identical to the shipped manual wave; the overlap fix removes the "≈30 days for something a week away" double-message. **Owner sign-off still pending before the dues schedule reaches prod.**
- [x] 7. Verify + `/review` (high-risk, 5 lenses; 1 lens hit an API-overload retry, its surface covered by the others). 9 findings → after dedup: **1 High fixed** (a network throw mid-batch discarded stamps for already-emailed families → per-guardian try/catch); **3 cheap fixes folded** (no-guardian-email counter for audit honesty; `maxDuration=300` headroom on both routes; timing-leak tradeoff comment on the auth helper); the recurring **concurrent-fire double-send** (reported 4×, Low–Medium) accepted + honestly documented (bounded to one email, cooldown-limited, pre-existing on the manual route; app-level advisory locks are unreliable under pgBouncer transaction pooling). Typecheck/lint green after fixes
- [ ] 8. `/docs` sync (help guide reminder wording) + records; handoff with owner setup steps (Amplify env `CRON_SECRET` dev+prod, Vault entries per environment, prod migration at next release). **No commit until owner OK.**

### Decoupled: UNSUBSCRIBE_SECRET prod gap (NOT shipping with this work)

While wiring the Amplify env, found that `UNSUBSCRIBE_SECRET` console vars exist (all-branches + dev) but were never echoed into the prod runtime build → prod has been signing unsubscribe links with the insecure code fallback. Adding the echo would flip the effective secret on the next deploy and **break every unsubscribe link already sent from prod** (a compliance-sensitive flow). To avoid a scheduler deploy silently breaking unsubscribe links, the echo line was **removed from `amplify.yml`** (a NOTE remains) and this fix is deferred to its own deliberate change — ideally paired with a fresh email send so live links re-sign. Owner already holds both env values; no new secret required.

## Copy & cadence (for owner sign-off — task 6)

- **Thresholds (unchanged from the shipped manual waves):** 7-day wave = unpaid installments due within 9 days; 30-day wave = due within 32 days. A 7-day resend cooldown means the same family isn't re-emailed for the same installment more than once a week.
- **Cadence:** daily sweep runs both waves; the overlap fix means each installment gets only its most-urgent email per run (no same-day duplicate). Across days the cooldown caps repeats.
- **Copy (FINALIZED — owner 2026-07-13):** the intro no longer approximates timing — reworded to "…the following dues installments are coming due for your player(s) on {team}:" (window-agnostic; the exact due date + installment n-of-m sit on each row). Applied consistently to ALL THREE proximity senders so a guardian gets identical wording regardless of trigger: the automatic sweep (`lib/dues-reminders.ts`), the org-admin wave (`app/api/admin/rep-teams/dues/send-automated-reminders`), and the per-team coach button (`app/api/coaches/.../dues/send-reminders`). Subjects still carry the "(7 days)/(30 days)" wave label. Preview artifact updated.

## Architectural decisions

- **Decision:** Trigger routes stay the single door for humans AND machines (secret is an alternate credential on the same route, not a parallel route). **Rationale:** one code path, one audit trail, one dedupe/idempotency story; swapping schedulers later touches nothing in the app.
- **Decision:** Schedules read app URL + secret from Supabase Vault rather than hardcoding into the migration. **Rationale:** one migration text works on dev and prod (different URLs/secrets); secrets stay out of the repo and out of the cron catalog.
- **Decision:** Both jobs stay idempotent-by-construction (digest 6-day dedupe; dues sent-stamps), so lost/duplicate ticks are harmless — this is what makes retry-less pg_net acceptable.

## Open questions

- [ ] Dues thresholds/copy sign-off (task 6) — owner.
- [ ] Whether the dev-environment schedules should stay enabled after soak (dev DB will fire against the dev app URL weekly/daily — useful soak, minor noise).
