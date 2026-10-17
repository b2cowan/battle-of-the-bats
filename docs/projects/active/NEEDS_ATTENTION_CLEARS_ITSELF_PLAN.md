# Needs attention clears itself — plan

**Origin:** Owner QA §322 (Club Tier Stage 11d part B), 2026-10-16, before W2. The owner opened the bell for an ask
that had been accepted an hour earlier and pressed **Open**: the drawer closed, the same page reloaded, and the only
sign was a fading three-way-guess note. *"That is not desirable ux."* Read on dev: **1 of the owner's 10 Needs-attention
rows was still waiting.** The other nine had been accepted, declined or withdrawn — and each stayed until its reader
pressed Done, as did the admin's and treasurer's copies.

**PM brief:** `NEEDS_ATTENTION_CLEARS_ITSELF_PM_BRIEF.md`. **Ledger:** §322, "Found before W2". **Hub:** https://claude.ai/artifact/Cv4TBP7XMMXnG4ZWVHB6J9 (Mockup · PM Brief · Plan; Stage 2 drawn 2026-10-16 v1, after its /design pass D1–D5).

## 1. Rulings (owner, 2026-10-16)

1. **A Needs-attention notification clears itself, for everyone it went to, once the thing it asks about stops waiting
   — ALL Needs-attention kinds.** Chosen over "hand-back asks now, the rest later" and "only the landing".
2. **"Team marked no-show" clears when the team is checked in after all, the no-show is undone, or the tournament
   ends.** New notices record their team. *Correction made after the ruling:* the option said older ones "clear only
   when the tournament ends", but older notices record no tournament either. Honoured by reading the club's
   tournaments that were running on the notice's date: an old notice clears once every one of them has ended.
3. **The four retired kinds leave Needs attention, and old ones still pinned are cleared** — score disputed, coach
   access requested, roster change requested, tryout offer response (nothing has sent them for months).
4. **Opening something already handled says exactly what happened — drawn first** for the owner's approval (Stage 2).
5. **Who receives them is fixed in this build** (the owner chose this over "separate fix, next"): "card payment
   failed", "assistant coach waiting for approval" and "team marked no-show" go today to every active member of the
   club, coaches included, and a coach's bell lists them.

