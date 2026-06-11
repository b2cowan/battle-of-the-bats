# Coaches Experience — End-to-End Audit + "Wow" Pass

> ⚠️ **Execution sequence now lives in [FREE_TIER_COACHES_UNIFIED_PLAN.md](FREE_TIER_COACHES_UNIFIED_PLAN.md)** (merged with the Free Tier Strategy plan). This doc is retained as the **coach-phase detail reference** — stage findings, design/marketing synthesis, architecture decisions, original Phases A–E. In the unified plan: Phase A = unified Phase 1, master-roster-half-of-C = unified Phase 3, B/D/E + C-snapshot = unified Phase 5.

**Status:** PHASE 0 AUDIT COMPLETE + 5-PHASE BUILD PLAN WRITTEN 2026-06-05 · awaiting sign-off to start Phase A
**Sequencing (locked 2026-06-05):** Foundation first, A→E; full phase-adaptive Team HQ wow scope — **superseded for the standalone path by the Reconciliation with Free Tier Strategy below (2026-06-07): B/D/E are tournament-participant-only and parallel; the standalone floor interleaves with Free Tier phases.**
**PM brief:** [COACHES_EXPERIENCE_EVAL_PM_BRIEF.md](COACHES_EXPERIENCE_EVAL_PM_BRIEF.md)
**Related:** absorbs Phase 3 of [GATE_CHECKIN_PLAN.md](GATE_CHECKIN_PLAN.md) (coach roster submission);
builds on the Tournament Coach Portal + Coaches Portal architecture (memory).
**Scope boundary (2026-06-07):** the **standalone Basic on-ramp** (creating a Coaches Portal team with NO tournament attached) is owned by the **Free Tier Strategy** project ([FREE_TIER_STRATEGY_PLAN.md](FREE_TIER_STRATEGY_PLAN.md) Phase 3), NOT this project. This project deepens the tournament-participant Basic portal (Phases A–E) and is a *dependency* of Free Tier, not redundant with it — do not archive or merge.

