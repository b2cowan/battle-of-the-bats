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

**Committed 2026-10-15 on the owner's word ("commit"), without the public registration writer** — the commit that
carries this line. Owed after it:
- **The public registration writer** (registered / waitlisted): `app/api/register/route.ts` is open in another
  session (Register Your Existing Team, Stage 1); it is added after that session commits, never inside its file.
  **With it, the help's "What shows up in my notification bell?" gets "your team registered, or put on a waitlist"
  back** (taken out of `faq-coach-free-bell`'s list and its `answerText` at the commit, so the help never promised a
  notice that does not fire).
- ~~The owner's QA walk~~ — **§311 CLOSED by the owner 2026-10-14** (not passed: thirteen writing steps in W2, W3,
  W4 and W5 left no trace on dev; the ledger names them).

**Found on the way, not this build's**: `PATCH /api/registrations/[id]` has no caller in the app, and lets any
signed-in organization member change ANY team's status or payment (it checks sign-in, never the team's club), and its
GET answered without sign-in with a team's coach email. **Removed on the owner's word, committed `43ce9cbb`
2026-10-14** (its own commit, as the unused send-message route was, 2026-10-12).
