# Availability & RSVP — Implementation Plan

**Status:** Proposed (not started) — **rewritten 2026-11-08 to the app channel** (Signed-in family accounts Stage 4a closeout, build prompt
Part 9.6). The emailed-link door this plan first described is **removed and ruled out** (owner 2026-10-31, `BUSINESS_DECISIONS.md` "A family
gets an account when their child is PLACED ON A TEAM…" point 4): a parent replies In / Out / Maybe **inside the signed-in family page**, and
nowhere else. This is **Stage 4b** of `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md`. **Not buildable yet:** the parent's sheet is drawn (4b sheet in
`SIGNED_IN_FAMILY_STAGE4_DRAWINGS.html`), the **coach's headcount is not** — 4b needs its own drawing session (the coach's per-event chip, the
drawer lane, the nudge, the lineup tag) before a build prompt is written.
**Date:** 2026-08-03 · rewritten 2026-11-08
**Tier:** Premium coaches portal (rep teams) — and, once drawn, any team whose children have a connected parent. Riding the family layer, which
is switched on per club/team and, for the signed-in app, by `GUARDIAN_TIER_ENABLED` (OFF until the owner turns it on).
**PM brief:** `COACH_AVAILABILITY_RSVP_PM_BRIEF.md`

---

## 1. What this is

Parents answer **In / Out / Maybe** (and an optional short note) for each upcoming event, from their signed-in family page. The coach sees a
per-event headcount, nudges the silent families, and the attendance book and lineup builder consume the answers. Closes the loop that exists
half-built today: coaches can already pencil per-player statuses into the schedule's RSVP editor, but every answer is coach-entered secondhand.

### The governing constraints (verified 2026-11-08)

1. **`rep_team_event_attendance` is coach-set only, by documented design** ("there is NO player/guardian self-RSVP", DATA_DICTIONARY gotcha).
   Its status enum (`unknown|attending|absent|late`) has no `maybe` and is consumed by reliability stats, lineup pools and drift warnings. **We do
   not touch it.** Parent answers land in a NEW, separate response record; the coach's attendance book remains the authoritative record,
   *pre-filled* with one tap, never silently overwritten.
2. **There is one door: the signed-in family page** (Stage 4a built it). A parent reaches an event only through a verified connection to a child
   who is live on that team (`getFamilyReach`); no team, event or child id from the client is trusted. **No emailed link, no no-login page, no
   token** (owner ruling 2026-10-31; "no new no-login family door", Stage 4 standing rule). An email may *tell* a parent to open the app; it never
   carries the answer.
3. **No chat** (Stage 4 ruling 1): the optional note is a one-line field on the answer, not a conversation. Nothing the parent types goes to
   other families.
4. **A parent never sees teammates** (Stage 4 guard g): the answer control names the parent's own children only; no roll-up of who else said
   what reaches a family payload.

---

## 2. Existing foundations (verified; re-verify at build)

| Piece | Where | Role here |
|---|---|---|
| The family page | `app/(consumer)/family/teams/[teamId]` (`FamilyTeamClient`), read by `lib/family-home.ts` / `lib/family-team-schedule.ts` | Schedule rows already render for both rep and house-league teams; the In/Out/Maybe control lives here |
| A parent's reach | `lib/family-access.ts` `getFamilyReach` | The only authority for "which of this account's children are on this event's team" |
| Coach-side RSVP editor | `schedule/page.tsx` attendance tab (`ATTENDANCE_OPTIONS`, `.rsvpEditor`, warm RSVP palette TH-5) | The coach's book; gains a "family answers" lane + Accept-all |
| Attendance model | `rep_team_event_attendance` + batch PATCH route | Untouched; pre-fill writes go through the existing PATCH |
| Lineup ↔ attendance drift warning | `schedule/page.tsx` | Extended to read family responses ("2 marked Out since you built this lineup") |
| Family email chokepoint | `lib/family-email.ts` `sendFamilyEmail` | Any nudge email routes through this; raw `sendEmail` is forbidden here |
| Family notify | `lib/family-notify.ts` (bell + email, no push) | New kinds ride the same rail |
| Bulk reminder precedent | dues `send-reminders` / `remind-unpaid` routes | Template for "Nudge non-responders" |
| House league | a house-league child's team reads the coach calendar's reader (`readCoachFeedEvents`) | Whether house-league coaches get a headcount is a 4b drawing question, not assumed here |

---

## 3. Design

### 3.1 The response record (new, small)

```
rep_event_availability_responses            -- name to settle at build; house-league events need their own event key
  id uuid PK
  event_id FK                               |  child_id FK org_children   -- the CHILD, as the connection is (Stage 4 ruling 3)
  UNIQUE(event_id, child_id)                -- latest answer wins, updated in place
  answer text CHECK in|out|maybe
  note text ≤200 (app-enforced; "leaving early", "arriving 6:15")
  responded_via text CHECK family_app|coach
  responder_user_id uuid                    -- the signed-in account that answered; display label derived, never stored as a name
  updated_at / created_at
```

- Distinct from attendance on purpose; nothing downstream consumes it implicitly.
- `responded_via='coach'` covers the coach logging a phone call without masquerading as the family.
- There is **no `email_token` channel and no `family_link_id` nullability trick**: every family answer carries the account that gave it.
- Either connected parent may answer for a child; latest write wins, and the coach's lane shows who answered and when. Neither parent can clear the
  other's connection (ruling 7), and an answer is not a connection.

