# Coaches Portal — Tryouts & Evaluation (+ Phase 1 quick wins)

**Status:** PLANNED, not started. Scoped 2026-06-29 from a 4-pass multi-agent brainstorm (tryout/eval ideation → premier-suite "wow" scan → owner-filtered consolidation). This plan owns **Phase 1 (compliance + quick win)** and **Phase 2 (Tryout & Evaluation)** of a 5-phase Coaches Portal value roadmap. Phases 3–5 + parked/excluded scope are summarized in the companion brief; each later phase gets its own plan when it comes up.
**Companion brief:** `COACHES_PORTAL_TRYOUTS_EVAL_PM_BRIEF.md`
**Surface:** Premium Coaches Portal (`app/[orgSlug]/coaches/teams/[teamId]/**`) + the existing public tryout registration form (`app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/register`) + admin tryout management (`app/[orgSlug]/admin/rep-teams/.../tryouts`).
**Owner filters (2026-06-29, binding):** NO live play-by-play / scorekeeping surface; NOTHING PIPEDA-risky (no public minor profiles / view-tracking / public child leaderboards); cross-platform stat aggregation is PARKED (future, user-upload-only path — see BUSINESS_DECISIONS.md 2026-06-29).

## Why
The portal already has a tryout **intake** pipeline (families self-register → admin moves pending → offered → accepted → roster row with `source='tryout'`) but **zero coach-facing evaluation, scoring, ranking, or tryout-day tooling**. Every rep coach still runs tryout day on a paper clipboard + a spreadsheet. This is the single biggest functional gap in the Premium Coaches Portal and the most-requested rep-coach job-to-be-done.

Two structural advantages:
1. **Bundled pricing.** Competitors charge per-player ($4–$10/player/yr) or ~$799/yr standalone. We fold the whole thing into the existing per-team subscription — a decisive wedge (a 60-player club pays $0 incremental vs $240–$600 elsewhere).
2. **Canadian-native.** OBA/Softball Canada tryout windows, PIPEDA/CASL consent, and provincial starter templates are cheap for us and structurally invisible to US-first incumbents.

Plus a current-state fix: the existing public tryout registration form already collects minors' PII (DOB, guardian contact, medical notes) with **no consent capture** — a live PIPEDA gap that must close before we drive more traffic to it.

## Sequencing principle
Fix the one compliance gap and ship the cheapest universal win first; then the flagship tryout day MVP; then scoring + decisions. Each item is a small, independently shippable, browser-verified diff. Tryout season is seasonal (OBA window ≈ July 1 → 2nd Sunday of September) — realistically this targets the 2026 fall / 2027 spring cycles, not an in-flight build before July 1 2026.

---

## Phase 1 — Compliance + quick win (ship first; small, low-risk, standalone)

> **Build-ready breakdown:** `COACHES_PORTAL_TRYOUTS_EVAL_PHASE1_PLAN.md` (handed to `/plan` 2026-06-29 — code-grounded task list; 1.1 build-ready, 1.2 blocked on one owner trigger decision).

### 1.1 Tryout registration consent + compliance capture (PIPEDA/CASL) — BLOCKER, do first
- Add three individually-ticked consent checkboxes to the existing public `TryoutRegisterForm` before Submit: (a) PIPEDA data-collection consent, (b) CASL email-communication consent, (c) eligibility/guardian confirmation.
- Capture `consent_at` (timestamp) and `consent_ip` **server-side** (never sent to client). Store which boxes were ticked.
- Admin tryout list gains a **Compliance** column (green check + timestamp per candidate) and a downloadable consent log (CSV/PDF) — association-dispute ready.
- Consent records survive season archiving with a 7-year default retention; only org admins can delete (confirmation-gated), never coaches.
- **Reuse:** `lib/export/index.ts` + `downloadPDF` for the log export; existing form + admin list surfaces.
- **Why first:** the public form is live today and collecting minor PII without documented consent. This closes an existing exposure and is the prerequisite that keeps everything downstream PIPEDA-clean.

### 1.2 Pre-game attendance pulse (one-tap RSVP)
- Two hours before any game/practice event, push a notification to each rostered player's guardian/contact: "Game today at 6pm — coming?" One tap: **Coming / Late (time field) / Not coming (optional note)**.
- Coach sees a live headcount card on the Schedule/Overview screen — green/yellow/red/grey dots that update as replies arrive; tap a grey dot to nudge.
- **Reuse:** existing attendance records (`RepAttendanceStatus`) and the existing push/notify infrastructure; no new analytics, no PA logging. RSVP responses can pre-fill the existing per-event attendance.
- **Why now:** highest value-to-effort item in the whole roadmap; solves a universal volunteer-coach pain; creates an at-every-event engagement loop; and generates clean attendance data that later phases lean on.

---

## Phase 2 — Tryout & Evaluation (the flagship gap)

