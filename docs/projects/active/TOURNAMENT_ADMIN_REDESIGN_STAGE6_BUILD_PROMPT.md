# Tournament admin redesign · Stage 6 build — The volunteers, built to hub v31

> Paste into a fresh session on `dev`. Written 2026-10-07, the day the owner ruled Stage 6 from the hub's paste-back:
> **V1–V7 as drawn, and A25–A32 as recommended.** The drawing had been through the formatting check and a second,
> independent reviewer (eight departures and four overstated claims fixed before the ruling, hub v31).
>
> **The spec is the hub:** https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM → **Stage 6** tab (v31 or later), read
> one part at a time from its bar.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW / RESTYLED /
>   UNCHANGED tag note on the tab is a requirement; open each one.
> - The **Formatting check** part is your checklist, every row, including the second reviewer's.
> - Where you must depart, say so at build time and record why. Never depart silently.
> - The rulings' **unchosen options** are not built: V1 keep-eyebrow · V2 keep-card · V3 event-beside · V4
>   one-duty-no-bar · V5 words-only · V6 none · V7 print-only · A25 capability rule / staff to the gate · A26 a stored
>   landing preference / words only · A27 phones only / the sheet only · A28 plain / tint · A29 gate only / later ·
>   A30 a × on the score sheet / leave · A31 no banner / hide under a sheet only · A32 store a send-back / silent.
>
> **Read first:**
> - **Plan** `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`: §3 "The volunteers" (F36, F58–F65 and the 2026-10-07 re-measure),
>   **§6f** (V1–V7 as drawn, the asks, why A25 differs from the design prompt, the formatting check and the
>   reviewer's fixes, not drawn, the taps), §7 and §9.
> - **Memory:** `project_tournament_admin_redesign`, `feedback_build_to_approved_mockups`,
>   `feedback_portal_is_the_formatting_benchmark`, `decision_drawer_layers_form_vs_menu`,
>   `decision_close_x_is_plain_glyph`, `decision_waiting_count_is_amber_pill`, `decision_autosave_word_is_transient`,
>   `feedback_shared_component_over_shared_class`, `reference_code_gotchas_index` (dates and clocks:
>   `formatStoredDate` / `formatTime` only).
> - **The in-repo `memory/design_decisions.md`** entries of 2026-10-07 (a close × is a plain glyph), 2026-10-05 (the
>   Sheet Frame: two layers, three heads, D4's corners and dim for the admin's own sheet), 2026-10-01 (the white
>   action button; a door is olive text; the amber waiting count), 2026-08-08 (the score sheet: Cancel is the way
>   out, a tap on the dim does nothing) and 2026-08-07 (Option C: the buckets over the tabs, the duties as tabs).
> - **The shells' own history** before touching them: `components/volunteer/DayOfBottomBars.tsx`'s header (why the
>   bars are where they are) and `DayOfShell.module.css`'s header (`--dayof-bottom-h`, and why a clearance is never
>   hard-coded).

## Preconditions (check before code)

1. **The dev server works.** Don't fix another session's code; tell the owner. Start it only with `npm run dev`,
   with network access.
2. **`/marketing` confirms the words before you build them.** The placement is ruled; the words are `/marketing`'s.
   Run it once, on this list:
   - **The role's name.** Today `official` shows as *Scorekeeper* everywhere (Members, the invite, the Workspaces
     card, the accept page, the invite email). The drawing's *Game-day volunteer* is a placeholder. The duty names
     *Scorekeeper* and *Gate* in the Account sheet's duties line stay duty names.
   - **The invite:** the role's one sentence; *Helping with* and its three choices (*Scoring · The gate · Both*);
     each hint, which is now true (*They'll check teams in. They won't see or enter scores.*); the invite email's
     button words (*Open Check-In* / *Accept Gate Volunteer Invite* today, Title Case).
   - **The score sheet:** *Enter the score* (today *ENTER SCORE*); the review note (today *This tournament requires
     admin review before scores become final.*, which names a role a parent may not know) and the final-at-once note;
     *Submit for review* · *Finalize score* · *Save correction* (Title Case today); the confirmation *Sent for review ·
     Wolves 7, Royals 4* / *Final · Wolves 7, Royals 4* (today *Score sent for review — An admin can now review and
     finalize this result from Results & Scoring*: the page is called Results now); the sent-back notice *Wolves vs
     Royals was sent back to be scored again*.
   - **The gate:** the finished-event line (*This tournament is finished, so check-in is closed. Ask the organizer if
     a team still needs checking in.*); the picker's status words (*Spring Classic 2026 · Completed*); *Un-pay*.
   - **The banner:** *Install FieldLogicHQ* · *Tap Share, then Add to Home Screen.* (*Add to Home Screen* is Apple's
     button name; a `spelling-ok` note if the gate needs one).
   - **The Staff kit:** the intro sentence; each card's one line; *Copy link* · *Open* · *Invite a volunteer*; the
     printed page's three steps and footer; the browser tab *Staff kit* (today *Staff Kit*); today's closing paragraph
     goes (it names *Settings & Access*, a role called *Volunteer*, and a promise F62 shows is false).
   - **The title:** *Field scores* stays unless `/marketing` says otherwise; the *SCOREKEEPER* eyebrow goes.
