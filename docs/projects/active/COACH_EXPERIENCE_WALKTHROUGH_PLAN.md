# Coach Experience — Guided UX/Design Walkthrough Plan

**Status:** ACTIVE — kicked off 2026-06-15. Owner-driven, step-by-step. Owner executes the browser actions and gives feedback; agent receives feedback, gives recommendations/best-practices, and executes fixes (BUILD AS WE GO — owner confirmed) when the owner decides.

**Workflow (settled 2026-06-15):** Owner tests on **`dev.fieldlogichq.ca`** (real emails fire). When a change is needed, agent builds + verifies on **localhost**, owner pushes to the **`dev` branch** (Amplify deploy target — NOT the feature branch; cherry-pick coach commits onto `dev`), then owner continues the walkthrough on dev. Coach work has been landing on `dev` via cherry-pick.

**WHERE WE ARE (updated 2026-06-17):** Steps 1–3 DONE + browser-verified. **Step 6 (free-team management surfaces) walked DEEPLY out of order this session** and largely complete — Fees (full two-type/bulk redesign + in-app delete modal), Announcements (recipient clarity + roster email validation), per-page feature-education footer, and the real-logo/brand-continuity pass all shipped to `dev` + browser-verified; spun into [COACH_PORTAL_GROWTH_PLAN.md](COACH_PORTAL_GROWTH_PLAN.md). **NOW AT Step 4 (accepted portal) — STAGED 2026-06-17:** `toronto blue jays5` flipped to **accepted** in Battle of the Bats 2026 (U13); the tournament already has a fee schedule ($500 total · $100 deposit due Jun 19 · total due Jul 10) and the team has paid $0, so the coach record page renders the **accepted_prep** experience with a fee-owed strip. No schedule seeded / tournament left as draft (the coach phase keys off team-acceptance + division schedule-visibility, NOT tournament status — see lib/coach-tournament-phase.ts). **Known limitation to verify (Step 4 finding candidate):** the richer post-prep phases (`schedule_live` / `game_day` / `result`) currently render the SAME static accepted hero (5i/5m not built) — so publishing a schedule wouldn't change the coach view yet. Coach record page: `/coaches/tournaments/81b249be-dfb1-4460-9239-d7c6bd8aad57` (sign in as `b2cowan@outlook.com`). NOTE: `toronto blue jays5` is also pending in 3 parallel-QA-seeded tournaments (fan-qa, fan-qa-open, completed-demo) — its Tournaments list will show all 4.

**Shipped on `dev` so far:** (1) double-entry fix — `/coaches/join` signed-out-aware + email CTA; (2) land-in-portal + welcome banner + existing-team form collapse; (3) Review-screen redesign (label/value list + status banner + actions divider). Uncommitted-as-of-handoff items may exist on the local `dev` branch working tree — check `git status` first.

**Purpose:** Walk the full coach journey end-to-end as a real coach would, find friction/confusion/polish gaps, and decide+execute fixes inline. This is the **combined coach-surface design/UX pass** that the Free-Tier Coaches plan ([FREE_TIER_COACHES_UNIFIED_PLAN.md](FREE_TIER_COACHES_UNIFIED_PLAN.md) Phase 5 review cadence) deferred to "after Phase 5" — standalone floor + tournament coach reviewed together on the shared shell.

---

## Working agreement (how we run each step)

1. Agent sets up the stage for the step (seed/config/state) and tells the owner exactly what to do and what URL to hit.
2. **Owner executes the browser action** (coach side as `b2cowan@outlook.com`; organizer side as `owner@dev.local`). Owner gives feedback in plain language.
3. Agent responds with **recommendations + best practices** (UX/design/copy), referencing what's built vs. a gap. No code yet.
4. Owner decides. **Only then** does the agent execute the change.
5. Substantive code changes → offer `/review` per CLAUDE.md. Design questions → can pull in `/design`, `/marketing` (email copy), `/ux`.
6. Batch restart-required changes; restart the dev server once near a natural handoff (new files / shared-module / proxy / config edits) per AGENTS.md.

**Roles / accounts**
- **Coach (primary lens):** `b2cowan@outlook.com` — wiped to a clean slate 2026-06-15 (see "Test environment state").
- **Organizer (interaction partner):** `owner@dev.local` — owns `dev-test-org` (+ dev-tplus/league/club orgs); can approve registrations, set fees, publish schedules.

