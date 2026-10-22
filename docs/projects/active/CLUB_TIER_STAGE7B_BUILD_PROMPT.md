# Club Tier Stage 7b: Add our teams (build prompt)

> **Written 2026-10-21** after Stage 7a's walk §354 passed (all seven parts) and 7a + the dashboard follow-up committed
> (`4ef1d2f13`). Ruling: Stage 7 round 1, **Ask 5, option A** (design log 2026-10-20 "STAGE 7 …": "Add our teams is one window,
> many teams, a division per team, each entered, accepted and linked at once. The admin enters; the coach sees it appear. A head
> coach cannot enter the club's tournament from the coach portal."). **Paste this into a new chat on `dev`.** This prompt is
> **7b only**. 7c Email families and 7d the coach's Tournaments get their prompts after 7b commits and its walk passes; do not
> build them here. Ask 13: **7b gets its own checkable walk page** (one purpose per walk), a § in the Owner QA Ledger. Check the
> ledger's last § right before you write the entry (§354 is 7a's; other sessions have been taking numbers).
>
> **No new design session is needed.** The window is drawn (desktop and phone) and ruled. Build to the drawing, and where this
> prompt says the drawing is out of date, build to the prompt and say so in the hand-off.

## What 7b makes true

A club admin on a tournament's **Teams** page presses **Add our teams**, ticks any of the club's rep teams, picks a division for
each (a division picks itself when its name matches), and presses **Add 2 teams**. Each team is **entered, accepted and linked
to its rep team in that one step**, so there is never an unlinked club team in between. Its coaches see the tournament in their
portal and its games join their Schedule once games are set. The row reads **Our team**, the coach column is filled, Payment
reads **No fee**, and **nothing is written to any book** (7a's rule). No email goes to the club's own coach.

Today the club does this in two steps: "+ Add team" by hand, then open the record and "Link to a rep team". Until the link is made
the coach never sees the tournament (finding G03). The long way stays, for a visiting team and for a team that registered itself
on the public form.

## Read first

- **Drawings and rulings:** https://claude.ai/artifact/MLqvD7TXbLM5QX8H9mmapZ (source
  `docs/projects/active/CLUB_TIER_STAGE7_DRAWINGS.html`). Read: End state 1 "Add our teams" (`#e-add`, ~L533–617, desktop at
  1440 and the phone at 390), the "Not drawn → The build carries → 7b" bullet (~L1035), Ask 5 (~L1130), findings G03, S7-01 and
  drawing change 14 (the window is 640 wide; "Our teams enter with no fee" said once).
- `memory/design_decisions.md` entries 2026-10-20 "STAGE 7A PAYMENT DETAILS" (its **"Consequence for 7b"** line binds you) and
  "STAGE 7 …" (Ask 5).
- Walk §354 in `OWNER_QA_LEDGER.md` and the 7a prompt's "Hard parts" for the vocabulary (own team, receipt, baseline).
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md binds you: broad reading goes to a helper agent, and a helper's
  summary is a lead, not evidence.** The file:line leads below were gathered 2026-10-21 at HEAD `4ef1d2f13`; the load-bearing
  ones (`lib/host-own-team.ts`, the Coach column in `rowFacts`, the link route and guard) were re-opened by the main session.
  Re-read before you rely on any.
- `docs/agents/db/DATA_DICTIONARY.md`: any migration updates it, and `npm run refresh:snapshots`, in the same unit of work.

## The ruled spec

