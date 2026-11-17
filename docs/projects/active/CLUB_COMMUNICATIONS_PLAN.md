# Club Communications — Implementation Plan

> **Status:** Stage 1 fully ruled 2026-11-16 (direction 1–12, Stage 1 asks 1–14, the board asks 15–19, and the coach
> email drawing's ten standing asks, all as recommended). Build prompt: `CLUB_COMMUNICATIONS_STAGE1_BUILD_PROMPT.md`.
> Build state: §3 Stage 1 (Session 1 committed; Session 2 built 2026-11-17, commit and Walk A owed).
> **Created:** 2026-11-16
> **Branch:** dev
> **PM brief:** `CLUB_COMMUNICATIONS_PM_BRIEF.md`
> **Evaluation (the rulings' source):** https://claude.ai/artifact/6wvN7LEUw3mfUEdSXYSryY ·
> `CLUB_COMMUNICATIONS_HUB_EVALUATION.html`
> **Stage 1 drawings:** https://claude.ai/artifact/KKY5hxQMzwHC7usRVUChn4 · `CLUB_COMMUNICATIONS_STAGE1_DRAWINGS.html`
> (paste-back "Communications stage 1 asks: …")
> **Legal:** `docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md` (no blocker; it also lists what Stages 2 and 3 must settle
> before they are drawn)

## Goal

Give the club one home for the email it sends to groups: one sent record, one window to write in, and the buttons that
already start an email from another screen left in place. The Board Ready Stage 2 coach email is built as the first new
piece of that home instead of as an Organization tab. Later stages let one message go to any mix of families and
coaches, complete the record, and take in the groups Board Ready Stage 3 adds.

## 1. The rulings (owner, 2026-11-16: all 12 asks as recommended)

Recorded as ruled. Nothing below adds to them; build consequences are in §4 and open points in §8.

| # | Ruling |
|---|---|
| 1 | **Direction: one home, many doors** (option B). One Communications place with one record and one window. The buttons on other screens stay and feed it. |
| 2 | **The name is Communications.** Two naming points ride with it: the Coaches Portal group headed "Communication", and the tournament page called Communications on a desk and Messages on its phone bar (an open exception in NAV_STANDARD). |
| 3 | **Its place: the Club group of the sidebar, after Families.** Changes the navigation standard. On a phone it sits in the More sheet with the rest of the Club group. Families loses its Emails tab. |
| 4 | **Sending no longer needs the Families book.** An admin can email every family from Communications, seeing counts and family names only. The Families grant keeps guarding household records. |
| 5 | **Who sees which rows:** you see every email that reached people in the programs you run, whoever sent it. Owner and admins see everything. |
| 6 | **A season keeps its Email families tab**, as the season's slice of the same record. Removing it is a navigation-review question for later. |
| 7 | **One message to families and coaches together: yes**, as one message and two mailings, each person once, **after a legal check**. The check settles what the window says or refuses when a promotional message has both kinds ticked, and which daily allowance a mixed email counts toward. |
| 8 | **The club's record lists the emails coaches send their own team's families: yes for the club's own teams, in a later stage**, with a plain line in the coach's window that the club can see them (team, coach, subject, date, families reached, and the message). A coach who bought the portal for a team outside any club is not affected. **Needs a legal check.** |
| 9 | **Tournament announcements stay in the tournament.** Each becomes a row in the record that opens it, in a later stage. |
| 10 | **The Club notice moves to Communications, in a later stage**, with a pointer left in the Public site editor (the editor's preview keeps showing it and links to where it is edited). Answers the 2026-10-22 inventory question (`PUBLIC_SITE_BUILDER_PLAN.md` §7, `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` L3112). |
| 11 | **The "Communications" access switch in Members becomes the hub's on/off for a person.** |
| 12 | **The order: the coach email is built inside the new home, as Stage 1.** Board Ready Stage 2 asks 6, 7 and 13 are replaced by this plan. Its other ten asks (1–5, 8–12) stand as written and are still owed. |

**Rulings added 2026-11-17 (owner, Session 1, each as recommended after push-back in chat):**

| # | Ruling |
|---|---|
| R1 | **A sender with no name on their account is refused** (coach and board email): nothing is sent and the window asks them to add their name. |
| R2 | **Replies go to the club by default, and the sender can switch.** Replies go to the club's public contact address and the email names the club, not the person ("{Club} sent this."). The sender may choose "Replies come to me", which puts their name and address back in. A club with no public contact address replies to the sender, as before. **Changes coach ask 9's "replies to the sender".** The record still keeps who pressed Send. |
| R3 | **R2 covers families, coaches and the board**: one rule in all three windows, so the shipped family window (club door and season door) gains the same choice. |
| R4 | **No typed CC or BCC.** In their place, a **"Send a copy to the club's inbox"** tick, offered when the club has a public contact address. Other people are reached by picking them from the list, as drawn. (Push-back given: a CC shows every recipient the copied address; a typed address is outside every group, the family unsubscribe and the daily limit; `/legal` §3 item 11 lists BCC copies as must-not-ship.) |

R2–R4 need `/legal` on the changed fixed lines before the build guard pins them (run in Session 1, 2026-11-17).

## 2. What the code does today (read 2026-11-16)

- **One machine, three doors.** The club-wide family email (Families › Emails) and a season's family email (House
  league › season › Email families) share one window (`components/admin/kit/club/families/EmailFamiliesWindow.tsx`),
  one sender (`deliverFamilyEmail`, `lib/families-email.ts`) and one pair of tables (`family_email_sends`,
  `family_email_recipients`). The coach email is drawn on the same window parts
  (`components/admin/kit/club/SendParts.tsx`) and is not built.
- **Keys differ per door.** Families door + its list: `requireFamiliesAccess` (`lib/families-auth.ts`), i.e. the
  `module_families` grant, off by default for every role including admin (`lib/roles.ts`). Season door + its list: the
  house-league `email` flag = owner, admin, league admin, league registrar (`lib/house-league-access.ts`).
- **`module_communications` is dormant.** A core module on every plan (`lib/plan-config.ts`), default-on for owner and
  admin (`lib/roles.ts`), listed in the member window (`components/admin/kit/club/ManageMemberDialog.tsx`), read by no
  screen or route.
- **The list.** `components/admin/kit/club/families/EmailsTab.tsx` + `EmailLog.tsx`, reader
  `lib/families-emails-log.ts`. Columns Sent · Subject · To · By · Reached; the Automatic tag rides on the subject; a
  stopped send wears the amber Stopped chip before its figure; a one-family message is listed without its words.
- **Not in any club list:** tournament announcements (`announcements`), the fixed-wording coach sends
  (`family_coach_asks`, `club_schedule_sends`, `rep_allocation_reminder_waves`), and a coach's emails to their own
  team's families (`rep_team_announcements`, read only by the coach's page and the family view).
- **Name collision to design around:** `app/api/admin/communications/route.ts` and
  `/[orgSlug]/admin/tournaments/communication` are the TOURNAMENT announcements. The club place needs its own page path
  and API namespace that cannot be confused with them.
- **Legal position for coach mail:** `docs/agents/legal/CASL_COACH_GROUP_EMAIL.md`. Colleague mail and family mail are
  two paths, never mixed; a build guard fails the build if the coach sender imports the family envelope.

## 3. Stages (by dependency; no dates)

### Stage 1 — The home, and the coach email inside it
*Gate before any code: the Stage 1 drawings, published and ruled, then a build prompt.*

- [x] **Drawings round 1** published 2026-11-16 (https://claude.ai/artifact/KKY5hxQMzwHC7usRVUChn4): the place, the
  merged list, New email's two choices, seat by seat, Families after the move, the phone, what carries over from the
  coach email drawing, asks. `/ux`, `/design` and `/legal` ran and their fixes are in the drawing.
- [x] **Stage 1 asks 1–14 RULED 2026-11-16, all as recommended** (owner: "I agree with your recommendations").
- [x] **The coach email drawing's ten standing asks (1–5, 8–12) RULED 2026-11-16, all as recommended.** Basis: asked
  whether "I agree with your recommendations" covered those ten, the owner answered "I agree with your recommendations,
  go ahead with the first build prompt". Their text is in `BOARD_READY_PLAN.md` §5 Stage 2.
  **The 14 Stage 1 asks as ruled:**
  1 New email is one lime create button with a choice inside (plus, words, arrow; no envelope) · 2 a league admin or
  registrar's "To families" opens the season's own window and the menu names each season under way · 3 "Families from a
  list" only for holders of the Families book · 4 on an email wider than your programs: a family email shows message and
  counts and NO names, a coach email names only your own coaches · 5 the Communications switch is on by default for
  league admin and registrar, and off means no group email from ANY screen · 6 phone: a More-sheet row that never fills a
  bar tab or a tile, and New email keeps its words (`/ux` and `/design` disagreed; drawn with words) · 7 Families keeps
  no pointer; the old address forwards · 8 the filter reads All · To families · To coaches · each season · 9 the words ·
  10 with one choice the button names it and opens it, no menu · 11 a line under the message box says who can read the
  email afterwards (`/legal`) · 12 an admin without the book sees family names in Opted out / Didn't go (`/legal`: low
  risk, owner's call) · 13 a message to one family is listed only for Families book holders (`/legal`) · 14 anyone who
  may send to that group can finish a stopped email; others are told who can.
- [ ] **The board as a group, added to Stage 1 at the owner's request 2026-11-16** (drawing tab 8, round 2; `/legal`
  addendum in `docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md`: passes conditions (a)–(g)). A third choice under New
  email, "To the board", on the colleague-mail path, with its own window title "Email the board".
  - **The group:** active members holding a board seat, as on Organization › The board (`BOARD_ROLES`,
    `lib/board-people.ts`; read `boardNames`, `lib/member-names.ts`): owner, admin, league admin, league registrar,
    treasurer. Invited-not-accepted and suspended members excluded. Never computed from families. It is NOT the narrower
    list the two-step alarm emails use (`boardRecipients`, `lib/two-step-emails.ts`: owner, admin, treasurer).
  - **Honest wording:** the product's board is seats, not the club's legal directors; the row's second line says so.
    Directors with no account wait for Board Ready Stage 3 (People). The help article must not call it formal notice.
  - **Asks 15–19 RULED 2026-11-16, all as recommended:** 15 the group is everyone on
    the board tab and the row says so · 16 every board seat may email the board, so a treasurer gets a Communications
    place (switch on by default) with one button · 17 a board email is read by its sender, its recipients and the owner
    and admins, nobody else, including a later joiner · 18 "To the board" is a third choice, not a row in the coach
    window · 19 no off switch for board email.
  - **Build rules from `/legal`:** the read rule is enforced in the server reader (a non-recipient seat gets no row);
    a pending member is named to owner/admin senders only, others get a count; a suspended member is never shown; a
    nameless seat shows as its role, never an address; no "To the board" choice when the board is only the sender; the
    reason line names the recipient's seat; recipients are kept by account with role at send time; the coach email's
    build guard samples include the board kind; no "open in Communications" link in the email.
- [x] **Build prompt written 2026-11-16:** `CLUB_COMMUNICATIONS_STAGE1_BUILD_PROMPT.md`, after the `/legal` re-run
  (`docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md` § "Build-prompt checklist 2026-11-16": fixed strings, route rules,
  tests T1–T26, what must not ship). Three sessions and a close, in order: **1 the engine** (the clock, the tables, the
  groups, the colleague sender, the routes, the guard; no screens; Opus) → **2 the place** (nav, the merged list and
  records, the gate change, the switch, Families after the move; Opus; Walk A) → **3 the windows** (New email's menu,
  the coach window, the board window, the phone; Sonnet; Walk B) → **Close** (reviews, words, help, the as-built legal
  read).
- [ ] **⛔ RELEASE GATE (`/legal`, 2026-11-16):** this code must not reach production until (1) the owner has decided
  the retention clock, (2) the clock exists as a scheduled job in Stage 1's migrations, covering the new tables and the
  family log, and (3) the privacy §5/§9 sentences are in `docs/agents/legal/drafts/PRIVACY_POLICY.md`. Session 1 does
  all three, so a promote after Session 1 is inside the gate. Same shape as the friend-requests gate.
- [ ] Session 1 · Session 2 (Walk A) · Session 3 (Walk B) · Close — commit hashes and walk numbers recorded here as each lands.
- [x] **Session 1 · the engine — committed `95cac82d6` (engine, mig 492) + `817c95523` (mig 493, the nightly job, watched automation) 2026-11-17** (walk: none, no screen). Owner rulings that
  session: the retention clock (§8) and R1–R4 (§1). **Hand-off for Sessions 2 and 3 — call these, do not re-derive them:**
  - **Migrations** 492 (the three `club_group_email_*` tables, `family_email_sends.reply_to / club_copy / words_cleared_at /
    names_cleared_at`, subject/body nullable, `club_group_email_claim`, `club_email_retention_sweep`) and **493** (the nightly
    job, 08:45 UTC, watched automation, its own commit). **DEV ONLY**; prod steps in `MANUAL_PROD_STEPS.json` (492 then 493,
    before the promote that ships this code). Fixture `tests/sql/club-emails-fixture.sql` 8/8. Sessions 2 and 3 add none.
  - **API namespace `/api/admin/club-emails`** (never the tournament's `/api/admin/communications`): `GET ?kind=coaches|board`
    (the window's options: groups with live counts, the pick list, Last sent, `replies.club/me`, `copy`), `POST {action:
    'count'|'preview'|'send', kind, group, …}`, `GET /sent?before=` (the coach and board rows this reader may read — Session 2
    merges them with the family log), `GET /[sendId]` (the record, shaped per reader; Not found when unreadable), `POST
    /[sendId] {action:'finish'}`, `GET /[sendId]/again` (keys + subject; sends nothing). A send posts `expected: [{key,name}]`
    from the count; `changed` returns the new `people`. Body fields: `group` ∈ coaches_all · rep_staff · rep_head ·
    league_season(seasonId) · league_division(seasonId, divisionId) · coaches_picked(keys) · board_all · board_picked(keys);
    `replyTo: 'club'|'sender'` (absent = club when the club has a public contact); `copyClub` (coach email only).
  - **The rules are pure** in `lib/club-group-email-rules.ts` (`seatOf`, `groupOffered`, `canReadSend`, `canFinish`,
    `shapeRecipients`, `namesPending`, `replyTarget`) — the screens decide what to draw from the same answers. **The words** are
    ONE block, `lib/club-group-email-words.ts` (MAIL pinned by the guard; GROUP, LINES, WINDOW, SAY, RECORD for the windows).
  - **The family path** (club door + season door) now accepts `replyTo: 'club'` and `copyClub: true` (R2–R4); with neither it
    is exactly the shipped behaviour. Session 3 adds the switch, the tick and the window line (`WINDOW.familyStatementClub`).
    A family send naming a coach/board audience is refused `both_paths`. `ClubEmailRecord.wordsCleared` + `RECORD.wordsCleared`
    for the record once the clock has run; the family resend refuses `words_gone`.
  - **The switch** (`module_communications`) gates every new route today; role defaults are unchanged (owner, admin) —
    **Session 2 adds league admin, league registrar and treasurer** and gates the family routes. Receiving board mail asks only
    the seat.
  - **Guard:** `tests/unit/club-group-email-guard.test.ts` (T1–T8, T10, T13–T21, T24, T25, T27, T28 engine half); T26 =
    `check:dictionary`. **Probe:** `.probe/club-emails/` (`node --env-file=.env.local .probe/club-emails/run.cjs`, in-process,
    seeds and removes a throwaway club; no dev server).
  - **Owner question carried (from /legal's addendum, not a blocker):** should the board window open on "Replies come to me"
    (recommended: yes, because the club's inbox is often shared)? The engine takes either; Session 3 sets the default.
  - **`/review` 2026-11-17 (high-risk, 4 lenses, 0 Critical/High):** fixed the same session: people written in the claim's
    transaction; one account = one person (union by account, then address; `aliases` so a coach who signs in mid-write is not
    "changed"); stale pick keys dropped and named by the recount; a closed season says so (`not_live`); a dual-role coach's
    rep line withheld from league seats; `@`/length made safe before storing; finish re-chooses the ORIGINAL group, reads
    before it takes the row, and never sends words the clock deleted; list paging always advances, Last sent scans past
    unreadable rows, the list carries no account id; stopped sends show their real counts; the family resend refuses only
    in its own scope. **Left for later, recorded (Low):** a crash between "sent" and its mark can resend that one person on
    finish (at-least-once); a send running past 15 minutes could be finished concurrently (needs a heartbeat); the nightly
    sweep is unbatched (first real run Oct 2027); the family claim records club mode in a second statement (no email goes
    before it); each options/count call reads every account (Auth admin rate, large clubs). **For Session 2:** the shipped
    `EmailLog` shows a blanked family subject as "A message to this family" — render `RECORD.wordsCleared` via
    `ClubEmailRecord.wordsCleared`. **For Session 3:** the season window's one-family branch ignores `replyTo`/`copyClub`
    (hide the switch there, or carry it into the one-family send).
- [x] **Session 2 · the place — BUILT 2026-11-17** (commit owed: the owner's yes; **Walk A owed**). Owner rulings that
  session (asked before code, both as recommended): **(S2-1)** the club-wide family window is the owner's and admins'
  ONLY, as legal §2c's route table and drawing tab 4 rule — a staff member, league admin or registrar who holds the
  Families book loses the club-wide send and a list's "Email these families" (a league seat keeps its season's window);
  **(S2-2)** a league admin or registrar keeps the place between seasons: the list stays, New email is absent until a
  season is under way (the drawing's "nobody to write to, no place" read literally would make the sidebar change with
  the calendar). **Hand-off for Session 3 — call these, do not re-derive them:**
  - **The place** is `/[orgSlug]/admin/club-emails` (layout = the server gate + the "not yours" screen; page →
    `components/admin/kit/club/communications/CommunicationsScreen.tsx`; frame `CommunicationsFrame`). Not a program:
    `kitCommunicationsLink` + `clubPlaceGroups({ communications })` put it after Families; it never joins the phone's
    fill (N10). `litClubPlace` and `clubPlaceAt` know `COMMUNICATIONS_SEGMENT`. Help topic `'club-emails/club-emails'`
    (points at the emailing article until Close's `/docs`).
  - **Who has the place** is ONE pure answer, `lib/club-communications-place.ts`: `opensCommunications` (Session 2 =
    a family door; **Session 3 widens it to `|| seat.any`** — the colleague seat — so the treasurer and a coach-only seat
    get it), `familyDoor` ('club' owner/admin · 'season' league seat), `seasonDoorOpen`, `familyReader`. The server's
    gates are `lib/club-communications-auth.ts` (`requireClubFamilyEmail`, `requireCommunications`, `seasonEmailSwitch`,
    `placeFactsFor`); the browser's are `components/admin/kit/useCommunicationsFacts.ts`. The layout picks the "not
    yours" words: a board seat other than the treasurer → `communications` (grant), everyone else →
    `communicationsBoard` ("…and the people on the club's board open it"). **Session 3: the treasurer gets the place,
    so move the treasurer out of that `communicationsBoard` branch.**
  - **The list** is `GET /api/admin/club-emails/log?filter=all|families|coaches|board|season:<id>&before=` →
    `readCommunications` (`lib/club-communications-log.ts`): the family log narrowed by `familyReader` (a league seat
    reads season rows + Every family; one-family rows only with the book, or from a season) merged with
    `listColleagueEmails`; paged on the later of the two cursors. Rows are `EmailLogRow` (kind `coaches`/`board` for
    colleague rows); a stopped family row carries `finish` (`{door}` or `{line}`). First page: `total`, `kinds`, `seasons`.
  - **Records:** family → `GET /api/admin/club-emails/family/[sendId]` (`readCommunicationsFamily`: a league seat's
    record of a club-wide email has NO named-lines keys; Not found when unreadable); coach/board → Session 1's
    `/api/admin/club-emails/[sendId]`, drawn by `ColleagueRecord.tsx` (finish wired; **"Send again to these people" is
    Session 3's**, it opens the coach/board window with the pick filled in from `/[sendId]/again`).
  - **New email** today: one choice → "Email families" (lime, plus); a league seat with two or more seasons under way →
    `CoachToolbarMenu variant="primary"`, one item per season. **Session 3 adds To coaches / To the board to that same
    menu** (choices in `CommunicationsScreen`'s `choices`). The club window opens with `eyebrow="Communications"`.
  - **The family window** (`EmailFamiliesWindow`): the readers line `WINDOW.readers` under the message box (both
    doors); the "Show them" link hidden when the preview says `holdsBook: false`; `eyebrow` prop. Session 3 adds the
    reply switch and the inbox tick (R2–R4).
  - **The switch:** `module_communications` on by default for league admin, registrar and treasurer (`lib/roles.ts`);
    listed with the programs in the member window (`MEMBER_PROGRAMS`, its always-on line `PLACE.switchLine`; no longer
    folded under Tournaments; not on a tournament-only plan). Off → no place, the season's window refuses (every
    action but `resendNotice`, an automatic notice), and the buttons are absent: the season tab's door and its record's
    resend, Registrations' Email, the owing list's "Email these families", a Families list's "Email these families".
  - **Families after the move:** tabs Families · Duplicates; `/:orgSlug/admin/families/emails` forwards in
    `next.config.ts` (above the Families layout, T23); the old list/record routes are deleted; "the Emails tab" strings
    re-pointed (`FAMILY_EMAIL_WORDS.unknown`, the support console's sent-log lines).
  - **Words:** the place's are `PLACE` in `lib/club-group-email-words.ts` (+ `RECORD.whoWent/status*/finish*`); also
    written this session, outside that block, for Close's `/marketing` pass: `FAMILY_EMAILS_TAB_WORDS.nameless` ("A
    family") and `.subjectCleared`, the member window's `LOSES`/`GAINS` lines for Communications
    (`member-summary.ts`), the "not yours" `board` sentence (`not-yours-words.ts`).
  - **Tests:** `tests/unit/club-communications-place.test.ts` (T9, T10 family half, T11, T12, T22 family window, T23);
    nav-standard-guard (Communications per seat, the owner's sheet 15, the bar/tiles snapshot unchanged). **Probe:**
    `.probe/club-emails/place.ts` (`node --env-file=.env.local .probe/club-emails/place-run.cjs`): owner 10 rows, admin
    without the book 7 (names in Opted out / Didn't go, no one-family rows), league seats 6 (Every family with NO
    surname in the JSON; rep-team and list emails Not found; the season's one-family message only), switch off and
    staff-with-the-book refused, "A family" for a nameless one, zero addresses in any response.
  - **`/review` 2026-11-17 (high-risk, 4 lenses, 0 Critical/High; no leak or unauthorised send found).** Fixed the same
    session: a league seat's season menu reads "To families" with the season as its second line (tab 2, not the season
    as the title); the filter shows once the reader has more than one kind (tab 1); a league seat reads a one-family row
    by surname, as the season's list does; a stopped season email an owner/admin can't finish by the season's door is
    offered by the club's (screen and route agreed); the Communications row in the member window is a board seat's only
    (staff, a volunteer or a coach: it switched nothing); the finish message is past tense with what it reached; no
    finish/resend button once the clock deleted the words; a stale "Show more" can't append another filter's rows; a
    first page with nothing readable but more behind it shows Show more, not the empty card; one sort order; the list
    cursor must be a timestamp. **Left, recorded (Low/Advisory):** the readers' `reader` argument defaults to the
    widest (the season history route relies on it, season-scoped); `colleagueSummary` counts at most 5,000 sends; the
    redirect's `:orgSlug` also matches `/api/…/families/emails` (a 404 either way); "{Sender} or an admin can send it…"
    is shown to an admin who lacks the book on a list email; `resendNotice` (an automatic notice's "send to the ones it
    missed") stays open with the switch off, as ask 5's "automatic emails still go" reads — **owner to confirm**.
    Data: no dev member has `module_communications` saved off (a saved off would keep the place shut) — **check prod
    before the promote**.
  - **Owed by others / later:** `scripts/layout-screens.mjs` still sweeps `admin-families-emails` and
    `admin-families-email-window` at the old address (it forwards now) — that file carries another session's
    uncommitted edits, so it waits for the owner's word; the emailing help article still describes the Emails tab (the
    "?" on Communications points at it) — Close's `/docs`.
  - **Not done here (owed):** `check:layout --changed` on the place, Families and the member window (needs the dev
    server; Walk A covers the eye). A season filter lists that season's FAMILY emails (a coach email to the season is
    under To coaches). Pre-existing, not this session's: a club-door "A house league season" row reads "{season} ·
    {season}" in To (the shipped `seasonTo` over a label that is the season's name).
- [ ] **Migration first:** the coach-email send log and its recipients table, as the coach email drawing specifies
  (sender, group label, counts, status, body; recipients by name, team line, status), group kinds open-ended.
  `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev + prod) in the same unit of work.
- [ ] **The place:** a new club page (path to be named in the build prompt, never `communication(s)` under tournaments),
  added to `lib/admin-kit-nav.ts` (sidebar order, Club group, phone More sheet), `components/admin/kit/AdminKitRail.tsx`,
  `components/admin/kit/AdminKitBottomNav.tsx`. `docs/agents/design/NAV_STANDARD.md` updated in the same change.
- [ ] **The list:** one reader over the family log and the coach log, with the per-seat visibility rule (§4). The
  Families › Emails list moves in; `/admin/families/emails` redirects to the new place (bookmarks, help links, notification
  links). Families' tab row becomes Families · Duplicates.
- [ ] **New email:** two choices in Stage 1, "to families" (the shipped window, club door) and "to coaches" (the coach
  email window as drawn: live groups, recount at Send, colleague mail, names never addresses).
- [ ] **The gate:** sending family email from Communications, and reading the list, stop asking for the Families grant
  (ruling 4). `module_communications` becomes the place's on/off (ruling 11); role defaults reviewed so league admin and
  league registrar hold what rulings 5 and 11 need (`lib/roles.ts`, `tests/unit/role-defaults-guard.test.ts`,
  `components/admin/kit/club/ManageMemberDialog.tsx` wording).
- [ ] **The season's Email families tab** reads the same record (ruling 6); no visible change there.
- [ ] **Guards:** the coach email's build guard from `CASL_COACH_GROUP_EMAIL.md`; a seat-table test for the list and both
  send routes; the family-email manifest guard still passes.
- [ ] **Findings from the three checks the build prompt must carry** (2026-11-16):
  - The old `/admin/families/emails` address must forward for a person who cannot open Families (the default admin).
    `app/[orgSlug]/admin/families/layout.tsx` returns the "not yours" screen before any page under it runs, so the
    forward lives above that layout or the route moves out from under it.
  - Names are withheld **in the reader, per seat** (`lib/families-emails-log.ts` returns the opted-out and missed names
    to whoever the route admits today). A JSON test that a registrar's record of a wider email carries no named lines.
  - The merged reader never falls back to an email address for a person with no name (`personDisplayName`,
    `lib/families-read.ts`); such a family reads "A family".
  - The family window's links into Families ("Show them" for children with no family on file) are absent for a sender
    without the book. Strings that say "the Emails tab" are re-pointed to Communications (`lib/families-words.ts`).
  - Seat rules are enforced on every send and read route: a member limited to some team groups is refused; a league
    seat is refused any group it was not offered.
  - A resend goes back down the path its email came from (club, season, coach). The list has no allowance line today;
    the refusal words must still read right when opened from here.
  - Popover and phone sheet follow the shipped primary toolbar menu (`components/coaches/CoachToolbarMenu.tsx`); the
    sidebar and sheet icon is `Mail` (NAV_STANDARD N5 row 11); a `NOT_YOURS_PAGES` entry and a help topic (N12).
  - `docs/agents/db/DATA_DICTIONARY.md` still says the family log never keeps a list of families; correct it in the
    Stage 1 dictionary update.
  - `/legal` re-runs before the build prompt is written.
- [ ] `/legal` before hand-off (who may now send family mail; what the list shows to which seat; the coach-email log's
  privacy sentence and retention clock already owed). `/docs` (the Emails help article moves; a Communications article).
  `/marketing` on the new words (§7). `/review`. Demo tour destinations checked (the build fails if one stops existing).

### Stage 2 — One window for any mix
*Depends on Stage 1's place and merged list. Gate: `/legal` first (ruling 7), then its own drawing round.*

- [ ] `/legal`: a promotional message with families and coaches both ticked; which allowance a mixed email counts toward;
  the reason and removal lines when one message goes down two paths.
- [ ] Drawings: Who as tick-any across Families and Coaches and staff; a row inside a wider ticked group loses its box
  and says why; the overlap sentence; one record row with a Reached line per mailing; where Stopped sits on that row.
- [ ] Build: one message, two sends by their own paths, one copy per person (a coach who is also a parent gets the
  family copy, as the head-coach copies do today); the buttons on other screens open the window with Who filled in.

### Stage 3 — The whole record
*Each item is a read of something that exists; none blocks sending.*

- [ ] Automatic notices and the fixed-wording coach sends join the list, with the list's filter.
- [ ] Tournament announcements as rows that open the tournament (ruling 9).
- [ ] Coaches' team emails for the club's own teams (ruling 8): `/legal` first, a plain line in the coach's window,
  then the read. Standalone coach teams are untouched.

### Stage 4 — Volunteers, documents, and board members with no account
*Depends on Board Ready Stage 3 (People). Each new group gets the `/legal` re-check that plan already requires.*

- [ ] Volunteers · "Needs a new {document}" as rows under Who. "Email everyone who needs a new one" opens this window.
- [ ] The board group widens to directors the club records in People who hold no account (the seat-based board is in
  Stage 1). `/legal` re-runs, as its addendum requires for anyone with no account.

### Stage 5 — Each its own decision, later
- [ ] The Club notice moves in (ruling 10), with the pointer left in the Public site editor.
- [ ] Attachments. Send later. Showing a message in the family app once families sign in.

## 4. Build consequences of the rulings (to confirm in the drawings, not new rulings)

- **Which family groups a sender is offered.** Every family, rep teams and a house-league season follow the programs the
  seat runs. "A Families list" (Owes money, Missing forms, No consent on file, Not back this season) is a filter of the
  Families book. Drawn as offered only to a seat that holds the book. *(Stage 1 ask.)*
- **A row wider than your programs.** Ruling 5 lets a registrar see a club-wide email that reached house-league families.
  Drawn as: the message and the counts, and no named lists, since the names include families outside their program.
  *(Stage 1 ask, and a `/legal` point.)*
- **A plan that carries only one kind of email.** A group the plan doesn't carry is not drawn (the coach email drawing's
  rule). The place appears when the seat has at least one group to write to; a seat with none gets no place.
