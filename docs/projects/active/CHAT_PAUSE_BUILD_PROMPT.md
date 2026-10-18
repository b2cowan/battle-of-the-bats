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
   - the **home bar** on a phone and the desktop top nav, signed in (Home · Scores · Account);
   - the **public tournament page's** bottom bar and desktop strip;
   - the **paid coaches portal** phone bar and sidebar Communication group (Chat gone; see P2);
   - the **free coaches portal** phone bar (Overview · Tournaments · More) and left menu;
   - the **tournament admin** phone bar on an Open / game-day event (Messages in Chat's place, as invite-only events
     already show it) and the rail;
   - the **dashboard's Coaches card** (see P5);
   - **one whole screen before and after** per surface (the bar change is cumulative: check nothing else moved).
2. **A plain-language summary for the owner** (AGENCY_RULES: the PM UX plan): what people see differently, by role.
3. **The asks below**, each with a recommendation, beside the drawing that answers it.

## 2 · Asks for the owner (put them first, with the drawings)

- **P1 · What an old chat address shows** (bookmarks, old notifications, the footer link): *recommend* a quiet
  redirect to that surface's home — `/chat` → Home; a portal's chat page → that team's Overview; the admin's chat page
  → the event's dashboard (it already does this when the plan lacks chat). No "chat is paused" page: nobody pays for
  it and a notice would advertise a gap.
- **P2 · The paid coaches portal's phone bar** loses Chat: *recommend* Overview · Schedule · Roster · More (four tabs,
  nothing promoted into the slot). The alternative promotes a tool (Practices or Lineups) — a bigger decision than a
  pause should make.
- **P3 · The home bar** becomes Home · Scores · Account for everyone, and the public tournament pages' bar the same.
  *Recommend* yes (three tabs; nothing added).
- **P4 · The free portal's bar** becomes Overview · Tournaments · More. *Recommend* yes.
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
