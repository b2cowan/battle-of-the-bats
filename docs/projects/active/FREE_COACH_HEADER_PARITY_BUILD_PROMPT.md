# Free coach header — build prompt

> Paste into a fresh session on `dev`. Written 2026-10-13, after the owner ruled the direction and all eight drawing
> asks (every one as recommended).
>
> **Where it comes from.** On a free coach's tournament page the owner asked why the account menu and the bell were
> missing: *"the account dropdown and notifications bell should be the same for free tier coaches, changing the format
> of this header does not make sense to me (move the account button and change what it looks like?)"*.
>
> **The spec is the hub:** https://claude.ai/artifact/EA2D38WeFe9mk4Qji9535y (v2 or later; source
> `docs/projects/active/FREE_COACH_HEADER_PARITY_HUB.html`, rebuilt by `node .probe/fchp/build.cjs` from
> `.probe/fchp/hub.src.html` — edit those, never the built file). Its drawings 1–4 are the visual spec; every NEW /
> RESTYLED / UNCHANGED tag's note says what changes and why; screen 5 holds real captures of the paid strip and the paid
> chat screen; screen 7 is the `/design` check. Plan of record: `FREE_COACH_HEADER_PARITY_PLAN.md` (§1 the rulings, §4
> the bell's content and the facts verified in code). PM brief beside it.

## The rulings, in one place

**Direction (owner, 2026-10-13), then three asks as recommended:** on a computer the free coaches portal wears the
**paid portal's strip** — wordmark · "Coaches Portal" · bell · account menu (· Workspaces at two or more places). The fan
app's Home · Scores · Chat · Account links leave it; the wordmark goes Home. **The bell ships with content, never
empty.** **The phone is a separate step** (its own drawing, later).

**The eight drawing asks (A1–A8), every one as recommended:**
- **A1** Chat sits in the free left menu **only when the coach has a chat, or one is coming** (a draft/active event
  whose host's plan carries tournament chat), carries the red unread count, and opens **inside the portal**.
- **A2** The left menu's "Coaches Portal" eyebrow goes.
- **A3** Help at the left menu's foot, as in the paid sidebar (new tab to the coaches guide, the what's-new dot).
- **A4** The bell carries the **emailed kinds plus game changes** (plan §4.1 "Yes" rows).
- **A5** **Every coach on the free team** gets each notice (every active account on the linked free team), not only the
  one address the emails go to.
- **A6** The bell **ignores the host's email switches** (`coach_email_*` and the pause-all) — they govern email only.
- **A7** The rest of the computer frame (rail width, the team header) stays; it is looked at again with the phone step.
- **A8** **An invitation becomes a bell notice** (a pending club invitation — today the Home link's red count, which
  leaves the strip).

**Carried by the drawing (the `/design` pass, applied before the owner answered):** the Chat row's unread count (DC1);
Help in this menu's own mono link style with the what's-new dot (DC3); the drawer exactly as the paid one, no footer
(DC4); a time alone under a day heading (DC5). **DC7 is not ruled** — ask it (Build-start question B4).

## Read first

- The hub (above), all seven screens, and plan §2 (today's code) and §4 (the inventory — every message a free coach
  receives, with file and line).
- **Code:** `components/coaches/CoachPortalShell.tsx` (+ `.module.css`) — the free shell; `components/consumer/ConsumerNav.tsx`
  (`variant="coach"`) — today's bar; `components/coaches/CoachTopStrip.tsx` — the paid strip (it reads `useOrg()`, which
  returns an empty context outside an org, so in the free shell it renders today **without a bell**);
  `components/shared/AccountMenu.tsx`; `components/notifications/NotificationBell.tsx`, `NotificationDrawer.tsx`,
  `useNotificationFeed.ts`, `lib/use-notification-unread.ts`, `app/api/notifications/route.ts` — the bell is
  org-scoped end to end; `lib/notify.ts` — writes bell + push + email by preference (do NOT route these notices
  through it, or the coach gets the existing email twice); `lib/notification-labels.ts` (event → category/label);
  `lib/chat-resolvers.ts` (`resolveTournamentsForCoach`, the BASIC path), `lib/chat-service.ts`
  (`getCoachChatEvents` — added 2026-10-13 for the coach's empty Chat tab), `app/(consumer)/chat/CoachChatWaiting.tsx`,
  `components/chat/CoachChatView.tsx` (the paid chat screen; it lists every room the person is in),
  `app/coaches/team/[basicTeamId]/chat/page.tsx` (today a redirect to `/chat`), `components/coaches/CoachesSidebar.tsx`
  (the paid Chat row's `ChatUnreadBadge`, the Help row's `ReleaseDot`), `app/(consumer)/account/notifications/*`
  (no card for a free coach today — `coaches_basic` contexts carry no org slug), `lib/invite-reconciliation.ts`
  (pending invitations are `organization_members` rows).
- **The writers (plan §4.1 has each file:line):** register, admin teams (add / accept / decline / mark paid), bulk
  registrations, CSV import commit, payment reminders, schedule publish, the schedule-change notice sweep
  (`lib/schedule-change-notices.ts` → `lib/fan-notify.ts`), communications (announcements), tournament complete (final
  results), and wherever an `organization_members` invitation is created.
- **Memory:** `project_free_coach_header_parity`, `reference_root_hydration_wipes_html_attrs`,
  `feedback_build_to_approved_mockups`, `feedback_qa_walkthroughs_as_checkable_artifacts`, `project_coach_account_menu`
  (the menu's binding shape), `reference_partial_commit_shared_tree`, `reference_code_gotchas_index`.

## Preconditions (check before code)

1. **The two 2026-10-13 fixes are committed** (the countdown + theme restore; the coach's empty Chat tab). This build
   reuses `CoachChatWaiting` and `getCoachChatEvents`. If they are not in HEAD, stop and tell the owner.
2. **A free-coach test fixture exists, or `/uat` makes one first.** No saved UAT sign-in holds a FREE team (the UAT
   coach's "standalone" teams are Premium and redirect). The walk needs: a free coach account with a free team linked to
   an accepted registration in a **Tournament Plus** test event (chat offered) and one in a **free** event (no chat),
   plus a second active coach on that free team (A5). Ask the owner before creating dev data; never create an event in
   `uat-test-org` (the free test club has one slot).
3. **The UX summary for the owner comes first** (AGENCY_RULES), short and in product words.
4. **The free tournament tier build may be running** (`FREE_TOURNAMENT_TIER_BUILD_PROMPT.md`): it makes a free event
   invite-only and turns the "team added" email into the invitation (its B3). The notices here follow whatever email a
   trigger sends at build time; if both builds are in flight, the "registered" and "added by the host" notices must
   follow its wording. Coordinate before touching `app/api/register/route.ts` or `app/api/admin/teams/route.ts`.
5. **One browser tester at a time:** ask whether another session is measuring before any probe, sweep or auth setup.
6. **Settle B1–B4 with the owner at the start.**

## Build-start questions (ask, with the recommendation)

- **B1 · How a free coach's notice is marked.** `notifications.org_id` is NOT NULL, so each row is filed under the
  HOST club. *Rec.:* a **dedicated set of event types** (one list, e.g. `TEAM_COACH_EVENTS`, beside the categories in
  `lib/notification-labels.ts`): every org-scoped bell read (list, count, mark-all-read, the realtime client filter,
  the phone pages) **excludes** them, and the free bell reads **only** them, across clubs. Types already drive labels,
  categories and preferences, and the exclusion mirrors the existing chat ("talk") exclusion. *Alt.:* a metadata
  audience flag (a JSON filter on every read; easier to forget on a new read).
- **B2 · Where a free coach's per-kind switches live.** `notification_preferences` is keyed by org (NOT NULL), and a
  free coach should not set the same switch once per host club. *Rec.:* a **migration adds one account-level column**
  to `user_notification_settings` (the pause table, already per user, service-role only) — the list of switched-off
  free-coach kinds — with the data dictionary and snapshot refresh. *Alt.:* a new single-purpose table.
- **B3 · How the free bell is read.** *Rec.:* the bell API takes a scope (`scope=team-coach`) instead of an `orgId`:
  rows for this user whose type is in the list, any club; mark-all-read by the same scope; the unread hook and the feed
  take the scope where they take `orgId` today. The drawer itself stays the paid component unchanged (A4/DC4).
- **B4 · DC7 (the `/design` proposal).** *Rec.:* a payment reminder files in the **"act"** category, so it waits under
  Needs attention until the coach marks it Done, as action items do in the paid drawer. *Alt.:* an ordinary notice.

## The build, in parts (each part matches its drawing; a visual delta found mid-build is a question for the owner)

**Part 0 · The notice plumbing.** The event types and their labels (B1; payment reminder per B4), the column (B2) with
the dictionary + `npm run refresh:snapshots`, and ONE helper that every writer calls — e.g. `notifyTeamCoaches({
registrationIds, eventType, title, body, link })`: resolves each registration's host club and its free team's
**active** accounts (A5; dedupe a person on two linked teams), drops accounts that paused notifications (the pause's
exempt floor does not apply) or switched the kind off (B2), and **inserts bell rows only** — no email, no push (the
existing email and push paths stay exactly as they are). It is called **outside** the host's `coachEmailBlock` checks
(A6). Best-effort: a failed notice never fails the organizer's action. Unit tests: recipients (free team members, two
teams, an inactive member, a paused account, a switched-off kind), the org-bell exclusion, the scoped read.

**Part 1 · The writers (A4, A8).** Call the helper at: registered / waitlisted (public form, when the registration is
already linked to a free team), added by the host (by hand, CSV import), accepted, declined, payment recorded (full
payment, as the email), payment reminder, schedule published, a game moved / cancelled / back on (in the
schedule-change sweep, beside the push, so the organizer's 10-minute hold and supersede rules apply to the bell too),
an announcement (when its email channel is used), final results posted — and an `organization_members` invitation to
an existing account (filed under the inviting club; the link opens Home, where invitations are accepted). Titles lead
with the club's name and say the team's name; wording follows the hub's screen 3 table and goes to `/marketing` for
words before the first commit. NOT in the bell (plan §4.1): chat, the evening-before reminder (a timed email), scores /
playoffs / champions, access and sign-up links, "your team home is ready".

**Part 2 · The strip (drawing 2).** The free shell mounts the **paid strip component** on a computer — not a lookalike —
with a free mode: the bell in the team-coach scope (B3), the settings links to the new Account → Notifications card,
the account menu exactly as on the paid strip, Workspaces at two or more places. The consumer bar's top half leaves the
free shell on a computer; **its phone bottom bar stays** (≤900px is unchanged, A7 / the phone step). The strip
measures from the shell the way the paid shell sets `--coach-topstrip-h`. Check the warm and dark looks: the strip is
the paid one and must follow the account setting exactly as it does there.

**Part 3 · The left menu (drawing 2).** Remove the eyebrow (A2). Add **Chat** under Tournaments on a computer only (the
phone tab row is untouched — the phone's bottom bar already has Chat), shown only when the coach has a room or a
waiting event (A1) and carrying `ChatUnreadBadge` (DC1). `/coaches/team/{id}/chat` renders the chat **inside the
portal** — the paid portal's `CoachChatView` under the free strip and left menu — and, with no room yet, the waiting
screen (`CoachChatWaiting`); it no longer redirects to `/chat`. **Help** at the foot (A3), in the menu's own link style
with `ReleaseDot` (DC3), opening the coaches guide in a new tab like the paid sidebar's. "Live on FieldLogicHQ" stays.

**Part 4 · Account → Notifications.** A card for the free coach ("Coaches Portal · your free teams") with one switch
per kind (B2), focused by the bell's gear and the account menu's Notification settings row. The Pause card governs it
too.

**Part 5 · Words and help.** `/marketing` confirms every notice title and the card's words before the first commit.
`/docs`: the coaches guide's getting-around paragraph, the "Where did the portal's menu go?" FAQ, and "How do I join a
tournament's chat?" (today it says the Chat tab is the only place to look and there is no chat section inside your
team — both change on a computer).

## Not in this build

- The phone (the next step, its own drawing; notices written now wait in the bell until it gives them a door — say so
  in the hand-off).
- Paid coaches receiving these host-club notices in their paid bell (a Premium team in someone else's tournament) — a
  follow-up question for the owner, not ruled.
- New messages nobody sends today (waitlisted by the host, promoted from the waitlist, a deposit marked paid).
- The evening-before game reminder in the bell (needs its own timer).
- Rail width and the team header (A7).

## Running beside other work

- **The free tournament tier build** (precondition 4) and **Club Tier sessions** share `app/api/admin/teams/route.ts`,
  the registration routes and the notification labels. Re-read HEAD before editing a shared file.
- **The demos:** the coach demo is a paid portal; the strip change does not reach it, but the build fails if a tour
  anchor stops existing — run `check:demos`.
- **Git:** `dev` only; explicit pathspecs; a shared file is HEAD plus your own hunks; re-read HEAD right before each
  commit; **commit only when the owner says**. A migration's prod step goes into `supabase/migrations/MANUAL_PROD_STEPS.json`
  with its order (the column before the code that reads it); read the release record first.

## Verification

- Unit tests (Part 0), `npm run typecheck`, `npm run verify:changed`, `npm run check:dictionary`.
- `/simplify` (a new helper beside `notify()` and a second bell scope), then `/review` at **high** (shared notification
  reads, a migration, an auth-adjacent API scope): the lenses must include "an org-staff member who is also a free coach
  never sees a coach notice in the club bell, nor club rows in the free bell".
- `check:layout` on the free portal's desktop screens in Warm and Dark (they re-baseline: the strip is new), and the
  paid portal's coach screens unchanged.
- `/design` at 1440 against drawings 2–4 and the paid captures on screen 5.
- **The owner's QA walk** on the hub's QA tab (checkable, paste-back; one purpose per walk): the strip and menu match the
  paid portal; Chat appears for the Plus event's coach and not for the free event's; a waiting event's chat screen; the
  bell lights for accept, schedule published and a moved game (both coaches on the team); a coach who is also the host
  club's staff sees the notice only in the free bell; switching a kind off on Account → Notifications stops it; an
  invitation lands in the bell.
