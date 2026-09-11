# Coaching staff — roles, access enforcement, and the Staff screen (build plan)

**Status:** APPROVED for build by the owner 2026-09-10 ("looks good, I agree with your
recommendations"), on the review `COACH_STAFF_ACCESS_REVIEW.md` and mockup artifact
`https://claude.ai/code/artifact/c8982bc5-6d0c-4063-bc82-400850600b1d` (round 2).
**Pass 1 BUILT on dev 2026-09-10, `/review`ed the same day, and ✅ OWNER QA §168 PASSED
2026-09-11 (28/28, four parts PASS)** — **committed `b0914edb` 2026-09-11**; walk
`COACH_STAFF_ACCESS_PASS1_WALK.html`, artifact `50b0efa1`. ⚠ A separate session (2026-09-11, §171)
has since added a `scoutingBook` grant and widened the helper's Insights door for the Scouting Book
tab; the schedule doors helper and the helper-preset test were updated by that session, not this one. typecheck
clean · 3,462/3,462 unit tests · `verify:changed` green on every check but a foreign root file.
`/review` (4 lenses) caught one Critical before QA — the Overview's Tournaments tile was pushed
unconditionally and would have sat on "…" forever for any assistant without schedule editing once
its read refused them; it now follows the Tournaments nav door (`lib/coach-overview.ts`). Also
fixed: Settings' organization-link row is head-coach-only; the Overview org-invite banner is
head-coach-only; the link page reads closed assignments too; the practice-plan read gates
evaluation sessions on `canViewMeasurables`; the schedule panel's Edit / family-email doors read
from the doors object. Refuted: the events read's practice plans + recap (both within the helper's
grant by ruling).
**Pass 2 BUILT on dev 2026-09-11 (uncommitted) — §2 to §5 in full: the list + the sheet, the four
kinds and their presets, the stored label (mig 288, applied to dev, PROD-PENDING; its backfill is
DATA-ONLY), invite with access first, pending rows with resend/cancel, schedule as one three-way
control, plan/drill/template writes on `canWritePracticePlans`, Make head coach with the
last-head rule, the four emails from `STAFF_KIND_COPY`, the accept page, the admin oversight page,
the help article and the Overview step. **`/simplify` (8 applied) and `/review` (5 lenses; 13 confirmed
incl. one Critical — the remove path's last-head race — and the migration backfill's narrow predicate,
all fixed) run the same day; `check:layout` green on the staff screen.** Owner QA §169 owed (walk `490bc3e3`).** Four departures
from the round-2 mockup were drawn as **round 3** on `c8982bc5` BEFORE building: a Scouting book
switch in Everyday (the 09-11 grant had no screen), the treasurer starting with it OFF (else the
09-11 Insights door opened for them — §2.2's treasurer bundle gains `scoutingBook: false`), the
pending row's sentence as a door, and the own-row "Hand over" note. Two things this plan got wrong
about the code, resolved on the code: the past-season library imports gate on BOTH the write and
`canReadPastPracticePlans` (§2.3 said "/"); the admin oversight page reads kinds from the
membership, not the season row (§2.5). Not built, by design: the drills RLS policy stays head-only
(stricter than the app, never met by it); the masthead's role word still reads "Assistant Coach" for
the three non-coach kinds (the season record carries no kind — §2.4's own rule).
⚠ Two corrections to the review found while building pass 1: (a) the tournament RECORD page and
its registration routes already refuse anyone who does not own the linked coach team, so the
"full tournament record" leak was the LIST and the history read only — the record page still
gained a redirect gate for the door-and-room rule; (b) the awards door on the schedule panel
mirrors `canManageAwards` = any record duty, money included, so a money-only treasurer holds it
today — pinned in the test as a mirror, and recorded in §10 as a question for the model.
**PM brief:** `COACH_STAFF_ACCESS_PM_BRIEF.md`. **Evidence:** the review (every finding carries
file:line). **QA:** Owner QA Ledger **§168** (pass 1) and **§169** (pass 2), walks as checkable
artifacts. **Migration:** **288** (pass 2 only).

**Assumptions the build runs under** (the review's open questions, answered as drawn; the owner
agreed to the recommendations as a whole — flagged here so a "no" is one line, not a rebuild):
1. Team manager's starting bundle has **no Attendance**.
2. **Two head coaches are allowed**; removing or demoting the last one is refused.
3. **R7 widens existing assistants**: every assistant who holds "Schedule: View + edit" gains
   practice-plan (and drill / plan-template) writing on deploy.
4. Pending invites show to **both** the head coach (new) and the club admin (today's page).
5. Team treasurer starts with **Contacts & birthdates off** and **Staff chat off**.

---

## 0. Two passes, in this order

| Pass | Scope | Migration | Why this split |
|---|---|---|---|
| **1 — enforcement** | §1 below: close the server holes, gate every door the client shows, replace the false empty states, pin it with tests | none | Small, isolated, closes two real data leaks; ships on its own commit before the screen changes anything |
| **2 — the screen and the model** | §2–§5: people list + sheet, invite with access first, pending rows, stored role, four presets, schedule as one control, plan writes on schedule edit, make head coach, emails, help, admin oversight | **288** | The sheet's role dropdown needs the presets and the stored label, so screen and model are one unit of work |

Concurrent-work rules apply (shared worktree; other sessions have uncommitted files in the
budget/import area): stage explicit pathspecs only, `git show --stat HEAD` after every commit.

---

## 1. Pass 1 — enforcement (no migration)

Rule being applied: **every read gate matches its nav door, and every door a page shows is one its
server would open.** The game console's server-derived `can` object is the model.

### 1.1 Server

| Route (under `app/api/coaches/[orgSlug]/teams/[teamId]/`) | Method | Today | Gate to add |
|---|---|---|---|
| `announcements/route.ts` | GET | membership only (`:56`) | `denyUnless(caps.announcementsSend)` — matches the "Email families" nav door; POST already gated |
| `tournament-history/route.ts` | GET | `requireCoach` + money redaction | `denyUnless(canConfigureTeam(caps))` — matches the "Tournaments" door. ⚠ The Overview (`teams/[teamId]/page.tsx`) also fetches this; guard that fetch on the same predicate so a treasurer never sees a 403 tile (the page already does this for money) |
| `history/route.ts` | GET | membership only (`:75`), `canViewSeasonHistory: true` hard-coded | `denyUnless(hasNonMoneyRecordAccess(caps))` — matches the Insights door. Check callers first (`history/page.tsx`; any Overview tile) and guard their fetches |
| `upgrade-summary/route.ts` | GET | membership only | `denyUnless(caps.isHeadCoach)` — matches its POST |
| `team-links/route.ts` | GET | membership only | `denyUnless(isHeadCoach)` — matches POST/PATCH |
| `practice-plans/past-seasons/route.ts` | GET | `canWriteDevelopment` | `canReadPastPracticePlans` — the predicate's own JSDoc names this as its gate |
| Tournament registration surface (`app/api/coaches/tournaments/[teamId]`, `…/roster`) | GET | `requireCoachRegistrationAccess` | Add the same `canConfigureTeam` check on the rep-team assignment it resolves, so `tournaments/[registrationId]` cannot be read by a helper via URL |

### 1.2 Client — the schedule drawer (`schedule/page.tsx`)

Extract the drawer's door decisions into a pure helper **`lib/coach-schedule-doors.ts`**:

```ts
export function scheduleDrawerDoors(caps: CoachCapabilities, ev: { isGame: boolean; isLineupEvent: boolean; hasOpponent: boolean; scoutingAvailable: boolean }) {
  return {
    attendanceTab: caps.attendance,
    lineupTab: ev.isLineupEvent && caps.lineups,
    scoutingTab: ev.isGame && ev.hasOpponent && ev.scoutingAvailable && canViewScoutingBook(caps),
    scoreForm: ev.isGame && canManageSchedule(caps),
    awards: ev.isGame && canManageAwards(caps),
    seasonAttendanceLink: hasNonMoneyRecordAccess(caps),
    editEvent: canManageSchedule(caps),           // already gated today (`canAddEvents`)
    emailFamilies: caps.announcementsSend,        // already gated today
  };
}
```
The page consumes it for: `slideTabs` (`:1249-1250`), the initial drawer fetch (`:925-929` — fetch
lineup only when `lineupTab`, attendance only when `attendanceTab`, neither otherwise), the score
form (`:2389-2441`), the awards block (`:2470-2499`), the attendance editor (`:2696-2843`), the
three lineup links (`:2664`, `:2873`, `:2895`), the "Season attendance" link (`:2723`). A refused
read is rendered as the portal's blocked block, never as "add players to the roster first"
(`:2765`) — the swallowed-403 path (`:2832` footer gate) is deleted with it.

What a helper then sees on a game: the event details, the Scouting tab when there is an opponent
(open to every schedule-holder by ruling), nothing else. On a practice: the "Open the practice
plan" door, as today.

### 1.3 Client — other pages

| Page | Change |
|---|---|
| `game/[eventId]/page.tsx` | No-lineup fallback card (`:1043-1064`) gated on `!readOnlyViewer`; review-mode "Playing time — season report" link (`:941-943`) on `hasNonMoneyRecordAccess` |
| `history/page.tsx` (Insights) | Page-level gate `hasNonMoneyRecordAccess` → standard blocked block; the `?section=attendance` fallback lands inside the gate |
| `roster/page.tsx` | Page-level gate `hasRecordAccess` → blocked block (no "Your roster is empty", no Export) |
| `documents/page.tsx` | `canViewDocuments` → blocked block |
| `accounting/page.tsx` | `canViewMoney` → blocked block instead of `CoachLoadError` + Retry |
| `development/board/page.tsx` | `hasRecordAccess` → blocked block instead of raw error text |
| `announcements/page.tsx` | `announcementsSend` → blocked block |
| `chat/page.tsx` | `staffChat` → blocked block |
| `tournaments/page.tsx`, `tournaments/[registrationId]/page.tsx` | `canConfigureTeam` → blocked block |
| `history/results/panel.tsx` | Covered by the Insights page gate; its own error copy stops claiming a load failure for a 403 |
| `attendance/page.tsx`, `depth-chart/page.tsx` redirects | Land on gated pages; no change needed once the targets gate |

"Blocked block" = the `CoachEmptyState quiet` pattern the Lineups pages use ("Lineups aren't turned
on for you · Ask your head coach"), with the section's own name. One shared helper
`components/coaches/CoachNotGranted.tsx` (name + one sentence) so the eleven call sites cannot
drift in wording.

### 1.4 Tests (pass 1)

- `tests/unit/coach-schedule-doors.test.ts` — the helper preset sees no tab/door on a game but
  Scouting; a default assistant sees all; a treasurer (schedule view + money) sees none of the
  write doors; every door key maps to the predicate its API uses.
- `tests/unit/coach-helper-preset.test.ts` — extend the "one door" describe with the five API
  predicates a helper must fail (`announcementsSend`, `canConfigureTeam`, `hasNonMoneyRecordAccess`,
  `isHeadCoach`, `canReadPastPracticePlans`).
- A code-scanning guard in the style of `assistant-invite-account-states.test.ts`: the five GET
  handlers in §1.1 contain a `denyUnless(` call (so a refactor cannot silently drop one).

### 1.5 Exit for pass 1

`npm run verify:changed` + `npm run typecheck` (auth/route behaviour changed) · `/review` · Owner
QA **§168** walk (a helper account, a default assistant, a money-only assistant): each blocked page
refuses with the standard block; the drawer shows a helper only the Scouting tab; announcements and
tournaments refuse by URL. Commit on `dev`, explicit pathspecs.

---

## 2. Pass 2 — the model (migration 288)

### 2.1 Migration 288 — `288_staff_kind_is_a_label.sql`

```sql
alter table rep_team_staff_memberships
  add column staff_kind text
  check (staff_kind in ('assistant','manager','treasurer','helper'));
alter table assistant_invite_tokens
  add column staff_kind text
  check (staff_kind in ('assistant','manager','treasurer','helper'));
-- Backfill (DATA-ONLY — invisible to check:migrations; verify on prod by querying the rows):
update rep_team_staff_memberships
   set staff_kind = case
     when coach_role = 'assistant_coach'
      and coalesce(capabilities->>'schedule','true') = 'true'
      and capabilities->>'scheduleManage' = 'false'
      and capabilities->>'staffChat' = 'false'
      and coalesce(capabilities->>'attendance','true') = 'false'
      and coalesce(capabilities->>'lineups','true') = 'false'
     then 'helper' else null end
 where coach_role = 'assistant_coach';
```
NULL = "no label stored" → the resolver falls back to today's derived label (so nothing changes for
rows written before 288). `DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same unit of
work. Head-coach rows never carry a kind.

### 2.2 `lib/coach-capabilities.ts`

- `export type StaffKind = 'assistant' | 'manager' | 'treasurer' | 'helper';`
- `export const STAFF_PRESETS: Record<StaffKind, Readonly<AssistantCapabilityGrants>>` —
  `assistant` = the explicit form of `ASSISTANT_DEFAULTS`; `helper` = `HELPER_PRESET` (kept as an
  alias so the existing tests hold); `manager` = `{schedule:true, scheduleManage:true, attendance:false,
  lineups:false, staffChat:true, documents:'manage', money:'write', rosterPii:true, notes:false,
  announcementsSend:true, tryouts:false}`; `treasurer` = `{schedule:true, scheduleManage:false,
  attendance:false, lineups:false, staffChat:false, documents:'off', money:'write', rosterPii:false,
  notes:false, announcementsSend:false, tryouts:false}`.
- `STAFF_KIND_COPY[kind] = { name, sentence, emailSubject, emailWhat }` — the single home for the
  dropdown's sub-lines, the row chip, the invite email and the admin notification.
- `staffKindLabel(caps, storedKind)` — returns the stored kind when present, else today's derived
  answer. Still display-only; still never called from a route or a gate (the existing test pins
  that).
- `sanitizeAssistantGrants` unchanged (the kind is a column, not a grant).
- **R6 — Schedule as one control** is a UI mapping over the same two keys: Hidden → `{schedule:false,
  scheduleManage:false}`, View → `{true,false}`, View + edit → `{true,true}`. The resolver's legacy
  fallback (`scheduleManage ?? schedule`) stays.

### 2.3 R7 — practice-plan writes follow "Schedule: View + edit"

`canWritePracticePlans = canManageSchedule`. Routes moved off `canWriteDevelopment`:
`events/[eventId]/practice-plan` PUT/PATCH, `development/drills` POST + `[drillId]` PATCH,
`development/plan-templates` POST + `[templateId]` PATCH, and the three `past-seasons` reads for
plans/drills/templates → `canReadPastPracticePlans` / `canManageSchedule`. Skills & Goals writes
(goals, measurables, sessions, continuity, carry) stay head-only. Client: `practice/page.tsx`
`canPlan`, `practice/[eventId]` `canWrite` (server-derived — already), the plan editor's
head-coach-only copy. The Schedule control's sentence in the sheet says "Edit adds, changes and
cancels events, and writes practice plans."

### 2.4 Membership + invite model (`lib/coach-membership.ts`, `lib/assistant-invites.ts`)

- `TeamStaffMembership.staffKind: StaffKind | null`; `addStaffMember` / `updateStaffMemberCapabilities`
  accept and write it; the projection row is unchanged (the kind is not projected — season records
  keep head/assistant).
- New `setStaffMemberRole(membershipId, teamId, coachRole)` for R8, with the **last-head-coach
  guard** (count active head coaches on the team inside the same statement path; refuse when the
  change would leave zero). `resolveHeadCoachTarget` widens: a head-coach row is a valid target
  for a *role* change only, never for grants (a head coach has none) and never for self.
- `createAssistantInvite` takes `staffKind` + full `initialCapabilities`; `listOpenAssistantInvitesForTeam(teamId)`
  (head-coach panel); `updateAssistantInviteAccess(inviteId, teamId, kind, grants)` (edit while
  pending); `revokeAssistantInvite` already exists (cancel); resend = re-mint token + email +
  supersede (extract from the invite route into the lib so the admin approve path and the head
  coach share one function).
- `acceptAssistantInvite` writes `staffKind` from the invite onto the membership.

### 2.5 API

| Route | Change |
|---|---|
| `staff/route.ts` GET | Also returns `pending: [{inviteId, email, kind, initialCapabilities, expiresAt, createdAt}]` and each member's `staffKind` |
| `staff/invite/route.ts` POST | Body `{email, kind, capabilities}`; `kind` required (no default — the sheet forces the choice); `capabilities` sanitised; email subject/what from `STAFF_KIND_COPY`; approval notification names the kind |
| `staff/invites/[inviteId]/route.ts` (new) | PATCH `{kind, capabilities}` while pending · POST `{action:'resend'}` · DELETE = cancel. Head-coach-only; invite must belong to this team |
| `staff/[coachId]/route.ts` PATCH | Also accepts `{kind}` (label only) and `{coachRole:'head_coach'|'assistant_coach'}` (R8, last-head guard, 409 when refused: "A team needs at least one head coach.") |
| Admin `rep-teams/assistant-coaches` | Shows the kind on each row and on pending invites; approval email uses the kind's copy |

### 2.6 The screen — `components/coaches/CoachStaffPanel.tsx` → a list + `CoachStaffSheet.tsx` (new)

Built to the round-2 mockup, frame by frame:
- **Page header** (`CoachPageHeader` with `actions` = "＋ Invite someone"); **no lede** under the
  title (page-header rule).
- **List** (`.a-list` in the mockup): rows for every active member incl. head coaches, then pending
  invites. Row = name · email · "also follows" note · role chip (`STAFF_KIND_COPY`; head = ink
  chip; invited = amber) · access chips (everyday = neutral, sensitive = amber with the lock glyph;
  labels "Schedule · edit / view", "Money · edit / view", "Documents · view / manage", others by
  name) · "Edit access ›". Pending row: "Invited {date} · link works N more days", "Will start as
  {kind}", Resend / Cancel. Foot line: "Everyone signs in as themselves. Removing someone ends their
  access to every screen and every season at once." + help link.
- **Sheet** (`CoachStaffSheet`, reusing the portal's sheet shell — same chrome as
  `ScheduleImportSheet`; full-screen ≤640px): header (name, email, joined / "Saved" live region);
  **Role** = `SublinedChoice` (⚠ draw the visible `<label>` yourself — the component's `label` prop
  is the ARIA name only), options from `STAFF_KIND_COPY`, `value: null` on a new invite with
  placeholder "Choose who they are"; changing it applies the preset (confirm when it widens a
  sensitive grant, none when it narrows); **Everyday** group (Schedule 3-way, Attendance, Lineups,
  Staff chat, Documents 3-way) + standing note; **Sensitive** group always visible (Money 3-way,
  Contacts, Internal notes, Email families, Tryouts) — the existing `CONFIRM_ON_GRANT` copy and
  the compound Documents+Contacts rule carried over unchanged; per-control sentences from one
  `GRANT_COPY` table; footer: "Remove from team" (danger) · "Make head coach" (secondary; hidden on
  a head-coach row; on another head coach's row it reads "Make assistant coach").
- **Invite mode**: email → Role dropdown (nothing chosen; the access section is a `convGhostNote`
  until chosen) → the same grid prefilled from the preset → "Send invite"; one confirmation at send
  listing every sensitive grant in the invite. Success = the pending row appears in the list.
- Saves stay per-tap (instant) on an existing member; on a pending invite, per-tap PATCH to the
  invite; on a new invite, one POST at send.
- Attendance's sentence carries the consequence ("Turning this on also opens the roster page")
  whenever the person currently has no record duty — computed from `hasRecordAccess`, not hard-coded.
- The old rail, the access-explainer card, the radio pair and the helper card are deleted.

### 2.7 Copy that changes with it (same unit of work)

- Help: `lib/help-content/coaches.tsx` `premium-staff` — four kinds, the dropdown, pending invites,
  "Make head coach", the schedule control, plans on schedule edit; keywords gain "treasurer",
  "team manager", "resend invite", "cancel invite", "make head coach", "hand over". `/docs` pass.
- Overview setup step "Invite assistant coaches" (`teams/[teamId]/page.tsx:1010-1018`) → "Invite
  your staff", copy names the four kinds.
- Invite email (`lib/email.ts` `assistantCoachInviteHtml`) → per-kind subject/what from
  `STAFF_KIND_COPY`; accept page (`auth/accept-assistant-invite`) says "join as {kind}".
- Admin oversight page rows + approval notification name the kind.
- Demo: the coach sandbox seeds no assistants. **Recommend seeding one assistant coach and one
  pending invite on the Riverdale Ridge team** so the shop window shows this screen (a dock line
  "Your staff, and what each of them can open"); needs the `check:demos` fixture updated. Optional —
  flag at the pass-2 gate rather than slipping it in.

### 2.8 Tests (pass 2)

- `coach-capabilities.test.ts` / `coach-helper-preset.test.ts`: the four presets round-trip the
  sanitiser; treasurer nav = Money + Settings, not Insights/Tournaments/Chat (extends the existing
  treasurer case); manager nav; `staffKindLabel` prefers the stored kind and falls back for NULL;
  the schedule 3-way mapping is a bijection over the two keys.
- Last-head-coach guard: promote, demote-other, refuse-last (unit on the lib with a stubbed client,
  or an integration test against dev if the harness allows).
- Invite: kind required (400 without), pending PATCH/resend/cancel are head-coach-only and
  team-scoped (404 across teams).
- `coach-nav-groups.test.ts` unchanged (no nav changes).

### 2.9 Exit for pass 2

Migration 288 applied on dev, dictionary + snapshots refreshed, `check:dictionary` green ·
`verify:changed` + `typecheck` · `/simplify` (new sheet + presets table = new abstractions) then
`/review` · Owner QA **§169** walk (head coach: invite each of the four kinds from one sheet,
resend/cancel a pending invite, change a role both directions, make and un-make a head coach, the
last-head refusal; second account: each kind's first sign-in lands with the right doors; phone at
390) · `/docs` · demo decision · commit on `dev`. Migration 288 is **prod-owed** until the next
release; its data-only backfill is verified on prod by query, never by `check:migrations`.

---

## 3. Out of scope (recorded so they are not built on the way past)

- Roster editing as a grant (R9 — later; touches the roster screens).
- A "Compare" matrix view (mockup §07 — declined for now).
- Join-date scoping of chat history; the double-record (staff + family) merge — both stand as
  previously ruled.
- Free-tier assistants — dropped 2026-07-06, unchanged.
