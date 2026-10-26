# Club Tier Stage 9c: teams and people (build prompt)

> **Written 2026-10-26**, the day the owner ruled all fourteen 9c asks as recommended (plan §0f). **Paste this into a new chat on
> `dev` and re-verify every lead first.** Unlike 9b-2's prompt, the leads below **were read in the code** during the 9c drawing
> session (2026-10-25), with file and line where it helped, but code moves: re-open each before building on it. Other sessions
> share this working copy (Stage 12, the support console): stage explicit paths only, commit only your own hunks, use a
> temporary index when a file is shared (memory: "Partial commit out of shared files").
>
> **Recommended model: Opus 5.5** (a new access door for a new kind of person, a gate column, data about children, a family send).
> Helpers stay on Sonnet as configured.
>
> 9c is built in **parts, each committed locally after its own checks**. Part 1 (data and the gate) is the base.

## What 9c makes true

A convenor makes a division's teams in one place: **rate** each accepted player from 1 to 5, **lock** a coach's own child to
their team, **run a balanced draft** (strongest first, the order reversing each round, locked players counted), adjust by
dragging or "Move to…", then **publish**. Publishing is per division and held: it sends **one placement email per family**
through the club's existing batched sender, puts the **team and coach on the family's status page**, and **invites each coach**
to a **team page of their own**: one screen with their players and each family's name, email and phone. A coach signs in with
the invited address and their sign-in card opens that page directly; they never see the Coaches Portal, ratings, fees or another
team. After publishing, a move asks first and emails that family; an ended registration leaves its team. The old "Draft mode"
overlay and Randomize are gone.

## The rulings (do not reopen; record nothing they did not rule)

**§0f, owner 2026-10-26 (all fourteen as recommended):** 9c·1 a coach's team page of its own, portal untouched · 9c·2a the
registrar never sees ratings, on any screen or export · 9c·2b a rating lives with this season's registration and is **erased
automatically when the season finishes** · 9c·2c a number 1–5, **no comment box**, never on a family screen · 9c·3 **Lock to
this team** before the draft; the draft deals around locks and counts their ratings · 9c·4 placement emails in 9c through the
**existing batched sender**, one per family, never counted toward a cap, and **delivered to a family who unsubscribed from club
news** · 9c·5 retire Draft mode and Randomize · 9c·6 publish **one division at a time** · 9c·7 a player still to review is **not
drafted**, and is named with a link · 9c·8 unrated players **count as a 3** · 9c·9 a coach sees **guardian name, email and phone**,
and the sign-up form says so (one line) · 9c·10 the coach invite goes **at Publish**; a coach added later is invited when the
convenor confirms · 9c·11 the status page **names the coach** (the club's "Coaches on team pages" setting keeps governing public
pages only) · 9c·12 a move after publishing **asks, then emails** the family; both coaches' pages change at once.

**Earlier rulings this build stands on:** Q7 light coach accounts (own team only, roster contacts, schedule, scores) · Q8
convenor-only ratings feeding a balanced snake draft · Q9 volunteers are not Stage 9 · Q17 one gate, a coach is **a column of the
same gate** (`lib/house-league-access.ts`) · Q19 age groups are divisions, a draft per division · Q3 an accepted unpaid player
holds their spot (so is drafted) · 9a·2 the season frame is unchanged · Q12c automatic notices never count toward a cap. House
rulings: edit autosaves, **a change that tells families is held until ✓**; absent beats disabled; a phone's secondary action is
its symbol alone at 44px; reorder on a phone is hold-and-drag (9c has no reorder to build); one toolbar, rare tools behind ⋯; the
amber waiting count; a record reads first, edits whole; every highlight is clickable; the bare possessive; one spelling.

## Read first

- **The drawings, ruled:** https://claude.ai/artifact/C56VdDqASJ4x53EoFWZjyk (source `HOUSE_LEAGUE_STAGE9C_DRAWINGS.html`).
  Tabs: Push-backs (why), Teams & draft (a–d), Coaches & who sees what (e, h), Publish & families (f, g), Edge states (i). The
  **lock (9c·3) is ruled but not drawn**: build it from the words in the copy's §5, inside the board's existing ⋯ and Move sheet.
  Do not draw anything else new.
- **The words:** `HOUSE_LEAGUE_STAGE9C_COPY.md` (`/marketing`, 2026-10-26). Use its strings; its §14 lists what changed from
  the drawings and why (notably: no mention of a daily cap anywhere in 9c; the coach page's Schedule slot links to the season's
  public schedule; "players" on staff counts). **Its §15 has two open word questions** (publishing with unplaced players: warn
  or block; no "the" before a team name in templates): get the owner's answer in the UX summary step; build the recommendation if
  the owner says go.