| Part | Ruled | Drawn |
|---|---|---|
| The window (Ask 5) | **One window, many teams**: tick the club's teams, a division each, **Add N teams**. 640 wide on a computer, fills the screen on a phone. | drawing 1 |
| Who may | **Whoever can add teams to the tournament today** (`create_tournaments`), on an org that runs rep teams. **A head coach cannot enter the club's tournament from the coach portal**: coach-side registration stays off for club teams. | "Who sees it" |
| What an entry is | **Entered, accepted and linked at once.** "Our team" on the row, the head coach in Coach, "No fee" in Payment. The link is the existing rep-team link, made explicitly. | drawing 1 |
| The list | **Only this season's active teams.** A team already in the tournament sits under **Already in** with "entered Oct 7", not tickable. | drawing 1 |
| Division | A division **picks itself when its name matches the team's**, otherwise "Choose a division". A ticked team needs a division before Add. | drawing 1 |
| No fee, said once | **"Our teams enter with no fee"** once, in the window. Nothing is written to any book. | change 14 |
| No email | **No email goes to the club's own coach.** The coach learns from their Tournaments list (that is 7d's drawing 6; do not build it). | "What changes" |
| What stays | "+ Add team" keeps "Add team manually" for visitors; the record's "Link to a rep team" stays for a self-registered team. | "What changes" |
| Table | The Teams table **reads the head coach through the link**. | "Not drawn" 7b |

The words are `/marketing`'s: build the placements, flag every sentence.

## Corrections to what the drawings and plan said (verified in code 2026-10-21)

1. **"Add my team" is not the pattern to extend, only to learn from.** It is for a **coaches-portal workspace** (one team, the
   team comes from the workspace, no team id in the request: `app/api/admin/teams/own-team/route.ts`,
   `lib/host-own-team.ts` `addHostOwnTeamToTournament` ~L134; guard `tests/unit/coach-own-team-entry-guard.test.ts`). A club has
   many teams and a picker. **Build a separate route and server function that takes explicit rep team ids; leave the portal
   star and its guard alone.** Do not show both on one page: the portal star shows when `isHostPortal`
   (`isTeamWorkspaceOrg`), Add our teams when the org runs rep teams and is not a portal.
2. **Nothing is transactional today.** `addHostOwnTeamToTournament` inserts the `teams` row, then both bridges, and on a failed
   bridge deletes the row by hand (~L185–205). No SQL function creates a registration for a rep team. With many teams a hand-made
   rollback is the wrong tool: see Hard part 1.
3. **The Coach column does not read the head coach through the link today.** `rowFacts` reads the registration's own
   `team.coach` text (`registrations/page.tsx` ~L1412). "The table reads the head coach through the link" is **new work**, and
   so is finding who the head coach is: a rep team's head coach lives in `rep_team_coaches` (`coach_role = 'head_coach'`,
   per program year), then the user's name and email.
4. **Nothing prevents entering one rep team twice.** The only unique index is on `tournament_team_id`
   (mig 196); `rep_team_tournament_registrations` has no tournament column, so the database cannot say "one entry per rep team
   per tournament". Today only the Add-my-team path checks (`findHostRegistrationInTournament`, ~L100). **Enforce it on the
   server, under a lock** (Hard part 2); the window's "Already in" is only the courtesy.
5. **The rep-teams picker has no season filter and no division mapping.** `GET /api/admin/rep-teams/teams` returns every
   non-archived team (`getRepTeams`), filtered by `repGroupIds` for a scoped member. "This season's active teams" needs a
   definition (Hard part 3); "a division picks itself" needs a rule (the rep team's `division` field against the tournament's
   division names).
6. **Create-team has no capacity, waitlist or closed-division check** (`app/api/admin/teams/route.ts` ~L273–435); those live in
   the public register route. Parity with "+ Add team" means the new window has none either. **Ask the owner** (Put to the owner 3).
7. **The window's foot has changed since the drawing.** The drawing's "closing asks in the foot (Keep choosing · Discard)" is
   superseded by One window 2d: the "Close without saving?" sentence is **hidden everywhere, buttons only**, and a form window
   closes on Cancel, ← or Escape, never a scrim tap. Use `KitDialog` (`kind="form"`, `size="medium"`, `dirty` while a team is
   ticked) and let it do what it does. A count sentence ("1 team ticked.") still belongs in **`footerStart`, left** (guard
   `tests/unit/kit-dialog-foot-text-guard.test.ts`). The "Our teams enter with no fee" sentence goes where the drawing put it
   unless the foot rule above forbids it; if it does, move it to the window's opening paragraph and say so.