### Tryout surface architecture (DECIDED 2026-06-29 — owner)
A "tryout" gets its **own dedicated surface, NOT a schedule event.** Owner rationale: there is a lot of tryout-specific data and metrics (candidate pool, evaluation sessions, rubric scores, rankings, stations) — far more than a single schedule row should carry. **A tryout schedule entry auto-creates when the coach sets the tryout date(s)/time(s)** (so the date still shows on the calendar for families/coaches), but the tryout *workspace* itself is a separate object that owns all the candidate + evaluation data. Do **not** add a "tryout" value to the game-day event types. Confirm the data model with `/dba` before building 2A (the auto-created calendar entry ↔ tryout-workspace link, and how multi-day/multi-session tryouts map to it).

### Phase 2A — Replace paper on tryout day (the MVP slice)

**2A.1 Candidate check-in + auto bib assignment**
- Coaches-portal day-of view reads the existing candidate pool (tryout registrations). Each candidate gets an auto-assigned bib number; tap to check in (row turns green). Walk-up add via a minimal form (reuses the existing admin `handleManualAdd` pattern → new `tryout_registration` row).
- Designed phone-portrait, large tap targets, diamond-side. New additive nullable fields on the registration: `bib_number`, `checked_in`, `checked_in_at`.
- **Reuse:** DndKit (already present) for bib reordering; existing manual-add route; `UnsavedChangesGuard`.

**2A.2 Blind (bib-only) evaluation — default ON**
- Tryout event carries `anonymous_mode` (boolean, default true) + `scores_locked_at` / `scores_locked_by`. Evaluators see bib numbers only, never names. Head coach taps **Reveal Names** — a one-way, timestamped, audited action (no re-blind, no admin override to re-blind).
- The scoring card is a **display filter**, not a separate data model.
- **Why:** highest differentiation in the set — no self-serve competitor makes blind scoring the default; provincial associations actively recommend numbered-pinnie evaluation. Strong Canadian-market PR claim.

**2A.3 Provincial tryout-window date check**
- When a tryout date is set, compare against the OBA/Softball Canada window (computed dynamically) and show a **non-blocking** yellow banner if outside it. Dismissable, continue allowed.
- Window dates live in a sport+province-keyed config (`lib/tryout-windows.ts`), nullable — adding Softball Ontario / Baseball Alberta / BC is a config entry, not code. Name the specific body in the warning ("OBA tryout window"), and gate it to the org's province (Ontario-only V1 with an explicit "if not OBA-affiliated, ignore" note if no province field exists).

**2A.4 Printable candidate manifest PDF**
- One-tap branded PDF from the tryout event: bib number, name, age, position preference, check-in checkbox, notes column. Bib-only when blind mode is on. Paper fallback for connectivity failure.
- **Reuse:** `downloadPDF`; gated to the existing `pdf_exports` plan feature (org-branded above Tournament Plus, FieldLogicHQ-branded otherwise) — no new gate.

### Phase 2B — Score and decide

**2B.1 Configurable evaluation rubric builder**
- Head coach builds a digital scorecard pre-tryout: name skill categories, pick a 1–5 or 1–10 scale, assign percentage weights, add per-category evaluator instructions. Canadian softball/baseball **starter templates** seeded from the Sport Pack so common criteria appear without effort. Clone-rubric for multi-day reuse.
- Storage: a `tryout_rubrics` row with categories as JSONB (low migration risk). Option sets follow the established `lib/rep-roster-options.ts` normalize-app-side pattern.
- **Note:** this is the foundation every scoring/ranking feature depends on — but it's mid-effort, so it does NOT anchor the day-of MVP (2A ships first and is usable without rubrics).