- **A member limited to some rep team groups:** no Communications place in Stage 1, as Families refuses them today.
- **Daily allowance:** unchanged in Stage 1 (the club's 3 in 24 hours for family mail from the club door; each season's
  own; none for coach mail, pending the coach drawing's ask 12).

## 5. Architectural decisions

- **Decision:** the home is decided before the coach email is built. **Rationale:** building Organization › Group email
  first means the tab, its help article, its demo stop and its list move a second time.
- **Decision:** contextual doors stay. **Rationale:** they open the same window; removing them makes "email the people
  I'm looking at" slower and buys nothing.
- **Decision:** two mail paths stay two paths under one window. **Rationale:** `CASL_COACH_GROUP_EMAIL.md`; family mail
  carries the unsubscribe and the allowance, colleague mail carries neither.
- **Decision:** the list is a read over existing logs, not a new copy. **Rationale:** the season screen and the hub must
  never disagree; one reader with a scope.
- **Decision:** sending is separated from reading household records. **Rationale:** the house-league desk already sends
  without the Families grant; the sender sees a count and names only.

## 6. What this replaces elsewhere

- `BOARD_READY_PLAN.md` §5 Stage 2: asks 6 (history's home), 7 (the door) and 13 (second doors) are replaced by this
  plan. Asks 1–5 and 8–12 stand and are owed. The Organization tab list in NAV_STANDARD N11 does not change.
- `PUBLIC_SITE_BUILDER_PLAN.md` §7 and `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` L3112: answered by ruling 10 (Stage 5).

## 7. Words for /marketing
> Customer-visible wording written during the build, settled in ONE `/marketing` pass per stage, before the walk.
- [ ] "Communications" — the sidebar, the bar, the More sheet — every seat that holds it
- [ ] "New email" · "To families" · "To coaches" — the place's action row — senders
- [ ] The list's lede, empty state and filter words — Communications — senders
- [ ] The member window's line for the Communications switch — Organization › Members — the owner
- [ ] The "not yours" words for Communications — a seat without it, from a bookmark

## 8. Open questions

- [ ] The Stage 1 drawing's asks (listed on its Asks tab once published).
- [ ] The coach email drawing's ten standing asks (1–5, 8–12).
- [ ] The two naming points under ruling 2: the Coaches Portal's "Communication" heading, and the tournament page's
  Communications / Messages pair. Settle when the place ships.
- [ ] `/legal`: Stage 2's mixed send (ruling 7) and Stage 3's coach team emails (ruling 8), each before it is drawn.
- [x] **⚖ RULED 2026-11-17 (owner, Session 1, as recommended): the retention lengths.** Subject and message deleted
  **12 months** after the send; recipients' names and roles **24 months** after; sender, date, group and counts kept
  while the organization exists; **one clock** for families, coaches and the board, bodies stored apart; **automatic, a
  nightly job** (the owner's go for the watched-automation job, given in the same answer). Consequence, said to him: once
  a body is gone "Send to the ones it missed" refuses; the family log began 2026-10-22, so the first run blanks nothing
  before October 2027.
- [ ] Club data-processing terms must list sent-email records (owed before the club tier goes on sale, not before this
  build).
- [ ] After Ask 6: if New email keeps its words on a phone, a season's Email families (symbol alone today) follows as a
  small later fix.
- [ ] A lawyer's eye before Stage 3 is built (it changes whose record a coach's words sit in). Not needed for Stage 1.
