# Free Tier + Coaches Experience — Unified Execution Plan

**Status:** SCOPED 2026-06-08 · the single **execute-in-order** plan merging two projects · planning complete, build not started
**This is the canonical execution sequence.** The two source plans remain as **detail references** (deep specs, findings, design/marketing synthesis) — but the order you build in lives **here**:
- [FREE_TIER_STRATEGY_PLAN.md](FREE_TIER_STRATEGY_PLAN.md) — strategy; payments deferral (§9); opt-C coach line (§10); taxonomy / technical model / instrumentation / abuse controls (§11–§15).
- [FREE_TIER_STRATEGY_PM_BRIEF.md](FREE_TIER_STRATEGY_PM_BRIEF.md)
- [COACHES_EXPERIENCE_EVAL_PLAN.md](COACHES_EXPERIENCE_EVAL_PLAN.md) — coach-phase detail (stage-by-stage findings, design/marketing synthesis, architecture decisions, original Phases A–E).

---

## Why these are one plan (not two parallel projects)

Both projects touch the **same coach surface** — `app/coaches/*`, the `basic_coach_teams` model, the portal shell, the master roster, and `getUserAccessContexts`. They **cannot** run as independent simultaneous projects without colliding on those files. This plan sequences them along the correct seam: **build the shared coach foundation once, then layer the tournament-coach experience and the standalone variants on top.** Work that does **not** touch the coach surface (League Starter, account-first `/start`, caps, instrumentation, the Phase 0 copy/trust cleanup) is genuinely parallelizable and is flagged `[parallel]` below.

**Rule of thumb:** one stream owns the **coach surface** (Phases 1 → 3 → 4 → 5, in order); a second stream may run the **non-coach** phases (0, 2-partial, 6) concurrently.

---

## Locked decisions & constraints (do not re-litigate)

- **No payment processing anywhere in this rollout** — manual fee tracking only. Online collection, paid Premium go-live, and the Activation Trial are all **Future Rail** (see bottom). (FT §9)
- **opt-C free coach floor** (held against a narrower external proposal): free = team profile + multi-team + master roster (identity) + **basic schedule + basic comms** + manual fee ledger + standalone Team HQ. Premium keeps lineups / attendance / dues-automation / budget / documents / power-calendar. (FT §10)
- **League Starter = a free-floor *entitlement profile*, NOT a new `OrgPlan` key.** Caps enforced **server-side** (D6). (FT §12)
- **Activation Trial is OUT of the MVP.** Club is **consultative / demo only** until `plan_tier` grants exist.
- **Flip `team` (paid Premium standalone checkout) to live = deferred** until the team module is fully tested + Stripe. The free Basic floor does NOT need that flip (`team` = Premium ≠ Basic).
- **Pressure ladder:** in-portal pre-event surfaces stay pitch-free; one earned ask at the afterglow (tournament coach) / at the scope-ceiling (standalone coach). "Free to operate / funded by processing" is **end-state**, public-site only, and not used until Flow B is live.
- **Coach surface = one build stream.** Don't open two simultaneous chats editing `app/coaches/*`.
- Standalone Basic source value = `coach_created` (already valid in migration 091). Master-roster migration = the **next free number (≥114; NOT 112** — taken by `games.duration_minutes`).

## Cross-cutting dependencies

