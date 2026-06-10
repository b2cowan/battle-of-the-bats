# Phase 5 — Tournament Coach Experience · Build Plan

**Status:** SCOPED 2026-06-09 (10-agent workflow: 8 surface maps → architect synthesis → adversarial critic) · awaiting owner sign-off on the open decisions before build · branch `feat/free-tier-coaches`
**Parent:** [FREE_TIER_COACHES_UNIFIED_PLAN.md](FREE_TIER_COACHES_UNIFIED_PLAN.md) Phase 5 · detail ref [COACHES_EXPERIENCE_EVAL_PLAN.md](COACHES_EXPERIENCE_EVAL_PLAN.md) Phases B/C/D/E
**Builds slice-by-slice with browser verification between slices** (same cadence as Phase 4's 4a–4d).

---

## PM brief — what changes for the tournament coach

Today a tournament coach lands on a thin, static record: a status word, a details list, and a schedule that just says "Home/Away" with no opponent. Coaches whose teams were **added by the organizer or imported via CSV often see nothing** — an empty portal or a not-found page — because the portal only shows registrations they linked themselves.

After Phase 5, the tournament experience comes alive on the **same shared foundation** as the free Basic team home:

- **A phase-aware Team HQ hero** that changes with the tournament's life stage — a checklist while pending/prepping, a "first game in 2 days" countdown once accepted, opponent names + tappable links to the public game page when the schedule is live, a live scoreboard on game day, and a celebration + a single well-timed "want more?" invitation **only after** the event.
- **Payment & check-in at a glance** — Paid / Owes (with how to pay and who to contact) and check-in status, all **read-only** (the organizer still records payment manually; there is never a "pay now" button).
- **Claim your team by email** — imported/admin-added coaches find and claim their registration just by signing in with the matching email; coach emails carry a persistent "see your team in the portal →" link that doubles as the claim.
- **Assign the head coach + contact per tournament** — so acceptance and notifications route to the actual coach, not whoever filled out the form.
- **Submit a roster for the event** — pick players from the master roster, fill in only what *this* organizer requires (e.g. birthdates / jerseys), submit; the organizer confirms at check-in. **Critical:** organizer requirements apply **only to the event submission** — they never force extra data onto the coach's permanent free master roster (which stays identity-only).

**Organizer (new):** in Event Settings, toggle per-tournament roster requirements (require roster? DOB? jersey? waiver? min/max). Those choices drive and hide exactly what the coach is asked for — no over-collecting.

**Role differences:** organizers author requirements and remain the only ones who record payment/check-in; coaches see their own status and submit their roster + head-coach assignment; the registrant controls who is assigned. Free stays free; every "beyond free" nudge is **express-interest, not a purchase**, and appears **exactly once, after the event** — never as pre-event pressure.

---

## ⚠ Deploy-time prerequisite (caught by the critic — do NOT skip)

The C-snapshot source table **`basic_coach_team_players` (+ events/fees/announcements) is dev-only** — migrations **114–117 are ABSENT in prod** (verified against `schema-dump-columns-prod.json`). `tournament_roster_players` exists in prod, but the master it copies *from* does not. **Before any Phase-5 prod deploy:** apply 114–117 with `node scripts/apply-migration-api.mjs <file> --prod` and confirm `npm run check:migrations` passes. The `/release` agent already gates master/promote on this drift check. This branch currently deploys as a unit, so the risk is low — but it is a hard gate, not optional.

---

## Build tracks (two independent streams + groundwork)

- **Groundwork (serial, first):** 5·0 → 5a → 5b
- **Claim/email track (parallel):** 5c → 5e → 5d  *(hard prerequisite for any WRITE on admin-created/imported teams: 5j, 5l)*
- **Hero/roster track (serial):** 5f, 5g → 5h → 5i → 5j → 5k
- **Then:** 5l (head-coach) → 5m (afterglow + reminder) → 5n (email preferences + master off-switch)

**Recommended order:** `5·0 → 5a → 5b → 5c → 5e → 5d → 5f → 5g → 5h → 5i → 5j → 5k → 5l → 5m → 5n`

---

## Slices

### 5·0 — Pressure-ladder cleanup (pulled EARLY per critic) · low · ✅ BUILT 2026-06-09 (lint clean; awaiting browser verification)
**Goal:** remove the always-on pre-event Premium CTAs so no incremental deploy ever violates pitch-free. The afterglow *ask* is added later in 5m; this slice only **removes**.
**Built:** removed the detail-page `ctaSection` (Premium "Take your team further" + "Run your own tournament") and the list-page `CtaCards` (both the empty-state and bottom positions) + the now-dead `hasPremiumAccess`/`getUserAccessContexts` plumbing in both files; left a comment pointing to the 5m afterglow ask. No shared modules / no new files → no dev restart. `lint:focused` clean.
- Detail page Premium CTA (`app/coaches/tournaments/[teamId]/page.tsx` ~L272); list 2-card CtaCards grid (`app/coaches/tournaments/page.tsx` ~L250–273).
- **Why early:** the critic flagged that shipping 5b/5h/5i before 5m leaves these live on pre-event surfaces. Decoupling removes the rule violation from slice one.
- **Verify:** pre-event coach surfaces show no Premium pitch; no dead imports left.

### 5a — Shared status + fee-resolver foundation (data plumbing, no UI) · medium
**Goal:** the read foundation everything consumes.
- Widen the coach tournament SELECTs to carry `payment_status, payment_collected_at, check_in_status, checked_in_at, roster_submitted_at, roster_confirmed_at` (+ tournament `settings`/fee columns) — `app/coaches/tournaments/[teamId]/page.tsx`, `lib/basic-coach-teams.ts` (`getBasicCoachTournamentTeamsForUser`, `getBasicCoachTournamentHistoryForTeam`, the registration mapper).
- New `lib/coaches-status.ts` — consolidate the 3 duplicated `STATUS_*` maps. **⚠ fix:** the three are NOT identical (detail has full-sentence `STATUS_DESC`; others are label/badge only) — preserve all three shapes.
- New `lib/fee-schedule.ts` — promote the register page's `resolveFeeSchedule` + `getRegistrationAttentionFee` into one resolver; repoint `lib/registration-attention.ts` + the register page.
- **⚠ fix:** `payment_status` is NOT NULL on dev but NULLABLE on prod, and `lib/db.ts` coerces missing→`'paid'` while the gate coerces→`'pending'`. The mapper must coerce NULL→`'pending'` to match the gate (else a never-paid team reads as Paid).
- **Verify:** `npm run typecheck`; register page fee/deposit/due unchanged; coach detail renders unchanged with the new columns in the SSR payload.

### 5b — Generalized status block on the coach record (B) · medium
**Goal:** show the coach their payment + check-in + roster *status*, read-only, no pay button.
- New `lib/coach-status-model.ts` (normalizes organizer-row OR coach-ledger into one view-model with an `editable` discriminator); new `components/coaches/TournamentStatusBlock.tsx`; mount on detail; compact payment chip on history rows.
- Reuse `computeRegistrationAttentionPaymentStatus` (organizer branch), `FeeEditor` totals (coach branch), `CheckInBoard` STATUS_META labels, register `PaymentPanel` copy.
- **⚠ fix (critic):** keep 5b **read-only status display only** — do NOT render any requirement-driven roster/DOB/jersey checklist row here (that's owned by 5h/5k after 5f exists). Otherwise it would prompt "submit roster" even when the organizer set require_roster=false.
- **⚠ fix:** gate the check-in line to **on/after game day** (default `not_arrived` would otherwise read as a problem all season). [open Q: confirm]
- **Verify:** linked accepted reg shows Fee (Owed+due / Paid date) + game-day check-in; no pay button; NULL-payment (prod-shape) reads pending.

### 5c — Claim-by-email discovery + registrationId-in-links (the GAP) · medium
**Goal:** close the empty-portal gap; make `/coaches/join` work without a registrationId; append registrationId to coach join links.
- New `getClaimableRegistrationsForUser(userId,email)` (exact-normalized `teams.email` match, anti-joined against `basic_coach_team_registrations`); add email-match fallback to `canUserAccessTournamentRegistration` + `getBasicCoachTournamentTeamsForUser` + `buildTournamentRegistrationContext`.
- `/coaches/join` claim-mode (list discovered regs / handle the N>1 multi-team case); `GET /api/coaches/basic-teams` returns the claimable list; append `registrationId` to resend-access + register-confirmation + access-reminder links.
- Reuse `linkTournamentRegistrationToBasicCoachTeam` (verbatim — ownership + exact-email + idempotent) + `getPendingTournamentRegistrationForUser`.
- **⚠ fix (critic):** delivers near-zero value before 5d (the empty-`teams.email` cohort) — verify 5c with a team that *has* an email. `UNIQUE(tournament_team_id)` means first-claim-wins when two accounts share an email string → must be a clear UX state, not a 500.
- **Security:** [open Q] explicit user-initiated **Claim** vs silent auto-link, given email verification is deferred to Phase 8. Exact normalized equality (not ILIKE); claim is read+link only (no payment).
- **Verify:** admin team with `teams.email` = test coach email → coach signs in → `/coaches/join` lists + claims it → detail reachable; empty-email team does NOT appear.

### 5d — Seed teams.email on admin add/import + claim-email send (linchpin) · medium · depends 5c, 5e
**Goal:** make the claim path reliable end-to-end.
- Seed/require `teams.email` on admin Add-Teams even when notifyTeam is off (`app/api/admin/teams/route.ts`); optional "send portal access link" per imported team in the importer commit; treat the Email column as expected.
- Reuse the existing notifyTeam toggle + `coachPortalFooter()` (from 5e) + `getOrgOwnerEmail` fallback.
- **[open Q]** importer/Add-Teams claim email = **opt-in toggle (default off)** vs automatic. Recommend opt-in (a big CSV could surprise-blast hundreds).
- **Verify:** CSV w/ Email + opt-in → each coach gets a claim email landing on `/coaches/join` pre-selected; Add-Teams w/ email = claimable even with notify off.

### 5e — Shared coach-email footer CTA + status-email polish · medium
**Goal:** one shared coach-email footer ("see your team in the portal →" carrying registrationId), enrich acceptance, add a rejection soft bridge, fix the voice nit.
- New `coachPortalFooter({registrationId,email,next})` appended **inside coach-facing template content only — NEVER in the shared `wrap()`** (wrap is shared with org/billing/founding/auth/league/rep). Enrich `acceptanceHtml` with fee+due; soft express-interest bridge in `rejectionHtml`; remove "on the diamond" from `paymentConfirmationHtml`.
- **⚠ fix:** the accept/reject/payment trigger is **duplicated across 3 files** (`api/registrations/[id]`, `.../registrations/bulk`, `api/admin/teams`) — every template-arg change must land in all three.
- **Copy owned by `/marketing`** — this slice defines the slots; coordinate exact words.
- **Verify:** trigger accept/reject/payment from all 3 admin paths; every coach email carries the footer; acceptance shows fee+due; rejection shows the bridge; click footer → claimable `/coaches/join`.

### 5f — Organizer roster requirements in settings JSONB (authoring only) · medium
**Goal:** organizers author per-tournament requirements; no migration.
- Flat keys in `lib/types.ts` TournamentSettings: `roster_require, roster_require_dob, roster_require_jersey, roster_require_waiver, roster_min_players, roster_max_players`.
- "Roster Requirements" CollapsibleCard in Event Settings (segmented On/Off + min/max number inputs); whitelist in `ALLOWED_SETTINGS_KEYS` + sanitizers in `app/api/admin/tournaments/route.ts`.
- **⚠ fix (critic):** the patch-settings merge has a **silent fall-through** (`sanitized[k]=v`) that persists any whitelisted key with no type check — each of the 6 keys needs an explicit sanitizer branch (bool for flags; `Number.isInteger`+range+null-clear for min/max) **before** the fall-through.
- **Defaults MUST be all-OFF** (legacy tournaments unaffected; do NOT copy the scope keys' "null blocks activation" semantics). Update `DATA_DICTIONARY.md` same unit of work (`check:dictionary`).
- **[open Q]** flat keys vs nested object. Recommend flat (per-division override is deferred).
- **Verify:** toggle + min/max, save, reload → persists; `typecheck` + `check:dictionary`; legacy tournament reads all-OFF.

### 5g — Extract shared Team-HQ shell, standalone mode (D, zero behavior change) · low
**Goal:** lift the verified Phase-4 `hqStrip` into one shared source-agnostic `TeamHQ` component; swap the standalone page to it with pixel/token parity. De-risks the no-regression rule before any tournament wiring.
- New `components/coaches/TeamHQ.tsx` (discriminated-union props; `standalone` variant = the exact 5-item strip); consume on `app/coaches/team/[basicTeamId]/page.tsx` (counts passed as props).
- **⚠ fix (critic):** re-run the pixel-diff no-regression check **again after 5h/5i** (they mutate the same shared component).
- **Verify:** standalone strip pixel-identical (5-col → 2-col 701–1120px → 1-col), correct counts, shipped tokens, no console errors.

### 5h — Phase-adaptive tournament hero: Pending / Accepted-Prep (D static) · medium · depends 5a,5b,5g
**Goal:** render `TeamHQ` in `tournament` mode; derive Pending / Accepted-Prep from `teams.status` + `schedule_visibility` + dates; checklist HUD wired to 5a columns; replace the static status card. No live polling, no public links yet.
- Add `tournament` mode + phase derivation; mount on detail (copy the server-side in-progress derivation from `[orgSlug]/[tournamentSlug]/layout.tsx`, don't import the client follow module). Reuse `Countdown`, `lib/team-color`.
- **⚠ HONESTY fix:** pending/waitlist/rejected teams have NO public profile (`lib/public-tournament-data.ts` filters to accepted) — Pending renders **no Follow button, no public link**. Accepted-but-unpublished-division sits in Accepted-Prep, not Schedule-live.
- **Verify:** pending + accepted-unpublished regs show correct phase + checklist + Countdown, NO public links; old static card gone.

### 5i — Game-day bridge: opponent names, public deep links, live scorebug (D live) · high · depends 5h
**Goal:** opponent names + monograms, schedule rows → public game links, Schedule-live/Game-day/Result phases with Countdown + live scorebug, strictly-gated Follow/alerts(express-interest)/Install.
- Server-resolve opponent names (teams-by-tournament lookup); rows → `<Link>` to `/{orgSlug}/{tournamentSlug}/schedule/{gameId}`; live scorebug via `usePublicTournamentLive` + `RollingNumber`.
- Reuse `RollingNumber`, `Countdown`, `lib/follow` (same localStorage key as the public dock), `InstallAppPrompt`. **Do NOT mount `ScoreTicker`/`MyTeamDock`** (they need `OrgNavContext`/`useParams`/accepted-only payload — they'll fail in the coach shell).
- **⚠ fix (critic):** handle NULL `home_team_id`/`away_team_id` (TBD bracket games) → "Home/Away/TBD" fallback; opponent-name resolution must respect the honesty rule (resolve from the published schedule set). **Division-level** `schedule_visibility` (not just tournament-level) must gate the bridge.
- **Verify:** `/dev-test-org/live-demo` game day → live scorebug updates on poll without re-firing on unchanged scores; opponent names + game links; Follow stays in sync with the public dock; bridge absent for non-public teams.

### 5j — C-snapshot submit API (C) · high · depends 5c
**Goal:** first coach-side roster write — copy selected master players into `tournament_roster_players`, stamp `roster_submitted_at`.
- New `app/api/coaches/tournaments/[teamId]/roster/route.ts` (auth via a `canUserAccessTournamentRegistration` wrapper — **NOT** `requireBasicCoachTeamOwner`; the path param is a tournament `teams.id`, not a basic team id). Clone the gate's delete-then-insert with `source='coach'`; reject writes once `roster_confirmed_at` is set.
- Separate snapshot normalizer in `lib/basic-coach-roster.ts` that accepts position + tournament-required DOB/jersey overrides **and must NOT call `updateBasicCoachTeamPlayer`** (the seam).
- **⚠ fix (critic):** define the **post-gate-confirm coach state** (recommend: read-only view of the confirmed snapshot + "contact organizer to change"). Note `save_gate_roster` stamps both submitted+confirmed while `confirm_roster` stamps only confirmed — different lockout behavior. Build the normalizer with the override-field surface from the start so 5k doesn't re-touch the API.
- **[open Q]** add `tournament_roster_players.source_player_id` (tiny migration → provenance/idempotent re-submit) vs keep delete-then-insert (no migration). Recommend **add it** (dictionary deferred it to Phase 5; master built snapshot-compatible for this).
- **Verify:** linked accepted coach POST → rows with `source='coach'`, `roster_submitted_at` stamped, `roster_confirmed_at` untouched; re-submit replaces; post-confirm POST rejected; `typecheck`.

### 5k — C-snapshot select-from-master UI + requirements wiring · high · depends 5f,5j,5h
**Goal:** the coach roster-submit island (select-from-master, travel-roster friendly) that reads 5f requirements to drive+hide DOB/jersey/waiver + enforce min/max, writing per-snapshot overrides **without ever touching the master**.
- New `components/coaches/TournamentRosterSubmit.tsx` on the accepted block; pass `tournaments.settings` requirements; `TeamHQ` checklist reads requirements to render/hide the Roster row + flip on `roster_submitted_at`.
- Reuse `RosterEditor` editor + **its DOB consent gate (must fire for snapshot DOB too)**; `CheckInBoard` Submitted/Confirmed/None ladder (coach-worded).
- **⚠ CRITICAL SEAM:** "require DOB" prompts for the **snapshot copy only** — never writes back to `basic_coach_team_players`. The master editor must NOT read `tournaments.settings`; forbid the 5k UI from reusing the master roster save endpoint for any field. min/max enforced app-layer (API + inline).
- **[open Q]** "require waiver" = checkbox-at-submit acknowledgment (no storage, no migration) vs persisted. Recommend checkbox-only V1.
- **Verify:** DOB/jersey appear only when required; snapshot DOB written but `basic_coach_team_players` UNCHANGED; min/max blocks out-of-range; checklist Roster row flips on submit.

### 5l — Head-coach & contact assignment (Part 2) · medium · depends 5c
**Goal:** the registrant assigns/changes the team's head-coach name (+ optional coach contact email) per tournament; writes `teams.coach`.
- New `components/coaches/HeadCoachEditor.tsx` (RosterEditor mold) + `PATCH /api/coaches/tournaments/[teamId]/route.ts` (owner-gated via `canUserAccessTournamentRegistration`).
- **⚠ fix (critic):** `teams.coach` is **NOT NULL on prod** (nullable on dev) — the PATCH must never write null/`''`; coerce empty → existing value or registrant name, validate min-length 1.
- **[open Q]** contact email: **Option A** overwrite `teams.email` (no migration, but `teams.email` is ALSO the portal access/claim key → overwriting orphans the registrant's access) vs **Option B** new nullable `teams.coach_email` column (migration; recipient sites prefer `coach_email ?? email`). Recommend **Option B** (only clean way to separate "who runs the account" from "who coaches"). If B: this touches the same 3 accept/reject files as 5e — **sequence after 5e or batch the edits**.
- **[open Q]** does reassignment notify the organizer?
- **Verify:** edit head-coach name persists to admin registrations + email greetings; if B, coach email reroutes acceptance while registrant still reaches the portal; `typecheck` (+ `check:dictionary`/snapshot refresh if B).

### 5m — Afterglow earned-ask + game-day reminder email (E) · high · depends 5e,5i
**Goal:** the single earned ask + the game-day reminder. (CTA-removal already done in 5·0 — this slice only ADDS.)
- `TeamHQ` Result phase: two **express-interest** bridges (own-team → Coaches Portal; org → advocacy ask), gated to completed events; `SharePageButton` only when a public profile exists.
- Extend `tournamentResultsFinalizedHtml` to a true two-bridge afterglow + **reframe the checkout-flavored `/coaches/start?billing=annual` link to express-interest** (both in-portal and in the email — the email link is the more checkout-flavored one). New game-day reminder template.
- **⚠ fix (critic):** game-day reminder is **transactional** — route via `lib/email.ts sendEmail` (no opt-out, no marketing footer) OR if using `email-sender.ts` `scheduled_at`, pass `skipOptOutCheck=true` so the **organizer's marketing opt-out can't suppress** it; orgId = `tournament.org_id`.
- **[open Q]** reminder firing: **Resend `scheduled_at`** at publish time (zero infra; can't auto-re-target if game times change) vs a new pull endpoint + external scheduler (rep-teams precedent). Recommend Resend `scheduled_at` for V1.
- **Copy owned by `/marketing`.**
- **Verify:** completed event shows the two-bridge express-interest block; pre-event shows none; finalize results → extended email w/ express-interest link (not checkout); reminder fires with no marketing footer.

### 5n — Organizer automatic-email controls + master off-switch (NEW, owner-requested) · medium · depends 5e, 5m
**Goal (Q11 = SENDER / organizer, locked 2026-06-09):** the tournament admin controls which automatic coach-facing emails THEIR event sends — an individual off-toggle per email type plus a single "pause all automatic emails" master switch. Tournament-scoped, authored in Event Settings, **mirrors the 5f roster-requirements settings-JSONB pattern (no migration)**.
- **Emails gated (organizer→coach, automatic):** registration confirmation, acceptance, rejection, payment confirmation, schedule-published, **game-day reminder (5m)**, results-finalized/afterglow.
- **Storage:** flat keys in `tournaments.settings` JSONB (no migration) — `email_auto_pause_all` + per-type `email_auto_acceptance`/`_rejection`/`_payment`/`_schedule_published`/`_game_day_reminder`/`_results` (**default ON = current behavior**). Reuses the 5f `ALLOWED_SETTINGS_KEYS` + per-key boolean sanitizer machinery 1:1.
- **UI:** an "Automatic Emails" CollapsibleCard in Event Settings (per-type segmented On/Off + a master "Pause all automatic emails" toggle), reusing the 5f Event-Settings primitives + `notification-labels`-style labels/descriptions.
- **Gate:** a single helper `shouldSendAutomaticCoachEmail(tournamentSettings, type)` checked at each send site (the routes already have tournament context to read `tournaments.settings`); master pause short-circuits all. 5m's reminder + the 5e-touched sends consult it.
- **Master = all off:** the organizer is explicitly choosing to handle comms manually, so "pause all" suppresses every automatic coach email (individual toggles give granularity to keep e.g. acceptance on while muting reminders). **No transactional carve-out** — the organizer owns the consequence. *(Revisit only if a coach-missed-acceptance complaint surfaces.)*
- **NOT in scope:** recipient/coach-side per-user opt-out + no-account token opt-out (that was the "recipient" path, not chosen). The org-level CASL **marketing** unsubscribe (migration 099) stays independent of this transactional-email control.
- **Reuse:** the 5f settings-JSONB authoring chain, `notification-labels.ts` copy pattern, the Event Settings CollapsibleCard/segmented primitives.
- **Verify:** toggle a type off in Event Settings → that email no longer sends for that tournament; master pause suppresses all; defaults (no keys set) = every email still sends; `typecheck` + `check:dictionary` (new settings keys documented).

---

## Cross-cutting decisions (locked by the synthesis)

1. Build read/visibility foundation (5·0/5a/5b) before any hero/roster UI; extract the shared shell (5g) before any tournament hero variant (5h/5i).
2. Claim track (5c→5e→5d) is parallel but a **hard prerequisite for any coach-side WRITE on admin-created/imported teams** (5j, 5l) — `canUserAccessTournamentRegistration` returns null pre-claim, so for imported teams **every** Phase-5 surface (read AND write) is gated behind a completed claim. "Visibility works immediately" is true only for self-registered/already-linked teams.
3. The only two relational-schema decisions are isolated + gated on owner input: `tournament_roster_players.source_player_id` (5j) and `teams.coach_email` (5l). Everything else is settings-JSONB or pure UI.
4. Organizer requirements = flat settings keys for V1 (per-division override deferred → would justify a nested object).
5. Master/snapshot seam enforced structurally: only the C-snapshot copy reads `tournaments.settings`; the master editor never does; "require DOB" prompts only the snapshot row.
6. Pressure ladder is cross-cutting: pre-event stays pitch-free (5·0 removes the live CTAs first), the single earned ask is the afterglow (5m).
7. Reuse public primitives as clean drop-ins only (`RollingNumber`, `Countdown`, public `CountUp`, `usePublicTournamentLive`, `team-color`, `follow`, `InstallAppPrompt`, `SharePageButton`); never mount `ScoreTicker`/`MyTeamDock` in the coach shell.
8. Email footer goes in coach-template content, never `wrap()`; accept/reject/payment edits land in all 3 trigger files.

## Decisions

**Locked 2026-06-09 (owner via AskUserQuestion):**
- **Q1 — `tournament_roster_players.source_player_id`: ADD IT** (5j carries a small migration → provenance + idempotent re-submit + "N of M submitted" UX).
- **Q2 — coach contact email: NEW `teams.coach_email` column** (5l carries a migration; recipient sites prefer `coach_email ?? email`; `teams.email` stays the portal access/claim key).
- **Q3 — claim posture: EXPLICIT Claim click** (5c; no silent auto-link until Phase 8 email verification; exact normalized equality; claim = read+link only).
- **Q4 — game-day reminder: Resend `scheduled_at`** at publish time (5m; `cancelScheduledEmail` on withdrawal).
- **➕ NEW (owner-requested): automatic-email opt-out + master switch → new slice 5n.** Every automatic coach email gets an individual off-toggle plus a single "pause all automatic emails" master toggle (modeled on the per-user notification preferences). 5m's reminder + all 5e-touched coach emails are gated on it. **Control-owner = open (see below).**

**Owner's call still open:**
- **Q11 — who controls the 5n email toggles:** recipient (coach) vs organizer (sender) vs both. *(asking now)*

**Taking the recommended default unless you object:**
- Q5 coach fee display = **binary** Paid/Owes (parity with the organizer gate).
- Q6 importer/Add-Teams claim email = **opt-in** (default off).
- Q7 "require waiver" = **checkbox-only** V1 (no waiver storage exists).
- Q8 requirements keys = **flat** (per-division override deferred).
- Q9 check-in line = **gated to game day** (default `not_arrived` reads as a problem otherwise).
- Q10 reassignment (5l) = **does not notify** the organizer in V1.

## Critic's must-fix checklist (folded into the slices above)

- [ ] Deploy gate: migrations 114–117 to prod before Phase-5 prod deploy (`check:migrations`).
- [ ] 5a: coerce NULL `payment_status` → `pending` (prod-nullable; avoid false "Paid").
- [ ] 5l: never write null/`''` to `teams.coach` (prod NOT NULL).
- [ ] 5·0: remove pre-event CTAs first (no pitch-free violation window).
- [ ] 5b: read-only status only — no requirement-driven checklist before 5f.
- [ ] 5c: verify with a team that has `teams.email` (near-zero value before 5d).
- [ ] 5f: explicit per-key sanitizer branch before the silent fall-through.
- [ ] 5g: re-run the no-regression pixel diff after 5h/5i.
- [ ] 5i: NULL home/away → TBD; division-level visibility gates the bridge.
- [ ] 5j: define post-gate-confirm coach state; build normalizer with override fields.
- [ ] 5m: transactional reminder path (org marketing opt-out can't suppress).
