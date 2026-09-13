# Coach Tournament Delegation — "Run tournaments" as one staff grant

**Status:** BUILT on dev and **committed `1062e67a` 2026-09-13** (owner "go ahead" the same day; chunks A + B in one pass; no migration; /review 9 fixes, /docs and /strategy in the same commit); Owner QA **§181** owed. Plan written 2026-09-13 from the code at dev `87b94167`.
**Hub (mockup · brief · plan · decisions · QA):** `docs/projects/active/COACH_TOURNAMENT_DELEGATION_HUB.html` (published as the project Artifact).
**PM brief:** `COACH_TOURNAMENT_DELEGATION_PM_BRIEF.md`.
**Owner direction (2026-09-13):** *"the head coach needs to be able to delegate managing their
exhibition weekends to managers and assistants. we can simplify the permission to: for those that
have it can do everything in that tournament page, so we don't need further tournament staff
permissions in there like we have in the tournament standalone accounts. default off for
assistants and on for managers."*
**Owner ruling 2 (2026-09-13, on the first mockup):** *"we already have a tournaments page where it
shows teams' tournaments they are participants in — use that as the way for admins and head
coaches to create their own; a centralized tournaments section instead of 2 separate navs."* The
foot-of-menu "Tournaments admin" door in the first mockup is withdrawn; the Overview banner is
retired in the coach portal; the coach Tournaments page gains a **"Tournaments you run"** section.

---

## 1. What the code does today (the findings)

### F01 — The "run tournaments" banner is a dead end for everyone but the workspace owner

`components/marketing/CoachTournamentAwarenessBanner.tsx` renders on the team Overview
(`app/[orgSlug]/coaches/teams/[teamId]/page.tsx`) whenever `/api/admin/org/has-tournaments` says
the org has the tournaments module and no non-archived tournament yet. **It never asks who is
looking.** *Open setup* links to `/{org}/admin/org/tournaments`.

An assistant coach holds org role `coach`, which `lib/roles.ts` deliberately leaves with **zero**
capabilities (audit J4-005: coach-role members once read org-wide finance through the admin
routes). What happens on the click:

1. `app/[orgSlug]/admin/layout.tsx` admits any org member except `official` → the admin shell opens.
2. `app/[orgSlug]/admin/org/tournaments/page.tsx` renders; its list call (`GET
   /api/admin/tournaments`) checks membership only, not tournament rights, so the list loads and the
   create button is visible — the page has no capability gate on it.
3. `POST /api/admin/tournaments` refuses every mutating action without `create_tournaments` →
   the form fails with a bare **"Forbidden"**.

That is the CLAUDE.md rule verbatim: *if a surface cannot honestly serve someone, hide its entry
point — a link that 404s is the same bug wearing a politer face.* The "CTA viewed" analytics event
also fires for people who can never convert it.

### F02 — A head coach has no way to hand tournament-running to their staff

The Premium workspace's head coach is the org **owner** (`lib/team-workspace-provisioning.ts`
→ `createOrganizationMember(..., 'owner')`), so they can run the workspace's one tournament
(`PLAN_CONFIG.team.tournamentLimit = 1`). Every staff member they invite is a capability-less
`coach` (`lib/assistant-invites.ts` step 1). The staff sheet (`components/coaches/CoachStaffSheet.tsx`)
offers 13 grants, none of which touches tournaments.

**The right already exists, one floor down.** `organization_members.capabilities` is a per-member
override map that `hasCapability()` consults before role defaults, and the admin **Members** page
(`app/[orgSlug]/admin/org/members/page.tsx`, "Manage" → override editor) can already set
`create_tournaments` etc. on a coach-role member — after which the admin hub tile, the admin
sidebar and every `/api/admin/tournaments/**` route open for them, because they all read that same
map. No head coach will ever find it there: it is an org-admin screen with the vocabulary of a
tournament company ("Override individual capabilities above or below this member's role defaults").

### F03 — The coach portal has no home for "the tournament we run"

The banner hides itself once a tournament exists (by design). After that the only door is the
**Admin** link at the foot of the coach sidebar / phone More sheet (`CoachesSidebar.tsx:161`,
`CoachesBottomNav.tsx`), shown only for `owner`/`admin`, into the whole admin area. Meanwhile
the coach portal already HAS a Tournaments page
(`app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx`): this season's entries, gated on the
`schedule` grant, with an empty state that teaches what lands there. Hosting is the other half of
"the team's tournament season" and it lives nowhere on that page.

