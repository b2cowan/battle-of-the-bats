# Club Communications · Stage 1 build prompt (three sessions and a close)

> Written 2026-11-16, after the owner ruled everything Stage 1 needs, **all as recommended** ("I agree with your recommendations,
> go ahead with the first build prompt"): the direction (12), the Stage 1 asks (14), the board asks (5), and the coach email
> drawing's ten standing asks.
> Paste into a **fresh chat on `dev`** (`/clear` first), one session at a time:
> `execute Session 1 of @docs/projects/active/CLUB_COMMUNICATIONS_STAGE1_BUILD_PROMPT.md` (then 2, 3, Close, **in that order**).
>
> Drawings (the spec), both ruled. **Build to them. Open the tab for the piece you build: its notes carry the exact words and
> rules; this prompt does not restate them.**
> - The place, the list, New email, seats, Families, phone, the board: https://claude.ai/artifact/KKY5hxQMzwHC7usRVUChn4, source
>   [CLUB_COMMUNICATIONS_STAGE1_DRAWINGS.html](CLUB_COMMUNICATIONS_STAGE1_DRAWINGS.html) (9 tabs).
> - The coach email's own window, recount, pick, record and phone frames: https://claude.ai/artifact/WVuNq47ywkxKgmFSYew2eF, source
>   [BOARD_READY_STAGE2_GROUP_EMAIL_DRAWINGS.html](BOARD_READY_STAGE2_GROUP_EMAIL_DRAWINGS.html), **tabs 2–6 and 8 only**. Its tab 1
>   (an Organization tab) and its asks 6, 7, 13 are replaced; **do not build Organization › Group email.**
>
> Plan of record: [CLUB_COMMUNICATIONS_PLAN.md](CLUB_COMMUNICATIONS_PLAN.md) §1 (rulings), §3 Stage 1, §4. PM brief:
> [CLUB_COMMUNICATIONS_PM_BRIEF.md](CLUB_COMMUNICATIONS_PM_BRIEF.md).
> **Legal (not optional):** `docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md`, section **"Build-prompt checklist 2026-11-16"**, plus
> `docs/agents/legal/CASL_COACH_GROUP_EMAIL.md` (the build guard). The checklist holds the fixed strings, the route rules and tests T1–T26.
> Marks: **[H]** = from a helper's read on 2026-11-16, **re-open before editing**. Line numbers drift.
> Branch `dev`; explicit pathspecs; ask before committing; never push. Size: **Large** (three build sessions).

## What this builds

One place in the club portal for the email the club sends to groups: **Communications**, in the Club group of the sidebar after
Families. It holds one list of what went out and one **New email** button offering **To families**, **To coaches** and **To the board**.
The family window is the shipped one. The coach window is the one drawn on 2026-11-16. The board window is the coach window with the
board's rows. Families loses its Emails tab; every other button that starts an email stays and lands in the same list.

Where the code makes a drawn thing wrong or impossible, **STOP and draw the difference for the owner. Never decide it silently.**

## The rulings (copied from the ruled asks; add nothing)

**Direction (plan §1):** one home, many doors · the name is Communications · Club group, after Families; a More-sheet row on a phone;
Families loses its Emails tab · sending no longer needs the Families book · you see every email that reached people in the programs you
run; owner and admins see everything · a season keeps its Email families tab · the member window's "Communications" switch becomes the
place's on and off · the coach email is built inside this place.

**Stage 1 asks 1–14 (drawing tab 9):**
1. **New email is one lime create button with a choice inside** (plus, words, small arrow; no envelope).
2. **A league admin or registrar's "To families" opens the season's own window**; the menu names each season under way. A finished
   season is emailed from its own tab.
3. **"Families from a list" is offered only to holders of the Families book.**
4. **An email wider than your programs:** a family email shows its message and counts and **no names**; a coach email names only your own coaches.
5. **The switch is on by default for league admin and league registrar; off means no group email from ANY screen** (the place, a
   season's Email families, a list's button). Automatic emails still go.
6. **Phone:** a More-sheet row that never fills a bar tab or a tile; **New email keeps its words**.
7. **Families keeps no pointer**; the old address forwards.
8. **The filter:** All · To families · To coaches · To the board, then each season emailed.
9. **The words** as drawn, then one `/marketing` pass (Close).
10. **With one choice, the button names it and opens it** (Email families / Email coaches / Email the board). No one-item menu.
11. **A line under the message box says who can read the email afterwards** (the corrected wording is in the legal checklist §2b).
12. **An admin without the Families book sees family names** in Opted out and Didn't go, as a book holder does.
13. **A message to one family is listed only for Families book holders** (a league seat still sees the ones sent from its season).
14. **Anyone who may send to that group can finish a stopped email**; others are told who can.

**The board, asks 15–19 (drawing tab 8):**
15. **The board = everyone on Organization › The board**, active accounts only, and the row says so.
16. **Every board seat may email the board**; a treasurer gets a Communications place (switch on by default) holding that one button.
17. **A board email is read by its sender, its recipients, and the owner and admins.** Nobody else, including a later joiner.
18. **"To the board" is a third choice**, not a row in the coach window.
19. **No off switch for receiving board email.**

**The coach email's ten (coach drawing tab 9; text in `BOARD_READY_PLAN.md` §5 Stage 2):** 1 owner and admin send to every coach
group, league admin and registrar to house-league coaches only · 2 groups: All coaches · Rep coaches (everyone on the staff / head
coaches only) · House-league coaches (the season / one division) · Coaches you pick · 3 no saved lists; "Send again to these coaches"
from a record · 4 a rep team's whole staff counts · 5 tournament coaches are not a group; tournament announcements untouched; the one
pointer line while a tournament is running · 8 rep teams count unless archived; unaccepted rep invites left out and named;
house-league coaches included whether signed in or not · 9 From "{Club} via FieldLogicHQ", replies to the sender · 10 names and teams,
never an address · 11 the recount compares the people, names who changed, never sends by itself · 12 no daily allowance on coach
email, only the just-sent check.

**Added 2026-11-17 in Session 1 (owner, after push-back; plan §1 R1–R4; legal addendum 2026-11-17):** R1 a sender with no
name is refused · R2 **replies go to the club's public contact by default and the email names the club** ("{Club} sent
this."); the sender may switch to "Replies come to me"; no contact = replies to the sender · R3 **the same choice in all three
windows, the shipped family window included** · R4 **no typed CC or BCC**; a "Send a copy to the club's inbox" tick, on the
family and coach windows only (never board email). The engine carries all four; **Session 3 draws the switch, the tick and
the changed window lines** (exact words: the addendum's both-modes table; `WINDOW` in `lib/club-group-email-words.ts`).
Owner question carried: does the board window open on "Replies come to me"? (/legal recommends yes.)

## ⚖ The retention decision — RULED 2026-11-17: 12 / 24 months, nightly (plan §8)

`/legal` requires one clock for every sent-email log, built with the tables. **Check the plan §8 for the owner's ruling; if there is
none, ask him before writing the migration** (state the default and the one consequence):
- **Recommended default:** subject and message deleted **12 months** after the send; recipients' names and roles **24 months**; sender,
  date, group and counts kept while the organization exists. One clock for families, coaches and the board, bodies stored apart so a
  body can expire sooner later. Automatic, a nightly job.
- **The consequence to say out loud:** the first run blanks the words of every family email older than the clock, and "Send to the ones
  it missed" must refuse once a body is gone.

## /legal build rules (from the checklist; not optional)

- **Two mail paths, never one message down both.** Family mail keeps its envelope, unsubscribe, suppression and 3-in-24-hours exactly as
  shipped. Coach and board mail are colleague mail: no family footer, no unsubscribe, **no link of ours anywhere**.
- **The fixed strings are pinned by the build guard**: From, foot, the sender line `{Sender} ({Role}, {Club}) sent this.` on **both**
  colleague kinds, the removal line, and a **reason line computed per recipient from their own basis** (rep staff / house league /
  picked / board "as {an admin}"). Exact text: checklist §2b.
- **Server-enforced, per route:** who may send and read; names withheld **in the reader** for a league seat on a wider row; the board is
  **its own branch in the reader, chosen by kind before any program rule**; a pending board member is named only in "See who gets it"
  and only to an owner or admin sender (the foot is a count for everyone); a suspended member appears nowhere; **no response carries an
  address**, and a nameless person reads "A family", "A coach" or "A board member (treasurer)".
- **The switch gates sending and the place. Receiving board mail depends on the seat only.**
- **Never "notice", "formal notice" or "directors"** for the board, in any string or help text.
- **Must not ship in Stage 1:** checklist §3 (13 items: a tick-across window, coaches' own team emails as rows, automatic or tournament
  rows, tracking, attachments, send later, saved lists, a From-name change to the existing colleague sends…).
- **⛔ Release gate:** this code must not reach production until the clock is decided **and** built as a scheduled job **and** the §5/§9
  sentences are in `docs/agents/legal/drafts/PRIVACY_POLICY.md`. Session 1 does all three, so a promote after Session 1 is inside the
  gate. Record the gate in the plan and tell the owner at each hand-off.

## Facts read from the code (2026-11-16; re-check the lines you touch)

- **One machine today [H].** Window `components/admin/kit/club/families/EmailFamiliesWindow.tsx` (club door with no `season` prop;
  season door with it; eyebrow = the season's name there, ~L302). Sender `deliverFamilyEmail` in `lib/families-email.ts` (~L297;
  `sendFamilyEmailToClub` ~L256). Tables `family_email_sends`, `family_email_recipients`. Season send `lib/house-league-email.ts`.
- **The list and record [H].** `components/admin/kit/club/families/EmailsTab.tsx` (lede, filter, outline door ~L82–118),
  `EmailLog.tsx` (`EmailLogList` ~L60; `EmailRecord` ~L151–262; the Automatic tag rides the subject; Stopped chip before the figure).
  Reader `lib/families-emails-log.ts` (returns `optedOutNamed` / `missedNamed` to whoever the route admits). Routes
  `app/api/admin/families/email/route.ts`, `.../families/emails/route.ts`, `.../emails/[sendId]/route.ts`.
- **Gates today.** Families door and list: `requireFamiliesAccess`, `lib/families-auth.ts` L26–38 (`module_families`, off by default for
  every role, and not team-limited). Season door: `houseLeagueRefusal(ctx,'email')`, roles in `lib/house-league-access.ts` L46–49.
  `module_communications`: a core module (`lib/plan-config.ts` L32–36), default-on for owner and admin (`lib/roles.ts` L39–62), listed
  in `components/admin/kit/club/ManageMemberDialog.tsx` L62, **read by no route or screen**. Role defaults are pinned by
  `tests/unit/role-defaults-guard.test.ts`.
- **⚠ The Families layout refuses first [H].** `app/[orgSlug]/admin/families/layout.tsx` ~L34–44 returns the "not yours" screen before
  any page under it runs, so the forward from `/admin/families/emails` must live above it (`proxy.ts` or a config redirect) or it never
  runs for an admin without the book.
- **⚠ Address fallback.** `personDisplayName`, `lib/families-read.ts` L376–379, returns the email when a person has no name; it feeds
  one-family rows (`lib/families-emails-log.ts` ~L177, L189 [H]).
- **Strings to re-point [H].** `lib/families-words.ts`: `FAMILY_EMAILS_TAB_WORDS` (~L448–483; "sent from Families", tab word "Emails"),
  `FAMILY_EMAIL_WORDS.unknown` (~L432, "Check the Emails tab"), the season filter label (~L644), the no-family "Show them" link
  (`EmailFamiliesWindow.tsx` ~L358–361 → `/families?show=nofamily`).
- **Colleague mail today.** `lib/families-email-coaches.ts` (`sendEmail` with `kind` and `replyTo`, five at a time);
  `familySenderName` and `platformLineWords` in `lib/email-club-identity.ts`. Send window parts `components/admin/kit/club/SendParts.tsx`
  (`SendRow` radio / checkbox / `off`; `SendRows group`; the who-list ~L200–221).
- **Coach groups.** Rep staff: `rep_team_staff_memberships` (active, team not archived; emails via `auth.users`,
  `getTeamStaffPanelList` in `lib/coach-membership.ts` ~L438); the schedule send's `schedulePeople` recipe without its capability
  filter. House league: `league_team_coaches` (name + email, may have no account; `leagueCoachesToCopy`). Union key: trimmed,
  lower-cased email.
- **The board.** `BOARD_ROLES`, `lib/board-people.ts` L13 (owner, admin, league_admin, league_registrar, treasurer; `roleWithArticle`
  ~L23); `boardNames`, `lib/member-names.ts` L96–123 (`status='active'`; no email leaves it). **Not** `boardRecipients` in
  `lib/two-step-emails.ts` (owner, admin, treasurer only). Invited = an `organization_members` row with `status='invited'`.
- **Nav [H].** `lib/admin-kit-nav.ts`: `LEAD_ORDER` ~L185, `PLACE_GROUP` ~L491, `clubPlaceGroups` ~L508, `clubSheetGroups` ~L536,
  `familiesTabs` ~L662–669; "every place added here … must hand the bar its parts" ~L740. Rail `components/admin/kit/AdminKitRail.tsx`;
  phone `AdminKitBottomNav.tsx` + `lib/nav-tiles.ts`. A one-page place with no tab strip: `PermitsFrame.tsx`. Action row: `TabActions`,
  `components/admin/kit/club/PlaceFrame.tsx` ~L52. Standard: `docs/agents/design/NAV_STANDARD.md` (N2, N5 row 11 = `Mail`, N7, N10, N11,
  N12) and its guard `tests/unit/nav-standard-guard.test.ts`.
- **The create menu.** `components/coaches/CoachToolbarMenu.tsx` `variant="primary"`; club usage
  `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` ~L1290 (Add event → Game / Practice).
- **Not yours.** `components/admin/kit/club/NotYours.tsx` / `NotYoursScreen.tsx`, words `lib/not-yours-words.ts` (the `grant` pattern
  and the role-list pattern); a refused seat's bar keeps the club's name.
- **⚠ Name collision.** `app/api/admin/communications/route.ts` and `/[orgSlug]/admin/tournaments/communication` are the **tournament**
  announcements. The club place takes a page path and an API namespace that cannot be confused with them; say which in the UX summary.
- **Help.** `lib/help-content/families.tsx` (`families-email`, `families-what-it-is`), `org.tsx` (`roles`), `house-league.tsx`
  (`who-can-do-what`, `email-families`), `registrations.tsx` (`reaching-registrants`); `lib/admin-page-help.ts` ~L101. No demo tour
  stops on the Emails tab.

## Order and models

| Session | What | Model | Waits on |
|---|---|---|---|
| 1 | The engine: the clock, the tables, the groups, the colleague sender, the routes, the guard. No screens. | **Opus** | The retention ruling |
| 2 | The place: nav, the merged list and records, the gate change, the switch, Families after the move | **Opus** | 1 |
| 3 | The windows: New email's menu, the coach window, the board window, the phone | **Sonnet** | 2 |
| Close | Reviews, words, help, the as-built legal read, the closing walk | **Opus** | 3 |

**Why these models.** Sessions 1 and 2 decide who may send to whom and who may read what; one miss is a leak of names or a send
nobody authorized. Session 3 is screens and words on mechanisms already proven, built from two ruled drawings.

- ⚠ **Shared files have other sessions' uncommitted edits** (2026-11-16 `git status`: `app/[orgSlug]/admin/help/page.tsx`,
  `components/admin/kit/club/league/registrations/RegistrationsScreen.tsx`,
  `app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx`, `TODO.md`, `BOARD_READY_PLAN.md`, `OWNER_QA_LEDGER.md`,
  `docs/agents/legal/LEGAL_INDEX.md`, and more). **Run `git status` first; ask the owner whose they are before editing any of them;
  never commit them as yours.**
- **Migrations: the next free number** (490 is the latest at writing [H]; check again at commit time). Dev only; the prod step recorded
  in `supabase/migrations/MANUAL_PROD_STEPS.json` and the plan; **`docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` in
  the same unit of work**; a SQL fixture beside it. **One migration for the tables and one for the nightly job**, so Sessions 2 and 3 add none.

## Standing for every session

- Before code: the plain-language **UX summary** (AGENCY_RULES, blocking). Raise an owner call there; do not decide it.
- Branch `dev`. Explicit paths only. **No commit without the owner's yes.** Shared files go through a private index.
- Broad reading goes to helpers, and their claims are checked against the cited lines.
- `npm run verify:changed` per session; `npm run typecheck` (shared modules, routes and role defaults change in every session).
- Dev server: restart only as `AGENTS.md` says (new files and shared modules: once, near hand-off).
- Every new customer-visible sentence goes in **one words block** (name it in the summary) so Close's `/marketing` pass is one read.
- The demo worlds are seeded by other sessions; `/demos` picks this up in its cycle.
- Record each session's commit hash and walk number in the plan §3 Stage 1, the TODO line and Claude memory.

## Session 1 · Opus — the engine (no screens)

Drawings: coach drawing tabs 2, 4, 5, 6, 8; Stage 1 drawing tabs 3 and 8. Legal checklist §2a–§2e.

- [ ] **The retention ruling** (above), recorded in the plan §8 before the migration is written.
- [ ] **Migration A, the tables:** the colleague send log and its recipients (the coach drawing's tab 6 build note), covering coaches
      **and** the board through an open-ended group kind; recipients keyed by their source row with name and role or team line **as
      sent**, a status, **no address column**; **the body stored apart from the who-and-when**. `/dba` reads it before it is applied.
- [ ] **Migration B, the clock:** a nightly job over the new tables **and** `family_email_sends` / `family_email_recipients`, as
      migration 472 does for friend requests. It blanks bodies and names on the ruled clock and keeps counts.
- [ ] Dictionary (the new tables; **replace the stale "NEVER a list of families" sentence** under `family_email_sends`), snapshots, SQL
      fixture, the prod steps recorded with their order against the code.
- [ ] **The privacy sentences** (§5 and §9, drafted in the checklist §4) written into `docs/agents/legal/drafts/PRIVACY_POLICY.md`
      with the ruled lengths; `LEGAL_INDEX.md` line. Not published here.
- [ ] **Group builders, live:** the coach groups exactly as coach asks 2, 4, 8 rule (and the counts on the coach drawing's tab 8 as the
      fixture's expected values); the board from `BOARD_ROLES`, active only, the sender not counted. Each returns people, never
      addresses, to anything a screen reads. The board builder imports no families module.
- [ ] **The colleague sender:** one email per person, five at a time, Reply-To the sender, the fixed strings from the checklist §2b,
      the per-recipient reason line. A sender with no address on file is refused.
- [ ] **The recount at Send compares the people** (coach ask 11): a swap with the same total is held; it names up to three; it never
      sends by itself.
- [ ] **Routes** under the club's own namespace: count / preview, send, finish a stopped send, read one record, "send again to these
      people" (opens with the pick filled in, no auto-send). The just-sent check; no daily allowance.
- [ ] **Who may send, on the server:** coach ask 1; board ask 16; a member limited to some team groups is refused; a group the seat was
      not offered is refused when posted by hand; every route asks the Communications switch.
- [ ] **The reader for colleague rows:** board is its own branch (ask 17); a league seat sees All-coaches rows with only its own coaches
      named and the rest counted (ask 4); pending and suspended as the checklist rules.
- [ ] **The build guard and tests** T1–T8, T10, T13–T21, T24–T26 from the checklist §2e (the rest land with the screens they test).
- [ ] **A probe** in `.probe/` that sends each kind on dev to a seeded club and prints what each seat's reader returns. Never run it
      against a server the owner is using.

**Ends with:** the UX summary's promises proven by the probe output and the tests, `/review` on the diff, the owner's yes, a commit.
**Walk:** none (no screen). Hand the owner the probe's seat-by-seat table in plain words.

## Session 2 · Opus — the place

Drawings: Stage 1 drawing tabs 1, 3, 4, 5 and the phone's frames a and b (tab 6).

- [ ] **The place:** the page, its help topic (N12), the bar's parts, the sidebar row (`Mail`, Club group, between Families and Public
      site), the More-sheet row. **Kept out of the bar-and-tile fill order** (ask 6). `NAV_STANDARD.md` and its guard updated in the
      same change (N2's Club list, N5 row 11, the Families tab list).
- [ ] **The switch:** `module_communications` gates the place and every group send from every screen (ask 5); role defaults add league
      admin, league registrar and treasurer; the member window says what it covers in one line; `role-defaults-guard` updated.
      **Receiving board mail does not ask the switch.**
- [ ] **A seat with nobody to write to gets no place** (tab 4). Until Session 3 ships the coach and board windows, that means a seat
      with no family choice; Session 3 widens it to coach-only and board-only seats (the treasurer). The "not yours" screen with the two word patterns (tab 4), the club's
      name in the bar, the home door by seat; a `NOT_YOURS_PAGES` entry.
- [ ] **The gate change:** the club's family send and the list stop asking for the Families book (direction ruling 4). "Families from a
      list" stays book-only (ask 3). A sender without the book gets the no-family **count without its link**. A member limited to some
      team groups is still refused.
- [ ] **The merged list:** one reader over the family log and Session 1's log, the shipped `EmailLogList`, `TabActions` for lede +
      filter + button. Per-seat rows as tab 3 lists them; names withheld in the reader (ask 4, T12); one-family rows book-only (ask 13);
      **no address fallback** (T17). The filter's choices (ask 8). Empty, loading, failed, Sending… and Stopped as today.
- [ ] **The records:** the family record with the place's eyebrow; the coach and board records from Session 1's reader, as drawn (coach
      drawing tab 6; Stage 1 tabs 3 and 8). "Finish a stopped email" follows ask 14, and the board's narrower rule.
- [ ] **New email, for now:** the family choice only, so by ask 10 the button reads **Email families** and opens the shipped window
      (the season's own window for a league seat, ask 2). The readers line under its message box (ask 11).
- [ ] **Families after the move:** the tab row loses Emails; the old address forwards **for a seat that cannot open Families** (T23);
      strings that say "the Emails tab" re-pointed; "Email these families" on a list unchanged and absent when the switch is off.
- [ ] **A season's Email families** reads the same record, no visible change (direction ruling 6). Its send asks the switch.
- [ ] Tests T9, T11, T12, T22 (family window), T23. `check:layout --changed` on the place, Families, the member window.

**Ends with:** `/review`, the owner's yes, a commit, and **Walk A** published as a checkable Artifact (20–50 boxes, one action per
step; one purpose: *the place and who sees what*): the owner finds Communications and sends to every family; an admin without the
Families book does the same and never lands on a Families screen; a registrar sees the club-wide row with no family names; a
treasurer has no place yet; the old Emails address forwards; the switch off removes every send button for that person.

## Session 3 · Sonnet — the windows

Drawings: Stage 1 drawing tabs 2, 6, 8; coach drawing tabs 2–7. **Start here:** read Session 1's and 2's hand-off notes in the plan;
do not re-derive the routes or the seat rules, call them.

- [ ] **New email as the create menu** (ask 1): the shipped primary toolbar menu, each choice with its second line; one choice → the
      button names it (ask 10); a league seat's menu names each season under way (ask 2); the board choice absent when the board is
      only the sender. On a phone the button keeps its words (ask 6) and the choice opens as a sheet above the bottom bar.
- [ ] **The coach window**, all its levels, from the coach drawing: the groups with live counts, the head-coaches-only pick, the
      division and season fields, "Coaches you pick" with its search past 8 people, "See who gets it", "See the email", the recount
      states (tab 4), the tournament pointer line, the Last sent line (following the read rule), the foot's count sentence.
- [ ] **The board window** (Stage 1 tab 8): the same parts; the two rows; the two lines under the message box; the pick list by name
      and role; the pending count in the foot and the dimmed named row only where the checklist allows it.
- [ ] **The treasurer's place:** one button, Email the board; its list; its empty state.
- [ ] The windows' eyebrow rule (ask 9); "Send again to these people" from a record; every phone frame (coach drawing tab 7; Stage 1
      tab 6) at 44px.
- [ ] Tests T22 (the colleague windows' lines). `check:layout --changed` on the place and both windows, desk and 390.

**Ends with:** `/review`, the owner's yes, a commit, and **Walk B** published (one purpose: *writing to coaches and to the board*):
an owner emails all coaches, picks three, holds a recount; a league admin reaches only house-league coaches; an owner emails the
board; a treasurer sends the board a statement and sees only board emails they sent or received; a picked board email is invisible
to a member who wasn't picked.

## Close · Opus

- [ ] `/simplify` → `/review` (high) over all three sessions. `/dba` on the shipped migrations.
- [ ] `/marketing` on the one words block: the lede, the empty states, the menu choices and their second lines, the "not yours" lines,
      the member window's line for the switch, the readers line and the board line (**inside the limits the legal checklist §2b sets**).
- [ ] `/legal` as-built: the finished code against the checklist §2 (the route table, the JSON tests, the guard samples, the three
      window lines); confirm the privacy draft sentences match what was built.
- [ ] `/docs`: the emailing article moves under Communications and gains coaches and the board; the role table and the house-league
      "who can do what" are corrected; a Communications help topic. **It must not say admins open household records, call board email
      formal notice, or say board mail can be turned off** (checklist §4).
- [ ] `check:spelling`, `verify:changed`, full `npm run typecheck`, focused suites; dev-server restart; `check:layout --changed`.
- [ ] Plan §3 Stage 1 ticked with commit hashes; the PM brief's state; the TODO line; `BOARD_READY_PLAN.md` Stage 2 and its prompts
      index row; the Owner QA Ledger sections for Walks A and B (next free § at the time; 535 at writing [H]); Claude memory.
      `/demos` at its cycle (not here).
- [ ] Tell the owner the release gate's state in one line (the clock, the job, the policy sentences), and what the next promote carries.

## Open owner calls this does not settle (carry forward, do not decide)

- **The retention lengths**, if not yet ruled when Session 1 starts (above).
- The two naming points under direction ruling 2: the Coaches Portal's "Communication" heading, and the tournament page's
  Communications / Messages pair.
- A season's Email families shows its symbol alone on a phone; ask 6 keeps New email's words. Bringing the season's button into line
  is a small later fix, not part of this build.
- The club data-processing terms (owed before the club tier goes on sale, not before this build).
- Stage 2 (one message to families and coaches together) and Stage 3 (the whole record) each need their `/legal` questions answered
  before they are drawn; the lists are in `docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md`.