8. **The page's existing Add team and Add my team windows are legacy `.modal-overlay` markup**, not `KitDialog`
   (`ADMIN_BAR_BEHIND_FORMS_PLAN.md` lists both). There is no KitDialog Add-team to copy. The page's payment-reminders window
   (~L2261–2293) is the nearest KitDialog form on this page. Do not migrate the legacy windows here.
9. **Today's dashboard fix is a stopgap this stage should finish.** Commit `4ef1d2f13` found the club's own team inside the
   dashboard's own payment read, with an inline lookup of the linked registrations. The **payment-reminder send and the
   check-in board's unpaid views still do not know which team is the club's own**, so entering our teams in bulk would put them in
   a reminder. See Hard part 5.

## Leads (all under the repo root; line numbers approximate)

| Need | Where |
|---|---|
| The Teams page; legacy Add team (~L2193) and Add my team (~L2143, handler ~L864); `rowFacts` (~L1407); `isClubOwnTeam` (~L245); repLinks load (~L388–414) | `app/[orgSlug]/admin/tournaments/registrations/page.tsx` |
| Create-team validation (duplicate name, locked tournament, invite-only plan, platform-admin email) | `app/api/admin/teams/route.ts` ~L273–435; `findDuplicateTournamentTeam`; `isTournamentLocked`; `inviteOnlyRefusal` |
| Add my team (the template; the compensating delete; refusals) | `lib/host-own-team.ts`; `app/api/admin/teams/own-team/route.ts` |
| The link and its refusals | `lib/rep-team-tournament-links.ts`; `app/api/admin/teams/rep-team-link/route.ts` (`DELIBERATE_REFUSALS`); trigger `club_tournament_own_link_guard` (mig 342 ~L316, rewritten in mig 345) |
| The one "our team" answer | `lib/club-own-tournament-team.ts` `isOurTournamentTeam` (a single registration); the dashboard's inline set (`app/api/admin/tournament-dashboard/route.ts`, `clubOwnTeamIds`) |
| What the coach reads through the link | `lib/coach-registration-access.ts`, `lib/basic-coach-teams.ts` (`getMergedTournamentHistoryForRepTeam` ~L1513, `CoachScheduleTournamentGame` ~L1243), `lib/rep-tournament-game-mirror.ts`, `lib/rep-tournament-season-scope.ts` (the working-season rule), `lib/registrable-teams*.ts`, `lib/team-registration-duplicates.ts` (`findTeamEntriesInTournament`) |
| Rep teams and their coaches | `getRepTeams` (`lib/db.ts` ~L3036); `RepTeamCoach` (`lib/types.ts` ~L1258); `GET /api/admin/rep-teams/teams` |
| The window | `components/admin/kit/club/KitDialog.tsx` (`size="medium"` = 640); an example `DivisionRecord.tsx` ~L544 |
| Tests to read first | `coach-own-team-entry-guard`, `club-stage7a-link-refusal`, `tournament-payments-tracked`, `club-stage7a-house-fee-red` (all `tests/unit/`) |
| Help | `lib/help-content/tournaments.tsx` ~L823–858 (Add team; "Link to a rep team"); `lib/help-content/coaches.tsx` ~L962–971 (hosted tournament, Add my team) |

## Hard parts (design these before you write)

1. **Many teams, one outcome.** Each team is a `teams` insert plus a link, and 7a's trigger can refuse a link. Decide the
   shape **before** writing: **recommended: one database function** (a new migration; check the next free number, 345 was the
   last) that takes the tournament, the team-and-division pairs and the actor, locks, validates every row, and writes all of it
   in one transaction, so the answer is **all entered or none** and a refusal names the team. The alternative (per-team writes
   with a compensating delete and a per-row result) leaves a half-entered set when one fails. Prove it with a rolled-back probe
   in `scripts/check-club-money-atomicity.mjs`'s style. Any migration is ORDER-CRITICAL for the release: add it to the prod
   steps list (`MANUAL_PROD_STEPS.json`); function-only migrations are verified by `pg_proc`. If you pick the alternative, say
   why in the hand-off.