3. **Ask the owner whether another session is measuring** before any probe, `auth-setup` or sweep. One browser
   tester at a time; scope sweeps with `--only=`.
4. **The UX summary for the owner comes first** (AGENCY_RULES). Keep it short, since the drawings are ruled: what a
   parent volunteer meets from the QR code to the second score, what the gate volunteer meets the next morning, what
   the organizer meets in the Staff kit and the invite, and the two placements below.
5. **Two placements the drawing does not show. Put them to the owner in the summary, each with a recommendation.**
   - **P1 · Who may change a volunteer's jobs after the invite.** Today a member's access is changed **only by an
     owner** (`app/api/admin/members/[memberId]/route.ts`: a capabilities change by anyone else is refused). After
     A26, anyone who may invite (*manage members*, e.g. an admin) chooses the job at the invite, and could not change
     it a minute later; the drawn hint says *Change it any time in Members*. **Recommend:** whoever may invite may
     also switch an `official`'s two jobs (*Submit scores*, *Check teams in at the gate*) and nothing else: only
     those two keys, only on an `official`, only within the role's own defaults, so nothing can be granted that the
     role doesn't already carry. Every other capability change stays owner-only. Alternative: keep owner-only and
     word the hint so it names the owner. **Shared: Club Tier's Members.**
   - **P2 · A volunteer with neither job.** Members can switch off both of an official's jobs today; the person then
     meets the scorekeeper's *no access* wall at every sign-in. **Recommend:** Members refuses switching off an
     official's last job, in words (*A volunteer needs at least one job. To end their access, remove them.*, words
     `/marketing`). Alternative: allow it, and the landing sends them to that wall as today.

## ⚠ Running beside other work (as of 2026-10-07)

Club Tier Stage 3c (the fiscal year) has its server and screens prompts written; the coaches portal's sessions run in
their own areas. What you may share with them:

- **Club Tier's Members** (`components/admin/kit/club/MembersKit.tsx`, `InviteMemberDialog.tsx`,
  `ManageMemberDialog.tsx`, `app/api/admin/members/**`), **the roles** (`lib/roles.ts`, `lib/member-access.ts`,
  `lib/board-roles.ts`), **the landing resolver** (`lib/user-contexts.ts`, `lib/auth-destination.ts`, the admin
  layout's official redirect), **the admin bottom sheet** (`components/admin/BottomSheet.*`), **the Sheet Frame**
  (`components/coaches/SheetFrame.*`, `useDialogFloor`), **the install banner** (`components/InstallAppPrompt.*` and
  its guard test), **the admin kit** (`RepKit.*`, the old-look baseline `scripts/.admin-old-look-baseline.json`), the
  dev server, the UAT sessions, the owner's walks, and the shared docs (`TODO.md`, the Owner QA Ledger, the data
  dictionary).

Five rules, Stage 2's:
1. **Neither session edits the other's files.** If any shared file above has someone else's uncommitted edits when
   you reach it, stop and tell the owner rather than editing around them. Whole-tree gates may fail on another
   session's half-done edits: typecheck your commit's own tree in an isolated copy (`git archive` of the staged tree,
   `node_modules` junctioned in), run your tests by file, and report a failure in someone else's files.
2. **`check:old-look --init` reads the whole working tree.** `git status` the baseline's other files first; if
   another session has any modified, run `--init` in the isolated copy and commit only your files' lines.
3. **Stay off the dev server during another session's captures or sweeps**; ask the owner before any browser use.
   Write code meanwhile.
4. **Stage by explicit pathspecs from a private index**; commit only your hunks of shared docs.
5. **Take the next free Owner QA Ledger §** at the moment you write the walk, after re-reading the ledger.