### 3.2 The parent's sheet (drawn: 4b sheet)

On the team page, each upcoming event row gains **In / Out / Maybe** for each of the account's children on that team, and a one-line note.
Changing an answer is allowed until the event starts; a cancelled event shows no control. A parent whose connection ended (left, removed, a stop)
sees nothing and a stale tab's write is refused (the server re-derives reach on every write). Rep teams: the existing premium family-layer gate
applies. A house-league team has no "From the coach" card; whether it gets the control is decided in the 4b drawing.

### 3.3 Coach surfaces (NOT DRAWN — needs the 4b drawing session)

Carried forward from the first draft as the starting point for that session, not as decisions:
- **Schedule list rows:** a headcount chip per upcoming event (`9 in · 2 out · 1 maybe · 3 ?`), escalating when `in` is below a sport-aware floor.
- **Event drawer, attendance tab:** each player row shows the family answer, note and who/when under the coach's own status pills; one-tap **Accept**
  per row and **Accept all answers** (in→attending, out→absent, maybe→untouched) through the existing batch PATCH. Drift badge when they disagree.
- **Nudge non-responders:** one button, bulk, per-event rate limit (1 per 24 hours), suppression-aware, an honest send report ("3 nudged, 1
  unreachable"). The nudge is an email or bell that says "open the app to answer"; it carries no answer link. Which address gets it follows Stage 4's
  rule: only a connected account's own address, or an address on the child's sign-up.
- **Lineup builder:** a child whose family said Out goes to the same "Not playing" pool attendance-absent players do, tagged "family said Out"; Maybe
  renders an amber dot.

### 3.4 Asking & reminding

v1: a coach-pressed button per event (and an optional "ask for availability" at event creation). A weekly automatic digest is a later phase on the
existing scheduled-jobs rail, to keep send volume owner-controlled while the feature beds in.

### 3.5 Notifications to the coach

New `family_availability_response` event type (bell-only by default, digest-friendly): fires on `out` answers and on answer changes within 48 hours
of the event, never on a routine "in".

---

## 4. What we deliberately do NOT do

- **No emailed answer link, no no-login response page, no token of any kind** (ruled out; this plan used to build exactly that).
- No writes to `rep_team_event_attendance` from families, ever — pre-fill is coach-tapped.
- No `maybe` added to the attendance enum.
- No push to families (delivery unproven); bell and email only.
- No chat or free conversation; the note is one line on the answer.
- No roll-up of other families' answers in any family payload.
- Live-season-only, like the whole family layer: no archive allow-list entry; archived seasons show no availability UI.

## 5. API surface (shape only; fixed after the drawing)

- `GET .../events/[eventId]/availability` (coach: responses + roll-up; caps: `attendance`)
- `POST .../events/[eventId]/availability/request` + `/nudge` (caps: `attendance`; recipients resolved server-side, addresses never returned to a
  non-`rosterPii` caller)
- `POST /api/family/teams/[teamId]/events/[eventId]/availability` — **the only parent write**: signed in, tier on (404 otherwise), the child and team
  re-derived from `getFamilyReach`, one answer per child per event.
- Roll-up joined into the existing schedule events read (one aggregate per upcoming event, no N+1).

## 6. Phases (after the 4b drawing)

- **P1 — Response spine + the parent's sheet + coach book:** table/migration (+ dictionary + snapshots), the family-page control, the coach's
  chips and drawer lane with Accept / Accept-all, drift badges, coach notification.
- **P2 — Lineup integration + nudges:** lineup pool/tag, nudge flow with rate limit and honest send report, event-creation toggle.
- **P3 — Reach:** weekly digest job, account-notifications row for response events.

## 7. QA / verification

- Unit: answer upsert idempotency; reach re-derived on every write (a left, removed or stopped parent is refused); accept-mapping as a pure
  function; nudge recipient resolution (suppression, rate limit, no address leakage); roll-up aggregation; **a guard that no family payload carries a
  teammate's answer** and that the control is absent with the tier off.
- Existing contracts that must stay green: attendance PATCH batch validation; family email fail-closed on opt-out lookup error; the Stage 4a family
  guards (tier off = nothing changes; no roster in a family payload).
- `npm run typecheck` (shared modules: types registry, notify labels).
- Owner QA: full loop on a real phone — coach asks → parent answers Out with a note in the app → chip updates → accept-all → lineup shows "Not playing
  (family said Out)" → nudge the silent family → opt-out honoured on the next send.

## 8. Rollout

Ships dark: the family-page control exists only with the guardian tier on, and the coach side behind a per-team toggle ("Availability requests")
defaulting OFF; the owner flips personal teams first.

## 9. Open questions (owner)

1. **4b drawing session:** the coach's chips, drawer lane, nudge and lineup tag are undrawn; draw them before a build prompt is written.
2. Do house-league teams get the control and a coach headcount (the house-league coach's page is deliberately unchanged in 4a)?
3. Should practices default to auto-ask on create while games stay manual?
4. Sport-aware "enough players" floor: `fieldPositions.length` as the red-chip threshold, or coach-configurable?
5. When two connected parents answer differently for one child, is "latest wins" enough, or should the coach's lane show both?
