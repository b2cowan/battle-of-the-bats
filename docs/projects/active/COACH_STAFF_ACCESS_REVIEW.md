# Coaching staff — review of roles, permissions, enforcement and the Staff screen

**Status:** REVIEW with recommendations, 2026-09-10. Not a plan; nothing is built. Owner decisions
pending on the nine calls in §7. When decided, this becomes `COACH_STAFF_ACCESS_PLAN.md` +
`_PM_BRIEF.md` and the mockup becomes the build spec.
**Mockups:** `docs/projects/active/COACH_STAFF_ACCESS_MOCKUP.html` — published as a Claude Artifact
at `https://claude.ai/code/artifact/c8982bc5-6d0c-4063-bc82-400850600b1d` (round 1, 2026-09-10; the
same file republishes to the same URL, so later rounds stack as versions there). **Round 2, same
day (owner-directed):** "Team treasurer" added as a fourth starting point, and the role control is
the app's sub-lined dropdown (`SublinedChoice`) rather than radio cards — see R2, R5 and decision 10.
**Asked by:** owner, 2026-09-10 — "a comprehensive review of the staff section … evaluate based on
what we think will be best for the user", with three specific probes: the number of roles, the
flexibility of per-role permissions, moving people between roles, whether each permission is
executed as expected (a helper reached a lineups page), and the design of the whole screen.
**Method:** everything below was read from the code as it runs on `dev` today, not from plans.
Two read-only sweeps covered all 182 coach API route files and every page under the team
workspace. Past decisions are cited for their *reason*, and each reason is tested against the
current product; none is treated as authority (owner ruling 2026-09-09).

---

## 1. What exists today, in one paragraph

