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

### Phase 5 — Tournament coach experience `[coach surface — layers on the foundation]` *(Coaches Phases B, D, E + C-snapshot)*
**Goal:** the tournament-participant coach gets the full game-day experience, reusing the shared foundation.
**Depends on:** Phase 1 (shell/route) + Phase 3 (master roster to snapshot from). *(Parallelizable with Phase 6 — different surface, but same coach stream.)*
**Tasks:**
- **B:** payment/status visibility, with a **generalized status component** (organizer- OR coach-authored source).
- **Head coach / contact assignment (Part 2 of the register-form registrant model, owner-directed 2026-06-08):** registration now only captures the **registrant** (account user); this is where the account user **assigns/changes the team's head coach + contact per tournament** in the coaches-portal tournament record — writes `teams.coach` (currently defaulted to the registrant), optionally a coach email so acceptance/notifications route to the coach. Separates "who runs the account" from "who coaches the team."
- **C-snapshot:** submit/select master players into per-event `tournament_roster_players`; the gate becomes a confirm.
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