**Reconciliation with Free Tier Strategy — agreed 2026-06-07 (governs the phases below):**
- **Persona tagging.** Phase A + the **master-roster half of Phase C** are persona-agnostic (serve standalone + tournament coaches). **Phases B, D, E are tournament-participant-specific** — their standalone variants are owned by [FREE_TIER_STRATEGY_PLAN.md](FREE_TIER_STRATEGY_PLAN.md) Phase 3, not here. Team HQ is **not** the universal in-portal home; A–E is a complete growth model only for the tournament-arriving coach.
- **Promoted Phase A deliverable — the org-less team-profile route.** No route today resolves a bare `basic_coach_teams` (every coach detail page is keyed on a tournament `teams.id` via `canUserAccessTournamentRegistration`); `getUserAccessContexts` has no resolver for it. This route + resolver + IA is the **critical-path spine** for the standalone floor. **Decide its URL up front** — distinct, identity-resolved; do NOT overload the Premium `/coaches/teams` list.
- **Phase A is "mostly built, needs a verified remediation pass," not green.** Residual ghost tokens remain in inline styles (`app/coaches/tournaments/page.tsx` L94/111/112, `[teamId]/page.tsx` L213/217/253) → fix to `--text-secondary` / `--text-tertiary` (**NOT** `--text-muted`, which also doesn't exist); the "when you register" empty-state copy is still live (`coaches/page.tsx` L66, `tournaments/page.tsx` L113); `btn-primary` / `btn-sm` violate the locked admin conventions.
- **Phase B — generalize the status component** to accept an organizer-authored OR coach-authored source (the standalone manual fee ledger is a variant, not a fork).
- **Phase C — master roster = identity fields only** (name/jersey/contact, optional DOB — **NOT attendance**, which is Premium). Host it on the new org-less route; tournament-submission is the optional downstream half. **Ship the minor-DOB privacy/consent gate in-phase.** **Migration = the next free number (≥114), NOT 112** (taken by `games.duration_minutes`; 113 by `teams.seed`). The Premium roster is per-program-year, so upgrade-continuity is a shape-translation, not a copy.
- **Phase D — Team HQ hero is tournament-only.** Extract a shared shell so Free Tier Phase 3's standalone no-event hero reuses it; the game-day bridge is tournament-participant-only.
- **Phase E — afterglow earned-ask is tournament-only.** Convert the "$19/$29 carries over" bridge to **express-interest** (paid Premium is not live). Standalone coaches use the Free Tier Phase 3 ceiling trigger (lineups / documents / budget / dues-automation) instead.
- **Coach free/paid line (opt-C, locked).** FREE no-tournament floor = team profile + multi-team + master roster + **basic schedule** + **basic comms** + manual fee ledger + standalone Team HQ. PREMIUM = lineups, power-calendar, attendance, dues automation, budget, documents, season-setup. Full table in FREE_TIER §10.
**Lenses applied to every surface:** ▸ **gap** (friction / dead ends / missing states) · ▸ **wow**
(premium / broadcast-grade delight) · ▸ **growth** (value-demonstration + tasteful acquisition).
Design (wow) input via `/design`; growth/copy input via `/marketing` — both folded in below.

---

## TL;DR — what the audit found

The **tournament coach portal is the one major surface that missed both redesign waves.** The
public site went broadcast-grade (Phases A–E) and the admin became a game-day cockpit (Phases A–B);
the coach portal at `app/coaches/*` is still flat, shell-less, and partly broken at the token level.
Five cross-cutting problems define the project:

1. **No portal shell.** There is no `app/coaches/layout.tsx` — no persistent nav, no identity, no
   phase awareness. Each page is a bare server component; three of them import CSS from a **legacy
   `app/my/registrations/` folder**.
2. **Ghost tokens.** `coaches-portal.module.css` uses `--text-2 / --text-3 / --border-1 /
   --surface-3` which **do not exist** in `globals.css` → muted text isn't muted, hover-card
   surfaces compute to transparent, borders collapse. The portal looks "off" before any wow work.
3. **Payment is invisible to the coach.** The admin tracks `payment_status`; the coach's own pages
   never show what they owe or whether they've paid. This is the #1 "what do I do now?" question,
   unanswered.
4. **The game-day experience is walled off.** ScoreTicker, MyTeamDock, broadcast scorecards, live
   standings/bracket, fan PWA, and Plus score-alerts are all built — on the *public* pages. The
   portal never bridges to them.
5. **A live brand violation.** The portal home foregrounds "Basic" vs "Premium" tiers and "No
   Coaches Portal access is linked," directly contradicting the rule that participant access is
   always just *"your Coaches Portal."*

Plus the headline build: **coach roster submission does not exist yet** (data layer is ready —
`tournament_roster_players` + `roster_submitted_at`, RLS already allows the coach-by-email).

---

## Surface inventory (what exists today)

| Stage | Surface | File | Current state |
|---|---|---|---|
| 1 Discover & register | Register form | `app/[orgSlug]/[tournamentSlug]/register/page.tsx` | Strong: availability bars, waitlist-aware, fee schedule, custom fields, signed-in pre-fill, existing-team link, 3-step indicator |
| 2 Identity | Signup / link | `app/coaches/join/page.tsx` | Clean auth card; handles 409→login, registration linking, existing-vs-new team |
| 2 Identity | Portal home | `app/coaches/page.tsx` | ⚠ "Basic/Premium" tier framing; bare header, no shell |
| 2 Identity | Tournaments dashboard | `app/coaches/tournaments/page.tsx` | Passive archive grouped by team; generic CTA cards; imports legacy `/my/` CSS |
| 2 Identity | Team detail | `app/coaches/tournaments/[teamId]/page.tsx` | Static status card + anemic schedule + announcements; imports legacy `/my/` CSS |
| 2 Identity | Not-found | `app/coaches/tournaments/[teamId]/not-found.tsx` | Minimal; imports legacy `/my/` CSS |
| 2 Identity | Premium teams | `app/coaches/teams/page.tsx` | "Premium" badge framing; rep-workspace links |
| 2 Identity | Start (standalone) | `app/coaches/start/page.tsx` | Renders `TeamSignupClient`; growth surface (availability-gated) |
| 3 Emails | Lifecycle | `lib/email.ts` | confirmation / acceptance / waitlist / rejection / payment / reminder / access / schedule-published / results-finalized |
| 4 Pre-event | **Roster submission** | — | **Does not exist** (table ready) |
| 5 Game day | Live experience | public `[orgSlug]/[tournamentSlug]/*` + `components/public/*` | Built, **not bridged** from portal |
| 5 Game day | Gate check-in | admin + `/[orgSlug]/check-in` | Built; coach has **no visibility** of their status |
| 6 Post-event | Afterglow | results-finalized email + public team-profile OG/share | Email good; **portal** has no result/placement/share |

---

## Stage-by-stage findings (all three lenses per surface)

### Stage 1 — Discover & register
**`register/page.tsx`** is a genuinely good form and the strongest surface in the journey.

> **▶ Stage-1 registration-form QA — ✅ BUILT 2026-06-08 (separate chat; tsc clean, lint clean for new code; awaiting browser verification at `/dev-test-org/dev-tournament-2026/register`).** Single owner of `register/page.tsx`. Shipped:
> - **(1) Duplicate fee removed** — dropped the review-screen summary-grid "Fee" card; the richer payment panel (deposit + due dates + organizer context) is now the single source. A shared `PaymentPanel` component now backs both the form step and review step (no copy drift).
> - **(2) Due dates** — confirmed already-correct (fee + deposit due dates render via `resolveFeeSchedule` when set); not a gap. Browser-verify with a division that has due dates (the dev U13 has none).
> - **(3) Organizer payment controls** — **product decision settled (user, 2026-06-08): build a toggle, default ON.** Three new `TournamentSettings` JSONB keys (no migration): `show_fees_on_register` (default show — when off, the public payment panel is hidden even if fees are set, so organizers can track fees in admin only), `payment_instructions` (organizer-authored how-to-pay text), `payment_instructions_on_form` (default false). Authored in **Event Settings → Fee Schedule** (`settings/event/page.tsx`, shown for non-free fee scopes); whitelisted + sanitized in the `patch-settings` action (`api/admin/tournaments/route.ts`).
> - **How-to-pay clarity** — **user choice: instructions delivered via the acceptance email by default, optionally also on the form.** `acceptanceHtml` now renders the organizer's instructions (escaped) in its Payment Instructions block when set, wired through **all three accept paths** (`registrations/[id]`, admin bulk `tournaments/[id]/registrations/bulk`, admin `teams` PATCH). On the public form, instructions appear only when `payment_instructions_on_form` is on (and fees aren't hidden).
> - **Add-to-calendar + "you're in motion" success redesign** — success screen now leads with a `Countdown` "First game in N days" momentum banner (sport-neutral, not "first pitch"), a **Save the dates** .ics download (`downloadTournamentCalendar`, all-day VEVENT over the tournament dates), and a restyled ladder (Save the dates / Watch your email + how-to-pay note / Create your Coaches Portal). **Honesty fix:** points at the tournament schedule + portal account, NOT a "follow your team" link — a just-registered team is `pending` and not yet public. Growth stays pitch-free (pressure ladder).
>
> _Files: `register/page.tsx` (+ `register.module.css`), `lib/types.ts`, `settings/event/page.tsx`, `api/admin/tournaments/route.ts`, `lib/email.ts`, `api/registrations/[id]/route.ts`, `api/admin/tournaments/[id]/registrations/bulk/route.ts`, `api/admin/teams/route.ts`. Edge note: `show_fees_on_register=off` hides the whole payment panel incl. on-form instructions (instructions still go out by email). Coordination: the email-template touch overlaps the planned Phase B `acceptanceHtml` fee/due-date enrichment — additive, non-conflicting._
>
> **+ `/design` height/density pass (2026-06-08):** the form exceeded one viewport for little info — caused by redundant chrome, not the fields. Fixes: removed the page-level `.public-page-header` (tournament identity already on the shell top-bar + card header), rendered fee/deposit as **inline data rows** instead of boxed cards (dashboard metric-strip pattern), tightened `.steps`/`.formHeader`/`.formIcon`, trimmed the payment-footer copy. ≈230px recovered; field spacing untouched; availability bar unchanged. Logged to `memory/design_decisions.md` (2026-06-08).