---

## Test environment state (set up 2026-06-15)

**Coach account cleanup — DONE (detach, don't destroy).** `b2cowan@outlook.com`:
- Auth user **deleted** (was id `37449df6…`). Account now does not exist → owner re-creates it fresh during Step 1/2.
- 2 `basic_coach_teams` (+ 2 players, 2 events, 1 fee, 1 registration link, 2 user links) **deleted**.
- 9 `teams` rows across dev-test-org tournaments **detached** (`email`/`coach_email` → NULL) but **kept** — they're wired into seeded games (denver bobcats etc.), so deleting them would corrupt seeded brackets/scores. They no longer belong to the account.
- 0 org memberships, 0 early-access leads (already clean).
- Verified: 0 teams/basic-teams reference the email; seeded denver-bobcats game integrity preserved.

**Walkthrough tournament:** reuse an existing **dev-test-org** active tournament owned by `owner@dev.local`. Candidates (all `active`, dev-test-org): `dev-tournament-2026` (Battle of the Bats 2026), `branded-light` (Crimson Cup), `branded-dark` (Purple Classic), `live-demo`, `bye-demo`. **Pick one with an open division at Step 1.** (Decision to confirm at Step 1 — leaning `dev-tournament-2026` as the "main" event; `branded-*` are theme-QA fixtures.)

**Known dev-config gaps to resolve before the relevant step:**
- ⚠️ **`RESEND_API_KEY` is empty in `.env.local`** → notification emails (Step 5) will **not send** as-is. Options before Step 5: (a) add a dev Resend key + verified from-address and watch the real inbox, or (b) instrument/log the rendered email HTML to inspect content/links without sending. **Decide at Step 5.**
- `NEXT_PUBLIC_PLAN_GATES=enforce` + `team` plan is `early_access` → Premium coach upgrade (Steps 7–8) is **express-interest, not self-serve Stripe checkout**. To actually walk the *premium feature surface* (Step 8), we'll provision a `team_workspace`/`team` context for the coach out-of-band (seed) OR temporarily flip gates (`dev_plan_gates=live` cookie / `NEXT_PUBLIC_PLAN_GATES=live`). **Decide at Step 7.**
- `LEAGUE_STARTER_BETA=true` locally (not relevant to the coach lens; noted for completeness).

---

## Architecture cheat-sheet (what's actually built — from 2026-06-15 code map)

Two coexisting portal systems share the `/coaches` entry point:

- **Basic / Tournament Coach Portal — `/coaches/*`** (org-less; `basic_coach_teams` model). Covers Steps 1–6.
  - Register: `/{orgSlug}/{tournamentSlug}/register` → `POST /api/register` (merged register **+ account creation** in one submit since 2026-06-08).
  - Account/claim: `/coaches/join` (+ legacy `/my/*` redirects).
  - Tournament record (all phases): `/coaches/tournaments/{teamId}` (`TeamHQ` component, phase-adaptive via `lib/coach-tournament-phase.ts`).
  - Standalone free team home: `/coaches/team/{basicTeamId}` (RosterEditor / ScheduleEditor / FeeEditor / AnnouncementEditor / TeamHQ stat strip / ScopeCeilingInterest).
  - Hub: `/coaches` (teams, tournaments, claim-by-email prompt, premium workspaces).
- **Premium Coaches Portal — `/{orgSlug}/coaches/*`** (`team` plan / `team_workspace`; org-member `coach` role + rep-team assignment). Covers Step 8. Fully built; checkout deferred (Future Rail).

Emails (`lib/email.ts`, Resend): registration confirmation, waitlist, acceptance, rejection, payment confirmation/reminder, schedule-published, game-day reminder, results-finalized, standalone welcome. All organizer-toggleable per-tournament (Event Settings → Notifications), master pause switch. `resolveCoachRecipient` = `coach_email ?? teams.email`.

---

## The 8 steps

> Each step: **Set up → Owner acts → Capture feedback → Recommend → Decide → Execute.** Findings get logged inline under the step. Fixes that are substantive get `/review`.

### Step 1 — Coach registers for a tournament
- **Setup:** confirm the target tournament + an open division; ensure registration page not hidden, org sub active. Owner signed-out (or fresh).
- **Owner acts:** go to `/{orgSlug}/{tournamentSlug}/register`, register a team as a brand-new coach using `b2cowan@outlook.com` (sets password in the merged flow).
- **Lens:** Is the form low-friction? Is it clear that registering also creates an account? Fee/availability/waitlist clarity. Mobile.
- **Known watch-items:** merged register+account UX; success screen "Open Coaches Portal" is the main path back to the portal (no public nav link yet — 5o/Phase 8 deferred).
- **Findings:** _(log here)_

### Step 2 — Registration → portal sign-up (low friction)
- **Setup:** none beyond Step 1's success screen.
- **Owner acts:** follow the success path into the portal (`/coaches/tournaments/{teamId}`). If logged out, exercise `/coaches/join` / claim path.
- **Lens:** How many steps from "submitted" to "I'm in my portal"? Any dead-ends? Name captured correctly (First/Last → `user_metadata`)?
- **Known watch-items:** no email verification yet (Phase 8); portal reachability if owner navigates away from success screen.
- **Findings:** _(log here)_

### Step 3 — Portal while registration is PENDING
- **Setup:** organizer (`owner@dev.local`) leaves the team `pending` (does **not** approve yet).
- **Owner acts:** explore `/coaches/tournaments/{teamId}` in the pending state.
- **Lens:** "Am I impressed? Do I understand what's happening and what's next?" Status pill, checklist HUD (Registered ✓ / Awaiting decision), pending fee preview, contact-organizer bridge, head-coach editor.
- **Known watch-items:** waitlist position number not surfaced; pending has no public profile.
- **Findings:** _(log here)_

### Step 4 — Portal after registration COMPLETE (accepted)
- **Setup:** organizer **accepts** the team (admin → registrations). Optionally set a fee + payment instructions; optionally publish schedule to exercise `schedule_live`/`game_day` phases.
- **Owner acts:** revisit the portal; walk accepted-prep → (schedule_live → game_day → result if we publish/seed games).
- **Lens:** "Is it easy to understand my options/next steps?" Fee status, roster submit, head-coach assignment, live schedule bridge, afterglow.
- **Known watch-items:** duplicate fee display (hero + status block — flagged for this review); UTC "today" phase-flip edge; no `/coaches` PWA manifest.
- **Findings:** _(log here)_

### Step 5 — Notification emails along the way
- **Setup:** **resolve the empty `RESEND_API_KEY` first** (send-for-real vs. log-rendered — owner decides). Confirm organizer email toggles ON for the tournament.
- **Owner acts:** trigger each email by acting as organizer — registration confirmation, acceptance, payment recorded, schedule published, game-day reminder, (rejection on a throwaway team), results finalized.
- **Lens:** "Do they arrive? Is the required action clear and low-friction? Do portal/claim links work?"
- **Known watch-items:** bulk accept/reject placeholder copy (J5-056/057); coach-email footer prefill vs. recipient mismatch when `coach_email` differs; no express-interest confirmation email.
- **Findings:** _(log here)_

### Step 6 — Sign up for FREE coaches tier; manage a team
- **Setup:** none (account already exists). Optionally create via `/start/team` or from the portal hub.
- **Owner acts:** create/operate a **standalone** free team — roster, basic schedule, manual fee ledger, announcements, Team HQ stat strip. Exercise the scope-ceiling express-interest.
- **Lens:** "What features do I have? Is it easy to navigate? Do I understand free vs. premium?" This is the full free-floor walk.
- **Known watch-items (J2 audit, all routed here):** single-add roster (J2-016), ascending schedule list (J2-017), single-add fees (J2-022), hidden opponent field (J2-021), announcement no-confirm/recipient-preview (J2-018), skipped-email names (J2-020), anonymous email reply-to (J2-026), dropped team-name on dup-email login (J2-011), Phase-4 floor never design-reviewed as a whole.
- **Findings:** _(log here)_

### Step 7 — Upgrade to Premium
- **Setup:** decide the gate strategy (see config gap above) — provision a `team` context for the coach, or flip gates to walk the real checkout/intent surface.
- **Owner acts:** hit the upgrade/scope-ceiling CTA; observe what's communicated about new features.
- **Lens:** "Do I get proper notification/information about what unlocks?" Is the free→premium boundary honest and motivating?
- **Known watch-items:** upgrade is express-interest only (no live Stripe checkout — Future Rail); no confirmation email on interest; assigning a coach to a rep team sends no notification (J2-025).
- **Findings:** _(log here)_

### Step 8 — Full Premium experience walkthrough
- **Setup:** coach in a `team_workspace`/`team` context assigned to a rep team (seed if needed).
- **Owner acts:** walk `/{orgSlug}/coaches/*` — dashboard, team overview/setup checklist, rep roster, power-calendar/schedule (lineups, attendance, recurrence), accounting (budget, BvA, expenses, fundraisers, dues, payment-requests, allocations), documents, history, link-org.
- **Lens:** "What features do I have, how easy to understand/navigate?" Premium-vs-free clarity from the inside.
- **Known watch-items:** BvA empty state looks broken (J2-037); dues/accounting copy nits (J2-033/34/35); no onboarding email on coach assignment (J2-025).
- **Findings:** _(log here)_

---

## Findings backlog (running log)

> One row per finding as we go: `[Step N] severity — short description → decision (fix now / defer / route to J-id)`.

- **[Step 1/2] HIGH — Double account-entry after registration.** The merged register form already creates a confirmed account, signs the coach in, and links the registration (verified in dev DB: "Milton Thunder" → U13 pending, account "Robert Cowan" `7dcb20f8…`, basic team + `registration_flow` link all created). But the **confirmation email's `/coaches/join?registrationId=…` claim link** drops the coach back into the **full Create-Account form** when they click it from a signed-out/InPrivate session — asking them to enter first/last/password a second time for an account that already exists and is already linked. Root cause: `app/coaches/join/page.tsx` only shows the friendly "Choose Team Profile" / `alreadyLinked` auto-redirect (line 93/219) **when signed in**; signed-out it falls through to the signup form (line 287+). → **DECISION: Layer B + light Layer A (build later per workflow).** **Layer B (primary):** make `/coaches/join` signed-out-aware — when `registrationId`+`email` resolve to an existing account, render a **"You already have an account — sign in to see {team}"** prompt (email pre-filled), not Create-Account. **Security:** gate the existence check server-side, scoped to the registrationId (no general email-enumeration oracle). **Layer A (light):** merged-flow confirmation email CTA → "Open your Coaches Portal" instead of "create your account." **Layer C (real email verification for coach-signup) DEFERRED → Phase 8** (platform-wide auth change; today `email_confirm:true` = no verification, so a public form can create a confirmed account for any typed email — its own focused pass). **BUILT 2026-06-15 (local, on `feat/free-tier-coaches`, tsc + focused lint clean; awaiting owner re-test on dev):** Layer B = new `getRegistrationAccountStatus()` in `lib/basic-coach-teams.ts` (registration-scoped existence check, no enumeration oracle — only answers when the supplied email matches the registration's own `teams.email`) + new signed-out-safe `GET /api/coaches/registration-account-status` + `/coaches/join` now renders a **"You're Already Set Up → Sign in to your Coaches Portal"** state (sign-in lands straight on `/coaches/tournaments/{id}`) with a "Create a new account" escape hatch, instead of the redundant Create-Account form. Layer A = `registrationConfirmationHtml` CTA → **"Open your Coaches Portal"** + copy "Your free … account is ready" (was "Create Account & Track Registration"). Test account `b2cowan@outlook.com` + "Milton Thunder" (U13) wiped 2026-06-15 so the owner can re-run registration against the fix. **✅ SHIPPED to dev + re-tested working 2026-06-15.**