---

## 2. Design

### 2.1 One grant: **Run tournaments**

| | |
|---|---|
| **Where it lives** | On the person's **workspace membership** (`organization_members.capabilities`), NOT on the team-staff row. The tournament belongs to the workspace (one slot), and a workspace may hold several teams; a person on two teams must get one answer. |
| **What "on" writes** | The full tournament bundle as overrides: `module_tournaments`, `create_tournaments`, `manage_registrations`, `manage_schedule_structure`, `update_schedule`, `submit_scores`, `check_in_teams`, `manage_contacts`, `post_announcements`, `post_rules`, `send_communications`, `seal_tournaments`, `manage_branding` (see D4). **Never** `manage_members`, `org_settings`, `billing`, and no other module. |
| **What "off" writes** | Removes exactly those keys from the map (leaves anything else an admin set there). |
| **How the sheet reads it** | ON iff `create_tournaments` is true in the member's override map (the one key every write route checks). A partial hand-set map from the Members page reads as OFF; switching it on then writes the whole bundle — the sheet is the front door, the Members page stays the advanced view of the same stored truth. |
| **Group on the sheet** | **Sensitive — asks before granting.** A tournament's registrations carry visiting coaches' contact details and payment records; that is other people's PII, same class as *Contacts & birthdates*. Revoking is instant and never asks. |
| **Presets** | `manager: true` · `assistant: false` · `treasurer: false` · `helper: false`. `STAFF_KIND_COPY.manager.emailWhat` gains "the team's tournaments" (the email must promise what the preset grants — that rule is on the constant). |
| **Existing staff** | A preset is where access starts, never where it must stay. Existing managers are **not** changed on ship (D3, owner call). |
| **Head coach** | Always on; not switchable for themselves (owner). Same as every other grant. |
| **Where it is offered** | **Standalone Premium workspaces only** (`isTeamWorkspaceOrg`). In a club-attached team the row is not rendered (D2). |
| **Who may flip it** | The head coach (the workspace owner). When "Manage staff, delegated" ships, its "never more than they hold" wall covers this switch with no extra rule. |
| **Leaving** | `removeStaffMember` already deletes the coach-role org membership when the person's last staff seat in the org goes (`cleanupOrphanedGuestOrgMembership`) — the override goes with it. Add a test that pins this. A person still on another team in the workspace keeps it, which is the person-level rule holding. |

### 2.2 The door — one section on the existing Tournaments page (owner ruling 2)

The coach Tournaments page gains a second block under this season's entries, eyebrow
**Tournaments you run**, rendered only for a viewer holding `create_tournaments` in this org
(owner, admin, or the grant). Nobody else sees a heading, a row or an empty card.