## Fixtures, and what never gets written

- **The volunteer accounts:** `uat-plus-scorekeeper@uat-plus-org.local` (an `official`, both jobs, on the Plus
  Championship) and the free club's scorekeeper (`.env.local`'s `UAT_*` lines). The Championship's games are in June:
  open the scorekeeper on **June 14** (4 to score, 1 final, 1 cancelled). **Both test clubs finalize at once**; the
  design session pictured the review policy with a read-only probe that flips it in the read (`.probe/s6/probe.mjs`).
- **No test club has a `staff` member, a gate-only volunteer, or a volunteer on two events.** To prove A26 you need a
  gate-only official: **ask the owner first**, then narrow the Plus scorekeeper's jobs in Members, prove it, put them
  back, and read the restore back. **Never invite a real address** (an invite sends an email).
- **Probes write nothing** (refuse every non-GET), except a score or a check-in on the owner's word, undone at once
  and read back. Never write to production's demo.

## Retire the old look as you rebuild (definition of done)

Every file this stage rebuilds loses its old look in the same build, by Stage 1's method (fold `kx()`, drop
`useAdminKit()` false branches and `legacy` props, fold `[data-admin-kit] .x` rules one at a time with the kit-shadow
and background-shorthand audits, keep every `:where(:not([data-public-preview] *))` guard).
`npm run check:old-look:report` on 2026-10-07:
- `app/[orgSlug]/scorekeeper/scorekeeper.module.css` — kitScope 58.
- `components/volunteer/DayOfShell.module.css` — kitScope 25.
- `app/[orgSlug]/check-in/check-in-volunteer.module.css` — kitScope 6.
- `components/volunteer/ShellSignOutButton.tsx` — its inline `kx` patch (1); `components/volunteer/day-of-kit.ts` —
  the patches file, retired when nothing imports it.
- `app/[orgSlug]/admin/tournaments/staff-kit/staff-kit.module.css` — kitScope 10 (no stage named it before this one).
- **The admin bottom sheet** (`components/admin/BottomSheet.*`): its look changes under A29 for **all five of its
  users** (below). Stage 4's prompt listed it as never-fold because it is shared; A29 makes this stage its owner for
  this change. Fold its old layer only with every consumer proven.

Lock in every drop with `--init` in the same commit (rule 2). **Never fold:** `globals.css`'s kit layer,
`ExportMenu`, `CollapsibleCard`, `admin-common.module.css`, the shared tournament header and toolbar parts in
`components/admin/tournament/`, and the shared helpers (`useKitStyle`, `kitStyler`, `useKitButtons`,
`useKitAsterisk`). Report what was retired and anything left.

## What to build (all ruled 2026-10-07)

Commits: **Part 0 · Part 1 · Part 2 · Part 3 · Part 4** (one per part is fine). Part 0 first and on its own: it is
shared with Club Tier and changes who reaches which screen.

### Part 0 · A volunteer lands on the job they were given (A26, A25, V5) — own commit, shared with Club Tier roles

What exists (verified 2026-10-07, so this is "no new data"): `organization_members.capabilities` is the per-member
override (additive **and** subtractive); `ROLE_DEFAULTS.official` = `submit_scores`, `check_in_teams`; the
scorekeeper's layout walls on `submit_scores`, the gate's on `check_in_teams` (or `manage_registrations`); the score
and check-in routes check the same capabilities on the server; the shells already show a tab only for a job the
person holds; Members' *Manage* window already switches *Submit scores* and *Check teams in at the gate* per member.
What is missing:
- **The invite writes the job.** `app/api/admin/members/invite/route.ts` reads *Helping with* (`purpose`) only to pick
  the email's link, and writes no capabilities (the data dictionary says so: *"not written at invite time"*). Both
  of its inserts (an existing account, and the pending row for a new one) write, for an `official` only: *the gate* →
  `{ submit_scores: false }`, *scoring* → `{ check_in_teams: false }`, *both* → nothing. Subtractive only, never a
  key the role doesn't carry. **Update the dictionary's `organization_members.capabilities` note in the same commit**
  (schema = dictionary; `npm run check:dictionary`).