- **D1 — Account-first `/start`** front door (replaces "persona detection"); keep `/auth/signup` as the tournament deep link.
- **D2 — Existing-user add-workspace** (`/home` "start something new"; separate auth from workspace creation; don't reject existing emails).
- **D3 — Payments DEFERRED** (Flow B / Connect = future; Flow A / Stripe Phase G separate, bounded by Jan-2027). Not on the critical path.
- **D4 — Shared coach foundation** (the org-less route + master roster) — Phases 1 & 3 below.
- **D5 — Pressure ladder** (above).
- **D6 — Free-floor caps enforced server-side** (APIs, not React). House-league is module-gated today, not cap-gated — net-new for League Starter.

## Coach free/paid line (opt-C, locked)

| | Capability |
|---|---|
| **FREE — no-tournament floor** | org-less team profile · multi-team switcher · master roster (identity only — *not* attendance) · basic team schedule · basic team comms (email/notify to roster contacts) · coach-self-recorded manual fee ledger · standalone Team HQ home state |
| **FREE — tournament-participant only** | registration history/status · read-only organizer schedule · game-day bridge — *empty for a no-tournament coach; must not lead the standalone floor* |
| **PREMIUM ($29 / $19 in Club)** | lineups · power-calendar (recurring/export/multi-view) · attendance · dues automation · budget · documents · season-setup checklist · online collection |

---

# EXECUTION SEQUENCE — do these in order

### Phase 0 — Trust, copy & canonical-model cleanup `[parallel — no coach surface]`
**Goal:** the product says only true things; one canonical taxonomy.
**Depends on:** nothing — start anytime.
**Tasks:**
- README: add the free-floor layer over the four paid tiers (still "four bundled SaaS tiers" today).
- Fix residual trial copy: Tournament Plus annual "**14-day trial first**" (`components/PricingSection.tsx`) during the founding-season comp; superseded trial language in `docs/agents/brand/PRICING_PAGE_COPY.md`.
- Update the Timed Entitlements PM brief ("not started" → first slice built behind `ENTITLEMENT_GRANTS_ENABLED`).
- Fix the live **Premium-as-free over-promise** on coach surfaces (`app/coaches/page.tsx`, `teams/page.tsx`, `tournaments/[teamId]/page.tsx`, dashboard CtaCards) — stop advertising lineups/dues/budget/documents/power-calendar as free.
- Confirm/clean bracket copy (free = Manual, Plus = Generator — already largely honest); tier-aware account framing (signup subtitle already done).
- Add the canonical-taxonomy note (FT §11).
**Detail:** FT §5 Phase 0, §11.
**Exit:** no public page implies a non-live paid checkout; no "14-day trial" during the founding comp; no Premium-as-free copy; README/PM/Timed-Entitlements docs consistent.

### Phase 1 — Coach foundation: org-less team route + Phase A remediation `[coach surface — START of the single coach stream]`
**Goal:** a navigable home for a bare `basic_coach_team`, on a clean shell.
**Depends on:** nothing (the Phase A shell was built 2026-06-05; this completes + fixes it).
**Tasks:**
- **Decide the route URL/IA first** — lean: a distinct, identity-resolved team route (e.g. `/coaches/team/[basicTeamId]`), NOT the Premium `/coaches/teams` workspace list.
- Build the org-less team-profile route + extend `getUserAccessContexts` to resolve a bare `basic_coach_team` + nav/IA + an honest empty/landing state.
- **Remediation:** residual inline-style ghost tokens (`app/coaches/tournaments/page.tsx` L94/111/112, `[teamId]/page.tsx` L213/217/253 → `--text-secondary` / `--text-tertiary`, **not** `--text-muted`); still-live "when you register" empty-state copy (`coaches/page.tsx` L66, `tournaments/page.tsx` L113); `btn-primary` / `btn-sm` convention nits.
**Detail:** Coaches plan "Reconciliation" block + Phase A; FT §10, §12.
**Exit:** a coach can view a team that has no tournament; the portal renders clean (no ghost tokens, no registration-presupposing copy).

### Phase 2 — Account-first `/start` + existing-user add-workspace `[D1 + D2 — partly parallel to Phase 1]`
**Goal:** each persona starts from their job; existing users add floors without re-signup.
**Depends on:** the coach `/start/team` destination needs Phase 1's route; the rest is independent.
**Tasks:**
- `/start` front door that asks the job first; `/start/tournament`, `/start/league`, `/start/team` (or `/coaches/start-free`) create the right workspace/context.
- Keep `/auth/signup` as the tournament deep link (or behind `/start/tournament`).
- `/home` gains "Start something new"; **separate auth from workspace creation** so existing emails don't error.
- **Coach account name parity (carried from 2026-06-08 testing):** the coach account-creation step (`/coaches/join` + `/start/team`, via `/api/auth/coach-signup`) collects **only email+password today — no name**, so a coach's auth user has blank `user_metadata` while an org owner gets `first_name`/`last_name`/`full_name`/`display_name` (read by platform-admin support views + email greetings). Add **First/Last** to the coach account-creation form (matching `/auth/signup`), pre-filled by splitting the linked registration's `teams.coach`, and **write the same four `user_metadata` fields** so the coach→real-user transition (and Premium-workspace provisioning) inherits a real name. **Do NOT split the public register form's "Coach / Contact Name"** — it's a flexible *contact* field stored as the single widely-used `teams.coach`/`basic_coach_teams.primary_coach_name`; alignment belongs at account creation, not the public registration contact field. (Decision rationale logged 2026-06-08.)
**Detail:** FT §5 Phases 1–2, §12 existing-user checklist.
**Exit:** new tournament org / new coach (no org) / new league workspace all creatable; an existing user adds a second context without signing up again; `/home` shows all contexts + start-new; **a coach who creates an account has `first_name`/`last_name`/`full_name`/`display_name` on their auth user, matching an org owner.**

**BUILT 2026-06-08** (tsc + lint + token-guardrail clean; dev smoke 200 + correct redirects; **adversarial review folded in** — fixed: platform-admin guard on `POST /api/org/create`, coach-account-name fallback for standalone teams in `POST /api/coaches/teams` (avoids a nameless team that the register form can't select), and platform-admin guards on `/start` + `/start/{league,club}`; awaiting browser verification). Decisions settled in the PM summary: League/Club = **thin wrapper routes** `/start/{league,club}` embedding the existing `EarlyAccessModalTrigger` (NO floor/caps built — that's Phase 6 League / consultative Club); standalone coach create = a **new `/start/team` page**; single-context discoverability = **base-URL login lands on `/home`** (deep links with `next` skip it) **+ an "All workspaces" → `/home` link in the admin sidebar footer and the coaches shell**. Implementation:
- **`/start` front door** (`app/start/page.tsx` picker + `start.module.css`) → `/start/tournament` (signed-out → existing `/auth/signup`; signed-in → `AddOrgForm` → `POST /api/org/create`), `/start/team` (`StartTeamForm`: signed-out collects name+First/Last+email/pw → coach-signup→signIn→create; signed-in just names the team → `POST /api/coaches/teams`; 409 → `/auth/login?next=/start/team`), `/start/league` + `/start/club` (express-interest wrappers).
- **Separation of auth from workspace creation (D2):** new session-based `POST /api/org/create` (add a free `tournament` org for the logged-in user, mirrors signup incl. founding comp, never touches the auth layer → existing emails can't error) + `POST /api/coaches/teams` (standalone team via new exported **`createBasicCoachTeam`** in `lib/basic-coach-teams.ts`, `source='coach_created'`, org-less, `requireCoachUser`-gated). Both verified against the LIVE schema (NOT migration files).
- **`/home` (D1):** zero-context → `/start` (was `/auth/signup`); single-context **no longer auto-redirected** (renders the switcher so the affordance is reachable); added a "Start something new" → `/start` card. `lib/auth-destination.ts` single-context → `/home`, zero → `/start`.
- **Coach name parity:** `/api/auth/coach-signup` now **requires** First/Last and writes the same four `user_metadata` fields as org signup; `/coaches/join` + `/start/team` collect them; `/coaches/join` pre-fills (best-effort `splitFullName`) from a `?coach=` param passed through the register→join redirect. The public register "Coach / Contact Name" (`teams.coach`) is **untouched** (passthrough only). *Known gap (acceptable):* coaches created BEFORE this change keep blank metadata — not retro-backfilled here.
- **Signup-slug refinement (owner-approved follow-up):** dropped the "Public URL" field from signup + the add-org form — `generateUniqueOrgSlug()` auto-assigns it (read-only preview shown); both create APIs take an optional `orgSlug`. Edit-later surface follows a **refined separation rule** (modules hidden, *identity* editable per-workspace): Tournament tiers edit their org address in **Event Settings → "Organization Address"** (owner-only); League/Club in Org Settings. `/api/admin/org-settings` is now `?orgSlug=`-aware (multi-org-safe). See the [[feedback_tournament_org_separation]] refinement. Future: tournament-org co-admins (a tournament-scoped Members surface, not the org-admin shell).
- **Register-form registrant model (owner-directed follow-up — REVERSES "don't split Coach/Contact Name"):** the public register form now collects the **registrant = account user** (First/Last/Email, like logins) instead of a free "Coach / Contact Name". Logged-in coaches register as themselves (name prefilled+locked from `user_metadata`); logged-out seed their account. The **head coach is a separate, portal-assigned concept → Part 2 = Phase 5.** `teams.coach` is unchanged storage — now holds the combined registrant name as the team's *default* head coach (no migration; all readers work). `/api/coaches/basic-teams` GET returns the account name for prefill. Part 1 BUILT 2026-06-08 (tsc+lint clean).
- **Registration ⇄ account MERGED (owner-directed 2026-06-08; BUILT, tsc+lint clean):** registering a team now **creates the coach's Coaches Portal account in the same step** — logged-out registrants add a **password** (name+email already collected); logged-in coaches add nothing. The merged submit creates the account (`/api/auth/coach-signup`) → signs in → `POST /api/register` (which **auto-links** the registration because the session email now matches) → lands in the portal ("Open Coaches Portal"). **Returning email = the password is treated as sign-in** (409 → `signIn`), no separate step. `/coaches/join` stays as the email-link/claim fallback (welcome/resend-access/bulk-imported teams). Rationale (owner): the second step only added a password; "access your portal" > "create a portal", and an account is required once payments exist. **Email verification DEFERRED but committed → Phase 8 (unified, platform-wide).**

### Phase 3 — Coach master roster `[coach surface]` *(Coaches Phase C — master half)*
**Goal:** the substance of the free coach floor — a reusable roster.
**Depends on:** Phase 1 (the org-less route to host the editor).
**Tasks:**
- `basic_coach_team_players` (migration **≥114**), coach-scoped master-CRUD API, mobile-first roster editor on the org-less route.
- **Identity fields only** (name/jersey/contact, optional DOB) — NOT attendance.
- **Minor-DOB privacy/consent gate, in-phase** (DOB optional/purpose-driven; gate multi-user access).
**Detail:** Coaches plan Phase C; FT §10.
**Exit:** a coach builds/edits a roster on a no-tournament team; DOB optional + gated.

**BUILT 2026-06-09** (branch `feat/free-tier-coaches`, local only; tsc + lint + public-token + dictionary-coverage ratchets clean; awaiting browser verification). Decisions settled in the PM summary (both owner-approved): **DOB = consent-gated optional** (never a default field; behind an explicit "+ Add date of birth" opt-in; save blocked until a guardian-consent checkbox is ticked — UI-enforced, persisted consent audit deferred to Phase 8) and **optional parent/guardian contact included now** (powers Phase 4 comms). Implementation:
- **Table:** `basic_coach_team_players` (**migration 114** — confirmed next free number against migration files *and* the live dev DB per the schema-drift rule; applied to **dev only**, so `DRIFT_dev_vs_prod.md` correctly shows it dev-only until deploy). Identity only: `name` (single, NOT split — matches the snapshot target), `jersey_number` (text), `date_of_birth` (date, privacy-gated), `guardian_name`/`contact_email`/`contact_phone`, `notes`, `display_order`, `created_by_user_id` (bare uuid, mirrors `tournament_roster_players`). RLS-enabled, no policies (service-role only). **NO** attendance/lineups/positions columns (Premium). Column shape is snapshot-compatible with `tournament_roster_players` (mig 110) so the Phase-5 per-event submit is a clean copy; upgrade-ready via the existing `basic_coach_teams.team_workspace_id` bridge.
- **Server:** new `lib/basic-coach-roster.ts` (list/create/update/delete/reorder + a `normalizeBasicCoachTeamPlayerBody` whitelist that drops any non-identity field server-side — "roster fields scoped to Basic") and shared `lib/coach-team-guard.ts` `requireBasicCoachTeamOwner` (signed-in + reject platform-admin + `userOwnsBasicCoachTeam`; every mutation also `.eq('basic_coach_team_id')`-scoped against IDOR). Routes: `app/api/coaches/teams/[basicTeamId]/roster/route.ts` (GET/POST), `…/[playerId]/route.ts` (PATCH/DELETE), `…/reorder/route.ts` (POST). Next-16 async `params` throughout.
- **UI:** mobile-first `components/coaches/RosterEditor.tsx` client island (add/edit/remove + `@dnd-kit` drag-reorder, optimistic with revert; DOB + contact in collapsed-by-default optional panels) on the org-less team home `app/coaches/team/[basicTeamId]/page.tsx` — the roster section now **leads** the page and the "Master roster" coming-soon tile is removed. Pitch-free (no upsell — pressure ladder; the afterglow ask is Phase 5).
- **Dictionary:** `DATA_DICTIONARY.md` gains the `basic_coach_team_players` entry (sealed column-granular → 26 tables sealed); coverage baseline + memory schema reference refreshed.

### Phase 4 — Standalone Basic Coaches Portal floor (opt-C) `[coach surface — completes the free coach floor]`
**Goal:** coaches self-serve a real team home with no tournament.
**Depends on:** Phase 1 (spine) + Phase 2 (D1/D2) + Phase 3 (roster). *(The door can open thin after 1+2; the marketable floor needs 3 — built here.)*
**Tasks:**
- Standalone team creation (source `coach_created`, no org).
- **Basic team schedule** (add practices/games, parents see it — not the Premium power-calendar).
- **Basic team comms** (announce to parents; reuse Resend + notifications; parents are roster contacts, not accounts).
- Coach-self-recorded **manual fee ledger** (mark paid/unpaid against the roster).
- **Standalone no-event Team HQ** state (reuse Phase D's shell, NOT its tournament phase model).
- **Scope-ceiling earned-ask** = lineups/documents/budget/dues-automation ceiling → **express-interest** (Premium CTAs honest/gated, not checkouts).
- Standalone welcome + roster-reminder emails.
**Detail:** FT §5 Phase 3, §10; Coaches "Reconciliation."
**Exit:** a no-tournament coach creates a team, builds a roster, adds a schedule, messages parents, tracks fees; all Premium asks are express-interest.
**Status (built slice-by-slice, owner-paced, browser-verify between):**
- **Slice 4a — Basic team schedule — BUILT + BROWSER-VERIFIED 2026-06-09** (branch `feat/free-tier-coaches`, local only; tsc + lint + public-token + dictionary ratchets clean; snapshots refreshed; dev smoke = login 200 + events route 401 unauth). **Post-verify UX refinement:** the End field was promoted out of the optional panel; it auto-defaults to **start + 2h** (and tracks the start until hand-edited; existing events' ends are left alone), and the picker's `min` blocks selecting an end before the start — so the save-time end-before-start error is now only a backstop. **Table:** `basic_coach_team_events` (**migration 115**, applied **dev only** → `DRIFT_dev_vs_prod.md` correctly shows it dev-only): `event_type` practice|game|event (CHECK), `title`, free-text `opponent` (game-only — no FK; a Basic team only knows itself), `location`, `starts_at` (required, sort key), `ends_at` (CHECK `…_time_check`: null or ≥ starts_at), `notes`, `status` scheduled|cancelled (cancelled reserved for a future "notify parents it's off" flow), `created_by_user_id` (bare uuid). RLS-enabled/no-policies. **NO** scores/attendance/lineups/recurrence (Premium `rep_team_events`). **Server:** `lib/basic-coach-schedule.ts` (list/create/update/delete + `normalizeBasicCoachTeamEventBody` — datetime + end-before-start + length validation; opponent server-cleared on non-game in create AND update) reusing `requireBasicCoachTeamOwner`; every mutation `.eq('basic_coach_team_id')`-scoped (IDOR). Routes `…/events/route.ts` (GET/POST) + `…/events/[eventId]/route.ts` (PATCH/DELETE). **UI:** mobile-first `components/coaches/ScheduleEditor.tsx` (soonest-first, segmented type, collapsed optional end/location/opponent[game-only]/note panel, optimistic add/edit/remove) on the team home between Roster and Tournament history; the "Team schedule" coming-soon tile is removed. **Adversarial review** (1 focused verifier): no IDOR/timezone/blocker bugs; fixed 2 MEDIUM (end-before-start PATCH bypass → DB CHECK; stale opponent on game→practice via direct PATCH → lib clear) + 1 LOW (multi-day end-date display in `formatWhen`). **Dictionary:** `basic_coach_team_events` documented + sealed → **27 tables**.
- **Slice 4b — manual fee ledger — BUILT + BROWSER-VERIFIED 2026-06-09** (branch `feat/free-tier-coaches`, local only). **Table:** `basic_coach_team_fees` (**migration 116**, applied **dev only** → `DRIFT_dev_vs_prod.md` shows it dev-only): `basic_coach_team_id` FK cascade, nullable `player_id` → `basic_coach_team_players(id) ON DELETE SET NULL` (team-wide/unassigned charges + player-delete history retention), `label`, `amount numeric(10,2)` (repo money convention: tournament/league/accounting/rep-dues store dollar numerics, not cents), binary `status` unpaid|paid, `marked_paid_at` stamped/cleared by the manual toggle with DB CHECK consistency, `notes`, `display_order`, bare `created_by_user_id`. RLS-enabled/no-policies. **NO** Stripe/payment processing/online collection/partials/installments/dues automation/accounting integration. **Server:** `lib/basic-coach-fees.ts` (list/create/update/delete + `normalizeBasicCoachTeamFeeBody` whitelist, decimal validation, length caps, same-team `player_id` validation so a coach cannot link another team's player) reusing `requireBasicCoachTeamOwner`; every mutation `.eq('basic_coach_team_id')`-scoped (IDOR). Routes `…/fees/route.ts` (GET/POST) + `…/fees/[feeId]/route.ts` (PATCH/DELETE). **UI:** mobile-first `components/coaches/FeeEditor.tsx` (roster-centric owed/paid/unpaid totals, per-player rows, team-wide charges, optimistic add/edit/toggle/remove + revert) on the team home after Schedule; the "Fee tracking" coming-soon tile and `Wallet` import are removed. **Dictionary:** `basic_coach_team_fees` documented + sealed.
- **Slice 4c — basic team comms — BUILT + BROWSER-VERIFIED 2026-06-09** (branch `feat/free-tier-coaches`, local only). **Table:** `basic_coach_team_announcements` (**migration 117**, applied **dev only** → `DRIFT_dev_vs_prod.md` shows it dev-only): `basic_coach_team_id` FK cascade, `subject`, `body`, `recipient_count`, `sent_count`, `failed_count`, `status` sent|partial|failed, `sent_at`, bare `created_by_user_id`, timestamps. RLS-enabled/no-policies. **NO** parent accounts/chat/replies inbox/read receipts/SMS/push/payment reminders/dues automation/Premium pitch. **Server:** `lib/basic-coach-announcements.ts` (recent log + recipient summary + `normalizeBasicCoachTeamAnnouncementBody` whitelist + send/log flow) reusing `requireBasicCoachTeamOwner`; recipients are recomputed from the owned team's `basic_coach_team_players.contact_email` values, normalized/basic-validity checked/deduped, and never accepted from the request body. Route `…/announcements/route.ts` (GET/POST). **UI:** mobile-first `components/coaches/AnnouncementEditor.tsx` (recipient counts, subject/message compose, send state, recent log) on the team home after Fees; the "Team messaging" coming-soon tile/section is removed. **Dictionary:** `basic_coach_team_announcements` documented + sealed.
- **Slice 4d — Team HQ stat strip + scope-ceiling express-interest + standalone welcome email — BUILT 2026-06-09, AWAITING BROWSER VERIFICATION** (branch `feat/free-tier-coaches`, local only; no migration). **Team HQ:** the standalone team home now has a compact owner-gated stat strip for roster count, next non-cancelled future event (browser-local timestamp), unpaid manual fees, announcement-ready contacts, and tournament history. **Scope ceiling:** `components/coaches/ScopeCeilingInterest.tsx` posts to the owner-gated `…/interest` route, which records selected beyond-Basic interests in existing `early_access_leads` (`team`, `coach_portal`, and structured team-tool feature tags) without checkout, Stripe, Premium unlocks, entitlement mutation, or silent release-email opt-in. **Welcome:** standalone Basic team creation sends a best-effort “team home is ready” email; skipped/provider-error email sends do not block team creation.

### Phase 5 — Tournament coach experience `[coach surface — layers on the foundation]` *(Coaches Phases B, D, E + C-snapshot)*
**Goal:** the tournament-participant coach gets the full game-day experience, reusing the shared foundation.
**Depends on:** Phase 1 (shell/route) + Phase 3 (master roster to snapshot from). *(Parallelizable with Phase 6 — different surface, but same coach stream.)*
**Review cadence (decided 2026-06-09):** a holistic design/UX review of the **standalone floor** (Phases 1–4 — the org-less team home, its first-run/empty state, IA, and the 4d stat strip composition) is **DEFERRED** — not run before Phase 5. The standalone slices each had per-slice adversarial *code* review + were built to convention, but the assembled experience was never design-reviewed as one whole. Decision: fold it into a **combined coach-surface design/UX pass AFTER Phase 5**, reviewing standalone + tournament together on the shared shell rather than reviewing the standalone half twice. (Owner-directed via AskUserQuestion.)
**Tasks:**
- **B:** payment/status visibility, with a **generalized status component** (organizer- OR coach-authored source).
- **Coach claim for admin-created / imported teams (GAP found 2026-06-09):** today the portal only surfaces EXPLICITLY-linked registrations (`basic_coach_team_registrations`), and an explicit link requires a flow carrying a `registrationId`. The self-register flow links fine, but **Add Teams + the bulk importer create `teams` rows with no claim path** (importer sends no email; the add-team notify + `resend-access` `/coaches/join` links carry NO `registrationId`; the email-match fallback was removed in mig 092). So admin-added/imported coaches can make an account but land on an empty portal. **Fix: claim-by-email-match** — when a coach signs in/up, surface + let them claim (or auto-link, with ownership + the Phase-8 email-verification guard) any registrations where `teams.email` matches their account email (the only approach that scales to bulk imports — no per-team links). Complementary: add `registrationId` to the resend-access/add-team `/coaches/join` links. Linchpin: `teams.email` must be set on admin-add/import.
- **Coach-email portal footer (owner idea 2026-06-09):** add a persistent footer CTA to every coach-facing email — "See your team's schedule, status & updates in your Coaches Portal →" — linking to `/coaches/join?registrationId=<id>&email=<email>&next=/coaches/tournaments`. Carrying the `registrationId` makes it a CLAIM link: coaches WITH access sign in and see their team; coaches WITHOUT (incl. Add-Teams/accept-email coaches) create an account and the registration links automatically. This + claim-by-email-match (for the no-email importer case) closes the admin-created-team gap. Impl: a shared coach-email footer in `lib/email.ts` (the `wrap()` is generic across ALL emails — add a coach-specific footer, don't put a portal link on org/founding/admin emails); most coach templates already carry `registrationId`. Coordinate copy/voice with `/marketing` (email copy canon); architecture ref = `memory/project_email_stack.md`.
- **Head coach / contact assignment (Part 2 of the register-form registrant model, owner-directed 2026-06-08):** registration now only captures the **registrant** (account user); this is where the account user **assigns/changes the team's head coach + contact per tournament** in the coaches-portal tournament record — writes `teams.coach` (currently defaulted to the registrant), optionally a coach email so acceptance/notifications route to the coach. Separates "who runs the account" from "who coaches the team."
- **C-snapshot:** submit/select master players into per-event `tournament_roster_players`; the gate becomes a confirm.
- **Organizer roster requirements (NEW — scoped 2026-06-09, owner-approved tournament-level for V1):** a **tournament-level** requirements set stored in the tournament **settings JSONB** (no migration — mirrors the existing fee/timing/tie-breaker scope pattern), authored in **Event Settings**: `require roster? · require DOB? · require jersey? · require waiver? · min/max players`. Both the coach-side **Team-HQ checklist** (D) and the **C-snapshot submit form** *read* it, exactly like the admin draft checklist: roster not required → **no Roster checklist item, no submit step**; DOB not required → DOB **stays optional/hidden** in the submit form; jersey/waiver/min-max gate submission validation + the gate confirm. **Critical seam — these requirements apply ONLY at the per-event submission, never to the free master roster:** `basic_coach_team_players` (Phase 3) stays **identity-only + DOB optional/consent-gated always**, so "require DOB" prompts the coach to fill it *for that tournament's snapshot* (consent gate still firing) and never forces DOB onto the persistent master. **Settles the "roster required vs optional" open question** (Coaches plan L380-382) at tournament level; **per-division override deferred** (would follow the Divisions-UX inheritance model). Reuse the gate's existing `roster_submitted_at`/`roster_confirmed_at`.
- **D:** phase-adaptive tournament Team HQ hero + game-day bridge; **extract the shared shell** (the Phase 4 standalone hero reuses it).
- **E:** afterglow earned-ask (two bridges; "$19/$29 carries over" → **express-interest** until Premium go-live); rejection soft bridge; game-day reminder email.
**Detail:** Coaches plan Phases B/C/D/E + stage findings + design/marketing synthesis.
**Exit:** a tournament coach sees fees/check-in/roster status, submits a roster, gets the phase-adaptive Team HQ + game-day bridge + afterglow.

### Phase 6 — Free-floor caps + League Starter beta `[parallel with Phase 5 — house-league surface]`
**Goal:** a small house-league admin runs one real season free, with server-enforced caps.
**Depends on:** D1 (`/start/league`); D6 caps (built here). Independent of the coach surface.
**Tasks:**
- Free-floor **entitlement profile** + server-side cap helpers (compute effective entitlements from paid plan + add-ons + grants + free-floor).
- Enforce caps in the **APIs** (not React): block 2nd active season / 2nd division / >8 teams (incl. bulk); generator scoped to the included season/division; narrow public page only; block exports.
- League Starter creation flow (reuse the league onboarding wizard); 1 season / ~8 teams / 1 division + auto-schedule + standings; **one narrow public schedule/standings/registration page** (no full org site); manual fee tracking.
- Cap-hit upgrade-aware screens; ship as a **capped beta** from a controlled page.
**Detail:** FT §5 Phase 4, §12 cap checklist.
**Exit:** a small league admin generates a usable season + shares a public page; caps hold server-side; the paid League boundary is credible.

### Phase 7 — Instrumentation across floors `[gate before marketing]`
**Goal:** measure activation, not account creation.
**Depends on:** the floors exist (Phases 1–6). Best woven in as each floor is built; verified here.
**Tasks:** wire the §13 event spec (`signup_persona_selected`, `free_floor_created`, `first_value_reached`, `scope_wall_hit`, `upgrade_intent_clicked`, `coach_team_created`, `league_schedule_generated`, `tournament_published`, …) + implement the first-value definitions.
**Detail:** FT §13.
**Exit:** first-value + cap-hit events fire for every floor.

### Phase 8 — Support & abuse controls
**Goal:** operational safety for free floors.
**Depends on:** floors exist.
**Tasks:** rate-limit workspace creation per user/email/domain/IP; **unified email verification across ALL account creation** (owner-directed 2026-06-08 — same posture for org owners, coaches, AND the merged register-account flow; today org signup verifies in prod via `REQUIRE_SIGNUP_EMAIL_VERIFICATION`/`generateLink` but coach-signup uses `email_confirm:true` with NO verification — close that gap so a public form can't create a confirmed account for someone else's email; updates the merged register UX to a "verify your email, then access your portal" state when verification is on); **post-register landing + portal reachability (owner-directed 2026-06-08, bundle here):** after registering, land the coach in their Coaches Portal (with verification = "verify → portal"; without = straight in) AND ensure the portal stays reachable so clicking a secondary success-screen link (Schedule/Rules/Home) never strands them — likely a session-aware "Coaches Portal" link in the public tournament nav (desktop rail + mobile), which also helps returning coaches browsing public pages. Interim today: the success screen's primary "Open Coaches Portal" button is the (adequate) safety net. Require email verification before any public publishing; define dormant-free-workspace retention; duplicate-detection prompts; admin visibility for free-floor creation + cap hits; keep sensitive roster fields minimal.
**Detail:** FT §14.
**Exit:** controls live; dormant-retention policy defined.

### Phase 9 — Marketing flip by floor `[last — gated on Phase 7]`
**Goal:** public pages advertise only live, instrumented free starts.
**Depends on:** Phases 0 + 1–6 (floors live) + Phase 7 (instrumentation).
**Tasks:** flip Tournament CTAs first → Coaches after Basic is live → League after the beta is stable; Club stays consultative; every "coming soon" maps to express-interest/contact; no future-payment claims.
**Detail:** FT §5 Phase 8, §15.
**Exit:** every "start free" CTA maps to a working flow.

---

## Future Rail — deferred, NOT part of this MVP

- **Premium Coaches Portal paid go-live** — flip `team` live, after full team-module testing + Stripe.
- **Stripe Phase G subscription cutover** — bounded by the Jan-2027 founding conversion (tracked under Stripe Integration / Founding Season GTM).
- **Flow B payment processing (Connect)** — the "funded by processing" engine; settle fee-bearer + blended-rate first (FT §9).
- **Club Activation Trial** — needs the unbuilt `plan_tier` grant; until then Club is consultative/demo.

## Parallelization map (for staffing, if you run more than one stream)

- **Phase 0** — anytime, no deps, no coach surface.
- **Coach stream (one owner, serial):** Phase 1 → 3 → 4 → 5.
- **Phase 2** — mostly parallel to Phase 1; only the coach `/start/team` target waits on Phase 1.
- **Phase 6** — parallel to the coach stream once D1 exists (house-league surface, no collision).
- **Phases 7–8** — woven through; verified after the floors land.
- **Phase 9** — last; gated on Phase 7.

If you execute strictly top-to-bottom (0 → 9), the order is always safe; the `[parallel]` tags only matter if you staff more than one stream.

---

**Journey-audit input (J1, routed 2026-06-11):** J1-024 confirmed the deliberate Phase-2 state that marketing never links `/start` (every CTA → `/auth/signup`), so the persona picker is unreachable signed-out; no harm found beyond discoverability, and the Phase 9 marketing flip already owns the fix. (Evidence: docs/projects/active/journeys/JOURNEY_J1_TOURNAMENT_ORGANIZER.md)

**Journey-audit inputs (J2 rep head coach, routed 2026-06-13, Phase 4):** the full coach walk routes 10 Basic-weekly-loop + comms findings here (report = source of truth: docs/projects/active/journeys/JOURNEY_J2_REP_HEAD_COACH.md; 0 refuted). The theme: the free home is polished for a 2-player demo and strains for a real 14-player team.
- **Basic weekly loop (all from leg 4):** **J2-016 (High)** roster is single-add-only — 14 open/type/save cycles with the list locked each time, no paste/CSV/"add & keep open"; the slowest moment is onboarding, exactly where the floor must win. **J2-017 (High)** the schedule is a flat *ascending* list, so by mid-season completed events pile at the top and the next event is buried below weeks of history (only the TeamHQ "Next" tile compensates) — split Upcoming/Past or default upcoming-first. **J2-022 (Med)** fees are single-add-only — one $75 charge across 14 kids is 14 forms; add "apply to every player" creating per-player unpaid rows. **J2-021 (Med)** the game Opponent field is hidden two interactions deep behind an "optional details" toggle, yet it's the defining attribute in the read view — surface it inline for game-type events. **J2-011 (Med)** the duplicate-email login round-trip drops the typed team name with no explanation — pass it via `next`/sessionStorage and rehydrate.
- **Parent comms (leg 4 + leg 5):** **J2-018 (High)** "Send announcement" fires an irreversible email to every parent instantly — no "send to 12 parents?" confirm, no recipient preview; add a confirm naming the count (expandable to addresses) + a "send a copy to me". **J2-020 (Med)** the "Skipped: N" stat names a problem (typo'd guardian emails) with no way to learn *which* players — list the names. **J2-026 (Med)** the announcement email is anonymous with no reply-to (replies hit the platform no-reply) — set reply-to to the coach's email + render "From {coach name}".
- **Assignment lifecycle:** **J2-025 (High)** assigning a coach to a rep team (the gateway to the entire Premium portal) sends **no email and no notification** — the inverse of the free floor's welcome email; `notify()` supports explicit `userIds` and could reach the org-member coach cheaply. Pair this onboarding silence with the J4-035 offboarding cliff into one assignment-lifecycle comms pass. **J2-010 (High, already-committed)** coach signup skips email verification while org signup requires it — already locked to Phase 8 (unified, platform-wide).