- **No hosted tournament yet:** one quiet card — *"Run your own tournament. A quick round robin or
  exhibition weekend, set up from here."* → **Set up a tournament** — opens the create wizard
  DIRECTLY (`/{org}/admin/org/tournaments?create=1` already does this; carry
  `source=coach_portal_tournaments` so the acquisition event the banner used to fire keeps firing
  from its new home). Finishing the wizard must land on the new tournament's Dashboard, not back
  on the list (verify at build; the wizard's post-create step decides).
- **Hosted tournament(s) exist:** one row each — name · dates · status word (Draft / Registration
  open / Live / Finished, from the tournament's status) · "N teams registered" · **Manage →**
  straight into THAT tournament's Dashboard (`/{org}/admin/tournaments/dashboard` with the
  current-tournament selection set to it — the tournament context already carries a current
  tournament; the door must select it, not rely on the last one viewed). Non-archived only, same
  as `has-tournaments` counts today. A workspace has one slot, so this is normally one row; a
  club admin who is also a coach may see several.
- **The workspace-level "All tournaments" list is never a stop on either path** (owner, on the
  first draft of screen 5: a lobby with one row and a create button "looks weird"). It stays
  reachable by the owner through the Admin link, as today.
- **Below the entries, never above** — the season's entries are the page's primary content; hosting
  is the secondary layer (the "current season is the primary focus" constraint, applied here).
- **The Overview banner is retired** in the coach portal. It was moved here from a hub that no
  longer exists; the section is its permanent, discoverable home, and the Overview stays about
  today's work. The `CoachTournamentAwarenessBanner` component has no other mount → delete it and
  the `has-tournaments` route if nothing else calls it (grep at build).
- **The foot-of-menu "Admin" link is untouched** — owner/admin only, "Admin", into the whole admin
  area, as today. It is no longer the tournament door for anyone. No nav change at all.
- **The page's own gate stays:** the Tournaments page opens with the `schedule` grant. A holder
  of `create_tournaments` without `schedule` (a manager with Schedule set to Hidden — every preset
  gives it) would not reach the section; the sheet's sentence for *Run tournaments* says "on the
  Tournaments page", which is the honest answer. Not worth a second door.
- **In a club:** the section renders for a club admin who also coaches (they hold the right);
  ordinary club coaches see nothing. No club-side change.

### 2.3 What the delegate lands on

The tournament's own **Dashboard** inside the existing admin shell, with the per-tournament rail
(`TOUR_GROUPS`: Dashboard · Teams · Schedule · Results · Check-in · Staff Kit · Communications ·
Chat · Setup ▸ · Admin ▸) — the same screen `getAuthDestination` sends a standalone tournament
account's owner to. For a team workspace the rail already collapses to the tournament-only shape
(`hasOnlyTournamentWorkspace`); **Account → Members** shows only to `module_members` holders and
**Subscription** only to the owner — the bundle includes neither, so a delegate sees the
tournament and nothing else. The rail's existing coach door (`coachDoorFor`) is the way back to
the Coaches Portal. Same 1-slot limit message the head coach gets. **No admin-side page changes.**

---

## 3. Build

**Sequencing:** builds ON TOP of *Manage staff, delegated* — committed `a274c83c` 2026-09-13 (§179
passed) — which added a Sensitive switch to `CoachStaffSheet.tsx` and edited `STAFF_PRESETS` the
same way this plan does. Start from a fresh read of both files at HEAD; the delegate ceiling it
built ("never more than they hold") covers the new switch with no extra rule.

### Chunk A — the section replaces the banner (independent, ship first)
1. New `GET /api/coaches/[orgSlug]/teams/[teamId]/hosted-tournaments`: resolves the coach
   context as every coach route does, then the caller's org role + overrides; returns
   `{ canRun, tournaments: [{ id, name, slug, startDate, endDate, status, registeredTeams }] }`
   with `tournaments` empty when `!canRun`. Non-archived only.
2. Tournaments page: the **Tournaments you run** block per §2.2, rendered only when `canRun`. The
   row reuses the existing coach tournament row shape where it fits (a hosted row has no
   registration status — it has the tournament's own status). Both empty-state variants (no
   entries + can run; no entries + cannot run) keep their existing copy.
3. Delete `CoachTournamentAwarenessBanner` and its mount on the Overview; delete
   `/api/admin/org/has-tournaments` if the grep finds no other caller; move the
   `tournament_plus_acquisition_cta_*` events to the section's button with source
   `coach_portal_tournaments`.
4. Tests: the route returns `canRun=false` + empty for a coach-role member without overrides;
   `canRun=true` + rows for the owner; the page renders no heading when `canRun` is false.
   This alone closes F01 (no dead end anywhere) and F03 for the head coach.

### Chunk B — the grant
1. `lib/coach-capabilities.ts`: `tournaments?: boolean` in `AssistantCapabilityGrants`, `tournaments`
   in `CoachCapabilities`, presets per §2.1, manager `emailWhat` sentence. ⚠ This grant is **not**
   stored on `rep_team_staff_memberships.capabilities` — it is resolved from the org membership.
   `resolveCoachCapabilities` gains an `orgOverrides` input (or a sibling resolver) so the panel
   list and the sheet read one truth. Document on the type why this key is the exception.
2. `lib/coach-tournament-grant.ts` (new, small): `TOURNAMENT_BUNDLE` (the key list), `readGrant(map)`,
   `applyGrant(map, on)` → new map. Pure; unit-tested; the single home of the bundle.
3. `PATCH /api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]`: when the body carries
   `tournaments`, and the org is a team workspace, and the caller is head coach: read the target's
   `organization_members` row (`role='coach'`, this org), write `applyGrant`. Check-then-act with the
   WHERE re-asserting `role='coach'` (never widen an admin's map from here). Refuse (400, honest
   copy) in a club org.
4. Staff panel list (`getTeamStaffPanelList`) joins the org override map so the row chip can show
   "Tournaments" and the sheet opens on the right state.
5. `CoachStaffSheet.tsx`: one `switch` control in `SENSITIVE`, key `tournaments`, label
   **Run tournaments**, sentence *"Set up and run the team's tournaments from the Tournaments page —
   registrations, schedule, scores, and what visiting teams see."* Rendered only when `isTeamWorkspace`. Asks-first copy in
   the hub mockup (screen 2).
6. Invite flow (`lib/assistant-invites.ts` step 1): when the accepted invite's grants carry
   `tournaments: true` (manager preset), write the bundle onto the newly-created / reactivated
   coach-role membership in the same step.
7. No nav change (owner ruling 2). The delegate's door is Chunk A's section, which already reads
   the override the grant writes — nothing further to wire.
8. Tests: bundle read/write round-trip; PATCH refuses in a club org; PATCH never touches a
   non-coach row; removal of the last staff seat clears the right (extends the existing cleanup
   test); the hosted-tournaments route returns `canRun=true` for a granted manager.

### Chunk C — words
- Help: the staff-access article (grant list + the manager preset sentence) and the coach
  "run a tournament" mention, via `/docs`.
- Demo: the coach sandbox's head coach now finds hosting on the Tournaments page instead of an
  Overview banner. Re-read the dock/tour lines for any mention of the banner or "Open setup"
  (none found by grep today; confirm at build) and consider whether the sandbox's Tournaments
  tour step should point at the new section.
- `check:spelling` — no variant words introduced (`tournament`, `registrations`, `schedule`).

### Not built here
- Per-tournament / per-area staff permissions inside the coach portal (owner: "we don't need
  further tournament staff permissions in there").
- Backfilling existing managers (D3).
- Any club-side change: a club admin keeps the Members page.
- A tournament-slot change: the workspace still has one.

---

## 4. Decisions for the owner (each with a recommendation; rulings go on the hub's Decisions tab)

- **D1 — Person-level, on the workspace membership.** Recommended and assumed above. The
  alternative (a per-team grant on the staff row, with auth code taught to consult it) adds a second
  permission source to every admin route and gives a two-team person two answers.
- **D2 — Standalone workspaces only.** Recommended. In a club the tournament is the club's; the
  club admin already has the Members page. If you want club coaches to run club tournaments from
  the coach portal, that is a club-admin-side consent question, not this project.
- **D3 — Existing managers stay as they are.** Recommended. "Default on for managers" applies at
  invite time. Flipping it for every manager already invited would silently widen access on ship
  — the one thing this repo's staff-access history says never to do. It is one tap per manager.
- **D4 — Include tournament branding in the bundle.** Recommended (it is "everything in that
  page"). ⚠ `manage_branding` also covers the workspace's org branding; in a workspace those are
  effectively the same surface. Say no and the delegate gets everything except the look-and-feel.
- **D5 — WITHDRAWN (owner ruling 2).** The first mockup's foot-of-menu "Tournaments admin" door is
  replaced by the section on the Tournaments page; the "Admin" link stays exactly as today.
- **D7 — The Overview banner is retired in the coach portal.** Recommended. The section is its
  permanent home; two doors to one destination is the thing the account-menu ruling (2026-09-01)
  removed elsewhere. The acquisition event moves with it, so nothing is lost in analytics.
- **D8 — The section sits BELOW this season's entries.** Recommended. Entries are the page's
  primary content; hosting is the secondary layer. Say "above" and the one hosted tournament
  out-weighs the season for every viewer who holds the right.
- **D6 — Sensitive group, asks first.** Recommended, for the reason on the row (other teams'
  coaches' details and payments).

---

## 6. Build log

- **2026-09-13 — built, chunks A + B, on dev.** The grant (`tournaments`) through the vocabulary, defaults, all four presets, the manager copy, resolve/grantsOf/sanitize; `applyOrgGrantPolicy` (clubs write it off) on the invite, pending-invite and sheet-save routes; `lib/coach-tournament-grant.ts` (the bundle, pure); `syncTournamentGrantProjection` in `lib/coach-membership.ts` after add / grant change / role change / removal; the sheet's switch (hidden in a club), confirm and consequence words; `SENSITIVE_KEYS` grows the key so the delegate ceiling covers it; `GET …/hosted-tournaments`; `CoachHostedTournamentsSection` mounted below the Tournaments page's states; the admin create wizard's success notice reads "Open the dashboard" when arrived at with `source=coach_portal_tournaments`; `CoachTournamentAwarenessBanner`, its Overview mount, its CSS and `/api/admin/org/has-tournaments` deleted; `coach_portal_tournaments` added to the acquisition sources. 15 new unit tests (`tests/unit/coach-tournament-grant.test.ts`); three existing pins updated (preset completeness, `SENSITIVE_KEYS`, the Overview fixture).
- **2026-09-13 — /review (high-risk, 4 lenses; 33 raw → 9 confirmed, all fixed) then committed `1062e67a`.** Fixed: the club-side confirm/invite words promised the grant a club strips (the preset now passes `applyOrgGrantPolicy` on the client; `staffKindCopyFor` carries the manager's tournaments clause only in a workspace, read by the sheet and the invite email); the coach-side read converges the projection for a coach-role caller before answering (heals a pre-existing second head coach, a two-teams race, a failed projection); "Open the dashboard" selects the new tournament explicitly; the hosted list honours `assignedTournamentIds`; the setup card's click event fires on the CTA only; the section mounts on an entries-fetch error; the admin assistant-coaches summary names the grant; the projection is best-effort on ADD. Accepted as designed: Members-page hand-set overrides are overwritten by the projection (the sheet is the front door); `registeredTeams` counts every row like the Dashboard tile. **Found and left for a ruling (/strategy):** coach-role memberships count against the workspace's 3-seat admin guard on the Members-page invite path — pre-existing, not this change.
- **Decision made while building (technical, not a ruling):** the grant is STORED on the staff row like every other grant and PROJECTED onto the workspace membership, rather than read from the membership by the sheet. Reason: the sheet, the row chips, the invite flow, the presets and the delegate ceiling all already work from the staff row, so storing it there costs nothing and touching none of them; the projection is one idempotent function called after every write that can change what a person's rows hold. The person-level property still holds (the projection ORs the person's active rows in the org).

## 5. Verification / QA walk (drafted; becomes the hub's QA tab at build)

Sign in as the UAT head coach (`uat-test-org` is a TOURNAMENT-plan org — the walk needs a
**team workspace** fixture; use the coach sandbox's owner on dev or seed a workspace).

- **Part A · The dead end is gone** — as an assistant (no grant): the Overview has no tournament
  banner (for anyone); the Tournaments page shows entries only, no "Tournaments you run" heading;
  typing `/admin/org/tournaments` still refuses writes (unchanged).
- **Part B · Granting** — as head coach: open a manager's sheet → Sensitive shows *Run
  tournaments*; ON → the confirm names registrations/contacts/payments; save; the row chip shows
  Tournaments. Open an assistant's sheet → default OFF.
- **Part C · The delegate** — as that manager: the Tournaments page shows *Tournaments you run*
  below the entries with the *Set up a tournament* card; it opens the create wizard directly (no
  list page); finishing lands on the new tournament's Dashboard; back on the Tournaments page the
  card is now a row with name, dates, status and *Manage*; *Manage* opens that tournament's
  Dashboard directly with its rail; the second set-up hits the 1-slot message; Members /
  Subscription are not in the rail. The foot-of-menu "Admin" link is NOT shown to
  the manager (unchanged rule).
- **Part D · Taking it back** — head coach turns it OFF (instant, no confirm) → the manager's
  Tournaments page has no "Tournaments you run" section and a direct URL's create is refused. Remove the manager from their only
  team → the workspace membership is gone with the right.
- **Part E · Invite** — invite a new *Team manager*: the invite email promises tournaments; after
  accepting, the section is there without a second step. Invite an *Assistant coach*: not.
- **Part F · Club** — as a club-attached head coach: the sheet has no *Run tournaments* row; the
  Tournaments page has no section unless that coach is also a club admin (then it lists the
  club's tournaments with *Manage*).