- **[Step 1] Owner UX asks (post-register flow) — ✅ BUILT + SHIPPED to dev 2026-06-15.** Owner directed 4 changes from the register screen: **#1** skip the success screen → land straight in the Coaches Portal team record with a first-run "Congratulations, pending" welcome banner (most coaches don't know the portal exists). **#2** existing-team registration → collapse the locked team-name/registrant/email inputs to a read-only summary, show only the division. **#3** helper copy → mention coaches can add coaching-staff contacts in the portal. **#4 [BIGGER, PARKED]** actual "additional contacts" feature (coach adds staff emails in portal → coach emails auto-distribute to all; touches data + `resolveCoachRecipient` across every coach email) — **decision deferred until owner has walked the portal**; #3 copy worded conservatively (no hard auto-distribute promise) until #4 ships. Built: register redirect to `/coaches/tournaments/{id}?welcome=1`; new `components/coaches/CoachWelcomeBanner.tsx` (+ CSS, dismissible, strips param so it shows once, resources respect page visibility); existing-team collapse in `RegisterContent.tsx`. Admin preview keeps the inert success card. Verified working on dev.

- **[Step 1] Review-screen CSS redesign — ✅ BUILT + SHIPPED to dev 2026-06-15.** Owner flagged the Review Registration step CSS. Was a `repeat(2,1fr)` grid of bordered cards → 5 fields left an orphaned empty cell next to "Status after submit," and the actions row overlapped the section above it. Redesigned (owner picked "clean label/value list, no boxes"): `.reviewSummary` → `<dl>` label→value rows with hairline dividers (stacks on mobile); "Status after submit" pulled OUT into an accented status banner (`.reviewStatus`, amber pending / blue waitlist); `.reviewActions` got `margin-top` + `padding-top` + `border-top` divider to fix the button overlap. Token-clean.

