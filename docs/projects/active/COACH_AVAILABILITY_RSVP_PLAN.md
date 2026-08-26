# Availability & RSVP — Implementation Plan

**Status:** Proposed (not started)
**Date:** 2026-08-03
**Tier:** Premium coaches portal only — rides the family layer, which is per-team entitlement-gated
(`isFamilyLayerEnabled` → `team_entitlements`), re-checked every request
**PM brief:** `COACH_AVAILABILITY_RSVP_PM_BRIEF.md`
**Mockup:** Claude Artifact "Availability & RSVP" (see PM brief)

---

## 1. What this is

Families answer **In / Out / Maybe** for each upcoming event; the coach sees a per-event headcount
roll-up, nudges non-responders in one tap, and the attendance book + lineup builder consume the
answers. Closes the loop that exists half-built today: coaches can already pencil per-player
statuses into the schedule's RSVP editor, but every answer is coach-entered secondhand.

### The two governing constraints (verified 2026-08-03)

1. **`rep_team_event_attendance` is coach-set only — by documented design** ("there is NO
   player/guardian self-RSVP", DATA_DICTIONARY gotcha). Its status enum (`unknown|attending|
   absent|late`) has no `maybe` and is consumed by reliability stats, lineup pools, and drift
   warnings. **We do not touch it.** Family answers land in a NEW, separate response record;
   the coach's attendance book remains the authoritative record, *pre-filled* from responses
   with one tap, never silently overwritten. (Same philosophy as Game-Day Mode vs D4: one
   authoritative record, new signals feed it rather than fork it.)
2. **The guardian tier (per-child family links) is OFF pending PIPEDA/CASL counsel**
   (`GUARDIAN_TIER_ENABLED`, server-side env flag; consent copy is placeholder). The live
   follower tier structurally carries NO player linkage (`player_id` always NULL, DB CHECK).
   Per-child RSVP therefore cannot ride the live follower tier. Two response channels solve
   this without waiting on counsel for v1 — see §3.

---

## 2. Existing foundations (verified)

| Piece | Where | Role here |
|---|---|---|
| Coach-side RSVP editor | `schedule/page.tsx` attendance tab (`ATTENDANCE_OPTIONS`, `.rsvpEditor`, ratified warm RSVP palette TH-5 already in `coaches.module.css`) | The coach's book; gains a "family answers" lane + Accept-all |
| Attendance model | `rep_team_event_attendance` + batch PATCH route | Untouched; pre-fill writes go through the existing PATCH |
| Lineup ↔ attendance drift warning | `schedule/page.tsx` (~543, 1218) + absent-players-excluded pool (~884) | Extended to read family responses ("2 marked Out since you built this lineup") |
| Tokenized no-login response flow | ⚠ **DELETED 2026-08-26 — read it from git history, not from the tree.** `app/tryout-response/[token]/*` was the template (GET read-only / email-scanner-safe, POST on explicit tap, data-minimized `lastInitial()`, terminal states, coach `notify()` on response) and it is gone: tryout decision emails were removed entirely by owner ruling, and the reply token only ever travelled inside the offer email. The PATTERN is still the right one to copy — `lib/no-login-token.ts` and `lib/tryout-evaluator-token.ts` are the surviving live examples. | **The architectural template for email RSVP (recover from git, or copy the evaluator-token flow)** |
| Family authenticated surface | `app/(consumer)/family/teams/[teamId]` (`FamilyTeamClient`) — session-based after link verification; schedule rows already rendered | In-app response buttons (guardian tier, when enabled) |
| Family email chokepoint | `lib/family-email.ts` `sendFamilyEmail` — org-wide `family_email_optouts` suppression (fail-closed), unsubscribe footer | ALL RSVP emails route through this; raw `sendEmail` is forbidden here |
| Family notify | `lib/family-notify.ts` (bell + email, **no push** — VAPID delivery unverified, G9) | New kinds ride the same rail |
| Bulk reminder precedent | dues `send-reminders` / `remind-unpaid` routes (bounded concurrency, suppression-aware) | Template for "Nudge non-responders" |
| CASL posture | Tryout CASL unbundling (2026-07-30): transactional ≠ marketing | RSVP requests/nudges are transactional — grounded in the existing team relationship; still optout-suppressed |
| Guardian contact data | `rep_roster_players` guardian email/phone (`rosterPii`-gated) | Recipient source for email RSVP |

---

## 3. Design

### 3.1 The response record (new, small)

```
rep_event_availability_responses
  id uuid PK
  event_id FK rep_team_events  |  player_id FK rep_roster_players
  UNIQUE(event_id, player_id)  -- latest answer wins, updated in place
  answer text CHECK in|out|maybe
  note text ≤200 (app-enforced; "leaving early", "arriving 6:15")
  responded_via text CHECK email_token|family_portal|coach
  responder_label text          -- e.g. "Jordan (guardian)" — display only
  family_link_id FK nullable    -- set when answered via the family portal
  updated_at / created_at
```

- Distinct from attendance on purpose; nothing downstream consumes it implicitly. Reliability
  stats, lineup pools, wrapped etc. keep reading attendance only.
- `responded_via='coach'` covers the coach logging a phone call ("their dad texted me") without
  masquerading as the family.

### 3.2 Channel A — email token (v1, no counsel dependency)

Per event (games + practices), the coach (or the weekly digest job, §3.5) sends each rostered
player's guardian email(s) a request through `sendFamilyEmail`. The link opens
`/availability/[token]` — same skeleton as the (now deleted, see the table above) `tryout-response/[token]`:

- Token: per (event, player, email) — hashed at rest, expiry = event end. GET renders event
  card (name, date/time, location, arrival time, uniform) + child **first name + last initial
  only** + three big buttons; POST records the answer. Terminal states: answered (editable
  until event start), event cancelled, expired, invalid.
- Data exposure is a *narrower* slice than the tryout-response precedent shipped (that flow was retired 2026-08-26; the comparison still holds against what it did)
  (that page shows tryout context to a no-login visitor). No roster, no other children, no
  standing access — deliberately not a "guardian tier by the back door": nothing persists
  beyond the single event response, and no consent ledger entry is needed because no standing
  per-child access is created. **Flag to counsel packet as an FYI item anyway** (§9).
- Lawful basis: transactional service message about the family's own enrolled child's team
  event (the same basis as `family_game_update`); never gated on marketing consent; always
  suppressed by `family_email_optouts`.

### 3.3 Channel B — family portal (in-app; guardian tier turns it on)

`FamilyTeamClient` schedule rows gain the In/Out/Maybe control for the linked child when
`resolveGuardianPayloadForLink` returns a payload — i.e. **automatically dormant until
`GUARDIAN_TIER_ENABLED` flips**, zero extra gating for us to build. Followers never see the
control (no player linkage). The two channels share the response table; latest write wins.

### 3.4 Coach surfaces

- **Schedule list rows:** headcount chip per upcoming event — `9 in · 2 out · 1 maybe · 3 ?`
  (warm palette: olive/live/amber, `--font-data`). Chip color escalates when `in < a
  sport-aware floor` (fieldPositions count, e.g. 9 for softball) as the event nears.
- **Event drawer, attendance tab:** each player row shows the family answer + note + who/when
  under the existing coach status pills. One-tap **Accept** per row and **Accept all answers**
  (maps in→attending, out→absent, maybe→untouched) writing through the existing batch PATCH —
  the coach's tap is the authoritative act. Drift badge: family answer contradicting coach
  status ("marked In by family, you have Absent").
- **Nudge non-responders:** one button in the drawer (and on the chip's popover) → bulk send to
  guardians of unanswered players via the dues-reminder pattern; per-event rate-limit (1/24h);
  respects suppression; coach sees "3 nudged, 1 unreachable (unsubscribed)" honestly.
- **Lineup builder:** players with `out` get the same treatment attendance-absent players get
  today (moved to "Not playing" pool at load, with a "family said Out" tag); `maybe` renders an
  amber dot on the player chip. Extends the existing drift-badge computation.

### 3.5 Asking & reminding (automation kept modest)

v1: RSVP requests are sent per-event by the coach (button in the event drawer + optional
"request availability" checkbox at event creation). A weekly automatic digest ("your week:
3 events, tap to answer each") is **phase 3** and joins the existing scheduled-jobs wiring —
not v1, to keep the send volume owner-controlled while the feature beds in.

### 3.6 Notifications to the coach

New `family_availability_response` event type (registry: `NotificationEventType`,
labels, `NOTIFICATION_CATEGORY: 'know'`) — bell-only by default, digest-friendly: fires on
`out` answers and on answer *changes* within 48h of the event (the ones a coach must act on),
never on every routine "in".

---

## 4. What we deliberately do NOT do

- No writes to `rep_team_event_attendance` from families, ever — pre-fill is coach-tapped.
- No `maybe` added to the attendance enum.
- No push to families (delivery unproven — G9); bell only where a family account exists, email
  otherwise.
- No standing family access minted by the email token; no roster exposure on the token page.
- Live-season-only, like the whole family layer: routes never join `resolveCoachSeasonRead`,
  never added to the archive allow-lists. Archived seasons show no availability UI.

## 5. API surface

- `GET .../events/[eventId]/availability` (coach: responses + roll-up; caps: `attendance`)
- `POST .../events/[eventId]/availability/request` + `/nudge` (caps: `attendance`; nudge
  requires nothing beyond it — recipients resolved server-side, addresses never returned to
  a non-`rosterPii` caller)
- `GET/POST /api/availability/[token]` (public, no-login; mirrors the tryout-response hardening — recover that route from git history, it is no longer in the tree)
- `POST /api/family/teams/[teamId]/events/[eventId]/availability` (guardian session channel,
  dormant until tier enabled)
- Roll-up joined into the existing schedule events read (one aggregate per upcoming event, no
  N+1).

## 6. Phases

- **P1 — Response spine + coach book:** table/migration (+ dictionary + snapshots), token
  channel end-to-end (request button → email → answer page → response lands), schedule
  headcount chips, drawer answers lane + Accept/Accept-all, drift badges, coach notification.
- **P2 — Lineup integration + nudges:** lineup pool/tag integration, nudge flow with
  rate-limit + honest send report, event-creation "request availability" toggle.
- **P3 — Reach:** weekly digest job (scheduled-jobs rail), guardian-tier in-app channel QA
  (behind the flag), account-notifications row for response events.

## 7. QA / verification

- Unit: token lifecycle states; answer-upsert idempotency; accept-mapping (in/out/maybe →
  attendance) as a pure function; nudge recipient resolution (suppression, rate-limit, no
  address leakage in responses); roll-up aggregation.
- Existing contracts that must stay green: attendance PATCH batch validation; family email
  fail-closed on optout lookup error; follower DTO carries no player field (structural).
- `npm run typecheck` (shared modules: types registry, notify labels).
- Owner QA: full loop on a real phone — request → email → answer Out with note → chip updates
  → accept-all → lineup shows "Not playing (family said Out)" → nudge the silent family →
  unsubscribe link honored on the next send.

## 8. Rollout

P1 ships dark behind a per-team toggle in the family-access panel ("Availability requests")
defaulting OFF; owner flips personal teams first (same pattern as other family-layer betas).

## 9. Open questions (owner)

1. **Counsel FYI:** confirm the per-event token page (child first name + last initial to a
   no-login visitor holding the emailed link) is fine to ship ahead of the guardian-tier
   ruling — it follows the tryout-response precedent and creates no standing access. If
   counsel says wait, P1 ships coach-book + in-app channel only, dormant until the flag.
2. Should practices default to auto-request-on-create while games stay manual (practices are
   where headcount planning hurts most)?
3. Sport-aware "enough players" floor: `fieldPositions.length` as the red-chip threshold, or
   coach-configurable?