- **Every landing without a link reads the job**, by one rule in one place: an official who can score → the
  scorekeeper; one who can only check in → the gate. Today three places send every official to the scorekeeper:
  `lib/user-contexts.ts` (the Workspaces card's `destination`, and the sign-in destination), and the admin layout's
  official redirect (`app/[orgSlug]/admin/layout.tsx`). The accept-invite page asks the server, so it follows. The
  installed app's start resolves through the same sign-in destination. **A defect this also fixes:** an official an
  owner has already narrowed to the gate in Members lands today on the scorekeeper's *no access* wall at every
  sign-in.
- **A door they can't use is absent:** a one-job volunteer's shell shows that job's tab and Account (already true;
  prove it for a gate-only volunteer).
- **The invite's *Helping with* hint is true** (today *Opens the gate board to check teams in.* is false for a new
  volunteer). Its choices in the order *Scoring · The gate · Both* (words: Precondition 2).
- **The role's new name**, wherever `official` is shown (`ROLE_LABEL`, `roleEmailLabel`, the Workspaces card's badge,
  the accept page): Precondition 2's word, one spelling.
- **The Staff kit's *Invite a volunteer* door** (Part 4) opens Members' invite **with the volunteer role chosen**
  (a query the Members page reads once). The Members page's own *Invite* keeps its default (the ruling named the
  door).
- **P1 and P2** as the owner rules them.
- **A25: staff's landing is unchanged.** Don't touch it.
- **Proof:** a unit test of the landing rule for every job combination (both, scoring only, the gate only, neither,
  and `staff`); a test that the invite writes exactly the subtractive key for each *Helping with*; a read-only probe
  that a gate-only official lands on the gate from a bare sign-in, from `/admin`, and from the Workspaces card.

### Part 1 · The shells (V1, V3's head, V4's tablet, A27, A28, F59, F61)

`components/volunteer/DayOfShell.module.css`, `DayOfBottomBars.tsx`, `day-of-kit.ts`, the two layouts and pages.
- **The bars are opaque** (today 92–97% with no blur, F59): the page's paper. Nothing moves.
- **44px for everything a volunteer taps, on a phone and on a tablet (A27):** Refresh, Today, Filters, the ⇄ pill
  (41×30 today), the gate's picker; **above 640px** the header's *Check-in →* / *Scorekeeper →* and *Sign out* (19px
  and 15px tall today) and the buckets (42 today).
- **The title band:** *Field scores* at 20px (27 today, off the ladder) with Refresh on its line; the *SCOREKEEPER*
  eyebrow goes. The gate: *Check-in* with the event **under** it in the caption's ink (today beside it, where a long
  name wraps the title).
- **The Review count wears the amber pill while above zero (A28)** — the rail's waiting count, the same look the
  Teams division picker wears (`DivisionPicker.tsx`, `kit.count`). The pill **is** the count, never a second number;
  at zero a plain 0. Phone and tablet.
- **The clock leaves the capitals (F61):** the game card's time line in the body face, sentence case, 12px
  (*11:30 a.m.*); the gate's arrival chip keeps its capitals (*IN*) and the time sits beside it (*8:59 a.m.*). Every
  time through `formatTime()`. The spelling gate can't see a style, so **prove it on the rendered words**.
- **The game cards keep their shape** (a whole-card button, Up next with the olive edge, the formatting check's
  named keep); the state chips take the kit's one chip (10px capitals).
- **The gate's picker (J8-015):** with two or more assigned events, a 44px dropdown whose options say the status in
  the product's words. **The finished-event line**: a white callout with an amber edge (today an amber-tinted box).
- **Targets (from the drawing, 390):** the scorekeeper's first game ≈187px (today 191), 3 whole games, fixed chrome
  172px (unchanged); the gate's first team ≈237px (today 226), 6 whole rows.

### Part 2 · The sheets (V2, V3's team sheet, V4's Account; A29, A30, A32)

- **The score sheet onto the Sheet Frame's form layer (A30):** it covers the bars, as today; edge to edge at the foot,
  18px corners, the grab line, the portal's dim; a **sentence head** (*Enter the score*) with the game's line under
  it; **no ×** (Cancel stays the way out, the 2026-08-08 ruling, A30's named exception); a tap on the dim does
  nothing, as today. The boxes are unchanged (one per team, 64px on a phone, 72 wider; Enter moves on, never
  submits). The policy note is a white callout with an **amber** edge (the organizer reviews) or an **olive** edge
  (final at once), directly above the button. Cancel and the one lime at **44px**, in sentence case.
  - ⚠ Check before you mount it: the frame must not pull the coaches portal's big stylesheet into the shells (the
    Notifications build found a frame on an admin page loading it); measure the scorekeeper's CSS before and after.
