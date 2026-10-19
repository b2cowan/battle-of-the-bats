# Free coach header parity — plan

Brief: `FREE_COACH_HEADER_PARITY_PM_BRIEF.md` · Hub: https://claude.ai/artifact/EA2D38WeFe9mk4Qji9535y (source `FREE_COACH_HEADER_PARITY_HUB.html`, built by `.probe/fchp/build.cjs`) ·
Ruling: `memory/design_decisions.md` 2026-10-13 "A FREE COACH'S HEADER IS THE PAID COACH'S HEADER".

## 1. The ruling (owner, 2026-10-13)

Asked on a free coach's tournament page, which wears the fan app's Home · Scores · Chat · Account bar:
*"I think the account dropdown and notificaitons bell should be the same for free tier coaches, changing the format of
this header does not make sense to me (move the account button and change what it looks like?)"*. Then three asks,
each ruled as recommended:

| Ask | Ruled |
|---|---|
| What should a free coach's bell do, given they are sent nothing to it today? | **Fill it, then show it.** Free coaches start receiving bell notices for what they are already emailed, from every host club; the bell ships with that content. |
| How closely should the free desktop header match the paid one? | **Match it exactly.** Wordmark · Coaches Portal · bell · account menu (· Workspaces). The fan-app links leave; Chat comes back to the free portal's left menu, as in the paid sidebar; the wordmark goes Home. |
| Include the phone now? | **Desktop now, phone next.** The phone gets its own drawing once this is ruled. |

Supersedes, on a computer only, the 2026-07-25 two-family ruling's consumer top bar for the free portal
(`FREE_COACH_PORTAL_EXPERIENCE_PLAN.md` Phase A2.1).

**The drawing's eight asks — ruled 2026-10-13, every one as recommended** (the owner's paste-back, key
`fchp-asks-v1`, on hub v2):

| # | Ask | Ruled |
|---|---|---|
| 1 | When Chat shows in the left menu, and where it opens | **Only when the coach has a chat, or one is coming; it opens inside the portal.** |
| 2 | The left menu's "Coaches Portal" label | **Remove it.** |
| 3 | Help at the foot of the left menu | **Yes, as in the paid sidebar.** |
| 4 | What the bell carries | **The emailed kinds plus game changes** (the §4.1 "Yes" rows). |
| 5 | Who on a free team gets the notices | **Every coach on the team.** |
| 6 | The host's email switches | **The bell ignores them.** |
| 7 | The rest of the computer frame | **Leave it in this piece; look again with the phone step.** |
| 8 | The pending-invitations count on Home | **An invitation becomes a bell notice.** |

The `/design` pass's applied changes (DC1 the Chat row's unread count, DC3 Help in the menu's own link style with the
what's-new dot, DC4 no drawer footer, DC5 a time alone under a day heading) are in the drawing the asks were answered
on; DC7 (a payment reminder waits under Needs attention) is a proposal the owner has not ruled — the build prompt
asks it. Build: `FREE_COACH_HEADER_PARITY_BUILD_PROMPT.md`.

## 2. What the code does today

- **Free portal (`/coaches/*`).** `CoachPortalShell` mounts `ConsumerNav variant="coach"`: a 48px warm top bar with the
  text wordmark, Home · Scores · Chat · Account as links, and the operator cluster (`holdsWorkspace` hides Pricing and
  the persona menu; the coach door is suppressed inside its own shell, so a one-place coach sees nothing on the right).
  A 248px rail carries a "Coaches Portal" eyebrow, the team identity block, Overview · Tournaments · Tier-2 · Explore,
  and a "Live on FieldLogicHQ" footer. Help and Send feedback live on the Account page (A2 moved them there).
- **Paid portal (`/{org}/coaches/*`).** `CoachTopStrip`: `BrandLockup` (mark + wordmark) · divider · "Coaches Portal" ·
  `NotificationBell` (org-scoped) · `AccountMenu` (identity · Warm/Dark · Notification settings · Send feedback ·
  Account settings · Sign out) · `WorkspacesPill`. The sidebar carries Chat and, at its foot, Help.
- **The bell is a club's.** Every `notifications` row carries an `org_id`; `GET /api/notifications` requires `orgId`
  and returns nothing without one; `notify()` addresses a club's members (or explicit user ids within that club's
  dispatch). A free coach has no club of their own, and today no bell row is ever written for one — acceptance,
  decline, payment and the other coach messages go by email only (inventory in §4).

## 3. Scope