- **[Step 3] LOW/MED — Welcome banner ↔ pending hero redundancy (OBSERVED, not yet decided).** On the post-register portal landing, the green "You're registered! …pending the organizer's review" welcome banner and the "Registration submitted… PENDING REVIEW" TeamHQ hero immediately below say nearly the same thing twice. Consider making the welcome banner lighter (pure portal orientation) since the hero already owns the status. → DECIDE in portal review.

- **[Step 3] LOW — Ambiguous "Decision" date in the pending checklist strip (OBSERVED).** The TeamHQ pending strip shows "Registered ✓ · Jun 15, 2026 · 🕐 Decision · Awaiting organizer" — the date reads ambiguously (registered date? decision date?). Clarify the label/placement. → DECIDE in portal review.

- **[Step 3] HIGH — Full pending-page rethink (owner-directed: "first place a new coach lands… make them say wow this is organized"). ✅ BUILT 2026-06-15 (local, on `fix/fp3-volunteer-dayof` working tree; tsc + focused lint clean; route compiles 200; awaiting cherry-pick onto `dev` + owner browser-test).** Owner expanded Step 3 from the two micro-observations into a whole-experience review (knows-nothing-about-the-platform lens). Pulled in `/design` (recommendation logged below as a proposed decision; NOT yet written to `design_decisions.md` — log on owner accept). **Restructured `app/coaches/tournaments/[teamId]/page.tsx` for the pending phase:** (1) removed the "Back to Coaches Portal" breadcrumb; (2) hero unchanged except checklist "Registered" state → **"Submitted {date}"** (resolves the Decision-date ambiguity — `TeamHQ.tsx`); (3) NEW persistent **"What happens next"** 3-step strip under the hero (`components/coaches/CoachNextSteps.tsx` + CSS — borderless numbered rows on `--surface`/`--border`, lime step markers reusing the banner's `.iconWrap` recipe; NOT a card, NOT the lime banner; carries the forward-orientation that used to live only in the dismissible banner, so it survives dismissal; pending + waitlist variants); (4) slimmed `CoachWelcomeBanner` → one-line lime greeting ("…is in for review at {tournament}. This is your free Coaches Portal for this team.") + resource links only (dropped the body paragraph + "What happens next" sub-block + now-unused `.body`/`.whatNext`/`.pending` CSS); (5) **deleted the Registration Details card on pending** (pure duplication of the hero — gated `!isPending`; kept for accepted/later phases); (6) Head Coach demoted into a **"Manage your entry"** zone with a "Optional for now…" note, wrapped in `CollapsibleCard` collapsed-by-default while pending (`defaultOpen={!isPending}` → expands once accepted; form stays mounted so state survives collapse). New pending section order: **hero → what-happens-next strip → manage-your-entry (collapsed) → announcements.** → **NAV REBUILD STAGED as a separate session** (owner approved): team-scoped shell mirroring tournament-admin (team name + status chip at top of rail, `<select>` dropdown only when >1 team; nav links = the team's tournament entries + real standalone-team surfaces; DROP the "My Teams" nav link + the "My Teams" team-list section; add a `--font-data` portal subtitle under the brand). Reason for staging: it touches `CoachPortalShell.tsx` = every coach page → its own `/review`. Data-model note for that session: a tournament registration (`teams` row, what `/coaches/tournaments/{id}` renders) is distinct from a `basic_coach_team`; registrations are grouped UNDER teams by `getBasicCoachTournamentTeamsForUser` — so "team = durable identity, tournament entry = event under it" maps cleanly to "org → tournaments." Map which standalone-team surfaces (Roster/Schedule/Fees/Announcements at `/coaches/team/{id}`) are real for a FREE team before wiring them into the team-scoped nav.

