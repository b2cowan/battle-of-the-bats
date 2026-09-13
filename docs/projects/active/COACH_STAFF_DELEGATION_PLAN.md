# Manage staff, delegated — a head coach can hand the Staff page to a manager (build plan)

**Status:** owner-directed 2026-09-13 — *"should a head coach be able to assign user management
(staff permissions) to an assistant coach? I think that should be an option, default to off, but
can never do anything to any head coach permissions"* → recommendation accepted, **Manager preset
ON** ruled the same day (*"I am fine defaulting the manager to on, go ahead and write it up"*).
**BUILT on dev 2026-09-13** ("build it"), §2–§10 in full: the grant + `canManageStaff` + `grantsOf`
on the model (the sheet's `grantsFrom` is now that function); the pure rule
`lib/coach-staff-delegation.ts` + the label table `lib/coach-staff-labels.ts`; the gate
`requireStaffManagerMembership` (both gates ride one `requireStaffGate`); the four routes (refuse a
client bundle above the ceiling with a 403 naming the key, clamp the server's own preset; the role
branch and any head-coach target stay head-only); the nav case, the page gate + copy, the sheet's
delegate mode (locked controls with a reason line, read-only head/own rows, clamp notes, role
buttons head-only) and the list's View/Your access rows; the admin oversight row names the grant;
the help article (new Q + the head-coach subtopic + the four-kinds row) and the pre-pass-2 FAQ
finally rewritten. **19 new unit tests; 3,745/3,745 green** after re-registering the gate on the
billing-rail guard and re-pointing four guards (routes promise 3 → staff-manager-gated, + promises
5 and 6; the projection guard; the development-grant enumeration; the kinds' preset key list and
the manager's doors); typecheck clean; `verify:changed` green except schema parity (other
sessions' dev-only migrations 290/293/294 — none here); `check:layout --only=coach-staff` green.
**✅ QA §179 PASSED 25/25, zero defects, 2026-09-13** (the hub's QA Walk tab; the three optional hand-built 403s included). Two build calls recorded on the hub (B1 refuse-vs-clamp,
B2 View/Your access wording). **`/review` run 2026-09-13 (4 lenses: correctness, security/escalation, blast-radius, client state): 12 findings → 8 after dedup → 6 confirmed and fixed** — (1) CRITICAL a delegate could not save ANY switch on a fellow manager's row (D6 tightened to "unchanged"); (2) HIGH a hand-built partial body could knock a peer's Manage staff off (same fix + the accepted bundle is stored resolved); (3) MEDIUM the Overview's "Invite your staff" tile still hid from a Manage staff holder (now `canManageStaff`); (4) MEDIUM the invite sheet could open before the list said who was looking and guess "head coach" (the panel now mounts the sheet only with `viewer`; the prop is required, no fail-open); (5) MEDIUM a cancelled role pick left "Stays at …" notes behind; (6) LOW the read-only row's dropdown had no in-code guard. Refuted/dropped: the 403 `key` being unused (the sentence already names the control), the SublinedChoice open-list race (moot once viewer is required). Not this diff's: a 32px "Open schedule" tap-floor on the Overview (state-dependent One-Thing anchor, untouched here). The lock sentence became **"Only a head coach changes this."** — §179 step C2 was walked with the earlier wording. 3,747/3,747 green after. `/simplify` not run (owner chose review → commit).
**Hub artifact:** `COACH_STAFF_DELEGATION_HUB.html` (Mockup · PM Brief · Full Plan · Decisions;
QA Walk tab added when the walk exists). **PM brief:** `COACH_STAFF_DELEGATION_PM_BRIEF.md`.
**QA:** Owner QA Ledger **§179** (next free number at writing). **Migration:** **none** — the grant
is one more key in the stored bundle, and an absent key resolves to off. **Builds on:**
`COACH_STAFF_ACCESS_PLAN.md` (pass 2, `a312c7a2`) — the list + sheet, four kinds, presets.

---

## 1. Problem — what the code does today

Staff management is head-coach-only at every layer, and there is no grant for it:

- **Nav door** — `lib/coach-nav-visibility.ts:224` `case 'Staff': return caps.isHeadCoach`.
- **Page gate** — `app/[orgSlug]/coaches/teams/[teamId]/staff/page.tsx:26,66-81` renders the list
  only for `isHeadCoach`; everyone else gets `CoachNotGranted` reading *"Only the head coach
  manages staff"*.
- **Every route** — `requireHeadCoachMembership()` (`lib/coach-membership.ts:184`) on the list
  read (`staff/route.ts`), the invite (`staff/invite/route.ts:22`), the member PATCH/DELETE
  (`staff/[coachId]/route.ts:26`) and the pending-invite verbs (`staff/invites/[inviteId]/route.ts:27`).
- **The grant model** — 13 keys in `AssistantCapabilityGrants` (`lib/coach-capabilities.ts`), none
  of them about staff.

So the only way a head coach can hand this duty to anyone is **Make head coach** (R8, pass 2) —
which also hands over money write, every family's contacts, tryouts, internal notes and the right to
demote or remove the head coach themselves. A team manager who should be inviting Saturday's parent
helper has to be made a full head coach to do it. Standalone Premium teams have no club admin to
fall back on.

## 2. The rules (owner-ruled where marked; the rest are the recommendation the owner accepted)

| # | Rule | Source |
|---|------|--------|
| **D1** | **Manage staff is a grant** — one switch on the staff sheet, **default off**, in the **Sensitive** group (it asks before granting, like money and contacts). | Owner 09-13 |
| **D2** | **The Team manager preset starts with it ON.** Assistant, Treasurer and Helper start OFF. Presets are starting bundles: **existing managers are not changed** — the head coach flips it for them. | Owner 09-13 |
| **D3** | **The ceiling: a delegate hands out only what they hold.** Everyday access (Schedule, Attendance, Lineups, Development, Staff chat, Scouting book, Documents) they may give freely — none of it is a data exposure. **Sensitive** access (Team money, Contacts & birthdates, Internal notes, Email families, Tryouts) they may **widen** only up to their own level. Keeping or lowering anything is always allowed. | Recommendation — closes the escalation the head-coach rule alone leaves open |
| **D4** | **Head coaches are untouchable, and roles stay head-only.** A delegate cannot edit, remove, demote or promote a head coach, cannot make anyone a head coach, and cannot make a head coach an assistant. Head-coach rows open read-only for them. Inviting already cannot create a head coach. | Owner 09-13 ("can never do anything to any head coach permissions") |
| **D5** | **A delegate cannot edit their own row** — it opens read-only ("ask a head coach"). Without this D3 is meaningless. | Recommendation |
| **D6** | **A delegate cannot CHANGE Manage staff — on or off.** Only a head coach hands out the master key (no chain delegation), and only a head coach takes it back (a delegate may remove the person under D7, which is louder and confirmed). ⚠ Built first as "must be off in anything a delegate writes"; `/review` found that refused EVERY save on a fellow manager's row (the sheet re-sends the whole bundle) and let a hand-built partial body knock a peer's key off — tightened to "unchanged" 2026-09-13. | Recommendation, tightened by /review |
| **D7** | **A delegate may remove any non-head member and manage any pending invite** (resend, cancel, change its starting access under D3). Removal is disruptive, not an exposure, and re-inviting reactivates the same membership. | Assumption — flip with one line if the owner wants removal head-only |
| **D8** | **A preset applied by a delegate is clamped, not refused.** Choosing "Team treasurer" for someone when the delegate holds Money: View sets Money to View, and the sheet says so on that control. Manage staff is always off in anything a delegate writes. | Recommendation — the sheet never sends a bundle the server would refuse |

**Widening test (the one rule the server runs):** for each Sensitive key, if `rank(next) >
rank(current)` then require `rank(next) <= rank(delegate[key])`; for `manageStaff`, `next` must be
unchanged from `current` (off for a new invite). Head-coach callers skip the whole check. `rank` is the sheet's existing `off 0 · view/read 1 ·
manage/write 2`, booleans 0/1 (`CoachStaffSheet.tsx:139-142`) — move it to the pure module so both
sides read one definition.

## 3. Model — `lib/coach-capabilities.ts`

- `AssistantCapabilityGrants.manageStaff?: boolean` · `CoachCapabilities.manageStaff: boolean`.
- `ASSISTANT_DEFAULTS.manageStaff = false` · `HEAD_COACH_ALL.manageStaff = true`.
- `STAFF_PRESETS`: `manager: true`, `assistant / treasurer / helper: false`. Comment block records
  D2 and the no-backfill decision (contrast R7, which widened existing assistants because
  practice-plan writing was a coaching duty already implied by "Schedule: View + edit"; this is the
  master key and is never widened by default).
- `canManageStaff(c) = c.isHeadCoach || c.manageStaff` — the one predicate the nav, the page, the
  header button and the route gate all read.
- `STAFF_KIND_COPY.manager.sentence` → *"Runs the team off the field — money, forms, family emails,
  the staff list. Not the lineup."* (invite email + sheet hint + dropdown subline all read this one
  string; check the email template's line length).
- `grantsFrom()` in the sheet returns `Required<AssistantCapabilityGrants>` — adding the key is a
  compile error until the sheet handles it (the property that made this safe last time).
- **No migration.** Grants are jsonb; a bundle without the key resolves to the default (false).
  Nothing to backfill, nothing for `check:migrations` to miss.

## 4. The pure rule — new `lib/coach-staff-delegation.ts`

Framework-free, unit-tested as a table, imported by the server AND the sheet:

```ts
export const SENSITIVE_KEYS = ['money', 'rosterPii', 'notes', 'announcementsSend', 'tryouts'] as const;
export function rank(v: unknown): number;                       // moved from CoachStaffSheet
export type DelegationViolation = { key: keyof AssistantCapabilityGrants; reason: 'above_ceiling' | 'manage_staff' };
/** null = allowed. `current` is null for a new invite (everything starts at off). */
export function delegationViolation(
  actor: CoachCapabilities,
  current: Required<AssistantCapabilityGrants> | null,
  next: Required<AssistantCapabilityGrants>,
): DelegationViolation | null;
/** The sheet's D8: the same bundle with every violating key pulled down to the actor's level / off. */
export function clampForDelegate(actor: CoachCapabilities, current, next): { grants; clamped: Array<keyof AssistantCapabilityGrants> };
/** D4 + D5 — which rows a non-head actor may open for editing. */
export function delegateMayEditRow(actor: { userId: string; isHeadCoach: boolean }, target: { userId: string; coachRole: string }): boolean;
```

Head-coach actors: `delegationViolation` returns null, `clampForDelegate` clamps nothing,
`delegateMayEditRow` is not consulted (the existing self-target refusal stays as it is).

## 5. Server

**`requireStaffManagerMembership(orgSlug, teamId, deniedMessage?)`** in `lib/coach-membership.ts`
beside `requireHeadCoachMembership` — same shape, gate is `canManageStaff(capabilities)`, default
message *"Managing staff isn’t turned on for you."* `requireHeadCoachMembership` stays for the
role-change branch and anything else that is genuinely head-only.

| Route | Today | After |
|---|---|---|
| `staff/route.ts` GET (list) | head only | staff manager |
| `staff/invite/route.ts` POST | head only | staff manager; body grants pass `delegationViolation(actor, null, grants)` → 403 with the key named; `manageStaff` forced false for a non-head actor even if the client omitted the check |
| `staff/[coachId]/route.ts` PATCH grants/kind | head only | staff manager; target head row → 403 for a non-head actor (`resolveHeadCoachTarget` gains the actor's caps; `allowHeadCoach` is honoured only when the actor is a head coach); self-target refused as today; `delegationViolation(actor, currentGrants, nextGrants)` → 403 |
| `staff/[coachId]/route.ts` PATCH `coachRole` | head only | **head only, unchanged** (D4) — the branch checks `isHeadCoach` explicitly before anything else |
| `staff/[coachId]/route.ts` DELETE | head only | staff manager for non-head targets; head target → 403 for a non-head actor (D7 + D4); last-head guard unchanged |
| `staff/invites/[inviteId]/route.ts` PATCH / DELETE / resend | head only | staff manager; PATCH grants run the widening test against the invite's stored `initial_capabilities` |

Refusals name the switch: `{ error: 'You can’t hand out Internal notes — you don’t hold it yourself.', key: 'notes' }`
so the sheet can highlight the control if a stale sheet ever sends one (the clamp should make this
unreachable by hand; it exists for the race and for a hand-built request).

`coach-staff-routes-guard.test.ts` promise 3 ("a pending invite is head-coach-only") is rewritten
to "staff-manager-gated on every verb, team-scoped" and gains promise 5: **every grant-writing
route calls `delegationViolation`**, and promise 6: **the `coachRole` branch checks `isHeadCoach`**.

## 6. Nav, page, header

- `coach-nav-visibility.ts` → `case 'Staff': return canManageStaff(caps)`. Both navs and the phone
  More sheet read the same table — nothing else to touch, but the visibility test gains the row.
- `staff/page.tsx` → gate on `canManageStaff`; the header's **Invite someone** button follows the
  same predicate (the page-actions guard test enumerates headers by occurrence — re-register). The
  not-granted block's copy becomes *"Managing staff isn’t turned on for you"* / *"Ask your head
  coach if you need it."* (the old headline would be false once a manager holds the page).
- The page passes the viewer's capabilities + userId down to the panel and the sheet (`viewer`
  prop) so the client can draw locks without a second request.

## 7. The sheet and the list — `CoachStaffSheet.tsx`, `CoachStaffPanel.tsx`

**New control, Sensitive group, last:**
`{ kind: 'switch', key: 'manageStaff', label: 'Manage staff', sensitive: true, sentence: 'Invite people and change what others can open — never more than they hold, never a head coach, never this switch.' }`
with `CONFIRM_ON_GRANT.manageStaff`:
*title* "Let {who} manage your staff?" · *message* "{who} will be able to invite people and change
what others can open — sensitive access only up to what they hold themselves. They can’t change any
head coach, change anyone’s role, or pass this switch on. You can take this back any time."

**Delegate mode** (viewer is not a head coach):
- A control the viewer may not widen renders **disabled with its reason under the sentence**:
  Sensitive keys above their level → *"You don’t hold this, so you can’t hand it out."*; Manage
  staff → *"Only a head coach changes this."* Lowering stays live (a seg control's lower options
  remain clickable; the higher ones are disabled individually).
- Applying a kind preset routes through `clampForDelegate`; each clamped control shows *"Stays at
  {level} — you can only hand out what you hold."* for one save cycle (D8).
- Footer: **Make head coach / Make assistant coach hidden**; **Remove from team** stays (D7).
- A **head-coach row** opens with the existing head note replaced for delegates: *"{Name} is a head
  coach. Only another head coach changes a head coach’s access or role."* — no controls, no footer
  buttons.
- The **viewer’s own row** opens read-only: *"This is your own access. Ask a head coach to change
  it."* The list's own-row action reads *"Your access ›"* (opens that sheet) instead of the head
  coach's "Hand over to someone else ›" disclosure.

**List:** `accessChips` adds `Manage staff` as a sensitive (amber, lock) chip; phone caps line
follows automatically. `rowNote` for the treasurer/helper unchanged.

**Admin oversight page** (`admin/rep-teams/assistant-coaches/page.tsx`): no gating change (club
admins are not coaches); if it lists grant chips, add the same chip so a club admin can see who holds
the key. Verify while building; not a design question.

## 8. Help (`/docs` pass, same unit of work)

- The coaching-staff article (`lib/help-content/coaches.tsx` ~4309): a Q on *"Can someone other
  than me manage the staff?"* — the switch, the ceiling in one sentence, what stays with the head
  coach. `keywords`/`searchText` gain "manage staff", "team manager invite", "delegate".
- ⚠ **Already stale before this work:** the older assistant-access article (~1611/1618) still says
  *"Each assistant has their own card with two groups"* and describes two schedule switches — the
  pass-2 list + sheet retired both. Fix it in the same pass rather than adding a third description.
- `grep -n "head coach only\|Only the head coach"` — 10 hits; the staff-related ones (1611, 1618,
  the staff-room article's "add or remove an assistant there") are re-read; tryout/blind-mode ones
  are unrelated and stay.
- `check:spelling` runs on the new strings.

## 9. Demo sandboxes

The coach sandbox has one head coach and no staff rows (`lib/demo-coach.ts:49`), and no dock line or
tour step narrates the Staff page — **nothing goes stale**. The standing recommendation (pass 2,
not built: seed one assistant + one pending invite, ask first) would now naturally seed a **Team
manager** row wearing the Manage staff chip, which is a stronger story than an assistant. Still ask
first; not part of this build.

## 10. Tests

- `coach-capabilities.test.ts` — defaults/head/resolve carry the key; `canManageStaff`.
- `coach-staff-kinds.test.ts` / `coach-helper-preset.test.ts` — manager preset ON, the other three OFF.
- **new** `coach-staff-delegation.test.ts` — table over `delegationViolation` (widen within
  ceiling ok · widen above → key · lower above-ceiling grant ok · manageStaff true → violation ·
  head actor → null · new invite with `current: null`), `clampForDelegate` (returns the clamped
  keys), `delegateMayEditRow` (head target no, self no, assistant yes).
- `coach-nav-visibility` test — Staff opens for `manageStaff` without `isHeadCoach`; closed for the
  treasurer/helper presets.
- `coach-page-actions-guard.test.ts` — re-register the staff page's header occurrence(s).
- `coach-staff-routes-guard.test.ts` — promises rewritten/added per §5.
- Layout: `npm run check:layout -- --only=staff` after; the layout sweep still has no
  assistant-session baseline (known gap, unchanged).

## 11. Gates and sequence

One pass, one commit, no migration. Order: model → pure rule + tests → server → nav/page → sheet/list
→ help → `/simplify` (new pure module + a new sheet mode = the shape that warrants it) → `/review` →
QA §179 walk as the hub's QA Walk tab → commit on `dev` with explicit pathspecs. `npm run typecheck`
(shared module changed) + `verify:changed`; restart the dev server before handoff (new file).

## 12. QA §179 — parts (walk drawn when built; identities pinned, never figures)

- **A · The switch (as head coach, UAT team):** the Sensitive group ends with Manage staff; granting
  it asks; the row's chip appears amber; revoking is instant and silent.
- **B · The manager's page:** sign in as the granted manager → Staff appears in Team (desktop, phone
  bar, More sheet); the list shows every row incl. the head coach and themselves; Invite someone is
  in the header.
- **C · The ceiling:** on the assistant's row, Internal notes and Tryouts are locked with the reason;
  Team money is live (manager holds write); choose Helper preset → applies; choose Treasurer preset →
  applies within ceiling; Manage staff locked. Footer has Remove, no Make head coach.
- **D · The walls:** open the head coach's row → read-only note; open own row → read-only note;
  a hand-built PATCH making the head coach an assistant → 403; a hand-built invite with
  `manageStaff: true` → 403 naming the key.
- **E · Everyone else:** the treasurer/helper still have no Staff door; the not-granted copy reads
  the new sentence.

## 13. Out of scope / follow-ups flagged

- **No audit trail on access changes** — true today too, but with two people able to edit access,
  *"who turned on Money for Marcus?"* has no answer. Proposed follow-up: a "changed by {name},
  {date}" line on the sheet from the existing membership `updated_by`/`updated_at` if present, else
  a small history table. Not built here; raised for the owner (Decisions tab, Proposed).
- Chain delegation (D6 forbids it) — revisit only if a real team asks.
- A per-team "only head coaches manage staff" lock — unnecessary; the default-off switch is that lock.
- Two head coaches, hand-over, last-head guard — unchanged from pass 2.
