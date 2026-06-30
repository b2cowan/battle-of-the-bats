# Coaches Portal — Tryouts & Evaluation · PHASE 1 — Implementation Plan

> **Status:** Planning (build-ready for 1.1; 1.2 blocked on one owner decision)
> **Created:** 2026-06-29
> **Branch:** dev
> **Parent plan:** `COACHES_PORTAL_TRYOUTS_EVAL_PLAN.md` (Phase 1 = §1.1 + §1.2; guardrails there are binding)
> **Companion brief:** `COACHES_PORTAL_TRYOUTS_EVAL_PM_BRIEF.md`

## Goal
Ship the two Phase 1 items: (1.1) a PIPEDA/CASL **consent capture** on the existing public tryout registration form + an admin compliance/export surface — a small, dependency-free fix that closes a live exposure; and (1.2) a **pre-game attendance RSVP** that reaches families by email (one-tap links) and gives the coach a headcount. Grounded in a codebase investigation (2026-06-29) that changed the 1.2 approach — see Architectural Decisions.

## PM Brief
**What it does:** (1.1) Families tick three consent boxes before submitting a tryout registration; we stamp the consent time + server-side IP; admins get a compliance column + consent export. (1.2) Each rostered family gets a "you in?" email with Coming / Late / Not-coming links; taps record attendance; the coach sees a headcount with a nudge for no-replies.
**Why it matters:** 1.1 closes a live PIPEDA gap (the public form already collects minors' PII with no consent) and gives orgs a dispute-ready record. 1.2 solves the universal pre-game headcount scramble and seeds the attendance data later phases use.
**Who benefits:** 1.1 — registering families (clear consent), org admins (compliance record). 1.2 — rep coaches (headcount) and families (one tap to reply). Both included in the Premium Coaches Portal; no new gating.
**Expected impact:** No tryout registration without documented consent; an exportable consent log. Coaches stop chasing texts before games; attendance data starts accumulating.
**Priority:** High — 1.1 is a compliance blocker for the rest of the tryout work; 1.2 is the highest value-to-effort engagement win.
**Success criteria:** Form cannot submit without all three consents; consent timestamp + IP stored server-side; admin compliance column + consent export work. RSVP email delivers one-tap links; a tap records the right attendance status; coach headcount reflects replies.

---

## Ground-truth findings that shaped this plan (from 2026-06-29 code investigation)
- **Public form:** `components/rep-teams/TryoutRegisterForm.tsx` → `POST /api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts` → `createRepTryoutRegistration()` (`lib/db.ts` ~4360). **No consent field exists today.**
- **Data model:** `rep_tryout_registrations` / `RepTryoutRegistration` (`lib/types.ts` ~1074). **No delete exists anywhere** (only status → declined/withdrawn); rollover sets season `completed` and **purges nothing** → the "coach-undeletable / retained" requirement is already satisfied structurally; **no delete to build.**
- **Admin tryouts page:** `app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx` — HTML table + slide-over; gated `hasCapability(..., 'module_rep_teams')` + `canWrite = owner|admin`. **Coaches never reach this surface.** Live `ExportMenu` already present (XLSX/CSV + "with contact details" sensitive variant); **PDF item is a "coming soon" stub** that does NOT call `downloadPDF`.
- **Server IP helper exists:** `clientIpFrom(req)` in `lib/rate-limit.ts` (reads `x-forwarded-for`). Reuse it; do NOT accept IP from the client body.
- **Export pipeline:** `lib/export/*` (serializeRows/serializeHeaders, CSV/XLSX working; `downloadPDF` table-render may be a stub — verify). Stale catalog entry `'rep-teams-tryout-registrations'` (flagged omittedReason/plannedPhase + wrong file path) — optional cleanup.
- **🔴 No scheduled-job infrastructure anywhere.** No cron route, worker, EventBridge, Vercel cron (app is on Amplify). `pg_cron` exists but only for observability housekeeping. The **only** time-based delivery is **Resend `scheduled_at`** (used by `app/api/admin/schedule-publish/route.ts` for game-day reminders; cancellable via `cancelScheduledEmailForRecipient()`).
- **🔴 Guardians have no app identity.** `notifications.user_id` and `push_subscriptions.user_id` are hard FKs to `auth.users`; guardians are **not push- or in-app-reachable** — only by **email** (the `lib/rep-team-announcements.ts` guardian_email pattern). Anonymous fan push is score-alerts-only, tournament-scoped — not usable here.
- **Realtime not used in the Premium Coaches Portal at all** (schedule/attendance/overview are fetch-on-mount). Live-updating would need a NEW Realtime subscription + `REPLICA IDENTITY FULL` on the attendance table. A 30s polling hook (`usePublicTournamentLive`) is the lighter precedent.
- **Attendance model:** `rep_team_event_attendance`, upsert on `(event_id, player_id)`, statuses `unknown|attending|absent|late`, `note`, `updatedBy`. API: `PATCH /api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/attendance`. Functions `getRepTeamEventAttendance`, `upsertRepTeamEventAttendance` in `lib/db.ts`.
- **Token-action precedent:** `/coaches/claim/[token]` (SHA-256 hashed token, no login) and `/unsubscribe` (HMAC token via `lib/unsubscribe-token.ts`, no login) — templates for a guardian RSVP page with no account.

---

## Phase 1.1 — Tryout consent capture (BUILD-READY; ship first, standalone)

### Tasks
- [ ] **Migration (first task)** — additive **nullable** columns on `rep_tryout_registrations`: `consent_data_collection boolean`, `consent_email_comms boolean`, `consent_eligibility boolean`, `consent_at timestamptz`, `consent_ip text`. No backfill (pre-gate rows stay NULL = honest "no consent on record"). Confirm exact shape with `/dba` (explicit columns vs a `consents` jsonb — recommend explicit for the queryable compliance column). Use the next free migration number (watermark ~#163).
- [ ] **Schema = dictionary (same unit of work)** — update `docs/agents/db/DATA_DICTIONARY.md` for the 5 columns + `npm run refresh:snapshots` (dev+prod) + confirm `npm run check:dictionary` green.
- [ ] **Types + mapper** (`lib/types.ts`, `lib/db.ts`) — add the 5 fields to `RepTryoutRegistration`; map snake_case in the row mapper. *(shared module → dev-server restart at handoff)*
- [ ] **Create function** (`lib/db.ts` `createRepTryoutRegistration` ~4360) — accept + persist the consent fields. *(shared module)*
- [ ] **Form** (`components/rep-teams/TryoutRegisterForm.tsx`) — add three **individually-ticked, required** checkboxes before Submit (data-collection / email-comms / eligibility-guardian). Block submit until all three are checked. *(copy wording is legal-ish — see Open Questions; functional labels can ship, wording review recommended)*
- [ ] **Submit route** (`app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts`) — server-validate all three consents true (reject otherwise); set `consent_at = now()` and `consent_ip = clientIpFrom(req)` **server-side**; never read IP/consent-time from the request body.
- [ ] **Admin compliance column** (admin tryouts page) — show a green check + consent date when `consent_at` set; "—  / no consent on record" otherwise. Read-only indicator.
- [ ] **Consent export** — extend the existing admin `ExportMenu` column set with the consent fields (flags + `consent_at` + `consent_ip`), marking IP/consent as **sensitive** (opt-in variant) via `lib/export` serializeRows/serializeHeaders. CSV/XLSX is the V1 deliverable (both working). PDF only if `downloadPDF` table-render is confirmed functional (see Open Questions).
- [ ] **(Optional) catalog cleanup** (`lib/export/catalog.ts`) — drop the stale `omittedReason`/`plannedPhase` and fix the `file` path on `'rep-teams-tryout-registrations'`.
- [ ] **Verify** — `npm run typecheck` (shared modules touched) + focused lint + `check:dictionary`. Browser (owner): submit blocked without all consents; consent row carries server-side timestamp + IP; admin compliance column + consent export present. `/review` after the slice; `/docs` (the registration flow is customer-facing).

### Notes
- **No delete is built.** Retention is satisfied by absence of delete + nothing-purges-on-rollover. If a future delete is ever added it must be org-admin-only, confirmation-gated — out of scope now.
- No plan-gate change: consent capture is part of the existing rep-teams/tryout flow (admin gated by `module_rep_teams` as today).

---

## Phase 1.2 — Pre-game attendance RSVP (spec'd; BLOCKED on one owner decision — Open Question 1)

Recommended **no-new-infrastructure V1**: email + one-tap token page + (auto-scheduled or manual) send. True push / true-realtime are deferred (they'd need guardian app identity and/or a scheduling platform — separate, larger work).

### Tasks (recommended V1)
- [ ] **RSVP token util** — new `lib/rsvp-token.ts`, HMAC-SHA256 over `(eventId, playerId, status)` mirroring `lib/unsubscribe-token.ts`. No new table needed (signature-verified). Short validity tied to the event date.
- [ ] **Public RSVP action** — `app/api/public/rsvp/route.ts` (or an `app/rsvp/...` page): GET with `token` + `status` → verify HMAC → `upsertRepTeamEventAttendance` mapping Coming→`attending`, Late→`late` (+ optional time in `note`), Not-coming→`absent`; set `updatedBy = 'guardian'`; render a tiny no-login confirmation page. Idempotent (re-tap overwrites).
- [ ] **RSVP email** — new template in `lib/email.ts` (event details + three one-tap links); a sender that gathers active-roster `guardian_email`s (reuse the `lib/rep-team-announcements.ts` recipient pattern + recipient cap) and sends via `sendEmail`/`sendMarketingEmail`.
- [ ] **Trigger wiring** — depends on Open Question 1:
  - *Option A (recommended, no new infra):* on event create/edit for a game/practice >2h out, schedule the RSVP email at `start − 2h` via Resend `scheduled_at` (mirror `schedule-publish`); store the Resend id (additive nullable `rsvp_email_resend_id` on the event) to **cancel/reschedule on time-change or cancel**; plus a manual **"Send RSVP request now"** button for inside-2h/ad-hoc. *(migration if the id column is added → dictionary + snapshots)*
  - *Option B (simplest):* manual **"Send RSVP request"** button only; no auto-scheduling.
- [ ] **Coach headcount card** — surface attendance-row counts (in / late / out / no-reply) on the event slide-over (schedule page) and/or the Overview "Next up" card; one-tap **nudge** re-sends to no-reply guardians. Fetch-on-load (no realtime — see Open Question 3).
- [ ] **Schema = dictionary** if any column added; **types**; **verify** (typecheck if shared modules/email/event API touched; browser: email links record the correct status; headcount reflects replies). `/review` after the slice; `/docs` (coach + family-facing).

### Notes
- **Channel is email**, not push — guardians have no app identity (ground truth). Reframed honestly from the parent plan's "push" wording.
- Writes into the **existing** attendance table — RSVP and coach-set attendance share one record per (event, player); a guardian reply pre-fills what the coach would otherwise tap.

---

## Architectural Decisions
- **Consent IP captured server-side via `clientIpFrom()`**, never from the client. **Rationale:** PIPEDA integrity + the helper already exists; client-supplied IP is forgeable.
- **No delete built for consent/registrations.** **Rationale:** none exists today and rollover purges nothing, so retention + coach-undeletability are already met; building a delete would *add* risk.
- **1.2 reaches families by email + token page, not push/in-app.** **Rationale:** guardians have no `auth.users` identity; push/in-app are FK-locked to accounts. Email + no-login token action is the established no-account pattern (claim/unsubscribe).
- **1.2 trigger uses Resend `scheduled_at` (or manual), not a new scheduler.** **Rationale:** the platform has no job-scheduling infra; Resend scheduling is the proven existing mechanism (game-day reminders). Building a real scheduler is its own project, not a Phase 1 quick win.
- **1.2 headcount is fetch-on-load, not realtime.** **Rationale:** the portal uses no Realtime today; true-live would need a new subscription + `REPLICA IDENTITY FULL` on the attendance table — deferred.

## Open Questions (need owner / routed agent before/within build)
- [ ] **OQ1 — 1.2 trigger mechanism (BLOCKING for 1.2):** Option A (auto-schedule ~2h before via Resend + manual fallback) — recommended; Option B (manual "send now" only) — simplest; Option C (build real scheduled-job infra) — out of scope, own project. **Pick A or B.**
- [ ] **OQ2 — 1.2 channel:** confirm **email-only** is acceptable for V1 (push would require building a guardian identity/PWA-subscribe capability — much larger).
- [ ] **OQ3 — 1.2 liveness:** confirm **fetch-on-load** headcount is acceptable for V1 (true-live dots = new Realtime subscription + REPLICA IDENTITY FULL).
- [ ] **OQ4 — 1.1 consent copy:** the three consent statements are legal-ish — review exact wording with legal/`/marketing` before ship? (functional labels can ship; wording review recommended).
- [ ] **OQ5 — 1.1 storage shape:** confirm explicit columns (3 booleans + `consent_at` + `consent_ip`) vs a `consents` jsonb — recommend explicit (for the compliance column). Confirm with `/dba`.
- [ ] **OQ6 — 1.1 PDF:** confirm whether `downloadPDF` table-render is functional (admin PDF is a "coming soon" stub). If not, consent log ships **CSV/XLSX only** for V1.

## Relationship to other work (not Phase-1 blockers)
- **Sport-neutrality pre-work** (parent-plan guardrail) is a Phase-2/metrics prerequisite — **Phase 1 does not touch sport vocabulary**, so it is not blocked by it.
- **Packaging** decided/logged (bundled in Premium, no price change) — Phase 1 needs no gating change.