A team's staff is a head coach plus assistants. The head coach has everything and cannot be
narrowed. An assistant is eleven grants: Schedule (see) and Change the schedule (two checkboxes),
Attendance, Lineups, Staff chat, Documents (Hidden / View / Manage), Team money (Hidden / View /
View + edit), Contacts & birthdates, Internal notes, Send announcements, Tryouts. A **Helper** is not
a role: it is a stored *bundle* (schedule only) on an ordinary assistant row, and the word "Helper"
on the staff list is *worked out from the shape of the bundle* each time the page renders. Several
duties are not grantable at all — adding or editing players, writing a practice plan, anything in
Skills & Goals, changing the season — and stay with the head coach. Inviting is by email with a
Helper/Assistant radio; the invite carries a starting bundle only for helpers; once sent, the invite
is invisible to the head coach (only a club admin's oversight page lists it). The screen is an
invite card, an access-explainer card, then one full permission grid per assistant, stacked, with a
prose rail on the right.

---

## 2. Findings A — the roles

**A1. Three kinds of person are right; the fourth is missing.** Head coach, assistant coach and a
non-coach helper match who turns up. The person the model has no word for is the **team manager**
— the parent who runs money, forms and family email and never touches a lineup. On a rep team this
is more common than a second coach. Today they are invited as "Assistant coach", receive an email
saying they will *help coach*, start with lineups and attendance they do not want, and the head
coach then flips Money, Contacts and Send announcements through three separate confirmation
dialogs after they accept. The row then says "Assistant coach" for the rest of the season. The
same is true of the **team treasurer** — the parent who keeps the books and nothing else. The
product already reasons about this persona (the Insights door was narrowed for exactly them, and
`coach-helper-preset.test.ts` names "the treasurer" as a pinned case) but offers no way to invite
one.

**A2. The Helper's label is derived, and that is fragile in exactly the way a head coach will
hit.** `staffKindLabel()` (`lib/coach-capabilities.ts:164-180`) prints "Helper" only while the
bundle holds schedule-view and *nothing else*. Grant a helper attendance — the single most likely
extra ("can you mark who's here?") — and (a) their card relabels to "Assistant", (b) the roster
page, Skills & Goals and Insights open for them via `hasRecordAccess`, and (c) the email they were
sent no longer describes what they have. Worse, the helper card has *no controls*
(`CoachStaffPanel.tsx:727-769`), so to grant a helper one thing the head coach must press "Make
assistant coach" (which also grants schedule editing, lineups, documents and the staff chat), then
switch four things back off — five taps and a confirmation to reach "helper + attendance", ending
with the person mislabelled. The code's own comment says a stored helper column would make "the
preset a role the ruling no longer covers"; on merit the fear was of a *gate* keyed on a role, and
a stored label that never gates keeps the safety property intact (see §8).

**A3. Moving between roles is one-way.** Helper → Assistant is one button. Assistant → Helper
does not exist; the head coach unticks four switches and sets Documents to Hidden, and the card
changes its own label when the shape happens to match. There is no Assistant ↔ Manager because
there is no Manager.

**A4. The head coach cannot be changed from the portal.** `resolveHeadCoachTarget` refuses any
head-coach row (`staff/[coachId]/route.ts:33-36`); only the club admin's per-season coaches page can
assign a head coach. A **standalone Premium team has no admin**, so if its head coach steps down
mid-season there is no way to hand the team over at all. Nothing prevents two head coaches at the
data level (admin can assign two), so "Make head coach" from the portal is a UI and a guard
(refuse removing the last one), not a model change.

**A5. The head coach is not on the staff list.** The list filters to assistants
(`CoachStaffPanel.tsx:454-456`); the count reads "4 assistants · 1 helper". A staff list that omits
the person running the team reads as an assistants list, and it leaves nowhere for the one action
only a head coach can take (A4).

## 3. Findings B — the permission set

**B1. Eleven grants is about the right number.** Each names a real duty a head coach delegates.
The Everyday/Sensitive split is right, and the confirm-before-grant on the sensitive five is
right. The compound rule (Documents + Contacts = signed player forms) is handled well, including the
conditional confirmation on whichever grant completes the pair.

**B2. Two of them are the wrong shape.** Schedule is two checkboxes — *see* and *change* — which
admits a state that means nothing: "Change the schedule" ticked with "Schedule" unticked resolves
to a coach who cannot open the schedule but can configure the team (`canConfigureTeam` is
`scheduleManage`), so Settings and Tournaments appear in their nav while Schedule does not. Money
and Documents already use the three-way Hidden / View / View + edit control; Schedule should too.

**B3. Three real duties are not grantable, and the grid does not say so.** (i) Adding and editing
players — head-coach-only (`rosterWrite: false` for every assistant, `coach-capabilities.ts:207`).
A team manager collects forms and fixes phone numbers; today they must ask the head coach to type
it. (ii) Writing a practice plan — gated on `canWriteDevelopment` (= head coach) at
`practice-plan/route.ts:303,362`, a gate borrowed from Skills & Goals (coach-judgement content about
a minor). A drill sheet is not that. The assistant who runs Tuesday practice cannot write Tuesday's
plan, and nothing on the grid says "Schedule: View + edit" stops at events. (iii) Skills & Goals
writes — head-only by design (D1) and defensible; noted, not challenged. The grid's only mention of
any of this is one line in the help article ("assistants never receive roster editing in this
version").

**B4. The explanations are three-word hints.** "Record attendance", "Build game lineups", "Blank
team forms", "Candidates + decisions". None says what else the grant opens — most importantly that
*any* of attendance / lineups / notes / money / documents / tryouts also opens the roster page,
Skills & Goals and Insights (`hasRecordAccess`, `coach-capabilities.ts:391-395`). A head coach
cannot discover that rule from the screen.

## 4. Findings C — is each permission executed as expected?

The owner's report (helper → schedule → a game → a lineups page) is accurate, and the sweep found it
is one instance of a pattern. **Every page that reasons in terms of a capability is correct;
every page that reasons "the server will refuse it" shows a door, a false fact, or both; and two
pages whose server does not refuse either leak real data.** The nav is correct on all fifteen
labels — every leak below is a page the nav hides but a URL or an in-page link still opens.

### C1. Server-side holes (a helper — or any assistant without the grant — receives data)

| # | Where | What a schedule-only helper gets | Fix |
|---|---|---|---|
| 1 | `app/api/coaches/[orgSlug]/teams/[teamId]/announcements/route.ts:56` GET — no capability check (POST at `:77` gates on `announcementsSend`) | **The full text of every email the staff sent to families this season**, with recipient/sent/failed counts. The page (`announcements/page.tsx:80-88`) has no gate either, so the helper also sees a working compose form and "N families with a guardian email on file". | Gate GET and the page on `announcementsSend` (matches the nav until a draft flow exists). |
| 2 | `…/tournament-history/route.ts:20-37` GET — membership only, money redacted | The team's tournament participation across seasons; `tournaments/[registrationId]/page.tsx:26-44` then shows the whole record (schedule, scores, roster, organizer announcements). Nav hides Tournaments on `canConfigureTeam`. | Gate GET + both pages on `canConfigureTeam` so the door and the room agree. |
| 3 | `…/history/route.ts:75-76` GET — membership only; `canViewSeasonHistory: true` hard-coded at `:101` | Every season the team has ever played + the current summary. The four sibling season reads (`season-results`, `season-roster`, `season-practices`, `wrapped`) all require `hasRecordAccess`; this one does not. `history/page.tsx` has no page-level gate either — Dashboard and Results tabs carry `gate: null` (`:120-121`), so a helper sees the season W-L-T scoreboard and findings on a portal the nav closes for them. | Gate GET on `hasRecordAccess`; gate the Insights page on `hasNonMoneyRecordAccess` (today that narrowing exists in the nav only — divergence C4). |
| 4 | `…/upgrade-summary/route.ts:38` GET, `…/team-links/route.ts:53` GET | Workspace migration summary; org links. Minor. | Gate on `isHeadCoach`, matching their POSTs. |

### C2. Client-side doors shown to people the server refuses

| # | Where | What the helper (or ungranted assistant) sees |
|---|---|---|
| 5 | Schedule drawer, `schedule/page.tsx:1249-1250` — `slideTabs` always seeds Attendance and pushes Lineup on any game with no capability check | **The owner's path.** Lineup tab → "No lineup set for this game yet" (false — it was withheld) → **"Build lineup →"** (`:2873`), plus **"Edit in Lineups →"** (`:2895`) and **"edit the lineup →"** (`:2664`). Gating the tab push on `page.capabilities?.lineups` removes all three doors at once. |
| 6 | Schedule drawer attendance tab, `:2696-2843` — no `attendance` check | A complete attendance editor: "All in" / "Reset" (`:2705-2719`), per-player RSVP buttons (`:2788-2796`), per-player note inputs (`:2816-2823`). The 403 is swallowed — the error renders only inside a footer gated on `attendanceRows.length > 0` (`:2832`) — so the helper is told **"Add active players to the roster before marking attendance."** (`:2765`) on a team with a full roster. Also an ungated **"Season attendance"** link into Insights (`:2723`). |
| 7 | Schedule drawer score + awards, `:2389-2441`, `:2470-2499` — no check | **"+ Add final score"** and Save (PATCH refuses at `events/[eventId]/route.ts:52`), **"Give an award"** (refused at `awards/route.ts:52`) or the false "Add players to your roster first". The file already imports `canManageSchedule` and uses it six lines away for Edit/Cancel/Delete. |
| 8 | Game-Day console, `game/[eventId]/page.tsx:1043-1064`, `:941-943` | Well gated overall (server-derived `can`, read-only console, "runs the bench" line) — but the no-lineup card is not gated on `readOnlyViewer`, so a helper reads "No lineup saved for this game yet" and "Score and attendance still work tonight", both false; review mode links "Playing time — season report ›" into hidden Insights. |
| 9 | False empty states after a refused read: `roster/page.tsx:717-734` ("Your roster is empty" + Export button), `documents/page.tsx:152-176` ("No document templates yet"), `history/results/panel.tsx:130` ("couldn't be loaded — refresh to try again"), `accounting/page.tsx:549` (Retry that can only fail again), `development/board/page.tsx:56-60` (raw error text) | Each teaches the helper something untrue about the team's data, or invites a retry that cannot succeed. |
| 10 | Legacy redirects: `attendance/page.tsx:15` → Insights; `depth-chart/page.tsx:6` → roster; the masthead's "Game day" link (`layout.tsx:104-107`) and `gameDayEntryHref` (`lib/coach-game-day.ts:70-78`) take no capabilities | Doors into pages above. The game console one is mitigated because the console is correctly read-only. |

### C3. Reads gated on the wrong half

| # | Where | Issue |
|---|---|---|
| 11 | `practice-plans/past-seasons/route.ts:45` GET on `canWriteDevelopment` | The other two past-plan reads use `canReadPastPracticePlans`; the predicate's own JSDoc claims to be the single gate for this. |
| 12 | `development/drills/route.ts:54`, `plan-templates/route.ts:51`, `[templateId]:33` GETs on `canManageSchedule`; `drills/past-seasons:59`, `plan-templates/past-seasons:41` on `canWriteDevelopment` | The focus/staff/equipment tag libraries the same screens read use `canManageSchedule ‖ canViewDevelopmentGoals`; a notes-only assistant can read the vocabulary but not the drills tagged with it. |
| 13 | `money-imports/route.ts:44` GET on `canWriteMoney` | Deliberate per its comment; the only money read not on `canViewMoney`. Consistent or not is a call, not a bug. |

### C4. Predicates that exist in the nav only

`canConfigureTeam` has **zero** API call sites (the Settings PATCH uses three per-branch gates
instead) and `hasNonMoneyRecordAccess` has **zero** API call sites — the "treasurer loses Insights"
narrowing (owner ruling 3, 2026-08-18) is enforced by hiding the door; every Insights API behind it
still answers a money-only assistant. Neither is a data leak (a treasurer is staff), but
`coach-capabilities.ts:290` promises "each predicate mirrors the `denyUnless` gate on the matching
API route" and for these two there is no matching gate.

**What is right and should stay right:** Lineups (both pages), Practice plans (hub, plan, run
screen), Tryouts, Staff, Settings ("There are no settings you can change for this team"),
Season's End (uses the paired predicate correctly), the Skills & Goals hub, the helper's Overview
(`CoachHelperHome`), and the whole money API (every read on `canViewMoney`, every write on
`canWriteMoney`). The game console's server-derived `can` object is the model the schedule drawer
should copy.

## 5. Findings D — the screen

**D1. The page is built around inviting; the people are underneath.** Invite card (≈300px) +
access-explainer card (≈330px) come before the first name. On a 1366×768 laptop the first staff
member is below the fold on arrival; on the owner's 1920-wide screenshots the first card is the
third screen down. Inviting happens two or three times a season; reviewing and adjusting is why
the head coach comes back.

**D2. One person = one full control panel (≈560px), stacked.** There is no view that answers "who
can see the money?" without scrolling through every card. Four assistants ≈ 2,300px; on a phone
(≤560px the grid goes single-column) roughly five screens for three assistants.

**D3. The same explanation appears three times** — the radio descriptions, the "What a helper /
an assistant gets" card, and the rail — while the grid's own hints are three words each (B4).

**D4. Invites vanish once sent.** No "invited, not accepted" row, no resend, no cancel; the
head coach does not know that re-inviting supersedes the old link (it does —
`assistant-invites.ts:71-76`). The only list of pending invites is the club admin's oversight page,
which a standalone team does not have; a stalled invite there is invisible to everyone.

**D5. Permissions are set after the fact.** The owner's own question. The invite token already
carries `initial_capabilities` (used for helpers) and is sanitised on accept
(`assistant-invites.ts:246-256`), so setting access before sending is plumbing that exists, not a
new mechanism. The cost of the current order is a second visit the head coach must remember, and
a first sign-in for the assistant with the wrong doors open.

**D6. What already works and is kept:** confirm-before-grant on sensitive grants with
person-specific wording; the compound Documents + Contacts rule; instant save with a "Saved"
live region; "also connected as a family member" and the removal copy; the helper's Overview; the
accept-invite page's four states (fixed 2026-09-10); the admin oversight page.

---

## 6. Recommendations

Numbered to match the decision table in the mockup (§09 there).

**R1. Page shape: a list of people with a sheet per person** (mockup §02, §04). One row per
person — head coach included, pending invites included — role chip, access chips (sensitive ones
amber), "Edit access ›". The sheet holds the full grid with a one-sentence explanation per
control, saves per tap as today, sensitive group visible (not folded — a sheet has room), Remove
and Make head coach in the footer. Phone: rows with a one-line summary; the sheet is full-screen.
The whole staff fits above the fold on both.

**R2. Invite = the same sheet in "new" mode** (§03): email → who are they (the app's sub-lined
dropdown — `SublinedChoice`, a name over one sentence per role — opening on "Choose who they are"
with nothing preselected; the section beneath is a quiet note until a role is picked, the same
cold-open shape the money screens use) → what they'll be able to open (preset prefilled, editable,
each control explained) → Send. Why a dropdown and not radio cards: the house rule (owner,
2026-08-22) is that a one-value field is a dropdown, and radio-rows-with-sub-lines are exempt only
where the choice cannot be changed afterwards; the role can be changed from the same sheet at any
time, so the exemption does not apply. Four options with a sentence each is also exactly the case
the component was built for. All sensitive grants in the invite confirm once, together, at send. The email says what
they will be able to open.

**R3. Pending invites are rows**, with the expiry countdown, Resend, Cancel, and the starting
access editable until acceptance. Standalone teams get this for the first time.

**R4. Store the role as a label** (`assistant_coach` row + a `staff_kind` value of assistant /
manager / helper — one nullable column on `rep_team_staff_memberships`, mirrored onto the
projection row; or a key inside the existing `capabilities` jsonb with no migration). It chooses
the starting bundle, the word on the row, the email wording and the admin notification. **It gates
nothing** — every route keeps deciding on the individual grant, which is the property the
"preset, not a role" decision existed to protect. `staffKindLabel()` retires.

**R5. Add "Team manager" and "Team treasurer" as starting points** (four roles in the dropdown:
Assistant coach, Team manager, Team treasurer, Helper).
- *Team manager* — Schedule View + edit, Staff chat, Documents Manage, Money View + edit, Contacts &
  birthdates, Email families; Attendance, Lineups, Notes, Tryouts off. Three sensitive grants, so
  the invite confirms them in one dialog. Email subject "You're invited to help run {team}".
- *Team treasurer* — Schedule View, Money View + edit; everything else off. What that opens today
  without any further change: the roster page (money counts as a record duty, so names appear
  beside the dues — the help article's own promise), the Money hub, Settings with the Money group
  only, and dues reminders (they ride money write, not Email families). What stays shut: Insights
  (the "no money in Insights" ruling was made for this exact persona), the staff chat, guardian
  contacts. Contacts default OFF on purpose — the reminder tooling covers the chase without
  exposing addresses, and it is one confirmed tap to add. One sensitive grant, one confirmation.
  Email subject "You're invited to keep the books for {team}".
- The label is what the head coach picked (R4). A treasurer later given Attendance is still the
  treasurer; today that adjustment would relabel a helper and is impossible without a detour.

**R6. Schedule becomes one three-way control** — Hidden / View / View + edit — like Money and
Documents. Stored as the same two keys (no migration); the UI stops offering the nonsense state.
`canConfigureTeam` stays on the edit half.

**R7. Practice-plan writing follows "Schedule · View + edit"** (no new switch). Every existing
assistant gains it — flagged as a widening. If declined, the Schedule control's sentence must say
"plans stay with the head coach" so the coach is not surprised.

**R8. "Make head coach" on an assistant's sheet**, head-coach-only, confirms, allows two head
coaches; removing or demoting the last head coach is refused. Closes A4 for standalone teams; club
teams keep the admin route too.

**R9. Roster editing as a grantable duty (View / Edit players)** — later. Real need for managers,
but it touches the roster screens more than this one. Recorded, not drawn.

**R0 (ships first, needs no decision): the enforcement fixes in §4.** Server: gate announcements
GET, tournament-history GET, history GET, upgrade-summary GET, team-links GET. Client: gate the
schedule drawer's tabs, score form, awards, attendance editor and lineup links on their grants
(copy the game console's server-derived `can` pattern or read `page.capabilities` as the page
already does for Edit/Cancel/Delete); gate the Insights page; fix the game console's two false
lines; replace the five false empty states with the portal's standard "isn't turned on for you"
block; make the legacy redirects and `gameDayEntryHref` capability-aware. Add a unit guard in the
style of `coach-helper-preset.test.ts` asserting a helper sees no tab, link or control on the
drawer that its API would refuse.

---

## 7. Decision table

| # | Question | Recommendation | If no |
|---|---|---|---|
| 1 | List + sheet? | Yes | Keep cards; R0/R2–R8 still apply |
| 2 | Access before send? | Yes | Keep invite-then-grant; still add pending rows |
| 3 | Pending invites visible? | Yes | — |
| 4 | Stored role label? | Yes | Keep derived label and its relabel-on-edit |
| 5 | Team manager + Team treasurer presets? | Yes, both (bundles in R5) | Two starting points |
| 6 | Schedule as one control? | Yes | Two checkboxes stay |
| 7 | Plans follow schedule edit? | Yes (a widening) | Say so on the control |
| 8 | Make head coach from the portal? | Yes | Admin-only; standalone stuck |
| 9 | Roster editing grantable? | Later | — |
| 10 | Role chosen from the sub-lined dropdown? | Yes (house rule; the choice is reversible) | Four radio cards, taller invite sheet |

---

## 8. Where this departs from logged decisions, and why

Cited for their reasons, per the 2026-09-09 ruling that past decisions are reference, not authority.

- **"A Helper is a preset, never a third role" (2026-08-03).** The reason given was that "what can
  this person see?" must have exactly one answer in one place. R4 keeps that: the label is display
  and defaults, and no route or nav reads it. What the derived label costs — relabelling on any
  edit, no way to widen a helper by one duty — was not weighed at the time because the helper card
  had no controls and the case never came up. Storing the word does not create a gate; it stops a
  word from lying.
- **"Assistants never get roster write in V1" (2026-06-25).** V1 reasoning: least privilege and a
  smaller build. Still sound as a default; no longer sound as an impossibility once a manager
  persona exists. Hence R9 as "later", not "now".
- **Practice-plan writes head-only** (Practice Plans P1, riding Development D1). D1's reason —
  coach-judgement content about a minor — does not describe a drill sheet. R7 re-homes the gate on
  the grant whose name already says "edit".
- **Helper preselected on the invite radio** (Phase 4: "the safer accident"). With the access list
  visible under the choice and nothing sent until the head coach reads it, there is no accident to
  protect against; forcing the choice is clearer than defaulting it.
- **The Sensitive group folded by default with a "N granted" count** (2026-07-28 / 07-31). A fix for
  a card that was already too tall. In a sheet the group is visible; the confirm-before-grant rule
  it carried is kept unchanged.
- **The 2026-07-31 layout decisions** (one section header, `quiet` empty block, standing reference
  rail, fixed two-column grid) were made for the stacked-card page. R1 replaces that page, so the
  rail and the fixed grid go with it; the "page header is the section header" rule still holds.

---

## 9. Suggested phasing

- **P0 — enforcement** (§4, R0). Small, no migration, no decision needed, closes two real data
  leaks. Ship before anything else; owner QA walk with a helper account and a default assistant.
- **P1 — the screen** (R1, R2, R3, R6): list + sheet, invite with access, pending rows, schedule as
  one control. No migration (pending rows read the existing invite table; R6 is UI over the same
  two keys). Help article `premium-staff` and the Overview's "Invite assistant coaches" step
  rewritten in the same unit of work. The coach demo seeds no assistants today; a seeded assistant
  and a pending invite would let the sandbox show this screen (a demo moment to consider).
- **P2 — the model** (R4, R5, R7, R8): stored role label, Team manager, plans on schedule edit,
  Make head coach. One nullable column (or a jsonb key), invite email variants, admin oversight and
  approval-notification wording, the accept page's copy.
- **P3 — later** (R9): roster editing as a grant.

## 10. Open questions for the owner

1. Team manager bundle — should it include Attendance (some managers do the sign-in sheet)? Drawn
   without it; it is one tap to add.
2. Two head coaches: allowed (R8 as drawn), or strictly a hand-over that demotes the current head?
3. R7's widening — every existing assistant gains plan writing on deploy. Acceptable, or grant it
   only to newly invited assistants?
4. Should a pending invite be shown to the club admin *and* the head coach, or only the head coach
   (with the admin keeping today's oversight page)? Drawn as both.
4b. (Found building pass 1.) Should money count as a duty that opens **awards**? `canManageAwards`
   is "any record duty", money included, so a treasurer can give a player award today. The
   schedule panel mirrors the route (pinned in `coach-schedule-doors.test.ts`); flagged for the
   preset work in pass 2 rather than narrowed on the way past.
5. Treasurer bundle — Contacts & birthdates off by default (drawn), on the reasoning that dues
   reminders go out without exposing addresses? A treasurer who records e-transfers by payer name
   needs the roster names, which are baseline, not the guardian email.
6. Treasurer and the staff chat — off by default (drawn). The room is where coaches discuss
   children; a treasurer has no reason to be in it unless the head coach wants them there.
