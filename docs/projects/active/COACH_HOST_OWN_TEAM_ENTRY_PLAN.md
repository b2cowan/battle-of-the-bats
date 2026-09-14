# Your team, in your own tournament — a hosting coach enters their own team, and Add Team learns who is already here

> PM brief: `COACH_HOST_OWN_TEAM_ENTRY_PM_BRIEF.md` · Hub (mockup · brief · plan · decisions):
> `COACH_HOST_OWN_TEAM_ENTRY_HUB.html` → https://claude.ai/code/artifact/b776ee02-eb4f-4336-b46e-1281769130f4 ·
> Raised by the owner 2026-09-13 from the Milton Bats U13 Purple portal's hosted "Fall Ball 2026"
> Teams page; the three-part proposal (A / B / no directory) was accepted the same day.
> Status: **BUILT on dev 2026-09-13** — Parts A, B, C (mig 297 applied to dev; prod-owed, `MANUAL_PROD_STEPS`), D;
> D1–D5 ruled by the owner's "go ahead" on the recommendations the same day (hub Decisions tab); typecheck +
> `verify:changed` clean; 12 guard tests in `tests/unit/coach-own-team-entry-guard.test.ts`. Awaiting `/review`,
> the owner QA walk and commit. Stage anchors live on the hub's stage strip.

## 0. The ask, and the re-frame

The owner, standing on a hosted tournament's Teams page inside his own coaches portal, asked two
things: *"how can I add my team to the team list?"* and *"if there are other teams on the platform,
shouldn't I be able to search for them to ensure proper linkage?"*