**2B.2 Multi-evaluator mobile scoring + live aggregation + bias flag**
- Head coach generates short-lived **no-account session links** for co-coaches (volunteers won't make a third app account). Each evaluator scores one player at a time (swipe to advance, tap per category). Head-coach dashboard shows live composite averages (Supabase Realtime). An **evaluator-bias indicator** flags an evaluator scoring consistently above/below the group mean.
- **Reuse:** Realtime pattern already proven in `CoachTournamentRecord`.

**2B.3 Ranked candidate board + drag-to-form-roster**
- After scoring closes, candidates sort by weighted composite. Drag between **Offer / Waitlist / Not this season** (DndKit, kanban-style). "Roster spots remaining" counter. Submitting decisions calls the existing status-transition workflow.
- **Avoid the "coachability flag" UI** from the brainstorm (surfacing a highlighted low "attitude" score is a parent-dispute/documentation liability) — a private overall note is fine; a flagged character score in the ranking UI is not.

**2B.4 One-click accept-to-roster + fee setup**
- Marking a candidate Accepted opens a slide-in drawer pre-filled from the registration (name, DOB, jersey picker with dup-detection, position). One "Apply standard fee schedule" option if a fee template exists. One confirm creates the roster row (`source='tryout'`, links `tryoutRegistrationId`) **and** the dues schedule in a single transaction.
- **Reuse:** existing `createRepRosterPlayer` + dues-schedule creation; fee-template carry pattern from `lib/rep-season-rollover.ts`. **Note:** the coaches-portal auth context (team entitlements) differs from the admin route's org-capability checks — this is a new coach-scoped mutation endpoint, not a free reuse.

**2B.5 Branded offer / waitlist / release emails**
- Org-branded offer email with Accept/Decline buttons (token-authenticated response page), dignified default release copy, and **auto-promote from waitlist** when an offer lapses (deadline tracking). Reuses the existing announcement-email HTML pattern + Resend stack.

---

## Decisions LOCKED (this conversation, 2026-06-29)
- No live play-by-play / scorekeeping surface anywhere in this work.
- **Tryout = its own dedicated surface, auto-created from the tryout date/time** (not a game-day schedule event). See architecture section above.
- **Build order: 2A (check-in + blind + date-gate + manifest) ships before 2B (rubric/scoring/decisions).** Consent gate (1.1) ships first of all.
- Blind evaluation is **default ON**; reveal-names is one-way + audited (no admin re-blind).
- **Sport-neutrality pre-work approved:** fix the existing `getSportPack(DEFAULT_SPORT)` / hard-coded-positions violation before metrics features build on it.
- **Packaging (DECIDED + logged 2026-06-29):** the suite is **included in the existing Premium Coaches Portal at no extra charge — no per-player fee, no add-on, no new plan, no price change** (the competitive wedge vs per-player competitors). Logged in `BUSINESS_DECISIONS.md` (2026-06-29). Build-time follow-through: confirm the "included in Premium" gate via `/billing` + reflect the inclusion in `PLAN_PRICING_FACTS.md` + `lib/plan-config.ts` in the same unit of work. Coaches Portal plan is `gatingStatus: 'early_access'` today; sequence accordingly.

## Decisions OPEN (need owner / routed agent)
- **Consent-log Club-tier sub-question:** keep the compliance/audit export in Premium (default) or lean it Club-tier where the org admin is the compliance buyer? → resolve with `/billing` at build.
- **No-account evaluator session links:** confirm acceptable security posture (see guardrails).

## Guardrails (binding)
- **Sport-neutral:** every position/skill/score label routes through `getSportPack(team.sport ?? DEFAULT_SPORT)` — no hard-coded "Runs/Innings/diamond/P-C-1B/windmill" outside the SportPack registry + Canadian template copy. ⚠ **Pre-work:** the roster page, player profile, and lineup generator currently call `getSportPack(DEFAULT_SPORT)` / hard-code `FIELD_POSITIONS` despite `RepTeam.sport` being populated — fix that one-PR violation before metrics features build on top of it.
- **PIPEDA/CASL for minors:** consent gate must be live before public tryout registration is promoted; `consent_ip` server-only; consent + evaluation records survive archiving (7-yr default), coach-undeletable.
- **Mobile field-side:** ≥48px tap targets, one-player-at-a-time card flows (not tables), auto-save per score entry, optimistic local state for intermittent connectivity; the printable PDF is the connectivity-failure fallback. Test on real mid-range Android.
- **Multi-evaluator integrity:** unique constraint on (evaluator_session, candidate, category) → upsert not duplicate; scores immutable after sign-off; **a new realtime `tryout_scores` table needs `REPLICA IDENTITY FULL`** (same gotcha as the mig-132 live-score-toast incident — `check:migrations` is blind to it).
- **Evaluator link security:** cryptographically-random token, ≤48h expiry, per-evaluator (non-shareable), **explicit `revoked_at` checked server-side on every score write**, all links invalid once the session closes.
- **Plan-gate consistency:** any new `hasPlanFeature` key lands in `PLAN_PRICING_FACTS.md` + `lib/plan-config.ts` in the same unit of work; reuse the `pdf_exports` gate for branded PDFs (no parallel `tryout_pdf` key).
- **Returning-player matching (Phase 3, noted here):** match on guardian email **+ name/DOB** to avoid sibling collisions; label "possible — verify," never auto-merge.

## Acceptance (per slice)
No horizontal scroll at 360–414px; all primary controls ≥40px; overlays are bottom-sheets; blind mode verified to never leak names pre-reveal; consent log exports with timestamp + IP; multi-evaluator double-tap produces one score not two; offline/poor-connectivity falls back to the PDF without data loss. Owner does device verification per slice. `/review` after each substantive slice; `/docs` when a coach-facing flow changes.

## Schema/dictionary note
Every additive field above (consent fields, bib/check-in fields, rubric/scores tables) updates `DATA_DICTIONARY.md` + refreshes dev/prod snapshots in the same unit of work; decide column existence from snapshots, never migration files.