- **[Step 3] MED — Coach contact-email change invisible/unconfirmed on both sides. ✅ BUILT 2026-06-15 (local, same branch; tsc + focused lint clean — my lines add 0 new warnings; both routes compile 200; awaiting cherry-pick + browser-test).** Owner set the coach contact email (`teams.coach_email` = `ecowan1984@gmail.com`) in the portal but the admin registrations row still showed the registration email (`b2cowan@outlook.com`) — looked like the save failed. **DB-verified the save worked** (`teams.coach_email` persisted; `teams.email` correctly unchanged — it's the identity/access anchor, never overwritten by the contact override; routing = `resolveCoachRecipient = coach_email ?? teams.email`). Two confusion fixes (owner approved both): **(Admin)** `app/[orgSlug]/admin/tournaments/registrations/page.tsx` — added `coach_email` to `TeamRecord` (already returned by `/api/registrations` `select('*')`; no API change). **(Coach)** `components/coaches/HeadCoachEditor.tsx` — new optional `registrationEmail` prop (wired from page `team.email`) + a persistent quiet **"Organizer emails for this team will go to {addr}"** routing line (names the override if saved, else "{registration email} (your registration email)"); reflects SAVED state, updates after save; new `.routing` CSS (muted info row).

- **[Step 3] MED — Registrant-vs-head-coach identity collision in the admin row (REVISES the row display above). ✅ BUILT 2026-06-15 (same branch; tsc + focused lint clean; route 200).** Owner spotted the deeper issue: the expanded registrations row paired the **head-coach NAME** (`teams.coach`, which they'd edited to "Robert Cowan2" in the portal) with the **registrant EMAIL** (`teams.email` = `b2cowan@outlook.com`) — two different people shown as one, made worse once a contact override (`coach_email`) existed. **Root cause = data-model gap:** `teams` has a registrant identity (`email`, the account/access anchor — name lives only in **auth metadata** `full_name`, NOT on `teams`) AND a head-coach identity (`coach` + `coach_email`); the UI conflated them. **Fix (replaces the lime "Contact:" tag from the entry above):** the expanded-row meta now shows two clearly-labelled identities — **"Head coach: {coach} ({coach_email})"** (the contact email shown in-parens only when set; it's the organizer-mail target) and **"Registered by: {email}"** — plus the Registered date. New `.teamIdentity`/`.teamIdentityLabel` CSS (quiet uppercase `--font-data` label + meta-colour value); the old `.teamContactTag` CSS removed. **"Registered by" is EMAIL-ONLY by owner's decision** — the registrant name would require an `auth.admin.listUsers` lookup on the hot registrations endpoint (paginated/unreliable for big orgs), not worth it; email is reliable and already removes the confusion (the head-coach name no longer falsely pairs with the registrant email). The table "Coach" column still shows `teams.coach` = head coach, now consistent with the expanded row. **Registrant-vs-coach distinction may surface elsewhere (emails, exports, other admin views) — NOT audited this pass (owner scoped to "fix the admin row now"); candidate follow-up if it recurs.**

---

## Cross-references
- Source plan & full coach architecture: [FREE_TIER_COACHES_UNIFIED_PLAN.md](FREE_TIER_COACHES_UNIFIED_PLAN.md)
- Journey audit J2 (rep head coach): `docs/projects/active/journeys/JOURNEY_J2_REP_HEAD_COACH.md`
- Email architecture: `memory/project_email_stack.md`
- Coaches portal architecture: `memory/project_coaches_portal_architecture.md`