The first question has no answer today — that is the gap. The second is the wrong instrument for the
right worry: the worry is *an Add Team entry is an orphan even when the coach is on the platform*;
the instrument proposed (an organizer-side directory of every club's teams) would let an organizer
attach a registration — roster, schedule, chat — to a team that never agreed to it, and would expose
a cross-club read the product has nowhere else. Every linkage on the platform today is written by the
coach's own signed-in action. This plan keeps that invariant and closes the gap from the two sides
that already own the fact: the host (who is the coach) and the invited coach (who accepts).

## 1. What the code does today (verified 2026-09-13)

**F01 — Add Team creates an orphan, always.** "Add Team Manually" (`app/[orgSlug]/admin/tournaments/registrations/page.tsx`, `handleAddTeam` → `/api/admin/teams` `create-team`) inserts a `teams` row — name, coach, email, division — and nothing else. No bridge row, no team on the platform, the host's own team included.

**F02 — The only two linkage doors are coach-side.** `basic_coach_team_registrations` is written by (a) the public register POST when the signed-in coach's email equals the registration email (`app/api/register/route.ts:388`), and (b) the claim on `/coaches/join` (`app/api/coaches/basic-teams` POST) — which requires the *same* email equality (`getPendingTournamentRegistrationForUser`). So a host who Add-Teams themselves must then open their own access email and claim their own entry.

**F03 — The admin "Link to rep team" control is gated OFF for a coaches portal.** The registrations page shows it only when `hasModuleEntitlement(currentOrg, 'module_rep_teams')`; the two routes behind it (`/api/admin/rep-teams/teams`, `/api/admin/teams/rep-team-link`) refuse the same way. A team workspace's plan grants `CORE_MODULES` only (`lib/plan-config.ts:65`, deliberately team-scoped). So the one person on the platform who obviously *is* the team they want to link — the hosting coach — has no control at all.

**F04 — A from-scratch standalone portal team has no free-team shadow, so public registration strands it.** Provisioning (`lib/team-workspace-provisioning.ts:269`) sets `team_workspaces.basic_coach_team_id` only from an explicit upgrade (`basicCoachTeamId`) or a claimed registration (`sourceTournamentTeamId`); a direct signup has neither, and `resolveBasicCoachTeamIdForWorkspace` then returns `null` forever (`lib/basic-coach-teams.ts:1290`). The public register form's team picker lists only the coach's *free* teams (`components/public/RegisterContent.tsx:215`), so this coach sees none, the route creates a **new** free team for the registration (`createBasicCoachTeamForRegistration`), and the paid portal's Tournaments page never learns of it (`linkage: 'none'`). The UAT standalone fixture (`scripts/seed-uat-standalone-coach.mjs`) inserts `team_workspaces` with no basic team — it is exactly this case. The Milton Bats portal in the owner's screenshot may be too (verify on prod before the backfill in §3.C).

**W1 — Widened: a club-linked entry dead-ends on click.** `getMergedTournamentHistoryForRepTeam` merges the free-team bridge and the admin-link bridge (`rep_team_tournament_registrations`) into one list, and the coach Tournaments page renders every entry as a link to `/tournaments/{registrationId}`. The record page (`CoachTournamentRecord.tsx:95`) authorizes solely through `canUserAccessTournamentRegistration` → `findLinkedBasicTeamForRegistration(user.id, …)` — the free-team bridge, membership-checked. An admin-link-only entry has no free-team row → `notFound()`. The list promises what the record refuses.

**W2 — Widened: on a Premium team, only the coach who personally registered can open a record.** Same guard: free-team *membership* (`basic_coach_team_users`, written only for the creator/adopter — no staff sync exists anywhere in `lib/`). Assistants and the team manager hold a coaching assignment that passes the Tournaments door (`canConfigureTeam`) and see the entry in the list; tapping it 404s. Same root cause as W1: the record authorizes on the wrong fact. The list's right is *coaching assignment on this rep team + this registration belongs to this rep team (either bridge)*; the record should read the same right.

## 2. Scope

| Part | What | Ruling needed |
|---|---|---|
| **A** | **Add my team** — one click on a hosted tournament's Teams page registers the host's own team, already linked | Accepted 2026-09-13 (D1, D2 open) |
| **B** | **Email-aware Add Team** — the form says when the email belongs to a coach on FieldLogicHQ, and the notify email becomes the accept step it already is | Accepted 2026-09-13 (D3 open) |
| **C** | **Every portal team has a free-team shadow** — provision it, backfill it, and the public form's picker names the portal team | Required by A; the F04 defect |
| **D** | **The record follows the list** — a tournament record authorizes by the same right that showed the row (W1 + W2) | Ruled IN 2026-09-13 (D5); roster source deferred |
| ✗ | Cross-organization team search / directory | **Rejected 2026-09-13** (§0) |

**Out of scope:** any organizer-side lookup of another club's teams; auto-linking by email match on the organizer side (the Layer-1 public-page recognition stays what it is); changing who may host (delegation ruling stands); the free portal's own Tournaments list beyond what Part C touches.

## 3. Design

### Part A — "Add my team"

**Where:** the hosted tournament's Teams page (`admin/tournaments/registrations`) **only when `isTeamWorkspaceOrg(currentOrg)`**. Everywhere else the page is unchanged.

**What the host sees:**
- Header actions: a ghost **Add my team** button to the left of **Add Team**. In the empty state, a second button beside the existing lime **Add Team**.
- Once the team is in: the button is gone (not disabled — there is nothing further to do) and the team's row carries a **Your team** chip in the slot where a club org would show the rep-link chip. The chip is clickable (owner rule: every highlight explains itself) and opens a one-paragraph explanation: *"This is {Team}, registered by {head coach}. It appears on your Tournaments page; the entry's status, payment and seed are edited here like any other team."*
- Dialog **"Add {Team name} to this tournament"**: Division (dropdown, preselected to the page's current division filter, required) · Payment status (dropdown, default per D1) · one line of consequence copy: *"Registered as {head coach name} · {email}. It shows on your team's Tournaments page right away."* · **Add my team** (lime) / Cancel.
- After: the row appears in the list like any registration (status Accepted), and on the coach side the tournament now sits in **both** halves of the Tournaments page — *This season* (as an entry) and *Tournaments you run* (as the host). That is correct and the brief says so.

**Who may click it:** anyone who can reach this page for this tournament — the head coach, and a staff member holding the *Run tournaments* switch (D2). The page already answers that question; "Add my team" adds no second gate.

**Server (new action, `/api/admin/teams` POST `action: 'add-own-team'` — or a sibling route `/api/admin/teams/own-team` if the switch in the existing handler grows unreadable):**
1. `requireAdmin`-style ctx as the existing `create-team` action; assert `isTeamWorkspaceOrg(ctx.org)` else 403 ("This tournament isn't run from a coaches portal").
2. Resolve the workspace by `workspace_org_id = ctx.org.id` → `rep_team_id`, `primary_owner_user_id`; the rep team's name; the primary owner's name + email (auth user + `user_profiles`, the same source the staff sheet reads). The registration is written **as the head coach**, not as the actor — a manager clicking the button is registering the head coach's team, and the public-page Layer-1 recognition keys on the head coach's email.
3. `ensureWorkspaceBasicCoachTeam(workspace)` (Part C) → `basicCoachTeamId`.
4. **Idempotency:** if any `teams` row in this tournament already bridges (either bridge) to this rep team → 409 *"{Team} is already in this tournament."* The GET below makes the client hide the button first; the 409 is the race guard.
5. Insert `teams` (name, coach, email, division_id, tournament_id, status `accepted`, payment_status per input, registered_at now) under the same capacity rules `create-team` applies (mirror, do not fork — extract the shared insert if the two would diverge).
6. Insert `basic_coach_team_registrations` (`link_source: 'explicit'`, `linked_by_user_id: actor`) — written directly, **not** through `linkTournamentRegistrationToBasicCoachTeam`, whose email-equality claim check is for a coach proving ownership; here the server already holds the whole chain (org → workspace → rep team → basic team) and asserts it.
7. Upsert `rep_team_tournament_registrations` (`org_id: ctx.org.id`, `rep_team_id`, `link_source: 'explicit'`) — so Layer-2 public-page recognition covers delegates whose email is not on the registration. Both tenant assertions the existing link route makes are trivially true here (same org on both sides) but are still made.
8. Return the new registration; the client reloads the list.

**GET for the page:** extend the registrations page's initial load with `ownTeam: { name, registrationId | null }` for workspace orgs (one small query — the workspace's rep team name + whether any registration in this tournament bridges to it). Drives button-vs-chip.

**Unit tests:** action refused for a non-workspace org; refused for an actor without tournament rights; 409 on second call; both bridge rows written with the right ids; registration email = head coach email even when a manager clicks.

### Part B — Email-aware Add Team

**Where:** the existing "Add Team Manually" dialog, every org (not workspace-only — the orphan problem is universal).

**What the organizer sees:** when the Email field holds a valid address and blurs, one quiet status line under it:
- Match → *"This coach is on FieldLogicHQ. Turn on the notification and they'll see this entry in their portal the moment they accept."* and the **Notify team** checkbox flips **on** (the organizer can turn it back off).
- No match → *"When you notify them, this email becomes their sign-in and the entry lands in their free Coaches Portal."* (the truth of today's flow, said out loud; checkbox untouched).
- Nothing while the field is empty or invalid.

**Server (D3 — the lookup):** `GET /api/admin/teams/coach-account?email=` → `{ exists: boolean }`. Org-admin only (same ctx guard as the page), exact lowercased match against `auth.users` via the admin client, **rate-limited per user** (reuse the existing limiter the register route uses), returns nothing but the boolean — no name, no team, no org. The enumeration exposure is: an authenticated org admin, one email at a time, learns yes/no for an address they already typed. That is materially the same fact the notify email discloses by bouncing or not. The copy-only fallback (no lookup, always the conditional sentence) is available if D3 rules the other way.

**No behaviour change on submit.** The entry is still an orphan until the coach accepts — that is the point: acceptance stays the coach's action. The join page (`/coaches/join`) is untouched.

### Part C — Every portal team has a free-team shadow

1. **Provisioning:** in `provisionTeamWorkspace`, when neither `basicCoachTeamId` nor a source-registration team resolves, **create** a basic team (`source: 'workspace'` — a new enum value if `basic_coach_teams.source` is CHECK-constrained; verify against the snapshot, not the migration files) named after the rep team, owned by `primary_owner_user_id`, and write both back-links exactly as the upgrade path does (`team_workspaces.basic_coach_team_id` + `basic_coach_teams.team_workspace_id`).
2. **`ensureWorkspaceBasicCoachTeam(workspace)`** — the same creation, callable lazily; Part A calls it, and `resolveBasicCoachTeamIdForWorkspace` grows a final branch that calls it instead of returning `null`. One function, two callers.
3. **Backfill migration (data-only):** every `team_workspaces` row with `basic_coach_team_id IS NULL AND source_tournament_team_id IS NULL` and an active state gets a shadow team + back-links. **Data-only migrations are invisible to `check:migrations`** — record it in the release notes by hand (`reference_prod_release_history`).
4. **Public form picker:** `RegisterContent.tsx` lists the coach's basic teams by their free-team name; a team with `team_workspace_id` set is labelled with the **workspace's rep-team name** and a "Coaches Portal" note so the coach recognizes their paid team. (Verify: `/api/coaches/basic-teams` GET already returns `teamContexts` with the workspace — use it rather than a new field.)
5. **Fixtures:** `seed-uat-standalone-coach.mjs` inserts the shadow team too; check whether the demo coach seed (`riverdale-ridge`) needs it — the build's demo re-seed will pick up a changed seed on its own (never re-seed prod by hand).

### Part D — The record follows the list (W1 + W2) — **needs a ruling (D5)**

The record page for the Premium shell (`app/[orgSlug]/coaches/teams/[teamId]/tournaments/[registrationId]/page.tsx`) already establishes *coaching assignment on `teamId` with `canConfigureTeam`*. What it does not establish is *this registration belongs to this rep team*. Proposed: a resolver `registrationBelongsToRepTeam(registrationId, repTeamId)` — true if the workspace's basic team bridges to it **or** a `rep_team_tournament_registrations` row does — and the Premium page passes that verdict into `CoachTournamentRecord` as the access fact, instead of the shared record re-deriving access from free-team membership. The free portal's own record path (`/coaches/team/[basicTeamId]/…`) keeps its membership check untouched.

Every API the record calls must move with it, or the page renders and its tabs 403: `app/api/coaches/tournaments/[teamId]/route.ts` and `…/roster/route.ts` both use `requireCoachRegistrationAccess` (free-team membership). The roster route also **reads the master roster from the basic team** (`getBasicCoachTeamPlayers(guard.basicCoachTeamId)`) — for a Premium team that is the wrong roster (the workspace's players live on the rep team). That is the one place Part D stops being an auth change and becomes a data question; flag it in the ruling rather than solving it in passing.

Sizing: D is a day if the roster question is deferred (record + games + announcements open; roster submission stays as it is), several if not. **Recommendation:** rule D in, defer the roster-source question to its own line.

## 4. Sequencing

C → A → B → D. C first because A cannot write the bridge without it; A before B because A is the owner's actual blocker; B is a form change plus copy; D on its own ruling. C's backfill migration is data-only: apply to dev with the build, apply to prod at promote time and record it by hand.

## 5. Decisions — all five ruled 2026-09-13 as recommended ("go ahead")

- **D1 — Payment status of the host's own team.** Recommend **default Paid**: the team owes nothing to its own event, and an Unpaid row would sit in every "who hasn't paid" chase. The organizer can change it in the row like any team.
- **D2 — May a delegated runner click "Add my team"?** Recommend **yes**: the *Run tournaments* switch hands over the whole tournament page or nothing (delegation ruling 2026-09-13); a second gate on one button contradicts it. The registration is written as the head coach either way.
- **D3 — Email-aware: do the lookup, or copy only?** Recommend **the lookup** (org-admin-only, exact match, boolean, rate-limited) — it is what makes the form *aware*. Copy-only is the fallback.
- **D4 — Backfill existing from-scratch workspaces on prod.** Recommend **yes**, as the data-only migration in §3.C.3. Without it, an existing standalone coach registering on any public page keeps stranding entries.
- **D5 — Part D in scope?** Recommend **in**, with the roster-source question deferred to its own line (§3.D).

## 6. Verification (owner walk drafted when built)

- Hosted tournament, head coach: **Add my team** → dialog → row with **Your team** chip → button gone → coach Tournaments page shows the entry under *This season* **and** the tournament under *Tournaments you run* → the entry's record opens.
- Same, as a staff member holding *Run tournaments* (D2): button present; registration coach/email are the head coach's.
- Second click impossible (button gone); direct POST → 409.
- Club org (uat-test-org): Teams page unchanged apart from Part B's status line; no "Add my team".
- Part B: type a known coach email → match line + checkbox on; unknown email → the other line; empty → nothing.
- Part C: a fresh from-scratch standalone workspace registers on a public page → the entry appears on its Tournaments page (this is the F04 case; today it does not).
- Part D (if ruled in): assistant on a Premium team opens an entry from the list; a club-linked entry opens from the list.

## 7. Files (expected)

`app/[orgSlug]/admin/tournaments/registrations/page.tsx` + `teams-admin.module.css` · `app/api/admin/teams/route.ts` (or `…/teams/own-team/route.ts`) · `app/api/admin/teams/coach-account/route.ts` (B) · `lib/team-workspace-provisioning.ts` · `lib/basic-coach-teams.ts` (`ensureWorkspaceBasicCoachTeam`, resolver branch) · `components/public/RegisterContent.tsx` (C.4) · `supabase/migrations/NNN_backfill_workspace_basic_teams.sql` (data-only) · `scripts/seed-uat-standalone-coach.mjs` · `docs/agents/db/DATA_DICTIONARY.md` (new `source` value if any; the F04 gotcha on `team_workspaces.basic_coach_team_id`) · tests under `tests/unit/` · help: `lib/help-content/tournaments.tsx` (Add Team FAQ) and the coach Tournaments article (run `/docs` when built).