- **After Submit:** the confirmation is the product's one-off notice, **`NoticePill`** (`RepKit.tsx`, Stage 4's *Draft
  created from…*), floating above the bars; today's 88px box at the top of the list goes, so the list no longer drops
  (≈104px today, F64). The drawing's note says *~8 s* (the sentence-notice rule); `NoticePill` lingers ~2.5 s, which
  is right for a volunteer's own action. **Say which you used.**
- **A sent-back score (A32):** when the organizer reverts a submitted score while the screen is open, one floating
  notice names the game and it is back under To score. This is news the volunteer didn't cause, so it gets the
  sentence notice's ~8 s. Nothing stored. **Build work in the same part:** the live update ignores `forfeit`, so a
  finalized forfeit keeps *Pending Review* until a refresh, and a forfeit counts in no bucket but All (F63).
- **The Account sheet onto the frame's menu layer (A30):** it sits **on top of the tab bar** with the bar live (a
  second tap on Account, or Score or Gate, closes it; today its dim covers the tabs it was opened from); its
  small-capitals label; **no ×** (today an outlined 38px square). Its contents as drawn: the person as its head, then
  *Install this app* and *Sign out* as two menu rows in **one ink treatment** (today a bordered card and two outlined
  buttons, Sign out olive).
- **The admin bottom sheet (A29), moved once for every user:** D4's 18px corners and the portal's dim; a record head
  (the team at 16/700 and one context line: *U11 Girls · Not arrived*, or *In · 8:59 a.m. · by ‹who›*); the **plain ×
  in a 44px tap area** (the 2026-10-07 ruling; today a 32px outlined square); *Mark paid · $475* and *Add roster* as
  44px white buttons (today a 35px amber-tinted box and an olive-tinted panel); the foot unchanged (No-show a third,
  the lime Check in two thirds, 48px). Its **five** users, all changing with it:
  - the gate's and the organizer's check-in board (`CheckInBoard.tsx`, one board, F13);
  - Teams' view settings on a phone (`registrations/page.tsx`) — **not named on the drawing**: the design note listed
    four users; this is the fifth. The ruling covers the sheet as one component; tell the owner it is included;
  - the schedule's reschedule sheet (`ScheduleTimeline.tsx`);
  - the public site's two follow sheets (`FollowAccountNudge.tsx`, `UnfollowConfirmSheet.tsx`). Public pages wear
    the public skin: check them in it. If the portal's dim isn't defined there, keep their dim and say so.

### Part 3 · The install banner (V6, A31)

`components/InstallAppPrompt.*` and `tests/unit/install-banner-layer-guard.test.ts`.
- **Above the bars:** the banner reads `--bottom-nav-height` (the public bar's 72px at ≤900px), which the shells never
  set, so on an iPhone it lands **on the buckets** (681–772px over the bar at 724–782; a tap on *To score* hits the
  banner). The shells **publish their bottom height** for it (the buckets + the tabs + the home bar; nothing above
  640px), as `--dayof-bottom-h` already does for their pages. Don't hard-code a number (`DayOfShell.module.css`'s
  header says why).
- **Under every sheet:** the score sheet (layer 100 today) and the Account sheet (90) sit under the banner (255); the
  gate's team sheet covers it. After this build every sheet covers it and it dims with the page. The guard test,
  which names the shells' sheets as not covered today, gains them.
- **The warm look on the warm shells:** today its warm skin switches on only where a page follows the theme, so on the
  fixed-warm shells it wears the dark product's blue edge and console capitals. Drawn: a white bar, the olive edge,
  sentence case, the app's own icon, a plain 44px ×.
- **Rules unchanged:** when it shows, the 90-day dismissal, never inside the installed app; *Install this app* stays
  in the Account sheet.
- **Cost (from the drawing):** ≈66px with the drawn words; 2 whole games on screen one until dismissed.

### Part 4 · The Staff kit and its printed page (V7, F65)

`app/[orgSlug]/admin/tournaments/staff-kit/page.tsx` and `staff-kit.module.css`.
- **The title band** as every Stage 1 page: *Staff kit* at 20px; Print the boxed 44px icon on a phone, a white 34px
  *Print* at a desk (today the retired grey button). The browser tab says *Staff kit*.
- **One sentence** under the title (today four lines).
- **Two cards** keep their QR codes (dark on a fixed white square, both themes) and one line each; the link breaks
  only at a slash (today *scorekeep / er*); **Copy link** a white button (an action), **Open** olive text with its
  arrow (a door, a new tab).