**In:** the free portal's desktop chrome (>900px) — the strip, the doors it displaces (Chat, Help), and the bell's
content for free coaches. **Out:** the phone (≤900px keeps the fan-app bottom bar until its own step); the rest of the
frame (rail width, the team header vs. the paid masthead) unless Ask 7 says otherwise; any change to the paid portal.

## 4. The bell's content

### 4.1 What a free coach is sent today (inventory, 2026-10-13)

Recipient for every email: the registration's coach email (`teams.coach_email`, else `teams.email`) — one address per
team; other coaches on the free team (`basic_coach_team_users`) get no email at all. Host switches = the tournament's
`coach_email_*` settings and the master pause.

| Kind | Channel today | Host can switch it off | Proposed for the bell |
|---|---|---|---|
| Registered / placed on the waitlist (public form) | Email | Yes (confirmation switch) | **Yes** |
| Added by the host (by hand with "notify team", or a CSV import with portal emails on) | Email | Per action only | **Yes** |
| Accepted · Declined | Email | Yes | **Yes** |
| Payment recorded (full payment only) | Email | Yes, or "not tracked" | **Yes** |
| Payment reminder (host clicks Send) | Email | Manual | **Yes** |
| Schedule published | Email | Yes (publish checkbox, switch, plan) | **Yes** |
| A game moved, cancelled, or back on | **Push only, and only to followers** (the coach follows by opening an accepted record while signed in) | No | **Yes — Ask 4** (not emailed; the most useful notice a coach can get) |
| Announcement from the host | Email (and push to followers) | Per post | **Yes** |
| Final results posted | Email | Yes | **Yes** |
| Game-day reminder (the evening before) | A timed email | Yes | **Not in v1** — a bell row needs its own timer; written at publish it would appear a week early |
| Access link · chat sign-up reminder | Email | Manual | **No** — they exist for coaches without an account, who have no bell |
| Chat message, mention, poll | Push (no bell by design) | — | **No** — Chat has its own count |
| Score, playoffs set, champions | Push to followers | Plan | **No** — fan alerts; they belong to Scores |
| "Your team home is ready" | Email | — | **No** — the coach just did it |

Waitlisting by the host, promotion from the waitlist and a deposit marked paid send the coach **nothing** today; the
bell does not invent new messages in v1 (they are noted as a follow-up, not ruled).

### 4.2 Facts the build must respect

- `notifications.org_id` is NOT NULL (dictionary + both snapshots); so is `notification_preferences.org_id` (part of
  its key). A free coach's row is filed under the HOST club.
- The bell is org-scoped end to end: `NotificationBell` → `useNotificationUnread` / `useNotificationFeed` → `GET
  /api/notifications?orgId=` (empty without one) and mark-all-read by `orgId`. Mark-read, clear and delete go by row id.
- `notify()` resolves recipients as a club's members unless given `userIds`, and also sends push and email by
  preference — a free coach's notice must be **bell-only**, or the coach gets the existing email twice.
- Account → Notifications has no card for a free coach (`coaches_basic` contexts carry no org slug; the page skips
  them). The paid strip's settings link focuses `coach-{slug}`.
- The phone: this piece adds no phone door, so rows written for a coach on a phone wait for the phone step.

### 4.3 Proposed shape (settled in the build prompt)

A free coach's notice is a bell row filed under the host club and **marked as a team-coach notice** (an event-type
family or a metadata audience — the build prompt picks one). The host club's own bells (admin strip, paid coach strip,
phone pages) exclude that mark, so a person who is also that club's staff never sees a coach notice there; the free
portal's bell reads only that mark, across every club. Recipients: the accounts on the free team (Ask 5), resolved at
send time. A new card on Account → Notifications ("Coaches Portal · your free teams") carries one switch per kind;
where its choices are stored is a build-prompt decision (the preferences key needs an org).

## 5. Approach

1. **The strip.** The free shell mounts the same strip component as the paid portal, not a lookalike: one component,
   so the two cannot drift. It needs a mode where the bell is the free coach's (no club) — the one place the two differ.
