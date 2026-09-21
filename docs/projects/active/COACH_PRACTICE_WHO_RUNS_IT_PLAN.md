# Coaches portal: a station knows who runs it — staff tags linked to people, and "Send to staff"

**Status:** DRAWN 2026-09-17 on the project hub · **RULED 2026-09-17 — A–K all "as recommended"** (owner, in
chat, after the Stage 5 commit) · **BUILT ON DEV 2026-09-17** (§10) · migration 303 applied to dev, **PROD-OWED**
(apply BEFORE the promote; independent of 297–302) · owner QA walk §203 owed (the hub's QA tab) · commit
owed on the owner's word.
**Build gate (met):** the Stage 5 build committed as `fe2d8244`; this was built on top of it and of P10
(`ab4e6f4a`, the field has no clock) — the run screen's "that's you" swap sits on P10's rows.
**Hub:** `docs/projects/active/COACH_PRACTICE_WHO_RUNS_IT_HUB.html` · published `https://claude.ai/artifact/XJEkn3p9ff2yLdXJ2Rar2k`.
**PM brief:** `COACH_PRACTICE_WHO_RUNS_IT_PM_BRIEF.md`. **Parent plan:** `COACH_PRACTICES_REEVALUATION_PLAN.md`
(referenced, deliberately not edited — it is open in the Stage 5 build session).

---

## 1. Assessment

The owner asked two things on 2026-09-17: (a) a way for a coach who has finished writing a practice
plan to **notify the staff** so they can read it and prepare before the start time, and (b) a way to
**link the staff tags on stations to real portal users**, so an assistant who opens the plan on a phone
sees the whole practice *and* which blocks and stations are theirs. On the second exchange the owner
widened (a) into three audiences: **everyone on staff · all coaches · everyone named in the plan** —
"no reason to send these to treasurers and managers."

Read from the code (§4), the two asks are one project with a fixed order: **the identity link is the
load-bearing half.** Today "that's you" on the run screen is a *name* match against an *optional*
member field, so it already fails silently for the most natural inputs; and D12's ruling that team
coaches be "offered automatically" in the staff picker was never built. Without the link, "named in
the plan" (the audience that matters most) would have to guess by name — the same fragile thing —
and the notification could only ever say "go read it", never "you're on Footwork ladder".

## 2. Scope, method and confidence

**In:** the staff tag library learns which of its words are people (one person per tag per team); the
station/block Staff picker offers the season's staff first and mints a linked tag on pick; the tag
manager can link/unlink an existing word; the plan and run screens decide "yours" by identity; the plan
page gains a quiet "You're on …" strip for a viewer who is named; a **Send to staff** action with three
audiences, a sent stamp, a new notification type (bell + push, personalized per recipient), and an **Also email them** tick that sends the coach's own email regardless of the person's notification settings (owner ask, 2026-09-17).

**Out (stated, not forgotten):** a scheduled reminder N hours before practice (a second decision — a
cron, not a button); staff on the printed sheet marked "you" (paper is for everyone); linking on
org-shared staff tags (shared tags are club words, not people); a Helper's access changing in any way
(a tag is a label, never a grant — D12 holds); chat as the delivery channel (the bell + push with a
deep link is the tool; chat has no per-person "your stations").

**Method:** read-only walk of the plan page, editor, run page, station view, tag picker/manager, the
tag routes and repoint module, the notification dispatch and catalogue, the staff-kind model, and the
prior rulings (D12, D28, D29, D30). No code was changed. **Confidence:** high on the findings (each
is a specific line); medium on sizing (§8) until Stage 5's build lands and the row component it
introduces is real.

## 3. Walkthrough as the assistant — "what am I doing tonight?"

Jen is an assistant on Riverdale Ridge. Sam (head coach) finished Tuesday's plan at 4 p.m. Today: Jen
finds out there is a plan when she opens the Schedule, opens the plan, reads six blocks, and looks for
her own name in the station lines. On the field, the run screen *might* say "that's you" on Footwork
ladder — only if Sam typed "Jen Okafor" exactly as the club's member list spells it, and only if that
member row has a display name at all. After: Jen's phone buzzes at 4:12 — *"Tuesday's practice plan is
ready — you're on Footwork ladder and Close control. Arrive by 5:45 p.m. for 6:00 p.m."* — the tap
opens the plan with a "You're on" strip under the title that jumps to each, and on the field every
row that is hers says so, by identity.

## 4. Findings

### F01 — "That's you" is a label match against an optional field · Code finding
`app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/run/page.tsx` `isViewersStation()` compares
each resolved staff name with `viewerName`, case-insensitively, whole string. `viewerName` comes from
the practice-plan GET (`…/practice-plan/route.ts` ~L237): the viewer's `displayName` from
`getRepTeamStaffForYear`, which reads **`organization_members.display_name`** — nullable, UI-only. A
tag "Craig" never equals "Craig Whitfield"; a blank display name means the match can never fire. The
route's own JSDoc says so ("a MATCH ON A LABEL, not an identity claim … this can miss"). It is
emphasis only, so it grants nothing — but it is the one thing the field screen has for "mine".

### F02 — D12's "team coaches offered automatically" was never built · Code finding
`COACH_PRACTICE_PLANS_PLAN.md` D12 (2026-07-31): *"Team coaches offered automatically; anyone else
created on the spot."* The staff library (mig 266, `rep_team_tags kind='staff'`) is a plain word list;
`PracticeTagPicker`/`TagPicker` know nothing about the team's staff. The GET already loads the staff
list (for `viewerName` and `headCoachName`) but never hands it to the picker.

### F03 — The plan page — the reading surface — has no "yours" marking at all · Code finding
Only the run screen (and its station view: "You're running") marks the viewer's station. The plan
page's station columns (`_PracticePlanEditor.tsx` `StationColumns`) print the staff line for everyone
identically. Stage 5 P7 puts "that's you" on every rotation row of the run screen, which is right for
the field; the phone-before-practice read the owner described happens on the plan page.

### F04 — There is no "done" moment; a notification must be an explicit act · Code finding
The plan autosaves ~900 ms after the last change (`[eventId]/page.tsx` "the portal's established
'no Save button' posture"). Nothing distinguishes "paused typing" from "finished". The send is a button
the coach presses; it can never be inferred from a save.

### F05 — The notification system can already reach exactly these people · Code finding
`lib/notify.ts` takes explicit `userIds` and resolves them through auth, **not** through org
membership — the same path `assistant_coach_joined` uses (`app/api/auth/accept-assistant-invite/
route.ts`). So a standalone coach portal (a shadow org) and an assistant who is not an org member are
reachable. Per-recipient bodies mean one `notify()` call per person (≤ ~10 staff; fine). The catalogue
is typed as total records (`NOTIFICATION_EVENT_LABELS`, `_DESCRIPTIONS`, `NOTIFICATION_CATEGORY`) so a
new type fails typecheck until every list carries it. Demo orgs are silenced inside `notify()`
(fail-closed), so the demo sandbox needs no special case.

### F06 — Five staff words exist, ruled "a label that gates nothing" · Context
`lib/coach-capabilities.ts` `StaffKind` (mig 288): head coach, assistant coach, team manager, team
treasurer, helper — `staffKindLabel()` prefers the stored kind and derives for NULL rows; its JSDoc:
*"NEVER gate anything on this."* Addressing a notification by the word is not access control (a
manager left off the list can still open the plan), so it sits inside the ruling — but it is the first
place the word decides anything beyond what is printed on a row. Said here so it is a decision, not a
drift.

### F07 — Push to Android on production has an open diagnosis · Context
`project_push_delivery_diagnosis` (2026-07-04): bell works, OS push unproven on the owner's installed
PWA; the self-serve "Test this device" tool is on prod. "They'll see it before practice" leans on push.
Re-run the device test before this ships; the bell + deep link is the guaranteed floor.

## 5. The proposal

### 5.1 The link — a staff tag can be a person
- `rep_team_tags` gains a nullable **`user_id`** (staff kind only; team tags only — never org-shared).
  One person per tag per team. The tag's **name stays the coach's own word** ("Craig"); the identity
  is the id. Nothing about the tag's use changes: it is still a label, never a grant.
- **Picker** (station Staff, block Staff): the dropdown opens with a **"People on this team"** group —
  every staff member this season with their kind word (Head coach · Assistant coach · Helper · Team
  manager · Team treasurer) — then the team's other words, then "+ Create". Picking a person mints a
  linked tag (name = their display name, or their email's local part when the display name is blank,
  editable like any tag) unless one already exists, in which case it selects it. Finishes D12.
- **Manager** (the One Tag Idiom drawer for staff): each row shows **who it is** (a person mark + the
  kind word) or **"a name only"**; a "Link to a person…" control offers the season's staff not yet
  linked; "Unlink" returns it to a word. This is how a team with fifteen practices of typed names moves
  over without retyping: link "Jen" → Jen once and every past plan's "that's you" is honest.
- **Merge / delete** (the repoint module already walks plan jsonb for staff ids): winner keeps its
  link; a linked loser merged into an unlinked winner **carries the link across** (decision C).
- **"Mine" by identity, decided server-side:** the practice-plan GET adds `viewerBlockIds` and
  `viewerStationIds` — every level whose staff tag ids include a tag whose `user_id` is the viewer.
  The run screen and station view read those instead of name-matching; `isViewersStation` and
  `viewerName` are deleted (decision E: no name fallback — a fallback that works for some hides the
  missing link).

### 5.2 "You're on …" — the plan page for a named viewer
Under the where-line, above the sheet, **only when the viewer is named** (never an empty strip):
one line per block/station they are on, in practice order, each a jump — *"You're on · 6:10 Skills
circuit › Footwork ladder · 6:55 Small-sided game (whole block)"*. The named station columns and
block rows wear a small olive **you** mark. Absent for a viewer who is not named; absent on the paper.
Quiet by construction: one line of support-size text; the sheet stays the page (F03).

### 5.3 Send to staff — three audiences
- A **Send to staff** button in the plan's toolbar beside "Save as template…" and "Print the sheet"
  (a secondary button — the sheet's first block keeps the one lime, stage 1 D5). Only with blocks;
  only for a writer (`canWritePracticePlans`).
- It opens a short sheet: **who** (one of three, each listing the people it reaches by name and count),
  a **preview** of the message as one recipient will read it, and **Send**.
  1. **Named in this plan** — everyone whose linked tag is on any block or station. Default whenever
     it reaches anyone. Under it, honestly: *"Adam — a name only, not sent"* for an unlinked word (the
     nudge that gets tags linked).
  2. **Coaches and helpers** — head coach, assistant coaches, helpers (decision A).
  3. **Everyone on staff** — all five kinds.
  Every audience: never the sender; never someone whose access excludes the schedule (the link would
  refuse them). The sheet remembers the team's last choice (decision B).
- **Sent state** on the toolbar: *"Sent to 2 (named in the plan) · 4:12 p.m. · Send again"*. Re-send is
  always allowed. Optional "Changed since you sent it" (decision H).
- **The notification** (`practice_plan_sent`): title *"Tuesday's practice plan is ready"*; body
  personalized — *"You're on Footwork ladder and Close control. Arrive by 5:45 p.m. for 6:00 p.m."* /
  *"Read it before 6:00 p.m."*; deep link to the **plan page** (the reading surface — never the run
  screen). Bell on; **push on by default**; email off unless the person turns it on (decision D). A
  row on the coach card of Account › Notifications. Category `know` (a read, not a decision).

### F08 — Email today is a preference or a suppression list; a coach's addressed email is a third thing · Code finding
`lib/notify.ts`'s email channel is per-person, per-event, default off (`systemDefaults`). Family mail runs
through one guarded door (`lib/family-email.ts`) that honours the org's suppression list and appends an
unsubscribe — and its own header lists dues reminders as **deliberately outside it** because a bill is
transactional (owner ruling 2026-08-18); `PAUSE_EXEMPT_EVENTS` lets an @mention pierce the master pause
because a person addressed you. A coach pressing Send is neither a subscription nor a bill: a colleague
addressing colleagues about tonight. **Owner ask 2026-09-17:** "this should bypass any opt out
notifications since this is an explicit action by the coach." Agreed on those two precedents (decision J).

## 6. Decisions — RULED 2026-09-17, all as recommended (owner, in chat: "Build as recommended (A–K)")

| # | Question | Recommendation |
|---|---|---|
| **A** | Do helpers belong in "Coaches and helpers"? | **Yes** — the product defines a helper as "runs a station at practice"; a practice plan is the one thing a helper is for. If ruled No, the option reads "Coaches" and a helper is reached only by "Named" or "Everyone". |
| **B** | Default audience | **"Named in this plan" when it reaches anyone, else "Coaches and helpers"; the sheet remembers the team's last choice.** |
| **C** | Merge: a linked loser into an unlinked winner | **Carry the link** — the coach merged "Jen" into "Jen O." meaning they are one person; losing the identity would silently break "that's you" on every plan that used the loser. |
| **D** | Channels | **Bell on, push on by default, email off by default** (a row on the coach card lets anyone turn email on). |
| **E** | Keep the name match as a fallback for unlinked tags? | **No** — delete it. A fallback that works for some coaches hides the missing link from all of them; the "a name only" line in the sheet and the manager's link control are the honest path. |
| **F** | Build order | **Link first, then the strip, then Send** — Send's best audience needs the link. All after the Stage 5 commit. |
| **G** | "You're on …" placement | **Under the where-line, above the sheet, only when the viewer is named.** Never an empty strip; never on paper. |
| **H** | "Changed since you sent it" | **Defer** — the plan has no plan-only updated stamp; the event's `updated_at` moves on any schedule edit, so the line would sometimes lie. Re-send is the answer; revisit if coaches ask. |
| **J** | "Also email them" bypasses the per-event email preference AND the master pause | **Yes** — the coach's explicit act, on the dues-reminder / @mention ground. Two boundaries: the email names the coach and its footer says why it arrived; off by default, remembered with the audience. Bell and push keep honouring each person's settings. Never a platform-initiated staff email — only this button, only this audience. |
| **K** | What the email carries | **The outline** (times · blocks · stations · who) with the reader's rows marked, then "Open the plan". Not the whole sheet (it is the printed page and names children); not the message alone (a doorbell, not a document). |
| **I** | Sent stamp storage | **Four columns on the event** (`practice_plan_sent_at/by/audience/count`) — the `family_shared_at/by` idiom, mig 215. Not a history table: nothing reads a history. |

## 10. Built as (2026-09-17) — where the build met the frames, and what the probe found

Built in the ruled order — the link, the strip, then Send with the email — on the tree after
`fe2d8244` (stage 5) and `ab4e6f4a` (P10), in a shared working copy with two peer sessions active
(the P10 build and the stage-6 planning), coordinated by message; the peers' files were left alone.

**As drawn, by screen:** the plan page's "You're on …" line under the where-line (inside the sheet's
head, where the where-line actually lives — the frame drew it above the toolbar) with the block's
clock, the block's title and the stations under it, each a jump to the row; the small olive **you**
mark on a shut block row and on a station column (the column also wears the olive edge); the staff
picker's "People on this team" group ahead of "Other names" with the kind word on each, picking a
person selecting their word or minting one linked (named after them — the manager renames it to
"Jen" in one press); the manager's second line per word — "**Jen Okafor** · Assistant coach · Unlink"
or "A name only · Link to a person…" (a select of the people not yet linked); the run screen's rows
"Coach Bob — that's you" by identity, the station view's "You're running", the plain block's staff
line "— that's you"; **Send to staff** as a secondary toolbar button (P10 made Run practice
unconditional — lime on the day, plain otherwise — and it stays first); the sheet with three
audiences listing names and counts, "Jordan Helper · Sam Assistant — names only, not sent" under
*Named*, "Also email them", a preview "As UAT Assistant (money) will read it", "Send to 5"; the sent
line under the toolbar "Sent to 5 (coaches and helpers) · bell and push · 9:32 p.m. · Send again";
the coach card on Account › Notifications with a "Practice plans" row whose blurb says the coach's
email arrives whatever the switches say.

**Departures, flagged:** (1) the strip sits INSIDE the sheet's head (under the where-line, above the
provenance line) because that is where the where-line is on the built page — the frame's "above the
toolbar" was drawn before stage 1 moved the where-line into the document. (2) "Named in this plan"
with nobody says which nobody: "Only you are linked on this plan so far." when the sender is the only
linked person, else "Nobody on this plan is linked to a person yet — Manage staff… on a Staff field
links a name to someone." (3) The email's "Arrive by 5:45 p.m." keeps its period inside the bold and
adds none after — the unit test's first catch was "for 6:00 p.m.." on the push body; `endOnClock`
is the one rule for a sentence that ends on the house clock.

**Found by the rendered probe (UAT probe practice, the head coach, 390 and 1440):** the plan
payload was missing the reader's own id, so the sheet's preview counted the sender in "Coaches and
helpers" (6) while the route, which excludes the sender, sent 5 — fixed (`viewerUserId` on the GET);
the strip's clock split "9:04 / p.m." across two lines at 390 — fixed (the clock never wraps; each
entry takes its own line on a phone). Proven on the fixture with the coach's linked word placed on
two stations and a block through the API and the plan restored after: `viewerBlockIds` /
`viewerStationIds` resolved by identity; the strip "YOU'RE ON · 9:04 p.m. Skills circuit › Footwork
ladder · Close control · 9:49 p.m. Small-sided game"; one **you** on the shut game row, three with the
circuit open, two columns marked; the field "that's you" ×2 on the circuit's rows across all three
rounds and ×1 on the game's staff line, the station view "YOU'RE RUNNING"; a link to a stranger
refused ("That person isn't on this team's staff."); the send's stamp read back on both widths.