- **The plan:** `HOUSE_LEAGUE_STAGE9_PLAN.md` §0f, §3 (F16, F23), §4 (the 9c row), §9 (the 9c DRAWN entry: findings T01–T09 and
  three build notes). The drawings' red flags hold T01–T09 in full.
- `HOUSE_LEAGUE_STAGE9B2_COPY.md` (statuses, money words, the ending window and "Ask to withdraw": reuse them),
  `HOUSE_LEAGUE_STAGE9B2_BUILD_PROMPT.md` (the shape of a 9-series build).
- `memory/design_decisions.md`: the 2026-10-19 heading ruling (D1, every mixed-case title in the body face; D2 the chosen look
  for a toggle, used by the rating buttons), the lettering ruling (numbers in the body face), "Family emails wear the club"
  (2026-10-23), "One window", "A window's foot", "One toolbar", the table-and-list standard.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (including the Coaches Portal section: **9c must not add a single branch to the
  portal**). **Broad reading goes to a helper; a helper's summary is a lead, not evidence.** Schema = dictionary, same unit of
  work; decide columns from the snapshots, never from migration files.

## Leads to re-verify (read in the code 2026-10-25)

| What | Found |
|---|---|
| Teams page | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx` (~1,074 lines, old look, `@dnd-kit/core`, hand-rolled windows, `useKitButtons`). Division is a `<select>`; Randomize; Start/Resume draft; Export (`TEAMS_EXPORT_COLS`: team, division, coach, count); Clear all assignments. No phone layout. CSS shared in `house-league.module.css`. |
| The draft | `app/api/admin/house-league/seasons/[seasonId]/draft/route.ts`: `advance()` is a **rotation, not a snake** (T01); `start` leaves out placed players but `getRemainingPlayers` does not, so **placed players re-enter after the first pick** (T02). State in `league_seasons.draft_state` (jsonb, one per season; `LeagueDraftState` in `lib/types.ts`). Finalize calls `bulkAssignTeams`. |
| The pool | Accepted only: `registrations?status=active&divisionId=` (registrations route `.eq('status', status)`), `getRegistrationsForDivision(…, {status:'active'})` in `lib/db.ts`. Payment not checked (correct under Q3). Received (`pending_review`) players **hold a spot** (`lib/league-registration-place.ts`) but are invisible here (T09). |
| Team data | `league_teams`: id, season_id, division_id, name, color, coach_name (free text, "deliberately unlinked"), sort_order, created_at; **no org_id**. `league_registrations.team_id` nullable; assignment has **no status guard**. |
| Ending keeps the team | 9b-2's ending (`endLeagueRegistration` → `league_registration_close`) **leaves `team_id`** (fixture: Avery Macdonald, 2026, declined, still on the Cardinals) (T08). |
| The gate | `lib/house-league-access.ts`: runners owner/admin/league_admin; desk adds league_registrar; `coach` is an `OrgRole` with an **empty capability set on purpose** (`lib/roles.ts`, audit J4-005) and is named nowhere in the gate. |
| Where a coach lands | `lib/user-contexts.ts`: a `coach` member's card opens `/{slug}/coaches` (and none at all without an active subscription); `app/[orgSlug]/coaches/page.tsx` shows "No team assignments yet". **Precedent:** the `official` card opens the one job the volunteer holds (`officialHome`). |
| Invites | Rep coach invites: `assistant_invite_tokens`, `lib/assistant-invites.ts` (`acceptInviteRow` inserts a capability-less `coach` membership if none, then a rep staff membership; the invited email must match the signed-in one), accept page `app/(consumer)/auth/accept-assistant-invite`, words `clubCoachInviteSubject`/`clubCoachInviteHtml` in `lib/email.ts` (7-day link). |
| One person, several hats | One `organization_members` row per person per club; the rep coach "hat" lives in its own table, not the role (memory: 1:1 user-org decision). |
| The batched sender | `lib/family-email.ts` `sendFamilyEmailBatch`: dedupes addresses, batches of 100, suppression through the person, per-family unsubscribe footer. `lib/families-email.ts` adds the club's claim and 3-a-day cap: **do not use that path** (Q12c). Today's automatic house-league emails go one at a time via `sendTransactionalEmail`: do not copy that. |
| Status page | `app/api/league/[orgSlug]/[seasonSlug]/status-lookup/route.ts` (its select omits `team_id`), `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx` (rows: label left, value right). The data dictionary's line that the page hides declined/withdrawn is stale (9b-2 shows them): fix it while you are there. |
| Sign-up form | `components/league/RegisterForm.tsx`, "Parent or guardian" section. |
| Fixture | `dev-league-org` (League plan). 2027: U10 Division A has 5 accepted, 3 families (j7-test@dev.local has three children), **no teams**. 2026 (running): Division A 7 accepted on Cardinals/Jays/Orioles, Maya Singh to review; Division B: Ava Kim accepted with **no team**, Henry Kim on the Tigers; every team's coach_name is "Pat Volunteer". Accounts `league-owner@ / league-registrar@ / league-treasurer@dev.local`, `devpass123` (sign-in only, never reset). |

## Things to argue before building (disagree out loud)

1. **Where the coach link lives.** Being a coach must not change a person's club role: a registrar or club admin can coach a
   team too. Recommendation: a **team–coach link table** (team, email, the person once accepted, invited/accepted/bounced facts)
   is the access truth; accepting creates a capability-less `coach` membership **only if the person has none**; the sign-in card
   is built from the link rows (one card per team), not from the role. Say whether you reuse `assistant_invite_tokens` for the
   token (preferred: one invite machinery) or why not. **No route under `/admin` and none under `/coaches`**: the page has its
   own signed-in route; check `proxy.ts` for what a new signed-in path needs.
2. **Ratings must not leak through existing reads.** Several house-league routes select whole registration rows. A rating column
   on `league_registrations` would reach the registrar, the exports and the status page by accident. Recommendation: **its own
   table**, read and written only through runner-gated routes, erased when the season finishes (in the same transaction as the
   status change, or a trigger on it), plus a **guard test** that no registrar-reachable route or export returns a rating.
3. **The draft is a pure function with tests before it is a screen.** Inputs: players with rating (null = 3), locks (player →
   team), teams; seeded random for ties and the first pick. Proposed rule: locked players are placed first and their ratings start
   each team's total; the rest are sorted strongest first and dealt in snake order, where a team **skips its turn while it has
   more players than the smallest team** (so locks never make sizes uneven), and the first round starts with the lowest locked
   total. Tests: the fixture's 5 into 2 (sizes 3 and 2), all unrated (an even random deal), every player locked (refused), fewer
   players than teams (refused), 37 into 4, two locks on one team. If you find a better balancing rule, argue it; the owner ruled
   "snake" and "counts their ratings", nothing finer.
4. **Publish is a fact first, an email second.** One transaction writes the division's published-at, each player's placement and
   the coach invites; only then the send. A send that fails partway leaves the division published, records which families
   failed, and offers "Send the {n} again" (the copy's §7.2). Persist each family's outcome so the bounced line survives a
   reload. Confirm `sendFamilyEmailBatch`'s suppression drops only bounces and complaints for a **service** message, not an
   unsubscribe from club news (9c·4); if it would drop one, add the distinction there, once.
5. **Existing seasons with teams count as published, with no email** (the plan's build note): backfill published-at for every
   division that already has players on teams, so turning 9c on never emails a season being played.

## Before any code

1. **The product-manager UX summary** (AGENCY_RULES, blocking), plain words: what the convenor, club admin, registrar,
   treasurer, a coach and a family see differently; the gate with the coach column; the five arguments above; and the copy's two
   open word questions. Get the owner's yes.
2. The words are written (`HOUSE_LEAGUE_STAGE9C_COPY.md`). If the code forces a string the file doesn't have, write it in the
   file's voice and list it in the commit; anything a family reads goes back through `/marketing`.

## What to build, in parts

**Part 1 · Data and the gate.** One additive migration (next number after the highest in `supabase/migrations`, 374 when this was
written: check; dev only; recorded in `MANUAL_PROD_STEPS.json`; dictionary and snapshots in the same unit of work): the ratings
table; the team–coach link table; a division's published-at; a player's lock; what the status page needs to say "Moved from
{team} on {date}" (the previous team and when); the backfill of published-at (argument 5). **Ending a registration takes the
player off their team** (T08), keeping the previous-team fact. The gate's **coach column** (own team only, read: players and
guardian contacts; nothing else) and the **ratings row** (runners only) in `lib/house-league-access.ts`, with the guard tests from
argument 2 and a test that a coach of one team reads nothing of another. Leave `league_seasons.draft_state` in place, unused, and
say so in the dictionary (never drop a column).

**Part 2 · The draft.** The pure function and its tests (argument 3); the draft route rewritten around it (run, draft again) with
the refusals in copy §4.3; locks; "Moved by you" kept until publish with "Put back on {team}". Retire Draft mode and Randomize
(routes and code). The setup window's lines come from the same read as the draft (who is in, who isn't and why).

**Part 3 · Teams & draft, rebuilt once on the kit.** In the season frame (unchanged): division tabs with counts; the division's
state pill (clickable, copy §1.2); the four steps with their buttons absent until pressable; the board (team cards in a wrapping
grid with coach and state, Not on a team with the amber count, rating chips, owes, asked-to-withdraw, locked, moved-by-you, left
lines, the balance line); Tools ⋯ (Export, Take all players off teams); the **rating window** (desk table with bulk, phone rows of
five 44px buttons, keyboard 1–5, autosave, "Not rated" filter); the **team window** (reads first, edits whole; coaches with email;
held invite/remove after publish; coach state lines); the **phone list** and the **Move to…** sheet. The **registrar's view**
(copy §13): no ratings anywhere, no write controls. Retire the old windows; update the old-look and colour-debt lists for what you
rebuilt, and only that.

**Part 4 · Publish and the emails.** The held Publish window with its checks, the sending state, the result lines (done, bounced,
failed with "Send again"); the placement email (one per family per division, every child of that family in the division listed),
the late-placement email, the move email (held move after publishing, copy §6.2); the coach invite at Publish and on a confirmed
add after it. Family emails on the club's envelope (`familyNotice`); the coach invite mirrors the club's rep invite.

**Part 5 · The coach's door.** The invite accept path for a house-league team (argument 1); the sign-in card (one per team, opening
the page); the **team page** (phone first, desk too): players with guardian name, email and phone, Copy emails (with the select
fallback), the Schedule slot linking to the season's public schedule, the Scores line, the foot; a coach of two teams gets the
switcher; the "no longer a coach" and "season finished" states (the page stays 30 days after the season finishes, then the card
goes); the wrong-address invite refusal (reuse the rep invite's if it fits). A coach's whole product is this page: no admin, no
portal.

**Part 6 · The family side.** The status page's Team and Coach rows and the moved line (copy §11), only for an accepted child,
with the coach names regardless of the public coach-names setting (9c·11); the sign-up form's coach line (copy §12); ratings
erased when the season finishes (Part 1's mechanism, tested here end to end).

**Part 7 · Help and the lists.** `/docs`: the guides for Teams & draft (rating, locks, the draft, publishing, moves after
publishing), the coach's team page (for the club admin: how coaches get in), and the family status page's team. `check:layout
--changed` on Teams & draft, the rating, team and Publish windows, the coach page and the status page at 1440 and 390, Warm and
Dark (dev server for `--changed` only). The demos follow the product: nothing to do unless a tour anchor moved (the build fails
if one did).

## Definition of done

- Parts 1–7 committed; `npm run verify:changed` and `npm run typecheck` clean; the draft tests, the ratings-never-leak guard, the
  coach-reads-only-their-team test, the ending-leaves-the-team test and the publish tests pass; the existing guards stay green
  (`house-league-gate-guard`, `league-season-scope-guard`, `club-stage5c-families-guard`, the coach-portal one-door and history
  guards: **9c adds nothing to the portal**).
- `/review` on Part 1 (access, data about children) and Part 4 (the send), and on the whole; findings fixed or recorded.
- **The 9c walk**: a checkable Artifact and the next § in `OWNER_QA_LEDGER.md` (§378 was 9b-2's; check the last number), one
  purpose per walk. Cover: rate a division (desk bulk, phone); lock a child; run the draft (fixture 2027 U10 Division A: 5 into 2)
  and draft again; move by hand and put back; publish (the Test family's one email naming three children; Pat's invite); the
  status page before, after, and after a move; a move after publishing (held, one email); end a registration after publishing
  (leaves the team, the coach's page drops them); a late acceptance placed (Ava Kim); the coach accepting the invite and their
  page on a phone; a coach of another team reading nothing of this one; the registrar's view (no ratings, no controls, no rating
  in the export); the season finishing erases ratings.
- The plan's status log and §4 updated; the PM brief updated; a news row on the Club index (`ArtifactData`, artifact
  `MBKRySURVFu3V9cZJvmjVr`, stage `s9`; read it first and pin `if_version`); the TODO line with commit anchors; memory
  `project_club_stage9_house_league.md` updated.

## Carried in, not yours to build

- **9d** fills the coach page's Schedule slot with the team's games and moves the season's typed email onto the batched sender
  with Q12c's per-season cap; **9e** puts score entry on the coach page. Leave both slots as the copy words them.
- **Stage 14** decides whether ratings follow a returning player. **Volunteers (Q9)** are their own project. Siblings and
  "with a friend" are not ruled.
- **Prod:** migrations 361–363 and 368–372 precede the promote; yours join `MANUAL_PROD_STEPS.json`. No promote.

## Do not

- Add a branch, a nav entry or a rule to the Coaches Portal, or route a house-league coach into it.
- Store a rating on the registration row, show it to a family, a coach or the registrar, carry it past the season, or add a comment
  field.
- Send placement emails one at a time, through the Families composer's claim and cap, or count them toward any cap.
- Build 9d (the generator, the composer consolidation, audiences), 9e (scores, standings), 9f, Stage 12, volunteers, a live
  draft night, sibling or friend grouping, or an unpublish.
- Drop a column. Touch the phone bar, the More sheet or the rail's top level (Stage 13). Reopen a ruling. Push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit; a temporary index when a file carries another session's
hunks. Parts 1 and 2 may each be committed alone. No push and no promote without the owner's word.