2. **The free coach's bell.** A free coach's notices are rows like any other, filed under the HOST club (`org_id` =
   the tournament's club) and marked as addressed to the team's coach, so a person who is also staff of that club
   never sees a coach notice in the club's admin bell, nor club admin rows in the free portal's bell. The free bell
   reads the person's coach notices across every host club (§4.3).
3. **Chat in the left menu.** Under Tournaments on a computer, carrying the red unread count the fan bar's CHAT link
   carries today (the paid sidebar's `ChatUnreadBadge`), and opening the chat INSIDE the portal (the shared
   `CoachChatView`, the paid portal's chat screen; it already lists every room the person belongs to). Opening the
   fan app's Chat tab instead would put the coach back in the fan-app header — the thing this removes. (Ask 1.)
4. **Help at the foot of the left menu**, in the menu's own link style with the what's-new `ReleaseDot`, as in the paid sidebar (the 2026-09-01 account-menu ruling keeps Help out
   of the menu; on the free portal it reached Help only through the Account tab, which leaves the strip). (Ask 3.)
5. **The rail's "Coaches Portal" eyebrow goes** — the strip says it (the paid portal deleted its own for the same
   reason, 2026-08-17). (Ask 2.)

## 6. The asks (all ruled 2026-10-13 as recommended — see §1)

Kept as drawn, with the recommendation first, for the record.

1. **When Chat shows in the left menu, and where it opens** (amended 2026-10-13 after a production case: an accepted
   coach whose Tournament Plus organizer had not yet opened chat found an empty Chat page; free events have no chat
   at all). Only when the coach has a chat or a tournament whose organizer can still open one, opening inside the
   portal (rec.) · always shown, inside the portal · always shown, the fan app's Chat tab.
2. **The left menu's "Coaches Portal" label.** Remove it — the strip says it (rec.) · keep it.
3. **Help at the foot of the left menu.** Yes, as in the paid sidebar (rec.) · Help stays on the Account page only.
4. **What the bell carries.** The §4.1 "Yes" rows, including game changes (rec.) · only what is emailed today (no
   game changes).
5. **Who on a free team gets the notices.** Every coach on the team (rec.) · only the account the emails go to.
6. **The host's email switches.** The bell ignores them: they are named as email switches, and the status they
   announce already shows on the coach's page (rec.) · the bell follows them.
7. **The rest of the frame** (rail width 248 vs. 220, the team header vs. the paid masthead). Leave it in this piece;
   look again with the phone step (rec.) · match it now.
8. **The pending-invitations count on Home** (the fan bar's HOME link carries it; the paid strip has none). An
   invitation becomes a bell notice — it is emailed today, so it meets the bell ruling (rec.) · no count on the strip.
   (Raised by the `/design` pass, DC2.)

## 7. Rollout

Desktop-only chrome change plus new bell rows; no plan gate (the free portal is free). Help-docs sync (`/docs`): the
coaches guide's "Where did the portal's menu go?" FAQ and getting-around paragraph describe the fan-app bar. Demo
sandbox: the coach demo is a paid portal; no change. Layout sweep: the free portal's desktop screens re-baseline.

## 8. The build (2026-10-13)

Built from `FREE_COACH_HEADER_PARITY_BUILD_PROMPT.md` the same day, on `dev` (the commit waits for the owner's word; its hash is recorded
here when it lands). Build-start answers (owner, 2026-10-13): the two 10-13 fixes reviewed and committed first
(`fc4ce4b3` theme/countdown, `b900fd85` coach's empty Chat tab); **B1–B3 as recommended**; **B4 = DC7 as recommended**
(a payment reminder waits under Needs attention); **Part 4 (the per-kind switches card) deferred to the phone step** —
it was never drawn, needed a migration, and switches over a silent bell-only notice do little; the Pause switch governs
the free bell meanwhile; free-coach test data may be created on dev.

**What was built**
- **Two bells that never overlap.** A free coach's notices are their own event kinds (`team_coach_*`,
  `TEAM_COACH_EVENTS` in `lib/notification-labels.ts`), filed under the HOST club. One rule
  (`lib/notification-bell-scope.ts`) drives the server's list, count and Mark all read and the browser's live count: a
  club's bell excludes the kinds; the free bell (`/api/notifications?scope=team-coach`) reads only them, every club. A
  guard test pins that no other file reads the table.
- **The writer** (`lib/team-coach-notices.ts`, pure rules + words in `lib/team-coach-notice-plan.ts`): bell rows only,
  never `notify()`; every active seat on a genuinely free team linked to the registration (a Premium team's free
  shadow is skipped); paused accounts skipped; demo clubs silent; the actor excluded; best-effort, never throws.
- **Senders wired** (outside the host's email switches, A6): accepted / declined / payment recorded (Teams screen and
  bulk), payment reminder, schedule published (once per division going live — the publish write itself says which;
  every plan, owner 2026-10-14), a game moved / cancelled / back on (the schedule-change sweep, same hold and
  cooldown as the push, every plan), an announcement emailed to teams (the message is the body), final results posted
  (on the transition into completed; every plan, owner 2026-10-14), a club's coach invitation (A8).
- **The strip**: `CoachTopStrip free` mounts in the free shell on a computer (its bell is the coach's own; settings
  open Account → Notifications); the fan app's top bar no longer renders there (`ConsumerNav variant="coach"` is the
  phone bar only). **The left menu**: no eyebrow; Chat under Tournaments only when there is a chat or one is coming
  (`/api/coaches/chat-door`), with the unread count; Help at the foot with the what's-new dot. **Chat inside the
  portal**: `/coaches/team/{id}/chat` renders the paid chat screen, or the waiting screen before any room.
- **Words** reviewed by `/marketing` 2026-10-13 (three changed: the waitlist body no longer promises "they'll let you
  know", the schedule body reads "{club} · {team}", the registered label covers the waitlist). **Help** synced by
  `/docs` (getting around, the menu FAQ, the chat FAQ, a new "What shows up in my notification bell?", the game-change
  FAQ).

**Deviations from the prompt, verified in code**
- **"Added by the host" is not in the bell.** A team a host adds (by hand or by import) is linked to nobody's free team
  until the coach follows the emailed link, so there is no one to tell — the notice could never fire. The free
  tournament tier build turns that email into an invitation; that is where it can earn a bell notice.
- **A8 is a club's COACH invitation**, not an `organization_members` invitation: an organization invite to an existing
  account adds them at once (no pending invitation), and a new address has no free team. The club's coach invitation
  ("UAT Rep Club invited you to coach 15U AAA", the hub's own example) waits on Home and is the one a free coach gets.
- **Schedule published, final results and game changes reach the bell on EVERY plan** (owner, 2026-10-14, asked at
  the build: "every plan gets both") — the bell records what happened; the emails keep their own plan rules.
- **A payment reminder is in the bell only where its email went** (a team with an address); the host's switches are not
  involved (reminders are sent by hand).
- **The Chat row's count is the shared lime `ChatUnreadBadge`** the paid sidebar wears (owner, 2026-10-14: "lime, as on
  paid"); the drawing had coloured it red.

**Verification so far**: unit tests (`tests/unit/team-coach-notices.test.ts`, 27; the notification suites 93/93);
typecheck clean; lint clean on every touched file (only pre-existing warnings); the changed-files gate clean for this
build (its two reds — the snapshot watermark for another session's mig 329, and a `GuidanceRail` selector clash — are
not this build's). `/simplify` (seven fixes applied) and `/review` at high (five lenses; five low/medium findings
confirmed and fixed, one refuted; the required lens — an org-staff member who is also a free coach never sees a coach
notice in the club bell, nor club rows in the free bell — found sound). **Run 2026-10-14 on dev** (owner OK for the browser): the FCHP test world (`.probe/fchp-build/seed-fixture.mjs`); a
browser check of the built screens, 20/20; `check:layout --only` on the paid coach overview, coach notifications and
admin notifications (no new findings — the registry has no free-portal screen yet); `/design` at 1440 against
drawings 2–4 (one Medium fixed: the "no chat yet" page wears the portal's section frame); an end-to-end run of the
senders, 13/13; a club invitation landing in the free bell. The owner's walk: ledger §311, the hub's QA tab.

**Committed `ad0267e4` 2026-10-15 on the owner's word ("commit"), without the public registration writer** (49
files; type-checked clean on a clean copy of exactly that commit). Owed after it:
- ~~The public registration writer~~ — **BUILT 2026-10-15** (below), from
  `FREE_COACH_HEADER_PARITY_REGISTERED_BUILD_PROMPT.md`, once Register Your Existing Team committed its route (`8e318e4f`).
- **The phone** (the 2026-10-13 ruling's second half). **Design prompt:** `FREE_COACH_HEADER_PARITY_PHONE_DESIGN_PROMPT.md`
  (2026-10-15). It treats the bottom bar as the 2026-07-25 two-family business decision it is: the Business Decisions
  Log has no entry for the 10-13 computer change either.
- ~~The owner's QA walk~~ — **§311 CLOSED by the owner 2026-10-14** (not passed: thirteen writing steps in W2, W3,
  W4 and W5 left no trace on dev; the ledger names them).

**The registration notice — built 2026-10-15 on dev** (the owner: "Build it as described"), **committed `c3ba568f` the same day on
the owner's word** ("go ahead and commit"). When a coach registers their free team through the public form, signed in with the team picked,
every OTHER active coach on that team gets *"{team} is registered for {tournament}"* / *"Sent to {club} for review"*,
or *"{team} is on the waitlist for {tournament}"* / *"Sent to {club}"* (the /marketing words of 2026-10-13, unchanged).
- **The writer** (`app/api/register/route.ts`): after the slot claim and the waitlist block, so the words follow the
  FINAL status; awaited beside the emails, outside the `coachEmailEnabled` switch (A6); only when the link to a team
  finished without throwing (`linkedCoachId`); the submitter excluded. The status → words choice is
  `registrationNoticeWords` in `lib/team-coach-notice-plan.ts`. It opens the entry's record, as every kind does.
- **Who it actually reaches** (the honest answer to "why did my test light nothing?"): a brand-new team, nobody (the
  submitter is its only member); an existing free team, its co-coaches; a Premium team, nobody (its twin is skipped —
  Premium bells are not in this project); a coach who registers signed out, nobody at submit time (the entry joins a
  team only when they follow the email — the same reason "added by the host" was dropped).
- **Help** (`faq-coach-free-bell`): /marketing's line — the list's intro now reads "what happens with your team" (a
  registration is a coach's act, not an organizer's), first bullet *"another coach on your team registering it, or its
  entry going on a waitlist"*, the same in `answerText`; keywords `registered`, `registration`, `waitlist`,
  `waitlisted`, `another coach registered`.
- **Verified:** unit tests 31/31 (`tests/unit/team-coach-notices.test.ts`: the words follow the status; co-coaches
  hear it, the submitter does not; an unlinked entry or a team only the submitter is on tells nobody; a source guard
  that the call follows the link, the final status, and the email switch's closed block). Typecheck clean; lint clean
  on the four files; the changed-files gate's only reds are four already on `dev` (the two stylesheet unit tests from
  `07c2af40`, the house-league old-look count, the GuidanceRail selector clash, the mig 329 snapshot watermark).
  **End to end on dev, 20/20** (`.probe/fchp-build/e2e-registered.mjs`, the real form as Avery: U13 → pending →
  Blair's bell "registered"; U11 full → waitlist #1 → Blair's bell "on the waitlist"; Avery's bell empty both times;
  rows filed under the host club; Blair's club bell never shows them; Blair opens the notice onto the page).
  The FCHP world gained **FCHP Open Cup** (FCHP Plus Club, in three weeks; U13 six open spots, U11 full).
- **/review at medium** (security + correctness lenses; the required lens — can a notice land on a team the
  submitter cannot register? — proven sound: the D1 check before the insert, the signed-in email match, the link's own
  re-check and fresh-team branch, and the flag set only after the link). One Medium fixed (the placement guard compared
  positions; it now brace-matches the email switch). Pre-existing, unchanged: a failed waitlist UPDATE leaves the
  entry pending while the email and notice say waitlist; one teammate can repeat entries into their own team's bells
  (as with the emails); a Premium twin missing its back-link would count as free (0 of 6 on dev; production unread).
- **Owner walk:** ledger §313, the hub's QA tab **W6** — ✅ marked complete 2026-10-16 on the owner's word.
- **A finding for the walk, not a defect:** a signed-in coach gets no success screen — Submit goes straight to the
  entry's record (`?welcome=1`), so the walk says so.

**Found on the way, not this build's**: `PATCH /api/registrations/[id]` has no caller in the app, and lets any
signed-in organization member change ANY team's status or payment (it checks sign-in, never the team's club), and its
GET answered without sign-in with a team's coach email. **Removed on the owner's word, committed `43ce9cbb`
2026-10-14** (its own commit, as the unused send-message route was, 2026-10-12).

## 9. The phone (drawn 2026-10-15; redrawn the same day to the owner's team-bar direction; RULED 2026-10-15, §9.4)

From `FREE_COACH_HEADER_PARITY_PHONE_DESIGN_PROMPT.md`. Drawn on the hub's **Phone** stage (Mockup tab), with real
captures of today taken read-only on dev at 390 × 844 (Avery, `fchp-coach-a`; the club test coach for the paid phone).
The asks are renumbered in the order they must be answered: the bar first, because one bell option exists only with
the team bar (prompt P2 → P1 here, P1 → P2, P6 → P4, P4 → P5, P5 → P6).

### 9.1 What the phone does today (verified in code and captured, 2026-10-15)

- **Free portal at 900px and below:** the sticky team header (eyebrow, team name, lifecycle chip, the Flip in event
  context) with the scrolling section tab row (Overview · Tournaments · turned-on tools · Explore); the fan app's bar
  Home · Scores · Chat · Account at the foot. **No bell and no notifications page**: Avery has four notices, two
  unread, and no way to see them on a phone. Home carries the red count of pending invitations; Chat opens the fan
  Chat (`/chat?back=…`); Account opens the account page (identity, Warm / Dark, Notification settings, Install app,
  Coaches Portal help, Send feedback, Help & support, Sign out).
- **Paid portal at 900px and below:** the masthead, then the bar Overview · Schedule · Chat · Roster · More. The
  unread count rides **More**; the sheet's first row is **Notifications**, which opens the full page
  (`CoachNotificationsPage`): no Back arrow, More lit (the 2026-09-25 ruling). The bell's drawer exists only beside
  the computer strip. **The paid phone has no account menu**: Help and Sign out sit in More, and there is no Warm /
  Dark control in the portal on a phone.

### 9.2 What the code changes about the asks (said before drawing)

1. **The paid bar cannot be handed to a free team as it is.** Its tabs are Schedule and Roster, paid season tools; the
   free portal's Schedule and Roster are optional tools that most free teams never turn on, and the free portal's
   team sections already live in the tab row at the top. The honest second option is **a team bar** (Overview ·
   Tournaments · Chat · More) that replaces the tab row: a re-chrome of the free phone portal and the end of the
   2026-07-25 consumer shell, not a header change.
2. **"The same account menu" has no paid twin on a phone.** What does have a twin is the bell's structure: a count on
   the bar's last tab, and Notifications as the first row inside it.
3. **A defect in what shipped on the computer (`ad0267e4`).** The free strip's bell and account menu send the coach to
   Account → Notifications. For an account that follows no team and holds no club role (a coach whose team is still
   pending, before the record auto-follows), that page shows *"Nothing to manage here yet … once you follow a team,
   join an organization, or coach a team"* and **no Pause switch** (`AccountNotificationsClient`: the empty state wins
   when there are no cards and no fan card). So "Pause governs the free bell" holds only once the coach follows their
   team. Every P5 option below includes the fix.

### 9.3 Round 1 — as first drawn (hub v11; superseded by the owner's direction, §9.4)

| # | Ask | Recommended | The other options |
|---|---|---|---|
| P1 | Which bottom bar a free coach uses | **Keep the fan app's bar** (Home · Scores · Chat · Account). The 2026-07-25 value ladder stands; Scores and Chat stay one tap away on a game weekend. | A team bar (Overview · Tournaments · Chat · More) replacing the tab row: one shape for a coach who holds a free team and a paid team, at the cost of the consumer shell and the "companion vs. HQ" difference. |
| P2 | Where the bell lives on a phone | **The count on the Account tab; a Notifications row on the Account page, under the identity card.** The paid phone's structure (count on More, Notifications first in the sheet); the count travels with the coach to Home, Scores and Chat, where a moved game matters most; the bar does not change. | A bell in the team header, top right beside the Flip (inside the portal only); the count on More, Notifications first in its sheet (only with the team bar). |
| P3 | Where the feed opens | **A page under Account**: the paid page's body (Unread / All, Mark all read, Needs attention with Done, days), the settings gear and "?" in its title row; Account lit, no Back arrow; a notice opens the shared reader. | A menu-layer sheet over the page the coach is on (it sits on the bar, by the 2026-10-05 sheet ruling). |
| P4 | Chat on a phone | **The bar's Chat tab, as today** (the same rooms, its own count, one tap from anywhere). | Chat joins the portal's tab row when there is a chat, opening the portal's chat screen (as the computer's left menu); the bar's Chat stays, so the phone has two Chat doors. |
| P5 | The settings card | **No new card. Pause shows for every account with a free team, and the bell's settings door lands on it.** No database change. | A card that names what the bell carries, with no switches; a switch per kind (bell only), which **needs a migration** (one account-level column on `user_notification_settings`). |
| P6 | The computer's rail width and team header (A7) | **Leave them.** | Match the paid frame (a 220px menu and the masthead). |

**Surfaced, not asked:** push. A free coach's bell notices are bell-only by design (never through `notify()`, so no
second email). Game changes already reach an accepted coach's phone as a push through the auto-follow (Account →
Notifications → Followed teams → Event news). Making every bell notice a push is its own ask with its own costs.