- ▸ **gap** "Payment handled by organizer" appears 3× but **never shows how to pay** — only the fee
  number. A coach leaves not knowing the method, the deadline mechanics, or where instructions come
  from.
- ▸ **gap** No roster capture (expected — that's the Stage 4 build), and no add-to-calendar for the
  tournament dates at success.
- ▸ **gap** The success screen ([:506-530](app/[orgSlug]/[tournamentSlug]/register/page.tsx#L506-L530))
  is a flat CTA list pointing at "the public tournament pages" — it does not deep-link to **follow
  your team / install the app / score alerts**, the exact features built for game day.
- ▸ **wow** This is peak intent. Reframe success as "you're in motion": Save the dates, Follow
  {team}, Create your portal account. Reuse `Countdown` ("first pitch in N days") right here.
- ▸ **growth** One quiet line only — *"Your Coaches Portal keeps every team you register in one
  place."* **No tier mention, no org pitch** (pressure-ladder: nothing is earned yet).

### Stage 2 — Identity & portal

**Portal home `app/coaches/page.tsx`**
- ▸ **gap/brand** Foregrounds "Basic tournament records" + a `badge-info` "Basic" pill + "Premium
  team workspaces" + "No Coaches Portal access is linked." Violates the naming rule outright.
- ▸ **wow** Visually two competing badge systems read as tiers/upsell, not "your stuff." Collapse to
  **one identity** ("Your Coaches Portal"); show Premium tools as an *additive capability card*
  ("Take your team further"), not a parallel labelled tier.
- ▸ **growth** Empty state must never say "no access" (a coach reading the email *has* access). Use:
  *"Your teams and tournament history appear here automatically when you register."*

**Dashboard `app/coaches/tournaments/page.tsx`**
- ▸ **gap** A passive archive. No **action surfacing** — a coach with an unpaid fee, an unsubmitted
  roster, or an upcoming game sees no "here's what you need to do." No payment status anywhere.
- ▸ **wow** Make it an **action-first cockpit**: an "Action needed" strip (unpaid / roster due / not
  checked in / next game) above the team groups — mirrors the admin `AdminContextStrip`.
- ▸ **growth** CTA cards are generic boilerplate ("Explore Premium" / "Host a Tournament →
  /pricing"). Keep them, but the real ask belongs at the afterglow (below), contextual not constant.

**Team detail `app/coaches/tournaments/[teamId]/page.tsx`** — the richest opportunity in the project.
- ▸ **gap (biggest)** **No payment/fee visibility, no check-in status, no roster, no venue/parking/
  map, no rules link, no standings/bracket link** for the team's division.
- ▸ **gap** Schedule rows ([:222-244](app/coaches/tournaments/[teamId]/page.tsx#L222-L244)) show
  "Home/Away" but **not the opponent name**, show raw `game.location` (no resolved diamond/field),
  don't link to the public game-detail page, and don't emphasize the next game or show live state.
- ▸ **wow** Replace the static "accepted" card with a **phase-adaptive "Team HQ" hero** that evolves
  Pending → Accepted/Prep → Schedule-live → Game-day → Result (see `/design` synthesis below).
- ▸ **growth** This is the in-portal home for the afterglow placement card (own-team bridge) once the
  event completes.

**Signup `app/coaches/join/page.tsx`** — solid (409→login, linking, existing-vs-new team).
- ▸ **gap** No password strength hint beyond min-8; success/linking states are visually detached from
  the (nonexistent) portal shell.
- ▸ **wow** Minor — align the success header treatment with the new shell once it exists.

**Premium teams `app/coaches/teams/page.tsx` / `not-found.tsx`**
- ▸ **gap** Both import legacy `/my/` CSS; `teams/page.tsx` repeats the "Premium" badge + "Explore
  Premium" framing; not-found is bare.

### Stage 3 — Post-registration limbo & emails (`lib/email.ts`)
Strengths: consistently branded dark template; every email carries a portal CTA;
`tournamentResultsFinalizedHtml` ([:254](lib/email.ts#L254)) already carries a tasteful **two-bridge
afterglow** block — the correct model to extend.

- ▸ **gap** `acceptanceHtml` ([:127](lib/email.ts#L127)) says "if payment is required, the organizer
  will follow up" — yet the platform *knows* the fee/due date and could state it.
- ▸ **gap** `rejectionHtml` ([:168](lib/email.ts#L168)) is a pure dead-end (no soft "find another
  event" bridge).
- ▸ **gap** No **roster-request** email and no **"first game tomorrow"** game-day reminder (the latter
  is the still-open Public-plan Phase 3 item).
- ▸ **brand** `paymentConfirmationHtml` "see you on the diamond" ([:190](lib/email.ts#L190))
  hard-codes baseball on a multi-sport platform.
- ▸ **growth** Pre-event emails are correctly pitch-free; **concentrate** the acquisition motion at
  results-finalized (extend, don't dilute).

### Stage 4 — Pre-event prep — **the headline build**
- ▸ **gap** **Roster submission does not exist.** Data layer ready: `tournament_roster_players`
  (migration 110) + `teams.roster_submitted_at`; RLS already lets the coach-by-email read/write;
  the gate board already renders Submitted / Confirmed / None.
- ▸ **wow** Coach enters name / # / DOB in the portal → the gate becomes a confirm; a "Roster"
  checklist item on the Team HQ hero flips from ◻ to ✅.
- ▸ **growth** Roster ownership is exactly the kind of value that makes a coach want the year-round
  Coaches Portal — but surface that link only at the afterglow, not on the roster screen.
- Needs: coach-scoped roster editor in the portal, a coach-scoped API route, a roster-request email +
  a dashboard "action needed" nudge, and the gate flipping to confirm.

### Stage 5 — Game day
- ▸ **gap** The premium public experience (ScoreTicker, MyTeamDock, broadcast scorecards, live
  standings/bracket, fan PWA, Plus score-alerts) is **fully built but unbridged** from the portal —
  no "follow my team," no "install app," no "score alerts," no deep link to the live game.
- ▸ **gap** Gate check-in status is invisible to the coach ("You're checked in ✓").
- ▸ **wow** The Team HQ hero becomes a live scorebug on game day (reuse `usePublicTournamentLive` +
  `RollingNumber`); the portal schedule rows link straight to the public game-detail page.
- ▸ **growth** Score alerts is the honest, value-first place to mention Plus — as a fan feature, not
  a coach upsell.

### Stage 6 — Post-event afterglow — **the one earned acquisition moment**
- ▸ **gap** The portal's own team-detail page never shows final placement, standings, podium, or a
  share card — it stays a frozen "accepted" status card. The most emotional moment (we placed 2nd!)
  has no home where the coach already is.
- ▸ **wow** Champion/placement spotlight (gold `--warning` + Trophy, like `PublicBracketView`) + a
  `SharePageButton` (the team OG card already exists).
- ▸ **growth** The prime tasteful ask. **Two bridges** (proven in the results email, extend into the
  portal): (a) own team → Coaches Portal ("keep this team going year-round"); (b) org champion →
  the advocacy ask ("Is your association looking at something like this for their whole program? We'd
  love to connect with whoever handles that.").

---

## `/design` synthesis — the wow plan

**A unifying coach-portal shell** (`app/coaches/layout.tsx`) reusing shipped patterns: the public
`TournamentSideRail` desktop rail (≥1024px) + bottom-nav (≤900px) + an admin-style phase pill.

**The signature: a phase-adaptive "Team HQ" hero** on team-detail, mirroring the admin four-phase
lifecycle decision (2026-06-03):

| Phase | Treatment (reuses already-built primitives) |
|---|---|
| Pending | `badge-warning` pill + "submitted {date} · reviewing" + what-happens-next timeline |
| Accepted / Prep | org-duotone banner wash + team hue (`lib/team-color.ts`) + checklist HUD: ✅ Accepted · ◻ Roster · ◻ Fee · ◻ Check-in (each actionable) |
| Schedule live | `Countdown` "first pitch in…" + next-game card (opponent monogram, field, time) |
| Game day | live scorebug via `RollingNumber` + `usePublicTournamentLive`; "● LIVE" |
| Result | champion/placement spotlight + `SharePageButton` (team OG card exists) |

Reuses six built primitives — broadcast-grade by inheritance, not net-new language.

**Prioritized (design):**
- **P0** fix ghost tokens + stop importing legacy `/my/` CSS; add the shell; rebuild card/list CSS to
  the shipped system (`--highlight-top` depth, `--blur-bar` chrome, tabular `.score`, press states,
  reduced-motion-safe entrance).
- **P1** phase-adaptive Team HQ hero; game-day bridge (linkable rows, opponent identity, follow/
  alerts/install); register success "you're in motion" card.
- **P2** dashboard action-first cockpit; align `join` states to the shell.

**Candidate design decisions to log on sign-off:** (1) coach portal adopts the public app-shell
pattern + phase-adaptive Team HQ hero reusing team-color/Countdown/RollingNumber/SharePageButton/
usePublicTournamentLive; (2) ghost tokens `--text-2/--text-3/--border-1/--surface-3` banned → map to
`--white-*` / `--surface*` / `--border*`.

## `/marketing` synthesis — the growth plan

**Pressure ladder — one earned ask.** Pre-event surfaces stay pitch-free; the single acquisition
moment is the afterglow. Don't scatter upsell upstream or it burns the trust the afterglow needs.

**Two jobs:** (a) *deliver value* (payment clarity, roster, game-day bridge, afterglow card) — carried
by product, not copy; (b) *tastefully inform* — lives in exactly three places: game-day score-alerts
(value, not pitch), afterglow own-team bridge (Coaches Portal $19/$29, "carries over automatically"),
afterglow org bridge (the Coach Advocacy ask).

**Fix first:** kill "Basic/Premium" framing everywhere a participating coach sees it → one "Your
Coaches Portal"; Premium = *additive* "Take your team further" tools, **availability-aware** ("Express
interest" while Coming soon). Voice nit: drop "on the diamond" (multi-sport).

**Extend, don't dilute:** the results-finalized two-bridge block is the right model — bring it into the
in-portal team-detail afterglow so it isn't email-only.

---

## Architecture decisions (locked 2026-06-05)

These govern the phases below. Grounded in the real model: the light portal is `basic_coach_teams` +
`basic_coach_team_registrations` (no org, email-keyed); the **paid** portal is a provisioned
team-workspace **org** routed to `/[orgSlug]/coaches` (`isTeamWorkspaceOrg` in `lib/user-contexts.ts`);
the bridge column `basic_coach_teams.team_workspace_id` already links the two.

1. **Roster continuity = persistent master + per-event snapshot.** The reusable roster lives on the
   **persistent team profile** (new `basic_coach_team_players` keyed on `basic_coach_team_id`); each
   tournament **snapshots/selects** from it into the existing per-event `tournament_roster_players`
   (mig. 110), which is what the gate confirms. A coach enters players once, reuses them across
   events, and the master is **upgrade-ready** — it seeds the paid workspace via `team_workspace_id`
   when the coach upgrades (even though standalone paid checkout is still "Coming soon"). This
   replaces the Gate plan's event-only roster assumption. *(New migration — next number 112.)*
2. **Multi-team is first-class.** One coach → many teams is already data-supported
   (`basic_coach_team_users` user↔team join; the dashboard already groups by team). The **shell
   (Phase A)** and **Team HQ (Phase D)** are built **multi-team-first** — a team switcher (like the
   admin tournament switcher) and per-team HQ. No schema change.
3. **Co-coach / assistant delegation = deferred, but designed for.** Single owner per team this
   project. The schema already supports more (`basic_coach_team_users` has `role` + allows multiple
   users per team), so adding invites later is non-breaking. **Privacy gate:** because the roster
   carries minors' DOB (PII), a privacy stance must be set before any multi-user access ships. Do not
   hard-code single-owner assumptions that would block a later `role`-based invite flow.

## Phased implementation plan

**Sequencing decision (user, 2026-06-05):** Foundation first, **A → E in order**. Wow scope =
**full phase-adaptive Team HQ** (the broadcast-grade bar, not a deferred-hero subset). All commits to
`dev`. Each phase ends with `npm run typecheck` (touches shared modules / API contracts) +
`lint:focused`; the user does browser testing. Dev-server restarts are batched to each phase handoff
(every phase adds files and/or touches shared modules). A plain-language PM UX summary precedes each
phase's code per AGENCY_RULES.

### Phase A — Foundation, shell & correctness *(no new data; visual + structural)* — ✅ BUILT 2026-06-05
**Goal:** give the portal a real, branded shell; fix what's broken/off-brand so everything later sits
on a correct base.
> **Done 2026-06-05 (tsc + lint clean; dev restarted, 200s, no EACCES; awaiting browser verification).**
> New `app/coaches/layout.tsx` + `components/coaches/CoachPortalShell.tsx`/`.module.css` (desktop rail +
> mobile top bar/bottom nav + multi-team switcher); `isCoachPortalShellPath()` added to
> `lib/coaches-portal-routes.ts` and used to suppress the marketing `Navbar`/`Footer` on portal routes.
> Ghost tokens fixed + legacy `/my/` CSS deleted → colocated `coaches-portal.module.css` /
> `tournaments.module.css` / `[teamId]/detail.module.css`. Basic/Premium framing removed → "Your
> Coaches Portal" + "Take your team further" (availability-aware). Logged to `design_decisions.md`.
- **New `app/coaches/layout.tsx`** — server shell: branded header (FieldLogicHQ Coaches Portal +
  signed-in email + sign-out), desktop ≥1024px left rail (Home / Tournaments / Teams) reusing the
  public `TournamentSideRail` pattern, ≤900px bottom nav. (Per-team phase pill lives on Team HQ, not
  the global shell.) Centralize the `getUser()`-or-redirect guard the pages each duplicate.
- **Multi-team first (decision 2):** include a **team switcher** in the shell (admin tournament-
  switcher pattern) so a coach with several teams moves between them cleanly; the dashboard already
  groups by team — make that the spine, not an afterthought.
- **New `app/coaches/coaches.module.css`** — rebuild card/list/detail styling to the shipped system:
  correct tokens (`--white-*`, `--surface`/`--surface-2`, `--border`/`--border-2`, `--radius`),
  `--highlight-top` card depth, `--blur-bar` chrome, tabular `.score`/`.tabular`, press states,
  reduced-motion-safe entrance.
- **De-couple from legacy `/my/` CSS:** `tournaments/page.tsx`, `[teamId]/page.tsx`,
  `[teamId]/not-found.tsx`, `teams/page.tsx` stop importing `app/my/registrations/*`; fold needed
  styles into the new module. Remove the now-dead legacy CSS if nothing else references it (verify).
- **Kill Basic/Premium framing** (`app/coaches/page.tsx` + `teams/page.tsx`): one identity — "Your
  Coaches Portal"; Premium tools become an additive "Take your team further" card (availability-aware
  CTA — "Express interest" while Coming soon); empty states never say "no access linked." (Marketing
  copy in the findings.)
- **Verify:** typecheck + lint; smoke 200 on `/coaches`, `/coaches/tournaments`, `/coaches/teams`.
- **Log design decisions** (the two candidates) once greenlit.

### Phase B — Payment & status visibility *(answers "what do I do now?")*
**Goal:** show the coach what they owe / have paid + their check-in status.
- **Data:** extend the team-detail server fetch with `payment_status`, `payment_collected_at`,
  the resolved fee schedule (division/tournament, reuse `resolveFeeSchedule` logic), `check_in_status`,
  `checked_in_at`, `roster_submitted_at`. Surface a compact payment chip on dashboard cards too.
- **UI:** a "Status" block on team detail — Fee: Owed (amount + due) / Paid (date) / No fee set;
  Check-in: Not arrived / Checked in ✓. Make clear payment is organizer-recorded ("Your organizer
  records payment — contact {email} to arrange"), not a pay button (no Stripe-at-gate, per Gate plan).
- **Email:** enrich `acceptanceHtml` to state fee amount + due date when known; fix the multi-sport
  voice nit in `paymentConfirmationHtml` ("on the diamond").
- **Verify:** full typecheck (API/data contract change) + lint.

### Phase C — Roster submission *(the moved Gate Phase 3)* — **persistent master + per-event snapshot**
**Goal:** coach maintains a reusable team roster, submits it to a tournament ahead of game day → the
gate becomes a confirm, and the roster is upgrade-ready (decision 1).
- **Migration 112:** new `basic_coach_team_players` (persistent master) keyed on
  `basic_coach_team_id`: name, jersey_number, date_of_birth, position, notes, created/updated. RLS:
  the team's coach (via `basic_coach_team_users`) reads/writes. (Keeps the existing per-event
  `tournament_roster_players` from mig. 110 as the snapshot the gate confirms; add a nullable
  `source_player_id` link to the master.) Apply with `node scripts/apply-migration-api.mjs` then
  `node scripts/refresh-db-schema.mjs`.
- **API:** coach-scoped routes — `app/api/coaches/teams/[teamId]/roster` (master CRUD, auth via
  `basic_coach_team_users` ownership) + `app/api/coaches/tournaments/[teamId]/roster` (submit/select
  master players into `tournament_roster_players` for a tournament team, auth via existing
  `canUserAccessTournamentRegistration`, stamps `teams.roster_submitted_at`).
- **UI:** mobile-first **master roster editor** on the team profile (enter players once) + a
  **per-tournament "submit roster"** step on Team HQ that selects from the master (handles travel
  rosters that differ per event). "Submitted {date} — the organizer confirms at check-in."
  **Edit-lock:** editable until `roster_confirmed_at` (recommended).
- **Designed-for-delegation (decision 3):** roster ownership resolves through `basic_coach_team_users`
  (not a single hard-coded user) so a later assistant-coach invite is non-breaking; **do not** ship
  multi-user access until the minor-DOB privacy stance is set.
- **Upgrade continuity:** the master seeds the paid workspace roster via `team_workspace_id` (wire
  into `team-workspace-provisioning.ts`; verify what it copies today).
- **Email + nudge:** new `rosterRequestHtml` (fire on schedule-publish or org request) + a dashboard /
  Team HQ "action needed: submit your roster" item. Gate board already renders Submitted/Confirmed/
  None — confirm copy only.
- **Deferred:** DOB→age/eligibility validation (already deferred in the Gate plan); waivers.
- **Verify:** full typecheck (new API contract + migration) + lint; restart after the new files.

### Phase D — Phase-adaptive Team HQ hero + game-day bridge *(the signature wow)*
**Goal:** the living hero + connection to the built public game-day experience.
- **New `components/coaches/TeamHQ.tsx`** (client) — phase-adaptive hero deriving Pending /
  Accepted-Prep / Schedule-live / Game-day / Result from `team.status` + tournament dates + games.
  Reuses `lib/team-color`, `Countdown`, `CountUp`, `RollingNumber`, `SharePageButton`,
  `usePublicTournamentLive`. Checklist HUD (Accepted / Roster / Fee / Check-in) wired to B+C data;
  next-game card resolves opponent name + monogram + field/diamond; game-day live scorebug.
- **Bridge:** portal schedule rows become `<Link>`s to the public game-detail page; add
  "Follow {team} · Get score alerts (Plus) · Install the app" (reuse public follow/alerts/install).
- **Verify:** typecheck + lint; browser on live test data (`/dev-test-org/live-demo`).

### Phase E — Afterglow *(the one earned acquisition moment)*
**Goal:** close the loop in-portal + extend the proven email model.
- **In-portal:** Result-phase champion/placement spotlight (gold `--warning` + Trophy) +
  `SharePageButton` (team OG card exists).
- **Growth:** an in-portal afterglow card carrying the **two bridges** (own team → Coaches Portal
  $19/$29 "carries over automatically"; org → the Coach Advocacy ask), availability-aware (marketing
  copy). Keep the results email's two-bridge block as the canonical model.
- **Also:** `rejectionHtml` soft bridge ("explore other events"); the game-day "first game tomorrow"
  reminder email (the still-open Public-plan Phase 3 item) — in scope here.
- **Verify:** typecheck + lint; browser.

### Cross-cutting
- Reuse, never re-derive: team-color, Countdown/CountUp, RollingNumber, SharePageButton,
  usePublicTournamentLive, the public rail/bottom-nav pattern.
- Keep every pre-event surface pitch-free (pressure ladder); the afterglow is the only earned ask.
- TODO.md carries one high-level line per phase; detailed notes stay here.

## Open questions (carried from kickoff — now answerable)

- **Unifying coach home?** Yes — build the missing `app/coaches/layout.tsx` shell; that's the spine.
- **How much rep-portal pattern transfers?** The *public* app-shell pattern transfers better than the
  rep `/[orgSlug]/coaches/` admin-style shell; reuse public primitives.
- **Roster required vs optional / eligibility validation / edit-lock timing?** Edit-lock = until
  `roster_confirmed_at` (recommended); DOB→age validation deferred (Gate plan). **RESOLVED 2026-06-09
  (owner-approved):** required-vs-optional is **organizer-controlled at tournament level** via a new
  roster-requirements set in the tournament settings JSONB (`require roster/DOB/jersey/waiver`,
  min/max players) authored in Event Settings — it drives (and hides) the coach Team-HQ checklist +
  the C-snapshot submit fields + the gate confirm. Applies **only at the per-event submission**; the
  free master roster (`basic_coach_team_players`, built Phase 3) stays identity-only + DOB
  optional/consent-gated regardless. Tournament-level for V1; **per-division override deferred**
  (would follow the Divisions-UX inheritance model). Scheduled in unified-plan **Phase 5** beside
  C-snapshot.
- **Light↔paid data continuity?** RESOLVED (decision 1) — persistent master roster on the team
  profile, snapshot per event, upgrade-ready via `team_workspace_id`.
- **Coach on multiple teams?** RESOLVED (decision 2) — multi-team-first shell + Team HQ; team switcher.
- **Assistant coaches / co-admins on the light portal?** RESOLVED (decision 3) — deferred this
  project, schema designed to allow it later; minor-DOB privacy stance required before it ships.
- **Notification depth for coaches** (roster due, schedule posted, game starting, results)?
  Recommended scope in Phases C–E; game-start reminder is the open Public-plan Phase 3 item.

## Infra readiness notes

- Roster: `tournament_roster_players` (mig. 110) + `teams.roster_submitted_at/roster_confirmed_at`
  (mig. 110), RLS coach-by-email read/write — **ready**.
- Identity: `teams.email ILIKE user.email` via `basic_coach_teams` ↔ `basic_coach_team_registrations`
  link model (`lib/basic-coach-teams.ts`).
- Email triggers mapped: registration/accept/reject/payment → `app/api/registrations/[id]/route.ts`
  + bulk route; schedule-published → `app/api/admin/schedule-publish/route.ts`; results-finalized →
  `app/api/admin/tournaments/route.ts`; access reminder → `.../resend-access/route.ts`.

## Journey-audit inputs (J5 tournament coach, routed 2026-06-11)

The platform user-journey audit routed 7 verified portal-shell/IA findings here (full detail + evidence in
[journeys/JOURNEY_J5_TOURNAMENT_COACH.md](journeys/JOURNEY_J5_TOURNAMENT_COACH.md); screenshots in the gitignored `tests/uat/results/journeys/J5/`):

- **J5-013 (High)** the claim wall doesn't scale and buries the post-claim home — ~16,000px of identical "Claim team" cards on mobile; after claiming, "YOUR TEAMS" renders BELOW the remaining wall on a page still headed "CLAIM YOUR TEAMS". Invert order, group matches by team with a count header + claim-all, collapse the rest.
- **J5-015 (High)** the "Teams" nav tab opens the Premium upsell page, not the coach's teams — one of three tabs is upsell-only for the free cohort; real teams hide under "Home"; mobile has no My Teams surface at all.
- **J5-020 (Med)** mobile portal has no sign-out or account surface anywhere (desktop-rail-footer only, hidden <1024px) — add an account menu to the mobile top bar (also solves the missing mobile team switcher).
- **J5-021 (Low)** hub + records list share the "Coaches Portal" h1 and "Basic" tier vocabulary leaks — residual violation of the locked kill-Basic/Premium-framing decision.
- **J5-022 (Low)** no nav tab is active on the org-less team home — one-character route collision (`/coaches/team` vs `/coaches/teams`).
- **J5-023 (Low)** hub CTAs use btn-outline/btn-sm against the locked convention, and "Claim team" — the most journey-critical button in the portal — is the quietest.
- **J5-055 (Low)** ScopeCeilingInterest pre-checks 4 of 5 interest boxes, biasing the demand signal — start unchecked.