Not ruled, and not to be added on the way past: anything about **'know'** (news) notifications; a "Handled" label
in the list (Stage 2's drawing proposes it, the owner rules it there); push or email behaviour.

### 1b. Stage 2 rulings (owner, 2026-10-16, the hub's paste-back — all six as recommended)

- **A1** the hint beside the count reads **"clears when it’s handled"** (was "stays until you mark it Done").
- **A2** the settled line **as drawn**: under a hairline, a check, the outcome in bold with who ("You" when it was you) and when (the stamp's own spelling, "Fri, Oct 16 · 5:10 p.m."), and what it did to the money on a second line where money moved.
- **A3** the onward button on a settled one: **no button when the record is gone, and never the page you are on**; otherwise it names the page and lands on the record (the 2026-10-05 D4 rule, which today's bare "Open" on an ask missed).
- **A4** **no mark** on settled rows under All; the line in the reader is the only place it says so.
- **A5** the doors keep **the same fading note, saying the exact outcome** from the record.
- **A6** **the words approved as drafted** (section 8 of the hub, after /design's D4); /marketing polishes at build.

## 2. The census (2026-10-16, read-only, three passes + spot checks)

Every 'act' kind in `NOTIFICATION_CATEGORY`. "Key" is what the notification already carries that names its record;
"who/when" is what the record keeps for Stage 2's sentence.

| Kind | Plain name | Key | Still waiting while | Settled by | Who/when kept |
|---|---|---|---|---|---|
| `club_hand_back_asked` | A team asks for money back for time it hands back | `metadata.handBackId` | `club_schedule_hand_backs.state = 'waiting'` | accept · decline (either page) · withdraw · the daily sweep lapses it | `closed_by`, `closed_at` |
| `club_hand_back_unasked` | Handed back without asking for money (to the team's money people) | `metadata.handBackId` | state `landed`, no late ask over it (`late_for`), a handed-back Sunday still to come | a late ask · take it back · its Sundays pass | the late ask's `asked_by`/`asked_at` |
| `team_request_filed` | Coach filed a payment request | `metadata.requestId` | `rep_team_payment_requests.status` in pending/accepted | approve · decline · the coach withdraws (row DELETED) | `reviewed_by`, `reviewed_at` |
| `team_money_sent` | Coach says "I sent the payment" | `metadata.installmentId` | `sent_at` set and `paid_at` null | the club records it received · the coach takes it back | `paid_by`, `paid_at` |
| `team_request_holding_payout` | Requests holding a coach's payout | `metadata.requestIds[]` (plural) | ANY of them still pending/accepted | each request settled as above | per request |
| `club_schedule_review` | Schedule sent for review | `metadata.scheduleId` + `teamId` | schedule `in_review` and the team has no reply on the latest review send | the team replies (one head coach for all its staff) · finalize · delete | `replied_by`/`replied_at`; `finalized_by`/`finalized_at` |
| `team_move_requested` | Team move request (club ↔ coach) | `metadata.linkId` | `team_org_links.status = 'ownership_pending'` | approve · decline · withdraw · another move approved | `approved_by_*`, `updated_at` |
| `assistant_coach_approval_requested` | Assistant coach waiting for approval | `metadata.inviteId` | `assistant_invite_tokens.status = 'pending_approval'` | approve · decline · the head coach cancels · a new invite replaces it | status only |
| `team_coach_payment_reminder` | Free coach's payment reminder | `metadata.registrationId` | accepted team with an amount still due (`reminderAmountDue`) | paid in full (part-payment keeps it) · team not accepted · deleted | `payment_status` only |
| `payment_failed` | The club's card payment failed | none — the org (`org_id`) | `organizations.subscription_status = 'past_due'` | Stripe success · subscription updated · cancel · plan changes · platform admin | none |
| `team_no_show` | Team marked no-show | **none today** (team name in prose only) | `teams.check_in_status = 'no_show'` and the tournament not over | checked in · undo · team deleted · tournament ends | none |
| `score_disputed` · `coach_access_requested` · `roster_change_requested` · `tryout_offer_response` | retired | — | — | nothing sends them | — |

**What Open does today on a settled one:** the schedule's `?answer=` door shows a fading note that guesses
("answered, withdrawn, or its Sundays have passed"); Payment requests' `?request=` on a withdrawn (deleted) request
opens nothing, silently; the team-move pages, the check-in page, the team overview and the billing page show the
record's current state with no word about the notification.

**Side facts found:** `notify()` with no `userIds` sends to every active `organization_members` row (any role; a
tournament filter applies to `staff` only). The bell's default is ON for every role. A paid coach's strip reads every
row of that club for them (`lib/notification-bell-scope.ts`). That is how a club's billing failure reaches a coach.

## 3. Design — Stage 1 (ruled; no new screens)

### 3.1 One registry, total over the 'act' kinds
A new module (`lib/needs-attention.ts`) holds `NEEDS_ATTENTION_END`: a `Record` over every 'act' event type, each
either **a settle check** (given a batch of notification rows → for each, still waiting or not) or **`'retired'`**.
Typed like `NOTIFICATION_CATEGORY`: a new 'act' kind fails typecheck until it says how it ends. A unit test holds
the same (every 'act' kind has an entry; every entry is an 'act' kind).

### 3.2 Two moments a row is cleared
- **On the spot** — the common settle actions call one helper, `clearSettled(org, kind, ids)`, after their write
  lands: hand-back accept/decline/withdraw; request approve/decline/withdraw; installment received/taken back; team
  move approve/decline/withdraw; invite approve/decline/cancel/replace; schedule reply/finalize/delete; check-in
  check in/undo; the billing webhook's recovery. Fire-and-forget, like `notify()` — a failed clear never fails the
  action (the next read catches it).
- **On read (the safety net)** — when the bell's list or the Notifications page loads, the server runs the registry
  over that reader's uncleared 'act' rows, clears every one no longer waiting, and returns the list with them cleared (out of Needs attention, still under All).
  This catches every path the first moment does not: the daily sweep's lapses, time passing (Sundays started, a
  tournament ended), a deleted record, a fee change, an RPC called from somewhere new, and every stale row that
  exists today. Batched: one query per kind present, by ids — a reader's uncleared 'act' rows are a handful.
- **The daily sweep is not touched.** It is watched automation, and the read-time net already covers what it lapses.

### 3.3 What "cleared by the platform" writes
`cleared_at = now()` and `read_at = coalesce(read_at, now())` — a settled item stops counting toward the bell's
number. No new column: whether a cleared row was settled or Done by hand is answered live by the registry when
Stage 2's reader needs it.

### 3.4 The index
The on-the-spot clear finds every recipient's copy by org + kind + key. Today's indexes are `(org_id, created_at)`
and `(user_id, created_at) WHERE read_at IS NULL`. Add `notifications (org_id, event_type) WHERE cleared_at IS NULL`.
Migration + DATA_DICTIONARY + snapshots in the same unit of work.

### 3.5 No-show (ruling 2)
The check-in route's notice gains `metadata { teamId, tournamentId }`. Settled when the team's `check_in_status`
leaves `no_show`, the team is gone, or the tournament has ended (its `end_date` before today in the club's zone, or
its status says it is over). An old notice (no metadata): settled once every tournament of that club that was running
on the notice's date has ended.

### 3.6 The retired four (ruling 3)
They move from `'act'` to `'retired'` in the registry and out of the Needs-attention zone. A data-only migration
clears every uncleared row of those four kinds (dev + prod). Their labels stay so an old row still reads.

### 3.7 Who receives them (ruling 5) — whoever can act, read from the action's own check
- **Card payment failed** → the club's **owners** (billing is owner-only: `app/api/billing/*` "owner-only"). Today
  admins also get its email by default; they cannot act on it, so they stop receiving it. ⚠ Visible change — named
  in the brief.
- **Assistant coach waiting for approval** → members holding **Rep Teams** (`module_rep_teams`) whose group scope
  covers the team — the same check the approve route makes.
- **Team marked no-show** → members who **run check-in** for that tournament (`canGate` + the tournament scope) —
  the same check the check-in route makes.
Each writer passes explicit `userIds`; `notify()`'s fall-back is unchanged (the wider recipient ticket in TODO.md,
"Notification engine — recipient-scoping fixes", keeps the rest).

## 4. Stage 2 — a settled notification says what happened (DRAWN FIRST)

To be drawn on the hub and ruled before building. The proposal:
- The reader (the drawer's pane, the phone's sheet, the Notifications page) for an 'act' row asks the registry and,
  when settled, says so in one line: the outcome, who, when — "Accepted by Morgan Ellis · Oct 16, 5:06 p.m." — as far
  as the record keeps them (§2's last column); only the outcome where it keeps neither.
- Open goes where the record lives (the request in Payment requests, the team's bill) — absent when the record is
  gone. Never a reload of the page the reader is on.
- The page doors that read an id (`?answer=`, `?request=`) say the specific outcome instead of guessing, and a
  deleted request says it was withdrawn rather than opening nothing.
- Whether the All list marks settled rows: an ask for the owner.

## 5. Stages

| Stage | Covers | Asks | State |
|---|---|---|---|
| 1 | Self-clearing (10 kinds + no-show), the retired four, who receives the three, the guard, the index | A1 (the hint) — ruled 2026-10-16 | **built** — committed `37d0fe49`; QA §324 ✅ |
| 2 | A settled notification says what happened | A1–A6 ruled 2026-10-16 | **built** — committed `37d0fe49`; QA §324 ✅ |

## 6. Verification
- Unit: the registry is total; each kind's settle check against its states (incl. deleted rows, plural requestIds,
  the schedule review's latest round, the no-show's old-row inference); recipients of the three; the retired four
  never 'act'.
- Typecheck; `verify:changed`; `check:dictionary`.
- Read-back on dev: the owner's nine stale rows clear on the first bell read; the waiting one stays.
- A QA walk (ledger section, hub QA tab) once built.

## 7. Risks
- **A missed on-the-spot path** → the read-time net clears it on the next read; the bell's number lags until then.
- **Load:** the net runs per list read, over a reader's uncleared 'act' rows only, one query per kind present.
- **Prod migrations:** one index + one data-only clear of the retired four. Snapshots ride in the promoted commit.

## 8. As built (2026-10-16, both stages, one pass; committed `37d0fe49` 2026-10-16)

**Built.** The rulebook `lib/needs-attention.ts` (`NEEDS_ATTENTION_END`, total over `NeedsAttentionKind`; the reader's
pass `clearSettledForReader` before every bell read and count; `clearSettled` on the spot; `settledLines` for the list;
`doorOutcome` behind the new `GET /api/notifications/outcome`). The words in `lib/needs-attention-words.ts`, the doors'
client helper `lib/needs-attention-door.ts`, the recipients in `lib/notify-recipients.ts` + `clubModuleUserIds`, the
registration's amount due lifted into `lib/registration-amount-due.ts` (the reminder route and the rulebook read one
rule). On-the-spot clears in: accept / decline / withdraw an ask, a late ask, take it back; confirm received, the coach
taking "sent" back; approve / decline a request, a coach withdrawing one; a move accepted / declined / withdrawn; an
invite approved / declined / cancelled / replaced; a review answered, Finalize, a schedule deleted; check in / undo; the
billing webhook's recovery. Mig 332 (two partial indexes over the eleven kinds, the retired four cleared) applied to
dev 2026-10-16; prod **pending** (MANUAL_PROD_STEPS.json).

**Departures, said here and in the code:**
- **The onward button on an answered ask reads "Open the request"**, not "Payment requests" as drawn — the 2026-10-05 D4
  rule names a link that lands on one record by the record. A waiting ask's button, a bare "Open" until now, reads
  **"Open the ask"** (a schedule link without one: "Open the schedule").
- **A schedule builder without money access** gets the settled line without its money line — their copy of the ask was
  sent without the figure (found reviewing this build).
- **Payment requests' door speaks only when the record states an outcome**: a request the page's list doesn't show may be
  decided in another year, so "isn't here any more" could be untrue.
- **A former member's old notifications** carry no settled line (they would have read live names and figures).
- **Words added or changed at build** (A6 approved the shape): "13U AAA’s bill doesn’t change." (the drafted "Its bill
  stays $X" needed a second money read); "It was declined or cancelled." (the invite keeps no record of which); "The team
  was removed from the tournament."; "Payments aren’t tracked for this tournament any more." (the payments census caught
  that a reminder for an event that stops tracking payments would otherwise wait forever); the ask that closed reads the
  product's own "No practice in it was still to come." /marketing's pass: nine changes (`Reason:` for someone else's
  decline, "Recorded, then undone by …", "Both requests are settled.", the door in active voice, the Done definition).
- **The reader's pass pauses 15 seconds per person per bell** (per server instance): the bell and the phone bar each count
  on load. A settle step still clears on the spot; the pause only delays what time or the daily sweep settles.
- **A late ask withdrawn** reopens the team's chance to ask, but its "you could ask" notice stays cleared (by design: not
  re-rung).

**Passes.** /marketing (nine changes, above). /docs: org › Notifications gains the page **"When something leaves Needs
attention"** (who gets which, the settled line, the doors); both portals' **Done** definitions; the coach bell tour (no
longer "an assistant-coach request" for a coach); the coach phone answer; the free coach's payment reminder; search
terms. /review, high-risk, four lenses (correctness, security, regression, performance): **confirmed and fixed** — a
failed payment no longer settles on Stripe's `unpaid` / `incomplete` (only `active`, `trialing` or a cancelled plan); the
rulebook's reads page (a 1,000-row cap read silently as "taken back"); a builder's quiet copy shows no money; a former
member reads nothing live; a payout notice naming no request is left alone; a clear writes read before Done (a failure
between them now self-repairs); the reader's pass pause and the club's own names before an Auth lookup; mig 332's indexes
narrowed from "cleared_at is null" (nearly the whole table — news rows are never cleared) to the eleven kinds, held equal
to `NEEDS_ATTENTION_KINDS` by a test. **Refuted:** "approving an assistant is owner/admin only" — the approve route
gates on Rep Teams + the group, exactly the new recipients.

**Verified.** Typecheck clean. Unit suite 7,610 of 7,612 (the two failures are other sessions' stylesheets — the admin
rail scrollbar and the coach portal's `.occGroupPermit`). `verify:changed`'s checks (spelling, dates, dictionary,
manual-prod, index coverage, observability, org-slug, contrast) clean; `check:schema-parity` flags only mig 332's two
indexes as dev-only (pending prod); `check:layout --changed`: 20 screen-widths, no new findings. **Live on dev:** the
treasurer's bell cleared six settled asks and kept the four genuinely waiting (an ask, a payment marked sent, a pending
request, a payout held by two pending requests); the outcome route answers accepted / withdrew / waiting / 404. The
owner's ten stale rows were cleared at 8:52 p.m. by the layout check's own page loads (they read the owner's bell), so
the owner's walk sees the result, not the moment.

**Left, measured:** the badge can count one extra for a moment when a notice for an already-settled request arrives
live; a drawer left open while a request settles elsewhere shows it until reopened; Stripe events arriving out of order
can clear a failed-payment notice early (the status is overwritten as Stripe sends it); if the team's group can't be
read, group-limited approvers miss an approval notice. **Not walkable here:** a failed card payment (Stripe) and an
assistant awaiting approval — both held by unit tests.