**Verified:** unit 18/18 on the new module + the email (every audience pinned against the mixed
fixture; a legacy free-text list marks nothing; the merge carry is exercised through the repoint
module's own suite), full unit 4,160+ green after the peer's P10 landed; `typecheck` 0; focused lint
0 errors on the touched files; `verify:changed` green after `check:schema-parity --init` accepted
migration 303's dev-only divergences (the established path for a prod-owed migration — the
baseline lowers itself when prod catches up); `check:dictionary` (gotcha 7 and `user_id` on
`rep_team_tags`; the five sent-stamp columns on `rep_team_events`); snapshots refreshed, watermark
#303; `check:spelling`, `check:css-selectors`, CSS purity green; the billing-rail guard taught the
shared practice-plan resolver (extracted from the plan route so the send route could not re-type
the auth chain).

**/simplify (2026-09-18, four lenses, 10 applied · 4 skipped):** ONE reader's walk of the plan's levels
(`practicePlanLevels`) behind "that's you", "You're on …", the send's labels and the email's marked rows —
it had been written four ways; "mine" has ONE owner, the client (the reader's id + each tag's `userId`
through that walk — the send sheet had to answer it for every other recipient anyway), so the two id lists
left the wire; the editor threads `staffPeople` / `onPickStaffPerson` / `mineBlocks` / `mineStations` as
props like the eight staff props beside them — the context is gone; the manager's person line is a declared
`policy.people` knob (the file's two-knob contract), never a shape-sniff of the GET; the tag routes take
`people` as two HOOKS (`list`, `isOnStaff`) like the repoint pair, and linking is its own verb
(`PUT …/staff-tags/[tagId]/person`) rather than a shape of PATCH; the membership proof is the one-row
read, not every identity resolved; the plan GET resolves identities ONCE (the memberships join its
`Promise.all`; the head coach's name reads from them) and the library GET resolves people only on
`?people=1` (the manager asks; the picker's per-keystroke refresh does not); the send route builds the
outline once and dispatches the recipients in parallel; `orgDayKey` for the sent line's same-day;
`FIELD_KINDS` exported and the kind itself named in "Everyone"; one link-styled button class. **Skipped,
with reasons:** `joinNames` stays module-local (the repo's own note in `lib/walkthrough-derive.ts` says the
list-joiners differ per surface on purpose); the email's warm palette against the house's dark
transactional shell is a DESIGN call flagged to the owner, not silently switched; the editor's and the
strip's clock walks stay two (the strip's runs only for a named reader); `levelsForStaffTags` stays a
reader's walk beside the writer's `repointPracticePlanTags`. Re-probed after: identical results.

**/review (2026-09-18, high-risk funnel, four lenses — 16 found → 12 after dedup → 11 confirmed and
fixed, 1 accepted, 4 refuted):** the deterministic gate first — `verify:changed` green, `typecheck` 0,
`check:layout --only=` the plan and station screens found **"Send again" at 32px under the 44px tap floor**
on phone and tablet (fixed: the link-button takes the floor at ≤768). Then: **(High) one station IS the block**
— a name at both a sole-station block's levels read as TWO entries ("Warm-up and Station 1") on the strip
and in the message while the email's outline showed one — the fold now lives in the one walk (`practicePlanLevels`
folds the sole station, D1) and the fixture pins it; **(Medium, security)** the staff library's `?people=1`
answered a development-only assistant (the library's read gate admits `notes` alone so the focus rail can
name a tag) with the staff's identities and roles — now only a reader who can open the plan; **(Medium)**
the sheet's people list came from the first GET and went stale after a link in "Manage staff…" — the preview
then disagreed with the send; it reads each person's word off the fresh tag library now; **(Medium)** Send
inside the autosave's second sent the plan as it WAS — a dirty plan is saved first and a failed save stops
the send; **(Medium)** a stamp write that failed after the bells had landed returned a 500 and invited a
second press — the stamp is best-effort with an observability capture, never a 500 over a send that went;
**(Medium)** the merge carry's two writes were unconditioned — each now writes only what it read and a
concurrent link is refused by sentence; **(Medium)** a provider error counted as a sent email
(`status !== 'skipped'` → `=== 'sent'`), and the stamp's `email` records that mail WENT (at least one),
not that the box was ticked (the dictionary says so); **(Medium)** "Everyone" named a treasurer by the raw
kind key — the team's word, lowercased; **(Medium)** the manager's first paint said "Someone no longer on
the staff" for the frame before the people arrived — nothing until they do; **(Low)** the day word's line
is six days (the seventh is today's weekday again) and the boundary is pinned; **(Low)** a remembered
audience that reaches nobody yields to ruling B. **Accepted:** a person row that fails to mint says nothing
(the same posture as "+ Create" — the host surfaces errors). **Refuted:** double-submit on the sheet
(busy flips before the first await); `notify()` rejecting a batch (it never throws by construction); demo
orgs reaching the route (the proxy blocks the write at the edge; the route's own guard is depth); the
head-coach name drifting between memberships and the season record (M1 keeps the live year projected).
Re-verified: unit 4,162/4,162; typecheck 0; focused lint 0; the rendered probes identical.

**/docs (2026-09-18):** the practice-plan guide's "Who runs it, and what to bring" rewritten (people first,
the link, what a linked name unlocks, old names become people once, equipment as before) and a new sub-topic
"Send the plan to your staff" (the three audiences as definition rows, the preview, the email's exception, the
sent line); two new FAQs — "How do I tell my assistants the plan is ready?" and "Why doesn't my assistant's
station say that's you?"; the "+ Create" FAQ opens with People on this team; the run article's "My station"
sub-topic and FAQ say a person, not a spelling, decides "that's you"; the notification-settings FAQ names the
Practice plans row and its email exception. Keywords and searchText carry every new term. Under the length
standard (both sub-topics < 350 words); typecheck, lint, `check:spelling` green.

**Owed:** the demo sandbox's circuit is unlinked (a `/demos` question for the next cycle — the sandbox's
shared account makes "that's you" a one-person story there anyway); the Android push re-test (F07); the
owner's §203 walk; the commit (private index) and migration 303 to prod before the promote.

## 7. Read from the code — what the build must fit

**Files this lands on, all being rewritten by Stage 5 right now** (hence the gate):
`app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx` (toolbar, strip),
`…/[eventId]/run/page.tsx` (row "that's you" → identity), `…/practice/_PracticeStationView.tsx`
("You're running" → identity), `…/practice/_PracticePlanEditor.tsx` (picker's people group; the
**you** mark on `StationColumns` and the block row), `lib/rep-practice-plan.ts` (the levels-for-user
walk beside `resolvePracticePlanTagNames`), `app/[orgSlug]/coaches/coaches.module.css`.

**New / touched elsewhere:**
- Migration (next free number — 303 at the time of writing; **check before writing**):
  `rep_team_tags.user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL`, CHECK
  `(user_id IS NULL OR (kind = 'staff' AND team_id IS NOT NULL))`, partial unique
  `(team_id, user_id) WHERE user_id IS NOT NULL`; `rep_team_events.practice_plan_sent_at timestamptz`,
  `practice_plan_sent_by uuid → auth.users SET NULL`, `practice_plan_sent_audience text CHECK
  ('named','coaches','staff')`, `practice_plan_sent_count smallint`, `practice_plan_sent_email boolean`. Dictionary rows (gotcha 7 on
  `rep_team_tags`: the link is team-only; merge carries it) + `npm run refresh:snapshots` in the same
  change. `merge_rep_team_tags` does NOT need to learn the column (staff merges already go through
  `lib/rep-practice-plan-tag-repoint.ts`; the carry is one UPDATE there).
- `lib/coach-tag-routes.ts` `STAFF_TAG_LIBRARY`: PATCH accepts `userId` (validated against
  `getRepTeamCoaches(programYear)` for the team's **active** season — a link to a stranger is refused);
  the GET carries `userId` + the kind word per tag. `PickableTag` gains optional `userId`/`kindWord`.
- `TagSearchCombobox`/`TagPicker`: a grouped dropdown ("People on this team" · words) — one new
  optional prop `people`; `PracticeTagPicker` passes it for staff only.
- Practice-plan GET: `viewerBlockIds`, `viewerStationIds`, `sent: {at, by, audience, count} | null`,
  `staffPeople: [{userId, name, kindWord, tagId|null, canReadPlan}]` for the picker and the send
  sheet. `viewerName` removed.
- **New route** `POST …/events/[eventId]/practice-plan/send` `{audience}` — gated
  `canWritePracticePlans`; computes recipients (§5.3 rule) with `getRepTeamStaffForYear` +
  `getRepTeamCoaches` (capabilities → `canViewSchedule`; stored kind via a small reader on
  `rep_team_staff_memberships.staff_kind` + `staffKindLabel` for NULL rows); one `notify()` per
  recipient; writes the four stamp columns; returns the count and names. Reads no year → not a
  `HISTORY_ENDPOINTS` entry.
- **The email** (when `{ email: true }`): `sendEmail` directly — NOT `notify()`'s email channel (pref-gated) and NOT
  `sendFamilyEmail` (suppression + unsubscribe footer are for families). Deliberately outside both the per-event
  preference and the master pause (J); the send route says so in a comment that cites the dues-reminder precedent,
  and `lib/family-email.ts`'s "who is outside this door" audit list gains a line for it (the count is the point
  there). Subject `${day}'s practice plan — ${team}`; body: the personalized line, the outline (block times/titles;
  each station with its staff; the reader's levels marked "you"), an "Open the plan" button to the plan page, a
  footer naming the coach and the reason. Rendered through `lib/email-markup.ts`; times via `formatTime()`.
  `practice_plan_sent_email` on the stamp; the sent state reads "bell, push and email".
- `lib/types.ts` `NotificationEventType` + `lib/notification-labels.ts` (label, description,
  `PUSH_DEFAULT_ON_EVENTS`, `NOTIFICATION_CATEGORY: 'know'`) + `lib/notification-view.ts` icon +
  the coach card in `app/(consumer)/account/notifications/AccountNotificationsClient.tsx`.
- Copy: times through `formatTime()` ("5:45 p.m."); `check:spelling` covers the new strings.

**Tests:** `tests/unit/` — the email path is taken for a recipient whose email pref is off AND whose account is paused (the bypass is the requirement, so it is pinned); the audience rule against a mixed fixture (head, two assistants, manager,
treasurer, helper, one assistant without schedule access, one unlinked word, the sender): each audience
pins its exact recipient set; the levels-for-user walk (block-level and station-level, legacy free-text
levels yield nothing); the merge carry; the catalogue's total records (typecheck). Rendered gate:
`check:layout --only=` the plan page at 390/768/1440 with the strip present and absent.

## 8. Sizing (after Stage 5 lands)

| Piece | Size |
|---|---|
| Link column + manager link control + picker people group | M |
| Server-side "mine" + run screen/station view swap | S |
| "You're on …" strip + you marks | S–M (design ruled on the hub first) |
| Notification type + coach card row | S |
| Send sheet + route + stamp + sent state | M |
| The coach's email (template, outline, footer) | S |
| Tests, help articles (`/docs`), demo check (`/demos` next cycle) | S |

## 9. Verification (for the build session, after the rulings)

1. `npm run verify:changed` + `npm run typecheck` (shared modules: types, notify labels, tag routes).
2. Unit: audience rule, levels-for-user, merge carry.
3. Rendered: the plan page with and without the strip; the send sheet at 390; the run row's
   "that's you" for a linked assistant (sign in as `uat-asst-money@…` after linking their tag).
4. Migration applied to dev before the code; dictionary + snapshots refreshed; `check:dictionary`.
5. Owner QA walk (ledger § at the next free number at build time; hub QA tab unhidden then).
6. `/docs` for the plan page, the run screen and Notifications articles; `/demos` decides whether
   the sandbox's circuit gets linked tags so "that's you" shows in the shop window.

## 10. Planning deliverable verification

- [x] Findings each anchor to a file and a line region, read on 2026-09-17.
- [x] Prior rulings searched (D12, D28, D29, D30; the 2026-08-03 "helper is a preset" ruling;
      the mig 288 staff-kind ruling; the notifications redraw) — none contradicted; D12 finished.
- [x] Stage 5 collision named with the file list; the gate is the commit, not a date.
- [x] Every open question is a lettered decision on the hub with a recommendation.
- [x] Owner rulings A–K (in chat, 2026-09-17: "Build as recommended (A–K)") → §6 updated → built (§10).
- [ ] Owner QA walk §203 (the hub's QA tab) → commit on the owner's word → migration 303 to prod before the promote.

## 11. Follow-up (2026-09-20) — "Just these people", and the station's people line says Staff

**Owner asks (2026-09-20, in chat):** (a) the station's fields should match the drill's; the one
mismatch found was the people line — **"Who runs it"** on a station where the block (and the door
that opens the line, "+ Staff") say **Staff**. The five teaching fields were already ONE shared list
(stage 4, L6), so nothing else needed reconciling; the placeholder difference ("What happens at this
station" / "How it runs") is each caller's own words and stays. (b) "For a coach who wants to send
notifications when plans are done, can we also allow sending to specific coaches — sometimes they send
to one assistant to review and update before sending to the broader group."

**Built on dev 2026-09-20, commit owed:**
- **Staff** is the station's word everywhere (modal and flattened). The one place two Staff rows can
  now stand on a single flattened block — a block holding staff of its own AND on its sole station (a
  lead set on a circuit, then trimmed to one) — is rare, legacy-shaped, and staff is NOT moved between
  levels on the way past. Two UAT specs re-anchored (the template spec's old assertion looked for an
  aria-label the picker never carried and passed on nothing; it now scopes to the sheet and counts the
  word). The stations help article names the field.
- **Staff · Players lead the station (owner, same day, on the built modal: "it is one of the things
  that will likely get filled out the most and shouldn't fall below the footer line").** WHO, THEN WHAT
  — the practice's half (staff · players) above the drill's five fields, in the modal and flattened
  alike, then just for tonight · save to my drills. Beyond the fold, the merit: the printed sheet and
  the field screen already read a station that way (the staff · players line under the name, the words
  below); the edit sheet was the one surface reading it the other way round. On a drill-backed station
  the modal now opens on its editable half instead of a wall of locked text. The block followed the same
  day (owner: "update the written block with no station to match for consistency") — Staff · Players
  ABOVE the two teaching fields, then Coaching points · Equipment · the stations, and the foot's doors
  in the fields' order (+ Staff first); stage 2 D1's Coaching points · Staff · Players · Equipment is
  superseded on that one point. The station modal's head now sits the same 0.6rem above its first field
  that fields sit apart (the shared head's own margin had stacked on the body's padding) — the drill
  sheet wears the same head and gets the same. Help: the stations and blocks articles name the order.
- **A fourth audience, `chosen` — "Just these people":** a radio under the three groups; picking it
  reveals a checklist of everyone the send could reach (the "Everyone on staff" set — the same two rules),
  name and role word, each a 44px row. The route takes `userIds` beside `audience`, reads them through
  `practicePlanRecipients` again (a ticked id that is the sender, off the staff, or without schedule
  access does not go; STAFF order, never tick order), and refuses an empty pick.
- **The sent line names them** — "Sent to Jen Okafor · bell and push · 4:12 p.m." — the sheet's "never
  hides inside a count" rule, after the act. **Mig 305** widens the audience CHECK and adds
  `practice_plan_sent_to uuid[]` (who it reached, every audience, no FK — a record of a past act);
  the page resolves ids against the current staff and falls back to the count + "chosen by name"
  when one no longer resolves. Applied to dev; PROD-OWED before the next promote; baselined in the
  parity ratchet; dictionary row updated.
- **Remembering (ruling B, read for the workflow it serves):** the sheet remembers the team's last
  GROUP choice as the default; a hand-pick is NEVER the next default — "Jen first, then the coaches" is
  one tick on Monday and none on Tuesday, and a habit press can never send the group's plan to Jen alone
  — but the names last ticked wait pre-ticked inside "Just these people". The checklist is a SIBLING of
  the radio's label, never inside it (a label with two labelable descendants forwards clicks to the
  first — the Coaching points trap of 2026-09-15).
- Unit: `practice-plan-send.test.ts` +5 (the tick list through the two rules, staff order, the
  sanitizer's cap, the sent line's names and its fallback). Help: the send article's fourth definition
  row, the remembering rule, the named sent line; keywords. `verify:changed` + `typecheck` green.