2. **Two admins at once, or one admin twice.** The same rep team must not be entered twice in one tournament by a double press
   or two people (Correction 4). Take a lock on the tournament row (or an advisory lock keyed on it) inside the function, then
   check "already in". A test for the race, not just the sequence.
3. **"This season's active teams."** The picker today has no season notion. The coach portal reads tournaments through the
   working season (`rep-tournament-season-scope.ts`: a team with no live season has one door, and a closed season is a page).
   Decide what "active" means for a rep team **from what the code already uses** (a live program year, not archived), keep it
   one definition shared with the server check (the server must refuse a team that is not eligible, not just hide it), and
   list any team the rule hides with its reason rather than dropping it silently. A scoped member sees only their groups
   (`repGroupIds`): the server enforces it, as the rep-teams route does.
4. **The head coach.** Two jobs: **show** the head coach in Coach, and give the registration what its other readers need.
   Add my team writes the head coach's name and auth email **into the registration** (`coach`, `email`); several readers
   read those columns (the dashboard's "missing email" and Coaches card, reminders, the invite flow). A club team with an empty
   email would read as "no email on file" and "haven't signed up" on today's dashboard, though its coach is already signed in.
   **Recommended: write the head coach's name and email at entry (as Add my team does) AND read the head coach live through the
   link for display when one exists**, so a coach change shows without editing the registration; a rep team with no head coach
   enters with a blank Coach and a plain line in the window, never a block. Decide, and put it to the owner (below).
5. **One "our team" answer for every reader.** Entering our teams in bulk makes the stopgap in `4ef1d2f13` the wrong shape.
   Move the set-returning lookup into `lib/club-own-tournament-team.ts` (the same two gates as the Teams page: the org runs rep
   teams and carries accounting), and have **every payment reader use it**: the Teams page, the dashboard, **the payment-reminder
   send, the check-in board's unpaid views, and the bulk mark-paid / export / import paths** that already resolve the club's own
   team, or write down which do and which do not. A test that fails when a reader is added without it. This is also the open
   "reminder send doesn't know" item from §354's follow-up. (c2, the stamped paid figure on a bulk-marked own team, **stays 7d**.)
6. **What a new row's `payment_status` is.** Create-team inserts `pending`; Add my team forces `paid` unless payments are
   tracked. A new own team must not read as "owes" anywhere (Hard part 5) and must not be stamped with a paid dollar figure
   (7a's baseline rule). Pick the value the existing readers already treat as exempt for a linked team, test every payment
   surface for it, and do not invent a new status.
7. **The link guard and the order of writes.** 7a's "Consequence for 7b": a newly added own team **must be linked before any
   paid figure is set**. Inserting the row with `deposit_paid` / `total_paid` at 0 then linking satisfies the trigger; prove it,
   and prove a refusal (a rep team of another club, a tournament in another org) rolls the whole set back with the sentence the
   link route already sends.
8. **Gates the window must honour.** The tournament locked or completed (the legacy windows and `isTournamentLocked` say how);
   the invite-only plan rule that "+ Add team" applies (`inviteOnlyRefusal`): decide whether an own team is exempt (it needs no
   invitation) and ask if unsure; the platform-admin-email refusal does not apply (no email is typed). A rep team whose name
   matches another team in the same division (`findDuplicateTournamentTeam`): refuse with the existing sentence, naming the team.
9. **Notifications and chat.** Add my team ends with `notify('registration_new')` and a chat-membership refresh. The chat is
   paused (E1–E6: every door hidden, data kept; one switch and a guard test), so follow the pause's rule, not the old call.
   The admin bell may say teams were added; the **coach gets no email** (ruled).
10. **The coach's side must really work.** "Its games join their Schedule once games are set" is the promise: after an entry,
    the coach's Tournaments list, the record (`coaches/teams/[teamId]/tournaments/[registrationId]`) and the Schedule's mirror
    (`rep-tournament-game-mirror`) must show it **for the working season's team**. Verify with the UAT coach fixture, not by
    reading the code. 7d reworks those screens; 7b only has to make the data arrive.

## Definition of done

1. The window: open from **Add our teams** on the Teams header (`+ Add team` and `Export` as drawn), your teams under **Your
   teams**, **Already in** with the entry date, division pick with the name-match rule, a count in the foot, **Add N teams**.
   Desktop 640 and the phone full screen with a full-width 44 px division field under a ticked team (`check:layout --changed`
   on the Teams page at 361 and 1440, plus the window open if the script supports it).
2. Entering any set of teams writes, **in one transaction**, a `teams` row per team (accepted, no fee, head coach filled as
   decided) and its explicit link; a refusal rolls back the set; the same team twice, or two presses at once, enters it once.
   Tests for each, **including the race**, and `npm run check:club-money-atomicity` extended and green.
3. The row reads **Our team**, Payment **No fee**, Coach the head coach; the dashboard, reminders, check-in and bulk paths
   treat the entered teams as owing nothing (one helper, a guard test), with the existing 7a tests still green
   (`tournament-payments-tracked`, `club-stage7a-link-refusal`).
4. A head coach cannot enter the club's tournament from the portal (an unchanged refusal, with a test that pins it); the portal
   star still works for a portal; a member without `create_tournaments`, a tournament in another org, and a rep team from
   another club are all refused by the server.
5. The coach, signed in (UAT fixture), sees the tournament in their Tournaments list and record, and its games on the
   Schedule once set. No email was sent (the send log or the mail stub is empty).
6. Gates: `npm run verify:changed`, `typecheck` (shared modules + a migration), the club unit tests, `check:layout --changed`,
   `check:spelling`. Dictionary + snapshots for the migration. **Do not run the whole-product layout sweep on dev.**
7. Records: plan §6 Stage 7 "7b BUILT" (departures + found-not-fixed), TODO, design log for any new ruling, Owner QA Ledger §,
   the project index (`stages/s7` + a log row), **the 7b walk page** (Ask 13): setup, add two teams with one matching and one
   unmatched division, the coach's view, "Already in", the double press, a refused entry, the unchanged long way. Offer `/review`,
   `/simplify`, `/design` (it was run on the drawing; run it again on the built window at 390 and 1440), `/docs` (the Tournaments
   article: Add our teams beside "Link to a rep team"; the hosted-tournament coach article) and `/marketing` per CLAUDE.md;
   **commit only when the owner says**, through a private index (the tree holds other sessions' edits in TODO, plan, ledger,
   design log).

## Put to the owner at the start (do not guess)

1. **One transaction or per-team results?** Recommended: all-or-nothing in one database function (Hard part 1): if one team in a
   set is refused, none is entered and the window names the team.
2. **The head coach on the registration.** Recommended: write the head coach's name and email at entry **and** read the head
   coach live through the link for display (Hard part 4). Alternative: read through the link only, which leaves the dashboard's
   email and sign-up counts and reminders wrong for club teams.
3. **A full division.** "+ Add team" lets an admin enter past a division's capacity with no warning, and the dashboard then
   reads "9 of 8 spots". Recommended: **the same here (the admin is the authority), with the division's remaining spots named
   under its field** ("15U · 1 spot left" / "15U is full"), no refusal. Say if you want a hard stop instead.
4. **Invite-only events.** Does an own team on an invite-only (free) tournament plan enter through the same window with no
   invitation? Recommended: yes, it is the club's own team and needs no claim.
5. **A rep team with no head coach yet.** Recommended: it may be entered (blank Coach, one plain line under it in the window).
