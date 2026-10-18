# Chat pause — build prompt

> Paste into a fresh session on `dev`. Written 2026-10-18 after the owner ruled the chat evaluation (E1–E6, all as
> recommended). Read first: `CHAT_EVALUATION.md` (the why), `BUSINESS_DECISIONS.md` 2026-10-18 "In-app chat PAUSES"
> (binding), `PLAN_PRICING_FACTS.md` (chat paused on every plan; the keys stay). Hub:
> https://claude.ai/artifact/HsTsarRgc4fxjtLZ8Z3DVQ (republish the same file when you add the pause's tab and walk).

## 0 · What the owner ruled (do not reopen)

- **Chat pauses now:** every door hidden on every surface; **rooms and messages are kept** (no deletion, no migration);
  reversible by one change.
- The email tools stay exactly as they are (Communications / Messages, Email families, the club's household and season
  emails, Ask the coaches).
- The plan keys `tournament_chat` and `coach_peer_chat` keep their values (the decision's `/billing` handoff: none).
  The pause is a product switch, not a gate change.
- Messaging returns later as a different product (announcements with replies, for families). **This build does not
  start that.** Do not delete chat code.

## 1 · Blocking gate (in this order, before any code)

1. **Mockups, published as an Artifact (a new tab on the Chat hub), run through `/design` before the hand-off.** Draw,
   before (capture) beside after, at true size:
   - the **home bar** on a phone and the desktop top nav, signed in: **each candidate for Chat's place** (P2) drawn in
     the bar with the screen it opens, plus the version with the place left empty;
   - the **public tournament page's** bottom bar and desktop strip, following the same choice (P2);
   - the **paid coaches portal** phone bar: **each candidate for Chat's place** (P3) drawn the same way, plus the empty
     version; and the sidebar's Communication group without Chat;
   - the **free coaches portal** phone bar and left menu (P4);
   - the **tournament admin** phone bar in each phase that carries Chat today (Open, game day): **each candidate for its
     place** (P4) drawn the same way; and the rail;
   - the **dashboard's Coaches card** (see P5);
   - **one whole screen before and after** per surface (the bar change is cumulative: check nothing else moved).
2. **A plain-language summary for the owner** (AGENCY_RULES: the PM UX plan): what people see differently, by role.
3. **The asks below**, each with a recommendation, beside the drawing that answers it.

## 2 · Asks for the owner (put them first, with the drawings)

- **P1 · What an old chat address shows** (bookmarks, old notifications, the footer link): *recommend* a quiet
  redirect to that surface's home — `/chat` → Home; a portal's chat page → that team's Overview; the admin's chat page
  → the event's dashboard (it already does this when the plan lacks chat). No "chat is paused" page: nobody pays for
  it and a notice would advertise a gap.
**What takes Chat's place in the bars (owner, 2026-10-18): do not simply remove it.** *"Rather than simply removing,
what could we use that space for in all three cases?"* For each of the three bars in P2–P4:
1. **Start from evidence:** what the bar holds today in every state (phase, plan, role), what sits behind More or in
   the side menu, and what that person reaches for most on a phone — say how you know (the nav config, the product's
   rulings, a walk). Read the nav consistency rulings first (memory `project_nav_consistency_review`; the phone-bar
   and one-toolbar entries in `memory/design_decisions.md`) so a candidate does not reopen a settled bar by accident;
   if one should be reopened, say so out loud.
2. **Offer two or three candidates plus leaving the place empty** (fewer tabs is a real option, not a failure). Draw
   each at true size in its bar with the screen it opens behind it, and give its cost: what it displaces, which roles
   and plans see it, whether it changes by phase.
3. **Recommend one**, and say plainly when empty is better.
4. **Keep the future in view:** messaging returns as **Messages**, a door into one inbox (E2, E4), and will want a
   place in these bars again. For each candidate, say whether it would hand the place back then, or can grow into
   that door (for example, a Messages tab that opens today's email tools and later the inbox).

- **P2 · The home bar** (signed in; the public tournament pages' bar follows the same ruling): what takes Chat's place
  between Scores and Account. Weigh, not a shortlist: the teams and events you follow; finding an event (search or
  explore); your own week across teams (a coach's or a family's schedule); or empty (Home · Scores · Account). **A tab
  must hold something for everyone who sees it**, signed out and fans included: that is exactly where Chat failed.
- **P3 · The paid coaches portal's phone bar** (Overview · Schedule · Chat · Roster · More today): what takes Chat's
  place. Weigh: Practice plans or Lineups (what a coach opens at the field), Money, Messages (opening today's Email
  families, the coach's announcement tool and the future Messages door), or empty (four tabs). The bar varies by role:
  check what the assistant and helper presets see.
- **P4 · The tournament admin's phone bar** (Chat sits in the bar in the Open and game-day phases): what takes its
  place. Events without chat already show **Messages** (Communications) there; weigh that against a phase tool
  (Check-in on game day, Teams while registration is open) or empty. **The free coaches portal's bar** (Overview ·
  Tournaments · Chat · More) loses Chat too: *recommend* Overview · Tournaments · More unless a candidate clearly fits
  a free coach.
- **P5 · The tournament dashboard's Coaches card** (today: a Tournament Chat upsell, "N haven't joined", "all joined",
  each linking to Chat; and the "remind not-yet-joined coaches" action). *Recommend:* keep the card as a **sign-up
  tracker** (coaches signed in · not yet · Remind), linking to Teams instead of Chat, and keep the reminder email with
  its chat sentence removed. Signing coaches in still matters (the portal, the claim, game-day tools).
- **P6 · "Share to staff chat"** in the scouting book: *recommend* hidden.
- **P7 · The "Staff chat" switch** in a coach's staff permissions: *recommend* hidden; the stored grant is kept for the
  return.
- **P8 · The server refuses new chat activity while paused** (posting, room creation, the join reminder's chat line,
  membership repair on page loads, the unread polling): *recommend* yes, so the pause is real and costs no background
  work; reads are unreachable anyway.

## 3 · How to build it (one switch, about ten readers)

There is **no kill switch today**; each door has its own gate (census 2026-10-18). Add **one constant**, e.g.
`CHAT_PAUSED = true` in a new `lib/chat-pause.ts` (a code constant, not an env flag and not a plan key: reversing the
pause is one reviewed commit), and read it at:

1. `components/consumer/ConsumerNav.tsx` — the `TABS` Chat entry (:37-42), the desktop links (:287-301), the
   tournament strip icon (:434-445) and the tournament bottom bar (:460-463); stop mounting the unread hook (:159).
2. `lib/coach-nav-visibility.ts:264` — `case 'Chat'` returns false while paused (hides the paid sidebar, phone bar and
   the tour card's Chat step via `needsAnyOf`).
3. `lib/chat-service.ts` `coachChatDoorOpen` (:2495) / `lib/use-chat-door.ts` — the free portal's door closed.
4. `lib/invite-only-event.ts:86` — `eventAreas.chat` false while paused (admin rail, phone bar → Messages, More sheet,
   badge, and the page's existing redirect).
5. `app/[orgSlug]/admin/tournaments/dashboard` — `WeeksBeforeBoard.tsx` Coaches card per P5 (today it hides only for
   invite-only events, not by `eventAreas.chat`).
6. Notification settings: the admin `settings/notifications/page.tsx` chat row; the "Chat notifications are managed in
   the Chat tab" lines in `AccountNotificationsClient.tsx`; the empty feed's "Chat has its own badge" line
   (`lib/notification-view.ts:281`).
7. The three chat pages per P1: `app/(consumer)/chat/page.tsx`, `app/[orgSlug]/coaches/teams/[teamId]/chat/page.tsx`,
   `app/coaches/team/[basicTeamId]/chat/page.tsx` (the admin page already redirects through `useAbsentArea`).
8. `lib/use-chat-unread.ts` — disabled while paused (it polls every 60 seconds and listens to every insert).
9. Per P6/P7: the scouting book's share button (`OpponentScoutingPanel.tsx`, the opponent history page, the API's
   `canShareToStaffChat`); the staff sheet's "Staff chat" switch (`CoachStaffSheet.tsx`, `CoachStaffPanel.tsx`).
10. Per P8, server: `/api/chat/**` writes, the admin chat rooms routes, `remind-signups` (keep the reminder, drop the
    chat line), the membership repair in `listRoomsForUser` and the admin room sync, the write-time
    `refreshTournamentChatMembership` / `revokeStaleChatMembershipsForCoach` calls (skip while paused; the next
    un-pause repairs membership on first load), the dashboard's chat-adoption recompute.

**The replacements chosen in P2–P4** are ordinary nav entries, built with the pause but **not** behind the switch:
reversing the pause brings Chat's door back, and whether a replacement then yields its place is the P2–P4 ruling's
fourth point, recorded in the plan when ruled.

**Copy (`/marketing` reviews, same build):** the `/pricing` FAQ line ("…team chat in one place"); the sign-up reminder
email's chat line (`lib/email.ts:619`); the staff invite emails' chat mentions (`lib/coach-capabilities.ts:358, 367,
405`); `auth/suspended/page.tsx:62` ("use chat"); the Coaches portal Tournaments page copy that says a chat room opens
(`teams/[teamId]/tournaments/page.tsx:262-307`); the Email families help text (`teams/[teamId]/page.tsx:1022`); a
**What's New** entry (one plain sentence: chat is paused while we rebuild messaging; email tools unchanged). Keep
"group chats" wherever it is pain framing (`walkthrough-content.ts`).

**Help (`/docs`, same build or straight after):** retire `recipe-tournament-chat`, `recipe-staff-room`,
`faq-premium-chat-vs-email` (coaches) and `tournament-chat` (tournaments) from the hubs; remove the passing mentions
(about 47 lines in coaches, 11 in tournaments, 5 in org); the help hub indexes (`admin/help/page.tsx`,
`platform-admin/help/page.tsx`); the "?" buttons on the chat pages go with the pages.

## 4 · Tests, checks and baselines to update

Unit: `admin-kit-nav`, `coach-free-bar-guard`, `coach-nav-groups`, `coach-helper-preset`, `sidebar-strip-guard`,
`tournament-stage5-chat` (keep it, assert the paused state), `invite-only-event`, `admin-overlay-guard`,
`notification-reader`, `team-coach-notices`, `demo-sandbox-exit`, `coach-read-gates-guard`, `coach-people-phone-guard`,
`lib/consumer-routes.test.ts`. UAT: `coach-findability-smoke` (expects the sidebar Chat link), `coach-membership-smoke`.
Add **one guard test** that every door above reads the switch (so a new door cannot reappear while paused).
Layout: `scripts/layout-screens.mjs` drops `admin-t-chat` while paused; refresh the layout, CSS-selector and
admin-restyled baselines only for what changed. Run `npm run verify:changed` and `npm run typecheck`; `check:layout
--changed` on the bars.

## 5 · What NOT to do

- No database change; no deletion of rooms, members, messages or preferences.
- No change to `tournament_chat` / `coach_peer_chat` values or `lib/plan-config.ts`.
- Do not delete chat components, routes or the engine; the switch must reverse the pause in one commit.
- Do not touch the email tools (E6) beyond removing their chat sentences.
- Do not start the Messages product (E2) or anything for families (E3).

## 6 · Hand-off

A ledger section with a checkable walk (memory `feedback_qa_walkthroughs_as_checkable_artifacts`): the home bar
signed in and out, a public tournament page, the paid and free portals (phone and computer), the tournament admin on
an Open and a game-day event, the dashboard's Coaches card and its reminder, an old chat address of each kind, the
scouting book, a coach's staff permissions, the notification settings, and What's New. Accounts: the Plus test club's
owner (event **UAT Chat Review Cup** has rooms and messages, so the pause hides real content), the Premium coach, the
free coach. Then `/review`.

## 7 · The gate, as drawn (2026-10-18)

Drawn on the Chat hub's **Pause** tab (first tab; source `.probe/chat-pause/pause-tab.html`, captures
`.probe/chat-pause/shots/`, rebuilt by `.probe/chat-review/hub-build.mjs`). Every "before" is the real screen and every
option is the same real screen with only the bar, card or sheet edited in the page (`.probe/chat-pause/after.mjs`).
Asks P1–P8 plus **P4F** (the free portal, split out of P4) await the owner. What the evidence found that the build
needs, beyond §3:

- **The admin bar fills itself.** Chat's place already falls back to Messages (Communications) wherever the event has
  no chat (`AdminKitBottomNav.tsx:103`), so `eventAreas.chat` false gives P4's recommended bar with no new code. The page
  keeps two names (Messages on a phone, Communications at a computer) while the email tools stay as they are (E6).
- **The coach bar does not.** A hidden tab is dropped and the bar shrinks (`CoachesBottomNav.tsx:220`); P3's
  replacement is a new `TEAM_TABS` entry, not behind the switch, and moving Practice plans out of `HOT_KEYS` changes
  the More tiles (`coach-nav-groups.test.ts` pins them).
- **The home bar has no test on Chat** for a signed-in account (`ConsumerNav.tsx:218-220`); removing the entry gives
  Home · Scores · Account, the same shape as the signed-out bar.
- ⚠ **Do not skip the whole "chat-adoption recompute" (§3 item 10).** The Coaches card's sign-up numbers
  (`teamsTotal`, `coachesSignedUp`, `notJoined`, `notJoinedRemindable`) are computed in the same block of
  `app/api/admin/tournament-dashboard/route.ts` (~:758-790) as the room read. Skip only the room part (`roomOpen`,
  `inChat`) while paused, or the card P5 keeps goes blank.
- ⚠ **The Remind button waits for a chat room today** (`WeeksBeforeBoard.tsx` `coachesCard`: no `beside` while
  `!chat.roomOpen`). P5 needs it decoupled, or no organizer can send the reminder during the pause. The send route
  (`/api/admin/tournaments/[id]/chat/remind-signups`) is sign-up work, not chat activity: P8 must leave it working.
  The email already has a switch for its chat sentence (`coachAccessReminderHtml`'s `mentionsChat`): pass false.
- "Joined" on the card already means a completed portal sign-in (`lib/chat-resolvers.ts`), not room membership; only
  the words and the link change.
- Fixtures: **UAT Stage 3 Walk** was re-dated to Oct 24–25, 2026 (`seed-stage3-walk-fixture.mjs --reset`) so the Open
  phase and its Coaches card can be walked; **UAT Chat Review Cup** reads game day Oct 18–19 and Open from Oct 20 (no
  game has started).

## 8 · ⚖ RULED 2026-10-18 (owner pasted the Pause tab's rulings)

| Ask | Ruling |
|---|---|
| P1 | Quiet redirect: home chat → Home; a portal's chat → that team's Overview; the admin's → the event's dashboard |
| P2 | Home bar left **empty**: Home · Scores · Account (the public tournament page's phone bar follows; its desktop chat icon goes) |
| P3 | Paid coaches portal: **Practice plans in Chat's place, labelled "Practices"** (the page keeps its name) |
| P3T | More's tiles: **Lineups · Skills & Goals · Money** (the owner's pick over the recommended Tournaments) |
| P4 | Tournament admin: **Messages** in Chat's place in the Open and game-day phases |
| P4F | Free coaches portal: Overview · Tournaments · More; Chat leaves the left menu |
| P5 | Coaches card = a sign-up tracker linking to Teams, Remind always offered (once-a-day limit kept), email without its chat sentence |
| P6 | "Share to staff chat" hidden |
| P7 | "Staff chat" switch hidden; the stored permission kept |
| P8 | The server refuses new chat activity while paused (the sign-up reminder keeps working) |

**The fourth point, as ruled (P3):** the Practices tab hands its place back when chat's door returns, so the bar's third
place is read from the switch (Chat when live, Practices while paused) and the tiles likewise; reversing the pause is
still one commit. Home and the admin need no such rule (home has no replacement; the admin's Messages is the existing
no-chat fallback).

## 9 · As built (committed `48dc20d7` 2026-10-18)

`lib/chat-pause.ts` (`CHAT_PAUSED: boolean = true`, `CHAT_PAUSED_ERROR`) is read by every door in §3 plus what the
census found beyond it: the bell's "Open Chat" button on old notices (`notificationDestination` returns none), the
`/api/me/role-summary` chat lookup (skipped on that busy path), the notification preferences' Messaging row, and
every route under `app/api/**/chat*` (each handler answers first: 409, or `{count:0}` / `{show:false}` for the two the
open tabs poll). Departures from §3, each on purpose:
- **Write-time membership upkeep keeps running** (§3 said skip it). A registration change re-syncs a tournament's
  EXISTING rooms (`refreshTournamentChatMembership` → `syncTournamentChatRoom`; it can add a seat, notifies no one);
  a coach leaving a team's staff, or changed to the helper preset, loses their tournament AND staff-room seats at that
  moment (`revokeStaleChatMembershipsForCoach`, now also run on the staff PATCH). The staff-room half is NEW, from the
  /review of 2026-10-18: staff seats were only ever reconciled on a chat-list read (`healCoachStaffRooms` →
  `syncStaffChatRoom`), which the pause skips, and a seat is the database read key — a removed coach would have kept
  read access to the room's history for the whole pause. A team between seasons (no current staff) keeps its
  read-only room's seats, as the sync does (CH-1). Skipped while paused: room creation, `ensureCoachMembership`,
  `ensureStaffChatRoom`, the list read's heal; every chat action a person asks for is refused (`refuseWhilePaused`,
  `ChatError` code `paused`, 409).
- **The tournament notification settings' "mute all"** still covers the hidden chat row (its stored value rides every
  save), so a mute made during the pause holds when chat returns. The help hub's Tournaments card counts 25 topics
  while paused.
- **Un-pausing** is listed beside the switch (`lib/chat-pause.ts`): the switch, the `admin-t-chat` layout entry, a
  `/docs` pass for ~50 reworded help passages, `/marketing` + What's New, and the bars re-ruled.
- **The footer is not a door** (it only hides itself on the chat page); P1's "footer link" does not exist.
- **The dashboard skips only its room read**; the sign-up counts stay (P5).
- **Copy** reads the switch, so un-pausing restores today's words: the staff invite lines, the /pricing FAQ, the
  suspended page, the coaches Tournaments page payoffs, the Email families help, the tour card, the Coaches card.
  `/marketing` reviewed the drafts 2026-10-18 (four changes applied: "A coach can sign up once their team is in";
  "Nothing has changed for your coaches."; Email families help drops "one-way"; the tour card is "Reaching families").
- **What's New** is the release step's to add at promote (`lib/release-notes.ts` entries carry the prod date).
  `/marketing`'s recommended sentence, category *improved*: "Chat is paused. To reach your coaches, use
  Communications; to reach your families, use Email families. Both work exactly as before." (It avoids "while we
  rebuild messaging", which promises a return the pause decision says no surface may imply.)
- Guard: `tests/unit/chat-pause-guard.test.ts` — every door reads the switch; every chat route answers first; a link to
  a chat address anywhere in app/components/lib must read the switch or be gated by something that does.
- Layout: `admin-t-chat` is commented out of `scripts/layout-screens.mjs` (restore it in the un-pause commit).