**The `/design` pass (2026-10-15)** found nine things (PDC1–PDC9, the hub's Phone → Design check), all applied to the
drawings as proposals: the Dark count uses the deeper danger red (the computer bell's 2026-10-05 contrast fix); the
count's colour difference between the two phones is named (red on the fan bar, olive on the paid bar); the header
bell's cost to the title column is stated; the free More sheet ends Help · Sign out as the paid one does; Notification
settings wears the gear so the Account page carries one bell; the Notifications row sits under the identity card; the
P3 sheet is a menu-layer sheet; P5's (b) and (c) would make two cards about one team once it is followed (the
2026-07-28 one-card ruling's trap); the tab row's edges fade. **Reported, not this piece's:** the fan bar's own Home and
Chat counts in Dark use the bright red with white digits (3.76:1), the contrast defect the computer bell fixed on
2026-10-05/06.

### 9.4 The owner's direction and round 2 (2026-10-15)

**Owner, on round 1:** *"I'm kind of thinking we need to make it more like the premium portal with using the nav at the
bottom and not the main page nav, so have overview, tournaments, chat and more. when they add the basic modules we just
add them to more (i.e. roster or schedule)"*. Agreed, and said so: round 1 under-weighted the 10-13 computer change —
the free portal on a computer already wears the paid strip and a left menu of the team's sections, so keeping the fan
bar on the phone left it the one product that changes family with the screen width. One fixed bar that never grows as
tools are turned on is also simpler than the paid bar. The risks were named before redrawing: the 2026-07-25 business
entry reverses fully (`/strategy`); Explore loses its always-visible spot (the B3 "one tap away" success criterion);
Home and Scores become two taps and open the fan app; coaches with no chat; the larger build.

**Round 2 (hub v12, the Phone stage):**
- **The bar:** Overview · Tournaments · Chat · More, in the paid bar's look and order. Overview lights on the team's
  Overview; Tournaments on the team's list and every record page; More on Notifications, a turned-on tool, or anything
  else More opens. The phone's section row retires; the team header drops from 133px to 88px and keeps the team, the
  event line and (in a tournament) the Flip; a multi-team coach still switches from the team name.
- **More:** Notifications first, with the unread count (the count rides More, olive, as on the paid phone); then the
  team's turned-on tools as tiles (Roster, Schedule, Fees, Announcements, in that order) with **Explore always the last
  tile**; then the fan app's Home and Scores and Account; then Help · Sign out (the paid foot). A menu-layer sheet.
- **Notifications:** the paid `CoachNotificationsPage` body in the free portal, More lit, no Back arrow, **no team
  header** (the list covers every team, as the paid page has no masthead; RDC1). Its gear opens Account → Notification
  settings with "Back to your Coaches Portal" pinned.
- **Chat:** the bar's Chat opens the portal's chat (the A1 screen) under the team header.
- **Follows, not asked:** all of the above. **Asked (key `fchp-phone-asks-v2`) — RULED 2026-10-15, all five as
  recommended** (owner, on hub v12: *"looks good, want to write up the build prompt?"*; read as P1–P5 as recommended,
  the reading said back to the owner). **Build prompt:** `FREE_COACH_HEADER_PARITY_PHONE_BUILD_PROMPT.md` (2026-10-15).

| # | Ask | Recommended | The other option(s) |
|---|---|---|---|
| P1 | The team bar (confirm the direction) | **The team bar; turned-on tools go into More.** | Keep the fan bar (round 1). |
| P2 | Chat for a coach whose tournaments have no chat | **Hide the tab** (the A1 rule at both widths): Overview · Tournaments · More until there is a chat. | Always show Chat, opening the waiting screen. |
| P3 | Where Explore goes | **The last tile in More**, after the turned-on tools (the A2 "Explore last" rule); the B3 "one tap away" becomes two taps, and Overview's "Your team" tiles keep their own Turn on doors one tap from the bar. | The first tile in More. |
| P4 | The settings card | **No new card; Pause for every coach with a free team** (no database change). | A card naming what the bell carries; a switch per kind (**migration**). |
| P5 | The computer's menu width and team header (A7) | **Leave them** — the phone bar now mirrors the left menu. | Match the paid frame. |

**`/design` on round 2:** RDC1–RDC5 applied (the Notifications page loses the team header; three tags moved off
controls; Home and Scores leaving the portal named in the trade). **Follow-up to raise, not this piece:** the paid More
has no Account row and no Warm / Dark on a phone; the free More gets one.

**Rulings land here, in the brief, on the hub's Decisions tab and in the design log. The `/strategy` entry amending
the 2026-07-25 two-family decision was logged 2026-10-15** ("The free Coaches Portal wears the paid portal's shell at
every width…": parts 1–2 Decided, parts 3–5 Proposed and put to the owner).

### 9.5 As built (2026-10-15/16, committed `02e0b080` 2026-10-16 on the owner's word)

**Build-start answers (owner, 2026-10-15):**
- **B1 · one bar:** **the free bar is its own component wearing the paid bar's stylesheet, imported** — the admin
  phone bar's 2026-09-29 pattern ("one stylesheet is the only way two phone bars cannot drift"). The build prompt
  recommended extracting a shared presentation component out of the paid bar; the build session pushed back first
  (three bars on two patterns; a refactor of a file seven guards read for ~40 lines of markup, while the look already
  lives in the shared sheet) and the owner chose the stylesheet.
- **B2 · overlay safety net:** `CoachesOverlayProvider` mounted in the free layout, as recommended.
- **B3 · which team, off-team:** the owner pushed back on the recommendation (*"wouldn't this just use our default nav
  with home, scores, account etc.? this is outside the coaches portal"*). Ruled after the evidence: **the team bar
  wherever the page has a team** — the team in the address, or the coach's only team — **and always on
  Notifications** (More's own page; it points at the team last opened on this device, else the first); **the fan
  app's bar where the page has none** (the front page and the all-tournaments list of a coach with several teams or
  none). A coach with no team keeps the "Get started" door under the header.
- **B4 · measuring:** probe on the FCHP world now; the free-coach UAT fixture and the free phone screens in the
  layout sweep are a follow-up (the UAT fixture files were open in the Register Your Existing Team session).

**What shipped** (rules in `lib/coach-free-nav.ts`, the bar `components/coaches/CoachFreeBottomNav.tsx`, guard
`tests/unit/coach-free-bar-guard.test.ts`): the four-tab bar (Chat by `useChatDoor`, whose `ready` holds the tabs ≤800ms
so they arrive together); More as drawn, its middle group labelled **"You"** (owner 2026-10-16 on `/marketing`'s
recommendation — the admin More sheet's label for the same group; "The app" also clashed with the help's "in the app");
the section row retired; the header hidden on Notifications; `/coaches/notifications` = `CoachNotificationsPage` in
its `free` mode; Pause for every account with a free team (`hasTeamCoachBell`, claim-only excluded through one shared
id); help updated by `/docs` (getting around, the menu and bell FAQs, Explore, the record page, tournament chat).

**Found on the build's own probe, fixed:** the free Notifications page showed the paid empty words (assistants, the
Sunday review) — it uses the free bell's; the free shell never published `--coach-foot-clear`, so the reader sheet
would have sat wrong — it does now.

**`/design` on the build (390 and 360, Warm and Dark, against hub screens 2–6):** no departures from the drawings. Two
defects shared with the paid bar, fixed on the owner's word ("go ahead and fix") in every phone bar: More's name sat
2px above the other tabs (a button does not inherit line height); a bar's unread count never heard that a notice was
READ until the page reloaded (Realtime carries inserts only) — the notification lists now announce a change once its
request lands and every count for that bell re-reads (the latest read wins, from `/review`).

**`/simplify`** (four lenses): seven cleanups applied (one store for the remembered team; the chat wait inside the
hook; the bar branch; the marker private; the tool-path helper; the shell reads addresses through the nav rules; the
claim-only id named once). Skipped on purpose: the four existing "9+" helpers, one shared unread count for the strip
and the bar (the paid portal deliberately keeps two), the page's `free` mode (mirrors the strip's).
**`/review` at medium** (four lenses — security, correctness, regression, concurrency): one Medium fixed (out-of-order
count re-reads); refuted — Pause does silence the free bell (the writer skips paused users), the bar cannot point at a
foreign team, club and free notices cannot cross. Advisory: a help drawer opened over a form window can leave the page
scroll-locked (unreachable in the free portal today; the paid portal carries the same pattern); for ≤6 seconds after
deleting an unread notice, reading another can show the count one high.

**Proven:** unit 7,387 of 7,389 (the two failures pre-date this build: the club Stage 6c rail-scrollbar guard and the
`.occGroupPermit` ink guard); typecheck and focused lint clean; the verify chain clean except three pre-existing
ratchets (house-league admin-old-look 130→131, the snapshot watermark behind migration 329, the GuidanceRail selector
clash); a scoped layout sweep of the paid bar's three screens at four widths, no new findings. Rendered on dev, as Avery,
Casey and Avery seated on two teams (each temporary row removed): every ruling above, the count dropping 3→2 the moment a
notice opens, the bar gone under a "Remove player?" window, Pause for a coach with no follow.

**Follow-ups, not built:** the free-coach UAT fixture and free phone screens in the layout sweep (B4); one
`--bottom-bar-clear` token for every shell, and one data attribute for every phone bar's keyboard rule; the paid More
has no Account row and no Warm / Dark on a phone (raised, not asked); the "9+" helper in one place.
**Owner walk:** ledger §315, the hub's QA walk tab, W7–W9 — ✅ marked complete 2026-10-16 on the owner's word (no paste-back; the dev read-back found no trace of W8 or W9, see the ledger).