- ***Invite a volunteer*** is an olive door to Members' invite with the volunteer role chosen (Part 0). Today's
  closing paragraph goes.
- **A printed page of its own** (one Letter page): the club, *Volunteers*, the event and its dates, the two codes at
  210px with their links, three numbered steps, a footer. **No** rail, strip, event header, ground or buttons. (Today
  the print rule only hides Copy and Open.)
- **Dark:** the kit is an admin page and follows the theme (its drawing has a Dark copy). The two volunteer shells
  stay warm whatever the phone says (R3); draw nothing Dark there.

## Don't

- Change where `staff` lands (A25), a role's default capabilities, or any capability but an `official`'s two jobs.
- Change the Members page's own Invite default, the seat rules, or the one-home-organization rule for an official.
- Add a × to the score sheet, close it on a tap outside it, or bring back steppers.
- Store a sent-back mark (A32's unchosen option), or add a column.
- Fold the shells into the admin frame or give them a theme: they are the top-nav audit's ruled exception, fixed warm.
- Change the scoring rules, the review-and-finalize policy (Event settings, Stage 5) or Results (Stage 1's).
- Change the gate's board (Stage 1's, walked §253): only what the shell adds around it, and the shared sheet (A29).
- Write customer copy yourself, add a second row recipe, a second record window, a new chip tone, or tint an item row.
- Fix the public home's missing door for a signed-in volunteer (J8-022): the public pages' owner's; report it.

## Verification

- `npm run verify:changed`, and `npm run typecheck` (the landing resolver, the invite route, the shared sheet, the
  banner).
- **The layout sweep's `guest-*` entries** (scorekeeper, gate) at 390 / 360 / 768, Warm (they have no Dark), and the
  Staff kit's `admin-t-*` entry at 390 / 768 / 1440 in both themes, plus every screen the shared sheet reaches
  (check-in, Teams, the schedule). One runner at a time, scoped with `--only=`; contrast 0/0.
- **Probes** (in `.probe/`), asserting on state, never a guessed delay:
  - the targets above, read from the built screens at 390 (and 360, 768);
  - **nothing a volunteer taps is under 44px** on either shell at 390, 360 and 768 (the design session's list:
    Cancel, Submit, Refresh, Today, Filters, ⇄, the Account ×, the team sheet's ×, Mark paid, the tablet's doors and
    buckets);
  - **the banner** on an iPhone user agent: its bottom edge above the buckets' top, and under the score sheet, the
    Account sheet and the team sheet (the element at the sheet's centre is the sheet);
  - **the Review pill** shows only while a score waits (picture the review policy with the read-only flip);
  - **after Submit the first card does not move down** (a stubbed submit, as the design session did);
  - **a gate-only official** (narrowed with the owner's OK, restored after) lands on the gate from a bare sign-in,
    `/admin` and the Workspaces card, and sees two tabs (Gate, Account); the server refuses their score;
  - **the clock**: no rendered time in either shell matches `\d:\d\d\s?[AP]\.?M`;
  - **the Staff kit's print** (`page.pdf`, Letter): one page, nothing of the admin on it.
- Re-measure the built screens against the hub's figures and report any gap.

## Close-out

- **Offer `/simplify`, then `/review`**, before the commits: a landing rule shared by three places, a shared sheet
  with five users, and a banner contract.
- **Commit only when the owner says**, on `dev`, from a private index, explicit pathspecs, then `git show --stat
  HEAD`.
- **Help:** `/docs` for the volunteer guides (scorekeeper, gate), the Staff kit, and Members' invite (*Helping with*
  now decides what a volunteer can do), including `keywords` / `searchText` for the role's old name *Scorekeeper*.
- **The owner's walk:** a checkable walk on the hub's QA tab (ONE artifact: republish the same URL), one purpose — "a
  volunteer's game day, from a phone" (the QR code to the second score, the gate, the banner, the Account sheet, a
  gate-only volunteer's next morning) — with its own Owner QA Ledger §. Pin identities, not figures.
- **Route, don't do:** J8-022 to the public pages' owner.
- **Record:** the plan's status header and §6f as built, with commits; the hub's stage strip (Build) and a "Built"
  part on the Stage 6 tab; the TODO line; memory `project_tournament_admin_redesign`; `PROGRAM_TOURNAMENTS.md`'s
  pointer.
- **Migrations:** none expected. The invite writing an existing column changes what the dictionary says about it:
  update its note in Part 0's commit.
